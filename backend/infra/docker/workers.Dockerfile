# ─── Stage 1: build ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY services/workers ./services/workers
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile=false
RUN pnpm prisma:generate
RUN pnpm --filter @cravix/workers build

# ─── Stage 2: runtime ────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/services/workers ./services/workers

USER node
CMD ["node", "services/workers/dist/index.js"]
