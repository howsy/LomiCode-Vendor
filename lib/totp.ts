// RFC 6238 TOTP — pure Node, no external deps.
//
// Used by the 2FA flow:
//   - generateSecret() at enrollment time
//   - otpauthUrl(secret, label) for the authenticator-app QR
//   - verifyTotp(secret, token) on every login (and at the enrollment
//     "verify before enabling" step)
//
// Algorithm: HMAC-SHA1 over a big-endian 8-byte counter (= unix time / 30),
// dynamic truncation per RFC 4226, modulo 10^6 for a 6-digit code.

import crypto from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

// 20 bytes (160 bits) is the SHA1 HMAC block size and the conventional
// length recommended by RFC 4226. Encode as Base32 so authenticator apps
// can ingest it directly.
export function generateSecret(): string {
  const bytes = crypto.randomBytes(20)
  return base32Encode(bytes)
}

// `label` is the visible name in the authenticator app (typically the
// user's email). `issuer` is also shown. Spaces become "%20" — the URL is
// turned into a QR by the caller (we keep this lib server-only).
export function otpauthUrl(
  secret: string,
  label: string,
  issuer = 'LomiCode Admin',
): string {
  const enc = encodeURIComponent
  const labelStr = `${enc(issuer)}:${enc(label)}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${labelStr}?${params.toString()}`
}

// Allow the previous and next steps too — clocks drift, and a code that
// arrives right at the boundary of a 30s step is still valid.
export function verifyTotp(
  secret: string,
  token: string,
  windowSteps = 1,
): boolean {
  if (!secret || !token) return false
  const cleaned = token.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(cleaned)) return false
  const key = base32Decode(secret)
  const step = Math.floor(Date.now() / 1000 / STEP_SECONDS)
  for (let w = -windowSteps; w <= windowSteps; w++) {
    if (computeCode(key, step + w) === cleaned) return true
  }
  return false
}

function computeCode(key: Buffer, step: number): string {
  const counter = Buffer.alloc(8)
  // JS bitshifts are 32-bit, so split into hi/lo to write a 64-bit BE int.
  // For Date.now() / 30 the hi half is small but non-zero past 2106; do
  // it correctly anyway.
  let hi = Math.floor(step / 0x1_0000_0000)
  let lo = step >>> 0
  counter.writeUInt32BE(hi, 0)
  counter.writeUInt32BE(lo, 4)
  const hmac = crypto.createHmac('sha1', key).update(counter).digest()
  // Dynamic truncation (RFC 4226 §5.3)
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
     (hmac[offset + 3] & 0xff)
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0')
}

// ── Base32 (RFC 4648, no padding) ─────────────────────────────────────
// Authenticator apps expect uppercase A-Z2-7; we generate that and accept
// lowercase + whitespace on decode for friendlier manual-entry.

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  return out
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/\s+/g, '').toUpperCase().replace(/=+$/, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const ch of cleaned) {
    const i = BASE32_ALPHABET.indexOf(ch)
    if (i === -1) throw new Error('Invalid base32 character')
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}
