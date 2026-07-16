/**
 * Orchestrator nút "Xuất file tổng hợp + hóa đơn": đọc HĐ đã lưu + chi tiết trong khoảng, sinh 1 file
 * Excel tổng hợp (2 sheet) + file từng hóa đơn (HTML/XML/PDF theo ô tick), rồi GHI thẳng vào thư mục
 * người dùng chọn qua File System Access API (Chrome/Edge). Thuần frontend — không gọi GDT ở đây.
 */
import { getSavedInvoices } from "./api/gdt";
import { getSavedDetails, renderInvoicePdf } from "./api/invoiceDetail";
import { toDisplayRow } from "./invoiceRow";
import { toDetailRows } from "./detailRow";
import { toInvoiceView, type InvoiceView } from "./invoiceView";
import { standaloneInvoiceHtml } from "./invoiceHtml";
import { buildInvoiceXml } from "./invoiceXml";
import {
  buildSummaryWorkbookBuffer,
  summaryWorkbookFilename,
  type ExportRange,
} from "./exportXlsx";
import type { InvoiceDirection, InvoiceQuery } from "./types";
import { type FsDirHandle, writeFile } from "../../lib/fileSystemAccess";

/** Bỏ ký tự không hợp lệ trong tên file (Windows/khác), gộp khoảng trắng. */
function safeName(raw: string): string {
  return (raw || "hoa-don").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
}

/**
 * Render 1 tờ hóa đơn ra PDF VECTOR: gửi HTML tờ hóa đơn (tự chứa) lên BE, Chromium headless
 * (puppeteer) render -> PDF chuẩn (chữ nét, chọn/tìm được). Thay cách cũ dùng html2canvas (ảnh raster
 * mờ + dính lỗi màu oklch của app).
 */
async function invoiceToPdfBlob(view: InvoiceView): Promise<Blob> {
  return renderInvoicePdf(standaloneInvoiceHtml(view, "body{margin:0;background:#fff;}"));
}

export interface ExportFormats {
  html: boolean;
  xml: boolean;
  pdf: boolean;
}

export interface ExportBundleOptions {
  /** MST người nhập -> tên folder GỐC. */
  mst: string;
  /** Khoảng ngày + bộ lọc (loại HĐ) — dùng CHUNG cho cả 2 chiều. */
  query: InvoiceQuery;
  range: ExportRange;
  formats: ExportFormats;
  dir: FsDirHandle;
  /** Báo tiến độ theo SỐ HÓA ĐƠN đã sinh file (0..total, gộp cả 2 chiều). */
  onProgress?: (done: number, total: number) => void;
}

export interface ExportBundleResult {
  /** Số hóa đơn có chi tiết để xuất (gộp 2 chiều). */
  total: number;
  /** Số hóa đơn xuất được (mọi định dạng đã tick). */
  ok: number;
  /** Số hóa đơn lỗi khi sinh file (bỏ qua, không kẹt cả lượt). */
  err: number;
  /** Thông báo lỗi ĐẦU TIÊN gặp phải (để FE hiện thay vì nuốt im lặng). */
  firstError?: string;
  /** true nếu 1 chiều chạm trần đọc DB (có thể còn HĐ chưa xuất) -> FE cảnh báo thu hẹp khoảng ngày. */
  truncated?: boolean;
}

/** Trần số dòng BE trả 1 lần (khớp MAX_SAVED_ROWS ở getSavedInvoices) — chạm trần = có thể còn HĐ. */
const EXPORT_ROW_CAP = 1000;

/** Tên folder khoảng ngày: "tu-<từ>-den-<đến>". */
function rangeFolderName(range: ExportRange): string {
  return `tu-${range.tuNgay}-den-${range.denNgay}`;
}

/**
 * Số hóa đơn xử lý ĐỒNG THỜI — khớp `MAX_CONCURRENT_RENDERS` ở BE (pdfRenderer): mỗi PDF là 1 round-trip
 * tới puppeteer. Đúng bằng cap BE để lấp đủ 2 slot mà KHÔNG xếp hàng thừa trên semaphore (tránh chạm
 * timeout 60s/HĐ khi bị nghẽn).
 */
const PDF_CONCURRENCY = 2;

/** 1 hóa đơn cần ghi ra file, kèm sẵn các thư mục con {html,xml,pdf} (null nếu định dạng không tick). */
interface InvoiceFileTask {
  direction: InvoiceDirection;
  view: InvoiceView;
  htmlDir: FsDirHandle | null;
  xmlDir: FsDirHandle | null;
  pdfDir: FsDirHandle | null;
}

/** Chạy `worker` trên `items` với tối đa `limit` việc đồng thời (bounded pool, không phụ thuộc lib ngoài). */
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    // `next++` đọc + tăng trong 1 tick (không await xen giữa) nên mỗi runner lấy 1 index riêng — an toàn.
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(runners);
}

