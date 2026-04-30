// Public route group — no auth, no admin chrome.
// Customer-facing pages (QR menu, etc.) live under /(public)/...
// Inherits the root layout's SessionProvider, but pages don't read session.

import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
