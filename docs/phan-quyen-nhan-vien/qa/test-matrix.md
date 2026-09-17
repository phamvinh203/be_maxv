---
type: test-matrix
feature: phan-quyen-nhan-vien
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/CONTEXT_SUMMARY.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-spec.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-flows.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-states.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-erd.md
  - docs/phan-quyen-nhan-vien/architecture/api-contract.md
  - docs/phan-quyen-nhan-vien/architecture/data-model.md
  - docs/phan-quyen-nhan-vien/architecture/adr/ADR-002-gui-mat-khau-qua-email-va-bat-doi-lan-dau.md
  - docs/phan-quyen-nhan-vien/qa/test-cases.md
---

# Ma trận kiểm thử — Phân quyền nhân viên (mời qua email + đúng công ty được cấp)

> **Phase A (Shift-Left), vòng 2.** Ghi đè hoàn toàn bản dở dang vòng 1 (`User.modules`/`MODULE_NOT_GRANTED`).
> **Cập nhật 2026-09-17 (lần 2 — đối chiếu contract):** Architect đã viết lại xong `architecture/` (ADR-001
> chuyển `Rejected`, ADR-002 mới, `api-contract.md` + `data-model.md` viết lại theo phạm vi vòng 2) SAU
> lúc QA đọc lần đầu. Đã đọc lại 4 file và khớp toàn bộ TC theo contract — xem Mục 0 và Mục 1 dưới đây.

## 0. Tình trạng nguồn (đã cập nhật)

`docs/phan-quyen-nhan-vien/architecture/api-contract.md` và `data-model.md` **NAY ĐÃ ĐÚNG PHẠM VI VÒNG 2**
(cột `users.phaiDoiMatKhau`, `POST /auth/change-password` mới, `sinhMatKhauTam()`, khoá `khoaHanMuc` cho
`PUT .../access`, mã lỗi `PASSWORD_CHANGE_REQUIRED`/`COMPANY_NO_ACCESS`/`CURRENT_PASSWORD_WRONG`/
`PASSWORD_SAME`/`DON_VI_TRUNG`). `ADR-001` (module theo nhân viên) chuyển `Rejected`; `ADR-002` (gửi mật
khẩu tạm + bắt đổi lần đầu) ở trạng thái `proposed`.

**SPEC-QA-001 (kiến trúc chưa cập nhật) từ nay LỖI THỜI — đã giải quyết**, xem Mục 1. Mọi TC trong
`qa/test-cases.md` đã được điền endpoint/HTTP status/`code` cụ thể theo contract; TC nào vẫn còn field
kỹ thuật chưa chốt (chủ yếu do BA cần đồng bộ câu chữ spec, KHÔNG phải thiếu quyết định kỹ thuật) được
ghi rõ trong cột Actual Result/Status của từng TC. Lưu ý riêng: **BA đang song song xử lý các mâu thuẫn
spec↔contract (Mục 9 `api-contract.md`, MT-01..13)** — QA không tự sửa `srs/*`, chỉ tham chiếu MT-xx
trong ghi chú.

## 1. Soát đặc tả (SPEC-QA-NNN) — đối chiếu lại với contract

