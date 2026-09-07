---
type: adr
feature: payroll-input-data
status: accepted
updated: 2026-09-06
author: Solution-Architect-Agent
links:
  - docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-spec.md
  - docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-erd.md
  - docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-states.md
  - docs/du_lieu_tinh_luong/architecture/data-model.md
  - docs/du_lieu_tinh_luong/architecture/api-contract.md
---

# ADR-001 — Thiết kế Kiến trúc Hybrid Catalog, Snapshot Đơn giá Bất biến & Khóa sổ Kỳ lương

## 1. Context (Bối cảnh & Thách thức Nghiệp vụ)

Trong hệ thống HRM & Accounting, phân hệ **Dữ liệu tính lương (`du_lieu_tinh_luong`)** đóng vai trò là tầng thu thập, chuẩn hóa và tổng hợp dữ liệu biến động phát sinh hàng tháng từ 8 nguồn độc lập trước khi chuyển giao cho Bộ tính toán bảng lương (`PayrollEngine`):
1. Chấm công (`cham_cong`)
2. Tăng ca (`tang_ca`)
3. Đánh giá KPI (`kpi`)
4. Tiền thưởng (`thuong`)
5. Lương sản phẩm (`luong_san_pham`)
6. Lương phần trăm / hoa hồng (`luong_phan_tram`)
7. Khấu trừ chuyên cần (`chuyen_can`)
8. Ứng - bù trừ lương (`bu_tru`)

Quá trình phân tích kỹ thuật đặt ra 4 thách thức kiến trúc lớn:

1. **Nguy cơ Phân mảnh và Trùng lặp Danh mục (Catalog Duplication)**:
   Phân hệ Cài đặt lương (`SalarySettings` - ADR-006) đã sở hữu bảng `SalaryItem` định nghĩa cấu hình thuế TNCN (`isTaxable`), trích nộp BHXH (`isSocialInsurance`) và tỷ lệ mặc định (`defaultRate`) cho các khoản thu nhập. Nếu phân hệ Dữ liệu tính lương tự tạo riêng danh mục Thưởng và danh mục Lương phần trăm, hệ thống sẽ rơi vào trạng thái "hai nguồn chân lý" (Two Sources of Truth), dẫn tới nguy cơ sai lệch chính sách thuế và bảo hiểm khi người dùng cập nhật cấu hình.

2. **Yêu cầu Bất biến Lịch sử Kế toán (Historical Accounting Immutability)**:
   Đơn giá sản phẩm (`SanPham.don_gia`) và tỷ lệ hoa hồng mặc định (`SalaryItem.defaultRate`) có thể thay đổi theo từng đợt kinh doanh hoặc chiến lược mới của công ty. Tuy nhiên, dữ liệu bảng lương của các tháng quá khứ **tuyệt đối không được phép thay đổi hồi tố** (Retroactive Drift) khi danh mục gốc bị chỉnh sửa.

3. **Toàn vẹn Dữ liệu Tài chính & Khóa sổ Kỳ lương (Locking & Concurrency Safety)**:
   Khi bảng lương đã được Kế toán trưởng đối soát và trình Giám đốc/CFO ký duyệt, toàn bộ số liệu 8 phân hệ phải được **đóng băng ngay lập tức (Hard Freeze)**. Bất kỳ thao tác thêm/sửa/xóa nào sau thời điểm khóa sổ đều vi phạm chuẩn mực kế toán và gây sai lệch phiếu chi ngân hàng.

4. **Ràng buộc Biên độ Nghiệp vụ Đặc thù (Domain Invariant Boundaries)**:
   - Chuyên cần chỉ mang tính chất phụ cấp chuyên cần, tổng tiền phạt không bao giờ được trừ âm vào lương cơ bản ($\text{tong\_tru} \le \text{don\_gia}$).
   - Ngược lại, đối với Ứng - bù trừ lương, số tiền thực lĩnh (`thuc_linh`) **phải được phép mang giá trị âm** nếu nhân viên tạm ứng vượt quá thu nhập kiếm được trong kỳ để hạch toán công nợ sang kỳ sau.

---

## 2. Alternatives Considered (Đánh giá Đa phương án & Đánh đổi)

Chúng tôi đã phân tích 3 phương án kiến trúc chính:

