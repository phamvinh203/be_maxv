# Thiết kế — HRM › Danh mục quản lý nhân viên (phòng ban, nhân viên, người phụ thuộc)

**Ngày:** 2026-08-11
**Phạm vi:** `be_maxv` (backend) + `hdđt_maxv` (frontend, khu `/hrm`)
**Trạng thái:** đã duyệt thiết kế, chờ lập kế hoạch triển khai

## 1. Vấn đề

`hdđt_maxv` đã có nút **HRM** trên `components/AppHeader.tsx` trỏ tới `/hrm`, nhưng route
đó khai báo với element rỗng (`<ProtectedRoute>` bọc một comment). `src/pages/hrm/` có ba
file rỗng (`HrmPage.tsx`, `Dashboard.tsx`, `employee.tsx`) và `src/features/hrm/` là thư
mục rỗng. Bấm vào HRM hiện ra màn hình trắng.

Cần dựng khu HRM với ba danh mục nhân sự: **phòng ban**, **nhân viên**, **người phụ
thuộc** — nền dữ liệu cho bảng lương sau này (kiểu lương GROSS/NET, trích BHXH, thuế TNCN,
phí công đoàn 1% trên lương đóng BHXH, giảm trừ gia cảnh).

Tenant DB đã có `dmpb` (phòng ban) do trang "Tổng hợp › Danh mục phòng ban" của **app khác**
(`fe_maxv`) dùng. Bảng này **phẳng** — không có trực thuộc, không có cấp. Chưa có bảng nào
cho nhân viên, hợp đồng, người phụ thuộc.

## 2. Mục tiêu

1. Ba màn hình danh mục hoạt động đầy đủ CRUD trong khu `/hrm`, deep-link được.
2. Phòng ban có **cây phân cấp** (trực thuộc / cấp) và đếm được số nhân viên.
3. Hồ sơ nhân viên đủ bốn nhóm thông tin, kèm **lịch sử hợp đồng** nhiều đời.
4. Người phụ thuộc nhập được từ **hai lối vào** (trong hồ sơ nhân viên và màn hình riêng)
   mà vẫn là một nguồn dữ liệu.
5. **Không gây hồi quy** cho trang Phòng ban đang chạy của `fe_maxv`.

### Ngoài phạm vi

- **Upload ảnh CCCD / đính kèm file.** `be_maxv` chưa có `@fastify/multipart`. Đã chốt ở
  bước brainstorm: phase này tab "Hồ sơ, tài liệu" chỉ lưu metadata dạng chữ. Xem mục 9.
- Bảng lương, chấm công, bảng kê BHXH, quyết toán TNCN.
- Import Excel danh sách nhân viên.
- Phân quyền người dùng theo phòng ban.
- Sửa trang "Tổng hợp › Danh mục phòng ban" của `fe_maxv` cho khớp thiết kế mới.
- Trang Dashboard HRM.

## 3. Quyết định đã chốt (bước brainstorm)

| Quyết định | Lựa chọn | Ghi chú |
|---|---|---|
| Nơi đặt module | **`hdđt_maxv`, khu `/hrm`** | Nút HRM đã có sẵn trên header |
| Bảng phòng ban | **Dùng chung `dmpb`, thêm cột** | Một nguồn sự thật cho cả kế toán lẫn nhân sự |
| "Gán nhanh phòng ban" | **Gán hàng loạt nhân viên vào một phòng ban** | Dialog chọn nhiều NV → chọn PB đích |
| Lưu file tài liệu | **Phase này chưa làm upload** | Chỉ metadata chữ |
| Sinh mã | **PB tự động, NV gợi ý + sửa được** | Doanh nghiệp thường đã có mã nhân sự riêng |
| Mức lương | **Lương chính + Lương đóng BHXH** | Hai số riêng, đúng thực tế VN |
| Danh sách chọn | **Hằng số trong code, riêng Chức vụ là danh mục** | Cấp bậc để ô nhập chữ tự do |
| Điều hướng HRM | **Route con** `/hrm/<màn hình>` | Deep-link + F5 giữ nguyên màn hình |
| Form nhân viên | **Dialog `fullScreen`, 4 tab** | Không rời khỏi danh sách |
| Cách chia việc | **Ba lát cắt dọc** | Mỗi lát đủ schema + API + màn hình |

### 3.1. Hai điểm đã điều chỉnh so với mô tả ban đầu

