import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env';
import { ConflictError, DriveApiError } from '../../../helpers/errors';

/**
 * Gọi Google Drive REST API bằng `fetch` thuần — CỐ Ý không kéo `googleapis` vào.
 *
 * Lý do: chỉ cần 5 thao tác (đổi mã lấy token, làm mới token, tạo/tìm thư mục, tải lên, tải về,
 * xóa), trong khi `googleapis` là một khối rất lớn kéo theo hàng chục gói con — dự án đang giữ
 * số phụ thuộc tối thiểu và theo dõi `npm audit`.
 *
 * File này CHỈ biết HTTP + token, KHÔNG biết Prisma/DB/nghiệp vụ — phần ghép với `hrm_tai_lieu`
 * nằm ở `taiLieuDrive.service.ts`. Tách vậy để test được từng mảnh và để chỗ này dùng lại được
 * nếu sau này có tính năng khác cũng cần Drive.
 *
 * PHẠM VI QUYỀN: chỉ xin `drive.file` — app chỉ thấy được file do CHÍNH NÓ tạo, không đọc được
 * dữ liệu Drive sẵn có của khách. Đây là scope "non-sensitive": không phải qua kiểm định CASA.
 */

const OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const MIME_THU_MUC = 'application/vnd.google-apps.folder';

/**
 * `drive.file` để tạo/đọc file do app tạo; `email` để hiển thị "đang dùng Drive của tài khoản
 * nào" — người dùng phải biết file của mình đang nằm ở đâu.
 */
const SCOPE = 'https://www.googleapis.com/auth/drive.file email';

/** Đã cấu hình đủ 3 biến env chưa. Thiếu -> mọi tính năng Drive tự tắt, không làm sập app. */
export function driveDaCauHinh(): boolean {
  return Boolean(
    env.googleClientId && env.googleClientSecret && env.googleRedirectUri,
  );
}

/**
 * Kế thừa `ConflictError` để errorHandler trả 409 kèm đúng câu này. Nếu để `Error` thường thì
 * nó rơi xuống nhánh 500 "Lỗi máy chủ nội bộ" — người dùng không biết là do thiếu cấu hình, và
 * log lỗi thì đầy những dòng không phải sự cố thật.
 */
export class DriveChuaCauHinhError extends ConflictError {
  constructor() {
    super(
      'Máy chủ chưa cấu hình Google Drive (thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI).',
    );
  }
}

/**
 * `fetch` nhưng đổi lỗi TẦNG MẠNG thành `DriveApiError` để errorHandler ánh xạ được.
 *
 * `doc()` bên dưới chỉ xử lý phản hồi ĐÃ VỀ mà mã lỗi; còn khi máy chủ không ra được internet
 * (DNS không phân giải được, tường lửa/proxy chặn, hết thời gian chờ) thì `fetch` NÉM chứ không
 * trả Response — lỗi đó là `TypeError: fetch failed` trần, lọt thẳng ra ngoài và bị hiểu nhầm
 * thành "app tự vỡ" (500), trong khi thật ra máy chủ chỉ đang không gọi được Google.
 *
 * Giữ nguyên chữ ký của `fetch` để chỗ gọi không phải đổi cách viết.
 *
 * Cũng đặt trần thời gian ở đây: không đặt thì mỗi lượt thừa hưởng mặc định 300 giây của undici
 * — một kết nối treo giữ chỗ một request handler suốt 5 phút, mà tải file lại nằm sau hai lượt
 * gọi (đổi token rồi mới tới Drive). 30 giây đủ rộng cho file 10MB đường truyền kém, và đủ ngắn
 * để hỏng thì hỏng dứt khoát.
 */
const HAN_GOI_MS = 30_000;

