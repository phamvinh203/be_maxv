---
type: test-report
feature: hrm
status: in-review
updated: 2026-09-08
links:
  - docs/hrm/qa/test-cases.md
  - docs/hrm/qa/issues-and-bugs.md
  - docs/hrm/architecture/api-contract.md
  - docs/hrm/architecture/dev-notes.md
  - docs/hrm-ba-signoff-2026-09-07.md
  - docs/hrm/agents-tester-qa/qa-verification-report-2026-09-08-dot-2.md
---

> **Tệp này có HAI phần.**
> **Phần I** (Mục 1–9) — đợt **P0**, kiểm chứng ngày 2026-09-07: phòng ban / nhân viên / hợp đồng / người phụ thuộc / tài liệu.
> **Phần II** (Mục 11–16, cuối tệp) — đợt **Cấu hình mặc định · Ca làm việc · Lịch ngày lễ**, kiểm chứng ngày 2026-09-08, **chạy thật qua HTTP `app.inject()`**.

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

---
---

# PHẦN II — HRM › BÁO CÁO KIỂM THỬ PHASE B ĐỢT 2

*Cụm **Cấu hình mặc định · Ca làm việc · Lịch ngày lễ** · Kiểm chứng ngày 2026-09-08 · Phạm vi: `TC-hrm-273 … TC-hrm-327` (55 ca)*

> **Kết luận một dòng:** mã máy chủ của cả 3 thực thể **ĐẠT** — **52/55 ca chạy thật và PASS**, cộng 9 phép kiểm riêng `KR-01…KR-09` PASS toàn bộ. Ba điểm còn treo: **1 ca không dựng được tiền điều kiện** (chưa có bảng `hrm_work_schedules`) và **2 ca FAIL do câu chữ `test-cases.md` lệch với `api-contract.md`** — **không ca nào FAIL vì mã sai**.
>
> Báo cáo nghiệm thu đầy đủ: [`docs/hrm/agents-tester-qa/qa-verification-report-2026-09-08-dot-2.md`](../agents-tester-qa/qa-verification-report-2026-09-08-dot-2.md). Tệp đó cũng nêu đích danh **ba điểm sai** của báo cáo nghiệm thu đợt 1 và **thay thế** nó.

---

## 11. Đây là lần đầu tiên endpoint HRM được gọi thật

Món nợ ghi ở `CONTEXT_SUMMARY.md` Mục 10.6 (*"Dựng khung test tích hợp có `app.inject()` — 12 ca endpoint vẫn chưa chạy được, và chưa một endpoint HRM nào được gọi thật"*) **đã trả**.

### 11.1. Rào cản 401 — căn nguyên và cách vượt

`src/__tests__/adminOwner.test.ts` hỏng **5/5 với 401** từ trước đợt này. Căn nguyên:

```
POST /api/v1/auth/login  ->  200 OK
{"success":true,"data":{"user":{…},"companies":[…],"activeDonViId":"…","modules":{…}}}
                                       ^ KHÔNG còn trường accessToken
```

`helpers/authTokens.ts::issueTokens()` đặt cả access lẫn refresh vào **cookie httpOnly**; thân phản hồi không còn token. Bản test cũ đọc `data.accessToken` → `undefined` → gửi `Authorization: Bearer undefined`. `@fastify/jwt` ưu tiên header khi header có mặt và khớp `/^Bearer\s/i` (`node_modules/@fastify/jwt/index.js:258`) nên nó lấy đúng chuỗi `"undefined"` làm token ⇒ **401 ở mọi ca**.

**Phân loại: *Test failed*, KHÔNG phải *Product bug*.** Chuyển vé sang cookie httpOnly là thiết kế cố ý (chống đánh cắp qua XSS), ghi rõ trong `constants/auth.ts` và `authTokens.ts`.

Khung mới đi **đúng đường xác thực của sản phẩm**, không tự ký JWT tay:

```
POST /api/v1/auth/login              -> lấy cookie accessToken (httpOnly)
POST /api/v1/companies/:id/switch    -> cấp lại cookie có nhúng donViId của công ty cần test
mọi lượt gọi HRM                     -> app.inject({ cookies: { accessToken: <vé> } })
```

