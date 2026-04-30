import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { PageHeader, Card, Empty, PrimaryButton, Badge } from '@/components/ui'

async function createOrUpdatePlan(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const id = String(formData.get('id') ?? '').trim() || null
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const features = {
    pos: true,                                                  // every plan includes the POS app
    qr_menu: formData.get('feat_qr_menu') === 'on',
    report_account: formData.get('feat_report_account') === 'on',
    max_devices: Math.max(1, parseInt(String(formData.get('feat_max_devices') ?? '1'), 10) || 1),
    max_tenant_users: Math.max(0, parseInt(String(formData.get('feat_max_tenant_users') ?? '0'), 10) || 0),
  }
  const data = {
    name,
    currency: String(formData.get('currency') ?? 'USD').trim().toUpperCase(),
    monthlyPrice:  numOrNull(formData.get('monthlyPrice')),
    sixMonthPrice: numOrNull(formData.get('sixMonthPrice')),
    yearlyPrice:   numOrNull(formData.get('yearlyPrice')),
    lifetimePrice: numOrNull(formData.get('lifetimePrice')),
    purchaseUrlTemplate: String(formData.get('purchaseUrlTemplate') ?? '').trim() || null,
    sortOrder: parseInt(String(formData.get('sortOrder') ?? '0'), 10) || 0,
    isActive: formData.get('isActive') === 'on',
    featuresJson: features,
  }
  if (id) {
    await prisma.plan.update({ where: { id }, data })
    await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: 'plan.update', targetType: 'plan', targetId: id, payloadJson: data as any } })
  } else {
    const p = await prisma.plan.create({ data })
    await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: 'plan.create', targetType: 'plan', targetId: p.id, payloadJson: data as any } })
  }
  revalidatePath('/plans')
}

async function deletePlan(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  // Soft-disable rather than hard delete (subscriptions reference it)
  await prisma.plan.update({ where: { id }, data: { isActive: false } })
  await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: 'plan.disable', targetType: 'plan', targetId: id } })
  revalidatePath('/plans')
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export default async function PlansPage() {
  await requireVendor()
  const plans = await prisma.plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })

  return (
    <>
      <PageHeader title="Plans"
        hint="Define the plans the POS chooser shows. Leave a price empty to hide that period." />

      <Card className="mb-8">
        <h2 className="font-semibold mb-3">Add a new plan</h2>
        <PlanForm />
      </Card>

      {plans.length === 0 ? (
        <Empty>No plans yet — add the first one above.</Empty>
      ) : (
        <div className="grid gap-4">
          {plans.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-lg">{p.name}</h2>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.currency} · sort {p.sortOrder} ·{' '}
                    {p.isActive ? <Badge tone="green">active</Badge> : <Badge tone="slate">disabled</Badge>}
                  </div>
                </div>
                <form action={deletePlan}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-xs text-red-600 hover:underline" type="submit">Disable</button>
                </form>
              </div>
              <PlanForm initial={p} />
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function PlanForm({ initial }: { initial?: any }) {
  return (
    <form action={createOrUpdatePlan} className="grid grid-cols-3 gap-3">
      <input type="hidden" name="id" defaultValue={initial?.id ?? ''} />
      <Field label="Name" name="name" required defaultValue={initial?.name ?? ''} />
      <Field label="Currency" name="currency" defaultValue={initial?.currency ?? 'USD'} />
      <Field label="Sort order" name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0} />

      <Field label="Monthly price" name="monthlyPrice" type="number" step="0.01" defaultValue={initial?.monthlyPrice ?? ''} />
      <Field label="6-month price" name="sixMonthPrice" type="number" step="0.01" defaultValue={initial?.sixMonthPrice ?? ''} />
      <Field label="Yearly price" name="yearlyPrice" type="number" step="0.01" defaultValue={initial?.yearlyPrice ?? ''} />
      <Field label="Lifetime price (one-time)" name="lifetimePrice" type="number" step="0.01" defaultValue={initial?.lifetimePrice ?? ''} />

      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Per-plan checkout URL (optional — overrides global)</label>
        <input
          name="purchaseUrlTemplate"
          defaultValue={initial?.purchaseUrlTemplate ?? ''}
          placeholder="https://lomicode.com/buy?plan={plan_id}&period={period}&fp={fingerprint}"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
        />
        <div className="text-[11px] text-slate-500 mt-1">
          Tokens: <code>{'{plan_id}'}</code> <code>{'{period}'}</code> <code>{'{fingerprint}'}</code>{' '}
          <code>{'{device_uuid}'}</code> <code>{'{amount}'}</code> <code>{'{currency}'}</code>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
        <input type="checkbox" name="isActive" defaultChecked={initial ? initial.isActive : true} />
        Active (shown in POS chooser)
      </label>

      <div className="col-span-3 mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Included features</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex items-center gap-2 text-slate-700">
            <input type="checkbox" disabled checked />
            POS app <span className="text-slate-400">(always included)</span>
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            <input type="checkbox" name="feat_qr_menu"
              defaultChecked={!!initial?.featuresJson?.qr_menu} />
            QR Menu
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            <input type="checkbox" name="feat_report_account"
              defaultChecked={!!initial?.featuresJson?.report_account} />
            Report account (tenant self-service portal)
          </label>
          <div></div>
          <label className="text-xs">
            <span className="block text-slate-600 font-medium mb-1">Max POS devices</span>
            <input type="number" min="1" max="50" name="feat_max_devices"
              defaultValue={initial?.featuresJson?.max_devices ?? 1}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="text-xs">
            <span className="block text-slate-600 font-medium mb-1">Max tenant users</span>
            <input type="number" min="0" max="50" name="feat_max_tenant_users"
              defaultValue={initial?.featuresJson?.max_tenant_users ?? 0}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5" />
          </label>
        </div>
      </div>

      <div className="col-span-3 mt-2">
        <PrimaryButton type="submit">{initial ? 'Save changes' : '+ Create plan'}</PrimaryButton>
      </div>
    </form>
  )
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input {...rest} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
    </div>
  )
}