| ID | Mức độ | Trạng thái | Vị trí | Đối chiếu contract |
|---|---|---|---|---|
| SPEC-QA-001 | 🔴 High | ✅ **Đã giải quyết** | `architecture/*` | Architect viết lại toàn bộ `api-contract.md` + `data-model.md` + `ADR-002` (2026-09-17, sau khi QA đọc lần đầu); `ADR-001` chuyển `Rejected`. Không còn là gap — mục này giữ lại trong bảng chỉ để lưu vết lịch sử soát đặc tả. |
| SPEC-QA-002 | 🔴 High | ✅ **Đã giải quyết (kỹ thuật)** — còn 1 việc đồng bộ tài liệu | `srs/*-spec.md` FR-004, E-005 | `api-contract.md` Mục 3.1 (bảng "Whitelist") + Mục 4.2: `GET /auth/me` khai `config: { choPhepKhiPhaiDoiMatKhau: true }`, được phép cùng `POST /auth/change-password`. Route không qua `authenticate` (`login`, `refresh`, `forgot-password`, `reset-password`, `logout`) tự nhiên không bị chặn. Architect tự ghi MT-02 "cần BA" — BA cần sửa câu chữ FR-004/E-005 trong spec cho khớp whitelist đầy đủ này (việc còn lại chỉ là đồng bộ tài liệu, không phải quyết định kỹ thuật mới). |
| SPEC-QA-003 | 🔴 High | ✅ **Đã giải quyết (kỹ thuật)** — còn 1 việc đồng bộ tài liệu | `states.md`, BR-011 | `data-model.md` Mục 5.3: `resetPasswordWithOtp` thêm `phaiDoiMatKhau: false` vào `tx.user.update` sẵn có — nhân viên dùng OTP thay vì đổi qua form bắt buộc SẼ được gỡ cờ, hết vòng lặp vô nghĩa. Architect tự ghi MT-01 "cần BA" — BA cần sửa câu "BR-011 giữ nguyên 100%" cho khớp (OTP vẫn giữ nguyên phần tạo mã/hạn mức, chỉ thêm hệ quả gỡ cờ). |
| SPEC-QA-004 | 🔴 High | ✅ **Đã giải quyết** | FR-002, FR-009, FR-011 | `api-contract.md` Mục 6.1: dialog/panel lấy danh sách công ty từ `companies` trong `AuthContext` = `GET /companies` đã lọc sẵn (loại `SUSPENDED`/`ARCHIVED`). Mục 4.6 xác nhận: BE không lọc `status` khi validate MST thuộc owner, nhưng FE không thể chọn nhầm công ty `SUSPENDED` vì nó không xuất hiện trong `GET /companies` — đúng hướng QA đề xuất, rủi ro không xảy ra trong thực tế. |
| SPEC-QA-005 | 🟡 Medium | ✅ **Đã giải quyết** | Validators | `api-contract.md` Mục 4.6 (invite) + 4.10 (access), MT-07: thêm `.refine` chống trùng `donViId`, trả **400** `VALIDATION.DON_VI_TRUNG` thay vì rơi vào 403 `COMPANY.NO_ACCESS` sai nghĩa như trước. |
| SPEC-QA-006 | 🟡 Medium | 🟡 **Còn mở** | BR-013, EC-04b | Contract không đề cập cách hiển thị số đếm trần nhân viên bao gồm người 0-công-ty (không phải phạm vi kỹ thuật của Architect). Vẫn cần BA/UX quyết định wording hiển thị. |
| SPEC-QA-007 | 🟡 Medium | 🟡 **Còn mở (business sign-off)** | BR-014, AC-04.4 | `api-contract.md` Mục 4.10: về kỹ thuật, `setEmployeeAccess()` hiện tại đã tự đúng rule BR-014 mà không cần sửa code (công ty bị bỏ khỏi `access` → xoá luôn dòng `DonViAccess` → mất `xemLuong`; không có cặp nào tồn tại ngoài `access`). Vẫn là **giả định nghiệp vụ** chưa được anh @phamvinh203 xác nhận chính thức (`CONTEXT_SUMMARY.md` Mục 6) — cần sign-off business, không phải vấn đề kỹ thuật nữa. |
| SPEC-QA-008 | 🔴 High | 🔴 **Còn mở** | OQ-7 | `api-contract.md` Mục 4.8 đã chuẩn bị sẵn 2 nhánh ("nếu OQ-7 chốt theo đề xuất" → guard `requireRole('OWNER')`, nhân viên/ADMIN nhận 403 `AUTH.FORBIDDEN` / "nếu chốt không siết" → giữ nguyên) nhưng **OQ-7 vẫn chưa chốt**. Architect phát hiện thêm (MT-08): `GET /companies/invites` cũng đang mở cho nhân viên (lộ email/họ tên/chức vụ người được mời) — nếu OQ-7 chốt siết `GET /companies/employees` mà không siết luôn endpoint này thì vẫn lệch. **Đề xuất mở rộng phạm vi OQ-7 sang cả 2 endpoint** khi chốt (theo gợi ý coordinator) — QA đã thêm TC-074 để theo dõi hiện trạng endpoint thứ hai này. |
| SPEC-QA-009 | 🟢 Low | ✅ **Đã giải quyết** | FR-010 | `api-contract.md` Mục 4.10 xác nhận ngưỡng là `{ "access": [] }` (mảng rỗng), không phải "số lượng công ty giảm" — đúng làm rõ QA đề xuất. |
| SPEC-QA-010 | 🟡 Medium | ✅ **Đã giải quyết** | `setEmployeeAccess()` | `api-contract.md` Mục 4.10 điểm 1 + `data-model.md` Mục 5.4: thêm `await khoaHanMuc(tx, 'nhan_vien', ownerId)` làm câu đầu tiên trong giao dịch — tái dùng khoá advisory của mời/duyệt. Hết rủi ro 500 do deadlock khi 2 `PUT .../access` chạy song song. |

