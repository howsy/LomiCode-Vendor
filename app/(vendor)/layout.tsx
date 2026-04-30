import { requireVendor } from '@/lib/guard'
import DashboardShell from '@/components/DashboardShell'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/tenants',       label: 'Tenants',       icon: '🏪' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '🧾' },
  { href: '/invoices',      label: 'Invoices',      icon: '💵' },
  { href: '/devices',       label: 'Devices',       icon: '🖥️' },
  { href: '/plans',         label: 'Plans',         icon: '🏷️' },
  { href: '/products',      label: 'Products',      icon: '📦' },
  { href: '/releases',      label: 'Releases',      icon: '🚀' },
  { href: '/activity',      label: 'Activity',      icon: '📡' },
  { href: '/sync-errors',   label: 'Sync errors',   icon: '⚠️' },
  { href: '/admins',        label: 'Admins',        icon: '👥' },
  { href: '/settings',      label: 'Settings',      icon: '⚙️' },
  { href: '/account',       label: 'Account',       icon: '👤' },
]

export default async function VendorLayout({ children }: { children: ReactNode }) {
  const session = await requireVendor()
  return (
    <DashboardShell
      title="Vendor Admin"
      user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
      nav={NAV}
    >
      {children}
    </DashboardShell>
  )
}
