// Shared provisioning logic. Called from two places:
//   - The external checkout webhook (/api/v1/license/provision)
//   - The internal /pay page after a (stubbed) successful payment
//
// Both paths land here so the rules — tenant reuse, trial upgrade, etc. —
// stay in one place.
//
// Tenant lookup priority:
//   1. Device table, by device_uuid (always unique, set on activation)
//   2. LicenseClaim, by hardware_fingerprint (covers earlier flows)
//   3. Otherwise create a new tenant
//
// Once an existing tenant is found, we KEEP its name. The pay/webhook
// "customerName" field only feeds tenant.contactName so a typo at checkout
// can't spawn a duplicate or rename a real account.

import { prisma } from './db'
import { generateLicenseKey } from './license'
import { isValidPeriod, periodToExpiry, priceForPeriod } from './billing'
import type { BillingPeriod } from '@prisma/client'

export type ProvisionInput = {
  // Direct tenant lookup — used by the tenant self-service "Upgrade" page
  // where there's no POS device and therefore no fingerprint. When set,
  // this skips the device/fingerprint lookup entirely.
  tenantId?: string
  // Provided by POS-driven flows (Buy / Renew via the POS chooser). When
  // tenantId is omitted, we fall back to deviceUuid → fingerprint lookup.
  hardwareFingerprint?: string | null
  deviceUuid?: string | null
  planId: string
  period: string
  customerEmail?: string | null
  customerName: string
  paymentRef?: string | null
  paymentMethod?: string | null
  amountPaid?: number | null
  currency?: string | null
}

export type ProvisionResult = {
  ok: true
  tenantId: string
  licenseKey: string
  expiresAt: Date
  reused: boolean         // true when we extended an existing tenant
} | {
  ok: false
  error: string
  status: number
}

// Public helper: resolve the tenant a given (fp, deviceUuid) is already
// attached to, if any. Used by /pay to show the existing name read-only.
export async function findExistingTenant(opts: {
  hardwareFingerprint?: string | null
  deviceUuid?: string | null
}): Promise<{ id: string; name: string; contactEmail: string | null } | null> {
  if (opts.deviceUuid) {
    const d = await prisma.device.findUnique({
      where: { deviceUuid: opts.deviceUuid },
      include: { tenant: { select: { id: true, name: true, contactEmail: true } } },
    })
    if (d?.tenant) return d.tenant
  }
  if (opts.hardwareFingerprint) {
    const claim = await prisma.licenseClaim.findFirst({
      where: { hardwareFingerprint: opts.hardwareFingerprint.trim() },
      orderBy: { createdAt: 'desc' },
    })
    if (claim?.tenantId) {
      const t = await prisma.tenant.findUnique({
        where: { id: claim.tenantId },
        select: { id: true, name: true, contactEmail: true },
      })
      if (t) return t
    }
  }
  return null
}

export async function provisionSubscription(b: ProvisionInput): Promise<ProvisionResult> {
  if (!isValidPeriod(b.period) || b.period === 'trial') {
    return { ok: false, error: 'invalid_period', status: 400 }
  }
  const period = b.period as Exclude<BillingPeriod, 'trial'>
  const fp = (b.hardwareFingerprint ?? '').trim()
  if (!b.tenantId && !fp) {
    return { ok: false, error: 'missing_identity', status: 400 }
  }

  const plan = await prisma.plan.findUnique({ where: { id: b.planId } })
  if (!plan || !plan.isActive) return { ok: false, error: 'invalid_plan', status: 400 }

  const startedAt = new Date()
  const expiresAt = periodToExpiry(period, startedAt)
  const amount = b.amountPaid ?? priceForPeriod(plan, period)
  const currency = b.currency ?? plan.currency

  const result = await prisma.$transaction(async (tx) => {
    // ─── Tenant lookup (in order of reliability) ───────────────────────
    let tenantId: string | null = null

    // 0. Explicit tenantId — set when called from the tenant self-service
    //    Upgrade page. Most direct, no lookup needed.
    if (b.tenantId) tenantId = b.tenantId

    // 1. Device.deviceUuid is the strongest fingerprint-based signal
    if (!tenantId && b.deviceUuid) {
      const device = await tx.device.findUnique({ where: { deviceUuid: b.deviceUuid } })
      if (device) tenantId = device.tenantId
    }

    // 2. Hardware fingerprint claim history (manual / trial activations)
    if (!tenantId && fp) {
      const priorClaim = await tx.licenseClaim.findFirst({
        where: { hardwareFingerprint: fp },
        orderBy: { createdAt: 'desc' },
      })
      if (priorClaim?.tenantId) tenantId = priorClaim.tenantId
    }

    let tenant
    let reused = false
    if (tenantId) {
      // Reuse the existing tenant. KEEP its name as-is to prevent typos at
      // checkout from renaming or duplicating real accounts. We only update
      // contact details and re-activate if it had been suspended.
      reused = true
      tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          contactEmail: b.customerEmail ?? undefined,
          contactName: b.customerName,
          status: 'active',
        },
      })
    } else {
      // Truly new tenant — first-time payer with no prior trial/manual claim.
      tenant = await tx.tenant.create({
        data: {
          name: b.customerName,
          contactEmail: b.customerEmail ?? null,
          contactName: b.customerName,
          licenseKey: generateLicenseKey(),
        },
      })
    }

    // Cancel previous trial/expired subs so the new one is unambiguously current
    await tx.subscription.updateMany({
      where: { tenantId: tenant.id, status: { in: ['trial', 'expired'] } },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })

    const sub = await tx.subscription.create({
      data: {
        tenantId: tenant.id, planId: plan.id, period,
        startedAt, expiresAt, status: 'active', paymentRef: b.paymentRef,
      },
    })
    const noteParts: string[] = []
    if (b.paymentMethod) noteParts.push(`via ${prettyMethod(b.paymentMethod)}`)
    if (b.paymentRef)   noteParts.push(`ref ${b.paymentRef}`)
    await tx.invoice.create({
      data: {
        subscriptionId: sub.id, tenantId: tenant.id,
        amount, currency, status: 'paid', paidAt: new Date(),
        note: noteParts.join(' · ') || null,
      },
    })
    // Only record a fingerprint claim when there's actually a fingerprint.
    // Self-upgrades from the web (no POS device) skip this — the existing
    // claim from the original POS pairing keeps the by-fingerprint poll
    // happy on the customer's terminal.
    if (fp) {
      await tx.licenseClaim.create({
        data: {
          hardwareFingerprint: fp,
          tenantId: tenant.id,
          email: b.customerEmail ?? null,
          kind: 'paid',
        },
      })
    }
    await tx.event.create({
      data: {
        tenantId: tenant.id, type: 'subscription.provisioned',
        payloadJson: {
          plan: plan.name, period, amount, currency,
          paymentMethod: b.paymentMethod ?? null,
          paymentRef: b.paymentRef ?? null,
          reused,
        },
      },
    })
    return { tenant, sub, reused }
  })

  return {
    ok: true,
    tenantId: result.tenant.id,
    licenseKey: result.tenant.licenseKey,
    expiresAt: result.sub.expiresAt,
    reused: result.reused,
  }
}

function prettyMethod(m: string): string {
  switch (m) {
    case 'card':      return 'Card'
    case 'super_qi':  return 'Super Qi'
    case 'zain_cash': return 'Zain Cash'
    case 'manual':    return 'Manual'
    default:          return m
  }
}
