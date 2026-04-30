import { prisma } from './db'

export type Lang = 'en' | 'ar' | 'ku'
export const LANGS: Lang[] = ['en', 'ar', 'ku']
export const RTL_LANGS = new Set(['ar', 'ku'])

export function pickName(row: { name: string; nameAr: string | null; nameKu: string | null }, lang: Lang): string {
  if (lang === 'ar' && row.nameAr) return row.nameAr
  if (lang === 'ku' && row.nameKu) return row.nameKu
  return row.name
}

// Top-level loader. Returns null if the tenant doesn't exist, the menu is
// disabled, or the active subscription's plan doesn't include qr_menu.
export async function loadPublicMenu(slug: string, branchId?: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { publicSlug: slug, publicMenuEnabled: true, status: 'active' },
  })
  if (!tenant) return null

  // Plan-feature check: even if the menu is technically enabled on the
  // tenant, only Plans 2+ include the QR menu. If their subscription
  // expires or downgrades, the menu silently 404s.
  const sub = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id, status: { in: ['active', 'trial'] } },
    orderBy: { expiresAt: 'desc' },
    include: { plan: true },
  })
  const features = (sub?.plan?.featuresJson as any) ?? {}
  if (!features.qr_menu) return null

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
  })
  if (branches.length === 0) {
    return { tenant, branches: [], branch: null, categories: [] as any[], items: [] as any[] }
  }
  const branch = branchId
    ? branches.find((b) => b.id === branchId) ?? branches[0]
    : branches[0]

  // Multi-menu: only the currently-active menu's items reach the public QR.
  // If a branch somehow has no active menu (transitional state during a
  // switch, or legacy data), fall back to all items so customers see
  // something instead of an empty page.
  const activeMenu = await prisma.menu.findFirst({
    where: { tenantId: tenant.id, branchId: branch.id, isActive: true },
  })

  const itemsWhere: any = {
    tenantId: tenant.id,
    branchId: branch.id,
    isAvailable: true,
  }
  if (activeMenu) itemsWhere.menuId = activeMenu.id

  const [categories, items] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: tenant.id, branchId: branch.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.item.findMany({
      where: itemsWhere,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  return { tenant, branches, branch, categories, items, activeMenu }
}
