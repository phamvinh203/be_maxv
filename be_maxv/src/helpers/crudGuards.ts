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

/**
 * Chạy lệnh xóa; bị KHÓA NGOẠI chặn (bản ghi vẫn còn được chứng từ tham chiếu — Prisma P2003) thì ném
 * `err` thay cho lỗi Prisma. Kiểm "đếm tham chiếu" trước đó chỉ để có câu báo lỗi rõ; khóa ngoại ở DB
 * (hrmTenantConstraints.ts) mới là thứ chặn được lượt ghi chen vào giữa lượt đếm và lượt xóa.
 */
export async function xoaNeuKhongConThamChieu<T>(
  xoa: () => Promise<T>,
  err: Error,
): Promise<T> {
  try {
    return await xoa();
  } catch (e) {
    if ((e as { code?: unknown })?.code === 'P2003') throw err;
    throw e;
  }
}
