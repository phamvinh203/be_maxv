/**
 * QUY ƯỚC NGÀY GIỜ dùng chung cho mọi module đọc dữ liệu hóa đơn — phát biểu hợp đồng nằm ở
 * `docs/14-hop-dong-api.md`, mục "Quy ước ngày giờ"; ở đây chỉ chép lại phần LÝ DO CÀI ĐẶT.
 *
 * Một chuỗi `yyyy-MM-dd…` KHÔNG hậu tố múi giờ luôn mang nghĩa GIỜ VIỆT NAM, ở cả bốn hướng: lúc đọc
 * từ GDT (`toDate`), lúc dựng khoảng lọc (`vnDayStart`/`vnDayEnd`), lúc lấy ngày của một bản ghi đã
 * lưu (`vnDayString`) và lúc trả ra FE (`toVnWallClock`).
 *
 * ===== VÌ SAO PHẢI LÀ FILE DÙNG CHUNG =====
 *
 * Bốn hàm này từng nằm riêng trong `services/client/hddt/gdt.service.ts`. Module Tờ khai không thấy
 * chúng nên tự viết lại phép so ngày bằng mốc UTC (`new Date(\`${ymd}T00:00:00.000Z\`)`), và vì cổng
 * thuế trả ngày lập lúc 00:00 giờ VN — tức 17:00 UTC HÔM TRƯỚC — nên MỌI hóa đơn bị đọc lùi đúng một
 * ngày. Kỳ Q1/2026 hóa ra quét hóa đơn lập 02/01–01/04: chỉ tiêu [32] thừa 102.173.752 đồng so với tờ
 * khai đã nộp của MST 0111142786, [23] của Q2 thừa 1.356.031.600.
 *
 * Nên đây là nguồn DUY NHẤT. Chỗ nào cần so ngày với cột `tdlap`/`nky` thì import từ đây, tuyệt đối
 * không dựng `new Date(...Z)` tại chỗ.
 *
 * Lệch cố định +07:00 chứ không tra bảng múi giờ: Việt Nam không có DST và giữ UTC+7 từ 1975.
 *
 * Test: `src/__tests__/ngayVn.test.ts`.
 */

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const VN_OFFSET = "+07:00";

/** `yyyy-MM-dd` (GDT đôi khi trả ngày trần) hoặc `yyyy-MM-ddTHH:mm[:ss[.SSS]]`, KHÔNG hậu tố múi giờ. */
const VN_LOCAL_RE = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

/**
 * Chuỗi ngày giờ -> instant. Chuỗi KHÔNG mang múi giờ được ghim `+07:00` thay vì để `new Date()` suy
 * theo giờ máy chủ: ngày lập là dữ liệu trên chứng từ, không được đổi theo nơi chạy tiến trình.
 * Chuỗi đã mang múi giờ (Z/+07:00) giữ nguyên instant.
 */
export const toDate = (v: unknown): Date | undefined => {
  if (typeof v !== "string" || !v) return undefined;
  const m = VN_LOCAL_RE.exec(v);
  const d = new Date(m ? `${m[1]}${m[2] ?? "T00:00:00"}${VN_OFFSET}` : v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Đầu/cuối một ngày `yyyy-MM-dd` theo GIỜ VN — dùng dựng khoảng lọc so với cột `tdlap` (instant). */
export const vnDayStart = (ymd: string): Date => new Date(`${ymd}T00:00:00${VN_OFFSET}`);
export const vnDayEnd = (ymd: string): Date => new Date(`${ymd}T23:59:59.999${VN_OFFSET}`);

/**
 * Date (từ DB) hoặc chuỗi ngày giờ -> `yyyy-MM-ddTHH:mm:ss` theo GIỜ VIỆT NAM, không hậu tố múi giờ.
 * Không đọc được thành ngày -> undefined (nơi gọi tự quyết định giữ nguyên input hay bỏ trống).
 * Idempotent: chuỗi đã ở dạng giờ VN chạy lại vẫn ra chính nó.
 */
export function toVnWallClock(v: unknown): string | undefined {
  const d = v instanceof Date ? v : toDate(v);
  if (!d || Number.isNaN(d.getTime())) return undefined;
  // Cộng lệch rồi in theo UTC = in giờ VN. `slice(0, 19)` cắt đúng phần `yyyy-MM-ddTHH:mm:ss`.
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 19);
}

/**
 * NGÀY (không giờ) của một instant, theo GIỜ VN: `yyyy-MM-dd`.
 *
 * Đây là dạng đem đi SO với `tuNgay`/`denNgay` của kỳ kê khai — so chuỗi `yyyy-MM-dd` là so ngày
 * lịch, không lệ thuộc giờ. Dùng `.toISOString().slice(0, 10)` thẳng trên Date của Prisma là lấy
 * ngày UTC, tức lùi một ngày với mọi hóa đơn lập lúc 00:00 giờ VN.
 */
export function vnDayString(v: unknown): string | undefined {
  return toVnWallClock(v)?.slice(0, 10);
}
