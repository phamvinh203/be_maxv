import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tinhBangTinhThueThang,
  type DongBangTinhThueTinh,
  type DongLuongDauVao,
  type KhoanNgoaiDauVao,
  type NhanVienDauVao,
} from '../../services/client/hrm/to_khai_thue/taxSheetRows';
import {
  demNguoiPhuThuocTrongKy,
  laNguoiPhuThuocHieuLucTrongKy,
} from '../../helpers/hrm/nguoiPhuThuocTrongKy';

/**
 * Bảng tính thuế tháng — bảng quyết định 3 nhánh (data-model Mục 5.2), công thức bắc cầu
 * (Mục 5.1), phương án "tách 2 phần" thu nhập ngoài lương (chủ dự án chốt 2026-09-15) và bất biến
 * số học từng dòng.
 */

const BIEU_5_BAC = [
  { khoang: 10_000_000, thueSuat: 5 },
  { khoang: 30_000_000, thueSuat: 10 },
  { khoang: 60_000_000, thueSuat: 20 },
  { khoang: 100_000_000, thueSuat: 30 },
  { khoang: null, thueSuat: 35 },
];

const CHINH_SACH = {
  personalDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  taxBrackets: BIEU_5_BAC,
};

function luong(o: Partial<DongLuongDauVao> = {}): DongLuongDauVao {
  return {
    ma_nv: 'NV0001',
    fullName: 'Nguyễn Văn A',
    grossIncome: 20_000_000,
    otTaxExemptAmount: 0,
    lunchAllowanceExemptAmount: 0,
    otherAllowanceTaxExemptAmount: 0,
    employeeInsuranceDeduction: 0,
    contractType: 'xac_dinh',
    personalIncomeTax: 0,
    ...o,
  };
}

function nhanVien(o: Partial<NhanVienDauVao> = {}): NhanVienDauVao {
  return {
    ma_nv: 'NV0001',
    ho_ten: 'Nguyễn Văn A',
    mst_ca_nhan: '8000000001',
    so_cccd: null,
    loaiHdHieuLuc: 'xac_dinh',
    tinhTncn: true,
    nguoiPhuThuoc: [],
    ...o,
  };
}

function khoan(o: Partial<KhoanNgoaiDauVao> = {}): KhoanNgoaiDauVao {
  return {
    ma_nv: null,
    fullName: 'Trần Thị B',
    taxCode: null,
    idCardNumber: null,
    isResident: true,
    taxTreatmentGroup: 'WITHHOLDING_FLAT',
    grossAmount: 6_000_000,
    taxableAmount: 0,
    taxDeducted: 600_000,
    taxDeductionType: 'FLAT_10',
    ...o,
  };
}

function tinh(args: {
  dongLuong?: DongLuongDauVao[];
  nhanVien?: NhanVienDauVao[];
  khoanNgoai?: KhoanNgoaiDauVao[];
}): DongBangTinhThueTinh[] {
  return tinhBangTinhThueThang({
    nam: 2026,
    thang: 9,
    dongLuong: args.dongLuong ?? [],
    nhanVien: args.nhanVien ?? [],
    khoanNgoai: args.khoanNgoai ?? [],
    chinhSach: CHINH_SACH,
  });
}

/** Bất biến QA kiểm được TỪNG dòng (data-model Mục 3.4, sửa theo phương án tách 2 phần). */
function kiemBatBien(d: DongBangTinhThueTinh): void {
  const ten = `[${d.recipientKey}]`;
  assert.equal(
    d.tong_thu_nhap,
    d.thu_nhap_luong + d.thu_nhap_ngoai,
    `${ten} tổng thu nhập`,
  );
  assert.equal(
    d.thu_nhap_chiu_thue,
    Math.max(0, d.tong_thu_nhap - d.thu_nhap_mien_thue),
    `${ten} thu nhập chịu thuế`,
  );
  assert.ok(
    d.thu_nhap_khau_tru_rieng <= d.thu_nhap_ngoai,
    `${ten} khấu trừ riêng ⊂ thu nhập ngoài`,
  );
  assert.equal(
    d.tong_giam_tru,
    d.giam_tru_ban_than + d.giam_tru_phu_thuoc + d.giam_tru_bao_hiem,
    `${ten} tổng giảm trừ`,
  );
  assert.equal(
    d.tong_thue_tncn,
    d.thue_luy_tien + d.thue_toan_phan,
    `${ten} tổng thuế`,
  );
  if (d.phuong_phap_tinh === 'LUY_TIEN') {
    assert.equal(
      d.thu_nhap_tinh_thue,
      Math.max(
        0,
        d.thu_nhap_chiu_thue - d.thu_nhap_khau_tru_rieng - d.tong_giam_tru,
      ),
      `${ten} thu nhập tính thuế`,
    );
  } else {
    assert.equal(d.thue_luy_tien, 0, `${ten} không lũy tiến`);
    assert.equal(d.tong_giam_tru, 0, `${ten} không giảm trừ`);
    assert.equal(d.thu_nhap_tinh_thue, 0, `${ten} không có thu nhập tính thuế`);
  }
  if (d.loai_lao_dong === 'VANG_LAI') {
    assert.equal(d.ma_nv, null, `${ten} vãng lai không có mã`);
    assert.equal(d.thu_nhap_luong, 0, `${ten} vãng lai không có lương`);
  }
}

