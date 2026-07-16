import puppeteer, { type Browser } from "puppeteer";

/**
 * Render HTML tự chứa -> PDF vector bằng Chromium headless (puppeteer). Dùng cho nút "Xuất file tổng
 * hợp + hóa đơn": FE gửi HTML tờ hóa đơn (inline CSS, không tài nguyên ngoài), BE trả PDF chuẩn (chữ
 * vector, chọn/tìm được). 1 browser DÙNG CHUNG cả tiến trình (launch chậm ~1s) — chỉ mở page mới mỗi lần.
 */

let browserPromise: Promise<Browser> | null = null;

/** Lấy (hoặc launch) browser dùng chung; tự reset để relaunch nếu Chromium chết/đóng. */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      // --no-sandbox cần cho hầu hết môi trường server Linux/container; --disable-dev-shm-usage tránh
      // hết /dev/shm khi render nhiều. Trên Windows dev các cờ này vô hại.
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    browserPromise
      .then((b) => {
        // Chromium chết/đóng -> xóa cache để lần gọi sau launch lại từ đầu.
        b.on("disconnected", () => {
          browserPromise = null;
        });
      })
      .catch(() => {
        browserPromise = null;
      });
  }
  return browserPromise;
}

// Giới hạn số page render ĐỒNG THỜI: mỗi page ngốn vài chục MB — nhiều request cùng lúc (2 user xuất,
// hoặc bị dội) có thể làm Chromium hết RAM -> crash -> cả lượt hỏng. Hàng đợi nhẹ giữ tối đa N page.
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  activeRenders += 1;
}

function releaseSlot(): void {
  activeRenders -= 1;
  waiters.shift()?.();
}

/**
 * Render 1 tài liệu HTML (tự chứa) thành PDF khổ A4. An toàn:
 *  - Tắt JS (HTML hóa đơn không cần).
 *  - CHẶN mọi request mạng (chỉ cho `data:`): HTML do người dùng gửi có thể chèn `<img src=http://…>`
 *    trỏ vào dịch vụ nội bộ/metadata -> chống SSRF & rò dữ liệu nội bộ vào PDF.
 * Giới hạn số render đồng thời để không làm sập Chromium. Trả `Buffer` PDF.
 */
export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  await acquireSlot();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        // Tài liệu chính do setContent đặt trực tiếp (không phải request mạng). Mọi request phát sinh
        // đều là subresource -> chỉ cho data: URI, còn lại chặn hết.
        if (req.url().startsWith("data:")) void req.continue();
        else void req.abort();
      });
      // domcontentloaded (không "load") để không treo chờ subresource đã bị abort.
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20_000 });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "25mm", bottom: "25mm", left: "10mm", right: "10mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    releaseSlot();
  }
}
