'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Item = { id: string; name: string; price: number; imageUrl: string | null }
type Section = { id: string; name: string; items: Item[] }

const STRINGS = {
  en: {
    menu: 'Menu',
    poweredBy: 'Powered by LomiCode',
    branch: 'Branch',
    noItems: 'No items in this category yet.',
    empty: 'This menu is being prepared. Check back soon.',
    search: 'Search the menu…',
    noResults: 'Nothing matches that.',
    itemsCount_one: '{{count}} item',
    itemsCount_other: '{{count}} items',
    close: 'Close',
    theme_light: 'Light',
    theme_dark: 'Dark',
    address: 'Address',
    phone: 'Phone',
  },
  ar: {
    menu: 'القائمة',
    poweredBy: 'مدعوم من LomiCode',
    branch: 'الفرع',
    noItems: 'لا توجد أصناف في هذه الفئة بعد.',
    empty: 'القائمة قيد التحضير. عاود الزيارة قريباً.',
    search: 'ابحث في القائمة…',
    noResults: 'لا نتائج مطابقة.',
    itemsCount_one: 'صنف {{count}}',
    itemsCount_other: '{{count}} أصناف',
    close: 'إغلاق',
    theme_light: 'فاتح',
    theme_dark: 'داكن',
    address: 'العنوان',
    phone: 'الهاتف',
  },
  ku: {
    menu: 'مێنیو',
    poweredBy: 'پاڵپشتی LomiCode',
    branch: 'لقی',
    noItems: 'هیچ بەرهەمێک نییە لەم بەشە.',
    empty: 'مێنیو ئامادە دەکرێت. دواتر سەردانی بکەرەوە.',
    search: 'گەڕان لە مێنیو…',
    noResults: 'هیچ ئەنجامێک نەدۆزرایەوە.',
    itemsCount_one: '{{count}} بەرهەم',
    itemsCount_other: '{{count}} بەرهەم',
    close: 'داخستن',
    theme_light: 'ڕووناک',
    theme_dark: 'تاریک',
    address: 'ناونیشان',
    phone: 'تەلەفۆن',
  },
} as const

type Lang = keyof typeof STRINGS

// Module-level CSS string, injected via dangerouslySetInnerHTML to keep
// React from HTML-escaping characters like `"` (which it does on the
// server-rendered html but not on hydration, causing a mismatch).
const MENU_STYLES = `
  @keyframes menuFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes menuSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes menuFadeOnly { from { opacity: 0; } to { opacity: 1; } }
  .menu-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: transform 220ms cubic-bezier(.2,.8,.2,1), box-shadow 220ms ease, border-color 200ms ease;
    animation: menuFadeIn 360ms ease both;
    will-change: transform;
  }
  .menu-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px -12px rgba(0,0,0,.18), 0 6px 12px -6px rgba(0,0,0,.08);
    border-color: rgba(var(--brand-rgb), .3);
  }
  .menu-card:active { transform: translateY(-1px); }
  .menu-img {
    aspect-ratio: 4 / 3;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    position: relative;
  }
  .menu-chip {
    flex-shrink: 0;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    background: var(--surface2);
    color: var(--text);
    white-space: nowrap;
    transition: background 160ms ease, color 160ms ease, transform 120ms ease;
  }
  .menu-chip:hover { transform: translateY(-1px); }
  .menu-chip-active {
    background: var(--brand);
    color: #fff;
    box-shadow: 0 6px 14px -6px rgba(var(--brand-rgb), .55);
  }
  .menu-search {
    width: 100%;
    padding: 13px 18px 13px 46px;
    font-size: 15px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    color: var(--text);
    outline: none;
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .menu-search:focus {
    border-color: rgba(var(--brand-rgb), .55);
    box-shadow: 0 0 0 4px rgba(var(--brand-rgb), .12);
  }
  [dir="rtl"] .menu-search { padding: 13px 46px 13px 18px; }
  .modal-backdrop {
    position: fixed; inset: 0;
    background: var(--overlay);
    backdrop-filter: blur(4px);
    z-index: 50;
    animation: menuFadeOnly 200ms ease both;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
  }
  @media (min-width: 720px) {
    .modal-backdrop { align-items: center; padding: 24px; }
  }
  .modal-card {
    background: var(--surface);
    width: 100%;
    max-width: 540px;
    border-radius: 24px 24px 0 0;
    overflow: hidden;
    animation: menuSlideUp 280ms cubic-bezier(.2,.8,.2,1) both;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 720px) {
    .modal-card { border-radius: 24px; }
  }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { scrollbar-width: none; }
`

