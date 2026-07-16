/**
 * Render "tờ hóa đơn GTGT" (theo bố cục bản in Tổng cục Thuế) ra HTML THUẦN chuỗi — dùng CHUNG cho:
 *  - `InvoiceViewDialog` (xem trên màn hình qua dangerouslySetInnerHTML + in qua iframe),
 *  - xuất file .html/.pdf hàng loạt (nút "Xuất file tổng hợp + hóa đơn").
 * Nhờ 1 nguồn HTML duy nhất, bản xem/in/xuất giống hệt nhau. Mọi giá trị động escape qua `esc()`.
 */
import { formatMoney } from "./format";
import { formatDateTimeVN } from "./dateUtils";
import { tinhChatLabel, type InvoiceView } from "./invoiceView";

/**
 * CSS "tờ hóa đơn" — bám vào `.inv-sheet` để không rò ra ngoài. Nhúng qua <style> khi xem, ghi vào
 * iframe khi in, và vào tài liệu độc lập khi xuất file .html/.pdf.
 */
export const INVOICE_CSS = `
.inv-sheet { font-family: "Times New Roman", Times, serif; color: #000; background: #fff;
  font-size: 13px; line-height: 1.5; border: 1px solid #c9a45c; padding: 24px; }
.inv-sheet * { box-sizing: border-box; }
.inv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.inv-title { text-align: center; flex: 1; }
.inv-title h1 { font-size: 20px; font-weight: 700; text-transform: uppercase; margin: 8px 0 0; letter-spacing: .5px; }
.inv-title .date { margin-top: 6px; font-style: italic; }
.inv-meta { min-width: 170px; text-align: left; font-weight: 700; }
.inv-meta div { margin-bottom: 2px; }
.inv-cqt { text-align: center; font-style: italic; margin-top: 6px; }
.inv-rule { border: 0; border-top: 1px solid #c9a45c; margin: 12px 0; }
.inv-party .line { margin-bottom: 3px; }
.inv-party .line.indent { padding-left: 96px; text-indent: -96px; }
.inv-two { display: flex; gap: 40px; }
.inv-two .line { flex: 1; }
.inv-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
.inv-table th, .inv-table td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
.inv-table th { text-align: center; font-weight: 700; background: #faf3e2; }
.inv-table td.num, .inv-table th.num { text-align: right; }
.inv-table td.center, .inv-table th.center { text-align: center; }
.inv-sum { display: flex; gap: 24px; margin-top: 14px; align-items: flex-start; }
.inv-sum .tax { flex: 0 0 42%; }
.inv-sum .totals { flex: 1; }
.inv-sum table { width: 100%; border-collapse: collapse; }
.inv-sum th, .inv-sum td { border: 1px solid #000; padding: 5px 8px; }
.inv-sum .tax th { text-align: center; font-weight: 700; background: #faf3e2; }
.inv-sum .tax td { text-align: right; }
.inv-sum .tax td.center { text-align: center; }
.inv-sum .totals td.lbl { text-align: center; width: 55%; }
.inv-sum .totals td.val { text-align: right; }
.inv-sign { display: flex; justify-content: space-around; margin-top: 24px; text-align: center; gap: 24px; }
.inv-sign .col { flex: 1; }
.inv-sign .col .role { font-weight: 700; text-transform: uppercase; }
.inv-sign .col .note { font-style: italic; font-size: 12px; color: #333; margin-top: 4px; }
.inv-sigbox { display: inline-block; margin-top: 12px; padding: 8px 12px; border: 1px solid #1a8f2a;
  color: #1a8f2a; text-align: left; font-size: 12px; line-height: 1.4; }
.inv-sigbox .valid { font-weight: 700; }
.inv-foot { text-align: center; font-style: italic; margin-top: 18px; padding-top: 10px;
  border-top: 1px solid #c9a45c; }
`;

