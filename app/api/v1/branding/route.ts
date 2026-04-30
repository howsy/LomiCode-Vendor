import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticatePos } from '@/lib/posAuth'

// Tenant branding (logo, brand color, tagline) is editable by the POS admin
// from Restaurant Settings. The POS pushes the new values here; the vendor
// admin updates the Tenant record so the QR menu, the tenant portal, and
// the vendor admin dashboard all show the same identity.
//
// Auth: same Bearer-license-key as every other /api/v1/* endpoint.
//
// Payload size: logo is a base64 data URL, capped at ~400KB. The POS
// resizes images to 400px before encoding; that produces ~30-80KB JPEGs.
// The cap is generous enough for PNGs with transparency but rejects raw
// camera dumps so we don't blow up Postgres rows.

const LOGO_MAX_BYTES = 500_000   // ~500KB after base64 — allows ~370KB raw
const HEX = /^#[0-9a-fA-F]{6}$/

const Body = z.object({
  logoUrl:    z.union([z.string().max(LOGO_MAX_BYTES * 1.4), z.literal('').transform(() => null), z.null()]).optional(),
  brandColor: z.union([z.string().regex(HEX), z.literal('').transform(() => null), z.null()]).optional(),
  tagline:    z.union([z.string().max(120), z.literal('').transform(() => null), z.null()]).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await authenticatePos(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const data = parsed.data

  // Build a Prisma update with ONLY the fields the POS actually sent. An
  // omitted key means "don't touch" — empty strings (from `<input>` clears)
  // already became `null` via the zod transform above, which clears the
  // column. This keeps "I just changed the tagline" from also blanking
  // a logo the POS doesn't currently know about.
  const update: any = {}
  if (data.logoUrl    !== undefined) update.logoUrl    = data.logoUrl
  if (data.brandColor !== undefined) update.brandColor = data.brandColor
  if (data.tagline    !== undefined) update.tagline    = data.tagline

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  // Extra defensive size check on the encoded logo. zod already capped the
  // string length but the actual bytes could differ slightly with multibyte
  // chars, so re-check here.
  if (typeof update.logoUrl === 'string' && update.logoUrl.length > LOGO_MAX_BYTES * 1.4) {
    return NextResponse.json({ error: 'logo_too_large' }, { status: 413 })
  }

  await prisma.tenant.update({
    where: { id: auth.tenant.id },
    data: update,
  })

  await prisma.event.create({
    data: {
      tenantId: auth.tenant.id,
      type: 'branding.updated',
      payloadJson: {
        fields: Object.keys(update),
        // Don't store the full data URL in the event — we only need to
        // know that *something* changed.
        logoBytes: typeof update.logoUrl === 'string' ? update.logoUrl.length : null,
      },
    },
  })

  return NextResponse.json({ ok: true })
}
