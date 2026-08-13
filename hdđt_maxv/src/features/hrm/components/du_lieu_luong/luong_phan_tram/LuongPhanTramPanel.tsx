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
import { tongTienPhanTram } from "../../../luongPhanTram";
import {
  useApDungLuongPhanTram,
  useKhoanPhanTramList,
  useLuongPhanTramRows,
  useLuuMauLuongPhanTram,
  useMauLuongPhanTram,
} from "../../../mock/hooks/luongPhanTram";
import type { DongLuongPhanTram, LocNhanVienKyLuong, PhamViApDung } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangPhanTramCard from "./BangPhanTramCard";
import DanhSachLuongPhanTramCard from "./DanhSachLuongPhanTramCard";
import QuanLyPhanTramDialog from "./QuanLyPhanTramDialog";
import TaiSuDungPhanTramDialog from "./TaiSuDungPhanTramDialog";
import { docFilePhanTram, taiFileMauPhanTram, xuatPhanTramExcel } from "./luongPhanTramExcel";

/**
 * Màn hình Lương phần trăm của khu "Dữ liệu tính lương".
 *
 * Cùng lối làm việc với các màn còn lại: bảng giữ ở **bản nháp** trong state màn
 * hình, chỉ ghi xuống kho khi bấm "Lưu thay đổi" hoặc "Áp dụng lương %"; và "Áp
 * dụng lương %" ghi cho **toàn bộ nhân viên đang hiện ở danh sách bên dưới".
 *
 * Giống màn Lương sản phẩm ở một điểm cần lưu ý: số tiền cơ sở là doanh số của
 * **riêng từng người**, nên áp một bảng cho nhiều người chỉ hợp lý khi cả nhóm
 * ăn chung một gốc doanh số.
 */
export default function LuongPhanTramPanel() {
  const daLuu = useMauLuongPhanTram();
  const danhMuc = useKhoanPhanTramList();
  const luuMau = useLuuMauLuongPhanTram();
  const apDung = useApDungLuongPhanTram();

  const [mau, setMau] = useState<DongLuongPhanTram[]>(daLuu);
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
  const rows = useLuongPhanTramRows(phamVi, filters);

  useEffect(() => {
    // Bám theo bảng đã lưu — vừa lưu xong, hoặc rời màn hình rồi quay lại.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau(daLuu);
  }, [daLuu]);

  const coThayDoi = JSON.stringify(mau) !== JSON.stringify(daLuu);
  const tong = tongTienPhanTram(mau);

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuMau(mau);
      toast.success("Đã lưu bảng lương phần trăm.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được bảng lương phần trăm."));
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
      toast.success(`Đã áp bảng lương phần trăm cho ${so} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được lương phần trăm."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauPhanTram(danhMuc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatPhanTramExcel(mau, danhMuc, rows);
      toast.success("Đã xuất file Bang-luong-phan-tram.xlsx.");
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
      const dong = await docFilePhanTram(file, danhMuc);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} khoản % từ file. Bấm "Lưu thay đổi" để ghi lại.`);
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
              Áp dụng lương % ({rows.length})
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
              Quản lý loại %
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Bảng lương phần trăm có thay đổi chưa lưu"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>

        <input ref={inputFile} type="file" accept=".xlsx,.xlsm" hidden onChange={handleNhap} />
      </Paper>

      <BangPhanTramCard values={mau} onChange={setMau} />

      <DanhSachLuongPhanTramCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        coThayDoi={coThayDoi}
        dangLuu={dangLuu}
        onLuu={handleLuu}
      />

      <QuanLyPhanTramDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungPhanTramDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả khoản %"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} khoản</strong> khỏi bảng đang soạn? Lương phần trăm
            đã áp cho nhân viên vẫn giữ nguyên cho tới lần áp sau.
          </>
        }
        onClose={() => setMoXoaTatCa(false)}
        onXacNhan={() => {
          setMau([]);
          setMoXoaTatCa(false);
        }}
      />

      <Dialog open={moApDung} onClose={() => setMoApDung(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Áp dụng lương phần trăm</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng đang soạn ({mau.length} khoản, {tienVn(tong)} ₫ mỗi người) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Bảng cũ của những
            người này sẽ bị thay thế.
            {rows.length > 1 && (
              <Box component="span" sx={{ display: "block", mt: 1.5, color: "warning.main" }}>
                Lưu ý: cả {rows.length} người sẽ nhận cùng một số tiền cơ sở. Chỉ nên làm vậy khi
                cả nhóm ăn chung một gốc doanh số.
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
