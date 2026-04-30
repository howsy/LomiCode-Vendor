import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Card, Badge, PrimaryButton, GhostButton, Empty } from '@/components/ui'
import MenuQR from '@/components/MenuQR'
import { addMonths, addYears } from 'date-fns'
import type { UpdateChannel, BillingPeriod } from '@prisma/client'

function periodToExpiry(period: BillingPeriod, start: Date): Date {
  switch (period) {
    case 'monthly':   return addMonths(start, 1)
    case 'six_month': return addMonths(start, 6)
    case 'yearly':    return addYears(start, 1)
    case 'lifetime':  return new Date('2099-12-31')
    case 'trial':     return addMonths(start, 0) // caller sets explicitly
  }
}

function priceForPeriod(plan: any, period: BillingPeriod): number {
  switch (period) {
    case 'monthly':   return Number(plan.monthlyPrice ?? 0)
    case 'six_month': return Number(plan.sixMonthPrice ?? 0)
    case 'yearly':    return Number(plan.yearlyPrice ?? 0)
    case 'lifetime':  return Number(plan.lifetimePrice ?? 0)
    default:          return 0
  }
}

// Replace the current subscription with a new one. Cancels any active/trial
// sub atomically before creating the new row, so a tenant always has at most
// one current subscription. Same action handles both the "first sub" case
// and the "switch plans / extend with different period" case.
async function replaceSubscription(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const planId = String(formData.get('planId'))
  const period = String(formData.get('period')) as BillingPeriod
  const startedAt = new Date()
  const expiresAt = periodToExpiry(period, startedAt)

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) throw new Error('Plan not found')

  const sub = await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { tenantId, status: { in: ['active', 'trial'] } },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })
    const created = await tx.subscription.create({
      data: { tenantId, planId, period, startedAt, expiresAt, status: 'active' },
    })
    const amount = priceForPeriod(plan, period)
    if (amount > 0) {
      await tx.invoice.create({
        data: {
          subscriptionId: created.id, tenantId,
          amount, currency: plan.currency, status: 'open',
        },
      })
    }
    return created
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'subscription.replace', targetType: 'subscription', targetId: sub.id, payloadJson: { planId, period } },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

