# Đặc tả Yêu cầu Nghiệp vụ (SRS) — Phân hệ Dữ liệu Tính Lương (du_lieu_tinh_luong)

> **Mã phân hệ**: `HRM-PAYROLL-DATA` (Dữ liệu tính lương)  
> **Phiên bản**: 1.0.0  
> **Ngày soạn thảo**: 2026-09-06  
> **Tác giả**: Business Analyst (BA) Team  
> **Trạng thái**: Draft — Chờ Architect & Tester-QA rà soát  
> **Nguồn tham chiếu**: 
> - UI Component & Mock Logic: `C:\Users\Admin\Desktop\maxv_v2\hdđt_maxv\src\features\hrm\components\du_lieu_tinh_luong\`
> - Domain Types & Pure Calculations: `C:\Users\Admin\Desktop\maxv_v2\hdđt_maxv\src\features\hrm\` (`chamCong.ts`, `tangCa.ts`, `kpi.ts`, `thuong.ts`, `luongSanPham.ts`, `luongPhanTram.ts`, `chuyenCan.ts`, `buTru.ts`, `bangLuong.ts`)
> - Mock Store & Seeds: `C:\Users\Admin\Desktop\maxv_v2\hdđt_maxv\src\features\hrm\mock\` (`store.ts`, `seed.ts`, `hooks/`)
> - Backend DB Schema: `c:\Users\Admin\Desktop\project\Backend\prisma\schema.prisma`

---

## 1. Tổng quan & Bối cảnh Nghiệp vụ (Business Context)

### 1.1. Bối cảnh
Trong hệ thống HRM & Accounting, quy trình tính lương hàng tháng là trái tim nghiệp vụ kết nối trực tiếp giữa quản trị nhân sự và tài chính kế toán. Bảng lương tổng hợp cuối cùng (`DongBangLuong`) không tự sinh ra từ con số cố định mà là sự hội tụ số liệu từ **8 phân hệ thu thập dữ liệu đầu vào phát sinh trong kỳ**:
1. **Chấm công (`cham_cong`)**: Ngày công thực tế, nghỉ phép, nghỉ ốm, lễ tết.
2. **Tăng ca (`tang_ca`)**: Giờ làm thêm giờ ngày thường, ban đêm, chủ nhật, ngày lễ.
3. **Đánh giá KPI (`kpi`)**: Tỷ lệ hoàn thành các mục tiêu công việc theo trọng số.
4. **Thưởng (`thuong`)**: Các khoản thưởng đột xuất, thưởng lễ, tết, hiệu quả.
5. **Lương sản phẩm (`luong_san_pham`)**: Tiền lương nghiệm thu theo khối lượng sản phẩm/kiện/đơn.
6. **Lương phần trăm (`luong_phan_tram`)**: Hoa hồng doanh thu, hợp đồng, bán hàng.
7. **Lương chuyên cần (`chuyen_can`)**: Trừ vi phạm đi trễ, về sớm, quên chấm công, nghỉ sai quy định.
8. **Ứng - bù trừ lương (`bu_tru`)**: Tạm ứng lương, truy thu, phạt nội quy, truy lĩnh, hoàn phí bảo hiểm.

### 1.2. Mục tiêu nghiệp vụ
- **Thu thập chính xác & phân quyền minh bạch**: Cho phép HR và Trưởng bộ phận nhập liệu, kiểm tra, duyệt từng mảng dữ liệu lương theo kỳ một cách độc lập hoặc phối hợp.
- **Tự động hóa tính toán & cảnh báo tuân thủ Luật Lao động**: Tự động áp dụng hệ số làm thêm giờ (150% - 390%), kiểm soát trần làm thêm (40h/tháng, 200h/300h/năm), chặn trừ lạm vào lương cơ bản đối với chuyên cần.
- **Tính linh hoạt cao trong vận hành**: Hỗ trợ áp dụng bảng hàng loạt theo 3 phạm vi (Toàn công ty, Phòng ban, Nhân viên), tái sử dụng dữ liệu từ kỳ trước, import/export Excel hai chiều chuẩn hóa.
- **Đảm bảo tính bất biến & an toàn kiểm toán (Audit Trail)**: Khóa sổ dữ liệu kỳ lương (`Locked`), ngăn ngừa sửa đổi trái phép sau khi đã chốt duyệt và chuyển sang hạch toán kế toán.

---

## 2. Phân tích Đa phương án theo Triết lý Superpowers (Options & Trade-offs)

Để tổ chức kiến trúc dữ liệu và xử lý cho 8 phân hệ dữ liệu tính lương, BA đã phân tích 3 phương án kiến trúc:

### 2.1. Phương án 1: Unified Generic EAV / Key-Value Input Store (Lưu trữ tập trung dạng EAV)
- **Ý tưởng**: Tạo một bảng dữ liệu đầu vào duy nhất `PayrollInputEntry` với các cột: `employeeId`, `periodId`, `moduleType` (CHAM_CONG, TANG_CA, KPI...), `referenceCode`, `metricValue1` (số lượng/giờ), `metricValue2` (đơn giá/hệ số), `totalAmount`, `metadataJson`.
- **Ưu điểm**:
  - Tối giản số lượng bảng trong cơ sở dữ liệu (chỉ 1 bảng data + 1 bảng kỳ lương).
  - Thêm phân hệ tính lương mới trong tương lai không cần sửa đổi schema database.
- **Nhược điểm (Trade-offs)**:
  - Mất toàn bộ tính toàn vẹn dữ liệu ở tầng cơ sở dữ liệu: Không đặt được Foreign Key ràng buộc tới `SalaryItem`, `SanPham`, `ChiTieuKpi`.
  - Không thể định nghĩa kiểu dữ liệu chặt chẽ (ngày chấm công, ngày vi phạm chuyên cần, đơn vị sản phẩm phải nhét vào JSON).
  - Truy vấn tổng hợp bảng lương rất chậm vì phải `GROUP BY`, `JOIN` lọc `moduleType` nhiều lần hoặc parse JSONB phức tạp.
  - Nguy cơ bug nghiệp vụ cực lớn do thiếu ràng buộc UNIQUE tự nhiên (ví dụ vi phạm lặp KPI, trùng ca).

### 2.2. Phương án 2: Strict Independent Isolated Sub-modules (8 Phân hệ độc lập hoàn toàn)
- **Ý tưởng**: Mỗi phân hệ tạo một bộ bảng hoàn chỉnh riêng biệt cả về danh mục lẫn bảng kỳ: `OvertimeRecord`, `KpiRecord`, `BonusRecord`, `PieceworkRecord`... Kể cả danh mục Thưởng và Lương phần trăm cũng tách bảng danh mục riêng độc lập với `SalaryItem` của Cài đặt lương.
- **Ưu điểm**:
  - Các phân hệ hoàn toàn tách biệt (Decoupled), một phân hệ lỗi không ảnh hưởng phân hệ khác.
  - Tối ưu hóa schema chuyên biệt cho từng loại dữ liệu.
- **Nhược điểm (Trade-offs)**:
  - Nhân đôi/nhân ba danh mục cấu hình: `SalaryItem` trong Cài đặt lương đã có các loại `PERIODIC_BONUS` (`luong_thuong`) và `COMMISSION_PERCENTAGE` (`luong_phan_tram`). Nếu tạo thêm danh mục Thưởng/Phần trăm riêng thì khi sửa cấu hình thuế/BHXH sẽ bị lệch giữa 2 màn hình.
  - Tốn tài nguyên quản lý schema, lặp code CRUD danh mục không cần thiết.

### 2.3. Phương án 3 (Khuyến nghị lựa chọn): Domain-Driven Hybrid Modular with Shared Payroll Period & Unified Master Catalog
- **Ý tưởng**:
  - **Tái sử dụng Danh mục cốt lõi**: `SalaryItem` (thuộc ADR-006 Cài đặt lương) là nguồn chân lý duy nhất cho Thưởng (`PERIODIC_BONUS`) và Lương phần trăm (`COMMISSION_PERCENTAGE`), đảm bảo đồng nhất cờ BHXH (`isSocialInsurance`) và Thuế TNCN (`isTaxable`).
  - **Thiết kế Domain Schema chuyên biệt cho từng phân hệ có đặc tính riêng**:
    - `ChamCongRecord`: Ma trận chấm công theo ngày trong tháng, kế thừa lịch làm việc từ `GeneralSetting` và `Holiday`.
    - `TangCaRecord`: Giờ OT theo 6 hệ số pháp lý chuẩn, liên kết ngưỡng cảnh báo `GeneralSetting`.
    - `KpiItem` & `KpiRecord`: Danh mục chỉ tiêu riêng biệt (vì có đơn vị tính, trọng số mục tiêu/thực thi).
    - `PieceworkProduct` (`SanPham`) & `PieceworkRecord`: Danh mục sản phẩm riêng biệt (có đơn vị tính: cái, kiện, đơn, đơn giá snapshot).
    - `DiligenceViolationType` (`LoaiChuyenCan`) & `DiligenceRecord`: Danh mục lỗi chuyên cần riêng biệt (vì có logic 3 cách trừ: theo giờ, theo lần, mất toàn bộ).
    - `SalaryAdjustmentItem` (`KhoanBuTru`) & `SalaryAdjustmentRecord`: Danh mục bù trừ riêng biệt (có chiều Trừ / Bù).
  - **Quản lý Vòng đời qua Bảng Kỳ lương chung (`PayrollPeriod`)**: Quản lý trạng thái `DRAFT` -> `LOCKED` -> `APPROVED` -> `PAID`, đảm bảo tính nguyên tử khi chốt sổ bảng lương.
- **Lý do khuyến nghị**:
  - Tối ưu tuyệt đối về tính toàn vẹn dữ liệu (Postgres Foreign Keys, Unique Constraints).
  - Kế thừa toàn bộ nền tảng có sẵn từ Sprint 1 & Sprint 2 (`GeneralSetting`, `WorkShift`, `Holiday`, `SalaryItem`, `SalaryStructure`, `EmployeeSalary`).
  - Phù hợp 100% với giao diện UI và triết lý thiết kế đã xây dựng ở `features/hrm/components/du_lieu_tinh_luong`.

---

## 3. Phạm vi Nghiệp vụ Chi tiết của 8 Phân hệ

```
                             ┌───────────────────────────────────┐
                             │       KỲ LƯƠNG (PayrollPeriod)    │
                             │       Mã: YYYY-MM (Trạng thái)    │
                             └─────────────────┬─────────────────┘
                                               │
     ┌──────────────┬──────────────┬───────────┴──┬──────────────┬──────────────┬──────────────┐
     │              │              │              │              │              │              │
