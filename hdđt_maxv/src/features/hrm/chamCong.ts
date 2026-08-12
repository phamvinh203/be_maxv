/**
 * Logic lịch chấm công của một tháng.
 *
 * Nối ba nguồn đã có lại với nhau: chính sách thứ 7 / chủ nhật và phương pháp
 * tính ngày công chuẩn ở tab "Thiết lập chung", cộng lịch ngày lễ ở tab "Lịch
 * ngày lễ". Đổi chính sách bên đó là bảng chấm công đổi theo ngay.
 */

import { moTaLoaiCong } from "./constants";
import type { CauHinhMacDinh, LoaiCong, NgayLe, OChamCong } from "./types";

export interface NgayCham {
  /** `YYYY-MM-DD`. */
  ngay: string;
  /** 1…31. */
  soNgay: number;
  /** 0 = chủ nhật … 6 = thứ 7. */
  thu: number;
  /** Tên ngày lễ rơi vào ngày này, rỗng nếu không có. */
  tenNgayLe: string;
  /** Ngày phải đi làm theo lịch — quyết định trạng thái mặc định của ô tích. */
  laNgayLamViec: boolean;
  /** Công quy đổi khi ô được tích: 1, hoặc 0,5 với ngày làm nửa buổi. */
  trongSo: number;
}

const NHAN_THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function nhanThu(thu: number): string {
  return NHAN_THU[thu] ?? "";
}

export function thangHienTai(): { nam: number; thang: number } {
  const now = new Date();
  return { nam: now.getFullYear(), thang: now.getMonth() + 1 };
}

/** `2026-08` — nhãn tháng để hiển thị và làm khóa chấm công. */
export function maThang(nam: number, thang: number): string {
  return `${nam}-${String(thang).padStart(2, "0")}`;
}

/**
 * Ngày lễ áp cho một mốc cụ thể.
 *
 * Ngày lặp hằng năm chỉ so ngày–tháng nên áp cho mọi năm; ngày không lặp phải
 * khớp trọn cả năm.
 */
function timNgayLe(iso: string, danhSach: NgayLe[]): NgayLe | undefined {
  return danhSach.find((nl) =>
    nl.lap_lai_hang_nam ? nl.ngay.slice(5) === iso.slice(5) : nl.ngay === iso,
  );
}

/** Toàn bộ ngày của một tháng, kèm thông tin để dựng bảng chấm công. */
export function cacNgayTrongThang(
  nam: number,
  thang: number,
  cauHinh: CauHinhMacDinh,
  ngayLe: NgayLe[],
): NgayCham[] {
  // Ngày 0 của tháng kế tiếp = ngày cuối của tháng này.
  const soNgayTrongThang = new Date(Date.UTC(nam, thang, 0)).getUTCDate();
  const ketQua: NgayCham[] = [];

  for (let soNgay = 1; soNgay <= soNgayTrongThang; soNgay += 1) {
    const moc = new Date(Date.UTC(nam, thang - 1, soNgay));
    const ngay = moc.toISOString().slice(0, 10);
    const thu = moc.getUTCDay();

    const chinhSach =
      thu === 6 ? cauHinh.chinh_sach_thu_7 : thu === 0 ? cauHinh.chinh_sach_chu_nhat : null;
    const nghiTheoTuan = chinhSach === "nghi";
    const nuaNgay = chinhSach === "lam_nua_ngay";

    const le = timNgayLe(ngay, ngayLe);

    ketQua.push({
      ngay,
      soNgay,
      thu,
      tenNgayLe: le?.ten ?? "",
      laNgayLamViec: !nghiTheoTuan && !le,
      // Đi làm vào ngày vốn được nghỉ thì tính trọn một công; chỉ ngày làm nửa
      // buổi theo chính sách mới quy đổi 0,5.
      trongSo: nuaNgay && !le ? 0.5 : 1,
    });
  }

  return ketQua;
}

