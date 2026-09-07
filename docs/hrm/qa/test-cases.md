# HRM — TEST CASES (CHI TIẾT CÁC CA KIỂM THỬ)

> **Giai đoạn**: Phase A — thiết kế. **Cột `Actual Result` / `Status` để TRỐNG có chủ đích**: sẽ được điền ở Phase B sau khi chạy thật. Không ca nào trong tài liệu này được đánh PASS.
>
> **Quy ước áp dụng cho MỌI ca** (rút từ code, xem `test-matrix.md` mục 2):
> - Base path `/api/v1/hrm`; xác thực bằng cookie access httpOnly (hoặc `Authorization: Bearer`).
> - Thành công: `POST` → **201**, `GET/PUT/DELETE` → **200**; thân phản hồi luôn bọc `{ "success": true, "data": … }`.
> - Lỗi validate (Zod) → **400** `{ "success": false, "errors": {...} }`.
> - `ConflictError` → **409**, `NotFoundError` → **404**, `UnauthorizedError` → **401**, `ForbiddenError` → **403**, `DriveApiError` → **502**, Prisma `P2002` → **409** (thông điệp CHUNG).
> - Trừ khi ghi rõ, tài khoản test là `OWNER` có gói bật module `hrm`, đã chọn công ty (tenant A).
>
> **Mức ưu tiên**: P0 = chặn phát hành · P1 = phải có trước khi bàn giao · P2 = nên có.

---

## 1. Test Suite: Phòng ban (`hrm_phong_ban`) — TC-hrm-001 … 022

| ID | Loại | Yêu cầu | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:---|:--:|
| TC-hrm-001 | Happy | BR-01.1 | DB tenant chưa có phòng ban nào | `POST /phong-ban` `{ "ten_pb":"Khối Kỹ thuật", "ma_pb_me":null, "ghi_chu":null, "status":"1" }` | **201**, `data.ma_pb = "PB01"` | P0 |
| TC-hrm-002 | Happy | BR-01.1 | Đã có `PB01` | `POST /phong-ban` `{ "ten_pb":"Đội Backend", "ma_pb_me":"PB01" }` | **201**, `data.ma_pb = "PB01.01"` | P0 |
| TC-hrm-003 | Happy | BR-01.1 | — | `POST /phong-ban` `{ "ma_pb":"gd", "ten_pb":"Ban giám đốc" }` | **201**, `data.ma_pb = "GD"` (tự in hoa — `phongBan.validator.ts:28-30`) | P1 |
| TC-hrm-004 | Happy | §4.1 | `PB01` có `NV0001` (status `1`), `NV0002` (status `0`); `PB01.01` là con | `GET /phong-ban` | **200**; dòng `PB01` có `ten_pb_me=null`, `so_nv=1`; dòng `PB01.01` có `ten_pb_me="Khối Kỹ thuật"` | P0 |
| TC-hrm-005 | Edge | §4.1 | `PB01` chỉ có `NV0002` (đã nghỉ) | `GET /phong-ban` | `so_nv = 0` (chỉ đếm `status='1'` — `phongBan.service.ts:138-142`) | P1 |
| TC-hrm-006 | Edge | §4.1 | `PB01.01` có 3 NV đang làm, `PB01` có 0 NV | `GET /phong-ban` | `PB01.so_nv = 0`, `PB01.01.so_nv = 3` — **KHÔNG cộng dồn cây con**. *Nếu BA muốn cộng dồn thì đây là bug, chờ chốt* | P1 |
| TC-hrm-007 | Edge | §4.1 | `PB09` đã xóa mềm | `GET /phong-ban` | Không có `PB09` trong danh sách (`da_xoa:false` — `phongBan.service.ts:117`) | P1 |
| TC-hrm-008 | Validation | — | — | `GET /phong-ban?status=2` | **400** (`z.enum(['0','1'])` — `phongBan.validator.ts:57`) | P2 |
| TC-hrm-009 | Validation | — | — | `POST /phong-ban` `{ "ten_pb":"   " }` | **400**, `fieldErrors.ten_pb` = "Tên phòng ban không được để trống" | P1 |
| TC-hrm-010 | Boundary | BR-01.1 | — | `POST /phong-ban` `{ "ma_pb":"<25 ký tự>", "ten_pb":"X" }` | **400** "Mã phòng ban tối đa 24 ký tự" | P1 |
| TC-hrm-011 | Boundary | BR-01.1 | — | `POST /phong-ban` `{ "ma_pb":"<đúng 24 ký tự>", "ten_pb":"X" }` | **201**, chấp nhận | P2 |
| TC-hrm-012 | Boundary | — | — | `POST /phong-ban` `{ "ten_pb":"<255 ký tự>" }` / `{ "ghi_chu":"<513 ký tự>" }` | **400** cả hai (`ten_pb` ≤254, `ghi_chu` ≤512) | P2 |
| TC-hrm-013 | Edge | BR-02.1 | — | `POST /phong-ban` `{ "ma_pb":"PB05", "ten_pb":"X", "ma_pb_me":"PB05" }` | **409** "Phòng ban cha không thể là chính nó" | P1 |
| TC-hrm-014 | Edge | BR-02.1 | Chưa có phòng ban nào | `POST /phong-ban` `{ "ten_pb":"X", "ma_pb_me":"PB01" }` (PB01 chưa tồn tại) | **404** "Phòng ban cha không tồn tại" | P1 |
| TC-hrm-015 | Edge | BR-02.1 | `PB09` đã xóa mềm | `POST /phong-ban` `{ "ten_pb":"X", "ma_pb_me":"PB09" }` | **404** "Phòng ban cha không tồn tại" (`assertPhongBanMeHopLe` lọc `da_xoa:false`) | P1 |
| TC-hrm-016 | Edge | BR-02.2 | `PB01` → `PB01.01` | `PUT /phong-ban/PB01` `{ "ten_pb":"Khối Kỹ thuật", "ma_pb_me":"PB01.01", "ghi_chu":null, "status":"1" }` | **409** "Không thể chọn phòng ban cấp dưới làm phòng ban cha (tạo vòng lặp trong cây tổ chức)" | P0 |
| TC-hrm-017 | Edge | BR-02.2 | `PB01` → `PB01.01` → `PB01.01.01` | `PUT /phong-ban/PB01` với `ma_pb_me = "PB01.01.01"` | **409** vòng lặp (bắt được cả vòng 3 cấp — `assertKhongVongLap` duyệt ngược tới gốc) | P0 |
| TC-hrm-018 | Happy | BR-02.3 | `PB02` không có NV, không có PB con | `DELETE /phong-ban/PB02` | **200** `data.ma_pb="PB02"`; `GET /phong-ban` không còn `PB02` | P0 |
| TC-hrm-019 | Edge | BR-02.3 / AC-03 | `PB01` có 3 NV đang làm | `DELETE /phong-ban/PB01` | **409**, message chính xác: `Phòng ban "PB01" đang có 3 nhân viên, không thể xóa.` | P0 |
| TC-hrm-020 | Edge | BR-02.3 | `PB01` có 0 NV đang làm nhưng 1 NV đã nghỉ (`status='0'`, `da_xoa=false`) | `DELETE /phong-ban/PB01` | **409**, message: `... đang có 1 nhân viên (0 đang làm, 1 đã nghỉ), không thể xóa.` — chặn dù cột `so_nv` hiện 0 | P1 |
| TC-hrm-021 | Edge | §4.1 | `PB01` có `PB01.01` (chưa xóa), 0 NV | `DELETE /phong-ban/PB01` | **409** `Phòng ban "PB01" đang có 1 phòng ban trực thuộc, vui lòng xử lý các phòng ban đó trước.` | P1 |
| TC-hrm-022 | Edge | BR-01.1 | Đã có `PB01`, `PB02`; xóa mềm `PB02` | `POST /phong-ban` `{ "ten_pb":"Mới", "ma_pb_me":null }` | **201**, `ma_pb = "PB03"` — **KHÔNG cấp lại `PB02`** (`sinhMaPhongBan` quét cả `da_xoa=true`) | P0 |

### 1.1 Ca đặc biệt — Concurrency & Boundary cây phòng ban

**TC-hrm-023 — Concurrency: hai người tạo phòng ban gốc cùng lúc** · P1
- **Tiền điều kiện**: DB tenant có sẵn `PB01`.
- **Các bước**: bắn đồng thời (`Promise.all`) 2 request `POST /phong-ban` `{ "ten_pb":"A" }` và `{ "ten_pb":"B" }`, cả hai để trống `ma_pb`.
- **Kết quả mong đợi (chuẩn nghiệp vụ)**: cả 2 trả **201** với **2 mã khác nhau** (`PB02`, `PB03`).
- **Rủi ro đã nhận diện từ code**: `createPhongBan` kiểm rồi ghi **ngoài transaction** (`phongBan.service.ts:170-189`) → nhiều khả năng request thứ hai nhận **409** với thông điệp chung `Dữ liệu bị trùng` (Prisma `P2002` → `errorHandler.plugin.ts:87-92`). Ca này thiết kế để **phơi bày** hành vi đó, không phải để hợp thức hóa nó. Xem `ISSUE-HRM-02`.

**TC-hrm-024 — Boundary: cây quá sâu, mã tự sinh vượt 24 ký tự** · P2
- **Tiền điều kiện**: dựng chuỗi cha–con tới khi mã đạt `PB01.01.01.01.01.01.01` (22 ký tự).
- **Các bước**: `POST /phong-ban` `{ "ten_pb":"Sâu thêm 1 cấp", "ma_pb_me":"<mã 22 ký tự>" }`.
- **Kết quả mong đợi**: **409** `Cây phòng ban quá sâu để tự sinh mã ("…" vượt 24 ký tự). Vui lòng tự nhập mã ngắn hơn.` (`phongBan.service.ts:22-29`).
- **Câu hỏi cho BA**: SRS chưa quy định **độ sâu tối đa** của cây tổ chức. Hiện tại giới hạn là hệ quả phụ của độ dài cột, không phải quyết định nghiệp vụ.

> **Ghi chú kiểm thử vượt 99 con cùng cấp** (khớp yêu cầu soát của Architect): tạo 99 phòng ban con dưới `PB01` rồi tạo cái thứ 100 — code rơi vào nhánh dự phòng `PB01.<4 số cuối timestamp>` (`phongBan.service.ts:57-58`), mã **không đúng định dạng `PBxx.yy` của BR-01.1** và **không kiểm trùng**. Ca này chỉ nên chạy thủ công (tốn 100 request); đã ghi thành `BUG-HRM-19` thay vì test case tự động.

---

## 2. Test Suite: Nhân viên (`hrm_nhan_vien`) — TC-hrm-025 … 049

