/**
 * Lớp mỏng cho File System Access API (Chrome/Edge) — chọn thư mục + ghi file vào thư mục người dùng
 * chọn. Tách khỏi feature để tái dùng + không rải cast `window as ...` khắp nơi. Khai báo type tối
 * thiểu (lib.dom chưa chắc có `showDirectoryPicker` theo phiên bản TS).
 */

interface FsWritable {
  write(data: Blob | string | BufferSource): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  createWritable(): Promise<FsWritable>;
  getFile(): Promise<File>;
}
export interface FsDirHandle {
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle>;
}
type ShowDirPicker = (opts?: { mode?: "read" | "readwrite" }) => Promise<FsDirHandle>;

/** Trình duyệt có hỗ trợ chọn thư mục để ghi file không (Chrome/Edge). */
export function supportsDirectoryPicker(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

/**
 * Mở hộp chọn thư mục (yêu cầu quyền ghi). Trả handle, hoặc `null` nếu người dùng hủy. Ném lỗi nếu
 * trình duyệt không hỗ trợ (nên gọi `supportsDirectoryPicker` trước). Phải chạy trong 1 user-gesture.
 */
export async function pickDirectory(): Promise<FsDirHandle | null> {
  const picker = (window as unknown as { showDirectoryPicker?: ShowDirPicker }).showDirectoryPicker;
  if (!picker) throw new Error("Trình duyệt không hỗ trợ chọn thư mục (dùng Chrome/Edge).");
  try {
    return await picker({ mode: "readwrite" });
  } catch (e) {
    // Người dùng bấm Hủy hộp chọn -> AbortError, coi như không chọn (không phải lỗi).
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/** Ghi 1 file (đè nếu đã có) vào thư mục `dir`. */
export async function writeFile(
  dir: FsDirHandle,
  name: string,
  data: Blob | string | BufferSource,
): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

/**
 * Đọc nội dung văn bản của 1 file trong `dir`, hoặc `null` nếu file chưa tồn tại.
 *
 * Dùng để BỎ QUA việc tải lại: lượt xuất kiểm tra file đã có trong thư mục đích chưa, có rồi thì
 * đọc từ đĩa (tức thì) thay vì gọi lại cổng thuế (~3 giây mỗi hóa đơn).
 *
 * `getFileHandle` KHÔNG kèm `create` -> ném `NotFoundError` khi chưa có; ở đây nuốt mọi lỗi thành
 * `null` vì mọi tình huống không đọc được đều dẫn tới cùng một hành động: cứ tải lại cho chắc.
 */
export async function readFileText(dir: FsDirHandle, name: string): Promise<string | null> {
  try {
    const fh = await dir.getFileHandle(name);
    return await (await fh.getFile()).text();
  } catch {
    return null;
  }
}
