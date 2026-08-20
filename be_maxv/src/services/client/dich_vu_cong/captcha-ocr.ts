import { makeDbg } from "../hddt/traCuuGoc/shared";

/**
 * OCR captcha PNG của cổng Dịch vụ công (https://dichvucong.gdt.gov.vn/tthc).
 *
 * Sử dụng Model Deep Learning (CRNN/CNN) tối ưu cho Captcha thông qua ONNX Runtime (`ddddocr-node`).
 * - Tốc độ nhận diện: ~10ms - 20ms.
 * - Độ chính xác vượt trội trên các font chữ méo, nét gai/răng cưa và nền gradient.
 */

const dbg = makeDbg("DVC-CAPTCHA-DBG", "DEBUG_DVC");

let ddddInstance: any = null;

async function getOcrEngine() {
  if (!ddddInstance) {
    const { DdddOcr, CHARSET_RANGE } = await import("ddddocr-node");
    ddddInstance = new DdddOcr();
    // Captcha cổng DVC gồm chữ cái in thường và chữ số
    ddddInstance.setRanges(CHARSET_RANGE.MIX_LOWER_NUM_CASE);
  }
  return ddddInstance;
}

/**
 * Đọc text captcha từ Buffer ảnh PNG do cổng Dịch vụ công trả về.
 *
 * @param image Buffer chứa dữ liệu ảnh PNG do cổng DVC trả về
 * @returns Chuỗi captcha giải được, hoặc `null` nếu ảnh hỏng / không nhận diện được
 */
export async function docDvcCaptcha(image: Buffer): Promise<string | null> {
  if (!image || image.length === 0) return null;

  try {
    const engine = await getOcrEngine();
    const started = Date.now();
    const rawResult: string = await engine.classification(image);
    const duration = Date.now() - started;

    if (!rawResult || typeof rawResult !== "string") {
      dbg("ONNX OCR không trả về kết quả", { duration });
      return null;
    }

    const text = rawResult.toLowerCase().replace(/[^0-9a-z]/g, "").trim();

    // Captcha cổng DVC chuẩn là 5 ký tự (hoặc 4-6 ký tự)
    if (text.length >= 4 && text.length <= 6) {
      dbg("ONNX OCR thành công:", { text, duration: `${duration}ms` });
      return text;
    }

    dbg("ONNX OCR trả về độ dài không hợp lệ:", { rawResult, text, duration: `${duration}ms` });
    return text || null;
  } catch (err) {
    console.error("[DEBUG-DVC] ONNX OCR captcha lỗi:", err);
    return null;
  }
}