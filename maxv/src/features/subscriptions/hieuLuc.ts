import type { SubStatus } from '@/features/subscriptions/types/subscription';

/**
 * Thuê bao còn cấp quyền module hay không — **bản sao có chủ đích** của `goiConHieuLuc`
 * bên `be_maxv/src/services/shared/modules.service.ts`. Sửa một bên phải sửa bên kia.
 *
 * Vì sao màn admin phải tự tính lại thay vì tin cột `status`: hệ thống KHÔNG có tác vụ nào
 * chuyển `status` sang `EXPIRED`, nên một thuê bao quá hạn từ lâu vẫn nằm đó với chữ
 * `TRIALING` xanh mướt, trong khi API đã tắt sạch module của họ. Đo thật ngày 04/09/2026:
 * 6 tài khoản hết hạn từ 27/07 vẫn hiện `TRIALING`, không có dấu hiệu gì trên màn hình để
 * admin biết vì sao khách gọi lên báo "mất hết chức năng".
 */
const TRANG_THAI_CON_DUNG: SubStatus[] = ['TRIALING', 'ACTIVE'];

export function conHieuLuc(
  status: SubStatus,
  ketThuc: string | null,
  bayGio: Date = new Date(),
): boolean {
  if (!TRANG_THAI_CON_DUNG.includes(status)) return false;
  if (ketThuc && new Date(ketThuc).getTime() < bayGio.getTime()) return false;
  return true;
}

/** Đã quá `ketThuc` nhưng `status` vẫn còn xanh — chính là ca `status` nói dối. */
export function hetHanNhungStatusChuaDoi(
  status: SubStatus,
  ketThuc: string | null,
): boolean {
  return TRANG_THAI_CON_DUNG.includes(status) && !conHieuLuc(status, ketThuc);
}
