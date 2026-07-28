# Tài liệu kỹ thuật — Frontend hdđt_maxv

Tài liệu dành cho **lập trình viên mới tham gia dự án**. Mục tiêu: sau khi đọc hết, bạn hiểu được kiến trúc, biết code mới phải đặt ở đâu, và **không gây rò rỉ dữ liệu giữa các công ty** — lỗi nghiêm trọng nhất mà kiến trúc đa tenant của dự án này có thể mắc phải.

Mỗi chương đều có code thật trích từ repo kèm giải thích logic.

---

## Lộ trình đọc

### Ngày đầu tiên — hiểu bối cảnh và chạy được dự án

| | Chương | Nội dung |
|---|---|---|
| 1 | [Tổng quan & phạm vi hệ thống](01-tong-quan.md) | Ứng dụng làm gì, ranh giới với `be_maxv` và hệ thống Thuế điện tử |
| 2 | [Cài đặt & chạy dự án](02-cai-dat-va-chay.md) | Lệnh, proxy dev, biến môi trường |
| 3 | [Kiến trúc & quy ước thư mục](03-kien-truc-va-thu-muc.md) | Code mới đặt ở đâu |

### Ngày thứ hai — hiểu hạ tầng

| | Chương | Nội dung |
|---|---|---|
| 4 | [Tầng giao tiếp API](04-tang-giao-tiep-api.md) | `apiFetch`, `ApiError`, tự làm mới phiên khi 401 |
| 5 | [Quản lý dữ liệu máy chủ](05-quan-ly-du-lieu-tanstack-query.md) | TanStack Query, quy ước `queryKey` |
| 6 | [Trạng thái toàn cục](06-context-toan-cuc.md) | 3 Context: Auth, phiên GDT, cài đặt hiển thị |

### Trước khi sửa dòng code đầu tiên — **bắt buộc**

| | Chương | Nội dung |
|---|---|---|
| 7 | [Đa công ty & cách ly tenant](07-da-cong-ty-va-cach-ly-tenant.md) | ⚠️ Quy tắc chống rò rỉ dữ liệu giữa các MST |
| 12 | [Quy ước lập trình & lint](12-quy-uoc-lap-trinh.md) | Luật ESLint React 19, quy ước đặt tên, quy ước thông báo |

### Khi làm việc với tính năng cụ thể

| | Chương | Nội dung |
|---|---|---|
| 8 | [Tác vụ nền & theo dõi tiến độ](08-tac-vu-nen-va-poll.md) | Mẫu `start → poll → invalidate`, nối lại lượt sau F5 |
| 9 | [Định tuyến & bảo vệ route](09-dinh-tuyen.md) | `ProtectedRoute`, `GuestOnlyRoute` |
| 10 | [Luồng nghiệp vụ chính](10-luong-nghiep-vu.md) | 7 sơ đồ tuần tự |
| 11 | [Pipeline xuất file](11-pipeline-xuat-file.md) | HTML/XML/PDF/Excel, File System Access API |

### Tra cứu

| | Chương | Nội dung |
|---|---|---|
| 13 | [Hướng dẫn mở rộng](13-huong-dan-mo-rong.md) | Công thức thêm màn hình / endpoint / cột bảng |
| 14 | [Hợp đồng API với be_maxv](14-hop-dong-api.md) | Toàn bộ endpoint, tham số, kiểu dữ liệu |

---

## Danh mục sơ đồ

| Sơ đồ | Chương |
|---|---|
| Ngữ cảnh hệ thống | [01](01-tong-quan.md#sơ-đồ-ngữ-cảnh) |
| Cây thư mục & phụ thuộc giữa các tầng | [03](03-kien-truc-va-thu-muc.md#phụ-thuộc-giữa-các-tầng) |
| Vòng đời request + tự làm mới phiên 401 | [04](04-tang-giao-tiep-api.md#sơ-đồ-vòng-đời-một-request) |
| Cây provider Context | [06](06-context-toan-cuc.md#cây-provider) |
| Quyết định chọn token theo tenant | [07](07-da-cong-ty-va-cach-ly-tenant.md#sơ-đồ-quyết-định-chọn-token) |
| Vòng đời tác vụ nền | [08](08-tac-vu-nen-va-poll.md#vòng-đời-một-lượt-chạy-nền) |
| 7 luồng nghiệp vụ | [10](10-luong-nghiep-vu.md) |
| Chuỗi biến đổi dữ liệu khi xuất file | [11](11-pipeline-xuat-file.md#chuỗi-biến-đổi-dữ-liệu) |

---

## Ba điều cần nhớ trước khi code

1. **Token Thuế điện tử luôn chọn theo MST của công ty đang chọn.** Không bao giờ tự ghép `getGdtToken(mst)` — dùng hook `useActiveGdtToken()`. Lý do ở [chương 7](07-da-cong-ty-va-cach-ly-tenant.md).
2. **Mọi `queryKey` đọc dữ liệu tenant phải gắn `currentCompanyId`.** Thiếu là dữ liệu công ty A hiện trên màn hình công ty B.
3. **Toast cho sự kiện, `Alert` inline cho lỗi kéo dài.** Đừng trộn lẫn hai loại. Chi tiết ở [chương 12](12-quy-uoc-lap-trinh.md).

---

## Tài liệu liên quan

- [Hướng dẫn sử dụng phần mềm](../HUONG_DAN_SU_DUNG.md) — tài liệu cho người dùng cuối, mô tả từng màn hình và thao tác.
