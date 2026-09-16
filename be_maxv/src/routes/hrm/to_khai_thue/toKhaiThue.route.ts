import type { FastifyInstance } from 'fastify';
import { gioiHanTheoNguoiDung } from '../../../constants/rateLimits';
import * as danhMuc from '../../../controllers/client/hrm/to_khai_thue/incomeCategory.controller';
import * as thuNhapNgoai from '../../../controllers/client/hrm/to_khai_thue/otherIncomeRecord.controller';
import * as bangThue from '../../../controllers/client/hrm/to_khai_thue/taxSheet.controller';
import * as toKhai from '../../../controllers/client/hrm/to_khai_thue/taxDeclaration.controller';
import * as chinhSach from '../../../controllers/client/hrm/to_khai_thue/taxPolicy.controller';

/**
 * HRM › Tờ khai thuế TNCN (`to_khai_thue`) — 23 endpoint của `docs/hrm/to_khai_thue/api-contract-to-khai-thue.md`
 * (22 endpoint Mục 1 + tải lại file tờ khai Mục 5.8).
 *
 * Quyền kiểm ở ĐẦU từng controller (`helpers/hrm/toKhaiThueAccess.ts`), không ở `preHandler` của route:
 * quyền đi cùng handler nên nối handler sang route khác cũng không lọt. Lỗi quyền luôn mang `E-tkt-014`.
 *
 * Route nháp cũ đã bỏ hẳn (Mục 0.6): `other-income/batch-apply`, `delete-all`, `delete-employee` (xóa loạt
 * chứng từ thuế, không FR nào phủ) · `05-kk-tncn/ghi-de` (đổi thành `overrides`) · `chot`, `mo-khoa` (chốt/mở
 * là của Bảng tính thuế tháng) · `export-xml` (XML ngoài phạm vi).
 */
export async function hrmToKhaiThueRoutes(app: FastifyInstance) {
  // 1–5. Danh mục loại thu nhập ngoài lương (Mục 2)
  app.get('/to-khai-thue/income-categories', danhMuc.listIncomeCategories);
  app.get('/to-khai-thue/income-categories/:id', danhMuc.getIncomeCategoryById);
  app.post('/to-khai-thue/income-categories', danhMuc.createIncomeCategory);
  app.put('/to-khai-thue/income-categories/:id', danhMuc.updateIncomeCategory);
  app.delete(
    '/to-khai-thue/income-categories/:id',
    danhMuc.deleteIncomeCategory,
  );

  // 6–11. Bản ghi thu nhập ngoài lương (Mục 3)
  app.get('/to-khai-thue/other-income', thuNhapNgoai.listOtherIncomes);
  app.get('/to-khai-thue/other-income/:id', thuNhapNgoai.getOtherIncomeById);
  app.post(
    '/to-khai-thue/other-income/preview',
    thuNhapNgoai.previewOtherIncome,
  );
  app.post('/to-khai-thue/other-income', thuNhapNgoai.createOtherIncome);
  app.put('/to-khai-thue/other-income/:id', thuNhapNgoai.updateOtherIncome);
  app.delete('/to-khai-thue/other-income/:id', thuNhapNgoai.deleteOtherIncome);

  // 12–14. Bảng tính thuế tháng (Mục 4) — tháng Nháp tính trực tiếp nên giữ giới hạn tần suất.
  app.get(
    '/to-khai-thue/tax-calculation',
    gioiHanTheoNguoiDung(30, '1 minute'),
    bangThue.getTaxSheet,
  );
  app.post('/to-khai-thue/tax-calculation/lock', bangThue.lockTaxSheet);
  app.post('/to-khai-thue/tax-calculation/unlock', bangThue.unlockTaxSheet);

  // 15–21 + 5.8. Tờ khai quý 05/KK-TNCN (Mục 5) — dựng PDF chạy Chromium nên giới hạn tần suất.
  app.get('/to-khai-thue/05-kk-tncn', toKhai.getToKhai);
  app.get('/to-khai-thue/05-kk-tncn/periods', toKhai.listKyToKhai);
  app.put('/to-khai-thue/05-kk-tncn/overrides', toKhai.putGhiDe);
  app.delete('/to-khai-thue/05-kk-tncn/overrides', toKhai.deleteGhiDe);
  app.post(
    '/to-khai-thue/05-kk-tncn/export',
    gioiHanTheoNguoiDung(10, '1 minute'),
    toKhai.xuatToKhai,
  );
  app.get(
    '/to-khai-thue/05-kk-tncn/file',
    gioiHanTheoNguoiDung(10, '1 minute'),
    toKhai.taiLaiFileToKhai,
  );
  app.get('/to-khai-thue/05-kk-tncn/detail-sheet', toKhai.getBangChiTiet);
  app.post('/to-khai-thue/05-kk-tncn/mark-submitted', toKhai.danhDauDaNop);

  // 22. Chính sách thuế theo mốc hiệu lực (Mục 6, ADR-012) — chỉ đọc.
  app.get('/to-khai-thue/tax-policies', chinhSach.listTaxPolicies);
}
