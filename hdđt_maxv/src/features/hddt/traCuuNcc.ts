/**
 * ===== TRA CỨU HÓA ĐƠN GỐC THEO NHÀ CUNG CẤP (NCC) PHÁT HÀNH =====
 *
 * Mỗi NCC phát hành HĐĐT (Viettel, MISA, VETC…) có:
 *  - một trang tra cứu riêng (URL);
 *  - một chỗ đặt "Mã tra cứu" riêng — baldetail.ttkhac, baldetail.cttkhac, hoặc field top-level
 *    (mhdon/dlieu…). Chỗ đặt này KHÔNG thống nhất giữa các NCC nên không dò chung được.
 *
 * File này là REGISTRY keyed bằng `msttcgp` (MST của NCC phát hành — có sẵn ngay từ lúc tìm kiếm,
 * xem `DetailRow.msttcgp`). Cho một hóa đơn, tra `detail.msttcgp` -> ra URL + cách lấy mã tra cứu.
 *
 * KHÓA LÀ MST (thay vì dò tên field) vì MST NCC cố định, không trùng giữa các NCC, không lệ thuộc
 * khi NCC đổi tên field. Hệ quả: phải biết MST của từng NCC. Khi thêm NCC mới, lấy MST từ
 * `detail.msttcgp` của một hóa đơn mẫu rồi thêm 1 entry bên dưới.
 *
 * CÁCH DÙNG:
 *   const r = traCuuNcc(detail); // { ten, url, maTraCuu } | undefined
 *   if (r) column.value = r.url;        // cột "Link tra cứu hóa đơn gốc"
 *   if (r) column.value = r.maTraCuu;   // cột "Mã tra cứu hóa đơn gốc"
 *
 * Chưa khớp NCC nào (msttcgp chưa có trong registry) -> `undefined` -> ô đi theo quy ước chung
 * (web "—", file trống). Thêm entry khi gặp NCC mới.
 */

/** Ép 1 giá trị bất kỳ về string an toàn (null/undefined -> ""). */
export function rowStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * Lấy `dlieu` đầu tiên trong mảng "thông tin khác" của GDT (`ttkhac`/`cttkhac`). Mỗi phần tử là
 * `{ ttruong, kdlieu, dlieu }`. Truyền `ttruong` để lọc theo tên khóa; bỏ qua để lấy `dlieu` đầu
 * tiên bất kỳ (cho NCC không gắn `ttruong`). Không có -> "".
 */
function dlieuDauTien(arr: unknown, ttruong?: string): string {
  if (!Array.isArray(arr)) return "";
  for (const raw of arr) {
    const it = raw as Record<string, unknown> | null;
    if (!it) continue;
    if (ttruong !== undefined && it.ttruong !== ttruong) continue;
    if (it.dlieu != null && it.dlieu !== "") return String(it.dlieu);
  }
  return "";
}

/**
 * Đặc tả cách lấy "Mã tra cứu" của một NCC. Ba nguồn:
 *  - `field`: field top-level của payload (vd Viettel để ở `dlieu`/`mhdon`).
 *  - `ttkhac`: trong mảng `detail.ttkhac`, lọc theo `ttruong` nếu có.
 *  - `cttkhac`: trong mảng `detail.cttkhac`, lọc theo `ttruong` nếu có (vd MISA để `TransactionID`).
 */
export type MaTraCuuSpec =
  | { src: "field"; field: string }
  | { src: "ttkhac"; ttruong?: string }
  | { src: "cttkhac"; ttruong?: string };

/** Context cho URL builder động — chứa dữ liệu của từng hóa đơn để build URL per-row. */
export interface NccUrlCtx {
  /** MST người bán đầy đủ (nbmst) — có thể có đuôi chi nhánh `-001` (vd `0900887803-001`). */
  sellerMst: string;
}

/** 1 entry registry: NCC phát hành + URL tra cứu + cách lấy mã tra cứu. */
export interface NccTraCuu {
  /** Tên NCC (hiển thị/chú thích). */
  ten: string;
  /**
   * Trang tra cứu hóa đơn gốc của NCC. Có thể là:
   *  - string cố định (MISA, Viettel…) — portal chung cho mọi hóa đơn của NCC đó.
   *  - function nhận `{ sellerMst }` trả URL per-row — cho NCC portal per-tenant như VNPT (mỗi MST
   *    người bán có subdomain riêng `<mst>-tt78.vnpt-invoice.com.vn`).
   */
  url: string | ((ctx: NccUrlCtx) => string);
  /** Đường dẫn lấy mã tra cứu từ payload GDT. */
  maTraCuu: MaTraCuuSpec;
  /**
   * NCC đã có bộ tải TỰ ĐỘNG ở BE (dispatcher `traCuuGoc/index.ts`) chưa. Bật `true` khi thêm bộ tải
   * cho NCC đó. Dialog "Tải hóa đơn gốc" đọc cờ này để biết NCC nào tải được / đánh dấu "chưa hỗ trợ"
   * — nguồn DUY NHẤT, khỏi giữ một danh sách MST song song.
   */
  taiTuDong?: boolean;
}


