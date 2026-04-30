import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Empty, Card } from '@/components/ui'

export default async function ActivityPage() {
  await requireVendor()
  const events = await prisma.event.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { tenant: true, device: true },
  })

  return (
    <>
      <PageHeader title="Activity" hint="Latest events across all tenants — sync, version installs, subscription warnings." />
      {events.length === 0 ? (
        <Empty>No events yet. The feed populates as POS terminals connect.</Empty>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-mono text-xs text-slate-500 mr-3">{e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</span>
                  <span className="font-medium text-slate-700">{e.type}</span>
                  {e.tenant && (
                    <Link href={`/tenants/${e.tenantId}`} className="ml-3 text-accent-600 hover:underline">{e.tenant.name}</Link>
                  )}
                  {e.device?.hostname && <span className="ml-2 text-slate-500">@ {e.device.hostname}</span>}
                </div>
                {e.payloadJson != null && (
                  <code className="text-[11px] text-slate-500 max-w-md truncate">{JSON.stringify(e.payloadJson)}</code>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
