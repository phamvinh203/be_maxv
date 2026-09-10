/**
 * Sinh lịch nghỉ lễ chuẩn Việt Nam cho một năm — Điều 112 Bộ luật Lao động 2019.
 *
 * Bốn dịp theo **dương lịch** tính được chính xác cho mọi năm. Hai dịp theo
 * **âm lịch** (Tết Nguyên đán, Giỗ Tổ Hùng Vương) phải tra bảng: quy đổi âm →
 * dương cần thuật toán lịch mặt trăng, không đáng đưa vào pha dựng giao diện.
 * Vì vậy "Tạo nhanh" chỉ mở các năm có trong bảng tra bên dưới.
 *
 * ⚠️ **Bảng này KHÔNG phải nguồn sự thật.** Nguồn thật là thuật toán âm lịch ở
 * `be_maxv/src/services/client/hrm/amLich.util.ts` (Hồ Ngọc Đức, quy chiếu UTC+7);
 * `POST /hrm/holidays/quick-generate` trả về `items[]` mới là thứ được ghi vào cơ sở
 * dữ liệu.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * TÌNH TRẠNG SỬ DỤNG `[cập nhật 2026-09-08]` — đọc trước khi định xóa file
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * **Đã hết dùng (đường chạy thật):**
 *   - `components/cau_hinh_mac_dinh/ngay_le/TaoNhanhDialog.tsx` — bản xem trước nay đọc
 *     `items[]` của máy chủ qua `useXemTruocTaoNhanh` (`dryRun: true`). Không còn import
 *     `ngayLeChuanVN`.
 *   - `NAM_HO_TRO` — dải năm của "Tạo nhanh" nay là `DAI_NAM_TAO_NHANH` ở
 *     `api/holidaysApi.ts`, suy từ **validator máy chủ** (`min(2024).max(2030)`, `E-hrm-079`)
 *     chứ không phải "những năm có trong bảng tra". Hằng số này **hiện không còn ai import**.
 *
 * ⚠️ Bảng tra 7 năm bên dưới (2024–2030) vì vậy **không còn dính gì tới dải năm của giao
 * diện** — hai bên trùng nhau chỉ là tình cờ. Đừng đi bồi thêm năm vào bảng với ý "để hộp
 * thoại Tạo nhanh mở được năm mới": muốn mở thêm năm thì nới validator máy chủ rồi sửa hai
 * hằng số ở `holidaysApi.ts`. Chỉ bồi khi `mock/` cần dữ liệu giả cho năm đó.
 *
 * **Còn dùng (chỉ trong kho dữ liệu giả, chưa nối API):**
 *   - `mock/hooks/ngayLe.ts:81` — `useTaoNhanhNgayLe` bản giả.
 *   - `mock/seed.ts:286` — dựng lịch mẫu năm 2026 cho các màn chưa nối API.
 *
 * ⇒ **Chưa xóa được file này**, nhưng nó không còn nuôi màn hình thật nào. Đợt gỡ `mock/`
 * sau này xóa hai chỗ trên là xóa được luôn cả file (kèm `NAM_HO_TRO`). Trong lúc chờ:
 * **KHÔNG được import lại vào đường chạy thật** — làm vậy là dựng lại đúng cấu trúc
 * hai-nguồn-sự-thật vừa gỡ, và nó đã sinh ra ba lỗi ngày lễ (`CONTEXT_SUMMARY` Mục 16.3).
 *
 * Ngày 2030-02-02 đã sửa 2026-09-08: bản cũ ghi `2030-02-03` — đó là ngày Tết theo
 * **lịch Trung Quốc**. Sóc rơi 02/02/2030 lúc ~23:1x giờ Việt Nam (UTC+7), sang UTC+8
 * thì đã là 03/02. Backend cũng sai đúng chỗ này và đã sửa cùng đợt. Lỗi lọt lâu vì
 * hai bảng chép tay khớp nhau, nên phép đối chiếu BE↔FE báo "đúng".
 */

import type { NgayLeFormValues } from "../types";

/** Mùng 1 Tết Nguyên đán, dạng `YYYY-MM-DD`. */
const MUNG_1_TET: Record<number, string> = {
  2024: "2024-02-10",
  2025: "2025-01-29",
  2026: "2026-02-17",
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-02",
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

/**
 * Các năm có ngày âm lịch trong bảng tra ở trên.
 *
 * ⚠️ **Không còn là dải năm của "Tạo nhanh"** kể từ 2026-09-08 đợt 3, và hiện **không nơi nào
 * import**. Dải năm thật nằm ở `api/holidaysApi.ts` → `DAI_NAM_TAO_NHANH`, suy từ validator máy
 * chủ. Giữ export ở đây cho `mock/` còn dựng được dữ liệu giả; đừng dùng để vẽ giao diện thật.
 */
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
