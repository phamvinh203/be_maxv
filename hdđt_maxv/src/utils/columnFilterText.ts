/**
 * Tiện ích lọc CHỮ dùng chung cho mọi bảng có "ô lọc dòng cố định" (`ColumnFilterInput`) — contains
 * không phân biệt hoa-thường cho cột text, cú pháp gõ khoảng cho cột số. Tách khỏi module gọi đầu
 * tiên (`hddt`) vì bảng "Dịch vụ công" (`dich_vu_cong`) cần lại y hệt logic này.
 */

/** `""` (không lọc) khớp mọi giá trị; ngược lại so `contains`, không phân biệt hoa-thường. */
export function containsText(hay: string | undefined | null, needle: string): boolean {
  if (!needle.trim()) return true;
  return (hay ?? "").toLowerCase().includes(needle.trim().toLowerCase());
}

/** `tu`/`den` rỗng = không chặn đầu đó. `val` thiếu/NaN mà có ít nhất 1 đầu -> loại (không so được). */
export function inNumRange(
  val: number | undefined,
  tu: string | undefined,
  den: string | undefined,
): boolean {
  if (!tu && !den) return true;
  if (val == null || Number.isNaN(val)) return false;
  if (tu && val < Number(tu)) return false;
  if (den && val > Number(den)) return false;
  return true;
}

// 4 dạng cú pháp của `parseRangeInput` — hằng số module-level (dựng 1 LẦN lúc nạp module) thay vì
// `new RegExp(...)` lại mỗi lần gọi hàm: phần thân số `NUM` cố định, không đổi giữa các lần gọi.
const NUM = "\\d+(?:[.,]\\d+)?";
const GTE_RE = new RegExp(`^>=?\\s*(${NUM})$`);
const LTE_RE = new RegExp(`^<=?\\s*(${NUM})$`);
const RANGE_RE = new RegExp(`^(${NUM})?\\s*-\\s*(${NUM})?$`);
const EXACT_RE = new RegExp(`^${NUM}$`);

/**
 * Cú pháp gõ 1 ô cho cột số dạng khoảng (thay 2 ô "Từ - Đến" riêng trong popover cũ): "100-500"
 * (khoảng), "100-" hoặc ">=100"/">100" (từ 100), "-500" hoặc "<=500"/"<500" (đến 500), "100" (đúng
 * bằng 100). Trả `{tu, den}` để tái dùng NGUYÊN state/lọc kiểu `inNumRange` (LUÔN inclusive nên >
 * và >= — hay < và <= — không phân biệt được, cố ý gộp chung). Số tiền hóa đơn/hồ sơ không âm nên
 * dấu "-" LUÔN được hiểu là dấu nối khoảng, không phải số âm. Input rỗng hoặc không khớp cú pháp
 * nào (vd lẫn chữ) -> `{tu: "", den: ""}` (coi như chưa lọc, không báo lỗi).
 */
export function parseRangeInput(raw: string): { tu: string; den: string } {
  const s = raw.trim();
  if (!s) return { tu: "", den: "" };
  const norm = (v: string) => v.replace(",", ".");
  let m = GTE_RE.exec(s);
  if (m) return { tu: norm(m[1]), den: "" };
  m = LTE_RE.exec(s);
  if (m) return { tu: "", den: norm(m[1]) };
  m = RANGE_RE.exec(s);
  if (m && (m[1] || m[2])) return { tu: norm(m[1] ?? ""), den: norm(m[2] ?? "") };
  m = EXACT_RE.exec(s);
  if (m) return { tu: norm(s), den: norm(s) };
  return { tu: "", den: "" };
}

/** Ngược lại `parseRangeInput` — dựng lại chữ hiển thị trong ô input từ state `{tu, den}` ĐANG ÁP
 * DỤNG (vd sau khi "Bỏ tìm kiếm", hay field dùng chung bị đổi từ nơi khác). KHÔNG cố khôi phục ĐÚNG
 * cú pháp gốc đã gõ (vd ">=100" hiện lại thành "100-") — chỉ cần diễn giải lại giá trị tương đương,
 * đúng 1 trong các dạng cú pháp hợp lệ nên gõ tiếp/sửa lại vẫn tự nhiên. */
export function formatRangeInput(tu?: string, den?: string): string {
  if (!tu && !den) return "";
  if (tu && den) return tu === den ? tu : `${tu}-${den}`;
  return tu ? `${tu}-` : `-${den}`;
}

export const RANGE_INPUT_HINT =
  'Gõ "100-500" (khoảng), "100-" hoặc ">=100" (từ 100), "-500" hoặc "<=500" (đến 500), "100" (đúng bằng).';
