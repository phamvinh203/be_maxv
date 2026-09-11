import type { ChangeEvent, RefObject } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import PlaylistAddCheckRounded from "@mui/icons-material/PlaylistAddCheckRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import DeleteSweepRounded from "@mui/icons-material/DeleteSweepRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";

interface Props {
  isReadOnly: boolean;
  /** Bảng đang soạn có nội dung chưa áp dụng — hiện chip cảnh báo. */
  coThayDoi: boolean;
  /** Số nhân viên sẽ bị ghi nếu bấm "Áp dụng" — ghép vào nhãn nút, vd "(12)". */
  soLuongApDung: number;
  /** Mỗi Panel tự tính — luật khóa khác nhau giữa các module (xem docblock). */
  disabledApDung: boolean;
  disabledXoaTatCa: boolean;
  inputFile: RefObject<HTMLInputElement | null>;
  onTaiMau: () => void;
  onNhap: (e: ChangeEvent<HTMLInputElement>) => void;
  onXuat: () => void;
  onApDung: () => void;
  onTaiSuDung: () => void;
  onXoaTatCa: () => void;
  onQuanLy: () => void;
  /** Nguyên văn nhãn nút, vd "Áp dụng KPI" — component tự ghép thêm " (N)". */
  nhanApDung: string;
  /** Nguyên văn nhãn nút, vd "Quản lý KPI". */
  nhanQuanLy: string;
  /** Nguyên văn chip cảnh báo, vd "Bảng KPI có nội dung chưa áp dụng". */
  canhBaoChuaApDung: string;
}

/**
 * Thanh nút "Tải mẫu / Nhập Excel / Xuất Excel / Áp dụng / Tái sử dụng / Xóa
 * tất cả / Quản lý" + chip "còn nội dung chưa áp dụng" + input file ẩn — dùng
 * chung cho 7 Panel của khu "Dữ liệu tính lương" (RVW-712: trước đây ~90 dòng
 * gần giống hệt nhau chép 7 lần, đúng kiểu lỗi "phải vá N nơi" mà RVW-701 đã
 * từng gặp).
 *
 * Text nút KHÔNG tự suy ra từ 1 chuỗi "tên module" chung — mỗi Panel tự truyền
 * `nhanApDung`/`nhanQuanLy`/`canhBaoChuaApDung` đúng nguyên văn cũ (vd "Áp dụng
 * lương SP" khác "Quản lý sản phẩm" dù cùng module Lương sản phẩm) để giữ
 * đúng chữ đã hiển thị, tránh suy diễn sai một module nào đó.
 *
 * Điều kiện khóa nút ("Áp dụng"/"Xóa tất cả") do TỪNG Panel tự tính rồi truyền
 * vào qua `disabledApDung`/`disabledXoaTatCa` — mỗi Panel có luật khác nhau
 * (vd Chuyên cần KHÔNG khóa theo `mau.length` vì áp bảng rỗng nghĩa là "chốt
 * không vi phạm"; Tăng ca không cần `hopLe` vì lọc dòng hỏng ngay trong
 * `handleApDung`). Gộp luật đó vào component dùng chung dễ vá sai module khác
 * khi sửa sau này — để nguyên mỗi Panel tự quyết.
 */
export default function ThanhCongCuBangNhap({
  isReadOnly,
  coThayDoi,
  soLuongApDung,
  disabledApDung,
  disabledXoaTatCa,
  inputFile,
  onTaiMau,
  onNhap,
  onXuat,
  onApDung,
  onTaiSuDung,
  onXoaTatCa,
  onQuanLy,
  nhanApDung,
  nhanQuanLy,
  canhBaoChuaApDung,
}: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", xl: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xl: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
          <Button startIcon={<DownloadRounded />} onClick={onTaiMau} sx={{ textTransform: "none" }}>
            Tải mẫu
          </Button>
          <Button
            startIcon={<UploadFileRounded />}
            onClick={() => inputFile.current?.click()}
            disabled={isReadOnly}
            sx={{ textTransform: "none" }}
          >
            Nhập Excel
          </Button>
          <Button startIcon={<FileDownloadRounded />} onClick={onXuat} sx={{ textTransform: "none" }}>
            Xuất Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<PlaylistAddCheckRounded />}
            onClick={onApDung}
            disabled={disabledApDung}
            sx={{ textTransform: "none" }}
          >
            {nhanApDung} ({soLuongApDung})
          </Button>
          <Button
            startIcon={<ContentCopyRounded />}
            onClick={onTaiSuDung}
            disabled={isReadOnly}
            sx={{ textTransform: "none" }}
          >
            Tái sử dụng
          </Button>
          <Button
            color="error"
            startIcon={<DeleteSweepRounded />}
            onClick={onXoaTatCa}
            disabled={disabledXoaTatCa}
            sx={{ textTransform: "none" }}
          >
            Xóa tất cả
          </Button>
          <Button
            variant="outlined"
            startIcon={<TuneRounded />}
            onClick={onQuanLy}
            sx={{ textTransform: "none" }}
          >
            {nhanQuanLy}
          </Button>
        </Stack>

        {coThayDoi && (
          <Box>
            <Chip size="small" color="warning" label={canhBaoChuaApDung} sx={{ height: 22 }} />
          </Box>
        )}
      </Stack>

      <input ref={inputFile} type="file" accept=".xlsx,.xlsm" hidden onChange={onNhap} />
    </Paper>
  );
}
