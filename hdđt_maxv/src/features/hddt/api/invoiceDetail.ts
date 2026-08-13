import { toast } from "react-toastify";
import { apiFetch, apiFetchBlob, apiFetchText } from "../../../lib/http";
import { getErrorMessage } from "../../../lib/errors";
import { buildInvoiceParams } from "./gdt";
import type { InvoiceDirection, InvoiceQuery } from "../types";

/**
 * GET /gdt/invoices/:direction/saved-details → đọc payload chi tiết ĐÃ LƯU (không gọi GDT),
 * cho tab "Chi tiết hóa đơn" hiển thị tất cả. Trả mảng payload GDT gốc (có mảng hàng `hdhhdvu`).
 * Dùng chung `buildInvoiceParams` với luồng danh sách để map đúng MST đối tác theo chiều.
 * Dùng: `useSavedDetailsQuery`.
 */
export async function getSavedDetails(
  direction: InvoiceDirection,
  query: InvoiceQuery,
): Promise<Record<string, unknown>[]> {
  const params = buildInvoiceParams(direction, query);
  const raw = await apiFetch<{ datas?: Record<string, unknown>[] }>(
    `/gdt/invoices/${direction}/saved-details?${params.toString()}`,
  );
  return raw.datas ?? [];
}

/** Kết quả đọc chi tiết đã lưu của 1 hóa đơn (GET saved-detail/:id). */
export interface SavedInvoiceDetail {
  found: boolean;
  /** Payload GDT gốc (có `hdhhdvu`, bên bán/mua...) — null nếu hóa đơn chưa tải chi tiết. */
  detail: Record<string, unknown> | null;
}

/**
 * GET /gdt/invoices/:direction/saved-detail/:id → đọc CHI TIẾT ĐÃ LƯU của 1 hóa đơn (không gọi GDT).
 * Dùng cho nút "Xem hóa đơn" dựng tờ hóa đơn GTGT. 404 (apiFetch ném lỗi) nếu id không có trong DB;
 * `detail=null` nếu hóa đơn có nhưng chưa tải chi tiết. Dùng: `useSavedInvoiceDetailByIdQuery`.
 */
export function getSavedInvoiceDetailById(
  direction: InvoiceDirection,
  id: string,
): Promise<SavedInvoiceDetail> {
  return apiFetch<SavedInvoiceDetail>(
    `/gdt/invoices/${direction}/saved-detail/${encodeURIComponent(id)}`,
  );
}

/** Số HĐ + số HĐ CHƯA có chi tiết trong khoảng — gate cho nút "Xuất file tổng hợp + hóa đơn". */
export interface DetailCompleteStatus {
  total: number;
  missing: number;
}

/**
 * GET /gdt/invoices/:direction/detail-complete → đếm HĐ + số HĐ chưa có chi tiết (`tt_tai != OK`)
 * trong khoảng/bộ lọc (đọc DB, KHÔNG cần token GDT). Dùng: dialog "Xuất file tổng hợp + hóa đơn" —
 * chỉ cho xuất khi `missing === 0` (mọi HĐ đã có chi tiết để dựng HTML/XML/PDF).
 */
export function getDetailComplete(
  direction: InvoiceDirection,
  query: InvoiceQuery,
): Promise<DetailCompleteStatus> {
  const params = buildInvoiceParams(direction, query);
  return apiFetch<DetailCompleteStatus>(
    `/gdt/invoices/${direction}/detail-complete?${params.toString()}`,
  );
}

/**
 * POST /gdt/render-pdf → gửi HTML tờ hóa đơn (tự chứa) lên BE, nhận PDF vector (Chromium/puppeteer render).
 * Dùng: orchestrator xuất file (`exportBundle`) — sinh PDF từng hóa đơn ghi vào thư mục.
 */
