import { FastifyInstance } from "fastify";
import {
  bangKeTheoKy,
  keKhaiKy,
} from "../../controllers/client/to_khai/keKhaiKy.controller";
import { requireModule } from "../../services/shared/modules.service";

/**
 * Mô-đun "Tờ khai" — gán hóa đơn vào kỳ kê khai và đọc bảng kê của kỳ.
 *
 * KHÔNG route nào ở đây gọi cổng thuế: mọi thứ đọc từ DB tenant, nên cũng không nhận `X-Gdt-Token`.
 * Guard `requireModule("tokhai")` chặn ở BE vì ẩn nút trên header chỉ là lớp hiển thị — gõ thẳng
 * URL API vẫn phải bị từ chối khi gói không có mô-đun này.
 */
export default async function (fastify: FastifyInstance) {
  const guard = [fastify.authenticate, requireModule("tokhai")];

  fastify.post("/ke-khai", { preHandler: guard, handler: keKhaiKy });
  fastify.get("/hoa-don", { preHandler: guard, handler: bangKeTheoKy });
}
