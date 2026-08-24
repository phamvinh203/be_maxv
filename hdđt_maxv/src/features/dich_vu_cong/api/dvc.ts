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

/** Khóa cache của bảng lịch sử đồng bộ — để cạnh fetcher vì cả `DialogDongBo` (chủ sở hữu bảng)
 * lẫn `DvcPage` (nơi theo dõi lượt nền) đều phải làm mới nó. */
export const QUERY_KEY_LICH_SU_DVC = ["dvc", "dong-bo", "lich-su"];

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
 * Tiến độ MỘT lượt đồng bộ chạy nền ở BE — khớp `DvcDongBoTienDo` bên `dvc-dong-bo.service.ts`.
 *
 * `tongHoSo === 0` nghĩa là BE còn đang tra cứu cổng, CHƯA biết mẫu số -> thanh tiến độ phải chạy
 * vô định, không được vẽ 0%.
 */
export interface DvcDongBoTienDo {
  active: boolean;
  tongHoSo: number;
  /** Ba bộ đếm này cộng lại là số hồ sơ đã xử lý xong — tử số thanh tiến độ, xem `ToastTienDoDongBo`. */
  daCoSan: number;
  dongBoXong: number;
  loi: number;
  maHoSoDangLam: string;
  /** Số thông báo đang được bù ở cuối lượt; `0` = không ở pha bù. Xem `buThongBaoHong` bên BE. */
  dangBuLai: number;
  /** Số hồ sơ cổng khai có mà lượt này không lấy về được — >0 thì toast phải báo VÀNG, không
   * được hiện "Đồng bộ xong" màu xanh. Xem `DvcDongBoTienDo` bên BE. */
  thieuHoSo: number;
  /** Định danh lượt — `theoDoiDongBoDvc` dùng để biết mình còn bám đúng lượt hay không. */
  startedAt: number;
  error?: string;
  /** `DVC_AUTO_LOGIN_FAILED` khi khóa phiên chết hẳn — xem `boKhoaNeuPhienChet` bên `DvcPage`. */
  code?: string;
}

/**
 * POST /api/v1/dvc/dong-bo → BẮT ĐẦU lượt đồng bộ chạy nền, trả tiến độ ngay (~50ms).
 *
 * KHÔNG còn blocking như trước: từ khi mọi call cổng đi qua pacer, một khoảng vài chục hồ sơ mất
 * hàng phút — quá ngưỡng timeout của reverse proxy. Theo dõi tiếp bằng `layTienDoDongBoDvc`, xem
 * `theoDoiDongBoDvc`. Dùng: `DialogDongBo` (nút "Đồng bộ").
 */
