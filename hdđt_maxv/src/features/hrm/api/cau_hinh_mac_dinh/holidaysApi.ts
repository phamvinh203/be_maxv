import { api } from "@/lib/apiClient";

const BASE = "/hrm/holidays";

export type HolidayTypeApi = "NATIONAL" | "LUNAR" | "COMPANY" | "COMPENSATORY";

export interface HolidayApiItem {
  id: string;
  /**
   * ⚠️ **Chuỗi ISO đầy đủ** khi đọc (`"2026-01-01T00:00:00.000Z"`), nhưng gửi lên là
   * `"YYYY-MM-DD"`. Riêng `items[].date` của `quick-generate` lại là `"YYYY-MM-DD"` — bất đối
   * xứng có thật trong mã máy chủ, đừng dùng chung một hàm parse cho hai chỗ.
   */
  date: string;
  name: string;
  type: HolidayTypeApi;
  isAnnual: boolean;
  isPaid: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHolidayApiBody {
  date: string;
  name: string;
  type?: HolidayTypeApi;
  isAnnual?: boolean;
  isPaid?: boolean;
  note?: string | null;
}

export interface UpdateHolidayApiBody {
  date?: string;
  name?: string;
  type?: HolidayTypeApi;
  isAnnual?: boolean;
  isPaid?: boolean;
  note?: string | null;
}

export interface HolidayListParams {
  /**
   * Mặc định của máy chủ là `THIS_YEAR`, **không phải "tất cả"** — không gửi gì là đã bị lọc.
   * ⚠️ Gửi kèm `year` thì `year` THẮNG `filter`: `filter=ALL&year=2026` hành xử y hệt
   * `THIS_YEAR&year=2026`. Muốn lấy đúng toàn bộ thì gửi `filter=ALL` và **không** gửi `year`.
   */
  filter?: "THIS_YEAR" | "ANNUAL" | "ALL";
  type?: HolidayTypeApi;
  /**
   * ⚠️ **Đang hỏng ở máy chủ, chưa dùng được** (`BE-03`): validator dùng `z.coerce.boolean()`
   * mà `Boolean("false") === true`, nên `?isPaid=false` trả về đúng nhóm NGƯỢC lại — và im
   * lặng. Không dựng bộ lọc "nghỉ không lương" cho tới khi máy chủ sửa xong.
   */
  isPaid?: boolean;
  year?: number;
  page?: number;
  pageSize?: number;
  sortBy?: "date" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface HolidayListApiResponse {
  items: HolidayApiItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QuickGenerateApiResponse {
  year: number;
  totalStandard: number;
  addedCount: number;
  skippedCount: number;
  items: {
    date: string;
    name: string;
    type: HolidayTypeApi;
    isAnnual: boolean;
    isPaid: boolean;
    /**
     * Máy chủ đã tự chấm: dòng này **sẽ không được tạo**. `true` gộp HAI tình huống khác nhau
     * với người dùng — (1) công ty đã có đúng cặp `(ngày, tên)` này, (2) công ty có một ngày lễ
     * mang `isAnnual = true` **phủ sẵn** ngày đó ở năm khác (`BUG-HRM-51`: đã có
     * `2026-01-01 Tết Dương lịch` lặp hàng năm thì `2027-01-01` không cần dòng thứ hai).
     * Hợp đồng chỉ cho **một** cờ gộp, không tách hai nghĩa — đừng bịa thêm cờ để đoán.
     *
     * 🔴 **Đừng tự tính lại cờ này ở trình duyệt.** Nghĩa (2) đòi biết đúng luật phủ hàng năm
     * của máy chủ; cài lại luật đó ở giao diện là dựng lại **nguồn sự thật thứ hai** mà
     * `ADR-010` vừa gỡ — và lần này còn khó phát hiện hơn, vì hai bên chỉ lệch ở năm thứ hai
     * trở đi.
     *
     * Hợp đồng gốc: `api-contract.md` Mục 7F.6 — (b1) hai quy tắc bỏ qua, (b2) bất biến, kiểm
     * **trong cùng một phản hồi** (`ADR-011`):
     * `count(alreadyCovered === false) === addedCount`,
     * `count(alreadyCovered === true) === skippedCount`,
     * `addedCount + skippedCount === totalStandard` (`totalStandard` vẫn luôn là 11 — nó là số
     * ngày lễ chuẩn theo Điều 112, không phải số dòng sắp ghi).
     *
     * ⚠️ Là **ảnh chụp lúc đọc**, không phải cam kết: giữa lúc xem trước và lúc bấm Tạo, người
     * khác có thể thêm/xóa ngày lễ. Đừng dựng logic đòi hai lượt gọi phải cho cùng một cờ.
     *
     * ⚠️ Khai **bắt buộc** vì hợp đồng khai bắt buộc, nhưng máy chủ ĐANG CHẠY có thể là bản cũ
     * chưa gửi khóa này (cùng bẫy "repo ≠ máy đang chạy" của `dryRun`, dev-notes 2.15.6). Nơi
     * đọc phải coi đây là **biên giới không tin được** và tự kiểm `typeof` — xem
     * `holidaysQueries.ts` → `docCoDaPhu`.
     */
    alreadyCovered: boolean;
  }[];
}

export function listHolidays(
  params?: HolidayListParams,
): Promise<HolidayListApiResponse> {
  return api.get<HolidayListApiResponse>(BASE, { params });
}

/**
 * Chi tiết một ngày lễ (`FE-03`).
 *
 * Cùng khuôn mẫu với `workShiftsApi.getWorkShiftDetail` — giữ đối xứng giữa hai danh mục cùng
 * cấp. Dùng khi màn sửa mở bằng liên kết trực tiếp hoặc F5 giữa chừng: đọc **một** bản ghi mà
 * không phải kéo cả danh sách kèm bộ lọc. Sửa trong dòng của bảng thì không cần gọi.
 */
export function getHolidayDetail(id: string): Promise<HolidayApiItem> {
  return api.get<HolidayApiItem>(`${BASE}/${encodeURIComponent(id)}`);
}

export function createHoliday(
  body: CreateHolidayApiBody,
): Promise<HolidayApiItem> {
  return api.post<HolidayApiItem>(BASE, body);
}

export function updateHoliday(
  id: string,
  body: UpdateHolidayApiBody,
): Promise<HolidayApiItem> {
  return api.patch<HolidayApiItem>(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deleteHoliday(
  id: string,
): Promise<{ id: string; message: string }> {
  return api.del<{ id: string; message: string }>(
    `${BASE}/${encodeURIComponent(id)}`,
  );
}

/**
 * Dải năm `POST /holidays/quick-generate` nhận.
 *
 * 🔴 **Nguồn của hai con số này là VALIDATOR MÁY CHỦ, không phải bảng tra âm lịch của giao
 * diện.** `quickGenerateHolidaySchema` khai `min(2024).max(2030)` và `holidays.service.ts` chặn
 * lần hai; ngoài dải là **400 `E-hrm-079`**. Trước đây ô chọn năm lấy dải từ `NAM_HO_TRO` của
 * `features/hrm/ngayLeChuan.ts` — bảng tra chép tay 7 năm — nên trông thì giống nhau mà quan hệ
 * thì sai: bảng tra không quyết định năm nào gửi lên được.
 *
 * ⚠️ **Muốn mở thêm năm thì nới validator máy chủ TRƯỚC**, rồi mới sửa hai hằng số ở đây. Bồi
 * năm vào `MUNG_1_TET` không mở rộng được gì — hộp thoại đã không đọc bảng đó từ `ADR-010`.
 */
export const NAM_TAO_NHANH_MIN = 2024;

/** Xem `NAM_TAO_NHANH_MIN`. */
export const NAM_TAO_NHANH_MAX = 2030;

/** Các năm gửi lên được, tăng dần — dùng để dựng danh sách của ô chọn năm. */
export const DAI_NAM_TAO_NHANH: number[] = Array.from(
  { length: NAM_TAO_NHANH_MAX - NAM_TAO_NHANH_MIN + 1 },
  (_, i) => NAM_TAO_NHANH_MIN + i,
);

/** Có gửi lên được không. Dùng cho `enabled` của hook xem trước — đừng gọi để nhận 400. */
export function laNamTaoNhanhHopLe(nam: number): boolean {
  return (
    Number.isInteger(nam) &&
    nam >= NAM_TAO_NHANH_MIN &&
    nam <= NAM_TAO_NHANH_MAX
  );
}

/**
 * Sinh 11 ngày nghỉ lễ chuẩn VN cho một năm — **idempotent**, ngày đã có bị bỏ qua chứ không
 * báo lỗi. Chỉ nhận năm trong `DAI_NAM_TAO_NHANH` (ngoài dải ⇒ 400 `E-hrm-079`).
 *
 * Luôn gửi `year` tường minh: bỏ trống thì máy chủ lấy năm theo **múi giờ của tiến trình**
 * (`new Date().getFullYear()`), lệch một ngày quanh giao thừa nếu máy chủ chạy UTC.
 *
 * `dryRun = true` ⇒ máy chủ **không ghi gì**, chỉ trả về đúng hình dạng phản hồi cũ với
 * `addedCount`/`skippedCount` là **dự báo**. Nhờ vậy bản xem trước của hộp thoại đọc thẳng
 * `items[]` của máy chủ thay vì tự tính bằng bảng tra riêng — bỏ hẳn nguồn sự thật thứ hai.
 *
 * ⚠️ Khóa `dryRun` chỉ được đưa vào thân yêu cầu khi **đúng bằng `true`**. Chủ ý: đường GHI
 * thật giữ nguyên thân `{ year }` **y hệt bản trước**, nên dù máy chủ có siết `.strict()` sau
 * này thì thao tác tạo lịch cũng không thể vỡ vì một khóa thừa. Theo hợp đồng, `false` và
 * "vắng mặt" là một.
 */
export function quickGenerateHolidays(
  year?: number,
  dryRun?: boolean,
): Promise<QuickGenerateApiResponse> {
  return api.post<QuickGenerateApiResponse>(`${BASE}/quick-generate`, {
    year,
    ...(dryRun === true ? { dryRun: true } : {}),
  });
}
