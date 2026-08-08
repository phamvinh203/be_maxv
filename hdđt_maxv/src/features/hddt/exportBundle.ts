/**
 * Orchestrator nút "Xuất file tổng hợp + hóa đơn": đọc HĐ đã lưu + chi tiết trong khoảng, sinh file
 * Excel tổng hợp (2 sheet) và/hoặc file từng hóa đơn (HTML/XML/PDF) — MỖI PHẦN theo ô tick riêng —
 * rồi GHI thẳng vào thư mục người dùng chọn qua File System Access API (Chrome/Edge).
 *
 * HTML/PDF dựng tại chỗ từ chi tiết đã lưu; riêng XML là BẢN GỐC ĐÃ KÝ SỐ tải từ cổng thuế qua BE
 * (`fetchOriginalInvoiceXml`) — nên lượt xuất có tick XML cần token GDT còn hạn.
 */
import { getSavedInvoices } from "./api/gdt";
import { getSavedDetails, renderInvoicePdf, fetchOriginalInvoiceXml } from "./api/invoiceDetail";
import { toDisplayRow } from "./invoiceRow";
import { buildReplacedByMap, toDetailRows } from "./detailRow";
import { toInvoiceView, type InvoiceView } from "./invoiceView";
import {
  renderInvoiceHtml,
  standaloneInvoiceHtml,
  PRINT_PAGE_CSS,
  type InvoiceAssets,
} from "./invoiceHtml";
import {
  INVOICE_ASSET_FILES,
  RELATIVE_INVOICE_ASSETS,
  loadInvoiceAssetBlobs,
  loadInlineInvoiceAssets,
} from "./invoiceAssets";
import { readOriginalXmlExtras } from "./invoiceOriginalXml";
import { invoiceFileBase, invoiceKey, invoiceSttMap, safeName } from "./invoiceFileName";
import {
  buildSummaryWorkbookBuffer,
  summaryWorkbookFilename,
  type ExportRange,
} from "./exportXlsx";
import type { InvoiceDirection, InvoiceQuery } from "./types";
import {
  type FsDirHandle,
  writeFile,
  readFileText,
  readFileBytes,
} from "../../lib/fileSystemAccess";
import { ApiError } from "../../lib/http";
import { runPool } from "../../lib/pool";

/**
 * Khóa định danh hóa đơn dựng từ payload chi tiết GDT thô (field kiểu `unknown`, `khmshdon`/`shdon`
 * có khi là số) — để tra số thứ tự trong bảng Tổng quát. Cùng bộ field với `DisplayRow`, chỉ khác
 * chỗ ở đây phải tự ép kiểu.
 */
function detailInvoiceKey(detail: Record<string, unknown>): string {
  const str = (v: unknown): string => (v == null ? "" : String(v));
  return invoiceKey(
    str(detail.khmshdon),
    str(detail.khhdon),
    str(detail.shdon),
    str(detail.nbmst),
  );
}

/**
 * Render 1 tờ hóa đơn ra PDF VECTOR: gửi HTML tờ hóa đơn (tự chứa) lên BE, Chromium headless
 * (puppeteer) render -> PDF chuẩn (chữ nét, chọn/tìm được). Thay cách cũ dùng html2canvas (ảnh raster
 * mờ + dính lỗi màu oklch của app).
 *
 * `assets` phải là ảnh nhúng base64: Chromium nhận HTML qua `setContent`, không có thư mục gốc nào
 * để phân giải đường dẫn ảnh tương đối -> nền và dấu chữ ký sẽ mất nếu trỏ đường dẫn thường.
 * `body` là thân tờ hóa đơn đã dựng, dùng lại từ bước ghi .html (xem `processTask`).
 */
async function invoiceToPdfBlob(
  view: InvoiceView,
  assets: InvoiceAssets,
  body: string,
): Promise<Blob> {
  return renderInvoicePdf(
    standaloneInvoiceHtml(view, {
      extraCss: `${PRINT_PAGE_CSS}body{background:#fff;}`,
      assets,
      body,
    }),
  );
}

/**
 * Định dạng file TỪNG tờ hóa đơn (ghi cho mỗi hóa đơn). Excel tổng hợp KHÔNG nằm ở đây — nó là bảng
 * kê per-chiều, ghi một lần, nên mọi cấu trúc theo dõi per-tờ (pending/failed) chỉ xoay quanh 3 định
 * dạng này.
 */
export type InvoiceFileFormat = "html" | "xml" | "pdf";

