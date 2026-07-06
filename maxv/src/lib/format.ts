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

/** Dung lượng theo đơn vị nhị phân (B/KB/MB/GB) hoặc '—' nếu rỗng. */
export function formatBytes(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Hiển thị giới hạn: null = "Không giới hạn". */
export function formatLimit(value: number | null): string {
  return value == null ? 'Không giới hạn' : String(value);
}
