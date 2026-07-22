/**
 * PACER theo MST (khóa = donViId của công ty) — điều tiết nhịp gọi GDT của CÙNG một MST để không
 * vượt rate-limit (GDT trả 429 khi bị dội). Hiện engine tải chi tiết (`runDetailFetch`) đi qua đây;
 * luồng tra CHI TIẾT LẺ vẫn tự giãn nhịp riêng. Đặc điểm:
 *
 *  - Tuần tự (concurrency = 1): mỗi lúc chỉ 1 call GDT chạy trên 1 MST.
 *  - Khoảng cách tối thiểu THÍCH ỨNG giữa các call: bắt đầu ~500ms; gặp 429 -> giãn ra (×1.5, trần
 *    5s) qua `reportRateLimited`; chuỗi thành công -> co lại về sàn 250ms qua `reportOk`.
 *  - MỘT hàng đợi FIFO duy nhất: mọi task đều do người dùng kích hoạt nên không cần phân mức ưu tiên.
 *
 * Trạng thái nằm in-memory theo tiến trình BE (rate-limit là ràng buộc runtime, không cần bền).
 */

interface QueueItem {
  /** Chạy task đã xếp hàng (resolve/reject promise của `schedule`); trả promise để pump đợi xong. */
  run: () => Promise<void>;
}

interface Pacer {
  queue: QueueItem[];
  /** Đang có vòng pump chạy (đợi interval / đợi task) — tránh chạy 2 pump song song trên 1 khóa. */
  active: boolean;
  intervalMs: number;
  /** Mốc bắt đầu call gần nhất — để ép khoảng cách tối thiểu giữa 2 lần bắt đầu. */
  lastStartAt: number;
}

/**
 * Nhịp gọi GDT. Số liệu đo thực tế (đồng bộ 2 ngày, nhánh `sco-query`): với sàn 250ms thì cứ vài
 * trang liên tiếp là GDT "nuốt" 1 call (treo tới hết timeout) — 84% thời gian của lượt đồng bộ là
 * ngồi chờ timeout. Nên đi CHẬM mà CHẮC: sàn ~800ms, và khi bị nuốt thì giãn MẠNH (×2, trần 15s)
 * rồi co lại từ từ, thay vì lao về sàn sau vài lần thành công.
 */
const START_MS = 800;
const MIN_MS = 800;
const MAX_MS = 15_000;

const pacers = new Map<string, Pacer>();

function getPacer(key: string): Pacer {
  let p = pacers.get(key);
  if (!p) {
    p = { queue: [], active: false, intervalMs: START_MS, lastStartAt: 0 };
    pacers.set(key, p);
  }
  return p;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Vòng bơm: rút task đầu hàng -> đợi đủ interval -> chạy tới xong -> lặp. Chỉ 1 vòng/khóa. */
async function pump(key: string): Promise<void> {
  const p = getPacer(key);
  if (p.active) return;
  p.active = true;
  try {
    for (;;) {
      const item = p.queue.shift();
      if (!item) break;
      const wait = p.lastStartAt + p.intervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      p.lastStartAt = Date.now();
      await item.run(); // concurrency=1: đợi task xong mới sang task kế
    }
  } finally {
    p.active = false;
  }
}

/**
 * Xếp `fn` (1 call GDT) vào hàng đợi của MST `key`, trả về kết quả `fn`. Tôn trọng concurrency=1 +
 * interval thích ứng, chạy theo thứ tự FIFO. Lỗi của `fn` được ném lại cho nơi gọi (để engine quyết
 * định retry hay bỏ qua).
 */
export function schedule<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item: QueueItem = {
      run: async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      },
    };
    getPacer(key).queue.push(item);
    void pump(key);
  });
}

/** GDT vừa báo quá tải (429/500/timeout/bị nuốt) -> giãn MẠNH khoảng cách các call (×2, có trần). */
export function reportRateLimited(key: string): void {
  const p = getPacer(key);
  p.intervalMs = Math.min(MAX_MS, Math.max(START_MS, p.intervalMs * 2));
}

/**
 * 1 call thành công -> co dần khoảng cách về sàn (dò tốc độ tối đa an toàn). Co CHẬM (-50ms/call):
 * đã bị giãn lên 6-10s thì cần vài chục trang trót lọt mới về sàn, tránh vừa hết bị chặn đã lao lại.
 */
export function reportOk(key: string): void {
  const p = getPacer(key);
  p.intervalMs = Math.max(MIN_MS, p.intervalMs - 50);
}
