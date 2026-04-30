import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticatePos } from '@/lib/posAuth'

// Compare semver-ish strings: returns true if `a` > `b`.
function gt(a: string, b: string) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0, db = pb[i] ?? 0
    if (da > db) return true
    if (da < db) return false
  }
  return false
}

export async function GET(req: NextRequest) {
  const auth = await authenticatePos(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const current = req.nextUrl.searchParams.get('version') ?? '0.0.0'
  const t = auth.tenant

  // Pinned channel: only the exact pinned version, ignore current
  if (t.channel === 'pinned' && t.pinnedVersion) {
    const r = await prisma.release.findFirst({
      where: { version: t.pinnedVersion },
      orderBy: { publishedAt: 'desc' },
    })
    if (!r || !gt(r.version, current)) return NextResponse.json({ available: false })
    return NextResponse.json({
      available: true,
      version: r.version,
      url: `/api/v1/updates/download/${encodeURIComponent(r.fileKey)}`,
      yml_url: `/api/v1/updates/download/${encodeURIComponent(r.ymlKey)}`,
      mandatory: r.mandatory, notes: r.notes,
    })
  }

  // stable / beta: pick latest on that channel
  const r = await prisma.release.findFirst({
    where: { channel: t.channel as 'stable' | 'beta' },
    orderBy: { publishedAt: 'desc' },
  })
  if (!r || !gt(r.version, current)) return NextResponse.json({ available: false })

  return NextResponse.json({
    available: true,
    version: r.version,
    url: `/api/v1/updates/download/${encodeURIComponent(r.fileKey)}`,
    yml_url: `/api/v1/updates/download/${encodeURIComponent(r.ymlKey)}`,
    mandatory: r.mandatory,
    notes: r.notes,
  })
}
