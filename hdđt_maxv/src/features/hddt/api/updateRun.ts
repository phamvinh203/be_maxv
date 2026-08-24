import { toast } from "react-toastify";
import { apiFetch } from "../../../lib/http";
import { getErrorMessage } from "../../../lib/errors";
import {
  batDauToastNen,
  capNhatToastNen,
  ketThucToastNen,
  nghiMs,
  POLL_NEN_MS,
  MAX_POLL_NEN_HONG,
  LOI_MAT_KET_NOI_NEN,
} from "../../../lib/toastChayNen";
import { buildInvoiceParams } from "./gdt";
import type { InvoiceDirection, InvoiceQuery } from "../types";

/**
 * Tiến độ lượt "Cập nhật từ Thuế điện tử" chạy nền ở BE (khớp `UpdateRunStatus` bên BE).
 * Một object cho CẢ HAI pha (danh sách -> chi tiết) nên FE chỉ cần một vòng poll và một toast.
 */
export interface UpdateRunStatus {
  active: boolean;
  /** Pha đang chạy; "" khi đã xong. */
  phase: "list" | "detail" | "";
  page: number;
  rows: number;
  saved: number;
  total: number;
  /** "thường" | "máy tính tiền" — nguồn GDT đang quét, chỉ để hiển thị. */
  source: string;
  partial: boolean;
  message: string;
  detail: { total: number; done: number; ok: number; err: number; authExpired?: boolean };
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

/**
 * POST /gdt/invoices/:direction/update-run — bắt đầu lượt cập nhật CHẠY NỀN cho ĐÚNG chiều này
 * + ĐÚNG bộ lọc đang chọn, trả tiến độ ngay (~50ms). Auth app qua cookie httpOnly (apiFetch tự
 * gửi); token GDT qua header X-Gdt-Token. Dùng: nút "Cập nhật từ Thuế điện tử".
 */
export function startUpdateRun(
  direction: InvoiceDirection,
  gdtToken: string,
  query: InvoiceQuery,
): Promise<UpdateRunStatus> {
  const params = buildInvoiceParams(direction, query);
  return apiFetch<UpdateRunStatus>(`/gdt/invoices/${direction}/update-run?${params.toString()}`, {
    method: "POST",
    headers: { "X-Gdt-Token": gdtToken },
  });
}

/**
 * GET /gdt/invoices/:direction/update-run/status — tiến độ lượt (KHÔNG cần token GDT).
 * Dùng: vòng poll, và lúc mở lại tab để NỐI LẠI lượt đang chạy.
 */
export function getUpdateRunStatus(direction: InvoiceDirection): Promise<UpdateRunStatus> {
  return apiFetch<UpdateRunStatus>(`/gdt/invoices/${direction}/update-run/status`);
}


const DIR_LABEL: Record<InvoiceDirection, string> = {
  purchase: "Mua vào",
  sold: "Bán ra",
};

/** Câu chữ toast theo pha — gom 1 chỗ để 2 nơi gọi (bấm nút / nối lại) luôn hiện giống nhau. */
function renderProgress(direction: InvoiceDirection, st: UpdateRunStatus): string {
  const dir = DIR_LABEL[direction];
  if (st.phase === "detail") {
    return `${dir} — đã lưu ${st.saved} hóa đơn, đang tải chi tiết ${st.detail.done}/${st.detail.total}…`;
  }
  if (st.rows > 0) {
    return `${dir}${st.source ? ` (${st.source})` : ""} — trang ${st.page}, đã lấy ${st.rows} hóa đơn…`;
  }
  return `Đang lấy hóa đơn ${dir.toLowerCase()} từ Thuế điện tử…`;
}

/** Câu chữ + mức độ của toast khi lượt kết thúc. */
function renderFinal(
  direction: InvoiceDirection,
  st: UpdateRunStatus,
): { render: string; type: "success" | "warning" | "error" } {
  const dir = DIR_LABEL[direction];
  if (st.error) return { render: st.error, type: "error" };
  if (st.detail.authExpired) {
    return {
      render:
        `${dir} — token Thuế điện tử hết hạn. Đã lưu ${st.saved} hóa đơn, ` +
        `tải chi tiết ${st.detail.ok}/${st.detail.total}. Đăng nhập lại rồi bấm "Tải chi tiết".`,
      type: "warning",
    };
  }
  const base =
    `${dir} — Thuế điện tử có ${st.total} hóa đơn, đã lưu ${st.saved}, ` +
    `đã tải chi tiết ${st.detail.ok}/${st.detail.total}`;
  if (st.partial) return { render: `${base}. CHƯA lấy hết: ${st.message}`, type: "warning" };
  if (st.detail.err > 0) return { render: `${base} (${st.detail.err} lỗi).`, type: "warning" };
  return { render: `${base}.`, type: "success" };
}

/**
 * Poll tiến độ lượt cập nhật tới khi BE báo xong, hiển thị bằng MỘT toast cập nhật dần (loading →
 * tiến độ 2 pha → kết quả). Dùng cho cả lúc bấm nút lẫn lúc NỐI LẠI sau khi rời trang: trạng thái
 * thật nằm ở BE nên hai đường vào đều chỉ là "bám theo một lượt đang chạy".
 *
 * `onProgress` gọi khi có số liệu mới (nơi gọi invalidate bảng để cột "T.thái tải" điền dần),
 * `onFinish` gọi đúng một lần khi kết thúc (nạp lại cả chi tiết). `isStale` để nơi gọi báo "đổi
 * công ty giữa chừng" -> ngừng poll và gỡ toast, tránh lẫn tenant.
 */
export async function pollUpdateRunToast(
  direction: InvoiceDirection,
  initial: UpdateRunStatus,
  opts: { isStale: () => boolean; onProgress: () => void; onFinish: () => void },
): Promise<void> {
  const toastId = batDauToastNen(renderProgress(direction, initial));
  let st = initial;
  let lastSeen = "";
  let fails = 0;
  try {
    for (;;) {
      if (opts.isStale()) {
        toast.dismiss(toastId);
        return;
      }
      capNhatToastNen(toastId, renderProgress(direction, st));
      // Chỉ invalidate khi CÓ số liệu mới (tránh refetch cả bảng mỗi 2s một cách vô ích).
      const seen = `${st.rows}/${st.saved}/${st.detail.done}`;
      if (seen !== lastSeen) {
        lastSeen = seen;
        opts.onProgress();
      }
      if (!st.active) break;
      await nghiMs(POLL_NEN_MS);
      try {
        st = await getUpdateRunStatus(direction);
        fails = 0;
      } catch (e) {
        // Lỗi mạng chập 1 nhịp poll -> thử lại nhịp sau, KHÔNG bỏ lượt (lượt vẫn chạy ở BE).
        // Nhưng lỗi LIÊN TIẾP quá ngưỡng = mất kết nối thật -> thoát, khỏi treo toast vĩnh viễn.
        fails += 1;
        console.warn(`[DEBUG-CAPNHAT][FE] Poll lỗi nhịp ${fails}/${MAX_POLL_NEN_HONG}:`, e);
        if (fails >= MAX_POLL_NEN_HONG) throw e;
      }
    }
    ketThucToastNen(toastId, renderFinal(direction, st));
  } catch (e) {
    ketThucToastNen(toastId, {
      render: getErrorMessage(e, LOI_MAT_KET_NOI_NEN),
      type: "error",
      autoClose: 4000,
    });
  } finally {
    opts.onFinish();
  }
}
