import { useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { LOAI_TAI_LIEU } from "../../../constants";
import { ngayVn, nhan } from "../../../format";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import {
  useTaiLieuList,
  useXemFile,
  useXoaFileDinhKem,
  useXoaTaiLieu,
} from "../../../api/taiLieuQueries";
import type { TaiLieu } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import TaiLieuFormDialog from "../TaiLieuFormDialog";

export default function HoSoTab({ maNv }: { maNv: string }) {
  const {
    items: danhSach,
    isLoading,
    isError,
    error,
  } = useTaiLieuList(maNv);
  const xemFile = useXemFile();
  const xoaFileDinhKem = useXoaFileDinhKem();

  /** File đang xem: giữ cả URL blob để thu hồi khi đóng, không thì blob nằm lại tới lúc F5. */
  const [dangXem, setDangXem] = useState<{
    url: string;
    ten: string;
    laPdf: boolean;
  } | null>(null);
  const [dangTaiXem, setDangTaiXem] = useState(false);

  const moXemFile = async (id: string, ten: string, mime: string) => {
    setDangTaiXem(true);
    try {
      setDangXem({ url: await xemFile(id), ten, laPdf: mime === "application/pdf" });
    } catch (err) {
      toast.error(getErrorMessage(err, "Không mở được file."));
    } finally {
      setDangTaiXem(false);
    }
  };

  const dongXemFile = () => {
    if (dangXem) URL.revokeObjectURL(dangXem.url);
    setDangXem(null);
  };

  const goFile = async (id: string) => {
    try {
      await xoaFileDinhKem(id);
      toast.success("Đã gỡ file scan.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không gỡ được file."));
    }
  };
  const xoaTaiLieu = useXoaTaiLieu();

  const [formOpen, setFormOpen] = useState(false);
  const [dangSua, setDangSua] = useState<TaiLieu | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<TaiLieu | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaTaiLieu(dangXoa.id);
      toast.success("Đã xóa tài liệu.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được tài liệu."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => {
            setDangSua(undefined);
            setFormOpen(true);
          }}
          sx={{ textTransform: "none" }}
        >
          Thêm tài liệu
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Loại</TableCell>
              <TableCell>Số hiệu</TableCell>
              <TableCell>Ngày cấp</TableCell>
              <TableCell>Nơi cấp</TableCell>
              <TableCell>Ghi chú</TableCell>
              <TableCell>File scan</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {danhSach.map((tl) => (
              <TableRow key={tl.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {nhan(LOAI_TAI_LIEU, tl.loai)}
                </TableCell>
                <TableCell>{tl.so_hieu || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {tl.ngay_cap ? ngayVn(tl.ngay_cap) : "—"}
                </TableCell>
                <TableCell>{tl.noi_cap || "—"}</TableCell>
                <TableCell>{tl.ghi_chu || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {tl.co_file ? (
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <Tooltip title={`${tl.ten_file} — ${(tl.kich_thuoc / 1024).toFixed(0)}KB`}>
                        <IconButton
                          size="small"
                          disabled={dangTaiXem}
                          onClick={() => moXemFile(tl.id, tl.ten_file, tl.mime_type)}
                        >
                          <VisibilityRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Gỡ file khỏi tài liệu">
                        <IconButton size="small" color="error" onClick={() => goFile(tl.id)}>
                          <AttachFileRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <Box component="span" sx={{ color: "text.disabled" }}>
                      Chưa có
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Sửa">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDangSua(tl);
                        setFormOpen(true);
                      }}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => setDangXoa(tl)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {danhSach.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  {/* Lỗi tải KHÔNG được hiện thành "chưa có" — người dùng sẽ đi nhập lại
                      giấy tờ đã có, tạo bản trùng trong hồ sơ. */}
                  {isLoading ? (
                    <Stack sx={{ alignItems: "center", py: 4 }}>
                      <CircularProgress size={24} />
                    </Stack>
                  ) : isError ? (
                    <Typography
                      variant="body2"
                      color="error"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      {getErrorMessage(error, "Không tải được hồ sơ tài liệu.")}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.disabled"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      Chưa có tài liệu nào.
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(dangXem)} onClose={dongXemFile} maxWidth="md" fullWidth>
        <DialogTitle sx={{ wordBreak: "break-all" }}>{dangXem?.ten}</DialogTitle>
        <DialogContent dividers sx={{ textAlign: "center" }}>
          {/* Ảnh và PDF xem ngay trong app — file tải qua backend nên không cần người xem
              có tài khoản Google nào cả. */}
          {dangXem?.laPdf ? (
            <Box
              component="iframe"
              src={dangXem.url}
              title={dangXem.ten}
              sx={{ width: "100%", height: "70vh", border: 0 }}
            />
          ) : (
            dangXem && (
              <Box
                component="img"
                src={dangXem.url}
                alt={dangXem.ten}
                sx={{ maxWidth: "100%", maxHeight: "70vh" }}
              />
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={dongXemFile} sx={{ textTransform: "none" }}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <TaiLieuFormDialog
        open={formOpen}
        maNv={maNv}
        taiLieu={dangSua}
        onClose={() => setFormOpen(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa tài liệu"
        noiDung={
          <>
            Xóa tài liệu <strong>{dangXoa ? nhan(LOAI_TAI_LIEU, dangXoa.loai) : ""}</strong>?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}
