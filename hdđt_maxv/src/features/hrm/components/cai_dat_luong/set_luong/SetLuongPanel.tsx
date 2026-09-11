import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import HowToRegRounded from "@mui/icons-material/HowToRegRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import {
  useDuyetLuong,
  useSetLuongRows,
} from "../../../api/cai_dat_luong/employeeSalariesQueries";
import { useCauTrucLuong, useLuuCauTrucLuong } from "../../../api/cai_dat_luong/salaryStructuresQueries";
import type { CauTrucLuong, SetLuongFilters } from "../../../types";
import CauTrucLuongCard from "./CauTrucLuongCard";
import DanhSachSetLuongCard from "./DanhSachSetLuongCard";

/** Ba nút thao tác file chưa nối — nói rõ thay vì im lặng không làm gì. */
const CHUA_NOI_FILE = "Nhập/xuất Excel sẽ nối ở bản sau, phần này mới dựng giao diện.";

export default function SetLuongPanel() {
  const daLuu = useCauTrucLuong();
  const luuCauTruc = useLuuCauTrucLuong();
  const duyetLuong = useDuyetLuong();
  // Bộ lọc + danh sách đặt ở ĐÂY (không trong `DanhSachSetLuongCard`): nút "Duyệt lương" phải duyệt đúng các
  // dòng người duyệt đang thấy, kèm phiên bản đã xem (vbsec 2026-09-10 #40).
  const [filters, setFilters] = useState<SetLuongFilters>({
    q: "",
    ma_pb: "",
    loai_hd: "",
    daSet: true,
  });
  const rows = useSetLuongRows(filters);

  const [nhap, setNhap] = useState<CauTrucLuong>(daLuu);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    // Bám theo cấu trúc đã lưu — vừa lưu xong, hoặc rời màn hình rồi quay lại.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNhap(daLuu);
  }, [daLuu]);

  const coThayDoi = JSON.stringify(nhap) !== JSON.stringify(daLuu);

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuCauTruc(nhap);
      toast.success("Đã lưu cấu trúc lương.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được cấu trúc lương."));
    } finally {
      setDangLuu(false);
    }
  };

  const handleDuyet = async () => {
    try {
      const kq = await duyetLuong(rows);
      if (kq.approvedCount === 0) toast.info(kq.message);
      else if (kq.skippedCount > 0) toast.warning(kq.message);
      else toast.success(kq.message);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không duyệt được lương."));
    }
  };

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          sx={{ alignItems: { lg: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <Button
              startIcon={<DownloadRounded />}
              onClick={() => toast.info(CHUA_NOI_FILE)}
              sx={{ textTransform: "none" }}
            >
              Tải file mẫu
            </Button>
            <Button
              startIcon={<UploadFileRounded />}
              onClick={() => toast.info(CHUA_NOI_FILE)}
              sx={{ textTransform: "none" }}
            >
              Nhập Excel
            </Button>
            <Button
              startIcon={<FileDownloadRounded />}
              onClick={() => toast.info(CHUA_NOI_FILE)}
              sx={{ textTransform: "none" }}
            >
              Xuất Excel
            </Button>
            <Tooltip title="Duyệt các bản đang chờ duyệt trong danh sách bên dưới (theo bộ lọc đang chọn)">
              <Button
                variant="outlined"
                startIcon={<HowToRegRounded />}
                onClick={handleDuyet}
                sx={{ textTransform: "none" }}
              >
                Duyệt lương
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<SaveRounded />}
              onClick={handleLuu}
              disabled={dangLuu || !coThayDoi}
              sx={{ textTransform: "none" }}
            >
              Lưu cấu trúc lương
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Cấu trúc lương có thay đổi chưa lưu"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>
      </Paper>

      <CauTrucLuongCard values={nhap} onChange={setNhap} />
      <DanhSachSetLuongCard filters={filters} onFiltersChange={setFilters} rows={rows} />
    </Stack>
  );
}
