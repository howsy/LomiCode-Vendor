// Server component that renders an SVG QR code for the public menu URL.
// Pure markup — small, scalable, copy-pasteable, prints crisply.

import QRCode from 'qrcode'
import Link from 'next/link'

export default async function MenuQR({
  slug, baseUrl, branchId, lang, size = 220, brandColor = '#0f766e',
}: {
  slug: string
  baseUrl?: string
  branchId?: string
  lang?: 'en' | 'ar' | 'ku'
  size?: number
  brandColor?: string
}) {
  const base = baseUrl ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const qs = new URLSearchParams()
  if (branchId) qs.set('branch', branchId)
  if (lang && lang !== 'en') qs.set('lang', lang)
  const url = `${base}/menu/${slug}${qs.toString() ? '?' + qs : ''}`

  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    color: { dark: brandColor, light: '#ffffff' },
    errorCorrectionLevel: 'M',
    width: size,
  })

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className="rounded-xl bg-white p-3 shadow-sm border border-slate-200"
        style={{ width: size + 24 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <Link
        href={url}
        target="_blank"
        className="font-mono text-xs text-slate-600 hover:text-accent-600 truncate max-w-[260px]"
      >
        {url.replace(/^https?:\/\//, '')}
      </Link>
    </div>
  )
}
