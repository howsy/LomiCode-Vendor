# LomiCode Vendor Admin — production image
#
# Multi-stage build:
#   1. deps   — install all node_modules (incl. dev) for the build
#   2. build  — generate Prisma client + run `next build`
#   3. runner — copy only what the runtime needs onto a slim base
#
# Final image is ~200MB and runs as a non-root user.

# ────────────────────────────────────────────────────────────────────────
# Stage 1: install dependencies
# ────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma + bcryptjs need libssl + bash for the install scripts.
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci

# ────────────────────────────────────────────────────────────────────────
# Stage 2: build
# ────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip Next telemetry inside CI builds.
ENV NEXT_TELEMETRY_DISABLED=1

# Generate the Prisma client. We need a placeholder DATABASE_URL because
# `prisma generate` parses the schema (it never connects). The real URL is
# injected at runtime by docker-compose.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

RUN npm run build

# ────────────────────────────────────────────────────────────────────────
# Stage 3: runtime
# ────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user — defence in depth if the app is ever compromised.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# OpenSSL is needed by Prisma's query engine. tini gives us proper signal
# forwarding so `docker stop` triggers a clean shutdown instead of waiting
# 10 seconds for the kernel to SIGKILL.
RUN apk add --no-cache libc6-compat openssl tini

# 1. Standalone server bundle (Next.js writes this when output: 'standalone')
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
# 2. Static assets that the standalone server doesn't pack itself
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# 3. Prisma — schema + migrations + client + the migrate CLI shim so the
#    container can run `prisma migrate deploy` on startup.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
# 4. Entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# tini handles PID-1 responsibilities; the entrypoint script applies
# pending migrations, then starts the standalone server.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
