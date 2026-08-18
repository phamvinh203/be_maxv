/**
 * ===== ĐỌC CAPTCHA ẢNH — CƠ CHẾ DÙNG CHUNG cho mọi bộ tải hóa đơn gốc có OCR =====
 *
 * VNPT, EasyInvoice và CyberLotus đều chặn bằng captcha ảnh và đều giải theo CÙNG một cách: sharp
 * dựng vài biến thể ảnh -> Tesseract đọc mỗi biến thể với vài PSM -> lọc ký tự + gate độ dài -> xếp
 * theo confidence. Trước đây cả ba file tự chép lại nguyên khối đó (worker cache, pipeline sharp,
 * vòng đọc), nên mọi lần tinh chỉnh OCR phải sửa ba nơi và ba worker Tesseract cùng sống trong
 * process. Ở đây chỉ còn MỘT bản; mỗi provider khai BẢNG THAM SỐ của riêng nó qua `taoBoDocCaptcha`.
 *
 * WORKER GOM THEO CHARSET, không phải theo provider: `tessedit_char_whitelist` là tham số đặt LÚC
 * INIT (khác PSM — đổi theo từng lần đọc), nên hai provider cùng charset dùng chung được một worker,
 * còn charset khác nhau thì phải tách để lần đọc này không đổi whitelist của lần đọc kia đang chạy
 * song song. Hiện tại: 1 worker alphanumeric (VNPT + EasyInvoice) + 1 worker chữ số (CyberLotus).
 * Mỗi worker tốn ~10–15MB traineddata nên gom được là đáng.
 */

import { PSM } from "tesseract.js";
import type { Worker } from "tesseract.js";
import { describeErrorChain } from "../../../../config/gdt-client";
import { TESSERACT_QUIET } from "./shared";

export { PSM };

/** 1 lần đọc đã lọc ký tự và qua gate độ dài. `confidence` là thang 0–100 của Tesseract. */
export interface CaptchaRead {
  text: string;
  confidence: number;
}

/** Bảng tham số OCR của MỘT provider — phần duy nhất khác nhau giữa các cổng NCC. */
export interface CaptchaOcrConfig {
  /**
   * Ký tự captcha có thể chứa. Vừa là `tessedit_char_whitelist` (chặn Tesseract hallucinate ký tự
   * lạ) vừa là bộ lọc áp lên text đọc được — một nguồn duy nhất nên hai vế không thể lệch nhau.
   */
  charset: string;
  /**
   * Bề rộng upscale của từng biến thể: LSTM đọc chữ to chính xác hơn hẳn chữ cao ~30px của captcha
   * gốc. Nhiều giá trị = thử nhiều cỡ (nhân số lần `recognize`). Mặc định `[360]`.
   */
  widths?: readonly number[];
  /**
   * Ngưỡng binarize của từng biến thể trên CÙNG 1 ảnh: có ngưỡng = binarize + median despeckle (cắt
   * đường nhiễu chéo + đốm nhiễu), `undefined` = chỉ grayscale (binarize quá tay làm mất nét chữ
   * mảnh). Mỗi phép hỏng một kiểu nhiễu khác nhau nên chạy nhiều biến thể rồi lấy lần đọc tốt nhất.
   */
  thresholds: readonly (number | undefined)[];
  /** PSM chạy trên MỖI biến thể. Mặc định SINGLE_LINE + SINGLE_WORD. */
  psms?: readonly PSM[];
  /** Gate độ dài — đọc ra ngoài khoảng này là dính chữ / mất chữ -> bỏ. Captcha cố định thì cho bằng nhau. */
  lenMin: number;
  lenMax: number;
  /** Logger của provider (`makeDbg`) — dùng để in danh sách lần đọc và lỗi preprocess. */
  dbg: (label: string, payload: unknown | (() => unknown)) => void;
}

export interface BoDocCaptcha {
  /**
   * Đọc 1 ảnh captcha -> danh sách ứng viên đã LỌC TRÙNG và XẾP GIẢM DẦN theo confidence (rỗng =
   * không đọc được gì hợp lệ). Không ném lỗi vì ảnh nhiễu: caller chỉ cần lấy ảnh mới thử lại.
   */
  doc(image: Buffer): Promise<CaptchaRead[]>;
}

const OCR_WIDTH_MAC_DINH = 360;

/** Captcha đôi khi chỉ là 1 "từ" gọn, đôi khi có khoảng hở lẻ — chạy cả hai kiểu phân dòng. */
const PSM_MAC_DINH = [PSM.SINGLE_LINE, PSM.SINGLE_WORD] as const;

/**
 * Worker Tesseract theo charset, init lazy và giữ sống cả lifetime process: tạo worker rất nặng
 * (load WASM + traineddata), các lần đọc sau chỉ mất ~50–100ms.
 */
const workers = new Map<string, Promise<Worker>>();

export function layWorker(charset: string): Promise<Worker> {
  let worker = workers.get(charset);
  if (!worker) {
    worker = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng", 1, { logger: () => {} });
      // PSM KHÔNG đặt ở đây — `doc` đổi PSM theo từng vòng nên đặt lúc init cũng bị ghi đè ngay.
      await w.setParameters({
        tessedit_char_whitelist: charset,
        // Chặn Leptonica xả debug ra stdout — xem `TESSERACT_QUIET`.
        ...TESSERACT_QUIET,
      });
      return w;
    })();
    workers.set(charset, worker);
  }
  return worker;
}

