// Lightweight background maintenance — runs on first DB access, then every
// 6 hours. Currently only prunes old events / audit_log rows to keep the
// tables from growing forever. Adding more housekeeping (dead claim cleanup,
// orphan device pruning, etc.) here is straightforward.

import { prisma } from './db'

const RETENTION_DAYS = 90
const TICK_MS = 6 * 60 * 60 * 1000     // 6 hours

let started = false
let timer: NodeJS.Timeout | null = null

async function pruneOnce() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  try {
    const [events, auditLog] = await Promise.all([
      prisma.event.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ])
    if (events.count > 0 || auditLog.count > 0) {
      // eslint-disable-next-line no-console
      console.log(`[maintenance] pruned events=${events.count} audit_log=${auditLog.count}`)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[maintenance] prune failed:', (err as any)?.message ?? err)
  }
}

// Idempotent: safe to call multiple times.
export function startMaintenance() {
  if (started) return
  started = true
  // Run once after a short delay (don't block the first request)
  setTimeout(() => { pruneOnce() }, 30_000)
  timer = setInterval(pruneOnce, TICK_MS)
}

export function stopMaintenance() {
  if (timer) clearInterval(timer)
  timer = null
  started = false
}
