---
type: srs
feature: hrm-cai-dat-luong
status: approved
updated: 2026-09-09
author: BA-Agent
links:
  - docs/hrm/srs/hrm-spec.md
  - docs/hrm/architecture/api-contract.md
  - docs/hrm/architecture/data-model.md
  - docs/hrm/CONTEXT_SUMMARY.md
---

# HR — Đặc tả Yêu cầu Nghiệp vụ: Cài đặt lương (Salary Settings Specification)

Quản lý dữ liệu nền tảng và thiết lập lương của phân hệ Quản trị Nhân sự (HRM) trên hệ thống `be_maxv`:
1. **Danh mục khoản lương & phụ cấp** (`danh-muc-khoan`): 7 nhóm danh mục thu nhập, cấu hình đóng BHXH, chịu thuế TNCN, tỷ lệ % mặc định.
2. **Cấu trúc lương khung doanh nghiệp** (`set-luong` - Salary Structure Template): Thời kỳ hiệu lực, tiêu thức tính, căn cứ làm thêm giờ (tăng ca), mức đề xuất mặc định.
3. **Thiết lập lương nhân viên & Phê duyệt** (`set-luong` - Employee Salary Assignment & Governance): Gán mức tiền chi tiết theo khung chuẩn, kiểm tra hợp đồng lao động, kiểm soát phiên bản (`setupVersion`), quy trình phê duyệt (`DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` / `REJECTED`).

Tài liệu được xây dựng trên cơ sở phân tích giao diện Mock tại `hdđt_maxv/src/features/hrm/components/cai_dat_luong`, đối chiếu chuẩn pháp lý lao động - thuế - BHXH Việt Nam, và hiện thực hóa trực tiếp trên backend Fastify + Prisma multi-tenant của `be_maxv`.

---

## 1. Mục tiêu Nghiệp vụ (Business Goals)

1. **Chuẩn hoá danh mục thu nhập & phúc lợi**: Cho phép doanh nghiệp định nghĩa linh hoạt các khoản lương, phụ cấp, trợ cấp, hoa hồng, thưởng và KPI; tách bạch rõ ràng căn cứ pháp lý về **khoản tính đóng BHXH** (theo Thông tư 10/2020/TT-BLĐTBXH) và **khoản chịu thuế TNCN / miễn thuế** (theo Thông tư 111/2013/TT-BTC).
2. **Thiết lập cấu trúc lương khung thống nhất**: Định hình chính sách lương theo từng thời kỳ hiệu lực, xác định tiêu thức tính (cố định, theo ngày công, theo giờ...) và cờ tính làm thêm giờ (tăng ca), tránh việc áp dụng biểu mẫu tùy tiện gây sai lệch bảng tính lương tổng hợp.
3. **Kiểm soát quy trình Set lương & Phê duyệt chặt chẽ (Salary Governance)**: Quản lý mức tiền chi tiết cho từng nhân viên theo khung chuẩn, kiểm tra hợp đồng lao động đang hiệu lực, kiểm soát trạng thái phê duyệt và đếm số phiên bản thiết lập (`setupVersion`) trước khi chốt dữ liệu cho kỳ tính lương (Payroll).

---

## 2. Căn cứ Pháp lý & Tiêu chuẩn Nghiệp vụ Việt Nam

1. **Tiền lương đóng BHXH bắt buộc** *(Khoản 2, 3 Điều 30 Thông tư 59/2015/TT-BLĐTBXH và Điều 3 Thông tư 10/2020/TT-BLĐTBXH)*:
   - **Khoản phải đóng BHXH**: Lương cơ bản theo chức danh/công việc + Phụ cấp lương trả thường xuyên, cố định bù đắp điều kiện lao động (phụ cấp chức vụ, trách nhiệm, thâm niên, độc hại...).
   - **Khoản không đóng BHXH**: Tiền thưởng sáng kiến/thành tích (Điều 104 BLLĐ 2019); tiền ăn giữa ca; tiền xăng xe, điện thoại, đi lại, tiền nhà ở; tiền giữ trẻ, nuôi con nhỏ; hỗ trợ thân nhân/kết hôn/sinh nhật; trợ cấp khó khăn, tai nạn lao động.
2. **Thuế Thu nhập Cá nhân (TNCN)** *(Thông tư 111/2013/TT-BTC, Thông tư 25/2018/TT-BTC)*:
   - **Khoản chịu thuế**: Toàn bộ tiền lương, tiền công và các khoản phụ cấp/trợ cấp (trừ các khoản được miễn theo luật).
   - **Khoản phụ cấp/trợ cấp được MIỄN thuế TNCN trong định mức**:
     - Tiền ăn giữa ca: Tối đa **730.000 VNĐ/tháng** (nếu chi bằng tiền mặt; nếu tổ chức bữa ăn thì miễn toàn bộ).
     - Tiền trang phục: Tối đa 5.000.000 VNĐ/năm nếu chi bằng tiền mặt.
     - Tiền điện thoại, công tác phí, xăng xe: Theo quy chế tài chính nội bộ phục vụ công việc.