Vé đi trọn chuỗi guard thật: hook `preHandler` của `hrm.route.ts` → `app.authenticate(req)` → `requireModule('hrm')` → `resolveTenantDb(req)`.

### 11.2. Môi trường và cách cô lập dữ liệu

| Việc | Cách làm |
|:---|:---|
| Tài khoản | `qa.hrm.owner@test.local` (OWNER) + `qa.hrm.staff@test.local` (OWNER_EMPLOYEE, có `DonViAccess` **chỉ** vào công ty A) |
| Gói thuê bao | Gói riêng `QA_HRM_PLAN`, `features: { hrm: true, … }` |
| DB tenant | **Tự cấp 2 DB mới** `maxv_9970000001_app` (A) và `maxv_9970000002_app` (B) bằng `provisionTenant()` — CREATE DATABASE + `prisma db push` + `applyTenantConstraints` |
| Dọn dẹp | `cleanup()` chạy **cả trước lẫn sau**: `dropTenant()` cả 2 DB, xóa don_vi / access / subscription / plan / user / dòng `syslog` của tài khoản test |

**Đối chứng sau lượt chạy cuối** (truy vấn thật):

```
{"userTest":0,"donViTest":0,"planTest":0,"syslogHRM":0,"tongDonVi":10,"tongUser":10}
DB test con lai: []
```

Số công ty và người dùng **y hệt trước khi chạy** (10 / 10). Không chạm một dòng nào của tenant thật. Không khởi động hay tắt máy chủ dev. Không chạy `sync:tenants`.

---

## 12. Số liệu chạy thật

### 12.1. Lệnh

| Lệnh | Kết quả |
|:---|:---|
| `cd be_maxv && npm run typecheck` | **exit 0** |
| `cd be_maxv && npm run lint` | **exit 0** — `183 problems (0 errors, 183 warnings)` |
| `npx tsx --test src/__tests__/hrmSettingsShiftsHolidaysApi.test.ts` | `tests 70 · pass 66 · fail 4` — quy về **lá: 64 pass / 2 fail** (2 con số fail còn lại là khối cha) |
| `npx tsx --test src/__tests__/hrmSettingsShiftsHolidays.test.ts` | `tests 32 · pass 32 · fail 0` |
| `npx tsx --test src/__tests__/adminOwner.test.ts` | `tests 5 · pass 5 · fail 0` (sau khi sửa **test**) |
| `cd be_maxv && npm test` | `tests 577 · pass 573 · fail 4 · duration_ms 21126` |
| `cd hdđt_maxv && npx tsc --noEmit` | **exit 0** |
| `cd hdđt_maxv && npm run lint` | **exit 0** |
| `cd hdđt_maxv && npm run build` | **exit 0** — `built in 3.19s` |

**Hồi quy:** 4 con số fail của `npm test` **chỉ gồm** 2 ca lá `TC-hrm-301`, `TC-hrm-316` và 2 khối cha của chúng. Không module nào khác đỏ. Trước đợt này bộ test có **5 ca đỏ thường trực** (adminOwner) — nay đã xanh.

### 12.2. Tổng hợp 55 ca

| Nhóm | Số ca | Chạy thật | PASS | FAIL | KHÔNG CHẠY ĐƯỢC |
|:---|:--:|:--:|:--:|:--:|:--:|
| 7.1 Cấu hình mặc định (273–287) | 15 | 15 | **15** | 0 | 0 |
| 7.2 Ca làm việc (288–309) | 22 | 21 | **20** | 1 (`301`) | 1 (`308`) |
| 7.3 Lịch ngày lễ (310–327) | 18 | 18 | **17** | 1 (`316`) | 0 |
| **Cộng** | **55** | **54** | **52** | **2** | **1** |

Tổng số lượt gọi HTTP thật trong một lượt chạy: **121**.

---

## 13. Kết quả từng ca — mã trạng thái THẬT

> Cột "Trạng thái thật" chép từ nhật ký lượt gọi. Ca gửi nhiều lượt thì liệt kê đủ.

### 13.1. Cấu hình mặc định — `TC-hrm-273 … TC-hrm-287`

