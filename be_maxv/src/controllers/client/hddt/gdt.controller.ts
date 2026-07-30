import { FastifyReply, FastifyRequest } from "fastify";
import * as GDTService from "../../../services/client/hddt/gdt.service";
import {
  resolveTenantDb,
  resolveTenantDbName,
  resolveTenantInfo,
} from "../../../helpers/resolveTenantDb";
import { renderPdfFromHtml } from "../../../helpers/pdfRenderer";
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
  // maSoThue: guard chống ghi nhầm data MST khác (token GDT có thể của công ty khác công ty đang chọn).
  const { dbName, maSoThue } = await resolveTenantInfo(request);

  try {
    // Lấy HẾT hóa đơn trong khoảng (lặp phân trang + chia tháng), không chỉ 1 trang 50 dòng.
    // Ngân sách retry NGẮN vì luồng này giữ HTTP request mở (proxy cắt ~120s -> 502). Luồng nền
    // `update-run` mới là chỗ dùng ngân sách rộng.
    const result = await GDTService.fetchAndSaveInvoicesInRange(
      dbName,
      tenantKeyOf(request),
      gdtToken,
      direction,
      request.query,
      maSoThue,
      { budgetMs: GDTService.LIST_RETRY_BUDGET_BLOCKING_MS },
    );

    // [DEBUG-CAPNHAT] BE đã trả response — FE vẫn lỗi => lỗi ở tầng kết nối, không phải luồng GDT.
    console.log(
      `[DEBUG-CAPNHAT] GET /gdt/${direction} TRẢ VỀ 200 (${result.saved} đã lưu, partial=${result.partial})`,
    );
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    console.error(
      `[DEBUG-CAPNHAT] GET /gdt/${direction} TRẢ VỀ 500:`,
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );

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

/**
 * GET /gdt/invoices/:direction/detail-complete — đếm HĐ đã lưu trong khoảng/bộ lọc + số HĐ CHƯA có
 * chi tiết (tt_tai != OK). Cho nút "Xuất file tổng hợp + hóa đơn" biết khoảng đã "đồng bộ hoàn thành"
 * chưa (chỉ cho xuất khi missing = 0). Chỉ cần JWT app (resolveTenantDb), KHÔNG cần token GDT (đọc DB).
 */
async function handleDetailComplete(
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
    const result = await GDTService.countDetailComplete(tenantDb, direction, query);
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không kiểm tra được trạng thái chi tiết",
    });
  }
}

export async function purchaseDetailComplete(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleDetailComplete(request, reply, "purchase", request.query);
}

export async function soldDetailComplete(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply
) {
  return handleDetailComplete(request, reply, "sold", request.query);
}

/**
 * POST /gdt/render-pdf — render HTML tờ hóa đơn (FE gửi, inline CSS, không tài nguyên ngoài) thành PDF
 * vector bằng Chromium headless (puppeteer). Trả PDF (application/pdf). Chỉ cần JWT app (đăng nhập);
 * KHÔNG đụng DB/GDT — chỉ là bộ "HTML -> PDF". Dùng: nút "Xuất file tổng hợp + hóa đơn".
 */
export async function renderInvoicePdf(
  request: FastifyRequest<{ Body: { html?: string } }>,
  reply: FastifyReply
) {
  const html = request.body?.html;
  if (!html || typeof html !== "string") {
    return reply.status(400).send({ message: "Thiếu nội dung HTML để render PDF" });
  }
  // Kích thước thực do `bodyLimit` của route (5MB) chặn TRƯỚC handler (theo byte) — không tự đếm ở đây.

  try {
    const pdf = await renderPdfFromHtml(html);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", 'inline; filename="hoa-don.pdf"')
      .send(pdf);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không tạo được PDF",
    });
  }
}

/** Tham số định danh 1 hóa đơn để xin bản XML gốc từ cổng thuế. */
interface ExportXmlQuery {
  nbmst?: string;
  khhdon?: string;
  shdon?: string;
  khmshdon?: string;
  /** "1" = hóa đơn máy tính tiền (`ttxly=8`) -> cổng thuế để ở nhánh sco-query riêng. */
  cttt?: string;
}