export interface ExportFormats {
  html: boolean;
  xml: boolean;
  pdf: boolean;
  /** Bảng kê Excel tổng hợp 2 chiều (mua vào + bán ra). Độc lập với file từng hóa đơn ở trên. */
  excel: boolean;
}

/** Tiến độ lượt xuất — phân biệt pha chính với các vòng vá lại hóa đơn còn thiếu file. */
export interface ExportProgress {
  done: number;
  /** Số hóa đơn của LƯỢT NÀY: pha chính = tổng; vòng vá = số hóa đơn còn thiếu file. */
  total: number;
  /** 0 = pha chính; ≥1 = vòng vá lại thứ mấy. */
  round: number;
}

export interface ExportBundleOptions {
  /** MST người nhập -> tên folder GỐC. */
  mst: string;
  /** Khoảng ngày + bộ lọc (loại HĐ) — dùng CHUNG cho cả 2 chiều. */
  query: InvoiceQuery;
  range: ExportRange;
  formats: ExportFormats;
  dir: FsDirHandle;
  /** Token GDT — BẮT BUỘC khi tick XML (bản gốc ký số lấy từ cổng thuế). */
  gdtToken?: string;
  /** Báo tiến độ theo SỐ HÓA ĐƠN đã sinh file (gộp cả 2 chiều). */
  onProgress?: (p: ExportProgress) => void;
}

/** Số FILE không xuất được, tách theo định dạng — biết lỗi nằm ở khâu nào. */
export type ExportFailedCount = Record<InvoiceFileFormat, number>;

export interface ExportBundleResult {
  /** Số hóa đơn có chi tiết để xuất (gộp 2 chiều). */
  total: number;
  /** Số hóa đơn ra ĐỦ mọi định dạng đã tick. */
  ok: number;
  /** Số hóa đơn VẪN thiếu ít nhất 1 định dạng sau khi đã vá lại hết số vòng cho phép. */
  err: number;
  failed: ExportFailedCount;
  /** Số hóa đơn lỗi ở pha chính nhưng VÁ LẠI THÀNH CÔNG — để người dùng biết đã tự khắc phục. */
  recovered: number;
  /**
   * Số hóa đơn KHÔNG CÓ XML gốc trên cổng thuế (BE trả 410) — không phải lỗi, không nằm trong `err`.
   * Tách ra để FE nói rõ thay vì để người dùng tưởng thiếu file rồi chạy lại cả lượt vô ích.
   */
  noOriginalXml: number;
  /**
   * Số hóa đơn đã vào FILE PDF GỘP (cộng cả 2 chiều). 0 = không tick PDF, hoặc bước gộp hỏng —
   * các file PDF lẻ vẫn còn nguyên trên đĩa.
   */
  mergedPdf: number;
  /** Số vòng vá đã chạy (0 = pha chính xong xuôi, không cần vá). */
  retryRounds: number;
  /** Lỗi của hóa đơn ĐẦU TIÊN còn thiếu file (để FE hiện thay vì nuốt im lặng). */
  firstError?: string;
  /** Token GDT hết hạn giữa chừng -> dừng gọi cổng thuế, không vá lại được nữa. */
  authExpired?: boolean;
}

/** Tên folder khoảng ngày: "tu-<từ>-den-<đến>". */
function rangeFolderName(range: ExportRange): string {
  return `tu-${range.tuNgay}-den-${range.denNgay}`;
}

/**
 * Tên file PDF GỘP, đặt ngay trong thư mục `pdf/` cạnh các file lẻ. Mở đầu bằng `0.` để nằm TRƯỚC
 * `1.`, `2.`… — nhìn thấy ngay khi mở thư mục, thay vì lẫn vào cuối danh sách.
 * Vẫn ghi rõ chiều + khoảng ngày để file còn tự mô tả được khi bị copy ra chỗ khác.
 */
function mergedPdfFilename(direction: InvoiceDirection, range: ExportRange): string {
  const slug = direction === "purchase" ? "dau-vao" : "dau-ra";
  return safeName(`0.Tat-ca-hoa-don-${slug}-${rangeFolderName(range)}.pdf`);
}

