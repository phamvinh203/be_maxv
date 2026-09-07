# Đặc tả Yêu cầu Nghiệp vụ: Phân hệ Bảng Lương & Bộ Tính Toán Lương (Payroll Calculation & Sheet SRS)

> **Mã tài liệu**: `SRS-PAY-001`  
> **Phân hệ**: Bảng lương & Bộ tính toán lương (`payroll`)  
> **Trạng thái**: `revisions` (đang cập nhật theo nền pháp lý 2025–2026)  
> **Tác giả**: Business Analyst  
> **Ngày phê duyệt bản gốc**: 2026-09-06 · **Sửa đổi lần 2**: 2026-09-06 (rà soát pháp lý)  
> **Tài liệu liên quan**: `docs/hr/CONTEXT_SUMMARY.md`, `docs/du_lieu_tinh_luong/CONTEXT_SUMMARY.md`, `Backend/src/hr/payroll/`, [`payroll-gap-analysis.md`](./payroll-gap-analysis.md)  

---

> ## ⚠️ Sửa đổi lần 2 (2026-09-06) — Cập nhật nền pháp lý 2025–2026
>
> Bản gốc của đặc tả này xây trên nền pháp lý có hiệu lực trước 2025. Rà soát ngày 2026-09-06
> cho thấy **8/9 tham số pháp lý cốt lõi đã bị thay thế**. Các mục bị ảnh hưởng đã được cập nhật
> tại chỗ và đánh dấu 🔄; đồng thời bổ sung **`BR-pay-012`** quy định tham số pháp lý phải có
> hiệu lực theo thời gian thay vì cố định trong mã nguồn.
>
> **Điểm cần lưu ý cho người đọc**: riêng năm 2026 có **hai mốc thay đổi** (01/01 và 01/07),
> nên mọi công thức dưới đây phải hiểu là *"tham số tại kỳ lương đang tính"*, không phải một
> con số duy nhất áp cho mọi kỳ.
>
> **Các con số mốc 2026 cần kế toán đối chiếu lại trước khi chạy lương thật** — xem bảng căn cứ
> tại `BR-pay-012` và cột `legalBasis` trong bảng `payroll_legal_parameters`.

---

## 1. Bối cảnh Nghiệp vụ & Mục tiêu Kinh doanh (Business Context & Goals)

### 1.1. Bối cảnh Nghiệp vụ
Phân hệ Tính toán & Quản lý Bảng lương là trái tim của hệ thống quản trị nhân sự và tài chính doanh nghiệp (HRM-Accounting). Sau khi phân hệ **Dữ liệu tính lương (`du_lieu_tinh_luong`)** đã hoàn tất việc thu thập, chuẩn hóa và kiểm soát 8 phân hệ dữ liệu biến động (Chấm công, Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương hoa hồng, Chuyên cần, Ứng/Bù trừ), hệ thống cần một **Động cơ Tính toán Lương (Payroll Calculation Engine)** mạnh mẽ, tuân thủ nghiêm ngặt hệ thống pháp luật lao động và thuế của Việt Nam:
1. **Bộ luật Lao động 2019 (Luật số 45/2019/QH14)**: Quy định về trả lương theo thời gian làm việc, làm thêm giờ ban ngày/ban đêm/ngày nghỉ/ngày lễ, bảo vệ tiền lương của người lao động.
2. **Luật Thuế Thu nhập Cá nhân & Thông tư 111/2013/TT-BTC**: Biểu thuế lũy tiến từng phần 7 bậc cho hợp đồng lao động từ 3 tháng trở lên; khấu trừ 10% tại nguồn đối với hợp đồng thử việc, hợp đồng dịch vụ, lao động thời vụ; các khoản thu nhập được miễn thuế (tiền ăn trưa, tiền làm thêm giờ vượt định mức, trang phục, công tác phí).
3. **Nghị định 73/2024/NĐ-CP & Nghị định 74/2024/NĐ-CP**: Mức lương cơ sở 2.340.000 đồng/tháng (áp trần BHXH, BHYT 20 lần = 46.800.000 đồng) và mức lương tối thiểu vùng Vùng 1 là 4.960.000 đồng/tháng (áp trần BHTN 20 lần = 99.200.000 đồng).
4. **Thông tư 26/2016/TT-BLĐTBXH**: Định mức chi tiền ăn giữa ca được miễn thuế TNCN tối đa 730.000 đồng/người/tháng.
5. **Điều lệ Công đoàn Việt Nam & Nghị định 191/2013/NĐ-CP**: Kinh phí công đoàn 2% do người sử dụng lao động đóng, đoàn phí 1% lương đóng BHXH có trần tối đa 10% lương cơ sở (234.000 đồng).

### 1.2. Mục tiêu Kinh doanh (Business Goals)
- **BG-PAY-01**: Tự động hóa 100% quy trình tính toán tiền lương từ 8 nguồn dữ liệu biến động và dữ liệu nhân sự/cài đặt lương, loại bỏ sai sót thủ công và rút ngắn thời gian chốt lương từ 3-5 ngày xuống dưới 5 phút.
- **BG-PAY-02**: Tuân thủ tuyệt đối quy định pháp luật hiện hành về Thuế TNCN (khấu trừ 10% tại nguồn cho thử việc/dịch vụ, miễn thuế OT dôi dư, khống chế trần ăn trưa 730k) và Bảo hiểm bắt buộc (tách biệt 2 trần 46.8tr BHXH/BHYT và 99.2tr BHTN).
- **BG-PAY-03**: Minh bạch tài chính & Snapshot bất biến đa tầng: Lưu trữ toàn diện từng cấu phần thu nhập/khấu trừ (`payroll_sheet_item_breakdowns`) khi khóa sổ (`LOCKED`), bảo đảm khả năng kiểm toán hồi tố (Audit Trail) không bị thay đổi dù dữ liệu danh mục hay cài đặt lương tương lai có biến động.
- **BG-PAY-04**: Tối ưu hóa trải nghiệm người dùng kế toán & nhân sự với giao diện bảng lương 18 cột chuẩn mực, tích hợp tab bóc tách Lương hỗ trợ động (`luong-ho-tro`), hỗ trợ 3 chế độ hiển thị (Đồng, Nghìn, Triệu) và xuất file Excel đối soát đa chiều.

---

## 2. Các Bên Liên quan (Stakeholders Matrix)

