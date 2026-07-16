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
// Lệnh cho tenant (prisma db push) truyền --schema + --url động để ghi đè.
export default defineConfig({
  schema: path.join('prisma', 'sys', 'schema.prisma'),
  datasource: {
    url: process.env.DB_SYS_URL,
  },
});
