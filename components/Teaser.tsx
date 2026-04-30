import Link from 'next/link'
import type { ReactNode } from 'react'

// Marketing-style "preview" wrapper. Renders real (small) data underneath but
// blurred out, with a centered upgrade CTA on top. Visitors see the report is
// genuine — the numbers come from their own POS — but can't read them until
// they upgrade. Cheap to build, hard to fake, and much more persuasive than a
// blank "Upgrade required" page.

export default function Teaser({
  children,
  title = 'Unlock this report',
  message,
  ctaLabel = 'Upgrade plan →',
  blurPx = 6,
}: {
  children: ReactNode
  title?: string
  message?: string
  ctaLabel?: string
  blurPx?: number
}) {
  return (
    <div className="relative">
      {/* The real content, but blurred and non-interactive. aria-hidden so
          screen readers don't announce nonsense numbers. */}
      <div
        aria-hidden
        className="select-none pointer-events-none"
        style={{ filter: `blur(${blurPx}px)`, opacity: 0.85 }}
      >
        {children}
      </div>

      {/* Soft gradient over the bottom so the blur fades into the CTA card.
          Light mode: white veil. Dark mode: near-black veil so the fade
          matches the page background. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none
                   bg-gradient-to-b from-white/40 via-white/70 to-white
                   dark:from-[#0a0a0c]/40 dark:via-[#0a0a0c]/70 dark:to-[#0a0a0c]"
      />

      {/* The CTA card, centered */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="bg-white border border-amber-300 shadow-xl rounded-2xl px-6 py-6 max-w-md text-center
                        dark:bg-[#16161b] dark:border-amber-500/40 dark:shadow-2xl dark:shadow-amber-500/10">
          <div className="text-3xl mb-2">🔒</div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            {message ??
              "You're seeing your real numbers — just blurred. Upgrade to read them, sort, filter, and export to CSV."}
          </p>
          <Link
            href="/my/upgrade"
            className="inline-block bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-md
                       dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
