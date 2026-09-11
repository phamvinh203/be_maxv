/**
 * Nhân viên theo phạm vi áp dụng (toàn công ty / phòng ban / nhân viên) — bản thay thế
 * `mock/hooks/kyLuong.ts::useNhanVienKyLuong`, chạy trên API thật.
 *
 * Giữ NGUYÊN chữ ký + luật lọc của bản mock (kể cả ô "Loại HĐ" ở `ThanhLocKyLuong`, thứ các API
 * `GET /hrm/payroll-data/*` KHÔNG hỗ trợ lọc phía máy chủ) để 8 màn của khu "Dữ liệu tính lương"
 * không đổi hành vi khi đấu dây — chỉ đổi nguồn dữ liệu từ kho mock sang `nhanVienQueries` (đã
 * thật, dùng chung cache với màn "Nhân viên").
 *
 * QUAN TRỌNG khi "Áp dụng": các Panel PHẢI luôn gửi `scope: 'nhan_vien'` kèm
 * `employeeIds: rows.map(r => r.ma_nv)` lên API `apply*`, KHÔNG gửi `scope: 'phong_ban'` + `ma_pb`
 * — máy chủ tự `resolveTargetEmployees` theo `ma_pb` sẽ KHÔNG áp bộ lọc "Loại HĐ" (chỉ tồn tại ở
 * trình duyệt), nên danh sách máy chủ ghi có thể RỘNG HƠN danh sách đang hiển thị trên màn hình —
 * đúng lỗi lớp BUG-HRM-25 (ghi nhầm dữ liệu ngoài phạm vi người dùng nhìn thấy).
 */

import { useMemo } from "react";
import { useNhanVienRows } from "../../api/du_lieu_nhan_vien/nhanVienQueries";
import type { LocNhanVienKyLuong, NhanVienKyLuongRow, PhamViApDung } from "../../types";

export function useNhanVienKyLuong(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): NhanVienKyLuongRow[] {
  // Luôn kéo toàn bộ nhân viên đang làm (network không đổi theo `filters` — `useNhanVienRows`
  // lọc phía trình duyệt từ CÙNG một cache), lọc theo phạm vi diễn ra bên dưới, giống hệt bản mock.
  const { rows } = useNhanVienRows({ q: "", ma_pb: "", status: "1" });

  return useMemo(() => {
    const tuKhoa = filters.q.trim().toLowerCase();

    return rows
      .filter((nv) => {
        if (phamVi === "toan_cong_ty") return true;
        if (phamVi === "phong_ban") {
          return Boolean(filters.ma_pb) && nv.ma_pb === filters.ma_pb;
        }
        if (filters.ma_pb && nv.ma_pb !== filters.ma_pb) return false;
        if (!tuKhoa) return true;
        return [nv.ma_nv, nv.ho_ten].some((truong) => truong.toLowerCase().includes(tuKhoa));
      })
      .map(
        (nv): NhanVienKyLuongRow => ({
          ma_nv: nv.ma_nv,
          ho_ten: nv.ho_ten,
          ten_pb: nv.ten_pb,
          loai_hd: nv.hop_dong?.loai_hd ?? null,
        }),
      )
      // Lọc loại HĐ để sau cùng, giống bản mock: phải có hợp đồng hiện hành mới so được.
      .filter((row) => {
        if (phamVi === "toan_cong_ty") return true;
        return !filters.loai_hd || row.loai_hd === filters.loai_hd;
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [rows, phamVi, filters]);
}

/**
 * Ghép danh sách nhân viên (từ `useNhanVienKyLuong`) với bản tóm tắt theo từng người mà máy chủ
 * trả về (`GET .../{module}` — mỗi phần tử có `ma_nv`) — dùng chung cho 7/8 Panel của khu "Dữ
 * liệu tính lương" (tăng ca/KPI/thưởng/lương sản phẩm/lương phần trăm/chuyên cần/ứng-bù trừ; riêng
 * Chấm công là ma trận theo ngày nên không dùng hàm này). Mỗi Panel chỉ còn tự khai field nào của
 * `TBan` map sang cột nào của `TRow` qua `mapRow`, không phải tự viết lại việc dựng `Map`.
 */
export function mergeNhanVienKyLuongWithData<TBan extends { ma_nv: string }, TRow>(
  nhanVien: NhanVienKyLuongRow[],
  banList: TBan[] | undefined,
  mapRow: (row: NhanVienKyLuongRow, ban: TBan | undefined) => TRow,
): TRow[] {
  const banTheoNv = new Map((banList ?? []).map((r) => [r.ma_nv, r]));
  return nhanVien.map((row) => mapRow(row, banTheoNv.get(row.ma_nv)));
}

/**
 * Đếm số nhân viên CÓ dữ liệu trên máy chủ (`banList` — vd đã áp KPI/thưởng/bù
 * trừ trong kỳ) nhưng KHÔNG còn nằm trong `nhanVien` đang lọc (nghỉ việc, đổi
 * phòng ban, hoặc bị 3 ô lọc của `ThanhLocKyLuong` loại ra) — RVW-711: dữ liệu
 * này vẫn được tính vào bảng lương (server không biết gì về bộ lọc phía trình
 * duyệt), nhưng biến mất khỏi MỌI bảng của Panel nên không ai xem/xóa được qua
 * màn này. Dùng để hiện dòng cảnh báo tổng hợp dưới bảng.
 */
export function demSoNgoaiBoLoc<TBan extends { ma_nv: string }>(
  nhanVien: NhanVienKyLuongRow[],
  banList: TBan[] | undefined,
): number {
  if (!banList || banList.length === 0) return 0;
  const trongBoLoc = new Set(nhanVien.map((nv) => nv.ma_nv));
  return banList.filter((ban) => !trongBoLoc.has(ban.ma_nv)).length;
}
