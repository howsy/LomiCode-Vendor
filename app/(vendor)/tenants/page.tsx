import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { generateLicenseKey } from '@/lib/license'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Card, Table, Badge, PrimaryButton, Empty } from '@/components/ui'

async function createTenant(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const tenant = await prisma.tenant.create({
    data: { name, licenseKey: generateLicenseKey() },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: 'tenant.create',
      targetType: 'tenant',
      targetId: tenant.id,
      payloadJson: { name },
    },
  })
  revalidatePath('/tenants')
}

export default async function TenantsPage() {
  await requireVendor()
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscriptions: { orderBy: { expiresAt: 'desc' }, take: 1, include: { plan: true } },
      _count: { select: { devices: true, orders: true } },
    },
  })

  return (
    <>
      <PageHeader
        title="Tenants"
        hint="Each tenant is one restaurant company that owns one or more POS terminals."
      />

      <Card className="mb-6">
        <form action={createTenant} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Restaurant name</label>
            <input
              name="name"
              required
              placeholder="e.g. Downtown Grill"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <PrimaryButton type="submit">+ Create tenant</PrimaryButton>
        </form>
      </Card>

      {tenants.length === 0 ? (
        <Empty>No tenants yet — create the first one above.</Empty>
      ) : (
        <Table>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Devices</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Activation token</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => {
              const sub = t.subscriptions[0]
              return (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={t.status === 'active' ? 'green' : t.status === 'suspended' ? 'amber' : 'red'}>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {sub ? `${sub.plan?.name ?? 'Trial'} · ${sub.period} · until ${sub.expiresAt.toISOString().slice(0, 10)}` : <span className="text-slate-400">no plan</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{t.channel}{t.pinnedVersion ? ` (${t.pinnedVersion})` : ''}</td>
                  <td className="px-4 py-3 text-slate-700">{t._count.devices}</td>
                  <td className="px-4 py-3 text-slate-700">{t._count.orders}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.licenseKey}</td>
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${t.id}`} className="text-accent-600 hover:underline text-sm">Open →</Link>
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