| Ca | Lượt gọi | Trạng thái thật | Kết luận |
|:---|:---|:---|:--:|
| TC-hrm-273 | `GET /settings/general` (tenant trắng) | **200** — tự khởi tạo `DEFAULT`, 33 trường, `baseSalary:"2340000"`, `standardHoursPerDay:"8"`, **`taxBrackets` 7 bậc, bậc cuối `null`, trần 35%** | PASS |
| TC-hrm-274 | `GET` lần 2 | **200** — khớp 100% bản ghi đọc thẳng từ DB (đối chiếu `standardHoursPerDay`, `baseSalary`, `taxBrackets`) | PASS |
| TC-hrm-275 | `PUT {standardHoursPerDay:7.5, saturdayPolicy:"OFF", unionFeeEmployeeRate:0.8}` | **200** — 3 trường đổi đúng; `baseSalary` và `sundayPolicy` giữ nguyên; **không** có `warning` | PASS |
| TC-hrm-276 | `PUT 1.0` · `PUT 24.0` | **200** · **200** | PASS |
| TC-hrm-277 | `PUT 0.9` · `24.1` · `0` | **400** ×3 — `Giờ công chuẩn/ngày phải nằm trong khoảng từ 1.0 đến 24.0 giờ.` Giá trị trong DB không đổi | PASS |
| TC-hrm-278 | `baseSalary 0 / -500000`, `regionMinSalary 0 / -1000` | **400** ×4 — `Lương cơ sở và lương tối thiểu vùng phải là số nguyên lớn hơn 0.` | PASS |
| TC-hrm-279 | `PUT {baseSalary:1, regionMinSalary:1}` | **200** | PASS |
| TC-hrm-280 | biểu 2 bậc `5%/5%` · `5%/4%` | **400** ×2 — `Thuế suất của bậc thuế sau phải lớn hơn bậc liền trước.` | PASS |
| TC-hrm-281 | biểu 7 bậc chuẩn | **200** — lưu đủ 7 bậc, **vắng hẳn** `warning` | PASS |
| TC-hrm-282 | `PUT` bằng vé `OWNER_EMPLOYEE` | **403** — `Chỉ Quản trị viên (ADMIN) hoặc Chủ doanh nghiệp (OWNER) mới có quyền cập nhật hoặc khôi phục Cấu hình mặc định.` | PASS |
| TC-hrm-283 | `POST /settings/general/restore-default` | **200** (không phải 201) — mọi tham số về chuẩn, `taxBrackets` 7 bậc, không `warning` | PASS |
| TC-hrm-284 | `restore-default` bằng vé nhân viên | **403** | PASS |
| TC-hrm-285 | `GET` bằng vé nhân viên | **200** | PASS |
| TC-hrm-286 | `POST /settings/general` · `DELETE /settings/general` | **404** ×2 — `Route POST:/api/v1/hrm/settings/general not found` | PASS |
| TC-hrm-287 | A `PUT 7.0` → **200** (`"7"`); B `GET` → **200** (`"8"`) | Cấu hình độc lập giữa 2 DB tenant | PASS |

### 13.2. Ca làm việc — `TC-hrm-288 … TC-hrm-309`

