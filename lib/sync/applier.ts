import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// Shape of one row from the POS's `change_log` table.
export type ChangeRow = {
  id: number | string
  table_name: string
  row_id: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: Record<string, any> | null
  created_at: string
}

// Map POS payload keys (snake_case) into Prisma model fields (camelCase) per table.
// Only the columns the POS actually writes are mapped; anything else is ignored.

function mapBranch(p: any) {
  return {
    name: p.name, nameAr: p.name_ar ?? null, nameKu: p.name_ku ?? null,
    address: p.address ?? null, phone: p.phone ?? null,
    createdAt: p.created_at ? new Date(p.created_at) : new Date(),
  }
}

function mapStaff(p: any) {
  // Partial-update safe: staff:update / staff:delete log only the fields
  // they touch. Defaulting pin to null on those would void the cashier's
  // PIN every time their role changed.
  const out: any = {}
  if (p.branch_id !== undefined)  out.branchId  = p.branch_id
  if (p.name      !== undefined)  out.name      = p.name
  if (p.pin       !== undefined)  out.pin       = p.pin
  if (p.role      !== undefined)  out.role      = p.role
  if (p.is_active !== undefined)  out.isActive  = p.is_active === 0 ? false : true
  return out
}

function mapCategory(p: any) {
  return {
    branchId: p.branch_id, name: p.name,
    nameAr: p.name_ar ?? null, nameKu: p.name_ku ?? null,
    sortOrder: p.sort_order ?? 0,
  }
}

// Multi-menu: only one menu per branch is active at a time. The POS sends
// both updates (deactivate-others + activate-this) atomically when the admin
// switches active, so we just trust the payload's is_active value when it's
// present. Partial UPDATEs (e.g. a rename via menus:update) only carry the
// fields they touch — emitting `isActive: false` here for those would
// silently deactivate the active menu on every name edit.
function mapMenu(p: any) {
  const out: any = {}
  if (p.branch_id  !== undefined) out.branchId  = p.branch_id
  if (p.name       !== undefined) out.name      = p.name
  if (p.name_ar    !== undefined) out.nameAr    = p.name_ar
  if (p.name_ku    !== undefined) out.nameKu    = p.name_ku
  if (p.is_active  !== undefined) out.isActive  = p.is_active === 1 || p.is_active === true
  if (p.sort_order !== undefined) out.sortOrder = p.sort_order
  if (p.created_at !== undefined) out.createdAt = new Date(p.created_at)
  return out
}

function mapItem(p: any) {
  // CRITICAL: only emit fields the payload actually contains. Partial
  // UPDATE rows (e.g. the menu-migration's `{ id, menu_id }` payload) must
  // not clobber other columns with defaults like `price: 0` or
  // `nameAr: null` — the previous code did exactly that and wiped item
  // data on every migration. The applier filters undefined values; sticking
  // to "present-in-payload" gating here is what makes that filter actually
  // protective.
  const out: any = {}
  if (p.branch_id !== undefined)   out.branchId    = p.branch_id
  if (p.category_id !== undefined) out.categoryId  = p.category_id
  if (p.name !== undefined)        out.name        = p.name
  if (p.name_ar !== undefined)     out.nameAr      = p.name_ar
  if (p.name_ku !== undefined)     out.nameKu      = p.name_ku
  if (p.price !== undefined)       out.price       = p.price
  if (p.image_url !== undefined)   out.imageUrl    = p.image_url
  if (p.is_available !== undefined) out.isAvailable = p.is_available === 0 ? false : true
  if (p.sort_order !== undefined)  out.sortOrder   = p.sort_order
  if (Object.prototype.hasOwnProperty.call(p, 'menu_id')) {
    out.menuId = p.menu_id ?? null
  }
  return out
}

function mapTable(p: any) {
  // Same partial-update protection as mapItem. `tables:updateStatus` only
  // logs `{ id, status }` — emitting `capacity ?? 4` here would silently
  // reset every table to 4 seats every time a cashier flipped occupied/free.
  const out: any = {}
  if (p.branch_id !== undefined) out.branchId  = p.branch_id
  if (p.label    !== undefined) out.label     = p.label
  if (p.capacity !== undefined) out.capacity  = p.capacity
  if (p.status   !== undefined) out.status    = p.status
  return out
}

function mapOrder(p: any) {
  return {
    branchId: p.branch_id, staffId: p.staff_id ?? null,
    tableNumber: p.table_number ?? null,
    status: p.status ?? 'pending',
    orderType: p.order_type ?? 'dine_in',
    total: p.total ?? 0, notes: p.notes ?? null,
    createdAt: p.created_at ? new Date(p.created_at) : new Date(),
    updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
  }
}

