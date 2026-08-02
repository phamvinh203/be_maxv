import { GLYPH_SIGNATURES } from './glyphSignatures'

/**
 * ĐỌC MÃ CAPTCHA THẲNG TỪ MÃ NGUỒN SVG — không phải OCR (không hề nhìn pixel ảnh).
 *
 * Backend sinh captcha bằng thư viện `svg-captcha`: mỗi ký tự được vẽ thành một thẻ <path>, lấy từ
 * đường viền glyph của font. Điểm mấu chốt: CHUỖI LỆNH vẽ path (M/L/Q/C/Z) của mỗi ký tự là CỐ ĐỊNH
 * do font quy định — chữ "A" luôn cùng một dãy lệnh, khác dãy của "B". Thư viện có rắc thêm nhiễu
 * ±0.1px vào từng tọa độ để chống bot, nhưng nhiễu chỉ DỊCH ĐIỂM chứ không thêm/bớt lệnh nào.
 *
 * => Dãy lệnh (sau khi bỏ hết tọa độ) chính là "vân tay" nhận dạng ký tự. Ta tra vân tay đó trong
 * bảng `GLYPH_SIGNATURES` để ra ký tự, rồi sắp lại theo vị trí ngang -> ra chuỗi mã captcha.
 *
 * Mục đích: TỰ ĐIỀN sẵn ô nhập captcha cho đỡ phải gõ. Server vẫn là nơi quyết định mã đúng/sai —
 * đây chỉ là mẹo đọc trước đáp án từ chính cái ảnh SVG.
 */

/**
 * Regex bắt path của KÝ TỰ: `<path fill="#rrggbb" d="…"/>`.
 * Đường NHIỄU trong SVG có dạng `<path d="…" stroke="…" fill="none"/>`, nên chỉ cần đòi thuộc tính
 * `fill` là một mã màu hex thì tự loại được nhiễu. `{3,6}`: svg-captcha xuất hex 6 số khi bật màu
 * (`random.color()`) và 3 số khi tắt màu (`greyColor()`) — nhận cả hai. Nhóm bắt `([^"]+)` là dữ
 * liệu đường vẽ trong thuộc tính `d`.
 */
const CHAR_PATH_RE = /<path fill="#[0-9a-fA-F]{3,6}" d="([^"]+)"\/>/g
/** Bắt mọi con số (kể cả âm/thập phân) trong chuỗi `d` — dùng để lấy tọa độ. */
const NUMBER_RE = /-?[\d.]+/g
/** Tiền tố khi captcha được đưa vào dưới dạng data-URI base64 (phòng xa; luồng hiện tại là SVG thô). */
const DATA_URI_PREFIX = 'data:image/svg+xml;base64,'

/**
 * "Vân tay" của một glyph: chỉ giữ lại DÃY CHỮ CÁI LỆNH (M/L/Q/C/Z), bỏ hết số.
 * Vì nhiễu ±0.1px chỉ đổi các con số nên không đụng tới dãy lệnh — đây là khóa bền vững để tra
 * `GLYPH_SIGNATURES`.
 */
function signatureOf(pathData: string): string {
  return (pathData.match(/[MLQCZ]/g) ?? []).join('')
}

/**
 * Tâm ngang (tọa độ x) của glyph — dùng để KHÔI PHỤC THỨ TỰ ĐỌC.
 * svg-captcha XÁO TRỘN thứ tự các thẻ <path> trước khi xuất (sort ngẫu nhiên) nên không thể đọc theo
 * thứ tự xuất hiện trong SVG. Trong một chuỗi `d`, các số là cặp x/y xen kẽ, nên số ở vị trí CHẴN
 * (0, 2, 4…) chính là các tọa độ x; lấy tâm = (x nhỏ nhất + x lớn nhất) / 2.
 */
function centerXOf(pathData: string): number {
  const numbers = (pathData.match(NUMBER_RE) ?? []).map(Number)
  const xs = numbers.filter((_, index) => index % 2 === 0)
  if (xs.length === 0) return 0
  return (Math.min(...xs) + Math.max(...xs)) / 2
}

/**
 * Chuẩn hóa đầu vào về markup SVG: nhận SVG thô hoặc data-URI base64, trả về chuỗi markup (hoặc
 * `null` nếu không phải SVG). Luồng hiện tại `captcha.content` là SVG thô nên trả thẳng; nhánh
 * base64 (`atob`) chỉ để phòng khi nguồn khác đưa data-URI.
 */
function toSvgSource(svgData: string): string | null {
  if (!svgData.startsWith(DATA_URI_PREFIX)) {
    return svgData.includes('<svg') ? svgData : null
  }

  try {
    return atob(svgData.slice(DATA_URI_PREFIX.length))
  } catch {
    return null
  }
}

/**
 * Giải captcha từ `svgData` (chính là `content` của API) -> chuỗi mã, hoặc `null` nếu không đọc
 * được. Các bước:
 *   1. Chuẩn hóa về markup SVG.
 *   2. Rút chuỗi `d` của MỌI path ký tự (đã loại nhiễu) qua `CHAR_PATH_RE`.
 *   3. Mỗi glyph -> { tâm x, ký tự tra được từ vân tay }.
 *   4. Sắp theo tâm x tăng dần (trái -> phải) cho đúng thứ tự đọc.
 *   5. Nếu có glyph nào KHÔNG tra ra ký tự (bảng lỗi thời, vd font đổi) -> trả `null`: thà báo đọc
 *      không được còn hơn tự điền một mã sai một nửa.
 *   6. Ghép các ký tự lại thành chuỗi mã.
 */
export function solveCaptcha(svgData: string): string | null {
  const svg = toSvgSource(svgData)
  if (!svg) return null

  const glyphs = [...svg.matchAll(CHAR_PATH_RE)].map((match) => match[1])
  if (glyphs.length === 0) return null

  const solved = glyphs
    .map((pathData) => ({
      centerX: centerXOf(pathData),
      char: GLYPH_SIGNATURES[signatureOf(pathData)],
    }))
    .sort((a, b) => a.centerX - b.centerX)

  if (solved.some((glyph) => glyph.char === undefined)) return null

  return solved.map((glyph) => glyph.char).join('')
}
