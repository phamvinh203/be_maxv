/**
 * Bóc chỉ tiêu từ XML tờ khai đã lưu (`dvc_ho_so.xml_to_khai`, tải qua `taiXmlHoSo`).
 *
 * Cố tình KHÔNG dùng thư viện parse XML (cheerio/xml2js…): mỗi chỉ tiêu là một thẻ lá dạng
 * `<ctXX>giá_trị</ctXX>` không lồng con, regex đơn giản đủ dùng — cùng lý do/quy ước với
 * `hoSoHtml.ts` (không kéo thêm phụ thuộc chỉ để đọc vài chục thẻ phẳng).
 *
 * HIỆN CHỈ HỖ TRỢ mẫu 01/GTGT (Tờ khai thuế GTGT phương pháp khấu trừ, TT80/2021) — tờ khai loại
 * khác (05/KK-TNCN, 20-ĐK-TH-TCT…) không có các thẻ `<ctXX>` này nên trả object rỗng, KHÔNG phải
 * lỗi (bình thường: hồ sơ đó không phải tờ khai GTGT).
 */

import { htmlToText } from "../hddt/traCuuGoc/shared";

/**
 * Ánh xạ thẻ XML (mẫu 01/GTGT) -> tên cột hiển thị (PHẢI khớp y hệt `header` khai trong
 * `hdđt_maxv/src/features/dich_vu_cong/config.ts`, `COT_TO_KHAI` — `BangHoSo` khớp cột theo tên).
 *
 * ĐỐI CHIẾU với 5 hồ sơ 01/GTGT thật đã đồng bộ (MST 0106200129, kiểm tra 2026-08-20) — độ tin cậy
 * KHÁC NHAU theo từng chỉ tiêu, xem ghi chú tại từng dòng:
 *
 *  - ĐÃ kiểm chứng bằng số học chéo trên CẢ 5 hồ sơ (không chỉ suy từ tên thẻ):
 *    ct41 = ct22 + ct25 khớp đúng ở cả 5 hồ sơ (vd 25.418.834 + 4.407.359 = 29.826.193) -> xác
 *    nhận ct22="khấu trừ kỳ trước", ct25="khấu trừ kỳ này", ct41="khấu trừ chuyển kỳ sau TRƯỚC
 *    khi trừ đề nghị hoàn". ct43 = ct41 - ct42 ("đề nghị hoàn", luôn 0 ở cả 5 hồ sơ); dùng ct43
 *    (SAU khi trừ đề nghị hoàn) làm "khấu trừ chuyển kỳ sau" vì đó là số liệu CUỐI của kỳ.
 *    ct36 (=ct35-ct25, ÂM khi không phát sinh thuế đầu ra) và ct40 (=0 khi ct36 âm) đối lập nhau
 *    đúng cơ chế "phải nộp XOR còn được khấu trừ" ở cả 5 hồ sơ -> xác nhận ct40="phải nộp trong kỳ".
 *    ct34 = ct26 CHÍNH XÁC ở cả 5 hồ sơ, khớp công thức ct34=ct26+ct27 (tổng doanh thu = không
 *    chịu thuế + chịu thuế) khi ct27 ("HHDV bán ra chịu thuế") luôn 0 ở cả 5 hồ sơ -> củng cố
 *    ct26="HHDV bán ra (không chịu thuế GTGT)". CHƯA có hồ sơ nào ct27≠0 để tách bạch hẳn 100%
 *    (5 hồ sơ đối chiếu đều KHÔNG có phần doanh thu chịu thuế trong nước).
 *
 *  - CHỈ suy từ tên thẻ XML + vị trí trong form, CHƯA kiểm chứng được: cả 5 hồ sơ đối chiếu đều
 *    ct37=ct38=0 (công ty chưa từng phát sinh lượt điều chỉnh — hiếm, chỉ khi sửa sai số liệu kỳ
 *    trước) nên không đối chiếu chéo được — đối chiếu lại nếu số hiện sai: ct37/ct38 ("Điều chỉnh
 *    giảm"/"Điều chỉnh tăng").
 */
