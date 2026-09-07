# Sơ đồ Trạng thái (State Machine Diagram) — Vòng đời Kỳ Lương & Dữ liệu Lương

> **Tài liệu**: Đặc tả Vòng đời Trạng thái (State Lifecycle Specifications)  
> **Phân hệ**: Dữ liệu tính lương (`du_lieu_tinh_luong`) & Bảng lương (`bang_luong`)  
> **Ngày lập**: 2026-09-06  
> **Trạng thái**: Chốt nghiệm thu SRS  

---

## 1. Sơ đồ Vòng đời Trạng thái Kỳ Lương (Payroll Period State Machine)

Vòng đời của một Kỳ tính lương (`PayrollPeriod`) từ khi bắt đầu khởi tạo, thu thập số liệu 8 phân hệ, kiểm tra, khóa sổ, phê duyệt đến chi trả và lưu trữ.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Khởi tạo Kỳ lương mới (Tháng YYYY-MM)

    state DRAFT {
        [*] --> ThuThapDuLieu: Hệ thống sinh lịch chuẩn từ GeneralSetting & Holiday
        ThuThapDuLieu --> ChinhSuaChamCong: Nhập vắng/nghỉ/công tác
        ThuThapDuLieu --> SoanTangCa: Soạn & Áp dụng giờ OT
        ThuThapDuLieu --> ChamKpi: Chấm điểm & Tính hiệu suất
        ThuThapDuLieu --> BoTriThuong: Nhập thưởng định kỳ & tết
        ThuThapDuLieu --> NghiemThuSanPham: Nhập số lượng sản phẩm hoàn thành
        ThuThapDuLieu --> TinhLuongPhanTram: Nhập doanh số hoa hồng
        ThuThapDuLieu --> KhauTruChuyenCan: Ghi nhận vi phạm thời gian
        ThuThapDuLieu --> GhiNhanBuTru: Nhập tạm ứng & truy lĩnh/hoàn trả
        
        ChinhSuaChamCong --> TinhToanThuNghiem: Kích hoạt tính thử lương
        SoanTangCa --> TinhToanThuNghiem
        ChamKpi --> TinhToanThuNghiem
        BoTriThuong --> TinhToanThuNghiem
        NghiemThuSanPham --> TinhToanThuNghiem
        TinhLuongPhanTram --> TinhToanThuNghiem
        KhauTruChuyenCan --> TinhToanThuNghiem
        GhiNhanBuTru --> TinhToanThuNghiem
        TinhToanThuNghiem --> ThuThapDuLieu: Điều chỉnh nếu có sai sót
    }

    DRAFT --> PENDING_REVIEW: Gửi đối soát & duyệt kỳ lương (C&B/Kế toán hoàn tất nhập liệu)
    
    PENDING_REVIEW --> DRAFT: Từ chối / Yêu cầu hiệu chỉnh số liệu (Kế toán trưởng / HR Lead phát hiện sai sót)
    
    PENDING_REVIEW --> LOCKED: Xác nhận đối soát thành công & Khóa sổ (Lock Period)
    
    state LOCKED {
        note right of LOCKED
            DỮ LIỆU ĐÓNG BĂNG HOÀN TOÀN (IMMUTABLE)
            - Chặn mọi thao tác sửa/xóa ở cả 8 phân hệ
            - Bảng lương được tính toán chính thức và lưu snapshot
            - Sẵn sàng trình Ban Giám Đốc ký duyệt
        end note
    }

    LOCKED --> DRAFT: Mở lại kỳ lương (Reopen Period - Chỉ ADMIN kèm lý do giải trình bắt buộc)
    
    LOCKED --> APPROVED: Ban Giám Đốc / CFO ký duyệt bảng lương
    
    APPROVED --> PAID: Kế toán thanh toán qua Ngân hàng / Xuất phiếu lương
    
    PAID --> ARCHIVED: Lưu trữ hồ sơ kế toán & Khóa vĩnh viễn (Không thể mở lại)
    
    ARCHIVED --> [*]
