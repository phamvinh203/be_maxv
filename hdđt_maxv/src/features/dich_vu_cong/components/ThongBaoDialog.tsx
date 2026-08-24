import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { layDanhSachThongBaoDvc } from "../api/dvc";
import { taiThongBao } from "../taiThongBao";
import { useBaoPhienChet } from "../useBaoPhienChet";
import { getErrorMessage } from "../../../lib/errors";

interface Props {
  open: boolean;
  onClose: () => void;
  dvcKey: string | null;
  /** Mã hồ sơ đang xem — `null` khi chưa chọn dòng nào (dialog không fetch). */
  maHoSo: string | null;
  /** Báo lên `DvcPage` để bỏ khóa phiên khi BE nói phiên chết hẳn — xem `boKhoaNeuPhienChet`. */
  onPhienChet?: (err: unknown) => void;
}

/**
 * Dialog "Thông báo" — danh sách thông báo của một hồ sơ
 * (`GET /tthc/tchs/files/detail/{maHoSo}`), mỗi dòng tải được file riêng
 * (`POST /tthc/tchs/downloadthongbao`).
 *
 * Không dò cột động như `TaiLieuDinhKemDialog`: hình dạng dữ liệu đã xác nhận qua mẫu HTML
 * thật (chỉ có tiêu đề/ngày gửi/idTbao — cổng không có "Số thông báo" hay "Người gửi").
 *
 * Dùng: `BangHoSo` (icon cột "Thông báo").
 */
export default function ThongBaoDialog({ open, onClose, dvcKey, maHoSo, onPhienChet }: Props) {
  // idTbao đang tải — chỉ 1 nút bị khóa/xoay tại 1 thời điểm, các dòng khác vẫn bấm được.
  const [dangTai, setDangTai] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["dvc", "thong-bao", maHoSo],
    // `key` tùy chọn: BE đọc cache trước (hồ sơ đã đồng bộ thì không cần đăng nhập cổng), chỉ
    // dùng `dvcKey` khi BE cần gọi cổng thật vì cache còn thiếu.
    queryFn: () => layDanhSachThongBaoDvc({ key: dvcKey ?? undefined, maHoSo: maHoSo as string }),
    enabled: open && !!maHoSo,
    // BE lượt này (khi cache miss) tải nguyên trang chi tiết hồ sơ từ cổng GDT rồi regex-parse,
    // không rẻ như tra cứu bảng — tránh gọi lại cổng mỗi lần đóng/mở dialog liên tiếp cùng hồ sơ.
    staleTime: 30_000,
  });

  // Lỗi khi LẤY DANH SÁCH cũng có thể là "phiên chết hẳn" — báo lên như nhánh tải file bên dưới.
  useBaoPhienChet(query.error, onPhienChet);

  const ds = query.data ?? [];

  const handleTai = async (idTbao: string) => {
    if (!maHoSo) return;
    setDangTai(idTbao);
    const toastId = toast.loading("Đang tải file thông báo…");
    try {
      await taiThongBao(dvcKey, maHoSo, idTbao);
      toast.update(toastId, {
        render: "Đã tải file thông báo.",
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });
    } catch (err) {
      onPhienChet?.(err);
      toast.update(toastId, {
        render: getErrorMessage(err, "Tải file thông báo thất bại."),
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    } finally {
      setDangTai(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}
      >
        Thông báo{maHoSo ? ` — hồ sơ ${maHoSo}` : ""}
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
            <Typography variant="body2">Đang tải danh sách thông báo…</Typography>
          </Box>
        ) : query.isError ? (
          <Alert severity="error">
            {getErrorMessage(query.error, "Không lấy được danh sách thông báo.")}
          </Alert>
        ) : ds.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            Hồ sơ chưa có thông báo nào.
          </Typography>
        ) : (
          <List disablePadding>
            {ds.map((tb, i) => (
              <ListItem
                key={tb.idTbao || i}
                divider={i < ds.length - 1}
                secondaryAction={
                  <Tooltip title="Tải file">
                    <span>
                      <IconButton
                        edge="end"
                        size="small"
                        disabled={dangTai === tb.idTbao}
                        onClick={() => void handleTai(tb.idTbao)}
                        aria-label={`Tải thông báo ${tb.tieuDe}`}
                      >
                        {dangTai === tb.idTbao ? (
                          <CircularProgress size={18} />
                        ) : (
                          <FileDownloadRounded fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                }
                sx={{ pr: 7 }}
              >
                <ListItemText primary={tb.tieuDe} secondary={tb.ngayGui} />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