| Bên liên quan | Vai trò chính | Trách nhiệm & Mối quan tâm cốt lõi |
|---|---|---|
| **Chuyên viên C&B (HR Specialist)** | Người vận hành chính | Khởi tạo bảng lương nháp, kiểm tra dữ liệu công, OT, phụ cấp; đối soát tính đúng đắn của từng nhân viên; gửi duyệt sang Kế toán. |
| **Kế toán tiền lương & Kế toán trưởng (Accountant)** | Kiểm soát & Thẩm tra | Rà soát chi phí lương, quỹ bảo hiểm, thuế TNCN tạm tính; thực hiện khóa sổ kỳ lương (`LOCKED`), trình Ban Giám đốc phê duyệt; lập ủy nhiệm chi ngân hàng. |
| **Ban Giám đốc / CFO (Management)** | Phê duyệt cấp cao | Xem báo cáo tổng hợp chi phí lương, quỹ lương, thực lĩnh; phê duyệt (`APPROVED`) để phòng Tài vụ giải ngân (`PAID`). |
| **Nhân viên (Employee)** | Người thụ hưởng | Xem phiếu lương cá nhân (Payslip), kiểm tra chi tiết các khoản lương cơ bản, làm thêm, phụ cấp, thưởng, khấu trừ BHXH, thuế TNCN và thực lĩnh. |
| **Cơ quan Quản lý (Thuế / BHXH)** | Kiểm toán & Thanh tra | Yêu cầu số liệu quyết toán thuế TNCN cuối năm và báo cáo trích nộp bảo hiểm tháng phải khớp 100% với chứng từ và snapshot lịch sử. |

---

## 3. Ma trận Phân tích Phương án & Đánh đổi (Options & Trade-offs Matrix)

Trước khi đi vào chi tiết nghiệp vụ, hệ thống đã cân nhắc 3 phương án kiến trúc cho Bộ tính toán & Lưu trữ bảng lương:

| Tiêu chí so sánh | Phương án 1: Monolithic On-the-fly + Flat Snapshot | Phương án 2: Formula-Engine Plugin (Dynamic DSL / Scripting) | Phương án 3 (ĐƯỢC CHỌN): Pipeline Multi-stage Engine + Granular Sub-item Snapshot |
|---|---|---|---|
| **Mô tả giải pháp** | Tính toàn bộ cột trong 1 hàm lặp duy nhất; khi khóa sổ chỉ lưu dòng tổng (`payroll_sheet_lines` 18 cột). | Dựng bộ phân tích biểu thức (DSL / Mathjs) cho phép người dùng tự viết công thức tính lương trên UI. | Chia bộ tính toán thành 6 pipeline độc lập; khi khóa sổ lưu 2 tầng: dòng tổng (`payroll_sheet_lines`) + chi tiết từng khoản phụ cấp/hỗ trợ (`payroll_sheet_item_breakdowns`). |
| **Tính tuân thủ Pháp luật VN** | 🔴 Kém: Khó xử lý ngoại lệ phức tạp (miễn thuế OT theo giờ chuẩn, trần 730k ăn trưa, tách 2 trần BHXH/BHTN, thuế 10% HĐ thử việc). | 🟡 Trung bình: Đòi hỏi người dùng phải tự viết đúng các công thức thuế/bảo hiểm phức tạp, dễ sai sót. | 🟢 Xuất sắc: Cài đặt sẵn toàn bộ nghiệp vụ chuẩn VN vào các Stage chuyên trách, kiểm soát 100% bằng Unit/Integration tests. |
| **Minh bạch Kiểm toán & Truy vết** | 🔴 Kém: Chỉ có số tổng; không thể biết 5 triệu "Thu nhập khác" gồm những khoản hỗ trợ nào sau 6 tháng. | 🟡 Trung bình: Phụ thuộc vào công thức người dùng định nghĩa tại thời điểm chạy. | 🟢 Tuyệt đối: Snapshot bất biến từng dòng con (`item_breakdown`) lưu rõ mã khoản, tên khoản, số tiền, cờ chịu thuế, cờ bảo hiểm. |
| **Hiệu năng & Độ ổn định** | 🟢 Nhanh (chỉ lưu 1 bảng) nhưng thiếu sót dữ liệu nghiêm trọng. | 🔴 Chậm: Diễn giải biểu thức động (Expression Parsing) tốn CPU, rủi ro DoS, injection code. | 🟢 Cao: Pipeline chạy tuần tự trong bộ nhớ, tối ưu batch insert vào DB qua Prisma `$transaction`. |
| **Khả năng Bảo trì & Mở rộng** | 🔴 Kém: Code phình to hàng nghìn dòng trong một file service, vi phạm Single Responsibility. | 🔴 Rất phức tạp: Cần duy trì parser, AST, sandbox bảo mật, hướng dẫn người dùng viết script. | 🟢 Rất tốt: Mỗi Stage là một hàm/module thuần túy (Pure Function), dễ viết test độc lập và dễ mở rộng chính sách mới. |
| **Kết luận** | **BÁC BỎ** (Đang gây ra các lỗ hổng nghiêm trọng ở phiên bản cũ). | **BÁC BỎ** (Over-engineering, rủi ro an ninh và pháp lý). | **CHẤP THUẬN LỰA CHỌN**: Đạt chuẩn toàn diện về tuân thủ pháp luật, bảo mật và kiểm toán tài chính. |

---

## 4. Danh mục Quy tắc Nghiệp vụ (Business Rules: `BR-pay-001` .. `BR-pay-012`)

### Nhóm 1: Thu nhập từ Công, Phụ cấp Lương & Phúc lợi
- **`BR-pay-001` (Tích hợp Đầy đủ Phụ cấp Lương Cố định & Trợ cấp Phúc lợi)**:
  - Hệ thống BẮT BUỘC thu thập toàn bộ các khoản lương trong `EmployeeSalaryItem` gắn với `EmployeeSalary` còn hiệu lực của nhân viên.
  - Các khoản thuộc danh mục `SalaryItem` loại `FIXED_ALLOWANCE` (như phụ cấp chức vụ, phụ cấp trách nhiệm, phụ cấp độc hại, thâm niên) và các khoản hỗ trợ phúc lợi (ăn trưa, xăng xe, điện thoại, nhà ở) phải được tính vào Thu nhập gộp (Gross Income).
  - **Quy tắc quy đổi theo ngày công**:
    + Khoản có phương thức tính theo ngày công (`CALCULATION_METHOD = WORK_DAYS` hoặc khai báo tính theo công):
      $$\text{tienThucTe} = \text{round}\left(\text{mucThang} \times \min\left(1, \frac{\text{actualWorkDays}}{\text{standardWorkDays}}\right)\right)$$
    + Khoản có phương thức tính cố định theo tháng (`CALCULATION_METHOD = MONTHLY_FIXED`): Nhận trọn 100% mức tháng, không bị trừ khi thiếu ngày công (trừ khi nhân viên không có bất kỳ ngày công làm việc nào trong tháng).
  - 🔄 **Nguồn của `calculationMethod`** là `SalaryStructureItem` của cấu trúc lương đang hiệu lực, **KHÔNG** phải `EmployeeSalaryItem` (model này chỉ lưu số tiền). Khi cấu trúc lương không khai báo, hệ thống suy theo phân loại khoản: `BENEFIT_ALLOWANCE` (phúc lợi) mặc định cố định tháng, `FIXED_ALLOWANCE` mặc định theo ngày công. **Tuyệt đối không suy đoán theo tên khoản.** *(Sửa lỗi `BLK-PAY-04`.)*
  - 🔄 **Loại trừ khoản đại diện lương gốc**: khoản có cờ `SalaryItem.isBaseSalary = true` (mặc định là `KL01 "Lương cơ bản"`) **KHÔNG được cộng** vào tổng phụ cấp, vì lương gốc đã được tính từ `Contract.baseSalary` ở bước lương thời gian. *(Sửa lỗi `BLK-PAY-01`: mã nguồn trước 2026-09-06 cộng cả hai, khiến Thu nhập gộp của mọi nhân viên bị nhân đôi.)* Hệ thống chỉ cho phép **duy nhất một** khoản mang cờ này.
