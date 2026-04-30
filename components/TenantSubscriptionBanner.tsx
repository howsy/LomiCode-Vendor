// Always-visible subscription strip at the top of every /my/* page.
// Three colour modes:
//   - emerald (active, plenty of time)
//   - amber   (active but expiring within 14 days, or in grace)
//   - red     (no subscription / expired beyond grace)

import Link from 'next/link'
import type { TenantSubscription } from '@/lib/tenantFeatures'

export default function TenantSubscriptionBanner({ sub }: { sub: TenantSubscription }) {
  const status = pickStatus(sub)

  return (
    <div className={`rounded-xl px-4 py-3 mb-6 border flex items-center justify-between gap-4 ${status.bg} ${status.border}`}>
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xl">{status.icon}</span>
        <div className="flex-1">
          <div className={`text-xs uppercase tracking-wider font-semibold ${status.fg}`}>
            {status.label}
          </div>
          <div className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
            {sub.planName ? (
              <>
                <strong>{sub.planName}</strong>
                {sub.period && <span className="text-slate-500 dark:text-slate-400"> · {sub.period}</span>}
                {sub.expiresAt && (
                  <span className="text-slate-500 dark:text-slate-400">
                    {' · expires '}{sub.expiresAt.toISOString().slice(0, 10)}
                  </span>
                )}
                {typeof sub.daysLeft === 'number' && (
                  <span className={`ml-2 text-xs font-semibold ${status.fg}`}>
                    {sub.daysLeft >= 0 ? `${sub.daysLeft} days left` : `${-sub.daysLeft} days overdue`}
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-700 dark:text-slate-300">No active subscription. Upgrade to start using your reports.</span>
            )}
          </div>
        </div>
      </div>
      <Link
        href="/my/upgrade"
        className={`shrink-0 text-sm font-medium px-3 py-1.5 rounded-md ${status.btn}`}
      >
        {sub.planName ? 'Manage / Upgrade' : 'Choose a plan'}
      </Link>
    </div>
  )
}

function pickStatus(sub: TenantSubscription) {
  // Each status carries a light + dark palette. Dark variants are
  // 10–15%-tinted backgrounds with brighter text so the colour-coding
  // still reads against the near-black main bg.
  if (!sub.planName || sub.status === 'none') {
    return {
      label: 'No subscription',
      icon: '⛔',
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/30',
      fg: 'text-red-700 dark:text-red-300',
      btn: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-400',
    }
  }
  const days = sub.daysLeft ?? 999
  if (days < 0) {
    return {
      label: 'Subscription expired (grace period)',
      icon: '⚠️',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      fg: 'text-amber-800 dark:text-amber-300',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-400',
    }
  }
  if (days <= 14) {
    return {
      label: 'Subscription expiring soon',
      icon: '⏳',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      fg: 'text-amber-800 dark:text-amber-300',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-400',
    }
  }
  return {
    label: 'Active subscription',
    icon: '✅',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    fg: 'text-emerald-700 dark:text-emerald-300',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400',
  }
}
