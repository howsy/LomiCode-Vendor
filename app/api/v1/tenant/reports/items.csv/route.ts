import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isTenantRole } from '@/lib/auth'
import { parseRangeFromSearch, topItems } from '@/lib/reports'
import { buildCSV, csvResponse } from '@/lib/csv'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isTenantRole(session.user.role) || !session.user.tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries())
  const range = parseRangeFromSearch(sp)
  const rows = await topItems(session.user.tenantId, range, 1000)
  const totals = ['TOTAL', '', rows.reduce((s, r) => s + r.qty, 0), rows.reduce((s, r) => s + r.revenue, 0)]
  const csv = buildCSV({
    headers: ['Rank', 'Item', 'Qty', 'Revenue'],
    rows: rows.map((r, idx) => [idx + 1, r.name, r.qty, r.revenue]),
    totals,
  })
  return csvResponse(`top-items-${range.from.toISOString().slice(0,10)}_${range.to.toISOString().slice(0,10)}.csv`, csv)
}
