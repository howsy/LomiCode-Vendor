import Link from 'next/link'
import type { ReactNode } from 'react'
import SignOutButton from './SignOutButton'
import ThemeToggle from './ThemeToggle'

export type NavItem = { href: string; label: string; icon?: string }

// Optional branding shown in the sidebar header. When the tenant uploads a
// logo from the POS, it lands here and gives the report account a more
// personal feel — the cashier's restaurant identity instead of generic
// "LomiCode / Restaurant".
export type ShellBrand = {
  logoUrl?: string | null
  name?: string | null
  brandColor?: string | null
}

export default function DashboardShell({
  title,
  user,
  nav,
  brand,
  children,
}: {
  title: string
  user: { name: string; email: string; role: string }
  nav: NavItem[]
  brand?: ShellBrand
  children: ReactNode
}) {
  const showLogo = !!brand?.logoUrl
  const displayName = brand?.name?.trim() || title

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col
                        dark:bg-[#0d0d10] dark:border-white/[0.06]">
        <div className="px-5 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-3">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand!.logoUrl!}
              alt={displayName}
              className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-white/[0.08] shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
              style={{
                background: brand?.brandColor
                  ? `linear-gradient(135deg, ${brand.brandColor}, ${brand.brandColor}b3)`
                  : 'linear-gradient(135deg, #0f766e, #0f766e99)',
              }}
            >
              {(displayName.trim().charAt(0) || 'L').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-accent-600 font-semibold dark:text-emerald-300">
              LomiCode
            </div>
            <div className="text-base font-semibold mt-0.5 truncate text-slate-900 dark:text-white" title={displayName}>
              {displayName}
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-5 py-2 text-sm
                         text-slate-700 hover:bg-slate-100
                         dark:text-slate-300 dark:hover:bg-white/[0.04] dark:hover:text-white
                         transition-colors"
            >
              {item.icon && <span className="text-base">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-200 dark:border-white/[0.06] text-xs text-slate-500 dark:text-slate-400">
          <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{user.name}</div>
          <div className="truncate">{user.email}</div>
          <div className="mt-1 inline-block px-2 py-0.5 rounded
                          bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600
                          dark:bg-white/[0.06] dark:text-slate-300">
            {user.role}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto bg-slate-50 dark:bg-[#0a0a0c]">{children}</main>
    </div>
  )
}