- **"Ngày vào"** xuất hiện ở bảng danh sách nhưng không có trong bốn nhóm của form. Đã chốt:
  thêm cột thật `ngay_vao` vào nhóm **"Công việc & lương"**, bảng đọc thẳng từ đó (không
  dẫn xuất từ hợp đồng sớm nhất).
- **"Cấp bậc"** để là ô nhập chữ tự do, không làm bảng danh mục. Chỉ **Chức vụ** là danh
  mục — kéo theo cần thêm màn hình thứ tư `/hrm/chuc-vu` để nhập liệu cho nó.

## 4. Mô hình dữ liệu — `be_maxv/prisma/tenant/schema.prisma`

> **Quy ước của file này:** tenant schema **không dùng Prisma `@relation`** (cả file chỉ có
> đúng một chỗ). Các bảng liên kết nhau bằng cột chuỗi trần kèm comment; ràng buộc toàn vẹn
> nằm ở tầng service (mục 7.2). Ngày dùng `DateTime?` trần, **không** `@db.Date` — khớp
> `m81.ngay_ct` và các bảng hiện có.

### 4.1. Mở rộng `dmpb` — đúng một cột

```prisma
model dmpb {
  // … giữ nguyên toàn bộ cột hiện có:
  //    ma_pb, ten_pb, ten_pb2, dia_chi, dien_thoai, ma_td1, ten_tk, ghi_chu,
  //    status, datetime0, datetime2

  ma_pb_me String? @db.VarChar(24) // trực thuộc — null = phòng ban gốc (dmpb.ma_pb)

  @@index([ma_pb_me])
}
```

Ô **"Mô tả"** trong form HRM ánh xạ vào `ghi_chu` đã có — không thêm cột trùng nghĩa.

**"Cấp" và "Nhân viên" không lưu trong DB.** `cap` tính từ cây khi trả danh sách; `so_nv`
đếm bằng `groupBy` trên `hrm_nhan_vien.ma_pb`. Lưu cấp cứng sẽ sai ngay lần đầu ai đó đổi
"Trực thuộc" của một nhánh — phải cập nhật xuống toàn bộ con cháu, và quên một lần là dữ
liệu lệch vĩnh viễn.

### 4.2. Bốn bảng mới

Tiền tố `hrm_` để tách rõ với danh mục kế toán (`dm*`). `dmpb` giữ nguyên tên vì nó dùng
chung cho cả hai nghiệp vụ.

**`hrm_chuc_vu`** — danh mục chức vụ, mỗi công ty tự cấu hình.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `ma_cv` | `String @id @db.VarChar(24)` | |
| `ten_cv` | `String @db.VarChar(254)` | |
| `status` | `String @default("1") @db.VarChar(1)` | |
| `datetime0`, `datetime2` | `DateTime @default(now())` | Khớp mọi danh mục hiện có |

**`hrm_nhan_vien`** — khóa `ma_nv String @id @db.VarChar(24)`.

| Nhóm | Cột |
|---|---|
| Cá nhân | `ho_ten` (bắt buộc), `so_cccd?`, `mst_ca_nhan?`, `ngay_sinh?`, `gioi_tinh?` (`nam`\|`nu`\|`khac`), `dien_thoai?`, `email?`, `dia_chi?`, `ghi_chu?` |
| Công việc & lương | `ma_pb?` (→ `dmpb`), `ma_cv?` (→ `hrm_chuc_vu`), `cap_bac?` (chữ tự do), `cong_doan Boolean @default(false)`, `ngay_vao?` |
| Ngân hàng | `ngan_hang?`, `so_tk?`, `chu_tk?` |
| Chung | `status @default("1")` — `1` đang làm, `0` đã nghỉ; `datetime0`, `datetime2` |

Index: `@@index([ma_pb])`. **`so_cccd` không đặt unique** — dữ liệu nhân sự nhập dần, ép
unique sẽ chặn việc lưu hồ sơ khi chưa có CCCD trong tay. Trùng CCCD là chuyện của người
nhập, không phải của DB.

