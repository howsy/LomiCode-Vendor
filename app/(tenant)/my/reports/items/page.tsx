import Link from 'next/link'
import { requireTenant } from '@/lib/guard'
import { getTenantSubscription } from '@/lib/tenantFeatures'
import { parseRangeFromSearch, topItems } from '@/lib/reports'
import { PageHeader, Card } from '@/components/ui'
import DateRangePicker from '@/components/DateRangePicker'
import Teaser from '@/components/Teaser'

export const dynamic = 'force-dynamic'

export default async function ItemsReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!
  const sub = await getTenantSubscription(tenantId)
  const locked = !sub.features.report_account

  const range = parseRangeFromSearch(searchParams)
  // Locked users get a small teaser sample (top 5); paid users get top 50
  const items = await topItems(tenantId, range, locked ? 5 : 50)

  const totalQty = items.reduce((s, i) => s + i.qty, 0)
  const totalRev = items.reduce((s, i) => s + i.revenue, 0)

  const csvHref = `/api/v1/tenant/reports/items.csv?from=${range.from.toISOString()}&to=${range.to.toISOString()}`

  const body = (
    <>
      <Card className="mb-6"><DateRangePicker /></Card>

      <Card>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">No orders in this range.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2">#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td className="py-2 text-slate-400">{idx + 1}</td>
                  <td className="font-medium">{it.name}</td>
                  <td>{it.qty}</td>
                  <td>{it.revenue.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-slate-50 dark:bg-white/[0.04] dark:text-white">
                <td colSpan={2} className="py-2">TOTAL</td>
                <td>{totalQty}</td>
                <td>{totalRev.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </>
  )

  return (
    <>
      <PageHeader
        title="Top items"
        hint={locked
          ? 'Preview of your real top sellers — blurred. Upgrade to read them.'
          : 'Best-selling menu items in this range.'}
        actions={!locked && (
          <Link href={csvHref} className="text-sm text-accent-600 hover:underline">Export CSV ↓</Link>
        )}
      />

      {locked ? (
        <Teaser
          title="Unlock your top items"
          message="These are your real top 5 items in this range — just blurred. Upgrade to see all 50, sort, and export."
        >
          {body}
        </Teaser>
      ) : body}
    </>
  )
}
