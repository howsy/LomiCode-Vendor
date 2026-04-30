import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateLicenseKey } from '@/lib/license'
import { getSetting } from '@/lib/vendorSettings'
import { periodToExpiry } from '@/lib/billing'
import { rateLimit } from '@/lib/rateLimit'

const Body = z.object({
  hardware_fingerprint: z.string().min(8).max(200),
  email: z.string().email(),
  restaurant_name: z.string().min(1).max(120),
  device_uuid: z.string().uuid(),
  hostname: z.string().optional(),
  os: z.string().optional(),
  app_version: z.string().optional(),
})

// Unauthenticated. One trial per (hardware_fingerprint OR email).
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: 'trial', limit: 5, windowMs: 60_000 })
  if (limited) return limited

  const enabled = await getSetting('enable_trial', 'true')
  if (enabled === 'false' || enabled === '') {
    return NextResponse.json({ error: 'trial_disabled' }, { status: 403 })
  }
  const trialDays = parseInt(await getSetting('trial_days', '7'), 10) || 7

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 })
  }
  const b = parsed.data
  const fp = b.hardware_fingerprint.trim()
  const email = b.email.trim().toLowerCase()

  // Anti-abuse: one trial per fingerprint, one per email
  const prior = await prisma.licenseClaim.findFirst({
    where: {
      kind: 'trial',
      OR: [{ hardwareFingerprint: fp }, { email }],
    },
  })
  if (prior) {
    return NextResponse.json({ error: 'trial_already_used' }, { status: 409 })
  }

  // Trial gate: refuse if a PAID tenant already exists for this fingerprint.
  // Otherwise customers who churn can keep getting fresh 7-day trials.
  const paidExisting = await prisma.licenseClaim.findFirst({
    where: { hardwareFingerprint: fp, kind: 'paid' },
  })
  if (paidExisting) {
    return NextResponse.json({ error: 'paid_tenant_exists', hint: 'Renew your existing subscription instead of starting a new trial.' }, { status: 409 })
  }

  const startedAt = new Date()
  const expiresAt = periodToExpiry('trial', startedAt, trialDays)

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: b.restaurant_name,
        contactEmail: email,
        contactName: b.restaurant_name,
        licenseKey: generateLicenseKey(),
      },
    })
    const sub = await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        period: 'trial',
        status: 'trial',
        startedAt, expiresAt,
      },
    })
    const device = await tx.device.create({
      data: {
        tenantId: tenant.id,
        deviceUuid: b.device_uuid,
        hardwareFingerprint: fp,
        appVersion: b.app_version,
        os: b.os, hostname: b.hostname,
      },
    })
    await tx.licenseClaim.create({
      data: { hardwareFingerprint: fp, email, tenantId: tenant.id, kind: 'trial' },
    })
    await tx.event.create({
      data: { tenantId: tenant.id, deviceId: device.id, type: 'trial.started', payloadJson: { email, days: trialDays } },
    })
    return { tenant, sub, device }
  })

  return NextResponse.json({
    ok: true,
    license_key: result.tenant.licenseKey,
    tenant_id: result.tenant.id,
    tenant_name: result.tenant.name,
    expires_at: result.sub.expiresAt.toISOString(),
  })
}