const CT_TO_KHAI_GTGT: Record<string, string> = {
  ct22: "Khấu trừ kỳ trước",
  ct23: "Giá trị HHDV mua vào",
  ct24: "Thuế GTGT HHDV mua vào",
  ct25: "Khấu trừ kỳ này",
  ct26: "HHDV bán ra",
  ct37: "Điều chỉnh giảm",
  ct38: "Điều chỉnh tăng",
  ct40: "Phải nộp trong kỳ",
  ct43: "Khấu trừ chuyển kỳ sau",
  ct34: "Doanh thu HHDV bán ra",
};

/** Bóc giá trị của MỘT thẻ lá `<tag>...</tag>` — `htmlToText` để giải entity (cổng vẫn có thể
 * ghi số dạng `&#38;`…) dù XML tờ khai hiếm khi cần, giữ nhất quán cách đọc text toàn dự án.
 * Cho phép thẻ mở có thuộc tính (`<tag xmlns="">...`) — khối chữ ký số (`<SigningTime>`…) một số
 * hồ sơ có gắn `xmlns=""`, cùng lý do nới `RE_THE_LA` bên dưới. */
function oThe(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`).exec(xml);
  const text = m ? htmlToText(m[1] ?? "") : "";
  return text || null;
}

/**
 * Bóc mọi chỉ tiêu mẫu 01/GTGT có trong `xml` thành `{tên cột: giá trị}`. Tờ khai không phải
 * 01/GTGT (không có thẻ nào trong `CT_TO_KHAI_GTGT`) -> trả object rỗng.
 */
export function layChiTieuToKhaiGtgt(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tag, cot] of Object.entries(CT_TO_KHAI_GTGT)) {
    const gia = oThe(xml, tag);
    if (gia !== null) out[cot] = gia;
  }
  return out;
}

/**
 * Khớp MỌI thẻ LÁ `<tag>giá_trị</tag>` (không lồng con) trong toàn bộ tài liệu, không cần biết
 * trước tên thẻ — dùng `[^<]*` giữa cặp thẻ nên thẻ CHA (có thẻ con bên trong, tức chứa `<`)
 * không bao giờ khớp được, chỉ những thẻ trong cùng tự đóng lại ngay mới khớp; nhờ vậy quét được
 * bất kỳ mức lồng nào mà không cần dựng cây/parser thật. Cho phép thẻ mở có thuộc tính
 * (`<tag a="1">`) qua `(?:\s[^>]*)?`.
 */
const RE_THE_LA = /<([a-zA-Z_][\w:.-]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g;

/** Fallback khi tờ khai KHÔNG khớp mẫu nào đã biết nhãn (`CT_TO_KHAI_GTGT`…) — liệt kê thẳng tên
 * thẻ XML làm nhãn (không đẹp bằng nhãn tiếng Việt nhưng luôn đọc được, không cần biết trước mẫu).
 * Thẻ rỗng bị bỏ qua, cùng quy ước với `oThe` (rỗng = "không có" chứ không phải "có mà bằng rỗng"). */
function layMoiTheLa(xml: string): { nhan: string; giaTri: string }[] {
  const out: { nhan: string; giaTri: string }[] = [];
  for (const m of xml.matchAll(RE_THE_LA)) {
    const gia = htmlToText(m[2] ?? "");
    if (gia) out.push({ nhan: m[1]!, giaTri: gia });
  }
  return out;
}

/** Tên thẻ `<ctNN>` hợp lệ trên mẫu in 01/GTGT (TT80/2021) — ĐỐI CHIẾU TỪNG SỐ với hồ sơ thật (hồ
 * sơ Quý 2/2026, MST 0106200129, kiểm tra 2026-08-20, khớp 100% kể cả dấu âm ct36 = -1446670 lưu
 * sẵn trong XML chứ không cần tự suy công thức). Union KIỂU (không phải mảng chạy vòng lặp) — chỉ
 * để bắt lỗi gõ sai tên thẻ ở `HANG` bên `ToKhaiGtgt01Form` lúc biên dịch; việc BÓC thật sự quét
 * toàn bộ thẻ `ctNN` có trong xml trong MỘT lượt (`layMoiCtGtgt01`), không lặp gọi `oThe` theo
 * từng tên trong danh sách này. */
type CtTagGtgt01 =
  | "ct21"
  | "ct22"
  | "ct23"
  | "ct24"
  | "ct23a"
  | "ct24a"
  | "ct25"
  | "ct26"
  | "ct27"
  | "ct28"
  | "ct29"
  | "ct30"
  | "ct31"
  | "ct32"
  | "ct33"
  | "ct32a"
  | "ct34"
  | "ct35"
  | "ct36"
  | "ct37"
  | "ct38"
  | "ct39a"
  | "ct40a"
  | "ct40b"
  | "ct40"
  | "ct41"
  | "ct42"
  | "ct43";

/** Khớp thẻ dạng `<ctNN>`/`<ctNNa>` (chữ số, tùy chọn một chữ cái) — hẹp hơn `RE_THE_LA` phía trên
 * để KHÔNG dính các thẻ khác cũng bắt đầu bằng "ct" nhưng không phải chỉ tiêu số tiền (vd thẻ địa
 * chỉ `ct11a_phuongXa_ma` trong `Header`). */
const RE_CT_GTGT01 = /<(ct\d+[a-z]?)>([^<]*)<\/\1>/g;

/** Quét MỘT LƯỢT toàn bộ thẻ chỉ tiêu (`ctNN`) có trong xml — thẻ nào không xuất hiện thì đơn
 * giản KHÔNG có mặt trong object trả về (đọc ra `undefined`, FE coi như "chưa có dữ liệu" giống hệt
 * `null`), khác `layMoiTheLa` ở chỗ CÓ giữ lại chỉ tiêu bằng 0 (mẫu in luôn hiện cả ô bằng 0). */
function layMoiCtGtgt01(xml: string): Partial<Record<CtTagGtgt01, number | null>> {
  const out: Partial<Record<CtTagGtgt01, number | null>> = {};
  for (const m of xml.matchAll(RE_CT_GTGT01)) {
    const text = htmlToText(m[2] ?? "");
    out[m[1] as CtTagGtgt01] = text ? Number(text) : null;
  }
  return out;
}

/** "Q"+"2/2026" -> "Quý 2 năm 2026"; "T"+"7/2026" -> "Tháng 7 năm 2026"; "N"+"2026" -> "Năm 2026".
 * Kiểu kỳ khác (hoặc thiếu dữ liệu) -> trả nguyên `kyKKhai` thô, không đoán liều. */
function nhanKyTinhThue(kieuKy: string | null, kyKKhai: string | null): string {
  if (!kyKKhai) return "";
  if (kieuKy === "Q") {
    const [quy, nam] = kyKKhai.split("/");
    return quy && nam ? `Quý ${quy} năm ${nam}` : kyKKhai;
  }
  if (kieuKy === "T") {
    const [thang, nam] = kyKKhai.split("/");
    return thang && nam ? `Tháng ${thang} năm ${nam}` : kyKKhai;
  }
  if (kieuKy === "N") return `Năm ${kyKKhai}`;
  return kyKKhai;
}

/** Tên (CN=...) rút từ `<X509SubjectName>` trong khối `<CKyDTu>` — dòng "Ký điện tử bởi" ở chân
 * mẫu in. `null` nếu không tìm thấy (hồ sơ chưa ký số / dạng chữ ký khác chưa gặp). */
function kyDienTuBoi(xml: string): string | null {
  return /CN=([^,]+)/.exec(xml)?.[1]?.trim() ?? null;
}

/** Dữ liệu đã bóc cho mẫu 01/GTGT — đủ để `ToKhaiGtgt01Form` bên FE dựng lại ĐÚNG layout mẫu in
 * (quốc hiệu, khối thông tin NNT, bảng chỉ tiêu, khối ký) thay vì chỉ liệt kê nhãn/giá trị phẳng. */
export interface ChiTietGtgt01 {
  tenTKhai: string;
  moTaBMau: string;
  tenNganhNghe: string;
  /** Đã dựng sẵn dạng "Quý 2 năm 2026", xem `nhanKyTinhThue`. */
  kyTinhThue: string;
  laLanDau: boolean;
  soLanBoSung: number;
  tenNNT: string;
  mst: string;
  tenCQTNoiNop: string;
  nguoiKy: string;
  /** `yyyy-mm-dd` thô — FE tự format thành "Ngày DD tháng MM năm YYYY". */
  ngayKy: string | null;
  /** Tên rút từ chứng thư số ký hồ sơ (`kyDienTuBoi`) — `null` nếu không tìm thấy. */
  kyDienTuBoi: string | null;
  /** ISO datetime thô của `<SigningTime>` — `null` nếu không tìm thấy. */
  ngayKyDienTu: string | null;
  /** `{ ct22: 29826193, ct23a: 0, ... }` — thẻ vắng mặt (`undefined`) hoặc `null` đều nghĩa là
   * không có dữ liệu, FE hiện ô trống thay vì "0" sai lệch. */
  ct: Partial<Record<CtTagGtgt01, number | null>>;
}

/** `tenTKhai` truyền sẵn từ `layChiTietToKhai` (đã đọc để nhận diện mẫu) thay vì đọc lại lần nữa
 * ở đây — cùng một thẻ, không cần quét xml hai lần cho một giá trị. */
function layChiTietGtgt01(xml: string, tenTKhai: string): ChiTietGtgt01 {
  const soLan = Number(oThe(xml, "soLan") ?? "0");
  return {
    tenTKhai: tenTKhai || "TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)",
    moTaBMau: oThe(xml, "moTaBMau") ?? "",
    tenNganhNghe: oThe(xml, "ten_NganhNghe") ?? "",
    kyTinhThue: nhanKyTinhThue(oThe(xml, "kieuKy"), oThe(xml, "kyKKhai")),
    laLanDau: soLan === 0,
    soLanBoSung: soLan,
    tenNNT: oThe(xml, "tenNNT") ?? "",
    mst: oThe(xml, "mst") ?? "",
    tenCQTNoiNop: oThe(xml, "tenCQTNoiNop") ?? "",
    nguoiKy: oThe(xml, "nguoiKy") ?? "",
    ngayKy: oThe(xml, "ngayKy"),
    kyDienTuBoi: kyDienTuBoi(xml),
    ngayKyDienTu: oThe(xml, "SigningTime"),
    ct: layMoiCtGtgt01(xml),
  };
}

/** Kết quả bóc XML cho dialog "Xem tờ khai" — xem `layChiTietToKhai`. */
export type ChiTietToKhai =
  | {
      /** Mẫu 01/GTGT -> FE dựng lại ĐÚNG layout mẫu in bằng `ToKhaiGtgt01Form` (xem `duLieu`). */
      loai: "gtgt01";
      duLieu: ChiTietGtgt01;
      xmlTho: string;
    }
  | {
      /** Mẫu KHÁC (chưa biết layout) -> liệt kê thẳng tên thẻ XML thô (`layMoiTheLa`), FE hiện
       * kèm cảnh báo "chưa có nhãn". Không bao giờ "không đọc được", chỉ chưa đẹp. */
      loai: "raw";
      chiTieu: { nhan: string; giaTri: string }[];
      xmlTho: string;
    };

/**
 * Bóc `xml` thành dạng hiển thị cho dialog "Xem tờ khai" (mở khi bấm cột "Tên thủ tục hành
 * chính") — nhận diện mẫu 01/GTGT ƯU TIÊN qua `maTKhai` (mã mẫu số cổng gán, ổn định hơn so chuỗi
 * tiêu đề tự do), `tenTKhai` chỉ là lưới an toàn dự phòng nếu cổng đổi mã mẫu ở phiên bản khác mà
 * tiêu đề vẫn còn "01/GTGT". ĐÃ TỪNG dùng thẻ `ctNN` để đoán mẫu nhưng bỏ: mẫu 05/KK-TNCN (thuế
 * TNCN) cũng có `ct21`..`ct32` trùng tên, dễ nhận nhầm. Mẫu khác -> fallback liệt kê thẻ thô.
 */
export function layChiTietToKhai(xml: string): ChiTietToKhai {
  const maTKhai = oThe(xml, "maTKhai");
  const tenTKhai = oThe(xml, "tenTKhai") ?? "";
  if (maTKhai === "842" || tenTKhai.includes("01/GTGT")) {
    return { loai: "gtgt01", duLieu: layChiTietGtgt01(xml, tenTKhai), xmlTho: xml };
  }
  return { loai: "raw", chiTieu: layMoiTheLa(xml), xmlTho: xml };
}
