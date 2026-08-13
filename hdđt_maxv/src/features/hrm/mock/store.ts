/**
 * Kho dữ liệu HRM của pha hardcode: một `useReducer` duy nhất cho cả ba màn hình.
 *
 * Gom chung thay vì để mỗi bảng tự giữ state vì các con số bắc cầu qua nhau —
 * cột "Nhân viên" ở màn Phòng ban đếm từ danh sách nhân viên, cột "NPT" ở màn
 * Nhân viên đếm từ danh sách người phụ thuộc, và "Gán nhanh" sửa nhân viên
 * nhưng làm đổi số ở màn Phòng ban. Một kho thì các số này tự khớp.
 *
 * Reducer chỉ ghi state, **không kiểm tra ràng buộc** — phần đó nằm ở
 * `hooks.ts` để còn ném lỗi có thông điệp cho người dùng.
 */

import { createContext, type Dispatch } from "react";
import type {
  BanBuTruNhanVien,
  BanChuyenCanNhanVien,
  BanKpiNhanVien,
  BanLuongPhanTramNhanVien,
  BanLuongSanPhamNhanVien,
  BanTangCaNhanVien,
  BanThuongNhanVien,
  CaLamViec,
  CauHinhMacDinh,
  CauTrucLuong,
  ChiTieuKpi,
  DongBuTru,
  DongChuyenCan,
  DongKpi,
  DongLuongPhanTram,
  DongLuongSanPham,
  DongTangCa,
  DongThuong,
  HopDong,
  KhoanBuTru,
  KhoanLuong,
  LoaiChuyenCan,
  NgayLe,
  NguoiPhuThuoc,
  NhanVien,
  OChamCong,
  PhongBan,
  SanPham,
  SetLuongNhanVien,
  TaiLieu,
} from "../types";
import {
  BAN_BU_TRU_MAU,
  BAN_CHUYEN_CAN_MAU,
  BAN_KPI_MAU,
  BAN_LUONG_PHAN_TRAM_MAU,
  BAN_LUONG_SAN_PHAM_MAU,
  BAN_TANG_CA_MAU,
  BAN_THUONG_MAU,
  CA_LAM_VIEC_MAU,
  CAU_HINH_MAU,
  CAU_TRUC_LUONG_MAU,
  CHI_TIEU_KPI_MAU,
  HOP_DONG_MAU,
  KHOAN_BU_TRU_MAU,
  KHOAN_LUONG_MAU,
  LOAI_CHUYEN_CAN_MAU,
  MAU_BU_TRU_MAU,
  MAU_CHUYEN_CAN_MAU,
  MAU_KPI_MAU,
  MAU_LUONG_PHAN_TRAM_MAU,
  MAU_LUONG_SAN_PHAM_MAU,
  MAU_TANG_CA_MAU,
  MAU_THUONG_MAU,
  NGAY_LE_MAU,
  NGUOI_PHU_THUOC_MAU,
  NHAN_VIEN_MAU,
  PHONG_BAN_MAU,
  SAN_PHAM_MAU,
  SET_LUONG_MAU,
  TAI_LIEU_MAU,
} from "./seed";

