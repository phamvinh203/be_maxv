# Sơ đồ Luồng Nghiệp vụ & Tuần tự: Phân hệ Bảng Lương & Bộ Tính Toán Lương (Payroll Flows)

> **Mã tài liệu**: `FLOW-PAY-001`  
> **Phân hệ**: Bảng lương & Bộ tính toán lương (`payroll`)  
> **Trạng thái**: `approved`  
> **Tác giả**: Business Analyst  
> **Ngày phê duyệt**: 2026-09-06  
> **Tài liệu tham chiếu**: `docs/payroll/srs/payroll-spec.md`  

---

## 1. Sơ đồ Phân làn Nghiệp vụ Toàn trình (Swimlane / Activity Diagram)

Sơ đồ thể hiện sự phối hợp chặt chẽ giữa 4 chủ thể: **Chuyên viên C&B (HR)**, **Kế toán tiền lương & Kế toán trưởng (Accountant)**, **Ban Giám đốc (Management)**, và **Hệ thống Core (Payroll Engine)** từ khi bắt đầu tính lương đến khi lưu trữ chứng từ.

```mermaid
sequenceDiagram
    autonumber
    actor CB as Chuyên viên C&B (HR)
    actor KT as Kế toán trưởng (Accountant)
    actor BG as Ban Giám đốc (CEO/CFO)
    participant SYS as Hệ thống Core (Payroll Engine)
    participant DB as Cơ sở Dữ liệu (PostgreSQL)

    %% Giai đoạn 1: Chuẩn bị & Tính thử nghiệm
    Note over CB,SYS: Giai đoạn 1: Thu thập & Tính toán Bảng lương Nháp (DRAFT)
    CB->>SYS: Yêu cầu tính bảng lương kỳ ("POST /payroll/calculate")
    activate SYS
    SYS->>DB: Lấy dữ liệu Nhân sự, Hợp đồng, Cài đặt lương & 8 phân hệ Dữ liệu
    DB-->>SYS: Dữ liệu nguồn hợp lệ
    SYS->>SYS: Chạy Pipeline 6 giai đoạn (Công -> OT -> Thu nhập -> BHXH -> Thuế -> Thực lĩnh)
    SYS-->>CB: Trả về kết quả tính toán chi tiết 18 cột & Tab Lương hỗ trợ
    deactivate SYS
    CB->>CB: Đối soát ngày công, OT, chỉ tiêu KPI, thưởng, hoa hồng
    alt Có sai lệch dữ liệu nguồn
        CB->>SYS: Sửa đổi dữ liệu tại 8 phân hệ nguồn (Dữ liệu tính lương)
        CB->>SYS: Bấm "Tính lại bảng lương"
    else Dữ liệu chuẩn xác
        CB->>SYS: Gửi bảng lương đối soát ("POST /payroll/periods/{id}/submit")
        activate SYS
        SYS->>DB: Cập nhật trạng thái kỳ = PENDING_REVIEW
        SYS-->>CB: Thông báo chuyển trạng thái thành công
        deactivate SYS
    end

    %% Giai đoạn 2: Kế toán thẩm tra & Khóa sổ (LOCKED)
    Note over KT,SYS: Giai đoạn 2: Thẩm tra Tài chính & Khóa sổ Snapshot (LOCKED)
    KT->>SYS: Mở xem Bảng lương & Bảng Lương hỗ trợ ("GET /payroll/preview")
    KT->>KT: Kiểm tra quỹ lương, chi phí bảo hiểm doanh nghiệp, thuế TNCN tạm nộp
    alt Phát hiện sai sót tài chính
        KT->>SYS: Trả về yêu cầu chỉnh sửa (Reject về DRAFT)
    else Xác nhận số liệu đạt chuẩn
        KT->>SYS: Thực hiện Khóa sổ ("POST /payroll/periods/{id}/lock")
        activate SYS
        SYS->>SYS: Kiểm tra hợp lệ kỳ lương (chặn tính lại, chặn ghi 8 nguồn)
        SYS->>DB: $transaction: Chốt snapshot lines & breakdowns chi tiết
        DB-->>SYS: Ghi nhận snapshot thành công
        SYS->>DB: Cập nhật trạng thái kỳ = LOCKED, lockedAt, lockedByUserId
        SYS-->>KT: Xác nhận khóa sổ thành công, đóng băng toàn bộ số liệu
        deactivate SYS
    end

    %% Giai đoạn 3: Ban Giám đốc phê duyệt & Chi trả
    Note over BG,SYS: Giai đoạn 3: Ban Giám đốc Ký duyệt & Chi trả Lương (APPROVED -> PAID)
    BG->>SYS: Xem báo cáo tổng hợp quỹ lương ("GET /payroll/summary")
    BG->>SYS: Ban Giám đốc bấm Duyệt ("POST /payroll/periods/{id}/approve")
    activate SYS
    SYS->>DB: Cập nhật trạng thái kỳ = APPROVED, approvedAt, approvedByUserId
    SYS-->>BG: Xác nhận phê duyệt thành công
    deactivate SYS

    KT->>SYS: Xuất file bảng lương Excel chuyển khoản ngân hàng
    KT->>SYS: Xác nhận đã chi trả lương ("POST /payroll/periods/{id}/pay")
    activate SYS
    SYS->>DB: Cập nhật trạng thái kỳ = PAID
    SYS->>SYS: Kích hoạt phát hành Phiếu lương điện tử (Payslip) cho từng nhân viên
    SYS-->>KT: Hoàn tất quy trình chi trả
    deactivate SYS

    %% Giai đoạn 4: Lưu trữ & Quyết toán
    Note over KT,SYS: Giai đoạn 4: Lưu trữ Kế toán (ARCHIVED)
    KT->>SYS: Chuyển lưu trữ cuối năm ("POST /payroll/periods/{id}/archive")
    SYS->>DB: Cập nhật trạng thái kỳ = ARCHIVED (Bất biến vĩnh viễn)
```

