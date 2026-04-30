import Link from 'next/link'
import { requireTenant } from '@/lib/guard'
import { prisma } from '@/lib/db'
import { getTenantSubscription } from '@/lib/tenantFeatures'
import { tenantSummary, defaultRange, revenueByDay, topItems } from '@/lib/reports'
import { PageHeader, StatCard, Card } from '@/components/ui'
import SalesChart from '@/components/SalesChart'
import MenuQR from '@/components/MenuQR'
import Teaser from '@/components/Teaser'

export const dynamic = 'force-dynamic'

export default async function TenantOverview({
  searchParams,
}: {
  searchParams: { upgraded?: string }
}) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!

  const [sub, tenant] = await Promise.all([
    getTenantSubscription(tenantId),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, publicSlug: true, publicMenuEnabled: true, brandColor: true },
    }),
  ])

  const reportsLocked = !sub.features.report_account
  const qrLocked      = !sub.features.qr_menu

  // Always fetch — locked users see it blurred. Trim to a teaser sample so
  // we don't waste DB time on numbers they can't read.
  const range = defaultRange()
  const [summary, byDayFull, itemsFull] = await Promise.all([
    tenantSummary(tenantId, range),
    revenueByDay(tenantId, range),
    topItems(tenantId, range, 5),
  ])
  const byDay = reportsLocked ? byDayFull.slice(-5) : byDayFull
  const items = reportsLocked ? itemsFull.slice(0, 3) : itemsFull

  const reportsBody = (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Revenue" value={summary.revenue.toLocaleString()} />
        <StatCard label="Orders"  value={summary.orders} />
        <StatCard label="Avg ticket" value={summary.avgTicket.toFixed(0)} />
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold mb-3">Revenue by day</h2>
        <SalesChart data={byDay} />
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Top 5 items</h2>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">No orders in this range yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2">Item</th><th>Qty</th><th>Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 font-medium">{i.name}</td>
                  <td>{i.qty}</td>
                  <td>{i.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )

  // Public menu / QR — also teased when qr_menu isn't included
  const menuBody = tenant?.publicSlug && tenant.publicMenuEnabled ? (
    <Card>
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <h2 className="font-semibold text-slate-900 mb-1">Your public menu</h2>
          <p className="text-sm text-slate-600 mb-3">
            Customers scan this QR to see your live menu. Items added or disabled in
            the POS appear here within a minute.
          </p>
          <Link
            href={qrLocked ? '/my/upgrade' : `/menu/${tenant.publicSlug}`}
            target="_blank"
            className="font-mono text-sm text-accent-600 hover:underline"
          >
            /menu/{tenant.publicSlug}
          </Link>
          <div className="mt-4 flex gap-3">
            <Link
              href={qrLocked ? '/my/upgrade' : `/menu/${tenant.publicSlug}`}
              target={qrLocked ? undefined : '_blank'}
              className="text-sm border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50"
            >
              Open menu →
            </Link>
            <Link
              href={qrLocked ? '/my/upgrade' : `/my/menu-print?slug=${tenant.publicSlug}`}
              target={qrLocked ? undefined : '_blank'}
              className="text-sm bg-accent-600 hover:bg-accent-700 text-white rounded-md px-3 py-2"
            >
              Print QR
            </Link>
          </div>
        </div>
        <MenuQR slug={tenant.publicSlug} brandColor={tenant.brandColor ?? '#0f766e'} size={180} />
      </div>
    </Card>
  ) : (
    <Card className="border-slate-200 bg-slate-50 dark:!bg-white/[0.03] dark:!border-white/[0.08]">
      <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Public menu</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        Your public menu isn't set up yet. Ask the vendor to enable it from the admin panel.
      </p>
    </Card>
  )

  return (
    <>
      <PageHeader title="Overview" hint="Last 30 days." />

      {searchParams.upgraded && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium
                        dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
          ✅ Plan upgraded successfully! Enjoy your new features.
        </div>
      )}

      {/* QR / public menu — teased when qr_menu feature is off */}
      <div className="mb-6">
        {qrLocked ? (
          <Teaser
            title="Unlock your public menu"
            message="Generate a QR code for diners to scan, share your menu online, and update items live from the POS. Available on the Professional plan and above."
            blurPx={4}
          >
            {menuBody}
          </Teaser>
        ) : menuBody}
      </div>

      {/* Reports — teased when report_account feature is off */}
      {reportsLocked ? (
        <Teaser
          title="Unlock your reports"
          message="These are your real numbers from the last 30 days — just blurred. Upgrade to read revenue, top items and per-cashier breakdowns, with CSV export."
        >
          {reportsBody}
        </Teaser>
      ) : reportsBody}
    </>
  )
}