export interface HrmState {
  phongBan: PhongBan[];
  nhanVien: NhanVien[];
  hopDong: HopDong[];
  taiLieu: TaiLieu[];
  nguoiPhuThuoc: NguoiPhuThuoc[];
  cauHinh: CauHinhMacDinh;
  caLamViec: CaLamViec[];
  khoanLuong: KhoanLuong[];
  ngayLe: NgayLe[];
  /**
   * Chấm công — chỉ lưu các ô người dùng **đã đụng vào**, khóa `maNv|YYYY-MM-DD`.
   * Ô vắng mặt đọc theo lịch chuẩn; giá trị `null` là ô bị xóa trắng có chủ ý
   * (xem `chamCong.ts`).
   */
  chamCong: Record<string, OChamCong | null>;
  cauTrucLuong: CauTrucLuong;
  setLuong: SetLuongNhanVien[];
  /** Danh mục chỉ tiêu KPI — nguồn của ô chọn "Chỉ tiêu" ở bảng KPI. */
  chiTieuKpi: ChiTieuKpi[];
  /**
   * Bảng KPI đang soạn, dùng chung cho cả ba phạm vi.
   *
   * Một bản duy nhất chứ không phải một bản cho mỗi phạm vi: người dùng soạn
   * xong một bảng rồi mới quyết định áp cho ai, đổi phạm vi mà bảng đang soạn
   * biến mất là mất công gõ lại.
   */
  mauKpi: DongKpi[];
  /** KPI đã áp cho từng nhân viên — nguồn của cột "Hiệu suất". */
  banKpi: BanKpiNhanVien[];
  /** Bảng thưởng đang soạn — xem ghi chú ở `mauKpi`, cách làm giống hệt. */
  mauThuong: DongThuong[];
  /** Thưởng đã áp cho từng nhân viên — nguồn của cột "Tiền lương". */
  banThuong: BanThuongNhanVien[];
  /** Bảng tăng ca đang soạn — xem ghi chú ở `mauKpi`, cách làm giống hệt. */
  mauTangCa: DongTangCa[];
  /** Tăng ca đã áp cho từng nhân viên — nguồn của ba cột giờ. */
  banTangCa: BanTangCaNhanVien[];
  /** Danh mục sản phẩm nghiệm thu — nguồn của ô chọn "Sản phẩm". */
  sanPham: SanPham[];
  /** Bảng lương sản phẩm đang soạn — xem ghi chú ở `mauKpi`. */
  mauLuongSanPham: DongLuongSanPham[];
  /** Lương sản phẩm đã áp cho từng nhân viên — nguồn của cột "Tiền lương". */
  banLuongSanPham: BanLuongSanPhamNhanVien[];
  /** Bảng lương phần trăm đang soạn — xem ghi chú ở `mauKpi`. */
  mauLuongPhanTram: DongLuongPhanTram[];
  /** Lương phần trăm đã áp cho từng nhân viên — nguồn của cột "Tiền lương". */
  banLuongPhanTram: BanLuongPhanTramNhanVien[];
  /** Danh mục lỗi chuyên cần — nguồn của ô chọn "Loại chuyên cần". */
  loaiChuyenCan: LoaiChuyenCan[];
  /** Bảng chuyên cần đang soạn — xem ghi chú ở `mauKpi`. */
  mauChuyenCan: DongChuyenCan[];
  /** Chuyên cần đã áp cho từng nhân viên — nguồn của cột "Tổng trừ". */
  banChuyenCan: BanChuyenCanNhanVien[];
  /** Danh mục khoản ứng - bù trừ — nguồn của ô chọn "Khoản bù trừ". */
  khoanBuTru: KhoanBuTru[];
  /** Bảng ứng - bù trừ đang soạn — xem ghi chú ở `mauKpi`. */
  mauBuTru: DongBuTru[];
  /** Ứng - bù trừ đã áp cho từng nhân viên — nguồn của cột "Tổng bị trừ". */
  banBuTru: BanBuTruNhanVien[];
}

