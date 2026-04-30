import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSetting } from '@/lib/vendorSettings'

export const dynamic = 'force-dynamic'   // ← Add this line

// Unauthenticated. The POS calls this on the activation chooser to show the
// list of available plans, the trial settings, and the buy URL template.
export async function GET() {
  const [plans, purchaseUrl, enableTrial, trialDays] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    getSetting('purchase_url_template', ''),
    getSetting('enable_trial', 'true'),
    getSetting('trial_days', '7'),
  ])
  return NextResponse.json({
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      currency: p.currency,
      monthly: p.monthlyPrice ? Number(p.monthlyPrice) : null,
      six_month: p.sixMonthPrice ? Number(p.sixMonthPrice) : null,
      yearly: p.yearlyPrice ? Number(p.yearlyPrice) : null,
      lifetime: p.lifetimePrice ? Number(p.lifetimePrice) : null,
      purchase_url_template: p.purchaseUrlTemplate || purchaseUrl || null,
      features: p.featuresJson ?? {},
    })),
    trial: {
      enabled: enableTrial !== 'false' && enableTrial !== '',
      days: parseInt(trialDays, 10) || 7,
    },
  })
}