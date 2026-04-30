import { requireTenant } from '@/lib/guard'
import DashboardShell from '@/components/DashboardShell'
import TenantSubscriptionBanner from '@/components/TenantSubscriptionBanner'
import { getTenantSubscription } from '@/lib/tenantFeatures'
import { prisma } from '@/lib/db'
import type { ReactNode } from 'react'

// Every tenant sees the same nav regardless of plan. Locked pages render a
// blurred teaser of real data with an upgrade CTA — the visibility of the
// entry is the whole pitch. We still need getTenantSubscription here for the
// always-visible status banner at the top of every /my/* page.
const NAV = [
  { href: '/my/overview',       label: 'Overview',     icon: '🏠' },
  { href: '/my/orders',         label: 'Orders',       icon: '📋' },
  { href: '/my/reports/sales',  label: 'Sales',        icon: '📈' },
  { href: '/my/reports/items',  label: 'Top items',    icon: '🍔' },
  { href: '/my/reports/staff',  label: 'Per cashier',  icon: '👤' },
  { href: '/my/invoices',       label: 'Invoices',     icon: '💵' },
  { href: '/my/upgrade',        label: 'Upgrade',      icon: '⭐' },
  { href: '/account',           label: 'Account',      icon: '👤' },
]

export default async function TenantLayout({ children }: { children: ReactNode }) {
  const session = await requireTenant()
  const tenantId = session.user.tenantId!
  const [sub, tenant] = await Promise.all([
    getTenantSubscription(tenantId),
    // Branding for the sidebar — uploaded by the POS admin from Restaurant
    // Settings. Optional; falls back to a generated initial chip when null.
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true, brandColor: true },
    }),
  ])

  return (
    <DashboardShell
      title="Restaurant"
      user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
      nav={NAV}
      brand={{
        name: tenant?.name ?? null,
        logoUrl: tenant?.logoUrl ?? null,
        brandColor: tenant?.brandColor ?? null,
      }}
    >
      <TenantSubscriptionBanner sub={sub} />
      {children}
    </DashboardShell>
  )
}
