/**
 * Kỳ đã được đồng bộ hóa đơn TRỌN VẸN chưa.
 *
 * Vì sao cần: kê khai một kỳ mới đồng bộ 2/3 vẫn chạy trơn tru và ra một tờ khai trông bình
 * thường, chỉ thiếu 30% số liệu — không có dấu hiệu nào để nghi ngờ. Đã gặp thật: công ty
 * 0106861880 đồng bộ Q2/2026 từ 30/04 thay vì 01/04, tờ khai hụt đúng một hóa đơn bán ra
 * (127.041.090 tiền hàng, 10.163.288 tiền thuế) mà nhìn màn hình không thấy gì bất thường.
 *
 * Chỉ đọc `sync_log` trong DB tenant — không gọi cổng thuế.
 */

import type { PrismaClient } from "../../../generated/tenant";
import { khoangCuaKy, type Ky } from "./kySoThue";
import { ngayVn } from "../../../utils/ngayVn";

/** Dòng `sync_log` rút gọn — chỉ phần cần để xét độ phủ. */
export interface DongBoRef {
  direction: string;
  tu_ngay: Date;
  den_ngay: Date;
}

export interface PhuChieu {
  /** Có ÍT NHẤT MỘT lượt đồng bộ tự phủ trọn khoảng kỳ. */
  daPhu: boolean;
  /** Khoảng mà các lượt đồng bộ CÓ GIAO với kỳ trải ra (dạng `yyyy-MM-dd`); null = chưa có lượt nào. */
  tuNgayDaCo: string | null;
  denNgayDaCo: string | null;
}

export interface KetQuaPhuKy {
  /** Cả hai chiều đều đã phủ trọn. */
  daPhu: boolean;
  purchase: PhuChieu;
  sold: PhuChieu;
  /** Câu mô tả phần thiếu, dựng sẵn ở BE để FE khỏi lặp logic; null khi đã đủ. */
  canhBao: string | null;
  /** Như `canhBao` nhưng KHÔNG có câu dẫn — để nơi khác nhúng vào câu của mình. */
  phanThieu: string | null;
}

/** `2026-04-01` — so sánh và hiển thị đều theo NGÀY. */
function ngay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Xét độ phủ cho MỘT chiều.
 *
 * Cố ý KHÔNG ghép nhiều lượt lại để vá một kỳ: mỗi lượt phải tự phủ trọn khoảng. Ghép khoảng rời
 * rạc đòi một bộ hợp-khoảng đúng đắn, mà sai ở đó thì kết luận "đã đủ dữ liệu" sai — đúng kiểu
 * hỏng âm thầm mà hàm này sinh ra để chặn. Kỳ bị đồng bộ làm nhiều đợt thì đồng bộ lại trọn kỳ
 * một lượt, rẻ hơn nhiều so với một tờ khai thiếu số.
 *
 * `daPhu` xét chặt như trên; `tuNgayDaCo`/`denNgayDaCo` chỉ để MÔ TẢ phần đang có (min/max của các
 * lượt có giao với kỳ) nên có thể vẫn thủng ở giữa — đừng dùng hai field đó để kết luận đủ/thiếu.
 */
export function phuChieuTuLog(
  logs: DongBoRef[],
  chieu: "purchase" | "sold",
  khoang: { tuNgay: string; denNgay: string },
): PhuChieu {
  const cua = logs.filter((l) => l.direction === chieu || l.direction === "all");
  const giao = cua.filter(
    (l) => ngay(l.tu_ngay) <= khoang.denNgay && ngay(l.den_ngay) >= khoang.tuNgay,
  );
  const daPhu = cua.some(
    (l) => ngay(l.tu_ngay) <= khoang.tuNgay && ngay(l.den_ngay) >= khoang.denNgay,
  );

  if (giao.length === 0) return { daPhu: false, tuNgayDaCo: null, denNgayDaCo: null };
  return {
    daPhu,
    tuNgayDaCo: giao.map((l) => ngay(l.tu_ngay)).sort()[0],
    denNgayDaCo: giao.map((l) => ngay(l.den_ngay)).sort().reverse()[0],
  };
}

