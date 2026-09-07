---
type: test-report
feature: hrm
status: in-review
updated: 2026-09-07
links:
  - docs/hrm/qa/test-cases.md
  - docs/hrm/qa/issues-and-bugs.md
  - docs/hrm/architecture/api-contract.md
  - docs/hrm/architecture/dev-notes.md
  - docs/hrm-ba-signoff-2026-09-07.md
---

# HRM — BÁO CÁO KIỂM THỬ PHASE B (đợt P0)

*Phân hệ Quản lý Nhân sự · MAXV v2 · Kiểm chứng ngày 2026-09-07 · Phạm vi: đợt **P0** theo `docs/hrm-ba-signoff-2026-09-07.md` Mục 5.1 hạng mục 1–5*

> **Kết luận một dòng:** phần **mã nguồn máy chủ** của đợt P0 **đạt** — cả năm hạng mục đã triển khai đúng hợp đồng, không phát hiện lỗi nghiêm trọng nào trong logic nghiệp vụ, không có hồi quy. Nhưng đợt P0 **CHƯA ĐƯỢC PHÉP TRIỂN KHAI**: ba việc bắt buộc "làm cùng một lượt" theo QĐ #8 và Mục 5.1 hạng mục 4 vẫn chưa làm, và bật máy chủ trước sẽ **làm trắng màn hợp đồng của mọi người dùng**.

---

## 1. Tuyên bố trung thực về mức độ tin cậy

> Đọc mục này trước mọi con số phía dưới. Mỗi khẳng định trong báo cáo được gắn đúng một trong bốn nhãn sau.

| Nhãn | Nghĩa | Áp cho |
|:---|:---|:---|
| **[CHẠY THẬT]** | Đã thực thi lệnh, số liệu chép từ đầu ra thật | `typecheck` · `lint` · `npm test` · hai file test HRM · lần chạy đối chứng trên mã trước P0 · 5 phép dò hành vi validator |
| **[ĐỌC MÃ]** | Suy luận từ mã nguồn, kèm `file:line`, **chưa chạy runtime** | Toàn bộ phần đối chiếu mã ↔ hợp đồng ở Mục 4 |
| **[CHƯA KIỂM ĐƯỢC]** | Thiếu hạ tầng; nêu rõ thiếu gì | Mọi ca cần cơ sở dữ liệu tenant, ràng buộc `EXCLUDE`, cột `xemLuong`, giả lập Google, bộ chạy test giao diện |
| **[KHÔNG ĐƯỢC PHÉP]** | Chủ dự án giữ quyền quyết định, QA không chạy | `migrate:sys:deploy` · `hrm:ra-soat` · `hrm:constraints` · mọi thao tác chạm cơ sở dữ liệu |

**Ba giới hạn môi trường khiến phần lớn bộ ca chưa chạy được:**

1. **Chưa chạy migration control plane.** Cột `don_vi_access.xemLuong` **chưa tồn tại** trong cơ sở dữ liệu thật ⇒ mọi ca quyền xem lương chạy đầu-cuối đều không dựng được dữ liệu ban đầu.
2. **Chưa chạy `hrm:constraints`.** Extension `btree_gist`, hàm `hrm_nhom_hd`, `hrm_ky_npt`, hai ràng buộc `EXCLUDE` và unique `so_hd` **chưa tồn tại ở tenant nào** ⇒ toàn bộ ca đồng thời (concurrency) và ca "lớp phòng thủ thứ hai" chưa kiểm được.
3. **Chưa có khung test tích hợp HRM.** Hai file test mới là test **thuần logic** (hàm thuần + schema Zod), không đi qua `buildApp()`/`app.inject()`, không đụng cơ sở dữ liệu. Chúng chứng minh **luật** đúng, **không** chứng minh **endpoint** đúng.

**Không một dòng nào trong báo cáo này tuyên bố "đã tái hiện trên môi trường chạy đầy đủ".** Những gì chạy thật được liệt kê hết ở Mục 2.

---

## 2. Số liệu chạy thật

### 2.1. Ba lệnh bắt buộc `[CHẠY THẬT]`

| Lệnh | Kết quả | Đối chiếu bản trước P0 |
|:---|:---|:---|
| `npm run typecheck` | **exit 0**, không một dòng lỗi | Giữ nguyên sạch |
| `npm run lint` | **exit 0** — `✖ 148 problems (0 errors, 148 warnings)` | Phase A ghi **125 warning**. Chênh **+23**, đối chiếu được từng cái: `scripts/apply-hrm-constraints.ts` **11** + `scripts/ra-soat-hrm.ts` **12** = **23**, toàn bộ là `no-console` trong hai script vận hành mới (script dòng lệnh in tiến độ ra màn hình là đúng vai). **0 error.** |
| `npm test` | **456 tests · 451 pass · 5 fail** · `duration_ms 11261.4038` | Khớp đúng số BE khai (**456/451/5**) |

**Ghi chú quan trọng về lint:** không có **một warning nào** rơi vào `services/client/hrm/*`, `validators/hrm/*`, `controllers/client/hrm/*`, `helpers/resolveTenantDb.ts` hay `services/shared/hrmTenantConstraints.ts`. Toàn bộ +23 nằm trong hai script vận hành.

### 2.2. Hai file test HRM mới `[CHẠY THẬT]`

```
npx tsx --test src/__tests__/hrmHopDong.test.ts src/__tests__/hrmQuyenVaNpt.test.ts
ℹ tests 54 · pass 54 · fail 0 · duration_ms 348.5693
```

`456 − 402 = 54` — toàn bộ phần tăng của bộ test đến từ đúng hai file này, không có test nào khác bị thêm/bớt/đổi. `hrmHopDong.test.ts` 333 dòng · `hrmQuyenVaNpt.test.ts` 286 dòng.

### 2.3. Năm ca fail — **đã tự xác minh, KHÔNG phải hồi quy** `[CHẠY THẬT]`

BE kết luận 5 ca fail ở `adminOwner.test.ts` là có sẵn từ trước. **QA không nhận kết luận này theo lời khai mà chạy lại đối chứng.**

**Cách xác minh:** toàn bộ thay đổi của đợt P0 đang **chưa commit** (`git status`: 22 file `M` + 8 mục `??`), nên `HEAD` (`8a18824`) chính là mã **trước P0**. Tạo `git worktree --detach` tại `HEAD` ở thư mục tạm, nối `node_modules` và `src/generated` bằng junction, sao chép `.env`/`.env.local`, chạy đúng file test đó.

| Môi trường | Kết quả |
|:---|:---|
| Mã **hiện tại** (sau P0) | `tests 5 · pass 0 · fail 5` — bốn ca con hỏng vì `401`, ca cha hỏng theo |
| Mã **trước P0** (`HEAD 8a18824`, worktree sạch) | `tests 5 · pass 0 · fail 5` — **cùng bốn ca, cùng mã 401, cùng thông điệp** |

Bốn assertion hỏng giống hệt nhau ở cả hai lần chạy:

```
① GET /admin/owners            401 !== 200
② GET /admin/owners/:id        401 !== 200
③ owner đạt trần gói           401 !== 403   {"success":false,"message":"Chưa đăng nhập hoặc token không hợp lệ"}
④ owner thường gọi API admin   401 !== 403
```