**`hrm_hop_dong`** — khóa `id String @id @db.VarChar(32)` (sinh phía ứng dụng, khớp
`sync_log.id` / `m81.stt_rec`).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `ma_nv` | `String @db.VarChar(24)` | → `hrm_nhan_vien` |
| `so_hd` | `String @db.VarChar(64)` | |
| `loai_hd` | `String @db.VarChar(32)` | `khong_xac_dinh`\|`xac_dinh`\|`thu_viec`\|`thoi_vu`\|`khoan` |
| `kieu_luong` | `String @db.VarChar(8)` | `GROSS` (NV tự đóng thuế) \| `NET` (công ty đóng thuế) |
| `luong_chinh` | `Decimal @default(0) @db.Decimal(18, 2)` | |
| `luong_bhxh` | `Decimal @default(0) @db.Decimal(18, 2)` | Gốc tính phí công đoàn 1% |
| `ngay_bat_dau` | `DateTime` | |
| `ngay_ket_thuc` | `DateTime?` | `null` = không xác định thời hạn |
| `trich_bhxh` | `Boolean @default(true)` | |
| `tinh_tncn` | `Boolean @default(true)` | |
| `ghi_chu` | `String? @db.VarChar(512)` | |

Index: `@@index([ma_nv])`.

**`hrm_nguoi_phu_thuoc`** — khóa `id String @id @db.VarChar(32)`.

`ma_nv`, `ho_ten`, `quan_he`, `ngay_sinh?`, `so_cccd?`, `mst_ca_nhan?`, `dien_thoai?`,
`dia_chi?`, `gt_tu_thang?`, `gt_den_thang?`, `status`, `datetime0`, `datetime2`.

Hai trường đăng ký giảm trừ gia cảnh lưu dạng chuỗi `YYYY-MM` (`@db.VarChar(7)`) — so sánh
và sắp xếp được bằng thứ tự chuỗi, khớp thẳng với `<input type="month">`, không dính lệch
múi giờ như kiểu ngày. Index: `@@index([ma_nv])`.

**`hrm_tai_lieu`** — khóa `id String @id @db.VarChar(32)`.

`ma_nv`, `loai` (`cccd`\|`ho_chieu`\|`bang_cap`\|`chung_chi`\|`so_yeu_ly_lich`), `so_hieu?`,
`ngay_cap?`, `noi_cap?`, `ghi_chu?`, `status`, `datetime0`, `datetime2`.
**Chưa có cột file** — xem mục 9. Index: `@@index([ma_nv])`.

### 4.3. Hợp đồng hiện hành

Định nghĩa dùng chung ở mọi nơi (cột "Hợp đồng" và "Kiểu lương" của bảng nhân viên, tóm tắt
ở tab 1):

> Dòng có `ngay_bat_dau <= hôm nay` **và** (`ngay_ket_thuc` là `null` **hoặc**
> `ngay_ket_thuc >= hôm nay`), lấy dòng có `ngay_bat_dau` **mới nhất**.
> Không dòng nào khớp → lấy dòng có `ngay_bat_dau` mới nhất trong toàn bộ lịch sử.

Nhánh dự phòng cần thiết: nhân viên vừa hết HĐ cũ chưa ký HĐ mới vẫn phải hiện thông tin
gần nhất chứ không để trống.

## 5. Tầng API — `be_maxv`

Prefix `/api/v1/hrm`, đăng ký trong `routes/index.route.ts`. Mọi route
`app.addHook('preHandler', app.authenticate)`; DB tenant resolve từ `donViId` trong JWT qua
`resolveTenantDb(req)` như các module hiện có. Response bọc envelope
`{ success: true, data }` qua `sendOk` / `sendCreated` → FE dùng **`apiFetchData`**.

### 5.1. Vì sao phòng ban có endpoint riêng thay vì tái dùng `/tong-hop/phong-ban`

`phongBanUpdateSchema` dùng `optText`, mà `optText` biến trường **vắng mặt** thành `null`.
Nếu HRM gọi `PUT /tong-hop/phong-ban/:ma_pb` và chỉ gửi `ten_pb` + `ma_pb_me`, thì
`dia_chi`, `dien_thoai`, `ma_td1`, `ten_tk` bị **ghi đè thành null** — xóa trắng dữ liệu kế
toán mà không có thông báo nào.

Ngoài ra hai bên khác nhau ở sinh mã (tay vs tự động) và dạng trả về (phẳng vs cây). Gộp
chung service sẽ phải nhồi cờ điều kiện vào mọi hàm; trùng lặp thật sự chỉ là câu `delete`
và câu kiểm tồn tại. Tách rẻ hơn, và giữ `fe_maxv` rủi ro bằng không.

