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

export interface NccUrlCtx {
  sellerMst: string;
}
export interface NccTraCuu {
  ten: string;
  url: string | ((ctx: NccUrlCtx) => string);
  maTraCuu: MaTraCuuSpec;
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
    url: ({ sellerMst }) => `https://${sellerMst.trim()}hd.easyinvoice.vn/Search/Index`,
    maTraCuu: { src: "ttkhac", ttruong: "Fkey" },
    taiTuDong: true,
  }
};

export interface TraCuuResult {
  ten: string;
  url: string;
  /** Chuỗi mã tra cứu (có thể rỗng nếu NCC có entry nhưng payload thiếu field chứa mã). */
  maTraCuu: string;
}

export function traCuuNcc(detail: Record<string, unknown> | null | undefined): TraCuuResult | undefined {
  if (!detail) return undefined;
  const cfg = TRA_CUU_NCC[rowStr(detail.msttcgp).trim()];
  if (!cfg) return undefined;
  const sellerMst = rowStr(detail.nbmst);
  const url = typeof cfg.url === "function" ? cfg.url({ sellerMst }) : cfg.url;
  return { ten: cfg.ten, url, maTraCuu: layMaTraCuu(detail, cfg.maTraCuu) };
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
