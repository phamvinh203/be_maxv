/**
 * DTO của cụm Tờ khai thuế TNCN (`to_khai_thue`) — bám `docs/hrm/to_khai_thue/api-contract-to-khai-thue.md`.
 *
 * Quy ước: giữ ĐÚNG tên trường máy chủ trả về, kể cả tên tiếng Việt có gạch dưới ở Bảng tính thuế
 * (`thu_nhap_ngoai`, `giam_tru_phu_thuoc`…). Đổi tên ở tầng này là mất dấu vết khi đối chiếu hợp đồng
 * và khi đọc nhật ký mạng lúc có sự cố.
 *
 * Mọi trường tiền và tỷ lệ là `number` (máy chủ làm tròn đến đồng), không bao giờ là chuỗi.
 */

/* ── Enum dùng chung ─────────────────────────────────────────────────── */

/** Nhóm xử lý thuế của một loại thu nhập ngoài lương (BR-tkt-001). */
export type NhomXuLyThue =
  | "EXEMPT_FULL"
  | "EXEMPT_CAPPED"
  | "TAXABLE_FULL"
  | "WITHHOLDING_FLAT";

/** Cách khấu trừ đã áp cho MỘT khoản (kết quả tính, không phải cấu hình danh mục). */
export type CachKhauTru =
  | "PROGRESSIVE"
  | "FLAT_10"
  | "FLAT_20"
  | "EXEMPT_COMMIT"
  | "NO_DEDUCTION";

export type LoaiLaoDongThue =
  | "HOP_DONG_3_THANG_TRO_LEN"
  | "THOI_VU_THU_VIEC"
  | "VANG_LAI";

/** Phương pháp tính của một DÒNG bảng thuế tháng. `KHAU_TRU_20` chưa phát sinh ở đợt này. */
export type PhuongPhapTinhThue =
  | "LUY_TIEN"
  | "KHAU_TRU_10"
  | "KHAU_TRU_20"
  | "CAM_KET_08"
  | "DUOI_NGUONG";

export type TrangThaiDanhMuc = "ACTIVE" | "INACTIVE";
export type KieuTraTien = "GROSS" | "NET";
export type ChuKyTranMien = "MONTHLY" | "YEARLY";

/* ── 1. Danh mục loại thu nhập ngoài lương ───────────────────────────── */