3. **Tiền lương làm thêm giờ (Tăng ca - Overtime)** *(Điều 98 Bộ luật Lao động 2019)*:
   - Cờ `isOvertimeBase` (hoặc `tang_ca`) xác định khoản nào được đưa vào đơn giá tiền lương giờ thực trả ngày làm việc bình thường để nhân hệ số tăng ca (150%, 200%, 300%).

---

## 3. Phạm vi Chức năng (Scope)

### 3.1. Danh mục Khoản lương & Phụ cấp (`SalaryItem`)
- Phân nhóm 7 loại danh mục chuẩn:
  1. `LUONG_PHU_CAP_CO_DINH`: Lương/phụ cấp cố định
  2. `LUONG_HO_TRO_PHUC_LOI`: Lương hỗ trợ/phúc lợi
  3. `LUONG_NGHIEM_THU`: Lương nghiệm thu
  4. `LUONG_HOA_HONG`: Lương phần trăm/hoa hồng
  5. `LUONG_KPI`: Lương KPI
  6. `LUONG_THUONG`: Lương thưởng
  7. `LUONG_CHUYEN_CAN`: Lương chuyên cần
- Tự động sinh mã khoản lương dạng `KL01`, `KL02`..`KL99` nếu người dùng không nhập mã.
- Tên khoản không được trùng lặp trong cùng doanh nghiệp/tenant (mã lỗi `E-sal-002`).
- Chặn xóa khoản lương nếu đang được sử dụng trong Cấu trúc lương khung (mã lỗi `E-sal-003`).
- API thống kê số lượng khoản theo từng nhóm (`GET /salary-items/count-by-category`).

### 3.2. Cấu trúc Lương khung (`SalaryStructure` & `SalaryStructureItem`)
- Thiết lập thời gian hiệu lực (`effectiveFrom`, `effectiveTo`), mô tả chính sách.
- Chọn các khoản lương từ danh mục gắn vào khung cấu trúc kèm cấu hình:
  - Phân loại thuế: `TAXABLE` (Chịu thuế), `NON_TAXABLE` (Miễn thuế).
  - Cờ tăng ca: `isOvertimeBase` (Có tính tăng ca).
  - Tiêu thức tính: `FIXED_MONTHLY` (Cố định), `ACTUAL_WORKDAY` (Theo ngày công), `HOURLY` (Theo giờ), `PERFORMANCE` (Theo hiệu suất).
  - Số tiền gợi ý mặc định: `defaultAmount`.
- Kích hoạt / Hủy kích hoạt cấu trúc: Chỉ có 1 cấu trúc ở trạng thái `isActive = true` tại một thời điểm hoặc được ưu tiên áp dụng.

### 3.3. Thiết lập Lương Nhân viên (`EmployeeSalary` & `EmployeeSalaryItem`)
- Lấy danh sách nhân viên kèm trạng thái thiết lập lương (`daSet` / `hasSalary`, `setupVersion`, `status`, `tong_luong`).
- Lọc danh sách theo phòng ban (`ma_pb` / `departmentId`), loại hợp đồng (`contractType`), trạng thái đã set lương (`hasSalary`).
- Kiểm tra điều kiện ràng buộc:
  - Nhân viên phải có Hợp đồng lao động đang còn hiệu lực (`E-sal-009`).
  - Phải có Cấu trúc lương khung đang hoạt động (`E-sal-007`).
  - Các khoản thiết lập cho nhân viên phải nằm trong Cấu trúc lương khung đang hoạt động (`E-sal-010`).
  - Tổng lương thiết lập phải lớn hơn 0 (`E-sal-008`).
- Cơ chế phiên bản & Quy trình duyệt:
  - Khi thiết lập lần đầu: `setupVersion = 1`, `status = PENDING_APPROVAL`.
  - Khi cập nhật chỉnh sửa: `setupVersion = setupVersion + 1` (tăng nguyên tử trong DB — hai người sửa cùng lúc ra hai phiên bản khác nhau), `status` tự động chuyển về `PENDING_APPROVAL` (bất kể trước đó đang là `APPROVED`).
  - Duyệt đơn lẻ (`POST /employee-salaries/:employeeId/approve`).
  - Duyệt hàng loạt (`POST /employee-salaries/approve` nhận `items: [{ employeeId, setupVersion }]` — các bản đang chờ duyệt người duyệt đang xem; bản đã bị sửa sau khi xem không được duyệt theo, xem BR-sal-010).

---

## 4. Bảng Quy tắc Nghiệp vụ (Business Rules) & Mã Lỗi

