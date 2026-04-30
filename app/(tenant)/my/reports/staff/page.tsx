import Link from 'next/link'
import { requireTenant } from '@/lib/guard'
import { getTenantSubscription } from '@/lib/tenantFeatures'
import { parseRangeFromSearch, staffBreakdown } from '@/lib/reports'
import { PageHeader, Card } from '@/components/ui'
import DateRangePicker from '@/components/DateRangePicker'
import Teaser from '@/components/Teaser'

export const dynamic = 'force-dynamic'

export default async function StaffReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!
  const sub = await getTenantSubscription(tenantId)
  const locked = !sub.features.report_account

  const range = parseRangeFromSearch(searchParams)
  const rowsAll = await staffBreakdown(tenantId, range)
  // Locked users get the top 3 rows so the table looks real but doesn't
  // give away the full picture
  const rows = locked ? rowsAll.slice(0, 3) : rowsAll

  const totalOrders = rows.reduce((s, r) => s + r.orders, 0)
  const totalRev    = rows.reduce((s, r) => s + r.revenue, 0)

  const csvHref = `/api/v1/tenant/reports/staff.csv?from=${range.from.toISOString()}&to=${range.to.toISOString()}`

  const body = (
    <>
      <Card className="mb-6"><DateRangePicker /></Card>

      <Card>
        {rows.length === 0 ? (
          <div className="text-sm text-slate-500">No staff have synced yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2">Cashier</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Avg ticket</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const params = new URLSearchParams()
                if (searchParams.from) params.set('from', searchParams.from)
                if (searchParams.to)   params.set('to', searchParams.to)
                params.set('staff', r.id)
                return (
                  <tr key={r.id}>
                    <td className="py-2 font-medium">{r.name}</td>
                    <td>{r.orders}</td>
                    <td>{r.revenue.toLocaleString()}</td>
                    <td>{r.avg.toFixed(0)}</td>
                    <td>
                      <Link
                        href={locked ? '/my/upgrade' : `/my/orders?${params.toString()}`}
                        className="text-accent-600 hover:underline text-sm"
                      >
                        See orders →
                      </Link>
                    </td>
                  </tr>
                )
              })}
              <tr className="font-semibold bg-slate-50 dark:bg-white/[0.04] dark:text-white">
                <td className="py-2">TOTAL</td>
                <td>{totalOrders}</td>
                <td>{totalRev.toLocaleString()}</td>
                <td>—</td>
                <td></td>
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
        title="Per cashier"
        hint={locked
          ? 'Preview of your real cashier performance — blurred. Upgrade to read it.'
          : 'Orders and revenue by staff member.'}
        actions={!locked && (
          <Link href={csvHref} className="text-sm text-accent-600 hover:underline">Export CSV ↓</Link>
        )}
      />

      {locked ? (
        <Teaser
          title="Unlock cashier performance"
          message="These are your real top 3 cashiers in this range — just blurred. Upgrade to see every cashier, drill into their orders, and export."
        >
          {body}
        </Teaser>
      ) : body}
    </>
  )
}
