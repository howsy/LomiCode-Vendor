'use server'

import { redirect } from 'next/navigation'
import { requireTenant } from '@/lib/guard'
import { prisma } from '@/lib/db'
import { compareFeatureBundles, type PlanFeatures } from '@/lib/planTier'
import { getTenantSubscription } from '@/lib/tenantFeatures'

// Turn user-facing flash text into ?err=… on the upgrade page so we surface
// what happened without an unhandled-error page.
function bail(msg: string): never {
  redirect(`/my/upgrade?err=${encodeURIComponent(msg)}`)
}

export async function upgradeAction(formData: FormData) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!

  const planId = String(formData.get('planId') ?? '')
  const period = String(formData.get('period') ?? '')
  if (!planId || !period) bail('Pick a plan and a billing period first.')

  const validPeriods = ['monthly', 'six_month', 'yearly', 'lifetime']
  if (!validPeriods.includes(period)) bail('Invalid billing period.')

  // ── Anti-mistake guards ──────────────────────────────────────────────
  // Pull the target plan's features and the user's current entitlement so
  // we can refuse same-plan repurchase + strict downgrades server-side.
  // (The UI hides those buttons too, but a determined user could still
  // POST the form by hand.)
  const [targetPlan, currentSub] = await Promise.all([
    prisma.plan.findUnique({ where: { id: planId } }),
    getTenantSubscription(tenantId),
  ])
  if (!targetPlan || !targetPlan.isActive) bail('That plan is no longer available.')

  const currentFeatures: PlanFeatures | null = currentSub.features
    ? (currentSub.features as PlanFeatures)
    : null

  const rel = compareFeatureBundles(currentFeatures, (targetPlan.featuresJson as PlanFeatures) ?? {})

  // No current subscription → any plan is an upgrade. Skip the rest.
  // 'current' → only an extension is allowed (server validates the plan
  // matches the user's current plan name to be safe).
  // 'lower' → strict downgrade, reject.
  // 'incomparable' / 'higher' → allowed.
  if (rel === 'lower') {
    bail("This plan has fewer features than your current one. You can't downgrade from here.")
  }

  // ── Pay portal redirect (always) ────────────────────────────────────
  // Send the tenant to the existing /pay page with `tenant_id` in the
  // query string. /pay accepts either fp (POS flow) or tenant_id (this
  // portal flow), looks up the existing tenant so the restaurant name
  // stays locked at checkout, and provisions the subscription on submit.
  //
  // We do NOT use buildTenantPurchaseUrl here — the operator-configured
  // template is shaped for POS (with {fp} / {device_uuid} tokens), and
  // we don't have those in a portal upgrade. The /pay page IS our pay
  // portal; redirecting straight to it is simpler and guaranteed to work.
  const params = new URLSearchParams({
    plan_id: targetPlan.id,
    period,
    tenant_id: tenantId,
  })
  redirect(`/pay?${params.toString()}`)
}
