#!/bin/sh
set -e

# Áp migration cho DB control-plane (maxv2_sys). prisma.config.ts lấy URL từ DB_SYS_URL (env).
# Idempotent: chỉ áp migration còn thiếu. DB phải sẵn sàng (compose depends_on: service_healthy).
echo "[entrypoint] Applying sys migrations (maxv2_sys)..."
npx prisma migrate deploy --schema=prisma/sys/schema.prisma

echo "[entrypoint] Starting be_maxv..."
exec node dist/server.js
