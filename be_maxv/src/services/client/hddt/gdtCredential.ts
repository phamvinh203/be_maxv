import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Mã hóa mật khẩu cổng thuế (GDT) để lưu bền + điền sẵn lại cho lần đăng nhập sau.
 *
 * VÌ SAO MÃ HÓA (chứ không hash): mật khẩu gốc cần lấy lại được để (a) backend đăng nhập hộ và (b)
 * điền sẵn vào ô mật khẩu ở dialog — nên phải giải ngược được. Dùng AES-256-GCM (bảo mật + auth tag
 * chống sửa ngầm). Khóa ở biến môi trường, KHÔNG trong DB/repo: rò DB mà không rò khóa thì ciphertext
 * vô dụng.
 *
 * File CỐ Ý không import Prisma/DB — chỉ crypto thuần — để test đơn vị chạy nhanh. Phần đọc/ghi cột
 * `DonVi` nằm ở gdt.controller (theo sysPrisma).
 */

const ALGO = "aes-256-gcm";
/** GCM khuyến nghị IV 96-bit (12 byte). */
const IV_BYTES = 12;
/** AES-256 cần khóa đúng 32 byte. */
const KEY_BYTES = 32;

let warnedBadKey = false;

/**
 * Khóa mã hóa 32 byte đọc từ env `GDT_CRED_ENC_KEY` (chuỗi base64). Thiếu/sai độ dài -> `null`
 * (tính năng tự TẮT MỀM: không lưu/không điền sẵn, không làm hỏng đăng nhập).
 *
 * Đọc THẲNG `process.env` (không qua `config/env`) là CỐ Ý: hàm chạy trong request handler — rất
 * lâu sau khi dotenv đã nạp — nên process.env đã đủ; và cho phép test bật/tắt khóa bằng cách set
 * `process.env.GDT_CRED_ENC_KEY` mà không phải nạp lại module env (env được tính 1 lần lúc import).
 */
function getKey(): Buffer | null {
  const raw = process.env.GDT_CRED_ENC_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    if (!warnedBadKey) {
      warnedBadKey = true;
      console.warn(
        `[gdtCredential] GDT_CRED_ENC_KEY giải base64 ra ${key.length} byte, cần ${KEY_BYTES} — ` +
          `tính năng lưu mật khẩu cổng thuế bị TẮT. Tạo khóa: openssl rand -base64 32`,
      );
    }
    return null;
  }
  return key;
}

/** Đã cấu hình khóa hợp lệ chưa — dùng để quyết định có lưu mật khẩu hay không. */
export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

/** Ba mảnh ciphertext lưu vào 3 cột `gdtPassword*` của DonVi (đều base64). */
export interface EncryptedBlob {
  cipher: string;
  iv: string;
  tag: string;
}

/**
 * Mã hóa mật khẩu -> `{cipher, iv, tag}` (base64). `null` nếu chưa cấu hình khóa (tắt mềm — caller
 * bỏ qua việc lưu, đăng nhập vẫn thành công). Mỗi lần sinh IV ngẫu nhiên mới.
 */
export function encryptGdtPassword(plain: string): EncryptedBlob | null {
  const key = getKey();
  if (!key) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    cipher: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * Giải mã `{cipher, iv, tag}` -> mật khẩu gốc. `null` nếu chưa cấu hình khóa, HOẶC tag không khớp
 * (đổi khóa / dữ liệu hỏng) — coi như "chưa lưu", KHÔNG ném để không làm sập luồng đăng nhập.
 */
export function decryptGdtPassword(blob: EncryptedBlob): string | null {
  const key = getKey();
  if (!key) return null;
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(blob.iv, "base64"));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(blob.cipher, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
