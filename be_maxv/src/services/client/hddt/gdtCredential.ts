import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Mã hóa mật khẩu cổng thuế (GDT) để lưu bền + điền sẵn lại cho lần đăng nhập sau.
 *
 * VÌ SAO MÃ HÓA (chứ không hash): mật khẩu gốc cần lấy lại được để backend đăng nhập hộ — nên phải
 * giải ngược được. Dùng AES-256-GCM (bảo mật + auth tag chống sửa ngầm, AAD gắn blob với đúng công ty).
 * Khóa ở biến môi trường, KHÔNG trong DB/repo: rò DB mà không rò khóa thì ciphertext vô dụng.
 *
 * File CỐ Ý không import Prisma/DB — chỉ crypto thuần — để test đơn vị chạy nhanh. Phần đọc/ghi cột
 * `DonVi` nằm ở gdt.controller (theo sysPrisma).
 */

const ALGO = "aes-256-gcm";
/** GCM khuyến nghị IV 96-bit (12 byte). */
const IV_BYTES = 12;
/** AES-256 cần khóa đúng 32 byte. */
const KEY_BYTES = 32;
/**
 * Tag GCM cố định 16 byte ở CẢ hai chiều (vbsec 2026-09-10). Không khai `authTagLength` thì Node nhận cả
 * tag bị cắt còn 4 byte — kẻ sửa được DB chỉ cần đoán 2^32 thay vì 2^128.
 */
const TAG_BYTES = 16;

/**
 * "Ngữ cảnh" (AAD của GCM) của từng loại bí mật: blob chỉ giải mã được đúng nơi nó được ghi. Không có
 * AAD thì blob của công ty A chép sang dòng `don_vi` của công ty B vẫn giải mã được (B đăng nhập cổng thuế
 * / mở Drive của A). DVC gắn thêm tên đăng nhập: sửa `dvcUsername` trong DB là mật khẩu vô hiệu.
 */
export const nguCanhMatKhauGdt = (donViId: string) => `gdt-password:${donViId}`;
export const nguCanhMatKhauDvc = (donViId: string, tenDN: string) =>
  `dvc-password:${donViId}:${tenDN}`;
export const nguCanhTokenDrive = (donViId: string) => `drive-refresh-token:${donViId}`;

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
 * bỏ qua việc lưu, đăng nhập vẫn thành công). Mỗi lần sinh IV ngẫu nhiên mới. `nguCanh` (AAD) — xem
 * `nguCanhMatKhauGdt`; nơi ghi luôn phải truyền, bỏ trống chỉ còn cho test tái tạo blob cũ.
 */
export function encryptGdtPassword(plain: string, nguCanh?: string): EncryptedBlob | null {
  const key = getKey();
  if (!key) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_BYTES });
  if (nguCanh !== undefined) cipher.setAAD(Buffer.from(nguCanh, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    cipher: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function giaiMa(key: Buffer, blob: EncryptedBlob, tag: Buffer, nguCanh?: string): string | null {
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(blob.iv, "base64"), {
      authTagLength: TAG_BYTES,
    });
    if (nguCanh !== undefined) decipher.setAAD(Buffer.from(nguCanh, "utf8"));
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([
      decipher.update(Buffer.from(blob.cipher, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Giải mã `{cipher, iv, tag}` -> mật khẩu gốc. `null` nếu chưa cấu hình khóa, tag không đúng 16 byte,
 * HOẶC tag không khớp (đổi khóa / dữ liệu hỏng / sai ngữ cảnh) — coi như "chưa lưu", KHÔNG ném để không
 * làm sập luồng đăng nhập.
 *
 * Blob ghi TRƯỚC 2026-09-11 không có AAD: sai ngữ cảnh thì thử lại không AAD để công ty cũ khỏi đăng nhập
 * lại. Blob MỚI không lọt nhánh này (tag tính kèm AAD, bỏ AAD là tag lệch); blob cũ tự lên dạng mới ở lần
 * lưu kế tiếp (mỗi lần đăng nhập bằng mật khẩu gõ / nối lại Drive).
 */
export function decryptGdtPassword(blob: EncryptedBlob, nguCanh?: string): string | null {
  const key = getKey();
  if (!key) return null;
  const tag = Buffer.from(blob.tag, "base64");
  if (tag.length !== TAG_BYTES) return null;
  const kq = giaiMa(key, blob, tag, nguCanh);
  if (kq !== null || nguCanh === undefined) return kq;
  return giaiMa(key, blob, tag);
}
