import { apiFetch, apiFetchBlob } from "../../../lib/http";

/** Xây `URLSearchParams`, bỏ qua field rỗng/`undefined` — dùng chung cho mọi query GET của module
 * này (tra cứu, tải file, tải thông báo…), kể cả các field CHỈ CẦN KHI CẦN (vd `key`, xem
 * `DvcHoSoDaDongBoParams`). Nhận `object` (không phải `Record<string, ...>`) để nhận thẳng các
 * interface tham số (`DvcTraCuuHoSoParams`…) mà khỏi phải ép kiểu ở nơi gọi. */
function qsBoQuaRong(params: object): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) qs.set(k, v);
  }
  return qs;
}

/** Ảnh captcha + khóa phiên do BE mở với cổng Dịch vụ công. */
export interface DvcCaptchaInfo {
  /** Khóa phiên — phải gửi lại y nguyên khi đăng nhập. */
  key: string;
  /** Data-URL `data:image/png;base64,...` — gắn thẳng vào `<img src>`. */
  image: string;
  /** Chuỗi captcha được giải tự động từ backend (nếu đọc thành công). */
  answer?: string | null;
}

export interface DvcLoginPayload {
  /** Khóa phiên lấy từ `getDvcCaptcha`. */
  key: string;
  /** Tên đăng nhập cổng DVC, thường dạng `<MST>-ql`. */
  tenDN: string;
  /** Mật khẩu THÔ — BE tự mã hóa base64 theo dạng cổng quy định. */
  matKhau: string;
  captcha: string;
}

export interface DvcLoginResult {
  /** Khóa phiên đã đăng nhập — các lượt tra cứu sau dùng lại nó. */
  key: string;
  /** Body cổng trả về. Kiểu `unknown` vì dạng phản hồi của cổng chưa chốt. */
  data: unknown;
}

/** Tài khoản + mật khẩu DVC đã lưu (đã giải mã) của công ty đang chọn — `null` = chưa lưu. */
export interface DvcCredential {
  username: string | null;
  password: string | null;
}

/**
 * GET /api/v1/dvc/captcha → `{ key, image }`.
 *
 * Mỗi lần gọi là BE mở một PHIÊN MỚI với cổng (tải trang login lấy cookie + token CSRF rồi
 * mới lấy ảnh). Nên đừng gọi dồn: cổng chặn tần suất khá gắt, vài lượt liên tiếp là 429.
 *
 * Dùng: `DialogLoginDVC` (queryFn của captchaQuery).
 */
export async function getDvcCaptcha(): Promise<DvcCaptchaInfo> {
  return apiFetch<DvcCaptchaInfo>("/dvc/captcha");
}

/**
 * POST /api/v1/dvc/login → `{ key, data }`.
 *
 * Khác `loginGdt` bên HĐĐT: hàm này KHÔNG tự kết luận đăng nhập thành công hay thất bại.
 * Dạng body cổng trả về khi đúng/sai chưa chốt được, mà BE thì đã đổi mọi lỗi HTTP thành
 * 400 kèm `message` (nên `apiFetch` tự ném). Caller đọc `data` để quyết.
 *
 * Dùng: `DialogLoginDVC` (mutationFn của loginMutation).
 */