**Nguyên nhân gốc `[ĐỌC MÃ]`:** `adminOwner.test.ts:31-41` xác thực bằng header `Authorization: Bearer <token>`, nhưng dự án đã chuyển sang cookie httpOnly từ commit `2d791dc` ("Implement cookie-based authentication and session management") — `plugins/jwt.plugin.ts:19-28` cấu hình `@fastify/jwt` đọc token từ cookie. Đợt P0 **không chạm** `src/plugins/` hay `src/app.ts` (`git diff --stat HEAD` trên hai đường dẫn đó trả về rỗng), và cả bốn ca đều hỏng ở tầng xác thực **trước khi** vào controller.

> ✅ **QA xác nhận kết luận của BE là đúng, bằng lần chạy đối chứng chứ không bằng suy luận.** Đợt P0 **không gây hồi quy nào**. Năm ca fail này là nợ kỹ thuật riêng của `adminOwner.test.ts` (ghi thành **ISSUE-HRM-05** trong sổ bug) — không thuộc phạm vi HRM, nhưng đang che mất tín hiệu của bộ test và phải sửa.

### 2.4. Năm phép dò hành vi do QA tự viết `[CHẠY THẬT]`

Chạy bằng script tạm ngoài repo (không thêm file vào `src/__tests__/`), nạp trực tiếp validator và hàm thuần của sản phẩm:

| # | Dò cái gì | Kết quả thật | Ý nghĩa |
|:--:|:---|:---|:---|
| A | `access` chứa **trùng** `donViId`, cờ ngược nhau | **Qua validator**, giữ nguyên cả hai phần tử | → **BUG-HRM-36** (thu hồi quyền âm thầm) |
| B | Gửi **cả** `access` lẫn `donViIds` | `access` thắng, `donViIds` bị bỏ | Hành vi hợp lý, không phải lỗi |
| C | Dòng NPT mới **không khai kỳ** so với kỳ `01/2026–06/2026` | Bốn cột về `null` → kỳ `(-∞, +∞)` → **giao nhau = true** | **Quyết định lại số phận TC-hrm-247** — xem Mục 6 |
| D | Kỳ **nối tiếp** `…06/2026` vs `07/2026…` | **không giao** | QĐ #19 đúng như thiết kế |
| E | `loai_hd = "  KHOAN  "` qua validator | ra `"KHOAN"` — **không hạ chữ thường** | → **BUG-HRM-35** (hợp đồng đòi chuẩn hóa) |

---

## 3. Đối chiếu 81 ca của Mục 6B với hiện trạng

> Mục 6B có **81 dòng ca** (toàn file `test-cases.md` có **266** mã ca duy nhất; 6B là tập con phủ 13 quyết định nghiệp vụ). Phân loại dưới đây dùng đúng ba nhãn mà nhiệm vụ yêu cầu.

### 3.1. Tổng hợp

| Nhóm | Số ca | ✅ Đã pass (chạy thật) | 🟡 Pass một phần | ⬜ Chưa chạy được | ⚠️ Kỳ vọng cần sửa |
|:---|:--:|:--:|:--:|:--:|:--:|
| 6B.1 Ghi nhận nghỉ việc (P1) | 7 | 0 | 0 | 7 | 0 |
| 6B.2 Số hợp đồng duy nhất | 3 | 0 | 0 | 3 | 0 |
| 6B.3 Ràng buộc lương | 5 | 4 | 0 | 1 | 0 |
| 6B.4 Hợp đồng một ngày + chồng lấn | 13 | 9 | 2 | 2 | 0 |
| 6B.5 Quyền xem dữ liệu lương | 6 | 3 | 0 | 3 | 0 |
| 6B.6 Quyền Google Drive (P1) | 3 | 0 | 0 | 3 | 0 |
| 6B.7 Phòng ban ngừng hoạt động (P1) | 4 | 0 | 0 | 4 | 0 |
| 6B.8 Xóa giấy tờ kèm file (P1) | 3 | 0 | 0 | 3 | 0 |
| 6B.9 Bộ giấy tờ bắt buộc (**P2 — BA giữ lại**) | 12 | 0 | 0 | 12 | 0 |
| 6B.10 Nhật ký, HĐ tương lai, hiệu năng (P1/P2) | 7 | 0 | 0 | 7 | 0 |
| 6B.11 NPT duy nhất mã số thuế | 9 | 3 | 1 | 5 | **1** |
| 6B.12 Lỗi kỹ thuật dùng chung | 3 | 0 | 0 | 3 | 0 |
| 6B.13 Quy tắc từ vòng phản biện | 6 | 1 | 1 | 4 | 0 |
| **Tổng** | **81** | **20** | **4** | **57** | **1** |

**Đọc bảng này cho đúng:** 20 ca "đã pass" là **pass ở tầng luật** (hàm thuần + schema Zod), **không phải** pass đầu-cuối qua HTTP. Chúng chứng minh công thức nghiệp vụ đúng; chúng **không** chứng minh mã trạng thái HTTP, hình dạng phản hồi, hay việc guard có thật sự chạy trên đường request.

### 3.2. Hai mươi ca đã pass — có bằng chứng chạy `[CHẠY THẬT]`

| Ca | Kiểm bởi | Nội dung |
|:---|:---|:---|
| TC-hrm-196 · 197 · 198 · 199 | `hrmHopDong.test.ts:212, 220, 230, 242` | Ràng buộc lương: `= 0` chặn · không gửi cũng chặn · bật BHXH mà lương BHXH `= 0` chặn · tắt BHXH thì bỏ trống hợp lệ |
| TC-hrm-201 | `:189` | Hợp đồng đúng một ngày hợp lệ |
| TC-hrm-202 | `:80` | Hai hợp đồng một-ngày cùng ngày **là** chồng lấn (ca phân biệt khoảng đóng với nửa mở) |
| TC-hrm-203 | `:65` | Chạm nhau đúng một ngày (31/03) là chồng lấn |
| TC-hrm-204 · 205 · 205a · 205b · 205c | `:110, 130, 140, 151, 120` | Khác nhóm song song được · cùng nhóm chặn · **khác nhãn cùng nhóm vẫn chặn** · nhãn viết hoa không lách được · thử việc là nhóm riêng |
| TC-hrm-206 | `:272` | Thiếu `loai_hd_can_chot` → lỗi kiểm dữ liệu |
| TC-hrm-212 · 213 | `hrmQuyenVaNpt.test.ts:117, 127` | Không có quyền → **ba khóa vắng mặt** (không phải `null`) · có quyền → đủ trường |
| TC-hrm-214 | `hrmHopDong.test.ts:294` | Thiếu `ma_nv` → lỗi kiểm dữ liệu (đóng đường lấy hợp đồng toàn công ty) |
| TC-hrm-246a · 246b · 250 | `hrmQuyenVaNpt.test.ts:71, 79, 87` | Kỳ nối tiếp hợp lệ · chạm một tháng là giao nhau · kỳ cũ bỏ trống ngày kết thúc thì vẫn chặn |
| TC-hrm-255 | `hrmHopDong.test.ts:314` | Sửa nhân viên thiếu `status` → lỗi kiểm dữ liệu |

