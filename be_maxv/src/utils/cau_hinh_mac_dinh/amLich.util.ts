/**
 * CHUYỂN ĐỔI ÂM LỊCH ↔ DƯƠNG LỊCH THEO LỊCH VIỆT NAM.
 *
 * Thuật toán của Hồ Ngọc Đức, dựa trên *Astronomical Algorithms* (Jean Meeus, 1998): tính thời
 * điểm **sóc** (new moon) và **kinh độ mặt trời**, rồi quy về ngày theo múi giờ địa phương.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO MÚI GIỜ LÀ CHUYỆN SỐNG CÒN Ở ĐÂY
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Mùng 1 âm lịch là **ngày chứa thời điểm sóc tại địa phương**. Lịch Việt Nam quy chiếu theo
 * **UTC+7**, lịch Trung Quốc theo **UTC+8**. Khi sóc rơi vào khoảng 23:00–24:00 giờ Việt Nam thì
 * cùng khoảnh khắc đó đã sang ngày hôm sau ở Trung Quốc, và **hai lịch lệch nhau đúng một ngày**.
 *
 * Đây không phải tình huống lý thuyết. Trong dải 2024–2030 nó xảy ra ở **năm 2030**:
 *
 *     sóc tháng Giêng 2030 = 2030-02-02 16:08 UTC
 *       → giờ Việt Nam (UTC+7): 2030-02-02 23:08  ⇒ Mùng 1 Tết Việt Nam = 02/02/2030
 *       → giờ Trung Quốc (UTC+8): 2030-02-03 00:08 ⇒ Tết Trung Quốc      = 03/02/2030
 *
 * Bảng tra tay trước đây chép nhầm con số 03/02 của lịch Trung Quốc. Chép tay không có cách nào
 * tự phát hiện loại sai lệch này — đó là lý do module này tồn tại và là lý do bảng tra đã bị gỡ.
 *
 * ⚠️ MỌI lời gọi phục vụ nghiệp vụ Việt Nam PHẢI dùng `MUI_GIO_VN`. Đừng truyền múi giờ khác trừ
 * khi đang cố tình so sánh với lịch nước ngoài (chỉ có ca kiểm thử làm việc đó).
 *
 * Module thuần tính toán: không phụ thuộc Prisma, không phụ thuộc `Date` của hệ thống, không đọc
 * múi giờ của tiến trình. Cùng đầu vào luôn cho cùng đầu ra trên mọi máy.
 */

/** Múi giờ chuẩn của lịch Việt Nam (Giờ Đông Dương, UTC+7). */
export const MUI_GIO_VN = 7;

const PI = Math.PI;

/** Phần nguyên làm tròn xuống — thuật toán gốc dùng `INT()` theo nghĩa `floor`. */
function INT(d: number): number {
  return Math.floor(d);
}

/**
 * Số ngày Julian (Julian Day Number) của một ngày dương lịch.
 * Nhánh `< 2299161` xử lý giai đoạn lịch Julius trước cải cách Gregory (15/10/1582).
 */