/** Escape ký tự đặc biệt HTML cho giá trị động (tên hàng, địa chỉ… có thể chứa &, <, >, ", '). */
function esc(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Ngày d tháng mm năm yyyy" từ chuỗi ISO; rỗng/không hợp lệ -> trả nguyên input. */
function invoiceDateLine(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `Ngày ${d.getDate()} tháng ${mm} năm ${d.getFullYear()}`;
}

/** 1 dòng "Nhãn: giá trị" (khối bên bán/mua). */
function line(label: string, value: string): string {
  return `<div class="line indent">${label}: ${esc(value)}</div>`;
}

/** 1 dòng "nhãn | tiền" trong bảng tổng cộng (nhãn là literal, không cần escape). */
function moneyRow(label: string, value: number | undefined): string {
  return `<tr><td class="lbl">${label}</td><td class="val">${esc(formatMoney(value))}</td></tr>`;
}

/**
 * Dựng HTML fragment `.inv-sheet` (khớp 1-1 với component `InvoiceSheet` JSX cũ). KHÔNG kèm CSS —
 * caller nhúng `INVOICE_CSS` (xem `standaloneInvoiceHtml` cho bản có CSS).
 */
export function renderInvoiceHtml(view: InvoiceView): string {
  const itemRows =
    view.items.length > 0
      ? view.items
          .map(
            (it, i) => `<tr>
      <td class="center">${it.tinhChat === "4" ? "" : i + 1}</td>
      <td>${esc(tinhChatLabel(it.tinhChat))}</td>
      <td>${esc(it.loaiDacTrung)}</td>
      <td>${esc(it.tenHang)}</td>
      <td class="center">${esc(it.dvt)}</td>
      <td class="num">${esc(formatMoney(it.soLuong))}</td>
      <td class="num">${esc(formatMoney(it.donGia))}</td>
      <td class="num">${esc(formatMoney(it.chietKhau))}</td>
      <td class="center">${esc(it.thueSuat)}</td>
      <td class="num">${esc(formatMoney(it.thanhTien))}</td>
    </tr>`,
          )
          .join("")
      : `<tr><td class="center" colspan="10">(Không có dòng hàng hóa)</td></tr>`;

  const taxRows =
    view.taxLines.length > 0
      ? view.taxLines
          .map(
            (t) => `<tr>
      <td class="center">${esc(t.thueSuat)}</td>
      <td>${esc(formatMoney(t.tienChuaThue))}</td>
      <td>${esc(formatMoney(t.tienThue))}</td>
    </tr>`,
          )
          .join("")
      : `<tr>
      <td class="center">${esc(view.items[0]?.thueSuat ?? "")}</td>
      <td>${esc(formatMoney(view.tongTienHang))}</td>
      <td>${esc(formatMoney(view.tongTienThue))}</td>
    </tr>`;

  return `<div class="inv-sheet">
  <div class="inv-head">
    <div style="min-width:170px"></div>
    <div class="inv-title">
      <h1>Hóa đơn giá trị gia tăng</h1>
      <div class="date">${esc(invoiceDateLine(view.ngayLap))}</div>
    </div>
    <div class="inv-meta">
      <div>Mẫu số: ${esc(view.mauSo)}</div>
      <div>Ký hiệu: ${esc(view.kyHieu)}</div>
      <div>Số: ${esc(view.soHd)}</div>
    </div>
  </div>
  ${view.maCqt ? `<div class="inv-cqt">Mã của cơ quan thuế: ${esc(view.maCqt)}</div>` : ""}
  <hr class="inv-rule" />
  <div class="inv-party">
    ${line("Tên người bán", view.seller.ten)}
    ${line("Mã số thuế", view.seller.mst)}
    ${line("Mã cửa hàng", view.seller.maCuaHang)}
    ${line("Tên cửa hàng", view.seller.tenCuaHang)}
    ${line("Địa chỉ", view.seller.diaChi)}
    ${line("Điện thoại", view.seller.dienThoai)}
    ${line("Số tài khoản", view.seller.soTaiKhoan)}
  </div>
  <hr class="inv-rule" />
  <div class="inv-party">
    ${line("Tên người mua", view.buyer.ten)}
    ${line("Họ tên người mua hàng", view.buyer.tenNguoiMua)}
    ${line("Mã số thuế", view.buyer.mst)}
    ${line("Mã ĐVCQHVNSNN", view.buyer.maDvqhns)}
    ${line("CCCD người mua", view.buyer.cccd)}
    ${line("Số hộ chiếu", view.buyer.hoChieu)}
    ${line("Địa chỉ", view.buyer.diaChi)}
    ${line("Số tài khoản", view.buyer.soTaiKhoan)}
    ${line("Hình thức thanh toán", view.hinhThucTt)}
    ${line("Đơn vị tiền tệ", view.maNt)}
    <div class="inv-two">
      <div class="line">Số bảng kê: ${esc(view.soBangKe)}</div>
      <div class="line">Ngày bảng kê: ${esc(view.ngayBangKe)}</div>
    </div>
  </div>
  <table class="inv-table">
    <thead>
      <tr>
        <th class="center">STT</th>
        <th class="center">Tính chất</th>
        <th>Loại hàng hóa đặc trưng</th>
        <th>Tên hàng hóa, dịch vụ</th>
        <th class="center">Đơn vị tính</th>
        <th class="num">Số lượng</th>
        <th class="num">Đơn giá</th>
        <th class="num">Chiết khấu</th>
        <th class="center">Thuế suất</th>
        <th class="num">Thành tiền chưa có thuế GTGT</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="inv-sum">
    <div class="tax">
      <table>
        <thead>
          <tr><th>Thuế suất</th><th>Tổng tiền chưa thuế</th><th>Tổng tiền thuế</th></tr>
        </thead>
        <tbody>${taxRows}</tbody>
      </table>
    </div>
    <div class="totals">
      <table>
        <tbody>
          ${moneyRow("Tổng tiền chưa thuế (Tổng cộng thành tiền chưa có thuế)", view.tongTienHang)}
          ${moneyRow("Tổng tiền thuế (Tổng cộng tiền thuế)", view.tongTienThue)}
          ${moneyRow("Tổng tiền phí", view.tongPhi)}
          ${moneyRow("Tổng tiền chiết khấu thương mại", view.tongChietKhau)}
          ${moneyRow("Tổng tiền thanh toán bằng số", view.tongThanhToan)}
          <tr><td class="lbl">Tổng tiền thanh toán bằng chữ</td><td class="val" style="text-align:left;font-style:italic">${esc(view.bangChu)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="inv-sign">
    <div class="col">
      <div class="role">Người mua hàng</div>
      <div class="note">(Chữ ký số (nếu có))</div>
    </div>
    <div class="col">
      <div class="role">Người bán hàng</div>
      <div class="note">(Chữ ký điện tử, chữ ký số)</div>
      ${
        view.ngayKy
          ? `<div class="inv-sigbox"><div class="valid">Signature Valid</div><div>Ký bởi: ${esc(
              view.seller.ten,
            )}</div><div>Ký ngày: ${esc(formatDateTimeVN(view.ngayKy))}</div></div>`
          : ""
      }
    </div>
  </div>
  <div class="inv-foot">(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)</div>
</div>`;
}

/**
 * Tài liệu HTML ĐỘC LẬP (có sẵn CSS) — cho file .html xuất ra, cho in (truyền `extraCss` @page), và
 * cho container offscreen render PDF.
 */
export function standaloneInvoiceHtml(view: InvoiceView, extraCss = ""): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Hóa đơn ${esc(view.soHd)}</title>` +
    `<style>${extraCss}${INVOICE_CSS}</style></head>` +
    `<body>${renderInvoiceHtml(view)}</body></html>`
  );
}
