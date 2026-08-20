import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";

const DVC_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyz";

async function preprocessVariants(imgBuffer: Buffer): Promise<Buffer[]> {
  const meta = await sharp(imgBuffer).metadata();
  const width = meta.width || 150;
  const height = meta.height || 38;

  // 1. Cắt viền đen 3px
  const base = sharp(imgBuffer)
    .extract({
      left: 3,
      top: 3,
      width: Math.max(10, width - 6),
      height: Math.max(10, height - 6),
    })
    .grayscale();

  const rawBase = await base.raw().toBuffer({ resolveWithObject: true });
  const w = rawBase.info.width;
  const h = rawBase.info.height;

  // Khử gradient ngang (Left-to-right gradient removal)
  const colAvg = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      sum += rawBase.data[y * w + x];
    }
    colAvg[x] = sum / h;
  }

  const flatData = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = rawBase.data[y * w + x];
      const bg = colAvg[x];
      // Chuẩn hóa nền sáng đều
      const norm = Math.min(255, Math.max(0, Math.round((v / (bg || 1)) * 240)));
      flatData[y * w + x] = norm;
    }
  }

  const flattenedSharp = sharp(flatData, { raw: { width: w, height: h, channels: 1 } })
    .extend({
      top: 10,
      bottom: 10,
      left: 15,
      right: 15,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });

  // Tạo các biến thể:
  // V1: blur 0.6 + threshold 160 (làm mịn nét gai nhọn)
  const v1 = await flattenedSharp
    .clone()
    .resize({ width: 380, kernel: "lanczos3" })
    .blur(0.6)
    .normalize()
    .threshold(160)
    .png()
    .toBuffer();

  // V2: blur 0.85 + threshold 175 (làm mịn nét gai dày)
  const v2 = await flattenedSharp
    .clone()
    .resize({ width: 380, kernel: "lanczos3" })
    .blur(0.85)
    .normalize()
    .threshold(175)
    .png()
    .toBuffer();

  // V3: Làm nét + contrast boost
  const v3 = await flattenedSharp
    .clone()
    .resize({ width: 380, kernel: "lanczos3" })
    .blur(0.4)
    .sharpen({ sigma: 1.2 })
    .normalize()
    .threshold(170)
    .png()
    .toBuffer();

  // V4: threshold 185
  const v4 = await flattenedSharp
    .clone()
    .resize({ width: 380, kernel: "lanczos3" })
    .blur(0.7)
    .normalize()
    .threshold(185)
    .median(3)
    .png()
    .toBuffer();

  return [v1, v2, v3, v4];
}

async function testAllSamples() {
  const samplesDir = path.join(__dirname, "../../samples_dvc");
  const files = fs.readdirSync(samplesDir).filter((f) => f.endsWith(".png"));

  const worker = await createWorker("eng", 1, { logger: () => {} });
  await worker.setParameters({
    tessedit_char_whitelist: DVC_CHARSET,
    user_defined_dpi: "300",
  });

  console.log(`=== BẮT ĐẦU TEST TOÀN BỘ ${files.length} MẪU ===\n`);

  for (const file of files) {
    const oldAns = file.replace(/^captcha_\d+_ans_/, "").replace(/\.png$/, "");
    const imgBuf = fs.readFileSync(path.join(samplesDir, file));
    const variants = await preprocessVariants(imgBuf);

    const candidates: { text: string; conf: number }[] = [];
    for (const v of variants) {
      for (const psm of [PSM.SINGLE_LINE, PSM.RAW_LINE, PSM.SINGLE_WORD]) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        const res = await worker.recognize(v);
        const text = (res.data.text || "").replace(/[^0-9a-z]/g, "").trim();
        if (text.length === 5) {
          candidates.push({ text, conf: res.data.confidence });
        }
      }
    }

    let newAns = "null";
    if (candidates.length > 0) {
      let voted = "";
      for (let i = 0; i < 5; i++) {
        const votes = new Map<string, number>();
        for (const c of candidates) {
          const ch = c.text[i];
          votes.set(ch, (votes.get(ch) || 0) + c.conf);
        }
        let topCh = candidates[0].text[i];
        let maxScore = 0;
        for (const [ch, score] of votes.entries()) {
          if (score > maxScore) {
            maxScore = score;
            topCh = ch;
          }
        }
        voted += topCh;
      }
      newAns = voted;
    }

    console.log(`File: ${file.padEnd(42)} | Cũ: [ ${oldAns.padEnd(7)} ] -> Mới: [ ${newAns.padEnd(5)} ] (${candidates.length} reads)`);
  }

  await worker.terminate();
}

testAllSamples().catch(console.error);
