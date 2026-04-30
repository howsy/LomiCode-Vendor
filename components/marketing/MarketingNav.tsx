'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// Sticky top nav for the marketing site. Stays transparent until the user
// scrolls past ~24px, then fades in a translucent blurred background so
// content stays readable underneath.

export default function MarketingNav({
  dashHref,
  dashLabel,
}: {
  dashHref: string
  dashLabel: string
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={[
        'fixed top-0 inset-x-0 z-50 transition-all duration-200',
        scrolled
          ? 'border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      ].join(' ')}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center text-slate-900 text-xs font-black shadow-lg shadow-emerald-500/20">
            L
          </div>
          <span className="font-semibold tracking-tight text-white">LomiCode</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-slate-300">
          <Link href="/#products" className="hover:text-white transition-colors">Products</Link>
          <Link href="/#features" className="hover:text-white transition-colors">Why us</Link>
          <Link href="/#contact" className="hover:text-white transition-colors">Contact</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={dashHref}
            className="text-sm font-medium px-4 py-1.5 rounded-md bg-white text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {dashLabel}
          </Link>
        </div>
      </div>
    </header>
  )
}
