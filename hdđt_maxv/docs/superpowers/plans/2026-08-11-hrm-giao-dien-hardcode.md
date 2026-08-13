# HRM — pha dựng giao diện với dữ liệu hardcode

**Ngày:** 2026-08-11 · **Trạng thái:** đã xong · **Phạm vi:** chỉ `hdđt_maxv`

Bản thiết kế gốc: [`specs/2026-08-11-hrm-danh-muc-nhan-vien-design.md`](../specs/2026-08-11-hrm-danh-muc-nhan-vien-design.md).
Pha này làm **giao diện trước, chưa đụng backend** — `be_maxv` và `prisma/tenant/schema.prisma`
giữ nguyên. Kế hoạch ba lát cắt dọc trong spec vẫn đúng cho phần backend.

## Đã làm

Khu `/hrm` có **bốn tab nổi cấp trên**, CRUD chạy thật trên state trong bộ nhớ (F5 là về bộ
mẫu):

| Tab | Route | Nội dung |
|---|---|---|
| Dashboard | `/hrm/dashboard` | Bốn thẻ số, cảnh báo NV chưa gán phòng ban / chưa có HĐ, phân bổ NV theo phòng ban, hợp đồng hết hạn trong 90 ngày |
| Danh mục quản lý nhân viên | `/hrm/danh-muc/*` | Ba tab con: Phòng ban · Nhân viên · Người phụ thuộc |
| Cấu hình mặc định | `/hrm/cau-hinh/*` | Hai tab con: Thiết lập chung · Lịch ngày lễ |
| Cài đặt lương | `/hrm/cai-dat-luong/*` | Hai tab con: Danh mục lương & phụ cấp · Set lương |
| Dữ liệu tính lương | `/hrm/du-lieu-luong/*` | Tám tab con; mới dựng **Chấm công**, bảy tab kia là chỗ giữ |

Chi tiết ba màn hình danh mục:

- `phong-ban` — bảng cây (thụt lề theo cấp), thêm/sửa/xóa, **Gán nhanh phòng ban**.
- `nhan-vien` — bảng 12 cột, lọc theo từ khóa/phòng ban/trạng thái. Cột Thao tác có **hai**
  lối vào: 👁 **xem chi tiết** (`NhanVienChiTietDialog`, ba mục chỉ đọc: Thông tin nhân viên ·
  Hồ sơ tài liệu · Người phụ thuộc) và ✏ **chỉnh sửa hồ sơ** (`NhanVienDialog`, bốn tab có ô
  nhập, gồm cả Lịch sử hợp đồng).
- `nguoi-phu-thuoc` — màn hình độc lập, dùng chung `NguoiPhuThuocForm` với tab 4.

**Thay đổi hợp đồng** (nút trong nhóm "Thông tin hợp đồng" của màn xem chi tiết) là một thao
tác chạm hai bản ghi: ghi `ngay_ket_thuc` cho hợp đồng hiện hành và tạo hợp đồng mới, trong
**một** action `hopDong/doi`. Tách đôi sẽ để lại lúc hai hợp đồng cùng hiệu lực, lúc không có
hợp đồng nào — và luật `hopDongHienHanh` khi đó trả về cái nào cũng "đúng" như nhau. Service
tương ứng ở backend phải nằm trong một `$transaction`.

**Cấu hình mặc định › Thiết lập chung** giữ một bản nháp tách khỏi bản đã lưu
(`CauHinhPanel`): hơn ba mươi ô số liên quan nhau, lưu ngay từng ô sẽ để hệ thống ở trạng
thái nửa vời trong lúc sửa dở. Riêng **ca làm việc lưu ngay** vì là bản ghi riêng lẻ, không
phải một ô trong bộ tham số.

**Cấu hình mặc định › Lịch ngày lễ** có bộ lọc ba mức (Ngày lễ · Hàng năm · Năm nay), nút
**Tạo nhanh** sinh lịch chuẩn theo Điều 112 BLLĐ 2019 cho một năm, và nút **Thêm ngày lễ**.
Bốn dịp dương lịch tính chính xác cho mọi năm; hai dịp âm lịch (Tết Nguyên đán, Giỗ Tổ Hùng
Vương) tra bảng `ngayLeChuan.ts` — nên "Tạo nhanh" chỉ mở các năm có trong bảng (2024–2030),
và **ngày âm lịch cần đối chiếu lại trước khi dùng thật**. Khi nối backend thì thay bảng tra
này bằng bộ quy đổi âm lịch thật. Tạo nhanh bỏ qua ngày đã có (cùng ngày + cùng tên) thay vì
từ chối cả lượt.

**Cài đặt lương** dùng một dialog chung cho cả bảy loại khoản, đọc bảng mô tả
`LOAI_KHOAN_LUONG` trong `constants.ts`. Thêm loại thứ tám chỉ phải thêm một dòng ở bảng đó.

