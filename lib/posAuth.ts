import { NextRequest } from 'next/server'
import { prisma } from './db'
import { normalizeLicenseKey } from './license'

export type PosAuth =
  | { ok: true; tenant: { id: string; name: string; channel: string; pinnedVersion: string | null; status: string } }
  | { ok: false; status: number; error: string }

/** Verifies the `Authorization: Bearer <license_key>` header and returns the tenant. */
export async function authenticatePos(req: NextRequest): Promise<PosAuth> {
  const auth = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
  if (!m) return { ok: false, status: 401, error: 'missing_bearer_token' }
  const key = normalizeLicenseKey(m[1])
  const tenant = await prisma.tenant.findUnique({ where: { licenseKey: key } })
  if (!tenant) return { ok: false, status: 401, error: 'invalid_license' }
  if (tenant.status === 'cancelled') return { ok: false, status: 403, error: 'tenant_cancelled' }
  if (tenant.status === 'suspended') return { ok: false, status: 403, error: 'tenant_suspended' }
  return {
    ok: true,
    tenant: {
      id: tenant.id, name: tenant.name, channel: tenant.channel,
      pinnedVersion: tenant.pinnedVersion, status: tenant.status,
    },
  }
}
