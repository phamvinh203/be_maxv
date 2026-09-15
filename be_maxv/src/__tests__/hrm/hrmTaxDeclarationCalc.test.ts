import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CT_GOC_SUA_DUOC } from '../../constants/hrm/to_khai_thue/chiTieuTncn05';
import type { ToKhaiThueErrorCode } from '../../constants/hrm/to_khai_thue/toKhaiThueErrors';
import { ToKhaiThueError } from '../../helpers/hrm/toKhaiThueErrors';
import {
  cacThangCuaQuy,
  chuanHoaGhiDe,
  gopChiTietNhanVien,
  hopNhatGhiDe,
  kiemTraCanDoi,
  tinhChiTieuMay,
  type DongThueQuy,
} from '../../services/client/hrm/to_khai_thue/taxDeclarationCalc';

/** Tờ khai 05/KK-TNCN — tính 17 chỉ tiêu, ghi đè, kiểm cân đối (data-model Mục 8, BR-tkt-018). */

function dong(g: Partial<DongThueQuy> = {}): DongThueQuy {
  return {
    thang: 7,
    recipientKey: 'NV0001',
    ma_nv: 'NV0001',
    ho_ten: 'Nguyễn Văn A',
    mst_ca_nhan: null,
    so_cccd: null,
    loai_lao_dong: 'HOP_DONG_3_THANG_TRO_LEN',
    cu_tru: true,
    thu_nhap_luong: 0,
    thu_nhap_ngoai: 0,
    thu_nhap_khau_tru_rieng: 0,
    thu_nhap_mien_thue: 0,
    thu_nhap_chiu_thue: 0,
    giam_tru_ban_than: 0,
    giam_tru_phu_thuoc: 0,
    giam_tru_bao_hiem: 0,
    tong_giam_tru: 0,
    thu_nhap_tinh_thue: 0,
    thue_luy_tien: 0,
    thue_toan_phan: 0,
    tong_thue_tncn: 0,
    ...g,
    // Dữ liệu thật luôn có tổng thu nhập ≥ thu nhập chịu thuế — không nêu thì lấy bằng TNCT.
    tong_thu_nhap: g.tong_thu_nhap ?? g.thu_nhap_chiu_thue ?? 0,
  };
}

const loiMa = (ma: ToKhaiThueErrorCode) => (e: unknown) =>
  e instanceof ToKhaiThueError && e.code === ma;

const LY_DO = 'loại trừ khoản kê nhầm kỳ trước';

/** Quý III: 1 NV HĐLĐ đủ 3 tháng · 1 vãng lai tháng 8 bị khấu trừ · 1 NV thời vụ tháng 9 dưới ngưỡng. */
const QUY_III = [
  ...[7, 8, 9].map((thang) =>
    dong({ thang, thu_nhap_chiu_thue: 20_000_000, tong_thue_tncn: 475_000 }),
  ),
  dong({
    thang: 8,
    recipientKey: 'VL:trần thị b',
    ma_nv: null,
    ho_ten: 'Trần Thị B',
    loai_lao_dong: 'VANG_LAI',
    thu_nhap_chiu_thue: 6_000_000,
    tong_thue_tncn: 600_000,
  }),
  dong({
    thang: 9,
    recipientKey: 'NV0002',
    ma_nv: 'NV0002',
    loai_lao_dong: 'THOI_VU_THU_VIEC',
    thu_nhap_chiu_thue: 4_000_000,
  }),
];

test('A-tkt-04: quý dương lịch = 3 tháng liên tiếp cố định', () => {
  assert.deepEqual(cacThangCuaQuy(1), [1, 2, 3]);
  assert.deepEqual(cacThangCuaQuy(3), [7, 8, 9]);
  assert.deepEqual(cacThangCuaQuy(4), [10, 11, 12]);
});

