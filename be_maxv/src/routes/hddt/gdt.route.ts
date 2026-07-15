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
  downloadOneInvoiceDetail,
  startPurchaseDetailRun,
  startSoldDetailRun,
  purchaseDetailRunStatus,
  soldDetailRunStatus,
  syncInvoices,
  syncHistory,
  clearSyncData,
  systemStats,
} from "../../controllers/client/hddt/gdt.controller";

export default async function (
  fastify: FastifyInstance
) {
  fastify.get("/captcha", captcha);
  fastify.post("/login", login);

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

  // Đồng bộ hóa đơn (dialog "Đồng bộ hóa đơn"): POST /sync chạy đồng bộ (cần X-Gdt-Token),
  // GET /sync/history đọc lịch sử, DELETE /sync/data xóa hóa đơn đã lưu + lịch sử.
  fastify.post("/sync", {
    preHandler: [fastify.authenticate],
    handler: syncInvoices,
  });
  fastify.get("/sync/history", {
    preHandler: [fastify.authenticate],
    handler: syncHistory,
  });
  fastify.delete("/sync/data", {
    preHandler: [fastify.authenticate],
    handler: clearSyncData,
  });

  // Thống kê dữ liệu đã lưu (tab Cài đặt › Dữ liệu hệ thống).
  fastify.get("/stats", {
    preHandler: [fastify.authenticate],
    handler: systemStats,
  });
}