### 5.2. Phòng ban — cùng bảng `dmpb`, endpoint riêng

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/hrm/phong-ban` | Danh sách **phẳng đã kèm `cap` và `so_nv`**, sắp theo thứ tự duyệt cây (cha ngay trước con) |
| POST | `/hrm/phong-ban` | `{ ten_pb, ma_pb_me?, ghi_chu? }` → tự sinh `ma_pb` |
| PUT | `/hrm/phong-ban/:ma_pb` | **Chỉ ghi 4 cột**: `ten_pb`, `ma_pb_me`, `ghi_chu`, `status` |
| DELETE | `/hrm/phong-ban/:ma_pb` | 409 nếu còn phòng ban con hoặc còn nhân viên |
| POST | `/hrm/phong-ban/gan-nhanh` | `{ ma_pb, ma_nv_list: string[] }` — cập nhật hàng loạt trong một `$transaction` |

Server dựng cây và trả kèm `cap` để FE không phải tính lại — cùng một phép tính làm ở hai
nơi thì sớm muộn cũng lệch.

**Sinh mã phòng ban:** gốc là `PB01`, `PB02`…; con của `PB01` là `PB01.01`, `PB01.02`…
Đổi "Trực thuộc" **không đổi mã**: mã đã nằm trên chứng từ kế toán bên `fe_maxv`, đổi là
hỏng dữ liệu cũ. Nghĩa là mã chỉ phản ánh vị trí **lúc tạo**; `cap` mới là sự thật hiện tại.

### 5.3. Chức vụ

CRUD chuẩn bốn endpoint trên `/hrm/chuc-vu`, khuôn giống `phongBan.*` của `tong-hop`.

### 5.4. Nhân viên

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/hrm/nhan-vien` | Lọc `q`, `ma_pb`, `status`. Mỗi dòng kèm `ten_pb`, `ten_cv`, hợp đồng hiện hành (`so_hd`, `kieu_luong`), `so_npt` |
| GET | `/hrm/nhan-vien/ma-moi` | Gợi ý mã kế tiếp cho form thêm mới |
| GET | `/hrm/nhan-vien/:ma_nv` | Chi tiết đầy đủ |
| POST | `/hrm/nhan-vien` | Body có **nhánh `hop_dong` tùy chọn** — tạo NV + HĐ đầu tiên trong một `$transaction` |
| PUT | `/hrm/nhan-vien/:ma_nv` | Sửa NV; hợp đồng sửa qua endpoint riêng |
| DELETE | `/hrm/nhan-vien/:ma_nv` | Xóa kèm HĐ + NPT + tài liệu trong một `$transaction` |

`POST` nhận hợp đồng lồng bên trong vì tab 1 của dialog gộp cả hai nhóm — nếu tách thành hai
request thì lỗi ở request thứ hai để lại nhân viên không có hợp đồng.

### 5.5. Ba nhóm con của nhân viên

Cùng một khuôn cho `hop-dong`, `tai-lieu`, `nguoi-phu-thuoc`:

```
GET    /hrm/nhan-vien/:ma_nv/<nhóm>    liệt kê
POST   /hrm/nhan-vien/:ma_nv/<nhóm>    thêm
PUT    /hrm/<nhóm>/:id                 sửa
DELETE /hrm/<nhóm>/:id                 xóa
```

Riêng người phụ thuộc có thêm hai endpoint cho màn hình độc lập — cùng service, chỉ khác
chỗ lấy `ma_nv`:

```
GET  /hrm/nguoi-phu-thuoc     toàn công ty, kèm ma_nv + ten_nv
POST /hrm/nguoi-phu-thuoc     ma_nv nằm trong body
```

### 5.6. Bố trí file

Theo đúng khuôn bốn lớp hiện có:

```
be_maxv/src/routes/hrm/{phongBan,chucVu,nhanVien,hopDong,taiLieu,nguoiPhuThuoc}.route.ts
be_maxv/src/controllers/client/hrm/<tên>.controller.ts
be_maxv/src/services/client/hrm/<tên>.service.ts
be_maxv/src/validators/hrm/<tên>.validator.ts
```

Thông điệp lỗi thêm vào `constants/messages.ts` dưới khóa `HRM`.

## 6. Frontend — `hdđt_maxv`

### 6.1. Định tuyến

Route lồng trong `src/routes/AppRouter.tsx`, đặt **trước** `<Route path="*">`:

```tsx
<Route path="hrm" element={<ProtectedRoute><HrmPage /></ProtectedRoute>}>
  <Route index                  element={<Navigate to="nhan-vien" replace />} />
  <Route path="phong-ban"       element={<PhongBanPage />} />
  <Route path="nhan-vien"       element={<NhanVienPage />} />
  <Route path="nguoi-phu-thuoc" element={<NguoiPhuThuocPage />} />
  <Route path="chuc-vu"         element={<ChucVuPage />} />
</Route>
```