---

## 2. Sơ đồ Tuần tự Chi tiết: Động cơ Tính toán Lương (Calculation Pipeline)

Sơ đồ mô tả chi tiết quy trình xử lý dữ liệu của **`PayrollCalculationService`** chạy qua 6 bước khép kín theo đúng các quy tắc pháp lý chuẩn Việt Nam:

```mermaid
sequenceDiagram
    autonumber
    participant Client as Web Frontend / API Consumer
    participant Ctrl as PayrollCalculationController
    participant Svc as PayrollCalculationService
    participant Scope as PayrollScopeHelper
    participant DB as PostgreSQL Database

    Client->>Ctrl: GET /payroll/calculate?periodId={id}
    Ctrl->>Svc: calculatePeriodPayroll(periodId)
    activate Svc

    %% Bước 1: Kiểm tra trạng thái kỳ
    Svc->>DB: findUnique(PayrollPeriod where id = periodId)
    DB-->>Svc: period info (startDate, endDate, status)
    opt Trạng thái không phải DRAFT hoặc PENDING_REVIEW
        Svc-->>Client: Throw E-pay-002 (Kỳ lương đã khóa sổ)
    end

    %% Bước 2: Lọc nhân viên còn hợp đồng hiệu lực (RETRO-01 / BR-dltl-002)
    Svc->>Scope: filterActiveEmployeeIdsInPeriod(period.startDate, period.endDate)
    Scope->>DB: Query Contract.findMany (chỉ lấy NV còn HĐ bao phủ kỳ)
    DB-->>Scope: activeEmployeeIds[]
    Scope-->>Svc: activeEmployeeIds[]

    %% Bước 3: Lấy dữ liệu Cài đặt chung, Cài đặt lương & 8 nguồn biến động
    par Lấy cấu hình và nhân sự
        Svc->>DB: getGeneralSetting('DEFAULT') (lương cơ sở, vùng, thuế, OT, BH)
        Svc->>DB: Employee.findMany(where id in activeIds, include: Contract, Dependents, SalaryItems)
    and Lấy dữ liệu 8 phân hệ kỳ lương
        Svc->>DB: AttendanceRecord.findMany(periodId)
        Svc->>DB: OvertimeRecord.findMany(periodId)
        Svc->>DB: KpiRecord.findMany(periodId)
        Svc->>DB: BonusRecord.findMany(periodId)
        Svc->>DB: PieceworkRecord.findMany(periodId)
        Svc->>DB: CommissionRecord.findMany(periodId)
        Svc->>DB: DiligenceRecord.findMany(periodId)
        Svc->>DB: SalaryAdjustmentRecord.findMany(periodId)
    end
    DB-->>Svc: Trả về đầy đủ dữ liệu song song

    %% Bước 4: Vòng lặp tính toán từng nhân viên (6 Stages)
    loop Với từng Nhân viên đủ điều kiện
        Note over Svc: Stage 1: Lương Thời gian & Phụ cấp cố định (BR-pay-001)
        Svc->>Svc: Tính tỷ lệ công = actualWorkDays / standardWorkDays
        Svc->>Svc: Prorate lương cơ bản & các phụ cấp tính theo công
        Svc->>Svc: Giữ nguyên 100% các phụ cấp cố định trọn tháng

        Note over Svc: Stage 2: Tiền Làm thêm giờ & Bóc tách Miễn thuế (BR-pay-004)
        Svc->>Svc: donGiaGioChuan = baseSalary / (standardDays * standardHours)
        Svc->>Svc: otAmount = tổng tiền làm thêm theo các hệ số 150%-390%
        Svc->>Svc: otTaxExempt = otAmount - (donGiaGioChuan * otActualHours)

        Note over Svc: Stage 3: Thu nhập Biến động & Chặn sàn Chuyên cần (BR-pay-009)
        Svc->>Svc: Tính KPI, Lương sản phẩm, Lương % hoa hồng, Thưởng
        Svc->>Svc: Tính tiền chuyên cần = max(0, mucChuyenCan - min(tongPhat, mucChuyenCan))
        Svc->>Svc: Tổng hợp GrossIncome = Lương công + Phụ cấp + OT + SP + Thưởng + KPI + % + Chuyên cần

        Note over Svc: Stage 4: Tính Bảo hiểm theo 2 Trần Độc lập (BR-pay-006)
        Svc->>Svc: luongBH_BHYT = min(insuranceBase, 46.800.000) (NĐ 73/2024)
        Svc->>Svc: luongBHTN = min(insuranceBase, 99.200.000) (NĐ 74/2024)
        Svc->>Svc: BH_NV = luongBH_BHYT * 9.5% + luongBHTN * 1.0%
        Svc->>Svc: BH_CT = luongBH_BHYT * 20.5% + luongBHTN * 1.0%
        Svc->>Svc: Đoàn phí NV = min(luongBH_BHYT * 1%, 234.000); KPCĐ CT = luongBH_BHYT * 2%

        Note over Svc: Stage 5: Thuế TNCN & Phân loại Hợp đồng (BR-pay-003, BR-pay-005)
        Svc->>Svc: Miễn thuế ăn trưa = min(tienAnTrua, round(730.000 * tyLeCong))
        Svc->>Svc: ThuNhapChiuThue = Gross - otTaxExempt - Miễn thuế ăn trưa - Miễn thuế khác
        alt Hợp đồng Thử việc (PROBATION) / Dịch vụ (SERVICE_CONTRACT)
            Svc->>Svc: Thuế TNCN = round(ThuNhapChiuThue * 10%) (KHÔNG giảm trừ gia cảnh)
        else Hợp đồng Lao động chính thức (LABOR_CONTRACT >= 3 tháng)
            Svc->>Svc: GiamTru = 11.000.000 + soNPT * 4.400.000 + BH_NV + DoanPhi_NV
            Svc->>Svc: ThuNhapTinhThue = max(0, ThuNhapChiuThue - GiamTru)
            Svc->>Svc: Thuế TNCN = thueLuyTien7Bac(ThuNhapTinhThue)
        end

        Note over Svc: Stage 6: Bù trừ & Thực lĩnh (EC-pay-002)
        Svc->>Svc: adjustmentNet = tongTru - tongBu
        Svc->>Svc: thucLinh = Gross - BH_NV - DoanPhi_NV - Thuế TNCN - adjustmentNet (cho phép âm)
        Svc->>Svc: Build CalculatedPayrollLine & BreakdownItems[]
    end

    Svc-->>Ctrl: Danh sách CalculatedPayrollLine[] (18 cột + breakdowns)
    deactivate Svc
    Ctrl-->>Client: 200 OK (Bảng lương thời gian thực)
```

