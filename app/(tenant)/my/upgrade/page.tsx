import { prisma } from '@/lib/db'
import { requireTenant } from '@/lib/guard'
import { getTenantSubscription } from '@/lib/tenantFeatures'
import { compareFeatureBundles, type PlanFeatures, type TierRel } from '@/lib/planTier'
import { PageHeader, Card, PrimaryButton } from '@/components/ui'
import { upgradeAction } from './actions'

export const dynamic = 'force-dynamic'

// Per-card UX rules:
//   current     — highlighted, button: "Extend"
//   higher      — call-to-action highlight, button: "Upgrade →"
//   lower       — visually disabled, no button, "Already covered" hint
//   incomparable — neutral card, button: "Switch"
//
// Plus: the action server-side rejects same-plan and lower-tier purchases
// even if the UI is bypassed.

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: { err?: string; ok?: string }
}) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!
  const [plans, sub] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    getTenantSubscription(tenantId),
  ])

  const currentFeatures: PlanFeatures | null = sub.features as PlanFeatures

  return (
    <>
      <PageHeader
        title="Subscription"
        hint="Choose a plan and billing period. You can't downgrade — we'll only show options at-or-above your current plan."
      />

      {searchParams.err && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 font-medium
                        dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          ⚠ {searchParams.err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const f: PlanFeatures = (p.featuresJson as any) ?? {}
          const rel: TierRel = compareFeatureBundles(currentFeatures, f)
          // The user's current plan name still serves as a friendly badge;
          // tier comparison is done on features so a plan rename doesn't
          // confuse the UI.
          const isNamedCurrent = sub.planName === p.name && sub.status !== 'none'
          const isCurrentTier  = rel === 'current'
          const isHigher       = rel === 'higher' || (sub.status === 'none' && rel !== 'lower')
          const isLower        = rel === 'lower'

          return (
            <PlanCard
              key={p.id}
              plan={p}
              features={f}
              rel={rel}
              isCurrentTier={isCurrentTier}
              isNamedCurrent={isNamedCurrent}
              isHigher={isHigher}
              isLower={isLower}
            />
          )
        })}
      </div>

      <Card className="mt-6 bg-emerald-50 border-emerald-200 dark:!bg-emerald-500/[0.06] dark:!border-emerald-500/30">
        <div className="text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
          Secure checkout
        </div>
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          Clicking <strong>Upgrade</strong> takes you to checkout where you'll pick a payment
          method (card, Super Qi, Zain Cash). Your new plan activates the moment the payment clears.
        </p>
      </Card>
    </>
  )
}

function PlanCard({
  plan, features, rel, isCurrentTier, isNamedCurrent, isHigher, isLower,
}: {
  plan: any
  features: PlanFeatures
  rel: TierRel
  isCurrentTier: boolean
  isNamedCurrent: boolean
  isHigher: boolean
  isLower: boolean
}) {
  const description = (features.description as string | undefined) ?? null

  // Card styling per state
  let ringClass = ''
  if (isCurrentTier) {
    ringClass = 'border-emerald-300 ring-1 ring-emerald-200 dark:!border-emerald-500/40 dark:ring-emerald-500/20'
  } else if (isHigher) {
    ringClass = 'border-emerald-100 dark:!border-emerald-500/20'
  } else if (isLower) {
    ringClass = 'opacity-50'
  }

  return (
    <Card className={`flex flex-col ${ringClass}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{plan.name}</h2>
        {isCurrentTier ? (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full
                           dark:text-emerald-300 dark:bg-emerald-500/15">
            ✓ Current
          </span>
        ) : isLower ? (
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full
                           dark:text-slate-300 dark:bg-white/[0.08]">
            Already covered
          </span>
        ) : isHigher ? (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200
                           dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30">
            Upgrade
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full
                           dark:text-slate-300 dark:bg-white/[0.08]">
            Switch
          </span>
        )}
      </div>

      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{description}</p>
      )}

      <ul className="mt-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
        <FeatureRow ok>POS app</FeatureRow>
        <FeatureRow ok={!!features.qr_menu}>QR Menu</FeatureRow>
        <FeatureRow ok={!!features.report_account}>Reports portal</FeatureRow>
        <FeatureRow ok>Up to {features.max_devices ?? 1} POS device{(features.max_devices ?? 1) === 1 ? '' : 's'}</FeatureRow>
        <FeatureRow ok>Up to {features.max_tenant_users ?? 0} portal user{(features.max_tenant_users ?? 0) === 1 ? '' : 's'}</FeatureRow>
        {features.support_priority && <FeatureRow ok>Priority support</FeatureRow>}
      </ul>

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06] space-y-2">
        <PriceRow label="Monthly"   amount={plan.monthlyPrice}   currency={plan.currency} />
        <PriceRow label="6 months"  amount={plan.sixMonthPrice}  currency={plan.currency} highlight={savingPct(plan.monthlyPrice, plan.sixMonthPrice, 6)} />
        <PriceRow label="Yearly"    amount={plan.yearlyPrice}    currency={plan.currency} highlight={savingPct(plan.monthlyPrice, plan.yearlyPrice, 12)} />
        {plan.lifetimePrice != null && (
          <PriceRow label="Lifetime" amount={plan.lifetimePrice} currency={plan.currency} once />
        )}
      </div>

      {isLower ? (
        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 italic">
          Your current plan already includes everything in this tier — no need to switch.
        </div>
      ) : (
        <form action={upgradeAction} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="planId" value={plan.id} />
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Period</label>
            <select
              name="period"
              defaultValue="yearly"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
            >
              {plan.monthlyPrice  != null && <option value="monthly">Monthly</option>}
              {plan.sixMonthPrice != null && <option value="six_month">6 months</option>}
              {plan.yearlyPrice   != null && <option value="yearly">Yearly</option>}
              {plan.lifetimePrice != null && <option value="lifetime">Lifetime</option>}
            </select>
          </div>
          <PrimaryButton type="submit">
            {isCurrentTier
              ? (isNamedCurrent ? 'Extend' : 'Renew')
              : isHigher
                ? 'Upgrade →'
                : 'Switch →'}
          </PrimaryButton>
        </form>
      )}
    </Card>
  )
}

function FeatureRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}>
        {ok ? '✓' : '✗'}
      </span>
      <span className={ok ? '' : 'text-slate-400 dark:text-slate-500 line-through'}>{children}</span>
    </li>
  )
}

function PriceRow({
  label, amount, currency, once, highlight,
}: {
  label: string
  amount: any
  currency: string
  once?: boolean
  highlight?: string | null
}) {
  if (amount == null) return null
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">
        {label}
        {highlight && (
          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider
                           text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded
                           dark:text-emerald-300 dark:bg-emerald-500/15">
            {highlight}
          </span>
        )}
      </span>
      <span className="text-slate-900 dark:text-white">
        <strong>{Number(amount).toLocaleString()}</strong>
        <span className="text-slate-500 dark:text-slate-400 ml-1">{currency}{once ? ' once' : ''}</span>
      </span>
    </div>
  )
}

// "Save 17%" badge alongside discounted billing periods. monthlyEquivalent
// = period total / months. Returns null when the period has no discount or
// when monthly isn't priced.
function savingPct(monthly: any, period: any, months: number): string | null {
  if (monthly == null || period == null) return null
  const m = Number(monthly)
  const p = Number(period)
  if (!isFinite(m) || !isFinite(p) || m <= 0) return null
  const expected = m * months
  if (p >= expected) return null
  const pct = Math.round(((expected - p) / expected) * 100)
  if (pct < 5) return null
  return `Save ${pct}%`
}
