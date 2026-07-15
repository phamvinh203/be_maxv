import { FastifyReply, FastifyRequest } from "fastify";
import * as GDTService from "../../../services/client/hddt/gdt.service";
import { resolveTenantDb, resolveTenantDbName } from "../../../helpers/resolveTenantDb";
import { getTenantDb } from "../../../helpers/tenantClient";
import {
  InvoiceDetailOneBody,
  LoginRequest,
  PurchaseInvoiceQuery,
  SoldInvoiceQuery,
  SyncRequestBody,
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
  // Dùng dbName để còn kích hoạt backfill nền (chạy dài, tự getTenantDb lại giữ pool sống).
  const dbName = await resolveTenantDbName(request);
  const tenantDb = getTenantDb(dbName);

  try {
    // Lấy HẾT hóa đơn trong khoảng (lặp phân trang + chia tháng), không chỉ 1 trang 50 dòng.
    const result = await GDTService.fetchAndSaveInvoicesInRange(
      tenantDb,
      gdtToken,
      direction,
      request.query,
    );

    // Tìm tay 1 khoảng THÀNH CÔNG -> kích hoạt backfill nền 2 năm (fire-and-forget, không chặn response).
    GDTService.ensureBackfill(dbName, tenantKeyOf(request), gdtToken);

    return reply.send(result);
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

/**
 * Đọc CHI TIẾT đã lưu (cột `detail`) của hóa đơn trong 1 khoảng ngày — cho tab "Chi tiết hóa đơn"
 * hiển thị TẤT CẢ. Chỉ cần JWT app (resolveTenantDb), KHÔNG cần token GDT (đọc DB).
 */
async function handleSavedDetails(
  request: FastifyRequest,
  reply: FastifyReply,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
) {
  if (!query.tuNgay || !query.denNgay) {
    return reply.status(400).send({ message: "Thiếu khoảng ngày (tuNgay/denNgay)" });
  }

  const tenantDb = await resolveTenantDb(request);

  try {
    const datas = await GDTService.getSavedInvoiceDetails(tenantDb, direction, query);
    return reply.send({ datas });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không đọc được chi tiết đã lưu",
    });
  }
}

export async function savedPurchaseDetails(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleSavedDetails(request, reply, "purchase", request.query);
}

export async function savedSoldDetails(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleSavedDetails(request, reply, "sold", request.query);
}

export async function soldInvoices(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleGdtInvoices(request, reply, "sold");
}

/**
 * POST /gdt/invoices/detail/:id — tải chi tiết 1 hóa đơn đã lưu (on-demand, nút "Xem chi tiết").
 * `id` ở path, `direction` ở body. Cần token GDT (X-Gdt-Token) lẫn JWT app. Trả kèm `detail` để
 * FE hiển thị ngay; 404 nếu id không có trong dữ liệu đã lưu.
 */
export async function downloadOneInvoiceDetail(
  request: FastifyRequest<{ Params: { id: string }; Body: InvoiceDetailOneBody }>,
  reply: FastifyReply
) {
  const gdtToken = extractGdtToken(request);
  if (!gdtToken) {
    return reply.status(401).send({
      message: "Thiếu token đăng nhập GDT (header X-Gdt-Token)",
    });
  }

  const { id } = request.params;
  const { direction } = request.body ?? {};
  if (!id) {
    return reply.status(400).send({ message: "Thiếu id hóa đơn" });
  }
  if (direction !== "purchase" && direction !== "sold") {
    return reply.status(400).send({ message: "Tham số direction không hợp lệ" });
  }

  // Ngoài try/catch: lỗi quyền/tenant (403/404) trả đúng mã qua error-handler chung.
  const tenantDb = await resolveTenantDb(request);

  try {
    const result = await GDTService.downloadOneInvoiceDetail(
      tenantDb,
      gdtToken,
      direction,
      id,
    );
    if (!result.found) {
      return reply.status(404).send({
        message: "Không tìm thấy hóa đơn trong dữ liệu đã lưu",
      });
    }
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    // Lỗi xảy ra sau khi đã resolve tenant nhưng không được fetchAndStoreDetail đánh dấu ->
    // ghi bền dấu lỗi (best-effort) để dòng vẫn hiện "Lỗi" sau khi nạp lại/reload.
    await GDTService.markInvoiceDetailError(tenantDb, direction, id).catch(() => {});
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không tải được chi tiết hóa đơn",
    });
  }
}

/** Khóa pacer/tiến độ = công ty đang chọn (donViId ~ 1 MST). resolveTenantDb đã đảm bảo tồn tại. */
function tenantKeyOf(request: FastifyRequest): string {
  return request.user.donViId as string;
}

/**
 * POST /gdt/invoices/:direction/detail-run — bắt đầu lượt TẢI CHI TIẾT chạy NỀN ở BE cho khoảng đang
 * lọc (THAY THẾ lượt manual cũ nếu đang chạy), qua pacer dùng chung (ưu tiên "manual" — chen trước
 * job nền). Trả tiến độ để FE poll. Cần token GDT (X-Gdt-Token) lẫn JWT app.
 */
