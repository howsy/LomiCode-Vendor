import { requireSession } from '@/lib/guard'
import DashboardShell from '@/components/DashboardShell'
import { isVendorRole } from '@/lib/auth'
import type { ReactNode } from 'react'

// Tiny route group used for /account, /setup-2fa, /account/force-password-change.
// Outside both (vendor) and (tenant) groups so any authenticated user can
// reach it. Nav points back to wherever they came from + a sign-out option.
const VENDOR_NAV = [
  { href: '/account',  label: 'Account',  icon: '👤' },
  { href: '/tenants',  label: 'Tenants',  icon: '🏪' },
]
const TENANT_NAV = [
  { href: '/account',     label: 'Account',  icon: '👤' },
  { href: '/my/overview', label: 'Overview', icon: '🏠' },
]

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // requireSession checks mustEnrollTotp / mustChangePassword and redirects
  // — but the children pages (setup-2fa, force-password-change) opt out
  // by using requireSessionBypassGate. The /account page itself stays
  // gated by requireSession so only verified users edit profile/password.
  const session = await requireSession()
  const nav = isVendorRole(session.user.role) ? VENDOR_NAV : TENANT_NAV

  return (
    <DashboardShell
      title="LomiCode"
      user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
      nav={nav}
    >
      {children}
    </DashboardShell>
  )
}
