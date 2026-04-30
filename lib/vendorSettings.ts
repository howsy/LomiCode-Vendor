import { prisma } from './db'

const cache = new Map<string, { value: string; expiresAt: number }>()
const TTL_MS = 30_000  // small cache so frequent lookups don't hit DB

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  const row = await prisma.vendorSetting.findUnique({ where: { key } })
  const value = row?.value ?? fallback
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
  return value
}

export async function setSetting(key: string, value: string) {
  await prisma.vendorSetting.upsert({
    where: { key }, update: { value }, create: { key, value },
  })
  cache.delete(key)
}

export function fillUrlTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    encodeURIComponent(String(vars[name] ?? ''))
  )
}