| ID | Loại | Yêu cầu | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:---|:--:|
| TC-hrm-025 | Happy | BR-01.2, BR-03.1 | Chưa có nhân viên nào | `POST /nhan-vien` `{ "ho_ten":"Nguyễn Văn A", "ngay_vao_lam":"2026-03-01" }` (bỏ trống `ma_nv`, không kèm hợp đồng) | **201**, `data.ma_nv = "NV0001"`; `GET /nhan-vien/NV0001` trả `so_hop_dong=null`, `loai_hop_dong=null`, `kieu_luong=null`, `bhxh=null`, `tncn=null` | P0 |
| TC-hrm-026 | Happy | BR-01.2 | Đã có `NV0001` | `POST /nhan-vien` `{ "ma_nv":"gd-01", "ho_ten":"B", "ngay_vao_lam":"2026-03-01" }` | **201**, `ma_nv = "GD-01"` (in hoa); mã tự nhập **không** làm lệch bộ đếm `NVxxxx` | P1 |
| TC-hrm-027 | Happy | — | `PB01` tồn tại, `NV0001` có 1 NPT | `GET /nhan-vien` | **200**; dòng `NV0001` có `ten_pb`, `so_npt=1`, và 6 trường hợp đồng suy diễn | P0 |
| TC-hrm-028 | Happy | — | — | `PUT /nhan-vien/NV0001` với đầy đủ trường (kể cả `mien_cham_cong`, `cong_doan`) | **200** `data.ma_nv="NV0001"`; đọc lại thấy đúng giá trị mới | P0 |
| TC-hrm-029 | Validation | — | — | `POST /nhan-vien` `{ "ho_ten":"A" }` (thiếu `ngay_vao_lam`) | **400**, `fieldErrors.ngay_vao_lam` | P0 |
| TC-hrm-030 | Validation | — | — | `POST /nhan-vien` `{ "ho_ten":"A", "ngay_vao_lam":"01/03/2026" }` | **400** "Ngày phải theo định dạng YYYY-MM-DD" (`primitives.ts:49-52`) | P1 |
| TC-hrm-031 | Validation | — | — | `POST /nhan-vien` `{ "ho_ten":"A", "ngay_vao_lam":"2026-02-30" }` | **400** "Ngày không có thật: 2026-02-30" (đối chiếu ngược chuỗi — `primitives.ts:55-63`) | P1 |
| TC-hrm-032 | Validation | — | — | `POST /nhan-vien` với `email":"nguyen van a"` | **400** theo `emailRule` (`primitives.ts:19-26`) | P1 |
| TC-hrm-033 | Validation | — | — | `POST /nhan-vien` với `mst_ca_nhan":"12345"` | **400** "Mã số thuế không hợp lệ" (`optMst` dùng `MST_REGEX`: 10 số / 10 số + nhánh / 12 số) | P1 |
| TC-hrm-034 | Validation | — | — | `POST /nhan-vien` với `gioi_tinh":"male"` | **400** (`z.enum(['nam','nu','khac'])`) | P2 |
| TC-hrm-035 | Validation | §4.1 | `NV0001` tồn tại | `PUT /nhan-vien/NV0001` thiếu trường `cong_doan` | **400** — PUT thay TOÀN BỘ bản ghi, hai cờ chế độ là **bắt buộc** (`nhanVien.validator.ts:89-92`) | P0 |
| TC-hrm-036 | Boundary | — | — | `POST /nhan-vien` với `so_cccd` 21 ký tự / `dia_chi` 501 ký tự / `ghi_chu` 2001 ký tự | **400** cả ba (chặn ở validator, **không** để Postgres trả 500) | P2 |
| TC-hrm-037 | Edge | §4.1 | `PB09` đã xóa mềm | `POST /nhan-vien` `{ "ho_ten":"A","ngay_vao_lam":"2026-03-01","ma_pb":"PB09" }` | **404** "Không tìm thấy phòng ban" (`nhanVien.service.ts:80-92`) | P1 |
| TC-hrm-038 | Edge | — | — | `POST /nhan-vien` với `ma_pb":"PB-KHONG-CO"` | **404** "Không tìm thấy phòng ban" | P1 |
| TC-hrm-039 | Edge | — | `PB02` có `status="0"` (ngừng hoạt động), chưa xóa | `POST /nhan-vien` với `ma_pb":"PB02"` | **201** — code **cho phép**. *Cần BA xác nhận có muốn chặn không* (`BUG-HRM-23`) | P2 |
| TC-hrm-040 | Edge | — | `NV0001` tồn tại | `POST /nhan-vien` `{ "ma_nv":"NV0001", ... }` | **409** `Mã nhân viên "NV0001" đã tồn tại` | P0 |
| TC-hrm-041 | Edge | BR-01.2 | `NV0001` **đã xóa mềm** | `POST /nhan-vien` `{ "ma_nv":"NV0001", ... }` | **409** `Mã nhân viên "NV0001" đã tồn tại` — guard cố ý **không** lọc `da_xoa` (`nhanVien.service.ts:178-189`) | P0 |
| TC-hrm-042 | Edge | BR-01.2 / AC-01 | Có `NV0001` (đã xóa mềm) và `NV0002` | `POST /nhan-vien` bỏ trống `ma_nv` | **201**, `ma_nv = "NV0003"` — **KHÔNG cấp lại `NV0001`** | P0 |
| TC-hrm-043 | Edge | AC-01 | Có `NV0001`, `NV0003` (thiếu `NV0002`) | `POST /nhan-vien` bỏ trống `ma_nv` | **201**, `ma_nv = "NV0002"` — thuật toán lấp chỗ trống | P1 |
| TC-hrm-044 | Happy | — | `NV0001` có 2 NPT, 1 HĐ, 1 tài liệu | `DELETE /nhan-vien/NV0001` | **200** `{ "ma_nv":"NV0001", "so_npt_an_theo":2 }` | P0 |
| TC-hrm-045 | Edge | — | Sau TC-hrm-044 | `GET /nhan-vien`, `GET /nhan-vien/NV0001`, `GET /nguoi-phu-thuoc?ma_nv=NV0001`, `GET /hop-dong?ma_nv=NV0001`, `GET /tai-lieu?ma_nv=NV0001` | Danh sách NV **không có** `NV0001`; `GET` chi tiết → **404**; ba danh sách con đều **200 với mảng rỗng** (bị ẩn theo `nhan_vien.da_xoa` chứ **không** bị xóa khỏi DB) | P0 |
| TC-hrm-046 | Edge | — | `NV0001` đã xóa mềm | `PUT /nhan-vien/NV0001`, `DELETE /nhan-vien/NV0001` | Cả hai → **404** "Không tìm thấy nhân viên" | P1 |
| TC-hrm-047 | Security | — | — | `PUT /nhan-vien/NV0001` với body thừa `{ "da_xoa": true, "drive_folder_id":"xxx", "ma_nv":"NV9999" }` | **200**, và đọc lại thấy `da_xoa` vẫn `false`, `drive_folder_id` không đổi, `ma_nv` không đổi — Zod `z.object` **strip** khóa lạ; `ma_nv` bị `.omit()` (`nhanVien.validator.ts:89`) | P0 |
| TC-hrm-048 | Regression | BR-03.5 | `NV0001` đang có HĐ khoán → `cong_doan=false` | `PUT /nhan-vien/NV0001` bằng đúng body mà FE gửi (form không cho sửa cờ này) | `cong_doan` vẫn `false`; **không** bị bật lại thành `true` | P0 |
| TC-hrm-049 | Regression | — | `NV0001` có `ngay_vao_lam=2022-01-10` | `PUT /nhan-vien/NV0001` chỉ đổi `chuc_vu` (giữ nguyên các trường khác) | `ngay_vao_lam` không đổi; 6 trường hợp đồng ở phản hồi `GET` vẫn suy diễn đúng từ `hrm_hop_dong` (không bị form nhân viên đè) | P0 |

### 2.1 Ca đặc biệt — Concurrency nhân viên

**TC-hrm-050 — Concurrency: hai người tạo nhân viên cùng lúc, cùng để trống mã** · P0
- **Tiền điều kiện**: DB tenant có `NV0001` … `NV0009`.
- **Các bước**: `Promise.all` 2 request `POST /nhan-vien` với `ho_ten` khác nhau, `ma_nv` để trống.
- **Kết quả mong đợi (chuẩn nghiệp vụ theo ADR-001 §3)**: cả 2 trả **201** với `NV0010` và `NV0011`.
- **Bất biến bắt buộc dù kết quả nào**: (a) **không** có hai bản ghi cùng `ma_nv`; (b) **không** có phản hồi 500; (c) nếu hệ thống từ chối thì phải là 409 có thông điệp người dùng hiểu được.
- **Rủi ro từ code**: `createNhanVien` không có vòng lặp thử lại `P2002` (`nhanVien.service.ts:170-194`) → dự kiến request thứ hai nhận **409 `Dữ liệu bị trùng`** (thông điệp chung, không nói mã nào). Xem `ISSUE-HRM-02`.

**TC-hrm-051 — Concurrency stress: 8 request tạo nhân viên đồng thời** · P1
- Đo tỉ lệ 201 / 409 / 500. Bất biến: 0 lỗi 500, 0 mã trùng. Ghi số liệu vào `test-report.md`.

**TC-hrm-052 — Concurrency: xóa phòng ban trong lúc tạo nhân viên vào chính phòng ban đó** · P1
- **Tiền điều kiện**: `PB02` rỗng.
- **Các bước**: bắn đồng thời `DELETE /phong-ban/PB02` và `POST /nhan-vien` `{ ..., "ma_pb":"PB02" }`.
- **Kết quả mong đợi**: **một trong hai** phải thất bại. Trạng thái cuối **không được** là "PB02 `da_xoa=true` mà vẫn có nhân viên trỏ vào".
- **Rủi ro từ code**: `deletePhongBan` đếm rồi cập nhật **hoàn toàn không có transaction** (`phongBan.service.ts:239-267`) → cả hai cùng thành công là kịch bản rất dễ xảy ra. Xem `BUG-HRM-09`.

---

## 3. Test Suite: Hợp đồng lao động (`hrm_hop_dong`) — TC-hrm-053 … 085

### 3.1 CRUD & Validation

| ID | Loại | Yêu cầu | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:---|:--:|
| TC-hrm-053 | Happy | BR-03.1 | `NV0001` tồn tại | `POST /hop-dong` `{ "ma_nv":"nv0001", "so_hd":"HĐLĐ-001", "loai_hd":"thu_viec", "kieu_luong":"gross", "luong_chinh":15000000, "luong_bhxh":10000000, "ngay_bat_dau":"2026-01-01", "ngay_ket_thuc":"2026-03-31" }` | **201** `{ id: <uuid> }`; `ma_nv` được in hoa thành `NV0001` | P0 |
| TC-hrm-054 | Happy | — | `NV0001` có 2 HĐ | `GET /hop-dong?ma_nv=NV0001` | **200**, mảng 2 phần tử, **mới nhất lên đầu** theo `ngay_bat_dau desc, datetime0 desc, id desc` | P0 |
| TC-hrm-055 | Happy | — | `NV0001` có 1 HĐ | `PUT /hop-dong/<id>` đổi `ghi_chu` (gửi đủ trường trừ `ma_nv`) | **200**; `ma_nv` không đổi được (bị `.omit()` — `hopDong.validator.ts:84-86`) | P1 |
| TC-hrm-056 | Happy | — | `NV0001` có 1 HĐ | `DELETE /hop-dong/<id>` | **200**; `GET /nhan-vien/NV0001` trả 6 trường hợp đồng về `null` | P1 |
| TC-hrm-057 | Validation | — | — | `POST /hop-dong` với `ngay_ket_thuc = ngay_bat_dau = "2026-01-01"` | **400** "Ngày kết thúc phải sau ngày bắt đầu" — chú ý: điều kiện là `<=`, tức **bằng nhau cũng bị chặn** (`hopDong.validator.ts:67-78`) | P0 |
| TC-hrm-058 | Validation | — | — | `POST /hop-dong` với `ngay_ket_thuc = "2025-12-31"` < `ngay_bat_dau = "2026-01-01"` | **400** "Ngày kết thúc phải sau ngày bắt đầu" | P0 |
| TC-hrm-059 | Validation | — | — | `POST /hop-dong` với `luong_chinh: -1` | **400** "Lương chính không được âm" | P1 |
| TC-hrm-060 | Validation | — | — | `POST /hop-dong` với `luong_chinh: 1000000.555` | **400** "Lương chính chỉ được tối đa 2 số lẻ" (chặn Postgres làm tròn im lặng — `hopDong.validator.ts:19-21`) | P1 |
| TC-hrm-061 | Boundary | — | — | `POST /hop-dong` với `luong_chinh: 999999999999.99` rồi `1000000000000` | Lần 1 **201**; lần 2 **400** "vượt giới hạn cho phép" | P2 |
| TC-hrm-062 | Validation | — | — | `POST /hop-dong` với `kieu_luong":"GROSS"` | **400** (enum phân biệt hoa/thường, chỉ nhận `gross`/`net`) | P1 |
| TC-hrm-063 | Validation | — | — | `POST /hop-dong` với `loai_hd":""` | **400** "Chưa chọn loại hợp đồng" | P1 |
| TC-hrm-064 | Edge | — | `NV0009` đã xóa mềm | `POST /hop-dong` `{ "ma_nv":"NV0009", ... }` | **404** "Không tìm thấy nhân viên" | P1 |
| TC-hrm-065 | Edge | — | `NV0001` đã xóa mềm, HĐ vẫn còn dòng trong DB | `PUT /hop-dong/<id>` và `DELETE /hop-dong/<id>` | Cả hai **404** "Không tìm thấy hợp đồng" (lọc `nhan_vien.da_xoa=false`) | P1 |
| TC-hrm-066 | Edge | — | — | `POST /hop-dong` với `loai_hd":"hop_dong_dac_biet_ABC"` (giá trị lạ, ≤24 ký tự) | **201** — `loai_hd` là **chữ tự do có chủ đích** (`schema.prisma:966-969`); và trên màn nhân viên nó quy về `hdld` (`loaiHdVeNhanVien`) | P2 |

### 3.2 Chống chồng lấn thời gian (BR-03.3) — nhóm ca then chốt

