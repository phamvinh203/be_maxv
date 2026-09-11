import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deferred, tick } from '../_helpers';
import {
  PdfRenderBusyError,
  taoHangDoiRender,
} from '../../helpers/pdfRenderer';

/**
 * Hàng đợi render PDF (`POST /gdt/render-pdf`, helpers/pdfRenderer.ts).
 *
 * Lỗ hổng vbsec 2026-09-10 [8]: chỉ giới hạn 2 render đồng thời nhưng hàng CHỜ không có trần, mỗi
 * request chờ giữ nguyên body HTML (tới 5MB) trong RAM. Một tài khoản tự đăng ký dội 300 request/phút
 * là heap phình nhiều GB -> PM2 khởi động lại -> sập backend cho mọi tenant.
 *
 * FE xuất PDF TUẦN TỰ từng tờ (exportBundle.ts) nên rate limit theo phút sẽ làm hỏng lượt xuất hợp lệ
 * hàng nghìn tờ — trần phải đặt lên SỐ LƯỢT đang chạy/chờ, không phải tốc độ.
 */

/**
 * Lượt vượt trần phải bị từ chối NGAY. Nếu nó nằm treo trong hàng đợi (chính là lỗ hổng) thì
 * `assert.rejects` sẽ chờ vô hạn — nên đo bằng hạn chờ ngắn thay vì để test treo.
 */
async function assertBiTuChoiNgay(luot: Promise<unknown>): Promise<void> {
  const TREO = Symbol('treo');
  const ketQua = await Promise.race([
    luot.then(
      () => 'thanh-cong',
      (loi: unknown) => loi,
    ),
    new Promise((resolve) => setTimeout(() => resolve(TREO), 200)),
  ]);
  assert.notEqual(
    ketQua,
    TREO,
    'lượt vượt trần đang TREO trong hàng đợi thay vì bị từ chối ngay',
  );
  assert.ok(
    ketQua instanceof PdfRenderBusyError,
    `phải là PdfRenderBusyError, nhận: ${String(ketQua)}`,
  );
}

/** Một việc render giả bị giữ ở trạng thái đang chạy tới khi test mở `xong()`. */
function viecGiu() {
  const { promise, resolve } = deferred();
  const trangThai = { daBatDau: false };
  return {
    trangThai,
    xong: resolve,
    viec: async () => {
      trangThai.daBatDau = true;
      await promise;
      return 'pdf';
    },
  };
}

test('hàng chờ đầy -> lượt mới bị từ chối NGAY (PdfRenderBusyError), không xếp thêm vào RAM', async () => {
  const chay = taoHangDoiRender({
    dongThoi: 1,
    choToiDa: 1,
    moiNguoiToiDa: 10,
  });
  const v1 = viecGiu();
  const v2 = viecGiu();

  const p1 = chay('user-a', v1.viec);
  const p2 = chay('user-b', v2.viec);
  await tick();
  assert.equal(v1.trangThai.daBatDau, true);
  assert.equal(
    v2.trangThai.daBatDau,
    false,
    'vượt số render đồng thời thì phải chờ',
  );

  await assertBiTuChoiNgay(chay('user-c', async () => 'pdf'));

  v1.xong();
  assert.equal(await p1, 'pdf');
  await tick();
  assert.equal(
    v2.trangThai.daBatDau,
    true,
    'việc đang chờ được chạy khi có slot',
  );
  v2.xong();
  assert.equal(await p2, 'pdf');
});

test('mỗi người dùng tối đa N lượt (đang chạy + đang chờ); người dùng khác không bị ảnh hưởng', async () => {
  const chay = taoHangDoiRender({
    dongThoi: 1,
    choToiDa: 10,
    moiNguoiToiDa: 2,
  });
  const v1 = viecGiu();
  const v2 = viecGiu();
  const v3 = viecGiu();

  const p1 = chay('ke-tan-cong', v1.viec);
  const p2 = chay('ke-tan-cong', v2.viec);
  await assertBiTuChoiNgay(chay('ke-tan-cong', async () => 'pdf'));

  const p3 = chay('nguoi-dung-khac', v3.viec);

  v1.xong();
  v2.xong();
  v3.xong();
  assert.deepEqual(await Promise.all([p1, p2, p3]), ['pdf', 'pdf', 'pdf']);
});

test('việc render lỗi vẫn nhả slot và lượt của người dùng (hàng đợi không kẹt vĩnh viễn)', async () => {
  const chay = taoHangDoiRender({ dongThoi: 1, choToiDa: 0, moiNguoiToiDa: 1 });

  await assert.rejects(
    chay('user-a', async () => {
      throw new Error('Chromium chết giữa chừng');
    }),
    /Chromium chết giữa chừng/,
  );

  assert.equal(await chay('user-a', async () => 'pdf'), 'pdf');
});