/** Câu mô tả phần thiếu của một chiều; null khi chiều đó đã phủ trọn. */
function moTaThieu(
  nhan: string,
  phu: PhuChieu,
  khoang: { tuNgay: string; denNgay: string },
): string | null {
  if (phu.daPhu) return null;
  if (!phu.tuNgayDaCo || !phu.denNgayDaCo) {
    return `${nhan}: chưa đồng bộ ngày nào trong kỳ`;
  }
  const thieu: string[] = [];
  if (phu.tuNgayDaCo > khoang.tuNgay) {
    thieu.push(`${ngayVn(khoang.tuNgay)}–${ngayVn(phu.tuNgayDaCo)}`);
  }
  if (phu.denNgayDaCo < khoang.denNgay) {
    thieu.push(`${ngayVn(phu.denNgayDaCo)}–${ngayVn(khoang.denNgay)}`);
  }
  // Không thiếu đầu cũng không thiếu cuối mà vẫn chưa phủ -> kỳ được ghép từ nhiều lượt rời.
  if (thieu.length === 0) {
    return `${nhan}: kỳ được đồng bộ làm nhiều đợt rời nhau, chưa có lượt nào phủ trọn kỳ`;
  }
  return `${nhan}: mới đồng bộ ${ngayVn(phu.tuNgayDaCo)}–${ngayVn(phu.denNgayDaCo)}, thiếu ${thieu.join(" và ")}`;
}

/**
 * Chỉ PHẦN MÔ TẢ thiếu, không có câu dẫn — `null` khi đã phủ trọn.
 *
 * Tách khỏi `canhBaoPhuKy` để nơi khác nhúng được vào câu của mình: cảnh báo "[22] nối từ kỳ chưa
 * đồng bộ đủ" mà chèn nguyên câu "Kỳ này chưa được đồng bộ trọn vẹn — ... Kê khai lúc này sẽ ra tờ
 * khai thiếu số." vào giữa thì thành hai câu lồng nhau, đọc không ra.
 */
export function phanThieuPhuKy(
  purchase: PhuChieu,
  sold: PhuChieu,
  khoang: { tuNgay: string; denNgay: string },
): string | null {
  const phan = [
    moTaThieu("Hóa đơn mua vào", purchase, khoang),
    moTaThieu("Hóa đơn bán ra", sold, khoang),
  ].filter((s): s is string => s !== null);
  return phan.length === 0 ? null : phan.join("; ");
}

/** Dựng câu cảnh báo chung cho cả hai chiều; null khi đủ. */
export function canhBaoPhuKy(
  purchase: PhuChieu,
  sold: PhuChieu,
  khoang: { tuNgay: string; denNgay: string },
): string | null {
  const phan = phanThieuPhuKy(purchase, sold, khoang);
  return phan === null
    ? null
    : `Kỳ này chưa được đồng bộ trọn vẹn — ${phan}. Kê khai lúc này sẽ ra tờ khai thiếu số.`;
}

/**
 * Các lượt đồng bộ đã HOÀN THÀNH — nguồn cho mọi phép xét độ phủ.
 *
 * Tách khỏi `kiemTraPhuKy` để một lượt tính tờ khai xét được NHIỀU kỳ (kỳ đang lập và kỳ nguồn của
 * [22]) mà chỉ đọc bảng một lần.
 *
 * Chỉ lượt "Đồng bộ" mới được tính là đã phủ — lượt "Cập nhật" áp bộ lọc UI của người dùng nên
 * không đảm bảo lấy hết hóa đơn trong khoảng.
 */
export async function docLogDongBo(db: PrismaClient): Promise<DongBoRef[]> {
  return (await db.sync_log.findMany({
    where: { trang_thai: "done", dien_giai: { startsWith: "Đồng bộ" } },
    select: { direction: true, tu_ngay: true, den_ngay: true },
    orderBy: { created_at: "desc" },
    take: 200,
  })) as DongBoRef[];
}

/** Xét độ phủ của một kỳ từ log đã đọc sẵn — hàm THUẦN. */
export function phuKyTuLog(logs: DongBoRef[], ky: Ky): KetQuaPhuKy {
  const khoang = khoangCuaKy(ky);
  const purchase = phuChieuTuLog(logs, "purchase", khoang);
  const sold = phuChieuTuLog(logs, "sold", khoang);
  return {
    daPhu: purchase.daPhu && sold.daPhu,
    purchase,
    sold,
    canhBao: canhBaoPhuKy(purchase, sold, khoang),
    phanThieu: phanThieuPhuKy(purchase, sold, khoang),
  };
}

export async function kiemTraPhuKy(db: PrismaClient, ky: Ky): Promise<KetQuaPhuKy> {
  return phuKyTuLog(await docLogDongBo(db), ky);
}
