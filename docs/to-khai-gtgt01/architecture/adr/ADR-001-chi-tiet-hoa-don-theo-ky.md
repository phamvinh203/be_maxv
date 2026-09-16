---
type: adr
feature: to-khai-gtgt01
status: accepted
updated: 2026-09-16
links:
  - docs/to-khai-gtgt01/architecture/api-contract.md
  - docs/to-khai-gtgt01/srs/to-khai-gtgt01-spec.md
---

# ADR-001: Chi tiết hóa đơn theo kỳ — endpoint riêng trả bảng kê kèm `chiTiet` từng dòng

## Context

Excel tờ khai cần sheet "Chi tiết mua vào/bán ra" có tập hóa đơn trùng tuyệt đối sheet "HĐ..."
(BR-to-khai-gtgt01-001) và STT khớp từng hóa đơn (FR-to-khai-gtgt01-004). Tập hóa đơn của kỳ chỉ được
định nghĩa trong `layBangKeTheoKy` (`keKhaiKy.service.ts:502-531`: đã gán kỳ + `duocTinh`).
`/gdt/invoices/:direction/saved-details` lọc theo khoảng ngày nên lệch tập, và không trả `id`.

## Decision

Thêm `GET /api/v1/to-khai/hoa-don/chi-tiet?nam&kyLoai&kySo&chieu`. BE gọi nguyên `layBangKeTheoKy`,
đọc cột `detail` theo `id` của đúng các dòng đó, trả `{ total, datas, thayThe }` với mỗi dòng có thêm
`chiTiet: object | null`. FE xuất Excel chỉ gọi endpoint này, 2 lượt (mỗi chiều 1 lượt), dựng cả
sheet "HĐ..." lẫn "Chi tiết..." từ cùng một response.

## Alternatives

| Phương án | Vì sao không chọn |
|---|---|
| (a) Endpoint riêng chỉ trả mảng chi tiết, FE gọi thêm `GET /to-khai/hoa-don` (4 lượt như `flows.md`) | 4 lượt; BE chạy `layBangKeTheoKy` 2 lần mỗi chiều; bảng kê và chi tiết là 2 ảnh chụp DB khác thời điểm — một lượt "Kê khai" hoặc "Tính lại" chen giữa là lệch tập; FE phải ghép STT theo khóa |
| (b) Thêm cờ `kemChiTiet` vào `GET /to-khai/hoa-don` | Đụng controller đang phục vụ màn hình; không gắn được rate limit riêng cho lượt nặng (payload `detail` vài KB/hóa đơn) mà không áp lên luồng hiển thị; trái NFR-to-khai-gtgt01-002 ("một endpoint đọc riêng") |
| (c) Trả `detail` trực tiếp trong `GET /to-khai/hoa-don` | Màn hình bảng kê kéo thêm toàn bộ JSON chi tiết mỗi lần mở tab — vi phạm NFR-to-khai-gtgt01-002 |

## Trade-offs

Ưu điểm:
- Tập hóa đơn định nghĩa ở đúng một chỗ; tập của 2 sheet trùng nhau do cùng response, kể cả khi dữ liệu
  đổi giữa chừng.
- Ghép chi tiết theo `id` tại BE, không cần FE tra khóa, không phụ thuộc thứ tự `ORDER BY tdlap` khi
  trùng ngày lập.
- Không chạm endpoint và caller hiện có; code BE thêm khoảng 1 hàm service, 1 handler, 1 dòng route.

Nhược điểm:
- `getSavedInvoices` đã trích 4 chuỗi từ `detail` (`readDetailExtras`), endpoint này đọc `detail` thêm
  một lần — lặp I/O, chấp nhận vì xuất Excel là thao tác thưa.
- Response giữ toàn bộ chi tiết của kỳ trong RAM (Node và trình duyệt). Cùng mức trần với
  `/saved-details` hiện có (366 ngày), trong khi đây tối đa 1 quý.

## Consequences

- Route mới có `gioiHanTheoNguoiDung(20, "1 minute")`; 429 trả body mặc định của plugin.
- `srs/to-khai-gtgt01-flows.md` (4 lượt) cần BA cập nhật thành 2 lượt; AC-to-khai-gtgt01-005 /
  E-to-khai-gtgt01-002 không phát sinh vì không có trần khoảng ngày.
- Nếu một kỳ vượt vài chục nghìn hóa đơn làm response quá nặng: chuyển sang dựng xlsx phía BE dạng
  stream, giữ nguyên nguồn tập hóa đơn `layBangKeTheoKy`.