export type HrmAction =
  | { type: "phongBan/them"; phongBan: PhongBan }
  | { type: "phongBan/sua"; phongBan: PhongBan }
  | { type: "phongBan/xoa"; maPb: string }
  | { type: "phongBan/ganNhanh"; maPb: string; maNvList: string[] }
  | { type: "nhanVien/them"; nhanVien: NhanVien; hopDong: HopDong | null }
  | { type: "nhanVien/sua"; nhanVien: NhanVien }
  | { type: "nhanVien/xoa"; maNv: string }
  | { type: "hopDong/them"; hopDong: HopDong }
  | { type: "hopDong/sua"; hopDong: HopDong }
  | { type: "hopDong/xoa"; id: string }
  | { type: "hopDong/doi"; idCu: string | null; ngayChot: string; hopDongMoi: HopDong }
  | { type: "taiLieu/them"; taiLieu: TaiLieu }
  | { type: "taiLieu/sua"; taiLieu: TaiLieu }
  | { type: "taiLieu/xoa"; id: string }
  | { type: "npt/them"; npt: NguoiPhuThuoc }
  | { type: "npt/sua"; npt: NguoiPhuThuoc }
  | { type: "npt/xoa"; id: string }
  | { type: "cauHinh/luu"; cauHinh: CauHinhMacDinh }
  | { type: "ca/them"; ca: CaLamViec }
  | { type: "ca/sua"; ca: CaLamViec }
  | { type: "ca/xoa"; maCa: string }
  | { type: "khoanLuong/them"; khoan: KhoanLuong }
  | { type: "khoanLuong/sua"; khoan: KhoanLuong }
  | { type: "khoanLuong/xoa"; maKhoan: string }
  | { type: "ngayLe/them"; ngayLe: NgayLe }
  | { type: "ngayLe/sua"; ngayLe: NgayLe }
  | { type: "ngayLe/xoa"; id: string }
  | { type: "ngayLe/taoNhanh"; danhSach: NgayLe[] }
  | { type: "chamCong/dat"; khoa: string; o: OChamCong | null }
  | { type: "chamCong/datLaiThang"; tienToThang: string }
  | { type: "cauTrucLuong/luu"; cauTruc: CauTrucLuong }
  | { type: "setLuong/luu"; ban: SetLuongNhanVien }
  | { type: "setLuong/xoa"; maNv: string }
  | { type: "setLuong/duyet"; danhSachMaNv: string[] }
  | { type: "chiTieuKpi/them"; chiTieu: ChiTieuKpi }
  | { type: "chiTieuKpi/sua"; chiTieu: ChiTieuKpi }
  | { type: "chiTieuKpi/xoa"; maKpi: string }
  | { type: "kpi/luuMau"; dong: DongKpi[] }
  | { type: "kpi/apDung"; danhSachMaNv: string[]; dong: DongKpi[] }
  | { type: "kpi/xoaBan"; maNv: string }
  | { type: "thuong/luuMau"; dong: DongThuong[] }
  | { type: "thuong/apDung"; danhSachMaNv: string[]; dong: DongThuong[] }
  | { type: "thuong/xoaBan"; maNv: string }
  | { type: "tangCa/luuMau"; dong: DongTangCa[] }
  | { type: "tangCa/apDung"; danhSachMaNv: string[]; dong: DongTangCa[] }
  | { type: "tangCa/xoaBan"; maNv: string }
  | { type: "sanPham/them"; sanPham: SanPham }
  | { type: "sanPham/sua"; sanPham: SanPham }
  | { type: "sanPham/xoa"; maSp: string }
  | { type: "luongSanPham/luuMau"; dong: DongLuongSanPham[] }
  | { type: "luongSanPham/apDung"; danhSachMaNv: string[]; dong: DongLuongSanPham[] }
  | { type: "luongSanPham/xoaBan"; maNv: string }
  | { type: "luongPhanTram/luuMau"; dong: DongLuongPhanTram[] }
  | { type: "luongPhanTram/apDung"; danhSachMaNv: string[]; dong: DongLuongPhanTram[] }
  | { type: "luongPhanTram/xoaBan"; maNv: string }
  | { type: "loaiChuyenCan/them"; loai: LoaiChuyenCan }
  | { type: "loaiChuyenCan/sua"; loai: LoaiChuyenCan }
  | { type: "loaiChuyenCan/xoa"; maCc: string }
  | { type: "chuyenCan/luuMau"; dong: DongChuyenCan[] }
  | { type: "chuyenCan/apDung"; danhSachMaNv: string[]; dong: DongChuyenCan[] }
  | { type: "chuyenCan/xoaBan"; maNv: string }
  | { type: "khoanBuTru/them"; khoan: KhoanBuTru }
  | { type: "khoanBuTru/sua"; khoan: KhoanBuTru }
  | { type: "khoanBuTru/xoa"; maBt: string }
  | { type: "buTru/luuMau"; dong: DongBuTru[] }
  | { type: "buTru/apDung"; danhSachMaNv: string[]; dong: DongBuTru[] }
  | { type: "buTru/xoaBan"; maNv: string };

