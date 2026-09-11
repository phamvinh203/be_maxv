import { LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILS } from '../constants/auth';

/**
 * Đếm lần đăng nhập sai theo TỪNG EMAIL và tạm khóa khi chạm ngưỡng.
 *
 * Rate limit của Fastify khóa theo IP, nên xoay IP là đoán mật khẩu một tài khoản không giới hạn —
 * bộ đếm này đóng lỗ đó. Email không tồn tại cũng bị đếm y hệt, để thông báo "tạm khóa" không trở
 * thành cách dò email nào có tài khoản.
 *
 * - Cửa sổ đếm = thời gian khóa (`LOGIN_LOCK_MINUTES`), tính từ lần sai đầu tiên.
 * - Đang khóa thì KHÔNG so mật khẩu và KHÔNG gia hạn khóa: gia hạn theo mỗi lần thử sẽ cho phép kẻ
 *   xấu giữ tài khoản nạn nhân bị khóa mãi.
 * - Đăng nhập đúng xóa bộ đếm.
 *
 * Lưu trong bộ nhớ tiến trình: backend chạy MỘT instance PM2 (ecosystem.config.js). Khởi động lại
 * thì bộ đếm về 0 — chấp nhận được, kẻ tấn công không điều khiển được việc restart.
 */

interface LuotSai {
  soLan: number;
  batDau: number;
  khoaDen: number | null;
}

const CUA_SO_MS = LOGIN_LOCK_MINUTES * 60_000;
/** Trần số email được theo dõi — vượt thì dọn các mục đã hết hạn (chặn phình RAM khi bị dội email rác). */
const TRAN_SO_MUC = 10_000;

const luotSaiTheoEmail = new Map<string, LuotSai>();

function hetHan(muc: LuotSai, bayGio: number): boolean {
  return muc.khoaDen !== null
    ? bayGio >= muc.khoaDen
    : bayGio - muc.batDau >= CUA_SO_MS;
}

function donMucHetHan(bayGio: number): void {
  for (const [email, muc] of luotSaiTheoEmail) {
    if (hetHan(muc, bayGio)) luotSaiTheoEmail.delete(email);
  }
}

/** Email này đang bị tạm khóa đăng nhập? */
export function dangBiKhoaDangNhap(email: string): boolean {
  const muc = luotSaiTheoEmail.get(email);
  if (!muc) return false;
  if (hetHan(muc, Date.now())) {
    luotSaiTheoEmail.delete(email);
    return false;
  }
  return muc.khoaDen !== null;
}

/** Ghi nhận 1 lần đăng nhập sai; chạm ngưỡng thì khóa. */
export function ghiNhanDangNhapSai(email: string): void {
  const bayGio = Date.now();
  let muc = luotSaiTheoEmail.get(email);
  if (!muc || hetHan(muc, bayGio)) {
    if (luotSaiTheoEmail.size >= TRAN_SO_MUC) donMucHetHan(bayGio);
    muc = { soLan: 0, batDau: bayGio, khoaDen: null };
    luotSaiTheoEmail.set(email, muc);
  }
  muc.soLan += 1;
  if (muc.soLan >= LOGIN_MAX_FAILS) muc.khoaDen = bayGio + CUA_SO_MS;
}

/** Đăng nhập đúng — xóa bộ đếm của email. */
export function xoaDemDangNhapSai(email: string): void {
  luotSaiTheoEmail.delete(email);
}
