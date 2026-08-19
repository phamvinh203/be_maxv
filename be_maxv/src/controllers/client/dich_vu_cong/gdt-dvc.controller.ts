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
 * GET /dvc/tchs/captcha?key=... — lấy ảnh captcha và tự động giải OCR cho form tra cứu hồ sơ /tthc/tchs.
 */
export async function tchsCaptcha(
  request: FastifyRequest<{ Querystring: { key?: string } }>,
  reply: FastifyReply,
) {
  const key = request.query?.key;
  if (!key) {
    return reply.status(400).send({ message: "Thiếu khóa phiên key." });
  }

  try {
    const result = await DvcService.getTchsCaptcha(key);
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({
      message: DvcService.toUserMessage(err, "Không lấy được mã captcha tra cứu hồ sơ."),
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

type DvcTraCuuHoSoQuery = Partial<DvcService.DvcTraCuuHoSoQuery>;

/**
 * GET /dvc/ho-so — tra cứu hồ sơ đã nộp, trả bảng đã bóc sẵn từ mảnh HTML của cổng.
 *
 * Bóc ở BE chứ không đẩy HTML thô về trình duyệt: mảnh HTML của cổng mang cả thẻ script và
 * link nội bộ, nhét thẳng vào React là vừa mở đường XSS vừa buộc FE biết markup của cổng.
 */
export async function traCuuHoSo(
  request: FastifyRequest<{ Querystring: DvcTraCuuHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  if (!q?.key) {
    return reply
      .status(400)
      .send({ message: "Thiếu khóa phiên đăng nhập Dịch vụ công." });
  }

  try {
    const bang = await DvcService.traCuuHoSo({
      key: q.key,
      tuNgay: q.tuNgay,
      denNgay: q.denNgay,
      captcha: q.captcha,
      maNghiepVu: q.maNghiepVu,
      maTTHC: q.maTTHC,
      maToKhai: q.maToKhai,
      maHoSo: q.maHoSo,
      scope: q.scope,
      mstUyQuyen: q.mstUyQuyen,
    });
    return reply.send(bang);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Tra cứu hồ sơ thất bại."),
    });
  }
}

type DvcHoSoQuery = { key?: string; maHoSo?: string };

/**
 * GET /dvc/ho-so/file — tải file XML của một hồ sơ theo mã hồ sơ (cột "Tải file").
 *
 * Trả nguyên bytes + content-type cổng gửi (xem `DvcService.taiXmlHoSo`), không bọc JSON:
 * đây là tệp tải xuống, không phải dữ liệu để FE parse.
 */
export async function taiFileHoSo(
  request: FastifyRequest<{ Querystring: DvcHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  if (!q?.key || !q?.maHoSo) {
    return reply.status(400).send({ message: "Thiếu khóa phiên hoặc mã hồ sơ." });
  }

  try {
    const tep = await DvcService.taiXmlHoSo(q.key, q.maHoSo);
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(tep.fileName)}`,
      )
      .type(tep.contentType)
      .send(tep.bytes);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Tải file hồ sơ thất bại."),
    });
  }
}

/**
 * GET /dvc/ho-so/tai-lieu-dkem — danh sách tài liệu đính kèm của một hồ sơ (cột "Tệp đính kèm").
 *
 * Chuyển tiếp nguyên JSON cổng trả về — hình dạng thật chưa xác nhận, xem
 * `DvcService.layTaiLieuDinhKem`.
 */
export async function taiLieuDinhKem(
  request: FastifyRequest<{ Querystring: DvcHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  if (!q?.key || !q?.maHoSo) {
    return reply.status(400).send({ message: "Thiếu khóa phiên hoặc mã hồ sơ." });
  }

  try {
    const data = await DvcService.layTaiLieuDinhKem(q.key, q.maHoSo);
    return reply.send(data);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Không lấy được danh sách tài liệu đính kèm."),
    });
  }
}

type DvcThongBaoQuery = DvcHoSoQuery & { idTbao?: string };

/**
 * GET /dvc/ho-so/thong-bao/file — tải file của một thông báo theo `idTbao` (cột "Thông báo").
 *
 * Trả nguyên bytes + content-type cổng gửi (xem `DvcService.taiThongBao`), cùng quy ước với
 * `taiFileHoSo` — đây là tệp tải xuống, không phải dữ liệu để FE parse.
 */
export async function taiThongBao(
  request: FastifyRequest<{ Querystring: DvcThongBaoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  if (!q?.key || !q?.maHoSo || !q?.idTbao) {
    return reply.status(400).send({ message: "Thiếu khóa phiên, mã hồ sơ hoặc mã thông báo." });
  }

  try {
    const tep = await DvcService.taiThongBao(q.key, q.maHoSo, q.idTbao);
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(tep.fileName)}`,
      )
      .type(tep.contentType)
      .send(tep.bytes);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Tải file thông báo thất bại."),
    });
  }
}

/**
 * GET /dvc/ho-so/thong-bao — danh sách thông báo của một hồ sơ (cột "Thông báo").
 *
 * Trả mảng đã bóc sẵn (xem `DvcService.layDanhSachThongBao`/`ThongBaoDaBoc`) — cùng quy ước
 * với `traCuuHoSo`: BE bóc HTML, controller không đẩy markup thô ra FE.
 */
export async function danhSachThongBao(
  request: FastifyRequest<{ Querystring: DvcHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  if (!q?.key || !q?.maHoSo) {
    return reply.status(400).send({ message: "Thiếu khóa phiên hoặc mã hồ sơ." });
  }

  try {
    const ds = await DvcService.layDanhSachThongBao(q.key, q.maHoSo);
    return reply.send(ds);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Không lấy được danh sách thông báo."),
    });
  }
}