export async function dongBoDvc(params: DvcDongBoParams): Promise<DvcDongBoTienDo> {
  return apiFetch<DvcDongBoTienDo>("/dvc/dong-bo", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * GET /api/v1/dvc/dong-bo/tien-do → tiến độ lượt đang chạy của công ty đang chọn; `null` nếu công
 * ty này chưa từng chạy lượt nào.
 *
 * KHÔNG cần khóa phiên cổng: chỉ đọc trạng thái trong RAM của BE. Dùng: vòng poll, và lúc mở lại
 * trang để NỐI LẠI lượt đang chạy.
 */
export async function layTienDoDongBoDvc(): Promise<DvcDongBoTienDo | null> {
  return apiFetch<DvcDongBoTienDo | null>("/dvc/dong-bo/tien-do");
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

/** Một chỉ tiêu đã bóc từ XML tờ khai mẫu CHƯA có layout riêng — `nhan` là tên thẻ XML thô (xem
 * `DvcChiTietToKhai` nhánh `loai: "raw"`). */
export interface DvcChiTieuToKhai {
  nhan: string;
  giaTri: string;
}

/** Tên thẻ `<ctNN>` hợp lệ trên mẫu in 01/GTGT — mirror của `CtTagGtgt01` bên BE (`toKhaiXml.ts`).
 * Dùng làm kiểu cho `giaTri`/`thue` ở `HANG` trong `ToKhaiGtgt01Form` để gõ sai tên thẻ báo lỗi
 * biên dịch thay vì render lặng lẽ một ô trống. */
export type CtTagGtgt01 =
  | "ct21"
  | "ct22"
  | "ct23"
  | "ct24"
  | "ct23a"
  | "ct24a"
  | "ct25"
  | "ct26"
  | "ct27"
  | "ct28"
  | "ct29"
  | "ct30"
  | "ct31"
  | "ct32"
  | "ct33"
  | "ct32a"
  | "ct34"
  | "ct35"
  | "ct36"
  | "ct37"
  | "ct38"
  | "ct39a"
  | "ct40a"
  | "ct40b"
  | "ct40"
  | "ct41"
  | "ct42"
  | "ct43";

/** Dữ liệu mẫu 01/GTGT đã bóc — đủ để `ToKhaiGtgt01Form` dựng lại đúng layout mẫu in (quốc hiệu,
 * khối thông tin NNT, bảng chỉ tiêu, khối ký), xem `ChiTietGtgt01` bên BE. */
export interface DvcChiTietGtgt01 {
  tenTKhai: string;
  moTaBMau: string;
  tenNganhNghe: string;
  /** Đã dựng sẵn dạng "Quý 2 năm 2026". */
  kyTinhThue: string;
  laLanDau: boolean;
  soLanBoSung: number;
  tenNNT: string;
  mst: string;
  tenCQTNoiNop: string;
  nguoiKy: string;
  /** `yyyy-mm-dd` thô — tự format khi hiển thị. */
  ngayKy: string | null;
  kyDienTuBoi: string | null;
  /** ISO datetime thô của chữ ký số. */
  ngayKyDienTu: string | null;
  /** `{ ct22: 29826193, ... }` — thẻ vắng mặt hoặc `null` đều nghĩa là không có dữ liệu, khác 0. */
  ct: Partial<Record<CtTagGtgt01, number | null>>;
}

/** Tên thẻ `<ctNN>` hợp lệ trên mẫu in 05/KK-TNCN — mirror của `CtTagTncn05` bên BE. Mã chỉ tiêu
 * trên mẫu chạy liền [16]..[32] nên danh sách này liền mạch, khác 01/GTGT có thêm hậu tố a/b. */
export type CtTagTncn05 =
  | "ct16"
  | "ct17"
  | "ct18"
  | "ct19"
  | "ct20"
  | "ct21"
  | "ct22"
  | "ct23"
  | "ct24"
  | "ct25"
  | "ct26"
  | "ct27"
  | "ct28"
  | "ct29"
  | "ct30"
  | "ct31"
  | "ct32";

/** Dữ liệu mẫu 05/KK-TNCN đã bóc — đủ để `ToKhaiTNCN05Form` dựng lại đúng layout mẫu in, xem
 * `ChiTietTncn05` bên BE. Khối [06]..[15] (địa chỉ, đại lý thuế) là thứ 01/GTGT KHÔNG có. */
export interface DvcChiTietTncn05 {
  tenTKhai: string;
  moTaBMau: string;
  /** Đã dựng sẵn dạng "Quý 3 năm 2025". */
  kyTinhThue: string;
  laLanDau: boolean;
  soLanBoSung: number;
  tenNNT: string;
  mst: string;
  diaChi: string;
  phuongXa: string;
  tinhTP: string;
  dienThoai: string;
  fax: string;
  email: string;
  tenDaiLyThue: string;
  mstDaiLyThue: string;
  hopDongDaiLySo: string;
  /** `yyyy-mm-dd` thô hoặc rỗng — hợp đồng đại lý thuế thường bỏ trống. */
  hopDongDaiLyNgay: string;
  /** Ô đánh dấu [15] — có đơn vị hạch toán phụ thuộc ở tỉnh khác hay không. */
  phanBoThue: boolean;
  nguoiKy: string;
  /** `yyyy-mm-dd` thô — tự format khi hiển thị. */
  ngayKy: string | null;
  kyDienTuBoi: string | null;
  /** ISO datetime thô của chữ ký số. */
  ngayKyDienTu: string | null;
  /** `{ ct16: 4, ct21: 105000000, ... }` — thẻ vắng mặt hoặc `null` = không có dữ liệu, khác 0. */
  ct: Partial<Record<CtTagTncn05, number | null>>;
}

/** Kết quả bóc XML tờ khai của một hồ sơ, xem `layChiTietToKhai` bên BE. */
export type DvcChiTietToKhai =
  | { loai: "gtgt01"; duLieu: DvcChiTietGtgt01; xmlTho: string }
  | { loai: "tncn05"; duLieu: DvcChiTietTncn05; xmlTho: string }
  | { loai: "raw"; chiTieu: DvcChiTieuToKhai[]; xmlTho: string };

/**
 * GET /api/v1/dvc/ho-so/to-khai-chi-tiet → chỉ tiêu đã bóc từ XML tờ khai của một hồ sơ, qua BE
 * proxy — cùng cơ chế cache-hoặc-gọi-cổng với `taiFileHoSoDvc`.
 *
 * Dùng: `ToKhaiXmlDialog` (click cột "Tờ khai / Phụ lục").
 */
export function layChiTietToKhaiDvc({
  key,
  maHoSo,
}: DvcHoSoDaDongBoParams): Promise<DvcChiTietToKhai> {
  return apiFetch<DvcChiTietToKhai>(
    `/dvc/ho-so/to-khai-chi-tiet?${qsBoQuaRong({ key, maHoSo }).toString()}`,
  );
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