### 3.3. Bốn ca pass một phần

| Ca | Phần đã chạy | Phần còn thiếu |
|:---|:---|:---|
| TC-hrm-208 | `homNayVN()` tại 02:00 và 23:00 giờ VN đều ra đúng ngày (`hrmHopDong.test.ts:163, 177`) | Chưa chạy được vế "`doiHopDong` tìm đúng hợp đồng lúc 02:00" — cần cơ sở dữ liệu |
| TC-hrm-210 | Nhận diện lỗi theo **tên ràng buộc** thay vì `error.code` (`hrmQuyenVaNpt.test.ts:163, 181`) | Vế đồng thời thật — cần ràng buộc `EXCLUDE` đã áp |
| TC-hrm-246 | Luật giao kỳ (`:63`) | Vế đầu-cuối "409 nêu đích danh mã và họ tên" — cần cơ sở dữ liệu |
| TC-hrm-258 | Dạng thân yêu cầu cũ để `xemLuong` **không xác định** (`:214`) | Vế "quyền ở công ty A vẫn còn sau khi sửa danh sách" — cần cột `xemLuong` |

### 3.4. Năm mươi bảy ca chưa chạy được — thiếu đúng cái gì

| Thiếu hạ tầng gì | Ca bị chặn | Số ca |
|:---|:---|:--:|
| **Cột `don_vi_access.xemLuong`** (chưa chạy `migrate:sys:deploy`) | TC-hrm-211, 215, 256, 257, 259, 260 | 6 |
| **Ràng buộc `EXCLUDE` + hàm SQL** (chưa chạy `hrm:constraints`) | TC-hrm-209, 210 (vế đồng thời), 249, 251 | 4 |
| **Cơ sở dữ liệu tenant + khung test tích hợp** (chưa có mẫu `buildApp()`/`app.inject()` cho HRM) | TC-hrm-193, 194, 195, 200, 207, 242, 243, 245, 246c, 247, 248, 250 (vế đầu-cuối) | 12 |
| **Chức năng đợt P1 chưa triển khai** (nghỉ việc · Drive · phòng ban · xóa tài liệu · nhật ký) | TC-hrm-186…192, 217…219, 220…223, 224…226, 239…241, 244 | 22 |
| **Đợt P2 do BA giữ lại** (OQ-hrm-13, OQ-hrm-14 chưa chốt) | TC-hrm-227…238 | 12 |
| **Mã lỗi `E-hrm-062/063/064` chưa tồn tại** — envelope phản hồi vẫn chưa có trường `code` (`api-contract.md` Mục 8, `ADR-005`) | TC-hrm-252, 253, 254 | 3 |
| **Không có bộ chạy test ở cả ba ứng dụng giao diện** | TC-hrm-216 | 1 |

> Một ca có thể thiếu nhiều thứ; bảng xếp theo rào cản **nặng nhất**. Tổng 57 không cộng trùng.

---

## 4. Đối chiếu mã ↔ hợp đồng — từng hạng mục P0

> BE tự khai đã làm 7 hạng mục. QA **không nhận lời khai**, đọc lại mã và đối chiếu với `api-contract.md` + `hrm-spec.md`. Mỗi kết luận kèm `file:line`.

### 4.1. Chống chồng lấn hợp đồng — BR-hrm-022, contract 4.2b `[ĐỌC MÃ]` + `[CHẠY THẬT]`

| Điểm hợp đồng đòi | Hiện trạng | Bằng chứng |
|:---|:---:|:---|
| Gọi ở **cả ba** đường ghi | ✅ **Đủ ba** | `hopDong.service.ts:354` (create) · `:386` (update, có `boQuaId = id`) · `:474` (doi) |
| Khóa theo **nhóm nghiệp vụ**, không theo nhãn thô | ✅ Đúng | `:110` — `loaiHdVeNhanVien(a.loai_hd) === loaiHdVeNhanVien(b.loai_hd)`; hàm gom nhóm ở `:60-65`, hạ chữ thường + cắt khoảng trắng ở `:61` |
| Khoảng ngày **đóng hai đầu** (hợp đồng một ngày phải bị bắt) | ✅ Đúng | `:88-90` — `aBatDau <= bDen && bBatDau <= aDen`, không có dấu `<` chặt nào. TC-hrm-202 pass thật |
| `doiHopDong` tìm hợp đồng cần chốt **trong đúng nhóm** | ✅ Đúng | `:437` `nhomCanChot = loaiHdVeNhanVien(loaiHdCanChot)` → `:447-449` `dangHieuLuc.find(hd => loaiHdVeNhanVien(hd.loai_hd) === nhomCanChot)` |
| Một chỗ phát biểu luật duy nhất, kiểm thử được không cần DB | ✅ Đúng | Hàm thuần `hopDongChongLan` `:108-118`; bản có DB `assertKhongChongLan` `:253-296` chỉ lọc thô rồi gọi lại hàm thuần ở `:288` |
| Nằm **trong** cùng transaction với bước ghi | ✅ Đúng | Cả ba đường bọc `db.$transaction` — `:351`, `:375`, `:419` |
| Bản SQL khớp bản TypeScript | ✅ Khớp | `hrmTenantConstraints.ts:45-50` (`BIEU_THUC_NHOM_HD`) và `:103` (`sqlKhoangHopDong` dùng `'[]'`); test hình dạng `hrmQuyenVaNpt.test.ts:250, 264` pass |

**Kết luận: hạng mục 1 đạt.** Bổ sung: truy vấn lọc thô ở `:267-284` là **tập cha** đúng nghĩa (nới ở cả hai đầu bằng `gte`/`lte`, bỏ hẳn vế trên khi `ketThuc = null`) nên không cắt mất ứng viên nào trước khi hàm thuần quyết định — đây là chỗ dễ sai mà mã làm đúng.

### 4.2. Mốc giờ Việt Nam — BUG-HRM-07 `[CHẠY THẬT]`

- `grep -rn "setUTCHours" src/` → chỉ còn **trong chú thích** (`hopDong.service.ts:123, 426`) và trong test giữ lại làm đối chứng cái sai cũ (`hrmHopDong.test.ts:170`). **Không còn dòng mã thực thi nào.**
- Đường **đọc** và đường **đổi hợp đồng** dùng **chung một hàm**: `chonHopDongHienHanh` gọi `homNayVN()` tại `:164`, `doiHopDong` gọi tại `:436`. Hai bên không thể lệch bảy tiếng nữa.
- `ngayISO` (`validators/shared/primitives.ts:49-61`) sinh `Date` tại **nửa đêm UTC**, cùng mốc với `homNayVN()` (`:128-133`) và cùng mốc với cột `@db.Date` — ba nơi so sánh ngày dùng chung một quy ước.

**Kết luận: hạng mục 2 đạt.** BUG-HRM-07 đóng.

### 4.3. Ràng buộc lương — BR-hrm-057/058 `[CHẠY THẬT]`

