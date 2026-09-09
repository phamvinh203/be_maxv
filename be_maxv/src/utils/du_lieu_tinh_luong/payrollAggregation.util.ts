/**
 * Gom danh sách bản ghi phát sinh của kỳ lương theo mã nhân viên (`ma_nv`) — dùng chung cho các
 * khối "chấm công/tăng ca/KPI/thưởng/sản phẩm/hoa hồng/chuyên cần/ứng-bù trừ" ở cả engine tính
 * lương (`payrollCalculation.service.ts`) lẫn các màn xem dữ liệu theo module
 * (`payrollInputs.service.ts`) — trước đây mỗi nơi tự viết lại đúng 5 dòng vòng lặp này.
 */
export function groupByMaNv<T extends { ma_nv: string }>(records: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of records) {
    const list = map.get(r.ma_nv) ?? [];
    list.push(r);
    map.set(r.ma_nv, list);
  }
  return map;
}

/** Bộ lọc nhân viên đang làm việc (phòng ban + tìm theo mã/tên) dùng chung cho các màn nhập liệu tính lương. */
export function buildActiveEmployeeWhere(query: { ma_pb?: string; q?: string }) {
  const where: any = { status: '1', da_xoa: false };
  if (query.ma_pb) where.ma_pb = query.ma_pb;
  if (query.q) {
    where.OR = [
      { ma_nv: { contains: query.q, mode: 'insensitive' } },
      { ho_ten: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return where;
}
