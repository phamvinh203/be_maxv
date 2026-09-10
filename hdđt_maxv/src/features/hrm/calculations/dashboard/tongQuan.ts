/**
 * Số liệu tổng hợp cho tab Dashboard — hàm THUẦN, không phụ thuộc React, không gọi API.
 *
 * Mọi con số lương ở đây chỉ là CỘNG DỒN từ các dòng BE đã tính sẵn (`/payroll/sheet-lines`),
 * không tính lại lương/thuế/bảo hiểm — công thức sống ở `be_maxv` (ADR-010), xem cảnh báo đầu
 * `calculations/bang_luong/bangLuong.ts`. "Quỹ lương" = `totalCompanyCost`, "Thực lĩnh" =
 * `netTakeHomeSalary` — cùng hai cột đó ở màn Bảng lương, để hai nơi luôn ra một con số.
 *
 * Hợp đồng hiện hành lấy từ phần BE tính sẵn trên hồ sơ nhân viên (`loai_hop_dong`,
 * `ngay_hieu_luc_toi`) — KHÔNG gọi `/hrm/hop-dong` theo từng người.
 */

import type { NhanVienApiRow } from "../../api/du_lieu_nhan_vien/nhanVienApi";
import type { PayrollCalculationLineApi } from "../../api/du_lieu_tinh_luong/payrollCalculationApi";
import type { OvertimeSummaryApi } from "../../api/du_lieu_tinh_luong/payrollInputsApi";
import type { PayrollPeriodApiItem } from "../../api/du_lieu_tinh_luong/payrollPeriodsApi";

// ─────────────────────────────── Ngày tháng ───────────────────────────────

export interface ThangNam {
  nam: number;
  /** 1–12 */
  thang: number;
}

/** ISO đầy đủ của BE (`2026-03-01T00:00:00.000Z`) hoặc `YYYY-MM-DD` → `YYYY-MM-DD`. */
function ngayIso(s: string | null | undefined): string | null {
  if (!s) return null;
  const ngay = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ngay) ? ngay : null;
}

function tachNgay(iso: string): { nam: number; thang: number; ngay: number } {
  const [nam, thang, ngay] = iso.split("-").map(Number);
  return { nam: nam ?? 0, thang: thang ?? 0, ngay: ngay ?? 0 };
}

