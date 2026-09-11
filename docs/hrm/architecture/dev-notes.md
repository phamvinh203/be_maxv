---
type: dev-notes
feature: hrm
status: in-review
updated: 2026-09-10
links:
  - docs/hrm/architecture/api-contract.md
  - docs/hrm/architecture/data-model.md
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/du_lieu_tinh_luong/data-model-du-lieu-tinh-luong.md
  - docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md
  - docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md
  - docs/hrm/du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md
  - docs/hrm/review-findings.md
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
   không khôi phục được. **Một dòng giấy tờ giữ NHIỀU file** (QĐ #21, BR-hrm-037): căn cước hai
   mặt, bằng cấp nhiều trang — con trỏ nằm ở bảng con `hrm_tai_lieu_file`, mỗi file một dòng.
   Đừng tách mỗi ảnh thành một dòng `hrm_tai_lieu`: đó là cách chữa tạm đã thử và sai bản chất
   (danh sách hiện ba dòng cùng tên "CCCD", không ai biết là một giấy tờ hay ba).
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
| Xem hồ sơ giấy tờ | `GET /tai-lieu` | `taiLieu.controller.ts:44` | `taiLieu.service.ts` → `listTaiLieu:68` | Trả mảng `files` (sắp `thu_tu`,`datetime0`), **không** trả `drive_file_id`; ⚠️ `?loai=` so khớp chính xác, phân biệt hoa thường |
| Thêm giấy tờ (chưa có file) | `POST /tai-lieu` | `:51` | `createTaiLieu:105` | `$transaction` |
| Sửa metadata giấy tờ | `PUT /tai-lieu/:id` | `:58` | `updateTaiLieu:115` | Không đụng file |
| Xóa giấy tờ | `DELETE /tai-lieu/:id` | `:72` | `deleteTaiLieu:151` → `xoaMoiFileTrenDrive:551` | Xóa **mọi** file Drive **trước** rồi xóa dòng; lỗi Drive chỉ vào log, trả `da_xoa_file_drive` |
| Kiểm tra kết nối Drive | `GET /tai-lieu/drive/trang-thai` | `:136` | `taiLieuDrive.service.ts` → `trangThaiDrive:79` | Không cần DB tenant |
| Lấy URL đăng nhập Google | `GET /tai-lieu/drive/lien-ket` | `:156` | `driveClient.ts` → `taoState:469`, `urlDangNhap:136` | Đặt cookie `driveOauthState`; đã nối rồi thì **chỉ OWNER** |
| Google gọi về | `GET /tai-lieu/drive/callback` | `:204` | `docState:475` → `luuKetNoiDrive:92` | **Miễn auth**; trả HTML + CSP nonce; xóa cookie trước mọi nhánh |
| Ngắt kết nối Drive | `DELETE /tai-lieu/drive/ket-noi` | `:291` | `ngatKetNoiDrive:172` | **Chỉ OWNER**; xóa 5 cột + mọi `drive_folder_id` |
| **THÊM** một file scan | `POST /tai-lieu/:id/file` | `:304` | `dinhKemFile:406` | THÊM VÀO chứ không thay thế; cỡ → MIME → trần 20 file, **cả ba trước khi gọi Google** |
| Xem/tải một file scan | `GET /tai-lieu/:id/file/:fileId` | `:353` | `taiFileVe:468` → `layNoiDungFile` | Kiểm file thuộc đúng giấy tờ; ⚠️ nạp trọn vào RAM, chưa phải stream (`ADR-005`) |
| Gỡ MỘT file scan | `DELETE /tai-lieu/:id/file/:fileId` | `:383` | `goFile:511` | Xóa Drive **rồi** xóa dòng con; dòng giấy tờ và file còn lại giữ nguyên |

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
| Cây thư mục Drive | `thuMucCongTy:256` / `thuMucNhanVien:277` — `taiLieuDrive.service.ts` |
| **`thu_tu` của file scan kế tiếp** | `thuTuKeTiep` — `taiLieuDrive.service.ts:324` |
| **Trần 20 file mỗi giấy tờ (E-hrm-065)** | `assertConChoChoFile` — `taiLieuDrive.service.ts:332` |
| **File phải thuộc đúng giấy tờ (E-hrm-066)** | `timFileCuaTaiLieu` — `taiLieuDrive.service.ts:349` |
| **Dọn mọi file Drive khi xóa dòng giấy tờ** | `xoaMoiFileTrenDrive` — `taiLieuDrive.service.ts:551` |

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

### 1.4. TUYỆT ĐỐI KHÔNG NHÂN ĐÔI — 19 điều

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

**Ba điều bổ sung từ đợt QĐ #21 (một giấy tờ giữ nhiều file):**

17. **KHÔNG đọc, KHÔNG ghi bốn cột `hrm_tai_lieu.drive_file_id` / `ten_file` / `mime_type` /
    `kich_thuoc` nữa.** Chúng vẫn còn trong `schema.prisma` **chỉ để chờ đối chiếu số liệu** rồi
    bỏ ở đợt riêng (xem 1.6 mục 🚨 D). Con trỏ thật sống ở `hrm_tai_lieu_file`. Viết code mới đụng
    vào bốn cột đó là dựng lại đúng mô hình một-file vừa bỏ.
18. **KHÔNG tra `hrm_tai_lieu_file` theo mỗi `id` đến từ client.** Luôn đi qua dòng giấy tờ cha đã
    kiểm quyền rồi chọn trong `files` bằng `timFileCuaTaiLieu`. Tra thẳng là người có quyền vào
    công ty xem và gỡ được file của giấy tờ **bất kỳ** chỉ bằng cách đoán id (E-hrm-066 sinh ra
    cho đúng chuyện này).
19. **KHÔNG để lỗi Drive chặn việc xóa dòng giấy tờ**, và đừng bọc lời gọi Drive vào
    `$transaction` rồi rollback. Xóa file là **cố hết sức**; sự thật được nói ra bằng cờ
    `da_xoa_file_drive` trong phản hồi, không bằng cách ném lỗi (BR-hrm-039). Ngược lại, gỡ **một**
    file (`goFile`) thì lỗi Drive **phải** ném ra — người dùng đang yêu cầu đúng việc đó.

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
| Chặn 10MB **cả đường về** | File nằm trên Drive **của khách**; sau khi app tải lên 2MB họ thay bằng file 2GB lúc nào cũng được |
| `thu_tu` riêng, KHÔNG sắp theo mỗi `datetime0` | Hai file lên trong cùng một mili-giây sẽ đảo chỗ giữa các lần đọc, "mặt trước / mặt sau" nhảy qua nhảy lại |
| `thuTuKeTiep` lấy **max + 1**, không lấy `files.length` | Gỡ file ở giữa rồi thêm file mới sẽ sinh `thu_tu` trùng với file còn lại — đúng thứ `thu_tu` sinh ra để tránh |
| Kiểm trần 20 file **trước** khi gọi Google | Từ chối sau khi đã upload là để lại file mồ côi trên Drive của khách mà mình không còn con trỏ |
| `xoaMoiFileTrenDrive` chạy **trước** `hrm_tai_lieu.delete` | `onDelete: Cascade` dọn bảng con ngay; xóa dòng trước là mất sạch con trỏ, file mồ côi vĩnh viễn |
| `timTaiLieuKemFile` lấy cả danh sách file trong MỘT lượt | Trần 20 dòng con nên không đáng kể, đổi lại mọi phép kiểm sau đó (đếm trần, tính `thu_tu`, kiểm file thuộc đúng giấy tờ) dùng chung một ảnh chụp — không có khe cho hai đường đọc lệch nhau |

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

**Đợt QĐ #21 — một giấy tờ giữ NHIỀU file scan (đã xong phần mã, CHƯA chạy gì lên DB):**

| Việc | Trạng thái | Nơi ở |
|:---|:---|:---|
| Model `hrm_tai_lieu_file` (thu_tu, FK cascade, index) | ✅ xong | `prisma/tenant/schema.prisma` (cuối file) |
| Giữ nguyên 4 cột con trỏ cũ trên `hrm_tai_lieu` | ✅ cố ý | cùng file — **chưa được bỏ**, xem 🚨 D dưới |
| Script chuyển dữ liệu một lần, idempotent, in số liệu đối chiếu | ✅ xong | `scripts/chuyen-file-tai-lieu.ts` · `npm run hrm:chuyen-file` |
| `listTaiLieu` trả mảng `files`, giấu `drive_file_id` | ✅ xong | `taiLieu.service.ts:22-45` |
| `dinhKemFile` THÊM file + trần 20 (E-hrm-065) | ✅ xong | `taiLieuDrive.service.ts:406` |
| `taiFileVe` / `goFile` nhận `fileId` + kiểm thuộc đúng giấy tờ (E-hrm-066) | ✅ xong | `taiLieuDrive.service.ts:468, 511` |
| `deleteTaiLieu` dọn mọi file Drive (cố hết sức) — trả hết nợ mục ⚠️ 4 cũ | ✅ xong | `taiLieu.service.ts:151` → `xoaMoiFileTrenDrive:551` |
| Route đổi sang `/:id/file/:fileId` (GET, DELETE) | ✅ xong | `routes/hrm/taiLieu.route.ts:39-41` |
| Wording E-hrm-037 / E-hrm-065 / E-hrm-066 | ✅ xong | `constants/messages.ts:122, 128, 130` |
| Param `:fileId` | ✅ xong | `validators/hrm/taiLieu.validator.ts:71` |
| Test thuần 16 ca | ✅ xong | `__tests__/hrmTaiLieuFile.test.ts` |

**Còn nợ (P1 / P2 / vận hành):**

| Ưu tiên | Việc | ADR | File phải sửa |
|:---:|:---|:---|:---|
| 🚨 A | **Chạy** `npm run hrm:ra-soat` → dọn dữ liệu → `npm run hrm:constraints`; và `npm run migrate:sys:deploy` cho cột `xemLuong`. **Chưa chạy lần nào** | `data-model.md` 8.0 | vận hành |
| 🚨 B | Đo thật: `prisma db push` có xóa index/ràng buộc tạo tay không | `data-model.md` 8.0 điểm 3 | DB tenant nháp |
| 🚨 C | Frontend theo các thay đổi phá vỡ (xem 1.8) | `ADR-007` §3 | `hdđt_maxv`, `maxv` |
| 🚨 D | **Bỏ bốn cột con trỏ cũ khỏi `hrm_tai_lieu`** — ĐỢT RIÊNG, chỉ chạy SAU khi đã `sync:tenants` → `hrm:chuyen-file` → **đối chiếu số liệu từng tenant**. Bỏ cột sớm là `db push --accept-data-loss` DROP COLUMN ngay, 6 con trỏ file biến mất không dựng lại được | `data-model.md` M-14 | `prisma/tenant/schema.prisma` |
| ⚠️ 16 | Trần 20 file là **pre-check**, không có ràng buộc DB — hai lượt tải lên đồng thời vẫn vượt được trần. Cùng lớp bài toán "đọc rồi ghi" với `so_hd`/chồng lấn (Mục 9 `data-model.md`) | — | `taiLieuDrive.service.ts` |
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

Ba file test HRM, tổng **70 ca**, **chạy được không cần Postgres**:

| File | Số ca | Nội dung |
|:---|:--:|:---|
| `src/__tests__/hrmHopDong.test.ts` | 28 | gom nhóm, khoảng ngày, mốc giờ VN, validator |
| `src/__tests__/hrmQuyenVaNpt.test.ts` | 26 | kỳ giảm trừ, che trường lương, bắt lỗi ràng buộc, thân yêu cầu phân quyền |
| `src/__tests__/hrmTaiLieuFile.test.ts` | 16 | `thu_tu` kế tiếp, trần 20 file (E-hrm-065), file thuộc đúng giấy tờ (E-hrm-066), param `:fileId` |

Phần cần DB thật (để Phase B): thứ tự đọc `orderBy [thu_tu, datetime0]`, cascade khi xóa dòng cha,
bước dọn Drive cố-hết-sức của `deleteTaiLieu`, và hai lượt tải lên đua nhau ở trần 20 file.

⚠️ `src/__tests__/adminOwner.test.ts` đang **fail 5 ca từ trước đợt P0** (đã đối chứng trên bản
chưa sửa). Không phải hồi quy của đợt này, nhưng cũng chưa được sửa. Số liệu `npm test` hiện tại:
**472 ca — 467 pass, 5 fail** (đúng 5 ca nói trên).

### 1.8. Các thay đổi PHÁ VỠ giao diện — bàn giao cho đợt Frontend

Chín dòng dưới đây **cố ý** làm hỏng giao diện hiện tại; đó là yêu cầu của QĐ #8, QĐ #12, QĐ #21
và BR-hrm-053/067, không phải sơ suất. Frontend phải sửa trước khi bật lên môi trường thật.

| # | Endpoint | Trước | Sau | Hỏng gì nếu FE không sửa |
|:--:|:---|:---|:---|:---|
| 1 | `GET /hrm/hop-dong` | `ma_nv` tùy chọn | `ma_nv` **bắt buộc** | `listHopDong()` gọi trần → **400**; màn Lịch sử hợp đồng trắng |
| 2 | `GET /hrm/hop-dong` (cả nhóm) | ai vào công ty cũng gọi được | cần quyền xem lương → **403 E-hrm-058** | Người chưa được cấp quyền thấy lỗi; FE nên **ẩn hẳn tab** thay vì hiện rồi báo 403 |
| 3 | `GET /hrm/nhan-vien`, `GET /hrm/nhan-vien/:ma_nv` | luôn có `so_tai_khoan`/`ten_tai_khoan`/`ngan_hang` | **vắng hẳn ba khóa** khi không có quyền | Kiểu FE khai bắt buộc sẽ vỡ; phải khai `optional` |
| 4 | `PUT /hrm/nhan-vien/:ma_nv` | thiếu `status` → mặc định `'1'` | thiếu `status` → **400** | Form sửa nhân viên không gửi `status` sẽ lưu hỏng |
| 5 | `POST /hrm/hop-dong/doi` | không có `loai_hd_can_chot` | **bắt buộc** | Nút Đổi hợp đồng → 400 cho tới khi FE thêm ô chọn loại cần chốt |
| 6 | `GET /hrm/tai-lieu` | mỗi dòng có `drive_file_id`/`ten_file`/`mime_type`/`kich_thuoc` | **vắng hẳn bốn khóa**, thay bằng mảng `files: [{ id, ten_file, mime_type, kich_thuoc }]` (rỗng = chưa đính file) | Cột "File scan" đọc `row.ten_file` sẽ ra `undefined`; điều kiện `row.drive_file_id ? ...` luôn sai ⇒ nút xem/gỡ biến mất |
| 7 | `GET /hrm/tai-lieu/:id/file` | không có `:fileId` | `GET /hrm/tai-lieu/:id/file/**:fileId**` | Đường cũ → **404 route**, ảnh không mở được. Lấy `fileId` từ phần tử trong `files` |
| 8 | `DELETE /hrm/tai-lieu/:id/file` | gỡ file duy nhất | `DELETE /hrm/tai-lieu/:id/file/**:fileId**`, trả `{ id, so_file_con_lai }` | Đường cũ → **404 route**. Nút gỡ phải nằm trên **từng file**, không phải trên dòng giấy tờ |
| 9 | `POST /hrm/tai-lieu/:id/file` | thay thế file cũ; trả `{ id: <id giấy tờ>, ten_file, ... }` | **THÊM VÀO**; trả `{ id: <id FILE vừa tạo>, tai_lieu_id, ten_file, mime_type, kich_thuoc, so_file }`; đủ 20 file → **409 E-hrm-065** | Đường dẫn không đổi nên không vỡ ngay, nhưng `data.id` **đổi nghĩa** — FE dùng nó như id giấy tờ sẽ sai. Chọn nhiều file thì gọi **tuần tự** nhiều lần |

**Kèm theo (không phá vỡ, nhưng phải dùng):** `DELETE /hrm/tai-lieu/:id` nay trả thêm
`da_xoa_file_drive` và **xóa luôn mọi file scan trên Drive** (BR-hrm-039). Hộp xác nhận phải nêu
**số file sắp mất** vì thao tác không hoàn tác được; `false` thì nói rõ "đã xóa bản ghi, nhưng chưa
dọn được file trên Drive" thay vì báo thành công trơn.

**Không phá vỡ** (cố ý làm tương thích ngược): `PUT /companies/employees/:userId/access` vẫn nhận
thân cũ `{ donViIds }` bên cạnh thân mới `{ access: [{ donViId, xemLuong }] }`, và phản hồi giữ
nguyên `donViIds` đồng thời thêm `so_cong_ty`. `GET /companies/employees` thêm `xemLuong` vào từng
phần tử `donViAccess` — thêm trường, không đổi trường cũ.

### 1.9. Dữ liệu tính lương (`du_lieu_tinh_luong`) — đợt sửa 8/9 lỗi 🔴 (2026-09-09)

> Nguồn thẩm quyền đầy đủ: `docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md` (BA) +
> `data-model-du-lieu-tinh-luong.md` (Architect, 5 ADR `dltl-01..05`) +
> `docs/hrm/review-findings.md` (Code Review, RVW-001/002 + bảng "Blocking kế thừa"). Mục này chỉ
> tóm tắt đủ để đọc code nhanh, KHÔNG lặp lại toàn bộ 3 tài liệu trên.

**Mô hình nghiệp vụ — 4 điều hiểu trước khi đọc code:**

1. **`AttendanceRecord` là DELTA, không phải lịch cả tháng.** Chỉ ghi qua `PUT
   /payroll-data/attendance/cell` khi CÓ NGOẠI LỆ khác chuẩn (ADR-dltl-02, giữ nguyên — không sinh
   sẵn 26×N dòng/kỳ). Công thức tổng hợp: `actualWorkDays = standardWorkDays + Σ(workDayValue - 1)`
   — mỗi bản ghi delta thay thế đúng 1 ngày công chuẩn của chính nó. Sửa lần trước (trước
   2026-09-09) coi tập bản ghi là lịch cả tháng — **đã sửa** (RVW-001), xem `payrollCalculation.service.ts:231-243`.
2. **`workDayValue` do `attendanceType` quyết định, không phải `actualHours` client gửi.** Chỉ
   `lam_viec`/`nua_ngay` cho client tự khai giờ; 6 loại còn lại (`cong_tac`/`nghi_phep`/`nghi_le`
   =1.0 công, `om`/`khong_luong`/`khac`=0 công) dùng hệ số CỐ ĐỊNH, bỏ qua `actualHours` gửi lên.
   Xem bảng `ATTENDANCE_FIXED_VALUE` — `payrollInputs.service.ts`.
3. **Hợp đồng tính lương phải LỌC THEO KỲ** — KHÔNG dùng "hợp đồng hiện hành" của module Hợp đồng
   (khái niệm đó nghĩa là "mới nhất theo `ngay_bat_dau`", không phải "đang hiệu lực trong kỳ đang
   tính"). `calculatePayrollPreview` tự lọc `hop_dong` bằng `where: { ngay_bat_dau: {lte:
   endDate}, OR: [...ngay_ket_thuc null/gte startDate] }` ngay trong `include`.
4. **Toàn bộ 4 controller (`payrollPeriods`/`catalogs`/`payrollInputs`/`payrollCalculation`) đi
   qua `dbCoQuyenLuongPayroll(req)`** (`helpers/payrollAccessGuard.ts`) — KHÔNG BAO GIỜ gọi
   `resolveTenantDb(req)` trơn trong nhóm này. Cùng khuôn `assertXemLuong` mà nhóm `/hop-dong` đã
   dùng (BR-hrm-059/ADR-007) — `OWNER_EMPLOYEE` không có cờ `xemLuong` bị chặn 403 trên MỌI
   endpoint payroll, kể cả danh mục.

**Luồng dữ liệu tính lương (rút gọn):**

```
GET /payroll/calculate?periodId=..
  -> payrollCalculation.controller.ts  ->  dbCoQuyenLuongPayroll(req)  --thieu xemLuong--> 403
  -> calculatePayrollPreview(db, periodId)
       |-- load: hrm_nhan_vien (+hop_dong LOC THEO KY, +nguoi_phu_thuoc), GeneralSetting,
       |         EmployeeSalary(APPROVED), hrm_phong_ban, Holiday        [1 Promise.all]
       |-- load: 8 khoi bien dong cua ky (attendance..adjustments)       [1 Promise.all]
       |-- standardWorkDays = resolveStandardWorkDays(period, setting, holidays)
       |         (FIXED_26 / FIXED_24 hang so theo cau hinh; ACTUAL_MONTH dem thang - T7/CN
       |          theo saturdayPolicy/sundayPolicy - ngay le isPaid)
       |-- per-nhan-vien: actualWorkDays = standardWorkDays + Sigma(workDayValue-1)  [DELTA]
       |                  hourlyRate = baseSalary / (standardWorkDays * standardHoursPerDay)
       |                  BHXH/BHYT/BHTN + doan phi doc tu GeneralSetting (khong hardcode)
       |                  thue TNCN: tinhThueLuyTien() GIU NGUYEN (bieu 7 bac hardcode dung luat,
       |                             CHUA noi voi GeneralSetting.taxBrackets - xem no ben duoi)
       '-> tra ve 29 truong/nhan-vien (number JS; Decimal serialize thanh chuoi o cac /payroll-data/*)
