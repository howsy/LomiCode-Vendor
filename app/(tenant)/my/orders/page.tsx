import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireTenant } from '@/lib/guard'
import { getTenantSubscription } from '@/lib/tenantFeatures'
import { parseRangeFromSearch } from '@/lib/reports'
import { PageHeader, Table, Empty, Card } from '@/components/ui'
import DateRangePicker from '@/components/DateRangePicker'
import CashierFilter from '@/components/CashierFilter'
import Teaser from '@/components/Teaser'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const TEASER_SIZE = 5  // how many rows free-tier sees (blurred)

export default async function TenantOrdersPage({
  searchParams,
}: { searchParams: { from?: string; to?: string; staff?: string; page?: string } }) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!
  const sub = await getTenantSubscription(tenantId)
  const locked = !sub.features.report_account

  const range = parseRangeFromSearch(searchParams)
  const staffId = searchParams.staff?.trim() || undefined
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const where = {
    tenantId,
    createdAt: { gte: range.from, lte: range.to },
    ...(staffId ? { staffId } : {}),
  }

  const take = locked ? TEASER_SIZE : PAGE_SIZE
  const skip = locked ? 0 : (page - 1) * PAGE_SIZE

  const [orders, total, staffList] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { items: {} },
    }),
    prisma.order.count({ where }),
    prisma.staff.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
  ])

  const itemIds = Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.itemId))))
  const items = await prisma.item.findMany({
    where: { tenantId, id: { in: itemIds } },
    select: { id: true, name: true },
  })
  const nameById      = new Map(items.map((i) => [i.id, i.name]))
  const staffNameById = new Map(staffList.map((s) => [s.id, s.name]))
  const totalPages    = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const body = (
    <>
      <Card className="mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <DateRangePicker />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cashier</label>
            <CashierFilter staffList={staffList} current={staffId} />
          </div>
        </div>
      </Card>

      {orders.length === 0 ? (
        <Empty>No orders in this range.</Empty>
      ) : (
        <>
          <Table>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Date / time</th>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const itemSummary = o.items
                  .map((i) => `${nameById.get(i.itemId) ?? '?'} ×${i.quantity}`)
                  .join(', ')
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3">{o.staffId ? (staffNameById.get(o.staffId) ?? '—') : '—'}</td>
                    <td className="px-4 py-3">{o.tableNumber ?? '—'}</td>
                    <td className="px-4 py-3 max-w-md truncate" title={itemSummary}>{itemSummary || '—'}</td>
                    <td className="px-4 py-3 font-medium">{Number(o.total).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{o.status}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={locked ? '/my/upgrade' : `/my/orders/${o.id}`}
                        className="text-accent-600 hover:underline text-sm"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>

          {!locked && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="text-slate-500">Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={pageHref(searchParams, page - 1)} className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-50">
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={pageHref(searchParams, page + 1)} className="border border-slate-300 rounded px-3 py-1 hover:bg-slate-50">
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )

  return (
    <>
      <PageHeader
        title="Orders"
        hint={locked
          ? `Preview of your most recent orders — blurred. Upgrade to browse all ${total}.`
          : `${total} orders in this range. Click any order to see line items.`}
      />

      {locked ? (
        <Teaser
          title="Unlock order history"
          message={`These are your ${TEASER_SIZE} most recent real orders — just blurred. Upgrade to the Professional plan to read every order, drill into line items, and filter by cashier and date.`}
        >
          {body}
        </Teaser>
      ) : body}
    </>
  )
}

function pageHref(sp: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v)
  params.set('page', String(page))
  return `/my/orders?${params.toString()}`
}
