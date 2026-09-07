# Sơ đồ Luồng Nghiệp vụ (Flow Diagrams) — Dữ liệu Tính Lương

> **Tài liệu**: Đặc tả Luồng Nghiệp vụ & Giao tiếp (Activity / Swimlane / Sequence)  
> **Phân hệ**: Dữ liệu tính lương (`du_lieu_tinh_luong`)  
> **Ngày lập**: 2026-09-06  
> **Trạng thái**: Chốt nghiệm thu SRS  

---

## 1. Sơ đồ Hoạt động Phân làn (Swimlane / Activity Diagram)

Quy trình tổng hợp 8 phân hệ dữ liệu tính lương và tính lương định kỳ hàng tháng giữa 4 tác nhân: **HR / C&B**, **Trưởng bộ phận / Quản đốc**, **Kế toán tiền lương**, và **Hệ thống tự động**.

```mermaid
flowchart TD
    %% Tác nhân làn ngang
    subgraph HR_CB["Chuyên viên C&B / Nhân sự"]
        A1["1. Khởi tạo Kỳ lương mới (Tháng YYYY-MM)"] --> A2["2. Rà soát & Cập nhật Chấm công tháng"]
        A2 --> A3["3. Nhập dữ liệu Tăng ca (OT)"]
        A3 --> A4["4. Ghi nhận vi phạm Chuyên cần"]
        A4 --> A5["5. Khai báo Thưởng định kỳ & đột xuất"]
    end

    subgraph DEPT_MGR["Trưởng bộ phận / Quản đốc"]
        B1["Nhận thông báo kỳ đánh giá"] --> B2["6. Chấm điểm & Gửi kết quả KPI"]
        B1 --> B3["7. Nghiệm thu Sản lượng công nhân (Lương SP)"]
        B1 --> B4["8. Chốt Doanh số hoa hồng (Lương %)"]
    end

    subgraph ACCOUNTANT["Kế toán Tiền lương"]
        C1["9. Ghi nhận Tạm ứng & Các khoản Bù trừ lương"] --> C2["10. Thực hiện đối soát số liệu 8 phân hệ"]
        C2 --> C3{"Số liệu hợp lệ & đầy đủ?"}
        C3 -- "Không (Yêu cầu bổ sung)" --> C4["Gửi yêu cầu chỉnh sửa/bổ sung"]
        C3 -- "Có (Đồng ý)" --> C5["11. Kích hoạt 'Tính toán Bảng lương'"]
        C5 --> C6["12. Kiểm tra Bảng lương tổng hợp & Bóc tách Hỗ trợ"]
        C6 --> C7["13. Thực hiện 'Khóa sổ Kỳ lương' (Lock Period)"]
        C7 --> C8["14. Trình duyệt Bảng lương lên Ban Giám Đốc"]
    end

    subgraph SYSTEM["Hệ thống Core HRM & Payroll Engine"]
        S1["Tự sinh Lịch chuẩn từ GeneralSetting & Holiday"]
        S2["Tự tính Giờ quy đổi OT & Cảnh báo trần 40h/300h"]
        S3["Tự tính Hiệu suất KPI theo Trọng số"]
        S4["Snapshot Đơn giá SP & Tỷ lệ % hoa hồng"]
        S5["Kiểm tra Chặn sàn Chuyên cần (không âm)"]
        S6["Xác định Dấu chiều Bù/Trừ tự động"]
        S7["Chạy công thức Bảng lương 18 cột: Thu nhập, BHXH, Thuế TNCN, Thực lĩnh"]
        S8["Khóa sổ toàn bộ bản ghi 8 phân hệ (Chuyển trạng thái LOCKED)"]
    end

    %% Liên kết luồng
    A1 -.-> S1
    S1 -.-> A2
    A3 -.-> S2
    B2 -.-> S3
    B3 -.-> S4
    B4 -.-> S4
    A4 -.-> S5
    C1 -.-> S6

    A5 --> C2
    B2 --> C2
    B3 --> C2
    B4 --> C2
    C4 -.-> A2
    C4 -.-> B2

    C5 --> S7
    S7 --> C6
    C7 --> S8

    style HR_CB fill:#EBF5FB,stroke:#2980B9,stroke-width:2px
    style DEPT_MGR fill:#FEF9E7,stroke:#F39C12,stroke-width:2px
    style ACCOUNTANT fill:#E8F8F5,stroke:#27AE60,stroke-width:2px
    style SYSTEM fill:#F4ECF7,stroke:#8E44AD,stroke-width:2px
```