| Ca | Lượt gọi | Trạng thái thật | Kết luận |
|:---|:---|:---|:--:|
| TC-hrm-288 | `POST` bỏ trống mã, 08:00–17:00, nghỉ 60 | **201** — `"code":"CA01","isOvernight":false,"workingHours":8,"status":"ACTIVE"` | PASS |
| TC-hrm-289 | `POST code:"CA02"`, 06:00–14:00, nghỉ 30 | **201** — `workingHours: 7.5` | PASS |
| TC-hrm-290 | 22:00–06:00, nghỉ 30 | **201** — `isOvernight:true, workingHours:7.5` | PASS |
| TC-hrm-291 | 20:00–04:00, nghỉ 60 | **201** — `isOvernight:true, workingHours:7` | PASS |
| TC-hrm-292 | 08:00–08:00, nghỉ 120 | **201** — `isOvernight:true, workingHours:22, "warning":"CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"` | PASS |
| TC-hrm-293 | 00:00–08:00, nghỉ 0 | **201** — `isOvernight:false, workingHours:8` | PASS |
| TC-hrm-294 | thiếu `name` · `name:"   "` | **400** ×2 — `Tên ca làm việc không được để trống.` | PASS |
| TC-hrm-295 | `"8:00"` · `"25:00"` · thiếu `endTime` | **400** ×3 — thông điệp về `HH:mm` | PASS |
| TC-hrm-296 | `breakMinutes:-15` | **400** | PASS |
| TC-hrm-297 | ca 4h nghỉ 240 · nghỉ 300 | **400** ×2 | PASS |
| TC-hrm-298 | `POST code:"CA01"` khi đã có | **409** — `Mã ca làm việc đã tồn tại…` | PASS |
| TC-hrm-299 | có `CA01`+`CA03`, `POST` bỏ trống mã | **201** — `"code":"CA02"` (gap scanning đúng) | PASS |
| TC-hrm-300 | 5 ca, `GET ?page=1&pageSize=10` | **200** — `total:5`, mọi phần tử có `isOvernight` (boolean) và `workingHours` (số) | PASS |
| **TC-hrm-301** | `GET ?search=chinh&status=ACTIVE` | **200** nhưng `"items":[],"total":0` — kỳ vọng 1 | **FAIL** |
| | *(đối chứng)* `?search=chính&status=ACTIVE` | **200**, `total:1` = "Ca hành chính" | — |
| | *(đối chứng)* `?status=INACTIVE` | **200**, `total:1` = "Ca đêm" | — |
| TC-hrm-302 | `GET /work-shifts/{id}` | **200** — đủ `isOvernight`, `workingHours` | PASS |
| TC-hrm-303 | `GET /work-shifts/ws_999` | **404** | PASS |
| TC-hrm-304 | `PATCH {name, breakMinutes:30, status:"INACTIVE"}` | **200** — `workingHours` tự tính lại **8.5**, `code` vẫn `CA01` | PASS |
| TC-hrm-305 | `PATCH {code:"CA99", name:…}` | **200** — `code` vẫn `"CA01"`; đối chiếu DB cũng `CA01` (schema update không nhận `code`) | PASS |
| TC-hrm-306 | ca 4h, `PATCH {breakMinutes:250}` | **400** — merge dữ liệu cũ + mới phát hiện `workingHours <= 0` | PASS |
| TC-hrm-307 | `DELETE /work-shifts/{id}` | **200** — đọc lại DB: bản ghi đã biến mất (xóa cứng) | PASS |
| **TC-hrm-308** | — | Không dựng được tiền điều kiện: `information_schema` cho `hrm_work_schedules` = **0 bảng** | **KHÔNG CHẠY ĐƯỢC** |
| TC-hrm-309 | A `POST code:"CA01"` → **201**; B `POST code:"CA01"` → **201** | A thấy `total:1` ("Ca A"), B thấy `total:1` ("Ca B") | PASS |

### 13.3. Lịch ngày lễ — `TC-hrm-310 … TC-hrm-327`

| Ca | Lượt gọi | Trạng thái thật | Kết luận |
|:---|:---|:---|:--:|
| TC-hrm-310 | `POST 2026-04-30 NATIONAL isAnnual:true` | **201** | PASS |
| TC-hrm-311 | `POST 2026-02-17 LUNAR isAnnual:false` | **201** | PASS |
| TC-hrm-312 | `POST LUNAR isAnnual:true` | **400** — thông điệp lễ âm lịch không lặp theo dương lịch | PASS |
| TC-hrm-313 | thiếu `date` · `name:""` | **400** ×2 | PASS |
| TC-hrm-314 | tạo `(2026-01-01, "Tết Dương lịch")` 2 lần | **201** rồi **409** | PASS |
| TC-hrm-315 | cùng ngày `2026-09-02`, khác tên | **201** — khóa duy nhất là cặp `(date, name)` | PASS |
| **TC-hrm-316** | `GET ?year=2026&filter=THIS_YEAR` | **200**, `isPaid` **có**. Trường thật: `["id","date","name","type","isAnnual","isPaid","note","createdAt","updatedAt"]` — **không có "thứ trong tuần"** | **FAIL** |
| TC-hrm-317 | `GET ?filter=ANNUAL` | **200** — mọi phần tử `isAnnual:true`; ngày lễ `isAnnual:false` không lọt vào | PASS |
| TC-hrm-318 | `GET /holidays/{id}` | **200** | PASS |
| TC-hrm-319 | `PATCH {name, note, isPaid}` | **200** | PASS |
| TC-hrm-320 | `PATCH {type:"LUNAR"}` (cờ lặp cũ = true) · `PATCH {type:"LUNAR", isAnnual:true}` | **400** ×2 | PASS |
| TC-hrm-321 | `DELETE /holidays/{id}` | **200** — DB không còn bản ghi | PASS |
| TC-hrm-322 | `POST /holidays/quick-generate {year:2026}` trên tenant trắng | **200** (không phải 201) — `totalStandard:11, addedCount:11, skippedCount:0`; DB đếm được **11** | PASS |
| TC-hrm-323 | đã có `01/01`, chạy tạo nhanh | **200** — `addedCount:10, skippedCount:1`; DB **11** | PASS |
| TC-hrm-324 | bấm lần 2 | **200** — `addedCount:0, skippedCount:11`, `items` vẫn 11; DB **11** | PASS |
| TC-hrm-325 | `year:2024` · `year:2030` | **200** ×2, mỗi lượt `totalStandard:11, addedCount:11` | PASS |
| TC-hrm-326 | `year:2023` · `year:2031` | **400** ×2 | PASS |
| TC-hrm-327 | A tạo lễ riêng → **201**; B `GET ?filter=ALL` → **200**, `total:0`. Chiều ngược lại cũng vậy | Dữ liệu ngày lễ độc lập tuyệt đối | PASS |

