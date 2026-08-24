import fs from "fs";
import path from "path";
import { getCaptcha } from "../services/client/dich_vu_cong/gdt-dvc.service";
import { docDvcCaptcha } from "../services/client/dich_vu_cong/captcha-ocr";

async function main() {
  console.log("=== BẮT ĐẦU TEST LẤY CAPTCHA TỪ CỔNG DVC VÀ GIẢI OCR ===");

  const samplesDir = path.join(__dirname, "../../samples_dvc");
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  const NUM_TESTS = 35;

  for (let i = 1; i <= NUM_TESTS; i++) {
    console.log(`\n--- Lượt ${i}/${NUM_TESTS} ---`);
    try {
      const started = Date.now();
      // Script đo OCR chạy ngoài request, không có công ty nào đang chọn — phiên tạo ra chỉ để lấy
      // ảnh captcha rồi bỏ, nên gắn một `donViId` giả là đủ (không API nào dùng lại phiên này).
      const res = await getCaptcha("script-test-ocr");
      const fetchTime = Date.now() - started;

      // Trích xuất buffer từ base64 data URI
      const base64Data = res.image.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");

      // Lưu file để đối chiếu bằng mắt
      const savePath = path.join(samplesDir, `captcha_${Date.now()}_ans_${res.answer || "null"}.png`);
      fs.writeFileSync(savePath, imgBuffer);

      console.log(`1. Lấy ảnh thành công (${fetchTime}ms) - Kích thước: ${imgBuffer.length} bytes`);
      console.log(`2. Đã lưu ảnh vào: ${savePath}`);
      console.log(`3. Kết quả OCR tự động nhận diện: [ ${res.answer || "KHÔNG NHẬN DIỆN ĐƯỢC"} ]`);
    } catch (err: any) {
      console.error(`Lỗi lượt ${i}:`, err.message || err);
    }

    // Nghỉ nhẹ 1s giữa các lần gọi để tránh bị chặn tần suất
    if (i < NUM_TESTS) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("\n=== HOÀN THÀNH TEST ===");
}

main().catch(console.error);
