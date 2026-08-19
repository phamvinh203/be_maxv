import { useState, type ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import FilterAltRounded from "@mui/icons-material/FilterAltRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import type { NhanBoLoc } from "../config";

/**
 * Giá trị bộ lọc tra cứu hồ sơ đã nộp.
 *
 * Khóa đặt tên trung tính (`loaiHoSo`, `hoSo`) chứ không phải `loaiToKhai`:
 * cùng bộ ô này tab Giấy nộp tiền dùng để lọc số tham chiếu và ngân hàng nộp.
 */
export interface BoLocHoSoValues {
  maGiaoDich: string;
  loaiHoSo: string;
  hoSo: string;
  noiNop: string;
  kyTinhThue: string;
  /** Ngày nộp từ, dạng `yyyy-mm-dd` như input type=date trả về. */
  tuNgay: string;
  /** Ngày nộp đến, dạng `yyyy-mm-dd`. */
  denNgay: string;
}

const BO_LOC_RONG: BoLocHoSoValues = {
  maGiaoDich: "",
  loaiHoSo: "",
  hoSo: "",
  noiNop: "",
  kyTinhThue: "",
  tuNgay: "",
  denNgay: "",
};

interface Props {
  /** Tiêu đề bộ lọc — mỗi tab lọc một loại hồ sơ nên chữ khác nhau. */
  tieuDe: string;
  /** Nhãn 7 ô, lấy từ `TAB_DVC` của tab đang mở. */
  nhan: NhanBoLoc;
  /** Đang tra cứu — khoá hai nút và thay chữ trên nút Tìm kiếm bằng vòng quay. */
  loading?: boolean;
  /** Giá trị khởi tạo — cũng là giá trị nút "Bỏ tìm kiếm" trả về. */
  initialValues?: BoLocHoSoValues;
  onSearch: (values: BoLocHoSoValues) => void;
  /** Trang chứa dọn kết quả cũ. Bỏ trống nếu chưa có gì để dọn — form vẫn tự xoá. */
  onReset?: () => void;
}

/**
 * Bộ lọc tra cứu hồ sơ đã nộp — gập/mở được, khớp layout bộ lọc hóa đơn.
 *
 * Ba tab dùng chung đúng bộ bảy ô này, chỉ khác nhãn, nên nhãn nhận từ ngoài
 * vào thay vì viết cứng: khác nhau có bấy nhiêu mà tách ba component thì ba chỗ
 * phải sửa mỗi lần layout đổi.
 *
 * Chỉ giữ state của form rồi bắn giá trị ra ngoài qua `onSearch`, không tự gọi
 * API: mỗi tab tra cứu một loại hồ sơ nên endpoint do trang chứa chọn.
 */
export default function BoLocHoSo({
  tieuDe,
  nhan,
  loading = false,
  initialValues = BO_LOC_RONG,
  onSearch,
  onReset,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [values, setValues] = useState<BoLocHoSoValues>(initialValues);

  const setField =
    (key: keyof BoLocHoSoValues) => (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const handleReset = () => {
    setValues(initialValues);
    onReset?.();
  };

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <FilterAltRounded fontSize="small" color="action" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {tieuDe}
          </Typography>
        </Stack>

        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
        >
          {expanded ? (
            <RemoveRounded fontSize="small" />
          ) : (
            <AddRounded fontSize="small" />
          )}
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label={nhan.maGiaoDich}
              value={values.maGiaoDich}
              onChange={setField("maGiaoDich")}
              size="small"
              fullWidth
            />
            <TextField
              label={nhan.loaiHoSo}
              value={values.loaiHoSo}
              onChange={setField("loaiHoSo")}
              size="small"
              fullWidth
            />

            <TextField
              label={nhan.hoSo}
              value={values.hoSo}
              onChange={setField("hoSo")}
              size="small"
              fullWidth
            />
            <TextField
              label={nhan.noiNop}
              value={values.noiNop}
              onChange={setField("noiNop")}
              size="small"
              fullWidth
            />

            <TextField
              label={nhan.kyTinhThue}
              value={values.kyTinhThue}
              onChange={setField("kyTinhThue")}
              size="small"
              fullWidth
            />
            {/* Ngày nộp là một khoảng nên hai ô nằm chung một ô lưới. */}
            <Stack direction="row" spacing={1.5}>
              <TextField
                label={nhan.tuNgay}
                type="date"
                value={values.tuNgay}
                onChange={setField("tuNgay")}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={nhan.denNgay}
                type="date"
                value={values.denNgay}
                onChange={setField("denNgay")}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ justifyContent: "center", mt: 2 }}
          >
            <Button
              variant="contained"
              startIcon={loading ? undefined : <SearchRounded />}
              sx={{ textTransform: "none", px: 4 }}
              disabled={loading}
              onClick={() => onSearch(values)}
            >
              {loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Tìm kiếm"
              )}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RestartAltRounded />}
              sx={{ textTransform: "none" }}
              disabled={loading}
              onClick={handleReset}
            >
              Bỏ tìm kiếm
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