`HrmPage.tsx` (file rỗng sẵn có) thành **layout**: `<AppHeader />` + thanh điều hướng HRM +
`<Outlet />`.

> **Lệch có chủ ý với quy ước.** Chương 9 mục 9.7 của docs nói màn hình nhiều tab dùng state
> cục bộ, không tạo route con (mẫu `SettingsPage`). HRM là **cụm màn hình** chứ không phải
> một trang nhiều tab: cần gửi link tới đúng màn hình, F5 phải giữ nguyên vị trí, và sau này
> thêm Chấm công / Bảng lương chỉ việc thêm route. Quy ước 9.7 vẫn áp dụng cho **các tab bên
> trong** dialog nhân viên.

Hai file rỗng còn lại: `employee.tsx` → đổi tên `NhanVienPage.tsx` (chữ thường lệch quy ước
PascalCase của repo); `Dashboard.tsx` → **xóa**, ngoài phạm vi và đang rỗng.

### 6.2. Cấu trúc feature

```
src/features/hrm/
  types/index.ts          PhongBan, NhanVien, HopDong, NguoiPhuThuoc, TaiLieu, ChucVu
  constants.ts            QUAN_HE, LOAI_HD, KIEU_LUONG, LOAI_TAI_LIEU, GIOI_TINH, NGAN_HANG_VN
  api/                    <tên>Api.ts + <tên>Queries.ts cho 6 thực thể
  components/
    HrmNav.tsx
    phong_ban/            PhongBanTable, PhongBanFormDialog, GanNhanhDialog
    nhan_vien/            NhanVienTable, NhanVienDialog
    nhan_vien/tabs/       ThongTinTab, HopDongTab, HoSoTab, NguoiPhuThuocTab
    nguoi_phu_thuoc/      NguoiPhuThuocTable, NguoiPhuThuocForm, NguoiPhuThuocFormDialog
    chuc_vu/              ChucVuTable, ChucVuFormDialog
  hooks/useTableFilter.ts
```

`fe_maxv` có `CatalogToolbar` + `useCatalogList` làm đúng việc này, nhưng là app khác —
không import chéo được. Bốn bảng ở đây có nhu cầu lọc/phân trang giống nhau nên tách một
hook nhỏ `useTableFilter` thay vì lặp `useMemo` bốn lần.

**Nội dung `constants.ts`** — chốt luôn để không mỗi chỗ một kiểu:

| Hằng | Giá trị (mã lưu DB → nhãn hiển thị) |
|---|---|
| `GIOI_TINH` | `nam` · `nu` · `khac` |
| `QUAN_HE` | `con` · `vo_chong` · `cha` · `me` · `anh_chi_em` · `ong_ba` · `chau` · `khac` |
| `LOAI_HD` | `khong_xac_dinh` · `xac_dinh` · `thu_viec` · `thoi_vu` · `khoan` |
| `KIEU_LUONG` | `GROSS` (NV tự đóng thuế) · `NET` (công ty đóng thuế) |
| `LOAI_TAI_LIEU` | `cccd` · `ho_chieu` · `bang_cap` · `chung_chi` · `so_yeu_ly_lich` |
| `NGAN_HANG_VN` | Danh sách ngân hàng VN (mã + tên), lưu `ngan_hang` bằng **tên**, cho phép nhập tự do ngoài danh sách |

Zod ở backend phải liệt kê **đúng các mã này** bằng `z.enum` — lệch một giá trị thì FE gửi
lên bị 400 mà backend không trả `message`, người dùng chỉ thấy lỗi chung.

### 6.3. Quy ước TanStack Query

`queryKey` **bắt buộc gắn `currentCompanyId`** — thiếu là dữ liệu nhân sự của MST này hiện
ra khi người dùng đổi sang MST khác trên header:

