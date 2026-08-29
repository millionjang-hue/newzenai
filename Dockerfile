# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps - install once, cached on package files alone
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# build - produces the standalone server in .next/standalone
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CRM_DATABASE_PATH=/app/data/crm.db

RUN addgroup -S -g 1001 crm && adduser -S -u 1001 -G crm crm

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# The SQLite file lives here. Mount a volume so data survives a rebuild.
RUN mkdir -p /app/data && chown -R crm:crm /app/data
VOLUME ["/app/data"]

USER crm
EXPOSE 3000
CMD ["node", "server.js"]
