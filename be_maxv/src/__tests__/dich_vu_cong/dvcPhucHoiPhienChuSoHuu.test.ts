import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/**
 * vbsec 2026-09-10 (LOW, gdt-dvc.service.ts:753): `phucHoiPhienDaMat` gắn phiên mới vào ĐÚNG `key` FE gửi
 * lên mà không xem khóa đó đang là phiên CÒN SỐNG của công ty nào. `requireSession` coi "sai chủ" như
 * "không có phiên" -> công ty B cầm được khóa của A (localStorage máy dùng chung) là kích phục hồi, ghi đè
 * phiên cổng đang đăng nhập của A. Cửa gộp lượt phục hồi và cửa phạt 5 phút cũng khóa theo `key` trần ->
 * B nhập chung lượt của A / lượt hỏng của B chặn A.
 *
 * Gọi cổng thật đi qua pacer — thay pacer bằng bản giả giữ request treo (không gọi mạng).
 */

let hetGio = false;
const dangCho: Array<(e: unknown) => void> = [];
let dvc: typeof import('../../services/client/dich_vu_cong/gdt-dvc.service');

before(async () => {
  mock.module('../../services/client/hddt/gdtPacer', {
    namedExports: {
      schedule: () =>
        new Promise((_, reject) => {
          if (hetGio) reject(new Error('cổng giả: đóng'));
          else dangCho.push(reject);
        }),
      reportOk: () => {},
      reportRateLimited: () => {},
    },
  });
  dvc = await import('../../services/client/dich_vu_cong/gdt-dvc.service');
});

after(() => {
  hetGio = true;
  for (const reject of dangCho.splice(0)) reject(new Error('cổng giả: đóng'));
});

const CRED = { tenDN: '0100000001-ql', matKhau: 'mat-khau' };

/** Kết quả của lời gọi phục hồi sau 100ms: lỗi đã ném, `'xong'`, hoặc `'dang-cho'` (còn chờ cổng). */
function ketQuaSau100ms(
  p: Promise<void> | (() => Promise<void>),
): Promise<unknown> {
  const luot = Promise.resolve().then(typeof p === 'function' ? p : () => p);
  return Promise.race([
    luot.then(
      () => 'xong',
      (e: unknown) => e,
    ),
    new Promise((r) => setTimeout(() => r('dang-cho'), 100)),
  ]);
}

test('khóa đang là phiên còn sống của công ty A: công ty B phục hồi trên khóa đó bị từ chối, không chạm cổng', async () => {
  const key = randomUUID();
  const luotA = dvc.phucHoiPhienDaMat({ key, donViId: 'dv-a' }, CRED);
  luotA.catch(() => {});
  const soLuotCongTruoc = dangCho.length;

  const kqB = await ketQuaSau100ms(() =>
    dvc.phucHoiPhienDaMat({ key, donViId: 'dv-b' }, CRED),
  );
  assert.ok(
    kqB instanceof dvc.DvcSessionExpiredError,
    `B phải bị từ chối, nhận: ${String(kqB)}`,
  );
  assert.equal(
    dangCho.length,
    soLuotCongTruoc,
    'B không được mở lượt đăng nhập lên cổng',
  );
});

test('lượt phục hồi HỎNG của công ty B không chặn công ty A phục hồi trên cùng khóa', async () => {
  const key = randomUUID();
  // B phục hồi trên khóa trống rồi hỏng (cổng từ chối) -> B bị phạt nghỉ 5 phút.
  hetGio = true;
  await assert.rejects(dvc.phucHoiPhienDaMat({ key, donViId: 'dv-b' }, CRED));
  hetGio = false;

  // A (chủ thật của khóa trên FE) vẫn phải được thử: lượt của A đi tới cổng chứ không bị trả lỗi phạt.
  const soLuotCongTruoc = dangCho.length;
  const kqA = await ketQuaSau100ms(() =>
    dvc.phucHoiPhienDaMat({ key, donViId: 'dv-a' }, CRED),
  );
  assert.equal(
    kqA,
    'dang-cho',
    `A phải được thử phục hồi, nhận: ${String(kqA)}`,
  );
  assert.ok(dangCho.length > soLuotCongTruoc);
});
