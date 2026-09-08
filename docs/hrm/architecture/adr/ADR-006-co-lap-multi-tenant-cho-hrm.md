---
type: adr
feature: hrm
status: accepted
updated: 2026-09-07
---

# ADR-006: Cô lập dữ liệu multi-tenant cho HRM

## Context

Hồ sơ nhân sự là dữ liệu nhạy cảm nhất mà MAXV giữ hộ khách: CCCD, MST cá nhân, số tài khoản ngân
hàng, lương, người phụ thuộc, ảnh scan giấy tờ. **Rò rỉ chéo giữa hai công ty là sự cố không thể
sửa được sau khi xảy ra.**

Kiến trúc MAXV đã chọn **DB-per-tenant**: `maxv2_sys` là control plane, mỗi công ty một database
`maxv_<MST>_app`. HRM là module đầu tiên trong dự án vừa đọc DB tenant (5 bảng `hrm_*`) **vừa ghi
DB sys** (token Drive trên `don_vi`) trong **cùng một luồng nghiệp vụ**. Đó là điểm cần soi kỹ:
tenant nào ghi vào `don_vi` của ai, và có chỗ nào lấy `db` của công ty A rồi dùng token của công ty
B không.

ADR này ghi lại **kết quả kiểm chứng thực tế** trên code, chứ không tuyên bố nguyên tắc suông.

## Decision

### 1. Cô lập bằng DATABASE RIÊNG, không bằng cột `tenant_id`

5 bảng `hrm_*` **không có** cột nào chỉ công ty. Ranh giới là **kết nối vật lý**:

```
req.user.donViId  (trong JWT)
   → accessibleDonViWhere(userId, role)      helpers/access.ts:17-24
   → sysPrisma.donVi.findFirst({ ...scope, id: donViId })   resolveTenantDb.ts:48-51
   → don_vi.dbName  ("maxv_<MST>_app")
   → getTenantDb(dbName) → PrismaClient riêng, connection string riêng
```

**Hệ quả tốt:** không có nguy cơ quên `WHERE tenant_id = ?` — lớp bug phổ biến nhất của mô hình
shared-schema. Một câu `findMany` viết ẩu vẫn chỉ chạm được dữ liệu của đúng công ty đang chọn, vì
client Prisma đó **không kết nối tới database nào khác**.

**Hệ quả phải chấp nhận:** không truy vấn chéo công ty được (báo cáo toàn hệ thống phải gom nhiều
kết nối); migration phải chạy trên mọi tenant (xem `ADR-002` mục D); pool kết nối tăng theo số
công ty đang hoạt động (đã có idle-eviction 10 phút, `tenantClient.ts:52-65`).

### 2. Mọi controller HRM PHẢI vào DB tenant qua `resolveTenantDb(req)` — không có ngoại lệ

Đã kiểm **toàn bộ 21 endpoint**:

| Nhóm | Cách lấy quyền | Kết luận |
|:---|:---|:---:|
| `phong-ban` ×4 | `resolveTenantDb(req)` ở dòng đầu mỗi handler (`phongBan.controller.ts:24,31,38,46`) | ✅ |
| `nhan-vien` ×5 | `resolveTenantDb(req)` (`nhanVien.controller.ts:25,32,39,46,54`) | ✅ |
| `hop-dong` ×5 | `resolveTenantDb(req)` (`hopDong.controller.ts:26,33,40,47,55`) | ✅ |
| `nguoi-phu-thuoc` ×4 | `resolveTenantDb(req)` (`nguoiPhuThuoc.controller.ts:24,31,38,46`) | ✅ |
| `tai-lieu` CRUD ×4 | `resolveTenantDb(req)` (`taiLieu.controller.ts:44,51,58,67`) | ✅ |
| `tai-lieu/:id/file` ×3 | `resolveTenantDb(req)` **và** `donViDangChon(req)` | ✅ (xem mục 3) |
| `drive/trang-thai`, `drive/lien-ket`, `drive/ket-noi` | Chỉ `donViDangChon(req)` — **không cần DB tenant** | ✅ |
| `drive/callback` | Miễn đăng nhập, xác thực bằng `state` HMAC + cookie | ✅ (xem mục 4) |

**Không có** service HRM nào nhận `dbName`/`donViId` từ **body hoặc query của client**. Toàn bộ suy
ra từ `req.user.donViId` đã ký trong JWT rồi **kiểm lại trong DB** mỗi request
(`resolveTenantInfo` chạy `findFirst` với `scope` của user, không tin thẳng token).

Quy tắc bắt buộc cho code mới:

> Handler HRM **KHÔNG** được nhận `donViId`, `maSoThue`, `dbName` từ client dưới bất kỳ hình thức
> nào (path, query, body, header). Chỉ có hai đường hợp lệ: `resolveTenantDb(req)` (cần DB tenant)
> và `donViDangChon(req)` (chỉ cần định danh công ty).

### 3. Nhóm Drive tự kiểm quyền lại, vì không đi qua `resolveTenantDb`

