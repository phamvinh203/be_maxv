---
type: adr
feature: hrm
status: accepted
updated: 2026-09-14
---

# ADR-011: Nền tảng UI dùng chung cho HRM (DataTable/AsyncState/FormDialog) và pilot Bảng lương

## Context

Rà soát UI/UX toàn bộ `hdđt_maxv/src/features/hrm` (119 file, 28 route) cho thấy giao diện đã mọc tự nhiên qua nhiều đợt thêm tính năng liên tiếp, không qua thiết kế hệ thống:

- Không nơi nào dùng `@mui/x-data-grid` — mọi danh sách tự dựng `Table`/`TableRow`/`TableCell` + `TablePagination`, tải hết dữ liệu về rồi mới cắt trang phía trình duyệt, kể cả nơi comment tự ghi nhận "vài trăm-nghìn dòng" (`NhanVienTable.tsx`, `BangLuongTable.tsx`).
- `BangLuongTable.tsx` — màn hình lõi nhất (tổng hợp lương) — có 19 cột dính cứng, trong đó 2 cột thu nhập chỉ xem được qua tooltip vì hết chỗ hiển thị.
- 21 file dialog gần như copy-paste (bộ 3 "Danh sách/Quản lý/Tái sử dụng" lặp lại cho từng loại dữ liệu tính lương: chấm công, tăng ca, KPI, thưởng, sản phẩm, %, chuyên cần, bù trừ), mỗi file tự quản lý form bằng `useState` tay (262 lượt dùng `useState` cho form trên 62 file).
- HRM tự dựng bộ nav riêng (`HrmNav`, `DanhMucNav`, `BangLuongNav`...) thay vì dùng lại shell dùng chung đã có ở `features/accounting/_shared/` (`AppSidebar`, `ModulePage`); spacing/màu là `sx` hardcode rải rác, không có theme token.
- Loading/empty/error state không nhất quán: chỉ 7/119 file dùng `Skeleton`, phần còn lại là `CircularProgress` trần hoặc không có trạng thái nào.
- Xác nhận thêm: backend HRM (`nhanVien.service.ts`, `payrollCalculation.service.ts`) hiện KHÔNG hỗ trợ phân trang/sort server-side (`findMany` không `.skip`/`.take`, không trả tổng số dòng) — mọi màn đang giả định fetch-toàn-bộ.

Chủ dự án yêu cầu làm lại UI/UX nhưng chưa muốn đổi backend hay đổi cấu trúc nav ở đợt này. Quyết định này chốt phạm vi và kiến trúc cho đợt làm lại đầu tiên.

## Decision

**1. Dựng bộ component nền dùng chung, đặt tại `hdđt_maxv/src/features/hrm/_shared/components/`** (đúng quy ước feature-scoped hiện có — `_shared/` chỉ HRM dùng, không đẩy lên `features/_shared/` vì chưa có feature thứ 2 cần):

- `HrmDataTable.tsx` — bọc `@mui/x-data-grid` (Community, bản khớp MUI v9). Cấu hình: column visibility model (bật/tắt cột thay hẳn kiểu giấu trong tooltip), pinning cột đầu bằng tính năng có sẵn của DataGrid (thay CSS sticky tay), phân trang/sort **vẫn client-side** — giữ nguyên nguồn dữ liệu, không đụng backend ở đợt này.
- `AsyncState.tsx` — bọc nội dung: `Skeleton` khi loading, empty-state khi rỗng, error-state khi fetch lỗi.
- `HrmFormDialog.tsx` — khung dialog chuẩn hoá field + `react-hook-form` + `zod` resolver (tái dùng `zod`, đã là chuẩn validate ở `be_maxv`, tránh thêm thư viện lạ). Dựng khung ở đợt này để pilot kế tiếp (1 trong 8 cặp dialog `du_lieu_tinh_luong`) dùng ngay, không phải dựng lại.

**2. Pilot đầu tiên: `BangLuongTable.tsx`.** Thay bảng tay bằng `HrmDataTable`, hiện thật 2 cột đang ẩn trong tooltip, bọc bằng `AsyncState`. Không đổi hook/API gọi dữ liệu — chỉ đổi lớp hiển thị.

