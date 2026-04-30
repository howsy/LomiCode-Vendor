import { randomBytes } from 'crypto'

// Format: LOMI-XXXX-XXXX-XXXX-XXXX (4 groups of 4, base32-ish chars)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion

export function generateLicenseKey(): string {
  const groups: string[] = []
  for (let g = 0; g < 4; g++) {
    const bytes = randomBytes(4)
    let group = ''
    for (let i = 0; i < 4; i++) group += ALPHABET[bytes[i] % ALPHABET.length]
    groups.push(group)
  }
  return `LOMI-${groups.join('-')}`
}

export function normalizeLicenseKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '')
}
