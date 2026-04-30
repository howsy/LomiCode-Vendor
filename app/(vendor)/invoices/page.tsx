import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Table, Badge, Empty, PrimaryButton } from '@/components/ui'

async function markPaid(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const id = String(formData.get('id'))
  const inv = await prisma.invoice.update({
    where: { id },
    data: { status: 'paid', paidAt: new Date(), paidByUserId: session.user.id },
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'invoice.mark_paid', targetType: 'invoice', targetId: inv.id, payloadJson: { amount: inv.amount } },
  })
  revalidatePath('/invoices')
}

export default async function InvoicesPage() {
  await requireVendor()
  const invoices = await prisma.invoice.findMany({
    orderBy: { issuedAt: 'desc' },
    include: { tenant: true },
  })

  return (
    <>
      <PageHeader title="Invoices" hint="Mark invoices paid as you receive payment (cash, bank transfer, etc.)." />
      {invoices.length === 0 ? (
        <Empty>No invoices yet.</Empty>
      ) : (
        <Table>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Paid at</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3">
                  <Link href={`/tenants/${i.tenantId}`} className="text-accent-600 hover:underline">{i.tenant.name}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{i.issuedAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3 font-medium">{String(i.amount)} {i.currency}</td>
                <td className="px-4 py-3"><Badge tone={i.status === 'paid' ? 'green' : i.status === 'open' ? 'amber' : 'slate'}>{i.status}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{i.paidAt?.toISOString().slice(0, 10) ?? '—'}</td>
                <td className="px-4 py-3">
                  {i.status === 'open' && (
                    <form action={markPaid}>
                      <input type="hidden" name="id" value={i.id} />
                      <PrimaryButton type="submit">Mark paid</PrimaryButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