export function jdTuNgayDuong(ngay: number, thang: number, nam: number): number {
  const a = INT((14 - thang) / 12);
  const y = nam + 4800 - a;
  const m = thang + 12 * a - 3;
  let jd =
    ngay +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = ngay + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/** Số ngày Julian ngược về ngày dương lịch `[ngay, thang, nam]`. */
export function ngayDuongTuJd(jd: number): [number, number, number] {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const ngay = e - INT((153 * m + 2) / 5) + 1;
  const thang = m + 3 - 12 * INT(m / 10);
  const nam = b * 100 + d - 4800 + INT(m / 10);
  return [ngay, thang, nam];
}

/**
 * Thời điểm sóc thứ `k` tính từ điểm mốc 1900-01-01, trả về dưới dạng số ngày Julian (giờ UTC).
 * Chuỗi nhiễu loạn rút gọn của Meeus — sai số cỡ vài phút cho thế kỷ 20–21.
 */
function thoiDiemSoc(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

/** Kinh độ mặt trời (radian) tại thời điểm `jdn` (số ngày Julian). */
function kinhDoMatTroi(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - PI * 2 * INT(L / (PI * 2));
  return L;
}

/** Cung hoàng đạo (0–11) của mặt trời lúc nửa đêm địa phương của ngày `soNgay`. */
function cungMatTroi(soNgay: number, muiGio: number): number {
  return INT((kinhDoMatTroi(soNgay - 0.5 - muiGio / 24) / PI) * 6);
}

/** Số ngày Julian của **ngày** chứa thời điểm sóc thứ `k`, quy về múi giờ `muiGio`. */
function ngaySoc(k: number, muiGio: number): number {
  return INT(thoiDiemSoc(k) + 0.5 + muiGio / 24);
}

/** Ngày bắt đầu tháng 11 âm lịch (tháng chứa đông chí) của năm dương `nam`. */
function thangMotMotAmLich(nam: number, muiGio: number): number {
  const off = jdTuNgayDuong(31, 12, nam) - 2415021;
  const k = INT(off / 29.530588853);
  const nm = ngaySoc(k, muiGio);
  return cungMatTroi(nm, muiGio) >= 9 ? ngaySoc(k - 1, muiGio) : nm;
}

/** Vị trí tháng nhuận so với tháng 11 âm lịch mở đầu chu kỳ. */
function viTriThangNhuan(a11: number, muiGio: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1;
  let last = 0;
  let arc = cungMatTroi(ngaySoc(k + i, muiGio), muiGio);
  do {
    last = arc;
    i++;
    arc = cungMatTroi(ngaySoc(k + i, muiGio), muiGio);
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Một ngày âm lịch. `nhuan = true` nghĩa là tháng nhuận. */
export interface NgayAmLich {
  ngay: number;
  thang: number;
  nam: number;
  nhuan: boolean;
}

/** Dương lịch sang âm lịch. */
export function duongSangAm(
  ngay: number,
  thang: number,
  nam: number,
  muiGio: number = MUI_GIO_VN,
): NgayAmLich {
  const soNgay = jdTuNgayDuong(ngay, thang, nam);
  const k = INT((soNgay - 2415021.076998695) / 29.530588853);
  let dauThang = ngaySoc(k + 1, muiGio);
  if (dauThang > soNgay) {
    dauThang = ngaySoc(k, muiGio);
  }
  let a11 = thangMotMotAmLich(nam, muiGio);
  let b11 = a11;
  let namAm: number;
  if (a11 >= dauThang) {
    namAm = nam;
    a11 = thangMotMotAmLich(nam - 1, muiGio);
  } else {
    namAm = nam + 1;
    b11 = thangMotMotAmLich(nam + 1, muiGio);
  }
  const ngayAm = soNgay - dauThang + 1;
  const chenhLech = INT((dauThang - a11) / 29);
  let nhuan = false;
  let thangAm = chenhLech + 11;
  if (b11 - a11 > 365) {
    const viTriNhuan = viTriThangNhuan(a11, muiGio);
    if (chenhLech >= viTriNhuan) {
      thangAm = chenhLech + 10;
      if (chenhLech === viTriNhuan) nhuan = true;
    }
  }
  if (thangAm > 12) thangAm -= 12;
  if (thangAm >= 11 && chenhLech < 4) namAm -= 1;
  return { ngay: ngayAm, thang: thangAm, nam: namAm, nhuan };
}

/**
 * Âm lịch sang dương lịch. Trả `null` khi tháng nhuận yêu cầu không tồn tại trong năm đó.
 */
export function amSangDuong(
  ngayAm: number,
  thangAm: number,
  namAm: number,
  nhuan: boolean = false,
  muiGio: number = MUI_GIO_VN,
): [number, number, number] | null {
  let a11: number;
  let b11: number;
  if (thangAm < 11) {
    a11 = thangMotMotAmLich(namAm - 1, muiGio);
    b11 = thangMotMotAmLich(namAm, muiGio);
  } else {
    a11 = thangMotMotAmLich(namAm, muiGio);
    b11 = thangMotMotAmLich(namAm + 1, muiGio);
  }
  let off = thangAm - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const viTriNhuan = viTriThangNhuan(a11, muiGio);
    let thangNhuan = viTriNhuan - 2;
    if (thangNhuan < 0) thangNhuan += 12;
    if (nhuan && thangAm !== thangNhuan) {
      return null;
    }
    if (nhuan || off >= viTriNhuan) {
      off += 1;
    }
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  return ngayDuongTuJd(ngaySoc(k + off, muiGio) + ngayAm - 1);
}

/** Định dạng `[ngay, thang, nam]` thành chuỗi `YYYY-MM-DD`. */
export function dinhDangIso([ngay, thang, nam]: [number, number, number]): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${nam}-${p(thang)}-${p(ngay)}`;
}

/** Cộng `soNgay` vào một ngày dương lịch, trả về chuỗi `YYYY-MM-DD`. */
export function congNgayDuong(
  goc: [number, number, number],
  soNgay: number,
): [number, number, number] {
  return ngayDuongTuJd(jdTuNgayDuong(goc[0], goc[1], goc[2]) + soNgay);
}
