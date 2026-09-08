import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SO_FILE_TOI_DA,
  assertConChoChoFile,
  thuTuKeTiep,
  timFileCuaTaiLieu,
} from '../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service';
import { ConflictError, NotFoundError } from '../helpers/errors';
import { MESSAGES } from '../constants/messages';
import { taiLieuFileParamSchema } from '../validators/hrm/du_lieu_ca_nhan/taiLieu.validator';

/**
 * npx tsx --test src/__tests__/hrmTaiLieuFile.test.ts
 *
 * Ba luật thuần của QĐ #21 — "một dòng giấy tờ giữ NHIỀU file scan" (BR-hrm-037/038/039):
 *   - `thu_tu` của file kế tiếp;
 *   - trần 20 file mỗi dòng (E-hrm-065);
 *   - file phải THUỘC ĐÚNG dòng giấy tờ đang thao tác (E-hrm-066) — đây là ranh giới an ninh.
 *
 * Cả ba chạy được không cần Postgres lẫn Google. Phần cần DB thật (để Phase B): thứ tự đọc
 * `orderBy [thu_tu, datetime0]`, cascade khi xóa dòng cha, và bước dọn Drive cố-hết-sức của
 * `deleteTaiLieu`.
 */

/* ═════════════ `thu_tu` kế tiếp — BR-hrm-037 ═════════════ */

test('thuTuKeTiep: dòng chưa có file nào -> 0', () => {
  assert.equal(thuTuKeTiep([]), 0);
});

test('thuTuKeTiep: lấy LỚN NHẤT + 1, không phải số lượng phần tử', () => {
  // Ca thật sự quan trọng: gỡ file ở giữa rồi thêm file mới. Dùng `files.length` ở đây sẽ ra 2,
  // trùng `thu_tu` của file đang còn -> hai file đảo chỗ nhau giữa các lần đọc.
  assert.equal(thuTuKeTiep([{ thu_tu: 0 }, { thu_tu: 2 }]), 3);
});

test('thuTuKeTiep: danh sách chưa sắp thứ tự vẫn ra đúng', () => {
  assert.equal(thuTuKeTiep([{ thu_tu: 5 }, { thu_tu: 1 }, { thu_tu: 3 }]), 6);
});

test('thuTuKeTiep: dữ liệu cũ chuyển sang đều mang thu_tu = 0 -> file kế tiếp là 1', () => {
  // Script `hrm:chuyen-file` đặt `thu_tu = 0` cho mọi dòng chuyển từ bốn cột cũ.
  assert.equal(thuTuKeTiep([{ thu_tu: 0 }]), 1);
});

test('thuTuKeTiep: thu_tu âm (dữ liệu bẩn) không kéo kết quả xuống dưới 0', () => {
  assert.equal(thuTuKeTiep([{ thu_tu: -5 }]), 0);
});

/* ═════════════ Trần 20 file — E-hrm-065 (409) ═════════════ */

test('SO_FILE_TOI_DA đúng bằng 20 như BR-hrm-037 đã chốt', () => {
  assert.equal(SO_FILE_TOI_DA, 20);
});

test('assertConChoChoFile: dưới trần thì cho qua, kể cả sát trần', () => {
  assert.doesNotThrow(() => assertConChoChoFile(0));
  assert.doesNotThrow(() => assertConChoChoFile(SO_FILE_TOI_DA - 1));
});

test('assertConChoChoFile: ĐÚNG 20 file -> chặn với wording E-hrm-065', () => {
  assert.throws(
    () => assertConChoChoFile(SO_FILE_TOI_DA),
    (err: unknown) =>
      err instanceof ConflictError &&
      err.message === MESSAGES.HRM.TAI_LIEU_QUA_NHIEU_FILE,
  );
});

test('assertConChoChoFile: vượt trần (dữ liệu cũ lỡ nhiều hơn 20) vẫn chặn', () => {
  assert.throws(() => assertConChoChoFile(25), ConflictError);
});

/* ═════ File phải thuộc ĐÚNG dòng giấy tờ — E-hrm-037 / E-hrm-066 (404) ═════ */

const F = (id: string) => ({ id, drive_file_id: `drive-${id}` });

test('timFileCuaTaiLieu: id khớp -> trả đúng dòng file đó', () => {
  const files = [F('f1'), F('f2'), F('f3')];
  assert.equal(timFileCuaTaiLieu(files, 'f2'), files[1]);
});

test('timFileCuaTaiLieu: dòng CHƯA có file nào -> E-hrm-037, không phải E-hrm-066', () => {
  // Hai câu khác nhau có chủ đích: "chưa đính file" là người dùng bấm nhầm nút, khác hẳn với
  // "id không thuộc giấy tờ này".
  assert.throws(
    () => timFileCuaTaiLieu([], 'f1'),
    (err: unknown) =>
      err instanceof NotFoundError &&
      err.message === MESSAGES.HRM.TAI_LIEU_CHUA_CO_FILE,
  );
});

test('timFileCuaTaiLieu: id của giấy tờ KHÁC -> E-hrm-066, không rò rỉ file', () => {
  // Ranh giới an ninh: bỏ phép kiểm này là người có quyền vào công ty xem/gỡ được file của
  // giấy tờ bất kỳ chỉ bằng cách đoán id.
  assert.throws(
    () => timFileCuaTaiLieu([F('f1'), F('f2')], 'f-cua-giay-to-khac'),
    (err: unknown) =>
      err instanceof NotFoundError &&
      err.message === MESSAGES.HRM.TAI_LIEU_FILE_NOT_FOUND,
  );
});

test('timFileCuaTaiLieu: chuỗi rỗng cũng bị từ chối như id lạ', () => {
  assert.throws(() => timFileCuaTaiLieu([F('f1')], ''), NotFoundError);
});

test('timFileCuaTaiLieu: không so khớp lỏng — "f1 " (thừa khoảng trắng) là id khác', () => {
  assert.throws(() => timFileCuaTaiLieu([F('f1')], 'f1 '), NotFoundError);
});

/* ═════════════ Param `:id/file/:fileId` ═════════════ */

test('taiLieuFileParamSchema: nhận đủ hai tham số', () => {
  const r = taiLieuFileParamSchema.safeParse({ id: 'tl-1', fileId: 'f-1' });
  assert.equal(r.success, true);
});

test('taiLieuFileParamSchema: thiếu hoặc rỗng fileId -> 400 chứ không rơi vào service', () => {
  assert.equal(taiLieuFileParamSchema.safeParse({ id: 'tl-1' }).success, false);
  assert.equal(
    taiLieuFileParamSchema.safeParse({ id: 'tl-1', fileId: '' }).success,
    false,
  );
});
