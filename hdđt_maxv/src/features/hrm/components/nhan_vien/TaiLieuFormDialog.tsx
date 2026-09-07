import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { getErrorMessage } from "../../../../lib/errors";
import { LOAI_TAI_LIEU } from "../../constants";
import { taiLieuRong } from "../../formDefaults";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import { useLuuTaiLieu, useTaiFileLen } from "../../api/taiLieuQueries";
import type { LoaiTaiLieu, TaiLieu, TaiLieuFormValues } from "../../types";

/** Giữ KHỚP với GIOI_HAN_FILE_BYTE bên be_maxv (taiLieuDrive.service.ts). */
const GIOI_HAN_FILE_MB = 10;
const GIOI_HAN_FILE_BYTE = GIOI_HAN_FILE_MB * 1024 * 1024;

interface Props {
  open: boolean;
  onClose: () => void;
  maNv: string;
  /** Có giá trị = sửa tài liệu này. */
  taiLieu?: TaiLieu;
}

export default function TaiLieuFormDialog({ open, onClose, maNv, taiLieu }: Props) {
  const laSua = Boolean(taiLieu);
  const nhanNutLuu = laSua ? "Lưu thay đổi" : "Thêm tài liệu";
  const luuTaiLieu = useLuuTaiLieu();

  const taiFileLen = useTaiFileLen();

  const [values, setValues] = useState<TaiLieuFormValues>(taiLieuRong);
  const [dangLuu, setDangLuu] = useState(false);
  /** File người dùng vừa chọn, chưa tải lên — chỉ tải sau khi lưu xong dòng tài liệu. */
  const [fileChon, setFileChon] = useState<File | null>(null);
  /**
   * Id dòng tài liệu lần bấm trước ĐÃ tạo xong (chỉ bước tải file hỏng).
   *
   * Không nhớ lại thì lần bấm thứ hai vẫn là "thêm mới" — mỗi lần thử đính lại file lại đẻ thêm
   * một dòng tài liệu rỗng. Tình huống này rất dễ gặp: lần đầu tải file trong công ty sẽ mở cửa
   * sổ đăng nhập Google, người dùng đóng nó đi là bước tải file hỏng ngay.
   */
  const [idDaTao, setIdDaTao] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFileChon(null);
    setIdDaTao(null);
    setValues(
      taiLieu
        ? {
            loai: taiLieu.loai,
            so_hieu: taiLieu.so_hieu,
            ngay_cap: taiLieu.ngay_cap,
            noi_cap: taiLieu.noi_cap,
            ghi_chu: taiLieu.ghi_chu,
          }
        : taiLieuRong(),
    );
  }, [open, taiLieu]);

  const dat = <K extends keyof TaiLieuFormValues>(khoa: K, giaTri: TaiLieuFormValues[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleSubmit = async () => {
    // Chặn quá cỡ NGAY, trước khi tạo dòng: để máy chủ chặn thì dòng đã nằm trong DB rồi mới
    // báo lỗi, và người dùng lại rơi vào vòng bấm-lại.
    if (fileChon && fileChon.size > GIOI_HAN_FILE_BYTE) {
      toast.error(
        `File "${fileChon.name}" nặng ${(fileChon.size / 1024 / 1024).toFixed(1)}MB, vượt giới hạn ${GIOI_HAN_FILE_MB}MB. Vui lòng chọn file nhỏ hơn.`,
      );
      return;
    }

    setDangLuu(true);

    // Lưu dòng tài liệu TRƯỚC rồi mới tải file: endpoint tải file khóa theo id của dòng, nên
    // thêm mới thì phải có dòng đã. `idDaTao` khiến lần bấm lại SỬA đúng dòng lần trước đã tạo.
    let id: string;
    try {
      id = await luuTaiLieu(maNv, values, taiLieu?.id ?? idDaTao ?? undefined);
      setIdDaTao(id);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được tài liệu."));
      setDangLuu(false);
      return;
    }

    // Hai bước tách hẳn nhau: báo thành công CHỈ khi việc người dùng yêu cầu đã xong trọn vẹn.
    // Gộp chung thì có trạng thái thật là "hiện Đã thêm tài liệu rồi mới hiện lỗi" — người dùng
    // đọc thấy mâu thuẫn nên bấm lại, và đó chính là đường sinh ra dòng trùng.
    if (fileChon) {
      try {
        // Chưa kết nối Drive thì hook tự mở popup đăng nhập Google rồi mới tải lên.
        toast.info("Đang tải file lên Google Drive…");
        await taiFileLen(id, fileChon);
      } catch (err) {
        toast.error(
          `${getErrorMessage(err, "Không tải được file lên Google Drive.")} Thông tin tài liệu đã lưu rồi — không phải nhập lại, bấm "${nhanNutLuu}" lần nữa để thử đính file.`,
        );
        setDangLuu(false);
        return;
      }
      toast.success("Đã tải file scan lên Google Drive.");
    }

    toast.success(laSua ? "Đã cập nhật tài liệu." : "Đã thêm tài liệu.");
    setDangLuu(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{laSua ? "Sửa tài liệu" : "Thêm tài liệu"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Loại tài liệu"
              required
              size="small"
              value={values.loai}
              onChange={(e) => dat("loai", e.target.value as LoaiTaiLieu)}
            >
              {LOAI_TAI_LIEU.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Số hiệu"
              size="small"
              value={values.so_hieu}
              onChange={(e) => dat("so_hieu", e.target.value)}
            />
            <TextField
              label="Ngày cấp"
              type="date"
              size="small"
              value={values.ngay_cap}
              onChange={(e) => dat("ngay_cap", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Nơi cấp"
              size="small"
              value={values.noi_cap}
              onChange={(e) => dat("noi_cap", e.target.value)}
            />
            <Box sx={{ gridColumn: "1 / -1" }}>
              <TextField
                label="Ghi chú"
                fullWidth
                size="small"
                value={values.ghi_chu}
                onChange={(e) => dat("ghi_chu", e.target.value)}
              />
            </Box>
          </Box>
          <Box>
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileRounded />}
              disabled={dangLuu}
              sx={{ textTransform: "none" }}
            >
              {fileChon ? "Đổi file khác" : "Thêm file scan"}
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(e) => setFileChon(e.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.75 }}
            >
              {fileChon
                ? `${fileChon.name} — ${(fileChon.size / 1024 / 1024).toFixed(2)}MB`
                : `Ảnh hoặc PDF, tối đa ${GIOI_HAN_FILE_MB}MB. Lần đầu sẽ mở cửa sổ đăng nhập Google để kết nối Drive của công ty.`}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        {/* Khóa khi đang lưu: đóng form giữa chừng thì việc vẫn chạy tiếp ở nền, xong mới hiện
            toast từ một form đã biến mất — người dùng không hiểu chuyện gì vừa xảy ra. */}
        <Button onClick={onClose} disabled={dangLuu} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={dangLuu}
          startIcon={dangLuu ? <CircularProgress size={16} /> : undefined}
          sx={{ textTransform: "none" }}
        >
          {nhanNutLuu}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