/**
 * Gộp các file PDF ĐÃ GHI của một chiều thành MỘT file trong cùng thư mục `pdf/`. Trả số hóa đơn
 * gộp được (0 = không có gì để gộp).
 *
 * VÌ SAO GỘP TỪ FILE PDF, KHÔNG PHẢI GỘP HTML RỒI RENDER MỘT LẦN: route `/gdt/render-pdf` giới hạn
 * body 5MB, mà HTML một tờ hóa đơn ~31KB — cách kia sẽ vỡ ở khoảng 150 hóa đơn, trong khi lượt xuất
 * thật lên tới cả nghìn. Gộp bản đã render còn đảm bảo file gộp giống hệt các file lẻ, không phải
 * render lại lần hai (mỗi lần ~2 giây/tờ).
 *
 * Đọc lại từ đĩa và chạy SAU các vòng vá nên lấy đúng bản cuối cùng; hóa đơn nào thiếu/hỏng file thì
 * bỏ qua rồi đi tiếp, không làm hỏng cả file gộp.
 */
async function mergeInvoicePdfs(
  pdfDir: FsDirHandle,
  tasks: TaskState[],
  fileName: string,
): Promise<number> {
  // Lazy-load pdf-lib (~1MB) — chỉ tải khi thực sự có tick PDF, không nằm trong bundle chính.
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  let count = 0;

  for (const st of tasks) {
    const bytes = await readFileBytes(pdfDir, `${st.base}.pdf`);
    if (!bytes) continue;
    try {
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      for (const page of pages) merged.addPage(page);
      count += 1;
    } catch (e) {
      // 1 file hỏng không được kéo theo cả file gộp — bỏ qua tờ đó, các tờ còn lại vẫn vào.
      console.error(`[exportBundle] Bỏ qua ${st.base}.pdf khi gộp:`, e);
    }
  }

  if (count === 0) return 0;
  // Ghi thẳng `Uint8Array` (BufferSource) chứ không bọc `new Blob([...])`: file gộp có thể hàng chục
  // MB, bọc Blob là nhân đôi bộ nhớ ở đúng lúc đỉnh điểm. Phần mở rộng `.pdf` đã đủ để hệ điều hành
  // nhận diện, không cần MIME type.
  await writeFile(pdfDir, fileName, await merged.save());
  return count;
}

/**
 * Số hóa đơn xử lý ĐỒNG THỜI khi lượt có gọi BE. Mỗi worker chạy tuần tự XML -> HTML -> PDF, nên
 * số worker phải đủ để lấp hết các slot của BE, không phải để dội cho nhiều.
 *
 * Backend cấp 2 slot cho PDF (`MAX_CONCURRENT_RENDERS` ở pdfRenderer) và 2 slot cho XML
 * (`QUEUE_CONCURRENCY.xml` ở gdtPacer). Lượt có CẢ HAI cần 4 worker: 2 đang chờ cổng thuế trả XML
 * (~3 giây) thì 2 worker kia vẫn render PDF, thay vì cả lượt đứng chờ mạng. Lượt chỉ có một trong
 * hai thì 2 worker là vừa đủ — thêm nữa chỉ làm hàng đợi dài ra chứ không nhanh hơn.
 */
const REMOTE_CONCURRENCY = 2;

/**
 * Khi chỉ xuất HTML (không PDF, không XML) thì mỗi hóa đơn chỉ là dựng chuỗi + ghi file — không có
 * round-trip nào để phải điều tiết, nên nới rộng cho đỡ chờ vô ích.
 */
const LOCAL_CONCURRENCY = 8;

/**
 * Số vòng VÁ LẠI các hóa đơn còn thiếu file sau pha chính.
 *
 * Backend đã tự retry ~4 lần trong 45 giây cho mỗi hóa đơn rồi mới báo lỗi về đây, nên tới mức này
 * thì cổng thuế đang chặn/nghẹn chứ không phải trượt một nhịp. 3 vòng, mỗi vòng nghỉ dài hơn, là đủ
 * cho hầu hết trường hợp; vòng nào không vá thêm được cái nào thì dừng luôn.
 */
const MISSING_RETRY_ROUNDS = 3;

/** Nghỉ trước vòng vá thứ n = n × mốc này (5s, 10s, 15s) — cho cổng thuế thời gian hồi. */
const RETRY_ROUND_PAUSE_MS = 5_000;

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 1 hóa đơn cần ghi ra file + trạng thái xử lý, sống qua cả pha chính lẫn các vòng vá.
 * Các thư mục con {html,xml,pdf} là `null` nếu định dạng đó không được tick.
 */
