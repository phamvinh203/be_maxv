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
  CaLamViec,
  CauHinhMacDinh,
  CauTrucLuong,
  HopDong,
  KhoanLuong,
  NgayLe,
  NguoiPhuThuoc,
  NhanVien,
  OChamCong,
  PhongBan,
  SetLuongNhanVien,
  TaiLieu,
} from "../types";
import {
  CA_LAM_VIEC_MAU,
  CAU_HINH_MAU,
  CAU_TRUC_LUONG_MAU,
  HOP_DONG_MAU,
  KHOAN_LUONG_MAU,
  NGAY_LE_MAU,
  NGUOI_PHU_THUOC_MAU,
  NHAN_VIEN_MAU,
  PHONG_BAN_MAU,
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
  | { type: "chamCong/boGhiDe"; khoa: string }
  | { type: "chamCong/datLaiThang"; tienToThang: string }
  | { type: "cauTrucLuong/luu"; cauTruc: CauTrucLuong }
  | { type: "setLuong/luu"; ban: SetLuongNhanVien }
  | { type: "setLuong/xoa"; maNv: string }
  | { type: "setLuong/duyet"; danhSachMaNv: string[] };

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

    case "chamCong/boGhiDe": {
      // Bỏ hẳn khóa chứ không gán null — ô quay về đúng mặc định theo lịch.
      const conLai = { ...state.chamCong };
      delete conLai[action.khoa];
      return { ...state, chamCong: conLai };
    }

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
