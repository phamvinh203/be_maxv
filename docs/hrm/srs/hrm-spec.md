---
type: srs
feature: hrm
status: in-review
updated: 2026-09-07
priority: P0
links:
  - docs/hrm/srs/hrm-flows.md
  - docs/hrm/srs/hrm-states.md
  - docs/hrm/srs/hrm-erd.md
  - docs/hrm/architecture/api-contract.md
  - docs/hrm/architecture/data-model.md
  - docs/hrm/qa/test-cases.md
---

# HRM — ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)

*Phân hệ Quản lý Nhân sự — MAXV v2. Phạm vi đợt này: Phòng ban và Nhân viên, trong Nhân viên gồm Lịch sử hợp đồng, Hồ sơ/Tài liệu và Người phụ thuộc.*

Tài liệu này được viết bằng cách **đối chiếu ngược từ mã nguồn đã triển khai**. Mọi con số, wording lỗi và quy tắc dưới đây đều trích từ mã thật, có ghi rõ file và dòng. Chỗ nào tài liệu mô tả điều mã **chưa** làm đều được đánh dấu `[CHƯA CÓ TRONG MÃ]` — đó là đầu việc, không phải mô tả hiện trạng.

**Cập nhật 2026-09-07 (đợt chốt nghiệp vụ 16/16).** Bản này đã nạp đủ 16 quyết định nghiệp vụ ghi ở Mục 6.1 của `docs/hrm/CONTEXT_SUMMARY.md`. Quy tắc mới do các quyết định đó sinh ra được đánh dấu `[MỚI — QĐ #n]`, quy tắc bị sửa được đánh dấu `[SỬA THEO QĐ #n]`. Những dấu này chỉ để Architect và QA lần ngược tới quyết định gốc; chúng không thay đổi cách đọc quy tắc.

---

## 1. Mục tiêu kinh doanh và các bên liên quan

### 1.1 Mục tiêu kinh doanh

| # | Mục tiêu | Đo bằng gì |
|---|---|---|
| G1 | Chuẩn hóa nền tảng dữ liệu tổ chức: cây phòng ban nhiều cấp, hồ sơ nhân viên tập trung theo từng công ty (tenant) | Mỗi công ty tự dựng được cây phòng ban và danh sách nhân viên mà không cần can thiệp kỹ thuật |
| G2 | Giữ **lịch sử hợp đồng lao động** đầy đủ theo thời gian, thay vì sửa đè một dòng duy nhất | Truy được mọi hợp đồng đã ký của một nhân viên kèm mức lương từng thời kỳ |
| G3 | Cung cấp dữ liệu đầu vào **đúng và toàn vẹn** cho phân hệ Chấm công và Tính lương sắp làm | Bốn nhóm dữ liệu bắt buộc sẵn sàng: mức lương thỏa thuận, lương đóng BHXH, cờ công đoàn/BHXH/TNCN, số người phụ thuộc |
| G4 | Quản lý hồ sơ giảm trừ gia cảnh thuế TNCN, chống đăng ký trùng gây tính giảm trừ hai lần | Không tồn tại hai người phụ thuộc cùng mã số thuế **trong cùng một công ty**, kể cả khi đăng ký cho hai nhân viên khác nhau |
| G5 | Số hóa giấy tờ nhân sự bằng **Google Drive của chính doanh nghiệp**, không đưa file vào hạ tầng MAXV | Doanh nghiệp giữ quyền sở hữu file; MAXV chỉ giữ con trỏ |
| G6 | Biết được hồ sơ nhân sự của ai còn thiếu giấy tờ gì và giấy tờ nào sắp hết hạn, không đợi tới lúc cần dùng mới phát hiện | Mỗi nhân viên có một chỉ báo đủ/thiếu tính theo bộ giấy tờ bắt buộc của loại hợp đồng đang áp; giấy tờ có ngày hết hạn được cảnh báo trước khi quá hạn |

### 1.2 Các bên liên quan

| Bên liên quan | Quan tâm điều gì |
|---|---|
| Chủ tài khoản doanh nghiệp (`OWNER`) | Kiểm soát ai được đụng vào kho tài liệu của công ty; dữ liệu nhân sự không rò sang công ty khác |
| Chuyên viên nhân sự / kế toán được cấp quyền (`OWNER_EMPLOYEE`) | Nhập nhanh, ít thao tác lặp, hệ thống tự sinh mã, báo lỗi bằng tiếng Việt nói rõ sai chỗ nào |
| Đội phát triển phân hệ Lương | Dữ liệu hợp đồng không mâu thuẫn: tại một thời điểm mỗi nhân viên chỉ có một hợp đồng hiệu lực **cho mỗi loại hợp đồng**. Cần biết rõ nhãn "hợp đồng hiện hành" không đồng nghĩa "đang hiệu lực hôm nay" (BR-hrm-019) và phải tự lọc theo `ngay_bat_dau` so với kỳ lương |
| Đội vận hành MAXV | Không bị gọi hỗ trợ vì mã trùng, cây phòng ban vỡ, hay kết nối Drive hỏng hàng loạt |
| Cơ quan thuế (gián tiếp) | Số liệu người phụ thuộc và lương đóng BHXH đúng để quyết toán |

---

## 2. Phạm vi

### 2.1 Trong phạm vi

| Nhóm | Nội dung |
|---|---|
| Phòng ban | Tạo (tự sinh mã theo cây hoặc tự nhập), xem danh sách phẳng kèm tên phòng ban cha và số nhân viên đang làm, sửa tên/ghi chú/trạng thái/phòng ban cha, xóa mềm có ràng buộc, lọc theo mã/tên/trạng thái |
| Nhân viên | Tạo (tự sinh mã hoặc tự nhập), xem danh sách kèm tên phòng ban + số người phụ thuộc + thông tin hợp đồng hiện hành + chỉ báo hồ sơ đủ/thiếu, xem chi tiết, sửa, **ghi nhận nghỉ việc kèm ngày nghỉ và tự chốt hợp đồng**, xóa mềm, lọc theo mã/họ tên/phòng ban/trạng thái |
| Hợp đồng lao động | Xem lịch sử theo nhân viên (mới nhất lên đầu), tạo hợp đồng, sửa hợp đồng, **đổi hợp đồng** (chốt hợp đồng cũ và ký hợp đồng mới trong một giao dịch), xóa hợp đồng |
| Người phụ thuộc | Tạo, xem theo nhân viên kèm tên nhân viên, sửa, xóa; chặn trùng mã số thuế trong cùng một nhân viên |
| Hồ sơ tài liệu | Tạo bản ghi giấy tờ kèm **ngày hết hạn**, xem danh sách theo nhân viên và theo loại, sửa, xóa (xóa dòng thì xóa luôn file scan trên Drive) |
| Bộ giấy tờ bắt buộc | Khai báo theo từng công ty: loại hợp đồng nào cần những loại giấy tờ nào; hệ thống tính chỉ báo hồ sơ đủ/thiếu cho từng nhân viên |
| Cảnh báo hạn giấy tờ | Danh sách giấy tờ đã hết hạn và sắp hết hạn theo ngưỡng do công ty đặt |
| Nhật ký thao tác | Ghi vết người thao tác cho nhóm thao tác phá hủy và sửa lương (xem NFR-hrm-011) |
| File scan trên Google Drive | Kiểm trạng thái kết nối, liên kết tài khoản Google của doanh nghiệp, ngắt liên kết, tải file lên, xem file qua máy chủ, gỡ file |

### 2.2 Ngoài phạm vi đợt này

Chấm công, ca làm việc, lịch nghỉ lễ, đơn nghỉ phép · Tính bảng lương, phiếu lương, các khoản thưởng/phụ cấp/khấu trừ · Cấu hình tham số lương và biểu thuế TNCN · Tờ khai thuế TNCN · Nhập khẩu hàng loạt từ Excel · Cổng tự phục vụ cho nhân viên.

Riêng nhật ký thao tác: đợt này **có** ghi vết người thao tác cho nhóm thao tác nêu ở NFR-hrm-011, nhưng **không** lưu ảnh chụp giá trị trước và sau mỗi lần sửa — phần đó nằm ngoài phạm vi. Chính sách xóa cứng hồ sơ và thời hạn lưu trữ file scan sau khi nhân viên nghỉ cũng nằm ngoài phạm vi đợt này (xem A-hrm-10).

> Giao diện `hdđt_maxv/src/features/hrm/` hiện đã có sẵn màn hình cho Chấm công, Bảng lương, Cấu hình, KPI, Tăng ca… nhưng toàn bộ chạy trên dữ liệu giả trong bộ nhớ (`features/hrm/mock/`). Chúng **không** thuộc phạm vi đặc tả này.

---

## 3. Tác nhân và phân quyền

### 3.1 Tác nhân

| Tác nhân | Là ai | Truy cập HRM thế nào |
|---|---|---|
| `OWNER` | Chủ tài khoản, sở hữu các công ty (`DonVi.ownerId`) | Vào được mọi công ty mình sở hữu |
| `OWNER_EMPLOYEE` | Nhân viên của chủ tài khoản, được cấp quyền vào từng công ty qua `DonViAccess` | Chỉ vào được công ty được cấp |
| `ADMIN` | Quản trị hệ thống MAXV | **Không truy cập được dữ liệu HRM của tenant** — đây là quyết định có chủ đích, không phải thiếu sót (BR-hrm-051) |
| Quyền xem dữ liệu lương | Một quyền nghiệp vụ cấp **bên trong** phạm vi `OWNER_EMPLOYEE`; `OWNER` luôn có sẵn | Không phải một vai trò hệ thống mới. Chỉ người được cấp quyền này mới đọc được lương chính, lương BHXH, số tài khoản ngân hàng và lịch sử hợp đồng (BR-hrm-059) |
| Google | Dịch vụ ngoài, giữ file scan | Chỉ qua luồng OAuth và Drive API |

### 3.2 Ma trận quyền — hiện trạng mã nguồn và mức đã chốt

Cột "Hiện trạng mã" là điều mã đang làm; cột "Đã chốt" là mức phải đạt sau đợt này. Hai cột khác nhau ở đâu thì đó chính là đầu việc.

| Thao tác | Hiện trạng mã | Đã chốt |
|---|---|---|
| Xem / tạo / sửa / xóa Phòng ban, Nhân viên, Người phụ thuộc, Tài liệu | `OWNER` và `OWNER_EMPLOYEE` đều được; `ADMIN` bị 403 | Giữ nguyên |
| Xem lương chính, lương BHXH, số tài khoản ngân hàng | Mọi người vào được công ty đều đọc đủ | Chỉ người **được cấp quyền xem dữ liệu lương** (BR-hrm-059, E-hrm-058) |
| Xem lịch sử hợp đồng (`GET /hop-dong`) | Ai vào được công ty cũng lấy được **toàn bộ** hợp đồng của cả công ty trong một lượt gọi | Bắt buộc lọc theo đúng một nhân viên **và** phải có quyền xem dữ liệu lương (BR-hrm-059, E-hrm-058) |
| Tạo / sửa / xóa hợp đồng | `OWNER` và `OWNER_EMPLOYEE` đều được | Chỉ người có quyền xem dữ liệu lương (BR-hrm-059) |
| Kiểm trạng thái kết nối Drive | `OWNER` và `OWNER_EMPLOYEE` | Giữ nguyên |
| Kết nối Drive **lần đầu** | `OWNER` và `OWNER_EMPLOYEE` | **Chỉ `OWNER`** (BR-hrm-045, E-hrm-059) |
| **Đổi** sang tài khoản Google khác | Chỉ `OWNER` (403, E-hrm-041) | Giữ nguyên |
| **Ngắt** kết nối Drive | Chỉ `OWNER` (403, E-hrm-042) | Giữ nguyên |
| Tải lên / xem / gỡ file scan | `OWNER` và `OWNER_EMPLOYEE` | Giữ nguyên — nối xong thì mọi người có quyền vào công ty đều dùng được |
| Mọi thao tác HRM chạm dữ liệu công ty | `ADMIN` bị 403 | Giữ nguyên — **có chủ đích** (BR-hrm-051) |

Ba điểm phải đọc kỹ:

1. **Quyền xem dữ liệu lương nằm BÊN TRONG phạm vi `OWNER_EMPLOYEE`, không đụng tới `ADMIN`.** Đây là quyền nghiệp vụ cấp thêm cho người đã vào được công ty, không phải một vai trò hệ thống mới ngang hàng `OWNER`/`OWNER_EMPLOYEE`/`ADMIN`. Cách hiện thực (cột phân quyền, bảng quyền riêng, hay cờ trên bản ghi cấp quyền vào công ty) là việc của Architect.
2. **`ADMIN` không có phạm vi tenant là quyết định có chủ đích.** `accessibleDonViWhere` trả `null` cho mọi vai trò khác `OWNER`/`OWNER_EMPLOYEE` (`helpers/access.ts:17-24`), nên `resolveTenantInfo` ném 403 và `canAccessDonVi` trả `false`. Đội vận hành MAXV **không** xem được dữ liệu nhân sự của khách qua giao diện, và đó là điều mong muốn: hồ sơ nhân sự chứa CCCD, mã số thuế cá nhân và lương. Hỗ trợ khách phải đi đường khác (khách chia sẻ màn hình, hoặc khách tự cấp quyền vào công ty). Không được nới quy tắc này vì lý do "cho tiện hỗ trợ".
3. **Siết quyền Drive phải sửa giao diện cùng lúc với máy chủ.** Người không phải chủ tài khoản không được thấy nút "Kết nối Google Drive" rồi bấm vào và nhận 403; giao diện phải hiện thẳng thông báo nhờ chủ tài khoản liên kết Drive (BR-hrm-045).

---

## 4. Thực thể và trường dữ liệu

Ký hiệu: **B** = bắt buộc, **T** = tùy chọn. Cột "Ràng buộc thật" ghi đúng điều tầng kiểm tra dữ liệu đang áp.

### 4.1 Phòng ban — `hrm_phong_ban`

| Trường | B/T | Kiểu | Ràng buộc thật | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `ma_pb` | T khi tạo | Chuỗi ≤ 24 | Tự động in hoa. Bỏ trống thì hệ thống sinh theo cây. Không sửa được sau khi tạo | Khóa nghiệp vụ, đọc được, nằm trên chứng từ kế toán |
| `ten_pb` | **B** | Chuỗi 1–254 | Không được rỗng | Tên phòng ban hiển thị |
| `ma_pb_me` | T | Chuỗi ≤ 24 | Tự động in hoa; rỗng quy về không có cha. Phải tồn tại và chưa xóa mềm | Vị trí trong cây tổ chức |
| `ghi_chu` | T | Chuỗi ≤ 512 | — | Ghi chú tự do |
| `status` | T | `1` hoặc `0` | Mặc định `1` | `1` đang hoạt động, `0` ngừng hoạt động |
| `da_xoa` | Hệ thống | Đúng/Sai | Mặc định Sai; chỉ đổi qua thao tác xóa | Xóa mềm, giữ dòng để mã không bị cấp lại |

**Trường tính lúc đọc (chỉ có trong phản hồi, không có trong bảng):** `ten_pb_me` (tên phòng ban cha, tra từ danh sách phòng ban chưa xóa) và `so_nv` (đếm nhân viên `da_xoa = false` **và** `status = '1'`).

### 4.2 Nhân viên — `hrm_nhan_vien`

| Trường | B/T | Kiểu | Ràng buộc thật | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `ma_nv` | T khi tạo | Chuỗi ≤ 24 | Tự động in hoa. Bỏ trống thì sinh `NV0001`…`NV9999`. Không sửa được sau khi tạo | Khóa nghiệp vụ mà lương/chấm công sẽ trỏ vào |
| `ho_ten` | **B** | Chuỗi 1–254 | Không được rỗng | Họ và tên đầy đủ |
| `ngay_sinh` | T | Ngày `YYYY-MM-DD` | Phải là ngày có thật; `2026-02-30` bị từ chối | Ngày sinh |
| `so_cccd` | T | Chuỗi ≤ 20 | **Không kiểm 12 chữ số, không duy nhất** | Số căn cước |
| `mst_ca_nhan` | T | Chuỗi | Phải khớp định dạng mã số thuế (10 số, 10 số kèm nhánh, hoặc 12 số) | Mã số thuế cá nhân, đi thẳng vào tờ khai TNCN |
| `dien_thoai` | T | Chuỗi ≤ 20 | Không kiểm định dạng số | Số điện thoại |
| `email` | T | Chuỗi ≤ 254 | Phải đúng định dạng email, tự hạ chữ thường | Email liên hệ |
| `dia_chi` | T | Chuỗi ≤ 500 | — | Địa chỉ |
| `gioi_tinh` | T | `nam`/`nu`/`khac` | Ngoài ba giá trị này bị từ chối | Giới tính |
| `ma_pb` | T | Chuỗi ≤ 24 | Tự động in hoa. Phải tồn tại và chưa xóa mềm. Máy chủ **cố ý không kiểm `status`** — lọc phòng ban ngừng hoạt động là việc của ô chọn ở giao diện (BR-hrm-061) | Phòng ban đang thuộc |
| `chuc_vu` | T | Chuỗi ≤ 100 | Chữ tự do, không phải danh mục | Chức vụ |
| `cap_bac` | T | Chuỗi ≤ 64 | Chữ tự do | Cấp bậc |
| `ngay_vao_lam` | **B** | Ngày `YYYY-MM-DD` | Bắt buộc, phải là ngày có thật | Ngày vào làm **đầu tiên**, dùng tính thâm niên và phép năm, không đổi khi ký hợp đồng mới |
| `mien_cham_cong` | T khi tạo, **B** khi sửa | Đúng/Sai | Mặc định Sai lúc tạo | Miễn chấm công |
| `cong_doan` | T khi tạo, **B** khi sửa | Đúng/Sai | Mặc định Đúng lúc tạo. Bị ép Sai khi ký hợp đồng khoán | Đoàn viên công đoàn |
| `so_tai_khoan` | T | Chuỗi ≤ 30 | — | Số tài khoản trả lương |
| `ten_tai_khoan` | T | Chuỗi ≤ 100 | — | Tên chủ tài khoản |
| `ngan_hang` | T | Chuỗi ≤ 128 | Chữ tự do, danh sách 20 ngân hàng ở giao diện chỉ là gợi ý | Ngân hàng |
| `ghi_chu` | T | Chuỗi ≤ 2000 | — | Ghi chú |
| `status` | T | `1` hoặc `0` | Mặc định `1` | `1` đang làm, `0` đã nghỉ |
| `ngay_nghi_viec` | **B khi chuyển sang đã nghỉ** | Ngày `YYYY-MM-DD` | `[CHƯA CÓ TRONG MÃ — cột mới]` Bắt buộc khi `status` chuyển từ `1` sang `0`; phải là ngày có thật và không sớm hơn `ngay_vao_lam`. Rỗng khi nhân viên đang làm | Ngày làm việc cuối cùng. Dùng để tự chốt hợp đồng và để phân hệ Lương biết cắt kỳ ở đâu (BR-hrm-054) |
| `da_xoa` | Hệ thống | Đúng/Sai | Mặc định Sai | Xóa mềm |
| `drive_folder_id` | Hệ thống | Chuỗi ≤ 64 | Tạo lười lúc tải file đầu tiên | ID thư mục riêng trên Drive công ty |

**Sáu trường hợp đồng hiện hành trong phản hồi API — tính lúc đọc, KHÔNG phải cột trong bảng:** `so_hop_dong`, `loai_hop_dong`, `kieu_luong`, `ngay_hieu_luc_toi`, `bhxh`, `tncn`. Nhân viên chưa có hợp đồng nào thì cả sáu trả về rỗng. Hai trường tra thêm: `ten_pb` và `so_npt`.

**Hai trường chỉ báo hồ sơ giấy tờ — cũng tính lúc đọc `[MỚI — QĐ #14]`:** `ho_so_du` (Đúng/Sai) và `giay_to_thieu` (danh sách loại giấy tờ còn thiếu). Cách tính ở BR-hrm-064. Nhân viên chưa có hợp đồng nào thì `ho_so_du` trả về rỗng chứ không trả Sai — không có loại hợp đồng thì không có bộ giấy tờ nào để đối chiếu.

> `loai_hop_dong` trong phản hồi nhân viên được **gom từ 5 giá trị về 3**: `thu_viec` giữ nguyên; `khoan` thành `hdvc`; mọi giá trị còn lại (`khong_xac_dinh`, `xac_dinh`, `thoi_vu`, và mọi giá trị lạ) thành `hdld`. Bảng lịch sử hợp đồng vẫn giữ nguyên giá trị gốc.

### 4.3 Hợp đồng lao động — `hrm_hop_dong`

| Trường | B/T | Kiểu | Ràng buộc thật | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `id` | Hệ thống | Chuỗi ≤ 64 | Sinh tự động khi tạo | Định danh kỹ thuật |
| `ma_nv` | **B** | Chuỗi ≤ 24 | Tự động in hoa. Nhân viên phải tồn tại và chưa xóa mềm. **Không sửa được** | Hợp đồng thuộc về ai |
| `so_hd` | **B** | Chuỗi 1–100 | Không được rỗng. **Duy nhất trong phạm vi một công ty** `[SỬA THEO QĐ #4 — mã hiện tại chưa có ràng buộc này]` | Số hợp đồng trên giấy |
| `loai_hd` | **B** | Chuỗi 1–24 | **Chữ tự do**, không ép danh sách. Giao diện gợi ý 5 giá trị | Loại hợp đồng |
| `kieu_luong` | **B** | `gross` hoặc `net` | Chỉ hai giá trị, chữ thường. Giao diện dùng `GROSS`/`NET` và tự quy đổi | Cách chịu thuế |
| `luong_chinh` | **B** | Số tiền | **Phải lớn hơn 0** `[SỬA THEO QĐ #5]`. Tối đa 2 số lẻ, trần 999.999.999.999,99 | Lương thỏa thuận của chính hợp đồng này |
| `luong_bhxh` | **B khi `trich_bhxh` bằng Đúng** | Số tiền | **Phải lớn hơn 0 khi `trich_bhxh` bằng Đúng** `[SỬA THEO QĐ #5]`; `trich_bhxh` bằng Sai thì cho để trống hoặc 0. Cùng trần và số lẻ như trên | Mức lương đóng BHXH |
| `ngay_bat_dau` | **B** | Ngày `YYYY-MM-DD` | Bắt buộc, phải là ngày có thật | Ngày hợp đồng có hiệu lực |
| `ngay_ket_thuc` | T | Ngày `YYYY-MM-DD` | Nếu có thì phải **bằng hoặc sau** ngày bắt đầu `[SỬA THEO QĐ #6 — bằng nhau nay được chấp nhận]`. Rỗng nghĩa là không xác định thời hạn | Ngày hết hạn |
| `trich_bhxh` | T | Đúng/Sai | Mặc định Đúng | Có trích đóng BHXH |
| `tinh_tncn` | T | Đúng/Sai | Mặc định Đúng | Có tính thuế TNCN |
| `ghi_chu` | T | Chuỗi ≤ 512 | — | Ghi chú |

Thân yêu cầu của **đổi hợp đồng** dùng đúng các trường trên, thêm `ngay_chot` (ngày `YYYY-MM-DD`, tùy chọn — bỏ trống khi nhân viên chưa có hợp đồng nào loại đó) và `loai_hd_can_chot` (chuỗi ≤ 24, **bắt buộc** — cho biết chốt hợp đồng thuộc loại nào, xem BR-hrm-053).

### 4.4 Người phụ thuộc — `hrm_nguoi_phu_thuoc`

| Trường | B/T | Kiểu | Ràng buộc thật | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `id` | Hệ thống | Chuỗi ≤ 64 | Sinh tự động | Định danh kỹ thuật |
| `ma_nv` | **B** | Chuỗi ≤ 24 | Tự động in hoa. Nhân viên phải tồn tại và chưa xóa mềm. **Không sửa được** | Người phụ thuộc của ai |
| `ho_ten` | **B** | Chuỗi 1–200 | Không được rỗng | Họ tên người phụ thuộc |
| `quan_he` | T | Chuỗi ≤ 50 | **Chữ tự do**. Giao diện gợi ý 8 giá trị: con, vợ/chồng, cha, mẹ, anh chị em, ông bà, cháu, khác | Quan hệ với nhân viên |
| `ngay_sinh` | T | **Chuỗi** `dd/MM/yyyy` | Lưu dạng chữ, không phải kiểu ngày. Vẫn kiểm phải là ngày có thật | Ngày sinh, nhiều hồ sơ chỉ nhớ ước lượng |
| `so_cccd` | T | Chuỗi ≤ 20 | — | Số căn cước |
| `mst` | T | Chuỗi | Phải đúng định dạng mã số thuế. **Duy nhất trong phạm vi một nhân viên** | Mã số thuế người phụ thuộc |
| `dien_thoai` | T | Chuỗi ≤ 20 | — | Số điện thoại |
| `dia_chi` | T | Chuỗi ≤ 255 | — | Địa chỉ |
| `dk_tu_thang` | T | Số nguyên 1–12 | Có tháng thì phải có năm | Tháng bắt đầu giảm trừ |
| `dk_tu_nam` | T | Số nguyên 2000–2100 | Có năm thì phải có tháng | Năm bắt đầu giảm trừ |
| `dk_den_thang` | T | Số nguyên 1–12 | Như trên | Tháng kết thúc giảm trừ |
| `dk_den_nam` | T | Số nguyên 2000–2100 | Như trên | Năm kết thúc giảm trừ |

Trường tính lúc đọc: `ten_nv` (tra từ `hrm_nhan_vien`, không lưu trùng).

### 4.5 Hồ sơ tài liệu — `hrm_tai_lieu`

| Trường | B/T | Kiểu | Ràng buộc thật | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `id` | Hệ thống | Chuỗi ≤ 64 | Sinh tự động | Định danh kỹ thuật |
| `ma_nv` | **B** | Chuỗi ≤ 24 | Tự động in hoa. Nhân viên phải tồn tại và chưa xóa mềm. **Không sửa được** | Giấy tờ của ai |
| `loai` | **B** | Chuỗi 1–50 | **Chữ tự do**. Giao diện gợi ý 5 loại: CCCD/CMND, hộ chiếu, bằng cấp, chứng chỉ, sơ yếu lý lịch | Loại giấy tờ |
| `so_hieu` | T | Chuỗi ≤ 64 | **Không bắt buộc, không duy nhất** | Số hiệu trên giấy tờ |
| `ngay_cap` | T | Ngày `YYYY-MM-DD` | Phải là ngày có thật. **Không chặn ngày tương lai** — xem OQ-hrm-09, còn mở | Ngày cấp |
| `ngay_het_han` | T | Ngày `YYYY-MM-DD` | `[CHƯA CÓ TRONG MÃ — cột mới, QĐ #14]` Phải là ngày có thật; có nhập thì phải **bằng hoặc sau** `ngay_cap`. Rỗng nghĩa là giấy tờ không có hạn (CCCD gắn chip vô thời hạn, bằng cấp) | Ngày hết hạn của giấy tờ, dùng để cảnh báo trước khi quá hạn (BR-hrm-062, BR-hrm-065) |
| `noi_cap` | T | Chuỗi ≤ 254 | — | Nơi cấp |
| `ghi_chu` | T | Chuỗi ≤ 512 | — | Ghi chú |
| `drive_file_id` | Hệ thống | Chuỗi ≤ 64 | Chỉ ghi qua thao tác tải file | Con trỏ file scan trên Drive |
| `ten_file` | Hệ thống | Chuỗi ≤ 254 | Ghi cùng lúc với con trỏ | Tên file gốc |
| `mime_type` | Hệ thống | Chuỗi ≤ 128 | Chỉ nhận 5 kiểu cho phép | Kiểu file |
| `kich_thuoc` | Hệ thống | Số nguyên (byte) | Trần 10.485.760 | Dung lượng |

