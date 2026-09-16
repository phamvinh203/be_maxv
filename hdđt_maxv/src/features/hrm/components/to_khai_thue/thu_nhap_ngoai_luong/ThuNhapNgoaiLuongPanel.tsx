import { useEffect, useMemo, useState } from "react";
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
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import { getErrorMessage } from "@/lib/errors";
import { layDanhSachKhoan } from "../../../api/to_khai_thue/toKhaiThueApi";
import {
  useDanhSachKhoan,
  useXoaKhoan,
} from "../../../api/to_khai_thue/toKhaiThueQueries";
import type {
  CachKhauTru,
  NhomXuLyThue,
  OtherIncomeRecordDto,
} from "../../../types/toKhaiThue";
import { tienVn } from "../../../_shared/format";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import { useCurrentPayrollPeriod } from "../../du_lieu_tinh_luong/useCurrentPayrollPeriod";
import { NHAN_CACH_KHAU_TRU, NHAN_NHOM_XU_LY, tenNguoiNhan } from "../nhan";
import ThuNhapNgoaiLuongDialog from "./ThuNhapNgoaiLuongDialog";
import { xuatExcelThuNhapNgoaiLuong } from "./thuNhapNgoaiLuongExcel";

/**
 * Màn Thu nhập ngoài lương — mỗi khoản là MỘT chứng từ chi trả (thưởng, thù lao cộng tác viên,
 * ăn ca bằng tiền…). Số thuế của từng khoản do máy chủ tính, màn này chỉ hiển thị.
 *
 * Lọc, tìm kiếm và phân trang đều đi ở máy chủ: kỳ đông người có thể vài nghìn khoản, tải hết về
 * rồi lọc ở trình duyệt là cách chắc chắn làm treo máy kế toán.
 */

const CO_TRANG = [25, 50, 100] as const;

const NHOM_LOC: Array<{ ma: NhomXuLyThue | ""; nhan: string }> = [
  { ma: "", nhan: "Tất cả nhóm" },
  { ma: "EXEMPT_FULL", nhan: NHAN_NHOM_XU_LY.EXEMPT_FULL },
  { ma: "EXEMPT_CAPPED", nhan: NHAN_NHOM_XU_LY.EXEMPT_CAPPED },
  { ma: "TAXABLE_FULL", nhan: NHAN_NHOM_XU_LY.TAXABLE_FULL },
  { ma: "WITHHOLDING_FLAT", nhan: NHAN_NHOM_XU_LY.WITHHOLDING_FLAT },
];

const KHAU_TRU_LOC: Array<{ ma: CachKhauTru | ""; nhan: string }> = [
  { ma: "", nhan: "Mọi cách khấu trừ" },
  { ma: "PROGRESSIVE", nhan: NHAN_CACH_KHAU_TRU.PROGRESSIVE },
  { ma: "FLAT_10", nhan: NHAN_CACH_KHAU_TRU.FLAT_10 },
  { ma: "EXEMPT_COMMIT", nhan: NHAN_CACH_KHAU_TRU.EXEMPT_COMMIT },
  { ma: "NO_DEDUCTION", nhan: NHAN_CACH_KHAU_TRU.NO_DEDUCTION },
];

