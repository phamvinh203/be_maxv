/**
 * Render "tờ hóa đơn GTGT" ra HTML THUẦN chuỗi — dùng CHUNG cho:
 *  - `InvoiceViewDialog` (xem trên màn hình qua dangerouslySetInnerHTML + in qua iframe),
 *  - xuất file .html/.pdf hàng loạt (nút "Xuất file tổng hợp + hóa đơn").
 * Nhờ 1 nguồn HTML duy nhất, bản xem/in/xuất giống hệt nhau. Mọi giá trị động escape qua `esc()`.
 *
 * BỐ CỤC bám theo `invoice.html` trong gói `export-xml` của cổng thuế (bản thể hiện chính thức do
 * nhà cung cấp HĐĐT phát hành): nền vân, khung viền kép nâu, danh sách "nhãn — giá trị" hai cột,
 * bảng hàng hóa, và ô chữ ký số xanh có dấu kiểm. Giữ tên class gần với bản gốc để đối chiếu dễ.
 */
import { formatMoney } from "./format";
import { formatDateTimeVN } from "./dateUtils";
import { tinhChatLabel, type InvoiceView } from "./invoiceView";
import { invoiceQrSvg } from "./invoiceQr";

/**
 * Nguồn 2 ảnh của tờ hóa đơn (nền vân + dấu kiểm trong ô chữ ký), lấy từ gói cổng thuế.
 * Đường dẫn phải đổi theo nơi HTML được đọc, nên truyền vào qua biến CSS thay vì viết cứng.
 */
export interface InvoiceAssets {
  /** Ảnh nền vân của tờ hóa đơn. */
  bg: string;
  /** Ảnh dấu kiểm trong ô chữ ký số. */
  sign: string;
}

/**
 * Khai báo 2 biến CSS trỏ tới ảnh. Tách khỏi `INVOICE_CSS` để cùng một bộ CSS dùng được cho cả ảnh
 * từ `public/`, ảnh cạnh file .html, lẫn ảnh nhúng base64 (PDF — tài liệu phải TỰ CHỨA vì Chromium
 * ở backend không có thư mục nào để tìm ảnh tương đối).
 */
export function invoiceAssetCss(assets: InvoiceAssets): string {
  return `.inv-sheet{--inv-bg:url("${assets.bg}");--inv-sign:url("${assets.sign}");}`;
}

/**
 * CSS "tờ hóa đơn" — mọi luật đều bám vào `.inv-sheet` để không rò ra giao diện ứng dụng. Nhúng qua
 * <style> khi xem, ghi vào iframe khi in, và vào tài liệu độc lập khi xuất file .html/.pdf.
 */
