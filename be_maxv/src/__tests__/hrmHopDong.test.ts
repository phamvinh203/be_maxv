import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  homNayVN,
  hopDongChongLan,
  khoangGiaoNhau,
  loaiHdVeNhanVien,
} from '../services/client/hrm/du_lieu_ca_nhan/hopDong.service';
import {
  doiHopDongBodySchema,
  hopDongBodySchema,
  hopDongListQuerySchema,
  hopDongUpdateSchema,
} from '../validators/hrm/du_lieu_ca_nhan/hopDong.validator';
import { nhanVienUpdateSchema } from '../validators/hrm/du_lieu_ca_nhan/nhanVien.validator';

/**
 * npx tsx --test src/__tests__/hrmHopDong.test.ts
 *
 * Bộ test đợt P0 của phân hệ HRM — phần LUẬT THUẦN, chạy được không cần Postgres.
 * Truy vết tới `docs/hrm/qa/test-cases.md` Mục 6B (mã TC ghi ngay trong tên từng ca).
 *
 * Phạm vi KHÔNG phủ được ở đây (cần DB thật, để Phase B):
 *   - `assertKhongChongLan` / `assertSoHdDuyNhat` — phần truy vấn;
 *   - ràng buộc `EXCLUDE USING gist` và mã SQLSTATE `23P01` thật của Postgres;
 *   - đua hai request đồng thời (TC-hrm-209, TC-hrm-210).
 * Ba thứ đó phải có test tích hợp thật, KHÔNG được suy đoán — xem `ADR-002` mục Hệ quả.
 */

/** Ngày `YYYY-MM-DD` -> Date nửa đêm UTC, đúng cách validator dựng ngày cho cột `@db.Date`. */
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const HD_HOP_LE = {
  ma_nv: 'NV0001',
  so_hd: 'HĐLĐ-001/2026',
  loai_hd: 'khong_xac_dinh',
  kieu_luong: 'gross',
  luong_chinh: 25_000_000,
  luong_bhxh: 10_000_000,
  ngay_bat_dau: '2026-01-01',
  trich_bhxh: true,
  tinh_tncn: true,
};

/* ============ Gom nhóm nghiệp vụ — QĐ #18, BR-hrm-022 ============ */

test('loaiHdVeNhanVien: ba nhóm nghiệp vụ, mọi nhãn lạ về hợp đồng lao động', () => {
  assert.equal(loaiHdVeNhanVien('thu_viec'), 'thu_viec');
  assert.equal(loaiHdVeNhanVien('khoan'), 'hdvc');
  for (const nhan of [
    'khong_xac_dinh',
    'xac_dinh',
    'thoi_vu',
    'nhan-la-hoac',
  ]) {
    assert.equal(loaiHdVeNhanVien(nhan), 'hdld', `nhãn "${nhan}"`);
  }
});

test('loaiHdVeNhanVien: hạ chữ thường + cắt khoảng trắng trước khi gom (TC-hrm-205b)', () => {
  // `loai_hd` là chữ tự do và KHÔNG được chuẩn hóa lúc lưu. Không hạ chữ thường ở đây thì
  // "Khoan" rơi nhầm sang nhóm hợp đồng lao động và lọt lưới chống chồng lấn (BUG-HRM-27).
  assert.equal(loaiHdVeNhanVien('Khoan'), 'hdvc');
  assert.equal(loaiHdVeNhanVien('  KHOAN  '), 'hdvc');
  assert.equal(loaiHdVeNhanVien(' Thu_Viec'), 'thu_viec');
});

/* ============ Khoảng ngày ĐÓNG HAI ĐẦU — QĐ #6, BR-hrm-026 ============ */

test('khoangGiaoNhau: hai hợp đồng chạm nhau đúng một ngày VẪN là chồng lấn (TC-hrm-203)', () => {
  // Ngày 31/03 không được thuộc về hai hợp đồng cùng nhóm.
  assert.equal(
    khoangGiaoNhau(
      d('2026-01-01'),
      d('2026-03-31'),
      d('2026-03-31'),
      d('2026-12-31'),
    ),
    true,
  );
});