┌────┴─────┐ ┌──────┴────┐ ┌───────┴────┐ ┌───────┴────┐ ┌───────┴────┐ ┌───────┴────┐ ┌───────┴────┐ ┌──────┴────┐
│Chấm công │ │  Tăng ca  │ │    KPI     │ │   Thưởng   │ │Lương SP    │ │Lương %     │ │Chuyên cần  │ │ Ứng bù trừ │
│cham_cong │ │  tang_ca  │ │    kpi     │ │   thuong   │ │luong_san_  │ │luong_phan_ │ │ chuyen_can │ │  bu_tru    │
│          │ │           │ │            │ │            │ │  pham      │ │  tram      │ │            │ │            │
└──────────┘ └───────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
     │              │              │              │              │              │              │              │
     └──────────────┴──────────────┴───────────┬──┴──────────────┴──────────────┴──────────────┴──────────────┘
                                               ▼
                             ┌───────────────────────────────────┐
                             │  BẢNG TÍNH LƯƠNG (PayrollSheet)   │
                             │  Thu nhập -> Thuế -> Thực lĩnh    │
                             └───────────────────────────────────┘
```

### 3.1. Phân hệ 1: Chấm công (`cham_cong`)
- **Mục tiêu**: Xác định số ngày công làm việc thực tế (`ngayCongThucTe`) và số ngày công chuẩn (`ngayCongChuan`) của từng nhân viên trong tháng.
- **Cơ chế hoạt động**:
  - Bảng chấm công được sinh tự động dựa trên:
    + Số ngày thực tế của tháng (`nam`, `thang`).
    + Chính sách Thứ 7 (`saturdayPolicy`), Chủ nhật (`sundayPolicy`) từ `GeneralSetting`.
    + Danh sách ngày lễ nghỉ hưởng lương từ `Holiday`.
    + Phương pháp tính ngày công chuẩn (`phuongPhapNgayCong`: `co_dinh_24`, `co_dinh_26`, `theo_thang`).
  - **8 loại công chuẩn (`LoaiCong`)**:
    1. `lam_viec`: Làm việc cả ngày (tính 1 công).
    2. `nua_ngay`: Làm việc nửa buổi (tính 0.5 công).
    3. `cong_tac`: Đi công tác (tính 1 công).
    4. `nghi_phep`: Nghỉ phép năm có lương (tính 1 công).
    5. `nghi_le`: Nghỉ ngày lễ có lương (tính 1 công).
    6. `om`: Nghỉ ốm hưởng chế độ BHXH (0 công lương doanh nghiệp).
    7. `khong_luong`: Nghỉ việc riêng không hưởng lương (0 công).
    8. `khac`: Nghỉ lý do khác (0 công).
  - **Ghi đè số giờ (`soGio`)**: Cho phép nhập giờ công lẻ (từ 0 đến `standardHoursPerDay`). Khi có số giờ, công quy đổi = `round(soGio / standardHoursPerDay, 2)`.
  - **Chiến lược lưu trữ (Delta / Override Store)**: Hệ thống chỉ lưu các ô chấm công bị người dùng điều chỉnh khác với lịch chuẩn (tiết kiệm 90% dung lượng bảng ghi).

### 3.2. Phân hệ 2: Tăng ca (`tang_ca`)
- **Mục tiêu**: Ghi nhận giờ làm thêm ngoài giờ, quy đổi giờ công tăng ca theo hệ số luật định và kiểm soát trần an toàn lao động.
- **6 loại tăng ca chuẩn (`LoaiTangCa`)**:
  1. `ngay_thuong_ngay`: Ngày thường - Ban ngày (Hệ số `tc_ngay_thuong_ngay`, mặc định 150%).
  2. `ngay_thuong_dem`: Ngày thường - Ban đêm (Hệ số `tc_ngay_thuong_dem`, mặc định 200%).
  3. `chu_nhat_ngay`: Nghỉ hàng tuần - Ban ngày (Hệ số `tc_chu_nhat_ngay`, mặc định 200%).
  4. `chu_nhat_dem`: Nghỉ hàng tuần - Ban đêm (Hệ số `tc_chu_nhat_dem`, mặc định 270%).
  5. `ngay_le_ngay`: Nghỉ lễ/tết - Ban ngày (Hệ số `tc_ngay_le_ngay`, mặc định 300%).
  6. `ngay_le_dem`: Nghỉ lễ/tết - Ban đêm (Hệ số `tc_ngay_le_dem`, mặc định 390%).
- **Công thức quy đổi**:
  $$\text{gio\_quy\_doi} = \text{round}\left(\frac{\text{so\_gio} \times \text{he\_so}}{100}, 1\right)$$
- **Kiểm soát trần giờ theo Điều 107 Bộ luật Lao động 2019**:
  - Trần tháng: `otMonthlyLimitHours` (mặc định 40h/tháng). Cảnh báo vàng khi $\ge 80\%$, báo đỏ lỗi khi $> 40h$.
  - Ngưỡng cảnh báo năm: `otYearlyWarningHours` (mặc định 200h/năm).
  - Trần tối đa năm: `otYearlyLimitHours` (mặc định 300h/năm).

### 3.3. Phân hệ 3: KPI (`kpi`)
- **Mục tiêu**: Đánh giá hiệu suất hoàn thành mục tiêu công việc để tính khoản lương hiệu quả công việc.
- **Cấu trúc dữ liệu**:
  - Danh mục chỉ tiêu (`ChiTieuKpi`): Mã chỉ tiêu, tên chỉ tiêu, đơn vị tính, trọng số mặc định.
  - Bảng chỉ tiêu nhân viên (`DongKpi`): `ma_kpi`, `trong_so`, `muc_tieu`, `thuc_thi`.
- **Công thức tính toán**:
  - Tỷ lệ hoàn thành chỉ tiêu:
    $$\text{ty\_le\_ht} = \text{round}\left(\frac{\text{thuc\_thi}}{\text{muc\_tieu}} \times 100, 1\right)$$
  - Hiệu suất chung bình quân theo trọng số:
    $$\text{hieu\_suat} = \text{round}\left(\frac{\sum (\text{ty\_le\_ht} \times \text{trong\_so})}{\sum \text{trong\_so}}, 1\right)$$
- **Tích hợp vào bảng lương**:
  - Khoản tiền KPI = $\text{round}\left(\frac{\text{muc\_kpi\_set\_luong} \times \text{hieu\_suat}}{100}\right)$.
  - Nếu kỳ lương chưa chấm KPI (`null`): Tiền KPI = 0 (khác với chuyên cần mặc định hưởng).

### 3.4. Phân hệ 4: Thưởng (`thuong`)
- **Mục tiêu**: Chi trả các khoản tiền thưởng định kỳ, thưởng dự án, thưởng sáng kiến, thưởng tết.
- **Cơ chế danh mục**: Trỏ trực tiếp tới `SalaryItem` thuộc loại `PERIODIC_BONUS` (`luong_thuong`).
- **Quy tắc tính toán**:
  - Cột `so_tien`: Mức tiền thưởng của 1 nhân viên (VND).
  - Cột `thanh_tien`: Phần ngân sách mà khoản thưởng tiêu tốn cho cả nhóm nhân viên được chọn ($\text{so\_tien} \times \text{so\_nhan\_vien}$).
  - Tổng tiền thưởng nhân viên = $\sum \text{so\_tien}$.

### 3.5. Phân hệ 5: Lương sản phẩm (`luong_san_pham`)
- **Mục tiêu**: Tính lương theo khối lượng sản phẩm/công việc hoàn thành (Piecework).
- **Cấu trúc danh mục**: `SanPham` (`ma_sp`, `ten_sp`, `don_vi`, `don_gia`, `ghi_chu`, `status`).
- **Quy tắc Snapshot đơn giá (Crucial)**:
  - Khi đưa sản phẩm vào kỳ lương, hệ thống sao chép snapshot `don_gia` từ danh mục sang dòng kỳ lương.
  - Cho phép người làm lương điều chỉnh đơn giá riêng cho kỳ đó mà không làm thay đổi bảng giá gốc trong danh mục.
  - Thành tiền dòng = $\text{round}(\text{don\_gia} \times \text{so\_luong})$.
  - Tổng tiền lương sản phẩm = $\sum \text{thanh\_tien}$.

### 3.6. Phân hệ 6: Lương phần trăm (`luong_phan_tram`)
- **Mục tiêu**: Tính hoa hồng bán hàng, phần trăm doanh số hoặc hoa hồng theo hợp đồng ký kết.
- **Cơ chế danh mục**: Trỏ tới `SalaryItem` loại `COMMISSION_PERCENTAGE` (`luong_phan_tram`), kế thừa tỷ lệ phần trăm mặc định (`defaultRate` / `ty_le`).
- **Quy tắc tính toán**:
  - Dòng chi tiết gồm: `ma_khoan`, `so_tien_co_so` (doanh số làm gốc), `ty_le` (% hoa hồng, cho phép điều chỉnh theo kỳ).
  - Thành tiền dòng = $\text{round}\left(\frac{\text{so\_tien\_co\_so} \times \text{ty\_le}}{100}\right)$.
  - Tổng lương phần trăm = $\sum \text{thanh\_tien}$.

### 3.7. Phân hệ 7: Lương chuyên cần (`chuyen_can`)
- **Mục tiêu**: Quản lý mức thưởng chuyên cần và các khoản khấu trừ do vi phạm kỷ luật lao động, thời gian làm việc.
- **Mức hưởng cơ sở (`don_gia`)**:
  - Đọc từ cấu hình `EmployeeSalary` của nhân viên (tổng các khoản loại `luong_chuyen_can`).
  - Nếu nhân viên chưa set lương riêng: Tự động lấy mức mặc định từ `SalaryStructure` khung của công ty.
- **Danh mục lỗi chuyên cần (`LoaiChuyenCan`)**:
  - `theo_gio`: Trừ theo số giờ vi phạm ($\text{muc\_tru} \times \text{so\_gio}$, ví dụ đi trễ, về sớm).
  - `theo_lan`: Trừ cố định theo số lần vi phạm ($\text{muc\_tru}$, ví dụ quên chấm công).
  - `mat_toan_bo`: Mất toàn bộ khoản chuyên cần của kỳ (bất kể mức chuyên cần là bao nhiêu, ví dụ nghỉ không phép).
- **Ràng buộc chặn sàn (Hard Invariant Rule)**:
  - Tổng tiền bị trừ trong kỳ không bao giờ được vượt quá mức chuyên cần được hưởng:
    $$\text{tong\_tru} = \min(\sum \text{tien\_tru\_dong}, \text{don\_gia})$$
  - Thực nhận chuyên cần: $\text{thanh\_tien} = \max(0, \text{don\_gia} - \text{tong\_tru})$.
  - **Tuyệt đối không để chuyên cần bị âm hoặc trừ lấn sang lương cơ bản và phụ cấp khác**.
  - Bảng rỗng (`dong: []`) mang ý nghĩa nghiệp vụ: Nhân viên đã được đánh giá và **không vi phạm lỗi nào**, được hưởng trọn vẹn 100% chuyên cần.

### 3.8. Phân hệ 8: Các khoản ứng - bù trừ lương (`bu_tru`)
- **Mục tiêu**: Xử lý các khoản điều chỉnh sau thuế/trước thực lĩnh: Tạm ứng, truy thu, phạt vi phạm, truy lĩnh kỳ trước, hoàn chênh lệch bảo hiểm.
- **Danh mục khoản bù trừ (`KhoanBuTru`)**:
  - Gồm thuộc tính cốt lõi `chieu`:
    + `tru` (Khấu trừ): Tạm ứng lương, thu hồi tạm ứng, trừ tiền ăn, phạt vi phạm nội quy.
    + `bu` (Cộng bù): Truy lĩnh lương tháng trước, hoàn trả chênh lệch bảo hiểm/công đoàn.
- **Quy tắc nhập liệu an toàn**:
  - Người dùng luôn nhập số tiền dương ($\text{so\_tien} > 0$).
  - Hệ thống tự động xác định dấu theo `chieu`: Dòng `bu` mang dấu âm trong công thức trừ ($\text{tien\_co\_dau} = -\text{so\_tien}$), dòng `tru` mang dấu dương.
  - Tổng bị trừ: $\text{tong\_bi\_tru} = \sum \text{tru} - \sum \text{bu}$.
  - Nếu $\text{tong\_bi\_tru} < 0$: Nghĩa là nhân viên được cộng thêm tiền vào thực lĩnh.
- **Tác động lên Thực lĩnh (`thuc_linh`)**:
  $$\text{thuc\_linh} = \text{thu\_nhap} - \text{bao\_hiem} - \text{cong\_doan} - \text{thue\_tncn} - \text{tong\_bi\_tru}$$
  *Lưu ý: `thuc_linh` có thể nhận giá trị âm nếu khoản tạm ứng trong kỳ lớn hơn thu nhập thực tế. Khoản âm này phản ánh nghĩa vụ nhân viên còn nợ công ty và chuyển sang kỳ sau.*

---

## 4. Danh mục Quy tắc Nghiệp vụ Chi tiết (Business Rules Catalog)

| Mã Quy tắc | Phân hệ áp dụng | Tên quy tắc & Nội dung chi tiết | Mức độ |
|---|---|---|---|
| **BR-dltl-001** | Chung (Kỳ lương) | **Tính bất biến của kỳ đã khóa**: Mọi thao tác thêm/sửa/xóa dòng dữ liệu ở cả 8 phân hệ chỉ được phép thực hiện khi kỳ lương ở trạng thái `DRAFT`. Khi kỳ ở trạng thái `LOCKED` hoặc `APPROVED`, API bắt buộc từ chối với mã lỗi `E-dltl-001`. | BẮT BUỘC (Critical) |
| **BR-dltl-002** | Chung (Nhân sự) | **Chỉ áp dụng cho nhân sự đang làm việc**: Dữ liệu tính lương chỉ được lập cho nhân viên có ít nhất một `Contract` bao phủ kỳ tính lương (`effectiveFrom <= kỳ` và `effectiveTo IS NULL hoặc effectiveTo >= kỳ`). Module Nhân sự không có field `Employee.status` riêng — "đang làm việc" xác định hoàn toàn qua hiệu lực hợp đồng. Nhân viên không có hợp đồng bao phủ kỳ (đã nghỉ việc) không được xuất hiện trong danh sách áp dụng; nếu bị chọn thủ công qua phạm vi `nhan_vien`, hệ thống từ chối rõ ràng bằng `E-dltl-002` thay vì âm thầm loại bỏ. *(Sửa 2026-09-06 — rà soát retrospective phát hiện wording gốc tham chiếu field `status` không tồn tại trong schema; xem `qa/issues-and-bugs.md` Mục 6, CRITICAL-2.)* | BẮT BUỘC |
| **BR-dltl-003** | Chung (Phạm vi) | **Quy tắc áp dụng 3 phạm vi**: Khi áp dụng bảng dữ liệu mẫu (`mau_*`), hệ thống sao chép độc lập (`clone`) cho từng nhân viên thuộc phạm vi: (1) `toan_cong_ty`: toàn bộ NV đang làm việc; (2) `phong_ban`: bắt buộc chọn phòng ban cụ thể; (3) `nhan_vien`: áp dụng cho danh sách nhân viên đã lọc. Mỗi nhân viên nhận một ID dòng độc lập. | BẮT BUỘC |
| **BR-dltl-004** | Chấm công | **Kế thừa lịch chuẩn tự động**: Bảng chấm công ban đầu tự động kế thừa số ngày làm việc, thứ 7, chủ nhật và ngày lễ từ `GeneralSetting` và `Holiday`. Người dùng chỉ cần ghi nhận các điểm lệch (vắng, nghỉ ốm, công tác, nửa ngày). | BẮT BUỘC |
| **BR-dltl-005** | Chấm công | **Giới hạn giờ công một ô**: Số giờ làm việc cụ thể (`soGio`) trong một ô chấm công không được âm và không được vượt quá số giờ công chuẩn trong ngày (`standardHoursPerDay`). | BẮT BUỘC |
| **BR-dltl-006** | Tăng ca | **Ràng buộc phân loại giờ tăng ca**: Một bảng tăng ca của một nhân viên không được phép chứa 2 dòng cùng một `loai` tăng ca. Nếu có nhiều buổi làm thêm cùng loại, số giờ phải được cộng dồn vào một dòng. | BẮT BUỘC |
| **BR-dltl-007** | Tăng ca | **Kiểm soát trần giờ làm thêm**: Cảnh báo khi tổng giờ OT tháng vượt quá `otMonthlyLimitHours` (40h) hoặc lũy kế năm vượt quá `otYearlyLimitHours` (300h). | CẢNH BÁO / CHẶN |
| **BR-dltl-008** | KPI | **Tổng trọng số KPI**: Một bảng KPI không được phép có chỉ tiêu trùng lặp. Tổng trọng số ($\sum \text{trong\_so}$) phải $> 0$. Khuyến nghị bằng 100, nếu khác 100 hệ thống hiển thị cảnh báo vàng nhưng không chặn lưu. | BẮT BUỘC |
| **BR-dltl-009** | KPI | **Mục tiêu KPI dương**: Giá trị `muc_tieu` trong KPI bắt buộc phải $> 0$. Nếu $\le 0$, tỷ lệ hoàn thành được tính bằng 0% để tránh lỗi chia cho 0 (`division by zero`). | BẮT BUỘC |
| **BR-dltl-010** | Thưởng | **Tính duy nhất khoản thưởng**: Trong một kỳ lương, một nhân viên không được nhận 2 lần cùng một mã khoản thưởng (`ma_khoan`). Nếu thưởng nhiều đợt cùng loại, phải cộng gộp số tiền. | BẮT BUỘC |
| **BR-dltl-011** | Thưởng | **Số tiền thưởng không âm**: Mức tiền thưởng của từng dòng bắt buộc $\ge 0$. | BẮT BUỘC |
| **BR-dltl-012** | Lương sản phẩm | **Bảo toàn đơn giá Snapshot**: Đơn giá sản phẩm (`don_gia`) khi đưa vào kỳ lương được snapshot độc lập. Việc cập nhật đơn giá trong danh mục sản phẩm sau này không được làm thay đổi đơn giá của các kỳ lương đã lập. | BẮT BUỘC |
| **BR-dltl-013** | Lương sản phẩm | **Số lượng và Đơn giá không âm**: Đơn giá $\ge 0$, Số lượng $\ge 0$ (cho phép số thập phân tối đa 2 chữ số). Thành tiền làm tròn về đơn vị đồng (không có số lẻ đồng). | BẮT BUỘC |
| **BR-dltl-014** | Lương phần trăm | **Số tiền cơ sở và Tỷ lệ không âm**: Số tiền cơ sở $\ge 0$, Tỷ lệ hoa hồng $0\% \le \text{ty\_le} \le 100\%$. Thành tiền làm tròn về đơn vị đồng. | BẮT BUỘC |
| **BR-dltl-015** | Lương phần trăm | **Tỷ lệ phần trăm Snapshot**: Tỷ lệ phần trăm chốt theo kỳ của từng nhân viên, không tự động chạy theo tỷ lệ mặc định của danh mục khi danh mục thay đổi. | BẮT BUỘC |
| **BR-dltl-016** | Chuyên cần | **Chặn âm chuyên cần**: Tổng tiền phạt chuyên cần tối đa bằng đúng mức phụ cấp chuyên cần được hưởng trong kỳ. Không bao giờ trừ âm vào lương. | BẮT BUỘC (Hard Gate) |
| **BR-dltl-017** | Chuyên cần | **Cho phép trùng loại khác ngày**: Trong bảng chuyên cần, cho phép lặp lại cùng một loại lỗi (`ma_cc`) nhưng **bắt buộc phải khác ngày** (`ngay`). Không được trùng cặp `[ma_cc, ngay]`. | BẮT BUỘC |
| **BR-dltl-018** | Chuyên cần | **Ý nghĩa bảng rỗng**: Bảng chuyên cần rỗng của nhân viên nghĩa là nhân viên đã được xét duyệt và không có vi phạm nào trong kỳ, nhận đủ 100% chuyên cần. Chưa xét duyệt thì trường này mang giá trị `null`. | BẮT BUỘC |
| **BR-dltl-019** | Ứng - Bù trừ | **Nhập số tiền dương tuyệt đối**: Trường `so_tien` trong bảng bù trừ luôn nhập số dương $> 0$. Dấu cộng/trừ hoàn toàn do thuộc tính `chieu` trong danh mục quy định. Cấm nhập số âm. | BẮT BUỘC |
| **BR-dltl-020** | Ứng - Bù trừ | **Không trùng khoản bù trừ**: Trong một kỳ, một nhân viên không được có 2 dòng cùng một mã khoản bù trừ (`ma_bt`). | BẮT BUỘC |
| **BR-dltl-021** | Tái sử dụng | **Tính độc lập của dữ liệu clone**: Chức năng "Tái sử dụng" sao chép dữ liệu từ kỳ trước hoặc từ nhân viên khác bắt buộc phải sinh mới toàn bộ các ID dòng chi tiết (`sinhIdDong*`), không được giữ ID cũ. | BẮT BUỘC |
| **BR-dltl-022** | Excel IO | **Chuẩn hóa cấu trúc Import/Export**: File Excel nhập vào phải đúng cấu trúc mẫu đã tải về (`taiFileMau*`). Nếu file có dòng lỗi (mã không tồn tại, số lượng âm, sai format ngày), hệ thống phải chỉ rõ dòng lỗi và từ chối nguyên tử toàn bộ file. | BẮT BUỘC |

---

## 5. Ma trận Mã Lỗi Chuẩn Hóa (Error Matrix)

| Mã lỗi | HTTP Status | Thông điệp lỗi tiếng Việt | Nguyên nhân vi phạm |
|---|---|---|---|
| `E-dltl-001` | 400 Bad Request | Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu. | Vi phạm BR-dltl-001 |
| `E-dltl-002` | 400 Bad Request | Nhân viên không tồn tại hoặc đã nghỉ việc. | Vi phạm BR-dltl-002 |
| `E-dltl-003` | 400 Bad Request | Chưa chọn phòng ban khi áp dụng theo phạm vi phòng ban. | Vi phạm BR-dltl-003 |
| `E-dltl-004` | 400 Bad Request | Danh sách nhân viên áp dụng không được để trống. | Vi phạm BR-dltl-003 |
| `E-dltl-005` | 400 Bad Request | Số giờ công không được âm hoặc vượt quá số giờ chuẩn trong ngày. | Vi phạm BR-dltl-005 |
| `E-dltl-006` | 400 Bad Request | Loại tăng ca bị lặp lại trong bảng của nhân viên. | Vi phạm BR-dltl-006 |
| `E-dltl-007` | 400 Bad Request | Số giờ tăng ca phải lớn hơn 0. | Vi phạm BR-dltl-007 |
| `E-dltl-008` | 400 Bad Request | Còn dòng chưa chọn chỉ tiêu KPI hoặc mã chỉ tiêu không hợp lệ. | Vi phạm BR-dltl-008 |
| `E-dltl-009` | 400 Bad Request | Chỉ tiêu KPI bị lặp lại trong bảng. | Vi phạm BR-dltl-008 |
| `E-dltl-010` | 400 Bad Request | Tổng trọng số KPI phải lớn hơn 0. | Vi phạm BR-dltl-008 |
| `E-dltl-011` | 400 Bad Request | Khoản thưởng bị lặp lại trong bảng của nhân viên. | Vi phạm BR-dltl-010 |
| `E-dltl-012` | 400 Bad Request | Số tiền thưởng phải lớn hơn hoặc bằng 0. | Vi phạm BR-dltl-011 |
| `E-dltl-013` | 400 Bad Request | Còn dòng sản phẩm chưa chọn mã sản phẩm hợp lệ. | Vi phạm BR-dltl-012 |
| `E-dltl-014` | 400 Bad Request | Sản phẩm bị lặp lại trong bảng lương sản phẩm. | Vi phạm BR-dltl-012 |
| `E-dltl-015` | 400 Bad Request | Đơn giá hoặc số lượng sản phẩm không được âm. | Vi phạm BR-dltl-013 |
| `E-dltl-016` | 400 Bad Request | Khoản lương phần trăm bị lặp lại trong bảng. | Vi phạm BR-dltl-014 |
| `E-dltl-017` | 400 Bad Request | Tỷ lệ hoa hồng phải từ 0% đến 100%. | Vi phạm BR-dltl-014 |
| `E-dltl-018` | 400 Bad Request | Còn dòng chuyên cần chưa chọn loại lỗi hoặc chưa điền ngày. | Vi phạm BR-dltl-017 |
| `E-dltl-019` | 400 Bad Request | Lỗi chuyên cần bị khai báo trùng lặp cho cùng một ngày. | Vi phạm BR-dltl-017 |
| `E-dltl-020` | 400 Bad Request | Số giờ vi phạm chuyên cần không được âm. | Vi phạm BR-dltl-016 |
| `E-dltl-021` | 400 Bad Request | Còn dòng bù trừ chưa chọn khoản hoặc mã khoản không hợp lệ. | Vi phạm BR-dltl-019 |
| `E-dltl-022` | 400 Bad Request | Khoản bù trừ bị lặp lại trong bảng của nhân viên. | Vi phạm BR-dltl-020 |
| `E-dltl-023` | 400 Bad Request | Số tiền bù trừ phải lớn hơn 0 (chiều bù hoặc trừ do danh mục quy định). | Vi phạm BR-dltl-019 |
| `E-dltl-024` | 400 Bad Request | File Excel nhập vào không đúng cấu trúc mẫu quy định. | Vi phạm BR-dltl-022 |
| `E-dltl-025` | 404 Not Found | Kỳ lương không tồn tại trong hệ thống. | Validate ID kỳ |
| `E-dltl-026` | 409 Conflict | Đang có thao tác khóa sổ kỳ lương đồng thời, vui lòng thử lại. | Concurrency Lock |

---

## 6. User Stories & Tiêu chí Chấp nhận (Given / When / Then)

### 6.1. Epic: Chấm công (Attendance Management)
- **User Story US-dltl-01**: Là Chuyên viên C&B, tôi muốn xem ma trận chấm công tháng hiện tại của nhân viên với các ngày làm việc, nghỉ lễ, cuối tuần được tự động hiển thị để tôi chỉ cần chỉnh sửa các ngày có phát sinh bất thường.
  - **AC-dltl-01-A (Tự sinh lịch chuẩn)**:
    - *Given*: Kỳ lương tháng 08/2026, cấu hình `saturdayPolicy = HALF_DAY`, `sundayPolicy = OFF`, ngày 19/08 là ngày lễ công ty.
    - *When*: Người dùng mở màn hình Chấm công tháng 08/2026.
    - *Then*: Hệ thống hiển thị 31 cột ngày, các ngày Chủ nhật có nền màu cảnh báo nghỉ, ngày 19/08 có nhãn lễ công ty và tính 1 công nghỉ lễ, các buổi sáng Thứ 7 hiển thị 0.5 công.
  - **AC-dltl-01-B (Chỉnh sửa ô công có số giờ lẻ)**:
    - *Given*: Nhân viên `NV0001` ngày 10/08 có giờ công chuẩn là 8 giờ.
    - *When*: Người dùng mở popover tại ô ngày 10/08, chọn loại `lam_viec`, nhập `soGio = 6`.
    - *Then*: Ô công cập nhật số giờ 6h, công quy đổi tự động tính thành $6 / 8 = 0.75$ công, tổng ngày công thực tế của nhân viên tăng thêm 0.75.
  - **AC-dltl-01-C (Chặn nhập giờ vượt trần)**:
    - *Given*: Giờ công chuẩn ngày là 8h.
    - *When*: Người dùng nhập `soGio = 9` hoặc `-1`.
    - *Then*: Popover chặn lưu và báo lỗi không hợp lệ (`gioHopLe = false`).

### 6.2. Epic: Tăng ca (Overtime Management)
- **User Story US-dltl-02**: Là Quản lý bộ phận, tôi muốn soạn bảng giờ làm thêm và áp dụng cho toàn bộ nhân viên trong tổ sản xuất của tôi để tính tiền làm thêm giờ theo đúng hệ số pháp luật.
  - **AC-dltl-02-A (Soạn bảng tăng ca và quy đổi giờ)**:
    - *Given*: Hệ thống có hệ số `tc_ngay_thuong_ngay = 150%`, `tc_chu_nhat_ngay = 200%`.
    - *When*: Người dùng thêm 2 dòng: (1) Ngày thường ban ngày 10h, (2) Chủ nhật ban ngày 5h.
    - *Then*: Dòng 1 quy đổi thành $10 \times 1.5 = 15.0$h, Dòng 2 quy đổi thành $5 \times 2.0 = 10.0$h. Tổng OT là 15.0h, tổng quy đổi là 25.0h.
  - **AC-dltl-02-B (Áp dụng hàng loạt theo phòng ban)**:
    - *Given*: Người dùng chọn phạm vi `phong_ban`, chọn "Phòng Kinh doanh 1" (gồm 4 nhân viên).
    - *When*: Bấm "Áp dụng tăng ca (4)" và xác nhận.
    - *Then*: Cả 4 nhân viên đều được cập nhật bảng tăng ca trên với các ID dòng độc lập, hệ thống hiển thị thông báo thành công.
  - **AC-dltl-02-C (Cảnh báo vượt trần tháng)**:
    - *Given*: Trần tháng là 40h. Nhân viên `NV0003` có tổng giờ OT là 44h.
    - *When*: Xem danh sách tăng ca.
    - *Then*: Cột tổng giờ tháng của `NV0003` được tô màu đỏ (mã `error`), chip cảnh báo hiển thị vượt trần.

### 6.3. Epic: Đánh giá KPI (KPI Performance)
- **User Story US-dltl-03**: Là Trưởng phòng, tôi muốn chấm điểm kết quả thực thi các chỉ tiêu KPI của nhân viên để hệ thống tự động tính tỷ lệ hoàn thành và tính tiền thưởng KPI vào bảng lương.
  - **AC-dltl-03-A (Tính hiệu suất theo trọng số)**:
    - *Given*: Nhân viên có 2 chỉ tiêu: Chỉ tiêu A (trọng số 60, mục tiêu 100, thực thi 90 -> HT 90%), Chỉ tiêu B (trọng số 40, mục tiêu 10, thực thi 12 -> HT 120%).
    - *When*: Hệ thống tính toán hiệu suất chung.
    - *Then*: $\text{hieu\_suat} = \frac{90 \times 60 + 120 \times 40}{60 + 40} = \frac{5400 + 4800}{100} = 102.0\%$. Chip hiệu suất hiển thị màu xanh lá (`success`).
  - **AC-dltl-03-B (Chặn chỉ tiêu trùng lặp)**:
    - *Given*: Bảng KPI đang soạn đã có chỉ tiêu `KPI01`.
    - *When*: Người dùng thêm dòng mới và tiếp tục chọn chỉ tiêu `KPI01`.
    - *Then*: Hệ thống báo lỗi `E-dltl-009`: "Chỉ tiêu ... bị lặp trong bảng" và chặn lưu.

### 6.4. Epic: Thưởng (Bonus Management)
- **User Story US-dltl-04**: Là Giám đốc nhân sự, tôi muốn áp dụng mức thưởng Tết cho toàn bộ nhân viên công ty và theo dõi tổng ngân sách chi thưởng trước khi phê duyệt.
  - **AC-dltl-04-A (Hiển thị tổng ngân sách nhóm)**:
    - *Given*: Phạm vi chọn `toan_cong_ty` (11 nhân viên). Khoản thưởng Tết là 5.000.000 ₫/người.
    - *When*: Người dùng nhập số tiền 5.000.000 ₫.
    - *Then*: Cột "Số tiền" hiển thị 5.000.000 ₫, Cột "Thành tiền" tự động tính $5.000.000 \times 11 = 55.000.000$ ₫. Chip trên đầu bảng hiển thị "Tổng quỹ: 55.000.000 ₫".
  - **AC-dltl-04-B (Chặn nhập số tiền âm)**:
    - *Given*: Bảng thưởng đang soạn.
    - *When*: Người dùng nhập số tiền -1.000.000 ₫.
    - *Then*: Hệ thống báo lỗi `E-dltl-012` và không cho phép lưu.

### 6.5. Epic: Lương sản phẩm (Piecework)
- **User Story US-dltl-05**: Là Quản đốc phân xưởng, tôi muốn nhập số lượng sản phẩm hoàn thành của công nhân để tính lương theo đơn giá sản phẩm đã thỏa thuận.
  - **AC-dltl-05-A (Snapshot đơn giá)**:
    - *Given*: Sản phẩm `SP01` trong danh mục có đơn giá 25.000 ₫.
    - *When*: Người dùng thêm `SP01` vào bảng sản phẩm của công nhân `NV0005`, số lượng 200 cái. Sau đó chỉnh sửa đơn giá thành 27.000 ₫ (do làm ca đặc biệt).
    - *Then*: Thành tiền dòng tính thành $27.000 \times 200 = 5.400.000$ ₫. Đơn giá của `SP01` trong danh mục gốc vẫn giữ nguyên 25.000 ₫.

### 6.6. Epic: Lương chuyên cần (Diligence Allowance)
- **User Story US-dltl-06**: Là Chuyên viên C&B, tôi muốn ghi nhận các lần vi phạm kỷ luật lao động của nhân viên để khấu trừ vào phụ cấp chuyên cần theo đúng quy chế nội bộ và không trừ vượt quá mức chuyên cần.
  - **AC-dltl-06-A (Lỗi mất toàn bộ chuyên cần)**:
    - *Given*: Nhân viên `NV0004` có mức chuyên cần hưởng là 500.000 ₫.
    - *When*: Thêm vi phạm "Nghỉ không phép" ngày 07/08 (loại `mat_toan_bo`).
    - *Then*: Tổng trừ tự động bằng 500.000 ₫, Thành tiền chuyên cần còn lại = 0 ₫.
  - **AC-dltl-06-B (Chặn trừ vượt trần chuyên cần)**:
    - *Given*: Nhân viên `NV0003` có mức chuyên cần là 300.000 ₫. Bị phạt đi trễ 10 giờ (loại `theo_gio` 50.000 ₫/h, tổng phạt tính ra 500.000 ₫).
    - *When*: Hệ thống tính toán tổng tiền bị trừ.
    - *Then*: $\text{tong\_tru} = \min(500.000, 300.000) = 300.000$ ₫. Thành tiền chuyên cần = 0 ₫. Tuyệt đối không trừ lấn 200.000 ₫ sang lương cơ bản.

### 6.7. Epic: Các khoản ứng - bù trừ (Advances & Adjustments)
- **User Story US-dltl-07**: Là Kế toán tiền lương, tôi muốn ghi nhận khoản nhân viên tạm ứng giữa tháng và tiền hoàn bảo hiểm để điều chỉnh chính xác số tiền thực lĩnh cuối tháng.
  - **AC-dltl-07-A (Xử lý chiều trừ và chiều bù)**:
    - *Given*: Nhân viên `NV0004` có khoản tạm ứng lương 1.500.000 ₫ (chiều `tru`) và khoản truy lĩnh lương 800.000 ₫ (chiều `bu`).
    - *When*: Lưu bảng bù trừ.
    - *Then*: Tổng trừ là 1.500.000 ₫, Tổng bù là 800.000 ₫. Tổng bị trừ ròng = $1.500.000 - 800.000 = 700.000$ ₫ (dương -> bị trừ 700.000 ₫ vào thực lĩnh).
  - **AC-dltl-07-B (Trường hợp nhận thêm tiền ròng)**:
    - *Given*: Nhân viên `NV0005` chỉ có khoản bù chênh lệch bảo hiểm 1.200.000 ₫ (chiều `bu`).
    - *When*: Xem tóm tắt bù trừ.
    - *Then*: Tổng bị trừ ròng = -1.200.000 ₫. Chip hiển thị màu xanh lá: "Được nhận thêm: 1.200.000 ₫". Thực lĩnh của nhân viên được cộng thêm 1.200.000 ₫.

---

## 7. Danh mục Edge Cases và Kịch bản Ngoại lệ (Edge Cases Matrix)

| STT | Tình huống ngoại lệ (Edge Case) | Hành vi mong đợi của Hệ thống | Quy tắc bảo vệ |
|---|---|---|---|
| **EC-01** | **Nhân viên vào làm giữa tháng** (Ngày bắt đầu hợp đồng là 15 của tháng 31 ngày). | Bảng chấm công các ngày từ 01 đến 14 hiển thị là ngày chưa vào làm (`null`/nghỉ không tính công). Ngày công chuẩn vẫn tính theo tháng, ngày công thực tế chỉ tính từ ngày 15 trở đi. Tỷ lệ lương theo công tự động giảm tỷ lệ thuận. | Công thức `tyLeCong` tại `bangLuong.ts` |
| **EC-02** | **Nhân viên nghỉ không lương trọn tháng** (`ngayCongThucTe = 0`). | Lương tính theo công bằng 0. Phụ cấp cố định tháng (`co_dinh_thang`) vẫn hưởng nếu hợp đồng còn hiệu lực. Lương chuyên cần nếu có lỗi hoặc vắng thì về 0. Thuế TNCN tính ra 0. Thực lĩnh = các khoản phụ cấp cố định - bảo hiểm (nếu có) - bù trừ. | Tránh chia cho 0 khi `ngayCong = 0` |
| **EC-03** | **Thực lĩnh bị âm** (Do tạm ứng lương vượt quá lương thực tế kiếm được trong tháng). | Hệ thống **giữ nguyên số âm** ở cột `thuc_linh`, TUYỆT ĐỐI KHÔNG ép về 0. Con số âm này là khoản công nợ của nhân viên đối với doanh nghiệp, tự động đưa sang khoản "Thu hồi tạm ứng kỳ trước" (`BT02`) ở kỳ lương kế tiếp. | Khớp phiếu chi kế toán |
| **EC-04** | **Nhân viên chưa được Set lương cá nhân** khi tính toán lương. | Hệ thống tự động fallback về cấu trúc lương khung của công ty (`SalaryStructure` hiện hành). Đảm bảo nhân viên không bị bỏ sót trong bảng tổng hợp lương. | Fallback `mucMacDinh` tại `mock/hooks/bangLuong.ts` |
| **EC-05** | **Hai người dùng cùng thao tác áp dụng bảng tăng ca / thưởng đồng thời** cho cùng một phòng ban. | Sử dụng cơ chế Transaction Isolation (hoặc Versioning/Pessimistic Lock) trên bản ghi nhân viên. Thao tác sau ghi đè có kiểm soát hoặc báo lỗi xung đột phiên bản `E-dltl-026`. | Database Transaction Integrity |
| **EC-06** | **Tải mẫu Excel và nhập lại file chứa mã nhân viên không tồn tại** hoặc đã nghỉ việc. | Tầng Import Excel kiểm tra toàn bộ danh sách `ma_nv`. Nếu có bất kỳ mã nào không hợp lệ, lập tức từ chối toàn bộ file và trả về chi tiết dòng bị lỗi, không thực hiện lưu dở dang (Atomic Rollback). | Toàn vẹn dữ liệu Batch Import |
| **EC-07** | **Đổi đơn giá sản phẩm / tỷ lệ hoa hồng trong Danh mục khi kỳ lương cũ đã chốt**. | Đơn giá và tỷ lệ trong các bảng chi tiết kỳ lương cũ đã được lưu trữ độc lập (Snapshot). Việc sửa danh mục tuyệt đối không ảnh hưởng đến số liệu của các kỳ lương đã lưu hoặc đã khóa sổ. | Nguyên tắc Snapshot Bất biến |
| **EC-08** | **Ngày công chuẩn bằng 0** (do cấu hình sai phương pháp hoặc tháng không có ngày làm việc nào). | Hệ thống chặn ngày công chuẩn $\le 0$. Khi `quyGioChuan = 0`, đơn giá giờ tự động trả về 0 thay vì phát sinh lỗi `NaN` hoặc `Infinity`. | Guard `quyGioChuan > 0` |
| **EC-09** | **Nhân viên có lỗi chuyên cần nhưng không có khoản phụ cấp chuyên cần** trong hợp đồng. | `donGia = 0`, hệ thống tính `tongTru = 0` và `thanhTien = 0`. Không phát sinh trừ âm sang lương. | Chặn sàn `min(tong, donGia)` |
| **EC-10** | **Import file Excel có khoảng trắng thừa và số lẻ tiền đồng**. | Trim toàn bộ chuỗi ký tự mã loại. Số tiền tự động làm tròn về số nguyên gần nhất theo quy tắc kế toán VNĐ (không cho phép số thập phân tiền đồng). | Tự chuẩn hóa dữ liệu đầu vào |

---

## 8. Tiêu chuẩn Bàn giao cho Architect & Tester-QA (Handoff Criteria)

1. **Cho Software Architect**:
   - Kiến trúc Data Model phải đảm bảo 8 bảng chi tiết liên kết chặt chẽ với `PayrollPeriod` và `Employee`.
   - Các trường tiền tệ sử dụng `Int` (VNĐ) hoặc `Decimal(15, 2)` nếu có ngoại tệ. Tỷ lệ sử dụng `Decimal(5, 2)`.
   - Áp dụng triệt để Transaction `$transaction` khi áp dụng hàng loạt (`batch apply`) và khóa sổ kỳ lương.
2. **Cho Tester-QA**:
   - Sử dụng trọn vẹn danh mục mã lỗi `E-dltl-001` đến `E-dltl-026` để thiết kế ma trận kiểm thử tự động (Unit & E2E Test).
   - Kiểm thử kỹ lưỡng 10 kịch bản ngoại lệ (Edge Cases) ở Mục 7, đặc biệt là kịch bản thực lĩnh âm, chặn sàn chuyên cần, và snapshot đơn giá.
