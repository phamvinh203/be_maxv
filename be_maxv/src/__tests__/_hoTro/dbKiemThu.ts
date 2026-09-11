import { randomBytes } from 'node:crypto';
import { env } from '../../config/env';

/**
 * Chốt chặn cho test chạm DB THẬT (tạo tài khoản, CREATE/DROP DATABASE) — vbsec 2026-09-10.
 *
 * Test dùng đúng DB đang cấu hình trong `.env.local`. Trỏ nhầm sang DB thật (production, máy chủ dùng
 * chung) thì test ghi tài khoản quản trị vào đó, ngắt giữa chừng là để lại luôn. Chỉ chạy khi DB nằm
 * trên máy local và không phải `NODE_ENV=production`; DB test ở máy khác phải bật tường minh
 * `CHO_PHEP_DB_KIEM_THU_TU_XA=1`.
 */

const HOST_LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** `null` = được chạy; còn lại là lý do chặn (không kèm mật khẩu DB). */
export function lyDoKhongPhaiDbKiemThu(
  nodeEnv: string | undefined,
  urls: string[],
  choPhepTuXa = false,
): string | null {
  if (nodeEnv === 'production') {
    return 'NODE_ENV=production — không chạy test ghi dữ liệu.';
  }
  if (choPhepTuXa) return null;
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return 'URL DB không đọc được.';
    }
    if (!HOST_LOCAL.has(host)) {
      return `DB ở máy "${host}" không phải máy local — đặt CHO_PHEP_DB_KIEM_THU_TU_XA=1 nếu đó đúng là DB test.`;
    }
  }
  return null;
}

/** Ném lỗi (dừng cả file test) nếu DB đang cấu hình không phải DB test. Gọi đầu `before()`. */
export function batBuocDbKiemThu(): void {
  const lyDo = lyDoKhongPhaiDbKiemThu(
    process.env.NODE_ENV,
    [env.sysUrl, env.adminUrl],
    process.env.CHO_PHEP_DB_KIEM_THU_TU_XA === '1',
  );
  if (lyDo) throw new Error(`Từ chối chạy test chạm DB: ${lyDo}`);
}

/**
 * Mật khẩu cho tài khoản test — sinh MỚI mỗi lượt chạy, không nằm trong repo. Có cả chữ lẫn số để qua
 * `passwordRule`.
 */
export function matKhauNgauNhien(): string {
  return `Tt9${randomBytes(12).toString('base64url')}`;
}
