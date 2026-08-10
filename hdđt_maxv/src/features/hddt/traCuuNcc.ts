import type { DanhMucTraCuuGoc } from "./api/traCuuGoc";

export function rowStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

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

export type MaTraCuuSpec =
  | { src: "field"; field: string }
  | { src: "ttkhac"; ttruong?: string }
  | { src: "cttkhac"; ttruong?: string };

export interface NccTraCuu {
  ten: string;
  /**
   * Trang tra cứu của NCC; `{mst}` = chỗ điền MST người bán (NCC có portal riêng theo tenant). CÙNG
   * DẠNG MẪU với `urlTraCuu` của danh mục BE nên nơi dựng URL không phải phân biệt hai nguồn.
   *
   * Với NCC đã có bộ tải ở BE thì đây chỉ là ĐƯỜNG LÙI khi chưa gọi được danh mục: domain cổng NCC
   * là thứ BE buộc phải biết chính xác để tải tự động, nên BE mới là nguồn chính. Còn NCC chỉ tra cứu
   * tay (VININVOICE, VETC, FPT) thì đây là nguồn DUY NHẤT — BE không có provider cho họ.
   */
  url: string;
  maTraCuu: MaTraCuuSpec;
}


/**
 * NCC phát hành mà FE biết cách RÚT MÃ TRA CỨU, keyed bằng `msttcgp`.
 *
 * Phần còn lại ở đây (`ten`, `url`) chỉ là đường lùi — với NCC đã có bộ tải, danh mục BE là nguồn
 * chính. Cái KHÔNG thể chuyển sang BE là `maTraCuu`: nó mô tả cách bóc mã ra khỏi payload chi tiết
 * mà chỉ FE mới cầm trong tay.
 */
export const TRA_CUU_NCC: Record<string, NccTraCuu> = {
  "0100109106": {
    ten: "Tập đoàn Công nghiệp - Viễn thông quân đội",
    url: "https://vinvoice.viettel.vn/utilities/invoice-search",
    maTraCuu: { src: "ttkhac", ttruong: "Mã số bí mật" },
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
  },
  "0104128565": {
    ten: "Công ty TNHH Hệ thống thông tin FPT",
    url: "https://tracuuhoadon.fpt.com.vn",
    maTraCuu: { src: "cttkhac", ttruong: "TransactionID" },
  },
  "0100684378": {
    ten: "Tập Đoàn Bưu chính viễn thông Việt Nam",
    url: "https://{mst}-tt78.vnpt-invoice.com.vn/",
    maTraCuu: { src: "field", field: "mhdon" },
  },
  "0105232093": {
    ten: "Công ty Cổ phần CyberLotus",
    url: "https://tracuuhoadon1.xcyber.vn/#/tracuuhoadon/tracuu",
    maTraCuu: { src: "cttkhac", ttruong: "MaTraCuu" },
  },
  "0108971656": {
    ten: "Công ty Cổ phần My Software",
    url: "https://tracuu.myinvoice.vn/#/",
    maTraCuu: { src: "field", field: "mhdon" },
  },
  "0105987432": {
    ten: "Công ty Cổ phần Đầu tư công nghệ và thương mại Softdreams",
    url: "https://{mst}hd.easyinvoice.com.vn/Search/Index",
    maTraCuu: { src: "ttkhac", ttruong: "Fkey" },
  },
};

export interface TraCuuResult {
  ten: string;
  url: string;
  /** Chuỗi mã tra cứu (có thể rỗng nếu NCC có entry nhưng payload thiếu field chứa mã). */
  maTraCuu: string;
}

/**
 * URL tra cứu của 1 hóa đơn, ưu tiên từ trong ra ngoài:
 *  1. `urlDaDo[sellerMst]` — NCC nhiều domain mà BE ĐÃ DÒ ra đúng cái nào (EasyInvoice).
 *  2. Mẫu `urlTraCuu` của NCC trong danh mục BE, điền MST người bán vào `{mst}`.
 *  3. `cfg.url` của registry FE — cho NCC chỉ tra cứu tay, hoặc khi chưa gọi được danh mục BE.
 */
function urlTraCuu(
  cfg: NccTraCuu,
  msttcgp: string,
  sellerMst: string,
  danhMuc?: DanhMucTraCuuGoc,
): string {
  const daDo = danhMuc?.urlDaDo[sellerMst];
  if (daDo) return daDo;
  const mau = danhMuc?.nccs.find((n) => n.msttcgp === msttcgp)?.urlTraCuu ?? cfg.url;
  return mau.replaceAll("{mst}", sellerMst);
}

/**
 * Thông tin tra cứu hóa đơn gốc của 1 hóa đơn (từ payload CHI TIẾT). `undefined` = NCC phát hành
 * không có trong registry, tức FE không biết bóc mã tra cứu ở đâu.
 *
 * @param danhMuc Danh mục NCC của BE (`useDanhMucTraCuuGocQuery`). Bỏ trống thì URL lùi về registry
 *   FE — vẫn chạy, chỉ là có thể trỏ sai domain với NCC nhiều portal.
 */
export function traCuuNcc(
  detail: Record<string, unknown> | null | undefined,
  danhMuc?: DanhMucTraCuuGoc,
): TraCuuResult | undefined {
  if (!detail) return undefined;
  const msttcgp = rowStr(detail.msttcgp).trim();
  const cfg = TRA_CUU_NCC[msttcgp];
  if (!cfg) return undefined;
  // Trim Ở ĐÂY, nơi giá trị được LẤY RA (giống `msttcgp` ngay trên) chứ không để mỗi nơi dựng URL tự
  // trim: quên một chỗ là ra subdomain có khoảng trắng, hỏng lặng lẽ chứ không báo lỗi.
  const sellerMst = rowStr(detail.nbmst).trim();
  return {
    ten: cfg.ten,
    url: urlTraCuu(cfg, msttcgp, sellerMst, danhMuc),
    maTraCuu: layMaTraCuu(detail, cfg.maTraCuu),
  };
}

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
