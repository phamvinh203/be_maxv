/**
 * Nguồn dữ liệu của một hồ sơ trên cổng.
 *
 *  - `dvc`: tab "Dịch vụ công", hồ sơ nộp TỪ 01/07/2025.
 *  - `tdt`: tab "Thuế điện tử" (cổng gọi là ETAX), hồ sơ nộp TRƯỚC mốc đó.
 *
 * Hai nguồn dùng CHUNG phiên và chung captcha, chỉ khác endpoint — xem `DUONG_DAN`.
 *
 * Kiểu ở ĐÂY chứ không ở `gdt-dvc.service.ts`: đây là từ vựng nghiệp vụ, mà module kia đầy
 * fetch/pacer/session. Để bên đó thì `hoSoHtml.ts` (tầng bóc HTML) không import nổi — nó nằm dưới
 * trong cây phụ thuộc — nên phải khai lại union bằng tay, và bản khai tay đó sẽ không báo lỗi khi
 * thêm nguồn thứ ba.
 */
export type NguonHoSo = "dvc" | "tdt";

/**
 * Mốc chia hai nguồn hồ sơ trên cổng.
 *
 * Cổng ghi rõ trên tab Thuế điện tử: chỉ hỗ trợ tra cứu tờ khai nộp TRƯỚC ngày này. Từ mốc trở đi
 * hồ sơ nằm ở tab Dịch vụ công. Đây là quy ước của CỔNG, không phải lựa chọn của app — đổi số này
 * thì phải có căn cứ từ chính cổng.
 */
export const MOC_TDT = "2025-07-01";

/** Ngày cuối cùng còn thuộc nguồn TDT — SUY từ `MOC_TDT` chứ không khai tay: hai hằng cách nhau
 * đúng một ngày mà không có gì ép, sửa một cái là để lại khe hở hoặc chồng lấn âm thầm.
 * `Date.parse` trên `yyyy-mm-dd` là UTC theo chuẩn nên phép trừ này không dính múi giờ. */
const NGAY_CUOI_TDT = new Date(Date.parse(MOC_TDT) - 86_400_000).toISOString().slice(0, 10);

/** Khoảng ngày phủ TRỌN nguồn ETAX — dùng khi cần tra cứu lại đúng một hồ sơ mà không biết ngày
 * nộp của nó. Cận dưới lấy rộng tay: cổng chỉ có hồ sơ từ khi thuế điện tử vận hành. */
export const KHOANG_TDT = { tuNgay: "2000-01-01", denNgay: NGAY_CUOI_TDT };

export interface DoanTraCuu {
  nguon: NguonHoSo;
  /** `yyyy-mm-dd`. */
  tuNgay: string;
  denNgay: string;
}

/**
 * Cắt `[tuNgay, denNgay]` thành các đoạn kèm nguồn phải hỏi.
 *
 * Khoảng vắt qua mốc bị cắt ĐÔI và gọi cả hai nguồn, chứ không định tuyến theo mỗi ngày bắt đầu:
 * chọn 01/01/2025–31/12/2026 mà chỉ hỏi một nguồn là mất trọn nửa kia, im lặng.
 *
 * So sánh chuỗi `yyyy-mm-dd` trực tiếp — dạng này sắp theo từ điển trùng đúng với sắp theo thời
 * gian, nên khỏi dựng `Date` và khỏi dính lệch múi giờ (cùng lý do `parseNgayNop` phải neo 12:00
 * trưa bên `dvc-dong-bo.service.ts`).
 */
const RE_NGAY_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function chiaDoanTheoNguon(tuNgay: string, denNgay: string): DoanTraCuu[] {
  // Hàm này so sánh CHUỖI, nên định dạng khác `yyyy-mm-dd` sẽ so sai mà không báo gì: `"01/07/2025"`
  // sắp dưới mốc nên bị định tuyến sang ETAX, rồi `toDvcDate` lại vứt luôn ngày đi.
  if (!RE_NGAY_ISO.test(tuNgay) || !RE_NGAY_ISO.test(denNgay)) {
    throw new Error(`Khoảng ngày phải dạng yyyy-mm-dd, nhận được "${tuNgay}".."${denNgay}".`);
  }
  if (denNgay < MOC_TDT) return [{ nguon: "tdt", tuNgay, denNgay }];
  if (tuNgay >= MOC_TDT) return [{ nguon: "dvc", tuNgay, denNgay }];
  return [
    { nguon: "tdt", tuNgay, denNgay: NGAY_CUOI_TDT },
    { nguon: "dvc", tuNgay: MOC_TDT, denNgay },
  ];
}
