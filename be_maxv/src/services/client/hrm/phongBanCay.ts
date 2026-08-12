/**
 * Logic cây phòng ban, tách khỏi Prisma để test được không cần DB.
 * "Cấp" KHÔNG lưu trong bảng — tính lại mỗi lần đọc, vì lưu cứng sẽ sai ngay lần đầu
 * ai đó đổi trực thuộc của một nhánh (phải cập nhật xuống toàn bộ con cháu).
 */

/** Phần tối thiểu của 1 dòng dmpb mà thuật toán cần. */
export interface PhongBanNode {
  ma_pb: string;
  ma_pb_me: string | null;
}

/** Dòng đã gắn cấp (gốc = 1). */
export type WithCap<T> = T & { cap: number };

/**
 * Sắp danh sách phẳng theo thứ tự duyệt cây (cha đứng ngay trước con) và gắn `cap`.
 *
 * Hai nhánh phòng thủ cho dữ liệu hỏng — bỏ đi là phòng ban biến mất khỏi giao diện mà
 * không có lỗi nào báo lên:
 *  - `ma_pb_me` trỏ tới mã không còn tồn tại  -> coi như gốc;
 *  - node nằm trong chu trình (không tới được từ gốc) -> vẫn trả về, đặt ở cấp 1.
 */
export function sapXepTheoCay<T extends PhongBanNode>(rows: T[]): WithCap<T>[] {
  const tonTai = new Set(rows.map((r) => r.ma_pb));

  const conCua = new Map<string | null, T[]>();
  for (const r of rows) {
    const cha = r.ma_pb_me && tonTai.has(r.ma_pb_me) ? r.ma_pb_me : null;
    const ds = conCua.get(cha);
    if (ds) ds.push(r);
    else conCua.set(cha, [r]);
  }
  for (const ds of conCua.values()) {
    ds.sort((a, b) => a.ma_pb.localeCompare(b.ma_pb));
  }

  const ketQua: WithCap<T>[] = [];
  const daDuyet = new Set<string>();

  const duyet = (cha: string | null, cap: number): void => {
    for (const r of conCua.get(cha) ?? []) {
      if (daDuyet.has(r.ma_pb)) continue; // chặn chu trình
      daDuyet.add(r.ma_pb);
      ketQua.push({ ...r, cap });
      duyet(r.ma_pb, cap + 1);
    }
  };
  duyet(null, 1);

  for (const r of rows) {
    if (!daDuyet.has(r.ma_pb)) {
      daDuyet.add(r.ma_pb);
      ketQua.push({ ...r, cap: 1 });
    }
  }
  return ketQua;
}

/**
 * Tập mã gồm `maPb` và toàn bộ con cháu của nó. Dùng để (a) chặn đặt cha là chính nó hoặc
 * con cháu nó, (b) loại khỏi danh sách chọn "Trực thuộc" trên giao diện.
 *
 * Lặp tới điểm bất động thay vì đệ quy: dừng được cả khi dữ liệu đã có sẵn chu trình.
 */
export function taoTapConChau(
  rows: PhongBanNode[],
  maPb: string,
): Set<string> {
  const ketQua = new Set<string>([maPb]);
  let themMoi = true;
  while (themMoi) {
    themMoi = false;
    for (const r of rows) {
      if (r.ma_pb_me && ketQua.has(r.ma_pb_me) && !ketQua.has(r.ma_pb)) {
        ketQua.add(r.ma_pb);
        themMoi = true;
      }
    }
  }
  return ketQua;
}