Ba endpoint `/drive/*` không cần DB tenant nên trước đây bỏ qua bước kiểm — mà chúng lại **đúng là
chỗ đọc/ngắt/đổi kho tài liệu của cả công ty**. `donViDangChon()` (`taiLieu.controller.ts:84-91`)
lấp chỗ này: bắt buộc có `req.user.donViId` **và** `canAccessDonVi(userId, role, donViId)`.

Vì sao **không** tin thẳng `donViId` trong token: access token sống 15 phút và **cố ý không đối
chiếu DB mỗi request** (`jwt.plugin.ts:32-36`) ⇒ người vừa bị gỡ quyền vào MST vẫn cầm một token
hợp lệ tới hết hạn. `requireModule('hrm')` **không** lấp được — nó xét gói dịch vụ của chủ tài
khoản, **không** xét quyền vào MST cụ thể.

**Ba endpoint file (`/tai-lieu/:id/file`) gọi cả hai**: `resolveTenantDb(req)` để đọc `hrm_tai_lieu`
và `donViDangChon(req)` để lấy token Drive. Hai lời gọi cùng suy từ `req.user.donViId` ⇒ **không thể
lệch nhau** (không có đường nào truyền donViId khác vào). Kiểm chứng: `taiLieu.controller.ts:293,323`
· `:336,340` · `:362,364`.

### 4. `drive/callback` — ngoại lệ miễn đăng nhập, đổi lấy ba lớp xác thực khác

Callback cố ý bật `khongCanAuth` (`taiLieu.route.ts:29-33`) vì Google điều hướng top-level từ
`accounts.google.com`, cookie access `SameSite=Strict` **không** được gửi kèm.

Danh tính công ty **không** lấy từ query mà từ `state` đã ký HMAC + khớp cookie httpOnly + dùng một
lần. Chi tiết đầy đủ: `ADR-003` mục 3.

**Điểm quan trọng với cô lập tenant:** `docState(state)` trả `donViId`, và `luuKetNoiDrive(donViId, code)`
chỉ ghi đúng dòng `don_vi` đó. Không có đường nào để state của công ty A dẫn tới ghi token vào công
ty B, vì `donViId` nằm **trong phần được ký**.

### 5. Ranh giới sys ↔ tenant trong luồng Drive

Hai lần luồng Drive chạm DB tenant từ ngữ cảnh sys — cả hai đều **tự tra `dbName` từ chính
`donViId` đó**, không nhận từ ngoài:

```ts
// quenThuMucNhanVien(donViId) — taiLieuDrive.service.ts:150-161
const dv = await sysPrisma.donVi.findUnique({ where: { id: donViId }, select: { dbName: true } });
if (!dv?.dbName) return;
await getTenantDb(dv.dbName).hrm_nhan_vien.updateMany({ ... });
```

Gọi từ `luuKetNoiDrive` (đổi tài khoản Google) và `ngatKetNoiDrive`. ✅ Không rò chéo.

### 6. Access token Drive tuyệt đối KHÔNG cache ở cấp module

`layAccessToken` (`driveClient.ts:206-221`) đổi refresh token lấy access token **mỗi lần cần**,
**không** giữ trong biến module. Comment tại chỗ nói đúng lý do: *"tiến trình có thể chạy nhiều
tenant, cache nhầm là dùng token của công ty này gọi Drive của công ty khác"*.

**Đây là ràng buộc bắt buộc, không phải tối ưu bỏ được.** Nếu sau này muốn cache để giảm lượt gọi
Google, khóa cache **PHẢI** là `donViId` và phải có test chứng minh không lẫn — không thì đó chính
là lỗ hổng rò rỉ chéo tenant nghiêm trọng nhất có thể tạo ra trong module này.

Đối chiếu: `hangDoiThuMuc` (`:233`) **có** là `Map` cấp module, nhưng khóa là
`` `${idCha ?? 'root'}/${ten}` `` — ID thư mục Drive là duy nhất toàn cầu ⇒ không lẫn giữa tenant.
Điểm yếu của nó là ở chỗ khác (chỉ hiệu lực trong 1 tiến trình), xem `ADR-003` mục Consequences.

### 7. ADMIN không truy cập được dữ liệu HRM của khách — GIỮ NGUYÊN

`accessibleDonViWhere` trả `null` cho `ADMIN` (`helpers/access.ts:23`) ⇒ `resolveTenantInfo` ném
`ForbiddenError` ⇒ **403**. Trong khi `requireModule` lại cho ADMIN qua sớm (`modules.service.ts:125`).

Hai guard nói ngược nhau ở bề mặt, nhưng **kết quả cuối cùng là đúng** và là chủ ý: quản trị viên
MAXV **không** được đọc hồ sơ nhân sự của khách hàng. Ghi lại rõ ở đây vì đây đúng là loại mâu
thuẫn mà người sau sẽ "sửa cho nhất quán" và vô tình mở toang dữ liệu.

> Ai định cho ADMIN vào HRM để hỗ trợ khách: đó là **quyết định nghiệp vụ + pháp lý**, phải qua BA
> và phải có nhật ký truy cập riêng. **Không** sửa `accessibleDonViWhere` như một việc dọn code.

