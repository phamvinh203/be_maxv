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

/**
 * `size` xin GDT trả về mỗi trang danh sách hóa đơn — xem `GDT_LIST_PAGE_SIZE` ở gdt.service.ts để
 * biết vì sao mặc định là 15 (GDT cắt body khi trang quá lớn). GDT chặn hẳn size > 50.
 * Sai định dạng thì cảnh báo rồi dùng mặc định: size lệch chỉ làm chậm pha danh sách, không đáng chặn BE.
 */
const GDT_PAGE_SIZE_DEFAULT = 15;
function parseGdtListPageSize(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) return GDT_PAGE_SIZE_DEFAULT;

  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    console.warn(
      `[env] GDT_LIST_PAGE_SIZE="${trimmed}" không hợp lệ (cần số nguyên 1..50) — dùng ${GDT_PAGE_SIZE_DEFAULT}.`,
    );
    return GDT_PAGE_SIZE_DEFAULT;
  }
  return n;
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

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  // Refresh TTL tính bằng GIÂY: dùng chung cho jwt expiresIn + cookie maxAge.
  refreshTtlSec: Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 60 * 60 * 24 * 7),

  // Thời gian dùng miễn phí khi đăng ký tài khoản mới (mặc định 1 tháng = 30 ngày).
  trialDays: Number(process.env.TRIAL_DAYS ?? 30),

  /** Số hóa đơn/trang khi gọi danh sách GDT — chỉnh để A/B đo tốc độ pha danh sách. */
  gdtListPageSize: parseGdtListPageSize(process.env.GDT_LIST_PAGE_SIZE),

  // SMTP (thông báo qua email - vd báo admin khi có lời mời nhân viên mới)
  smtpHost: required('SMTP_HOST'),
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: required('SMTP_USER'),
  smtpPassword: required('SMTP_PASSWORD'),
};
