/**
 * 2 pattern lặp lại ở hầu hết service danh mục: kiểm tra trùng khóa trước khi tạo/đổi mã
 * (assertNotExists), và kiểm tra tồn tại trước khi sửa/xóa (findOrThrow). Nhận `finder`
 * dạng callback thay vì Promise trực tiếp để không tốn 1 query nếu code gọi có early-return
 * khác trước đó — nhưng chủ yếu là để giữ chữ ký đơn giản, dùng được cho mọi Prisma model.
 */

/** Throw `err` nếu `finder()` tìm thấy bản ghi (dùng trước khi tạo mới / đổi mã). */
export async function assertNotExists(
  finder: () => Promise<unknown>,
  err: Error,
): Promise<void> {
  const existing = await finder();
  if (existing) throw err;
}

/** Trả về bản ghi nếu có, throw `err` nếu không (dùng trước khi sửa/xóa). */
export async function findOrThrow<T>(
  finder: () => Promise<T | null>,
  err: Error,
): Promise<T> {
  const row = await finder();
  if (!row) throw err;
  return row;
}