**Ghi nhận thêm từ Architect (không phải SPEC-QA của QA — BA/Architect đang xử lý song song ở Mục 9 `api-contract.md`, QA chỉ theo dõi qua TC liên quan):** MT-03 (đổi mật khẩu bắt buộc phải nhập đúng mật khẩu hiện tại + không được trùng mật khẩu cũ — TC-061/062), MT-06 (FE đồng bộ lại công ty ngay ở lượt 403 `COMPANY_NO_ACCESS` đầu tiên, tốt hơn mức spec "chấp nhận trễ tới khi tải lại trang" — TC-073), MT-09/MT-10/MT-12/MT-13 (thứ tự băm mật khẩu, mật khẩu tạm không hết hạn, `fe_maxv` không có màn đổi mật khẩu, duyệt lời mời khi 1 công ty đã bị xoá cứng — ghi nhận rủi ro, chưa có TC riêng, theo dõi khi BA/Architect chốt).

## 2. Ma trận theo Business Rules

| BR | Mô tả ngắn | TC liên quan | Ghi chú |
|---|---|---|---|
| BR-001 | Module dùng chung theo gói, không đổi | — (ngoài phạm vi) | Không cần TC mới; đảm bảo bởi TC-048 (regression `fe_maxv`/`maxv` không vỡ). |
| BR-002 | Nhân viên chỉ thao tác được công ty được cấp, chặn ở tầng API | TC-039, TC-041, TC-043 | Trọng yếu MAXV — tenant isolation. |
| BR-003 | Owner mời đích danh 1+ công ty của chính mình | TC-014, TC-025 | |
| BR-004 | Lời mời vẫn qua ADMIN duyệt | TC-005, TC-024, TC-070 | Giữ nguyên luồng hiện có; TC-070 thêm case 2 ADMIN duyệt song song. |
| BR-005 | Mật khẩu tạm ≥ 12 ký tự, đủ hoa/thường/số | TC-001 | Contract chốt cụ thể: 16 ký tự, `sinhMatKhauTam()`, `crypto.randomInt`. |
| BR-006 | Tài khoản mới đánh dấu "phải đổi mật khẩu" (`phaiDoiMatKhau`) | TC-005, TC-007, TC-010, TC-071 | Cột DB + claim token — theo `data-model.md` Mục 3, 6. |
| BR-007 | Mật khẩu không log, không lộ qua API | TC-002, TC-003, TC-004, TC-057 | |
| BR-008 | 1 email = 1 tài khoản | TC-018, TC-019 | |
| BR-009 | Chỉ OWNER mời/xem màn Nhân viên | TC-026, TC-050 | |
| BR-010 | Rollback khi gửi mail mật khẩu thất bại | TC-006, TC-067 | TC-067 thêm case duyệt lại sinh mật khẩu MỚI. |
| BR-011 | Quên mật khẩu / ADMIN đặt lại mật khẩu | TC-012, TC-046, TC-047, TC-064 | OTP nay **có** gỡ cờ (SPEC-QA-003 đã giải quyết) — TC-012/TC-064 cập nhật theo. |
| BR-012 | Chỉ OWNER sửa quyền nhân viên của chính mình | TC-038 | |
| BR-013 | Thu hồi hết công ty không xoá tài khoản, vẫn tính trần | TC-029, TC-036 | |
| BR-014 ⚠️ | Xem lương theo cặp, chỉ bật khi đã cấp quyền công ty đó | TC-031, TC-032 | Kỹ thuật đã khớp (contract Mục 4.10); **business sign-off còn mở** (SPEC-QA-007). |

## 3. Ma trận theo Functional Requirements

