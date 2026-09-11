---
type: review-findings
feature: dich-vu-cong
updated: 2026-09-11
---

## Review 2026-09-11 — Nhóm 9/9 (audit toàn bộ `hdđt_maxv/src`): phần dịch vụ công — Verdict: ⚠️ Approve with comments

> Phạm vi: `features/dich_vu_cong/**`, `pages/dich_vu_cong/**` (tách từ báo cáo gộp DVC+to_khai — xem `docs/to-khai-gtgt01/review-findings.md` cho phần tờ khai, nơi có finding 🔴 blocking). Phần DVC không có blocking, nhưng có 1 rò log nhạy cảm và nhiều gap chức năng.

### RVW-D01 🟡 NON-BLOCKING — 3/7 ô bộ lọc tra cứu hồ sơ bị bỏ qua im lặng; 2 ô còn lại map sai nhãn
- Vị trí: `src/pages/dich_vu_cong/DvcPage.tsx`:114-127 ↔ `src/features/dich_vu_cong/components/BoLocHoSo.tsx`:26-36 ↔ `config.ts`:13-21, 180-188
- Vấn đề: form khai 7 trường nhưng `mutationFn` chỉ gửi 4 — `maGiaoDich`, `noiNop`, `kyTinhThue` không bao giờ tới API. Ô nhãn "Mã giao dịch" bị bỏ trong khi ô nhãn "Tờ khai" mới là thứ được gửi. Màn đối soát với cơ quan thuế — gõ mã giao dịch, bấm Tìm, nhận về toàn bộ hồ sơ, tưởng đã lọc.
- Đề xuất fix: nối đủ 3 param còn thiếu, hoặc bỏ hẳn 3 ô khỏi form + sửa nhãn 2 ô còn lại cho khớp param thật.
- Trạng thái: OPEN

### RVW-D02 🟡 NON-BLOCKING — In nguyên body phản hồi đăng nhập cổng DVC ra console
- Vị trí: `src/features/dich_vu_cong/components/DialogLoginDVC.tsx`:234 — `console.info("[DVC-LOGIN] cổng trả về:", res.data)`
- Vấn đề: `res.data` là body cổng trả khi đăng nhập thành công — dạng phản hồi chưa chốt, có thể chứa định danh phiên/thông tin NNT. CLAUDE.md cấm log credential/expose sensitive data. Đây là dòng duy nhất trong 49 file log dữ liệu phản hồi. (Ghi nhận thêm: cùng lỗi này còn thấy ở `hdđt_maxv/src/features/hddt/*` theo review nhóm core/auth — cùng pattern DVC login logging.)
- Đề xuất fix: bọc `if (import.meta.env.DEV)`, hoặc chuyển việc thu thập mẫu response sang log BE.
- Trạng thái: OPEN

### RVW-D03 🟡 NON-BLOCKING — `messageCuaCong` coi mọi phản hồi không nhận dạng được là đăng nhập hỏng, trái comment của chính nó
- Vị trí: `.../DialogLoginDVC.tsx`:47-70, đối chiếu comment 39-46
- Vấn đề: comment nói "không có message thì coi như xong", code làm ngược — `status` rỗng vẫn trả "không thành công" → `onLoginSuccess` không chạy dù BE đã mở phiên, còn gọi thêm `refreshCaptcha()` (rủi ro 429).
- Đề xuất fix: chốt bằng 1 mẫu response thật rồi sửa 1 trong 2 (code hoặc comment) cho khớp; đảo default thành "không nhận dạng được → coi là thành công".
- Trạng thái: OPEN

### RVW-D04 🟡 NON-BLOCKING — Tải file hồ sơ/thông báo/GNT báo "Đã tải" mà không kiểm tra blob thực sự là file
- Vị trí: `taiFileHoSo.ts`:15-19 · `taiThongBao.ts`:16-18 · `giay_nop_tien/taiFileGiayNopTien.ts`:11-13 · `pages/dich_vu_cong/DvcPage.tsx`:273-278
- Vấn đề: chỉ ném khi `!res.ok`. Cổng trả 200 kèm HTML trang đăng nhập (phiên chết) vẫn được lưu xuống máy + toast xanh "Đã tải".
- Đề xuất fix: guard chung — `blob.size===0` hoặc `blob.type` bắt đầu `text/html`/`application/json` → throw kèm gợi ý đăng nhập lại.
- Trạng thái: OPEN

### RVW-D05 🟡 NON-BLOCKING — `duoiTuContentType` trượt khi content-type có tham số charset → lưu XML thành `.pdf`
- Vị trí: `src/features/dich_vu_cong/duoiTuContentType.ts`:5-14
- Đề xuất fix: `contentType.split(";")[0].trim().toLowerCase()` trước khi tra bảng.
- Trạng thái: OPEN

