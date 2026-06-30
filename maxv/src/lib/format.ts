/** Định dạng tiền VND. */
export function formatVnd(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${n.toLocaleString('vi-VN')} ₫`;
}

/** Ngày (vi-VN) hoặc '—' nếu rỗng. */
export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '—';
}

/** Ngày + giờ (vi-VN) hoặc '—' nếu rỗng. */
export function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('vi-VN') : '—';
}
