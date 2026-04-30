#!/bin/sh
# Production entrypoint. Applies pending Prisma migrations against the
# real DATABASE_URL on every container start. `migrate deploy` is the
# production-safe path: it only runs already-committed migration files,
# never asks for input, and exits non-zero if anything is wrong — so a
# bad migration fails the container before it accepts traffic.
set -e

if [ -z "$SKIP_DB_MIGRATE" ]; then
  echo "[entrypoint] applying database migrations…"
  npx --yes prisma migrate deploy
else
  echo "[entrypoint] SKIP_DB_MIGRATE=1 — skipping migrations"
fi

echo "[entrypoint] starting Next.js server on :${PORT:-3000}"
exec "$@"
