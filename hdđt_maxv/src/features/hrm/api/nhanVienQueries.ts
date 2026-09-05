/**
 * Hook nhân viên chạy trên API THẬT — bản thay thế của `mock/hooks/nhanVien.ts`.
 * Giữ nguyên chữ ký hook bản mock nên component gần như chỉ đổi dòng import.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LỆCH MÔ HÌNH — đọc trước khi sửa file này
 *
 * Mock FE tách HỢP ĐỒNG thành bảng riêng (1 NV nhiều HĐ, có lịch sử). BE lại DẸT một hợp
 * đồng hiện hành vào chính bản ghi nhân viên (theo spec: số HĐ / loại HĐ / kiểu lương /
 * ngày hiệu lực từ-tới là trường bắt buộc của nhân viên).
 *
 * Trong đợt này tab Lịch sử hợp đồng / Hồ sơ / Người phụ thuộc VẪN chạy mock, nên:
 *   - THÊM: form có nhóm hợp đồng (tùy chọn) -> lấy sang; bỏ trống thì điền GIÁ TRỊ TẠM
 *     (xem `hopDongTam`) để qua được ràng buộc bắt buộc của BE.
 *   - SỬA: form không có ô hợp đồng -> đọc lại bản ghi trên BE rồi GIỮ NGUYÊN phần hợp
 *     đồng, chỉ ghi đè phần thông tin cá nhân. Không bịa lại giá trị mới.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { sinhMaNhanVien } from "../cay";
import { CHUC_VU, PB_CHUA_GAN } from "../constants";
import { homNay, nhan } from "../format";
import type {
  HopDong,
  HopDongFormValues,
  NhanVien,
  NhanVienFilters,
  NhanVienRow,
  ThemNhanVienPayload,
} from "../types";
import {
  createNhanVien,
  deleteNhanVien,
  getNhanVien,
  listNhanVien,
  updateNhanVien,
  type KieuLuongApi,
  type LoaiHopDongApi,
  type NhanVienApiBody,
  type NhanVienApiRow,
} from "./nhanVienApi";

export const hrmNhanVienKeys = {
  all: ["hrm-nhan-vien"] as const,
  list: (companyId: string | null) =>
    ["hrm-nhan-vien", companyId, "list"] as const,
};

/** ISO của BE (`2026-03-01T00:00:00.000Z`) -> `YYYY-MM-DD` cho `<input type="date">`. */
function veNgayInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** `YYYY-MM-DD` của form -> chuỗi BE nhận; rỗng -> null. */
function veNgayApi(s: string): string | null {
  return s.trim() ? s.trim() : null;
}

/** Mã chức vụ FE (`CV05`) -> nhãn lưu ở BE (`Kế toán trưởng`) cho dễ đọc trong DB. */
function chucVuVeApi(maCv: string): string | null {
  const s = maCv.trim();
  return s ? nhan(CHUC_VU, s) : null;
}

/**
 * Nhãn ở BE -> mã chức vụ FE. Không khớp danh mục thì trả nguyên chuỗi: ô Select hiện đúng
 * chữ đó (`nhan()` tự fallback về chính giá trị), không nuốt mất dữ liệu người dùng nhập.
 */
function chucVuVeFe(chucVu: string | null): string {
  if (!chucVu) return "";
  return CHUC_VU.find((cv) => cv.label === chucVu)?.value ?? chucVu;
}

/** Loại HĐ: FE có 5 giá trị, BE (theo spec) có 3 — gom về 3. */
function loaiHopDongVeApi(loaiHd: string): LoaiHopDongApi {
  if (loaiHd === "thu_viec") return "thu_viec";
  if (loaiHd === "khoan") return "hdvc";
  return "hdld"; // khong_xac_dinh | xac_dinh | thoi_vu đều là hợp đồng lao động
}

function loaiHopDongVeFe(loai: LoaiHopDongApi): HopDong["loai_hd"] {
  if (loai === "thu_viec") return "thu_viec";
  if (loai === "hdvc") return "khoan";
  return "xac_dinh";
}

function veKieuFe(r: NhanVienApiRow): NhanVien {
  return {
    ma_nv: r.ma_nv,
    ho_ten: r.ho_ten,
    so_cccd: r.so_cccd ?? "",
    mst_ca_nhan: r.mst_ca_nhan ?? "",
    ngay_sinh: veNgayInput(r.ngay_sinh),
    gioi_tinh: r.gioi_tinh ?? "nam",
    dien_thoai: r.dien_thoai ?? "",
    email: r.email ?? "",
    dia_chi: r.dia_chi ?? "",
    ghi_chu: r.ghi_chu ?? "",
    ma_pb: r.ma_pb,
    ma_cv: chucVuVeFe(r.chuc_vu),
    cap_bac: r.cap_bac ?? "",
    cong_doan: r.cong_doan,
    ngay_vao: veNgayInput(r.ngay_vao_lam),
    ngan_hang: r.ngan_hang ?? "",
    so_tk: r.so_tai_khoan ?? "",
    chu_tk: r.ten_tai_khoan ?? "",
    status: r.status,
  };
}

