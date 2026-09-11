/**
 * Tùy chọn @fastify/multipart dùng ở app.ts.
 *
 * Route upload DUY NHẤT (`POST /hrm/tai-lieu/:id/file`) nhận đúng 1 file, không đọc trường text nào.
 * Mọi trần đặt tường minh (vbsec 2026-09-10): mặc định của busboy là không giới hạn số trường và mỗi
 * trường 1MB — một request nhồi hàng nghìn trường text giữ cả GB RAM nếu proxy không chặn cỡ body.
 */
export const MULTIPART_OPTS = {
  limits: {
    /** Khớp `GIOI_HAN_FILE_BYTE` ở taiLieuDrive.service — chặn ngay lúc đọc request. */
    fileSize: 10 * 1024 * 1024,
    files: 1,
    /** Trường text: route không dùng, chừa vài trường cho FE gửi kèm (vd tên) mà không vỡ. */
    fields: 5,
    fieldSize: 1024,
    /** Tổng số phần (file + trường). */
    parts: 6,
    headerPairs: 100,
  },
};
