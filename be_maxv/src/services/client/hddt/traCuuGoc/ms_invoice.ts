/**
 * ===== TẢI HÓA ĐƠN GỐC — MY SOFTWARE (tracuu.myinvoice.vn) =====
 *
 * Cùng phần mềm tra cứu với VININVOICE, chỉ khác origin — toàn bộ luồng nằm ở `iam_entry.ts`
 * (1 request GET, không captcha/cookie/token). Ở đây chỉ khai phần riêng của NCC.
 *
 * `code` = mã tra cứu in trên hóa đơn; FE rút từ trường `mhdon` của payload chi tiết — xem
 * `TRA_CUU_NCC`. KHÔNG cần `sellerMst`.
 */

import { taoBoTaiIamEntry } from "./iam_entry";

export const msInvoice = taoBoTaiIamEntry({
  /** MST NCC phát hành — khớp entry `0108971656` trong registry FE `TRA_CUU_NCC`. */
  mst: "0108971656",
  ten: "My Software",
  origin: "https://tracuu.myinvoice.vn",
});