- **`BR-pay-002` (Phân loại Thu nhập Chịu thuế & Đóng BHXH theo Danh mục)**:
  - Mỗi khoản cấu phần thu nhập phải được gắn cờ `isTaxable` (Chịu thuế TNCN) và `isSocialInsurance` (Tính đóng BHXH) từ `SalaryItem` hoặc `SalaryStructureItem` hiện hành.
  - Tuyệt đối không quy đồng mọi khoản phụ cấp đều đóng bảo hiểm. Theo Điều 30 Thông tư 59/2015/TT-BLĐTBXH, các khoản phúc lợi (ăn trưa, xăng xe, điện thoại, nhà ở, nuôi con nhỏ) KHÔNG tính đóng BHXH.

### Nhóm 2: Chính sách Thuế TNCN Chuyên sâu
- **`BR-pay-003` (Định mức Miễn thuế Tiền Ăn trưa / Ăn ca)** 🔄:
  - Trần miễn thuế tra theo kỳ lương (`BR-pay-012`): $730.000$đ đến 14/6/2025 (Thông tư 26/2016/TT-BLĐTBXH); **không có trần luật định** từ 15/6/2025 đến 30/6/2026 (Thông tư 26/2016 bị bãi bỏ bởi Thông tư 003/2025/TT-BNV, chưa có văn bản thay); **1.200.000đ/người/tháng từ 01/7/2026** (điểm g khoản 2 Điều 8 Nghị định 253/2026/NĐ-CP).
  - **Trường hợp làm đủ công**: miễn thuế tối đa bằng trần của kỳ. Phần chi vượt trần tính vào Thu nhập chịu thuế TNCN.
  - **Trường hợp làm thiếu công**: định mức miễn thuế quy đổi theo ngày công thực tế:
    $$\text{hanMucMienThueAnTrua} = \text{round}\left(\text{tranAnCaCuaKy} \times \min\left(1, \frac{\text{actualWorkDays}}{\text{standardWorkDays}}\right)\right)$$
  - **Giai đoạn không có trần**: toàn bộ khoản chi được miễn thuế, không quy đổi theo công.
  - **Nhận diện khoản ăn ca**: bằng cờ `SalaryItem.isMealAllowance`, **KHÔNG** dò theo tên khoản. *(Sửa lỗi `BLK-PAY-04`: bản cũ dò chuỗi "ăn trưa"/"ăn ca" nên khoản thật tên "Phụ cấp tiền cơm" không bao giờ khớp, trần chưa từng được áp.)*
- **`BR-pay-004` (Miễn thuế TNCN Phần Tiền Làm thêm giờ Cao hơn Giờ chuẩn)**:
  - Căn cứ Điểm i Khoản 1 Điều 3 Thông tư 111/2013/TT-BTC: Thu nhập được miễn thuế là phần tiền lương, tiền công trả cao hơn do phải làm việc ban đêm, làm thêm giờ.
  - Đơn giá giờ làm việc chuẩn:
    $$\text{donGiaGioChuan} = \frac{\text{baseSalaryMonthly}}{\text{standardWorkDays} \times \text{standardHoursPerDay}}$$
  - Với mỗi ca làm thêm giờ loại $k$ có số giờ thực tế $h_k$ và hệ số trả lương $r_k$ (ví dụ: ngày thường ban ngày $150\%$, ngày nghỉ $200\%$, ngày lễ ban đêm $390\%$):
    + Tiền làm thêm thực tế: $\text{tienOT}_k = \text{round}(\text{donGiaGioChuan} \times h_k \times \frac{r_k}{100})$
    + Tiền làm theo giờ chuẩn tương ứng: $\text{tienChuan}_k = \text{round}(\text{donGiaGioChuan} \times h_k)$
    + **Phần tiền OT được miễn thuế TNCN**:
      $$\text{tienOTMienThue}_k = \max(0, \text{tienOT}_k - \text{tienChuan}_k)$$
    + Phần tiền OT chịu thuế TNCN: chính bằng $\text{tienChuan}_k$.
- **`BR-pay-005` (Khấu trừ Thuế TNCN 10% tại Nguồn theo Loại Hợp đồng)**:
  - Căn cứ Điểm i Khoản 1 Điều 25 Thông tư 111/2013/TT-BTC:
    1. 🔄 **Hợp đồng Thử việc (`PROBATION`)**, **Hợp đồng Dịch vụ/Thời vụ (`SERVICE_CONTRACT`)**, hoặc Hợp đồng có thời hạn dưới 3 tháng có tổng mức chi trả đạt **ngưỡng khấu trừ của kỳ** (2.000.000đ đến 30/6/2026; **5.000.000đ** từ 01/7/2026 theo Nghị định 253/2026/NĐ-CP) trở lên:
       + Khấu trừ trực tiếp **10% tại nguồn** trên toàn bộ Thu nhập chịu thuế:
         $$\text{thueTNCN} = \text{round}(\text{thuNhapChiuThue} \times 10\%)$$
       + **TUYỆT ĐỐI KHÔNG áp dụng giảm trừ gia cảnh** (không trừ 11 triệu bản thân, không trừ 4.4 triệu/người phụ thuộc).
       + Tuyệt đối không áp dụng biểu thuế lũy tiến 7 bậc.
    2. 🔄 **Hợp đồng Lao động chính thức (`LABOR_CONTRACT` có thời hạn $\ge 3$ tháng)**:
       + Áp dụng giảm trừ gia cảnh đầy đủ theo mức của kỳ: Bản thân + Người phụ thuộc $\times$ số NPT. **Từ kỳ tính thuế 2026: 15.500.000đ + soNPT $\times$ 6.200.000đ** (Nghị quyết 110/2025/UBTVQH15); trước đó là 11.000.000đ + soNPT $\times$ 4.400.000đ.
       + Trừ các khoản trích nộp **bảo hiểm bắt buộc** của người lao động.
       + **KHÔNG trừ đoàn phí công đoàn** khỏi thu nhập tính thuế — khoản này không thuộc danh mục được giảm trừ. *(Sửa lỗi `BLK-PAY-06`: mã nguồn trước 2026-09-06 có trừ, gây khấu trừ thiếu thuế.)*
       + Tính thuế theo Biểu thuế lũy tiến từng phần **của kỳ**: 7 bậc đến hết kỳ tính thuế 2025; **5 bậc từ kỳ tính thuế 2026** (Điều 9 Luật Thuế thu nhập cá nhân 109/2025/QH15).

  - **Biểu thuế 5 bậc áp dụng từ kỳ tính thuế 2026**:

    | Bậc | Thu nhập tính thuế/tháng | Thuế suất |
    |:---:|---|:---:|
    | 1 | đến 10 triệu | 5% |
    | 2 | trên 10 đến 30 triệu | 10% |
    | 3 | trên 30 đến 60 triệu | 20% |
    | 4 | trên 60 đến 100 triệu | 30% |
    | 5 | trên 100 triệu | 35% |

    Hệ thống tính thuế bằng cách **cộng dồn theo từng bậc**, không dùng "bảng tính nhanh" (thu nhập $\times$ thuế suất $-$ hằng số trừ nhanh). Lý do: các hằng số trừ nhanh chỉ đúng cho đúng một biểu thuế, nên khi biểu đổi từ 7 sang 5 bậc thì toàn bộ hằng số cũ sai một cách âm thầm.