---

## 2. Sơ đồ Tuần tự Giao tiếp Hệ thống (Sequence Diagram)

Quy trình giao tiếp API giữa **Frontend UI**, **API Gateway / Controllers**, **8 Phân hệ Dữ liệu Lương (Payroll Data Services)**, **Payroll Engine (Bộ tính toán)**, và **PostgreSQL Database**.

```mermaid
sequenceDiagram
    autonumber
    actor User as Người làm lương (HR / Accountant)
    participant UI as Giao diện Web (MUI Frontend)
    participant Gateway as API Gateway / Auth Guard
    participant DataSvc as Payroll Data Services (8 Modules)
    participant Engine as Payroll Calculation Engine
    participant DB as PostgreSQL Database

    %% Bước 1: Áp dụng dữ liệu mẫu hàng loạt
    Note over User, DB: 1. ÁP DỤNG DỮ LIỆU TÍNH LƯƠNG HÀNG LOẠT (Ví dụ: Tăng ca / Thưởng)
    User->>UI: Chọn phạm vi (Phòng ban), chọn bảng mẫu -> Bấm "Áp dụng"
    UI->>Gateway: POST /api/v1/payroll-data/overtime/apply { periodId, scope, deptId, items[] }
    Gateway->>DataSvc: OvertimeService.applyBatch(dto)
    DataSvc->>DB: SELECT * FROM payroll_periods WHERE id = periodId
    DB-->>DataSvc: Trả về trạng thái kỳ (DRAFT)
    alt Kỳ lương đã bị khóa (LOCKED / APPROVED)
        DataSvc-->>UI: 400 Bad Request (E-dltl-001: Kỳ lương đã bị khóa sổ)
    else Kỳ lương đang Soạn thảo (DRAFT)
        DataSvc->>DataSvc: Validate items (không trùng loại, giờ > 0, check trần 40h)
        DataSvc->>DB: BEGIN TRANSACTION
        DataSvc->>DB: Lấy danh sách nhân viên ACTIVE theo phòng ban
        DataSvc->>DB: INSERT / UPSERT chi tiết tăng ca cho từng nhân viên (Clone ID độc lập)
        DataSvc->>DB: COMMIT TRANSACTION
        DB-->>DataSvc: Ghi nhận thành công
        DataSvc-->>Gateway: Trả về kết quả (Số nhân viên đã áp dụng)
        Gateway-->>UI: 200 OK { success: true, count: 15 }
        UI-->>User: Hiển thị Toast thông báo thành công
    end

    %% Bước 2: Tính toán bảng lương
    Note over User, DB: 2. TÍNH TOÁN BẢNG LƯƠNG TỔNG HỢP (Payroll Recalculation)
    User->>UI: Chuyển sang màn Bảng lương -> Bấm "Tính lại lương"
    UI->>Gateway: GET /api/v1/payroll/calculate?periodId=...
    Gateway->>Engine: PayrollEngine.calculatePeriod(periodId)
    
    par Thu thập 8 nguồn dữ liệu song song
        Engine->>DB: Lấy cấu hình chuẩn (GeneralSetting, WorkShift, Holiday)
        Engine->>DB: Lấy hồ sơ & Hợp đồng hiện hành (Contract, Employee, Dependent)
        Engine->>DB: Lấy mức lương thiết lập (EmployeeSalary / SalaryStructure)
        Engine->>DB: Lấy Chấm công tháng (ChamCongRecord -> ngayCongThucTe)
        Engine->>DB: Lấy Giờ tăng ca quy đổi (TangCaRecord -> gioQuyDoi)
        Engine->>DB: Lấy Hiệu suất KPI (KpiRecord -> hieuSuat)
        Engine->>DB: Lấy Tiền thưởng (ThuongRecord -> tongTienThuong)
        Engine->>DB: Lấy Lương sản phẩm (LuongSanPhamRecord -> tongTienSP)
        Engine->>DB: Lấy Lương hoa hồng % (LuongPhanTramRecord -> tongTienPT)
        Engine->>DB: Lấy Tiền chuyên cần sau phạt (ChuyenCanRecord -> thanhTienCC)
        Engine->>DB: Lấy Tổng tiền Ứng - Bù trừ (BuTruRecord -> tongBiTru)
    end
    DB-->>Engine: Trả về toàn bộ dữ liệu đầu vào đã chuẩn hóa

    loop Từng nhân viên trong kỳ lương
        Engine->>Engine: 1. Quy đổi lương cố định theo công (luongTheoNgay = luongCoDinh * tyLeCong)
        Engine->>Engine: 2. Tính tiền làm thêm giờ (tienTangCa = gioQuyDoi * donGiaGio)
        Engine->>Engine: 3. Tính tiền KPI (kpi = mucKpi * hieuSuat / 100)
        Engine->>Engine: 4. Tổng hợp Thu nhập = Lương ngày + OT + KPI + Thưởng + SP + % + CC
        Engine->>Engine: 5. Tính trích BHXH, BHYT, BHTN (trên luong_bhxh hợp đồng)
        Engine->>Engine: 6. Tính Đoàn phí & Kinh phí công đoàn (theo trần lương cơ sở)
        Engine->>Engine: 7. Xác định Thu nhập chịu thuế & Giảm trừ gia cảnh (Bản thân + NPT)
        Engine->>Engine: 8. Tính Thuế TNCN lũy tiến từng phần theo biểu 5 hoặc 7 bậc
        Engine->>Engine: 9. Tính Thực lĩnh = Thu nhập - Bảo hiểm - Công đoàn - Thuế - Bù trừ
        Engine->>Engine: 10. Tính Tổng quỹ lương doanh nghiệp chi trả (QuyLuong)
    end

    Engine-->>Gateway: Trả về danh sách DongBangLuong[] (18 cột chuẩn)
    Gateway-->>UI: 200 OK [ { ma_nv, ho_ten, thu_nhap, thuc_linh, ... } ]
    UI-->>User: Hiển thị bảng lương đầy đủ + 3 thẻ tổng hợp (Quỹ lương, Thực lĩnh, Thuế TNCN)

    %% Bước 3: Khóa sổ kỳ lương
    Note over User, DB: 3. KHÓA SỔ KỲ LƯƠNG (Lock Period Workflow)
    User->>UI: Bấm "Khóa sổ kỳ lương" -> Xác nhận cảnh báo
    UI->>Gateway: POST /api/v1/payroll-periods/:id/lock
    Gateway->>DataSvc: PayrollPeriodService.lockPeriod(periodId, userId)
    DataSvc->>DB: BEGIN TRANSACTION
    DataSvc->>DB: UPDATE payroll_periods SET status = 'LOCKED', locked_at = NOW(), locked_by = userId WHERE id = periodId AND status = 'DRAFT'
    DataSvc->>DB: INSERT INTO audit_logs (event = 'PAYROLL_PERIOD_LOCKED', ...)
    DataSvc->>DB: COMMIT TRANSACTION
    DB-->>DataSvc: Cập nhật thành công 1 dòng
    DataSvc-->>Gateway: 200 OK { status: "LOCKED" }
    Gateway-->>UI: 200 OK
    UI-->>User: Giao diện chuyển sang chế độ Chỉ xem (Read-only), nút Khóa chuyển thành "Đã khóa sổ"
```