test('khoangGiaoNhau: liền kề KHÔNG chạm (31/03 và 01/04) thì không chồng lấn', () => {
  assert.equal(
    khoangGiaoNhau(
      d('2026-01-01'),
      d('2026-03-31'),
      d('2026-04-01'),
      d('2026-12-31'),
    ),
    false,
  );
});

test('khoangGiaoNhau: hai hợp đồng MỘT NGÀY cùng ngày là chồng lấn (TC-hrm-202)', () => {
  // Ca then chốt: dùng khoảng nửa mở thì hai khoảng này có độ dài bằng không và lọt lưới.
  assert.equal(
    khoangGiaoNhau(
      d('2026-05-01'),
      d('2026-05-01'),
      d('2026-05-01'),
      d('2026-05-01'),
    ),
    true,
  );
});

test('khoangGiaoNhau: ngày kết thúc rỗng = vô thời hạn, chặn mọi hợp đồng bắt đầu sau đó', () => {
  assert.equal(
    khoangGiaoNhau(d('2026-01-01'), null, d('2030-01-01'), d('2030-12-31')),
    true,
  );
  // ...nhưng KHÔNG chặn hợp đồng đã kết thúc TRƯỚC ngày nó bắt đầu.
  assert.equal(
    khoangGiaoNhau(d('2026-01-01'), null, d('2025-01-01'), d('2025-12-31')),
    false,
  );
  // Hai hợp đồng cùng vô thời hạn thì luôn giao nhau.
  assert.equal(
    khoangGiaoNhau(d('2026-01-01'), null, d('2030-01-01'), null),
    true,
  );
});

/* ============ Luật chồng lấn hoàn chỉnh (nhóm + ngày) ============ */

const hd = (loai: string, batDau: string, ketThuc: string | null) => ({
  loai_hd: loai,
  ngay_bat_dau: d(batDau),
  ngay_ket_thuc: ketThuc ? d(ketThuc) : null,
});

test('hopDongChongLan: KHÁC nhóm thì chạy song song được (TC-hrm-204)', () => {
  assert.equal(
    hopDongChongLan(
      hd('khoan', '2026-06-01', '2026-12-31'),
      hd('khong_xac_dinh', '2026-01-01', null),
    ),
    false,
  );
});

test('hopDongChongLan: thử việc là nhóm RIÊNG, song song với hợp đồng lao động (TC-hrm-205c)', () => {
  assert.equal(
    hopDongChongLan(
      hd('thu_viec', '2026-02-01', '2026-04-30'),
      hd('khong_xac_dinh', '2026-01-01', null),
    ),
    false,
  );
});

test('hopDongChongLan: CÙNG nhóm, giao ngày -> chặn (TC-hrm-205)', () => {
  assert.equal(
    hopDongChongLan(
      hd('khoan', '2026-08-01', '2027-01-31'),
      hd('khoan', '2026-06-01', '2026-12-31'),
    ),
    true,
  );
});

test('hopDongChongLan: KHÁC NHÃN nhưng CÙNG nhóm hợp đồng lao động -> chặn (TC-hrm-205a)', () => {
  // Ca then chốt của QĐ #18: khóa theo nhãn gốc thì ca này LỌT và Payroll cộng hai mức lương.
  assert.equal(
    hopDongChongLan(
      hd('xac_dinh', '2026-03-01', '2026-09-30'),
      hd('khong_xac_dinh', '2026-01-01', null),
    ),
    true,
  );
});

test('hopDongChongLan: nhãn viết hoa không lách được (TC-hrm-205b)', () => {
  assert.equal(
    hopDongChongLan(
      hd('Khoan', '2026-04-01', '2026-12-31'),
      hd('khoan', '2026-01-01', '2026-06-30'),
    ),
    true,
  );
});

/* ============ Mốc "hôm nay" theo giờ Việt Nam — BUG-HRM-07, TC-hrm-208 ============ */