/* ── AC-tkt-017 ────────────────────────────────────────────────────── */

test('AC-tkt-017: lương 20tr + thưởng chịu thuế 5tr, giảm trừ 15,5tr -> thuế lũy tiến 475.000', () => {
  const [d] = tinh({
    dongLuong: [luong()],
    nhanVien: [nhanVien()],
    khoanNgoai: [
      khoan({
        ma_nv: 'NV0001',
        fullName: 'Nguyễn Văn A',
        taxTreatmentGroup: 'TAXABLE_FULL',
        grossAmount: 5_000_000,
        taxableAmount: 5_000_000,
        taxDeducted: 0,
        taxDeductionType: 'PROGRESSIVE',
      }),
    ],
  });

  assert.equal(d.thu_nhap_chiu_thue, 25_000_000);
  assert.equal(d.thu_nhap_tinh_thue, 9_500_000);
  assert.equal(d.phuong_phap_tinh, 'LUY_TIEN');
  assert.equal(
    d.thue_luy_tien,
    475_000,
    '9.500.000 × 5% (bậc 1, đến 10 triệu)',
  );
  kiemBatBien(d);
});

/* ── Phương án "tách 2 phần" — đúng các con số chủ dự án đã duyệt ───── */

test('Tách 2 phần: vãng lai hoa hồng 6tr khấu trừ 10% -> thu nhập 6tr, thực nhận 5,4tr (không âm)', () => {
  const [d] = tinh({ khoanNgoai: [khoan()] });

  assert.equal(d.loai_lao_dong, 'VANG_LAI');
  assert.equal(d.thu_nhap_ngoai, 6_000_000);
  assert.equal(d.thu_nhap_khau_tru_rieng, 6_000_000);
  assert.equal(d.thu_nhap_chiu_thue, 6_000_000, 'phải lên tờ khai ở ct22');
  assert.equal(d.thu_nhap_tinh_thue, 0);
  assert.equal(d.phuong_phap_tinh, 'KHAU_TRU_10');
  assert.equal(d.thue_toan_phan, 600_000);
  assert.equal(d.thuc_nhan, 5_400_000);
  kiemBatBien(d);
});

test('Tách 2 phần: NV HĐLĐ lương 20tr + hoa hồng khấu trừ riêng 6tr -> hoa hồng KHÔNG vào nền lũy tiến', () => {
  const [d] = tinh({
    dongLuong: [luong()],
    nhanVien: [nhanVien()],
    khoanNgoai: [khoan({ ma_nv: 'NV0001', fullName: 'Nguyễn Văn A' })],
  });

  assert.equal(d.thu_nhap_chiu_thue, 26_000_000);
  // 26tr − 6tr đã khấu trừ riêng − 15,5tr giảm trừ = 4,5tr
  assert.equal(d.thu_nhap_tinh_thue, 4_500_000);
  assert.equal(d.thue_luy_tien, 225_000);
  assert.equal(
    d.thue_toan_phan,
    600_000,
    'thuế đã khấu trừ trên hoa hồng phải hiện ở đây',
  );
  assert.equal(d.tong_thue_tncn, 825_000);
  kiemBatBien(d);
});

/* ── Bảng quyết định 3 nhánh ───────────────────────────────────────── */