// Hex (#rrggbb) → "r, g, b" string for use in rgba()/CSS variables.
function hexToRgb(hex: string): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return '249, 115, 22'
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export default function MenuClient({
  slug, tenantName, tagline, logoUrl, brandColor,
  branches, branchId, lang, dir, sections, orphanItems,
}: {
  slug: string
  tenantName: string
  tagline: string | null
  logoUrl: string | null
  brandColor: string
  branches: { id: string; name: string; address: string | null }[]
  branchId: string | null
  lang: Lang
  dir: 'ltr' | 'rtl'
  sections: Section[]
  orphanItems: Item[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const t = STRINGS[lang]
  const brandRgb = useMemo(() => hexToRgb(brandColor), [brandColor])

  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [activeSection, setActiveSection] = useState<string | null>(sections[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [openItem, setOpenItem] = useState<Item | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // Persist + restore theme preference per tenant
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(`menu-theme-${slug}`)) as 'light' | 'dark' | null
    if (saved === 'light' || saved === 'dark') setTheme(saved)
    else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) setTheme('dark')
  }, [slug])
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(`menu-theme-${slug}`, theme)
  }, [theme, slug])

  // Highlight the section currently in view as the user scrolls
  useEffect(() => {
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          setActiveSection(visible[0].target.id.replace('section-', ''))
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: 0 }
    )
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  // Auto-scroll active category chip into view inside the sticky strip
  const navStripRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!activeSection || !navStripRef.current) return
    const chip = navStripRef.current.querySelector<HTMLElement>(`[data-cat="${activeSection}"]`)
    if (!chip) return
    chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeSection])

  // Close item modal on Esc
  useEffect(() => {
    if (!openItem) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenItem(null) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [openItem])

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') params.delete(k); else params.set(k, v)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  // Filter every section by the search query (matches name, case-insensitive,
  // ignores diacritics by collapsing to NFKD then dropping marks).
  const norm = useCallback((s: string) =>
    s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(), [])
  const q = norm(query)
  const filteredSections = useMemo(() => {
    if (!q) return sections
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => norm(i.name).includes(q)) }))
      .filter((s) => s.items.length > 0)
  }, [sections, q, norm])
  const filteredOrphans = useMemo(() => {
    if (!q) return orphanItems
    return orphanItems.filter((i) => norm(i.name).includes(q))
  }, [orphanItems, q, norm])

  const totalItems = sections.reduce((n, s) => n + s.items.length, 0) + orphanItems.length
  const empty = totalItems === 0
  const noResults = !empty && q && filteredSections.length === 0 && filteredOrphans.length === 0

  // Dark/light palette derived from theme — using CSS variables so the
  // entire tree picks up theme changes via re-render-free CSS.
  const palette = theme === 'dark'
    ? { bg: '#0b0b0e', surface: '#16161b', surface2: '#1f1f26', text: '#f5f5f7', subtle: '#a3a3ad', border: 'rgba(255,255,255,.08)', overlayBg: 'rgba(0,0,0,.7)' }
    : { bg: '#fafaf7', surface: '#ffffff', surface2: '#f5f3ee', text: '#171717', subtle: '#6b6b6b', border: 'rgba(0,0,0,.06)', overlayBg: 'rgba(0,0,0,.55)' }

  return (
    <div
      dir={dir}
      lang={lang}
      style={{
        minHeight: '100vh',
        background: palette.bg,
        color: palette.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        ['--brand' as any]: brandColor,
        ['--brand-rgb' as any]: brandRgb,
        ['--surface' as any]: palette.surface,
        ['--surface2' as any]: palette.surface2,
        ['--text' as any]: palette.text,
        ['--subtle' as any]: palette.subtle,
        ['--border' as any]: palette.border,
        ['--overlay' as any]: palette.overlayBg,
        transition: 'background-color 200ms ease, color 200ms ease',
      }}
    >
      {/* dangerouslySetInnerHTML bypasses React's text-content serialization,
          which otherwise HTML-escapes the `"` inside `[dir="rtl"]` on the
          server but not on the client — causing a hydration mismatch. */}
      <style dangerouslySetInnerHTML={{ __html: MENU_STYLES }} />

      {/* Hero header */}
      <header style={{
        position: 'relative',
        padding: '38px 20px 26px',
        background: theme === 'dark'
          ? `linear-gradient(165deg, rgba(${brandRgb}, .14) 0%, transparent 60%)`
          : `linear-gradient(165deg, rgba(${brandRgb}, .12) 0%, transparent 60%)`,
        borderBottom: `1px solid ${palette.border}`,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt={tenantName}
              style={{
                width: 64, height: 64, borderRadius: 18, objectFit: 'cover',
                boxShadow: '0 10px 24px -8px rgba(0,0,0,.18)',
                border: `1px solid ${palette.border}`,
              }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: `linear-gradient(135deg, ${brandColor}, rgba(${brandRgb}, .6))`,
              color: '#fff', display: 'grid', placeItems: 'center',
              fontSize: 26, fontWeight: 800,
              boxShadow: '0 10px 24px -8px rgba(0,0,0,.18)',
            }}>
              {tenantName.trim().charAt(0).toUpperCase() || '🍽️'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
              color: brandColor, fontWeight: 700, opacity: 0.95,
            }}>
              {t.menu}
            </div>
            <h1 style={{
              fontSize: 30, fontWeight: 800, color: palette.text,
              margin: '4px 0 0', lineHeight: 1.05, letterSpacing: '-0.025em',
            }}>
              {tenantName}
            </h1>
            {tagline && (
              <div style={{ fontSize: 14, color: palette.subtle, marginTop: 4, lineHeight: 1.4 }}>
                {tagline}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <ThemeToggle theme={theme} onChange={setTheme} t={t} />
            <LanguageSwitcher current={lang} onChange={(l) => navigate({ lang: l === 'en' ? null : l })} />
          </div>
        </div>

        {/* Branch picker (if more than one branch) */}
        {branches.length > 1 && (
          <div style={{ maxWidth: 1100, margin: '20px auto 0' }}>
            <label style={{
              fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5,
              color: palette.subtle, fontWeight: 600,
            }}>
              {t.branch}
            </label>
            <select
              value={branchId ?? ''}
              onChange={(e) => navigate({ branch: e.target.value || null })}
              style={{
                display: 'block', marginTop: 6,
                background: palette.surface, border: `1px solid ${palette.border}`,
                borderRadius: 12, padding: '10px 14px',
                fontSize: 14, fontWeight: 500,
                minWidth: 220, color: palette.text,
                outline: 'none',
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.address ? ` — ${b.address}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search bar */}
        {!empty && (
          <div style={{ maxWidth: 1100, margin: '20px auto 0', position: 'relative' }}>
            <SearchIcon dir={dir} subtle={palette.subtle} />
            <input
              type="search"
              className="menu-search"
              placeholder={t.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t.search}
            />
          </div>
        )}
      </header>

      {/* Sticky category strip */}
      {!empty && filteredSections.length > 0 && (
        <nav style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: theme === 'dark' ? 'rgba(11,11,14,0.85)' : 'rgba(250,250,247,0.85)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${palette.border}`,
        }}>
          <div ref={navStripRef} className="scrollbar-hide" style={{
            maxWidth: 1100, margin: '0 auto',
            display: 'flex', gap: 8, padding: '12px 20px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            {filteredSections.map((s) => (
              <button
                key={s.id}
                data-cat={s.id}
                onClick={() => {
                  const el = sectionRefs.current[s.id]
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`menu-chip ${activeSection === s.id ? 'menu-chip-active' : ''}`}
              >
                {s.name}
                <span style={{
                  marginInlineStart: 8,
                  fontSize: 11, fontWeight: 700,
                  opacity: activeSection === s.id ? 0.85 : 0.6,
                }}>
                  {s.items.length}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>
        {empty && (
          <div style={{
            padding: '90px 20px', textAlign: 'center',
            color: palette.subtle, fontSize: 16,
          }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>🍽️</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: palette.text, marginBottom: 6 }}>
              {tenantName}
            </div>
            <div>{t.empty}</div>
          </div>
        )}

        {noResults && (
          <div style={{
            padding: '70px 20px', textAlign: 'center',
            color: palette.subtle, fontSize: 16,
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔎</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: palette.text }}>
              {t.noResults}
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>"{query}"</div>
          </div>
        )}

        {filteredSections.map((s) => (
          <section
            key={s.id}
            id={`section-${s.id}`}
            ref={(el) => { sectionRefs.current[s.id] = el }}
            style={{ scrollMarginTop: 76, paddingTop: 28 }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <h2 style={{
                fontSize: 24, fontWeight: 800, color: palette.text,
                margin: 0, letterSpacing: '-0.02em',
              }}>
                {s.name}
              </h2>
              <span style={{ fontSize: 13, color: palette.subtle, fontWeight: 500 }}>
                {s.items.length === 1
                  ? t.itemsCount_one.replace('{{count}}', '1')
                  : t.itemsCount_other.replace('{{count}}', String(s.items.length))}
              </span>
            </div>
            {s.items.length === 0 ? (
              <p style={{ color: palette.subtle, fontSize: 14 }}>{t.noItems}</p>
            ) : (
              <ItemGrid items={s.items} brandColor={brandColor} subtle={palette.subtle} text={palette.text} onOpen={setOpenItem} />
            )}
          </section>
        ))}

        {filteredOrphans.length > 0 && (
          <section style={{ paddingTop: 28 }}>
            <h2 style={{
              fontSize: 24, fontWeight: 800, color: palette.text,
              marginBottom: 16, letterSpacing: '-0.02em',
            }}>
              More
            </h2>
            <ItemGrid items={filteredOrphans} brandColor={brandColor} subtle={palette.subtle} text={palette.text} onOpen={setOpenItem} />
          </section>
        )}
      </main>

      <footer style={{
        textAlign: 'center', padding: '28px 20px 36px',
        color: palette.subtle, fontSize: 11, letterSpacing: 0.6,
      }}>
        {t.poweredBy}
      </footer>

      {/* Item detail modal */}
      {openItem && (
        <div
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setOpenItem(null) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-modal-title"
        >
          <div className="modal-card">
            <div style={{
              position: 'relative',
              aspectRatio: '4 / 3',
              background: openItem.imageUrl
                ? `url(${openItem.imageUrl}) center/cover no-repeat`
                : `linear-gradient(135deg, rgba(${brandRgb},.85), rgba(${brandRgb},.5))`,
            }}>
              {!openItem.imageUrl && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'grid', placeItems: 'center',
                  fontSize: 96, fontWeight: 800, color: '#fff',
                  opacity: 0.85,
                }}>
                  {openItem.name.trim().charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <button
                onClick={() => setOpenItem(null)}
                aria-label={t.close}
                style={{
                  position: 'absolute', top: 14, insetInlineEnd: 14,
                  width: 36, height: 36, borderRadius: 999,
                  background: 'rgba(255,255,255,.95)', color: '#171717',
                  border: 'none', cursor: 'pointer', fontSize: 20,
                  display: 'grid', placeItems: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '22px 24px 28px', overflowY: 'auto' }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', gap: 18,
              }}>
                <h3 id="item-modal-title" style={{
                  fontSize: 22, fontWeight: 800, margin: 0,
                  letterSpacing: '-0.015em', color: palette.text, lineHeight: 1.25,
                }}>
                  {openItem.name}
                </h3>
                <div style={{
                  flexShrink: 0,
                  background: brandColor, color: '#fff',
                  fontSize: 16, fontWeight: 700,
                  padding: '8px 14px', borderRadius: 999,
                  whiteSpace: 'nowrap',
                  boxShadow: `0 6px 14px -4px rgba(${brandRgb},.55)`,
                }}>
                  {openItem.price.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemGrid({
  items, brandColor, subtle, text, onOpen,
}: {
  items: Item[]
  brandColor: string
  subtle: string
  text: string
  onOpen: (item: Item) => void
}) {
  return (
    <div style={{
      display: 'grid', gap: 16,
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
    }}>
      {items.map((it, i) => (
        <ItemCard
          key={it.id}
          item={it}
          brandColor={brandColor}
          subtle={subtle}
          text={text}
          onOpen={onOpen}
          delay={Math.min(i * 40, 320)}
        />
      ))}
    </div>
  )
}

function ItemCard({
  item, brandColor, subtle, text, onOpen, delay,
}: {
  item: Item
  brandColor: string
  subtle: string
  text: string
  onOpen: (item: Item) => void
  delay: number
}) {
  const initial = item.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <article
      className="menu-card"
      onClick={() => onOpen(item)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item) } }}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="menu-img" style={{
        backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : 'none',
        background: !item.imageUrl
          ? `linear-gradient(135deg, ${brandColor}, rgba(var(--brand-rgb), .55))`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {!item.imageUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'grid', placeItems: 'center',
            fontSize: 64, fontWeight: 800, color: '#fff', opacity: 0.85,
            textShadow: '0 2px 12px rgba(0,0,0,.18)',
          }}>
            {initial}
          </div>
        )}
        {/* Bottom gradient for legibility behind the price chip */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,.18) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 12, insetInlineEnd: 12,
          background: 'rgba(255,255,255,0.96)',
          color: '#171717', fontSize: 13.5, fontWeight: 700,
          padding: '6px 12px', borderRadius: 999,
          boxShadow: '0 4px 14px rgba(0,0,0,.12)',
          backdropFilter: 'blur(6px)',
        }}>
          {item.price.toLocaleString()}
        </div>
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          fontSize: 15.5, fontWeight: 600, lineHeight: 1.3,
          color: text, letterSpacing: '-0.005em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {item.name}
        </div>
      </div>
    </article>
  )
}

function ThemeToggle({
  theme, onChange, t,
}: {
  theme: 'light' | 'dark'
  onChange: (next: 'light' | 'dark') => void
  t: typeof STRINGS[Lang]
}) {
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => onChange(next)}
      aria-label={next === 'dark' ? t.theme_dark : t.theme_light}
      style={{
        width: 38, height: 38, borderRadius: 999,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        cursor: 'pointer', fontSize: 16,
        display: 'grid', placeItems: 'center',
        transition: 'transform 120ms ease, background 160ms ease',
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = '')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

function LanguageSwitcher({ current, onChange }: { current: Lang; onChange: (l: Lang) => void }) {
  const opts: { id: Lang; label: string }[] = [
    { id: 'en', label: 'EN' },
    { id: 'ar', label: 'عربي' },
    { id: 'ku', label: 'کوردی' },
  ]
  return (
    <div style={{
      display: 'inline-flex', gap: 2,
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 999, padding: 3,
    }}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          style={{
            padding: '7px 12px', borderRadius: 999, border: 'none',
            background: current === o.id ? 'var(--surface)' : 'transparent',
            boxShadow: current === o.id ? '0 1px 4px rgba(0,0,0,.10)' : 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            color: current === o.id ? 'var(--text)' : 'var(--subtle)',
            transition: 'background 140ms ease, color 140ms ease',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SearchIcon({ dir, subtle }: { dir: 'ltr' | 'rtl'; subtle: string }) {
  return (
    <svg
      width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={subtle} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{
        position: 'absolute',
        top: '50%', transform: 'translateY(-50%)',
        [dir === 'rtl' ? 'right' : 'left']: 16,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <circle cx={11} cy={11} r={7} />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
