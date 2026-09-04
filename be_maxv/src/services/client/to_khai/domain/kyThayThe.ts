/**
 * Hóa đơn thay thế / điều chỉnh thuộc KỲ CỦA HÓA ĐƠN GỐC, không phải kỳ nó được lập.
 *
 * Hóa đơn lập 07/01/2026 thay thế cho hóa đơn lập 26/12/2025 phải kê vào Q4/2025 (khai bổ sung kỳ
 * đó), chứ không rơi vào Q1/2026 — kê nhầm kỳ là doanh thu chạy sang quý khác, cả hai tờ khai đều
 * sai. Đo trên dữ liệu thật (MST 0111142786): 8/27 hóa đơn thay thế/điều chỉnh bán ra có gốc ở kỳ
 * khác, tổng hơn 60 triệu.
 *
 * Hàm THUẦN — test ở `src/__tests__/kyThayThe.test.ts`.
 *
 * ===== VÌ SAO PHẢI HAI ĐƯỜNG TÌM NGÀY GỐC =====
 *
 * Hóa đơn thay thế mang `khhdgoc`/`shdgoc` (ký hiệu + số hóa đơn gốc) nhưng KHÔNG mang ngày gốc:
 * `tdlapgoc` và `nlapgoc` đều rỗng trên mọi bản ghi đã kiểm. Nên phải suy ra, và hai đường bù nhau:
 *
 *   - TRA hóa đơn gốc trong DB theo (ký hiệu, số): chính xác nhất, chạy được 26/27 tờ bán ra và
 *     5/6 tờ mua vào. Trượt khi hóa đơn gốc thuộc năm chưa đồng bộ.
 *   - BÓC ngày từ câu ghi chú (`gchdgoc`): "…lập ngày 26/12/2025". Cứu đúng ca hóa đơn gốc chưa
 *     đồng bộ, nhưng chỉ dùng được cho hóa đơn BÁN RA (26/27) — ghi chú bên mua vào do nhà cung
 *     cấp tự viết, không theo mẫu nào (0/6 bóc được).
 *
 * Cả hai trượt thì chặn hóa đơn khỏi bảng kê và nói ra bằng cảnh báo, không được dùng ngày lập
 * của tờ thay thế/điều chỉnh làm ngày thay thế cho ngày gốc.
 */

/**
 * Trạng thái hóa đơn thay thế (2) và điều chỉnh (3) — hai loại trỏ về một hóa đơn gốc.
 *
 * Nguồn DUY NHẤT của luật này: `keKhaiKy.service.ts` dựng mệnh đề SQL `tthai = ANY($n)` từ chính
 * mảng này thay vì viết tay `IN ('2', '3')` — thêm/bớt trạng thái chỉ sửa một chỗ.
 */
export const TTHAI_CO_GOC = ["2", "3"] as const;
const TTHAI_CO_GOC_SET = new Set<string>(TTHAI_CO_GOC);

export function coHoaDonGoc(tthai: string | null | undefined): boolean {
  return TTHAI_CO_GOC_SET.has(String(tthai ?? "").trim());
}

/**
 * Bóc ngày hóa đơn gốc từ câu ghi chú của người bán.
 *
 * Mẫu gặp trên dữ liệu thật:
 *   "Hóa đơn thay thế cho hóa đơn điện tử mẫu 1 ký hiệu C25TLT số 1474 lập ngày 26/12/2025"
 *   "Hóa đơn điều chỉnh giảm 6.998.400 cho hóa đơn điện tử mẫu 1, ký hiệu C26TLT, số 451 lập ngày 31/01/2026"
 *
 * Trả `yyyy-MM-dd`, hoặc `null` khi câu không theo mẫu. Ngày không hợp lệ (32/13/2026) cũng trả
 * `null` — thà không biết còn hơn gán một kỳ sai.
 */
