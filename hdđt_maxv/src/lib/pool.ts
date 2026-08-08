/**
 * Bounded concurrency pool — chạy N việc đồng thời, không phụ thuộc thư viện ngoài.
 *
 * Dùng chung cho các lượt chạy hàng loạt của tab hóa đơn: xuất bộ file (`exportBundle`) và tải hóa đơn
 * gốc (`DownloadOriginalDialog`). Cả hai đều cần "đừng bắn hết một lúc" nhưng vì lý do khác nhau —
 * một bên sợ cổng thuế rate-limit, một bên sợ các lượt OCR ở BE giành CPU nhau.
 */

/**
 * Chạy `worker` trên `items` với tối đa `limit` việc đồng thời.
 *
 * `worker` KHÔNG được để lỗi thoát ra ngoài: một reject sẽ làm `Promise.all` đứt giữa chừng và bỏ dở
 * phần còn lại của hàng đợi. Nơi gọi tự bọc try/catch và ghi lỗi vào kết quả của từng item.
 */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    // `next++` đọc + tăng trong 1 tick (không await xen giữa) nên mỗi runner lấy 1 index riêng — an toàn.
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(runners);
}