export const TRA_CUU_NCC: Record<string, NccTraCuu> = {
  "0100109106": {
    ten: "Tập đoàn Công nghiệp - Viễn thông quân đội",
    url: "https://vinvoice.viettel.vn/utilities/invoice-search",
    maTraCuu: { src: "ttkhac", ttruong: "Mã số bí mật" },
    taiTuDong: true,
  },
  "0109282176": {
    ten: "Công ty Cổ phần Hóa đơn điện tử VININVOICE",
    url: "https://tracuu.vininvoice.vn/#/",
    maTraCuu: { src: "field", field: "mhdon" },
  },
  "0107500414": {
    ten: "CÔNG TY TNHH THU PHÍ TỰ ĐỘNG VETC",
    url: "https://tracuuhoadon.vetc.com.vn",
    maTraCuu: { src: "cttkhac" },
  },
  "0101243150": {
    ten: "Công ty Cổ phần MISA",
    url: "https://www.meinvoice.vn/tra-cuu/",
    maTraCuu: { src: "cttkhac", ttruong: "TransactionID" },
    taiTuDong: true,
  },
  "0104128565": {
    ten: "Công ty TNHH Hệ thống thông tin FPT",
    url: "https://tracuuhoadon.fpt.com.vn",
    maTraCuu: { src: "cttkhac", ttruong: "TransactionID" },
  },
  "0100684378": {
    ten: "Tập Đoàn Bưu chính viễn thông Việt Nam",
    url: ({ sellerMst }) => `https://${sellerMst.trim()}-tt78.vnpt-invoice.com.vn/`,
    maTraCuu: { src: "field", field: "mhdon" },
    taiTuDong: true,
  },
  "0105232093": {
    ten: "Công ty Cổ phần CyberLotus",
    url: "https://tracuuhoadon1.xcyber.vn/#/tracuuhoadon/tracuu",
    maTraCuu: { src: "cttkhac", ttruong: "MaTraCuu" },
    taiTuDong: true,
  },
  "0108971656": {
    ten: "Công ty Cổ phần My Software",
    url: "https://tracuu.myinvoice.vn/#/",
    maTraCuu: { src: "field", field: "mhdon" },
    taiTuDong: true,
  },
  "0105987432": {
    ten: "Công ty Cổ phần Đầu tư công nghệ và thương mại Softdreams",
    // Portal tenant EasyInvoice: subdomain là `<nbmst>hd` (vd `0108787907` -> `0108787907hd.easyinvoice.vn`).
    // Giống VNPT, mỗi công ty phát hành qua Softdreams có cổng riêng nên KHÔNG hardcode được MST nào.
    // Giữ NGUYÊN `nbmst` kể cả đuôi chi nhánh `-001`: chưa gặp mẫu hóa đơn chi nhánh nào để biết
    // Softdreams tách cổng theo chi nhánh (như VNPT) hay dùng chung cổng MST mẹ — gặp thì kiểm chứng
    // rồi sửa ở đây, đừng tự strip đuôi vì đoán.
    url: ({ sellerMst }) => `https://${sellerMst.trim()}hd.easyinvoice.vn/Search/Index`,
    maTraCuu: { src: "ttkhac", ttruong: "Fkey" },
    taiTuDong: true,
  }
};

/** Kết quả tra cứu 1 hóa đơn: URL + mã tra cứu của NCC phát hành. */
export interface TraCuuResult {
  ten: string;
  url: string;
  /** Chuỗi mã tra cứu (có thể rỗng nếu NCC có entry nhưng payload thiếu field chứa mã). */
  maTraCuu: string;
}

/**
 * Tra NCC theo `detail.msttcgp`. Trả `{ ten, url, maTraCuu }` nếu khớp registry, ngược lại `undefined`.
 * `maTraCuu` rỗng khi NCC có entry nhưng payload không có field chứa mã (vd thiếu cttkhac).
 *
 * URL: nếu registry khai function (NCC per-tenant như VNPT), gọi function với `sellerMst` = `nbmst`
 * của từng hóa đơn để build URL riêng. Còn string thì dùng nguyên.
 */
export function traCuuNcc(detail: Record<string, unknown> | null | undefined): TraCuuResult | undefined {
  if (!detail) return undefined;
  const cfg = TRA_CUU_NCC[rowStr(detail.msttcgp).trim()];
  if (!cfg) return undefined;
  const sellerMst = rowStr(detail.nbmst);
  const url = typeof cfg.url === "function" ? cfg.url({ sellerMst }) : cfg.url;
  return { ten: cfg.ten, url, maTraCuu: layMaTraCuu(detail, cfg.maTraCuu) };
}

/** Lấy mã tra cứu từ payload theo đặc tả. Export riêng để dùng khi đã giữ sẵn `NccTraCuu`. */
export function layMaTraCuu(detail: Record<string, unknown>, spec: MaTraCuuSpec): string {
  switch (spec.src) {
    case "field":
      return rowStr(detail[spec.field]);
    case "ttkhac":
      return dlieuDauTien(detail.ttkhac, spec.ttruong);
    case "cttkhac":
      return dlieuDauTien(detail.cttkhac, spec.ttruong);
  }
}