export async function loginDvc(body: DvcLoginPayload): Promise<DvcLoginResult> {
  return apiFetch<DvcLoginResult>("/dvc/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * GET /api/v1/dvc/credential → tài khoản + MẬT KHẨU đã lưu (đã giải mã) của công ty đang chọn,
 * để điền sẵn dialog đăng nhập. `{ username: null, password: null }` nếu chưa từng đăng nhập
 * DVC thành công cho công ty này.
 *
 * Dùng: `DialogLoginDVC` (điền sẵn khi mở dialog).
 */
export async function getDvcCredential(): Promise<DvcCredential> {
  return apiFetch<DvcCredential>("/dvc/credential");
}

/** Bảng kết quả tra cứu, đã được BE bóc từ mảnh HTML của cổng. */
export interface DvcBangHoSo {
  /** Tiêu đề cột theo đúng thứ tự cổng trả về; rỗng khi không có kết quả nào. */
  headers: string[];
  /** Mỗi dòng là mảng ô, khớp thứ tự `headers`. */
  rows: string[][];
}

export interface DvcTraCuuHoSoParams {
  /** `yyyy-mm-dd`. */
  tuNgay?: string;
  denNgay?: string;
  maHoSo?: string;
  maToKhai?: string;
}

/**
 * GET /api/v1/dvc/ho-so → `{ headers, rows }`.
 *
 * ĐỌC THẲNG DỮ LIỆU ĐÃ ĐỒNG BỘ trong DB (không gọi cổng, không cần đăng nhập) — xem
 * `dongBoDvc`/`DialogDongBo`. Trả cột ĐỘNG theo đúng cổng trả về lúc đồng bộ, không ép vào bộ cột
 * khai sẵn trong `config.ts`.
 */
export async function traCuuHoSoDvc(params: DvcTraCuuHoSoParams): Promise<DvcBangHoSo> {
  return apiFetch<DvcBangHoSo>(`/dvc/ho-so?${qsBoQuaRong(params).toString()}`);
}

/** Một lượt bấm nút "Đồng bộ" đã chạy — khớp 1-1 bảng `dvc_dong_bo_log` (snake_case), xem
 * `DialogDongBo`. */
export interface DvcDongBoLog {
  id: string;
  loai: string;
  tu_ngay: string;
  den_ngay: string;
  tong_ho_so: number;
  da_co_san: number;
  dong_bo_xong: number;
  loi: number;
  trang_thai: "done" | "partial";
  dien_giai: string | null;
  created_at: string;
}

export interface DvcDongBoParams {
  /** Khóa phiên cổng DVC ĐÃ ĐĂNG NHẬP — đồng bộ vẫn gọi cổng thật, khác tra cứu (đọc DB). */
  key: string;
  /** `yyyy-mm-dd`. */
  tuNgay: string;
  denNgay: string;
}

/**
 * POST /api/v1/dvc/dong-bo → dòng lịch sử vừa ghi (`DvcDongBoLog`).
 *
 * Chạy ĐỒNG BỘ phía BE (blocking) — có thể mất một lúc nếu nhiều hồ sơ mới, xem
 * `dvc-dong-bo.service.ts`. Dùng: `DialogDongBo` (nút "Đồng bộ").
 */
export async function dongBoDvc(params: DvcDongBoParams): Promise<DvcDongBoLog> {
  return apiFetch<DvcDongBoLog>("/dvc/dong-bo", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** GET /api/v1/dvc/dong-bo/lich-su → lịch sử đồng bộ (mới nhất trước). Dùng: `DialogDongBo`. */
export async function layLichSuDongBoDvc(): Promise<DvcDongBoLog[]> {
  return apiFetch<DvcDongBoLog[]>("/dvc/dong-bo/lich-su");
}

/** DELETE /api/v1/dvc/dong-bo/lich-su/:id → xóa 1 dòng lịch sử (chỉ bản ghi log). Dùng:
 * `DialogDongBo`. */
export async function xoaLichSuDongBoDvc(id: string): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>(`/dvc/dong-bo/lich-su/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** DELETE /api/v1/dvc/dong-bo/lich-su → xóa TOÀN BỘ lịch sử đồng bộ (chỉ bản ghi log). Dùng:
 * `DialogDongBo`. */
export async function xoaTatCaLichSuDongBoDvc(): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>("/dvc/dong-bo/lich-su", { method: "DELETE" });
}

export interface DvcHoSoParams {
  /** Khóa phiên đã đăng nhập. */
  key: string;
  /** Mã hồ sơ — cột "Mã giao dịch" của bảng kết quả (giá trị thật là "Mã hồ sơ" bên cổng). */
  maHoSo: string;
}

export interface DvcHoSoDaDongBoParams {
  /** Khóa phiên đã đăng nhập — CHỈ cần khi hồ sơ CHƯA được đồng bộ/cache: BE đọc DB trước
   * (`dvc-dong-bo.service.ts`), thiếu mới cần `key` để gọi cổng thật. */
  key?: string;
  /** Mã hồ sơ — cột "Mã giao dịch" của bảng kết quả (giá trị thật là "Mã hồ sơ" bên cổng). */
  maHoSo: string;
}

/**
 * GET /api/v1/dvc/ho-so/file → tải file XML của một hồ sơ, qua BE proxy (cổng không mở
 * CORS). Trả `Blob` để FE tự lưu xuống máy.
 *
 * Dùng: `taiFileHoSo` (cột "Tải file").
 */
export function taiFileHoSoDvc({ key, maHoSo }: DvcHoSoDaDongBoParams): Promise<Blob> {
  return apiFetchBlob(`/dvc/ho-so/file?${qsBoQuaRong({ key, maHoSo }).toString()}`);
}

/**
 * GET /api/v1/dvc/ho-so/tai-lieu-dkem → danh sách tài liệu đính kèm của một hồ sơ.
 *
 * Trả JSON THÔ — hình dạng thật của cổng chưa xác nhận (chưa có mẫu response), BE không ép
 * kiểu nên FE cũng để `unknown`, xem `TaiLieuDinhKemDialog` (tự dò cột từ khóa JSON).
 *
 * KHÔNG đọc cache (khác `taiFileHoSoDvc`/`layDanhSachThongBaoDvc`): hình dạng dữ liệu chưa xác
 * nhận nên BE chưa lưu được gì đáng tin — luôn gọi cổng thật, `key` vẫn bắt buộc.
 *
 * Dùng: `TaiLieuDinhKemDialog` (cột "Tệp đính kèm").
 */
export function layTaiLieuDinhKemDvc({ key, maHoSo }: DvcHoSoParams): Promise<unknown> {
  const qs = new URLSearchParams({ key, maHoSo });
  return apiFetch<unknown>(`/dvc/ho-so/tai-lieu-dkem?${qs.toString()}`);
}

/**
 * Một dòng "Danh sách thông báo" của một hồ sơ — BE đã bóc từ HTML trang chi tiết
 * (đối chiếu mẫu ngày 2026-08-19). Cổng KHÔNG có "Số thông báo"/"Người gửi" nên chỉ có
 * đúng 3 trường, khác đặc tả 6 cột ban đầu.
 */
export interface DvcThongBao {
  /** Nội dung/tiêu đề thông báo. */
  tieuDe: string;
  /** Giờ + ngày gửi, dạng thô cổng trả — không parse thành Date (cổng không ghi rõ múi giờ). */
  ngayGui: string;
  /** Truyền vào `taiThongBaoDvc` để tải file thông báo này. */
  idTbao: string;
}

/**
 * GET /api/v1/dvc/ho-so/thong-bao → danh sách thông báo của một hồ sơ.
 *
 * Dùng: `ThongBaoDialog` (cột "Thông báo").
 */
export function layDanhSachThongBaoDvc({
  key,
  maHoSo,
}: DvcHoSoDaDongBoParams): Promise<DvcThongBao[]> {
  return apiFetch<DvcThongBao[]>(`/dvc/ho-so/thong-bao?${qsBoQuaRong({ key, maHoSo }).toString()}`);
}

export interface DvcThongBaoFileParams extends DvcHoSoDaDongBoParams {
  idTbao: string;
}

/**
 * GET /api/v1/dvc/ho-so/thong-bao/file → tải file của một thông báo, qua BE proxy. Trả
 * `Blob` để FE tự lưu xuống máy, cùng quy ước với `taiFileHoSoDvc`.
 *
 * Dùng: `taiThongBao` (nút tải trong `ThongBaoDialog`).
 */
export function taiThongBaoDvc({ key, maHoSo, idTbao }: DvcThongBaoFileParams): Promise<Blob> {
  const qs = qsBoQuaRong({ key, maHoSo, idTbao });
  return apiFetchBlob(`/dvc/ho-so/thong-bao/file?${qs.toString()}`);
}
