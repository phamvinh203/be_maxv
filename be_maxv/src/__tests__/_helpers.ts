/**
 * Tiện ích dùng chung cho test luồng CHẠY NỀN — `gdtUpdateRun`, `luotChayNen`, `dvcDongBoRun` đều
 * cần đúng hai thứ này và trước đây mỗi file chép một bản y hệt.
 *
 * KHÔNG đặt tên `*.test.ts`: `npx tsx --test src/__tests__/*.test.ts` sẽ coi nó là bộ test rỗng.
 */

/** Nhường một nhịp event-loop để phần `void (async …)` của kho lượt chạy kịp chạy xong. */
export const tick = () => new Promise((r) => setTimeout(r, 10));

/** Promise mở được từ bên ngoài — để test giữ lượt ở trạng thái đang chạy bao lâu tùy ý. */
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