**Cài đặt lương › Set lương** gồm ba khối: thanh nút (5 nút), **Thời gian hiệu lực** +
**Cấu trúc lương** (bản nháp, lưu bằng nút "Lưu cấu trúc lương"), và danh sách nhân viên lọc
theo Đã set / Chưa set. Mỗi dòng cấu trúc **trỏ về một khoản trong danh mục** chứ không cho
gõ tên tự do — nếu không, hai tab của cùng một khu sẽ có hai danh sách khoản khác nhau. Số
tiền thì từng nhân viên một mức (`setLuong[].khoan`), điền sẵn theo mức mặc định của cấu
trúc. Lưu lại bất kỳ bản set lương nào cũng đưa trạng thái về **Chờ duyệt**, kể cả khi trước
đó đã duyệt — để lọt một thay đổi chưa ai xem qua vào kỳ lương là lỗi đắt nhất ở màn này.

**Dữ liệu tính lương › Chấm công** là lưới: dòng là nhân viên đang làm, cột là từng ngày của
tháng hiện tại, rồi Ngày công chuẩn · Ngày công thực tế · Công tác · Nghỉ phép · Ốm · Không
lương · Khác.

Bấm một ô mở `OChamCongPopover` neo ngay tại ô đó: tám loại công (`LOAI_CONG`) bấm được bằng
**phím 1–8**, kèm ô "Nhập số giờ làm cụ thể" giới hạn theo giờ công chuẩn/ngày. Nhập số giờ
thì công quy đổi bằng `soGio / gioCongChuanNgay` bất kể loại đang chọn — làm 4/8 giờ là nửa
công. Chỉ hai loại `lam_viec` và `nua_ngay` mới cộng vào "Ngày công thực tế"; năm loại còn
lại đếm sang cột riêng của chúng.

Kho **chỉ lưu những ô người dùng đã đụng vào**
(`chamCong: Record<'maNv|YYYY-MM-DD', OChamCong | null>`); khóa vắng mặt đọc theo lịch chuẩn,
còn giá trị `null` là ô bị **xóa trắng có chủ ý** — hai trạng thái khác nhau. Nhờ vậy không
phải sinh sẵn hàng nghìn bản ghi mỗi tháng, và đổi chính sách thứ 7 / chủ nhật hay lịch ngày
lễ bên tab Cấu hình mặc định thì cả bảng cập nhật theo.

## Sai lệch có chủ ý so với spec

- **Không làm màn hình `/hrm/chuc-vu`.** Chức vụ là hằng số `CHUC_VU` trong `constants.ts`.
  Khi nối backend thì nó thành danh mục `hrm_chuc_vu`; mã `CV..` giữ nguyên nên dữ liệu
  nhân viên không phải sửa.
- **Không tạo `hooks/useTableFilter.ts`.** Các bảng lọc khác nhau đủ nhiều (cây / ba bộ lọc /
  một ô tìm) nên rút hook chung lúc này là thiết kế cho tương lai chưa biết hình thù.
- **Bảng người phụ thuộc có thêm cột "Thao tác"** — spec liệt kê tám cột, thiếu cột này thì
  không có đường nào sửa hoặc xóa một bản ghi.

## Chỗ tự quyết vì mô tả để trống — cần chốt lại

Yêu cầu liệt kê bảy loại khoản lương nhưng chỉ ghi rõ nội dung dialog cho ba loại đầu. Bốn
loại còn lại (phần trăm, KPI, thưởng, chuyên cần) hiện dùng **khuôn chung**: Tên khoản · Ghi
chú · tích "Tính vào lương đóng BHXH" · tích "Chịu thuế TNCN". Riêng **lương phần trăm** có
thêm ô **Tỷ lệ mặc định (%)** — một khoản tính theo phần trăm mà không có chỗ nhập phần trăm
thì không dùng được.

Hai điểm nhỏ khác:

- Ô tên của **lương nghiệm thu** ghi "Tên khoản lương nghiệm thu", không phải "Tên khoản
  lương phụ cấp" như trong mô tả — nhãn "phụ cấp" nằm trong dialog "Lương nghiệm thu" đọc
  như một lỗi.
- **Dashboard** chưa được mô tả nội dung nên dựng bản tổng quan tối thiểu từ chính bộ dữ liệu
  mẫu. Cần thêm biểu đồ hay chỉ số nào thì bổ sung sau.
- Dòng **"Ngày lễ, hàng năm, Năm nay"** ở màn Lịch ngày lễ được hiểu là **ba mức lọc** và
  dựng thành `ToggleButtonGroup` (mặc định "Năm nay"). Nếu ý là tiêu đề kèm ô chọn năm thì
  đổi lại.
- **Dialog "Thay đổi hợp đồng"** có thêm hai ô **Lương chính** và **Lương đóng BHXH** ngoài
  danh sách trường được nêu, điền sẵn theo hợp đồng cũ. Bỏ đi thì hợp đồng mới lưu với mức
  lương 0 đ mà không chỗ nào báo — cột lương ở tab Lịch sử hợp đồng sẽ hiện 0.
- **Danh mục khoản lương đã thay bằng 17 khoản** đúng như danh sách nêu ở màn Set lương. Bộ
  10 khoản mẫu cũ bị bỏ: hai tab của cùng một khu mà mỗi tab một danh sách khoản thì đọc
  như hỏng.