test('THOI_VU_THU_VIEC: lấy THẲNG thuế engine lương, không tính lại 10% (NFR-tkt-005)', () => {
  const [d] = tinh({
    // Engine lương tính ra 612.345 — số lẻ cố ý để bắt việc tính lại (10% của gross sẽ ra số tròn).
    dongLuong: [
      luong({
        contractType: 'thu_viec',
        grossIncome: 6_000_000,
        personalIncomeTax: 612_345,
        employeeInsuranceDeduction: 630_000,
      }),
    ],
    nhanVien: [nhanVien({ loaiHdHieuLuc: 'thu_viec' })],
  });

  assert.equal(d.loai_lao_dong, 'THOI_VU_THU_VIEC');
  assert.equal(d.phuong_phap_tinh, 'KHAU_TRU_10');
  assert.equal(d.thue_toan_phan, 612_345);
  assert.equal(
    d.giam_tru_ban_than,
    0,
    'nhánh khấu trừ tại nguồn không giảm trừ gia cảnh',
  );
  assert.equal(d.giam_tru_bao_hiem, 0, 'BH không phải giảm trừ ở nhánh này');
  // ...nhưng vẫn là tiền đã trừ khỏi lương: thực nhận = gross − thuế − BH (SRS Mục 4.3).
  assert.equal(d.thuc_nhan, 6_000_000 - 612_345 - 630_000);
  kiemBatBien(d);
});

test('BR-tkt-011: hợp đồng khoán đi nhánh lũy tiến, không phải khấu trừ 10%', () => {
  const [d] = tinh({
    dongLuong: [luong({ contractType: 'khoan' })],
    nhanVien: [nhanVien({ loaiHdHieuLuc: 'khoan' })],
  });
  assert.equal(d.loai_lao_dong, 'HOP_DONG_3_THANG_TRO_LEN');
  assert.equal(d.phuong_phap_tinh, 'LUY_TIEN');
});

test('GAP-QA-05: hợp đồng tắt tính TNCN -> thuế lũy tiến bằng 0, giống engine lương', () => {
  const [d] = tinh({
    dongLuong: [luong({ grossIncome: 50_000_000 })],
    nhanVien: [nhanVien({ tinhTncn: false })],
  });
  assert.ok(
    d.thu_nhap_tinh_thue > 0,
    'vẫn hiện thu nhập tính thuế để giải trình',
  );
  assert.equal(d.thue_luy_tien, 0);
});

/* ── Người phụ thuộc theo kỳ đăng ký (A-tkt-05) ────────────────────── */

test('A-tkt-05: chỉ đếm người phụ thuộc có hiệu lực trong kỳ', () => {
  const [d] = tinh({
    dongLuong: [luong({ grossIncome: 40_000_000 })],
    nhanVien: [
      nhanVien({
        nguoiPhuThuoc: [
          // hiệu lực — không giới hạn
          {
            dk_tu_thang: null,
            dk_tu_nam: null,
            dk_den_thang: null,
            dk_den_nam: null,
          },
          // đăng ký từ năm sau — KHÔNG được trừ ở 09/2026
          {
            dk_tu_thang: 1,
            dk_tu_nam: 2027,
            dk_den_thang: null,
            dk_den_nam: null,
          },
          // đã hết hạn tháng trước — KHÔNG được trừ
          {
            dk_tu_thang: null,
            dk_tu_nam: 2020,
            dk_den_thang: 8,
            dk_den_nam: 2026,
          },
        ],
      }),
    ],
  });
  assert.equal(d.so_nguoi_phu_thuoc, 1);
  assert.equal(d.giam_tru_phu_thuoc, 6_200_000);
  kiemBatBien(d);
});

test('Kỳ đăng ký người phụ thuộc: biên đầu/cuối tháng và năm thiếu tháng', () => {
  const tu9 = {
    dk_tu_thang: 9,
    dk_tu_nam: 2026,
    dk_den_thang: null,
    dk_den_nam: null,
  };
  assert.equal(
    laNguoiPhuThuocHieuLucTrongKy(tu9, 2026, 9),
    true,
    'đúng tháng bắt đầu',
  );
  assert.equal(
    laNguoiPhuThuocHieuLucTrongKy(tu9, 2026, 8),
    false,
    'tháng trước khi bắt đầu',
  );

  const den9 = {
    dk_tu_thang: null,
    dk_tu_nam: null,
    dk_den_thang: 9,
    dk_den_nam: 2026,
  };
  assert.equal(
    laNguoiPhuThuocHieuLucTrongKy(den9, 2026, 9),
    true,
    'đúng tháng kết thúc',
  );
  assert.equal(
    laNguoiPhuThuocHieuLucTrongKy(den9, 2026, 10),
    false,
    'tháng sau khi kết thúc',
  );

  // Có năm mà thiếu tháng: từ tháng 1 / hết tháng 12.
  const ca2026 = {
    dk_tu_thang: null,
    dk_tu_nam: 2026,
    dk_den_thang: null,
    dk_den_nam: 2026,
  };
  assert.equal(demNguoiPhuThuocTrongKy([ca2026], 2026, 1), 1);
  assert.equal(demNguoiPhuThuocTrongKy([ca2026], 2026, 12), 1);
  assert.equal(demNguoiPhuThuocTrongKy([ca2026], 2027, 1), 0);
});

