import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sapXepTheoCay,
  taoTapConChau,
} from '../services/client/hrm/phongBanCay';

/**
 * Khóa hai bất biến của cây phòng ban:
 *  - MỌI dòng đọc từ dmpb đều phải xuất hiện đúng 1 lần ở kết quả, kể cả dữ liệu hỏng
 *    (cha đã bị xóa, hoặc chu trình do sửa tay trong DB);
 *  - không có nhánh nào làm hàm chạy vô hạn.
 * Mất một trong hai là phòng ban "biến mất" khỏi giao diện hoặc request treo.
 *
 *   npx tsx --test src/__tests__/hrmPhongBanCay.test.ts
 */

const pb = (ma_pb: string, ma_pb_me: string | null = null) => ({ ma_pb, ma_pb_me });

test('sapXepTheoCay: gốc là cấp 1, con là cấp 2, cha đứng ngay trước con', () => {
  const kq = sapXepTheoCay([
    pb('PB02'),
    pb('PB01.01', 'PB01'),
    pb('PB01'),
  ]);

  assert.deepEqual(
    kq.map((r) => [r.ma_pb, r.cap]),
    [
      ['PB01', 1],
      ['PB01.01', 2],
      ['PB02', 1],
    ],
  );
});

test('sapXepTheoCay: cấp tăng đúng ở độ sâu 3', () => {
  const kq = sapXepTheoCay([
    pb('PB01'),
    pb('PB01.01', 'PB01'),
    pb('PB01.01.01', 'PB01.01'),
  ]);

  assert.deepEqual(kq.map((r) => r.cap), [1, 2, 3]);
});

test('sapXepTheoCay: anh em cùng cha sắp theo mã tăng dần', () => {
  const kq = sapXepTheoCay([
    pb('PB01.03', 'PB01'),
    pb('PB01.01', 'PB01'),
    pb('PB01.02', 'PB01'),
    pb('PB01'),
  ]);

  assert.deepEqual(kq.map((r) => r.ma_pb), [
    'PB01',
    'PB01.01',
    'PB01.02',
    'PB01.03',
  ]);
});

test('sapXepTheoCay: node mồ côi (cha đã bị xóa) được coi là gốc, không biến mất', () => {
  // PB09 trỏ tới PB07 không còn trong bảng — nếu lọc theo "ma_pb_me == null" thì nó mất tăm.
  const kq = sapXepTheoCay([pb('PB01'), pb('PB09', 'PB07')]);

  assert.deepEqual(
    kq.map((r) => [r.ma_pb, r.cap]),
    [
      ['PB01', 1],
      ['PB09', 1],
    ],
  );
});

test('sapXepTheoCay: chu trình không gây lặp vô hạn và không mất dòng nào', () => {
  // A -> B -> A: không node nào tới được từ gốc.
  const kq = sapXepTheoCay([pb('PBA', 'PBB'), pb('PBB', 'PBA'), pb('PB01')]);

  assert.equal(kq.length, 3);
  assert.deepEqual([...new Set(kq.map((r) => r.ma_pb))].sort(), [
    'PB01',
    'PBA',
    'PBB',
  ]);
});

test('sapXepTheoCay: giữ nguyên các trường khác của dòng', () => {
  const kq = sapXepTheoCay([
    { ma_pb: 'PB01', ma_pb_me: null, ten_pb: 'Kế toán' },
  ]);

  assert.equal(kq[0].ten_pb, 'Kế toán');
  assert.equal(kq[0].cap, 1);
});

test('sapXepTheoCay: danh sách rỗng trả mảng rỗng', () => {
  assert.deepEqual(sapXepTheoCay([]), []);
});

test('taoTapConChau: gồm chính nó và toàn bộ con cháu', () => {
  const rows = [
    pb('PB01'),
    pb('PB01.01', 'PB01'),
    pb('PB01.01.01', 'PB01.01'),
    pb('PB02'),
  ];

  assert.deepEqual([...taoTapConChau(rows, 'PB01')].sort(), [
    'PB01',
    'PB01.01',
    'PB01.01.01',
  ]);
});

test('taoTapConChau: lá chỉ gồm chính nó', () => {
  const rows = [pb('PB01'), pb('PB01.01', 'PB01')];

  assert.deepEqual([...taoTapConChau(rows, 'PB01.01')], ['PB01.01']);
});

test('taoTapConChau: dừng được khi dữ liệu có chu trình', () => {
  const rows = [pb('PBA', 'PBB'), pb('PBB', 'PBA')];

  assert.deepEqual([...taoTapConChau(rows, 'PBA')].sort(), ['PBA', 'PBB']);
});
