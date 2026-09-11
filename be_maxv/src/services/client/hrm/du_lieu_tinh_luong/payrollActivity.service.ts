import { sysPrisma } from '../../../../config/db.sys';
import type { PayrollModuleCode } from '../../../../generated/tenant';
import { nhanBangKe } from '../../../../constants/hrm/payrollModules';
import {
  HANH_DONG_KY_LUONG,
  type HanhDongKyLuong,
} from '../../../../constants/hrm/payrollActivities';
import type { ChiTietNhatKyKyLuong } from '../../../../helpers/hrm/nhatKyKyLuong';

/**
 * "Lịch sử hoạt động" của màn Chốt kỳ lương — ĐỌC LẠI nhật ký hệ thống (`sys_log`, control plane)
 * mà `ghiNhatKyKyLuong` đã ghi, không có bảng nhật ký riêng cho payroll (OQ-dltl-003: tái sử dụng
 * `writeLog`, không tạo bảng mới). Tách file riêng vì là chỗ DUY NHẤT của nhóm payroll đụng DB
 * control plane — test mock `config/db.sys`, không phải dựng `sysPrisma` thật.
 */

/** Nhãn loại thao tác hiện cạnh tên người làm (LOCK / UNLOCK / EDIT / APPROVE). */
type LoaiHoatDong = 'LOCK' | 'UNLOCK' | 'EDIT' | 'APPROVE';

const LOAI_THEO_HANH_DONG: Record<HanhDongKyLuong, LoaiHoatDong> = {
  HRM_PAYROLL_PERIOD_LOCKED: 'LOCK',
  HRM_PAYROLL_PERIOD_REOPENED: 'UNLOCK',
  HRM_PAYROLL_PERIOD_APPROVED: 'APPROVE',
  HRM_PAYROLL_MODULE_LOCKED: 'LOCK',
  HRM_PAYROLL_MODULE_UNLOCKED: 'UNLOCK',
  HRM_PAYROLL_MODULES_LOCKED_ALL: 'LOCK',
  HRM_PAYROLL_CALCULATED: 'EDIT',
};

const SO_DONG_TOI_DA = 50;

/** `chiTiet` đọc từ DB là JSON tự do — vẫn kiểm kiểu lúc chạy, khóa thì theo đúng kiểu bên ghi. */
type ChiTiet = Record<string, unknown> | null;
type KhoaChiTiet = keyof ChiTietNhatKyKyLuong;

function docChuoi(chiTiet: ChiTiet, key: KhoaChiTiet): string | undefined {
  const v = chiTiet?.[key];
  return typeof v === 'string' ? v : undefined;
}

function docSo(chiTiet: ChiTiet, key: KhoaChiTiet): number | undefined {
  const v = chiTiet?.[key];
  return typeof v === 'number' ? v : undefined;
}

/** Câu mô tả dựng lúc ĐỌC từ mã bảng kê — đổi nhãn bảng kê thì nhật ký cũ đọc theo nhãn mới. */
function moTaHoatDong(hanhDong: HanhDongKyLuong, chiTiet: ChiTiet): string {
  const module = docChuoi(chiTiet, 'module') as PayrollModuleCode | undefined;
  switch (hanhDong) {
    case 'HRM_PAYROLL_PERIOD_LOCKED':
      return 'Khóa sổ kỳ lương';
    case 'HRM_PAYROLL_PERIOD_REOPENED': {
      const lyDo = docChuoi(chiTiet, 'reason');
      return lyDo ? `Mở lại kỳ lương — lý do: ${lyDo}` : 'Mở lại kỳ lương';
    }
    case 'HRM_PAYROLL_PERIOD_APPROVED':
      return 'Duyệt kỳ lương';
    case 'HRM_PAYROLL_MODULE_LOCKED':
      return `Chốt số liệu ${module ? nhanBangKe(module) : 'bảng kê'}`;
    case 'HRM_PAYROLL_MODULE_UNLOCKED':
      return `Mở chốt ${module ? nhanBangKe(module) : 'bảng kê'}`;
    case 'HRM_PAYROLL_MODULES_LOCKED_ALL':
      return `Chốt số toàn kỳ (${docSo(chiTiet, 'count') ?? 0} bảng kê)`;
    case 'HRM_PAYROLL_CALCULATED':
      return `Đã tính lương cho ${docSo(chiTiet, 'calculatedEmployees') ?? 0} nhân viên`;
  }
}

/** Họ tên theo `userId` — dùng cho cả lịch sử hoạt động lẫn "ai chốt" trên thẻ bảng kê. */
export async function layHoTenNguoiDung(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const duyNhat = [...new Set(ids.filter((id): id is string => !!id))];
  if (duyNhat.length === 0) return new Map();
  const users = await sysPrisma.user.findMany({
    where: { id: { in: duyNhat } },
    select: { id: true, hoTen: true },
  });
  return new Map(users.map((u) => [u.id, u.hoTen]));
}

/**
 * 50 thao tác gần nhất của MỘT kỳ lương thuộc công ty đang chọn. Lọc `donViId` là bắt buộc: `sys_log`
 * là bảng chung mọi công ty, `periodId` chỉ duy nhất trong một tenant.
 */
export async function listPayrollPeriodActivities(donViId: string, periodId: string) {
  const rows = await sysPrisma.sysLog.findMany({
    where: {
      donViId,
      hanhDong: { in: Object.values(HANH_DONG_KY_LUONG) },
      chiTiet: { path: ['periodId'], equals: periodId },
    },
    orderBy: { createdAt: 'desc' },
    take: SO_DONG_TOI_DA,
    select: { id: true, hanhDong: true, userId: true, chiTiet: true, createdAt: true },
  });

  const hoTen = await layHoTenNguoiDung(rows.map((r) => r.userId));

  return rows.map((r) => {
    const hanhDong = r.hanhDong as HanhDongKyLuong;
    return {
      id: r.id,
      action: hanhDong,
      type: LOAI_THEO_HANH_DONG[hanhDong],
      description: moTaHoatDong(hanhDong, r.chiTiet as ChiTiet),
      userId: r.userId,
      userName: (r.userId && hoTen.get(r.userId)) || 'Hệ thống',
      createdAt: r.createdAt,
    };
  });
}
