import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveTenantDb } from "../../../helpers/resolveTenantDb";
import * as ToKhai from "../../../services/client/to_khai/toKhaiGtgt01.service";
import { docKy, type KyInput } from "./docThamSo";

/**
 * Lập, sửa và chốt tờ khai 01/GTGT của một kỳ. Chỉ đọc/ghi DB tenant — không gọi cổng thuế nên
 * không endpoint nào ở đây nhận token GDT.
 */

/**
 * Lỗi nghiệp vụ đã biết -> mã HTTP tương ứng kèm `code` máy đọc được (FE dựa vào đó để hiện đúng
 * hướng dẫn); còn lại 400 với câu tiếng Việt.
 */
function traLoi(reply: FastifyReply, err: unknown, macDinh: string) {
  if (err instanceof ToKhai.KyChuaKeKhaiError) {
    return reply.status(409).send({ message: err.message, code: "chua_ke_khai" });
  }
  if (err instanceof ToKhai.BanDaChotError) {
    return reply.status(409).send({ message: err.message, code: "da_chot" });
  }
  if (err instanceof ToKhai.ChuaCoBanError) {
    return reply.status(404).send({ message: err.message, code: "chua_co_ban" });
  }
  return reply.status(400).send({ message: err instanceof Error ? err.message : macDinh });
}

/** POST /to-khai/gtgt01/tinh — tính từ bảng kê của kỳ rồi ghi bản nháp. */
export async function tinh(request: FastifyRequest<{ Body: KyInput }>, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    return reply.send(await ToKhai.tinhVaLuu(db, docKy(request.body ?? {})));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lập được tờ khai.");
  }
}

/** GET /to-khai/gtgt01/:nam/:kyLoai/:kySo — đọc bản đã lưu. */
export async function doc(request: FastifyRequest<{ Params: KyInput }>, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    const ban = await ToKhai.docBan(db, docKy(request.params));
    if (!ban) {
      return reply
        .status(404)
        .send({ message: "Kỳ này chưa có bản tờ khai nào.", code: "chua_co_ban" });
    }
    return reply.send(ban);
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không đọc được tờ khai.");
  }
}

/** PUT /to-khai/gtgt01/:nam/:kyLoai/:kySo — lưu ô sửa tay rồi tính lại. */
export async function luu(
  request: FastifyRequest<{ Params: KyInput; Body: { ghiDe?: unknown } }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const ghiDe = ToKhai.locGhiDeHopLe(request.body?.ghiDe);
    return reply.send(await ToKhai.luuGhiDe(db, docKy(request.params), ghiDe));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lưu được tờ khai.");
  }
}

/**
 * PUT /to-khai/gtgt01/:nam/:kyLoai/:kySo/phu-luc — sửa mô tả hàng hóa trên phụ lục giảm thuế.
 * Chỉ nhận hai ô chữ; số của phụ lục luôn tính từ hóa đơn.
 */
export async function luuPhuLuc(
  request: FastifyRequest<{ Params: KyInput; Body: { muaVao?: unknown; banRa?: unknown } }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const ten = {
      muaVao: typeof request.body?.muaVao === "string" ? request.body.muaVao : undefined,
      banRa: typeof request.body?.banRa === "string" ? request.body.banRa : undefined,
    };
    return reply.send(await ToKhai.luuTenHangPhuLuc(db, docKy(request.params), ten));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lưu được phụ lục.");
  }
}

function doiTrangThaiHandler(trangThai: "nhap" | "chot") {
  return async function (request: FastifyRequest<{ Params: KyInput }>, reply: FastifyReply) {
    const db = await resolveTenantDb(request);
    try {
      return reply.send(await ToKhai.doiTrangThai(db, docKy(request.params), trangThai));
    } catch (err) {
      request.log.error(err);
      return traLoi(reply, err, "Không đổi được trạng thái tờ khai.");
    }
  };
}

/** POST /to-khai/gtgt01/:…/chot — đóng băng số đã nộp. */
export const chot = doiTrangThaiHandler("chot");
/** POST /to-khai/gtgt01/:…/mo-khoa — mở lại để sửa. */
export const moKhoa = doiTrangThaiHandler("nhap");

/** GET /to-khai/gtgt01/danh-sach — các kỳ đã lập, mới nhất trước. */
export async function danhSach(request: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    return reply.send(await ToKhai.danhSachKy(db));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lấy được danh sách kỳ đã lập.");
  }
}
