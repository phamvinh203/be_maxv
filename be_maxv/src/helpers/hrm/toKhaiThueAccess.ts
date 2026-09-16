import type { FastifyRequest } from 'fastify';
import { resolveTenantCtx } from '../resolveTenantDb';
import { ToKhaiThueError } from './toKhaiThueErrors';

/**
 * Cổng quyền của sub-cụm Tờ khai thuế TNCN — đúng 2 mức của api-contract Mục 0.1, nhưng lỗi mang mã
 * `E-tkt-014` như Mục 7 đòi cho MỌI endpoint.
 *
 * Không dùng thẳng `dbCoQuyenLuongPayroll` / `assertAdminOrOwner`: hai helper đó ném `ForbiddenError`
 * mang mã/câu chữ của phân hệ khác (E-hrm-058) ⇒ QA không grep được `E-tkt-014` trong phản hồi thật.
 * Ai được làm gì vẫn do nguồn cũ quyết: cờ `xemLuong` tính sẵn trong `resolveTenantInfo`, điều kiện
 * vai trò trùng `assertAdminOrOwner`.
 */

/** Mức 1 — quyền xem dữ liệu lương: gọi ở đầu MỌI controller của sub-cụm. */
export async function dbToKhaiThue(req: FastifyRequest) {
  const ctx = await resolveTenantCtx(req);
  if (!ctx.xemLuong) throw new ToKhaiThueError('E-tkt-014');
  return ctx.db;
}

/**
 * Mức 2 — ADMIN/OWNER: mở lại tháng, xuất tờ khai, tải lại file tờ khai, đánh dấu đã nộp. Thao tác
 * đảo chiều hoặc không hoàn tác được (api-contract Mục 0.1). Gọi TRƯỚC `dbToKhaiThue`.
 */
export function assertQuanTriToKhaiThue(req: FastifyRequest): void {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'OWNER') {
    throw new ToKhaiThueError(
      'E-tkt-014',
      'Thao tác này chỉ dành cho quản trị viên hoặc chủ sở hữu công ty.',
    );
  }
}
