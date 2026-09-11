import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { ForbiddenError } from './errors';

/**
 * preHandler chống CSRF cho route ĐỔI TRẠNG THÁI chỉ dựa vào cookie mà không cần đăng nhập trước —
 * `/auth/logout`, `/auth/refresh` (vbsec 2026-09-10). Cookie refresh là SameSite=Lax, và response của một
 * form POST điều hướng top-level từ trang lạ vẫn xóa được cookie -> trang lạ ép người dùng đăng xuất.
 *
 * Trình duyệt luôn gửi `Origin` cho POST chéo site. Cho qua khi:
 *   - `Origin` là FE đã cấu hình (whitelist CORS `ALLOWED_ORIGINS`);
 *   - cùng origin với API (`Sec-Fetch-Site: same-origin`, hoặc host của `Origin` trùng host của request —
 *     cho trình duyệt cũ chưa có Fetch Metadata khi FE và API chung một domain qua reverse proxy);
 *   - không có `Origin` (curl, máy chủ gọi máy chủ) — không phải kênh CSRF.
 */
export async function chanCsrfTheoOrigin(req: FastifyRequest): Promise<void> {
  const origin = req.headers.origin;
  if (origin === undefined) return;
  if (env.allowedOrigins.includes(origin)) return;
  if (req.headers['sec-fetch-site'] === 'same-origin') return;
  try {
    if (new URL(origin).host === req.host) return;
  } catch {
    // Origin "null" / sai định dạng -> chặn bên dưới.
  }
  throw new ForbiddenError('Yêu cầu không đến từ ứng dụng MaxV.');
}