### Nhóm 3: Đóng Bảo hiểm & Kinh phí Công đoàn
- **`BR-pay-006` (Tách biệt và Áp 2 Trần Đóng Bảo hiểm Bắt buộc)** 🔄:
  - Hệ thống BẮT BUỘC áp dụng 2 trần bảo hiểm **độc lập**, mỗi trần tra theo kỳ lương (`BR-pay-012`).
  - **Giá trị hiện hành**: trần BHXH/BHYT $= \mathbf{50.600.000}$đ từ 01/7/2026 (20 lần mức tham chiếu 2.530.000 — Nghị định 161/2026/NĐ-CP); trần BHTN $= \mathbf{106.200.000}$đ từ 01/01/2026 (20 lần lương tối thiểu Vùng I 5.310.000 — Nghị định 293/2025/NĐ-CP).
  - Công thức bên dưới giữ nguyên cấu trúc; các con số 46.800.000 và 99.200.000 là giá trị của **kỳ trước mốc đổi**, hệ thống vẫn dùng đúng chúng khi tính lại kỳ cũ.
    1. **Trần BHXH & BHYT (nền cũ — Nghị định 73/2024/NĐ-CP)**:
       + Bằng 20 lần mức lương cơ sở = $20 \times 2.340.000 = \mathbf{46.800.000}$ VNĐ.
       + Mức lương tính đóng BHXH, BHYT:
         $$\text{luongDongBHXH\_BHYT} = \min(\text{insuranceSalaryBase}, 46.800.000)$$
       + Tiền người lao động đóng: BHXH ($8\%$) + BHYT ($1.5\%$) = $9.5\% \times \text{luongDongBHXH\_BHYT}$.
       + Tiền doanh nghiệp đóng: BHXH ($17.5\%$) + BHYT ($3.0\%$) = $20.5\% \times \text{luongDongBHXH\_BHYT}$.
    2. **Trần BHTN (theo Nghị định 74/2024/NĐ-CP)**:
       + Bằng 20 lần mức lương tối thiểu vùng (Vùng 1) = $20 \times 4.960.000 = \mathbf{99.200.000}$ VNĐ.
       + Mức lương tính đóng BHTN:
         $$\text{luongDongBHTN} = \min(\text{insuranceSalaryBase}, 99.200.000)$$
       + Tiền người lao động đóng: BHTN ($1.0\%$) = $1.0\% \times \text{luongDongBHTN}$.
       + Tiền doanh nghiệp đóng: BHTN ($1.0\%$) = $1.0\% \times \text{luongDongBHTN}$.
  - Tổng bảo hiểm người lao động đóng:
    $$\text{employeeInsuranceDeduction} = \text{round}(\text{luongDongBHXH\_BHYT} \times 9.5\%) + \text{round}(\text{luongDongBHTN} \times 1.0\%)$$
  - Tổng bảo hiểm doanh nghiệp gánh chịu:
    $$\text{companyInsuranceExpense} = \text{round}(\text{luongDongBHXH\_BHYT} \times 20.5\%) + \text{round}(\text{luongDongBHTN} \times 1.0\%)$$
- **`BR-pay-007` (Kinh phí Công đoàn & Đoàn phí)**:
  - 🔄 **Đoàn phí Công đoàn (Người lao động)**: Căn cứ **Quyết định 61/QĐ-TLĐ ngày 29/7/2025** (thay Quyết định 1908/QĐ-TLĐ qua Quyết định 1408/QĐ-TLĐ):
    + Chỉ thu khi hợp đồng có cờ `hasUnionFee = true`.
    + Tỷ lệ thu: **$0,5\%$ từ 01/7/2025** (trước đó $1\%$) lương đóng bảo hiểm.
    + Trần tối đa: Bằng $10\%$ mức lương cơ sở/tham chiếu — $234.000$đ đến 30/6/2026, **$\mathbf{253.000}$đ từ 01/7/2026**.
    $$\text{employeeUnionFee} = \min(\text{round}(\text{luongDongBHXH\_BHYT} \times \text{tyLeDoanPhi}), \text{tranDoanPhi})$$
    + Công đoàn cơ sở được nghị quyết thu cao hơn $0,5\%$; nếu hệ thống phục vụ nhiều doanh nghiệp thì tỷ lệ nên cấu hình theo đơn vị.
  - **Kinh phí Công đoàn (Doanh nghiệp)**: Căn cứ Nghị định 191/2013/NĐ-CP:
    + Doanh nghiệp bắt buộc đóng $2\%$ trên toàn bộ quỹ tiền lương làm căn cứ đóng BHXH cho người lao động, không phụ thuộc vào việc nhân viên có tham gia công đoàn hay không.
    $$\text{companyUnionExpense} = \text{round}(\text{luongDongBHXH\_BHYT} \times 2\%)$$

### Nhóm 4: Bù trừ, Thực lĩnh & Kiểm soát Tài chính
- **`BR-pay-008` (Bất biến Công nợ Thực lĩnh Âm - Net Negative Tolerance)**:
  - Lương thực lĩnh:
    $$\text{thucLinh} = \text{grossIncome} - \text{employeeInsuranceDeduction} - \text{employeeUnionFee} - \text{personalIncomeTax} - \text{adjustmentNetAmount}$$
  - Trong đó: $\text{adjustmentNetAmount} = \sum \text{KhoanTru} - \sum \text{KhoanBu}$.
  - Khi khoản tạm ứng hoặc khấu trừ lớn hơn thu nhập sau thuế, $\text{thucLinh}$ ĐƯỢC PHÉP NHẬN GIÁ TRỊ ÂM ($< 0$). Tuyệt đối không kẹp (clamp) về 0. Giá trị âm phản ánh chính xác công nợ nhân viên còn thiếu nợ doanh nghiệp để chuyển sang truy thu ở kỳ kế tiếp (`EC-pay-002`).
- **`BR-pay-009` (Bất biến Chặn sàn Chuyên cần)**:
  - Mức phạt chuyên cần tối đa bị trừ trong tháng không được vượt quá mức trợ cấp chuyên cần được hưởng:
    $$\text{tongTruChuyenCan} = \min\left(\sum \text{phatLoi}, \text{mucChuyenCanHuong}\right)$$
  - Lương chuyên cần nhận được $\ge 0$, tuyệt đối không trừ lấn sang lương cơ bản hay lương ngày công.

### Nhóm 6: Tham số Pháp lý theo Hiệu lực Thời gian

