/** Ngày (vi-VN) hoặc '—' nếu rỗng. */
export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '—';
}