> Tất cả ca dưới đây bám **BR-03.3** trong `hrm-spec.md`. Đọc mã nguồn cho thấy `createHopDong`/`updateHopDong` **hiện chưa có bất kỳ kiểm tra chồng lấn nào** (`hopDong.service.ts:185-218`) và schema cũng không có ràng buộc (`schema.prisma:960-990`) → **dự kiến toàn bộ nhóm này FAIL ở Phase B**. Đây là ca kiểm thử kỳ vọng theo SPEC, không phải theo code hiện tại.
> **Mã lỗi mong đợi**: **409** (`ConflictError`) — thống nhất với mọi lỗi ràng buộc nghiệp vụ khác của HRM. *(Bản `test-cases.md` cũ ghi 400 là sai so với `errorHandler.plugin.ts:29`.)*

| ID | Loại | Tiền điều kiện (HĐ đã có của `NV0001`) | Hợp đồng định tạo/sửa | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-067 | Edge | `[2026-01-01, 2026-12-31]` | `POST` `[2026-06-01, 2027-05-31]` | **409** chồng lấn, nêu tên HĐ đang vướng | P0 |
| TC-hrm-068 | Edge | `[2026-01-01, 2026-12-31]` | `POST` `[2025-06-01, 2026-03-01]` (giao đầu) | **409** | P0 |
| TC-hrm-069 | Edge | `[2026-01-01, 2026-12-31]` | `POST` `[2026-03-01, 2026-06-30]` (nằm gọn bên trong) | **409** | P0 |
| TC-hrm-070 | Edge | `[2026-01-01, 2026-12-31]` | `POST` `[2025-01-01, 2027-12-31]` (bao trùm) | **409** | P0 |
| TC-hrm-071 | Edge | `[2026-01-01, null]` (vô thời hạn) | `POST` `[2027-01-01, 2027-12-31]` | **409** — HĐ vô thời hạn chặn mọi HĐ bắt đầu sau nó | P0 |
| TC-hrm-072 | Edge | `[2026-01-01, 2026-12-31]` | `POST` `[2027-01-01, null]` | **409** nếu spec cấm 2 HĐ vô thời hạn chồng nhau; **201** nếu hợp lệ (liền mạch, không giao cắt) → **kỳ vọng 201**, dùng làm ca đối chứng "không chặn oan" | P0 |
| TC-hrm-073 | Boundary | `[2026-01-01, 2026-03-31]` | `POST` `[2026-03-31, 2026-12-31]` (trùng đúng **1 ngày** ở biên) | **409** — ngày 31/03 có 2 HĐ cùng hiệu lực | P0 |
| TC-hrm-074 | Boundary | `[2026-01-01, 2026-03-31]` | `POST` `[2026-04-01, 2026-12-31]` (liền kề, không giao) | **201** — ca đối chứng, tuyệt đối **không được** chặn oan | P0 |
| TC-hrm-075 | Boundary | `[2026-01-01, 2026-03-31]` + `[2026-05-01, 2026-12-31]` | `POST` `[2026-04-01, 2026-04-30]` (lấp khe) | **201** | P1 |
| TC-hrm-076 | Edge | `NV0001` có `[2026-01-01, 2026-03-31]`, `NV0002` có `[2026-01-01, null]` | `POST` cho `NV0001` `[2026-04-01, null]` | **201** — chồng lấn chỉ xét **trong cùng 1 nhân viên**, không được chặn chéo người | P0 |
| TC-hrm-077 | Edge | `NV0001` có HĐ A `[2026-01-01, 2026-03-31]` và HĐ B `[2026-04-01, null]` | `PUT` HĐ A đổi `ngay_ket_thuc` → `2026-06-30` | **409** — `updateHopDong` cũng phải kiểm, và phải **bỏ qua chính dòng đang sửa** | P0 |
| TC-hrm-078 | Regression | `NV0001` có HĐ A duy nhất | `PUT` HĐ A đổi mỗi `ghi_chu` | **200** — sửa chính nó không được tự coi là chồng lấn với chính nó | P0 |

### 3.3 Nghiệp vụ đổi hợp đồng (`POST /hop-dong/doi`) — BR-03.4

| ID | Loại | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-079 | Happy / AC-02 | `NV0001` có HĐ thử việc `[2026-01-01, 2026-03-31]`, hôm nay nằm trong khoảng đó | `POST /hop-dong/doi` `{ "ma_nv":"NV0001", "ngay_chot":"2026-03-31", "so_hd":"HĐLĐ-002", "loai_hd":"xac_dinh", "kieu_luong":"gross", "luong_chinh":20000000, "luong_bhxh":10000000, "ngay_bat_dau":"2026-04-01", "ngay_ket_thuc":"2027-03-31" }` | **201** `{ id, "da_chot_hop_dong_cu": true }`; HĐ cũ có `ngay_ket_thuc=2026-03-31`; HĐ mới `[2026-04-01, 2027-03-31]`; `GET /hop-dong?ma_nv=NV0001` trả đúng 2 dòng | P0 |
| TC-hrm-080 | Validation | Như trên | `ngay_chot":"2026-03-31"`, `ngay_bat_dau":"2026-03-31"` | **400** "Hợp đồng mới phải bắt đầu sau ngày chốt hợp đồng cũ" (`hopDong.validator.ts:105-111`) | P0 |
| TC-hrm-081 | Edge | `NV0001` đang có HĐ hiệu lực | `POST /hop-dong/doi` **không** truyền `ngay_chot` | **409** "Nhân viên đang có hợp đồng hiệu lực — phải chọn ngày chốt hợp đồng cũ." | P0 |
| TC-hrm-082 | Edge | `NV0002` **chưa có** hợp đồng nào | `POST /hop-dong/doi` có truyền `ngay_chot":"2026-03-31"`, HĐ mới `[2026-04-01, null]` | **201** `{ "da_chot_hop_dong_cu": false }` — báo theo việc ĐÃ LÀM, không theo thứ client gửi | P1 |
| TC-hrm-083 | Edge | HĐ đang hiệu lực bắt đầu `2026-01-01` | `POST /hop-dong/doi` với `ngay_chot":"2026-01-01"` | **409** "Ngày chốt phải sau ngày bắt đầu của hợp đồng đang hiệu lực." (`<=` chứ không `<` — `hopDong.service.ts:254-258`) | P1 |
| TC-hrm-084 | Edge | HĐ đang hiệu lực `[2026-01-01, null]`; hôm nay là `2026-06-15` | `POST /hop-dong/doi` với `ngay_chot":"2026-02-01"` (chốt lùi vào quá khứ) | **Cần BA chốt.** Code hiện **cho phép** (chỉ so với `ngay_bat_dau`). Ghi nhận hành vi thật, không tự đoán | P1 |

**TC-hrm-085 — Edge NGHIÊM TRỌNG: đổi hợp đồng khi nhân viên có hợp đồng ký trước cho TƯƠNG LAI** · P0
- **Tiền điều kiện**: hôm nay `2026-03-01`. `NV0003` có HĐ A `[2026-01-01, 2026-06-30]` (đang hiệu lực) **và** HĐ B `[2027-01-01, null]` (đã ký trước cho tương lai).
- **Các bước**: `POST /hop-dong/doi` `{ "ma_nv":"NV0003", "ngay_chot":"2026-06-30", "ngay_bat_dau":"2026-07-01", "ngay_ket_thuc":null, ... }`.
- **Kết quả mong đợi**: **409** — HĐ mới `[2026-07-01, ∞)` chồng lấn HĐ B `[2027-01-01, ∞)`.
- **Rủi ro từ code**: `doiHopDong` chỉ tìm hợp đồng có `ngay_bat_dau <= homNay` (`hopDong.service.ts:235-243`), **không nhìn thấy HĐ tương lai**, và không có bước kiểm chồng lấn nào → dự kiến trả **201** và tạo ra 2 HĐ chồng nhau. Xem `BUG-HRM-06`.

**TC-hrm-086 — Edge: mốc "hôm nay" lệch múi giờ trong `POST /hop-dong/doi`** · P0
- **Tiền điều kiện**: giả lập đồng hồ hệ thống ở **03:00 giờ Việt Nam ngày 2026-04-01** (tức `2026-03-31T20:00:00Z`). `NV0001` có HĐ A `[2026-01-01, 2026-03-31]` và HĐ B `[2026-04-01, null]`.
- **Các bước**: gọi `GET /nhan-vien/NV0001` rồi `POST /hop-dong/doi` cho `NV0001`.
- **Kết quả mong đợi**: cả hai đường phải đồng ý rằng **HĐ B là hợp đồng hiện hành** (theo `homNayVN()`).
- **Rủi ro từ code**: `chonHopDongHienHanh` dùng `homNayVN()` (`hopDong.service.ts:61-66, 97`) nhưng `doiHopDong` dùng `new Date()` + `setUTCHours(0,0,0,0)` (`hopDong.service.ts:233-234`) → trong khung 00:00–06:59 giờ VN, `doiHopDong` vẫn coi **HĐ A** là hiện hành. Màn hình nói một đằng, thao tác ghi làm một nẻo. Xem `BUG-HRM-07`.

**TC-hrm-087 — Concurrency: hai request "đổi hợp đồng" cùng lúc cho một nhân viên** · P0
- **Tiền điều kiện**: `NV0001` có đúng 1 HĐ đang hiệu lực `[2026-01-01, null]`; hôm nay `2026-06-01`.
- **Các bước**: `Promise.all` 2 request `POST /hop-dong/doi` với `ngay_chot":"2026-06-30"`, `ngay_bat_dau":"2026-07-01"`, `so_hd` khác nhau.
- **Bất biến bắt buộc**: sau khi chạy, `NV0001` phải có **tối đa 1 hợp đồng hiệu lực tại mỗi mốc thời gian**; **không** được có 2 HĐ cùng `[2026-07-01, ∞)`.
- **Rủi ro từ code**: `db.$transaction` mặc định chạy ở mức cô lập READ COMMITTED, cả hai đọc cùng `cu`, cùng chốt, cùng tạo mới (`hopDong.service.ts:229-268`) → dự kiến sinh 2 hợp đồng chồng nhau. Xem `BUG-HRM-08`.

**TC-hrm-088 — Concurrency: hai request `POST /hop-dong` cùng khoảng ngày** · P1
- Bắn đồng thời 2 `POST /hop-dong` cho cùng `NV0001` với cùng `[2026-01-01, 2026-12-31]`. Bất biến: chỉ 1 thành công (sau khi vá BR-03.3). Ghi nhận hành vi hiện tại.

### 3.4 Hợp đồng hiện hành (BR-03.2) & luật công đoàn (BR-03.5)

| ID | Loại | Tiền điều kiện | Các bước | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-089 | Happy | `NV0001` có HĐ `[2026-01-01, 2026-12-31]`, hôm nay `2026-06-01` | `GET /nhan-vien` | `so_hop_dong` = HĐ đó; `ngay_hieu_luc_toi = "2026-12-31"` | P0 |
| TC-hrm-090 | Edge | HĐ A `[2026-01-01, 2026-03-31]`, HĐ B `[2026-04-01, null]`, hôm nay `2026-06-01` | `GET /nhan-vien` | Trả HĐ **B** (đang hiệu lực), `ngay_hieu_luc_toi = null` | P0 |
| TC-hrm-091 | Edge | Chỉ có HĐ A `[2025-01-01, 2025-12-31]` (đã hết hạn), hôm nay `2026-06-01` | `GET /nhan-vien` | Trả HĐ **A** — "không có HĐ nào hiệu lực thì lấy cái mới nhất trong lịch sử" | P0 |
| TC-hrm-092 | Edge | Chỉ có HĐ `[2027-01-01, null]` (tương lai), hôm nay `2026-06-01` | `GET /nhan-vien` | Trả chính HĐ tương lai đó (là dòng đầu sau khi sắp xếp) — *cần BA xác nhận đây có phải hành vi mong muốn không, vì nhân viên hiện KHÔNG có hợp đồng hiệu lực* | P1 |
| TC-hrm-093 | Edge | 2 HĐ **cùng `ngay_bat_dau` `2026-01-01`**, khác `datetime0` | `GET /nhan-vien`, sau đó `PUT` sửa `ghi_chu` của HĐ cũ hơn rồi `GET` lại | Hợp đồng hiện hành **không đổi** giữa 2 lần đọc (tiêu chí phụ `datetime0 desc, id desc` — `hopDong.service.ts:114-118`) | P1 |
| TC-hrm-094 | Edge | `NV0001` không có HĐ nào | `GET /nhan-vien` và `GET /nhan-vien/NV0001` | 6 trường hợp đồng đều `null`, `so_npt` vẫn đúng | P0 |
| TC-hrm-095 | Happy | BR-03.5 — `NV0001` có `cong_doan=true` | `POST /hop-dong` với `loai_hd":"khoan"` | **201**; `GET /nhan-vien/NV0001` → `cong_doan = false` | P0 |
| TC-hrm-096 | Edge | BR-03.5 — sau TC-hrm-095 | `POST /hop-dong` (hoặc `/doi`) với `loai_hd":"khong_xac_dinh"` | `cong_doan` **vẫn là `false`** — luật một chiều, không tự bật lại | P0 |
| TC-hrm-097 | Edge | BR-03.5 | `PUT /hop-dong/<id>` đổi `loai_hd` từ `xac_dinh` → `khoan` | `cong_doan` chuyển về `false` (`updateHopDong` cũng gọi `apDungLuatCongDoan` — `hopDong.service.ts:215`) | P1 |
| TC-hrm-098 | Edge | Sau TC-hrm-095 | `DELETE /hop-dong/<id-hd-khoan>` | HĐ biến mất nhưng `cong_doan` **vẫn `false`** — không có đường hoàn tác, không có vết. Ghi nhận và báo BA (`BUG-HRM-24`) | P1 |
| TC-hrm-099 | Edge | — | `POST /hop-dong` cho `NV0001` với `so_hd` **trùng hệt** một HĐ đã có của chính `NV0001` | **201** (code không chặn) — *cần BA chốt có phải bug không* (`BUG-HRM-12`) | P1 |
| TC-hrm-100 | Edge | `NV0001` có `ngay_vao_lam = 2026-03-01` | `POST /hop-dong` với `ngay_bat_dau":"2020-01-01"` | **201** (code không chặn) — hợp đồng bắt đầu trước ngày vào làm. *Cần BA chốt* (`BUG-HRM-13`) | P1 |
| TC-hrm-101 | Edge | — | `POST /hop-dong` với `luong_bhxh: 50000000` > `luong_chinh: 10000000` | **201** (code không chặn) — *cần BA chốt* | P2 |

