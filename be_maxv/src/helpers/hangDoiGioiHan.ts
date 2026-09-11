export interface GioiHanHangDoi {
  /** Số việc chạy cùng lúc. */
  dongThoi: number;
  /** Số lượt được XẾP HÀNG chờ tối đa — mỗi lượt chờ giữ nguyên request (body/tham số) trong RAM. */
  choToiDa: number;
  /** Số lượt (đang chạy + đang chờ) tối đa của MỘT người dùng. */
  moiNguoiToiDa: number;
}

/**
 * Hàng đợi có trần cho việc nặng (render PDF bằng Chromium, tải hóa đơn gốc qua captcha OCR...): tối đa
 * `dongThoi` việc chạy cùng lúc, việc tới sau xếp hàng chờ. Slot được TRAO THẲNG cho người chờ kế tiếp
 * khi một việc xong (không nhả rồi giành lại), nên không bao giờ vượt trần.
 *
 * Hai trần chống dội (vbsec 2026-09-10): hàng chờ đầy, hoặc người gọi đã có đủ lượt -> ném lỗi do
 * `taoLoiDay` tạo NGAY, không xếp thêm. Không có trần thì mỗi request chờ giữ tài nguyên trong RAM, một
 * tài khoản dội liên tục là tới lúc PM2 khởi động lại cả backend. Việc lỗi vẫn nhả slot + lượt.
 *
 * Dùng trần SỐ LƯỢT thay cho rate limit theo phút vì FE chạy các việc này TUẦN TỰ theo lô hàng trăm,
 * hàng nghìn tờ — giới hạn tốc độ sẽ làm hỏng lượt xuất hợp lệ.
 */
export function taoHangDoiGioiHan(
  gioiHan: GioiHanHangDoi,
  taoLoiDay: () => Error,
) {
  let dangChay = 0;
  const hangCho: Array<() => void> = [];
  const soLuotTheoNguoi = new Map<string, number>();

  async function laySlot(): Promise<void> {
    if (dangChay < gioiHan.dongThoi) {
      dangChay += 1;
      return;
    }
    await new Promise<void>((resolve) => hangCho.push(resolve));
  }

  function traSlot(): void {
    const tiepTheo = hangCho.shift();
    if (tiepTheo) tiepTheo();
    else dangChay -= 1;
  }

  return async function chay<T>(
    nguoiGoi: string,
    viec: () => Promise<T>,
  ): Promise<T> {
    const soLuotCuaNguoi = soLuotTheoNguoi.get(nguoiGoi) ?? 0;
    const hangChoDay =
      dangChay >= gioiHan.dongThoi && hangCho.length >= gioiHan.choToiDa;
    if (soLuotCuaNguoi >= gioiHan.moiNguoiToiDa || hangChoDay) {
      throw taoLoiDay();
    }

    soLuotTheoNguoi.set(nguoiGoi, soLuotCuaNguoi + 1);
    try {
      await laySlot();
      try {
        return await viec();
      } finally {
        traSlot();
      }
    } finally {
      const conLai = (soLuotTheoNguoi.get(nguoiGoi) ?? 1) - 1;
      if (conLai > 0) soLuotTheoNguoi.set(nguoiGoi, conLai);
      else soLuotTheoNguoi.delete(nguoiGoi);
    }
  };
}
