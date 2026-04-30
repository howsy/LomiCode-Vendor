import { NextRequest, NextResponse } from 'next/server'
import { authenticatePos } from '@/lib/posAuth'
import { getObjectStream } from '@/lib/releases/storage'

export async function GET(req: NextRequest, ctx: { params: { key: string[] } }) {
  const auth = await authenticatePos(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const key = ctx.params.key.map(decodeURIComponent).join('/')
  if (!key) return NextResponse.json({ error: 'missing_key' }, { status: 400 })

  try {
    const obj = await getObjectStream(key)
    return new NextResponse(obj.body as any, {
      status: 200,
      headers: {
        'Content-Type': obj.contentType ?? 'application/octet-stream',
        ...(obj.contentLength ? { 'Content-Length': String(obj.contentLength) } : {}),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'not_found', detail: String(err?.message ?? err) }, { status: 404 })
  }
}
