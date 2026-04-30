import Link from 'next/link'
import { requireTenant } from '@/lib/guard'
import { getTenantSubscription } from '@/lib/tenantFeatures'
import { parseRangeFromSearch, revenueByDay, tenantSummary } from '@/lib/reports'
import { PageHeader, Card, StatCard } from '@/components/ui'
import SalesChart from '@/components/SalesChart'
import DateRangePicker from '@/components/DateRangePicker'
import Teaser from '@/components/Teaser'

export const dynamic = 'force-dynamic'

export default async function SalesPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!
  const sub = await getTenantSubscription(tenantId)
  const locked = !sub.features.report_account

  const range = parseRangeFromSearch(searchParams)

  // Always fetch real data — locked users see it blurred. We trim to a small
  // teaser sample so we don't waste DB time on a query they can't read.
  const [summary, byDayFull] = await Promise.all([
    tenantSummary(tenantId, range),
    revenueByDay(tenantId, range),
  ])
  const byDay = locked ? byDayFull.slice(-5) : byDayFull

  const csvHref = `/api/v1/tenant/reports/sales.csv?from=${range.from.toISOString()}&to=${range.to.toISOString()}`

  const body = (
    <>
      <Card className="mb-6"><DateRangePicker /></Card>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Revenue" value={summary.revenue.toLocaleString()} />
        <StatCard label="Orders" value={summary.orders} />
        <StatCard label="Avg ticket" value={summary.avgTicket.toFixed(0)} />
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold mb-3">Revenue by day</h2>
        {byDay.length === 0
          ? <div className="text-sm text-slate-500">No data in this range.</div>
          : <SalesChart data={byDay} />}
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Daily breakdown</h2>
        {byDay.length === 0 ? (
          <div className="text-sm text-slate-500">No orders.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2">Day</th><th>Orders</th><th>Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byDay.map((d) => (
                <tr key={d.day}>
                  <td className="py-2">{d.day}</td>
                  <td>{d.orders}</td>
                  <td>{d.revenue.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-slate-50 dark:bg-white/[0.04] dark:text-white">
                <td className="py-2">TOTAL</td>
                <td>{byDay.reduce((s, d) => s + d.orders, 0)}</td>
                <td>{byDay.reduce((s, d) => s + d.revenue, 0).toLocaleString()}</td>
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
        title="Sales report"
        hint={locked
          ? 'Preview of your real revenue — blurred. Upgrade to read it.'
          : 'Revenue and orders by day.'}
        actions={!locked && (
          <Link href={csvHref} className="text-sm text-accent-600 hover:underline">Export CSV ↓</Link>
        )}
      />

      {locked ? (
        <Teaser
          title="Unlock your sales report"
          message="These are your real last-5 days of revenue and orders — just blurred. Upgrade to the Professional plan to read, sort and export them."
        >
          {body}
        </Teaser>
      ) : body}
    </>
  )
}
