import {
  laHopDongKhauTruTaiNguon,
  tinhThueLuyTien,
} from '../du_lieu_tinh_luong/payrollCalculation.service';
import {
  demNguoiPhuThuocTrongKy,
  type KyDangKyNguoiPhuThuoc,
} from '../../../../helpers/hrm/nguoiPhuThuocTrongKy';
import { khoaNguoiNhan } from './otherIncomeRecord.service';

/**
 * BỘ TÍNH DÒNG BẢNG TÍNH THUẾ THÁNG — hàm THUẦN (BR-tkt-010…012, data-model Mục 5.1/5.2).
 *
 * Mọi thứ cần biết nằm trong tham số; truy vấn CSDL, chốt/mở, nhật ký nằm ở `taxSheet.service.ts`.
 * Nhờ vậy bảng quyết định 3 nhánh + các bất biến số học kiểm được bằng ca kiểm thuần.
 *
 * Dùng cho CẢ HAI việc: hiển thị tháng chưa chốt (tính trực tiếp) và tạo snapshot khi chốt. Chung
 * một hàm là bảo đảm số kế toán nhìn thấy trước khi bấm Chốt đúng bằng số được đóng băng.
 *
 * ── Hai phần thu nhập ngoài lương (chủ dự án chốt "tách 2 phần" 2026-09-15) ──
 *   phần cộng lũy tiến   = Σ taxableAmount       (TAXABLE_FULL + phần vượt trần EXEMPT_CAPPED)
 *   phần khấu trừ riêng  = Σ grossAmount của khoản WITHHOLDING_FLAT
 *   thu_nhap_ngoai       = hai phần cộng lại — cả hai đều là thu nhập CHỊU THUẾ theo luật
 *   nền lũy tiến         = thu_nhap_chiu_thue − thu_nhap_khau_tru_rieng − tong_giam_tru
 * Không tách thì hoặc dòng vãng lai hiện thực nhận âm + tờ khai mất thu nhập, hoặc khoản đã khấu
 * trừ 10% bị cộng tiếp vào lũy tiến — đánh thuế hai lần.
 */

export type NhomXuLyThueNgoai =
  'EXEMPT_FULL' | 'EXEMPT_CAPPED' | 'TAXABLE_FULL' | 'WITHHOLDING_FLAT';

export type LoaiLaoDong =
  'HOP_DONG_3_THANG_TRO_LEN' | 'THOI_VU_THU_VIEC' | 'VANG_LAI';

export type PhuongPhapTinh =
  'LUY_TIEN' | 'KHAU_TRU_10' | 'KHAU_TRU_20' | 'CAM_KET_08' | 'DUOI_NGUONG';

/** Một dòng bảng lương đã chuẩn hóa về `number` — kỳ mở và kỳ đã khóa sổ cùng một hình dạng. */
export interface DongLuongDauVao {
  ma_nv: string;
  fullName: string;
  grossIncome: number;
  otTaxExemptAmount: number;
  lunchAllowanceExemptAmount: number;
  otherAllowanceTaxExemptAmount: number;
  employeeInsuranceDeduction: number;
  contractType: string | null;
  personalIncomeTax: number;
}

export interface NhanVienDauVao {
  ma_nv: string;
  ho_ten: string;
  mst_ca_nhan: string | null;
  so_cccd: string | null;
  /** `loai_hd` của hợp đồng hiệu lực trong kỳ — dùng khi người đó KHÔNG có dòng bảng lương. */
  loaiHdHieuLuc: string | null;
  /** `tinh_tncn` của hợp đồng hiệu lực trong kỳ. Không có hợp đồng ⇒ `false`, đúng như engine lương. */
  tinhTncn: boolean;
  nguoiPhuThuoc: KyDangKyNguoiPhuThuoc[];
}

export interface KhoanNgoaiDauVao {
  ma_nv: string | null;
  fullName: string;
  taxCode: string | null;
  idCardNumber: string | null;
  isResident: boolean;
  taxTreatmentGroup: NhomXuLyThueNgoai | null;
  grossAmount: number;
  taxableAmount: number;
  taxDeducted: number;
  taxDeductionType: string;
}

export interface ChinhSachDauVao {
  personalDeduction: number;
  dependentDeduction: number;
  taxBrackets: unknown;
}

export interface DongBangTinhThueTinh {
  recipientKey: string;
  ma_nv: string | null;
  ho_ten: string;
  mst_ca_nhan: string | null;
  so_cccd: string | null;
  loai_lao_dong: LoaiLaoDong;
  cu_tru: boolean;
  so_nguoi_phu_thuoc: number;

  thu_nhap_luong: number;
  thu_nhap_ngoai: number;
  thu_nhap_khau_tru_rieng: number;
  tong_thu_nhap: number;
  thu_nhap_mien_thue: number;
  thu_nhap_chiu_thue: number;

  giam_tru_ban_than: number;
  giam_tru_phu_thuoc: number;
  giam_tru_bao_hiem: number;
  tong_giam_tru: number;