- **`BR-pay-012` (Tham số Pháp lý phải Tra theo Kỳ lương, không Cố định trong Mã nguồn)** 🔄 *(mới, 2026-09-06)*:
  - Toàn bộ tham số do pháp luật quy định (giảm trừ gia cảnh, trần đóng bảo hiểm, biểu thuế, trần miễn thuế ăn ca, ngưỡng khấu trừ tại nguồn, tỷ lệ đoàn phí) **BẮT BUỘC** lưu trong bảng có hiệu lực thời gian (`payroll_legal_parameters`, `payroll_tax_brackets`) kèm căn cứ pháp lý.
  - Động cơ tính lương phải tra tham số theo **ngày cuối của kỳ lương** (`PayrollPeriod.endDate`), **TUYỆT ĐỐI KHÔNG** theo ngày hệ thống.
  - **Lý do bắt buộc**: riêng năm 2026 có 2 mốc thay đổi (01/01 và 01/07). Nếu chỉ lưu một giá trị duy nhất thì việc tính lại kỳ 03/2026 sau ngày 01/07/2026 sẽ cho kết quả khác bảng lương đã phát hành, phá vỡ cam kết kiểm toán `BG-PAY-03`.
  - Mỗi bản ghi tham số phải có `legalBasis` (số hiệu văn bản) để giải trình khi thanh tra thuế/BHXH.

#### Bảng tham số pháp lý theo mốc hiệu lực

| Tham số | Đến 30/6/2025 | 01/7/2025 – 31/12/2025 | 01/01/2026 – 30/6/2026 | Từ 01/7/2026 | Căn cứ mốc mới nhất |
|---|---|---|---|---|---|
| Giảm trừ bản thân | 11.000.000 | 11.000.000 | **15.500.000** | 15.500.000 | Nghị quyết 110/2025/UBTVQH15 |
| Giảm trừ người phụ thuộc | 4.400.000 | 4.400.000 | **6.200.000** | 6.200.000 | Nghị quyết 110/2025/UBTVQH15 |
| Biểu thuế lũy tiến | 7 bậc | 7 bậc | **5 bậc** | 5 bậc | Điều 9 Luật 109/2025/QH15 |
| Trần BHXH/BHYT | 46.800.000 | 46.800.000 | 46.800.000 | **50.600.000** | Nghị định 161/2026/NĐ-CP |
| Trần BHTN (Vùng I) | 99.200.000 | 99.200.000 | **106.200.000** | 106.200.000 | Nghị định 293/2025/NĐ-CP |
| Đoàn phí NLĐ | 1% | **0,5%** | 0,5% | 0,5% | Quyết định 61/QĐ-TLĐ |
| Trần đoàn phí NLĐ | 234.000 | 234.000 | 234.000 | **253.000** | 10% mức tham chiếu 2.530.000 |
| Trần miễn thuế ăn ca | 730.000 | **không có trần luật định** | không có trần luật định | **1.200.000** | Điều 8 Nghị định 253/2026/NĐ-CP |
| Ngưỡng khấu trừ 10% | 2.000.000 | 2.000.000 | 2.000.000 | **5.000.000** | Nghị định 253/2026/NĐ-CP |
| Tỷ lệ BH (NLĐ / DN) | 10,5% / 21,5% | 10,5% / 21,5% | 10,5% / 21,5% | 10,5% / 21,5% | Không đổi — Luật BHXH 2024 |

> **Ghi chú giai đoạn 15/6/2025 – 30/6/2026**: Thông tư 26/2016/TT-BLĐTBXH bị bãi bỏ bởi Thông tư 003/2025/TT-BNV mà chưa có văn bản thay thế, nên không tồn tại trần miễn thuế ăn ca luật định. Hệ thống quy ước giá trị `-1` cho trạng thái này và miễn toàn bộ khoản chi.
>
> **Ngoại lệ về hình thức chi**: trần ăn ca chỉ áp khi doanh nghiệp **chi bằng tiền mặt** vào lương. Nếu doanh nghiệp **tổ chức bữa ăn trực tiếp** (tự nấu, mua suất ăn, phát phiếu ăn) thì toàn bộ giá trị được miễn thuế, không áp trần. Hệ thống hiện **chưa phân biệt** hai hình thức này — xem `payroll-gap-analysis.md`.

### Nhóm 5: Snapshot Bất biến & Khóa sổ Kỳ lương
- **`BR-pay-010` (Snapshot Bất biến Đa tầng khi LOCKED)**:
  - Khi kỳ lương chuyển sang trạng thái `LOCKED`, hệ thống phải thực hiện ghi nguyên tử (`$transaction`):
    1. Snapshot tổng hợp cấp nhân viên vào bảng `payroll_sheet_lines`.
    2. Snapshot chi tiết toàn bộ các cấu phần thu nhập/khấu trừ vào bảng `payroll_sheet_item_breakdowns` (mã khoản, tên khoản, phân loại category, số tiền cấu hình, số tiền thực nhận, tiền chịu thuế, tiền đóng BHXH, căn cứ tính).
  - Sau khi `LOCKED`, mọi tác vụ sửa đổi dữ liệu nguồn tại 8 phân hệ Dữ liệu tính lương và Cài đặt lương đều bị chặn triệt để (`E-dltl-001`).
- **`BR-pay-011` (Bảo mật Reopen Kỳ lương có Kiểm toán)**:
  - Chỉ duy nhất người dùng có vai trò `ADMIN` mới được phép mở khóa (`REOPEN`) kỳ lương từ `LOCKED` về `DRAFT`.
  - Bắt buộc phải cung cấp lý do mở khóa với độ dài tối thiểu 20 ký tự.
  - Hệ thống tự động ghi nhật ký kiểm toán với sự kiện `PAYROLL_PERIOD_REOPENED` và xóa bỏ toàn bộ snapshot cũ để sẵn sàng đối soát, tính toán lại.

---

## 5. Danh mục User Stories & Tiêu chí Nghiệm thu Gherkin

### US-PAY-01: Tính toán Bảng lương Tích hợp Đầy đủ Phụ cấp Lương & Phúc lợi
* **Là**: Chuyên viên C&B (HR Specialist),
* **Tôi muốn**: Hệ thống tự động lấy toàn bộ các khoản lương cơ bản, phụ cấp lương cố định và trợ cấp phúc lợi từ Cài đặt lương của nhân viên để tính toán Gross Income,
* **Để**: Người lao động được chi trả đầy đủ các quyền lợi đã cam kết trong hợp đồng mà không bị thất thoát khoản nào.

