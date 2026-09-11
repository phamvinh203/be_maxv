import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteUserSchema } from '../../validators/company.validator';

/**
 * vbsec 2026-09-10 (LOW, company.validator.ts:37): lời mời nhân viên nhận `hoTen` không giới hạn độ dài,
 * cho xuống dòng — rồi nhúng nguyên văn vào email gửi TOÀN BỘ admin ("Nhân viên được mời: …"). Chủ tài
 * khoản bất kỳ chèn được cả đoạn văn tùy ý (link lừa đảo…) vào mail hệ thống. Sửa: cùng luật với
 * `registerSchema` — 1..100 ký tự, không xuống dòng; `chucVu` (cũng vào mail) không xuống dòng.
 */
const HOP_LE = {
  email: 'ketoan@abc.vn',
  hoTen: 'Nguyễn Văn A',
  chucVu: 'Kế toán',
  donViIds: ['3f1c2a4e-1b2c-4d5e-8f9a-0b1c2d3e4f5a'],
};

test('họ tên / chức vụ hợp lệ -> nhận (cắt khoảng trắng đầu cuối)', () => {
  const r = inviteUserSchema.safeParse({
    ...HOP_LE,
    hoTen: '  Nguyễn Văn A  ',
  });
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.hoTen, 'Nguyễn Văn A');
});

test('họ tên xuống dòng / quá 100 ký tự / chỉ khoảng trắng -> từ chối', () => {
  for (const hoTen of [
    'A\n\nBấm vào http://lua-dao.example để nhận lương',
    'A\r\nB',
    'x'.repeat(101),
    '   ',
  ]) {
    assert.equal(
      inviteUserSchema.safeParse({ ...HOP_LE, hoTen }).success,
      false,
      JSON.stringify(hoTen.slice(0, 30)),
    );
  }
});

test('chức vụ xuống dòng -> từ chối', () => {
  assert.equal(
    inviteUserSchema.safeParse({ ...HOP_LE, chucVu: 'Kế toán\nLiên hệ gấp' })
      .success,
    false,
  );
});
