import { FastifyInstance } from "fastify";
import {
  traCuuGiayNopTien,
  taiFileGiayNopTien,
} from "../../../controllers/client/dich_vu_cong/giay_nop_tien/gnt.controller";
import { requireModule } from "../../../services/shared/modules.service";

/** Route Giấy nộp tiền (eTax GNT) — sub-plugin của `gdt-dvc.route.ts`, đăng ký ở đó nên thừa hưởng
 * cùng prefix `/dvc`. Tách file riêng theo đúng quy ước "mọi file MỚI nằm trong `giay_nop_tien/`". */
export default async function (fastify: FastifyInstance) {
  const guard = [fastify.authenticate, requireModule("dvc")];

  fastify.get("/giay-nop-tien", {
    preHandler: guard,
    handler: traCuuGiayNopTien,
  });

  fastify.get("/giay-nop-tien/file", {
    preHandler: guard,
    handler: taiFileGiayNopTien,
  });
}
