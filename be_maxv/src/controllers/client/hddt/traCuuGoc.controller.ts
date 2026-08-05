import { FastifyReply, FastifyRequest } from "fastify";
import { taiHoaDonGoc, TraCuuGocError } from "../../../services/client/hddt/traCuuGoc";
import type { TraCuuGocErrorCode } from "../../../services/client/hddt/traCuuGoc/types";

/** Map mã lỗi ngữ nghĩa của service -> HTTP status. Layer HTTP nằm ở đây, không rải trong service. */
const STATUS_BY_CODE: Record<TraCuuGocErrorCode, number> = {
  INVALID_CODE: 422,
  UPSTREAM: 502,
  UNSUPPORTED: 501,
};

interface DownloadOriginalQuery {
  /** MST NCC phát hành (khóa registry `TRA_CUU_NCC`, vd MISA = "0101243150"). */
  msttcgp?: string;
  /** Mã tra cứu hóa đơn trên trang NCC (MISA = TransactionID, lấy từ `detail.cttkhac`). */
  code?: string;
}

/**
 * GET /gdt/tra-cuu-goc?msttcgp=&code= → tải FILE PDF GỐC 1 hóa đơn trực tiếp từ trang tra cứu của NCC
 * phát hành (hiện: MISA). Chỉ cần JWT app (`authenticate`) — KHÔNG cần token GDT vì không gọi cổng
 * thuế. Trả nguyên bytes để FE lưu vào thư mục người dùng chọn.
 */
export async function downloadOriginalInvoice(
  request: FastifyRequest<{ Querystring: DownloadOriginalQuery }>,
  reply: FastifyReply,
) {
  const { msttcgp, code } = request.query;
  if (!msttcgp) return reply.status(400).send({ message: "Thiếu msttcgp (MST NCC phát hành)" });
  if (!code) return reply.status(400).send({ message: "Thiếu code (mã tra cứu hóa đơn)" });

  try {
    const file = await taiHoaDonGoc(msttcgp, code);
    return reply
      .header("Content-Type", file.contentType)
      .header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
      .send(file.buffer);
  } catch (err) {
    // Lỗi có chủ đích (mã sai/NCC lỗi/chưa hỗ trợ) -> map code sang status; còn lại là 500 bất ngờ.
    if (err instanceof TraCuuGocError) {
      const status = STATUS_BY_CODE[err.code];
      if (status >= 500) request.log.error(err);
      return reply.status(status).send({ message: err.message, code: err.code });
    }
    request.log.error(err);
    return reply.status(500).send({ message: "Lỗi tải hóa đơn gốc" });
  }
}