---

## 4. Test Suite: Người phụ thuộc (`hrm_nguoi_phu_thuoc`) — TC-hrm-102 … 118

| ID | Loại | Yêu cầu | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:---|:--:|
| TC-hrm-102 | Happy | BR-04.1 | `NV0001` tồn tại | `POST /nguoi-phu-thuoc` `{ "ma_nv":"NV0001", "ho_ten":"Nguyễn Văn Con", "quan_he":"con", "ngay_sinh":"15/05/2018", "mst":"8123456789", "dk_tu_thang":1, "dk_tu_nam":2026, "dk_den_thang":12, "dk_den_nam":2026 }` | **201** `{ id }` | P0 |
| TC-hrm-103 | Happy | — | `NV0001` đổi tên thành "Nguyễn Văn A2" | `GET /nguoi-phu-thuoc?ma_nv=NV0001` | **200**, `ten_nv = "Nguyễn Văn A2"` (tra lúc đọc, không lưu bản sao) | P1 |
| TC-hrm-104 | Edge | BR-04.1 | Đã có NPT MST `8123456789` cho `NV0001` | `POST /nguoi-phu-thuoc` NPT thứ hai cho **`NV0001`** cùng MST | **409** `Nhân viên NV0001 đã có người phụ thuộc mang MST 8123456789 — đăng ký trùng sẽ tính giảm trừ gia cảnh hai lần.` | P0 |
| TC-hrm-105 | **Edge (BUG)** | BR-04.1 | Đã có NPT MST `8123456789` cho `NV0001` | `POST /nguoi-phu-thuoc` cho **`NV0002`** (nhân viên KHÁC, cùng công ty) với cùng MST `8123456789` | **Kỳ vọng nghiệp vụ: 409** (một người phụ thuộc chỉ được tính giảm trừ cho MỘT người nộp thuế). **Code hiện trả 201** — `@@unique([ma_nv, mst])` chỉ chặn trong 1 nhân viên. Xem `BUG-HRM-05` | P0 |
| TC-hrm-106 | Edge | BR-04.1 | — | `POST /nguoi-phu-thuoc` 2 lần cho `NV0001` với `mst: null`, cùng `ho_ten` và cùng `so_cccd` | **201** cả hai (Postgres coi NULL khác nhau — `schema.prisma:945-949`). Ghi nhận là **rủi ro nhập trùng người**; đề nghị BA quyết có chặn theo `so_cccd` không | P0 |
| TC-hrm-107 | Edge | — | NPT đã có `mst = null` | `PUT /nguoi-phu-thuoc/<id>` đặt `mst` = MST đã tồn tại ở NPT khác của cùng NV | **409** trùng MST (`assertKhongTrungMst` có `boQuaId` — `nguoiPhuThuoc.service.ts:100-113`) | P1 |
| TC-hrm-108 | Regression | — | NPT có `mst = "8123456789"` | `PUT /nguoi-phu-thuoc/<id>` chỉ đổi `ho_ten`, **giữ nguyên** `mst` | **200** — không được coi chính nó là trùng | P0 |
| TC-hrm-109 | Validation | BR-04.2 | — | `POST /nguoi-phu-thuoc` với `dk_tu_thang: 13` / `0` | **400** "Tháng phải từ 1 đến 12" | P1 |
| TC-hrm-110 | Boundary | BR-04.2 | — | `dk_tu_nam: 1999` / `2101` rồi `2000` / `2100` | Hai giá trị đầu **400**; hai giá trị sau **201** | P1 |
| TC-hrm-111 | Validation | BR-04.2 | — | `POST` với `dk_tu_thang: 5` nhưng `dk_tu_nam: null` | **400** "Có tháng đăng ký thì phải có năm" | P1 |
| TC-hrm-112 | Validation | BR-04.2 | — | `POST` với `dk_tu_nam: 2026` nhưng `dk_tu_thang: null` | **400** "Có năm đăng ký thì phải có tháng" | P1 |
| TC-hrm-113 | Boundary | BR-04.2 | — | `dk_tu = 06/2026`, `dk_den = 05/2026` | **400** "Kỳ đăng ký đến phải sau hoặc bằng kỳ đăng ký từ" | P0 |
| TC-hrm-114 | Boundary | BR-04.2 | — | `dk_tu = 06/2026`, `dk_den = 06/2026` (cùng kỳ) | **201** — cho phép bằng nhau | P1 |
| TC-hrm-115 | Edge | BR-04.2 | `NV0001` đã có NPT X đăng ký `01/2026 – 12/2026` | `POST` NPT Y (MST khác) cho `NV0001`, kỳ `06/2026 – 12/2027` | **201** — code không kiểm chồng lấn kỳ giữa các NPT. *Cần BA xác nhận có phải rule cần thiết không* | P2 |
| TC-hrm-116 | Validation | — | — | `POST` với `ngay_sinh":"32/13/2020"` rồi `"29/02/2026"` (2026 không nhuận) rồi `"2018-05-15"` | Cả ba **400** ("định dạng dd/MM/yyyy" hoặc "Ngày sinh không có thật") — `nguoiPhuThuoc.validator.ts:20-48` | P0 |
| TC-hrm-117 | Boundary | — | — | `POST` với `ngay_sinh":"01/01/1800"` và `"01/01/2999"` | **201** cả hai (code chỉ kiểm ngày có thật, không kiểm khoảng hợp lý). Ghi nhận là rủi ro chất lượng dữ liệu | P2 |
| TC-hrm-118 | Edge | — | `NV0009` đã xóa mềm | `POST /nguoi-phu-thuoc` cho `NV0009`; và `PUT` / `DELETE` NPT thuộc `NV0009` | `POST` → **404** "Không tìm thấy nhân viên"; `PUT`/`DELETE` → **404** "Không tìm thấy người phụ thuộc" | P1 |

---

## 5. Test Suite: Tài liệu & Google Drive (`hrm_tai_lieu`) — TC-hrm-119 … 149

> **Bắt buộc**: mọi ca gọi Google phải chạy trên **stub** (`fetch` bị thay). Không gọi Google thật.

### 5.1 CRUD hồ sơ giấy tờ

| ID | Loại | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-119 | Happy | `NV0001` tồn tại | `POST /tai-lieu` `{ "ma_nv":"NV0001", "loai":"cccd", "so_hieu":"001090012345", "ngay_cap":"2021-08-10", "noi_cap":"Cục CSQLHC" }` | **201** `{ id }`; `drive_file_id`, `ten_file`, `mime_type`, `kich_thuoc` đều `null` | P0 |
| TC-hrm-120 | Happy | — | `GET /tai-lieu?ma_nv=NV0001` | **200**, mỗi dòng có `ten_nv` + 4 trường con trỏ Drive | P0 |
| TC-hrm-121 | Validation | — | `POST /tai-lieu` `{ "ma_nv":"NV0001", "loai":"" }` | **400** "Chưa chọn loại tài liệu" | P1 |
| TC-hrm-122 | Edge | — | `POST /tai-lieu` với `loai":"giay_kham_suc_khoe"` (không thuộc 5 loại gợi ý của FE) | **201** — `loai` là chữ tự do có chủ đích (`schema.prisma:1002-1006`) | P2 |
| TC-hrm-123 | Boundary | — | `POST /tai-lieu` với `loai` 51 ký tự / `so_hieu` 65 ký tự / `noi_cap` 255 ký tự | **400** cả ba | P2 |
| TC-hrm-124 | Edge | `NV0009` đã xóa mềm | `POST /tai-lieu` cho `NV0009` | **404** "Không tìm thấy nhân viên" (kiểm + ghi trong cùng transaction — `taiLieu.service.ts:89-96`) | P1 |
| TC-hrm-125 | Happy | Tài liệu chưa đính file | `PUT /tai-lieu/<id>` đổi `so_hieu` | **200**; các trường Drive không bị đụng | P1 |
| TC-hrm-126 | Security | Tài liệu đã có `drive_file_id` | `PUT /tai-lieu/<id>` với body cố ý thừa `{ "drive_file_id":"ID-GIA", "ten_file":"x.pdf", "ma_nv":"NV0002" }` | **200**; đọc lại thấy `drive_file_id`, `ten_file`, `ma_nv` **không đổi** (Zod strip + `.omit({ma_nv})`) | P0 |
| TC-hrm-127 | **Edge (BUG)** | Tài liệu có `drive_file_id = "FILE-X"` trên Drive stub | `DELETE /tai-lieu/<id>` | **Kỳ vọng theo `api-contract.md` mục 6.1 + `CONTEXT_SUMMARY.md`: 200 và file `FILE-X` bị xóa trên Drive (best-effort).** **Code thật KHÔNG gọi Drive** (`taiLieu.service.ts:124-135`) → file mồ côi. Xem `BUG-HRM-10` | P0 |
| TC-hrm-128 | Edge | `NV0001` có 2 tài liệu, 1 trong đó có file | `DELETE /nhan-vien/NV0001` (xóa mềm) rồi `GET /tai-lieu?ma_nv=NV0001` | **200** mảng rỗng; dòng tài liệu và file Drive **vẫn tồn tại**. Cần BA xác nhận đây là hành vi mong muốn về lưu trữ PII | P1 |

### 5.2 Tải lên / xem / gỡ file scan