async function fetchGoogle(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(HAN_GOI_MS),
    });
  } catch (err) {
    // Chỉ lấy phần host: URL đầy đủ có thể mang theo query nhạy cảm (mã đổi token).
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return 'Google';
      }
    })();
    throw new DriveApiError(
      0,
      `Máy chủ không kết nối được tới ${host}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

/**
 * Rút mã lỗi máy-đọc-được từ body Google trả về. Hai dạng khác nhau tùy endpoint:
 *   OAuth : {"error":"invalid_grant","error_description":"..."}
 *   Drive : {"error":{"code":403,"status":"PERMISSION_DENIED","errors":[{"reason":"..."}]}}
 *
 * Không parse được thì trả `undefined` — xem ghi chú ở `DriveApiError.maLoi`.
 */
function docMaLoi(body: string): string | undefined {
  try {
    const j = JSON.parse(body) as {
      error?: string | { status?: string; errors?: { reason?: string }[] };
    };
    if (typeof j.error === 'string') return j.error;
    if (j.error && typeof j.error === 'object') {
      return j.error.errors?.[0]?.reason ?? j.error.status;
    }
  } catch {
    // Body không phải JSON (Google có lúc trả HTML khi 5xx qua proxy) — không có mã để rút.
  }
  return undefined;
}

async function doc<T>(res: Response, viec: string): Promise<T> {
  if (!res.ok) {
    // Nuốt lỗi parse: Google có lúc trả HTML (5xx qua proxy) chứ không phải JSON.
    const chiTiet = await res.text().catch(() => '');
    throw new DriveApiError(
      res.status,
      `Google Drive từ chối yêu cầu "${viec}" (HTTP ${res.status}): ${chiTiet.slice(0, 200)}`,
      { maLoi: docMaLoi(chiTiet) },
    );
  }
  return (await res.json()) as T;
}

/**
 * URL đưa người dùng sang màn đăng nhập Google.
 *
 * `access_type=offline` + `prompt=consent` là BẮT BUỘC để chắc chắn nhận được refresh token:
 * Google chỉ trả refresh token ở lần đồng ý ĐẦU TIÊN, thiếu `prompt=consent` thì lần kết nối
 * lại sẽ không có token mới và tính năng chết âm thầm sau khi khách thu hồi quyền.
 */
export function urlDangNhap(state: string): string {
  if (!driveDaCauHinh()) throw new DriveChuaCauHinhError();
  const q = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${OAUTH_AUTH}?${q.toString()}`;
}

export interface KetQuaKetNoi {
  refreshToken: string;
  accessToken: string;
  email: string | null;
}

/** Đổi `code` (Google trả về ở callback) lấy refresh token dùng lâu dài. */
export async function doiMaLayToken(code: string): Promise<KetQuaKetNoi> {
  if (!driveDaCauHinh()) throw new DriveChuaCauHinhError();

  const res = await fetchGoogle(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await doc<{ refresh_token?: string; access_token: string }>(
    res,
    'đổi mã lấy token',
  );

  if (!data.refresh_token) {
    // Xảy ra khi tài khoản đã cấp quyền trước đó mà không ép `prompt=consent`.
    throw new DriveApiError(
      400,
      'Google không trả refresh token. Vào https://myaccount.google.com/permissions gỡ quyền của ứng dụng rồi kết nối lại.',
    );
  }

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    email: await layEmail(data.access_token).catch(() => null),
  };
}

