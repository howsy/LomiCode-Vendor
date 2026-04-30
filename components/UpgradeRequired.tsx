import Link from 'next/link'
import { Card } from '@/components/ui'

// Shown in place of gated content when the tenant's plan doesn't include
// the required feature. Keep it friendly — not a hard error.
export default function UpgradeRequired({
  feature,
  message,
}: {
  feature: string
  message?: string
}) {
  return (
    <Card className="border-amber-200 bg-amber-50 max-w-xl mx-auto mt-8 text-center py-10
                     dark:!bg-amber-500/10 dark:!border-amber-500/30">
      <div className="text-4xl mb-4">⭐</div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Upgrade required</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300 mb-6">
        {message ??
          `This feature (${feature}) isn't included in your current plan. Upgrade to unlock it.`}
      </p>
      <Link
        href="/my/upgrade"
        className="inline-block bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-5 py-2.5 rounded-md
                   dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950"
      >
        View plans &amp; upgrade →
      </Link>
    </Card>
  )
}