```ts
export const hrmKeys = {
  phongBan: (companyId) => ['hrm', companyId, 'phong-ban'] as const,
  chucVu:   (companyId) => ['hrm', companyId, 'chuc-vu'] as const,
  nhanVien: (companyId) => ['hrm', companyId, 'nhan-vien'] as const,
  nhanVienList:   (companyId, filters) => ['hrm', companyId, 'nhan-vien', 'list', filters] as const,
  nhanVienDetail: (companyId, maNv)    => ['hrm', companyId, 'nhan-vien', maNv] as const,
  hopDong:  (companyId, maNv) => ['hrm', companyId, 'nhan-vien', maNv, 'hop-dong'] as const,
  taiLieu:  (companyId, maNv) => ['hrm', companyId, 'nhan-vien', maNv, 'tai-lieu'] as const,
  npt:      (companyId, maNv) => ['hrm', companyId, 'nhan-vien', maNv, 'nguoi-phu-thuoc'] as const,
  nptAll:   (companyId)       => ['hrm', companyId, 'nguoi-phu-thuoc'] as const,
};
```

Hợp đồng / tài liệu / NPT nằm **dưới tiền tố nhân viên** để một lần
`invalidateQueries({ queryKey: hrmKeys.nhanVien(companyId) })` làm mới cả cụm.
`enabled: isAuthenticated && !!currentCompanyId`.

Thông báo dùng `react-toastify`; `Alert` inline chỉ cho lỗi kéo dài. MUI v9 → `slotProps`,
không `InputProps` / `PaperProps`.

### 6.4. Màn hình Phòng ban — `/hrm/phong-ban`

Bảng: **Mã · Tên phòng ban · Trực thuộc · Cấp · Nhân viên · Trạng thái · Thao tác**.
Cây thể hiện bằng **thụt lề tên theo `cap`** — không cần thư viện tree.

Toolbar: `[Gán nhanh phòng ban]` `[Thêm phòng ban]` + ô tìm.

**Form thêm/sửa:** Tên phòng ban (bắt buộc), Trực thuộc (Select — **tự loại chính nó và
toàn bộ con cháu** khỏi danh sách chọn), Mô tả. Không có ô Mã.

Bảng có cột "Trạng thái" nhưng form thêm mới thì không — phòng ban mới luôn `status = '1'`.
Ô **Trạng thái (Đang dùng / Ngừng)** chỉ xuất hiện ở **chế độ sửa**. Không có nó thì cột
trên bảng vĩnh viễn hiện một giá trị và người dùng không có cách nào ngừng một phòng ban đã
giải thể mà vẫn còn dính chứng từ cũ (xóa bị chặn).

**Dialog Gán nhanh:** trái là danh sách nhân viên có checkbox, lọc "Chưa có phòng ban" /
theo phòng ban hiện tại / ô tìm; phải chọn phòng ban đích; bấm Gán → một request.

### 6.5. Màn hình Nhân viên — `/hrm/nhan-vien`

Bảng: **Mã NV · Họ và tên · Phòng ban · Chức vụ · Hợp đồng · Kiểu lương · Điện thoại ·
Email · Công đoàn · Ngày vào · NPT · Thao tác**. Công đoàn là Chip ✓/—, NPT là số.

Bộ lọc: ô tìm (mã / tên / CCCD / điện thoại) + Select phòng ban + Select trạng thái,
**mặc định "Đang làm"**.

Danh sách cột bạn nêu **không có cột Trạng thái**, nhưng model có `status` và bộ lọc dùng
tới nó. Giải quyết không thêm cột: nhân viên đã nghỉ hiển thị **mờ** (`opacity: 0.55`) —
đúng cách `PhongBanList` của `fe_maxv` đang làm. Đặt trạng thái ở **Select "Trạng thái"
trong nhóm "Công việc & lương"** của dialog sửa; thêm mới thì luôn là "Đang làm".

`[Thêm nhân viên]` mở Dialog `fullScreen` bốn tab.

**Tab 1 — Thông tin nhân viên.** Bốn nhóm, mỗi nhóm một `Paper` có tiêu đề:

1. *Thông tin cá nhân* — Số CCCD, MST cá nhân, Mã nhân viên, Họ và tên, Ngày sinh, Giới
   tính, Điện thoại, Email, Địa chỉ, Ghi chú.
2. *Công việc & lương* — Phòng ban, Chức vụ, Cấp bậc, **Ngày vào**, ô tích "Tham gia công
   đoàn" (kèm chú thích: trích 1% phí công đoàn trên lương đóng BHXH).
3. *Thông tin hợp đồng* — Số hợp đồng, Loại hợp đồng, Kiểu lương, Lương chính, Lương đóng
   BHXH, Ngày bắt đầu, Ngày kết thúc, ô tích Trích đóng BHXH, ô tích Tính thuế TNCN.
