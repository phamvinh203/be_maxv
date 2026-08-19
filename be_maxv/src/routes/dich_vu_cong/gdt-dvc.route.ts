import { FastifyInstance } from "fastify";
import {
  captcha,
  danhSachThongBao,
  login,
  taiFileHoSo,
  taiLieuDinhKem,
  taiThongBao,
  tchsCaptcha,
  traCuuHoSo,
} from "../../controllers/client/dich_vu_cong/gdt-dvc.controller";

/**
 * Proxy cổng Dịch vụ công thuế. Cả các route đều yêu cầu JWT app.
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

  fastify.get("/tchs/captcha", {
    preHandler: [fastify.authenticate],
    handler: tchsCaptcha,
  });

  fastify.get("/ho-so", {
    preHandler: [fastify.authenticate],
    handler: traCuuHoSo,
  });

  fastify.get("/ho-so/file", {
    preHandler: [fastify.authenticate],
    handler: taiFileHoSo,
  });

  fastify.get("/ho-so/tai-lieu-dkem", {
    preHandler: [fastify.authenticate],
    handler: taiLieuDinhKem,
  });

  fastify.get("/ho-so/thong-bao", {
    preHandler: [fastify.authenticate],
    handler: danhSachThongBao,
  });

  fastify.get("/ho-so/thong-bao/file", {
    preHandler: [fastify.authenticate],
    handler: taiThongBao,
  });

  fastify.post("/login", {
    preHandler: [fastify.authenticate],
    handler: login,
  });
}
