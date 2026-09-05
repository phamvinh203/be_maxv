import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  tinhKetThuc,
  mocGiaHan,
  hanMoiKhiDoiGoi,
} from '../services/shared/subscription.service';
import { goiConHieuLuc } from '../services/shared/modules.service';

/**
 * Quy tắc tính HẠN của thuê bao — hàm thuần, không đụng DB.
 *
 *   npx tsx --test src/__tests__/hanThueBao.test.ts
 *
 * Đây là chỗ từng có HAI quy tắc song song (đăng ký lấy `env.trialDays` 30 ngày cứng, admin
 * đổi gói lấy `chuKyThang` của gói), khiến cùng một gói "Miễn phí" mà tài khoản tự đăng ký
 * chết sau 30 ngày còn tài khoản admin đổi tay thì sống theo chu kỳ gói. Test giữ cho hai
 * đường đó không tách ra lần nữa.
 */

const MOC = new Date('2026-09-04T00:00:00.000Z');

test('chuKyThang > 0 -> cộng đúng số tháng', () => {
  const kq = tinhKetThuc(12, MOC);
  assert.equal(kq?.toISOString().slice(0, 10), '2027-09-04');
  assert.equal(tinhKetThuc(1, MOC)?.toISOString().slice(0, 10), '2026-10-04');
  assert.equal(tinhKetThuc(3, MOC)?.toISOString().slice(0, 10), '2026-12-04');
});

test('chuKyThang = 0 nghĩa là KHÔNG hết hạn -> null', () => {
  // `null` là cách duy nhất khai "dùng vĩnh viễn": `goiConHieuLuc` bỏ qua phép so ngày.
  assert.equal(tinhKetThuc(0, MOC), null);
});

test('cộng tháng không trôi sang tháng sai ở ngày cuối tháng', () => {
  // 31/01 + 1 tháng: JS cuộn sang 03/03 vì tháng 2 không có ngày 31. Ghi nhận hành vi THẬT
  // để ai đổi cách tính sau này biết mình đang đổi cái gì, thay vì tưởng nó ra 28/02.
  const cuoiThang = new Date('2026-01-31T00:00:00.000Z');
  assert.equal(addMonths(cuoiThang, 1).toISOString().slice(0, 10), '2026-03-03');
});

test('gia hạn khi CÒN hạn thì nối vào ketThuc cũ, không ăn mất ngày còn lại', () => {
  const conHan = new Date('2026-12-31T00:00:00.000Z');
  assert.equal(mocGiaHan(conHan, MOC).toISOString(), conHan.toISOString());
  // 12 tháng cộng từ 31/12/2026 chứ không phải từ hôm nay.
  assert.equal(
    tinhKetThuc(12, mocGiaHan(conHan, MOC))?.toISOString().slice(0, 10),
    '2027-12-31',
  );
});

test('gia hạn khi ĐÃ quá hạn thì tính từ bây giờ, không tặng không quãng đã mất', () => {
  const quaHan = new Date('2026-07-27T00:00:00.000Z');
  assert.equal(mocGiaHan(quaHan, MOC).toISOString(), MOC.toISOString());
  assert.equal(
    tinhKetThuc(12, mocGiaHan(quaHan, MOC))?.toISOString().slice(0, 10),
    '2027-09-04',
  );
});

test('gia hạn thuê bao chưa có hạn thì lấy mốc bây giờ', () => {
  assert.equal(mocGiaHan(null, MOC).toISOString(), MOC.toISOString());
});

/* ===== Nối với goiConHieuLuc: hạn tính ra phải thực sự mở lại được module ===== */

function goi(status: 'TRIALING' | 'ACTIVE' | 'CANCELED', ketThuc: Date | null) {
  return { status, ketThuc, plan: { features: { tokhai: true } } };
}

test('thuê bao hết hạn -> mất hiệu lực; gia hạn xong -> có lại', () => {
  const hetHan = new Date('2026-07-27T00:00:00.000Z');
  assert.equal(goiConHieuLuc(goi('TRIALING', hetHan), MOC), false);

  const sauGiaHan = tinhKetThuc(12, mocGiaHan(hetHan, MOC));
  assert.equal(goiConHieuLuc(goi('ACTIVE', sauGiaHan), MOC), true);
});