4. *Tài khoản ngân hàng* — Ngân hàng, Số tài khoản, Tên chủ tài khoản.

**Quy tắc hai chế độ** — tránh hai đường ghi vào cùng bảng hợp đồng:

| | Nhóm "Thông tin hợp đồng" ở tab 1 | Ba tab còn lại |
|---|---|---|
| **Thêm mới** | Ô nhập — lưu cùng lúc, tạo hợp đồng đầu tiên | Khóa, tooltip "Lưu nhân viên trước" |
| **Sửa** | **Tóm tắt chỉ đọc** của hợp đồng hiện hành + nút chuyển sang tab Lịch sử | Mở bình thường |

Ba tab kia phải khóa khi thêm mới vì hợp đồng / tài liệu / NPT đều cần `ma_nv` đã tồn tại
mới gắn được.

**Tab 2 — Lịch sử hợp đồng.** Bảng: Số HĐ · Loại · Kiểu lương · Lương chính · Lương BHXH ·
Từ ngày · Đến ngày · BHXH · TNCN · Trạng thái (Hiệu lực / Hết hạn / Sắp tới) · Thao tác.
Nút `[Thêm hợp đồng]`. Đây là nơi duy nhất ký mới / gia hạn / sửa hợp đồng.

**Tab 3 — Hồ sơ, tài liệu.** Bảng: Loại · Số hiệu · Ngày cấp · Nơi cấp · Ghi chú · Thao tác.
Nút `[Thêm tài liệu]`. Có dòng chữ nói rõ **đính kèm ảnh sẽ có ở bản sau**, để người dùng
không tưởng là lỗi.

**Tab 4 — Người phụ thuộc.** Bảng + `[Thêm người phụ thuộc]`, dùng **chung component
`NguoiPhuThuocForm`** với màn hình độc lập.

### 6.6. Màn hình Người phụ thuộc — `/hrm/nguoi-phu-thuoc`

Bảng: **Mã NV · Tên nhân viên · Họ tên NPT · Quan hệ · Ngày sinh · CCCD · MST · ĐK giảm trừ**.
Cột cuối hiển thị `01/2026 – 12/2026`; để trống đến tháng thì `01/2026 – nay`.

`[Thêm người phụ thuộc]` mở dialog bọc `NguoiPhuThuocForm`, chỉ thêm ô **chọn Nhân viên**
(bắt buộc) ở đầu.

### 6.7. Màn hình Chức vụ — `/hrm/chuc-vu`

CRUD đơn giản: Mã · Tên chức vụ · Trạng thái · Thao tác.

### 6.8. Ảnh hưởng chéo

`dmpb` dùng chung, nên phòng ban tạo ở HRM xuất hiện luôn ở trang "Tổng hợp › Danh mục
phòng ban" của `fe_maxv` — đúng ý đồ. Trang đó không có cột "Trực thuộc" nên cây sẽ trông
phẳng bên ấy; chấp nhận, không sửa `fe_maxv` trong phạm vi này.

## 7. Toàn vẹn dữ liệu và xử lý lỗi

### 7.1. Đồng bộ schema tenant

Sau khi sửa `prisma/tenant/schema.prisma`:

```
npm run generate
npm run sync:tenants
```

Bước thứ hai dễ quên và hậu quả rất khó đoán: công ty **mới tạo** chạy tốt trong khi mọi
công ty **cũ** lỗi P2022 "column does not exist". Đây là một mục bắt buộc trong plan, không
phải ghi chú bên lề.

### 7.2. Ràng buộc phải viết tay ở service

Schema không có khóa ngoại, nên đây là nơi lỗi hay lọt nhất:

| Thao tác | Kiểm tra | Mã lỗi |
|---|---|---|
| Tạo / sửa nhân viên | `ma_pb`, `ma_cv` tồn tại | 404 |
| Sửa "Trực thuộc" phòng ban | cha không phải chính nó hoặc con cháu nó | 409 |
| Xóa phòng ban | không còn phòng ban con, không còn nhân viên | 409 |
| Xóa chức vụ | không còn nhân viên giữ chức vụ đó | 409 |
| Thêm HĐ / NPT / tài liệu | `ma_nv` tồn tại | 404 |
| Xóa nhân viên | xóa HĐ + NPT + tài liệu trong cùng `$transaction` | — |
| Gán nhanh | phòng ban tồn tại; **mọi** `ma_nv` tồn tại → có mã lạ thì từ chối **cả lô** | 404 |
| Tạo NV / phòng ban / chức vụ | mã chưa tồn tại | 409 |

