import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticatePos } from '@/lib/posAuth'
import { getObjectStream } from '@/lib/releases/storage'

// electron-updater (generic provider) fetches:
//   <feedUrl>/latest.yml         (or latest-mac.yml, latest-linux.yml)
//   <feedUrl>/<the-installer.exe>
//
// Both arrive here. We auth by license key, resolve the tenant's channel,
// then either serve the matching release's .yml or stream the binary.

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  const auth = await authenticatePos(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const filename = ctx.params.path[ctx.params.path.length - 1] ?? ''
  const isYml = /^latest(-mac|-linux)?\.ya?ml$/i.test(filename)

  if (isYml) {
    const release = await pickRelease(auth.tenant)
    if (!release) return NextResponse.json({ error: 'no_release' }, { status: 404 })
    return streamFromStorage(release.ymlKey, 'text/yaml')
  }

  // Otherwise treat the full path as a file key (the installer URL the .yml points at).
  const key = ctx.params.path.map(decodeURIComponent).join('/')
  return streamFromStorage(key, 'application/octet-stream')
}

async function pickRelease(tenant: { channel: string; pinnedVersion: string | null }) {
  if (tenant.channel === 'pinned' && tenant.pinnedVersion) {
    return prisma.release.findFirst({ where: { version: tenant.pinnedVersion } })
  }
  return prisma.release.findFirst({
    where: { channel: tenant.channel as 'stable' | 'beta' },
    orderBy: { publishedAt: 'desc' },
  })
}

async function streamFromStorage(key: string, fallbackType: string) {
  try {
    const obj = await getObjectStream(key)
    return new NextResponse(obj.body as any, {
      status: 200,
      headers: {
        'Content-Type': obj.contentType ?? fallbackType,
        ...(obj.contentLength ? { 'Content-Length': String(obj.contentLength) } : {}),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'not_found', detail: String(err?.message ?? err) }, { status: 404 })
  }
}
