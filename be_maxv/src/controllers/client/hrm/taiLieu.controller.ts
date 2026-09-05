import { randomBytes } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../utils/validate';
import { sendCreated, sendOk } from '../../../helpers/response';
import { HttpStatus } from '../../../constants/httpStatus';
import { ConflictError, ForbiddenError } from '../../../helpers/errors';
import { MESSAGES } from '../../../constants/messages';
import {
  docState,
  taoState,
  urlDangNhap,
} from '../../../services/client/hrm/driveClient';
import {
  GIOI_HAN_FILE_BYTE,
  dinhKemFile,
  goFile,
  luuKetNoiDrive,
  ngatKetNoiDrive,
  taiFileVe,
  trangThaiDrive,
} from '../../../services/client/hrm/taiLieuDrive.service';
import { resolveTenantDb } from '../../../helpers/resolveTenantDb';
import {
  createTaiLieu,
  deleteTaiLieu,
  listTaiLieu,
  updateTaiLieu,
} from '../../../services/client/hrm/taiLieu.service';
import {
  taiLieuBodySchema,
  taiLieuListQuerySchema,
  taiLieuParamSchema,
  taiLieuUpdateSchema,
} from '../../../validators/hrm/taiLieu.validator';

// GET /api/v1/hrm/tai-lieu?ma_nv=&loai=
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(taiLieuListQuerySchema, req.query);
  return sendOk(reply, await listTaiLieu(db, q));
}

// POST /api/v1/hrm/tai-lieu
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(taiLieuBodySchema, req.body);
  return sendCreated(reply, await createTaiLieu(db, body));
}

// PUT /api/v1/hrm/tai-lieu/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);
  const body = validateBody(taiLieuUpdateSchema, req.body);
  return sendOk(reply, await updateTaiLieu(db, id, body));
}

// DELETE /api/v1/hrm/tai-lieu/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);
  return sendOk(reply, await deleteTaiLieu(db, id));
}

// ── Google Drive: file scan đính kèm ────────────────────────────────────────
// File scan nằm trên Drive CỦA CÔNG TY khách; DB chỉ giữ con trỏ. Xem taiLieuDrive.service.ts.

/** Công ty đang chọn. Mọi endpoint Drive đều theo công ty này, không nhận id từ client. */
function donViDangChon(req: FastifyRequest): string {
  const donViId = req.user?.donViId;
  if (!donViId) throw new ForbiddenError(MESSAGES.COMPANY.NO_COMPANY);
  return donViId;
}

// GET /api/v1/hrm/tai-lieu/drive/trang-thai
export async function driveTrangThai(req: FastifyRequest, reply: FastifyReply) {
  return sendOk(reply, await trangThaiDrive(donViDangChon(req)));
}

/**
 * GET /api/v1/hrm/tai-lieu/drive/lien-ket — trả URL đăng nhập Google để FE mở POPUP.
 *
 * Phải là popup chứ không chuyển hướng cả trang: chuyển hướng làm trang unload và mất luôn file
 * người dùng vừa chọn (object `File` chỉ sống trong bộ nhớ trang), quay lại phải chọn file lần nữa.
 *
 * `state` là JWT ngắn hạn mang donViId: chống CSRF (kẻ khác không tự dựng được callback hợp lệ)
 * và để callback biết đang nối Drive cho công ty nào mà không tin tham số từ URL.
 */
export async function driveLienKet(req: FastifyRequest, reply: FastifyReply) {
  const donViId = donViDangChon(req);
  return sendOk(reply, { url: urlDangNhap(taoState(donViId)) });
}

/**
 * Escape 5 ký tự có nghĩa trong HTML trước khi nhét chuỗi vào trang.
 *
 * Callback Drive là chỗ DUY NHẤT trong dự án trả về HTML tự dựng bằng nối chuỗi, và nó lại là
 * route cố ý miễn đăng nhập (xem taiLieu.route.ts) — nên bất kỳ dữ liệu ngoài nào lọt vào trang
 * đều thành XSS phản chiếu ngay trên origin đang giữ cookie phiên. `httpOnly` KHÔNG cứu được:
 * nó chặn script ĐỌC cookie, chứ script cùng origin vẫn gọi API kèm cookie bình thường; và
 * `SameSite=Strict` cũng không chặn, vì người dùng điều hướng top-level tới đây.
 *
 * Dùng hàm này cho MỌI thứ đưa vào trang, kể cả chuỗi trông có vẻ vô hại (email Google trả về).
 */
function thoatHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );
}

/**
 * GET /api/v1/hrm/tai-lieu/drive/callback — Google chuyển trình duyệt về đây kèm `code`.
 *
 * Trả HTML (không phải JSON) vì đây là một cửa sổ popup thật đang hiển thị cho người dùng:
 * trang tự báo kết quả cho trang cha rồi tự đóng.
 */
