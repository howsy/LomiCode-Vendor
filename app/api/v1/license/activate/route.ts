import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticatePos } from '@/lib/posAuth'

const Body = z.object({
  device_uuid: z.string().uuid(),
  hardware_fingerprint: z.string().min(8).max(200),
  app_version: z.string().optional(),
  os: z.string().optional(),
  hostname: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await authenticatePos(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 })

  const { device_uuid, hardware_fingerprint, app_version, os, hostname } = parsed.data
  const fp = hardware_fingerprint.trim()

  // Re-fetch the tenant with maxDevices (authenticatePos doesn't carry it)
  const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenant.id } })
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })

  // Hardware-lock check: if any other ACTIVE device for this tenant has a
  // fingerprint that doesn't match this one, reject. Cleared (null) and
  // disabled devices don't count.
  const otherActive = await prisma.device.findFirst({
    where: {
      tenantId: tenant.id,
      isActive: true,
      NOT: { deviceUuid: device_uuid },
      hardwareFingerprint: { not: null },
    },
  })
  if (otherActive?.hardwareFingerprint && otherActive.hardwareFingerprint !== fp) {
    // Count active devices with any fingerprint (including this one if it exists)
    const activeCount = await prisma.device.count({
      where: { tenantId: tenant.id, isActive: true },
    })
    if (activeCount >= tenant.maxDevices) {
      return NextResponse.json({
        error: 'max_devices_reached',
        hint: `This tenant is limited to ${tenant.maxDevices} active device(s). Ask the vendor to raise the limit or disable an existing device.`,
      }, { status: 409 })
    }
    // Otherwise, this is a NEW device and we're under the limit — allowed.
  }

  // Self-heal: if a device row exists for this UUID but is disabled, refuse.
  const existing = await prisma.device.findUnique({ where: { deviceUuid: device_uuid } })
  if (existing && !existing.isActive) {
    return NextResponse.json({ error: 'device_disabled' }, { status: 403 })
  }

  // Enforce maxDevices on truly NEW devices for this tenant
  if (!existing) {
    const activeCount = await prisma.device.count({
      where: { tenantId: tenant.id, isActive: true },
    })
    if (activeCount >= tenant.maxDevices) {
      return NextResponse.json({
        error: 'max_devices_reached',
        hint: `This tenant is limited to ${tenant.maxDevices} active device(s).`,
      }, { status: 409 })
    }
  }

  const device = await prisma.device.upsert({
    where: { deviceUuid: device_uuid },
    create: {
      tenantId: tenant.id, deviceUuid: device_uuid,
      hardwareFingerprint: fp, appVersion: app_version, os, hostname,
    },
    update: {
      hardwareFingerprint: fp, appVersion: app_version, os, hostname,
      lastSeenAt: new Date(),
    },
  })

  // Record claim if first time on this fingerprint
  const existingClaim = await prisma.licenseClaim.findFirst({
    where: { hardwareFingerprint: fp, tenantId: tenant.id },
  })
  if (!existingClaim) {
    await prisma.licenseClaim.create({
      data: { hardwareFingerprint: fp, tenantId: tenant.id, kind: 'manual' },
    })
  }

  await prisma.event.create({
    data: { tenantId: tenant.id, deviceId: device.id, type: 'device.activated', payloadJson: { hostname, app_version, fp } },
  })

  return NextResponse.json({
    ok: true,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    device_id: device.id,
  })
}
