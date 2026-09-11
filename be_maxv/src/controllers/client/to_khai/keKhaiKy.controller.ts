import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveTenantDb, resolveTenantDbName } from "../../../helpers/resolveTenantDb";
import { getTenantDb } from "../../../helpers/tenantClient";
import { taoHangDoiGioiHan } from "../../../helpers/hangDoiGioiHan";
import * as KeKhai from "../../../services/client/to_khai/application/keKhaiKy.service";
import { kiemTraPhuKy } from "../../../services/client/to_khai/infrastructure/phuKy";
import { BanDaChotError } from "../../../services/client/to_khai/application/toKhaiGtgt01.service";
import { nhanKy } from "../../../services/client/to_khai/domain/kySoThue";
import { docChieu, docKy, type KyInput } from "./docThamSo";
import { thongDiepLoiAnToan } from "../../../helpers/thongDiepLoi";

class KeKhaiDangChayError extends Error {}

/**
 * Lượt kê khai quét toàn bộ hóa đơn thay thế/điều chỉnh của tenant bằng N+1 truy vấn tuần tự
 * (vbsec 2026-09-10). Khóa theo DB TENANT (khóa "người gọi" của hàng đợi là tên DB): mỗi công ty một
 * lượt — hai lượt chồng nhau còn gỡ/gán xen kẽ trên cùng bảng kê; lượt thứ hai bị từ chối NGAY thay vì
 * xếp hàng. Toàn server tối đa 2 lượt chạy + 10 lượt chờ để không cạn pool Postgres dùng chung.
 * Khóa trong bộ nhớ: backend chạy MỘT tiến trình (PM2 fork, `ecosystem.config.js`).
 */
const chayKeKhai = taoHangDoiGioiHan(
  { dongThoi: 2, choToiDa: 10, moiNguoiToiDa: 1 },
  () =>
    new KeKhaiDangChayError(
      "Công ty đang có một lượt kê khai khác chạy (hoặc máy chủ đang bận). Vui lòng đợi xong rồi thử lại.",
    ),
);

/**
 * POST /to-khai/ke-khai — gán mọi hóa đơn có ngày lập trong kỳ vào kỳ đó (cả hai chiều).
 * Chỉ đọc/ghi DB tenant, KHÔNG gọi cổng thuế nên không cần token GDT.
 */
export async function keKhaiKy(
  request: FastifyRequest<{ Body: KyInput }>,
  reply: FastifyReply,
) {
  const dbName = await resolveTenantDbName(request);
  const db = getTenantDb(dbName);
  try {
    const ky = docKy(request.body ?? {});
    const soLuong = await chayKeKhai(dbName, () => KeKhai.danhDauKy(db, ky));
    return reply.send({
      ky,
      nhanKy: nhanKy(ky),
      ...soLuong,
      tong: soLuong.purchase + soLuong.sold,
    });
  } catch (err) {
    if (err instanceof KeKhaiDangChayError) {
      return reply.status(429).send({ message: err.message, code: "dang_ke_khai" });
    }
    request.log.error(err);
    // Kỳ đã chốt là lỗi TRẠNG THÁI, không phải tham số hỏng: trả 409 kèm `code` để màn hình chỉ
    // đúng đường "Mở khóa" thay vì chỉ hiện một câu 400 chung chung.
    if (err instanceof BanDaChotError) {
      return reply.status(409).send({ message: err.message, code: "da_chot" });
    }
    return reply.status(400).send({
      message: thongDiepLoiAnToan(err, "Không kê khai được kỳ này."),
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
      message: thongDiepLoiAnToan(err, "Không kiểm tra được dữ liệu của kỳ."),
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
      message: thongDiepLoiAnToan(err, "Không đọc được bảng kê của kỳ."),
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
    if (err instanceof BanDaChotError) {
      return reply.status(409).send({ message: err.message, code: "da_chot" });
    }
    return reply.status(400).send({
      message: thongDiepLoiAnToan(err, "Không lưu được thay đổi trên bảng kê."),
    });
  }
}
