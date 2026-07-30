/**
 * SỞ HỮU tên + vị trí 2 ảnh của tờ hóa đơn (nền vân + dấu kiểm ô chữ ký), và nạp chúng từ `public/`
 * khi cần ghi ra đĩa hoặc nhúng base64. `invoiceHtml.ts` chỉ giữ hợp đồng biến CSS (`InvoiceAssets`,
 * `invoiceAssetCss`) — mọi đường dẫn đều suy ra từ `INVOICE_ASSET_FILES` ở đây để đổi tên file chỉ
 * phải sửa một chỗ.
 *
 * Ba nguồn ảnh cho ba đích:
 *  - `PUBLIC_INVOICE_ASSETS`: bản XEM/IN trong ứng dụng (cùng origin, trình duyệt tự tải);
 *  - `RELATIVE_INVOICE_ASSETS`: file .html xuất ra — `exportBundle` ghi kèm 2 ảnh vào thư mục
 *    `html/` đúng một lần cho cả lượt (giống cách cổng thuế đóng gói), rẻ hơn nhúng base64 vào từng
 *    file rất nhiều;
 *  - `loadInlineInvoiceAssets()`: PDF — tài liệu gửi lên backend phải TỰ CHỨA vì Chromium headless
 *    không có thư mục nào để phân giải đường dẫn tương đối.
 *
 * Kết quả nạp được cache theo vòng đời trang: một lượt xuất vài trăm hóa đơn chỉ đọc ảnh một lần.
 */
import type { InvoiceAssets } from "./invoiceHtml";

/** Tên file ảnh — giữ đúng tên trong gói cổng thuế. NGUỒN DUY NHẤT cho mọi đường dẫn bên dưới. */
export const INVOICE_ASSET_FILES = {
  bg: "viewinvoice-bg.jpg",
  sign: "sign-check.jpg",
} as const;

/** Ảnh nằm CÙNG THƯ MỤC với file .html xuất ra. */
export const RELATIVE_INVOICE_ASSETS: InvoiceAssets = INVOICE_ASSET_FILES;

/** Ảnh phục vụ từ `public/` — cho bản XEM và IN trong ứng dụng. */
export const PUBLIC_INVOICE_ASSETS: InvoiceAssets = {
  bg: `/${INVOICE_ASSET_FILES.bg}`,
  sign: `/${INVOICE_ASSET_FILES.sign}`,
};

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không đọc được ảnh hóa đơn ${url} (${res.status}).`);
  return res.blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được ảnh hóa đơn."));
    reader.readAsDataURL(blob);
  });
}

/** 2 ảnh dạng Blob, khóa theo đúng tên trong `INVOICE_ASSET_FILES` (không ghép theo thứ tự). */
export type InvoiceAssetBlobs = Record<keyof typeof INVOICE_ASSET_FILES, Blob>;

let blobsPromise: Promise<InvoiceAssetBlobs> | null = null;

/** 2 ảnh dạng Blob — để ghi vào thư mục `html/` cạnh các file .html. */
export function loadInvoiceAssetBlobs(): Promise<InvoiceAssetBlobs> {
  blobsPromise ??= Promise.all([
    fetchBlob(PUBLIC_INVOICE_ASSETS.bg),
    fetchBlob(PUBLIC_INVOICE_ASSETS.sign),
  ])
    .then(([bg, sign]) => ({ bg, sign }))
    .catch((e) => {
      // Không cache lời hứa hỏng: lần xuất sau (mạng đã ổn) phải được thử lại.
      blobsPromise = null;
      throw e;
    });
  return blobsPromise;
}

let inlinePromise: Promise<InvoiceAssets> | null = null;

/** 2 ảnh dạng `data:` URL — cho tài liệu HTML tự chứa gửi lên backend render PDF. */
export function loadInlineInvoiceAssets(): Promise<InvoiceAssets> {
  inlinePromise ??= loadInvoiceAssetBlobs()
    .then(async (blobs) => ({
      bg: await blobToDataUrl(blobs.bg),
      sign: await blobToDataUrl(blobs.sign),
    }))
    .catch((e) => {
      inlinePromise = null;
      throw e;
    });
  return inlinePromise;
}
