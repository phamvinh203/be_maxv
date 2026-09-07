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
import { env } from '../../../config/env';
import { canAccessDonVi } from '../../../helpers/access';
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

/**
 * Công ty đang chọn, ĐÃ kiểm lại quyền trong DB. Không nhận id từ client.
 *
 * Không tin thẳng `donViId` trong access token: token sống 15 phút và CỐ Ý không đối chiếu DB
 * mỗi request (xem jwt.plugin.ts), nên người vừa bị gỡ quyền vào công ty vẫn cầm một token hợp
 * lệ tới hết hạn. Mọi route tài liệu khác đi qua `resolveTenantDb` nên được kiểm lại ở đó; ba
 * endpoint Drive không cần DB tenant nên trước đây bỏ qua — mà chúng lại đúng là chỗ đọc/ngắt/
 * đổi kho tài liệu của cả công ty. `requireModule('hrm')` không lấp được chỗ này: nó xét gói
 * dịch vụ của chủ tài khoản, không xét quyền vào MST cụ thể.
 */
async function donViDangChon(req: FastifyRequest): Promise<string> {
  const donViId = req.user?.donViId;
  if (!donViId) throw new ForbiddenError(MESSAGES.COMPANY.NO_COMPANY);
  if (!(await canAccessDonVi(req.user.userId, req.user.role, donViId))) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }
  return donViId;
}

/**
 * Cookie giữ `state` vừa phát, để callback đối chiếu — xem ghi chú ở `driveLienKet`.
 *
 * `sameSite: 'lax'` là CỐ Ý, và phải khác cookie access (`strict`): Google điều hướng top-level
 * từ site khác về callback, `lax` vẫn được gửi kèm trong tình huống đó còn `strict` thì không.
 */
const DRIVE_STATE_COOKIE = 'driveOauthState';

/** Đường dẫn cookie = đúng path của callback, lấy từ env để đổi redirect URI khỏi phải sửa code. */
function duongDanCallback(): string {
  try {
    return new URL(env.googleRedirectUri).pathname;
  } catch {
    return '/api/v1/hrm/tai-lieu/drive/callback';
  }
}

function cookieStateOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.nodeEnv === 'production',
    path: duongDanCallback(),
    maxAge: 600, // khớp hạn 10 phút của state
  };
}

// GET /api/v1/hrm/tai-lieu/drive/trang-thai
export async function driveTrangThai(req: FastifyRequest, reply: FastifyReply) {
  return sendOk(reply, await trangThaiDrive(await donViDangChon(req)));
}

/**
 * GET /api/v1/hrm/tai-lieu/drive/lien-ket — trả URL đăng nhập Google để FE mở POPUP.
 *
 * Phải là popup chứ không chuyển hướng cả trang: chuyển hướng làm trang unload và mất luôn file
 * người dùng vừa chọn (object `File` chỉ sống trong bộ nhớ trang), quay lại phải chọn file lần nữa.
 *
 * `state` ký HMAC mang donViId, để callback biết đang nối Drive cho công ty nào mà không tin
 * tham số từ URL. Chữ ký khiến không ai GIẢ MẠO được state — nhưng một state ĐÃ PHÁT hợp lệ thì
 * vẫn là tấm vé dùng được suốt 10 phút, và nó đi qua URL nên nằm trong thanh địa chỉ popup, lịch
 * sử trình duyệt, log của Google lẫn log truy cập của chính mình. Ai nhặt được tấm vé đó có thể
 * chạy hết luồng đồng ý bằng TÀI KHOẢN GOOGLE CỦA HỌ rồi nộp vào callback, và từ đó mọi file
 * scan của công ty nạn nhân đổ vào Drive của họ.
 *
 * Nên state được khóa vào đúng trình duyệt đã xin nó bằng một cookie, và callback xóa cookie
 * ngay sau khi dùng — mỗi vé chỉ đi được một lần, từ đúng một máy.
 */