| FR | Mô tả ngắn | TC liên quan | Ghi chú |
|---|---|---|---|
| FR-001 | Màn Cài đặt → Nhân viên | TC-050, TC-051, TC-052, TC-053 | |
| FR-002 | Dialog mời — checkbox nhiều công ty, tick sẵn công ty header | TC-014, TC-025 | |
| FR-003 | Duyệt lời mời — sinh mật khẩu + gửi email + đánh dấu cờ | TC-005, TC-001 | |
| FR-004 | Chặn request khi `phaiDoiMatKhau=true` (trừ whitelist) | TC-008, TC-009, TC-072 | Whitelist đã chốt: `GET /auth/me` + `POST /auth/change-password` (SPEC-QA-002 đã giải quyết). |
| FR-005 | Đổi mật khẩu xong vào bình thường, không lặp lại | TC-010 | |
| FR-006 | `GET /companies` + route tenant giữ nguyên hành vi lọc | TC-039, TC-040, TC-041, TC-042, TC-043, TC-068 | |
| FR-007 | Bảng nhân viên hiển thị đúng công ty được cấp | TC-039, TC-053 | |
| FR-008 | Mục Nhân viên chỉ OWNER thấy | TC-050 | |
| FR-009 | Panel Sửa quyền — cấp/thu hồi + xem lương | TC-027, TC-028, TC-031 | |
| FR-010 | Hộp thoại xác nhận khi bỏ tick hết | TC-029, TC-030 | Ngưỡng `access: []` đã xác nhận (SPEC-QA-009). |
| FR-011 | Dialog/panel chỉ liệt kê công ty của owner | TC-015, TC-033 | Nguồn dữ liệu đã xác nhận = `GET /companies` (SPEC-QA-004). |

## 4. Ma trận theo Acceptance Criteria

| AC | TC | Trạng thái sẵn sàng |
|---|---|---|
| AC-01.1 | TC-014 | Ready |
| AC-01.2 | TC-020 | Ready (regression) |
| AC-01.3 | TC-018 | Ready (regression) |
| AC-01.4 | TC-050 | Ready |
| AC-01.5 | TC-025 | Ready |
| AC-01.6 | TC-016 | Ready |
| AC-02.1 | TC-002, TC-005 | **Ready** — contract chốt (SPEC-QA-001 đã giải quyết) |
| AC-02.2 | TC-007 | **Ready** — endpoint/response cụ thể (Mục 4.1 `api-contract.md`) |
| AC-02.3 | TC-010 | **Ready** — endpoint `POST /auth/change-password` cụ thể |
| AC-02.4 | TC-006, TC-067 | Ready |
| AC-02.5 | TC-011 | Ready |
| AC-03.1 | TC-039 | Ready (regression) |
| AC-03.2 | TC-040, TC-041 | Ready (regression) |
| AC-03.3 | TC-028, TC-042 | Ready (regression) |
| AC-04.1 | TC-027 | Ready |
| AC-04.2 | TC-028 | Ready |
| AC-04.3 | TC-029 | Ready |
| AC-04.4 | TC-031 | **⚠️ Chờ business sign-off BR-014** (SPEC-QA-007) — kỹ thuật đã Ready |
| AC-04.5 | TC-033 | Ready |
| AC-04.6 | TC-034 | Ready |

Không có AC nào "chưa có test". Chỉ AC-04.4 còn treo — nhưng nay là **business sign-off**, không còn là gap kỹ thuật.

## 5. Ma trận theo Error Matrix (đã điền `code` theo contract)

| Mã lỗi spec | HTTP | `code` | `MESSAGES` | TC |
|---|---|---|---|---|
| E-001 | 403 | — | `AUTH.FORBIDDEN` | TC-026, TC-038, TC-050, TC-060 |
| E-002 | 409 | — | `COMPANY.EMAIL_ALREADY_MEMBER` | TC-018 |
| E-003 | 409 | — | `COMPANY.INVITE_ALREADY_PENDING` | TC-020 |
| E-004 | 502 | — | `COMPANY.INVITE_WELCOME_MAIL_FAILED` | TC-006, TC-067 |
| E-005 | 403 | `PASSWORD_CHANGE_REQUIRED` | `AUTH.PASSWORD_CHANGE_REQUIRED` | TC-008, TC-072 |
| E-006 | 400 | — | `fieldErrors.newPassword` (`passwordRule`) | TC-011 |
| E-007 | 403 | `COMPANY_NO_ACCESS` **chỉ ở 4 điểm kiểm công ty đang chọn trong vé** (route tenant); **KHÔNG** có `code` ở `switch`/`invite`/`PUT access` dù cùng message `COMPANY.NO_ACCESS` | `COMPANY.NO_ACCESS` | TC-040 (không `code`), TC-041 (có `code`), TC-068 |
| E-008 | 400 | — | `fieldErrors.donViIds` (min 1) | TC-016 |
| E-009 | 404 | — | `USER.NOT_FOUND` | TC-034, TC-038 |
| E-010 | 403 | — | `COMPANY.NO_ACCESS` | TC-033 |

