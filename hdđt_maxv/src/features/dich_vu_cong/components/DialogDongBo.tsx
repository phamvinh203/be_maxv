import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import { toast } from "react-toastify";

import { TAB_DVC } from "../config";
import { currentMonthRange, formatDateVN, formatDateTimeVN } from "../../hddt/dateUtils";

/**
 * Một lượt bấm nút "Đồng bộ" đã chạy — khớp 1-1 bảng `dvc_dong_bo_log`
 * (`be_maxv/prisma/tenant/schema.prisma`), kể cả cách đặt tên cột snake_case, để khi BE mở
 * endpoint thì gán thẳng không cần lớp đổi tên ở giữa.
 *
 * Đặt tạm ở đây vì chưa có lời gọi API nào dùng tới; chuyển sang `api/dvc.ts` cùng lúc thêm
 * hàm `layLichSuDongBoDvc`.
 */
export interface DvcDongBoLog {
  id: string;
  /** Khớp `TAB_DVC.value`: to-khai-dvc | to-khai-thue-dien-tu | giay-nop-tien. */
  loai: string;
  tu_ngay: string;
  den_ngay: string;
  /** Tổng hồ sơ cổng trả về trong khoảng ngày. */
  tong_ho_so: number;
  /** Đã cache từ lượt trước nên bỏ qua, không gọi lại cổng. */
  da_co_san: number;
  /** Hồ sơ mới đồng bộ xong trong lượt này. */
  dong_bo_xong: number;
  /** Hồ sơ lỗi giữa chừng — sẽ bù ở lượt sau. */
  loi: number;
  trang_thai: "done" | "partial";
  dien_giai: string | null;
  created_at: string;
}

/**
 * Tiêu đề bảng lịch sử kèm cách căn — gắn `align` NGAY TẠI cột thay vì suy từ so khớp chuỗi
 * nhãn ở nơi render: đổi câu chữ một cột (vd "Thao tác" -> "Hành động") trước đây sẽ âm thầm
 * làm cột đó rớt về căn trái vì so khớp chuỗi trật, giờ đổi nhãn không đụng gì tới canh lề.
 */
const COT_LICH_SU: { label: string; align: "left" | "center" }[] = [
  { label: "STT", align: "center" },
  { label: "Từ ngày", align: "left" },
  { label: "Đến ngày", align: "left" },
  { label: "Số lượng đồng bộ", align: "left" },
  { label: "Trạng thái", align: "left" },
  { label: "Diễn giải", align: "left" },
  { label: "Ngày đồng bộ", align: "left" },
  { label: "Thao tác", align: "center" },
];

