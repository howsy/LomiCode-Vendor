// One-time recovery codes for 2FA. The user is shown plaintext codes ONCE
// at enrollment / regeneration time; the DB only ever stores bcrypt hashes
// so a leaked DB doesn't compromise the codes.

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Same alphabet as TOTP secrets, formatted XXXX-XXXX-XX for readability.
// 10 base32 chars = 50 bits of entropy, plenty for a one-time bypass.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function randomCode(): string {
  const bytes = crypto.randomBytes(10)
  let raw = ''
  for (let i = 0; i < 10; i++) raw += ALPHABET[bytes[i] % ALPHABET.length]
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`
}

export async function generateRecoveryCodes(n = 8): Promise<{
  plain: string[]
  hashes: string[]
}> {
  const plain = Array.from({ length: n }, () => randomCode())
  // bcrypt rounds=8 is enough for 8 codes — they're high-entropy random,
  // not user passwords. Higher rounds just slow login.
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 8)))
  return { plain, hashes }
}

// Try to match `input` against any stored hash. If one matches, return the
// remaining hashes (caller persists them) so the consumed code can't be
// reused. `ok: false` if nothing matched.
export async function consumeRecoveryCode(
  stored: string[],
  input: string,
): Promise<{ ok: boolean; remaining: string[] }> {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, '')
  if (!cleaned) return { ok: false, remaining: stored }
  for (let i = 0; i < stored.length; i++) {
    if (await bcrypt.compare(cleaned, stored[i])) {
      const remaining = [...stored.slice(0, i), ...stored.slice(i + 1)]
      return { ok: true, remaining }
    }
  }
  return { ok: false, remaining: stored }
}

// Cheap shape detector so the login form can route a 6-digit string to
// verifyTotp() and an XXXX-XXXX-XX-shaped string to consumeRecoveryCode().
export function looksLikeRecoveryCode(input: string): boolean {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, '')
  return /^[A-Z2-7]{4}-?[A-Z2-7]{4}-?[A-Z2-7]{2}$/.test(cleaned)
}
