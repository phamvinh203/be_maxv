import { FastifyReply, FastifyRequest } from "fastify";
import * as GDTService from "../../../services/client/hddt/gdt.service";
import {
  LoginRequest,
  PurchaseInvoiceQuery,
  SoldInvoiceQuery,
} from "../../../types/gdt";

/** Lấy Bearer token từ header `Authorization`, trả `undefined` nếu thiếu/sai định dạng. */
function extractBearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export async function captcha(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const captcha = await GDTService.getCaptcha();

    return reply.send(captcha);
  } catch (err) {
    request.log.error(err);

    return reply.status(500).send({
      message: "Không lấy được captcha",
    });
  }
}

export async function login(
  request: FastifyRequest<{ Body: LoginRequest }>,
  reply: FastifyReply
) {
  try {
    const result = await GDTService.login(request.body);

    return reply.send(result);
  } catch (err) {
    request.log.error(err);

    return reply.status(401).send({
      message: err instanceof Error ? err.message : "Đăng nhập GDT thất bại",
    });
  }
}

export async function purchaseInvoices(
  request: FastifyRequest<{ Querystring: PurchaseInvoiceQuery }>,
  reply: FastifyReply
) {
  const token = extractBearerToken(request);
  if (!token) {
    return reply.status(401).send({
      message: "Thiếu token đăng nhập GDT (Authorization: Bearer <token>)",
    });
  }

  const { tuNgay, denNgay } = request.query;
  if (!tuNgay || !denNgay) {
    return reply.status(400).send({
      message: "Thiếu khoảng ngày (tuNgay/denNgay)",
    });
  }

  try {
    const result = await GDTService.getPurchaseInvoices(token, request.query);

    return reply.send(result);
  } catch (err) {
    request.log.error(err);

    return reply.status(500).send({
      message:
        err instanceof Error
          ? err.message
          : "Không lấy được danh sách hóa đơn đầu vào",
    });
  }
}

export async function soldInvoices(
  request: FastifyRequest<{ Querystring: SoldInvoiceQuery }>,
  reply: FastifyReply
) {
  const token = extractBearerToken(request);
  if (!token) {
    return reply.status(401).send({
      message: "Thiếu token đăng nhập GDT (Authorization: Bearer <token>)",
    });
  }

  const { tuNgay, denNgay } = request.query;
  if (!tuNgay || !denNgay) {
    return reply.status(400).send({
      message: "Thiếu khoảng ngày (tuNgay/denNgay)",
    });
  }

  try {
    const result = await GDTService.getSoldInvoices(token, request.query);

    return reply.send(result);
  } catch (err) {
    request.log.error(err);

    return reply.status(500).send({
      message:
        err instanceof Error
          ? err.message
          : "Không lấy được danh sách hóa đơn đầu ra",
    });
  }
}
