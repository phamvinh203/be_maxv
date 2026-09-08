---
type: dev-notes
feature: hrm
status: in-review
updated: 2026-09-07
links:
  - docs/hrm/architecture/api-contract.md
  - docs/hrm/architecture/data-model.md
---

# HRM — DEV NOTES (đọc cái này trước khi mở code)

> Mục tiêu: đọc xong biết **mô hình nghiệp vụ**, biết **thao tác nào nằm ở hàm nào**, và biết
> **chỗ nào tuyệt đối không được nhân đôi logic**. Mọi khẳng định có `file:line`.
>
> Backend ghi mục 1, Frontend ghi mục 2 — **mỗi bên chỉ sửa phần của mình**.

---

## 1. Backend (`be_maxv`)

### 1.1. Mô hình nghiệp vụ — hiểu 6 điều này trước khi đọc dòng code nào

1. **Hợp đồng là nguồn sự thật, nhân viên không giữ bản sao.** `hrm_nhan_vien` **không có** cột
   `so_hop_dong` / `luong_chinh` / `bhxh`… (bỏ 2026-09-05). Sáu trường hợp đồng trong phản hồi
   `GET /nhan-vien` được **tính lúc đọc**. Lý do và hệ quả: `ADR-002` mục A.
2. **"Hợp đồng hiện hành" phụ thuộc NGÀY HÔM NAY** ⇒ không lưu được, và mọi chỗ so sánh ngày phải
   dùng **giờ Việt Nam**, không phải UTC.
3. **Xóa mềm cho `ma_pb`/`ma_nv`, xóa cứng cho UUID.** Mã đã cấp **không bao giờ** được cấp lại —
   nó nằm trên chứng từ kế toán và (sắp tới) bảng lương.
4. **Cô lập tenant bằng DATABASE RIÊNG**, không bằng cột lọc. Mỗi request lấy đúng một
   `PrismaClient` trỏ vào `maxv_<MST>_app` của công ty đang chọn.
5. **File scan nằm trên Google Drive CỦA KHÁCH**, DB chỉ giữ con trỏ. MAXV không giữ bản sao và
   không khôi phục được.