| ID | Loại | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-129 | Happy | Công ty đã nối Drive; tài liệu `T1` của `NV0001` chưa có file | `POST /tai-lieu/T1/file` multipart 1 file `cccd.jpg` (`image/jpeg`, 1.5MB) | **201** `{ id, ten_file, mime_type:"image/jpeg", kich_thuoc }`; stub Drive ghi nhận đã tạo `maxv` → `<MST> - <Tên Cty>` → `NV0001 - Nguyễn Văn A`; DB lưu đủ 4 trường con trỏ; `hrm_nhan_vien.drive_folder_id` được ghi nhớ | P0 |
| TC-hrm-130 | Happy | Sau TC-hrm-129 | `POST /tai-lieu/T2/file` cho tài liệu khác của **cùng** `NV0001` | Stub **không** tạo lại thư mục (dùng `drive_folder_id` đã nhớ — `taiLieuDrive.service.ts:282`) | P1 |
| TC-hrm-131 | Edge | Tài liệu `T1` đã có `drive_file_id = "OLD"` | `POST /tai-lieu/T1/file` với file mới | **201**; upload file mới **trước**, xóa `OLD` **sau**, DB trỏ sang file mới (`taiLieuDrive.service.ts:338-360`) | P1 |
| TC-hrm-132 | Edge | Như trên, stub `xoaFile` ném lỗi | `POST /tai-lieu/T1/file` | **201** — lỗi xóa file cũ bị nuốt có chủ đích (`.catch(() => undefined)`); file cũ thành mồ côi. Ghi nhận số lượng file mồ côi | P2 |
| TC-hrm-133 | Boundary | BR-05.2 | `POST /tai-lieu/T1/file` với file **đúng 10MB** (10 485 760 byte) | **201** (`limits.fileSize` là ngưỡng vượt-thì-chặn) | P1 |
| TC-hrm-134 | Boundary | BR-05.2 | `POST /tai-lieu/T1/file` với file **10MB + 1 byte** | **409** `File vượt quá 10MB.` — do `@fastify/multipart` ném `FST_REQ_FILE_TOO_LARGE`, controller bắt và đổi thành `ConflictError` (`taiLieu.controller.ts:305-311`). **Không được** rơi xuống 500 | P0 |
| TC-hrm-135 | Validation | BR-05.2 | `POST /tai-lieu/T1/file` lần lượt với `virus.exe` (`application/octet-stream`), `bang_luong.xlsx`, `video.mp4` | **409** `Chỉ nhận ảnh (JPG, PNG, WEBP, HEIC) hoặc PDF — file gửi lên là "<mime>".` | P0 |
| TC-hrm-136 | Security | BR-05.2 | Gửi file `.exe` nhưng khai `Content-Type: image/jpeg` trong phần multipart | **Ghi nhận hành vi thật**: code chỉ tin `file.mimetype` do client khai (`taiLieuDrive.service.ts:327`), **không** kiểm magic bytes → dự kiến **201**. Đề nghị bổ sung kiểm chữ ký file | P1 |
| TC-hrm-137 | Validation | — | `POST /tai-lieu/T1/file` với `Content-Type: application/json` | **409** "Yêu cầu phải gửi dạng multipart/form-data." | P1 |
| TC-hrm-138 | Edge | — | `POST /tai-lieu/T1/file` với 2 file trong 1 request | **409** "Mỗi lần chỉ tải lên được một file." (`limits.files: 1`) | P1 |
| TC-hrm-139 | Edge | Công ty **chưa** nối Drive | `POST /tai-lieu/T1/file` | **409** "Công ty chưa kết nối Google Drive — bấm \"Thêm file\" để đăng nhập Google và kết nối." | P0 |
| TC-hrm-140 | Edge | Thiếu env `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | `POST /tai-lieu/T1/file` và `GET /tai-lieu/drive/lien-ket` | **409** "Máy chủ chưa cấu hình Google Drive (thiếu …)" | P1 |
| TC-hrm-141 | Edge | Thiếu env `GDT_CRED_ENC_KEY` | `GET /tai-lieu/drive/callback` với `code` + `state` hợp lệ | Trang HTML báo "Máy chủ chưa cấu hình khóa mã hóa (GDT_CRED_ENC_KEY) nên không lưu được kết nối Drive." (thông điệp của `ConflictError` được hiện, khác lỗi Google) | P1 |
| TC-hrm-142 | Happy | Tài liệu có file `image/jpeg` | `GET /tai-lieu/T1/file` | **200**; header `content-type: image/jpeg`, `content-disposition: inline; filename*=UTF-8''…`, `cache-control: no-store, private`, `x-content-type-options: nosniff` | P0 |
| TC-hrm-143 | Edge | Tài liệu chưa đính file | `GET /tai-lieu/T1/file` và `DELETE /tai-lieu/T1/file` | Cả hai **404** "Tài liệu này chưa đính file scan." | P1 |
| TC-hrm-144 | Edge | Stub Drive trả **404** cho `alt=media` | `GET /tai-lieu/T1/file` | **404** với thông điệp `DRIVE_FILE_KHONG_MO_DUOC` (nêu cả 2 khả năng: bị xóa / thuộc tài khoản Google cũ) — **không** phải 502 | P0 |
| TC-hrm-145 | Security | Stub Drive trả file **20MB** cho `alt=media` (khách tự thay file lớn trên Drive) | `GET /tai-lieu/T1/file` | **502**; máy chủ **không** nạp trọn 20MB vào RAM (dừng ngay khi vượt trần — `driveClient.ts:400-423`). Đo RSS trước/sau | P0 |
| TC-hrm-146 | Security | Stub Drive trả `content-length` nhỏ nhưng thân dữ liệu lớn hơn trần | `GET /tai-lieu/T1/file` | **502** — phải chặn ở vòng đọc theo khối, không chỉ tin header | P1 |
| TC-hrm-147 | Happy | Tài liệu có file | `DELETE /tai-lieu/T1/file` | **200** `{ id }`; stub ghi nhận `DELETE` file; DB đặt 4 trường con trỏ về `null`; **dòng tài liệu vẫn còn** | P0 |
| TC-hrm-148 | Edge | Stub Drive trả **500** khi xóa | `DELETE /tai-lieu/T1/file` | **502**; DB **không** bị xóa con trỏ (khác `dinhKemFile`, ở đây lỗi được ném ra — `taiLieuDrive.service.ts:419`) | P1 |
| TC-hrm-149 | Concurrency | Tài liệu `T1` chưa có file | `Promise.all` 2 request `POST /tai-lieu/T1/file` với 2 file khác nhau | **Bất biến**: DB chỉ giữ 1 `drive_file_id`, và **số file còn lại trên Drive stub phải bằng 1**. Rủi ro từ code: cả hai đọc `tl.drive_file_id` cũ, cùng upload → 1 file mồ côi (`BUG-HRM-16`) | P1 |

### 5.3 Luồng OAuth Google Drive

| ID | Loại | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-150 | Happy | Env Drive đủ; công ty chưa nối | `GET /tai-lieu/drive/trang-thai` | **200** `{ may_chu_san_sang:true, da_ket_noi:false, email:null }` | P1 |
| TC-hrm-151 | Happy | Như trên | `GET /tai-lieu/drive/lien-ket` | **200** `{ url }` chứa `access_type=offline`, `prompt=consent`, `scope` gồm `drive.file`, và `state`; đồng thời `Set-Cookie: driveOauthState=…; HttpOnly; SameSite=Lax; Path=<đường dẫn callback>; Max-Age=600` | P0 |
| TC-hrm-152 | Authz | Công ty **đã** nối Drive; đăng nhập bằng `OWNER_EMPLOYEE` | `GET /tai-lieu/drive/lien-ket` | **403** "Công ty đã kết nối Google Drive. Chỉ chủ tài khoản mới đổi được sang tài khoản Google khác…" | P0 |
| TC-hrm-153 | **Authz (RỦI RO)** | Công ty **chưa** nối Drive; đăng nhập bằng `OWNER_EMPLOYEE` có module `hrm` | `GET /tai-lieu/drive/lien-ket` → hoàn tất callback bằng tài khoản Google **cá nhân** của người đó | **Code hiện: 200** — nhân viên thường nối kho tài liệu của cả công ty vào Drive cá nhân. **Mâu thuẫn BR-05.1** ("file scan thuộc quyền sở hữu của doanh nghiệp, không phụ thuộc cá nhân tài khoản HR"). Xem `BUG-HRM-11`. **Ca này phải được BA phán quyết trước khi chốt kỳ vọng** | P0 |
| TC-hrm-154 | Happy | Đã gọi `lien-ket`, có cookie `driveOauthState` | `GET /tai-lieu/drive/callback?code=OK&state=<state khớp cookie>` | **200** HTML, thông điệp "Đã kết nối Google Drive (email@…)."; header CSP `default-src 'none'; script-src 'nonce-…'`; `Set-Cookie` xóa `driveOauthState`; DB `don_vi` lưu `driveRefreshTokenCipher/Iv/Tag` (đã mã hóa, **không phải chuỗi thô**) + `driveEmail`, `driveRootFolderId = null` | P0 |
| TC-hrm-155 | Security | Đã có cookie state `S1` | `GET /callback?code=OK&state=S2` (state hợp lệ HMAC nhưng **khác** cookie) | **200** HTML báo "Phiên kết nối không hợp lệ hoặc đã dùng rồi…"; **DB không đổi** | P0 |
| TC-hrm-156 | Security | Gọi callback lần 2 với **cùng** `state` đã dùng | `GET /callback?code=OK&state=S1` lần thứ hai | Lần 2 thất bại (cookie đã bị xóa ở lần 1) — **chống replay** | P0 |
| TC-hrm-157 | Security | — | `GET /callback?code=OK&state=<state hết hạn >10 phút>` (cookie khớp) | HTML "Phiên kết nối không hợp lệ hoặc đã hết hạn." (`driveClient.ts:486-488`) | P0 |
| TC-hrm-158 | Security | — | `GET /callback?code=OK&state=<state bị sửa 1 ký tự>` | Thất bại — `timingSafeEqual` không khớp; **không** rò rỉ chi tiết chữ ký | P0 |
| TC-hrm-159 | Security (XSS) | — | `GET /callback?error=<script>alert(1)</script>` | **200** HTML; nội dung `error` **không** xuất hiện trong trang (chỉ vào log — `taiLieu.controller.ts:230-234`); trang chỉ báo "Bạn chưa cấp quyền truy cập Google Drive." | P0 |
| TC-hrm-160 | Security (XSS) | Stub `userinfo` trả `email = "<img src=x onerror=alert(1)>@x.com"` | Hoàn tất callback thành công | Chuỗi bị escape thành `&lt;img …` trong HTML; CSP nonce chặn script; không có alert | P0 |
| TC-hrm-161 | Authz | Đăng nhập `OWNER_EMPLOYEE` | `DELETE /tai-lieu/drive/ket-noi` | **403** "Chỉ chủ tài khoản mới ngắt được kết nối Google Drive của công ty." | P0 |
| TC-hrm-162 | Happy | `OWNER`, công ty đã nối, một số NV đã có `drive_folder_id` | `DELETE /tai-lieu/drive/ket-noi` | **200** `{ da_ngat:true }`; 4 trường token + `driveRootFolderId` về `null`; **mọi** `hrm_nhan_vien.drive_folder_id` về `null`; `hrm_tai_lieu.drive_file_id` **giữ nguyên** (`taiLieuDrive.service.ts:150-175`) | P0 |
| TC-hrm-163 | Edge | Đã nối tài khoản `a@gmail.com` | Nối lại bằng `b@gmail.com` (OWNER) | `driveEmail` đổi; `driveRootFolderId=null`; toàn bộ `drive_folder_id` bị dọn; sau đó `GET /tai-lieu/T1/file` (file cũ ở Drive của `a`) trả **404** `DRIVE_FILE_KHONG_MO_DUOC` | P0 |
| TC-hrm-164 | Edge | Đã nối `a@gmail.com` | Nối lại đúng `a@gmail.com` | `drive_folder_id` của nhân viên **KHÔNG** bị dọn (chỉ dọn khi đổi tài khoản — `taiLieuDrive.service.ts:126-129`) | P1 |
| TC-hrm-165 | Edge | Stub `userinfo` trả `email = null` | Nối lại khi đang có kết nối cũ | Coi như đã đổi tài khoản → **có** dọn `drive_folder_id` ("thà dọn thừa") | P2 |
| TC-hrm-166 | Edge | Khách thu hồi quyền trên Google; stub token trả `400 {"error":"invalid_grant"}` | `POST /tai-lieu/T1/file` | **409** "Kết nối Google Drive đã hết hiệu lực (bị thu hồi quyền), vui lòng kết nối lại."; **kết nối trong DB bị xóa**; `GET /drive/trang-thai` → `da_ket_noi:false` | P0 |
| TC-hrm-167 | **Security (hồi quy trọng yếu)** | Stub token trả `401 {"error":"invalid_client"}` (người vận hành gõ sai `GOOGLE_CLIENT_SECRET`) | `POST /tai-lieu/T1/file` cho **2 tenant khác nhau** | **502** cho cả hai; **TUYỆT ĐỐI KHÔNG** được xóa `driveRefreshTokenCipher` của bất kỳ công ty nào (`taiLieuDrive.service.ts:238`). Sửa lại env là mọi thứ chạy tiếp | P0 |
| TC-hrm-168 | Edge | Stub token trả `429 rateLimitExceeded` | `POST /tai-lieu/T1/file` | **502** với thông điệp `DRIVE_LOI_GOOGLE`; kết nối **không** bị xóa | P1 |
| TC-hrm-169 | Edge | Stub `fetch` ném `TypeError: fetch failed` (mất mạng) | `POST /tai-lieu/T1/file` | **502** với thông điệp `DRIVE_KHONG_KET_NOI_DUOC` (`status = 0`, không bị hiểu nhầm là bị thu hồi quyền) | P0 |
| TC-hrm-170 | Security | — | Kiểm log của request `GET /callback?code=SECRET&state=…` | Trong log, `url` bị cắt query thành `/api/v1/hrm/tai-lieu/drive/callback?…`; **không** thấy giá trị `code`/`state` (`app.ts:36-46`) | P1 |

---

## 6. Test Suite: Bảo mật xuyên suốt, Cô lập tenant & Hồi quy — TC-hrm-171 … 185

| ID | Loại | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-171 | Authz | Không gửi cookie/header nào | Gọi **tất cả 29 endpoint** HRM | **401** cho 28 endpoint; **riêng** `GET /tai-lieu/drive/callback` không đòi đăng nhập (trả HTML báo thiếu tham số). Đây là ca **quét toàn bộ bảng route**, không được bỏ sót endpoint mới | P0 |
| TC-hrm-172 | Authz | Tài khoản `OWNER`, gói **tắt** `hrm` | Gọi 5 endpoint đại diện (mỗi thực thể 1 cái) | **403** `MODULE_NOT_INCLUDED` | P0 |
| TC-hrm-173 | Authz | Gói bật `hrm` nhưng `Subscription.status = EXPIRED` | `GET /nhan-vien` | **403** (kiểm cả `status` lẫn `ketThuc` — `modules.service.ts:38-43`) | P0 |
| TC-hrm-174 | Authz | Gói bật `hrm`, `status=ACTIVE` nhưng `ketThuc` đã qua | `GET /nhan-vien` | **403** | P0 |
| TC-hrm-175 | Authz | Tài khoản `ADMIN` | `GET /nhan-vien` | **200** (ADMIN bỏ qua guard module — `modules.service.ts:125`); nhưng vẫn phải qua `resolveTenantDb` (`donViId` phải hợp lệ) | P1 |
| TC-hrm-176 | Authz | Token hợp lệ nhưng `donViId = null` (chưa chọn công ty) | `GET /nhan-vien`, `GET /tai-lieu/drive/trang-thai` | **403** `NO_COMPANY` cho cả hai (`resolveTenantDb.ts:38-41`, `taiLieu.controller.ts:85-86`) | P0 |
| TC-hrm-177 | Authz | User bị **gỡ quyền vào công ty** sau khi token đã phát (token còn hạn) | `GET /nhan-vien` và `GET /tai-lieu/drive/trang-thai` | **403** `NO_ACCESS` cho cả hai — kiểm lại DB mỗi request, không tin `donViId` trong token | P0 |
| TC-hrm-178 | Authz | User bị `isActive = false` | `GET /nhan-vien` | **401** (`requireModule` kiểm `isActive` — `modules.service.ts:131-133`) | P1 |
| TC-hrm-179 | **Isolation** | Tenant A và tenant B **đều** có `NV0001` (dữ liệu khác nhau) | Đăng nhập tenant A → `GET /nhan-vien/NV0001` | Trả **đúng dữ liệu tenant A**; không có bất kỳ trường nào của tenant B (kiến trúc DB-per-tenant — `resolveTenantDb.ts:19-23`) | P0 |
| TC-hrm-180 | **Isolation** | Tenant B có tài liệu `T-B1` (`id` uuid đã biết) | Đăng nhập tenant A → `GET /tai-lieu/T-B1/file`, `PUT /tai-lieu/T-B1`, `DELETE /tai-lieu/T-B1` | **404** cả ba — `id` của tenant B không tồn tại trong DB tenant A | P0 |
| TC-hrm-181 | **Isolation** | Tenant B có `NV0007` (tenant A không có) | Đăng nhập tenant A → `POST /hop-dong` `{ "ma_nv":"NV0007", ... }`, `POST /nguoi-phu-thuoc` `{ "ma_nv":"NV0007" }`, `POST /tai-lieu` `{ "ma_nv":"NV0007" }` | **404** "Không tìm thấy nhân viên" cả ba — không tạo được bản ghi mồ côi | P0 |
| TC-hrm-182 | **Isolation** | User X có quyền vào cả tenant A và B; đang chọn A | Lấy `drive_file_id` của một tài liệu tenant B rồi, khi đang ở tenant A, cố mở qua `GET /tai-lieu/<id-cua-A>/file` sau khi ghi đè `drive_file_id` bằng `PUT` | `PUT` **không** ghi được `drive_file_id` (TC-hrm-126) → không có đường tham chiếu chéo file. Xác nhận `donViId` dùng để lấy token luôn là công ty **đang chọn**, đã kiểm quyền (`taiLieu.controller.ts:84-91`) | P0 |
| TC-hrm-183 | Security | — | Bắn 400 request `GET /nhan-vien` trong 1 phút từ cùng IP | Request thứ 301 trở đi nhận **429** (rate-limit toàn cục 300/phút — `app.ts:60`) | P1 |
| TC-hrm-184 | Security | — | Bắn 60 request `POST /tai-lieu/T1/file` mỗi request 10MB trong 1 phút | **Ghi nhận hành vi thật**: không có rate-limit riêng cho upload → 600MB đi vào máy chủ và 60 lượt gọi Drive trên **một OAuth client dùng chung mọi tenant**. Xem `BUG-HRM-17` | P1 |
| TC-hrm-185 | Regression / Contract | — | Với **mọi** endpoint: so sánh status + hình dạng thân phản hồi thực tế với `docs/hrm/architecture/api-contract.md` | Ghi lại **mọi** điểm lệch. Đã biết trước: POST trả **201** (contract ghi 200), thân bọc `{success,data}` (contract ghi mảng/đối tượng trần), base path `/api/v1/hrm` (contract ghi `/api`), `DELETE /phong-ban` còn lỗi 409 "còn phòng ban con" chưa được ghi, `DELETE /tai-lieu/:id` không xóa file Drive. Xem `BUG-HRM-14` | P0 |

---

## 6B. Test Suite: Quyết định nghiệp vụ — TC-hrm-186 … 260

> **Bổ sung 2026-09-07 sau vòng phản biện độc lập:** thêm nhóm **6B.11** (QĐ #7 — bị bỏ sót hoàn toàn ở bản đầu), **6B.12** (ba mã lỗi kỹ thuật dùng chung) và **6B.13** (hai quy tắc mới BR-hrm-067, BR-hrm-068). Ba nhóm mới có cột **AC / BR** để truy vết được tới yêu cầu gốc; **các nhóm 6B.1–6B.10 chưa có cột này** — xem đầu việc còn nợ ở `issues-and-bugs.md`.

> **Toàn bộ nhóm này thiết kế theo SPEC ĐÃ CHỐT, không theo mã hiện tại.** Mọi hành vi dưới đây **chưa có trong mã** (trừ chỗ ghi rõ "giữ nguyên"), nên **dự kiến FAIL ở Phase B** cho tới khi kỹ sư triển khai. FAIL ở đây là **bằng chứng đầu việc chưa làm**, không phải lỗi của ca kiểm thử.
> Nguồn: `docs/hrm/srs/hrm-spec.md` (BR-hrm-051…066, FR-hrm-036…043, E-hrm-052…064) và `docs/hrm/CONTEXT_SUMMARY.md` Mục 6.1.

### 6B.1 Ghi nhận nghỉ việc và tự chốt hợp đồng — QĐ #3 (BR-hrm-054, BR-hrm-055)

| ID | Loại | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-186 | Happy | `NV0001` đang làm, có 1 HĐ `[2026-01-01, null]` | `PUT` với `status="0"` và `ngay_nghi_viec="2026-09-30"` | **200**. `status='0'`, `ngay_nghi_viec` lưu đúng, HĐ có `ngay_ket_thuc='2026-09-30'`. Phản hồi liệt kê **đúng 1** hợp đồng đã chốt kèm số hợp đồng | P0 |
| TC-hrm-187 | Validation | `NV0001` đang làm | `PUT` với `status="0"`, **không** gửi ngày nghỉ | **400 E-hrm-052**. Không đổi trạng thái, không đụng hợp đồng | P0 |
| TC-hrm-188 | Validation | `NV0001` có ngày vào làm `2026-03-01` | `PUT` với `status="0"`, ngày nghỉ `2026-02-01` | **400 E-hrm-053**, thông điệp nêu đích danh ngày vào làm | P0 |
| TC-hrm-189 | Edge | `NV0001` có HĐ A `[2026-01-01, null]` **và** HĐ B `[2026-12-01, null]` ký trước cho tương lai | Ghi nhận nghỉ ngày `2026-09-30` | **409 E-hrm-054** nêu đích danh số hợp đồng B và ngày bắt đầu. **Giao dịch hủy hoàn toàn**: trạng thái vẫn là đang làm, HĐ A **không** bị chốt | P0 |
| TC-hrm-190 | Edge | `NV0001` có 3 HĐ: đã kết thúc `[…, 2025-12-31]`, đang chạy `[2026-01-01, null]`, đang chạy khác loại `[2026-02-01, 2026-12-31]` | Ghi nhận nghỉ ngày `2026-09-30` | **200**. Chốt **đúng 2** HĐ còn mở; HĐ đã kết thúc `2025-12-31` **giữ nguyên**, không bị kéo dài ra | P0 |
| TC-hrm-191 | Edge | `NV0001` đang làm | Ghi nhận nghỉ với ngày **trong tương lai** `2027-01-01` | **200** — hợp lệ, báo trước nghỉ việc. HĐ chốt `2027-01-01` nên **vẫn đang hiệu lực hôm nay`; nhân viên đã nghỉ mà còn HĐ chạy là cặp trạng thái hợp lệ | P1 |
| TC-hrm-192 | Regression | `NV0002` đã ở trạng thái đã nghỉ từ trước đợt này, ngày nghỉ **rỗng** | `GET /nhan-vien`, rồi `PUT` sửa họ tên mà không đổi trạng thái | **200** cả hai. Ngày nghỉ trả `null` không lỗi; `PUT` **không** đòi nhập lại ngày nghỉ. Dữ liệu cũ không bị chặn | P0 |