- Đặt ở **validator**, trên `thanHopDong` là gốc chung của cả ba schema ⇒ áp cho create/update/doi qua **một** khai báo: `hopDong.validator.ts:97-116` (`soatLuong`) gộp vào `soatChungHopDong` `:119-131`, dùng ở `:134`, `:139`, `:169`.
- `luong_bhxh` **chỉ** bắt buộc khi `trich_bhxh === true`: `:108` — `if (v.trich_bhxh && !(v.luong_bhxh > 0))`. Tắt BHXH thì bỏ trống hợp lệ (TC-hrm-199 pass thật).
- Lỗi về đúng dạng `400` kèm `fieldErrors` gắn được vào ô nhập (`path: ['luong_chinh']` / `['luong_bhxh']`).

**Kết luận: hạng mục 3 đạt.**

### 4.4. `status` bắt buộc khi sửa nhân viên — BR-hrm-067 `[CHẠY THẬT]`

`nhanVien.validator.ts` — `nhanVienUpdateSchema` `.extend({ status: z.enum(['0','1'], { required_error, invalid_type_error }) })`, đè hẳn mặc định `'1'` của schema tạo mới. Ba ca đối chứng đều pass: thiếu → 400 (`hrmHopDong.test.ts:314`), có → giữ đúng giá trị (`:322`), giá trị rác → 400 chứ không im lặng quy về mặc định (`:328`).

**Kết luận: hạng mục 5 đạt.** BUG-HRM-26 đóng. Giao diện `hdđt_maxv` đã gửi sẵn `status` (`nhanVienApi.ts:71` khai bắt buộc, form có ô chọn ở `nhan_vien/tabs/ThongTinTab.tsx:245`) nên **không** gây vỡ giao diện.

### 4.5. `so_hd` duy nhất toàn công ty — BR-hrm-056 `[ĐỌC MÃ]`

- Pre-check `assertSoHdDuyNhat` `hopDong.service.ts:308-326`, gọi ở `:353` (create), `:385` (update), `:421` (doi).
- **Vế loại trừ chính dòng đang sửa có mặt**: `:385` truyền `id` làm `boQuaId`, và hàm dịch thành `id: { not: boQuaId }` ở `:316`. **Không thiếu vế này** — nếu thiếu thì mọi lần sửa hợp đồng đều 409, và đây là chỗ nhiệm vụ yêu cầu soi kỹ.
- Không lọc `nhan_vien.da_xoa` — **cố ý và đúng**: khóa duy nhất ở cơ sở dữ liệu phủ mọi dòng, lọc ở tầng ứng dụng sẽ cho qua rồi vỡ ở tầng dưới với câu chung chung (`:303-304`).
- Lớp hai: `CREATE UNIQUE INDEX IF NOT EXISTS "hrm_hop_dong_so_hd_key"` (`hrmTenantConstraints.ts:150-151`) — **chưa áp**.

**Kết luận: hạng mục 2 (vế số hợp đồng) đạt ở tầng ứng dụng.** BUG-HRM-12 đóng ở tầng ứng dụng; tầng cơ sở dữ liệu chờ chạy script.

### 4.6. Người phụ thuộc theo kỳ — BR-hrm-030, QĐ #19 `[CHẠY THẬT]` + `[ĐỌC MÃ]`

| Điểm hợp đồng đòi | Hiện trạng | Bằng chứng |
|:---|:---:|:---|
| **Xét kỳ giao nhau**, không chặn phẳng theo mã số thuế | ✅ Đúng | `nguoiPhuThuoc.service.ts:174` — `cungMst.find(r => kyGiamTruGiaoNhau(ky, r))`, **không** phải `findFirst({ mst })` |
| Phạm vi **toàn công ty** (đóng BUG-HRM-05) | ✅ Đúng | `:155-160` — `where: { mst, nhan_vien: { da_xoa: false } }`, **không** có `ma_nv` |
| Kỳ **đóng hai đầu ở tầng tháng** | ✅ Đúng | `:125` — `x.tu <= y.den && y.tu <= x.den` trên thang `nam*12 + thang`. Kết thúc T6 vs bắt đầu T6 → giao (TC-hrm-246b pass); …T6 vs T7… → không giao (TC-hrm-246a pass) |
| **Bỏ qua** dòng của nhân viên đã xóa mềm | ✅ Đúng | `:158` — `nhan_vien: { da_xoa: false }` |
| Loại trừ chính dòng đang sửa | ✅ Đúng | `:213` truyền `id`, dịch thành `id: { not: boQuaId }` ở `:159` |
| `mst` rỗng không bị chặn | ✅ Đúng | `:153` — `if (!mst) return` |
| Hai tầng khớp nhau | ✅ Khớp | `hrmTenantConstraints.ts:60-67` dùng `'[)'` ở **tầng ngày** để diễn tả khoảng **đóng ở tầng tháng** — tương đương bản TypeScript. Test hình dạng `hrmQuyenVaNpt.test.ts:270` pass |

Bốn cột kỳ dùng `.nullable().optional().default(null)` (`nguoiPhuThuoc.validator.ts:50-66`) nên trường thiếu về `null` **chứ không phải `undefined`** — `kyGiamTruTheoThang` kiểm `=== null` nên **không** có đường sinh `NaN` làm phép so giao nhau im lặng trả `false`. **QA đã dò riêng điểm này (phép dò C) và xác nhận sạch.**

**Kết luận: hạng mục 2 (vế người phụ thuộc) đạt ở tầng ứng dụng.** BUG-HRM-05 đóng ở tầng ứng dụng.

> ⚠️ **Nhưng có một lỗ mở ra do chính đợt này** — xem **BUG-HRM-34**: hai đường ghi người phụ thuộc **không bọc transaction** (`:188-196`, `:204-222`), và hợp đồng từng biện minh cho điều đó bằng câu "khóa duy nhất ở cơ sở dữ liệu là chốt cuối" (`api-contract.md` Mục 5.2b). Đợt này **bỏ** `@@unique([ma_nv, mst])` khỏi schema mà ràng buộc thay thế **chưa áp** ⇒ trong khoảng thời gian đó **không còn lớp phòng thủ nào**.

### 4.7. Quyền xem dữ liệu lương — BR-hrm-059/068, contract 3.1c + 7C `[ĐỌC MÃ]` + `[CHẠY THẬT]`