### Phương án 1: Unified Generic EAV / Key-Value Input Store (Lưu trữ tập trung EAV)
- **Cơ chế**: Dùng 1 bảng duy nhất `payroll_input_entries(id, period_id, employee_id, module_type, ref_code, metric_value, unit_price, total_amount, metadata_json)`.
- **Đánh giá**:
  - *Ưu điểm*: Tối giản số bảng trong cơ sở dữ liệu, linh hoạt thêm phân hệ mới mà không sửa DDL.
  - *Nhược điểm (Trade-offs nghiêm trọng)*: Mất toàn bộ Foreign Key constraints ở tầng database; Không thể thiết lập kiểu dữ liệu chặt chẽ (ngày công, ngày vi phạm phải nhét vào JSONB); Truy vấn tổng hợp bảng lương rất chậm vì phải tự `GROUP BY` và parse JSON phức tạp; Thiếu ràng buộc `UNIQUE` tự nhiên chống trùng lặp.
  - *Kết luận*: **BÁC BỎ** vì rủi ro sai sót dữ liệu tài chính quá lớn.

### Phương án 2: Strict Independent Isolated Sub-modules (8 Phân hệ độc lập hoàn toàn)
- **Cơ chế**: Mỗi phân hệ tạo một bộ bảng hoàn chỉnh độc lập cả về danh mục lẫn chi tiết kỳ: `BonusItem` riêng, `CommissionItem` riêng tách rời khỏi `SalaryItem`.
- **Đánh giá**:
  - *Ưu điểm*: Decoupling hoàn toàn giữa các module.
  - *Nhược điểm (Trade-offs)*: Trùng lặp danh mục với `SalaryItem` đã có; C&B phải cấu hình thuế/BHXH ở 2 nơi; Khó kiểm soát tính nhất quán dữ liệu doanh nghiệp.
  - *Kết luận*: **BÁC BỎ** vì gây lãng phí tài nguyên và tạo ra rủi ro đồng bộ dữ liệu.

### Phương án 3 (Lựa chọn): Domain-Driven Hybrid Catalog with Explicit Snapshotting & State-Machine Locking
- **Cơ chế**:
  - **Hybrid Catalog**: Tái sử dụng `SalaryItem` cho Thưởng và Lương phần trăm; Xây dựng 4 danh mục chuyên biệt cho KPI (`KpiItem`), Sản phẩm (`PieceworkProduct`), Lỗi chuyên cần (`DiligenceViolationType`), Khoản bù trừ (`SalaryAdjustmentItem`).
  - **Explicit Snapshotting**: Lưu giá trị đơn giá (`unit_price`) và tỷ lệ hoa hồng (`commission_rate`) trực tiếp trên từng bản ghi chi tiết của kỳ lương (`piecework_records`, `commission_records`).
  - **State-Machine Write-Protection**: Khóa ghi tập trung tại Service Layer và Database Trigger khi `PayrollPeriod.status != 'DRAFT'`.
  - **Final Sheet Line Frozen Snapshot**: Khi chuyển sang `LOCKED`, một bản ghi snapshot tổng hợp 18 cột (`payroll_sheet_lines`) được lưu cứng vĩnh viễn.

---

## 3. Decision (Quyết định Kỹ thuật Chi tiết)

### 3.1. Chiến lược Danh mục Hỗn hợp (Hybrid Master Catalog Strategy)
- **Tái sử dụng `SalaryItem`**:
  - Đối với Thưởng: Trỏ khóa ngoại `bonus_records.salary_item_id` tới `SalaryItem` có `category = PERIODIC_BONUS`.
  - Đối với Lương phần trăm: Trỏ khóa ngoại `commission_records.salary_item_id` tới `SalaryItem` có `category = COMMISSION_PERCENTAGE`.
  - Cơ chế này đảm bảo khi tính thuế TNCN và trích nộp BHXH, Payroll Engine tự động đọc các cờ `isTaxable` và `isSocialInsurance` chuẩn từ một nơi duy nhất.
- **Thiết lập 4 Danh mục Chuyên biệt**:
  - `KpiItem`: Lưu mã chỉ tiêu (`KPIxx`), tên, đơn vị tính, trọng số mặc định.
  - `PieceworkProduct`: Lưu mã sản phẩm (`SPxx`), tên, đơn vị tính (cái, kiện, đơn), đơn giá chuẩn.
  - `DiligenceViolationType`: Lưu mã lỗi (`CCxx`), tên lỗi, phương thức trừ (`theo_gio`, `theo_lan`, `mat_toan_bo`), mức phạt.
  - `SalaryAdjustmentItem`: Lưu mã khoản bù trừ (`BTxx`), tên khoản, chiều điều chỉnh (`tru` = khấu trừ, `bu` = cộng bù).
  - Áp dụng `onDelete: Restrict` trên toàn bộ các khóa ngoại trỏ tới danh mục. Cấm xóa cứng bản ghi danh mục nếu đã phát sinh dữ liệu trong kỳ; chỉ cho phép cập nhật trạng thái `status = INACTIVE`.

