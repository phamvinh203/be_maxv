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
 * ghi số dạng `&#38;`…) dù XML tờ khai hiếm khi cần, giữ nhất quán cách đọc text toàn dự án. */
function oThe(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
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
