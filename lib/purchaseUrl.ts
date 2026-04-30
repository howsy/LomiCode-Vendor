// Build the external checkout URL for a given (plan, period, tenant).
// Tokens in the template are replaced with concrete values:
//
//   {plan_id}     — Plan UUID
//   {plan_name}   — human-readable plan name
//   {period}      — monthly | six_month | yearly | lifetime
//   {tenant_id}   — the buying tenant's UUID
//   {amount}      — numeric price for that period (e.g. "49")
//   {currency}    — "USD" / "IQD" / etc.
//
// Per-plan template wins over the global vendor-setting template, mirroring
// how the POS resolves its buy URLs in src/main/sync.js.

import type { Plan } from '@prisma/client'
import { getSetting } from './vendorSettings'

type Period = 'monthly' | 'six_month' | 'yearly' | 'lifetime'

function priceFor(plan: Plan, period: Period): number | null {
  const v =
    period === 'monthly'   ? plan.monthlyPrice :
    period === 'six_month' ? plan.sixMonthPrice :
    period === 'yearly'    ? plan.yearlyPrice :
    period === 'lifetime'  ? plan.lifetimePrice : null
  return v == null ? null : Number(v)
}

// Returns the resolved URL, or null when no template is configured. The
// caller falls back to immediate provisioning in dev so the system still
// works without a real payment provider.
export async function buildTenantPurchaseUrl(opts: {
  plan: Plan
  period: Period
  tenantId: string
}): Promise<string | null> {
  const tpl = opts.plan.purchaseUrlTemplate
    || (await getSetting('purchase_url_template', '')).trim()
  if (!tpl) return null

  const amount = priceFor(opts.plan, opts.period)
  const replacements: Record<string, string> = {
    plan_id:   opts.plan.id,
    plan_name: opts.plan.name,
    period:    opts.period,
    tenant_id: opts.tenantId,
    amount:    amount == null ? '' : String(amount),
    currency:  opts.plan.currency,
  }

  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const v = replacements[key]
    return v == null ? '' : encodeURIComponent(v)
  })
}
