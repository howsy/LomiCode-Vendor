'use client'

import { useTheme, type ThemeMode } from './ThemeProvider'

// Tiny icon-only toggle that cycles `dark → light → system → dark`.
// Hover-tooltip shows the current mode so users know what they're on
// without taking up sidebar real estate.

const ORDER: ThemeMode[] = ['dark', 'light', 'system']
const LABELS: Record<ThemeMode, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

function Icon({ mode }: { mode: ThemeMode }) {
  if (mode === 'dark') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
  }
  if (mode === 'light') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    )
  }
  // system
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 22h8M12 18v4" />
    </svg>
  )
}

export default function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      title={`Theme: ${LABELS[mode]} (click for ${LABELS[next]})`}
      aria-label={`Theme: ${LABELS[mode]}. Click to switch to ${LABELS[next]}.`}
      className="
        inline-flex items-center gap-1.5 text-[11px] font-medium
        px-2.5 py-1.5 rounded-md
        border border-slate-200 hover:bg-slate-50 text-slate-600
        dark:border-white/10 dark:hover:bg-white/5 dark:text-slate-300
        transition-colors
      "
    >
      <Icon mode={mode} />
      <span>{LABELS[mode]}</span>
    </button>
  )
}
