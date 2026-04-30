import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rateLimit'

// POS polls this every few seconds while waiting for the customer to finish
// checkout. We must NEVER return found:true for a tenant whose subscription
// hasn't actually been renewed — otherwise the WaitForPayment loop exits
// without unlocking and the user gets stuck on the spinner.
//
// Rules:
//   1. Match only `paid` claims (manual / trial claims describe earlier
//      activations, not a fresh payment).
//   2. The matched tenant must currently have a non-cancelled, non-expired
//      subscription. Without that, finding a paid claim from months ago
//      doesn't mean anything for this checkout session.
//   3. Optional `since` query param: only consider claims created after
//      that timestamp — POS sends Date.now() at the start of polling so
//      stale claims from previous renewal attempts don't satisfy a new one.

export async function GET(req: NextRequest) {
  // Polled aggressively from the WaitForPayment screen — give it enough
  // headroom for the 3s polling cadence + Check now button.
  const limited = rateLimit(req, { key: 'by-fingerprint', limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const fp = req.nextUrl.searchParams.get('fp')?.trim() ?? ''
  if (!fp) return NextResponse.json({ error: 'missing_fp' }, { status: 400 })

  const sinceParam = req.nextUrl.searchParams.get('since')
  const since = sinceParam ? new Date(parseInt(sinceParam, 10)) : null

  const claim = await prisma.licenseClaim.findFirst({
    where: {
      hardwareFingerprint: fp,
      kind: 'paid',
      ...(since && !isNaN(since.getTime()) ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!claim?.tenantId) return NextResponse.json({ found: false })

  const tenant = await prisma.tenant.findUnique({
    where: { id: claim.tenantId },
    include: {
      subscriptions: {
        where: { status: { in: ['active', 'trial'] } },
        orderBy: { expiresAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!tenant) return NextResponse.json({ found: false })
  // Guard: a paid claim with no live subscription is meaningless. Ignore it.
  if (tenant.subscriptions.length === 0) return NextResponse.json({ found: false })
  // Also guard against claim being created before the live subscription
  // (i.e. the live subscription was actually a separate, older one).
  if (claim.createdAt < tenant.subscriptions[0].startedAt) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    license_key: tenant.licenseKey,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    expires_at: tenant.subscriptions[0].expiresAt.toISOString(),
  })
}