test('Mục 8: đếm NGƯỜI một lần qua 3 tháng, cộng dồn tiền; [24] [25] [32] = 0', () => {
  const ct = tinhChiTieuMay(QUY_III);

  assert.equal(ct.ct16, 3, 'NV0001 có mặt 3 tháng vẫn chỉ là 1 người');
  assert.equal(ct.ct17, 1, 'chỉ NV0001 có HĐLĐ từ 3 tháng');
  assert.equal(ct.ct19, 2, 'NV0001 + vãng lai có thuế > 0');
  assert.equal(ct.ct20, 0);
  assert.equal(ct.ct18, 2);
  assert.equal(ct.ct22, 60_000_000 + 6_000_000 + 4_000_000);
  assert.equal(ct.ct23, 0);
  assert.equal(ct.ct21, 70_000_000);
  assert.equal(
    ct.ct27,
    66_000_000,
    'người không có thuế không vào diện khấu trừ',
  );
  assert.equal(ct.ct28, 0);
  assert.equal(ct.ct26, 66_000_000);
  assert.equal(ct.ct30, 3 * 475_000 + 600_000);
  assert.equal(ct.ct31, 0);
  assert.equal(ct.ct29, 2_025_000);
  assert.equal(ct.ct24, 0);
  assert.equal(ct.ct25, 0);
  assert.equal(ct.ct32, 0, 'chủ dự án chốt 2026-09-15: [32] không tự tính');
  assert.deepEqual(kiemTraCanDoi(ct), [], 'số máy tự tính luôn cân đối');
});

test('ISSUE-tkt-002: [16]/[17] chỉ đếm người ĐƯỢC TRẢ thu nhập trong quý', () => {
  const ct = tinhChiTieuMay([
    ...QUY_III,
    // Hợp đồng từ quý sau: vẫn có dòng 0 đồng cả 3 tháng trên Bảng tính thuế tháng.
    ...[7, 8, 9].map((thang) =>
      dong({ thang, recipientKey: 'NV0009', ma_nv: 'NV0009' }),
    ),
    // Vào làm tháng 9: tháng 7 là dòng 0 đồng, tháng 9 có lương dưới mức chịu thuế.
    dong({ thang: 7, recipientKey: 'NV0010', ma_nv: 'NV0010' }),
    dong({
      thang: 9,
      recipientKey: 'NV0010',
      ma_nv: 'NV0010',
      tong_thu_nhap: 8_000_000,
    }),
  ]);
  assert.equal(ct.ct16, 4, '3 người của QUY_III + NV0010; NV0009 không được trả đồng nào');
  assert.equal(ct.ct17, 2, 'NV0001 + NV0010');
});

test('Cư trú phải đúng ở MỌI tháng có mặt — lệch một tháng là xếp không cư trú', () => {
  const ct = tinhChiTieuMay([
    dong({
      thang: 7,
      recipientKey: 'VL:x',
      ma_nv: null,
      loai_lao_dong: 'VANG_LAI',
      thu_nhap_chiu_thue: 10_000_000,
      tong_thue_tncn: 1_000_000,
    }),
    dong({
      thang: 8,
      recipientKey: 'VL:x',
      ma_nv: null,
      loai_lao_dong: 'VANG_LAI',
      cu_tru: false,
      thu_nhap_chiu_thue: 5_000_000,
    }),
  ]);
  assert.equal(ct.ct16, 1);
  assert.equal(ct.ct20, 1);
  assert.equal(ct.ct19, 0);
  assert.equal(ct.ct23, 15_000_000);
  assert.equal(ct.ct28, 15_000_000);
  assert.equal(ct.ct31, 1_000_000);
});

test('AC-tkt-025: ghi đè [22] thì [21] tính lại theo số mới; ô tổng không bao giờ giữ số ghi đè', () => {
  const ctMay = tinhChiTieuMay(QUY_III);
  const ct = hopNhatGhiDe(ctMay, {
    ct22: { gia: 480_000_000, lyDo: LY_DO },
    // Dữ liệu cũ lỡ lưu ghi đè vào ô tổng hợp: phải bị bỏ qua, không được đè lên công thức.
    ...({ ct21: { gia: 1, lyDo: LY_DO } } as object),
  });
  assert.equal(ct.ct22, 480_000_000);
  assert.equal(ct.ct21, 480_000_000 + ct.ct23);
  assert.equal(
    ctMay.ct22,
    70_000_000,
    'số máy giữ nguyên, không bị ghi đè làm bẩn',
  );
});

test('TC-tkt-089: ghi đè cả [27] và [28] thì [26] là tổng hai giá trị MỚI', () => {
  const ct = hopNhatGhiDe(tinhChiTieuMay(QUY_III), {
    ct27: { gia: 50_000_000, lyDo: LY_DO },
    ct28: { gia: 7_000_000, lyDo: LY_DO },
  });
  assert.equal(ct.ct26, 57_000_000);
});