### 8. Rủi ro còn lại và cách canh

| # | Rủi ro | Mức | Canh bằng gì |
|:---:|:---|:---:|:---|
| R1 | Handler mới quên `resolveTenantDb`, dùng thẳng `sysPrisma` hoặc `getTenantDb(<hằng>)` | 🚨 Cao | Quy ước ở `dev-notes.md`; code review chặn; đề xuất thêm test chạy 2 tenant song song |
| R2 | Ai đó cache access token Drive theo module để "tối ưu" | 🚨 Cao | Comment cảnh báo đã có tại `driveClient.ts:203-205`; ghi lại ở ADR này |
| R3 | `hangDoiThuMuc` mất tác dụng khi chạy nhiều tiến trình PM2 | ⚠️ TB | **Không** phải rò rỉ chéo (khóa theo ID thư mục), chỉ tạo thư mục trùng. Ghi vào tài liệu vận hành: HRM Drive chỉ đúng với 1 instance |
| R4 | `getTenantDb` cache theo `dbName`; công ty bị xóa rồi tạo lại cùng MST sẽ trùng `dbName` | ℹ️ Thấp | Đã có `evictTenantDb` gỡ pool ngay trước `DROP DATABASE` (`tenantClient.ts:45-50`) |
| R5 | Không có test tự động nào chứng minh cô lập | ⚠️ TB | Xem Consequences |

## Alternatives

| # | Phương án | Ưu | Nhược | Kết luận |
|:---:|:---|:---|:---|:---|
| **A** | **DB-per-tenant** (đang dùng) | Cô lập vật lý, không lo quên điều kiện lọc; sao lưu/khôi phục/xóa theo từng khách; đáp ứng được yêu cầu "dữ liệu công ty tôi ở đâu" | Migration phải chạy N lần; pool kết nối tăng theo số công ty; không truy vấn chéo | **Giữ** — đây là quyết định cấp dự án, HRM chỉ tuân theo |
| B | Shared schema + cột `tenant_id` | Một DB, migration một lần, báo cáo chéo dễ | **Một câu quên `WHERE tenant_id`** là rò dữ liệu hồ sơ nhân sự giữa các công ty. Với dữ liệu này, rủi ro không tương xứng lợi ích | Không chọn |
| C | Shared schema + Postgres RLS | Cô lập ở tầng DB kể cả khi code quên lọc | Prisma hỗ trợ RLS rất hạn chế (phải `SET LOCAL` mỗi transaction qua `$queryRaw`); dễ sai âm thầm; đổi cả kiến trúc dự án vì một module | Không chọn |
| D | Schema-per-tenant trong 1 DB | Ít kết nối hơn DB-per-tenant | Vẫn phải migration N lần; `search_path` sai là rò chéo; không sao lưu/xóa độc lập được | Không chọn |

## Consequences

- **Kết quả kiểm chứng: KHÔNG phát hiện đường rò rỉ chéo tenant nào** trong 21 endpoint HRM.
  Mọi lối vào DB tenant đều qua `resolveTenantDb`; mọi lối vào token Drive đều qua `donViDangChon`;
  không có access token nào được cache ở cấp module.
- **Quy ước bắt buộc** (ghi vào `dev-notes.md`, nhắc trong mọi code review HRM):
  1. Handler HRM không nhận định danh công ty từ client.
  2. Không cache access token Drive ở cấp module.
  3. Mọi truy vấn bảng con phải lọc `nhan_vien: { da_xoa: false }` (`ADR-004`).
- **Tester-QA — ca kiểm thử cô lập bắt buộc** (hiện **chưa có ca nào**):
  - Dựng 2 công ty A và B, mỗi bên vài nhân viên. User của A gọi mọi endpoint HRM ⇒ **không dòng
    nào của B** xuất hiện.
  - User của A cầm `id` (UUID) một tài liệu/hợp đồng/NPT **của B** gọi `GET`/`PUT`/`DELETE` ⇒
    **404** (không phải 403 — đúng, vì bản ghi đó không tồn tại trong DB của A).
  - Nối Drive cho A, **không** nối cho B ⇒ `GET /drive/trang-thai` của B trả `da_ket_noi: false`;
    upload file ở B trả 409 `DRIVE_CHUA_KET_NOI`.
  - Đổi tài khoản Google của A ⇒ `drive_folder_id` của A bị xóa, **của B nguyên vẹn**.
  - User bị gỡ quyền vào MST nhưng còn access token hợp lệ ⇒ mọi endpoint HRM trả **403**.
  - Tài khoản `ADMIN` gọi endpoint HRM ⇒ **403** (khẳng định hành vi ở mục 7 là chủ ý).
- **DevOps:** mọi migration HRM phải chạy trên **toàn bộ** `maxv_*_app` và bổ sung vào luồng cấp
  DB tenant mới. Migration nào không idempotent (`ADD CONSTRAINT` không có `IF NOT EXISTS`) phải có
  bước kiểm tra trước. Xem `data-model.md` Mục 8.
