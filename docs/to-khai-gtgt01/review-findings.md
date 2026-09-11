---
type: review-findings
feature: to-khai-gtgt01
updated: 2026-09-11
---

## Review 2026-09-11 — Nhóm 9/9 (audit toàn bộ `hdđt_maxv/src`): phần tờ khai GTGT — Verdict: ❌ Request changes

> Phạm vi: `features/to_khai/**` (phần liên quan tờ khai GTGT, tách từ báo cáo gộp DVC+to_khai — xem `docs/dich-vu-cong/review-findings.md` cho phần DVC). Kết luận trọng tâm: FE **không tự tính** công thức GTGT (đúng quyết định, mọi chỉ tiêu do BE trả), không tìm thấy lỗi làm tròn tiền. Vấn đề nằm ở khâu validate trước khi xuất/chốt.

### RVW-T01 🔴 BLOCKING — "Chốt" / "Xuất XML" / "Xuất Excel" không kiểm tra ô sửa tay chưa lưu → tờ khai nộp đi khác số kế toán đang nhìn
- Vị trí: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`:121, 229-238, 326, 338, 348
- Vấn đề — tái hiện được theo 3 bước:
  1. Gõ chuỗi không đọc được vào 1 ô sửa được rồi Tab → `onBlur` gặp `docSoTien` trả `undefined` → return im lặng, không lưu không báo.
  2. Gõ số hợp lệ vào ô khác rồi Tab → `luuVaTinhLai()` gom cả `nhap`, thấy `oHong` khác rỗng → `if (gom.oHong.length > 0) return;` bỏ lưu TOÀN BỘ, cũng không toast (cố ý im lặng theo comment).
  3. Bấm Chốt/Xuất XML/Xuất Excel — cả 3 nút chỉ xét `disabled={dangChay || !ban}`, không xét `nhap` — chạy với số CŨ trên server trong khi màn hình đang hiện số MỚI.
  - XML xuất ra nạp thẳng vào HTKK để ký số và nộp thuế → số đã nộp ≠ số kế toán tin là đã nhập, không cảnh báo nào.
- Đề xuất fix: `const chuaLuu = Object.keys(nhap).length > 0;` thêm `|| chuaLuu` vào `disabled` của Chốt/Xuất Excel/Xuất XML kèm Tooltip lý do; khi `oHong.length > 0` phải đánh `error`/`helperText` lên đúng ô trong `oHong` thay vì im lặng tuyệt đối. Gộp luôn: `bamTinh` (:73-79) `setNhap({})` khi "Tính lại" cũng nên confirm nếu `chuaLuu`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm `chuaLuu` + Tooltip disable Chốt/Xuất Excel/Xuất XML; state `oLoi` đánh `error`/`helperText` lên đúng ô hỏng thay vì `return` im lặng (cả ở `luuVaTinhLai`, `bamLuu`, và `onBlur` khi `docSoTien` trả `undefined`); `bamTinh` mở `Dialog` xác nhận trước khi xóa nháp nếu `chuaLuu`. File: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`, tsc+eslint pass (0 lỗi/0 warning), commit "chưa commit" *(frontend-engineer)*

### RVW-T02 🟡 NON-BLOCKING — `xuatToKhaiExcel.ts` import tĩnh `exceljs` (~1MB) vào chunk route `/to-khai`
- Vị trí: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:1
- Vấn đề: duy nhất file này trong toàn app dùng value-import; 8 chỗ khác đều `import type` + `await import("exceljs")` lazy. `ToKhaiGtgt01Editor` import tĩnh file này nên mọi lần vào màn Tờ khai đều kéo ExcelJS dù không ai bấm Xuất.
- Đề xuất fix: đổi thành `import type ExcelJS from "exceljs"` + `const { Workbook } = await import("exceljs")` trong hàm xuất (đã là `async`).
- Trạng thái: OPEN

### RVW-T03 🟡 NON-BLOCKING — Đổi 1 ô "Kê khai"/"Chỉ tiêu tăng giảm" làm invalidate toàn bộ cache module tờ khai
- Vị trí: `hdđt_maxv/src/features/to_khai/api/toKhaiQueries.ts`:67-75 · `components/OQuyetDinh.tsx`:29-37
- Vấn đề: mỗi lần đổi select → `invalidateQueries({queryKey: toKhaiKeys.byCompany})` → refetch cả 2 bảng kê (mua+bán, có thể hàng nghìn dòng) + bản tờ khai. Sửa 20 dòng = 20 lượt tải lại toàn bộ.
- Đề xuất fix: truyền thêm `ky` vào biến thể mutation, chỉ invalidate `toKhaiKeys.bangKe(companyId, ky, chieu)` + `gtgt01Keys.ban(companyId, ky)`.
- Trạng thái: OPEN

### RVW-T04 🟢 SUGGESTION — File Excel đối soát thiếu hàng "A — chỉ tiêu [21]"
- Vị trí: `xuatToKhaiExcel.ts`:136-156
- Vấn đề: vòng lặp chỉ chạy `HANG_GTGT01`, thiếu hàng "Không phát sinh hoạt động mua, bán trong kỳ" mà màn hình có (`ToKhaiGtgt01Form.tsx`:137-143).
- Đề xuất fix: thêm hàng A vào vòng lặp xuất.

---

**Trọng tâm được hỏi — trả lời trực tiếp:**
- Third-party isolation, timeout/lỗi mạng khi đồng bộ: không áp dụng cho `to_khai` (module này không nộp online, chỉ xuất XML để nạp HTKK).
- Công thức tổng hợp + làm tròn: FE cố ý không tự tính; `docSoTien`/`fmtSoTien` đọc/ghi đồng bộ, khớp `numFmt` Excel. **Không tìm thấy lỗi làm tròn ở FE** — verify công thức thật cần làm ở nhóm review `be_maxv`.
- State machine: `"nhap" | "chot"` — union đúng nghĩa, không phải boolean rời rạc. Thiếu trạng thái "đã nộp" thật (chỉ có "đã chốt", mở khóa lại được) — nên ghi vào SRS nếu cần track.
- Validate dữ liệu bắt buộc trước khi nộp: đây là chỗ yếu nhất → **RVW-T01**.

**Final recommendation:** ❌ Request changes — bắt buộc RVW-T01 trước khi merge (~15 dòng fix).