### 6B.2 Số hợp đồng duy nhất toàn công ty — QĐ #4 (BR-hrm-056, E-hrm-055)

| ID | Loại | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-193 | Edge | `NV0001` có HĐ số `HĐLĐ-001/2026` | Tạo HĐ cho **`NV0002`** cùng số hợp đồng | **409 E-hrm-055**, thông điệp nêu mã nhân viên và họ tên đang giữ số đó | P0 |
| TC-hrm-194 | Edge | như trên | Tạo HĐ với số hợp đồng thừa khoảng trắng hai đầu | **409** — so khớp sau khi cắt khoảng trắng | P1 |
| TC-hrm-195 | Edge | như trên | Tạo HĐ với số hợp đồng khác hoa thường | **201** — có phân biệt hoa thường, đúng BR-hrm-056 | P1 |

### 6B.3 Ràng buộc lương — QĐ #5 (BR-hrm-057, BR-hrm-058)

| ID | Loại | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:--:|
| TC-hrm-196 | Validation | Tạo HĐ với lương chính bằng 0 | **400 E-hrm-056** | P0 |
| TC-hrm-197 | Validation | Tạo HĐ **không** gửi lương chính | **400 E-hrm-056** | P0 |
| TC-hrm-198 | Validation | Tạo HĐ có bật trích BHXH nhưng lương BHXH bằng 0 | **400 E-hrm-057** | P0 |
| TC-hrm-199 | Happy | Tạo HĐ tắt trích BHXH, lương BHXH để trống | **201** — không trích thì không đòi mức đóng | P0 |
| TC-hrm-200 | Regression | Dữ liệu cũ có HĐ lương chính bằng 0 (sinh từ `backfill-hop-dong.ts`); sửa **mỗi ô ghi chú** | **Ghi nhận hành vi thật.** Nếu validator chặn thì mọi lần sửa HĐ cũ đều fail, nên **bắt buộc rà và dọn dữ liệu trước khi bật**. Đây là ca bảo vệ kế hoạch triển khai, không phải ca chức năng | P0 |

### 6B.4 Hợp đồng một ngày và chồng lấn theo loại — QĐ #6 và QĐ #1 (BR-hrm-022, BR-hrm-026, BR-hrm-053)

