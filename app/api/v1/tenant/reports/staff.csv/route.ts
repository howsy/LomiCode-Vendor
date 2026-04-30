import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isTenantRole } from '@/lib/auth'
import { parseRangeFromSearch, staffBreakdown } from '@/lib/reports'
import { buildCSV, csvResponse } from '@/lib/csv'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isTenantRole(session.user.role) || !session.user.tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries())
  const range = parseRangeFromSearch(sp)
  const rows = await staffBreakdown(session.user.tenantId, range)
  const totals = ['TOTAL', rows.reduce((s, r) => s + r.orders, 0), rows.reduce((s, r) => s + r.revenue, 0), '']
  const csv = buildCSV({
    headers: ['Cashier', 'Orders', 'Revenue', 'Avg ticket'],
    rows: rows.map((r) => [r.name, r.orders, r.revenue, r.avg.toFixed(0)]),
    totals,
  })
  return csvResponse(`per-cashier-${range.from.toISOString().slice(0,10)}_${range.to.toISOString().slice(0,10)}.csv`, csv)
}
