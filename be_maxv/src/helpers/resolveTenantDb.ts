import type { FastifyRequest } from 'fastify';
import { sysPrisma } from '../config/db.sys';
import { getTenantDb } from './tenantClient';
import { accessibleDonViWhere } from './access';
import { ForbiddenError, NotFoundError } from './errors';
import { MESSAGES } from '../constants/messages';
import type { PrismaClient } from '../generated/tenant';

/**
 * Chọn Prisma client cho DB tenant của request hiện tại.
 *
 *   req.user.donViId  ->  kiểm tra quyền (canAccessDonVi)  ->  tra don_vi.dbName
 *   (control plane)  ->  getTenantDb(dbName)
 *
 * Yêu cầu route đã gắn `authenticate` (req.user luôn có mặt). Chưa chọn công ty
 * (donViId=null) -> 403; không còn quyền vào MST trong token -> 403; công ty chưa
 * cấp DB xong -> 404.
 */
export async function resolveTenantDb(
  req: FastifyRequest,
): Promise<PrismaClient> {
  return getTenantDb(await resolveTenantDbName(req));
}

/** Thông tin tenant của request: DB + MST (để guard chống ghi nhầm data MST khác). */
export interface TenantInfo {
  dbName: string;
  maSoThue: string;
  /**
   * Người gọi có quyền XEM DỮ LIỆU LƯƠNG ở công ty này không — QĐ #8, BR-hrm-059, ADR-007.
   * `OWNER` luôn có; `OWNER_EMPLOYEE` tùy cờ `DonViAccess.xemLuong` của đúng cặp (user, công ty).
   */
  xemLuong: boolean;
}

/**
 * Kiểm quyền + lấy `{ dbName, maSoThue, xemLuong }` của công ty đang chọn trong 1 query.
 *   req.user.donViId -> canAccessDonVi -> don_vi(dbName, maSoThue) + don_vi_access(xemLuong)
 * Chưa chọn công ty -> 403; hết quyền -> 403; chưa cấp DB -> 404. Dùng khi cần cả MST
 * (luồng lưu hóa đơn: đối chiếu chủ hóa đơn phải khớp MST tenant).
 *
 * QUYỀN XEM LƯƠNG ĐỌC Ở ĐÂY, KHÔNG Ở VÉ ĐĂNG NHẬP (BR-hrm-068). Vé sống 15 phút và cố ý không
 * đối chiếu dữ liệu mỗi lượt; nhét cờ quyền vào đó thì thu hồi quyền trễ tới 15 phút, im lặng.
 * Không phải đánh đổi hiệu năng: truy vấn này vốn đã chạy cho mọi request HRM, lấy thêm một cờ
 * qua quan hệ `access` **đo thật: tốn thêm ~0,36 ms mỗi lượt gọi** (0,80 → 1,17 ms, trung bình 200 lần trên cơ sở dữ liệu thật). Không phải 0 như bản trước khẳng định: Prisma bắn **một truy vấn riêng** cho quan hệ vì `relationJoins` không bật.
 */
export async function resolveTenantInfo(req: FastifyRequest): Promise<TenantInfo> {
  const donViId = req.user?.donViId;
  if (!donViId) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_COMPANY);
  }

  // 1 query: vừa kiểm tra quyền (token có thể cũ, quyền đã bị thu hồi) vừa lấy dbName + MST.
  const userId = req.user.userId;
  const scope = accessibleDonViWhere(userId, req.user.role);
  if (!scope) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }
  const company = await sysPrisma.donVi.findFirst({
    where: { ...scope, id: donViId },
    select: {
      dbName: true,
      maSoThue: true,
      // OWNER không có dòng DonViAccess nào (họ thấy hết MST của mình qua ownerId) nên mảng
      // này rỗng — quyền của OWNER suy từ vai trò, xem dưới.
      access: { where: { userId }, select: { xemLuong: true }, take: 1 },
    },
  });
  if (!company) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }
  if (!company.dbName) {
    throw new NotFoundError(MESSAGES.COMPANY.NO_TENANT_DB);
  }

  return {
    dbName: company.dbName,
    maSoThue: company.maSoThue,
    xemLuong:
      req.user.role === 'OWNER' || (company.access[0]?.xemLuong ?? false),
  };
}

/** Tenant client kèm quyền của phiên — dùng cho nhóm HRM, nơi quyền xem lương quyết định payload. */
export interface TenantCtx extends TenantInfo {
  db: PrismaClient;
}

/**
 * Như `resolveTenantDb` nhưng trả kèm quyền của phiên (`xemLuong`).
 *
 * Tách hàm riêng thay vì đổi chữ ký `resolveTenantDb`: hàm cũ đang được hơn chục controller
 * ngoài HRM dùng và chúng không quan tâm tới quyền lương. Cả hai đi chung một truy vấn nên
 * không tốn thêm gì.
 */
export async function resolveTenantCtx(
  req: FastifyRequest,
): Promise<TenantCtx> {
  const info = await resolveTenantInfo(req);
  return { ...info, db: getTenantDb(info.dbName) };
}

/**
 * Chặn cứng khi người gọi không được cấp quyền xem dữ liệu lương — E-hrm-058 (403).
 * Dùng cho TOÀN BỘ nhóm `/hrm/hop-dong` (BR-hrm-059).
 */
export function assertXemLuong(ctx: { xemLuong: boolean }): void {
  if (!ctx.xemLuong) {
    throw new ForbiddenError(MESSAGES.HRM.KHONG_CO_QUYEN_XEM_LUONG);
  }
}

/**
 * Như `resolveTenantDb` nhưng trả `dbName` (db_<MST>) thay vì client. Dùng cho tiến trình chạy
 * NỀN kéo dài (vd `runDetailFetch`): gọi lại `getTenantDb(dbName)` định kỳ để refresh `lastUsed`,
 * tránh bị sweeper (idle > 10') đóng pool giữa chừng rồi mọi query hỏng.
 */
export async function resolveTenantDbName(req: FastifyRequest): Promise<string> {
  return (await resolveTenantInfo(req)).dbName;
}

/** user_id cho cột audit (user_id0/user_id2). */
export function currentUserId(req: FastifyRequest): string {
  return req.user.userId;
}
