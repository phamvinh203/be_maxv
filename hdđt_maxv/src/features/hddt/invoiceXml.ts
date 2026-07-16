/**
 * Dựng XML "thể hiện dữ liệu" của 1 hóa đơn từ `InvoiceView` (bản dựng lại từ chi tiết đã đồng bộ —
 * KHÔNG phải bản XML ký số gốc của Tổng cục Thuế). Dùng cho nút "Xuất file tổng hợp + hóa đơn".
 * Cấu trúc phẳng, dễ đối chiếu; nếu sau cần chuẩn TĐiệp ký số thì phải lấy bản gốc từ GDT.
 */
import type { InvoiceView } from "./invoiceView";

/**
 * Bỏ ký tự điều khiển C0 bị cấm trong XML 1.0 (mã dưới 0x20, trừ 0x09 tab / 0x0A LF / 0x0D CR).
 * Duyệt theo mã ký tự để KHÔNG viết ký tự điều khiển thô trong regex/nguồn.
 */
function stripXmlCtrl(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) out += ch;
  }
  return out;
}

/** Escape ký tự đặc biệt XML + lọc ký tự điều khiển cấm. */
function xesc(v: string): string {
  return stripXmlCtrl(String(v))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 1 phần tử `<Ten>giá trị</Ten>`; rỗng/undefined -> thẻ tự đóng `<Ten/>`. */
function tag(name: string, value: string | number | undefined): string {
  if (value === undefined || value === "") return `<${name}/>`;
  return `<${name}>${xesc(String(value))}</${name}>`;
}

export function buildInvoiceXml(view: InvoiceView): string {
  const items = view.items
    .map(
      (it, i) =>
        `    <Dong STT="${i + 1}">` +
        tag("TinhChat", it.tinhChat) +
        tag("Ten", it.tenHang) +
        tag("DVT", it.dvt) +
        tag("SoLuong", it.soLuong) +
        tag("DonGia", it.donGia) +
        tag("ChietKhau", it.chietKhau) +
        tag("ThueSuat", it.thueSuat) +
        tag("ThanhTien", it.thanhTien) +
        `</Dong>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<HoaDon>
  <TieuDe>
    ${tag("MauSo", view.mauSo)}
    ${tag("KyHieu", view.kyHieu)}
    ${tag("SoHD", view.soHd)}
    ${tag("NgayLap", view.ngayLap)}
    ${tag("NgayKy", view.ngayKy)}
    ${tag("MaCQT", view.maCqt)}
    ${tag("HinhThucTT", view.hinhThucTt)}
    ${tag("DonViTienTe", view.maNt)}
    ${tag("TyGia", view.tyGia)}
  </TieuDe>
  <BenBan>
    ${tag("Ten", view.seller.ten)}
    ${tag("MST", view.seller.mst)}
    ${tag("DiaChi", view.seller.diaChi)}
    ${tag("DienThoai", view.seller.dienThoai)}
    ${tag("SoTaiKhoan", view.seller.soTaiKhoan)}
  </BenBan>
  <BenMua>
    ${tag("Ten", view.buyer.ten)}
    ${tag("NguoiMua", view.buyer.tenNguoiMua)}
    ${tag("MST", view.buyer.mst)}
    ${tag("DiaChi", view.buyer.diaChi)}
    ${tag("CCCD", view.buyer.cccd)}
    ${tag("SoTaiKhoan", view.buyer.soTaiKhoan)}
  </BenMua>
  <HangHoa>
${items}
  </HangHoa>
  <TongHop>
    ${tag("TongTienChuaThue", view.tongTienHang)}
    ${tag("TongTienThue", view.tongTienThue)}
    ${tag("TongPhi", view.tongPhi)}
    ${tag("TongChietKhau", view.tongChietKhau)}
    ${tag("TongThanhToan", view.tongThanhToan)}
    ${tag("BangChu", view.bangChu)}
  </TongHop>
</HoaDon>`;
}
