/**
 * Kéo **hết** mọi trang của một endpoint phân trang HRM.
 *
 * Vì sao cần: máy chủ chặn `pageSize` ở **100** (`holidays.validator.ts:114`,
 * `workShifts.validator.ts:73` — cùng con số trong `api-contract.md` Mục 7E.2 / 7F.2). Xin
 * nhiều hơn **không** được trả về ít hơn: Zod trả 400 và cả màn hình chết (`B1`). Mà xin đúng
 * 100 rồi thôi thì danh sách bị cắt cụt **im lặng** — nguy hiểm hơn, vì bảng vẫn hiện bình
 * thường và mọi phép tra `id` theo mã ở các hook lưu/xóa sẽ báo "không còn tồn tại" cho bản ghi
 * có thật.
 *
 * Nên chỗ này đi đường thứ ba: hỏi trang đầu để biết `totalPages`, rồi kéo nốt các trang còn
 * lại. Số trang của hai danh mục này luôn là 1 (vài chục dòng), vòng lặp chỉ là mạng lưới an
 * toàn cho công ty có dữ liệu lớn bất thường.
 *
 * KHÔNG dùng cho danh sách lớn (nhân viên, chấm công): kéo hết về trình duyệt rồi lọc là mô
 * hình chỉ hợp lệ với **danh mục cấu hình**. Danh sách nghiệp vụ phải lọc và phân trang ở máy chủ.
 */

/** Trần `pageSize` máy chủ nhận. Đổi số này là đổi hợp đồng — phải báo Architect trước. */
export const PAGE_SIZE_TOI_DA = 100;

/**
 * Chốt an toàn: tối đa 20 lượt gọi (2.000 dòng) cho một lần nạp.
 *
 * Có nó để một `totalPages` sai của máy chủ không biến thành vòng lặp gọi API vô tận. Chạm trần
 * thì `daDayDu = false` — bên gọi phải nói ra, không được nuốt.
 */
const SO_TRANG_TOI_DA = 20;

/** Phần khung phân trang chung của mọi phản hồi danh sách HRM. */
export interface TrangApi<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export interface KetQuaTaiHet<T> {
  /** Đã gộp mọi trang, loại trùng theo khóa. */
  items: T[];
  /** Tổng số dòng **máy chủ báo có** — so với `items.length` để biết có mất dòng không. */
  total: number;
  /** `false` khi chạm `SO_TRANG_TOI_DA`: danh sách đang thiếu, giao diện phải báo cho người dùng. */
  daDayDu: boolean;
}

/**
 * @param nhan      Tên danh mục, chỉ dùng cho dòng cảnh báo trong console.
 * @param taiTrang  Hàm gọi API cho một số trang (bên gọi tự gắn `pageSize`, sắp xếp, bộ lọc).
 * @param khoaDong  Khóa định danh một dòng — dùng để loại trùng khi các trang trượt nhau.
 */
export async function taiHetTrang<T>(
  nhan: string,
  taiTrang: (trang: number) => Promise<TrangApi<T>>,
  khoaDong: (dong: T) => string,
): Promise<KetQuaTaiHet<T>> {
  const dau = await taiTrang(1);
  const tongTrang = Math.max(1, dau.totalPages || 1);
  const soTrangTai = Math.min(tongTrang, SO_TRANG_TOI_DA);

  // Các trang sau gọi song song: đã biết `totalPages` từ trang đầu nên không phải dò tuần tự.
  const trangSau = await Promise.all(
    Array.from({ length: soTrangTai - 1 }, (_, i) => taiTrang(i + 2)),
  );

  /*
   * Gộp theo khóa, KHÔNG nối mảng thẳng: hai lượt gọi cách nhau vài chục mili giây, người khác
   * thêm hoặc xóa xen giữa sẽ làm các trang trượt và một dòng lọt vào hai trang. Nối thẳng thì
   * bảng hiện dòng đôi và React cảnh báo trùng `key`.
   */
  const theoKhoa = new Map<string, T>();
  for (const trang of [dau, ...trangSau]) {
    for (const dong of trang.items) theoKhoa.set(khoaDong(dong), dong);
  }

  const daDayDu = tongTrang <= SO_TRANG_TOI_DA;
  if (!daDayDu) {
    console.warn(
      `[HRM] ${nhan}: máy chủ báo ${dau.total} dòng / ${tongTrang} trang, chỉ tải ${soTrangTai} trang đầu.`,
    );
  }

  return { items: [...theoKhoa.values()], total: dau.total, daDayDu };
}
