#!/bin/sh
# Production entrypoint. Runs every time the container starts and:
#
# 1. Generates a strong NEXTAUTH_SECRET on first boot if one isn't supplied,
#    persisting it to a volume so it survives container recreates.
# 2. Auto-detects whether DOMAIN points at a real hostname; if so and
#    NEXTAUTH_URL still has the localhost default, rewrite it to https.
# 3. Applies pending Prisma migrations against the live DB. `migrate
#    deploy` is the production-safe path: it only runs already-committed
#    migrations, never asks for input, and exits non-zero on a bad
#    migration so a broken release fails the container instead of going
#    live with a half-applied schema.
# 4. Conditionally seeds the first vendor admin if no users exist yet.

set -e

SECRETS_DIR="/app/.secrets"
mkdir -p "$SECRETS_DIR"

# ── 1. NEXTAUTH_SECRET ────────────────────────────────────────────────
# Per the NextAuth docs, this is the only secret that absolutely must be
# set in production. We treat empty / unset as "auto-generate", so users
# get a working install with zero config but can still override.
SECRET_FILE="$SECRETS_DIR/nextauth_secret"
if [ -z "$NEXTAUTH_SECRET" ]; then
  if [ ! -s "$SECRET_FILE" ]; then
    echo "[entrypoint] generating NEXTAUTH_SECRET (first boot)…"
    # node is in the runtime image; cheaper than apt-get install openssl.
    node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64"))' > "$SECRET_FILE"
  fi
  NEXTAUTH_SECRET="$(cat "$SECRET_FILE")"
  export NEXTAUTH_SECRET
fi

# ── 2. NEXTAUTH_URL auto-promotion ────────────────────────────────────
# When the operator only sets DOMAIN and leaves NEXTAUTH_URL untouched,
# the localhost placeholder breaks sign-in cookies. Promote to https
# automatically.
if [ "$NEXTAUTH_URL" = "http://localhost:3000" ] && [ -n "$DOMAIN" ] && [ "$DOMAIN" != ":80" ]; then
  NEXTAUTH_URL="https://$DOMAIN"
  export NEXTAUTH_URL
  echo "[entrypoint] NEXTAUTH_URL auto-set to $NEXTAUTH_URL"
fi

# ── 3. Database migrations ────────────────────────────────────────────
if [ -z "$SKIP_DB_MIGRATE" ]; then
  echo "[entrypoint] applying database migrations…"
  npx --yes prisma migrate deploy
else
  echo "[entrypoint] SKIP_DB_MIGRATE=1 — skipping migrations"
fi

# ── 4. First-boot seed ────────────────────────────────────────────────
# Only runs when the users table is empty, so it's safe on every restart.
# Without this the operator would have to remember to seed manually after
# the first deploy.
if [ -z "$SKIP_DB_SEED" ]; then
  echo "[entrypoint] checking for first-boot seed…"
  npx --yes tsx prisma/seed.ts || echo "[entrypoint] seed step skipped or failed (non-fatal)"
fi

echo "[entrypoint] starting Next.js server on :${PORT:-3000}"
exec "$@"
