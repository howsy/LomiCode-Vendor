import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Table, Badge, Empty } from '@/components/ui'
import { differenceInDays } from 'date-fns'
import Link from 'next/link'

// Pivoted view: ONE row per tenant showing only the current subscription
// (active or trial). Click into the tenant to manage history.
//
// The previous version showed every subscription row ever created, which
// quickly became overwhelming once a tenant had a few cancelled rows.
export default async function SubscriptionsPage({ searchParams }: { searchParams: { history?: string } }) {
  await requireVendor()
  const showHistory = searchParams.history === '1'

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: 'asc' },
    include: {
      subscriptions: {
        orderBy: { expiresAt: 'desc' },
        include: { plan: true },
      },
    },
  })

  if (showHistory) {
    return <HistoryView tenants={tenants} />
  }

  // Build per-tenant current state
  const today = new Date()
  type Row = {
    tenant: any
    current: any | null
    historyCount: number
    daysLeft: number | null
  }
  const rows: Row[] = tenants.map((t) => {
    const current =
      t.subscriptions.find((s) => s.status === 'active' || s.status === 'trial') ?? null
    return {
      tenant: t,
      current,
      historyCount: t.subscriptions.filter((s) => s !== current).length,
      daysLeft: current ? differenceInDays(current.expiresAt, today) : null,
    }
  })

  return (
    <>
      <PageHeader
        title="Subscriptions"
        hint="One row per tenant — showing current subscription. Click any tenant to manage."
        actions={
          <Link href="/subscriptions?history=1" className="text-sm text-slate-600 hover:underline">
            See full history →
          </Link>
        }
      />
      {rows.length === 0 ? (
        <Empty>No tenants yet.</Empty>
      ) : (
        <Table>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Current plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Days left</th>
              <th className="px-4 py-3">History</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const tone = r.daysLeft == null ? 'slate' : r.daysLeft < 0 ? 'red' : r.daysLeft < 14 ? 'amber' : 'green'
              return (
                <tr key={r.tenant.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/tenants/${r.tenant.id}`} className="text-accent-600 hover:underline">
                      {r.tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {r.current ? (r.current.plan?.name ?? 'Trial') : <span className="text-slate-400">— no subscription</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.current
                      ? <Badge tone={r.current.status === 'active' ? 'green' : 'amber'}>{r.current.status}</Badge>
                      : <Badge tone="red">none</Badge>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.current?.period ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.current?.expiresAt.toISOString().slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.daysLeft == null ? '—' : (
                      <Badge tone={tone}>
                        {r.daysLeft >= 0 ? `${r.daysLeft} days` : `${-r.daysLeft} days overdue`}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {r.historyCount > 0 ? `${r.historyCount} previous` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${r.tenant.id}`} className="text-accent-600 hover:underline text-sm">
                      Manage →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </>
  )
}

// Old-school full history view (toggleable via ?history=1).
function HistoryView({ tenants }: { tenants: any[] }) {
  const flat = tenants.flatMap((t) =>
    t.subscriptions.map((s: any) => ({ ...s, tenantName: t.name, tenantId: t.id }))
  )
  flat.sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())

  return (
    <>
      <PageHeader
        title="Subscriptions — full history"
        hint="Every subscription ever created across all tenants."
        actions={<Link href="/subscriptions" className="text-sm text-slate-600 hover:underline">← Back to current state</Link>}
      />
      {flat.length === 0 ? (
        <Empty>No subscriptions yet.</Empty>
      ) : (
        <Table>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flat.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <Link href={`/tenants/${s.tenantId}`} className="text-accent-600 hover:underline">{s.tenantName}</Link>
                </td>
                <td className="px-4 py-3">{s.plan?.name ?? 'Trial'}</td>
                <td className="px-4 py-3">{s.period}</td>
                <td className="px-4 py-3"><Badge tone={s.status === 'active' || s.status === 'trial' ? 'green' : 'slate'}>{s.status}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{s.startedAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3 text-slate-500">{s.expiresAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
