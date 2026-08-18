import { PSM, layWorker } from "../hddt/traCuuGoc/captchaOcr";
import { makeDbg } from "../hddt/traCuuGoc/shared";

/**
 * OCR captcha PNG của cổng Dịch vụ công (https://dichvucong.gdt.gov.vn/tthc).
 *
 * Đặc điểm ảnh captcha cổng DVC:
 *   - Ảnh PNG kích thước 150x38, chữ số/chữ cái ngẫu nhiên (4-6 ký tự).
 *   - Có VIỀN ĐEN 2-3px bao quanh toàn bộ ảnh: nếu không cắt viền thì Tesseract bị nhiễu biên và không đọc được.
 *   - Nền ảnh có gradient chuyển màu và đốm nhiễu.
 *
 * Pipeline xử lý:
 *   1. Dùng `sharp` cắt bỏ 3px viền đen mỗi cạnh.
 *   2. Tạo các biến thể tiền xử lý (upscale Lanczos3 360px + grayscale + normalize + threshold 160/180 + median despeckle).
 *   3. Chạy Tesseract LSTM với các chế độ phân đoạn dòng PSM.SINGLE_LINE và PSM.SINGLE_WORD.
 *   4. Lọc ký tự chuẩn [0-9a-zA-Z], kiểm tra độ dài (4-6 ký tự) và bầu chọn kết quả xuất hiện nhiều nhất.
 */

const dbg = makeDbg("DVC-CAPTCHA-DBG", "DEBUG_DVC");

const DVC_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Đọc text captcha từ Buffer ảnh PNG do cổng Dịch vụ công trả về.
 *
 * @param image Buffer chứa dữ liệu ảnh PNG do cổng DVC trả về
 * @returns Chuỗi captcha giải được, hoặc `null` nếu ảnh hỏng / không nhận diện được
 */
export async function docDvcCaptcha(image: Buffer): Promise<string | null> {
  if (!image || image.length === 0) return null;

  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(image).metadata();
    const width = metadata.width || 150;
    const height = metadata.height || 38;

    // 1. Cắt bỏ viền đen bao quanh khung ảnh (3px mỗi cạnh)
    const cropped = sharp(image).extract({
      left: 3,
      top: 3,
      width: Math.max(10, width - 6),
      height: Math.max(10, height - 6),
    });

    // 2. Dựng các biến thể ảnh tối ưu cho Tesseract LSTM
    const variants = await Promise.all([
      // Biến thể A: threshold 160 + lọc đốm nhiễu (cho ảnh nét chuẩn)
      cropped
        .clone()
        .resize({ width: 360, kernel: "lanczos3" })
        .grayscale()
        .normalize()
        .threshold(160)
        .median(3)
        .png()
        .toBuffer(),
      // Biến thể B: grayscale + normalize thuần (cho ký tự nét mảnh/chữ xám)
      cropped
        .clone()
        .resize({ width: 360, kernel: "lanczos3" })
        .grayscale()
        .normalize()
        .png()
        .toBuffer(),
      // Biến thể C: threshold 180 (cho nét chữ đậm hoặc nền tối)
      cropped
        .clone()
        .resize({ width: 360, kernel: "lanczos3" })
        .grayscale()
        .normalize()
        .threshold(180)
        .png()
        .toBuffer(),
    ]);

    // 3. Tận dụng worker Tesseract dùng chung
    const worker = await layWorker(DVC_CHARSET);

    const candidates: string[] = [];
    for (const variant of variants) {
      for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_WORD]) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        const res = await worker.recognize(variant);
        const text = (res.data.text || "").replace(/[^0-9a-zA-Z]/g, "").trim();
        if (text.length >= 4 && text.length <= 6) {
          candidates.push(text);
        }
      }
    }

    if (candidates.length === 0) {
      dbg("Không tìm thấy ứng viên hợp lệ", { candidates });
      return null;
    }

    // 4. Bầu chọn kết quả xuất hiện nhiều nhất giữa các biến thể & PSM
    const freq = new Map<string, number>();
    for (const c of candidates) {
      freq.set(c, (freq.get(c) || 0) + 1);
    }

    let best = candidates[0];
    let maxCount = 0;
    for (const [c, count] of freq.entries()) {
      if (count > maxCount) {
        maxCount = count;
        best = c;
      }
    }

    dbg("Kết quả OCR DVC được chọn:", { best, freq: Object.fromEntries(freq) });
    return best;
  } catch (err) {
    console.error("[DEBUG-DVC] OCR captcha lỗi:", err);
    return null;
  }
}


