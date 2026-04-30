import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions, isVendorRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ProductCard from '@/components/marketing/ProductCard'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

export const metadata = {
  title: 'LomiCode — Software for the modern restaurant',
  description: 'Point of sale, customer-facing QR menus, and self-service reports — built for restaurants in Iraq and beyond.',
}

// Marketing landing page replaces the previous redirect-to-login behavior.
// We still want signed-in users to feel at home, so the CTA shifts from
// "Sign in" to "Open dashboard" when there's a session.
export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  const dashHref = !session?.user
    ? '/login'
    : isVendorRole(session.user.role) ? '/tenants' : '/my/overview'
  const dashLabel = !session?.user ? 'Sign in' : 'Open dashboard'

  const products = await prisma.product.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white antialiased overflow-x-hidden">
      {/* Background effects: radial gradient and a subtle grid */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-[40rem] -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <MarketingNav dashHref={dashHref} dashLabel={dashLabel} />

      {/* ───── Hero ───── */}
      <section className="relative pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Now serving restaurants in Iraq, Kurdistan and beyond
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-[1.05]">
            Software that runs <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300">
              your restaurant.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            From the kitchen line to the customer's phone. A POS that never stops at outages,
            a QR menu that's always live, and reports your owner can actually read.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-20">
            <Link
              href="#products"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white text-slate-900 font-medium hover:bg-slate-100 transition-colors"
            >
              Browse products
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href={dashHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/15 bg-white/5 text-white font-medium hover:bg-white/10 backdrop-blur-sm transition-colors"
            >
              {dashLabel}
            </Link>
          </div>

          {/* Trust strip — three small cards stacked horizontally */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {[
              { stat: 'Offline-first', label: 'Cashiers keep working when the network drops.' },
              { stat: '3 languages',   label: 'Arabic, Kurdish and English on every screen.' },
              { stat: '< 1 minute',    label: 'Sync latency between POS and the QR menu.' },
            ].map((t) => (
              <div key={t.stat} className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm px-4 py-3 text-left">
                <div className="font-semibold text-emerald-300 text-sm">{t.stat}</div>
                <div className="text-slate-400 text-xs mt-0.5 leading-snug">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Products ───── */}
      <section id="products" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-semibold mb-2">
                Our products
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
                Everything your restaurant needs.
              </h2>
              <p className="text-slate-400 mt-3 max-w-xl">
                One ecosystem for the cashier, the kitchen, the customer, and the owner.
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              No products published yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ───── Why us / Features ───── */}
      <section className="relative py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-semibold mb-2">
              Built for restaurants
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto">
              Designed around the way you actually work.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {[
              { icon: '⚡', title: 'Native desktop speed',  body: 'The POS is a native Electron app. No web latency between tap and receipt — even on cheap hardware.' },
              { icon: '🌐', title: 'Offline by design',     body: 'Local SQLite is the source of truth. The cloud is a sync target, not a dependency. Internet outages are a non-event.' },
              { icon: '🔄', title: 'Live cloud sync',       body: 'Every order, every menu change, every device flows up to the cloud within seconds when connectivity exists.' },
              { icon: '🖨️', title: 'Two-printer workflow',  body: 'Receipts to the cashier, kitchen tickets to the line. Silent printing, no preview window getting in the cashier\'s way.' },
              { icon: '🌍', title: 'Three languages',       body: 'Arabic, Kurdish and English with proper RTL support. Cashiers and customers each pick their own.' },
              { icon: '🛡️', title: 'Account security built-in',  body: 'Per-user 2FA, super-admin enforcement, recovery codes, audit logs on every sensitive action.' },
            ].map((f) => (
              <div key={f.title}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-white text-lg mb-2 tracking-tight">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-900/30 via-slate-900/40 to-purple-900/30 p-12 md:p-16 text-center">
            {/* Decorative blur */}
            <div aria-hidden className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Ready to modernize your restaurant?
              </h2>
              <p className="text-slate-300 max-w-xl mx-auto mb-8 text-lg">
                Sign in to get a license, or browse the products to see what's possible.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={dashHref}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white text-slate-900 font-medium hover:bg-slate-100 transition-colors"
                >
                  {dashLabel}
                  <span>→</span>
                </Link>
                <Link
                  href="#products"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/15 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
                >
                  Browse products
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter products={products.map((p) => ({ slug: p.slug, name: p.name }))} />
    </div>
  )
}