| ID | Loại | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-201 | Happy | `NV0001` chưa có HĐ | Tạo HĐ `[2026-05-01, 2026-05-01]` | **201** — hợp đồng đúng một ngày là hợp lệ | P0 |
| TC-hrm-202 | Edge | `NV0001` có HĐ khoán `[2026-05-01, 2026-05-01]` | Tạo HĐ khoán khác cũng `[2026-05-01, 2026-05-01]` | **409** chồng lấn. **Ca then chốt**: khoảng ngày phải đóng hai đầu; dùng khoảng nửa mở thì hai HĐ một ngày này có độ dài bằng không và **lọt lưới** | P0 |
| TC-hrm-203 | Edge | `NV0001` có HĐ `[2026-01-01, 2026-03-31]` | Tạo HĐ **cùng loại** `[2026-03-31, 2026-12-31]` | **409** — ngày 31/03 không thuộc hai hợp đồng cùng loại | P0 |
| TC-hrm-204 | Happy | `NV0001` có HĐ loại `khong_xac_dinh` `[2026-01-01, null]` | Tạo HĐ loại `khoan` `[2026-06-01, 2026-12-31]`, chồng thời gian nhưng **khác loại** | **201** — hai HĐ khác loại được chạy song song | P0 |
| TC-hrm-205 | Edge | như TC-hrm-204 | Tạo HĐ loại `khoan` thứ hai `[2026-08-01, 2027-01-31]` | **409** — cùng loại thì vẫn chặn | P0 |
| TC-hrm-205a | Edge | `NV0001` có HĐ `khong_xac_dinh` `[2026-01-01, null]` | Tạo HĐ `xac_dinh` `[2026-03-01, 2026-09-30]` — **khác nhãn nhưng CÙNG nhóm hợp đồng lao động** | **409** chồng lấn. `[MỚI — QĐ #18]` **Ca then chốt**: khóa theo nhãn gốc thì ca này lọt và Payroll cộng hai mức lương; khóa theo nhóm mới chặn được. Đã xác minh trên PostgreSQL thật | P0 |
| TC-hrm-205b | Edge | `NV0001` có HĐ `khoan` `[2026-01-01, 2026-06-30]` | Tạo HĐ nhãn **`Khoan`** (viết hoa) `[2026-04-01, 2026-12-31]` | **409** — hàm gom nhóm hạ chữ thường trước khi so, nên biến thể hoa thường **không** lách được. Đã xác minh trên PostgreSQL thật | P1 |
| TC-hrm-205c | Happy | `NV0001` có HĐ `khong_xac_dinh` `[2026-01-01, null]` | Tạo HĐ `thu_viec` `[2026-02-01, 2026-04-30]` | **201** — thử việc là nhóm riêng, được chạy song song | P1 |
| TC-hrm-206 | Validation | `NV0001` có HĐ chính và HĐ khoán cùng chạy | Gọi đổi hợp đồng **không** gửi `loai_hd_can_chot` | **400 E-hrm-006** ở trường `loai_hd_can_chot` (BR-hrm-053) | P0 |
| TC-hrm-207 | Edge | như trên | Đổi hợp đồng với `loai_hd_can_chot="khoan"` | **201**. Chỉ HĐ **khoán** bị chốt; HĐ chính **giữ nguyên** ngày kết thúc. Đây là ca bắt lỗi âm thầm nguy hiểm nhất của QĐ #1 | P0 |
| TC-hrm-208 | Edge | `NV0001` có HĐ `[2026-01-01, null]`; đồng hồ giả lập **02:00 giờ Việt Nam** | Gọi đổi hợp đồng | Tìm và chốt **đúng** HĐ đang hiệu lực. Ca bắt BUG-HRM-07: mốc UTC làm khoảng 00:00–06:59 giờ Việt Nam hiểu "hôm nay" lệch một ngày | P0 |
| TC-hrm-209 | Concurrency | `NV0001` có 1 HĐ đang chạy | Bắn **2** yêu cầu đổi hợp đồng đồng thời | Đúng **1** thành công, cái còn lại **409**. Không tạo ra hai HĐ cùng hiệu lực cùng loại (BUG-HRM-08) | P0 |
| TC-hrm-210 | Concurrency | `NV0001` chưa có HĐ | Bắn **2** yêu cầu tạo HĐ đồng thời, cùng loại, khoảng ngày giao nhau | Đúng **1** thành công. Kiểm tra ở tầng ứng dụng **không** đóng được khe này, phải có ràng buộc ở cơ sở dữ liệu. Bắt lỗi theo **tên ràng buộc** `hrm_hop_dong_khong_chong_lan`, không dựa vào `error.code` | P0 |

### 6B.5 Quyền xem dữ liệu lương — QĐ #8 và QĐ #9 (BR-hrm-051, BR-hrm-059, E-hrm-058)

| ID | Loại | Vai trò gọi | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-211 | Security | `OWNER_EMPLOYEE` **không** có quyền xem lương | Lấy lịch sử hợp đồng của một nhân viên | **403 E-hrm-058** | P0 |
| TC-hrm-212 | Security | như trên | Lấy danh sách nhân viên | **200**, nhưng phản hồi **không chứa** các khóa `so_tai_khoan`, `ten_tai_khoan`, `ngan_hang`. Kiểm bằng "khóa vắng mặt", **không** chấp nhận giá trị `null` | P0 |
| TC-hrm-213 | Security | `OWNER` | Lấy danh sách nhân viên | **200** có đủ trường lương và tài khoản | P0 |
| TC-hrm-214 | Security | `OWNER_EMPLOYEE` **có** quyền xem lương | Lấy hợp đồng **không** truyền mã nhân viên | **400 E-hrm-006** — mã nhân viên là bắt buộc. Ca đóng BUG-HRM-25: không còn đường lấy hợp đồng toàn công ty trong một lượt | P0 |
| TC-hrm-215 | Security | `ADMIN` | Mọi endpoint HRM của một tenant bất kỳ | **403** — `ADMIN` không có phạm vi tenant. Đây là hành vi **đúng ý** (BR-hrm-051); ca này chốt lại để lần sau không ai nới ra | P0 |
| TC-hrm-216 | Regression | `OWNER_EMPLOYEE` có quyền xem lương | Mở màn hồ sơ nhân viên trên giao diện | Giao diện gọi lấy hợp đồng **theo từng nhân viên**, không gọi trần rồi lọc phía trình duyệt. Kiểm bằng nhật ký mạng | P0 |

### 6B.6 Quyền kết nối Google Drive — QĐ #10 (BR-hrm-045, E-hrm-059)

| ID | Loại | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-217 | Security | Công ty **chưa** kết nối Drive; gọi bằng `OWNER_EMPLOYEE` | Xin URL đồng ý OAuth | **403 E-hrm-059**. Ca đóng BUG-HRM-11 | P0 |
| TC-hrm-218 | Happy | Công ty **đã** kết nối; gọi bằng `OWNER_EMPLOYEE` | Tải file scan lên rồi xem lại file | **200/201** cả hai — siết là siết ở việc chọn Drive của ai, **không** siết việc dùng | P0 |
| TC-hrm-219 | UI | `OWNER_EMPLOYEE`, công ty chưa kết nối | Mở màn Hồ sơ giấy tờ | Giao diện hiện **thông báo nhờ chủ tài khoản liên kết Drive**, **không** hiện nút Kết nối rồi mới báo 403 | P1 |

### 6B.7 Phòng ban ngừng hoạt động — QĐ #11 (BR-hrm-060, BR-hrm-061)

| ID | Loại | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-220 | Happy | `PB01` còn 3 người đang làm và 2 người đã nghỉ | Chuyển `PB01` sang ngừng hoạt động | **200** — máy chủ **không** chặn. Nhân viên giữ nguyên phòng ban | P0 |
| TC-hrm-221 | Contract | như trên | Lấy danh sách phòng ban | Trả **cả** số người đang làm và số người đã nghỉ, để giao diện cảnh báo đúng con số | P1 |
| TC-hrm-222 | UI | như trên | Bấm chuyển `PB01` sang ngừng hoạt động | Hộp xác nhận nêu **đích danh** số người đang làm và số người đã nghỉ trước khi gửi yêu cầu | P1 |
| TC-hrm-223 | Edge | `NV0001` đang thuộc `PB01` đã ngừng hoạt động | Mở form sửa `NV0001`, đổi **mỗi họ tên**, bấm Lưu | Ô chọn phòng ban hiện `PB01` kèm nhãn ngừng hoạt động; sau khi lưu, phòng ban của nhân viên **vẫn là `PB01`**. **Ca then chốt của BR-hrm-061**: thiếu vế "cộng thêm phòng đang gán" thì thao tác này âm thầm xóa mất phòng ban của nhân viên | P0 |

### 6B.8 Xóa dòng giấy tờ kèm file Drive — QĐ #12 (BR-hrm-039)

| ID | Loại | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-224 | Happy | Tài liệu `T1` đã đính file trên Drive | Xóa dòng giấy tờ `T1` | **200** kèm cờ báo đã xóa được file Drive. Dòng biến mất **và** file trên Drive bị xóa. Ca đóng BUG-HRM-10 | P0 |
| TC-hrm-225 | Edge | `T1` có file; giả lập Drive trả lỗi 500 | Xóa dòng giấy tờ `T1` | **200** — dòng **vẫn bị xóa**, cờ báo không xóa được file, lỗi Drive ghi vào nhật ký. **Lỗi Drive không được chặn thao tác nghiệp vụ** | P0 |
| TC-hrm-226 | UI | `T1` có file tên `cccd-mat-truoc.jpg` | Bấm xóa dòng | Hộp xác nhận nêu **đích danh tên file** sắp mất, vì thao tác không hoàn tác được | P1 |

### 6B.9 Bộ giấy tờ bắt buộc và hạn giấy tờ — QĐ #14 (BR-hrm-062…065)

| ID | Loại | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-227 | Happy | Danh mục bộ giấy tờ bắt buộc **rỗng** | Lấy danh sách nhân viên | Mọi nhân viên có chỉ báo hồ sơ **rỗng** và danh sách thiếu rỗng. **Danh mục rỗng là hợp lệ**, không ai bị coi là thiếu hồ sơ | P0 |
| TC-hrm-228 | Happy | Danh mục khai loại `khong_xac_dinh` cần `cccd` và `so_yeu_ly_lich`; `NV0001` có HĐ loại đó và chỉ có dòng `cccd` | Lấy danh sách nhân viên | Hồ sơ **thiếu**, danh sách thiếu đúng bằng `["so_yeu_ly_lich"]` | P0 |
| TC-hrm-229 | Edge | `NV0002` **chưa có hợp đồng nào**; danh mục đã khai | Lấy danh sách nhân viên | Chỉ báo hồ sơ là **rỗng**, **không** phải "thiếu". Danh sách thiếu rỗng | P0 |
| TC-hrm-230 | Edge | `NV0001` có HĐ chính **và** HĐ khoán; mỗi loại khai bộ giấy tờ khác nhau | Lấy danh sách nhân viên | Danh sách thiếu tính theo **HỢP** của hai bộ, không phải giao (BR-hrm-064 bước 2) | P0 |
| TC-hrm-231 | Edge | Danh mục có dòng đánh dấu không bắt buộc | Lấy danh sách nhân viên | Dòng không bắt buộc **không** tính vào danh sách thiếu | P1 |
| TC-hrm-232 | Edge | `NV0001` đủ dòng giấy tờ nhưng CCCD **đã hết hạn** | Lấy danh sách nhân viên | Hồ sơ báo **đủ** **và** số giấy tờ hết hạn bằng 1. Hai chỉ báo **độc lập**, không gộp (BR-hrm-064) | P0 |
| TC-hrm-233 | Validation | — | Tạo dòng giấy tờ với ngày hết hạn sớm hơn ngày cấp | **400 E-hrm-060** | P0 |
| TC-hrm-234 | Happy | — | Tạo dòng giấy tờ với ngày hết hạn **bằng** ngày cấp | **201** — bằng nhau là hợp lệ (BR-hrm-062) | P1 |
| TC-hrm-235 | Validation | Danh mục đã có cặp (`khoan`, `cccd`) | Thêm đúng cặp đó lần nữa | **409 E-hrm-061** | P0 |
| TC-hrm-236 | Edge | Có giấy tờ hết hạn của **nhân viên đã nghỉ việc** | Lấy danh sách cảnh báo hạn | Giấy tờ đó **có** trong danh sách — giấy tờ người đã nghỉ vẫn dùng khi quyết toán (BR-hrm-065). Chỉ nhân viên đã xóa mềm mới bị loại | P1 |
| TC-hrm-237 | Edge | Ngưỡng cảnh báo **chưa khai** (OQ-hrm-14 chưa chốt) | Lấy danh sách cảnh báo hạn | **Chỉ** trả giấy tờ đã hết hạn. **Không** được có dòng "sắp hết hạn" nào — cấm tự đặt ngưỡng mặc định | P0 |
| TC-hrm-238 | Performance | 500 nhân viên, mỗi người 5 dòng giấy tờ, danh mục 8 dòng | Lấy danh sách nhân viên | Đếm số câu truy vấn: chỉ báo đủ/thiếu lấy trong **một lượt**, **không** sinh N+1 (FR-hrm-040). Đây là chỗ dễ hỏng nhất của tính năng | P0 |

