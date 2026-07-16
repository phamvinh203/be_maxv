import dotenv from 'dotenv';
import path from 'node:path';

// Chọn file env theo NODE_ENV (set ở tầng OS/PM2 TRƯỚC khi app chạy):
//   production -> .env.production   |   còn lại -> .env.local (dev, giữ nguyên như cũ).
// Lưu ý: NODE_ENV phải được set qua biến môi trường thật (PM2 ecosystem `env`), KHÔNG phải
// chỉ khai trong file .env — vì việc chọn file diễn ra trước khi dotenv nạp file.
const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường: ${name} (xem .env.local)`);
  return v;
}

// CORS: whitelist domain FE cụ thể — KHÔNG dùng origin:true (phản chiếu mọi Origin).
// Dev: mặc định các cổng Vite hay dùng nếu chưa set. Production: bắt buộc khai báo rõ.
const DEV_DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];
function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
const configuredOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);
if (configuredOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  throw new Error(
    'Thiếu biến môi trường: ALLOWED_ORIGINS (bắt buộc ở production để cấu hình CORS)',
  );
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

  // Whitelist domain FE được phép gọi API kèm credentials (xem plugin CORS trong app.ts).
  allowedOrigins:
    configuredOrigins.length > 0 ? configuredOrigins : DEV_DEFAULT_ORIGINS,

  // Control plane (maxv2_sys) - Prisma client đọc qua DB_SYS_URL
  sysUrl: required('DB_SYS_URL'),

  // Kết nối quản trị để CREATE/DROP DATABASE (dùng DB bảo trì "postgres")
  adminUrl: `${pgBase}/postgres`,

  // Base để ghép URL từng DB tenant: ${tenantBaseUrl}/db_<MST>
  tenantBaseUrl: pgBase,

  // Dev: DB tenant cố định để build tính năng khi chưa có luồng auth/tenant thật.
  // Chỉ set ở môi trường dev; production để trống.
  devTenantDb: process.env.DEV_TENANT_DB,

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  // Refresh TTL tính bằng GIÂY: dùng chung cho jwt expiresIn + cookie maxAge.
  refreshTtlSec: Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 60 * 60 * 24 * 7),

  trialDays: Number(process.env.TRIAL_DAYS ?? 7),

  // SMTP (thông báo qua email - vd báo admin khi có lời mời nhân viên mới)
  smtpHost: required('SMTP_HOST'),
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: required('SMTP_USER'),
  smtpPassword: required('SMTP_PASSWORD'),
};
