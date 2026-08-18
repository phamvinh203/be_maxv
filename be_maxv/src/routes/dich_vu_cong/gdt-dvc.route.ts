import { FastifyInstance } from "fastify";
import { captcha, login } from "../../controllers/client/dich_vu_cong/gdt-dvc.controller";

/**
 * Proxy cổng Dịch vụ công thuế. Cả hai route đều yêu cầu JWT app.
 *
 * Khác `/gdt/captcha` (để mở): endpoint này mở phiên tới một cổng của cơ quan thuế, để mở
 * là biến BE của mình thành trạm trung chuyển ẩn danh cho bất kỳ ai. Dialog đăng nhập DVC
 * luôn nằm trong app đã đăng nhập nên yêu cầu này không cản trở gì.
 */
export default async function (fastify: FastifyInstance) {
  fastify.get("/captcha", {
    preHandler: [fastify.authenticate],
    handler: captcha,
  });

  fastify.post("/login", {
    preHandler: [fastify.authenticate],
    handler: login,
  });
}
