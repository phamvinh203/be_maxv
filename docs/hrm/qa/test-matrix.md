# HRM — TEST MATRIX (MA TRẬN BAO PHỦ KIỂM THỬ)

> **Giai đoạn**: Phase A — Shift-Left Spec Review & Test Design (chạy song song với BA và Architect).
> **Phạm vi**: nhóm API Phòng ban & Nhân viên, kèm Lịch sử hợp đồng, Người phụ thuộc, Hồ sơ/Tài liệu + Google Drive.
> **Cập nhật 2026-09-07 (đợt chốt nghiệp vụ 16/16)**: bổ sung nhóm ca `TC-hrm-186…245` (Mục 6B của `test-cases.md`) phủ 12 quyết định vừa chốt, và cập nhật Mục 3.1 vì phần lớn vùng "chờ chốt" nay đã có câu trả lời.
> **Trạng thái**: bộ ca kiểm thử mới **THIẾT KẾ**, **CHƯA CHẠY**. Mọi nhận định về hành vi hệ thống trong tài liệu này là **suy luận từ đọc mã nguồn thật** (có dẫn `file:line`), không phải kết quả chạy runtime. Kết quả chạy thật sẽ nằm ở `qa/test-report.md` (Phase B).

---

## 1. Nguồn đối chiếu (evidence base)

### 1.1 Tài liệu nghiệp vụ / thiết kế

| Nguồn | Dùng để |
|:---|:---|
| `docs/hrm/srs/hrm-spec.md` | BR-01…BR-05, AC-01…AC-03 |
| `docs/hrm/architecture/api-contract.md` | Endpoint, request/response, status |
| `docs/hrm/architecture/data-model.md` | Bảng, index, ràng buộc |
| `docs/hrm/architecture/adr/ADR-001…003` | Quyết định sinh mã / chống chồng lấn / Drive |
| `docs/hrm/CONTEXT_SUMMARY.md` | Bản đồ endpoint |
| `docs/nestjs/hr/tester-qa/*.md` | **Chỉ tham khảo CẤU TRÚC báo cáo** (nền NestJS, không phải nghiệp vụ MAXV) — không ca kiểm thử nào ở đây được bê nguyên từ đó |

### 1.2 Mã nguồn thật (nguồn sự thật cuối cùng)

| Thành phần | Đường dẫn |
|:---|:---|
| Schema tenant | `be_maxv/prisma/tenant/schema.prisma:834-1026` |
| Route + guard | `be_maxv/src/routes/hrm/*.ts`, đăng ký tại `be_maxv/src/routes/index.route.ts:48` |
| Controller | `be_maxv/src/controllers/client/hrm/*.ts` |
| Service | `be_maxv/src/services/client/hrm/*.ts` |
| Validator | `be_maxv/src/validators/hrm/*.ts` + `be_maxv/src/validators/shared/primitives.ts` |
| Ánh xạ lỗi → HTTP | `be_maxv/src/plugins/errorHandler.plugin.ts:23-110` |
| Cô lập tenant | `be_maxv/src/helpers/resolveTenantDb.ts:19-69` |
| Guard module | `be_maxv/src/services/shared/modules.service.ts:120-136` |
| Frontend HRM | `hdđt_maxv/src/features/hrm/` (**KHÔNG phải `fe_maxv`** — đã xác minh `fe_maxv/src/features/` chỉ có `auth, ban_hang, company, ton_kho, tong_hop`) |

### 1.3 Kiểm tra tĩnh đã chạy thật (2026-09-07)

| Lệnh | Kết quả thật | Ghi chú |
|:---|:---|:---|
| `cd be_maxv && npm run typecheck` | **exit 0, 0 lỗi** | `tsc --noEmit` |
| `cd be_maxv && npm run lint` | **exit 0 — 0 errors, 125 warnings** | Toàn bộ warning là `no-console`, **0 warning nằm trong file HRM** (grep `hrm` trên output = 0 dòng) |
| `ls be_maxv/src/__tests__/*.test.ts` | **0 file test cho HRM** | Chỉ `moduleQuyen.test.ts` / `moduleTokhai.test.ts` chạm khóa module `hrm`, không test nghiệp vụ HRM nào |