### 5b. Mã lỗi mới từ contract (chưa có ID chính thức trong Error Matrix của spec — BA cần bổ sung `E-011..013`)

| Tình huống | HTTP | `code`/nguồn | TC |
|---|---|---|---|
| Đổi mật khẩu: mật khẩu hiện tại sai | 400 (không phải 401) | `message: AUTH.CURRENT_PASSWORD_WRONG` | TC-061 |
| Đổi mật khẩu: mật khẩu mới trùng mật khẩu hiện tại | 400 | `fieldErrors.newPassword`: `VALIDATION.PASSWORD_SAME` | TC-062 |
| `donViIds`/`access` chứa công ty trùng lặp | 400 | `fieldErrors.donViIds`/`fieldErrors.access`: `VALIDATION.DON_VI_TRUNG` | TC-017, TC-069 |

## 6. Ma trận theo Edge Cases

| EC | TC | Ghi chú |
|---|---|---|
| EC-01 | TC-006, TC-067 | |
| EC-02 | TC-019 | Wording lỗi chờ OQ-5. |
| EC-03 | TC-014 | |
| EC-04 | TC-027..032 | US-04 nói chung. |
| EC-04a | TC-042 | |
| EC-04b | TC-036 | |
| EC-04c | TC-029, TC-030 | |
| EC-04d | TC-033 | |
| EC-05 | TC-031, TC-032 | Business sign-off BR-014 còn mở. |
| EC-06 | TC-042, TC-073 | |
| EC-07 | TC-025 | |
| EC-08 | TC-044, TC-054 | Chưa có thông báo rõ ràng — OQ-8 mở. |
| EC-09 | TC-060, TC-074 | Phụ thuộc OQ-7 (SPEC-QA-008, còn mở); TC-074 thêm endpoint `GET /companies/invites` (MT-08). |
| EC-10 | TC-035 | ✅ Cơ chế khoá đã có trong contract (SPEC-QA-010 đã giải quyết). |
| EC-11 | (không cần TC riêng) | Phủ chéo qua TC-018. |

## 7. Phân bổ theo tầng kiểm thử (sau khi thêm TC-061..074)

| Tầng | Số TC | Ghi chú |
|---|---|---|
| BE-unit | 4 | TC-001, TC-004, TC-058, (validator-level) |
| BE-integration | 49 | Phần lớn — auth/invite/approve/access/isolation/regression, gồm 10 TC mới (061-064, 066-071, 074) |
| UI-manual (`hdđt_maxv`) | 14 | +2 TC mới (TC-072, TC-073) |
| Security-focused (subset) | 12 | +TC-061..063, TC-068, TC-069, TC-074 |

Tổng: **74 test case** (TC-001 → TC-074), xem chi tiết ở `qa/test-cases.md`. Không TC nào bị đánh số lại.

## 8. Điều kiện để chuyển "Ready for Implementation"

1. ~~SPEC-QA-001, 002, 003, 004, 005, 009, 010~~ — **✅ đã giải quyết** bởi contract mới.
2. SPEC-QA-008 (OQ-7) **vẫn phải chốt** trước khi code US-04 + Mục 4.8 `api-contract.md` — bao gồm quyết định có mở rộng sang `GET /companies/invites` (MT-08) hay không.
3. SPEC-QA-007 (giả định BR-014) cần anh @phamvinh203 xác nhận ở vòng duyệt cuối — business sign-off, không chặn code phần còn lại.
4. SPEC-QA-006 (Low/Medium, hiển thị đếm trần) không chặn tiến độ, nên quyết định cùng đợt.
5. BA cần đồng bộ câu chữ spec theo MT-01 (BR-011), MT-02 (FR-004/E-005), MT-03 (rule đổi mật khẩu mới), MT-07 (Error Matrix thêm `DON_VI_TRUNG`), MT-08 (phạm vi OQ-7) — không chặn Backend code (Architect đã có đề xuất kỹ thuật cụ thể), nhưng cần làm sớm để `srs/*-spec.md` không lệch với `api-contract.md`.
