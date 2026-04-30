import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isTenantRole } from '@/lib/auth'
import { parseRangeFromSearch, revenueByDay } from '@/lib/reports'
import { buildCSV, csvResponse } from '@/lib/csv'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isTenantRole(session.user.role) || !session.user.tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries())
  const range = parseRangeFromSearch(sp)
  const rows = await revenueByDay(session.user.tenantId, range)
  const totals = ['TOTAL', rows.reduce((s, r) => s + r.orders, 0), rows.reduce((s, r) => s + r.revenue, 0)]
  const csv = buildCSV({
    headers: ['Day', 'Orders', 'Revenue'],
    rows: rows.map((r) => [r.day, r.orders, r.revenue]),
    totals,
  })
  return csvResponse(`sales-${range.from.toISOString().slice(0,10)}_${range.to.toISOString().slice(0,10)}.csv`, csv)
}
