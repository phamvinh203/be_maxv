import type { FastifyRequest } from 'fastify';
import type { PayrollModuleCode } from '../../generated/tenant';
import type { HanhDongKyLuong } from '../../constants/hrm/payrollActivities';
import { currentUserId } from '../resolveTenantDb';
import { writeLog } from '../../services/shared/syslog.service';

/**
 * Các khóa `chiTiet` ghi kèm nhật ký kỳ lương. "Lịch sử hoạt động" (`payrollActivity.service.ts`) đọc
 * lại đúng các khóa này — hai bên dùng CHUNG kiểu, đổi tên khóa ở một bên là trình biên dịch báo.
 */
export interface ChiTietNhatKyKyLuong {
  module?: PayrollModuleCode;
  modules?: PayrollModuleCode[];
  count?: number;
  calculatedEmployees?: number;
  reason?: string;
}

/**
 * Nhật ký kiểm toán cho thao tác trên kỳ lương (khóa sổ / mở lại / duyệt, chốt / mở chốt bảng kê,
 * chốt toàn kỳ, tính lương) — BR-dltl-002, NFR-dltl-003, BR-dltl-034. Tenant schema KHÔNG có bảng
 * audit riêng cho payroll: tái dùng `writeLog` (bảng `syslog` control plane) theo OQ-dltl-003.
 * `chiTiet.periodId` là khóa để "Lịch sử hoạt động" lọc theo kỳ — mọi thao tác phải ghi qua hàm này.
 * `writeLog` ghi kèm-không-chặn (tự nuốt lỗi), nhật ký hỏng không làm hỏng thao tác nghiệp vụ chính.
 */
export async function ghiNhatKyKyLuong(
  req: FastifyRequest,
  hanhDong: HanhDongKyLuong,
  periodId: string,
  chiTiet?: ChiTietNhatKyKyLuong,
) {
  await writeLog({
    hanhDong,
    userId: currentUserId(req),
    donViId: req.user.donViId ?? undefined,
    chiTiet: { periodId, ...chiTiet },
  });
}
