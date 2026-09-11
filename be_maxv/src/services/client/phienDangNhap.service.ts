import { randomUUID } from 'node:crypto';
import { sysPrisma } from '../../config/db.sys';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import { writeLog } from '../shared/syslog.service';

/**
 * Phiên đăng nhập phía server (`refresh_sessions`) — vbsec 2026-09-10 (auth.controller.ts:98).
 *
 * Refresh token mang `sid` (id phiên) + `jti` (mã lượt). Server giữ `jti` HIỆN HÀNH của phiên:
 *   - đăng xuất thu hồi phiên -> refresh token của nó hết dùng được, kể cả khi đã bị lộ;
 *   - mỗi lần làm mới đổi `jti` (xoay). Refresh token CŨ bị dùng lại = token đã lộ (người dùng thật
 *     luôn cầm bản mới nhất) -> không biết ai là chủ thật nên hủy cả phiên.
 *
 * Access token (15 phút) vẫn KHÔNG đối chiếu DB mỗi request (xem jwt.plugin.ts) — thu hồi có hiệu lực
 * ở lượt làm mới / cấp lại kế tiếp.
 */

/**
 * Ân hạn cho `jti` vừa bị xoay: nhiều tab cùng làm mới bằng MỘT refresh token (access token của các tab
 * hết hạn cùng lúc) — tab về sau cầm token "cũ" nhưng không phải dùng lại do lộ. Trong khoảng này trả
 * lại `jti` hiện hành thay vì hủy phiên.
 */
export const AN_HAN_XOAY_MS = 60_000;

const hanMoi = () => new Date(Date.now() + env.refreshTtlSec * 1000);

type Phien = NonNullable<
  Awaited<ReturnType<typeof sysPrisma.refreshSession.findUnique>>
>;

/** Phiên còn dùng được: chưa thu hồi, chưa hết hạn, đúng chủ. */
async function taiPhienSong(
  sid: string,
  userId: string,
): Promise<Phien | null> {
  const phien = await sysPrisma.refreshSession.findUnique({
    where: { id: sid },
  });
  if (
    !phien ||
    phien.userId !== userId ||
    phien.revokedAt ||
    phien.expiresAt <= new Date()
  ) {
    return null;
  }
  return phien;
}

function trongAnHan(phien: Phien, jti: string): boolean {
  return (
    phien.jtiTruoc === jti &&
    phien.xoayLuc !== null &&
    Date.now() - phien.xoayLuc.getTime() <= AN_HAN_XOAY_MS
  );
}

/** Mở phiên mới lúc đăng nhập; dọn luôn phiên đã hết hạn / đã thu hồi của user (bảng chỉ ghi thêm). */
export async function moPhien(
  userId: string,
): Promise<{ sid: string; jti: string }> {
  await sysPrisma.refreshSession.deleteMany({
    where: {
      userId,
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
    },
  });
  const jti = randomUUID();
  const phien = await sysPrisma.refreshSession.create({
    data: { userId, jti, expiresAt: hanMoi() },
  });
  return { sid: phien.id, jti };
}

/**
 * Cấp lại token GIỮA phiên (đổi / tạo / xóa công ty đang chọn): phiên phải còn sống, gia hạn rồi trả
 * `jti` hiện hành — không xoay, refresh token mới chỉ khác công ty đang chọn. Phiên đã đăng xuất -> 401
 * dù access token còn hạn.
 */
export async function giaHanPhien(
  sid: string,
  userId: string,
): Promise<string> {
  const phien = await taiPhienSong(sid, userId);
  if (!phien) throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
  await sysPrisma.refreshSession.updateMany({
    where: { id: sid, revokedAt: null },
    data: { expiresAt: hanMoi() },
  });
  return phien.jti;
}

/** Làm mới: xoay `jti` của phiên, trả `jti` để ký refresh token mới. */
export async function xoayPhien(
  sid: string,
  jti: string | undefined,
  userId: string,
): Promise<string> {
  const phien = await taiPhienSong(sid, userId);
  if (!phien || !jti)
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);

  if (jti === phien.jti) {
    const jtiMoi = randomUUID();
    // Ghi CÓ ĐIỀU KIỆN theo jti đã đọc: hai tab xoay cùng lúc thì chỉ một lượt thắng.
    const { count } = await sysPrisma.refreshSession.updateMany({
      where: { id: sid, jti, revokedAt: null },
      data: {
        jti: jtiMoi,
        jtiTruoc: jti,
        xoayLuc: new Date(),
        expiresAt: hanMoi(),
      },
    });
    if (count === 1) return jtiMoi;
    // Tab khác vừa xoay trước: lượt này cầm đúng jti vừa bị thay -> trong ân hạn.
    const sau = await taiPhienSong(sid, userId);
    if (sau && trongAnHan(sau, jti)) return sau.jti;
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }
  if (trongAnHan(phien, jti)) return phien.jti;

  await thuHoiPhien(sid);
  await writeLog({ hanhDong: 'REFRESH_TOKEN_REUSE', userId, chiTiet: { sid } });
  throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
}

/** Thu hồi một phiên (đăng xuất). Idempotent. */
export async function thuHoiPhien(sid: string): Promise<void> {
  await sysPrisma.refreshSession.updateMany({
    where: { id: sid, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
