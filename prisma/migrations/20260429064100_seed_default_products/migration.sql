-- Seed the three founding products so the marketing site has something to
-- show on the very first deploy. The vendor_super can edit / add more from
-- /products. Idempotent: skipped if any product with that slug already
-- exists, so re-applying the migration on an environment where someone
-- has already curated the catalogue is a no-op.

INSERT INTO "products" (
  "id", "slug", "name", "tagline", "description",
  "icon_emoji", "accent_color", "features_json",
  "cta_label", "cta_url", "sort_order", "is_published",
  "created_at", "updated_at"
)
SELECT * FROM (VALUES
  (
    gen_random_uuid()::text,
    'restaurant-pos',
    'Restaurant POS',
    'Lightning-fast point of sale, built for the kitchen and the cashier.',
    'A native desktop POS designed for restaurants. Multi-language menus (Arabic, Kurdish, English), dual-printer receipt + kitchen ticket workflow, table management with cleaning states, per-cashier reporting, and offline-first SQLite storage that syncs to the cloud whenever the network is available.',
    '🍽️',
    '#0f766e',
    '[
      {"title":"Offline-first","description":"Cashiers keep working when the internet drops. Orders sync the moment connectivity returns."},
      {"title":"Dual printer support","description":"Send receipts to the cashier printer and kitchen tickets to the line — silent, instant, no preview window."},
      {"title":"Multi-language menus","description":"Items, categories and receipts in Arabic, Kurdish and English with a per-cashier language toggle."},
      {"title":"Per-cashier reports","description":"Revenue, ticket count, average ticket — by cashier, by day, by item, exportable to CSV."}
    ]'::jsonb,
    'Sign in',
    '/login',
    10,
    true,
    NOW(), NOW()
  ),
  (
    gen_random_uuid()::text,
    'qr-menu',
    'QR Menu',
    'Customer-facing menus that update the moment your POS does.',
    'Diners scan a QR code at the table and see your live menu — with photos, multilingual names, and prices that match exactly what your cashiers are charging. Disable an item in the POS, it disappears from the QR menu within a minute. Switch to your dinner menu, and the QR menu switches with you.',
    '📱',
    '#7c3aed',
    '[
      {"title":"Live sync from POS","description":"Update items, prices, photos in the POS — the QR menu reflects them in under a minute, no extra publish step."},
      {"title":"Multi-menu support","description":"Build Lunch, Dinner and Ramadan menus. Switch the active one in the POS and the QR follows."},
      {"title":"Beautiful by default","description":"Modern theme with optional dark mode, search, and an item-detail view. Branded with your logo and colour."},
      {"title":"Customer language picker","description":"Diners choose Arabic, Kurdish or English — the menu rerenders without a refresh."}
    ]'::jsonb,
    'See sample',
    '/menu/demo',
    20,
    true,
    NOW(), NOW()
  ),
  (
    gen_random_uuid()::text,
    'reports-portal',
    'Reports Portal',
    'Self-service analytics for restaurant owners — without a spreadsheet in sight.',
    'A web portal where restaurant owners log in and see their own sales — revenue by day, top items, performance by cashier, downloadable CSVs. Plus a built-in upgrade flow so your customers can extend their plan without picking up the phone.',
    '📊',
    '#dc2626',
    '[
      {"title":"Owner-only access","description":"Each restaurant has its own portal user. They see their data and only their data — enforced server-side."},
      {"title":"Revenue, items, cashiers","description":"Three core reports, a date-range picker, CSV export with totals on every grid."},
      {"title":"Self-service upgrades","description":"Owners pick a plan and a billing period and provision themselves — no support ticket required."},
      {"title":"Plan-aware features","description":"QR menu, reports, multi-device — each gated by the active subscription tier so upgrades pay for themselves."}
    ]'::jsonb,
    'Owner sign in',
    '/login',
    30,
    true,
    NOW(), NOW()
  )
) AS new_products(
  id, slug, name, tagline, description,
  icon_emoji, accent_color, features_json,
  cta_label, cta_url, sort_order, is_published,
  created_at, updated_at
)
WHERE NOT EXISTS (
  SELECT 1 FROM "products" WHERE "products"."slug" = new_products.slug
);
