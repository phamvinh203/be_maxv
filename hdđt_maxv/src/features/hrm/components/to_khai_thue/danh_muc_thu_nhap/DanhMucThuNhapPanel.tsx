import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import { getErrorMessage } from "@/lib/errors";
import {
  useDanhSachDanhMuc,
  useXoaDanhMuc,
} from "../../../api/to_khai_thue/toKhaiThueQueries";
import type {
  NhomXuLyThue,
  OtherIncomeCategoryDto,
  TrangThaiDanhMuc,
} from "../../../types/toKhaiThue";
import { tienVn } from "../../../_shared/format";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import { NHAN_NHOM_XU_LY } from "../nhan";
import DanhMucThuNhapDialog from "./DanhMucThuNhapDialog";

/**
 * Màn Loại thu nhập — nơi khai các khoản chi trả ngoài lương và CÁCH TÍNH THUẾ của từng loại.
 *
 * Danh mục quyết định số thuế của mọi khoản ghi sau đó, nên sửa ở đây không tính lại khoản cũ:
 * số thuế đã ghi là ảnh chụp tại thời điểm chi trả, đúng như chứng từ khấu trừ đã phát cho cá nhân.
 */

const NHOM_LOC: Array<{ ma: NhomXuLyThue | ""; nhan: string }> = [
  { ma: "", nhan: "Tất cả cách tính" },
  { ma: "EXEMPT_FULL", nhan: NHAN_NHOM_XU_LY.EXEMPT_FULL },
  { ma: "EXEMPT_CAPPED", nhan: NHAN_NHOM_XU_LY.EXEMPT_CAPPED },
  { ma: "TAXABLE_FULL", nhan: NHAN_NHOM_XU_LY.TAXABLE_FULL },
  { ma: "WITHHOLDING_FLAT", nhan: NHAN_NHOM_XU_LY.WITHHOLDING_FLAT },
];

/** Tham số riêng của từng nhóm, gộp thành một câu cho cột "Tham số". */
function thamSoNhom(d: OtherIncomeCategoryDto): string {
  if (d.taxTreatmentGroup === "EXEMPT_CAPPED" && d.exemptCapAmount !== null) {
    return `Trần ${tienVn(d.exemptCapAmount)}đ/${d.exemptCapPeriod === "YEARLY" ? "năm" : "tháng"}`;
  }
  if (d.taxTreatmentGroup === "WITHHOLDING_FLAT" && d.withholdingRate !== null) {
    return `${d.withholdingRate}% từ ${tienVn(d.withholdingThreshold ?? 0)}đ`;
  }
  return "—";
}

export default function DanhMucThuNhapPanel() {
  const [qNhap, setQNhap] = useState("");
  const [q, setQ] = useState("");
  const [nhom, setNhom] = useState<NhomXuLyThue | "">("");
  const [trangThai, setTrangThai] = useState<TrangThaiDanhMuc | "">("");
  const [dangMoForm, setDangMoForm] = useState(false);
  const [danhMucSua, setDanhMucSua] = useState<OtherIncomeCategoryDto | null>(null);
  const [danhMucXoa, setDanhMucXoa] = useState<OtherIncomeCategoryDto | null>(null);

  useEffect(() => {
    const hen = setTimeout(() => setQ(qNhap.trim()), 300);
    return () => clearTimeout(hen);
  }, [qNhap]);

  const { data: danhSach = [], isLoading } = useDanhSachDanhMuc({
    q: q || undefined,
    taxTreatmentGroup: nhom || undefined,
    status: trangThai || undefined,
  });
  const xoaMut = useXoaDanhMuc();

  async function xoa() {
    if (!danhMucXoa) return;
    try {
      await xoaMut.mutateAsync(danhMucXoa.id);
      toast.success("Đã xóa loại thu nhập.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa xóa được loại thu nhập này."));
    } finally {
      setDanhMucXoa(null);
    }
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6">Loại thu nhập ngoài lương</Typography>
          <Typography variant="body2" color="text.secondary">
            Mỗi loại gắn một cách tính thuế — khoản ghi theo loại nào thì tính theo cách của loại đó
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => {
            setDanhMucSua(null);
            setDangMoForm(true);
          }}
        >
          Thêm loại
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Sửa tham số của một loại chỉ áp cho khoản ghi từ sau đó. Khoản đã ghi giữ nguyên số thuế cũ
        vì chứng từ khấu trừ đã phát cho cá nhân theo số đó.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            size="small"
            label="Tìm theo mã hoặc tên"
            value={qNhap}
            onChange={(e) => setQNhap(e.target.value)}
            sx={{ minWidth: 260 }}
          />
          <TextField
            select
            size="small"
            label="Cách tính thuế"
            value={nhom}
            onChange={(e) => setNhom(e.target.value as NhomXuLyThue | "")}
            sx={{ minWidth: 220 }}
          >
            {NHOM_LOC.map((o) => (
              <MenuItem key={o.ma || "tat-ca"} value={o.ma}>
                {o.nhan}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={trangThai}
            onChange={(e) => setTrangThai(e.target.value as TrangThaiDanhMuc | "")}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="ACTIVE">Đang dùng</MenuItem>
            <MenuItem value="INACTIVE">Ngừng dùng</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã</TableCell>
              <TableCell>Tên loại thu nhập</TableCell>
              <TableCell>Cách tính thuế</TableCell>
              <TableCell>Tham số</TableCell>
              <TableCell>Người nhận</TableCell>
              <TableCell align="right">Đang dùng</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="center">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : danhSach.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Không có loại thu nhập nào khớp bộ lọc.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              danhSach.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>{d.code}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{d.name}</Typography>
                    {d.legalBasisNote && (
                      <Typography variant="caption" color="text.secondary">
                        {d.legalBasisNote}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{NHAN_NHOM_XU_LY[d.taxTreatmentGroup]}</TableCell>
                  <TableCell>{thamSoNhom(d)}</TableCell>
                  <TableCell>
                    {d.appliesToInternalOnly ? "Chỉ nhân viên nội bộ" : "Nội bộ và vãng lai"}
                  </TableCell>
                  <TableCell align="right">{d.usageCount}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={d.status === "ACTIVE" ? "success" : "default"}
                      variant={d.status === "ACTIVE" ? "filled" : "outlined"}
                      label={d.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Sửa">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setDanhMucSua(d);
                          setDangMoForm(true);
                        }}
                      >
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={
                        d.usageCount > 0
                          ? "Đang có khoản dùng loại này — chuyển sang Ngừng dùng thay vì xóa"
                          : "Xóa"
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          disabled={d.usageCount > 0}
                          onClick={() => setDanhMucXoa(d)}
                        >
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {dangMoForm && (
        <DanhMucThuNhapDialog
          open={dangMoForm}
          onClose={() => setDangMoForm(false)}
          danhMuc={danhMucSua}
        />
      )}

      <XacNhanXoaDialog
        open={danhMucXoa !== null}
        tieuDe="Xóa loại thu nhập"
        noiDung={
          danhMucXoa
            ? `Xóa loại "${danhMucXoa.code} — ${danhMucXoa.name}"? Chưa có khoản nào dùng loại này nên xóa được, nhưng không lấy lại được.`
            : ""
        }
        onClose={() => setDanhMucXoa(null)}
        onXacNhan={() => void xoa()}
        dangXuLy={xoaMut.isPending}
      />
    </Box>
  );
}
