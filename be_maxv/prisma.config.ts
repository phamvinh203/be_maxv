import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7: URL kết nối cho Migrate/CLI nằm ở đây (không còn trong schema).
// Chọn file env theo NODE_ENV — giữ ĐỒNG BỘ với src/config/env.ts:
//   production -> .env.production   |   còn lại -> .env.local (dev).
// Nạp tại đây để chạy được cả khi không bọc qua dotenv-cli.
const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Cấu hình mặc định = control plane maxv2_sys.
// Đẩy schema tenant (`dayTenantSchema` ở provisioning.service.ts, script sync-tenants) truyền --schema
// của tenant và đặt `PRISMA_TENANT_PUSH_URL` trong môi trường của TIẾN TRÌNH CON — URL có mật khẩu DB
// nên không đưa lên dòng lệnh (--url). Đừng đặt biến này ở shell/PM2: mọi lệnh Prisma sẽ trỏ sang tenant.
export default defineConfig({
  schema: path.join('prisma', 'sys', 'schema.prisma'),
  datasource: {
    url: process.env.PRISMA_TENANT_PUSH_URL ?? process.env.DB_SYS_URL,
  },
});
