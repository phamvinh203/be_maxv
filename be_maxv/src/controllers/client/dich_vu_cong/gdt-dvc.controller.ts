import { FastifyReply, FastifyRequest } from "fastify";
import * as DvcService from "../../../services/client/dich_vu_cong/gdt-dvc.service";

/**
 * GET /dvc/captcha — mở một phiên mới với cổng Dịch vụ công và trả ảnh captcha.
 *
 * Trả `{ key, image }`: `key` là khóa phiên FE phải gửi lại khi đăng nhập, `image` là
 * data-URL gắn thẳng vào `<img src>`.
 */
export async function captcha(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await DvcService.getCaptcha();
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({
      message: DvcService.toUserMessage(err, "Không lấy được mã captcha của cổng Dịch vụ công."),
    });
  }
}

/**
 * Body chưa qua kiểm tra. Dùng lại `DvcLoginRequest` của service thay vì khai lại hình
 * dạng lần hai — thêm trường thì chỉ phải sửa một chỗ, không lo rơi field lúc chép tay.
 */
type DvcLoginBody = Partial<DvcService.DvcLoginRequest>;

/**
 * POST /dvc/login — đăng nhập cổng Dịch vụ công bằng phiên đã lấy captcha.
 *
 * Không lưu mật khẩu như luồng HĐĐT: bên kia có cột `gdtPassword*` trên `DonVi` để điền
 * sẵn, cổng DVC dùng tài khoản khác (`<MST>-ql`) nên phải có chỗ lưu riêng — để sau, khi
 * chốt được luồng đăng nhập đã chạy đúng.
 */
export async function login(
  request: FastifyRequest<{ Body: DvcLoginBody }>,
  reply: FastifyReply,
) {
  const body = request.body;
  if (!body?.key || !body?.tenDN || !body?.matKhau || !body?.captcha) {
    return reply.status(400).send({ message: "Vui lòng nhập đầy đủ thông tin." });
  }

  try {
    const result = await DvcService.login({
      key: body.key,
      tenDN: body.tenDN,
      matKhau: body.matKhau,
      captcha: body.captcha,
    });
    return reply.send(result);
  } catch (err) {
    request.log.error(err);

    // KHÔNG dùng 401: `apiFetch` bên FE dành riêng 401 cho nghĩa "cookie app hết hạn" nên sẽ
    // gọi /auth/refresh rồi GỬI LẠI request này với captcha đã bị tiêu — thành 2 lượt gọi cổng
    // cho một lần bấm. Giống lý do đã ghi ở `hddt/gdt.controller.ts`.
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Đăng nhập cổng Dịch vụ công thất bại."),
    });
  }
}