---

## 3. Sơ đồ Tuần tự: Khóa sổ Kỳ lương & Lưu trữ Snapshot Bất biến Đa tầng

Sơ đồ mô tả cơ chế ghi bất biến nguyên tử (`Prisma.$transaction`) bảo đảm tính toàn vẹn tuyệt đối khi kỳ lương chuyển sang `LOCKED`:

```mermaid
sequenceDiagram
    autonumber
    actor KT as Kế toán trưởng (Accountant)
    participant Ctrl as PayrollPeriodsController
    participant Svc as PayrollPeriodsService
    participant Calc as PayrollCalculationService
    participant DB as PostgreSQL Database

    KT->>Ctrl: POST /payroll/periods/{id}/lock
    Ctrl->>Svc: lockPeriod(periodId, currentUserId)
    activate Svc

    %% Bước 1: Guard kiểm tra trạng thái
    Svc->>DB: findUnique(PayrollPeriod where id = periodId)
    DB-->>Svc: period
    alt period.status != PENDING_REVIEW (hoặc DRAFT)
        Svc-->>KT: Throw E-pay-002 (Kỳ lương không ở trạng thái chờ khóa sổ)
    end

    %% Bước 2: Chạy tính toán lại lần cuối để bảo đảm số liệu mới nhất
    Svc->>Calc: calculatePeriodPayroll(periodId)
    activate Calc
    Calc-->>Svc: calculatedLines[] (kèm item breakdowns chi tiết)
    deactivate Calc

    %% Bước 3: Mở Transaction lưu Snapshot bất biến đa tầng
    Svc->>DB: $transaction(async tx => { ... })
    activate DB
    Note over Svc,DB: 1. Xóa snapshot cũ nếu có (phòng ngừa trường hợp tính lại)
    Svc->>DB: tx.payrollSheetItemBreakdown.deleteMany(where periodId)
    Svc->>DB: tx.payrollSheetLine.deleteMany(where periodId)

    Note over Svc,DB: 2. Lưu bảng dòng lương tổng hợp (18 cột)
    Svc->>DB: tx.payrollSheetLine.createMany(data: calculatedLines)

    Note over Svc,DB: 3. Lưu bảng chi tiết cấu phần lương (Breakdowns)
    Svc->>DB: tx.payrollSheetItemBreakdown.createMany(data: itemBreakdowns)

    Note over Svc,DB: 4. Chuyển trạng thái kỳ lương sang LOCKED
    Svc->>DB: tx.payrollPeriod.update({ status: LOCKED, lockedAt: now(), lockedByUserId: currentUserId })

    DB-->>Svc: Commit Transaction thành công
    deactivate DB

    Svc-->>Ctrl: { success: true, periodId, totalLines: N, totalBreakdowns: M }
    deactivate Svc
    Ctrl-->>KT: 200 OK: Đã khóa sổ kỳ lương thành công và chốt snapshot
```

