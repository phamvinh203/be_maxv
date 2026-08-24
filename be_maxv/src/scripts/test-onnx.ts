import fs from "fs";
import path from "path";
import { getCaptcha } from "../services/client/dich_vu_cong/gdt-dvc.service";
import { DdddOcr, CHARSET_RANGE } from "ddddocr-node";

async function main() {
  console.log("=== BẮT ĐẦU TEST ONNX (ddddocr-node) VỚI CAPTCHA LIVE TỪ CỔNG DVC ===\n");

  // Khởi tạo thư mục lưu ảnh test
  const samplesDir = path.resolve(process.cwd(), "src/scripts/samples_dvc");
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  const dddd = new DdddOcr();
  dddd.setRanges(CHARSET_RANGE.MIX_LOWER_NUM_CASE);

  const NUM_TESTS = 15;

  for (let i = 1; i <= NUM_TESTS; i++) {
    try {
      // Xem chú thích tương ứng ở `test-dvc-ocr.ts`: script đo lường, phiên dùng một lần rồi bỏ.
      const res = await getCaptcha("script-test-onnx");
      const base64Data = res.image.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");

      const started = Date.now();
      const onnxAns = (await dddd.classification(imgBuffer as any)).toLowerCase().trim();
      const onnxTime = Date.now() - started;

      const tessAns = (res.answer || "null").trim();

      // Đặt tên file chi tiết gồm cả kết quả của Tesseract và ONNX
      const fileName = `captcha_${Date.now()}_tess_${tessAns}_onnx_${onnxAns}.png`;
      const fullPath = path.join(samplesDir, fileName);
      fs.writeFileSync(fullPath, imgBuffer);

      console.log(`[Lượt ${String(i).padStart(2, "0")}/${NUM_TESTS}]`);
      console.log(`- Ảnh lưu tại: ${fullPath}`);
      console.log(`- Tesseract OCR : [ ${tessAns} ]`);
      console.log(`- ONNX AI OCR   : [ ${onnxAns} ] (${onnxTime}ms)\n`);
    } catch (err: any) {
      console.error(`Lỗi lượt ${i}:`, err.message || err);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`=== HOÀN THÀNH: Toàn bộ ảnh đã được lưu tại ${samplesDir} ===`);
}

main().catch(console.error);
