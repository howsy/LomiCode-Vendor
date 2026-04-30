-- Data migration: promote every existing vendor_admin to vendor_super.
-- Lives in a separate migration from the enum addition because Postgres
-- doesn't allow using a newly-added enum value in the same transaction
-- where ALTER TYPE ... ADD VALUE was executed.
--
-- Idempotent: only fires when no vendor_super exists yet, so re-running
-- migrate dev (or pulling this on a system where someone already promoted
-- a different user) is a safe no-op.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'vendor_super') THEN
    UPDATE "users" SET "role" = 'vendor_super' WHERE "role" = 'vendor_admin';
  END IF;
END $$;