export function renderInvoicePdf(html: string): Promise<Blob> {
  return apiFetchBlob("/gdt/render-pdf", {
    method: "POST",
    body: JSON.stringify({ html }),
    // Chặn 1 request treo làm kẹt cả lượt xuất (hàng trăm HĐ tuần tự) — 60s/hóa đơn là dư.
    signal: AbortSignal.timeout(60_000),
  });
}

/** Định danh 1 hóa đơn để xin bản XML gốc từ cổng thuế (khớp tham số endpoint `export-xml`). */
export interface OriginalXmlKey {
  /** MST NGƯỜI BÁN — kể cả chiều mua vào (bên phát hành hóa đơn). */
  nbmst: string;
  khhdon: string;
  shdon: string;
  khmshdon: string;
  /** Hóa đơn máy tính tiền (`ttxly=8`) -> cổng thuế để ở nhánh sco-query riêng. */
  cashRegister: boolean;
  /** Chiều hóa đơn — BE dùng để biết đọc/ghi cache XML ở bảng nào. */
  direction: InvoiceDirection;
}

/**
 * GET /gdt/invoices/export-xml → HÓA ĐƠN XML GỐC ĐÃ KÝ SỐ (chuẩn TT78, có mã CQT + chữ ký người bán
 * và Cục Thuế). BE gọi cổng thuế, rút `invoice.xml` khỏi gói ZIP rồi trả về dạng văn bản.
 *
 * Đây là bản DUY NHẤT có giá trị pháp lý — khác hẳn XML dựng lại từ payload chi tiết. Cần token GDT
 * còn hạn. Dùng: orchestrator xuất file (`exportBundle`) — thư mục `xml/`.
 */
export function fetchOriginalInvoiceXml(key: OriginalXmlKey, gdtToken: string): Promise<string> {
  const params = new URLSearchParams({
    nbmst: key.nbmst,
    khhdon: key.khhdon,
    shdon: key.shdon,
    khmshdon: key.khmshdon,
  });
  if (key.cashRegister) params.set("cttt", "1");

  return apiFetchText(`/gdt/invoices/${key.direction}/export-xml?${params.toString()}`, {
    headers: { "X-Gdt-Token": gdtToken },
    // Rộng hơn HẲN ngân sách retry của BE (45s): cổng thuế hay nuốt request nên BE phải được thử
    // lại vài lần: cắt sớm ở đây là vứt đi công sức đó rồi mất file XML. Cộng thêm thời gian nằm
    // chờ hàng đợi pacer làn `xml` (2 slot mỗi MST) khi các hóa đơn trước cũng đang retry.
    signal: AbortSignal.timeout(120_000),
  });
}

/** Tiến độ lượt tải chi tiết chạy nền ở BE (FE poll qua `getDetailRunStatus`). */
export interface DetailRunStatus {
  active: boolean;
  total: number;
  done: number;
  ok: number;
  err: number;
  /** true nếu lượt dừng sớm vì token GDT hết hạn — FE nhắc đăng nhập lại. */
  authExpired?: boolean;
}

/**
 * POST /gdt/invoices/:direction/detail-run → BE bắt đầu lượt tải chi tiết CHẠY NỀN (thay thế lượt cũ
 * nếu đang chạy) qua pacer dùng chung (429-retry). Trả tiến độ ngay; FE poll `getDetailRunStatus`
 * tới khi xong. Cần token GDT (BE gọi GDT). Dùng: nút "Cập nhật từ Thuế điện tử" / "Tải chi tiết".
 */
export function startDetailRun(
  direction: InvoiceDirection,
  gdtToken: string,
  query: InvoiceQuery,
): Promise<DetailRunStatus> {
  const params = buildInvoiceParams(direction, query);
  return apiFetch<DetailRunStatus>(`/gdt/invoices/${direction}/detail-run?${params.toString()}`, {
    method: "POST",
    headers: { "X-Gdt-Token": gdtToken },
  });
}

/**
 * GET /gdt/invoices/:direction/detail-run/status → tiến độ lượt tải chi tiết hiện tại (KHÔNG cần
 * token GDT). Dùng: FE poll trong lúc BE tải chi tiết ngầm.
 */
