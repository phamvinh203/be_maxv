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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { getErrorMessage } from "../../../../lib/errors";
import { LOAI_TAI_LIEU } from "../../constants";
import { taiLieuRong } from "../../formDefaults";
import {
  GIOI_HAN_FILE_BYTE,
  GIOI_HAN_FILE_MB,
  LOI_QUA_NHIEU_FILE,
  MIME_CHO_PHEP,
  SO_FILE_TOI_DA,
  useLuuTaiLieu,
  useTaiNhieuFileLen,
  type DongTaiLieu,
} from "../../api/taiLieuQueries";
import type { LoaiTaiLieu, TaiLieuFormValues } from "../../types";

/** `284512` -> `278 KB`. Dưới 1MB hiện KB cho gọn, từ 1MB trở lên hiện MB một chữ số lẻ. */
function coFile(byte: number): string {
  return byte < 1024 * 1024
    ? `${Math.round(byte / 1024)} KB`
    : `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  maNv: string;
  /** Có giá trị = sửa dòng giấy tờ này (kèm danh sách file đang có của nó). */
  taiLieu?: DongTaiLieu;
}

/**
 * Thêm / sửa MỘT dòng giấy tờ, kèm tải file scan lên chính dòng đó.
 *
 * `[QĐ #21]` Mọi file người dùng chọn đều gắn vào **CÙNG MỘT** dòng giấy tờ (BR-hrm-037). Căn
 * cước là MỘT giấy tờ có hai mặt — chọn hai ảnh phải ra một dòng "CCCD" chứa hai file, không
 * phải hai dòng cùng tên "CCCD". Bản trước làm ngược điều này; đừng khôi phục lại.
 *
 * Ba tính chất phải giữ khi sửa file này:
 *  1. Soát dung lượng **mọi** file TRƯỚC khi bắt đầu — soát dần thì file thứ ba quá cỡ sẽ để
 *     lại một dòng đã tạo dở và hai file đã lên.
 *  2. Tải **tuần tự**, không `Promise.all`.
 *  3. Hỏng giữa chừng thì nhớ dòng đã tạo (`idDaTao`) và các file đã xong (`daXong`); bấm lại
 *     làm tiếp từ đúng chỗ, **không** tạo dòng thứ hai, **không** tải lại file đã xong. Ca này
 *     rất dễ gặp: lần đầu đính file sẽ mở cửa sổ đăng nhập Google, người dùng đóng nó đi là
 *     hỏng ngay.
 */
export default function TaiLieuFormDialog({
  open,
  onClose,
  maNv,
  taiLieu,
}: Props) {
  const laSua = Boolean(taiLieu);
  const nhanNutLuu = laSua ? "Lưu thay đổi" : "Thêm tài liệu";
  const luuTaiLieu = useLuuTaiLieu();
  const taiNhieuFile = useTaiNhieuFileLen();

  const [values, setValues] = useState<TaiLieuFormValues>(taiLieuRong);
  const [dangLuu, setDangLuu] = useState(false);
  /** File người dùng đã chọn ở form này — tất cả sẽ vào CÙNG dòng giấy tờ. */
  const [filesChon, setFilesChon] = useState<File[]>([]);
  /** Cùng chỉ số với `filesChon`: file nào đã lên Drive xong ở lần bấm trước. */
  const [daXong, setDaXong] = useState<boolean[]>([]);
  /** Dòng đã tạo ở lần bấm trước — để lần bấm lại SỬA đúng dòng đó thay vì đẻ dòng mới. */
  const [idDaTao, setIdDaTao] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilesChon([]);
    setDaXong([]);
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

  const dat = <K extends keyof TaiLieuFormValues>(
    khoa: K,
    giaTri: TaiLieuFormValues[K],
  ) => setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  /**
   * Số file dòng giấy tờ ĐANG giữ: file có sẵn lúc mở form, cộng những file lượt bấm trước đã
   * tải lên thành công. `taiLieu` là ảnh chụp lúc mở form nên không tự tăng theo — phải cộng tay.
   */
  const soDaTai = daXong.filter(Boolean).length;
  const soFileHienCo = (taiLieu?.files.length ?? 0) + soDaTai;
  const soSeThem = filesChon.length - soDaTai;
  const conNhan = SO_FILE_TOI_DA - soFileHienCo;
  const vuotTran = soSeThem > conNhan;

  const chonFile = (moi: File[]) => {
    if (moi.length === 0) return;
    // Đã có file lên Drive thật rồi thì GIỮ LẠI và thêm vào cuối, không thay cả danh sách:
    // xóa chúng khỏi danh sách là mất dấu, bấm lại sẽ tải lên bản thứ hai của cùng file.
    setFilesChon((cu) => [...cu.filter((_, i) => daXong[i]), ...moi]);
    setDaXong((cu) => [...cu.filter(Boolean), ...moi.map(() => false)]);
  };

  const boFileChon = (i: number) => {
    setFilesChon((cu) => cu.filter((_, k) => k !== i));
    setDaXong((cu) => cu.filter((_, k) => k !== i));
  };

  const handleSubmit = async () => {
    // (1) Soát dung lượng NGAY, trước khi ghi gì: để máy chủ chặn thì dòng đã nằm trong DB rồi
    // mới báo lỗi, và người dùng lại rơi vào vòng bấm-lại. Soát TOÀN BỘ file chưa tải.
    const quaCo = filesChon.find(
      (f, i) => !daXong[i] && f.size > GIOI_HAN_FILE_BYTE,
    );
    if (quaCo) {
      toast.error(
        `File "${quaCo.name}" nặng ${coFile(quaCo.size)}, vượt giới hạn ${GIOI_HAN_FILE_MB}MB. Vui lòng chọn file nhỏ hơn.`,
      );
      return;
    }

    // (2) Chặn trước trần 20 file (E-hrm-065). Để BE bắt thì người dùng đã ngồi đợi hết các
    // file đầu, mà chúng đã nằm trên Drive của khách rồi.
    // Nút Lưu đã bị khóa khi `vuotTran`, nên nhánh này là lớp chặn thứ hai — giữ lại để đổi
    // cách khóa nút sau này không vô tình mở đường cho một lượt tải chắc chắn hỏng.
    if (vuotTran) {
      toast.error(
        `${LOI_QUA_NHIEU_FILE} Giấy tờ này đang có ${soFileHienCo} file, chỉ nhận thêm ${Math.max(conNhan, 0)} file nữa mà bạn chọn ${soSeThem}.`,
      );
      return;
    }

    setDangLuu(true);

    // (3) Ghi dòng giấy tờ ĐÚNG MỘT LẦN. `idDaTao` khiến lần bấm lại sửa đúng dòng lần trước
    // đã tạo — đây là chỗ chặn "tạo dòng thứ hai" khi tải file hỏng giữa chừng.
    let idDong: string;
    try {
      idDong = await luuTaiLieu(
        maNv,
        values,
        taiLieu?.id ?? idDaTao ?? undefined,
      );
      setIdDaTao(idDong);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được tài liệu."));
      setDangLuu(false);
      return;
    }

    // (4) Không có file mới: chỉ ghi thông tin giấy tờ, đính file sau cũng được.
    if (soSeThem === 0) {
      toast.success(laSua ? "Đã cập nhật tài liệu." : "Đã thêm tài liệu.");
      setDangLuu(false);
      onClose();
      return;
    }

    toast.info(
      soSeThem > 1
        ? `Đang tải ${soSeThem} file lên Google Drive…`
        : "Đang tải file lên Google Drive…",
    );

    // (5) Tải tuần tự vào CHÍNH dòng vừa ghi. `daXong` vào — ra, nên lần bấm sau bỏ qua đúng
    // những file đã lên.
    const kq = await taiNhieuFile(idDong, filesChon, daXong, setDaXong);
    setDaXong(kq.daXong);

    if (kq.loi) {
      const soXong = kq.daXong.filter(Boolean).length;
      // Nói rõ hỏng ở file nào và đã xong bao nhiêu. Báo chung chung thì người dùng bấm lại từ
      // đầu và nghĩ mình vừa tạo trùng — trong khi dòng giấy tờ đã lưu và các file trước đã lên.
      toast.error(
        `${getErrorMessage(kq.loi.err, "Không tải được file lên Google Drive.")} ` +
          (kq.loi.file ? `Hỏng ở file "${kq.loi.file.name}". ` : "") +
          `${soXong}/${filesChon.length} file đã lên xong. ` +
          `Giấy tờ đã được lưu — bấm "${nhanNutLuu}" lần nữa để tải tiếp từ đúng chỗ hỏng ` +
          `(không tạo dòng mới, không tải lại file đã xong).`,
      );
      setDangLuu(false);
      return;
    }

    toast.success(
      soSeThem > 1
        ? `Đã lưu tài liệu kèm ${soSeThem} file scan.`
        : laSua
          ? "Đã cập nhật tài liệu."
          : "Đã thêm tài liệu.",
    );
    setDangLuu(false);
    onClose();
  };

  const nhanNutChonFile = daXong.some(Boolean)
    ? "Chọn thêm file"
    : filesChon.length > 0
      ? `Chọn lại (${filesChon.length} file)`
      : "Chọn file scan (chọn được nhiều)";

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
              {nhanNutChonFile}
              <input
                hidden
                type="file"
                /* Luôn cho chọn nhiều: nhiều file của một giấy tờ (căn cước hai mặt, bằng cấp
                   nhiều trang) đều vào CÙNG dòng này, cả khi thêm mới lẫn khi sửa. */
                multiple
                accept={MIME_CHO_PHEP}
                onChange={(e) => {
                  chonFile(Array.from(e.target.files ?? []));
                  // Xóa giá trị input để chọn LẠI đúng file vừa bỏ ra vẫn kích hoạt onChange.
                  e.target.value = "";
                }}
              />
            </Button>

            {/* Sửa dòng đã có file: nói rõ THÊM VÀO, vì trước QĐ #21 thao tác này là THAY. */}
            {laSua && (taiLieu?.files.length ?? 0) > 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.75 }}
              >
                Giấy tờ này đang có <strong>{taiLieu?.files.length} file</strong>
                . File chọn thêm sẽ được <strong>thêm vào</strong>, không thay
                file cũ. Muốn bỏ một file thì gỡ đích danh ở bảng hồ sơ.
              </Typography>
            )}

            {filesChon.length > 0 ? (
              <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                {filesChon.map((f, i) => (
                  <Stack
                    key={`${f.name}-${f.size}-${i}`}
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: "center" }}
                  >
                    {daXong[i] && (
                      <CheckCircleRounded
                        color="success"
                        sx={{ fontSize: 14 }}
                      />
                    )}
                    <Typography
                      variant="caption"
                      color={daXong[i] ? "success.main" : "text.secondary"}
                      sx={{ flexGrow: 1, wordBreak: "break-all" }}
                    >
                      {f.name} — {coFile(f.size)}
                      {daXong[i] ? " (đã lên Drive)" : ""}
                    </Typography>
                    {/* Chỉ bỏ được file CHƯA lên: file đã lên Drive rồi thì gỡ là việc của
                        bảng hồ sơ (gọi API gỡ thật), không phải bỏ khỏi danh sách chờ. */}
                    {!daXong[i] && (
                      <Tooltip title="Bỏ file này khỏi danh sách chờ">
                        <IconButton
                          size="small"
                          disabled={dangLuu}
                          onClick={() => boFileChon(i)}
                        >
                          <CloseRounded sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                ))}
              </Stack>
            ) : null}

            <Typography
              variant="caption"
              color={vuotTran ? "error" : "text.secondary"}
              sx={{ display: "block", mt: 0.75 }}
            >
              {vuotTran
                ? `${LOI_QUA_NHIEU_FILE} Giấy tờ này đang có ${soFileHienCo} file, chỉ nhận thêm ${Math.max(conNhan, 0)} file nữa mà bạn chọn ${soSeThem} — bỏ bớt ${soSeThem - Math.max(conNhan, 0)} file khỏi danh sách chờ rồi lưu lại.`
                : `Ảnh hoặc PDF, tối đa ${GIOI_HAN_FILE_MB}MB mỗi file; một giấy tờ giữ tối đa ${SO_FILE_TOI_DA} file (còn nhận ${Math.max(conNhan, 0)}). ` +
                  `Mọi file đã chọn vào cùng một dòng giấy tờ. Lần đầu sẽ mở cửa sổ đăng nhập Google để kết nối Drive của công ty.`}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        {/* Khóa khi đang lưu: đóng form giữa chừng thì việc vẫn chạy tiếp ở nền, xong mới hiện
            toast từ một form đã biến mất — người dùng không hiểu chuyện gì vừa xảy ra. */}
        <Button
          onClick={onClose}
          disabled={dangLuu}
          sx={{ textTransform: "none" }}
        >
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={dangLuu || vuotTran}
          startIcon={dangLuu ? <CircularProgress size={16} /> : undefined}
          sx={{ textTransform: "none" }}
        >
          {nhanNutLuu}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
