/** Chia danh sách thành các lô để truy vấn hoặc ghi DB theo từng đợt an toàn. */
export function chiaLo<T>(ds: readonly T[], moiLo: number): T[][] {
  const ra: T[][] = [];
  for (let i = 0; i < ds.length; i += moiLo) ra.push(ds.slice(i, i + moiLo));
  return ra;
}
