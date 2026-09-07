---
type: adr
feature: hrm
status: accepted
updated: 2026-09-07
---

# ADR-004: Xóa mềm, lan truyền xuống bản ghi con, vòng đời file Drive và audit

> **Bổ sung 2026-09-07 (đợt chốt nghiệp vụ 16/16).** Ba quyết định chốt các câu hỏi mở của ADR này:
>
> | QĐ | Chốt | Hệ quả cho ADR |
> |:---|:---|:---|
> | **#13** | **Xóa mềm nhân viên KHÔNG đụng file scan** trên Drive; **chưa đặt thời hạn lưu trữ** | Hành vi hiện tại được xác nhận là **đúng ý**, không còn là thiếu sót. Lý do nghiệp vụ: hồ sơ người đã nghỉ còn dùng khi quyết toán thuế các năm sau. Chính sách xóa cứng và thời hạn lưu trữ nằm **ngoài phạm vi** đợt này — ghi nhận thành nợ kỹ thuật, không phải đầu việc |
> | **#12** | **Xóa dòng giấy tờ thì xóa luôn file trên Drive** | Sửa BUG-HRM-10. Xóa theo kiểu **cố hết sức**: Drive lỗi thì ghi log và **vẫn xóa dòng**, không để sự cố bên ngoài chặn thao tác nghiệp vụ. Giao diện phải xác nhận nêu **đích danh tên file** sắp mất |
> | **#15** | **Ghi nhật ký người thao tác cho đúng 5 nhóm**, **không** lưu giá trị trước/sau | Dùng cơ chế `writeLog` sẵn có, **không phát sinh bảng mới**. ⚠️ Điều này **cạnh tranh** với đề xuất cột audit `user_id0`/`user_id2` ở Mục Decision — làm cả hai là dựng hai cơ chế ghi vết song song cho cùng một mục đích. Kiến nghị: **bỏ cột audit**, giữ `writeLog`. Xem `data-model.md` M-03 |
>
> **Một khoảng trống đã biết:** thao tác ghi nhận nghỉ việc (QĐ #3) **tự sửa `ngay_ket_thuc` của hợp đồng** nhưng không thuộc nhóm nào trong 5 nhóm phải ghi nhật ký của BR-hrm-066. Đây là hệ quả của việc QĐ #15 liệt kê đúng năm nhóm và không nhóm nào phủ trường hợp này — cần người dùng nghiệp vụ xác nhận có bổ sung hay không.

## Context

HRM dùng **hai** cơ chế xóa song song, và mỗi bảng con lại có **FK `onDelete: Cascade`**. Nhìn qua
thì hai thứ này mâu thuẫn: "xóa mềm" mà lại khai "cascade xóa cứng". Chưa có tài liệu nào giải
thích, nên mỗi người đọc code hiểu một kiểu — đó chính là loại mơ hồ dẫn tới bug dữ liệu.

**Hiện trạng (đã kiểm chứng):**

| Bảng | Cơ chế xóa | Lý do | Bằng chứng |
|:---|:---|:---|:---|
| `hrm_phong_ban` | **Mềm** (`da_xoa`) | `ma_pb` đã nằm trên chứng từ kế toán; cấp lại mã = gán lịch sử đơn vị này sang đơn vị khác | `phongBan.service.ts:264-267` |
| `hrm_nhan_vien` | **Mềm** (`da_xoa`) | Bảng lương/chấm công (Payroll sắp tới) khóa theo `ma_nv` | `nhanVien.service.ts:238-241` |
| `hrm_hop_dong` | **Cứng** | PK là UUID, không có chuyện cấp lại mã | `hopDong.service.ts:290` |
| `hrm_nguoi_phu_thuoc` | **Cứng** | như trên | `nguoiPhuThuoc.service.ts:165` |
| `hrm_tai_lieu` | **Cứng** | như trên | `taiLieu.service.ts:133` |

Ba bảng con đều khai `@relation(..., onDelete: Cascade, onUpdate: Cascade)`
(`tenant/schema.prisma:943, 987, 1023`).

`da_xoa` **tách khỏi `status`** một cách cố ý (`:900-903`): "đã nghỉ việc" là dữ liệu nhân sự thật
(còn quyết toán thuế, còn trong báo cáo), khác hẳn "nhập nhầm nên xóa". Gộp chung thì người nhập
nhầm nằm lại trong báo cáo nhân sự mãi mãi.

**Ba vấn đề cần quyết:**

1. **Cascade có mâu thuẫn với xóa mềm không?** Giữ hay bỏ?
2. **File scan trên Drive không được dọn ở hai chỗ** — xóa tài liệu và xóa mềm nhân viên. Tài liệu
   cũ ghi `DELETE /tai-lieu/:id` xóa file "best-effort" nhưng **code không làm** (`taiLieu.service.ts:124-135`).
3. **Không truy được ai sửa gì.** 5 bảng `hrm_*` không có cột audit nào, dù helper
   `currentUserId(req)` đã có sẵn (`resolveTenantDb.ts:72-74`) và các bảng khác trong dự án dùng
   quy ước `user_id0`/`user_id2`. Lương và giảm trừ gia cảnh là dữ liệu **có thể bị sửa lén**.
   Tester-QA ghi cùng vấn đề ở góc khác (`BUG-HRM-18`): HRM **không gọi `writeLog`** ở bất kỳ đâu,
   nên các thao tác phá hủy (xóa hợp đồng, ngắt kết nối Drive, xóa NPT/tài liệu) không để lại vết
   nào. Hai thứ này bổ sung cho nhau, không thay thế nhau — xem Decision 4.

## Decision

### 1. GIỮ `onDelete: Cascade` — không mâu thuẫn, hai lớp phục vụ hai đường khác nhau

- Cascade chỉ chạy khi có `DELETE` **thật** trên `hrm_nhan_vien`. API HRM **không bao giờ** phát
  lệnh đó ⇒ qua API, cascade **không bao giờ kích hoạt**.
- Việc "ẩn theo" khi xóa mềm nhân viên là do **mọi truy vấn con đều lọc `nhan_vien: { da_xoa: false }`**:
  `hopDong.service.ts:172-174`, `nguoiPhuThuoc.service.ts:59-61`, `taiLieu.service.ts:55-57`,
  và trong `findFirst` của từng đường update/delete bản ghi con.
- Cascade vẫn **phải giữ** vì nó là lưới an toàn cho các đường xóa cứng **ngoài** API: script dọn
  dữ liệu, thao tác DB thủ công, và luồng xóa công ty. Bỏ đi là để lại hợp đồng/NPT/tài liệu mồ côi
  trỏ vào `ma_nv` không còn tồn tại.

**Ghi thành quy ước bắt buộc** (đưa vào `dev-notes.md`):

> Mọi truy vấn mới trên `hrm_hop_dong` / `hrm_nguoi_phu_thuoc` / `hrm_tai_lieu` **PHẢI** có
> `nhan_vien: { da_xoa: false }` trong `where`. Quên một chỗ là lộ dữ liệu hồ sơ đã xóa, im lặng,
> không có gì báo.
>
> **CẤM xóa cứng `hrm_nhan_vien`** bằng bất kỳ đường nào (API, script, tay). Cascade sẽ cuốn theo
> toàn bộ lịch sử hợp đồng — dữ liệu quyết toán thuế của người lao động.

### 2. Dọn file Drive khi xóa tài liệu — best-effort, KHÔNG chặn thao tác

`DELETE /tai-lieu/:id` phải xóa file trên Drive **trước** khi xóa dòng, nhưng **thất bại không được
chặn** việc xóa bản ghi.

```
1. tìm tài liệu (kèm drive_file_id) — 404 nếu không có
2. nếu có drive_file_id:
      thử: lấy token công ty -> access token -> xoaFile()
      hỏng: req.log.warn({ id, drive_file_id, err }) rồi ĐI TIẾP
3. xóa dòng trong DB
4. trả { id, da_xoa_file_drive: boolean }
```

**Vì sao best-effort chứ không nguyên tử:** không thể có transaction bao cả Postgres lẫn Google.
Chọn hướng nào cũng có một ca xấu:

- Xóa DB trước, Drive sau → hỏng ⇒ file mồ côi (**hiện trạng, luôn luôn xảy ra**).
- Xóa Drive trước, DB sau → hỏng ⇒ dòng còn con trỏ tới file đã mất ⇒ người dùng bấm xem nhận
  `DRIVE_FILE_KHONG_MO_DUOC`, và **xóa lại được** (thao tác lặp lại được).
- Chặn hoàn toàn khi Drive lỗi ⇒ Google sập là **không xóa được tài liệu nào**, kể cả dòng chỉ có
  metadata. Không chấp nhận được.

Chọn "Drive trước, DB sau, không chặn": ca xấu của nó **tự sửa được**, hai ca kia thì không.

**Thay đổi contract:** response `DELETE /tai-lieu/:id` thêm `da_xoa_file_drive: boolean`
(`false` khi không có file, hoặc khi có mà xóa hụt). FE nên hiện nhắc nhẹ khi `false` mà tài liệu
vốn có file: *"Đã xóa hồ sơ. Không xóa được file scan trên Google Drive — bạn có thể xóa thủ công."*

**Yêu cầu tách hàm:** logic Drive **không** được nhét vào `taiLieu.service.ts` (file đó cố ý không
biết Drive). Thêm `xoaFileNeuCo(db, donViId, taiLieu)` vào `taiLieuDrive.service.ts` và để
controller điều phối — đúng phân vai đã đặt: `driveClient` biết HTTP, `taiLieuDrive` biết DB + cây
thư mục, `taiLieu.service` chỉ biết metadata.

### 3. Xóa mềm nhân viên: KHÔNG tự động xóa file Drive (chờ BA)

Giữ nguyên hành vi hiện tại — xóa mềm nhân viên **không** đụng tới thư mục và file trên Drive.

Lý do: xóa mềm là hành động **có thể sai** (nhập nhầm rồi xóa), và ta không có đường khôi phục.
Tự động xóa file là biến một thao tác đảo ngược được (`da_xoa = true`) thành mất dữ liệu vĩnh viễn
trên Drive **của khách**.

Nhưng đây là **quyết định nghiệp vụ, không phải kỹ thuật** — liên quan nghĩa vụ bảo vệ dữ liệu cá
nhân. Đưa lên BA: **OQ-ARCH-06** và **OQ-ARCH-07**. Ba hướng để BA chọn:

| Hướng | Mô tả | Hệ quả |
|:---|:---|:---|
| **H1 (mặc định hiện nay)** | Giữ nguyên file vĩnh viễn | Đơn giản; nhưng dữ liệu cá nhân tồn tại vô thời hạn sau khi hồ sơ bị xóa |
| H2 | Đổi tên thư mục nhân viên thành `[DA XOA] <ma_nv> - <họ tên>` | Đảo ngược được, nhìn là biết; tốn 1 lượt gọi Drive khi xóa mềm |
| H3 | Xóa file khi **xóa cứng** nhân viên (nếu sau này có chức năng dọn dữ liệu định kỳ) | Đúng nhất về vòng đời; cần trước đó có chính sách retention |

Kiến trúc **đề xuất H2** khi BA cần dấu vết, và H3 khi có chính sách retention. Không tự quyết.

### 4. Thêm cột audit `user_id0` / `user_id2` cho 5 bảng `hrm_*`

- `user_id0` = người tạo, ghi 1 lần lúc `create`.
- `user_id2` = người sửa gần nhất, ghi mỗi lần `update` (gồm cả `da_xoa = true`).
- Kiểu `varchar(64)`, **nullable** để khỏi backfill dữ liệu cũ.
- Lấy từ `currentUserId(req)` — helper **đã có sẵn**, chỉ chưa dùng.

Vì sao cần: lương (`luong_chinh`, `luong_bhxh`), mức đóng BHXH và giảm trừ gia cảnh là những con số
**có động cơ để sửa lén**. Hiện tại `datetime2` cho biết *khi nào* nhưng không cho biết *ai*.
Với module có nhiều người cùng vào (kế toán + HR + chủ), thiếu cột này là không điều tra được.

**Không** làm bảng lịch sử thay đổi (audit trail đầy đủ) ở đợt này — over-engineering so với nhu
cầu hiện tại; hai cột này giải quyết 80% câu hỏi thực tế ("ai vừa sửa lương người này").

**Kèm theo — gọi `writeLog` cho thao tác PHÁ HỦY** (`BUG-HRM-18` của QA): hai cột audit trả lời
được "ai sửa gần nhất" nhưng **không** ghi lại thứ đã biến mất. Bốn thao tác sau xóa dữ liệu thật
và cần một dòng nhật ký độc lập với bản ghi bị xóa:

| Thao tác | Vì sao |
|:---|:---|
| `DELETE /hop-dong/:id` | Xóa cứng lịch sử lương — không còn dòng nào để mang cột audit |
| `DELETE /nguoi-phu-thuoc/:id` | Xóa cứng; ảnh hưởng số thuế TNCN đã kê khai |
| `DELETE /tai-lieu/:id` (+ `/file`) | Xóa cứng con trỏ và (theo Decision 2) cả file trên Drive |
| `DELETE /tai-lieu/drive/ket-noi` | Cắt đường xem file của **cả công ty** |

Dùng `writeLog` sẵn có (`be_maxv/src/services/shared/syslog.service.ts:15`, đang được
`adminCompany.service.ts` dùng theo mẫu `{ hanhDong, userId, donViId }`) — **không** dựng cơ chế
riêng cho HRM.

SQL: `data-model.md` Mục 8, M-03.

### 5. Chưa làm chức năng khôi phục bản ghi đã xóa mềm

Không có API/màn hình khôi phục. Chấp nhận **có chủ ý** ở đợt này: xóa mềm hiếm, và can thiệp DB
là đường thoát. Nhưng phải nói rõ với người vận hành, đừng để họ tưởng có nút "hoàn tác" ở đâu đó.

Nếu sau này làm: `PUT /nhan-vien/:ma_nv/khoi-phuc` đặt `da_xoa = false` — **và phải kiểm tra
`ma_pb` của nhân viên đó còn tồn tại không**, vì phòng ban có thể đã bị xóa mềm trong lúc đó.

## Alternatives

| # | Phương án | Ưu | Nhược | Kết luận |
|:---:|:---|:---|:---|:---|
| **A** | **Giữ cascade + lọc `da_xoa` ở mọi truy vấn con** (chọn) | Không đổi schema; cascade bảo vệ đường ghi ngoài API; hành vi hiện tại đã đúng | Phụ thuộc **kỷ luật code** — quên `da_xoa: false` một chỗ là lộ dữ liệu | **Chọn** + ghi thành quy ước bắt buộc |
| B | Bỏ cascade, đổi thành `onDelete: Restrict` | Chặn xóa cứng nhân viên ở tầng DB, đúng tinh thần "không mất lịch sử lương" | Xóa công ty (`DROP DATABASE`) không bị ảnh hưởng, nên lợi ích thực tế nhỏ; lại phải migration trên **mọi** tenant | Không chọn đợt này; cân nhắc lại khi có Payroll |
| C | Thêm `da_xoa` cho cả 3 bảng con, xóa mềm toàn bộ | Đồng nhất một cơ chế; khôi phục dễ | Thêm cột + sửa mọi truy vấn trên 3 bảng; PK là UUID nên **không có lý do nghiệp vụ** để giữ dòng lại; dữ liệu rác tích tụ | Không chọn — xóa mềm là để **giữ mã**, mà UUID thì không cần giữ |
| D | Cột `deleted_at timestamp` thay `da_xoa boolean` | Biết cả thời điểm xóa, phục vụ retention | Đổi kiểu cột trên bảng đang chạy ở mọi tenant; `datetime2` đã ghi được thời điểm sửa cuối (chính là lúc xóa) | Không chọn — lợi ích không bù chi phí migration |
| E | Bảng lịch sử thay đổi đầy đủ (audit trail) | Truy vết được mọi thay đổi từng trường | Thêm bảng + trigger hoặc middleware Prisma trên mọi tenant; phình dữ liệu | Không chọn ở đợt này — `user_id0/2` đủ dùng |

## Trade-offs

- **Nhận:** "ẩn theo" phụ thuộc kỷ luật code chứ không phải ràng buộc DB. Bù bằng quy ước tường
  minh trong `dev-notes.md` + ca kiểm thử QA bắt buộc (xóa mềm nhân viên rồi gọi cả 3 endpoint con,
  kỳ vọng `[]` và 404).
- **Nhận:** dòng `da_xoa = true` nằm lại **vĩnh viễn**, không có chính sách dọn. Đó chính là cái
  giá của "mã không bao giờ được cấp lại" — chấp nhận có ý thức, và đưa retention lên BA (OQ-ARCH-07).
- **Nhận:** thêm 2 cột × 5 bảng × N tenant. Nullable nên migration nhanh, không khóa bảng lâu.
- **Đổi lấy:** không còn file mồ côi ở đường xóa tài liệu (ca xảy ra thường xuyên nhất), và trả lời
  được câu "ai sửa lương người này" — hai thứ hiện đang không có.

## Consequences

- **Backend Engineer:**
  1. `taiLieuDrive.service.ts`: thêm `xoaFileNeuCo()`; `taiLieu.controller.ts#remove` gọi nó trước
     `deleteTaiLieu`, nuốt lỗi + `req.log.warn`.
  2. Migration M-03 (audit) — chạy trên mọi tenant + bổ sung vào luồng cấp DB tenant mới.
  3. Truyền `currentUserId(req)` từ controller xuống service cho mọi đường `create`/`update`/xóa mềm.
  4. Thêm quy ước "mọi truy vấn con phải lọc `da_xoa`" vào `dev-notes.md`.
- **API contract:** `DELETE /tai-lieu/:id` đổi response thành
  `{ id, da_xoa_file_drive }` — **breaking change nhỏ** với FE (thêm trường, không bỏ trường nào),
  cập nhật `api-contract.md` Mục 6.4 khi code xong.
- **Frontend (`hdđt_maxv`):** (a) sửa `nhanVienApi.ts:112` `so_npt_da_xoa` → `so_npt_an_theo`
  (đang đọc trường không tồn tại); (b) hiện nhắc khi `da_xoa_file_drive = false`; (c) làm rõ trên
  UI rằng xóa nhân viên **không** xóa file scan trên Drive.
- **Tester-QA** bổ sung:
  - Xóa mềm nhân viên ⇒ `GET /hop-dong?ma_nv=`, `GET /nguoi-phu-thuoc?ma_nv=`, `GET /tai-lieu?ma_nv=`
    đều trả `[]`; `GET /nhan-vien/:ma_nv` trả 404; **và** bản ghi con vẫn còn trong DB (kiểm trực tiếp).
  - Xóa tài liệu **có file** ⇒ file biến mất trên Drive, `da_xoa_file_drive = true`.
  - Xóa tài liệu khi Drive lỗi (giả lập 502) ⇒ **vẫn 200**, `da_xoa_file_drive = false`, có dòng log.
  - Tạo/sửa bất kỳ bản ghi HRM nào ⇒ `user_id0`/`user_id2` đúng người đang đăng nhập.
- **BA:** chốt **OQ-ARCH-06** (dọn file Drive khi xóa nhân viên: H1/H2/H3) và **OQ-ARCH-07**
  (thời hạn lưu trữ hồ sơ nhân sự sau khi nghỉ việc).
