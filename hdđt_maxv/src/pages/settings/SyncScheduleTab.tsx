import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import InboxRounded from "@mui/icons-material/InboxRounded";
import { useSyncHistoryQuery } from "../../features/hddt/api/syncQueries";
import type { SyncDirection } from "../../features/hddt/types";
import { formatDateVN, formatDateTimeVN } from "../../features/hddt/dateUtils";
import { syncLogReason } from "../../features/hddt/syncLogText";

type Frequency = "hourly" | "every6h" | "daily" | "weekly";

/** Nhãn chiều đồng bộ cho cột "Chiều" (khớp từ ngữ "đầu vào/đầu ra" của tab này). */
const DIRECTION_LABEL: Record<SyncDirection, string> = {
  all: "Tất cả",
  purchase: "Đầu vào",
  sold: "Đầu ra",
};

export default function SyncScheduleTab() {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [runTime, setRunTime] = useState("06:00");
  const [syncPurchase, setSyncPurchase] = useState(true);
  const [syncSold, setSyncSold] = useState(true);

  // Lịch sử đồng bộ THẬT — dùng chung query/cache với dialog "Đồng bộ hóa đơn".
  const historyQuery = useSyncHistoryQuery(true);
  const history = historyQuery.data ?? [];
  const loadingHistory = historyQuery.isFetching;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Lịch tự động đồng bộ hoá đơn
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Cấu hình lịch tự động lấy hóa đơn từ Thuế điện tử và xem lại lịch sử các lần đã chạy. (Phần
        "Lịch sử đồng bộ" bên dưới là dữ liệu thật; phần cấu hình lịch phía trên chỉ minh họa giao
        diện — chạy nền tự động còn vướng captcha/token GDT nên chưa bật.)
      </Typography>

      {/* Cấu hình lịch */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
        >
          <Box>
            <Typography sx={{ fontWeight: 600 }}>Bật đồng bộ tự động</Typography>
            <Typography variant="body2" color="text.secondary">
              Tự động chạy tra cứu &amp; lưu hóa đơn theo lịch bên dưới.
            </Typography>
          </Box>
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }} disabled={!enabled}>
            <InputLabel id="frequency-label">Tần suất</InputLabel>
            <Select
              labelId="frequency-label"
              label="Tần suất"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              <MenuItem value="hourly">Mỗi giờ</MenuItem>
              <MenuItem value="every6h">Mỗi 6 giờ</MenuItem>
              <MenuItem value="daily">Hàng ngày</MenuItem>
              <MenuItem value="weekly">Hàng tuần</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Giờ chạy"
            type="time"
            size="small"
            value={runTime}
            onChange={(e) => setRunTime(e.target.value)}
            disabled={!enabled || frequency === "hourly" || frequency === "every6h"}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Đồng bộ theo chiều
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={syncPurchase}
                onChange={(e) => setSyncPurchase(e.target.checked)}
                disabled={!enabled}
              />
            }
            label="Hóa đơn đầu vào"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={syncSold}
                onChange={(e) => setSyncSold(e.target.checked)}
                disabled={!enabled}
              />
            }
            label="Hóa đơn đầu ra"
          />
        </Stack>
      </Paper>

      {/* Lịch sử đồng bộ */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Lịch sử đồng bộ
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
              <TableCell>Thời gian</TableCell>
              <TableCell>Chiều</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
              <TableCell align="right">Số lượng đồng bộ</TableCell>
              <TableCell>Khoảng ngày</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.length > 0 ? (
              history.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{formatDateTimeVN(row.created_at)}</TableCell>
                  <TableCell>{DIRECTION_LABEL[row.direction]}</TableCell>
                  <TableCell align="center">
                    {row.trang_thai === "done" ? (
                      <Chip size="small" color="success" variant="outlined" label="Hoàn thành" />
                    ) : (
                      <Tooltip title={syncLogReason(row.dien_giai)}>
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label="Chưa hoàn thành"
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {row.da_luu}/{row.tong}
                  </TableCell>
                  <TableCell>
                    {formatDateVN(row.tu_ngay)} – {formatDateVN(row.den_ngay)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} sx={{ border: 0, py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: "center", color: "text.disabled" }}>
                    {loadingHistory ? (
                      <CircularProgress size={24} />
                    ) : (
                      <>
                        <InboxRounded fontSize="large" />
                        <Typography variant="body2">Chưa có lịch sử đồng bộ</Typography>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