### RVW-D06 🟡 NON-BLOCKING — 3 query key của module DVC thiếu MST, dialog không đóng khi đổi công ty
- Vị trí: `ThongBaoDialog.tsx`:48 · `ToKhaiXmlDialog.tsx`:139 · `TaiLieuDinhKemDialog.tsx`:71 · `pages/dich_vu_cong/DvcPage.tsx`:76-80
- Vấn đề: query key thiếu `activeMst`, 3 state mã hồ sơ không reset khi đổi công ty → dialog vẫn hiện cache của công ty cũ.
- Đề xuất fix: thêm `activeMst` vào 3 key; reset 3 state khi `activeMst` đổi (hoặc `key={activeMst}`).
- Trạng thái: OPEN

### RVW-D07 🟡 NON-BLOCKING — `xuatChiTieuExcel` kéo nhầm `hddt/exportXlsx` chỉ để lấy 3 hằng style
- Vị trí: `src/features/dich_vu_cong/xuat_excel/xuatChiTieuExcel.ts`:1
- Đề xuất fix: đổi import sang `../../hddt/xlsxStyle` (file đã tồn tại đúng mục đích này, `to_khai/xuatToKhaiExcel.ts` đã dùng đúng).
- Trạng thái: OPEN

### RVW-D08 🟡 NON-BLOCKING — `XuatFileDvcDialog`: không validate khoảng ngày, 1 loại lỗi làm hỏng cả lượt xuất
- Vị trí: `.../components/XuatFileDvcDialog.tsx`:133, 150-161
- Vấn đề: không kiểm `tuNgay <= denNgay` (dialog anh em `DialogDongBo` có kiểm); `Promise.all` bao 6 lượt gọi, 1 lỗi làm reject toàn bộ dù vài file đã ghi xong.
- Đề xuất fix: thêm check ngày; đổi `Promise.all` → `Promise.allSettled` + liệt kê loại nào hỏng trong toast.
- Trạng thái: OPEN

### 🟢 Suggestion (gộp gọn)
- `CAN_KHO_RONG` ở `ToKhaiXmlDialog.tsx` rút gọn còn 1 dòng điều kiện.
- `BangHoSo.tsx`:189-192 `fmtMoney` trả `""` cho cả 0 lẫn NaN — nên giữ chuỗi thô khi không parse được.
- `clearDvcKeys()` chỉ chạy khi đăng xuất chủ động, không chạy khi phiên app hết hạn bị động (máy dùng chung).
- "Quên mật khẩu" trong `DialogLoginDVC.tsx` có `cursor:pointer` nhưng không `onClick`.
- Tiêu đề dialog "Thống kê giấy nộp tiền" lệch với nội dung thật.
- `BoLocHoSo.tsx`:83 `initialValues` là default param chạy lại mỗi render.
- `tachKyKeKhai` gọi 2 lần/dòng trong Excel; cột "Quý" luôn rỗng cho tờ khai tháng.
- `DialogDongBo.tsx`:131 dùng non-null assertion không cần thiết; không cảnh báo khoảng ngày quá dài (mỗi hồ sơ ~3.2s qua pacer).
- `DanhSachKyDaLap.tsx` không điều hướng được bằng bàn phím.
- `api/dvc.ts`:7-13 `qsBoQuaRong` chỉ nhận string, âm thầm bỏ number/boolean.

---

**Security findings:** không phát hiện lỗ hổng chặn merge. RVW-D02 (log) và RVW-D06 (cache key thiếu MST) là 2 điểm cần xử lý. Third-party isolation đúng (100% qua `apiFetch`/BE proxy, không gọi cổng DVC trực tiếp); mật khẩu cổng DVC không lưu/không log (chỉ cờ `dungMatKhauDaLuu`); không XSS.

**Performance findings:** ổn — `theoDoiDongBoDvc` chỉ vẽ lại khi số liệu đổi thật, có trần lỗi liên tiếp; `xuatXmlHangLoat` ghi theo lô 25 file có chặn concurrency.

**Final recommendation:** ⚠️ Approve with comments — không blocking cho phần DVC (blocking duy nhất của nhóm 9 thuộc phần to_khai, xem `docs/to-khai-gtgt01/review-findings.md#RVW-T01`). Ưu tiên: RVW-D01 (bộ lọc sai) + RVW-D02/D03 (đăng nhập cổng) trước, còn lại theo lịch dọn dẹp.
