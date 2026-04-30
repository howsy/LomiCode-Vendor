import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Card, Empty, PrimaryButton, Badge } from '@/components/ui'

// One row per sync.row_failed event. Operator can see exactly which row
// the applier rejected, why, and clear the list once the underlying issue
// is resolved (or the row is irrelevant).

async function clearAll() {
  'use server'
  const session = await requireVendor()
  await prisma.event.deleteMany({ where: { type: 'sync.row_failed' } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'sync_errors.clear' },
  })
  revalidatePath('/sync-errors')
}

export default async function SyncErrorsPage() {
  await requireVendor()
  const events = await prisma.event.findMany({
    where: { type: 'sync.row_failed' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { tenant: { select: { id: true, name: true } } },
  })

  return (
    <>
      <PageHeader
        title="Sync errors"
        hint="Rows the POS pushed that the applier could not write into the mirror tables. Each row was skipped — the cursor advanced past it so good rows after it still got applied."
        actions={events.length > 0 && (
          <form action={clearAll}>
            <PrimaryButton type="submit">Clear all</PrimaryButton>
          </form>
        )}
      />

      {events.length === 0 ? (
        <Empty>No sync errors recorded.</Empty>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Op</th>
                <th className="px-4 py-3">change_log id</th>
                <th className="px-4 py-3">Row id</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((e) => {
                const p: any = e.payloadJson ?? {}
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      {e.tenant ? (
                        <Link href={`/tenants/${e.tenant.id}`} className="text-accent-600 hover:underline">
                          {e.tenant.name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.table ?? '—'}</td>
                    <td className="px-4 py-3"><Badge tone="slate">{p.op ?? '—'}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs">#{p.changeLogId ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {p.rowId ? String(p.rowId).slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-3 text-red-700 max-w-md truncate" title={p.error}>
                      {p.error ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