---

## 4. Sơ đồ Tuần tự: Mở lại Kỳ lương (Reopen) & Xóa Snapshot có Kiểm toán

Sơ đồ thể hiện quy trình quản lý rủi ro khi cần điều chỉnh kỳ lương đã khóa, bắt buộc thẩm quyền `ADMIN`, yêu cầu nhập lý do và ghi nhận `AuditLog`:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản trị viên (ADMIN)
    participant Ctrl as PayrollPeriodsController
    participant Svc as PayrollPeriodsService
    participant DB as PostgreSQL Database

    Admin->>Ctrl: POST /payroll/periods/{id}/reopen { reason: "..." }
    Ctrl->>Svc: reopenPeriod(periodId, adminUserId, reason)
    activate Svc

    %% Bước 1: Kiểm tra thẩm quyền & độ dài lý do
    opt reason.length < 20 ký tự
        Svc-->>Admin: Throw E-pay-009 (Lý do mở lại phải từ 20 ký tự trở lên)
    end

    Svc->>DB: findUnique(PayrollPeriod where id = periodId)
    DB-->>Svc: period
    opt period.status != LOCKED
        Svc-->>Admin: Throw E-pay-002 (Chỉ được mở lại kỳ lương đang ở trạng thái LOCKED)
    end

    %% Bước 2: Thực thi Transaction Reopen
    Svc->>DB: $transaction(async tx => { ... })
    activate DB
    Note over Svc,DB: 1. Xóa toàn bộ snapshot đã chốt để bảo đảm dữ liệu tính lại sạch
    Svc->>DB: tx.payrollSheetItemBreakdown.deleteMany(where periodId)
    Svc->>DB: tx.payrollSheetLine.deleteMany(where periodId)

    Note over Svc,DB: 2. Cập nhật trạng thái kỳ lương về DRAFT
    Svc->>DB: tx.payrollPeriod.update({ status: DRAFT, lockedAt: null, lockedByUserId: null })

    Note over Svc,DB: 3. Ghi nhật ký kiểm toán bắt buộc (AuditLog)
    Svc->>DB: tx.auditLog.create({ event: PAYROLL_PERIOD_REOPENED, actorId: adminUserId, ... })

    DB-->>Svc: Commit Transaction thành công
    deactivate DB

    Svc-->>Ctrl: { success: true, periodId, status: "DRAFT" }
    deactivate Svc
    Ctrl-->>Admin: 200 OK: Kỳ lương đã mở lại về DRAFT, dữ liệu sẵn sàng chỉnh sửa
```