/**
 * Chạy lượt xuất CẢ 2 CHIỀU vào cấu trúc:
 *   <MST người nhập>/<khoảng ngày>/
 *     purchase/{html,xml,pdf}/<ký hiệu>-<số HĐ>.<ext>
 *     sold/{html,xml,pdf}/...
 *     Tong-hop-dau-vao-<khoảng>.xlsx
 *     Tong-hop-dau-ra-<khoảng>.xlsx
 * Bỏ qua + đếm lỗi từng hóa đơn (không kẹt cả lượt). Trả số liệu tổng kết để FE toast.
 */
export async function exportInvoiceBundle(opts: ExportBundleOptions): Promise<ExportBundleResult> {
  const { mst, query, range, formats, dir, onProgress } = opts;
  const directions: InvoiceDirection[] = ["purchase", "sold"];
  const anyFormat = formats.html || formats.xml || formats.pdf;

  // Folder gốc: <MST>/<khoảng ngày>/
  const mstDir = await dir.getDirectoryHandle(safeName(mst || "khong-ro-mst"), { create: true });
  const rangeDir = await mstDir.getDirectoryHandle(safeName(rangeFolderName(range)), {
    create: true,
  });

  // Đọc dữ liệu 2 chiều (song song) trước để biết tổng số HĐ cho progress.
  const perDir = await Promise.all(
    directions.map(async (direction) => {
      const [saved, details] = await Promise.all([
        getSavedInvoices(direction, query),
        getSavedDetails(direction, query),
      ]);
      const views = details
        .map((d) => toInvoiceView(d))
        .filter((v): v is InvoiceView => v !== null);
      return { direction, saved, details, views };
    }),
  );

  const total = perDir.reduce((s, d) => s + d.views.length, 0);
  // Chạm trần đọc DB ở BẤT KỲ chiều nào -> có thể còn HĐ chưa lấy về (getSavedInvoices/getSavedDetails
  // đều cắt ở EXPORT_ROW_CAP). Cảnh báo để người dùng thu hẹp khoảng ngày.
  const truncated = perDir.some(
    (d) => (d.saved.datas?.length ?? 0) >= EXPORT_ROW_CAP || d.details.length >= EXPORT_ROW_CAP,
  );
  let ok = 0;
  let err = 0;
  let firstError = "";
  let done = 0;

  // Setup TỪNG CHIỀU (tuần tự): ghi Excel + tạo thư mục con {html,xml,pdf} 1 lần, rồi gom task từng HĐ.
  const tasks: InvoiceFileTask[] = [];
  for (const { direction, saved, details, views } of perDir) {
    const overviewRows = (saved.datas ?? []).map((r) => toDisplayRow(r, direction));
    const detailRows = details.flatMap(toDetailRows);
    const buffer = await buildSummaryWorkbookBuffer(overviewRows, detailRows, direction);
    await writeFile(rangeDir, summaryWorkbookFilename(direction, range), buffer);

    if (!anyFormat || views.length === 0) continue;

    // <khoảng>/<chiều>/{html,xml,pdf}/
    const dirDir = await rangeDir.getDirectoryHandle(direction, { create: true });
    const htmlDir = formats.html ? await dirDir.getDirectoryHandle("html", { create: true }) : null;
    const xmlDir = formats.xml ? await dirDir.getDirectoryHandle("xml", { create: true }) : null;
    const pdfDir = formats.pdf ? await dirDir.getDirectoryHandle("pdf", { create: true }) : null;
    for (const view of views) tasks.push({ direction, view, htmlDir, xmlDir, pdfDir });
  }

  // Sinh + ghi file từng HĐ với tối đa PDF_CONCURRENCY việc đồng thời (lấp đủ 2 slot render PDF của BE).
  // Files độc lập (tên có MST bán) nên thứ tự không quan trọng; counters ++ an toàn (JS 1 luồng).
  await runPool(tasks, PDF_CONCURRENCY, async (t) => {
    // Gắn MST người bán để KHÔNG trùng tên: chiều mua vào gộp HĐ của nhiều người bán, `kyHieu-soHd`
    // chỉ unique theo từng người bán -> thiếu MST sẽ ghi đè lẫn nhau (mất file).
    const base = safeName(`${t.view.seller.mst}-${t.view.kyHieu}-${t.view.soHd}`);
    try {
      if (t.htmlDir) await writeFile(t.htmlDir, `${base}.html`, standaloneInvoiceHtml(t.view));
      if (t.xmlDir) await writeFile(t.xmlDir, `${base}.xml`, buildInvoiceXml(t.view));
      if (t.pdfDir) await writeFile(t.pdfDir, `${base}.pdf`, await invoiceToPdfBlob(t.view));
      ok += 1;
    } catch (e) {
      // 1 hóa đơn lỗi -> bỏ qua; KHÔNG nuốt im lặng: log + giữ lỗi đầu tiên để FE hiện.
      err += 1;
      const msg = e instanceof Error ? e.message : String(e);
      if (!firstError) firstError = msg;
      console.error(
        `[exportBundle] Lỗi xuất hóa đơn ${t.direction}/${base} | message: ${msg}\n`,
        e instanceof Error ? e.stack : e,
      );
    }
    done += 1;
    onProgress?.(done, total);
  });

  return { total, ok, err, firstError: firstError || undefined, truncated };
}