export async function driveLienKet(req: FastifyRequest, reply: FastifyReply) {
  const donViId = await donViDangChon(req);

  // Nối LẦN ĐẦU thì ai làm hồ sơ cũng nối được — luồng "bấm thêm file -> đăng nhập Google" phải
  // chạy trọn ngay tại chỗ, chặn ở đây là kế toán không đính được file nào cho tới khi gọi được
  // chủ tài khoản. Nhưng ĐỔI sang tài khoản khác thì khác hẳn: nó chuyển kho tài liệu của cả
  // công ty sang Drive của người vừa đăng nhập, nên để chủ tài khoản quyết.
  const tt = await trangThaiDrive(donViId);
  if (tt.da_ket_noi && req.user.role !== 'OWNER') {
    throw new ForbiddenError(MESSAGES.HRM.DRIVE_DOI_TAI_KHOAN_CHI_OWNER);
  }

  const state = taoState(donViId);
  reply.setCookie(DRIVE_STATE_COOKIE, state, cookieStateOptions());
  return sendOk(reply, { url: urlDangNhap(state) });
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

  // Script trong trang chỉ làm ĐÚNG một việc: tự đóng popup. Trước đây còn `postMessage` báo
  // kết quả về trang cha, đã bỏ vì là code chết — trang này do API phục vụ nên origin của nó là
  // origin API, trong khi trang cha ở origin FE, message sẽ bị trình duyệt bỏ; mà FE cũng không
  // lắng nghe message nào (nó hỏi lại máy chủ sau khi popup đóng, cách đó đúng ở cả dev lẫn
  // production). Ghi chú để NGOÀI chuỗi HTML: mọi thứ trong đó đều bị gửi tới trình duyệt.

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
<script nonce="${nonce}">setTimeout(function(){window.close()},${thanhCong ? 300 : 4000})</script></body>`,
      );

  // Đọc rồi XÓA NGAY, trước mọi nhánh trả về: vé chỉ dùng một lần, kể cả khi lần này hỏng.
  // Hỏng thì người dùng bấm lại từ đầu và nhận vé mới — rẻ hơn nhiều so với để một vé còn sống
  // lởn vởn trong log suốt 10 phút.
  const veDaPhat = req.cookies?.[DRIVE_STATE_COOKIE];
  reply.clearCookie(DRIVE_STATE_COOKIE, { path: duongDanCallback() });

  if (error) {
    // Giá trị thật của `error` CHỈ vào log: nó là tham số URL, ai cũng đặt được.
    req.log.warn({ error }, 'Google trả lỗi ở callback Drive');
    return dong(false, 'Bạn chưa cấp quyền truy cập Google Drive.');
  }
  if (!code || !state) return dong(false, 'Thiếu tham số trả về từ Google.');

  // So sánh thường là đủ: `state` đã ký HMAC nên đoán mò không ra, và giá trị đem so nằm trong
  // cookie httpOnly của chính trình duyệt này — không có kênh đo thời gian nào để lợi dụng.
  if (!veDaPhat || veDaPhat !== state) {
    req.log.warn('Callback Drive không khớp cookie state (vé lạ hoặc đã dùng)');
    return dong(
      false,
      'Phiên kết nối không hợp lệ hoặc đã dùng rồi. Hãy bấm thêm file lại từ đầu, trên chính trình duyệt này.',
    );
  }

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

/**
 * DELETE /api/v1/hrm/tai-lieu/drive/ket-noi
 *
 * Chỉ OWNER: đây là thao tác cấp công ty, cắt đường xem/tải file scan của MỌI người dùng và xóa
 * luôn các ID thư mục đã nhớ. Kiểm ở đây chứ không dùng `app.requireRole` ở route để nói được
 * đúng lý do — `requireRole` chỉ trả câu chung "không có quyền", người dùng không biết phải nhờ ai.
 */
export async function driveNgatKetNoi(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const donViId = await donViDangChon(req);
  if (req.user.role !== 'OWNER') {
    throw new ForbiddenError(MESSAGES.HRM.DRIVE_NGAT_CHI_OWNER);
  }
  await ngatKetNoiDrive(donViId);
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
    await dinhKemFile(db, await donViDangChon(req), id, {
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
    await donViDangChon(req),
    id,
  );

  return (
    reply
      .type(mimeType)
      .header(
        'content-disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(tenFile)}`,
      )
      // Đây là ảnh CCCD / hợp đồng của nhân viên. `no-store` để không nằm lại trong cache đĩa
      // của trình duyệt hay proxy trung gian sau khi người dùng đăng xuất; `nosniff` để trình
      // duyệt bám đúng mimeType mình khai, không tự đoán ra HTML rồi chạy như trang web.
      .header('cache-control', 'no-store, private')
      .header('x-content-type-options', 'nosniff')
      .send(noiDung)
  );
}

// DELETE /api/v1/hrm/tai-lieu/:id/file
export async function goFileTaiLieu(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);
  return sendOk(reply, await goFile(db, await donViDangChon(req), id));
}
