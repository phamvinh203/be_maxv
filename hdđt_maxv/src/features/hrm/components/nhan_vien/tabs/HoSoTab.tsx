import { useEffect, useRef, useState } from "react";
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
import LinkOffRounded from "@mui/icons-material/LinkOffRounded";
import CloudDoneRounded from "@mui/icons-material/CloudDoneRounded";
import CloudOffRounded from "@mui/icons-material/CloudOffRounded";
import type { FileScan } from "../../../api/taiLieuQueries";
import {
  useNgatKetNoiDrive,
  useTaiLieuList,
  useTrangThaiDrive,
  useXemFile,
  useXoaFileDinhKem,
  useXoaTaiLieu,
} from "../../../api/taiLieuQueries";
import type { TaiLieu } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import TaiLieuFormDialog from "../TaiLieuFormDialog";

export default function HoSoTab({ maNv }: { maNv: string }) {
  const { items: danhSach, isLoading, isError, error } = useTaiLieuList(maNv);
  const xemFile = useXemFile();
  const xoaFileDinhKem = useXoaFileDinhKem();
  const trangThaiDrive = useTrangThaiDrive();
  const ngatKetNoiDrive = useNgatKetNoiDrive();

  const [dangXem, setDangXem] = useState<{
    url: string;
    ten: string;
    laPdf: boolean;
  } | null>(null);
  const [dangTaiXem, setDangTaiXem] = useState(false);
  /** Trình duyệt không giải mã được ảnh đang xem (xem ghi chú ở hộp xem file). */
  const [anhLoi, setAnhLoi] = useState(false);

  /**
   * URL blob đang sống. Giữ ở ref chứ không chỉ ở state vì còn phải thu hồi lúc component
   * RỜI ĐI — nếu chỉ thu hồi ở nút Đóng thì mọi đường thoát khác đều rò: người dùng bấm xem
   * một file lớn rồi sốt ruột chuyển sang tab "Thông tin nhân viên" (lúc đó hộp xem chưa kịp
   * mở nên cả dialog vẫn bấm được), tab này unmount, blob ở lại tới khi tải lại trang.
   */
  const urlRef = useRef<string | null>(null);
  const conSong = useRef(true);

  const thuHoiUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };

  useEffect(() => {
    conSong.current = true;
    return () => {
      conSong.current = false;
      thuHoiUrl();
    };
  }, []);

  const moXemFile = async (id: string, ten: string, mime: string) => {
    setDangTaiXem(true);
    try {
      const url = await xemFile(id);
      // Tải xong mà tab đã đóng thì bỏ luôn blob — `setDangXem` lúc này là vô nghĩa, còn blob
      // thì không ai thu hồi nữa.
      if (!conSong.current) {
        URL.revokeObjectURL(url);
        return;
      }
      thuHoiUrl(); // trả lại file xem trước đó
      urlRef.current = url;
      setAnhLoi(false);
      setDangXem({ url, ten, laPdf: mime === "application/pdf" });
    } catch (err) {
      toast.error(getErrorMessage(err, "Không mở được file."));
    } finally {
      if (conSong.current) setDangTaiXem(false);
    }
  };

  /**
   * Đóng hộp xem nhưng CỐ Ý chưa thu hồi blob: dialog còn khoảng 200ms hiệu ứng đóng, thu hồi
   * ngay thì ảnh/PDF thành hình vỡ trong lúc mờ dần. Blob sống thêm sẽ được trả lại khi người
   * dùng xem file khác, hoặc khi rời tab — nên nhiều nhất chỉ có MỘT blob nằm trong bộ nhớ.
   */
  const dongXemFile = () => setDangXem(null);

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
  /**
   * Gỡ file cũng phải hỏi lại như mọi thao tác xóa khác trong HRM: bản scan CCCD có khi là bản
   * duy nhất còn lại, gỡ nhầm là mất hẳn (file bị xóa luôn trên Drive, không có hoàn tác).
   */
  const [dangGoFile, setDangGoFile] = useState<
    (TaiLieu & FileScan) | undefined
  >(undefined);
  const [dangNgatDrive, setDangNgatDrive] = useState(false);

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
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2, alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
      >
        {/* Nói rõ file scan đang nằm ở Drive của tài khoản NÀO. Thiếu dòng này thì một người
            lỡ đăng nhập Gmail cá nhân trên máy công ty là toàn bộ CCCD nhân viên vào Drive
            riêng của họ mà không ai nhận ra, cũng không có đường nào gỡ ra. */}
        {trangThaiDrive.data?.may_chu_san_sang &&
          (trangThaiDrive.data.da_ket_noi ? (
            <>
              <CloudDoneRounded fontSize="small" color="success" />
              <Typography variant="body2" color="text.secondary">
                File scan lưu ở Drive của{" "}
                <Box component="strong" sx={{ wordBreak: "break-all" }}>
                  {trangThaiDrive.data.email ?? "tài khoản Google đã kết nối"}
                </Box>
              </Typography>
              <Button
                size="small"
                color="inherit"
                onClick={() => setDangNgatDrive(true)}
                sx={{ textTransform: "none" }}
              >
                Ngắt kết nối
              </Button>
            </>
          ) : (
            <>
              <CloudOffRounded fontSize="small" color="disabled" />
              <Typography variant="body2" color="text.secondary">
                Chưa kết nối Google Drive — lần đầu đính file sẽ mở cửa sổ đăng
                nhập.
              </Typography>
            </>
          ))}

        <Box sx={{ flexGrow: 1 }} />
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
            <TableRow
              sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}
            >
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
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ alignItems: "center" }}
                    >
                      <Tooltip
                        title={`${tl.ten_file} — ${(tl.kich_thuoc / 1024).toFixed(0)}KB`}
                      >
                        <IconButton
                          size="small"
                          disabled={dangTaiXem}
                          onClick={() =>
                            moXemFile(tl.id, tl.ten_file, tl.mime_type)
                          }
                        >
                          <VisibilityRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* Icon PHẢI khác cái ghim giấy của nút "Thêm file scan" bên form: cùng
                          hình mà một bên đính vào, một bên xóa đi thì người dùng bấm nhầm. */}
                      <Tooltip title="Gỡ file khỏi tài liệu">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDangGoFile(tl)}
                        >
                          <LinkOffRounded fontSize="small" />
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
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDangXoa(tl)}
                    >
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

      <Dialog
        open={Boolean(dangXem)}
        onClose={dongXemFile}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ wordBreak: "break-all" }}>
          {dangXem?.ten}
        </DialogTitle>
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
            dangXem &&
            (anhLoi ? (
              // Chrome/Firefox không giải mã được HEIC (định dạng mặc định của ảnh chụp iPhone),
              // mà backend vẫn nhận để người dùng không bị chặn lúc tải lên. Không bắt lỗi thì
              // họ chỉ thấy một khung hình vỡ và không hiểu vì sao.
              <Typography variant="body2" color="text.secondary" sx={{ py: 6 }}>
                Trình duyệt không hiển thị được định dạng của file này (thường
                gặp với ảnh HEIC chụp từ iPhone). File vẫn được lưu nguyên vẹn
                trên Google Drive — mở bằng Drive, hoặc tải lại bằng ảnh JPG/PNG
                để xem ngay tại đây.
              </Typography>
            ) : (
              <Box
                component="img"
                src={dangXem.url}
                alt={dangXem.ten}
                onError={() => setAnhLoi(true)}
                sx={{ maxWidth: "100%", maxHeight: "70vh" }}
              />
            ))
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
            Xóa tài liệu{" "}
            <strong>{dangXoa ? nhan(LOAI_TAI_LIEU, dangXoa.loai) : ""}</strong>?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
      <XacNhanXoaDialog
        open={Boolean(dangGoFile)}
        tieuDe="Gỡ file scan"
        noiDung={
          <>
            Gỡ file <strong>{dangGoFile?.ten_file}</strong> khỏi tài liệu{" "}
            <strong>
              {dangGoFile ? nhan(LOAI_TAI_LIEU, dangGoFile.loai) : ""}
            </strong>
            ? File sẽ bị xóa khỏi Google Drive và không lấy lại được.
          </>
        }
        nhanXacNhan="Gỡ file"
        onClose={() => setDangGoFile(undefined)}
        onXacNhan={async () => {
          if (!dangGoFile) return;
          const id = dangGoFile.id;
          setDangGoFile(undefined);
          await goFile(id);
        }}
      />
      <XacNhanXoaDialog
        open={dangNgatDrive}
        tieuDe="Ngắt kết nối Google Drive"
        noiDung={
          <>
            Công ty sẽ không tải lên hay xem được file scan cho tới khi kết nối
            lại. File đã tải vẫn nằm nguyên trong Drive của{" "}
            <strong>
              {trangThaiDrive.data?.email ?? "tài khoản đang kết nối"}
            </strong>
            , phần mềm chỉ thôi truy cập.
          </>
        }
        nhanXacNhan="Ngắt kết nối"
        onClose={() => setDangNgatDrive(false)}
        onXacNhan={async () => {
          setDangNgatDrive(false);
          try {
            await ngatKetNoiDrive();
            toast.success("Đã ngắt kết nối Google Drive.");
          } catch (err) {
            toast.error(getErrorMessage(err, "Không ngắt được kết nối."));
          }
        }}
      />
    </Box>
  );
}
