'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'lomicode-theme'

type Ctx = {
  mode: ThemeMode                 // user's choice (what's persisted)
  resolved: 'light' | 'dark'      // what's actually applied right now
  setMode: (m: ThemeMode) => void
}

const ThemeCtx = createContext<Ctx | null>(null)

// Resolve a user mode to an actual theme. system → check OS preference.
function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'dark'  // SSR default
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function applyToDOM(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  // Default 'dark' matches the pre-paint script in app/layout.tsx so the
  // SSR markup and the hydrated React state agree on first paint.
  const [mode, setModeState] = useState<ThemeMode>('dark')

  // Hydrate from localStorage once on mount. We can't read storage during
  // SSR, so the first paint comes from the pre-paint script; this just
  // syncs React's state to match.
  useEffect(() => {
    const stored = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) as ThemeMode | null
    const next: ThemeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
    setModeState(next)
    applyToDOM(resolve(next))
  }, [])

  // When mode === 'system', follow OS theme changes live.
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyToDOM(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  // Cross-tab sync — pick up changes the user made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const next = (e.newValue as ThemeMode) || 'dark'
      setModeState(next)
      applyToDOM(resolve(next))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    try { window.localStorage.setItem(STORAGE_KEY, m) } catch {}
    applyToDOM(resolve(m))
  }, [])

  const resolved = resolve(mode)

  return <ThemeCtx.Provider value={{ mode, resolved, setMode }}>{children}</ThemeCtx.Provider>
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx)
  if (!ctx) {
    // Allow components to use the hook outside the provider — falls back
    // to a no-op so SSR snapshots from non-wrapped trees don't crash.
    return { mode: 'dark', resolved: 'dark', setMode: () => {} }
  }
  return ctx
}
