import { FastifyReply, FastifyRequest } from "fastify";
import * as GDTService from "../../../services/client/hddt/gdt.service";
import { LoginRequest } from "../../../types/gdt";

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
