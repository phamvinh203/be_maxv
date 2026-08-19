import { useQuery } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { layTaiLieuDinhKemDvc } from "../api/dvc";
import { getErrorMessage } from "../../../lib/errors";

interface Props {
  open: boolean;
  onClose: () => void;
  dvcKey: string | null;
  /** Mã hồ sơ đang xem — `null` khi chưa chọn dòng nào (dialog không fetch). */
  maHoSo: string | null;
}

type Dong = Record<string, unknown>;

/**
 * Cổng có thể bọc danh sách trong `{data:[...]}`/`{result:[...]}`... tùy endpoint — dò
 * property đầu tiên có giá trị là mảng thay vì giả định tên cố định.
 */
function chuanHoaThanhMangDong(data: unknown): Dong[] {
  if (Array.isArray(data)) return data as Dong[];
  if (data && typeof data === "object") {
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(v)) return v as Dong[];
    }
  }
  return [];
}

function hienThiGiaTri(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Dialog "Tệp đính kèm" — danh sách tài liệu đính kèm của một hồ sơ
 * (`POST /tthc/tchs/data-tai-lieu-dkem`).
 *
 * Cột bảng dựng ĐỘNG từ khóa JSON cổng trả về: hình dạng thật chưa xác nhận (chưa có mẫu
 * response), nên chưa thể đặt tên cột tiếng Việt cố định như `BangHoSo`. Khi có mẫu thật,
 * đổi bảng này sang cột cố định cho dễ đọc hơn tên khóa kỹ thuật.
 *
 * Dùng: `BangHoSo` (icon cột "Tệp đính kèm").
 */
export default function TaiLieuDinhKemDialog({ open, onClose, dvcKey, maHoSo }: Props) {
  const query = useQuery({
    queryKey: ["dvc", "tai-lieu-dkem", dvcKey, maHoSo],
    queryFn: () => layTaiLieuDinhKemDvc({ key: dvcKey as string, maHoSo: maHoSo as string }),
    enabled: open && !!dvcKey && !!maHoSo,
  });

  const dsDong = chuanHoaThanhMangDong(query.data);
  const cot = dsDong.length > 0 ? Object.keys(dsDong[0]!) : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}
      >
        Tệp đính kèm{maHoSo ? ` — hồ sơ ${maHoSo}` : ""}
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {query.isLoading ? (
          <Box
            sx={{
              py: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <CircularProgress />
            <Typography variant="body2">Đang tải danh sách tài liệu đính kèm…</Typography>
          </Box>
        ) : query.isError ? (
          <Alert severity="error">
            {getErrorMessage(query.error, "Không lấy được danh sách tài liệu đính kèm.")}
          </Alert>
        ) : dsDong.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            Không có tài liệu đính kèm.
          </Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {cot.map((c) => (
                    <TableCell key={c} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {dsDong.map((dong, i) => (
                  <TableRow key={i} hover>
                    {cot.map((c) => (
                      <TableCell key={c} sx={{ whiteSpace: "nowrap" }}>
                        {hienThiGiaTri(dong[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}