```gherkin
Scenario: Tính lương nhân viên có đầy đủ phụ cấp lương và hỗ trợ phúc lợi
  Given Nhân viên "NV001" có lương cơ bản 15.000.000đ, phụ cấp trách nhiệm 2.000.000đ (tính theo công)
  And Nhân viên có phụ cấp ăn trưa 1.000.000đ (tính theo công) và hỗ trợ điện thoại 500.000đ (cố định tháng)
  And Kỳ lương tháng có 26 ngày công chuẩn, nhân viên đi làm thực tế 26 ngày
  When Chuyên viên C&B bấm "Tính toán bảng lương"
  Then Thu nhập lương thời gian được tính là 15.000.000đ
  And Phụ cấp trách nhiệm thực nhận là 2.000.000đ
  And Phụ cấp ăn trưa thực nhận là 1.000.000đ
  And Hỗ trợ điện thoại thực nhận là 500.000đ
  And Tổng thu nhập gộp (Gross Income) ghi nhận đầy đủ các khoản trên cộng với các khoản biến động khác

Scenario: Nhân viên đi làm thiếu công bị quy đổi phụ cấp tính theo công
  Given Nhân viên "NV002" có phụ cấp trách nhiệm 2.600.000đ (tính theo công)
  And Hỗ trợ điện thoại 500.000đ (cố định tháng)
  And Kỳ lương chuẩn 26 ngày công, nhân viên chỉ đi làm thực tế 13 ngày (50% công)
  When Chuyên viên C&B bấm "Tính toán bảng lương"
  Then Phụ cấp trách nhiệm thực nhận bị cắt theo tỷ lệ công còn 1.300.000đ
  And Hỗ trợ điện thoại cố định tháng vẫn giữ nguyên trọn vẹn 500.000đ
```

---

### US-PAY-02: Phân loại Hợp đồng & Khấu trừ Thuế TNCN 10% tại Nguồn
* **Là**: Kế toán tiền lương (Accountant),
* **Tôi muốn**: Hệ thống tự động nhận diện hợp đồng Thử việc (`PROBATION`) hoặc Hợp đồng Dịch vụ (`SERVICE_CONTRACT`) để khấu trừ thuế TNCN 10% tại nguồn mà không trừ gia cảnh,
* **Để**: Tuân thủ Điều 25 Thông tư 111/2013/TT-BTC và tránh bị truy thu thuế khi thanh tra.

```gherkin
Scenario: Nhân viên ký Hợp đồng Thử việc có thu nhập trên 2 triệu đồng
  Given Nhân viên "NV003" có hợp đồng loại "PROBATION" (Thử việc)
  And Có đăng ký 1 người phụ thuộc trong hồ sơ nhân sự
  And Thu nhập chịu thuế trong kỳ tính ra là 10.000.000đ
  When Hệ thống tính thuế Thu nhập cá nhân
  Then Hệ thống KHÔNG áp dụng giảm trừ gia cảnh bản thân 11.000.000đ
  And Hệ thống KHÔNG áp dụng giảm trừ người phụ thuộc 4.400.000đ
  And Thuế TNCN khấu trừ tại nguồn là 10.000.000đ * 10% = 1.000.000đ

Scenario: Nhân viên ký Hợp đồng Lao động chính thức có đăng ký người phụ thuộc (kỳ tính thuế 2026)
  Given Nhân viên "NV004" có hợp đồng loại "LABOR_CONTRACT" thời hạn 1 năm
  And Đăng ký 1 người phụ thuộc, đóng bảo hiểm người lao động 1.050.000đ
  And Tổng thu nhập chịu thuế là 40.000.000đ
  When Hệ thống tính thuế Thu nhập cá nhân cho kỳ lương thuộc năm 2026
  Then Tổng mức giảm trừ gia cảnh là 15.500.000đ + 6.200.000đ = 21.700.000đ
  And Hệ thống KHÔNG trừ đoàn phí công đoàn khỏi thu nhập tính thuế
  And Thu nhập tính thuế = 40.000.000đ - 1.050.000đ - 21.700.000đ = 17.250.000đ
  And Thuế TNCN theo biểu 5 bậc = 10.000.000đ * 5% + 7.250.000đ * 10% = 1.225.000đ

Scenario: Cùng nhân viên đó ở kỳ lương năm 2025 phải dùng nền pháp lý cũ
  Given Nhân viên "NV004" có cùng thu nhập chịu thuế 40.000.000đ và 1 người phụ thuộc
  And Đóng bảo hiểm người lao động 1.050.000đ
  When Hệ thống tính lại kỳ lương tháng 08/2025
  Then Tổng mức giảm trừ gia cảnh là 11.000.000đ + 4.400.000đ = 15.400.000đ
  And Thu nhập tính thuế = 40.000.000đ - 1.050.000đ - 15.400.000đ = 23.550.000đ
  And Thuế TNCN theo biểu 7 bậc = 250.000 + 500.000 + 1.200.000 + 1.110.000 = 3.060.000đ
  And Kết quả này KHÔNG đổi dù được tính lại sau khi luật 2026 có hiệu lực
```

---

### US-PAY-03: Miễn thuế TNCN Phần Tiền Làm Thêm Giờ (OT) Vượt Chuẩn
* **Là**: Chuyên viên C&B,
* **Tôi muốn**: Phần tiền lương làm thêm giờ cao hơn mức lương ngày làm việc bình thường được tự động bóc tách để miễn thuế TNCN,
* **Để**: Bảo đảm quyền lợi tối đa cho người lao động theo đúng Điều 3 Thông tư 111/2013/TT-BTC.

```gherkin
Scenario: Miễn thuế phần tiền làm thêm giờ ngày nghỉ cuối tuần (200%)
  Given Nhân viên "NV005" có đơn giá giờ làm việc chuẩn là 100.000đ/giờ
  And Trong kỳ có 10 giờ làm thêm ngày Chủ nhật với hệ số 200%
  When Hệ thống tính tiền OT và thuế TNCN
  Then Tiền làm thêm giờ nhận được là 10 * 100.000đ * 200% = 2.000.000đ
  And Tiền làm thêm giờ theo giờ chuẩn là 10 * 100.000đ = 1.000.000đ
  And Phần tiền làm thêm giờ được MIỄN THUẾ TNCN là 2.000.000đ - 1.000.000đ = 1.000.000đ
  And Chỉ có 1.000.000đ được đưa vào Thu nhập chịu thuế TNCN
```

---

### US-PAY-04: Tách biệt và Áp dụng 2 Trần Bảo hiểm Bắt buộc
* **Là**: Kế toán tiền lương,
* **Tôi muốn**: Mức lương đóng bảo hiểm được kẹp trần 46.800.000đ cho BHXH/BHYT và 99.200.000đ cho BHTN,
* **Để**: Doanh nghiệp và người lao động không bị trích nộp thừa quỹ bảo hiểm trái quy định của NĐ 73/2024 và NĐ 74/2024.

```gherkin
Scenario: Nhân viên có lương đóng bảo hiểm vượt cả 2 trần (Lương 120 triệu đồng)
  Given Nhân viên "NV006" là chuyên gia cấp cao có lương căn cứ đóng bảo hiểm là 120.000.000đ
  When Hệ thống tính các khoản bảo hiểm bắt buộc
  Then Mức lương đóng BHXH và BHYT bị kẹp trần ở mức 46.800.000đ
  And Tiền BHXH (8%) người lao động đóng là 46.800.000đ * 8% = 3.744.000đ
  And Tiền BHYT (1.5%) người lao động đóng là 46.800.000đ * 1.5% = 702.000đ
  And Mức lương đóng BHTN bị kẹp trần ở mức 99.200.000đ
  And Tiền BHTN (1%) người lao động đóng là 99.200.000đ * 1% = 992.000đ
  And Tổng tiền bảo hiểm người lao động đóng là 3.744.000 + 702.000 + 992.000 = 5.438.000đ (thay vì tính trên 120 triệu)
```