### 13.4. Chín phép kiểm riêng — `KR-01 … KR-09` (9/9 PASS)

| Mã | Nội dung | Trạng thái thật |
|:---|:---|:---|
| KR-01 | `PUT` biểu thuế lệch chuẩn (3 bậc) | **200** + `"warning":"CANH_BAO_BIEU_THUE_LECH_CHUAN"`, dữ liệu vẫn lưu |
| KR-02 | 4 điều kiện toàn vẹn `BR-hrm-082` + cửa tương thích ngược | 1 bậc → **400** `…ít nhất 2 bậc` · ngưỡng giảm → **400** · bậc cuối hữu hạn → **400** `Bậc thuế cuối cùng phải áp cho toàn bộ phần thu nhập vượt bậc liền trước.` · mốc `999999999999` → **200** và được chuẩn hóa thành `"khoang":null` |
| KR-03 | Nhật ký kiểm toán ghi thật vào bảng `syslog` | 2 dòng: `HRM_UPDATE_GENERAL_SETTINGS` và `HRM_RESTORE_GENERAL_SETTINGS`, đúng `userId`, đúng `donViId`, `chiTiet:{"khoaNghiepVu":"DEFAULT"}` |
| KR-04 | Decimal ra chuỗi + vòng `GET → PUT` | `GET` → `"standardHoursPerDay":"8"` (chuỗi) · `PUT` nguyên payload → **400** · `PUT` sau `Number()` → **200** |
| KR-05 | Không vé / vé rác | **401** ×2 |
| KR-06 | Cảnh báo ca > 12h ở **cả 4 đường đọc** | sau `POST` **201** · `GET` danh sách **200** · `GET` chi tiết **200** · sau `PATCH` **200** — cả 4 đều có `"warning":"CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"`; ca 8h **vắng hẳn** trường này |
| KR-07 | `?isPaid=false` | **200**, `total:1`, đúng bản ghi "Không lương". `?isPaid=true` → đúng bản ghi "Có lương". `?isPaid=abc` → **400** |
| KR-08 | Đủ `CA01…CA99` rồi bỏ trống mã | **400** — `Đã đạt giới hạn 99 ca làm việc tự sinh. Vui lòng tự nhập mã ca hoặc giải phóng ca không sử dụng.`; tự nhập `CA100` → **201** |
| KR-09 | Tên ngày lễ có khoảng trắng thừa | **409** — `.trim()` chặn đúng; DB chỉ còn 1 bản ghi |

---

## 14. Log nguyên văn — trích các lượt gọi then chốt

**TC-hrm-273 — tự khởi tạo cấu hình trên tenant trắng**

