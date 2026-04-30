import { addDays, addMonths, addYears } from 'date-fns'
import type { BillingPeriod } from '@prisma/client'

export function periodToExpiry(period: BillingPeriod, start: Date, trialDays = 7): Date {
  switch (period) {
    case 'trial':     return addDays(start, trialDays)
    case 'monthly':   return addMonths(start, 1)
    case 'six_month': return addMonths(start, 6)
    case 'yearly':    return addYears(start, 1)
    case 'lifetime':  return new Date('2099-12-31')
  }
}

export function priceForPeriod(plan: any, period: BillingPeriod): number {
  switch (period) {
    case 'monthly':   return Number(plan.monthlyPrice ?? 0)
    case 'six_month': return Number(plan.sixMonthPrice ?? 0)
    case 'yearly':    return Number(plan.yearlyPrice ?? 0)
    case 'lifetime':  return Number(plan.lifetimePrice ?? 0)
    default:          return 0
  }
}

export function isValidPeriod(p: string): p is BillingPeriod {
  return ['trial', 'monthly', 'six_month', 'yearly', 'lifetime'].includes(p)
}