Trường tính lúc đọc: `ten_nv` và `trang_thai_han` (`con_han` / `sap_het_han` / `da_het_han` / rỗng khi không có `ngay_het_han`) `[MỚI — QĐ #14]`, tính theo BR-hrm-065.

### 4.6 Danh mục bộ giấy tờ bắt buộc — `hrm_giay_to_bat_buoc` `[THỰC THỂ MỚI — QĐ #14]`

Bảng danh mục **riêng của từng công ty**, trả lời một câu duy nhất: nhân viên đang theo loại hợp đồng này thì hồ sơ phải có những loại giấy tờ nào. Chưa có dòng nào thì không công ty nào bị ép gì cả — chỉ báo đủ/thiếu trả về rỗng.

| Trường | B/T | Kiểu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `id` | Hệ thống | Chuỗi ≤ 64 | Sinh tự động | Định danh kỹ thuật |
| `loai_hd` | **B** | Chuỗi 1–24 | Chữ tự do, cùng miền giá trị với `hrm_hop_dong.loai_hd` | Quy định này áp cho loại hợp đồng nào |
| `loai_giay_to` | **B** | Chuỗi 1–50 | Chữ tự do, cùng miền giá trị với `hrm_tai_lieu.loai` | Loại giấy tờ cần có |
| `bat_buoc` | T | Đúng/Sai | Mặc định Đúng | Đúng là thiếu thì tính vào chỉ báo thiếu; Sai là chỉ nhắc, không tính thiếu |
| `ghi_chu` | T | Chuỗi ≤ 512 | — | Ghi chú, ví dụ căn cứ pháp lý |

Cặp (`loai_hd`, `loai_giay_to`) là **duy nhất trong một công ty** (E-hrm-061) — khai hai dòng cho cùng một cặp là dữ liệu mâu thuẫn, không phải hai yêu cầu khác nhau.

**Không chốt sẵn nội dung danh mục.** Đợt này chỉ làm khả năng khai báo; danh sách giấy tờ bắt buộc cụ thể cho từng loại hợp đồng là quyết định của người dùng nghiệp vụ, chưa có ai chốt — xem OQ-hrm-13. Cũng chưa chốt ngưỡng "sắp hết hạn" là bao nhiêu ngày và nơi lưu ngưỡng đó — xem OQ-hrm-14.

---

### 4.7 File scan của giấy tờ — `hrm_tai_lieu_file` `[MỚI — QĐ #21]`

Bảng con của `hrm_tai_lieu`. Một dòng giấy tờ có **nhiều** file; mỗi file là một dòng ở đây.

| Trường | B/T | Kiểu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| `id` | Hệ thống | Chuỗi | Sinh tự động | Khóa của file, dùng khi xem và gỡ đích danh |
| `tai_lieu_id` | **B** | Chuỗi | Khóa ngoại tới `hrm_tai_lieu`, xóa dòng giấy tờ thì xóa theo | Thuộc giấy tờ nào |
| `drive_file_id` | **B** | Chuỗi | Do Google cấp | Con trỏ file trên Drive của công ty |
| `ten_file` | **B** | Chuỗi ≤ 254 | Tên gốc người dùng tải lên | Để phân biệt "mặt trước" với "mặt sau" mà không cần mở file |
| `mime_type` | **B** | Chuỗi | Ảnh hoặc PDF (BR-hrm-036) | Quyết định xem được ngay trong ứng dụng hay phải tải về |
| `kich_thuoc` | **B** | Số | ≤ 10MB mỗi file | Hiện cho người dùng biết trước khi mở |
| `thu_tu` | Hệ thống | Số | Tăng dần theo lúc tải lên | Giữ thứ tự hiển thị ổn định: mặt trước tải trước thì luôn hiện trước |

**Bốn cột con trỏ file cũ trên `hrm_tai_lieu`** (`drive_file_id`, `ten_file`, `mime_type`, `kich_thuoc`) **bị bỏ** — dữ liệu chuyển sang bảng này. Xem `data-model.md` M-14.

---

## 5. Quy tắc nghiệp vụ

### 5.1 Định danh và sinh mã

**BR-hrm-001** — Mã phòng ban theo cây: cấp gốc là `PB` cộng hai chữ số (`PB01`, `PB02`…), cấp con là mã cha cộng dấu chấm cộng hai chữ số (`PB01.01`). Khi tạo, người dùng bỏ trống thì hệ thống cấp số nhỏ nhất chưa dùng ở cùng cấp, từ `01` đến `99`. Hết 99 số ở cùng cấp thì lấy bốn chữ số cuối của mốc thời gian làm đuôi. Mã vượt 24 ký tự bị từ chối kèm lời nhắc tự nhập mã ngắn hơn (E-hrm-015).

**BR-hrm-002** — Mã phòng ban đã xóa mềm **không bao giờ được cấp lại**. Bước sinh mã cố ý quét cả phòng ban `da_xoa = true`, vì mã đã nằm trên chứng từ kế toán; cấp lại là gán lịch sử của đơn vị này sang đơn vị khác.

**BR-hrm-003** — Mã nhân viên tự sinh theo dạng `NV` cộng bốn chữ số, lấy số nhỏ nhất chưa dùng từ `NV0001` đến `NV9999`. Chỉ mã đúng dạng đó mới tính vào bộ đếm; mã người dùng tự đặt (ví dụ `GD-01`) không làm lệch bộ đếm. Vượt 9999 nhân viên thì lấy sáu chữ số cuối của mốc thời gian.

**BR-hrm-004** — Mã nhân viên đã xóa mềm **không bao giờ được cấp lại**. Bước kiểm trùng cố ý **không** lọc cờ `da_xoa`, vì bảng lương và chấm công cũ khóa theo mã nhân viên; cấp lại là gán dữ liệu của người cũ sang người mới, im lặng và không cách nào phát hiện về sau.

**BR-hrm-005** — Mã phòng ban và mã nhân viên người dùng tự nhập luôn được đưa về chữ in hoa trước khi lưu và trước khi tra cứu. Cả hai **không sửa được sau khi tạo**; muốn đổi mã thì xóa rồi tạo lại.

### 5.2 Toàn vẹn cây phòng ban

**BR-hrm-006** — Phòng ban cha phải tồn tại và chưa bị xóa mềm tại thời điểm lưu.

**BR-hrm-007** — Không được chọn chính phòng ban đang thao tác làm phòng ban cha.

**BR-hrm-008** — Không được chọn một phòng ban thuộc nhánh dưới của mình làm cha. Hệ thống đi ngược chuỗi cha từ phòng ban được chọn lên gốc; gặp lại chính mình thì từ chối. Bước duyệt cũng là chốt an toàn khi dữ liệu cũ lỡ đã có vòng lặp.

**BR-hrm-009** — Không được xóa mềm một phòng ban khi: (a) còn ít nhất một phòng ban trực thuộc chưa xóa, hoặc (b) còn ít nhất một nhân viên chưa xóa trỏ vào — **tính cả nhân viên đã nghỉ việc**, vì hồ sơ người đã nghỉ vẫn trỏ vào phòng ban đó và còn dùng khi quyết toán thuế. Thông báo lỗi phải nói rõ cả tổng số lẫn số người đang làm và số người đã nghỉ, vì cột "Nhân viên" trên màn hình chỉ đếm người đang làm nên có thể hiện 0 mà vẫn bị chặn.

**BR-hrm-060** `[MỚI — QĐ #11]` — Chuyển phòng ban sang **ngừng hoạt động** (`status = 0`) khi còn nhân viên chưa xóa là **được phép**; máy chủ không chặn. Nhân viên đang thuộc phòng ban đó **giữ nguyên `ma_pb`**, không bị gỡ khỏi phòng ban và không bị đổi trạng thái. Giao diện phải hỏi xác nhận và nêu đích danh số nhân viên còn thuộc phòng ban (tách rõ số người đang làm và số người đã nghỉ, cùng cách đếm với BR-hrm-009) trước khi gửi yêu cầu. Đây là điểm khác với xóa mềm: xóa mềm bị chặn cứng, ngừng hoạt động thì chỉ cảnh báo.

**BR-hrm-061** `[MỚI — QĐ #11]` — Ô chọn phòng ban trong form nhân viên chỉ liệt kê phòng ban `status = 1` và `da_xoa = false`, **cộng thêm đúng phòng ban đang gán của chính nhân viên đang sửa** kể cả khi phòng đó đã ngừng hoạt động. Vế "cộng thêm" là bắt buộc: thiếu nó thì mở hồ sơ một nhân viên thuộc phòng ban đã ngừng hoạt động ra sửa tên, ô chọn không tìm thấy giá trị hiện tại nên hiện rỗng, và bấm Lưu là **âm thầm xóa mất phòng ban của người đó**. Phòng ban ngừng hoạt động được thêm vào phải hiện kèm nhãn cho biết đã ngừng hoạt động. Máy chủ **cố ý không** chặn `status = 0` (xem BR-hrm-016), vì chặn ở máy chủ thì chính hồ sơ nói trên không sửa được nữa.

### 5.3 Hồ sơ nhân viên

**BR-hrm-010** — Trạng thái nhân viên là tích của hai trục độc lập: `status` (`1` đang làm / `0` đã nghỉ) và `da_xoa`. "Đã nghỉ việc" là dữ liệu nhân sự thật; "đã xóa" là hồ sơ nhập nhầm. Gộp chung hai khái niệm sẽ khiến người nhập nhầm nằm lại trong báo cáo nhân sự vĩnh viễn.

**BR-hrm-011** — Xóa nhân viên là **xóa mềm**. Hợp đồng, người phụ thuộc và tài liệu của người đó **không bị xóa** mà bị ẩn, vì mọi truy vấn đọc của ba bảng con đều lọc theo nhân viên chưa xóa. Phản hồi phải trả kèm số người phụ thuộc bị ẩn theo để màn hình nói rõ thay vì làm âm thầm.

**BR-hrm-012** — Không đổi mã nhân viên tại chỗ. Các bảng con và các phân hệ lương/chấm công sau này đều trỏ vào mã này.

**BR-hrm-013** — Sửa nhân viên là **thay toàn bộ bản ghi**, không phải vá từng trường. Hai cờ `mien_cham_cong` và `cong_doan` là **bắt buộc** khi sửa (khác lúc tạo, có mặc định): thiếu trường thì hệ thống không phân biệt được "không gửi" với "gửi Đúng", và sẽ âm thầm bật lại công đoàn cho người đã cố ý tắt.

**BR-hrm-014** — Số CCCD, mã số thuế cá nhân, email và số điện thoại của nhân viên **không có ràng buộc duy nhất**. Hồ sơ được nhập dần, nhiều nhân viên chưa có giấy tờ tại thời điểm tạo.

**BR-hrm-015** — Mã số thuế cá nhân (nếu nhập) phải khớp định dạng mã số thuế Việt Nam; email (nếu nhập) phải đúng định dạng. Sai định dạng chặn ngay lúc nhập, không để tới lúc quyết toán hay lúc gửi thư mới vỡ.

**BR-hrm-016** — Phòng ban gán cho nhân viên phải tồn tại và chưa xóa mềm. Đây là tham chiếu mềm (cơ sở dữ liệu không ràng buộc), nên mọi đường ghi đều phải tự kiểm. Máy chủ **không** kiểm `status` của phòng ban — nhân viên vẫn gán được vào phòng ban đã ngừng hoạt động, và đó là chủ ý (BR-hrm-061).

**BR-hrm-017** — `ngay_vao_lam` là **bắt buộc** và thuộc về nhân viên, không thuộc hợp đồng: nó dùng tính thâm niên và phép năm, không đổi khi ký hợp đồng mới.

**BR-hrm-054** `[MỚI — QĐ #3]` — Chuyển nhân viên từ **đang làm** (`status = 1`) sang **đã nghỉ** (`status = 0`) **bắt buộc** phải kèm `ngay_nghi_viec`. Thiếu ngày nghỉ thì từ chối cả thao tác (E-hrm-052). `ngay_nghi_viec` phải là ngày có thật và **không được sớm hơn `ngay_vao_lam`** (E-hrm-053). Ngày nghỉ được phép nằm trong tương lai — báo trước nghỉ việc là chuyện thường; hệ thống không chặn. Nhân viên đang ở `status = 0` mà sửa các trường khác (không đổi trạng thái) thì không phải nhập lại ngày nghỉ, giá trị cũ giữ nguyên.

**BR-hrm-055** `[MỚI — QĐ #3]` — Cùng lượt ghi nhận nghỉ việc, hệ thống **tự chốt mọi hợp đồng còn mở** của nhân viên đó: hợp đồng có `ngay_ket_thuc` rỗng hoặc `ngay_ket_thuc` muộn hơn `ngay_nghi_viec` được đặt `ngay_ket_thuc = ngay_nghi_viec`. Việc đổi trạng thái nhân viên và việc chốt các hợp đồng phải nằm trong **cùng một giao dịch**: chốt được hợp đồng mà không đổi được trạng thái (hoặc ngược lại) là để lại dữ liệu nửa vời mà không có gì báo, và phân hệ Lương sẽ đọc trúng phần sai.

Ba nhánh phải xử lý rõ:
- Hợp đồng đã có `ngay_ket_thuc` **bằng hoặc sớm hơn** `ngay_nghi_viec` thì **giữ nguyên** — nó đã kết thúc trước khi người lao động nghỉ.
- Hợp đồng có `ngay_bat_dau` **muộn hơn** `ngay_nghi_viec` (hợp đồng ký trước cho tương lai, nhưng lại bắt đầu sau ngày nghỉ) thì **không chốt được**, vì đặt `ngay_ket_thuc = ngay_nghi_viec` sẽ vi phạm BR-hrm-026. Hệ thống **từ chối toàn bộ thao tác nghỉ việc**, không ghi gì cả, và trả E-hrm-054 nêu đích danh số hợp đồng đang vướng để người dùng tự xử lý hợp đồng đó trước. Không được tự xóa hợp đồng tương lai — xóa là thao tác phá hủy, không được làm thay người dùng.
- Nhân viên chưa có hợp đồng nào thì chỉ đổi trạng thái, không có gì để chốt, và **không** báo lỗi.

Hành vi khi đưa nhân viên từ **đã nghỉ** trở lại **đang làm** (tái tuyển dụng) chưa được chốt — xem OQ-hrm-12. Cho tới khi chốt, không được tự động xóa `ngay_nghi_viec` cũng không được tự động mở lại các hợp đồng đã chốt.

### 5.4 Hợp đồng lao động

**BR-hrm-018** — Một nhân viên có nhiều hợp đồng theo thời gian. Bảng hợp đồng là **nguồn sự thật duy nhất**; bảng nhân viên **không** giữ bản sao. Lý do bỏ bản sao: kết quả "hiện hành" phụ thuộc ngày hôm nay, mà bản sao chỉ được tính lại khi có người ghi hợp đồng, nên hợp đồng ký trước cho tương lai tới ngày hiệu lực vẫn đứng im ở hợp đồng cũ; ngoài ra form nhân viên ghi thẳng vào các cột đó nên sửa hồ sơ là âm thầm đè giá trị suy ra từ hợp đồng.

**BR-hrm-019** — Quy tắc chọn **hợp đồng hiện hành** khi đọc: trong danh sách hợp đồng của nhân viên đã sắp giảm dần theo ngày bắt đầu, lấy hợp đồng đầu tiên thỏa mãn `ngay_bat_dau <= hôm nay` **và** (`ngay_ket_thuc` rỗng **hoặc** `ngay_ket_thuc >= hôm nay`). Không có hợp đồng nào thỏa mãn thì lấy hợp đồng đầu danh sách, tức hợp đồng mới nhất trong lịch sử — kể cả khi nó chưa hiệu lực hoặc đã hết hạn.

Nhánh rơi về "hợp đồng mới nhất trong lịch sử" là **hành vi mong muốn, giữ nguyên** `[SỬA THEO QĐ #2]`: hợp đồng ký trước cho tương lai được coi là hiện hành **ngay khi ký**, để người vừa nhập xong nhìn thấy đúng thứ mình vừa nhập thay vì thấy một ô trống hoặc thấy hợp đồng cũ đã hết hạn.

Hệ quả bắt buộc phải nhớ: **nhãn "hợp đồng hiện hành" KHÔNG đồng nghĩa "đang hiệu lực hôm nay"**. Nó có thể đang trỏ vào một hợp đồng chưa tới ngày bắt đầu, hoặc một hợp đồng đã hết hạn. Vì vậy phân hệ Lương (và mọi thứ tính tiền về sau) **không được** tin thẳng sáu trường hợp đồng hiện hành trong phản hồi nhân viên, mà phải tự so `ngay_bat_dau` và `ngay_ket_thuc` với kỳ lương đang tính. Cột này phục vụ hiển thị, không phục vụ tính toán.

**BR-hrm-020** — Thứ tự sắp xếp chuẩn của lịch sử hợp đồng: `ngay_bat_dau` giảm dần, rồi thời điểm tạo giảm dần, rồi định danh giảm dần. Hai tiêu chí phụ là bắt buộc vì `ngay_bat_dau` không duy nhất; chỉ sắp theo mỗi ngày bắt đầu thì sửa một ô ghi chú của hợp đồng B cũng đủ làm "hợp đồng hiện hành" nhảy từ A sang B.

**BR-hrm-021** — Mốc "hôm nay" dùng để xét hiệu lực hợp đồng phải tính theo **giờ Việt Nam**, không theo lịch UTC. Từ 00:00 đến 06:59 giờ Việt Nam, lịch UTC vẫn đang ở ngày hôm trước; lệch một ngày ở đây là lệch kỳ lương. `[LỆCH TRONG MÃ]` — `chonHopDongHienHanh` dùng đúng mốc giờ Việt Nam, nhưng `doiHopDong` lại dùng nửa đêm theo lịch UTC (`hopDong.service.ts:233-234`).

**BR-hrm-022** `[SỬA THEO QĐ #1, #6 và #18]` — Tại một thời điểm, mỗi nhân viên chỉ được có **tối đa một hợp đồng đang hiệu lực cho MỖI NHÓM hợp đồng**. Hai hợp đồng **khác nhóm** được phép chạy song song — trường hợp có thật là một hợp đồng lao động chính cộng một hợp đồng khoán riêng.

**"Khác loại" nghĩa là khác NHÓM NGHIỆP VỤ, không phải khác nhãn** `[chốt QĐ #18, 2026-09-07]`. Ba nhóm, đúng cách hệ thống đang gom khi hiển thị:

| Nhóm | Gồm các nhãn `loai_hd` |
|---|---|
| Hợp đồng lao động | `khong_xac_dinh`, `xac_dinh`, `thoi_vu`, và **mọi nhãn lạ khác** |
| Khoán / dịch vụ | `khoan` |
| Thử việc | `thu_viec` |

Lý do không khóa theo nhãn gốc: một người vừa có hợp đồng *xác định thời hạn* vừa có hợp đồng *không xác định thời hạn* cùng chạy là **lỗi nhập liệu**, không phải nghiệp vụ hợp lệ. Khóa theo nhãn thì ba hợp đồng lao động chồng nhau lọt hết, và phân hệ Lương sẽ cộng ba mức lương.

**Hai việc bắt buộc kèm theo:**
1. **Chuẩn hóa `loai_hd` về chữ thường khi ghi.** Hiện trường này chỉ được cắt khoảng trắng, **không** in hoa hay hạ thường (khác `ma_nv` và `ma_pb` đều được in hoa). Không chuẩn hóa thì `Khoan` không khớp `khoan`, bị xếp nhầm sang nhóm hợp đồng lao động và lọt lưới.
2. **Phép gom nhóm phải là một hàm dùng chung duy nhất**, cùng nguồn với hàm đang dùng để hiển thị. Hai bản gom khác nhau là hai luật khác nhau.

Cụ thể: khoảng `[ngay_bat_dau, ngay_ket_thuc]` của một hợp đồng không được giao cắt với khoảng của hợp đồng khác **cùng `ma_nv` VÀ cùng nhóm**; `ngay_ket_thuc` rỗng coi như kéo tới vô hạn. Khoảng ngày là **khoảng đóng, tính cả hai đầu mút**: hai hợp đồng chạm nhau đúng một ngày (cái này kết thúc ngày X, cái kia bắt đầu ngày X) vẫn là chồng lấn. Vế này bắt buộc từ khi hợp đồng một ngày được cho phép (BR-hrm-026) — để hở đầu mút thì hợp đồng một ngày không bao giờ bị bắt chồng lấn.

Luật này phải được kiểm ở **cả ba đường ghi**: tạo hợp đồng, sửa hợp đồng và đổi hợp đồng; bước kiểm nằm trong cùng giao dịch với bước ghi. `[CHƯA CÓ TRONG MÃ]` — hiện không có kiểm tra chồng lấn ở bất kỳ đường ghi nào.

**BR-hrm-052** `[MỚI — QĐ #1]` — Khi một nhân viên có nhiều hợp đồng thuộc **các loại khác nhau** cùng đang hiệu lực, quy tắc chọn hợp đồng hiện hành (BR-hrm-019) vốn trả về **một** hợp đồng nên trở thành mơ hồ. Cách xử lý bắt buộc: quy tắc chọn hợp đồng hiện hành chạy **theo từng loại hợp đồng** trước, rồi mới chọn ra một hợp đồng để hiển thị trên danh sách nhân viên. Tiêu chí chọn giữa các loại **chưa được chốt** — xem OQ-hrm-11. Cho tới khi chốt, đường đọc **không được** ngầm dựa vào thứ tự trả về của cơ sở dữ liệu, vì thứ tự đó đổi theo cả thao tác sửa không liên quan (đúng lý do đã nêu ở BR-hrm-020).

Phân hệ Lương phải biết rằng một nhân viên có thể có **nhiều** hợp đồng cùng hiệu lực trong một kỳ, nên phải cộng theo danh sách hợp đồng chứ không lấy một hợp đồng duy nhất (xem A-hrm-09).

**BR-hrm-023** — Đổi hợp đồng là một giao dịch nguyên tử: chốt `ngay_ket_thuc` của hợp đồng đang hiệu lực bằng `ngay_chot`, rồi ghi hợp đồng mới. Hai việc phải cùng thành công — chốt xong mà tạo mới hỏng thì nhân viên mất hợp đồng.

**BR-hrm-024** `[SỬA THEO QĐ #1]` — Ràng buộc ngày của đổi hợp đồng: (a) nếu nhân viên đang có hợp đồng hiệu lực **thuộc loại cần chốt** thì **bắt buộc** phải gửi `ngay_chot`; (b) `ngay_chot` phải **sau** `ngay_bat_dau` của hợp đồng đang hiệu lực đó (bằng nhau bị từ chối); (c) `ngay_bat_dau` của hợp đồng mới phải **sau** `ngay_chot`; (d) nhân viên chưa có hợp đồng nào thuộc loại đó thì bỏ qua bước chốt và phản hồi phải báo theo việc **đã làm**, không theo thứ người dùng gửi lên.

Lý do cũ của vế (b) — bằng nhau sẽ tạo ra hợp đồng có ngày kết thúc trùng ngày bắt đầu, mà mọi lần sửa nó về sau đều bị chặn — **không còn đúng** kể từ QĐ #6 (hợp đồng một ngày nay hợp lệ). Vế (b) vẫn giữ nguyên trong đợt này để không đổi hành vi ngoài phạm vi đã chốt, nhưng cần chốt lại ở vòng rà sau — xem OQ-hrm-15.

**BR-hrm-053** `[MỚI — QĐ #1]` — Vì một nhân viên có thể có nhiều hợp đồng đồng thời khác loại, thao tác đổi hợp đồng **bắt buộc** phải cho biết đang chốt hợp đồng thuộc loại nào (`loai_hd_can_chot`). Máy chủ tìm hợp đồng đang hiệu lực **trong đúng loại đó** để chốt, không tìm trong toàn bộ lịch sử. Thiếu tham số này thì thao tác trở nên mơ hồ đúng kiểu lỗi âm thầm: đổi hợp đồng chính lại vô tình chốt mất hợp đồng khoán đang chạy song song. Thiếu trường thì trả lỗi kiểm dữ liệu (E-hrm-006).

**BR-hrm-025** — Luật công đoàn **một chiều**: khi ghi một hợp đồng có loại quy về hợp đồng dịch vụ (hiện tại là `khoan`), hệ thống đặt `cong_doan = false` cho nhân viên. Rời khỏi loại đó **không** tự bật lại, vì bật lại là bịa một quyết định thay người lao động. Luật bám theo loại hợp đồng **vừa ghi**, không theo hợp đồng hiện hành — hiện hành đổi theo thời gian, còn một lần tắt cờ thì phải dứt khoát tại thời điểm ký.

**BR-hrm-026** `[SỬA THEO QĐ #6]` — `ngay_ket_thuc` (nếu nhập) phải **bằng hoặc sau** `ngay_bat_dau`. Bằng nhau **được chấp nhận**, nghĩa là hợp đồng đúng một ngày là hợp lệ — hợp đồng khoán một ngày và hợp đồng thời vụ ngắn là chuyện có thật, chặn là chặn oan. Kéo theo hai việc bắt buộc: (a) luật chống chồng lấn phải dùng khoảng ngày bao gồm cả hai đầu mút (BR-hrm-022); (b) wording lỗi E-hrm-019 phải đổi cho khớp, không còn nói là phải sau.

**BR-hrm-027** `[SỬA THEO QĐ #4]` — Loại hợp đồng là **chữ tự do** (tối đa 24 ký tự). Bảng lịch sử giữ đủ 5 giá trị giao diện gợi ý để không mất thông tin; việc gom về 3 nhóm chỉ xảy ra khi trả kết quả cho màn nhân viên. Riêng quy tắc cũ "số hợp đồng không duy nhất" đã bị thay bằng BR-hrm-056.

**BR-hrm-056** `[MỚI — QĐ #4]` — `so_hd` là **duy nhất trong phạm vi một công ty** (một tenant), không phải chỉ duy nhất trong phạm vi một nhân viên. Hai hợp đồng khác nhau mang cùng số hợp đồng là chứng từ lao động mâu thuẫn: không đối chiếu được với bản giấy, và khi cơ quan bảo hiểm hoặc thuế hỏi số hợp đồng thì không biết đang nói tới hợp đồng nào. So khớp trùng theo **đúng chuỗi sau khi cắt khoảng trắng hai đầu**, có phân biệt chữ hoa chữ thường (cùng cách so sánh với khóa duy nhất ở cơ sở dữ liệu), không chuẩn hóa gì thêm.

Ràng buộc đặt ở **cả hai tầng**, giống cách đã làm với người phụ thuộc: kiểm ở tầng ứng dụng để trả lỗi nghiệp vụ nêu rõ hợp đồng nào đang giữ số đó (E-hrm-055), và khóa duy nhất ở cơ sở dữ liệu làm chốt cuối khi hai yêu cầu vào cùng lúc (E-hrm-007). Khi sửa hợp đồng, bước kiểm trùng phải bỏ qua chính dòng đang sửa.

