import { apiFetch, apiFetchText } from "../../../lib/http";
import type { Ky } from "../ky";

/** Một ô kế toán sửa tay + lý do. */
export interface GhiDeItem {
  gia: number;
  lyDo?: string;
}

/** Một dòng của phụ lục giảm thuế (mục I hoặc mục II). */
export interface DongPhuLuc {
  tenHang: string;
  giaTri: number;
  thue: number;
}

/** Phụ lục "Giảm thuế GTGT theo NQ 204/2025" — nộp kèm tờ khai khi kỳ có hàng 8%. */
export interface PhuLuc204 {
  muaVao: DongPhuLuc;
  banRa: DongPhuLuc & {
    thueSuatQuyDinh: number;
    thueSuatSauGiam: number;
    /** [08] = giá trị × (thuế suất quy định − sau giảm). */
    thueDuocGiam: number;
  };
  /** [09] = [08] − [06]. */
  chenhLech: number;
  rong: boolean;
}

export interface HoaDonTreo {
  id: string;
  lyDo: string;
}

/** Bản tờ khai của một kỳ — khớp `BanToKhai` bên `toKhaiGtgt01.service.ts`. */
export interface BanToKhai {
  ky: Ky;
  trangThai: "nhap" | "chot";
  /** Bộ chỉ tiêu CUỐI (số đem đi nộp). */
  ct: Record<string, number>;
  /** Số máy tự tính — giữ để đối chiếu với ô đã sửa tay. */
  ctMay: Record<string, number>;
  ghiDe: Record<string, GhiDeItem>;
  /** [22] ở đâu ra: kỳ trước đã chốt | kỳ trước còn nháp (số có thể đổi) | nhập tay. */
  nguonCt22: "ky_truoc" | "ky_truoc_nhap" | "nhap_tay";
  soHdBan: number;
  soHdMua: number;
  soHdKhongKeKhai: number;
  hdThieuDetail: number;
  treo: HoaDonTreo[];
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  /** `null` = kỳ không có hàng 8% nên không phải nộp phụ lục. */
  phuLuc: PhuLuc204 | null;
  /** Câu cảnh báo của lượt tính — số vẫn ra, nhưng có chỗ đáng ngờ cần người xem lại. */
  canhBao: string[];
  /** Kỳ mà [22] nối từ đó; `null` khi nhập tay. Có thể khác loại kỳ hiện tại (đổi tháng<->quý). */
  kyNguonCt22: Ky | null;
  /** Ô kế toán được phép sửa tay — server là bên quyết, client không đoán. */
  oSuaDuoc: string[];
  tinhLuc: string | null;
}

export interface DongKyDaLap {
  nam: number;
  kyLoai: Ky["kyLoai"];
  kySo: number;
  trangThai: string;
  ct40: number;
  ct43: number;
  tinhLuc: string | null;
}

/** `2026/thang/7` — kỳ nằm trên path của các endpoint thao tác trên một bản. */
function duongDanKy(ky: Ky): string {
  return `${ky.nam}/${ky.kyLoai}/${ky.kySo}`;
}

/** Tính tờ khai từ bảng kê của kỳ rồi ghi bản nháp. */
export async function postTinh(ky: Ky): Promise<BanToKhai> {
  return apiFetch<BanToKhai>("/to-khai/gtgt01/tinh", {
    method: "POST",
    body: JSON.stringify(ky),
  });
}

/** Đọc bản đã lưu; kỳ chưa lập -> BE trả 404 (`code: "chua_co_ban"`). */
export async function getBan(ky: Ky): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(`/to-khai/gtgt01/${duongDanKy(ky)}`);
}

/** Lưu ô sửa tay rồi tính lại — trả về bản đã cập nhật. */
export async function putGhiDe(
  ky: Ky,
  ghiDe: Record<string, GhiDeItem>,
): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(`/to-khai/gtgt01/${duongDanKy(ky)}`, {
    method: "PUT",
    body: JSON.stringify({ ghiDe }),
  });
}

/** Sửa hai ô mô tả hàng hóa của phụ lục; số luôn tính từ hóa đơn nên không gửi lên. */
export async function putPhuLuc(
  ky: Ky,
  ten: { muaVao?: string; banRa?: string },
): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(`/to-khai/gtgt01/${duongDanKy(ky)}/phu-luc`, {
    method: "PUT",
    body: JSON.stringify(ten),
  });
}

export async function postDoiTrangThai(ky: Ky, chot: boolean): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(
    `/to-khai/gtgt01/${duongDanKy(ky)}/${chot ? "chot" : "mo-khoa"}`,
    { method: "POST" },
  );
}

export async function getDanhSachKy(): Promise<DongKyDaLap[]> {
  return apiFetch<DongKyDaLap[]>("/to-khai/gtgt01/danh-sach");
}

/**
 * Tải file XML tờ khai để nạp vào HTKK rồi ký và nộp.
 *
 * Trả VĂN BẢN THÔ chứ không JSON — thân phản hồi chính là nội dung file.
 */
export async function getXml(ky: Ky): Promise<string> {
  return apiFetchText(`/to-khai/gtgt01/${duongDanKy(ky)}/xml`);
}