| Điểm hợp đồng đòi | Hiện trạng | Bằng chứng |
|:---|:---:|:---|
| Đọc từ **cơ sở dữ liệu mỗi lượt gọi**, **cấm** nhét vào vé đăng nhập (BR-hrm-068) | ✅ Đúng | `helpers/resolveTenantDb.ts:66` lấy `access: { where: { userId }, select: { xemLuong: true }, take: 1 }` **trong chính truy vấn `donVi.findFirst`** đang có sẵn. *(Hiệu chỉnh sau khi đo thật: KHÔNG phải 0 round-trip — Prisma bắn một truy vấn riêng cho quan hệ, tốn thêm ~0,36 ms mỗi lượt.)* `grep xemLuong` trong `src/plugins/`, `src/services/client/auth.service.ts` → **không có**. Cờ không hề đi vào token |
| Suy quyền của `OWNER` | ✅ Đúng | `:79-80` — `role === 'OWNER' \|\| (company.access[0]?.xemLuong ?? false)` |
| `ADMIN` không có phạm vi tenant (BR-hrm-051, TC-hrm-215) | ✅ Đúng | `helpers/access.ts:23` trả `null` cho mọi vai khác → `resolveTenantDb.ts:56-58` ném 403 |
| Chặn **nguyên cụm** `/hop-dong` → 403 E-hrm-058 | ✅ Đúng, một chỗ duy nhất | `controllers/client/hrm/hopDong.controller.ts` — `dbCoQuyenLuong()` gọi `assertXemLuong` rồi được dùng ở **cả năm** đường (list/create/doi/update/remove) |
| `GET /nhan-vien` **bỏ hẳn khóa**, không trả `null` | ✅ Đúng | `nhanVien.service.ts:56-64` — `delete ban[truong]` cho `['so_tai_khoan','ten_tai_khoan','ngan_hang']` (`:47`). Test khóa-vắng-mặt pass (`hrmQuyenVaNpt.test.ts:117`) |
| Đường **ghi** nhân viên **bỏ qua** ba trường, **không** nhận `null` rồi ghi đè | ✅ Đúng — **không** dính lỗi kiểu BUG-HRM-11 | `nhanVien.service.ts:75-85` `boTruongLuongKhiGhi` **xóa khóa** khỏi payload; dùng ở `:252-254` (create) và `:277-278` (update). Prisma bỏ qua khóa vắng mặt ⇒ **giữ nguyên giá trị cũ**, không xóa trắng |
| **Không** rò `luong_chinh`/`luong_bhxh` qua `/nhan-vien` | ✅ Sạch | `phanHopDong` (`:197-206`) **liệt kê tường minh 6 trường**, **không** `...spread` — dù `hopDongSelect` (`hopDong.service.ts:21-22`) có kéo hai cột lương về bộ nhớ. Đây là chỗ rất dễ rò và mã tránh được |
| `setEmployeeAccess` ghi **theo cặp khóa** (BUG-HRM-28) | ✅ Đúng — **không còn replace-set** | `company.service.ts:406-411` chỉ `deleteMany` các `donViId` **không còn trong danh sách** (`notIn`), rồi `:413-427` `upsert` từng cặp. `update: item.xemLuong === undefined ? {} : {...}` ⇒ dạng thân yêu cầu cũ **giữ nguyên** cờ đang có |
| Cặp **mới** mặc định không được xem (QĐ #17) | ✅ Đúng | `:420` — `xemLuong: item.xemLuong ?? false` |
| Nhật ký ghi cả cờ quyền lương | ✅ Đúng | `:432-441` — `chiTiet.access` gồm `{ donViId, xemLuong }` |
| Chỉ `OWNER` gọi được | ✅ Đúng | `routes/company.route.ts:65` — `preHandler: [app.authenticate, app.requireRole('OWNER')]`; thêm guard sở hữu ở `company.service.ts:384-401` |

**Kết luận: hạng mục 4 đạt ở phần máy chủ.** BUG-HRM-25, BUG-HRM-28 đóng ở phần máy chủ. **Ba vế còn lại của hạng mục 4 chưa làm — xem Mục 7.**

### 4.8. Migration control plane — BR-hrm-069 `[ĐỌC MÃ]`

`prisma/sys/migrations/20260907090000_add_xem_luong_to_don_vi_access/migration.sql`:

- Dòng 9: `ALTER TABLE "don_vi_access" ADD COLUMN "xemLuong" BOOLEAN NOT NULL DEFAULT false;`
- **Dòng 20: `UPDATE "don_vi_access" SET "xemLuong" = true;`** ✅ **CÓ MẶT**, kèm 9 dòng chú thích nói rõ vì sao không được bỏ.

**Kết luận: BR-hrm-069 được tôn trọng.** Đây là câu chặn "ngày triển khai mọi kế toán mất màn hợp đồng" và nó **không** bị bỏ sót. TC-hrm-259 và TC-hrm-260 đối chiếu tĩnh **đạt**; chạy thật thì **[KHÔNG ĐƯỢC PHÉP]**.

### 4.9. Hai script vận hành `[ĐỌC MÃ]`

| Yêu cầu | Kết quả |
|:---|:---|
| Script rà soát **chỉ đọc** | ✅ **Sạch.** `scripts/ra-soat-hrm.ts` chỉ `findMany` + `console.log`. `raSoatTenant` (`hrmTenantConstraints.ts:400-421`) chỉ `client.query(muc.sql)` với bốn hằng `SQL_QUET_*` — **cả bốn đều mở đầu bằng `SELECT`**, không một `CREATE`/`ALTER`/`INSERT`/`UPDATE`/`DELETE` nào |
| Câu quét chạy được **trước khi** áp ràng buộc | ✅ Đúng — bốn câu nội suy thẳng biểu thức từ cùng hằng số dùng để tạo hàm (`:330, 332, 358`), **không** phụ thuộc hàm `hrm_nhom_hd`/`hrm_ky_npt` đã tồn tại. Đúng thứ tự nghiệp vụ |
| Câu quét M-09 có xét kỳ **và** phân biệt hồ sơ đã xóa mềm | ✅ Đúng — `SQL_QUET_NPT_TRUNG_MST` `:344-359` có `a_da_xoa`/`b_da_xoa` qua `LEFT JOIN`, và điều kiện giao kỳ `&&` |
| Script áp ràng buộc **idempotent** | ⚠️ **Gần đủ — một câu không idempotent theo cách nó tưởng.** `CREATE EXTENSION IF NOT EXISTS` · `CREATE OR REPLACE FUNCTION` · `CREATE INDEX IF NOT EXISTS` · bắt `42710` cho `ADD CONSTRAINT` (`:268-270`): **đúng hết**. Nhưng câu `DROP CONSTRAINT IF EXISTS "hrm_nguoi_phu_thuoc_ma_nv_mst_key"` (`:157-158`) là **lệnh rỗng** — xem **BUG-HRM-33** |
| Không nuốt lỗi dữ liệu | ✅ Đúng — `23P01`/`23505` gom vào `vuongDuLieu` và in ra, mọi mã khác `throw` lên (`:245-259`, `:266-284`) |
| Tenant mới tự có ràng buộc | ✅ Có gọi — `provisioning.service.ts` chèn `applyTenantConstraints(dbName)` giữa `pushTenantSchema` và bước đánh dấu READY. ⚠️ Kết quả trả về bị bỏ (xem BUG-HRM-39) |

---

## 5. Thẩm định năm quyết định BE tự đưa ra

| # | Quyết định của BE | Thẩm định của QA | Lý do |
|:--:|:---|:---:|:---|
| **a** | Bỏ `@@unique([ma_nv, mst])` khỏi `prisma/tenant/schema.prisma` | ✅ **Chấp nhận được** — nhưng **chưa đủ** | Đúng về nguyên tắc: giữ lại thì mỗi `db push` Prisma dựng lại khóa cũ còn script drop đi, hai tầng đá nhau vô tận. **Nhưng** nó biến `sync:tenants` thành **bước bắt buộc** để M-09 bước 1 có hiệu lực, trong khi runbook ở `dev-notes.md` Mục 1.3b chỉ ghi ba lệnh **không có** `sync:tenants`. Kèm hệ quả nặng hơn ở **BUG-HRM-34** |
| **b** | Đặt `so_hd` unique ở script thay vì trong `schema.prisma` | ✅ **Chấp nhận, đồng ý hẳn** | Lập luận đúng và kiểm chứng được: khai trong schema thì `db push` **fail toàn bộ** trên tenant còn số hợp đồng trùng, kéo theo mọi thay đổi schema khác của tenant đó cũng không lên được. Ở script thì chỉ riêng bước đó báo lỗi và gom vào `vuongDuLieu`. Đây là đánh đổi đúng chiều: **hỏng nhỏ tại chỗ** thay vì **hỏng lan** |
| **c** | `PUT /companies/employees/:userId/access` nhận **cả hai** dạng thân yêu cầu | ✅ **Chấp nhận** — nhưng phải có hạn dùng | Cần thiết thật: giao diện `maxv/` chưa sửa (xác minh: `grep xemLuong maxv/src` → **0 kết quả**), máy chủ lên trước mà chỉ nhận dạng mới thì màn phân quyền chết ngay. Ngữ nghĩa cũng đúng — `xemLuong` để `optional` chứ không `default(false)`, nên "không gửi" nghĩa là **giữ nguyên** chứ không phải **thu hồi** (`company.validator.ts` + `company.service.ts:426`), đúng tinh thần QĐ #17. **Yêu cầu kèm theo:** ghi hạn gỡ dạng cũ vào sổ nợ kỹ thuật, nếu không nó sẽ sống mãi và che mất việc giao diện chưa làm |
| **d** | Giữ nguyên `E-hrm-022` (`ngay_chot <= ngay_bat_dau` → 409) | ✅ **Chấp nhận, đúng vai** | `api-contract.md` Mục 4.3 bước 3b **vẫn đang ghi `<=`**. Kỹ sư bám hợp đồng là đúng vai; đổi vế này khi hợp đồng chưa đổi mới là vượt quyền. Mã có chú thích trỏ đúng chỗ (`hopDong.service.ts:457-459` → OQ-hrm-15). **Nhưng QA ghi nhận đây là mâu thuẫn thật với QĐ #6**: từ khi hợp đồng một ngày hợp lệ, chốt đúng ngày bắt đầu là thao tác có nghĩa mà đang bị chặn. **Chuyển cho BA quyết** (ISSUE-HRM-06) |
| **e** | Giữ tên tham số hàm `hrm_ky_npt` đúng như tài liệu | ✅ **Chấp nhận, và lý do đưa ra là lý do đúng** | `CREATE OR REPLACE FUNCTION` **từ chối đổi tên tham số** của hàm đã tồn tại (SQLSTATE `42P13`), nên một lần đặt lệch tên là script **mất tính idempotent trên chính cơ sở dữ liệu nó vừa chạy**. Chỗ gọi trong ràng buộc loại trừ truyền theo **vị trí** nên tên không ảnh hưởng gì. Đây là quyết định kỹ thuật chính xác, không phải né việc |

**Tổng: 5/5 chấp nhận được.** Hai cái (a, c) kèm điều kiện; một cái (d) cần BA chốt lại vì hợp đồng đang tự mâu thuẫn với QĐ #6.

---

## 6. Thẩm định lại hai ca BE cho là "kỳ vọng lỗi thời"

> Nhiệm vụ yêu cầu **không nhận nguyên**. QA đã dò thực nghiệm và **kết luận khác BE ở cả hai ca**.

### 6.1. TC-hrm-247 — **BE nói sai. Kỳ vọng 409 GIỮ NGUYÊN.**

**BE lập luận:** ca này mâu thuẫn QĐ #19 vì hai dòng cùng nhân viên mà kỳ không giao nhau là hợp lệ.

**QA phản biện, có bằng chứng chạy `[CHẠY THẬT]` (phép dò C):** ca kiểm thử viết là *"Thêm cùng mã số thuế cho **chính `NV0001`**"* — **không nêu kỳ nào**. Dòng không khai kỳ đi qua `nguoiPhuThuocBodySchema` ra bốn cột `null`, `kyGiamTruTheoThang` quy về `(-∞, +∞)`, và `kyGiamTruGiaoNhau` với kỳ `01/2026–06/2026` trả **`true`**.

⇒ **Chạy đúng nguyên văn ca này với mã hiện tại vẫn ra 409.** Kỳ vọng **đúng**, kết quả **không đổi**.

Cái **thật sự lỗi thời** là **cột lý do**: *"ràng buộc cũ theo từng nhân viên vẫn phải giữ nguyên hiệu lực"* — ràng buộc đó (`@@unique([ma_nv, mst])`) đã bị QĐ #19 bỏ hẳn. Ca đang pass **vì lý do khác** với lý do nó ghi, và đó là loại ca nguy hiểm: nó sẽ vẫn xanh cả khi luật giao-kỳ hỏng, miễn là còn nhánh `(-∞,+∞)`.

**Việc phải làm (QA tự nhận):**
1. Viết lại cột "Kết quả mong đợi" của TC-hrm-247: *409 vì **kỳ để trống trải vô hạn nên giao với mọi kỳ**, không vì ràng buộc cũ theo từng nhân viên.*
2. **Thêm ca mới TC-hrm-247a** (đang thiếu, và chính là ca BE tưởng đang tồn tại): *`NV0001` có NPT mã số thuế `8012345678` kỳ `01/2026–06/2026`; thêm cùng mã số thuế cho **chính `NV0001`** kỳ `07/2026` trở đi* → **201**. Không có ca này thì nhánh "cùng nhân viên, kỳ nối tiếp" của QĐ #19 **không được phủ ở đâu cả**.

### 6.2. TC-hrm-249 — **BE gán sai nhãn. Ca KHÔNG lỗi thời, mà là CHƯA CHẠY ĐƯỢC.**

**BE lập luận:** tầng ứng dụng cho qua, tầng cơ sở dữ liệu sẽ chặn ⇒ kỳ vọng lỗi thời.

**QA phản biện `[ĐỌC MÃ]`:** đọc lại nguyên văn ca — *"**Ghi nhận hành vi thật và đối chiếu hai tầng.** … Hai tầng phải nói giống nhau — chờ chốt OQ-hrm-26"*. Đây là **ca quan sát**, không phải ca có kỳ vọng cố định. Nó **không thể lỗi thời** vì nó không khẳng định kết quả nào.

Hơn nữa hành vi BE mô tả **chính là hành vi đã được BA chấp nhận** và ghi thành nợ kỹ thuật ở `hrm-ba-signoff-2026-09-07.md` Mục 7.3 + `data-model.md` M-09: tầng ứng dụng bỏ qua hồ sơ đã xóa mềm (`nguoiPhuThuoc.service.ts:158`), ràng buộc loại trừ **không tham chiếu được bảng khác** nên không bỏ qua được. Hai tầng **cố ý** lệch nhau một chút.

⇒ Nhãn đúng cho TC-hrm-249 là **⬜ chưa chạy được — thiếu ràng buộc `EXCLUDE`**. Khi chạy được, việc của nó là **ghi lại** cả hai hành vi để BA chốt OQ-hrm-26, chứ không phải pass/fail.

> **Nhận xét quy trình:** cả hai lần, BE gọi "kỳ vọng lỗi thời" cho thứ thực ra là *lý do lỗi thời* (247) và *ca chưa chạy được* (249). Cả hai đều **không** cần QA sửa kỳ vọng. Nếu nhận nguyên lời khai thì TC-hrm-247 bị hạ kỳ vọng xuống 201 và nhánh chặn thật sẽ mất người canh.

---

## 7. Việc CHẶN triển khai — quan trọng hơn mọi mục trên

> Ba việc này **không phải lỗi của mã máy chủ**. Chúng là các vế còn thiếu của đúng những hạng mục mà BA đã ghi rõ **"ship cùng một lượt"** (`hrm-ba-signoff-2026-09-07.md` Mục 5.1 hạng mục 1 và 4). Bật máy chủ mà thiếu chúng thì hỏng nặng hơn là chưa bật.

| # | Việc thiếu | Hậu quả nếu bật máy chủ ngay | Bằng chứng |
|:--:|:---|:---|:---|
| **1** | Giao diện vẫn gọi lịch sử hợp đồng **không tham số** | **Màn hợp đồng trắng với 100% người dùng.** Máy chủ nay bắt buộc `ma_nv` → mọi lượt gọi nhận **400** | `hdđt_maxv/src/features/hrm/api/hopDongQueries.ts:72` — `queryFn: () => listHopDong()`. `git status` trên `hdđt_maxv/` và `maxv/`: **không một thay đổi nào** |
| **2** | Giao diện chưa gửi `loai_hd_can_chot` | **Chức năng đổi hợp đồng chết hoàn toàn** — trường nay bắt buộc, mọi lượt gọi nhận **400** | `hdđt_maxv/src/features/hrm/api/hopDongApi.ts` — `DoiHopDongApiBody extends HopDongApiCreateBody { ngay_chot: string \| null }`, **không có** `loai_hd_can_chot` |
| **3** | `maxv/` chưa có màn cấp quyền xem lương (contract 7C.4, FR-hrm-044) | Cột quyền tồn tại mà **không ai cấp hay thu hồi được**. Nhờ bước chuyển dữ liệu (QĐ #17) người cũ vẫn xem được, nhưng **mọi nhân viên được cấp quyền vào công ty sau ngày triển khai sẽ vĩnh viễn không xem được lương** | `grep -rn "xemLuong" maxv/src "hdđt_maxv/src"` → **0 kết quả** |

**Thứ tự triển khai bắt buộc** (thiếu bước nào cũng hỏng):

```
1. npm run hrm:ra-soat              (chỉ đọc — lấy danh sách dữ liệu bẩn)
2. Kế toán dọn dữ liệu bẩn          (nghiệp vụ, script KHÔNG tự dọn)
3. npm run migrate:sys:deploy       (thêm cột xemLuong + cấp quyền cho người cũ)
4. npm run sync:tenants             (BẮT BUỘC — đây là bước gỡ khóa cũ (ma_nv, mst);
                                     script hrm:constraints KHÔNG gỡ được, xem BUG-HRM-33)
5. npm run hrm:constraints          (áp EXCLUDE + unique + hàm + index)
6. Triển khai máy chủ VÀ hai giao diện CÙNG LÚC
```

> Bước 4 **không có** trong runbook ba lệnh ở `dev-notes.md` Mục 1.3b. Đó là khoảng trống thật, không phải chuyện chữ nghĩa.

---

## 8. Lỗi mới phát hiện ở đợt này

Chi tiết đầy đủ (mức độ, bước tái hiện, kỳ vọng ↔ thực tế, nghi vấn nguyên nhân) ghi ở **`docs/hrm/qa/issues-and-bugs.md` Mục 9**. Tóm tắt:

| Mã | Mức | Một dòng |
|:---|:---:|:---|
| **BUG-HRM-33** | 🟠 High | `DROP CONSTRAINT IF EXISTS "hrm_nguoi_phu_thuoc_ma_nv_mst_key"` là **lệnh rỗng** — Prisma tạo khóa đó bằng `CREATE UNIQUE INDEX`, không phải constraint. M-09 bước 1 **không** đạt được bằng script |
| **BUG-HRM-34** | 🟠 High | Khoảng trống **không có lớp phòng thủ nào** cho người phụ thuộc: khóa cũ đã bỏ khỏi schema, ràng buộc mới chưa áp, mà hai đường ghi **không bọc transaction** |
| **BUG-HRM-35** | 🟡 Medium | `loai_hd` **không** được chuẩn hóa chữ thường khi ghi — hợp đồng Mục 4.2b đòi, mã chưa làm (dò thật: `"  KHOAN  "` → `"KHOAN"`) |
| **BUG-HRM-36** | 🟡 Medium | `access` chứa **trùng** `donViId` được nhận; phần tử cuối thắng ⇒ có thể **thu hồi quyền âm thầm** |
| **BUG-HRM-37** | 🔵 Low | `POST /nhan-vien`: người không có quyền lương nhập ba trường ngân hàng thì dữ liệu **bị bỏ im lặng**, vẫn trả 201 |
| **BUG-HRM-38** | 🔵 Low | Chú thích `backfill-hop-dong.ts` sửa thành `POST /hrm/employees` — đường dẫn **không tồn tại**, trái QĐ #20 |
| **BUG-HRM-39** | 🔵 Low | `provisionTenant` **bỏ** kết quả `applyTenantConstraints` ⇒ tenant có thể thành READY mà thiếu ràng buộc, không dấu vết |
| **BUG-HRM-40** | 🔵 Low | Nhận diện lỗi ràng buộc bằng **so chuỗi con** trên `message + meta`, không neo vào SQLSTATE |
| **ISSUE-HRM-05** | 🟡 Medium | `adminOwner.test.ts` xác thực bằng header Bearer trong khi hệ thống đã chuyển sang cookie — 5 ca fail thường trực che tín hiệu bộ test |
| **ISSUE-HRM-06** | 🟡 Medium | Hợp đồng Mục 4.3 (`ngay_chot <= ngay_bat_dau` → 409) **mâu thuẫn QĐ #6** — cần BA chốt |
| **ISSUE-HRM-07** | 🟡 Medium | TC-hrm-247 lý do lỗi thời + **thiếu hẳn** ca "cùng nhân viên, kỳ nối tiếp → 201" |

### Những chỗ QA đã soi kỹ và **sạch** — nói rõ để không ai đi tìm lại

* **Không** có nhánh điều kiện bỏ sót ở ba đường ghi hợp đồng — cả ba đều gọi đủ `assertNhanVienTonTai` → `assertSoHdDuyNhat` → `assertKhongChongLan` → ghi.
* **Không** có ca "kiểm sau khi ghi" ở nhóm hợp đồng — mọi pre-check nằm trước bước ghi và **trong** cùng transaction.
* **Không** rò `luong_chinh`/`luong_bhxh` qua `GET /nhan-vien` — `phanHopDong` liệt kê tường minh 6 trường, không `...spread` (đây là chỗ dễ rò nhất và mã tránh được).
* **Không** có đường nhét quyền lương vào vé đăng nhập — `grep xemLuong` trong `src/plugins/` và `auth.service.ts` đều rỗng.
* **Không** có `setUTCHours` thực thi nào còn sót.
* **Không** có `NaN` im lặng trong phép so kỳ giảm trừ — bốn cột `.default(null)` chứ không `undefined` (đã dò thật).
* **Không** có DDL/DML nào lọt vào script rà soát — cả bốn câu quét đều thuần `SELECT`.
* **Không** có thông điệp lỗi nào lộ dữ liệu ra ngoài phạm vi công ty — hai câu 409 có nêu mã và họ tên nhân viên, nhưng cả hai đường đều đã qua guard tenant, và với nhóm hợp đồng thì còn qua guard quyền lương.
* **Không** có lỗi nuốt im lặng đáng kể — `ghiCoRangBuoc` đổi lỗi rồi **ném lại**, `doiLoiRangBuocHrm` trả nguyên trạng lỗi không liên quan (có test đối chứng `hrmQuyenVaNpt.test.ts:190`).

---

## 9. Kết luận và khuyến nghị

### 9.1. Đạt / không đạt

| Hạng mục P0 (sign-off Mục 5.1) | Phần máy chủ | Đủ điều kiện triển khai |
|:---|:---:|:---:|
| 1 — Chống chồng lấn + mốc giờ Việt Nam | ✅ **Đạt** | ⛔ Chặn bởi việc #2 Mục 7 |
| 2 — Hai ràng buộc duy nhất (`so_hd`, NPT theo kỳ) | ✅ **Đạt** ở tầng ứng dụng | ⛔ Chặn bởi BUG-HRM-33 + BUG-HRM-34 |
| 3 — Ràng buộc lương | ✅ **Đạt** | ⚠️ Phải rà và dọn dữ liệu lương 0 trước |
| 4 — Quyền xem dữ liệu lương | ✅ **Đạt** phần máy chủ | ⛔ Chặn bởi việc #1 và #3 Mục 7 |
| 5 — `status` bắt buộc khi sửa nhân viên | ✅ **Đạt** | ✅ Giao diện đã sẵn sàng |

**Kết luận chung: ĐẠT CÓ ĐIỀU KIỆN.**

* **Chất lượng mã của đợt P0: cao.** Cả bảy hạng mục BE tự khai đều **kiểm chứng được là đã làm thật và làm đúng hợp đồng**. Không phát hiện lỗi nghiêm trọng nào trong logic nghiệp vụ. Không có hồi quy (đã chứng minh bằng lần chạy đối chứng, không bằng suy luận). Sáu bẫy mà nhiệm vụ yêu cầu soi kỹ nhất — thiếu `boQuaId` khi sửa số hợp đồng, khóa theo nhãn thô, khoảng nửa mở, `setUTCHours` còn sót, nhét quyền vào vé đăng nhập, nhận `null` rồi ghi đè ba trường ngân hàng — **không dính cái nào**.
* **Nhưng đợt P0 chưa được phép triển khai.** Ba việc "làm cùng một lượt" chưa làm (Mục 7), và hai lỗi hạ tầng mới (BUG-HRM-33, 34) chạm đúng chỗ mà chính đợt này định vá.
* **Mức bao phủ kiểm chứng còn mỏng: 20/81 ca của Mục 6B pass thật, tất cả ở tầng luật.** Chưa một endpoint HRM nào được gọi thật trong bộ test. Đây **không phải** lỗi của BE — BA đã ghi rõ ở sign-off Mục 6 rằng đây là điều kiện của Phase B chưa đạt.

### 9.2. Khuyến nghị của QA

**Trước khi triển khai — bắt buộc:**
1. Sửa **BUG-HRM-33** (thêm `DROP INDEX IF EXISTS` cạnh `DROP CONSTRAINT IF EXISTS`) và bổ sung `sync:tenants` vào runbook `dev-notes.md` Mục 1.3b.
2. Xử lý **BUG-HRM-34**: hoặc bọc transaction cho hai đường ghi người phụ thuộc, hoặc chốt cứng thứ tự triển khai để khoảng trống không lớp phòng thủ bằng không.
3. Làm ba việc giao diện ở Mục 7 rồi triển khai đồng thời với máy chủ.

**Trước khi nghiệm thu Phase B:**
4. Dựng khung test tích hợp HRM (`buildApp()` + `app.inject()` + tenant test) — đây là thứ mở khóa 12 ca đang kẹt, và cũng là đầu việc #1 mà BA đã giao cho QA ở sign-off Mục 7.1.
5. Sửa **ISSUE-HRM-05** để bộ test trở lại 100% xanh; 5 ca fail thường trực làm mọi người quen với màu đỏ.
6. QA tự sửa **ISSUE-HRM-07** (viết lại lý do TC-hrm-247, thêm TC-hrm-247a) và bổ sung cột truy vết tiêu chí nghiệm thu cho 6B.1–6B.10.

**Chuyển BA:**
7. **ISSUE-HRM-06** — hợp đồng Mục 4.3 đang mâu thuẫn QĐ #6.

### 9.3. Những gì QA **không** kiểm được, và cần gì để kiểm

| Không kiểm được | Cần gì |
|:---|:---|
| Mọi ràng buộc tầng cơ sở dữ liệu (`EXCLUDE`, unique `so_hd`, hai hàm SQL) | Chủ dự án cho phép chạy `hrm:constraints` trên một cơ sở dữ liệu **thử nghiệm** |
| **BUG-HRM-33** mới ở mức bằng chứng tĩnh | Một truy vấn **chỉ đọc**: `SELECT indexname FROM pg_indexes WHERE indexname = 'hrm_nguoi_phu_thuoc_ma_nv_mst_key';` rồi thử `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...` trong transaction có ROLLBACK |
| TC-hrm-259 (bước chuyển dữ liệu migration) | Chủ dự án cho phép chạy `migrate:sys:deploy` trên cơ sở dữ liệu thử nghiệm |
| Toàn bộ ca đồng thời (209, 210) | Ràng buộc `EXCLUDE` + khung test bắn song song |
| 22 ca đợt P1, 12 ca đợt P2 | Chức năng chưa triển khai / BA chưa mở cổng |
| Mọi ca giao diện | Bộ chạy test ở `maxv/`, `hdđt_maxv/`, `fe_maxv/` — **cả ba đều chưa có** |
| TC-hrm-245 (hiệu năng) | Tenant có dữ liệu thật + chỉ mục M-05 đã áp |

---

*Báo cáo lập ngày 2026-09-07 bởi Tester-QA, Phase B đợt P0. Không sửa một dòng mã sản phẩm nào; không chạy migration hay hai script vận hành lên bất kỳ cơ sở dữ liệu nào. Cây làm việc git sau khi kiểm thử giống hệt trước khi kiểm thử (worktree đối chứng đã gỡ sạch).*