  thu_nhap_tinh_thue: number;
  phuong_phap_tinh: PhuongPhapTinh;
  thue_luy_tien: number;
  thue_toan_phan: number;
  tong_thue_tncn: number;
  thuc_nhan: number;
}

/**
 * Phương pháp của một cá nhân vãng lai có NHIỀU khoản trong tháng — lấy khoản "nặng" nhất:
 * có khoản thực sự bị khấu trừ thì ghi theo khoản đó, sau đó mới tới Cam kết 08, cuối cùng là
 * dưới ngưỡng. Ghi theo khoản nhẹ nhất sẽ che mất việc người đó đã bị khấu trừ thuế.
 */
function phuongPhapVangLai(khoan: KhoanNgoaiDauVao[]): PhuongPhapTinh {
  const loai = new Set(khoan.map((k) => k.taxDeductionType));
  if (loai.has('FLAT_10')) return 'KHAU_TRU_10';
  if (loai.has('FLAT_20')) return 'KHAU_TRU_20';
  if (loai.has('EXEMPT_COMMIT')) return 'CAM_KET_08';
  return 'DUOI_NGUONG';
}

const tong = (ds: number[]): number => ds.reduce((s, x) => s + x, 0);

export function tinhBangTinhThueThang(args: {
  nam: number;
  thang: number;
  dongLuong: DongLuongDauVao[];
  nhanVien: NhanVienDauVao[];
  khoanNgoai: KhoanNgoaiDauVao[];
  chinhSach: ChinhSachDauVao;
}): DongBangTinhThueTinh[] {
  const { nam, thang, chinhSach } = args;

  const luongTheoNv = new Map(args.dongLuong.map((d) => [d.ma_nv, d]));
  const nvTheoMa = new Map(args.nhanVien.map((n) => [n.ma_nv, n]));

  const khoanTheoNguoi = new Map<string, KhoanNgoaiDauVao[]>();
  for (const k of args.khoanNgoai) {
    const khoa = khoaNguoiNhan(k.ma_nv, k.fullName);
    const ds = khoanTheoNguoi.get(khoa);
    if (ds) ds.push(k);
    else khoanTheoNguoi.set(khoa, [k]);
  }

  // Tập NGƯỜI = mọi nhân viên có dòng lương ∪ mọi người có khoản ngoài lương. Nhân viên chỉ có
  // khoản ngoài lương (vd đã nghỉ việc nhận thưởng) vẫn phải lên bảng — bản nháp cũ bỏ sót nhóm này.
  const maNoiBo = new Set<string>(args.dongLuong.map((d) => d.ma_nv));
  const khoaVangLai = new Set<string>();
  for (const k of args.khoanNgoai) {
    if (k.ma_nv) maNoiBo.add(k.ma_nv);
    else khoaVangLai.add(khoaNguoiNhan(null, k.fullName));
  }

  const dong: DongBangTinhThueTinh[] = [];

  for (const ma_nv of [...maNoiBo].sort()) {
    const luong = luongTheoNv.get(ma_nv);
    const nv = nvTheoMa.get(ma_nv);
    const khoan = khoanTheoNguoi.get(ma_nv) ?? [];

    const khauTruRieng = tong(
      khoan
        .filter((k) => k.taxTreatmentGroup === 'WITHHOLDING_FLAT')
        .map((k) => k.grossAmount),
    );
    const thueKhauTruNgoai = tong(khoan.map((k) => k.taxDeducted));
    const thuNhapNgoai = tong(khoan.map((k) => k.taxableAmount)) + khauTruRieng;

    const thuNhapLuong = luong?.grossIncome ?? 0;
    const mienThue =
      (luong?.otTaxExemptAmount ?? 0) +
      (luong?.lunchAllowanceExemptAmount ?? 0) +
      (luong?.otherAllowanceTaxExemptAmount ?? 0);
    const tongThuNhap = thuNhapLuong + thuNhapNgoai;
    const chiuThue = Math.max(0, tongThuNhap - mienThue);

    // Dòng bảng lương là nguồn loại hợp đồng ưu tiên: kỳ đã khóa sổ thì đó là giá trị đóng băng.
    const loaiHd = luong ? luong.contractType : (nv?.loaiHdHieuLuc ?? null);

    const chung = {
      recipientKey: ma_nv,
      ma_nv,
      ho_ten:
        nv?.ho_ten ?? luong?.fullName ?? khoan[0]?.fullName.trim() ?? ma_nv,
      mst_ca_nhan: nv?.mst_ca_nhan ?? null,
      so_cccd: nv?.so_cccd ?? null,
      // Cá nhân không cư trú ngoài phạm vi đợt này (SRS Mục 2.2) — nhân viên nội bộ luôn cư trú.
      cu_tru: true,
      thu_nhap_luong: thuNhapLuong,
      thu_nhap_ngoai: thuNhapNgoai,
      thu_nhap_khau_tru_rieng: khauTruRieng,
      tong_thu_nhap: tongThuNhap,
      thu_nhap_mien_thue: mienThue,
      thu_nhap_chiu_thue: chiuThue,
    };

    if (laHopDongKhauTruTaiNguon(loaiHd)) {
      // BR-tkt-011 + NFR-tkt-005: LẤY THẲNG thuế engine lương đã tính, CẤM tính lại 10% ở đây —
      // tính lại là hai màn ra hai số ngay khi ngưỡng/tỷ lệ khấu trừ đổi.
      const thueToanPhan = (luong?.personalIncomeTax ?? 0) + thueKhauTruNgoai;
      dong.push({
        ...chung,
        loai_lao_dong: 'THOI_VU_THU_VIEC',
        so_nguoi_phu_thuoc: 0,
        giam_tru_ban_than: 0,
        giam_tru_phu_thuoc: 0,
        giam_tru_bao_hiem: 0,
        tong_giam_tru: 0,
        thu_nhap_tinh_thue: 0,
        phuong_phap_tinh: 'KHAU_TRU_10',
        thue_luy_tien: 0,
        thue_toan_phan: thueToanPhan,
        tong_thue_tncn: thueToanPhan,
        // BH bắt buộc KHÔNG là giảm trừ ở nhánh này (giam_tru_bao_hiem = 0) nhưng vẫn là tiền đã trừ
        // khỏi lương khi hợp đồng bật `trich_bhxh` — SRS Mục 4.3 trừ nó ở mọi nhánh.
        thuc_nhan:
          tongThuNhap - thueToanPhan - (luong?.employeeInsuranceDeduction ?? 0),
      });
      continue;
    }

    const soNpt = nv
      ? demNguoiPhuThuocTrongKy(nv.nguoiPhuThuoc, nam, thang)
      : 0;
    const banThan = chinhSach.personalDeduction;
    const phuThuoc = soNpt * chinhSach.dependentDeduction;
    const baoHiem = luong?.employeeInsuranceDeduction ?? 0;
    const tongGiamTru = banThan + phuThuoc + baoHiem;
    const tinhThue = Math.max(0, chiuThue - khauTruRieng - tongGiamTru);
    // `tinh_tncn = false` là công tắc TỔNG của hợp đồng (GAP-QA-05) — cùng luật với engine lương.
    const luyTien = nv?.tinhTncn
      ? tinhThueLuyTien(tinhThue, chinhSach.taxBrackets)
      : 0;
    const tongThue = luyTien + thueKhauTruNgoai;

    dong.push({
      ...chung,
      loai_lao_dong: 'HOP_DONG_3_THANG_TRO_LEN',
      so_nguoi_phu_thuoc: soNpt,
      giam_tru_ban_than: banThan,
      giam_tru_phu_thuoc: phuThuoc,
      giam_tru_bao_hiem: baoHiem,
      tong_giam_tru: tongGiamTru,
      thu_nhap_tinh_thue: tinhThue,
      phuong_phap_tinh: 'LUY_TIEN',
      thue_luy_tien: luyTien,
      // Có hoa hồng khấu trừ tại nguồn thì thuế đó PHẢI hiện ở đây — để 0 thì tờ khai mất số thuế.
      thue_toan_phan: thueKhauTruNgoai,
      tong_thue_tncn: tongThue,
      thuc_nhan: tongThuNhap - tongThue - baoHiem,
    });
  }

  for (const khoa of [...khoaVangLai].sort()) {
    const khoan = khoanTheoNguoi.get(khoa) ?? [];
    const khauTruRieng = tong(
      khoan
        .filter((k) => k.taxTreatmentGroup === 'WITHHOLDING_FLAT')
        .map((k) => k.grossAmount),
    );
    const thuNhapNgoai = tong(khoan.map((k) => k.taxableAmount)) + khauTruRieng;
    const thue = tong(khoan.map((k) => k.taxDeducted));

    dong.push({
      recipientKey: khoa,
      ma_nv: null,
      ho_ten: khoan[0]?.fullName.trim() ?? khoa,
      mst_ca_nhan: khoan.find((k) => k.taxCode)?.taxCode ?? null,
      so_cccd: khoan.find((k) => k.idCardNumber)?.idCardNumber ?? null,
      loai_lao_dong: 'VANG_LAI',
      cu_tru: khoan.every((k) => k.isResident),
      so_nguoi_phu_thuoc: 0,
      thu_nhap_luong: 0,
      thu_nhap_ngoai: thuNhapNgoai,
      thu_nhap_khau_tru_rieng: khauTruRieng,
      tong_thu_nhap: thuNhapNgoai,
      thu_nhap_mien_thue: 0,
      thu_nhap_chiu_thue: thuNhapNgoai,
      giam_tru_ban_than: 0,
      giam_tru_phu_thuoc: 0,
      giam_tru_bao_hiem: 0,
      tong_giam_tru: 0,
      thu_nhap_tinh_thue: 0,
      phuong_phap_tinh: phuongPhapVangLai(khoan),
      thue_luy_tien: 0,
      thue_toan_phan: thue,
      tong_thue_tncn: thue,
      thuc_nhan: thuNhapNgoai - thue,
    });
  }

  return dong;
}
