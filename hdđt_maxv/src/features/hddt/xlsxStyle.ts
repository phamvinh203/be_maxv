/**
 * Ba hằng style dùng CHUNG cho mọi bảng xuất Excel của cả app (Hóa đơn điện tử, HRM, Dịch vụ công,
 * Tờ khai) — tách riêng khỏi `exportXlsx.ts` để module nào chỉ cần trang trí ô (viền, màu tiêu đề,
 * chiều cao tiêu đề) không phải kéo theo `./templates` (có JSX) và toàn bộ hạ tầng dựng sheet.
 */

export const HEADER_FILL = "FFDDE6F2"; // xanh nhạt
export const HEADER_HEIGHT = 40; // đủ cho tiêu đề dài xuống dòng ở các cột hẹp

/** Viền mảnh 4 cạnh — dùng cho ô tiêu đề và mọi ô dữ liệu. */
export const CELL_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
} as const;
