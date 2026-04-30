import { prisma } from '@/lib/db'
import { requireTenant } from '@/lib/guard'
import { PageHeader, Table, Badge, Empty } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function TenantInvoicesPage() {
  const session = await requireTenant()
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: session.user.tenantId! },
    orderBy: { issuedAt: 'desc' },
  })

  return (
    <>
      <PageHeader title="Invoices" hint="Your subscription invoices and payment status." />
      {invoices.length === 0 ? (
        <Empty>No invoices yet.</Empty>
      ) : (
        <Table>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Paid at</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3">{i.issuedAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3 font-medium">{String(i.amount)} {i.currency}</td>
                <td className="px-4 py-3"><Badge tone={i.status === 'paid' ? 'green' : i.status === 'open' ? 'amber' : 'slate'}>{i.status}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{i.paidAt?.toISOString().slice(0, 10) ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{i.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
