import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7: URL kết nối cho Migrate/CLI nằm ở đây (không còn trong schema).
// Nạp .env.local để chạy được cả khi không bọc qua dotenv-cli.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Cấu hình mặc định = control plane maxv2_sys.
// Lệnh cho tenant (prisma db push) truyền --schema + --url động để ghi đè.
export default defineConfig({
  schema: path.join('prisma', 'sys', 'schema.prisma'),
  datasource: {
    url: process.env.DB_SYS_URL,
  },
});