| Mã Quy tắc | Tên Quy tắc | Mô tả chi tiết | Mã Lỗi Trả về | HTTP Code |
|---|---|---|---|---|
| **BR-sal-001** | Mã khoản tự sinh | Nếu không truyền `code`, tự động sinh mã dạng `KL` + 2 chữ số (`KL01`, `KL02`...) không trùng lặp | - | 201 |
| **BR-sal-002** | Tên khoản không trùng lặp | Tên khoản lương là duy nhất trong cùng tenant (không phân biệt chữ hoa/thường) | `E-sal-002` | 400 |
| **BR-sal-003** | Chặn xóa khoản đang dùng | Khoản lương đã được đưa vào Cấu trúc khung (`SalaryStructureItem`) không được xóa | `E-sal-003` | 400 |
| **BR-sal-004** | Hiệu lực cấu trúc khung | Cấu trúc lương khung phải có ngày bắt đầu, nếu có ngày kết thúc thì `effectiveTo >= effectiveFrom` | `E-sal-004` | 400 |
| **BR-sal-005** | Cấu trúc đang hoạt động | Khi set lương cho nhân sự, hệ thống bắt buộc phải có ít nhất 1 cấu trúc lương `isActive = true` | `E-sal-007` | 400 |
| **BR-sal-006** | Khoản thuộc cấu trúc | Toàn bộ các khoản lương gán cho nhân viên phải thuộc Cấu trúc lương khung đang hoạt động | `E-sal-010` | 400 |
| **BR-sal-007** | Hợp đồng đang hiệu lực | Nhân viên được set lương bắt buộc phải có Hợp đồng lao động còn hiệu lực (`CON_HIEU_LUC`) | `E-sal-009` | 400 |
| **BR-sal-008** | Tổng lương dương | Tổng mức thu nhập sau khi set lương phải > 0 | `E-sal-008` | 400 |
| **BR-sal-009** | Phiên bản & Duyệt lại | Mỗi lần chỉnh sửa mức lương, `setupVersion` tăng 1 và trạng thái chuyển về `PENDING_APPROVAL` | - | 200 |
| **BR-sal-010** | Danh sách duyệt hợp lệ | Khi duyệt hàng loạt, `items` phải có ít nhất 1 phần tử, mỗi phần tử gồm `employeeId` + `setupVersion` đã xem, không trùng nhân viên. Chỉ bản còn đúng phiên bản đó và còn `PENDING_APPROVAL` mới được duyệt (cập nhật 2026-09-11, vbsec LOW #39/#40) | `E-sal-011` | 400 |

---

## 5. Ánh xạ Giao diện UI Mock (`hdđt_maxv`) với Backend `be_maxv`

| Màn hình UI Mock | Thao tác trên giao diện | Backend Endpoint (`be_maxv`) | Input / Params | Output Payload |
|---|---|---|---|---|
| `danh-muc-khoan` | Load danh sách khoản lương | `GET /api/v1/hrm/salary-items` | `category`, `status`, `search` | `{ success: true, data: [...] }` |
| `danh-muc-khoan` | Thống kê theo 7 nhóm | `GET /api/v1/hrm/salary-items/count-by-category` | Không | `{ success: true, data: { LUONG_PHU_CAP_CO_DINH: 2, ... } }` |
| `danh-muc-khoan` | Thêm mới khoản lương | `POST /api/v1/hrm/salary-items` | `code`, `name`, `category`, `hasInsurance`, `isTaxable`, `defaultRate` | `{ success: true, data: SalaryItem }` |
| `danh-muc-khoan` | Cập nhật khoản lương | `PUT /api/v1/hrm/salary-items/:id` | `name`, `category`, `status`, ... | `{ success: true, data: SalaryItem }` |
| `danh-muc-khoan` | Xóa khoản lương | `DELETE /api/v1/hrm/salary-items/:id` | `:id` | `{ success: true, message: ... }` |
| `set-luong` (Tab cấu trúc) | Xem cấu trúc khung | `GET /api/v1/hrm/salary-structures` hoặc `/active` | Không | `{ success: true, data: SalaryStructure }` |
| `set-luong` (Tab cấu trúc) | Lưu cấu trúc khung | `POST /api/v1/hrm/salary-structures` | `name`, `effectiveFrom`, `items: [...]` | `{ success: true, data: SalaryStructure }` |
| `set-luong` (Tab nhân viên) | Danh sách nhân viên & lương | `GET /api/v1/hrm/employee-salaries` | `departmentId`, `contractType`, `hasSalary`, `search` | `{ success: true, data: [{ ma_nv, ho_ten, daSet, tong_luong, ... }] }` |
| `set-luong` (Modal set lương) | Xem chi tiết lương NV | `GET /api/v1/hrm/employee-salaries/:employeeId` | `:employeeId` (e.g. `NV0001`) | `{ success: true, data: { employee, salary, items: [...] } }` |
| `set-luong` (Modal set lương) | Lưu mức lương nhân viên | `POST /api/v1/hrm/employee-salaries/:employeeId` | `items: [{ itemId, amount }]` hoặc `khoan: { [id]: amount }` | `{ success: true, data: EmployeeSalary }` |
| `set-luong` (Duyệt lẻ) | Duyệt lương nhân viên | `POST /api/v1/hrm/employee-salaries/:employeeId/approve` | `:employeeId` | `{ success: true, data: EmployeeSalary }` |
| `set-luong` (Duyệt loạt) | Nút "Duyệt lương": duyệt các bản đang chờ duyệt trong danh sách đang hiển thị | `POST /api/v1/hrm/employee-salaries/approve` | `{ items: [{ employeeId: 'NV0001', setupVersion: 3 }] }` | `{ success: true, data: { approvedCount, skippedCount, message } }` |