Gán nhanh từ chối cả lô thay vì gán một phần: gán nửa chừng để lại trạng thái người dùng
không biết đã đi tới đâu và không có cách nào lùi lại.

### 7.3. Tranh chấp khi sinh mã

Hai người bấm "Thêm phòng ban" cùng lúc sẽ cùng đọc ra `PB03`. Xử lý bằng cách **bắt lỗi
trùng khóa của Postgres rồi thử lại mã kế tiếp** (tối đa vài lượt), không tin vào
`count + 1`.

### 7.4. Phía FE

`apiFetchData` đã tự refresh 401 và ném `ApiError` kèm `status`:

| Mã | Xử lý |
|---|---|
| 409 | Toast đỏ với thông điệp từ server — đây là lỗi người dùng sửa được (trùng mã, phòng ban còn nhân viên) |
| 404 | Toast + `invalidate` để bảng nạp lại, vì dữ liệu trên màn hình đã lệch với server |
| 400 | Backend **không trả `message`** → thông báo chung |

Lỗi tải danh sách dùng `Alert` inline; lỗi thao tác dùng toast.

## 8. Kiểm thử

Theo đúng phong cách sẵn có: `node:test` + `assert/strict`, hàm thuần, không đụng DB. Chạy
bằng `npx tsx --test src/__tests__/<file>.test.ts`.

- **`hrmPhongBanCay.test.ts`** — dựng cây từ danh sách phẳng: `cap` đúng ở mọi độ sâu; phát
  hiện chu trình; node mồ côi (`ma_pb_me` trỏ tới phòng ban đã xóa) không làm rơi vào vòng
  lặp vô hạn; thứ tự duyệt cha ngay trước con.
- **`hrmSinhMa.test.ts`** — `PB01` → `PB02`; con của `PB01` → `PB01.01`; nhảy đúng khi mã
  giữa dãy đã bị xóa; mã nhân viên `NV0001` → `NV0002`.
- **`hrmHopDongHienHanh.test.ts`** — HĐ chưa tới hạn; HĐ đã hết hạn; `ngay_ket_thuc` null;
  nhiều HĐ chồng lấn; không HĐ nào.

Ba hàm này là nơi logic thật sự nằm. Phần CRUD còn lại lặp lại khuôn đã có sẵn mẫu trong
repo (`phongBan.service.ts` của `tong-hop`) nên không viết test riêng.

## 9. Phase 2 — upload tài liệu (ghi lại để không mất)

Khi làm: cài `@fastify/multipart`; thêm cột file vào `hrm_tai_lieu`; giới hạn JPG/PNG/PDF
≤ 5MB. **Không phục vụ file qua static** — ảnh CCCD phải đi qua endpoint có kiểm quyền,
nếu không thì đường dẫn đoán được sẽ rò dữ liệu cá nhân giữa các tenant.

## 10. Thứ tự thi công — ba lát cắt dọc

| Lát | Nội dung | Xong khi |
|---|---|---|
| **1** | `dmpb.ma_pb_me` + `hrm_nhan_vien` (bảng rỗng, chỉ để đếm) + API phòng ban + layout HRM + màn hình Phòng ban | Tạo được cây phòng ban ba cấp, sửa trực thuộc, xóa bị chặn đúng; trang Phòng ban của `fe_maxv` vẫn chạy nguyên vẹn |
| **2** | `hrm_chuc_vu`, `hrm_hop_dong`, `hrm_tai_lieu` + màn hình Nhân viên (dialog 4 tab) + màn hình Chức vụ + **nút Gán nhanh** | Thêm/sửa/xóa nhân viên kèm hợp đồng, ký HĐ mới, gán nhanh nhiều NV vào một phòng ban, cột "Nhân viên" ở màn Phòng ban nhảy đúng |
| **3** | `hrm_nguoi_phu_thuoc` + tab NPT + màn hình NPT độc lập | Thêm NPT từ cả hai lối vào, cột NPT trên bảng nhân viên đúng số |

"Gán nhanh phòng ban" thuộc màn hình Phòng ban nhưng hoàn thiện ở lát 2, vì cần có nhân viên
mới thử được.

Mỗi lát chạy `npm run sync:tenants`, `npm run typecheck`, `npm run lint` và bộ test của lát
đó trước khi coi là xong. Cập nhật `docs/14-hop-dong-api.md` theo checklist ở chương 13.
