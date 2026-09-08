import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kyGiamTruGiaoNhau,
  kyGiamTruTheoThang,
} from '../services/client/hrm/du_lieu_ca_nhan/nguoiPhuThuoc.service';
import {
  boTruongLuongKhiGhi,
  cheTruongLuong,
} from '../services/client/hrm/du_lieu_ca_nhan/nhanVien.service';
import {
  doiLoiRangBuocHrm,
  RANG_BUOC,
} from '../utils/du_lieu_ca_nhan/rangBuocDb';
import { ConflictError } from '../helpers/errors';
import { setEmployeeAccessSchema } from '../validators/company.validator';
import {
  sqlKhoangHopDong,
  sqlKyNptTuDinhDanh,
  sqlNhomHd,
} from '../services/shared/hrmTenantConstraints';
import { loaiHdVeNhanVien } from '../services/client/hrm/du_lieu_ca_nhan/hopDong.service';

/**
 * npx tsx --test src/__tests__/hrmQuyenVaNpt.test.ts
 *
 * Ba luật thuần còn lại của đợt P0:
 *   - kỳ giảm trừ người phụ thuộc (QĐ #7 + #19, BR-hrm-030) — 6B.11;
 *   - che trường lương theo quyền (QĐ #8, BR-hrm-059) — 6B.5;
 *   - bắt lỗi ràng buộc DB theo TÊN, không theo `error.code` (M-01, M-09).
 *
 * Phần cần DB thật (để Phase B): truy vấn của `assertKhongTrungMst`, ghi theo cặp khóa của
 * `setEmployeeAccess`, và mã SQLSTATE `23P01` thật khi vi phạm `EXCLUDE USING gist`.
 */

/* ============ Kỳ giảm trừ — BR-hrm-030, QĐ #19 ============ */

const ky = (
  tuThang: number | null,
  tuNam: number | null,
  denThang: number | null,
  denNam: number | null,
) => ({
  dk_tu_thang: tuThang,
  dk_tu_nam: tuNam,
  dk_den_thang: denThang,
  dk_den_nam: denNam,
});

test('kyGiamTruTheoThang: thiếu NĂM bắt đầu -> vô cực âm; thiếu NĂM kết thúc -> vô cực dương', () => {
  // Quy ước phải khớp hàm `hrm_ky_npt` ở tầng DB: nhánh CASE bám vào cột NĂM, không phải THÁNG.
  const k = kyGiamTruTheoThang(ky(null, null, null, null));
  assert.equal(k.tu, Number.NEGATIVE_INFINITY);
  assert.equal(k.den, Number.POSITIVE_INFINITY);
});

test('kyGiamTruTheoThang: có năm mà thiếu tháng -> tháng 1 (đầu kỳ) / tháng 12 (cuối kỳ)', () => {
  const k = kyGiamTruTheoThang(ky(null, 2026, null, 2026));
  assert.equal(k.tu, 2026 * 12 + 1);
  assert.equal(k.den, 2026 * 12 + 12);
});

test('kyGiamTruGiaoNhau: kỳ GIAO NHAU -> chặn (TC-hrm-246)', () => {
  // A: 01/2026-12/2026 ; B: 06/2026-12/2026
  assert.equal(
    kyGiamTruGiaoNhau(ky(1, 2026, 12, 2026), ky(6, 2026, 12, 2026)),
    true,
  );
});

test('kyGiamTruGiaoNhau: kỳ NỐI TIẾP (hết T6 / từ T7) -> hợp lệ (TC-hrm-246a)', () => {
  // Ca chuyển người kê khai giữa năm mà QĐ #19 mở ra — chặn phẳng theo mã số thuế là chặn oan.
  assert.equal(
    kyGiamTruGiaoNhau(ky(1, 2026, 6, 2026), ky(7, 2026, 12, 2026)),
    false,
  );
});

test('kyGiamTruGiaoNhau: chạm nhau ĐÚNG MỘT THÁNG vẫn là giao nhau (TC-hrm-246b)', () => {
  // Trong tháng 6 cả hai người nộp thuế đều được giảm trừ -> khoảng đóng cả hai đầu.
  assert.equal(
    kyGiamTruGiaoNhau(ky(1, 2026, 6, 2026), ky(6, 2026, 12, 2026)),
    true,
  );
});

test('kyGiamTruGiaoNhau: kỳ cũ BỎ TRỐNG ngày kết thúc thì kéo tới vô hạn -> vẫn chặn (TC-hrm-250)', () => {
  assert.equal(
    kyGiamTruGiaoNhau(ky(1, 2026, null, null), ky(7, 2026, 12, 2026)),
    true,
  );
});

test('kyGiamTruGiaoNhau: kỳ nối tiếp qua NĂM (hết 12/2026 / từ 01/2027) -> hợp lệ', () => {
  assert.equal(
    kyGiamTruGiaoNhau(ky(1, 2026, 12, 2026), ky(1, 2027, 12, 2027)),
    false,
  );
});

