import {
  amSangDuong,
  congNgayDuong,
  dinhDangIso,
  duongSangAm,
} from './amLich.util';

export interface StandardHolidayTemplate {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'NATIONAL' | 'LUNAR';
  isAnnual: boolean;
  isPaid: boolean;
  note?: string | null;
}

/**
 * SINH 11 NGÀY NGHỈ LỄ CHUẨN VIỆT NAM (Điều 112 Bộ luật Lao động 2019).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO KHÔNG CÒN BẢNG TRA TAY
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Bản trước giữ một `LUNAR_HOLIDAYS_MAP` chép tay cho 7 năm 2024–2030. Khi đem đối chiếu với
 * thuật toán âm lịch (`amLich.util.ts`), bảng đó sai ở **8 điểm trên tổng 42 ô**:
 *
 *   · 2026 — cả cụm Tết trượt +1 ngày (Mùng 1 ghi 18/02, đúng là **17/02**)
 *   · 2030 — cả cụm Tết trượt +1 ngày (Mùng 1 ghi 03/02, đúng là **02/02**); con số 03/02 là
 *            ngày Tết của **lịch Trung Quốc** (UTC+8), không phải lịch Việt Nam (UTC+7)
 *   · 2028 — Giỗ Tổ ghi 05/04, đúng là **04/04**
 *   · 2027, 2028, 2029, 2030 — hai ngày trước Mùng 1 bị gọi là "29 Tết"/"30 Tết" trong khi
 *            tháng Chạp các năm đó **chỉ có 29 ngày**, nên không hề tồn tại ngày 30 Tết
 *
 * Chép tay không có cơ chế nào tự phát hiện những sai lệch đó. Ngày lễ quyết định hệ số tăng ca
 * 300%/390% và ngày nghỉ hưởng nguyên lương — sai một ngày là sai tiền, và sai theo kiểu khó
 * thấy. Nên toàn bộ phần âm lịch nay **suy ra từ thuật toán**, không còn hằng số nào để lệch.
 *
 * ⚠️ TUYỆT ĐỐI KHÔNG khôi phục bảng tra tay ở bất kỳ tầng nào (kể cả phía giao diện để "xem
 * trước"). Đây là nguồn sự thật DUY NHẤT của 11 ngày lễ chuẩn.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * QUY ƯỚC NGHIỆP VỤ ĐANG ÁP
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * · 5 ngày Tết Nguyên Đán = 2 ngày cuối tháng Chạp + Mùng 1, 2, 3.
 * · Tên hai ngày trước Tết bám theo **ngày âm lịch thật** của chúng: tháng Chạp đủ 30 ngày thì
 *   ra "29 Tết"/"30 Tết", tháng Chạp thiếu (29 ngày) thì ra "28 Tết"/"29 Tết".
 * · 1 ngày Giỗ Tổ Hùng Vương = 10/3 âm lịch.
 * · 5 ngày dương lịch cố định: 01/01, 30/4, 01/5, 01/9, 02/9.
 *
 * Cách chia 5 ngày Tết (mấy ngày trước, mấy ngày sau) do Chính phủ công bố hằng năm và có năm
 * khác quy ước trên. Hàm này giữ đúng quy ước đã chốt trong hợp đồng; đổi quy ước là quyết định
 * nghiệp vụ, không phải việc sửa ở đây.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * VỀ DẢI NĂM
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Hàm này **không còn trần 2030** — thuật toán tính được mọi năm. Giới hạn nghiệp vụ 2024–2030
 * (`BR-hrm-079` / `E-hrm-079`) vẫn do tầng validator và service canh giữ, nên hành vi của API
 * không đổi. Muốn nới dải chỉ cần sửa hai chỗ đó, không phải chờ ai chép thêm bảng.
 */