**Cảnh báo dữ liệu, phải làm trước khi bật ràng buộc:** dữ liệu đang chạy ở các tenant chưa từng bị chặn trùng `so_hd`, nên rất có thể đã có số trùng. Phải rà toàn bộ tenant và dọn sạch **trước** khi chạy migration thêm khóa duy nhất, nếu không migration sẽ hỏng giữa chừng. Việc rà này gộp chung một đợt với việc rà mã số thuế người phụ thuộc của BR-hrm-030 để chỉ phải dừng dịch vụ một lần.

**BR-hrm-028** `[SỬA THEO QĐ #5]` — Lương chính và lương đóng BHXH: không âm, tối đa 2 số lẻ (khớp kiểu số thập phân 18 chữ số 2 số lẻ — quá 2 số lẻ thì cơ sở dữ liệu làm tròn im lặng), trần 999.999.999.999,99. Ràng buộc bắt buộc và ngưỡng lớn hơn 0 xem BR-hrm-057 và BR-hrm-058.

**BR-hrm-057** `[MỚI — QĐ #5]` — `luong_chinh` là **bắt buộc và phải lớn hơn 0** ở mọi đường ghi hợp đồng (tạo, sửa, đổi hợp đồng). Không có mức lương thỏa thuận thì không phải là hợp đồng lao động; và số 0 chảy thẳng vào bảng lương thành "trả 0 đồng" mà không có gì báo. Vi phạm trả E-hrm-056.

**BR-hrm-058** `[MỚI — QĐ #5]` — Khi `trich_bhxh` bằng Đúng thì `luong_bhxh` là **bắt buộc và phải lớn hơn 0**. Trích đóng BHXH trên mức 0 là mâu thuẫn tự thân: hoặc là không đóng, hoặc là phải có mức đóng. Khi `trich_bhxh` bằng Sai thì `luong_bhxh` được để trống hoặc bằng 0. Vi phạm trả E-hrm-057.

**Cảnh báo dữ liệu, phải làm trước khi bật hai ràng buộc trên:** dữ liệu cũ, đặc biệt các dòng sinh từ `be_maxv/src/scripts/backfill-hop-dong.ts`, nhiều khả năng đang để `luong_chinh = 0` và `luong_bhxh = 0`. Bật validator mà chưa dọn thì **mọi lần sửa một hợp đồng cũ đều thất bại**, kể cả khi người dùng chỉ sửa một ô ghi chú — vì đường sửa là thay toàn bộ bản ghi chứ không vá từng trường. Phải rà và dọn dữ liệu lương 0 ở tất cả tenant trước, hoặc chốt cách xử lý riêng cho dòng cũ, trước khi bật.

**BR-hrm-029** — Xóa hợp đồng là **xóa cứng**: dòng biến mất khỏi cơ sở dữ liệu, không hoàn tác được, không có ràng buộc theo trạng thái hiệu lực. Sau khi xóa không cần cập nhật gì ở bảng nhân viên vì hợp đồng hiện hành tính lúc đọc. `[CẦN XEM LẠI]` — xem Mục 11, phương án 2.

### 5.5 Người phụ thuộc

**BR-hrm-030** `[SỬA THEO QĐ #7 và QĐ #19]` — Trong **phạm vi một công ty**, không được để hai người phụ thuộc mang cùng mã số thuế có **kỳ giảm trừ giao nhau** — kể cả khi hai dòng đó thuộc **hai nhân viên khác nhau**.

Luật thuế TNCN quy định mỗi người phụ thuộc chỉ được tính giảm trừ cho **một** người nộp thuế **tại một thời điểm**. Vế "tại một thời điểm" là điểm chốt của QĐ #19: chặn phẳng theo mã số thuế sẽ **chặn oan** một nghiệp vụ có thật và hợp pháp — vợ chồng cùng công ty đổi người kê khai giữa năm, hoặc người kê khai cũ đã nghỉ việc và người mới nhận kê khai từ tháng sau.

Cụ thể: khoảng `[tu_thang/tu_nam, den_thang/den_nam]` của một dòng không được giao cắt với khoảng của dòng khác **cùng mã số thuế trong cùng công ty**; kỳ kết thúc rỗng coi như kéo tới vô hạn. Khoảng tính theo **tháng**, đóng ở cả hai đầu — hai kỳ chạm nhau đúng một tháng vẫn là giao nhau, vì trong tháng đó cả hai người nộp thuế đều được giảm trừ.

Đăng ký nối tiếp thì hợp lệ: A kê khai tới hết tháng 6, B kê khai từ tháng 7 — hai dòng cùng tồn tại, **giữ được lịch sử kê khai** của cả năm, đúng thứ cần khi quyết toán.

Ràng buộc đặt ở **cả hai tầng**: kiểm ở tầng ứng dụng để nói rõ **nhân viên nào** đang giữ mã số thuế đó (E-hrm-026), và khóa duy nhất ở cơ sở dữ liệu làm chốt cuối khi hai yêu cầu vào cùng lúc (E-hrm-007). Người phụ thuộc chưa có mã số thuế thì nhập được nhiều dòng, vì chỉ chặn khi đã biết mã số thuế. Khi sửa, bước kiểm trùng bỏ qua chính dòng đang sửa.

Kiểm trùng **bỏ qua** người phụ thuộc thuộc nhân viên `da_xoa = true`, theo đúng tinh thần "hồ sơ đã xóa là hồ sơ nhập nhầm" (BR-hrm-010) — giữ lại thì một lần nhập nhầm sẽ khóa vĩnh viễn mã số thuế đó khỏi cả công ty. Điều này áp cho **cả hai tầng**: ràng buộc ở cơ sở dữ liệu cũng phải loại trừ dòng của nhân viên đã xóa mềm, nếu không hai tầng sẽ nói khác nhau và người dùng nhận thông báo lỗi chung chung thay vì thông báo nghiệp vụ rõ ràng.

**Cảnh báo dữ liệu, phải làm trước khi bật ràng buộc:** khóa duy nhất hiện tại là cặp (`ma_nv`, `mst`), nên dữ liệu đang chạy hoàn toàn có thể đã có cùng một mã số thuế ở hai nhân viên. Phải rà và dọn ở mọi tenant **trước** khi chạy migration, nếu không migration sẽ hỏng. Gộp chung một đợt rà với BR-hrm-056.

**BR-hrm-031** — Kỳ đăng ký giảm trừ: tháng phải đi kèm năm và ngược lại; khi có đủ bốn mốc thì kỳ "đến" phải sau hoặc bằng kỳ "từ" (so theo `năm × 12 + tháng`).

**BR-hrm-032** — Ngày sinh người phụ thuộc lưu dạng **chuỗi** `dd/MM/yyyy` (khác nhân viên dùng kiểu ngày), theo đúng yêu cầu nghiệp vụ vì nhiều hồ sơ chỉ nhớ áng chừng. Dù lưu chuỗi vẫn phải kiểm là ngày có thật — đối chiếu ngược từng phần, vì dựng ngày `30/02` không báo lỗi mà tự trôi sang tháng sau.

**BR-hrm-033** — Không chuyển người phụ thuộc sang nhân viên khác bằng cách sửa. Muốn chuyển thì xóa rồi tạo lại để có vết. Xóa người phụ thuộc là **xóa cứng**.

### 5.6 Hồ sơ tài liệu và file scan

**BR-hrm-034** `[SỬA THEO QĐ #14]` — Loại giấy tờ vẫn là **chữ tự do** (tối đa 50 ký tự), không ép danh sách cố định. Danh sách 5 loại ở giao diện chỉ là gợi ý; hồ sơ nhân sự thực tế còn giấy khám sức khỏe, sổ BHXH, quyết định bổ nhiệm… Ép danh sách là chặn oan những thứ có thật. Số hiệu **không bắt buộc** vì có loại giấy tờ không mang số hiệu, và **không duy nhất**. Khái niệm "hồ sơ đủ hay thiếu" được làm bằng một danh mục khai báo riêng (BR-hrm-063), **không** bằng cách siết miền giá trị của trường này. Việc đối chiếu giữa `hrm_tai_lieu.loai` và `hrm_giay_to_bat_buoc.loai_giay_to` là so khớp **đúng chuỗi sau khi cắt khoảng trắng hai đầu**; hai bên nhập lệch nhau một ký tự thì hệ thống hiểu là hai loại khác nhau, nên ô nhập loại giấy tờ ở giao diện phải gợi ý sẵn các giá trị đã có trong danh mục.