/**
 * GET /gdt/invoices/:direction/export-xml?nbmst=&khhdon=&shdon=&khmshdon=[&cttt=1] — tải HÓA ĐƠN XML
 * GỐC ĐÃ KÝ SỐ của 1 hóa đơn từ cổng thuế, trả về `application/xml`.
 *
 * `:direction` đi theo path như mọi endpoint hóa đơn khác (quyết định đọc/ghi cache XML ở bảng nào).
 * Cần CẢ token GDT (X-Gdt-Token: BE gọi cổng thuế) lẫn JWT app (khóa pacer theo công ty đang chọn).
 * Dùng: nút "Xuất file tổng hợp + hóa đơn" (thư mục `xml/`).
 */
export async function exportInvoiceXml(
  request: FastifyRequest<{ Params: { direction: string }; Querystring: ExportXmlQuery }>,
  reply: FastifyReply
) {
  const { direction } = request.params;
  const { nbmst, khhdon, shdon, khmshdon, cttt } = request.query;
  if (direction !== "purchase" && direction !== "sold") {
    return reply.status(400).send({ message: "Tham số direction không hợp lệ" });
  }
  if (!nbmst || !khhdon || !shdon || !khmshdon) {
    return reply.status(400).send({
      message: "Thiếu tham số định danh hóa đơn (nbmst/khhdon/shdon/khmshdon)",
    });
  }

  const gdtToken = extractGdtToken(request);
  if (!gdtToken) {
    return reply.status(401).send({ message: "Thiếu token GDT (X-Gdt-Token)" });
  }

  // Ngoài try/catch: lỗi quyền/tenant trả đúng mã qua error-handler chung. Gọi để chắc chắn người
  // dùng có quyền trên công ty đang chọn TRƯỚC khi tiêu một lượt gọi cổng thuế.
  const tenantDb = await resolveTenantDb(request);

  try {
    const xml = await GDTService.getInvoiceOriginalXmlPaced(
      tenantDb,
      tenantKeyOf(request),
      gdtToken,
      direction,
      {
        nbmst,
        khhdon,
        shdon,
        khmshdon,
        cashRegister: cttt === "1",
      },
    );
    return reply.header("Content-Type", "application/xml; charset=utf-8").send(xml);
  } catch (err) {
    request.log.error(err);
    // Token GDT hết hạn -> phải phân biệt được ở FE để dừng cả lượt xuất và nhắc đăng nhập lại,
    // thay vì chạy tiếp hàng trăm hóa đơn mà cái nào cũng hỏng.
    //
    // KHÔNG dùng 401: interceptor `apiFetchRaw` của FE dành riêng 401 cho nghĩa "cookie app hết
    // hạn" nên nó sẽ gọi /auth/refresh (thành công, vì phiên app còn hạn) rồi GỬI LẠI nguyên
    // request -> mỗi hóa đơn đang bay đốt thêm một lượt gọi cổng thuế + một chu kỳ chờ pacer.
    // Cũng không dùng 403/404: `resolveTenantDb` đã dùng hai mã đó cho lỗi quyền/tenant.
    const status = GDTService.classifyGdtError(err) === "auth" ? 409 : 502;
    return reply.status(status).send({
      message: err instanceof Error ? err.message : "Không tải được XML gốc từ cổng thuế",
    });
  }
}

/**
 * GET /gdt/invoices/:direction/saved-detail/:id — đọc CHI TIẾT ĐÃ LƯU (cột `detail`) của 1 hóa đơn
 * theo id, cho nút "Xem hóa đơn" dựng tờ hóa đơn GTGT. Chỉ cần JWT app (resolveTenantDb), KHÔNG cần
 * token GDT (đọc DB). 404 nếu id không có trong dữ liệu đã lưu; `detail=null` nếu chưa tải chi tiết.
 */