export function getDetailRunStatus(direction: InvoiceDirection): Promise<DetailRunStatus> {
  return apiFetch<DetailRunStatus>(`/gdt/invoices/${direction}/detail-run/status`);
}

const DETAIL_POLL_INTERVAL_MS = 1500;
const sleepMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const DETAIL_DIR_LABEL: Record<InvoiceDirection, string> = {
  purchase: "mua vào",
  sold: "bán ra",
};

/**
 * Khởi động lượt tải chi tiết CHẠY NỀN ở BE cho 1 chiều rồi POLL tới khi xong, hiển thị tiến độ bằng
 * MỘT toast cập nhật dần (loading → tiến độ → kết quả). Dùng cho dialog "Đồng bộ" (không có bảng để
 * điền cột "T.thái tải" như `InvoiceListTabs.pollDetailRun`), nên toast-only. Toast dùng API
 * module-level của react-toastify nên vẫn chạy tiếp khi dialog đóng. `onFinish` gọi khi lượt kết thúc
 * (kể cả lỗi) để nơi gọi invalidate query bảng hóa đơn. `isStale` để nơi gọi báo "đổi công ty giữa
 * chừng" -> ngừng poll (BE lấy tiến độ theo session, sẽ trả nhầm của công ty mới). Trả `true` nếu lượt
 * dừng vì token hết hạn -> nơi gọi khỏi chạy tiếp chiều còn lại (cùng token sẽ lỗi y hệt).
 */
export async function pollDetailRunToast(
  direction: InvoiceDirection,
  gdtToken: string,
  range: { tuNgay: string; denNgay: string },
  opts?: { onFinish?: () => void; isStale?: () => boolean },
): Promise<boolean> {
  const dirLabel = DETAIL_DIR_LABEL[direction];
  const query: InvoiceQuery = { tuNgay: range.tuNgay, denNgay: range.denNgay };
  const toastId = toast.loading(`Đang tải chi tiết ${dirLabel}…`);
  try {
    let status = await startDetailRun(direction, gdtToken, query);
    for (;;) {
      // Đổi công ty giữa chừng (dialog đã đóng, người dùng chuyển MST khác): status endpoint lấy theo
      // session nên sẽ trả tiến độ của công ty MỚI -> ngừng poll, gỡ toast để khỏi lẫn tenant.
      if (opts?.isStale?.()) {
        toast.dismiss(toastId);
        return false;
      }
      toast.update(toastId, {
        render:
          status.total > 0
            ? `Đang tải chi tiết ${dirLabel} ${status.done}/${status.total}${
                status.err > 0 ? ` (${status.err} lỗi)` : ""
              }…`
            : `Đang kiểm tra chi tiết ${dirLabel}…`,
      });
      if (!status.active) break;
      await sleepMs(DETAIL_POLL_INTERVAL_MS);
      status = await getDetailRunStatus(direction);
    }
    toast.update(toastId, {
      render: status.authExpired
        ? `Token Thuế điện tử hết hạn — đã tải chi tiết ${dirLabel} ${status.ok}/${status.total}. Đăng nhập lại rồi bấm tải tiếp.`
        : status.total === 0
          ? `Tất cả hóa đơn ${dirLabel} trong khoảng đã có chi tiết.`
          : `Đã tải chi tiết ${dirLabel} ${status.ok}/${status.total} hóa đơn${
              status.err > 0 ? ` (${status.err} lỗi)` : ""
            }.`,
      type: status.authExpired || status.err > 0 ? "warning" : "success",
      isLoading: false,
      autoClose: 4000,
    });
    return status.authExpired ?? false;
  } catch (e) {
    toast.update(toastId, {
      render: getErrorMessage(e, `Không tải được chi tiết ${dirLabel}.`),
      type: "error",
      isLoading: false,
      autoClose: 4000,
    });
    return false;
  } finally {
    opts?.onFinish?.();
  }
}