```

---

## 2. Bảng Ma trận Chuyển đổi Trạng thái (State Transition Matrix)

| Trạng thái hiện tại | Sự kiện / Trigger | Điều kiện bảo vệ (Guards) | Trạng thái mới | Vai trò được phép (RBAC) | Hành động phát sinh (Side Effects) |
|---|---|---|---|---|---|
| *(Khởi đầu)* | Tạo kỳ lương mới (`POST /payroll-periods`) | `code` (YYYY-MM) chưa tồn tại trong hệ thống. Tháng/Năm hợp lệ. | `DRAFT` | `ADMIN`, `HR` | Tự động sinh lịch chấm công tháng mặc định; tạo bản ghi kỳ lương rỗng. |
| `DRAFT` | Nhập / Cập nhật dữ liệu ở 8 phân hệ | Kỳ lương đang ở trạng thái `DRAFT`. Dữ liệu thỏa mãn validation của phân hệ. | `DRAFT` | `ADMIN`, `HR`, `ACCOUNTANT` | Ghi đè hoặc thêm bản ghi chi tiết; cập nhật trường `updatedAt` của kỳ lương. |
| `DRAFT` | Gửi duyệt kỳ lương (`POST /:id/submit`) | Ít nhất đã hoàn thành Chấm công cho toàn bộ nhân sự ACTIVE. | `PENDING_REVIEW` | `HR`, `ACCOUNTANT` | Gửi thông báo đến Kế toán trưởng / HR Manager; sinh bản xem trước bảng lương. |
| `PENDING_REVIEW` | Yêu cầu hiệu chỉnh (`POST /:id/reject`) | Bắt buộc nhập lý do từ chối (`reason.length >= 10`). | `DRAFT` | `ADMIN`, `HR`, `ACCOUNTANT` | Chuyển kỳ về `DRAFT`; gửi thông báo kèm lý do cho người lập bảng; ghi Audit Log. |
| `PENDING_REVIEW` | Khóa sổ kỳ lương (`POST /:id/lock`) | Bảng lương đã được tính toán đầy đủ; không còn nhân viên nào bị thiếu công chuẩn. | `LOCKED` | `ADMIN`, `ACCOUNTANT` | Đóng băng 8 bảng dữ liệu; chốt snapshot `DongBangLuong`; ghi nhận `lockedAt`, `lockedByUserId`. |
| `LOCKED` | Mở lại kỳ lương (`POST /:id/reopen`) | Chỉ cho phép khi có lý do giải trình đặc biệt; chưa ở trạng thái `PAID`. | `DRAFT` | **Chỉ `ADMIN`** | Hủy bỏ trạng thái khóa; ghi Audit Log mức độ cảnh báo cao (`PAYROLL_PERIOD_REOPENED`); thông báo cho toàn bộ ban điều hành. |
| `LOCKED` | Phê duyệt bảng lương (`POST /:id/approve`) | Kỳ lương đang ở `LOCKED`. Có chữ ký số / xác thực tài khoản cấp quản lý. | `APPROVED` | `ADMIN` (Giám đốc / CFO) | Ghi nhận `approvedAt`, `approvedByUserId`; cấp phép cho kế toán tiến hành lập lệnh chi tiền. |
| `APPROVED` | Hoàn tất chi trả lương (`POST /:id/mark-paid`) | Có chứng từ ngân hàng hoặc xác nhận giải ngân quỹ lương thành công. | `PAID` | `ADMIN`, `ACCOUNTANT` | Đánh dấu ngày chi trả; cho phép nhân viên xem phiếu lương cá nhân trên Cổng thông tin (Portal). |
| `PAID` | Đóng hồ sơ lưu trữ (`POST /:id/archive`) | Đã qua kỳ đối soát thuế và quyết toán quý/năm. | `ARCHIVED` | `ADMIN` | Đưa kỳ lương vào kho lưu trữ vĩnh viễn (Read-only forever). Không thể Reopen dưới bất kỳ hình thức nào. |

---

## 3. Quy tắc Ràng buộc Bất biến theo Trạng thái (State Invariants)

1. **Ràng buộc Ghi (Write-Protection Invariant)**:
   - Khi kỳ lương ở các trạng thái `LOCKED`, `APPROVED`, `PAID`, `ARCHIVED`:
     + Mọi lệnh gọi API `POST`, `PUT`, `PATCH`, `DELETE` đến 8 phân hệ (`cham_cong`, `tang_ca`, `kpi`, `thuong`, `luong_san_pham`, `luong_phan_tram`, `chuyen_can`, `bu_tru`) đều bị chặn tại Service Layer và trả về mã lỗi:
       ```json
       {
         "statusCode": 400,
         "errorCode": "E-dltl-001",
         "message": "Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu."
       }
       ```
2. **Ràng buộc Snapshot Tính lương (Calculation Invariant)**:
   - Khi chuyển trạng thái từ `PENDING_REVIEW` sang `LOCKED`, hệ thống chạy một lượt tính toán toàn diện cuối cùng cho toàn bộ nhân viên và lưu kết quả vào bảng `PayrollSheetRecord` / `PayrollSheetItem`.
   - Kết quả này trở thành **bất biến tuyệt đối**. Mọi truy vấn xem bảng lương của kỳ này sau đó sẽ đọc trực tiếp từ bảng snapshot đã lưu, không chạy lại công thức realtime để đảm bảo không bị ảnh hưởng nếu các tham số hệ thống trong tương lai thay đổi.
3. **Ràng buộc Mở lại có Kiểm soát (Reopen Audit Trail)**:
   - Thao tác `reopen` chỉ được trao cho vai trò `ADMIN`.
   - Bắt buộc phải có payload `{ reason: string }` với độ dài tối thiểu 20 ký tự.
   - Hệ thống tự động ghi nhật ký `AuditLog` với event `PAYROLL_PERIOD_REOPENED` bao gồm: ID người mở, thời gian, lý do, và trạng thái trước khi mở.