function mapOrderItem(p: any) {
  return {
    orderId: p.order_id, itemId: p.item_id,
    quantity: p.quantity ?? 1, unitPrice: p.unit_price ?? 0,
    notes: p.notes ?? null,
  }
}

const TABLES = {
  branches:    { mapper: mapBranch,    delegate: 'branch' },
  staff:       { mapper: mapStaff,     delegate: 'staff' },
  categories:  { mapper: mapCategory,  delegate: 'category' },
  menus:       { mapper: mapMenu,      delegate: 'menu' },
  items:       { mapper: mapItem,      delegate: 'item' },
  tables:      { mapper: mapTable,     delegate: 'restTable' },
  orders:      { mapper: mapOrder,     delegate: 'order' },
  order_items: { mapper: mapOrderItem, delegate: 'orderItem' },
} as const

type ApplyResult = {
  acceptedThrough: number
  applied: number
  skipped: number
  errors: { id: number; error: string }[]
}

export async function applyChanges(opts: {
  tenantId: string
  deviceId: string
  rows: ChangeRow[]
}): Promise<ApplyResult> {
  const { tenantId, deviceId, rows } = opts
  if (rows.length === 0) return { acceptedThrough: 0, applied: 0, skipped: 0, errors: [] }

  const cursor = await prisma.syncCursor.upsert({
    where: { deviceId },
    create: { deviceId, lastChangeLogId: BigInt(0) },
    update: {},
  })
  let lastApplied = Number(cursor.lastChangeLogId)
  let applied = 0
  let skipped = 0
  const errors: { id: number; error: string }[] = []

  // Sort rows by id ascending so we apply in original order
  const sorted = [...rows].sort((a, b) => Number(a.id) - Number(b.id))

  for (const row of sorted) {
    const id = Number(row.id)
    if (id <= lastApplied) { skipped++; continue }

    const cfg = (TABLES as any)[row.table_name]
    if (!cfg) { skipped++; lastApplied = id; continue }   // unknown table -> safe ignore

    try {
      await applyOne(tenantId, row, cfg)
      applied++
      lastApplied = id
    } catch (err: any) {
      // Don't let one bad row block hundreds of good ones — record the
      // failure, advance the cursor PAST it, and keep going. Operator can
      // diagnose from the Activity feed (events of type 'sync.row_failed').
      const msg = String(err?.message ?? err)
      errors.push({ id, error: msg })
      lastApplied = id
      try {
        await prisma.event.create({
          data: {
            tenantId,
            type: 'sync.row_failed',
            payloadJson: { changeLogId: id, table: row.table_name, op: row.operation, rowId: row.row_id, error: msg.slice(0, 500) },
          },
        })
      } catch { /* event logging failure is non-fatal */ }
    }
  }

  if (lastApplied !== Number(cursor.lastChangeLogId)) {
    await prisma.syncCursor.update({
      where: { deviceId },
      data: { lastChangeLogId: BigInt(lastApplied) },
    })
  }

  return { acceptedThrough: lastApplied, applied, skipped, errors }
}

async function applyOne(
  tenantId: string,
  row: ChangeRow,
  cfg: { mapper: (p: any) => any; delegate: keyof Prisma.TransactionClient }
) {
  const delegate = (prisma as any)[cfg.delegate]
  const id = row.row_id

  if (row.operation === 'DELETE') {
    await delegate.deleteMany({ where: { id, tenantId } })
    return
  }
  if (!row.payload) throw new Error('missing_payload')

  const data = cfg.mapper(row.payload)
  // Drop keys whose value is undefined — partial UPDATE payloads (e.g. the
  // POS's `tables:updateStatus` only logs {id, status}) shouldn't blow away
  // real values with undefined or fail Prisma's required-field validation.
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )

  if (row.operation === 'UPDATE') {
    // Don't try to create — the row should exist. updateMany silently
    // succeeds with `count: 0` if the row was never synced; the next push
    // (or a backfill) will resend the INSERT and we'll catch up then.
    if (Object.keys(clean).length === 0) return
    await delegate.updateMany({ where: { id, tenantId }, data: clean })
    return
  }

  // INSERT (or unknown op): upsert in case the row was already created
  // by an earlier resend.
  await delegate.upsert({
    where: { id },
    create: { id, tenantId, ...clean },
    update: clean,
  })
}
