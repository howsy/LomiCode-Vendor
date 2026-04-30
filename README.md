# LomiCode Vendor Admin

Web app that manages subscriptions, reports, and updates for the LomiCode
Restaurant POS desktop app.

* Vendor operators log in to: create tenants, assign plans, mark invoices paid,
  watch device activity, and publish new POS releases.
* Tenant owners log in to: see their own sales / top items / per-cashier
  reports for any date range, and view their invoices.
* The desktop POS authenticates with a per-tenant license key and pushes
  data via `change_log` rows to `/api/v1/sync/push`.

## Stack

* **Next.js 14** (App Router, TypeScript) — UI + API in one project
* **Postgres 16** + **Prisma** for the database (control plane + tenant data mirror)
* **MinIO** (S3-compatible) for storing POS release `.exe` / `.yml` files
* **NextAuth** (credentials provider) with role-based middleware
* **Recharts** for the report charts

## Local setup

```bash
# 1. Bring up Postgres + MinIO + (one-shot) bucket creator
docker compose up -d

# 2. Install dependencies
npm install

# 3. Initialize the database schema
npm run prisma:migrate -- --name init
npm run prisma:generate

# 4. Seed the first vendor admin and three default plans
npm run seed

# 5. Run dev server
npm run dev
```

Open http://localhost:3000 — log in with the email / password printed by `seed`.

## How the POS connects

1. In the vendor admin, **Tenants → Create tenant** generates a license key
   shaped `LOMI-XXXX-XXXX-XXXX-XXXX`.
2. On the POS first run, the operator pastes that key into the **License setup**
   screen. The POS calls `POST /api/v1/license/activate`, registering the device.
3. From then on the POS:
   * `POST /api/v1/heartbeat` every 5 minutes (sets last-seen, returns
     subscription mode for the soft grace period banner)
   * `POST /api/v1/sync/push` every 30 seconds (and after each order placed),
     batching up to 500 `change_log` rows
   * `GET  /api/v1/updates/feed/latest.yml` from `electron-updater`

## Subscription enforcement

After a subscription expires, the heartbeat response returns:

* `mode: warn_expiring` — banner only (≤14 days before expiry)
* `mode: grace` — still operational (within `SUBSCRIPTION_GRACE_DAYS`, default 7)
* `mode: readonly` — POS prevents new orders; can still view existing data

Set the grace window in `.env`.

## Releases — pushing POS updates

1. Build a new POS release in the POS repo:
   `npm run build` — produces `release/*.exe` and `release/latest.yml`.
2. Open **Releases → Publish a new release** in the vendor admin.
3. Pick a channel (start with `beta`, then promote to `stable`), set mandatory
   if applicable, and paste release notes.
4. Move one tenant to the `beta` channel from the tenant detail page. They
   pull the new build on their next launch via `electron-updater`.
5. Once it looks good, switch the release to `stable` (or upload the same
   files on the `stable` channel) — all stable tenants pick it up.

## Useful links

* **MinIO console** — http://localhost:9001 (login: `lomicode` / `lomicode-secret`)
* **Prisma Studio** — `npm run prisma:studio`
* **Postgres** — `localhost:5432`, db `lomicode_admin`, user `lomicode`

## Project layout

```
app/
  (auth)/login              public sign-in
  (vendor)/                 vendor operator pages — tenants, subs, invoices,
                            devices, releases, activity
  (tenant)/                 restaurant-owner self-service — overview, sales,
                            top items, per-cashier, invoices
  api/
    auth/[...nextauth]
    v1/
      license/activate      POS first-run pairing
      heartbeat             POS keepalive + subscription mode
      sync/push             POS uploads change_log batches
      updates/check         legacy JSON check (POS-internal)
      updates/feed/[...]    electron-updater feed (latest.yml + binary)
      updates/download/[..] direct download (signed)
      tenant/reports/*.csv  CSV exports for tenant pages
lib/
  auth.ts                   NextAuth config + role helpers
  guard.ts                  requireVendor / requireTenant for server pages
  db.ts                     Prisma singleton
  license.ts                key generation / normalization
  posAuth.ts                Bearer-token auth helper for POS endpoints
  reports/                  SQL aggregations
  releases/storage.ts       MinIO/S3 wrapper
  sync/applier.ts           replays POS change_log into mirror tables
prisma/
  schema.prisma
  seed.ts
docker-compose.yml          Postgres + MinIO + bucket-init
```
