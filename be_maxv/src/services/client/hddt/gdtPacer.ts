/**
 * PACER theo MST (khóa = donViId của công ty) — điều tiết nhịp gọi cổng thuế của CÙNG một MST để
 * không vượt rate-limit (cổng trả 429 khi bị dội). Hiện engine tải chi tiết (`runDetailFetch`),
 * engine lấy danh sách (`fetchListPagePaced`) và TOÀN BỘ lưu lượng cổng Dịch vụ công (`dvcSend`)
 * đều đi qua đây; luồng tra CHI TIẾT LẺ vẫn tự giãn nhịp riêng.
 * Đặc điểm:
 *
 *  - Hàng đợi FIFO theo MST. `list`/`detail` dùng CHUNG một hàng đợi chạy tuần tự (concurrency = 1)
 *    vì ràng buộc "đừng dội GDT bằng 2 call song song trên 1 token" là chung; riêng `xml` có hàng
 *    đợi riêng chạy 2 call song song (xem `LANE_QUEUE` / `QUEUE_CONCURRENCY`).
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
 * Tách làn = mỗi endpoint tự trả giá cho lỗi của chính nó.
 *
 * `list` và `detail` vẫn dùng CHUNG một hàng đợi tuần tự — không tăng tải lên GDT so với bản đầu.
 * Riêng `xml` có hàng đợi riêng: xem `LANE_QUEUE` / `QUEUE_CONCURRENCY`.
 */
export type Lane = "list" | "detail" | "xml" | "dvc" | "etax-gnt";

/**
 * Làn `xml` (tải hóa đơn XML gốc, `export-xml`) có HÀNG ĐỢI RIÊNG, tách khỏi hàng đợi chung của
 * `list`/`detail`.
 *
 * Lý do: hai luồng này khác nhau về bản chất. `list`/`detail` là lượt đồng bộ chạy nền, chậm vài
 * phút không ai để ý. Còn `export-xml` chạy khi người dùng đang NGỒI CHỜ trước màn hình, mỗi call
 * tốn ~3 giây và cần một call cho MỖI hóa đơn — 500 hóa đơn tuần tự là 25 phút. Cho làn này hàng
 * đợi riêng vừa để chạy song song được, vừa để lượt xuất không phải xếp sau cả trăm call đồng bộ.
 */
type QueueName = "main" | "xml" | "dvc" | "etax-gnt";

/**
 * Hàng đợi của từng làn. `list`/`detail` dùng chung — ràng buộc "đừng dội GDT" của chúng là một.
 *
 * `dvc` có hàng đợi RIÊNG vì đó là host khác (dichvucong.gdt.gov.vn, không phải hoadondientu):
 * xếp chung thì một lượt đồng bộ HĐĐT hàng trăm call sẽ chặn đứng thao tác Dịch vụ công, mà hai
 * cổng chẳng liên quan gì tới rate-limit của nhau.
 *
 * `etax-gnt` cũng có hàng đợi RIÊNG cùng lý do `dvc`, cộng thêm: đây là MỘT host thứ BA
 * (thuedientu.gdt.gov.vn, khác cả `dichvucong.gdt.gov.vn` lẫn hoadondientu) — xếp chung với `dvc`
 * thì một lượt đồng bộ Giấy nộp tiền dài sẽ chặn đứng thao tác Tờ khai của cùng công ty dù hai
 * host không liên quan gì tới rate-limit của nhau, xem `gdt-etax-gnt.service.ts`.
 */
const LANE_QUEUE: Record<Lane, QueueName> = {
  list: "main",
  detail: "main",
  xml: "xml",
  dvc: "dvc",
  "etax-gnt": "etax-gnt",
};

/**
 * Số call chạy ĐỒNG THỜI trên mỗi hàng đợi.
 *
 * `main` = 1: giữ nguyên ràng buộc cũ (2 call song song trên 1 token làm GDT nuốt request).
 * `xml`  = 2: đo thực tế cho thấy cổng thuế chịu được, và đây là làn người dùng phải ngồi chờ.
 *   Nếu nâng lên mà thấy log `[DEBUG-XML] ... lỗi TẠM THỜI` tăng vọt thì hạ về 1 — dội mạnh khiến
 *   nhịp bị phạt ×2 tới trần 15s, hóa ra CHẬM HƠN chạy tuần tự.
 * `dvc`  = 1 và KHÔNG được nâng: mọi call Dịch vụ công của một công ty dùng CHUNG một phiên, và
 *   `dvcSend` ghi lại cookie cổng xoay vòng vào chính phiên đó sau mỗi lượt. Hai call song song là
 *   hai lượt cùng đọc-ghi một bộ cookie — tuần tự ở đây là ràng buộc ĐÚNG SAI, không phải lịch sự.
 * `etax-gnt` = 1, cùng lý do `dvc`: `EtaxGntSession` cũng giữ một bộ cookie + trạng thái
 *   `dse_processorId` xoay vòng theo TỪNG bước pipeline (xem `gdt-etax-gnt.service.ts`) — hai call
 *   song song sẽ giẫm lên nhau, gọi sai thứ tự trong phiên.
 *
 * Khóa là union `QueueName` chứ không phải `string`: thêm hàng đợi mới mà quên khai số này thì LỖI
 * BIÊN DỊCH, thay vì âm thầm chạy với 1 và biểu hiện thành "sao lượt này chậm thế".
 */
