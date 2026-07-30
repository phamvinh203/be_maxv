/**
 * Đọc MỘT entry trong file ZIP nằm sẵn trong RAM. Đây KHÔNG phải thư viện ZIP đầy đủ — chỉ đủ dùng
 * cho gói `export-xml` của cổng thuế (vài trăm KB, 5 entry, nén deflate/store). Tự viết trên `zlib`
 * có sẵn của Node thay vì thêm dependency vì dự án giữ mốc 0 lỗ hổng `npm audit`.
 *
 * CHƯA hỗ trợ (ném lỗi rõ ràng thay vì trả dữ liệu sai): ZIP64, entry đặt mật khẩu, kiểu nén khác
 * store/deflate.
 */
import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

/** Bản ghi cuối (EOCD) dài 22 byte, sau nó có thể còn comment dài tối đa 65535 byte. */
const EOCD_SIZE = 22;
const EOCD_MAX_SCAN = EOCD_SIZE + 0xffff;
/** Kích thước cố định của 1 bản ghi trong mục lục / của local file header. */
const CENTRAL_ENTRY_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

/** Bit 0 của "general purpose flags" = entry được mã hóa bằng mật khẩu. */
const FLAG_ENCRYPTED = 0x1;
/** Giá trị tràn 32-bit: số thật nằm ở trường mở rộng ZIP64. */
const ZIP64_MARKER = 0xffffffff;

/** Trần dữ liệu giải nén cho 1 entry — chống zip bomb làm OOM cả tiến trình (xem `readEntryData`). */
const MAX_INFLATE_BYTES = 32 * 1024 * 1024;

/**
 * Tìm offset bản ghi EOCD. Quét NGƯỢC từ cuối file vì comment (nếu có) nằm SAU bản ghi này, nên
 * chữ ký khớp gần cuối nhất mới là bản ghi thật.
 *
 * Chỉ khớp chữ ký là chưa đủ: 4 byte đó có thể tình cờ nằm trong comment hoặc trong phần dữ liệu
 * còn lại của một file bị cắt, và khi đó `entryCount`/offset mục lục sẽ đọc từ rác. Đối chiếu thêm
 * trường độ dài comment với số byte còn lại thì mới chắc đây là bản ghi thật.
 */
function findEndOfCentralDirectory(zip: Buffer): number {
  const stopAt = Math.max(0, zip.length - EOCD_MAX_SCAN);
  for (let i = zip.length - EOCD_SIZE; i >= stopAt; i -= 1) {
    if (
      zip.readUInt32LE(i) === EOCD_SIGNATURE &&
      zip.readUInt16LE(i + 20) === zip.length - i - EOCD_SIZE
    ) {
      return i;
    }
  }
  return -1;
}

/** Giải nén phần dữ liệu của 1 entry, định vị qua local file header. */
function readEntryData(
  zip: Buffer,
  localOffset: number,
  method: number,
  compressedSize: number,
  name: string,
): Buffer {
  if (
    localOffset + LOCAL_HEADER_SIZE > zip.length ||
    zip.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE
  ) {
    throw new Error(`ZIP hỏng: không định vị được dữ liệu của "${name}".`);
  }

  // Độ dài name/extra ở LOCAL header có thể KHÁC trong mục lục (hai nơi được phép ghi extra field
  // khác nhau) nên bắt buộc đọc lại tại đây, không tái dùng số của mục lục.
  const nameLen = zip.readUInt16LE(localOffset + 26);
  const extraLen = zip.readUInt16LE(localOffset + 28);
  const start = localOffset + LOCAL_HEADER_SIZE + nameLen + extraLen;
  const end = start + compressedSize;
  if (end > zip.length) {
    throw new Error(`ZIP hỏng: dữ liệu của "${name}" bị cắt ngắn.`);
  }

  const data = zip.subarray(start, end);
  if (method === METHOD_STORE) return Buffer.from(data);
  // `maxOutputLength` chặn zip bomb: gói vài chục KB hỏng/độc có thể giải nén thành nhiều GB và
  // giết CẢ tiến trình BE (tức là mọi tenant) bằng OOM. Cổng thuế là nguồn đáng tin, nhưng đây vẫn
  // là dữ liệu từ ngoài. Hóa đơn XML thực tế ~13KB nên 32MB đã là biên rất rộng.
  if (method === METHOD_DEFLATE) return inflateRawSync(data, { maxOutputLength: MAX_INFLATE_BYTES });
  throw new Error(`ZIP: "${name}" dùng kiểu nén chưa hỗ trợ (method ${method}).`);
}

/**
 * Trả nội dung entry tên `entryName` trong `zip`, hoặc `null` nếu ZIP không có entry đó.
 *
 * So khớp theo TÊN CUỐI đường dẫn và KHÔNG phân biệt hoa thường — phòng bên đóng gói bọc thêm thư
 * mục cha (`hoadon/invoice.xml`) hoặc đổi cách viết hoa.
 */
export function readZipEntry(zip: Buffer, entryName: string): Buffer | null {
  const eocd = findEndOfCentralDirectory(zip);
  if (eocd < 0) {
    throw new Error("Dữ liệu tải về không phải file ZIP hợp lệ (thiếu bản ghi cuối).");
  }

  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if (offset === ZIP64_MARKER) {
    throw new Error("ZIP dùng định dạng ZIP64 — chưa hỗ trợ.");
  }

  const wanted = entryName.toLowerCase();

  for (let i = 0; i < entryCount; i += 1) {
    if (
      offset + CENTRAL_ENTRY_SIZE > zip.length ||
      zip.readUInt32LE(offset) !== CENTRAL_FILE_SIGNATURE
    ) {
      throw new Error("ZIP hỏng: mục lục không đọc được.");
    }

    const flags = zip.readUInt16LE(offset + 8);
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const nameStart = offset + CENTRAL_ENTRY_SIZE;
    const name = zip.toString("utf8", nameStart, nameStart + nameLen);

    if (name.split("/").pop()?.toLowerCase() === wanted) {
      if (flags & FLAG_ENCRYPTED) {
        throw new Error(`ZIP: "${name}" được đặt mật khẩu.`);
      }
      if (compressedSize === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
        throw new Error(`ZIP: "${name}" dùng định dạng ZIP64 — chưa hỗ trợ.`);
      }
      return readEntryData(zip, localOffset, method, compressedSize, name);
    }

    offset += CENTRAL_ENTRY_SIZE + nameLen + extraLen + commentLen;
  }

  return null;
}
