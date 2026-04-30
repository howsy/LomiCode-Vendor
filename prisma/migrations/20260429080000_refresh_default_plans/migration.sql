-- Refresh the default plan catalogue with sensible prices, clearer feature
-- bundles, and real differentiation between tiers. Match by name so existing
-- tenant subscriptions (which reference plans by id) are NOT disrupted —
-- only the price/feature columns change. New rows are inserted if a tier
-- is missing.
--
-- Three tiers:
--   Starter      — POS only.                   $19/mo   $99/6mo   $189/yr
--   Professional — POS + QR + reports portal.  $49/mo   $249/6mo  $469/yr
--   Enterprise   — Everything + multi-device.  $99/mo   $499/6mo  $949/yr
--
-- Monthly is the easy entry; 6-month and yearly include real savings so the
-- customer sees a reason to commit. No lifetime tier in v1 — recurring
-- revenue is healthier and lifetime pricing is hard to get right early.

-- ── Starter ────────────────────────────────────────────────────────────
UPDATE "plans" SET
  "monthly_price" = 19.00,
  "six_month_price" = 99.00,
  "yearly_price" = 189.00,
  "lifetime_price" = NULL,
  "currency" = 'USD',
  "sort_order" = 10,
  "is_active" = true,
  "features_json" = jsonb_build_object(
    'pos', true,
    'qr_menu', false,
    'report_account', false,
    'max_devices', 1,
    'max_tenant_users', 0,
    'support_priority', false,
    'description', 'Native POS for one terminal. No QR menu, no reports portal.'
  )
WHERE LOWER("name") IN ('starter', 'plan 1', 'basic');

INSERT INTO "plans" ("id", "name", "currency", "monthly_price", "six_month_price", "yearly_price", "lifetime_price", "sort_order", "is_active", "features_json", "created_at")
SELECT gen_random_uuid()::text, 'Starter', 'USD', 19.00, 99.00, 189.00, NULL, 10, true,
       jsonb_build_object(
         'pos', true, 'qr_menu', false, 'report_account', false,
         'max_devices', 1, 'max_tenant_users', 0,
         'support_priority', false,
         'description', 'Native POS for one terminal. No QR menu, no reports portal.'
       ),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE LOWER("name") IN ('starter', 'plan 1', 'basic'));

-- ── Professional ──────────────────────────────────────────────────────
UPDATE "plans" SET
  "monthly_price" = 49.00,
  "six_month_price" = 249.00,
  "yearly_price" = 469.00,
  "lifetime_price" = NULL,
  "currency" = 'USD',
  "sort_order" = 20,
  "is_active" = true,
  "features_json" = jsonb_build_object(
    'pos', true,
    'qr_menu', true,
    'report_account', true,
    'max_devices', 2,
    'max_tenant_users', 3,
    'support_priority', false,
    'description', 'Adds the customer-facing QR menu and a self-service reports portal for the owner.'
  )
WHERE LOWER("name") IN ('professional', 'plan 2', 'pro');

INSERT INTO "plans" ("id", "name", "currency", "monthly_price", "six_month_price", "yearly_price", "lifetime_price", "sort_order", "is_active", "features_json", "created_at")
SELECT gen_random_uuid()::text, 'Professional', 'USD', 49.00, 249.00, 469.00, NULL, 20, true,
       jsonb_build_object(
         'pos', true, 'qr_menu', true, 'report_account', true,
         'max_devices', 2, 'max_tenant_users', 3,
         'support_priority', false,
         'description', 'Adds the customer-facing QR menu and a self-service reports portal for the owner.'
       ),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE LOWER("name") IN ('professional', 'plan 2', 'pro'));

-- ── Enterprise ────────────────────────────────────────────────────────
UPDATE "plans" SET
  "monthly_price" = 99.00,
  "six_month_price" = 499.00,
  "yearly_price" = 949.00,
  "lifetime_price" = NULL,
  "currency" = 'USD',
  "sort_order" = 30,
  "is_active" = true,
  "features_json" = jsonb_build_object(
    'pos', true,
    'qr_menu', true,
    'report_account', true,
    'max_devices', 10,
    'max_tenant_users', 10,
    'support_priority', true,
    'description', 'Multi-branch and multi-cashier — built for restaurants running several terminals at once.'
  )
WHERE LOWER("name") IN ('enterprise', 'plan 3', 'business');

INSERT INTO "plans" ("id", "name", "currency", "monthly_price", "six_month_price", "yearly_price", "lifetime_price", "sort_order", "is_active", "features_json", "created_at")
SELECT gen_random_uuid()::text, 'Enterprise', 'USD', 99.00, 499.00, 949.00, NULL, 30, true,
       jsonb_build_object(
         'pos', true, 'qr_menu', true, 'report_account', true,
         'max_devices', 10, 'max_tenant_users', 10,
         'support_priority', true,
         'description', 'Multi-branch and multi-cashier — built for restaurants running several terminals at once.'
       ),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE LOWER("name") IN ('enterprise', 'plan 3', 'business'));