const QUEUE_CONCURRENCY: Record<QueueName, number> = { main: 1, xml: 2, dvc: 1, "etax-gnt": 1 };

interface QueueItem {
  /** Làn của task — quyết định phải giãn bao lâu trước khi chạy. */
  lane: Lane;
  /** Chạy task đã xếp hàng (resolve/reject promise của `schedule`); trả promise để pump đợi xong. */
  run: () => Promise<void>;
}

/** Một hàng đợi độc lập: danh sách chờ + số vòng bơm đang chạy + mốc call gần nhất. */
interface QueueState {
  items: QueueItem[];
  /** Số pump đang chạy — chặn ở `QUEUE_CONCURRENCY` của hàng đợi đó. */
  running: number;
  /** Mốc bắt đầu call gần nhất TRONG HÀNG ĐỢI NÀY — để ép khoảng cách tối thiểu. */
  lastStartAt: number;
}

interface Pacer {
  queues: Record<QueueName, QueueState>;
  /** Khoảng cách tối thiểu hiện tại của TỪNG làn (thích ứng độc lập). */
  intervalMs: Record<Lane, number>;
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

const newQueue = (): QueueState => ({ items: [], running: 0, lastStartAt: 0 });

function getPacer(key: string): Pacer {
  let p = pacers.get(key);
  if (!p) {
    p = {
      queues: { main: newQueue(), xml: newQueue(), dvc: newQueue(), "etax-gnt": newQueue() },
      intervalMs: {
        list: START_MS,
        detail: START_MS,
        xml: START_MS,
        dvc: START_MS,
        "etax-gnt": START_MS,
      },
    };
    pacers.set(key, p);
  }
  return p;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Vòng bơm: rút task đầu hàng -> đợi đủ interval CỦA LÀN TASK ĐÓ -> chạy tới xong -> lặp.
 *
 * Số vòng chạy đồng thời trên một hàng đợi bị chặn ở `QUEUE_CONCURRENCY`. `lastStartAt` tính theo
 * TỪNG HÀNG ĐỢI: khoảng cách ép là "cần nghỉ bao lâu kể từ call gần nhất CỦA CHÍNH hàng đợi này" —
 * hai hàng đợi độc lập nên không phải chờ nhau.
 */
async function pump(key: string, queueName: QueueName): Promise<void> {
  const p = getPacer(key);
  const q = p.queues[queueName];
  if (q.running >= QUEUE_CONCURRENCY[queueName]) return;
  q.running += 1;
  try {
    for (;;) {
      const item = q.items.shift();
      if (!item) break;
      // GIỮ CHỖ mốc khởi hành TRƯỚC khi ngủ. Nếu chỉ ghi `lastStartAt` sau khi ngủ (như bản đầu),
      // hai vòng bơm của hàng đợi `xml` cùng đọc một mốc cũ, cùng ngủ một lượng bằng nhau rồi cùng
      // thức -> 2 call GDT khởi hành cách nhau 0ms. Đúng cái pacer sinh ra để chống, và tệ nhất ở
      // lúc nhịp đã bị phạt lên 15s: dội một cụm 2 call rồi cả hai cùng lỗi -> phạt tiếp ×4.
      const startAt = Math.max(Date.now(), q.lastStartAt + p.intervalMs[item.lane]);
      q.lastStartAt = startAt;
      const wait = startAt - Date.now();
      if (wait > 0) await sleep(wait);
      await item.run(); // mỗi vòng bơm chạy tuần tự; song song là do có nhiều vòng
    }
  } finally {
    q.running -= 1;
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
    const queueName = LANE_QUEUE[lane];
    getPacer(key).queues[queueName].items.push(item);
    // 1 item -> cần thêm tối đa 1 vòng bơm. Task thứ hai tới sẽ tự khởi vòng thứ hai (lúc đó
    // `running` mới là 1 < 2), nên không cần gọi vòng lặp cho đủ số slot.
    void pump(key, queueName);
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
