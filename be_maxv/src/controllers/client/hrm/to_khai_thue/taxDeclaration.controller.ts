import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpStatus } from '../../../../constants/httpStatus';
import {
  assertQuanTriToKhaiThue,
  dbToKhaiThue,
} from '../../../../helpers/hrm/toKhaiThueAccess';
import { kiemTraTkt } from '../../../../helpers/hrm/toKhaiThueValidate';
import { PdfRenderBusyError } from '../../../../helpers/pdfRenderer';
import { currentUserId } from '../../../../helpers/resolveTenantDb';
import { sendOk } from '../../../../helpers/response';
import * as service from '../../../../services/client/hrm/to_khai_thue/taxDeclaration.service';
import {
  dungFileChiTiet,
  dungFileToKhai,
  type FileXuat,
} from '../../../../services/client/hrm/to_khai_thue/taxDeclarationFile';
import {
  bangChiTietQuerySchema,
  danhDauNopBodySchema,
  danhSachKyQuerySchema,
  ghiDeBodySchema,
  kyToKhaiQuerySchema,
  taiFileToKhaiQuerySchema,
  xoaGhiDeQuerySchema,
  xuatToKhaiBodySchema,
} from '../../../../validators/hrm/to_khai_thue/taxDeclaration.validator';

/** Tờ khai thuế TNCN quý 05/KK-TNCN — 8 endpoint (api-contract Mục 5 + tải lại file). */

/** Truyền file theo ADR-005 Mục 3: thân nhị phân, không bọc envelope. */
function guiFile(reply: FastifyReply, f: FileXuat) {
  return reply
    .header('Content-Type', f.loai)
    .header(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(f.ten)}`,
    )
    .header('Cache-Control', 'no-store, private')
    .header('X-Content-Type-Options', 'nosniff')
    .send(f.noiDung);
}

function nguoiNopThue(req: FastifyRequest) {
  // `dbToKhaiThue` đã chặn trường hợp chưa chọn công ty ⇒ tới đây `donViId` luôn có.
  return service.layThongTinNguoiNopThue(req.user.donViId as string);
}

export async function getToKhai(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbToKhaiThue(req);
  const { nam, quy } = kiemTraTkt(kyToKhaiQuerySchema, req.query, 'E-tkt-017');
  return sendOk(
    reply,
    await service.getToKhai(db, nam, quy, await nguoiNopThue(req)),
  );
}

export async function listKyToKhai(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbToKhaiThue(req);
  const { nam } = kiemTraTkt(danhSachKyQuerySchema, req.query, 'E-tkt-017');
  return sendOk(reply, await service.listKyToKhai(db, nam));
}

export async function putGhiDe(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbToKhaiThue(req);
  const body = kiemTraTkt(ghiDeBodySchema, req.body, 'E-tkt-012');
  return sendOk(
    reply,
    await service.putGhiDe(
      db,
      body.nam,
      body.quy,
      body.overrides,
      await nguoiNopThue(req),
    ),
  );
}

export async function deleteGhiDe(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbToKhaiThue(req);
  const q = kiemTraTkt(xoaGhiDeQuerySchema, req.query, 'E-tkt-012');
  return sendOk(
    reply,
    await service.deleteGhiDe(db, q.nam, q.quy, q.ct, await nguoiNopThue(req)),
  );
}

export async function xuatToKhai(req: FastifyRequest, reply: FastifyReply) {
  assertQuanTriToKhaiThue(req);
  const db = await dbToKhaiThue(req);
  const body = kiemTraTkt(xuatToKhaiBodySchema, req.body, 'E-tkt-017');
  const userId = currentUserId(req);
  const dto = await service.xuatToKhai(
    db,
    body,
    userId,
    await nguoiNopThue(req),
  );

  // Từ đây trạng thái ĐÃ là EXPORTED (giao dịch đã commit). Dựng file hỏng thì KHÔNG lùi trạng thái —
  // lùi là mở lại khóa 3 tháng trong khi bộ số đã chốt sang `ct` chính thức (api-contract Mục 5.5).
  let file: FileXuat;
  try {
    file = await dungFileToKhai(dto, body.format, userId);
  } catch (err) {
    req.log.error(err);
    return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      success: false,
      message:
        'Tờ khai đã chuyển sang Đã xuất nhưng chưa dựng được file. Hãy tải lại file tờ khai sau ít phút (GET /to-khai-thue/05-kk-tncn/file).',
    });
  }
  return guiFile(reply, file);
}

export async function taiLaiFileToKhai(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  assertQuanTriToKhaiThue(req);
  const db = await dbToKhaiThue(req);
  const q = kiemTraTkt(taiFileToKhaiQuerySchema, req.query, 'E-tkt-017');
  const dto = await service.layToKhaiDaXuat(
    db,
    q.nam,
    q.quy,
    await nguoiNopThue(req),
  );
  try {
    return guiFile(
      reply,
      await dungFileToKhai(dto, q.format, currentUserId(req)),
    );
  } catch (err) {
    if (err instanceof PdfRenderBusyError) {
      return reply
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .send({ success: false, message: err.message });
    }
    throw err;
  }
}

export async function getBangChiTiet(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbToKhaiThue(req);
  const q = kiemTraTkt(bangChiTietQuerySchema, req.query, 'E-tkt-017');
  const dong = await service.getBangChiTiet(db, q.nam, q.quy);
  if (q.format === 'json') return sendOk(reply, dong);
  return guiFile(reply, dungFileChiTiet(q.nam, q.quy, dong));
}

export async function danhDauDaNop(req: FastifyRequest, reply: FastifyReply) {
  assertQuanTriToKhaiThue(req);
  const db = await dbToKhaiThue(req);
  const body = kiemTraTkt(danhDauNopBodySchema, req.body, 'E-tkt-017');
  const dto = await service.danhDauDaNop(
    db,
    body,
    currentUserId(req),
    await nguoiNopThue(req),
  );
  // Hợp đồng Mục 5.7: nói rõ đây chỉ là cờ nội bộ — kế toán không được hiểu nhầm là đã nộp qua hệ thống.
  return reply.status(HttpStatus.OK).send({
    success: true,
    data: dto,
    message:
      'Đã đánh dấu tờ khai là Đã nộp. Đây chỉ là ghi nhận nội bộ — hệ thống KHÔNG nộp và KHÔNG xác thực với cơ quan thuế.',
  });
}
