import { docTotNhat, taoBoDocCaptcha } from "../hddt/traCuuGoc/captchaOcr";
import { makeDbg } from "../hddt/traCuuGoc/shared";


const dbg = makeDbg("DVC-CAPTCHA-DBG", "DEBUG_DVC");

const DVC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const MIN_OCR_CONFIDENCE = 35;

const boDocCaptcha = taoBoDocCaptcha({
  charset: DVC_CHARSET,
  thresholds: [160, undefined, 180],
  lenMin: 5,
  lenMax: 5,
  dbg,
});


export async function docDvcCaptcha(image: Buffer): Promise<string | null> {
  if (!image || image.length === 0) return null;

  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(image).metadata();
    const width = metadata.width || 150;
    const height = metadata.height || 38;

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
