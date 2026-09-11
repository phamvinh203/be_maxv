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
  // Bỏ tham số sau dấu `;` (vd `application/xml; charset=utf-8`) rồi mới tra bảng — thiếu bước
  // này thì content-type có charset trượt khỏi bảng, rơi về `macDinh` sai đuôi (RVW-D05).
  const loai = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  return DUOI_THEO_CONTENT_TYPE[loai] ?? macDinh;
}

/**
 * Guard chung cho mọi lượt tải file lẻ của module này (`taiFileHoSo`, `taiThongBao`,
 * `taiFileGiayNopTien`): cổng vẫn có thể trả 200 kèm trang đăng nhập (phiên chết) thay vì file
 * thật — `apiFetchBlob` không phân biệt được lỗi này, phải tự soi `blob` trước khi lưu xuống máy
 * và báo "Đã tải" (RVW-D04).
 */
export function kiemTraBlobLaFile(blob: Blob): void {
  const loai = blob.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (blob.size === 0 || loai.startsWith("text/html") || loai.startsWith("application/json")) {
    throw new Error(
      "Không tải được file — có thể phiên cổng Dịch vụ công đã hết hạn. Vui lòng đăng nhập lại rồi thử tải lại.",
    );
  }
}
