import { api } from "@/lib/apiClient";
import type { TrangThai } from "../../types";

/** Gọi API nhân viên HRM (`hrm_nhan_vien` trong DB tenant). */
const BASE = "/hrm/nhan-vien";

export type LoaiHopDongApi = "thu_viec" | "hdld" | "hdvc";
export type KieuLuongApi = "gross" | "net";
export type GioiTinhApi = "nam" | "nu" | "khac";

/** Dòng BE trả về. Ngày là chuỗi ISO đầy đủ (`2026-03-01T00:00:00.000Z`), không phải YYYY-MM-DD. */
export interface NhanVienApiRow {
  ma_nv: string;
  ho_ten: string;
  ngay_sinh: string | null;
  so_cccd: string | null;
  mst_ca_nhan: string | null;
  dien_thoai: string | null;
  email: string | null;
  dia_chi: string | null;
  gioi_tinh: GioiTinhApi | null;
  ma_pb: string | null;
  chuc_vu: string | null;
  cap_bac: string | null;
  ngay_vao_lam: string;

  /**
   * Hợp đồng HIỆN HÀNH — BE TÍNH lúc đọc từ `hrm_hop_dong`, không phải cột lưu sẵn.
   * `null` khi nhân viên chưa có hợp đồng nào. Chỉ đọc: KHÔNG gửi ngược lên trong PUT/POST,
   * muốn đổi thì sửa ở tab Lịch sử hợp đồng.
   */
  so_hop_dong: string | null;
  loai_hop_dong: LoaiHopDongApi | null;
  kieu_luong: KieuLuongApi | null;
  ngay_hieu_luc_toi: string | null;
  bhxh: boolean | null;
  tncn: boolean | null;

  mien_cham_cong: boolean;
  cong_doan: boolean;

  /**
   * BA TRƯỜNG NGÂN HÀNG CÓ THỂ VẮNG HẲN KHỎI PHẢN HỒI — không phải `null`.
   *
   * Người không được cấp quyền xem dữ liệu lương nhận payload đã bị **xóa khóa**
   * (`cheTruongLuong`, BR-hrm-059 / contract 3.1c): BE cố ý bỏ hẳn trường thay vì trả `null`,
   * vì `null` không phân biệt được "nhân viên chưa khai số tài khoản" với "bạn không được xem".
   *
   * Vì vậy khai `?:` — đọc phải luôn `?? ""`, và muốn biết CÓ QUYỀN hay không thì kiểm sự có
   * mặt của khóa (`coTruongNganHang`), đừng kiểm giá trị.
   */
  so_tai_khoan?: string | null;
  ten_tai_khoan?: string | null;
  ngan_hang?: string | null;

  ghi_chu: string | null;
  status: TrangThai;
  /** Chỉ có ở GET danh sách (BE tra sẵn), không có ở GET chi tiết. */
  ten_pb?: string | null;
  so_npt?: number;
}

/**
 * Payload này CÓ chứa ba trường ngân hàng không — tức phiên hiện tại có quyền xem dữ liệu lương
 * ở công ty đang chọn không.
 *
 * Kiểm bằng `in` chứ KHÔNG bằng `!= null`: người có quyền xem một nhân viên chưa khai tài khoản
 * vẫn nhận đủ ba khóa với giá trị `null`, còn người không có quyền thì không có khóa nào.
 */
export function coTruongNganHang(row: NhanVienApiRow): boolean {
  return "so_tai_khoan" in row;
}

/** Thân request sửa (PUT thay TOÀN BỘ bản ghi, không phải patch từng trường). */
export interface NhanVienApiBody {
  ho_ten: string;
  ngay_sinh: string | null;
  so_cccd: string | null;
  mst_ca_nhan: string | null;
  dien_thoai: string | null;
  email: string | null;
  dia_chi: string | null;
  gioi_tinh: GioiTinhApi | null;
  ma_pb: string | null;
  chuc_vu: string | null;
  cap_bac: string | null;
  ngay_vao_lam: string;
  mien_cham_cong: boolean;
  cong_doan: boolean;

  /**
   * Ba trường ngân hàng là TÙY CHỌN ở đường ghi — người không có quyền xem lương thì **không
   * gửi** chúng lên.
   *
   * BE cũng tự loại ba khóa này khỏi payload của người không có quyền (`boTruongLuongKhiGhi`),
   * nhưng FE vẫn phải bỏ ở đầu này: màn hình của họ không có sẵn giá trị cũ để gửi lại, gửi
   * `null` là tự khai "xóa trắng" và chỉ nhờ may mắn ở guard BE mới không mất dữ liệu.
   */
  so_tai_khoan?: string | null;
  ten_tai_khoan?: string | null;
  ngan_hang?: string | null;

  ghi_chu: string | null;
  /**
   * BẮT BUỘC — `nhanVienUpdateSchema` bỏ mặc định `'1'` từ BR-hrm-067 (bịt BUG-HRM-26).
   * Thiếu trường là 400, và trước đó nó âm thầm đưa nhân viên đã nghỉ trở lại "đang làm".
   */
  status: TrangThai;
}

/** Thân request tạo: bỏ trống `ma_nv` thì BE tự sinh (`NV0001`…). */
export interface NhanVienApiCreateBody extends NhanVienApiBody {
  ma_nv?: string | null;
}

export interface NhanVienListParams {
  ma_nv?: string;
  ho_ten?: string;
  ma_pb?: string;
  status?: TrangThai;
}

export function listNhanVien(
  params?: NhanVienListParams,
): Promise<NhanVienApiRow[]> {
  return api.get<NhanVienApiRow[]>(BASE, { params });
}

export function getNhanVien(maNv: string): Promise<NhanVienApiRow> {
  return api.get<NhanVienApiRow>(`${BASE}/${encodeURIComponent(maNv)}`);
}

export function createNhanVien(
  body: NhanVienApiCreateBody,
): Promise<{ ma_nv: string }> {
  return api.post(BASE, body);
}

export function updateNhanVien(
  maNv: string,
  body: NhanVienApiBody,
): Promise<{ ma_nv: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maNv)}`, body);
}

/**
 * Xóa MỀM — BE trả kèm số người phụ thuộc bị **ẩn theo** (không phải xóa).
 *
 * Tên trường là `so_npt_an_theo` (`nhanVien.service.ts` — `deleteNhanVien`). Bản trước khai
 * `so_npt_da_xoa` nên luôn đọc ra `undefined` (ĐS-04): xóa mềm chỉ đặt `da_xoa = true`, người
 * phụ thuộc vẫn nằm nguyên trong DB và chỉ vô hình vì mọi truy vấn con lọc theo nhân viên
 * chưa xóa. "Ẩn theo" là đúng ngữ nghĩa, "đã xóa" là sai.
 */
export function deleteNhanVien(
  maNv: string,
): Promise<{ ma_nv: string; so_npt_an_theo: number }> {
  return api.del(`${BASE}/${encodeURIComponent(maNv)}`);
}
