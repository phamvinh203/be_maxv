/**
 * Tải file của MỘT hóa đơn về máy — nguồn cho hai cột thao tác "Tải file" / "Tải hóa đơn gốc" ở
 * bảng Tổng quát.
 *
 * Khác luồng theo lô (`exportBundle`, `DownloadOriginalDialog`) ở chỗ đích đến: một hóa đơn lẻ ghi
 * thẳng vào thư mục Tải xuống của trình duyệt, KHÔNG hỏi thư mục. File System Access chỉ có trên
 * Chrome/Edge, và bắt chọn thư mục cho đúng một file thì thao tác còn dài hơn việc nó tiết kiệm.
 *
 * Hai hàm dưới đây trả PDF của hai thứ KHÁC NHAU, đừng lẫn:
 *  - `taiPdfHoaDon`  -> tờ hóa đơn do phần mềm DỰNG từ chi tiết đã lưu (cùng bản với "Xem hóa đơn").
 *  - `taiPdfGoc`     -> BẢN GỐC tải từ cổng của NCC phát hành (Viettel/MISA…), qua BE proxy.
 */
import { getSavedInvoiceDetailById } from "./api/invoiceDetail";
import { taiHoaDonGoc, type DanhMucTraCuuGoc } from "./api/traCuuGoc";
import { invoiceToPdfBlob } from "./exportBundle";
import { loadInlineInvoiceAssets } from "./invoiceAssets";
import { invoiceFileBase } from "./invoiceFileName";
import { renderInvoiceHtml } from "./invoiceHtml";
import { toInvoiceView } from "./invoiceView";
import { traCuuNcc } from "./traCuuNcc";
import type { DisplayRow, InvoiceDirection } from "./types";
import { luuVeMay } from "../../lib/downloadFile";

export interface TaiMotHoaDonOpts {
  direction: InvoiceDirection;
  row: DisplayRow;
  /** Số thứ tự trong bảng Tổng quát — đứng đầu tên file, xem `invoiceFileBase`. */
  stt: number;
}

/**
 * Đọc chi tiết ĐÃ LƯU của hóa đơn. Bảng Tổng quát không nạp chi tiết (payload nặng, chỉ tab "Chi
 * tiết" mới nạp) nên mỗi lần bấm phải đọc riêng hóa đơn này.
 *
 * Ném lỗi có câu chữ dùng được ngay cho toast khi hóa đơn chưa tải chi tiết — kiểm ở đây thay vì
 * khóa nút ngoài bảng vì đây là chỗ DUY NHẤT biết chắc chi tiết có hay không.
 */
async function docChiTiet(direction: InvoiceDirection, id: string): Promise<Record<string, unknown>> {
  const { detail } = await getSavedInvoiceDetailById(direction, id);
  if (!detail) {
    throw new Error(
      'Hóa đơn chưa tải chi tiết — bấm "Tải chi tiết" ở thanh công cụ rồi tải lại file.',
    );
  }
  return detail;
}

/**
 * Tải tờ hóa đơn dạng PDF do phần mềm dựng. Đi qua ĐÚNG đường dựng của luồng xuất theo lô
 * (`invoiceToPdfBlob`) nên file tải lẻ và file trong thư mục xuất không thể khác nhau.
 */
export async function taiPdfHoaDon({ direction, row, stt }: TaiMotHoaDonOpts): Promise<void> {
  const detail = await docChiTiet(direction, row.id);
  const view = toInvoiceView(detail);
  if (!view) throw new Error("Không dựng được tờ hóa đơn từ chi tiết đã lưu.");
  // Ảnh nhúng base64: Chromium ở backend nhận HTML qua `setContent`, không có thư mục gốc nào để
  // phân giải đường dẫn ảnh tương đối.
  const assets = await loadInlineInvoiceAssets();
  const blob = await invoiceToPdfBlob(view, assets, renderInvoiceHtml(view));
  luuVeMay(blob, `${invoiceFileBase(stt, row.ngayLap, row.soHd, row.sellerMst)}.pdf`);
}

/**
 * Tải BẢN GỐC (PDF) từ cổng NCC phát hành. Mã tra cứu nằm trong chi tiết đã lưu (`traCuuNcc`), nên
 * hóa đơn chưa tải chi tiết thì chưa tải gốc được.
 *
 * Tên file thêm hậu tố `-goc`: bản dựng và bản gốc cùng rơi vào thư mục Tải xuống, trùng tên là
 * trình duyệt tự thêm "(1)" và không ai còn biết file nào là bản gốc.
 */
export async function taiPdfGoc({
  direction,
  row,
  stt,
  danhMucNcc,
}: TaiMotHoaDonOpts & { danhMucNcc?: DanhMucTraCuuGoc }): Promise<void> {
  const detail = await docChiTiet(direction, row.id);
  const maTraCuu = traCuuNcc(detail, danhMucNcc)?.maTraCuu;
  if (!maTraCuu) {
    throw new Error("Hóa đơn không có mã tra cứu trên cổng nhà cung cấp — không tải được bản gốc.");
  }
  const blob = await taiHoaDonGoc({
    msttcgp: row.msttcgp,
    code: maTraCuu,
    // Viettel cần MST người bán làm `supplierTaxCode`; NCC khác bỏ qua.
    sellerMst: row.sellerMst,
  });
  luuVeMay(blob, `${invoiceFileBase(stt, row.ngayLap, row.soHd, row.sellerMst)}-goc.pdf`);
}
