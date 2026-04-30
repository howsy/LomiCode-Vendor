import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { loadPublicMenu, type Lang, RTL_LANGS, pickName } from '@/lib/menu'
import MenuClient from './MenuClient'

// Revalidate every 30s — POS sync runs on the same cadence so the menu is
// at most 30s + 30s = 1 minute behind reality. Good enough for a menu.
export const revalidate = 30

type SP = { branch?: string; lang?: string }

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await loadPublicMenu(params.slug)
  if (!data) return { title: 'Menu' }
  return {
    title: `${data.tenant.name} — Menu`,
    description: data.tenant.tagline ?? `Browse the menu of ${data.tenant.name}.`,
  }
}

export default async function MenuPage({
  params, searchParams,
}: { params: { slug: string }; searchParams: SP }) {
  const data = await loadPublicMenu(params.slug, searchParams.branch)
  if (!data) notFound()

  const lang = (['en', 'ar', 'ku'].includes(searchParams.lang ?? '')
    ? searchParams.lang
    : 'en') as Lang
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'

  // Translate names server-side so SEO/non-JS users see the right language
  const sections = data.categories.map((c) => ({
    id: c.id,
    name: pickName(c, lang),
    items: data.items
      .filter((i) => i.categoryId === c.id)
      .map((i) => ({
        id: i.id,
        name: pickName(i, lang),
        price: Number(i.price),
        imageUrl: i.imageUrl,
      })),
  }))

  const orphanItems = data.items
    .filter((i) => !data.categories.some((c) => c.id === i.categoryId))
    .map((i) => ({
      id: i.id,
      name: pickName(i, lang),
      price: Number(i.price),
      imageUrl: i.imageUrl,
    }))

  // Fall back to a warm orange if no brand color set
  const brand = data.tenant.brandColor && /^#[0-9a-fA-F]{6}$/.test(data.tenant.brandColor)
    ? data.tenant.brandColor
    : '#f97316'

  return (
    <MenuClient
      slug={params.slug}
      tenantName={data.tenant.name}
      tagline={data.tenant.tagline}
      logoUrl={data.tenant.logoUrl}
      brandColor={brand}
      branches={data.branches.map((b) => ({ id: b.id, name: b.name, address: b.address }))}
      branchId={data.branch?.id ?? null}
      lang={lang}
      dir={dir}
      sections={sections}
      orphanItems={orphanItems}
    />
  )
}
