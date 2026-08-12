/**
 * Logic cây phòng ban, sinh mã và chọn hợp đồng hiện hành.
 *
 * Tách khỏi component vì đây là phần duy nhất có luật nghiệp vụ thật; khi nối
 * backend, ba hàm này chuyển thẳng sang `be_maxv/src/services/client/hrm/` mà
 * không phải viết lại.
 */

import type { HopDong, NhanVien, PhongBan } from "./types";

export interface PhongBanCay extends PhongBan {
  /** Gốc là 1. */
  cap: number;
}

/**
 * Sắp danh sách phẳng theo thứ tự duyệt cây — cha đứng ngay trước các con — và
 * gắn `cap` cho từng dòng.
 *
 * Hai trường hợp hỏng dữ liệu đều phải hiện ra bảng chứ không được biến mất:
 * phòng ban mồ côi (cha đã bị xóa) coi như gốc, và phòng ban nằm trong chu
 * trình (A trực thuộc B, B trực thuộc A) xếp xuống cuối ở cấp 1.
 */
export function sapXepCay(danhSach: PhongBan[]): PhongBanCay[] {
  const tonTai = new Set(danhSach.map((pb) => pb.ma_pb));
  const conTheoCha = new Map<string, PhongBan[]>();

  for (const pb of danhSach) {
    const cha = pb.ma_pb_me && tonTai.has(pb.ma_pb_me) ? pb.ma_pb_me : "";
    const nhom = conTheoCha.get(cha);
    if (nhom) nhom.push(pb);
    else conTheoCha.set(cha, [pb]);
  }

  const ketQua: PhongBanCay[] = [];
  const daDuyet = new Set<string>();

  const duyet = (cha: string, cap: number) => {
    const con = [...(conTheoCha.get(cha) ?? [])].sort((a, b) =>
      a.ma_pb.localeCompare(b.ma_pb),
    );
    for (const pb of con) {
      if (daDuyet.has(pb.ma_pb)) continue;
      daDuyet.add(pb.ma_pb);
      ketQua.push({ ...pb, cap });
      duyet(pb.ma_pb, cap + 1);
    }
  };

  duyet("", 1);

  for (const pb of danhSach) {
    if (!daDuyet.has(pb.ma_pb)) ketQua.push({ ...pb, cap: 1 });
  }
  return ketQua;
}

/**
 * Tập mã của toàn bộ con cháu một phòng ban.
 *
 * Dùng để loại chính nó và cả nhánh dưới khỏi ô "Trực thuộc" — cho chọn con
 * cháu làm cha sẽ tạo ra một nhánh treo lơ lửng, không còn nối về gốc.
 * Lặp tới khi không thêm được gì nữa nên chu trình sẵn có cũng không treo.
 */
export function layConChau(danhSach: PhongBan[], maPb: string): Set<string> {
  const ketQua = new Set<string>();
  let themDuoc = true;
  while (themDuoc) {
    themDuoc = false;
    for (const pb of danhSach) {
      if (ketQua.has(pb.ma_pb) || !pb.ma_pb_me) continue;
      if (pb.ma_pb_me === maPb || ketQua.has(pb.ma_pb_me)) {
        ketQua.add(pb.ma_pb);
        themDuoc = true;
      }
    }
  }
  return ketQua;
}

/**
 * Mã phòng ban: gốc là `PB01`, `PB02`…; con của `PB01` là `PB01.01`.
 *
 * Mã chỉ phản ánh vị trí **lúc tạo** — đổi "Trực thuộc" không đổi mã, vì mã đã
 * nằm trên chứng từ kế toán bên `fe_maxv`. `cap` mới là sự thật hiện tại.
 */
export function sinhMaPhongBan(danhSach: PhongBan[], maPbMe: string | null): string {
  const tienTo = maPbMe ? `${maPbMe}.` : "PB";
  const daDung = new Set(danhSach.map((pb) => pb.ma_pb));
  for (let i = 1; i <= 99; i += 1) {
    const ma = `${tienTo}${String(i).padStart(2, "0")}`;
    if (!daDung.has(ma)) return ma;
  }
  return `${tienTo}${Date.now().toString().slice(-4)}`;
}

/** Gợi ý mã nhân viên kế tiếp: `NV0001`, `NV0002`… Người dùng sửa lại được. */
export function sinhMaNhanVien(danhSach: NhanVien[]): string {
  const daDung = new Set(danhSach.map((nv) => nv.ma_nv));
  for (let i = 1; i <= 9999; i += 1) {
    const ma = `NV${String(i).padStart(4, "0")}`;
    if (!daDung.has(ma)) return ma;
  }
  return `NV${Date.now().toString().slice(-4)}`;
}

/**
 * Hợp đồng hiện hành của một nhân viên.
 *
 * Đang hiệu lực = đã bắt đầu và chưa hết hạn (không có ngày kết thúc thì coi
 * như còn hiệu lực); nhiều dòng khớp thì lấy dòng bắt đầu muộn nhất. Không
 * dòng nào khớp thì trả về hợp đồng mới nhất trong lịch sử — nhân viên vừa hết
 * hạn hợp đồng cũ mà chưa ký hợp đồng mới vẫn phải thấy thông tin gần nhất.
 */
export function hopDongHienHanh(danhSach: HopDong[], mocHomNay: string): HopDong | null {
  if (danhSach.length === 0) return null;
  const theoNgayGiam = [...danhSach].sort((a, b) =>
    b.ngay_bat_dau.localeCompare(a.ngay_bat_dau),
  );
  const dangHieuLuc = theoNgayGiam.find(
    (hd) =>
      hd.ngay_bat_dau <= mocHomNay &&
      (!hd.ngay_ket_thuc || hd.ngay_ket_thuc >= mocHomNay),
  );
  return dangHieuLuc ?? theoNgayGiam[0] ?? null;
}

/** Nhãn trạng thái một dòng hợp đồng trong bảng lịch sử. */
export function trangThaiHopDong(
  hd: HopDong,
  mocHomNay: string,
): "Sắp tới" | "Hiệu lực" | "Hết hạn" {
  if (hd.ngay_bat_dau > mocHomNay) return "Sắp tới";
  if (hd.ngay_ket_thuc && hd.ngay_ket_thuc < mocHomNay) return "Hết hạn";
  return "Hiệu lực";
}
