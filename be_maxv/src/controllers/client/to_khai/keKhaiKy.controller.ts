import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveTenantDb } from "../../../helpers/resolveTenantDb";
import * as KeKhai from "../../../services/client/to_khai/keKhaiKy.service";
import { kiemTraPhuKy } from "../../../services/client/to_khai/phuKy";
import { nhanKy } from "../../../services/client/to_khai/kySoThue";
import { docChieu, docKy, type KyInput } from "./docThamSo";

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
 * GET /to-khai/ky/phu-song?nam&kyLoai&kySo — kỳ đã được đồng bộ hóa đơn trọn vẹn chưa.
 *
 * Dialog "Kê khai" gọi trước khi gán để cảnh báo: kê khai một kỳ mới đồng bộ một phần vẫn chạy
 * trơn tru và ra tờ khai thiếu số mà không có dấu hiệu gì (xem ghi chú đầu `phuKy.ts`).
 */
export async function phuSongKy(
  request: FastifyRequest<{ Querystring: KyInput }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    return reply.send(await kiemTraPhuKy(db, docKy(request.query)));
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: err instanceof Error ? err.message : "Không kiểm tra được dữ liệu của kỳ.",
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

/**
 * PATCH /to-khai/hoa-don/:chieu/:id — sửa quyết định kê khai của MỘT hóa đơn (cột "Kê khai/không
 * kê khai" và "Chỉ tiêu tăng giảm" trên bảng kê).
 *
 * Không nhận kỳ: hóa đơn đã thuộc kỳ nào thì quyết định gắn với kỳ đó, đổi kỳ là việc của lượt
 * "Kê khai". Hóa đơn chưa gán kỳ -> `capNhatQuyetDinh` ném, trả 400 kèm lý do.
 */
export async function suaQuyetDinh(
  request: FastifyRequest<{ Params: { chieu?: string; id?: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const chieu = docChieu(request.params.chieu);
    const id = String(request.params.id ?? "");
    if (!id) throw new Error("Thiếu id hóa đơn.");
    await KeKhai.capNhatQuyetDinh(db, id, chieu, KeKhai.locQuyetDinh(request.body));
    return reply.send({ ok: true });
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message:
        err instanceof Error && err.message
          ? err.message
          : "Không lưu được thay đổi trên bảng kê.",
    });
  }
}
