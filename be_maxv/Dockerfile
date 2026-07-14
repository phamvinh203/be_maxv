# ============================================================
#  be_maxv — Fastify + Prisma (driver adapter) + provisioning DB tenant
#  LƯU Ý: runtime PHẢI có prisma CLI + prisma/ schema vì app chạy
#  `npx prisma db push` lúc tạo công ty (provisioning.service.ts).
# ============================================================

# ---- Stage build ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# prisma cần openssl để chạy engine
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY . .
# generate (client linux) -> build (tsc) -> build đã tự copy src/generated sang dist/generated
RUN npm run generate && npm run build

# ---- Stage runtime ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# node_modules GIỮ devDeps (prisma CLI cho provisioning); dist đã kèm generated;
# prisma/ + prisma.config.ts cần cho `prisma db push` (tenant) và `migrate deploy` (sys).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
