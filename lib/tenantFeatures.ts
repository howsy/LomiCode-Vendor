// Single source of truth for "what does the current subscription let this
// tenant do?". Pages read from this; the heartbeat broadcasts the same
// shape to the POS.

import { prisma } from './db'

export type TenantFeatures = {
  pos: boolean
  qr_menu: boolean
  report_account: boolean
  max_devices: number
  max_tenant_users: number
}

export type TenantSubscription = {
  features: TenantFeatures
  planName: string | null
  status: string                  // 'active' | 'trial' | 'none'
  period: string | null
  expiresAt: Date | null
  daysLeft: number | null
  subId: string | null
}

const NONE: TenantFeatures = {
  pos: false,
  qr_menu: false,
  report_account: false,
  max_devices: 0,
  max_tenant_users: 0,
}

export async function getTenantSubscription(tenantId: string): Promise<TenantSubscription> {
  const sub = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: ['active', 'trial'] } },
    orderBy: { expiresAt: 'desc' },
    include: { plan: true },
  })
  if (!sub) {
    return { features: NONE, planName: null, status: 'none', period: null, expiresAt: null, daysLeft: null, subId: null }
  }
  const features: TenantFeatures = {
    pos: true,
    qr_menu: false,
    report_account: false,
    max_devices: 1,
    max_tenant_users: 0,
    ...((sub.plan?.featuresJson as any) ?? {}),
  }
  const daysLeft = Math.ceil((sub.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  return {
    features,
    planName: sub.plan?.name ?? 'Trial',
    status: sub.status,
    period: sub.period,
    expiresAt: sub.expiresAt,
    daysLeft,
    subId: sub.id,
  }
}
