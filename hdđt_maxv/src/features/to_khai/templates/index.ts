/**
 * Template cột của mô-đun "Tờ khai" — nguồn khai báo cột DUY NHẤT cho bảng ở màn `/to-khai`.
 *
 * Song song với `features/hddt/templates/index.ts` nhưng độc lập hoàn toàn: đổi cột ở đây không
 * đụng bảng Hóa đơn điện tử và ngược lại (xem ghi chú đầu `dauVao.ts`/`dauRa.ts`).
 *
 * Cố ý KHÔNG re-export `overviewDauVao`/`overviewDauRa`: nơi gọi chỉ được lấy cột qua
 * `overviewColumnsToKhai(direction)` để không ai hardcode một chiều rồi lệch chiều quay lại —
 * cùng lý do với bản gốc bên `hddt`.
 */
import type { InvoiceDirection } from "../../hddt/types";
import type { ToKhaiRow } from "../ky";
import type { InvoiceColumn } from "../../hddt/templates/types";
import { overviewDauVao } from "./dauVao";
import { overviewDauRa } from "./dauRa";

/** Cột bảng "Tổng quát" theo chiều — dùng ở `ToKhaiInvoiceTabs`. */
export function overviewColumnsToKhai(direction: InvoiceDirection): InvoiceColumn<ToKhaiRow>[] {
  return direction === "purchase" ? overviewDauVao() : overviewDauRa();
}