export async function driveCallback(req: FastifyRequest, reply: FastifyReply) {
  const { code, state, error } = (req.query ?? {}) as {
    code?: string;
    state?: string;
    error?: string;
  };

  // Nonce cho CSP — mới mỗi lần trả trang. Xem ghi chú ở `thoatHtml`.
  const nonce = randomBytes(16).toString('base64');

  const dong = (thanhCong: boolean, thongDiep: string) =>
    reply
      .status(HttpStatus.OK)
      .type('text/html; charset=utf-8')
      // Lớp phòng thủ thứ hai sau `thoatHtml`: chỉ script mang đúng nonce này được chạy, nên
      // thẻ <script> hay thuộc tính onerror lọt vào trang cũng vô hiệu. `default-src 'none'`
      // chặn luôn việc gọi ra ngoài — trang này không cần tải bất cứ tài nguyên nào.
      .header(
        'content-security-policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`,
      )
      .header('x-content-type-options', 'nosniff')
      .send(
        `<!doctype html><meta charset="utf-8"><title>Kết nối Google Drive</title>
<body style="font-family:system-ui;padding:24px;text-align:center">
<p>${thoatHtml(thongDiep)}</p>
<script nonce="${nonce}">
  // Báo về trang cha rồi tự đóng. Trang cha đang giữ file người dùng đã chọn và sẽ tải lên tiếp.
  try { window.opener && window.opener.postMessage(
    { nguon: 'maxv-drive', thanh_cong: ${thanhCong ? 'true' : 'false'} }, window.location.origin); } catch (e) {}
  setTimeout(function () { window.close(); }, ${thanhCong ? 300 : 4000});
</script></body>`,
      );

  if (error) {
    // Giá trị thật của `error` CHỈ vào log: nó là tham số URL, ai cũng đặt được.
    req.log.warn({ error }, 'Google trả lỗi ở callback Drive');
    return dong(false, 'Bạn chưa cấp quyền truy cập Google Drive.');
  }
  if (!code || !state) return dong(false, 'Thiếu tham số trả về từ Google.');

  const donViId = docState(state);
  if (!donViId) {
    return dong(false, 'Phiên kết nối không hợp lệ hoặc đã hết hạn.');
  }

  try {
    const { email } = await luuKetNoiDrive(donViId, code);
    return dong(true, `Đã kết nối Google Drive${email ? ` (${email})` : ''}.`);
  } catch (err) {
    req.log.error(err);
    // Chỉ hiện thông điệp của lỗi nghiệp vụ do CHÍNH MÌNH đặt (chuỗi tiếng Việt cố định, vd
    // thiếu khóa mã hóa) — người dùng xử lý được. Lỗi từ Google mang văn bản tiếng Anh do bên
    // ngoài soạn (`DriveApiError` nhúng tới 200 byte body Google trả về), không đưa lên trang.
    return dong(
      false,
      err instanceof ConflictError
        ? err.message
        : 'Không kết nối được Google Drive. Vui lòng thử lại.',
    );
  }
}

// DELETE /api/v1/hrm/tai-lieu/drive/ket-noi
export async function driveNgatKetNoi(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  await ngatKetNoiDrive(donViDangChon(req));
  return sendOk(reply, { da_ngat: true });
}

// POST /api/v1/hrm/tai-lieu/:id/file — multipart, 1 file
export async function taiFileLenTaiLieu(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);

  // @fastify/multipart ném lỗi có `code` riêng khi request sai định dạng hoặc file quá cỡ.
  // Không bắt thì rơi xuống nhánh 500 "Lỗi máy chủ nội bộ" — người dùng tải ảnh 15MB lên chỉ
  // nhận được câu đó, không biết phải làm gì.
  let file;
  let noiDung: Buffer;
  try {
    file = await req.file();
    if (!file) throw new ConflictError('Không nhận được file nào.');
    noiDung = await file.toBuffer();
  } catch (err) {
    const ma = (err as { code?: string }).code;
    if (ma === 'FST_REQ_FILE_TOO_LARGE') {
      throw new ConflictError(
        `File vượt quá ${Math.round(GIOI_HAN_FILE_BYTE / 1024 / 1024)}MB.`,
      );
    }
    if (ma === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
      throw new ConflictError('Yêu cầu phải gửi dạng multipart/form-data.');
    }
    if (ma === 'FST_FILES_LIMIT') {
      throw new ConflictError('Mỗi lần chỉ tải lên được một file.');
    }
    throw err;
  }

  return sendCreated(
    reply,
    await dinhKemFile(db, donViDangChon(req), id, {
      ten: file.filename,
      mimeType: file.mimetype,
      noiDung,
    }),
  );
}

/**
 * GET /api/v1/hrm/tai-lieu/:id/file — stream file về trình duyệt.
 * `inline` để ảnh/PDF xem ngay trong app, không phải tải xuống rồi mở bằng phần mềm khác.
 */
export async function xemFileTaiLieu(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);
  const { noiDung, tenFile, mimeType } = await taiFileVe(
    db,
    donViDangChon(req),
    id,
  );

  return reply
    .type(mimeType)
    .header(
      'content-disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(tenFile)}`,
    )
    .send(noiDung);
}

// DELETE /api/v1/hrm/tai-lieu/:id/file
export async function goFileTaiLieu(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);
  return sendOk(reply, await goFile(db, donViDangChon(req), id));
}
