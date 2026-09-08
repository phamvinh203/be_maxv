# HRM — ISSUES, BUGS & ĐẦU VIỆC CẦN LÀM

> **Đợt rà soát**: Phase A — Shift-Left Spec Review (2026-09-07), chạy song song BA + Architect.
> **Phương pháp**: đọc **mã nguồn thật** (`be_maxv/`, `hdđt_maxv/`) và đối chiếu với `srs/hrm-spec.md`, `architecture/api-contract.md`, `architecture/adr/*`, `CONTEXT_SUMMARY.md`. Mọi khẳng định đều kèm `file:line`.
>
> ## ⚠️ Tuyên bố trung thực về mức độ tin cậy
>
> | Loại bằng chứng | Áp dụng cho | Độ tin cậy |
> |:---|:---|:---|
> | **Đã chạy thật** | `npm run typecheck` (exit 0, 0 lỗi) · `npm run lint` (exit 0, 0 error, 125 warning `no-console`, **0 warning trong file HRM**) · liệt kê `src/__tests__/` (**0 file test HRM**) · liệt kê thư mục `fe_maxv/src/features/` và `hdđt_maxv/src/features/hrm/` | Cao — kết quả lệnh thật |
> | **Đọc code tĩnh** | Toàn bộ phân tích hành vi nghiệp vụ, race condition, chồng lấn hợp đồng, luồng Drive | Trung bình–cao — suy luận từ mã nguồn, **CHƯA chạy runtime** |
> | **Chưa kiểm chứng runtime** | Mọi dòng "Actual" trong tài liệu này | Phải xác nhận lại ở **Phase B** |
>
> **Không có bug nào trong tài liệu này được tuyên bố là "đã tái hiện trên môi trường chạy".** Cột *Trạng thái* nói về việc **nhận định cũ có còn khớp code hay không**, không phải về việc đã test xong.

---

## 1. XÁC MINH LẠI 4 ISSUE ĐÃ GHI TRƯỚC ĐÓ

| Mã | Nhận định cũ | Kết luận xác minh | Bằng chứng `file:line` |
|:---|:---|:---:|:---|
| **ISSUE-HRM-01** | `createHopDong`/`updateHopDong` cho phép hợp đồng chồng lấn | ✅ **CÒN ĐÚNG** | `be_maxv/src/services/client/hrm/hopDong.service.ts:185-193` (create) và `:196-218` (update) — không có bất kỳ truy vấn kiểm giao cắt nào; `be_maxv/prisma/tenant/schema.prisma:960-990` chỉ có `@@index([ma_nv])`, không có ràng buộc loại trừ |
| **ISSUE-HRM-02** | Race sinh mã nhân viên, thiếu retry `P2002` | ✅ **CÒN ĐÚNG** (nhưng **mô tả hệ quả SAI**) | `nhanVien.service.ts:170-194` — `sinhMaNhanVien` → `assertNotExists` → `create`, **không transaction, không retry**. ❗Sửa mô tả: trong race thật, request thứ hai **không** nhận thông điệp `Mã nhân viên "NV0010" đã tồn tại` mà nhận **409 với thông điệp CHUNG `Dữ liệu bị trùng`** vì lỗi đến từ khóa chính Prisma `P2002` (`plugins/errorHandler.plugin.ts:87-92`). Ngoài ra issue cũ **bỏ sót** `createPhongBan` có cùng lỗ hổng (`phongBan.service.ts:170-189`) |
| **ISSUE-HRM-03** | `DELETE /hop-dong/:id` xóa cứng, nguy cơ xóa hợp đồng đã phát sinh bảng lương | ⚠️ **CÒN ĐÚNG một phần** (rủi ro hiện tại khác mô tả) | `hopDong.service.ts:276-292` — xóa cứng thật, không guard, **không ghi nhật ký**. Nhưng phân hệ Payroll **chưa tồn tại ở backend** (grep `be_maxv/src` không có module lương; UI ở `hdđt_maxv/src/features/hrm/components/bang_luong` là mock). ⇒ **Rủi ro THẬT hôm nay** = mất vĩnh viễn lịch sử hợp đồng không dấu vết + không hoàn tác được cờ `cong_doan` đã bị tắt (xem `BUG-HRM-24`). Phần "khóa theo bảng lương" là **việc tương lai**, không phải bug hiện tại |
| **ISSUE-HRM-04** | Frontend `fe_maxv` thiếu badge "Chưa có hợp đồng" | ⚠️ **GHI SAI APP** — nội dung đúng, vị trí sai | HRM frontend nằm ở **`hdđt_maxv/src/features/hrm/`**. Đã liệt kê `fe_maxv/src/features/` → chỉ có `auth, ban_hang, company, ton_kho, tong_hop`, **không có `hrm`**. Vị trí thật: `hdđt_maxv/src/features/hrm/components/nhan_vien/NhanVienTable.tsx:169` (tiêu đề cột "Hợp đồng") và `:201-203` (`{nv.hop_dong?.so_hd ?? "—"}`). Nội dung nhận định (hiện `—`, không có cảnh báo) là **ĐÚNG** |

### 1.1 Ghi chú thêm về ISSUE-HRM-01 (đoạn mã đề xuất trong bản cũ)

Đoạn `assertKhongChongLanHopDong` được đề xuất trong bản `issues-and-bugs.md` cũ có **vị từ giao cắt đúng về mặt logic**, nhưng:

1. Nó ném `ConflictError` ⇒ HTTP **409**, trong khi `test-cases.md` cũ (TC-HD-02) lại kỳ vọng **400**. Hai tài liệu QA cũ **tự mâu thuẫn nhau**. Bản này thống nhất chọn **409** cho khớp `errorHandler.plugin.ts:29-33`.
2. Nó chỉ chặn ở tầng ứng dụng, **không đóng được race** (hai request đồng thời cùng qua bước kiểm). Muốn đóng dứt điểm phải có ràng buộc ở tầng DB (PostgreSQL `EXCLUDE USING gist (ma_nv WITH =, daterange(...) WITH &&)`) hoặc khóa hàng (`SELECT … FOR UPDATE` trên nhân viên) trong transaction.
3. Nó **không được gọi trong `doiHopDong`** — mà đó lại là đường ghi dễ sinh chồng lấn nhất (xem `BUG-HRM-06`).

---

## 2. BẢNG TỔNG HỢP TOÀN BỘ BUG & ISSUE

| Mã | Mức độ | Thực thể / Vùng | Mô tả một dòng | Trạng thái |
|:---|:---:|:---|:---|:---:|
| **BUG-HRM-05** | 🔴 **Critical** | Người phụ thuộc | Cùng một người phụ thuộc (cùng MST) đăng ký được ở **hai nhân viên khác nhau** → giảm trừ gia cảnh tính 2 lần → sai thuế TNCN, không cảnh báo | Mới |
| **ISSUE-HRM-01** | 🟠 High | Hợp đồng | `POST`/`PUT /hop-dong` không kiểm chồng lấn khoảng ngày (BR-03.3 chưa được cài) | Còn đúng |
| **BUG-HRM-06** | 🟠 High | Hợp đồng | `POST /hop-dong/doi` **bỏ sót hợp đồng ký trước cho tương lai** → tạo ra hợp đồng chồng lấn | Mới |
| **BUG-HRM-07** | 🟠 High | Hợp đồng | `doiHopDong` dùng mốc "hôm nay" theo **UTC** thay vì `homNayVN()` → 00:00–06:59 giờ VN chốt **nhầm** hợp đồng | Mới |
| **BUG-HRM-08** | 🟠 High | Hợp đồng | Hai request `/hop-dong/doi` đồng thời → chốt đôi + tạo 2 hợp đồng cùng hiệu lực | Mới |
| **BUG-HRM-10** | 🟠 High | Tài liệu / Drive | `DELETE /tai-lieu/:id` **KHÔNG** xóa file trên Drive dù `api-contract.md` và `CONTEXT_SUMMARY.md` đều khẳng định có → ảnh CCCD/hợp đồng còn lại vĩnh viễn | Mới |
| **BUG-HRM-11** | 🟠 High | Bảo mật / Drive | Nhân viên thường (không phải OWNER) nối được kho tài liệu của **cả công ty** vào **Drive cá nhân** → mâu thuẫn BR-05.1 | Mới |
| **ISSUE-HRM-02** | 🟡 Medium | Nhân viên / Phòng ban | Race sinh mã tự động, không retry `P2002`; thông điệp lỗi trả về là câu chung chung | Còn đúng (mô tả cần sửa) |
| **ISSUE-HRM-03** | 🟡 Medium | Hợp đồng | Xóa cứng hợp đồng, không guard, không dấu vết | Còn đúng một phần |
| **BUG-HRM-09** | 🟡 Medium | Phòng ban | `deletePhongBan` kiểm rồi ghi **hoàn toàn không có transaction** → xóa được phòng ban trong lúc có người vừa được thêm vào | Mới |
| **BUG-HRM-12** | 🟡 Medium | Hợp đồng | `so_hd` không unique, không kiểm trùng ở bất kỳ tầng nào | Mới |
| **BUG-HRM-13** | 🟡 Medium | Hợp đồng | Không kiểm `ngay_bat_dau` hợp đồng so với `ngay_vao_lam`; không kiểm `luong_bhxh` so với `luong_chinh` | Mới |
| **BUG-HRM-14** | 🟡 Medium | Hợp đồng API | `api-contract.md` sai so với code: status **201** vs 200, thân bọc `{success,data}`, base path `/api/v1/hrm`, thiếu 1 nhánh lỗi 409, sai hành vi xóa tài liệu | Mới |
| **BUG-HRM-15** | 🟡 Medium | Tài liệu kiến trúc | ADR-001 §3 và ADR-002 §3 mô tả cơ chế (retry-on-conflict, chống chồng lấn) **chưa hề tồn tại trong code** như thể đã triển khai | Mới |
| **BUG-HRM-16** | 🟡 Medium | Tài liệu / Drive | Hai upload đồng thời cùng một `tai_lieu.id` → một file mồ côi trên Drive | Mới |
| **BUG-HRM-17** | 🟡 Medium | Bảo mật / vận hành | Không có rate-limit riêng cho `POST /tai-lieu/:id/file` (10MB/lần) và `GET .../file`; OAuth client dùng chung mọi tenant | Mới |
| **BUG-HRM-18** | 🟡 Medium | Vận hành / audit | Toàn bộ HRM **không gọi `writeLog`** — không có nhật ký cho thao tác phá hủy (xóa hợp đồng, ngắt Drive, xóa NPT/tài liệu) | Mới |
| **ISSUE-HRM-04** | 🔵 Low | Frontend `hdđt_maxv` | Thiếu badge cảnh báo "Chưa có HĐ" ở bảng nhân viên | Ghi sai app, nội dung còn đúng |
| **BUG-HRM-19** | 🔵 Low | Phòng ban / Nhân viên | Nhánh dự phòng sinh mã bằng timestamp: không kiểm trùng và **phá định dạng BR-01.1** | Mới |
| **BUG-HRM-20** | 🔵 Low | Frontend `hdđt_maxv` | `hopDongTuApi` bịa `ngay_bat_dau = ngay_vao_lam` và `luong_chinh = 0` cho đối tượng hợp đồng | Mới |
| **BUG-HRM-21** | 🔵 Low | Phòng ban | `so_nv` không cộng dồn cây con và định nghĩa lệch với guard lúc xóa | Mới (cần BA chốt) |
| **BUG-HRM-22** | 🔵 Low | Phòng ban / Nhân viên | Có đường sinh **tham chiếu treo** `ma_pb`; không có endpoint khôi phục bản ghi đã xóa mềm | Mới |
| **BUG-HRM-23** | 🔵 Low | Nhân viên | Không chặn `ngay_sinh` phi lý (1800 / 2999); cho gán nhân viên vào phòng ban `status='0'` | Mới |
| **BUG-HRM-24** | 🔵 Low | Hợp đồng | `cong_doan = false` một chiều: không có dấu vết, không đảo lại được khi xóa nhầm hợp đồng khoán | Mới |
| **BUG-HRM-25** | 🔴 **Critical** | Hợp đồng / Bảo mật | `GET /hop-dong` để `ma_nv` là **tùy chọn**; giao diện gọi `listHopDong()` **không tham số** rồi lọc phía trình duyệt ⇒ **lương của toàn bộ nhân viên tải về máy bất kỳ ai có quyền vào MST** | Bổ sung 2026-09-07 |

**Tổng: 25 mục** — 2 Critical · 6 High · 10 Medium · 7 Low. *(BUG-HRM-25 bổ sung 2026-09-07 ở vòng đối soát chéo — lỗi đã biết từ vòng đầu nhưng chưa có mã riêng.)*
Trong đó **20 mục mới phát hiện ở đợt này**, 4 mục là xác minh lại nhận định cũ.

---

## 3. CHI TIẾT TỪNG BUG

### 🔴 BUG-HRM-25 — Lương toàn công ty gửi xuống trình duyệt của mọi người dùng

| | |
|:---|:---|
| **Mức độ** | Critical |
| **Vùng** | `hrm_hop_dong`, phân quyền |
| **Môi trường** | Backend `be_maxv` + Frontend `hdđt_maxv`, mọi tenant |
| **Yêu cầu liên quan** | BR-hrm-059, E-hrm-058, FR-hrm-042 |

**Ghi chú đánh số (2026-09-07).** Lỗi này được nêu trong `CONTEXT_SUMMARY.md` Mục 5.1 từ vòng rà soát đầu nhưng bị gán nhầm mã `BUG-HRM-13` — mã đó đã thuộc về lỗi thiếu kiểm liên trường ngày/tiền (Mục 3 dưới). Cấp mã mới `BUG-HRM-25` và sửa mọi tham chiếu ở vòng đối soát chéo.

**Hiện trạng.** `listHopDong` chỉ thêm điều kiện `ma_nv` khi tham số khác rỗng (`hopDong.service.ts:175`), validator để `ma_nv` là tùy chọn (`hopDong.validator.ts:115-123`). Giao diện khai thác đúng điều đó: `hdđt_maxv/src/features/hrm/api/hopDongQueries.ts:67-75` gọi `listHopDong()` **không tham số**, rồi `useHopDongList(maNv)` (`:78-91`) mới lọc phía trình duyệt.

**Hệ quả.** Mở màn hồ sơ **một** nhân viên là tải **bảng lương cả công ty** về máy: lương chính, lương đóng BHXH của mọi người. Đây là rò rỉ dữ liệu **trong nội bộ một công ty** qua thiết kế, không phải chuyện hiệu năng, và **không phải** rò chéo giữa các tenant (cô lập tenant vẫn đạt).

