import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { isValidPeriod, periodToExpiry, priceForPeriod } from '@/lib/billing'
import { findExistingTenant } from '@/lib/provision'
import PayForm from './PayForm'
import type { BillingPeriod } from '@prisma/client'

export const dynamic = 'force-dynamic'

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  six_month: '6 months',
  yearly: 'Yearly',
  lifetime: 'Lifetime (one-time)',
}

// Two ways to land here:
//
//   POS flow (the original): /pay?plan_id=…&period=…&fp=…&device_uuid=…
//     The buyer is identified by their POS device's hardware fingerprint.
//
//   Tenant-portal flow (the new self-upgrade path): /pay?plan_id=…&period=…&tenant_id=…
//     The buyer is already logged in as a tenant user; they have no
//     hardware fingerprint because they're not paying from a POS terminal.
//
// We accept either. fp is optional when tenant_id is provided.
export default async function PayPage({
  searchParams,
}: {
  searchParams: {
    plan_id?: string
    period?: string
    fp?: string
    device_uuid?: string
    tenant_id?: string
    name?: string
    email?: string
  }
}) {
  const planId = searchParams.plan_id
  const period = searchParams.period
  const fp = (searchParams.fp ?? '').trim()
  const tenantId = (searchParams.tenant_id ?? '').trim()

  // One of fp or tenant_id is required. Two query strings, one page.
  if (!planId || !period) notFound()
  if (!fp && !tenantId) notFound()
  if (!isValidPeriod(period) || period === 'trial') notFound()

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan || !plan.isActive) notFound()

  const amount = priceForPeriod(plan, period as BillingPeriod)
  const expiresAt = periodToExpiry(period as BillingPeriod, new Date())

  // Resolve the existing tenant either by direct id (portal flow) or by
  // hardware fingerprint / device uuid (POS flow). In both cases we want
  // the form to show the existing restaurant name read-only so a typo at
  // checkout can't spawn a duplicate tenant.
  let existing: { id: string; name: string; contactEmail: string | null } | null = null
  if (tenantId) {
    existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, contactEmail: true },
    })
    if (!existing) notFound()
  } else {
    existing = await findExistingTenant({
      hardwareFingerprint: fp,
      deviceUuid: searchParams.device_uuid,
    })
  }

  return (
    <PayForm
      planId={plan.id}
      planName={plan.name}
      period={period}
      periodLabel={PERIOD_LABELS[period] ?? period}
      amount={amount}
      currency={plan.currency}
      expiresAt={expiresAt.toISOString().slice(0, 10)}
      fingerprint={fp}
      deviceUuid={searchParams.device_uuid ?? ''}
      tenantId={tenantId || (existing?.id ?? '')}  // portal flow forces tenantId; POS flow leaves it empty
      defaultName={searchParams.name ?? ''}
      defaultEmail={searchParams.email ?? ''}
      existingTenantName={existing?.name ?? null}
      existingTenantEmail={existing?.contactEmail ?? null}
      // The portal flow originates from a logged-in tenant — a portal user
      // should never edit the restaurant name here, so the form locks it.
      isPortalFlow={!!tenantId}
    />
  )
}