6. **Trong một công ty còn một lớp quyền nữa: QUYỀN XEM DỮ LIỆU LƯƠNG** (đợt P0, QĐ #8). Vào được
   công ty **không** đồng nghĩa xem được lương. Cờ nằm ở cặp (người dùng, công ty) và **tra lại từ
   cơ sở dữ liệu mỗi lượt gọi**, không nằm trong vé đăng nhập.

**Luồng dữ liệu một request HRM (đọc từ trái sang phải):**

```
HTTP  ->  hrm.route.ts (authenticate + requireModule('hrm'))
      ->  controller  ->  resolveTenantCtx(req)
                            |-- sysPrisma.donVi.findFirst(scope + access.xemLuong)  [maxv2_sys]
                            |-- getTenantDb(dbName)                          [maxv_<MST>_app]
                            '-> { db, maSoThue, xemLuong }
      ->  (nhom /hop-dong)  assertXemLuong(ctx)  --khong co quyen-->  403 E-hrm-058
      ->  validator Zod  --sai-->  400 { errors.fieldErrors }
      ->  service --$transaction--> [pre-check nghiep vu] -> ghi
                                            |
                       ConflictError 409 <--'  (thong diep neu dich danh dong dang vuong)
      ->  ghiCoRangBuoc: loi RANG BUOC DB (23P01 / unique) -> doi sang ConflictError 409
      ->  errorHandler.plugin.ts -> { success:false, message } | { success:false, errors }
```

**Hai lớp phòng thủ, KHÔNG phải trùng lặp:** pre-check ở service lo 99% ca (người dùng nhập sai) và
nói rõ đang đụng hợp đồng / nhân viên nào; ràng buộc `EXCLUDE` / `UNIQUE` ở Postgres là chốt cuối
khi hai yêu cầu vào cùng lúc — lúc đó chỉ còn thông điệp chung, nhưng dữ liệu vẫn đúng.

### 1.2. Bản đồ: thao tác nghiệp vụ → route → controller → service → hàm

| Thao tác nghiệp vụ | Method + Path | Controller | Service — hàm | Logic đáng chú ý |
|:---|:---|:---|:---|:---|
| Xem cây phòng ban + đếm NV | `GET /phong-ban` | `phongBan.controller.ts:23` | `phongBan.service.ts` → `listPhongBan:116` | 3 query song song; `ten_pb_me` map trong bộ nhớ; `so_nv` chỉ đếm `status='1'` |
| Thêm phòng ban (tự sinh mã cây) | `POST /phong-ban` | `:30` | `createPhongBan:160` → `sinhMaPhongBan:42` | Kiểm cha **trước** rồi mới sinh mã; quét cả `da_xoa=true` |
| Sửa phòng ban (chống vòng lặp) | `PUT /phong-ban/:ma_pb` | `:37` | `updatePhongBan:194` → `assertKhongVongLap:89` | Đi ngược chuỗi cha, `Set` vừa phát hiện vòng vừa chốt an toàn |
| Xóa mềm phòng ban | `DELETE /phong-ban/:ma_pb` | `:45` | `deletePhongBan:225` | Chặn khi còn PB con **hoặc** còn NV (**tính cả người đã nghỉ**) |
| Xem danh sách nhân viên | `GET /nhan-vien` | `nhanVien.controller.ts:32` | `nhanVien.service.ts` → `listNhanVien:139` | **4 query cố định**, không N+1; ghép hợp đồng qua `hopDongHienHanhTheoNv`; **che 3 trường ngân hàng** theo `xemLuong` |
| Xem hồ sơ 1 nhân viên | `GET /nhan-vien/:ma_nv` | `:39` | `getNhanVien:209` | **Không** trả `ten_pb`/`so_npt` (khác list); cũng che 3 trường ngân hàng |
| Thêm nhân viên (tự sinh `NVxxxx`) | `POST /nhan-vien` | `:46` | `createNhanVien:230` → `sinhMaNhanVien:98` | Quét cả bản ghi đã xóa; `assertNotExists` **không** lọc `da_xoa` |
| Sửa hồ sơ nhân viên | `PUT /nhan-vien/:ma_nv` | `:53` | `updateNhanVien:260` | Body bắt buộc 2 cờ chế độ **và `status`** (xem 1.4); không có quyền lương thì 3 trường ngân hàng bị **bỏ qua**, giữ giá trị cũ |
| Xóa mềm nhân viên | `DELETE /nhan-vien/:ma_nv` | `:61` | `deleteNhanVien:291` | Trả `so_npt_an_theo`; **không** đụng dữ liệu con, không đụng Drive |
| Xem lịch sử hợp đồng | `GET /hop-dong` | `hopDong.controller.ts:41` | `hopDong.service.ts` → `listHopDong:329` | `ma_nv` **BẮT BUỘC**; cả nhóm chặn theo `dbCoQuyenLuong:34` → 403 E-hrm-058 |
| Ký hợp đồng | `POST /hop-dong` | `:48` | `createHopDong:348` | `$transaction`: nhân viên → `assertSoHdDuyNhat:308` → `assertKhongChongLan:253` → ghi |
| **Đổi hợp đồng** (chốt cũ + ký mới) | `POST /hop-dong/doi` | `:55` | `doiHopDong:409` | Nguyên tử; tìm HĐ cần chốt theo `homNayVN()` **và đúng nhóm** `loai_hd_can_chot`; kiểm chồng lấn **sau** bước chốt |
| Sửa hợp đồng | `PUT /hop-dong/:id` | `:62` | `updateHopDong:369` | Cũng chạy luật công đoàn; hai pre-check truyền `boQuaId = id` |
| Xóa hợp đồng | `DELETE /hop-dong/:id` | `:70` | `deleteHopDong:493` | Xóa **cứng**; không đồng bộ gì sang nhân viên (đúng — tính lúc đọc) |
| Xem NPT | `GET /nguoi-phu-thuoc` | `nguoiPhuThuoc.controller.ts:23` | `nguoiPhuThuoc.service.ts` → `listNguoiPhuThuoc:54` | `ten_nv` tra lúc đọc, không lưu trùng |
| Thêm NPT (chặn trùng MST **có xét kỳ**) | `POST /nguoi-phu-thuoc` | `:30` | `createNguoiPhuThuoc:184` → `assertKhongTrungMst:147` | Phạm vi **toàn công ty**; `mst = null` **không** bị chặn (đúng ý); bỏ qua dòng của NV đã xóa mềm |
| Sửa NPT | `PUT /nguoi-phu-thuoc/:id` | `:37` | `updateNguoiPhuThuoc:199` | Bỏ qua chính dòng đang sửa khi chống trùng |
| Xóa NPT | `DELETE /nguoi-phu-thuoc/:id` | `:45` | `deleteNguoiPhuThuoc:154` | Xóa **cứng** |
| Xem hồ sơ giấy tờ | `GET /tai-lieu` | `taiLieu.controller.ts:43` | `taiLieu.service.ts` → `listTaiLieu:219` | ⚠️ `?loai=` so khớp chính xác, phân biệt hoa thường |
| Thêm giấy tờ (chưa có file) | `POST /tai-lieu` | `:50` | `createTaiLieu:256` | `$transaction` |
| Sửa metadata giấy tờ | `PUT /tai-lieu/:id` | `:57` | `updateTaiLieu:266` | Không đụng 4 cột file |
| Xóa giấy tờ | `DELETE /tai-lieu/:id` | `:65` | `deleteTaiLieu:291` | 🚨 **KHÔNG** xóa file Drive ⇒ file mồ côi (`ADR-004`) |
| Kiểm tra kết nối Drive | `GET /tai-lieu/drive/trang-thai` | `:121` | `taiLieuDrive.service.ts` → `trangThaiDrive:70` | Không cần DB tenant |
| Lấy URL đăng nhập Google | `GET /tai-lieu/drive/lien-ket` | `:141` | `driveClient.ts` → `taoState:469`, `urlDangNhap:136` | Đặt cookie `driveOauthState`; đã nối rồi thì **chỉ OWNER** |
| Google gọi về | `GET /tai-lieu/drive/callback` | `:189` | `docState:475` → `luuKetNoiDrive:83` | **Miễn auth**; trả HTML + CSP nonce; xóa cookie trước mọi nhánh |
| Ngắt kết nối Drive | `DELETE /tai-lieu/drive/ket-noi` | `:276` | `ngatKetNoiDrive:163` | **Chỉ OWNER**; xóa 5 cột + mọi `drive_folder_id` |
| Tải file scan lên | `POST /tai-lieu/:id/file` | `:289` | `dinhKemFile:314` | Trần 10MB + danh sách trắng MIME; xóa file cũ **sau** khi upload mới xong |
| Xem/tải file scan | `GET /tai-lieu/:id/file` | `:335` | `taiFileVe:371` → `layNoiDungFile:382` | ⚠️ nạp trọn vào RAM, chưa phải stream (`ADR-005`) |
| Gỡ file scan | `DELETE /tai-lieu/:id/file` | `:361` | `goFile:407` | Xóa Drive rồi mới xóa 4 cột con trỏ |

**Hạ tầng dùng chung** (không nằm trong `hrm/`, đừng viết lại):

| Việc | Nơi ở |
|:---|:---|
| Mount + auth + guard module | `routes/hrm/hrm.route.ts:19-36` |
| Chọn DB tenant + kiểm quyền MST | `helpers/resolveTenantDb.ts` → `resolveTenantInfo:47` |
| **Tenant client + quyền xem lương trong 1 truy vấn** | `helpers/resolveTenantDb.ts` → `resolveTenantCtx:96` |
| **Chặn theo quyền xem lương (403 E-hrm-058)** | `helpers/resolveTenantDb.ts` → `assertXemLuong:107` |
| **Đổi lỗi ràng buộc Postgres → lỗi nghiệp vụ** | `services/client/hrm/rangBuocDb.ts` → `doiLoiRangBuocHrm:50`, `ghiCoRangBuoc:72` |
| **SQL ràng buộc + câu quét dữ liệu cho DB tenant** | `services/shared/hrmTenantConstraints.ts` |
| Pool client tenant + idle-eviction | `helpers/tenantClient.ts:28-65` |
| Envelope `{success,data}` | `helpers/response.ts:4-10` |
| Ánh xạ lỗi → HTTP status | `plugins/errorHandler.plugin.ts:23-110` |
| Lớp lỗi nghiệp vụ | `helpers/errors.ts` |
| Toàn bộ chuỗi thông báo tiếng Việt | `constants/messages.ts` (mục `HRM` ở `:114-141`) |
| Zod primitives (`ngayISO`, `optText`, `optMst`, `optEmail`) | `validators/shared/primitives.ts` |
| `assertNotExists` / `findOrThrow` | `helpers/crudGuards.ts` |
| Mã hóa AES-256-GCM | `services/client/hddt/gdtCredential.ts` |

### 1.3. Nơi ở của các công thức / luật nghiệp vụ

| Luật | Hàm — nơi ở DUY NHẤT |
|:---|:---|
| Chọn hợp đồng hiện hành | `chonHopDongHienHanh` — `hopDong.service.ts:160` |
| Thứ tự chuẩn lịch sử hợp đồng | `sapXepHopDong` — `hopDong.service.ts:181` |
| "Hôm nay" theo giờ Việt Nam | `homNayVN` — `hopDong.service.ts:128` |
| **Gom nhãn `loai_hd` → 3 NHÓM nghiệp vụ** (hiển thị **và** khóa chống chồng lấn) | `loaiHdVeNhanVien` — `hopDong.service.ts:60` |
| **Hai khoảng ngày giao nhau (đóng hai đầu)** | `khoangGiaoNhau` — `hopDong.service.ts:82` |
| **Luật chồng lấn hợp đồng (nhóm + ngày)** — hàm thuần | `hopDongChongLan` — `hopDong.service.ts:108` |
| **Pre-check chồng lấn (bản có DB)** | `assertKhongChongLan` — `hopDong.service.ts:253` |
| **Số hợp đồng duy nhất toàn công ty** | `assertSoHdDuyNhat` — `hopDong.service.ts:308` |
| **Ràng buộc lương (`> 0`, BHXH)** | `soatLuong` — `validators/hrm/hopDong.validator.ts` (trong `soatChungHopDong`) |
| **Luật ngày `ket_thuc >= bat_dau`** | `soatNgay` — `validators/hrm/hopDong.validator.ts` |
| Luật công đoàn một chiều | `apDungLuatCongDoan` — `hopDong.service.ts:228` |
| Sinh mã phòng ban theo cây | `sinhMaPhongBan` — `phongBan.service.ts:42-59` |
| Sinh mã nhân viên | `sinhMaNhanVien` — `nhanVien.service.ts:98` |
| Chống vòng lặp cây phòng ban | `assertKhongVongLap` — `phongBan.service.ts:89-110` |
| **Quy kỳ giảm trừ về số tháng** | `kyGiamTruTheoThang` — `nguoiPhuThuoc.service.ts:103` |
| **Hai kỳ giảm trừ giao nhau (đóng hai đầu, theo tháng)** | `kyGiamTruGiaoNhau` — `nguoiPhuThuoc.service.ts:122` |
| **Chống trùng MST người phụ thuộc (toàn công ty, có xét kỳ)** | `assertKhongTrungMst` — `nguoiPhuThuoc.service.ts:147` |
| **Che 3 trường ngân hàng khi đọc** | `cheTruongLuong` — `nhanVien.service.ts:56` |
| **Bỏ 3 trường ngân hàng khi ghi** | `boTruongLuongKhiGhi` — `nhanVien.service.ts:75` |
| **Suy quyền xem lương của phiên** | `resolveTenantInfo` — `helpers/resolveTenantDb.ts:47` (nhánh `role === 'OWNER'`) |
| Ký/đọc `state` OAuth | `kyState`/`taoState`/`docState` — `driveClient.ts:463-489` |
| Cây thư mục Drive | `thuMucCongTy:247` / `thuMucNhanVien:268` — `taiLieuDrive.service.ts` |

**Bản SQL của ba luật trên nằm ở `services/shared/hrmTenantConstraints.ts`** — `sqlNhomHd`,
`sqlKhoangHopDong`, `sqlKyNptTuDinhDanh`. Chúng phải khớp **từng chữ** với bản TypeScript; hai
tầng lệch nhau là hai luật khác nhau (đúng thứ đã sinh ra BUG-HRM-27). Có test hình dạng canh
chuyện này ở `src/__tests__/hrmQuyenVaNpt.test.ts` mục cuối, nhưng test hình dạng **không thay
được** test tích hợp chạy SQL thật.

### 1.3b. Ràng buộc ở tầng cơ sở dữ liệu tenant — cơ chế KHÁC hẳn migration thường

**Đọc mục này trước khi định viết migration cho bảng `hrm_*`.**

`prisma/tenant/` **không có** thư mục `migrations/`. Schema tenant áp bằng
`prisma db push --accept-data-loss`, lặp qua từng `DonVi.dbName`. Nghĩa là **không có
`migration.sql` nào để chèn SQL tay**, và ba thứ Prisma DSL không mô tả được — `CREATE EXTENSION`,
`CREATE FUNCTION`, `EXCLUDE USING gist` — phải sống ở chỗ khác.

| | Control plane (`maxv2_sys`) | Tenant (`maxv_<MST>_app`) |
|:---|:---|:---|
| Áp schema bằng | `prisma migrate deploy` (`npm run migrate:sys*`) | `prisma db push` (`npm run sync:tenants`) |
| Có lịch sử migration | Có | **Không** |
| Ràng buộc SQL tay để ở đâu | Trong `migration.sql` bình thường | `src/services/shared/hrmTenantConstraints.ts` |

**Bốn lệnh, theo đúng thứ tự này** `[SỬA BUG-HRM-33]`:

```bash
npm run hrm:ra-soat      # (1) CHỈ ĐỌC — liệt kê dữ liệu vi phạm ở mọi tenant
                         #     thêm -- --json để xuất báo cáo gửi khách

#  (2) Nghiệp vụ dọn dữ liệu bẩn — kế toán quyết cách chốt ngày, script KHÔNG tự dọn

npm run sync:tenants     # (3) Đẩy schema tenant. BẮT BUỘC có bước này: khóa duy nhất cũ
                         #     (ma_nv, mst) đã bỏ khỏi schema.prisma, và `db push` mới là
                         #     bên gỡ nó khỏi cơ sở dữ liệu.

npm run hrm:constraints  # (4) Áp ràng buộc; tenant còn bẩn thì bỏ qua đúng ràng buộc đó,
                         #     không dừng cả lượt
```

> 🚨 **Bước (3) từng bị bỏ sót trong bản đầu của runbook này (BUG-HRM-33).** Script bước (4) có
> gỡ khóa cũ, nhưng ban đầu chỉ gỡ bằng `ALTER TABLE ... DROP CONSTRAINT` — mà Prisma sinh
> `@@unique` bằng `CREATE UNIQUE INDEX`, và **index không phải constraint**, nên lệnh đó chạy qua
> im lặng và khóa cũ sống sót. Đã đo thật rồi ROLLBACK: sau lệnh đó `pg_indexes` vẫn còn dòng,
> chỉ `DROP INDEX` mới gỡ được. Nay script gỡ **cả hai nhánh** (constraint rồi index), nhưng
> `sync:tenants` vẫn phải chạy trước để schema và cơ sở dữ liệu không đá nhau ở lần push sau.
>
> **Phải chạy lại bước (4) sau MỖI lần `sync:tenants`** — Prisma có thể drop index nó không biết.
> Điều này **chưa được đo**, còn nợ.

**`npm run hrm:constraints` phải chạy lại sau MỖI lần `npm run sync:tenants`.** Prisma quản lý
index theo `schema.prisma` nên thứ nó không biết **có thể** bị drop ở lần push kế tiếp — điều này
**chưa được đo** (`data-model.md` Mục 8.0 điểm 3), và cho tới khi đo xong thì chạy lại là cách rẻ
nhất để không mất lớp phòng thủ. Script idempotent, chạy thừa vô hại.

**Tenant cấp MỚI không cần chạy tay:** `provisionTenant` gọi `applyTenantConstraints(dbName)` ngay
sau `pushTenantSchema` (`services/shared/provisioning.service.ts`). Bỏ bước đó là công ty vừa mở đã
hở đúng những lỗ vừa vá cho công ty cũ.

| Ràng buộc | Bảng | Mã tài liệu |
|:---|:---|:---|
| `btree_gist`, `hrm_nhom_hd()`, `hrm_ky_npt()` | — | M-01, M-09 |
| `hrm_hop_dong_khong_chong_lan` (`EXCLUDE USING gist`) | `hrm_hop_dong` | M-01 |
| `hrm_hop_dong_so_hd_key` (unique) | `hrm_hop_dong` | M-07 |
| `hrm_hop_dong_ma_nv_ngay_bat_dau_idx`, `hrm_hop_dong_hien_hanh_idx` | `hrm_hop_dong` | M-02, M-05 |
| DROP `hrm_nguoi_phu_thuoc_ma_nv_mst_key` + ADD `hrm_npt_mst_khong_trung_ky` | `hrm_nguoi_phu_thuoc` | M-09 |

`@@unique([ma_nv, mst])` đã **bỏ khỏi `prisma/tenant/schema.prisma`**: giữ lại thì mỗi lần
`db push` Prisma tạo lại khóa cũ còn script lại drop đi — hai tầng đá nhau vô tận.

`so_hd` unique **cố ý không** khai trong `schema.prisma`: khai ở đó thì `db push` **fail toàn bộ**
trên tenant còn số hợp đồng trùng, kéo theo mọi thay đổi schema khác của tenant đó cũng không lên
được. Ở script thì chỉ riêng bước đó báo lỗi.

`xemLuong` là ngoại lệ duy nhất — nó ở **control plane** nên đi migration Prisma bình thường:
`prisma/sys/migrations/20260907090000_add_xem_luong_to_don_vi_access/`. **Câu `UPDATE
"don_vi_access" SET "xemLuong" = true;` trong migration đó KHÔNG được bỏ** (BR-hrm-069): thiếu nó
thì đúng ngày triển khai mọi kế toán đang làm việc mất màn hợp đồng cùng lúc.

### 1.4. TUYỆT ĐỐI KHÔNG NHÂN ĐÔI — 16 điều

1. **Không** thêm lại cột hợp đồng vào `hrm_nhan_vien` dưới bất kỳ tên nào. Đã bỏ có lý do, và lý
   do đó không mất đi (`ADR-002` mục A). Cần nhanh hơn thì thêm **index**, đừng thêm bản sao.
2. **Không** viết lại luật "hợp đồng hiện hành" ở Payroll hay bất kỳ service nào khác.
   Gọi `hopDongHienHanhTheoNv(db, maNvs)` — nó đã nhận **mảng** `ma_nv` và trả `Map`, dùng được cho
   cả một danh sách trong **một** query.
   ⚠️ **Luật này đang bị nhân đôi ở FE** (`hdđt_maxv/src/features/hrm/cay.ts:115` `hopDongHienHanh`)
   — xem mục 2.5, phải dọn.
3. **Không** dùng `new Date()` + `setUTCHours(0)` ở bất cứ đâu trong HRM. Dùng `homNayVN()`
   (`hopDong.service.ts:128`, đã export). Chỗ vi phạm cũ ở `doiHopDong` **đã sửa** trong đợt P0 —
   đừng đưa lại. Sửa một trong hai hàm mà quên hàm kia thì chúng bất đồng **bảy tiếng mỗi ngày**.
4. **Không** sinh mã `NVxxxx` / `PBxx` ở FE. Server là nơi cấp mã duy nhất — hai trình duyệt không
   thỏa thuận được với nhau mã kế tiếp là gì.
   ⚠️ **Đang bị vi phạm**: `cay.ts:87,98` vẫn còn `sinhMaPhongBan`/`sinhMaNhanVien` và
   `nhanVienQueries.ts:189` vẫn gọi để gợi ý mã trên form — xem mục 2.5.
5. **Không** bỏ điều kiện quét **cả bản ghi đã xóa mềm** khi sinh mã. Bỏ là cấp lại mã người cũ cho
   người mới, im lặng, không phát hiện được về sau.
6. **Mọi** truy vấn mới trên `hrm_hop_dong` / `hrm_nguoi_phu_thuoc` / `hrm_tai_lieu` **PHẢI** có
   `nhan_vien: { da_xoa: false }`. Quên một chỗ là lộ dữ liệu hồ sơ đã xóa (`ADR-004`).
7. **CẤM xóa cứng `hrm_nhan_vien`** bằng mọi đường (API, script, tay). FK `onDelete: Cascade` sẽ
   cuốn theo **toàn bộ lịch sử hợp đồng** — dữ liệu quyết toán thuế của người lao động.
8. **Không bao giờ** cache access token Drive ở cấp module. Một tiến trình phục vụ nhiều tenant;
   cache nhầm là **dùng token công ty này gọi Drive công ty khác** (`driveClient.ts:203-205`,
   `ADR-006` mục 6). Muốn cache thì khóa **phải** là `donViId` và phải có test chứng minh.
9. **Không** nhận `donViId` / `maSoThue` / `dbName` từ client. Chỉ hai đường: `resolveTenantDb(req)`
   và `donViDangChon(req)` (`ADR-006` mục 2).
10. **Không** viết chuỗi thông báo tiếng Việt rải rác trong service. Câu dùng lại được thì vào
    `constants/messages.ts`; câu có tham số động (tên mã, số lượng) thì dựng tại chỗ nhưng **giữ
    đúng giọng** các câu đã có: nói rõ **chuyện gì sai** và **phải làm gì tiếp**.

**Sáu điều bổ sung từ đợt P0 — đều là chỗ đã từng hỏng, không phải lo xa:**

11. **Không** viết bản gom nhóm hợp đồng thứ hai. `loaiHdVeNhanVien` phục vụ **cả** hiển thị **và**
    khóa chống chồng lấn — đó là chủ ý (BR-hrm-022). Hai bản gom khác nhau là hai luật khác nhau, và
    khóa theo nhãn `loai_hd` thô thì một người có ba hợp đồng lao động chồng nhau, mỗi cái một nhãn
    (BUG-HRM-27). Bản SQL tương ứng là `sqlNhomHd`, sửa một bên phải sửa bên kia.
12. **Không** đổi khoảng ngày chống chồng lấn sang nửa mở. `khoangGiaoNhau` và `sqlKhoangHopDong`
    dùng khoảng **đóng hai đầu** vì hợp đồng đúng một ngày là hợp lệ (QĐ #6); nửa mở thì hợp đồng
    một ngày có độ dài bằng không và **không bao giờ** bị bắt chồng lấn.
13. **Không** bắt lỗi ràng buộc loại trừ bằng `error.code`. SQLSTATE là `23P01` và Prisma **không**
    map nó thành `P2002` — phải đối chiếu **tên ràng buộc** qua `doiLoiRangBuocHrm`
    (`rangBuocDb.ts:50`). Thêm ràng buộc mới thì thêm tên vào `RANG_BUOC` ở cùng file, đừng dò chuỗi
    tại chỗ.
14. **Không** đưa `xemLuong` vào JWT (BR-hrm-068). Vé sống 15 phút và cố ý không đối chiếu dữ liệu
    mỗi lượt; nhét vào đó là thu hồi quyền **trễ 15 phút, im lặng**. Đọc qua `resolveTenantCtx`, tốn
    tốn thêm ~0,36 ms mỗi lượt (đo thật trên cơ sở dữ liệu: 0,80 → 1,17 ms, trung bình 200 lần). KHÔNG phải 0 — Prisma bắn một truy vấn riêng cho quan hệ vì `relationJoins` không bật. Nhỏ, nhưng nó nằm trên đường đi chung của **hóa đơn điện tử** và **tờ khai**, nên phải nói đúng số.
15. **Không** quay lại replace-set trong `setEmployeeAccess` (`company.service.ts`). `deleteMany` +
    `createMany` là cách ghi cũ, và từ khi có cột `xemLuong` thì mỗi lần sửa danh sách công ty nó
    **xóa sạch mọi quyền lương đã cấp**, âm thầm (BUG-HRM-28). Phải `upsert` theo cặp
    (`userId`, `donViId`), và `xemLuong === undefined` mang nghĩa **giữ nguyên**, khác hẳn `false`.
16. **Không** trả `null` cho ba trường ngân hàng khi người gọi không có quyền — **bỏ hẳn khóa**
    (`cheTruongLuong`). Trả `null` là nói dối: giao diện không phân biệt được "chưa khai" với
    "không được xem". Chiều ghi thì ngược lại: **bỏ qua** ba trường trong payload
    (`boTruongLuongKhiGhi`), tuyệt đối không nhận `null` rồi ghi đè — người không có quyền đọc thì
    màn hình của họ không có sẵn giá trị cũ để gửi lại.

### 1.5. Bẫy đã gặp — đừng "sửa cho gọn"

| Thứ trông thừa | Vì sao phải giữ |
|:---|:---|
| `sapXepHopDong` có 3 tiêu chí | `ngay_bat_dau` không duy nhất; MVCC đẩy dòng vừa sửa xuống cuối heap ⇒ sửa ô ghi chú của HĐ B cũng làm "hiện hành" nhảy từ A sang B |
| `homNayVN()` cộng 7 tiếng | Từ 00:00–06:59 giờ VN, lịch UTC còn ở hôm trước ⇒ máy chủ và trình duyệt nói khác nhau về ngày dùng để chốt kỳ lương |
| `assertNotExists` **không** lọc `da_xoa` khi tạo NV | Trùng với mã **đã xóa** vẫn là trùng; lọc thì guard cho qua rồi vỡ ở khóa chính, người dùng nhận câu chung "Dữ liệu bị trùng" thay vì biết đích xác mã nào |
| `ngayChot <= cu.ngay_bat_dau` vẫn dùng `<=` chứ không `<` | Lý do gốc (hợp đồng một ngày từng bị chặn) **không còn đúng** từ QĐ #6, nhưng đợt P0 **giữ nguyên hành vi cũ** vì đổi vế này nằm ngoài phạm vi đã chốt. Chốt lại ở OQ-hrm-15 — đừng tự sửa |
| `assertKhongChongLan` lọc ngày ở DB nhưng lọc **nhóm** trong bộ nhớ | Nhóm là kết quả của một HÀM trên `loai_hd`, Prisma không diễn tả được trong `where`. Số hợp đồng của một nhân viên luôn nhỏ nên đây không phải điểm nóng |
| `doiHopDong` kiểm chồng lấn **SAU** bước chốt hợp đồng cũ | Chạy trước thì chính hợp đồng sắp bị chốt tự báo chồng lấn với hợp đồng mới, và không đường nào đi qua được |
| `assertSoHdDuyNhat` **không** lọc `nhan_vien.da_xoa` | Unique index ở DB phủ mọi dòng; lọc ở tầng ứng dụng thì guard cho qua rồi vỡ ở tầng dưới với câu chung chung — hai tầng nói khác nhau |
| `assertKhongTrungMst` **có** lọc `nhan_vien.da_xoa` | Ngược lại với dòng trên, và đây là **chủ ý** (BR-hrm-030): một lần nhập nhầm không được khóa vĩnh viễn mã số thuế khỏi cả công ty. Hệ quả: ràng buộc DB chặt hơn luật nghiệp vụ một chút — nợ kỹ thuật đã chấp nhận (M-09) |
| `xemLuong` suy từ `role === 'OWNER' \|\| access[0]?.xemLuong` | `OWNER` **không có** dòng `DonViAccess` nào (họ thấy công ty của mình qua `ownerId`), nên mảng `access` rỗng. Bỏ vế `role` là chủ tài khoản mất luôn màn hợp đồng của chính công ty mình |
| `DriveApiError.status = 0` | Quy ước "chưa nhận được phản hồi nào"; chọn 0 để nằm ngoài mọi khoảng đang xét (`>=400 && <500`, `===404`) ⇒ sự cố mạng **không** bị hiểu thành "khách thu hồi quyền" rồi tự ngắt Drive của họ |
| Chỉ xóa token Drive khi mã **đúng** `invalid_grant` | Bắt theo dải 4xx thì một lần gõ nhầm `GOOGLE_CLIENT_SECRET` sẽ xóa refresh token của **toàn bộ** tenant, sửa env cũng không cứu được |
| `thoatHtml` + CSP nonce ở callback | Đây là chỗ **duy nhất** trong dự án trả HTML tự dựng bằng nối chuỗi, lại ở route miễn đăng nhập ⇒ mọi dữ liệu ngoài lọt vào là XSS phản chiếu ngay trên origin đang giữ cookie phiên |
| `hangDoiThuMuc` (hàng đợi tạo thư mục) | "Tìm trước rồi tạo" chỉ chặn được trùng khi các lượt đi tuần tự; hai người cùng đính file cho một NV thì cả hai cùng tìm hụt, cùng tạo ⇒ hai thư mục trùng tên, file rải hai nơi |
| Xóa file cũ **sau** khi upload file mới thành công | Hỏng giữa chừng thì thà thừa một file trên Drive còn hơn mất cả hai |
| Chặn 10MB **cả đường về** | File nằm trên Drive **của khách**; sau khi app tải lên 2MB họ thay bằng file 2GB lúc nào cũng được |

### 1.6. Việc đang chờ làm (theo ADR đã chốt)

**Đợt P0 đã xong phần mã** (chưa chạy migration, chưa chạy script lên bất kỳ DB nào):

| Việc | Trạng thái | Nơi ở |
|:---|:---|:---|
| `doiHopDong` dùng `homNayVN()` thay `setUTCHours` | ✅ xong | `hopDong.service.ts:409` |
| Hàm chống chồng lấn dùng chung ở 3 đường ghi, khóa theo NHÓM, khoảng đóng hai đầu | ✅ xong | `hopDong.service.ts:108, 253` |
| `loai_hd_can_chot` bắt buộc ở `POST /hop-dong/doi` | ✅ xong | `hopDong.validator.ts` |
| `ngay_ket_thuc >= ngay_bat_dau` + wording E-hrm-019 | ✅ xong | `hopDong.validator.ts` (`soatNgay`) |
| Ràng buộc lương ở mọi đường ghi | ✅ xong | `hopDong.validator.ts` (`soatLuong`) |
| `status` bắt buộc khi sửa nhân viên | ✅ xong | `nhanVien.validator.ts` |
| `so_hd` duy nhất toàn công ty (pre-check, có `boQuaId`) | ✅ xong | `hopDong.service.ts:308` |
| NPT duy nhất theo (mã số thuế, kỳ giảm trừ) | ✅ xong | `nguoiPhuThuoc.service.ts:122, 147` |
| Cột `xemLuong` + bước chuyển dữ liệu | ✅ xong | `prisma/sys/migrations/20260907090000_*` |
| `setEmployeeAccess` ghi theo cặp khóa | ✅ xong | `company.service.ts` |
| Đọc quyền trong `resolveTenantInfo`, không vào JWT | ✅ xong | `helpers/resolveTenantDb.ts:47` |
| `GET /hop-dong` bắt buộc `ma_nv` + guard 403 cả nhóm | ✅ xong | `hopDong.validator.ts`, `hopDong.controller.ts:34` |
| Che 3 trường ngân hàng khi đọc / bỏ qua khi ghi | ✅ xong | `nhanVien.service.ts:56, 75` |
| SQL ràng buộc tenant + 2 script vận hành | ✅ xong | `hrmTenantConstraints.ts`, `scripts/{ra-soat-hrm,apply-hrm-constraints}.ts` |
| Chèn áp ràng buộc vào luồng cấp DB mới | ✅ xong | `provisioning.service.ts` |

**Còn nợ (P1 / P2 / vận hành):**

| Ưu tiên | Việc | ADR | File phải sửa |
|:---:|:---|:---|:---|
| 🚨 A | **Chạy** `npm run hrm:ra-soat` → dọn dữ liệu → `npm run hrm:constraints`; và `npm run migrate:sys:deploy` cho cột `xemLuong`. **Chưa chạy lần nào** | `data-model.md` 8.0 | vận hành |
| 🚨 B | Đo thật: `prisma db push` có xóa index/ràng buộc tạo tay không | `data-model.md` 8.0 điểm 3 | DB tenant nháp |
| 🚨 C | Frontend theo 4 thay đổi phá vỡ (xem 1.8) | `ADR-007` §3 | `hdđt_maxv`, `maxv` |
| ⚠️ 4 | `DELETE /tai-lieu/:id` xóa file Drive best-effort | `ADR-004` §2 | `taiLieuDrive.service.ts` + `taiLieu.controller.ts` |
| ⚠️ 5 | Retry-on-P2002 khi tự sinh mã | `ADR-001` | `nhanVien.service.ts`, `phongBan.service.ts`, `helpers/crudGuards.ts` |
| ⚠️ 6 | Thêm `code` vào envelope lỗi | `ADR-005` §1 | `helpers/errors.ts`, `errorHandler.plugin.ts` |
| ⚠️ 7 | Cột audit `user_id0`/`user_id2` + `writeLog` 5 nhóm thao tác | `ADR-004` §4 | schema + 5 service |
| ⚠️ 8 | Ghi nhận nghỉ việc + `ngay_nghi_viec` (QĐ #3) | `data-model.md` M-10 | `nhanVien.*` |
| ⚠️ 9 | Guard + lọc ô chọn phòng ban ngừng hoạt động (QĐ #11) | — | `phongBan.*` |
| ⚠️ 10 | Siết 3 route Drive về OWNER (QĐ #10) | `ADR-003` | `taiLieu.controller.ts` |
| ⚠️ 11 | Pipe stream file thay vì buffer | `ADR-005` §3 | `driveClient.ts`, `taiLieu.controller.ts` |
| ℹ️ 12 | `?loai=` đổi sang `insensitive` | `ADR-005` §2 | `taiLieu.service.ts` |
| ℹ️ 13 | Sửa comment lỗi thời trong `tenant/schema.prisma` (`hrm_hop_dong`, `hrm_tai_lieu`) | `data-model.md` M-08 | schema |
| ℹ️ 14 | Test tích hợp có DB thật cho `assertKhongChongLan`, `EXCLUDE`, đua hai request | `ADR-002` | `__tests__/` |
| 🔴 15 | Đợt P2 (bộ giấy tờ bắt buộc, hạn giấy tờ) — **cổng còn đóng** | — | chờ OQ-hrm-13, OQ-hrm-14 |

### 1.7. Lệnh kiểm tra trước khi mở PR

```bash
cd be_maxv
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src  (0 error; warning no-console trong scripts là bình thường)
npm test              # tsx --test src/__tests__/*.test.ts
```

Hai file test HRM: `src/__tests__/hrmHopDong.test.ts` (28 ca — gom nhóm, khoảng ngày, mốc giờ VN,
validator) và `src/__tests__/hrmQuyenVaNpt.test.ts` (26 ca — kỳ giảm trừ, che trường lương, bắt lỗi
ràng buộc, thân yêu cầu phân quyền). Cả hai **chạy được không cần Postgres**; tên mỗi ca ghi kèm mã
`TC-hrm-*` để truy ngược `qa/test-cases.md` Mục 6B.

⚠️ `src/__tests__/adminOwner.test.ts` đang **fail 5 ca từ trước đợt P0** (đã đối chứng trên bản
chưa sửa). Không phải hồi quy của đợt này, nhưng cũng chưa được sửa.

### 1.8. Các thay đổi PHÁ VỠ giao diện — bàn giao cho đợt Frontend

Bốn nhóm việc (5 dòng dưới đây) **cố ý** làm hỏng giao diện hiện tại; đó là yêu cầu của QĐ #8 và
BR-hrm-053/067, không phải sơ suất. Frontend phải sửa trước khi bật lên môi trường thật.

| # | Endpoint | Trước | Sau | Hỏng gì nếu FE không sửa |
|:--:|:---|:---|:---|:---|
| 1 | `GET /hrm/hop-dong` | `ma_nv` tùy chọn | `ma_nv` **bắt buộc** | `listHopDong()` gọi trần → **400**; màn Lịch sử hợp đồng trắng |
| 2 | `GET /hrm/hop-dong` (cả nhóm) | ai vào công ty cũng gọi được | cần quyền xem lương → **403 E-hrm-058** | Người chưa được cấp quyền thấy lỗi; FE nên **ẩn hẳn tab** thay vì hiện rồi báo 403 |
| 3 | `GET /hrm/nhan-vien`, `GET /hrm/nhan-vien/:ma_nv` | luôn có `so_tai_khoan`/`ten_tai_khoan`/`ngan_hang` | **vắng hẳn ba khóa** khi không có quyền | Kiểu FE khai bắt buộc sẽ vỡ; phải khai `optional` |
| 4 | `PUT /hrm/nhan-vien/:ma_nv` | thiếu `status` → mặc định `'1'` | thiếu `status` → **400** | Form sửa nhân viên không gửi `status` sẽ lưu hỏng |
| 5 | `POST /hrm/hop-dong/doi` | không có `loai_hd_can_chot` | **bắt buộc** | Nút Đổi hợp đồng → 400 cho tới khi FE thêm ô chọn loại cần chốt |

**Không phá vỡ** (cố ý làm tương thích ngược): `PUT /companies/employees/:userId/access` vẫn nhận
thân cũ `{ donViIds }` bên cạnh thân mới `{ access: [{ donViId, xemLuong }] }`, và phản hồi giữ
nguyên `donViIds` đồng thời thêm `so_cong_ty`. `GET /companies/employees` thêm `xemLuong` vào từng
phần tử `donViAccess` — thêm trường, không đổi trường cũ.

---

## 2. Frontend (`hdđt_maxv`)

> ⚠️ HRM nằm ở **`hdđt_maxv`**, KHÔNG phải `fe_maxv`. Tài liệu trước ghi sai chỗ này.
> Code: `hdđt_maxv/src/features/hrm/`.
>
> Cập nhật 2026-09-07 — đợt đồng bộ giao diện với hợp đồng P0 (đóng **BUG-HRM-41** và **ĐS-04**).
> Phạm vi đợt này **không đụng** `features/hrm/mock/` (24 file): các màn Chấm công, Bảng lương,
> KPI, Tăng ca… vẫn chạy dữ liệu giả và nằm ngoài phạm vi.

### 2.1. Tầng gọi API và query key

| Việc | Nơi ở |
|:---|:---|
| Client HTTP (envelope `{success,data}`, tự làm mới token khi 401) | `src/lib/http.ts` → `apiFetch`, `apiFetchData`, `apiFetchBlob` |
| Shim kiểu axios cho code port từ `fe_maxv` | `src/lib/apiClient.ts` (`api.get/post/put/del`) |
| Query key tập trung | `src/features/hrm/api/hrmKeys.ts` |
| Lớp gọi API theo thực thể | `api/phongBanApi.ts`, `nhanVienApi.ts`, `hopDongApi.ts`, `nguoiPhuThuocApi.ts`, `taiLieuApi.ts` |
| Hook TanStack Query + quy đổi dữ liệu | `*Queries.ts` cùng thư mục |
| **Quyền xem dữ liệu lương** (mới) | `api/quyenLuongQueries.ts` → `useQuyenXemLuong()` |

**Query key thật trong mã** (bảng cũ ở mục này ghi sai — `hrmKeys.hopDong.byNv(...)` không tồn tại):

```
hrmPhongBanKeys.list(companyId)          ["hrm-phong-ban",       companyId, "list"]
hrmNhanVienKeys.list(companyId)          ["hrm-nhan-vien",       companyId, "list"]
hrmNptKeys.list(companyId)               ["hrm-nguoi-phu-thuoc", companyId, "list"]
hrmTaiLieuKeys.list(companyId)           ["hrm-tai-lieu",        companyId, "list"]
hrmHopDongKeys.list(companyId, maNv)     ["hrm-hop-dong",        companyId, "list", maNv]   <- ĐỔI
```

`companyId` nằm trong **mọi** key: đổi công ty là đổi key, không rò dữ liệu công ty cũ sang màn
hình công ty mới. Cũng vì lý do đó, nhóm HRM **không** dùng `placeholderData: (prev) => prev` —
nó giữ dữ liệu cũ xuyên qua việc đổi key mà `isLoading` lại là `false`, không có dấu hiệu nào.

Hợp đồng có thêm `maNv` trong key từ đợt này — xem 2.5.

### 2.2. Bốn chỗ dữ liệu BE ≠ kiểu FE — phải quy đổi, đừng dùng thẳng

| Trường | BE trả | FE cần | Quy đổi ở |
|:---|:---|:---|:---|
| Mọi cột ngày thật | ISO đầy đủ `"2026-01-01T00:00:00.000Z"` | `YYYY-MM-DD` cho `<input type="date">` | `*Queries.ts` |
| `luong_chinh`, `luong_bhxh` | **Chuỗi** (`"25000000"`) | `number` | **Bắt buộc `Number()`** — quên là mọi phép cộng lương thành nối chuỗi |
| `nguoi_phu_thuoc.ngay_sinh` | Chuỗi `dd/MM/yyyy` | `YYYY-MM-DD` | `nguoiPhuThuocQueries.ts` |
| Kỳ giảm trừ | 4 số nguyên `dk_tu_thang/nam`, `dk_den_thang/nam` | `YYYY-MM` cho `<input type="month">` | `nguoiPhuThuocQueries.ts` |

### 2.3. Quy tắc gọi API

- **PUT là thay TOÀN BỘ bản ghi, không phải PATCH.** Phải gửi đủ mọi trường bắt buộc. Riêng
  `PUT /nhan-vien/:ma_nv` bắt buộc gửi rõ `mien_cham_cong`, `cong_doan` **và `status`** — thiếu
  bất kỳ cái nào là **400**. `status` thành bắt buộc từ BR-hrm-067 (bịt BUG-HRM-26): trước đó nó
  kế thừa mặc định `"1"` nên **một lần sửa thiếu trường âm thầm đưa người đã nghỉ về "đang làm"**.
  Hai đường ghi của FE đều gửi đủ: `thongTinVeApi()` (form sửa) và `apiRowVeBody()` (gán nhanh
  phòng ban) trong `api/nhanVienQueries.ts`.
- **KHÔNG gửi 6 trường hợp đồng** (`so_hop_dong`, `loai_hop_dong`, `kieu_luong`,
  `ngay_hieu_luc_toi`, `bhxh`, `tncn`) trong body nhân viên — chúng **chỉ đọc**, BE tính lúc đọc.
- **Mọi POST trả 201**, không phải 200.
- **Lỗi 400 KHÔNG có `message`** — chỉ có `errors.fieldErrors`. `apiFetch` dựng `ApiError` từ
  `body.message` nên toast hiện `"Yêu cầu thất bại (400)"`. Hệ quả và cách xử lý tạm: xem 2.7.

### 2.4. Quyền xem dữ liệu lương (QĐ #8) — đọc trước khi đụng vào hợp đồng

Máy chủ áp hai lớp **khác nhau**, đừng gộp làm một:

| Nhóm | Cách chặn | Hệ quả cho FE |
|:---|:---|:---|
| `/hrm/hop-dong` (cả 5 đường) | **403 E-hrm-058**, chặn nguyên cụm | Phải **ẩn/khóa** tab và nút, không được hiện rồi mới báo lỗi |
| `/hrm/nhan-vien` | Không chặn — chỉ **xóa hẳn 3 khóa** `so_tai_khoan` / `ten_tai_khoan` / `ngan_hang` | Kiểu TS phải khai `?:`; UI phải nói lý do, không hiện `undefined` hay `—` |

**Ba khóa ngân hàng VẮNG HẲN, không phải `null`** (`cheTruongLuong` ở BE, contract 3.1c). Đọc thì
luôn `?? ""`; muốn biết có quyền hay không thì kiểm **sự có mặt của khóa**, đừng kiểm giá trị —
`coTruongNganHang(row)` trong `api/nhanVienApi.ts` làm đúng việc đó bằng `"so_tai_khoan" in row`.

Đường **ghi** cũng phải theo: người không có quyền thì `thongTinVeApi()` và `apiRowVeBody()`
**bỏ hẳn ba khóa** khỏi thân request. BE cũng tự loại (`boTruongLuongKhiGhi`), nhưng dựa vào guard
bên kia là dựa vào may mắn — màn hình của họ không có sẵn giá trị cũ để gửi lại, gửi `null` chính
là tự khai "xóa trắng số tài khoản".

#### Cách FE biết mình có quyền — và giới hạn của nó

> 🚨 **Hợp đồng API CHƯA có endpoint nào trả cờ quyền.** ADR-007 nêu nhu cầu, `api-contract.md`
> chưa đặc tả, `GET /auth/me` không trả gì. Đợt này **cố ý không thêm endpoint**;
> `useQuyenXemLuong` (`api/quyenLuongQueries.ts`) SUY RA từ hai nguồn đã có sẵn:
>
> 1. `user.role === "OWNER"` → luôn có quyền. Đây là luật của chính máy chủ
>    (`resolveTenantInfo`: `xemLuong = role === 'OWNER' || DonViAccess.xemLuong`), không phải đoán.
> 2. Ngược lại: xem `GET /hrm/nhan-vien` có trả ba khóa ngân hàng không.
>
> Hook trả ba trạng thái: `"co"` · `"khong"` · `"chua_ro"`. **Chỉ** `biTuChoi` (tức `"khong"`) mới
> được dùng để ẩn/khóa giao diện; `"chua_ro"` đi đường lạc quan và để máy chủ nói lời cuối.
>
> **Bốn hạn chế phải biết:**
> - Danh sách nhân viên **rỗng** thì ra `"chua_ro"`. Vô hại trên thực tế: không có nhân viên nào
>   thì cũng không mở được hồ sơ để vào tab hợp đồng.
> - Quyền bị **thu hồi giữa phiên** thì cờ còn cũ tới lúc `hrm-nhan-vien` được invalidate. Vì vậy
>   `HopDongTab` / `ThongTinTab` / `ThongTinNhanVienTab` vẫn phải hiện được câu 403 của máy chủ
>   (prop `loiHopDong`), tuyệt đối **không** rơi vào nhánh *"Chưa có hợp đồng nào"* — đó là nói
>   dối, và người dùng sẽ đi ký lại một hợp đồng đang tồn tại.
> - Suy luận gắn vào một chi tiết hiện thực của BE (che bằng cách **xóa khóa**). BE đổi sang trả
>   `null` là cờ sai ngay — đó là lý do contract 3.1c ghi rõ "bỏ hẳn trường, không trả null".
> - Cờ này **không phải hàng rào bảo mật**, chỉ là gợi ý hiển thị. Hàng rào là 403 của máy chủ.
>
> **Việc cần backend làm để bỏ hẳn suy luận:** trả `xemLuong` của công ty đang chọn trong
> `GET /auth/me` (hoặc một endpoint quyền riêng theo tenant). Khi có, chỉ sửa `useQuyenXemLuong`,
> mọi chỗ dùng giữ nguyên.

#### Nơi giao diện đã khóa theo quyền

| Màn | Hành vi khi `biTuChoi` |
|:---|:---|
| `NhanVienDialog` | Tab **Lịch sử hợp đồng** `disabled` + tooltip nêu lý do |
| `HopDongTab` | Không dựng bảng, chỉ một `Alert` nói lý do và ai cấp được quyền |
| `ThongTinTab` (form sửa) | Nhóm *Thông tin hợp đồng* và *Tài khoản ngân hàng* thay bằng `Alert` |
| `ThongTinNhanVienTab` (xem) | Như trên, và **ẩn nút "Thay đổi hợp đồng"** |
| `useHopDongList` | `queryFn = skipToken` nên **không bắn request chỉ để nhận 403** |

Câu giải thích dùng chung là hằng `LOI_KHONG_CO_QUYEN_LUONG` — chép **nguyên văn**
`MESSAGES.HRM.KHONG_CO_QUYEN_XEM_LUONG` của BE, để câu trên màn hình giống hệt câu 403 nếu người
dùng có gặp.

### 2.5. Lịch sử hợp đồng: truy vấn theo TỪNG nhân viên

`GET /hrm/hop-dong` nay **bắt buộc `ma_nv`** (thiếu là 400). Bản cũ gọi `listHopDong()` trần rồi
`filter` phía trình duyệt — lương của **toàn bộ** nhân viên nằm trong cache của bất kỳ ai mở màn
hồ sơ (BUG-HRM-25). Đó là rò rỉ qua thiết kế, không phải chuyện hiệu năng.

- `listHopDong(params: { ma_nv: string })` — tham số **bắt buộc ở cả kiểu TS**, không còn `?`.
- `useHopDongList(maNv)` mở một truy vấn riêng cho từng nhân viên, khóa
  `hrmHopDongKeys.list(companyId, maNv)`.
- `useLamMoi()` vẫn invalidate `hrmHopDongKeys.all` nên ghi một hợp đồng làm mới mọi nhân viên —
  đúng ý, vì `so_hd` duy nhất toàn công ty (QĐ #4) nên một lần ghi ảnh hưởng cả tập.
- Ghi hợp đồng xong **phải** invalidate cả `hrmNhanVienKeys.all`: 6 trường "hợp đồng hiện hành"
  trên hồ sơ nhân viên do BE **tính lúc đọc**, không nạp lại là bảng còn hiện hợp đồng cũ.
  (Chú thích cũ ở đây ghi *"BE tự đồng bộ bản sao xuống bảng nhân viên"* — sai, bản sao đã bỏ từ
  2026-09-05. Việc invalidate thì vẫn đúng và phải giữ.)

> ⚠️ `useMemo` quanh `items` trong `useHopDongList` là **bắt buộc, không phải tối ưu**.
> `hopDongHienHanh(items, …)` trả về một phần tử của mảng đó, và phần tử ấy nằm trong mảng phụ
> thuộc của `useEffect` nạp form ở `ThayDoiHopDongDialog`. Dựng mảng mới mỗi render thì effect
> chạy mỗi render, nó `setValues` một object mới nên React không bail-out được — **vòng lặp render
> vô tận**.

**`nguoi-phu-thuoc` và `tai-lieu` vẫn theo lối cũ** (tải hết rồi lọc client). Máy chủ chưa bắt
buộc `ma_nv` ở hai nhóm đó và chúng không mang dữ liệu lương, nên đợt này để nguyên — nhưng cùng
một loại nợ, xem 2.9.

### 2.6. Đổi hợp đồng: `loai_hd_can_chot` là trường bắt buộc

`POST /hop-dong/doi` nhận thêm `loai_hd_can_chot` (QĐ #1, BR-hrm-053) — thiếu là **400**, tức nút
Đổi hợp đồng chết hoàn toàn. Lý do: từ khi HĐLĐ chính và HĐ khoán được phép chạy song song, "hợp
đồng đang hiệu lực" là khái niệm mơ hồ; máy chủ gom nhãn về **nhóm nghiệp vụ** rồi chỉ tìm trong
đúng nhóm đó. Không có trường này thì đổi HĐLĐ lại vô tình chốt mất HĐ khoán, không gì báo.

Ở `ThayDoiHopDongDialog`:

- Dialog tự gọi `useHopDongList(nhanVien.ma_nv)` — **cùng khóa cache** với tab Lịch sử nên không
  tốn thêm lượt mạng — để dựng danh sách hợp đồng **đang hiệu lực**, mỗi nhóm một dòng đại diện.
- Có **hơn một** nhóm đang hiệu lực thì hiện ô chọn *"Hợp đồng cần chốt"*. Đúng một thì không hỏi.
- Không còn hợp đồng nào hiệu lực thì vẫn phải gửi một giá trị hợp lệ: gửi loại của **hợp đồng
  mới**. Máy chủ tìm trong nhóm đó, không thấy gì để chốt, trả `da_chot_hop_dong_cu = false`.
- Toast báo theo `da_chot_hop_dong_cu` **của máy chủ**, không theo thứ màn hình đoán — hợp đồng bị
  chốt có thể khác cái đang hiển thị là "hiện hành".
- `nhomHopDong()` trong file này là **bản sao đúng từng chữ** của `loaiHdVeNhanVien` ở BE
  (`hopDong.service.ts`). Nó **chỉ để khử trùng ô chọn**; giá trị gửi lên vẫn là nhãn gốc, việc
  gom nhóm thật là của máy chủ. BE đổi luật gom nhóm thì phải sửa cả hàm này.

### 2.7. Hai câu lỗi lương phải giữ bản sao ở FE — ngoại lệ có chủ ý

`E-hrm-056` (lương chính > 0) và `E-hrm-057` (bật trích BHXH thì lương BHXH > 0) do BE trả dạng
**400 Zod**, mà envelope 400 **không có `message`** — gửi lên chỉ nhận về `"Yêu cầu thất bại (400)"`
và không biết ô nào sai. Nên `api/hopDongQueries.ts` giữ hai hằng số chép **nguyên văn** từ
`be_maxv/src/validators/hrm/hopDong.validator.ts` (`soatLuong`) và chặn tại chỗ:

| Hằng số / hàm | Dùng ở |
|:---|:---|
| `LOI_LUONG_CHINH`, `LOI_LUONG_BHXH`, `soatLuongHopDong()` | `HopDongFormDialog`, `ThayDoiHopDongDialog` (lỗi gắn vào đúng ô nhập), `useLuuHopDong`, `useDoiHopDong`, `useThemNhanVien` (ném lỗi cho toast) |

`TienField` nhận thêm `error` / `required` để gắn được câu lỗi vào đúng ô tiền.

Đây là **ngoại lệ duy nhất** với nguyên tắc "không giữ hai bộ luật song song". Mọi luật khác
(chồng lấn khoảng ngày, trùng `so_hd` = `E-hrm-055`, các luật ngày) BE trả **409 kèm `message`
tiếng Việt** nên để BE nói, FE chỉ `toast.error(getErrorMessage(err, …))`.

`useThemNhanVien` soát lương **trước** khi tạo nhân viên: để BE bắt thì nhân viên đã nằm trong DB
rồi hợp đồng mới hỏng, người dùng nhận câu *"đã tạo nhân viên nhưng chưa ghi được hợp đồng"* cho
một lỗi mà form tự biết trước.

> **Việc cần backend làm để bỏ bản sao này:** đưa `message` (hoặc trường `code`) vào envelope 400,
> hoặc để `lib/http.ts` mang theo `errors.fieldErrors` trong `ApiError`. Chỗ thứ hai nằm **ngoài**
> `features/hrm/` nên đợt này không đụng.

### 2.8. Tab Hồ sơ & Tài liệu (`HoSoTab`)

- Hỏi trạng thái Drive trước. `da_ket_noi = false` thì hiện banner mời kết nối Drive.
  `may_chu_san_sang = false` là máy chủ chưa cấu hình, **không** phải lỗi người dùng.
- Kết nối Drive: gọi `GET /drive/lien-ket` lấy `url` rồi mở **popup**. **Không** redirect cả trang
  — trang unload là mất luôn `File` người dùng vừa chọn.
- Popup **không** gửi `postMessage` (khác origin, FE không nhận được). Cách đúng: đợi popup đóng
  rồi **hỏi lại** `GET /drive/trang-thai`.
- Xem file: dùng `taiFileVe(id)` sang Blob sang `URL.createObjectURL`. **Không** trỏ `<img src>`
  thẳng vào API — thẻ `<img>` đi ngoài lớp `apiFetch` nên gặp token hết hạn chỉ hiện hình vỡ,
  không kích hoạt được cơ chế tự làm mới token.
- Tải lên: `FormData` qua `apiFetch` thẳng, **không** qua `api.post` (shim đó `JSON.stringify` mọi
  body, làm hỏng multipart boundary).

### 2.9. Logic nghiệp vụ đang bị NHÂN ĐÔI ở FE — chưa dọn

Ba luật đã có nguồn sự thật ở backend nhưng FE vẫn giữ bản thứ hai trong `src/features/hrm/cay.ts`
và đang **dùng thật**:

| Luật | Bản FE | Đang dùng ở | Vì sao nguy hiểm |
|:---|:---|:---|:---|
| **Hợp đồng hiện hành** | `cay.ts` `hopDongHienHanh(danhSach, mocHomNay)` | `NhanVienChiTietDialog`, `NhanVienDialog` | BE **đã trả sẵn** 6 trường hợp đồng hiện hành trong `GET /nhan-vien(/:ma_nv)`. FE tính lại bằng "hôm nay theo máy người dùng" nên máy lệch ngày là **hai màn hình nói khác nhau**, mà đây là số dùng để chốt kỳ lương. Bản FE cũng thiếu tiêu chí sắp xếp phụ (`datetime0`, `id`) nên hai HĐ cùng `ngay_bat_dau` có thể chọn khác BE |
| **Trạng thái hợp đồng** | `cay.ts` `trangThaiHopDong` | `ThongTinNhanVienTab`, `HopDongTab`, `ThayDoiHopDongDialog` | Cùng gốc vấn đề: "hôm nay" phía client. Đây là **nhãn hiển thị** nên nhẹ hơn — nhưng phải dùng chung một mốc ngày với BE |
| **Sinh mã nhân viên** | `cay.ts` `sinhMaNhanVien` | `api/nhanVienQueries.ts` (`useMaNhanVienMoi`, gợi ý mã trên form) | 🚨 **Sinh lỗi thật**: FE chỉ thấy nhân viên **chưa xóa**, nên nếu `NV0001` đã bị xóa mềm thì FE vẫn gợi ý `NV0001`; bấm lưu là **409 `Mã nhân viên "NV0001" đã tồn tại`**, người dùng không hiểu vì sao mã hệ thống vừa gợi ý lại bị từ chối |

**Cách dọn (chưa làm ở đợt này):**

1. Bỏ `hopDongHienHanh` khỏi 2 dialog — dùng thẳng 6 trường BE trả. Cần thêm `luong_chinh` để
   hiển thị thì **đề nghị BE bổ sung vào response**, đừng tự tính lại từ lịch sử.
2. Bỏ `useMaNhanVienMoi` — để ô mã trống kèm placeholder *"Để trống, hệ thống tự cấp"*. Đó đúng là
   hợp đồng đã thỏa thuận với BE (`ma_nv` tùy chọn) và loại hẳn cả lớp lỗi trên.
3. `trangThaiHopDong` giữ được, nhưng mốc "hôm nay" phải lấy **cùng một nguồn** với BE.

### 2.10. Trạng thái đầu việc FE

**Đã làm (2026-09-07):**

| Việc | Nơi |
|:---|:---|
| `GET /hop-dong` gọi theo từng `ma_nv`, khóa cache thêm `maNv` (đóng vế FE của BUG-HRM-25) | `api/hopDongApi.ts`, `api/hopDongQueries.ts`, `api/hrmKeys.ts` |
| Ẩn/khóa toàn bộ lối vào hợp đồng và tài khoản ngân hàng khi không có quyền | `api/quyenLuongQueries.ts` + 5 component |
| Ba trường ngân hàng khai `optional`, đường ghi **không gửi** khi không có quyền | `api/nhanVienApi.ts`, `api/nhanVienQueries.ts` |
| `loai_hd_can_chot` bắt buộc + ô chọn hợp đồng cần chốt | `api/hopDongApi.ts`, `ThayDoiHopDongDialog.tsx` |
| Hai câu lỗi lương đúng nguyên văn, gắn vào đúng ô nhập | `api/hopDongQueries.ts`, 2 dialog, `components/TienField.tsx` |
| `so_npt_da_xoa` thành **`so_npt_an_theo`**, và nói con số đó ra trên toast (đóng **ĐS-04**) | `api/nhanVienApi.ts`, `api/nhanVienQueries.ts`, `NhanVienTable.tsx` |
| `status` bắt buộc ở `PUT /nhan-vien` — **đã đúng sẵn**, chỉ ghi chú lại lý do | `api/nhanVienApi.ts`, `api/nhanVienQueries.ts` |

**Còn nợ:**

| Ưu tiên | Việc | Nơi / cần ai |
|:---:|:---|:---|
| 🚨 | **Không có màn cấp quyền xem lương** (contract 7C.4, FR-hrm-044). Cột dữ liệu đã có, nhưng nhân viên được cấp quyền vào công ty **sau** ngày triển khai sẽ vĩnh viễn không xem được lương | Ứng dụng **`maxv/`** — ngoài phạm vi `hdđt_maxv` |
| 🚨 | Endpoint trả cờ `xemLuong` để bỏ hẳn suy luận ở 2.4 | **Backend** |
| ⚠️ | Envelope 400 mang `message`/`code`, hoặc `ApiError` giữ `errors.fieldErrors` | **Backend** + `src/lib/http.ts` |
| ⚠️ | Bỏ logic nhân đôi ở `cay.ts` (mục 2.9) | `cay.ts` + 5 component |
| ⚠️ | `hopDongTuApi` bịa `ngay_bat_dau = ngay_vao_lam` và `luong_chinh = 0` (BUG-HRM-20) — con số bịa không được đi vào màn hình lương | `api/nhanVienQueries.ts` |
| ⚠️ | `nguoi-phu-thuoc` / `tai-lieu` vẫn tải hết rồi lọc client | `api/nguoiPhuThuocQueries.ts`, `api/taiLieuQueries.ts` |
| ℹ️ | Badge "Chưa có HĐ" khi `so_hop_dong == null` (ISSUE-HRM-04) | Bảng danh sách nhân viên |
| ℹ️ | Nói rõ trên UI: xóa nhân viên **không** xóa file scan trên Drive | Hộp thoại xác nhận xóa |

### 2.11. Lệnh kiểm tra trước khi mở PR

```bash
cd hdđt_maxv
npm run lint     # kỳ vọng: 0 lỗi, 0 cảnh báo
npm run build    # tsc -b && vite build
```