interface TaskState {
  direction: InvoiceDirection;
  htmlDir: FsDirHandle | null;
  xmlDir: FsDirHandle | null;
  pdfDir: FsDirHandle | null;
  /** Tên file (không phần mở rộng) — tính 1 lần, dùng cho cả 3 định dạng. */
  base: string;
  /** Số thứ tự hóa đơn trong bảng Tổng quát — để file PDF gộp xếp đúng thứ tự bảng. */
  stt: number;
  /** Được bổ sung mã QR + tên ngân hàng sau khi lấy được XML gốc (xem `processTask`). */
  view: InvoiceView;
  /** Định dạng nào CHƯA ghi được. Hết rỗng là hóa đơn xong. */
  pending: Record<InvoiceFileFormat, boolean>;
  /** Cổng thuế xác nhận hóa đơn KHÔNG có XML gốc — đã thôi chờ định dạng đó, và KHÔNG tính là lỗi. */
  noOriginalXml?: boolean;
  /** Lỗi gần nhất — chỉ dùng để báo về FE khi hóa đơn vẫn thiếu file sau mọi vòng vá. */
  lastError?: string;
}

/**
 * Tên file txt liệt kê hóa đơn cổng thuế xác nhận KHÔNG có hóa đơn gốc (XML ký số). Ghi ở thư mục
 * gốc lượt xuất (`<MST>/<khoảng ngày>/`), gộp cả 2 chiều. `safeName` giữ nguyên (không có ký tự cấm),
 * chỉ gộp khoảng trắng.
 */
export const NO_ORIGINAL_XML_FILENAME = "các hóa đơn không có hóa đơn gốc gdt.txt";

/** Nhãn chiều hóa đơn cho file ghi chú — dùng đúng thuật ngữ kế toán (đầu vào/đầu ra). */
const DIRECTION_NOTE_LABEL: Record<InvoiceDirection, string> = {
  purchase: "HÓA ĐƠN ĐẦU VÀO (mua vào)",
  sold: "HÓA ĐƠN ĐẦU RA (bán ra)",
};

/**
 * Nội dung file txt trên: GOM THEO CHIỀU (đầu vào / đầu ra) để người dùng biết ngay hóa đơn thuộc
 * chiều nào — trước đây trộn chung nên không phân biệt được. Mỗi mục có tiêu đề chiều + số lượng,
 * rồi mỗi dòng là "<Ký hiệu> - <Số HĐ>" (ký hiệu = mẫu số + ký hiệu, vd 1K26DAA). Chỉ in mục có hóa
 * đơn. Có BOM UTF-8 để Notepad/Excel trên Windows đọc đúng tiếng Việt.
 *
 * Chỉ gồm hóa đơn mà cổng thuế TRẢ 410 (`noOriginalXml`) — câu trả lời chắc chắn "không có XML".
 * Hóa đơn hỏng vì lý do khác (mạng/token/502) KHÔNG vào đây: chúng vẫn có thể có XML, chỉ là chưa
 * lấy được — trộn vào sẽ khiến người dùng tưởng nhầm là "vĩnh viễn không có".
 */
