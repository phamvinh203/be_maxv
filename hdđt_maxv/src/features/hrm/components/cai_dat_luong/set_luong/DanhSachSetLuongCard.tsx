import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { sapXepCay } from "../../../cay";
import { LOAI_HD, TRANG_THAI_SET_LUONG } from "../../../constants";
import { ngayVn, nhan, tienVn } from "../../../format";
import { usePhongBanList } from "../../../mock/hooks/phongBan";
import {
  useDemSetLuong,
  useSetLuongRows,
  useXoaSetLuong,
} from "../../../mock/hooks/setLuong";
import type { LoaiHopDong, SetLuongFilters, SetLuongRow } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import SetLuongNhanVienDialog from "./SetLuongNhanVienDialog";

const MAU_TRANG_THAI = {
  nhap: "default",
  cho_duyet: "warning",
  da_duyet: "success",
} as const;

export default function DanhSachSetLuongCard() {
  const [filters, setFilters] = useState<SetLuongFilters>({
    q: "",
    ma_pb: "",
    loai_hd: "",
    daSet: true,
  });
  const rows = useSetLuongRows(filters);
  const dem = useDemSetLuong();
  const phongBan = usePhongBanList();
  const xoaSetLuong = useXoaSetLuong();

  const [maNvDangMo, setMaNvDangMo] = useState<string | null>(null);
  const [chiDoc, setChiDoc] = useState(false);
  const [dangXoa, setDangXoa] = useState<SetLuongRow | undefined>(undefined);

  const cayPhongBan = useMemo(() => sapXepCay(phongBan), [phongBan]);

  const dat = <K extends keyof SetLuongFilters>(khoa: K, giaTri: SetLuongFilters[K]) =>
    setFilters((cu) => ({ ...cu, [khoa]: giaTri }));

  const moDialog = (maNv: string, doc: boolean) => {
    setChiDoc(doc);
    setMaNvDangMo(maNv);
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaSetLuong(dangXoa.ma_nv);
      toast.success(`Đã xóa set lương của ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được set lương."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { lg: "center" }, justifyContent: "space-between" }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filters.daSet}
          onChange={(_, giaTri: boolean | null) => giaTri !== null && dat("daSet", giaTri)}
        >
          <ToggleButton value sx={{ textTransform: "none", px: 2 }}>
            Đã set lương ({dem.daSet})
          </ToggleButton>
          <ToggleButton value={false} sx={{ textTransform: "none", px: 2 }}>
            Chưa set lương ({dem.chuaSet})
          </ToggleButton>
        </ToggleButtonGroup>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            placeholder="Tìm mã, tên hoặc số tài khoản"
            value={filters.q}
            onChange={(e) => dat("q", e.target.value)}
            sx={{ width: { xs: "100%", sm: 280 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Phòng ban"
            value={filters.ma_pb}
            onChange={(e) => dat("ma_pb", e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả phòng ban</MenuItem>
            <Divider />
            {cayPhongBan.map((pb) => (
              <MenuItem key={pb.ma_pb} value={pb.ma_pb}>
                {" ".repeat((pb.cap - 1) * 4)}
                {pb.ten_pb}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Loại hợp đồng"
            value={filters.loai_hd}
            onChange={(e) => dat("loai_hd", e.target.value as LoaiHopDong | "")}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả loại HĐ</MenuItem>
            {LOAI_HD.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Mã NV</TableCell>
              <TableCell>Họ và tên</TableCell>
              <TableCell>Chức vụ</TableCell>
              <TableCell>Loại HĐ</TableCell>
              <TableCell align="center">Lần thiết lập</TableCell>
              <TableCell>Hiệu lực</TableCell>
              <TableCell>Số tài khoản</TableCell>
              <TableCell align="right">Tổng lương</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ma_nv} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {row.ma_nv}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {row.ho_ten}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{row.ten_cv || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {row.loai_hd ? nhan(LOAI_HD, row.loai_hd) : "Chưa có HĐ"}
                </TableCell>
                <TableCell align="center">{row.daSet ? row.lan_thiet_lap : "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {row.daSet && row.hieu_luc_tu
                    ? `${ngayVn(row.hieu_luc_tu)} → ${
                        row.hieu_luc_den ? ngayVn(row.hieu_luc_den) : "nay"
                      }`
                    : "—"}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {row.so_tk || (
                    <Typography variant="caption" color="warning.main">
                      Chưa có
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {row.daSet ? `${tienVn(row.tong_luong)} ₫` : "—"}
                </TableCell>
                <TableCell>
                  {row.trang_thai ? (
                    <Chip
                      size="small"
                      color={MAU_TRANG_THAI[row.trang_thai]}
                      label={
                        TRANG_THAI_SET_LUONG.find((item) => item.value === row.trang_thai)
                          ?.label ?? row.trang_thai
                      }
                      sx={{ height: 22 }}
                    />
                  ) : (
                    <Chip
                      size="small"
                      variant="outlined"
                      label="Chưa thiết lập"
                      sx={{ height: 22 }}
                    />
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title={row.daSet ? "Xem" : "Chưa set lương nên chưa có gì để xem"}>
                    <Box component="span">
                      <IconButton
                        size="small"
                        disabled={!row.daSet}
                        onClick={() => moDialog(row.ma_nv, true)}
                      >
                        <VisibilityRounded fontSize="small" />
                      </IconButton>
                    </Box>
                  </Tooltip>
                  <Tooltip title={row.daSet ? "Sửa" : "Thiết lập lương"}>
                    <IconButton size="small" onClick={() => moDialog(row.ma_nv, false)}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={row.daSet ? "Xóa" : "Chưa có gì để xóa"}>
                    <Box component="span">
                      <IconButton
                        size="small"
                        color="error"
                        disabled={!row.daSet}
                        onClick={() => setDangXoa(row)}
                      >
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Box>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Không có nhân viên nào khớp bộ lọc.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <SetLuongNhanVienDialog
        open={Boolean(maNvDangMo)}
        maNv={maNvDangMo}
        chiDoc={chiDoc}
        onClose={() => setMaNvDangMo(null)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa set lương"
        noiDung={
          <>
            Xóa set lương của <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv})? Nhân viên
            sẽ quay lại danh sách "Chưa set lương".
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