### 3.2. Mô hình Snapshot Đơn giá & Tỷ lệ Bất biến (Explicit Snapshotting Pattern)
- Khi áp dụng Sản phẩm hoặc Khoản lương phần trăm vào kỳ lương:
  - Giá trị đơn giá tại thời điểm áp dụng được sao chép vào `piecework_records.unit_price`.
  - Giá trị tỷ lệ hoa hồng được sao chép vào `commission_records.commission_rate`.
- Cho phép người làm lương điều chỉnh đơn giá hoặc tỷ lệ riêng cho từng nhân viên/từng kỳ mà không làm ảnh hưởng tới danh mục gốc của công ty.
- Khi danh mục gốc được sửa đổi đơn giá hoặc tỷ lệ hoa hồng trong tương lai, câu lệnh `UPDATE` chỉ tác động lên danh mục cha, các bản ghi chi tiết kỳ lương cũ hoàn toàn giữ nguyên giá trị snapshot đã chốt.

### 3.3. Cơ chế Khóa sổ Kỳ lương & Bất biến Ghi (Period State Machine & Write-Protection Gate)
- Vòng đời của kỳ lương được quản lý chặt chẽ theo 6 trạng thái:  
  `DRAFT` $\rightarrow$ `PENDING_REVIEW` $\rightarrow$ `LOCKED` $\rightarrow$ `APPROVED` $\rightarrow$ `PAID` $\rightarrow$ `ARCHIVED`.
- **Bất biến Ghi (Write-Protection Invariant)**:
  - Tầng Service Layer thiết lập `PayrollPeriodGuard`: Trước khi thực thi bất kỳ thao tác `INSERT`, `UPDATE`, `DELETE` nào trên 8 phân hệ, hệ thống bắt buộc kiểm tra trạng thái kỳ lương `status`.
  - Nếu `status != 'DRAFT'`, chặn lập tức và ném mã lỗi chuẩn `E-dltl-001`:  
    `"Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu."`
- **Bảo vệ Dự phòng ở Tầng Database (Defense-in-Depth)**:
  - Triển khai PostgreSQL Before Trigger trên các bảng chi tiết, kiểm tra `status` của `payroll_periods` tương ứng. Nếu khác `DRAFT`, trigger phát sinh ngoại lệ `RAISE EXCEPTION`, đảm bảo không ai có thể can thiệp trực tiếp bằng SQL script ngoài ý muốn.

### 3.4. Bảng Lương Tổng Hợp Đóng Băng (Payroll Sheet Frozen Snapshot)
- Tại thời điểm thực hiện thao tác **Khóa sổ (`POST /payroll-periods/:id/lock`)**:
  1. Mở một Prisma Interactive Transaction (`prisma.$transaction`).
  2. Payroll Engine thực hiện một lượt tính toán toàn diện cuối cùng cho toàn bộ nhân viên có hợp đồng hiệu lực trong kỳ.
  3. Xóa các dòng tính thử cũ và chốt ghi snapshot chính thức vào bảng `payroll_sheet_lines` (18 cột chuẩn: ngày công, giờ OT, các khoản thu nhập, bảo hiểm, công đoàn, thuế TNCN, bù trừ, thực lĩnh, tổng quỹ lương).
  4. Cập nhật `payroll_periods.status = 'LOCKED'`, ghi nhận `lockedAt = NOW()` và `lockedByUserId = req.user.id`.
  5. Ghi Audit Log với event `PAYROLL_PERIOD_LOCKED`.
  6. Commit Transaction.
- Sau khi kỳ đã `LOCKED`, mọi truy vấn xem bảng lương của kỳ này chỉ đọc trực tiếp từ bảng `payroll_sheet_lines`, tuyệt đối không chạy lại công thức realtime để tránh ảnh hưởng nếu các tham số hệ thống trong tương lai thay đổi.