test('homNayVN: 02:00 giờ VN vẫn là NGÀY HÔM NAY, không lùi một ngày (TC-hrm-208)', () => {
  // 02:00 giờ VN ngày 15/06/2026  ==  19:00 UTC ngày 14/06/2026.
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-14T19:00:00Z') });
  try {
    assert.equal(homNayVN().toISOString(), '2026-06-15T00:00:00.000Z');
    // Đây là cách làm SAI trước đây (`setUTCHours(0)`) — giữ lại để thấy nó lệch đúng một ngày.
    const sai = new Date();
    sai.setUTCHours(0, 0, 0, 0);
    assert.equal(sai.toISOString(), '2026-06-14T00:00:00.000Z');
  } finally {
    mock.timers.reset();
  }
});

test('homNayVN: 23:00 giờ VN vẫn là ngày hôm đó (biên trên)', () => {
  // 23:00 giờ VN ngày 15/06/2026 == 16:00 UTC cùng ngày.
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-15T16:00:00Z') });
  try {
    assert.equal(homNayVN().toISOString(), '2026-06-15T00:00:00.000Z');
  } finally {
    mock.timers.reset();
  }
});

/* ============ Validator: ngày — BR-hrm-026, E-hrm-019 ============ */

test('hopDongBodySchema: hợp đồng đúng MỘT NGÀY là hợp lệ (TC-hrm-201)', () => {
  const r = hopDongBodySchema.safeParse({
    ...HD_HOP_LE,
    ngay_bat_dau: '2026-05-01',
    ngay_ket_thuc: '2026-05-01',
  });
  assert.equal(
    r.success,
    true,
    JSON.stringify(r.success ? {} : r.error.flatten()),
  );
});

test('hopDongBodySchema: ngày kết thúc TRƯỚC ngày bắt đầu -> 400, wording mới', () => {
  const r = hopDongBodySchema.safeParse({
    ...HD_HOP_LE,
    ngay_bat_dau: '2026-05-02',
    ngay_ket_thuc: '2026-05-01',
  });
  assert.equal(r.success, false);
  assert.deepEqual(
    r.success ? [] : r.error.flatten().fieldErrors.ngay_ket_thuc,
    ['Ngày kết thúc không được trước ngày bắt đầu'],
  );
});

/* ============ Validator: ràng buộc lương — QĐ #5, E-hrm-056/057 ============ */

test('hopDongBodySchema: lương chính bằng 0 -> 400 ở đúng ô (TC-hrm-196)', () => {
  const r = hopDongBodySchema.safeParse({ ...HD_HOP_LE, luong_chinh: 0 });
  assert.equal(r.success, false);
  assert.deepEqual(r.success ? [] : r.error.flatten().fieldErrors.luong_chinh, [
    'Lương chính phải lớn hơn 0.',
  ]);
});

test('hopDongBodySchema: KHÔNG gửi lương chính cũng bị chặn (TC-hrm-197)', () => {
  // Trường có `.default(0)` nên "không gửi" và "gửi 0" là cùng một thứ — cả hai phải chặn.
  const { luong_chinh: _bo, ...thieuLuong } = HD_HOP_LE;
  const r = hopDongBodySchema.safeParse(thieuLuong);
  assert.equal(r.success, false);
  assert.deepEqual(r.success ? [] : r.error.flatten().fieldErrors.luong_chinh, [
    'Lương chính phải lớn hơn 0.',
  ]);
});

test('hopDongBodySchema: bật trích BHXH mà lương BHXH = 0 -> 400 (TC-hrm-198)', () => {
  const r = hopDongBodySchema.safeParse({
    ...HD_HOP_LE,
    trich_bhxh: true,
    luong_bhxh: 0,
  });
  assert.equal(r.success, false);
  const loi = r.success ? [] : r.error.flatten().fieldErrors.luong_bhxh;
  assert.equal(loi?.length, 1);
  assert.match(
    String(loi?.[0]),
    /^Đã bật trích BHXH nên lương đóng BHXH phải lớn hơn 0\./,
  );
});

test('hopDongBodySchema: TẮT trích BHXH thì lương BHXH để trống là hợp lệ (TC-hrm-199)', () => {
  const r = hopDongBodySchema.safeParse({
    ...HD_HOP_LE,
    trich_bhxh: false,
    luong_bhxh: 0,
  });
  assert.equal(
    r.success,
    true,
    JSON.stringify(r.success ? {} : r.error.flatten()),
  );
});