/** Dựng đối tượng hợp đồng từ phần đã dẹt vào nhân viên, để bảng hiện đúng cột Số HĐ/Kiểu lương. */
function hopDongTuApi(r: NhanVienApiRow): HopDong {
  return {
    id: `nv-${r.ma_nv}`,
    ma_nv: r.ma_nv,
    so_hd: r.so_hop_dong,
    loai_hd: loaiHopDongVeFe(r.loai_hop_dong),
    kieu_luong: r.kieu_luong === "net" ? "NET" : "GROSS",
    // BE chưa có cột tiền lương (spec nhân viên chỉ có Gross/Net) — bảng lương vẫn chạy mock.
    luong_chinh: 0,
    luong_bhxh: 0,
    ngay_bat_dau: veNgayInput(r.ngay_vao_lam),
    ngay_ket_thuc: veNgayInput(r.ngay_hieu_luc_toi),
    trich_bhxh: r.bhxh,
    tinh_tncn: r.tncn,
    ghi_chu: "",
  };
}

/** Phần hợp đồng của body BE, lấy từ nhóm hợp đồng trên form (nếu người dùng có nhập). */
function hopDongVeApi(
  hd: HopDongFormValues,
): Pick<
  NhanVienApiBody,
  | "so_hop_dong"
  | "loai_hop_dong"
  | "kieu_luong"
  | "ngay_vao_lam"
  | "ngay_hieu_luc_toi"
  | "bhxh"
  | "tncn"
> {
  return {
    so_hop_dong: hd.so_hd.trim(),
    loai_hop_dong: loaiHopDongVeApi(hd.loai_hd),
    kieu_luong: (hd.kieu_luong === "NET" ? "net" : "gross") as KieuLuongApi,
    ngay_vao_lam: hd.ngay_bat_dau,
    ngay_hieu_luc_toi: veNgayApi(hd.ngay_ket_thuc),
    bhxh: hd.trich_bhxh,
    tncn: hd.tinh_tncn,
  };
}

/**
 * Giá trị TẠM khi thêm nhân viên mà bỏ trống nhóm hợp đồng.
 *
 * BE bắt buộc số HĐ / loại HĐ / kiểu lương / ngày vào làm (spec đánh dấu *), còn form hiện tại
 * cho phép "ký hợp đồng sau". Điền tạm để tạo được hồ sơ và xem màn hình chạy; số HĐ đặt dạng
 * `TAM-<mã NV>` để nhìn là biết cần sửa lại, không phải dữ liệu thật.
 */
function hopDongTam(maNv: string, ngayVao: string) {
  return {
    so_hop_dong: `TAM-${maNv || Date.now().toString().slice(-6)}`,
    loai_hop_dong: "hdld" as LoaiHopDongApi,
    kieu_luong: "gross" as KieuLuongApi,
    ngay_vao_lam: ngayVao || homNay(),
    ngay_hieu_luc_toi: null,
    bhxh: true,
    tncn: true,
  };
}

/** Phần thông tin cá nhân — dùng chung cho cả thêm và sửa. */
function thongTinVeApi(
  nv: NhanVien,
): Omit<
  NhanVienApiBody,
  | "so_hop_dong"
  | "loai_hop_dong"
  | "kieu_luong"
  | "ngay_vao_lam"
  | "ngay_hieu_luc_toi"
  | "bhxh"
  | "tncn"
  | "mien_cham_cong"
> {
  return {
    ho_ten: nv.ho_ten.trim(),
    ngay_sinh: veNgayApi(nv.ngay_sinh),
    so_cccd: nv.so_cccd.trim() || null,
    mst_ca_nhan: nv.mst_ca_nhan.trim() || null,
    dien_thoai: nv.dien_thoai.trim() || null,
    email: nv.email.trim() || null,
    dia_chi: nv.dia_chi.trim() || null,
    gioi_tinh: nv.gioi_tinh,
    ma_pb: nv.ma_pb,
    chuc_vu: chucVuVeApi(nv.ma_cv),
    cap_bac: nv.cap_bac.trim() || null,
    cong_doan: nv.cong_doan,
    so_tai_khoan: nv.so_tk.trim() || null,
    ten_tai_khoan: nv.chu_tk.trim() || null,
    ngan_hang: nv.ngan_hang.trim() || null,
    ghi_chu: nv.ghi_chu.trim() || null,
    status: nv.status,
  };
}

function useDanhSachNhanVien() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hrmNhanVienKeys.list(currentCompanyId),
    queryFn: () => listNhanVien(),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Danh sách thô — dùng cho ô chọn nhân viên. */
export function useNhanVienList(): NhanVien[] {
  const { data } = useDanhSachNhanVien();
  return useMemo(() => (data ?? []).map(veKieuFe), [data]);
}

/** Mã gợi ý cho form thêm mới. BE vẫn tự sinh nếu để trống, đây chỉ là gợi ý hiện sẵn trên ô. */
export function useMaNhanVienMoi(): string {
  const danhSach = useNhanVienList();
  return useMemo(() => sinhMaNhanVien(danhSach), [danhSach]);
}