### 6B.11 Người phụ thuộc duy nhất mã số thuế toàn công ty — QĐ #7 (BR-hrm-030, E-hrm-026, AC-hrm-51)

> **Nhóm này bị bỏ sót ở bản đầu** — phát hiện ở vòng phản biện độc lập 2026-09-07. QĐ #7 là quyết định 🔴 Critical duy nhất chạm **sai thuế TNCN** mà trước đó không có ca kiểm thử mới nào.

| ID | Loại | AC / BR | Tiền điều kiện | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:---|:--:|
| TC-hrm-246 | Edge | AC-hrm-51, BR-hrm-030 | `NV0001` có người phụ thuộc mã số thuế `8012345678`, kỳ **01/2026–12/2026** | Thêm cùng mã số thuế cho **`NV0002`**, kỳ **06/2026–12/2026** (**giao nhau**) | **409 E-hrm-026**, thông điệp nêu đích danh mã và họ tên nhân viên đang giữ. Ca đóng BUG-HRM-05. Đã xác minh hành vi trên PostgreSQL thật | P0 |
| TC-hrm-246a | Happy | BR-hrm-030 `[QĐ #19]` | `NV0001` có người phụ thuộc mã số thuế `8012345678`, kỳ **01/2026–06/2026** | Thêm cùng mã số thuế cho **`NV0002`**, kỳ **07/2026** trở đi (**nối tiếp, không giao**) | **201** — đây chính là ca chuyển người kê khai giữa năm mà QĐ #19 mở ra. Cả hai dòng cùng tồn tại, giữ được lịch sử kê khai. Đã xác minh trên PostgreSQL thật | P0 |
| TC-hrm-246b | Edge | BR-hrm-030 `[QĐ #19]` | `NV0001` có người phụ thuộc kỳ **01/2026–06/2026** | Thêm cho `NV0002` kỳ bắt đầu **đúng tháng 06/2026** | **409** — kỳ tính theo tháng và **đóng hai đầu**: trong tháng 6 cả hai người nộp thuế đều được giảm trừ | P0 |
| TC-hrm-246c | Happy | BR-hrm-030 | Hai người phụ thuộc **chưa có mã số thuế**, kỳ giao nhau | Thêm cả hai | **201** cả hai — chỉ chặn khi đã biết mã số thuế. Đã xác minh trên PostgreSQL thật | P1 |
| TC-hrm-247 | Edge | BR-hrm-030 | như trên | Thêm cùng mã số thuế cho **chính `NV0001`** | **409** — ràng buộc cũ theo từng nhân viên vẫn phải giữ nguyên hiệu lực | P0 |
| TC-hrm-248 | Happy | BR-hrm-030 | `NV0001` có người phụ thuộc mã số thuế `8012345678` | **Sửa** chính dòng đó (đổi họ tên, giữ nguyên mã số thuế) | **200** — phép kiểm trùng phải loại trừ chính dòng đang sửa, nếu không mọi lần sửa đều 409 | P0 |
| TC-hrm-249 | Edge | OQ-hrm-26 | `NV0001` **đã xóa mềm**, người phụ thuộc mã số thuế `8012345678` vẫn nằm trong cơ sở dữ liệu | Thêm cùng mã số thuế cho `NV0002` đang hoạt động | **Ghi nhận hành vi thật và đối chiếu hai tầng.** Ràng buộc ở cơ sở dữ liệu phủ mọi dòng nên sẽ chặn; phép kiểm ở ứng dụng nếu lọc `da_xoa` sẽ **cho qua** rồi vỡ ở tầng dưới với thông báo chung chung. Hai tầng phải nói giống nhau — chờ chốt OQ-hrm-26 | P0 |
| TC-hrm-250 | Edge | BR-hrm-030 `[QĐ #19]` | `NV0001` **đã nghỉ việc**, kỳ giảm trừ của người phụ thuộc đã đóng tháng 06/2026 | Đăng ký cùng mã số thuế cho `NV0002` từ 07/2026 | **201** — ✅ **OQ-hrm-27 đã chốt**: duy nhất có xét kỳ, nên ca chuyển người kê khai không còn bị chặn oan. Nếu kỳ của `NV0001` **để trống ngày kết thúc** thì vẫn **409** và người dùng phải đóng kỳ cũ trước — hành vi này phải hiện thành thông báo rõ | P0 |
| TC-hrm-251 | Migration | BR-hrm-030 | Một tenant đã lỡ có hai dòng cùng mã số thuế ở hai nhân viên | Chạy câu quét dữ liệu trùng của `data-model.md` M-09 | Liệt kê **đủ** cặp vi phạm kèm mã nhân viên, và **phân biệt** dòng thuộc nhân viên đã xóa mềm. Chạy trước migration, nếu bỏ sót thì migration hỏng giữa chừng | P0 |

### 6B.12 Lỗi kỹ thuật dùng chung — E-hrm-062/063/064

> Ba mã lỗi này áp cho **mọi** endpoint HRM (đặc tả Mục 8.9) nhưng bản đầu **không có ca nào** — cũng phát hiện ở vòng phản biện.

| ID | Loại | AC / BR | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-252 | Concurrency | E-hrm-062 | A mở form sửa một phòng ban; B xóa phòng ban đó; A bấm Lưu | **404 E-hrm-062** "Bản ghi không còn tồn tại, vui lòng tải lại danh sách" — không phải 500. Đây là kịch bản đặc tả nêu đích danh | P1 |
| TC-hrm-253 | Edge | E-hrm-063 | Gây vi phạm khóa ngoại (ví dụ ghi hợp đồng trỏ tới nhân viên vừa bị xóa cứng ở luồng song song) | **409 E-hrm-063**, không phải 500 | P2 |
| TC-hrm-254 | Edge | E-hrm-064 | Ngắt kết nối cơ sở dữ liệu tenant giữa chừng rồi gọi một endpoint HRM bất kỳ | **500 E-hrm-064** với thông điệp chung; nội dung lỗi thô **chỉ vào nhật ký**, không lộ ra người dùng | P2 |

### 6B.13 Quy tắc mới từ vòng phản biện — BR-hrm-067, BR-hrm-068

| ID | Loại | AC / BR | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:---|:--:|
| TC-hrm-255 | Validation | BR-hrm-067 | `NV0001` đang ở trạng thái **đã nghỉ**; gửi yêu cầu sửa họ tên **không kèm `status`** | **400 E-hrm-006** ở trường `status`. **Ca then chốt**: hiện trường này có mặc định `'1'` nên yêu cầu thiếu sẽ âm thầm đưa người đã nghỉ về đang làm, trong khi ngày nghỉ và các hợp đồng đã chốt vẫn nằm nguyên | P0 |
| TC-hrm-256 | Security | BR-hrm-068 | Người dùng đang có quyền xem lương, đã đăng nhập. Chủ tài khoản **thu hồi** quyền. Người đó gọi lại lịch sử hợp đồng bằng **vé đăng nhập cũ còn hạn** | **403 E-hrm-058 ngay lập tức**, không đợi vé hết hạn. Ca này chốt việc quyền phải tra lại từ cơ sở dữ liệu mỗi lượt gọi, **không** được nhét vào vé | P0 |
| TC-hrm-257 | Happy | FR-hrm-044 | Chủ tài khoản cấp quyền xem lương cho một người ở công ty A, **không** cấp ở công ty B | Người đó đọc được hợp đồng ở A, nhận **403** ở B. Quyền đúng phạm vi cặp người dùng và công ty | P0 |
| TC-hrm-259 | Migration | BR-hrm-069 `[QĐ #17]` | Cơ sở dữ liệu có sẵn N bản ghi phân quyền công ty | Chạy migration thêm cột quyền xem lương | **Cả N bản ghi** đều có quyền xem lương = có. Không người dùng nào đang làm việc mất màn hợp đồng. **Ca bảo vệ ngày triển khai** | P0 |
| TC-hrm-260 | Happy | BR-hrm-069 `[QĐ #17]` | Sau migration | Chủ tài khoản cấp quyền vào một công ty cho một người dùng **mới** | Người đó vào được công ty nhưng **không** xem được lương — mặc định của bản ghi mới là không được xem | P0 |
| TC-hrm-258 | Regression | FR-hrm-044 | Người dùng đã được cấp quyền xem lương ở công ty A. Chủ tài khoản **sửa danh sách công ty** của người đó (thêm công ty C) | Quyền xem lương ở A **vẫn còn**. **Ca then chốt**: cách ghi hiện tại xóa sạch rồi cấp lại, nên nếu không đổi sang ghi theo cặp khóa thì thao tác này âm thầm thu hồi mọi quyền lương đã cấp | P0 |

### 6B.10 Nhật ký, hợp đồng tương lai, lưu trữ và hiệu năng — QĐ #15, #2, #13, #16

| ID | Loại | Hành động | Kết quả mong đợi | Ưu tiên |
|:---|:---|:---|:---|:--:|
| TC-hrm-239 | Audit | Lần lượt: xóa hợp đồng, sửa lương chính, xóa người phụ thuộc, xóa dòng tài liệu, ngắt kết nối Drive | Đúng **5** bản ghi nhật ký, mỗi bản có thời điểm, người thao tác, công ty, loại thao tác và khóa nghiệp vụ đủ để lần lại (BR-hrm-066) | P0 |
| TC-hrm-240 | Audit | Sửa **mỗi ô ghi chú** của hợp đồng, không đụng lương | **Không** ghi nhật ký — chỉ 5 nhóm ở BR-hrm-066 mới ghi, không ghi tràn | P1 |
| TC-hrm-241 | Audit | Giả lập ghi nhật ký thất bại, rồi xóa một hợp đồng | Thao tác xóa **vẫn thành công** — ghi nhật ký hỏng không được làm hỏng nghiệp vụ (FR-hrm-043) | P1 |
| TC-hrm-242 | Edge | `NV0001` chỉ có HĐ `[2027-01-01, null]` ký trước, chưa hiệu lực | Lấy danh sách nhân viên: 6 trường hợp đồng trả về **chính hợp đồng tương lai đó** — hành vi **đúng ý** theo QĐ #2. Ca này chốt lại để không ai "sửa cho đúng" về sau | P0 |
| TC-hrm-243 | Edge | `NV0001` có cả HĐ đang hiệu lực **và** HĐ tương lai | Lấy danh sách nhân viên trả HĐ **đang hiệu lực**, không phải HĐ tương lai. **Ghi nhận hành vi thật** khi hai HĐ khác loại cùng chạy — OQ-hrm-11 chưa chốt nên ca này để lộ kết quả hiện tại chứ chưa khẳng định đúng sai | P1 |
| TC-hrm-244 | Edge | `NV0001` có 3 dòng giấy tờ đã đính file trên Drive; xóa mềm `NV0001` | **200**. Ba file trên Drive **còn nguyên** — đúng ý theo QĐ #13, không phải thiếu sót | P1 |
| TC-hrm-245 | Performance | Tenant lớn nhất đang có dữ liệu thật; đo danh sách nhân viên và lịch sử hợp đồng sau khi thêm chỉ mục theo `data-model.md` M-05 | **Ghi lại số đo, KHÔNG so với ngưỡng.** QĐ #16 chốt là chưa đặt số, nên nhiệm vụ đợt này là **đo và báo cáo** để BA chốt NFR-hrm-004, không phải pass hay fail | P1 |

---

## 7. Ghi chú thực thi cho Phase B

1. **Không sửa mã sản phẩm để test PASS.** Nhóm ca `TC-hrm-067…078`, `085`, `086`, `105`, `127`, `153` được thiết kế theo **SPEC**, và theo phân tích mã nguồn thì hiện tại chúng sẽ FAIL. FAIL ở đây là **phát hiện lỗi sản phẩm**, phải ghi vào `issues-and-bugs.md`, không phải "sửa kỳ vọng cho khớp code".
2. **Phân biệt rõ 4 loại kết quả** khi ghi `test-report.md`: *Test failed* (lỗi ở test) · *Product bug* (lỗi sản phẩm) · *Test environment issue* (stub/DB/env) · *Test data issue* (fixture).
3. **Ca cần giả lập đồng hồ**: TC-hrm-086, 089–094 — dùng fake timer, không phụ thuộc ngày chạy CI.
4. **Ca cần 2 tenant thật**: TC-hrm-179…182 — bắt buộc, đây là bất biến quan trọng nhất của sản phẩm đa doanh nghiệp.
5. **Ca chỉ chạy thủ công** (ghi rõ trong báo cáo): tạo >99 phòng ban con cùng cấp; tạo >9999 nhân viên.