async function layEmail(accessToken: string): Promise<string | null> {
  const res = await fetchGoogle(USERINFO, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/**
 * Đổi refresh token lấy access token ngắn hạn (Google cấp ~1 giờ).
 * KHÔNG cache trong module: tiến trình có thể chạy nhiều tenant, cache nhầm là dùng token của
 * công ty này gọi Drive của công ty khác.
 */
export async function layAccessToken(refreshToken: string): Promise<string> {
  if (!driveDaCauHinh()) throw new DriveChuaCauHinhError();

  const res = await fetchGoogle(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await doc<{ access_token: string }>(res, 'làm mới token');
  return data.access_token;
}

/**
 * Hàng đợi theo từng thư mục, để hai request cùng lúc không cùng "tìm hụt rồi cùng tạo".
 *
 * "Tìm trước rồi tạo" chỉ chặn được trùng khi các lượt đi TUẦN TỰ. Hai người cùng đính file cho
 * một nhân viên thì cả hai đều tìm hụt (thư mục chưa ai tạo), cả hai đều tạo — Drive cho phép
 * trùng tên nên ra hai thư mục, file nằm rải hai nơi.
 *
 * Khóa trong tiến trình là đủ cho topology hiện tại (IIS -> một tiến trình Node). Chạy nhiều
 * tiến trình thì khóa này không còn bao trùm — lúc đó phải chuyển sang khóa ở DB.
 */
const hangDoiThuMuc = new Map<string, Promise<string>>();

export function taoThuMucNeuChua(
  accessToken: string,
  ten: string,
  idCha: string | null,
): Promise<string> {
  const khoa = `${idCha ?? 'root'}/${ten}`;
  const truoc = hangDoiThuMuc.get(khoa) ?? Promise.resolve('');
  // Nối vào đuôi hàng đợi và NUỐT lỗi của lượt trước (`catch`) — lượt trước hỏng thì lượt này
  // vẫn phải được chạy, không thì một lỗi mạng làm kẹt luôn thư mục đó tới khi khởi động lại.
  const lan = truoc
    .catch(() => '')
    .then(() => timHoacTaoThuMuc(accessToken, ten, idCha));

  hangDoiThuMuc.set(khoa, lan);
  // Dọn khi đã là lượt cuối, để Map không phình theo số nhân viên.
  void lan
    .catch(() => undefined)
    .finally(() => {
      if (hangDoiThuMuc.get(khoa) === lan) hangDoiThuMuc.delete(khoa);
    });
  return lan;
}

/**
 * Tìm thư mục con theo tên, chưa có thì tạo. Trả về ID.
 *
 * Với scope `drive.file` thì lệnh tìm chỉ thấy thư mục do app tạo — đúng ý: không đụng tới thư
 * mục sẵn có của khách. Gọi qua `taoThuMucNeuChua` để được xếp hàng, đừng gọi thẳng.
 */
async function timHoacTaoThuMuc(
  accessToken: string,
  ten: string,
  idCha: string | null,
): Promise<string> {
  const dieuKien = [
    `name = '${ten.replace(/'/g, "\\'")}'`,
    `mimeType = '${MIME_THU_MUC}'`,
    'trashed = false',
    idCha ? `'${idCha}' in parents` : "'root' in parents",
  ].join(' and ');

  const q = new URLSearchParams({
    q: dieuKien,
    fields: 'files(id)',
    pageSize: '1',
  });
  const timRes = await fetchGoogle(`${DRIVE_FILES}?${q.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const tim = await doc<{ files: { id: string }[] }>(timRes, 'tìm thư mục');
  if (tim.files[0]) return tim.files[0].id;

  const taoRes = await fetchGoogle(`${DRIVE_FILES}?fields=id`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: ten,
      mimeType: MIME_THU_MUC,
      ...(idCha ? { parents: [idCha] } : {}),
    }),
  });
  const tao = await doc<{ id: string }>(taoRes, 'tạo thư mục');
  return tao.id;
}

export interface FileDaTaiLen {
  id: string;
  ten: string;
  mimeType: string;
  kichThuoc: number;
}

/**
 * Tải một file lên thư mục chỉ định (upload kiểu `multipart/related` của Drive).
 *
 * Dựng thân request bằng tay chứ không dùng `FormData`: `FormData` sinh ra
 * `multipart/form-data`, còn Drive đòi `multipart/related` — hai kiểu khác nhau, gửi nhầm là
 * Google trả 400 khó hiểu.
 */
export async function taiFileLen(
  accessToken: string,
  tuyChon: {
    ten: string;
    mimeType: string;
    idThuMuc: string;
    noiDung: Buffer;
  },
): Promise<FileDaTaiLen> {
  // Boundary NGẪU NHIÊN, không phải mốc thời gian: thân request chứa nguyên byte file người
  // dùng đưa lên và không ai quét xem trong đó có chuỗi boundary hay không. Boundary đoán được
  // thì một file dựng có chủ đích chèn được thêm một phần metadata giả (đè `parents`, tức đẩy
  // file sang thư mục khác); mà kể cả không ai cố tình, một PDF vô tình chứa đúng chuỗi đó cũng
  // làm Google parse hỏng với lỗi 400 không đâu vào đâu.
  const bien = `maxv-${randomBytes(16).toString('hex')}`;
  const metadata = JSON.stringify({
    name: tuyChon.ten,
    parents: [tuyChon.idThuMuc],
  });

  const than = Buffer.concat([
    Buffer.from(
      `--${bien}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${bien}\r\nContent-Type: ${tuyChon.mimeType}\r\n\r\n`,
    ),
    tuyChon.noiDung,
    Buffer.from(`\r\n--${bien}--`),
  ]);

  const res = await fetchGoogle(
    `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,mimeType,size`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': `multipart/related; boundary=${bien}`,
      },
      body: than,
    },
  );
  const data = await doc<{
    id: string;
    name: string;
    mimeType: string;
    size?: string;
  }>(res, 'tải file lên');

  return {
    id: data.id,
    ten: data.name,
    mimeType: data.mimeType,
    // Drive trả `size` dạng chuỗi; thiếu thì lấy độ dài đã gửi.
    kichThuoc: Number(data.size ?? tuyChon.noiDung.length),
  };
}

/**
 * Tải nội dung file về (nguyên byte) để backend stream lại cho trình duyệt.
 *
 * PHẢI đi đường này chứ không đưa `webViewLink` cho người dùng bấm: link đó mở giao diện Drive
 * và đòi người xem đăng nhập bằng tài khoản Google CÓ QUYỀN trên file. Kế toán đang đăng nhập
 * app bằng tài khoản maxv, không liên quan tới tài khoản Google của công ty — họ sẽ gặp màn
 * "cần yêu cầu quyền truy cập". Proxy qua backend thì quyền do app quyết định, đúng người đang
 * xem hồ sơ nhân viên là xem được.
 */
export async function layNoiDungFile(
  accessToken: string,
  fileId: string,
  tranByte: number,
): Promise<Buffer> {
  const res = await fetchGoogle(
    `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const chiTiet = await res.text().catch(() => '');
    throw new DriveApiError(
      res.status,
      `Không tải được file từ Drive (HTTP ${res.status}): ${chiTiet.slice(0, 200)}`,
      { maLoi: docMaLoi(chiTiet) },
    );
  }

  // Trần dung lượng cả ở ĐƯỜNG VỀ, không chỉ đường lên. File nằm trên Drive CỦA KHÁCH: sau khi
  // app tải lên 2MB, chính họ mở Drive thay bằng file 2GB lúc nào cũng được — `arrayBuffer()`
  // sẽ nuốt trọn vào RAM của máy chủ. Đọc theo từng khối và dừng ngay khi vượt trần.
  const co = Number(res.headers.get('content-length'));
  if (Number.isFinite(co) && co > tranByte) {
    throw new DriveApiError(
      413,
      `File trên Drive lớn hơn giới hạn ${tranByte} byte.`,
    );
  }

  const khoi: Buffer[] = [];
  let tong = 0;
  for await (const phan of res.body as unknown as AsyncIterable<Uint8Array>) {
    tong += phan.byteLength;
    if (tong > tranByte) {
      throw new DriveApiError(
        413,
        `File trên Drive lớn hơn giới hạn ${tranByte} byte.`,
      );
    }
    khoi.push(Buffer.from(phan));
  }
  return Buffer.concat(khoi);
}

/** Xóa file trên Drive. Coi 404 là đã xong — khách tự xóa tay trước đó cũng là kết quả mong muốn. */
export async function xoaFile(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetchGoogle(
    `${DRIVE_FILES}/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new DriveApiError(
      res.status,
      `Không xóa được file trên Drive (HTTP ${res.status}).`,
    );
  }
}

/**
 * Tham số `state` của OAuth — chống CSRF và mang theo công ty đang kết nối.
 *
 * KHÔNG dùng JWT đăng nhập của app: payload đó khai chặt (userId/role/donViId) cho đúng một
 * mục đích, nhét thêm trường vào là mở đường cho token lẫn lộn giữa hai vai trò. HMAC riêng ở
 * đây ngắn hơn và không thể nhầm với token phiên.
 */
const STATE_HAN_MS = 10 * 60 * 1000;

/**
 * Tiền tố tách miền: cùng một khóa bí mật đang phục vụ hai giao thức (JWT truy cập và state
 * OAuth). Hiện chưa lợi dụng được vì hai định dạng khác nhau rõ (JWT có 1 dấu chấm, `than` có
 * 2), nhưng chỉ cần sau này ai đó thêm một trường vào `than` là ranh giới đó mất, và chữ ký
 * state biến thành cỗ máy ký JWT hộ. Tiền tố cố định làm hai không gian không bao giờ trùng.
 */
const STATE_MIEN = 'drive-state|';

function kyState(thanh: string): string {
  return createHmac('sha256', env.jwtAccessSecret)
    .update(STATE_MIEN + thanh)
    .digest('base64url');
}

export function taoState(donViId: string): string {
  const than = `${donViId}.${Date.now() + STATE_HAN_MS}.${randomBytes(9).toString('base64url')}`;
  return `${Buffer.from(than).toString('base64url')}.${kyState(than)}`;
}

/** Trả `donViId` nếu state hợp lệ và còn hạn; sai/hết hạn -> null. */
export function docState(state: string): string | null {
  const [phanThan, chuKy] = state.split('.');
  if (!phanThan || !chuKy) return null;

  const than = Buffer.from(phanThan, 'base64url').toString();
  const mong = kyState(than);
  // So sánh hằng thời gian: so bằng `===` là để lộ dần chữ ký qua thời gian phản hồi.
  const a = Buffer.from(chuKy);
  const b = Buffer.from(mong);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [donViId, hetHan] = than.split('.');
  if (!donViId || !hetHan || Number(hetHan) < Date.now()) return null;
  return donViId;
}
