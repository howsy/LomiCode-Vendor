'use server'

import { redirect } from 'next/navigation'
import { provisionSubscription } from '@/lib/provision'

// Stub payment processor. Real card / Super Qi / Zain Cash integration goes
// here later — currently it just generates a fake reference and provisions
// the subscription.
//
// Two paths converge here:
//   POS flow → identified by `fingerprint`
//   Tenant portal flow → identified by `tenantId` (no fp, no device)
// provisionSubscription accepts either.
export async function payAndProvision(formData: FormData) {
  const planId = String(formData.get('planId') ?? '')
  const period = String(formData.get('period') ?? '')
  const fp = String(formData.get('fingerprint') ?? '').trim()
  const deviceUuid = String(formData.get('deviceUuid') ?? '').trim() || null
  const tenantId = String(formData.get('tenantId') ?? '').trim() || null
  const method = String(formData.get('method') ?? 'card')
  const customerName = String(formData.get('customerName') ?? '').trim()
  const customerEmail = String(formData.get('customerEmail') ?? '').trim() || null

  // We need at least one identity (fp OR tenantId) plus a name. The portal
  // flow pre-fills the name from the tenant record; the POS flow asks for
  // it on the form.
  if (!planId || !period || (!fp && !tenantId) || !customerName) {
    const back = tenantId
      ? `/pay?plan_id=${planId}&period=${period}&tenant_id=${tenantId}&error=missing_fields`
      : `/pay?plan_id=${planId}&period=${period}&fp=${encodeURIComponent(fp)}&error=missing_fields`
    redirect(back)
  }

  // ─── DEMO: replace this whole block with real payment processing ───
  // Card: charge via Stripe / FastPay / etc., capture transaction ref.
  // Super Qi: validate the card serial+pin against their API.
  // Zain Cash: send OTP, verify, debit wallet.
  // For now we just synthesize a reference so the rest of the pipeline works.
  const paymentRef = `DEMO-${method.toUpperCase()}-${Date.now().toString(36)}`
  // ───────────────────────────────────────────────────────────────────

  const result = await provisionSubscription({
    tenantId: tenantId || undefined,
    hardwareFingerprint: fp || null,
    deviceUuid,
    planId,
    period,
    customerEmail,
    customerName,
    paymentRef,
    paymentMethod: method,
  })

  if (!result.ok) {
    const back = tenantId
      ? `/pay?plan_id=${planId}&period=${period}&tenant_id=${tenantId}&error=${encodeURIComponent(result.error)}`
      : `/pay?plan_id=${planId}&period=${period}&fp=${encodeURIComponent(fp)}&error=${encodeURIComponent(result.error)}`
    redirect(back)
  }

  // After-pay landing: the POS flow returns to the success page so the
  // cashier waits while the POS detects the new license. The portal flow
  // sends the tenant straight back to their reports overview, where the
  // banner will reflect the fresh subscription within a refresh.
  if (tenantId) {
    redirect('/my/overview?upgraded=1')
  }
  redirect(`/pay/success?fp=${encodeURIComponent(fp)}&method=${encodeURIComponent(method)}`)
}