/**
 * Danh sách đã lọc, kèm tên phòng ban / chức vụ / hợp đồng / số NPT.
 * Lọc ở client y như bản mock (danh mục nhỏ, và BE chưa có tham số tìm chung `q` lẫn
 * "chưa gán phòng ban") để hành vi bộ lọc không đổi.
 */
export function useNhanVienRows(filters: NhanVienFilters): {
  rows: NhanVienRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachNhanVien();

  const rows = useMemo<NhanVienRow[]>(() => {
    const tuKhoa = filters.q.trim().toLowerCase();

    return (data ?? [])
      .filter((r) => {
        if (filters.status && r.status !== filters.status) return false;
        if (filters.ma_pb === PB_CHUA_GAN && r.ma_pb) return false;
        if (filters.ma_pb && filters.ma_pb !== PB_CHUA_GAN && r.ma_pb !== filters.ma_pb) {
          return false;
        }
        if (!tuKhoa) return true;
        return [r.ma_nv, r.ho_ten, r.so_cccd ?? "", r.dien_thoai ?? ""].some(
          (truong) => truong.toLowerCase().includes(tuKhoa),
        );
      })
      .map((r) => ({
        ...veKieuFe(r),
        ten_pb: r.ten_pb ?? (r.ma_pb ?? ""),
        ten_cv: r.chuc_vu ?? "",
        hop_dong: hopDongTuApi(r),
        so_npt: r.so_npt ?? 0,
      }));
  }, [data, filters]);

  return { rows, isLoading, isError, error };
}

/** Chi tiết một nhân viên — dialog sửa nạp từ đây. */
export function useNhanVienDetail(maNv: string | null): NhanVien | null {
  const danhSach = useNhanVienList();
  return useMemo(
    () => (maNv ? (danhSach.find((nv) => nv.ma_nv === maNv) ?? null) : null),
    [danhSach, maNv],
  );
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: hrmNhanVienKeys.all });
}

/** Tạo nhân viên. Nhóm hợp đồng trên form là tùy chọn — bỏ trống thì điền tạm (xem đầu file). */
export function useThemNhanVien() {
  const lamMoi = useLamMoi();
  const them = useMutation({ mutationFn: createNhanVien, onSuccess: lamMoi });

  return useCallback(
    async (payload: ThemNhanVienPayload) => {
      const nv = payload.nhan_vien;
      if (!nv.ho_ten.trim()) throw new Error("Họ và tên không được để trống.");

      const coNhapHopDong = Boolean(
        payload.hop_dong?.so_hd.trim() && payload.hop_dong?.ngay_bat_dau,
      );
      const phanHopDong = coNhapHopDong
        ? hopDongVeApi(payload.hop_dong as HopDongFormValues)
        : hopDongTam(nv.ma_nv.trim(), nv.ngay_vao);

      await them.mutateAsync({
        ma_nv: nv.ma_nv.trim() || null,
        ...thongTinVeApi(nv),
        ...phanHopDong,
        mien_cham_cong: false,
      });
    },
    [them],
  );
}

/**
 * Sửa nhân viên. PUT của BE thay TOÀN BỘ bản ghi, mà form sửa không có ô hợp đồng — nên đọc
 * lại bản ghi hiện tại rồi giữ nguyên phần hợp đồng, tránh ghi đè mất số HĐ đã nhập.
 */
export function useSuaNhanVien() {
  const lamMoi = useLamMoi();
  const sua = useMutation({
    mutationFn: ({ maNv, body }: { maNv: string; body: NhanVienApiBody }) =>
      updateNhanVien(maNv, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (nv: NhanVien) => {
      if (!nv.ho_ten.trim()) throw new Error("Họ và tên không được để trống.");

      const hienTai = await getNhanVien(nv.ma_nv);
      await sua.mutateAsync({
        maNv: nv.ma_nv,
        body: {
          ...thongTinVeApi(nv),
          so_hop_dong: hienTai.so_hop_dong,
          loai_hop_dong: hienTai.loai_hop_dong,
          kieu_luong: hienTai.kieu_luong,
          // Ô "Ngày vào" trên form chính là ngày hiệu lực TỪ của hợp đồng — cho sửa;
          // các trường hợp đồng còn lại giữ nguyên vì form không có ô tương ứng.
          ngay_vao_lam: nv.ngay_vao || hienTai.ngay_vao_lam.slice(0, 10),
          ngay_hieu_luc_toi: hienTai.ngay_hieu_luc_toi
            ? hienTai.ngay_hieu_luc_toi.slice(0, 10)
            : null,
          bhxh: hienTai.bhxh,
          tncn: hienTai.tncn,
          mien_cham_cong: hienTai.mien_cham_cong,
        },
      });
    },
    [sua],
  );
}

/** Xóa — người phụ thuộc THẬT của nhân viên bị xóa theo (BE cascade). */
export function useXoaNhanVien() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deleteNhanVien, onSuccess: lamMoi });

  return useCallback(
    async (maNv: string) => {
      await xoa.mutateAsync(maNv);
    },
    [xoa],
  );
}
