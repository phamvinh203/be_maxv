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

/** Một bản ghi trong mục lục — chỉ metadata, dữ liệu lấy sau bằng `readEntryData`. */
interface CentralEntry {
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  localOffset: number;
}

/**
 * Duyệt mục lục (central directory) của ZIP.
 *
 * Đọc từ MỤC LỤC chứ không quét local header: khi bit 3 của general purpose flags bật, local header
 * ghi kích thước = 0 và số thật nằm ở data descriptor SAU phần dữ liệu; mục lục thì luôn có số đúng.
 *
 * Generator để nơi gọi dừng sớm khi đã tìm thấy — khỏi đọc nốt mục lục.
 */
function* duyetMucLuc(zip: Buffer): Generator<CentralEntry> {
  const eocd = findEndOfCentralDirectory(zip);
  if (eocd < 0) {
    throw new Error("Dữ liệu tải về không phải file ZIP hợp lệ (thiếu bản ghi cuối).");
  }

  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if (offset === ZIP64_MARKER) {
    throw new Error("ZIP dùng định dạng ZIP64 — chưa hỗ trợ.");
  }

  for (let i = 0; i < entryCount; i += 1) {
    if (
      offset + CENTRAL_ENTRY_SIZE > zip.length ||
      zip.readUInt32LE(offset) !== CENTRAL_FILE_SIGNATURE
    ) {
      throw new Error("ZIP hỏng: mục lục không đọc được.");
    }

    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    const nameStart = offset + CENTRAL_ENTRY_SIZE;

    yield {
      name: zip.toString("utf8", nameStart, nameStart + nameLen),
      flags: zip.readUInt16LE(offset + 8),
      method: zip.readUInt16LE(offset + 10),
      compressedSize: zip.readUInt32LE(offset + 20),
      localOffset: zip.readUInt32LE(offset + 42),
    };

    offset += CENTRAL_ENTRY_SIZE + nameLen + extraLen + commentLen;
  }
}

/** Giải nén 1 entry đã tìm được, sau khi loại các ca chưa hỗ trợ. */
function giaiNen(zip: Buffer, e: CentralEntry): Buffer {
  if (e.flags & FLAG_ENCRYPTED) {
    throw new Error(`ZIP: "${e.name}" được đặt mật khẩu.`);
  }
  if (e.compressedSize === ZIP64_MARKER || e.localOffset === ZIP64_MARKER) {
    throw new Error(`ZIP: "${e.name}" dùng định dạng ZIP64 — chưa hỗ trợ.`);
  }
  return readEntryData(zip, e.localOffset, e.method, e.compressedSize, e.name);
}

/**
 * Trả nội dung entry tên `entryName` trong `zip`, hoặc `null` nếu ZIP không có entry đó.
 *
 * So khớp theo TÊN CUỐI đường dẫn và KHÔNG phân biệt hoa thường — phòng bên đóng gói bọc thêm thư
 * mục cha (`hoadon/invoice.xml`) hoặc đổi cách viết hoa.
 */
export function readZipEntry(zip: Buffer, entryName: string): Buffer | null {
  const wanted = entryName.toLowerCase();
  for (const e of duyetMucLuc(zip)) {
    if (e.name.split("/").pop()?.toLowerCase() === wanted) return giaiNen(zip, e);
  }
  return null;
}

/**
 * Trả entry ĐẦU TIÊN có đuôi `ext` (vd `".pdf"`, so không phân biệt hoa thường), kèm tên để đặt tên
 * file. `null` nếu không có.
 *
 * Dùng khi KHÔNG biết trước tên file bên trong: EasyInvoice đóng gói `HOADON_<mst>_<mẫu>_<số>.zip`
 * gồm PDF + XML ký số, tên PDF đổi theo từng hóa đơn nên chỉ bám được vào đuôi.
 * Bỏ qua entry thư mục (tên kết thúc bằng `/`).
 */
export function readZipEntryByExtension(
  zip: Buffer,
  ext: string,
): { name: string; data: Buffer } | null {
  const duoi = ext.toLowerCase();
  for (const e of duyetMucLuc(zip)) {
    if (e.name.endsWith("/")) continue;
    if (!e.name.toLowerCase().endsWith(duoi)) continue;
    return { name: e.name, data: giaiNen(zip, e) };
  }
  return null;
}

/** Tên mọi entry trong ZIP — để báo lỗi "trong gói có gì" mà không phải tải file về mở tay. */
export function listZipEntryNames(zip: Buffer): string[] {
  return Array.from(duyetMucLuc(zip), (e) => e.name);
}
