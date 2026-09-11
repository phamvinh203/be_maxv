/**
 * Thông điệp lỗi trả cho client ở các controller TỰ bắt lỗi rồi trả `message` (không đi qua errorHandler).
 *
 * Service ném `Error` thường với thông điệp tiếng Việt viết cho người dùng ("Phiên đăng nhập cổng thuế
 * đã hết hạn...") — những lỗi đó phải hiện nguyên. Nhưng cùng khối catch còn hứng cả lỗi NỘI BỘ mà trả
 * thẳng ra là lộ thông tin: lỗi Prisma (đường dẫn file nguồn, đoạn code, tên bảng/cột), lỗi lập trình
 * (TypeError...), lỗi hệ thống (ECONNREFUSED kèm IP:cổng nội bộ). Các loại đó -> `macDinh`; chi tiết
 * đầy đủ vẫn nằm ở `request.log`.
 */
export function thongDiepLoiAnToan(err: unknown, macDinh: string): string {
  if (!(err instanceof Error)) return macDinh;
  if (err.name.startsWith('PrismaClient')) return macDinh;
  if (
    err instanceof TypeError ||
    err instanceof ReferenceError ||
    err instanceof SyntaxError ||
    err instanceof RangeError
  ) {
    return macDinh;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && /^E[A-Z0-9_]+$/.test(code)) return macDinh;
  return err.message || macDinh;
}
