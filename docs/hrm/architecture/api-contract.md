---
type: api-contract
feature: hrm
status: in-review
updated: 2026-09-07
links:
  - docs/hrm/CONTEXT_SUMMARY.md
  - docs/hrm/srs/hrm-spec.md
  - docs/hrm/architecture/data-model.md
  - docs/hrm/architecture/dev-notes.md
---

# HRM — API CONTRACT (Fastify v5 + Zod + Prisma multi-tenant)

> **Nguồn sự thật của tài liệu này là CODE THẬT**, không phải mong muốn thiết kế. Mỗi mục đều ghi
> `file:line` để đối chiếu. Chỗ nào code chưa làm mà nghiệp vụ cần thì ghi rõ trong Mục 9
> (Khoảng trống & Đề xuất), KHÔNG viết như thể đã có.
>
> Ứng dụng tiêu thụ: **`hdđt_maxv`** (`src/features/hrm/api/*`). KHÔNG phải `fe_maxv` —
> tài liệu cũ ghi sai chỗ này.

---

## 1. Quy ước chung (Envelope, Auth, Status)

### 1.1. Base URL & mount point

| Hạng mục | Giá trị | Bằng chứng |
|:---|:---|:---|
| Prefix | `/api/v1/hrm` | `be_maxv/src/routes/index.route.ts:48` |
| Nhóm route | `hrmRoutes` → 5 file con | `be_maxv/src/routes/hrm/hrm.route.ts:31-35` |
| Ứng dụng gọi | `hdđt_maxv` (React 19) | `hdđt_maxv/src/features/hrm/api/*.ts` (`BASE = "/hrm/..."`) |

HRM thuộc nhóm **client** (`/api/v1/*`), KHÔNG phải nhóm admin (`/api/v1/admin/*` của `maxv/`).

### 1.2. Envelope phản hồi

Toàn bộ endpoint JSON đi qua đúng 2 helper (`be_maxv/src/helpers/response.ts:4-10`):

```jsonc
// Thành công (200 / 201)
{ "success": true, "data": <payload> }
```

```jsonc
// Lỗi nghiệp vụ (401/403/404/409/500/502) — errorHandler.plugin.ts:29-109
{ "success": false, "message": "Câu tiếng Việt cho người dùng cuối" }
```

```jsonc
// Lỗi validate Zod (400) — errorHandler.plugin.ts:24-28, dạng z.flatten()
{
  "success": false,
  "errors": {
    "formErrors": [],
    "fieldErrors": { "ngay_ket_thuc": ["Ngày kết thúc phải sau ngày bắt đầu"] }
  }
}
```

> ⚠️ **400 KHÔNG có trường `message`** — client phải xử lý riêng nhánh `errors`. Đây là điểm
> FE hay bỏ sót khi hiển thị toast.

**Hai ngoại lệ KHÔNG dùng envelope:**

| Endpoint | Kiểu trả về | Bằng chứng |
|:---|:---|:---|
| `GET /tai-lieu/:id/file` | Binary nguyên bản (`Content-Type` = mime file) | `taiLieu.controller.ts:344-357` |
| `GET /tai-lieu/drive/callback` | `text/html; charset=utf-8` (trang popup tự đóng) | `taiLieu.controller.ts:205-222` |

### 1.3. HTTP status thực tế

| Status | Khi nào | Bằng chứng |
|:---|:---|:---|
| **200 OK** | Mọi `GET`, `PUT`, `DELETE` | `sendOk` — `helpers/response.ts:4` |
| **201 Created** | **Mọi `POST`**, kể cả `POST /hop-dong/doi` và `POST /tai-lieu/:id/file` | `sendCreated` — `helpers/response.ts:8`; controller: `phongBan.controller.ts:33`, `nhanVien.controller.ts:41`, `hopDong.controller.ts:35,42`, `nguoiPhuThuoc.controller.ts:33`, `taiLieu.controller.ts:53,321` |
| **400 Bad Request** | Zod parse fail (`ValidationError`) | `utils/validate.ts:10` |
| **401 Unauthorized** | JWT thiếu/sai/hết hạn | `plugins/jwt.plugin.ts:37-43` |
| **403 Forbidden** | Gói không có module `hrm`; chưa chọn công ty; hết quyền vào MST; thao tác chỉ-OWNER | `modules.service.ts:104-108`, `resolveTenantDb.ts:38-54`, `taiLieu.controller.ts:149,281` |
| **404 Not Found** | Bản ghi không tồn tại / đã xóa mềm; công ty chưa cấp DB tenant; Prisma `P2025` | `errors.ts:19`, `resolveTenantDb.ts:55-57`, `errorHandler.plugin.ts:93-97` |
| **409 Conflict** | Xung đột nghiệp vụ (trùng mã, còn ràng buộc, file quá cỡ, sai mime, Drive chưa kết nối); Prisma `P2002`/`P2003` | `errors.ts:13`, `errorHandler.plugin.ts:88-103` |
| **429 Too Many Requests** | Rate limit toàn cục 300 req/phút | `app.ts` (`@fastify/rate-limit`, `max: 300, timeWindow: '1 minute'`) |
| **500** | Lỗi không phân loại | `errorHandler.plugin.ts:106-109` |
| **502 Bad Gateway** | `DriveApiError` lọt tới errorHandler (Google hỏng / mất mạng) | `errorHandler.plugin.ts:66-77` |

> ⚠️ **Lệch với `docs/hrm/qa/test-cases.md`**: bộ test hiện ghi "POST /phong-ban → 200 OK".
> Code trả **201**. QA cần sửa kỳ vọng (xem Mục 10, dòng ĐS-01).

### 1.4. Xác thực & phân quyền

```
preHandler (hrm.route.ts:25-29):
  if (route.config.khongCanAuth) → bỏ qua           // /tai-lieu/drive/callback (+ alias cũ /tai-lieu/drive/callback)
  app.authenticate(req)                              // JWT: cookie httpOnly, fallback header
  requireModule('hrm')(req)                          // gói thuê bao phải bật feature hrm
```

| Lớp | Cơ chế | Lỗi khi trượt |
|:---|:---|:---|
| **Đăng nhập** | `@fastify/jwt` đọc access token từ **cookie httpOnly** (`ACCESS_COOKIE`), fallback header `Authorization: Bearer` | 401 `"Chưa đăng nhập hoặc token không hợp lệ"` |
| **Gói dịch vụ** | `requireModule('hrm')` — tra lại `User` trong DB sys mỗi request, quy đổi qua `Subscription.plan.features.hrm === true` | 403 `"Gói đăng ký hiện tại không bao gồm tính năng này"` |
| **Phạm vi tenant** | `resolveTenantDb(req)` → `resolveTenantInfo` kiểm `accessibleDonViWhere(userId, role)` rồi lấy `don_vi.dbName` | 403 `"Tài khoản chưa gắn với công ty nào"` / `"Bạn không có quyền truy cập công ty này"`; 404 `"Công ty chưa được cấp DB (provisioning chưa hoàn tất)"` |
| **Chỉ OWNER** | 2 thao tác Drive: đổi tài khoản Google khi đã kết nối, và ngắt kết nối | 403 với câu riêng (Mục 7.4, 7.7) |

**Ma trận vai trò (thực tế theo code, `helpers/access.ts:17-24`):**

| Role | Truy cập được API HRM? | Ghi chú |
|:---|:---:|:---|
| `OWNER` | ✅ | Thấy các `don_vi` mình sở hữu |
| `OWNER_EMPLOYEE` | ✅ | Thấy `don_vi` được cấp qua `DonViAccess` |
| `ADMIN` | ❌ **403** | `accessibleDonViWhere` trả `null` cho ADMIN ⇒ `resolveTenantInfo` ném `ForbiddenError`. `requireModule` thì cho ADMIN qua (`modules.service.ts:125`), nhưng bước resolve tenant chặn lại. **Chủ ý: ADMIN không được đọc dữ liệu nhân sự của khách.** Ghi rõ ở đây vì hai guard nói ngược nhau, dễ hiểu nhầm là bug. |

> ❗ HRM **không có phân quyền theo chức năng bên trong module**: bất kỳ user nào có quyền vào MST
> và có gói `hrm` đều xem/sửa/xóa được toàn bộ hồ sơ nhân sự, kể cả lương trong hợp đồng.
> Đây là khoảng trống nghiệp vụ, xem **OQ-ARCH-01** (Mục 11).

### 1.5. Kiểu dữ liệu trên đường truyền

| Loại | Request (client → server) | Response (server → client) |
|:---|:---|:---|
| Ngày thật (`@db.Date`) | Chuỗi **`YYYY-MM-DD`** bắt buộc; `""`/`null`/thiếu → `null` với trường tùy chọn | Chuỗi **ISO đầy đủ** `"2026-01-01T00:00:00.000Z"` (Prisma trả `Date`, Fastify serialize) |
| `hrm_nguoi_phu_thuoc.ngay_sinh` | Chuỗi **`dd/MM/yyyy`** (kiểu TEXT, có soát ngày có thật) | Nguyên chuỗi `dd/MM/yyyy` |
| Tiền (`Decimal(18,2)`) | **Số JSON** (`25000000`), ≤ 2 số lẻ, ≥ 0, ≤ 999.999.999.999,99 | **Chuỗi** thập phân (`"25000000"`) — Prisma Decimal serialize ra chuỗi để không mất chính xác. FE bắt buộc `Number()` |
| Boolean | `true`/`false` (KHÔNG nhận `"1"`, `1`) | `true`/`false` |
| `status` | Enum chuỗi `"0"` \| `"1"` | `"0"` \| `"1"` |
| Text tùy chọn | `""` được quy về `null` trước khi lưu (`optText`, `primitives.ts:7-12`) | `null` khi trống |

> ⚠️ **Tài liệu cũ ghi sai**: `"ngay_sinh": "1990-05-15"` trong response. Thực tế là
> `"1990-05-15T00:00:00.000Z"` (`hdđt_maxv/src/features/hrm/api/nhanVienApi.ts:11` đã ghi đúng).

**Chuẩn hóa tự động ở validator** (client không cần tự làm, nhưng phải biết để không so sánh nhầm):

| Trường | Biến đổi | Bằng chứng |
|:---|:---|:---|
| `ma_nv`, `ma_pb`, `ma_pb_me` (body) | `.trim().toUpperCase()` | `nhanVien.validator.ts:23-25,47-49`; `phongBan.validator.ts:10-15,28-30` |
| `ma_nv` (query `contracts`/`dependents`/`documents`), `ma_pb` (query `employees`) | `.trim().toUpperCase()` | `hopDong.validator.ts:117-122`; `nguoiPhuThuoc.validator.ts:166-171`; `taiLieu.validator.ts:50-55`; `nhanVien.validator.ts:100-105` |
| `ma_nv`, `ho_ten` (query `employees`) | Chỉ `.trim()` — **KHÔNG** uppercase (khớp `contains` insensitive) | `nhanVien.validator.ts:96-97` |
| `email` | `trim` + `lowercase` + soát định dạng | `primitives.ts:19-26` |
| MST (`mst_ca_nhan`, `mst`) | Soát `MST_REGEX` (10 số / 10 số + nhánh / 12 số) | `primitives.ts:33-40` |

### 1.6. Phân trang / lọc / sắp xếp

| Hạng mục | Trạng thái hiện tại |
|:---|:---|
| **Phân trang** | ❌ **KHÔNG CÓ ở bất kỳ endpoint nào.** Mọi `GET` list trả **toàn bộ** mảng. Không có `page`/`limit`/`offset`/`cursor`. |
| **Sắp xếp** | Cố định phía server, client **không đổi được** (không có `sort`/`order`). Xem cột "Thứ tự" của từng endpoint. |
| **Lọc** | Chỉ các query param liệt kê ở từng endpoint. Param lạ bị Zod **bỏ qua im lặng** (schema không `.strict()`), không báo lỗi. |

Rủi ro và đề xuất: Mục 9.6 + `ADR-005`.

### 1.7. Idempotency

Không endpoint nào nhận `Idempotency-Key`. Tính chất thực tế:

| Endpoint | Lặp lại request giống hệt | Ghi chú |
|:---|:---|:---|
| `PUT /*`, `DELETE /*` | Idempotent tự nhiên (DELETE lần 2 → 404) | An toàn cho retry |
| `POST /phong-ban`, `POST /nhan-vien` **có** nhập mã | Idempotent (lần 2 → 409 trùng mã) | An toàn |
| `POST /phong-ban`, `POST /nhan-vien` **bỏ trống** mã | ❌ **KHÔNG** idempotent — tạo thêm bản ghi mã mới | Double-click ⇒ 2 nhân viên |
| `POST /hop-dong`, `POST /hop-dong/doi`, `POST /nguoi-phu-thuoc`, `POST /tai-lieu` | ❌ **KHÔNG** idempotent (khóa chính là UUID sinh mới mỗi lần) | Double-click ⇒ 2 hợp đồng trùng khoảng ngày; xem `ADR-002` |
| `POST /tai-lieu/:id/file` | Ghi đè: tải file mới xong mới xóa file cũ trên Drive | `taiLieuDrive.service.ts:345-349` |

### 1.7b. Cập nhật theo đợt chốt nghiệp vụ 16/16 (2026-09-07)

Contract này đã nạp 16 quyết định nghiệp vụ ghi ở Mục 6.1 của `docs/hrm/CONTEXT_SUMMARY.md`. Phần đánh `[MỚI — QĐ n]` / `[SỬA THEO QĐ n]` là **hợp đồng đã chốt nhưng CHƯA có trong mã** — đầu việc cho kỹ sư, không phải mô tả hiện trạng.