```
[TC-hrm-273] GET lần đầu :: GET /api/v1/hrm/settings/general -> 200
{"success":true,"data":{"id":"DEFAULT","standardWorkingDaysMethod":"FIXED_26","saturdayPolicy":"HALF_DAY",
"sundayPolicy":"OFF","standardHoursPerDay":"8","baseAnnualLeaveDays":12,"seniorityYearsForExtraDay":5,
"otRateWeekdayDay":"150","otRateWeekdayNight":"200","otRateWeekendDay":"200","otRateWeekendNight":"270",
"otRateHolidayDay":"300","otRateHolidayNight":"390","maxOtHoursPerMonth":40,"warningOtHoursPerYear":200,
"maxOtHoursPerYear":300,"baseSalary":"2340000","regionMinSalary":"4960000","insuranceEmployeeSocial":"8",
"insuranceEmployeeHealth":"1.5","insuranceEmployeeUnemployment":"1","insuranceCompanySocial":"17.5",
"insuranceCompanyHealth":"3","insuranceCompanyUnemployment":"1","unionFeeEmployeeRate":"1",
"unionFeeMaxAmount":"234000","unionFeeCompanyRate":"2","personalDeduction":"11000000",
"dependentDeduction":"4400000","taxBrackets":[{"khoang":5000000,"thueSuat":5},{"khoang":10000000,"thueSuat":10},
{"khoang":18000000,"thueSuat":15},{"khoang":32000000,"thueSuat":20},{"khoang":52000000,"thueSuat":25},
{"khoang":80000000,"thueSuat":30},{"khoang":null,"thueSuat":35}],
"createdAt":"2026-09-08T06:36:21.047Z","updatedAt":"2026-09-08T06:36:21.047Z"}}
```

**TC-hrm-292 + KR-06 — cảnh báo ca 22h ở cả 4 đường đọc**

```
[TC-hrm-292] POST ca trực 24h :: POST /api/v1/hrm/work-shifts -> 201
{"success":true,"data":{"id":"6996c3c9-…","code":"CA05","name":"Ca trực 24h","startTime":"08:00",
"endTime":"08:00","breakMinutes":120,"status":"ACTIVE",…,"isOvernight":true,"workingHours":22,
"warning":"CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"}}

[KR-06] GET chi tiết :: GET /api/v1/hrm/work-shifts/6996c3c9-… -> 200
{"success":true,"data":{…,"isOvernight":true,"workingHours":22,"warning":"CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"}}

[KR-06] PATCH :: PATCH /api/v1/hrm/work-shifts/6996c3c9-… -> 200
{"success":true,"data":{…,"name":"Ca trực 24h (đổi tên)","workingHours":22,
"warning":"CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"}}

# đối chứng: phần tử CA01 (8h) trong GET danh sách KHÔNG có trường warning
{"id":"b9ae2ed4-…","code":"CA01","name":"Ca hành chính",…,"isOvernight":false,"workingHours":8}
```

**KR-03 — nhật ký kiểm toán đọc thẳng từ bảng `syslog`**

```
KR-03 syslog thực đọc từ DB:
[{"hanhDong":"HRM_UPDATE_GENERAL_SETTINGS","userId":"c98f3022-…","donViId":"5e9807cd-…",
  "chiTiet":{"khoaNghiepVu":"DEFAULT"},"level":"INFO"},
 {"hanhDong":"HRM_RESTORE_GENERAL_SETTINGS","userId":"c98f3022-…","donViId":"5e9807cd-…",
  "chiTiet":{"khoaNghiepVu":"DEFAULT"},"level":"INFO"}]
```

**KR-04 — Decimal ra chuỗi, vòng GET rồi PUT**

```
[KR-04] GET                                        -> 200   "standardHoursPerDay":"8"   (chuỗi)
[KR-04] (a) PUT nguyên payload GET (Decimal chuỗi) -> 400   (đúng hợp đồng: ghi phải là SỐ)
[KR-04] (b) PUT sau khi Number() hóa Decimal       -> 200
```

**TC-hrm-322 / 323 / 324 — tạo nhanh 11 ngày lễ và tính idempotent**

```
[TC-hrm-322] -> 200  {"year":2026,"totalStandard":11,"addedCount":11,"skippedCount":0,"items":[…11 mục…]}
[TC-hrm-323] -> 200  {"year":2026,"totalStandard":11,"addedCount":10,"skippedCount":1, …}
[TC-hrm-324] -> 200  {"year":2026,"totalStandard":11,"addedCount":0,"skippedCount":11, …}
```