export function ngayGocTuGhiChu(ghiChu: unknown): string | null {
  const m = /lập ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(ghiChu ?? ""));
  if (!m) return null;
  const [, d, thang, nam] = m;
  const ngay = new Date(Date.UTC(Number(nam), Number(thang) - 1, Number(d)));
  // `Date.UTC` cuộn tràn (32/01 thành 01/02) nên phải đối chiếu ngược từng phần.
  if (
    ngay.getUTCFullYear() !== Number(nam) ||
    ngay.getUTCMonth() !== Number(thang) - 1 ||
    ngay.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${nam}-${thang.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/*
 * ĐỪNG suy năm từ ký hiệu hóa đơn. Từng có hàm `namTuKyHieu` ở đây đọc `C25TLT` thành năm 2025 —
 * SAI: hai số đó là năm ĐĂNG KÝ MẪU hóa đơn, không phải năm lập. Dữ liệu thật của MST 0111142786
 * có 117 tờ ký hiệu `C25TLT` lập từ 06/01/2026 đến 31/03/2026. Muốn biết kỳ thì đọc `tdlap`.
 */

/** Một hóa đơn thay thế/điều chỉnh sau khi đã suy ra ngày của hóa đơn gốc. */
export interface ToCoGoc {
  id: string;
  /** `yyyy-MM-dd` của hóa đơn GỐC; `null` = không suy được. */
  ngayGoc: string | null;
  /** Tờ này có ngày lập nằm trong kỳ đang xét hay không. */
  lapTrongKy: boolean;
}

export interface KetQuaChon {
  ids: string[];
  /** Số tờ nằm trong kỳ mà không suy được kỳ gốc — bị chặn, cần bổ sung dữ liệu gốc. */
  khongRoKyGoc: number;
  /** Id mọi tờ không suy được kỳ gốc, dùng để gỡ cả các lần gán kỳ sai từ trước. */
  idsKhongRoKyGoc: string[];
}

/**
 * Chọn hóa đơn THUỘC kỳ theo luật, từ danh sách "lập trong kỳ" cộng với các tờ có hóa đơn gốc.
 *
 * Hàm THUẦN để test được không cần Postgres — phần đọc DB nằm ở `keKhaiKy.service.ts`.
 *
 * Phép chọn đi hai chiều: BỎ tờ lập trong kỳ mà gốc ở kỳ khác, THÊM tờ lập ngoài kỳ mà gốc rơi vào
 * kỳ này. Không suy được kỳ gốc thì loại khỏi kết quả và đếm vào `khongRoKyGoc`: không được thay
 * ngày hóa đơn gốc bằng ngày lập của tờ điều chỉnh/thay thế.
 */
export function chonTheoKyGoc(
  idLapTrongKy: readonly string[],
  coGoc: readonly ToCoGoc[],
  tuNgay: string,
  denNgay: string,
): KetQuaChon {
  const chon = new Set(idLapTrongKy);
  let khongRoKyGoc = 0;
  const idsKhongRoKyGoc: string[] = [];
  for (const to of coGoc) {
    if (!to.ngayGoc) {
      idsKhongRoKyGoc.push(to.id);
      if (to.lapTrongKy) {
        chon.delete(to.id);
        khongRoKyGoc += 1;
      }
      continue;
    }
    if (to.ngayGoc >= tuNgay && to.ngayGoc <= denNgay) chon.add(to.id);
    else chon.delete(to.id);
  }
  return { ids: [...chon], khongRoKyGoc, idsKhongRoKyGoc };
}

/**
 * Chỉ nhận ngày tra từ DB khi mọi ứng viên cùng chỉ đến MỘT ngày lịch. Khóa gốc GDT hiện không
 * luôn mang mẫu số hóa đơn, nên cùng MST + ký hiệu + số có thể trả nhiều ứng viên; chọn bản ghi
 * đầu tiên trong trường hợp ấy sẽ làm tờ khai rơi vào kỳ sai.
 */
export function ngayGocDuyNhat(ngayUngVien: readonly (string | null | undefined)[]): string | null {
  const ngayKhacNhau = new Set(ngayUngVien.filter((ngay): ngay is string => Boolean(ngay)));
  if (ngayKhacNhau.size !== 1) return null;
  return ngayKhacNhau.values().next().value ?? null;
}