/** Nhãn loại giấy tờ cho cột "Diễn giải"/tooltip — loại lạ thì trả nguyên mã. */
function nhanLoai(loai: string): string {
  return TAB_DVC.find((muc) => muc.value === loai)?.label ?? loai;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog "Đồng bộ dữ liệu thuế điện tử" — chọn loại giấy tờ + khoảng ngày để kéo hồ sơ từ cổng
 * Dịch vụ công về lưu lại, kèm bảng lịch sử các lượt đã chạy.
 *
 * Tách hẳn khỏi ô tìm kiếm ở `DvcPage`: tìm kiếm đọc thẳng dữ liệu đã lưu (nhanh, không cần đăng
 * nhập cổng), còn đồng bộ mới là lượt gọi cổng thật — gộp chung thì mỗi lần lọc lại phải chờ cổng.
 *
 * PHẦN CHƯA CHẠY THẬT: BE chưa mở endpoint đồng bộ / lịch sử (bảng `dvc_dong_bo_log` mới chỉ có
 * trong schema Prisma), nên hai nút "Đồng bộ" và "Xóa" còn báo đang phát triển và bảng luôn rỗng
 * — cùng cách `XuatFileDvcDialog` đang tạm để. Khi có API chỉ cần thay `lichSu`/`dangTaiLichSu`
 * bằng `useQuery` và thay thân hai hàm `handleDongBo`/`handleXoa`, phần render giữ nguyên.
 */
export default function DialogDongBo({ open, onClose }: Props) {
  const [loai, setLoai] = useState(TAB_DVC[0]!.value);
  const [range, setRange] = useState(currentMonthRange);
  const [loiForm, setLoiForm] = useState("");
  /** Dòng lịch sử đang chờ xác nhận xóa (null = không mở dialog xác nhận). */
  const [dongChoXoa, setDongChoXoa] = useState<DvcDongBoLog | null>(null);

  const lichSu: DvcDongBoLog[] = [];
  const dangTaiLichSu = false;

  const datRange = (key: "tuNgay" | "denNgay", value: string) => {
    setLoiForm("");
    setRange((prev) => ({ ...prev, [key]: value }));
  };

  const handleDongBo = () => {
    setLoiForm("");
    if (!range.tuNgay || !range.denNgay) {
      setLoiForm("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    if (range.tuNgay > range.denNgay) {
      setLoiForm("Từ ngày phải trước hoặc bằng Đến ngày.");
      return;
    }
    toast.info("Đồng bộ dữ liệu Dịch vụ công đang được phát triển.");
  };

  /**
   * "Đồng bộ lại": chỉ nạp loại + khoảng ngày của dòng đó lên form, KHÔNG tự chạy — chạy lại một
   * lượt là gọi cổng thật hàng loạt, nên để người dùng xem lại điều kiện rồi tự bấm.
   */
  const handleDongBoLai = (row: DvcDongBoLog) => {
    setLoiForm("");
    setLoai(row.loai);
    setRange({ tuNgay: row.tu_ngay.slice(0, 10), denNgay: row.den_ngay.slice(0, 10) });
  };

  const handleXoa = () => {
    setDongChoXoa(null);
    toast.info("Xóa dòng lịch sử đồng bộ đang được phát triển.");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
      >
        Đồng bộ dữ liệu thuế điện tử
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kéo hồ sơ từ cổng Dịch vụ công về lưu lại, sau đó tìm kiếm ở ngoài đọc thẳng dữ liệu đã
          lưu nên không phải đăng nhập lại từng lượt.
        </Typography>

        {loiForm && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoiForm("")}>
            {loiForm}
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Loại giấy tờ"
            value={loai}
            onChange={(e) => setLoai(e.target.value)}
          >
            {TAB_DVC.map((muc) => (
              <MenuItem key={muc.value} value={muc.value}>
                {muc.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Từ ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={range.tuNgay}
            onChange={(e) => datRange("tuNgay", e.target.value)}
          />
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Đến ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={range.denNgay}
            onChange={(e) => datRange("denNgay", e.target.value)}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
        >
          <Typography sx={{ fontWeight: 700 }}>Lịch sử đồng bộ</Typography>
          {dangTaiLichSu && <CircularProgress size={16} />}
        </Stack>

        <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                {COT_LICH_SU.map((cot) => (
                  <TableCell key={cot.label} align={cot.align}>
                    {cot.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {lichSu.length > 0 ? (
                lichSu.map((row, i) => (
                  <TableRow key={row.id} hover>
                    <TableCell align="center">{i + 1}</TableCell>
                    <TableCell>{formatDateVN(row.tu_ngay)}</TableCell>
                    <TableCell>{formatDateVN(row.den_ngay)}</TableCell>
                    <TableCell>
                      {/* Ghi "mới/tổng" như bảng lịch sử hóa đơn; phần đã có sẵn và phần lỗi để
                          trong tooltip cho khỏi chật cột. */}
                      <Tooltip
                        title={`Đã có sẵn: ${row.da_co_san} — Lỗi: ${row.loi} — Tổng cổng trả: ${row.tong_ho_so}`}
                      >
                        <span>
                          {row.dong_bo_xong}/{row.tong_ho_so}
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {row.trang_thai === "done" ? (
                        <Chip size="small" color="success" variant="outlined" label="Hoàn thành" />
                      ) : (
                        <Tooltip title={row.dien_giai ?? "Còn hồ sơ chưa lấy xong"}>
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="Chưa hoàn thành"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "normal", minWidth: 220 }}>
                      {row.dien_giai ?? `Đồng bộ ${nhanLoai(row.loai)}`}
                    </TableCell>
                    <TableCell>{formatDateTimeVN(row.created_at)}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center" }}>
                        <Tooltip title="Nạp lại điều kiện của lượt này lên form">
                          <IconButton
                            size="small"
                            aria-label="Đồng bộ lại khoảng ngày này"
                            onClick={() => handleDongBoLai(row)}
                          >
                            <ReplayRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa dòng lịch sử này">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Xóa dòng lịch sử đồng bộ"
                            onClick={() => setDongChoXoa(row)}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={COT_LICH_SU.length}
                    sx={{ border: 0, py: 5, textAlign: "center", color: "text.disabled" }}
                  >
                    {dangTaiLichSu ? "Đang tải…" : "Chưa có lượt đồng bộ nào."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose} sx={{ textTransform: "none" }}>
          Đóng
        </Button>
        <Button
          variant="contained"
          startIcon={<SyncRounded />}
          onClick={handleDongBo}
          sx={{ textTransform: "none" }}
        >
          Đồng bộ
        </Button>
      </DialogActions>

      {/* Xác nhận xóa 1 dòng lịch sử */}
      <Dialog open={!!dongChoXoa} onClose={() => setDongChoXoa(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa dòng lịch sử đồng bộ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {dongChoXoa && (
              <>
                Xóa dòng lịch sử đồng bộ {nhanLoai(dongChoXoa.loai).toLowerCase()} từ{" "}
                {formatDateVN(dongChoXoa.tu_ngay)} đến {formatDateVN(dongChoXoa.den_ngay)} khỏi danh
                sách?{" "}
              </>
            )}
            Chỉ xóa bản ghi lịch sử này, KHÔNG ảnh hưởng đến hồ sơ đã lưu trong cơ sở dữ liệu.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDongChoXoa(null)} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleXoa}
            sx={{ textTransform: "none" }}
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
