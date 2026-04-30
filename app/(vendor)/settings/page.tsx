import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { getSetting, setSetting } from '@/lib/vendorSettings'
import { PageHeader, Card, PrimaryButton } from '@/components/ui'

async function saveSettings(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const updates: Record<string, string> = {
    purchase_url_template: String(formData.get('purchase_url_template') ?? '').trim(),
    enable_trial: formData.get('enable_trial') === 'on' ? 'true' : 'false',
    trial_days: String(parseInt(String(formData.get('trial_days') ?? '7'), 10) || 7),
    grace_days: String(parseInt(String(formData.get('grace_days') ?? '7'), 10) || 7),
  }
  for (const [key, value] of Object.entries(updates)) {
    await setSetting(key, value)
  }
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'vendor.settings.update', payloadJson: updates as any },
  })
  revalidatePath('/settings')
}

async function rotateWebhookSecret() {
  'use server'
  const session = await requireVendor()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
  let secret = ''
  for (let i = 0; i < 48; i++) secret += chars[Math.floor(Math.random() * chars.length)]
  await setSetting('webhook_secret', secret)
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'vendor.webhook_secret.rotate' },
  })
  revalidatePath('/settings')
}

export default async function SettingsPage() {
  await requireVendor()
  const [purchaseUrl, enableTrial, trialDays, graceDays, webhookSecret] = await Promise.all([
    getSetting('purchase_url_template', ''),
    getSetting('enable_trial', 'true'),
    getSetting('trial_days', '7'),
    getSetting('grace_days', '7'),
    getSetting('webhook_secret', ''),
  ])

  return (
    <>
      <PageHeader title="Vendor settings" hint="Global controls for activation, trials, and the checkout webhook." />

      <Card className="mb-6">
        <form action={saveSettings} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default checkout URL template</label>
            <input
              name="purchase_url_template"
              defaultValue={purchaseUrl}
              placeholder="http://localhost:3000/pay?plan_id={plan_id}&period={period}&fp={fingerprint}&device_uuid={device_uuid}"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Used by every plan that does not have its own URL. Built-in <code>/pay</code> page handles
              Card / Super Qi / Zain Cash by default; switch to a custom URL when you wire a real
              payment provider. Tokens:
              <code className="mx-1">{'{plan_id}'}</code><code className="mx-1">{'{period}'}</code>
              <code className="mx-1">{'{fingerprint}'}</code><code className="mx-1">{'{device_uuid}'}</code>
              <code className="mx-1">{'{amount}'}</code><code className="mx-1">{'{currency}'}</code>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="enable_trial" defaultChecked={enableTrial !== 'false' && enableTrial !== ''} />
              Enable 7-day trial
            </label>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Trial days</label>
              <input name="trial_days" type="number" min="1" max="90" defaultValue={trialDays}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subscription grace days</label>
              <input name="grace_days" type="number" min="0" max="60" defaultValue={graceDays}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <PrimaryButton type="submit">Save settings</PrimaryButton>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Checkout webhook secret</h2>
        <p className="text-sm text-slate-600 mb-3">
          Your external checkout site sends payment results to{' '}
          <code className="bg-slate-100 px-1 rounded">POST /api/v1/license/provision</code> with this
          secret in the <code className="bg-slate-100 px-1 rounded">X-Vendor-Secret</code> header.
        </p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Current secret</label>
          <input
            value={webhookSecret}
            readOnly
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono bg-slate-50"
          />
        </div>
        <form action={rotateWebhookSecret}>
          <button type="submit" className="text-sm text-red-600 hover:underline">
            Rotate secret (will invalidate any checkout integration)
          </button>
        </form>
      </Card>
    </>
  )
}
