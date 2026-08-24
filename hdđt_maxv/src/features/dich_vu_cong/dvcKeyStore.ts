/**
 * Khóa phiên cổng Dịch vụ công theo từng MST — lưu `localStorage` để sống qua F5 và qua cả lần mở
 * lại trình duyệt.
 *
 * VÌ SAO PHẢI PERSIST (trước đây khóa chỉ nằm trong `useState` của `DvcPage`): F5 là mất khóa, phải
 * mở dialog đăng nhập cổng lại từ đầu — kể cả khi BE thừa sức tự đăng nhập lại ngầm bằng tài khoản
 * đã lưu (`voiPhienTuPhucHoi` trong `gdt-dvc.controller.ts`). BE chỉ làm được việc đó khi còn biết
 * `key` để gắn phiên mới vào, nên giữ được khóa là đủ để cơ chế kia phát huy tác dụng.
 *
 * VÌ SAO `localStorage` chứ không `sessionStorage` như token GDT (`GdtSessionProvider`): token GDT
 * sống ~5 phút, giữ qua tab mới cũng vô nghĩa. Khóa DVC ngược lại, nay CHẾT KHÔNG SAO — BE tự dựng
 * phiên mới cho đúng khóa đó. Sống qua lần mở lại trình duyệt nghĩa là sáng mở máy bấm "Đồng bộ" là
 * chạy luôn, không phải đăng nhập cổng lại.
 *
 * KHÓA NÀY KHÔNG TỰ CẤP QUYỀN GÌ: mọi API DVC đều đòi JWT app (cookie httpOnly) + module `dvc`, và
 * BE đọc tài khoản cổng theo công ty ĐANG CHỌN của người đang đăng nhập chứ không suy từ khóa. Khóa
 * nhặt được mà không có phiên app thì vô dụng. Vẫn xóa khi đăng xuất (`clearDvcKeys`, gọi cùng chỗ
 * với `clearGdtSession`) để máy dùng chung không để lại khóa của người trước.
 */
const DVC_KEYS_STORAGE = "hddt_dvc_keys";

/**
 * Đọc map `{ mst: key }` đã lưu; không có/hỏng -> `{}`.
 *
 * Lọc lại từng ô thay vì tin thẳng `JSON.parse`: bản lưu cũ hoặc dữ liệu bị sửa tay có thể cho ra ô
 * không phải chuỗi, lọt xuống dưới sẽ thành `key: undefined` gửi lên BE rồi hỏng bằng một lỗi khó
 * hiểu hơn nhiều so với "chưa đăng nhập cổng".
 */
export function loadDvcKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DVC_KEYS_STORAGE);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (o): o is [string, string] => typeof o[1] === "string" && o[1] !== "",
      ),
    );
  } catch {
    return {};
  }
}

/** Ghi đè map khóa đã lưu. Nuốt lỗi: hết quota / trình duyệt chặn storage thì trang vẫn phải chạy
 * bình thường với khóa trong RAM, không đáng làm sập cả màn hình. */
export function saveDvcKeys(keys: Record<string, string>): void {
  try {
    localStorage.setItem(DVC_KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    /* xem chú thích trên */
  }
}

/**
 * Mã BE gắn vào lỗi khi khóa phiên ĐÃ CHẾT HẲN — tự đăng nhập lại ngầm cũng không cứu được (xem
 * `MA_LOI_TU_DANG_NHAP_HONG` bên `gdt-dvc.controller.ts`).
 *
 * So bằng MÃ chứ không dò câu chữ thông báo: đổi lời thông báo là bên FE lặng lẽ hết nhận ra, mà
 * hậu quả thì âm thầm — khóa chết nằm lại `localStorage` khiến mọi thao tác sau đó đều kích một
 * lượt tự đăng nhập lại vô ích lên cổng.
 */
export const MA_LOI_DVC_PHIEN_CHET = "DVC_AUTO_LOGIN_FAILED";

/** Xóa toàn bộ khóa phiên DVC — dùng khi đăng xuất app (AppHeader), cạnh `clearGdtSession`. */
export function clearDvcKeys(): void {
  try {
    localStorage.removeItem(DVC_KEYS_STORAGE);
  } catch {
    /* xem chú thích ở `saveDvcKeys` */
  }
}