export const trangThaiBanDau: HrmState = {
  phongBan: PHONG_BAN_MAU,
  nhanVien: NHAN_VIEN_MAU,
  hopDong: HOP_DONG_MAU,
  taiLieu: TAI_LIEU_MAU,
  nguoiPhuThuoc: NGUOI_PHU_THUOC_MAU,
  cauHinh: CAU_HINH_MAU,
  caLamViec: CA_LAM_VIEC_MAU,
  khoanLuong: KHOAN_LUONG_MAU,
  ngayLe: NGAY_LE_MAU,
  // Rỗng = mọi ô đang theo lịch chuẩn.
  chamCong: {},
  cauTrucLuong: CAU_TRUC_LUONG_MAU,
  setLuong: SET_LUONG_MAU,
  chiTieuKpi: CHI_TIEU_KPI_MAU,
  mauKpi: MAU_KPI_MAU,
  banKpi: BAN_KPI_MAU,
  mauThuong: MAU_THUONG_MAU,
  banThuong: BAN_THUONG_MAU,
  mauTangCa: MAU_TANG_CA_MAU,
  banTangCa: BAN_TANG_CA_MAU,
  sanPham: SAN_PHAM_MAU,
  mauLuongSanPham: MAU_LUONG_SAN_PHAM_MAU,
  banLuongSanPham: BAN_LUONG_SAN_PHAM_MAU,
  mauLuongPhanTram: MAU_LUONG_PHAN_TRAM_MAU,
  banLuongPhanTram: BAN_LUONG_PHAN_TRAM_MAU,
  loaiChuyenCan: LOAI_CHUYEN_CAN_MAU,
  mauChuyenCan: MAU_CHUYEN_CAN_MAU,
  banChuyenCan: BAN_CHUYEN_CAN_MAU,
  khoanBuTru: KHOAN_BU_TRU_MAU,
  mauBuTru: MAU_BU_TRU_MAU,
  banBuTru: BAN_BU_TRU_MAU,
};

/** Thay phần tử cùng khóa, giữ nguyên thứ tự. */
function thayTheo<T>(danhSach: T[], khop: (item: T) => boolean, moi: T): T[] {
  return danhSach.map((item) => (khop(item) ? moi : item));
}

