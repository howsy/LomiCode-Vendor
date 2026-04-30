import Link from 'next/link'
import type { Product } from '@prisma/client'

// Hex (#rrggbb) → "r, g, b" for use in rgba() inside the card's gradient.
function hexToRgb(hex: string | null | undefined): string {
  const m = (hex ?? '').match(/^#([0-9a-f]{6})$/i)
  if (!m) return '16, 185, 129'  // emerald-500 fallback
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

// Each card on the marketing landing page. Uses the product's accentColor
// for the gradient header and the hover halo, falling back to emerald.
//
// Animation: cards fade in with a staggered delay tied to the index, so
// the grid resolves left-to-right when the page loads.

type Feature = { title: string; description: string }

export default function ProductCard({
  product,
  index = 0,
}: {
  product: Product
  index?: number
}) {
  const rgb = hexToRgb(product.accentColor)
  const features = Array.isArray(product.featuresJson)
    ? (product.featuresJson as unknown as Feature[]).slice(0, 3)
    : []

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/20 hover:-translate-y-1"
      style={{
        animation: `marketingFadeUp 600ms cubic-bezier(.2,.8,.2,1) both`,
        animationDelay: `${Math.min(index * 80, 320)}ms`,
      }}
    >
      {/* Hover halo — only renders on hover, tinted by accent color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at 50% 0%, rgba(${rgb}, 0.12), transparent 50%)`,
        }}
      />

      {/* Gradient header with icon */}
      <div
        className="relative px-7 pt-8 pb-6"
        style={{
          background: `linear-gradient(135deg, rgba(${rgb}, 0.18) 0%, rgba(${rgb}, 0.04) 100%)`,
          borderBottom: `1px solid rgba(${rgb}, 0.15)`,
        }}
      >
        <div
          className="w-12 h-12 rounded-xl grid place-items-center text-2xl shadow-lg mb-5"
          style={{
            background: `linear-gradient(135deg, rgba(${rgb}, 0.4), rgba(${rgb}, 0.15))`,
            boxShadow: `0 8px 24px -8px rgba(${rgb}, 0.4)`,
          }}
        >
          {product.iconEmoji ?? '✨'}
        </div>
        <h3 className="text-xl font-semibold tracking-tight text-white mb-1.5">
          {product.name}
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          {product.tagline}
        </p>
      </div>

      {/* Feature list */}
      <div className="px-7 py-6 flex-1">
        {features.length > 0 ? (
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f.title} className="flex gap-2.5 items-start">
                <span
                  className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
                  style={{ background: `rgb(${rgb})` }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200 leading-tight">{f.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-snug">{f.description}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">More details on the product page.</p>
        )}
      </div>

      {/* Footer with arrow CTA */}
      <div className="px-7 pb-6 flex items-center justify-between">
        <span
          className="text-sm font-medium transition-all"
          style={{ color: `rgb(${rgb})` }}
        >
          Learn more
        </span>
        <span
          className="text-base transition-transform duration-300 group-hover:translate-x-1"
          style={{ color: `rgb(${rgb})` }}
        >
          →
        </span>
      </div>

      <style>{`
        @keyframes marketingFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Link>
  )
}
