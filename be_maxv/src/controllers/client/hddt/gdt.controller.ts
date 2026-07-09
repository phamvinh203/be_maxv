import { FastifyReply, FastifyRequest } from "fastify";
import * as GDTService from "../../../services/client/hddt/gdt.service";
import { resolveTenantDb } from "../../../helpers/resolveTenantDb";
import {
  LoginRequest,
  PurchaseInvoiceQuery,
  SoldInvoiceQuery,
} from "../../../types/gdt";

/** Token đăng nhập GDT gửi qua header riêng `X-Gdt-Token` (Authorization đã dành cho JWT app). */
function extractGdtToken(request: FastifyRequest): string | undefined {
  const header = request.headers["x-gdt-token"];
  return typeof header === "string" && header.length > 0 ? header : undefined;
}

export async function captcha(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const captcha = await GDTService.getCaptcha();

    return reply.send(captcha);
  } catch (err) {
    request.log.error(err);

    return reply.status(500).send({
      message: "Không lấy được captcha",
    });
  }
}

export async function login(
  request: FastifyRequest<{ Body: LoginRequest }>,
  reply: FastifyReply
) {
  try {
    const result = await GDTService.login(request.body);

    return reply.send(result);
  } catch (err) {
    request.log.error(err);

    return reply.status(401).send({
      message: err instanceof Error ? err.message : "Đăng nhập GDT thất bại",
    });
  }
}

/**
 * Tra cứu hóa đơn từ GDT rồi LUÔN lưu (upsert) vào DB tenant — trả kèm số hóa đơn đã lưu.
 * Cần cả token GDT (header X-Gdt-Token) lẫn JWT app (để resolveTenantDb biết ghi vào DB nào).
 */
async function handleGdtInvoices(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery | SoldInvoiceQuery }>,
  reply: FastifyReply,
  direction: "purchase" | "sold",
) {
  const gdtToken = extractGdtToken(request);
  if (!gdtToken) {
    return reply.status(401).send({
      message: "Thiếu token đăng nhập GDT (header X-Gdt-Token)",
    });
  }

  const { tuNgay, denNgay } = request.query;
  if (!tuNgay || !denNgay) {
    return reply.status(400).send({
      message: "Thiếu khoảng ngày (tuNgay/denNgay)",
    });
  }

  // Ngoài try/catch riêng: lỗi quyền/tenant (403/404) cần trả đúng mã (qua error-handler
  // chung), không bị nuốt thành 500 của khối gọi GDT bên dưới. resolveTenantDb lỗi -> dừng
  // cả request (kể cả bước tra cứu GDT), vì luồng này định nghĩa là "tra cứu -> luôn lưu".
  const tenantDb = await resolveTenantDb(request);

  try {
    const result =
      direction === "purchase"
        ? await GDTService.getPurchaseInvoices(gdtToken, request.query)
        : await GDTService.getSoldInvoices(gdtToken, request.query);
    const saved = await GDTService.saveInvoices(tenantDb, direction, result.datas ?? []);

    return reply.send({ ...result, saved });
  } catch (err) {
    request.log.error(err);

    return reply.status(500).send({
      message:
        err instanceof Error
          ? err.message
          : direction === "purchase"
            ? "Không lấy được danh sách hóa đơn đầu vào"
            : "Không lấy được danh sách hóa đơn đầu ra",
    });
  }
}

export async function purchaseInvoices(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleGdtInvoices(request, reply, "purchase");
}

/**
 * Đọc hóa đơn đã lưu trong DB (không gọi GDT) — chỉ cần JWT app + công ty đã chọn,
 * KHÔNG cần token GDT. Dùng cho luồng "hiển thị dữ liệu đã lưu" khi mở/lọc tab.
 */
async function handleSavedInvoices(
  request: FastifyRequest,
  reply: FastifyReply,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
) {
  if (!query.tuNgay || !query.denNgay) {
    return reply.status(400).send({
      message: "Thiếu khoảng ngày (tuNgay/denNgay)",
    });
  }

  // Ngoài try/catch: lỗi quyền/tenant (403/404) cần trả đúng mã (qua error-handler chung),
  // không bị nuốt thành 500 của khối đọc DB bên dưới.
  const tenantDb = await resolveTenantDb(request);

  try {
    const result = await GDTService.getSavedInvoices(tenantDb, direction, query);

    return reply.send(result);
  } catch (err) {
    request.log.error(err);

    return reply.status(500).send({
      message:
        err instanceof Error ? err.message : "Không đọc được hóa đơn đã lưu",
    });
  }
}

export async function savedPurchaseInvoices(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleSavedInvoices(request, reply, "purchase", request.query);
}

export async function savedSoldInvoices(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleSavedInvoices(request, reply, "sold", request.query);
}

export async function soldInvoices(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleGdtInvoices(request, reply, "sold");
}