/** Số ngày từ `tu` tới `den` (`YYYY-MM-DD`). Tính trên mốc UTC để không lệch do múi giờ. */
function soNgayGiua(tu: string, den: string): number {
  const a = Date.parse(`${tu}T00:00:00Z`);
  const b = Date.parse(`${den}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function thangCua(iso: string): ThangNam {
  const { nam, thang } = tachNgay(iso);
  return { nam, thang };
}

/** Lùi `soThang` tháng (âm là tiến). */
export function luiThang({ nam, thang }: ThangNam, soThang = 1): ThangNam {
  const tong = nam * 12 + (thang - 1) - soThang;
  return { nam: Math.floor(tong / 12), thang: (tong % 12) + 1 };
}

function soThuTuThang({ nam, thang }: ThangNam): number {
  return nam * 12 + thang;
}

export function thangCuaKy(ky: PayrollPeriodApiItem): ThangNam {
  return { nam: ky.year, thang: ky.month };
}

export function nhanThang({ nam, thang }: ThangNam): string {
  return `T${thang}/${nam}`;
}

// ─────────────────────────────── Nhân sự ───────────────────────────────

/** Ba nhóm hợp đồng BE gom sẵn (BR-hrm-022) + "chưa có hợp đồng". */
export type NhomHopDong = "hdld" | "thu_viec" | "hdvc" | "chua_co";

export const NHAN_NHOM_HOP_DONG: Record<NhomHopDong, string> = {
  hdld: "Hợp đồng lao động",
  thu_viec: "Thử việc",
  hdvc: "Khoán / vụ việc",
  chua_co: "Chưa có hợp đồng",
};

export type NhomGioiTinh = "nam" | "nu" | "khac";

export interface DemPhongBan {
  ten: string;
  so: number;
}

export interface DiemTheoThang extends ThangNam {
  so: number;
}

export interface TinhHinhNhanSu {
  dangLam: number;
  daNghi: number;
  /** Tính trên MỌI hồ sơ (kể cả đã nghỉ) — đó mới là số người đã tuyển trong tháng. */
  vaoLamThangNay: number;
  soNguoiPhuThuoc: number;
  chuaGanPhongBan: number;
  coCauHopDong: Record<NhomHopDong, number>;
  gioiTinh: Record<NhomGioiTinh, number>;
  /** Người đang làm theo phòng ban, nhiều → ít. Người chưa gán gom vào một dòng riêng. */
  theoPhongBan: DemPhongBan[];
  /** Số người vào làm của 6 tháng, cũ → mới, kết thúc ở tháng hiện tại. */
  vaoLam6Thang: DiemTheoThang[];
}

export const TEN_CHUA_GAN_PHONG_BAN = "Chưa gán phòng ban";

export function tinhTinhHinhNhanSu(rows: NhanVienApiRow[], homNay: string): TinhHinhNhanSu {
  const thangNay = thangCua(homNay);
  const khung = Array.from({ length: 6 }, (_, i) => luiThang(thangNay, 5 - i));
  const vaoLamTheoThang = new Map(khung.map((t) => [soThuTuThang(t), 0]));

  const coCauHopDong: Record<NhomHopDong, number> = { hdld: 0, thu_viec: 0, hdvc: 0, chua_co: 0 };
  const gioiTinh: Record<NhomGioiTinh, number> = { nam: 0, nu: 0, khac: 0 };
  const theoPb = new Map<string, number>();
  let dangLam = 0;
  let soNguoiPhuThuoc = 0;
  let chuaGanPhongBan = 0;

  for (const r of rows) {
    const ngayVao = ngayIso(r.ngay_vao_lam);
    if (ngayVao) {
      const khoa = soThuTuThang(thangCua(ngayVao));
      const dem = vaoLamTheoThang.get(khoa);
      if (dem !== undefined) vaoLamTheoThang.set(khoa, dem + 1);
    }

    if (r.status !== "1") continue;
    dangLam += 1;
    soNguoiPhuThuoc += r.so_npt ?? 0;
    coCauHopDong[r.loai_hop_dong ?? "chua_co"] += 1;
    // Hồ sơ chưa khai giới tính (null) tính vào "Khác" — không bịa nam/nữ.
    gioiTinh[r.gioi_tinh ?? "khac"] += 1;

    if (!r.ma_pb) chuaGanPhongBan += 1;
    const tenPb = r.ma_pb ? (r.ten_pb ?? r.ma_pb) : TEN_CHUA_GAN_PHONG_BAN;
    theoPb.set(tenPb, (theoPb.get(tenPb) ?? 0) + 1);
  }

  const theoPhongBan = [...theoPb.entries()]
    .map(([ten, so]) => ({ ten, so }))
    .sort((a, b) => b.so - a.so || a.ten.localeCompare(b.ten, "vi"));

  const vaoLam6Thang = khung.map((t) => ({ ...t, so: vaoLamTheoThang.get(soThuTuThang(t)) ?? 0 }));

  return {
    dangLam,
    daNghi: rows.length - dangLam,
    vaoLamThangNay: vaoLam6Thang[vaoLam6Thang.length - 1]?.so ?? 0,
    soNguoiPhuThuoc,
    chuaGanPhongBan,
    coCauHopDong,
    gioiTinh,
    theoPhongBan,
    vaoLam6Thang,
  };
}

export interface DongSinhNhat {
  ma_nv: string;
  ho_ten: string;
  ten_pb: string;
  ngay: number;
  /** Tuổi tròn trong năm nay; `null` khi năm sinh không hợp lệ. */
  tuoi: number | null;
  laHomNay: boolean;
  daQua: boolean;
}

/** Người ĐANG LÀM có sinh nhật trong tháng của `homNay`, xếp theo ngày. */
export function sinhNhatTrongThang(rows: NhanVienApiRow[], homNay: string): DongSinhNhat[] {
  const nay = tachNgay(homNay);
  const ketQua: DongSinhNhat[] = [];

  for (const r of rows) {
    if (r.status !== "1") continue;
    const ngaySinh = ngayIso(r.ngay_sinh);
    if (!ngaySinh) continue;
    const { nam, thang, ngay } = tachNgay(ngaySinh);
    if (thang !== nay.thang) continue;

    const tuoi = nam > 1900 && nam <= nay.nam ? nay.nam - nam : null;
    ketQua.push({
      ma_nv: r.ma_nv,
      ho_ten: r.ho_ten,
      ten_pb: r.ma_pb ? (r.ten_pb ?? r.ma_pb) : "",
      ngay,
      tuoi,
      laHomNay: ngay === nay.ngay,
      daQua: ngay < nay.ngay,
    });
  }

  return ketQua.sort((a, b) => a.ngay - b.ngay || a.ho_ten.localeCompare(b.ho_ten, "vi"));
}

/** Hợp đồng hiện hành hết hạn trong ngần này ngày tới thì đưa vào danh sách "sắp kết thúc". */
export const NGUONG_SAP_HET_HAN_NGAY = 90;
/** Còn dưới ngần này ngày thì coi là gấp — thời hạn báo trước khi hết HĐ xác định thời hạn. */
export const NGUONG_GAP_NGAY = 30;

export interface DongHopDongSapHet {
  ma_nv: string;
  ho_ten: string;
  so_hd: string;
  nhom: Exclude<NhomHopDong, "chua_co">;
  ngay_ket_thuc: string;
  /** Âm nghĩa là đã quá hạn mà chưa có hợp đồng mới hiệu lực. */
  con_lai_ngay: number;
}

/**
 * Người ĐANG LÀM có hợp đồng hiện hành kết thúc trong `NGUONG_SAP_HET_HAN_NGAY` ngày tới hoặc đã
 * quá hạn.
 *
 * Hợp đồng không thời hạn (`ngay_hieu_luc_toi = null`) không bao giờ tới hạn — bỏ qua. Hợp đồng
 * đã quá hạn vẫn nằm ở đây vì BE trả "hợp đồng mới nhất trong lịch sử" khi không còn cái nào hiệu
 * lực (`chonHopDongHienHanh`), tức là chưa ký tiếp.
 */
export function hopDongSapKetThuc(rows: NhanVienApiRow[], homNay: string): DongHopDongSapHet[] {
  const ketQua: DongHopDongSapHet[] = [];

  for (const r of rows) {
    if (r.status !== "1" || !r.loai_hop_dong || !r.so_hop_dong) continue;
    const ketThuc = ngayIso(r.ngay_hieu_luc_toi);
    if (!ketThuc) continue;
    const conLai = soNgayGiua(homNay, ketThuc);
    if (conLai > NGUONG_SAP_HET_HAN_NGAY) continue;
    ketQua.push({
      ma_nv: r.ma_nv,
      ho_ten: r.ho_ten,
      so_hd: r.so_hop_dong,
      nhom: r.loai_hop_dong,
      ngay_ket_thuc: ketThuc,
      con_lai_ngay: conLai,
    });
  }

  return ketQua.sort((a, b) => a.con_lai_ngay - b.con_lai_ngay);
}

// ─────────────────────────────── Kỳ lương ───────────────────────────────

export function kyCuaThang(
  periods: PayrollPeriodApiItem[],
  { nam, thang }: ThangNam,
): PayrollPeriodApiItem | null {
  return periods.find((p) => p.year === nam && p.month === thang) ?? null;
}

function kyMoiNhat(periods: PayrollPeriodApiItem[]): PayrollPeriodApiItem | null {
  let moiNhat: PayrollPeriodApiItem | null = null;
  for (const p of periods) {
    if (!moiNhat || soThuTuThang(thangCuaKy(p)) > soThuTuThang(thangCuaKy(moiNhat))) moiNhat = p;
  }
  return moiNhat;
}

/**
 * Kỳ lương Dashboard lấy làm "kỳ hiện tại" cho chi phí phòng ban và tăng ca: kỳ của tháng này;
 * chưa tạo thì kỳ mới nhất đang có. Không dựa vào thứ tự BE trả về.
 */
export function chonKyTheoDoi(
  periods: PayrollPeriodApiItem[],
  homNay: string,
): PayrollPeriodApiItem | null {
  return kyCuaThang(periods, thangCua(homNay)) ?? kyMoiNhat(periods);
}

/**
 * Sáu tháng của biểu đồ xu hướng, cũ → mới. Kết thúc ở tháng hiện tại — hoặc tháng của kỳ mới
 * nhất nếu công ty đã tạo kỳ cho tháng sau. Tháng chưa có kỳ vẫn giữ chỗ trên trục để lộ ra
 * khoảng trống thay vì dồn các cột lại như thể liền mạch.
 */
export function khungSauThang(periods: PayrollPeriodApiItem[], homNay: string): ThangNam[] {
  const thangNay = thangCua(homNay);
  const moiNhat = kyMoiNhat(periods);
  const cuoi =
    moiNhat && soThuTuThang(thangCuaKy(moiNhat)) > soThuTuThang(thangNay)
      ? thangCuaKy(moiNhat)
      : thangNay;
  return Array.from({ length: 6 }, (_, i) => luiThang(cuoi, 5 - i));
}

export interface TongKyLuong {
  quyLuong: number;
  thucLinh: number;
  thuNhap: number;
  soNhanVien: number;
}

/** Cộng dồn các dòng ĐÃ TÍNH SẴN của một kỳ — không tính lại gì. */
export function tongKyLuong(lines: PayrollCalculationLineApi[]): TongKyLuong {
  return lines.reduce<TongKyLuong>(
    (tong, l) => ({
      quyLuong: tong.quyLuong + l.totalCompanyCost,
      thucLinh: tong.thucLinh + l.netTakeHomeSalary,
      thuNhap: tong.thuNhap + l.grossIncome,
      soNhanVien: tong.soNhanVien + 1,
    }),
    { quyLuong: 0, thucLinh: 0, thuNhap: 0, soNhanVien: 0 },
  );
}

export interface DongChiPhiPhongBan {
  ten: string;
  quyLuong: number;
  soNhanVien: number;
}

/** Quỹ lương của kỳ gom theo phòng ban, nhiều → ít. */
export function chiPhiTheoPhongBan(lines: PayrollCalculationLineApi[]): DongChiPhiPhongBan[] {
  const theoPb = new Map<string, DongChiPhiPhongBan>();
  for (const l of lines) {
    const ten = l.departmentName?.trim() || TEN_CHUA_GAN_PHONG_BAN;
    const dong = theoPb.get(ten) ?? { ten, quyLuong: 0, soNhanVien: 0 };
    dong.quyLuong += l.totalCompanyCost;
    dong.soNhanVien += 1;
    theoPb.set(ten, dong);
  }
  return [...theoPb.values()].sort((a, b) => b.quyLuong - a.quyLuong);
}

/**
 * Giữ `soToiDa` dòng đầu, phần đuôi gộp thành MỘT dòng "Khác (n phòng ban)" mang cờ `laKhac` —
 * biểu đồ không bao giờ phải vẽ quá số hạng mục mắt còn phân biệt được. Vừa đủ thì trả nguyên.
 */
export function gopPhanDuoi<T extends { ten: string }>(
  rows: T[],
  soToiDa: number,
  gop: (duoi: T[]) => Omit<T, "ten">,
): (T & { laKhac?: true })[] {
  if (rows.length <= soToiDa) return rows;
  const duoi = rows.slice(soToiDa - 1);
  const khac = { ...gop(duoi), ten: `Khác (${duoi.length} phòng ban)`, laKhac: true } as T & {
    laKhac: true;
  };
  return [...rows.slice(0, soToiDa - 1), khac];
}

/** Kỳ đang đợi người duyệt: đã trình (chờ duyệt) và đã khóa sổ (chờ phê duyệt), mới → cũ. */
export function kyChoPheDuyet(periods: PayrollPeriodApiItem[]): PayrollPeriodApiItem[] {
  return periods
    .filter((p) => p.status === "PENDING_REVIEW" || p.status === "LOCKED")
    .sort((a, b) => soThuTuThang(thangCuaKy(b)) - soThuTuThang(thangCuaKy(a)));
}

/** Kỳ nên đem "Trình lương": kỳ nháp của tháng này, không có thì kỳ nháp mới nhất. */
export function kyNenTrinh(
  periods: PayrollPeriodApiItem[],
  homNay: string,
): PayrollPeriodApiItem | null {
  const kyThangNay = kyCuaThang(periods, thangCua(homNay));
  if (kyThangNay?.status === "DRAFT") return kyThangNay;
  return kyMoiNhat(periods.filter((p) => p.status === "DRAFT"));
}

// ─────────────────────────────── Tăng ca ───────────────────────────────

export interface DongTangCa {
  ma_nv: string;
  ho_ten: string;
  gio: number;
  vuotNguong: boolean;
}

export interface TongHopTangCa {
  tongGio: number;
  soNguoiCoTangCa: number;
  /** Cờ `isWarningMonth` do BE tính theo ngưỡng giờ/tháng ở Cấu hình mặc định. */
  soNguoiVuotNguong: number;
  /** Người tăng ca nhiều nhất, nhiều → ít. */
  nhieuNhat: DongTangCa[];
}

/** Số người hiện ở danh sách "Tăng ca nhiều nhất". */
const SO_NGUOI_TANG_CA_NHIEU_NHAT = 5;

export function tongHopTangCa(rows: OvertimeSummaryApi[]): TongHopTangCa {
  const coTangCa = rows
    .filter((r) => r.totalHours > 0)
    .map((r) => ({
      ma_nv: r.ma_nv,
      ho_ten: r.ho_ten,
      gio: r.totalHours,
      vuotNguong: r.isWarningMonth,
    }))
    .sort((a, b) => b.gio - a.gio);

  return {
    tongGio: coTangCa.reduce((tong, r) => tong + r.gio, 0),
    soNguoiCoTangCa: coTangCa.length,
    soNguoiVuotNguong: coTangCa.filter((r) => r.vuotNguong).length,
    nhieuNhat: coTangCa.slice(0, SO_NGUOI_TANG_CA_NHIEU_NHAT),
  };
}