/**
 * Giải phóng mọi worker Tesseract — gọi lúc shutdown process (xem `server.ts`). Không có nó thì test
 * runner và `tsx watch` giữ lại worker của lần chạy trước.
 */
export async function dongCaptchaWorkers(): Promise<void> {
  const dangMo = Array.from(workers.values());
  workers.clear();
  await Promise.all(
    dangMo.map(async (p) => {
      await (await p).terminate();
    }),
  );
}

/** Charset -> char class phủ định để lọc text Tesseract trả về (escape ký tự có nghĩa trong `[...]`). */
function locNgoaiCharset(charset: string): RegExp {
  return new RegExp(`[^${charset.replace(/[\\\]^-]/g, "\\$&")}]`, "g");
}

/**
 * Dựng các biến thể PNG để OCR: upscale + grayscale + normalize, biến thể có ngưỡng thì thêm
 * binarize + median despeckle. sharp tự decode PNG/JPEG nên không cần thư viện riêng; sharp hỏng
 * (ảnh không phải raster…) -> trả ảnh gốc để OCR vẫn chạy như bản Tesseract thuần.
 *
 * KHÔNG gộp phần chung (`resize`+`grayscale`+`normalize`) ra chạy một lần rồi threshold trên pixel
 * đó: libvips áp các phép theo THỨ TỰ NỘI BỘ của nó, không theo thứ tự gọi, nên tách ra làm nhiều
 * pipeline cho ra pixel KHÁC — đã đo, ảnh vào OCR đổi luôn. Chạy lại resize mỗi biến thể là giá phải trả.
 *
 * `import` sharp Ở ĐÂY chứ không ở đầu file: sharp là native addon (libvips), import nó kéo theo vài
 * chục MB RSS ngay lúc đăng ký route — mà cả chuỗi này chỉ chạy khi có người bấm "Tải hóa đơn gốc".
 */
async function dungBienThe(image: Buffer, cfg: CaptchaOcrConfig): Promise<Buffer[]> {
  const widths = cfg.widths ?? [OCR_WIDTH_MAC_DINH];
  try {
    const sharp = (await import("sharp")).default;
    return await Promise.all(
      widths.flatMap((width) =>
        cfg.thresholds.map((threshold) => {
          const pipeline = sharp(image)
            .resize({ width, kernel: "lanczos3" })
            .grayscale()
            .normalize();
          return (threshold === undefined ? pipeline : pipeline.threshold(threshold).median(3))
            .png()
            .toBuffer();
        }),
      ),
    );
  } catch (err) {
    cfg.dbg("preprocessCaptcha lỗi — OCR ảnh gốc", describeErrorChain(err));
    return [image];
  }
}

/**
 * Tạo bộ đọc captcha cho 1 provider. Ba lớp bù cho việc Tesseract thuần chỉ đọc đúng ~10–30% captcha
 * ASP.NET: preprocess cắt nhiễu, đa biến thể × đa PSM lấy kết quả TỐT NHẤT thay vì tin một lần đọc,
 * gate độ dài để text rác bị loại ngay đây (khỏi tốn một POST search chắc chắn sai).
 */
export function taoBoDocCaptcha(cfg: CaptchaOcrConfig): BoDocCaptcha {
  const psms = cfg.psms ?? PSM_MAC_DINH;
  const loaiKyTuLa = locNgoaiCharset(cfg.charset);

  return {
    async doc(image: Buffer): Promise<CaptchaRead[]> {
      const worker = await layWorker(cfg.charset);
      const variants = await dungBienThe(image, cfg);

      // PSM ở vòng NGOÀI để `setParameters` chỉ chạy 1 lần mỗi PSM thay vì trước từng lần đọc.
      const reads: CaptchaRead[] = [];
      for (const psm of psms) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        for (const variant of variants) {
          const { data } = await worker.recognize(variant);
          // Tesseract có thể dính space/newline/dấu câu — lọc về đúng charset của captcha.
          const text = (data.text || "").replace(loaiKyTuLa, "");
          if (text.length >= cfg.lenMin && text.length <= cfg.lenMax) {
            reads.push({ text, confidence: data.confidence });
          }
        }
      }

      // Lọc trùng SAU khi xếp: nhiều biến thể đọc ra cùng một chuỗi là chuyện thường, provider nào
      // thử nhiều ứng viên (CyberLotus) mà không lọc thì tiêu lượt thử vào cùng một text.
      const ungVien: CaptchaRead[] = [];
      for (const read of reads.sort((a, b) => b.confidence - a.confidence)) {
        if (!ungVien.some((x) => x.text === read.text)) ungVien.push(read);
      }
      cfg.dbg("solveCaptcha reads", ungVien);
      return ungVien;
    },
  };
}

/**
 * Lấy ứng viên tốt nhất nếu đủ tự tin, ngược lại `null` (caller lấy ảnh mới thử lại thay vì POST text
 * rác lên NCC). Tesseract trên ảnh captcha nhiễu thường 40–70%, nên ngưỡng ~35 lọc được đọc bừa mà
 * không loại bỏ lần đọc đúng nhưng tự tin thấp.
 */
export function docTotNhat(reads: CaptchaRead[], minConfidence: number): string | null {
  const best = reads[0];
  return best && best.confidence >= minConfidence ? best.text : null;
}
