import { FastifyInstance } from "fastify";
import {
  bangKeTheoKy,
  keKhaiKy,
  phuSongKy,
  suaQuyetDinh,
} from "../../controllers/client/to_khai/keKhaiKy.controller";
import {
  chot,
  danhSach,
  doc,
  luu,
  luuPhuLuc,
  moKhoa,
  tinh,
  xuatXml,
} from "../../controllers/client/to_khai/toKhaiGtgt01.controller";
import { requireModule } from "../../services/shared/modules.service";

/**
 * Mô-đun "Tờ khai" — gán hóa đơn vào kỳ, bảng kê của kỳ, và tờ khai 01/GTGT.
 *
 * KHÔNG route nào ở đây gọi cổng thuế: mọi thứ đọc từ DB tenant, nên cũng không nhận `X-Gdt-Token`.
 * Guard `requireModule("tokhai")` chặn ở BE vì ẩn nút trên header chỉ là lớp hiển thị — gõ thẳng
 * URL API vẫn phải bị từ chối khi gói không có mô-đun này.
 */
export default async function (fastify: FastifyInstance) {
  const guard = [fastify.authenticate, requireModule("tokhai")];

  // Gán hóa đơn vào kỳ + bảng kê của kỳ
  fastify.get("/ky/phu-song", { preHandler: guard, handler: phuSongKy });
  fastify.post("/ke-khai", { preHandler: guard, handler: keKhaiKy });
  fastify.get("/hoa-don", { preHandler: guard, handler: bangKeTheoKy });
  fastify.patch("/hoa-don/:chieu/:id", { preHandler: guard, handler: suaQuyetDinh });

  // Tờ khai 01/GTGT.
  // `/gtgt01/danh-sach` phải khai TRƯỚC `/gtgt01/:nam/:kyLoai/:kySo`, không thì "danh-sach" bị
  // nuốt thành giá trị của `:nam` rồi rơi vào handler đọc bản tờ khai.
  fastify.post("/gtgt01/tinh", { preHandler: guard, handler: tinh });
  fastify.get("/gtgt01/danh-sach", { preHandler: guard, handler: danhSach });
  fastify.get("/gtgt01/:nam/:kyLoai/:kySo", { preHandler: guard, handler: doc });
  fastify.put("/gtgt01/:nam/:kyLoai/:kySo", { preHandler: guard, handler: luu });
  fastify.put("/gtgt01/:nam/:kyLoai/:kySo/phu-luc", { preHandler: guard, handler: luuPhuLuc });
  fastify.post("/gtgt01/:nam/:kyLoai/:kySo/chot", { preHandler: guard, handler: chot });
  fastify.post("/gtgt01/:nam/:kyLoai/:kySo/mo-khoa", { preHandler: guard, handler: moKhoa });
  fastify.get("/gtgt01/:nam/:kyLoai/:kySo/xml", { preHandler: guard, handler: xuatXml });
}
