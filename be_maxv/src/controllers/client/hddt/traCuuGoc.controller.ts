import { FastifyReply, FastifyRequest } from "fastify";
import {
  danhMucTraCuuGoc,
  taiHoaDonGoc,
  TraCuuGocError,
} from "../../../services/client/hddt/traCuuGoc";
import type { TraCuuGocErrorCode } from "../../../services/client/hddt/traCuuGoc/types";

/** Map mã lỗi ngữ nghĩa của service -> HTTP status. Layer HTTP nằm ở đây, không rải trong service. */
const STATUS_BY_CODE: Record<TraCuuGocErrorCode, number> = {
  INVALID_CODE: 422,
  UPSTREAM: 502,
  UNSUPPORTED: 501,
};

/**
 * GET /gdt/tra-cuu-goc/nha-cung-cap → danh mục NCC có bộ tải tự động + URL tra cứu thủ công của từng
 * NCC. FE đọc cái này thay vì giữ bản sao chép tay của registry BE.
 *
 * Không đụng DB và không gọi cổng NCC nào — chỉ đọc registry trong bộ nhớ, nên rẻ và an toàn để FE
 * gọi mỗi lần mở màn hình.
 */
export async function getNhaCungCapTraCuu(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(danhMucTraCuuGoc());
}

interface DownloadOriginalQuery {
  /** MST NCC phát hành (khóa registry `TRA_CUU_NCC`, vd MISA = "0101243150", Viettel = "0100109106"). */
  msttcgp?: string;
  /** Mã tra cứu hóa đơn trên trang NCC (MISA = TransactionID, Viettel = reservationCode). */
  code?: string;
  /** MST người bán (nbmst) — NCC cần thì dùng (Viettel supplierTaxCode/taxCode); MISA bỏ qua. */
  sellerMst?: string;
}

/**
 * GET /gdt/tra-cuu-goc?msttcgp=&code=&sellerMst= → tải FILE PDF GỐC 1 hóa đơn trực tiếp từ trang tra
 * cứu của NCC phát hành (MISA, Viettel…). Chỉ cần JWT app (`authenticate`) — KHÔNG cần token GDT vì
 * không gọi cổng thuế. Trả nguyên bytes để FE lưu vào thư mục người dùng chọn.
 */
export async function downloadOriginalInvoice(
  request: FastifyRequest<{ Querystring: DownloadOriginalQuery }>,
  reply: FastifyReply,
) {
  const { msttcgp, code, sellerMst } = request.query;
  if (!msttcgp) return reply.status(400).send({ message: "Thiếu msttcgp (MST NCC phát hành)" });
  if (!code) return reply.status(400).send({ message: "Thiếu code (mã tra cứu hóa đơn)" });

  try {
    const file = await taiHoaDonGoc(msttcgp, { code, sellerMst });
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