---

### US-PAY-05: Khống chế Hạn mức Miễn thuế Ăn trưa 730.000đ/tháng
* **Là**: Kế toán thuế,
* **Tôi muốn**: Phụ cấp ăn trưa bằng tiền mặt chỉ được miễn thuế tối đa 730.000đ/tháng và được prorated theo ngày công thực tế,
* **Để**: Tuân thủ Thông tư 26/2016/TT-BLĐTBXH, phần vượt định mức được tính thuế chính xác.

```gherkin
Scenario: Phụ cấp ăn trưa vượt trần khi đi làm đủ công (kỳ lương từ 01/7/2026)
  Given Nhân viên "NV007" nhận phụ cấp ăn trưa 1.500.000đ/tháng chi bằng tiền mặt
  And Khoản này được đánh dấu là khoản ăn ca trong danh mục lương
  And Nhân viên đi làm đủ 26/26 ngày công chuẩn
  When Hệ thống tính thu nhập chịu thuế TNCN
  Then Trần miễn thuế của kỳ là 1.200.000đ
  And Phần tiền ăn trưa được miễn thuế là 1.200.000đ
  And Phần tiền ăn trưa chịu thuế TNCN là 1.500.000đ - 1.200.000đ = 300.000đ

Scenario: Phụ cấp ăn trưa vượt định mức khi đi làm thiếu công (kỳ lương từ 01/7/2026)
  Given Nhân viên "NV008" nhận phụ cấp ăn trưa 1.300.000đ/tháng (tính theo công)
  And Nhân viên chỉ đi làm 13/26 ngày công (50% công)
  When Hệ thống tính thu nhập chịu thuế TNCN
  Then Tiền ăn trưa thực tế chi trả là 1.300.000đ * 50% = 650.000đ
  And Hạn mức miễn thuế ăn trưa theo công là 1.200.000đ * 50% = 600.000đ
  And Phần tiền ăn trưa được miễn thuế là 600.000đ
  And Phần tiền ăn trưa phải chịu thuế TNCN là 650.000đ - 600.000đ = 50.000đ

Scenario: Kỳ lương trong giai đoạn không có trần luật định (15/6/2025 - 30/6/2026)
  Given Nhân viên "NV009" nhận phụ cấp ăn trưa 1.500.000đ/tháng
  And Kỳ lương đang tính là tháng 03/2026
  When Hệ thống tính thu nhập chịu thuế TNCN
  Then Hệ thống không áp trần vì Thông tư 26/2016 đã bị bãi bỏ và chưa có văn bản thay thế
  And Toàn bộ 1.500.000đ được miễn thuế TNCN
```

---

### US-PAY-06: Khóa sổ Kỳ lương & Lưu trữ Snapshot Chi tiết Đa tầng
* **Là**: Kế toán trưởng (Chief Accountant),
* **Tôi muốn**: Khi khóa sổ kỳ lương (`LOCKED`), hệ thống đóng băng toàn bộ dữ liệu và lưu lại snapshot chi tiết từng dòng con thu nhập/khấu trừ,
* **Để**: Dữ liệu lương của kỳ được bảo toàn vĩnh viễn, phục vụ công tác thanh tra thuế và giải trình kiểm toán sau này.

```gherkin
Scenario: Khóa sổ kỳ lương thành công và tạo snapshot bất biến đa tầng
  Given Kỳ lương "2026-08" đang ở trạng thái "PENDING_REVIEW"
  And Đã có kết quả tính toán bảng lương cho 50 nhân viên
  When Kế toán trưởng thực hiện gọi API khóa sổ "POST /payroll/periods/{id}/lock"
  Then Trạng thái kỳ lương chuyển thành "LOCKED"
  And Hệ thống tạo 50 bản ghi tổng hợp tại bảng "payroll_sheet_lines"
  And Hệ thống tạo toàn bộ các bản ghi chi tiết tại bảng "payroll_sheet_item_breakdowns"
  And Mọi thao tác cập nhật dữ liệu chấm công, OT, danh mục lương cho kỳ "2026-08" đều bị chặn với mã lỗi "E-dltl-001"
```

---

## 6. Ma trận Mã Lỗi Nghiệp vụ Chuẩn hóa (Error Codes Matrix)

| Mã lỗi | HTTP Status | Tiêu đề lỗi (Message Wording) | Nguyên nhân kích hoạt | Hướng xử lý cho người dùng / hệ thống |
|---|:---:|---|---|---|
| **`E-pay-001`** | 400 | `Kỳ lương chưa được tính toán bảng lương` | Gọi hành động khóa sổ (`lock`) hoặc xuất file khi chưa chạy tính lương. | Bấm nút "Tính toán bảng lương" trước khi khóa sổ. |
| **`E-pay-002`** | 400 | `Kỳ lương đã khóa sổ, không thể tính toán lại` | Gọi lệnh tính toán (`/payroll/calculate`) khi kỳ đang ở `LOCKED`, `APPROVED`, `PAID`, `ARCHIVED`. | Bắt buộc Reopen về `DRAFT` nếu muốn tính toán lại. |
| **`E-pay-003`** | 400 | `Cấu hình thiết lập chung không hợp lệ` | Thiếu bản ghi `GeneralSetting` hoặc các tham số lương cơ sở/vùng/tỷ lệ thuế bị âm. | Kiểm tra màn hình Cài đặt chung và khôi phục mặc định nếu cần. |
| **`E-pay-004`** | 404 | `Không tìm thấy dòng bảng lương của nhân viên trong kỳ` | Truy vấn chi tiết dòng lương của nhân viên không tồn tại trong kỳ. | Kiểm tra lại `periodId` và `employeeId`. |
| **`E-pay-005`** | 400 | `Không có nhân viên nào đủ điều kiện tính lương trong kỳ` | Toàn bộ nhân viên trong danh sách đều đã chấm dứt hợp đồng trước kỳ lương (`BR-dltl-002`). | Kiểm tra lại hợp đồng nhân sự và ngày hiệu lực. |
| **`E-pay-006`** | 409 | `Xung đột khóa sổ: Kỳ lương đang được xử lý đồng thời` | Hai kế toán cùng bấm khóa sổ kỳ lương tại một thời điểm. | Áp dụng cơ chế khóa phân tán hoặc transaction lock, thử lại sau vài giây. |
| **`E-pay-007`** | 400 | `Dữ liệu snapshot bảng lương không khớp tổng kiểm tra` | Phát hiện sai lệch tổng giữa bảng dòng lương và bảng breakdown chi tiết khi khóa sổ. | Kích hoạt Rollback transaction, ghi log cảnh báo để dev kiểm tra. |
| **`E-pay-008`** | 403 | `Chỉ Quản trị viên (ADMIN) mới có quyền mở lại kỳ lương` | Người dùng vai trò `HR` hoặc `ACCOUNTANT` cố gắng mở khóa (`reopen`) kỳ lương đã khóa. | Yêu cầu tài khoản `ADMIN` thực hiện kèm lý do $\ge 20$ ký tự. |
| **`E-pay-009`** | 400 | `Lý do mở lại kỳ lương phải có ít nhất 20 ký tự` | Gửi request `POST /reopen` nhưng chuỗi lý do quá ngắn. | Nhập giải trình chi tiết lý do cần mở lại kỳ lương. |
| **`E-pay-010`** | 400 | `Không thể thanh toán kỳ lương chưa được Ban Giám Đốc phê duyệt` | Gọi hành động `markPaid` khi trạng thái kỳ lương chưa phải là `APPROVED`. | Trình Ban Giám Đốc duyệt trước khi xác nhận thanh toán. |

