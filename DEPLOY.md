# Deploying LomiCode Vendor Admin to a VPS

This stack runs entirely from `docker-compose.prod.yml`. Postgres, MinIO,
the Next.js app, and a Caddy reverse proxy with automatic HTTPS — no
extra runtime dependencies on the host.

---

## 0. Prerequisites

On your VPS (Ubuntu / Debian / Alma / etc.):

- **Docker Engine** with the Compose v2 plugin (`docker compose` — not the legacy `docker-compose`)
- A **domain name** pointing at the VPS public IP (`A` record, TTL 5 min while you test)
- Inbound **80** and **443** open in the firewall (`ufw allow 80,443/tcp`)

```bash
# One-liner Docker install on a fresh Ubuntu box
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # log out / back in to pick up the group
```

---

## 1. Get the code on the VPS

Pick whichever fits your workflow:

```bash
# Option A — clone (recommended; lets you `git pull` for upgrades)
git clone <your-repo-url> /opt/lomicode
cd /opt/lomicode

# Option B — rsync from your laptop
rsync -avz --exclude node_modules --exclude .next --exclude .env* \
  ./ ops@vps:/opt/lomicode/
```

---

## 2. Configure the environment

```bash
cd /opt/lomicode
cp .env.production.example .env.production
nano .env.production
```

You **must** fill these — the stack refuses to start otherwise:

| Variable | What |
|---|---|
| `DOMAIN` | `admin.example.com` — must already point at the VPS via DNS |
| `NEXTAUTH_URL` | `https://admin.example.com` (same domain, with `https://`) |
| `NEXTAUTH_SECRET` | run `openssl rand -base64 48` and paste |
| `POSTGRES_PASSWORD` | strong random string |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | strong random strings (used by both MinIO and the app) |
| `ADMIN_EMAIL` | your email — Let's Encrypt sends cert-expiry notices here |

Keep this file out of git. `.dockerignore` already excludes it from the build context.

---

## 3. First boot

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

What happens:

1. Postgres and MinIO start, then health-check green.
2. The Next.js image builds from `Dockerfile` (multi-stage, ~3 minutes the first time, ~30 seconds for incremental builds).
3. The app container's entrypoint runs `prisma migrate deploy` against the live database — **all migrations apply automatically**, including the seed migrations for default plans, products, and the super-admin promotion.
4. Caddy fetches a Let's Encrypt cert for your domain and starts proxying traffic.

Watch logs while it boots:

```bash
docker compose -f docker-compose.prod.yml logs -f
# narrow to one service:
docker compose -f docker-compose.prod.yml logs -f app
```

When `caddy` says `serving https://your-domain` and `app` says `Ready in …`, open your browser at `https://<DOMAIN>`.

---

## 4. Create the first admin user

The seed step doesn't run by default in production (you don't want a known seed password floating around). Run it manually once:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
  sh -c 'SEED_VENDOR_EMAIL="you@example.com" SEED_VENDOR_PASSWORD="$(openssl rand -base64 18)" SEED_VENDOR_NAME="You" npx tsx prisma/seed.ts'
```

The command prints the password it generated. Sign in immediately and change it from `/account`. (The data migrations also auto-promote any existing `vendor_admin` to `vendor_super`, so this user gets full powers.)

---

## 5. Routine operations

```bash
# Pull new code and rebuild only the app (Postgres / MinIO untouched)
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app

# Tail logs
docker compose -f docker-compose.prod.yml logs -f app

# Open a Postgres shell
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U lomicode -d lomicode_admin

# Apply migrations manually (entrypoint already does this on every start,
# but useful when troubleshooting)
docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
  npx prisma migrate deploy

# Stop everything (data volumes survive)
docker compose -f docker-compose.prod.yml down

# Stop AND wipe data — there is no undo
docker compose -f docker-compose.prod.yml down -v
```

---

## 6. Backups

Two volumes hold all stateful data: `lomicode_pg` (Postgres) and `lomicode_minio` (release files). Backup script:

```bash
#!/bin/bash
# Save under /opt/lomicode/backup.sh, then add to crontab:
#   0 3 * * * /opt/lomicode/backup.sh
set -e
cd /opt/lomicode
TS=$(date +%F-%H%M)
mkdir -p backups
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U lomicode lomicode_admin | gzip > backups/db-$TS.sql.gz
# MinIO data — straightforward tar of the volume
docker run --rm -v lomicode_minio:/data -v $PWD/backups:/out alpine \
  tar czf /out/minio-$TS.tar.gz -C /data .
# Keep the last 14 nightly backups
ls -1tr backups/db-*.sql.gz   | head -n -14 | xargs -r rm
ls -1tr backups/minio-*.tar.gz | head -n -14 | xargs -r rm
```

To restore:

```bash
gunzip -c backups/db-2026-04-30.sql.gz | docker compose -f docker-compose.prod.yml \
  --env-file .env.production exec -T postgres psql -U lomicode -d lomicode_admin
```

---

## 7. Wiring the POS into the deployed admin

Each restaurant's POS instance needs to know where the cloud lives. From any POS install:

1. **Settings → Cloud sync URL** → set to `https://<DOMAIN>`.
2. POS runs the activation chooser → picks Trial / Buy. The buy URL is built from `purchase_url_template` in **Vendor Admin → Settings**; for the canonical flow set:
   ```
   https://<DOMAIN>/pay?plan_id={plan_id}&period={period}&fp={fingerprint}&device_uuid={device_uuid}
   ```
3. Heartbeat + change-log push start automatically — the **Devices** page in the admin will show the new install within a minute.

The web tenant portal's upgrade flow doesn't use this template — it redirects to `/pay?tenant_id=…` directly, which works without any vendor-side configuration.

---

## 8. Troubleshooting

**Cert fails at first boot** — the most common cause is DNS not yet propagated. Verify with `dig +short <DOMAIN>`. Once DNS points at the VPS, `docker compose restart caddy` to retry.

**App container restarts repeatedly** — `docker compose logs app` will show why. Most likely a migration fail-stop (the entrypoint exits non-zero on bad migrations); fix the migration in code, push, redeploy.

**`Database "..." does not exist`** — the Postgres container hasn't initialised yet. The compose `depends_on` health-check should prevent this, but if you migrated from a different stack it's worth deleting and recreating: `docker compose down -v && docker compose up -d --build`.

**Free disk filling up** — old Docker images pile up on rebuild. Run `docker image prune -af` once a week (or add it to `backup.sh`).

---

## 9. What's NOT covered (yet)

- **Email** for password resets / cert renewal warnings — you mentioned no SMTP, so currently password resets are super-admin one-shots and cert expiry only emails Let's Encrypt's `ADMIN_EMAIL`.
- **Off-site backups** — copy the `backups/` directory to S3/Backblaze/etc on a schedule.
- **Monitoring** — add `docker compose logs --tail 200` to a healthcheck dashboard or pipe to Loki/Promtail.
