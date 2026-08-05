import { FastifyInstance } from "fastify";
import {
  captcha,
  login,
  purchaseInvoices,
  soldInvoices,
  savedPurchaseInvoices,
  savedSoldInvoices,
  savedPurchaseDetails,
  savedSoldDetails,
  purchaseDetailComplete,
  soldDetailComplete,
  renderInvoicePdf,
  exportInvoiceXml,
  savedInvoiceDetailById,
  downloadOneInvoiceDetail,
  startPurchaseDetailRun,
  startSoldDetailRun,
  purchaseDetailRunStatus,
  soldDetailRunStatus,
  startPurchaseUpdateRun,
  startSoldUpdateRun,
  purchaseUpdateRunStatus,
  soldUpdateRunStatus,
  syncInvoices,
  startSyncRun,
  syncRunStatus,
  cancelSyncRun,
  syncHistory,
  clearSyncData,
  deleteSyncLog,
  systemStats,
} from "../../controllers/client/hddt/gdt.controller";
import { downloadOriginalInvoice } from "../../controllers/client/hddt/traCuuGoc.controller";

export default async function (
  fastify: FastifyInstance
) {
  fastify.get("/captcha", captcha);
  fastify.post("/login", login);

  // Tải FILE PDF GỐC 1 hóa đơn trực tiếp từ trang tra cứu của NCC phát hành (MISA…).
  // Chỉ cần JWT app (không gọi cổng thuế -> không cần X-Gdt-Token). Trả nguyên bytes file.
  fastify.get("/tra-cuu-goc", {
    preHandler: [fastify.authenticate],
    handler: downloadOriginalInvoice,
  });

  // Cần JWT app (Authorization) để resolveTenantDb biết ghi vào DB công ty nào (tra cứu
  // GDT luôn lưu vào DB); token GDT gửi qua header X-Gdt-Token (xem gdt.controller.ts).
  fastify.get("/invoices/purchase", {
    preHandler: [fastify.authenticate],
    handler: purchaseInvoices,
  });
  fastify.get("/invoices/sold", {
    preHandler: [fastify.authenticate],
    handler: soldInvoices,
  });

  // Đọc hóa đơn đã lưu trong DB (không gọi GDT) — chỉ cần JWT app để resolveTenantDb,
  // không cần X-Gdt-Token. Dùng cho luồng DB-first khi mở/lọc tab Hóa đơn.
  fastify.get("/invoices/purchase/saved", {
    preHandler: [fastify.authenticate],
    handler: savedPurchaseInvoices,
  });
  fastify.get("/invoices/sold/saved", {
    preHandler: [fastify.authenticate],
    handler: savedSoldInvoices,
  });

  // Đọc CHI TIẾT đã lưu (cột detail) để tab "Chi tiết hóa đơn" hiện tất cả — không cần X-Gdt-Token.
  fastify.get("/invoices/purchase/saved-details", {
    preHandler: [fastify.authenticate],
    handler: savedPurchaseDetails,
  });
  fastify.get("/invoices/sold/saved-details", {
    preHandler: [fastify.authenticate],
    handler: savedSoldDetails,
  });

  // Đếm HĐ + số HĐ chưa có chi tiết trong khoảng (nút "Xuất file tổng hợp + hóa đơn" chặn khi còn
  // thiếu) — đọc DB, không cần X-Gdt-Token.
  fastify.get("/invoices/purchase/detail-complete", {
    preHandler: [fastify.authenticate],
    handler: purchaseDetailComplete,
  });
  fastify.get("/invoices/sold/detail-complete", {
    preHandler: [fastify.authenticate],
    handler: soldDetailComplete,
  });

  // Render HTML tờ hóa đơn -> PDF vector bằng Chromium (puppeteer). POST body { html }; trả application/pdf.
  // bodyLimit 5MB: HTML 1 hóa đơn nhiều dòng có thể vượt mặc định 1MB của Fastify (nhất là tiếng Việt UTF-8).
  fastify.post("/render-pdf", {
    preHandler: [fastify.authenticate],
    bodyLimit: 5 * 1024 * 1024,
    handler: renderInvoicePdf,
  });

  // Tải HÓA ĐƠN XML GỐC (đã ký số) của 1 hóa đơn từ cổng thuế; trả application/xml. Cần X-Gdt-Token
  // (BE gọi GDT) + JWT app (khóa pacer theo công ty). Dùng cho thư mục `xml/` khi xuất file.
  fastify.get("/invoices/:direction/export-xml", {
    preHandler: [fastify.authenticate],
    handler: exportInvoiceXml,
  });

  // Đọc CHI TIẾT ĐÃ LƯU của 1 hóa đơn theo id (nút "Xem hóa đơn" dựng tờ hóa đơn GTGT) — đọc DB,
  // không cần X-Gdt-Token. `:direction` = purchase|sold.
  fastify.get("/invoices/:direction/saved-detail/:id", {
    preHandler: [fastify.authenticate],
    handler: savedInvoiceDetailById,
  });

  // Tải chi tiết 1 hóa đơn theo id (nút "Cập nhật"/"Tải chi tiết" lặp từng hóa đơn); direction ở body.
  fastify.post("/invoices/detail/:id", {
    preHandler: [fastify.authenticate],
    handler: downloadOneInvoiceDetail,
  });

  // Tải chi tiết CHẠY NỀN ở BE qua pacer dùng chung (429-retry): POST bắt đầu lượt, GET poll tiến độ.
  // Cần X-Gdt-Token cho POST (gọi GDT); GET chỉ cần JWT app (đọc tiến độ in-memory).
  fastify.post("/invoices/purchase/detail-run", {
    preHandler: [fastify.authenticate],
    handler: startPurchaseDetailRun,
  });
  fastify.post("/invoices/sold/detail-run", {
    preHandler: [fastify.authenticate],
    handler: startSoldDetailRun,
  });
  fastify.get("/invoices/purchase/detail-run/status", {
    preHandler: [fastify.authenticate],
    handler: purchaseDetailRunStatus,
  });
  fastify.get("/invoices/sold/detail-run/status", {
    preHandler: [fastify.authenticate],
    handler: soldDetailRunStatus,
  });

  // "Cập nhật từ Thuế điện tử" CHẠY NỀN (thay GET /invoices/:direction chạy chặn): POST bắt đầu +
  // trả tiến độ ngay, GET status để poll. Lượt gồm CẢ 2 pha (danh sách -> chi tiết) của ĐÚNG chiều
  // này + đúng bộ lọc trên query-string. POST cần X-Gdt-Token; GET chỉ cần JWT app.
  fastify.post("/invoices/purchase/update-run", {
    preHandler: [fastify.authenticate],
    handler: startPurchaseUpdateRun,
  });
  fastify.post("/invoices/sold/update-run", {
    preHandler: [fastify.authenticate],
    handler: startSoldUpdateRun,
  });
  fastify.get("/invoices/purchase/update-run/status", {
    preHandler: [fastify.authenticate],
    handler: purchaseUpdateRunStatus,
  });
  fastify.get("/invoices/sold/update-run/status", {
    preHandler: [fastify.authenticate],
    handler: soldUpdateRunStatus,
  });

  // Đồng bộ hóa đơn (dialog "Đồng bộ hóa đơn"): POST /sync chạy đồng bộ (cần X-Gdt-Token),
  // GET /sync/history đọc lịch sử, DELETE /sync/data xóa hóa đơn đã lưu + lịch sử.
  fastify.post("/sync", {
    preHandler: [fastify.authenticate],
    handler: syncInvoices,
  });

  // Đồng bộ CHẠY NỀN (thay POST /sync): POST /sync/run bắt đầu + trả tiến độ ngay, GET status để
  // poll, POST cancel để dừng. Lượt đồng bộ dài hàng chục phút nên không thể giữ 1 request mở chờ
  // (proxy cắt -> 502). POST /sync cũ giữ tạm cho tới khi FE chuyển hẳn sang luồng này.
  fastify.post("/sync/run", {
    preHandler: [fastify.authenticate],
    handler: startSyncRun,
  });
  fastify.get("/sync/run/status", {
    preHandler: [fastify.authenticate],
    handler: syncRunStatus,
  });
  fastify.post("/sync/run/cancel", {
    preHandler: [fastify.authenticate],
    handler: cancelSyncRun,
  });
  fastify.get("/sync/history", {
    preHandler: [fastify.authenticate],
    handler: syncHistory,
  });
  fastify.delete("/sync/data", {
    preHandler: [fastify.authenticate],
    handler: clearSyncData,
  });
  // Xóa 1 dòng lịch sử đồng bộ (CHỈ bản ghi log, không đụng hóa đơn đã lưu) — nút xóa từng dòng.
  fastify.delete("/sync/history/:id", {
    preHandler: [fastify.authenticate],
    handler: deleteSyncLog,
  });

  // Thống kê dữ liệu đã lưu (tab Cài đặt › Dữ liệu hệ thống).
  fastify.get("/stats", {
    preHandler: [fastify.authenticate],
    handler: systemStats,
  });
}
