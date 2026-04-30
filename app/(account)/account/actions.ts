'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'
import { requireSession, requireSessionBypassGate } from '@/lib/guard'
import { generateSecret, otpauthUrl, verifyTotp } from '@/lib/totp'
import { generateRecoveryCodes, consumeRecoveryCode, looksLikeRecoveryCode } from '@/lib/recoveryCodes'

// Form-bound actions must return Promise<void> for Next.js's typed
// <form action> binding. We surface success/error via search params,
// rendered as a flash message at the top of /account.
function flash(target: string, kind: 'ok' | 'err', msg: string): never {
  const u = new URL(target, 'http://x')
  u.searchParams.set(kind, msg)
  redirect(u.pathname + (u.search ? u.search : ''))
}

// ── Profile ────────────────────────────────────────────────────────────
export async function updateProfile(formData: FormData): Promise<void> {
  const session = await requireSession()
  const name  = String(formData.get('name')  ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!name)  flash('/account', 'err', 'Name is required')
  if (!email) flash('/account', 'err', 'Email is required')

  // Email collision check (NextAuth uses email as the login identifier).
  const conflict = await prisma.user.findFirst({
    where: { email, id: { not: session.user.id } },
    select: { id: true },
  })
  if (conflict) flash('/account', 'err', 'Email already in use')

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email },
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'account.profile_update', payloadJson: { name, email } },
  })
  revalidatePath('/account')
  flash('/account', 'ok', 'Profile updated')
}

// ── Password change ────────────────────────────────────────────────────
// Used both for self-service ("Change password") and for the forced flow
// after a super-admin reset. The forced flow uses the bypass-gate session.
export async function changePassword(formData: FormData): Promise<void> {
  const isForced = formData.get('forced') === '1'
  const session = isForced ? await requireSessionBypassGate() : await requireSession()
  const current = String(formData.get('current_password') ?? '')
  const next    = String(formData.get('new_password')     ?? '')
  const confirm = String(formData.get('confirm_password') ?? '')

  // After a forced reset, the user must end up back on /account with the
  // mustChangePassword flag cleared. The shared `flash` helper redirects
  // to the right URL for both flows.
  const target = isForced ? '/account' : '/account'

  if (!current || !next || !confirm) flash(target, 'err', 'All fields are required')
  if (next !== confirm)               flash(target, 'err', 'New passwords do not match')
  if (next.length < 8)                flash(target, 'err', 'New password must be at least 8 characters')
  if (next === current)               flash(target, 'err', 'New password must be different from the current one')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) flash(target, 'err', 'User not found')
  const ok = await bcrypt.compare(current, user!.passwordHash)
  if (!ok) flash(target, 'err', 'Current password is incorrect')

  const hash = await bcrypt.hash(next, 10)
  await prisma.user.update({
    where: { id: user!.id },
    data: { passwordHash: hash, mustChangePassword: false },
  })
  await prisma.auditLog.create({
    data: { actorUserId: user!.id, action: 'account.password_change', payloadJson: { forced: isForced } },
  })
  revalidatePath('/account')
  flash(target, 'ok', 'Password changed')
}

// ── 2FA: begin enrollment ──────────────────────────────────────────────
// Generates a secret + QR data URL. We store the secret immediately so
// the verify step doesn't need to round-trip it through the form (and so
// a refresh on the verify page doesn't lose it). totpEnabled stays false
// until the user proves they have the secret with a valid 6-digit code.
export async function beginTotpEnrollment() {
  const session = await requireSessionBypassGate()
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return { error: 'User not found' }
  if (user.totpEnabled) return { error: '2FA is already enabled' }

  const secret = generateSecret()
  const url = otpauthUrl(secret, user.email)
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 })

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret },
  })

  return { ok: true, secret, qrDataUrl, otpauthUrl: url }
}

// ── 2FA: confirm enrollment ────────────────────────────────────────────
// Verifies the user can produce a current code, then flips totpEnabled,
// generates fresh recovery codes, and returns the plain codes ONCE.
export async function confirmTotpEnrollment(formData: FormData) {
  const session = await requireSessionBypassGate()
  const code = String(formData.get('code') ?? '').trim()

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !user.totpSecret) return { error: 'No 2FA setup in progress. Click Enable 2FA again.' }
  if (user.totpEnabled) return { error: '2FA already enabled' }
  if (!verifyTotp(user.totpSecret, code)) return { error: 'Invalid code. Try again.' }

  const { plain, hashes } = await generateRecoveryCodes()
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpRecoveryCodes: hashes as any },
  })
  await prisma.auditLog.create({
    data: { actorUserId: user.id, action: 'account.2fa_enable' },
  })

  revalidatePath('/account')
  return { ok: true, recoveryCodes: plain }
}

// ── 2FA: disable (self) ────────────────────────────────────────────────
// Form-bound — returns void via flash redirects. Errors land in
// /account?err=… which the page renders as a banner.
export async function disableTotp(formData: FormData): Promise<void> {
  const session = await requireSession()
  const password = String(formData.get('password') ?? '')
  const code     = String(formData.get('code')     ?? '').trim()

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) flash('/account', 'err', 'User not found')
  if (!user!.totpEnabled) flash('/account', 'err', '2FA is not enabled')

  // Super-admin set totpRequired — user can't self-disable. The toggle is
  // hidden in the UI but enforce it server-side too.
  if (user!.totpRequired) flash('/account', 'err', '2FA is required for your account by an administrator.')

  if (!await bcrypt.compare(password, user!.passwordHash)) flash('/account', 'err', 'Password is incorrect')
  // Require a current code OR recovery code so a stolen-but-unlocked
  // session can't disable 2FA outright.
  let codeOk = false
  if (looksLikeRecoveryCode(code)) {
    const stored = (user!.totpRecoveryCodes as string[] | null) ?? []
    const r = await consumeRecoveryCode(stored, code)
    codeOk = r.ok
  } else if (user!.totpSecret) {
    codeOk = verifyTotp(user!.totpSecret, code)
  }
  if (!codeOk) flash('/account', 'err', 'Invalid code')

  await prisma.user.update({
    where: { id: user!.id },
    data: { totpEnabled: false, totpSecret: null, totpRecoveryCodes: undefined },
  })
  await prisma.auditLog.create({
    data: { actorUserId: user!.id, action: 'account.2fa_disable' },
  })
  revalidatePath('/account')
  flash('/account', 'ok', '2FA disabled')
}

// ── 2FA: regenerate recovery codes ─────────────────────────────────────
// Called imperatively from the RegenerateCodesCard client component, so
// it keeps a structured return: the new codes need to be shown once,
// which a redirect can't do.
export async function regenerateRecoveryCodes(formData: FormData) {
  const session = await requireSession()
  const password = String(formData.get('password') ?? '')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return { error: 'User not found' }
  if (!user.totpEnabled) return { error: '2FA is not enabled' }
  if (!await bcrypt.compare(password, user.passwordHash)) return { error: 'Password is incorrect' }

  const { plain, hashes } = await generateRecoveryCodes()
  await prisma.user.update({
    where: { id: user.id },
    data: { totpRecoveryCodes: hashes as any },
  })
  await prisma.auditLog.create({
    data: { actorUserId: user.id, action: 'account.2fa_recovery_regenerate' },
  })
  revalidatePath('/account')
  return { ok: true as const, recoveryCodes: plain }
}
