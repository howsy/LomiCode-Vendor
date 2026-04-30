import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import type { UserRole } from '@prisma/client'
import { verifyTotp } from './totp'
import { consumeRecoveryCode, looksLikeRecoveryCode } from './recoveryCodes'

declare module 'next-auth' {
  interface User {
    id: string
    role: UserRole
    tenantId: string | null
    name: string
    email: string
    mustEnrollTotp?: boolean
    mustChangePassword?: boolean
  }
  interface Session {
    user: {
      id: string
      role: UserRole
      tenantId: string | null
      name: string
      email: string
      mustEnrollTotp: boolean
      mustChangePassword: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    tenantId: string | null
    mustEnrollTotp: boolean
    mustChangePassword: boolean
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
        // 6-digit TOTP code OR a XXXX-XXXX-XX recovery code. Empty when
        // the user doesn't have 2FA enabled.
        totp:     { label: 'Code',     type: 'text'  },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null
        const user = await prisma.user.findUnique({ where: { email: creds.email.toLowerCase() } })
        if (!user) return null
        if (!user.isActive) return null  // disabled by vendor
        const ok = await bcrypt.compare(creds.password, user.passwordHash)
        if (!ok) return null

        // 2FA gate — only when the user has actually finished enrollment.
        // `totpRequired && !totpEnabled` is the "must enroll" path: we let
        // them in with the mustEnrollTotp flag so the layout redirects
        // them straight to /setup-2fa and nowhere else.
        if (user.totpEnabled) {
          const code = (creds.totp ?? '').trim()
          if (!code) return null
          if (looksLikeRecoveryCode(code)) {
            const stored = (user.totpRecoveryCodes as string[] | null) ?? []
            const r = await consumeRecoveryCode(stored, code)
            if (!r.ok) return null
            // Persist the remaining codes so the consumed one can't be reused.
            await prisma.user.update({
              where: { id: user.id },
              data: { totpRecoveryCodes: r.remaining as any },
            })
          } else {
            if (!user.totpSecret) return null
            if (!verifyTotp(user.totpSecret, code)) return null
          }
        }

        // For tenant users, also reject if their tenant has been suspended/cancelled
        if (user.tenantId) {
          const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })
          if (!tenant || tenant.status !== 'active') return null
        }

        return {
          id: user.id,
          role: user.role,
          tenantId: user.tenantId,
          name: user.name,
          email: user.email,
          mustEnrollTotp: user.totpRequired && !user.totpEnabled,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
        token.tenantId = user.tenantId
        token.mustEnrollTotp = !!user.mustEnrollTotp
        token.mustChangePassword = !!user.mustChangePassword
      }
      // Re-fetch fresh state when the user clears the gate (enrolls 2FA
      // or changes their password). The /account actions call
      // `getServerSession()` then trigger `update()` from the client.
      if (trigger === 'update' && token.sub) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { totpRequired: true, totpEnabled: true, mustChangePassword: true, role: true },
        })
        if (fresh) {
          token.role = fresh.role
          token.mustEnrollTotp = fresh.totpRequired && !fresh.totpEnabled
          token.mustChangePassword = fresh.mustChangePassword
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.tenantId = token.tenantId
        session.user.mustEnrollTotp = token.mustEnrollTotp ?? false
        session.user.mustChangePassword = token.mustChangePassword ?? false
      }
      return session
    },
  },
}

export function isVendorRole(role: UserRole) {
  return role === 'vendor_admin' || role === 'vendor_support' || role === 'vendor_super'
}

export function isVendorSuper(role: UserRole) {
  return role === 'vendor_super'
}

export function isTenantRole(role: UserRole) {
  return role === 'tenant_owner' || role === 'tenant_staff'
}
