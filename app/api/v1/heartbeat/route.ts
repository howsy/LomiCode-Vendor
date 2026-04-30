import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticatePos } from '@/lib/posAuth'
import { addDays, differenceInDays } from 'date-fns'

const Body = z.object({
  device_uuid: z.string().uuid(),
  hardware_fingerprint: z.string().min(8).max(200).optional(),
  app_version: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await authenticatePos(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const device = await prisma.device.findUnique({ where: { deviceUuid: parsed.data.device_uuid } })
  if (!device) return NextResponse.json({ error: 'device_not_found' }, { status: 404 })
  if (!device.isActive) return NextResponse.json({ error: 'device_disabled' }, { status: 403 })

  const sentFp = parsed.data.hardware_fingerprint?.trim() ?? null

  // Hardware-binding check: if we have a stored fingerprint, the heartbeat
  // must come from the same machine. Otherwise the SQLite file has been
  // copied — refuse to phone home.
  if (device.hardwareFingerprint && sentFp) {
    if (device.hardwareFingerprint !== sentFp) {
      return NextResponse.json({ error: 'hardware_mismatch' }, { status: 409 })
    }
  }

  // Auto re-bind: if vendor cleared the lock, the next heartbeat re-binds
  // to whatever hardware is now talking to us.
  await prisma.device.update({
    where: { deviceUuid: parsed.data.device_uuid },
    data: {
      lastSeenAt: new Date(),
      appVersion: parsed.data.app_version,
      ...(device.hardwareFingerprint == null && sentFp ? { hardwareFingerprint: sentFp } : {}),
    },
  })

  // Latest non-cancelled subscription (covers active + trial), with plan
  // so we can return its feature flags.
  const sub = await prisma.subscription.findFirst({
    where: { tenantId: auth.tenant.id, status: { in: ['active', 'trial'] } },
    orderBy: { expiresAt: 'desc' },
    include: { plan: true },
  })

  const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS ?? '7', 10)
  const graceUntil = sub ? addDays(sub.expiresAt, graceDays) : null
  const now = new Date()

  let mode: 'ok' | 'warn_expiring' | 'grace' | 'readonly' = 'ok'
  let daysLeft: number | null = null
  if (sub) {
    daysLeft = differenceInDays(sub.expiresAt, now)
    if (now > graceUntil!) mode = 'readonly'
    else if (now > sub.expiresAt) mode = 'grace'
    else if (daysLeft <= 14) mode = 'warn_expiring'
  } else {
    mode = 'readonly'  // no subscription -> read-only
  }

  // Reload tenant to get the latest public-menu state (authenticatePos
  // doesn't include those fields).
  const tenantFull = await prisma.tenant.findUnique({ where: { id: auth.tenant.id } })
  const menu = tenantFull?.publicSlug && tenantFull?.publicMenuEnabled
    ? { slug: tenantFull.publicSlug }
    : null

  // Heartbeat TTL: the POS treats the locally stored mode as authoritative
  // only until this timestamp passes. Forces a re-check at least every
  // few hours and shrinks the window during which a customer who edits
  // SQLite to bypass the lock can keep using the POS.
  const TOKEN_TTL_MS = 6 * 60 * 60 * 1000   // 6 hours
  const tokenExpiresAt = new Date(now.getTime() + TOKEN_TTL_MS)

  return NextResponse.json({
    ok: true,
    server_time: now.toISOString(),
    token_expires_at: tokenExpiresAt.toISOString(),
    subscription: sub ? {
      status: sub.status,
      expires_at: sub.expiresAt.toISOString(),
      grace_until: graceUntil!.toISOString(),
      days_left: daysLeft,
      mode,
    } : { status: 'none', mode: 'readonly' },
    features: sub?.plan?.featuresJson ?? {},
    channel: auth.tenant.channel,
    pinned_version: auth.tenant.pinnedVersion,
    menu,
  })
}