test('kyGiamTruGiaoNhau: đối xứng — đổi thứ tự hai kỳ cho cùng kết quả', () => {
  const a = ky(1, 2026, 6, 2026);
  const b = ky(6, 2026, 12, 2026);
  assert.equal(kyGiamTruGiaoNhau(a, b), kyGiamTruGiaoNhau(b, a));
});

/* ============ Che trường lương — BR-hrm-059, FR-hrm-042 ============ */

const NV = {
  ma_nv: 'NV0001',
  ho_ten: 'Nguyễn Văn A',
  so_tai_khoan: '19034567890123',
  ten_tai_khoan: 'NGUYEN VAN A',
  ngan_hang: 'Techcombank',
};

test('cheTruongLuong: KHÔNG có quyền -> ba khóa VẮNG MẶT, không phải null (TC-hrm-212)', () => {
  const ra = cheTruongLuong(NV, false) as Record<string, unknown>;
  for (const k of ['so_tai_khoan', 'ten_tai_khoan', 'ngan_hang']) {
    assert.equal(k in ra, false, `khóa "${k}" phải vắng mặt hẳn`);
  }
  // Trả `null` là nói dối: giao diện không phân biệt được "chưa khai" với "không được xem".
  assert.equal(ra.ma_nv, 'NV0001');
  assert.equal(ra.ho_ten, 'Nguyễn Văn A');
});

test('cheTruongLuong: CÓ quyền -> giữ nguyên đủ trường (TC-hrm-213)', () => {
  assert.deepEqual(cheTruongLuong(NV, true), NV);
});

test('cheTruongLuong: không sửa đối tượng gốc', () => {
  const goc = { ...NV };
  cheTruongLuong(goc, false);
  assert.equal(goc.so_tai_khoan, '19034567890123');
});

test('boTruongLuongKhiGhi: không có quyền -> BỎ QUA ba trường, giữ nguyên giá trị cũ', () => {
  // KHÔNG được nhận `null` rồi ghi đè: người không có quyền đọc thì màn hình của họ không có
  // sẵn ba giá trị cũ để gửi lại, nhận nguyên payload là xóa trắng số tài khoản của nhân viên.
  const body = {
    ho_ten: 'B',
    so_tai_khoan: null,
    ten_tai_khoan: null,
    ngan_hang: null,
  };
  const ra = boTruongLuongKhiGhi(body, false) as Record<string, unknown>;
  assert.deepEqual(Object.keys(ra), ['ho_ten']);
});

test('boTruongLuongKhiGhi: có quyền -> ghi đủ, kể cả khi xóa trắng có chủ đích', () => {
  const body = {
    ho_ten: 'B',
    so_tai_khoan: null,
    ten_tai_khoan: null,
    ngan_hang: null,
  };
  assert.deepEqual(boTruongLuongKhiGhi(body, true), body);
});

/* ============ Bắt lỗi ràng buộc DB theo TÊN — M-01, M-09, ADR-002 ============ */

/** Dựng lỗi giống hình dạng Prisma trả về khi Postgres vi phạm `EXCLUDE USING gist`. */
function loiExclusion(tenRangBuoc: string): Error {
  const err = new Error(
    `Invalid \`prisma.hrm_hop_dong.create()\` invocation:\n` +
      `conflicting key value violates exclusion constraint "${tenRangBuoc}"`,
  );
  // SQLSTATE 23P01 nằm sâu trong meta; Prisma KHÔNG map nó thành P2002/P2003.
  (err as unknown as Record<string, unknown>).meta = { code: '23P01' };
  return err;
}

test('doiLoiRangBuocHrm: nhận ra chồng lấn hợp đồng theo TÊN ràng buộc (TC-hrm-210)', () => {
  const ra = doiLoiRangBuocHrm(loiExclusion(RANG_BUOC.HOP_DONG_CHONG_LAN));
  assert.ok(ra instanceof ConflictError);
  assert.match((ra as ConflictError).message, /chồng lấn/);
});

test('doiLoiRangBuocHrm: nhận ra trùng kỳ mã số thuế người phụ thuộc', () => {
  const ra = doiLoiRangBuocHrm(loiExclusion(RANG_BUOC.NPT_MST_TRUNG_KY));
  assert.ok(ra instanceof ConflictError);
  assert.match((ra as ConflictError).message, /giảm trừ gia cảnh/);
});

test('doiLoiRangBuocHrm: nhận ra trùng số hợp đồng', () => {
  const ra = doiLoiRangBuocHrm(loiExclusion(RANG_BUOC.HOP_DONG_SO_HD));
  assert.ok(ra instanceof ConflictError);
  assert.match((ra as ConflictError).message, /Số hợp đồng/);
});

test('doiLoiRangBuocHrm: tên ràng buộc chỉ nằm trong `meta` vẫn bắt được', () => {
  const err = new Error('Raw query failed');
  (err as unknown as Record<string, unknown>).meta = {
    code: '23P01',
    message: `constraint "${RANG_BUOC.HOP_DONG_CHONG_LAN}"`,
  };
  assert.ok(doiLoiRangBuocHrm(err) instanceof ConflictError);
});

