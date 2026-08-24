import { FastifyInstance } from "fastify";
import {
  captcha,
  chiTietToKhai,
  danhSachThongBao,
  dongBo,
  tienDoDongBo,
  getCredential,
  lichSuDongBo,
  login,
  taiFileHoSo,
  taiLieuDinhKem,
  taiThongBao,
  tchsCaptcha,
  traCuuHoSo,
  xoaLichSuDongBo,
  xoaTatCaLichSuDongBo,
} from "../../controllers/client/dich_vu_cong/gdt-dvc.controller";
import { requireModule } from "../../services/shared/modules.service";

/**
 * Proxy cổng Dịch vụ công thuế. Cả các route đều yêu cầu JWT app + gói có module `dvc`
 * (FE ẩn menu khi không có gói, nhưng đó chỉ là lớp hiển thị — gọi thẳng API vẫn phải
 * chặn ở đây, xem comment `requireModule` trong modules.service.ts).
 *
 * Khác `/gdt/captcha` (để mở): endpoint này mở phiên tới một cổng của cơ quan thuế, để mở
 * là biến BE của mình thành trạm trung chuyển ẩn danh cho bất kỳ ai. Dialog đăng nhập DVC
 * luôn nằm trong app đã đăng nhập nên yêu cầu này không cản trở gì.
 */
export default async function (fastify: FastifyInstance) {
  const guard = [fastify.authenticate, requireModule("dvc")];

  fastify.get("/captcha", {
    preHandler: guard,
    handler: captcha,
  });

  fastify.get("/tchs/captcha", {
    preHandler: guard,
    handler: tchsCaptcha,
  });

  fastify.get("/ho-so", {
    preHandler: guard,
    handler: traCuuHoSo,
  });

  fastify.get("/ho-so/file", {
    preHandler: guard,
    handler: taiFileHoSo,
  });

  fastify.get("/ho-so/to-khai-chi-tiet", {
    preHandler: guard,
    handler: chiTietToKhai,
  });

  fastify.get("/ho-so/tai-lieu-dkem", {
    preHandler: guard,
    handler: taiLieuDinhKem,
  });

  fastify.get("/ho-so/thong-bao", {
    preHandler: guard,
    handler: danhSachThongBao,
  });

  fastify.get("/ho-so/thong-bao/file", {
    preHandler: guard,
    handler: taiThongBao,
  });

  fastify.post("/login", {
    preHandler: guard,
    handler: login,
  });

  fastify.get("/credential", {
    preHandler: guard,
    handler: getCredential,
  });

  fastify.post("/dong-bo", {
    preHandler: guard,
    handler: dongBo,
  });

  fastify.get("/dong-bo/tien-do", {
    preHandler: guard,
    handler: tienDoDongBo,
  });

  fastify.get("/dong-bo/lich-su", {
    preHandler: guard,
    handler: lichSuDongBo,
  });

  fastify.delete("/dong-bo/lich-su/:id", {
    preHandler: guard,
    handler: xoaLichSuDongBo,
  });

  fastify.delete("/dong-bo/lich-su", {
    preHandler: guard,
    handler: xoaTatCaLichSuDongBo,
  });
}