export const INVOICE_CSS = `
.inv-sheet { font-family: "Times New Roman", Times, serif; color: #000; font-size: 13pt;
  line-height: 1.5; }
.inv-sheet * { box-sizing: border-box; }
.inv-sheet .main-page { max-width: 210mm; margin: auto; padding: 20px 20px 10px; background: #fff;
  background-image: var(--inv-bg); background-repeat: no-repeat; background-position: center center;
  background-size: 180%; border: 3px double rgba(145, 87, 21, .69); }

.inv-sheet .top-content { display: flex; justify-content: space-between; }
/* Giữ chỗ cố định cho mã QR: hóa đơn không có QR vẫn phải cân bố cục như hóa đơn có.
   Nền trắng để vùng lặng của mã QR thật sự trắng — ô này nằm ngay trên ảnh nền vân. */
.inv-sheet .inv-qr { width: 80px; min-height: 20px; flex: 0 0 80px; }
.inv-sheet .inv-qr:not(:empty) { background: #fff; }
.inv-sheet .inv-qr svg { width: 80px; height: 80px; }
.inv-sheet .code-content { display: inline-block; text-align: left; }
.inv-sheet .main-title { font-size: 20pt; text-align: center; display: block; font-weight: bold;
  text-transform: uppercase; margin: .5em 0; }
/* Bản gốc dùng thẻ <p> nên có margin 1em — giữ nguyên khoảng thở đó. */
.inv-sheet .day { text-align: center; font-size: 13pt; margin: 1em 0; }
.inv-sheet .vip-divide { width: 100%; height: 0; border-bottom: 1px solid rgba(145, 87, 21, .69);
  margin: 8px 0; }

.inv-sheet .content-info { padding-top: 5px; }
.inv-sheet .list-fill-out { list-style: none; padding-inline-start: 0; margin: 5px 0; }
.inv-sheet .list-fill-out li { font-size: 13pt; }
.inv-sheet .flex-li { display: flex; }
.inv-sheet .data-item { width: 100%; display: flex; justify-content: left; align-items: flex-start;
  color: rgba(0, 0, 0, .85); margin-bottom: 10px; }
.inv-sheet .data-item .di-label { min-height: 25px; display: flex; align-items: flex-start;
  white-space: nowrap; }
.inv-sheet .data-item .di-value { flex: 1; min-height: 25px; display: flex; align-items: flex-start;
  padding-left: 5px; word-break: break-word; }

.inv-sheet .res-tb { border-collapse: collapse; border-spacing: 0; width: 100%; margin: 10px 0;
  min-width: 250px; }
.inv-sheet .res-tb tr td { border: 1px solid #000; padding: 6px 4px; vertical-align: baseline; }
.inv-sheet .res-tb thead tr th { border: 1px solid #000; padding: 6px 4px; vertical-align: middle;
  text-align: center; }
.inv-sheet .res-tb td.tx-center { text-align: center; }
.inv-sheet .res-tb td.tx-left { text-align: left; }
.inv-sheet .res-tb td.tx-right { text-align: right; }
.inv-sheet .res-tb th.tb-stt { width: 70px; }
.inv-sheet .res-tb th.tb-thh { width: 200px; }
.inv-sheet .res-tb th.tb-dvt { width: 100px; }
.inv-sheet .res-tb th.tb-sl, .inv-sheet .res-tb th.tb-dg, .inv-sheet .res-tb th.tb-ts { width: 80px; }
.inv-sheet .res-tb th.tb-ttct { width: 250px; }
.inv-sheet .table-horizontal-wrapper { display: flex; justify-content: space-between; gap: 10px;
  align-items: flex-start; }
/* Bảng thuế suất co theo nội dung, phần còn lại dồn cho bảng tổng cộng — nhãn ở đó dài, cột hẹp là
   xuống dòng 4 lần rồi đội chiều cao khối lên quá một trang. */
.inv-sheet .table-horizontal-wrapper > .tb-tax { flex: 0 1 auto; }
.inv-sheet .table-horizontal-wrapper > .tb-total { flex: 1 1 auto; min-width: 0; }
.inv-sheet .tb-sum-label { text-align: center; }
.inv-sheet .tb-sum-value { text-align: center; width: 40%; }

.inv-sheet .ft-sign { padding-top: 20px; }
.inv-sheet .sign-dx { display: flex; flex-wrap: wrap; justify-content: space-around;
  align-items: flex-start; }
.inv-sheet .sign-col { margin: 1em 0; }
.inv-sheet .sign-col p { text-align: center; font-size: 13pt; font-weight: 100; margin: 0 0 4px; }
.inv-sheet .sign-col p.sign-note { font-size: 14px; font-weight: normal; }
.inv-sheet .sign-box { width: 260px; padding: 5px; border: 2px solid #23b709;
  background-image: var(--inv-sign); background-repeat: no-repeat;
  background-position: right 45px bottom 10px; background-size: 70px 60px; margin-top: 10px;
  font-weight: 500; }
.inv-sheet .sign-box span { color: #23b709; font-size: 13pt; text-align: left; display: block; }
.inv-sheet .sign-box span.span-sign-box { display: inline; }
.inv-sheet .fd-end { padding-top: 120px; text-align: center; }

/* Khi IN / render PDF — bám theo @media print của bản gốc, TRỪ một điểm: bản gốc bỏ luôn nền và
   viền khi in, ở đây giữ lại để bản PDF lưu trữ trông đúng như bản xem trên màn hình. */
@media print {
  .inv-sheet, .inv-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .inv-sheet .main-page { margin: 0; max-width: initial; }
  /* Khoảng đệm 120px trước dòng cuối chỉ để trang web trông thoáng — khi in nó đẩy hẳn sang tờ mới. */
  .inv-sheet .fd-end { padding-top: 0; }
  .inv-sheet .res-tb tr, .inv-sheet .res-tb td { page-break-inside: avoid; }
  .inv-sheet .res-tb thead { display: table-row-group; }
  .inv-sheet .table-horizontal-wrapper, .inv-sheet .ft-sign { page-break-inside: avoid; }
}
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

/**
 * "Ngày d tháng mm năm yyyy" từ chuỗi ISO. Cắt trực tiếp phần `yyyy-MM-dd` thay vì qua `new Date`:
 * ngày lập là dữ liệu trên CHỨNG TỪ, không được đổi theo múi giờ máy đang mở file.
 * Rỗng/không đúng dạng -> trả nguyên input.
 */
function invoiceDateLine(iso: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `Ngày ${Number(dd)} tháng ${mm} năm ${y}`;
}

/**
 * Ô "nhãn — giá trị" của khối thông tin bên bán/bên mua. `valueHtml` phải ĐÃ ESCAPE (có chỗ cần
 * chèn `&nbsp;` thô nên không escape hộ ở đây được).
 */
function dataItem(label: string, valueHtml: string, style = ""): string {
  return `<div class="data-item"${style ? ` style="${style}"` : ""}>` +
    `<div class="di-label"><span>${label}:</span></div>` +
    `<div class="di-value"><div>${valueHtml}</div></div></div>`;
}

/** 1 dòng "Nhãn: giá trị" trong khối thông tin bên bán/bên mua. */
function line(label: string, value: string): string {
  return `<li>${dataItem(label, esc(value))}</li>`;
}

/**
 * Dòng "Số tài khoản" — bản gốc in tên ngân hàng ngay sau số, cách bằng khoảng trắng cứng
 * ("170001060004839   Bắc Á"). Không có tên ngân hàng thì chỉ in số như một dòng thường.
 */
function bankLine(soTaiKhoan: string, tenNganHang: string): string {
  const value = tenNganHang
    ? `${esc(soTaiKhoan)}&nbsp;&nbsp;&nbsp;${esc(tenNganHang)}`
    : esc(soTaiKhoan);
  return `<li>${dataItem("Số tài khoản", value)}</li>`;
}

/** 1 dòng "nhãn | giá trị" trong bảng tổng cộng. `valueHtml` phải ĐÃ ESCAPE. */
function sumRow(label: string, valueHtml: string): string {
  return `<tr><td class="tx-center tb-sum-label">${label}</td>` +
    `<td class="tx-center tb-sum-value">${valueHtml}</td></tr>`;
}

/** 1 dòng "nhãn | tiền" trong bảng tổng cộng (nhãn là literal, không cần escape). */
function moneyRow(label: string, value: number | undefined): string {
  return sumRow(label, esc(formatMoney(value)));
}

/**
 * Dựng HTML fragment `.inv-sheet`. KHÔNG kèm CSS — caller nhúng `INVOICE_CSS` + `invoiceAssetCss`
 * (xem `standaloneInvoiceHtml` cho bản có sẵn cả hai).
 */
export function renderInvoiceHtml(view: InvoiceView): string {
  const itemRows =
    view.items.length > 0
      ? view.items
          .map(
            (it, i) => `<tr>
      <td class="tx-center">${it.tinhChat === "4" ? "" : i + 1}</td>
      <td class="tx-left"><span>${esc(tinhChatLabel(it.tinhChat))}</span></td>
      <td class="tx-left" style="max-width:200px;word-wrap:break-word">${esc(it.loaiDacTrung)}</td>
      <td class="tx-left">${esc(it.tenHang)}</td>
      <td class="tx-left">${esc(it.dvt)}</td>
      <td class="tx-center">${esc(formatMoney(it.soLuong))}</td>
      <td class="tx-center">${esc(formatMoney(it.donGia))}</td>
      <td class="tx-center">${esc(formatMoney(it.chietKhau))}</td>
      <td class="tx-center">${esc(it.thueSuat)}</td>
      <td class="tx-center">${esc(formatMoney(it.thanhTien))}</td>
    </tr>`,
          )
          .join("")
      : `<tr><td class="tx-center" colspan="10">(Không có dòng hàng hóa)</td></tr>`;

  // Thiếu bảng tổng hợp theo thuế suất -> để trống ô thuế suất. KHÔNG lấy thuế suất của dòng đầu
  // làm đại diện: hóa đơn nhiều mức thuế sẽ hiện một con số SAI bên cạnh tổng tiền đúng.
  const taxRows =
    view.taxLines.length > 0
      ? view.taxLines
          .map(
            (t) => `<tr>
      <td class="tx-center">${esc(t.thueSuat)}</td>
      <td class="tx-center">${esc(formatMoney(t.tienChuaThue))}</td>
      <td class="tx-center">${esc(formatMoney(t.tienThue))}</td>
    </tr>`,
          )
          .join("")
      : `<tr>
      <td class="tx-center"></td>
      <td class="tx-center">${esc(formatMoney(view.tongTienHang))}</td>
      <td class="tx-center">${esc(formatMoney(view.tongTienThue))}</td>
    </tr>`;

  return `<div class="inv-sheet">
  <div class="main-page">
    <div class="heading-content">
      <div class="top-content">
        <div class="inv-qr">${invoiceQrSvg(view.qrData)}</div>
        <div class="code-content">
          <b>Mẫu số: ${esc(view.mauSo)}</b><br />
          <b>Ký hiệu: ${esc(view.kyHieu)}</b><br />
          <b>Số: ${esc(view.soHd)}</b>
        </div>
      </div>
      <div class="title-heading">
        <div class="main-title">Hóa đơn giá trị gia tăng</div>
        <div class="day">${esc(invoiceDateLine(view.ngayLap))}</div>
        ${view.maCqt ? `<div class="day">MCCQT: ${esc(view.maCqt)}</div>` : ""}
      </div>
    </div>
    <div class="vip-divide"></div>
    <div class="content-info">
      <ul class="list-fill-out">
        ${line("Tên người bán", view.seller.ten)}
        ${line("Mã số thuế", view.seller.mst)}
        ${line("Mã cửa hàng", view.seller.maCuaHang)}
        ${line("Tên cửa hàng", view.seller.tenCuaHang)}
        ${line("Địa chỉ", view.seller.diaChi)}
        ${line("Điện thoại", view.seller.dienThoai)}
        ${bankLine(view.seller.soTaiKhoan, view.seller.tenNganHang)}
        <li><div class="vip-divide" style="margin:5px 0"></div></li>
        ${line("Tên người mua", view.buyer.ten)}
        ${line("Họ tên người mua", view.buyer.tenNguoiMua)}
        ${line("Mã số thuế", view.buyer.mst)}
        ${line("Mã ĐVCQHVNSNN", view.buyer.maDvqhns)}
        ${line("CCCD người mua", view.buyer.cccd)}
        ${line("Số hộ chiếu", view.buyer.hoChieu)}
        ${line("Địa chỉ", view.buyer.diaChi)}
        ${bankLine(view.buyer.soTaiKhoan, view.buyer.tenNganHang)}
        ${line("Hình thức thanh toán", view.hinhThucTt)}
        ${line("Đơn vị tiền tệ", view.maNt)}
        <li class="flex-li">
          ${dataItem("Số bảng kê", esc(view.soBangKe), "width:50%")}
          ${dataItem("Ngày bảng kê", esc(view.ngayBangKe), "width:50%")}
        </li>
      </ul>
      <table class="res-tb">
        <thead>
          <tr>
            <th class="tb-stt">STT</th>
            <th class="tb-stt">Tính chất</th>
            <th class="tb-stt">Loại hàng hoá đặc trưng</th>
            <th class="tb-thh">Tên hàng hóa, dịch vụ</th>
            <th class="tb-dvt">Đơn vị tính</th>
            <th class="tb-sl">Số lượng</th>
            <th class="tb-dg">Đơn giá</th>
            <th class="tb-dg">Chiết khấu</th>
            <th class="tb-ts">Thuế suất</th>
            <th class="tb-ttct">Thành tiền chưa có thuế GTGT</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="table-horizontal-wrapper">
        <div class="tb-tax">
          <table class="res-tb">
            <thead>
              <tr><th>Thuế suất</th><th>Tổng tiền chưa thuế</th><th>Tổng tiền thuế</th></tr>
            </thead>
            <tbody>${taxRows}</tbody>
          </table>
        </div>
        <div class="tb-total">
          <table class="res-tb">
            <tbody>
              ${moneyRow("Tổng tiền chưa thuế<br />(Tổng cộng thành tiền chưa có thuế)", view.tongTienHang)}
              ${moneyRow("Tổng tiền thuế (Tổng cộng tiền thuế)", view.tongTienThue)}
              ${moneyRow("Tổng tiền phí", view.tongPhi)}
              ${moneyRow("Tổng tiền chiết khấu thương mại", view.tongChietKhau)}
              ${moneyRow("Tổng tiền thanh toán bằng số", view.tongThanhToan)}
              ${sumRow("Tổng tiền thanh toán bằng chữ", esc(view.bangChu))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="vip-divide"></div>
    <div class="ft-sign">
      <div class="sign-dx">
        <div class="sign-col">
          <p>NGƯỜI MUA HÀNG</p>
          <p class="sign-note"><i>(Chữ ký số (nếu có))</i></p>
        </div>
        <div class="sign-col">
          <p>NGƯỜI BÁN HÀNG</p>
          <p class="sign-note"><i>(Chữ ký điện tử, chữ ký số)</i></p>
          ${
            view.ngayKy
              ? `<div class="sign-box">
            <span>Signature Valid</span>
            <span class="span-sign-box">Ký bởi:&nbsp;</span><span class="span-sign-box">${esc(
              view.seller.ten,
            )}</span>
            <span class="span-sign-box">Ký ngày:&nbsp;</span><span class="span-sign-box">${esc(
              formatDateTimeVN(view.ngayKy),
            )}</span>
          </div>`
              : ""
          }
        </div>
      </div>
      <div class="fd-end"><p><i>(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)</i></p></div>
    </div>
  </div>
</div>`;
}

/** Quy tắc khổ giấy dùng chung cho bản IN và bản render PDF — hai đích phải khớp lề. */
export const PRINT_PAGE_CSS = "@page{margin:8mm;}body{margin:0;}";

/** Tùy chọn dựng tài liệu HTML độc lập. */
export interface StandaloneHtmlOptions {
  /** Nguồn 2 ảnh — BẮT BUỘC: mỗi đích một nguồn khác nhau, không có mặc định nào an toàn cho cả ba. */
  assets: InvoiceAssets;
  /** CSS thêm (vd `PRINT_PAGE_CSS` khi in / render PDF). */
  extraCss?: string;
  /**
   * Thân tờ hóa đơn đã dựng sẵn, để KHÔNG phải dựng lại. Một hóa đơn tick cả HTML và PDF cần hai
   * tài liệu chỉ khác nhau ở khối CSS ảnh; dựng lại thân là sinh lại cả mã QR (đo được ~10ms CPU
   * đồng bộ + ~31KB chuỗi cho mỗi lần) một cách vô ích.
   */
  body?: string;
}

/**
 * Tài liệu HTML ĐỘC LẬP (có sẵn CSS) — cho file .html xuất ra, cho in (truyền `extraCss`), và cho
 * backend render PDF. Ảnh lấy theo `assets`: bản xem/in dùng ảnh từ `public/`, file .html xuất ra
 * dùng ảnh cạnh file, PDF phải dùng ảnh nhúng base64 (Chromium ở backend không có thư mục nào để
 * tìm ảnh tương đối).
 */
export function standaloneInvoiceHtml(view: InvoiceView, opts: StandaloneHtmlOptions): string {
  const { extraCss = "", assets, body } = opts;
  return (
    `<!doctype html><html lang="vi"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
    `<title>Hóa đơn ${esc(view.soHd)}</title>` +
    `<style>${extraCss}${INVOICE_CSS}${invoiceAssetCss(assets)}</style></head>` +
    `<body>${body ?? renderInvoiceHtml(view)}</body></html>`
  );
}
