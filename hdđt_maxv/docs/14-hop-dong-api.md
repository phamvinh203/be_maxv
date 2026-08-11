# 14 — Hợp đồng API với be_maxv

Tài liệu đối chiếu giữa frontend `hdđt_maxv` và backend `be_maxv`.

**Nguồn:** khai báo route trong `be_maxv/src/routes/` + hàm client trong `hdđt_maxv/src/features/*/api/`. Kiểu dữ liệu lấy từ interface TypeScript phía frontend.

---

## 14.1. Quy ước chung

### Tiền tố

| Nhóm | Prefix | File route BE |
|---|---|---|
| Xác thực | `/api/v1/auth` | `routes/auth.route.ts` |
| Công ty | `/api/v1/companies` | `routes/company.route.ts` |
| Hóa đơn điện tử | `/api/v1/gdt` | `routes/hddt/gdt.route.ts` |

Frontend cấu hình tiền tố qua `API_BASE` (mặc định `/api/v1`), nên các bảng dưới đây ghi path **không kèm tiền tố**.

### Hai loại xác thực

| Cơ chế | Gửi thế nào | Bảo vệ gì |
|---|---|---|
| **Phiên ứng dụng** | Cookie httpOnly, trình duyệt tự gửi (`credentials: "include"`) | Hầu hết endpoint. Quyết định người dùng là ai và **database công ty nào** |
| **Token Thuế điện tử** | Header `X-Gdt-Token`, code truyền tay | Chỉ các endpoint backend cần gọi ra GDT |

Backend đọc `donViId` từ JWT trong cookie để chọn database tenant. Nghĩa là **cùng một URL trả dữ liệu khác nhau tùy công ty đang chọn** — nền tảng của quy ước `queryKey` ở [chương 5](05-quan-ly-du-lieu-tanstack-query.md).

### Hai dạng response

```ts
// Dạng 1 — có envelope (auth, companies): dùng apiFetchData
{ "success": true, "data": { … }, "message": "…" }

// Dạng 2 — object thô (gdt/*): dùng apiFetch
{ "active": true, "page": 3, … }
```

Cột "Client" trong các bảng dưới cho biết dùng hàm nào.

### Mã lỗi