/* ── Gom người ─────────────────────────────────────────────────────── */

test('recipientKey: vãng lai 2 khoản cùng tên lệch hoa/thường -> MỘT dòng, cộng dồn', () => {
  const ds = tinh({
    khoanNgoai: [
      khoan({
        fullName: 'Trần Thị B',
        grossAmount: 6_000_000,
        taxDeducted: 600_000,
      }),
      khoan({
        fullName: '  trần thị b ',
        grossAmount: 3_000_000,
        taxDeducted: 0,
        taxDeductionType: 'NO_DEDUCTION',
      }),
    ],
  });
  assert.equal(ds.length, 1, 'chỉ tiêu [16] của tờ khai phải đếm MỘT lao động');
  assert.equal(ds[0].thu_nhap_ngoai, 9_000_000);
  assert.equal(ds[0].thue_toan_phan, 600_000);
  assert.equal(
    ds[0].phuong_phap_tinh,
    'KHAU_TRU_10',
    'ghi theo khoản đã thực sự bị khấu trừ',
  );
  kiemBatBien(ds[0]);
});

test('Nhân viên chỉ có khoản ngoài lương, KHÔNG có dòng lương -> vẫn lên bảng', () => {
  const ds = tinh({
    nhanVien: [nhanVien({ ma_nv: 'NV0009', ho_ten: 'Đã nghỉ việc' })],
    khoanNgoai: [
      khoan({
        ma_nv: 'NV0009',
        fullName: 'Đã nghỉ việc',
        taxTreatmentGroup: 'TAXABLE_FULL',
        grossAmount: 30_000_000,
        taxableAmount: 30_000_000,
        taxDeducted: 0,
        taxDeductionType: 'PROGRESSIVE',
      }),
    ],
  });
  assert.equal(ds.length, 1);
  assert.equal(ds[0].ma_nv, 'NV0009');
  assert.equal(ds[0].thu_nhap_luong, 0);
  assert.equal(ds[0].thu_nhap_chiu_thue, 30_000_000);
  kiemBatBien(ds[0]);
});

test('Bất biến giữ đúng trên một kỳ trộn đủ 3 loại lao động', () => {
  const ds = tinh({
    dongLuong: [
      luong({
        ma_nv: 'NV0001',
        otTaxExemptAmount: 1_125_000,
        employeeInsuranceDeduction: 2_100_000,
      }),
      luong({
        ma_nv: 'NV0002',
        contractType: 'thoi_vu',
        grossIncome: 7_000_000,
        personalIncomeTax: 700_000,
      }),
    ],
    nhanVien: [
      nhanVien({ ma_nv: 'NV0001' }),
      nhanVien({ ma_nv: 'NV0002', loaiHdHieuLuc: 'thoi_vu' }),
    ],
    khoanNgoai: [
      khoan({ ma_nv: 'NV0001', fullName: 'Nguyễn Văn A' }),
      khoan({
        ma_nv: 'NV0001',
        fullName: 'Nguyễn Văn A',
        taxTreatmentGroup: 'EXEMPT_CAPPED',
        grossAmount: 1_500_000,
        taxableAmount: 300_000,
        taxDeducted: 0,
        taxDeductionType: 'NO_DEDUCTION',
      }),
      khoan({
        fullName: 'Lê Văn C',
        isResident: false,
        taxDeductionType: 'FLAT_20',
      }),
    ],
  });

  assert.equal(ds.length, 3);
  for (const d of ds) kiemBatBien(d);
  // Phần miễn trong trần ăn ca (1,2tr) KHÔNG được lọt vào thu nhập ngoài lương.
  const nv1 = ds.find((d) => d.ma_nv === 'NV0001')!;
  assert.equal(nv1.thu_nhap_ngoai, 300_000 + 6_000_000);
});