11 mục sinh ra: `2026-01-01` Tết Dương lịch · `02-16` 29 Tết · `02-17` 30 Tết · `02-18/19/20` Mùng 1/2/3 · `04-26` Giỗ Tổ Hùng Vương · `04-30` Ngày Giải phóng miền Nam · `05-01` Ngày Quốc tế Lao động · `09-01` Nghỉ liền kề Quốc khánh · `09-02` Ngày Quốc khánh. Đúng Điều 112 BLLĐ 2019.

> ⚠️ **ĐÍNH CHÍNH (2026-09-08, sau vòng Quality Gate).** Đoạn ghi chép ngay trên là **lượt chạy trước khi sửa `B2`**, và câu "Đúng Điều 112 BLLĐ 2019" ở cuối là **SAI** — chính bộ ngày đó mới là lỗi. Giữ nguyên đoạn trên làm lưu vết, nhưng đừng dùng làm chuẩn.
>
> Sai ở hai chỗ: **Mùng 1 Tết 2026 là `02-17`, không phải `02-18`**; và **không hề tồn tại "30 Tết" năm 2026** vì tháng Chạp năm đó chỉ có 29 ngày. Bộ đúng do thuật toán sinh (`amLich.util.ts`, quy chiếu UTC+7):
>
> `01-01` Tết Dương lịch · `02-15` **28 Tết** · `02-16` **29 Tết** · `02-17` **Mùng 1** · `02-18` Mùng 2 · `02-19` Mùng 3 · `04-26` Giỗ Tổ · `04-30` · `05-01` · `09-01` · `09-02`.
>
> **Vì sao lượt kiểm thử đó không bắt được:** ca kiểm thử khi ấy neo đích danh vào chính bộ số sai, nên nó xác nhận lại cái sai thay vì kiểm chứng. Xem `CONTEXT_SUMMARY.md` Mục 16 và `agents-code-reviewer/code-review-2026-09-08.md` mục **B2**.
>
> **Nguồn gốc lỗi:** bộ số này được chép từ tài liệu mẫu `docs/nestjs/hr/architecture/hr-api-contract.md` dòng 1179-1182 — bộ đó là **tài liệu tham khảo, không phải đặc tả thật của MAXV** (xem `.claude/CLAUDE.md`). Không sửa bộ mẫu; ghi lại đây để người sau không chép tiếp.

**KR-07 — `?isPaid=false` nay lọc đúng nhóm**

```
[KR-07] GET isPaid=false :: GET /api/v1/hrm/holidays?filter=ALL&isPaid=false -> 200
{"success":true,"data":{"items":[{…,"name":"Không lương","isPaid":false,…}],"total":1,…}}
[KR-07] GET isPaid=abc  :: GET /api/v1/hrm/holidays?isPaid=abc -> 400
```

**KR-08 — trần 99 mã tự sinh**

```
[KR-08] POST không mã khi đã đủ 99 :: POST /api/v1/hrm/work-shifts -> 400
{"success":false,"message":"Đã đạt giới hạn 99 ca làm việc tự sinh. Vui lòng tự nhập mã ca hoặc giải phóng ca không sử dụng."}
[KR-08] POST tự nhập mã CA100 -> 201
```

**Hai ca FAIL — nguyên văn**

```
[TC-hrm-301] (a) search=chinh :: GET /api/v1/hrm/work-shifts?search=chinh&status=ACTIVE -> 200
{"success":true,"data":{"items":[],"total":0,"page":1,"pageSize":20,"totalPages":1}}
[TC-hrm-301] (b) search=chính :: GET …?search=ch%C3%ADnh&status=ACTIVE -> 200   total = 1

TC-hrm-316 các trường của một phần tử:
["id","date","name","type","isAnnual","isPaid","note","createdAt","updatedAt"]

TC-hrm-308: số bảng hrm_work_schedules trong tenant A = 0
```

---

## 15. Phân loại bốn kết quả — theo đúng Mục 8.2 của `test-cases.md`

