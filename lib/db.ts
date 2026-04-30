import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var __maintenanceStarted: boolean | undefined
}

export const prisma =
  global.__prisma ?? new PrismaClient({ log: ['error', 'warn'] })

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma

// Kick off the background pruner the first time anything imports this file.
// Wrapped so a build-time import (where Prisma can't actually connect) is
// harmless — startMaintenance only schedules timers, no DB call yet.
if (!global.__maintenanceStarted) {
  global.__maintenanceStarted = true
  // Lazy import so server bundles that don't need maintenance still tree-shake it
  import('./maintenance').then((m) => m.startMaintenance()).catch(() => {})
}
