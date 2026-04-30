import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireTenant } from '@/lib/guard'
import { PageHeader, Card, Badge } from '@/components/ui'

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!

  const order = await prisma.order.findFirst({
    where: { id: params.id, tenantId },
    include: { items: true },
  })
  if (!order) notFound()

  const itemIds = order.items.map((i) => i.itemId)
  const items = await prisma.item.findMany({
    where: { tenantId, id: { in: itemIds } },
    select: { id: true, name: true, nameAr: true, nameKu: true },
  })
  const itemById = new Map(items.map((i) => [i.id, i]))

  const staff = order.staffId
    ? await prisma.staff.findUnique({ where: { id: order.staffId }, select: { name: true } })
    : null

  const subtotal = order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)

  return (
    <>
      <PageHeader
        title={`Order ${order.id.slice(0, 8)}`}
        hint={order.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
        actions={<Link href="/my/orders" className="text-sm text-slate-600 hover:underline">← All orders</Link>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500">Cashier</div>
          <div className="font-semibold mt-1">{staff?.name ?? '—'}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500">Table</div>
          <div className="font-semibold mt-1">{order.tableNumber ?? '—'}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500">Type</div>
          <div className="font-semibold mt-1">{order.orderType}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500">Status</div>
          <div className="mt-1"><Badge tone={order.status === 'paid' ? 'green' : 'amber'}>{order.status}</Badge></div>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold mb-3">Line items</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2">Item</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Line total</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((li) => {
              const it = itemById.get(li.itemId)
              const lineTotal = Number(li.unitPrice) * li.quantity
              return (
                <tr key={li.id}>
                  <td className="py-2">
                    <div className="font-medium">{it?.name ?? `[deleted item ${li.itemId.slice(0,8)}]`}</div>
                    {(it?.nameAr || it?.nameKu) && (
                      <div className="text-xs text-slate-500" dir="rtl">
                        {it?.nameAr}{it?.nameAr && it?.nameKu ? ' / ' : ''}{it?.nameKu}
                      </div>
                    )}
                  </td>
                  <td>{li.quantity}</td>
                  <td>{Number(li.unitPrice).toLocaleString()}</td>
                  <td className="font-medium">{lineTotal.toLocaleString()}</td>
                  <td className="text-slate-500 text-xs">{li.notes ?? '—'}</td>
                </tr>
              )
            })}
            <tr className="font-semibold bg-slate-50 dark:bg-white/[0.04] dark:text-white">
              <td colSpan={3} className="py-2 text-right">Subtotal</td>
              <td>{subtotal.toLocaleString()}</td>
              <td></td>
            </tr>
            <tr className="font-semibold bg-slate-50 dark:bg-white/[0.04] dark:text-white border-t-2 border-slate-200 dark:border-white/[0.1]">
              <td colSpan={3} className="py-2 text-right">Order total</td>
              <td className="text-accent-600">{Number(order.total).toLocaleString()}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </Card>

      {order.notes && (
        <Card>
          <h3 className="font-semibold mb-2">Order notes</h3>
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{order.notes}</div>
        </Card>
      )}
    </>
  )
}
