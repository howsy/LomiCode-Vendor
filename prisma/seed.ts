import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_VENDOR_EMAIL ?? 'admin@lomicode.local'
  const password = process.env.SEED_VENDOR_PASSWORD ?? 'ChangeMe!2026'
  const name = process.env.SEED_VENDOR_NAME ?? 'LomiCode Admin'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Vendor admin already exists: ${email}`)
  } else {
    const hash = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: { email, passwordHash: hash, name, role: 'vendor_admin' },
    })
    console.log(`Created vendor admin: ${email}`)
    console.log(`Password: ${password}`)
  }

  const planCount = await prisma.plan.count()
  if (planCount === 0) {
    // Three structured tiers. Feature flags read by:
    //   - heartbeat → POS gates QR-menu admin tab
    //   - QR menu route → returns 404 if !qr_menu
    //   - tenant self-service portal → gates report pages by report_account
    // Edit prices/limits later from /plans.
    await prisma.plan.createMany({
      data: [
        {
          name: 'Starter', currency: 'USD', sortOrder: 1,
          monthlyPrice: 25, sixMonthPrice: 135, yearlyPrice: 240, lifetimePrice: 499,
          featuresJson: {
            pos: true,
            qr_menu: false,
            report_account: false,
            max_devices: 1,
            max_tenant_users: 0,
          },
        },
        {
          name: 'Professional', currency: 'USD', sortOrder: 2,
          monthlyPrice: 60, sixMonthPrice: 324, yearlyPrice: 576, lifetimePrice: 1199,
          featuresJson: {
            pos: true,
            qr_menu: true,
            report_account: true,
            max_devices: 1,
            max_tenant_users: 2,
          },
        },
        {
          name: 'Enterprise', currency: 'USD', sortOrder: 3,
          monthlyPrice: 150, sixMonthPrice: 810, yearlyPrice: 1440, lifetimePrice: 2999,
          featuresJson: {
            pos: true,
            qr_menu: true,
            report_account: true,
            max_devices: 10,
            max_tenant_users: 10,
          },
        },
      ],
    })
    console.log('Seeded 3 plans (Starter / Professional / Enterprise). Edit features from /plans.')
  }

  // Vendor-wide defaults
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const defaults: Record<string, string> = {
    // Built-in /pay page handles all three methods (Card / Super Qi / Zain Cash)
    // until the operator wires a real external checkout.
    purchase_url_template: `${baseUrl}/pay?plan_id={plan_id}&period={period}&fp={fingerprint}&device_uuid={device_uuid}`,
    enable_trial: 'true',
    trial_days: '7',
    webhook_secret: cryptoRandom(48),
  }
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.vendorSetting.upsert({
      where: { key }, update: {}, create: { key, value },
    })
  }
  console.log('Vendor settings ensured.')
}

function cryptoRandom(n: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
  let out = ''
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