// Push the current subscription's expiresAt forward by one period without
// creating a new row. Useful for "give them another month on the same plan".
async function extendSubscription(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const subId = String(formData.get('subId'))
  const period = String(formData.get('period')) as BillingPeriod
  const sub = await prisma.subscription.findUnique({ where: { id: subId }, include: { plan: true } })
  if (!sub || sub.tenantId !== tenantId) throw new Error('Subscription not found')
  // New expiry = whichever is later: existing expiresAt or now, then add the period
  const base = sub.expiresAt > new Date() ? sub.expiresAt : new Date()
  const newExpiry = periodToExpiry(period, base)
  await prisma.subscription.update({
    where: { id: subId },
    data: { expiresAt: newExpiry, status: 'active', cancelledAt: null },
  })
  if (sub.plan) {
    const amount = priceForPeriod(sub.plan, period)
    if (amount > 0) {
      await prisma.invoice.create({
        data: {
          subscriptionId: subId, tenantId,
          amount, currency: sub.plan.currency, status: 'open',
          note: `Extension: +${period}`,
        },
      })
    }
  }
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'subscription.extend', targetType: 'subscription', targetId: subId, payloadJson: { period, newExpiry: newExpiry.toISOString() } },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function deleteSubscription(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const subId = String(formData.get('subId'))
  // Only permit deletion of cancelled / expired subs to avoid accidentally
  // dropping an active customer's record.
  const sub = await prisma.subscription.findUnique({ where: { id: subId } })
  if (!sub || sub.tenantId !== tenantId) return
  if (sub.status === 'active' || sub.status === 'trial') {
    throw new Error('Cancel the subscription before deleting it.')
  }
  await prisma.invoice.deleteMany({ where: { subscriptionId: subId, status: { not: 'paid' } } })
  await prisma.subscription.delete({ where: { id: subId } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'subscription.delete', targetType: 'subscription', targetId: subId },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function deleteAllCancelled(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const cancelledIds = (await prisma.subscription.findMany({
    where: { tenantId, status: 'cancelled' },
    select: { id: true },
  })).map((s) => s.id)
  if (cancelledIds.length === 0) return
  await prisma.invoice.deleteMany({
    where: { subscriptionId: { in: cancelledIds }, status: { not: 'paid' } },
  })
  await prisma.subscription.deleteMany({ where: { id: { in: cancelledIds } } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'subscription.bulkDeleteCancelled', targetType: 'tenant', targetId: tenantId, payloadJson: { count: cancelledIds.length } },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function setChannel(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const channel = String(formData.get('channel')) as UpdateChannel
  const pinnedVersion = String(formData.get('pinnedVersion') ?? '').trim() || null
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { channel, pinnedVersion: channel === 'pinned' ? pinnedVersion : null },
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'tenant.channel.update', targetType: 'tenant', targetId: tenantId, payloadJson: { channel, pinnedVersion } },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function setTenantStatus(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const status = String(formData.get('status')) as 'active' | 'suspended' | 'cancelled'
  await prisma.tenant.update({ where: { id: tenantId }, data: { status } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: `tenant.${status}`, targetType: 'tenant', targetId: tenantId },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function cancelSubscription(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const subId = String(formData.get('subId'))
  await prisma.subscription.update({
    where: { id: subId },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'subscription.cancel', targetType: 'subscription', targetId: subId },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function toggleTenantUser(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const userId = String(formData.get('userId'))
  const u = await prisma.user.findUnique({ where: { id: userId } })
  if (!u) return
  await prisma.user.update({ where: { id: userId }, data: { isActive: !u.isActive } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: u.isActive ? 'user.disable' : 'user.enable', targetType: 'user', targetId: userId },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function deleteTenant(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const confirmName = String(formData.get('confirmName') ?? '').trim()
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return
  // Type-the-name confirmation to prevent accidents
  if (confirmName !== tenant.name) {
    throw new Error(`Confirmation mismatch — type "${tenant.name}" exactly to delete.`)
  }
  // Cascading deletes: subscriptions/invoices/devices/events/users via Prisma
  // onDelete:Cascade. Mirror tables also cascade.
  await prisma.tenant.delete({ where: { id: tenantId } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'tenant.delete', targetType: 'tenant', targetId: tenantId, payloadJson: { name: tenant.name } },
  })
  redirect('/tenants')
}

async function setMaxDevices(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const max = Math.max(1, parseInt(String(formData.get('maxDevices') ?? '1'), 10) || 1)
  await prisma.tenant.update({ where: { id: tenantId }, data: { maxDevices: max } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'tenant.maxDevices.update', targetType: 'tenant', targetId: tenantId, payloadJson: { maxDevices: max } },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function toggleDevice(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const deviceId = String(formData.get('deviceId'))
  const d = await prisma.device.findUnique({ where: { id: deviceId } })
  if (!d) return
  await prisma.device.update({ where: { id: deviceId }, data: { isActive: !d.isActive } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: d.isActive ? 'device.disable' : 'device.enable', targetType: 'device', targetId: deviceId },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function savePublicMenu(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const rawSlug = String(formData.get('publicSlug') ?? '').trim().toLowerCase()
  const slug = rawSlug
    ? rawSlug.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    : null
  const enabled = formData.get('publicMenuEnabled') === 'on'
  const brandColor = String(formData.get('brandColor') ?? '').trim() || null
  const logoUrl = String(formData.get('logoUrl') ?? '').trim() || null
  const tagline = String(formData.get('tagline') ?? '').trim() || null

  // Reject duplicate slug
  if (slug) {
    const taken = await prisma.tenant.findFirst({
      where: { publicSlug: slug, NOT: { id: tenantId } },
      select: { id: true },
    })
    if (taken) throw new Error(`Slug "${slug}" is already in use by another tenant`)
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      publicSlug: slug,
      publicMenuEnabled: enabled,
      brandColor, logoUrl, tagline,
    },
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'tenant.publicMenu.update', targetType: 'tenant', targetId: tenantId, payloadJson: { slug, enabled } },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function clearHardwareLock(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  await prisma.device.updateMany({
    where: { tenantId },
    data: { hardwareFingerprint: null },
  })
  await prisma.licenseClaim.deleteMany({ where: { tenantId } })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'tenant.hardware.unlock', targetType: 'tenant', targetId: tenantId },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

async function createTenantUser(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const tenantId = String(formData.get('tenantId'))
  const email = String(formData.get('email')).trim().toLowerCase()
  const name = String(formData.get('name')).trim()
  const password = String(formData.get('password'))
  const role = String(formData.get('role')) as 'tenant_owner' | 'tenant_staff'
  if (!email || !name || password.length < 6) return
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, name, passwordHash: hash, role, tenantId },
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'tenant.user.create', targetType: 'user', targetId: user.id, payloadJson: { email, role, tenantId } },
  })
  revalidatePath(`/tenants/${tenantId}`)
}

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  await requireVendor()
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      subscriptions: { orderBy: { startedAt: 'desc' }, include: { plan: true } },
      devices: { orderBy: { lastSeenAt: 'desc' } },
      users: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!tenant) notFound()
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  const ordersCount = await prisma.order.count({ where: { tenantId: tenant.id } })
  const revenue = await prisma.order.aggregate({
    where: { tenantId: tenant.id }, _sum: { total: true },
  })

  return (
    <>
      <PageHeader
        title={tenant.name}
        hint={`Activation token: ${tenant.licenseKey}`}
        actions={
          <Link href="/tenants" className="text-sm text-slate-600 hover:underline">← All tenants</Link>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500">Status</div>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={tenant.status === 'active' ? 'green' : tenant.status === 'suspended' ? 'amber' : 'red'}>{tenant.status}</Badge>
            <form action={setTenantStatus} className="inline">
              <input type="hidden" name="tenantId" value={tenant.id} />
              {tenant.status === 'active' ? (
                <button type="submit" name="status" value="suspended" className="text-xs text-amber-700 hover:underline ml-2">Suspend</button>
              ) : (
                <button type="submit" name="status" value="active" className="text-xs text-emerald-700 hover:underline ml-2">Re-activate</button>
              )}
            </form>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Suspending blocks POS sync and tenant logins immediately.
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500">Lifetime orders</div>
          <div className="text-2xl font-semibold mt-1">{ordersCount}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500">Lifetime revenue</div>
          <div className="text-2xl font-semibold mt-1">
            {Number(revenue._sum.total ?? 0).toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Subscription */}
      <SubscriptionPanel
        tenant={tenant}
        plans={plans}
        replaceAction={replaceSubscription}
        extendAction={extendSubscription}
        cancelAction={cancelSubscription}
        deleteAction={deleteSubscription}
        deleteAllCancelledAction={deleteAllCancelled}
      />

      {/* Update channel */}
      <Card className="mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Update channel</h2>
        <form action={setChannel} className="flex items-end gap-3">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
            <select name="channel" defaultValue={tenant.channel} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="stable">stable</option>
              <option value="beta">beta</option>
              <option value="pinned">pinned</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Pinned version (optional)</label>
            <input
              name="pinnedVersion"
              defaultValue={tenant.pinnedVersion ?? ''}
              placeholder="e.g. 1.2.3"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <PrimaryButton type="submit">Save</PrimaryButton>
        </form>
      </Card>

      {/* Public QR menu */}
      <Card className="mb-6">
        <h2 className="font-semibold text-slate-900 mb-1">Public QR menu</h2>
        <p className="text-sm text-slate-600 mb-3">
          Customer-facing menu, fed live by the POS sync. Print the URL as a QR code on the table.
        </p>
        {tenant.publicSlug && tenant.publicMenuEnabled && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-4 flex items-start justify-between gap-4">
            <div className="flex-1 text-sm">
              <div className="text-slate-700 mb-2">Live at: </div>
              <Link href={`/menu/${tenant.publicSlug}`} target="_blank" className="font-mono text-emerald-700 hover:underline block mb-3">
                /menu/{tenant.publicSlug}
              </Link>
              <Link href={`/menu/${tenant.publicSlug}`} target="_blank" className="text-sm text-accent-600 hover:underline">
                Open in new tab →
              </Link>
            </div>
            <MenuQR slug={tenant.publicSlug} brandColor={tenant.brandColor ?? '#0f766e'} size={160} />
          </div>
        )}
        <form action={savePublicMenu} className="grid grid-cols-2 gap-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Slug (URL handle)</label>
            <input name="publicSlug" defaultValue={tenant.publicSlug ?? ''}
              placeholder="downtown-grill"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" />
            <div className="text-[11px] text-slate-500 mt-1">Lowercase letters, numbers, dashes only.</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Brand color (hex)</label>
            <input name="brandColor" defaultValue={tenant.brandColor ?? ''} placeholder="#f97316"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL (optional)</label>
            <input name="logoUrl" defaultValue={tenant.logoUrl ?? ''} placeholder="https://…/logo.png"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tagline (optional)</label>
            <input name="tagline" defaultValue={tenant.tagline ?? ''} placeholder="Fresh daily."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="publicMenuEnabled" defaultChecked={tenant.publicMenuEnabled} />
            Enable public menu (uncheck to take it offline)
          </label>
          <div className="col-span-2"><PrimaryButton type="submit">Save menu settings</PrimaryButton></div>
        </form>
      </Card>

      {/* Device limits + hardware lock */}
      <Card className="mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Device limits</h2>
        <div className="grid grid-cols-2 gap-6">
          <form action={setMaxDevices} className="flex items-end gap-3">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Max active devices</label>
              <input
                name="maxDevices" type="number" min="1" max="50"
                defaultValue={tenant.maxDevices}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                License-activate will be refused once this many active devices exist.
                Default 1 = single-terminal license.
              </div>
            </div>
            <PrimaryButton type="submit">Save</PrimaryButton>
          </form>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hardware fingerprint</label>
            <p className="text-sm text-slate-600 mb-3">
              Clears the stored fingerprint on every device — use after a legitimate hardware swap.
              The next heartbeat re-binds to the new hardware automatically.
            </p>
            <form action={clearHardwareLock}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <button type="submit" className="text-sm text-red-600 hover:underline">Clear hardware lock</button>
            </form>
          </div>
        </div>
      </Card>

      {/* Devices */}
      <Card className="mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Devices ({tenant.devices.length})</h2>
        {tenant.devices.length === 0 ? (
          <div className="text-sm text-slate-500">No POS terminals have activated yet. Customers activate via Trial or Buy on the POS first-run screen.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2">Hostname</th>
                <th>Status</th>
                <th>Hardware FP</th>
                <th>App version</th>
                <th>OS</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenant.devices.map((d) => (
                <tr key={d.id} className={d.isActive ? '' : 'opacity-50'}>
                  <td className="py-2">{d.hostname ?? <span className="text-slate-400">—</span>}</td>
                  <td>
                    {d.isActive
                      ? <Badge tone="green">active</Badge>
                      : <Badge tone="red">disabled</Badge>}
                  </td>
                  <td className="font-mono text-xs text-slate-500">
                    {d.hardwareFingerprint ? d.hardwareFingerprint.slice(0, 18) + '…' : <span className="text-slate-400">unset</span>}
                  </td>
                  <td>{d.appVersion ?? '—'}</td>
                  <td>{d.os ?? '—'}</td>
                  <td className="text-slate-500">{d.lastSeenAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                  <td>
                    <form action={toggleDevice}>
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="deviceId" value={d.id} />
                      <button type="submit" className="text-xs text-slate-600 hover:underline">
                        {d.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Tenant users (self-service) */}
      <Card>
        <h2 className="font-semibold text-slate-900 mb-3">Tenant users (self-service login)</h2>
        {tenant.users.length === 0 ? (
          <div className="text-sm text-slate-500 mb-4">No tenant users yet — create one so the restaurant owner can log in to see their reports.</div>
        ) : (
          <table className="w-full text-sm mb-4">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenant.users.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                  <td className="py-2">{u.name}</td>
                  <td>{u.email}</td>
                  <td><Badge>{u.role}</Badge></td>
                  <td>
                    {u.isActive
                      ? <Badge tone="green">active</Badge>
                      : <Badge tone="red">disabled</Badge>}
                  </td>
                  <td>
                    <form action={toggleTenantUser}>
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="text-xs text-slate-600 hover:underline">
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={createTenantUser} className="grid grid-cols-5 gap-3 items-end">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input name="name" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input name="email" type="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input name="password" type="password" required minLength={6} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select name="role" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="tenant_owner">tenant_owner</option>
              <option value="tenant_staff">tenant_staff</option>
            </select>
          </div>
          <PrimaryButton type="submit">+ Create user</PrimaryButton>
        </form>
      </Card>

      {/* Danger zone */}
      <Card className="mt-8 border-red-200">
        <h2 className="font-semibold text-red-700 mb-1">Danger zone</h2>
        <p className="text-sm text-slate-600 mb-3">
          Permanently delete this tenant and everything attached to it
          (subscriptions, invoices, devices, users, mirrored orders, items, etc.).
          Use only to clean up duplicates or test data.
        </p>
        <form action={deleteTenant} className="flex items-end gap-3 flex-wrap">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Type <code className="bg-slate-100 px-1 rounded">{tenant.name}</code> to confirm
            </label>
            <input
              name="confirmName"
              required
              placeholder={tenant.name}
              className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <button type="submit"
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-2 rounded-md">
            Delete tenant permanently
          </button>
        </form>
      </Card>
    </>
  )
}

// ─── Subscription panel ───────────────────────────────────────────────
// Shows ONE current subscription card with three actions (Extend / Replace /
// Cancel) and collapsible history. Replaces the previous "add another row
// every click" UX that produced the duplicate mess.

function SubscriptionPanel({
  tenant, plans,
  replaceAction, extendAction, cancelAction, deleteAction, deleteAllCancelledAction,
}: any) {
  const subs = tenant.subscriptions as Array<any>
  const current = subs.find((s) => s.status === 'active' || s.status === 'trial')
  const history = subs.filter((s) => s !== current)
  const cancelledCount = subs.filter((s) => s.status === 'cancelled').length

  return (
    <Card className="mb-6">
      <h2 className="font-semibold text-slate-900 mb-3">Subscription</h2>

      {/* Current subscription */}
      {current ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">Current</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">
                {current.plan?.name ?? 'Trial'} <span className="text-sm text-slate-500 font-normal">· {current.period}</span>
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Started {current.startedAt.toISOString().slice(0, 10)} · Expires <strong>{current.expiresAt.toISOString().slice(0, 10)}</strong>
              </div>
              <div className="mt-1">
                <Badge tone={current.status === 'active' ? 'green' : 'amber'}>{current.status}</Badge>
              </div>
            </div>
            <form action={cancelAction}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="subId" value={current.id} />
              <button type="submit" className="text-sm text-red-600 hover:underline">Cancel</button>
            </form>
          </div>

          {/* Extend */}
          <form action={extendAction} className="flex items-end gap-3 mt-4 pt-4 border-t border-emerald-200">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="subId" value={current.id} />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Extend by</label>
              <select name="period" defaultValue={current.period} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="monthly">+1 month</option>
                <option value="six_month">+6 months</option>
                <option value="yearly">+1 year</option>
                <option value="lifetime">→ Lifetime</option>
              </select>
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded-md">
              Extend on same row
            </button>
            <span className="text-[11px] text-slate-500">Pushes the expiry date forward · doesn't add a duplicate row.</span>
          </form>
        </div>
      ) : (
        <div className="text-sm text-slate-500 mb-4 p-3 rounded bg-slate-50 border border-dashed border-slate-300">
          No active subscription. Use the form below to start one.
        </div>
      )}

      {/* Replace / start new */}
      <form action={replaceAction} className="flex items-end gap-3">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
          <select name="planId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {plans.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Period</label>
          <select name="period" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="monthly">Monthly</option>
            <option value="six_month">6 months</option>
            <option value="yearly">Yearly</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </div>
        <PrimaryButton type="submit">{current ? 'Replace current with new plan' : '+ Start subscription'}</PrimaryButton>
      </form>
      {current && (
        <div className="text-[11px] text-slate-500 mt-2">
          Replace cancels the current subscription and creates a new one. Use <em>Extend</em> above if you only want to push the expiry forward.
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">
            History ({history.length} previous subscription{history.length === 1 ? '' : 's'})
          </summary>
          <table className="w-full text-sm mt-3">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2">Plan</th><th>Period</th><th>Status</th><th>Started</th><th>Expires</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((s) => (
                <tr key={s.id} className="text-slate-600">
                  <td className="py-2">{s.plan?.name ?? 'Trial'}</td>
                  <td>{s.period}</td>
                  <td><Badge tone={s.status === 'active' ? 'green' : s.status === 'trial' ? 'amber' : 'slate'}>{s.status}</Badge></td>
                  <td>{s.startedAt.toISOString().slice(0, 10)}</td>
                  <td>{s.expiresAt.toISOString().slice(0, 10)}</td>
                  <td>
                    {(s.status === 'cancelled' || s.status === 'expired') && (
                      <form action={deleteAction}>
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="subId" value={s.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cancelledCount > 1 && (
            <form action={deleteAllCancelledAction} className="mt-3">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <button type="submit" className="text-xs text-red-600 hover:underline">
                Delete all {cancelledCount} cancelled subscriptions
              </button>
            </form>
          )}
        </details>
      )}
    </Card>
  )
}
