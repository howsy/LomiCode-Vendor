import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions, isVendorRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

// Hex (#rrggbb) → "r, g, b" so we can drop it into rgba() for the hero
// gradient and accent colours throughout the page.
function hexToRgb(hex: string | null | undefined): string {
  const m = (hex ?? '').match(/^#([0-9a-f]{6})$/i)
  if (!m) return '16, 185, 129'  // emerald-500 fallback
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

type Feature = { title: string; description: string; icon?: string }

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } })
  if (!product || !product.isPublished) return { title: 'Product — LomiCode' }
  return {
    title: `${product.name} — LomiCode`,
    description: product.tagline,
  }
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions)
  const dashHref = !session?.user
    ? '/login'
    : isVendorRole(session.user.role) ? '/tenants' : '/my/overview'
  const dashLabel = !session?.user ? 'Sign in' : 'Open dashboard'

  const product = await prisma.product.findUnique({ where: { slug: params.slug } })
  if (!product || !product.isPublished) notFound()

  // Sibling products for the "Other products" rail at the bottom — keeps
  // visitors moving through the catalogue instead of dropping off after
  // one detail page.
  const siblings = await prisma.product.findMany({
    where: { isPublished: true, id: { not: product.id } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 6,
  })

  const rgb = hexToRgb(product.accentColor)
  const features: Feature[] = Array.isArray(product.featuresJson)
    ? (product.featuresJson as unknown as Feature[])
    : []

  // CTA: prefer the product's configured ctaUrl, fall back to dashboard.
  const ctaHref  = product.ctaUrl  || dashHref
  const ctaLabel = product.ctaLabel || dashLabel

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white antialiased overflow-x-hidden">
      {/* Background — coloured by product accent so each detail page feels different */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full blur-3xl"
          style={{ background: `rgba(${rgb}, 0.15)` }}
        />
        <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <MarketingNav dashHref={dashHref} dashLabel={dashLabel} />

      {/* ───── Hero ───── */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/#products" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
            <span>←</span> All products
          </Link>

          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-2xl grid place-items-center text-3xl shadow-xl"
              style={{
                background: `linear-gradient(135deg, rgba(${rgb}, 0.45), rgba(${rgb}, 0.18))`,
                boxShadow: `0 16px 32px -12px rgba(${rgb}, 0.45)`,
                border: `1px solid rgba(${rgb}, 0.3)`,
              }}
            >
              {product.iconEmoji ?? '✨'}
            </div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: `rgb(${rgb})` }}>
              Product
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-[1.05]">
            {product.name}
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mb-10 leading-relaxed">
            {product.tagline}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-slate-900 font-medium transition-colors"
              style={{ background: `rgb(${rgb})` }}
            >
              {ctaLabel}
              <span>→</span>
            </Link>
            <Link
              href="/#products"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/15 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
            >
              Other products
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Description ───── */}
      {product.description && (
        <section className="relative py-16 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-slate-300 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        </section>
      )}

      {/* ───── Features ───── */}
      {features.length > 0 && (
        <section className="relative py-20 px-6 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <div className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: `rgb(${rgb})` }}>
                What's inside
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                The features that matter most.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-7 transition-colors hover:bg-white/[0.04]"
                >
                  <div
                    className="w-10 h-10 rounded-lg grid place-items-center text-xl mb-4"
                    style={{
                      background: `rgba(${rgb}, 0.15)`,
                      border: `1px solid rgba(${rgb}, 0.25)`,
                    }}
                  >
                    {f.icon ?? '✓'}
                  </div>
                  <h3 className="font-semibold text-lg mb-2 tracking-tight text-white">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───── CTA ───── */}
      <section className="relative py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div
            className="relative overflow-hidden rounded-3xl border p-10 md:p-14 text-center"
            style={{
              borderColor: `rgba(${rgb}, 0.2)`,
              background: `linear-gradient(135deg, rgba(${rgb}, 0.12), rgba(${rgb}, 0.03))`,
            }}
          >
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-3">
              See {product.name} in action.
            </h2>
            <p className="text-slate-300 mb-7 max-w-xl mx-auto">
              {ctaLabel === 'Sign in' ? 'Sign in to get a license and start using it.' : 'Open the dashboard to manage your account.'}
            </p>
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-slate-900 font-medium"
              style={{ background: `rgb(${rgb})` }}
            >
              {ctaLabel} <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Other products ───── */}
      {siblings.length > 0 && (
        <section className="relative py-20 px-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-10">
              Other products
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {siblings.map((s) => {
                const sRgb = hexToRgb(s.accentColor)
                return (
                  <Link
                    key={s.id}
                    href={`/products/${s.slug}`}
                    className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.05] transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-lg grid place-items-center text-lg mb-3"
                      style={{ background: `rgba(${sRgb}, 0.18)`, border: `1px solid rgba(${sRgb}, 0.2)` }}
                    >
                      {s.iconEmoji ?? '✨'}
                    </div>
                    <h3 className="font-semibold text-white mb-1 tracking-tight">{s.name}</h3>
                    <p className="text-sm text-slate-400 leading-snug line-clamp-2">{s.tagline}</p>
                    <div className="mt-3 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: `rgb(${sRgb})` }}>
                      Learn more →
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <MarketingFooter products={siblings.map((s) => ({ slug: s.slug, name: s.name }))} />
    </div>
  )
}
