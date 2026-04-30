import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticatePos } from '@/lib/posAuth'
import { applyChanges } from '@/lib/sync/applier'

const Row = z.object({
  id: z.union([z.number(), z.string()]),
  table_name: z.string(),
  row_id: z.string(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  payload: z.record(z.any()).nullable(),
  created_at: z.string(),
})

const Body = z.object({
  device_uuid: z.string().uuid(),
  app_version: z.string().optional(),
  rows: z.array(Row).max(2000),
})

export async function POST(req: NextRequest) {
  const auth = await authenticatePos(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 })

  const device = await prisma.device.findUnique({ where: { deviceUuid: parsed.data.device_uuid } })
  if (!device || device.tenantId !== auth.tenant.id) {
    return NextResponse.json({ error: 'device_not_registered' }, { status: 404 })
  }
  if (!device.isActive) {
    return NextResponse.json({ error: 'device_disabled' }, { status: 403 })
  }

  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date(), appVersion: parsed.data.app_version },
  })

  const result = await applyChanges({
    tenantId: auth.tenant.id,
    deviceId: device.id,
    rows: parsed.data.rows as any,
  })

  await prisma.event.create({
    data: {
      tenantId: auth.tenant.id, deviceId: device.id,
      type: result.errors.length ? 'sync.partial' : 'sync.ok',
      payloadJson: { applied: result.applied, skipped: result.skipped, errors: result.errors.length },
    },
  })

  return NextResponse.json({
    ok: true,
    accepted_through: result.acceptedThrough,
    applied: result.applied,
    skipped: result.skipped,
    errors: result.errors,
  })
}
