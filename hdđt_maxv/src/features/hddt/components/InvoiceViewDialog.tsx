import { useMemo, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PrintRounded from "@mui/icons-material/PrintRounded";
import { useSavedInvoiceDetailByIdQuery } from "../api/invoiceDetailQueries";
import { toInvoiceView, tinhChatLabel, type InvoiceView } from "../invoiceView";
import { formatMoney } from "../format";
import { formatDateTimeVN } from "../dateUtils";
import { getErrorMessage } from "../../../lib/errors";
import type { InvoiceDirection } from "../types";

/**
 * CSS "tờ hóa đơn" theo bố cục bản in Tổng cục Thuế — bám vào `.inv-sheet` để không rò ra ngoài.
 * Dùng chung cho bản xem trên màn hình (nhúng qua <style>) VÀ bản in (ghi vào iframe ẩn) nên in ra
 * giống hệt lúc xem.
 */
const INVOICE_CSS = `
.inv-sheet { font-family: "Times New Roman", Times, serif; color: #000; background: #fff;
  font-size: 13px; line-height: 1.5; border: 1px solid #c9a45c; padding: 24px; }
.inv-sheet * { box-sizing: border-box; }
.inv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.inv-title { text-align: center; flex: 1; }
.inv-title h1 { font-size: 20px; font-weight: 700; text-transform: uppercase; margin: 8px 0 0; letter-spacing: .5px; }
.inv-title .date { margin-top: 6px; font-style: italic; }
.inv-meta { min-width: 170px; text-align: left; font-weight: 700; }
.inv-meta div { margin-bottom: 2px; }
.inv-cqt { text-align: center; font-style: italic; margin-top: 6px; }
.inv-rule { border: 0; border-top: 1px solid #c9a45c; margin: 12px 0; }
.inv-party .line { margin-bottom: 3px; }
.inv-party .line.indent { padding-left: 96px; text-indent: -96px; }
.inv-two { display: flex; gap: 40px; }
.inv-two .line { flex: 1; }
.inv-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
.inv-table th, .inv-table td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
.inv-table th { text-align: center; font-weight: 700; background: #faf3e2; }
.inv-table td.num, .inv-table th.num { text-align: right; }
.inv-table td.center, .inv-table th.center { text-align: center; }
.inv-sum { display: flex; gap: 24px; margin-top: 14px; align-items: flex-start; }
.inv-sum .tax { flex: 0 0 42%; }
.inv-sum .totals { flex: 1; }
.inv-sum table { width: 100%; border-collapse: collapse; }
.inv-sum th, .inv-sum td { border: 1px solid #000; padding: 5px 8px; }
.inv-sum .tax th { text-align: center; font-weight: 700; background: #faf3e2; }
.inv-sum .tax td { text-align: right; }
.inv-sum .tax td.center { text-align: center; }
.inv-sum .totals td.lbl { text-align: center; width: 55%; }
.inv-sum .totals td.val { text-align: right; }
.inv-sign { display: flex; justify-content: space-around; margin-top: 24px; text-align: center; gap: 24px; }
.inv-sign .col { flex: 1; }
.inv-sign .col .role { font-weight: 700; text-transform: uppercase; }
.inv-sign .col .note { font-style: italic; font-size: 12px; color: #333; margin-top: 4px; }
.inv-sigbox { display: inline-block; margin-top: 12px; padding: 8px 12px; border: 1px solid #1a8f2a;
  color: #1a8f2a; text-align: left; font-size: 12px; line-height: 1.4; }
.inv-sigbox .valid { font-weight: 700; }
.inv-foot { text-align: center; font-style: italic; margin-top: 18px; padding-top: 10px;
  border-top: 1px solid #c9a45c; }
`;

/** "Ngày d tháng mm năm yyyy" từ chuỗi ISO; rỗng/không hợp lệ -> trả nguyên input. */
function invoiceDateLine(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `Ngày ${d.getDate()} tháng ${mm} năm ${d.getFullYear()}`;
}

/** 1 dòng "Nhãn: giá trị" trong khối bên bán/mua. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="line indent">
      {label}: {value}
    </div>
  );
}

/** Nội dung tờ hóa đơn (HTML thuần) — tách riêng để in (đọc innerHTML) và xem dùng chung markup. */
function InvoiceSheet({ view }: { view: InvoiceView }) {
  return (
    <div className="inv-sheet">
      <div className="inv-head">
        <div style={{ minWidth: 170 }} />
        <div className="inv-title">
          <h1>Hóa đơn giá trị gia tăng</h1>
          <div className="date">{invoiceDateLine(view.ngayLap)}</div>
        </div>
        <div className="inv-meta">
          <div>Mẫu số: {view.mauSo}</div>
          <div>Ký hiệu: {view.kyHieu}</div>
          <div>Số: {view.soHd}</div>
        </div>
      </div>
      {view.maCqt && <div className="inv-cqt">Mã của cơ quan thuế: {view.maCqt}</div>}

      <hr className="inv-rule" />

      <div className="inv-party">
        <Line label="Tên người bán" value={view.seller.ten} />
        <Line label="Mã số thuế" value={view.seller.mst} />
        <Line label="Mã cửa hàng" value={view.seller.maCuaHang} />
        <Line label="Tên cửa hàng" value={view.seller.tenCuaHang} />
        <Line label="Địa chỉ" value={view.seller.diaChi} />
        <Line label="Điện thoại" value={view.seller.dienThoai} />
        <Line label="Số tài khoản" value={view.seller.soTaiKhoan} />
      </div>

      <hr className="inv-rule" />

      <div className="inv-party">
        <Line label="Tên người mua" value={view.buyer.ten} />
        <Line label="Họ tên người mua hàng" value={view.buyer.tenNguoiMua} />
        <Line label="Mã số thuế" value={view.buyer.mst} />
        <Line label="Mã ĐVCQHVNSNN" value={view.buyer.maDvqhns} />
        <Line label="CCCD người mua" value={view.buyer.cccd} />
        <Line label="Số hộ chiếu" value={view.buyer.hoChieu} />
        <Line label="Địa chỉ" value={view.buyer.diaChi} />
        <Line label="Số tài khoản" value={view.buyer.soTaiKhoan} />
        <Line label="Hình thức thanh toán" value={view.hinhThucTt} />
        <Line label="Đơn vị tiền tệ" value={view.maNt} />
        <div className="inv-two">
          <div className="line">Số bảng kê: {view.soBangKe}</div>
          <div className="line">Ngày bảng kê: {view.ngayBangKe}</div>
        </div>
      </div>

      <table className="inv-table">
        <thead>
          <tr>
            <th className="center">STT</th>
            <th className="center">Tính chất</th>
            <th>Loại hàng hóa đặc trưng</th>
            <th>Tên hàng hóa, dịch vụ</th>
            <th className="center">Đơn vị tính</th>
            <th className="num">Số lượng</th>
            <th className="num">Đơn giá</th>
            <th className="num">Chiết khấu</th>
            <th className="center">Thuế suất</th>
            <th className="num">Thành tiền chưa có thuế GTGT</th>
          </tr>
        </thead>
        <tbody>
          {view.items.length > 0 ? (
            view.items.map((it, i) => (
              <tr key={i}>
                <td className="center">{it.tinhChat === "4" ? "" : i + 1}</td>
                <td>{tinhChatLabel(it.tinhChat)}</td>
                <td>{it.loaiDacTrung}</td>
                <td>{it.tenHang}</td>
                <td className="center">{it.dvt}</td>
                <td className="num">{formatMoney(it.soLuong)}</td>
                <td className="num">{formatMoney(it.donGia)}</td>
                <td className="num">{formatMoney(it.chietKhau)}</td>
                <td className="center">{it.thueSuat}</td>
                <td className="num">{formatMoney(it.thanhTien)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="center" colSpan={10}>
                (Không có dòng hàng hóa)
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="inv-sum">
        <div className="tax">
          <table>
            <thead>
              <tr>
                <th>Thuế suất</th>
                <th>Tổng tiền chưa thuế</th>
                <th>Tổng tiền thuế</th>
              </tr>
            </thead>
            <tbody>
              {view.taxLines.length > 0 ? (
                view.taxLines.map((t, i) => (
                  <tr key={i}>
                    <td className="center">{t.thueSuat}</td>
                    <td>{formatMoney(t.tienChuaThue)}</td>
                    <td>{formatMoney(t.tienThue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="center">{view.items[0]?.thueSuat ?? ""}</td>
                  <td>{formatMoney(view.tongTienHang)}</td>
                  <td>{formatMoney(view.tongTienThue)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <table>
            <tbody>
              <tr>
                <td className="lbl">Tổng tiền chưa thuế (Tổng cộng thành tiền chưa có thuế)</td>
                <td className="val">{formatMoney(view.tongTienHang)}</td>
              </tr>
              <tr>
                <td className="lbl">Tổng tiền thuế (Tổng cộng tiền thuế)</td>
                <td className="val">{formatMoney(view.tongTienThue)}</td>
              </tr>
              <tr>
                <td className="lbl">Tổng tiền phí</td>
                <td className="val">{formatMoney(view.tongPhi)}</td>
              </tr>
              <tr>
                <td className="lbl">Tổng tiền chiết khấu thương mại</td>
                <td className="val">{formatMoney(view.tongChietKhau)}</td>
              </tr>
              <tr>
                <td className="lbl">Tổng tiền thanh toán bằng số</td>
                <td className="val">{formatMoney(view.tongThanhToan)}</td>
              </tr>
              <tr>
                <td className="lbl">Tổng tiền thanh toán bằng chữ</td>
                <td className="val" style={{ textAlign: "left", fontStyle: "italic" }}>
                  {view.bangChu}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="inv-sign">
        <div className="col">
          <div className="role">Người mua hàng</div>
          <div className="note">(Chữ ký số (nếu có))</div>
        </div>
        <div className="col">
          <div className="role">Người bán hàng</div>
          <div className="note">(Chữ ký điện tử, chữ ký số)</div>
          {view.ngayKy && (
            <div className="inv-sigbox">
              <div className="valid">Signature Valid</div>
              <div>Ký bởi: {view.seller.ten}</div>
              <div>Ký ngày: {formatDateTimeVN(view.ngayKy)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="inv-foot">(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)</div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  direction: InvoiceDirection;
  /** id hóa đơn đang chọn (null khi chưa chọn — dialog không fetch). */
  id: string | null;
}

/**
 * Dialog "Xem hóa đơn" — dựng tờ hóa đơn GTGT theo bố cục bản in Tổng cục Thuế từ chi tiết ĐÃ LƯU
 * (đọc DB theo id, không gọi GDT), có nút In (in qua iframe ẩn dùng chung CSS `.inv-sheet` nên bản in
 * giống hệt bản xem). Dùng: `InvoiceTablePanel` (chọn 1 dòng ở bảng "Tổng quát" rồi bấm "Xem hóa đơn").
 */
export default function InvoiceViewDialog({ open, onClose, direction, id }: Props) {
  const query = useSavedInvoiceDetailByIdQuery(direction, id, open);
  const view = useMemo(() => toInvoiceView(query.data?.detail), [query.data]);
  const sheetRef = useRef<HTMLDivElement>(null);

  /** In tờ hóa đơn: ghi HTML (đã render) + CSS vào iframe ẩn rồi gọi print — không phụ thuộc CSS ngoài. */
  const handlePrint = () => {
    const node = sheetRef.current;
    if (!node) return;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Hóa đơn ${view?.soHd ?? ""}</title>` +
        `<style>@page{margin:10mm;}body{margin:0;}${INVOICE_CSS}</style></head>` +
        `<body>${node.innerHTML}</body></html>`,
    );
    doc.close();
    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      return;
    }
    // Đợi layout trong iframe xong rồi in; gỡ iframe sau khi in (afterprint hoặc timeout dự phòng).
    win.focus();
    win.onafterprint = () => document.body.removeChild(iframe);
    setTimeout(() => {
      win.print();
      // Dự phòng nếu onafterprint không bắn (một số trình duyệt): gỡ sau vài giây.
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    }, 150);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        Xem hóa đơn
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {query.isLoading ? (
          <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <CircularProgress />
            <Typography variant="body2">Đang tải hóa đơn…</Typography>
          </Box>
        ) : query.isError ? (
          <Alert severity="error">
            {getErrorMessage(query.error, "Không đọc được hóa đơn.")}
          </Alert>
        ) : !view ? (
          <Alert severity="info">
            Hóa đơn chưa tải chi tiết. Bấm &quot;Tải chi tiết&quot; ở thanh công cụ để tải từ Thuế
            điện tử rồi mở lại.
          </Alert>
        ) : (
          <Box ref={sheetRef} sx={{ overflowX: "auto" }}>
            <style>{INVOICE_CSS}</style>
            <InvoiceSheet view={view} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Đóng
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintRounded fontSize="small" />}
          onClick={handlePrint}
          disabled={!view}
          sx={{ textTransform: "none" }}
        >
          In
        </Button>
      </DialogActions>
    </Dialog>
  );
}