test('gói không hết hạn (ketThuc null) luôn còn hiệu lực', () => {
  assert.equal(goiConHieuLuc(goi('ACTIVE', tinhKetThuc(0, MOC)), MOC), true);
});

test('trạng thái đã hủy thì hạn còn dài cũng không cấp module', () => {
  assert.equal(goiConHieuLuc(goi('CANCELED', tinhKetThuc(12, MOC)), MOC), false);
});

/* ===== Admin sửa chuKyThang của gói -> áp lại hạn cho thuê bao đang dùng ===== */

const DANG_KY = new Date('2026-06-27T00:00:00.000Z');

test('kéo dài chu kỳ -> dời hạn tính từ ngày đăng ký', () => {
  // Đúng ca thật: 6 tài khoản TRIAL đăng ký 27/06, hạn cũ 27/07 (30 ngày), gói đổi thành 12 tháng.
  const kq = hanMoiKhiDoiGoi(
    { batDau: DANG_KY, ketThuc: new Date('2026-07-27T00:00:00.000Z') },
    12,
  );
  assert.equal(kq?.ketThuc?.toISOString().slice(0, 10), '2027-06-27');
});

test('KHÔNG rút ngắn hạn của khách đã gia hạn nhiều lần', () => {
  // Gói chu kỳ 1 tháng, khách đã gia hạn tới tận tháng 11. `batDau + 1 tháng` = 27/07 là NGẮN
  // hơn -> phải để yên, không được xén mất mấy tháng khách đã trả tiền.
  const kq = hanMoiKhiDoiGoi(
    { batDau: DANG_KY, ketThuc: new Date('2026-11-27T00:00:00.000Z') },
    1,
  );
  assert.equal(kq, null);
});

test('hạn mới bằng đúng hạn cũ thì không ghi lại', () => {
  const kq = hanMoiKhiDoiGoi(
    { batDau: DANG_KY, ketThuc: new Date('2027-06-27T00:00:00.000Z') },
    12,
  );
  assert.equal(kq, null);
});

test('chuKyThang = 0 -> mọi thuê bao thành không hết hạn', () => {
  const kq = hanMoiKhiDoiGoi(
    { batDau: DANG_KY, ketThuc: new Date('2026-07-27T00:00:00.000Z') },
    0,
  );
  assert.notEqual(kq, null);
  assert.equal(kq?.ketThuc, null);
});

test('thuê bao vốn đã vĩnh viễn thì gói bỏ hạn cũng không ghi lại', () => {
  assert.equal(hanMoiKhiDoiGoi({ batDau: DANG_KY, ketThuc: null }, 0), null);
});

test('thuê bao vĩnh viễn mà gói có chu kỳ -> đặt hạn vào là rút ngắn, để yên', () => {
  assert.equal(hanMoiKhiDoiGoi({ batDau: DANG_KY, ketThuc: null }, 12), null);
});

test('hai cái null không lẫn nhau: "để yên" khác "vĩnh viễn"', () => {
  // Đây là lý do hàm trả `{ ketThuc } | null` thay vì `Date | null`.
  const deYen = hanMoiKhiDoiGoi({ batDau: DANG_KY, ketThuc: null }, 12);
  const vinhVien = hanMoiKhiDoiGoi(
    { batDau: DANG_KY, ketThuc: new Date('2026-07-27T00:00:00.000Z') },
    0,
  );
  assert.equal(deYen, null);
  assert.deepEqual(vinhVien, { ketThuc: null });
});

test('dời hạn xong thì thuê bao hết hạn có lại module', () => {
  const cu = { batDau: DANG_KY, ketThuc: new Date('2026-07-27T00:00:00.000Z') };
  assert.equal(goiConHieuLuc(goi('TRIALING', cu.ketThuc), MOC), false);
  const moi = hanMoiKhiDoiGoi(cu, 12);
  assert.equal(goiConHieuLuc(goi('TRIALING', moi?.ketThuc ?? null), MOC), true);
});
