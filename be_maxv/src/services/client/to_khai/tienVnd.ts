/**
 * Quy tắc làm tròn tiền của tờ khai 01/GTGT — MỘT quy tắc duy nhất, dùng cho cả bộ chỉ tiêu lẫn
 * cột (6) của phụ lục giảm thuế.
 *
 * Hàm THUẦN — test ở `src/__tests__/tinhGtgt01.test.ts` và `phuLuc204.test.ts`.
 */

/** Trả 0 thay cho `-0` — không ô tiền nào nên mang dấu âm mà giá trị bằng không. */
function khongAmKhong(v: number): number {
  return v === 0 ? 0 : v;
}

/**
 * Làm tròn về đồng, **nửa ra xa 0** — quy ước làm tròn tiền.
 *
 * Không dùng thẳng `Math.round`: JS làm tròn về phía +∞ nên `Math.round(-1,5)` ra `-1` và
 * `Math.round(-0,5)` ra `-0`, trong khi đúng phải là `-2` và `-1`. Ô âm xuất hiện khi kỳ trả hàng
 * nhiều hơn bán.
 *
 * Cột (6) phụ lục giảm thuế cũng dùng hàm này. Từng có lúc dùng `Math.trunc` (cắt phần lẻ) dựa
 * trên suy luận ngược từ [22] của kỳ sau; hai phụ lục THẬT của MST 0111142786 bác điều đó:
 *   Q1/2026: 4.631.817.848 x 2% = 92.636.356,96 -> phụ lục khai 92.636.357 (tròn thường)
 *   Q2/2026: 7.093.463.577 x 2% = 141.869.271,54 -> khai 141.869.272 (tròn thường)
 * Cắt phần lẻ cho 92.636.356 và 141.869.271, sai cả hai.
 */
export function lamTronDong(n: number): number {
  return khongAmKhong(n < 0 ? -Math.round(-n) : Math.round(n));
}