async function handleStartDetailRun(
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
    return reply.status(400).send({ message: "Thiếu khoảng ngày (tuNgay/denNgay)" });
  }

  // Ngoài try/catch: lỗi quyền/tenant (403/404) trả đúng mã qua error-handler chung.
  // Dùng dbName (không phải client) vì lượt chạy nền dài — engine tự getTenantDb lại để giữ pool sống.
  const dbName = await resolveTenantDbName(request);

  // runDetailFetch KHÔNG async chặn: khởi tạo lượt nền rồi trả tiến độ ngay -> FE poll tiếp.
  const status = GDTService.runDetailFetch(
    dbName,
    tenantKeyOf(request),
    gdtToken,
    direction,
    request.query,
    "manual",
  );
  return reply.send(status);
}

export async function startPurchaseDetailRun(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery }>,
  reply: FastifyReply,
) {
  return handleStartDetailRun(request, reply, "purchase");
}

export async function startSoldDetailRun(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply,
) {
  return handleStartDetailRun(request, reply, "sold");
}

/**
 * GET /gdt/invoices/:direction/detail-run/status — tiến độ lượt tải chi tiết (FE poll). Chỉ cần JWT
 * app (resolveTenantDb để lấy đúng công ty/quyền), KHÔNG cần token GDT.
 */
async function handleDetailRunStatus(
  request: FastifyRequest,
  reply: FastifyReply,
  direction: "purchase" | "sold",
) {
  await resolveTenantDb(request);
  const status = GDTService.getDetailRunStatus(tenantKeyOf(request), direction, "manual");
  return reply.send(status ?? { active: false, total: 0, done: 0, ok: 0, err: 0 });
}

export async function purchaseDetailRunStatus(request: FastifyRequest, reply: FastifyReply) {
  return handleDetailRunStatus(request, reply, "purchase");
}

export async function soldDetailRunStatus(request: FastifyRequest, reply: FastifyReply) {
  return handleDetailRunStatus(request, reply, "sold");
}

// ============================================================
//  ĐỒNG BỘ HÓA ĐƠN (dialog "Đồng bộ hóa đơn")
// ============================================================

const VALID_DIRECTIONS = ["all", "purchase", "sold"] as const;
const VALID_KINDS = ["all", "except_ctt", "only_ctt"] as const;

/**
 * POST /gdt/sync — đồng bộ hóa đơn 1 khoảng ngày từ GDT vào DB (lặp hết trang, ghi lịch sử).
 * Cần token GDT (X-Gdt-Token) lẫn JWT app (resolveTenantDb). Có thể chạy lâu với khoảng ngày lớn.
 */
export async function syncInvoices(
  request: FastifyRequest<{ Body: SyncRequestBody }>,
  reply: FastifyReply
) {
  const gdtToken = extractGdtToken(request);
  if (!gdtToken) {
    return reply.status(401).send({
      message: "Thiếu token đăng nhập GDT (header X-Gdt-Token)",
    });
  }

  const { tuNgay, denNgay, direction, loai } = request.body ?? {};
  if (!tuNgay || !denNgay) {
    return reply.status(400).send({ message: "Thiếu khoảng ngày (tuNgay/denNgay)" });
  }
  if (!VALID_DIRECTIONS.includes(direction) || !VALID_KINDS.includes(loai)) {
    return reply.status(400).send({ message: "Tham số direction/loai không hợp lệ" });
  }

  // Ngoài try/catch: lỗi quyền/tenant (403/404) trả đúng mã qua error-handler chung.
  const tenantDb = await resolveTenantDb(request);

  try {
    const log = await GDTService.runSync(tenantDb, gdtToken, {
      tuNgay,
      denNgay,
      direction,
      loai,
    });
    return reply.send(log);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không đồng bộ được hóa đơn",
    });
  }
}

/** GET /gdt/sync/history — lịch sử đồng bộ (không cần token GDT). */
export async function syncHistory(request: FastifyRequest, reply: FastifyReply) {
  const tenantDb = await resolveTenantDb(request);
  try {
    return reply.send(await GDTService.listSyncLogs(tenantDb));
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không đọc được lịch sử đồng bộ",
    });
  }
}

/** DELETE /gdt/sync/data — xóa hóa đơn đã lưu + lịch sử đồng bộ (không đụng dữ liệu GDT gốc). */
export async function clearSyncData(request: FastifyRequest, reply: FastifyReply) {
  const tenantDb = await resolveTenantDb(request);
  try {
    return reply.send(await GDTService.clearSyncedData(tenantDb));
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không xóa được dữ liệu đã đồng bộ",
    });
  }
}

/** GET /gdt/stats — thống kê dữ liệu đã lưu (tab Dữ liệu hệ thống). */
export async function systemStats(request: FastifyRequest, reply: FastifyReply) {
  const tenantDb = await resolveTenantDb(request);
  try {
    return reply.send(await GDTService.getSystemStats(tenantDb));
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không đọc được thống kê",
    });
  }
}
