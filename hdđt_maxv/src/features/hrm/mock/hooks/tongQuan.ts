/** Số liệu tổng hợp cho tab Dashboard. Chỉ đọc, không có thao tác ghi. */

import { useMemo } from "react";
import { hopDongHienHanh, sapXepCay } from "../../cay";
import { homNay } from "../../format";
import { useHrmStore } from "../useHrmStore";

export interface DongPhanBo {
  ma_pb: string;
  ten_pb: string;
  cap: number;
  so_nv: number;
}

export interface DongSapHetHan {
  id: string;
  ma_nv: string;
  ho_ten: string;
  so_hd: string;
  ngay_ket_thuc: string;
  /** Âm nghĩa là đã quá hạn. */
  con_lai_ngay: number;
}

export interface ThongKeHrm {
  soNhanVienDangLam: number;
  soNhanVienDaNghi: number;
  soPhongBan: number;
  soNguoiPhuThuoc: number;
  soChuaGanPhongBan: number;
  soThamGiaCongDoan: number;
  soChuaCoHopDong: number;
  phanBo: DongPhanBo[];
  sapHetHan: DongSapHetHan[];
}

/** Số ngày từ `tu` tới `den`. Tính trên mốc UTC để không lệch do múi giờ. */
function soNgayGiua(tu: string, den: string): number {
  const a = Date.parse(`${tu}T00:00:00Z`);
  const b = Date.parse(`${den}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Hợp đồng còn hạn dưới ngần này ngày thì đưa vào danh sách cần để ý. */
const NGUONG_SAP_HET_HAN = 90;

export function useThongKeHrm(): ThongKeHrm {
  const { state } = useHrmStore();

  return useMemo(() => {
    const moc = homNay();

    const dangLam = state.nhanVien.filter((nv) => nv.status === "1");
    const soNvTheoPb = new Map<string, number>();
    for (const nv of dangLam) {
      if (!nv.ma_pb) continue;
      soNvTheoPb.set(nv.ma_pb, (soNvTheoPb.get(nv.ma_pb) ?? 0) + 1);
    }

    const hopDongTheoNv = new Map<string, typeof state.hopDong>();
    for (const hd of state.hopDong) {
      const nhom = hopDongTheoNv.get(hd.ma_nv);
      if (nhom) nhom.push(hd);
      else hopDongTheoNv.set(hd.ma_nv, [hd]);
    }

    const sapHetHan: DongSapHetHan[] = [];
    let soChuaCoHopDong = 0;

    for (const nv of dangLam) {
      const hd = hopDongHienHanh(hopDongTheoNv.get(nv.ma_nv) ?? [], moc);
      if (!hd) {
        soChuaCoHopDong += 1;
        continue;
      }
      // Không thời hạn thì không bao giờ tới hạn — bỏ qua.
      if (!hd.ngay_ket_thuc) continue;
      const conLai = soNgayGiua(moc, hd.ngay_ket_thuc);
      if (conLai <= NGUONG_SAP_HET_HAN) {
        sapHetHan.push({
          id: hd.id,
          ma_nv: nv.ma_nv,
          ho_ten: nv.ho_ten,
          so_hd: hd.so_hd,
          ngay_ket_thuc: hd.ngay_ket_thuc,
          con_lai_ngay: conLai,
        });
      }
    }
    sapHetHan.sort((a, b) => a.con_lai_ngay - b.con_lai_ngay);

    const phanBo = sapXepCay(state.phongBan).map((pb) => ({
      ma_pb: pb.ma_pb,
      ten_pb: pb.ten_pb,
      cap: pb.cap,
      so_nv: soNvTheoPb.get(pb.ma_pb) ?? 0,
    }));

    return {
      soNhanVienDangLam: dangLam.length,
      soNhanVienDaNghi: state.nhanVien.length - dangLam.length,
      soPhongBan: state.phongBan.length,
      soNguoiPhuThuoc: state.nguoiPhuThuoc.length,
      soChuaGanPhongBan: dangLam.filter((nv) => !nv.ma_pb).length,
      soThamGiaCongDoan: dangLam.filter((nv) => nv.cong_doan).length,
      soChuaCoHopDong,
      phanBo,
      sapHetHan,
    };
  }, [state]);
}
