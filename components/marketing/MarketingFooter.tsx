import Link from 'next/link'

// Bottom-of-page footer. Lists every published product so visitors can
// reach detail pages even if they didn't see the showcase grid, plus the
// usual product / company / legal columns.

export default function MarketingFooter({
  products,
}: {
  products: { slug: string; name: string }[]
}) {
  const year = new Date().getFullYear()
  return (
    <footer id="contact" className="relative border-t border-white/5 bg-[#08080a] mt-12 px-6 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center text-slate-900 text-sm font-black shadow-lg shadow-emerald-500/20">
                L
              </div>
              <span className="font-semibold text-lg tracking-tight text-white">LomiCode</span>
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Software for the modern restaurant. Native POS, customer-facing menus,
              and self-service reports — built for the realities of operating in Iraq
              and the wider region.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-4">Products</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              {products.map((p) => (
                <li key={p.slug}>
                  <Link href={`/products/${p.slug}`} className="hover:text-white transition-colors">
                    {p.name}
                  </Link>
                </li>
              ))}
              {products.length === 0 && (
                <li className="text-slate-500">More soon.</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
              <li><a href="mailto:hello@lomicode.local" className="hover:text-white transition-colors">Contact us</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-500">
          <span>© {year} LomiCode. All rights reserved.</span>
          <span>Built with care in Iraq.</span>
        </div>
      </div>
    </footer>
  )
}
