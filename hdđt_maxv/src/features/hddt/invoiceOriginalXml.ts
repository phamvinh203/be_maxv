/**
 * Đọc vài trường CHỈ CÓ trong hóa đơn XML gốc (bản ký số tải từ cổng thuế), để bổ sung cho
 * `InvoiceView` dựng từ payload chi tiết.
 *
 * VÌ SAO CẦN: payload chi tiết của cổng thuế không mang chuỗi mã QR — chuỗi này do bên phát hành hóa
 * đơn sinh và chỉ nằm trong `<DLQRCode>` của XML. Không có cách nào tự dựng lại đúng nó, nên hoặc
 * lấy từ XML gốc, hoặc chấp nhận tờ hóa đơn không có QR.
 */

/** Các trường lấy thêm được từ XML gốc. Rỗng nếu XML không có (hóa đơn cũ, bên phát hành khác). */
export interface OriginalXmlExtras {
  /** Nội dung mã QR (`<DLQRCode>`) — chuỗi EMVCo do bên phát hành sinh. */
  qrData: string;
  /** Tên ngân hàng bên bán (`<NBan><TNHang>`), in cạnh số tài khoản trên bản thể hiện. */
  sellerBankName: string;
  /** Tên ngân hàng bên mua (`<NMua><TNHang>`). */
  buyerBankName: string;
}

const EMPTY: OriginalXmlExtras = { qrData: "", sellerBankName: "", buyerBankName: "" };

function textOf(doc: XMLDocument, selector: string): string {
  return doc.querySelector(selector)?.textContent?.trim() ?? "";
}

/**
 * Bóc `<DLQRCode>` và tên ngân hàng hai bên khỏi XML gốc.
 *
 * KHÔNG ném lỗi: XML hỏng/khác chuẩn thì trả về rỗng để tờ hóa đơn vẫn dựng được như trước — file
 * XML đã ghi ra đĩa vẫn nguyên vẹn dù đọc thêm ở đây có thất bại.
 */
export function readOriginalXmlExtras(xml: string): OriginalXmlExtras {
  if (!xml) return EMPTY;
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) return EMPTY;

    return {
      qrData: textOf(doc, "DLQRCode"),
      // Bám đường dẫn đầy đủ: `<NBan>` còn xuất hiện lần nữa trong `<DSCKS>` (khối chữ ký số).
      sellerBankName: textOf(doc, "NDHDon > NBan > TNHang"),
      buyerBankName: textOf(doc, "NDHDon > NMua > TNHang"),
    };
  } catch (e) {
    console.error("[invoiceOriginalXml] Không đọc được XML gốc:", e);
    return EMPTY;
  }
}
