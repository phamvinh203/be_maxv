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

/**
 * Giá trị `trustProxy` của Fastify từ `TRUST_PROXY` — quyết định `req.ip`, tức khóa của MỌI rate
 * limit (kể cả 5/phút cho login) và IP ghi vào nhật ký kiểm toán.
 *   - không đặt / "false" -> false: bỏ qua X-Forwarded-For.
 *   - "true" -> chỉ tin proxy trên cùng máy hoặc trong mạng nội bộ (loopback / link-local / dải
 *     private). CỐ Ý không dùng `true` của Fastify (tin MỌI hop): khi đó `req.ip` là phần tử trái
 *     nhất của X-Forwarded-For — do client tự đặt — nên chỉ cần đổi header là vượt mọi rate limit.
 *   - số nguyên -> số hop proxy đứng ngay trước app.
 *   - còn lại -> danh sách IP/CIDR của proxy, cách nhau dấu phẩy (vd "10.0.0.5,10.0.0.6").
 */
export function parseTrustProxy(
  raw: string | undefined,
): false | number | string {
  const giaTri = raw?.trim();
  if (!giaTri || giaTri === 'false') return false;
  if (giaTri === 'true') return 'loopback,linklocal,uniquelocal';
  if (/^\d+$/.test(giaTri)) return Number(giaTri);
  return giaTri;
}

const ACCESS_TTL_MAC_DINH_GIAY = 15 * 60;
const ACCESS_TTL_TOI_DA_GIAY = 60 * 60;

/**
 * Hạn access token (giây) từ `ACCESS_TOKEN_TTL`: số giây trần hoặc `<số>s|m|h|d` (vd "15m"). Sai định dạng
 * -> 15 phút; vượt 60 phút -> kẹp về 60 phút (kèm cảnh báo). Access token KHÔNG đối chiếu DB mỗi request
 * (xem jwt.plugin.ts), nên hạn của nó chính là độ trễ tối đa của mọi lần thu hồi quyền — cấu hình nhầm
 * "30d" là 30 ngày không thu hồi được (vbsec 2026-09-10).
 */
export function docAccessTtlGiay(raw: string | undefined): number {
  const giaTri = raw?.trim();
  if (!giaTri) return ACCESS_TTL_MAC_DINH_GIAY;
  const m = /^(\d+)([smhd]?)$/.exec(giaTri);
  const donVi = { '': 1, s: 1, m: 60, h: 3600, d: 86400 } as const;
  const giay = m ? Number(m[1]) * donVi[m[2] as keyof typeof donVi] : NaN;
  if (!Number.isFinite(giay) || giay <= 0) {
    console.warn(`[env] ACCESS_TOKEN_TTL="${giaTri}" không hợp lệ (vd "15m", "900") — dùng 15 phút.`);
    return ACCESS_TTL_MAC_DINH_GIAY;
  }
  if (giay > ACCESS_TTL_TOI_DA_GIAY) {
    console.warn(`[env] ACCESS_TOKEN_TTL="${giaTri}" vượt trần 60 phút — dùng 60 phút.`);
    return ACCESS_TTL_TOI_DA_GIAY;
  }
  return giay;
}

/**
 * Role Postgres QUẢN TRỊ (CREATE/DROP DATABASE khi cấp/xóa công ty) — TÙY CHỌN tách khỏi role chạy app
 * (vbsec 2026-09-10). Không đặt `DB_ADMIN_USER` thì dùng chung role `APP_DB_*` như trước. Tách ra thì role
 * app không cần quyền CREATEDB: lộ thông tin kết nối của app không kéo theo quyền tạo/xóa DB. Vận hành:
 *   CREATE ROLE maxv_provision LOGIN CREATEDB PASSWORD '...';  GRANT <role app> TO maxv_provision;
 * (`GRANT` để role quản trị DROP được DB tenant mà role app sở hữu — xem `cauTaoDatabase`).
 */
export function docRoleQuanTri(
  bien: Record<string, string | undefined>,
  appUser: string,
  appPass: string,
): { user: string; password: string; tachRieng: boolean } {
  const user = bien.DB_ADMIN_USER?.trim();
  if (!user) return { user: appUser, password: appPass, tachRieng: false };
  const password = bien.DB_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('Đã đặt DB_ADMIN_USER thì phải đặt DB_ADMIN_PASSWORD.');
  }
  return { user, password, tachRieng: user !== appUser };
}

const APP_HOST = required('APP_DB_HOST');
const APP_PORT = required('APP_DB_PORT');
const APP_USER = required('APP_DB_USER');
const APP_PASS = required('APP_DB_PASSWORD');
const pgBase = `postgresql://${APP_USER}:${APP_PASS}@${APP_HOST}:${APP_PORT}`;
const roleQuanTri = docRoleQuanTri(process.env, APP_USER, APP_PASS);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Bật khi chạy sau reverse proxy để đọc IP thật từ X-Forwarded-For.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  // Whitelist domain FE được phép gọi API kèm credentials (xem plugin CORS trong app.ts).
  allowedOrigins:
    configuredOrigins.length > 0 ? configuredOrigins : DEV_DEFAULT_ORIGINS,

  // Control plane (maxv2_sys) - Prisma client đọc qua DB_SYS_URL
  sysUrl: required('DB_SYS_URL'),

  // Kết nối quản trị để CREATE/DROP DATABASE (dùng DB bảo trì "postgres") — role riêng nếu có
  // `DB_ADMIN_USER` (xem `docRoleQuanTri`).
  adminUrl: `postgresql://${roleQuanTri.user}:${roleQuanTri.password}@${APP_HOST}:${APP_PORT}/postgres`,
  // Tách role quản trị -> DB tenant mới giao cho role app làm OWNER (`cauTaoDatabase`).
  chuDbTenant: roleQuanTri.tachRieng ? APP_USER : undefined,

  // Base để ghép URL từng DB tenant: ${tenantBaseUrl}/db_<MST>
  tenantBaseUrl: pgBase,

  // Dev: DB tenant cố định để build tính năng khi chưa có luồng auth/tenant thật.
  // Chỉ set ở môi trường dev; production để trống.

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  // Giây, đã kẹp trần 60 phút — xem `docAccessTtlGiay`.
  accessTtl: docAccessTtlGiay(process.env.ACCESS_TOKEN_TTL),
  // Refresh TTL tính bằng GIÂY: dùng chung cho jwt expiresIn + cookie maxAge.
  refreshTtlSec: Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 60 * 60 * 24 * 7),

  // Thời gian dùng miễn phí khi đăng ký tài khoản mới (mặc định 1 tháng = 30 ngày).

  /** Số hóa đơn/trang khi gọi danh sách GDT — chỉnh để A/B đo tốc độ pha danh sách. */
  gdtListPageSize: parseGdtListPageSize(process.env.GDT_LIST_PAGE_SIZE),

  // SMTP (thông báo qua email - vd báo admin khi có lời mời nhân viên mới)
  // Google Drive — nơi lưu FILE SCAN hồ sơ nhân sự (hướng A: Drive của chính công ty khách).
  // KHÔNG dùng `required()`: thiếu cấu hình thì tính năng tự TẮT MỀM (giống khóa mã hóa mật khẩu
  // cổng thuế) chứ không làm sập cả app — phần nhập liệu hồ sơ vẫn chạy bình thường.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',

  smtpHost: required('SMTP_HOST'),
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: required('SMTP_USER'),
  smtpPassword: required('SMTP_PASSWORD'),
};
