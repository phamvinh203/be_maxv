export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;

/**
 * Field trên row khác tên cột hiển thị — map lại trước khi đọc để sắp xếp/lọc đúng giá trị.
 * `ghiChu1` (cột "Ghi chú 1" của bảng Chi tiết) đọc từ `ghiChu` trên `DetailRow`.
 */
const FIELD_ALIAS: Record<string, string> = { ghiChu1: "ghiChu" };

/** Parse "dd-MM-yyyy" (định dạng CỐ Ý của `ngayLienQuan`, xem `tinhNgayLienQuan`) -> số so sánh được. */
function parseVnDateSort(s: string): number {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : NaN;
}

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

/**
 * So sánh 2 row theo 1 cột — dùng chung cho bảng Tổng quát (`DisplayRow`) và Chi tiết (`DetailRow`),
 * cả 2 chiều đầu vào/đầu ra (tên field vốn đã thống nhất giữa 2 chiều, xem `dauVao.ts`/`dauRa.ts`).
 * Số so bằng số; chuỗi số thuần (vd số hóa đơn) so bằng số để "9" đứng trước "10"; còn lại so chuỗi
 * kiểu 'vi'. Rỗng luôn xuống cuối bất kể chiều tăng/giảm — tránh hóa đơn thiếu dữ liệu nhảy lên đầu
 * khi sắp xếp giảm dần.
 */
export function compareRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  key: string,
  dir: SortDir,
): number {
  const field = FIELD_ALIAS[key] ?? key;
  let va: unknown = a[field];
  let vb: unknown = b[field];
  if (key === "ngayLienQuan") {
    va = parseVnDateSort(String(va ?? ""));
    vb = parseVnDateSort(String(vb ?? ""));
  }
  if (isEmpty(va) && isEmpty(vb)) return 0;
  if (isEmpty(va)) return 1;
  if (isEmpty(vb)) return -1;

  let cmp: number;
  if (typeof va === "number" && typeof vb === "number") {
    cmp = va - vb;
  } else {
    const sa = String(va);
    const sb = String(vb);
    const na = /^-?\d+(\.\d+)?$/.test(sa) ? Number(sa) : NaN;
    const nb = /^-?\d+(\.\d+)?$/.test(sb) ? Number(sb) : NaN;
    cmp = !Number.isNaN(na) && !Number.isNaN(nb) ? na - nb : sa.localeCompare(sb, "vi");
  }
  return dir === "asc" ? cmp : -cmp;
}

/** Sắp xếp 1 mảng row theo `sort` (không đổi mảng gốc); `null` -> trả nguyên mảng. */
export function applySort<T>(rows: T[], sort: SortState): T[] {
  if (!sort) return rows;
  return [...rows].sort((a, b) =>
    compareRows(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>, sort.key, sort.dir),
  );
}

/** Field trên row dùng cho lọc/sắp xếp client — cùng bảng alias với `compareRows`. */
export function fieldOf(row: Record<string, unknown>, key: string): unknown {
  return row[FIELD_ALIAS[key] ?? key];
}
