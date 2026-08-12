/**
 * Sinh lịch nghỉ lễ chuẩn Việt Nam cho một năm — Điều 112 Bộ luật Lao động 2019.
 *
 * Bốn dịp theo **dương lịch** tính được chính xác cho mọi năm. Hai dịp theo
 * **âm lịch** (Tết Nguyên đán, Giỗ Tổ Hùng Vương) phải tra bảng: quy đổi âm →
 * dương cần thuật toán lịch mặt trăng, không đáng đưa vào pha dựng giao diện.
 * Vì vậy "Tạo nhanh" chỉ mở các năm có trong bảng tra bên dưới.
 *
 * ⚠️ Ngày âm lịch trong bảng này cần đối chiếu lại với lịch chính thức trước khi
 * dùng cho nghiệp vụ thật, và nên thay hẳn bằng bộ quy đổi âm lịch khi nối backend.
 */

import type { NgayLeFormValues } from "./types";

/** Mùng 1 Tết Nguyên đán, dạng `YYYY-MM-DD`. */
const MUNG_1_TET: Record<number, string> = {
  2024: "2024-02-10",
  2025: "2025-01-29",
  2026: "2026-02-17",
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-03",
};

/** Giỗ Tổ Hùng Vương (10/3 âm lịch), dạng `YYYY-MM-DD`. */
const GIO_TO_HUNG_VUONG: Record<number, string> = {
  2024: "2024-04-18",
  2025: "2025-04-07",
  2026: "2026-04-26",
  2027: "2027-04-16",
  2028: "2028-04-04",
  2029: "2029-04-23",
  2030: "2030-04-12",
};

/** Các năm "Tạo nhanh" hỗ trợ — đúng những năm có ngày âm lịch trong bảng tra. */
export const NAM_HO_TRO: number[] = Object.keys(MUNG_1_TET)
  .map(Number)
  .sort((a, b) => a - b);

/** Cộng `so` ngày vào một mốc `YYYY-MM-DD`. Tính trên UTC để không lệch múi giờ. */
function themNgay(iso: string, so: number): string {
  const moc = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(moc)) return iso;
  return new Date(moc + so * 86400000).toISOString().slice(0, 10);
}

/**
 * Danh sách ngày nghỉ lễ chuẩn của một năm.
 *
 * Trả về mảng rỗng nếu năm nằm ngoài bảng tra âm lịch — thà không tạo gì còn
 * hơn tạo một lịch thiếu Tết mà người dùng tưởng là đủ.
 */
export function ngayLeChuanVN(nam: number): NgayLeFormValues[] {
  const mung1 = MUNG_1_TET[nam];
  const gioTo = GIO_TO_HUNG_VUONG[nam];
  if (!mung1 || !gioTo) return [];

  const ketQua: NgayLeFormValues[] = [
    {
      ngay: `${nam}-01-01`,
      ten: "Tết Dương lịch",
      loai: "le_duong_lich",
      lap_lai_hang_nam: true,
      co_luong: true,
      ghi_chu: "Điều 112 khoản 1 điểm a",
    },
  ];

  // Tết Âm lịch 5 ngày: 30 Tết cộng mùng 1 đến mùng 4. Lịch nghỉ chính thức
  // hằng năm có thể xê dịch, người dùng sửa lại từng dòng.
  for (let i = 0; i < 5; i += 1) {
    ketQua.push({
      ngay: themNgay(mung1, i - 1),
      ten: "Tết Nguyên đán",
      loai: "le_am_lich",
      lap_lai_hang_nam: false,
      co_luong: true,
      ghi_chu: `Ngày ${i + 1}/5 — Điều 112 khoản 1 điểm b`,
    });
  }

  ketQua.push(
    {
      ngay: gioTo,
      ten: "Giỗ Tổ Hùng Vương",
      loai: "le_am_lich",
      lap_lai_hang_nam: false,
      co_luong: true,
      ghi_chu: "10/3 âm lịch — Điều 112 khoản 1 điểm e",
    },
    {
      ngay: `${nam}-04-30`,
      ten: "Ngày Giải phóng miền Nam",
      loai: "le_duong_lich",
      lap_lai_hang_nam: true,
      co_luong: true,
      ghi_chu: "Điều 112 khoản 1 điểm c",
    },
    {
      ngay: `${nam}-05-01`,
      ten: "Ngày Quốc tế Lao động",
      loai: "le_duong_lich",
      lap_lai_hang_nam: true,
      co_luong: true,
      ghi_chu: "Điều 112 khoản 1 điểm d",
    },
    {
      ngay: `${nam}-09-01`,
      ten: "Quốc khánh (ngày liền kề)",
      loai: "le_duong_lich",
      lap_lai_hang_nam: true,
      co_luong: true,
      ghi_chu: "Ngày liền kề trước 2/9 — đổi sang 3/9 nếu công ty chọn ngày sau",
    },
    {
      ngay: `${nam}-09-02`,
      ten: "Quốc khánh",
      loai: "le_duong_lich",
      lap_lai_hang_nam: true,
      co_luong: true,
      ghi_chu: "Điều 112 khoản 1 điểm đ",
    },
  );

  return ketQua.sort((a, b) => a.ngay.localeCompare(b.ngay));
}
