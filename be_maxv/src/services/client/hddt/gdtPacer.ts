/**
 * PACER theo MST (khóa = donViId của công ty) — điều tiết nhịp gọi GDT của CÙNG một MST để không
 * vượt rate-limit (GDT trả 429 khi bị dội). Hiện engine tải chi tiết (`runDetailFetch`) và engine
 * lấy danh sách (`fetchListPagePaced`) đều đi qua đây; luồng tra CHI TIẾT LẺ vẫn tự giãn nhịp riêng.
 * Đặc điểm:
 *
 *  - Tuần tự (concurrency = 1): mỗi lúc chỉ 1 call GDT chạy trên 1 MST — MỘT hàng đợi FIFO duy nhất
 *    cho cả 2 làn, vì ràng buộc "đừng dội GDT bằng 2 call song song trên 1 token" là chung.
 *  - Khoảng cách tối thiểu THÍCH ỨNG giữa các call, nhưng ĐO RIÊNG THEO LÀN (xem `Lane` bên dưới):
 *    gặp 429/timeout -> giãn (×2, trần 15s) qua `reportRateLimited`; thành công -> co lại về sàn
 *    800ms qua `reportOk`.
 *
 * Trạng thái nằm in-memory theo tiến trình BE (rate-limit là ràng buộc runtime, không cần bền).
 */

/**
 * LÀN gọi GDT — mỗi làn giữ `intervalMs` RIÊNG.
 *
 * Lý do tách: 1 call `list` trả về 50 hóa đơn, 1 call `detail` chỉ trả 1. Nhánh `sco-query` của
 * danh sách hay bị GDT "nuốt" nên làn `list` thường xuyên bị giãn tới trần 15s — trước đây hai làn
 * DÙNG CHUNG một `intervalMs`, nên pha chi tiết chạy ngay sau pha danh sách (xem `startUpdateRun`)
 * kế thừa nguyên hình phạt đó và bò với 15s/HÓA ĐƠN dù bản thân endpoint detail chưa hề bị chặn.
 * Tách làn = mỗi endpoint tự trả giá cho lỗi của chính nó. KHÔNG tăng tải lên GDT: hàng đợi vẫn là
 * một, concurrency vẫn là 1.
 */
export type Lane = "list" | "detail";

interface QueueItem {
  /** Làn của task — quyết định phải giãn bao lâu trước khi chạy. */
  lane: Lane;
  /** Chạy task đã xếp hàng (resolve/reject promise của `schedule`); trả promise để pump đợi xong. */
  run: () => Promise<void>;
}

interface Pacer {
  /** MỘT hàng đợi cho cả 2 làn — giữ concurrency=1 trên mỗi MST. */
  queue: QueueItem[];
  /** Đang có vòng pump chạy (đợi interval / đợi task) — tránh chạy 2 pump song song trên 1 khóa. */
  active: boolean;
  /** Khoảng cách tối thiểu hiện tại của TỪNG làn (thích ứng độc lập). */
  intervalMs: Record<Lane, number>;
  /** Mốc bắt đầu call gần nhất (mọi làn) — để ép khoảng cách tối thiểu giữa 2 lần bắt đầu. */
  lastStartAt: number;
}

/**
 * Nhịp gọi GDT. Số liệu đo thực tế (đồng bộ 2 ngày, nhánh `sco-query`): với sàn 250ms thì cứ vài
 * trang liên tiếp là GDT "nuốt" 1 call (treo tới hết timeout) — 84% thời gian của lượt đồng bộ là
 * ngồi chờ timeout. Nên đi CHẬM mà CHẮC: sàn ~800ms, và khi bị nuốt thì giãn MẠNH (×2, trần 15s).
 */
const START_MS = 800;
const MIN_MS = 800;
const MAX_MS = 15_000;

/**
 * Hệ số co khi call thành công. Trước đây co TUYẾN TÍNH −50ms/call, lệch hẳn so với chiều tăng
 * (×2/lỗi): từ trần 15s về sàn 800ms cần 284 call trót lọt, mất ~37 PHÚT chỉ để hết bị phạt — mà
 * với làn detail thì mỗi call chỉ là 1 hóa đơn, nên đó là 37 phút cho 284 hóa đơn. Co theo cấp số
 * nhân ×0,9 đưa 15s về sàn trong ~28 call (~2,4 phút), đúng với chủ ý ban đầu ("cần vài chục call
 * trót lọt mới về sàn") thay vì vài trăm.
 */
const OK_DECAY = 0.9;

const pacers = new Map<string, Pacer>();

function getPacer(key: string): Pacer {
  let p = pacers.get(key);
  if (!p) {
    p = {
      queue: [],
      active: false,
      intervalMs: { list: START_MS, detail: START_MS },
      lastStartAt: 0,
    };
    pacers.set(key, p);
  }
  return p;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Vòng bơm: rút task đầu hàng -> đợi đủ interval CỦA LÀN TASK ĐÓ -> chạy tới xong -> lặp.
 * Chỉ 1 vòng/khóa. `lastStartAt` dùng chung mọi làn: khoảng cách ép là "làn này cần nghỉ bao lâu
 * kể từ call GDT gần nhất", bất kể call đó thuộc làn nào.
 */
async function pump(key: string): Promise<void> {
  const p = getPacer(key);
  if (p.active) return;
  p.active = true;
  try {
    for (;;) {
      const item = p.queue.shift();
      if (!item) break;
      const wait = p.lastStartAt + p.intervalMs[item.lane] - Date.now();
      if (wait > 0) await sleep(wait);
      p.lastStartAt = Date.now();
      await item.run(); // concurrency=1: đợi task xong mới sang task kế
    }
  } finally {
    p.active = false;
  }
}

/**
 * Xếp `fn` (1 call GDT thuộc làn `lane`) vào hàng đợi của MST `key`, trả về kết quả `fn`. Tôn trọng
 * concurrency=1 + interval thích ứng của làn, chạy theo thứ tự FIFO. Lỗi của `fn` được ném lại cho
 * nơi gọi (để engine quyết định retry hay bỏ qua).
 */
export function schedule<T>(key: string, lane: Lane, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item: QueueItem = {
      lane,
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

/**
 * GDT vừa báo quá tải (429/500/timeout/bị nuốt) trên làn `lane` -> giãn MẠNH khoảng cách các call
 * CỦA RIÊNG LÀN ĐÓ (×2, có trần). Làn còn lại không bị ảnh hưởng.
 */
export function reportRateLimited(key: string, lane: Lane): void {
  const p = getPacer(key);
  p.intervalMs[lane] = Math.min(MAX_MS, Math.max(START_MS, p.intervalMs[lane] * 2));
}

/**
 * 1 call thành công trên làn `lane` -> co dần khoảng cách của làn đó về sàn (dò tốc độ tối đa an
 * toàn). Xem `OK_DECAY` về việc vì sao co theo cấp số nhân chứ không trừ tuyến tính.
 */
export function reportOk(key: string, lane: Lane): void {
  const p = getPacer(key);
  p.intervalMs[lane] = Math.max(MIN_MS, p.intervalMs[lane] * OK_DECAY);
}

/**
 * Khoảng cách hiện tại của 1 làn (ms) — CHỈ để log/chẩn đoán tốc độ lượt chạy (`runDetailFetch` in
 * ra lúc bắt đầu và mỗi mốc tiến độ), không dùng để điều khiển luồng.
 */
export function getIntervalMs(key: string, lane: Lane): number {
  return getPacer(key).intervalMs[lane];
}