test('AC-tkt-026: thiếu lý do hoặc lý do dưới 10 ký tự -> E-tkt-011', () => {
  for (const lyDo of [undefined, '', '         ', 'ngắn quá']) {
    assert.throws(
      () => chuanHoaGhiDe({ ct22: { gia: 1, lyDo } }),
      loiMa('E-tkt-011'),
      String(lyDo),
    );
  }
});

test('AC-tkt-027: ghi đè chỉ tiêu tổng hợp -> E-tkt-012, kể cả có lý do; mã lạ cũng 012', () => {
  for (const ma of ['ct18', 'ct21', 'ct26', 'ct29', 'ct15', 'ct33', 'abc']) {
    assert.throws(
      () => chuanHoaGhiDe({ [ma]: { gia: 1, lyDo: LY_DO } }),
      loiMa('E-tkt-012'),
      ma,
    );
  }
});

test('TC-tkt-088: đủ 13 chỉ tiêu gốc đều ghi đè được', () => {
  for (const ma of CT_GOC_SUA_DUOC) {
    assert.deepEqual(chuanHoaGhiDe({ [ma]: { gia: 3, lyDo: LY_DO } }), {
      [ma]: { gia: 3, lyDo: LY_DO },
    });
  }
});

test('Giá trị ghi đè: âm hoặc đếm người không nguyên -> E-tkt-012; tiền lẻ làm tròn tới đồng', () => {
  assert.throws(
    () => chuanHoaGhiDe({ ct22: { gia: -1, lyDo: LY_DO } }),
    loiMa('E-tkt-012'),
  );
  assert.throws(
    () => chuanHoaGhiDe({ ct16: { gia: 2.5, lyDo: LY_DO } }),
    loiMa('E-tkt-012'),
  );
  assert.equal(
    chuanHoaGhiDe({ ct22: { gia: 1000.6, lyDo: `  ${LY_DO}  ` } }).ct22?.gia,
    1001,
  );
  assert.equal(
    chuanHoaGhiDe({ ct22: { gia: 1, lyDo: `  ${LY_DO}  ` } }).ct22?.lyDo,
    LY_DO,
  );
});

test('RVW-723: ghi đè vượt cột lưu (ct16 Int, tiền Decimal(18,2)) -> E-tkt-012; đúng trần vẫn nhận', () => {
  const loi012 = (e: unknown) =>
    e instanceof ToKhaiThueError && e.code === 'E-tkt-012';
  assert.throws(
    () => chuanHoaGhiDe({ ct16: { gia: 3_000_000_000, lyDo: LY_DO } }),
    loi012,
  );
  assert.throws(
    () => chuanHoaGhiDe({ ct22: { gia: 1e17, lyDo: LY_DO } }),
    loi012,
  );
  assert.equal(
    chuanHoaGhiDe({ ct16: { gia: 2_147_483_647, lyDo: LY_DO } }).ct16?.gia,
    2_147_483_647,
  );
  assert.equal(
    chuanHoaGhiDe({ ct22: { gia: 999_999_999_999_999, lyDo: LY_DO } }).ct22
      ?.gia,
    999_999_999_999_999,
  );
});

test('Kiểm cân đối bắt ghi đè làm lệch: [17] > [16] chỉ CẢNH BÁO, không chặn', () => {
  const ct = hopNhatGhiDe(tinhChiTieuMay(QUY_III), {
    ct17: { gia: 9, lyDo: LY_DO },
  });
  const canhBao = kiemTraCanDoi(ct);
  assert.equal(canhBao.length, 1);
  assert.match(canhBao[0], /\[17\]/);
});

test('FR-tkt-015: bảng chi tiết chỉ gồm nhân viên nội bộ, cộng dồn 3 tháng, định danh theo tháng mới nhất', () => {
  const ds = gopChiTietNhanVien([
    dong({
      thang: 9,
      ho_ten: 'Nguyễn Văn A (đổi tên)',
      mst_ca_nhan: '0101',
      tong_thue_tncn: 475_000,
    }),
    dong({ thang: 7, tong_thue_tncn: 475_000 }),
    QUY_III[3], // vãng lai — không lên bảng chi tiết
  ]);
  assert.equal(ds.length, 1);
  assert.equal(ds[0].ma_nv, 'NV0001');
  assert.equal(ds[0].ho_ten, 'Nguyễn Văn A (đổi tên)');
  assert.equal(ds[0].mst_ca_nhan, '0101');
  assert.deepEqual(ds[0].cacThang, [7, 9]);
  assert.equal(ds[0].tong_thue_tncn, 950_000);
});
