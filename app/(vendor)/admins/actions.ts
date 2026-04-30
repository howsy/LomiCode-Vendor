'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { requireVendorSuper } from '@/lib/guard'
import type { UserRole } from '@prisma/client'

const VENDOR_ROLES: UserRole[] = ['vendor_admin', 'vendor_support', 'vendor_super']

// 16-char alphanumeric password — easy to copy by hand and high-entropy.
function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(16)
  let out = ''
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

// Server-side: every mutation re-checks vendor_super to defend against
// CSRF + role-changing-under-our-feet. The page guard isn't enough.

export async function createAdmin(formData: FormData) {
  const session = await requireVendorSuper()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name  = String(formData.get('name')  ?? '').trim()
  const role  = String(formData.get('role')  ?? 'vendor_admin') as UserRole
  const generate = formData.get('generate_password') === 'on'
  const explicitPassword = String(formData.get('password') ?? '')

  if (!email || !name) return { error: 'Email and name are required' }
  if (!VENDOR_ROLES.includes(role)) return { error: 'Invalid role' }
  if (!generate && explicitPassword.length < 8) {
    return { error: 'Password must be at least 8 characters (or check "generate")' }
  }

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) return { error: 'A user with that email already exists' }

  const password = generate ? randomPassword() : explicitPassword
  const hash = await bcrypt.hash(password, 10)
  const created = await prisma.user.create({
    data: {
      email, name, role,
      passwordHash: hash,
      // Always force a change after creation — the super-admin shouldn't
      // know the new admin's permanent password.
      mustChangePassword: true,
    },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'admin.create',
      targetType: 'user', targetId: created.id,
      payloadJson: { email, name, role, generated: generate },
    },
  })
  revalidatePath('/admins')
  return { ok: true, generatedPassword: generate ? password : null, userId: created.id }
}

export async function editAdmin(formData: FormData) {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const role = String(formData.get('role') ?? 'vendor_admin') as UserRole

  if (!id || !name) return { error: 'Missing fields' }
  if (!VENDOR_ROLES.includes(role)) return { error: 'Invalid role' }
  if (id === session.user.id) return { error: 'You cannot edit your own role here. Use /account.' }

  // Last-super-standing protection: refuse to demote the only vendor_super.
  if (role !== 'vendor_super') {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (target?.role === 'vendor_super') {
      const count = await prisma.user.count({ where: { role: 'vendor_super' } })
      if (count <= 1) return { error: 'Cannot demote the last super-admin.' }
    }
  }

  await prisma.user.update({ where: { id }, data: { name, role } })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'admin.update',
      targetType: 'user', targetId: id, payloadJson: { name, role },
    },
  })
  revalidatePath('/admins')
  return { ok: true }
}

export async function resetAdminPassword(formData: FormData) {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing user id' }
  if (id === session.user.id) return { error: 'Use /account to change your own password.' }

  const password = randomPassword()
  const hash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id },
    data: { passwordHash: hash, mustChangePassword: true },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'admin.password_reset',
      targetType: 'user', targetId: id,
    },
  })
  revalidatePath('/admins')
  return { ok: true, password }
}

export async function reset2FA(formData: FormData) {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing user id' }
  if (id === session.user.id) return { error: 'Use /account to manage your own 2FA.' }

  await prisma.user.update({
    where: { id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryCodes: undefined,
    },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'admin.2fa_reset',
      targetType: 'user', targetId: id,
    },
  })
  revalidatePath('/admins')
  return { ok: true }
}

export async function toggle2FARequired(formData: FormData) {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  const required = formData.get('required') === '1'
  if (!id) return { error: 'Missing user id' }
  if (id === session.user.id) return { error: 'Use /account to manage your own 2FA.' }

  await prisma.user.update({ where: { id }, data: { totpRequired: required } })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'admin.2fa_required_toggle',
      targetType: 'user', targetId: id, payloadJson: { required },
    },
  })
  revalidatePath('/admins')
  return { ok: true }
}

export async function toggleActive(formData: FormData) {
  const session = await requireVendorSuper()
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === '1'
  if (!id) return { error: 'Missing user id' }
  if (id === session.user.id) return { error: 'You cannot deactivate yourself.' }

  // Last-super-standing protection: refuse to deactivate the only super.
  if (!active) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (target?.role === 'vendor_super') {
      const activeCount = await prisma.user.count({
        where: { role: 'vendor_super', isActive: true },
      })
      if (activeCount <= 1) return { error: 'Cannot deactivate the last active super-admin.' }
    }
  }

  await prisma.user.update({ where: { id }, data: { isActive: active } })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id, action: 'admin.active_toggle',
      targetType: 'user', targetId: id, payloadJson: { active },
    },
  })
  revalidatePath('/admins')
  return { ok: true }
}