function noOriginalXmlNote(states: TaskState[], range: ExportRange): string {
  const header = `Hóa đơn KHÔNG có hóa đơn gốc (XML ký số) trên cổng thuế — khoảng ${range.tuNgay} đến ${range.denNgay}`;
  const sections = (["purchase", "sold"] as InvoiceDirection[])
    .map((direction) => {
      const lines = states
        .filter((s) => s.noOriginalXml && s.direction === direction)
        .map((s) => `${s.view.mauSo}${s.view.kyHieu} - ${s.view.soHd}`);
      if (lines.length === 0) return null;
      return [`── ${DIRECTION_NOTE_LABEL[direction]}: ${lines.length} hóa đơn ──`, ...lines].join(
        "\r\n",
      );
    })
    .filter((s): s is string => s !== null);
  return String.fromCharCode(0xfeff) + [header, "", sections.join("\r\n\r\n")].join("\r\n") + "\r\n";
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
  const { mst, query, range, formats, dir, gdtToken, onProgress } = opts;
  const directions: InvoiceDirection[] = ["purchase", "sold"];
  const anyFormat = formats.html || formats.xml || formats.pdf;

  // Chặn ngay từ đầu thay vì để mọi hóa đơn cùng hỏng ở bước gọi cổng thuế (dialog cũng đã gate,
  // đây là lưới an toàn cho mọi caller khác).
  if (formats.xml && !gdtToken) {
    throw new Error("Cần đăng nhập Thuế điện tử để tải hóa đơn XML gốc đã ký số.");
  }

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
  let done = 0;
  let authExpired = false;

  // Setup TỪNG CHIỀU (tuần tự): ghi Excel + tạo thư mục con {html,xml,pdf} 1 lần, rồi gom trạng thái
  // từng HĐ (sống qua CẢ pha chính và các vòng vá).
  const states: TaskState[] = [];
  const htmlDirs: FsDirHandle[] = [];
  for (const { direction, saved, details, views } of perDir) {
    const overviewRows = (saved.datas ?? []).map((r) => toDisplayRow(r, direction));
    // NGUỒN DUY NHẤT của số thứ tự cho cả 3 kênh: sheet Tổng quát (vị trí dòng), sheet Chi tiết
    // (tra theo khóa) và tên file ghi ra đĩa. Lệch nhau là cột "Tên file" chỉ tên file không có thật.
    // Cần cho CẢ Excel lẫn tên file từng hóa đơn, nên tính kể cả khi không tick Excel.
    const sttOf = invoiceSttMap(overviewRows);

    // Excel tổng hợp giờ là lựa chọn RIÊNG (ô tick "Excel tổng hợp"): trước đây luôn ghi kèm, nay chỉ
    // ghi khi người dùng tick — cho phép chỉ tải Excel, hoặc chỉ tải file hóa đơn mà không kèm Excel.
    if (formats.excel) {
      // Bản đồ ngược "HĐ này bị HĐ nào thay thế/điều chỉnh" — dựng cùng khoảng (xem detailRow.ts).
      const replacedBy = buildReplacedByMap(details);
      const detailRows = details.flatMap((d) =>
        toDetailRows(d, sttOf.get(detailInvoiceKey(d)) ?? 0, replacedBy),
      );
      const buffer = await buildSummaryWorkbookBuffer(overviewRows, detailRows, direction, range);
      await writeFile(rangeDir, summaryWorkbookFilename(direction, range), buffer);
    }

    if (!anyFormat || views.length === 0) continue;

    // <khoảng>/<chiều>/{html,xml,pdf}/
    const dirDir = await rangeDir.getDirectoryHandle(direction, { create: true });
    const htmlDir = formats.html ? await dirDir.getDirectoryHandle("html", { create: true }) : null;
    const xmlDir = formats.xml ? await dirDir.getDirectoryHandle("xml", { create: true }) : null;
    const pdfDir = formats.pdf ? await dirDir.getDirectoryHandle("pdf", { create: true }) : null;
    if (htmlDir) htmlDirs.push(htmlDir);

    for (const view of views) {
      const stt = sttOf.get(invoiceKey(view.mauSo, view.kyHieu, view.soHd, view.seller.mst)) ?? 0;
      states.push({
        direction,
        stt,
        htmlDir,
        xmlDir,
        pdfDir,
        // Quy tắc đặt tên nằm ở `invoiceFileName` — dùng CHUNG với cột "Tên file hóa đơn
        // (XML/HTML/PDF)" của bảng/Excel, để tên trong bảng luôn là tên file có thật trên đĩa.
        // Đừng đổi tại chỗ: thư mục đã xuất lần trước còn dùng lại được nhờ tên ổn định (xem
        // nhánh đọc file có sẵn bên dưới).
        base: invoiceFileBase(stt, view.ngayLap, view.soHd, view.seller.mst),
        view,
        pending: { html: !!htmlDir, xml: !!xmlDir, pdf: !!pdfDir },
      });
    }
  }

  // Ảnh nền + dấu chữ ký: nạp MỘT LẦN cho cả lượt. Hỏng thì bỏ ảnh chứ không bỏ cả lượt xuất — tờ
  // hóa đơn thiếu nền vẫn đọc được, còn dừng lượt vì cái nền thì không đáng.
  let pdfAssets = RELATIVE_INVOICE_ASSETS;
  if (formats.pdf) {
    try {
      pdfAssets = await loadInlineInvoiceAssets();
    } catch (e) {
      console.error("[exportBundle] Không nạp được ảnh nền hóa đơn cho PDF:", e);
    }
  }
  // File .html trỏ ảnh CẠNH NÓ -> ghi 2 ảnh vào từng thư mục `html/` đúng một lần cho cả lượt
  // (giống cách cổng thuế đóng gói), thay vì nhúng base64 lặp lại vào từng file.
  if (htmlDirs.length > 0) {
    try {
      const blobs = await loadInvoiceAssetBlobs();
      for (const d of htmlDirs) {
        await Promise.all(
          Object.entries(INVOICE_ASSET_FILES).map(([kind, name]) =>
            writeFile(d, name, blobs[kind as keyof typeof INVOICE_ASSET_FILES]),
          ),
        );
      }
    } catch (e) {
      console.error("[exportBundle] Không ghi được ảnh nền hóa đơn kèm file .html:", e);
    }
  }

  // Mỗi làn có gọi BE (xml, pdf) được 2 worker; không làn nào -> chỉ dựng chuỗi + ghi file local.
  const remoteLanes = Number(formats.xml) + Number(formats.pdf);
  const concurrency = remoteLanes === 0 ? LOCAL_CONCURRENCY : remoteLanes * REMOTE_CONCURRENCY;

  /**
   * Ghi các định dạng CÒN THIẾU của 1 hóa đơn. Gọi lại được nhiều lần — mỗi lần chỉ làm phần dở.
   * Trả `true` nếu ghi được ít nhất 1 file trong lần gọi này (vòng vá dùng làm tiêu chí tiến triển).
   */
  const processTask = async (st: TaskState): Promise<boolean> => {
    const { htmlDir, xmlDir, pdfDir, base, direction } = st;
    let wroteSomething = false;

    /**
     * Chạy 1 định dạng: lỗi -> GIỮ trong `pending` để vòng vá làm lại, rồi ĐI TIẾP. Tách từng định
     * dạng (thay vì gói chung 1 try) vì chúng độc lập: PDF timeout không có lý do gì làm mất file
     * XML/HTML của cùng hóa đơn, và tách ra thì con số báo về mới chỉ đúng khâu hỏng.
     */
    const step = async (kind: InvoiceFileFormat, run: () => Promise<void>) => {
      try {
        await run();
        st.pending[kind] = false;
        wroteSomething = true;
      } catch (e) {
        // Token GDT hết hạn (BE trả 409 — xem `exportInvoiceXml`, KHÔNG phải 401 vì 401 bị lớp
        // refresh của `apiFetchRaw` bắt): mọi hóa đơn còn lại cũng sẽ hỏng y hệt -> ngừng gọi cổng
        // thuế và bỏ luôn các vòng vá.
        if (e instanceof ApiError && e.status === 409) authExpired = true;
        // 410 = cổng thuế xác nhận hóa đơn KHÔNG CÓ hồ sơ gốc (chỉ làn `xml` mới trả mã này). Đây
        // là câu trả lời đúng chứ không phải sự cố: gỡ khỏi `pending` để vòng vá không thử lại một
        // thứ vĩnh viễn không có, và đánh dấu để tổng kết đếm riêng thay vì gộp vào số hóa đơn lỗi.
        if (e instanceof ApiError && e.status === 410) {
          st.pending[kind] = false;
          st.noOriginalXml = true;
          console.info(`[exportBundle] ${direction}/${base}: không có XML gốc trên cổng thuế — bỏ qua.`);
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        st.lastError = msg;
        console.error(
          `[exportBundle] Lỗi xuất ${kind} hóa đơn ${direction}/${base} | message: ${msg}\n`,
          e instanceof Error ? e.stack : e,
        );
      }
    };

    // XML LẤY TRƯỚC HTML/PDF (không chỉ để ghi file): mã QR và tên ngân hàng chỉ nằm trong XML gốc,
    // nên tờ hóa đơn dựng sau đó mới có hai thứ này. XML hỏng -> `view` giữ nguyên, tờ hóa đơn vẫn
    // ra đủ, chỉ thiếu ô QR.
    if (xmlDir && st.pending.xml && !authExpired) {
      await step("xml", async () => {
        // ĐÃ XUẤT LẦN TRƯỚC vào đúng thư mục này -> đọc từ đĩa, khỏi gọi lại cổng thuế. Hóa đơn
        // đã ký là bất biến nên file cũ vẫn đúng. Xuất lại để bù vài hóa đơn lỗi là chuyện thường,
        // và đây là thứ biến một lượt 25 phút thành vài giây.
        //
        // Phải KIỂM file có nguyên vẹn, không chỉ khác rỗng: file bị sửa/cắt từ ngoài (đồng bộ
        // OneDrive, copy tay, bản xuất từ phiên bản cũ) mà nhận là hợp lệ thì hóa đơn được tính OK
        // trong khi trên đĩa là file vô giá trị pháp lý, và mã QR mất im lặng vì parse không ra.
        let xml = await readFileText(xmlDir, `${base}.xml`);
        if (xml && !xml.includes("</HDon>")) {
          console.warn(`[exportBundle] ${base}.xml có sẵn nhưng không nguyên vẹn — tải lại.`);
          xml = null;
        }
        if (!xml) {
          xml = await fetchOriginalInvoiceXml(
            {
              nbmst: st.view.seller.mst,
              khhdon: st.view.kyHieu,
              shdon: st.view.soHd,
              khmshdon: st.view.mauSo,
              // `ketQuaKt` giữ `ttxly` của GDT: "8" = hóa đơn máy tính tiền (nhánh sco-query).
              cashRegister: st.view.ketQuaKt === "8",
              direction,
            },
            // Chắc chắn có: guard đầu hàm đã ném lỗi nếu tick XML mà thiếu token (TS không giữ
            // được narrowing đó qua closure vì điều kiện guard là phức hợp).
            gdtToken as string,
          );
          await writeFile(xmlDir, `${base}.xml`, xml);
        }

        // Ưu tiên giá trị đã có từ payload chi tiết (nếu cổng thuế có trả), XML chỉ bù chỗ thiếu.
        const extras = readOriginalXmlExtras(xml);
        const enriched =
          (!st.view.qrData && !!extras.qrData) ||
          (!st.view.seller.tenNganHang && !!extras.sellerBankName) ||
          (!st.view.buyer.tenNganHang && !!extras.buyerBankName);
        if (!enriched) return;

        st.view = {
          ...st.view,
          qrData: st.view.qrData || extras.qrData,
          seller: {
            ...st.view.seller,
            tenNganHang: st.view.seller.tenNganHang || extras.sellerBankName,
          },
          buyer: {
            ...st.view.buyer,
            tenNganHang: st.view.buyer.tenNganHang || extras.buyerBankName,
          },
        };
        // Vá được XML ở vòng sau -> HTML/PDF đã ghi trước đó KHÔNG có mã QR, phải dựng lại. Chỉ làm
        // khi XML THẬT SỰ bổ sung được gì: hóa đơn không có `<DLQRCode>` (trường hợp code này tự
        // lường trước) mà vẫn dựng lại là ghi ra file giống byte, đổi lấy một lượt render PDF ~2
        // giây + ~265KB upload cho mỗi hóa đơn.
        if (htmlDir) st.pending.html = true;
        if (pdfDir) st.pending.pdf = true;
      });
    }
    // Dựng thân tờ hóa đơn MỘT LẦN cho cả .html và PDF: hai tài liệu chỉ khác khối CSS ảnh, còn thân
    // giống nhau từng byte. Dựng lại là sinh lại cả mã QR — đo được ~10ms CPU đồng bộ (chặn UI, vì
    // `runPool` chạy cùng luồng) + ~31KB chuỗi cho mỗi lần thừa.
    const needsBody = (htmlDir && st.pending.html) || (pdfDir && st.pending.pdf);
    const body = needsBody ? renderInvoiceHtml(st.view) : "";

    if (htmlDir && st.pending.html) {
      await step("html", () =>
        writeFile(
          htmlDir,
          `${base}.html`,
          standaloneInvoiceHtml(st.view, { assets: RELATIVE_INVOICE_ASSETS, body }),
        ),
      );
    }
    if (pdfDir && st.pending.pdf) {
      await step("pdf", async () =>
        writeFile(pdfDir, `${base}.pdf`, await invoiceToPdfBlob(st.view, pdfAssets, body)),
      );
    }
    return wroteSomething;
  };

  // ---- Pha chính: đi qua toàn bộ hóa đơn một lượt ----
  await runPool(states, concurrency, async (st) => {
    await processTask(st);
    done += 1;
    onProgress?.({ done, total, round: 0 });
  });

  // ---- Pha vá: quay lại các hóa đơn còn thiếu file ----
  // Vá SAU khi đã đi hết một lượt, không thử lại ngay tại chỗ: nguyên nhân thường gặp là cổng thuế
  // nghẹn tạm thời, nên để nó nghỉ trong lúc mình chạy các hóa đơn khác thì lần thử sau khả năng
  // thành công cao hơn nhiều. Backend cũng đã tự retry 45 giây/hóa đơn trước khi bỏ về đây.
  const stillMissing = () => states.filter((s) => s.pending.html || s.pending.xml || s.pending.pdf);
  const missingAfterMain = stillMissing().length;
  let retryRounds = 0;

  for (let round = 1; round <= MISSING_RETRY_ROUNDS; round += 1) {
    const remaining = stillMissing();
    // Token hết hạn thì vá bằng cùng token cũng hỏng y hệt -> dừng, để người dùng đăng nhập lại.
    if (remaining.length === 0 || authExpired) break;

    retryRounds = round;
    // Nghỉ tăng dần CHỈ KHI còn chờ cổng thuế. Lượt chỉ hỏng vài PDF (puppeteer nghẽn) thì nằm chờ
    // 5+10+15 giây là bắt người dùng đợi vô cớ — bên nghẽn không liên quan gì tới cổng thuế.
    if (remaining.some((s) => s.pending.xml)) await sleepMs(round * RETRY_ROUND_PAUSE_MS);

    let progressed = false;
    let doneInRound = 0;
    await runPool(remaining, concurrency, async (st) => {
      if (await processTask(st)) progressed = true;
      doneInRound += 1;
      onProgress?.({ done: doneInRound, total: remaining.length, round });
    });

    console.log(
      `[exportBundle] Vòng vá ${round}: ${remaining.length} hóa đơn thiếu file -> ` +
        `xong hẳn ${remaining.length - stillMissing().length}.`,
    );
    // Dừng khi KHÔNG GHI ĐƯỢC FILE NÀO, chứ không phải khi không hóa đơn nào xong hẳn: một vòng lấy
    // được XML rồi trượt bước render PDF vẫn là tiến triển thật (và bước còn thiếu đó không phụ
    // thuộc cổng thuế nên vòng sau gần như chắc chắn xong).
    if (!progressed) break;
  }

  // ---- Gộp PDF: 1 file chứa tất cả hóa đơn của mỗi chiều, cạnh các file lẻ ----
  // ĐẶT SAU CÙNG có chủ ý: mọi file lẻ + Excel đã nằm trên đĩa rồi, nên dù bước gộp có hỏng (hoặc
  // ngốn bộ nhớ với lượt vài nghìn hóa đơn) thì phần việc chính vẫn còn nguyên, chỉ thiếu file gộp.
  let mergedPdf = 0;
  if (formats.pdf) {
    for (const direction of directions) {
      const group = states
        .filter((s) => s.direction === direction && s.pdfDir)
        .sort((a, b) => a.stt - b.stt); // xếp theo đúng thứ tự bảng Tổng quát
      const pdfDir = group[0]?.pdfDir;
      if (!pdfDir) continue;
      try {
        mergedPdf += await mergeInvoicePdfs(
          pdfDir,
          group,
          mergedPdfFilename(direction, range),
        );
      } catch (e) {
        console.error(`[exportBundle] Không gộp được PDF chiều ${direction}:`, e);
      }
    }
  }

  // ---- Ghi chú các hóa đơn KHÔNG có hóa đơn gốc (cổng thuế trả 410) ra file txt ở thư mục gốc ----
  // Để người dùng biết rõ hóa đơn nào cổng thuế xác nhận không có XML ký số, khỏi tưởng bị thiếu file
  // rồi chạy lại cả lượt vô ích. Chỉ ghi khi có ≥1; ghi hỏng thì bỏ qua (đừng để mất file ghi chú kéo
  // theo hỏng cả kết quả — mọi file dữ liệu đã nằm trên đĩa rồi).
  if (states.some((s) => s.noOriginalXml)) {
    try {
      await writeFile(rangeDir, safeName(NO_ORIGINAL_XML_FILENAME), noOriginalXmlNote(states, range));
    } catch (e) {
      console.error("[exportBundle] Không ghi được file ghi chú hóa đơn không có hóa đơn gốc:", e);
    }
  }

  // ---- Tổng kết: mọi con số báo về FE đều tính ở ĐÂY, sau khi đã vá hết số vòng cho phép ----
  const missing = stillMissing();
  const failed: ExportFailedCount = {
    html: missing.filter((s) => s.pending.html).length,
    xml: missing.filter((s) => s.pending.xml).length,
    pdf: missing.filter((s) => s.pending.pdf).length,
  };
  const err = missing.length;
  const ok = total - err;
  const recovered = missingAfterMain - err;
  const firstError = missing.find((s) => s.lastError)?.lastError;
  // Hóa đơn không có XML gốc đã được gỡ khỏi `pending` nên nằm trong `ok` — đúng, vì lượt xuất đã
  // làm hết những gì làm được cho nó. Đếm riêng chỉ để FE nói rõ, không trừ vào `ok`.
  const noOriginalXml = states.filter((s) => s.noOriginalXml).length;

  return {
    total,
    ok,
    err,
    failed,
    recovered,
    noOriginalXml,
    mergedPdf,
    retryRounds,
    firstError,
    authExpired: authExpired || undefined,
  };
}