> **Kết luận độ phủ tự động hiện tại của HRM = 0%.** Toàn bộ ma trận dưới đây đang ở trạng thái *chưa có test tự động tương ứng*.

---

## 2. Quy ước bắt buộc khi thực thi ca kiểm thử

Rút từ mã nguồn, **khác với `api-contract.md` hiện tại** (xem `BUG-HRM-14` trong `issues-and-bugs.md`):

| Hạng mục | Giá trị THẬT trong code | Bằng chứng |
|:---|:---|:---|
| Base path | `/api/v1/hrm` | `routes/index.route.ts:48` |
| Vỏ phản hồi thành công | `{ "success": true, "data": <payload> }` | `helpers/response.ts:4-10` |
| Vỏ phản hồi lỗi nghiệp vụ | `{ "success": false, "message": "..." }` | `plugins/errorHandler.plugin.ts:29-48` |
| Vỏ phản hồi lỗi validate | `{ "success": false, "errors": { formErrors, fieldErrors } }` | `errorHandler.plugin.ts:24-28` + `utils/validate.ts:9-11` |
| POST | **201 Created** (không phải 200) | `helpers/response.ts:8-10` |
| GET / PUT / DELETE | 200 OK | `helpers/response.ts:4-6` |
| `ValidationError` (Zod) | **400** | `errorHandler.plugin.ts:24` |
| `ConflictError` | **409** | `errorHandler.plugin.ts:29` |
| `NotFoundError` | **404** | `errorHandler.plugin.ts:34` |
| `UnauthorizedError` | **401** | `errorHandler.plugin.ts:39` |
| `ForbiddenError` | **403** | `errorHandler.plugin.ts:44` |
| `DriveApiError` | **502** | `errorHandler.plugin.ts:66-77` |
| Prisma `P2002` / `P2025` / `P2003` | **409 / 404 / 409** (thông điệp CHUNG, không nêu mã nào trùng) | `errorHandler.plugin.ts:87-103` |
| Xác thực | Cookie access httpOnly (fallback header `Authorization: Bearer`) | `plugins/jwt.plugin.ts:19-43` |
| Guard module | `requireModule('hrm')` — chỉ đến từ gói thuê bao; `ADMIN` luôn qua | `modules.service.ts:120-136` |
| Ngoại lệ auth DUY NHẤT | `GET /tai-lieu/drive/callback` (`config.khongCanAuth`) | `routes/hrm/taiLieu.route.ts:29-33`, `hrm.route.ts:25-29` |
| Rate-limit | Toàn cục 300 req/phút/IP; **không có override riêng cho upload** | `app.ts:60`, `taiLieu.route.ts:36-38` |
| Trần file multipart | 10MB, tối đa 1 file/request | `app.ts:64-66` + `taiLieuDrive.service.ts:43` |

---

## 3. Ma trận bao phủ (Thực thể × Loại kiểm thử)

Ký hiệu: **N** = số ca thiết kế · ⬜ = đã thiết kế, chưa chạy · ⛔ = chưa thiết kế được vì thiếu quyết định nghiệp vụ (chờ sign-off).

| Thực thể | Dải ID | Happy path | Validation | Edge / Boundary | Authorization | Concurrency | Security / Isolation | Regression | Tổng |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Phòng ban** (`hrm_phong_ban`) | TC-hrm-001…024 | 5 ⬜ | 2 ⬜ | 16 ⬜ | – | 1 ⬜ | – | – | **24** |
| **Nhân viên** (`hrm_nhan_vien`) | TC-hrm-025…052 | 5 ⬜ | 8 ⬜ | 9 ⬜ | – | 3 ⬜ | 1 ⬜ | 2 ⬜ | **28** |
| **Hợp đồng** (`hrm_hop_dong`) | TC-hrm-053…101 | 7 ⬜ | 7 ⬜ | 32 ⬜ | – | 2 ⬜ | – | 1 ⬜ | **49** |
| **Người phụ thuộc** (`hrm_nguoi_phu_thuoc`) | TC-hrm-102…118 | 2 ⬜ | 4 ⬜ | 10 ⬜ | – | – | – | 1 ⬜ | **17** |
| **Tài liệu + Google Drive** (`hrm_tai_lieu`) | TC-hrm-119…170 | 11 ⬜ | 4 ⬜ | 21 ⬜ | 3 ⬜ | 1 ⬜ | 12 ⬜ | – | **52** |
| **Xuyên suốt** (auth / module / tenant / API contract) | TC-hrm-171…185 | – | – | – | 8 ⬜ | – | 6 ⬜ | 1 ⬜ | **15** |
| **TỔNG** | | **30** | **25** | **88** | **11** | **7** | **19** | **5** | **185** |

