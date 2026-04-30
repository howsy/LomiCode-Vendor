import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions, isVendorRole, isVendorSuper, isTenantRole } from './auth'

// Pages where the redirect-guard is bypassed. Without this list, a user
// with mustChangePassword set would land on /account/force-password-change,
// the layout would re-trigger the guard, and we'd loop forever.
const ENROLL_PATHS = new Set<string>([
  '/setup-2fa',
  '/account/force-password-change',
])

// Internal: the redirect logic that every requireXxx() helper shares.
// `currentPath` is optional — caller passes it to skip the redirect when
// already on the target page.
function gateOrRedirect(session: Session | null, currentPath?: string) {
  if (!session?.user) redirect('/login')
  if (currentPath && ENROLL_PATHS.has(currentPath)) return
  if (session.user.mustChangePassword) redirect('/account/force-password-change')
  if (session.user.mustEnrollTotp)     redirect('/setup-2fa')
}

export async function requireSession(currentPath?: string) {
  const session = await getServerSession(authOptions) as Session | null
  gateOrRedirect(session, currentPath)
  return session!
}

export async function requireVendor(currentPath?: string) {
  const session = await requireSession(currentPath)
  if (!isVendorRole(session.user.role)) redirect('/my/overview')
  return session
}

export async function requireVendorSuper(currentPath?: string) {
  const session = await requireVendor(currentPath)
  if (!isVendorSuper(session.user.role)) redirect('/tenants')
  return session
}

export async function requireTenant(currentPath?: string) {
  const session = await requireSession(currentPath)
  if (!isTenantRole(session.user.role) || !session.user.tenantId) {
    redirect('/tenants')
  }
  return session
}

// Used by /setup-2fa and /account/force-password-change layouts. They want
// "logged in, but skip the gate that would normally redirect ME away".
export async function requireSessionBypassGate() {
  const session = await getServerSession(authOptions) as Session | null
  if (!session?.user) redirect('/login')
  return session
}
