import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import PlaylistAddCheckRounded from "@mui/icons-material/PlaylistAddCheckRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import DeleteSweepRounded from "@mui/icons-material/DeleteSweepRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { PHAM_VI_AP_DUNG } from "../../../constants";
import { nhan, tienVn } from "../../../format";
import { tongTienSanPham } from "../../../luongSanPham";
import {
  useApDungLuongSanPham,
  useLuongSanPhamRows,
  useLuuMauLuongSanPham,
  useMauLuongSanPham,
  useSanPhamList,
} from "../../../mock/hooks/luongSanPham";
import type { DongLuongSanPham, LocNhanVienKyLuong, PhamViApDung } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangSanPhamCard from "./BangSanPhamCard";
import DanhSachLuongSanPhamCard from "./DanhSachLuongSanPhamCard";
import QuanLySanPhamDialog from "./QuanLySanPhamDialog";
import TaiSuDungSanPhamDialog from "./TaiSuDungSanPhamDialog";
import { docFileSanPham, taiFileMauSanPham, xuatSanPhamExcel } from "./luongSanPhamExcel";

/**
 * Màn hình Lương sản phẩm của khu "Dữ liệu tính lương".
 *
 * Cùng lối làm việc với ba màn còn lại: bảng giữ ở **bản nháp** trong state màn
 * hình, chỉ ghi xuống kho khi bấm "Lưu thay đổi" hoặc "Áp dụng lương SP"; và
 * "Áp dụng lương SP" ghi cho **toàn bộ nhân viên đang hiện ở danh sách bên
 * dưới".
 *
 * Khác màn Thưởng ở một chỗ đáng lưu ý: số lượng nghiệm thu là của **riêng từng
 * người**, nên áp một bảng cho nhiều người chỉ hợp lý khi cả tổ làm chung một
 * lô. Áp cho nhiều người xong thì sửa lại số lượng của từng người bằng cách lọc
 * ra một người rồi áp lại.
 */
export default function LuongSanPhamPanel() {
  const daLuu = useMauLuongSanPham();
  const danhMuc = useSanPhamList();
  const luuMau = useLuuMauLuongSanPham();
  const apDung = useApDungLuongSanPham();

  const [mau, setMau] = useState<DongLuongSanPham[]>(daLuu);
  const [phamVi, setPhamVi] = useState<PhamViApDung>("nhan_vien");
  const [filters, setFilters] = useState<LocNhanVienKyLuong>({
    q: "",
    ma_pb: "",
    loai_hd: "",
  });
  const [dangLuu, setDangLuu] = useState(false);

  const [moQuanLy, setMoQuanLy] = useState(false);
  const [moTaiSuDung, setMoTaiSuDung] = useState(false);
  const [moXoaTatCa, setMoXoaTatCa] = useState(false);
  const [moApDung, setMoApDung] = useState(false);

  const inputFile = useRef<HTMLInputElement>(null);
  const rows = useLuongSanPhamRows(phamVi, filters);

  useEffect(() => {
    // Bám theo bảng đã lưu — vừa lưu xong, hoặc rời màn hình rồi quay lại.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau(daLuu);
  }, [daLuu]);

  const coThayDoi = JSON.stringify(mau) !== JSON.stringify(daLuu);
  const tong = tongTienSanPham(mau);

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuMau(mau);
      toast.success("Đã lưu bảng lương sản phẩm.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được bảng lương sản phẩm."));
    } finally {
      setDangLuu(false);
    }
  };

  const handleApDung = async () => {
    setMoApDung(false);
    try {
      const so = await apDung(
        rows.map((row) => row.ma_nv),
        mau,
      );
      toast.success(`Đã áp bảng lương sản phẩm cho ${so} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được lương sản phẩm."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauSanPham(danhMuc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatSanPhamExcel(mau, danhMuc, rows);
      toast.success("Đã xuất file Bang-luong-san-pham.xlsx.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được Excel."));
    }
  };

  const handleNhap = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Xóa giá trị input ngay: không xóa thì chọn lại đúng file vừa lỗi sẽ không
    // bắn `change` lần nữa và nút trông như hỏng.
    e.target.value = "";
    if (!file) return;
    try {
      const dong = await docFileSanPham(file, danhMuc);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} sản phẩm từ file. Bấm "Lưu thay đổi" để ghi lại.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không đọc được file Excel."));
    }
  };

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xl: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <Button
              startIcon={<DownloadRounded />}
              onClick={handleTaiMau}
              sx={{ textTransform: "none" }}
            >
              Tải mẫu
            </Button>
            <Button
              startIcon={<UploadFileRounded />}
              onClick={() => inputFile.current?.click()}
              sx={{ textTransform: "none" }}
            >
              Nhập Excel
            </Button>
            <Button
              startIcon={<FileDownloadRounded />}
              onClick={handleXuat}
              sx={{ textTransform: "none" }}
            >
              Xuất Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<PlaylistAddCheckRounded />}
              onClick={() => setMoApDung(true)}
              disabled={mau.length === 0 || rows.length === 0}
              sx={{ textTransform: "none" }}
            >
              Áp dụng lương SP ({rows.length})
            </Button>
            <Button
              startIcon={<ContentCopyRounded />}
              onClick={() => setMoTaiSuDung(true)}
              sx={{ textTransform: "none" }}
            >
              Tái sử dụng
            </Button>
            <Button
              color="error"
              startIcon={<DeleteSweepRounded />}
              onClick={() => setMoXoaTatCa(true)}
              disabled={mau.length === 0}
              sx={{ textTransform: "none" }}
            >
              Xóa tất cả
            </Button>
            <Button
              variant="outlined"
              startIcon={<TuneRounded />}
              onClick={() => setMoQuanLy(true)}
              sx={{ textTransform: "none" }}
            >
              Quản lý sản phẩm
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Bảng lương sản phẩm có thay đổi chưa lưu"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>

        <input ref={inputFile} type="file" accept=".xlsx,.xlsm" hidden onChange={handleNhap} />
      </Paper>

      <BangSanPhamCard values={mau} onChange={setMau} />

      <DanhSachLuongSanPhamCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        coThayDoi={coThayDoi}
        dangLuu={dangLuu}
        onLuu={handleLuu}
      />

      <QuanLySanPhamDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungSanPhamDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả dòng sản phẩm"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} dòng</strong> khỏi bảng đang soạn? Lương sản phẩm đã
            áp cho nhân viên vẫn giữ nguyên cho tới lần áp sau.
          </>
        }
        onClose={() => setMoXoaTatCa(false)}
        onXacNhan={() => {
          setMau([]);
          setMoXoaTatCa(false);
        }}
      />

      <Dialog open={moApDung} onClose={() => setMoApDung(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Áp dụng lương sản phẩm</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng đang soạn ({mau.length} sản phẩm, {tienVn(tong)} ₫ mỗi người) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Bảng cũ của những
            người này sẽ bị thay thế.
            {rows.length > 1 && (
              <Box component="span" sx={{ display: "block", mt: 1.5, color: "warning.main" }}>
                Lưu ý: cả {rows.length} người sẽ nhận cùng một số lượng nghiệm thu. Chỉ nên làm
                vậy khi cả tổ cùng làm một lô.
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoApDung(false)} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button variant="contained" onClick={handleApDung} sx={{ textTransform: "none" }}>
            Áp dụng
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