export function layDanhSach11NgayLeChuan(
  year: number,
): StandardHolidayTemplate[] {
  const lunarDays = layNgayLeAmLich(year);
  if (lunarDays.length === 0) {
    return [];
  }

  const solarDays: StandardHolidayTemplate[] = [
    {
      date: `${year}-01-01`,
      name: 'Tết Dương lịch',
      type: 'NATIONAL',
      isAnnual: true,
      isPaid: true,
      note: 'Nghỉ 01 ngày hưởng nguyên lương',
    },
    {
      date: `${year}-04-30`,
      name: 'Ngày Giải phóng miền Nam',
      type: 'NATIONAL',
      isAnnual: true,
      isPaid: true,
      note: 'Nghỉ 01 ngày hưởng nguyên lương',
    },
    {
      date: `${year}-05-01`,
      name: 'Ngày Quốc tế Lao động',
      type: 'NATIONAL',
      isAnnual: true,
      isPaid: true,
      note: 'Nghỉ 01 ngày hưởng nguyên lương',
    },
    {
      date: `${year}-09-01`,
      name: 'Nghỉ liền kề Quốc khánh',
      type: 'NATIONAL',
      isAnnual: true,
      isPaid: true,
      note: 'Nghỉ liền kề ngày Quốc khánh hưởng nguyên lương',
    },
    {
      date: `${year}-09-02`,
      name: 'Ngày Quốc khánh',
      type: 'NATIONAL',
      isAnnual: true,
      isPaid: true,
      note: 'Nghỉ ngày Quốc khánh hưởng nguyên lương',
    },
  ];

  const lunarTemplates: StandardHolidayTemplate[] = lunarDays.map((item) => ({
    date: item.date,
    name: item.name,
    type: 'LUNAR',
    isAnnual: false,
    isPaid: true,
    note: 'Nghỉ lễ âm lịch hưởng nguyên lương theo Điều 112 BLLĐ',
  }));

  // Ghép và sắp xếp tăng dần theo ngày
  const allHolidays = [...solarDays, ...lunarTemplates];
  allHolidays.sort((a, b) => a.date.localeCompare(b.date));
  return allHolidays;
}

/**
 * Sáu ngày lễ âm lịch của năm dương `year`: 5 ngày Tết + Giỗ Tổ Hùng Vương.
 *
 * Trả mảng rỗng khi `year` nằm ngoài dải mà thuật toán còn ý nghĩa (1900–2199). Đây là chặn
 * KỸ THUẬT, không phải chặn nghiệp vụ — dải nghiệp vụ nằm ở validator và service.
 */
export function layNgayLeAmLich(
  year: number,
): Array<{ date: string; name: string }> {
  if (!Number.isInteger(year) || year < 1900 || year > 2199) {
    return [];
  }

  const mung1 = amSangDuong(1, 1, year);
  const gioTo = amSangDuong(10, 3, year);
  if (mung1 === null || gioTo === null) {
    return [];
  }

  const ketQua: Array<{ date: string; name: string }> = [];

  /*
   * Hai ngày cuối tháng Chạp. KHÔNG suy tên từ hằng số: hỏi ngược lại thuật toán xem ngày đó là
   * mùng mấy âm lịch rồi lấy chính con số ấy đặt tên. Nhờ vậy năm tháng Chạp thiếu (29 ngày) tự
   * ra "28 Tết"/"29 Tết", năm tháng Chạp đủ tự ra "29 Tết"/"30 Tết" — không thể lệch.
   */
  for (const buoc of [-2, -1]) {
    const ngayDuong = congNgayDuong(mung1, buoc);
    const am = duongSangAm(ngayDuong[0], ngayDuong[1], ngayDuong[2]);
    ketQua.push({
      date: dinhDangIso(ngayDuong),
      name: `Nghỉ Tết Âm lịch (${am.ngay} Tết)`,
    });
  }

  const tenMung = ['Mùng 1', 'Mùng 2', 'Mùng 3'];
  for (let i = 0; i < tenMung.length; i++) {
    ketQua.push({
      date: dinhDangIso(congNgayDuong(mung1, i)),
      name: `Tết Nguyên Đán (${tenMung[i]})`,
    });
  }

  ketQua.push({
    date: dinhDangIso(gioTo),
    name: 'Giỗ Tổ Hùng Vương (10/3 Âm lịch)',
  });

  return ketQua;
}
