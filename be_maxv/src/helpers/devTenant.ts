import { env } from '../config/env';
import { getTenantDb } from './tenantClient';
import type { PrismaClient } from '../generated/tenant';

/**
 * DEV ONLY — trả về Prisma client trỏ tới 1 DB tenant CỐ ĐỊNH (env.devTenantDb,
 * mặc định "maxv2_app") để build & test tính năng mà KHÔNG cần đăng ký/đăng nhập.
 *
 * KHÔNG dùng ở production: ở đó tenant DB phải resolve động từ JWT/donVi.
 * Guard bằng NODE_ENV nên nếu lỡ gọi ngoài dev sẽ ném lỗi ngay thay vì âm thầm
 * ghi nhầm dữ liệu.
 */
export function getDevTenantDb(): PrismaClient {
  if (env.nodeEnv !== 'development') {
    throw new Error('getDevTenantDb chỉ được phép dùng ở NODE_ENV=development');
  }
  if (!env.devTenantDb) {
    throw new Error('Thiếu DEV_TENANT_DB trong .env.local');
  }
  return getTenantDb(env.devTenantDb);
}