- **"Tiêu thức tính"** chưa liệt kê giá trị nên chốt bảy lựa chọn: cố định theo tháng · theo
  ngày công thực tế · theo giờ công · theo sản lượng nghiệm thu · theo doanh số (%) · theo
  mức hoàn thành KPI · nhập tay từng kỳ.
- **Ba nút Tải file mẫu / Nhập Excel / Xuất Excel** hiện chỉ báo toast "sẽ nối ở bản sau" —
  đọc ghi file là việc của backend, không thuộc pha dựng giao diện.
- **Bảy tab dữ liệu lương còn lại** (Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm,
  Lương chuyên cần, Các khoản ứng – bù trừ) chỉ có tên, chưa có mô tả nội dung nên để chỗ giữ
  ghi rõ "chưa dựng" kèm một câu về việc màn hình đó sẽ chứa gì. Trang trắng đọc như lỗi.
- **"Loại lễ"** chưa liệt kê giá trị nên chốt bốn loại: Lễ theo dương lịch · Lễ theo âm lịch ·
  Nghỉ bù · Lễ riêng của công ty. Chọn "Lễ theo âm lịch" thì ô "Lặp lại mọi năm" tự khóa —
  ngày dương của lễ âm đổi mỗi năm, bật cờ đó sẽ sinh lịch sai từ năm sau.

## Quyền truy cập khu HRM

Quyền HRM đến **chỉ từ gói thuê bao**:

- Admin tick module vào gói ở màn "Gói dịch vụ" → ghi vào `SubscriptionPlan.features`
- Muốn một tài khoản có HRM thì đổi gói của họ — không có bật/tắt riêng theo tài khoản
- `/auth/me` và `/auth/login` trả `modules: { hrm }` đã quy đổi sẵn

Toàn bộ nằm trong **`maxv2_sys`** — một database duy nhất. Tenant DB (`maxv2_<MST>_app`)
không chứa gì về quyền, nên không lần nào phải chạy `sync:tenants` cho việc này.

Luật quy đổi có test thuần ở `be_maxv/src/__tests__/moduleQuyen.test.ts` — gói hết hạn, khóa
lạ trong `features`, và thứ tự ưu tiên của cờ ghi đè.

**Thêm module thứ hai** = thêm một khóa vào `MODULE_KEYS` (`be_maxv/src/constants/modules.ts`,
`maxv/src/features/owners/modules.ts`, `hdđt_maxv/src/features/auth/types/index.ts`) + một cột
DB + một dòng `MODULE_META`. Validator, kiểu dữ liệu, cột trên bảng danh sách và công tắc ở
màn chi tiết đều sinh ra từ mảng đó. Ba app không dùng chung package nên ba mảng `MODULE_KEYS`
là chỗ duy nhất phải nhớ đồng bộ.

Phía `hdđt_maxv`: nút HRM trên header chỉ hiện khi `modules.hrm`, và route `/hrm` bọc thêm
`ModuleRoute` để gõ thẳng URL cũng không vào được.

> **Khi nối backend HRM thật, mọi route `/api/v1/hrm/*` phải tự kiểm tra cờ này.** Ẩn nút và
> guard route đều là chuyện của trình duyệt — gọi thẳng API thì qua mặt được cả hai.

## Cách thay lớp mock bằng API thật

Toàn bộ dữ liệu giả nằm trong `src/features/hrm/mock/`. Component **không** import trực tiếp
`store.ts` hay `seed.ts` — chúng chỉ gọi hook trong `mock/hooks/*`. Các bước:

1. Viết `src/features/hrm/api/<tên>Api.ts` + `<tên>Queries.ts` theo mục 6.3 của spec
   (`queryKey` bắt buộc chứa `currentCompanyId`).
2. Giữ nguyên **tên và chữ ký** các hook đang có — mọi hàm ghi đã là `async` và ném `Error`
   có thông điệp, nên đổi thân hàm sang `mutateAsync` là xong, call site không phải sửa.
3. Bỏ `<HrmMockProvider>` khỏi `pages/hrm/HrmPage.tsx`, xóa cả thư mục `mock/`.

Các thực thể mới của hai tab sau (`cauHinh`, `caLamViec`, `khoanLuong`, `ngayLe`, và số liệu
tổng hợp của Dashboard) nằm cùng kho đó, hook ở `mock/hooks/cauHinh.ts`, `khoanLuong.ts`,
`ngayLe.ts`, `tongQuan.ts`. Backend sẽ cần thêm bảng `hrm_cau_hinh` (một dòng mỗi tenant),
`hrm_ca_lam_viec`, `hrm_khoan_luong` và `hrm_ngay_le`; Dashboard thì tính từ các bảng đã có,
không cần bảng riêng.

Ba hàm thuần trong `features/hrm/cay.ts` (`sapXepCay`, `sinhMaPhongBan`, `hopDongHienHanh`)
là bản sao logic sẽ nằm ở `be_maxv/src/services/client/hrm/`. Khi backend làm xong, phần
`cap` / `so_nv` / hợp đồng hiện hành do server trả về — lúc đó xóa bản FE đi, đừng để hai
nơi cùng tính một phép.
