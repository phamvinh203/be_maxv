import { FastifyInstance } from "fastify";
import {
  captcha,
  login,
  purchaseInvoices,
  soldInvoices,
  savedPurchaseInvoices,
  savedSoldInvoices,
  syncInvoices,
  syncHistory,
  clearSyncData,
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
}
