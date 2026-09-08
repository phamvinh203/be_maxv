# BỘ NHỚ NGỮ CẢNH: PHÂN HỆ HRM (NHÂN SỰ)
*(Module: `hrm` — Workspace: `maxv_v2`)*

---

## 1. Tổng quan phân hệ
* **Tên phân hệ:** Quản lý Nhân sự (HRM).
* **Mục tiêu:** Quản lý nền tảng dữ liệu tổ chức gồm Phòng ban, Hồ sơ Nhân viên, Lịch sử Hợp đồng lao động, Người phụ thuộc (giảm trừ gia cảnh thuế TNCN) và Hồ sơ/Tài liệu scan đính kèm tích hợp Google Drive.
* **Kiến trúc hệ thống:** 
  * Backend: Node.js (Fastify) + Prisma ORM.
  * Cơ sở dữ liệu: Multi-tenant (DB `maxv2_sys` cho control plane + DB riêng `db_<MST>` cho từng công ty).
  * Frontend: React / TypeScript (`fe_maxv` và `hdđt_maxv`).
* **Trạng thái phân hệ:** `Ready for Implementation` cho **toàn bộ đợt P0 và P1** (Mục 9.3b). Chốt 20/20 quyết định nghiệp vụ. **Chỉ còn đợt P2** (bộ giấy tờ bắt buộc) đóng, chờ OQ-hrm-13 và OQ-hrm-14.
  * Đợt 1 đã triển khai xong (CRUD 5 thực thể + tích hợp Drive + đồng bộ frontend).
  * Vòng rà soát 3 Amigos (BA ∥ Architect ∥ QA) hoàn tất ngày 2026-09-07 — xem Mục 5.
  * Chốt đủ **16/16** quyết định nghiệp vụ ngày 2026-09-07 (Mục 6.1 — 4 quyết định đợt 1, 12 quyết định đợt 2).
  * **Vòng cập nhật tài liệu 7.0 hoàn tất ngày 2026-09-07** — `srs/` · `architecture/` · `qa/` đã nạp đủ 16 quyết định và đã đối soát chéo Spec ↔ Contract ↔ Test. Xem Mục 8.
  * **Vòng phản biện độc lập Architect ∥ Tester-QA hoàn tất 2026-09-07** — xem Mục 9. Vòng này tìm ra 7 bug mới và 18 nhánh nghiệp vụ mà cả đặc tả lẫn bộ ca kiểm thử đều bỏ sót.
  * **Cổng BA Final Sign-off MỞ cho P0 và P1** sau khi chốt nốt 4 quyết định đợt 3 (QĐ #17…#20). Xem Mục 9.3b. **Đợt P2 vẫn đóng.**
  * **Sáu việc chặn** phải xong trước khi mở lại phần còn lại — xem `qa/issues-and-bugs.md` Mục 5, Sprint 0b.

---

## 2. Bounded Context & Các thực thể (Entities)

| Thực thể | Bảng cơ sở dữ liệu | Vị trí DB | Mô tả nghiệp vụ |
|:---|:---|:---|:---|
| **Đơn vị / Công ty** | `don_vi` | `maxv2_sys` | Quản lý thông tin doanh nghiệp tenant, lưu token kết nối Google Drive cấp công ty (`driveRefreshTokenCipher`, `driveEmail`). |
| **Phòng ban** | `hrm_phong_ban` | `db_<MST>` | Danh mục phòng ban theo cây phân cấp (`ma_pb_me`), sinh mã tự động `PBxx.yy`, xóa mềm (`da_xoa`). |
| **Nhân viên** | `hrm_nhan_vien` | `db_<MST>` | Hồ sơ nhân viên, ngày vào làm, thông tin ngân hàng, chế độ công đoàn/chấm công, xóa mềm (`da_xoa`). Không lưu bản sao tĩnh của hợp đồng. |
| **Hợp đồng** | `hrm_hop_dong` | `db_<MST>` | Lịch sử hợp đồng lao động (1 nhân viên - N hợp đồng), lương chính, lương BHXH, ngày bắt đầu/kết thúc. Nguồn sự thật cho Hợp đồng hiện hành. |
| **Người phụ thuộc** | `hrm_nguoi_phu_thuoc` | `db_<MST>` | Danh sách người phụ thuộc đăng ký giảm trừ gia cảnh TNCN, chặn trùng MST cho cùng 1 nhân viên (`@@unique([ma_nv, mst])`). |
| **Tài liệu & Hồ sơ** | `hrm_tai_lieu` | `db_<MST>` | Thông tin giấy tờ (CCCD, bằng cấp, chứng chỉ...) và con trỏ file scan trên Google Drive (`drive_file_id`, `ten_file`, `mime_type`, `kich_thuoc`). |

---

## 3. Bản đồ Endpoints API (`/hrm`)

Tất cả các route kế thừa kiểm tra đăng nhập (`authenticate`) và kiểm tra quyền gói module (`requireModule('hrm')`) tại `src/routes/hrm/hrm.route.ts`:

* **Phòng ban (`/phong-ban`):**
  * `GET /phong-ban`: Lấy danh sách cây phòng ban, đếm số nhân viên đang làm việc (`so_nv`).
  * `POST /phong-ban`: Tạo phòng ban mới (tự sinh mã theo cấp cha nếu để trống).
  * `PUT /phong-ban/:ma_pb`: Cập nhật tên/ghi chú/phòng ban mẹ (chống vòng lặp cây).
  * `DELETE /phong-ban/:ma_pb`: Xóa mềm (chặn nếu còn nhân viên chưa xóa).
* **Nhân viên (`/nhan-vien`):**
  * `GET /nhan-vien`: Danh sách nhân viên kèm tên phòng ban, số NPT và thông tin hợp đồng hiện hành.
  * `GET /nhan-vien/:ma_nv`: Chi tiết hồ sơ nhân viên.
  * `POST /nhan-vien`: Tạo nhân viên mới (tự sinh mã `NVxxxx` nếu để trống).
  * `PUT /nhan-vien/:ma_nv`: Cập nhật hồ sơ nhân viên.
  * `DELETE /nhan-vien/:ma_nv`: Xóa mềm nhân viên (ẩn kèm theo NPT, HĐ, Tài liệu trong danh sách).
* **Hợp đồng (`/hop-dong`):**
  * `GET /hop-dong?ma_nv=...`: Xem lịch sử hợp đồng của nhân viên (mới nhất lên đầu).
  * `POST /hop-dong`: Tạo hợp đồng mới.
  * `POST /hop-dong/doi`: Nghiệp vụ đổi hợp đồng: chốt ngày kết thúc hợp đồng cũ và ký hợp đồng mới trong cùng 1 transaction.
  * `PUT /hop-dong/:id`: Sửa thông tin hợp đồng.
  * `DELETE /hop-dong/:id`: Xóa hợp đồng.
* **Người phụ thuộc (`/nguoi-phu-thuoc`):**
  * `GET /nguoi-phu-thuoc?ma_nv=...`: Danh sách người phụ thuộc kèm tên nhân viên.
  * `POST /nguoi-phu-thuoc`: Tạo người phụ thuộc (chặn trùng MST).
  * `PUT /nguoi-phu-thuoc/:id`: Cập nhật thông tin.
  * `DELETE /nguoi-phu-thuoc/:id`: Xóa người phụ thuộc.
* **Tài liệu & Google Drive (`/tai-lieu`):**
  * `GET /tai-lieu?ma_nv=...`: Danh sách hồ sơ giấy tờ.
  * `POST /tai-lieu`: Tạo bản ghi hồ sơ giấy tờ (chưa kèm file).
  * `PUT /tai-lieu/:id`: Cập nhật metadata giấy tờ.
  * `DELETE /tai-lieu/:id`: Xóa bản ghi giấy tờ. **GHI CHÚ SỬA SAI (2026-09-07):** mô tả cũ nói "và xóa file trên Drive (best-effort)" là SAI — `taiLieu.service.ts:124-135` chỉ gọi `db.hrm_tai_lieu.delete()`, file scan ở lại Drive vĩnh viễn (BUG-HRM-10).
  * `GET /tai-lieu/drive/trang-thai`: Kiểm tra công ty đã liên kết Drive chưa.
  * `GET /tai-lieu/drive/lien-ket`: Lấy URL đồng ý cấp quyền OAuth2 từ Google.
  * `GET /tai-lieu/drive/callback`: Callback OAuth từ Google (xác thực qua state ký HMAC).
  * `DELETE /tai-lieu/drive/ket-noi`: Ngắt liên kết Google Drive của công ty.
  * `POST /tai-lieu/:id/file`: Tải file scan (ảnh/PDF <= 10MB) lên Google Drive của công ty.
  * `GET /tai-lieu/:id/file`: Xem/tải file scan trực tiếp qua streaming backend.
  * `DELETE /tai-lieu/:id/file`: Gỡ file scan trên Drive, giữ lại bản ghi giấy tờ.

---

## 4. Danh mục tài liệu tham chiếu & đối soát
1. `srs/hrm-spec.md`: Quy tắc nghiệp vụ chi tiết (Business Rules & Acceptance Criteria).
2. `srs/hrm-flows.md`: Sơ đồ quy trình nghiệp vụ (Flows & Sequences).
3. `srs/hrm-erd.md`: Sơ đồ quan hệ thực thể (ERD).
4. `architecture/api-contract.md`: Đặc tả chi tiết các request/response schema.
5. `architecture/data-model.md`: Cấu trúc bảng và chỉ mục cơ sở dữ liệu.
6. `architecture/dev-notes.md`: Hướng dẫn kỹ thuật và luồng xử lý mã nguồn.
7. `architecture/adr/`: Các quyết định kiến trúc cốt lõi (ADR-001, ADR-002, ADR-003).
8. `qa/test-matrix.md` & `qa/test-cases.md`: Kịch bản và ca kiểm thử.
9. `qa/issues-and-bugs.md`: Danh mục phát hiện từ đợt đối soát 3 Amigos và các đầu việc cần cải tiến.

---

## 5. Kết quả vòng rà soát 3 Amigos (2026-09-07)

Ba agent chạy độc lập, không đọc kết quả của nhau, cùng đối chiếu: tài liệu tham khảo `docs/nestjs/hr/` (chỉ là **mẫu** trên nền NestJS, không phải nghiệp vụ MAXV) — tài liệu `docs/hrm/` cũ — và **mã nguồn thật**.

| Vai | Sản phẩm | Quy mô |
|:---|:---|:---|
| Business Analyst | `srs/hrm-spec.md` (80 → 953 dòng), `hrm-flows.md`, `hrm-states.md` (mới), `hrm-erd.md`, 2 swimlane PlantUML | 51 BR · 35 FR · 11 NFR · 51 mã lỗi · 15 UC · 35 AC |
| Architect | `architecture/api-contract.md`, `data-model.md`, `dev-notes.md`, ADR-001…006 (004/005/006 mới) | Đối soát 21 endpoint: 11 khớp · 9 lệch tài liệu · 1 tài liệu ghi mà code không có |
| Tester-QA | `qa/test-matrix.md`, `test-cases.md`, `issues-and-bugs.md` | 185 ca (P0 95 · P1 74 · P2 16) · 24 issue (1 Critical · 6 High) |

**Bằng chứng chạy thật:** `npm run typecheck` exit 0 · `npm run lint` exit 0 (0 warning trong file HRM) · `be_maxv/src/__tests__/` **không có file test HRM nào**. Mọi phân tích nghiệp vụ là đọc mã tĩnh, chưa chạy runtime.

### 5.1. Lỗi đã được xác minh chéo (≥2 nguồn độc lập cùng chỉ ra)

| Mã | Mức | Mô tả | Vị trí |
|:---|:---:|:---|:---|
| BUG-HRM-05 | 🔴 Critical | Cùng một MST người phụ thuộc đăng ký được cho **hai nhân viên khác nhau** → giảm trừ gia cảnh tính hai lần → **sai thuế TNCN**, không có gì báo | `schema.prisma:949` (`@@unique([ma_nv, mst])`), `nguoiPhuThuoc.service.ts:100-109` |
| BUG-HRM-25 | 🔴 Critical | Giao diện gọi `listHopDong()` **không tham số** rồi lọc phía trình duyệt ⇒ **bảng lương toàn công ty tải về máy mọi người dùng có quyền vào MST**. Máy chủ cũng để `ma_nv` là tùy chọn | FE `hopDongQueries.ts:67-91`; BE `hopDong.validator.ts:115-123`, `hopDong.service.ts` |
| ISSUE-HRM-01 | 🟠 High | Không kiểm chồng lấn thời gian hợp đồng ở cả `create` lẫn `update` → hai hợp đồng cùng hiệu lực, lương không xác định | `hopDong.service.ts:185-193`, `:196-218` |
| BUG-HRM-07 | 🟠 High | `doiHopDong` dùng mốc UTC (`setUTCHours`) trong khi cùng file có sẵn `homNayVN()` → từ 00:00–06:59 giờ VN chốt nhầm hợp đồng | `hopDong.service.ts:233-234` vs `:61-66` |
| BUG-HRM-10 | 🟠 High | `DELETE /tai-lieu/:id` không gọi Drive → ảnh CCCD/bằng cấp mồ côi vĩnh viễn | `taiLieu.service.ts:124-135` |
| BUG-HRM-11 | 🟠 High | Người dùng không phải OWNER nối được kho tài liệu **cả công ty** vào Drive cá nhân của họ | `taiLieu.controller.ts:144-151` |
| ISSUE-HRM-02 | 🟡 Medium | Sinh mã `NVxxxx` / `PBxx.yy` nằm **ngoài** transaction, không retry `P2002` → hai người tạo cùng lúc thì một người nhận 409 "Dữ liệu bị trùng" | `nhanVien.service.ts:170-194`, `phongBan.service.ts:170-189` |
| ĐS-04 | 🟡 Medium | Lệch tên trường: máy chủ trả `so_npt_an_theo`, giao diện khai `so_npt_da_xoa` ⇒ đang đọc `undefined` | BE `nhanVien.service.ts:242` vs FE `nhanVienApi.ts:112` |

### 5.2. Tài liệu cũ mô tả sai hiện trạng

* ADR-001 và ADR-002 mô tả retry sinh mã và chống chồng lấn **như đã triển khai** — mã nguồn không có. Đã dán nhãn "Bản sửa" trong vòng này.
* Mục 3 của chính file này ghi `DELETE /tai-lieu/:id` xóa file Drive — sai, đã sửa.
* Docblock `hrm_hop_dong` trong `schema.prisma:956-959` còn nhắc "7 cột hợp đồng trên `hrm_nhan_vien`" và hàm `dongBoHopDongHienHanh()`; cả hai đã bị xóa từ 2026-09-05. **Chưa sửa** — nằm trong mã nguồn, ngoài phạm vi vòng rà soát này.
* `issues-and-bugs.md` cũ ghi ISSUE-HRM-04 thuộc `fe_maxv` — sai, module HRM nằm ở `hdđt_maxv/src/features/hrm/`.

### 5.3. Kết luận tích cực (đã kiểm, không phải giả định)

* **Cô lập multi-tenant: đạt.** Architect kiểm 21/21 endpoint, không tìm thấy đường rò dữ liệu chéo giữa các công ty. Lỗi BUG-HRM-25 là lộ dữ liệu **trong nội bộ một công ty**, không phải rò chéo tenant.
* **"Hợp đồng hiện hành tính lúc đọc" là quyết định đúng, giữ nguyên.** Đo thật: 4 truy vấn cố định, **không có N+1**. Cách chữa là thêm index, không phải quay lại lưu bản sao.
* **Thuật toán sinh mã "lấp lỗ trống" giữ nguyên**, chỉ bọc transaction + retry. Không dùng `SEQUENCE` vì không mô tả được mã cây `PB01.01` và phải migrate mọi tenant.

---

## 6. Quyết định nghiệp vụ (đã chốt đủ 16/16)

| # | Nhóm | Quyết định | Chặn việc gì |
|:--:|:---|:---|:---|
| 1 | Hợp đồng | Một nhân viên có được **đồng thời** hai hợp đồng còn hiệu lực (HĐ chính + HĐ khoán) không? | Cách viết luật chống chồng lấn (chặn cứng hay chừa cửa) |
| 2 | Hợp đồng | Hợp đồng **ký trước cho tương lai** có tính là "hiện hành" trên danh sách không? | 1 dòng ở service + kỳ vọng test |
| 3 | Hợp đồng | Đặt nhân viên sang "đã nghỉ" có bắt buộc chốt ngày kết thúc hợp đồng không? | Payroll sẽ tính lương người đã nghỉ |
| 4 | Hợp đồng | `so_hd` có phải duy nhất trong một công ty không? | Cần `@@unique` + dọn dữ liệu trùng |
| 5 | Hợp đồng | Lương chính có bắt buộc lớn hơn 0? Lương BHXH có bắt buộc khi bật cờ trích BHXH? | Payroll dùng hai số này |
| 6 | Hợp đồng | Có cho phép hợp đồng một ngày (bắt đầu trùng kết thúc) không? Hiện bị chặn | Điều chỉnh luật ngày |
| 7 | **Thuế** | **Một người phụ thuộc (cùng MST) có được đăng ký cho hai nhân viên khác nhau không?** Luật TNCN: mỗi NPT chỉ được tính giảm trừ cho **một** người nộp thuế | 🔴 Sửa BUG-HRM-05 |
| 8 | **Phân quyền** | **Ai được xem lương?** Mọi người vào được MST, hay tách vai trò HR/kế toán lương riêng? Có cần vai trò chỉ-đọc? | 🔴 Sửa BUG-HRM-25 |
| 9 | Phân quyền | Vai trò `ADMIN` bị chặn hoàn toàn khỏi dữ liệu tenant (`access.ts:17-24`) là **chủ ý** hay thiếu sót? | Thiết kế phân quyền toàn hệ thống |
| 10 | Phân quyền | Người không phải OWNER có được **nối lần đầu** Drive công ty không? Siết thì kế toán không đính được file tới khi gọi được chủ tài khoản | Sửa BUG-HRM-11 |
| 11 | Phòng ban | Chuyển phòng ban sang "ngừng hoạt động" khi còn nhân viên: cho, cảnh báo, hay chặn? Phòng ban ngừng hoạt động có còn hiện trong ô chọn không? | Guard ở máy chủ + lọc ở giao diện |
| 12 | Tài liệu | Xóa một dòng giấy tờ **đang có file scan**: xóa luôn file Drive, bắt gỡ file trước, hay để lại? | Sửa BUG-HRM-10 |
| 13 | Tài liệu | Xóa mềm nhân viên có cần xóa hoặc lưu trữ file scan không (nghĩa vụ bảo vệ dữ liệu cá nhân)? Thời hạn lưu trữ hồ sơ sau khi nghỉ việc? | Chính sách xóa cứng và sao lưu |
| 14 | Tài liệu | Có cần khái niệm "hồ sơ đủ hay thiếu" theo loại giấy tờ và theo dõi **ngày hết hạn** (hộ chiếu, chứng chỉ) không? | Phải thêm cột ngày hết hạn |
| 15 | Vận hành | Dữ liệu lương và giấy tờ tùy thân có cần nhật ký "ai sửa gì lúc nào"? Ghi cả giá trị trước và sau hay chỉ người thao tác? | Ảnh hưởng cấu trúc dữ liệu, cần chốt sớm |
| 16 | Vận hành | Ngưỡng hiệu năng mục tiêu cho danh sách nhân viên và danh sách hợp đồng (bao nhiêu bản ghi, bao nhiêu mili-giây)? | Định lượng NFR-hrm-004 |

### 6.1. Nhật ký chốt quyết định (đủ 16/16 — ngày 2026-09-07)

**Đợt 1 — 4 quyết định đầu:**

| # | Quyết định | Chốt | Hệ quả kỹ thuật |
|:--:|:---|:---|:---|
| 7 | NPT trùng MST giữa hai nhân viên | **Cấm — duy nhất toàn công ty** | Đổi `@@unique([ma_nv, mst])` thành unique theo `mst` trên toàn tenant. **Bắt buộc rà dữ liệu trùng đang có TRƯỚC khi chạy migration** — nếu tenant nào đã lỡ nhập trùng thì migration sẽ fail, phải dọn tay và báo khách. Pre-check ở service vẫn giữ để trả lỗi nghiệp vụ rõ ràng thay vì lỗi ràng buộc DB thô. |
| 8 | Ai được xem lương | **Tách vai trò HR/kế toán lương** | Thêm guard theo vai trò cho `GET /hop-dong` và trường lương trong `GET /nhan-vien`. Sửa **máy chủ và giao diện cùng lúc**: giao diện đang gọi `listHopDong()` không tham số rồi lọc client, siết máy chủ trước là màn hợp đồng trắng ngay. Kéo theo quyết định #9 (vai trò `ADMIN`) — chưa chốt, cần làm cùng đợt. |
| 1 | Hai hợp đồng đồng thời | **Cho phép — chỉ chặn trùng CÙNG LOẠI** | Luật chống chồng lấn kiểm theo cặp (`ma_nv`, `loai_hd`), không phải chỉ `ma_nv`. **Kéo theo ba việc chưa lường trước:** (a) `chonHopDongHienHanh` trả về MỘT hợp đồng nên thành mơ hồ khi có HĐ chính + HĐ khoán song song — phải định nghĩa lại "hiện hành" hoặc trả về danh sách; (b) `doiHopDong` dùng `findFirst` để tìm HĐ cần chốt cũng mơ hồ tương tự, phải nhận thêm tham số loại HĐ; (c) Payroll sau này phải biết cộng lương từ nhiều hợp đồng. Ràng buộc DB `EXCLUDE USING gist` vẫn dùng được, thêm `loai_hd` vào khóa loại trừ. |
| 12 | Xóa dòng giấy tờ đang có file | **Xóa dòng thì xóa luôn file trên Drive** | Đúng như tài liệu cũ đã mô tả (code chưa làm). Vì thao tác không hoàn tác được, giao diện phải hỏi xác nhận nêu rõ tên file sắp mất; xóa Drive theo kiểu best-effort và ghi log khi Drive báo lỗi, **không** để lỗi Drive chặn việc xóa dòng. |

**Đợt 2 — 12 quyết định còn lại:**

| # | Quyết định | Chốt | Hệ quả kỹ thuật |
|:--:|:---|:---|:---|
| 2 | HĐ ký trước cho tương lai có là "hiện hành" | **Tính là hiện hành ngay khi ký** | Giữ nguyên `chonHopDongHienHanh` (rơi về `ds[0]` khi không HĐ nào đang hiệu lực). **Hệ quả phải ghi rõ vào spec:** cột "hợp đồng hiện hành" KHÔNG đồng nghĩa "đang hiệu lực hôm nay" — phân hệ Lương sau này phải tự lọc theo `ngay_bat_dau` so với kỳ lương, không được tin thẳng cột này. Sửa giả định A-hrm-09. |
| 3 | Nghỉ việc có bắt buộc chốt HĐ | **Bắt buộc — nhập ngày nghỉ, hệ thống tự chốt HĐ** | Thêm trường ngày nghỉ vào luồng đổi trạng thái nhân viên; trong **cùng một transaction** set `ngay_ket_thuc` cho mọi HĐ còn mở của nhân viên đó. Cần cột lưu ngày nghỉ trên `hrm_nhan_vien` (hiện chưa có), FR/BR/mã lỗi và AC mới. |
| 4 | `so_hd` có duy nhất không | **Duy nhất toàn công ty** | Thêm `@@unique([so_hd])` trên `hrm_hop_dong`. Cùng loại rủi ro với #7: **phải rà dữ liệu trùng ở mọi tenant TRƯỚC migration**. Gộp chung một đợt migration với #7 để chỉ phải rà dữ liệu và gián đoạn dịch vụ một lần. Pre-check ở service vẫn giữ để trả lỗi nghiệp vụ rõ. |
| 5 | Ràng buộc lương | **Cả hai bắt buộc** | `luong_chinh > 0` luôn bắt buộc; bật `trich_bhxh` thì `luong_bhxh > 0` bắt buộc. Thêm 2 mã lỗi vào Mục 5 của spec. **Phải rà dữ liệu cũ đang để 0** — dòng sinh từ `backfill-hop-dong.ts` nhiều khả năng có lương 0; siết validator mà không dọn thì mọi lần sửa HĐ cũ đều fail. |
| 6 | HĐ một ngày (bắt đầu trùng kết thúc) | **Cho phép** | Đổi luật thành `ngay_ket_thuc >= ngay_bat_dau` (sửa BR-hrm-026). Hàm chống chồng lấn và ràng buộc `EXCLUDE USING gist` phải dùng khoảng ngày **bao gồm cả hai đầu mút** (`daterange(..., '[]')`), nếu không HĐ một ngày lọt lưới kiểm chồng lấn. |
| 9 | Vai trò `ADMIN` | **Chủ ý — giữ nguyên** | `access.ts` giữ nguyên: ADMIN không có phạm vi tenant. Vai trò HR/kế toán lương của #8 thiết kế **bên trong** phạm vi `OWNER_EMPLOYEE`, không đụng ADMIN. Ghi thành ADR để lần sau không ai "sửa cho tiện". |
| 10 | Ai được nối Drive công ty | **Chỉ OWNER nối/ngắt; nối xong mọi người được dùng** | Siết `GET /tai-lieu/drive/lien-ket`, `GET .../callback`, `DELETE .../ket-noi` về OWNER (sửa BUG-HRM-11). Upload/xem file giữ nguyên cho mọi người có quyền vào MST. Giao diện phải hiện thông báo "nhờ chủ tài khoản liên kết Drive" thay vì để nút bấm rồi trả 403. |
| 11 | Phòng ban ngừng hoạt động khi còn nhân viên | **Cảnh báo rồi cho; ẩn khỏi ô chọn** | Cho đổi `status='0'` nhưng giao diện phải hỏi xác nhận nêu rõ còn bao nhiêu người; nhân viên cũ giữ nguyên `ma_pb`. Ô chọn phòng ban chỉ liệt kê phòng đang hoạt động **trừ** phòng đang gán của chính nhân viên đang sửa — thiếu vế "trừ" này thì sửa tên một nhân viên sẽ vô tình xóa mất phòng ban của họ. Đóng một phần BUG-HRM-23. |
| 13 | File scan khi xóa mềm nhân viên | **Giữ nguyên file, chưa đặt thời hạn lưu trữ** | Xóa mềm chỉ ẩn khỏi danh sách, không đụng Drive (lý do: còn phải tra cứu quyết toán thuế các năm sau). Ghi thành giả định trong spec và ghi vào nợ kỹ thuật phần chính sách xóa cứng / bảo vệ dữ liệu cá nhân. Không phát sinh việc code ở đợt này. |
| 14 | Hồ sơ đủ/thiếu + ngày hết hạn giấy tờ | **Làm đủ cả hai** | **Hạng mục phát sinh phạm vi lớn nhất của vòng chốt này:** thêm cột `ngay_het_han` cho `hrm_tai_lieu`, thêm danh mục "bộ giấy tờ bắt buộc theo loại HĐ", chỉ báo đủ/thiếu trên hồ sơ nhân viên, cảnh báo sắp hết hạn. Kéo theo cập nhật ERD, `data-model.md`, `api-contract.md`, thêm FR/BR/AC và một nhóm test case mới. Nên tách thành đợt riêng có thiết kế trước. |
| 15 | Nhật ký thao tác | **Ghi thao tác phá hủy + sửa lương; không ghi giá trị trước/sau** | Gọi `writeLog` sẵn có cho: xóa HĐ, sửa lương, xóa NPT, xóa tài liệu, ngắt Drive (sửa BUG-HRM-18). Không phát sinh bảng mới, không lưu ảnh chụp bản ghi. Định lượng NFR-hrm-011 theo mức này. |
| 16 | Ngưỡng hiệu năng | **Chưa đặt số — đo thực tế trước** | Đợt này chỉ thêm index theo `data-model.md` M-05 rồi đo trên tenant lớn nhất. NFR-hrm-004 tạm giữ dạng định tính; QA **không** viết ca test hiệu năng có số ở vòng này, thay bằng một việc đo có báo cáo. |

**Đợt 3 — 4 quyết định phát sinh từ vòng phản biện độc lập:**

| # | Quyết định | Chốt | Hệ quả kỹ thuật |
|:--:|:---|:---|:---|
| 17 | Mặc định quyền xem lương khi bật (OQ-hrm-16) | **Giữ nguyên người cũ, siết người mới** | Cột `xemLuong` mặc định `false`, nhưng migration kèm bước `UPDATE don_vi_access SET xemLuong = true` cho toàn bộ bản ghi đang tồn tại. Ngày triển khai không ai mất màn hợp đồng; bản ghi phân quyền mới từ đó phải được cấp riêng (BR-hrm-069, M-13). |
| 18 | "Khác loại" hiểu theo nghĩa nào (OQ-hrm-18) | **Theo nhóm nghiệp vụ, ba nhóm** | Ràng buộc chống chồng lấn khóa trên **hàm gom nhóm** `hrm_nhom_hd(loai_hd)`, không trên nhãn thô — nếu không thì một người có ba hợp đồng lao động chồng nhau, mỗi cái một nhãn. Hàm tự hạ chữ thường nên biến thể hoa thường không lách được. **Đã chạy thật trên PostgreSQL rồi ROLLBACK**: chặn đúng, cho qua đúng (BR-hrm-022, M-01). |
| 19 | Người phụ thuộc chuyển giữa hai nhân viên (OQ-hrm-27) | **Duy nhất có xét kỳ giảm trừ** | Đổi từ khóa duy nhất phẳng sang **ràng buộc loại trừ** trên (`mst`, khoảng kỳ giảm trừ) — cùng kỹ thuật với chống chồng lấn hợp đồng nên không phát sinh công nghệ mới. Kỳ nối tiếp thì hợp lệ, giữ được lịch sử kê khai. **Giải luôn mâu thuẫn nội bộ của M-09**. Đã chạy thật rồi ROLLBACK (BR-hrm-030, M-09). |
| 20 | Đợt đổi tên đường dẫn API (OQ-hrm-33) | **Hoãn** | Đưa `api-contract.md` về đường tiếng Việt cho khớp mã nguồn, giao diện và 5 tài liệu còn lại — **165 chỗ đã sửa**. Hai nhóm endpoint mới của QĐ #14 đặt tên theo cùng quy ước: `/giay-to-bat-buoc` và `/tai-lieu/sap-het-han`. Đổi tên ghi vào việc làm sau, thành hạng mục riêng. |

**Đã đủ 20/20 — nhưng chốt xong không đồng nghĩa mở cổng Sign-off.** Các quyết định #3, #4, #5, #6, #11, #14, #15 **thêm nghiệp vụ mới**, không chỉ sửa lỗi có sẵn. Phải cập nhật `srs/`, `architecture/`, `qa/` rồi đối soát chéo lại trước khi chuyển `Ready for Implementation` — xem Mục 7.0.


---

## 7. Thứ tự triển khai (sau khi đã chốt đủ 16/16)

### 7.0. ✅ HOÀN TẤT 2026-09-07 — cập nhật tài liệu và đối soát chéo

Vòng chốt đợt 2 thêm nghiệp vụ mới chứ không chỉ sửa lỗi, nên bộ tài liệu Phase A đã lệch. Bảng dưới là phạm vi đã làm; kết quả chi tiết và bốn phát hiện của bước đối soát nằm ở **Mục 8**.

| Tài liệu | Việc phải cập nhật |
|:---|:---|
| `srs/hrm-spec.md` | BR/FR/mã lỗi mới cho #3 (ngày nghỉ + tự chốt HĐ), #4 (`so_hd` unique), #5 (ràng buộc lương, 2 mã lỗi), #6 (sửa BR-hrm-026), #11 (guard phòng ban), #14 (bộ giấy tờ bắt buộc + hạn), #15 (NFR-hrm-011); sửa giả định A-hrm-09 theo #2; đóng OQ-hrm-01…10 |
| `srs/hrm-erd.md` · `architecture/data-model.md` | Cột ngày nghỉ trên `hrm_nhan_vien` (#3); cột `ngay_het_han` + danh mục giấy tờ bắt buộc (#14); `@@unique([so_hd])` (#4); ràng buộc loại trừ theo `(ma_nv, loai_hd)` với khoảng ngày `'[]'` (#1 + #6) |
| `architecture/api-contract.md` | Endpoint/schema cho #14; guard OWNER cho 3 route Drive (#10); trường ngày nghỉ (#3); nhân tiện sửa 9 điểm lệch code đã ghi ở BUG-HRM-14 |
| `architecture/adr/` | ADR mới cho #9 (ADMIN không có phạm vi tenant là **chủ ý**); cập nhật ADR-002 theo #1 + #6; ADR-004 theo #13 |
| `qa/test-cases.md` · `test-matrix.md` | Ca test cho mọi BR/AC mới; bỏ ca hiệu năng có số theo #16, thay bằng việc đo có báo cáo |

Đã đối soát chéo Spec ↔ Contract ↔ Test và chuyển Mục 1 sang `Ready for Implementation` cho đợt P0 và P1.

### 7.1. Đợt P0 — sửa cùng một lần, không tách

1. Hàm kiểm chồng lấn dùng chung cho cả `create` / `update` / `doi` (theo #1, khoảng ngày bao gồm hai đầu mút theo #6) **và** thay `setUTCHours` bằng `homNayVN()` trong `doiHopDong`. Bắt buộc làm cùng nhau: sửa một cái thôi thì hai hàm bất đồng 7 tiếng mỗi ngày, sinh ra lỗi khó lần hơn lỗi đang có.
2. **Migration gộp một lượt:** unique MST người phụ thuộc (#7) + unique `so_hd` (#4). Rà dữ liệu trùng ở mọi tenant TRƯỚC khi chạy — hai ràng buộc rà chung một lần, gián đoạn dịch vụ một lần.
3. Siết `GET /hop-dong` theo #8 (ADMIN giữ nguyên theo #9) — sửa **máy chủ và giao diện cùng lúc**, vì giao diện đang phụ thuộc vào việc máy chủ trả toàn bộ.
4. Ràng buộc lương theo #5 — **kèm rà dữ liệu cũ đang để lương 0** trước khi bật validator, nếu không mọi lần sửa HĐ cũ đều fail.

### 7.2. Đợt P1

Bọc transaction và retry `P2002` cho sinh mã · ngày nghỉ + tự chốt HĐ (#3) · guard và lọc ô chọn phòng ban (#11) · đường xóa tài liệu kèm file Drive (#12) · siết 3 route Drive về OWNER (#10) · nhật ký thao tác (#15) · đồng bộ tên trường `so_npt_an_theo` · dọn docblock lỗi thời ở `schema.prisma` và `hopDongQueries.ts`.

### 7.3. Đợt P2

Bộ giấy tờ bắt buộc và ngày hết hạn (#14 — phạm vi lớn, tách đợt riêng, thiết kế trước) · chỉ báo "chưa có hợp đồng" trên danh sách nhân viên · thêm index theo `data-model.md` M-05 rồi **đo hiệu năng thật** để định lượng NFR-hrm-004 (#16).

### 7.4. Việc không phụ thuộc quyết định nghiệp vụ (làm được ngay)

* `docs/hrm/` đang **untracked** trong git — toàn bộ bộ tài liệu Phase A chưa commit lần nào.
* Dòng comment chưa commit trong `be_maxv/src/scripts/backfill-hop-dong.ts` đổi `/hrm/nhan-vien` thành `/hrm/nhan-vien`: **KHÔNG phải lỗi** — đây là một bước của đợt đổi tên đường dẫn sang tiếng Anh đã đặc tả ở `architecture/api-contract.md` Mục 1.8. Lưu ý: đợt đổi tên đó **chưa được triển khai trong mã** (`src/routes/hrm/nhanVien.route.ts:11` vẫn là `/nhan-vien`), nên comment đang mô tả trạng thái đích chứ không phải hiện trạng. Giữ hay lùi lại là quyết định của người viết, không phải việc phải sửa.
* **HRM chưa có một file test nào** — `be_maxv/src/__tests__/` có 41 file, không file nào cho HRM. Bộ 185 ca của QA hiện thuần giấy, chưa chạy được.

**Phạm vi được phép khởi chạy đã bị thu hẹp sau vòng phản biện — xem Mục 9.3.**

---

## 8. Kết quả vòng cập nhật tài liệu 7.0 và đối soát chéo (2026-09-07)

### 8.1. Đã cập nhật

| Tầng | File | Nội dung |
|:---|:---|:---|
| BA | `srs/hrm-spec.md` | 16 quy tắc nghiệp vụ mới (BR-hrm-051…066), 8 yêu cầu chức năng mới (FR-hrm-036…043), 13 mã lỗi mới (E-hrm-052…064), 21 tiêu chí nghiệm thu mới (AC-hrm-36…56); định lượng NFR-hrm-011; đóng 9 câu hỏi mở, mở 5 câu mới |
| BA | `srs/hrm-erd.md` | Thực thể mới `hrm_giay_to_bat_buoc`; hai cột mới `ngay_nghi_viec`, `ngay_het_han`; ba ràng buộc duy nhất/loại trừ mới |
| BA | `srs/hrm-states.md` | Vòng đời nhân viên có nhánh ghi nhận nghỉ việc; vòng đời hợp đồng thêm hai chuyển trạng thái do nghỉ việc; **vòng đời mới `HanGiayTo`**; cập nhật bảng ai-được-làm-gì của liên kết Drive |
| BA | `srs/hrm-flows.md` | **Hai luồng mới**: ghi nhận nghỉ việc, và chỉ báo hồ sơ đủ/thiếu kèm cảnh báo hạn. Cập nhật luồng xóa giấy tờ, luồng Drive, và ghi chú của hai luồng swimlane |
| BA | 2 file `.puml` | Cập nhật nguồn swimlane theo QĐ 1, 4, 5, 6, 11 |
| Architect | `architecture/data-model.md` | M-01 đổi khóa loại trừ thêm `loai_hd`; M-07 và M-09 hết trạng thái chờ BA; **ba migration mới M-10, M-11, M-12**; cập nhật sơ đồ quan hệ và mục lưu trữ dữ liệu |
| Architect | `architecture/api-contract.md` | Thao tác ghi nhận nghỉ việc; bốn phép kiểm mới của hợp đồng; `loai_hd_can_chot`; che trường lương theo quyền; bốn trường mới ở danh sách nhân viên; `ngay_het_han`; xóa giấy tờ kèm file Drive; siết quyền Drive; **nhóm endpoint mới `/giay-to-bat-buoc` và `/tai-lieu/sap-het-han`**; bảng mã lỗi mới |
| Architect | `architecture/adr/` | **ADR-007 mới** (quyền xem lương và phạm vi tenant của ADMIN); cập nhật ADR-002 (QĐ 1, 2, 6) và ADR-004 (QĐ 12, 13, 15) |
| QA | `qa/test-cases.md` | **60 ca mới TC-hrm-186…245** phủ đủ 12 quyết định, chia 10 nhóm |
| QA | `qa/test-matrix.md` | Cập nhật vùng chờ chốt (4 vùng đã đóng, 6 vùng còn mở); bảng ánh xạ ID cũ sang ID mới |

### 8.2. Bốn phát hiện của bước đối soát chéo

1. **Xung đột mã lỗi — đã xử lý.** `api-contract.md` Mục 8.9 đề xuất `E-hrm-052/053/054` cho ba lỗi kỹ thuật dùng chung, trùng đúng ba mã mà QĐ #3 vừa cấp cho nhóm ghi nhận nghỉ việc. Đã dời ba lỗi kỹ thuật xuống **`E-hrm-062/063/064`** và cấp ID chính thức trong spec (Mục 8.9 của spec). Tài liệu hoặc mã nào còn dùng `E-hrm-052/053/054` với nghĩa kỹ thuật đều sai.

2. **Khoảng trống nhật ký — CẦN NGƯỜI DÙNG QUYẾT.** Thao tác ghi nhận nghỉ việc (QĐ #3) **tự sửa `ngay_ket_thuc` của hợp đồng** — hệ thống thay đổi dữ liệu hợp đồng thay người dùng — nhưng không thuộc nhóm nào trong năm nhóm phải ghi nhật ký của BR-hrm-066. QĐ #15 liệt kê đúng năm nhóm và không nhóm nào phủ trường hợp này. Đề nghị bổ sung thành nhóm thứ sáu; chưa tự thêm vì đó là mở rộng phạm vi quyết định.

3. **Hai nhóm ca kiểm thử cũ có kỳ vọng lỗi thời.** `TC-hrm-067…078` (chồng lấn hợp đồng) viết theo luật cũ chỉ khóa `ma_nv`, nay phải phân biệt theo `loai_hd`; `TC-hrm-104…108` (trùng mã số thuế người phụ thuộc) viết theo phạm vi per-nhân-viên, nay là toàn công ty. **Phải rà lại trước Phase B**, chạy nguyên trạng sẽ báo FAIL nhầm.

4. **Hai ảnh swimlane chưa vẽ lại.** File nguồn `.puml` đã cập nhật nhưng `.svg` và `.png` vẫn là bản sinh trước đợt chốt, nên hình thể hiện luồng cũ. Vẽ lại bằng `.claude/skills/activity-swimlane/render.sh <file.puml> --png`. **Chưa chạy** vì lệnh này gửi nội dung diagram tới máy chủ công khai `plantuml.com` — cần người dùng đồng ý trước.

### 8.3. Sáu câu hỏi mở còn lại — không chặn đợt P0 và P1

| ID | Nội dung | Chặn phần nào |
|:---|:---|:---|
| OQ-hrm-09 | Ngày cấp giấy tờ có được là ngày tương lai không | Một quy tắc nhỏ của giấy tờ |
| OQ-hrm-11 | Hai hợp đồng khác loại cùng chạy thì cột "hợp đồng hiện hành" hiện cái nào | Đường đọc danh sách nhân viên. **Không** chặn luật chống chồng lấn |
| OQ-hrm-12 | Đưa nhân viên từ đã nghỉ trở lại đang làm thì xử lý ngày nghỉ và hợp đồng đã chốt ra sao | Nhánh ngược của QĐ #3. **Không** chặn nhánh xuôi |
| OQ-hrm-13 | Bộ giấy tờ bắt buộc gồm chính xác những loại nào, ai được sửa danh mục | Nội dung khởi tạo danh mục. **Không** chặn việc dựng khả năng khai báo |
| OQ-hrm-14 | Ngưỡng "sắp hết hạn" bao nhiêu ngày, khai ở đâu | Nhánh cảnh báo sớm. Nhánh "đã hết hạn" chạy được ngay |
| OQ-hrm-15 | Từ khi cho hợp đồng một ngày, `ngay_chot` có được bằng ngày bắt đầu hợp đồng đang hiệu lực không | Một nhánh của đổi hợp đồng. Đợt này giữ nguyên hành vi cũ |

Cả sáu đều rơi vào đợt P2 hoặc vào nhánh phụ, và đều đã ghi rõ trong spec là không chặn. **Đợt P0 và P1 triển khai được ngay.**

---

---

## 9. Vòng phản biện độc lập Architect ∥ Tester-QA (2026-09-07)

### 9.1. Vì sao phải chạy lại

Vòng cập nhật tài liệu 7.0 được **một người viết tuần tự cả ba tầng** rồi tự đối soát — không phải phản biện chéo như Phase 2 của quy trình quy định. Tự soát bài mình bắt được 4 lỗi, nhưng **bỏ sót phần lớn** những gì vòng này tìm ra. Hai agent chạy độc lập, chỉ đọc không ghi, mỗi bên không xem kết quả bên kia; mọi khẳng định nặng được kiểm chứng lại lần nữa trước khi ghi nhận.

**Bài học:** không gộp ba vai vào một lượt viết. Cổng Phase A tồn tại chính vì lý do này.

### 9.2. Bảy bug mới — chi tiết ở `qa/issues-and-bugs.md` Mục 7

| Mã | Mức | Một dòng | Trạng thái |
|:---|:---:|:---|:---|
| BUG-HRM-26 | 🟠 High | Yêu cầu sửa nhân viên thiếu `status` âm thầm đưa người đã nghỉ về đang làm | Đã có BR-hrm-067 + TC-hrm-255 |
| BUG-HRM-27 | 🟠 High | Ràng buộc chống chồng lấn khóa trên `loai_hd` thô không bảo vệ được: chữ tự do không chuẩn hóa, và ba nhãn cùng thuộc một nhóm hợp đồng lao động | Chờ OQ-hrm-18, OQ-hrm-19 |
| BUG-HRM-28 | 🟠 High | Cách ghi phân quyền hiện tại xóa sạch quyền xem lương mỗi lần sửa danh sách công ty | Đã ghi vào M-13 + ADR-007 + TC-hrm-258 |
| BUG-HRM-29 | 🟡 Medium | Tên cơ sở dữ liệu tenant sai trong toàn bộ tài liệu | ✅ Đã sửa 16 chỗ |
| BUG-HRM-30 | 🟡 Medium | Kế hoạch migration dựa trên cơ chế không tồn tại | ✅ Đã viết lại `data-model.md` Mục 8.0 |
| BUG-HRM-31 | 🟡 Medium | Trích dẫn `file:line` bịa, lệch đều khoảng 165 dòng | ✅ Đã sửa 15 chỗ |
| BUG-HRM-32 | 🟠 High | Đợt đổi tên đường dẫn API chỉ tồn tại trong một tài liệu | Đã gắn cảnh báo — chờ OQ-hrm-33 |

### 9.3. Phạm vi được phép khởi chạy — THU HẸP

**✅ Được khởi chạy ngay (ba hạng mục P0):**

1. **Chống chồng lấn hợp đồng + mốc giờ Việt Nam** — hàm dùng chung cho cả ba đường ghi, thay `setUTCHours` bằng `homNayVN()`. ⚠️ Khóa loại trừ **chưa chốt được** cho tới khi có OQ-hrm-18; phần sửa mốc giờ và gom ba đường ghi về một hàm thì làm được ngay.
2. **Ràng buộc lương** (QĐ #5) — kèm rà và dọn dữ liệu cũ lương bằng 0 trước khi bật validator.
3. **`status` bắt buộc trong yêu cầu sửa nhân viên** (BR-hrm-067) — bịt BUG-HRM-26.

### 9.3b. Cập nhật sau khi chốt 4 quyết định đợt 3 (cùng ngày)

Bốn câu chặn nặng nhất đã có lời đáp (QĐ #17…#20, Mục 6.1), nên phạm vi **mở rộng lại**:

**✅ Được khởi chạy — bổ sung:**

| Hạng mục | Nhờ quyết định nào | Điều kiện |
|:---|:---|:---|
| **QĐ #1 + #6 — chống chồng lấn hợp đồng, đầy đủ** | QĐ #18 chốt khóa theo **nhóm nghiệp vụ** | Dùng hàm gom nhóm `hrm_nhom_hd`; SQL đã chạy thật và đúng hành vi |
| **QĐ #7 + #4 — hai ràng buộc duy nhất** | QĐ #19 chốt **xét kỳ giảm trừ**, giải mâu thuẫn M-09 | Rà dữ liệu bằng câu quét **có xét kỳ** ở M-09, không dùng câu quét cũ |
| **QĐ #8 — quyền xem lương** | QĐ #17 chốt **giữ nguyên người cũ** | Ship **cùng một lượt**: cột M-13 + bước chuyển dữ liệu + đổi cách ghi phân quyền sang ghi theo cặp khóa + màn cấp quyền (FR-hrm-044) |
| **Toàn bộ P0 và P1** | QĐ #20 hoãn đổi tên route, contract đã về tiếng Việt khớp mã | — |

**🔴 Vẫn đóng:**

| Hạng mục | Lý do | Mở khi |
|:---|:---|:---|
| **Đợt P2 — bộ giấy tờ bắt buộc và hạn giấy tờ** | Chốt "làm cả hai" nhưng không chốt **nội dung** danh mục và **ngưỡng** cảnh báo | OQ-hrm-13, OQ-hrm-14 |

**Điều kiện chung còn nợ trước Phase B** (không chặn Backend viết code, nhưng chặn nghiệm thu): dựng file test HRM mẫu kèm mẫu giả lập đồng hồ và giả lập gọi Google; bổ sung cột truy vết tiêu chí nghiệm thu cho các nhóm ca 6B.1–6B.10; rà lại hai nhóm ca cũ có kỳ vọng lỗi thời.

### 9.3c. Bảng đóng cổng cũ (giữ làm dấu vết — đã được 9.3b thay thế)

| Hạng mục | Lý do đóng lúc đó | Đã mở bằng |
|:---|:---|:---|
| QĐ #8 — quyền xem lương | Chặn được nhưng không cấp được cho ai | QĐ #17 + M-13 + FR-hrm-044 |
| QĐ #7 — người phụ thuộc duy nhất | M-09 khuyến nghị ngược với điều đã chốt | QĐ #19 |
| QĐ #4 — số hợp đồng duy nhất | Bị kéo theo QĐ #7 | QĐ #19 |
| Toàn bộ, nếu đổi tên đường dẫn API | Chưa chốt làm hay hoãn | QĐ #20 |
| Đợt P2 — bộ giấy tờ bắt buộc | Chưa chốt nội dung và ngưỡng | **Vẫn đóng** |

### 9.4. Câu hỏi mở sau vòng này

Từ 6 lên **24** (OQ-hrm-09, 11…33). Danh sách đầy đủ ở `srs/hrm-spec.md` Mục 15.1 và 15.1b. Bốn câu chặn nặng nhất: **OQ-hrm-16** (mặc định quyền xem lương), **OQ-hrm-18** ("khác loại" theo nhãn hay theo nhóm), **OQ-hrm-27** (người phụ thuộc chuyển giữa hai nhân viên), **OQ-hrm-33** (có đổi tên đường dẫn API không).

### 9.5. Thay đổi chính sách sơ đồ

Trong lúc vòng này chạy, chủ dự án sửa `.claude/CLAUDE.md` và `.claude/rules/diagram-selection.md`: **bỏ hard-gate vẽ sơ đồ, cấm sinh file `.svg` / `.puml` / `.png`**, chuyển sang Mermaid nhúng trực tiếp trong `.md`. Sáu file sơ đồ rời đã bị xóa. Hai luồng swimlane trong `srs/hrm-flows.md` đã được **chuyển sang Mermaid `flowchart` có lane bằng `subgraph`**, giữ nguyên nội dung nghiệp vụ và bổ sung các bước mới theo QĐ 1, 4, 5, 6, 11. Toàn bộ 7 sơ đồ của file compile sạch.

---

## 10. Phase 3 (Backend) và Phase 4 (Kiểm thử) — 2026-09-07

### 10.1. Backend đã triển khai đợt P0

7 hạng mục, 14 file sửa + 6 file mới trong `be_maxv/`. Không đụng giao diện, không đụng tài liệu ngoài `dev-notes.md`. **Chưa chạy bất kỳ lệnh nào lên cơ sở dữ liệu** — migration và hai script vận hành đều mới chỉ là mã.

**Số liệu chạy thật, đã kiểm chứng độc lập hai lần (BA và QA):**

| Lệnh | Kết quả |
|:---|:---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | **0 error**, 148 warning (toàn `no-console`, +23 so với Phase A do hai script mới) |
| `npm test` | **456 / 451 pass / 5 fail** |
| Hai file test HRM mới | **54 / 54 pass** |

**5 ca fail là có sẵn, không phải hồi quy.** QA xác minh bằng `git worktree` tại `HEAD 8a18824` (mã trước P0): chạy lại cho **kết quả giống hệt**. Nguyên nhân: `adminOwner.test.ts` còn dùng header Bearer trong khi hệ thống đã chuyển sang cookie httpOnly từ commit `2d791dc`. Nằm ngoài phạm vi HRM.

### 10.2. Kết luận kiểm thử: ĐẠT CÓ ĐIỀU KIỆN — **cấm triển khai ở trạng thái hiện tại**

**Sáu bẫy nặng nhất đều không dính** (QA soi từng cái, có `file:line`): khóa chồng lấn dùng đúng nhóm nghiệp vụ · khoảng ngày đóng hai đầu · `boQuaId` khi sửa số hợp đồng · không còn `setUTCHours` · quyền lương **không** bị nhét vào vé đăng nhập · đường ghi nhân viên **xóa khóa** thay vì nhận `null` rồi ghi đè. Thêm một chỗ dễ rò mà mã tránh được: hàm trả hợp đồng cho màn nhân viên liệt kê tường minh 6 trường thay vì `spread`, nên hai cột lương không lọt ra.

**Ba lỗi chặn triển khai:**

| Mã | Mức | Nội dung |
|:---|:---:|:---|
| **BUG-HRM-33** | 🟠 High | Lệnh gỡ khóa duy nhất cũ của người phụ thuộc là **lệnh rỗng**. Prisma sinh `@@unique` bằng `CREATE UNIQUE INDEX`, script lại gỡ bằng `ALTER TABLE ... DROP CONSTRAINT` — hai thứ khác nhau. **Đã chứng minh bằng SQL chạy thật rồi ROLLBACK**: sau lệnh của script, index vẫn còn nguyên; chỉ `DROP INDEX` mới gỡ được. Hệ quả: khóa cũ sống sót và nó **chặt hơn** BR-hrm-030 — chặn cả hai dòng cùng nhân viên cùng mã số thuế dù kỳ không giao nhau. Runbook trong `dev-notes.md` Mục 1.3b cũng thiếu bước `sync:tenants` |
| **BUG-HRM-34** | 🟠 High | Người phụ thuộc **mất hẳn lớp phòng thủ ở tầng cơ sở dữ liệu**: khóa cũ đã gỡ khỏi schema, ràng buộc mới chưa áp, và hai đường ghi vẫn không bọc giao dịch. Đúng kịch bản sai thuế thu nhập cá nhân của BUG-HRM-05 |
| **BUG-HRM-41** | 🟠 High | Ba việc "ship cùng một lượt" của QĐ #8 và #1 **chưa làm ở giao diện** — đây là **hệ quả của việc chỉ chạy Backend trước**, không phải lỗi của Backend. Giao diện vẫn gọi lịch sử hợp đồng không tham số (màn hợp đồng sẽ trắng với **mọi** người dùng), thân yêu cầu đổi hợp đồng thiếu loại cần chốt, và **không có màn nào cấp được quyền xem lương** |

Thêm 2 lỗi trung bình (chuẩn hóa `loai_hd` chưa làm; danh sách phân quyền trùng công ty thì phần tử cuối thắng) và 4 lỗi thấp. Chi tiết ở `qa/issues-and-bugs.md` Mục 9 và `qa/test-report.md`.

### 10.3. Hai điểm QA phản biện lại Backend — và QA đúng cả hai

Backend khai hai ca kiểm thử có kỳ vọng lỗi thời. QA thẩm định lại và **bác cả hai**:

* **TC-hrm-247** — kỳ vọng 409 **vẫn đúng**. Dòng không khai kỳ được quy thành khoảng vô hạn nên **giao với mọi kỳ**. Cái lỗi thời là *cột lý do*, không phải kỳ vọng. Nhận nguyên lời khai mà hạ xuống 201 là bỏ mất người canh một nhánh chặn thật. Đồng thời lộ khoảng trống: nhánh "cùng nhân viên, kỳ nối tiếp" **chưa ca nào phủ**.
* **TC-hrm-249** — là **ca quan sát**, không có kỳ vọng cố định nên không thể lỗi thời. Nhãn đúng là "chưa chạy được".

Năm quyết định Backend tự đưa ra khi hợp đồng mơ hồ: QA thẩm định **5/5 chấp nhận được**, hai cái kèm điều kiện.

### 10.4. Bao phủ thật

**20/81 ca của Mục 6B pass thật, toàn bộ ở tầng luật.** **Chưa một endpoint HRM nào được gọi thật** — hai file test mới là test thuần logic, không qua `buildApp()`. 57 ca chưa chạy được: 22 thuộc P1 chưa làm · 12 thuộc P2 còn đóng · 12 cần cơ sở dữ liệu tenant và khung test tích hợp · 6 cần cột quyền lương đã migrate · 4 cần ràng buộc loại trừ đã áp · 3 cần envelope lỗi có trường mã.

### 10.5. ✅ Đã vá lỗi chặn và ĐÃ CHẠY cơ sở dữ liệu (cùng ngày)

**BUG-HRM-33 đóng** — gỡ khóa cũ bằng **cả hai nhánh** (`DROP CONSTRAINT` rồi `DROP INDEX`, thứ tự bắt buộc), runbook bổ sung bước `sync:tenants` còn thiếu. **BUG-HRM-34 đóng** — hai đường ghi người phụ thuộc bọc `$transaction` theo đúng mẫu của `createHopDong`.

**Đã chạy lên cơ sở dữ liệu localhost dev, chủ dự án cho phép** (phân hệ đang phát triển, chưa có dữ liệu thật — `hrm:ra-soat` xác nhận **10/10 tenant sạch** trước khi chạy):

| Lệnh | Kết quả |
|:---|:---|
| `hrm:ra-soat` | 0/10 tenant cần dọn |
| `migrate:sys:deploy` | Áp migration cột quyền lương thành công |
| `sync:tenants` | 10 thành công, 0 lỗi |
| `hrm:constraints` | 10/10 tenant đủ ràng buộc |

**Phát hiện thêm BUG-HRM-42 khi chạy lần hai — và nó chỉ lộ ra vì chạy thật.** Script **không idempotent**: bản đầu bắt SQLSTATE `42710`, nhưng ràng buộc loại trừ tạo **index nền** nên Postgres báo `42P07`. Lần chạy thứ hai **fail cả 10/10 tenant**. Đã vá, chạy lại lần ba: **10/10, 0 lỗi**. Đây là lỗi mà đọc mã tĩnh không thấy — phần bắt lỗi trông hoàn toàn hợp lý.

**Kiểm hành vi trên cơ sở dữ liệu thật, 8/8 ca đúng thiết kế** (mọi ca đều ROLLBACK): hợp đồng khoán song song được nhận · `xac_dinh` chồng `khong_xac_dinh` bị chặn · số hợp đồng trùng bị chặn · người phụ thuộc kỳ nối tiếp được nhận ở cả cùng lẫn khác nhân viên · kỳ giao nhau bị chặn · không khai kỳ bị chặn. **Lần đầu ràng buộc HRM được kiểm thật thay vì suy luận.**

**Tranh chấp `TC-hrm-247` ngã ngũ: QA đúng, Backend sai.** Ca "cùng nhân viên, không khai kỳ" chạy thật → **bị chặn**, nên kỳ vọng 409 giữ nguyên; chỉ cột lý do cần viết lại. Chi tiết ở `qa/issues-and-bugs.md` Mục 10.

### 10.6. Việc còn lại

1. **Chạy đợt Frontend** cho ba việc của BUG-HRM-41 — đây là việc chặn triển khai duy nhất còn lại của đợt P0. Không có nó thì màn hợp đồng trắng với mọi người dùng và không ai cấp được quyền xem lương.
2. Dựng khung test tích hợp có `app.inject()` — 12 ca endpoint vẫn chưa chạy được, và **chưa một endpoint HRM nào được gọi thật**.
3. Bổ sung ca cho nhánh "cùng nhân viên, kỳ nối tiếp → 201" (QA nêu, hiện chưa ca nào phủ dù hành vi đã xác nhận đúng).
4. Sửa cột lý do của `TC-hrm-247` cho khớp QĐ #19.
5. Đợt P1, rồi P2 khi chốt xong OQ-hrm-13 và OQ-hrm-14.
