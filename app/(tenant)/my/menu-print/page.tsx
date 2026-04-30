import { requireTenant } from '@/lib/guard'
import { prisma } from '@/lib/db'
import MenuQR from '@/components/MenuQR'
import PrintNow from './PrintNow'

export const dynamic = 'force-dynamic'

export default async function MenuPrintPage({
  searchParams,
}: { searchParams: { slug?: string } }) {
  const session = await requireTenant()
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId! },
    select: { name: true, publicSlug: true, brandColor: true, tagline: true },
  })
  if (!tenant?.publicSlug) {
    return <div style={{ padding: 40, fontFamily: 'system-ui' }}>No public menu configured.</div>
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      padding: 40, background: '#fff', color: '#1a1a1a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <PrintNow />
      <div style={{
        textAlign: 'center', padding: 40, maxWidth: 480,
        border: '2px dashed #cbd5e1', borderRadius: 16,
      }}>
        <div style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: tenant.brandColor ?? '#0f766e', fontWeight: 700 }}>
          Scan to view our menu
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: '12px 0 4px', letterSpacing: '-0.02em' }}>
          {tenant.name}
        </h1>
        {tenant.tagline && (
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>{tenant.tagline}</p>
        )}
        <div style={{ marginTop: 24 }}>
          <MenuQR slug={tenant.publicSlug} brandColor={tenant.brandColor ?? '#0f766e'} size={300} />
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8', letterSpacing: 0.5 }}>
          Powered by LomiCode
        </div>
      </div>
    </div>
  )
}
