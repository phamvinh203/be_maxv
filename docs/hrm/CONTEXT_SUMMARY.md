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
* **Trạng thái phân hệ (cập nhật 2026-09-08 sau Quality Gate và vòng sửa lỗi chặn — xem Mục 16):**
  * **Đợt P0 và P1:** `Ready for Implementation`, giữ nguyên (Mục 9.3b).
  * **Cụm nền tảng Cấu hình mặc định / Ca làm việc / Lịch ngày lễ:** **ĐẠT CÓ ĐIỀU KIỆN, sau khi đóng 2 lỗi chặn của Quality Gate (2026-09-08) — xem Mục 16.** Đợt đổi dải năm "Tạo nhanh" sang dải trượt **đã bị thu hồi**, mọi tầng đã hoàn nguyên về **2024–2030** — xem Mục 17. Cơ sở dữ liệu đã di trú **10/10 tenant**; giao diện đã nối API thật; hai lỗi chặn `B1` (phân trang) và `B2` (bảng âm lịch sai 17/42 ô) đã đóng. Còn **4 ca đỏ cố ý không nới lỏng** (`TC-hrm-301` tìm kiếm không bỏ dấu · `TC-hrm-316` mâu thuẫn giữa bộ ca và hợp đồng) và 7 khoản nợ ở Mục 16.6 — đáng chú ý nhất: **số liệu bảng lương vẫn là dữ liệu giả**, đợt này chỉ đổi nguồn cấu hình. Ghi chép Phase B đợt 2 (giữ nguyên làm lưu vết): ĐẠT CÓ ĐIỀU KIỆN sau Phase B đợt 2 — xem Mục 15.** Máy chủ đã được **gọi thật qua HTTP**: 54/55 ca chạy thật, **52 PASS · 2 FAIL (đều do câu chữ tài liệu lệch hợp đồng) · 1 KHÔNG CHẠY ĐƯỢC**, **0 lỗi sản phẩm mới**. Được merge phần máy chủ; **chưa** được ghi "nghiệm thu hoàn tất" cho tới khi BA chốt `BUG-HRM-50` và có thực thể `hrm_work_schedules`. Ghi chép lịch sử của trạng thái trước đó: Trạng thái đúng với thực tế: đặc tả đã chốt (24/24 quyết định, gồm 4 quyết định mới `QĐ #22`…`#25`) · **thiết kế kỹ thuật đã cập nhật xong 2026-09-08** — `api-contract.md` + `data-model.md` đã đối soát với mã nguồn thật cho đủ 14 endpoint, `ADR-009` chốt 4 quyết định kỹ thuật (xem Mục 14) · **máy chủ đã viết xong nhưng còn sai biểu thuế TNCN, thiếu ba phép kiểm toàn vẹn, thiếu hai cảnh báo và thiếu nhật ký kiểm toán** (11 việc `BE-01`…`BE-11`) · **giao diện chưa nối API, và lớp gọi API hiện có sai 3 chỗ chặn** (`FE-01`, `FE-02`, `FE-05`) · **kiểm thử chưa gọi thật một endpoint nào**.
  * **Đợt P2** (bộ giấy tờ bắt buộc) vẫn đóng, chờ OQ-hrm-13 và OQ-hrm-14.
  * Đã chốt 20/20 quyết định nghiệp vụ đợt cũ, 6/6 phát hiện phản biện QA đợt nền tảng (`BUG-HRM-44`…`BUG-HRM-49`) và 4/4 phát hiện của đợt thẩm định lại 2026-09-08.
  * Đợt 1 đã triển khai xong (CRUD 5 thực thể + tích hợp Drive + đồng bộ frontend).
  * Vòng rà soát 3 Amigos (BA ∥ Architect ∥ QA) hoàn tất ngày 2026-09-07 — xem Mục 5.
  * Chốt đủ **16/16** quyết định nghiệp vụ ngày 2026-09-07 (Mục 6.1 — 4 quyết định đợt 1, 12 quyết định đợt 2).
  * **Vòng cập nhật tài liệu 7.0 hoàn tất ngày 2026-09-07** — `srs/` · `architecture/` · `qa/` đã nạp đủ 16 quyết định và đã đối soát chéo Spec ↔ Contract ↔ Test. Xem Mục 8.
  * **Vòng phản biện độc lập Architect ∥ Tester-QA hoàn tất 2026-09-07** — xem Mục 9. Vòng này tìm ra 7 bug mới và 18 nhánh nghiệp vụ mà cả đặc tả lẫn bộ ca kiểm thử đều bỏ sót.
  * **Cổng BA Final Sign-off MỞ cho P0 và P1** sau khi chốt nốt 4 quyết định đợt 3 (QĐ #17…#20). Xem Mục 9.3b. **Đợt P2 vẫn đóng.**
  * **Sáu việc chặn** phải xong trước khi mở lại phần còn lại — xem `qa/issues-and-bugs.md` Mục 5, Sprint 0b.
  * **Đặc tả SRS cụm nền tảng mới (2026-09-08):** Hoàn thành đặc tả nghiệp vụ SRS cho 3 thực thể nền tảng Cấu hình mặc định (`hrm_general_settings`), Ca làm việc (`hrm_work_shifts`) và Lịch ngày lễ (`hrm_holidays`). Bổ sung 10 BR (`BR-hrm-070`..`079`), 10 FR (`FR-hrm-045`..`054`), 13 mã lỗi (`E-hrm-067`..`079`), 5 UC (`UC-hrm-18`..`22`), 10 AC (`AC-hrm-57`..`66`), 3 luồng quy trình Mermaid (`hrm-flows.md`), 2 vòng đời trạng thái (`hrm-states.md`) và 14 endpoint API.
  * **Biên bản chốt BA Final Sign-off Cụm nền tảng (2026-09-08):** Hoàn thành rà soát chéo 3 Amigos (BA ↔ Architect ↔ QA), tiếp thu và xử lý dứt điểm 6 phát hiện phản biện QA (`BUG-HRM-44`…`BUG-HRM-49`) theo `docs/hrm-ba-signoff-2026-09-08.md`. ⚠️ **Phần kết luận nghiệm thu của biên bản đó đã bị thay thế** — xem Mục 13.
  * **Đợt thẩm định lại và chốt nghiệp vụ (2026-09-08, cùng ngày):** Phát hiện biểu thuế TNCN mặc định **sai luật** (5 bậc dừng ở 25% thay vì 7 bậc theo Điều 22 Luật Thuế TNCN) và ngữ nghĩa trường `khoang` không thống nhất giữa máy chủ với giao diện. Chốt 4 quyết định `QĐ #22`…`#25`, bổ sung `BR-hrm-080`…`083`, `FR-hrm-055`, `E-hrm-080`…`082`, `AC-hrm-67`…`72`, và **hạ trạng thái cụm tính năng khỏi mức đã nghiệm thu**. Biên bản: `docs/hrm/agents-business-analyst/ba-reconciliation-report-2026-09-08.md` — xem Mục 13.
  * **Phân hệ Dữ liệu tính lương (2026-09-09 → cập nhật 2026-09-10) — cụm "8 phân hệ nhập liệu + vòng đời kỳ lương" đã ỔN ĐỊNH, cụm "Bảng lương tổng hợp hiển thị" (`bang_luong`) VẪN CHƯA Ready:** đợt kiểm định 2026-09-09 (BA độc lập → Architect ∥ Tester-QA Phase A → Code Reviewer, xem Mục 19.9) phát hiện 9 lỗi 🔴; backend-engineer đã **FIXED 8/9** và frontend-engineer đã **nối API thật cho toàn bộ 23 file còn mock của 8 phân hệ nhập liệu** (work-log 2026-09-09 17:55) — cụm này coi như đạt yêu cầu triển khai. **Đợt kiểm định mới 2026-09-10** (BA, xem Mục 19.10) chuyển sang nhiệm vụ khác: dựng chức năng **Bảng lương tổng hợp** (`GET /payroll/calculate` → UI `bang_luong` 18 cột + tab "Lương hỗ trợ") — UI này **100% còn mock, chưa từng đấu nối**. Phát hiện: đã tự chốt xong 7/10 OQ cũ, phát hiện thêm **4 lỗ hổng thuế/bảo hiểm mới** so với luật VN (2 trần bảo hiểm độc lập, miễn thuế OT vượt chuẩn, khấu trừ 10% HĐ thử việc/thời vụ, trần miễn thuế ăn trưa 730k — `BR-dltl-024…027`), và **1 xung đột nguồn sự thật** cho cột "Lương" (Hợp đồng `luong_chinh` và cột "Lương" trong "Cài đặt lương" — `EmployeeSalaryItem` — đang được 2 cụm code giả định khác nhau) — đánh dấu `OQ-dltl-011 (mới)`. **Cập nhật cùng ngày (Mục 19.11):** chủ dự án đã trực tiếp xác nhận cả 2 quyết định nghiệp vụ còn treo (OQ-dltl-011 → 2 tầng dữ liệu cộng lại, không loại trừ nhau; biểu thuế TNCN → giữ nguyên luật hiện hành 7 bậc/11tr/4.4tr). BA đã viết đầy đủ công thức + Acceptance Criteria cho 4 BR mới (`srs-du-lieu-tinh-luong.md` Mục 15.3.1). **Status: Đặc tả đã chốt đủ — sẵn sàng cho Phase 2 Architect ∥ Tester-QA** (chưa phải Ready for Implementation, còn chờ Phase 2 phản biện + BA Final Sign-off). Xem Mục 19, đặc biệt 19.10–19.12. **Cập nhật 2026-09-10 (Tester-QA):** Phase A đã hoàn tất song song với Architect — 44 test case (8 nhóm, `docs/hrm/du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md`), đối chiếu chéo phát hiện thêm 8 gap đặc tả (`GAP-QA-01…08`, 3 mức 🔴 chặn một phần: category phụ cấp cố định, cách quy đổi công, tương tác miễn thuế OT với khấu trừ 10%). Xem Mục 19.11. Vẫn CHƯA Ready cho tới khi 3 gap 🔴 + OQ-dltl-011 được chốt. **Cập nhật 2026-09-10 (Architect — Phase 2 xong, Mục 19.13):** đã xuất `data-model` Mục 11 (18 cột schema tenant), `api-contract` Mục 8 (DTO 43 trường + endpoint mới `GET /payroll/support-allowances`) và `ADR-010` (pipeline 10 bước). Đã chốt cả 2 gap kỹ thuật BA để mở (cờ `SalaryItem.isMealAllowance`; tách `contractBaseSalary`/`fixedAllowanceTotal`/`allowanceInPeriodTotal` + đơn giá giờ OT dùng `isOvertimeBase`). Phát sinh **1 câu hỏi 🔴 mới cho BA/kế toán trưởng (Q-1)**: công thức SRS Mục 15.3.1 bỏ qua `SalaryItem.isTaxable`/`SalaryStructureItem.taxTreatment` ⇒ ô tick "chịu thuế TNCN" hiện không tác dụng tới bảng lương. **Cập nhật 2026-09-10 (Architect, `ADR-010` chốt Q-1/Q-2 bằng văn bản — Mục 19.15):** pipeline 10 bước hoàn chỉnh, `GAP-QA-09` đóng, 19 cột schema (không phải 18), 44 trường response. **Cập nhật 2026-09-10 (BA — Final Sign-off, Mục 19.16):** đã bổ sung `AC-dltl-24…28` vào SRS Mục 15.3.1 khớp `ADR-010` bước [5a], đối soát chéo SRS ↔ Architecture ↔ Test Matrix PASS (không mâu thuẫn nghiệp vụ chặn tiến độ). **Status: Ready for Implementation — Backend Engineer đã được kích hoạt.** Xem Mục 19.16 cho phạm vi triển khai đầy đủ.

---

## 2. Bounded Context & Các thực thể (Entities)

| Thực thể | Bảng cơ sở dữ liệu | Vị trí DB | Mô tả nghiệp vụ |
|:---|:---|:---|:---|
| **Đơn vị / Công ty** | `don_vi` | `maxv2_sys` | Quản lý thông tin doanh nghiệp tenant, lưu token kết nối Google Drive cấp công ty (`driveRefreshTokenCipher`, `driveEmail`). |
| **Phòng ban** | `hrm_phong_ban` | `db_<MST>` | Danh mục phòng ban theo cây phân cấp (`ma_pb_me`), sinh mã tự động `PBxx.yy`, xóa mềm (`da_xoa`). |
| **Nhân viên** | `hrm_nhan_vien` | `db_<MST>` | Hồ sơ nhân viên, ngày vào làm, thông tin ngân hàng, chế độ công đoàn/chấm công, xóa mềm (`da_xoa`). Không lưu bản sao tĩnh của hợp đồng. |
| **Hợp đồng** | `hrm_hop_dong` | `db_<MST>` | Lịch sử hợp đồng lao động (1 nhân viên - N hợp đồng), lương chính, lương BHXH, ngày bắt đầu/kết thúc. Nguồn sự thật cho Hợp đồng hiện hành. |
| **Người phụ thuộc** | `hrm_nguoi_phu_thuoc` | `db_<MST>` | Danh sách người phụ thuộc đăng ký giảm trừ gia cảnh TNCN, chặn trùng MST cho cùng 1 nhân viên (`@@unique([ma_nv, mst])`). |
| **Tài liệu & Hồ sơ** | `hrm_tai_lieu` | `db_<MST>` | Thông tin giấy tờ (CCCD, bằng cấp, chứng chỉ...) và liên kết 1-N tới bảng con `hrm_tai_lieu_file` lưu file scan trên Google Drive. |
| **File đính kèm** | `hrm_tai_lieu_file` | `db_<MST>` | Bảng con lưu nhiều file scan cho một giấy tờ (QĐ #21, tối đa 20 file/giấy tờ, mỗi file <= 10MB). |
| **Cấu hình mặc định** | `hrm_general_settings` | `db_<MST>` | Thiết lập tham số công chuẩn (FIXED_24, FIXED_26, ACTUAL_MONTH), tỷ lệ BHXH (32%), lương cơ sở (NĐ 73/2024: 2.34tr), trần BHXH, giảm trừ gia cảnh (NQ 954/2020: 11tr/4.4tr), **biểu thuế TNCN 7 bậc** JSONB (Điều 22 Luật Thuế TNCN — `khoang` là **ngưỡng trên lũy kế**, bậc cuối là bậc mở; BR-hrm-080, BR-hrm-081), hệ số tăng ca. Singleton `id = 'DEFAULT'`. ⚠️ Mã nguồn hiện còn nạp biểu 5 bậc sai luật — xem Mục 13. |
| **Ca làm việc** | `hrm_work_shifts` | `db_<MST>` | Danh mục ca làm việc, tự cấp mã duy nhất `CA01`..`CA99` (quét gap) hoặc nhập tay, tính `isOvernight` và `workingHours` tự động, cảnh báo vượt 12h/ngày, quản lý trạng thái `status` (`ACTIVE`/`INACTIVE`). |
| **Ngày lễ** | `hrm_holidays` | `db_<MST>` | Lịch ngày nghỉ lễ quốc gia, âm lịch, công ty & nghỉ bù (`NATIONAL`, `LUNAR`, `COMPANY`, `COMPENSATORY`), cờ lặp hàng năm `isAnnual` (khóa false cho âm lịch và nghỉ bù), nghỉ hưởng lương `isPaid`, chặn trùng ngày và tên sau khi trim `@@unique([date, name])`. Hỗ trợ tạo nhanh 11 ngày lễ chuẩn Điều 112 BLLĐ. |
| **Kỳ tính lương** *(2026-09-09, xem Mục 19)* | `hrm_payroll_periods` | `db_<MST>` | Vòng đời 6 trạng thái (`DRAFT→PENDING_REVIEW→LOCKED→APPROVED→PAID→ARCHIVED`), mã `code` duy nhất `YYYY-MM`. Neo toàn bộ 8 bảng biến động + bảng snapshot lương vào 1 kỳ. |
| **Chấm công theo kỳ** | `hrm_attendance_records` | `db_<MST>` | Mô hình "delta" — chỉ lưu ngày KHÁC lịch chuẩn (không có record = mặc định đủ công chuẩn). `@@unique([periodId, ma_nv, workDate])`. |
| **Tăng ca theo kỳ** | `hrm_overtime_records` | `db_<MST>` | 6 loại OT (150%–390%), snapshot `ratePercent` từ `GeneralSetting` tại thời điểm áp dụng. `@@unique([periodId, ma_nv, otType])`. |
| **Danh mục chỉ tiêu KPI** | `hrm_kpi_items` | `db_<MST>` | Mã tự sinh `KPI01`..`KPI99`, `defaultWeight`, `status` (RESTRICT xóa khi đã phát sinh dữ liệu). |
| **Đánh giá KPI theo kỳ** | `hrm_kpi_records` | `db_<MST>` | `completionRate = actualValue/targetValue*100`, bình quân có trọng số. `@@unique([periodId, ma_nv, kpiItemId])`. |
| **Thưởng theo kỳ** | `hrm_bonus_records` | `db_<MST>` | FK `salaryItemId` tái sử dụng `SalaryItem` loại `PERIODIC_BONUS` (không tạo danh mục riêng — ADR-001 Hybrid Catalog). `@@unique([periodId, ma_nv, salaryItemId])`. |
| **Danh mục sản phẩm khoán** | `hrm_piecework_products` | `db_<MST>` | Mã tự sinh `SP01`..`SP99`, `unitPrice` mặc định, `status`. |
| **Lương sản phẩm theo kỳ** | `hrm_piecework_records` | `db_<MST>` | `unitPrice` snapshot cố định theo kỳ (cho override thủ công), `totalAmount = round(unitPrice*quantity)`. `@@unique([periodId, ma_nv, productId])`. |
| **Lương phần trăm/hoa hồng theo kỳ** | `hrm_commission_records` | `db_<MST>` | FK `salaryItemId` tái sử dụng `SalaryItem` loại `COMMISSION_PERCENTAGE`; `commissionRate` snapshot từ `defaultRate`. `@@unique([periodId, ma_nv, salaryItemId])`. |
| **Danh mục lỗi chuyên cần** | `hrm_diligence_violation_types` | `db_<MST>` | Mã tự sinh `CC01`..`CC99`, 3 phương thức trừ (`theo_gio`/`theo_lan`/`mat_toan_bo`), `penaltyRate`. |
| **Vi phạm chuyên cần theo kỳ** | `hrm_diligence_records` | `db_<MST>` | Chặn trùng (nhân viên, loại lỗi, ngày). `@@unique([periodId, ma_nv, violationTypeId, violationDate])`. Đơn giá chuyên cần tra từ `EmployeeSalary` khoản loại `ATTENDANCE_ALLOWANCE`. |
| **Danh mục khoản ứng-bù trừ** | `hrm_salary_adjustment_items` | `db_<MST>` | Mã tự sinh `BT01`..`BT99`, chiều `tru`/`bu`. |
| **Chi tiết ứng-bù trừ theo kỳ** | `hrm_salary_adjustment_records` | `db_<MST>` | `amount` luôn dương, chiều lấy từ danh mục. `@@unique([periodId, ma_nv, adjustmentItemId])`. |
| **Bảng lương tổng hợp snapshot** | `hrm_payroll_sheet_lines` | `db_<MST>` | 18 cột đóng băng tại thời điểm `lock`, xóa-ghi-lại toàn bộ mỗi lần khóa sổ. `@@unique([periodId, ma_nv])`. |

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
  * `POST /tai-lieu/:id/file`: Tải file scan (ảnh/PDF <= 10MB) lên Google Drive của công ty (QĐ #21: thêm file vào bảng con).
  * `GET /tai-lieu/:id/file/:fileId`: Xem/tải file scan trực tiếp qua streaming backend.
  * `DELETE /tai-lieu/:id/file/:fileId`: Gỡ file scan trên Drive và xóa bản ghi con.
* **Cấu hình mặc định (`/settings/general`):**
  * `GET /settings/general`: Lấy cấu hình mặc định (Self-healing tự tạo mẫu nếu chưa có, hỗ trợ `FIXED_26`, `FIXED_24`, `ACTUAL_MONTH`, **biểu thuế TNCN 7 bậc** JSONB theo ngữ nghĩa ngưỡng trên lũy kế).
  * `PUT /settings/general`: Cập nhật cấu hình mặc định (chỉ `ADMIN`/`OWNER`; thẩm định giờ công 1.0–24.0h, lương cơ sở/vùng > 0, và **toàn vẹn biểu thuế**: tối thiểu 2 bậc `E-hrm-081` · ngưỡng lũy kế tăng nghiêm ngặt `E-hrm-080` · thuế suất tăng nghiêm ngặt `E-hrm-069` · bậc cuối là bậc mở `E-hrm-082`). Biểu lệch biểu chuẩn vẫn lưu được nhưng trả kèm `warning: "CANH_BAO_BIEU_THUE_LECH_CHUAN"` (BR-hrm-083). Ghi nhật ký kiểm toán (BR-hrm-066 nhóm 6).
  * `POST /settings/general/restore-default`: Khôi phục toàn bộ cấu hình chuẩn pháp luật VN (BLLĐ 2019, NĐ 73/2024, NĐ 74/2024, NQ 954/2020) — biểu thuế về đúng **7 bậc** Điều 22 Luật Thuế TNCN (BR-hrm-081). Ghi đè cả biểu công ty đã tự đặt, hộp xác nhận phải nêu rõ.
  * *Bổ sung của Architect 2026-09-08 (Mục 14, ADR-009):* mã thành công **200 cho cả ba** — `restore-default` **không** phải 201 · quyền **thực tế** là `OWNER`/`OWNER_EMPLOYEE` cho `GET` và **`OWNER` duy nhất** cho hai thao tác ghi (`ADMIN` bị `resolveTenantDb` chặn 403, xem ADR-007) · **20 cột `Decimal` đọc về là CHUỖI**, ghi lên là SỐ · **bậc mở của biểu thuế mã hóa `khoang: null`** · `GET` **ghi DB** ở lần gọi đầu đời tenant. Đặc tả đầy đủ: `architecture/api-contract.md` Mục 7D.0.
* **Ca làm việc (`/work-shifts`):**
  * `GET /work-shifts`: Danh sách ca làm việc (lọc theo `status`, tìm kiếm mã/tên ca, trả kèm `isOvernight` và `workingHours`).
  * `GET /work-shifts/:id`: Chi tiết một ca làm việc.
  * `POST /work-shifts`: Tạo ca làm việc mới (tự động cấp mã `CA01`-`CA99` quét gap trống hoặc nhập mã tùy chỉnh, tính `isOvernight` và `workingHours`, cảnh báo ca > 12h theo Điều 105 & 107 BLLĐ).
  * `PATCH /work-shifts/:id`: Cập nhật ca làm việc / đổi trạng thái `ACTIVE`/`INACTIVE` (bảo vệ không cho sửa `code`).
  * `DELETE /work-shifts/:id`: Xóa cứng ca làm việc (chặn nếu đã dùng trong phân ca hoặc chấm công).
  * *Bổ sung của Architect 2026-09-08 (Mục 14):* danh sách **có phân trang** — `data` là `{items,total,page,pageSize,totalPages}`, **không** phải mảng trần (khác 5 nhóm endpoint cũ) · cảnh báo ca > 12h là trường **`warning: "CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"`** ở cấp đối tượng ca, có ở cả 4 đường đọc, **chưa có trong mã** (`BE-02`) · `PATCH` gửi kèm `code` thì bị **bỏ qua im lặng**, trả 200 · nhánh chặn xóa 409 **chưa kích hoạt được** — hai bảng `hrm_work_schedules`/`hrm_attendances` chưa tồn tại, không FK nào trỏ tới `WorkShift`.
* **Lịch ngày lễ (`/holidays`):**
  * `GET /holidays`: Danh sách ngày lễ (lọc theo `year`, `filter`: `THIS_YEAR`/`ANNUAL`/`ALL`, `type`: `NATIONAL`/`LUNAR`/`COMPANY`/`COMPENSATORY`).
  * `GET /holidays/:id`: Chi tiết một ngày lễ.
  * `POST /holidays`: Tạo ngày lễ thủ công (cắt khoảng trắng thừa `.trim()`, khóa `isAnnual = false` cho `LUNAR` và `COMPENSATORY`, chống trùng ngày và tên).
  * `PATCH /holidays/:id`: Cập nhật thông tin ngày lễ.
  * `DELETE /holidays/:id`: Xóa ngày lễ.
  * `POST /holidays/quick-generate`: Tạo nhanh 11 ngày lễ chuẩn Việt Nam theo Điều 112 BLLĐ cho năm chỉ định từ 2024 đến 2030 (tra cứu âm lịch tĩnh, cơ chế idempotent `skipDuplicates`).
  * *Bổ sung của Architect 2026-09-08 (Mục 14):* **không có** route `POST /holidays/init-standard/:year` — chỉ `quick-generate`; mô tả cũ nêu hai tên là sai · `quick-generate` trả **200**, không phải 201 (ADR-009 QĐ 2) · danh sách **có phân trang** như `/work-shifts` · `date` đọc về là **chuỗi ISO đầy đủ** `"2026-01-01T00:00:00.000Z"`, **trừ** `items[].date` của `quick-generate` là `"2026-01-01"` · `type` **không bắt buộc**, mặc định `NATIONAL` · `isAnnual` với `LUNAR`/`COMPENSATORY` là **chặn 400**, không phải tự ép về `false` · 🔴 **`?isPaid=false` đang lọc ra đúng nhóm NGƯỢC LẠI** (`z.coerce.boolean` — `Boolean("false") === true`), giao diện **chưa được dựng bộ lọc này** cho tới khi xong `BE-03`.
* **Kỳ tính lương (`/payroll-periods`)** *(2026-09-09, xem Mục 19 — mã nguồn đã viết nhưng CHƯA qua Architect/QA/Code Review độc lập)*:
  * `GET /payroll-periods`, `POST /payroll-periods`, `GET /payroll-periods/:id`, `PATCH /payroll-periods/:id`, `DELETE /payroll-periods/:id` (chỉ khi `DRAFT`).
  * `POST .../submit` (`DRAFT→PENDING_REVIEW`) · `.../reject` (`→DRAFT`) · `.../lock` (`DRAFT` hoặc `PENDING_REVIEW→LOCKED`, chốt snapshot 18 cột) · `.../reopen` (`LOCKED→DRAFT`, lý do ≥20 ký tự) · `.../approve` (`→APPROVED`) · `.../mark-paid` (`→PAID`) · `.../archive` (`→ARCHIVED`).
  * 🔴 `reopen` **không có** role-guard ADMIN-only và **không** ghi audit log dù tài liệu đặc tả khẳng định có cả hai — xem `srs-du-lieu-tinh-luong.md` BR-dltl-002.
* **Danh mục chuyên biệt (`/payroll-catalogs`)**: 4 nhóm × CRUD (`kpi-items`, `products`, `diligence-types`, `adjustment-items`), mã tự sinh quét gap, RESTRICT xóa khi đã phát sinh dữ liệu.
* **8 phân hệ nhập liệu (`/payroll-data`)**: `attendance/matrix` (GET) + `attendance/cell` (PUT) · `overtime` (GET/apply/DELETE theo `ma_nv`) · `kpi` (GET/apply) · `bonus` (GET/apply) · `piecework` (GET/apply) · `commission` (GET/apply) · `diligence` (GET/record/DELETE theo `id`) · `adjustments` (GET/apply). Guard chung `assertPayrollPeriodWritable` chặn ghi khi kỳ ∈ {`LOCKED`,`APPROVED`,`PAID`,`ARCHIVED`} (`E-dltl-001`). 🟠 Thiếu `POST .../attendance/batch-override` mà đặc tả gốc có mô tả.
* **Bảng lương (`/payroll`)**: `GET /payroll/calculate` (preview thời gian thực) · `GET /payroll/sheet-lines` (DRAFT/PENDING_REVIEW trả preview động, LOCKED+ trả snapshot đóng băng). 🔴 **Không có** `GET /payroll/payslips/my` (phiếu lương cá nhân) dù đặc tả gốc liệt kê.
  * 🔴 **Frontend (`hdđt_maxv`) chưa nối API thật cho phần lõi**: cả 8 file `*Panel.tsx` (màn hình chính mỗi phân hệ) vẫn import từ `mock/hooks/*`, kể cả thanh lọc dùng chung `ThanhLocKyLuong.tsx`. Chỉ `KyLuongSelector`, `PayrollPeriodContext`, và dialog "Quản lý danh mục"/"Tái sử dụng" của 6/8 module đã nối thật. Chi tiết: `srs-du-lieu-tinh-luong.md` Mục 11.

---

## 4. Danh mục tài liệu tham chiếu & đối soát
1. `srs/hrm-spec.md`: Quy tắc nghiệp vụ chi tiết (Business Rules & Acceptance Criteria).
2. `srs/hrm-flows.md`: Sơ đồ quy trình nghiệp vụ (Flows & Sequences).
3. `srs/hrm-erd.md`: Sơ đồ quan hệ thực thể (ERD).
4. `architecture/api-contract.md`: Đặc tả chi tiết các request/response schema.
5. `architecture/data-model.md`: Cấu trúc bảng và chỉ mục cơ sở dữ liệu.
6. `architecture/dev-notes.md`: Hướng dẫn kỹ thuật và luồng xử lý mã nguồn.
7. `architecture/adr/`: Các quyết định kiến trúc cốt lõi (ADR-001…ADR-010). **ADR-010 (2026-09-10)**: thứ tự pipeline 10 bước tính thuế/bảo hiểm của Bảng lương tổng hợp — 8 quyết định kỹ thuật cho `BR-dltl-024…027`, kèm 3 câu hỏi còn mở (Q-1 🔴). **ADR-009 (2026-09-08)**: mã hóa bậc mở của biểu thuế bằng `khoang: null` · mã HTTP của thao tác ghi đè · kiểu `Decimal` trên đường truyền · trường `warning` của ca làm việc.
7b. `agents-architect/architect-contract-audit-2026-09-08.md`: Báo cáo đối soát hợp đồng ↔ mã nguồn ↔ client FE cho 14 endpoint cụm nền tảng, kèm danh sách giao việc `BE-01…11` và `FE-01…05`.
8. `qa/test-matrix.md` & `qa/test-cases.md`: Kịch bản và ca kiểm thử.
9. `qa/issues-and-bugs.md`: Danh mục phát hiện từ đợt đối soát 3 Amigos và các đầu việc cần cải tiến.
10. `agents-business-analyst/`: Biên bản thẩm định lại và chốt nghiệp vụ của Business Analyst (căn cứ, ma trận đánh đổi, đối soát chéo bốn tầng).
11. `backend-agents/`: Báo cáo triển khai mã nguồn của Backend Engineer.
12. `agents-tester-qa/`: Báo cáo thẩm định độc lập của Lead Tester-QA.
13. `du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md`: SRS chính thức phân hệ Dữ liệu tính lương (BR-dltl-001…023, Error Matrix E-dltl-001…026, AC-dltl-01…11, OQ-dltl-001…010) — xem Mục 19. `du_lieu_tinh_luong/BA_ANALYSIS_SPEC.md` là biên bản gap-analysis gốc (giữ làm vết lịch sử, không còn là SRS canonical).

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

---

## 11. QĐ #21 — Một giấy tờ giữ nhiều file scan (2026-09-08)

### 11.1. Vì sao đổi mô hình

Chủ dự án phát hiện khi dùng thật: căn cước có **hai mặt** nhưng mỗi dòng giấy tờ chỉ ôm được một file. Cách chữa đầu tiên — cho chọn nhiều file rồi **mỗi file thành một dòng** — bị bác bỏ ngay: danh sách hiện ra hai dòng cùng tên "CCCD", người đọc không phân biệt được đó là một giấy tờ hai mặt hay hai giấy tờ khác nhau. **Sai bản chất nghiệp vụ**, không phải sai giao diện.

**QĐ #21: bốn cột con trỏ file trên `hrm_tai_lieu` chuyển thành bảng con `hrm_tai_lieu_file`.** Một giấy tờ giữ tối đa 20 file; mỗi file vẫn ≤ 10MB.

### 11.2. Đã làm

| Tầng | Nội dung |
|:---|:---|
| Đặc tả | Viết lại BR-hrm-037 (thêm vào, không thay thế) · BR-hrm-038 (gỡ đích danh) · BR-hrm-039 (xóa dòng thì xóa mọi file) · FR-hrm-026/031/033 · thực thể mới Mục 4.7 · hai mã lỗi E-hrm-065, E-hrm-066 |
| Thiết kế | `data-model.md` **M-14** — bảng con, và **trình tự bốn bước bắt buộc** để không mất dữ liệu |
| Hợp đồng | `api-contract.md` Mục 6.1 (mảng `files`), 7.6 (thêm file + trần 20), 7.7 và 7.8 (đường dẫn thêm `:fileId`) |
| Backend | Model mới, script chuyển dữ liệu `hrm:chuyen-file`, service/controller/route/validator, 16 ca kiểm thử mới |
| Giao diện | Gỡ bỏ cách làm sai; chọn nhiều file gắn vào **cùng một** dòng; component `DanhSachFileScan` hiện file lồng trong hàng giấy tờ |

### 11.3. Migration đã chạy và đối soát

Trình tự M-14, chạy trên môi trường phát triển:

| Bước | Kết quả |
|:---|:---|
| 1. `sync:tenants` — tạo bảng con, **giữ nguyên** bốn cột cũ | 10/10 tenant, 0 lỗi |
| 2. `hrm:chuyen-file -- --thu` — chạy thử, không ghi | 10/10 tenant, 0 còn thiếu |
| 3. `hrm:chuyen-file` — chuyển thật | 3 dòng chèn mới |
| 4. **Đối soát** | **nguồn 3 = đích 3**, 0 tenant lệch; nội dung giữ nguyên (`kol_photo.jpg`, `mau_2.png` đủ tên/kiểu/dung lượng) |

**Bốn cột cũ vẫn nằm nguyên trong `hrm_tai_lieu`** làm lưới an toàn — mã nguồn không còn đọc và không còn ghi chúng. Việc bỏ cột là **thao tác riêng của đợt sau**, chỉ làm khi đối soát vẫn khớp.

> **Một ghi nhận về số liệu.** Lần đo đầu thấy 6 dòng có file, lúc chạy migration chỉ còn 3. Nguyên nhân là **chủ dự án đang thử tay trên giao diện** giữa hai lần đo — hai dòng còn lại ở một tenant đều là `loai=cccd` với con trỏ file rỗng, đúng thứ sinh ra khi thử cách làm sai. `db push` với cột còn nguyên không thể làm rỗng giá trị cột, nên đây **không phải mất dữ liệu do lệnh migration**.

### 11.4. Đợt này cũng sửa lại tài liệu bị lệch

Frontend đối chiếu hợp đồng với mã nguồn và bắt được **6 điểm lệch trong tài liệu**, đều đã sửa: tiêu đề Mục 7.7 thiếu `:fileId` · đoạn "Luồng" Mục 7.6 còn tả hành vi thay-thế cũ · bảng lỗi 7.6 thiếu E-hrm-065 · bảng idempotency còn ghi "ghi đè" · FR-hrm-031 và FR-hrm-033 viết theo mô hình cũ · FR-hrm-026 và một tiêu chí nghiệm thu còn nhắc "bốn trường con trỏ".

Đối soát cuối: **279 ID định danh, không ID nào treo**; không còn chỗ nào mô tả bốn cột cũ như đang dùng.

### 11.5. Còn nợ

1. ✅ **Bỏ bốn cột cũ — ĐÃ XONG ngày 2026-09-08.** Chủ dự án chạy thử tay xong; đối soát lại vẫn khớp (đích 6 > nguồn 3, vì đã đính thêm file mới qua giao diện mới — bằng chứng mô hình mới hoạt động). Sao lưu dữ liệu 4 cột ra `be_maxv/sao-luu-4-cot-truoc-khi-xoa.json` rồi mới bỏ. Kết quả: **4 cột đã xóa trên 10/10 tenant, 6 dòng file nguyên vẹn**. Script `hrm:chuyen-file` chuyển sang SQL thuần để **production vẫn dùng được** khi tới lượt.
2. **Chưa chạy thử runtime toàn bộ.** Bốn ca cần kiểm tay: thêm căn cước hai mặt phải ra **một** dòng hai file · đóng cửa sổ đăng nhập Google giữa chừng rồi bấm lại phải làm tiếp từ chỗ hỏng, không sinh dòng thứ hai · gỡ từng file · xóa dòng có file thì xác nhận nêu đúng số file.
3. ✅ **Bộ ca kiểm thử — ĐÃ CẬP NHẬT ngày 2026-09-08.** Sửa **19 ca** viết theo mô hình một-file-một-dòng và thêm nhóm **6B.14** gồm 12 ca mới (TC-hrm-261…272). Tổng **278 ca**. `test-matrix.md` cập nhật ba dòng endpoint file theo đường dẫn mới.

Ba ca đảo ngược kỳ vọng cũ, đáng chú ý vì chạy nguyên bản cũ sẽ báo sai:
* **TC-hrm-131** — tải file lên dòng đã có file: trước kỳ vọng *thay thế*, nay là *thêm vào*.
* **TC-hrm-149** — hai lượt tải đồng thời: trước là **lỗi** (BUG-HRM-16, sinh file mồ côi), nay là **hành vi hợp lệ** cho hai file. Điểm cần canh chuyển sang `thu_tu` trùng nhau.
* **TC-hrm-127 / 224** — xóa dòng giấy tờ: nay phải xóa **mọi** file chứ không phải một, và TC-hrm-225 thêm yêu cầu lỗi ở file giữa **không được dừng cả vòng lặp**.
4. Trần 20 file là pre-check ở tầng ứng dụng, **không có ràng buộc ở cơ sở dữ liệu** — hai lượt tải đồng thời vẫn vượt được. Cùng lớp bài toán với `so_hd` và chồng lấn hợp đồng.

### 11.6. Đo được: `db push` KHÔNG xóa ràng buộc loại trừ

Câu hỏi treo từ BUG-HRM-30 — *"chưa ai đo xem `prisma db push` có xóa ràng buộc tạo tay không"* — nay đã có câu trả lời từ chính đợt bỏ cột này. Sau `sync:tenants`, **cả hai ràng buộc loại trừ còn nguyên trên 10/10 tenant**. Lý do: Prisma không mô tả được `EXCLUDE` nên không quản lý, và không drop thứ nó không biết.

⚠️ **Chỉ đúng cho `EXCLUDE`.** Index và unique constraint thì Prisma **có** quản lý theo schema — vẫn phải chạy lại `npm run hrm:constraints` sau mỗi `sync:tenants` như runbook đã ghi.

---

## 12. Đặc tả nghiệp vụ cụm tính năng nền tảng: Cấu hình mặc định, Ca làm việc, Lịch ngày lễ (2026-09-08)

### 12.1. Bối cảnh & Mục tiêu
Để hoàn thiện nền tảng tính công và tính lương tự động cho phân hệ HRM (chuẩn bị cho các module chấm công và bảng lương), ba thực thể nền tảng quản trị đã được phân tích và đặc tả nghiệp vụ chi tiết (tham chiếu `docs/nestjs/hr/` và kế hoạch chuyển đổi `implementation_plan.md`):
1. **Cấu hình mặc định (`hrm_general_settings`)**: Lưu trữ Singleton `DEFAULT` với 30+ tham số công chuẩn, lương cơ sở 2.340.000đ (NĐ 73/2024), lương tối thiểu Vùng 1 4.960.000đ (NĐ 74/2024), mức trần đóng BHXH/BHTN, giảm trừ gia cảnh thuế TNCN 11tr / 4.4tr (NQ 954/2020), biểu thuế lũy tiến từng phần 7 bậc (JSONB), tỷ lệ đóng BHXH 32% (DN 21.5% - NLĐ 10.5%), hệ số tăng ca và phụ cấp làm đêm. Có cơ chế tự sinh mẫu (Self-healing) và khôi phục mặc định.
2. **Ca làm việc (`hrm_work_shifts`)**: Danh mục ca làm việc, tự cấp mã duy nhất `CA01`-`CA99` (quét lỗ trống gap scanning), tự động nhận diện ca qua đêm `isOvernight` (`endTime < startTime`) và tính giờ công chuẩn `workingHours` = `(endTime - startTime) - breakMinutes`. Quản lý trạng thái `isActive` (ACTIVE / INACTIVE).
3. **Lịch ngày lễ (`hrm_holidays`)**: Quản trị ngày nghỉ lễ tết quốc gia và nội bộ, cờ lặp hàng năm `isAnnual`, nghỉ hưởng nguyên lương `isPaid` (Điều 112 BLLĐ 2019), ràng buộc chống trùng `@@unique([date, name])`. Hỗ trợ tiện ích "Tạo nhanh 11 ngày lễ chuẩn Việt Nam" (`init-standard`) với thuật toán tra cứu âm lịch cho các năm từ 2024 đến 2030, hỗ trợ cơ chế idempotent `skipDuplicates`.

### 12.2. Chi tiết kết quả đặc tả của Business Analyst (BA)
Toàn bộ tài liệu SRS đã được cập nhật đồng bộ, liên tục chuỗi ID không xung đột:

| Tài liệu | Các hạng mục bổ sung / cập nhật |
|---|---|
| `docs/hrm/srs/hrm-spec.md` | • RBAC Matrix mở rộng cho 3 thực thể (siết `PUT/restore` của GeneralSetting cho `ADMIN`/`OWNER`).<br>• Đặc tả 3 thực thể & thuộc tính (Mục 4.8, 4.9, 4.10).<br>• 10 Quy tắc nghiệp vụ mới: `BR-hrm-070` đến `BR-hrm-079` (tổng 79 BR).<br>• Mở rộng `BR-hrm-066` nhóm 6 (Audit logging cho Cấu hình).<br>• 10 Yêu cầu chức năng mới: `FR-hrm-045` đến `FR-hrm-054` (tổng 54 FR).<br>• 13 Mã lỗi nghiệp vụ chuẩn hóa: `E-hrm-067` đến `E-hrm-079` (tổng 79 mã lỗi).<br>• 5 Use Cases: `UC-hrm-18` đến `UC-hrm-22` (tổng 22 UC).<br>• 10 Tiêu chí nghiệm thu (Given/When/Then): `AC-hrm-57` đến `AC-hrm-66` (tổng 66 AC).<br>• 4 Giả định mới: `A-hrm-11` đến `A-hrm-14`.<br>• Cập nhật Ma trận truy vết nghiệp vụ (Mục 13). |
| `docs/hrm/srs/hrm-flows.md` | • Sơ đồ tuần tự: Xem, Cập nhật Thiết lập chung & Khôi phục cấu hình chuẩn (Self-healing, Draft mode, Batch validation, RBAC guard).<br>• Sơ đồ luồng: Quản lý Ca làm việc (Gap scanning mã `CA01`-`CA99`, tính `isOvernight` và `workingHours`).<br>• Sơ đồ luồng: Quản lý Lịch ngày lễ & Tạo nhanh 11 ngày lễ chuẩn VN theo Điều 112 BLLĐ (Tra cứu âm lịch 2024-2030, idempotent `skipDuplicates`). |
| `docs/hrm/srs/hrm-states.md` | • Vòng đời Ca làm việc `WorkShift`: Khởi tạo -> `ACTIVE` ↔ `INACTIVE` -> Xóa cứng `Deleted` (kèm chặn xóa `E-hrm-073`).<br>• Vòng đời Cấu hình `GeneralSetting`: `Saved` (Persisted) ↔ `Draft` (Form UI nháp) -> `Saved` / `Restored` (Khôi phục chuẩn).<br>• Bổ sung dòng thực thể `Ngày lễ (Holiday)` vào danh mục vòng đời tồn tại/xóa cứng. |
| `docs/hrm/srs/hrm-erd.md` | • Cập nhật bảng không gian lưu trữ: Bổ sung 3 bảng nền tảng vào DB tenant.<br>• Mermaid `erDiagram`: Thêm 3 entities `HRM_GENERAL_SETTINGS`, `HRM_WORK_SHIFTS`, `HRM_HOLIDAYS` và bảng con `HRM_TAI_LIEU_FILE` kèm thuộc tính và kiểu dữ liệu.<br>• Ràng buộc toàn vẹn schema: Singleton `id = 'DEFAULT'`, unique `code`, unique `[date, name]`.<br>• 3 ghi chú thiết kế kỹ thuật mới (Singleton, tính toán giờ công động, lịch âm/dương). |
| `docs/hrm/CONTEXT_SUMMARY.md` | • Cập nhật Mục 1 (tiến độ phân hệ).<br>• Cập nhật Mục 2 (Bounded Context: 3 thực thể mới + `hrm_tai_lieu_file`).<br>• Cập nhật Mục 3 (Danh mục 14 Endpoints API mới).<br>• Bổ sung Mục 12 (Tổng kết đợt đặc tả nghiệp vụ nền tảng, thiết kế kiểm thử Phase A & BA Sign-off). |
| `docs/hrm/qa/test-matrix.md` | • Cập nhật ma trận bao phủ kiểm thử cho 3 thực thể mới (nâng tổng số ca thiết kế từ 185 lên 298).<br>• Ánh xạ toàn diện ma trận truy vết: `BR-hrm-070…079`, `FR-hrm-045…054`, `AC-hrm-57…66`, `E-hrm-067…079`.<br>• Bổ sung 14 endpoints mới (#30 đến #43) vào Ma trận Endpoint × Loại kiểm thử.<br>• Cập nhật ma trận rủi ro với 6 rủi ro nền tảng mới. |
| `docs/hrm/qa/test-cases.md` | • Bổ sung trọn vẹn Mục 7 gồm **55 ca kiểm thử chi tiết (`TC-hrm-273` đến `TC-hrm-327`)**.<br>• Phủ 100% Happy path cho 14 API endpoints mới.<br>• Kiểm thử giá trị biên: giờ công chuẩn (1.0h, 24.0h pass; 0.9h, 24.1h fail `E-hrm-067`), lương cơ sở $\le 0$ (`E-hrm-068`), biểu thuế TNCN không tăng dần (`E-hrm-069`).<br>• Ca làm việc đặc thù: ca qua đêm (`endTime <= startTime`), ca trực 24h, ca qua mốc 00:00, giờ công sau trừ nghỉ $\le 0$ (`E-hrm-072`), mã ca bất biến, gap scanning tự sinh mã.<br>• Lịch ngày lễ: chặn trùng ngày + tên (`E-hrm-076`), chặn lễ âm lịch lặp hàng năm (`E-hrm-075`), tạo nhanh 11 ngày lễ chuẩn VN 2024-2030, tính idempotent (`skipDuplicates`).<br>• Bảo mật & RBAC: chặn `OWNER_EMPLOYEE` gọi `PUT /settings/general` và `POST /restore-default` (`E-hrm-077` 403 Forbidden). |
| `docs/hrm/qa/issues-and-bugs.md` | • Bổ sung Mục 10 gồm **6 phát hiện phản biện sâu** (`BUG-HRM-44`…`BUG-HRM-49` / `ISSUE-HRM-08`…`ISSUE-HRM-13`) từ vòng rà soát Shift-Left Phase A: thiếu audit logging cấu hình mặc định, khoảng trống vượt trần 99 ca làm việc, rủi ro hồi tố bảng lương do thiếu versioning, trần 12h ca làm việc theo BLLĐ, hạn bảng tra âm lịch 2030 và khoảng trắng tên ngày lễ. |

### 12.3. Biên bản chốt BA Final Sign-off & Đóng 6 phát hiện phản biện QA (2026-09-08)

Ngày 2026-09-08, Senior Business Analyst (`phamvinh203`) đã chính thức phê duyệt Biên bản chốt [BA Final Sign-off](file:///c:/Users/Admin/Desktop/maxv_v2/docs/hrm-ba-signoff-2026-09-08.md) cho toàn bộ Cụm tính năng nền tảng (Cấu hình mặc định, Ca làm việc, Lịch ngày lễ), mở cổng **Phase 2.5 (`Ready for Implementation`)**.

**Tóm tắt kết quả xử lý 6 phát hiện phản biện từ Lead Tester-QA:**
1. **BUG-HRM-44 (Audit Logging)**: Thêm nhóm 6 vào `BR-hrm-066`, `FR-hrm-043/046/047` và `NFR-hrm-011` bắt buộc ghi nhật ký kiểm toán cho thao tác cập nhật cấu hình và khôi phục cấu hình mặc định toàn công ty.
2. **BUG-HRM-45 (Trần 99 ca làm việc)**: `BR-hrm-074`, `FR-hrm-048`, `E-hrm-078`, `AC-hrm-64` quy định thuật toán gap scanning tự sinh `CA01`–`CA99`; khi hết dải sẽ trả lỗi 400 `E-hrm-078`, đồng thời cho phép người dùng tự nhập mã tùy ý (`CA100`, `CA_VIP`).
3. **BUG-HRM-46 (Rủi ro hồi tố bảng lương)**: `BR-hrm-070` và `FR-hrm-046` xác lập nguyên tắc Payroll Snapshot Principle — bảng lương khi chốt kỳ bắt buộc lưu bản sao tĩnh toàn bộ tham số pháp lý và tỷ lệ bảo hiểm tại thời điểm chốt, cấm truy vấn động ngược lại `hrm_general_settings`.
4. **BUG-HRM-47 (Cảnh báo ca làm việc > 12h)**: `BR-hrm-076`, `FR-hrm-048`, `AC-hrm-63` cho phép tạo ca làm việc đặc thù (y tế, bảo vệ, cứu hỏa trực 24h) nhưng trả kèm cảnh báo `warning: "CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"` để giao diện hiển thị cảnh báo vi phạm trần giờ làm việc theo Điều 105 & 107 BLLĐ 2019.
5. **BUG-HRM-48 (Hạn bảng tra âm lịch 2030)**: `BR-hrm-079`, `FR-hrm-054`, `E-hrm-079`, `AC-hrm-66` xác thực năm tạo nhanh nằm trong dải 2024–2030 (ngoài dải trả 400 `E-hrm-079`); đồng thời ghi nhận Nợ kỹ thuật `TD-HRM-01`. ⚠️ **Nội dung nợ này đã đổi (2026-09-08):** bảng tra chép tay đã được thay bằng thuật toán âm lịch nên phần *"tích hợp thư viện thiên văn"* **không còn nghĩa**; nợ nay là ***quyết định có mở dải năm 2024–2030 hay không***, hạn chót **31/12/2030**. Xem `hrm-spec.md` `BR-hrm-079` và `OQ-hrm-37`.
6. **BUG-HRM-49 (Khoảng trắng tên ngày lễ)**: `BR-hrm-078`, `FR-hrm-051`, `AC-hrm-65` bắt buộc `.trim()` tên ngày lễ ở Zod validator và service trước khi kiểm tra unique `[date, name]`.

**Trạng thái triển khai:**
- **Backend & Frontend**: Được phép khởi chạy lập trình ngay lập tức dựa trên đặc tả SRS `hrm-spec.md`, hợp đồng API `api-contract.md` và migration `data-model.md` M-15.
- **QA**: 55 ca kiểm thử (`TC-hrm-273`…`327`) sẵn sàng thực thi nghiệm thu Phase B ngay khi có bản build mã nguồn đầu tiên.


> ⚠️ **Mục 12.3 đã bị thay thế một phần bởi Mục 13.** Phần xử lý 6 phát hiện `BUG-HRM-44`…`BUG-HRM-49` vẫn đúng và giữ hiệu lực. Phần tuyên bố `Ready for Implementation` và phần "55 ca sẵn sàng nghiệm thu" thì không còn phản ánh đúng thực tế — đọc Mục 13 trước khi dùng.

---

## 13. Đợt thẩm định lại cụm nền tảng: biểu thuế TNCN sai luật (2026-09-08)

**Biên bản đầy đủ:** `docs/hrm/agents-business-analyst/ba-reconciliation-report-2026-09-08.md`
**Thay thế:** phần liên quan của `docs/hrm-ba-signoff-2026-09-08.md` và kết luận "PASSED 55/55" của `docs/hrm/agents-tester-qa/qa-verification-report-2026-09-08.md`.

### 13.1. Vì sao phải chạy lại

Đợt trước đi đủ chuỗi BA → Architect ∥ QA → BA sign-off → Backend → QA và kết thúc bằng hai văn bản tuyên bố hoàn tất. Nhưng khi đọc **song song bốn nguồn** — đặc tả, hợp đồng API, mã máy chủ, mã giao diện — thì bốn nguồn nói bốn chuyện khác nhau về cùng một trường dữ liệu. **Một quy trình chạy đủ bước vẫn ra kết quả sai nếu không ai đối chiếu số liệu cụ thể giữa các tầng.**

| Nguồn | Nói gì về biểu thuế TNCN |
|:---|:---|
| `srs/hrm-spec.md` Mục 4.8 | **7 bậc**, viện dẫn Điều 22 Luật Thuế TNCN |
| `srs/hrm-spec.md` Mục 14, giả định `A-hrm-12` | "nạp **biểu 5 bậc rút gọn**" — **tự mâu thuẫn với Mục 4.8 của chính nó** |
| `architecture/api-contract.md` (3 chỗ) | **5 bậc**, cao nhất 25% |
| `be_maxv/.../generalSettings.service.ts` | **5 bậc**, cao nhất 25% |
| `hdđt_maxv/.../cauHinhQueries.ts` | **5 bậc**, nhưng con số mang **nghĩa khác hẳn** máy chủ |

### 13.2. Bốn quyết định đã chốt

| # | Quyết định | Chốt | Hệ quả |
|:--:|:---|:---|:---|
| **22** | Biểu thuế TNCN mặc định: giữ 5 bậc hay sửa thành 7 bậc? | **7 bậc theo Điều 22 Luật Thuế TNCN**, vẫn cho công ty tự chỉnh nhưng có hàng rào toàn vẹn và cảnh báo khi lệch chuẩn | `BR-hrm-081`, `BR-hrm-083`, `FR-hrm-055`. **Không cần di trú lược đồ** (`taxBrackets` là JSONB) |
| **23** | Ngưỡng lũy kế của bậc 5 và bậc 6 trong đặc tả có đúng không? | **Đúng** — `52.000.000` và `80.000.000` giữ nguyên. Đã kiểm chéo với biểu năm (624tr và 960tr = 12 lần ngưỡng tháng) | Bổ sung bảng 7 bậc đầy đủ kèm cột đối chiếu theo năm vào `hrm-spec.md` Mục 4.8 |
| **24** | `khoang` mang nghĩa ngưỡng lũy kế hay độ rộng bậc? | **Ngưỡng trên lũy kế — một nghĩa duy nhất trên toàn tuyến** (lưu trữ · API · ô nhập). Cấm quy đổi ngầm; hai hàm quy đổi ở giao diện bị bãi bỏ | `BR-hrm-080`. Độ rộng bậc chỉ được hiện dạng **cột phái sinh chỉ-đọc** |
| **25** | Hàng rào toàn vẹn biểu thuế (phát sinh khi thẩm định) | **Bốn điều kiện cứng**: ≥ 2 bậc · ngưỡng lũy kế tăng nghiêm ngặt · thuế suất tăng nghiêm ngặt · bậc cuối là bậc mở | `BR-hrm-082`, 3 mã lỗi mới `E-hrm-080/081/082` |

### 13.3. Hậu quả nghiệp vụ đo được của biểu 5 bậc

**Ngưỡng phân kỳ: 52.000.000đ thu nhập tính thuế/tháng.** Từ mốc đó trở xuống hai biểu cho kết quả **giống hệt nhau**; chênh lệch chỉ phát sinh phía trên.

| Thu nhập tính thuế/tháng | Đúng luật (7 bậc) | Biểu trong mã (5 bậc) | Chênh |
|---:|---:|---:|---:|
| 52.000.000 | 9.750.000 | 9.750.000 | 0 |
| 60.000.000 | 12.150.000 | 11.750.000 | thiếu 400.000 |
| 100.000.000 | 25.150.000 | 21.750.000 | **thiếu 3.400.000 (13,5%)** |

Doanh nghiệp chi trả là bên có nghĩa vụ khấu trừ, nên **doanh nghiệp** chịu truy thu và tiền chậm nộp — không phải người lao động. Sai này **không lộ ra khi dùng**: mọi con số vẫn hiện đẹp, chỉ số thuế là thấp hơn mức phải nộp.

> Bản 5 bậc trong mã **không phải** "biểu rút gọn theo dự thảo". Các phương án rút gọn số bậc từng được bàn đều **giữ trần 35%**; bản trong mã hạ trần xuống 25% nên không tương ứng với bất kỳ biểu thuế nào — đang có hiệu lực hay đang được bàn.

### 13.4. Nợ kiểm thử — nghiệm thu đợt trước không có bằng chứng chạy thật

Báo cáo QA tuyên bố **PASS 55/55**, nhưng phần bằng chứng chỉ có **12 ca kiểm thử đơn vị thuần logic** (hàm thẩm định · hàm tính giờ công · hàm tra ngày lễ). **Chưa một endpoint HTTP nào của cụm này được gọi thật.** 55 dòng "kết quả thực tế" là đọc mã tĩnh rồi suy luận.

Đây không phải chuyện hình thức: `BUG-HRM-42` ở đợt P0 (kịch bản vận hành không chạy lại được lần hai) **chỉ lộ ra khi chạy thật** — đọc mã tĩnh thấy phần bắt lỗi hoàn toàn hợp lý. Nợ dựng khung kiểm thử tích hợp đã ghi từ Mục 10.6 và vẫn còn nguyên.

### 13.5. Việc phải làm, theo vai

| Vai | Việc |
|:---|:---|
| **Architect** | Sửa 3 chỗ ví dụ biểu thuế trong `api-contract.md` sang 7 bậc · **chốt và ghi đúng một lần cách mã hóa "bậc mở"** (điểm mà bốn tầng đang tự đoán mỗi tầng một kiểu) · ghi rõ ngữ nghĩa `khoang` tại mô tả trường · thêm `E-hrm-080/081/082` và trường `warning` vào phản hồi `PUT` · thiết kế hình thức kỹ thuật cho `FR-hrm-055` · ghi ADR cho quyết định "cho chỉnh nhưng có hàng rào và cảnh báo" |
| **Backend** | Đổi bộ mặc định sang **7 bậc** (kể cả docblock đang ghi sai) · thêm **ba phép kiểm** ngưỡng/số bậc/bậc mở · thêm cảnh báo `CANH_BAO_BIEU_THUE_LECH_CHUAN` · ghi nhật ký kiểm toán cho cập nhật và khôi phục · dựng thao tác chuẩn hóa `FR-hrm-055` (chỉ ghi đè khi trùng khớp nguyên văn biểu cũ) · bỏ mọi giả định "biểu luôn có 5 bậc" |
| **Frontend** | **Xóa hai hàm quy đổi** ngưỡng ↔ độ rộng · ô nhập mang nghĩa **ngưỡng lũy kế** · **nới màn hình từ 5 bậc cứng lên N bậc** (mảng nhãn hiện có đúng 5 phần tử và được dùng làm khóa danh sách) · sửa giá trị hiển thị tạm sang 7 bậc · hiện dải cảnh báo lệch chuẩn · hộp xác nhận khôi phục nêu rõ ghi đè cả biểu công ty tự đặt |
| **Tester-QA** | Thu hồi nhãn "PASSED 55/55", ghi lại đúng mức bằng chứng · thêm ca cho `AC-hrm-67`…`72` (`AC-hrm-67` và `AC-hrm-68` **sẽ FAIL trên mã hiện tại** — đó là mục đích) · rà lại ca cũ nêu đích danh biểu 5 bậc · dựng khung kiểm thử tích hợp gọi endpoint thật |

> **Thứ tự bắt buộc cho mục tiêu "màn `cau_hinh_mac_dinh` chạy thật":** nối API mà giữ nguyên quy ước độ rộng bậc thì số hiện trên màn hình sẽ sai ngay lần tải đầu tiên. Bốn việc đầu của Frontend là điều kiện cần, không phải việc dọn dẹp làm sau.

### 13.6. Câu hỏi mở phát sinh — không chặn cụm tính năng này

| ID | Câu hỏi | Ai trả lời |
|:---|:---|:---|
| `OQ-hrm-34` | Quyết toán thuế TNCN theo năm: suy ngưỡng năm bằng 12 lần ngưỡng tháng, hay khai riêng một biểu năm? | Kế toán trưởng |
| `OQ-hrm-35` | Biểu thuế có cần trường "áp dụng từ ngày" để chạy lại một kỳ lương đã chốt bằng đúng biểu của kỳ đó không? | Kế toán trưởng |

### 13.7. Phạm vi bằng chứng của chính đợt này

**Đã kiểm trực tiếp:** bốn nguồn ở Mục 13.1 đều được mở và đọc, không dựa vào mô tả của tài liệu khác · mọi con số thuế ở Mục 13.3 tính tay theo phương pháp lũy tiến từng phần · phép kiểm chéo tháng — năm khớp cả bảy bậc · khoảng trống của tầng thẩm định dữ liệu xác định bằng đọc trực tiếp mã · ràng buộc "màn hình cứng 5 bậc" xác định bằng đọc mảng nhãn và cách nó được dùng làm khóa danh sách.

**Chưa kiểm, và không tuyên bố:** chưa gọi bất kỳ endpoint nào (nên đợt này **không phải** một lần nghiệm thu) · chưa truy vấn cơ sở dữ liệu để đếm bao nhiêu công ty đang giữ biểu 5 bậc — con số thật là đầu ra của chế độ rà soát ở `FR-hrm-055` · chưa đánh giá tác động ngoài HRM, vì phân hệ Lương chưa tồn tại nên hiện chưa có nơi nào tiêu thụ biểu thuế này để tính tiền. Đó vừa là lý do đợt sửa còn rẻ, vừa là lý do phải sửa ngay bây giờ.

---

## 14. Đối soát hợp đồng API ↔ mã nguồn — cụm nền tảng (Architect, 2026-09-08)

**Báo cáo đầy đủ:** `docs/hrm/agents-architect/architect-contract-audit-2026-09-08.md`
**Quyết định kiến trúc:** `docs/hrm/architecture/adr/ADR-009-doi-soat-hop-dong-va-lop-chuyen-doi-fe.md`

### 14.1. Vì sao chạy

Backend đã code xong ba thực thể nền tảng, Frontend đã dựng lớp gọi API nhưng **chưa nối vào
component nào**. Nghĩa là hợp đồng API **chưa từng được kiểm chứng bằng một lời gọi thật**. Đợt
này soi ba tầng cùng lúc — `api-contract.md` ↔ `be_maxv/src/**` ↔ `hdđt_maxv/src/features/hrm/api/**`
— cho đủ 14 endpoint, trên 8 tiêu chí mỗi endpoint (method · path · query · body · mã thành công ·
hình dạng phản hồi kể cả envelope · danh mục mã lỗi · phân trang/lọc/sắp xếp).

**Kết quả: 14/14 endpoint đều có ít nhất một điểm hợp đồng ghi sai.** Hợp đồng đã được sửa cho
khớp mã nguồn ở những chỗ mã nguồn đúng, và ghi rõ "mã nguồn phải sửa" ở những chỗ hợp đồng đúng
hơn.

### 14.2. Bốn quyết định kiến trúc (ADR-009)

| # | Quyết định | Thay cho |
|:--:|:---|:---|
| 1 | **Bậc mở của biểu thuế mã hóa bằng `khoang: null`**, chỉ ở phần tử cuối và bắt buộc ở phần tử cuối. Kèm cửa sổ tương thích có hạn: chiều ghi nhận cả mốc `999999999999` rồi chuẩn hóa về `null`; đóng cửa sổ khi `FR-hrm-055` chạy xong | `srs/hrm-spec.md` Mục 4.8 giao lại nguyên văn cho Architect. Mốc `999999999999` làm điều kiện 4 của `BR-hrm-082` thành phép so với hằng số ma thuật, và bản thân mốc là số hữu hạn nên vẫn để hở khoảng thu nhập |
| 2 | **`POST /settings/general/restore-default` và `POST /holidays/quick-generate` trả 200**, không phải 201. Luật mới: *201 chỉ khi thân phản hồi CHÍNH LÀ tài nguyên vừa tạo* | Luật cũ "mọi POST là 201". Hai thao tác này ghi đè / idempotent, có thể tạo 0 bản ghi. QA đã viết 200 sẵn — **không phải sửa ca kiểm thử nào**. Frontend không bị ảnh hưởng (`http.ts` chỉ xét `res.ok`) |
| 3 | **20 cột `Decimal` đọc về là CHUỖI, ghi lên là SỐ.** Bất đối xứng có chủ ý, bám khuôn mẫu `hopDongApi.ts` đã có | Giữ chính xác trên dữ liệu tiền. Ép về `number` ở Backend là đưa tiền qua dấu phẩy động và dựng khuôn mẫu thứ hai trong cùng module |
| 4 | **`warning` ca > 12h do Backend sinh** trong hàm dùng chung `ganThuocTinhSuyRa` ⇒ có mặt ở cả 4 đường đọc. Là mã máy đọc được; `<= 12h` thì bỏ hẳn trường; không đổi mã HTTP | Đặc tả BA yêu cầu (`BUG-HRM-47`), Frontend đã khai đúng, chỉ hợp đồng và mã nguồn thiếu |

### 14.3. Quan hệ với đợt thẩm định của BA (Mục 13)

Hai đợt chạy **song song trong cùng ngày**. Bản nháp đầu của Architect chốt "lớp quy đổi biểu
thuế nằm ở Frontend" — **sai thẩm quyền và đã được rút lại** sau khi đọc Mục 13: BA đã chốt QĐ
#24 (`BR-hrm-080`) bãi bỏ lớp quy đổi đó. Ranh giới cuối cùng:

* **BA chốt (Architect thi hành, không diễn giải lại):** 7 bậc (`BR-hrm-081`) · `khoang` là
  ngưỡng trên lũy kế, một nghĩa duy nhất toàn tuyến (`BR-hrm-080`) · 4 điều kiện toàn vẹn + 3 mã
  lỗi `E-hrm-080/081/082` (`BR-hrm-082`) · cảnh báo `CANH_BAO_BIEU_THUE_LECH_CHUAN` (`BR-hrm-083`)
  · thao tác chuẩn hóa dữ liệu cũ (`FR-hrm-055`).
* **BA giao lại cho Architect:** cách mã hóa "không có ngưỡng trên" → trả lời ở ADR-009 QĐ 1,
  ghi **đúng một lần** ở `api-contract.md` Mục 7D.0 (b).

**Biểu thuế nay chỉ còn MỘT chỗ định nghĩa** trong toàn bộ tài liệu kiến trúc:
`api-contract.md` Mục 7D.0 (c). Ba chỗ chép lại trong hợp đồng và một chỗ trong `data-model.md`
đã được thay bằng con trỏ.

### 14.4. Sai lệch phải sửa ở mã nguồn

| Bên | Mã | Mức | Một dòng |
|:---|:---|:---:|:---|
| FE | `FE-01` | 🔴 | `updateWorkShift` gọi `api.put`, route là `PATCH` ⇒ **404 mọi lần sửa ca** |
| FE | `FE-02` | 🔴 | `cauHinhApi` khai 20 trường `Decimal` là `number`; thực tế là chuỗi ⇒ vòng lặp `GET`→`PUT` trả **400**, màn Cấu hình không lưu được |
| FE | `FE-05` | 🔴 | Bãi bỏ hai hàm quy đổi biểu thuế · ô nhập mang nghĩa ngưỡng lũy kế · nới từ 5 bậc cứng lên N bậc · sửa giá trị tạm sang 7 bậc · hiện cảnh báo lệch chuẩn |
| FE | `FE-03` · `FE-04` | 🔵 | Thiếu `getHolidayDetail`; thiếu `sortBy: "startTime"` |
| BE | `BE-09` | 🔴 | Biểu mặc định đang là **5 bậc cắt cụt ở 25% — sai luật** |
| BE | `BE-05` | 🔴 | Chỉ cài **1/4** điều kiện toàn vẹn biểu thuế; thiếu `E-hrm-080/081/082` và mã hóa bậc mở |
| BE | `BE-02` · `BE-10` · `BE-11` | 🟠 | Thiếu `warning` ca >12h · thiếu nhật ký kiểm toán cấu hình · thiếu `warning` biểu lệch chuẩn |
| BE | `BE-03` | 🟠 | `isPaid` dùng `z.coerce.boolean()` ⇒ `?isPaid=false` lọc ra đúng nhóm **ngược lại**, im lặng |
| BE | `BE-01` | 🔵 | Hai endpoint trả 201 thay vì 200 |
| BE | `BE-04` · `BE-06` · `BE-07` · `BE-08` | 🔵 | Sinh mã ca ngoài transaction · `GET` self-healing dùng `create` thay vì `upsert` · dùng `new Date()` thay vì `homNayVN()` · thống kê `quick-generate` ngoài transaction |

### 14.5. Việc cần DevOps xác nhận — ❓ không đoán

Ba bảng + bốn enum đã có trong `prisma/tenant/schema.prisma`, nhưng tenant dùng
`prisma db push` (không để lại bảng lịch sử di trú) nên **không xác định được từ trong repo** là
`npm run sync:tenants` đã chạy lên DB công ty thật hay chưa. Phải kiểm bốn điểm ở
`data-model.md` M-15 mục 3 — đặc biệt là enum `"HolidayType"` có đủ **4** giá trị và
`"WorkDayMethod"` đủ **3** giá trị, vì bản `data-model.md` trước đợt này ghi DDL **thiếu**
`FIXED_24` và `COMPENSATORY`. Chưa xác nhận xong thì mọi lời gọi sẽ chết bằng P2021/P2022 → 500.

### 14.6. Phạm vi bằng chứng của chính đợt này — nói thẳng

**Đã chạy thật:** `npx tsx --test src/__tests__/hrmSettingsShiftsHolidays.test.ts` (12/12 pass) ·
serialize `Prisma.Decimal` qua `JSON.stringify` (ra **chuỗi** `"8"`) · 9 phép thử hành vi Zod trên
chính validator của repo (`isPaid='false'` ⇒ `true` · `code` bị loại im lặng · `khoang: 0` bị
chặn · `khoang` giảm dần **được chấp nhận** · chuỗi `'8'` bị `z.number()` từ chối ·
`standardHoursPerDay: 8.3` được chấp nhận).

**Chưa chạy, và không tuyên bố:** **không một lời gọi HTTP nào** — chưa có tenant để gọi, và
không tự khởi động máy chủ phát triển của người dùng. Mọi kết luận về mã trạng thái, envelope và
phân giải tenant là **suy luận từ mã nguồn đã đọc trực tiếp**, cần Phase B của QA xác nhận. Cũng
chưa chạy `typecheck` và `lint` (không sửa mã nguồn nào nên không phát sinh).

**Lưu ý cho QA:** bộ 12 ca hiện có là kiểm thử **hàm thuần và Zod schema** — không ca nào dựng
Fastify, chạm DB, hay kiểm mã HTTP. Nó **không thể** bắt được bất kỳ sai lệch nào trong Mục 14.4.
Nợ dựng khung kiểm thử tích hợp (ghi từ Mục 10.6 và 13.4) vẫn còn nguyên.

---

## 15. Phase B đợt 2 — nghiệm thu THẬT cụm nền tảng (Tester-QA, 2026-09-08)

### 15.1. Món nợ ở Mục 10.6 điểm 2 và Mục 13.4 — ĐÃ TRẢ

> *"Dựng khung test tích hợp có `app.inject()` — 12 ca endpoint vẫn chưa chạy được, và **chưa một endpoint HRM nào được gọi thật**."*

Nay đã có: `be_maxv/src/__tests__/hrmSettingsShiftsHolidaysApi.test.ts` — **121 lượt gọi HTTP thật** mỗi lượt chạy, đi trọn chuỗi `hook auth → requireModule('hrm') → resolveTenantDb → controller → validator → service → PostgreSQL → errorHandler`.

**Rào cản đã gỡ.** `adminOwner.test.ts` hỏng 5/5 với 401 vì `POST /auth/login` **không còn** trả `accessToken` trong thân phản hồi — `issueTokens()` đặt vé vào **cookie httpOnly**. Bản test cũ đọc `data.accessToken` ⇒ `undefined` ⇒ gửi `Bearer undefined`, mà `@fastify/jwt` ưu tiên header khi header có mặt nên lấy đúng chuỗi `"undefined"` làm token. **Lỗi của TEST, không phải lỗi sản phẩm.** Đã sửa (chỉ trong thư mục test) ⇒ 5/5 PASS.

**Cách khung mới xác thực** — đi đúng đường của sản phẩm, không tự ký JWT tay:
`POST /auth/login` (lấy cookie) → `POST /companies/:id/switch` (nhúng `donViId`) → mọi lượt gọi HRM dùng `app.inject({ cookies: { accessToken } })`.

**Cách cô lập dữ liệu:** bộ test **tự cấp 2 DB tenant** `maxv_9970000001_app` và `maxv_9970000002_app` bằng `provisionTenant()`, chạy xong `dropTenant()` cả hai. Tài khoản / gói / công ty / dòng `syslog` của bộ test đều bị xóa ở `cleanup()` (chạy cả trước lẫn sau). **Không chạm một dòng nào của tenant thật; không khởi động hay tắt máy chủ dev; không chạy `sync:tenants`.**

Đối chứng sau lượt chạy cuối: `{"userTest":0,"donViTest":0,"planTest":0,"syslogHRM":0,"tongDonVi":10,"tongUser":10}` · `DB test con lai: []` — control plane y hệt trước khi chạy.

### 15.2. Kết quả

| Nhóm | Số ca | Chạy thật | PASS | FAIL | KHÔNG CHẠY ĐƯỢC |
|:---|:--:|:--:|:--:|:--:|:--:|
| Cấu hình mặc định (`TC-hrm-273…287`) | 15 | 15 | **15** | 0 | 0 |
| Ca làm việc (`TC-hrm-288…309`) | 22 | 21 | **20** | 1 | 1 |
| Lịch ngày lễ (`TC-hrm-310…327`) | 18 | 18 | **17** | 1 | 0 |
| **Cộng** | **55** | **54** | **52** | **2** | **1** |

Thêm **9 phép kiểm riêng `KR-01…KR-09`** cho những điểm bộ ca tài liệu chưa chạm hoặc báo cáo đợt 1 chấm sai — **9/9 PASS**.

| Lệnh | Kết quả |
|:---|:---|
| `be_maxv` typecheck / lint | exit 0 / exit 0 (`183 problems, 0 errors`) |
| `be_maxv npm test` | **577 tests · 573 pass · 4 fail** (4 con số fail chỉ là 2 ca lá `TC-hrm-301`, `TC-hrm-316` và 2 khối cha). Trước đợt này có 5 ca đỏ thường trực — nay hết |
| `hdđt_maxv` tsc / lint / build | exit 0 / exit 0 / OK (`built in 3.19s`) |

### 15.3. Sáu mục đóng bằng bằng chứng runtime

| Mục | Bằng chứng chạy thật |
|:---|:---|
| `BUG-HRM-44` — thiếu nhật ký kiểm toán | Truy vấn thẳng bảng `syslog` sau khi gọi API: đúng 2 dòng `HRM_UPDATE_GENERAL_SETTINGS` + `HRM_RESTORE_GENERAL_SETTINGS`, đúng `userId`, đúng `donViId`, `chiTiet:{"khoaNghiepVu":"DEFAULT"}`. **Test đơn vị không bắt được điều này** vì `writeLog()` tự nuốt mọi lỗi |
| `BUG-HRM-45` — trần 99 mã ca | Nạp đủ `CA01…CA99` rồi `POST` bỏ trống mã ⇒ **400** `E-hrm-078`; tự nhập `CA100` ⇒ **201** |
| `BUG-HRM-47` — cảnh báo ca > 12h | Ca 22h trả `warning: CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD` ở **cả 4 đường đọc** (sau tạo · danh sách · chi tiết · sau sửa); ca 8h vắng hẳn trường này |
| `BUG-HRM-49` — khoảng trắng lách `@@unique` | `"  Tết Dương lịch  "` cùng ngày ⇒ **409**, DB chỉ còn 1 bản ghi |
| `BE-03` — `?isPaid=false` lọc ngược | Lọc **đúng** nhóm không hưởng lương; `?isPaid=abc` ⇒ **400**. Giao diện được phép dựng bộ lọc "nghỉ không lương" |
| Biểu thuế mặc định | `GET` trên tenant trắng trả đúng **7 bậc**, bậc cuối `khoang: null`, trần **35%**. Bốn điều kiện toàn vẹn `BR-hrm-082` chạy đủ; mốc cũ `999999999999` được chuẩn hóa về `null` |

Ngoài ra: `restore-default` và `quick-generate` đều trả **200** (không phải 201, đúng ADR-009); Decimal đọc ra **chuỗi** `"8"` đúng hợp đồng 7D.0 (a); cô lập tenant (`NFR-hrm-003`) được chứng minh trên **hai DB vật lý** cho cả 3 thực thể.

### 15.4. Ba điểm còn treo — không điểm nào là lỗi mã

| Ca | Trạng thái | Nguyên nhân | Việc kế tiếp |
|:---|:--:|:---|:---|
| `TC-hrm-301` | ❌ FAIL | `?search=chinh` trả `total = 0`; `?search=chính` trả 1. Hợp đồng 7E.2 **chỉ hứa** `contains` không phân biệt hoa thường, **không** bỏ dấu ⇒ mã đúng hợp đồng, ca kiểm thử kỳ vọng vượt hợp đồng. Nhưng gõ không dấu là thói quen thật ⇒ **`BUG-HRM-50`** | **BA chốt**: có làm tìm kiếm bỏ dấu cho danh mục HRM không |
| `TC-hrm-316` | ❌ FAIL | Phản hồi có `isPaid` nhưng không có "thứ trong tuần"; hợp đồng 7F.2 cũng không hứa. Giao diện đã tự tính (`LichNgayLePanel.tsx:46-48`) ⇒ nhu cầu nghiệp vụ **được đáp ứng** | QA sửa câu chữ ca kiểm thử — ✅ đã làm |
| `TC-hrm-308` | ⏸ HOÃN | Bảng `hrm_work_schedules` chưa tồn tại (`information_schema` = 0), schema không có model nào tham chiếu `WorkShift` ⇒ không dựng được tiền điều kiện | Mở lại khi có thực thể phân lịch |

Cũng đã sửa `test-cases.md` TC-hrm-273: bản cũ ghi *"taxBrackets gồm 5 bậc"* — câu chữ có từ trước QĐ #24 / ADR-009. Biểu 5 bậc cắt cụt ở 25% **không đúng luật Việt Nam** nên để nguyên trong tài liệu kiểm thử là mời gọi ai đó "sửa code cho khớp tài liệu".

### 15.5. Nợ còn lại sau đợt này

1. **BA chốt `BUG-HRM-50`** — chặn việc ghi "nghiệm thu hoàn tất" cho cụm này.
2. **`BUG-HRM-46` vẫn mở** (🟠 High) — cấu hình không có hiệu lực thời gian. Chưa có `hrm_payroll_periods` nên chưa kiểm được. Yêu cầu giữ nguyên: **bảng lương khi chốt kỳ phải chụp ảnh tham số**, không truy vấn động ngược lại `hrm_general_settings`.
3. **`BUG-HRM-48` vẫn mở** (🔵 Low) — bảng tra âm lịch dừng ở 2030; `TC-hrm-326` xác nhận 2031 trả 400.
4. **Mở rộng khung `app.inject()`** sang phòng ban / nhân viên / hợp đồng / người phụ thuộc / tài liệu — mở khóa **12 ca endpoint** còn kẹt từ đợt P0. Khung mẫu đã có, chỉ cần chép cách dựng tenant + lấy vé.
5. **Ca đồng thời** (hai người cùng bấm Lưu) — `createWorkShift` thử lại 5 lượt và `quickGenerate` bọc giao dịch mới chỉ được **đọc mã**, chưa dựng được va chạm thật.
6. **Chưa có bộ chạy test giao diện** ở `maxv/`, `hdđt_maxv/`, `fe_maxv/`. Phần giao diện của cụm này mới chỉ bảo đảm ở mức `tsc` + `lint` + `build` sạch.

### 15.6. Báo cáo nghiệm thu đợt 1 đã bị THAY THẾ

`docs/hrm/agents-tester-qa/qa-verification-report-2026-09-08.md` kết luận **"55/55 PASS · PASSED · đủ điều kiện triển khai production"** — **không có căn cứ**, ba điểm sai đã kiểm chứng: (1) bằng chứng duy nhất là 12 test đơn vị logic thuần, **không một lời gọi HTTP nào**; (2) chấm `BUG-HRM-47` là "đã phòng ngừa hợp lý" trong khi chỗ đó là **khối `if` rỗng chỉ có 2 dòng chú thích**; (3) `TC-hrm-273` ghi "khởi tạo thành công 30+ tham số" khi **0/10 tenant có bảng `hrm_general_settings`**.

Báo cáo có hiệu lực: **`docs/hrm/agents-tester-qa/qa-verification-report-2026-09-08-dot-2.md`**.

### 15.7. Phạm vi bằng chứng của chính đợt này

**Đã chạy thật:** 121 lượt gọi HTTP qua `app.inject()` trên 2 DB tenant do bộ test tự cấp · truy vấn trực tiếp bảng `syslog`, `hrm_general_settings`, `hrm_work_shifts`, `hrm_holidays` và `information_schema` · `npm run typecheck`, `npm run lint`, `npm test` ở `be_maxv` · `tsc`, `lint`, `build` ở `hdđt_maxv`. Mỗi ca PASS đều kèm **mã trạng thái HTTP thật** và **thân phản hồi nguyên văn**, chép trong `qa/test-report.md` Mục 13–14.

**Chưa chạy, và không tuyên bố:** chưa kiểm hành vi màn hình nào (không có bộ chạy test giao diện) · chưa dựng được ca đồng thời thật · chưa đo hiệu năng trên tenant dữ liệu lớn · chưa chạm tenant thật của chủ dự án, nên không có kết luận nào về dữ liệu sản xuất.

**Tài liệu đã cập nhật ở đợt này:** `qa/test-report.md` (Phần II) · `qa/issues-and-bugs.md` (Mục 12) · `qa/test-matrix.md` (Mục 3.2 + tiêu chí ra) · `qa/test-cases.md` (TC-273, 301, 308, 316 + ghi chú Mục 8) · `agents-tester-qa/qa-verification-report-2026-09-08-dot-2.md` (mới) · `agents-tester-qa/README.md`.

**Mã đã đụng tới — chỉ trong thư mục test:** `be_maxv/src/__tests__/hrmSettingsShiftsHolidaysApi.test.ts` (mới) và `be_maxv/src/__tests__/adminOwner.test.ts` (đổi cách gắn vé). **Không sửa một dòng mã sản phẩm nào.**

---

## 16. Quality Gate và vòng sửa lỗi chặn — cụm nền tảng (Code Reviewer + Dev, 2026-09-08)

### 16.1. Vì sao có vòng này

Sau khi Phase B đợt 2 kết luận "0 lỗi sản phẩm mới" (Mục 15), vòng **Phase 5 — Quality Gate** vẫn tìm được **2 lỗi chặn**. Không mâu thuẫn: mỗi bên đúng trong phạm vi của mình.

* QA kiểm **máy chủ** qua `app.inject()` với bộ tham số do chính QA dựng, nên không bao giờ chạm vào con số `pageSize: 500` mà giao diện gán cứng.
* Ca kiểm thử ngày lễ **neo vào chính bảng tra đang sai**, nên test và mã cùng sai một chỗ thì test luôn xanh.

Bài học ghi lại: **một tầng kiểm thử không thay được tầng kia**, và **ca kiểm thử neo vào dữ liệu chưa đối chiếu nguồn ngoài thì không phải kiểm chứng**.

### 16.2. Hai lỗi chặn và cách xử lý

| Mã | Nội dung | Xử lý |
|:---|:---|:---|
| **B1** | Giao diện xin `pageSize: 500`, máy chủ chặn `max(100)`, nên màn Lịch ngày lễ trả **400 mọi lần mở** | Frontend: kéo theo trang (`api/taiHetTrang.ts` dùng chung), cảnh báo khi thiếu dòng. Áp cho cả danh mục ca làm việc — cùng lớp lỗi |
| **B2** | Bảng tra âm lịch chép tay **sai 17/42 ô** (11 sai ngày, 6 sai tên) | Backend: bỏ hẳn bảng, thay bằng **thuật toán Hồ Ngọc Đức** quy chiếu **UTC+7** (`services/client/hrm/amLich.util.ts`), neo vào 11 mốc lịch sử 2018–2025 trước khi tin |

### 16.3. Ba phát hiện về ngày lễ mà đối chiếu BE với FE không thể tìm ra

1. **Mùng 1 Tết 2026** — bảng máy chủ ghi `18/02`, đúng là `17/02`. Cả khối 2026 trượt một ngày.
2. **Giỗ Tổ 2028** — máy chủ ghi `05/04`, đúng là `04/04`.
3. **Mùng 1 Tết 2030** — **cả hai bảng cùng ghi `03/02`, đúng là `02/02`.** Sóc rơi 02/02/2030 lúc khoảng 23 giờ theo giờ Việt Nam (UTC+7); quy sang UTC+8 thì đã sang 03/02, nên con số cũ là **ngày Tết của lịch Trung Quốc**. Điểm này **không lộ ra khi đối chiếu bảng máy chủ với bảng giao diện** vì hai bảng chép tay khớp nhau — chỉ lộ khi so với một nguồn tính độc lập.

Nguyên nhân gốc của cả ba giống nhau: **múi giờ**. Lịch âm Việt Nam tính theo UTC+7, lịch Trung Quốc theo UTC+8; lệch một giờ đủ đẩy ngày sang hôm sau khi thời điểm sóc rơi gần nửa đêm.

Ngoài ra, tên ngày sai ở 4 năm: bảng cũ gọi "30 Tết" cho mọi năm, nhưng chỉ 2024 có tháng Chạp đủ 30 ngày — 2027 đến 2030 đang gán nhãn "30 Tết" cho một ngày **không tồn tại** trong năm đó.

**Đối soát cuối:** thuật toán máy chủ và bảng xem trước của giao diện nay **khớp 14/14 mốc trên cả 7 năm**. Bảng giao diện đã sửa `2030-02-02` và ghi rõ nó **không phải nguồn sự thật**.

> **Mức tin cậy — nói rõ để người sau không hiểu nhầm.** Mốc 2026 và 2028: **cao** (biên độ xa ranh giới; hai bản cài thuật toán độc lập cùng kết quả; suy luận số học riêng cũng khớp). Mốc **2030: trung bình** — sóc chỉ cách nửa đêm khoảng 45 phút, mà thuật toán dùng chuỗi rút gọn nên sai số vài phút là có thể. Nhà nước chưa công bố lịch nghỉ 2030, nên **chưa có nguồn chính thức để đối chiếu**. Cần kiểm lại khi có công bố.

### 16.4. Lỗi không chặn đã sửa cùng đợt

**Máy chủ:** chuẩn hóa bậc mở ở chiều đọc cho khớp hợp đồng (N1) · `addedCount` dùng `createMany().count` thay 2 lần `count()` bọc giao dịch, 3 truy vấn còn 1, và sửa chú thích sai về mức cô lập READ COMMITTED (N2) · chặn dải `year` để đầu vào xấu trả 400 thay vì 500 (N3).

**Giao diện:** bảng lương, chấm công và tăng ca **đổi nguồn đọc cấu hình** từ kho giả sang API thật (N5 — trước đó người dùng sửa biểu thuế, bấm Lưu, mà bảng lương không đổi con số nào) · `thueLuyTien` **ném lỗi** thay vì trả 0 khi biểu thuế dưới 2 bậc (N6 — trả 0 nghĩa là khấu trừ 0 đồng, im lặng, hướng nguy hiểm nhất cho một hàm tính thuế) · siết kiểm giờ công chuẩn cho khớp máy chủ · sửa năm mặc định của hộp thoại Tạo nhanh.

### 16.5. Trạng thái sau vòng này

Hai lỗi chặn đã đóng. Kiểm chứng: máy chủ `typecheck` sạch và bộ ca cụm này **44/44 đạt**; giao diện `tsc`, `lint`, `build` đều sạch.

**Vẫn còn 4 ca đỏ trong bộ tích hợp, và chúng KHÔNG được nới lỏng để né:**

* `TC-hrm-301` — tìm kiếm không bỏ dấu (`?search=chinh` không ra `Ca chính`). Cần bật `unaccent` hoặc thêm cột chuẩn hóa; chờ ADR của Architect và quyết định của BA (`BUG-HRM-50`).
* `TC-hrm-316` — **mâu thuẫn giữa hai tài liệu đã ký**: `qa/test-cases.md` đòi trường "thứ trong tuần", `architecture/api-contract.md` Mục 7F.2 không có trường đó. Phải bỏ yêu cầu khỏi bộ ca, **hoặc** bổ sung vào hợp đồng rồi giao lại cả hai phía.

### 16.6. Nợ còn lại — đọc trước khi tuyên bố tính năng đã xong

1. **Số liệu bảng lương, chấm công và tăng ca vẫn là dữ liệu giả.** Đợt này chỉ đổi *nguồn cấu hình*. **Đừng truyền thông là "bảng lương đã chạy thật".**
2. Bảng chấm công vẫn dựng lịch nghỉ từ kho giả dù đã có hook đọc ngày lễ thật.
3. Hộp thoại quản lý tăng ca gửi `PUT` **toàn bộ** cấu hình dù chỉ sửa hệ số — hợp đồng chưa có `PATCH` từng phần; công ty có biểu thuế riêng sẽ nhận cảnh báo lệch chuẩn mà hộp thoại đang bỏ qua.
4. Bảng tra âm lịch phía giao diện **nên bỏ hẳn**, cho bản xem trước đọc thẳng `items[]` của máy chủ — khi đó chỉ còn một nguồn, không thể lệch nữa.
5. Dải năm 2024–2030 nay chỉ còn là **giới hạn nghiệp vụ**, không còn là giới hạn kỹ thuật (thuật toán tính được mọi năm). BA cần quyết có nới không — hệ thống từ chối "Tạo nhanh" từ 01/01/2031 là rủi ro thật.
6. Năm nhóm còn lại của `BR-hrm-066` (xóa hợp đồng · sửa lương · xóa người phụ thuộc · xóa tài liệu · ngắt Drive) **vẫn chưa ghi nhật ký**. Đợt này chỉ làm nhóm 6.
7. Nhật ký ghi vào `sys_log` ở **control plane**, không phải cơ sở dữ liệu của công ty — nếu nghiệp vụ muốn chủ công ty tự tra nhật ký của mình thì cần quyết định kiến trúc riêng.

### 16.7. Di trú cơ sở dữ liệu — đã chạy

| Bước | Kết quả |
|:---|:---|
| `npm run sync:tenants` | **10/10 tenant**, 0 lỗi |
| `npm run hrm:constraints` | **10/10 tenant** — áp lại 8 ràng buộc, 2 ràng buộc loại trừ sẵn có |
| Đối soát bảng | **10/10 tenant đủ 3 bảng**; 4 kiểu liệt kê đúng giá trị (gồm `FIXED_24` và `COMPENSATORY`) |
| Đối soát dữ liệu | Bản ghi `DEFAULT` tự sinh trên tenant thật: **đúng 7 bậc**, bậc cuối `khoang: null` |

Xác nhận thêm bằng đo thật: kiểu `Decimal` của Prisma **JSON hóa ra chuỗi** (`"8"`, không phải `8`) — đúng như `ADR-009` quyết định 3, và đây chính là căn nguyên của lỗi `FE-02`.

Ghi chú vận hành: `sync:tenants` chạy `prisma db push --accept-data-loss`, nhưng với riêng thay đổi này `prisma migrate diff` cho thấy SQL sinh ra **thuần cộng thêm** — 4 `CREATE TYPE`, 3 `CREATE TABLE`, 5 index, **0 lệnh `DROP`**. `db push` **có** xóa 8 index và ràng buộc duy nhất do Prisma quản lý, nên chạy lại `hrm:constraints` sau đó là **bắt buộc**, không phải thừa.

**Chưa chạy:** `npm run hrm:chuan-hoa-thue` (kể cả chế độ chạy thử `-- --thu`). Không cấp bách vì mọi tenant hiện đều tự sinh biểu 7 bậc đúng ngay từ đầu; script chỉ cần khi có tenant còn giữ biểu 5 bậc cũ.

---

## 17. Đợt đổi dải năm "Tạo nhanh" — ĐÃ THU HỒI (2026-09-08)

### 17.1. Chuyện gì đã xảy ra

Sau khi sửa xong `BUG-HRM-51`, chủ dự án nêu: ô chọn năm của hộp thoại "Tạo nhanh" chặn cứng tới 2030 và *"trông không ổn"*, muốn thay bằng **nút tăng/giảm** và cho vượt quá 2030.

Một đợt ba việc đã chạy: BA đổi `BR-hrm-079` sang **dải trượt** `[năm nay − 5, năm nay + 10]`, Backend đổi validator và service, Frontend dựng nút tăng/giảm thay ô chọn danh sách.

**Chủ dự án dừng cả ba agent giữa chừng** và quyết: *"thôi cứ để tới năm 2030 như cũ đi, việc làm kiểu này để sau đi."* Khi được hỏi rõ phạm vi, chọn **lùi hết** — về cả ô chọn danh sách lẫn giới hạn 2030.

### 17.2. Đã hoàn nguyên những gì

| Tầng | Trạng thái sau khi lùi |
|:---|:---|
| Máy chủ — validator | `.min(2024).max(2030)` trở lại; gỡ `.superRefine()` và `errorMap` |
| Máy chủ — service | Lớp chặn thứ hai về so sánh cố định `< 2024 \|\| > 2030` |
| Máy chủ — thông điệp lỗi | `NAM_KHOI_TAO_LE_INVALID` từ hàm về lại chuỗi cố định nêu rõ *"từ 2024 đến 2030"* |
| Máy chủ — file mới | `holidayYearRange.ts` **đã xóa**; `namHienTaiVN()` chuyển ngược về `holidays.service.ts` |
| Giao diện | Nút tăng/giảm gỡ bỏ; `TextField select` + 7 `MenuItem` (2024–2030) trở lại; gỡ cơ chế chống-gọi-dồn |
| Giao diện — hằng số | `NAM_TAO_NHANH_MIN/MAX` từ hàm về lại hằng số cố định |
| Đặc tả | `BR-hrm-079` · `FR-hrm-054` · `E-hrm-079` · `UC-hrm-22` · `US-hrm-16` · Mục 2.1 · Mục 4.10 · `AC-hrm-66` · `AC-hrm-73` về dải 2024–2030; `AC-hrm-74` **thu hồi tại chỗ** (chỉ có nghĩa với dải trượt) |
| Biên bản BA | `ba-quyet-dinh-dai-nam-tao-nhanh-2026-09-08.md` giữ lại làm lưu vết, `status: approved` → **`revoked`**, có banner phân tách phần còn dùng được với phần hết hiệu lực |

### 17.3. Đã kiểm chứng bằng thao tác thật

| Phép thử | Kết quả |
|:---|:---|
| `POST /holidays/quick-generate` năm **2031** | **400** — *"Năm khởi tạo ngày lễ phải nằm trong khoảng từ 2024 đến 2030."* |
| Năm **2030** và **2027** | **200** |
| Ô chọn năm trên giao diện | **7 lựa chọn**, 2024 → 2030, **không có 2031**; là danh sách thả xuống, không còn nút tăng/giảm |
| Dòng phụ dưới ô | *"Hệ thống nhận các năm 2024–2030."* |
| Bộ ca máy chủ | **60/60 đạt** (đúng mốc trước đợt này); tích hợp 73/77 với đúng 4 ca đỏ có sẵn |
| Giao diện | `tsc -p tsconfig.app.json` · `lint` · `build` đều sạch |
| Dữ liệu tenant `0111142786` | **17 dòng nguyên vẹn**, không thêm không xóa |

### 17.4. Những gì KHÔNG bị lùi nhầm — đã kiểm trực tiếp trên giao diện

Bản xem trước vẫn hiện **11 dòng với 11 chip "Đã có trong lịch"** và câu tổng kết đầy đủ, nghĩa là hai đợt trước còn nguyên vẹn:

* `dryRun` — bản xem trước đọc từ máy chủ (`ADR-010`), không quay lại tự tính bằng bảng tra
* `alreadyCovered` — quy tắc bỏ qua ngày lễ đã được cờ lặp-hàng-năm phủ (`BUG-HRM-51`, `ADR-011`)
* Thuật toán âm lịch `amLich.util.ts` — **không đụng một dòng**
* Phân trang `taiHetTrang` (bản vá `B1`), Tết 2030 = `2030-02-02` ở bảng giao diện

### 17.5. `TD-HRM-01` — nợ đổi nội dung, KHÔNG phải đã đóng

Nợ này từng được ghi là *"tích hợp thư viện thiên văn âm dương trước năm 2031"*. Nội dung đó **đã lỗi thời**: thuật toán âm lịch có rồi, và đo thật cho thấy nó tính được 2023, 2031, 2035, 2040, 2050, 2099 — mỗi năm đủ 11 ngày.

Đợt vừa rồi từng đánh dấu nợ này **ĐÓNG**, dựa trên việc chuyển sang dải trượt. Dải trượt nay đã bị thu hồi, nên **nợ mở lại với nội dung mới**:

> **Quyết định có mở dải năm 2024–2030 hay không, và mở tới đâu.** Hạn chót **31/12/2030** — qua mốc đó mà không mở, mọi lần bấm "Tạo nhanh" sẽ trả 400.

Giới hạn 2030 nay là **lựa chọn nghiệp vụ có chủ ý**, không còn là giới hạn kỹ thuật. Đặc tả đã ghi rõ điều này kèm một gạch đầu dòng **cấm khôi phục lý do cũ** ("bảng tra chỉ có 7 năm") cho người rà soát về sau. Câu hỏi mở: `OQ-hrm-37`.

### 17.6. Còn lệch câu chữ — nhỏ, để sau

Bốn chỗ còn giải thích dải 2024–2030 bằng **lý do cũ đã sai** (nói hoặc hàm ý "bảng tra âm lịch tĩnh / tra cứu sẵn"), trong khi dải năm ghi trong đó thì **đúng**:

`srs/hrm-erd.md` (~dòng 279) · `srs/hrm-states.md` (~dòng 392) · `qa/test-cases.md` (cột kết quả mong đợi của `TC-hrm-325`/`326`) · `srs/hrm-spec.md` `AC-hrm-61`.

Không sai dữ liệu, không chặn gì — chỉ là lời giải thích lỗi thời. Dọn khi tiện.

### 17.7. Bài học

Ba agent bị dừng giữa chừng nhưng **đã kịp sửa mã**, nên "dừng" không đồng nghĩa với "chưa có gì xảy ra". Việc hoàn nguyên phải làm thủ công theo từng phần, **không dùng được `git checkout`** vì các file đó còn chứa công sức của sáu vòng trước phải giữ.

Cũng vì chạy song song, **báo cáo của agent có thể lỗi thời ngay khi viết xong**: một agent cảnh báo `api-contract.md`, `qa/*` và `ADR-008` cũng mô tả dải trượt và cần lùi — kiểm lại thì `ADR-008` và `qa/*` **không có chỗ nào**, còn `api-contract.md` chỉ khớp ở cụm *"Lỗi khi trượt"* trong một bảng, không liên quan. Tin luôn cảnh báo đó sẽ tốn thêm một vòng sửa ba tài liệu vốn không sai.

---

## 18. Đợt phát triển Phân hệ Cài đặt lương (Salary Settings) — ĐÃ HOÀN THÀNH (2026-09-09)

### 18.1. Phạm vi & Mục tiêu
Triển khai hoàn chỉnh toàn bộ tính năng backend cho giao diện Cài đặt lương (`hdđt_maxv/src/features/hrm/components/cai_dat_luong`) theo chuẩn BA và pháp lý lao động - BHXH - thuế Việt Nam (Thông tư 10/2020/TT-BLĐTBXH, Thông tư 111/2013/TT-BTC, BLLĐ 2019):
1. **Danh mục khoản lương & phụ cấp** (`danh-muc-khoan`): 7 nhóm chuẩn, sinh mã `KL01`..`KL99`, chống trùng tên `E-sal-002`, bảo vệ xóa khi đang dùng trong cấu trúc `E-sal-003`, thống kê theo nhóm.
2. **Cấu trúc lương khung** (`set-luong` - Salary Structure): Quản lý thời kỳ hiệu lực, chọn khoản đưa vào khung chuẩn, xác định phân loại thuế (`TAXABLE`/`NON_TAXABLE`), cờ tính tăng ca (`isOvertimeBase`), tiêu thức tính (`CalculationMethod`), số tiền mặc định.
3. **Thiết lập lương nhân viên & Phê duyệt** (`set-luong` - Employee Salary Assignment): Danh sách kèm trạng thái `daSet`, lọc theo phòng ban/hợp đồng/đã set lương, form gán mức tiền (hỗ trợ cả định dạng mảng `items` và map `khoan`), ràng buộc hợp đồng còn hiệu lực `E-sal-009`, khoản gán phải thuộc cấu trúc active `E-sal-010`, tổng lương > 0 `E-sal-008`, cơ chế phiên bản (`setupVersion` tăng 1 và reset về `PENDING_APPROVAL` khi sửa), phê duyệt đơn lẻ và duyệt hàng loạt (`approve`).

### 18.2. Các thành phần đã triển khai trong mã nguồn (`be_maxv`)
- **Database & Schema**:
  - `prisma/tenant/schema.prisma`: Thêm 5 enum (`SalaryItemCategory`, `SalaryItemStatus`, `TaxTreatment`, `CalculationMethod`, `SalaryApprovalStatus`), 5 models (`SalaryItem`, `SalaryStructure`, `SalaryStructureItem`, `EmployeeSalary`, `EmployeeSalaryItem`), liên kết 1-1 với `hrm_nhan_vien` qua `ma_nv`.
  - Đã biên dịch Prisma Client thành công: `npx prisma generate --schema=prisma/tenant/schema.prisma`.
- **Hằng số thông điệp**: `src/constants/messages.ts` bổ sung `MESSAGES.HRM.SALARY_*` (mã lỗi `E-sal-001` đến `E-sal-011`).
- **Validators (Zod)**:
  - `src/validators/hrm/cai_dat_luong/salaryItems.validator.ts`
  - `src/validators/hrm/cai_dat_luong/salaryStructures.validator.ts`
  - `src/validators/hrm/cai_dat_luong/employeeSalaries.validator.ts` (hỗ trợ linh hoạt cả `items` và `khoan`)
- **Services**:
  - `src/services/client/hrm/cai_dat_luong/salaryItems.service.ts`
  - `src/services/client/hrm/cai_dat_luong/salaryStructures.service.ts`
  - `src/services/client/hrm/cai_dat_luong/employeeSalaries.service.ts`
- **Controllers & Routes**:
  - `src/controllers/client/hrm/cai_dat_luong/` (`salaryItems`, `salaryStructures`, `employeeSalaries`)
  - `src/routes/hrm/cai_dat_luong/` (`salaryItems.route.ts`, `salaryStructures.route.ts`, `employeeSalaries.route.ts`)
  - Đăng ký plugin hoàn tất trong `src/routes/hrm/hrm.route.ts`.

### 18.3. Kết quả Kiểm thử & Đảm bảo chất lượng
- **TypeScript**: `tsc --noEmit` hoàn thành sạch với mã thoát 0 (không có bất kỳ lỗi biên dịch nào).
- **Unit Tests (`src/__tests__/hrmSalarySettings.test.ts`)**: 13/13 ca đạt 100% (kiểm tra đầy đủ mọi ràng buộc `BR-sal-001`..`BR-sal-010`).
- **Fastify HTTP API Tests (`src/__tests__/hrmSalarySettingsApi.test.ts`)**: 10/10 ca đạt 100% (bao gồm cả kiểm thử tương thích payload UI mock).
- **Tài liệu lưu vết tại `docs/hrm/cai_dat_luong/`**:
  - `srs-cai-dat-luong.md`: Đặc tả yêu cầu nghiệp vụ theo góc nhìn BA.
  - `api-contract-cai-dat-luong.md`: Hợp đồng toàn diện cho các REST endpoints.
  - `data-model-cai-dat-luong.md`: Thiết kế mô hình dữ liệu ERD và Prisma Schema.
  - `qa-report-cai-dat-luong.md`: Báo cáo kết quả kiểm thử QA chi tiết.

---

## 19. Phân hệ Dữ liệu tính lương (Payroll Input Data) — Kiểm định độc lập & Hình thức hóa SRS (Business Analyst, 2026-09-09)

### 19.1. Vì sao phải kiểm định lại

Cùng ngày 2026-09-09, một phiên làm việc tự nhận vai **"ba-engineer"** (14:26) rồi ngay sau đó **"fullstack-engineer"** (14:48) — cả hai đều **không phải agent chuẩn của dự án** (chuẩn là `business-analyst`/`architect`/`backend-engineer`/`tester-qa`/`code-reviewer`) — đã viết đặc tả (`BA_ANALYSIS_SPEC.md`) **rồi tự mình triển khai toàn bộ backend + một phần frontend trong đúng hai lượt kế tiếp**, tự viết `walkthrough.md` tự chấm đạt. **Không qua** Architect review độc lập, **không qua** Tester-QA Phase A, **không qua** Code Reviewer, **không có** BA Sign-off Gate độc lập. Đây đúng là lỗi Mục 9.1 của file này đã cảnh báo cho đợt trước: *"không gộp ba vai vào một lượt viết. Cổng Phase A tồn tại chính vì lý do này."*

Đợt này (Business Analyst, chạy độc lập, không tin suông `walkthrough.md`/`BA_ANALYSIS_SPEC.md`) đọc trực tiếp toàn bộ mã nguồn thật đã tồn tại — 14 model + 6 enum trong `schema.prisma`, 4 service, 4 controller, 4 route, 3 validator, 1 file test, `errorHandler.plugin.ts`, và 8 file `*Panel.tsx` + `KyLuongSelector`/`PayrollPeriodContext`/`ThanhLocKyLuong` ở `hdđt_maxv` — đối chiếu từng Business Rule/mã lỗi/entity, rồi hình thức hóa thành SRS chính thức.

### 19.2. Thực thể mới (14 model, 6 enum) — đã đối soát 100% khớp `schema.prisma`

Xem bảng đầy đủ ở Mục 2 (đã bổ sung 14 dòng: `hrm_payroll_periods`, `hrm_attendance_records`, `hrm_overtime_records`, `hrm_kpi_items`, `hrm_kpi_records`, `hrm_bonus_records`, `hrm_piecework_products`, `hrm_piecework_records`, `hrm_commission_records`, `hrm_diligence_violation_types`, `hrm_diligence_records`, `hrm_salary_adjustment_items`, `hrm_salary_adjustment_records`, `hrm_payroll_sheet_lines`). Đã `git diff` dòng-by-dòng xác nhận khớp 100% với những gì `BA_ANALYSIS_SPEC.md` mô tả — không có sai lệch schema.

### 19.3. API map — đã đối soát API thật, xem Mục 3

4 nhóm route (`payroll-periods` 11 endpoint, `payroll-catalogs` 16 endpoint, `payroll-data` 16 endpoint, `payroll` 2 endpoint) đã được đọc trực tiếp từ route file, KHÔNG suy từ tài liệu. Hai lệch quan trọng so với `BA_ANALYSIS_SPEC.md`: thiếu `POST /payroll-data/attendance/batch-override` và thiếu toàn bộ `GET /payroll/payslips/my`.

### 19.4. Bốn phát hiện mức 🔴 — quan trọng nhất

| # | Phát hiện | Bằng chứng |
|:---:|---|---|
| 1 | **8/8 file `*Panel.tsx`** (màn hình chính của cả 8 phân hệ: Chấm công, Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm, Chuyên cần, Ứng-bù trừ) **vẫn import hook nghiệp vụ từ `mock/hooks/*`**, chưa nối API thật. `walkthrough.md` tuyên bố "100% việc nối frontend" — **sai** cho đúng phần lõi nghiệp vụ. Chỉ `KyLuongSelector`, `PayrollPeriodContext`, `DuLieuLuongPage`, và dialog "Quản lý danh mục"/"Tái sử dụng" của 6/8 module (không có Chấm công, Tăng ca) đã nối thật | `hdđt_maxv/src/features/hrm/components/du_lieu_tinh_luong/{cham_cong/ChamCongPanel.tsx:24, tang_ca/TangCaPanel.tsx:30, kpi/KpiPanel.tsx:29, thuong/ThuongPanel.tsx:30, bu_tru/BuTruPanel.tsx:30, chuyen_can/ChuyenCanPanel.tsx:29, luong_san_pham/LuongSanPhamPanel.tsx:30, luong_phan_tram/LuongPhanTramPanel.tsx:30}` |
| 2 | **Động cơ tính lương chỉ đọc 2/~15 tham số** đã cấu hình sẵn ở `hrm_general_settings` (`personalDeduction`, `dependentDeduction`) — còn lại **hardcode**: ngày công chuẩn (26), giờ chuẩn/ngày (8.0), tỷ lệ bảo hiểm (10.5%/21.5%), đoàn phí (1%/234k/2%), biểu thuế TNCN 7 bậc. Đổi cấu hình ở "Cấu hình mặc định" **không ảnh hưởng** số liệu lương tính ra | `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts:7-28,136,163,244-250` |
| 3 | **Reopen kỳ lương thiếu 2/3 kiểm soát** mà chính đặc tả khẳng định: không có role-guard ADMIN-only (route chỉ qua guard chung `requireModule('hrm')`), không ghi Audit Log (tham số lý do + userId bị cố ý bỏ qua, prefix `_`; **schema tenant hiện không có bảng audit log nào** để ghi vào) | `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service.ts:181-201`, `src/routes/hrm/du_lieu_tinh_luong/payrollPeriods.route.ts:15` |
| 4 | **`createPayrollPeriod` không tự sinh lịch công chuẩn** từ `GeneralSetting`/`Holiday` như `BA_ANALYSIS_SPEC.md` Mục 4.1 khẳng định — hàm chỉ tạo record kỳ lương trơn | `payrollPeriods.service.ts:71-96` |

6 phát hiện 🟠 và 3 phát hiện 🟡 khác — xem đầy đủ tại `du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md` Mục 11.

### 19.5. Kết luận tích cực (đã kiểm, không phải giả định)

- Bất biến chặn sàn chuyên cần (BR-dltl-018) và bất biến công nợ thực lĩnh âm (BR-dltl-021) cài đúng, có unit test, khớp giữa 2 nơi tính độc lập (preview và tính lương thật).
- 4 category `SalaryItem` (`ATTENDANCE_ALLOWANCE`, `KPI_PERFORMANCE`, `PERIODIC_BONUS`, `COMMISSION_PERCENTAGE`) dùng đúng, khớp enum thật đã có sẵn từ "Cài đặt lương" — không có category bịa ra.
- Toàn vẹn giao dịch: mọi `apply` hàng loạt và `lock` đều bọc `db.$transaction`.
- Đa tenant: 4 controller đều gọi `resolveTenantDb(req)` đúng quy ước.
- Phần "Quản lý danh mục" (CRUD KPI/Sản phẩm/Chuyên cần/Bù trừ) và dialog "Tái sử dụng" của 6/8 module: nối API thật đúng như `walkthrough.md` liệt kê — walkthrough không sai toàn bộ, chỉ sai ở tuyên bố "100%" bao trùm cả phần Panel chính.

### 19.6. Mười câu hỏi mở (`OQ-dltl-001`…`010`) — chưa bịa câu trả lời

Đầy đủ ở `srs-du-lieu-tinh-luong.md` Mục 8. Đáng chú ý nhất: cấu hình `GeneralSetting` nên đọc động hay cố ý hardcode có ADR (`OQ-dltl-001`, `002`); "ADMIN" của Reopen map role nào thật (`OQ-dltl-004`); bảng audit log dùng chung hay tạo riêng (`OQ-dltl-003`); `PENDING_REVIEW` có thật sự nên "vẫn sửa được" hay cố ý đóng băng ở FE (`OQ-dltl-010`, xem lệch 3 tầng ở Mục 6.2 của SRS).

### 19.7. Phạm vi bằng chứng của chính đợt này — nói thẳng

Đợt này **chỉ đọc mã tĩnh** (schema, service, controller, route, validator, 1 file test, các file FE liệt kê ở 19.4). **Không tự chạy lại** `npm test`/`npm run typecheck`/`npm run lint`/`npm run build`, **không** gọi thử API bằng trình duyệt/Postman. Mọi con số "634 tests pass", "3/3 pass", "Build thành công" trong `walkthrough.md` **chưa được đợt này xác minh runtime** — chỉ được đánh giá là hợp lý về logic qua đọc tĩnh. Tester-QA Phase A/B phải tự chạy lại toàn bộ, không kế thừa số liệu cũ.

### 19.8. Trạng thái & Bước tiếp theo

**Status: CHƯA Ready for Implementation.** Tài liệu SRS chính thức: `docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md` (thay thế `BA_ANALYSIS_SPEC.md` trong vai trò nguồn chuẩn; `BA_ANALYSIS_SPEC.md` giữ làm vết lịch sử gap-analysis). Trình tự bắt buộc tiếp theo đúng `CLAUDE.md`: (1) Architect đọc SRS Mục 4–7, viết `api-contract-du-lieu-tinh-luong.md` + `data-model-du-lieu-tinh-luong.md`, ra ADR cho các OQ ảnh hưởng kiến trúc; (2) Tester-QA Phase A viết `test-matrix`/`test-cases` ưu tiên phủ 4 phát hiện 🔴; (3) chỉ sau khi Architect + QA phản biện xong, Business Analyst mới quay lại chốt Final Sign-off và đổi `Status` — **không kích hoạt Backend Engineer sửa lỗi trước khi có bước (1) và (2).**

### 19.9. Bước (1)+(2)+Code Review hoàn tất cùng ngày (2026-09-09, 17:10–17:40) — kết quả: KHÔNG đạt

Architect và Tester-QA chạy **song song, độc lập, không đọc chéo nhau** (đúng mô hình 3 Amigos đã chứng minh hiệu quả ở Mục 9), sau đó Code Reviewer chạy Quality Gate đọc cả 3 báo cáo trước để không trùng lặp. Cả 3 đều **xác nhận** 4 phát hiện 🔴 gốc của BA (Mục 19.4) là có thật, đồng thời **mỗi bên tự tìm thêm phát hiện 🔴 mới mà 2 bên kia không thấy** — đúng giá trị của việc không gộp vai:

| Nguồn | Phát hiện 🔴 mới (ngoài 4 cái gốc của BA) |
|---|---|
| Architect (`data-model-du-lieu-tinh-luong.md`, `api-contract-du-lieu-tinh-luong.md`) | **A-01**: 4 controller thiếu `assertXemLuong` — `OWNER_EMPLOYEE` có `xemLuong=false` vẫn đọc được lương/TNCN toàn công ty qua `GET /payroll/calculate` (lặp lại đúng lớp lỗi BUG-HRM-25/28 đã từng xảy ra ở phân hệ Hợp đồng, Mục 5.1). **A-02**: chọn hợp đồng tính lương bằng `orderBy ngay_bat_dau desc take 1`, không lọc theo kỳ — hợp đồng tương lai/đã hết hạn vẫn được dùng. **A-03**: `attendanceType` không bao giờ được đọc trong engine — nghỉ không lương vẫn trả đủ công. |
| Tester-QA (`qa-report-du-lieu-tinh-luong.md`) | Chỉ ~16% (12/76) kịch bản tự thiết kế từ SRS có test thật che phủ; phát hiện **1 test giả** (`hrmPayrollInputData.test.ts:417-425` tự assert với chính công thức của nó, không gọi code production — xóa `Math.max(0,...)` thật thì test vẫn PASS). Bug mới: `workDayValue` không chặn trần 1.0/ngày (`actualHours=24` → `workDayValue=3.0`, tràn dữ liệu công cụ thể). |
| Code Reviewer (`docs/hrm/review-findings.md` — review-findings **đầu tiên** của cả phân hệ HRM) | **RVW-001** (nghiêm trọng nhất toàn đợt): mô hình chấm công delta bị hiện thực SAI — engine coi `AttendanceRecord` (chỉ ghi qua `PUT /attendance/cell` khi có ngoại lệ) là lịch công CẢ THÁNG, nên chấm 1 NGÀY nghỉ không lương duy nhất → lương cơ bản tính ra = **0đ** thay vì gần đủ (thay vì ~25/26 công), và `lock` đóng băng số sai này vĩnh viễn. **RVW-002**: `(req.user as any)?.sub` — JWT payload dự án không có claim `sub` (đúng ra là `userId`) → `lockedByUserId`/`approvedByUserId` luôn `null`, mất dấu vết ai khóa sổ/duyệt. |

**Verdict cuối cùng: ❌ Request changes / FAILED — chưa Ready for Production.** Tổng cộng qua 4 lượt kiểm định độc lập: **~9 phát hiện 🔴 Blocking**, ~16 phát hiện 🟠, ~12 phát hiện 🟡/🟢 xuyên suốt 4 file (`srs-du-lieu-tinh-luong.md`, `data-model-du-lieu-tinh-luong.md`, `api-contract-du-lieu-tinh-luong.md`, `qa-report-du-lieu-tinh-luong.md`, `review-findings.md`). Đây là bằng chứng cụ thể tại sao Gate BA Sign-off + review độc lập không phải thủ tục hình thức: **9 lỗi 🔴 thật đã lọt qua đúng vì phiên trước gộp 3 vai vào 1 lượt viết** như chính Mục 9.1 cảnh báo trước đó. Ngoài lề: `docs/hrm/cai_dat_luong/data-model-cai-dat-luong.md` (status `approved`) cũng bị phát hiện lệch schema thật ở 5 mục — cần một phiên riêng cập nhật, ngoài phạm vi feature này.

**Chưa kích hoạt Backend Engineer sửa lỗi** — đang chờ quyết định của người dùng về việc có tiến hành sửa ngay hay không (khối lượng sửa lớn: engine tính lương, quyền xem lương, JWT claim, 22+ file FE cần đấu nối, ~64 kịch bản test còn thiếu).

*(Cập nhật thực tế, không phải BA ghi lúc đó): 2 phiên kế tiếp trong cùng ngày (`work-log.md` 18:30 backend-engineer, 17:55 frontend-engineer — do user kích hoạt tường minh) đã sửa 8/9 lỗi 🔴 và nối API thật cho 23/23 file FE còn mock của 8 phân hệ nhập liệu. Xem Mục 19.10 cho đợt kiểm định tiếp theo (2026-09-10, nhiệm vụ khác: Bảng lương tổng hợp).*

### 19.10. Đợt kiểm định mới — Bảng lương tổng hợp (`bang_luong`) & đối chiếu thuế/bảo hiểm VN (Business Analyst, 2026-09-10)

**Nhiệm vụ khác với 19.1–19.9**: 19.1–19.9 kiểm định cụm "8 phân hệ nhập liệu + vòng đời kỳ lương" (nay ổn định). Đợt này phục vụ yêu cầu mới của user: dựng chức năng **Bảng lương tổng hợp** trong `be_maxv` rồi gán API thay thế mock tại `hdđt_maxv/src/features/hrm/components/bang_luong` (18 cột + tab "Lương hỗ trợ") — UI này **chưa từng được đấu nối**, 100% còn đọc `mock/hooks/bangLuong.ts` + kho giả `useHrmStore()`.

**Đã làm**: đọc `payrollCalculation.service.ts` thật (bản đã FIXED 2026-09-09, không phải bản mô tả cũ ở Mục 19.4), `review-findings.md` (đối chiếu FIXED/OPEN thật), schema `GeneralSetting`/`SalaryItem`/`SalaryStructureItem`/`EmployeeSalaryItem`/`OvertimeRecord`, `mock/hooks/bangLuong.ts` + `calculations/bang_luong/bangLuong.ts` (công thức FE mẫu), `docs/nestjs/payroll/CONTEXT_SUMMARY.md` (chỉ lấy business rule luật định tham khảo, không lấy schema/code).

**Kết quả** — đầy đủ tại `du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md` Mục 15:
- **7/10 OQ cũ đã có hướng giải quyết** (OQ-dltl-001/003/004/006/007/009 chốt xong; OQ-dltl-002 chốt một nửa — bảo hiểm/đoàn phí đã đọc cấu hình, biểu thuế TNCN khuyến nghị nối `GeneralSetting.taxBrackets` nhưng để Architect ra ADR; OQ-dltl-005 chốt hướng "cảnh báo, không chặn cứng", thiết kế cộng dồn năm để Architect; OQ-dltl-008 gộp vào OQ-dltl-010; OQ-dltl-010 chốt 1 chuẩn "PENDING_REVIEW đóng băng ghi dữ liệu cả 3 tầng" — phát sinh 1 gap kỹ thuật cụ thể cho Architect ở `payrollPeriodLockGuard.ts`).
- **4 Business Rule mới phát hiện thiếu, đối chiếu luật VN** (`BR-dltl-024…027`): 2 trần bảo hiểm độc lập BHXH+BHYT (46.8tr) vs BHTN (99.2tr) — hiện gộp 1 tỷ lệ không trần nào; miễn thuế phần tăng ca vượt chuẩn (Điều 3 TT111/2013) — hiện tính thuế 100% OT; khấu trừ 10% tại nguồn cho HĐ thử việc/thời vụ (Điều 25 TT111/2013) — hiện luôn áp biểu lũy tiến bất kể `loai_hd`; trần miễn thuế ăn trưa 730k/tháng (TT26/2016) — hệ quả của gap lớn hơn (engine chưa đọc nhóm `FIXED_ALLOWANCE`/`BENEFIT_ALLOWANCE`).
- **1 xung đột nguồn sự thật nghiêm trọng, KHÔNG tự chốt được** (`OQ-dltl-011` mới): FE mock coi "Cài đặt lương" (`EmployeeSalaryItem` nhóm phụ cấp) là nguồn cột "Lương"; engine thật coi "Hợp đồng" (`luong_chinh`) là nguồn duy nhất, bỏ qua hoàn toàn nhóm phụ cấp. Đây là quyết định nghiệp vụ ảnh hưởng số tiền hiển thị của MỌI nhân viên — **cần user/kế toán trưởng xác nhận**.
- **Gap API rõ ràng** (không tranh cãi, Architect làm được ngay): field `otRawHours` (giờ OT gốc chưa quy đổi — dữ liệu đã có trong `OvertimeRecord.hours`, chỉ cần cộng vào response `GET /payroll/calculate`); endpoint mới `GET /payroll/support-allowances?periodId=` cho tab "Lương hỗ trợ" (breakdown theo từng khoản `BENEFIT_ALLOWANCE`).
- **Lưu ý pháp lý quan trọng, KHÔNG tự áp dụng**: tài liệu tham khảo `docs/nestjs/payroll` có nhắc biểu thuế TNCN 2026 mới (5 bậc) và giảm trừ gia cảnh mới (15,5tr/6,2tr) — CHƯA xác nhận hiệu lực, chính tài liệu đó cũng ghi "kế toán phải đối chiếu lại". BA không áp các con số này vào bất kỳ file nào.

**Status: CHƯA Ready for Implementation** cho phần Bảng lương tổng hợp. Việc cần làm tiếp theo: (1) hỏi user OQ-dltl-011 (nguồn cột "Lương") + xác nhận có áp dụng bộ số liệu thuế 2026 mới hay giữ nguyên luật hiện hành; (2) sau khi có OQ-dltl-011, Architect thiết kế mở rộng `payrollCalculation.service.ts` + API contract theo Mục 15.3/15.5/15.6 của SRS; (3) Tester-QA Phase A viết test case cho `BR-dltl-024…027`; (4) BA quay lại Final Sign-off riêng cho cụm này.

### 19.11. Tester-QA — Phase A hoàn tất: Test Matrix & Test Cases cho Bảng lương tổng hợp (2026-09-10)

**Đã làm**: đối chiếu chéo `srs-du-lieu-tinh-luong.md` Mục 15 (BA cập nhật song song cùng ngày) với `payrollCalculation.service.ts` thật + schema `GeneralSetting`/`SalaryItem`/`EmployeeSalaryItem`/`SalaryStructureItem`/`OvertimeRecord`/`hrm_hop_dong`, dựa trên 2 quyết định đã chốt của chủ dự án (nguồn lương cơ bản hybrid `luong_chinh` + phụ cấp cố định `EmployeeSalaryItem`; giữ nguyên biểu thuế TNCN 7 bậc) và 4 Business Rule mới `BR-dltl-024…027`. Thiết kế xong **44 test case** (8 nhóm: nguồn lương cơ bản, biểu thuế 7 bậc, 2 trần bảo hiểm, miễn thuế OT, khấu trừ 10% HĐ thử việc/thời vụ, trần ăn trưa 730k, endpoint mới `GET /payroll/support-allowances`, regression 3 bất biến tài chính cũ) dạng Given/When/Then với số liệu tài chính cụ thể, đủ dùng làm TDD cho Backend Engineer. Xuất `docs/hrm/du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md`.

**Phát hiện đối chiếu chéo — 8 gap (GAP-QA-01…08), 3 mức 🔴 chặn một phần thiết kế test**:
- 🔴 GAP-QA-01: quyết định "phụ cấp cố định" của chủ dự án chưa nói rõ gộp category `FIXED_ALLOWANCE` hay cả `BENEFIT_ALLOWANCE` — ảnh hưởng trực tiếp cách tách khoản ăn trưa (BR-dltl-027) ra khỏi cột "Lương".
- 🔴 GAP-QA-02: chưa rõ phần phụ cấp cố định quy đổi theo công CHUNG 1 tỷ lệ với `luong_chinh` hay mỗi khoản tự quy đổi theo `SalaryStructureItem.calculationMethod` riêng.
- 🔴 GAP-QA-05: BR-dltl-025 (miễn thuế OT) có áp dụng cho HĐ thử việc/thời vụ (BR-dltl-026, khấu trừ thẳng 10% trên gross, không qua `taxableIncome`) hay không — chưa có căn cứ để viết 1 test case cụ thể (`TC-blth-029` để trống, đánh Open).
- 5 gap 🟡/🟢 khác (rounding 2 trần BH, ngưỡng 2tr tính trên gross hay lương cơ bản, response shape endpoint mới chưa có, xử lý nhân viên không có khoản `BENEFIT_ALLOWANCE`, hành vi `EmployeeSalary` không lọc `effectiveFrom`/`effectiveTo`) không chặn thiết kế nhưng cần chốt trước khi coi kết quả Phase B là đúng nghiệp vụ.

**KHÔNG làm** (đúng phạm vi Phase A): không sửa production code, không chạy test thật (chưa có code Backend Engineer viết cho phần mở rộng), không tự đoán số liệu cho phần bị gap 🔴 chặn (để trống + đánh dấu Open thay vì bịa).

**Khuyến nghị**: Architect có thể thiết kế/code song song ngay phần KHÔNG phụ thuộc gap 🔴 (2 trần bảo hiểm BR-dltl-024, miễn thuế OT BR-dltl-025 phần công thức chính, khấu trừ 10% BR-dltl-026, endpoint `support-allowances` ở mức hành vi). Phần đọc "Lương"/"phụ cấp ăn trưa" (Nhóm 1, Nhóm 6) nên khoan code tới khi GAP-QA-01/02 được chốt bằng văn bản. Đề nghị BA cập nhật ngược `srs-du-lieu-tinh-luong.md` Mục 8 để đánh dấu `OQ-dltl-011` đã RESOLVED (quyết định chủ dự án) và bổ sung chính thức `BR-dltl-028`/`BR-dltl-029` (hiện là ID QA tự đề xuất trong test matrix, chờ BA/Architect chính thức hóa).

### 19.12. BA — Chốt công thức 4 BR mới + giải đáp trực tiếp GAP-QA-01/02/05 (Business Analyst, cùng ngày 2026-09-10, sau Mục 19.10/19.11)

**Nhiệm vụ**: chủ dự án đã trực tiếp xác nhận 2 quyết định nghiệp vụ còn treo ở Mục 19.10 (KHÔNG phải BA tự suy đoán):
1. **OQ-dltl-011 (nguồn cột "Lương"):** Hợp đồng (`luong_chinh`) **CỘNG THÊM** phụ cấp cố định từ Cài đặt lương (`EmployeeSalaryItem`) — 2 tầng dữ liệu bổ sung nhau, KHÔNG thay thế nhau.
2. **Biểu thuế TNCN:** giữ nguyên luật hiện hành 7 bậc, giảm trừ gia cảnh 11tr/4.4tr — KHÔNG áp bộ số liệu 2026 mới (5 bậc, 15.5tr/6.2tr) mà `docs/nestjs/payroll` có nhắc tới.

**Đã làm**: viết đầy đủ công thức + Acceptance Criteria (12 AC mới, `AC-dltl-12…23`) cho `BR-dltl-024…027` vào `srs-du-lieu-tinh-luong.md` Mục 15.3.1 (đủ chi tiết field-level theo đúng tên biến thật của `payrollCalculation.service.ts` để Architect thiết kế thẳng, Backend code thẳng); chốt field mapping cột "Lương" ở Mục 15.4 (`baseSalaryMonthly = luong_chinh + fixedAllowanceTotal`, có lưu ý kỹ thuật tách `contractBaseSalary` khỏi `fixedAllowanceTotal` cho `hourlyRate`/quy đổi công); cập nhật Mục 15.5/15.9 danh sách 8 field mới cần bổ sung vào response `GET /payroll/calculate`; ghi biên bản quyết định Mục 15.8; bổ sung 2 Edge Case mới `EC-dltl-06/07` (phạm vi chưa áp dụng của BR-dltl-026: `xac_dinh` ngắn hạn và `khoan`) và `NFR-dltl-007`.

**Phát hiện quan trọng khi đối chiếu chéo với Tester-QA Phase A (Mục 19.11, chạy song song):** QA tự đặt giả định KHÁC cho `GAP-QA-01` trong `test-matrix-bang-luong-tong-hop.md` — QA giả định "phụ cấp cố định" chỉ gồm category `FIXED_ALLOWANCE`, loại trừ `BENEFIT_ALLOWANCE` (khoản ăn trưa). **Giả định này SAI** so với chỉ đạo gốc của chủ dự án (đã nêu ví dụ tường minh "ăn trưa, trách nhiệm" là phụ cấp cố định cần cộng thêm) — BA đã giải đáp dứt điểm cả 3 gap 🔴 của QA (`GAP-QA-01`, `GAP-QA-02`, `GAP-QA-05`) ngay trong `srs-du-lieu-tinh-luong.md` Mục 15.10, kèm sửa luôn 1 thiếu sót tự phát hiện trong chính công thức BA vừa viết (BR-dltl-026 thiếu gate `tinh_tncn` — đã bổ sung, trả lời luôn `TC-blth-029` QA để ngỏ). **Đề nghị QA cập nhật lại test matrix Nhóm 1/5/6 theo Mục 15.10** ở lượt làm việc kế tiếp — BA không tự sửa file của QA.

**Trạng thái sau đợt này**: đặc tả nghiệp vụ cho "Bảng lương tổng hợp" đã **chốt đủ** — không còn quyết định nghiệp vụ nào bỏ ngỏ bắt buộc trước khi code (còn đúng 2 gap KỸ THUẬT, không phải nghiệp vụ, dành cho Architect quyết: cách nhận diện `isMealAllowance` trong `SalaryItem` cho BR-dltl-027, và thiết kế chi tiết tách `contractBaseSalary`/`fixedAllowanceTotal`). **Status: Đặc tả đã chốt đủ — sẵn sàng cho Phase 2 Architect ∥ Tester-QA** (Architect + Tester-QA đã và đang chạy song song ngay trong phiên này, không cần chờ BA). Chưa phải "Ready for Implementation" — còn chờ Phase 2 hoàn tất phản biện rồi BA quay lại Final Sign-off theo đúng quy trình 3 Amigos ở `CLAUDE.md`, cập nhật `Status` lần cuối trước khi kích hoạt Backend Engineer.

**Không có câu hỏi mở mới cần user quyết thêm** — mọi gap còn lại (bao gồm GAP-QA-01/02/05 vừa đóng, và 2 gap kỹ thuật `isMealAllowance`/tách biến `baseSalaryMonthly`) đều thuộc thẩm quyền Architect, không cần quay lại hỏi chủ dự án.

### 19.13. Architect — Phase 2 hoàn tất: Data Model + API Contract + ADR-010 cho Bảng lương tổng hợp (2026-09-10, sau Mục 19.10–19.12)

> ⚠️ **Các con số trong mục này đã bị Mục 19.15 thay thế** (sau khi chủ dự án chốt `Q-1`): **19 cột** schema chứ không phải 18 (`PayrollSheetLine` 15 chứ không phải 14), **44 trường** response chứ không phải 43, **9 quyết định** `QĐ-1…QĐ-9` chứ không phải 8, **4 ràng buộc thứ tự** chứ không phải 3. Mục này giữ nguyên như biên bản của đợt làm việc đó — đọc **19.15** để lấy số hiện hành.

**Đầu vào:** SRS Mục 15 (đầy đủ tới 15.10, gồm công thức `BR-dltl-024…027` + `AC-dltl-12…23` + giải đáp `GAP-QA-01/02/05`), 2 quyết định nghiệp vụ của chủ dự án (Mục 15.8), mã nguồn thật (`payrollCalculation.service.ts` bản 2026-09-09, `schema.prisma` tenant, `payrollAccessGuard`, module `cai_dat_luong`), và giao diện đích (`cotBangLuong.ts`, `types/index.ts`, `mock/hooks/bangLuong.ts`).

**Sản phẩm (3 tài liệu):**
- `du_lieu_tinh_luong/data-model-du-lieu-tinh-luong.md` **Mục 11** (mới) — 18 cột thêm vào `prisma/tenant/schema.prisma`: 3 cột `GeneralSetting` (`lunchAllowanceTaxFreeCap` 730.000 · `withholdingTaxRate` 10% · `withholdingTaxThreshold` 2.000.000), 1 cột `SalaryItem` (`isMealAllowance`), 14 cột `PayrollSheetLine`. Kèm chiến lược di trú qua `npm run sync:tenants` (thuần additive, mọi cột có `@default`), ranh giới giao dịch, chỉ mục (không thêm index mới).
- `du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md` **Mục 8** (mới) — DTO đầy đủ `GET /payroll/calculate` (43 trường, 14 trường mới, ví dụ số liệu nhất quán dùng làm dữ liệu mồi test), endpoint MỚI `GET /payroll/support-allowances?periodId=` cho tab "Lương hỗ trợ", bảng ánh xạ 18 cột UI ↔ trường API, 7 thay đổi hành vi (B-1…B-7), ảnh hưởng chéo sang `settings/general` + `salary-items`.
- `architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md` (mới) — pipeline **10 bước** với 3 ràng buộc thứ tự bắt buộc, 8 quyết định (QĐ-1…QĐ-8), 9 phương án đã cân nhắc và bác, trade-off, hệ quả.

**Các gap kỹ thuật mà BA để mở đã được chốt:** (a) nhận diện khoản ăn ca → cờ `SalaryItem.isMealAllowance` (đúng phương án (a) BA khuyến nghị, bác enum và bác quy ước theo `code`); (b) tách `contractBaseSalary` / `fixedAllowanceTotal` / `allowanceInPeriodTotal` khỏi `baseSalaryMonthly`, đơn giá giờ OT tính trên `contractBaseSalary` mở rộng bằng cột `SalaryStructureItem.isOvertimeBase` đang có sẵn mà chưa ai dùng; (c) ngưỡng 2.000.000đ + thuế suất 10% thành **cột cấu hình**, còn hệ số trần bảo hiểm `× 20` giữ làm **hằng số có trích dẫn luật** (khớp nhận định BA "không cần field DB mới").

**Ba câu hỏi Architect KHÔNG tự chốt, cần BA/kế toán trưởng trả lời** (ghi ở cuối ADR-010) — **Q-1 và Q-2 nay đã đóng, xem Mục 19.14**:
- **Q-1 🔴** ✅ *(đã chốt 2026-09-10 — xem 19.14)* — Công thức SRS Mục 15.3.1 **bỏ qua hoàn toàn** `SalaryItem.isTaxable` và `SalaryStructureItem.taxTreatment`: mọi phụ cấp đều vào thu nhập chịu thuế, chỉ ăn ca (tới trần) và phần OT vượt chuẩn được miễn. Nghĩa là ô tick "chịu thuế TNCN" ở màn Khoản lương **hiện không có tác dụng gì** với bảng lương. Bật hai cột đó lên là **mở rộng phạm vi miễn thuế** — quyết định nghiệp vụ, không phải kỹ thuật.
- **Q-2 🟡** ✅ *(đã chốt 2026-09-10 — xem 19.14)* — Nếu Q-1 chốt "có miễn": ưu tiên `taxTreatment` (cấu trúc lương) hay `isTaxable` (danh mục) khi hai bên khai ngược nhau.
- **Q-3 🟡** ⏳ *(còn mở)* — Cột UI "Lương theo ngày" chỉ hiện phần hợp đồng (đúng SRS 15.5) hay gồm cả phụ cấp đã quy đổi (đúng bản mock FE). API trả **cả hai trường** nên chốt sau cũng không phải đổi hợp đồng.

**Hai điểm Architect chủ động khác với bản dựng hiện tại, đã ghi rõ để QA/BA soát:** (1) `contractType`/`salaryType` trả `null` khi nhân viên không có hợp đồng hiệu lực trong kỳ, thay cho `"khong_xac_dinh"`/`"GROSS"` bịa sẵn (giá trị `"GROSS"` chữ hoa còn không khớp `gross`/`net` lưu trong DB nên mọi bộ lọc theo kiểu lương đều trượt); (2) đoàn phí công đoàn **không** phải khoản giảm trừ thuế TNCN — bản mock Frontend đang trừ sai, engine giữ đúng, Frontend phải sửa mock.

**Nợ ghi nhận, cố ý KHÔNG làm trong đợt này:** nối `GeneralSetting.taxBrackets` vào engine (hiện kế toán sửa biểu thuế thì bảng lương không đổi một đồng, im lặng — ADR-010 QĐ-6 giải thích vì sao hoãn) · `A-06` kiểu `Decimal` ra chuỗi ở nhánh snapshot · `unionFeeMaxAmount` lưu số tuyệt đối · `OQ-dltl-005`, `OQ-dltl-010`.

**Trạng thái:** Phase 2 (Architect) **xong**. Chờ Tester-QA đối chiếu bộ 44 ca kiểm với hợp đồng vừa chốt (đặc biệt tên trường: bám đúng SRS 15.3.1, có bổ sung `allowanceInPeriodTotal`, `mealAllowanceAmount`, `lunchAllowanceExemptAmount`, `insuranceBaseBhxhByt/Bhtn`, `engineVersion`) rồi **BA Final Sign-off**. **Chưa `Ready for Implementation`** — Backend Engineer chưa được khởi chạy.

### 19.14. Tester-QA — Rà soát lần 2: đóng GAP-QA-01/02/05, bổ sung Nhóm 9 cho quyết định Q-1 (2026-09-10, sau Mục 19.13)

**Vì sao chạy lại:** chủ dự án ra quyết định mới giải quyết câu hỏi Q-1 mà Architect nêu ở cuối `ADR-010` (Mục 19.13): hệ thống phải **tôn trọng ô tick "chịu thuế TNCN"** có sẵn ở màn "Khoản lương" (`SalaryItem.isTaxable`) — khoản phụ cấp cố định nào được đánh dấu miễn thuế thì thực sự bị trừ khỏi thu nhập tính thuế, không còn giới hạn ở 2 ngoại lệ cứng (OT vượt chuẩn, ăn trưa trong trần 730k). Quyết định này được truyền đạt cho Tester-QA qua orchestrator, đồng thời là dịp rà lại toàn bộ 44 test case theo đúng `srs-du-lieu-tinh-luong.md` Mục 15.10 (giải đáp `GAP-QA-01/02/05`) và pipeline 10 bước của `ADR-010`.

**Đã làm:** đọc lại `test-matrix-bang-luong-tong-hop.md` (bản lượt 1), `srs-du-lieu-tinh-luong.md` Mục 15.10, và `ADR-010-pipeline-thue-bao-hiem-bang-luong.md` đầy đủ. Cập nhật số liệu Nhóm 1 (nguồn "Lương" gồm cả `FIXED_ALLOWANCE` + `BENEFIT_ALLOWANCE`, tách rõ `baseSalaryMonthly` không quy đổi công khỏi `allowanceInPeriodTotal` có quy đổi công riêng từng khoản), Nhóm 4 (đổi cơ sở tính `otHourlyRate` từ `baseSalaryMonthly` sang `contractBaseSalary + isOvertimeBase`, thêm 2 test case chặn nguy cơ regression B-5), Nhóm 5 (đóng `TC-blth-029`, làm rõ ngưỡng khấu trừ dùng `thuNhapTruocGiamTru`), Nhóm 6 (ghi chú liên kết với `GAP-QA-01` đã đóng). Đóng `GAP-QA-01/02/05` trong Mục 0 kèm căn cứ trích dẫn. Bổ sung **Nhóm 9 (6 test case mới, `TC-blth-045…050`)** cho quyết định Q-1, kèm công thức giả định tường minh (QA tự đề xuất field `otherAllowanceTaxExemptAmount`, quy tắc chống trừ trùng khi 1 khoản vừa `isMealAllowance` vừa `isTaxable=false`). Tổng test case: **44 → 53** (9 nhóm).

**Phát hiện quan trọng — mâu thuẫn giữa nguồn chỉ đạo và văn bản ADR-010:** khi đọc lại `ADR-010-pipeline-thue-bao-hiem-bang-luong.md` (bản `2026-09-10 10:59`) để đối chiếu quyết định Q-1, QA thấy file này **vẫn liệt Q-1 là câu hỏi mở** với hành vi mặc định đang thiết kế là "bỏ qua" `isTaxable`/`taxTreatment` — TRÁI với quyết định "tôn trọng tick" được truyền đạt cho QA qua orchestrator. Đây KHÔNG phải lỗi của QA hay của Architect — đơn thuần là 2 agent chạy song song, quyết định mới của chủ dự án đến với QA trước khi Architect kịp cập nhật ADR. Tester-QA đã đánh dấu rõ (`GAP-QA-09`) và dùng quyết định mới làm giả định thiết kế test (Nhóm 9), KHÔNG coi là final. **Đề nghị Architect cập nhật lại `ADR-010`** xác nhận bằng văn bản: (a) tên field trả về chính thức cho phần miễn thuế mới, (b) quy tắc chống trừ trùng khi 1 khoản phụ cấp vừa `isMealAllowance=true` vừa `isTaxable=false` (QA giả định: chỉ áp 1 lớp — trần luật định BR-dltl-027 thắng, không cộng thêm miễn toàn bộ theo `isTaxable`, tránh miễn vượt luật định 730k).

**Trạng thái GAP-QA sau lượt này:** `GAP-QA-01`, `GAP-QA-02`, `GAP-QA-05` — **✅ ĐÃ ĐÓNG** (căn cứ SRS Mục 15.10 + `ADR-010`). `GAP-QA-03/04/06/07/08` — giữ nguyên mức độ như lượt trước (🟡/🟢, không chặn). `GAP-QA-09` (mới) — 🔴 chặn việc coi Nhóm 9 là final, không chặn việc viết test, không chặn tiến độ Nhóm 1–8.

**Tài liệu đã cập nhật ở đợt này:** `du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md` (viết lại toàn bộ, 44 → 53 test case) · `CONTEXT_SUMMARY.md` (mục này).

**Trạng thái & bước tiếp theo:** Nhóm 1–8 (47 test case) đã sẵn sàng cho Backend code theo đúng `ADR-010` hiện hành, không còn gap 🔴 nào chặn. Nhóm 9 (6 test case, quyết định Q-1) **CHƯA sẵn sàng** — cần Architect cập nhật `ADR-010` chốt Q-1/Q-2 bằng văn bản trước. Đề nghị: (1) Architect cập nhật `ADR-010` theo quyết định Q-1 mới nhận được; (2) BA xác nhận lại `GAP-QA-06` (field `thuNhapTruocGiamTru` làm cơ sở ngưỡng khấu trừ 10%) bằng văn bản nếu có thời gian, không bắt buộc; (3) sau khi (1) xong, BA Final Sign-off có thể tiến hành cho Nhóm 1–8 độc lập với Nhóm 9, hoặc chờ gộp chung — tùy quyết định BA/chủ dự án về việc có tách đợt triển khai Q-1 riêng hay không.

### 19.15. Architect — Chốt `Q-1`/`Q-2` bằng văn bản, đóng `GAP-QA-09` (2026-09-10, sau Mục 19.13–19.14)

**Quyết định của chủ dự án (2026-09-10) — dữ kiện nghiệp vụ, Architect không được đổi:** `Q-1` chốt theo phương án **"Tôn trọng ô tick đã có"**. Khoản phụ cấp mà kế toán tick "chịu thuế TNCN" = false ở màn "Khoản lương" phải **thực sự** được trừ khỏi thu nhập tính thuế — **không** còn giới hạn ở hai ngoại lệ cứng (ăn ca trong trần 730k, OT vượt chuẩn) như bản nháp `ADR-010` đầu tiên. Đây là **quyết định nghiệp vụ thứ 3** của module này, đứng cạnh 2 quyết định đã có ở SRS Mục 15.8.

**Công thức miễn thuế cuối cùng — 3 cấu phần, các giỏ LOẠI TRỪ NHAU** (`ADR-010` bước [5], QĐ-9):

```
5a. Duyệt TỪNG khoản phụ cấp đã cộng ở [2], mỗi khoản vào ĐÚNG MỘT giỏ (if / else if):
      (i)   isMealAllowance = true                        → giỏ ĂN CA          (bỏ qua ô tick)
      (ii)  taxTreatment = EXEMPT ∨ isTaxable = false      → giỏ MIỄN THEO KHAI BÁO
      (iii) còn lại                                        → chịu thuế
    mealAllowanceAmount           = Σ giỏ (i)   — số TRONG KỲ (đã quy đổi công)
    otherAllowanceTaxExemptAmount = Σ giỏ (ii)  — số TRONG KỲ (đã quy đổi công)

5c. lunchAllowanceExemptAmount = min(mealAllowanceAmount, round(730.000 × tyLeCong))
    lunchAllowanceTaxableAmount = mealAllowanceAmount − lunchAllowanceExemptAmount

5d. tongMienThue        = otTaxExemptAmount + lunchAllowanceExemptAmount + otherAllowanceTaxExemptAmount
    thuNhapTruocGiamTru = grossIncome − tongMienThue      (dùng cho CẢ 2 nhánh thuế ở [8])
```

**Bốn điểm Architect chốt kèm** (chi tiết + lý do ở `ADR-010` QĐ-9.1…9.4):
- **QĐ-9.1 — phạm vi có giới hạn:** chỉ áp cho **phụ cấp cố định** (`FIXED_ALLOWANCE` / `BENEFIT_ALLOWANCE` đi vào `allowanceInPeriodTotal`). Thưởng / hoa hồng / KPI / lương sản phẩm / chuyên cần **giữ nguyên là chịu thuế**, dù `BonusRecord`/`CommissionRecord` cũng trỏ `SalaryItem` có `isTaxable` — luật chỉ miễn thưởng kèm danh hiệu Nhà nước, và giữ phạm vi hẹp thì các cấu phần đó **không đổi một đồng** so với hôm nay.
- **QĐ-9.2 — chốt `Q-2` bằng phép OR** (`EXEMPT` **hoặc** `isTaxable = false` là đủ), **đảo ngược** mặc định "cấu trúc lương thắng" ghi ở bản nháp trước. Lý do: `taxTreatment` có `@default(TAXABLE)` ở cả schema (`1261`) lẫn validator (`salaryStructures.validator.ts:17`) ⇒ cho `TAXABLE` quyền phủ quyết thì ô tick tiếp tục vô hiệu đúng trong ca phổ biến nhất, tức chốt `Q-1` trên giấy mà không có tác dụng thật. `EXEMPT`/`false` là khai báo có chủ đích; `TAXABLE`/`true` có thể chỉ là giá trị mặc định chưa ai đụng.
- **QĐ-9.3 — khoản ăn ca chỉ áp MỘT lớp, trần thắng ô tick.** Đây là **ca phổ biến chứ không phải ca biên** (`KL08` "Phụ cấp tiền cơm" trong dữ liệu mẫu của dự án đang để `chiu_thue_tncn: false`). Cộng dồn hai lớp = miễn 1.573.846 trên khoản chỉ có 900.000 tiền thật ⇒ khai thiếu thuế. Cho tick thắng thì `BR-dltl-027` chết ngay khi ra đời. Ràng buộc bắt buộc: hiện thực bằng `if/else if` trên **cùng một vòng lặp**, và `mealAllowanceAmount + otherAllowanceTaxExemptAmount ≤ allowanceInPeriodTotal`.
- **QĐ-9.4 — tên trường:** **`otherAllowanceTaxExemptAmount`**, lấy đúng tên Tester-QA đã đặt ở Nhóm 9. **Không** đổi tên `lunchAllowanceTaxableAmount` (nghĩa ngược nhau — một bên là phần **vượt trần chịu thuế**, một bên là phần **miễn**).

**`GAP-QA-09` — ✅ ĐÃ ĐÓNG.** Hai câu QA hỏi đều được trả lời bằng văn bản: (a) tên trường = `otherAllowanceTaxExemptAmount` (đúng tên QA đề xuất); (b) quy tắc chống trừ trùng — **giả định của QA đúng**, nay là QĐ-9.3 chính thức. **Nhóm 9 (`TC-blth-045…050`) chuyển sang "final", không phải sửa số liệu ca nào**, chỉ gỡ nhãn "CHƯA final" + trỏ căn cứ về QĐ-9. Ba ca nên **thêm** cho nhánh chưa phủ: `EXEMPT` + `isTaxable=true` ⇒ vẫn miễn · `isMealAllowance=true` + `isTaxable=true` ⇒ vẫn miễn tới trần · thưởng/hoa hồng `isTaxable=false` ⇒ vẫn chịu thuế.

**Hai vấn đề 🟠 nêu ở lượt trước — đối chiếu lại, KẾT LUẬN GIỮ NGUYÊN:** (1) **đoàn phí công đoàn** bị mock FE trừ sai vào thu nhập tính thuế — `Q-1` mở rộng phạm vi *miễn thuế của phụ cấp*, không đụng *danh sách khoản giảm trừ* của Điều 9 TT 111/2013, nên **QĐ-5 nguyên vẹn**: engine không trừ, Frontend sửa mock; (2) **`AC-dltl-19` gộp 2 tình huống `withholdingTaxApplied = false`** — `Q-1` đổi *gốc tính thuế*, không đổi *cách rẽ nhánh phương pháp* ở bước [8], nên giữ nguyên giá trị cờ (QA đã bám vào), giao diện muốn hiện phương pháp phải xét thêm `contractType`.

**Thay đổi tài liệu:** `ADR-010` (bước [5] viết lại, ràng buộc thứ tự thứ 4, QĐ-9 mới, 5 phương án bác bổ sung, Q-1/Q-2/Q-1b/`GAP-QA-09` chuyển sang mục "Đã chốt") · `data-model` Mục 11 (**+1 cột snapshot** `otherAllowanceTaxExemptAmount` ⇒ `PayrollSheetLine` **14→15 cột**, tổng **18→19 cột**; Mục **11.3.1** mới về quy tắc đọc 2 cột nguồn; thêm bước rà soát dữ liệu tick trước khi bật trên production) · `api-contract` Mục 8 (**43→44 trường**, ví dụ số liệu tính lại nhất quán, `thu_nhap_chiu_thue` nay **4 số hạng**, thêm thay đổi hành vi **B-8**). **Không** thêm cột nguồn, **không** thêm enum, **không** thêm mã lỗi — hai cột `isTaxable`/`taxTreatment` đã tồn tại và CRUD đã chạy đủ từ lâu; đợt này chỉ là engine bắt đầu **đọc** chúng.

**Cảnh báo triển khai (dành cho Backend + người bàn giao):** đây là lần đầu ô tick có hiệu lực ⇒ **thuế TNCN sẽ giảm ngay** ở mọi công ty đang để `isTaxable = false` cho phụ cấp, xuất hiện **cùng lúc** với thay đổi cột "Lương" (B-1). Phải chạy thống kê rà soát trước khi bật production (`data-model` Mục 11.7 bước 6) và báo trước cho người dùng. Công ty chưa từng đổi 2 cột đó ⇒ `otherAllowanceTaxExemptAmount = 0` ⇒ **số y hệt cũ**.

**Trạng thái:** câu hỏi mở của Architect còn đúng **`Q-3`** (cột UI "Lương theo ngày" — thuần hiển thị, API đã trả cả 2 trường nên không chặn Backend). **Chưa `Ready for Implementation`** — chờ BA Final Sign-off, kèm việc BA bổ sung `AC` cho `otherAllowanceTaxExemptAmount` vào SRS Mục 15.3.1 (công thức BA viết hiện chưa có bước [5a] phân giỏ).

### 19.16. Biên bản chốt BA Final Sign-off — Bảng lương tổng hợp (Business Analyst, 2026-09-10, sau Mục 19.13–19.15)

**Việc Architect bàn giao (`api-contract-du-lieu-tinh-luong.md` Mục 8.7):** bổ sung Acceptance Criteria cho field `otherAllowanceTaxExemptAmount` vào `srs-du-lieu-tinh-luong.md` Mục 15.3.1 — công thức BA viết lần đầu chưa có bước tương đương [5a] của `ADR-010` (duyệt từng khoản phụ cấp vào 3 giỏ theo QĐ-9). **Đã làm:** thêm mục "Quyết định nghiệp vụ 3 (`Q-1`)" ngay sau `AC-dltl-23`, gồm công thức phân giỏ khớp nguyên văn `ADR-010` bước [5a] (thứ tự `isMealAllowance` → `taxTreatment=EXEMPT ∨ isTaxable=false` → chịu thuế) và **5 AC mới `AC-dltl-24…28`** (khoản khai miễn vẫn được trả đủ lương nhưng trừ khỏi thuế; phép OR khi `taxTreatment`/`isTaxable` khai ngược nhau; khoản vừa ăn ca vừa khai miễn chỉ áp 1 lớp — chống cộng đôi; phạm vi KHÔNG áp cho thưởng/hoa hồng; regression khi không khoản nào khai miễn). Đồng thời cập nhật Mục 15.5 (dòng `thue_tncn`) và Mục 15.9 (bảng field mới 8→9, thêm dòng `otherAllowanceTaxExemptAmount`) cho khớp; đóng dấu ✅ vào gap kỹ thuật `isMealAllowance` đã được Architect chốt (QĐ-4) trong Mục 15.3.1.

**Đối soát chéo SRS ↔ `ADR-010` ↔ `data-model` Mục 11 ↔ `api-contract` Mục 8 ↔ `test-matrix-bang-luong-tong-hop.md`:** tên trường, công thức, thứ tự tính (pipeline 10 bước), phạm vi 44→53 test case — khớp nhau, **không phát hiện mâu thuẫn nghiệp vụ mới nào cần quyết định của chủ dự án**.

**Một phát hiện kỹ thuật nhỏ, KHÔNG chặn Sign-off:** `test-matrix-bang-luong-tong-hop.md` (Mục 0, Mục 6, header Nhóm 9, `TC-blth-050`) vẫn còn nhãn vật lý "⚠️ GAP-QA-09, CHƯA final" và trích dẫn mặc định cũ "cấu trúc lương thắng" (đã bị `ADR-010` QĐ-9.2 đảo thành phép OR) — dù nội dung số liệu 6 ca `TC-blth-045…050` đã đúng và **không cần sửa số liệu nào** (xác nhận bởi chính `ADR-010` phần Consequences). Đây thuần là nhãn/trích dẫn chưa cập nhật, không phải sai số liệu, và không đổi kết quả PASS/FAIL của test. Việc gỡ nhãn thuộc quyền ghi của Tester-QA (không tự sửa file QA) — khuyến nghị Tester-QA cập nhật nhãn + bổ sung 3 ca theo `ADR-010` Consequences (mục QA) trước khi chạy Phase B, nhưng **không** chặn Backend Engineer bắt đầu code (Backend code theo `ADR-010`/`data-model`/`api-contract` — nguồn thật đã chốt đầy đủ, không đọc nhãn test-matrix).

**Kết quả đối soát: ✅ PASS.** Mọi Acceptance Criteria (Given/When/Then) của Mục 15.3.1 đều có Test Case tương ứng trong `test-matrix-bang-luong-tong-hop.md` (`AC-dltl-12…28` ↔ `TC-blth-001…050`, 53 ca, 9 nhóm). API Contract, Data Model khớp đúng Business Rules và 3 quyết định nghiệp vụ của chủ dự án (Mục 15.8 + Quyết định nghiệp vụ 3).

**BA CHÍNH THỨC CHỐT — `Status: Ready for Implementation`** cho cụm "Bảng lương tổng hợp" (`docs/hrm/du_lieu_tinh_luong/`). Phạm vi được duyệt để Backend Engineer triển khai:
- **Schema `prisma/tenant/schema.prisma` — 19 cột mới**: 3 cột `GeneralSetting` (`lunchAllowanceTaxFreeCap`, `withholdingTaxRate`, `withholdingTaxThreshold`) + 1 cột `SalaryItem` (`isMealAllowance`) + 15 cột `PayrollSheetLine` (theo `data-model-du-lieu-tinh-luong.md` Mục 11.2/11.3/11.4), sau đó `npm run generate` + `npm run sync:tenants` (10/10 tenant).
- **4 Business Rule mới** `BR-dltl-024…027` + **Quyết định nghiệp vụ 3** (`Q-1`/QĐ-9) — pipeline tính lương 10 bước theo đúng thứ tự `ADR-010` (không được đảo bước).
- **Sửa `payrollCalculation.service.ts`**: hiện thực pipeline 10 bước, hàm `tinhKhoanPhuCapTheoKy()` (dùng chung 2 endpoint, trả kèm nhãn phân giỏ), `laHopDongKhauTruTaiNguon()`, `laKhoanMienThue()`, `getSupportAllowanceBreakdown()`.
- **Endpoint mới**: `GET /payroll/support-allowances?periodId=` (`payrollCalculation.route.ts` + `.controller.ts`, bắt buộc `dbCoQuyenLuongPayroll`).
- **Ảnh hưởng chéo module `cai_dat_luong`**: `GET/PUT /settings/general` + `restore-default` (3 trường mới) và `GET/POST/PATCH /salary-items` (`isMealAllowance`) — theo `api-contract-du-lieu-tinh-luong.md` Mục 8.4.
- **Test bám theo**: `test-matrix-bang-luong-tong-hop.md` (53 ca, 9 nhóm — Nhóm 9 nội dung đã đúng dù nhãn file vật lý còn cũ, xem phát hiện kỹ thuật ở trên).

## 20. Phase B — Kiểm định độc lập Bảng lương tổng hợp (Tester-QA, 2026-09-10)

Kiểm định độc lập kết quả code của backend-engineer (phiên `2026-09-10 12:02`) sau khi triển khai `ADR-010`. Toàn bộ chi tiết ở `docs/hrm/du_lieu_tinh_luong/test-report-bang-luong-tong-hop.md` + `issues-and-bugs-bang-luong-tong-hop.md`.

- **Xác minh số liệu Backend tự báo cáo — KHỚP 100%** (tự chạy lại, không tin suông): `npm run typecheck` exit 0 · `npm run lint` 0 error/359 warning · `npm test` 696/692/4 fail · `hrmPayrollCalculation.test.ts`+`hrmPayrollInputData.test.ts` 58/58 PASS (chạy đúng `--experimental-test-module-mocks`).
- **4 fail cũ (`TC-hrm-301`/`TC-hrm-316`) xác nhận pre-existing** qua `git diff` — diff của phiên `12:02` chỉ thêm 27 dòng assertion cho 3 field mới ở khối `TC-hrm-273…287`, không đụng khối 301/316. Không phải regression.
- **`TC-blth-032`/`033` — xác nhận là lỗi tài liệu của QA (phiên trước), KHÔNG phải bug Backend.** `AC-dltl-23` (đã Sign-off) + `ADR-010` bước [5c] đều yêu cầu prorate trần ăn trưa theo công; bảng Nhóm 6 của `test-matrix-bang-luong-tong-hop.md` viết TRƯỚC khi `AC-dltl-23` được bổ sung nên còn giữ trần cố định 730.000. Code + test Backend sửa (615.385/561.538/53.847 và 923.077/561.538/361.539) đã tự kiểm chứng khớp công thức đúng. Việc cập nhật lại bảng Nhóm 6 + gỡ nhãn "CHƯA final" ở Nhóm 9 thuộc quyền ghi Tester-QA, đợt sau, không chặn Code Reviewer.
- **5 bất biến tài chính đọc trực tiếp code — ĐỀU ĐÚNG**: (1) miễn thuế trước thuế ở cả 2 nhánh (khấu trừ 10% và lũy tiến); (2) chống trừ trùng ăn ca+khai miễn dùng if/else if loại trừ nhau trong 1 vòng lặp (`tinhKhoanPhuCapTheoKy`), không phải OR cộng dồn; (3) 2 trần bảo hiểm tính độc lập, không kẹp chung; (4) `snapshotPayrollSheet()` 44 field khớp ĐÚNG schema `PayrollSheetLine` (đối soát tĩnh field-by-field, không thiếu/thừa cột); (5) bất biến `support-allowances.total` == phần `BENEFIT_ALLOWANCE` trong `allowanceInPeriodTotal` — cả 2 endpoint dùng chung `tinhKhoanPhuCapTheoKy()`, không chép công thức lần 2.
- **0 Bug mới (Blocking/Critical/High).** 4 Issue non-blocking phát hiện: `ISSUE-blth-001` (🟢 tài liệu test-matrix Nhóm 6 chưa cập nhật số liệu prorate), `ISSUE-blth-002` (🟡 5/53 test case chưa có test riêng khớp đúng — đáng chú ý nhất: `TC-blth-042` chặn sàn chuyên cần TẠI ENGINE `payrollCalculation.service.ts` chưa được test nào bảo vệ, test hiện có chỉ phủ `payrollInputs.service.ts`), `ISSUE-blth-003` (🟡 `POST`/`PATCH /salary-items` không có RBAC ADMIN/OWNER dù `isMealAllowance`/`isTaxable` nay điều khiển trực tiếp số tiền thuế — pre-existing, cần BA/Architect quyết định có siết không), `ISSUE-blth-004` (🟢 `snapshotPayrollSheet()` 44-field `createMany` chưa được xác nhận chạy thật trên Postgres cho `PayrollSheetLine`, chỉ đối soát tĩnh — cần 1 lượt `lock` thật trước `npm run sync:tenants`).
- **QA Recommendation: ✅ Sẵn sàng cho Code Reviewer** (conditional pass — không có Bug blocking, 4 issue non-blocking đã ghi rõ phụ trách/thời điểm xử lý).

Đây là tín hiệu chính thức cho phép **Backend Engineer** khởi chạy, bám `docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md` làm nguồn thật cho thứ tự tính toán.

## 21. Phase B — Kiểm định độc lập Frontend khu "Bảng lương" (Tester-QA, 2026-09-10)

Kiểm định độc lập 2 phiên `frontend-engineer` (`work-log.md` `17:30` + `18:15`, cùng ngày) — nối API thật (`GET /payroll/sheet-lines`, `GET /payroll/support-allowances`) thay mock cho `hdđt_maxv/src/features/hrm/components/bang_luong/*`. Chi tiết đầy đủ ở `docs/hrm/du_lieu_tinh_luong/test-report-bang-luong-tong-hop.md` Mục 9 + `issues-and-bugs-bang-luong-tong-hop.md` `ISSUE-blth-005`/`006`.

- **Xác minh độc lập tsc/lint/build — KHỚP 100%** với báo cáo của frontend-engineer (`npx tsc -b` exit 0, `npm run lint` 0 lỗi/0 cảnh báo, `npm run build` thành công 12346 module, đúng 2 cảnh báo Rolldown pre-existing).
- **Field mapping (api-contract Mục 8.1.1) — ĐÚNG**: `gio_tang_ca` ← `otRawHours`, `thu_nhap_chiu_thue` suy đúng 4 số hạng (không dùng thẳng `taxableIncome`), `luong_theo_ngay` cộng đúng `proratedWorkSalary + allowanceInPeriodTotal`.
- **`normalizePayrollLine()` (A-06) — 34 trường ĐẦY ĐỦ**, đối chiếu thủ công từng cột `Decimal`/`Int` của `schema.prisma::PayrollSheetLine` (33 Decimal + 1 Int) khớp CHÍNH XÁC với `PAYROLL_LINE_NUMERIC_FIELDS` — không sót trường nào, kỳ khóa sổ sẽ không bị lỗi cộng chuỗi.
- **UI Chip "Đã khóa sổ" + Alert cảnh báo — ĐÚNG điều kiện**: cả hai chỉ hiện khi `isLocked` (`LOCKED`/`APPROVED`/`PAID`/`ARCHIVED`), khớp đúng nhánh snapshot backend, không hiện sai cho `DRAFT`/`PENDING_REVIEW`.
- **KHÔNG test được UI thật qua trình duyệt (báo cáo trung thực)**: kết nối trực tiếp Postgres dev xác nhận có 2 tenant đã bật module `hrm` nhưng **0 `PayrollPeriod`** và chỉ 1 nhân viên/tenant — không có dữ liệu payroll mẫu. Không có script seed (`be_maxv/prisma/tenant/` không có `seed.ts`, `src/scripts/hrm/` không có script tạo dữ liệu mẫu). Thử đặt lại mật khẩu 1 tài khoản test để tự đăng nhập — bị chặn ghi DB theo đúng nguyên tắc an toàn, không tìm cách vòng qua. Đây là giới hạn môi trường, không phải lỗi code.
- **2 phát hiện mới (chưa có trong `dev-notes.md`)**: `ISSUE-blth-005` 🟡 Medium — `engineVersion` khai báo nhưng KHÔNG được dùng ở bất kỳ đâu trong FE để phân biệt kỳ khóa sổ `v1` (trước ADR-010); cột `thu_nhap_chiu_thue` sẽ hiển thị SAI cho các kỳ lịch sử đó (chỉ ảnh hưởng kỳ khóa TRƯỚC 2026-09-10, không ảnh hưởng kỳ mới) mà không có cảnh báo trên UI — cần BA/Architect quyết định UX. `ISSUE-blth-006` 🟢 Low — `Math.max(0, ...)` khi suy `thu_nhap_chiu_thue` không có trong api-contract, về lý thuyết vô hại nhưng có thể che dấu hiệu bất thường nếu backend tính sai.
- **QA Recommendation: ✅ Sẵn sàng cho Code Reviewer** (conditional pass — 0 bug code, field mapping/schema đối chiếu đúng 100% qua đọc code, nhưng cần môi trường cấp tenant test có dữ liệu mẫu trước khi coi là "đã kiểm thử UI đầy đủ"; `ISSUE-blth-005` cần BA/Architect xác nhận độ ưu tiên).