export async function savedInvoiceDetailById(
  request: FastifyRequest<{ Params: { direction: string; id: string } }>,
  reply: FastifyReply
) {
  const { direction, id } = request.params;
  if (direction !== "purchase" && direction !== "sold") {
    return reply.status(400).send({ message: "Tham số direction không hợp lệ" });
  }
  if (!id) {
    return reply.status(400).send({ message: "Thiếu id hóa đơn" });
  }

  // Ngoài try/catch: lỗi quyền/tenant (403/404) trả đúng mã qua error-handler chung.
  const tenantDb = await resolveTenantDb(request);

  try {
    const result = await GDTService.getSavedInvoiceDetailById(tenantDb, direction, id);
    if (!result.found) {
      return reply.status(404).send({
        message: "Không tìm thấy hóa đơn trong dữ liệu đã lưu",
      });
    }
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không đọc được chi tiết đã lưu",
    });
  }
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
 * lọc (THAY THẾ lượt cũ nếu đang chạy), qua pacer dùng chung. Trả tiến độ để FE poll. Cần token GDT
 * (X-Gdt-Token) lẫn JWT app.
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
  // (`done` chỉ dành cho lượt "Cập nhật" hợp nhất 2 pha cần await; ở đây bỏ qua.)
  const { status } = GDTService.runDetailFetch(
    dbName,
    tenantKeyOf(request),
    gdtToken,
    direction,
    request.query,
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
  const status = GDTService.getDetailRunStatus(tenantKeyOf(request), direction);
  return reply.send(status ?? { active: false, total: 0, done: 0, ok: 0, err: 0 });
}

export async function purchaseDetailRunStatus(request: FastifyRequest, reply: FastifyReply) {
  return handleDetailRunStatus(request, reply, "purchase");
}

export async function soldDetailRunStatus(request: FastifyRequest, reply: FastifyReply) {
  return handleDetailRunStatus(request, reply, "sold");
}

// ============================================================
//  "CẬP NHẬT TỪ THUẾ ĐIỆN TỬ" CHẠY NỀN (nút trên tab hóa đơn) — danh sách + chi tiết 1 lượt
// ============================================================

/**
 * Tiến độ rỗng khi chiều này chưa từng chạy lượt cập nhật nào (FE khỏi phải xử lý null).
 * Gắn kiểu tường minh để `tsc` bắt được ngay khi `UpdateRunStatus` thêm field — không có nó thì
 * FE sẽ nhận object thiếu field, khác hẳn shape lúc lượt đang chạy.
 */
const EMPTY_UPDATE_RUN: GDTService.UpdateRunStatus = {
  active: false,
  phase: "",
  page: 0,
  rows: 0,
  saved: 0,
  total: 0,
  source: "",
  partial: false,
  message: "",
  detail: { total: 0, done: 0, ok: 0, err: 0 },
  startedAt: 0,
};

/**
 * POST /gdt/invoices/:direction/update-run — bắt đầu lượt "Cập nhật từ Thuế điện tử" CHẠY NỀN cho
 * ĐÚNG chiều này + ĐÚNG bộ lọc trên query-string, trả tiến độ ngay (FE poll status).
 * Thay cho GET /gdt/invoices/:direction chạy chặn: giữ 1 request mở suốt lượt sẽ bị proxy cắt
 * thành 502, và vì vậy phải rút ngắn ngân sách retry (lấy thiếu). Cần X-Gdt-Token + JWT app.
 */
async function handleStartUpdateRun(
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

  // dbName (không phải client): lượt nền chạy lâu -> service tự getTenantDb lại để giữ pool sống.
  // maSoThue: guard chống ghi nhầm data MST khác vào DB tenant đang chọn.
  const { dbName, maSoThue } = await resolveTenantInfo(request);

  // KHÔNG await: khởi tạo lượt nền rồi trả tiến độ ngay -> FE poll tiếp.
  const status = GDTService.startUpdateRun(
    dbName,
    tenantKeyOf(request),
    direction,
    gdtToken,
    request.query,
    maSoThue,
  );
  return reply.send(status);
}

export async function startPurchaseUpdateRun(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery }>,
  reply: FastifyReply,
) {
  return handleStartUpdateRun(request, reply, "purchase");
}

export async function startSoldUpdateRun(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply,
) {
  return handleStartUpdateRun(request, reply, "sold");
}

/**
 * GET /gdt/invoices/:direction/update-run/status — tiến độ lượt cập nhật (FE poll). Chỉ cần JWT
 * app (đọc state in-memory theo công ty đang chọn), KHÔNG cần token GDT.
 */
async function handleUpdateRunStatus(
  request: FastifyRequest,
  reply: FastifyReply,
  direction: "purchase" | "sold",
) {
  await resolveTenantDb(request); // kiểm quyền công ty đang chọn
  const status = GDTService.getUpdateRunStatus(tenantKeyOf(request), direction);
  return reply.send(status ?? EMPTY_UPDATE_RUN);
}

