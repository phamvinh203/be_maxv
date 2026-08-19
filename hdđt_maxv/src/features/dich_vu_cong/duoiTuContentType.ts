/**
 * Đuôi file suy từ content-type cổng Dịch vụ công trả về — dùng chung cho mọi lượt tải file lẻ
 * của module này (`taiFileHoSo`, `taiThongBao`), tránh mỗi nơi tự chép lại một bảng.
 */
const DUOI_THEO_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "text/xml": "xml",
  "application/xml": "xml",
  "application/zip": "zip",
};

export function duoiTuContentType(contentType: string, macDinh: string): string {
  return DUOI_THEO_CONTENT_TYPE[contentType] ?? macDinh;
}
