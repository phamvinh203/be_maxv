import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường: ${name} (xem .env.local)`);
  return v;
}

const APP_HOST = required('APP_DB_HOST');
const APP_PORT = required('APP_DB_PORT');
const APP_USER = required('APP_DB_USER');
const APP_PASS = required('APP_DB_PASSWORD');
const pgBase = `postgresql://${APP_USER}:${APP_PASS}@${APP_HOST}:${APP_PORT}`;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Bật khi chạy sau reverse proxy để đọc IP thật từ X-Forwarded-For.
  trustProxy: process.env.TRUST_PROXY === 'true',

  // Control plane (maxv2_sys) — Prisma client đọc qua DB_SYS_URL
  sysUrl: required('DB_SYS_URL'),

  // Kết nối quản trị để CREATE/DROP DATABASE (dùng DB bảo trì "postgres")
  adminUrl: `${pgBase}/postgres`,

  // Base để ghép URL từng DB tenant: ${tenantBaseUrl}/db_<MST>
  tenantBaseUrl: pgBase,

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  // Refresh TTL tính bằng GIÂY: dùng chung cho jwt expiresIn + cookie maxAge.
  refreshTtlSec: Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 60 * 60 * 24 * 7),

  trialDays: Number(process.env.TRIAL_DAYS ?? 7),

  // SMTP (thông báo qua email — vd báo admin khi có lời mời nhân viên mới)
  smtpHost: required('SMTP_HOST'),
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: required('SMTP_USER'),
  smtpPassword: required('SMTP_PASSWORD'),
  smtpFrom: required('SMTP_FROM'),
};