test('hopDongUpdateSchema: ràng buộc lương áp cả ở đường SỬA', () => {
  const { ma_nv: _bo, ...than } = HD_HOP_LE;
  assert.equal(
    hopDongUpdateSchema.safeParse({ ...than, luong_chinh: 0 }).success,
    false,
  );
});

test('doiHopDongBodySchema: ràng buộc lương áp cả ở đường ĐỔI hợp đồng', () => {
  assert.equal(
    doiHopDongBodySchema.safeParse({
      ...HD_HOP_LE,
      loai_hd_can_chot: 'khoan',
      luong_chinh: 0,
    }).success,
    false,
  );
});

/* ============ Validator: `loai_hd_can_chot` — QĐ #1, BR-hrm-053 ============ */

test('doiHopDongBodySchema: THIẾU loai_hd_can_chot -> 400 (TC-hrm-206)', () => {
  const r = doiHopDongBodySchema.safeParse(HD_HOP_LE);
  assert.equal(r.success, false);
  assert.equal(
    (r.success ? {} : r.error.flatten().fieldErrors).loai_hd_can_chot?.length,
    1,
  );
});

test('doiHopDongBodySchema: có loai_hd_can_chot thì qua, và được cắt khoảng trắng', () => {
  const r = doiHopDongBodySchema.safeParse({
    ...HD_HOP_LE,
    ngay_bat_dau: '2026-07-01',
    ngay_chot: '2026-06-30',
    loai_hd_can_chot: '  khoan ',
  });
  assert.equal(
    r.success,
    true,
    JSON.stringify(r.success ? {} : r.error.flatten()),
  );
  assert.equal(r.success && r.data.loai_hd_can_chot, 'khoan');
});

/* ============ Validator: `ma_nv` bắt buộc ở GET /hop-dong — QĐ #8 ============ */

test('hopDongListQuerySchema: thiếu ma_nv -> 400 (TC-hrm-214, đóng BUG-HRM-25)', () => {
  assert.equal(hopDongListQuerySchema.safeParse({}).success, false);
  assert.equal(hopDongListQuerySchema.safeParse({ ma_nv: '' }).success, false);
  assert.equal(
    hopDongListQuerySchema.safeParse({ ma_nv: '   ' }).success,
    false,
  );
});

test('hopDongListQuerySchema: có ma_nv thì in hoa cho khớp cách ghi', () => {
  const r = hopDongListQuerySchema.parse({ ma_nv: ' nv0001 ' });
  assert.equal(r.ma_nv, 'NV0001');
});

/* ============ Validator: `status` bắt buộc khi sửa nhân viên — BR-hrm-067 ============ */

const NV_SUA = {
  ho_ten: 'Nguyễn Văn A',
  ngay_vao_lam: '2022-01-10',
  mien_cham_cong: false,
  cong_doan: true,
};

test('nhanVienUpdateSchema: THIẾU status -> 400 (TC-hrm-255, bịt BUG-HRM-26)', () => {
  // Trước đây trường này kế thừa mặc định '1', nên yêu cầu sửa thiếu status âm thầm đưa người
  // đã nghỉ trở lại đang làm, trong khi hợp đồng đã chốt vẫn nằm nguyên.
  const r = nhanVienUpdateSchema.safeParse(NV_SUA);
  assert.equal(r.success, false);
  assert.equal(
    (r.success ? {} : r.error.flatten().fieldErrors).status?.length,
    1,
  );
});

test('nhanVienUpdateSchema: có status thì qua, giữ đúng giá trị gửi lên', () => {
  const r = nhanVienUpdateSchema.safeParse({ ...NV_SUA, status: '0' });
  assert.equal(
    r.success,
    true,
    JSON.stringify(r.success ? {} : r.error.flatten()),
  );
  assert.equal(r.success && r.data.status, '0');
});

test('nhanVienUpdateSchema: status rác -> 400, không im lặng quy về mặc định', () => {
  assert.equal(
    nhanVienUpdateSchema.safeParse({ ...NV_SUA, status: '2' }).success,
    false,
  );
});