export interface OtherIncomeCategoryDto {
  id: string;
  code: string;
  name: string;
  taxTreatmentGroup: NhomXuLyThue;
  exemptCapAmount: number | null;
  exemptCapPeriod: ChuKyTranMien | null;
  withholdingRate: number | null;
  withholdingThreshold: number | null;
  legalBasisNote: string | null;
  status: TrangThaiDanhMuc;
  /** Khoản của nhóm này chỉ gán được cho nhân viên nội bộ, không nhận người vãng lai. */
  appliesToInternalOnly: boolean;
  /** Số bản ghi đang dùng danh mục — lớn hơn 0 thì không xóa được (E-tkt-002). */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeCategoryListParams {
  taxTreatmentGroup?: NhomXuLyThue;
  status?: TrangThaiDanhMuc;
  q?: string;
}

export interface CreateIncomeCategoryPayload {
  /** Bỏ trống thì máy chủ tự cấp mã `TNxx`. */
  code?: string;
  name: string;
  taxTreatmentGroup: NhomXuLyThue;
  /** Bắt buộc với `EXEMPT_CAPPED`; CẤM gửi với `EXEMPT_FULL` và `TAXABLE_FULL`. */
  exemptCapAmount?: number;
  exemptCapPeriod?: ChuKyTranMien;
  /** Chỉ dùng cho `WITHHOLDING_FLAT` — bỏ trống thì máy chủ điền 10% / 5.000.000đ. */
  withholdingRate?: number;
  withholdingThreshold?: number;
  legalBasisNote?: string;
  status?: TrangThaiDanhMuc;
}

/** Sửa danh mục KHÔNG đổi được mã. */
export type UpdateIncomeCategoryPayload = Omit<CreateIncomeCategoryPayload, "code">;

export interface UpdateIncomeCategoryResult extends OtherIncomeCategoryDto {
  /** Số bản ghi ĐÃ ghi theo tham số cũ — sửa danh mục KHÔNG hồi tố, dùng để cảnh báo. */
  affectedRecordsCount: number;
}

/* ── 2. Thu nhập ngoài lương ─────────────────────────────────────────── */

export interface OtherIncomeRecordDto {
  id: string;
  periodId: string;
  /** `null` = người vãng lai, không phải nhân viên trong hệ thống. */
  ma_nv: string | null;
  otherIncomeCategoryId: string;
  category: {
    id: string;
    code: string;
    name: string;
    /** Nhóm HIỆN TẠI của danh mục — có thể đã khác nhóm lúc ghi khoản. */
    taxTreatmentGroup: NhomXuLyThue;
  };
  fullName: string;
  taxCode: string | null;
  idCardNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isResident: boolean;
  paymentDate: string;
  paymentType: KieuTraTien;
  /** Ảnh chụp nhóm xử lý thuế LÚC GHI — hiển thị theo trường này, không theo `category`. */
  taxTreatmentGroup: NhomXuLyThue;
  grossAmount: number;
  netAmount: number;
  exemptAmount: number;
  taxableAmount: number;
  taxDeductionType: CachKhauTru;
  taxRate: number;
  taxDeducted: number;
  hasCommitment08: boolean;
  forceWithholding: boolean;
  eWithholdingCertNo: string | null;
  eWithholdingCertDate: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OtherIncomeListParams {
  periodId: string;
  maNv?: string;
  taxDeductionType?: CachKhauTru;
  taxTreatmentGroup?: NhomXuLyThue;
  isResident?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface OtherIncomeListResponse {
  records: OtherIncomeRecordDto[];
  /** Tính trên TOÀN BỘ bộ lọc, không phải trên trang đang xem. */
  summary: {
    totalRecords: number;
    totalGross: number;
    totalTax: number;
    totalNet: number;
  };
  /** Tháng đã chốt Bảng tính thuế thì mọi lệnh ghi bị chặn 403 `E-tkt-007`. */
  periodLocked: boolean;
}

export interface CreateOtherIncomePayload {
  periodId: string;
  otherIncomeCategoryId: string;
  /** `null` = vãng lai; bắt buộc có khi nhóm khác `WITHHOLDING_FLAT` (E-tkt-021). */
  ma_nv: string | null;
  fullName: string;
  taxCode?: string;
  idCardNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  isResident?: boolean;
  paymentDate: string;
  paymentType?: KieuTraTien;
  /** Số tiền kế toán gõ, hiểu theo `paymentType`. Nguyên đồng, từ 1 tới 999.999.999.999. */
  amount: number;
  hasCommitment08?: boolean;
  forceWithholding?: boolean;
  eWithholdingCertNo?: string;
  eWithholdingCertDate?: string;
  note?: string;
}

/** Sửa khoản KHÔNG chuyển được sang kỳ khác. */
export type UpdateOtherIncomePayload = Omit<CreateOtherIncomePayload, "periodId">;

/** Tính thử: KHÔNG ghi gì, dùng để hiện gross/net/thuế ngay trong form. */
export type PreviewOtherIncomePayload = Omit<CreateOtherIncomePayload, "periodId"> & {
  periodId?: string;
};

export interface OtherIncomePreviewDto {
  taxTreatmentGroup: NhomXuLyThue;
  grossAmount: number;
  netAmount: number;
  exemptAmount: number;
  taxableAmount: number;
  taxDeductionType: CachKhauTru;
  taxRate: number;
  taxDeducted: number;
  /** Câu giải thích của máy chủ — hiện nguyên văn, không diễn giải lại ở giao diện. */
  explain: string;
}

/* ── 3. Bảng tính thuế tháng ─────────────────────────────────────────── */

export interface DongBangTinhThueDto {
  /** Khóa người nhận trong kỳ (`ma_nv`, hoặc `VL:` kèm giấy tờ) — KHÔNG phải id dòng snapshot. */
  id: string;
  ma_nv: string | null;
  ho_ten: string;
  mst_ca_nhan: string | null;
  so_cccd: string | null;
  /**
   * Năm cột mô tả nhân sự — máy chủ đọc SỐNG từ hồ sơ + hợp đồng hiệu lực trong kỳ, KHÔNG nằm
   * trong ảnh chụp đã chốt. Tháng đã chốt vì thế hiện phòng ban/chức vụ hiện tại, không phải lúc
   * chốt; mọi con số tiền thì vẫn là số đóng băng.
   */
  so_hop_dong: string | null;
  /** Chữ tự do: `khong_xac_dinh` | `xac_dinh` | `thu_viec` | `thoi_vu` | `khoan`. */
  loai_hop_dong: string | null;
  /** `gross` | `net`. */
  kieu_luong: string | null;
  bo_phan: string | null;
  chuc_vu: string | null;
  loai_lao_dong: LoaiLaoDongThue;
  cu_tru: boolean;
  so_nguoi_phu_thuoc: number;
  thu_nhap_luong: number;
  thu_nhap_ngoai: number;
  /** Khoản khấu trừ riêng: nằm trong thu nhập chịu thuế nhưng KHÔNG vào nền lũy tiến. */
  thu_nhap_khau_tru_rieng: number;
  tong_thu_nhap: number;
  thu_nhap_mien_thue: number;
  thu_nhap_chiu_thue: number;
  giam_tru_ban_than: number;
  giam_tru_phu_thuoc: number;
  giam_tru_bao_hiem: number;
  tong_giam_tru: number;
  thu_nhap_tinh_thue: number;
  phuong_phap_tinh: PhuongPhapTinhThue;
  thue_luy_tien: number;
  thue_toan_phan: number;
  tong_thue_tncn: number;
  thuc_nhan: number;
}

export interface BacThue {
  khoang: number;
  thueSuat: number;
}

export interface BangTinhThueTongHopDto {
  periodId: string;
  periodName: string;
  month: number;
  year: number;
  payrollPeriodStatus: string;
  trangThai: "NHAP" | "DA_CHOT";
  chotBoi: string | null;
  chotBoiTen: string | null;
  chotLuc: string | null;
  coTheChot: boolean;
  coTheMoLai: boolean;
  bieuThueApDung: {
    taxPolicyId: string;
    effectiveFrom: string;
    personalDeduction: number;
    dependentDeduction: number;
    taxBrackets: BacThue[];
  };
  /** Luôn tính trên TOÀN KỲ, không theo bộ lọc đang áp. */
  kpi: {
    tongNguoiLaoDong: number;
    tongThuNhapChiuThue: number;
    tongGiamTruGiaCanh: number;
    tongThueTncn: number;
  };
  danhSach: DongBangTinhThueDto[];
}

export interface TaxCalculationParams {
  periodId: string;
  loaiLaoDong?: LoaiLaoDongThue;
  cuTru?: boolean;
  q?: string;
}

export interface ChotBangTinhThueResult {
  periodId: string;
  trangThai: "DA_CHOT";
  soDong: number;
  chotLuc: string;
  taxPolicyId: string;
}

export interface MoLaiBangTinhThueResult {
  periodId: string;
  trangThai: "NHAP";
}

/* ── 4. Tờ khai quý 05/KK-TNCN ───────────────────────────────────────── */

/** Mã chỉ tiêu trên mẫu 05/KK-TNCN. */
export type CtTagTncn05 =
  | "ct16"
  | "ct17"
  | "ct18"
  | "ct19"
  | "ct20"
  | "ct21"
  | "ct22"
  | "ct23"
  | "ct24"
  | "ct25"
  | "ct26"
  | "ct27"
  | "ct28"
  | "ct29"
  | "ct30"
  | "ct31"
  | "ct32";

export type ChiTieuTncn05Map = Record<CtTagTncn05, number>;

export type TrangThaiToKhai =
  | "CHUA_SAN_SANG"
  | "READY_TO_EXPORT"
  | "EXPORTED"
  | "SUBMITTED";

export interface GhiDeChiTieu {
  gia: number;
  lyDo: string;
}

export interface ThangTrongQuyDto {
  month: number;
  periodId: string | null;
  daChot: boolean;
  payrollStatus: string | null;
}

export interface ToKhaiTncn05Dto {
  nam: number;
  quy: number;
  trangThai: TrangThaiToKhai;
  /** Đúng 3 dòng, kể cả tháng chưa có kỳ lương. */
  cacThang: ThangTrongQuyDto[];
  thongTinNguoiNopThue: {
    maSoThue: string;
    ten: string;
    diaChi: string;
    /** Chưa có nơi lưu nên máy chủ trả chuỗi rỗng — ô này để trống trên tờ khai. */
    coQuanThueQuanLy: string;
    nguoiKy: string | null;
  };
  /** Bộ số cuối cùng (đã áp ghi đè); `null` khi quý chưa đủ 3 tháng chốt. */
  ct: ChiTieuTncn05Map | null;
  /** Số máy tự tính, giữ để đối chiếu với ô kế toán đã sửa. */
  ctMay: ChiTieuTncn05Map | null;
  ghiDe: Partial<Record<CtTagTncn05, GhiDeChiTieu>>;
  canhBao: string[];
  /** 13 mã sửa được — LẤY TỪ ĐÂY, không chép cứng ở giao diện. */
  ctGocSuaDuoc: CtTagTncn05[];
  tinhLuc: string | null;
  xuatBoi: string | null;
  xuatBoiTen: string | null;
  xuatLuc: string | null;
  nopBoi: string | null;
  nopBoiTen: string | null;
  nopLuc: string | null;
  nguoiKy: string | null;
  ngayKy: string | null;
}

export interface KyToKhaiDto {
  nam: number;
  quy: number;
  trangThai: TrangThaiToKhai;
  ct16: number;
  ct21: number;
  ct29: number;
  xuatBoi: string | null;
  xuatBoiTen: string | null;
  xuatLuc: string | null;
  nopBoi: string | null;
  nopBoiTen: string | null;
  nopLuc: string | null;
}

export interface PutOverridesPayload {
  nam: number;
  quy: number;
  /** Chỉ nhận mã thuộc `ctGocSuaDuoc`; `lyDo` tối thiểu 10 ký tự cho TỪNG chỉ tiêu. */
  overrides: Partial<Record<CtTagTncn05, GhiDeChiTieu>>;
}

export interface XoaGhiDeParams {
  nam: number;
  quy: number;
  /** Bỏ trống = xóa toàn bộ ghi đè của kỳ. */
  ct?: CtTagTncn05;
}

export type DinhDangFile = "excel" | "pdf";

export interface XuatToKhaiPayload {
  nam: number;
  quy: number;
  format: DinhDangFile;
  nguoiKy?: string;
  ngayKy?: string;
}

export interface DanhDauDaNopPayload {
  nam: number;
  quy: number;
  nguoiKy?: string;
  ngayKy?: string;
}