### 3.5. Chính sách Mở lại Kỳ lương Có Kiểm soát (Controlled Reopen Policy)
- Trong trường hợp phát hiện sai sót trọng yếu sau khi đã khóa sổ:
  - Chỉ người dùng có vai trò **`ADMIN`** mới được phép gọi API `POST /payroll-periods/:id/reopen`.
  - Bắt buộc phải cung cấp lý do giải trình với độ dài tối thiểu 20 ký tự (`reason.length >= 20`).
  - Hệ thống chuyển kỳ về `DRAFT` và tự động ghi nhật ký `AuditLog` với event `PAYROLL_PERIOD_REOPENED`.
  - **Tuyệt đối cấm Reopen** đối với các kỳ lương đã ở trạng thái `PAID` (đã giải ngân chuyển khoản) hoặc `ARCHIVED` (đã lưu trữ quyết toán thuế).

### 3.6. Xử lý Ràng buộc Biên độ Tài chính (Boundary Invariants)
1. **Chặn âm Lương Chuyên cần (Hard Invariant)**:
   $$\text{tong\_tru} = \min\left(\sum \text{tien\_phat\_dong}, \text{don\_gia\_chuyen\_can}\right)$$
   $$\text{thanh\_tien} = \max\left(0, \text{don\_gia\_chuyen\_can} - \text{tong\_tru}\right)$$
   Tuyệt đối không để tiền chuyên cần bị âm hoặc trừ lấn sang lương cơ bản.
2. **Bảo toàn Số âm Thực lĩnh cho Tạm ứng (Signed Take-home Salary)**:
   $$\text{thuc\_linh} = \text{thu\_nhap} - \text{bao\_hiem} - \text{cong\_doan} - \text{thue\_tncn} - \text{tong\_bi\_tru}$$
   Khi nhân viên tạm ứng vượt quá thu nhập thực tế trong tháng, trường `netTakeHomeSalary` trong `payroll_sheet_lines` **được phép nhận giá trị âm**. Giá trị âm này phản ánh khoản công nợ của nhân viên đối với công ty và tự động được hệ thống đưa vào khoản "Thu hồi tạm ứng kỳ trước" (`BT02`) ở kỳ lương kế tiếp.

---

## 4. Consequences (Hệ quả & Đánh giá)

### 4.1. Lợi ích Đạt được (Positive Consequences)
1. **Toàn vẹn Dữ liệu Kế toán Tuyệt đối**: Ngăn chặn 100% rủi ro trôi lệch số liệu lịch sử (Retroactive Drift) khi danh mục thay đổi.
2. **Hiệu năng Truy vấn Xuất sắc**: Bảng lương sau khi khóa sổ được đọc trực tiếp từ bản ghi snapshot đóng băng `payroll_sheet_lines` với độ phức tạp $O(1)$ cho phiếu cá nhân và quét index $O(\log N)$ cho toàn công ty.
3. **Tuân thủ Chuẩn mực Kiểm toán (Audit Compliance)**: Mọi thao tác khóa sổ, mở lại kỳ đều được ghi nhận đầy đủ người thực hiện, thời gian và lý do giải trình.
4. **Trải nghiệm Nhập liệu Thân thiện & Linh hoạt**: Cho phép điều chỉnh đơn giá/tỷ lệ theo từng kỳ linh hoạt mà không làm rối loạn danh mục chuẩn công ty.

### 4.2. Đánh đổi & Giải pháp Giảm thiểu (Trade-offs & Mitigations)
1. **Dung lượng Lưu trữ Bổ sung cho Snapshot**:
   - *Đánh đổi*: Lưu trữ snapshot đơn giá và bảng tổng hợp 18 cột làm tăng dung lượng database so với mô hình tính toán thuần túy.
   - *Giảm thiểu*: Với quy mô 500 nhân viên, dung lượng bảng `payroll_sheet_lines` chỉ chiếm khoảng ~1.2 MB/năm, hoàn toàn không đáng kể so với lợi ích về hiệu năng và an toàn dữ liệu.
2. **Phức tạp hóa Quy trình Sửa đổi**:
   - *Đánh đổi*: Người dùng không thể tùy tiện sửa dữ liệu khi kỳ đã khóa mà phải qua quy trình giải trình Reopen.
   - *Giảm thiểu*: Đây là tính năng bảo vệ bắt buộc (By-design) của phần mềm tài chính kế toán chuyên nghiệp để chống gian lận lương.
