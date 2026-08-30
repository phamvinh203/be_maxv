import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveTenantDb } from "../../../helpers/resolveTenantDb";
import * as KeKhai from "../../../services/client/to_khai/keKhaiKy.service";
import { kyHopLe, nhanKy, type Ky, type KyLoai } from "../../../services/client/to_khai/kySoThue";

interface KyInput {
  nam?: number | string;
  kyLoai?: string;
  kySo?: number | string;
}

/**
 * Đọc kỳ từ body/query rồi KIỂM BIÊN ngay — kỳ sai (tháng 13, quý 5, năm 1900) phải dừng trước khi
 * chạm DB, không thì `khoangCuaKy` sẽ dựng ra khoảng ngày vô nghĩa và quét nhầm hóa đơn.
 */
function docKy(raw: KyInput): Ky {
  const ky: Ky = {
    nam: Number(raw.nam),
    kyLoai: String(raw.kyLoai) as KyLoai,
    kySo: Number(raw.kySo),
  };
  if (!kyHopLe(ky)) {
    throw new Error("Kỳ kê khai không hợp lệ (kiểm tra lại loại kỳ, số kỳ và năm).");
  }
  return ky;
}

function docChieu(raw: unknown): KeKhai.Chieu {
  const chieu = String(raw ?? "");
  if (chieu !== "purchase" && chieu !== "sold") {
    throw new Error("Chiều hóa đơn không hợp lệ (chỉ nhận purchase hoặc sold).");
  }
  return chieu;
}

/**
 * POST /to-khai/ke-khai — gán mọi hóa đơn có ngày lập trong kỳ vào kỳ đó (cả hai chiều).
 * Chỉ đọc/ghi DB tenant, KHÔNG gọi cổng thuế nên không cần token GDT.
 */
export async function keKhaiKy(
  request: FastifyRequest<{ Body: KyInput }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const ky = docKy(request.body ?? {});
    const soLuong = await KeKhai.danhDauKy(db, ky);
    return reply.send({
      ky,
      nhanKy: nhanKy(ky),
      ...soLuong,
      tong: soLuong.purchase + soLuong.sold,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: err instanceof Error ? err.message : "Không kê khai được kỳ này.",
    });
  }
}

/**
 * GET /to-khai/hoa-don?nam&kyLoai&kySo&chieu — bảng kê của một kỳ, một chiều.
 * Trả cùng hình dạng `{ total, datas, thayThe }` với `/gdt/invoices/:direction/saved` để frontend
 * dùng lại `toDisplayRow` + `buildReplacedByMap`, chỉ thêm `keKhai`/`chiTieuTangGiam` mỗi dòng.
 */
export async function bangKeTheoKy(
  request: FastifyRequest<{ Querystring: KyInput & { chieu?: string } }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const ky = docKy(request.query);
    const chieu = docChieu(request.query.chieu);
    return reply.send(await KeKhai.layBangKeTheoKy(db, ky, chieu));
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: err instanceof Error ? err.message : "Không đọc được bảng kê của kỳ.",
    });
  }
}
