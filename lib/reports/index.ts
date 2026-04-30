import { prisma } from '@/lib/db'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export type DateRange = { from: Date; to: Date }

export function defaultRange(): DateRange {
  const to = endOfDay(new Date())
  const from = startOfDay(subDays(to, 29))
  return { from, to }
}

export function parseRangeFromSearch(sp: { from?: string; to?: string }): DateRange {
  const def = defaultRange()
  return {
    from: sp.from ? startOfDay(new Date(sp.from)) : def.from,
    to:   sp.to   ? endOfDay(new Date(sp.to))     : def.to,
  }
}

export async function tenantSummary(tenantId: string, range: DateRange) {
  const where = { tenantId, createdAt: { gte: range.from, lte: range.to } }
  const [agg, count] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { total: true }, _avg: { total: true } }),
    prisma.order.count({ where }),
  ])
  return {
    revenue: Number(agg._sum.total ?? 0),
    orders: count,
    avgTicket: Number(agg._avg.total ?? 0),
  }
}

export async function revenueByDay(tenantId: string, range: DateRange) {
  const rows: { day: Date; revenue: number; orders: number }[] = await prisma.$queryRaw`
    SELECT date_trunc('day', "created_at") AS day,
           SUM(total)::float AS revenue,
           COUNT(*)::int AS orders
    FROM   orders
    WHERE  tenant_id = ${tenantId}
      AND  created_at >= ${range.from}
      AND  created_at <= ${range.to}
    GROUP  BY 1
    ORDER  BY 1
  `
  return rows.map((r) => ({
    day: new Date(r.day).toISOString().slice(0, 10),
    revenue: Number(r.revenue ?? 0),
    orders: Number(r.orders ?? 0),
  }))
}

export async function topItems(tenantId: string, range: DateRange, limit = 10) {
  const rows: { id: string; name: string; qty: number; revenue: number }[] = await prisma.$queryRaw`
    SELECT i.id, i.name,
           SUM(oi.quantity)::int AS qty,
           SUM(oi.quantity * oi.unit_price)::float AS revenue
    FROM   order_items oi
    JOIN   orders o ON o.id = oi.order_id
    JOIN   items i  ON i.id = oi.item_id
    WHERE  o.tenant_id = ${tenantId}
      AND  o.created_at >= ${range.from}
      AND  o.created_at <= ${range.to}
    GROUP  BY i.id, i.name
    ORDER  BY revenue DESC
    LIMIT  ${limit}
  `
  return rows.map((r) => ({ id: r.id, name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }))
}

export async function staffBreakdown(tenantId: string, range: DateRange) {
  const rows: { id: string; name: string; orders: number; revenue: number; avg: number }[] = await prisma.$queryRaw`
    SELECT s.id, s.name,
           COUNT(o.id)::int AS orders,
           COALESCE(SUM(o.total),0)::float AS revenue,
           COALESCE(AVG(o.total),0)::float AS avg
    FROM   staff s
    LEFT JOIN orders o
           ON o.staff_id = s.id
          AND o.tenant_id = ${tenantId}
          AND o.created_at >= ${range.from}
          AND o.created_at <= ${range.to}
    WHERE  s.tenant_id = ${tenantId}
    GROUP  BY s.id, s.name
    ORDER  BY revenue DESC
  `
  return rows.map((r) => ({
    id: r.id, name: r.name,
    orders: Number(r.orders), revenue: Number(r.revenue), avg: Number(r.avg),
  }))
}
