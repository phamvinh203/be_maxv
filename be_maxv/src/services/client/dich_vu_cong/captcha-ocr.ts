import { docTotNhat, taoBoDocCaptcha } from "../hddt/traCuuGoc/captchaOcr";
import { makeDbg } from "../hddt/traCuuGoc/shared";

/**
 * OCR captcha PNG của cổng Dịch vụ công (https://dichvucong.gdt.gov.vn/tthc).
 *
 * Pipeline đọc dùng chung với VNPT/EasyInvoice/CyberLotus (`hddt/traCuuGoc/captchaOcr.ts`) — chỗ
 * đó đã gom preprocess + đa biến thể × đa PSM + bầu chọn theo confidence thành một bản, mỗi cổng
 * chỉ khai bảng tham số riêng. Phần thật sự riêng của cổng DVC chỉ có bước cắt viền đen bên dưới.
 *
 * Đặc điểm ảnh captcha cổng DVC: PNG 150x38, 4-6 ký tự, có VIỀN ĐEN 2-3px bao quanh (không cắt thì
 * Tesseract bị nhiễu biên và không đọc được), nền có gradient + đốm nhiễu.
 */

const dbg = makeDbg("DVC-CAPTCHA-DBG", "DEBUG_DVC");

/**
 * PHẢI khớp NGUYÊN VĂN charset của `vnpt.ts`/`easy_invoice.ts` (digits, UPPER, lower) — `layWorker`
 * gom worker Tesseract theo CHUỖI charset, đảo thứ tự ký tự (dù cùng tập) là cache-miss, tự dựng
 * thêm một worker ~10-15MB thay vì dùng chung worker alphanumeric đã sống sẵn trong process.
 */
const DVC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const MIN_OCR_CONFIDENCE = 35;

const boDocCaptcha = taoBoDocCaptcha({
  charset: DVC_CHARSET,
  thresholds: [160, undefined, 180],
  lenMin: 4,
  lenMax: 6,
  dbg,
});

/**
 * Đọc text captcha từ Buffer ảnh PNG do cổng Dịch vụ công trả về.
 *
 * @param image Buffer chứa dữ liệu ảnh PNG do cổng DVC trả về
 * @returns Chuỗi captcha giải được, hoặc `null` nếu ảnh hỏng / không đủ tự tin để giao cho cổng
 * (caller lấy captcha mới thử lại, xem `traCuuHoSo`).
 */
export async function docDvcCaptcha(image: Buffer): Promise<string | null> {
  if (!image || image.length === 0) return null;

  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(image).metadata();
    const width = metadata.width || 150;
    const height = metadata.height || 38;

    // Cắt viền đen 3px mỗi cạnh — đặc thù ảnh cổng DVC, nằm ngoài bảng tham số dùng chung nên phải
    // làm ở đây trước khi đưa vào `taoBoDocCaptcha` (nó chỉ lo resize/grayscale/threshold).
    const cropped = await sharp(image)
      .extract({
        left: 3,
        top: 3,
        width: Math.max(10, width - 6),
        height: Math.max(10, height - 6),
      })
      .png()
      .toBuffer();

    const reads = await boDocCaptcha.doc(cropped);
    return docTotNhat(reads, MIN_OCR_CONFIDENCE);
  } catch (err) {
    console.error("[DEBUG-DVC] OCR captcha lỗi:", err);
    return null;
  }
}
