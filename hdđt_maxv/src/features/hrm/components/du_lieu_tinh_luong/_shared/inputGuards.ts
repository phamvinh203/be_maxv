/**
 * Chặn ô nhập số ở các bảng đang soạn của "Dữ liệu tính lương" (KPI, Tăng ca,
 * Lương sản phẩm, Lương phần trăm, Chuyên cần) — `slotProps.htmlInput.min=0`
 * của MUI chỉ chặn nút mũi tên, KHÔNG chặn gõ tay số âm (RVW-703).
 */

/** Ép số không âm — dùng cho mọi ô số bắt buộc dương. */
export function soDuong(v: string | number): number {
  return Math.max(0, Number(v) || 0);
}

/** Ép số không âm và không vượt quá 100 — dùng cho ô tỉ lệ phần trăm. */
export function tyLeHopLe(v: string | number): number {
  return Math.min(100, soDuong(v));
}