export function hrmReducer(state: HrmState, action: HrmAction): HrmState {
  switch (action.type) {
    case "phongBan/them":
      return { ...state, phongBan: [...state.phongBan, action.phongBan] };

    case "phongBan/sua":
      return {
        ...state,
        phongBan: thayTheo(
          state.phongBan,
          (pb) => pb.ma_pb === action.phongBan.ma_pb,
          action.phongBan,
        ),
      };

    case "phongBan/xoa":
      return {
        ...state,
        phongBan: state.phongBan.filter((pb) => pb.ma_pb !== action.maPb),
      };

    case "phongBan/ganNhanh": {
      const can = new Set(action.maNvList);
      return {
        ...state,
        nhanVien: state.nhanVien.map((nv) =>
          can.has(nv.ma_nv) ? { ...nv, ma_pb: action.maPb } : nv,
        ),
      };
    }

    case "nhanVien/them":
      return {
        ...state,
        nhanVien: [...state.nhanVien, action.nhanVien],
        hopDong: action.hopDong ? [...state.hopDong, action.hopDong] : state.hopDong,
      };

    case "nhanVien/sua":
      return {
        ...state,
        nhanVien: thayTheo(
          state.nhanVien,
          (nv) => nv.ma_nv === action.nhanVien.ma_nv,
          action.nhanVien,
        ),
      };

    case "nhanVien/xoa":
      // Xóa kèm toàn bộ dữ liệu con — bỏ sót sẽ để lại hợp đồng/NPT mồ côi làm
      // lệch các cột đếm.
      return {
        ...state,
        nhanVien: state.nhanVien.filter((nv) => nv.ma_nv !== action.maNv),
        hopDong: state.hopDong.filter((hd) => hd.ma_nv !== action.maNv),
        taiLieu: state.taiLieu.filter((tl) => tl.ma_nv !== action.maNv),
        nguoiPhuThuoc: state.nguoiPhuThuoc.filter((npt) => npt.ma_nv !== action.maNv),
      };

    case "hopDong/them":
      return { ...state, hopDong: [...state.hopDong, action.hopDong] };

    case "hopDong/sua":
      return {
        ...state,
        hopDong: thayTheo(state.hopDong, (hd) => hd.id === action.hopDong.id, action.hopDong),
      };

    case "hopDong/xoa":
      return { ...state, hopDong: state.hopDong.filter((hd) => hd.id !== action.id) };

    case "hopDong/doi":
      // Chốt hợp đồng cũ và thêm hợp đồng mới trong **một** lần ghi: tách đôi sẽ
      // để lại lúc thì hai hợp đồng cùng hiệu lực, lúc thì không có hợp đồng nào.
      return {
        ...state,
        hopDong: [
          ...state.hopDong.map((hd) =>
            hd.id === action.idCu ? { ...hd, ngay_ket_thuc: action.ngayChot } : hd,
          ),
          action.hopDongMoi,
        ],
      };

    case "taiLieu/them":
      return { ...state, taiLieu: [...state.taiLieu, action.taiLieu] };

    case "taiLieu/sua":
      return {
        ...state,
        taiLieu: thayTheo(state.taiLieu, (tl) => tl.id === action.taiLieu.id, action.taiLieu),
      };

    case "taiLieu/xoa":
      return { ...state, taiLieu: state.taiLieu.filter((tl) => tl.id !== action.id) };

    case "npt/them":
      return { ...state, nguoiPhuThuoc: [...state.nguoiPhuThuoc, action.npt] };

    case "npt/sua":
      return {
        ...state,
        nguoiPhuThuoc: thayTheo(
          state.nguoiPhuThuoc,
          (npt) => npt.id === action.npt.id,
          action.npt,
        ),
      };

    case "npt/xoa":
      return {
        ...state,
        nguoiPhuThuoc: state.nguoiPhuThuoc.filter((npt) => npt.id !== action.id),
      };

    case "cauHinh/luu":
      return { ...state, cauHinh: action.cauHinh };

    case "ca/them":
      return { ...state, caLamViec: [...state.caLamViec, action.ca] };

    case "ca/sua":
      return {
        ...state,
        caLamViec: thayTheo(state.caLamViec, (ca) => ca.ma_ca === action.ca.ma_ca, action.ca),
      };

    case "ca/xoa":
      return {
        ...state,
        caLamViec: state.caLamViec.filter((ca) => ca.ma_ca !== action.maCa),
      };

    case "khoanLuong/them":
      return { ...state, khoanLuong: [...state.khoanLuong, action.khoan] };

    case "khoanLuong/sua":
      return {
        ...state,
        khoanLuong: thayTheo(
          state.khoanLuong,
          (kl) => kl.ma_khoan === action.khoan.ma_khoan,
          action.khoan,
        ),
      };

    case "khoanLuong/xoa":
      return {
        ...state,
        khoanLuong: state.khoanLuong.filter((kl) => kl.ma_khoan !== action.maKhoan),
      };

    case "ngayLe/them":
      return { ...state, ngayLe: [...state.ngayLe, action.ngayLe] };

    case "ngayLe/sua":
      return {
        ...state,
        ngayLe: thayTheo(state.ngayLe, (nl) => nl.id === action.ngayLe.id, action.ngayLe),
      };

    case "ngayLe/xoa":
      return { ...state, ngayLe: state.ngayLe.filter((nl) => nl.id !== action.id) };

    case "ngayLe/taoNhanh":
      return { ...state, ngayLe: [...state.ngayLe, ...action.danhSach] };

    case "chamCong/dat":
      return { ...state, chamCong: { ...state.chamCong, [action.khoa]: action.o } };

    case "chamCong/datLaiThang": {
      // Xóa mọi ghi đè của tháng đó — ô quay về đúng lịch chuẩn.
      const conLai: Record<string, OChamCong | null> = {};
      for (const [khoa, giaTri] of Object.entries(state.chamCong)) {
        if (!khoa.includes(`|${action.tienToThang}`)) conLai[khoa] = giaTri;
      }
      return { ...state, chamCong: conLai };
    }

    case "cauTrucLuong/luu":
      return { ...state, cauTrucLuong: action.cauTruc };

    case "setLuong/luu": {
      const daCo = state.setLuong.some((sl) => sl.ma_nv === action.ban.ma_nv);
      return {
        ...state,
        setLuong: daCo
          ? thayTheo(state.setLuong, (sl) => sl.ma_nv === action.ban.ma_nv, action.ban)
          : [...state.setLuong, action.ban],
      };
    }

    case "setLuong/xoa":
      return { ...state, setLuong: state.setLuong.filter((sl) => sl.ma_nv !== action.maNv) };

    case "setLuong/duyet": {
      const can = new Set(action.danhSachMaNv);
      return {
        ...state,
        setLuong: state.setLuong.map((sl) =>
          can.has(sl.ma_nv) ? { ...sl, trang_thai: "da_duyet" as const } : sl,
        ),
      };
    }

    case "chiTieuKpi/them":
      return { ...state, chiTieuKpi: [...state.chiTieuKpi, action.chiTieu] };

    case "chiTieuKpi/sua":
      return {
        ...state,
        chiTieuKpi: thayTheo(
          state.chiTieuKpi,
          (ct) => ct.ma_kpi === action.chiTieu.ma_kpi,
          action.chiTieu,
        ),
      };

    case "chiTieuKpi/xoa":
      return {
        ...state,
        chiTieuKpi: state.chiTieuKpi.filter((ct) => ct.ma_kpi !== action.maKpi),
      };

    case "kpi/luuMau":
      return { ...state, mauKpi: action.dong };

    case "kpi/apDung": {
      // Ghi đè bảng của người đã có và thêm bản mới cho người chưa có, trong
      // **một** lần ghi — tách ra sẽ có lúc danh sách hiện nửa cũ nửa mới.
      const can = new Set(action.danhSachMaNv);
      const daCo = new Set(state.banKpi.map((ban) => ban.ma_nv));
      return {
        ...state,
        banKpi: [
          ...state.banKpi.map((ban) =>
            can.has(ban.ma_nv)
              ? { ...ban, lan_luong: ban.lan_luong + 1, dong: action.dong }
              : ban,
          ),
          ...action.danhSachMaNv
            .filter((maNv) => !daCo.has(maNv))
            .map((maNv) => ({ ma_nv: maNv, lan_luong: 1, dong: action.dong })),
        ],
      };
    }

    case "kpi/xoaBan":
      return { ...state, banKpi: state.banKpi.filter((ban) => ban.ma_nv !== action.maNv) };

    case "thuong/luuMau":
      return { ...state, mauThuong: action.dong };

    case "thuong/apDung": {
      // Cùng cách ghi với `kpi/apDung`: ghi đè người đã có và thêm người chưa
      // có trong một lần, để danh sách không bao giờ hiện nửa cũ nửa mới.
      const can = new Set(action.danhSachMaNv);
      const daCo = new Set(state.banThuong.map((ban) => ban.ma_nv));
      return {
        ...state,
        banThuong: [
          ...state.banThuong.map((ban) =>
            can.has(ban.ma_nv) ? { ...ban, dong: action.dong } : ban,
          ),
          ...action.danhSachMaNv
            .filter((maNv) => !daCo.has(maNv))
            .map((maNv) => ({ ma_nv: maNv, dong: action.dong })),
        ],
      };
    }

    case "thuong/xoaBan":
      return {
        ...state,
        banThuong: state.banThuong.filter((ban) => ban.ma_nv !== action.maNv),
      };

    case "tangCa/luuMau":
      return { ...state, mauTangCa: action.dong };

    case "tangCa/apDung": {
      // Giữ nguyên `gio_luy_ke_nam` của người đã có: đó là giờ của các kỳ trước,
      // áp lại kỳ này không được xóa lũy kế cả năm.
      const can = new Set(action.danhSachMaNv);
      const daCo = new Set(state.banTangCa.map((ban) => ban.ma_nv));
      return {
        ...state,
        banTangCa: [
          ...state.banTangCa.map((ban) =>
            can.has(ban.ma_nv) ? { ...ban, dong: action.dong } : ban,
          ),
          ...action.danhSachMaNv
            .filter((maNv) => !daCo.has(maNv))
            .map((maNv) => ({ ma_nv: maNv, dong: action.dong, gio_luy_ke_nam: 0 })),
        ],
      };
    }

    case "tangCa/xoaBan":
      return {
        ...state,
        banTangCa: state.banTangCa.filter((ban) => ban.ma_nv !== action.maNv),
      };

    case "sanPham/them":
      return { ...state, sanPham: [...state.sanPham, action.sanPham] };

    case "sanPham/sua":
      return {
        ...state,
        sanPham: thayTheo(
          state.sanPham,
          (sp) => sp.ma_sp === action.sanPham.ma_sp,
          action.sanPham,
        ),
      };

    case "sanPham/xoa":
      return { ...state, sanPham: state.sanPham.filter((sp) => sp.ma_sp !== action.maSp) };

    case "luongSanPham/luuMau":
      return { ...state, mauLuongSanPham: action.dong };

    case "luongSanPham/apDung": {
      // Cùng cách ghi với `kpi/apDung`: ghi đè người đã có và thêm người chưa
      // có trong một lần, để danh sách không bao giờ hiện nửa cũ nửa mới.
      const can = new Set(action.danhSachMaNv);
      const daCo = new Set(state.banLuongSanPham.map((ban) => ban.ma_nv));
      return {
        ...state,
        banLuongSanPham: [
          ...state.banLuongSanPham.map((ban) =>
            can.has(ban.ma_nv) ? { ...ban, dong: action.dong } : ban,
          ),
          ...action.danhSachMaNv
            .filter((maNv) => !daCo.has(maNv))
            .map((maNv) => ({ ma_nv: maNv, dong: action.dong })),
        ],
      };
    }

    case "luongSanPham/xoaBan":
      return {
        ...state,
        banLuongSanPham: state.banLuongSanPham.filter((ban) => ban.ma_nv !== action.maNv),
      };

    case "luongPhanTram/luuMau":
      return { ...state, mauLuongPhanTram: action.dong };

    case "luongPhanTram/apDung": {
      // Cùng cách ghi với `kpi/apDung`: ghi đè người đã có và thêm người chưa
      // có trong một lần, để danh sách không bao giờ hiện nửa cũ nửa mới.
      const can = new Set(action.danhSachMaNv);
      const daCo = new Set(state.banLuongPhanTram.map((ban) => ban.ma_nv));
      return {
        ...state,
        banLuongPhanTram: [
          ...state.banLuongPhanTram.map((ban) =>
            can.has(ban.ma_nv) ? { ...ban, dong: action.dong } : ban,
          ),
          ...action.danhSachMaNv
            .filter((maNv) => !daCo.has(maNv))
            .map((maNv) => ({ ma_nv: maNv, dong: action.dong })),
        ],
      };
    }

    case "luongPhanTram/xoaBan":
      return {
        ...state,
        banLuongPhanTram: state.banLuongPhanTram.filter((ban) => ban.ma_nv !== action.maNv),
      };

    case "loaiChuyenCan/them":
      return { ...state, loaiChuyenCan: [...state.loaiChuyenCan, action.loai] };

    case "loaiChuyenCan/sua":
      return {
        ...state,
        loaiChuyenCan: thayTheo(
          state.loaiChuyenCan,
          (cc) => cc.ma_cc === action.loai.ma_cc,
          action.loai,
        ),
      };

    case "loaiChuyenCan/xoa":
      return {
        ...state,
        loaiChuyenCan: state.loaiChuyenCan.filter((cc) => cc.ma_cc !== action.maCc),
      };

    case "chuyenCan/luuMau":
      return { ...state, mauChuyenCan: action.dong };

    case "chuyenCan/apDung": {
      // Cùng cách ghi với `kpi/apDung`: ghi đè người đã có và thêm người chưa
      // có trong một lần, để danh sách không bao giờ hiện nửa cũ nửa mới.
      const can = new Set(action.danhSachMaNv);
      const daCo = new Set(state.banChuyenCan.map((ban) => ban.ma_nv));
      return {
        ...state,
        banChuyenCan: [
          ...state.banChuyenCan.map((ban) =>
            can.has(ban.ma_nv) ? { ...ban, dong: action.dong } : ban,
          ),
          ...action.danhSachMaNv
            .filter((maNv) => !daCo.has(maNv))
            .map((maNv) => ({ ma_nv: maNv, dong: action.dong })),
        ],
      };
    }

    case "chuyenCan/xoaBan":
      return {
        ...state,
        banChuyenCan: state.banChuyenCan.filter((ban) => ban.ma_nv !== action.maNv),
      };

    case "khoanBuTru/them":
      return { ...state, khoanBuTru: [...state.khoanBuTru, action.khoan] };

    case "khoanBuTru/sua":
      return {
        ...state,
        khoanBuTru: thayTheo(
          state.khoanBuTru,
          (bt) => bt.ma_bt === action.khoan.ma_bt,
          action.khoan,
        ),
      };

    case "khoanBuTru/xoa":
      return {
        ...state,
        khoanBuTru: state.khoanBuTru.filter((bt) => bt.ma_bt !== action.maBt),
      };

    case "buTru/luuMau":
      return { ...state, mauBuTru: action.dong };

    case "buTru/apDung": {
      // Cùng cách ghi với `kpi/apDung`: ghi đè người đã có và thêm người chưa
      // có trong một lần, để danh sách không bao giờ hiện nửa cũ nửa mới.
      const can = new Set(action.danhSachMaNv);
      const daCo = new Set(state.banBuTru.map((ban) => ban.ma_nv));
      return {
        ...state,
        banBuTru: [
          ...state.banBuTru.map((ban) =>
            can.has(ban.ma_nv) ? { ...ban, dong: action.dong } : ban,
          ),
          ...action.danhSachMaNv
            .filter((maNv) => !daCo.has(maNv))
            .map((maNv) => ({ ma_nv: maNv, dong: action.dong })),
        ],
      };
    }

    case "buTru/xoaBan":
      return { ...state, banBuTru: state.banBuTru.filter((ban) => ban.ma_nv !== action.maNv) };

    default:
      return state;
  }
}

export interface HrmContextValue {
  state: HrmState;
  dispatch: Dispatch<HrmAction>;
}

export const HrmContext = createContext<HrmContextValue | null>(null);

/** Sinh id cho hợp đồng / tài liệu / người phụ thuộc — chỉ cần duy nhất trong phiên. */
export function sinhId(tienTo: string): string {
  return `${tienTo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
