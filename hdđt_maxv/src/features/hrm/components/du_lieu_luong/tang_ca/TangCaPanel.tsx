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
import { nhan } from "../../../format";
import { gioVn, tongGioOt, tongGioQuyDoi } from "../../../tangCa";
import { useCauHinh } from "../../../mock/hooks/cauHinh";
import {
  useApDungTangCa,
  useLuuMauTangCa,
  useMauTangCa,
  useTangCaRows,
} from "../../../mock/hooks/tangCa";
import type { DongTangCa, LocNhanVienKyLuong, PhamViApDung } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangTangCaCard from "./BangTangCaCard";
import DanhSachTangCaCard from "./DanhSachTangCaCard";
import QuanLyTangCaDialog from "./QuanLyTangCaDialog";
import TaiSuDungTangCaDialog from "./TaiSuDungTangCaDialog";
import { docFileTangCa, taiFileMauTangCa, xuatTangCaExcel } from "./tangCaExcel";

/**
 * Màn hình Tăng ca của khu "Dữ liệu tính lương".
 *
 * Cùng lối làm việc với màn KPI và màn Thưởng: bảng giữ ở **bản nháp** trong
 * state màn hình, chỉ ghi xuống kho khi bấm "Lưu thay đổi" hoặc "Áp dụng tăng
 * ca"; và "Áp dụng tăng ca" ghi cho **toàn bộ nhân viên đang hiện ở danh sách
 * bên dưới".
 */
export default function TangCaPanel() {
  const daLuu = useMauTangCa();
  const cauHinh = useCauHinh();
  const luuMau = useLuuMauTangCa();
  const apDungTangCa = useApDungTangCa();

  const [mau, setMau] = useState<DongTangCa[]>(daLuu);
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
  const rows = useTangCaRows(phamVi, filters);

  useEffect(() => {
    // Bám theo bảng đã lưu — vừa lưu xong, hoặc rời màn hình rồi quay lại.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau(daLuu);
  }, [daLuu]);

  const coThayDoi = JSON.stringify(mau) !== JSON.stringify(daLuu);
  const tongGio = tongGioOt(mau);

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuMau(mau);
      toast.success("Đã lưu bảng tăng ca.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được bảng tăng ca."));
    } finally {
      setDangLuu(false);
    }
  };

  const handleApDung = async () => {
    setMoApDung(false);
    try {
      const so = await apDungTangCa(
        rows.map((row) => row.ma_nv),
        mau,
      );
      toast.success(`Đã áp bảng tăng ca cho ${so} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được tăng ca."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauTangCa(cauHinh);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatTangCaExcel(mau, cauHinh, rows);
      toast.success("Đã xuất file Bang-tang-ca.xlsx.");
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
      const dong = await docFileTangCa(file);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} dòng tăng ca từ file. Bấm "Lưu thay đổi" để ghi lại.`);
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
              Áp dụng tăng ca ({rows.length})
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
              Quản lý tăng ca
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Bảng tăng ca có thay đổi chưa lưu"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>

        <input ref={inputFile} type="file" accept=".xlsx,.xlsm" hidden onChange={handleNhap} />
      </Paper>

      <BangTangCaCard values={mau} onChange={setMau} />

      <DanhSachTangCaCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        coThayDoi={coThayDoi}
        dangLuu={dangLuu}
        onLuu={handleLuu}
      />

      <QuanLyTangCaDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungTangCaDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả dòng tăng ca"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} dòng</strong> khỏi bảng tăng ca đang soạn? Tăng ca
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
        <DialogTitle>Áp dụng tăng ca</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng tăng ca đang soạn ({gioVn(tongGio)}h OT, quy đổi{" "}
            {gioVn(tongGioQuyDoi(mau, cauHinh))}h) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Bảng tăng ca cũ của
            những người này sẽ bị thay thế, giờ lũy kế cả năm giữ nguyên.
            {cauHinh.gioi_han_tc_thang > 0 && tongGio > cauHinh.gioi_han_tc_thang && (
              <Box component="span" sx={{ display: "block", mt: 1.5, color: "error.main" }}>
                Lưu ý: {gioVn(tongGio)}h vượt trần {gioVn(cauHinh.gioi_han_tc_thang)}h/tháng.
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
