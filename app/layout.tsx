import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'LomiCode Vendor Admin',
  description: 'Manage subscriptions, reports, and updates for the LomiCode Restaurant POS.',
}

// Pre-paint theme script. Runs synchronously before React hydrates so
// users never see a flash of the wrong theme. Defaults to `dark` when no
// preference is stored — matches the marketing site's aesthetic and
// makes a fresh visit feel branded.
const THEME_BOOTSTRAP = `
  (function() {
    try {
      var m = localStorage.getItem('lomicode-theme') || 'dark';
      var sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var d = m === 'dark' || (m === 'system' && sys);
      if (d) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
