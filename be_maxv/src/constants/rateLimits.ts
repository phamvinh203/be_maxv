import type { FastifyRequest } from 'fastify';

/**
 * Preset rate-limit dùng chung cho route option thứ 2 (`app.post(path, PRESET, handler)`).
 * Giới hạn mặc định toàn app (300/phút) đăng ký ở app.ts — các preset ở đây CHỈ dùng để
 * siết chặt hơn cho route nhạy cảm cụ thể (login/register và các route tương tự sau này).
 */

/** Route dễ bị dò/spam (login, register, đặt lại mật khẩu, mời nhân viên...). */
export const STRICT_AUTH_LIMIT = {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
};

/**
 * Giới hạn theo NGƯỜI DÙNG cho route đã đăng nhập, dùng như option thứ 2 của route (gộp cùng
 * `preHandler`): `{ preHandler: [...], ...gioiHanTheoNguoiDung(5, '10 minutes') }`.
 *
 * Chạy ở `preHandler` — tức SAU `authenticate`, đã có `req.user` — và khóa theo userId: xoay IP không
 * lách được, người dùng khác cùng mạng (NAT công ty) không bị vạ lây. Thay cho giới hạn chung theo IP
 * trên đúng route đó.
 */
export function gioiHanTheoNguoiDung(max: number, timeWindow: string) {
  return {
    config: {
      rateLimit: {
        max,
        timeWindow,
        hook: 'preHandler' as const,
        keyGenerator: (req: FastifyRequest) =>
          `u:${req.user?.userId ?? req.ip}`,
      },
    },
  };
}