> Phân bổ theo mức ưu tiên (đếm thật trên `test-cases.md`): **P0 = 95** · **P1 = 74** · **P2 = 16** — tổng **185**.
> Cột Authorization của 5 thực thể đầu để trống vì guard `authenticate` + `requireModule('hrm')` khai **một lần** ở `routes/hrm/hrm.route.ts:24-29` và lan xuống mọi route con — nên kiểm quyền được gom vào bộ ca xuyên suốt `TC-hrm-171…178`, quét **toàn bộ 29 endpoint** thay vì lặp lại ở từng thực thể (riêng nhóm Drive vẫn có 3 ca Authorization riêng vì có thêm luật chỉ-OWNER).

### 3.1 Vùng chờ chốt — trạng thái sau đợt chốt nghiệp vụ 16/16 (2026-09-07)

| Vùng | Trạng thái | Ca kiểm thử |
|:---|:---|:---|
| Người phụ thuộc trùng mã số thuế **giữa hai nhân viên** | ✅ **Đã chốt QĐ #7** — cấm, duy nhất toàn công ty (BR-hrm-030) | Nhóm cũ `TC-hrm-104…108` cần cập nhật kỳ vọng sang phạm vi toàn tenant |
| Ai được quyền nối Drive **lần đầu** | ✅ **Đã chốt QĐ #10** — chỉ chủ tài khoản (BR-hrm-045, E-hrm-059) | `TC-hrm-217…219` |
| Chuẩn "hợp đồng chồng lấn" | ✅ **Đã chốt QĐ #1 + #6** — theo cặp (`ma_nv`, `loai_hd`), khoảng ngày đóng hai đầu (BR-hrm-022, BR-hrm-026) | `TC-hrm-201…210` |
| Ngưỡng `luong_bhxh` so với `luong_chinh` | ✅ **Đã chốt QĐ #5** — cả hai phải lớn hơn 0 khi áp dụng (BR-hrm-057, BR-hrm-058). *Riêng quan hệ `luong_bhxh` **so với** `luong_chinh` vẫn chưa có rule* | `TC-hrm-196…200` |
| Khóa xóa hợp đồng khi đã phát sinh bảng lương | ⏸ **Vẫn chưa phủ được** — phân hệ `payroll` chưa tồn tại ở `be_maxv`. QĐ #15 chỉ chốt phải **ghi nhật ký** khi xóa, không chốt việc **khóa** | `TC-hrm-239` phủ phần nhật ký |
| Ngưỡng hợp lý `ngay_sinh` / `ngay_vao_lam` | ⏸ **Vẫn chưa có rule** — 16 quyết định không phủ | — |
| Ngưỡng "sắp hết hạn" của giấy tờ | ⏸ **Chưa chốt** (OQ-hrm-14). Đợt này chỉ phủ nhánh **đã hết hạn** | `TC-hrm-237` chốt việc **cấm** tự đặt ngưỡng mặc định |
| "Hợp đồng hiện hành" khi hai HĐ khác loại cùng chạy | ⏸ **Chưa chốt** (OQ-hrm-11) | `TC-hrm-243` chỉ **ghi nhận hành vi thật**, chưa khẳng định đúng sai |
| Đưa nhân viên từ đã nghỉ trở lại đang làm | ⏸ **Chưa chốt** (OQ-hrm-12) — QĐ #3 chỉ chốt chiều đi | — |
| Nội dung bộ giấy tờ bắt buộc theo loại hợp đồng | ⏸ **Chưa chốt** (OQ-hrm-13) — QĐ #14 chốt "làm cả hai" nhưng không chốt nội dung | `TC-hrm-227` chốt việc danh mục rỗng là hợp lệ |
| Ngưỡng hiệu năng cụ thể | ⏸ **Cố ý chưa đặt số** (QĐ #16) — đợt này **đo và báo cáo**, không pass/fail | `TC-hrm-245` |

---

## 4. Ma trận truy vết Yêu cầu ↔ Ca kiểm thử

> ✅ **Quy ước ID đã được BA xử lý (2026-09-07).** `hrm-spec.md` nay dùng `BR-hrm-001…066`, `FR-hrm-001…043`, `NFR-hrm-001…011`, `E-hrm-001…064`, `AC-hrm-01…56` đúng `.claude/rules/naming-conventions.md`, và Error Matrix đã có đủ (Mục 8 của spec).
>
> **Bảng dưới đây vẫn dùng ID cũ dạng `BR-01.1`** vì nó ánh xạ tới các ca kiểm thử `TC-hrm-001…185` được thiết kế theo bản spec cũ. Đối chiếu sang ID mới:
>
> | ID cũ | ID mới tương ứng | Ghi chú |
> |:---|:---|:---|
> | BR-01.1 / BR-01.2 | BR-hrm-001…004 | Sinh mã phòng ban và nhân viên |
> | BR-02.1 / BR-02.2 / BR-02.3 | BR-hrm-005…009 | Cây phòng ban và guard xóa |
> | BR-03.1 | BR-hrm-017 | Tạo nhân viên trước khi có hợp đồng |
> | BR-03.2 | BR-hrm-019, BR-hrm-021, BR-hrm-052 | Hợp đồng hiện hành tính lúc đọc |
> | BR-03.3 | **BR-hrm-022** `[SỬA THEO QĐ #1 và #6]` | Chồng lấn nay theo cặp (`ma_nv`, `loai_hd`), khoảng ngày đóng hai đầu — **kỳ vọng của `TC-hrm-067…078` phải cập nhật theo** |
> | BR-03.4 | BR-hrm-023, BR-hrm-024, **BR-hrm-053** | Đổi hợp đồng; BR-hrm-053 là ràng buộc `loai_hd_can_chot` mới |
> | BR-03.5 | BR-hrm-025 | Luật công đoàn một chiều |
> | BR-04.1 | **BR-hrm-030** `[SỬA THEO QĐ #7]` | Nay duy nhất **toàn công ty**, không còn per-nhân-viên — **kỳ vọng của `TC-hrm-104…108` phải cập nhật theo** |
> | BR-04.2 | BR-hrm-031…034 | Ràng buộc kỳ giảm trừ và dữ liệu người phụ thuộc |
> | BR-05.1 | **BR-hrm-045** `[SỬA THEO QĐ #10]` | Nay nói rõ chỉ chủ tài khoản được nối lần đầu |
> | BR-05.2 / BR-05.3 | BR-hrm-041…044 | Phạm vi quyền Google, cây thư mục Drive, loại file và trần dung lượng |
>
> **Hai nhóm ca cũ có kỳ vọng đã lỗi thời** vì quyết định nghiệp vụ đổi: `TC-hrm-067…078` (chồng lấn — nay phải phân biệt theo `loai_hd`) và `TC-hrm-104…108` (trùng mã số thuế — nay phạm vi toàn công ty). Nhóm mới `TC-hrm-186…245` phủ hành vi đã chốt; **hai nhóm cũ phải được rà lại trước Phase B**, không được chạy nguyên trạng rồi báo FAIL nhầm.

| Yêu cầu | Nội dung tóm tắt | Ca kiểm thử | Ghi chú đối chiếu code |
|:---|:---|:---|:---|
| **BR-01.1** | Mã PB dạng `PBxx` / `PBxx.yy`, ≤24 ký tự, không cấp lại mã đã xóa | TC-hrm-001, 002, 003, 010, 011, 022, 024 | `phongBan.service.ts:42-59` — nhánh dự phòng >99 sinh `PB<4 số timestamp>` **phá định dạng** (`BUG-HRM-19`) |
| **BR-01.2** | Mã NV `NV`+4 số, không cấp lại mã đã xóa | TC-hrm-025, 026, 040, 041, 042, 043 | `nhanVien.service.ts:54-73` |
| **BR-02.1** | `ma_pb_me != ma_pb` | TC-hrm-013, 014, 015 | `phongBan.service.ts:65-81`; guard tự-làm-cha **không chạy khi tự sinh mã** (`body.ma_pb ?? ''` — dòng 167), tuy vô hại vì mã sinh ra không thể trùng cha |
| **BR-02.2** | Chống vòng lặp cây | TC-hrm-016, 017 | `phongBan.service.ts:89-110` — chỉ chạy ở `update`, đúng |
| **BR-02.3** | Không xóa PB còn nhân viên `da_xoa=false` | TC-hrm-018, 019, 020, 021 | `phongBan.service.ts:239-262` — chặn CẢ người đã nghỉ + chặn cả PB con (api-contract chưa ghi) |
| **BR-03.1** | Tạo NV trước khi có HĐ | TC-hrm-025, 053 | `nhanVien.service.ts:170-194` — đúng |
| **BR-03.2** | HĐ hiện hành suy diễn lúc đọc theo `homNayVN()` | TC-hrm-089 … 094 | `hopDong.service.ts:61-104, 124-149` |
| **BR-03.3** | **Chống chồng lấn thời gian HĐ** | TC-hrm-067 … 078, 085, 088 | ❌ **CHƯA CÓ TRONG CODE** — `hopDong.service.ts:185-218` không kiểm; schema không có ràng buộc loại trừ (`schema.prisma:960-990`) |
| **BR-03.4** | Đổi HĐ nguyên tử, HĐ mới bắt đầu sau ngày chốt | TC-hrm-079 … 087 | Validator chặn `ngay_bat_dau <= ngay_chot` (`hopDong.validator.ts:101-112`); service `hopDong.service.ts:224-273` **bỏ sót HĐ tương lai + dùng mốc UTC** |
| **BR-03.5** | Luật công đoàn một chiều | TC-hrm-048, 095, 096, 097, 098 | `hopDong.service.ts:161-167` |
| **BR-04.1** | Không trùng MST NPT trong cùng 1 NV | TC-hrm-104 … 108 | `nguoiPhuThuoc.service.ts:93-114` + `schema.prisma:949` — **chỉ per-nhân-viên**, không chặn chéo nhân viên (`BUG-HRM-05`) |
| **BR-04.2** | Tháng 1–12, năm 2000–2100, `den >= tu` | TC-hrm-109 … 114 | `nguoiPhuThuoc.validator.ts:50-150` |
| **BR-05.1** | File scan thuộc quyền sở hữu DOANH NGHIỆP, không phụ thuộc cá nhân HR | TC-hrm-152, 153, 162, 163 | ⚠️ **MÂU THUẪN CODE** — `taiLieu.controller.ts:141-156` cho mọi user có module `hrm` nối Drive lần đầu bằng tài khoản Google cá nhân |
| **BR-05.2** | Chỉ ảnh (jpeg/png/webp/heic) + PDF, ≤10MB | TC-hrm-133 … 138 | `taiLieuDrive.service.ts:43-52, 322-331` + `app.ts:64-66` |
| **BR-05.3** | Cây thư mục `maxv/<MST> - <Tên>/<Mã NV> - <Họ tên>`, nhớ theo ID | TC-hrm-129, 130, 163, 164 | `taiLieuDrive.service.ts:246-294` |
| **AC-01** | Tự sinh mã NV nhỏ nhất chưa dùng | TC-hrm-042, 043, 050 | Đạt về logic; **hở concurrency** (`ISSUE-HRM-02`) |
| **AC-02** | Đổi HĐ 01/01→31/03 sang 01/04 | TC-hrm-079 | Đạt trong luồng thuận |
| **AC-03** | Xóa PB có 3 NV → 409 "Phòng ban đang có 3 nhân viên, không thể xóa." | TC-hrm-019 | Wording thật: `Phòng ban "PB01" đang có 3 nhân viên, không thể xóa.` (có mã PB trong ngoặc kép) — **AC cần sửa wording cho khớp** (`phongBan.service.ts:259-261`) |

### 4.1 Yêu cầu CÓ TRONG CODE nhưng KHÔNG có trong SRS (đề nghị BA bổ sung)

| Hành vi thật | Bằng chứng | Ca kiểm thử |
|:---|:---|:---|
| Không xóa PB khi còn **phòng ban trực thuộc** | `phongBan.service.ts:246-250` | TC-hrm-021 |
| `so_nv` chỉ đếm người **đang làm** (`status='1'`), không cộng dồn cây con | `phongBan.service.ts:135-142` | TC-hrm-004, 005, 006 |
| Không gán NV vào phòng ban **đã xóa mềm** | `nhanVien.service.ts:80-92` | TC-hrm-037 |
| `PUT /nhan-vien` bắt buộc gửi `mien_cham_cong` + `cong_doan` | `nhanVien.validator.ts:89-92` | TC-hrm-035 |
| Xóa mềm NV chỉ **ẩn** NPT / HĐ / tài liệu (cascade chỉ chạy khi xóa cứng) | `nhanVien.service.ts:219-243` + các `list*` lọc `nhan_vien.da_xoa` | TC-hrm-044, 045 |
| `POST /hop-dong/doi` báo lỗi khi có HĐ hiệu lực mà thiếu `ngay_chot` | `hopDong.service.ts:246-250` | TC-hrm-081 |
| `ngay_chot` phải **sau** `ngay_bat_dau` của HĐ đang hiệu lực | `hopDong.service.ts:254-258` | TC-hrm-083 |
| Chỉ OWNER được **đổi** tài khoản Drive và **ngắt** kết nối | `taiLieu.controller.ts:149-151, 281-283` | TC-hrm-152, 161 |
| Callback Drive khóa `state` vào cookie `driveOauthState`, dùng 1 lần | `taiLieu.controller.ts:99-118, 227-245` | TC-hrm-151, 154 … 158 |
| Escape HTML + CSP nonce ở trang callback (chống XSS phản chiếu) | `taiLieu.controller.ts:169-222` | TC-hrm-159, 160 |
| Trần 10MB áp cả **đường tải về** từ Drive | `driveClient.ts:400-423` | TC-hrm-145, 146 |
| `invalid_grant` → tự ngắt kết nối Drive; mã lỗi khác thì KHÔNG ngắt | `taiLieuDrive.service.ts:231-244` | TC-hrm-166, 167 |
| Log cắt query string (giấu `code`/`state` OAuth) | `app.ts:36-46` | TC-hrm-170 |

---

## 5. Ma trận Endpoint × Loại kiểm thử

> Cột Authz của từng endpoint được phủ **tập trung** bởi `TC-hrm-171` (quét 401 trên cả 29 endpoint) và `TC-hrm-172…178`; ở bảng này chỉ đánh ✔ khi endpoint có **luật quyền riêng** ngoài guard chung.

| # | Endpoint | Happy | Valid. | Edge/Bound. | Authz riêng | Conc. | Sec. | Ca kiểm thử |
|:--:|:---|:--:|:--:|:--:|:--:|:--:|:--:|:---|
| 1 | `GET /phong-ban` | ✔ | ✔ | ✔ | – | – | – | 004–008 |
| 2 | `POST /phong-ban` | ✔ | ✔ | ✔ | – | ✔ | – | 001–003, 009–015, 022, 023, 024 |
| 3 | `PUT /phong-ban/:ma_pb` | – | – | ✔ | – | – | – | 016, 017 |
| 4 | `DELETE /phong-ban/:ma_pb` | ✔ | – | ✔ | – | ✔ | – | 018–021, 052 |
| 5 | `GET /nhan-vien` | ✔ | – | ✔ | – | – | – | 027, 089–094 |
| 6 | `GET /nhan-vien/:ma_nv` | ✔ | – | ✔ | – | – | ✔ | 025, 045, 046, 049, 179 |
| 7 | `POST /nhan-vien` | ✔ | ✔ | ✔ | – | ✔ | – | 025, 026, 029–034, 036–043, 050–052 |
| 8 | `PUT /nhan-vien/:ma_nv` | ✔ | ✔ | – | – | – | ✔ | 028, 035, 047, 048, 049 |
| 9 | `DELETE /nhan-vien/:ma_nv` | ✔ | – | ✔ | – | – | – | 044, 045, 128 |
| 10 | `GET /hop-dong` | ✔ | – | ✔ | – | – | – | 054, 065 |
| 11 | `POST /hop-dong` | ✔ | ✔ | ✔ | – | ✔ | ✔ | 053, 057–076, 088, 095, 096, 099–101, 181 |
| 12 | `POST /hop-dong/doi` | ✔ | ✔ | ✔ | – | ✔ | – | 079–087 |
| 13 | `PUT /hop-dong/:id` | ✔ | – | ✔ | – | – | – | 055, 065, 077, 078, 097 |
| 14 | `DELETE /hop-dong/:id` | ✔ | – | ✔ | – | – | – | 056, 065, 098 |
| 15 | `GET /nguoi-phu-thuoc` | ✔ | – | ✔ | – | – | – | 103, 045 |
| 16 | `POST /nguoi-phu-thuoc` | ✔ | ✔ | ✔ | – | – | ✔ | 102, 104–106, 109–118, 181 |
| 17 | `PUT /nguoi-phu-thuoc/:id` | – | – | ✔ | – | – | – | 107, 108, 118 |
| 18 | `DELETE /nguoi-phu-thuoc/:id` | – | – | ✔ | – | – | – | 118 |
| 19 | `GET /tai-lieu` | ✔ | – | ✔ | – | – | – | 120, 128 |
| 20 | `POST /tai-lieu` | ✔ | ✔ | ✔ | – | – | ✔ | 119, 121–124, 181 |
| 21 | `PUT /tai-lieu/:id` | ✔ | – | – | – | – | ✔ | 125, 126, 180 |
| 22 | `DELETE /tai-lieu/:id` | – | – | ✔ | – | – | ✔ | 127, 180 |
| 23 | `GET /tai-lieu/drive/trang-thai` | ✔ | – | ✔ | – | – | – | 150, 166 |
| 24 | `GET /tai-lieu/drive/lien-ket` | ✔ | – | ✔ | ✔ | – | ✔ | 140, 151, 152, 153 |
| 25 | `GET /tai-lieu/drive/callback` | ✔ | ✔ | ✔ | ✔ | – | ✔ | 141, 154–160, 170 |
| 26 | `DELETE /tai-lieu/drive/ket-noi` | ✔ | – | ✔ | ✔ | – | – | 161, 162 |
| 27 | `POST /tai-lieu/:id/file` | ✔ | ✔ | ✔ | – | ✔ | ✔ | 129–141, 149, 166–169, 184 |
| 28 | `GET /tai-lieu/:id/file` | ✔ | – | ✔ | – | – | ✔ | 142–146, 163, 180 |
| 29 | `DELETE /tai-lieu/:id/file` | ✔ | – | ✔ | – | – | – | 143, 147, 148 |
| — | Xuyên suốt (auth / module / tenant / API contract) | – | – | – | ✔ | – | ✔ | 171–185 |

---

## 6. Ma trận rủi ro theo Loại kiểm thử

| Loại | Rủi ro chính đã nhận diện | Bug tương ứng | Ưu tiên |
|:---|:---|:---|:---:|
| **Nghiệp vụ / dữ liệu** | Hợp đồng chồng lấn → phân hệ Payroll lấy sai mức lương và tỷ lệ BHXH | ISSUE-HRM-01, BUG-HRM-06, 07 | P0 |
| **Nghiệp vụ / thuế** | Cùng 1 người phụ thuộc đăng ký ở 2 nhân viên → giảm trừ gia cảnh 2 lần | BUG-HRM-05 | P0 |
| **Concurrency** | Hai request đồng thời: sinh mã trùng, chốt hợp đồng đôi, xóa phòng ban còn người | ISSUE-HRM-02, BUG-HRM-08, 09, 16 | P1 |
| **Bảo mật / sở hữu dữ liệu** | Nhân viên thường nối kho tài liệu công ty vào Drive cá nhân | BUG-HRM-11 | P0 |
| **Bảo mật / PII** | Xóa bản ghi tài liệu nhưng file CCCD vẫn nằm trên Drive | BUG-HRM-10 | P1 |
| **Cô lập tenant** | Kiến trúc DB-per-tenant chặn IDOR chéo tenant về mặt cấu trúc → vẫn phải test hồi quy để không bị phá vỡ | (chưa phát hiện lỗ hổng) | P1 |
| **Hợp đồng API** | Status 201 vs 200, vỏ `{success,data}`, base path — tài liệu lệch code | BUG-HRM-14 | P1 |
| **Khả năng vận hành** | Không nhật ký cho thao tác phá hủy của HRM; không rate-limit riêng cho upload | BUG-HRM-17, 18 | P2 |

---

## 7. Điều kiện môi trường & dữ liệu kiểm thử (Phase B)

### 7.1 Môi trường

| Hạng mục | Yêu cầu |
|:---|:---|
| Chạy app trong tiến trình | `buildApp()` + `app.inject()` (`be_maxv/src/app.ts:18-73`) — **không** khởi động/dừng dev server của người dùng |
| DB | 1 DB control plane `maxv2_sys` + **ít nhất 2 DB tenant** (`maxv_<MST-A>_app`, `maxv_<MST-B>_app`) để test cô lập |
| Google Drive | Bắt buộc **giả lập** (`fetch` stub / MSW). Không gọi Google thật trong CI |
| Biến môi trường Drive | Test 2 nhánh: có đủ `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` + `GDT_CRED_ENC_KEY`, và nhánh thiếu (`driveDaCauHinh()=false`) |
| Múi giờ | Test phải chạy được ở cả `TZ=Asia/Ho_Chi_Minh` và `TZ=UTC`; nhóm ca 066–067 cần giả lập đồng hồ (`mock timers`) |

### 7.2 Bộ dữ liệu nền (fixture) tối thiểu

| Tên | Nội dung |
|:---|:---|
| `PB-CAY` | `PB01` (gốc) → `PB01.01` → `PB01.01.01`; `PB02` (gốc, rỗng) |
| `NV-CO-BAN` | `NV0001` (PB01, đang làm), `NV0002` (PB01, đã nghỉ `status='0'`), `NV0003` (chưa gán PB) |
| `NV-DA-XOA` | `NV0009` đã xóa mềm (`da_xoa=true`) — dùng cho ca không cấp lại mã |
| `HD-LICH-SU` | `NV0001`: HĐ thử việc `[2026-01-01, 2026-03-31]`, HĐ chính thức `[2026-04-01, null]` |
| `HD-TUONG-LAI` | `NV0003`: HĐ `[2027-01-01, null]` (ký trước cho tương lai) |
| `NPT-MAU` | `NV0001` có NPT MST `8123456789`; `NV0002` chưa có NPT |
| `TL-MAU` | `NV0001` có 1 tài liệu `cccd` chưa đính file, 1 tài liệu `bang_cap` đã có `drive_file_id` giả |
| `TENANT-B` | Công ty B với `NV0001` **trùng mã** để test cô lập (mã giống, dữ liệu khác) |

### 7.3 Vai trò tài khoản

| Vai | Dùng cho |
|:---|:---|
| `OWNER` có gói bật `hrm` | Luồng chuẩn + thao tác chỉ-OWNER (đổi/ngắt Drive) |
| `OWNER_EMPLOYEE` có gói bật `hrm` (kế thừa gói owner) | Kiểm 403 ở thao tác chỉ-OWNER; kiểm rủi ro nối Drive lần đầu |
| `OWNER` có gói **tắt** `hrm` | Kiểm 403 `MODULE_NOT_INCLUDED` |
| `OWNER` gói `hrm` nhưng thuê bao `EXPIRED` / quá `ketThuc` | Kiểm 403 (`modules.service.ts:38-43`) |
| `ADMIN` | Kiểm nhánh bỏ qua guard module (`modules.service.ts:125`) |
| Không đăng nhập | Kiểm 401 toàn bộ route trừ callback Drive |

---

## 8. Tiêu chí ra (Exit criteria) đề xuất cho Phase B

1. 100% ca **P0** và **P1** được tự động hóa và PASS.
2. Không còn bug mức **Critical** / **High** mở.
3. `npm run typecheck` + `npm run lint` giữ nguyên **0 error** (baseline hiện tại đã đạt).
4. `npm test` chạy được **≥ 1 file test HRM** (hiện tại là 0).
5. Mọi Business Rule trong `hrm-spec.md` có ít nhất 1 ca kiểm thử ánh xạ, và mọi ca kiểm thử ánh xạ được về 1 BR/AC (không có ca mồ côi, không có BR trắng).
6. `api-contract.md` được cập nhật khớp hành vi thật (status 201, vỏ `{success,data}`, base path) trước khi Frontend/QA bám vào.