| Kết quả | Số ca | Phân loại | Vì sao |
|:---|:--:|:---|:---|
| `adminOwner.test.ts` hỏng 401 | 5 | **Test failed** | Bản test đọc `data.accessToken` — trường đã bị bỏ khi vé chuyển sang cookie httpOnly. Sản phẩm đúng. Đã sửa **test**, nay 5/5 PASS |
| `TC-hrm-301` | 1 | **Test data issue + khoảng trống nghiệp vụ** | Từ khóa không dấu cho tên có dấu. Mã làm **đúng** `api-contract.md` 7E.2 (`contains`, chỉ bỏ hoa/thường). Nhưng gõ không dấu là thói quen thật ⇒ mở `BUG-HRM-50` cho BA quyết |
| `TC-hrm-316` | 1 | **Test data issue (câu chữ lệch hợp đồng)** | `api-contract.md` 7F.2 không hứa trường "thứ trong tuần"; giao diện đã tự tính (`LichNgayLePanel.tsx:46-48`). Nhu cầu nghiệp vụ **được đáp ứng** |
| `TC-hrm-308` | 1 | **Test environment issue** | Chưa có thực thể `hrm_work_schedules` trong `prisma/tenant/schema.prisma` ⇒ không dựng được tiền điều kiện |
| **Product bug mới** | **0** | — | Không phát hiện lỗi sản phẩm mới nào ở cụm này |

---

## 16. Kết luận và khuyến nghị của QA

### 16.1. Phán quyết

> ### ĐẠT CÓ ĐIỀU KIỆN
>
> **Được merge phần mã máy chủ.** **Chưa được ghi "nghiệm thu hoàn tất"** cho tới khi ba việc ở Mục 16.2 xong.

### 16.2. Ba việc phải xong

1. **BA chốt `BUG-HRM-50`** — có làm tìm kiếm bỏ dấu cho `/work-shifts` (và các danh mục HRM khác) hay không. Chốt xong mới sửa được câu chữ `TC-hrm-301`.
2. **QA sửa câu chữ `test-cases.md`** — `TC-hrm-273` ("5 bậc" sang **7 bậc**), `TC-hrm-316` (bỏ "thứ trong tuần" khỏi kỳ vọng máy chủ), `TC-hrm-308` (đánh dấu hoãn). *Đã làm ở đợt này.*
3. **Mở lại `TC-hrm-308`** khi thực thể `hrm_work_schedules` ra đời — Architect + QA.

### 16.3. Còn nợ ngoài phạm vi cụm này

| Nợ | Cần gì để đóng |
|:---|:---|
| `BUG-HRM-46` — cấu hình không có hiệu lực thời gian | Bảng lương khi chốt kỳ phải **chụp ảnh** tham số. Chưa có `hrm_payroll_periods` nên chưa kiểm được |
| `BUG-HRM-48` — bảng tra âm lịch dừng ở 2030 | `TC-hrm-326` xác nhận 2031 trả 400. Nợ kỹ thuật đã ghi nhận |
| Kiểm thử giao diện | Chưa có bộ chạy test ở `maxv/`, `hdđt_maxv/`, `fe_maxv/`. Phần giao diện mới chỉ bảo đảm ở mức `tsc` + `lint` + `build` sạch |
| Ca đồng thời (hai người cùng bấm Lưu) | Khung bắn song song. Hiện `createWorkShift` thử lại 5 lượt và `quickGenerate` bọc giao dịch — mới chỉ đọc mã, chưa dựng được va chạm thật |

### 16.4. Thay đổi mã do QA thực hiện

**Không sửa một dòng mã sản phẩm nào.**

| Tệp | Loại |
|:---|:---|
| `be_maxv/src/__tests__/hrmSettingsShiftsHolidaysApi.test.ts` | **mới** — khung test tích hợp HTTP, 66 phép kiểm lá, 121 lượt gọi |
| `be_maxv/src/__tests__/adminOwner.test.ts` | **sửa TEST** — chuyển từ header `Bearer` sang cookie `accessToken`; 5/5 FAIL sang 5/5 PASS |

---

*Phần II lập ngày 2026-09-08 bởi Lead Tester-QA. Mọi con số PASS trong phần này là số ca đã thực sự gọi HTTP và thực sự đạt. Hai DB tenant do bộ test tự cấp đã được DROP sạch; control plane sau khi chạy có đúng 10 công ty và 10 người dùng, y hệt trước khi chạy.*
