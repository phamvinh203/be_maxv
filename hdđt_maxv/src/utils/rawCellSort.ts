/**
 * So sánh SẮP XẾP cho bảng đọc dữ liệu THÔ dạng chuỗi (mỗi ô đã là `string`, không phải field trên
 * 1 row object đã gõ kiểu — vd `BangHoSo` ở `features/dich_vu_cong`, dòng cổng trả về là
 * `string[]`). Khác `features/hddt/columnSort.ts` (đọc field theo tên trên object, biết trước field
 * nào là ngày qua 1 key cố định `ngayLienQuan`) — module này KHÔNG biết trước cột nào là ngày/số,
 * tự nhận dạng theo hình dạng chuỗi của MỖI CẶP đang so.
 */

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;

function isEmpty(s: string): boolean {
  return s.trim() === "";
}

/** `dd/MM/yyyy` hoặc `dd-MM-yyyy`, kèm giờ tùy chọn `HH:mm[:ss]` — đúng dạng cổng Dịch vụ công trả
 * về cho "Ngày nộp" (xem `parseNgayNop` bên BE, `dvc-dong-bo.service.ts`). */
const VN_DATE_RE = /^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/** Parse ngày dạng VN ở trên -> số so sánh được theo thời gian thật (yyyyMMddHHmmss); không khớp
 * cú pháp -> `NaN` (rơi xuống so số/chuỗi thường ở `compareCellText`). */
function parseVnDate(s: string): number {
  const m = VN_DATE_RE.exec(s.trim());
  if (!m) return NaN;
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  return Number(`${yyyy}${mm}${dd}${hh}${mi}${ss}`);
}

/**
 * So 2 GIÁ TRỊ CHUỖI đã đọc sẵn từ 1 cột — tự nhận dạng ngày VN (`dd/MM/yyyy`...) / số / chuỗi
 * thường theo hình dạng, không cần khai trước cột nào kiểu gì. Rỗng luôn xuống cuối bất kể chiều
 * tăng/giảm (tránh dòng thiếu dữ liệu nhảy lên đầu khi sắp xếp giảm dần).
 */
export function compareCellText(a: string, b: string, dir: SortDir): number {
  const ea = isEmpty(a);
  const eb = isEmpty(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;

  const da = parseVnDate(a);
  const db = parseVnDate(b);
  let cmp: number;
  if (!Number.isNaN(da) && !Number.isNaN(db)) {
    cmp = da - db;
  } else {
    const na = /^-?\d+(?:[.,]\d+)?$/.test(a) ? Number(a.replace(",", ".")) : NaN;
    const nb = /^-?\d+(?:[.,]\d+)?$/.test(b) ? Number(b.replace(",", ".")) : NaN;
    cmp = !Number.isNaN(na) && !Number.isNaN(nb) ? na - nb : a.localeCompare(b, "vi");
  }
  return dir === "asc" ? cmp : -cmp;
}
