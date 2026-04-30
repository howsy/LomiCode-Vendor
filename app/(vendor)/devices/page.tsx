import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Table, Badge, Empty } from '@/components/ui'
import { differenceInMinutes } from 'date-fns'

async function toggleDevice(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const deviceId = String(formData.get('deviceId'))
  const d = await prisma.device.findUnique({ where: { id: deviceId } })
  if (!d) return
  await prisma.device.update({ where: { id: deviceId }, data: { isActive: !d.isActive } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: d.isActive ? 'device.disable' : 'device.enable', targetType: 'device', targetId: deviceId },
  })
  revalidatePath('/devices')
}

export default async function DevicesPage() {
  await requireVendor()
  const devices = await prisma.device.findMany({
    orderBy: { lastSeenAt: 'desc' },
    include: { tenant: true },
  })
  const now = new Date()

  return (
    <>
      <PageHeader title="Devices" hint="POS terminals that have activated a license." />
      {devices.length === 0 ? (
        <Empty>No devices yet.</Empty>
      ) : (
        <Table>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Hostname</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">OS</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3">Online</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((d) => {
              const mins = differenceInMinutes(now, d.lastSeenAt)
              const tone = mins <= 10 ? 'green' : mins <= 24 * 60 ? 'amber' : 'red'
              const label = mins <= 10 ? 'online' : mins <= 24 * 60 ? `${Math.round(mins/60)}h ago` : 'offline'
              return (
                <tr key={d.id} className={d.isActive ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${d.tenantId}`} className="text-accent-600 hover:underline">{d.tenant.name}</Link>
                  </td>
                  <td className="px-4 py-3">{d.hostname ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.isActive
                      ? <Badge tone="green">active</Badge>
                      : <Badge tone="red">disabled</Badge>}
                  </td>
                  <td className="px-4 py-3">{d.appVersion ?? '—'}</td>
                  <td className="px-4 py-3">{d.os ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{d.lastSeenAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-4 py-3"><Badge tone={tone}>{label}</Badge></td>
                  <td className="px-4 py-3">
                    <form action={toggleDevice}>
                      <input type="hidden" name="deviceId" value={d.id} />
                      <button type="submit" className="text-xs text-slate-600 hover:underline">
                        {d.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </form>
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