export async function purchaseUpdateRunStatus(request: FastifyRequest, reply: FastifyReply) {
  return handleUpdateRunStatus(request, reply, "purchase");
}

export async function soldUpdateRunStatus(request: FastifyRequest, reply: FastifyReply) {
  return handleUpdateRunStatus(request, reply, "sold");
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
  // maSoThue: guard chống ghi nhầm data MST khác vào DB tenant đang chọn.
  const { dbName, maSoThue } = await resolveTenantInfo(request);

  try {
    const result = await GDTService.runSync(
      dbName,
      tenantKeyOf(request),
      gdtToken,
      { tuNgay, denNgay, direction, loai },
      maSoThue,
    );

    // Việc TẢI CHI TIẾT do FE tự lái sau khi có kết quả: FE gọi startDetailRun + poll
    // getDetailRunStatus theo từng chiều (giống nút "Cập nhật từ Thuế điện tử"). Endpoint /gdt/sync
    // chỉ soát/bổ sung DANH SÁCH + đối chiếu (daCo/boSung) + ghi sync_log theo từng chiều.
    // [DEBUG-SYNC] BE đã trả response — nếu FE vẫn báo lỗi thì lỗi nằm ở tầng kết nối.
    console.log(`[DEBUG-SYNC] POST /gdt/sync TRẢ VỀ 200 cho tenant=${tenantKeyOf(request)}`);
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    console.error(
      `[DEBUG-SYNC] POST /gdt/sync TRẢ VỀ 500:`,
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không đồng bộ được hóa đơn",
    });
  }
}

/**
 * POST /gdt/sync/run — bắt đầu lượt đồng bộ CHẠY NỀN, trả tiến độ NGAY (FE poll status).
 * Thay cho POST /gdt/sync chạy đồng bộ: lượt đồng bộ có thể kéo hàng chục phút, giữ 1 HTTP request
 * mở lâu như vậy sẽ bị proxy (IIS/ARR mặc định 120s) cắt thành 502. Cần X-Gdt-Token + JWT app.
 */
export async function startSyncRun(
  request: FastifyRequest<{ Body: SyncRequestBody }>,
  reply: FastifyReply,
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

  // dbName (không phải client): lượt chạy nền rất dài -> engine tự getTenantDb lại để giữ pool sống.
  // maSoThue: guard chống ghi nhầm data MST khác vào DB tenant đang chọn.
  const { dbName, maSoThue } = await resolveTenantInfo(request);

  // KHÔNG await: khởi tạo lượt nền rồi trả tiến độ ngay -> FE poll tiếp.
  const status = GDTService.startSyncRun(
    dbName,
    tenantKeyOf(request),
    gdtToken,
    { tuNgay, denNgay, direction, loai },
    maSoThue,
  );
  return reply.send(status);
}

/** Tiến độ rỗng khi công ty chưa từng chạy lượt nào (FE khỏi phải xử lý null). Gắn kiểu để `tsc`
 * bắt lệch shape khi `SyncRunStatus` đổi. */
const EMPTY_SYNC_RUN: GDTService.SyncRunStatus = {
  active: false,
  phase: "",
  rows: 0,
  saved: 0,
  daCo: 0,
  boSung: 0,
  page: 0,
  startedAt: 0,
  results: [],
};

/**
 * GET /gdt/sync/run/status — tiến độ lượt đồng bộ nền (FE poll). Chỉ cần JWT app (đọc state
 * in-memory theo công ty đang chọn), KHÔNG cần token GDT.
 */
export async function syncRunStatus(request: FastifyRequest, reply: FastifyReply) {
  await resolveTenantDb(request); // kiểm quyền công ty đang chọn
  const status = GDTService.getSyncRunStatus(tenantKeyOf(request));
  return reply.send(status ?? EMPTY_SYNC_RUN);
}

/** POST /gdt/sync/run/cancel — người dùng bấm Dừng; lượt thoát ở ranh giới trang gần nhất. */
export async function cancelSyncRun(request: FastifyRequest, reply: FastifyReply) {
  await resolveTenantDb(request);
  const status = GDTService.cancelSyncRun(tenantKeyOf(request));
  return reply.send(status ?? EMPTY_SYNC_RUN);
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
