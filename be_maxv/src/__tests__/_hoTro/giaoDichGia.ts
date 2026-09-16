/* eslint-disable @typescript-eslint/no-explicit-any -- bọc DB giả mô phỏng Prisma: kiểu lỏng có chủ đích */

/** Tiền tố nhật ký cho lệnh chạy TRÊN `db` trong lúc một giao dịch đang mở. */
export const NGOAI_GIAO_DICH = 'NGOÀI GIAO DỊCH: ';

/**
 * RVW-733 — DB giả vốn truyền chính `db` làm `tx`, nên nếu ai đó đổi một lệnh trong callback thành
 * `db.otherIncomeRecord.create` (chạy trên kết nối khác, ngoài giao dịch và ngoài khóa dòng kỳ) thì nhật ký vẫn ra
 * đúng thứ tự BEGIN → khóa → kiểm → ghi → END và ca kiểm vẫn xanh.
 *
 * Đối tượng trả về đây là thứ giao cho service, còn `$transaction` giả vẫn truyền đối tượng GỐC làm `tx`. Nhờ vậy
 * lệnh nào đi qua proxy này trong lúc giao dịch đang mở đều bị đánh dấu vào nhật ký, và `soatNgoaiGiaoDich()` gọi ở
 * `finally` của `$transaction` sẽ ném lỗi ngay thay vì để ca kiểm xanh giả.
 */
export function bocNgoaiGiaoDich<T extends object>(
  goc: T,
  nhatKy: string[],
  dangMoGiaoDich: () => boolean,
): T {
  const daBoc = new Map<PropertyKey, unknown>();
  return new Proxy(goc as any, {
    get(muc: any, khoa: PropertyKey) {
      const gt = muc[khoa];
      if (typeof gt === 'function') {
        return (...ds: any[]) => {
          const ngoai = dangMoGiaoDich();
          const truoc = nhatKy.length;
          const danhDau = () => {
            if (!ngoai) return;
            for (let i = truoc; i < nhatKy.length; i++) {
              if (!nhatKy[i]!.startsWith(NGOAI_GIAO_DICH)) {
                nhatKy[i] = NGOAI_GIAO_DICH + nhatKy[i];
              }
            }
          };
          const kq = gt.apply(muc, ds);
          if (kq && typeof kq.then === 'function') {
            return kq.then(
              (v: unknown) => {
                danhDau();
                return v;
              },
              (e: unknown) => {
                danhDau();
                throw e;
              },
            );
          }
          danhDau();
          return kq;
        };
      }
      // Chỉ bọc các đối tượng KIỂU MODEL (có hàm bên trong); dữ liệu thuần như `ky`, `nhatKy`, `locks` trả nguyên
      // để ca kiểm đọc và sửa trực tiếp như trước.
      if (
        gt &&
        typeof gt === 'object' &&
        !Array.isArray(gt) &&
        Object.values(gt).some((v) => typeof v === 'function')
      ) {
        if (!daBoc.has(khoa)) {
          daBoc.set(khoa, bocNgoaiGiaoDich(gt, nhatKy, dangMoGiaoDich));
        }
        return daBoc.get(khoa);
      }
      return gt;
    },
  }) as T;
}

/** Ném lỗi nếu nhật ký có lệnh chạy ngoài giao dịch — gọi ở `finally` của `$transaction` giả. */
export function soatNgoaiGiaoDich(nhatKy: string[]): void {
  const lac = nhatKy.filter((d) => d.startsWith(NGOAI_GIAO_DICH));
  if (lac.length > 0) {
    throw new Error(
      `Lệnh chạy NGOÀI giao dịch trong lúc giao dịch đang mở (RVW-733): ${lac.join(' · ')}`,
    );
  }
}
