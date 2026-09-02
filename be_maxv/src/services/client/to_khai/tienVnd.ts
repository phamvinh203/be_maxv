/**
 * Hai quy tắc làm tròn tiền của tờ khai 01/GTGT. Mọi ô tiền là số nguyên đồng, nhưng KHÔNG phải
 * chỗ nào cũng tròn theo cùng một kiểu — và đó chính là lý do hai hàm này ở chung một file:
 * người sửa thấy ngay là có hai quy tắc, không tưởng nhầm còn một.
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
 */
export function lamTronDong(n: number): number {
  return khongAmKhong(n < 0 ? -Math.round(-n) : Math.round(n));
}

/**
 * CẮT phần lẻ về phía 0 — chỉ dùng cho cột (6) của phụ lục giảm thuế, KHÔNG phải phép làm tròn
 * chung. Đối chiếu hai kỳ thật của MST 0106861880:
 *
 *   Q1/2026: 251.896.634 x 2% = 5.037.932,68 -> phải ra 5.037.932 (tròn thường cho 5.037.933)
 *   Q2/2026: 391.249.917 x 2% = 7.824.998,34 -> 7.824.998 (hai cách cho cùng kết quả)
 *
 * Chỉ cắt-về-0 khớp CẢ HAI: [33] = lamTronDong([32] x 10%) - số này, và [33] của hai kỳ đã nộp lần
 * lượt là 20.151.731 và 31.299.994. Tròn thường làm Q1 lệch một đồng, rồi lệch đó chảy qua [43]
 * sang [22] của kỳ sau.
 *
 * `trunc` chứ không `floor`: hai kỳ đối chứng đều dương nên hai hàm cho kết quả y hệt, nhưng khi
 * hóa đơn điều chỉnh giảm kéo nhóm 8% xuống âm thì `floor(-0,02) = -1` bịa ra một đồng được giảm,
 * còn `trunc(-0,02) = 0` mới đúng nghĩa "cắt phần lẻ".
 */
export function catPhanLe(n: number): number {
  return khongAmKhong(Math.trunc(n));
}
