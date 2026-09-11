import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../generated/tenant';
import { thongDiepLoiAnToan } from '../helpers/thongDiepLoi';

/**
 * Thông điệp lỗi an toàn cho các controller tự `catch` rồi trả `err.message` (không qua errorHandler).
 *
 * vbsec 2026-09-10 (MEDIUM, gdt.controller.ts:249 + 14 chỗ khác): trả thẳng `err.message` — lỗi Prisma
 * mang đường dẫn file nguồn + đoạn code + tên bảng/cột, lỗi hệ thống mang IP:cổng nội bộ. Lỗi nghiệp vụ
 * (thông điệp tiếng Việt viết cho người dùng) thì vẫn phải hiện nguyên.
 */

const MAC_DINH = 'Không đọc được hóa đơn đã lưu';

test('lỗi Prisma (kèm đường dẫn file + đoạn code) -> thông điệp chung', () => {
  const loi = new Prisma.PrismaClientValidationError(
    'Invalid `prisma.vct60view.findMany()` invocation in\nC:\\Users\\Admin\\be_maxv\\src\\services\\client\\hddt\\gdt.service.ts:1144:36',
    { clientVersion: '7.8.0' },
  );
  assert.equal(thongDiepLoiAnToan(loi, MAC_DINH), MAC_DINH);
});

test('lỗi lập trình (TypeError...) và lỗi hệ thống (ECONNREFUSED kèm IP nội bộ) -> thông điệp chung', () => {
  assert.equal(thongDiepLoiAnToan(new TypeError("Cannot read properties of undefined (reading 'mst')"), MAC_DINH), MAC_DINH);
  const loiMang = Object.assign(new Error('connect ECONNREFUSED 10.0.0.12:5432'), { code: 'ECONNREFUSED' });
  assert.equal(thongDiepLoiAnToan(loiMang, MAC_DINH), MAC_DINH);
});

test('lỗi nghiệp vụ viết cho người dùng -> giữ nguyên thông điệp', () => {
  assert.equal(
    thongDiepLoiAnToan(new Error('Phiên đăng nhập cổng thuế đã hết hạn, vui lòng đăng nhập lại'), MAC_DINH),
    'Phiên đăng nhập cổng thuế đã hết hạn, vui lòng đăng nhập lại',
  );
});

test('giá trị ném ra không phải Error -> thông điệp chung', () => {
  assert.equal(thongDiepLoiAnToan('chuỗi lạ', MAC_DINH), MAC_DINH);
});