export default function ThuNhapNgoaiLuongPanel() {
  const { selectedPeriodId, selectedPeriod, thangChon } = useCurrentPayrollPeriod();
  const [qNhap, setQNhap] = useState("");
  const [q, setQ] = useState("");
  const [nhom, setNhom] = useState<NhomXuLyThue | "">("");
  const [cachKhauTru, setCachKhauTru] = useState<CachKhauTru | "">("");
  const [trang, setTrang] = useState(0);
  const [coTrang, setCoTrang] = useState<number>(CO_TRANG[0]);
  const [dangMoForm, setDangMoForm] = useState(false);
  const [khoanSua, setKhoanSua] = useState<OtherIncomeRecordDto | null>(null);
  const [khoanXoa, setKhoanXoa] = useState<OtherIncomeRecordDto | null>(null);
  const [dangXuat, setDangXuat] = useState(false);

  // Gõ tới đâu lọc tới đó thì mỗi phím là một lượt gọi máy chủ — chờ 300 ms cho người dùng gõ xong.
  useEffect(() => {
    const hen = setTimeout(() => {
      setQ(qNhap.trim());
      setTrang(0);
    }, 300);
    return () => clearTimeout(hen);
  }, [qNhap]);

  const thamSo = useMemo(
    () =>
      selectedPeriodId
        ? {
            periodId: selectedPeriodId,
            q: q || undefined,
            taxTreatmentGroup: nhom || undefined,
            taxDeductionType: cachKhauTru || undefined,
            limit: coTrang,
            offset: trang * coTrang,
          }
        : null,
    [selectedPeriodId, q, nhom, cachKhauTru, coTrang, trang],
  );

  const { data, isLoading, isFetching } = useDanhSachKhoan(thamSo);
  const xoaMut = useXoaKhoan();

  const danhSach = data?.records ?? [];
  const tong = data?.summary;
  const daChot = data?.periodLocked ?? false;
  const thang = selectedPeriod?.month ?? thangChon.thang;
  const nam = selectedPeriod?.year ?? thangChon.nam;

  async function xoa() {
    if (!khoanXoa) return;
    try {
      await xoaMut.mutateAsync(khoanXoa.id);
      toast.success("Đã xóa khoản thu nhập ngoài lương.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa xóa được khoản này."));
    } finally {
      setKhoanXoa(null);
    }
  }

  async function xuatExcel() {
    if (!thamSo || danhSach.length === 0) {
      toast.info("Chưa có khoản nào để xuất.");
      return;
    }
    setDangXuat(true);
    try {
      // Xuất TOÀN BỘ khoản khớp bộ lọc chứ không chỉ trang đang xem: dòng tổng phía trên nói "toàn
      // bộ bộ lọc", file mà chỉ có một trang là kế toán thiếu dòng mà không biết. Tải lần lượt từng
      // trang 500 dòng — đúng trần `limit` của hợp đồng.
      const CO_TRANG_XUAT = 500;
      const tatCa: OtherIncomeRecordDto[] = [];
      for (let bo = 0; ; bo += CO_TRANG_XUAT) {
        const trangKhoan = await layDanhSachKhoan({
          ...thamSo,
          limit: CO_TRANG_XUAT,
          offset: bo,
        });
        tatCa.push(...trangKhoan.records);
        if (
          trangKhoan.records.length < CO_TRANG_XUAT ||
          tatCa.length >= trangKhoan.summary.totalRecords
        ) {
          break;
        }
      }
      await xuatExcelThuNhapNgoaiLuong(tatCa, thang, nam);
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa xuất được file Excel."));
    } finally {
      setDangXuat(false);
    }
  }

  if (!selectedPeriodId) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        Tháng {thangChon.thang}/{thangChon.nam} chưa có kỳ lương. Tạo kỳ lương ở màn Dữ liệu tính
        lương trước khi nhập thu nhập ngoài lương.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6">Thu nhập ngoài lương</Typography>
          <Typography variant="body2" color="text.secondary">
            Tháng {thang}/{nam} · mỗi dòng là một lần chi trả cho một người
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={dangXuat ? <CircularProgress size={16} /> : <FileDownloadRounded />}
            onClick={() => void xuatExcel()}
            disabled={dangXuat}
          >
            {dangXuat ? "Đang xuất…" : "Xuất Excel"}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            disabled={daChot}
            onClick={() => {
              setKhoanSua(null);
              setDangMoForm(true);
            }}
          >
            Thêm khoản
          </Button>
        </Stack>
      </Stack>

      {daChot && (
        <Alert severity="info" icon={<LockRounded />} sx={{ mb: 2 }}>
          Kỳ tháng {thang}/{nam} đang khóa nên không thêm, sửa hay xóa khoản được. Khóa có thể đến từ
          bảng kê "Thu nhập ngoài lương" ở màn Chốt kỳ lương, hoặc từ Bảng tính thuế tháng đã chốt —
          mở ở đúng nơi đang khóa. Riêng mở lại Bảng tính thuế sẽ xóa toàn bộ số thuế đã chốt của tháng.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            size="small"
            label="Tìm theo tên, mã nhân viên, mã số thuế"
            value={qNhap}
            onChange={(e) => setQNhap(e.target.value)}
            sx={{ minWidth: 280 }}
          />
          <TextField
            select
            size="small"
            label="Nhóm xử lý thuế"
            value={nhom}
            onChange={(e) => {
              setNhom(e.target.value as NhomXuLyThue | "");
              setTrang(0);
            }}
            sx={{ minWidth: 200 }}
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
            label="Cách khấu trừ"
            value={cachKhauTru}
            onChange={(e) => {
              setCachKhauTru(e.target.value as CachKhauTru | "");
              setTrang(0);
            }}
            sx={{ minWidth: 220 }}
          >
            {KHAU_TRU_LOC.map((o) => (
              <MenuItem key={o.ma || "tat-ca"} value={o.ma}>
                {o.nhan}
              </MenuItem>
            ))}
          </TextField>
          {isFetching && <CircularProgress size={20} sx={{ alignSelf: "center" }} />}
        </Stack>

        {tong && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
            <Chip label={`${tong.totalRecords} khoản`} />
            <Chip label={`Trước thuế ${tienVn(tong.totalGross)}`} />
            <Chip label={`Thuế khấu trừ ${tienVn(tong.totalTax)}`} color="warning" variant="outlined" />
            <Chip label={`Thực nhận ${tienVn(tong.totalNet)}`} color="success" variant="outlined" />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
              Tổng tính trên toàn bộ bộ lọc, không riêng trang đang xem.
            </Typography>
          </Stack>
        )}
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Người nhận</TableCell>
              <TableCell>Loại thu nhập</TableCell>
              <TableCell>Ngày chi trả</TableCell>
              <TableCell align="right">Trước thuế</TableCell>
              <TableCell align="right">Miễn thuế</TableCell>
              <TableCell align="right">Chịu thuế</TableCell>
              <TableCell>Cách khấu trừ</TableCell>
              <TableCell align="right">Thuế khấu trừ</TableCell>
              <TableCell align="right">Thực nhận</TableCell>
              <TableCell align="center">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : danhSach.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    Chưa có khoản thu nhập ngoài lương nào khớp bộ lọc.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              danhSach.map((k) => (
                <TableRow key={k.id} hover>
                  <TableCell>
                    <Typography variant="body2">{tenNguoiNhan(k.fullName, k.ma_nv)}</Typography>
                    {k.taxCode && (
                      <Typography variant="caption" color="text.secondary">
                        MST {k.taxCode}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{k.category.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {k.category.code} · {NHAN_NHOM_XU_LY[k.taxTreatmentGroup]}
                    </Typography>
                  </TableCell>
                  <TableCell>{k.paymentDate.slice(0, 10)}</TableCell>
                  <TableCell align="right">{tienVn(k.grossAmount)}</TableCell>
                  <TableCell align="right">{tienVn(k.exemptAmount)}</TableCell>
                  <TableCell align="right">{tienVn(k.taxableAmount)}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={NHAN_CACH_KHAU_TRU[k.taxDeductionType]} />
                  </TableCell>
                  <TableCell align="right">{tienVn(k.taxDeducted)}</TableCell>
                  <TableCell align="right">{tienVn(k.netAmount)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={daChot ? "Tháng đã chốt Bảng tính thuế" : "Sửa"}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={daChot}
                          onClick={() => {
                            setKhoanSua(k);
                            setDangMoForm(true);
                          }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={daChot ? "Tháng đã chốt Bảng tính thuế" : "Xóa"}>
                      <span>
                        <IconButton size="small" disabled={daChot} onClick={() => setKhoanXoa(k)}>
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
        <TablePagination
          component="div"
          count={tong?.totalRecords ?? 0}
          page={trang}
          onPageChange={(_e, t) => setTrang(t)}
          rowsPerPage={coTrang}
          onRowsPerPageChange={(e) => {
            setCoTrang(Number(e.target.value));
            setTrang(0);
          }}
          rowsPerPageOptions={[...CO_TRANG]}
          labelRowsPerPage="Số dòng mỗi trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
        />
      </TableContainer>

      {dangMoForm && (
        <ThuNhapNgoaiLuongDialog
          open={dangMoForm}
          onClose={() => setDangMoForm(false)}
          periodId={selectedPeriodId}
          thang={thang}
          nam={nam}
          khoan={khoanSua}
        />
      )}

      <XacNhanXoaDialog
        open={khoanXoa !== null}
        tieuDe="Xóa khoản thu nhập ngoài lương"
        noiDung={
          khoanXoa
            ? `Xóa khoản ${khoanXoa.category.name} ngày ${khoanXoa.paymentDate.slice(0, 10)} của ${khoanXoa.fullName}? Số thuế của tháng sẽ tính lại ngay.`
            : ""
        }
        onClose={() => setKhoanXoa(null)}
        onXacNhan={() => void xoa()}
        dangXuLy={xoaMut.isPending}
      />
    </Box>
  );
}