**3. Thêm 2 dependency mới:** `@mui/x-data-grid` (bản Community, miễn phí, khớp MUI v9) và `react-hook-form` + `@hookform/resolvers` (dùng `zod` đã sẵn có ở BE làm resolver, không thêm thư viện validate mới).

**4. Ngoài phạm vi đợt này (chốt rõ để không lan man):** không sửa backend (không thêm `skip`/`take`/`count`), không đụng nav hay ẩn 2 màn "chưa dùng" (`to_khai_thue`, `ho_so_luong`), không gộp 21 file dialog ngay (chờ pilot 2 dùng `HrmFormDialog` để kiểm chứng pattern trước khi nhân rộng), không thêm hạ tầng test mới (`hdđt_maxv` hiện chưa có Vitest/RTL — quyết định riêng nếu cần).

## Alternatives

**Làm lại toàn bộ 28 màn cùng lúc ("big bang").** Bỏ: rủi ro cao, khó review, và lặp lại đúng kiểu "thêm ồ ạt rồi sửa lỗi hàng loạt" đã thấy trong lịch sử commit gần đây (`fix(hrm): sửa N lỗi non-blocking` liên tiếp 3 đợt).

**Chỉ chỉnh giao diện (spacing/màu), giữ nguyên `Table` tay + `useState`.** Bỏ: không giải quyết gốc rễ — bảng vẫn tải hết dữ liệu về client, 21 dialog vẫn tiếp tục nhân bản mỗi khi thêm loại dữ liệu tính lương mới.

**Thêm server-side pagination cùng lượt.** Hoãn: đây là thay đổi backend, phải qua flow backend-engineer riêng (theo quy trình Backend-First trong `CLAUDE.md`), không phải quyết định thuần UI/UX. Giữ client-side cho tới khi số dòng thực tế chứng minh cần.

## Trade-offs

**Được:** cột dữ liệu bảng lương không còn ẩn trong tooltip; 1 pattern bảng + 1 pattern dialog dùng chung thay vì mỗi màn tự viết; form có validate nhất quán qua `zod`; đường đi rõ ràng để dọn 21 file dialog trùng lặp ở đợt sau.

**Mất:** thêm 2 dependency mới cần bảo trì phiên bản khớp MUI v9; bảng vẫn chưa scale được với dữ liệu thật lớn vì phân trang còn client-side (nợ kỹ thuật có chủ đích, ghi rõ ở đây để không quên); phải làm 2 đợt (pilot rồi mới nhân rộng) thay vì xong một lần.

## Consequences

- `hdđt_maxv/package.json` thêm `@mui/x-data-grid`, `react-hook-form`, `@hookform/resolvers`.
- `BangLuongTable.tsx` đổi cách render nhưng giữ nguyên props/hook gọi dữ liệu — không ảnh hưởng API contract.
- `HrmFormDialog` chưa có màn nào dùng thật ở đợt này — nếu pilot 2 (dialog) không chốt được sau khi xem `BangLuongTable`, khung này có thể cần chỉnh lại trước khi nhân rộng.
- Nợ kỹ thuật đã biết: phân trang/sort vẫn client-side — nếu số nhân viên/dòng bảng lương thực tế vượt ngưỡng chấp nhận được (chưa đo), cần một ADR riêng cho server-side pagination trước khi mở rộng thêm.

## Nguồn

- Khảo sát UI/UX 2026-09-14 (Explore agent) — `hdđt_maxv/src/features/hrm`, `hdđt_maxv/src/pages/hrm/`.
- Khảo sát backend 2026-09-14 — `be_maxv/src/services/client/hrm/du_lieu_ca_nhan/nhanVien.service.ts:139-182`, `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts:274-718`.
- Quyết định phạm vi do chủ dự án chốt qua trao đổi trực tiếp 2026-09-14 (không qua `/brainstorm` chính thức — phiên do chủ dự án yêu cầu trực tiếp).