| Nhóm endpoint | Thay đổi |
|:---|:---|
| `/nhan-vien` | Thêm `ngay_nghi_viec` (QĐ #3); thêm `ho_so_du` + `giay_to_thieu` (QĐ #14); che trường lương và tài khoản ngân hàng theo quyền (QĐ #8) |
| `/hop-dong` | `ma_nv` thành **bắt buộc** + chặn theo quyền xem lương (QĐ #8); `loai_hd_can_chot` bắt buộc ở `/change` (QĐ #1); kiểm trùng `so_hd` (QĐ #4); kiểm lương lớn hơn 0 (QĐ #5); cho hợp đồng một ngày (QĐ #6) |
| `/phong-ban` | Trả số nhân viên tách theo đang làm / đã nghỉ để giao diện cảnh báo đúng con số (QĐ #11) |
| `/tai-lieu` | Thêm `ngay_het_han` (QĐ #14); `DELETE` xóa luôn file Drive (QĐ #12) |
| `/tai-lieu/drive/*` | Kết nối lần đầu **chỉ `OWNER`** (QĐ #10) |
| **Nhóm mới** `/giay-to-bat-buoc` | Danh mục bộ giấy tờ bắt buộc theo loại hợp đồng (QĐ #14) |
| **Endpoint mới** `/tai-lieu/sap-het-han` | Danh sách giấy tờ đã hết hạn và sắp hết hạn (QĐ #14) |

---

### 1.8. Đợt đổi tên đường dẫn sang tiếng Anh — ĐÃ HOÃN (chốt 2026-09-07)

> ✅ **Quyết định: HOÃN. Contract này dùng đường dẫn tiếng Việt, khớp mã nguồn.**
>
> Bản trước của tài liệu này mô tả một đợt đổi toàn bộ đường dẫn HRM sang tiếng Anh (`/employees`, `/contracts`, `/documents`…) **như thể đã triển khai**. Vòng phản biện độc lập 2026-09-07 kiểm chứng và thấy: đợt đó **chưa hề được làm** ở bất kỳ đâu — mã nguồn (`routes/hrm/*.ts`), giao diện (`hdđt_maxv/src/features/hrm/api/*.ts`), đặc tả, bộ ca kiểm thử, `dev-notes.md` và `CONTEXT_SUMMARY.md` đều vẫn dùng đường tiếng Việt. Tài liệu này là **tài liệu duy nhất** dùng đường tiếng Anh. Bảng đối chiếu cũ còn viện dẫn một alias `taiLieu.route.ts:40-49` **không tồn tại** (file chỉ có 39 dòng).
>
> **Chốt theo OQ-hrm-33:** hoãn đợt đổi tên. Đổi tên đường dẫn là việc thẩm mỹ, không mang giá trị nghiệp vụ; làm giữa lúc đang vá bảy lỗi nghiệp vụ là tự tạo rủi ro lệch ba chiều giữa mã, kiểm thử và giao diện. **165 chỗ trong tài liệu đã được đưa về đường tiếng Việt** ngày 2026-09-07.
>
> **Hai nhóm endpoint mới của QĐ #14** đặt tên theo cùng quy ước tiếng Việt: `/giay-to-bat-buoc` (danh mục bộ giấy tờ bắt buộc) và `/tai-lieu/sap-het-han` (danh sách cảnh báo hạn).
>
> Muốn làm đợt đổi tên về sau thì đó là **một hạng mục riêng** cần: alias song song cho cả 5 nhóm route, cập nhật đồng thời sáu tài liệu và giao diện, cộng việc đổi `GOOGLE_REDIRECT_URI` trong biến môi trường **và** Authorized redirect URI ở Google Cloud Console — đổi một phía là luồng nối Drive chết ngay.

## 2. Phòng ban — `/api/v1/hrm/phong-ban`

Service: `be_maxv/src/services/client/hrm/phongBan.service.ts` · Validator: `validators/hrm/phongBan.validator.ts`

### 2.1. `GET /phong-ban` — danh sách phẳng kèm tên cha và số nhân viên

| | |
|:---|:---|
| **Auth** | Đăng nhập + module `hrm` + quyền MST |
| **Query** | `ma_pb`, `ten_pb`, `status` (tất cả tùy chọn) |
| **Thứ tự** | `ma_pb` tăng dần (`phongBan.service.ts:127`) |
| **Phân trang** | Không |

| Param | Kiểu | Ràng buộc | Ngữ nghĩa lọc |
|:---|:---|:---|:---|
| `ma_pb` | string | trim, mặc định `""` | `contains`, **không phân biệt hoa thường** (`:118`) |
| `ten_pb` | string | trim, mặc định `""` | `contains`, không phân biệt hoa thường (`:120`) |
| `status` | enum | `"0"` \| `"1"`; giá trị khác → **400** | So khớp chính xác (`:121`) |

**Luôn ngầm lọc `da_xoa = false`** (`:117`) — không có cách nào xem phòng ban đã xóa qua API.

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "ma_pb": "PB01",
      "ten_pb": "Ban Giám Đốc",
      "ma_pb_me": null,
      "ghi_chu": "Lãnh đạo",
      "status": "1",
      "ten_pb_me": null,
      "so_nv": 3
    },
    {
      "ma_pb": "PB01.01",
      "ten_pb": "Văn phòng HĐQT",
      "ma_pb_me": "PB01",
      "ghi_chu": null,
      "status": "1",
      "ten_pb_me": "Ban Giám Đốc",
      "so_nv": 2
    }
  ]
}
```

Ngữ nghĩa hai trường suy diễn:

- `ten_pb_me`: tra từ **toàn bộ** phòng ban chưa xóa (không chỉ trong `data`), nên vẫn đúng khi
  cha bị lọc khỏi kết quả (`:129-134`). `null` khi không có cha **hoặc cha đã bị xóa mềm**.
- `so_nv`: **chỉ đếm nhân viên `da_xoa = false` AND `status = '1'`** (đang làm) — `:138-142`.
- `[MỚI — QĐ #11]` **chưa có trong mã** — thêm `so_nv_da_nghi` (đếm `da_xoa = false` AND `status = '0'`). Giao diện cần **cả hai con số** để hỏi xác nhận đúng khi chuyển phòng ban sang ngừng hoạt động: "phòng này còn 3 người đang làm và 2 người đã nghỉ" (BR-hrm-060, FR-hrm-037). Chỉ có `so_nv` thì câu cảnh báo nói thiếu, mà `so_nv` lại chính là con số guard xóa mềm **không** dùng — guard xóa mềm chặn theo mọi nhân viên chưa xóa, kể cả người đã nghỉ.
  Con số này **khác** con số dùng để chặn xóa ở Mục 2.5 (chỗ đó đếm cả người đã nghỉ). Sự khác
  biệt là **cố ý** và message lỗi 409 nói rõ cả hai số.

### 2.2. `POST /phong-ban` — tạo mới

**Request body** (`phongBanBodySchema`):

| Field | Kiểu | Bắt buộc | Ràng buộc Zod | Ghi chú |
|:---|:---|:---:|:---|:---|
| `ma_pb` | string \| null | Không | ≤ 24 ký tự, tự `UPPER` | Bỏ trống ⇒ server sinh `PBxx` / `<cha>.yy` |
| `ten_pb` | string | **Có** | trim, 1..254 | |
| `ma_pb_me` | string \| null | Không | ≤ 24 ký tự, tự `UPPER` | Phải tồn tại và chưa xóa |
| `ghi_chu` | string \| null | Không | ≤ 512 | `""` → `null` |
| `status` | `"0"`\|`"1"` | Không | mặc định `"1"` | |

```json
{ "ma_pb": null, "ten_pb": "Phòng Kế toán", "ma_pb_me": "PB01", "ghi_chu": null, "status": "1" }
```

**Response 201:** `{ "success": true, "data": { "ma_pb": "PB01.02" } }`

**Thuật toán sinh mã** (`sinhMaPhongBan`, `:42-59`): tiền tố `PB` (gốc) hoặc `<ma_pb_me>.`; quét
**mọi** bản ghi có `startsWith(tiền tố)` **kể cả `da_xoa = true`** (mã đã xóa không bao giờ cấp
lại); lấy số 2 chữ số nhỏ nhất còn trống trong `01..99`; hết 99 số → `<tiền tố><4 số cuối
timestamp>`; mã vượt 24 ký tự → 409.

**Lỗi:**

| Mã tài liệu | HTTP | Message (nguyên văn) | Điều kiện | Bằng chứng |
|:---|:---:|:---|:---|:---|
| `E-hrm-010` | 409 | `Phòng ban cha không thể là chính nó` | `ma_pb_me == ma_pb` | `:70-72` |
| `E-hrm-009` | 404 | `Phòng ban cha không tồn tại` | `ma_pb_me` không có / đã xóa mềm | `:73-80` |
| `E-hrm-012` | 409 | `Mã phòng ban "<ma>" đã tồn tại` | Trùng khóa chính (kể cả bản ghi đã xóa mềm) | `:172-179` |
| `E-hrm-015` | 409 | `Cây phòng ban quá sâu để tự sinh mã ("<ma>" vượt 24 ký tự). Vui lòng tự nhập mã ngắn hơn.` | Mã sinh ra > 24 ký tự | `:22-29` |
| `E-hrm-006` | 400 | (không có `message`, chỉ `errors`) | Zod fail | `validate.ts:10` |

> ⚠️ Thứ tự kiểm tra: **cha trước, sinh mã sau** (`:164-170`) — cố ý, vì mã con lấy cha làm tiền tố.

### 2.3. `PUT /phong-ban/:ma_pb` — cập nhật

- **Path param:** `ma_pb` (chuỗi ≥ 1 ký tự, **KHÔNG** tự uppercase ở param — `phongBan.validator.ts:61-63`).
  Truyền `pb01` chữ thường sẽ **404**, vì khóa lưu dạng hoa. FE phải gửi đúng mã đã nhận từ list.
- **Body:** như `POST` nhưng **bỏ `ma_pb`** (`phongBanUpdateSchema`) — không đổi khóa chính.
  `ten_pb` vẫn bắt buộc, `status` vẫn mặc định `"1"` nếu thiếu ⇒ **PUT là thay toàn bộ, không phải PATCH**.
- **Response 200:** `{ "success": true, "data": { "ma_pb": "PB01.02" } }`

| Mã tài liệu | HTTP | Message | Điều kiện | Bằng chứng |
|:---|:---:|:---|:---|:---|
| `E-hrm-008` | 404 | `Không tìm thấy phòng ban` | Không tồn tại / đã xóa mềm | `:199-206` |
| `E-hrm-010` | 409 | `Phòng ban cha không thể là chính nó` | | `:70-72` |
| `E-hrm-009` | 404 | `Phòng ban cha không tồn tại` | | `:73-80` |
| `E-hrm-011` | 409 | `Không thể chọn phòng ban cấp dưới làm phòng ban cha (tạo vòng lặp trong cây tổ chức)` | Đi ngược chuỗi cha gặp lại chính nó | `assertKhongVongLap`, `:89-110` |

> ⚠️ **Lệch với `qa/test-cases.md` TC-PB-02**: bộ test kỳ vọng message
> `"Không thể chọn phòng ban cấp dưới làm phòng ban cha (tạo vòng lặp)"` — thiếu cụm
> `" trong cây tổ chức"`. Message thật ở `constants/messages.ts:139-140`. QA cần sửa (ĐS-02).

### 2.4. Ghi chú: `PUT` không giới hạn theo `status`

Đổi `status` từ `"1"` sang `"0"` (ngừng hoạt động) **không** kiểm tra còn nhân viên hay không —
khác hẳn `DELETE`. Đây là chủ ý (ngừng hoạt động là trạng thái nghiệp vụ hợp lệ), nhưng
FE cần cảnh báo mềm. Xem **OQ-ARCH-04**.

### 2.5. `DELETE /phong-ban/:ma_pb` — xóa MỀM

- **Hành vi:** đặt `da_xoa = true`, **không xóa dòng** (`:264-267`) để `ma_pb` không bao giờ được
  cấp lại (mã đã nằm trên chứng từ kế toán).
- **Response 200:** `{ "success": true, "data": { "ma_pb": "PB01.02" } }`

| Mã tài liệu | HTTP | Message | Điều kiện | Bằng chứng |
|:---|:---:|:---|:---|:---|
| `E-hrm-008` | 404 | `Không tìm thấy phòng ban` | | `:226-233` |
| `E-hrm-013` | 409 | `Phòng ban "<ma>" đang có <N> phòng ban trực thuộc, vui lòng xử lý các phòng ban đó trước.` | Còn `ma_pb_me = <ma>` và `da_xoa = false` | `:246-250` |
| `E-hrm-014` | 409 | `Phòng ban "<ma>" đang có <N> nhân viên (<A> đang làm, <B> đã nghỉ), không thể xóa.` — bỏ phần ngoặc nếu `B = 0` | Còn nhân viên `da_xoa = false` (**tính cả người đã nghỉ**) | `:239-262` |

> ⚠️ **Lệch với `srs/hrm-spec.md` BR-02.3 và `qa/test-cases.md` AC-03**: SRS ghi "chỉ tính nhân viên
> chưa bị xóa mềm", AC-03 kỳ vọng message `"Phòng ban đang có 3 nhân viên, không thể xóa."`.
> Code chặn **cả nhân viên đã nghỉ việc** (`status='0'`) và dựng message có mã phòng ban + tách
> số đang làm / đã nghỉ. **Code đúng hơn về nghiệp vụ** (hồ sơ người đã nghỉ vẫn trỏ vào phòng ban
> và còn dùng khi quyết toán thuế). Đề nghị BA chốt theo code, QA sửa kỳ vọng (ĐS-03).

---

## 3. Nhân viên — `/api/v1/hrm/nhan-vien`

Service: `services/client/hrm/nhanVien.service.ts` · Validator: `validators/hrm/nhanVien.validator.ts`

### 3.1. `GET /nhan-vien` — danh sách

| | |
|:---|:---|
| **Query** | `ma_nv`, `ho_ten`, `ma_pb`, `status` |
| **Thứ tự** | `ma_nv` tăng dần (`:107`) |
| **Phân trang** | Không |

| Param | Ngữ nghĩa | Bằng chứng |
|:---|:---|:---|
| `ma_nv` | `contains`, không phân biệt hoa thường | `:97` |
| `ho_ten` | `contains`, không phân biệt hoa thường | `:98-99` |
| `ma_pb` | **So khớp CHÍNH XÁC** (đã uppercase ở validator) — không phải `contains` | `:100` |
| `status` | `"0"`\|`"1"`, so khớp chính xác | `:101` |

Luôn ngầm lọc `da_xoa = false` (`:96`).

**Response 200 (mỗi phần tử):**

```json
{
  "ma_nv": "NV0001",
  "ho_ten": "Nguyễn Văn A",
  "ngay_sinh": "1990-05-15T00:00:00.000Z",
  "so_cccd": "001090012345",
  "mst_ca_nhan": "8012345678",
  "dien_thoai": "0987654321",
  "email": "vana@example.com",
  "dia_chi": "Hà Nội",
  "gioi_tinh": "nam",
  "ma_pb": "PB01",
  "chuc_vu": "Giám đốc kỹ thuật",
  "cap_bac": "Quản lý cấp cao",
  "ngay_vao_lam": "2022-01-10T00:00:00.000Z",
  "mien_cham_cong": false,
  "cong_doan": true,
  "so_tai_khoan": "19034567890123",
  "ten_tai_khoan": "NGUYEN VAN A",
  "ngan_hang": "Techcombank",
  "ghi_chu": null,
  "status": "1",

  "ten_pb": "Ban Giám Đốc",
  "so_npt": 1,

  "so_hop_dong": "HĐLĐ-001/2026",
  "loai_hop_dong": "hdld",
  "kieu_luong": "gross",
  "ngay_hieu_luc_toi": null,
  "bhxh": true,
  "tncn": true
}
```

**Nguồn của các trường suy diễn:**

| Trường | Nguồn | Bằng chứng |
|:---|:---|:---|
| `ten_pb` | Tra `hrm_phong_ban` (chưa xóa). `null` nếu `ma_pb` null hoặc phòng ban đã xóa | `:109-112,125` |
| `so_npt` | `groupBy` `hrm_nguoi_phu_thuoc` theo `ma_nv` — **đếm tất cả**, không lọc gì thêm | `:113,126` |
| **6 trường hợp đồng** | **Tính động** từ `hrm_hop_dong` mỗi lần đọc, KHÔNG có cột lưu sẵn | `phanHopDong`, `:144-153` |

**Quy tắc "hợp đồng hiện hành"** (`chonHopDongHienHanh`, `hopDong.service.ts:93-104`):

1. Sắp toàn bộ hợp đồng của nhân viên theo `ngay_bat_dau DESC, datetime0 DESC, id DESC` (`:114-118`).
2. Lấy **hợp đồng đầu tiên** thỏa `ngay_bat_dau <= homNayVN` VÀ (`ngay_ket_thuc` null HOẶC `>= homNayVN`).
3. Không có cái nào đang hiệu lực ⇒ lấy phần tử đầu danh sách (**hợp đồng có ngày bắt đầu muộn nhất**,
   kể cả hợp đồng tương lai chưa hiệu lực).
4. Nhân viên chưa có hợp đồng nào ⇒ **cả 6 trường đều `null`**.

> `[SỬA THEO QĐ #2]` **Bước 3 được giữ nguyên có chủ đích.** Hợp đồng ký trước cho tương lai **được tính là "hiện hành"** ngay khi ký. Hệ quả bắt buộc ghi vào contract: nhãn *hợp đồng hiện hành* **KHÔNG** đồng nghĩa *đang hiệu lực hôm nay* — phân hệ Lương phải tự lọc theo `ngay_bat_dau` so với kỳ lương, **không** được tin thẳng 6 trường này (BR-hrm-019, giả định A-hrm-09).
>
> `[MỚI — QĐ #1]` **Một điểm chưa chốt:** khi nhân viên có hợp đồng lao động chính **và** hợp đồng khoán cùng đang hiệu lực, `chonHopDongHienHanh` trả **một** hợp đồng nên kết quả mơ hồ. Ưu tiên theo loại, theo ngày bắt đầu muộn nhất, hay trả cả hai — chưa ai chốt, xem OQ-hrm-11. Đợt này giữ nguyên hành vi cũ.

#### 3.1b. Bốn trường thêm vào phản hồi — chưa có trong mã

| Trường | Kiểu | Nguồn | Quyết định |
|:---|:---|:---|:---|
| `ngay_nghi_viec` | `YYYY-MM-DD` \| null | Cột mới trên `hrm_nhan_vien`. `null` với người đang làm **và** với người đã nghỉ từ trước đợt này (dữ liệu cũ không suy ra được) | `[MỚI — QĐ #3]` BR-hrm-054 |
| `ho_so_du` | boolean \| null | Tính lúc đọc theo BR-hrm-064. **`null`** khi nhân viên chưa có hợp đồng nào — không phải `false` | `[MỚI — QĐ #14]` FR-hrm-040 |
| `giay_to_thieu` | mảng chuỗi | Các `loai_giay_to` bắt buộc mà nhân viên không có dòng `hrm_tai_lieu` nào cùng loại. Rỗng khi đủ hoặc khi chưa có hợp đồng | `[MỚI — QĐ #14]` BR-hrm-064 |
| `so_giay_to_het_han` | số | Đếm dòng giấy tờ `da_het_han` của nhân viên. Trục **độc lập** với `ho_so_du` | `[MỚI — QĐ #14]` BR-hrm-065 |

**Ràng buộc hiệu năng, không phải gợi ý:** `ho_so_du` và `giay_to_thieu` cho **cả danh sách** phải lấy trong **một lượt truy vấn**, không truy vấn theo từng dòng (FR-hrm-040, cùng ràng buộc với NFR-hrm-004). Đối chiếu bộ giấy tờ bắt buộc cho từng nhân viên là công thức sinh N+1 rất tự nhiên — đây là chỗ dễ hỏng nhất của tính năng này.

#### 3.1c. Che trường lương và tài khoản ngân hàng `[MỚI — QĐ #8]` — chưa có trong mã

Người **không** được cấp quyền xem dữ liệu lương nhận phản hồi **không chứa** các trường: `so_tai_khoan`, `ten_tai_khoan`, `ngan_hang` (BR-hrm-059, FR-hrm-042).

**Bỏ hẳn trường, không trả `null`.** Trả `null` là nói dối về dữ liệu — giao diện không phân biệt được "không có số tài khoản" với "không được xem số tài khoản", và người dùng sẽ báo lỗi mất dữ liệu.

Quyền này nằm **bên trong** phạm vi `OWNER_EMPLOYEE`; `OWNER` luôn có sẵn; `ADMIN` không liên quan vì không có phạm vi tenant (BR-hrm-051, đã chốt giữ nguyên ở QĐ #9). Cách hiện thực quyền — cột phân quyền, bảng quyền riêng, hay cờ trên bản ghi `DonViAccess` — là quyết định của Architect, chưa chốt trong contract này.

`homNayVN()` = nửa đêm UTC của ngày **theo giờ Việt Nam** (`Date.now() + 7h`), `hopDong.service.ts:61-66`.

> ⚠️ `loai_hop_dong` KHÔNG phải giá trị gốc: nó là bản gom 5 → 3 (`loaiHdVeNhanVien`, `:47-51`):
> `thu_viec` → `thu_viec`; `khoan` → `hdvc`; **mọi giá trị khác** (kể cả chuỗi lạ) → `hdld`.
> Giá trị gốc chỉ thấy ở `GET /hop-dong`.

> ⚠️ Bước 3 khiến nhân viên chỉ có hợp đồng **tương lai** vẫn hiện thông tin hợp đồng đó như
> "hiện hành". Xem **OQ-ARCH-02**.

### 3.2. `GET /nhan-vien/:ma_nv` — chi tiết

- **Path param:** `ma_nv`, ≥ 1 ký tự, **không tự uppercase** (`nhanVien.validator.ts:110-112`).
- **Response 200:** **cùng bộ trường như list, TRỪ `ten_pb` và `so_npt`** (`getNhanVien`, `:156-167`).
  6 trường hợp đồng **vẫn có**. FE `nhanVienApi.ts:46-48` đã khai đúng (`ten_pb?`, `so_npt?`).
- **404:** `Không tìm thấy nhân viên` — không tồn tại hoặc `da_xoa = true`.

### 3.3. `POST /nhan-vien` — tạo mới

**Request body** (`nhanVienBodySchema`):

| Field | Kiểu | Bắt buộc | Ràng buộc |
|:---|:---|:---:|:---|
| `ma_nv` | string \| null | Không | ≤ 24, tự `UPPER`; bỏ trống ⇒ sinh `NVxxxx` |
| `ho_ten` | string | **Có** | trim, 1..254 |
| `ngay_sinh` | `YYYY-MM-DD` \| null | Không | Soát ngày **có thật** (chặn `2026-02-30`) |
| `so_cccd` | string \| null | Không | ≤ 20. **Không unique** — trùng CCCD được chấp nhận |
| `mst_ca_nhan` | string \| null | Không | `MST_REGEX` (10 số / 10 số + nhánh / 12 số) |
| `dien_thoai` | string \| null | Không | ≤ 20, không soát định dạng |
| `email` | string \| null | Không | `emailRule` + ≤ 254, tự lowercase |
| `dia_chi` | string \| null | Không | ≤ 500 |
| `gioi_tinh` | enum \| null | Không | `nam` \| `nu` \| `khac`; mặc định `null` |
| `ma_pb` | string \| null | Không | ≤ 24, tự `UPPER`; phải tồn tại & chưa xóa |
| `chuc_vu` | string \| null | Không | ≤ 100, chữ tự do |
| `cap_bac` | string \| null | Không | ≤ 64, chữ tự do |
| `ngay_vao_lam` | `YYYY-MM-DD` | **Có** | Bắt buộc, ngày có thật |
| `mien_cham_cong` | boolean | Không | mặc định `false` |
| `cong_doan` | boolean | Không | mặc định `true` |
| `so_tai_khoan` | string \| null | Không | ≤ 30 |
| `ten_tai_khoan` | string \| null | Không | ≤ 100 |
| `ngan_hang` | string \| null | Không | ≤ 128, chữ tự do |
| `ghi_chu` | string \| null | Không | ≤ 2000 |
| `status` | `"0"`\|`"1"` | Không | mặc định `"1"` |

> ❗ **KHÔNG nhận** trường hợp đồng nào (`so_hop_dong`, `luong_chinh`, …) — đã bỏ khỏi nhân viên
> từ 2026-09-05. Gửi lên cũng bị Zod bỏ qua im lặng. Muốn có hợp đồng phải gọi `POST /hop-dong`
> **riêng** (không nguyên tử với việc tạo nhân viên — khác bản tham khảo, xem `ADR-002` Mục "Đối chiếu").

**Response 201:** `{ "success": true, "data": { "ma_nv": "NV0002" } }`

**Sinh mã** (`sinhMaNhanVien`, `:54-73`): quét mọi `ma_nv` `startsWith('NV')` **kể cả đã xóa mềm**,
lấy `NV` + 4 số nhỏ nhất còn trống trong `0001..9999`; vượt ⇒ `NV` + 6 số cuối timestamp.

| Mã tài liệu | HTTP | Message | Điều kiện | Bằng chứng |
|:---|:---:|:---|:---|:---|
| `E-hrm-008` | 404 | `Không tìm thấy phòng ban` | `ma_pb` không tồn tại / đã xóa | `:80-92` |
| `E-hrm-017` | 409 | `Mã nhân viên "<ma>" đã tồn tại` | Trùng, **kể cả với bản ghi đã xóa mềm** | `:182-189` |
| `E-hrm-018` | 409 | `Không sinh được mã nhân viên, vui lòng tự nhập mã.` | Mã timestamp vượt 24 ký tự | `:67-71` |
| `E-hrm-007` | 409 | `Dữ liệu bị trùng, vui lòng thử lại` | Prisma `P2002` lọt qua (race 2 request cùng lúc) | `errorHandler.plugin.ts:88-92` |

> 🚨 `E-hrm-007` là **triệu chứng của ISSUE-HRM-02**: hai người tạo nhân viên cùng lúc, cả hai
> tính ra cùng mã, người thứ hai nhận 409 vô nghĩa thay vì được cấp mã kế tiếp. Code **chưa** có
> retry-on-P2002. Xem `ADR-001`.

### 3.4. `PUT /nhan-vien/:ma_nv` — cập nhật

> 🚨 **`[MỚI — BR-hrm-067]` `status` phải chuyển thành BẮT BUỘC — chưa có trong mã.** Hiện `status` mang mặc định `'1'` (`nhanVien.validator.ts:74`) và schema sửa kế thừa nguyên mặc định đó, nên **một yêu cầu sửa thiếu `status` sẽ âm thầm đưa nhân viên đã nghỉ trở lại đang làm** — trong khi `ngay_nghi_viec` và các hợp đồng đã bị chốt vẫn nằm nguyên, tạo ra trạng thái không quy tắc nào mô tả. Đây chính là nhánh ngược mà OQ-hrm-12 tuyên bố chưa chốt nhưng **đang đi được ngay hôm nay** bằng một lần thiếu trường (BUG-HRM-26). Lý do y hệt lý do đã áp cho hai cờ chế độ ở đoạn dưới. Thiếu `status` trả **400 E-hrm-006**.

Body = `nhanVienBodySchema` **bỏ `ma_nv`**, **và** `mien_cham_cong` + `cong_doan` chuyển thành
**BẮT BUỘC** (`nhanVien.validator.ts:89-92`). Lý do: PUT thay toàn bộ bản ghi; thiếu trường thì
default `true` sẽ âm thầm bật lại cờ công đoàn của người đã cố ý tắt.

- **Response 200:** `{ "success": true, "data": { "ma_nv": "NV0002" } }`
- **404:** `Không tìm thấy nhân viên` / `Không tìm thấy phòng ban`.
- ⚠️ **Hiện trạng:** không kiểm tra gì khi đổi `status` sang `"0"` (nghỉ việc) — hợp đồng đang hiệu lực vẫn nguyên. Đây chính là điều QĐ #3 sửa.

#### 3.4b. Ghi nhận nghỉ việc `[MỚI — QĐ #3]` — chưa có trong mã

Khi body có `status = "0"` **và** bản ghi hiện tại đang `status = "1"`, đường này trở thành thao tác **ghi nhận nghỉ việc** (FR-hrm-036), không còn là cập nhật thường.

| | |
|:---|:---|
| **Trường thêm** | `ngay_nghi_viec` — chuỗi ngày `YYYY-MM-DD`. **Bắt buộc** khi chuyển `1` sang `0`; bỏ qua ở các trường hợp khác |
| **Ràng buộc** | Phải là ngày có thật; **không sớm hơn** `ngay_vao_lam`. Ngày ở **tương lai là hợp lệ** (báo trước nghỉ việc) |
| **Giao dịch** | Đổi trạng thái + lưu ngày nghỉ + chốt hợp đồng nằm trong **một** giao dịch (BR-hrm-055) |

**Response 200** — phải liệt kê hợp đồng vừa bị chốt, không được làm âm thầm:

```json
{
  "success": true,
  "data": {
    "ma_nv": "NV0002",
    "ngay_nghi_viec": "2026-09-30",
    "hop_dong_da_chot": [
      { "id": "0a4f1c7e-…", "so_hd": "HĐLĐ-001/2026", "loai_hd": "khong_xac_dinh", "ngay_ket_thuc": "2026-09-30" }
    ]
  }
}
```

| Mã | Status | Khi nào |
|:---|:---:|:---|
| **E-hrm-052** | 400 | Chuyển sang đã nghỉ mà không gửi `ngay_nghi_viec` |
| **E-hrm-053** | 400 | `ngay_nghi_viec` sớm hơn `ngay_vao_lam` |
| **E-hrm-054** | 409 | Còn hợp đồng có `ngay_bat_dau` **sau** `ngay_nghi_viec` — hủy toàn bộ giao dịch, không đổi trạng thái và không chốt hợp đồng nào |

> **Dữ liệu cũ:** nhân viên đã mang `status = "0"` từ trước đợt này có `ngay_nghi_viec` **rỗng** và không có nguồn nào suy ra được. Mã đọc phải chịu được `null` ở đây — xem `data-model.md` M-10. Chiều ngược lại (đưa về đang làm) **chưa chốt**, xem OQ-hrm-12.

### 3.5. `DELETE /nhan-vien/:ma_nv` — xóa MỀM

- **Hành vi:** `da_xoa = true`. **Không** xóa/ẩn dữ liệu con ở tầng DB — hợp đồng, NPT, tài liệu
  vẫn nằm nguyên, chỉ **vô hình** vì mọi truy vấn con đều lọc `nhan_vien.da_xoa = false`
  (`hopDong.service.ts:172-174`, `nguoiPhuThuoc.service.ts:59-61`, `taiLieu.service.ts:55-57`).
- **Response 200:**

```json
{ "success": true, "data": { "ma_nv": "NV0002", "so_npt_an_theo": 1 } }
```

> 🚨 **LỆCH FE ↔ BE ĐANG TỒN TẠI**: `hdđt_maxv/src/features/hrm/api/nhanVienApi.ts:112` khai kiểu
> trả về là `{ ma_nv, so_npt_da_xoa }`, còn BE trả `so_npt_an_theo` (`nhanVien.service.ts:242`).
> FE đọc trường không tồn tại ⇒ `undefined`. Sửa **phía FE** (BE đúng ngữ nghĩa: "ẩn theo", không
> phải "đã xóa"). Xem ĐS-04.

> ❗ File scan trên Google Drive của nhân viên **không bị đụng tới**. Xóa mềm nhân viên xong,
> thư mục `<ma_nv> - <họ tên>` và toàn bộ file vẫn nằm trên Drive công ty. Là chủ ý (giữ hồ sơ
> gốc), nhưng phải nói rõ với khách. Xem `ADR-004`.

---

## 4. Hợp đồng — `/api/v1/hrm/hop-dong`

Service: `services/client/hrm/hopDong.service.ts` · Validator: `validators/hrm/hopDong.validator.ts`

### 4.1. `GET /hop-dong` — lịch sử hợp đồng

| | |
|:---|:---|
| **Query** | `ma_nv` — **hiện tùy chọn**; `[SỬA THEO QĐ #8]` mức đã chốt là **BẮT BUỘC**, thiếu thì trả lỗi kiểm dữ liệu (E-hrm-006) |
| **Quyền** | `[MỚI — QĐ #8]` chỉ người **được cấp quyền xem dữ liệu lương** mới gọi được cả nhóm `/hop-dong`; không có quyền thì **403 E-hrm-058** (BR-hrm-059) |
| **Thứ tự** | `ma_nv ASC`, rồi `ngay_bat_dau DESC`, `datetime0 DESC`, `id DESC` (`:180`) |
| **Phân trang** | Không |

> 🚨 **`ma_nv` KHÔNG bắt buộc — và FE đang khai thác đúng điều đó.** Gọi `GET /hop-dong` trần trả
> về **toàn bộ hợp đồng của mọi nhân viên** trong tenant (`:175` chỉ thêm điều kiện khi `q.ma_nv`
> khác rỗng). Đã kiểm chứng phía FE: `hdđt_maxv/src/features/hrm/api/hopDongQueries.ts:67-75`
> (`useDanhSachHopDong`) gọi `listHopDong()` **không tham số**, rồi `useHopDongList(maNv)` (`:78-91`)
> mới `filter` phía client.
>
> ⇒ **Lương của toàn bộ nhân viên đang được gửi xuống trình duyệt của bất kỳ ai mở màn hồ sơ**,
> kể cả khi họ chỉ xem một người. Đây là rò rỉ dữ liệu qua thiết kế, không phải chuyện hiệu năng.
> Tài liệu cũ viết `GET /hop-dong?ma_nv=...` như thể bắt buộc — sai. Cách sửa (BE + FE làm cùng
> lúc): `ADR-005` Mục 2.
>
> ✅ **Đã chốt QĐ #8** — hai việc phải làm **cùng một lượt**: (a) máy chủ bắt buộc `ma_nv` và chặn theo quyền xem lương; (b) giao diện đổi `listHopDong()` không tham số thành gọi theo từng nhân viên. Siết máy chủ trước mà chưa sửa giao diện thì màn hợp đồng trắng ngay lập tức với mọi người dùng. `ADMIN` **không** liên quan tới quyền này — vẫn không có phạm vi tenant, đã chốt giữ nguyên ở QĐ #9 (BR-hrm-051).

Luôn ngầm lọc `nhan_vien.da_xoa = false`.

**Response 200 (mỗi phần tử):**

```json
{
  "id": "0a4f1c7e-2b83-4f6d-9a1e-8b7c6d5e4f30",
  "ma_nv": "NV0001",
  "so_hd": "HĐLĐ-001/2026",
  "loai_hd": "khong_xac_dinh",
  "kieu_luong": "gross",
  "luong_chinh": "25000000",
  "luong_bhxh": "10000000",
  "ngay_bat_dau": "2026-01-01T00:00:00.000Z",
  "ngay_ket_thuc": null,
  "trich_bhxh": true,
  "tinh_tncn": true,
  "ghi_chu": null
}
```

`luong_chinh` / `luong_bhxh` là **chuỗi** (Prisma Decimal). FE `hopDongApi.ts:9-20` ghi đúng.

### 4.2. `POST /hop-dong` — tạo hợp đồng

**Body** (`hopDongBodySchema`):

| Field | Kiểu | Bắt buộc | Ràng buộc |
|:---|:---|:---:|:---|
| `ma_nv` | string | **Có** | 1..24, tự `UPPER`; nhân viên phải tồn tại & chưa xóa |
| `so_hd` | string | **Có** | trim, 1..100. **Không unique ở DB** — trùng số hợp đồng vẫn lưu được |
| `loai_hd` | string | **Có** | trim, 1..24, **chữ tự do**. Gợi ý FE: `khong_xac_dinh`\|`xac_dinh`\|`thu_viec`\|`thoi_vu`\|`khoan` |
| `kieu_luong` | enum | **Có** | `gross` \| `net` |
| `luong_chinh` | number | Không (mặc định `0`) | ≥ 0, ≤ 999.999.999.999,99, bội số `0.01` |
| `luong_bhxh` | number | Không (mặc định `0`) | như trên |
| `ngay_bat_dau` | `YYYY-MM-DD` | **Có** | Ngày có thật |
| `ngay_ket_thuc` | `YYYY-MM-DD` \| null | Không | `null` = **vô thời hạn**; nếu có thì phải **> `ngay_bat_dau`** (không cho phép bằng) |
| `trich_bhxh` | boolean | Không (mặc định `true`) | |
| `tinh_tncn` | boolean | Không (mặc định `true`) | |
| `ghi_chu` | string \| null | Không | ≤ 512 |

**Response 201:** `{ "success": true, "data": { "id": "<uuid>" } }`

**Tác dụng phụ bắt buộc biết — luật công đoàn một chiều** (`apDungLuatCongDoan`, `:161-167`):
nếu `loaiHdVeNhanVien(loai_hd) === 'hdvc'` (tức `loai_hd === 'khoan'`) thì service **ghi
`hrm_nhan_vien.cong_doan = false`** trong cùng transaction. Rời khỏi khoán **không** tự bật lại.

| Mã tài liệu | HTTP | Message | Điều kiện | Bằng chứng |
|:---|:---:|:---|:---|:---|
| `E-hrm-016` | 404 | `Không tìm thấy nhân viên` | `ma_nv` không tồn tại / đã xóa mềm | `:32-41,188` |
| `E-hrm-006` | 400 | `errors.fieldErrors.ngay_ket_thuc = ["Ngày kết thúc phải sau ngày bắt đầu"]` | | `hopDong.validator.ts:67-78` |

> 🚨 **Hiện trạng: KHÔNG có kiểm tra chồng lấn khoảng ngày** ở `createHopDong` (`:185-193`). Tạo 2 hợp đồng
> `01/01→31/03` và `15/02→15/05` cho cùng nhân viên đều **thành công**. Đây là ISSUE-HRM-01. Xem `ADR-002`.

#### 4.2b. Bốn phép kiểm phải thêm vào cả `POST` và `PUT` — chưa có trong mã

| # | Phép kiểm | Lỗi | Nguồn |
|:--:|:---|:---|:---|
| 1 | Chồng lấn khoảng ngày với hợp đồng **cùng NHÓM NGHIỆP VỤ** của cùng nhân viên (không phải cùng nhãn `loai_hd`). Ba nhóm: **hợp đồng lao động** (`khong_xac_dinh` + `xac_dinh` + `thoi_vu` + mọi nhãn lạ) · **khoán/dịch vụ** (`khoan`) · **thử việc** (`thu_viec`). Khác nhóm thì **cho phép** chạy song song | 409, tên ràng buộc `hrm_hop_dong_khong_chong_lan` | `[SỬA THEO QĐ #1 và #18]` BR-hrm-022 |
| 2 | `so_hd` **duy nhất trong cả công ty**, so khớp đúng chuỗi sau khi cắt khoảng trắng hai đầu, phân biệt hoa thường | **E-hrm-055** 409 | `[MỚI — QĐ #4]` BR-hrm-056 |
| 3 | `luong_chinh` **lớn hơn 0** | **E-hrm-056** 400 | `[MỚI — QĐ #5]` BR-hrm-057 |
| 4 | `trich_bhxh = true` thì `luong_bhxh` **lớn hơn 0** | **E-hrm-057** 400 | `[MỚI — QĐ #5]` BR-hrm-058 |

> **Phép gom nhóm phải dùng CHUNG một hàm** với hàm đang gom để hiển thị, và hàm đó **hạ chữ thường + cắt khoảng trắng** trước khi so. Không gom nhóm mà khóa theo nhãn thô thì một người có ba hợp đồng lao động chồng nhau, mỗi cái một nhãn, và phân hệ Lương cộng ba mức lương (BUG-HRM-27). Ràng buộc ở cơ sở dữ liệu dùng hàm `hrm_nhom_hd(loai_hd)` — xem `data-model.md` M-01, SQL đã chạy thật và xác nhận hành vi.
>
> Kèm theo: **chuẩn hóa `loai_hd` về chữ thường khi ghi**. Hiện trường này chỉ được cắt khoảng trắng, khác `ma_nv` và `ma_pb` đều được in hoa. Việc chuẩn hóa là để dữ liệu lưu sạch — ràng buộc ở tầng cơ sở dữ liệu đã tự an toàn nhờ hàm gom nhóm.

`[SỬA THEO QĐ #6]` Luật ngày đổi: `ngay_ket_thuc` được phép **bằng** `ngay_bat_dau` (hợp đồng một ngày là hợp lệ). Wording E-hrm-019 phải đổi từ "phải sau" sang "phải bằng hoặc sau". Kéo theo: khoảng ngày dùng để kiểm chồng lấn phải **đóng ở cả hai đầu** — dùng khoảng nửa mở thì hợp đồng một ngày có độ dài bằng không và lọt qua mọi phép kiểm giao cắt.

**Rà dữ liệu trước khi bật:** phép kiểm 2 và 3 áp lên dữ liệu đang chạy. Dòng sinh từ `be_maxv/src/scripts/backfill-hop-dong.ts` nhiều khả năng có `luong_chinh = 0`; bật validator mà chưa dọn thì **mọi lần sửa hợp đồng cũ đều fail**. Xem `data-model.md` M-07.

### 4.3. `POST /hop-dong/doi` — đổi hợp đồng (nguyên tử)

**Body** = body của `POST /hop-dong` **cộng thêm** `ngay_chot` và `loai_hd_can_chot`:

| Field | Kiểu | Bắt buộc | Ràng buộc |
|:---|:---|:---:|:---|
| `ngay_chot` | `YYYY-MM-DD` \| null | Không | Ngày chốt hợp đồng **đang hiệu lực**. Nếu có, hợp đồng mới phải có `ngay_bat_dau > ngay_chot` |
| `loai_hd_can_chot` | chuỗi ≤ 24 | **Có** `[MỚI — QĐ #1]` | Cho biết chốt hợp đồng thuộc **loại nào**. Máy chủ tìm hợp đồng đang hiệu lực **trong đúng loại đó**, không tìm trong toàn bộ lịch sử. Thiếu trường trả **E-hrm-006** (BR-hrm-053) |

> **Vì sao trường này bắt buộc:** từ khi hai hợp đồng khác loại được phép chạy song song (QĐ #1), bước 2 của luồng dưới đây — `findFirst` hợp đồng đang hiệu lực — trở nên **mơ hồ**. Đổi hợp đồng lao động chính lại vô tình chốt mất hợp đồng khoán đang chạy, và không có gì báo.

Hai luật chéo ở validator (`hopDong.validator.ts:101-112`):
1. `ngay_ket_thuc > ngay_bat_dau` (nếu có `ngay_ket_thuc`).
2. `ngay_bat_dau > ngay_chot` (nếu có `ngay_chot`) — chống hai hợp đồng cùng hiệu lực.

**Luồng trong `db.$transaction`** (`doiHopDong`, `:224-273`):

```
1. assertNhanVienTonTai(ma_nv)                          → 404 nếu không có
2. cu = hợp đồng đang hiệu lực HÔM NAY của ma_nv
      (ngay_bat_dau <= hôm nay AND (ngay_ket_thuc null OR >= hôm nay)),
      lấy ngay_bat_dau muộn nhất
   [SỬA THEO QĐ #1] phải lọc thêm loai_hd = loai_hd_can_chot
   [SỬA] "hôm nay" phải dùng homNayVN(), không dùng setUTCHours — xem cảnh báo dưới
3. nếu có `cu`:
      3a. thiếu ngay_chot            → 409
      3b. ngay_chot <= cu.ngay_bat_dau → 409
      3c. UPDATE cu.ngay_ket_thuc = ngay_chot
4. CREATE hợp đồng mới (id = uuid)
5. apDungLuatCongDoan(ma_nv, loai_hd)
```

**Response 201:**

```json
{ "success": true, "data": { "id": "<uuid-moi>", "da_chot_hop_dong_cu": true } }
```

`da_chot_hop_dong_cu` báo theo **việc đã làm**, không theo thứ client gửi: nhân viên chưa có hợp
đồng nào thì `false` kể cả khi client vẫn truyền `ngay_chot` (`:270-272`).

| Mã tài liệu | HTTP | Message | Bằng chứng |
|:---|:---:|:---|:---|
| `E-hrm-016` | 404 | `Không tìm thấy nhân viên` | `:230` |
| `E-hrm-021` | 409 | `Nhân viên đang có hợp đồng hiệu lực — phải chọn ngày chốt hợp đồng cũ.` | `:246-250` |
| `E-hrm-022` | 409 | `Ngày chốt phải sau ngày bắt đầu của hợp đồng đang hiệu lực.` | `:254-258` |
| `E-hrm-006` | 400 | `fieldErrors.ngay_bat_dau = ["Hợp đồng mới phải bắt đầu sau ngày chốt hợp đồng cũ"]` | validator `:105-111` |
| `E-hrm-006` | 400 | `fieldErrors.loai_hd_can_chot` — thiếu loại hợp đồng cần chốt | `[MỚI — QĐ #1]` BR-hrm-053 |
| `E-hrm-055` | 409 | Số hợp đồng đã tồn tại trong công ty | `[MỚI — QĐ #4]` |
| `E-hrm-056` / `E-hrm-057` | 400 | Ràng buộc lương của hợp đồng mới | `[MỚI — QĐ #5]` |

> **Một điểm chưa chốt:** từ khi hợp đồng một ngày được cho phép (QĐ #6), lý do cũ của E-hrm-022 (`ngay_chot` phải **sau** `ngay_bat_dau` của hợp đồng đang hiệu lực) không còn đúng — chốt đúng ngày bắt đầu nghĩa là hợp đồng một ngày, mà điều đó giờ hợp lệ. Đợt này **giữ nguyên hành vi cũ**, xem OQ-hrm-15.

> 🚨 **Sai lệch múi giờ trong chính file này**: bước 2 dùng `new Date()` + `setUTCHours(0,0,0,0)`
> (`hopDong.service.ts:233-234`), **KHÔNG** dùng `homNayVN()` như phần đọc (`:97`). Từ 00:00 đến
> 06:59 giờ VN, hai chỗ hiểu "hôm nay" lệch nhau một ngày ⇒ hợp đồng bắt đầu đúng hôm nay được
> `GET /nhan-vien` coi là hiện hành nhưng `POST /hop-dong/doi` lại **không tìm thấy để chốt**,
> tạo ra hai hợp đồng chồng lấn im lặng. Đây chính là loại lỗi mà docblock `:56-59` cảnh báo
> phải tránh. Xem `ADR-002` Mục "Hệ quả", mục sửa (1).

### 4.4. `PUT /hop-dong/:id` — sửa hợp đồng

- **Path param:** `id` (chuỗi ≥ 1 — **không** ép định dạng UUID).
- **Body** = body `POST` **bỏ `ma_nv`** (không chuyển hợp đồng sang nhân viên khác).
  Mọi trường bắt buộc vẫn bắt buộc ⇒ **thay toàn bộ**, không phải PATCH.
- **Response 200:** `{ "success": true, "data": { "id": "<uuid>" } }`
- Chạy trong `$transaction`, và **cũng gọi `apDungLuatCongDoan`** — sửa `loai_hd` thành `khoan`
  sẽ tắt cờ công đoàn của nhân viên (`:215`).

| Mã tài liệu | HTTP | Message | Bằng chứng |
|:---|:---:|:---|:---|
| `E-hrm-023` | 404 | `Không tìm thấy hợp đồng` | `:202-209` (cũng 404 khi nhân viên đã xóa mềm) |
| `E-hrm-006` | 400 | Zod | validator |

> 🚨 Cũng **không** kiểm tra chồng lấn. Sửa `ngay_bat_dau` của hợp đồng cũ đè lên hợp đồng khác
> vẫn thành công.

### 4.5. `DELETE /hop-dong/:id` — xóa CỨNG

- **Hành vi:** `DELETE` thật khỏi DB (`:290`) — khóa chính là UUID nên không có chuyện cấp lại mã.
- **Response 200:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **404:** `Không tìm thấy hợp đồng`.

> ⚠️ Không có ràng buộc nào chặn xóa hợp đồng đã dùng để tính lương (phân hệ Payroll chưa có).
> Đây là ISSUE-HRM-03 do QA nêu — thống nhất **hoãn tới khi có Payroll**, và khi đó phải là
> `onDelete: Restrict` từ bảng lương chứ không phải kiểm tra ở service. Ghi trong `ADR-002` Mục
> "Hệ quả".

---

## 5. Người phụ thuộc — `/api/v1/hrm/nguoi-phu-thuoc`

Service: `services/client/hrm/nguoiPhuThuoc.service.ts` · Validator: `validators/hrm/nguoiPhuThuoc.validator.ts`

### 5.1. `GET /nguoi-phu-thuoc`

| | |
|:---|:---|
| **Query** | `ma_nv` (tự `UPPER`, so khớp **chính xác**), `ho_ten` (`contains`, không phân biệt hoa thường) |
| **Thứ tự** | `ma_nv ASC`, `ho_ten ASC` (`:69`) |
| **Phân trang** | Không |

Ngầm lọc `nhan_vien.da_xoa = false`. Trả `[]` sớm khi rỗng (`:72`).

**Response 200 (mỗi phần tử):**

```json
{
  "id": "9f1c...",
  "ma_nv": "NV0001",
  "ho_ten": "Nguyễn Thị B",
  "quan_he": "con",
  "ngay_sinh": "20/05/2015",
  "so_cccd": null,
  "mst": "8123456789",
  "dien_thoai": null,
  "dia_chi": "Hà Nội",
  "dk_tu_thang": 1,
  "dk_tu_nam": 2026,
  "dk_den_thang": 12,
  "dk_den_nam": 2026,
  "ten_nv": "Nguyễn Văn A"
}
```

`ten_nv` tra lúc đọc từ `hrm_nhan_vien` (`:74-82`), **không lưu trùng** trong bảng NPT.
`ngay_sinh` giữ nguyên dạng chữ `dd/MM/yyyy` (khác nhân viên).

### 5.2. `POST /nguoi-phu-thuoc`

| Field | Kiểu | Bắt buộc | Ràng buộc |
|:---|:---|:---:|:---|
| `ma_nv` | string | **Có** | 1..24, tự `UPPER` |
| `ho_ten` | string | **Có** | 1..200 |
| `quan_he` | string \| null | Không | ≤ 50, **chữ tự do** (gợi ý FE: `vo`/`chong`/`con`/`bo`/`me`/`anh_chi_em`/`khac`) |
| `ngay_sinh` | string \| null | Không | **`dd/MM/yyyy`**, soát ngày có thật (chặn `32/13/2020`, `30/02/2026`) |
| `so_cccd` | string \| null | Không | ≤ 20 |
| `mst` | string \| null | Không | `MST_REGEX` |
| `dien_thoai` | string \| null | Không | ≤ 20 |
| `dia_chi` | string \| null | Không | ≤ 255 |
| `dk_tu_thang` / `dk_den_thang` | int \| null | Không | 1..12 |
| `dk_tu_nam` / `dk_den_nam` | int \| null | Không | 2000..2100 |

Ba luật chéo (`soatKyDangKy`, `:104-150`): có tháng phải có năm; có năm phải có tháng; đủ 4 số thì
`(den_nam*12 + den_thang) >= (tu_nam*12 + tu_thang)`.

#### 5.2b. Duy nhất mã số thuế CÓ XÉT KỲ `[SỬA THEO QĐ #7 và #19]` — chưa có trong mã

Hiện ràng buộc là `@@unique([ma_nv, mst])`, chỉ chặn trùng **trong cùng một nhân viên** (BUG-HRM-05, 🔴 Critical — giảm trừ gia cảnh tính hai lần, sai thuế thu nhập cá nhân).

**Mức đã chốt:** trong phạm vi một công ty, hai người phụ thuộc cùng `mst` **không được có kỳ giảm trừ giao nhau**. Không phải chặn phẳng theo `mst`.

| Tình huống | Kết quả | Vì sao |
|:---|:---|:---|
| Cùng `mst`, kỳ **giao nhau** (kể cả ở hai nhân viên khác nhau) | **409 E-hrm-026**, thông điệp nêu đích danh mã và họ tên nhân viên đang giữ | Luật thuế: mỗi người phụ thuộc chỉ giảm trừ cho một người nộp thuế **tại một thời điểm** |
| Cùng `mst`, kỳ **nối tiếp** (A tới hết 06/2026, B từ 07/2026) | **201** | Ca chuyển người kê khai giữa năm — có thật và hợp pháp. Giữ được lịch sử kê khai cả năm |
| Cùng `mst`, kỳ chạm nhau **đúng một tháng** | **409** | Khoảng tính theo tháng, **đóng hai đầu**: trong tháng đó cả hai đều được giảm trừ |
| `mst` rỗng | **201**, nhập nhiều dòng được | Chỉ chặn khi đã biết mã số thuế |
| Dòng thuộc nhân viên **đã xóa mềm** | Phép kiểm ở tầng ứng dụng **bỏ qua** | Một lần nhập nhầm không được khóa vĩnh viễn mã số thuế khỏi cả công ty (BR-hrm-030) |

Khi sửa, phép kiểm **loại trừ chính dòng đang sửa** — mẫu `boQuaId` đã có sẵn ở `nguoiPhuThuoc.service.ts:93-114`.

> ⚠️ **Ràng buộc ở tầng cơ sở dữ liệu chặt hơn luật nghiệp vụ một chút**: nó không bỏ qua được dòng thuộc nhân viên đã xóa mềm (ràng buộc loại trừ không tham chiếu bảng khác). Đây là nợ kỹ thuật đã chấp nhận — xem `data-model.md` M-09. Hệ quả: một ca hiếm bị chặn kèm thông báo chung chung thay vì thông báo nghiệp vụ rõ.

**Response 201:** `{ "success": true, "data": { "id": "<uuid>" } }`

| Mã tài liệu | HTTP | Message | Bằng chứng |
|:---|:---:|:---|:---|
| `E-hrm-016` | 404 | `Không tìm thấy nhân viên` | `:33-45,121` |
| `E-hrm-026` | 409 | `Nhân viên <ma_nv> đã có người phụ thuộc mang MST <mst> — đăng ký trùng sẽ tính giảm trừ gia cảnh hai lần.` | `:93-114` |
| `E-hrm-007` | 409 | `Dữ liệu bị trùng, vui lòng thử lại` | `@@unique([ma_nv, mst])` chặn cứng khi 2 request đua nhau |
| `E-hrm-006` | 400 | Zod (`Ngày sinh phải theo định dạng dd/MM/yyyy`, `Ngày sinh không có thật: <v>`, `Có tháng đăng ký thì phải có năm`, …) | validator |

> ℹ️ `mst = null` **không** bị chặn trùng (Postgres coi mỗi NULL là khác nhau) — cố ý: hồ sơ chưa
> biết MST vẫn nhập được nhiều dòng (`:99`, schema `:948-951`).

> ⚠️ **Ghi chú thiết kế `POST` không chạy trong transaction** (`:121-126`): kiểm tra nhân viên và
> chống trùng MST nằm ngoài `$transaction`, khác `hopDong`/`taiLieu`. Rủi ro thấp (unique constraint
> ở DB là chốt cuối, FK cascade bảo vệ `ma_nv`) nhưng **không đồng nhất**. Xem Mục 9.5.

### 5.3. `PUT /nguoi-phu-thuoc/:id`

- Body = body `POST` **bỏ `ma_nv`**. Toàn bộ trường bắt buộc giữ nguyên ⇒ thay toàn bộ.
- Chống trùng MST **loại trừ chính dòng đang sửa** (`:144`).
- **404:** `Không tìm thấy người phụ thuộc`.

### 5.4. `DELETE /nguoi-phu-thuoc/:id` — xóa CỨNG

- `DELETE` thật khỏi DB (`:165`).
- **Response 200:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **404:** `Không tìm thấy người phụ thuộc`.

---

## 6. Hồ sơ tài liệu (metadata) — `/api/v1/hrm/tai-lieu`

Service: `services/client/hrm/taiLieu.service.ts` · Validator: `validators/hrm/taiLieu.validator.ts`

### 6.1. `GET /tai-lieu`

| | |
|:---|:---|
| **Query** | `ma_nv` (tự `UPPER`, chính xác), `loai` (**chính xác, PHÂN BIỆT hoa thường**) |
| **Thứ tự** | `ma_nv ASC`, `loai ASC` (`:231`) |
| **Phân trang** | Không |

> ⚠️ `loai` lọc bằng so khớp **chính xác và có phân biệt hoa thường** (`:226`) trong khi `loai` là
> chữ tự do do người dùng nhập. `?loai=CCCD` sẽ không ra dòng lưu `cccd`. Xem Mục 9.6.

**Response 200 (mỗi phần tử):**

```json
{
  "id": "3d2a...",
  "ma_nv": "NV0001",
  "loai": "cccd",
  "so_hieu": "001090012345",
  "ngay_cap": "2021-05-20T00:00:00.000Z",
  "noi_cap": "Cục CSQLHC về TTXH",
  "ghi_chu": null,
  "drive_file_id": "1AbCdEf...",
  "ten_file": "cccd-mat-truoc.jpg",
  "mime_type": "image/jpeg",
  "kich_thuoc": 284512,
  "ten_nv": "Nguyễn Văn A"
}
```

`drive_file_id = null` ⇒ chỉ có thông tin giấy tờ, **chưa đính file scan**.

### 6.2. `POST /tai-lieu` — tạo bản ghi giấy tờ (KHÔNG kèm file)

| Field | Kiểu | Bắt buộc | Ràng buộc |
|:---|:---|:---:|:---|
| `ma_nv` | string | **Có** | 1..24, tự `UPPER` |
| `loai` | string | **Có** | 1..50, **chữ tự do** (gợi ý FE: `cccd`, `ho_chieu`, `bang_cap`, `chung_chi`, `so_yeu_ly_lich`) |
| `so_hieu` | string \| null | Không | ≤ 64 |
| `ngay_cap` | `YYYY-MM-DD` \| null | Không | Ngày có thật |
| `ngay_het_han` | `YYYY-MM-DD` \| null | Không | `[MỚI — QĐ #14]` Ngày có thật, **bằng hoặc sau** `ngay_cap` (bằng nhau là hợp lệ). Vi phạm trả **E-hrm-060** 400. **`null` nghĩa là giấy tờ KHÔNG có hạn**, không phải "chưa biết hạn" (BR-hrm-062) |
| `noi_cap` | string \| null | Không | ≤ 254 |
| `ghi_chu` | string \| null | Không | ≤ 512 |

Chạy trong `$transaction` (kiểm nhân viên + create) — `:256-263`.

**Response 201:** `{ "success": true, "data": { "id": "<uuid>" } }` · **404:** `Không tìm thấy nhân viên`.

### 6.3. `PUT /tai-lieu/:id`

Body = body `POST` **bỏ `ma_nv`**. Không đụng tới trường file. **404:** `Không tìm thấy tài liệu`.

### 6.4. `DELETE /tai-lieu/:id` — xóa CỨNG bản ghi

- **Response 200:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **404:** `Không tìm thấy tài liệu`.

> 🚨 **HIỆN TRẠNG (BUG-HRM-10)**: `deleteTaiLieu` (`taiLieu.service.ts:124-135`) chỉ
> `db.hrm_tai_lieu.delete`, không có lời gọi Drive nào ⇒ **file scan mồ côi vĩnh viễn** trên Drive
> của khách, không còn con trỏ nào để xóa. Cách dùng đúng **hiện nay**: gọi
> `DELETE /tai-lieu/:id/file` **trước**, rồi mới `DELETE /tai-lieu/:id`.

**`[SỬA THEO QĐ #12]` Mức đã chốt — chưa có trong mã** (BR-hrm-039):

1. Xóa dòng thì **xóa luôn file trên Drive**, theo kiểu **cố hết sức**.
2. Drive báo lỗi thì **ghi log và VẪN xóa dòng** — lỗi Drive **không** được chặn thao tác nghiệp vụ. Đây là điểm dễ làm ngược: bọc lời gọi Drive trong transaction rồi rollback khi Drive lỗi là biến một sự cố bên ngoài thành lỗi nghiệp vụ.
3. Giao diện phải hỏi xác nhận **nêu đích danh tên file sắp mất** (`ten_file`), vì thao tác không hoàn tác được.
4. Ghi nhật ký người thao tác — nhóm 4 của BR-hrm-066 `[MỚI — QĐ #15]`.

**Response 200** bổ sung cờ cho biết Drive có xóa được không, để giao diện nói thật:

```json
{ "success": true, "data": { "id": "<uuid>", "da_xoa_file_drive": true } }
```

---

## 7. Tích hợp Google Drive — `/api/v1/hrm/tai-lieu/drive/*` và `/tai-lieu/:id/file`

Controller: `controllers/client/hrm/taiLieu.controller.ts` · Service: `services/client/hrm/taiLieuDrive.service.ts`
· HTTP client: `services/client/hrm/driveClient.ts`

**Mô hình:** Drive liên kết ở **cấp CÔNG TY** (`don_vi` trong DB `maxv2_sys`), không phải cấp người dùng.
Scope xin của Google: `https://www.googleapis.com/auth/drive.file email` (`driveClient.ts:32`) — app chỉ
thấy file do **chính nó** tạo, không đọc được Drive sẵn có của khách.

Cây thư mục: `maxv / <MST> - <Tên công ty> / <ma_nv> - <họ tên> / <file scan>` (`taiLieuDrive.service.ts:33-36`).

### 7.1. Kiểm tra quyền riêng cho nhóm Drive

3 endpoint `/drive/*` **không** đi qua `resolveTenantDb` (không cần DB tenant), nên chúng tự kiểm
lại quyền bằng `donViDangChon(req)` (`taiLieu.controller.ts:84-91`): bắt buộc có `req.user.donViId`
**và** `canAccessDonVi(userId, role, donViId)` phải `true`. Lý do: access token sống 15 phút và cố ý
không đối chiếu DB mỗi request — người vừa bị gỡ quyền vào MST vẫn cầm token hợp lệ tới khi hết hạn.

**`[SỬA THEO QĐ #10]` Siết quyền theo vai trò — chưa có trong mã (BUG-HRM-11):**

| Thao tác | Hiện trạng | Mức đã chốt |
|:---|:---|:---|
| `GET /tai-lieu/drive/trang-thai` | `OWNER` + `OWNER_EMPLOYEE` | Giữ nguyên |
| `GET /tai-lieu/drive/lien-ket` — **kết nối lần đầu** | `OWNER` + `OWNER_EMPLOYEE` — chỉ chặn khi công ty **đã** kết nối (`taiLieu.controller.ts:148-151`) | **Chỉ `OWNER`**, trả **E-hrm-059** 403 |
| `GET /tai-lieu/drive/lien-ket` — **đổi** tài khoản | Chỉ `OWNER` (E-hrm-041) | Giữ nguyên |
| `DELETE /tai-lieu/drive/ket-noi` | Chỉ `OWNER` (E-hrm-042) | Giữ nguyên |
| `POST` / `GET` / `DELETE /tai-lieu/:id/file` | `OWNER` + `OWNER_EMPLOYEE` | **Giữ nguyên** — nối xong thì mọi người có quyền vào công ty đều dùng được |

Siết là siết ở việc **chọn Drive của ai**, không phải ở việc dùng. Lý do (BR-hrm-045): để người không phải chủ tài khoản nối lần đầu là để hồ sơ scan của **cả công ty** rơi vào Drive **cá nhân** của một nhân viên, mà công ty không có cách nào lấy lại khi người đó nghỉ.

> **Phải sửa giao diện cùng lượt với máy chủ.** Người không phải chủ tài khoản không được thấy nút "Kết nối Google Drive" rồi bấm vào và nhận 403 — giao diện hiện thẳng thông báo nhờ chủ tài khoản liên kết Drive.

### 7.2. `GET /tai-lieu/drive/trang-thai`

**Response 200:**

```json
{ "success": true, "data": { "may_chu_san_sang": true, "da_ket_noi": true, "email": "ketoan@congty.vn" } }
```

| Trường | Nghĩa |
|:---|:---|
| `may_chu_san_sang` | Máy chủ đã có đủ `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI` **và** khóa mã hóa `GDT_CRED_ENC_KEY` |
| `da_ket_noi` | Công ty này đã có `driveRefreshTokenCipher` |
| `email` | Tài khoản Google đang dùng (`null` nếu chưa kết nối hoặc Google không trả email) |

Lỗi: 403 `Tài khoản chưa gắn với công ty nào` / `Bạn không có quyền truy cập công ty này`.

### 7.3. `GET /tai-lieu/drive/lien-ket` — lấy URL đồng ý OAuth

**Response 200:** `{ "success": true, "data": { "url": "https://accounts.google.com/o/oauth2/v2/auth?..." } }`

**Tác dụng phụ:** đặt cookie `driveOauthState` (`httpOnly`, `sameSite=lax`, `secure` khi production,
`path` = đúng path callback, `maxAge` 600s) — `taiLieu.controller.ts:110-118,154`.

**Phân quyền có điều kiện** (`:148-151`):

| Trạng thái | Ai gọi được |
|:---|:---|
| Chưa kết nối lần nào | **Mọi** user có quyền MST (để luồng "bấm thêm file → đăng nhập Google" chạy trọn) |
| Đã kết nối | **Chỉ `OWNER`** — 403 `Công ty đã kết nối Google Drive. Chỉ chủ tài khoản mới đổi được sang tài khoản Google khác, vì việc đó chuyển toàn bộ file scan sau này sang Drive mới.` |

FE phải mở URL bằng **popup**, không redirect cả trang (redirect làm mất object `File` người dùng
vừa chọn). Ghi chú ở `:126-139`.

| Mã tài liệu | HTTP | Message |
|:---|:---:|:---|
| `E-hrm-043` | 409 | `Máy chủ chưa cấu hình Google Drive (thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI).` |
| `E-hrm-041` | 403 | `Công ty đã kết nối Google Drive. Chỉ chủ tài khoản mới đổi được...` |

### 7.4. `GET /tai-lieu/drive/callback` — Google gọi về

| | |
|:---|:---|
| **Auth** | **Miễn đăng nhập** (`config.khongCanAuth`, `taiLieu.route.ts:29-33`) — điều hướng top-level từ `accounts.google.com` nên cookie access `SameSite=Strict` không được gửi kèm |
| **Xác thực thay thế** | 3 lớp: (a) `state` ký **HMAC-SHA256** kèm hạn 10 phút và nonce 9 byte; (b) `state` phải **khớp cookie `driveOauthState`** của đúng trình duyệt đã xin; (c) cookie bị **xóa ngay** trước mọi nhánh trả về ⇒ mỗi vé dùng đúng 1 lần, từ đúng 1 máy |
| **Query** | `code`, `state`, `error` (do Google đặt) |
| **Response** | **HTML 200** (không phải JSON) — trang popup tự đóng, kèm `Content-Security-Policy: default-src 'none'; script-src 'nonce-<random>'; …` và `x-content-type-options: nosniff` |

Chi tiết bảo mật (`taiLieu.controller.ts:189-267`, `driveClient.ts:453-489`):
- Chữ ký HMAC dùng `env.jwtAccessSecret` nhưng có **tiền tố tách miền** `drive-state|` để không
  bao giờ trùng không gian với JWT.
- So sánh chữ ký bằng `timingSafeEqual`.
- Mọi chuỗi nhét vào HTML đều qua `thoatHtml()` (escape 5 ký tự) — đây là chỗ **duy nhất** trong
  dự án trả HTML tự dựng bằng nối chuỗi.
- `error` từ Google chỉ vào log, **không** hiển thị (là tham số URL, ai cũng đặt được).
- Log của app cắt query string cho **mọi** route (`app.ts` serializer) để `code`/`state` không nằm
  trong file log.

Các thông điệp trên trang popup:

| Tình huống | Chữ hiển thị | Tự đóng sau |
|:---|:---|:---|
| Thành công | `Đã kết nối Google Drive (<email>).` | 300 ms |
| Người dùng từ chối (`error`) | `Bạn chưa cấp quyền truy cập Google Drive.` | 4000 ms |
| Thiếu `code`/`state` | `Thiếu tham số trả về từ Google.` | 4000 ms |
| Cookie không khớp / đã dùng | `Phiên kết nối không hợp lệ hoặc đã dùng rồi. Hãy bấm thêm file lại từ đầu, trên chính trình duyệt này.` | 4000 ms |
| State sai chữ ký / hết hạn | `Phiên kết nối không hợp lệ hoặc đã hết hạn.` | 4000 ms |
| Lỗi nghiệp vụ của mình (`ConflictError`) | Chính message đó (vd thiếu `GDT_CRED_ENC_KEY`) | 4000 ms |
| Lỗi khác (gồm mọi lỗi Google) | `Không kết nối được Google Drive. Vui lòng thử lại.` | 4000 ms |

**Tác dụng phụ khi thành công** (`luuKetNoiDrive`, `taiLieuDrive.service.ts:83-132`):
ghi `driveEmail` + `driveRefreshTokenCipher/Iv/Tag` (AES-256-GCM) vào `don_vi`, đặt
`driveRootFolderId = null`; nếu **đổi sang tài khoản Google khác** thì còn xóa mọi
`hrm_nhan_vien.drive_folder_id` trong DB tenant (`quenThuMucNhanVien`, `:150-161`).

> ℹ️ FE **không** nhận `postMessage` — trang popup thuộc origin API, khác origin FE. FE hỏi lại
> `GET /tai-lieu/drive/trang-thai` sau khi popup đóng (`:199-203`).

### 7.5. `DELETE /tai-lieu/drive/ket-noi` — ngắt kết nối

- **Chỉ `OWNER`**: 403 `Chỉ chủ tài khoản mới ngắt được kết nối Google Drive của công ty.`
- **Response 200:** `{ "success": true, "data": { "da_ngat": true } }`
- **Tác dụng phụ:** xóa 5 cột Drive trên `don_vi` + xóa mọi `hrm_nhan_vien.drive_folder_id`.
  **KHÔNG** đụng `hrm_tai_lieu.drive_file_id` (cố ý: giữ dấu vết khách từng đính giấy tờ gì;
  file vẫn nằm ở tài khoản Google cũ).

### 7.6. `POST /tai-lieu/:id/file` — tải file scan lên Drive

| | |
|:---|:---|
| **Content-Type** | `multipart/form-data`, **đúng 1 file** (`limits.files = 1`) |
| **Tên field** | Bất kỳ (`req.file()` lấy file đầu tiên); FE dùng `"file"` |
| **Trần dung lượng** | **10 MB** — chặn 2 lớp: `@fastify/multipart` `limits.fileSize` (`app.ts`) và `GIOI_HAN_FILE_BYTE` ở service (`taiLieuDrive.service.ts:43,322-326`) |
| **MIME cho phép** | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf` (`:46-52`) |

**Response 201:**

```json
{
  "success": true,
  "data": { "id": "3d2a...", "ten_file": "cccd-mat-truoc.jpg", "mime_type": "image/jpeg", "kich_thuoc": 284512 }
}
```

**Luồng:** tìm tài liệu → soát cỡ + MIME → lấy token công ty (giải mã AES-GCM) → đổi access token →
tạo/lấy thư mục công ty → tạo/lấy thư mục nhân viên → upload `multipart/related` → **nếu đã có file
cũ thì xóa file cũ SAU khi upload mới thành công** (`:345-349`, thà thừa 1 file còn hơn mất cả hai)
→ ghi 4 cột con trỏ vào `hrm_tai_lieu`.

| Mã tài liệu | HTTP | Message | Bằng chứng |
|:---|:---:|:---|:---|
| `E-hrm-036` | 409 | `Không nhận được file nào.` | `taiLieu.controller.ts:303` |
| `E-hrm-032` | 409 | `File vượt quá 10MB.` | `:307-311` (multipart) và `taiLieuDrive.service.ts:322-326` (service) |
| `E-hrm-034` | 409 | `Yêu cầu phải gửi dạng multipart/form-data.` | `:312-314` |
| `E-hrm-035` | 409 | `Mỗi lần chỉ tải lên được một file.` | `:315-317` |
| `E-hrm-033` | 409 | `Chỉ nhận ảnh (JPG, PNG, WEBP, HEIC) hoặc PDF — file gửi lên là "<mime>".` | `taiLieuDrive.service.ts:327-331` |
| `E-hrm-039` | 409 | `Công ty chưa kết nối Google Drive — bấm "Thêm file" để đăng nhập Google và kết nối.` | `:193-199` |
| `E-hrm-040` | 409 | `Kết nối Google Drive đã hết hiệu lực (bị thu hồi quyền), vui lòng kết nối lại.` | `:206-209` (giải mã hỏng) và `:238-241` (`invalid_grant`) |
| `E-hrm-043` | 409 | `Máy chủ chưa cấu hình Google Drive (thiếu …).` | `driveClient.ts:46-52` |
| `E-hrm-031` | 404 | `Không tìm thấy tài liệu` | `:296-311` |
| `E-hrm-016` | 404 | `Không tìm thấy nhân viên` | `:274-281` (lúc tạo thư mục NV) |
| `E-hrm-045` | 502 | `Google Drive đang không phản hồi đúng nên chưa xử lý được file scan. Vui lòng thử lại sau ít phút; nếu vẫn lỗi, báo quản trị viên kiểm tra cấu hình Google Drive.` | `errorHandler.plugin.ts:66-77` khi `DriveApiError.status != 0` |
| `E-hrm-046` | 502 | `Máy chủ không kết nối được tới Google nên chưa xử lý được file scan. Đây là sự cố mạng phía máy chủ, không phải do dữ liệu bạn nhập — vui lòng thử lại sau ít phút hoặc báo quản trị viên.` | `DriveApiError.status === 0` |

**Xử lý token bị thu hồi (quan trọng):** chỉ khi Google trả **đúng mã `invalid_grant`** thì hệ thống
mới tự `ngatKetNoiDrive` (xóa token đã lưu) — `taiLieuDrive.service.ts:231-244`. **Không** bám dải
4xx, vì `invalid_client` (người vận hành gõ sai `GOOGLE_CLIENT_SECRET`) và 429 (nhiều tenant dùng
chung OAuth client) cũng là 4xx; bắt theo dải thì **một lần gõ nhầm env sẽ xóa refresh token của
TOÀN BỘ tenant**, không cứu lại được.

### 7.7. `GET /tai-lieu/:id/file` — xem/tải file scan

| | |
|:---|:---|
| **Response** | **Binary nguyên bản**, KHÔNG envelope |
| **Headers** | `Content-Type: <mime đã lưu>` (fallback `application/octet-stream`); `Content-Disposition: inline; filename*=UTF-8''<tên đã encode>`; `Cache-Control: no-store, private`; `X-Content-Type-Options: nosniff` |

> ⚠️ **Không phải streaming thật.** Backend tải **toàn bộ** byte vào RAM (`Buffer.concat`,
> `driveClient.ts:411-423`) rồi `reply.send(buffer)`. Trần 10 MB được kiểm **hai lớp** ở đường về:
> theo `content-length` và theo tổng byte đã đọc — vì file nằm trên Drive **của khách**, họ thay
> bằng file 2 GB lúc nào cũng được. Tài liệu cũ ghi "streaming backend" là không chính xác về mặt
> kỹ thuật (đúng về mặt "proxy qua backend"). Xem Mục 9.4.

| Mã tài liệu | HTTP | Message |
|:---|:---:|:---|
| `E-hrm-031` | 404 | `Không tìm thấy tài liệu` |
| `E-hrm-037` | 404 | `Tài liệu này chưa đính file scan.` |
| `E-hrm-038` | 404 | `Không mở được file trên Google Drive. Có thể file đã bị xóa, hoặc nó nằm ở tài khoản Google mà công ty từng kết nối trước đây. Vui lòng kiểm tra tài khoản Drive đang kết nối, hoặc tải lại file scan.` (Drive trả 404) |
| `E-hrm-045/06` | 502 | Như Mục 7.6 |

FE phải lấy bằng `fetch` + Blob (`taiLieuApi.ts:taiFileVe`), **không** trỏ `<img src>` thẳng —
thẻ `<img>` đi ngoài lớp `apiFetch` nên không kích hoạt được cơ chế tự làm mới token khi 401.

### 7.8. `DELETE /tai-lieu/:id/file` — gỡ file, giữ bản ghi

- Xóa file trên Drive **rồi** xóa 4 cột con trỏ (`drive_file_id`, `ten_file`, `mime_type`, `kich_thuoc`).
- Drive trả 404 được coi là **đã xong** (khách tự xóa tay trước đó) — `driveClient.ts:438-443`.
- **Response 200:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **404:** `Không tìm thấy tài liệu` / `Tài liệu này chưa đính file scan.`

---

## 7B. Bộ giấy tờ bắt buộc và cảnh báo hạn `[MỚI — QĐ #14]` — chưa có trong mã

Hai nhóm endpoint mới sinh ra từ QĐ #14 (BR-hrm-062…065, FR-hrm-038…041). Cùng quy ước chung ở Mục 1: envelope `{success, data}`, prefix `/api/v1/hrm`, đi qua `authenticate` + `requireModule('hrm')` + `resolveTenantDb`.

### 7B.1. `GET /giay-to-bat-buoc` — danh mục bộ giấy tờ bắt buộc

| | |
|:---|:---|
| **Query** | `loai_hd` (tùy chọn) — lọc theo loại hợp đồng |
| **Thứ tự** | `loai_hd ASC`, rồi `loai_giay_to ASC` |
| **Phân trang** | Không — danh mục cỡ hàng chục dòng |

**Response 200 (mỗi phần tử):**

```json
{
  "id": "3f2a9c1d-…",
  "loai_hd": "khong_xac_dinh",
  "loai_giay_to": "cccd",
  "bat_buoc": true,
  "ghi_chu": null
}
```

> **Danh mục rỗng là trạng thái hợp lệ và là mặc định** (BR-hrm-063). Công ty chưa khai thì không ai bị coi là thiếu hồ sơ. Hệ thống **không** cài sẵn nội dung cho bất kỳ công ty nào — nội dung cụ thể chưa ai chốt (OQ-hrm-13), seed sẵn là bịa quy định nhân sự thay khách.

### 7B.2. `POST /giay-to-bat-buoc` — thêm dòng danh mục

| Field | Kiểu | Bắt buộc | Ràng buộc |
|:---|:---|:---:|:---|
| `loai_hd` | string | **Có** | 1..24, chữ tự do — khớp `hrm_hop_dong.loai_hd`, **không** ép enum |
| `loai_giay_to` | string | **Có** | 1..50, chữ tự do — khớp `hrm_tai_lieu.loai` |
| `bat_buoc` | boolean | Không | Mặc định `true`. `false` = nên có nhưng **không** tính vào chỉ báo thiếu hồ sơ |
| `ghi_chu` | string \| null | Không | ≤ 512 |

- **Response 201:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **E-hrm-061** 409: trùng cặp (`loai_hd`, `loai_giay_to`) trong công ty.

**Không có khóa ngoại tới `loai_hd`** — không tồn tại bảng danh mục loại hợp đồng để trỏ tới. Hệ quả chấp nhận: khai bộ giấy tờ cho một loại hợp đồng không ai dùng thì dòng đó vô hại nhưng vô dụng, và **không có gì báo**.

### 7B.3. `PUT /giay-to-bat-buoc/:id` · `DELETE /giay-to-bat-buoc/:id`

- `PUT`: body = body `POST`, thay toàn bộ. **E-hrm-061** khi đổi thành cặp đã tồn tại.
- `DELETE`: xóa cứng. **Không** guard theo dữ liệu đang dùng — bỏ một loại giấy tờ khỏi danh mục chỉ làm chỉ báo đủ/thiếu tính lại ở lần đọc sau, không đụng dòng `hrm_tai_lieu` nào.
- **404:** `Không tìm thấy dòng danh mục`.

> **Ai được sửa danh mục này chưa chốt** — chỉ chủ tài khoản hay cả người được cấp quyền? Xem OQ-hrm-13. Tới khi chốt, áp mức quyền mặc định của nhóm HRM (`OWNER` + `OWNER_EMPLOYEE`).

### 7B.4. `GET /tai-lieu/sap-het-han` — danh sách giấy tờ hết hạn và sắp hết hạn

| | |
|:---|:---|
| **Query** | `ma_nv` (tùy chọn), `loai` (tùy chọn) |
| **Thứ tự** | `ngay_het_han ASC` — sắp hết hạn nhất lên đầu |
| **Phạm vi** | Mọi nhân viên `da_xoa = false`, **kể cả người đã nghỉ việc** — giấy tờ của người đã nghỉ vẫn dùng khi quyết toán (BR-hrm-065) |

**Response 200 (mỗi phần tử):**

```json
{
  "id": "8c1e…",
  "ma_nv": "NV0001",
  "ho_ten": "Nguyễn Văn A",
  "loai": "ho_chieu",
  "so_hieu": "C1234567",
  "ngay_het_han": "2026-10-15",
  "trang_thai_han": "da_het_han"
}
```

`trang_thai_han` nhận `da_het_han` hoặc `sap_het_han`, tính lúc đọc theo **giờ Việt Nam**, cùng mốc `homNayVN()` mà hợp đồng dùng.

> 🚨 **Nhánh `sap_het_han` CHƯA DÙNG ĐƯỢC.** Ngưỡng cảnh báo bao nhiêu ngày và khai ở đâu **chưa ai chốt** (OQ-hrm-14). Tới khi chốt, endpoint này **chỉ** trả giấy tờ `da_het_han`. **Không** được tự đặt một con số mặc định rồi cảnh báo theo nó — cảnh báo sai ngưỡng còn tệ hơn không cảnh báo, vì người dùng sẽ học cách bỏ qua nó.

---

## 7C. Cấp và thu hồi quyền xem dữ liệu lương `[MỚI — QĐ #8 + #17]` — chưa có trong mã

> **Đây là endpoint DUY NHẤT của đợt này nằm ngoài prefix `/api/v1/hrm`.** Quyền xem lương là thuộc tính của cặp (người dùng, công ty) nên nó sống ở control plane, cùng chỗ với việc cấp quyền vào công ty. Không có nhóm này thì BR-hrm-059 **chặn được nhưng không cấp được cho ai** — mọi người dùng không phải chủ tài khoản mất hoàn toàn màn hợp đồng (FR-hrm-044).

### 7C.1. Mở rộng `PUT /api/v1/companies/employees/:userId/access`

Endpoint **đã tồn tại** (`services/client/company.service.ts:356-394`) và hiện chỉ nhận danh sách công ty. Mở rộng để nhận thêm cờ quyền lương cho từng công ty.

| | |
|:---|:---|
| **Quyền gọi** | Chỉ `OWNER`, và chỉ với nhân viên thuộc chính mình — giữ nguyên guard hiện có |
| **Body — hiện tại** | `{ "donViIds": ["<id>", "<id>"] }` |
| **Body — mức đã chốt** | `{ "access": [ { "donViId": "<id>", "xemLuong": true }, { "donViId": "<id>", "xemLuong": false } ] }` |

- **Response 200:** `{ "success": true, "data": { "userId": "<id>", "so_cong_ty": 2 } }`
- **404:** nhân viên không tồn tại, không thuộc chủ tài khoản này, hoặc không phải vai trò nhân viên.
- **403:** có công ty trong danh sách không thuộc chủ tài khoản.

> 🚨 **Bẫy bắt buộc xử lý cùng lượt — cách ghi hiện tại là replace-set.** `setEmployeeAccess` xóa **toàn bộ** bản ghi phân quyền của nhân viên rồi tạo lại (`company.service.ts:384-394`). Giữ nguyên cách đó mà chỉ thêm cột thì **mỗi lần chủ tài khoản sửa danh sách công ty là xóa sạch mọi quyền xem lương đã cấp** — âm thầm, không lỗi, không nhật ký (BUG-HRM-28). Phải đổi sang ghi **theo cặp khóa** (`userId`, `donViId`), hoặc đọc cờ cũ ra rồi ghi lại kèm.

### 7C.2. Đọc quyền ở đâu

**Trong đúng truy vấn của `resolveTenantInfo`** (`helpers/resolveTenantDb.ts`) — mọi request HRM đã gọi hàm đó rồi, nên lấy thêm cờ này **đo thật: tốn thêm ~0,36 ms mỗi lượt gọi** (0,80 → 1,17 ms, trung bình 200 lần trên cơ sở dữ liệu thật). Không phải 0 như bản trước khẳng định: Prisma bắn **một truy vấn riêng** cho quan hệ vì `relationJoins` không bật.

**Cấm đưa vào vé đăng nhập.** Vé sống 15 phút và cố ý không đối chiếu dữ liệu mỗi lượt; nhét cờ quyền vào đó thì thu hồi quyền trễ 15 phút, im lặng (BR-hrm-068). Đây là điều mà chính Mục 7.1 của tài liệu này đã phân tích đúng cho nhóm Drive.

### 7C.3. Bước chuyển dữ liệu khi bật lần đầu

`[QĐ #17, BR-hrm-069]` Cột mang mặc định **không được xem**, nhưng migration **phải kèm** bước cấp quyền cho **toàn bộ bản ghi phân quyền đang tồn tại** (`data-model.md` M-13). Không có bước này thì mọi kế toán đang làm việc mất màn hợp đồng trong ngày triển khai. Từ đó về sau, bản ghi mới mặc định không được xem và phải cấp riêng.

### 7C.4. Giao diện đi kèm

Màn phân quyền ở ứng dụng `maxv/` phải có ô tick quyền xem lương cho từng công ty. Không có màn này thì cột dữ liệu cũng vô dụng — đây là lý do QĐ #8 từng bị đóng lại ở vòng phản biện.

---

## 8. Bảng mã lỗi — ánh xạ ID nghiệp vụ ↔ nơi ném lỗi trong code

> **Nguồn canonical của ID lỗi là `docs/hrm/srs/hrm-spec.md` Mục 8 (Ma trận lỗi, `E-hrm-001..051`).**
> Tài liệu này **KHÔNG tạo bộ mã thứ hai** — nó chỉ nói mỗi ID đó được ném **ở dòng code nào**,
> để Backend biết chỗ sửa và QA biết chỗ đặt điểm kiểm.
>
> ⚠️ Code **hiện chưa trả trường `code`** trong phản hồi — client chỉ nhận `message`. Nghĩa là QA
> đang phải đối chiếu bằng **chuỗi tiếng Việt**. Đề xuất bổ sung `code` vào envelope (giữ nguyên
> `message` và status): `ADR-005` Mục 1.

### 8.1. Chung — xác thực, phạm vi, nhập liệu

| ID | HTTP | Ném ở đâu trong code |
|:---|:---:|:---|
| `E-hrm-001` | 401 | `plugins/jwt.plugin.ts:41` — `UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED)` |
| `E-hrm-002` | 403 | `services/shared/modules.service.ts:104-108` — `assertModuleAllowed` |
| `E-hrm-003` | 403 | `helpers/resolveTenantDb.ts:38-41` — chưa chọn công ty |
| `E-hrm-004` | 403 | `helpers/resolveTenantDb.ts:44-54` — hết quyền vào MST (2 nhánh) |
| `E-hrm-005` | 404 | `helpers/resolveTenantDb.ts:55-57` — `don_vi.dbName` null |
| `E-hrm-006` | 400 | `utils/validate.ts:10` — mọi `validateBody/Query/Params`. **Body chỉ có `errors`, KHÔNG có `message`** |
| `E-hrm-007` | 409 | `plugins/errorHandler.plugin.ts:88-92` — Prisma `P2002` |

### 8.2. Phòng ban

| ID | HTTP | Ném ở đâu trong code |
|:---|:---:|:---|
| `E-hrm-008` | 404 | `phongBan.service.ts:199-206` (update), `:226-233` (delete); **và** `nhanVien.service.ts:80-92` khi gán `ma_pb` không tồn tại |
| `E-hrm-009` | 404 | `phongBan.service.ts:73-80` — `assertPhongBanMeHopLe` |
| `E-hrm-010` | 409 | `phongBan.service.ts:70-72` |
| `E-hrm-011` | 409 | `phongBan.service.ts:98-100` — `assertKhongVongLap` |
| `E-hrm-012` | 409 | `phongBan.service.ts:172-179` |
| `E-hrm-013` | 409 | `phongBan.service.ts:246-250` |
| `E-hrm-014` | 409 | `phongBan.service.ts:251-262` |
| `E-hrm-015` | 409 | `phongBan.service.ts:22-29` — `kiemTraDoDaiMa` |

> ℹ️ SRS Mục 9 (UC-hrm-03) đang trỏ lỗi "phòng ban không tồn tại khi tạo nhân viên" về `E-hrm-009`.
> Code ném **`Không tìm thấy phòng ban`** = wording của `E-hrm-008`, không phải `Phòng ban cha
> không tồn tại`. Đề nghị BA sửa tham chiếu ở UC-hrm-03 thành `E-hrm-008`.

### 8.3. Nhân viên

| ID | HTTP | Ném ở đâu trong code |
|:---|:---:|:---|
| `E-hrm-016` | 404 | `nhanVien.service.ts:157-164, 202-209, 228-235`; `hopDong.service.ts:32-41`; `nguoiPhuThuoc.service.ts:33-45`; `taiLieu.service.ts:38-41`; `taiLieuDrive.service.ts:274-281` |
| `E-hrm-017` | 409 | `nhanVien.service.ts:182-189` — **không lọc `da_xoa`** (trùng mã đã xóa vẫn là trùng) |
| `E-hrm-018` | 409 | `nhanVien.service.ts:67-71` |

### 8.4. Hợp đồng

| ID | HTTP | Ném ở đâu trong code |
|:---|:---:|:---|
| `E-hrm-019` | 400 | `hopDong.validator.ts:67-78` — `soatNgay`, áp cho cả 3 schema |
| `E-hrm-020` | 400 | `hopDong.validator.ts:105-111` — chỉ ở `/change` |
| `E-hrm-021` | 409 | `hopDong.service.ts:246-250` |
| `E-hrm-022` | 409 | `hopDong.service.ts:254-258` |
| `E-hrm-023` | 404 | `hopDong.service.ts:202-209` (update), `:278-285` (delete) |
| `E-hrm-024` | 409 | ❌ **CHƯA CÓ TRONG CODE.** Wording + nơi đặt: `ADR-002` Mục B (Lớp 1) |

### 8.5. Người phụ thuộc

| ID | HTTP | Ném ở đâu trong code |
|:---|:---:|:---|
| `E-hrm-025` | 404 | `nguoiPhuThuoc.service.ts:135-142, 155-162` |
| `E-hrm-026` | 409 | `nguoiPhuThuoc.service.ts:100-113` — `assertKhongTrungMst` (bỏ qua khi `mst` null) |
| `E-hrm-027` · `E-hrm-028` | 400 | `nguoiPhuThuoc.validator.ts:24-30` (sai khuôn) · `:42-47` (ngày không có thật) |
| `E-hrm-029` · `E-hrm-030` | 400 | `nguoiPhuThuoc.validator.ts:117-132` · `:139-149` — `soatKyDangKy` |

### 8.6. Tài liệu & file scan

| ID | HTTP | Ném ở đâu trong code |
|:---|:---:|:---|
| `E-hrm-031` | 404 | `taiLieu.service.ts:105-110, 292-299`; `taiLieuDrive.service.ts:296-311` (`timTaiLieu`) |
| `E-hrm-032` | 409 | **2 chỗ**: `taiLieu.controller.ts:307-311` (multipart chặn trước) và `taiLieuDrive.service.ts:322-326` (service chặn lại) |
| `E-hrm-033` | 409 | `taiLieuDrive.service.ts:327-331` |
| `E-hrm-034` | 409 | `taiLieu.controller.ts:312-314` |
| `E-hrm-035` | 409 | `taiLieu.controller.ts:315-317` |
| `E-hrm-036` | 409 | `taiLieu.controller.ts:303` |
| `E-hrm-037` | 404 | `taiLieuDrive.service.ts:377-379` (xem) · `:413-415` (gỡ) |
| `E-hrm-038` | 404 | `taiLieuDrive.service.ts:396-403` — chỉ khi `DriveApiError.status === 404` |

### 8.7. Kết nối Google Drive

| ID | HTTP | Ném ở đâu trong code |
|:---|:---:|:---|
| `E-hrm-039` | 409 | `taiLieuDrive.service.ts:193-199` |
| `E-hrm-040` | 409 | **2 nhánh khác hẳn nhau**: `:206-209` (giải mã hỏng — **KHÔNG** ngắt kết nối) và `:238-241` (Google trả `invalid_grant` — **CÓ** ngắt kết nối). QA phải tách 2 ca |
| `E-hrm-041` | 403 | `taiLieu.controller.ts:148-151` |
| `E-hrm-042` | 403 | `taiLieu.controller.ts:281-283` |
| `E-hrm-043` | 409 | `driveClient.ts:46-52` — `DriveChuaCauHinhError` (kế thừa `ConflictError`) |
| `E-hrm-044` | 409 | `taiLieuDrive.service.ts:87-93` |
| `E-hrm-045` | 502 | `plugins/errorHandler.plugin.ts:66-77` khi `DriveApiError.status !== 0` |
| `E-hrm-046` | 502 | `plugins/errorHandler.plugin.ts:73-74` khi `DriveApiError.status === 0` |

### 8.8. Trang callback OAuth (HTML 200, không phải JSON)

| ID | Ném ở đâu trong code |
|:---|:---|
| `E-hrm-047` | `taiLieu.controller.ts:230-234` — query `error` từ Google |
| `E-hrm-048` | `taiLieu.controller.ts:235` — thiếu `code`/`state` |
| `E-hrm-049` | `taiLieu.controller.ts:239-245` — cookie không khớp / đã dùng |
| `E-hrm-050` | `taiLieu.controller.ts:247-250` — `docState` trả `null` (sai chữ ký hoặc quá 10 phút) |
| `E-hrm-051` | `taiLieu.controller.ts:255-266` — nhánh `catch`; chỉ `ConflictError` mới hiện nguyên văn |

### 8.9. Ba mã lỗi kỹ thuật — ĐÃ ĐƯỢC CẤP ID (2026-09-07)

Ba nhánh này do `errorHandler` trả cho **mọi** endpoint HRM.

> ⚠️ **Đã đổi số.** Bản trước đề xuất `E-hrm-052/053/054`, nhưng đợt chốt nghiệp vụ 16/16 đã cấp
> đúng ba mã đó cho nhóm lỗi **ghi nhận nghỉ việc** (QĐ #3). Xung đột này được phát hiện ở bước
> BA đối soát chéo và xử lý bằng cách dời ba lỗi kỹ thuật xuống **`E-hrm-062/063/064`**.
> Mã cũ trong tài liệu hay mã nguồn nào còn dùng `E-hrm-052/053/054` với nghĩa kỹ thuật đều SAI.

| ID | HTTP | Message | Nguồn |
|:---|:---:|:---|:---|
| `E-hrm-062` | 404 | `Bản ghi không còn tồn tại, vui lòng tải lại danh sách` | Prisma `P2025` — `errorHandler.plugin.ts:93-97` |
| `E-hrm-063` | 409 | `Dữ liệu đang được sử dụng ở nơi khác, không thể thực hiện` | Prisma `P2003` — `:98-103` |
| `E-hrm-064` | 500 | `Lỗi máy chủ nội bộ` | fallback — `:106-109` |

`E-hrm-062` xảy ra thật khi hai người cùng thao tác: A mở form sửa, B xóa bản ghi, A bấm lưu —
guard `findOrThrow` đã qua nhưng `update` vỡ ở `P2025`.

### 8.10. Mã lỗi mới từ đợt chốt nghiệp vụ 16/16 — chưa có trong mã

| ID | HTTP | Endpoint | Điều kiện | Quyết định |
|:---|:---:|:---|:---|:---|
| `E-hrm-052` | 400 | `PUT /nhan-vien/:ma_nv` | Chuyển sang đã nghỉ mà thiếu `ngay_nghi_viec` | QĐ #3 |
| `E-hrm-053` | 400 | `PUT /nhan-vien/:ma_nv` | `ngay_nghi_viec` sớm hơn `ngay_vao_lam` | QĐ #3 |
| `E-hrm-054` | 409 | `PUT /nhan-vien/:ma_nv` | Còn hợp đồng bắt đầu **sau** ngày nghỉ — hủy toàn bộ giao dịch | QĐ #3 |
| `E-hrm-055` | 409 | `POST` / `PUT /hop-dong`, `POST /hop-dong/doi` | `so_hd` đã tồn tại trong công ty | QĐ #4 |
| `E-hrm-056` | 400 | `POST` / `PUT /hop-dong`, `POST /hop-dong/doi` | `luong_chinh` không lớn hơn 0 | QĐ #5 |
| `E-hrm-057` | 400 | `POST` / `PUT /hop-dong`, `POST /hop-dong/doi` | Bật `trich_bhxh` mà `luong_bhxh` không lớn hơn 0 | QĐ #5 |
| `E-hrm-058` | 403 | Toàn nhóm `/hop-dong`, và các trường lương của `/nhan-vien` | Không có quyền xem dữ liệu lương | QĐ #8 |
| `E-hrm-059` | 403 | `GET /tai-lieu/drive/lien-ket` (kết nối lần đầu) | Người gọi không phải `OWNER` | QĐ #10 |
| `E-hrm-060` | 400 | `POST` / `PUT /tai-lieu` | `ngay_het_han` sớm hơn `ngay_cap` | QĐ #14 |
| `E-hrm-061` | 409 | `POST` / `PUT /giay-to-bat-buoc` | Trùng cặp (`loai_hd`, `loai_giay_to`) trong công ty | QĐ #14 |

Không có mã lỗi nào cho chồng lấn hợp đồng: ràng buộc `EXCLUDE USING gist` trả SQLSTATE `23P01`,
Prisma **không** map thành `P2002`, nên phải bắt theo **tên ràng buộc** trong `error.message`
(`hrm_hop_dong_khong_chong_lan`) — xem `data-model.md` M-01 và `ADR-002`.

---

## 9. Khoảng trống & Đề xuất kỹ thuật (chưa có trong code)

| # | Vấn đề | Mức | Đề xuất | ADR |
|:---:|:---|:---:|:---|:---|
| 9.1 | **Không chống chồng lấn hợp đồng** — `createHopDong`/`updateHopDong` không kiểm tra giao cắt khoảng ngày (vi phạm BR-03.3) | 🚨 Cao | Pre-check ở service (409 `E-hrm-024`) **+** `EXCLUDE USING gist` ở Postgres | `ADR-002` |
| 9.2 | **Không retry khi sinh mã đụng nhau** — 2 request đồng thời ⇒ người thứ hai nhận 409 vô nghĩa | ⚠️ TB | Vòng lặp thử lại 5 lần bắt `P2002`, giữ nguyên thuật toán "lấp lỗ trống" | `ADR-001` |
| 9.3 | **`DELETE /tai-lieu/:id` bỏ quên file trên Drive** ⇒ file mồ côi vĩnh viễn | ⚠️ TB | Xóa file best-effort **trước** khi xóa dòng; log khi thất bại | `ADR-004` |
| 9.4 | **Tải file về nạp trọn 10 MB vào RAM** mỗi request; 20 người xem cùng lúc = 200 MB | ⚠️ TB | Chuyển sang `reply.send(res.body)` (pipe stream Web → Node) + giữ chặn `content-length` | `ADR-005` |
| 9.5 | **`POST /nguoi-phu-thuoc` không bọc transaction**, khác 2 service cùng nhóm | ℹ️ Thấp | Bọc `$transaction` cho đồng nhất | — |
| 9.6 | **Không phân trang bất kỳ endpoint list nào**; `GET /hop-dong` trần trả lương toàn công ty; `?loai=` phân biệt hoa thường | ⚠️ TB | `limit`/`offset` mặc định 200, `X-Total-Count`; `ma_nv` **bắt buộc** cho `/hop-dong`; `loai` đổi sang `insensitive` | `ADR-005` |
| 9.7 | **Sai lệch múi giờ trong `doiHopDong`** (`setUTCHours` thay vì `homNayVN`) | 🚨 Cao | Thay bằng `homNayVN()` — sửa 2 dòng | `ADR-002` |
| 9.8 | **Không có cột audit** (`nguoi_tao`, `nguoi_sua`) trên bảng `hrm_*`, dù helper `currentUserId(req)` đã có sẵn | ⚠️ TB | Thêm `user_id0`/`user_id2` như quy ước các bảng khác | `ADR-004` |
| 9.9 | **Không có test tự động nào cho HRM** (`be_maxv/src/__tests__/` có 41 file, 0 file HRM) | ⚠️ TB | Tối thiểu: `chonHopDongHienHanh`, `homNayVN`, sinh mã, chống chồng lấn, `docState` HMAC | — |
| 9.10 | **Không phân quyền chức năng trong module** — ai vào được MST là xem/sửa được lương mọi người | ⚠️ TB | Chờ BA chốt (**OQ-ARCH-01**) rồi thêm guard theo vai trò | — |

---

## 10. Đối soát contract ↔ code

> Đợt rà soát này chạy **song song** với BA và Tester-QA (3 Amigos). Nhiều sai lệch được phát hiện
> **đồng thời bởi nhiều vai** — bảng dưới ghi rõ ai đã xử lý để không ai làm lại việc của người khác.

### 10.1. Kết quả đối soát 21 endpoint

Đối chiếu từng endpoint trên 8 tiêu chí: method · path · auth/permission · Zod request schema ·
response schema · HTTP status · mã lỗi + wording · phân trang/lọc/sắp xếp.

| Kết quả | Số endpoint | Chi tiết |
|:---|:---:|:---|
| ✅ **Khớp hoàn toàn** với bản contract mới này | **11** | 4 phòng ban · 4 người phụ thuộc · 3 endpoint Drive (trạng thái / liên kết / ngắt) |
| ⚠️ **Lệch so với bản contract CŨ** (method/path đúng, mô tả sai) | **9** | 5 nhân viên (ngày ISO, envelope, 201, `so_npt_an_theo`) · `GET /hop-dong` (`ma_nv` tùy chọn) · `POST /hop-dong` + `PUT /hop-dong/:id` (ADR nói có chống chồng lấn, code không có) · `GET /tai-lieu/:id/file` ("streaming") |
| ❌ **Tài liệu ghi mà code KHÔNG có** | **1** | `DELETE /tai-lieu/:id` — "tự động xóa file trên Drive (best-effort)" |
| ❌ **Code có mà tài liệu KHÔNG ghi** | **0** | — |
| ❌ **Route tài liệu ghi mà không tồn tại** | **0** | — |

Ngoài phạm vi endpoint: **2 ADR mô tả sai code**, **2 comment lỗi thời trong `schema.prisma`**,
**1 comment lỗi thời ở FE**, **3 vấn đề hành vi phía FE**.

### 10.2. Danh mục sai lệch và trạng thái xử lý

| Mã | Nơi phát hiện | Nội dung | Ai đã xử lý |
|:---|:---|:---|:---|
| ĐS-01 | `qa/test-cases.md` | POST kỳ vọng 200, code trả 201 | ✅ **QA đã sửa** — bộ test hiện ghi rõ `POST → 201` (dòng 7) |
| ĐS-02 | `qa/test-cases.md` | Message vòng lặp thiếu cụm "trong cây tổ chức" | ✅ **QA đã sửa** — TC-hrm-016 |
| ĐS-03 | `srs/hrm-spec.md` BR-02.3 | Chặn xóa PB "chỉ tính NV chưa xóa mềm" | ✅ **BA đã sửa** — BR-hrm-009 nay ghi "tính cả nhân viên đã nghỉ việc" + wording E-hrm-014 khớp code |
| ĐS-04 | `hdđt_maxv/.../nhanVienApi.ts:112` | FE khai `so_npt_da_xoa`, BE trả `so_npt_an_theo` | 🔵 BA đã ghi nhận (spec:845) — **chờ FE sửa code** |
| ĐS-05 | contract cũ Mục 6.1 | `DELETE /tai-lieu/:id` xóa file Drive | ✅ **Đã sửa ở bản này** · QA mở `BUG-HRM-10` · giải pháp: `ADR-004` |
| ĐS-06 | contract cũ Mục 1 | Response ngày `"1990-05-15"` thay vì ISO đầy đủ | ✅ Đã sửa ở bản này (Mục 1.5) |
| ĐS-07 | contract cũ Mục 2–6 | "Response 200 OK" cho mọi POST | ✅ Đã sửa ở bản này (Mục 1.3) |
| ĐS-08 | contract cũ (mọi mục) | Ví dụ JSON là mảng trần, không có envelope | ✅ Đã sửa ở bản này (Mục 1.2) |
| ĐS-09 | contract cũ Mục 4.1 | `GET /hop-dong?ma_nv=...` như thể bắt buộc | ✅ Đã sửa ở bản này · giải pháp: `ADR-005` |
| ĐS-10 | contract cũ Mục 6.2 | Gọi việc nạp buffer là "streaming" | ✅ Đã sửa ở bản này (Mục 7.7) · giải pháp: `ADR-005` |
| ĐS-11 | contract cũ Mục 5 | NPT "xóa cứng" | ✅ Đúng, giữ nguyên |
| ĐS-12 | `CONTEXT_SUMMARY.md` Mục 3 | 21 endpoint, method + path | ✅ Đúng đủ |
| ĐS-13 | `CONTEXT_SUMMARY.md` Mục 1 | Ghi FE là "`fe_maxv` và `hdđt_maxv`" | 🔵 Chỉ `hdđt_maxv` có `features/hrm` — **BA cập nhật ở lần sửa CONTEXT_SUMMARY tới** |
| ĐS-15 | `adr/ADR-001` | "retry 3-5 lần bắt P2002" — **không có trong code** | ✅ **Đã sửa ADR ở đợt này** · QA mở `BUG-HRM-15` |
| ĐS-16 | `adr/ADR-002` | "kiểm tra khoảng thời gian không giao cắt" — **không có trong code** | ✅ **Đã sửa ADR ở đợt này** · QA mở `BUG-HRM-15` |
| ĐS-17 | `prisma/tenant/schema.prisma:956-959` | Docblock nhắc "7 CỘT HỢP ĐỒNG" + hàm `dongBoHopDongHienHanh()` — cả hai **không còn tồn tại** | ✅ Đã kiểm chứng độc lập (grep toàn repo: 0 kết quả) · BA cũng ghi nhận (`srs/hrm-erd.md:163`) · đề xuất sửa: `data-model.md` M-08 |
| ĐS-18 | `prisma/tenant/schema.prisma:1000-1002` | Docblock `hrm_tai_lieu` nói "sẽ thêm cột con trỏ sau" trong khi các cột đó đã có ở `:1010-1013` | 🟢 **Chỉ tài liệu này phát hiện** · đề xuất sửa: `data-model.md` M-08 |
| ĐS-19 | `hdđt_maxv/.../hopDongQueries.ts:67-91` | FE tải **toàn bộ hợp đồng cả công ty** rồi `filter` phía client ⇒ lương mọi nhân viên nằm trong bộ nhớ trình duyệt của bất kỳ ai mở màn hồ sơ | 🟢 **Chỉ tài liệu này phát hiện** · giải pháp (BE + FE cùng lúc): `ADR-005` Mục 2 |
| ĐS-20 | `hdđt_maxv/.../hopDongQueries.ts:93-96` | Comment "BE tự đồng bộ bản sao hợp đồng hiện hành xuống bảng nhân viên" — không còn đúng | ✅ BA cũng ghi nhận (spec:900) · hành vi invalidate **vẫn đúng**, chỉ sửa lời giải thích |
| ĐS-21 | `hdđt_maxv/.../cay.ts:98,115,129` | FE giữ **bản thứ hai** của `sinhMaNhanVien`, `hopDongHienHanh`, `trangThaiHopDong` và **đang dùng thật** ở 5 component | 🟢 **Chỉ tài liệu này phát hiện** · chi tiết + cách dọn: `dev-notes.md` Mục 2.5 |

### 10.3. Đối chiếu với danh mục lỗi của QA

Bộ `qa/issues-and-bugs.md` (24 mục `BUG-HRM-*` + 4 `ISSUE-HRM-*`) và tài liệu kiến trúc này **hội
tụ về cùng kết luận** ở các điểm lớn — dấu hiệu tốt, vì hai bên soi độc lập:

| Phát hiện của QA | Xử lý ở tài liệu kiến trúc |
|:---|:---|
| `ISSUE-HRM-01` chồng lấn hợp đồng | `ADR-002` Mục B — 2 lớp, lộ trình 6 bước |
| `ISSUE-HRM-02` race sinh mã | `ADR-001` — retry-on-P2002 |
| `BUG-HRM-06` `/change` bỏ sót hợp đồng tương lai · `BUG-HRM-07` lỗi múi giờ · `BUG-HRM-08` đua `/change` | `ADR-002` Mục C + D |
| `BUG-HRM-10` không xóa file Drive | `ADR-004` Mục 2 — cùng hướng "Drive trước, DB sau, best-effort" |
| `BUG-HRM-12` `so_hd` không unique | `data-model.md` M-07 (chờ BA — **OQ-ARCH-05**) |
| `BUG-HRM-14` contract sai so với code | Toàn bộ bản contract này |
| `BUG-HRM-15` ADR mô tả cơ chế chưa tồn tại | ADR-001 + ADR-002 đã viết lại, có nhãn "Bản sửa" nói rõ chỗ sai |
| `BUG-HRM-18` không có nhật ký thao tác | `ADR-004` Mục 4 (cột audit) — **bổ sung**: cần cả `writeLog` cho thao tác phá hủy |
| `BUG-HRM-22` không có endpoint khôi phục | `ADR-004` Mục 5 — chấp nhận có chủ ý, ghi rõ |
| **`BUG-HRM-05`** (🔴 Critical) cùng MST đăng ký được ở **hai nhân viên khác nhau** | ➜ **Tiếp nhận**: `data-model.md` M-09 + **OQ-ARCH-08** |
| **`BUG-HRM-11`** (🟠 High) nhân viên thường nối kho tài liệu công ty vào Drive cá nhân | ➜ **Tiếp nhận**: `ADR-003` Mục 4 (ghi chú mâu thuẫn với BR-05.1) + **OQ-ARCH-09** |

---

## 11. Open Questions (chờ BA chốt ở cổng sign-off)

| ID | Câu hỏi | Vì sao cần chốt | Ảnh hưởng |
|:---|:---|:---|:---|
| **OQ-ARCH-01** | Trong một công ty, **mọi** người dùng có quyền vào MST đều được xem lương của toàn bộ nhân viên (`GET /hop-dong` không cần `ma_nv`, `GET /nhan-vien` trả hợp đồng hiện hành)? Hay cần tách vai trò "HR/kế toán lương" riêng? | Lương là dữ liệu nhạy cảm bậc nhất; hiện không có rào nào | Nếu cần tách: thêm guard + đổi contract 2 endpoint |
| **OQ-ARCH-02** | Nhân viên **chỉ có hợp đồng tương lai** (chưa tới ngày hiệu lực) thì màn danh sách nên hiện hợp đồng đó, hay hiện trống kèm nhãn "chưa hiệu lực"? | Code hiện lấy hợp đồng mới nhất bất kể đã hiệu lực chưa (`chonHopDongHienHanh` bước 3) | Đổi 1 dòng service + đổi kỳ vọng test |
| **OQ-ARCH-03** | Đặt nhân viên `status = "0"` (nghỉ việc) có bắt buộc phải chốt `ngay_ket_thuc` hợp đồng đang hiệu lực không? | Hiện không kiểm tra ⇒ người đã nghỉ vẫn "đang có hợp đồng vô thời hạn", Payroll sẽ tính lương nhầm | Thêm luật ở `updateNhanVien` hoặc để Payroll tự lọc |
| **OQ-ARCH-04** | Đặt phòng ban `status = "0"` (ngừng hoạt động) khi còn nhân viên: cho phép, cảnh báo, hay chặn như `DELETE`? | Hiện cho phép im lặng | Thêm luật ở `updatePhongBan` |
| **OQ-ARCH-05** | `so_hd` (số hợp đồng) có phải duy nhất trong 1 công ty không? | DB không có unique; hiện tạo 2 hợp đồng cùng `so_hd` là được | Nếu có: thêm `@@unique([so_hd])` + migration dọn dữ liệu trùng |
| **OQ-ARCH-06** | Xóa mềm nhân viên có cần xóa/lưu trữ file scan trên Drive công ty không (nghĩa vụ bảo vệ dữ liệu cá nhân)? | Hiện giữ nguyên vĩnh viễn | Ảnh hưởng `ADR-004` + thông báo cho khách |
| **OQ-ARCH-07** | Thời hạn lưu trữ (data retention) hồ sơ nhân sự sau khi nhân viên nghỉ việc? | Chưa quy định ở đâu | Ảnh hưởng chính sách xóa cứng + backup |
| **OQ-ARCH-08** | Một người phụ thuộc (cùng MST) có được đăng ký cho **hai nhân viên khác nhau** trong cùng công ty không? | `@@unique([ma_nv, mst])` chỉ chặn trùng **trong cùng 1 nhân viên**. Luật thuế TNCN: mỗi người phụ thuộc chỉ được tính giảm trừ cho **một** người nộp thuế tại một thời điểm ⇒ hiện đang cho phép sai. QA xếp 🔴 Critical (`BUG-HRM-05`) | Nếu cấm: `data-model.md` M-09 (đổi thành unique toàn tenant trên `mst`) + dọn dữ liệu trùng có sẵn |
| **OQ-ARCH-09** | Nhân viên thường (không phải OWNER) có được **nối lần đầu** Drive của công ty không? | Code cho phép, có lý do UX rõ ràng (`taiLieu.controller.ts:144-148`). Nhưng họ có thể nối vào **Drive cá nhân của chính họ** ⇒ mâu thuẫn BR-05.1 "tài liệu thuộc doanh nghiệp". QA xếp 🟠 High (`BUG-HRM-11`) | Nếu siết: chỉ OWNER được nối lần đầu ⇒ kế toán không đính được file cho tới khi gọi được chủ tài khoản. Xem `ADR-003` Mục 4 |

---

## Tham chiếu

- `docs/hrm/architecture/data-model.md` — schema, index, ràng buộc, migration đề xuất
- `docs/hrm/architecture/dev-notes.md` — bản đồ thao tác → route → controller → service
- `docs/hrm/architecture/adr/` — ADR-001..006
- `docs/hrm/srs/hrm-spec.md` — Business Rules & Acceptance Criteria (BA)
- `docs/hrm/qa/test-cases.md`, `docs/hrm/qa/issues-and-bugs.md` — QA
- Tham khảo (KHÔNG phải nghiệp vụ MAXV): `docs/nestjs/hr/architecture/*`