test('doiLoiRangBuocHrm: lỗi KHÔNG liên quan trả nguyên trạng, không nuốt', () => {
  const goc = new Error('mất kết nối cơ sở dữ liệu');
  assert.equal(doiLoiRangBuocHrm(goc), goc);
  assert.equal(doiLoiRangBuocHrm('không phải Error'), 'không phải Error');
});

/* ============ Thân yêu cầu phân quyền — QĐ #17, FR-hrm-044, BUG-HRM-28 ============ */

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

test('setEmployeeAccessSchema: dạng đầy đủ giữ nguyên cờ quyền lương từng công ty', () => {
  const r = setEmployeeAccessSchema.parse({
    access: [
      { donViId: ID_A, xemLuong: true },
      { donViId: ID_B, xemLuong: false },
    ],
  });
  assert.deepEqual(r.access, [
    { donViId: ID_A, xemLuong: true },
    { donViId: ID_B, xemLuong: false },
  ]);
});

test('setEmployeeAccessSchema: dạng cũ (chỉ donViIds) -> xemLuong KHÔNG xác định (TC-hrm-258)', () => {
  // `undefined` phải mang nghĩa GIỮ NGUYÊN cờ đang có, khác hẳn `false` = thu hồi. Quy về
  // `false` ở đây là mỗi lần chủ tài khoản sửa danh sách công ty lại thu hồi sạch quyền lương.
  const r = setEmployeeAccessSchema.parse({ donViIds: [ID_A, ID_B] });
  assert.deepEqual(r.access, [{ donViId: ID_A }, { donViId: ID_B }]);
  const co = r.access as { donViId: string; xemLuong?: boolean }[];
  assert.equal(
    co.every((a) => a.xemLuong === undefined),
    true,
  );
});

test('setEmployeeAccessSchema: danh sách rỗng là hợp lệ (thu hồi hết)', () => {
  assert.deepEqual(setEmployeeAccessSchema.parse({ donViIds: [] }).access, []);
  assert.deepEqual(setEmployeeAccessSchema.parse({ access: [] }).access, []);
});

test('setEmployeeAccessSchema: không gửi gì cả -> 400, không im lặng thu hồi hết', () => {
  assert.equal(setEmployeeAccessSchema.safeParse({}).success, false);
});

test('setEmployeeAccessSchema: donViId không phải uuid -> 400', () => {
  assert.equal(
    setEmployeeAccessSchema.safeParse({ access: [{ donViId: 'abc' }] }).success,
    false,
  );
});

/* ============ Hai tầng phải nói CÙNG một luật — chống trôi SQL ↔ TypeScript ============ */

/**
 * Không chạy được SQL ở đây (không có Postgres trong bộ test đơn vị), nên phần kiểm được là
 * HÌNH DẠNG câu lệnh. Mục đích duy nhất: bắt lúc ai đó sửa luật ở một tầng mà quên tầng kia —
 * đúng thứ đã sinh ra BUG-HRM-27. Kiểm hành vi thật của ràng buộc là việc của Phase B.
 */

test('SQL hrm_nhom_hd: đủ ba nhánh và có hạ chữ thường, khớp loaiHdVeNhanVien', () => {
  const sql = sqlNhomHd('loai');
  assert.match(sql, /lower\(btrim\(loai\)\)/);
  for (const [nhan, nhom] of [
    ['thu_viec', 'thu_viec'],
    ['khoan', 'hdvc'],
  ] as const) {
    assert.equal(loaiHdVeNhanVien(nhan), nhom);
    assert.match(sql, new RegExp(`WHEN '${nhan}'\\s+THEN '${nhom}'`));
  }
  assert.match(sql, /ELSE 'hdld'/);
  assert.equal(loaiHdVeNhanVien('nhan-la'), 'hdld');
});

test('SQL khoảng hợp đồng: ĐÓNG hai đầu và coi ngày kết thúc rỗng là vô hạn', () => {
  const sql = sqlKhoangHopDong('');
  assert.match(sql, /'\[\]'/); // '[]' — đổi sang '[)' là hợp đồng một ngày lọt lưới
  assert.match(sql, /COALESCE\(ngay_ket_thuc, 'infinity'::date\)/);
});

test('SQL hrm_ky_npt: nửa mở ở tầng ngày, mặc định tháng 1 / tháng 12 như bản TypeScript', () => {
  const sql = sqlKyNptTuDinhDanh('tu_thang', 'tu_nam', 'den_thang', 'den_nam');
  assert.match(sql, /'\[\)'/);
  assert.match(sql, /COALESCE\(tu_thang, 1\)/);
  assert.match(sql, /COALESCE\(den_thang, 12\)/);
  // Nhánh CASE bám vào cột NĂM — cùng quy ước với `kyGiamTruTheoThang`.
  assert.match(sql, /CASE WHEN tu_nam IS NULL THEN '-infinity'::date/);
  assert.match(sql, /CASE WHEN den_nam IS NULL THEN 'infinity'::date/);
  const k = kyGiamTruTheoThang({
    dk_tu_thang: null,
    dk_tu_nam: 2026,
    dk_den_thang: null,
    dk_den_nam: 2026,
  });
  assert.equal(k.tu, 2026 * 12 + 1);
  assert.equal(k.den, 2026 * 12 + 12);
});
