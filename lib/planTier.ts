// Compare two plan feature bundles to decide whether buying the target is
// an upgrade, a renewal of the same plan, a strict downgrade, or
// incomparable (each side has something the other doesn't).
//
// Used by /my/upgrade so the UI can:
//   - highlight the current plan + offer "Extend" (renewal),
//   - offer "Upgrade" on strictly better plans,
//   - DISABLE strictly worse plans so the user can't accidentally pay for
//     a downgrade,
//   - leave incomparable plans available with a generic "Switch" button.

export type PlanFeatures = {
  pos?: boolean
  qr_menu?: boolean
  report_account?: boolean
  max_devices?: number
  max_tenant_users?: number
  support_priority?: boolean
  description?: string
  [k: string]: unknown
}

export type TierRel = 'current' | 'higher' | 'lower' | 'incomparable'

// Helper: every dimension of B ≥ same dimension of A (with no dimension
// strictly lower). When equal → 'current'. When strictly greater anywhere
// → 'higher' (assuming nothing strictly lower). Otherwise 'incomparable'
// or 'lower'.
function dimGte(a: number, b: number) { return b >= a }

export function compareFeatureBundles(
  current: PlanFeatures | null | undefined,
  target: PlanFeatures,
): TierRel {
  if (!current) return 'higher'  // no current sub → buying anything is an upgrade

  // Boolean flags we care about
  const flags: (keyof PlanFeatures)[] = ['pos', 'qr_menu', 'report_account', 'support_priority']
  // Numeric quotas
  const nums: (keyof PlanFeatures)[] = ['max_devices', 'max_tenant_users']

  let anyHigher = false
  let anyLower  = false

  for (const f of flags) {
    const c = !!current[f]
    const t = !!target[f]
    if (t && !c) anyHigher = true
    if (c && !t) anyLower  = true
  }
  for (const n of nums) {
    const c = (current[n] as number | undefined) ?? 0
    const t = (target[n]  as number | undefined) ?? 0
    if (!dimGte(c, t)) anyLower  = true
    if (t > c)         anyHigher = true
  }

  if (!anyHigher && !anyLower) return 'current'
  if (anyHigher && !anyLower)  return 'higher'
  if (anyLower  && !anyHigher) return 'lower'
  return 'incomparable'
}
