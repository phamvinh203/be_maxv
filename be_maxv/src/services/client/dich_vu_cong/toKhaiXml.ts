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
 * `null`), khác `layMoiTheLa` ở chỗ CÓ giữ lại chỉ tiêu bằng 0 (mẫu in luôn hiện cả ô bằng 0).
 *
 * `giuLai` lọc theo dải mã hợp lệ của TỪNG mẫu (01/GTGT nhận tất, 05/KK-TNCN chỉ [16]..[32]) — mẫu
 * này có thẻ `ctNN` trùng tên mẫu kia, không lọc thì một xml lạ lọt vào sẽ dựng nên chỉ tiêu ma. */
function layMoiCt<T extends string>(
  xml: string,
  giuLai: (tag: string) => boolean = () => true,
): Partial<Record<T, number | null>> {
  const out: Partial<Record<T, number | null>> = {};
  for (const m of xml.matchAll(RE_CT_GTGT01)) {
    const tag = m[1]!;
    if (!giuLai(tag)) continue;
    const text = htmlToText(m[2] ?? "");
    const so = text ? Number(text) : null;
    // `Number("1.234.567")` (hoặc bất cứ chuỗi không phải số nào cổng lỡ ghi) ra `NaN`, mà `NaN`
    // lọt qua mọi guard của `fmtSoTien` bên FE và in thẳng chữ "NaN" lên mẫu tờ khai. Coi như
    // KHÔNG CÓ chỉ tiêu vẫn đúng hơn là hiện một ô rác.
    out[tag as T] = so !== null && Number.isFinite(so) ? so : null;
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

/**
 * Phần thông tin chung của MỌI tờ khai TCT — nằm trong khối `TTinChung`/`NNT` có cấu trúc giống
 * nhau bất kể mẫu nào, nên bóc một chỗ duy nhất.
 *
 * ĐÃ ĐỐI CHIẾU trên XML 01/GTGT thật (`__tests__/toKhaiXml.test.ts`). Các mẫu khác dùng lại nguyên
 * hàm này thay vì chép lại — trước đây mỗi mẫu chép một bản KÈM CẢ đoạn ghi chú "đã đối chiếu",
 * nên bản thứ hai chỉ là lời khẳng định đi mượn; mẫu thứ ba sẽ mượn tiếp và bản nào lệch trước thì
 * thành nói dối.
 */
interface ThongTinChungToKhai {
  tenTKhai: string;
  moTaBMau: string;
  /** Đã dựng sẵn dạng "Quý 2 năm 2026", xem `nhanKyTinhThue`. */
  kyTinhThue: string;
  laLanDau: boolean;
  soLanBoSung: number;
  tenNNT: string;
  mst: string;
  nguoiKy: string;
  /** `yyyy-mm-dd` thô — FE tự format thành "Ngày DD tháng MM năm YYYY". */
  ngayKy: string | null;
  /** Tên rút từ chứng thư số ký hồ sơ (`kyDienTuBoi`) — `null` nếu không tìm thấy. */
  kyDienTuBoi: string | null;
  /** ISO datetime thô của `<SigningTime>` — `null` nếu không tìm thấy. */
  ngayKyDienTu: string | null;
}

/** `xml` chỉ để moi `CN=` của chữ ký số (không phải thẻ lá nên không nằm trong `bang`). */
function thongTinChungToKhai(
  xml: string,
  bang: Map<string, string>,
  tenTKhai: string,
  tieuDeMacDinh: string,
): ThongTinChungToKhai {
  const soLan = Number(oBang(bang, "soLan") ?? "0");
  return {
    tenTKhai: tenTKhai || tieuDeMacDinh,
    moTaBMau: oBang(bang, "moTaBMau") ?? "",
    kyTinhThue: nhanKyTinhThue(oBang(bang, "kieuKy"), oBang(bang, "kyKKhai")),
    laLanDau: soLan === 0,
    soLanBoSung: soLan,
    tenNNT: oBang(bang, "tenNNT") ?? "",
    mst: oBang(bang, "mst") ?? "",
    nguoiKy: oBang(bang, "nguoiKy") ?? "",
    ngayKy: oBang(bang, "ngayKy"),
    kyDienTuBoi: kyDienTuBoi(xml),
    ngayKyDienTu: oBang(bang, "SigningTime"),
  };
}

/** Dữ liệu đã bóc cho mẫu 01/GTGT — đủ để `ToKhaiGtgt01Form` bên FE dựng lại ĐÚNG layout mẫu in
 * (quốc hiệu, khối thông tin NNT, bảng chỉ tiêu, khối ký) thay vì chỉ liệt kê nhãn/giá trị phẳng. */
export interface ChiTietGtgt01 extends ThongTinChungToKhai {
  tenNganhNghe: string;
  tenCQTNoiNop: string;
  /** `{ ct22: 29826193, ct23a: 0, ... }` — thẻ vắng mặt (`undefined`) hoặc `null` đều nghĩa là
   * không có dữ liệu, FE hiện ô trống thay vì "0" sai lệch. */
  ct: Partial<Record<CtTagGtgt01, number | null>>;
}

/** `tenTKhai` truyền sẵn từ `layChiTietToKhai` (đã đọc để nhận diện mẫu) thay vì đọc lại lần nữa
 * ở đây — cùng một thẻ, không cần quét xml hai lần cho một giá trị. */
function layChiTietGtgt01(xml: string, tenTKhai: string): ChiTietGtgt01 {
  const bang = bangTheLa(xml);
  return {
    ...thongTinChungToKhai(xml, bang, tenTKhai, "TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)"),
    tenNganhNghe: oBang(bang, "ten_NganhNghe") ?? "",
    tenCQTNoiNop: oBang(bang, "tenCQTNoiNop") ?? "",
    ct: layMoiCt<CtTagGtgt01>(xml),
  };
}

/** Tên thẻ `<ctNN>` trên mẫu in 05/KK-TNCN — mã chỉ tiêu chạy liền [16]..[32], không có hậu tố
 * a/b như 01/GTGT. Union KIỂU (không phải mảng chạy vòng lặp), cùng vai trò `CtTagGtgt01`: bắt lỗi
 * gõ sai tên thẻ ở `HANG` bên `ToKhaiTNCN05Form` lúc biên dịch. */
type CtTagTncn05 =
  | "ct16"
  | "ct17"
  | "ct18"
  | "ct19"
  | "ct20"
  | "ct21"
  | "ct22"
  | "ct23"
  | "ct24"
  | "ct25"
  | "ct26"
  | "ct27"
  | "ct28"
  | "ct29"
  | "ct30"
  | "ct31"
  | "ct32";

/**
 * Quét MỘT LƯỢT mọi thẻ lá thành bảng `tên thẻ -> giá trị`, để tra O(1) thay vì mỗi trường một lượt
 * `oThe` (mỗi lượt là 1 `new RegExp` + 1 lần quét hết tài liệu).
 *
 * Đáng làm vì `oTheDauTien` thử nhiều tên ứng viên cho mỗi trường, mà các tên đó là ĐOÁN nên trường
 * hợp phổ biến chính là trường hợp xấu nhất: miss thì regex phải quét tới cuối chuỗi mới trả `null`.
 * Bóc một tờ khai 05/KK-TNCN kiểu cũ tốn ~40 lượt quét toàn văn bản; kiểu này đúng 1 lượt.
 *
 * Giữ lần xuất hiện ĐẦU TIÊN để y hệt hành vi `oThe` (`exec` trả match đầu tiên) — có tên thẻ xuất
 * hiện ở nhiều khối, vd `<mst>` có cả ở khối NNT lẫn khối đại lý thuế.
 */
function bangTheLa(xml: string): Map<string, string> {
  const bang = new Map<string, string>();
  for (const m of xml.matchAll(RE_THE_LA)) {
    if (!bang.has(m[1]!)) bang.set(m[1]!, htmlToText(m[2] ?? ""));
  }
  return bang;
}

/** Đọc 1 thẻ từ bảng đã quét. Rỗng -> `null`, cùng quy ước `oThe` ("rỗng" = "không có"). */
function oBang(bang: Map<string, string>, tag: string): string | null {
  return bang.get(tag) || null;
}

/** Giá trị thẻ ĐẦU TIÊN tìm thấy trong danh sách tên ứng viên — dùng cho các trường mà tên thẻ
 * thật CHƯA đối chiếu được với hồ sơ mẫu (xem `layChiTietTncn05`). Thử vài tên hay gặp còn hơn
 * chốt cứng một tên đoán bừa: trúng cái nào thì hiện, không trúng thì ô để trống.
 *
 * CHỈ nhận tên thẻ có hậu tố định danh khối (vd `dchiNNT`), KHÔNG nhận tên trần (`email`, `fax`,
 * `dchiTSo`…): bảng thẻ gộp cả tài liệu nên một tên trần rất dễ vớ đúng giá trị của khối ĐẠI LÝ
 * THUẾ rồi hiện lên như thể là của người nộp thuế. Ô trống là kiểu hỏng nhìn ra được; số liệu sai
 * trên một bản sao tờ khai thì không. */
function oTheDauTien(bang: Map<string, string>, ...tags: string[]): string | null {
  for (const tag of tags) {
    const gia = oBang(bang, tag);
    if (gia !== null) return gia;
  }
  return null;
}

/** Dữ liệu đã bóc cho mẫu 05/KK-TNCN — đủ để `ToKhaiTNCN05Form` bên FE dựng lại mẫu in. */
export interface ChiTietTncn05 extends ThongTinChungToKhai {
  diaChi: string;
  phuongXa: string;
  tinhTP: string;
  dienThoai: string;
  fax: string;
  email: string;
  tenDaiLyThue: string;
  mstDaiLyThue: string;
  hopDongDaiLySo: string;
  hopDongDaiLyNgay: string;
  /** Ô đánh dấu [15]. */
  phanBoThue: boolean;
  ct: Partial<Record<CtTagTncn05, number | null>>;
}

/**
 * Bóc mẫu 05/KK-TNCN.
 *
 * ĐỘ TIN CẬY KHÔNG ĐỒNG ĐỀU — đọc kỹ trước khi sửa:
 *
 *  - ĐÃ đối chiếu (dùng chung khối `TTinChung` của mọi tờ khai TCT, xác nhận trên XML 01/GTGT thật
 *    ở `__tests__/toKhaiXml.test.ts`): `tenTKhai`, `moTaBMau`, `soLan`, `kieuKy`/`kyKKhai`,
 *    `nguoiKy`, `ngayKy`, `mst`, `tenNNT`, `SigningTime`, `CN=` của chữ ký số.
 *
 *  - SUY từ quy ước `ctNN` -> `[NN]` (giống hệt 01/GTGT, và mã chỉ tiêu trên mẫu in 05/KK-TNCN
 *    chạy đúng [16]..[32]): các chỉ tiêu `ct16`..`ct32`. Rất khả năng đúng nhưng CHƯA có hồ sơ
 *    05/KK-TNCN thật để đối chiếu chéo bằng số học như đã làm với 01/GTGT.
 *
 *  - CHƯA ĐỐI CHIẾU, mỗi trường thử vài tên thẻ ứng viên (`oTheDauTien`): địa chỉ [06]..[11], đại
 *    lý thuế [12]..[14], ô [15]. Không trúng tên nào thì ô để TRỐNG — mẫu in vẫn dựng đủ, chỉ
 *    thiếu mấy dòng thông tin, KHÔNG hỏng cả tờ khai. Có XML 05/KK-TNCN thật thì sửa đúng một chỗ
 *    này là xong.
 */
function layChiTietTncn05(xml: string, tenTKhai: string): ChiTietTncn05 {
  // Quét bảng thẻ MỘT LƯỢT rồi tra: hàm này đọc mấy chục trường, mỗi trường một lượt `oThe` là mỗi
  // trường một lần quét hết tài liệu (xem `bangTheLa`).
  const bang = bangTheLa(xml);
  return {
    ...thongTinChungToKhai(
      xml,
      bang,
      tenTKhai,
      "TK KHẤU TRỪ THUẾ THU NHẬP CÁ NHÂN MẪU 05/KK-TNCN (TT80/2021)",
    ),
    diaChi: oTheDauTien(bang, "dchiNNT", "diaChiNNT") ?? "",
    phuongXa: oTheDauTien(bang, "phuongXaNNT", "tenPhuongXa") ?? "",
    tinhTP: oTheDauTien(bang, "tinhTPNNT", "tenTinhTP") ?? "",
    dienThoai: oTheDauTien(bang, "dthoaiNNT", "dienThoaiNNT") ?? "",
    fax: oTheDauTien(bang, "faxNNT") ?? "",
    email: oTheDauTien(bang, "emailNNT") ?? "",
    tenDaiLyThue: oTheDauTien(bang, "tenDlyTTdlt", "tenDaiLyThue", "tenDLThue") ?? "",
    mstDaiLyThue: oTheDauTien(bang, "mstDlyTTdlt", "mstDaiLyThue", "mstDLThue") ?? "",
    hopDongDaiLySo: oTheDauTien(bang, "soHdongDlyT", "soHopDongDLThue") ?? "",
    hopDongDaiLyNgay: oTheDauTien(bang, "ngayHdongDlyT", "ngayHopDongDLThue") ?? "",
    // Cổng ghi ô đánh dấu bằng "1"/"true" tùy mẫu — nhận cả hai, mọi giá trị khác coi như không.
    phanBoThue: ["1", "true"].includes(
      (oTheDauTien(bang, "phanBoThue", "coPhanBo") ?? "").trim().toLowerCase(),
    ),
    // Chỉ nhận `ctNN` KHÔNG hậu tố chữ, trong dải [16]..[32] — đúng dải mã chỉ tiêu của mẫu này.
    ct: layMoiCt<CtTagTncn05>(xml, (tag) => {
      if (!/^ct\d+$/.test(tag)) return false;
      const so = Number(tag.slice(2));
      return so >= 16 && so <= 32;
    }),
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
      /** Mẫu 05/KK-TNCN -> FE dựng lại mẫu in bằng `ToKhaiTNCN05Form`. */
      loai: "tncn05";
      duLieu: ChiTietTncn05;
      xmlTho: string;
    }
  | {
      /** Mẫu KHÁC (chưa biết layout) -> liệt kê thẳng tên thẻ XML thô (`layMoiTheLa`), FE hiện
       * kèm cảnh báo "chưa có nhãn". Không bao giờ "không đọc được", chỉ chưa đẹp. */
      loai: "raw";
      chiTieu: { nhan: string; giaTri: string }[];
      xmlTho: string;
    };

/** Mã mẫu cổng gán (`<maTKhai>`) -> layout. Nguồn CHẮC CHẮN nhất vì là mã máy, không phải chữ tự
 * do. Thêm mẫu mới có mã đã đối chiếu: thêm đúng một dòng ở đây. */
const MAU_THEO_MA_TKHAI: Record<string, "gtgt01" | "tncn05"> = { "842": "gtgt01" };

/** Dò mã mẫu trong một chuỗi tự do (ô cột "Tờ khai" hoặc tiêu đề trong XML).
 *
 * Có `\b` hai đầu chứ không `includes`: cột "Tờ khai / Phụ lục" đúng như tên gọi CÓ THỂ liệt kê
 * nhiều thứ, và so chuỗi trần thì bất kỳ đoạn văn nào lỡ nhắc tới mã mẫu cũng khớp. */
const MAU_THEO_CHUOI: [RegExp, "gtgt01" | "tncn05"][] = [
  [/\b01\/GTGT\b/i, "gtgt01"],
  [/\b05\/KK-TNCN\b/i, "tncn05"],
];

function doTenMau(chuoi: string | null | undefined): "gtgt01" | "tncn05" | null {
  if (!chuoi) return null;
  return MAU_THEO_CHUOI.find(([re]) => re.test(chuoi))?.[1] ?? null;
}

/**
 * Bóc `xml` thành dạng hiển thị cho dialog "Xem tờ khai" (mở khi bấm cột "Tờ khai / Phụ lục").
 *
 * BA NGUỒN NHẬN DIỆN, xét đúng theo thứ tự tin cậy giảm dần:
 *  1. `<maTKhai>` — mã máy cổng gán, chắc chắn nhất (`MAU_THEO_MA_TKHAI`).
 *  2. `maMauHoSo` — ô cột "Tờ khai" của hồ sơ, chính là chuỗi người dùng NHÌN THẤY trên bảng.
 *  3. `tenTKhai` — tiêu đề trong XML, lưới an toàn khi hồ sơ chưa lưu ô "Tờ khai".
 *
 * Xét TỪNG nguồn riêng chứ không nối chúng thành một chuỗi rồi dò: nối lại là mọi nguồn có trọng số
 * bằng nhau, đúng thứ tự ưu tiên vừa khai ở trên trở thành không hiện thực được.
 *
 * ĐÃ TỪNG dùng thẻ `ctNN` để đoán mẫu nhưng bỏ: mẫu 05/KK-TNCN cũng có `ct21`..`ct32` trùng tên,
 * dễ nhận nhầm. Không nguồn nào khớp -> fallback liệt kê thẻ thô, không bao giờ "không đọc được".
 */
export function layChiTietToKhai(xml: string, maMauHoSo?: string | null): ChiTietToKhai {
  const maTKhai = oThe(xml, "maTKhai");
  const tenTKhai = oThe(xml, "tenTKhai") ?? "";

  const loai =
    MAU_THEO_MA_TKHAI[maTKhai ?? ""] ?? doTenMau(maMauHoSo) ?? doTenMau(tenTKhai) ?? "raw";

  if (loai === "gtgt01") {
    return { loai, duLieu: layChiTietGtgt01(xml, tenTKhai), xmlTho: xml };
  }
  if (loai === "tncn05") {
    return { loai, duLieu: layChiTietTncn05(xml, tenTKhai), xmlTho: xml };
  }
  return { loai: "raw", chiTieu: layMoiTheLa(xml), xmlTho: xml };
}