| Mã | Nghĩa | Frontend xử lý |
|---|---|---|
| 400 | Sai tham số / lỗi validate | Backend **không trả `message`** — FE hiện thông báo chung |
| 401 | Chưa đăng nhập / access hết hạn | `apiFetch` tự gọi `/auth/refresh` rồi thử lại 1 lần |
| 403 | Không có quyền / thiếu `donViId` | **Không tự phục hồi** — xem cảnh báo ở [chương 6](06-context-toan-cuc.md#đổi-công-ty) |
| 404 | Không tìm thấy | Ném `ApiError` |
| 409 | Xung đột (email trùng, xin OTP quá nhiều) | Gắn lỗi vào đúng ô nhập |
| 429 | Vượt giới hạn tần suất | Route auth siết chặt (`STRICT_AUTH_LIMIT`) |

---

## 14.2. Xác thực — `/auth`

| Method | Path | Auth | Client | Hàm FE |
|---|---|---|---|---|
| POST | `/auth/register` | — | `apiFetchData` | `register()` |
| POST | `/auth/login` | — | `apiFetchData` | `login()` |
| POST | `/auth/forgot-password` | — | `apiFetchData` | `forgotPassword()` |
| POST | `/auth/reset-password` | — | `apiFetchData` | `resetPassword()` |
| GET | `/auth/me` | cookie | `apiFetchData` | `getMe()` |
| POST | `/auth/refresh` | cookie refresh | fetch trần | nội bộ `lib/http.ts` |
| POST | `/auth/logout` | cookie | `apiFetch` | `logout()` |

Bốn endpoint đầu bị siết tần suất bằng `STRICT_AUTH_LIMIT` ở backend — chống dò email và dò mã OTP.

### POST `/auth/register`

```ts
// Body
interface RegisterPayload {
  hoTen: string;    // ≤ 100 ký tự, không xuống dòng
  email: string;
  sdt: string;      // 9–11 chữ số
  password: string; // ≥ 8 ký tự, có ít nhất 1 chữ và 1 số
}

// data
interface RegisterResult {
  id: string;
  hoTen: string;
  email: string;
  sdt: string | null;
}
```

**Không cấp cookie phiên.** Đăng ký xong người dùng vẫn chưa đăng nhập — frontend tự điều hướng về `/login`.

Lỗi: `409` email đã tồn tại · `400` lỗi validate (không kèm `message`).

> Luật kiểm tra ở frontend (`validators/rules.ts`) phải khớp với zod ở backend. Lệch nhau → người dùng nhận 400 khó hiểu.

### POST `/auth/login`

```ts
// Body
{ email: string; password: string }

// data
interface SessionData {
  user: { id: string; hoTen: string; email: string; role: string };
  /** Toàn bộ công ty/MST user được phép thao tác. */
  companies: AuthCompany[];
  /** Công ty đang active nhúng trong JWT; null nếu chưa xác định rõ. */
  activeDonViId: string | null;
}

interface AuthCompany {
  id: string;
  maSoThue: string;
  slug: string;
  tenDonVi: string;
  status: string;
}
```

**Tác dụng phụ:** server đặt hai cookie httpOnly — access (ngắn hạn) và refresh (7 ngày). Không trả token trong body.

### GET `/auth/me`

Trả cùng `SessionData` như `/auth/login`. Frontend gọi **một lần khi tải trang** để khôi phục phiên.

`401` khi chưa đăng nhập — đây là kết quả bình thường, không phải lỗi cần báo.

### POST `/auth/refresh`

Gọi bằng `fetch` trần trong `lib/http.ts`, **không** qua `apiFetch` (tránh đệ quy).

| Kết quả | Nghĩa | FE làm gì |
|---|---|---|
| `200` | Đã đặt cookie access mới | Thử lại request gốc |
| `401` / `403` | Refresh hết hạn — hết phiên thật | Gọi `onSessionExpired()` → đá về `/login` |
| khác (502…) | Sự cố tạm thời | **Giữ nguyên phiên**, trả 401 gốc |

Phân biệt ba trường hợp này là bắt buộc — xem [chương 4, mục 4.3](04-tang-giao-tiep-api.md#ba-kết-cục-của-tryrefresh--đừng-gộp-lại).

### POST `/auth/forgot-password`

```ts
// Body
{ email: string }
```

Gửi mã OTP **6 chữ số**, hiệu lực **10 phút** (hằng số `OTP_LENGTH`, `OTP_TTL_MINUTES` ở `validators/rules.ts`, khớp `be_maxv/src/constants/auth.ts`).

Lỗi: `404` email chưa đăng ký · `401` tài khoản chưa kích hoạt · `409` xin mã quá nhiều lần trong 1 giờ.

### POST `/auth/reset-password`

```ts
// Body
interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}
```

**Tác dụng phụ:** server xóa cookie phiên và vô hiệu **mọi** refresh token cũ — phải đăng nhập lại.

> Mọi lý do thất bại (sai mã / hết hạn / quá số lần) trả **cùng một** thông báo. Chủ ý bảo mật: không cho biết mã đã tồn tại hay chưa.

---

## 14.3. Công ty — `/companies`

| Method | Path | Quyền | Client | Hàm FE |
|---|---|---|---|---|
| GET | `/companies` | đăng nhập | `apiFetchData` | `listCompanies()` |
| POST | `/companies` | **OWNER** | `apiFetchData` | `createCompany()` |
| PUT | `/companies/:id` | **OWNER** | `apiFetchData` | `updateCompany()` |
| DELETE | `/companies/:id` | **OWNER** | `apiFetchData` | `deleteCompany()` |
| POST | `/companies/:id/switch` | đăng nhập | `apiFetchData` | `switchCompany()` |

### Endpoint backend chưa dùng ở frontend này

Backend còn bốn endpoint quản lý nhân viên mà `hdđt_maxv` **chưa dùng**:

| Method | Path | Quyền |
|---|---|---|
| POST | `/companies/invite` | OWNER |
| GET | `/companies/employees` | đăng nhập |
| GET | `/companies/invites` | đăng nhập |
| PUT | `/companies/employees/:userId/access` | OWNER |

Chúng phục vụ luồng mời nhân viên và cấp quyền theo MST. Frontend hiện chỉ hiển thị vai trò qua `user.role === "OWNER"` để ẩn/hiện nút thêm-sửa-xóa công ty.

### GET `/companies`

```ts
// data: CompanyDetail[]
interface CompanyDetail extends AuthCompany {
  diaChi: string | null;
  sdt: string | null;
  loaiHinhKinhDoanh: string | null;
}
```

Owner thấy toàn bộ công ty của mình; nhân viên chỉ thấy MST được cấp.

### POST `/companies`

```ts
// Body
interface CreateCompanyPayload {
  tenCongTy: string;
  maSoThue: string;          // MST_REGEX: 10 số, tùy chọn đuôi chi nhánh -XXX
  diaChi: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}
// + cờ điều khiển
{ activate: boolean }

// data
{ company: CompanyDetail; activeDonViId?: string }
```

**Cờ `activate` quyết định hành vi:**

| `activate` | Khi nào dùng | Server làm gì |
|---|---|---|
| `true` | Công ty **đầu tiên** của tài khoản | Đặt cookie access mới nhúng `donViId`, trả `activeDonViId` |
| `false` | Thêm MST từ màn Cài đặt | **Không đụng** cookie hiện tại |

Thiếu `activate: true` ở công ty đầu tiên thì `donViId` không có trong token, và **mọi endpoint theo tenant trả 403**.

**Tác dụng phụ:** server tạo database tenant riêng cho MST này.

### PUT `/companies/:id`

```ts
// Body — KHÔNG có maSoThue
interface UpdateCompanyPayload {
  tenCongTy?: string;
  diaChi?: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}
```

MST **không sửa được** sau khi tạo, vì nó gắn với tên database tenant. Giao diện khóa ô này ở chế độ sửa.

### DELETE `/companies/:id`

```ts
// Body — chuỗi xác nhận
{ maSoThue: string }

// data
{ id: string; activeDonViId: string | null }
```

> ⚠️ **XÓA VĨNH VIỄN.** Server `DROP` luôn database tenant rồi xóa bản ghi. Không hoàn tác, không có bản sao lưu.

`maSoThue` trong body là chuỗi người dùng gõ để xác nhận — **server so lại**, nên hộp thoại ở frontend chỉ là lớp trải nghiệm, không phải lớp bảo vệ.

`activeDonViId` trả về là công ty đang làm việc **sau khi xóa**:
- Vừa xóa công ty đang dùng → server đã đặt cookie mới, frontend đồng bộ state.
- `null` → không còn công ty nào.

### POST `/companies/:id/switch`

```ts
// data
{ activeDonViId: string }
```

**Tác dụng phụ:** server đặt cookie access mới nhúng `donViId` mới. Từ lời gọi tiếp theo, mọi endpoint tenant trỏ vào database công ty mới.

---

## 14.4. Hóa đơn điện tử — `/gdt`

### Đăng nhập GDT

| Method | Path | Auth app | Token GDT | Hàm FE |
|---|---|:--:|:--:|---|
| GET | `/gdt/captcha` | ✖ | ✖ | `getCaptcha()` |
| POST | `/gdt/login` | ✖ | ✖ | `loginGdt()` |

```ts
// GET /gdt/captcha → CaptchaInfo
interface CaptchaInfo {
  key: string;
  /** Chuỗi SVG của ảnh captcha */
  content: string;
}

// POST /gdt/login
interface LoginPayload {
  mst: string;      // MST đóng vai trò tên đăng nhập trên GDT
  password: string;
  captcha: string;  // mã người dùng gõ
  key: string;      // key từ getCaptcha
}
interface LoginResult {
  token?: string;
  message?: string;
}
```

Hai endpoint duy nhất trong nhóm `/gdt` **không cần đăng nhập ứng dụng**.

Client kiểm tra thêm ở phía mình:

```ts
if (!data.token) {
  throw new Error(data.message || "Đăng nhập thất bại");
}
```

Vì backend có thể trả `200` kèm `message` lỗi thay vì mã lỗi HTTP.

### Đọc dữ liệu đã lưu (không gọi GDT)

| Method | Path | Token GDT | Hàm FE |
|---|---|:--:|---|
| GET | `/gdt/invoices/:direction/saved` | ✖ | `getSavedInvoices()` |
| GET | `/gdt/invoices/:direction/saved-details` | ✖ | `getSavedDetails()` |
| GET | `/gdt/invoices/:direction/saved-detail/:id` | ✖ | `getSavedInvoiceDetailById()` |
| GET | `/gdt/invoices/:direction/detail-complete` | ✖ | `getDetailComplete()` |
| GET | `/gdt/stats` | ✖ | `getSystemStats()` |
| GET | `/gdt/sync/history` | ✖ | `getSyncHistory()` |

`:direction` = `purchase` (mua vào) hoặc `sold` (bán ra).

#### Tham số lọc dùng chung

Dựng bởi `buildInvoiceParams()`:

| Tham số | Bắt buộc | Ghi chú |
|---|:--:|---|
| `tuNgay` | ✔ | `yyyy-MM-dd` |
| `denNgay` | ✔ | `yyyy-MM-dd` |
| `trangThaiHd` | | mã `tthai` — xem bảng 14.5 |
| `ketQuaHd` | | mã `ttxly` — xem bảng 14.5 |
| `mauHd` | | ký hiệu mẫu số |
| `soSeri` | | ký hiệu hóa đơn |
| `soHd` | | số hóa đơn |
| `mstNguoiBan` | | **chỉ** `purchase` |
| `mstNguoiMua` | | **chỉ** `sold` |

Tên tham số MST đối tác **đổi theo chiều**:

```ts
const PARTNER_PARAM: Record<InvoiceDirection, string> = {
  purchase: "mstNguoiBan",
  sold: "mstNguoiMua",
};
```

Client nhận `mstDoiTac` chung rồi tự đổi tên. Luôn dùng `buildInvoiceParams` thay vì tự ghép query string.

#### GET `/gdt/invoices/:direction/saved`

```ts
// Response thô
{ total?: number; datas?: Record<string, unknown>[] }
```

Client chuẩn hóa trường đối tác trước khi trả về:

```ts
/** Field GDT trả về cho MST/tên/địa chỉ đối tác, khác tên theo chiều hóa đơn. */
const PARTNER_FIELD: Record<InvoiceDirection, { mst: string; ten: string; dchi: string }> = {
  purchase: { mst: "nbmst", ten: "nbten", dchi: "nbdchi" },  // người bán
  sold:     { mst: "nmmst", ten: "nmten", dchi: "nmdchi" },  // người mua
};
```

Các trường chính trong `InvoiceRaw` (giữ nguyên tên GDT):

| Trường | Nghĩa |
|---|---|
| `id` | Khóa chính |
| `khmshdon` | Ký hiệu mẫu số hóa đơn |
| `khhdon` | Ký hiệu hóa đơn |
| `shdon` | Số hóa đơn |
| `tdlap` | Thời điểm lập |
| `nky` | Ngày ký |
| `tthai` | Trạng thái hóa đơn |
| `ttxly` | Kết quả kiểm tra |
| `dvtte` | Mã ngoại tệ |
| `tgia` | Tỷ giá |
| `tgtcthue` | Tổng tiền chưa thuế |
| `tgtthue` | Tổng tiền thuế |
| `ttcktmai` | Tổng chiết khấu thương mại |
| `tgtphi` | Tổng phí |
| `tgtttbso` | Tổng thanh toán bằng số |
| **`tt_tai`** | **Trạng thái tải chi tiết** — `"OK"` \| `"error"` \| thiếu |

`tt_tai` là trường do **backend của dự án này** thêm vào, không phải của GDT.

> **Quy ước ngày giờ — mốc trên CHỨNG TỪ.** Ngày của hóa đơn (`tdlap`, `nky` ở danh sách đã lưu; `tdlap` ở bản đồ thay thế; các field ngày trong payload `detail` — danh sách chính xác ở `DETAIL_DATE_FIELDS` trong `gdt.service.ts`) được BE trả dạng `yyyy-MM-ddTHH:mm:ss` theo **giờ Việt Nam, KHÔNG hậu tố múi giờ**.
>
> Lý do: GDT trả UTC có hậu tố `Z`, nên chuỗi cắt ra `yyyy-MM-dd` là NGÀY UTC — lệch 1 ngày với mọi hóa đơn lập trước 07:00 giờ VN. Ngày trên chứng từ không được đổi theo múi giờ máy chủ hay máy người xem, nên BE ghim `+07:00` ở cả ba hướng: đọc từ GDT (`toDate`), dựng khoảng lọc (`vnDayStart`/`vnDayEnd`) và trả ra FE (`toVnWallClock`/`normalizeDetailDates`). Cột `detail` trong DB vẫn lưu payload GDT gốc — chuẩn hóa chỉ diễn ra ở biên trả về. Phía FE, `vnDateParts` (`features/hddt/dateUtils.ts`) là nơi duy nhất biết định dạng này; `formatDateVN`, `formatDateIso` và `invoiceDateLine` đều dựng trên nó.
>
> **Không áp cho mốc SỰ KIỆN** — `created_at`/`lastSyncAt`/`tu_ngay`/`den_ngay` của lịch sử đồng bộ (`/gdt/sync/history`, `/gdt/stats`) vẫn là ISO có `Z`: đó là thời điểm hệ thống chạy, không phải dữ liệu trên chứng từ, nên hiển thị theo giờ máy người xem là đúng.

#### GET `/gdt/invoices/:direction/saved-details`

```ts
{ datas?: Record<string, unknown>[] }
```

Trả **payload GDT gốc** của từng hóa đơn, gồm mảng hàng hóa `hdhhdvu` và mảng thuế suất `thttltsuat`. Rất nặng — client đặt `staleTime` 5 phút.

#### GET `/gdt/invoices/:direction/saved-detail/:id`

```ts
interface SavedInvoiceDetail {
  found: boolean;
  /** Payload GDT gốc — null nếu hóa đơn chưa tải chi tiết. */
  detail: Record<string, unknown> | null;
}
```

Phân biệt hai trường hợp: `404` = không có hóa đơn với id đó · `detail: null` = có hóa đơn nhưng chưa tải chi tiết.

#### GET `/gdt/invoices/:direction/detail-complete`

```ts
interface DetailCompleteStatus {
  total: number;
  /** Số hóa đơn có tt_tai != "OK" */
  missing: number;
}
```

Cổng chặn cho nút xuất file — chỉ cho xuất khi `missing === 0` ở **cả hai chiều**.

#### GET `/gdt/stats`

```ts
interface SystemStats {
  /** Số hóa đơn mua vào đã lưu (vct60view). */
  purchase: number;
  /** Số hóa đơn bán ra đã lưu (vct50view). */
  sold: number;
  /** Thời điểm đồng bộ gần nhất (ISO) hoặc null. */
  lastSyncAt: string | null;
}
```

#### GET `/gdt/sync/history`

```ts
// SyncLog[]
interface SyncLog {
  id: string;
  tu_ngay: string;
  den_ngay: string;
  direction: "all" | "purchase" | "sold";
  loai: "all" | "except_ctt" | "only_ctt";
  /** Tổng hóa đơn GDT báo có trong khoảng. */
  tong: number;
  /** Số hóa đơn thực sự đã lưu vào DB. */
  da_luu: number;
  trang_thai: "done" | "partial";
  dien_giai: string | null;
  created_at: string;
}
```

Trường `dien_giai` theo khuôn `"<Hành động> hóa đơn <chiều> — <lý do>"`. Frontend đọc nó qua `syncLogText.ts` — **nơi duy nhất** biết khuôn này:

```ts
/** Khớp tiền tố hành động của các dòng ghi theo khuôn MỚI, kèm dấu gạch ngăn lý do (nếu có). */
const ACTION_PREFIX = /^(?:Đồng bộ|Cập nhật) hóa đơn (?:đầu vào|đầu ra)(?: — )?/;
```

Nếu backend đổi cách ghi `dien_giai`, chỉ phải sửa file đó.

### Tác vụ nền

| Method | Path | Token GDT | Hàm FE |
|---|---|:--:|---|
| POST | `/gdt/invoices/:direction/update-run` | **✔** | `startUpdateRun()` |
| GET | `/gdt/invoices/:direction/update-run/status` | ✖ | `getUpdateRunStatus()` |
| POST | `/gdt/invoices/:direction/detail-run` | **✔** | `startDetailRun()` |
| GET | `/gdt/invoices/:direction/detail-run/status` | ✖ | `getDetailRunStatus()` |
| POST | `/gdt/sync/run` | **✔** | `startSyncRun()` |
| GET | `/gdt/sync/run/status` | ✖ | `getSyncRunStatus()` |
| POST | `/gdt/sync/run/cancel` | ✖ | `cancelSyncRun()` |

**Mẫu chung:** `POST` khởi động (cần token GDT vì backend sẽ gọi ra GDT) trả tiến độ ngay sau ~50ms; `GET status` hỏi tiến độ (chỉ đọc bộ nhớ backend, không cần token).

#### POST `/gdt/invoices/:direction/update-run`

Tham số lọc trên query string. Header `X-Gdt-Token`.

```ts
interface UpdateRunStatus {
  active: boolean;
  /** Pha đang chạy; "" khi đã xong. */
  phase: "list" | "detail" | "";
  page: number;
  rows: number;
  saved: number;
  total: number;
  /** "thường" | "máy tính tiền" — nguồn GDT đang quét, chỉ để hiển thị. */
  source: string;
  partial: boolean;
  message: string;
  detail: { total: number; done: number; ok: number; err: number; authExpired?: boolean };
  startedAt: number;
  finishedAt?: number;
  error?: string;
}
```

Một lượt gồm **hai pha** (`list` → `detail`) nhưng dùng chung một trạng thái, nên frontend chỉ cần một vòng poll.

#### POST `/gdt/invoices/:direction/detail-run`

```ts
interface DetailRunStatus {
  active: boolean;
  total: number;
  done: number;
  ok: number;
  err: number;
  /** true nếu lượt dừng sớm vì token GDT hết hạn. */
  authExpired?: boolean;
}
```

Backend **bỏ qua** hóa đơn đã có `tt_tai = "OK"`, và **thay thế** lượt cũ nếu đang chạy.

#### POST `/gdt/sync/run`

```ts
// Body
interface SyncRequest {
  tuNgay: string;   // yyyy-MM-dd
  denNgay: string;
  direction: "all" | "purchase" | "sold";
  loai: "all" | "except_ctt" | "only_ctt";  // ctt = hóa đơn máy tính tiền
}

// Response
interface SyncRunStatus {
  active: boolean;
  /** Bước đang chạy, vd "Bán ra (máy tính tiền) 2026-07-01..2026-07-31". */
  phase: string;
  /** Số dòng GDT đã đi qua (chưa trừ trùng). */
  rows: number;
  saved: number;
  daCo: number;
  boSung: number;
  /** Trang hiện tại (GDT không cho biết tổng số trang). */
  page: number;
  startedAt: number;
  finishedAt?: number;
  cancelled?: boolean;
  error?: string;
  /** sync_log đã ghi (1 dòng/chiều) — dùng hiện toast tóm tắt. */
  results: SyncResult[];
}

interface SyncResult extends SyncLog {
  /** Số hóa đơn GDT trả về đã có sẵn trong DB trước khi đồng bộ. */
  daCo: number;
  /** Số hóa đơn GDT có mà DB thiếu — vừa được bổ sung. */
  boSung: number;
}
```

Backend **từ chối chạy chồng**: đang có lượt thì trả lại chính lượt đó thay vì báo lỗi.

Không có trường phần trăm — GDT không cho biết tổng số trang.

#### POST `/gdt/sync/run/cancel`

Trả `SyncRunStatus` với `cancelled: true`. Backend thoát ở **ranh giới trang gần nhất**, không cắt ngang lời gọi GDT đang bay. Phần đã lấy vẫn giữ và ghi vào lịch sử với trạng thái `partial`.

### Thao tác khác

| Method | Path | Token GDT | Hàm FE |
|---|---|:--:|---|
| POST | `/gdt/render-pdf` | ✖ | `renderInvoicePdf()` |
| GET | `/gdt/invoices/export-xml` | ✔ | `fetchOriginalInvoiceXml()` |
| DELETE | `/gdt/sync/data` | ✖ | `clearSyncData()` |

#### POST `/gdt/render-pdf`

```ts
// Body
{ html: string }
// Response: application/pdf (Blob)
```

Backend giới hạn body **5 MB** (mặc định Fastify là 1 MB — hóa đơn nhiều dòng bằng tiếng Việt UTF-8 dễ vượt). Client đặt hạn thời gian 60 giây.

#### GET `/gdt/invoices/export-xml`

```ts
// Query
{ nbmst: string; khhdon: string; shdon: string; khmshdon: string;
  cttt?: "1"; direction?: "purchase" | "sold" }
// Response: application/xml (text) — hóa đơn XML gốc đã ký số
```

Backend **đọc cache trước**: nếu cột `xml_goc` của hóa đơn đã có thì trả ngay, không chạm cổng thuế (hóa đơn đã ký là bất biến). `direction` quyết định tra ở `vct60view` hay `vct50view`; thiếu thì mặc định `purchase`.

Chưa có cache thì gọi cổng thuế (`/query/invoices/export-xml`, hoặc `/sco-query/...` khi `cttt=1` — hóa đơn máy tính tiền), nhận **file ZIP**, rút `invoice.xml`, lưu vào cache rồi trả về. Lượt gọi đi qua pacer làn `xml` (hàng đợi riêng, 2 call song song).

`nbmst` luôn là **MST người bán**, kể cả ở chiều mua vào — đây là bên phát hành hóa đơn.

Cổng thuế thỉnh thoảng nuốt request (không phản hồi), nên backend **tự thử lại** lỗi tạm thời: timeout 10s mỗi lần thử, backoff 1s→2s→4s, trong ngân sách 45 giây. Client vì vậy đặt hạn **120 giây** — cắt sớm hơn là vứt bỏ công sức retry của backend.

Mã lỗi: **401** khi token GDT hết hạn (client dừng phần XML của cả lượt xuất và nhắc đăng nhập lại), **502** cho mọi lỗi khác từ cổng thuế, kể cả khi đã hết ngân sách thử lại.

#### DELETE `/gdt/sync/data`

```ts
interface ClearSyncResult {
  purchase: number;  // số hóa đơn mua vào đã xóa
  sold: number;
  logs: number;      // số dòng lịch sử đã xóa
}
```

Xóa **toàn bộ** hóa đơn đã lưu của công ty đang chọn, kể cả hóa đơn tra cứu thủ công — không chỉ hóa đơn từ đồng bộ. Không đụng dữ liệu gốc trên GDT.

---

## 14.5. API cổng thuế và bảng mã trạng thái

Phần này mô tả API **thượng nguồn** trên cổng thuế mà `be_maxv` gọi ra (frontend không gọi thẳng — xem 14.4), kèm hai bảng mã trạng thái mà cả backend, dropdown lọc và nhãn hiển thị đều dùng.

Base URL: `https://hoadondientu.gdt.gov.vn/api` (khai ở `be_maxv/src/config/gdt-client.ts`).
Xác thực: header `Authorization: Bearer <token GDT>`.

### Khóa định danh 1 hóa đơn

**MST người bán – Ký hiệu – Số hóa đơn**, cộng thêm mẫu số:

| Tham số | Nghĩa |
|---|---|
| `nbmst` | MST **người bán** — kể cả ở chiều mua vào, đây là bên phát hành |
| `khhdon` | Ký hiệu hóa đơn (vd `K26DAA`) |
| `shdon` | Số hóa đơn |
| `khmshdon` | Ký hiệu mẫu số |

Bộ này là tham số của nhóm endpoint "1 hóa đơn" (`/detail`, `/export-xml`) và cũng là khóa `@@unique` của `vct50view`/`vct60view`.

### Endpoint danh sách hóa đơn

| Loại hóa đơn | Path |
|---|---|
| Thường (điện tử có mã / không mã) | `/query/invoices/{purchase\|sold}` |
| **Có mã khởi tạo từ máy tính tiền** | `/sco-query/invoices/{purchase\|sold}` |

Chọn nhánh theo `ttxly`: `ketQuaHd === "8"` → `sco-query`, còn lại → `query`. Cùng quy tắc này áp cho `/detail` và `/export-xml` (xem `invoiceKeyRequest`).

**Query string:**

| Tham số | Giá trị |
|---|---|
| `sort` | `tdlap:desc` |
| `size` | số dòng mỗi trang |
| `search` | các điều kiện nối bằng `;` (xem dưới) |
| `state` | cursor phân trang, chỉ có từ trang thứ 2 |

**Cú pháp `search`** — toán tử `=ge=` (≥), `=le=` (≤), `==` (bằng); ngày ở dạng `dd/MM/yyyyTHH:mm:ss`:

```
tdlap=ge=01/07/2026T00:00:00;tdlap=le=31/07/2026T23:59:59;tthai==1;ttxly==8
```

Các vế lọc thêm: `nbmst==` (chiều mua vào) / `nmmst==` (chiều bán ra), `khmshdon==`, `khhdon==`, `shdon==`. Vế nào rỗng thì bỏ hẳn khỏi chuỗi — xem `getPurchaseInvoices`/`getSoldInvoices` bên `be_maxv`.

**Ví dụ thật (chiều mua vào, tháng 07/2026):**

```
# Đã cấp mã hóa đơn
https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase?sort=tdlap:desc&size=15&search=tdlap=ge=01/07/2026T00:00:00;tdlap=le=31/07/2026T23:59:59;ttxly==5

# Cục Thuế đã nhận không mã
https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase?sort=tdlap:desc&size=15&search=tdlap=ge=01/07/2026T00:00:00;tdlap=le=31/07/2026T23:59:59;ttxly==6

# Có mã khởi tạo từ máy tính tiền
https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase?sort=tdlap:desc&size=15&search=tdlap=ge=01/07/2026T00:00:00;tdlap=le=31/07/2026T23:59:59;ttxly==8

# Kết hợp thêm trạng thái hóa đơn
https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase?sort=tdlap:desc&size=15&search=tdlap=ge=01/07/2026T00:00:00;tdlap=le=31/07/2026T23:59:59;tthai==1;ttxly==8
https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase?sort=tdlap:desc&size=15&search=tdlap=ge=01/07/2026T00:00:00;tdlap=le=31/07/2026T23:59:59;tthai==2;ttxly==5
```

**Hóa đơn có mã khởi tạo từ máy tính tiền** — cùng bộ lọc nhưng đổi sang nhánh `sco-query`:

```
https://hoadondientu.gdt.gov.vn/api/sco-query/invoices/purchase?sort=tdlap:desc&size=15&search=tdlap=ge=01/07/2026T00:00:00;tdlap=le=31/07/2026T23:59:59;ttxly==8
```

Chiều bán ra dùng y hệt, chỉ đổi `purchase` → `sold`.

### Trạng thái hóa đơn (`tthai` / `trangThaiHd`)

| Mã | Nhãn |
|:--:|---|
| `1` | Hóa đơn mới |
| `2` | Hóa đơn thay thế |
| `3` | Hóa đơn điều chỉnh |
| `4` | Hóa đơn đã bị thay thế |
| `5` | Hóa đơn bị điều chỉnh |
| `6` | Hóa đơn đã bị hủy |

### Kết quả kiểm tra hóa đơn (`ttxly` / `ketQuaHd`)

| Mã | Nhãn |
|:--:|---|
| `5` | Đã cấp mã hóa đơn |
| `6` | Cục Thuế đã nhận không mã |
| `8` | Cục Thuế đã nhận hóa đơn có mã khởi tạo từ máy tính tiền |

Hai bảng trên định nghĩa ở `features/hddt/api/gdt.ts` (`TRANG_THAI_HD_OPTIONS`, `KET_QUA_KIEM_TRA_OPTIONS`) — dùng chung cho dropdown lọc, nhãn trên bảng và cột Excel, nên sửa nhãn ở đó là đổi cả ba nơi.

Mã `8` còn được dùng làm bộ lọc "hóa đơn máy tính tiền" trong dialog xuất file:

```ts
...(loai === "ctt" ? { ketQuaHd: "8" } : {}),
```

Hàm chuyển mã sang nhãn trả về **nguyên mã** nếu gặp giá trị lạ:

```ts
export function trangThaiHdLabel(code: string): string {
  return TRANG_THAI_HD_LABEL[code] ?? code;
}
```

Chủ ý: GDT thêm mã mới thì bảng hiện con số thay vì ô trống — người dùng vẫn thấy có dữ liệu và báo lại được.

---

## 14.6. Dịch vụ ngoài — tra cứu người nộp thuế

**Không phải `be_maxv`.** Frontend gọi thẳng.

```
GET https://api.xinvoice.vn/gdt-api/tax-payer/{mst}
```

```ts
interface TaxPayerInfo {
  taxID: string;
  name: string;
  address: string;
  /** Nhóm đối tượng thuế, vd "Doanh nghiệp / Đơn vị sự nghiệp công lập". */
  orgType: string;
  /** Cơ quan thuế quản lý. */
  taxDepartment: string;
  /** Tình trạng hoạt động, vd "NNT đang hoạt động". */
  status: string;
  updatedAt: string;
}
```

| | |
|---|---|
| **Giới hạn** | 10 lần / 30 giây, tính theo IP |
| **Định dạng MST** | Đúng 10 số, **không** đuôi chi nhánh (trả 404 cho `0201964163-001`) |
| **Xác thực** | Không. Gọi bằng `fetch` trần |
| **Lỗi** | `404` không tìm thấy · `429` quá nhanh |

**Hai quy tắc bắt buộc:**

1. **Không gọi qua `apiFetch`** — sẽ gắn nhầm `API_BASE` và gửi cookie phiên sang bên thứ ba.
2. **Không proxy qua backend** — hạn mức tính theo IP, đi qua backend thì toàn hệ thống dùng chung một hạn mức.

```ts
export async function getTaxPayer(mst: string): Promise<TaxPayerInfo> {
  const res = await fetch(`${TAX_PAYER_API_BASE}/tax-payer/${encodeURIComponent(mst)}`);

  // Ném `ApiError` (không phải Error trần) để nơi gọi rẽ nhánh được theo `.status`
  if (!res.ok) {
    const message =
      res.status === 404
        ? "Không tìm thấy mã số thuế này."
        : res.status === 429
          ? "Tra cứu quá nhanh, thử lại sau ít giây."
          : `Không tra cứu được mã số thuế (${res.status}).`;
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as TaxPayerInfo;
}
```

---

## 14.7. Endpoint backend không còn dùng

Backend giữ một số route cũ đã bị thay thế. **Đừng dùng chúng cho code mới.**

| Method | Path | Thay bằng | Lý do |
|---|---|---|---|
| GET | `/gdt/invoices/purchase` | `POST .../update-run` | Chạy chặn, request dài bị proxy cắt thành 502 |
| GET | `/gdt/invoices/sold` | `POST .../update-run` | như trên |
| POST | `/gdt/sync` | `POST /gdt/sync/run` | như trên |
| POST | `/gdt/invoices/detail/:id` | `POST .../detail-run` | Tải từng hóa đơn một, không có bộ giãn nhịp |

Ghi chú trong route file backend xác nhận điều này:

> POST /sync cũ giữ tạm cho tới khi FE chuyển hẳn sang luồng này.

### Mã chết ở frontend

`features/hddt/api/invoiceDetail.ts` còn hàm `fetchOneInvoiceDetail()` gọi `POST /gdt/invoices/detail/:id` — **không nơi nào import**. Đây là tàn dư của luồng cũ chạy tiến trình từng hóa đơn ở frontend, nay đã chuyển sang lượt nền ở backend. Có thể xóa an toàn.

---

## 14.8. Bảng tổng hợp toàn bộ endpoint frontend dùng

| # | Method | Path | Cookie | X-Gdt-Token |
|:--:|---|---|:--:|:--:|
| 1 | POST | `/auth/register` | ✖ | ✖ |
| 2 | POST | `/auth/login` | ✖ | ✖ |
| 3 | POST | `/auth/forgot-password` | ✖ | ✖ |
| 4 | POST | `/auth/reset-password` | ✖ | ✖ |
| 5 | GET | `/auth/me` | ✔ | ✖ |
| 6 | POST | `/auth/refresh` | ✔ | ✖ |
| 7 | POST | `/auth/logout` | ✔ | ✖ |
| 8 | GET | `/companies` | ✔ | ✖ |
| 9 | POST | `/companies` | ✔ | ✖ |
| 10 | PUT | `/companies/:id` | ✔ | ✖ |
| 11 | DELETE | `/companies/:id` | ✔ | ✖ |
| 12 | POST | `/companies/:id/switch` | ✔ | ✖ |
| 13 | GET | `/gdt/captcha` | ✖ | ✖ |
| 14 | POST | `/gdt/login` | ✖ | ✖ |
| 15 | GET | `/gdt/invoices/:direction/saved` | ✔ | ✖ |
| 16 | GET | `/gdt/invoices/:direction/saved-details` | ✔ | ✖ |
| 17 | GET | `/gdt/invoices/:direction/saved-detail/:id` | ✔ | ✖ |
| 18 | GET | `/gdt/invoices/:direction/detail-complete` | ✔ | ✖ |
| 19 | POST | `/gdt/invoices/:direction/update-run` | ✔ | **✔** |
| 20 | GET | `/gdt/invoices/:direction/update-run/status` | ✔ | ✖ |
| 21 | POST | `/gdt/invoices/:direction/detail-run` | ✔ | **✔** |
| 22 | GET | `/gdt/invoices/:direction/detail-run/status` | ✔ | ✖ |
| 23 | POST | `/gdt/sync/run` | ✔ | **✔** |
| 24 | GET | `/gdt/sync/run/status` | ✔ | ✖ |
| 25 | POST | `/gdt/sync/run/cancel` | ✔ | ✖ |
| 26 | GET | `/gdt/sync/history` | ✔ | ✖ |
| 27 | DELETE | `/gdt/sync/data` | ✔ | ✖ |
| 28 | POST | `/gdt/render-pdf` | ✔ | ✖ |
| 29 | GET | `/gdt/stats` | ✔ | ✖ |
| 30 | GET | `api.xinvoice.vn/gdt-api/tax-payer/:mst` | ✖ | ✖ |

Đúng **ba** endpoint cần token Thuế điện tử — cả ba đều là lệnh khởi động một lượt lấy dữ liệu mới từ cơ quan thuế.

---

**Trước:** [13 — Hướng dẫn mở rộng](13-huong-dan-mo-rong.md) · **Về:** [Mục lục](README.md)
