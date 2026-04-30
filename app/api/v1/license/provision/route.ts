import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSetting } from '@/lib/vendorSettings'
import { provisionSubscription } from '@/lib/provision'

const Body = z.object({
  hardware_fingerprint: z.string().min(8).max(200),
  device_uuid: z.string().uuid().optional(),
  plan_id: z.string().uuid(),
  period: z.string(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().min(1).max(120),
  payment_ref: z.string().optional(),
  payment_method: z.string().optional(),
  amount_paid: z.number().nonnegative().optional(),
  currency: z.string().optional(),
})

// External-checkout webhook. Authenticated by `X-Vendor-Secret` header.
export async function POST(req: NextRequest) {
  const secret = await getSetting('webhook_secret', '')
  const sent = req.headers.get('x-vendor-secret') ?? ''
  if (!secret || sent !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 })
  }
  const b = parsed.data
  const result = await provisionSubscription({
    hardwareFingerprint: b.hardware_fingerprint,
    deviceUuid: b.device_uuid,
    planId: b.plan_id,
    period: b.period,
    customerEmail: b.customer_email,
    customerName: b.customer_name,
    paymentRef: b.payment_ref,
    paymentMethod: b.payment_method,
    amountPaid: b.amount_paid,
    currency: b.currency,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({
    ok: true,
    tenant_id: result.tenantId,
    license_key: result.licenseKey,
    expires_at: result.expiresAt.toISOString(),
  })
}