---

## 7. Danh sách Kịch bản Biên & Ngoại lệ (Edge Cases: `EC-pay-001` .. `EC-pay-010`)

- **`EC-pay-001` (Nhân viên vào làm hoặc nghỉ việc giữa kỳ lương)**:
  - *Kịch bản*: Nhân viên bắt đầu làm việc vào ngày 15 của tháng hoặc kết thúc hợp đồng vào ngày 10 của tháng.
  - *Xử lý*: Số ngày công chuẩn vẫn giữ nguyên theo kỳ ($26.0$). Ngày công thực tế tính theo chấm công thực tế. Lương thời gian và các khoản phụ cấp tính theo công được prorated theo tỷ lệ $\frac{\text{actualWorkDays}}{\text{standardWorkDays}}$. Các khoản miễn thuế (ăn trưa 730k) cũng bị giảm trừ tương ứng.
- **`EC-pay-002` (Tiền tạm ứng vượt quá thu nhập - Thực lĩnh âm)**:
  - *Kịch bản*: Nhân viên có Gross Income 10 triệu đồng, nhưng trong tháng đã tạm ứng trước 12 triệu đồng qua phân hệ Bù trừ (`direction = tru`).
  - *Xử lý*: Thực lĩnh $\text{netTakeHomeSalary} = 10.000.000 - \text{BH} - \text{Thuế} - 12.000.000 < 0$. Hệ thống giữ nguyên số âm (ví dụ: $-2.500.000$đ), hiển thị cảnh báo màu đỏ trên giao diện và ghi nhận công nợ để khấu trừ kỳ tiếp theo (`BR-pay-008`).
- **`EC-pay-003` (Lương căn cứ đóng bảo hiểm vượt cả 2 trần)**:
  - *Kịch bản*: Lương đóng bảo hiểm thỏa thuận trong hợp đồng là 120 triệu đồng/tháng.
  - *Xử lý*: BHXH/BHYT kẹp trần 46.800.000đ; BHTN kẹp trần 99.200.000đ. Hệ thống tính trích bảo hiểm chính xác trên 2 mức trần khác nhau, không tính đồng loạt trên 120 triệu (`BR-pay-006`).
- **`EC-pay-004` (Giảm trừ gia cảnh lớn hơn thu nhập chịu thuế)**:
  - *Kịch bản*: Nhân viên có thu nhập chịu thuế 15 triệu đồng nhưng nuôi 2 con nhỏ (giảm trừ gia cảnh $11\text{tr} + 2 \times 4.4\text{tr} = 19.8$ triệu đồng).
  - *Xử lý*: Thu nhập tính thuế âm, hệ thống clamp về 0: $\text{taxableIncome} = \max(0, 15\text{tr} - 19.8\text{tr}) = 0$. Thuế TNCN bằng 0 VNĐ.
- **`EC-pay-005` (Làm thêm giờ ban đêm vào ngày lễ/tết - OT 390%)**:
  - *Kịch bản*: Nhân viên trực ca đêm vào ngày Tết Nguyên Đán với hệ số trả lương 390%. Đơn giá giờ chuẩn 100.000đ/h, làm 8 giờ.
  - *Xử lý*: Tiền OT nhận được $= 8 \times 100.000 \times 3.9 = 3.120.000$đ. Tiền giờ chuẩn $= 800.000$đ. Tiền OT miễn thuế TNCN $= 3.120.000 - 800.000 = 2.320.000$đ. Tiền OT chịu thuế chỉ là $800.000$đ (`BR-pay-004`).
- **`EC-pay-006` (Hợp đồng Thử việc chuyển sang Chính thức giữa tháng)**:
  - *Kịch bản*: Nhân viên hết 2 tháng thử việc vào ngày 15 và ký hợp đồng chính thức từ ngày 16.
  - *Xử lý*: Ưu tiên áp dụng loại hợp đồng có hiệu lực tại ngày cuối cùng của kỳ lương (`take: 1, orderBy: effectiveFrom: desc`). Nếu hợp đồng cuối kỳ là `LABOR_CONTRACT`, toàn bộ kỳ được áp dụng giảm trừ gia cảnh và tính lũy tiến; nếu hợp đồng cuối kỳ vẫn là `PROBATION`, áp dụng khấu trừ 10% tại nguồn.
- **`EC-pay-007` (Không có bất kỳ ngày công làm việc nào trong tháng)**:
  - *Kịch bản*: Nhân viên nghỉ không lương cả tháng (0 công).
  - *Xử lý*: Lương thời gian $= 0$. Toàn bộ phụ cấp tính theo công $= 0$. Phụ cấp cố định tháng $= 0$ (vì không phát sinh công làm việc). Nếu không có thu nhập khác, Gross $= 0$, bảo hiểm và thuế TNCN $= 0$.
- **`EC-pay-008` (Sửa đổi danh mục lương sau khi kỳ lương đã LOCKED)**:
  - *Kịch bản*: Sau khi khóa sổ kỳ lương tháng 8, HR vào Cài đặt lương sửa tên khoản hoặc tăng mức lương cơ bản của nhân viên trong tháng 9.
  - *Xử lý*: Bảng lương tháng 8 được bảo vệ tuyệt đối bởi snapshot `payroll_sheet_lines` và `payroll_sheet_item_breakdowns`. Mọi báo cáo xuất ra của tháng 8 vẫn giữ nguyên 100% dữ liệu lịch sử.
- **`EC-pay-009` (Tròn số tiền VNĐ trong các phép tính tỷ lệ)**:
  - *Kịch bản*: Phép tính phần trăm bảo hiểm, thuế, hoặc giờ OT sinh ra số thập phân (ví dụ: $177.499,6$đ).
  - *Xử lý*: Áp dụng chuẩn làm tròn số tiền tài chính Việt Nam `Math.round()` (tương đương `ROUND_HALF_UP`) về đơn vị 1 đồng nguyên bản.
- **`EC-pay-010` (Trường hợp nhân viên có lương đóng bảo hiểm nhỏ hơn lương tối thiểu vùng)**:
  - *Kịch bản*: Hợp đồng khai lương đóng bảo hiểm thấp hơn mức tối thiểu vùng quy định tại địa bàn.
  - *Xử lý*: Hệ thống đưa ra cảnh báo nghiệp vụ (Warning) cho nhân viên C&B nhưng vẫn cho phép tính theo hợp đồng đã ký kết, đồng thời ghi log kiểm soát tuân thủ.