**BR-hrm-035** — File tải lên chỉ nhận 5 kiểu: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`. Đây là hồ sơ giấy tờ, không phải kho file chung.

**BR-hrm-036** — Trần dung lượng **10 MB mỗi file**, mỗi lần tải lên đúng **một** file. Trần được áp ở ba nơi: giao diện kiểm trước khi gửi, tầng nhận file của máy chủ chặn cứng, và tầng nghiệp vụ kiểm lại. Đường **tải file về** cũng áp cùng trần, vì file nằm trên Drive của khách nên họ thay bằng file khổng lồ lúc nào cũng được.

**BR-hrm-037** `[SỬA THEO QĐ #21]` — Mỗi dòng tài liệu giữ được **nhiều file scan**. Một giấy tờ trong thực tế thường gồm nhiều ảnh: căn cước có hai mặt, bằng cấp và hợp đồng giấy có nhiều trang. Bắt mỗi ảnh một dòng thì danh sách hiện ra ba dòng cùng tên "CCCD" và người đọc không biết đó là một giấy tờ hay ba giấy tờ khác nhau — sai bản chất nghiệp vụ.

Tải thêm file lên một dòng đã có file là **THÊM VÀO**, không phải thay thế. Muốn bỏ một file thì gỡ đích danh file đó (BR-hrm-038).

Mỗi file vẫn giữ giới hạn riêng: ảnh hoặc PDF, tối đa 10MB (BR-hrm-036). Số file trên một dòng **tối đa 20** — đủ cho mọi giấy tờ nhân sự có thật, và đủ chặt để một lần thao tác nhầm không đẩy hàng trăm file lên Drive của khách. Vượt quá trả E-hrm-065.

> **Đây là thay đổi mô hình dữ liệu**, không phải đổi giao diện: bốn cột con trỏ file trên `hrm_tai_lieu` chuyển thành bảng con `hrm_tai_lieu_file` (Mục 4.7). Dữ liệu đang có phải được chuyển sang bảng mới **trước** khi bỏ bốn cột cũ — xem `data-model.md` M-14.

**BR-hrm-038** `[SỬA THEO QĐ #21]` — Gỡ file khỏi tài liệu là gỡ **đúng một file được chỉ định**: xóa file trên Drive **và** xóa dòng trong bảng file, giữ nguyên dòng giấy tờ và các file còn lại. Gỡ file cuối cùng thì dòng giấy tờ trở về trạng thái chưa đính file, **không** bị xóa theo.

**BR-hrm-039** `[SỬA THEO QĐ #12 và #21]` — Xóa cả dòng tài liệu là **xóa cứng** dòng trong cơ sở dữ liệu, **và xóa luôn MỌI file scan** của dòng đó trên Google Drive. Không để lại file mồ côi. Xóa từng file là cố-hết-sức: Drive báo lỗi ở một file thì ghi log và vẫn xóa dòng, không để sự cố bên ngoài chặn thao tác nghiệp vụ. Hộp xác nhận phải nêu **số file** sắp mất.

Ba ràng buộc kèm theo:
- Xóa trên Drive theo kiểu **cố hết sức**: Drive báo lỗi thì vẫn xóa dòng và ghi lỗi vào nhật ký máy chủ, **không** để lỗi Drive chặn việc xóa dòng. Lý do: dòng dữ liệu là thứ người dùng nhìn thấy và muốn bỏ đi; giữ lại dòng chỉ vì Drive đang hỏng là làm người dùng bấm lại nhiều lần mà không hiểu vì sao.
- Vì thao tác **không hoàn tác được**, hộp xác nhận ở giao diện phải nêu đích danh **tên file sắp mất**, không được dùng câu chung chung "bạn có chắc muốn xóa".
- Thao tác này thuộc nhóm phải ghi nhật ký (BR-hrm-066).

`[CHƯA CÓ TRONG MÃ]` — hiện `DELETE /hrm/tai-lieu/:id` chỉ xóa dòng, không gọi Google (`taiLieu.service.ts:124-135`). Việc dọn các file đã thành mồ côi từ trước khi sửa nằm ngoài phạm vi quy tắc này.

**BR-hrm-062** `[MỚI — QĐ #14]` — Mỗi dòng giấy tờ có thêm `ngay_het_han` **tùy chọn**. Có nhập thì phải là ngày có thật và **bằng hoặc sau** `ngay_cap` (E-hrm-060); bằng nhau được chấp nhận vì có loại giấy tờ chỉ có giá trị trong ngày cấp. Để trống nghĩa là giấy tờ không có hạn (CCCD gắn chip vô thời hạn, bằng tốt nghiệp), **không** phải nghĩa là chưa biết hạn — hai chuyện đó hiện không phân biệt được và đợt này chấp nhận như vậy.

**BR-hrm-063** `[MỚI — QĐ #14]` — Mỗi công ty tự khai **bộ giấy tờ bắt buộc theo loại hợp đồng** trong danh mục `hrm_giay_to_bat_buoc` (Mục 4.6): loại hợp đồng nào thì cần những loại giấy tờ nào, mỗi dòng có cờ bắt buộc. Cặp (`loai_hd`, `loai_giay_to`) duy nhất trong một công ty (E-hrm-061). Danh mục **rỗng là trạng thái hợp lệ** — công ty chưa khai thì không ai bị coi là thiếu hồ sơ. Hệ thống **không** cài sẵn nội dung danh mục cho bất kỳ công ty nào; nội dung cụ thể là quyết định nghiệp vụ chưa chốt (OQ-hrm-13).

**BR-hrm-064** `[MỚI — QĐ #14]` — Chỉ báo **hồ sơ đủ/thiếu** của một nhân viên được tính lúc đọc theo bốn bước:
1. Lấy danh sách **loại hợp đồng đang hiệu lực** của nhân viên đó theo BR-hrm-019 và BR-hrm-052.
2. Lấy hợp của các bộ giấy tờ bắt buộc khai cho những loại hợp đồng đó, chỉ giữ dòng có `bat_buoc` bằng Đúng. Lấy **hợp** chứ không lấy giao: mỗi hợp đồng đang chạy đều phát sinh nghĩa vụ hồ sơ của riêng nó.
3. `giay_to_thieu` là các loại trong bộ đó mà nhân viên **không có dòng `hrm_tai_lieu` nào** cùng loại. `ho_so_du` bằng Đúng khi `giay_to_thieu` rỗng.
4. Nhân viên **chưa có hợp đồng nào** thì `ho_so_du` trả về **rỗng** (không phải Sai) và `giay_to_thieu` rỗng — không có loại hợp đồng thì không có gì để đối chiếu.

Chỉ báo này **cố ý chỉ xét có hay không có dòng giấy tờ**, không xét dòng đó đã có file scan chưa và không xét giấy tờ còn hạn hay hết hạn. Hạn giấy tờ là một chỉ báo riêng (BR-hrm-065). Gộp hai thứ vào một cột sẽ khiến người dùng thấy "hồ sơ thiếu" mà mở ra vẫn thấy đủ dòng, không hiểu vì sao.

**BR-hrm-065** `[MỚI — QĐ #14]` — Trạng thái hạn của một dòng giấy tờ được tính lúc đọc, so `ngay_het_han` với hôm nay theo **giờ Việt Nam** (cùng mốc với BR-hrm-021):
- `ngay_het_han` rỗng thì trạng thái rỗng — giấy tờ không có hạn, không cảnh báo gì.
- `ngay_het_han` **sớm hơn** hôm nay thì `da_het_han`.
- `ngay_het_han` từ hôm nay tới hôm nay cộng **ngưỡng cảnh báo của công ty** thì `sap_het_han`.
- Còn lại thì `con_han`.

**Ngưỡng cảnh báo chưa được chốt** (bao nhiêu ngày, khai ở đâu) — xem OQ-hrm-14. Cho tới khi chốt, hệ thống **chỉ** phân biệt `con_han` và `da_het_han`; **không** được tự đặt một con số mặc định rồi cảnh báo theo nó. Danh sách cảnh báo (FR-hrm-041) tính trên toàn bộ nhân viên chưa xóa mềm, kể cả nhân viên đã nghỉ việc — giấy tờ của người đã nghỉ vẫn còn dùng khi quyết toán.

### 5.7 Google Drive cấp doanh nghiệp

**BR-hrm-040** — Google Drive được liên kết ở **cấp doanh nghiệp**, không phải cấp người dùng. Token nằm ở bảng công ty trong cơ sở dữ liệu điều phối, mã hóa bằng AES-256-GCM với cùng khóa dùng cho thông tin đăng nhập cổng thuế. Máy chủ chưa cấu hình khóa mã hóa thì **từ chối lưu kết nối**, thà từ chối còn hơn để token mở được toàn bộ file nằm trần trong cơ sở dữ liệu.

**BR-hrm-041** — Phạm vi quyền xin của Google chỉ gồm `drive.file` (app chỉ thấy file do chính nó tạo, không đọc được dữ liệu Drive sẵn có của khách) và `email` (để người dùng biết file của mình nằm ở Drive của tài khoản nào). Đây là phạm vi không nhạy cảm, không phải qua kiểm định CASA.

**BR-hrm-042** — Cây thư mục trên Drive của khách: `maxv` / `<mã số thuế> - <tên công ty>` / `<mã nhân viên> - <họ tên>` / các file scan. Cả hai cấp đều **tạo lười** và **nhớ theo ID**, không bao giờ tra theo tên: Drive cho phép trùng tên, và khách đổi tên hay kéo thả thư mục lúc nào cũng được.

**BR-hrm-043** — Vé `state` của luồng OAuth được ký HMAC (có tiền tố tách miền để không dùng chung không gian với vé đăng nhập), mang mã công ty và hạn dùng **10 phút**, đồng thời được khóa vào đúng trình duyệt đã xin nó bằng một cookie riêng. Cookie bị **xóa ngay ở đầu callback, trước mọi nhánh trả về** — mỗi vé đi được đúng một lần, từ đúng một máy. Trang callback trả HTML tự dựng nên mọi chuỗi từ bên ngoài đưa vào trang phải được thoát ký tự, kèm chính sách bảo mật nội dung chỉ cho chạy script mang đúng mã dùng một lần.

**BR-hrm-044** — Ba endpoint Drive không đi qua cơ sở dữ liệu công ty nên **phải tự kiểm lại quyền vào công ty trong cơ sở dữ liệu**, không tin thẳng mã công ty trong vé đăng nhập: vé sống 15 phút và cố ý không đối chiếu cơ sở dữ liệu mỗi lần gọi, nên người vừa bị gỡ quyền vẫn cầm một vé hợp lệ tới hết hạn. Guard theo gói dịch vụ không lấp được chỗ này vì nó xét gói của chủ tài khoản, không xét quyền vào từng công ty.

**BR-hrm-045** `[SỬA THEO QĐ #10]` — Chỉ **chủ tài khoản** (`OWNER`) mới được **kết nối lần đầu**, **đổi** sang tài khoản Google khác, hoặc **ngắt** kết nối. Cả ba việc đều quyết định kho tài liệu của **cả công ty** nằm ở Drive của ai; để người khác làm là để hồ sơ scan của công ty rơi vào tài khoản Google cá nhân của một nhân viên, mà công ty không có cách nào lấy lại khi người đó nghỉ.

Vế "kết nối lần đầu ai cũng làm được" của bản cũ đã bị bỏ. Quyền được kiểm ở bước **phát vé** `GET /tai-lieu/drive/lien-ket`; vé `state` phải mang theo dấu hiệu người phát là chủ tài khoản để bước callback kiểm lại, không tin thẳng vé (cùng tinh thần BR-hrm-044). Cách hiện thực dấu hiệu đó là việc của Architect.

**Sau khi đã nối xong, mọi người có quyền vào công ty đều dùng được kho tài liệu**: tải file lên, xem file, gỡ file đều giữ nguyên cho cả `OWNER` và `OWNER_EMPLOYEE`. Siết là siết ở việc *chọn kho*, không phải ở việc *dùng kho*.

**Yêu cầu bắt buộc với giao diện:** người không phải chủ tài khoản **không được** thấy nút "Kết nối Google Drive" rồi bấm vào và nhận 403. Màn hồ sơ giấy tờ của công ty chưa kết nối phải hiện thẳng thông báo dạng "Công ty chưa liên kết Google Drive — nhờ chủ tài khoản liên kết để đính được file scan", kèm email chủ tài khoản nếu biết. Trả 403 cho một nút hiện sẵn là kiểu lỗi làm người dùng tưởng hệ thống hỏng (E-hrm-059).

**BR-hrm-046** — Hệ thống chỉ **tự ngắt** kết nối Drive khi Google trả đúng mã `invalid_grant` (khách đã gỡ quyền trong tài khoản Google). Không được bắt theo cả dải 4xx: cùng endpoint đó còn trả 4xx cho `invalid_client` khi người vận hành đổi khóa bí mật mà cập nhật cấu hình sai, và 429 khi nhiều công ty tải file cùng lúc. Bắt theo dải thì một lần gõ nhầm cấu hình sẽ xóa token của **toàn bộ** công ty, sửa lại cấu hình cũng không cứu được.

**BR-hrm-047** — Đổi sang tài khoản Google **khác** thì xóa ID thư mục gốc và mọi ID thư mục nhân viên đã nhớ, để cây thư mục dựng lại trong Drive mới. Cố ý **không** đụng con trỏ file của các tài liệu cũ: file không tìm lại được theo tên như thư mục, xóa con trỏ là xóa luôn dấu vết khách từng đính giấy tờ gì. Nối lại đúng tài khoản cũ thì không dọn gì, vì mọi ID vẫn dùng được.

**BR-hrm-048** — Không khẳng định "file đã bị xóa" khi Drive trả 404. Với phạm vi quyền `drive.file`, 404 xảy ra cho cả trường hợp file vẫn còn nguyên nhưng nằm ở tài khoản Google đã kết nối trước đây. Nói chắc là mất sẽ làm khách tưởng mất giấy tờ thật.

### 5.8 Đa công ty và truy cập

**BR-hrm-049** — Mọi endpoint HRM đều yêu cầu đăng nhập **và** gói thuê bao có module `hrm`. Ngoại lệ duy nhất là callback OAuth của Google, tự xác thực bằng vé ký HMAC.

**BR-hrm-050** — Dữ liệu HRM nằm trong cơ sở dữ liệu riêng của công ty đang chọn. Mỗi lần gọi đều tra lại quyền trong cơ sở dữ liệu điều phối trước khi chọn kết nối, vì vé đăng nhập có thể đã cũ hơn quyền thật.

**BR-hrm-051** `[SỬA THEO QĐ #9]` — Vai trò `ADMIN` **không** truy cập được dữ liệu HRM của công ty khách: quy tắc phạm vi chỉ định nghĩa cho `OWNER` và `OWNER_EMPLOYEE`, mọi vai trò khác bị từ chối ngay ở bước chọn cơ sở dữ liệu.

Đây là **quyết định có chủ đích, không phải thiếu sót**. Hồ sơ nhân sự chứa số căn cước, mã số thuế cá nhân, số tài khoản ngân hàng và mức lương của người lao động — đội vận hành MAXV không có lý do nghiệp vụ nào để đọc những thứ đó. Đổi lại, việc hỗ trợ khách qua giao diện phải đi đường khác (khách chia sẻ màn hình, hoặc khách tự cấp quyền vào công ty cho người hỗ trợ). **Không được nới quy tắc này vì lý do "cho tiện hỗ trợ"**; muốn nới thì phải mở một quyết định nghiệp vụ mới và ghi ADR.

**BR-hrm-059** `[MỚI — QĐ #8]` — **Dữ liệu lương chỉ hiện cho người được cấp quyền xem dữ liệu lương.** Quyền này nằm **bên trong** phạm vi `OWNER_EMPLOYEE`; `OWNER` luôn có sẵn; `ADMIN` không liên quan (BR-hrm-051). Phạm vi che gồm: `luong_chinh`, `luong_bhxh`, `so_tai_khoan`, `ten_tai_khoan`, `ngan_hang`, và toàn bộ nhóm endpoint hợp đồng.

Ba yêu cầu cụ thể:
1. `GET /hop-dong` **bắt buộc** phải lọc theo đúng một nhân viên; gọi không kèm mã nhân viên là lỗi kiểm dữ liệu (E-hrm-006), không còn trả về toàn bộ hợp đồng của công ty. Người không có quyền xem dữ liệu lương gọi nhóm endpoint hợp đồng thì nhận 403 (E-hrm-058).
2. Trong phản hồi danh sách và chi tiết nhân viên, người không có quyền vẫn đọc được các trường hành chính, nhưng các trường lương và tài khoản ngân hàng phải **vắng mặt hoặc rỗng**, không phải trả về rồi để giao diện tự giấu.
3. **Máy chủ và giao diện phải sửa cùng một lúc.** Giao diện hiện đang gọi danh sách hợp đồng không tham số rồi tự lọc phía trình duyệt; siết máy chủ trước mà chưa sửa giao diện là làm trắng màn lịch sử hợp đồng của mọi người dùng ngay lập tức.

### 5.9 Nhật ký thao tác

**BR-hrm-067** `[MỚI — vòng phản biện 2026-09-07]` — Trong thân yêu cầu **sửa** nhân viên, `status` là **bắt buộc**, không được có giá trị mặc định. Lý do giống hệt lý do đã áp cho `mien_cham_cong` và `cong_doan`: yêu cầu sửa thay **toàn bộ** bản ghi, mà tầng kiểm dữ liệu không phân biệt được "không gửi" với "gửi giá trị mặc định". Hiện `status` vẫn mang mặc định `'1'`, nên **một yêu cầu sửa thiếu `status` sẽ âm thầm đưa nhân viên đã nghỉ trở lại đang làm** — trong khi ngày nghỉ và các hợp đồng đã bị chốt vẫn nằm nguyên. Đây chính là nhánh ngược mà OQ-hrm-12 tuyên bố chưa chốt, nhưng nó **đang đi được ngay hôm nay** bằng một lần thiếu trường. Thiếu `status` phải trả lỗi kiểm dữ liệu (E-hrm-006).

**BR-hrm-069** `[MỚI — QĐ #17]` — Khi bật quyền xem dữ liệu lương lần đầu, **mọi người dùng đang có quyền vào công ty được giữ nguyên khả năng xem lương**; từ thời điểm đó trở đi, người được cấp quyền vào công ty **mới** thì mặc định **không** được xem lương và phải được cấp riêng.

Nói cách khác: cột quyền mang giá trị mặc định là *không được xem*, nhưng bước chuyển dữ liệu của lần bật đầu tiên **cấp quyền cho toàn bộ bản ghi phân quyền đang tồn tại**. Đây là cách chuẩn khi siết quyền trên một hệ thống đang chạy: không ai mất việc trong ngày triển khai, mà từ đó về sau thì quyền chỉ được cấp có chủ đích. Chủ tài khoản thu hồi dần cho người không cần.

Phương án siết tất rồi cấp lại từ đầu đã bị loại: nó làm **mọi kế toán đang làm việc mất màn hợp đồng cùng lúc**, trong khi màn cấp quyền có thể chưa kịp lên.

**BR-hrm-068** `[MỚI — QĐ #8, vòng phản biện 2026-09-07]` — Quyền xem dữ liệu lương phải được **tra lại từ cơ sở dữ liệu ở mỗi lượt gọi**, cùng cách và cùng lúc với việc tra quyền vào công ty (BR-hrm-050). **Không** được lưu quyền này vào vé đăng nhập: vé sống 15 phút và cố ý không đối chiếu dữ liệu mỗi lượt, nên thu hồi quyền sẽ trễ tới 15 phút mà không có gì báo. Không phải đánh đổi hiệu năng: mỗi lượt gọi HRM vốn đã tra bảng phân quyền công ty, chỉ cần lấy thêm cờ này trong cùng truy vấn đó.

**BR-hrm-066** `[MỚI — QĐ #15]` — Hệ thống ghi nhật ký **người thao tác** cho đúng **năm** nhóm thao tác sau, và chỉ năm nhóm này:

| # | Thao tác | Vì sao phải ghi |
|---|---|---|
| 1 | Xóa hợp đồng lao động | Xóa cứng, không hoàn tác, mất chứng từ lao động |
| 2 | Sửa lương của hợp đồng (`luong_chinh` hoặc `luong_bhxh` đổi giá trị) | Số tiền chảy thẳng vào bảng lương |
| 3 | Xóa người phụ thuộc | Ảnh hưởng giảm trừ gia cảnh, tức là ảnh hưởng thuế TNCN |
| 4 | Xóa dòng tài liệu | Kéo theo xóa file scan trên Drive, không hoàn tác (BR-hrm-039) |
| 5 | Ngắt kết nối Google Drive của công ty | Cắt kho tài liệu của cả công ty |

Mỗi bản ghi nhật ký lưu tối thiểu: thời điểm, người thao tác, công ty, loại thao tác, và khóa nghiệp vụ đủ để lần lại đối tượng (`ma_nv`, `so_hd`, định danh người phụ thuộc hoặc tài liệu, email Drive).

**Không lưu giá trị trước và sau.** Ảnh chụp bản ghi làm nhật ký phình theo dữ liệu và tự nó trở thành một bản sao dữ liệu cá nhân phải bảo vệ. Mức đã chốt là biết **ai đã làm gì lúc nào**, không phải dựng lại được giá trị cũ. Không phát sinh bảng mới — dùng cơ chế ghi nhật ký sẵn có của hệ thống.

Nhật ký là **ghi kèm, không chặn**: ghi nhật ký hỏng thì thao tác nghiệp vụ vẫn thành công và lỗi ghi nhật ký vào nhật ký máy chủ. Ghi nhật ký không được làm chậm đường phản hồi tới mức người dùng cảm nhận được.

---

## 6. Yêu cầu chức năng

### Phòng ban

**FR-hrm-001** — Hệ thống cho phép tạo phòng ban với tên bắt buộc; mã, phòng ban cha, ghi chú và trạng thái tùy chọn. Bỏ trống mã thì hệ thống tự sinh theo cấp cha đã chọn (BR-hrm-001). Phòng ban cha được kiểm **trước** khi sinh mã, vì mã con lấy mã cha làm tiền tố.

**FR-hrm-002** — Hệ thống cho phép xem danh sách phòng ban chưa xóa, sắp theo mã tăng dần, mỗi dòng kèm tên phòng ban cha và số nhân viên **đang làm việc**. Tên phòng ban cha được tra từ toàn bộ danh mục chưa xóa, không chỉ từ các dòng đã lọc, để cha bị lọc mất vẫn hiện đúng tên.

**FR-hrm-003** — Hệ thống cho phép sửa tên, ghi chú, trạng thái và phòng ban cha. Mã phòng ban không sửa được (BR-hrm-005). Khi đổi phòng ban cha, hệ thống kiểm cả điều kiện tồn tại lẫn điều kiện chống vòng lặp (BR-hrm-006, BR-hrm-007, BR-hrm-008).

**FR-hrm-004** — Hệ thống cho phép xóa mềm phòng ban khi và chỉ khi không còn phòng ban trực thuộc chưa xóa và không còn nhân viên chưa xóa trỏ vào (BR-hrm-009).

**FR-hrm-005** — Hệ thống cho phép lọc danh sách phòng ban theo mã (chứa, không phân biệt hoa thường), tên (chứa, không phân biệt hoa thường) và trạng thái.

**FR-hrm-037** `[MỚI — QĐ #11]` — Hệ thống cho phép chuyển phòng ban sang ngừng hoạt động kể cả khi còn nhân viên, và trả về số nhân viên còn thuộc phòng ban (tách số người đang làm và số người đã nghỉ) để giao diện hỏi xác nhận đúng con số (BR-hrm-060). Ô chọn phòng ban trong form nhân viên chỉ liệt kê phòng đang hoạt động, cộng thêm phòng ban đang gán của chính nhân viên đang sửa (BR-hrm-061).

### Nhân viên

**FR-hrm-006** — Hệ thống cho phép tạo nhân viên với họ tên và ngày vào làm bắt buộc; các trường còn lại tùy chọn. Bỏ trống mã thì hệ thống tự sinh (BR-hrm-003). Kiểm trùng mã không lọc cờ đã xóa (BR-hrm-004) và trả lỗi nêu đích danh mã đang vướng.

**FR-hrm-007** — Khi tạo hoặc sửa nhân viên có gán phòng ban, hệ thống kiểm phòng ban tồn tại và chưa xóa mềm trước khi ghi (BR-hrm-016).

**FR-hrm-008** — Hệ thống cho phép xem danh sách nhân viên chưa xóa, sắp theo mã tăng dần, mỗi dòng kèm tên phòng ban, số người phụ thuộc và **sáu trường hợp đồng hiện hành tính lúc đọc**. Toàn bộ hợp đồng của cả danh sách được lấy trong một lượt truy vấn, không truy vấn từng dòng.

**FR-hrm-009** — Hệ thống cho phép xem chi tiết một nhân viên chưa xóa, gồm đủ trường của hồ sơ cộng thông tin hợp đồng hiện hành.

**FR-hrm-010** — Hệ thống cho phép sửa toàn bộ hồ sơ nhân viên trừ mã. Hai cờ chế độ là bắt buộc khi sửa (BR-hrm-013).

**FR-hrm-036** `[MỚI — QĐ #3]` — Hệ thống cung cấp thao tác **ghi nhận nghỉ việc**: nhận ngày nghỉ bắt buộc, đổi trạng thái nhân viên sang đã nghỉ, và tự chốt mọi hợp đồng còn mở của người đó bằng đúng ngày nghỉ — cả ba việc nằm trong **một giao dịch** (BR-hrm-054, BR-hrm-055). Phản hồi phải cho biết **đã chốt bao nhiêu hợp đồng và số hợp đồng nào**, để giao diện nói rõ hệ thống vừa đụng vào cái gì thay vì làm âm thầm. Có hợp đồng bắt đầu sau ngày nghỉ thì từ chối toàn bộ, không ghi gì (E-hrm-054).

**FR-hrm-011** — Hệ thống cho phép xóa mềm nhân viên và trả về số người phụ thuộc bị ẩn theo (BR-hrm-011).

**FR-hrm-012** — Hệ thống cho phép lọc danh sách nhân viên theo mã (chứa), họ tên (chứa), phòng ban (khớp đúng, tự in hoa tham số) và trạng thái.

**FR-hrm-040** `[MỚI — QĐ #14]` — Hệ thống trả về chỉ báo hồ sơ đủ/thiếu và danh sách loại giấy tờ còn thiếu cho từng nhân viên, ở cả danh sách lẫn chi tiết, tính lúc đọc theo BR-hrm-064. Chỉ báo của cả danh sách phải lấy trong một lượt truy vấn, không truy vấn theo từng dòng (cùng ràng buộc với NFR-hrm-004).

**FR-hrm-042** `[MỚI — QĐ #8]` — Hệ thống chỉ trả các trường lương và tài khoản ngân hàng cho người được cấp quyền xem dữ liệu lương; người không có quyền nhận phản hồi **không chứa** các trường đó (BR-hrm-059).

### Hợp đồng lao động

**FR-hrm-013** `[SỬA THEO QĐ #8]` — Hệ thống cho phép xem lịch sử hợp đồng của **đúng một nhân viên**; mã nhân viên là tham số **bắt buộc**, thiếu thì trả lỗi kiểm dữ liệu. Người gọi phải có quyền xem dữ liệu lương (BR-hrm-059, E-hrm-058). Kết quả sắp theo thứ tự chuẩn mới-nhất-lên-đầu (BR-hrm-020). Hợp đồng của nhân viên đã xóa mềm bị ẩn.

**FR-hrm-014** — Hệ thống tính hợp đồng hiện hành lúc đọc theo BR-hrm-019, cho cả một nhân viên lẫn cả danh sách nhân viên trong một lượt truy vấn.

**FR-hrm-015** — Khi trả kết quả cho màn nhân viên, hệ thống quy loại hợp đồng từ 5 giá trị lịch sử về 3 nhóm (thử việc / hợp đồng lao động / hợp đồng dịch vụ). Bảng lịch sử giữ nguyên giá trị gốc (BR-hrm-027).

**FR-hrm-016** `[SỬA THEO QĐ #1, #4, #5, #6]` — Hệ thống cho phép tạo một hợp đồng cho nhân viên đang tồn tại và chưa xóa mềm. Trong cùng một giao dịch, hệ thống kiểm nhân viên, kiểm trùng số hợp đồng trong công ty (BR-hrm-056), kiểm ràng buộc lương (BR-hrm-057, BR-hrm-058), kiểm chồng lấn thời gian với các hợp đồng **cùng loại** (BR-hrm-022), rồi ghi và áp luật công đoàn theo loại hợp đồng vừa ghi (BR-hrm-025).

**FR-hrm-017** `[SỬA THEO QĐ #1, #4, #5, #6]` — Hệ thống cho phép sửa một hợp đồng, trừ mã nhân viên. Đường sửa chạy **đúng bộ kiểm như đường tạo** (trùng số hợp đồng, ràng buộc lương, chồng lấn cùng loại), có bỏ qua chính dòng đang sửa khi kiểm trùng và kiểm chồng lấn. Sau khi sửa, hệ thống áp lại luật công đoàn theo loại hợp đồng vừa ghi.

**FR-hrm-018** `[SỬA THEO QĐ #1]` — Hệ thống cung cấp thao tác **đổi hợp đồng** thực hiện trong một giao dịch: tìm hợp đồng đang hiệu lực **thuộc đúng loại hợp đồng người dùng chỉ định** (BR-hrm-053), kiểm các ràng buộc ngày (BR-hrm-024), kiểm ràng buộc lương và trùng số hợp đồng cho hợp đồng mới, chốt ngày kết thúc hợp đồng cũ, ghi hợp đồng mới, áp luật công đoàn.

**FR-hrm-019** — Phản hồi của đổi hợp đồng phải cho biết **có thực sự chốt hợp đồng cũ hay không**, báo theo việc đã làm chứ không theo dữ liệu người dùng gửi lên.

**FR-hrm-020** `[SỬA THEO QĐ #15]` — Hệ thống cho phép xóa một hợp đồng của nhân viên chưa xóa mềm. Sau khi xóa không cần cập nhật gì ở bảng nhân viên. Thao tác này ghi nhật ký người thao tác (BR-hrm-066).

### Người phụ thuộc

**FR-hrm-021** `[SỬA THEO QĐ #7]` — Hệ thống cho phép tạo người phụ thuộc cho nhân viên đang tồn tại và chưa xóa mềm, chặn trùng mã số thuế **trong toàn công ty** và nêu rõ nhân viên nào đang giữ mã số thuế đó (BR-hrm-030).

**FR-hrm-022** — Hệ thống cho phép xem danh sách người phụ thuộc, lọc theo nhân viên và theo họ tên (chứa), sắp theo mã nhân viên rồi họ tên, mỗi dòng kèm tên nhân viên tra lúc đọc.

**FR-hrm-023** — Hệ thống cho phép sửa người phụ thuộc trừ mã nhân viên; khi kiểm trùng mã số thuế phải bỏ qua chính dòng đang sửa.

**FR-hrm-024** `[SỬA THEO QĐ #15]` — Hệ thống cho phép xóa cứng một người phụ thuộc của nhân viên chưa xóa mềm. Thao tác này ghi nhật ký người thao tác (BR-hrm-066).

### Hồ sơ tài liệu

**FR-hrm-025** — Hệ thống cho phép tạo bản ghi giấy tờ với mã nhân viên và loại giấy tờ bắt buộc; số hiệu, ngày cấp, nơi cấp, ghi chú tùy chọn. Việc kiểm nhân viên và việc ghi nằm trong cùng một giao dịch.

**FR-hrm-026** `[SỬA THEO QĐ #14]` — Hệ thống cho phép xem danh sách giấy tờ, lọc theo nhân viên và theo loại (khớp đúng), sắp theo mã nhân viên rồi loại, mỗi dòng kèm tên nhân viên, **danh sách file scan đã đính** (`files`, có thể rỗng — `[SỬA THEO QĐ #21]`), `ngay_het_han` và trạng thái hạn tính lúc đọc.

**FR-hrm-038** `[MỚI — QĐ #14]` — Hệ thống cho phép xem, thêm, sửa và xóa các dòng của danh mục bộ giấy tờ bắt buộc theo loại hợp đồng, riêng cho từng công ty (BR-hrm-063). Trùng cặp loại hợp đồng và loại giấy tờ bị từ chối (E-hrm-061).

**FR-hrm-039** `[MỚI — QĐ #14]` — Hệ thống cho phép nhập và sửa ngày hết hạn của một dòng giấy tờ, kiểm không sớm hơn ngày cấp (BR-hrm-062, E-hrm-060).

**FR-hrm-041** `[MỚI — QĐ #14]` — Hệ thống cung cấp danh sách giấy tờ **đã hết hạn** và **sắp hết hạn** của toàn công ty, lọc được theo nhân viên và theo loại giấy tờ, sắp theo ngày hết hạn tăng dần. Ngưỡng "sắp hết hạn" lấy theo BR-hrm-065; ngưỡng chưa được khai thì danh sách chỉ gồm giấy tờ đã hết hạn.

### Google Drive

**FR-hrm-027** — Hệ thống cho biết trạng thái kết nối Drive của công ty đang chọn: máy chủ đã cấu hình đủ chưa, công ty đã kết nối chưa, và đang dùng tài khoản Google nào.

**FR-hrm-028** `[SỬA THEO QĐ #10]` — Hệ thống cấp đường dẫn màn đồng ý của Google kèm vé `state` ký HMAC hạn 10 phút và cookie khóa vé vào trình duyệt (BR-hrm-043). **Chỉ chủ tài khoản được gọi**, kể cả khi công ty chưa từng kết nối (BR-hrm-045, E-hrm-059). Giao diện của người không phải chủ tài khoản không hiện nút kết nối mà hiện thông báo nhờ chủ tài khoản liên kết.

**FR-hrm-029** — Hệ thống nhận callback từ Google, đối chiếu vé với cookie rồi xóa cookie, đổi mã lấy token, mã hóa và lưu vào công ty, dọn ID thư mục khi đổi tài khoản (BR-hrm-047), và trả về một trang tự đóng.

**FR-hrm-030** — Hệ thống cho phép tải một file scan lên một dòng giấy tờ: kiểm dung lượng và kiểu file, lấy token công ty, tạo lười cây thư mục, tải file lên thư mục của nhân viên, rồi ghi con trỏ vào dòng giấy tờ.

**FR-hrm-031** `[SỬA THEO QĐ #21]` — Khi dòng giấy tờ đã có file, file mới được **thêm vào** danh sách, file cũ **giữ nguyên** (BR-hrm-037). Đủ 20 file thì từ chối (E-hrm-065). Bản trước quy định xóa file cũ — không còn đúng từ khi một giấy tờ giữ được nhiều file.

**FR-hrm-032** — Hệ thống cho phép xem file scan bằng cách truyền nội dung qua máy chủ, hiển thị tại chỗ, cấm lưu vào bộ nhớ đệm của trình duyệt và proxy, và buộc trình duyệt bám đúng kiểu file đã khai.

**FR-hrm-033** `[SỬA THEO QĐ #21]` — Hệ thống cho phép gỡ **một file được chỉ định** khỏi dòng giấy tờ: xóa trên Drive rồi xóa dòng trong `hrm_tai_lieu_file`, giữ nguyên dòng giấy tờ và các file còn lại (BR-hrm-038). File không thuộc dòng giấy tờ đang thao tác thì từ chối (E-hrm-066).

**FR-hrm-034** `[SỬA THEO QĐ #12, #15]` — Hệ thống cho phép xóa cứng một dòng giấy tờ của nhân viên chưa xóa mềm, **và xóa luôn file scan trên Drive** theo kiểu cố hết sức (BR-hrm-039). Phản hồi cho biết đã xóa được file trên Drive hay chưa, để giao diện nói đúng sự thật. Thao tác này ghi nhật ký người thao tác (BR-hrm-066).

**FR-hrm-035** `[SỬA THEO QĐ #15]` — Hệ thống cho phép chủ tài khoản ngắt kết nối Drive: xóa email, xóa bộ ba trường token, xóa ID thư mục gốc và mọi ID thư mục nhân viên. Thao tác này ghi nhật ký người thao tác kèm email Drive bị ngắt (BR-hrm-066).

**FR-hrm-044** `[MỚI — QĐ #8, vòng phản biện 2026-09-07]` — Hệ thống cho phép **chủ tài khoản cấp và thu hồi quyền xem dữ liệu lương** cho từng người dùng, **theo từng công ty**. Không có chức năng này thì BR-hrm-059 chỉ chặn được chứ không cấp được cho ai, và mọi người dùng không phải chủ tài khoản sẽ mất hoàn toàn màn hợp đồng. Quyền được cấp ở phạm vi cặp người dùng và công ty, vì một kế toán dịch vụ có thể được xem lương ở công ty này mà không ở công ty kia.

**FR-hrm-043** `[MỚI — QĐ #15]` — Hệ thống ghi nhật ký người thao tác cho đúng năm nhóm thao tác liệt kê ở BR-hrm-066, không ghi giá trị trước và sau. Ghi nhật ký thất bại không làm hỏng thao tác nghiệp vụ.

---

## 7. Yêu cầu phi chức năng

**NFR-hrm-001** — **Toàn vẹn dữ liệu**: mọi ràng buộc (định dạng, độ dài, khóa ngoại mềm, giá trị cho phép) phải được máy chủ kiểm, không chỉ ở giao diện. Giới hạn độ dài phải chặn ở tầng kiểm dữ liệu để tràn cột trả lỗi 400 nói rõ trường nào, thay vì lỗi 500 từ cơ sở dữ liệu.

**NFR-hrm-002** — **Nguyên tử**: mọi thao tác chạm nhiều bản ghi (tạo hợp đồng kèm áp luật công đoàn, đổi hợp đồng, tạo tài liệu) phải nằm trong một giao dịch. Không được để khe giữa bước kiểm và bước ghi cho phép nhân viên bị xóa mềm ở giữa.

**NFR-hrm-003** — **Cách ly giữa các công ty**: dữ liệu HRM của công ty này không được rò sang công ty khác trong bất kỳ tình huống nào, kể cả khi vé đăng nhập còn hạn nhưng quyền đã bị thu hồi.

**NFR-hrm-004** `[SỬA THEO QĐ #16]` — **Hiệu năng tra cứu**, giữ dạng **định tính** trong đợt này:
- Danh sách nhân viên phải lấy hợp đồng hiện hành **và** chỉ báo hồ sơ đủ/thiếu của toàn bộ danh sách trong một lượt truy vấn cho mỗi loại dữ liệu — không truy vấn theo từng dòng.
- Danh sách phòng ban lấy trọn một lượt rồi ghép trong bộ nhớ.
- Số lượt truy vấn cho một lần mở danh sách phải **không phụ thuộc số bản ghi** trả về.

**Chưa đặt ngưỡng mili-giây, và cố ý không đặt.** Đợt này chỉ thêm chỉ mục theo thiết kế của Architect rồi **đo thực tế trên tenant lớn nhất đang chạy**, có báo cáo số đo; ngưỡng chỉ được chốt sau khi có số đo đó. QA **không** viết ca kiểm thử hiệu năng có ngưỡng cứng ở vòng này, thay bằng một đầu việc đo có báo cáo. Bịa ra một ngưỡng khi chưa biết quy mô thật sẽ tạo ra ca test hoặc luôn đỏ, hoặc luôn xanh mà không nói lên điều gì.

**NFR-hrm-005** `[SỬA THEO QĐ #8, #13]` — **Bảo vệ dữ liệu cá nhân**: số CCCD, mã số thuế cá nhân, số tài khoản ngân hàng, mức lương và ảnh scan giấy tờ là dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP. File scan không nằm trong hạ tầng MAXV mà trên Drive của chính doanh nghiệp; nội dung file truyền qua máy chủ phải cấm lưu vào bộ nhớ đệm và cấm trình duyệt tự đoán kiểu nội dung. Trong nội bộ một công ty, lương và tài khoản ngân hàng chỉ hiện cho người được cấp quyền xem dữ liệu lương (BR-hrm-059).

**Nợ kỹ thuật đã ghi nhận, chưa xử lý trong đợt này:** hệ thống **chưa** có chính sách xóa cứng hồ sơ nhân sự và **chưa** đặt thời hạn lưu trữ file scan sau khi nhân viên nghỉ việc. Xóa mềm nhân viên hiện không đụng gì tới file trên Drive (A-hrm-10). Đây là khoảng trống về nghĩa vụ bảo vệ dữ liệu cá nhân, phải mở một vòng quyết định riêng khi có yêu cầu tuân thủ cụ thể.

**NFR-hrm-006** — **Bảo mật token bên thứ ba**: refresh token của Google phải được mã hóa đối xứng có xác thực trước khi lưu. Thiếu khóa mã hóa thì từ chối lưu, không lưu bản trần. Không đưa nội dung lỗi thô của Google ra cho người dùng; chi tiết chỉ ghi vào nhật ký máy chủ.

**NFR-hrm-007** — **Chống lạm dụng luồng OAuth**: vé `state` phải có chữ ký, hạn dùng ngắn, dùng một lần và gắn với đúng một trình duyệt. Trang callback là trang HTML tự dựng trên miền đang giữ cookie phiên nên mọi dữ liệu ngoài đưa vào trang phải được thoát ký tự và ràng bằng chính sách bảo mật nội dung.

**NFR-hrm-008** — **Chịu lỗi dịch vụ ngoài**: mọi lượt gọi Google phải có trần thời gian chờ (hiện là 30 giây). Mất mạng phải phân biệt được với lỗi do dữ liệu, và tuyệt đối không được hiểu nhầm thành "khách đã thu hồi quyền" rồi tự xóa kết nối.

**NFR-hrm-009** — **Thông điệp lỗi bằng tiếng Việt, nói đúng việc phải làm tiếp**. Không dùng câu chung chung khi biết rõ nguyên nhân; không khẳng định điều chưa chắc (ví dụ không nói "file đã bị xóa" khi chỉ biết là không mở được).

**NFR-hrm-010** — **Khả năng mở rộng danh mục**: các trường dạng chữ tự do có gợi ý (ngân hàng, quan hệ người phụ thuộc, loại giấy tờ, loại hợp đồng, chức vụ, cấp bậc) cho phép thêm giá trị mới mà không phải đổi cấu trúc dữ liệu.

**NFR-hrm-011** `[SỬA THEO QĐ #15]` — **Truy vết thao tác**, mức đã chốt:
- **Có ghi**: người thao tác, thời điểm, công ty, loại thao tác và khóa nghiệp vụ của đối tượng, cho đúng **năm** nhóm thao tác ở BR-hrm-066 (xóa hợp đồng · sửa lương · xóa người phụ thuộc · xóa dòng tài liệu · ngắt kết nối Drive).
- **Không ghi**: giá trị trước và sau mỗi lần sửa; không lưu ảnh chụp bản ghi; không thêm bảng mới.
- **Không chặn**: ghi nhật ký hỏng thì thao tác nghiệp vụ vẫn thành công.

`[CHƯA CÓ TRONG MÃ]` — hiện toàn bộ HRM không gọi cơ chế ghi nhật ký nào; mã chỉ có hai mốc thời gian tạo và sửa gần nhất, không lưu ai đã thao tác.

---

## 8. Ma trận lỗi

Wording ở cột thứ ba là **chuỗi thật trong mã**, trừ các dòng đánh `[CHƯA CÓ TRONG MÃ]` — những dòng đó là wording **đề xuất** cho quy tắc mới chốt ngày 2026-09-07, Architect và Frontend phải dùng đúng chuỗi này khi hiện thực. Lỗi kiểm dữ liệu trả về mảng chi tiết theo từng trường; các lỗi nghiệp vụ trả về một thông điệp.

### 8.1 Xác thực, phạm vi và nhập liệu chung

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-001 | 401 | Chưa đăng nhập hoặc phiên hết hạn | "Bạn chưa đăng nhập hoặc phiên đã hết hạn" | Từ chối, giao diện tự làm mới phiên rồi thử lại |
| E-hrm-002 | 403 | Gói thuê bao không có module HRM | Thông điệp của guard module | Từ chối toàn bộ nhóm endpoint HRM |
| E-hrm-003 | 403 | Chưa chọn công ty | Thông điệp "chưa chọn công ty" | Từ chối |
| E-hrm-004 | 403 | Không còn quyền vào công ty đang chọn | Thông điệp "không còn quyền truy cập" | Từ chối |
| E-hrm-005 | 404 | Công ty chưa được cấp cơ sở dữ liệu | Thông điệp "chưa cấp DB tenant" | Từ chối |
| E-hrm-006 | 400 | Dữ liệu nhập sai (thiếu trường bắt buộc, sai định dạng, quá độ dài, ngày không có thật, giá trị ngoài danh sách cho phép) | Mảng lỗi theo từng trường, ví dụ "Họ và tên không được để trống", "Ngày không có thật: 2026-02-30", "Mã số thuế không hợp lệ", "Ghi chú tối đa 512 ký tự" | Từ chối lưu |
| E-hrm-007 | 409 | Vi phạm ràng buộc duy nhất ở cơ sở dữ liệu (chốt cuối khi hai yêu cầu vào cùng lúc) | Thông điệp chung về dữ liệu bị trùng | Từ chối lưu |
| E-hrm-058 | 403 | Người dùng vào được công ty nhưng **không được cấp quyền xem dữ liệu lương**, mà gọi nhóm endpoint hợp đồng | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Bạn không có quyền xem dữ liệu lương và hợp đồng của công ty này. Liên hệ chủ tài khoản để được cấp quyền." | Từ chối (BR-hrm-059) |

### 8.2 Phòng ban

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-008 | 404 | Thao tác trên phòng ban không tồn tại hoặc đã xóa mềm | "Không tìm thấy phòng ban" | Từ chối |
| E-hrm-009 | 404 | Phòng ban cha không tồn tại hoặc đã xóa mềm | "Phòng ban cha không tồn tại" | Từ chối lưu (BR-hrm-006) |
| E-hrm-010 | 409 | Chọn chính mình làm phòng ban cha | "Phòng ban cha không thể là chính nó" | Từ chối lưu (BR-hrm-007) |
| E-hrm-011 | 409 | Chọn phòng ban cấp dưới làm cha | "Không thể chọn phòng ban cấp dưới làm phòng ban cha (tạo vòng lặp trong cây tổ chức)" | Từ chối lưu (BR-hrm-008) |
| E-hrm-012 | 409 | Mã phòng ban tự nhập bị trùng | "Mã phòng ban \"PB01\" đã tồn tại" | Từ chối lưu |
| E-hrm-013 | 409 | Xóa phòng ban còn phòng ban trực thuộc | "Phòng ban \"PB01\" đang có 2 phòng ban trực thuộc, vui lòng xử lý các phòng ban đó trước." | Từ chối xóa (BR-hrm-009) |
| E-hrm-014 | 409 | Xóa phòng ban còn nhân viên | "Phòng ban \"PB01\" đang có 5 nhân viên (3 đang làm, 2 đã nghỉ), không thể xóa." — không có người đã nghỉ thì rút gọn thành "đang có 3 nhân viên, không thể xóa." | Từ chối xóa (BR-hrm-009) |
| E-hrm-015 | 409 | Cây quá sâu, mã tự sinh vượt 24 ký tự | "Cây phòng ban quá sâu để tự sinh mã (\"…\" vượt 24 ký tự). Vui lòng tự nhập mã ngắn hơn." | Từ chối tạo |

### 8.3 Nhân viên

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-016 | 404 | Thao tác trên nhân viên không tồn tại hoặc đã xóa mềm | "Không tìm thấy nhân viên" | Từ chối |
| E-hrm-017 | 409 | Mã nhân viên trùng, **kể cả trùng với mã đã xóa mềm** | "Mã nhân viên \"NV0001\" đã tồn tại" | Từ chối lưu (BR-hrm-004) |
| E-hrm-018 | 409 | Vượt 9999 nhân viên và mã dự phòng vẫn quá dài | "Không sinh được mã nhân viên, vui lòng tự nhập mã." | Từ chối tạo |
| E-hrm-052 | 400 | Chuyển nhân viên sang đã nghỉ mà không gửi ngày nghỉ việc | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Phải nhập ngày nghỉ việc khi chuyển nhân viên sang trạng thái Đã nghỉ." | Từ chối lưu (BR-hrm-054) |
| E-hrm-053 | 400 | Ngày nghỉ việc sớm hơn ngày vào làm | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Ngày nghỉ việc không được trước ngày vào làm ({ngày vào làm})." | Từ chối lưu (BR-hrm-054) |
| E-hrm-054 | 409 | Ghi nhận nghỉ việc trong khi nhân viên còn hợp đồng có ngày bắt đầu **sau** ngày nghỉ | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Nhân viên còn hợp đồng {số HĐ} bắt đầu ngày {ngày bắt đầu}, muộn hơn ngày nghỉ việc. Vui lòng xóa hoặc sửa hợp đồng đó trước khi ghi nhận nghỉ việc." | Hủy toàn bộ giao dịch, không đổi trạng thái, không chốt hợp đồng nào (BR-hrm-055) |

### 8.4 Hợp đồng lao động

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-019 | 400 | Ngày kết thúc **nhỏ hơn** ngày bắt đầu (bằng nhau nay hợp lệ) | `[SỬA THEO QĐ #6]` — wording mới: "Ngày kết thúc không được trước ngày bắt đầu" (chuỗi cũ "Ngày kết thúc phải sau ngày bắt đầu" phải đổi, vì nó mô tả sai quy tắc mới) | Từ chối lưu (BR-hrm-026) |
| E-hrm-020 | 400 | Đổi hợp đồng: hợp đồng mới bắt đầu trước hoặc đúng ngày chốt | "Hợp đồng mới phải bắt đầu sau ngày chốt hợp đồng cũ" | Từ chối lưu (BR-hrm-024c) |
| E-hrm-021 | 409 | Đổi hợp đồng: nhân viên đang có hợp đồng hiệu lực nhưng không gửi ngày chốt | "Nhân viên đang có hợp đồng hiệu lực — phải chọn ngày chốt hợp đồng cũ." | Hủy giao dịch (BR-hrm-024a) |
| E-hrm-022 | 409 | Đổi hợp đồng: ngày chốt nhỏ hơn hoặc bằng ngày bắt đầu hợp đồng cũ | "Ngày chốt phải sau ngày bắt đầu của hợp đồng đang hiệu lực." | Hủy giao dịch (BR-hrm-024b) |
| E-hrm-023 | 404 | Thao tác trên hợp đồng không tồn tại, hoặc thuộc nhân viên đã xóa mềm | "Không tìm thấy hợp đồng" | Từ chối |
| E-hrm-024 | 409 | Khoảng thời gian hợp đồng chồng lấn với hợp đồng khác **cùng loại** của cùng nhân viên | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Nhân viên đã có hợp đồng {số HĐ} loại {loại HĐ} hiệu lực từ {ngày bắt đầu} đến {ngày kết thúc}, trùng khoảng thời gian bạn vừa nhập. Hai hợp đồng cùng loại không được chồng lấn." | Từ chối lưu (BR-hrm-022). Hợp đồng **khác loại** trùng thời gian thì cho lưu bình thường |
| E-hrm-055 | 409 | Số hợp đồng đã tồn tại trong công ty | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Số hợp đồng \"{số HĐ}\" đã được dùng cho nhân viên {mã NV} — {họ tên}. Số hợp đồng phải là duy nhất trong công ty." | Từ chối lưu (BR-hrm-056) |
| E-hrm-056 | 400 | Lương chính để trống hoặc bằng 0 | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Lương chính phải lớn hơn 0." | Từ chối lưu (BR-hrm-057) |
| E-hrm-057 | 400 | Bật trích BHXH mà lương đóng BHXH để trống hoặc bằng 0 | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Đã bật trích BHXH nên lương đóng BHXH phải lớn hơn 0. Nếu không đóng BHXH, hãy tắt ô Trích BHXH." | Từ chối lưu (BR-hrm-058) |

### 8.5 Người phụ thuộc

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-025 | 404 | Thao tác trên người phụ thuộc không tồn tại, hoặc thuộc nhân viên đã xóa mềm | "Không tìm thấy người phụ thuộc" | Từ chối |
| E-hrm-026 | 409 | Trùng mã số thuế người phụ thuộc **trong toàn công ty**, kể cả khi hai dòng thuộc hai nhân viên khác nhau | `[SỬA THEO QĐ #7]` — wording mới: "Người phụ thuộc mang MST 8012345678 đã được đăng ký cho nhân viên NV0001 — Nguyễn Văn A. Mỗi người phụ thuộc chỉ được tính giảm trừ gia cảnh cho một người nộp thuế." (chuỗi cũ chỉ nói trong cùng một nhân viên, mô tả sai phạm vi mới) | Từ chối lưu (BR-hrm-030) |
| E-hrm-027 | 400 | Ngày sinh người phụ thuộc sai khuôn | "Ngày sinh phải theo định dạng dd/MM/yyyy" | Từ chối lưu |
| E-hrm-028 | 400 | Ngày sinh người phụ thuộc không có thật | "Ngày sinh không có thật: 31/02/2020" | Từ chối lưu |
| E-hrm-029 | 400 | Có tháng đăng ký mà thiếu năm, hoặc ngược lại | "Có tháng đăng ký thì phải có năm" / "Có năm đăng ký thì phải có tháng" | Từ chối lưu (BR-hrm-031) |
| E-hrm-030 | 400 | Kỳ đăng ký đến trước kỳ đăng ký từ | "Kỳ đăng ký đến phải sau hoặc bằng kỳ đăng ký từ" | Từ chối lưu (BR-hrm-031) |

### 8.6 Hồ sơ tài liệu và file scan

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-031 | 404 | Thao tác trên tài liệu không tồn tại, hoặc thuộc nhân viên đã xóa mềm | "Không tìm thấy tài liệu" | Từ chối |
| E-hrm-032 | 409 | File tải lên vượt trần | "File vượt quá 10MB." | Từ chối tải lên (BR-hrm-036) |
| E-hrm-033 | 409 | Kiểu file không thuộc 5 kiểu cho phép | "Chỉ nhận ảnh (JPG, PNG, WEBP, HEIC) hoặc PDF — file gửi lên là \"text/plain\"." | Từ chối tải lên (BR-hrm-035) |
| E-hrm-034 | 409 | Yêu cầu không phải dạng multipart | "Yêu cầu phải gửi dạng multipart/form-data." | Từ chối |
| E-hrm-035 | 409 | Gửi nhiều hơn một file | "Mỗi lần chỉ tải lên được một file." | Từ chối |
| E-hrm-036 | 409 | Không có file nào trong yêu cầu | "Không nhận được file nào." | Từ chối |
| E-hrm-037 | 404 | Xem hoặc gỡ file trên tài liệu chưa đính file | "Tài liệu này chưa đính file scan." | Từ chối |
| E-hrm-038 | 404 | Google trả 404 khi lấy nội dung file | "Không mở được file trên Google Drive. Có thể file đã bị xóa, hoặc nó nằm ở tài khoản Google mà công ty từng kết nối trước đây. Vui lòng kiểm tra tài khoản Drive đang kết nối, hoặc tải lại file scan." | Từ chối, không khẳng định đã mất (BR-hrm-048) |
| E-hrm-060 | 400 | Ngày hết hạn giấy tờ sớm hơn ngày cấp | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Ngày hết hạn không được trước ngày cấp." | Từ chối lưu (BR-hrm-062) |
| E-hrm-061 | 409 | Khai trùng cặp (loại hợp đồng, loại giấy tờ) trong danh mục bộ giấy tờ bắt buộc | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Loại hợp đồng \"{loại HĐ}\" đã khai giấy tờ bắt buộc \"{loại giấy tờ}\". Mỗi cặp chỉ khai một lần." | Từ chối lưu (BR-hrm-063) |

### 8.7 Kết nối Google Drive

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-039 | 409 | Công ty chưa kết nối Drive | "Công ty chưa kết nối Google Drive — bấm \"Thêm file\" để đăng nhập Google và kết nối." | Từ chối thao tác file |
| E-hrm-040 | 409 | Refresh token bị thu hồi (Google trả `invalid_grant`), hoặc giải mã token thất bại | "Kết nối Google Drive đã hết hiệu lực (bị thu hồi quyền), vui lòng kết nối lại." | Với `invalid_grant`: tự ngắt kết nối rồi báo. Với lỗi giải mã: **không** ngắt, chỉ báo |
| E-hrm-041 | 403 | Không phải chủ tài khoản mà đổi tài khoản Google | "Công ty đã kết nối Google Drive. Chỉ chủ tài khoản mới đổi được sang tài khoản Google khác, vì việc đó chuyển toàn bộ file scan sau này sang Drive mới." | Từ chối (BR-hrm-045) |
| E-hrm-042 | 403 | Không phải chủ tài khoản mà ngắt kết nối | "Chỉ chủ tài khoản mới ngắt được kết nối Google Drive của công ty." | Từ chối (BR-hrm-045) |
| E-hrm-059 | 403 | Không phải chủ tài khoản mà **kết nối Drive lần đầu** | `[CHƯA CÓ TRONG MÃ]` — đề xuất: "Chỉ chủ tài khoản mới liên kết được Google Drive cho công ty. Vui lòng nhờ chủ tài khoản thực hiện, sau đó bạn đính file scan bình thường." | Từ chối (BR-hrm-045). Giao diện phải hiện thông báo này **thay cho nút kết nối**, không để người dùng bấm rồi mới nhận 403 |
| E-hrm-043 | 409 | Máy chủ thiếu cấu hình Google | "Máy chủ chưa cấu hình Google Drive (thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI)." | Tính năng Drive tự tắt, không làm sập ứng dụng |
| E-hrm-044 | 409 | Máy chủ thiếu khóa mã hóa | "Máy chủ chưa cấu hình khóa mã hóa (GDT_CRED_ENC_KEY) nên không lưu được kết nối Drive." | Từ chối lưu kết nối (BR-hrm-040) |
| E-hrm-045 | 502 | Google trả lỗi khác không tự xử lý được | "Google Drive đang không phản hồi đúng nên chưa xử lý được file scan. Vui lòng thử lại sau ít phút; nếu vẫn lỗi, báo quản trị viên kiểm tra cấu hình Google Drive." | Thử lại được. Nội dung lỗi thô chỉ vào nhật ký |
| E-hrm-046 | 502 | Máy chủ không gọi ra được Google (mất mạng, DNS hỏng, tường lửa, quá 30 giây) | "Máy chủ không kết nối được tới Google nên chưa xử lý được file scan. Đây là sự cố mạng phía máy chủ, không phải do dữ liệu bạn nhập — vui lòng thử lại sau ít phút hoặc báo quản trị viên." | Thử lại được, **tuyệt đối không** tự ngắt kết nối (BR-hrm-046) |

### 8.8 Trang callback OAuth (trả HTML, không phải JSON)

Trang callback luôn trả mã 200 kèm một trang tự đóng; thất bại thì đóng sau 4 giây, thành công thì đóng sau 0,3 giây.

| ID | Tình huống | Wording tiếng Việt |
|---|---|---|
| E-hrm-047 | Người dùng từ chối cấp quyền ở màn Google | "Bạn chưa cấp quyền truy cập Google Drive." |
| E-hrm-048 | Thiếu tham số trả về từ Google | "Thiếu tham số trả về từ Google." |
| E-hrm-049 | Vé không khớp cookie, hoặc vé đã dùng | "Phiên kết nối không hợp lệ hoặc đã dùng rồi. Hãy bấm thêm file lại từ đầu, trên chính trình duyệt này." |
| E-hrm-050 | Vé sai chữ ký hoặc quá 10 phút | "Phiên kết nối không hợp lệ hoặc đã hết hạn." |
| E-hrm-051 | Lỗi khác khi lưu kết nối | "Không kết nối được Google Drive. Vui lòng thử lại." — chỉ lỗi nghiệp vụ do chính mình đặt mới hiện nguyên văn; lỗi từ Google (tiếng Anh) không đưa lên trang |

| E-hrm-065 | 409 | Dòng tài liệu đã đủ 20 file, tải thêm nữa | "Mỗi giấy tờ giữ tối đa 20 file. Gỡ bớt file cũ rồi thử lại." | Từ chối (BR-hrm-037) |
| E-hrm-066 | 404 | Xem hoặc gỡ một file không thuộc dòng giấy tờ đang thao tác | "Không tìm thấy file scan này trong giấy tờ đã chọn." | Từ chối |

### 8.9 Lỗi kỹ thuật dùng chung cho mọi endpoint HRM

Ba nhánh này do bộ xử lý lỗi chung trả cho **mọi** endpoint HRM, không gắn với một quy tắc nghiệp vụ nào. Trước đây chúng không có ID nên `architecture/api-contract.md` phải tự đề xuất — bản này cấp ID chính thức.

| ID | HTTP | Tình huống | Wording tiếng Việt | Hệ quả |
|---|---|---|---|---|
| E-hrm-062 | 404 | Bản ghi biến mất giữa lúc thao tác (Prisma `P2025`) | "Bản ghi không còn tồn tại, vui lòng tải lại danh sách." | Từ chối thao tác. Xảy ra thật khi hai người cùng làm: A mở form sửa, B xóa bản ghi, A bấm lưu |
| E-hrm-063 | 409 | Vi phạm khóa ngoại (Prisma `P2003`) | "Dữ liệu đang được sử dụng ở nơi khác, không thể thực hiện." | Từ chối thao tác |
| E-hrm-064 | 500 | Lỗi không lường trước | "Lỗi máy chủ nội bộ." | Nội dung lỗi thô chỉ vào nhật ký, không đưa ra người dùng |

> **Ghi chú đổi số (2026-09-07).** `api-contract.md` bản trước đề xuất ba mã này là `E-hrm-052/053/054`, trùng với ba mã mà đợt chốt nghiệp vụ 16/16 đã cấp cho nhóm lỗi ghi nhận nghỉ việc (QĐ #3). Xung đột được phát hiện ở bước BA đối soát chéo và xử lý bằng cách dời ba lỗi kỹ thuật xuống `E-hrm-062/063/064`. Tài liệu hoặc mã nguồn nào còn dùng `E-hrm-052/053/054` với nghĩa kỹ thuật đều **sai**.

---

## 9. Ca sử dụng

| ID | Tác nhân | Mục tiêu | Luồng chính | Yêu cầu liên quan |
|---|---|---|---|---|
| UC-hrm-01 | HR | Dựng cây phòng ban | Tạo phòng ban gốc, rồi tạo phòng ban con bằng cách chọn cha và để hệ thống sinh mã | FR-hrm-001, BR-hrm-001, E-hrm-012, E-hrm-015 |
| UC-hrm-02 | HR | Sắp xếp lại cây tổ chức | Mở phòng ban, đổi phòng ban cha; hệ thống kiểm tồn tại và chống vòng lặp | FR-hrm-003, BR-hrm-006…008, E-hrm-009, E-hrm-010, E-hrm-011 |
| UC-hrm-03 | HR | Tạo hồ sơ nhân viên mới | Nhập họ tên và ngày vào làm, chọn phòng ban, để trống mã cho hệ thống sinh | FR-hrm-006, FR-hrm-007, BR-hrm-003, E-hrm-006, E-hrm-009, E-hrm-017 |
| UC-hrm-04 | HR | Tra cứu nhân viên kèm hợp đồng đang chạy | Lọc theo phòng ban hoặc trạng thái; danh sách hiện luôn số hợp đồng, loại, kiểu lương, hạn, BHXH, TNCN của hợp đồng hiện hành | FR-hrm-008, FR-hrm-012, FR-hrm-014, BR-hrm-019 |
| UC-hrm-05 | HR | Ghi nhận nhân viên nghỉ việc | Mở hồ sơ, đổi trạng thái sang Đã nghỉ và **nhập ngày nghỉ**; hệ thống tự chốt mọi hợp đồng còn mở bằng ngày nghỉ trong cùng một giao dịch và báo lại đã chốt hợp đồng nào; hồ sơ vẫn còn cho quyết toán thuế | FR-hrm-036, FR-hrm-010, BR-hrm-010, BR-hrm-054, BR-hrm-055, E-hrm-052, E-hrm-053, E-hrm-054 |
| UC-hrm-06 | HR | Ký hợp đồng đầu tiên cho nhân viên mới | Mở tab Lịch sử hợp đồng, thêm hợp đồng thử việc | FR-hrm-016, BR-hrm-025, BR-hrm-026, E-hrm-019 |
| UC-hrm-07 | HR | Xem lịch sử hợp đồng của một người | Mở tab Lịch sử hợp đồng; danh sách mới nhất lên đầu, đánh dấu hợp đồng hiện hành | FR-hrm-013, FR-hrm-014, BR-hrm-020 |
| UC-hrm-08 | HR | Chuyển thử việc sang chính thức | Bấm Đổi hợp đồng, chọn ngày chốt và nhập hợp đồng mới; hệ thống chốt hợp đồng cũ và ký hợp đồng mới trong một giao dịch | FR-hrm-018, FR-hrm-019, BR-hrm-023, BR-hrm-024, E-hrm-020, E-hrm-021, E-hrm-022 |
| UC-hrm-09 | HR | Sửa hợp đồng nhập sai | Mở hợp đồng trong lịch sử, sửa rồi lưu | FR-hrm-017, E-hrm-019, E-hrm-023 |
| UC-hrm-10 | HR | Đăng ký người phụ thuộc để giảm trừ gia cảnh | Mở tab Người phụ thuộc, nhập họ tên, quan hệ, mã số thuế và kỳ đăng ký | FR-hrm-021, BR-hrm-030, BR-hrm-031, E-hrm-026, E-hrm-029, E-hrm-030 |
| UC-hrm-11 | Chủ tài khoản | Kết nối kho tài liệu của công ty với Google Drive | Bấm kết nối, đăng nhập Google trong cửa sổ popup, cấp quyền, popup tự đóng. Người không phải chủ tài khoản không thấy nút này mà thấy thông báo nhờ chủ tài khoản liên kết | FR-hrm-027, FR-hrm-028, FR-hrm-029, BR-hrm-043, BR-hrm-045, E-hrm-041, E-hrm-059, E-hrm-047…E-hrm-051 |
| UC-hrm-12 | HR | Đính bản scan CCCD vào hồ sơ nhân viên | Mở tab Hồ sơ, tạo dòng giấy tờ loại CCCD, chọn file ảnh rồi lưu | FR-hrm-025, FR-hrm-030, BR-hrm-035, BR-hrm-036, BR-hrm-042, E-hrm-032, E-hrm-033, E-hrm-039 |
| UC-hrm-13 | HR | Xem lại và thay bản scan cũ | Bấm biểu tượng xem để mở ảnh tại chỗ; tải file mới lên cùng dòng để thay | FR-hrm-031, FR-hrm-032, BR-hrm-037, E-hrm-037, E-hrm-038 |
| UC-hrm-14 | HR | Xóa hồ sơ nhập nhầm | Xóa mềm nhân viên; hệ thống báo số người phụ thuộc bị ẩn theo | FR-hrm-011, BR-hrm-011 |
| UC-hrm-15 | Chủ tài khoản | Ngắt kết nối Drive khi đổi tài khoản công ty | Bấm ngắt kết nối và xác nhận; file đã tải vẫn nằm nguyên trong Drive cũ; hệ thống ghi nhật ký ai ngắt và ngắt khỏi email nào | FR-hrm-035, FR-hrm-043, BR-hrm-047, BR-hrm-066, E-hrm-042 |
| UC-hrm-16 | Chủ tài khoản hoặc HR | Khai bộ giấy tờ bắt buộc của công ty | Mở danh mục giấy tờ bắt buộc, chọn loại hợp đồng và thêm các loại giấy tờ cần có, đánh dấu bắt buộc hay chỉ nhắc | FR-hrm-038, BR-hrm-063, E-hrm-061 |
| UC-hrm-17 | HR | Rà hồ sơ thiếu và giấy tờ sắp hết hạn | Xem cột chỉ báo đủ/thiếu trên danh sách nhân viên để biết ai còn thiếu giấy tờ gì; mở danh sách cảnh báo hạn để biết giấy tờ nào đã hết hạn hoặc sắp hết hạn | FR-hrm-039, FR-hrm-040, FR-hrm-041, BR-hrm-062, BR-hrm-064, BR-hrm-065, E-hrm-060 |

---

## 10. Tiêu chí nghiệm thu

Chỉ liệt kê các quy tắc có rẽ nhánh nghiệp vụ đáng chú ý. Các kiểm tra định dạng và độ dài đơn thuần xem thẳng Mục 8.

**AC-hrm-01** (FR-hrm-006, BR-hrm-003 — tự sinh mã nhân viên)
- **Given** công ty đã có nhân viên `NV0001` và `NV0003`, trong đó `NV0002` đã bị xóa mềm
- **When** người dùng tạo nhân viên mới và để trống mã
- **Then** hệ thống cấp mã `NV0004`, **không** cấp lại `NV0002`

**AC-hrm-02** (FR-hrm-006, BR-hrm-004, E-hrm-017 — mã đã xóa vẫn bị coi là đã dùng)
- **Given** nhân viên `NV0002` đã bị xóa mềm
- **When** người dùng tạo nhân viên mới và tự nhập mã `NV0002`
- **Then** hệ thống từ chối với lỗi 409 E-hrm-017 nêu đích danh `NV0002`, **không** trả câu chung "dữ liệu bị trùng"

**AC-hrm-03** (FR-hrm-001, BR-hrm-001 — sinh mã theo cây)
- **Given** phòng ban `PB01` đã có con `PB01.01`
- **When** người dùng tạo phòng ban con của `PB01` và để trống mã
- **Then** hệ thống cấp `PB01.02`

**AC-hrm-04** (FR-hrm-003, BR-hrm-008, E-hrm-011 — chống vòng lặp cây)
- **Given** cây phòng ban là `PB01` chứa `PB01.01` chứa `PB01.01.01`
- **When** người dùng sửa `PB01` và chọn `PB01.01.01` làm phòng ban cha
- **Then** hệ thống từ chối với lỗi 409 E-hrm-011

**AC-hrm-05** (FR-hrm-004, BR-hrm-009, E-hrm-014 — chặn xóa phòng ban còn người)
- **Given** phòng ban `PB01` có 3 nhân viên đang làm và 2 nhân viên đã nghỉ, tất cả đều chưa xóa mềm
- **When** người dùng xóa `PB01`
- **Then** hệ thống từ chối với lỗi 409 nêu đủ ba con số: "đang có 5 nhân viên (3 đang làm, 2 đã nghỉ), không thể xóa."

**AC-hrm-06** (FR-hrm-004, BR-hrm-009 — cột số nhân viên chỉ đếm người đang làm)
- **Given** phòng ban `PB02` chỉ còn 2 nhân viên và cả hai đều `status = 0`
- **When** người dùng xem danh sách phòng ban
- **Then** cột số nhân viên của `PB02` hiện `0`, **và** thao tác xóa `PB02` vẫn bị từ chối

**AC-hrm-07** (FR-hrm-014, BR-hrm-019 — chọn hợp đồng hiện hành)
- **Given** nhân viên có hợp đồng A từ 01/01/2026 đến 31/03/2026, hợp đồng B từ 01/04/2026 không thời hạn, và hôm nay là 15/04/2026
- **When** người dùng xem danh sách nhân viên
- **Then** cột hợp đồng hiện hành hiện thông tin của hợp đồng B

**AC-hrm-08** (FR-hrm-014, BR-hrm-019 — chưa có hợp đồng nào đang hiệu lực)
- **Given** nhân viên chỉ có một hợp đồng đã hết hạn ngày 31/12/2025, và hôm nay là 15/04/2026
- **When** người dùng xem danh sách nhân viên
- **Then** cột hợp đồng hiện hành vẫn hiện hợp đồng đã hết hạn đó (hợp đồng mới nhất trong lịch sử), **không** để trống

**AC-hrm-09** (FR-hrm-014, BR-hrm-019 — chưa từng ký hợp đồng)
- **Given** nhân viên chưa có hợp đồng nào
- **When** người dùng xem chi tiết nhân viên
- **Then** cả sáu trường hợp đồng hiện hành trả về rỗng, **không** sinh số hợp đồng tạm

**AC-hrm-10** (FR-hrm-018, BR-hrm-023, BR-hrm-024 — đổi hợp đồng thành công)
- **Given** nhân viên đang có hợp đồng thử việc từ 01/01/2026 không thời hạn, và hôm nay là 31/03/2026
- **When** người dùng đổi hợp đồng với ngày chốt 31/03/2026 và hợp đồng mới bắt đầu 01/04/2026
- **Then** hợp đồng cũ được đặt ngày kết thúc 31/03/2026, hợp đồng mới được tạo, cả hai cùng thành công trong một giao dịch, và phản hồi báo đã chốt hợp đồng cũ

**AC-hrm-11** (FR-hrm-019, BR-hrm-024d — không có gì để chốt)
- **Given** nhân viên chưa có hợp đồng nào
- **When** người dùng gọi đổi hợp đồng và vẫn gửi kèm ngày chốt
- **Then** hệ thống chỉ tạo hợp đồng mới và phản hồi báo **không** chốt hợp đồng cũ nào

**AC-hrm-12** (BR-hrm-024a, E-hrm-021 — thiếu ngày chốt)
- **Given** nhân viên đang có một hợp đồng hiệu lực
- **When** người dùng gọi đổi hợp đồng mà không gửi ngày chốt
- **Then** hệ thống hủy giao dịch và trả lỗi 409 E-hrm-021

**AC-hrm-13** (BR-hrm-024b, E-hrm-022 — ngày chốt trùng ngày bắt đầu hợp đồng cũ)
- **Given** hợp đồng đang hiệu lực bắt đầu ngày 01/04/2026
- **When** người dùng đổi hợp đồng với ngày chốt đúng 01/04/2026
- **Then** hệ thống hủy giao dịch và trả lỗi 409 E-hrm-022 (bằng nhau cũng bị chặn, không chỉ nhỏ hơn)

**AC-hrm-14** (BR-hrm-019 — ngày đổi hợp đồng, hợp đồng cũ vẫn là hiện hành)
- **Given** hôm nay là 31/03/2026 và người dùng vừa đổi hợp đồng với ngày chốt 31/03/2026, hợp đồng mới bắt đầu 01/04/2026
- **When** người dùng xem lại danh sách nhân viên ngay trong ngày 31/03/2026
- **Then** cột hợp đồng hiện hành **vẫn** hiện hợp đồng cũ; sang ngày 01/04/2026 mới chuyển sang hợp đồng mới

**AC-hrm-15** (FR-hrm-016, BR-hrm-025 — luật công đoàn một chiều, chiều tắt)
- **Given** nhân viên đang có cờ đoàn viên công đoàn bằng Đúng
- **When** người dùng ghi một hợp đồng loại `khoan` cho nhân viên đó
- **Then** cờ đoàn viên công đoàn của nhân viên chuyển thành Sai trong cùng giao dịch

**AC-hrm-16** (FR-hrm-017, BR-hrm-025 — luật công đoàn một chiều, chiều không bật lại)
- **Given** nhân viên có cờ đoàn viên công đoàn bằng Sai do đã từng ký hợp đồng khoán
- **When** người dùng ghi tiếp một hợp đồng loại `xac_dinh` cho nhân viên đó
- **Then** cờ đoàn viên công đoàn **giữ nguyên bằng Sai**, hệ thống không tự bật lại

**AC-hrm-17** (BR-hrm-026 — hợp đồng một ngày nay được chấp nhận) `[SỬA THEO QĐ #6]`
- **Given** người dùng nhập hợp đồng có ngày bắt đầu và ngày kết thúc **cùng là** 01/04/2026
- **When** người dùng lưu
- **Then** hệ thống **lưu thành công**; hợp đồng có hiệu lực đúng một ngày 01/04/2026

**AC-hrm-18** (BR-hrm-022, E-hrm-024 — chồng lấn hợp đồng CÙNG loại) `[CHƯA ĐẠT VỚI MÃ HIỆN TẠI]` `[SỬA THEO QĐ #1]`
- **Given** nhân viên đã có hợp đồng loại `xac_dinh` từ 01/01/2026 đến 31/12/2026
- **When** người dùng tạo tiếp một hợp đồng **cũng loại `xac_dinh`** từ 01/06/2026 đến 31/05/2027 cho cùng nhân viên
- **Then** hệ thống từ chối với lỗi 409 E-hrm-024 và nêu rõ hợp đồng nào đang chồng lấn

**AC-hrm-19** (FR-hrm-011, BR-hrm-011 — xóa mềm nhân viên)
- **Given** nhân viên có 2 người phụ thuộc, 3 hợp đồng và 4 giấy tờ
- **When** người dùng xóa nhân viên
- **Then** hệ thống trả về số người phụ thuộc bị ẩn theo bằng 2; danh sách người phụ thuộc, hợp đồng và giấy tờ đều **không còn** dòng nào của người đó; các dòng vẫn nằm trong cơ sở dữ liệu

**AC-hrm-20** (FR-hrm-021, BR-hrm-030, E-hrm-026 — chống trùng giảm trừ gia cảnh)
- **Given** nhân viên `NV0001` đã có người phụ thuộc mang mã số thuế `8012345678`
- **When** người dùng thêm người phụ thuộc thứ hai cho `NV0001` cũng mang mã số thuế đó
- **Then** hệ thống từ chối với lỗi 409 E-hrm-026 nêu rõ lý do sẽ tính giảm trừ hai lần

**AC-hrm-21** (BR-hrm-030 — người phụ thuộc chưa có mã số thuế)
- **Given** nhân viên `NV0001` đã có một người phụ thuộc **chưa** nhập mã số thuế
- **When** người dùng thêm người phụ thuộc thứ hai cũng chưa nhập mã số thuế
- **Then** hệ thống cho lưu bình thường

**AC-hrm-22** (FR-hrm-023, BR-hrm-030 — sửa không tự coi là trùng chính mình)
- **Given** một người phụ thuộc đang mang mã số thuế `8012345678`
- **When** người dùng sửa họ tên của chính dòng đó và giữ nguyên mã số thuế
- **Then** hệ thống cho lưu, không báo trùng

**AC-hrm-23** (FR-hrm-030, BR-hrm-042 — tạo lười cây thư mục)
- **Given** công ty đã kết nối Drive nhưng chưa từng tải file nào
- **When** người dùng tải file scan đầu tiên cho nhân viên `NV0001` tên "Nguyễn Văn A"
- **Then** hệ thống tạo `maxv`, rồi `<mã số thuế> - <tên công ty>`, rồi `NV0001 - Nguyễn Văn A`, ghi nhớ ID của hai thư mục sau, và tải file vào thư mục cuối

**AC-hrm-24** (FR-hrm-030, BR-hrm-042 — đổi tên nhân viên không làm đứt liên kết)
- **Given** nhân viên `NV0001` đã có thư mục riêng trên Drive và người dùng đã đổi tên nhân viên thành "Nguyễn Văn An"
- **When** người dùng tải thêm một file scan cho nhân viên đó
- **Then** hệ thống tải vào **đúng thư mục cũ theo ID**, không tạo thư mục mới theo tên mới

**AC-hrm-25** (FR-hrm-031, BR-hrm-037 — thay file trên một dòng giấy tờ)
- **Given** dòng giấy tờ đã có một file scan
- **When** người dùng tải file mới lên chính dòng đó
- **Then** hệ thống tải file mới lên thành công **trước**, rồi mới xóa file cũ; nếu xóa file cũ thất bại thì thao tác vẫn thành công và con trỏ trỏ vào file mới

**AC-hrm-26** (BR-hrm-046, E-hrm-040 — tự ngắt đúng trường hợp)
- **Given** khách đã gỡ quyền của ứng dụng trong tài khoản Google
- **When** người dùng tải file scan lên
- **Then** hệ thống xóa kết nối Drive đã lưu, xóa mọi ID thư mục nhân viên, và trả lỗi 409 E-hrm-040 mời kết nối lại

**AC-hrm-27** (BR-hrm-046, E-hrm-046 — không tự ngắt khi mất mạng)
- **Given** máy chủ tạm thời không ra được internet
- **When** người dùng tải file scan lên
- **Then** hệ thống trả lỗi 502 E-hrm-046 nói rõ là sự cố mạng phía máy chủ, và **giữ nguyên** kết nối Drive của công ty

**AC-hrm-28** (BR-hrm-045, E-hrm-041 — đổi tài khoản Drive)
- **Given** công ty **đã** kết nối Drive và người dùng hiện tại có vai trò `OWNER_EMPLOYEE`
- **When** người dùng gọi endpoint kết nối Google Drive
- **Then** hệ thống từ chối với lỗi 403 E-hrm-041

**AC-hrm-29** (BR-hrm-043 — vé OAuth dùng một lần)
- **Given** người dùng đã hoàn tất một lượt kết nối Drive thành công
- **When** người đó (hoặc ai nhặt được đường dẫn) gọi lại callback với đúng vé cũ
- **Then** hệ thống từ chối và hiện E-hrm-049, vì cookie giữ vé đã bị xóa ngay ở lần dùng đầu

**AC-hrm-30** (BR-hrm-047 — đổi sang tài khoản Google khác)
- **Given** công ty đang kết nối tài khoản `a@ct.vn` và đã có nhiều nhân viên có thư mục riêng
- **When** chủ tài khoản kết nối lại bằng tài khoản `b@ct.vn`
- **Then** hệ thống xóa ID thư mục gốc và mọi ID thư mục nhân viên, **giữ nguyên** con trỏ file của các giấy tờ cũ; mở file cũ về sau sẽ nhận E-hrm-038 chứ không phải báo mất

**AC-hrm-31** (BR-hrm-047 — kết nối lại đúng tài khoản cũ)
- **Given** công ty đang kết nối tài khoản `a@ct.vn`
- **When** chủ tài khoản kết nối lại vẫn bằng `a@ct.vn`
- **Then** hệ thống **không** dọn ID thư mục nhân viên, vì mọi ID vẫn dùng được

**AC-hrm-32** (FR-hrm-033, BR-hrm-038 — gỡ file khác xóa dòng)
- **Given** dòng giấy tờ đã có file scan
- **When** người dùng bấm gỡ file
- **Then** đúng file đó bị xóa trên Drive và khỏi danh sách file của giấy tờ; **các file còn lại và dòng giấy tờ vẫn còn** `[SỬA THEO QĐ #21]`. Gỡ file cuối cùng thì dòng giấy tờ trở về trạng thái chưa đính file, không bị xóa theo

**AC-hrm-33** (FR-hrm-034, BR-hrm-039 — xóa dòng giấy tờ đang có file) `[CHƯA ĐẠT VỚI MÃ HIỆN TẠI]` `[SỬA THEO QĐ #12]`
- **Given** dòng giấy tờ đã có file scan trên Drive, và hộp xác nhận đã nêu đích danh tên file
- **When** người dùng xác nhận xóa cả dòng giấy tờ
- **Then** hệ thống xóa file trên Drive **và** xóa dòng khỏi cơ sở dữ liệu; nhật ký ghi lại người thao tác (BR-hrm-066)

**AC-hrm-34** (BR-hrm-051 — quản trị hệ thống không đọc được dữ liệu tenant, có chủ đích) `[QĐ #9]`
- **Given** người dùng đăng nhập với vai trò `ADMIN`
- **When** người đó gọi bất kỳ endpoint HRM nào có chạm dữ liệu công ty
- **Then** hệ thống từ chối với lỗi 403 — đây là kết quả **mong muốn**, ca kiểm thử này phải xanh khi 403 chứ không phải khi đọc được dữ liệu

**AC-hrm-35** (BR-hrm-050 — quyền bị thu hồi giữa chừng)
- **Given** người dùng đang cầm vé đăng nhập còn hạn nhưng quyền vào công ty vừa bị thu hồi
- **When** người đó gọi bất kỳ endpoint HRM nào, kể cả ba endpoint Drive không chạm cơ sở dữ liệu công ty
- **Then** hệ thống từ chối với lỗi 403, vì quyền được tra lại trong cơ sở dữ liệu ở mỗi lượt gọi

**AC-hrm-36** (BR-hrm-022 — hai hợp đồng KHÁC loại được chạy song song) `[MỚI — QĐ #1]`
- **Given** nhân viên đã có hợp đồng loại `xac_dinh` từ 01/01/2026 đến 31/12/2026
- **When** người dùng tạo thêm hợp đồng loại `khoan` từ 01/06/2026 đến 31/08/2026 cho cùng nhân viên
- **Then** hệ thống **lưu thành công**, không báo chồng lấn; lịch sử hợp đồng hiện đủ hai dòng

**AC-hrm-37** (BR-hrm-022 — chồng lấn tính cả hai đầu mút) `[MỚI — QĐ #1 và QĐ #6]`
- **Given** nhân viên đã có hợp đồng loại `thoi_vu` từ 01/03/2026 đến 31/03/2026
- **When** người dùng tạo thêm hợp đồng **cùng loại `thoi_vu`** đúng một ngày 31/03/2026 (bắt đầu trùng kết thúc)
- **Then** hệ thống từ chối với lỗi 409 E-hrm-024 — ngày 31/03/2026 thuộc cả hai khoảng, dù chỉ chạm nhau đúng một ngày

**AC-hrm-38** (BR-hrm-019 — hợp đồng ký trước cho tương lai là hiện hành ngay khi ký) `[MỚI — QĐ #2]`
- **Given** hôm nay là 15/04/2026, nhân viên chỉ có một hợp đồng đã hết hạn ngày 31/03/2026
- **When** người dùng ký thêm một hợp đồng bắt đầu 01/06/2026
- **Then** cột hợp đồng hiện hành trên danh sách nhân viên chuyển sang hợp đồng mới **ngay lập tức**, dù nó chưa tới ngày hiệu lực; và tài liệu ghi rõ phân hệ Lương không được lấy mức lương này cho kỳ lương tháng 4 và tháng 5

**AC-hrm-39** (FR-hrm-036, BR-hrm-054, BR-hrm-055 — nghỉ việc tự chốt hợp đồng) `[MỚI — QĐ #3]`
- **Given** nhân viên đang làm, có một hợp đồng không thời hạn bắt đầu 01/01/2026 và một hợp đồng khoán từ 01/02/2026 đến 31/12/2026
- **When** người dùng ghi nhận nghỉ việc với ngày nghỉ 30/06/2026
- **Then** trong cùng một giao dịch: trạng thái nhân viên thành Đã nghỉ, `ngay_nghi_viec` bằng 30/06/2026, **cả hai** hợp đồng được đặt `ngay_ket_thuc` bằng 30/06/2026, và phản hồi liệt kê đủ hai số hợp đồng đã chốt

**AC-hrm-40** (BR-hrm-054, E-hrm-052 — thiếu ngày nghỉ) `[MỚI — QĐ #3]`
- **Given** nhân viên đang ở trạng thái Đang làm
- **When** người dùng đổi trạng thái sang Đã nghỉ mà không nhập ngày nghỉ
- **Then** hệ thống từ chối với lỗi 400 E-hrm-052; trạng thái nhân viên **không đổi** và không hợp đồng nào bị chốt

**AC-hrm-41** (BR-hrm-055, E-hrm-054 — nghỉ việc vướng hợp đồng tương lai) `[MỚI — QĐ #3]`
- **Given** nhân viên đang làm, có một hợp đồng đang hiệu lực và một hợp đồng ký trước bắt đầu 01/09/2026
- **When** người dùng ghi nhận nghỉ việc với ngày nghỉ 30/06/2026
- **Then** hệ thống hủy toàn bộ giao dịch, trả lỗi 409 E-hrm-054 nêu đích danh số hợp đồng bắt đầu 01/09/2026; trạng thái nhân viên **không đổi**, hợp đồng đang hiệu lực **không** bị chốt, và hợp đồng tương lai **không** bị xóa

**AC-hrm-42** (BR-hrm-056, E-hrm-055 — số hợp đồng duy nhất toàn công ty) `[MỚI — QĐ #4]`
- **Given** nhân viên `NV0001` đã có hợp đồng số `HD-2026-001`
- **When** người dùng tạo hợp đồng số `HD-2026-001` cho nhân viên `NV0002`
- **Then** hệ thống từ chối với lỗi 409 E-hrm-055 nêu rõ nhân viên `NV0001` đang giữ số đó

**AC-hrm-43** (BR-hrm-057, E-hrm-056 — lương chính phải lớn hơn 0) `[MỚI — QĐ #5]`
- **Given** người dùng đang tạo hợp đồng và để lương chính bằng 0
- **When** người dùng lưu
- **Then** hệ thống từ chối với lỗi 400 E-hrm-056

**AC-hrm-44** (BR-hrm-058, E-hrm-057 — lương BHXH bắt buộc khi trích BHXH) `[MỚI — QĐ #5]`
- **Given** người dùng đang tạo hợp đồng với lương chính 10.000.000, bật ô Trích BHXH và để lương đóng BHXH trống
- **When** người dùng lưu
- **Then** hệ thống từ chối với lỗi 400 E-hrm-057. **Và** khi người dùng tắt ô Trích BHXH rồi lưu lại với lương đóng BHXH vẫn trống thì hệ thống lưu thành công

**AC-hrm-45** (BR-hrm-059, E-hrm-058 — che dữ liệu lương theo quyền) `[MỚI — QĐ #8]`
- **Given** người dùng có vai trò `OWNER_EMPLOYEE`, vào được công ty nhưng **không** được cấp quyền xem dữ liệu lương
- **When** người đó mở danh sách nhân viên và mở tab Lịch sử hợp đồng
- **Then** danh sách nhân viên trả về **không chứa** lương chính, lương BHXH và các trường tài khoản ngân hàng; lời gọi lịch sử hợp đồng bị từ chối với lỗi 403 E-hrm-058

**AC-hrm-46** (BR-hrm-059 — không còn tải toàn bộ hợp đồng công ty) `[MỚI — QĐ #8]`
- **Given** người dùng có đủ quyền xem dữ liệu lương
- **When** người đó gọi danh sách hợp đồng **không kèm mã nhân viên**
- **Then** hệ thống từ chối với lỗi kiểm dữ liệu 400 (E-hrm-006) vì thiếu trường bắt buộc, **không** trả về hợp đồng của toàn công ty

**AC-hrm-47** (BR-hrm-045, E-hrm-059 — chỉ chủ tài khoản nối Drive lần đầu) `[MỚI — QĐ #10]`
- **Given** công ty **chưa từng** kết nối Drive và người dùng hiện tại có vai trò `OWNER_EMPLOYEE`
- **When** người đó mở tab Hồ sơ của một nhân viên
- **Then** giao diện **không** hiện nút "Kết nối Google Drive" mà hiện thông báo nhờ chủ tài khoản liên kết; nếu gọi thẳng endpoint kết nối thì nhận lỗi 403 E-hrm-059

**AC-hrm-48** (BR-hrm-045 — nối xong thì mọi người dùng được) `[MỚI — QĐ #10]`
- **Given** chủ tài khoản đã liên kết Drive cho công ty
- **When** người dùng `OWNER_EMPLOYEE` tải một file scan lên một dòng giấy tờ
- **Then** hệ thống tải file lên thành công, không đòi thêm quyền nào

**AC-hrm-49** (BR-hrm-060 — ngừng hoạt động phòng ban còn nhân viên) `[MỚI — QĐ #11]`
- **Given** phòng ban `PB01` còn 3 nhân viên đang làm và 2 nhân viên đã nghỉ
- **When** người dùng chuyển `PB01` sang Ngừng hoạt động và xác nhận
- **Then** hộp xác nhận nêu đúng "5 nhân viên (3 đang làm, 2 đã nghỉ)"; sau khi xác nhận, `PB01` chuyển sang `status = 0` và cả 5 nhân viên **vẫn giữ nguyên** `ma_pb` bằng `PB01`

**AC-hrm-50** (BR-hrm-061 — ô chọn phòng ban giữ phòng đang gán) `[MỚI — QĐ #11]`
- **Given** nhân viên `NV0001` đang thuộc phòng ban `PB01`, và `PB01` đã chuyển sang Ngừng hoạt động
- **When** người dùng mở hồ sơ `NV0001`, chỉ sửa họ tên rồi bấm Lưu
- **Then** ô chọn phòng ban hiện `PB01` (kèm nhãn ngừng hoạt động) chứ **không** hiện rỗng; sau khi lưu, `NV0001` **vẫn thuộc** `PB01`. Đồng thời ô chọn **không** liệt kê các phòng ban ngừng hoạt động khác mà nhân viên này không thuộc

**AC-hrm-51** (BR-hrm-030, E-hrm-026 — người phụ thuộc trùng MST giữa hai nhân viên) `[MỚI — QĐ #7]`
- **Given** nhân viên `NV0001` đã có người phụ thuộc mang mã số thuế `8012345678`
- **When** người dùng thêm người phụ thuộc mang cùng mã số thuế đó cho nhân viên `NV0002`
- **Then** hệ thống từ chối với lỗi 409 E-hrm-026 nêu đích danh `NV0001` đang giữ mã số thuế đó

**AC-hrm-52** (BR-hrm-062, E-hrm-060 — ngày hết hạn giấy tờ) `[MỚI — QĐ #14]`
- **Given** người dùng nhập giấy tờ có ngày cấp 01/03/2026
- **When** người dùng nhập ngày hết hạn 28/02/2026 rồi lưu
- **Then** hệ thống từ chối với lỗi 400 E-hrm-060. **Và** khi nhập ngày hết hạn đúng bằng 01/03/2026 thì hệ thống lưu thành công

**AC-hrm-53** (BR-hrm-064 — chỉ báo hồ sơ đủ/thiếu) `[MỚI — QĐ #14]`
- **Given** công ty đã khai bộ giấy tờ bắt buộc cho loại hợp đồng `xac_dinh` gồm hai loại giấy tờ, và nhân viên `NV0001` đang có hợp đồng hiệu lực loại `xac_dinh` nhưng hồ sơ mới có một trong hai loại đó
- **When** người dùng xem danh sách nhân viên
- **Then** `NV0001` hiện là hồ sơ **thiếu**, kèm đúng tên loại giấy tờ còn thiếu. **Và** với nhân viên chưa có hợp đồng nào thì chỉ báo trả về **rỗng**, không phải Thiếu

**AC-hrm-54** (BR-hrm-065 — trạng thái hạn giấy tờ) `[MỚI — QĐ #14]`
- **Given** hôm nay là 07/09/2026, một giấy tờ có ngày hết hạn 01/09/2026 và một giấy tờ khác không nhập ngày hết hạn
- **When** người dùng mở danh sách cảnh báo hạn giấy tờ
- **Then** giấy tờ hết hạn 01/09/2026 hiện là **đã hết hạn**; giấy tờ không có ngày hết hạn **không** xuất hiện trong danh sách và trạng thái hạn của nó là rỗng. Khi ngưỡng "sắp hết hạn" chưa được khai (OQ-hrm-14), danh sách **không** chứa dòng nào ở trạng thái sắp hết hạn

**AC-hrm-55** (BR-hrm-063, E-hrm-061 — danh mục giấy tờ bắt buộc không trùng cặp) `[MỚI — QĐ #14]`
- **Given** công ty đã khai loại hợp đồng `xac_dinh` cần giấy tờ loại `cccd`
- **When** người dùng khai lại đúng cặp đó lần nữa
- **Then** hệ thống từ chối với lỗi 409 E-hrm-061

**AC-hrm-56** (BR-hrm-066, NFR-hrm-011 — nhật ký thao tác phá hủy) `[MỚI — QĐ #15]`
- **Given** người dùng có đủ quyền, đang xem một hợp đồng
- **When** người đó xóa hợp đồng, rồi sửa lương của một hợp đồng khác, rồi xóa một người phụ thuộc, rồi xóa một dòng tài liệu, rồi ngắt kết nối Drive
- **Then** nhật ký có đúng năm bản ghi, mỗi bản ghi có thời điểm, người thao tác, công ty, loại thao tác và khóa nghiệp vụ của đối tượng; **không** bản ghi nào chứa giá trị trước hoặc sau của các trường. Sửa một hợp đồng mà **không** đổi lương thì **không** sinh bản ghi nhật ký nào

---

## 11. Các điểm nghiệp vụ còn tranh cãi — phương án và khuyến nghị

Năm điểm dưới đây là chỗ mã hiện tại và mong đợi nghiệp vụ chưa khớp. Mỗi điểm nêu 2–3 phương án kèm bảng so sánh và khuyến nghị.

> **Cả năm điểm đã được chốt ngày 2026-09-07.** Phần phân tích phương án được giữ nguyên làm hồ sơ quyết định — đọc để biết vì sao chọn như vậy, đừng đọc như câu hỏi còn mở. Kết quả chốt ghi ở đầu mỗi mục và đã được đưa thành quy tắc ở Mục 5.

### 11.1 Chống chồng lấn thời gian hợp đồng (BR-hrm-022, E-hrm-024)

> **ĐÃ CHỐT (QĐ #1 + QĐ #6):** chọn **P1 chặn cứng, nhưng chỉ chặn trong phạm vi CÙNG một loại hợp đồng**. Hai hợp đồng khác loại được chạy song song. Khoảng ngày tính cả hai đầu mút. Đã viết thành BR-hrm-022, BR-hrm-052, BR-hrm-053 và E-hrm-024. P3 (cờ ghi đè kèm lý do) bị loại vì việc chừa cửa đã được giải quyết bằng cách tách theo loại hợp đồng, không cần thêm cờ và trường lý do.

**Hiện trạng**: không có kiểm tra nào. Gọi `POST /hrm/hop-dong` hai lần với hai khoảng thời gian giao nhau là tạo được hai hợp đồng cùng hiệu lực. Khi đó quy tắc chọn hợp đồng hiện hành trả về cái nào cũng "đúng" như nhau, tức là không xác định — và đó chính là mức lương sẽ chảy vào bảng lương.

| | P1. Chặn cứng mọi đường ghi | P2. Chỉ cảnh báo, vẫn cho lưu | P3. Chặn cứng, có cờ ghi đè kèm lý do |
|---|---|---|---|
| **Cách làm** | Kiểm chồng lấn trong giao dịch ở cả tạo, sửa và đổi hợp đồng; vi phạm thì trả 409 nêu rõ hợp đồng đang vướng | Trả 201 kèm danh sách cảnh báo; giao diện hiện dấu hiệu cảnh báo trên dòng | Như P1, nhưng thân yêu cầu có thêm cờ chấp nhận chồng lấn và trường lý do bắt buộc |
| **Ưu** | Dữ liệu lương luôn xác định. Đúng thực tế pháp lý: một người một thời điểm một hợp đồng lao động | Không chặn nghiệp vụ ngoại lệ (nhập bù hồ sơ cũ chồng chéo, hợp đồng khoán song song với hợp đồng chính) | Vừa bảo vệ mặc định, vừa chừa cửa cho ngoại lệ và có vết ai quyết định |
| **Nhược** | Chặn oan khi nhập bù dữ liệu lịch sử lộn xộn. Nhân viên có đồng thời hợp đồng lao động và hợp đồng khoán sẽ không nhập được | Không giải quyết vấn đề gốc: hợp đồng hiện hành vẫn không xác định. Cảnh báo dễ bị bỏ qua | Thêm hai trường và một nhánh giao diện; phải định nghĩa ai được ghi đè |
| **Độ phức tạp** | Thấp — một hàm kiểm dùng chung cho ba đường ghi | Rất thấp | Trung bình |
| **Rủi ro dữ liệu** | Thấp | **Cao** | Thấp |

**Khuyến nghị: P1 cho đợt này.** Lý do: mục tiêu G3 là cấp dữ liệu đúng cho phân hệ Lương, mà hai hợp đồng chồng nhau làm mức lương trở nên không xác định — đây là loại lỗi âm thầm, phát hiện được thì đã trả lương sai. P3 chỉ nên làm khi nghiệp vụ xác nhận có tồn tại thật trường hợp một người hai hợp đồng song song (câu hỏi OQ-hrm-01). P2 bị loại vì không giải quyết vấn đề gốc.

**Kèm theo P1, phải sửa mốc "hôm nay" trong đường đổi hợp đồng cho khớp giờ Việt Nam (BR-hrm-021)** — nếu không, hàm kiểm chồng lấn và hàm chọn hợp đồng hiện hành sẽ bất đồng trong 7 tiếng mỗi ngày.

### 11.2 Xóa hợp đồng lao động (BR-hrm-029)

> **CHƯA CHỐT.** Vòng quyết định ngày 2026-09-07 không đụng tới điểm này; BR-hrm-029 giữ nguyên hành vi xóa cứng không điều kiện. Phần bổ sung duy nhất từ vòng này: xóa hợp đồng nay phải ghi nhật ký người thao tác (BR-hrm-066), nên nếu có xóa nhầm thì ít nhất còn lần được ai làm. Khuyến nghị P3 dưới đây vẫn còn giá trị và cần một vòng quyết định riêng.

**Hiện trạng**: xóa cứng, không điều kiện. Xóa được cả hợp đồng đang hiệu lực và hợp đồng đã dùng để chốt lương kỳ trước. Không hoàn tác, không vết.

| | P1. Giữ xóa cứng, thêm xác nhận ở giao diện | P2. Chuyển sang xóa mềm | P3. Cấm xóa hợp đồng đã hiệu lực, chỉ cho xóa hợp đồng chưa tới ngày bắt đầu |
|---|---|---|---|
| **Cách làm** | Không đổi máy chủ; giao diện bắt gõ xác nhận với hợp đồng đang hiệu lực | Thêm cờ đã xóa vào bảng hợp đồng, mọi truy vấn lọc theo | Máy chủ trả 409 khi hợp đồng có ngày bắt đầu từ hôm nay trở về trước |
| **Ưu** | Rẻ nhất, không đổi dữ liệu | Hoàn tác được, giữ được vết lịch sử | Bảo vệ đúng thứ cần bảo vệ: hợp đồng đã phát sinh hiệu lực pháp lý và đã có thể dùng tính lương |
| **Nhược** | Vẫn mất dữ liệu thật khi bấm nhầm | Thêm cột và phải rà mọi truy vấn; phức tạp thêm cho một bảng vốn chỉ có ~5 dòng mỗi nhân viên | Không sửa được hợp đồng lịch sử nhập sai — phải thêm đường sửa thay vì xóa |
| **Độ phức tạp** | Rất thấp | Trung bình | Thấp |
| **Rủi ro dữ liệu** | Trung bình | Thấp | Thấp |

**Khuyến nghị: P3 kết hợp phần xác nhận của P1.** Cấm xóa hợp đồng đã tới ngày hiệu lực (thay bằng sửa hoặc bằng thao tác đổi hợp đồng), cho phép xóa tự do hợp đồng ký trước cho tương lai vì nó chưa phát sinh gì. P2 để dành cho lúc có phân hệ Lương thật sự khóa sổ theo kỳ — khi đó cần cả cơ chế khóa kỳ chứ không riêng cờ xóa mềm.

### 11.3 Nhân viên chưa có hợp đồng nào (BR-hrm-018)

> **CHƯA CHỐT chính thức, nhưng đã có hướng.** Vòng quyết định ngày 2026-09-07 không đưa điểm này ra bỏ phiếu. Hướng P3 (cho phép, có chỉ báo trực quan) vẫn là khuyến nghị và đã được xếp vào đợt P2 của lộ trình. Từ QĐ #14, hồ sơ nhân viên có thêm chỉ báo đủ/thiếu giấy tờ (BR-hrm-064), và chỉ báo đó **trả về rỗng** cho nhân viên chưa có hợp đồng — tức là màn hình đã có sẵn một chỗ để hiện thêm nhãn "chưa có hợp đồng" mà không phải dựng cột mới.

**Hiện trạng**: cho phép. Tạo nhân viên và ký hợp đồng là hai lần ghi tách rời; sáu trường hợp đồng hiện hành trả về rỗng. Tài liệu tham chiếu `docs/nestjs/hr` lại yêu cầu ngược lại (bắt buộc tạo kèm hợp đồng đầu tiên trong một giao dịch).

| | P1. Giữ nguyên — cho phép, không cảnh báo | P2. Bắt buộc tạo kèm hợp đồng đầu tiên | P3. Cho phép, nhưng đánh dấu và chặn ở cửa vào phân hệ Lương |
|---|---|---|---|
| **Cách làm** | Không đổi | Gộp hai thân yêu cầu, một giao dịch, hỏng phần hợp đồng thì không tạo nhân viên | Giữ nguyên đường ghi; danh sách nhân viên đánh dấu "chưa có hợp đồng"; kỳ lương từ chối tính cho người chưa có hợp đồng hiệu lực |
| **Ưu** | Đúng thực tế: hồ sơ ứng viên vào trước, hợp đồng ký sau vài ngày. Nhập bù dữ liệu cũ dễ | Không bao giờ có nhân viên "mồ côi" không lương | Vẫn linh hoạt lúc nhập, nhưng lỗi lộ ra sớm và lộ ở đúng chỗ nó gây hại |
| **Nhược** | Đến kỳ lương mới phát hiện thiếu hợp đồng, lúc đó gấp | Chặn cứng luồng nhập thực tế; nhập bù hàng trăm hồ sơ cũ mà chưa rõ hợp đồng sẽ bế tắc | Cần thêm chỉ báo ở giao diện và một quy tắc ở phân hệ Lương (chưa làm) |
| **Độ phức tạp** | Không | Trung bình (đổi cả giao diện lẫn hợp đồng API) | Thấp ở đợt này, phần còn lại thuộc phân hệ Lương |
| **Rủi ro nghiệp vụ** | Trung bình | Thấp nhưng đổi lấy ma sát vận hành cao | Thấp |

**Khuyến nghị: P3.** Giữ đúng quyết định kiến trúc đã có (hợp đồng là bảng riêng, tính lúc đọc) và không dựng rào ở chỗ sai. Phần cần làm ngay trong đợt này chỉ là **chỉ báo trực quan** trên danh sách nhân viên cho người chưa có hợp đồng hiệu lực; phần chặn thuộc phân hệ Lương. **Không** bê quy tắc bắt-buộc-kèm-hợp-đồng từ tài liệu tham chiếu `docs/nestjs/hr` sang, vì tài liệu đó là ví dụ minh họa quy trình, không phải nghiệp vụ MAXV.

### 11.4 Giấy tờ bắt buộc theo loại hồ sơ (BR-hrm-034)

> **ĐÃ CHỐT (QĐ #14):** chọn **P2 — danh mục cấu hình được theo từng công ty, có cờ bắt buộc**, và làm **đủ cả hai** phần: bộ giấy tờ bắt buộc *và* theo dõi ngày hết hạn. Khuyến nghị cũ ("giữ P1 cho đợt này") đã bị thay. Đã viết thành thực thể `hrm_giay_to_bat_buoc` (Mục 4.6), cột `ngay_het_han` (Mục 4.5), BR-hrm-062…065, FR-hrm-038…041 và E-hrm-060, E-hrm-061.
>
> Hai điểm P2 đòi hỏi mà quyết định gốc chưa phủ: **nội dung** danh mục cho từng loại hợp đồng (OQ-hrm-13) và **ngưỡng** cảnh báo sắp hết hạn (OQ-hrm-14). Hệ thống không tự đặt giá trị mặc định cho cả hai. Đây là hạng mục phát sinh phạm vi lớn nhất của vòng chốt, nên xếp vào đợt P2 và cần thiết kế trước.

**Hiện trạng**: loại giấy tờ là chữ tự do, số hiệu không bắt buộc, không có khái niệm "hồ sơ đủ hay thiếu", không có ngày hết hạn giấy tờ. Không có gì nhắc khi nhân viên thiếu bản scan CCCD.

| | P1. Giữ nguyên hoàn toàn tự do | P2. Danh mục loại giấy tờ cấu hình được, có cờ bắt buộc | P3. Chốt cứng một bộ tối thiểu trong mã |
|---|---|---|---|
| **Cách làm** | Không đổi | Thêm bảng danh mục loại giấy tờ theo từng công ty, mỗi loại có cờ bắt buộc và cờ cần số hiệu; màn hồ sơ hiện tiến độ đủ/thiếu | Mã cứng danh sách bắt buộc (ví dụ CCCD), hiện cảnh báo khi thiếu |
| **Ưu** | Không chặn oan loại giấy tờ có thật ngoài danh sách | Mỗi công ty tự định nghĩa bộ hồ sơ của mình; đo được tỷ lệ hồ sơ đủ | Rẻ, có ngay giá trị nhắc việc |
| **Nhược** | Không ai biết hồ sơ ai còn thiếu gì cho tới khi cần dùng | Thêm một thực thể và một màn hình cấu hình; phải xử lý dữ liệu cũ đang là chữ tự do | Cứng nhắc, công ty khác nhau yêu cầu khác nhau |
| **Độ phức tạp** | Không | Cao | Thấp |

**Khuyến nghị: giữ P1 cho đợt này, ghi nhận P2 vào lộ trình.** Lý do: quyết định "chữ tự do" trong mã có lập luận vững (ép danh sách là chặn oan giấy khám sức khỏe, sổ BHXH, quyết định bổ nhiệm…), và chưa có yêu cầu nghiệp vụ nào đòi đo độ đầy đủ hồ sơ. P3 bị loại vì mã cứng một bộ bắt buộc cho mọi công ty là sai bản chất sản phẩm đa công ty. Cần trả lời OQ-hrm-04 trước khi mở P2.

### 11.5 File mồ côi trên Drive khi xóa dòng giấy tờ (BR-hrm-039, AC-hrm-33)

> **ĐÃ CHỐT (QĐ #12):** chọn **P1 — xóa file cố-hết-sức trong cùng thao tác**, kèm đúng điều kiện đã nêu ở phần khuyến nghị: hộp xác nhận của thao tác xóa dòng phải nói rõ **tên file** sắp bị xóa theo. Khuyến nghị cũ là P2 (bắt gỡ file trước) đã bị thay. Đã viết thành BR-hrm-039, FR-hrm-034 và AC-hrm-33. Việc dọn các file đã thành mồ côi từ trước khi sửa là một đầu việc riêng, không nằm trong quy tắc này.

**Hiện trạng**: `DELETE /hrm/tai-lieu/:id` chỉ xóa dòng trong cơ sở dữ liệu. File scan ở lại Drive vĩnh viễn, không còn bản ghi nào trỏ tới, không thông báo. Tài liệu cũ mô tả sai là "xóa kèm file trên Drive (cố hết sức)".

| | P1. Xóa file cố-hết-sức trong cùng thao tác | P2. Chặn xóa dòng khi còn file, bắt gỡ file trước | P3. Giữ nguyên, chỉ nói rõ trên giao diện |
|---|---|---|---|
| **Cách làm** | Trước khi xóa dòng, nếu có con trỏ thì gọi xóa trên Drive; thất bại thì bỏ qua và vẫn xóa dòng | Trả 409 kèm lời nhắc bấm "Gỡ file" trước; giao diện có thể tự gọi hai bước | Không đổi máy chủ; hộp xác nhận nói rõ file scan vẫn nằm lại trên Drive |
| **Ưu** | Một thao tác, đúng trực giác người dùng; không để lại rác | Không bao giờ xóa nhầm file mà không ý thức; hai thao tác hai lần xác nhận | Rẻ nhất, trung thực với hiện trạng |
| **Nhược** | Xóa file là không hoàn tác; bấm nhầm dòng là mất bản scan CCCD có khi là bản duy nhất | Thêm một bước cho thao tác vốn đơn giản | Rác tích tụ trên Drive của khách; khách tự dọn không biết file nào còn dùng |
| **Độ phức tạp** | Thấp | Thấp | Rất thấp |
| **Rủi ro mất dữ liệu** | Trung bình | Thấp | Thấp (nhưng đổi lấy rác) |

**Khuyến nghị: P2.** Giao diện đã có hộp xác nhận riêng cho thao tác gỡ file với đúng câu cảnh báo "File sẽ bị xóa khỏi Google Drive và không lấy lại được"; ép đi qua bước đó là dùng lại đúng lớp bảo vệ đã có, thay vì nhân đôi rủi ro xóa nhầm ở đường xóa dòng. Nếu nghiệp vụ thấy hai bước quá phiền thì chọn P1 **kèm** yêu cầu hộp xác nhận của thao tác xóa dòng phải nói rõ file scan sẽ bị xóa theo. **Không** chọn P3 nếu không có kế hoạch dọn rác.

---

## 12. Đối chiếu ba chiều: tài liệu tham chiếu, tài liệu HRM cũ và mã nguồn thật

`docs/nestjs/hr/` là **tài liệu mẫu minh họa quy trình** trên nền NestJS với nghiệp vụ HR/Payroll làm ví dụ — **không phải** nghiệp vụ MAXV. Cột đó ở đây chỉ dùng để soi xem MAXV có tương đương hay không, tuyệt đối không dùng làm dữ liệu MAXV.

> Bảng dưới đây mô tả **hiện trạng mã tại thời điểm rà soát**, giữ nguyên để đối chiếu. Các dòng đã có quyết định ngày 2026-09-07 được ghi thêm kết quả chốt ở cột cuối; hiện trạng mã chưa đổi cho tới khi kỹ sư triển khai.

### 12.1 Phòng ban

| Chủ đề | Tài liệu tham chiếu `docs/nestjs/hr` | `docs/hrm` bản cũ | Mã nguồn thật | Loại lệch |
|---|---|---|---|---|
| Mã phòng ban | `DP001`, phẳng, duy nhất toàn hệ thống | `PBxx` / `PBxx.yy`, tối đa 24 ký tự | Đúng như bản cũ; sinh mã quét cả bản ghi đã xóa mềm | Khớp |
| Cây phân cấp | Không có (danh mục phẳng) | Có, chống vòng lặp | Có, `assertKhongVongLap` duyệt ngược chuỗi cha | Khớp |
| Xóa phòng ban | Cấm xóa cứng khi còn nhân viên, chỉ cho ngừng hoạt động | Chặn nếu **còn nhân viên đang làm** | Chặn nếu còn **bất kỳ nhân viên chưa xóa mềm nào, kể cả đã nghỉ**, và chặn cả khi còn phòng ban con | **(c) Spec ghi sai** — bản cũ ghi "chỉ tính nhân viên chưa bị xóa mềm" nhưng bỏ sót hai điểm: guard đếm cả người đã nghỉ, và có thêm guard phòng ban con |
| Phòng ban ngừng hoạt động | Không hiện trong danh sách chọn khi tạo nhân viên | Không nhắc | Vẫn hiện: `listPhongBan` chỉ lọc `da_xoa`, form nhân viên duyệt toàn bộ cây | **ĐÃ CHỐT (QĐ #11)** — ẩn khỏi ô chọn, **trừ** phòng đang gán của chính nhân viên đang sửa (BR-hrm-061). Máy chủ cố ý vẫn không kiểm `status` |
| Đổi trạng thái ngừng hoạt động khi còn nhân viên | Là cách xóa mềm chính thức | Không nhắc | Không có guard nào | **ĐÃ CHỐT (QĐ #11)** — cho phép, giao diện cảnh báo nêu số người; nhân viên giữ nguyên `ma_pb` (BR-hrm-060) |

### 12.2 Nhân viên

| Chủ đề | Tham chiếu | `docs/hrm` bản cũ | Mã nguồn thật | Loại lệch |
|---|---|---|---|---|
| Mã nhân viên | `NV` + số, tự sinh | `NV` + 4 số, không cấp lại | Đúng; kiểm trùng cố ý không lọc cờ đã xóa | Khớp |
| Ngày vào làm | Không nhắc là bắt buộc | Không nhắc | **Bắt buộc**, kiểu ngày | **(a)** |
| Bắt buộc tạo kèm hợp đồng | **Có** (BR-hr-014, giao dịch tất-cả-hoặc-không) | Không, cho tạo trước | **Không** — hai lần ghi tách rời | Tham chiếu khác MAXV — **cố ý**, xem Mục 11.3 |
| Sáu trường hợp đồng trên hồ sơ | Không áp dụng | Ghi đúng là tính lúc đọc | Đúng, `phanHopDong` tính từ bảng hợp đồng | Khớp |
| Quy đổi loại hợp đồng 5 về 3 khi trả về màn nhân viên | Không có | **Không nhắc** | Có: `loaiHdVeNhanVien` | **(a)** |
| Ràng buộc duy nhất CCCD/MST/email | Nêu rõ là không duy nhất | Không nhắc | Không duy nhất; CCCD **không** kiểm 12 chữ số | **(a)** |
| Sửa nhân viên bắt buộc gửi hai cờ chế độ | Không có | Không nhắc | Có, và có lý do rõ trong mã | **(a)** |
| Xóa nhân viên | Hệ quả với bản ghi con "theo quyết định OQ-hr-4" (chưa chốt) | "Ẩn kèm NPT, HĐ, Tài liệu" | Đúng là ẩn; trả về `so_npt_an_theo` | Khớp |
| Tên trường phản hồi khi xóa | Không áp dụng | Không nhắc | Máy chủ trả `so_npt_an_theo`, **giao diện khai báo `so_npt_da_xoa`** | **(c) Lệch hợp đồng API** — `nhanVienApi.ts:112` so với `nhanVien.service.ts:242` |

### 12.3 Hợp đồng lao động

| Chủ đề | Tham chiếu | `docs/hrm` bản cũ | Mã nguồn thật | Loại lệch |
|---|---|---|---|---|
| Một nhân viên nhiều hợp đồng | Có | Có | Có | Khớp |
| Quy tắc chọn hợp đồng hiện hành | "suy ra từ so sánh ngày", không nêu quy tắc chọn khi hòa | Nêu đủ ba nhánh | Đúng ba nhánh, kèm ba tiêu chí sắp xếp | Khớp |
| Mốc "hôm nay" | Không nhắc | Ghi "homNayVN" | `chonHopDongHienHanh` dùng giờ Việt Nam; `doiHopDong` dùng **UTC** | **(c)** — bản cũ ngầm khẳng định cả hệ dùng một mốc; thực tế lệch. `hopDong.service.ts:233-234` |
| Chống chồng lấn | **Có** (BR-hr-013, E-hr-020) | **Có** (BR-03.3) | **Không có ở bất kỳ đường ghi nào** | **(b) Spec ghi mà code chưa làm** — nghiêm trọng nhất. **ĐÃ CHỐT (QĐ #1 + #6)**: chặn theo cặp (`ma_nv`, `loai_hd`), khoảng ngày tính cả hai đầu mút |
| Đổi hợp đồng nguyên tử | Không có khái niệm này | Có | Có, một giao dịch | **MAXV mạnh hơn tham chiếu** |
| Ràng buộc ngày của đổi hợp đồng | Không có | Chỉ ghi "ngày bắt đầu lớn hơn ngày chốt" | Ba ràng buộc: bắt buộc ngày chốt khi có hợp đồng hiệu lực; ngày chốt phải **sau** ngày bắt đầu hợp đồng cũ; ngày bắt đầu mới phải sau ngày chốt | **(a)** — bản cũ thiếu hai ràng buộc |
| Luật công đoàn | Theo loại hợp đồng của **chính hợp đồng đó**, cột `cong_doan` nằm trên hợp đồng | Một chiều, cờ trên nhân viên | Một chiều, cờ trên **nhân viên**, bám loại hợp đồng **vừa ghi** | MAXV khác tham chiếu — **cố ý**, mã có lập luận rõ |
| Lương chính bắt buộc và phải lớn hơn 0 | **Có** (BR-hr-012) | Không nhắc | **Không** — mặc định 0, cho phép 0 | **ĐÃ CHỐT (QĐ #5)** — bắt buộc lớn hơn 0 (BR-hrm-057). Phải rà dữ liệu lương 0 trước khi bật |
| Lương BHXH bắt buộc khi có trích đóng | **Có** | Không nhắc | **Không** | **ĐÃ CHỐT (QĐ #5)** — bắt buộc lớn hơn 0 khi bật trích BHXH (BR-hrm-058) |
| Số hợp đồng duy nhất | Nêu rõ là không duy nhất | Không nhắc | Không duy nhất | **ĐÃ CHỐT (QĐ #4)** — MAXV đi khác tài liệu tham chiếu: duy nhất toàn công ty (BR-hrm-056). Phải rà dữ liệu trùng trước khi thêm khóa |
| Hợp đồng đúng một ngày | Không nhắc | Không nhắc | **Không tạo được** (bằng nhau bị chặn) | **ĐÃ CHỐT (QĐ #6)** — cho phép; sửa BR-hrm-026 và wording E-hrm-019, kéo theo khoảng ngày chống chồng lấn phải đóng hai đầu |
| Xóa hợp đồng | Không nhắc | "Xóa hợp đồng" chung chung | Xóa cứng, không điều kiện | **(a)** — xem Mục 11.2 |
| Lý do chấm dứt hợp đồng | Có trường riêng | Không có | Không có | Tham chiếu có thêm, MAXV chưa cần |

### 12.4 Người phụ thuộc

| Chủ đề | Tham chiếu | `docs/hrm` bản cũ | Mã nguồn thật | Loại lệch |
|---|---|---|---|---|
| Chống trùng mã số thuế | Không có | Có, khóa duy nhất theo cặp | Có ở **hai tầng**, nhưng phạm vi chỉ trong **một nhân viên** — cùng một mã số thuế đăng ký được cho hai nhân viên | **ĐÃ CHỐT (QĐ #7)** — mở phạm vi lên **toàn công ty** (BR-hrm-030). Phải rà dữ liệu trùng trước khi đổi khóa |
| Ngày sinh lưu dạng chuỗi | Có | Ghi đúng | Đúng, kèm kiểm ngày có thật | Khớp |
| Kỳ đăng ký giảm trừ | Tháng 1–12, năm 2000–2100, từ trước đến | Ghi đúng | Đúng, thêm ràng buộc tháng-phải-đi-kèm-năm | **(a)** — bản cũ thiếu vế cặp tháng-năm |
| Không chuyển sang nhân viên khác | Không nhắc | Không nhắc | Có, `ma_nv` bị loại khỏi thân sửa | **(a)** |
| Danh sách quan hệ | Vợ/Chồng/Con/Bố/Mẹ/Anh chị em/Khác | Ghi "vo, chong, con, bo, me…" | Chữ tự do; giao diện gợi ý 8 giá trị: `con`, `vo_chong`, `cha`, `me`, `anh_chi_em`, `ong_ba`, `chau`, `khac` | **(c)** — bản cũ liệt kê sai mã giá trị so với giao diện thật |

### 12.5 Tài liệu và Google Drive

| Chủ đề | Tham chiếu | `docs/hrm` bản cũ | Mã nguồn thật | Loại lệch |
|---|---|---|---|---|
| Sở hữu Drive | Drive **cá nhân của người thao tác** | Cấp doanh nghiệp | Cấp doanh nghiệp, token ở bảng công ty | MAXV khác tham chiếu — **cố ý và tốt hơn** |
| Số hiệu giấy tờ | **Bắt buộc** | Không nhắc | **Không bắt buộc** | Tham chiếu khác MAXV |
| Ngày cấp không được ở tương lai | **Có** (BR-hr-016) | Không nhắc | **Không kiểm** | **(b)** — xem OQ-hrm-09 |
| Ngày hết hạn giấy tờ | Có | Không có | **Không có cột** | **ĐÃ CHỐT (QĐ #14)** — thêm cột `ngay_het_han` kèm cảnh báo hạn (BR-hrm-062, BR-hrm-065) |
| Kiểu file và trần dung lượng | Không nêu số | Ảnh + PDF, 10MB | Đúng 5 kiểu, 10MB, chặn ở ba tầng, và trần cũng áp cho đường tải về | **(a)** — bản cũ thiếu vế đường tải về |
| Cây thư mục Drive | Không có | `maxv / <MST> - <tên> / <mã NV> - <họ tên>` | Đúng, tạo lười, nhớ theo ID | Khớp |
| Xóa dòng giấy tờ | Không nhắc | "Xóa bản ghi giấy tờ **và xóa file trên Drive (cố hết sức)**" | **Không gọi Drive**, chỉ xóa dòng | **ĐÃ CHỐT (QĐ #12)** — mô tả cũ là đúng ý muốn, mã phải sửa theo (BR-hrm-039). `taiLieu.service.ts:124-136` |
| Phân quyền Drive | Không có | Không nhắc | Kết nối lần đầu ai cũng được; đổi và ngắt chỉ chủ tài khoản | **ĐÃ CHỐT (QĐ #10)** — cả ba việc nối/đổi/ngắt về `OWNER`; dùng kho thì giữ nguyên cho mọi người (BR-hrm-045) |
| Tự ngắt khi token bị thu hồi | Không có | Không nhắc | Có, và cố ý chỉ bám đúng mã `invalid_grant` | **(a)** |
| Dọn ID thư mục khi đổi tài khoản | Không có | Không nhắc | Có, kèm lập luận vì sao không đụng con trỏ file | **(a)** |
| Bảo mật luồng OAuth | Không có | "state ký HMAC" | HMAC + tiền tố tách miền + hạn 10 phút + cookie dùng một lần + thoát ký tự HTML + chính sách bảo mật nội dung | **(a)** — bản cũ mô tả quá sơ sài so với mức bảo vệ thật |

### 12.6 Xuyên suốt

| Chủ đề | Tham chiếu | `docs/hrm` bản cũ | Mã nguồn thật | Loại lệch |
|---|---|---|---|---|
| Vai trò | `ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE`; kế toán chỉ đọc | Không có mục phân quyền | `OWNER`, `OWNER_EMPLOYEE` toàn quyền; `ADMIN` **bị chặn** | **ĐÃ CHỐT (QĐ #9)** — `ADMIN` không có phạm vi tenant là **chủ ý**, giữ nguyên (BR-hrm-051) |
| Phân quyền theo trường nhạy cảm | Có (NFR-hr-003) | Không nhắc | **Không có** — ai vào được cũng đọc đủ lương và số tài khoản | **ĐÃ CHỐT (QĐ #8)** — tách quyền xem dữ liệu lương bên trong `OWNER_EMPLOYEE` (BR-hrm-059). Sửa máy chủ và giao diện cùng lúc |
| Vị trí giao diện | Không áp dụng | Ghi "`fe_maxv` và `hdđt_maxv`" | Chỉ ở `hdđt_maxv/src/features/hrm/` | **(c) Spec ghi sai** |
| Nhật ký thao tác | Không nhắc | Không nhắc | Chỉ có hai mốc thời gian, **không lưu ai thao tác** | **ĐÃ CHỐT (QĐ #15)** — ghi người thao tác cho 5 nhóm thao tác, không ghi giá trị trước/sau (BR-hrm-066, NFR-hrm-011) |
| Docblock của model hợp đồng trong schema | Không áp dụng | Không nhắc | Vẫn ghi "QUAN HỆ VỚI 7 CỘT HỢP ĐỒNG TRÊN `hrm_nhan_vien`… BẮT BUỘC gọi `dongBoHopDongHienHanh()`" — cả 7 cột lẫn hàm đó **đều không còn tồn tại** | **(c)** — chú thích lỗi thời trong chính mã nguồn, dễ khiến người sửa sau đi sai đường |
| Chú thích ở tầng giao diện | Không áp dụng | Không nhắc | `hopDongQueries.ts:94-96` vẫn ghi "BE tự đồng bộ bản sao hợp đồng hiện hành xuống bảng nhân viên" — không còn đúng | **(c)** — chú thích lỗi thời (hành vi làm mới dữ liệu vẫn đúng) |

---

## 13. Ma trận truy vết

| Mục tiêu | Quy tắc nghiệp vụ | Yêu cầu chức năng | Lỗi | Ca sử dụng | Tiêu chí nghiệm thu | Sơ đồ |
|---|---|---|---|---|---|---|
| G1 | BR-hrm-001…009, BR-hrm-016, BR-hrm-060, BR-hrm-061 | FR-hrm-001…005, FR-hrm-007, FR-hrm-037 | E-hrm-008…015 | UC-hrm-01, UC-hrm-02 | AC-hrm-03…06, AC-hrm-49, AC-hrm-50 | `hrm-erd.md` |
| G1 | BR-hrm-010…017, BR-hrm-054, BR-hrm-055 | FR-hrm-006, FR-hrm-008…012, FR-hrm-036 | E-hrm-016…018, E-hrm-052…054 | UC-hrm-03, UC-hrm-04, UC-hrm-05, UC-hrm-14 | AC-hrm-01, AC-hrm-02, AC-hrm-19, AC-hrm-39…AC-hrm-41 | `hrm-states.md` mục NhanVien, `hrm-flows.md` luồng 1 và 6 |
| G2 | BR-hrm-018…029, BR-hrm-052, BR-hrm-053, BR-hrm-056 | FR-hrm-013…020 | E-hrm-019…024, E-hrm-055 | UC-hrm-06…UC-hrm-09 | AC-hrm-07…AC-hrm-18, AC-hrm-36…AC-hrm-38, AC-hrm-42 | `hrm-states.md` mục HopDong, `hrm-flows.md` luồng 1 và 2 |
| G3 | BR-hrm-019, BR-hrm-022, BR-hrm-025, BR-hrm-028, BR-hrm-052, BR-hrm-057, BR-hrm-058 | FR-hrm-014, FR-hrm-015, FR-hrm-016 | E-hrm-024, E-hrm-056, E-hrm-057 | UC-hrm-04, UC-hrm-07 | AC-hrm-07…AC-hrm-09, AC-hrm-15…AC-hrm-18, AC-hrm-37, AC-hrm-38, AC-hrm-43, AC-hrm-44 | `hrm-states.md` mục HopDong |
| G4 | BR-hrm-030…033 | FR-hrm-021…024 | E-hrm-025…030 | UC-hrm-10 | AC-hrm-20…AC-hrm-22, AC-hrm-51 | `hrm-erd.md` |
| G5 | BR-hrm-034…048, BR-hrm-062 | FR-hrm-025…035, FR-hrm-039 | E-hrm-031…051, E-hrm-059, E-hrm-060 | UC-hrm-11…UC-hrm-13, UC-hrm-15 | AC-hrm-23…AC-hrm-33, AC-hrm-47, AC-hrm-48, AC-hrm-52 | `hrm-states.md` mục LienKetDrive, `hrm-flows.md` luồng 3, 4, 5 |
| G6 | BR-hrm-062, BR-hrm-063, BR-hrm-064, BR-hrm-065 | FR-hrm-038…FR-hrm-041 | E-hrm-060, E-hrm-061 | UC-hrm-16, UC-hrm-17 | AC-hrm-52…AC-hrm-55 | `hrm-erd.md` mục `hrm_giay_to_bat_buoc` |
| Xuyên suốt | BR-hrm-049…051, BR-hrm-059 | Áp cho mọi FR, FR-hrm-042 | E-hrm-001…005, E-hrm-058 | Mọi UC | AC-hrm-34, AC-hrm-35, AC-hrm-45, AC-hrm-46 | `hrm-flows.md` luồng 1 |
| Xuyên suốt | BR-hrm-066 | FR-hrm-020, FR-hrm-024, FR-hrm-034, FR-hrm-035, FR-hrm-043 | — | UC-hrm-15 | AC-hrm-56 | — |

### 13.1 Truy vết theo quyết định nghiệp vụ (chốt 2026-09-07)

Bảng này để Architect và QA lần từ một quyết định sang đúng các mục phải làm.

| QĐ | Nội dung chốt | Quy tắc | Chức năng | Lỗi | Nghiệm thu |
|:--:|---|---|---|---|---|
| #1 | Cho phép hai hợp đồng đồng thời khác loại, chỉ chặn trùng cùng loại | BR-hrm-022, BR-hrm-052, BR-hrm-053, BR-hrm-024 | FR-hrm-016, FR-hrm-017, FR-hrm-018 | E-hrm-024 | AC-hrm-18, AC-hrm-36, AC-hrm-37 |
| #2 | Hợp đồng ký trước cho tương lai tính là hiện hành ngay khi ký | BR-hrm-019 | FR-hrm-014 | — | AC-hrm-38 |
| #3 | Nghỉ việc bắt buộc nhập ngày nghỉ, hệ thống tự chốt hợp đồng | BR-hrm-054, BR-hrm-055 | FR-hrm-036, FR-hrm-010 | E-hrm-052, E-hrm-053, E-hrm-054 | AC-hrm-39, AC-hrm-40, AC-hrm-41 |
| #4 | `so_hd` duy nhất toàn công ty | BR-hrm-056, BR-hrm-027 | FR-hrm-016, FR-hrm-017 | E-hrm-055 | AC-hrm-42 |
| #5 | `luong_chinh` lớn hơn 0; bật trích BHXH thì `luong_bhxh` lớn hơn 0 | BR-hrm-057, BR-hrm-058, BR-hrm-028 | FR-hrm-016, FR-hrm-017, FR-hrm-018 | E-hrm-056, E-hrm-057 | AC-hrm-43, AC-hrm-44 |
| #6 | Cho phép hợp đồng một ngày | BR-hrm-026, BR-hrm-022 | FR-hrm-016, FR-hrm-017 | E-hrm-019 | AC-hrm-17, AC-hrm-37 |
| #7 | Người phụ thuộc duy nhất theo mã số thuế trên toàn công ty | BR-hrm-030 | FR-hrm-021, FR-hrm-023 | E-hrm-026 | AC-hrm-51 |
| #8 | Tách quyền xem dữ liệu lương | BR-hrm-059 | FR-hrm-013, FR-hrm-042 | E-hrm-058 | AC-hrm-45, AC-hrm-46 |
| #9 | `ADMIN` không có phạm vi tenant là chủ ý | BR-hrm-051 | — | E-hrm-004 | AC-hrm-34 |
| #10 | Chỉ chủ tài khoản nối/đổi/ngắt Drive | BR-hrm-045 | FR-hrm-028, FR-hrm-035 | E-hrm-059, E-hrm-041, E-hrm-042 | AC-hrm-47, AC-hrm-48 |
| #11 | Phòng ban ngừng hoạt động: cảnh báo rồi cho, ẩn khỏi ô chọn | BR-hrm-060, BR-hrm-061, BR-hrm-016 | FR-hrm-037 | — | AC-hrm-49, AC-hrm-50 |
| #12 | Xóa dòng giấy tờ thì xóa luôn file Drive | BR-hrm-039 | FR-hrm-034 | — | AC-hrm-33 |
| #13 | Xóa mềm nhân viên giữ nguyên file scan | A-hrm-10, NFR-hrm-005 | — | — | — |
| #14 | Bộ giấy tờ bắt buộc và ngày hết hạn | BR-hrm-062…065, BR-hrm-034 | FR-hrm-038…041 | E-hrm-060, E-hrm-061 | AC-hrm-52…AC-hrm-55 |
| #15 | Nhật ký thao tác phá hủy và sửa lương | BR-hrm-066, NFR-hrm-011 | FR-hrm-043, FR-hrm-020, FR-hrm-024, FR-hrm-034, FR-hrm-035 | — | AC-hrm-56 |
| #16 | Hiệu năng chưa đặt số, đo thực tế trước | NFR-hrm-004 | FR-hrm-008, FR-hrm-040 | — | — |

---

## 14. Giả định

**A-hrm-01** — Mỗi công ty (mã số thuế) là một tenant có cơ sở dữ liệu riêng; dữ liệu HRM không bao giờ phải truy vấn chéo giữa các công ty. Mọi báo cáo toàn tập đoàn nằm ngoài phạm vi.

**A-hrm-02** — Quy mô mỗi công ty dưới 9.999 nhân viên và mỗi cấp cây phòng ban dưới 99 đơn vị. Thuật toán sinh mã dựa trên giả định này; vượt ngưỡng thì rơi vào nhánh dự phòng lấy đuôi mốc thời gian, chấp nhận mã không đẹp.

**A-hrm-03** — Mỗi nhân viên có ít hợp đồng (dưới 10 dòng), nên việc lấy toàn bộ lịch sử hợp đồng của cả danh sách nhân viên trong một lượt truy vấn rồi chọn trong bộ nhớ là chấp nhận được, không cần chỉ mục hay truy vấn chuyên biệt.

**A-hrm-04** — Danh mục phòng ban của một công ty là nhỏ (hàng chục dòng), nên lấy trọn rồi ghép trong bộ nhớ là chấp nhận được.

**A-hrm-05** — Doanh nghiệp có sẵn một tài khoản Google dùng chung cho công ty và chấp nhận file scan nhân sự nằm trên Drive của tài khoản đó. Doanh nghiệp tự chịu trách nhiệm về dung lượng Drive và về việc không xóa tay các file do hệ thống tạo.

**A-hrm-06** — Toàn bộ người dùng HRM ngồi ở Việt Nam, nên mốc "hôm nay" tính theo giờ Việt Nam là đúng cho mọi người dùng. Không có nhu cầu đa múi giờ.

**A-hrm-07** — Chức vụ và cấp bậc là chữ tự do trong đợt này. Khi có nhu cầu báo cáo theo chức vụ thì nâng thành danh mục riêng; mã đã lưu giữ nguyên nên dữ liệu nhân viên không phải sửa.

**A-hrm-08** — Danh sách ngân hàng, loại hợp đồng, loại giấy tờ, quan hệ người phụ thuộc ở giao diện chỉ là gợi ý. Máy chủ chấp nhận giá trị ngoài danh sách, và việc đó là có chủ đích.

**A-hrm-09** `[SỬA THEO QĐ #1, #2]` — Kỳ lương chưa khóa sổ. Mọi lập luận về việc cho phép hay cấm sửa/xóa hợp đồng trong tài liệu này chưa tính tới ràng buộc kỳ lương đã chốt; khi phân hệ Lương ra đời phải xét lại BR-hrm-029.

Hai điều phân hệ Lương **bắt buộc** phải biết, ghi ở đây vì chúng là giả định về phía tiêu thụ dữ liệu chứ không phải quy tắc của HRM:
1. **Nhãn "hợp đồng hiện hành" không đồng nghĩa "đang hiệu lực trong kỳ lương".** Nó có thể trỏ vào hợp đồng ký trước cho tương lai hoặc hợp đồng đã hết hạn (BR-hrm-019). Phân hệ Lương phải tự lọc theo `ngay_bat_dau` và `ngay_ket_thuc` so với kỳ lương đang tính, không lấy thẳng sáu trường hợp đồng hiện hành trong phản hồi nhân viên.
2. **Một nhân viên có thể có nhiều hợp đồng cùng hiệu lực trong một kỳ** (hợp đồng lao động chính cộng hợp đồng khoán — BR-hrm-022). Phân hệ Lương phải xử lý theo danh sách hợp đồng, không giả định mỗi người mỗi kỳ chỉ có một mức lương.

**A-hrm-10** `[MỚI — QĐ #13]` — Xóa mềm nhân viên **không đụng tới file scan trên Google Drive**: file ở lại nguyên chỗ, con trỏ trong `hrm_tai_lieu` giữ nguyên, chỉ bị ẩn khỏi các truy vấn đọc. Lý do: hồ sơ người đã nghỉ còn phải tra cứu khi quyết toán thuế các năm sau, xóa file là mất bằng chứng không lấy lại được.

Kèm theo giả định này là hai khoảng trống **đã biết và cố ý chưa xử lý** trong đợt này: hệ thống chưa có chính sách **xóa cứng** hồ sơ nhân sự, và chưa đặt **thời hạn lưu trữ** file scan sau khi nhân viên nghỉ việc. Cả hai thuộc nghĩa vụ bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP) và phải mở một vòng quyết định riêng khi có yêu cầu tuân thủ cụ thể — xem NFR-hrm-005.

---

## 15. Câu hỏi mở

### 15.1 Còn mở — phải trả lời trước khi phần liên quan được triển khai

| ID | Câu hỏi | Ai trả lời | Chặn việc gì | Phát sinh từ |
|---|---|---|---|---|
| OQ-hrm-09 | Ngày cấp giấy tờ có được phép là ngày trong tương lai không? Hiện không chặn. | Người dùng nghiệp vụ | Bổ sung quy tắc và lỗi cho `ngay_cap` nếu cần. Không chặn phần còn lại của QĐ #14 | Vòng rà soát 2026-09-07, chưa được đưa ra chốt |
| OQ-hrm-11 | Khi một nhân viên có hợp đồng lao động chính **và** hợp đồng khoán cùng đang hiệu lực, cột "Hợp đồng hiện hành" trên danh sách nhân viên hiển thị hợp đồng nào? Ưu tiên theo loại (ví dụ hợp đồng lao động thắng hợp đồng khoán), theo ngày bắt đầu muộn nhất, hay hiện cả hai? | Người dùng nghiệp vụ, kế toán trưởng | BR-hrm-052 — đường đọc danh sách nhân viên và chi tiết nhân viên. Không chặn luật chống chồng lấn (BR-hrm-022) vì luật đó đã đủ rõ | Hệ quả (a) của QĐ #1, quyết định gốc chưa phủ |
| OQ-hrm-12 | Đưa nhân viên từ "Đã nghỉ" trở lại "Đang làm" (tái tuyển dụng) thì xử lý `ngay_nghi_viec` và các hợp đồng đã bị tự chốt ra sao? Xóa ngày nghỉ và mở lại hợp đồng cũ, hay bắt ký hợp đồng mới? Và trường hợp nhân viên có hợp đồng ký trước bắt đầu **sau** ngày nghỉ — chặn như BR-hrm-055 đang quy định là đúng, hay nên tự xóa hợp đồng đó? | Người dùng nghiệp vụ, kế toán trưởng | Nhánh ngược của BR-hrm-054 và BR-hrm-055. Không chặn nhánh xuôi (ghi nhận nghỉ việc) vốn đã đủ rõ | QĐ #3 chỉ chốt chiều đi, chưa chốt chiều về |
| OQ-hrm-13 | Bộ giấy tờ bắt buộc gồm chính xác những loại giấy tờ nào cho từng loại hợp đồng? Ai được sửa danh mục này — chỉ chủ tài khoản hay cả người dùng được cấp quyền? | Người dùng nghiệp vụ, chủ tài khoản | Nội dung khởi tạo của danh mục ở BR-hrm-063 và quyền của FR-hrm-038. Không chặn việc dựng khả năng khai báo | QĐ #14 chốt "làm cả hai" nhưng không chốt nội dung |
| OQ-hrm-14 | Ngưỡng "sắp hết hạn" của giấy tờ là bao nhiêu ngày, và ngưỡng đó khai ở đâu (tham số chung của công ty hay khai riêng cho từng loại giấy tờ)? Cảnh báo hiện ở những chỗ nào ngoài danh sách cảnh báo? | Người dùng nghiệp vụ | Nhánh `sap_het_han` của BR-hrm-065 và FR-hrm-041. Nhánh `da_het_han` chạy được ngay, không chờ | QĐ #14 chốt "có cảnh báo" nhưng không chốt ngưỡng |
| OQ-hrm-15 | Từ khi hợp đồng một ngày được cho phép (QĐ #6), lý do cũ của BR-hrm-024b không còn đúng. Vậy `ngay_chot` của thao tác đổi hợp đồng có nên được phép **bằng** `ngay_bat_dau` của hợp đồng đang hiệu lực không? | Người dùng nghiệp vụ | BR-hrm-024b và E-hrm-022. Đợt này giữ nguyên hành vi cũ, không chặn việc triển khai | Mâu thuẫn nội bộ do QĐ #6 sinh ra, chưa ai chốt |

### 15.1b Phát sinh từ vòng phản biện độc lập 2026-09-07

> Vòng rà soát chéo Architect ∥ Tester-QA (chạy sau khi 16 quyết định đã chốt) tìm ra các nhánh nghiệp vụ mà **cả đặc tả lẫn bộ ca kiểm thử đều bỏ sót**. Đây không phải câu hỏi kỹ thuật — mỗi câu đều cần người dùng nghiệp vụ trả lời.

| ID | Câu hỏi | Ai trả lời | Chặn việc gì |
|---|---|---|---|
| OQ-hrm-17 | Người **không** có quyền xem lương vẫn đọc được sáu trường hợp đồng hiện hành trên danh sách nhân viên (số hợp đồng, loại, kiểu lương, hạn hợp đồng, cờ BHXH, cờ TNCN). Có che luôn nhóm này không? | Chủ tài khoản | Phạm vi thật của BR-hrm-059. Không có mức lương nhưng có loại và hạn hợp đồng của cả công ty |
| OQ-hrm-19 | Loại hợp đồng và loại giấy tờ là chữ tự do, hiện **không chuẩn hóa hoa thường**. `khoan` và `Khoan` là hai loại khác nhau; `cccd` và `CCCD` là hai loại giấy tờ khác nhau. Có chuẩn hóa không? | Người dùng nghiệp vụ | Ràng buộc chống chồng lấn và chỉ báo hồ sơ đủ/thiếu đều so khớp theo chuỗi này. Không chuẩn hóa thì cả hai đều lọt lưới, và người dùng bị báo thiếu hồ sơ oan |
| OQ-hrm-20 | Ghi nhận nghỉ việc cho nhân viên **chưa có hợp đồng nào** thì kết quả là gì? | Người dùng nghiệp vụ | Nhánh thường gặp (nhập nhầm hồ sơ, thử việc chưa ký giấy) mà BR-hrm-055 không nói tới. Danh sách hợp đồng đã chốt rỗng có phải là thành công không |
| OQ-hrm-21 | Ngày nghỉ **trùng đúng** ngày bắt đầu của một hợp đồng thì hợp đồng đó bị chốt thành hợp đồng một ngày. Chấp nhận, hay chặn? | Người dùng nghiệp vụ | Chỉ hợp lệ *vì* QĐ #6 vừa mở. E-hrm-054 chỉ chặn hợp đồng bắt đầu **sau** ngày nghỉ, nên nhánh bằng nhau lọt qua mà không ai định nghĩa |
| OQ-hrm-22 | **Ghi nhận nghỉ việc lùi ngày**: nhập ngày nghỉ 15/01 cho người có hợp đồng 01/02–31/03 **đã kết thúc từ lâu**. Hiện E-hrm-054 từ chối toàn bộ và bảo người dùng "xóa hoặc sửa hợp đồng đó trước" — tức bắt **xóa chứng từ lao động lịch sử**. Đúng ý không? | Kế toán trưởng | E-hrm-054 nên chỉ áp cho hợp đồng **chưa kết thúc**, hay áp cho mọi hợp đồng. Ví dụ minh họa của AC-hrm-41 chỉ dùng hợp đồng tương lai nên che mất nhánh này |
| OQ-hrm-23 | Nhập nhầm ngày nghỉ rồi muốn **sửa lại ngày nghỉ** của người đã ở trạng thái đã nghỉ: có cho sửa không? Sửa thì các hợp đồng đã chốt có chốt lại theo ngày mới không? | Người dùng nghiệp vụ | Hiện đặc tả nói "giá trị cũ giữ nguyên" và hợp đồng đã chốt sai ngày **không có đường sửa nào**, mà giao diện cũng không báo gì |
| OQ-hrm-24 | Ngày nghỉ được phép nằm ở tương lai, nhưng trạng thái chuyển sang **đã nghỉ ngay hôm nay**. Người còn đi làm ba tháng nữa lập tức biến mất khỏi sĩ số phòng ban và khỏi bộ lọc "đang làm". Đúng ý không? | Người dùng nghiệp vụ, kế toán trưởng | Ảnh hưởng trực tiếp báo cáo nhân sự và bảng lương. Hoặc đổi trạng thái ngay, hoặc đợi tới ngày, phải chọn một |
| OQ-hrm-25 | **Xóa mềm** nhân viên đang có hợp đồng còn hiệu lực: có bắt chốt hợp đồng như khi ghi nhận nghỉ việc không? | Kế toán trưởng | Đây là **cửa sau đi vòng qua toàn bộ QĐ #3**. Hợp đồng vô thời hạn nằm lại vĩnh viễn, chỉ vô hình với giao diện; phân hệ Lương đọc thẳng bảng hợp đồng sẽ trả lương cho người đã xóa |
| OQ-hrm-26 | Số hợp đồng và mã số thuế người phụ thuộc **của nhân viên đã xóa mềm** có còn chiếm chỗ trong phạm vi duy nhất không? | Kế toán trưởng | Nếu có: nhập nhầm một nhân viên rồi xóa mềm sẽ **khóa vĩnh viễn** số hợp đồng và mã số thuế người phụ thuộc đó, và thông báo lỗi trỏ tới một hồ sơ người dùng không mở được. Nếu không: ràng buộc ở cơ sở dữ liệu và phép kiểm ở ứng dụng sẽ nói khác nhau |
| OQ-hrm-28 | Giấy tờ hết hạn **đúng hôm nay** là còn hạn hay đã hết hạn? | Người dùng nghiệp vụ | Hiện rơi vào nhánh "sắp hết hạn" đang bị tắt vì chưa có ngưỡng, nên hộ chiếu hết hạn hôm nay **không xuất hiện trong danh sách cảnh báo** — đúng ngày cần cảnh báo nhất |
| OQ-hrm-29 | Chỉ báo hồ sơ đủ/thiếu tính theo hợp đồng **đang hiệu lực hôm nay**, hay theo **hợp đồng hiện hành** (nhãn của BR-hrm-019, có thể là hợp đồng tương lai hoặc đã hết hạn)? | Người dùng nghiệp vụ | Hai cách đọc cho kết quả ngược nhau với nhân viên chỉ có hợp đồng đã hết hạn hoặc chỉ có hợp đồng tương lai |
| OQ-hrm-30 | Ai được xem **danh sách cảnh báo hạn giấy tờ**? Phản hồi chứa số hiệu giấy tờ (số căn cước, số hộ chiếu) của **toàn bộ nhân viên công ty** | Chủ tài khoản | Đặc tả dày công che lương và số tài khoản, rồi mở một đường trả số giấy tờ tùy thân toàn công ty cho bất kỳ ai vào được công ty |
| OQ-hrm-31 | Ký hợp đồng đầu tiên qua đường **đổi hợp đồng** (nhân viên chưa có hợp đồng nào): có bắt buộc gửi loại hợp đồng cần chốt không, khi không có gì để chốt? | Người dùng nghiệp vụ | Hiện trường này bắt buộc vô điều kiện nên nhánh đó bị từ chối vì thiếu một thông tin mô tả thứ không tồn tại |
| OQ-hrm-32 | Ký hợp đồng khoán **song song** cho người đang có hợp đồng lao động chính thì có tự tắt cờ đoàn viên công đoàn của họ không? | Kế toán trưởng, công đoàn | Luật tắt cờ một chiều (BR-hrm-025) viết trên giả định "mỗi lúc một hợp đồng" — QĐ #1 vừa xóa giả định đó. Người lao động vẫn là đoàn viên theo hợp đồng chính nhưng hệ thống âm thầm gỡ, và **không tự bật lại được** theo đúng thiết kế. Ảnh hưởng trích nộp phí công đoàn |

### 15.2 Đã đóng ngày 2026-09-07

| ID | Câu hỏi | Đóng bằng | Kết quả chốt |
|---|---|---|---|
| OQ-hrm-16 | Mặc định quyền xem lương cho người dùng đang có | QĐ #17 | **Giữ nguyên người cũ, siết người mới** — bước chuyển dữ liệu cấp quyền cho toàn bộ bản ghi phân quyền đang tồn tại; từ đó về sau mặc định là không được xem (BR-hrm-069) |
| OQ-hrm-18 | "Khác loại" theo nhãn gốc hay theo nhóm nghiệp vụ | QĐ #18 | **Theo nhóm nghiệp vụ, ba nhóm**: hợp đồng lao động / khoán-dịch vụ / thử việc. Kèm bắt buộc chuẩn hóa `loai_hd` về chữ thường (BR-hrm-022) |
| OQ-hrm-27 | Người phụ thuộc chuyển giữa hai nhân viên giữa năm | QĐ #19 | **Duy nhất có xét kỳ giảm trừ** — hai dòng cùng mã số thuế hợp lệ nếu kỳ không giao nhau; giữ được lịch sử kê khai (BR-hrm-030) |
| OQ-hrm-33 | Có làm đợt đổi tên đường dẫn API sang tiếng Anh không | QĐ #20 | **Hoãn** — contract đưa về đường tiếng Việt cho khớp mã nguồn và giao diện; ghi vào việc làm sau |
| OQ-hrm-01 | Có tồn tại thật trường hợp một nhân viên có đồng thời hai hợp đồng còn hiệu lực không? | QĐ #1 | **Có** — cho phép; chỉ chặn chồng lấn giữa hai hợp đồng **cùng loại** (BR-hrm-022) |
| OQ-hrm-02 | Chuyển phòng ban sang Ngừng hoạt động khi còn nhân viên có được không? Phòng ban ngừng hoạt động còn hiện trong ô chọn không? | QĐ #11 | **Được, có cảnh báo**; ô chọn **ẩn** phòng ngừng hoạt động, trừ phòng đang gán của chính nhân viên đang sửa (BR-hrm-060, BR-hrm-061) |
| OQ-hrm-03 | Xóa một dòng giấy tờ đang có file scan thì mong muốn điều gì? | QĐ #12 | **Xóa luôn file trên Drive** theo kiểu cố hết sức; hộp xác nhận phải nêu tên file (BR-hrm-039) |
| OQ-hrm-04 | Có cần khái niệm hồ sơ đủ/thiếu và theo dõi ngày hết hạn giấy tờ không? | QĐ #14 | **Làm đủ cả hai** (BR-hrm-062…065, thực thể `hrm_giay_to_bat_buoc`) |
| OQ-hrm-05 | Dữ liệu lương và giấy tờ tùy thân có cần nhật ký ai sửa gì lúc nào không? Mức chi tiết tới đâu? | QĐ #15 | **Có, cho 5 nhóm thao tác**; **không** ghi giá trị trước và sau (BR-hrm-066, NFR-hrm-011) |
| OQ-hrm-06 | Có cần vai trò chỉ-đọc và giấu trường nhạy cảm theo vai trò không? `ADMIN` bị chặn là chủ ý hay thiếu sót? | QĐ #8 + QĐ #9 | **Tách quyền xem dữ liệu lương** bên trong `OWNER_EMPLOYEE` (BR-hrm-059); `ADMIN` không có phạm vi tenant là **chủ ý, giữ nguyên** (BR-hrm-051) |
| OQ-hrm-07 | Lương chính có bắt buộc lớn hơn 0? Lương BHXH có bắt buộc khi bật trích BHXH? | QĐ #5 | **Cả hai đều bắt buộc** (BR-hrm-057, BR-hrm-058) |
| OQ-hrm-08 | Có cho phép hợp đồng bắt đầu trùng ngày kết thúc không? | QĐ #6 | **Cho phép** (BR-hrm-026); kéo theo khoảng ngày chống chồng lấn phải đóng hai đầu |
| OQ-hrm-10 | Ngưỡng hiệu năng cụ thể cho danh sách nhân viên và danh sách hợp đồng là bao nhiêu? | QĐ #16 | **Chưa đặt số, đo thực tế trước.** NFR-hrm-004 giữ dạng định tính; đợt này thêm chỉ mục rồi đo trên tenant lớn nhất và báo cáo số đo |