**Đã chốt cách sửa (QĐ #8 + QĐ #9, xem `ADR-007`).** Bắt buộc `ma_nv` và chặn theo quyền xem dữ liệu lương. **Máy chủ và giao diện phải sửa cùng một lượt** — siết máy chủ trước mà chưa sửa giao diện thì màn hợp đồng trắng ngay với mọi người dùng, kể cả người đủ quyền.

**Ca kiểm thử.** TC-hrm-211 … 216.

---

### 🔴 BUG-HRM-05 — Người phụ thuộc trùng MST giữa HAI nhân viên không bị chặn

| | |
|:---|:---|
| **Mức độ** | Critical |
| **Thực thể** | `hrm_nguoi_phu_thuoc` |
| **Môi trường** | Backend `be_maxv`, mọi tenant |
| **Yêu cầu liên quan** | BR-04.1 |
| **Ca kiểm thử** | TC-hrm-105 |

**Tiền điều kiện**: công ty có `NV0001` (bố) và `NV0002` (mẹ), cả hai đang làm việc.

**Các bước tái hiện**
1. `POST /api/v1/hrm/nguoi-phu-thuoc` `{ "ma_nv":"NV0001", "ho_ten":"Nguyễn Văn Con", "quan_he":"con", "mst":"8123456789" }` → **201**.
2. `POST /api/v1/hrm/nguoi-phu-thuoc` `{ "ma_nv":"NV0002", "ho_ten":"Nguyễn Văn Con", "quan_he":"con", "mst":"8123456789" }`.

**Kết quả mong đợi**: bước 2 bị chặn (**409**) hoặc ít nhất phải cảnh báo — theo Luật thuế TNCN, **mỗi người phụ thuộc chỉ được tính giảm trừ cho MỘT người nộp thuế**.

**Kết quả thực tế (suy từ code)**: **201** — tạo thành công. Một đứa trẻ được tính giảm trừ 11 triệu/tháng cho **cả hai** bố mẹ.

**Nguyên nhân gốc**
- `be_maxv/prisma/tenant/schema.prisma:949` — ràng buộc là `@@unique([ma_nv, mst])`, tức chỉ duy nhất **trong phạm vi một nhân viên**.
- `be_maxv/src/services/client/hrm/nguoiPhuThuoc.service.ts:100-109` — truy vấn kiểm trùng có `where: { ma_nv: maNv, mst, … }`, cũng khóa cứng theo một nhân viên.

**Vì sao nghiêm trọng**: sai số này **không có gì báo**, chỉ lộ ra khi cơ quan thuế đối chiếu lúc quyết toán, và khi đó doanh nghiệp đã kê khai sai nhiều kỳ. MAXV là sản phẩm kế toán–thuế nên đây là lỗi chạm trực tiếp vào giá trị cốt lõi.

**Đề xuất khắc phục**
1. Thêm ràng buộc DB `@@unique([mst])` trên `hrm_nguoi_phu_thuoc` (MST khác `null` là duy nhất **trong toàn tenant**, không phải trong một nhân viên) — Postgres coi `NULL` khác nhau nên hồ sơ chưa có MST vẫn nhập được nhiều dòng, đúng ý thiết kế hiện tại.
2. Mở rộng `assertKhongTrungMst` thành `assertMstChuaDuocDangKy(db, mst, boQuaId)`: bỏ điều kiện `ma_nv`, và khi phát hiện trùng thì **nêu rõ MST đó đang thuộc nhân viên nào** để kế toán xử lý.
3. **Cần BA chốt trước**: có ngoại lệ nghiệp vụ nào cho phép trùng không (ví dụ chuyển người phụ thuộc từ bố sang mẹ giữa năm — hai bản ghi có kỳ đăng ký **không giao nhau**)? Nếu có, ràng buộc phải là "không trùng MST **trong cùng kỳ đăng ký**" chứ không phải unique tuyệt đối.

---

### 🟠 ISSUE-HRM-01 — Hợp đồng chồng lấn thời gian (BR-03.3 chưa được cài)

| | |
|:---|:---|
| **Mức độ** | High · **Trạng thái: CÒN ĐÚNG** |
| **Thực thể** | `hrm_hop_dong` |
| **Ca kiểm thử** | TC-hrm-067 … 078 |

**Các bước tái hiện**
1. `POST /hop-dong` `{ "ma_nv":"NV0001", "so_hd":"HĐ-01", "ngay_bat_dau":"2026-01-01", "ngay_ket_thuc":"2026-12-31", … }` → 201.
2. `POST /hop-dong` `{ "ma_nv":"NV0001", "so_hd":"HĐ-02", "ngay_bat_dau":"2026-06-01", "ngay_ket_thuc":"2027-05-31", … }`.

**Mong đợi**: bước 2 → **409** nêu rõ hợp đồng đang vướng.
**Thực tế (suy từ code)**: **201**. Từ 01/06/2026 đến 31/12/2026 nhân viên có **hai** hợp đồng cùng hiệu lực.

**Hệ quả dây chuyền**: `chonHopDongHienHanh` (`hopDong.service.ts:93-104`) lúc đó trả về "cái bắt đầu muộn nhất" — một lựa chọn **tùy tiện chứ không phải đúng**, và mức `luong_chinh` / `luong_bhxh` / `trich_bhxh` mà Payroll sẽ đọc là của hợp đồng nào cũng "đúng như nhau", tức là không xác định.

**Nguyên nhân gốc**: `hopDong.service.ts:185-193` và `:196-218` — không có bước kiểm; `schema.prisma:960-990` — không có ràng buộc loại trừ ở DB.

**Đề xuất khắc phục**
1. Viết `assertKhongChongLanHopDong(tx, maNv, ngayBatDau, ngayKetThuc, boQuaId?)`, gọi trong **cả ba** đường ghi: `createHopDong`, `updateHopDong`, **và `doiHopDong`** (đường thứ ba bị bản đề xuất cũ bỏ sót).
2. Đặt lời gọi **bên trong `db.$transaction`** đang có, sau khi khóa hàng nhân viên (`SELECT … FOR UPDATE`) để bịt luôn race (`BUG-HRM-08`).
3. Bổ sung ràng buộc DB làm chốt cuối:
   `ALTER TABLE hrm_hop_dong ADD CONSTRAINT hd_khong_chong_lan EXCLUDE USING gist (ma_nv WITH =, daterange(ngay_bat_dau, COALESCE(ngay_ket_thuc, 'infinity'::date), '[]') WITH &&);` (cần extension `btree_gist`).
4. Trước khi bật ràng buộc, phải **dọn dữ liệu cũ đang chồng lấn** (viết script đối soát + báo cáo cho từng tenant) — nếu không, migration sẽ hỏng trên tenant có dữ liệu bẩn.
5. Mã lỗi thống nhất **409**; cập nhật `api-contract.md` và bổ sung Error Matrix vào `hrm-spec.md`.

---

### 🟠 BUG-HRM-06 — `POST /hop-dong/doi` bỏ sót hợp đồng ký trước cho tương lai

| | |
|:---|:---|
| **Mức độ** | High |
| **Thực thể** | `hrm_hop_dong` |
| **Ca kiểm thử** | TC-hrm-085 |

**Tiền điều kiện**: hôm nay `2026-03-01`. `NV0003` có HĐ A `[2026-01-01, 2026-06-30]` (đang hiệu lực) và HĐ B `[2027-01-01, null]` (đã ký trước cho tương lai — chính là kịch bản mà ADR-002 nêu ra làm lý do bỏ cột bản sao).

**Các bước**: `POST /hop-dong/doi` `{ "ma_nv":"NV0003", "ngay_chot":"2026-06-30", "ngay_bat_dau":"2026-07-01", "ngay_ket_thuc":null, … }`.

**Mong đợi**: **409** — hợp đồng mới `[2026-07-01, ∞)` nuốt trọn HĐ B.
**Thực tế (suy từ code)**: **201** với `da_chot_hop_dong_cu: true`. Nhân viên có 2 hợp đồng chồng nhau từ 2027.

**Nguyên nhân gốc**: `hopDong.service.ts:235-243` — truy vấn tìm "hợp đồng cần chốt" chỉ khớp `ngay_bat_dau: { lte: homNay }`; hợp đồng tương lai **nằm ngoài tầm nhìn**. Sau đó `:266` tạo hợp đồng mới mà không kiểm gì thêm. Validator `hopDong.validator.ts:101-112` chỉ so `ngay_bat_dau` với `ngay_chot`, không biết gì về các hợp đồng khác.

**Đề xuất khắc phục**: sau khi chốt hợp đồng cũ, chạy `assertKhongChongLanHopDong` cho hợp đồng mới **trong cùng transaction**; hoặc mở rộng bước tìm `cu` để cảnh báo khi tồn tại hợp đồng có `ngay_bat_dau > homNay`.

---

### 🟠 BUG-HRM-07 — `doiHopDong` dùng mốc "hôm nay" theo UTC, lệch với phần hiển thị

| | |
|:---|:---|
| **Mức độ** | High |
| **Thực thể** | `hrm_hop_dong` |
| **Ca kiểm thử** | TC-hrm-086 |

**Bằng chứng mâu thuẫn ngay trong một file**:
- `hopDong.service.ts:53-66` định nghĩa `homNayVN()` kèm ghi chú giải thích **chính xác** vì sao không được dùng lịch UTC: *"từ 00:00 đến 06:59 giờ Việt Nam thì lịch UTC vẫn đang ở NGÀY HÔM TRƯỚC"*.
- `hopDong.service.ts:97` — `chonHopDongHienHanh` (đường **đọc/hiển thị**) dùng đúng `homNayVN()`.
- `hopDong.service.ts:233-234` — `doiHopDong` (đường **ghi**) lại dùng `const homNay = new Date(); homNay.setUTCHours(0,0,0,0);` — **chính là cách làm mà ghi chú ở trên đã cấm**.

**Các bước tái hiện**: đặt đồng hồ máy chủ ở `2026-03-31T20:00:00Z` (= 03:00 sáng 01/04/2026 giờ VN). `NV0001` có HĐ A `[2026-01-01, 2026-03-31]` và HĐ B `[2026-04-01, null]`.
1. `GET /nhan-vien/NV0001` → màn hình hiện **HĐ B** là hợp đồng hiện hành (đúng theo giờ VN).
2. `POST /hop-dong/doi` cho `NV0001`.

**Mong đợi**: hệ thống chốt **HĐ B**.
**Thực tế (suy từ code)**: `homNay` = `2026-03-31` (UTC) → truy vấn khớp **HĐ A** → chốt nhầm hợp đồng đã hết hạn, và HĐ B vẫn còn nguyên → chồng lấn với hợp đồng mới vừa tạo.

**Ngoài ra**: `hopDong.service.ts:241` sắp xếp chọn `cu` chỉ bằng `orderBy: { ngay_bat_dau: 'desc' }`, **không** dùng bộ tiêu chí `sapXepHopDong` (`:114-118`) — mà chính ghi chú ở `:108-113` nói rõ sắp theo mỗi `ngay_bat_dau` là **không xác định** khi hai hợp đồng cùng ngày bắt đầu.

**Đề xuất khắc phục**: dùng `homNayVN()` trong `doiHopDong`; dùng chung `sapXepHopDong` cho mọi truy vấn chọn hợp đồng; tốt nhất là tái sử dụng thẳng `chonHopDongHienHanh` để **chỉ có một định nghĩa "hợp đồng hiện hành"** trong toàn hệ thống.

---

### 🟠 BUG-HRM-08 — Race: hai lệnh "đổi hợp đồng" đồng thời tạo 2 hợp đồng cùng hiệu lực

| | |
|:---|:---|
| **Mức độ** | High |
| **Thực thể** | `hrm_hop_dong` |
| **Ca kiểm thử** | TC-hrm-087 |

**Các bước tái hiện**: `NV0001` có đúng 1 hợp đồng `[2026-01-01, null]`. Bắn đồng thời (`Promise.all`) 2 request `POST /hop-dong/doi` với `ngay_chot = 2026-06-30`, `ngay_bat_dau = 2026-07-01`, `so_hd` khác nhau.

**Mong đợi**: 1 thành công (201), 1 thất bại (409).
**Thực tế (suy từ code)**: cả hai trả **201**; hợp đồng cũ bị chốt hai lần (cùng giá trị nên vô hại) nhưng sinh ra **2 hợp đồng mới `[2026-07-01, ∞)`**.

**Nguyên nhân gốc**: `hopDong.service.ts:229-268` có `db.$transaction` nhưng transaction chỉ đảm bảo **nguyên tử**, không đảm bảo **cô lập nối tiếp**. PostgreSQL mặc định `READ COMMITTED`; hai giao dịch đọc cùng ảnh chụp `cu`, không có khóa hàng, không có ràng buộc DB nào chặn.

**Đề xuất khắc phục** (chọn 1, ưu tiên phương án 1):
1. Khóa hàng nhân viên đầu transaction: `SELECT ma_nv FROM hrm_nhan_vien WHERE ma_nv = $1 FOR UPDATE` (qua `tx.$queryRaw`) — mọi đường ghi hợp đồng của cùng nhân viên bị nối tiếp hóa.
2. Ràng buộc `EXCLUDE` ở DB (xem ISSUE-HRM-01 §3) — chốt cuối, chặn được cả khi chạy nhiều tiến trình Node.
3. Nâng mức cô lập lên `Serializable` cho riêng transaction này + xử lý lỗi `40001` bằng retry.

> **Cùng họ vấn đề**: `createNhanVien` / `createPhongBan` / `deletePhongBan` — xem `ISSUE-HRM-02` và `BUG-HRM-09`.

---

### 🟠 BUG-HRM-10 — `DELETE /tai-lieu/:id` không xóa file trên Google Drive

| | |
|:---|:---|
| **Mức độ** | High |
| **Thực thể** | `hrm_tai_lieu` + Google Drive |
| **Ca kiểm thử** | TC-hrm-127 |

**Tài liệu nói gì**
- `docs/hrm/CONTEXT_SUMMARY.md` mục 3: *"`DELETE /tai-lieu/:id`: Xóa bản ghi giấy tờ **và xóa file trên Drive (best-effort)**."*
- `docs/hrm/architecture/api-contract.md` mục 6.1: *"`DELETE /tai-lieu/:id`: Xóa bản ghi + **tự động xóa file trên Google Drive (best-effort)**."*

**Code làm gì**
- `be_maxv/src/services/client/hrm/taiLieu.service.ts:124-135` — `deleteTaiLieu` chỉ có `findOrThrow` rồi `db.hrm_tai_lieu.delete({ where: { id } })`. **Không import, không gọi bất kỳ hàm Drive nào.**
- `be_maxv/src/controllers/client/hrm/taiLieu.controller.ts:65-69` — controller cũng chỉ gọi `deleteTaiLieu(db, id)`.

**Các bước tái hiện**
1. Tạo tài liệu `T1` cho `NV0001`, `POST /tai-lieu/T1/file` với `cccd.jpg` → Drive có file `FILE-X`, DB lưu `drive_file_id = "FILE-X"`.
2. `DELETE /tai-lieu/T1` → **200**.
3. Kiểm tra Drive của công ty.

**Mong đợi**: `FILE-X` bị xóa (best-effort).
**Thực tế**: `FILE-X` **vẫn còn nguyên** trong `maxv/<MST> - <Tên Cty>/NV0001 - …/`, và **không còn con trỏ nào trong DB** để tìm lại hay dọn về sau ⇒ file mồ côi vĩnh viễn.

**Vì sao nghiêm trọng**: đây là **ảnh CCCD, hộ chiếu, bằng cấp** của người lao động. Người dùng bấm "Xóa" và tin rằng dữ liệu đã bị xóa. Khi có yêu cầu xóa dữ liệu cá nhân, doanh nghiệp sẽ báo cáo sai sự thật.

**Đề xuất khắc phục**
1. Trong `deleteTaiLieu`: nếu `drive_file_id != null` thì gọi `goFile`-logic (lấy token công ty → `xoaFile`) theo kiểu **best-effort** (`.catch(() => undefined)`), rồi mới xóa dòng DB. Cần truyền `donViId` xuống service (controller đã có sẵn qua `donViDangChon(req)`).
2. Hoặc: **đổi tài liệu cho khớp code** và bổ sung nút "Gỡ file" bắt buộc trước khi xóa bản ghi ở FE. → **BA quyết chọn hướng nào**.
3. Dù chọn hướng nào, phải bổ sung **tác vụ dọn file mồ côi** (đối soát danh sách file trong thư mục công ty với `drive_file_id` trong DB).
4. Bổ sung câu hỏi cho BA: xóa mềm nhân viên thì file scan xử lý thế nào (`TC-hrm-128`)?

---

### 🟠 BUG-HRM-11 — Nhân viên thường nối được kho tài liệu công ty vào Drive cá nhân

| | |
|:---|:---|
| **Mức độ** | High (bảo mật / sở hữu dữ liệu) |
| **Vùng** | OAuth Google Drive |
| **Ca kiểm thử** | TC-hrm-153 |

**Mâu thuẫn spec ↔ code**
- `docs/hrm/srs/hrm-spec.md` BR-05.1: *"Google Drive được liên kết ở cấp độ Doanh nghiệp… Toàn bộ file scan giấy tờ nhân sự thuộc quyền sở hữu của doanh nghiệp, **không phụ thuộc vào cá nhân tài khoản HR**."*
- `be_maxv/src/controllers/client/hrm/taiLieu.controller.ts:148-151`:
  ```ts
  const tt = await trangThaiDrive(donViId);
  if (tt.da_ket_noi && req.user.role !== 'OWNER') {
    throw new ForbiddenError(MESSAGES.HRM.DRIVE_DOI_TAI_KHOAN_CHI_OWNER);
  }
  ```
  ⇒ chặn **chỉ khi đã kết nối rồi**. Lần kết nối **đầu tiên** thì bất kỳ user nào có module `hrm` cũng làm được.

**Các bước tái hiện**
1. Công ty chưa từng nối Drive.
2. Đăng nhập bằng tài khoản `OWNER_EMPLOYEE` (nhân viên kế toán được owner mời).
3. `GET /tai-lieu/drive/lien-ket` → **200**, nhận URL Google.
4. Đăng nhập bằng **Gmail cá nhân của nhân viên đó**, bấm đồng ý.
5. Từ đó mọi file scan CCCD/hợp đồng của **toàn công ty** được ghi vào Drive cá nhân của nhân viên này.

**Hệ quả khi nhân viên nghỉ việc / thu hồi quyền**: `GET /tai-lieu/:id/file` trả **404** `DRIVE_FILE_KHONG_MO_DUOC`; OWNER ngắt kết nối và nối lại tài khoản công ty cũng **không lấy lại được file cũ** (`taiLieuDrive.service.ts:146-148` ghi rõ: *"File cũ vẫn nằm nguyên ở tài khoản Google trước đó"*). Doanh nghiệp mất toàn bộ hồ sơ scan.

**Ghi chú công bằng**: code có ghi chú giải thích đây là **đánh đổi có chủ đích** (`taiLieu.controller.ts:144-148`) để kế toán không bị chặn giữa chừng. QA **không kết luận đúng/sai**, mà báo cáo rằng đánh đổi này **mâu thuẫn trực tiếp với BR-05.1** đã ký, nên phải được BA phán quyết chứ không để ngầm định.

**Đề xuất (BA chọn)**
- **A**: chỉ `OWNER` được nối Drive lần đầu; user thường thấy thông báo "Nhờ chủ tài khoản kết nối Google Drive của công ty".
- **B**: giữ nguyên nhưng **bắt buộc hiển thị cảnh báo chặn** trước bước đồng ý ("Bạn sắp gắn kho tài liệu của công ty vào tài khoản Google này. Hãy dùng tài khoản Google của công ty, không dùng Gmail cá nhân."), ghi nhật ký ai đã nối + email nào, và gửi thông báo cho OWNER.
- **C**: giữ nguyên và **sửa BR-05.1** cho khớp thực tế.

---

### 🟡 ISSUE-HRM-02 — Race sinh mã tự động, thông điệp lỗi không dùng được

| | |
|:---|:---|
| **Mức độ** | Medium · **Trạng thái: CÒN ĐÚNG** (mô tả cần sửa) |
| **Thực thể** | `hrm_nhan_vien`, `hrm_phong_ban` |
| **Ca kiểm thử** | TC-hrm-023, 050, 051 |

**Các bước tái hiện**: DB có `NV0001…NV0009`. Bắn đồng thời 2 `POST /nhan-vien` với `ma_nv` để trống.

**Mong đợi (ADR-001 §3)**: cả hai **201**, nhận `NV0010` và `NV0011`.
**Thực tế (suy từ code)**: cả hai tính ra `NV0010`; một request thắng, request kia vỡ ở khóa chính → Prisma `P2002` → **409 `Dữ liệu bị trùng`** — thông điệp **chung chung**, không nói mã nào, không hướng dẫn người dùng làm gì. Người nhập liệu chỉ biết bấm lại.

**Nguyên nhân gốc**
- `nhanVien.service.ts:176-192` — `sinhMaNhanVien` → `assertNotExists` → `create`, **không** transaction, **không** vòng lặp retry.
- `phongBan.service.ts:170-189` — **cùng lỗ hổng**, issue cũ bỏ sót.
- `errorHandler.plugin.ts:87-92` — ánh xạ `P2002` thành thông điệp chung `MESSAGES.COMMON.DUPLICATE_KEY`.
- `docs/hrm/architecture/adr/ADR-001-ma-tu-sinh-va-concurrency.md` §3 mô tả retry 3–5 lần **như đã có** — xem `BUG-HRM-15`.

**Đề xuất khắc phục**
1. Bọc `create` trong vòng lặp thử lại tối đa 5 lần, bắt riêng `P2002` (đúng như ADR-001 mô tả), áp cho **cả** nhân viên **và** phòng ban.
2. Bên trong vòng lặp phải **sinh lại mã** ở mỗi lượt (đọc lại DB), không dùng lại mã cũ.
3. Hết 5 lượt thì ném `ConflictError` có thông điệp người dùng hiểu được, không để rơi xuống `P2002`.
4. Ghi rõ **giới hạn đã biết** (số request đồng thời chịu được) vào ADR-001 sau khi đo thật ở Phase B.

---

### 🟡 ISSUE-HRM-03 — Xóa cứng hợp đồng, không guard, không dấu vết

| | |
|:---|:---|
| **Mức độ** | Medium · **Trạng thái: CÒN ĐÚNG một phần** |
| **Ca kiểm thử** | TC-hrm-056, 098 |

**Thực tế code**: `hopDong.service.ts:276-292` — `tx.hrm_hop_dong.delete({ where: { id } })`, không guard, không ghi log, không xóa mềm.

**Điểm cần đính chính so với bản cũ**: hiện **chưa có** phân hệ Payroll ở backend nên chưa thể "xóa nhầm hợp đồng đã phát sinh bảng lương". Rủi ro **có thật ngay hôm nay** là:
1. Mất vĩnh viễn lịch sử hợp đồng (là chứng từ lao động), không có bản ghi nào truy được ai xóa lúc nào (`BUG-HRM-18`).
2. Nếu hợp đồng bị xóa là **hợp đồng khoán** đã tắt `cong_doan`, cờ đó **không được bật lại** và cũng không có vết → hồ sơ nhân viên sai mà không giải thích được (`BUG-HRM-24`).

**Đề xuất**
- **Ngay**: bổ sung `writeLog` (hành động, `ma_nv`, `so_hd`, khoảng ngày, `userId`) trước khi xóa; cân nhắc đổi sang xóa mềm (`da_xoa`) cho `hrm_hop_dong` như hai bảng danh mục còn lại.
- **Khi có Payroll**: chặn xóa nếu hợp đồng đã nằm trong kỳ lương đã chốt, chỉ cho `POST /hop-dong/doi` để chốt sớm ngày kết thúc.

---

### 🟡 BUG-HRM-09 — `deletePhongBan` kiểm rồi ghi, hoàn toàn không có transaction

| | |
|:---|:---|
| **Mức độ** | Medium · **Ca kiểm thử**: TC-hrm-052 |

**Các bước**: `PB02` đang rỗng. Bắn đồng thời `DELETE /phong-ban/PB02` và `POST /nhan-vien` `{ …, "ma_pb":"PB02" }`.
**Mong đợi**: một trong hai thất bại.
**Thực tế (suy từ code)**: cả hai thành công → `PB02` có `da_xoa = true` nhưng vẫn có nhân viên trỏ vào. Nhân viên đó sẽ hiện `ten_pb = null` ở danh sách (`nhanVien.service.ts:109-125` chỉ lấy phòng ban `da_xoa:false`) mà không ai biết vì sao.

**Nguyên nhân gốc**: `phongBan.service.ts:239-267` — `Promise.all` ba lệnh `count` rồi `update`, **không nằm trong `db.$transaction`** (khác `hopDong.service`/`taiLieu.service` đều có). `ma_pb` là **tham chiếu mềm**, DB không có khóa ngoại để chặn.

**Đề xuất**: gói toàn bộ vào `db.$transaction` + khóa hàng phòng ban; hoặc thêm khóa ngoại thật `hrm_nhan_vien.ma_pb → hrm_phong_ban.ma_pb` (cần cân nhắc vì đang cố ý để mềm).

---

### 🟡 BUG-HRM-12 — `so_hd` không unique, không kiểm trùng ở bất kỳ tầng nào

| | |
|:---|:---|
| **Mức độ** | Medium · **Ca kiểm thử**: TC-hrm-099 |

**Bằng chứng**: `schema.prisma:964` khai `so_hd String @db.VarChar(100)`; `:989` chỉ có `@@index([ma_nv])` — **không** unique. `hopDong.validator.ts:34-38` chỉ kiểm độ dài. `hopDong.service.ts` không có `assertNotExists` nào cho `so_hd`.

**Hệ quả**: tạo hai hợp đồng cùng số `HĐLĐ-001/2026` cho cùng một nhân viên, hoặc cùng số cho hai nhân viên khác nhau — không có gì báo. Số hợp đồng là dữ liệu đối chiếu với hồ sơ BHXH và hợp đồng giấy.

**Đề xuất**: BA chốt phạm vi duy nhất (`unique(so_hd)` toàn tenant hay `unique(ma_nv, so_hd)`), rồi thêm ràng buộc DB + kiểm ở service để trả thông điệp rõ ràng.

---

### 🟡 BUG-HRM-13 — Thiếu kiểm tra liên trường về ngày và tiền

| | |
|:---|:---|
| **Mức độ** | Medium · **Ca kiểm thử**: TC-hrm-100, 101 |

| Thiếu kiểm | Bằng chứng | Hệ quả |
|:---|:---|:---|
| `hop_dong.ngay_bat_dau` có thể **trước** `nhan_vien.ngay_vao_lam` | Không có bất kỳ đối chiếu chéo nào trong `hopDong.service.ts:185-193` | Hợp đồng bắt đầu 2020 cho người vào làm 2026 — sai thâm niên, sai phép năm |
| `luong_bhxh` có thể **lớn hơn** `luong_chinh` | `hopDong.validator.ts:52-53` chỉ kiểm `>= 0` và ≤2 số lẻ | Mức đóng BHXH cao hơn lương thỏa thuận — vô lý về nghiệp vụ |
| `ngay_ket_thuc` không có trần trên | `primitives.ts:49-65` | Hợp đồng kết thúc năm 9999 |

**Đề xuất**: BA quyết từng rule (chặn cứng 400 / cảnh báo mềm / bỏ qua), rồi bổ sung `superRefine` ở validator (cho rule trong-một-request) và kiểm ở service (cho rule cần đọc bảng khác).

---

### 🟡 BUG-HRM-14 — `api-contract.md` sai lệch với hành vi thật

| | |
|:---|:---|
| **Mức độ** | Medium · **Ca kiểm thử**: TC-hrm-185 |

| # | Contract ghi | Code thật | Bằng chứng |
|:--:|:---|:---|:---|
| 1 | `POST` trả **"Response 200 OK"** (mục 2.2, 3.3, 4.2) | **201 Created** | `helpers/response.ts:8-10` (`HttpStatus.CREATED`) |
| 2 | Thân phản hồi là mảng/đối tượng **trần** (mục 2.1, 3.1, 4.1) | Luôn bọc `{ "success": true, "data": … }` | `helpers/response.ts:4-10` |
| 3 | Base URL `/api` | `/api/v1/hrm` | `routes/index.route.ts:48` |
| 4 | `DELETE /phong-ban` chỉ nêu lỗi 409 "còn nhân viên" | Còn một nhánh 409 nữa: "đang có N phòng ban trực thuộc" | `phongBan.service.ts:246-250` |
| 5 | `DELETE /tai-lieu/:id` "tự động xóa file trên Drive" | Không xóa (xem `BUG-HRM-10`) | `taiLieu.service.ts:124-135` |
| 6 | Không mô tả lỗi của `POST /hop-dong/doi` | Có 400 "Hợp đồng mới phải bắt đầu sau ngày chốt", 409 "phải chọn ngày chốt", 409 "Ngày chốt phải sau ngày bắt đầu" | `hopDong.validator.ts:105-111`, `hopDong.service.ts:246-258` |
| 7 | Không mô tả vỏ lỗi validate | `{ "success": false, "errors": { formErrors, fieldErrors } }` | `errorHandler.plugin.ts:24-28` |
| 8 | Không có Error Matrix / mã lỗi | Không có mã lỗi `E-hrm-NNN` nào trong code lẫn SRS | `constants/messages.ts:114-141` chỉ có thông điệp chữ |

**Đề xuất**: Architect cập nhật `api-contract.md`; BA bổ sung Error Matrix (`E-hrm-NNN`) vào `hrm-spec.md` theo `.claude/rules/naming-conventions.md`. **Đây là việc chặn**: FE và bộ test tự động đều bám vào contract này.

---

### 🟡 BUG-HRM-15 — ADR mô tả cơ chế chưa tồn tại như thể đã triển khai

| | |
|:---|:---|
| **Mức độ** | Medium |

| ADR | Câu khẳng định | Thực tế code |
|:---|:---|:---|
| `ADR-001` §3 "Chiến lược phòng chống xung đột (Retry-on-conflict)": *"hệ thống bắt mã lỗi `P2002` của Prisma và **tự động thử lại** (retry 3-5 lần)"* | `nhanVien.service.ts:170-194` và `phongBan.service.ts:160-191` — **không có** `try/catch`, không có vòng lặp nào |
| `ADR-002` §3 "Chống chồng lấn thời gian hợp đồng": *"**Trước khi tạo** (`createHopDong`) hoặc cập nhật (`updateHopDong`), **hệ thống kiểm tra** khoảng thời gian… không được giao cắt"* | `hopDong.service.ts:185-218` — **không có** bước kiểm nào |

**Vì sao đây là bug**: ADR là tài liệu mà mọi agent phía sau (Backend, Frontend, QA, Code Reviewer) đọc để **giả định** hành vi. Ở đúng đợt rà soát 3 Amigos này, ADR-002 khiến cả Architect lẫn QA dễ tick "đã có chống chồng lấn" và bỏ qua ISSUE-HRM-01.

**Đề xuất**: Architect chuyển hai mục đó sang thì tương lai/trạng thái `Đề xuất — chưa triển khai`, hoặc bổ sung mục "Trạng thái triển khai" vào mẫu ADR, hoặc triển khai code cho khớp. **Không được để nguyên như hiện tại.**

---

### 🟡 BUG-HRM-16 — Hai upload đồng thời cùng một tài liệu tạo file mồ côi

| | |
|:---|:---|
| **Mức độ** | Medium · **Ca kiểm thử**: TC-hrm-149 |

**Các bước**: tài liệu `T1` đã có `drive_file_id = "OLD"`. Bắn đồng thời 2 `POST /tai-lieu/T1/file` với file A và file B.

**Thực tế (suy từ code)**: cả hai đọc `tl.drive_file_id = "OLD"` (`taiLieuDrive.service.ts:320`), cả hai upload (Drive có A và B), cả hai xóa `OLD`, rồi cả hai `update` DB — DB giữ **một** trong hai, file còn lại **mồ côi** trên Drive.

**Nguyên nhân gốc**: `taiLieuDrive.service.ts:314-368` — đọc → gọi dịch vụ ngoài → ghi, **không transaction, không khóa**. (Ghi nhận: `taoThuMucNeuChua` **đã** có hàng đợi trong tiến trình cho thư mục — `driveClient.ts:233-256` — nhưng bước gắn file thì không.)

**Đề xuất**: khóa theo `tai_lieu.id` (cùng kiểu hàng đợi đã dùng cho thư mục), hoặc cập nhật DB có điều kiện (`updateMany where drive_file_id = <giá trị đã đọc>`), và nếu không cập nhật được dòng nào thì xóa file vừa tải lên.

---

### 🟡 BUG-HRM-17 — Thiếu rate-limit riêng cho endpoint file

| | |
|:---|:---|
| **Mức độ** | Medium · **Ca kiểm thử**: TC-hrm-184 |

**Bằng chứng**: `app.ts:60` đặt rate-limit toàn cục `max: 300, timeWindow: '1 minute'`; `constants/rateLimits.ts:9` có sẵn preset chặt (`max: 5`) nhưng chỉ được dùng ở `routes/auth.route.ts`. `routes/hrm/taiLieu.route.ts:36-38` khai 3 route file **không có** `config.rateLimit`.

**Hệ quả**
1. Một IP có thể đẩy tới **300 × 10MB = 3GB/phút** vào máy chủ (Windows Server + PM2).
2. Mỗi upload tốn 2–4 lượt gọi Google. `driveClient.ts:226-229` đã ghi rõ **mọi tenant dùng chung một OAuth client** → một tenant tải file ồ ạt có thể đẩy hạn mức chung sang **429**, làm hỏng tính năng Drive của **tất cả** khách hàng.
3. `GET /tai-lieu/:id/file` đọc trọn file vào RAM (`driveClient.ts:411-423`) → 300 lượt đồng thời × ~10MB là áp lực bộ nhớ thật.

**Đề xuất**: thêm preset riêng cho `POST /tai-lieu/:id/file` (gợi ý 10–20 lượt/phút/người dùng) và cho `GET /tai-lieu/:id/file`; cân nhắc stream thẳng thay vì nạp trọn buffer.

---

### 🟡 BUG-HRM-18 — HRM không ghi nhật ký thao tác nào

| | |
|:---|:---|
| **Mức độ** | Medium |

**Bằng chứng**: `grep -rn "writeLog" be_maxv/src/services/client/hrm be_maxv/src/controllers/client/hrm` → **0 kết quả**. Trong khi `writeLog` (`services/shared/syslog.service.ts:15-23`) đang được dùng ở `services/admin/adminCompany|adminInvite|adminSubscription|adminUser`, `services/client/auth.service.ts`, `services/client/company.service.ts`.

**Thao tác đang không có dấu vết**: xóa cứng hợp đồng · xóa cứng người phụ thuộc · xóa cứng tài liệu · xóa mềm nhân viên/phòng ban · **nối và ngắt Google Drive của công ty** (thao tác chuyển kho tài liệu của toàn doanh nghiệp) · đổi hợp đồng.

**Đề xuất**: bổ sung `writeLog` cho tối thiểu 6 thao tác trên, kèm `donViId`, `userId` và đủ chi tiết để đối soát (`ma_nv`, `so_hd`, `driveEmail` cũ/mới). Ưu tiên cao nhất: **nối/ngắt Drive** — đó là dữ liệu cần khi tra "vì sao hồ sơ scan của công ty nằm ở Gmail của ai đó" (`BUG-HRM-11`).

---

### 🔵 ISSUE-HRM-04 — Frontend thiếu badge "Chưa có hợp đồng" *(ghi sai app)*

| | |
|:---|:---|
| **Mức độ** | Low · **Trạng thái: nội dung đúng, vị trí GHI SAI** |

**Đính chính**: app đúng là **`hdđt_maxv`**, không phải `fe_maxv`.
**Bằng chứng**: `hdđt_maxv/src/features/hrm/components/nhan_vien/NhanVienTable.tsx:169` (cột "Hợp đồng"), `:201-203` (`{nv.hop_dong?.so_hd ?? "—"}`). Thư mục `fe_maxv/src/features/` không có `hrm`.

**Đề xuất**: hiển thị `Chip` màu cảnh báo `Chưa có HĐ` thay cho `—` khi `nv.hop_dong == null`; cân nhắc thêm bộ lọc "Nhân viên chưa có hợp đồng" — chính BR-03.1 cho phép tạo nhân viên trước khi ký hợp đồng, nên danh sách này là **việc cần theo dõi thường xuyên** của HR, không phải trường hợp hiếm.

---

### 🔵 BUG-HRM-19 — Nhánh dự phòng sinh mã bằng timestamp

| | |
|:---|:---|
| **Mức độ** | Low · **Ca kiểm thử**: TC-hrm-024 (+ ca thủ công) |

**Bằng chứng**
- `phongBan.service.ts:57-58` — hết 99 số cùng cấp thì trả `${tienTo}${Date.now().toString().slice(-4)}`, ví dụ `PB1234`. **Không** đối chiếu với `daDung` ⇒ có thể trùng ⇒ 409. Mã sinh ra **phá định dạng `PBxx` / `PBxx.yy`** của BR-01.1, và lần sinh mã gốc kế tiếp vẫn rơi vào nhánh dự phòng (vì `PB01…PB99` vẫn đầy).
- `nhanVien.service.ts:65-72` — vượt 9999 thì `NV` + 6 số cuối timestamp, cũng **không** kiểm trùng.

**Đề xuất**: kiểm trùng trong nhánh dự phòng (lặp tăng dần cho tới khi trống); và BA chốt định dạng mã ở mức tràn (mở rộng lên `PBxxx` / `NVxxxxx` sẽ nhất quán hơn timestamp).

---

### 🔵 BUG-HRM-20 — Frontend bịa dữ liệu hợp đồng trong `hopDongTuApi`

| | |
|:---|:---|
| **Mức độ** | Low (bẫy hồi quy) |

**Bằng chứng**: `hdđt_maxv/src/features/hrm/api/nhanVienQueries.ts:123-137` dựng đối tượng `HopDong` với `ngay_bat_dau: veNgayInput(r.ngay_vao_lam)` (**lấy ngày vào làm của nhân viên làm ngày bắt đầu hợp đồng** — hai khái niệm khác hẳn nhau, chính schema `schema.prisma:873` nhấn mạnh `ngay_vao_lam` KHÔNG đổi khi ký hợp đồng mới) và `luong_chinh: 0, luong_bhxh: 0`.

**Hiện tại vô hại**: chỉ `so_hd` và `kieu_luong` được đọc (`NhanVienTable.tsx:201-206`), và có ghi chú cảnh báo ở `nhanVienQueries.ts:~83`.
**Rủi ro**: bất kỳ component nào sau này đọc `row.hop_dong.ngay_bat_dau` hoặc `.luong_chinh` sẽ **hiển thị sai mà không có lỗi nào**.

**Đề xuất**: đổi kiểu trả về thành một type hẹp (`{ so_hd, kieu_luong }`) thay vì `HopDong` đầy đủ — để TypeScript chặn ngay tại chỗ dùng sai, thay vì dựa vào ghi chú.

---

### 🔵 BUG-HRM-21 — `so_nv` không cộng dồn cây con, lệch với guard xóa

| | |
|:---|:---|
| **Mức độ** | Low (cần BA chốt) · **Ca kiểm thử**: TC-hrm-004, 005, 006, 020 |

**Hai định nghĩa khác nhau đang cùng tồn tại**
- Cột `so_nv` ở danh sách: đếm nhân viên `da_xoa=false` **và** `status='1'`, **chỉ trực thuộc trực tiếp** (`phongBan.service.ts:138-142`).
- Guard lúc xóa: đếm nhân viên `da_xoa=false` **bất kể** `status` (`phongBan.service.ts:241`).

**Hệ quả cho người dùng**: phòng ban hiện `so_nv = 0` nhưng bấm Xóa lại báo "đang có 1 nhân viên (0 đang làm, 1 đã nghỉ)". Code đã cố tình soạn thông điệp giải thích chuyện này (`:252-258`) — tức là tác giả biết trải nghiệm bị gợn nhưng chọn cách vá bằng câu chữ.

**Câu hỏi cho BA**: (a) `so_nv` có nên cộng dồn cây con không (công ty mẹ nhìn tổng quân số)? (b) Có nên hiện thêm cột "Đã nghỉ" để người dùng đoán trước được việc bị chặn?

---

### 🔵 BUG-HRM-22 — Đường sinh tham chiếu treo `ma_pb` + không có khôi phục

| | |
|:---|:---|
| **Mức độ** | Low |

**Kịch bản**: `NV0001` thuộc `PB01` → xóa mềm `NV0001` (`da_xoa=true`) → guard xóa `PB01` chỉ đếm `da_xoa:false` (`phongBan.service.ts:241`) → đếm được 0 → `PB01` bị xóa mềm. Giờ `NV0001` (vẫn còn trong DB, còn dùng cho quyết toán thuế) trỏ vào một phòng ban không còn tồn tại.

Ngoài ra **không có endpoint nào khôi phục** bản ghi đã xóa mềm (`da_xoa` chỉ được đặt `true`, không bao giờ về `false` trong toàn bộ mã HRM) ⇒ xóa nhầm là phải can thiệp thẳng DB.

**Đề xuất**: BA quyết có cần chức năng "Khôi phục" không; nếu có thì guard xóa phòng ban phải tính cả nhân viên đã xóa mềm, hoặc thao tác khôi phục phải kiểm phòng ban còn sống.

---

### 🔵 BUG-HRM-23 — Thiếu ngưỡng hợp lý cho ngày sinh; cho gán vào phòng ban ngừng hoạt động

| | |
|:---|:---|
| **Mức độ** | Low · **Ca kiểm thử**: TC-hrm-039, 117 |

- `ngay_sinh` nhân viên dùng `ngayTuyChon` (`primitives.ts:68-76`) — chỉ kiểm "ngày có thật", nên `1800-01-01` và `2099-12-31` đều lọt.
- `ngay_sinh` người phụ thuộc dùng `ngaySinhVn` (`nguoiPhuThuoc.validator.ts:20-48`) — cũng chỉ kiểm ngày có thật; `01/01/2999` lọt.
- `assertPhongBanTonTai` (`nhanVien.service.ts:80-92`) chỉ lọc `da_xoa:false`, **không** xét `status` ⇒ gán được nhân viên vào phòng ban đang "ngừng hoạt động".

**Đề xuất**: BA chốt khoảng hợp lệ (gợi ý: nhân viên từ 15 tuổi trở lên, ngày sinh không ở tương lai) và quyết có chặn phòng ban `status='0'` hay không.

---

### 🔵 BUG-HRM-24 — Cờ `cong_doan` một chiều: không có vết, không đảo lại được

| | |
|:---|:---|
| **Mức độ** | Low · **Ca kiểm thử**: TC-hrm-098 |

`apDungLuatCongDoan` (`hopDong.service.ts:161-167`) đặt `cong_doan = false` khi ký hợp đồng khoán và **cố ý không bật lại** khi rời khỏi khoán. Kết hợp với việc xóa cứng hợp đồng (`ISSUE-HRM-03`) và không có nhật ký (`BUG-HRM-18`): nếu kế toán nhập nhầm loại `khoan` rồi xóa hợp đồng đó đi, cờ `cong_doan` **vẫn ở `false`** vĩnh viễn, không ai biết vì sao và không có gì để lần lại.

**Đề xuất**: khi thao tác này chạy, hiển thị cảnh báo ở FE ("Ký hợp đồng khoán sẽ tắt chế độ công đoàn của nhân viên") và ghi `writeLog`. Cho phép người dùng bật lại thủ công ở form nhân viên (hiện `PUT /nhan-vien` đã cho phép — cần FE lộ ra ô này).

---

## 4. CÂU HỎI MỞ CẦN CHỐT Ở CỔNG BA FINAL SIGN-OFF

> ⚠️ **Mục này viết TRƯỚC đợt chốt nghiệp vụ 2026-09-07 và đã lỗi thời.** OQ-01…OQ-04 đã được chốt thành QĐ #7, #1+#6, #10, #12. Danh sách câu hỏi mở **còn hiệu lực** nay nằm ở `docs/hrm/srs/hrm-spec.md` Mục 15.1 và 15.1b (OQ-hrm-09, 11…33). Giữ mục này làm dấu vết lịch sử, **không dùng để ra quyết định**.

| # | Câu hỏi | Ảnh hưởng nếu không chốt | Người chốt |
|:--:|:---|:---|:---|
| OQ-01 | Người phụ thuộc trùng MST giữa **hai nhân viên** có được phép không? Có ngoại lệ khi kỳ đăng ký không giao nhau? | Không viết được ràng buộc đúng cho `BUG-HRM-05` (Critical) | BA |
| OQ-02 | Định nghĩa **chính xác** "hợp đồng chồng lấn": hai hợp đồng vô thời hạn liền kề có hợp lệ không? Hợp đồng thử việc và hợp đồng chính thức có được phép trùng ngày không? | Không viết được `assertKhongChongLanHopDong` (BR-03.3) | BA + Architect |
| OQ-03 | Ai được nối Google Drive **lần đầu** cho công ty? | `BUG-HRM-11` — mâu thuẫn BR-05.1, chưa chốt kỳ vọng cho TC-hrm-153 | BA (Architect tư vấn) |
| OQ-04 | `DELETE /tai-lieu/:id` **có** xóa file Drive hay không? (sửa code hay sửa tài liệu?) | `BUG-HRM-10` — không chốt được kỳ vọng TC-hrm-127 | BA + Architect |
| OQ-05 | `so_hd` duy nhất trong phạm vi nào (toàn tenant / theo nhân viên / không cần)? | `BUG-HRM-12` | BA |
| OQ-06 | Hợp đồng có được bắt đầu **trước** `ngay_vao_lam` không? `luong_bhxh` có được lớn hơn `luong_chinh` không? | `BUG-HRM-13` | BA |
| OQ-07 | `so_nv` có cộng dồn cây con không? Độ sâu tối đa của cây phòng ban là bao nhiêu? | `BUG-HRM-21`, TC-hrm-024 | BA |
| OQ-08 | Có cần chức năng **khôi phục** bản ghi đã xóa mềm không? | `BUG-HRM-22` | BA |
| OQ-09 | Xóa mềm nhân viên thì file scan trên Drive xử lý ra sao (giữ / gỡ / lưu bao lâu)? | TC-hrm-128 — liên quan bảo vệ dữ liệu cá nhân | BA |
| OQ-10 | Định dạng mã khi tràn (>99 phòng ban con, >9999 nhân viên): timestamp hay mở rộng số? | `BUG-HRM-19` | BA + Architect |
| OQ-11 | **Đánh lại ID theo chuẩn** `BR-hrm-NNN` / `FR-hrm-NNN` / `E-hrm-NNN` và bổ sung **Error Matrix** vào `hrm-spec.md`? | Ma trận truy vết hiện phải bám ID phi chuẩn (`BR-01.1`), khó tự động đối soát | BA |
| OQ-12 | Mức độ cô lập giao dịch và chiến lược khóa cho các đường ghi HRM (khóa hàng / `EXCLUDE` / `Serializable`)? | `BUG-HRM-08`, `BUG-HRM-09`, `ISSUE-HRM-02` | Architect |
| OQ-13 | Có bổ sung Error Code cho mọi lỗi nghiệp vụ HRM để FE và test bám vào, thay vì so khớp chuỗi tiếng Việt? | Test hiện phải so khớp thông điệp — rất dễ vỡ khi sửa câu chữ | BA + Architect |

---

## 5. KẾ HOẠCH HÀNH ĐỘNG ƯU TIÊN

### Sprint 0 — ✅ ĐÃ XONG (2026-09-07)

| # | Việc | Kết quả |
|:--:|:---|:---|
| 1 | Trả lời OQ-01…04 | ✅ Đã chốt thành QĐ #7, #1+#6, #10, #12 — xem `CONTEXT_SUMMARY.md` Mục 6.1 |
| 2 | Sửa `api-contract.md` cho khớp mã | ✅ Đã sửa |
| 3 | Đánh dấu rõ "chưa triển khai" ở ADR-001 và ADR-002 | ✅ Đã sửa |
| 4 | Bổ sung ma trận lỗi `E-hrm-NNN` và đánh lại ID `BR-hrm-NNN` | ✅ Đã xong — spec nay có BR-hrm-001…068, E-hrm-001…064 |
| 5 | Chốt chiến lược khóa và cô lập giao dịch | ⚠️ Một phần — xem `data-model.md` Mục 9 và cảnh báo thứ tự khóa ở Mục 7 dưới đây |

### Sprint 0b — CHẶN sign-off, phát sinh từ vòng phản biện 2026-09-07

| # | Việc | Chủ trì | Liên quan |
|:--:|:---|:---|:---|
| 1 | Trả lời **OQ-hrm-16** (mặc định quyền xem lương) và **OQ-hrm-18** (khác loại theo nhãn gốc hay theo nhóm) | Chủ tài khoản, kế toán trưởng | 🔴 Chặn QĐ #8 và QĐ #1 · BUG-HRM-27 |
| 2 | Trả lời **OQ-hrm-27** (người phụ thuộc chuyển giữa hai nhân viên) và giải mâu thuẫn M-09 | Kế toán trưởng, Architect | 🔴 Chặn QĐ #7 · BUG-HRM-05 |
| 3 | Trả lời **OQ-hrm-33** (có làm đợt đổi tên đường dẫn API không) | Chủ dự án, Architect | 🔴 Chặn khởi chạy Backend · BUG-HRM-32 |
| 4 | Triển khai đường **cấp/thu hồi quyền xem lương** (M-13 + FR-hrm-044) cùng lượt với việc đổi cách ghi phân quyền | Architect, Backend | 🔴 BUG-HRM-28 |
| 5 | Đo thật: `prisma db push` có xóa ràng buộc tạo tay không | Backend | 🔴 Quyết định lớp phòng thủ của ADR-002 |
| 6 | Dựng **một file test HRM mẫu** kèm mẫu giả lập đồng hồ và mẫu giả lập gọi Google | QA, Backend | Không có mẫu thì 73 ca vẫn thuần giấy |

### Sprint 1 — Sửa lỗi nghiệp vụ cốt lõi (Critical + High)

| # | Việc | Bug |
|:--:|:---|:---|
| 1 | Chặn trùng MST người phụ thuộc trên **toàn tenant** (service + ràng buộc DB) | BUG-HRM-05 |
| 2 | `assertKhongChongLanHopDong` cho **cả 3** đường ghi + ràng buộc `EXCLUDE` ở DB + script dọn dữ liệu cũ | ISSUE-HRM-01, BUG-HRM-06 |
| 3 | Thay mốc UTC bằng `homNayVN()` và dùng chung `sapXepHopDong` trong `doiHopDong` | BUG-HRM-07 |
| 4 | Khóa hàng nhân viên trong transaction đổi hợp đồng | BUG-HRM-08 |
| 5 | Xử lý file Drive khi xóa tài liệu (theo phán quyết OQ-04) + tác vụ dọn file mồ côi | BUG-HRM-10 |
| 6 | Siết quyền nối Drive lần đầu (theo phán quyết OQ-03) + ghi nhật ký ai nối, email nào | BUG-HRM-11, 18 |

### Sprint 2 — Độ bền và vận hành (Medium)

Retry-on-conflict cho sinh mã (`ISSUE-HRM-02`) · transaction cho `deletePhongBan` (`BUG-HRM-09`) · duy nhất `so_hd` (`BUG-HRM-12`) · kiểm liên trường ngày/tiền (`BUG-HRM-13`) · khóa upload theo tài liệu (`BUG-HRM-16`) · rate-limit riêng cho endpoint file (`BUG-HRM-17`) · nhật ký cho thao tác phá hủy (`BUG-HRM-18`) · nhật ký + cân nhắc xóa mềm hợp đồng (`ISSUE-HRM-03`).

### Sprint 3 — Trải nghiệm và chất lượng dữ liệu (Low)

Badge "Chưa có HĐ" ở `hdđt_maxv` (`ISSUE-HRM-04`) · sinh mã tràn (`BUG-HRM-19`) · thu hẹp kiểu `hopDongTuApi` (`BUG-HRM-20`) · làm rõ `so_nv` (`BUG-HRM-21`) · khôi phục bản ghi (`BUG-HRM-22`) · ngưỡng ngày sinh + phòng ban ngừng hoạt động (`BUG-HRM-23`) · cảnh báo cờ công đoàn (`BUG-HRM-24`).

---

## 7. VÒNG PHẢN BIỆN ĐỘC LẬP (2026-09-07, sau khi chốt 16/16 quyết định)

> **Vì sao có mục này.** Bộ tài liệu sau đợt chốt nghiệp vụ được **một người viết tuần tự cả ba tầng** (BA → Architect → QA) rồi tự đối soát. Tự soát bài của mình bắt được 4 lỗi, nhưng bỏ sót phần lớn những gì dưới đây. Vòng này chạy **hai người rà độc lập** (Architect và Tester-QA, mỗi bên không đọc kết quả của bên kia, cùng đối chiếu tài liệu với mã nguồn thật), rồi mọi khẳng định nặng được kiểm chứng lại lần nữa trước khi ghi vào đây.
>
> **Bài học quy trình:** không được gộp ba vai vào một lượt viết. Cổng Phase A tồn tại chính vì lý do này.

### 7.1 Bug mới phát hiện

| Mã | Mức | Vùng | Mô tả | Trạng thái |
|:---|:---:|:---|:---|:---|
| **BUG-HRM-26** | 🟠 High | Nhân viên / API | **Yêu cầu sửa nhân viên thiếu `status` sẽ âm thầm đưa người đã nghỉ trở lại đang làm.** `nhanVienUpdateSchema` kế thừa `status: z.enum(['0','1']).default('1')` (`nhanVien.validator.ts:74`, schema sửa ở `:89-92`). Trớ trêu: docblock ngay bên cạnh giải thích **đúng** cái bẫy này cho `mien_cham_cong`/`cong_doan` nhưng không áp cho `status`. Sau QĐ #3 thì nguy hiểm thật: ngày nghỉ và các hợp đồng đã bị chốt vẫn nằm nguyên trong khi người đó lại "đang làm" — chính là nhánh ngược mà OQ-hrm-12 tuyên bố chưa chốt, nhưng **đang đi được ngay hôm nay** | Mới — đã có BR-hrm-067 và TC-hrm-255 |
| **BUG-HRM-27** | 🟠 High | Hợp đồng / ràng buộc | **Ràng buộc chống chồng lấn khóa trên `loai_hd` thô sẽ không bảo vệ được nghiệp vụ.** `loai_hd` là chữ tự do `VarChar(24)`, validator chỉ cắt khoảng trắng, **không** in hoa (khác `ma_nv` và `ma_pb` đều được in hoa) ⇒ `khoan`, `Khoan`, `KHOAN` là ba khóa khác nhau. Nặng hơn: `loaiHdVeNhanVien()` gom `khong_xac_dinh` + `xac_dinh` + `thoi_vu` về **cùng một nhóm hợp đồng lao động** — nên khóa theo nhãn gốc cho phép một người có **ba hợp đồng lao động chồng nhau**, mỗi cái một nhãn. Đúng thứ BR-hrm-022 sinh ra để chặn, và phân hệ Lương sẽ cộng ba mức lương | Mới — chờ chốt OQ-hrm-18 và OQ-hrm-19 |
| **BUG-HRM-28** | 🟠 High | Phân quyền | **Cách cấp quyền hiện tại sẽ xóa sạch quyền xem lương mỗi lần chủ tài khoản sửa danh sách công ty.** `setEmployeeAccess` (`company.service.ts:384-394`) là replace-set: xóa toàn bộ bản ghi phân quyền của nhân viên rồi tạo lại. Thêm cờ quyền lương vào bảng đó mà giữ nguyên cách ghi thì mất quyền âm thầm, không lỗi, không nhật ký | Mới (lỗi tương lai) — đã ghi vào `data-model.md` M-13 và `ADR-007`, có TC-hrm-258 |
| **BUG-HRM-29** | 🟡 Medium | Tài liệu | **Tên cơ sở dữ liệu tenant sai trong toàn bộ tài liệu.** Tài liệu ghi `maxv2_<MST>_app`; hàm thật trả `maxv_<MST>_app` (`utils/dbName.ts:16`). Runbook migration trỏ vào cơ sở dữ liệu không tồn tại. Bản trước còn tự nhận là "đang sửa sai" rồi sửa từ sai này sang sai khác | ✅ **Đã sửa** 16 chỗ trong 7 file. Còn nợ: comment lỗi thời `prisma/sys/schema.prisma:108` (thuộc mã nguồn, xem M-08) |
| **BUG-HRM-30** | 🟡 Medium | Tài liệu / vận hành | **Kế hoạch migration dựa trên cơ chế không tồn tại.** Tài liệu bảo dùng `prisma migrate --create-only` rồi chèn SQL tay; thực tế `prisma/tenant/` **không có thư mục `migrations/`** — tenant đồng bộ bằng `prisma db push --accept-data-loss`. Kèm hai hệ quả chưa ai lường: tenant **mới cấp** sẽ không có ràng buộc nào, và chưa ai đo xem `db push` có xóa ràng buộc tạo tay hay không | ✅ **Đã sửa** — viết lại `data-model.md` Mục 8.0 theo cơ chế thật |
| **BUG-HRM-31** | 🟡 Medium | Tài liệu | **Trích dẫn `file:line` bịa.** `taiLieu.service.ts` có **136 dòng** nhưng bị trích ở `:291-303`, `:222-224`, `:258-261`… — cả cụm lệch đều khoảng 165 dòng, tức chép từ một bản file khác chứ không phải đọc file hiện tại. `taiLieu.route.ts` có 39 dòng, bị trích `:40-49` và dùng làm bằng chứng cho một alias **không tồn tại** | ✅ **Đã sửa** 15 chỗ trong 6 file |
| **BUG-HRM-32** | 🟠 High | Contract / đồng bộ | **Đợt đổi tên đường dẫn API sang tiếng Anh chỉ tồn tại trong đúng một tài liệu.** `api-contract.md` dùng đường tiếng Anh; mã nguồn, giao diện, đặc tả, bộ ca kiểm thử, `dev-notes.md` và `CONTEXT_SUMMARY.md` đều vẫn tiếng Việt. Contract còn ghi "giữ alias cũ cho callback OAuth" — sai, không có alias nào. Kỹ sư code theo contract trong khi test và giao diện dùng đường cũ thì cả ba lệch nhau | ✅ Đã gắn cảnh báo trạng thái vào contract Mục 1.8 — **chờ chốt OQ-hrm-33** |

**Tổng sau vòng này: 32 mục** — 2 Critical · 10 High · 13 Medium · 7 Low.

### 7.2 Khoảng trống bao phủ kiểm thử

| # | Khoảng trống | Trạng thái |
|:--:|:---|:---|
| 1 | **QĐ #7 (Critical, sai thuế TNCN) không có ca kiểm thử mới nào.** Bộ ca bổ sung phủ 12 quyết định nhưng thiếu đúng #7; ca duy nhất chạm nghiệp vụ này nằm trong nhóm cũ đã bị tuyên bố lỗi thời | ✅ **Đã bổ sung** nhóm 6B.11 (TC-hrm-246…251) |
| 2 | **Ba mã lỗi kỹ thuật dùng chung `E-hrm-062/063/064` không có ca nào** — vừa được cấp mã ở đợt này xong lại không ai viết ca | ✅ **Đã bổ sung** nhóm 6B.12 (TC-hrm-252…254) |
| 3 | **`test-cases.md` có 0 tham chiếu `AC-hrm-*`** ⇒ điều kiện cứng "mọi tiêu chí nghiệm thu đều có ca kiểm thử" của cổng sign-off **không kiểm chứng được từ tài liệu** | ⚠️ Ba nhóm mới (6B.11–6B.13) đã có cột `AC / BR`. **Còn nợ: bổ sung cột này cho 6B.1–6B.10** |
| 4 | Một số tiêu chí nghiệm thu mới chỉ phủ một phần: AC-hrm-45 (thiếu hai trường lương), AC-hrm-50 (thiếu vế ẩn phòng ban khác), AC-hrm-54 (thiếu vế giấy tờ không có hạn), AC-hrm-55 (chỉ phủ đường tạo, thiếu đường sửa) | ⚠️ Còn nợ |
| 5 | Ba ca tự khai "ghi nhận hành vi thật, không so ngưỡng" (TC-hrm-200, 243, 245) nhưng vẫn nằm trong bộ ca có tiêu chí ra "100% P0/P1 PASS" — tiêu chí ra hiện **không đạt được về mặt logic** | ⚠️ Còn nợ: tách ca đo đạc khỏi bộ ca, viết lại tiêu chí ra |
| 6 | TC-hrm-215 kỳ vọng `ADMIN` nhận 403 ở **mọi** endpoint HRM, nhưng `GET /tai-lieu/drive/callback` khai `khongCanAuth` (`taiLieu.route.ts:29-33`) nên sẽ **FAIL nhầm** | ⚠️ Còn nợ: thêm vế trừ |

### 7.3 Rào cản thực thi Phase B — chưa có hạ tầng

| Nhóm ca | Cần gì | Hiện trạng |
|:---|:---|:---|
| TC-hrm-211…216, 256…258 (quyền xem lương) | Cơ chế cấp/thu hồi quyền để dựng hai tài khoản có và không có quyền | ✅ Đã chốt thiết kế (M-13, FR-hrm-044) — **chưa triển khai** |
| Nhóm Drive (~32 ca) + TC-hrm-224, 225 | Giả lập `fetch` tới Google | ❌ Không có test nào trong 41 file hiện có làm việc này |
| TC-hrm-208 và mọi ca phụ thuộc "hôm nay" | Đồng hồ giả lập | ⚠️ `node:test` có `mock.timers` phủ được cả `Date.now()` lẫn `new Date()`, nhưng **chưa có mẫu nào trong repo**. Ngoài ra danh sách ca cần giả lập đồng hồ đang **nói khác nhau ở ba chỗ** |
| TC-hrm-209, 210 (đồng thời) | Ràng buộc loại trừ đã tồn tại trên cơ sở dữ liệu | ❌ Chưa có — phải xong M-01 trước |
| TC-hrm-216, 219, 222, 223, 226 (giao diện) | Bất kỳ bộ chạy test nào ở frontend | ❌ **Cả ba ứng dụng giao diện đều không có** — chỉ chạy tay được |
| TC-hrm-238 | Đếm số câu truy vấn + dữ liệu mẫu 500 nhân viên | ❌ Chưa có |
| Toàn bộ | **Một file test HRM mẫu để nhân bản** | ❌ `be_maxv/src/__tests__/` có 41 file, **0 file HRM** |

### 7.4 Điều đã kiểm và xác nhận là ĐÚNG

Ghi lại để vòng sau khỏi soát lại:

* **Cô lập đa doanh nghiệp vẫn không có đường rò.** 16 quyết định mới không đụng `resolveTenantDb` hay phạm vi truy cập; kết luận cũ giữ nguyên.
* **`daterange(..., '[]')` chạy đúng trên PostgreSQL 18** với cả `infinity` lẫn hợp đồng một ngày — QĐ #6 an toàn với ràng buộc loại trừ. `btree_gist` có sẵn để cài, chỉ là chưa cài ở tenant nào.
* **Hai ca kiểm thử giá trị nhất của bộ mới**: TC-hrm-202 (hợp đồng một ngày chồng chính nó — ca duy nhất phân biệt được khoảng đóng với khoảng nửa mở) và TC-hrm-207 (đổi hợp đồng khoán không được chốt nhầm hợp đồng chính). Rủi ro của cả hai đã xác nhận có thật trong mã.
* **Quyết định không thêm cột `ho_so_du`** vào bảng nhân viên là đúng — nhất quán với bài học 7 cột bản sao hợp đồng đã bị xóa.
* **Xử lý xung đột mã lỗi `E-hrm-052/053/054` đã dứt điểm** — không còn chỗ nào trong tài liệu dùng ba mã đó theo nghĩa kỹ thuật.
* **Hai lỗi giao diện cũ vẫn còn nguyên**: gọi lịch sử hợp đồng không tham số rồi lọc phía trình duyệt (BUG-HRM-25), và đọc sai tên trường số người phụ thuộc bị ẩn (ĐS-04).

---

---

## 10. ĐỢT VÁ LỖI CHẶN + CHẠY CƠ SỞ DỮ LIỆU (2026-09-07, sau Phase B)

### 10.1. Hai lỗi chặn đã đóng

| Mã | Cách sửa | Bằng chứng |
|:---|:---|:---|
| **BUG-HRM-33** ✅ **ĐÓNG** | `hrmTenantConstraints.ts` gỡ khóa cũ bằng **cả hai nhánh**: `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` rồi `DROP INDEX IF EXISTS`. Thứ tự bắt buộc — `DROP INDEX` không gỡ được index do constraint sở hữu (2BP01), còn `DROP CONSTRAINT` không gỡ được index thuần. Runbook `dev-notes.md` Mục 1.3b bổ sung bước `sync:tenants` còn thiếu | Chạy thật trên tenant `maxv_0108768608_app`: `SELECT count(*) FROM pg_indexes WHERE indexname='hrm_nguoi_phu_thuoc_ma_nv_mst_key'` → **0**, khóa cũ **đã gỡ** |
| **BUG-HRM-34** ✅ **ĐÓNG** | Hai đường ghi người phụ thuộc bọc `db.$transaction`, kiểm và ghi cùng một giao dịch, theo đúng mẫu của `createHopDong`. Thêm alias `type Db = PrismaClient \| Prisma.TransactionClient` cho hai hàm kiểm | `nguoiPhuThuoc.service.ts` — `createNguoiPhuThuoc`, `updateNguoiPhuThuoc`. `npm run typecheck` exit 0 |

### 10.2. Lỗi MỚI phát hiện khi chạy thật

| Mã | Mức | Nội dung | Trạng thái |
|:---|:---:|:---|:---|
| **BUG-HRM-42** | 🟠 High | **Script áp ràng buộc KHÔNG idempotent.** Bản đầu chỉ bắt SQLSTATE `42710` (`duplicate_object`), nhưng `EXCLUDE` và `UNIQUE` đều tạo **index nền**, nên chạy lần hai Postgres báo `42P07` (`duplicate_table`) — `relation "hrm_hop_dong_khong_chong_lan" already exists`. Đo thật: lần chạy thứ hai **fail cả 10/10 tenant**. Chặn thật, vì chính runbook yêu cầu chạy lại script sau **mỗi** lần `sync:tenants` | ✅ **ĐÓNG** — bắt thêm `42P07`. Chạy lại lần ba: **10/10 tenant, 0 lỗi** |

> **Vì sao lỗi này chỉ lộ khi chạy thật.** Đọc mã tĩnh thì phần bắt lỗi trông đúng: có `try/catch`, có so SQLSTATE, có chú thích giải thích. Chỉ khi **chạy lần thứ hai** mới thấy mã thật khác mã được bắt. Đây là ví dụ rõ cho việc "đọc mã tĩnh" và "chạy thật" là hai mức tin cậy khác nhau.

### 10.3. Đã chạy lên cơ sở dữ liệu — chủ dự án cho phép

Môi trường: **localhost dev**, 10 tenant. Chạy `hrm:ra-soat` trước và xác nhận **10/10 tenant sạch, 0 dòng cần dọn** — khớp với việc phân hệ đang phát triển, chưa có dữ liệu thật.

| Lệnh | Kết quả |
|:---|:---|
| `npm run hrm:ra-soat` | 0/10 tenant có dữ liệu cần dọn |
| `npm run migrate:sys:deploy` | Áp `20260907090000_add_xem_luong_to_don_vi_access` thành công |
| `npm run sync:tenants` | 10 thành công, 0 lỗi |
| `npm run hrm:constraints` | 10/10 tenant đủ ràng buộc |
| `npm run hrm:constraints` (lần 2) | ❌ 10/10 lỗi → phát hiện BUG-HRM-42 |
| `npm run hrm:constraints` (lần 3, sau khi vá) | ✅ 10/10 tenant, 0 lỗi — idempotent |

**Trạng thái cơ sở dữ liệu sau khi chạy, đã kiểm chứng:**
- Cột `xemLuong` tồn tại, `default=false`; bảng phân quyền hiện **0 dòng** nên bước chuyển dữ liệu chưa có tác dụng quan sát được — sẽ có ý nghĩa khi hệ thống có nhân viên được cấp quyền.
- Khóa duy nhất cũ `(ma_nv, mst)` **đã gỡ**.
- Hai ràng buộc loại trừ `hrm_hop_dong_khong_chong_lan` và `hrm_npt_mst_khong_trung_ky` **đã có**; hai hàm `hrm_nhom_hd`, `hrm_ky_npt` **đã có**; `btree_gist` **đã cài**.

### 10.4. Kiểm hành vi trên cơ sở dữ liệu THẬT (mọi ca đều ROLLBACK)

| Ca | Kỳ vọng | Kết quả |
|:---|:---|:---|
| Hợp đồng khoán chạy song song hợp đồng lao động | Nhận | ✅ nhận |
| Hợp đồng `xac_dinh` chồng `khong_xac_dinh` (khác nhãn, **cùng nhóm**) | Chặn | ✅ chặn bởi `hrm_hop_dong_khong_chong_lan` |
| Số hợp đồng trùng ở hai nhân viên khác nhau | Chặn | ✅ chặn bởi `hrm_hop_dong_so_hd_key` |
| NPT **khác** nhân viên, kỳ nối tiếp 07/2026 | Nhận | ✅ nhận |
| NPT **khác** nhân viên, kỳ giao nhau 06/2026 | Chặn | ✅ chặn bởi `hrm_npt_mst_khong_trung_ky` |
| NPT **cùng** nhân viên, kỳ nối tiếp 07/2026 | Nhận (QĐ #19) | ✅ nhận |
| NPT **cùng** nhân viên, kỳ giao nhau 06/2026 | Chặn | ✅ chặn |
| NPT **cùng** nhân viên, **không khai kỳ** | Chặn | ✅ chặn |

**Tất cả khớp thiết kế.** Đây là lần đầu ràng buộc HRM được kiểm trên cơ sở dữ liệu thật thay vì suy luận.

### 10.5. Tranh chấp `TC-hrm-247` — đã ngã ngũ bằng bằng chứng chạy

Backend cho rằng kỳ vọng **409** của ca này đã lỗi thời sau QĐ #19; QA phản biện rằng nó **vẫn đúng** vì dòng không khai kỳ được quy thành khoảng vô hạn nên giao với mọi kỳ.

**QA đúng.** Ca "cùng nhân viên, không khai kỳ" chạy trên cơ sở dữ liệu thật → **bị chặn** (Mục 10.4). Kỳ vọng 409 giữ nguyên; chỉ **cột lý do** của ca cần viết lại cho khớp QĐ #19. Nhận nguyên lời khai của Backend mà hạ xuống 201 sẽ bỏ mất người canh một nhánh chặn có thật.

QA cũng nêu đúng một khoảng trống kèm theo: nhánh **"cùng nhân viên, kỳ nối tiếp → 201"** hiện **chưa ca nào phủ** (`TC-hrm-246a` chỉ phủ hai nhân viên khác nhau). Nhánh này đã được xác nhận hoạt động đúng ở Mục 10.4, nhưng vẫn cần một ca chính thức.

---

---

## 11. ĐỢT FRONTEND (2026-09-07)

### 11.1. Đã đồng bộ giao diện với hợp đồng P0 — BUG-HRM-41 đóng một phần

`hdđt_maxv/src/features/hrm/`: 14 file sửa + 1 file mới (`api/quyenLuongQueries.ts`). **Thư mục `mock/` (24 file) không bị đụng** theo yêu cầu. `npm run build` exit 0, `npm run lint` exit 0 — kiểm chứng độc lập.

| Việc | Kết quả |
|:---|:---|
| `GET /hrm/hop-dong` nay bắt buộc `ma_nv` | ✅ `listHopDong` đổi chữ ký thành bắt buộc; bỏ hẳn lối gọi trần rồi lọc phía trình duyệt. Đóng phần giao diện của **BUG-HRM-25** |
| Toàn nhóm hợp đồng trả 403 | ✅ Ẩn/khóa tab kèm giải thích; dùng `skipToken` để không bắn yêu cầu chỉ để nhận 403 |
| Ba trường ngân hàng có thể vắng hẳn | ✅ Kiểu đổi sang tùy chọn, kiểm bằng **khóa có mặt hay không** (`"so_tai_khoan" in row`) chứ không kiểm giá trị — đúng ngữ nghĩa "bỏ hẳn trường, không trả null" |
| `status` bắt buộc khi sửa nhân viên | ✅ Đã đúng sẵn ở cả hai đường ghi, đã rà và ghi chú để không ai bỏ đi "cho gọn" |
| `loai_hd_can_chot` khi đổi hợp đồng | ✅ Thêm ô chọn "Hợp đồng cần chốt", chỉ hiện khi có hơn một nhóm đang hiệu lực |
| Bốn mã lỗi mới | ✅ Lấy wording nguyên văn từ mã nguồn backend |
| **ĐS-04** `so_npt_da_xoa` → `so_npt_an_theo` | ✅ **ĐÓNG** — và thông báo nói ra con số thay vì chỉ đổi kiểu cho hết đỏ |

### 11.2. Lỗi MỚI — ảnh hưởng TOÀN ỨNG DỤNG, không riêng HRM

| Mã | Mức | Nội dung |
|:---|:---:|:---|
| **BUG-HRM-43** | 🟠 High | **Mọi lỗi kiểm dữ liệu 400 đều hiện thông báo chung chung, người dùng không biết sai ở đâu.** Bộ xử lý lỗi của máy chủ gửi nhánh 400 dạng `{ success: false, errors }` — **không có `message`** (`errorHandler.plugin.ts:27`), trong khi mọi nhánh khác (409/404/401/403/502) đều có. Phía giao diện, `apiFetch` dựng thông báo từ `body.message` và **không đọc `errors.fieldErrors`** (`hdđt_maxv/src/lib/http.ts:129,141`), nên rơi về `"Yêu cầu thất bại (400)"`. |

> **Phạm vi rộng hơn HRM rất nhiều.** `apiFetch` được dùng **91 lần** trong các module của `hdđt_maxv` — hóa đơn điện tử, tờ khai, dịch vụ công, kế toán đều đi qua đúng đường này. Nghĩa là **mọi** lỗi nhập liệu trong toàn ứng dụng đang mất thông tin trường nào sai. Đây không phải lỗi do đợt P0 sinh ra; đợt này chỉ **làm lộ nó ra** vì hai mã lỗi lương mới (E-hrm-056, E-hrm-057) là lỗi 400 đầu tiên mà người dùng thật sự cần đọc nội dung.
>
> **Cách vá tạm mà giao diện đang dùng:** chép nguyên văn hai câu lỗi lương sang phía giao diện và chặn tại chỗ. Đây là **ngoại lệ có chủ ý, đã ghi chú trong mã**, không phải mẫu để nhân rộng — giữ hai bộ luật song song là cách chắc chắn để chúng lệch nhau.
>
> **Cách sửa gốc (cần backend + một đợt riêng):** thêm `message` vào nhánh 400, hoặc để `apiFetch` đọc `errors.fieldErrors` khi thiếu `message`. Việc này **vượt phạm vi HRM** — phải đánh giá tác động lên cả bốn module trước khi làm.

### 11.3. Việc còn nợ sau đợt Frontend

* 🚨 **Chưa có màn cấp quyền xem lương ở `maxv/`** (FR-hrm-044, contract Mục 7C.4). Cột dữ liệu đã migrate và người dùng hiện có đã được cấp quyền theo QĐ #17, nhưng **người được cấp quyền vào công ty SAU ngày triển khai sẽ vĩnh viễn không xem được lương** vì không ai bật cờ cho họ. **Đây là phần còn lại của BUG-HRM-41, vẫn mở.**
* ⚠️ Hợp đồng API chưa có đường cho giao diện biết phiên hiện tại có quyền xem lương hay không. Giao diện đang **suy ra** từ vai trò và từ việc ba trường ngân hàng có mặt trong phản hồi hay không — hoạt động được, nhưng gắn vào một chi tiết hiện thực của backend. Đề nghị trả `xemLuong` trong `GET /auth/me`.
* ⚠️ Toàn bộ thay đổi giao diện mới qua `tsc` + `eslint` + build, **chưa gọi API thật lần nào**. Bốn kịch bản cần kiểm tay: chủ tài khoản · nhân viên **có** quyền lương · nhân viên **không** có quyền · thu hồi quyền **giữa phiên**.

---

## 8. ĐẦU VIỆC CỦA CHÍNH QA (Phase B)

| # | Việc | Điều kiện tiên quyết |
|:--:|:---|:---|
| 1 | Dựng khung test HRM đầu tiên trong `be_maxv/src/__tests__/` (hiện **0 file**) — chạy qua `buildApp()` + `app.inject()`, không đụng dev server của người dùng | BA sign-off |
| 2 | Dựng stub Google Drive (chặn `fetch`) cho 32 ca nhóm Drive | — |
| 3 | Dựng fixture 2 tenant để chạy nhóm cô lập `TC-hrm-179…182` | Có 2 DB tenant test |
| 4 | Tự động hóa 95 ca **P0** trước, sau đó 74 ca **P1** | Sprint 1 xong |
| 5 | Chạy và ghi số liệu concurrency thật (`TC-hrm-023, 050, 051, 052, 087, 088, 149`), ghi rõ ngưỡng chịu tải vào `test-report.md` | Sprint 2 xong |
| 6 | Đối soát toàn bộ endpoint với `api-contract.md` (`TC-hrm-185`) và báo lại mọi điểm lệch còn sót | Sau khi Architect sửa contract |
| 7 | Xuất `docs/hrm/qa/test-report.md` + cập nhật lại chính file này bằng **kết quả chạy thật**, thay các dòng "suy từ code" bằng bằng chứng runtime | Cuối Phase B |

---

## 9. PHASE B — ĐỢT P0 (2026-09-07): TRẠNG THÁI ĐÓNG BUG CŨ + BUG MỚI

> **Đợt rà soát:** Phase B — Dynamic Test Execution, sau khi Backend Engineer hoàn tất đợt P0.
> **Phạm vi:** năm hạng mục P0 của `docs/hrm-ba-signoff-2026-09-07.md` Mục 5.1.
> **Số liệu chạy thật + phân loại 81 ca Mục 6B:** `docs/hrm/qa/test-report.md`.
>
> **Mục 1–8 bên trên GIỮ NGUYÊN, không xóa dòng nào.** Mục này chỉ **thêm** trạng thái đóng và bug mới.

### 9.0. Mức độ tin cậy của Mục 9

| Loại bằng chứng | Áp cho |
|:---|:---|
| **[CHẠY THẬT]** | `typecheck` (exit 0) · `lint` (exit 0, 148 warning, 0 error) · `npm test` (**456 · 451 pass · 5 fail**) · hai file HRM riêng (**54 · 54 pass**) · lần chạy đối chứng `adminOwner.test.ts` trên worktree tại `HEAD 8a18824` · 5 phép dò validator |
| **[ĐỌC MÃ]** | Mọi kết luận "đóng"/"còn mở" và mọi bug mới từ BUG-HRM-33 trở đi |
| **[KHÔNG ĐƯỢC PHÉP]** | `migrate:sys:deploy`, `hrm:ra-soat`, `hrm:constraints` — chủ dự án giữ quyền quyết định, QA **không chạy lên bất kỳ cơ sở dữ liệu nào** |

⚠️ **Chưa một endpoint HRM nào được gọi thật.** Hai file test mới là test **thuần logic** (hàm thuần + schema Zod), không qua `buildApp()`/`app.inject()`, không đụng cơ sở dữ liệu. Mọi dòng "đã đóng" dưới đây nghĩa là **mã đã có và luật đúng**, **không** phải "đã nghiệm thu qua HTTP".

---

### 9.1. Bug cũ — trạng thái đóng, **tự kiểm chứng**, không nhận theo lời khai

| Mã | Trạng thái | Bằng chứng |
|:---|:---:|:---|
| **BUG-HRM-05** 🔴 NPT trùng mã số thuế giữa hai nhân viên | ✅ **ĐÓNG ở tầng ứng dụng** · ⚠️ tầng CSDL chờ script | `nguoiPhuThuoc.service.ts:147-181` — phạm vi **toàn công ty** (`where: { mst, nhan_vien: { da_xoa: false } }` `:155-160`, **không** còn `ma_nv`), có xét kỳ (`:174`), bỏ qua hồ sơ xóa mềm (`:158`), loại trừ dòng đang sửa (`:159`). Gọi ở `:189` (create) và `:213` (update). Ràng buộc `hrm_npt_mst_khong_trung_ky` **chưa áp** |
| **BUG-HRM-07** 🟠 `doiHopDong` dùng mốc UTC | ✅ **ĐÓNG** | `hopDong.service.ts:436` dùng `homNayVN()`; `grep -rn setUTCHours src/` → chỉ còn trong chú thích (`:123`, `:426`) và trong test đối chứng cái sai cũ (`hrmHopDong.test.ts:170`). Đường đọc (`:164`) và đường đổi (`:436`) dùng **chung một hàm**. Đã chạy thật: `hrmHopDong.test.ts:163, 177` pass (02:00 và 23:00 giờ VN) |
| **BUG-HRM-12** 🟡 `so_hd` không unique, không kiểm ở tầng nào | ✅ **ĐÓNG ở tầng ứng dụng** · ⚠️ unique index chờ script | `assertSoHdDuyNhat` `hopDong.service.ts:308-326`, gọi ở `:353`/`:385`/`:421`. **Vế `boQuaId` khi sửa CÓ mặt** (`:385` truyền `id`, dịch ở `:316`) — không dính bẫy "mọi lần sửa đều 409". `CREATE UNIQUE INDEX IF NOT EXISTS "hrm_hop_dong_so_hd_key"` ở `hrmTenantConstraints.ts:150-151`, **chưa áp** |
| **BUG-HRM-25** 🔴 Lương toàn công ty gửi xuống trình duyệt | ⚠️ **ĐÓNG PHẦN MÁY CHỦ · CÒN MỞ ĐẦU-CUỐI** | Máy chủ: `ma_nv` bắt buộc (`hopDong.validator.ts:188-196`), `listHopDong` luôn lọc (`hopDong.service.ts:335-338`), cả nhóm qua `dbCoQuyenLuong` (controller). **Nhưng giao diện chưa sửa** — `hdđt_maxv/src/features/hrm/api/hopDongQueries.ts:72` vẫn `listHopDong()` không tham số. Vế thứ hai của QĐ #8 chưa làm ⇒ **xem BUG-HRM-41** |
| **BUG-HRM-26** 🟠 Sửa nhân viên thiếu `status` | ✅ **ĐÓNG** | `nhanVien.validator.ts` — `nhanVienUpdateSchema.extend({ status: z.enum(['0','1'], { required_error, invalid_type_error }) })`. Chạy thật: `hrmHopDong.test.ts:314` (thiếu → 400), `:322` (có → giữ đúng), `:328` (rác → 400) đều pass. Giao diện đã gửi sẵn `status` (`hdđt_maxv/.../nhanVienApi.ts:71`) nên không vỡ |
| **BUG-HRM-27** 🟠 Khóa chồng lấn theo nhãn `loai_hd` thô | ✅ **ĐÓNG** (vế khóa) · ⚠️ vế chuẩn hóa dữ liệu chưa làm | Khóa đã là **nhóm nghiệp vụ**: `hopDong.service.ts:110` dùng `loaiHdVeNhanVien` cả hai vế; hàm gom nhóm `:60-65` hạ chữ thường + cắt khoảng trắng ở `:61`; bản SQL `hrmTenantConstraints.ts:45-50` cùng một hằng số. Chạy thật: `hrmHopDong.test.ts:140` (khác nhãn cùng nhóm → chặn), `:151` (`Khoan` viết hoa → chặn) pass. **Vế "chuẩn hóa `loai_hd` khi ghi" của contract 4.2b chưa làm ⇒ BUG-HRM-35** |
| **BUG-HRM-28** 🟠 `setEmployeeAccess` replace-set xóa sạch quyền lương | ✅ **ĐÓNG** | `company.service.ts:406-411` chỉ `deleteMany` các `donViId` **không còn trong danh sách** (`notIn`), `:413-427` `upsert` từng cặp khóa `(userId, donViId)`. `update: item.xemLuong === undefined ? {} : { xemLuong }` ⇒ dạng thân yêu cầu cũ **giữ nguyên** cờ. Cặp mới `?? false` (`:420`, đúng QĐ #17). Chạy thật: `hrmQuyenVaNpt.test.ts:214` xác nhận dạng cũ để `xemLuong` **không xác định** |
| **ISSUE-HRM-01** 🟠 Hợp đồng chồng lấn không bị chặn | ✅ **ĐÓNG ở tầng ứng dụng** · ⚠️ tầng CSDL chờ script | `assertKhongChongLan` gọi ở **cả ba** đường ghi: `hopDong.service.ts:354` (create) · `:386` (update, `boQuaId = id`) · `:474` (doi). Luật thuần `hopDongChongLan` `:108-118` + khoảng **đóng hai đầu** `:88-90`. `doiHopDong` lọc **đúng nhóm** ở `:437, 447-449`. Chạy thật: 9 ca nhóm 6B.4 pass. Ràng buộc `EXCLUDE` **chưa áp** |

**Tóm tắt:** 7/8 mục đóng được ở tầng mã nguồn. **BUG-HRM-25 chỉ đóng nửa** — nửa còn lại là việc giao diện và nó là việc **chặn triển khai**.

⚠️ **Ba mục (05, 12, ISSUE-01) chỉ đóng ở tầng ứng dụng.** Lớp phòng thủ thứ hai ở cơ sở dữ liệu **chưa tồn tại ở tenant nào**. Ca đồng thời (TC-hrm-209, 210) vẫn **hở** cho tới khi chạy `hrm:constraints`.

---

### 9.2. Bug mới phát hiện ở Phase B

#### 🟠 BUG-HRM-33 — Câu gỡ khóa duy nhất cũ của người phụ thuộc là **lệnh rỗng**

| | |
|:---|:---|
| **Mức độ** | 🟠 High |
| **Ưu tiên** | P0 — chặn triển khai |
| **Vùng** | `be_maxv/src/services/shared/hrmTenantConstraints.ts:156-159` (M-09 bước 1) |
| **Môi trường** | Mọi tenant PostgreSQL đã từng chạy `prisma db push` với schema cũ |
| **Bằng chứng** | `[ĐỌC MÃ]` + đối chứng từ chính lịch sử migration của repo |

**Mô tả.** Script áp ràng buộc gỡ khóa duy nhất cũ bằng:

```sql
ALTER TABLE "hrm_nguoi_phu_thuoc"
  DROP CONSTRAINT IF EXISTS "hrm_nguoi_phu_thuoc_ma_nv_mst_key"
```

Nhưng Prisma **không** tạo `@@unique` bằng `ALTER TABLE ... ADD CONSTRAINT`. Nó tạo bằng `CREATE UNIQUE INDEX`. Bằng chứng lấy từ chính migration của dự án này:

* `prisma/sys/migrations/20260629050535_init_sys/migration.sql:44` — `CREATE UNIQUE INDEX "users_email_key" ON "users"("email");`
* `.../20260706141025_multi_company_per_account/migration.sql:60` — `CREATE UNIQUE INDEX "don_vi_access_userId_donViId_key" ...`
* Và khi **chính Prisma** gỡ, nó dùng `DROP INDEX`: `.../20260706141025_.../migration.sql:14` — `DROP INDEX "subscription_donViId_key";`

`CREATE UNIQUE INDEX` **không** sinh bản ghi trong `pg_constraint`. `DROP CONSTRAINT IF EXISTS` với tên đó chỉ phát NOTICE "constraint does not exist, skipping" rồi **không làm gì**.

**Các bước tái hiện.** (1) Tenant đã có bảng `hrm_nguoi_phu_thuoc` dựng từ schema cũ. (2) Chạy `npm run hrm:constraints`. (3) `SELECT indexname FROM pg_indexes WHERE indexname = 'hrm_nguoi_phu_thuoc_ma_nv_mst_key';`

**Kỳ vọng.** Không còn dòng nào — M-09 bước 1 đã gỡ khóa cũ.
**Thực tế (dự đoán).** Index vẫn còn nguyên.

**Hệ quả.** Khóa cũ `(ma_nv, mst)` sống sót ⇒ ca **cùng một nhân viên, cùng mã số thuế, kỳ giảm trừ KHÔNG giao nhau** (hợp lệ theo QĐ #19, xem TC-hrm-247a đề xuất ở ISSUE-HRM-07) bị chặn ở tầng cơ sở dữ liệu kèm thông báo chung chung, trong khi tầng ứng dụng đã cho qua. Đúng kiểu "hai tầng nói khác nhau" mà đợt này sinh ra để dẹp.

**Phạm vi ảnh hưởng hẹp hơn thoạt nhìn** — khóa cũ chỉ khóa **trong một nhân viên**, nên ca chuyển người kê khai giữa hai nhân viên (TC-hrm-246a, ca đầu bài của QĐ #19) **không** bị chạm.

**Nghi vấn nguyên nhân.** Người viết giả định `@@unique` của Prisma là table constraint. Trong PostgreSQL, Prisma dùng unique index.

**Yếu tố làm nặng thêm — runbook thiếu một bước.** Trên thực tế `prisma db push` **sẽ** gỡ index cũ (vì `@@unique` đã bị bỏ khỏi `prisma/tenant/schema.prisma`). Nhưng runbook ở `dev-notes.md` Mục 1.3b ghi *"Ba lệnh, theo đúng thứ tự này"* gồm `hrm:ra-soat` → dọn dữ liệu → `hrm:constraints`, **không có `sync:tenants`**. Làm đúng runbook thì khóa cũ **không bao giờ được gỡ**.

**Đề xuất sửa.** Thêm câu thứ hai cạnh câu hiện có (giữ cả hai cho chắc), và bổ sung `npm run sync:tenants` vào runbook:

```sql
ALTER TABLE "hrm_nguoi_phu_thuoc" DROP CONSTRAINT IF EXISTS "hrm_nguoi_phu_thuoc_ma_nv_mst_key";
DROP INDEX IF EXISTS "hrm_nguoi_phu_thuoc_ma_nv_mst_key";
```

**Cách xác minh dứt điểm (cần quyền chạm CSDL):** truy vấn `pg_indexes` ở trên; hoặc chạy cả hai câu trong một transaction rồi `ROLLBACK`.

---

#### 🟠 BUG-HRM-34 — Khoảng thời gian **không còn lớp phòng thủ nào** cho người phụ thuộc

| | |
|:---|:---|
| **Mức độ** | 🟠 High (hệ quả chạm **sai thuế TNCN** — cùng loại với BUG-HRM-05 🔴) |
| **Ưu tiên** | P0 — chặn triển khai |
| **Vùng** | `nguoiPhuThuoc.service.ts:184-196` (create) · `:199-222` (update) · `prisma/tenant/schema.prisma` (đã bỏ `@@unique`) |
| **Bằng chứng** | `[ĐỌC MÃ]` |

**Mô tả.** `api-contract.md` Mục 5.2b biện minh cho việc hai đường ghi người phụ thuộc **không bọc transaction** bằng đúng một câu: *"Rủi ro thấp (**unique constraint ở DB là chốt cuối**, FK cascade bảo vệ `ma_nv`)"*.

Đợt P0 **rút mất chính cái chốt cuối đó**: `@@unique([ma_nv, mst])` đã bị bỏ khỏi `prisma/tenant/schema.prisma`, ràng buộc thay thế `hrm_npt_mst_khong_trung_ky` **chưa áp ở tenant nào**, và hai đường ghi **vẫn không có transaction**:

* `createNguoiPhuThuoc` `:188-189` gọi `assertNhanVienTonTai` + `assertKhongTrungMst`, rồi `:192-195` mới ghi — **ngoài** mọi transaction.
* `updateNguoiPhuThuoc` `:204-213` kiểm, `:215-221` ghi — cũng ngoài transaction.

⇒ Trong khoảng từ lúc triển khai mã đến lúc `hrm:constraints` chạy xong, **hai yêu cầu đồng thời cùng mã số thuế, kỳ giao nhau, đều qua được pre-check và đều ghi thành công**. Đó chính là kịch bản BUG-HRM-05 🔴 Critical: giảm trừ gia cảnh tính hai lần → sai thuế TNCN, không có gì báo. So với trước đợt P0 thì đây là **bước lùi** ở nhánh đồng thời (trước đó ít nhất khóa `(ma_nv, mst)` còn chặn được nhánh cùng-một-nhân-viên).

**Các bước tái hiện.** (1) Triển khai mã P0, **chưa** chạy `hrm:constraints`. (2) Bắn hai `POST /hrm/nguoi-phu-thuoc` đồng thời, khác `ma_nv`, cùng `mst`, kỳ giao nhau.
**Kỳ vọng.** Đúng một cái 201, cái kia 409.
**Thực tế (dự đoán).** **Cả hai 201.**

**Nghi vấn nguyên nhân.** Đợt P0 đổi lớp phòng thủ tầng cơ sở dữ liệu nhưng **không** rà lại những chỗ đang dựa vào lớp cũ. Hợp đồng có nêu điều này ở Mục 5.2b và Mục 9.5 nhưng không ai nối hai đầu lại.

**Đề xuất sửa (chọn một, ưu tiên cái đầu).**
1. Bọc `db.$transaction` cho cả hai đường ghi, **cùng khuôn** với `hopDong.service.ts:351/375/419`. Rẻ, đồng nhất, và làm hợp đồng khớp mã ngay.
2. Nếu hoãn: **cấm** triển khai mã P0 trước khi `hrm:constraints` chạy xong trên **mọi** tenant, và ghi thẳng ràng buộc đó vào runbook.

---

#### 🟠 BUG-HRM-41 — Giao diện chưa làm vế thứ hai của QĐ #8 và QĐ #1 ⇒ **chặn triển khai**

| | |
|:---|:---|
| **Mức độ** | 🟠 High (chặn triển khai; nếu bật máy chủ thì thành 🔴) |
| **Ưu tiên** | P0 |
| **Vùng** | `hdđt_maxv/src/features/hrm/api/` · `maxv/src/features/` |
| **Bằng chứng** | `[ĐỌC MÃ]` + `git status` |

**Mô tả.** BA đã ghi rõ ba việc phải **ship cùng một lượt** với máy chủ (`hrm-ba-signoff-2026-09-07.md` Mục 5.1 hạng mục 1 và 4). `git status` trên `hdđt_maxv/` và `maxv/` cho **0 thay đổi** — không việc nào được làm.

| # | Thiếu gì | Hậu quả khi bật máy chủ | Bằng chứng |
|:--:|:---|:---|:---|
| 1 | Lấy lịch sử hợp đồng **không tham số** | Mọi lượt gọi nhận **400** ⇒ **màn hợp đồng trắng với 100% người dùng** | `hopDongQueries.ts:72` — `queryFn: () => listHopDong()`; `hopDongApi.ts:50-54` khai `params?: { ma_nv?: string }` (tùy chọn) |
| 2 | Thân yêu cầu đổi hợp đồng thiếu `loai_hd_can_chot` | Mọi lượt gọi nhận **400** ⇒ **chức năng đổi hợp đồng chết hoàn toàn** | `hopDongApi.ts` — `DoiHopDongApiBody extends HopDongApiCreateBody { ngay_chot: string \| null }`, không có trường mới |
| 3 | `maxv/` không có màn cấp quyền xem lương (contract 7C.4, FR-hrm-044) | Cột quyền tồn tại mà **không ai cấp/thu hồi được**; nhân viên được cấp quyền vào công ty **sau** ngày triển khai vĩnh viễn không xem được lương | `grep -rn "xemLuong" maxv/src "hdđt_maxv/src"` → **0 kết quả** |

**Điểm sáng, ghi để khỏi lo nhầm:** `PUT /hrm/nhan-vien` **không** vỡ — giao diện đã khai `status` bắt buộc (`nhanVienApi.ts:71`) và form có ô chọn (`nhan_vien/tabs/ThongTinTab.tsx:245`).

**Đề xuất.** Giao Frontend Engineer trước khi triển khai. Không có cách vá phía máy chủ nào cứu được việc 1 và 2 mà không mở lại chính lỗ BUG-HRM-25 vừa vá.

---

#### 🟡 BUG-HRM-35 — `loai_hd` không được chuẩn hóa chữ thường khi ghi

| | |
|:---|:---|
| **Mức độ** | 🟡 Medium (chất lượng dữ liệu, không phải lỗ hổng luật) · **Ưu tiên** P1 |
| **Vùng** | `be_maxv/src/validators/hrm/hopDong.validator.ts:44-48` |
| **Bằng chứng** | `[CHẠY THẬT]` — phép dò E |

**Mô tả.** `api-contract.md` Mục 4.2b ghi rõ *"Kèm theo: **chuẩn hóa `loai_hd` về chữ thường khi ghi**. Hiện trường này chỉ được cắt khoảng trắng, khác `ma_nv` và `ma_pb` đều được in hoa."* Mã **chưa làm**: schema chỉ `.trim().min(1).max(24)`, không `.toLowerCase()`.

**Tái hiện (đã chạy).** `hopDongUpdateSchema.parse({ loai_hd: "  KHOAN  ", ... })`
**Kỳ vọng.** `"khoan"` · **Thực tế.** `"KHOAN"`

**Hệ quả.** **Không** phải lỗ hổng luật — cả `loaiHdVeNhanVien` (`hopDong.service.ts:61`) lẫn `hrm_nhom_hd` (`hrmTenantConstraints.ts:46`) đều hạ chữ thường trước khi gom, nên chống chồng lấn vẫn an toàn (TC-hrm-205b pass thật). Hệ quả là **dữ liệu bẩn**: cùng một loại hợp đồng lưu thành `khoan`/`Khoan`/`KHOAN`, làm mọi thống kê nhóm theo `loai_hd`, mọi bộ lọc so khớp chính xác và mọi báo cáo sau này lệch nhau.

**Đề xuất.** Thêm `.transform(s => s.toLowerCase())` vào `loai_hd`, kèm một đợt `UPDATE` chuẩn hóa dữ liệu cũ. Cân nhắc gộp vào cùng đợt rà `hrm:ra-soat` để chỉ gián đoạn một lần.

---

#### 🟡 BUG-HRM-36 — `access` chứa trùng `donViId` được nhận, phần tử cuối thắng âm thầm

| | |
|:---|:---|
| **Mức độ** | 🟡 Medium · **Ưu tiên** P1 |
| **Vùng** | `be_maxv/src/validators/company.validator.ts` (`setEmployeeAccessSchema`) · `company.service.ts:413-427` |
| **Bằng chứng** | `[CHẠY THẬT]` — phép dò A |

**Mô tả.** Schema không kiểm trùng `donViId`. Vòng lặp `upsert` chạy tuần tự nên **phần tử cuối cùng thắng**, không báo gì.

**Tái hiện (đã chạy).** `parse({ access: [{ donViId: X, xemLuong: true }, { donViId: X, xemLuong: false }] })`
**Kỳ vọng.** 400 "danh sách công ty bị trùng" · **Thực tế.** Qua validator, giữ nguyên cả hai; service ghi `true` rồi ghi đè `false`.

**Hệ quả.** Một lỗi phía giao diện (gửi lặp phần tử khi người dùng bấm hai lần, hoặc trộn danh sách cũ với danh sách mới) làm **thu hồi âm thầm** đúng thứ mà thao tác đó vừa cấp. Cùng họ hệ quả với BUG-HRM-28 vừa vá — mất quyền không lỗi, không dấu vết. Nhật ký ghi cả hai phần tử (`company.service.ts:435-440`) nên **truy lại được**, đó là điểm giảm nhẹ duy nhất.

**Đề xuất.** `.refine(v => new Set(ids).size === ids.length, 'Danh sách công ty không được trùng')` → 400. Gộp im lặng là phương án tệ hơn: nó che mất lỗi phía gọi.

---

#### 🔵 BUG-HRM-37 — `POST /nhan-vien` bỏ im lặng ba trường ngân hàng của người không có quyền lương

| | |
|:---|:---|
| **Mức độ** | 🔵 Low · **Ưu tiên** P2 |
| **Vùng** | `be_maxv/src/services/client/hrm/nhanVien.service.ts:230-255` (dùng `boTruongLuongKhiGhi` `:75-85`) |
| **Bằng chứng** | `[ĐỌC MÃ]` |

**Mô tả.** `boTruongLuongKhiGhi` đúng và cần thiết ở **đường sửa**: `PUT` thay toàn bộ bản ghi, người không có quyền đọc thì không có sẵn giá trị cũ để gửi lại, nhận nguyên payload của họ là xóa trắng số tài khoản (contract Mục 3.1c). Nhưng nó cũng được áp cho **`POST`** (`:252-254`), nơi **không có giá trị cũ nào để bảo vệ**.

**Tái hiện.** Người dùng không có quyền lương tạo nhân viên mới, điền số tài khoản ngân hàng.
**Kỳ vọng.** Hoặc lưu (không có gì để rò), hoặc **403 nói rõ** không được nhập trường đó.
**Thực tế.** **201**, dữ liệu bị vứt im lặng. Người dùng chỉ phát hiện khi mở lại hồ sơ — mà họ cũng không xem được ba trường đó, nên có thể không phát hiện bao giờ.

**Hệ quả.** Mất dữ liệu nhập liệu, âm thầm. Đây là chỗ mã **chặt hơn** đặc tả: BR-hrm-059 và FR-hrm-042 chỉ nói về **phản hồi trả về**, không nói cấm ghi.

**Đề xuất.** Chọn dứt khoát một trong hai (im lặng là phương án duy nhất không chấp nhận được): (a) cho phép ghi ở `POST`, chỉ che khi đọc; (b) trả 400/403 nêu rõ. QA nghiêng về (b) — nhất quán với tinh thần "chặn thì nói rõ" của E-hrm-058.

---

#### 🔵 BUG-HRM-38 — Chú thích trỏ tới đường dẫn API không tồn tại, trái QĐ #20

| | |
|:---|:---|
| **Mức độ** | 🔵 Low · **Ưu tiên** P2 |
| **Vùng** | `be_maxv/src/scripts/backfill-hop-dong.ts:5` |
| **Bằng chứng** | `[CHẠY THẬT]` — `git diff` + `grep` |

**Mô tả.** `git diff HEAD` cho thấy chú thích bị đổi từ `POST /hrm/nhan-vien` thành **`POST /hrm/employees`**. Đường dẫn đó **không tồn tại**: `grep -rn "employees" src/routes/hrm/` → 0 kết quả; toàn bộ route HRM là tiếng Việt (`/nhan-vien`, `/hop-dong`, `/phong-ban`, `/nguoi-phu-thuoc`, `/tai-lieu`).

Trái **QĐ #20** (đổi tên sang tiếng Anh **đã hoãn**) và trái `hrm-ba-signoff-2026-09-07.md` Mục 5.1 (*"Đường dẫn API dùng tiếng Việt, khớp mã nguồn và giao diện"*).

**Hệ quả.** Người đọc sau này đi tìm một endpoint không có. Đúng loại lỗi mà BUG-HRM-32 đã ghi và đợt này định dẹp.

**Đề xuất.** Hoàn nguyên về `POST /hrm/nhan-vien`. Rà thêm xem còn chỗ nào bị đổi nhầm cùng đợt.

---

#### 🔵 BUG-HRM-39 — `provisionTenant` bỏ kết quả áp ràng buộc

| | |
|:---|:---|
| **Mức độ** | 🔵 Low · **Ưu tiên** P2 |
| **Vùng** | `be_maxv/src/services/shared/provisioning.service.ts` (dòng `await applyTenantConstraints(dbName);`) |
| **Bằng chứng** | `[ĐỌC MÃ]` |

**Mô tả.** `applyTenantConstraints` trả `KetQuaApRangBuoc` gồm `daAp`, `daCoSan`, **`vuongDuLieu`** (`hrmTenantConstraints.ts:210-216`). `provisionTenant` gọi hàm nhưng **vứt kết quả**, rồi đánh dấu công ty `READY`.

Ràng buộc vướng dữ liệu **không ném lỗi** (cố ý, `:251-256`, `:276-281`) — nó nằm trong `vuongDuLieu`. Nên nếu nhánh đó xảy ra, tenant thành `READY` mà **thiếu ràng buộc, không một dấu vết nào**.

**Xác suất gần bằng không** hôm nay (cơ sở dữ liệu mới tạo luôn rỗng, không thể có dòng vi phạm) — và chú thích trong mã nói đúng điều đó. Nhưng nó chỉ đúng **chừng nào** luồng cấp DB còn rỗng lúc gọi. Ghi lại vì chi phí sửa gần bằng không.

**Đề xuất.** `if (kq.vuongDuLieu.length > 0) throw ...` hoặc chí ít ghi cảnh báo — SAGA đã có nhánh đánh dấu `FAILED`.

---

#### 🔵 BUG-HRM-40 — Nhận diện lỗi ràng buộc bằng so chuỗi con, không neo vào SQLSTATE

| | |
|:---|:---|
| **Mức độ** | 🔵 Low (gia cố) · **Ưu tiên** P2 |
| **Vùng** | `be_maxv/src/services/client/hrm/rangBuocDb.ts:30-44` |
| **Bằng chứng** | `[ĐỌC MÃ]` |

**Mô tả.** `viPhamRangBuoc` nối `err.message` với `JSON.stringify(err.meta)` rồi `.includes(tenRangBuoc)`. Lý do chọn cách này **hợp lệ và được giải thích kỹ** (`:6-11`): Prisma không map SQLSTATE `23P01` thành `P2002`/`P2003`, nên bắt theo `err.code` sẽ trượt và lỗi rơi xuống 500.

Điểm yếu còn lại: đây là so khớp **không neo**. Nếu một ngày nào đó chuỗi lỗi có chứa dữ liệu người dùng (giá trị cột, nội dung dòng), một người nhập `ghi_chu = "hrm_hop_dong_khong_chong_lan"` có thể làm một lỗi **hoàn toàn khác** bị gán nhãn 409 sai. Chưa có đường khai thác nào cụ thể trong Prisma hiện tại — ghi để không mất dấu.

**Đề xuất.** Neo thêm điều kiện SQLSTATE ∈ {`23P01`, `23505`} **trước** khi so tên (`hrmTenantConstraints.ts:196-203` đã có sẵn hằng số). Hai điều kiện cùng lúc thì gần như không thể dựng nhầm.

---

#### 🟡 ISSUE-HRM-05 — `adminOwner.test.ts` xác thực bằng header Bearer, hệ thống đã chuyển sang cookie

| | |
|:---|:---|
| **Mức độ** | 🟡 Medium (nợ hạ tầng test, **không** thuộc HRM) · **Ưu tiên** P1 |
| **Vùng** | `be_maxv/src/__tests__/adminOwner.test.ts:31-41` |
| **Bằng chứng** | `[CHẠY THẬT]` — chạy trên cả mã hiện tại và worktree tại `HEAD 8a18824` |

**Mô tả.** Test gắn `Authorization: Bearer <token>`, nhưng `plugins/jwt.plugin.ts:19-28` đã cấu hình `@fastify/jwt` đọc token từ **cookie httpOnly** kể từ commit `2d791dc`. Bốn ca con nhận 401 ở tầng xác thực, ca cha hỏng theo → **5 fail thường trực**.

**Đã chứng minh không phải hồi quy của đợt P0:** chạy đúng file này trên worktree tại `HEAD` (mã **trước** P0) cho **kết quả giống hệt** — `tests 5 · pass 0 · fail 5`, cùng bốn assertion, cùng thông điệp `"Chưa đăng nhập hoặc token không hợp lệ"`. Đợt P0 không chạm `src/plugins/` hay `src/app.ts`.

**Hệ quả.** `npm test` **không bao giờ xanh** ⇒ cả đội quen với 5 dòng đỏ ⇒ lần hồi quy thật tiếp theo rất dễ bị bỏ qua. Đây chính là lý do phải sửa dù nó không thuộc HRM.

**Đề xuất.** Đổi `login()` sang lấy cookie từ `set-cookie` của phản hồi đăng nhập rồi gắn vào `headers.cookie` cho các lượt gọi sau. Đây cũng là **khuôn mẫu** mà khung test tích hợp HRM sắp dựng sẽ cần — làm một lần dùng cho cả hai.

---

#### 🟡 ISSUE-HRM-06 — Hợp đồng Mục 4.3 (`E-hrm-022`) mâu thuẫn QĐ #6, cần BA chốt

| | |
|:---|:---|
| **Mức độ** | 🟡 Medium (mâu thuẫn đặc tả) · **Ưu tiên** P1 · **Chủ trì: BA** |
| **Vùng** | `api-contract.md` Mục 4.3 bước 3b ↔ `hopDong.service.ts:457-464` ↔ QĐ #6 |

**Mô tả.** Hợp đồng quy định `ngay_chot <= cu.ngay_bat_dau` → 409 `E-hrm-022`, và mã làm **đúng như vậy** (`:460`). Lý do gốc của luật này là "chốt đúng ngày bắt đầu sinh ra hợp đồng một ngày, mà hợp đồng một ngày bị chặn" — nhưng **QĐ #6 đã cho phép hợp đồng một ngày**. Lý do đã mất, luật vẫn còn.

⇒ Thao tác **hợp lệ** "ký hợp đồng buổi sáng, chiều đổi ngay, chốt hợp đồng cũ đúng ngày bắt đầu" đang bị chặn bằng 409.

**Đây KHÔNG phải lỗi của Backend.** Kỹ sư bám hợp đồng là đúng vai, và mã có chú thích trỏ đúng chỗ (`:457-459` → OQ-hrm-15). QA thẩm định quyết định (d) của BE là **chấp nhận được**. Việc cần làm là BA chốt lại hợp đồng.

**Đề xuất.** BA quyết: đổi `<=` thành `<` (cho phép hợp đồng cũ dài đúng một ngày), hay giữ nguyên và ghi rõ lý do mới. Chốt xong thì cập nhật `api-contract.md` Mục 4.3, `hopDong.service.ts:457-464` và OQ-hrm-15 cùng lượt.

---

#### 🟡 ISSUE-HRM-07 — TC-hrm-247 pass vì lý do khác lý do nó ghi; thiếu hẳn ca "cùng nhân viên, kỳ nối tiếp"

| | |
|:---|:---|
| **Mức độ** | 🟡 Medium (khoảng trống bao phủ) · **Ưu tiên** P1 · **Chủ trì: QA** |
| **Vùng** | `docs/hrm/qa/test-cases.md` Mục 6B.11 |
| **Bằng chứng** | `[CHẠY THẬT]` — phép dò C |

**Mô tả.** BE báo TC-hrm-247 là "kỳ vọng lỗi thời". **QA thẩm định lại và kết luận khác.**

TC-hrm-247 viết *"Thêm cùng mã số thuế cho **chính `NV0001`**"* mà **không nêu kỳ**. Dòng không khai kỳ ra bốn cột `null` → `kyGiamTruTheoThang` quy về `(-∞, +∞)` → giao với **mọi** kỳ. Đã dò thật: `kyGiamTruGiaoNhau(dòng-không-kỳ, {01/2026–06/2026})` → **`true`**.

⇒ **Kỳ vọng 409 vẫn đúng.** Ca không lỗi thời.

Cái lỗi thời là **cột lý do**: *"ràng buộc cũ theo từng nhân viên vẫn phải giữ nguyên hiệu lực"* — ràng buộc đó đã bị QĐ #19 bỏ hẳn. Ca đang pass **vì một lý do khác** với lý do nó ghi. Nguy hiểm: nó sẽ vẫn xanh cả khi luật giao-kỳ hỏng, miễn còn nhánh `(-∞,+∞)`.

**Đồng thời phát hiện một khoảng trống thật:** nhánh **"cùng một nhân viên, cùng mã số thuế, kỳ nối tiếp không giao → 201"** — đúng cái BE tưởng TC-hrm-247 đang nói — **không có ca nào phủ**. TC-hrm-246a chỉ phủ nhánh **hai nhân viên khác nhau**.

**Việc phải làm (QA tự nhận).**
1. Viết lại "Kết quả mong đợi" của TC-hrm-247: *409 vì **kỳ để trống trải vô hạn nên giao với mọi kỳ**, không vì ràng buộc cũ theo từng nhân viên.*
2. Thêm **TC-hrm-247a** (P0): *`NV0001` có NPT mã số thuế `8012345678` kỳ `01/2026–06/2026`; thêm cùng mã số thuế cho **chính `NV0001`** kỳ `07/2026` trở đi* → **201**. ⚠️ Ca này sẽ **FAIL ở tầng cơ sở dữ liệu** chừng nào **BUG-HRM-33** chưa sửa — nó cũng là ca bắt lỗi cho BUG-HRM-33.
3. Đổi nhãn **TC-hrm-249** từ "kỳ vọng lỗi thời" (nhãn BE đề nghị) sang **"chưa chạy được — thiếu ràng buộc `EXCLUDE`"**. Đây là **ca quan sát** (*"Ghi nhận hành vi thật và đối chiếu hai tầng… chờ chốt OQ-hrm-26"*), không có kỳ vọng cố định nên **không thể lỗi thời**; hành vi BE mô tả chính là nợ kỹ thuật BA đã chấp nhận (sign-off Mục 7.3, `data-model.md` M-09).

---

### 9.3. Bảng tổng hợp Mục 9

| Mã | Mức | Vùng | Một dòng | Trạng thái |
|:---|:---:|:---|:---|:---|
| BUG-HRM-33 | 🟠 High | Script ràng buộc | `DROP CONSTRAINT IF EXISTS` là lệnh rỗng với unique index của Prisma | Mới — **chặn triển khai** |
| BUG-HRM-34 | 🟠 High | NPT / đồng thời | Khoảng trống không lớp phòng thủ + không transaction | Mới — **chặn triển khai** |
| BUG-HRM-41 | 🟠 High | Giao diện | Ba việc "ship cùng một lượt" chưa làm | Mới — **chặn triển khai** |
| BUG-HRM-35 | 🟡 Medium | Hợp đồng | `loai_hd` không hạ chữ thường khi ghi | Mới |
| BUG-HRM-36 | 🟡 Medium | Phân quyền | `access` trùng `donViId`, phần tử cuối thắng | Mới |
| BUG-HRM-37 | 🔵 Low | Nhân viên | `POST` bỏ im lặng ba trường ngân hàng | Mới |
| BUG-HRM-38 | 🔵 Low | Tài liệu/mã | Chú thích trỏ `POST /hrm/employees` không tồn tại | Mới |
| BUG-HRM-39 | 🔵 Low | Cấp DB | Bỏ kết quả `applyTenantConstraints` | Mới |
| BUG-HRM-40 | 🔵 Low | Xử lý lỗi | So chuỗi con không neo SQLSTATE | Mới (gia cố) |
| ISSUE-HRM-05 | 🟡 Medium | Hạ tầng test | `adminOwner.test.ts` dùng Bearer, hệ thống dùng cookie | Mới — **không phải hồi quy**, đã chứng minh |
| ISSUE-HRM-06 | 🟡 Medium | Đặc tả | `E-hrm-022` mâu thuẫn QĐ #6 | Mới — chuyển BA |
| ISSUE-HRM-07 | 🟡 Medium | Bao phủ test | TC-hrm-247 lý do lỗi thời + thiếu ca kỳ nối tiếp cùng nhân viên | Mới — QA tự sửa |

**Tổng sau Phase B: 44 mục** (32 cũ + 12 mới) — 2 Critical · 13 High · 18 Medium · 11 Low.
**Đóng ở đợt P0: 7 mục** (BUG-HRM-05, 07, 12, 26, 27, 28 và ISSUE-HRM-01) + **1 mục đóng một nửa** (BUG-HRM-25 — máy chủ xong, giao diện chưa).

---

### 9.4. Đầu việc theo thứ tự

**Chặn triển khai — làm trước khi bật bất cứ thứ gì:**

| # | Việc | Chủ trì |
|:--:|:---|:---|
| 1 | Sửa **BUG-HRM-33** (thêm `DROP INDEX IF EXISTS`) + bổ sung `npm run sync:tenants` vào runbook `dev-notes.md` Mục 1.3b | Backend |
| 2 | Xử lý **BUG-HRM-34** — ưu tiên bọc `$transaction` cho hai đường ghi NPT | Backend |
| 3 | Làm ba việc giao diện của **BUG-HRM-41**, triển khai đồng thời với máy chủ | Frontend |
| 4 | Chạy đúng sáu bước triển khai ở `test-report.md` Mục 7 | Chủ dự án / DevOps |

**Trước khi nghiệm thu Phase B:**

| # | Việc | Điều kiện tiên quyết |
|:--:|:---|:---|
| 5 | Dựng khung test tích hợp HRM (`buildApp()` + `app.inject()` + tenant test) — mở khóa **12 ca** đang kẹt | Có cơ sở dữ liệu tenant thử nghiệm |
| 6 | Sửa **ISSUE-HRM-05** để `npm test` xanh 100%; dùng chung khuôn cookie với việc #5 | — |
| 7 | Chạy `hrm:ra-soat` (chỉ đọc) trên tenant thật, đính kèm báo cáo — mở khóa **TC-hrm-251** | Chủ dự án cho phép |
| 8 | Chạy `hrm:constraints` trên tenant thử nghiệm — mở khóa **TC-hrm-209, 210, 249** và xác minh dứt điểm BUG-HRM-33 | Chủ dự án cho phép |
| 9 | **ISSUE-HRM-07**: viết lại lý do TC-hrm-247, thêm TC-hrm-247a, đổi nhãn TC-hrm-249 | — |
| 10 | Bổ sung cột truy vết tiêu chí nghiệm thu cho nhóm 6B.1–6B.10 (nợ từ Phase A, Mục 7.2 điểm 3) | — |
| 11 | Sửa **BUG-HRM-35**, **36** rồi chạy lại nhóm 6B.2 và 6B.13 | Sau việc #5 |
| 12 | Chuyển **ISSUE-HRM-06** cho BA chốt | BA |
