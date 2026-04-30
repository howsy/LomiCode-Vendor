// Tiny in-memory IP-based rate limiter. Survives until Next.js restarts —
// good enough for abuse mitigation; not a substitute for a real edge / WAF
// rule when this app moves behind a load balancer.

import { NextRequest, NextResponse } from 'next/server'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export type RateLimitOpts = {
  // bucket key prefix (so /trial and /by-fingerprint don't share a counter)
  key: string
  // requests allowed per windowMs
  limit: number
  // window in ms
  windowMs: number
}

export function rateLimit(req: NextRequest, opts: RateLimitOpts):
  | null                                          // allowed
  | NextResponse                                 // 429 response
{
  // Best effort to identify the caller. Behind a proxy (Vercel, Nginx, etc.)
  // forwarded headers should be trusted; in pure local dev we fall back to
  // the request URL so each test gets a unique-ish bucket.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const k = `${opts.key}:${ip}`
  const now = Date.now()
  let b = buckets.get(k)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + opts.windowMs }
    buckets.set(k, b)
  }
  b.count++

  // Best-effort GC so the map doesn't grow without bound. Triggered on
  // every call (cheap — just a Date.now check per entry).
  if (buckets.size > 1000) {
    for (const [bk, bv] of buckets) {
      if (bv.resetAt <= now) buckets.delete(bk)
    }
  }

  if (b.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
    return NextResponse.json(
      { error: 'rate_limited', retry_after: retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }
  return null
}