/** Ngày công chuẩn của tháng theo phương pháp đã cấu hình. */
export function ngayCongChuan(cauHinh: CauHinhMacDinh, ngayTrongThang: NgayCham[]): number {
  if (cauHinh.phuong_phap_ngay_cong === "co_dinh_24") return 24;
  if (cauHinh.phuong_phap_ngay_cong === "co_dinh_26") return 26;
  const tong = ngayTrongThang
    .filter((nc) => nc.laNgayLamViec)
    .reduce((cong, nc) => cong + nc.trongSo, 0);
  return Math.round(tong * 100) / 100;
}

/** Khóa của một ô chấm công. */
export function khoaCham(maNv: string, ngay: string): string {
  return `${maNv}|${ngay}`;
}

/** Nội dung mặc định của một ô khi người dùng chưa đụng tới, suy từ lịch. */
export function oMacDinh(ngayCham: NgayCham): OChamCong | null {
  if (ngayCham.tenNgayLe) return { loai: "nghi_le", soGio: 0 };
  if (!ngayCham.laNgayLamViec) return null;
  return { loai: ngayCham.trongSo === 0.5 ? "nua_ngay" : "lam_viec", soGio: 0 };
}

/**
 * Nội dung ô chấm công.
 *
 * Kho chỉ lưu những ô người dùng **đã đụng vào**; ô chưa đụng đọc theo lịch
 * chuẩn. Nhờ vậy không phải sinh sẵn hàng nghìn bản ghi cho mỗi tháng, và đổi
 * chính sách thứ 7 bên Thiết lập chung là cả bảng cập nhật theo. Giá trị `null`
 * có mặt trong kho nghĩa là người dùng **cố ý xóa trắng** ô đó, khác với ô chưa
 * đụng tới.
 */
export function oCham(
  ghiDe: Record<string, OChamCong | null>,
  maNv: string,
  ngayCham: NgayCham,
): OChamCong | null {
  const khoa = khoaCham(maNv, ngayCham.ngay);
  return khoa in ghiDe ? ghiDe[khoa]! : oMacDinh(ngayCham);
}

/**
 * Công quy đổi của một ô.
 *
 * Nhập số giờ cụ thể thì quy đổi theo giờ công chuẩn — làm 4/8 giờ là nửa công,
 * không phụ thuộc loại được chọn là "Làm việc" hay "Nửa ngày".
 */
export function congCuaO(o: OChamCong | null, gioCongChuanNgay: number): number {
  if (!o) return 0;
  const moTa = moTaLoaiCong(o.loai);
  if (!moTa.tinhCong) return 0;
  if (o.soGio > 0 && gioCongChuanNgay > 0) {
    return Math.round((o.soGio / gioCongChuanNgay) * 100) / 100;
  }
  return moTa.congMacDinh;
}

/** Số liệu tổng hợp một dòng chấm công. */
export interface ThongKeDong {
  ngayCongThucTe: number;
  /** Số ngày theo từng loại không tính công, khóa là `LoaiCong`. */
  soNgayTheoLoai: Record<LoaiCong, number>;
}

export function thongKeDong(
  ghiDe: Record<string, OChamCong | null>,
  maNv: string,
  ngayTrongThang: NgayCham[],
  gioCongChuanNgay: number,
): ThongKeDong {
  const soNgayTheoLoai = {
    lam_viec: 0,
    nua_ngay: 0,
    cong_tac: 0,
    nghi_phep: 0,
    nghi_le: 0,
    om: 0,
    khong_luong: 0,
    khac: 0,
  } as Record<LoaiCong, number>;

  let cong = 0;
  for (const nc of ngayTrongThang) {
    const o = oCham(ghiDe, maNv, nc);
    if (!o) continue;
    soNgayTheoLoai[o.loai] += 1;
    cong += congCuaO(o, gioCongChuanNgay);
  }

  return { ngayCongThucTe: Math.round(cong * 100) / 100, soNgayTheoLoai };
}
