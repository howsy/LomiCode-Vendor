'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireVendorSuper } from '@/lib/guard'

// Server actions for the marketing-product catalogue. All gated by
// requireVendorSuper so a regular vendor_admin can't change what shows
// on the public landing page.
//
// Form-bound actions return Promise<void> and revalidatePath the relevant
// public + admin paths so the home page picks up the change immediately.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function parseFeatures(raw: string): unknown {
  // Accepts JSON; if blank, stores null. Caller has already trimmed.
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Features must be a JSON array')
    return parsed
  } catch (e) {
    throw new Error(`Invalid features JSON: ${(e as Error).message}`)
  }
}

export async function createProduct(formData: FormData): Promise<void> {
  const session = await requireVendorSuper()
  const name        = String(formData.get('name')        ?? '').trim()
  const slugRaw     = String(formData.get('slug')        ?? '').trim()
  const tagline     = String(formData.get('tagline')     ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const iconEmoji   = String(formData.get('iconEmoji')   ?? '').trim() || null
  const accentColor = String(formData.get('accentColor') ?? '').trim() || null
  const ctaLabel    = String(formData.get('ctaLabel')    ?? '').trim() || null
  const ctaUrl      = String(formData.get('ctaUrl')      ?? '').trim() || null
  const sortOrder   = parseInt(String(formData.get('sortOrder') ?? '0'), 10) || 0
  const isPublished = formData.get('isPublished') === 'on'
  const featuresRaw = String(formData.get('features')    ?? '').trim()

  if (!name)    throw new Error('Name is required')
  if (!tagline) throw new Error('Tagline is required')
  if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) {
    throw new Error('Accent color must be a 6-digit hex (e.g. #0f766e)')
  }

  const slug = slugRaw ? slugify(slugRaw) : slugify(name)
  if (!slug) throw new Error('Slug must contain at least one alphanumeric character')

  const features = parseFeatures(featuresRaw)

  await prisma.product.create({
    data: {
      slug, name, tagline,
      description: description || null,
      iconEmoji, accentColor,
      featuresJson: features as any,
      ctaLabel, ctaUrl,
      sortOrder, isPublished,
    },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'product.create',
      targetType: 'product', payloadJson: { slug, name },
    },
  })
  revalidatePath('/products')
  revalidatePath('/')
}

export async function updateProduct(formData: FormData): Promise<void> {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('Missing id')

  const name        = String(formData.get('name')        ?? '').trim()
  const slugRaw     = String(formData.get('slug')        ?? '').trim()
  const tagline     = String(formData.get('tagline')     ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const iconEmoji   = String(formData.get('iconEmoji')   ?? '').trim() || null
  const accentColor = String(formData.get('accentColor') ?? '').trim() || null
  const ctaLabel    = String(formData.get('ctaLabel')    ?? '').trim() || null
  const ctaUrl      = String(formData.get('ctaUrl')      ?? '').trim() || null
  const sortOrder   = parseInt(String(formData.get('sortOrder') ?? '0'), 10) || 0
  const isPublished = formData.get('isPublished') === 'on'
  const featuresRaw = String(formData.get('features')    ?? '').trim()

  if (!name)    throw new Error('Name is required')
  if (!tagline) throw new Error('Tagline is required')
  if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) {
    throw new Error('Accent color must be a 6-digit hex (e.g. #0f766e)')
  }

  const slug = slugify(slugRaw || name)
  const features = parseFeatures(featuresRaw)

  await prisma.product.update({
    where: { id },
    data: {
      slug, name, tagline,
      description: description || null,
      iconEmoji, accentColor,
      featuresJson: features as any,
      ctaLabel, ctaUrl,
      sortOrder, isPublished,
    },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'product.update',
      targetType: 'product', targetId: id, payloadJson: { slug, name },
    },
  })
  revalidatePath('/products')
  revalidatePath('/')
  revalidatePath(`/products/${slug}`)
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('Missing id')

  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return

  await prisma.product.delete({ where: { id } })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'product.delete',
      targetType: 'product', targetId: id, payloadJson: { slug: product.slug, name: product.name },
    },
  })
  revalidatePath('/products')
  revalidatePath('/')
}

export async function togglePublished(formData: FormData): Promise<void> {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  const isPublished = formData.get('isPublished') === '1'
  if (!id) throw new Error('Missing id')

  await prisma.product.update({
    where: { id },
    data: { isPublished },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'product.publish_toggle',
      targetType: 'product', targetId: id, payloadJson: { isPublished },
    },
  })
  revalidatePath('/products')
  revalidatePath('/')
}