```

**Bảng thao tác → route/controller/service (chỉ phần đã sửa trong đợt 2026-09-09):**

| Thao tác | Route | Controller | Service | Sửa gì |
|:---|:---|:---|:---|:---|
| Xem bảng lương / snapshot | `GET /payroll/calculate`, `/payroll/sheet-lines` | `payrollCalculation.controller.ts` | `calculatePayrollPreview` — `payrollCalculation.service.ts:82` | A-01 guard xemLuong · RVW-001 công thức delta · A-02 lọc hợp đồng theo kỳ · A-03 (gián tiếp, `workDayValue` đã đúng từ tầng nhập liệu) · BUG-dltl-002 đọc `standardWorkDays`/`standardHoursPerDay`/BHXH/đoàn phí từ `GeneralSetting` |
| Ghi 1 ô chấm công | `PUT /payroll-data/attendance/cell` | `payrollInputs.controller.ts` | `overrideAttendanceCell` — `payrollInputs.service.ts:132` | A-03 `attendanceType` quyết định `workDayValue` qua `ATTENDANCE_FIXED_VALUE` · BUG-dltl-007 chặn `actualHours > standardHoursPerDay` (400 `E-dltl-005`) thay vì tràn |
| Xem tăng ca | `GET /payroll-data/overtime` | `payrollInputs.controller.ts` | `getOvertimeData` — `payrollInputs.service.ts:153` | BUG-dltl-002 `isWarningMonth` đọc `GeneralSetting.maxOtHoursPerMonth` thay vì hardcode 40 |
| Khóa sổ / Mở lại / Phê duyệt kỳ | `POST .../lock`, `.../reopen`, `.../approve` | `payrollPeriods.controller.ts` | `lockPayrollPeriod`/`reopenPayrollPeriod`/`approvePayrollPeriod` — `payrollPeriods.service.ts` | RVW-002 `currentUserId(req)` thay `(req.user as any)?.sub` · Bug#8: route gắn `assertAdminOrOwner` (`payrollPeriods.route.ts`, tái dùng từ `cau_hinh_mac_dinh/generalSettings.route.ts`) · Bug#8: audit log qua `writeLog` (control-plane `sys_log`) trong `ghiNhatKyLuong()` ở controller — KHÔNG tạo bảng audit tenant mới |
| Danh mục KPI/Sản phẩm/Chuyên cần/Bù trừ | `/payroll-catalogs/*` | `catalogs.controller.ts` | `catalogs.service.ts` | A-01 guard xemLuong (không đổi logic CRUD) |

**Nơi ở của công thức/luật (SINGLE SOURCE — đừng viết lại chỗ khác):**

| Luật | Hàm — nơi ở DUY NHẤT |
|:---|:---|
| Ngày công chuẩn của kỳ (thay hằng số 26) | `resolveStandardWorkDays` — `payrollCalculation.service.ts:41` |
| Quy đổi `attendanceType` → hệ số công | `ATTENDANCE_FIXED_VALUE` + `isHourBasedAttendanceType` — `payrollInputs.service.ts` |
| Guard quyền xem lương cho TOÀN nhóm payroll | `dbCoQuyenLuongPayroll` — `helpers/payrollAccessGuard.ts` (gọi lại `assertXemLuong`/`resolveTenantCtx` của `resolveTenantDb.ts`, KHÔNG viết logic quyền mới) |
| Guard role ADMIN/OWNER cho khóa sổ/mở lại/duyệt | tái dùng `assertAdminOrOwner` — `routes/hrm/cau_hinh_mac_dinh/generalSettings.route.ts:10` (import thẳng, KHÔNG copy) |
| Audit log reopen/lock/approve | `ghiNhatKyLuong` — `payrollPeriods.controller.ts` (gọi `writeLog` — `services/shared/syslog.service.ts`, bảng `sys_log` control plane, KHÔNG phải bảng tenant) |
| Biểu thuế TNCN 7 bậc | `tinhThueLuyTien` — `payrollCalculation.service.ts:7` — **GIỮ NGUYÊN hardcode, KHÔNG đụng trong đợt này** (đúng luật, nhưng chưa nối với `GeneralSetting.taxBrackets` — xem nợ dưới) |

**TUYỆT ĐỐI KHÔNG NHÂN ĐÔI (bổ sung riêng cho `du_lieu_tinh_luong`):**

1. **Không** gọi `resolveTenantDb(req)` trực tiếp trong 4 controller của `du_lieu_tinh_luong`.
   Luôn qua `dbCoQuyenLuongPayroll(req)` — thêm endpoint mới mà quên là hở lại đúng lỗ A-01.
2. **Không** viết lại công thức delta chấm công ở nơi khác. Nếu cần "ngày công thực tế" ở màn hình
   khác, gọi `resolveStandardWorkDays` + cùng công thức `Σ(workDayValue - 1)`, đừng suy diễn lại.
3. **Không** đọc `activeContract = emp.hop_dong[0]` mà bỏ qua `where` lọc theo kỳ trong `include`
   — đó chính là bug A-02 vừa sửa. Copy cả khối `include.hop_dong` khi cần logic tương tự.
4. **Không** thêm bảng audit tenant riêng cho `du_lieu_tinh_luong` mà không kiểm tra `writeLog`
   trước — `sys_log` (control plane) đã là nơi ghi âm thanh chuẩn cho toàn HRM (BR-hrm-066), dùng
   lại là bắt buộc, không phải tùy chọn.
5. **Không** tự thêm tỷ lệ BHXH/đoàn phí hardcode mới ở bất kỳ chỗ nào khác trong module payroll —
   đọc từ `GeneralSetting` theo đúng khối đã có ở đầu `calculatePayrollPreview`.

**Còn nợ (ngoài phạm vi đợt sửa 2026-09-09 — KHÔNG tự ý làm thêm khi đọc thấy):**

- **Biểu thuế TNCN chưa nối với `GeneralSetting.taxBrackets`** (OQ-dltl-002 chưa chốt đầy đủ) —
  `tinhThueLuyTien()` vẫn hardcode 7 bậc (đúng luật). ADR-dltl-04 đề xuất chốt hình dạng JSON rồi
  viết `loadPayrollConfig()`, nhưng đây là quyết định kiến trúc mới cần BA/Architect chốt riêng.
- **8/8 file `*Panel.tsx` ở `hdđt_maxv` vẫn dùng `mock/hooks/*`** — KHÔNG thuộc phạm vi backend,
  để dành `frontend-engineer` khi được kích hoạt lại.
- **RVW-003 → RVW-017 + A-04 → A-13** (non-blocking/suggestion trong `review-findings.md`) —
  N+1 trong transaction (A-05), TOCTOU chuyển trạng thái (A-04), thiếu `Math.round` 4 chỗ (A-07),
  trùng lặp mã diện rộng (RVW-007), chưa phân trang (RVW-011)… **cố ý chưa sửa** trong đợt này —
  chỉ đúng 8 lỗi 🔴 theo yêu cầu phiên 2026-09-09.
- **`RVW-005`/`RVW-004`** (7/8 endpoint đọc không kiểm kỳ tồn tại; ghi chấm công/chuyên cần không
  kiểm ngày thuộc kỳ) — chưa sửa, vẫn `OPEN`.

### 1.10. Bảng lương tổng hợp — pipeline 10 bước thuế/bảo hiểm (ADR-010, 2026-09-10)

> Nguồn thẩm quyền đầy đủ: `ADR-010-pipeline-thue-bao-hiem-bang-luong.md` (Architect, THỨ TỰ 10
> bước là quyết định kiến trúc, không phải sở thích viết mã) + `srs-du-lieu-tinh-luong.md` Mục 15
> (BA, công thức + `AC-dltl-12..28`) + `data-model-du-lieu-tinh-luong.md` Mục 11 (schema, 19 cột
> mới) + `api-contract-du-lieu-tinh-luong.md` Mục 8 (44 trường response). Mục này CHỈ tóm tắt đủ
> để đọc code nhanh — đọc `ADR-010` TRƯỚC khi sửa bất kỳ dòng nào trong pipeline.

**4 quy tắc pháp lý mới đợt này (`BR-dltl-024..027`) + 1 quyết định chủ dự án (`Q-1`/`Q-2`/`Q-9.3`, gọi tắt QĐ-9):**

1. **Hai trần bảo hiểm ĐỘC LẬP** — BHXH+BHYT trần `baseSalary×20` (46,8tr), BHTN trần
   `regionMinSalary×20` (99,2tr). Tính RIÊNG rồi cộng, KHÔNG kẹp 1 trần chung.
2. **Miễn thuế OT vượt chuẩn** — chỉ phần OT trả CAO HƠN đơn giá giờ thường mới miễn, tính TỪNG
   dòng `OvertimeRecord`, không cộng gộp rồi mới trừ.
3. **Khấu trừ 10% cho HĐ `thu_viec`/`thoi_vu`** khi thu nhập ≥ ngưỡng — KHÔNG giảm trừ gia cảnh.
4. **Trần miễn thuế ăn ca 730k/tháng** (quy đổi theo công) — nhận diện bằng cờ
   `SalaryItem.isMealAllowance`, KHÔNG dò tên khoản.
5. **QĐ-9 (chủ dự án chốt `Q-1` 2026-09-10):** ô tick "chịu thuế TNCN" (`SalaryItem.isTaxable`) và
   "Phân loại" (`SalaryStructureItem.taxTreatment`) ở màn Cấu trúc lương **có hiệu lực thật** —
   khoản phụ cấp cố định khai miễn thuế bị trừ khỏi thu nhập tính thuế. Phép hợp nhất là **OR**:
   `EXEMPT ∨ isTaxable=false` (KHÔNG phải "cấu trúc lương thắng" — xem lý do ở QĐ-9.2 trong ADR).
   Khoản ăn ca chỉ áp **1 lớp** (trần thắng ô tick) — TUYỆT ĐỐI không cộng dồn 2 lớp miễn.

**Mô hình nghiệp vụ — pipeline 10 bước (`payrollCalculation.service.ts:calculatePayrollPreview`), THỨ TỰ CỐ ĐỊNH:**

```
[1] contractBaseSalary = hop_dong.luong_chinh
    fixedAllowanceTotal = Σ mức THÁNG của EmployeeSalaryItem (FIXED_ALLOWANCE ∪ BENEFIT_ALLOWANCE)
    baseSalaryMonthly    = contractBaseSalary + fixedAllowanceTotal          -> cột UI "Lương"
[2] tyLeCong = min(actualWorkDays/standardWorkDays, 1)
    proratedWorkSalary     = round(contractBaseSalary × tyLeCong)            -- CHỈ hợp đồng
    allowanceInPeriodTotal = Σ từng khoản quy đổi RIÊNG theo calculationMethod (tinhKhoanPhuCapTheoKy)
[3] otBase = contractBaseSalary + Σ(khoản isOvertimeBase=true)               -- KHÔNG dùng baseSalaryMonthly
    otHourlyRate = otBase / (standardWorkDays × standardHoursPerDay)
    otAmount = Σ round(otHourlyRate × r.convertedHours)  (TỪNG dòng OT)
[4] grossIncome = proratedWorkSalary + allowanceInPeriodTotal + otAmount + 5 cấu phần còn lại
[5] mealAllowanceAmount / otherAllowanceTaxExemptAmount  <- phân giỏ CÙNG vòng lặp bước [2]
    otTaxExemptAmount  <- TỪNG dòng OT, phần vượt đơn giá chuẩn
    hanMucMienThue = round(730k × tyLeCong); lunchAllowanceExempt = min(meal, hanMuc); ..Taxable = phần dư
    thuNhapTruocGiamTru = grossIncome - (otTaxExempt + lunchExempt + otherAllowanceTaxExempt)
[6] capBhxhByt=min(insuranceSalaryBase,46.8tr); capBhtn=min(insuranceSalaryBase,99.2tr) -- ĐỘC LẬP
[7] công đoàn — giữ nguyên, KHÔNG phải khoản giảm trừ thuế
[8] loai_hd ∈ {thu_viec,thoi_vu} (laHopDongKhauTruTaiNguon) -> khấu trừ 10% trên thuNhapTruocGiamTru
    còn lại -> tinhThueLuyTien(thuNhapTruocGiamTru - giảm trừ gia cảnh - BH)
    tinh_tncn≠true ĐÈ LÊN CẢ 2 CƠ CHẾ, kiểm TRƯỚC MỌI rẽ nhánh
[9] netTakeHomeSalary = grossIncome - BH - đoàn phí - thuế - adjustmentNetAmount  (cho phép ÂM)
[10] totalCompanyCost = grossIncome + companyInsuranceExpense + companyUnionExpense
```

**Bảng thao tác → route/controller/service (phần MỚI đợt 2026-09-10):**

| Thao tác | Route | Controller | Service | Ghi chú |
|:---|:---|:---|:---|:---|
| Bảng lương tổng hợp (44 trường) | `GET /payroll/calculate` | `calculatePreview` — `payrollCalculation.controller.ts:15` | `calculatePayrollPreview` — `payrollCalculation.service.ts` | Nguyên object đưa thẳng vào `payrollSheetLine.createMany` khi khóa sổ — xem cảnh báo 🔴 dưới |
| Tab "Lương hỗ trợ" (**MỚI**) | `GET /payroll/support-allowances` | `getSupportAllowances` — `payrollCalculation.controller.ts` | `getSupportAllowanceBreakdown` — `payrollCalculation.service.ts` | Dùng CHUNG `tinhKhoanPhuCapTheoKy()` với `/payroll/calculate` — bất biến `total` == phần `BENEFIT_ALLOWANCE` của `allowanceInPeriodTotal` |
| Đặt 3 tham số thuế mới | `PUT /settings/general` | `updateGeneralSettings` (không đổi) | `updateSettings` (không đổi — chỉ thêm field vào `khoiTaoCauHinhMacDinh()` + validator) | `lunchAllowanceTaxFreeCap`/`withholdingTaxRate`/`withholdingTaxThreshold` |
| Đánh dấu khoản ăn ca | `POST`/`PATCH /salary-items` | `salaryItems.controller.ts` (RVW-018: nay ghi `writeLog`) | `createSalaryItem`/`updateSalaryItem` — `salaryItems.service.ts` (thêm field) | `isMealAllowance: boolean`, mặc định `false`. **Quyền ghi (RVW-018, 2026-09-10): CẢ 3 route ghi `/salary-items` (`POST`/`PATCH`/`DELETE`) nay yêu cầu `assertAdminOrOwner`** — vì 2 cờ `isTaxable`/`isMealAllowance` quyết định trực tiếp thuế TNCN của TOÀN CÔNG TY, không còn là nhãn hiển thị. Guard gắn ở TẦNG ROUTE (`salaryItems.route.ts`), giống `payrollPeriods.route.ts`. |

**Nơi ở của công thức/hàm (SINGLE SOURCE — đừng viết lại chỗ khác):**

| Luật | Hàm — nơi ở DUY NHẤT |
|:---|:---|
| Phân giỏ + quy đổi công phụ cấp cố định (dùng CHUNG 2 endpoint) | `tinhKhoanPhuCapTheoKy()` — `payrollCalculation.service.ts` |
| Hợp nhất 2 cột miễn thuế (`taxTreatment`/`isTaxable`, phép OR) | `laKhoanMienThue()` — `payrollCalculation.service.ts` |
| Nhận diện HĐ khấu trừ 10% (`{thu_viec, thoi_vu}`) | `laHopDongKhauTruTaiNguon()` — `payrollCalculation.service.ts` — **KHÁC** `loaiHdVeNhanVien()` (`hopDong.service.ts`), xem cảnh báo #2 dưới |
| Chọn cấu trúc lương hiệu lực trong kỳ | `getActiveStructureItemMap()` (nội bộ, không export) — `payrollCalculation.service.ts` |
| Hệ số trần bảo hiểm (`× 20`) | `constants/hrm/du_lieu_tinh_luong/insuranceCaps.ts` — HẰNG SỐ, KHÔNG phải cột cấu hình |
| 3 tham số tiền/thuế suất mới | Cột `GeneralSetting` — mặc định ở `khoiTaoCauHinhMacDinh()` (`generalSettings.service.ts`) |

**TUYỆT ĐỐI KHÔNG NHÂN ĐÔI (bổ sung riêng cho pipeline 10 bước):**

1. **KHÔNG viết lại vòng lặp quy đổi công/phân giỏ miễn thuế phụ cấp ở nơi thứ hai.** Mọi chỗ cần
   "phụ cấp cố định trong kỳ, đã quy đổi công, đã phân giỏ miễn thuế" PHẢI gọi
   `tinhKhoanPhuCapTheoKy()`. Đây là lý do duy nhất bảo đảm bất biến `/payroll/support-allowances`
   `total` khớp `/payroll/calculate` `allowanceInPeriodTotal` (phần BENEFIT_ALLOWANCE) — viết lại
   lần hai ở endpoint mới là con đường chắc chắn nhất để hai tab lệch số.
2. **KHÔNG gộp `laHopDongKhauTruTaiNguon()` với `loaiHdVeNhanVien()`** (`hopDong.service.ts:60`).
   Hai luật khác nhau: `loaiHdVeNhanVien` xếp `thoi_vu` vào nhóm `hdld`; luật thuế cần `thoi_vu`
   CÙNG NHÓM với `thu_viec`. Gộp chung là tái lập đúng `BUG-HRM-27` (gom ngầm hai luật vào một
   hàm). Nếu cần sửa phạm vi khấu trừ 10% (vd thêm `xac_dinh` ngắn hạn — `EC-dltl-06/07`, chưa
   chốt), sửa ĐÚNG hàm này, không đụng `loaiHdVeNhanVien`.
3. **KHÔNG dùng `baseSalaryMonthly` cho công thức tăng ca.** `otBase`/`otHourlyRate` PHẢI dùng
   `contractBaseSalary` (+ khoản `isOvertimeBase=true`) — dùng `baseSalaryMonthly` (đã gồm phụ
   cấp) sẽ làm tiền OT tự phồng theo phụ cấp mới cộng vào (B-5, quy hồi `TC-blth-024b`).
4. **KHÔNG cộng cả 2 giỏ miễn thuế cho khoản `isMealAllowance=true`.** Bucket trong
   `tinhKhoanPhuCapTheoKy()` là `if/else if` TRÊN CÙNG MỘT vòng lặp (`MEAL_ALLOWANCE` xét trước,
   dừng ngay nếu khớp) — cấm tách thành 2 vòng lặp độc lập cộng vào `mealAllowanceAmount` và
   `otherAllowanceTaxExemptAmount` riêng rẽ, đó chính là chỗ sinh lỗi miễn thuế 2 lần
   (`TC-blth-047`).
5. **KHÔNG thêm field vào object trả về của `calculatePayrollPreview()` mà quên thêm cột tương ứng
   ở model `PayrollSheetLine`** (`prisma/tenant/schema.prisma`). `snapshotPayrollSheet()` đẩy
   NGUYÊN object vào `payrollSheetLine.createMany` — thiếu 1 cột thì Prisma ném `Unknown argument`
   và **khóa sổ kỳ lương gãy hoàn toàn**, trong khi `GET /payroll/calculate` vẫn chạy bình thường
   (lỗi chỉ lộ ra lúc kế toán bấm "Khóa sổ"). Đếm lại: 29 cột cũ + 15 cột mới = 44 field.
6. **KHÔNG hardcode số tiền trần bảo hiểm tuyệt đối** (46.800.000/99.200.000) ở bất kỳ đâu — luôn
   tính từ `GeneralSetting.baseSalary`/`regionMinSalary` × hằng số ở `insuranceCaps.ts`. Sửa lương
   cơ sở mà quên sửa trần là tái lập đúng bệnh `unionFeeMaxAmount = 234.000` (số tuyệt đối phái
   sinh, đã ghi nợ ở Mục 1.9).
7. **`getSupportAllowanceBreakdown()` — `columns` và `total`/`monthlyTotal` PHẢI dùng cùng một
   `columnCodes.has(row.code)` để lọc `benefitRows`** (RVW-019, 2026-09-10). Sửa 1 trong 2 mà quên
   sửa cái kia là tái lập đúng bug cũ: bảng hiển thị cột nhưng `total` không khớp Σ cột (khoản
   `SalaryItem.status='INACTIVE'` vẫn bị cộng vào tổng dù không có cột nào hiện nó).
8. **`employeeSalary.findMany` (cả `calculatePayrollPreview` VÀ `getSupportAllowanceBreakdown`)
   PHẢI lọc theo `effectiveFrom`/`effectiveTo` phủ kỳ đang tính** (RVW-021, 2026-09-10) — CÙNG
   nguyên tắc lọc-theo-kỳ đã áp cho hợp đồng (`A-02`). Sửa 1 nơi mà quên nơi kia là để lọt set
   lương của tháng sau/đã hết hạn vào kỳ hiện tại ở đúng MỘT trong hai endpoint, hai tab lại lệch
   nhau. `EmployeeSalary.ma_nv` là `@unique` (không có khái niệm "chọn bản phủ kỳ" như hợp đồng —
   chỉ có "phủ kỳ" hoặc "không phủ kỳ").

**Còn nợ (ngoài phạm vi đợt 2026-09-10 — KHÔNG tự ý làm thêm khi đọc thấy):**

- **`GeneralSetting.taxBrackets` vẫn CHƯA nối vào `tinhThueLuyTien()`** (ADR-010 QĐ-6, hoãn có chủ
  đích — chủ dự án chốt giữ nguyên biểu 7 bậc hardcode). Sửa biểu thuế trong "Cấu hình mặc định"
  vẫn KHÔNG có tác dụng tới bảng lương.
- **`A-06`** (Decimal ra chuỗi ở nhánh snapshot `/payroll/sheet-lines`, nay ảnh hưởng thêm 15
  trường) — chưa đóng, việc TÁCH RIÊNG (serializer `Decimal → number` ở biên response).
- **`A-05`** (transaction `lockPayrollPeriod` chưa đặt `{ timeout }` cho công ty > 300 nhân viên,
  payload `createMany` nay nặng thêm ~25%) — chưa làm.
- **`OQ-dltl-005`** (cộng dồn trần OT theo năm) · **`OQ-dltl-010`** (thêm `PENDING_REVIEW` vào
  guard chỉ-đọc của 8 phân hệ nhập liệu) — việc nhỏ, độc lập, chưa làm trong đợt này.
- **Chờ BA chốt ngữ nghĩa `SalaryItem.status`** (RVW-019, 2026-09-10): khoản `BENEFIT_ALLOWANCE`
  bị chuyển `INACTIVE` ở danh mục nhưng nhân viên vẫn còn gán trong `EmployeeSalaryItem` — hiện
  `tinhKhoanPhuCapTheoKy()` (dùng chung với `/payroll/calculate`) **VẪN cộng tiền khoản đó** vào
  `allowanceInPeriodTotal`. Đã sửa để `/payroll/support-allowances` tự cộng khớp tổng NỘI BỘ
  (`total` == Σ `amounts` hiển thị), nhưng KHÔNG tự ý đổi công thức tiền thật của
  `/payroll/calculate` — cần BA xác nhận "ngừng khoản ở danh mục có ngừng trả không" trước khi sửa
  tiếp cả hai nơi.
- **Snapshot bóc tách phụ cấp cho kỳ đã khóa** (RVW-020, 2026-09-10): `/payroll/support-allowances`
  LUÔN tính live kể cả khi kỳ đã `LOCKED`+ (không giống `/payroll/sheet-lines` đọc snapshot đóng
  băng) vì `PayrollSheetLine` chỉ lưu TỔNG `allowanceInPeriodTotal`, không lưu bóc tách theo từng
  khoản. Đã trả kèm `periodStatus`/`isLiveRecalculated` để FE cảnh báo — giải pháp dài hạn (bảng
  snapshot bóc tách) cần Architect ra ADR trước khi code.
- **⚠️ Phát hiện trong lúc TDD, cần Tester-QA/Code-Reviewer đối chiếu lại:** hai ca `TC-blth-032`/
  `TC-blth-033` trong `test-matrix-bang-luong-tong-hop.md` Nhóm 6 tính `hanMucMienThue` KHÔNG quy
  đổi theo công (giữ nguyên 730.000 dù `actualWorkDays<standardWorkDays`) — mâu thuẫn trực tiếp
  với chính `AC-dltl-23` (SRS 15.3.1) và `ADR-010` bước [5c], cả hai đều nói trần PHẢI quy đổi
  theo `tyLeCong` giống mọi phần khác. Backend đã hiện thực theo SRS/ADR (trần CÓ quy đổi công) —
  xem `payrollCalculation.service.ts` bước [5c] và `hrmPayrollCalculation.test.ts` (2 test này có
  chú thích rõ số liệu đã sửa so với bảng test-matrix cũ). Cần BA/QA xác nhận lại bảng test-matrix
  Nhóm 6 là lỗi đánh máy của QA, không phải business rule đổi ý.

### 1.10. Seed dữ liệu mẫu (dev tooling, 2026-09-10) — `npm run hrm:seed`

> Dev tooling thuần túy (KHÔNG phải nghiệp vụ) — dựng cho ĐÚNG MỘT tenant test (`test1@gmail.com`
> / `12345abc`, MST `0111142786`) để QA/Frontend test tay qua trình duyệt. Không đụng 10 tenant
> thật khác trong `maxv2_sys`.

**Luồng dữ liệu ngắn gọn:**

```
npm run hrm:seed
  │
  ├─► seed-control-plane.ts (maxv2_sys, control plane)
  │     ensureControlPlaneTestTenant()
  │       upsert User(test1@gmail.com, role=OWNER, hash bcrypt qua utils/password.ts)
  │       upsert DonVi(MST 0111142786) — DỪNG LẠI nếu MST thuộc owner khác
  │       provisionTenant() nếu DB tenant/READY chưa có (services/shared/provisioning.service.ts)
  │       gia hạn Subscription nếu < 30 ngày còn lại, bảo đảm plan.features.hrm = true
  │     → trả { ownerId, donViId, mst, dbName }
  │
  └─► prisma/tenant/seed.ts (DB tenant maxv_0111142786_app)
        wipeHrmDomain(db)              — xóa sạch domain HRM/Payroll cũ (thứ tự an toàn FK)
        seedConfig(db)                 — restoreDefault() + 4 ca làm việc + quickGenerateHolidays()
        seedPhongBan/NhanVien/HopDong/NguoiPhuThuoc(db)  — gọi ĐÚNG service thật (create*)
        seedSalaryItems/Structure/EmployeeSalaries(db)   — 9 khoản × 7 category, setEmployeeSalary()+approveEmployeeSalaries()
        seedPayrollCatalogs(db)        — KPI/Sản phẩm/Chuyên cần/Ứng-bù trừ
        seedPayrollPeriodData() × 2    — kỳ tháng trước + tháng hiện tại, đủ 8 phân hệ nhập liệu
        lockPayrollPeriod(kỳ trước)    — khóa sổ THẬT qua snapshotPayrollSheet(), không chép tay dữ liệu
        sanityCheck()                  — in gross/net vài nhân viên mẫu qua getPayrollSheetLines()
```

**Bảng "thao tác → file":**

| Thao tác | File |
|---|---|
| Bootstrap control-plane (user/donVi/subscription) | `be_maxv/src/scripts/hrm/seed-control-plane.ts` |
| Seed toàn bộ domain HRM/Payroll của tenant | `be_maxv/prisma/tenant/seed.ts` |
| NPM script | `package.json` → `"hrm:seed": "tsx prisma/tenant/seed.ts"` |

**Quyết định thiết kế quan trọng nhất — "xóa sạch rồi dựng lại" (wipe-then-rebuild):**

Tenant MST `0111142786` khi khảo sát đã có sẵn một ít dữ liệu THỦ CÔNG của các phiên QA/dev
trước (4 phòng ban/4 nhân viên/2 kỳ lương, KHÔNG phải dữ liệu kinh doanh thật — 0 chứng từ kế
toán trong cùng tenant) và không đủ phủ hết nhánh nghiệp vụ yêu cầu. `prisma/tenant/seed.ts` xóa
sạch domain HRM/Payroll (`wipeHrmDomain()`, thứ tự theo đúng ràng buộc FK cascade/restrict của
`prisma/tenant/schema.prisma`) rồi dựng lại TOÀN BỘ bằng RNG có seed cố định (`mulberry32(20260910)`)
— chạy lại nhiều lần cho ra ĐÚNG một bộ dữ liệu giống hệt nhau. **KHÔNG dùng cách này cho migration
sản xuất** — chỉ hợp lý cho dev seed tooling trên tenant test đã xác nhận không có dữ liệu thật.

**TUYỆT ĐỐI KHÔNG NHÂN ĐÔI:** mọi bước ghi dữ liệu nghiệp vụ (sinh mã tự động, tính giờ công/OT,
kiểm chồng lấn hợp đồng, tính thuế/bảo hiểm, khóa sổ...) đều gọi THẲNG service thật đã liệt kê ở
Mục 1.2-1.9 — seed script không tự chép lại một công thức nào. Nếu cần thêm dữ liệu mẫu, ưu tiên
gọi thêm service có sẵn thay vì `db.<model>.create()` trực tiếp cho các bảng có business rule.

**Không cần chạy lại `sync:tenants`/`hrm:constraints` sau seed** — script chỉ ghi dữ liệu, không
đụng schema/constraint của tenant (đã áp sẵn lúc `provisionTenant()`).

### 1.11. Màn "Chốt kỳ lương" — chốt số từng bảng kê (2026-09-11, backend-engineer)

**Mô hình trước khi đọc code:** kỳ lương có 12 "bảng kê". Chốt số một bảng kê = thêm 1 dòng
`hrm_payroll_module_locks` (kỳ, mã bảng kê); mở chốt = xóa dòng đó. Đây KHÁC khóa sổ kỳ: khóa sổ
đổi trạng thái kỳ + chụp bảng lương; chốt số chỉ đóng băng một bảng kê trong lúc kỳ còn mở.

| Thao tác | Route → hàm | Ghi chú |
|---|---|---|
| Tổng quan 12 thẻ + "Bảng lương a/b NV" | `GET /payroll-periods/:id/closing` → `payrollClosing.service.ts::getPayrollClosingOverview` | Kỳ đã khóa sổ ⇒ mọi bảng kê `locked`, `lockSource='PERIOD'` |
| Chốt / mở chốt 1 bảng kê | `POST .../modules/:module/lock` · `.../unlock` → `lockPayrollModule` / `unlockPayrollModule` | Mở chốt gắn `assertAdminOrOwner` ở route |
| Chốt toàn kỳ | `POST .../modules/lock-all` → `lockAllPayrollModules` | Một `createManyAndReturn({ skipDuplicates })` cho cả 12 — trả + ghi nhật ký đúng các dòng THỰC chèn |
| Tính lương tạm | `POST .../calculate` → `calculatePayrollForPeriod` | Tính `calculatePayrollPreview` NGOÀI transaction; trong transaction chỉ `chuyenTrangThai` (khóa dòng kỳ) + `ghiDeBangLuong`. Giới hạn 30 lượt/phút/người |
| Lịch sử hoạt động | `GET .../activities` → `payrollActivity.service.ts::listPayrollPeriodActivities` | Đọc `syslog` (control plane) — file DUY NHẤT của nhóm payroll đụng `sysPrisma` |
| Ghi nhật ký kỳ lương | `helpers/hrm/nhatKyKyLuong.ts::ghiNhatKyKyLuong` | Dùng chung cho `payrollPeriods.controller` + `payrollClosing.controller`; kiểu `ChiTietNhatKyKyLuong` dùng chung với bên đọc |
| Chặn ghi 8 bảng kê | `helpers/hrm/payrollPeriodLockGuard.ts::assertPayrollModuleWritable` | Gọi ở đầu 10 đường ghi `payrollInputs.service.ts`; 2 lượt đọc chạy song song |
| "Kỳ còn mở" | `payrollPeriodLockGuard.ts::KY_LUONG_CON_MO` / `kyLuongConMo()` | MỘT nguồn cho guard ghi, màn Chốt kỳ lương, `getPayrollSheetLines` |

**TUYỆT ĐỐI:**
- Đường ghi MỚI của `/payroll-data/*` phải gọi `assertPayrollModuleWritable(db, periodId, '<MÃ>')`,
  KHÔNG gọi `assertPayrollPeriodWritable` trơn — gọi trơn là chốt số bảng kê mất tác dụng với
  đường đó. Test tham số hóa 10 đường ghi ở `hrmPayrollClosing.test.ts` phải thêm dòng cho đường mới.
- Ghi nhật ký kỳ lương CHỈ qua `ghiNhatKyKyLuong` với mã từ `constants/hrm/payrollActivities.ts`
  — bên đọc lọc theo `chiTiet.periodId`; ghi tay `writeLog` là dòng lịch sử lặng lẽ biến khỏi màn.
- `hrm_payroll_sheet_lines`: chỉ dòng của kỳ đã khóa sổ (`LOCKED/APPROVED/PAID/ARCHIVED`) là chứng
  từ. Dòng của kỳ còn mở là kết quả TẠM của nút "Tính lương" — module thuế / báo cáo sau này đọc bảng
  này phải kiểm trạng thái kỳ, KHÔNG `findMany` trơn. Ghi vào bảng chỉ qua `ghiDeBangLuong`.
- Thêm bảng kê mới: thêm giá trị enum `PayrollModuleCode` + dòng `PAYROLL_MODULES`
  (`constants/hrm/payrollModules.ts`) + `HIEN_THI_BANG_KE` phía FE, rồi `generate` + `sync:tenants`.
- Test: `__tests__/hrm/hrmPayrollClosing.test.ts` mock `config/db.sys` (không chạm control plane
  thật) và mock `calculatePayrollPreview`/`ghiDeBangLuong`; mock DB của `hrmPayrollInputData.test.ts`
  phải có `payrollModuleLock.findUnique` (guard tra ở mọi đường ghi).

---

## 2. Frontend (`hdđt_maxv`)

> ⚠️ HRM nằm ở **`hdđt_maxv`**, KHÔNG phải `fe_maxv`. Tài liệu trước ghi sai chỗ này.
> Code: `hdđt_maxv/src/features/hrm/`.
>
> Cập nhật 2026-09-07 — đợt đồng bộ giao diện với hợp đồng P0 (đóng **BUG-HRM-41** và **ĐS-04**).
> Phạm vi đợt này **không đụng** `features/hrm/mock/` (24 file): các màn Chấm công, Bảng lương,
> KPI, Tăng ca… vẫn chạy dữ liệu giả và nằm ngoài phạm vi.
>
> Cập nhật 2026-09-08 — đợt **QĐ #21: một giấy tờ giữ NHIỀU file scan** (mục 1.8 dòng 6–9).
> Chạm 4 file trong `features/hrm/`, vẫn **không đụng** `mock/`. Chi tiết ở 2.8.

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

### 2.8. Tab Hồ sơ & Tài liệu — MỘT giấy tờ, NHIỀU file `[QĐ #21]`

**Mô hình phải hiểu trước khi đọc code:** căn cước là **MỘT** giấy tờ có **HAI** mặt, không phải
hai giấy tờ. Một dòng `hrm_tai_lieu` giữ nhiều file scan (BR-hrm-037); danh sách file đi kèm ngay
trong `GET /tai-lieu` dưới khóa `files`.

> 🚫 **Hướng đi đã bị bác bỏ, đừng khôi phục:** bản trước cho chọn nhiều file rồi tạo **mỗi file
> một dòng tài liệu riêng**. Kết quả là hồ sơ hiện ra hai dòng cùng tên "CCCD" và người đọc không
> biết đó là một giấy tờ hay hai. Toàn bộ vòng lặp tạo N dòng, state `filesChon` + `tienTrinh` kiểu
> cũ và dòng chữ *"Mỗi file thành một dòng tài liệu riêng…"* **đã gỡ**.

**Bản đồ file:**

| Việc | Nơi ở |
|:---|:---|
| Kiểu + đường dẫn + hằng chép từ BE | `api/taiLieuApi.ts` |
| Hook TanStack Query + luồng tải nhiều file | `api/taiLieuQueries.ts` |
| Form thêm/sửa giấy tờ + đính file | `components/nhan_vien/TaiLieuFormDialog.tsx` |
| Danh sách file **lồng trong một dòng giấy tờ** | `components/nhan_vien/DanhSachFileScan.tsx` (mới) |
| Bảng hồ sơ, hộp xác nhận xóa/gỡ | `components/nhan_vien/tabs/HoSoTab.tsx` |

**Ba đường API cần cặp id, không phải một:**

```
GET    /hrm/tai-lieu                      -> mỗi dòng có files: [{ id, ten_file, mime_type, kich_thuoc }]
POST   /hrm/tai-lieu/:id/file             -> THÊM VÀO; data.id là id FILE vừa tạo, KHÔNG phải id giấy tờ
GET    /hrm/tai-lieu/:id/file/:fileId     -> xem đúng một file
DELETE /hrm/tai-lieu/:id/file/:fileId     -> gỡ đúng một file, trả { id, so_file_con_lai }
DELETE /hrm/tai-lieu/:id                  -> xóa dòng + MỌI file Drive, trả { id, da_xoa_file_drive }
```

`drive_file_id` **không** có trong `files` — BE cố ý không trả con trỏ Drive ra ngoài. FE chỉ cần
`files[].id`. Bốn khóa cũ ở cấp dòng (`drive_file_id`/`ten_file`/`mime_type`/`kich_thuoc`) đã **bỏ
hẳn**; `veKieuFe()` vẫn có `r.files ?? []` để dòng cũ còn kẹt trong cache không làm vỡ lúc render.

**Luồng "thêm giấy tờ kèm nhiều file" (`TaiLieuFormDialog.handleSubmit`) — 5 bước, đúng thứ tự:**

1. Soát dung lượng **MỌI** file chưa tải, **trước khi ghi gì**. Soát dần thì file thứ ba quá cỡ để
   lại một dòng đã tạo dở và hai file đã lên Drive của khách.
2. Chặn trần **20 file** tại chỗ (E-hrm-065). Số file hiện có = `taiLieu.files.length` (ảnh chụp
   lúc mở form, KHÔNG tự tăng) **cộng** số file lượt bấm trước đã lên.
3. Ghi dòng giấy tờ **ĐÚNG MỘT LẦN** → nhớ vào `idDaTao`.
4. Không có file mới thì dừng ở đây (giấy tờ khai trước, scan sau là hợp lệ).
5. `useTaiNhieuFileLen(idDong, filesChon, daXong, setDaXong)` — tải **tuần tự** vào **chính dòng đó**.

**Làm tiếp từ chỗ hỏng — đây là phần dễ làm sai nhất.** Lần đầu đính file của một công ty sẽ mở
cửa sổ đăng nhập Google; người dùng đóng nó đi là hỏng ngay, nên đây KHÔNG phải ca hiếm.

- `idDaTao` giữ id dòng đã tạo → lần bấm lại truyền vào `luuTaiLieu` như id cần **sửa**. Đây là
  chỗ duy nhất chặn "tạo dòng giấy tờ thứ hai". Bỏ nó là mỗi lần bấm lại đẻ thêm một dòng.
- `daXong: boolean[]` cùng chỉ số với `filesChon` → file đã lên **không tải lại**.
- Chọn file lần nữa khi đã có file lên thật thì **THÊM VÀO cuối danh sách**, không thay cả danh
  sách: xóa chúng đi là mất dấu, bấm lại sẽ tải bản thứ hai của cùng file lên Drive.
- Toast lỗi phải nêu **tên file hỏng** và **`soXong`/tổng**. `loi.file` vắng nghĩa là hỏng ở bước
  kết nối Drive (chưa file nào gửi đi) — lúc đó **đừng** ghép tên file vào câu.
- `useTaiNhieuFileLen` gọi `damBaoDrive()` **một lần cho cả lượt**, không phải mỗi file một lần:
  hỏi lại trước từng file vừa tốn một lượt API vừa có nguy cơ mở lại popup ở giữa dãy.
- `lamMoi()` nằm trong `finally` — hỏng giữa chừng thì các file trước **đã lên thật**, không làm
  mới là bảng hồ sơ nói dối.

**Hiển thị "một giấy tờ, mấy file" (`DanhSachFileScan`):** danh sách file nằm **trong ô "File scan"
của chính hàng giấy tờ đó** — khung của hàng bảng chính là dấu hiệu gộp nhóm. Mỗi file có vạch dọc
thụt vào, nút xem và nút gỡ **riêng**. Vì hàng cao lên theo số file, mọi ô của hàng phải
`verticalAlign: "top"`, không thì loại giấy tờ trôi xuống giữa dãy file và mất liên hệ thị giác.
Dòng chưa có file hiện chữ *"Chưa đính file scan"* + nút *Đính file*, **không** để danh sách rỗng trơ.

**Hai hộp xác nhận phải nói số liệu thật, không nói chung chung:**

- Xóa cả dòng: nêu **số file sắp mất** (BR-hrm-039). Sau khi xóa, `da_xoa_file_drive = false` thì
  báo `toast.warning` *"đã xóa tài liệu nhưng chưa dọn được N file trên Drive"* — BE xóa Drive theo
  kiểu **cố hết sức**, báo thành công trơn là nói sai.
- Gỡ một file: nêu **tên file đó** + số file còn lại. Gỡ file cuối cùng **không** xóa dòng theo
  (BR-hrm-038) — câu xác nhận nói rõ để người dùng khỏi đi tìm xem dòng có biến mất không.

**Bản sao wording E-hrm-065 ở FE là ngoại lệ có chủ ý** (cùng loại với 2.7): `LOI_QUA_NHIEU_FILE`
trong `taiLieuApi.ts` chép **nguyên văn** từ `be_maxv/src/constants/messages.ts`
(`MESSAGES.HRM.TAI_LIEU_QUA_NHIEU_FILE`). BE vẫn là nơi quyết định thật — bản FE chỉ để **chặn
sớm**, vì để BE bắt thì người dùng đã ngồi đợi hết các file đầu và chúng đã nằm trên Drive rồi.
Cùng lý do với `GIOI_HAN_FILE_BYTE`, `MIME_CHO_PHEP`, `SO_FILE_TOI_DA`. Sửa bên BE thì sửa cả ở đây.

**Bốn điều giữ nguyên từ trước (đừng "sửa cho gọn"):**

- Hỏi trạng thái Drive trước. `da_ket_noi = false` thì hiện banner mời kết nối Drive.
  `may_chu_san_sang = false` là máy chủ chưa cấu hình, **không** phải lỗi người dùng.
- Kết nối Drive: gọi `GET /drive/lien-ket` lấy `url` rồi mở **popup**. **Không** redirect cả trang
  — trang unload là mất luôn `File` người dùng vừa chọn. Popup **không** gửi `postMessage` (khác
  origin, FE không nhận được); cách đúng là đợi popup đóng rồi **hỏi lại** `GET /drive/trang-thai`.
- Xem file: `taiFileVe(id, fileId)` sang Blob sang `URL.createObjectURL`, và **thu hồi** URL đó
  (`urlRef` + cleanup lúc unmount, không chỉ ở nút Đóng). **Không** trỏ `<img src>` thẳng vào API —
  thẻ `<img>` đi ngoài lớp `apiFetch` nên gặp token hết hạn chỉ hiện hình vỡ, không kích hoạt được
  cơ chế tự làm mới token.
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

**Đã làm (2026-09-08 — QĐ #21, đóng 4 dòng phá vỡ số 6–9 ở mục 1.8):**

| Việc | Nơi |
|:---|:---|
| Kiểu dòng tài liệu đổi sang `files: FileScanApi[]`; bỏ 4 khóa cũ ở cấp dòng | `api/taiLieuApi.ts`, `api/taiLieuQueries.ts` |
| Xem / gỡ file đi theo cặp `(idTaiLieu, fileId)`; `deleteTaiLieu` trả `da_xoa_file_drive` | `api/taiLieuApi.ts`, `api/taiLieuQueries.ts` |
| Gỡ **hướng đi sai** "mỗi file một dòng tài liệu"; mọi file vào **cùng một** dòng, tải tuần tự, làm tiếp từ chỗ hỏng | `TaiLieuFormDialog.tsx` |
| Chặn trước trần 20 file, wording E-hrm-065 nguyên văn từ BE | `api/taiLieuApi.ts` (`LOI_QUA_NHIEU_FILE`), `TaiLieuFormDialog.tsx` |
| Danh sách file lồng trong hàng giấy tờ, mỗi file một nút xem + một nút gỡ | `DanhSachFileScan.tsx` (mới), `tabs/HoSoTab.tsx` |
| Hộp xác nhận nêu **số file** (xóa dòng) và **tên file** (gỡ file); cảnh báo khi `da_xoa_file_drive = false` | `tabs/HoSoTab.tsx` |

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
| ℹ️ | Chưa có ô **ngày hết hạn** giấy tờ + cảnh báo hạn (QĐ #14, contract 6.2 / 7B). Cố ý chưa làm: `taiLieuBodySchema` bên BE **không có** `ngay_het_han`, gửi lên sẽ bị Zod loại — đây là đợt P2 | **Backend** trước, rồi `TaiLieuFormDialog` + `HoSoTab` |
| ℹ️ | Đổi thứ tự file trong một giấy tờ (cột `thu_tu`) — BE chưa có endpoint, hiện chỉ sắp theo lúc tải lên | **Backend** + `DanhSachFileScan` |

### 2.11. Lệnh kiểm tra trước khi mở PR

```bash
cd hdđt_maxv
npm run lint     # kỳ vọng: 0 lỗi, 0 cảnh báo
npm run build    # tsc -b && vite build
```

### 2.12. Bảng lương tổng hợp — nối API thật (2026-09-10, frontend-engineer)

Thay TOÀN BỘ mock của khu "Bảng lương" (`components/bang_luong/*`, `pages/hrm/bang_luong/*`)
bằng `GET /payroll/calculate` + `GET /payroll/support-allowances` (api-contract Mục 8). Trước đó
màn này tính lương/thuế NGAY TRÊN TRÌNH DUYỆT (`calculations/bang_luong/bangLuong.ts`) từ kho
`useHrmStore()` giả — giờ mọi con số tính sẵn ở `be_maxv` (ADR-010), FE chỉ đổi tên trường.

**Luồng dữ liệu (đọc theo thứ tự để hiểu 1 request):**

```
BangLuongPanel/LuongHoTroPanel
  -> api/bang_luong/bangLuongQueries.ts   (useBangLuongRows / useLuongHoTroRows / useKyBangLuong / useSoNhanVienDangLam)
       -> api/du_lieu_tinh_luong/payrollCalculationQueries.ts   (usePayrollCalculateQuery / useSupportAllowancesQuery)
            -> api/du_lieu_tinh_luong/payrollCalculationApi.ts  (api.get('/hrm/payroll/calculate'|'/hrm/payroll/support-allowances'))
       -> components/du_lieu_tinh_luong/useCurrentPayrollPeriod.ts  (periodId — CÙNG context với khu "Dữ liệu tính lương")
```

- **File mới**: `api/bang_luong/bangLuongQueries.ts` — adapter duy nhất đổi `PayrollCalculationLineApi`
  (44 trường) sang `DongBangLuong` (kiểu UI cũ, giữ nguyên để 5 component tiêu thụ không phải sửa
  field) và `SupportAllowanceResponseApi` sang `{ columns, rows: DongLuongHoTro[] }`.
- **File xóa**: `mock/hooks/bangLuong.ts` (khác các mock khác trong feature — file này KHÔNG giữ
  lại làm di sản vì nó `import` thẳng `tinhDongBangLuong`/`lyDoKhongTinhDuocLuong` mà tôi đã xóa
  khỏi `calculations/bang_luong/bangLuong.ts`; giữ lại sẽ vỡ `tsc`).
- **`calculations/bang_luong/bangLuong.ts`**: chỉ còn hàm **format hiển thị thuần**
  (`tienTheoCheDo`, `hauToCheDo`, `CHE_DO_HIEN_THI`, `tongBangLuong`). Đã xóa `tinhDongBangLuong`,
  `thueLuyTien`, `lyDoKhongTinhDuocLuong`, `NguonTinhLuong`, `LOI_BIEU_THUE_KHONG_DU_BAC` — đây là
  nghiệp vụ tính thuế/bảo hiểm, giờ là **nguồn sự thật DUY NHẤT ở `be_maxv`**. ĐỪNG dựng lại công
  thức thuế/bảo hiểm ở FE dưới bất kỳ tên hàm nào (nhân đôi nghiệp vụ — rủi ro 2 nơi ra 2 số).

**Hai cạm bẫy field mapping (api-contract Mục 8.1.1, đã ghi thành comment ⭐ ngay trong
`bangLuongQueries.ts`, nhắc lại ở đây vì QA/reviewer cần biết để lập test case riêng):**

1. `gio_tang_ca` (cột "Giờ tăng ca") ← `otRawHours` (giờ GỐC). **KHÔNG** dùng `otConvertedHours`
   (đã nhân hệ số) — dùng nhầm là sai số giờ hiển thị dù tiền tăng ca vẫn đúng (vì `tien_tang_ca`
   đọc đúng `otAmount`).
2. `thu_nhap_chiu_thue` suy từ 4 số hạng: `grossIncome − otTaxExemptAmount −
   lunchAllowanceExemptAmount − otherAllowanceTaxExemptAmount`. **KHÔNG** dùng thẳng
   `taxableIncome` — trường đó đổi Ý NGHĨA theo `withholdingTaxApplied` (8.1.2): nhánh lũy tiến
   đã trừ giảm trừ gia cảnh + bảo hiểm, nhánh khấu trừ 10% thì chưa trừ gì thêm ngoài 3 khoản
   miễn thuế. Trộn hai nhánh vào cùng 1 cột là hiểu sai số liệu.

**Kỳ lương dùng CHUNG cơ chế với khu "Dữ liệu tính lương", không tự chế:**

`BangLuongPage.tsx` bọc lại đúng `PayrollPeriodProvider` (component `components/du_lieu_tinh_luong/
PayrollPeriodContext.tsx`, KHÔNG viết bản mới) + render lại `KyLuongSelector` — trước đó khu
"Bảng lương" hoàn toàn KHÔNG có khái niệm kỳ (mock luôn lấy "tháng hiện tại" qua `thangHienTai()`
phía trình duyệt). Cây Provider của `bang-luong` độc lập codewise với cây của `du-lieu-luong`
(hai route riêng, `<Outlet/>` khác nhau) nhưng CÙNG đọc/ghi khóa `localStorage`
`hrm_selected_payroll_period_id`, nên kỳ đã chọn ở bên "Dữ liệu tính lương" tự động là kỳ mặc
định khi mở "Bảng lương" lần đầu — không hỏi lại người dùng.

**Query key**: thêm `hrmPayrollCalculationKeys.supportAllowances(companyId, periodId)` vào
`api/hrmKeys.ts`, CÙNG tiền tố `"hrm-payroll-calculation"` với `calculate`/`sheetLines` để
`useInvalidatePayroll()` (`payrollPeriodsQueries.ts`) tự invalidate luôn khi khóa/mở lại/duyệt kỳ
lương — không phải sửa thêm chỗ nào khác khi đổi trạng thái kỳ.

**4 trạng thái Loading/Error/Empty/Success**: `useBangLuongRows`/`useLuongHoTroRows` trả
`{ isLoading, isFetching, isError, errorMessage }`. `BangLuongTable.tsx` nhận thêm prop
`isLoading` và tự vẽ `CircularProgress` trong chính `TableBody` (giữ nguyên khung bảng/sticky
header khi đang tải, tránh layout nhảy). Panel hiện `Alert severity="info"` riêng khi
`ky.periodId === null` (công ty chưa tạo kỳ lương nào — trước đây không có trạng thái này vì mock
luôn có "tháng hiện tại"), và `Alert severity="error"` khi `isError`. Nút "Tính lại lương"/"Tính
lương" đổi từ tăng `nonce` ép `useMemo` chạy lại (cách cũ) sang gọi thẳng `refetch()` của
TanStack Query — bỏ hẳn khái niệm `nonce`.

**`luong_theo_ngay` cộng thêm `allowanceInPeriodTotal`**: `proratedWorkSalary` của API CHỈ là
phần hợp đồng quy đổi công (SRS 15.5 giữ nguyên nghĩa cũ), khác bản mock gộp cả phụ cấp vào một
cột. Muốn khớp UI cũ phải cộng `proratedWorkSalary + allowanceInPeriodTotal` — đã làm đúng trong
`veDongBangLuong()`, đừng bỏ sót nếu sau này thêm màn khác dùng lại field này.

**Tab "Lương hỗ trợ" — cột động**: kiểu `KhoanLuong` (thực thể đầy đủ "Cài đặt lương") KHÔNG được
dùng lại cho cột động của tab này — API `columns` chỉ trả 4 trường mô tả cột, ép vào `KhoanLuong`
phải bịa `loai`/`ghi_chu`/`tinh_bhxh`/`ty_le`. Thêm kiểu riêng `KhoanHoTroCot` (`types/index.ts`),
`luongHoTroExcel.ts` đổi type tham số theo.

**Bug tiện thể sửa khi chạm vào `ThanhLocBangLuong.tsx`**: component này đang import
`usePhongBanList` từ `mock/hooks/phongBan` (kho giả) thay vì `api/du_lieu_nhan_vien/
phongBanQueries` (API thật, cùng hook đang dùng ở `ThanhLocKyLuong.tsx` của khu "Dữ liệu tính
lương") — sửa luôn vì nằm trong phạm vi file phải chạm, không phải lỗi tôi tạo ra nhưng để lại thì
bộ lọc "Phòng ban" của Bảng lương mãi mãi không khớp phòng ban thật.

**Lọc theo phòng ban cần tra chéo**: cả hai endpoint payroll chỉ trả TÊN phòng ban
(`departmentName`), không trả mã. `filters.ma_pb` (từ `ThanhLocBangLuong`) là MÃ, nên
`bangLuongQueries.ts` phải gọi thêm `useNhanVienRows({ status: '1' })` (cache dùng chung với màn
"Nhân viên") để dựng `Map<ma_nv, ma_pb>` rồi lọc chéo qua `ma_nv` — không so trực tiếp tên với mã.

**⚠️ Chưa làm — biết trước khi QA/PO hỏi:**

| # | Việc còn thiếu | Vì sao chưa làm |
|:--:|---|---|
| 1 | ~~`BangLuongPanel` gọi `GET /payroll/calculate` (LUÔN live) thay vì `GET /payroll/sheet-lines`~~ | ✅ **Đã sửa 2026-09-10** — xem Mục 2.13 |
| 2 | Chưa test qua trình duyệt với dữ liệu tenant thật (chỉ smoke-test chưa đăng nhập) | Môi trường dev không có tài khoản/tenant test sẵn (không tìm thấy credential nào trong `docs/`/scripts seed). Đã xác nhận: `npm run build`/`lint`/`tsc -b` sạch; mở `/hrm/bang-luong/bang-luong` lúc chưa đăng nhập không crash JS (chỉ 401 kỳ vọng từ `/auth/me`), hành vi giống hệt route cũ `/hrm/du-lieu-luong/cham-cong` (không tự tạo ra) — chưa xác nhận được số liệu hiển thị đúng với dữ liệu thật. Vẫn nợ sau Mục 2.13. |
| 3 | `isLiveRecalculated`/`periodStatus` của `/payroll/support-allowances` chưa hiển thị cảnh báo riêng trên UI khi kỳ đã khóa (RVW-020 backend đã lưu ý số có thể lệch) | 🟡 **Giảm nhẹ 2026-09-10**: `LuongHoTroPanel` nay hiện `Alert warning` khi `useCurrentPayrollPeriod().isLocked` (xem Mục 2.13) — dùng cờ context sẵn có thay vì đọc đúng field `isLiveRecalculated`/`periodStatus` của chính response (2 field đó API đã trả nhưng FE vẫn CHƯA đọc tới, tương đương về ngữ nghĩa vì set trạng thái khóa 2 nguồn trùng nhau, nhưng chưa dùng field thật của endpoint — nợ kỹ thuật nhỏ nếu 2 nguồn lệch nhau trong tương lai) |

### 2.13. Bảng lương chính đổi nguồn sang `/payroll/sheet-lines` — snapshot bất biến khi khóa sổ (2026-09-10, frontend-engineer)

Đóng khoản nợ #1 của Mục 2.12: `useBangLuongRows`/`useSoNhanVienDangLam`
(`api/bang_luong/bangLuongQueries.ts`) đổi từ `usePayrollCalculateQuery` (LUÔN live) sang
`usePayrollSheetLinesQuery` (`api/du_lieu_tinh_luong/payrollCalculationQueries.ts`, hook đã viết
sẵn từ phiên trước, chỉ chưa đấu dây). `getPayrollSheetLines()` (be_maxv) tự chuyển nhánh theo
`PayrollPeriod.status`: `DRAFT`/`PENDING_REVIEW` → gọi lại `calculatePayrollPreview()` (tính live);
`LOCKED`/`APPROVED`/`PAID`/`ARCHIVED` → đọc thẳng `db.payrollSheetLine.findMany({ where:
{ periodId } })` (snapshot đóng băng lúc khóa sổ) — route `GET /payroll/sheet-lines` + controller
`getSheetLines` đã tồn tại sẵn trước phiên này (`payrollCalculation.route.ts`:6,
`payrollCalculation.controller.ts`:21-25), KHÔNG cần backend làm gì thêm.

**Bug ẩn phát hiện khi đấu dây, đã tự sửa ở biên FE (A-06, KHÔNG đụng backend):** nhánh snapshot
trả thẳng cột `Decimal` Prisma của `PayrollSheetLine` — `Decimal.prototype.toJSON()` serialize ra
**chuỗi**, khác nhánh live (`calculatePayrollPreview` đã `Number(...)` mọi trường trước khi trả).
Cùng endpoint, cùng kiểu khai báo `PayrollCalculationLineApi`, nhưng RUNTIME đổi kiểu giữa hai
nhánh — không ném lỗi nào, chỉ âm thầm sai số nếu cộng chuỗi (`"1000000" + "500000"` nối thành
`"1000000500000"` thay vì `1500000`), đúng lúc `veDongBangLuong()` cộng
`proratedWorkSalary + allowanceInPeriodTotal` cho `luong_theo_ngay`. Đây chính là nợ kỹ thuật
`A-06` đã ghi nhận từ review-findings.md/api-contract Mục 0.3 (BE cố ý chưa đóng, cần Architect
chốt serializer chung cho `/payroll*`) — **không thuộc phạm vi backend của phiên FE này**, nên xử
lý bằng cách ép kiểu tại biên: `getPayrollSheetLines()` (`payrollCalculationApi.ts`) nay nhận response
thô `Record<string, unknown>[]`, chạy `normalizePayrollLine()` (`Number(...)` toàn bộ 34 trường
Decimal/Int liệt kê tường minh trong `PAYROLL_LINE_NUMERIC_FIELDS`) trước khi trả về
`PayrollCalculationLineApi[]`. Từ điểm này trở xuống (`bangLuongQueries.ts` và mọi nơi dùng lại
`usePayrollSheetLinesQuery`), kiểu `number` khai báo là ĐÚNG runtime cho cả hai nhánh — KHÔNG cần
tự phòng thủ lại. **Nếu Architect/Backend sau này đóng A-06 ở tầng serializer chung**, hàm
`normalizePayrollLine()` trở thành no-op vô hại (`Number(5)` === `5`), không cần xóa gấp nhưng nên
dọn khi có dịp.

**UI — badge "Đã khóa sổ":** `BangLuongPanel` đọc thêm `useCurrentPayrollPeriod().isLocked`
(context đã có sẵn từ trước, cùng bộ điều kiện `LOCKED`/`APPROVED`/`PAID`/`ARCHIVED` khớp Y HỆT
nhánh snapshot của backend) để hiện `Chip` "Đã khóa sổ — số liệu đã chốt" cạnh tên kỳ, và đổi nhãn
nút từ "Tính lại lương" (icon `CalculateRounded`) sang "Tải lại số liệu" (icon `RefreshRounded`)
khi kỳ đã khóa — tránh hiểu lầm là bấm nút sẽ tính lại theo dữ liệu hiện tại (không phải, chỉ tải
lại đúng snapshot đã đóng băng). `LuongHoTroPanel` thêm `Alert severity="warning"` khi `isLocked`
— cảnh báo tab này KHÔNG có snapshot riêng (RVW-020, be_maxv), vẫn luôn tính live.

**KHÔNG đổi** (đúng phạm vi bug report, không mở rộng): `useLuongHoTroRows`/`/payroll/support-allowances`
vẫn luôn tính live — backend chưa có bảng snapshot bóc tách theo từng khoản phụ cấp (nợ thiết kế
riêng, cần ADR mới, không thuộc phạm vi phiên này). `usePayrollCalculateQuery` (`/payroll/calculate`
thô) vẫn giữ nguyên, không xóa — không còn nơi nào gọi trực tiếp sau đổi này nhưng vẫn có ích cho
trường hợp cố ý cần xem số tính lại tức thời sau này.

Kiểm chứng: `npx tsc -b` (exit 0) · `npm run lint` (0 lỗi, 0 cảnh báo) · `npm run build` (thành
công, 12346 module). **Chưa test tay qua trình duyệt với dữ liệu tenant thật** (cùng lý do Mục
2.12 mục #2 — không có tài khoản/tenant test trong môi trường này) — CHƯA xác nhận: (a) số hiển thị
ở kỳ LOCKED khớp đúng snapshot đã lưu lúc khóa sổ, (b) badge/nút đổi nhãn đúng khi chuyển qua lại
DRAFT ↔ LOCKED, (c) `normalizePayrollLine()` áp đúng cho response thật (chỉ verify qua đọc code
service be_maxv + kiểu Prisma schema, chưa gọi API thật).

### 2.14. 3 tham số pháp lý (ADR-010) + cờ `isMealAllowance` — nối UI cho dữ liệu BE đã có sẵn (2026-09-10, frontend-engineer)

Việc thuần FE: `be_maxv` đã có sẵn 3 cột `GeneralSetting` (`lunchAllowanceTaxFreeCap` /
`withholdingTaxRate` / `withholdingTaxThreshold`) và cột `SalaryItem.isMealAllowance` từ đợt ADR-010
(Mục 1.10), route `GET`/`PUT /hrm/settings/general` và `POST`/`PATCH /hrm/salary-items` đã nhận/trả
đủ — chỉ thiếu đường dẫn dữ liệu ở FE. KHÔNG đụng `be_maxv`.

**Đơn vị `withholdingTaxRate` — điểm dễ sai nhất, đã đối chiếu kỹ:** cột là **số nguyên phần
trăm** (`Decimal(5,2)`, mặc định `10.0` nghĩa là 10%), CÙNG quy ước với `insuranceEmployeeSocial`
(`bhxh_nv` = 8, không phải 0.08) — KHÔNG phải phân số 0..1. Domain field FE `ty_le_khau_tru_thu_viec`
giữ nguyên đơn vị này ở cả 3 lớp: type (`number`, không đổi tên gợi ý "rate 0-1"), giá trị mặc định
(`cauHinhMacDinhGoc()` = `10`, KHÔNG phải `0.1`), và phép kiểm trước khi gửi (`0 ≤ x ≤ 100`, khớp
`z.number().min(0).max(100)` của `generalSettings.validator.ts:160`).

- **Thiết lập chung** — 3 field mới đi theo đúng đường ống Decimal-là-chuỗi có sẵn ở Mục 2.2/2.1
  (`GeneralSettingApiData` đọc `string`, `UpdateGeneralSettingsApiBody` ghi `number`, `Number()` chỉ
  một chỗ trong `veKieuFeCauHinh()`). Render ở khối `NhomCauHinh` mới trong `ThueSection.tsx`, dưới
  khối "Giảm trừ thuế TNCN" — KHÔNG tạo section riêng vì cùng nhóm nghiệp vụ thuế TNCN.
- **Danh mục khoản lương** — cờ `phu_cap_an_trua` đi theo đúng khuôn `isTaxable`/`chiu_thue_tncn`
  đã có (đọc/ghi ở `salaryItemsQueries.ts`, mặc định `false` ở `formDefaults.ts`). Ô tích chỉ hiện ở
  dialog khi `MoTaLoaiKhoan.coMienAnTrua === true` — **chỉ bật cho loại `luong_ho_tro`** (nhóm "Hỗ
  trợ ăn ca, xăng xe, điện thoại"), 6 loại còn lại giữ `false`. Người dùng vẫn CÓ THỂ tự tick cờ
  `isTaxable`/`tinh_bhxh` độc lập với `phu_cap_an_trua` — ba cờ không loại trừ nhau, nghiệp vụ tính
  thuế (trần miễn thuế cộng lớp nào trước) là việc của `payrollCalculation.service.ts` (be_maxv),
  FE chỉ truyền cờ thô.
- **Domain type dùng chung buộc phải sửa `mock/seed.ts`** dù ngoài phạm vi yêu cầu ban đầu: thêm
  `TypeScript required field` vào `CauHinhMacDinh`/`KhoanLuong` làm `CAU_HINH_MAU`/`KHOAN_LUONG_MAU`
  (dữ liệu demo tĩnh, không phải hook) không còn compile — đây là ví dụ cụ thể của nguyên tắc "đổi
  type dùng chung thì sửa luôn nơi dùng nó", không phải lấn phạm vi. `KL08` "Phụ cấp tiền cơm" được
  gán `phu_cap_an_trua: true` (khoản duy nhất mang nghĩa ăn trưa/ăn ca trong dữ liệu mẫu), 18 khoản
  còn lại `false`.

Kiểm chứng: `npx tsc -b` (exit 0, sau khi sửa `mock/seed.ts`) · `npm run lint` (0 lỗi) · `npm run
build` (thành công, 12346 module — 2 cảnh báo Rolldown đã có từ trước, không mới). **Chưa test tay
qua trình duyệt** — không có tài khoản/tenant test trong môi trường này, chỉ xác nhận qua đọc code
be_maxv (schema/validator/service) + build sạch.

### 2.15. Dashboard HRM — bỏ kho giả, đọc API thật (2026-09-10)

Không có endpoint tổng hợp: Dashboard GHÉP các truy vấn các màn khác đã dùng, **cùng `queryKey` +
cùng hàm tải**, nên không tốn thêm request khi cache còn tươi. `mock/hooks/tongQuan.ts` đã xóa.

| Khối | Nguồn | Nơi gom số |
|---|---|---|
| Tình hình nhân sự · Sinh nhật · Sắp kết thúc HĐ | `GET /hrm/nhan-vien` (dòng BE thô qua `useDanhSachNhanVien`) | `calculations/dashboard/tongQuan.ts` |
| Xu hướng lương 6 tháng | `GET /payroll/sheet-lines` × mỗi kỳ trong khung (`useQueries` + `payrollSheetLinesOptions`) | `tongKyLuong()` |
| Chi phí theo phòng ban | `sheet-lines` của kỳ theo dõi | `chiPhiTheoPhongBan()` |
| Chờ phê duyệt · Trình lương | `GET /payroll-periods` | `kyChoPheDuyet()` / `kyNenTrinh()` |
| Tổng giờ tăng ca | `GET /payroll-data/overtime` (kỳ theo dõi + kỳ trước) | `tongHopTangCa()` |

- **Không tính lại lương.** Quỹ lương = Σ`totalCompanyCost`, thực lĩnh = Σ`netTakeHomeSalary` — cùng
  hai cột ở màn Bảng lương. `PayrollPeriodApiItem.totalGrossSalary/totalNetSalary` là field FE khai
  nhưng **BE không trả** (model `PayrollPeriod` không có cột đó) — đừng dùng, chúng luôn `undefined`.
- **Hợp đồng lấy từ hồ sơ nhân viên** (`loai_hop_dong` 3 nhóm, `ngay_hieu_luc_toi` do BE tính lúc
  đọc) — không gọi `/hrm/hop-dong` theo từng người. Hạn chế đã biết: người đã ký sẵn hợp đồng gia hạn
  bắt đầu SAU ngày hết hạn của hợp đồng hiện hành vẫn hiện trong "sắp kết thúc" cho tới khi hợp đồng
  mới có hiệu lực.
- **Quyền xem lương:** cả nhóm `/payroll-*` trả 403 cho người không có quyền. `useKyLuongDashboard`
  chỉ bật `usePayrollPeriodList(undefined, { enabled })` khi `useQuyenXemLuong().daXacDinh` (cờ mới:
  danh sách nhân viên đã tải xong hoặc là OWNER) — tránh một 403 + một retry vô ích lúc danh sách
  còn tải. Khối lương hiện lời nhắc `LOI_KHONG_CO_QUYEN_LUONG` (qua prop `chan` của `TheDashboard`),
  khối nhân sự vẫn hiện. Lỗi API đọc thẳng `message` của BE — 403 thiếu quyền lương đã mang đúng câu
  E-hrm-058, đừng tự đổi mọi 403 thành câu đó (403 của guard module/tenant là chuyện khác).
- **Kỳ theo dõi** = kỳ của tháng này, chưa có thì kỳ mới nhất (`chonKyTheoDoi`). Lối tắt chấm công /
  tăng ca / bảng lương mở màn đích với kỳ đã chọn sẵn qua `luuKyLuongDaChon()` — cặp
  `docKyLuongDaChon`/`luuKyLuongDaChon` ở `useCurrentPayrollPeriod.ts` là nơi DUY NHẤT đụng khóa
  `localStorage` (Provider cũng gọi qua đó), có try/catch khi trình duyệt chặn lưu trữ.
- **Trạng thái kỳ dùng chung:** `TRANG_THAI_KY` (nhãn + màu), `kyDaKhoaSo()` và `tenKyMacDinh()` ở
  `_shared/constants.ts` — `KyLuongSelector`, `PayrollPeriodContext` (`isLocked`) và Dashboard cùng đọc.
- **Biểu đồ vẽ SVG/HTML thuần** (`components/dashboard/charts/`) — dự án chưa có thư viện biểu đồ, ba
  loại cần dùng không đáng thêm dependency. Màu dữ liệu cố định (`mauBieuDo.ts`, đã chạy kiểm bảng
  màu cho người mù màu trên nền Paper sáng/tối), tách khỏi màu accent người dùng chọn. Bề rộng đo
  bằng `useElementWidth` (cùng lõi đo hai lớp với `useElementHeight`, `features/hddt/hooks/`).
- **Nợ hiệu năng đã biết:** "Xu hướng lương" gọi tối đa 6 `sheet-lines`; kỳ nháp tính live cả bảng
  lương chỉ để lấy 4 tổng. Cách triệt để là một endpoint BE trả tổng theo kỳ — chưa làm (ngoài phạm vi
  thuần FE).

Kiểm chứng: `npx tsc -b` exit 0 · `npm run lint` 0 lỗi · `vite build` thành công. Giao diện soát bằng
trang preview tạm với dữ liệu giả (sáng, tối, không có quyền lương, rỗng, màn 1000/1280/1440px), đã
xóa sau khi soát. **Chưa chạy trên tenant thật** (cần đăng nhập).

### 2.16. Góc chọn kỳ lương + màn "Chốt kỳ lương" (2026-09-11, frontend-engineer)

**Mô hình:** kỳ lương đang chọn là trạng thái CHUNG của cả khu HRM. `PayrollPeriodProvider` bọc
một lần ở `pages/hrm/HrmPage.tsx` (không còn bọc riêng ở `DuLieuLuongPage`/`BangLuongPage`). Trạng
thái DUY NHẤT là **tháng đang xem** (`thangChon`, đổi qua `chonThang(ThangNam)`, nhớ `YYYY-MM` ở
`localStorage`); kỳ suy ra từ tháng: tháng chưa có kỳ ⇒ `selectedPeriod = null`, các màn hiện "chưa
có kỳ" thay vì giữ lặng lẽ kỳ cũ. Danh sách kỳ lấy qua `useDanhSachKyLuongTheoQuyen` (dùng chung với
Dashboard — cùng cổng quyền lương, cùng khóa cache). Helper tháng/kỳ dùng chung:
`_shared/thangKyLuong.ts` (`ThangNam`, `luiThang`, `kyCuaThang`, `kyMoiNhat`, `thangCuaKy`, `nhanThang`).

| Thao tác | Nơi xử lý |
|---|---|
| Ô `‹ 09/2026 › 📅` + nút "Chốt kỳ lương T9/2026" / "Tạo kỳ lương" (góc phải thanh HRM) | `components/chot_ky_luong/GocKyLuong.tsx` |
| Trang `/hrm/chot-ky-luong` | `pages/hrm/chot_ky_luong/ChotKyLuongPage.tsx` → `components/chot_ky_luong/ChotKyLuongPanel.tsx` |
| Header (chip trạng thái, "Bảng lương a/b NV", "x/12") + Tính lương, Chốt số toàn kỳ (kèm hộp xác nhận), Hướng dẫn — header tự quản mutation/hộp thoại của mình | `ChotKyLuongHeader.tsx`, `HuongDanChotKyDialog.tsx` |
| Nút vòng đời kỳ (Trình duyệt / Từ chối / Khóa sổ / Mở lại / Duyệt) — chuyển từ `KyLuongSelector` cũ (đã xóa) | `VongDoiKyLuong.tsx` |
| Thẻ bảng kê (chốt / mở chốt + hộp xác nhận mở chốt), lịch sử hoạt động | `ChotKyLuongPanel.tsx`, `TheBangKe.tsx`, `LichSuHoatDong.tsx`; icon/màu/đường "Xem chi tiết": `bangKe.ts` |
| Dùng chung trong màn | `chayVoiThongBao.ts` (toast xanh/đỏ), `useLaChuTaiKhoan.ts` (mirror `assertAdminOrOwner`), `IconVuong.tsx` |
| API + query | `api/chot_ky_luong/chotKyLuongApi.ts`, `chotKyLuongQueries.ts` — thao tác chốt chỉ làm mới 2 khóa `closing`/`activities` của đúng kỳ (`useLamMoiChotKy`); khóa nằm CHUNG tiền tố `hrm-payroll-periods` ⇒ mutation vòng đời kỳ cũng tự làm mới thẻ + lịch sử |
| 8 màn nhập liệu chỉ đọc khi bảng kê đã chốt | `components/du_lieu_tinh_luong/useBangKeChiDoc.ts` + `CanhBaoChiDoc.tsx` |

**TUYỆT ĐỐI:**
- Màn nhập liệu mới lấy cờ chỉ đọc từ `useBangKeChiDoc('<MÃ>')`, KHÔNG lấy `isReadOnly` trơn của
  `useCurrentPayrollPeriod` — trơn thì bảng kê đã chốt vẫn cho bấm (máy chủ vẫn chặn 403, nhưng
  người dùng chỉ thấy lỗi sau khi bấm).
- Mở một màn kỳ lương từ nơi khác (Dashboard...) qua `useMoManKyLuong()(duongDan, ky)` — truyền
  CẢ kỳ, hook chọn đúng tháng của kỳ qua context (provider đã mount sẵn; ghi `localStorage` rồi điều
  hướng như trước kia KHÔNG còn tác dụng).
- Mutation tạo/đổi kỳ (`payrollPeriodsQueries.ts`) chỉ về khi danh sách kỳ đã nạp lại
  (`useInvalidatePayroll` trả promise) — nơi gọi `mutateAsync` đọc được ngay kỳ vừa tạo, không cần
  cơ chế "kỳ đang chờ" trong provider.
- Nút Mở chốt / Khóa sổ / Mở lại / Duyệt khóa sẵn khi `user.role` không phải OWNER/ADMIN — chỉ để
  báo sớm; máy chủ (`assertAdminOrOwner`) mới là hàng rào thật.
