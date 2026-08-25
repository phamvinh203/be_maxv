import { FastifyReply, FastifyRequest } from "fastify";
import * as DvcGnt from "../../../../services/client/dich_vu_cong/giay_nop_tien/dvc-gnt-dong-bo.service";
import * as EtaxGnt from "../../../../services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service";
import { resolveTenantDb } from "../../../../helpers/resolveTenantDb";
import {
  phienDvc,
  voiPhienTuPhucHoi,
  nguCanhTuRequest,
  thanLoi,
} from "../gdt-dvc.controller";

/** GET /dvc/giay-nop-tien — tra cứu GNT ĐÃ ĐỒNG BỘ, đọc thẳng DB tenant (cùng khuôn `traCuuHoSo`
 * bên `gdt-dvc.controller.ts`). */
export async function traCuuGiayNopTien(
  request: FastifyRequest<{ Querystring: DvcGnt.TimGntBoLoc }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const tenantDb = await resolveTenantDb(request);
  try {
    const bang = await DvcGnt.timGiayNopTienDaDongBo(tenantDb, {
      tuNgay: q?.tuNgay,
      denNgay: q?.denNgay,
      maGiaoDich: q?.maGiaoDich,
      soGnt: q?.soGnt,
    });
    return reply.send(bang);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: err instanceof Error ? err.message : "Tra cứu Giấy nộp tiền thất bại.",
    });
  }
}

/**
 * GET /dvc/giay-nop-tien/file?maGiaoDich=<số tham chiếu> — tải PDF một GNT, đọc cache trước.
 *
 * Cache miss cần MỞ PHIÊN GNT MỚI ngay tại đây (khác `taiFileHoSo` bên DVC, vốn dùng lại `key`
 * phiên đã đăng nhập sẵn) vì phiên GNT không cache qua nhiều lượt (xem spec mục 3.1) — chỉ cần
 * phiên DVC (`key`) còn sống là đủ, không cần `key` GNT riêng nào từ FE.
 */
export async function taiFileGiayNopTien(
  request: FastifyRequest<{ Querystring: { key?: string; maGiaoDich?: string } }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const maGiaoDich = q?.maGiaoDich;
  if (!maGiaoDich) {
    return reply.status(400).send({ message: "Thiếu số tham chiếu / mã giao dịch." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const daLuu = await DvcGnt.layFileGntDaLuu(tenantDb, maGiaoDich);
    if (daLuu) {
      return reply
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(daLuu.fileName)}`)
        .type(daLuu.contentType)
        .send(daLuu.bytes);
    }

    const phien = phienDvc(request, q.key);
    if (!phien) {
      return reply.status(400).send({
        message: 'Giấy nộp tiền chưa đồng bộ — bấm "Đăng nhập cổng Dịch vụ công" rồi thử lại.',
      });
    }
    const ctuId = await DvcGnt.layCtuIdDaLuu(tenantDb, maGiaoDich);
    if (!ctuId) {
      return reply.status(404).send({ message: "Không tìm thấy Giấy nộp tiền này." });
    }

    const ket = await voiPhienTuPhucHoi(nguCanhTuRequest(request), phien, async () => {
      let session = await EtaxGnt.ganPhienGnt(phien, phien.donViId);
      session = await EtaxGnt.khoiTaoTraCuuGnt(session);
      return EtaxGnt.taiPdfGnt(session, ctuId);
    });

    await DvcGnt.luuFileGntVaoCache(tenantDb, maGiaoDich, ket.tep);
    return reply
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(ket.tep.fileName)}`)
      .type(ket.tep.contentType)
      .send(ket.tep.bytes);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send(thanLoi(err, "Tải file Giấy nộp tiền thất bại."));
  }
}
