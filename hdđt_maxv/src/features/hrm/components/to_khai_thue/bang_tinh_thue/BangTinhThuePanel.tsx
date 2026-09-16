import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
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
import type { Theme } from "@mui/material/styles";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { getErrorMessage } from "@/lib/errors";
import {
  useBangTinhThue,
  useChotBangTinhThue,
  useMoLaiBangTinhThue,
} from "../../../api/to_khai_thue/toKhaiThueQueries";
import type { DongBangTinhThueDto, LoaiLaoDongThue } from "../../../types/toKhaiThue";
import { tienVn } from "../../../_shared/format";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import { useCurrentPayrollPeriod } from "../../du_lieu_tinh_luong/useCurrentPayrollPeriod";
import { useLaChuTaiKhoan } from "../../chot_ky_luong/useLaChuTaiKhoan";
import { NHAN_LOAI_LAO_DONG } from "../nhan";
import MoLaiBangTinhThueDialog from "./MoLaiBangTinhThueDialog";
import { xuatExcelBangTinhThue } from "./bangTinhThueExcel";
import { COT, COT_CON, CUOI_NHOM, HEADER_TREN, type CotBang } from "./cotBangTinhThue";

/**
 * Màn Bảng tính thuế TNCN tháng — gộp lương và thu nhập ngoài lương của từng người rồi tính thuế.
 *
 * Hai trạng thái khác nhau về BẢN CHẤT, không chỉ khác nhãn:
 *   - Nháp: máy chủ tính trực tiếp mỗi lần mở, số đổi theo dữ liệu hiện tại.
 *   - Đã chốt: đọc ảnh chụp đã đóng băng, không tính lại — đây mới là số lên tờ khai quý.
 *
 * Toàn bộ số liệu và biểu thuế lấy từ máy chủ; màn này không tự cộng trừ gì ngoài dòng tổng.
 */

const LOAI_LOC: Array<{ ma: LoaiLaoDongThue | ""; nhan: string }> = [
  { ma: "", nhan: "Mọi loại lao động" },
  { ma: "HOP_DONG_3_THANG_TRO_LEN", nhan: NHAN_LOAI_LAO_DONG.HOP_DONG_3_THANG_TRO_LEN },
  { ma: "THOI_VU_THU_VIEC", nhan: NHAN_LOAI_LAO_DONG.THOI_VU_THU_VIEC },
  { ma: "VANG_LAI", nhan: NHAN_LOAI_LAO_DONG.VANG_LAI },
];

/** Ba cột đầu dính trái — kéo ngang 28 cột mà mất tên người thì bảng vô dụng. */
const DINH_TRAI: Record<string, { left: number; minWidth: number }> = {
  stt: { left: 0, minWidth: 56 },
  ma_nv: { left: 56, minWidth: 96 },
  ho_ten: { left: 152, minWidth: 200 },
};

/** Đặt cứng để dòng header thứ hai biết phải dính ở đâu; đo theo nội dung sẽ lệch khi đổi cỡ chữ. */
const CAO_HEADER = 36;

/**
 * Bốn tông nền của bảng, mỗi tông một mã xám cho chế độ sáng và một cho chế độ tối — app có cả
 * light lẫn dark (`theme/displaySettings.ts`), đặt cứng `grey.100` kiểu chỉ-nghĩ-cho-nền-trắng thì
 * sang chế độ tối thành mấy khối gần trắng nuốt mất chữ.
 *
 * Nền phải ĐỤC (không dùng `action.hover` trong suốt): ba cột dính trái và dòng tổng dính đáy đều
 * có nội dung cuộn qua bên dưới, nền trong là nhìn xuyên thấy chữ chồng chữ.
 */
type Ton = "soc" | "header" | "tong" | "reChuot";
type MaXam = "100" | "200" | "300" | "400" | "600" | "700" | "800" | "900";

/**
 * Thang bốn bậc, mỗi bậc phải PHÂN BIỆT được với bậc kề — đổi một tông là phải đẩy cả thang, nếu
 * không hai thứ khác vai sẽ trùng màu (sọc `grey.50` từng quá nhạt, nâng lên `100` thì đụng ngay
 * nền header cũ, nên header lên `200` và dòng tổng lên `300`).
 * Thang chế độ tối giữ nguyên — nó không bị nhạt, và `grey.500` trở xuống thì chữ trắng hết đọc nổi.
 */
const TONG_NEN: Record<Ton, { sang: MaXam; toi: MaXam }> = {
  soc: { sang: "100", toi: "900" },
  header: { sang: "200", toi: "800" },
  tong: { sang: "300", toi: "700" },
  reChuot: { sang: "400", toi: "600" },
};

const nen = (t: Ton) => (theme: Theme) =>
  theme.palette.grey[TONG_NEN[t][theme.palette.mode === "dark" ? "toi" : "sang"]];

type LopO = "head" | "body" | "tong";

/**
 * Ô dính trái (ba cột đầu) và/hoặc dính đáy (dòng tổng). Ô dính PHẢI có nền đục, nếu không nội dung
 * đang cuộn qua sẽ hiện xuyên qua nó.
 *
 * Thứ tự `zIndex`: header trên hết (3/5) → dòng tổng (2/4) → thân bảng (0/1); trong mỗi tầng thì ô
 * dính trái cao hơn ô thường một bậc để lúc cuộn ngang nó nằm trên các ô trôi qua.
 */
function sxO(khoa: string, lop: LopO, soc = false) {
  const d = DINH_TRAI[khoa];
  // Tô nền vào TỪNG Ô chứ không vào `<TableRow>`: ba ô dính trái vốn đã phải có nền đục riêng, tô ở
  // hàng thì chúng vẫn trắng trơ giữa dải sọc. Tô ở ô thì mọi ô cùng một đường, khỏi phải khớp hai
  // nguồn màu.
  const nenO =
    lop === "head"
      ? nen("header")
      : lop === "tong"
        ? nen("tong")
        : soc
          ? nen("soc")
          : undefined;

  return {
    whiteSpace: "nowrap" as const,
    // Vạch mảnh giữa mọi cột, vạch đậm ở ranh giới nhóm — không có thì 28 cột số dính thành một dải.
    borderRight: CUOI_NHOM.has(khoa) ? "2px solid" : "1px solid",
    borderRightColor: CUOI_NHOM.has(khoa) ? "text.secondary" : "divider",
    ...(nenO ? { bgcolor: nenO } : {}),
    ...(lop === "head" ? { zIndex: 3 } : {}),
    // Dòng tổng dính đáy khung: cuộn tới đâu vẫn thấy tổng, khỏi phải kéo xuống cuối để đối chiếu.
    ...(lop === "tong" ? { position: "sticky" as const, bottom: 0, zIndex: 2 } : {}),
    ...(d
      ? {
          position: "sticky" as const,
          left: d.left,
          minWidth: d.minWidth,
          zIndex: lop === "head" ? 5 : lop === "tong" ? 4 : 1,
          bgcolor: nenO ?? "background.paper",
        }
      : {}),
  };
}

function veO(c: CotBang, d: DongBangTinhThueDto, i: number) {
  if (c.kieu === "stt") return i + 1;
  // `left` của cột "Họ và tên" cộng cứng từ bề rộng hai cột trước, nên ô "Mã NV" KHÔNG được phép nở
  // ra theo nội dung. Mã thực tế là `NV0001`, nhưng cột cho phép tới 24 ký tự — mã dài bất thường mà
  // nở ra thì ba cột dính trái xô lệch nhau. Cắt bớt kèm chú thích chứ không để đẩy cột.
  if (c.khoa === "ma_nv") {
    const ma = c.chu?.(d) ?? "";
    return (
      <Tooltip title={ma}>
        <Box sx={{ width: 64, overflow: "hidden", textOverflow: "ellipsis" }}>{ma}</Box>
      </Tooltip>
    );
  }
  if (c.kieu === "trong")
    return (
      <Box component="span" sx={{ color: "text.disabled" }}>
        —
      </Box>
    );

  const noiDung = c.kieu === "tien" && c.lay ? tienVn(c.lay(d)) : (c.chu?.(d) ?? "");
  const ghiChu = c.ghiChu?.(d);
  if (!ghiChu) return noiDung;
  return (
    <Tooltip title={ghiChu}>
      <Box component="span" sx={{ borderBottom: "1px dotted", cursor: "help" }}>
        {noiDung}
      </Box>
    </Tooltip>
  );
}

export default function BangTinhThuePanel() {
  const { selectedPeriodId, thangChon } = useCurrentPayrollPeriod();
  // Mở lại tháng là việc của ADMIN/OWNER (E-tkt-014). Khóa nút chỉ để báo sớm kèm lời giải thích;
  // máy chủ vẫn là bên chặn thật.
  const laChuTaiKhoan = useLaChuTaiKhoan();
  const [qNhap, setQNhap] = useState("");
  const [q, setQ] = useState("");
  const [loai, setLoai] = useState<LoaiLaoDongThue | "">("");
  const [cuTru, setCuTru] = useState<"" | "true" | "false">("");
  const [hienBieuThue, setHienBieuThue] = useState(false);
  const [hoiChot, setHoiChot] = useState(false);
  const [hoiMoLai, setHoiMoLai] = useState(false);
  const [dangXuat, setDangXuat] = useState(false);

  useEffect(() => {
    const hen = setTimeout(() => setQ(qNhap.trim()), 300);
    return () => clearTimeout(hen);
  }, [qNhap]);

  const thamSo = useMemo(
    () =>
      selectedPeriodId
        ? {
            periodId: selectedPeriodId,
            q: q || undefined,
            loaiLaoDong: loai || undefined,
            cuTru: cuTru === "" ? undefined : cuTru === "true",
          }
        : null,
    [selectedPeriodId, q, loai, cuTru],
  );

  const { data: bang, isLoading, isFetching, refetch } = useBangTinhThue(thamSo);
  const chotMut = useChotBangTinhThue();
  const moLaiMut = useMoLaiBangTinhThue();

  const daChot = bang?.trangThai === "DA_CHOT";
  /** Câu mô tả bộ lọc đang áp — đi vào cả nhãn nút lẫn dòng phụ đề của file Excel (RVW-746). */
  const dangLoc = q !== "" || loai !== "" || cuTru !== "";
  const moTaLoc = dangLoc
    ? [
        loai ? `loại lao động: ${NHAN_LOAI_LAO_DONG[loai]}` : "",
        cuTru === "" ? "" : cuTru === "true" ? "chỉ cá nhân cư trú" : "chỉ cá nhân không cư trú",
        q ? `từ khóa "${q}"` : "",
      ]
        .filter(Boolean)
        .join(", ")
    : "toàn kỳ, không lọc";

  async function chot() {
    if (!selectedPeriodId) return;
    try {
      const kq = await chotMut.mutateAsync(selectedPeriodId);
      toast.success(`Đã chốt Bảng tính thuế tháng — đóng băng ${kq.soDong} dòng.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa chốt được Bảng tính thuế tháng."));
    } finally {
      setHoiChot(false);
    }
  }

  async function moLai(lyDo: string) {
    if (!selectedPeriodId) return;
    try {
      await moLaiMut.mutateAsync({ periodId: selectedPeriodId, lyDo });
      toast.success("Đã mở lại Bảng tính thuế tháng.");
      setHoiMoLai(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa mở lại được Bảng tính thuế tháng."));
    }
  }

  async function xuatExcel() {
    if (!bang) return;
    setDangXuat(true);
    try {
      await xuatExcelBangTinhThue(bang, moTaLoc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa xuất được file Excel."));
    } finally {
      setDangXuat(false);
    }
  }

  if (!selectedPeriodId) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        Tháng {thangChon.thang}/{thangChon.nam} chưa có kỳ lương nên chưa có gì để tính thuế.
      </Alert>
    );
  }

  const danhSach = bang?.danhSach ?? [];
  const congCot = (lay: (d: DongBangTinhThueDto) => number) => danhSach.reduce((t, d) => t + lay(d), 0);

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h6">Bảng tính thuế TNCN</Typography>
            {bang && (
              <Chip
                size="small"
                icon={daChot ? <LockRounded /> : undefined}
                color={daChot ? "success" : "default"}
                label={daChot ? "Đã chốt" : "Nháp — tính trực tiếp"}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {bang ? `${bang.periodName} · ${bang.kpi.tongNguoiLaoDong} người` : "Đang tải…"}
            {daChot && bang?.chotBoiTen ? ` · chốt bởi ${bang.chotBoiTen}` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={isFetching ? <CircularProgress size={16} /> : <RefreshRounded />}
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Làm mới
          </Button>
          <Button
            startIcon={dangXuat ? <CircularProgress size={16} /> : <FileDownloadRounded />}
            onClick={() => void xuatExcel()}
            disabled={dangXuat || !bang}
          >
            {dangXuat ? "Đang xuất…" : dangLoc ? "Xuất Excel (theo bộ lọc)" : "Xuất Excel"}
          </Button>
          {bang?.coTheMoLai && (
            <Tooltip title={laChuTaiKhoan ? "" : "Chỉ chủ tài khoản hoặc quản trị viên mở lại được"}>
              <span>
                <Button
                  color="warning"
                  startIcon={<LockOpenRounded />}
                  disabled={!laChuTaiKhoan}
                  onClick={() => setHoiMoLai(true)}
                >
                  Mở lại tháng
                </Button>
              </span>
            </Tooltip>
          )}
          {bang?.coTheChot && (
            <Button variant="contained" startIcon={<LockRounded />} onClick={() => setHoiChot(true)}>
              Chốt tháng
            </Button>
          )}
        </Stack>
      </Stack>

      {bang && !daChot && !bang.coTheChot && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Kỳ lương chưa khóa sổ nên chưa chốt được Bảng tính thuế. Khóa sổ kỳ lương ở màn Chốt kỳ
          lương trước — số thuế phải dựa trên bảng lương đã đóng băng.
        </Alert>
      )}

      {bang && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Số người
              </Typography>
              <Typography variant="h6">{bang.kpi.tongNguoiLaoDong}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Thu nhập chịu thuế
              </Typography>
              <Typography variant="h6">{tienVn(bang.kpi.tongThuNhapChiuThue)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Giảm trừ gia cảnh
              </Typography>
              <Typography variant="h6">{tienVn(bang.kpi.tongGiamTruGiaCanh)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Tổng thuế TNCN
              </Typography>
              <Typography variant="h6" color="warning.main">
                {tienVn(bang.kpi.tongThueTncn)}
              </Typography>
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Bốn con số trên tính trên TOÀN KỲ, không đổi theo bộ lọc bên dưới.
          </Typography>

          <Box sx={{ mt: 1 }}>
            <Button size="small" onClick={() => setHienBieuThue((v) => !v)}>
              {hienBieuThue ? "Ẩn biểu thuế đang áp" : "Xem biểu thuế đang áp"}
            </Button>
            <Collapse in={hienBieuThue}>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Hiệu lực từ {bang.bieuThueApDung.effectiveFrom.slice(0, 10)} · giảm trừ bản thân{" "}
                  {tienVn(bang.bieuThueApDung.personalDeduction)}đ · mỗi người phụ thuộc{" "}
                  {tienVn(bang.bieuThueApDung.dependentDeduction)}đ
                </Typography>
                <Table size="small" sx={{ maxWidth: 420 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Bậc</TableCell>
                      <TableCell align="right">Đến mức (đồng/tháng)</TableCell>
                      <TableCell align="right">Thuế suất</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bang.bieuThueApDung.taxBrackets.map((b, i) => (
                      <TableRow key={`${b.khoang}-${b.thueSuat}`}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell align="right">
                          {b.khoang > 0 ? tienVn(b.khoang) : "Trên mức trước"}
                        </TableCell>
                        <TableCell align="right">{b.thueSuat}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            </Collapse>
          </Box>
        </Paper>
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
            label="Loại lao động"
            value={loai}
            onChange={(e) => setLoai(e.target.value as LoaiLaoDongThue | "")}
            sx={{ minWidth: 220 }}
          >
            {LOAI_LOC.map((o) => (
              <MenuItem key={o.ma || "tat-ca"} value={o.ma}>
                {o.nhan}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Cư trú"
            value={cuTru}
            onChange={(e) => setCuTru(e.target.value as "" | "true" | "false")}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="true">Cá nhân cư trú</MenuItem>
            <MenuItem value="false">Không cư trú</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 640 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {HEADER_TREN.map((g) =>
                g.nhom ? (
                  <TableCell
                    key={g.nhom}
                    align="center"
                    colSpan={g.cot.length}
                    sx={{
                      ...sxO(g.cot[g.cot.length - 1].khoa, "head"),
                      top: 0,
                      height: CAO_HEADER,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {g.nhom}
                  </TableCell>
                ) : (
                  <TableCell
                    key={g.cot[0].khoa}
                    rowSpan={2}
                    align={g.cot[0].kieu === "chu" || g.cot[0].kieu === "stt" ? "left" : "right"}
                    sx={{
                      ...sxO(g.cot[0].khoa, "head"),
                      top: 0,
                      height: CAO_HEADER * 2,
                      fontWeight: 700,
                    }}
                  >
                    {g.cot[0].nhan}
                  </TableCell>
                ),
              )}
            </TableRow>
            <TableRow>
              {COT_CON.map((c) => (
                <TableCell
                  key={c.khoa}
                  align={c.kieu === "chu" ? "left" : "right"}
                  sx={{ ...sxO(c.khoa, "head"), top: CAO_HEADER, height: CAO_HEADER }}
                >
                  {c.nhan}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={COT.length} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : danhSach.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COT.length} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    Không có dòng nào khớp bộ lọc trong tháng này.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {danhSach.map((d, i) => (
                  <TableRow
                    key={d.id}
                    // KHÔNG dùng prop `hover` của MUI: nó tô nền lên `<tr>`, mà mọi ô ở đây đều có
                    // nền đục riêng (sọc + ô dính) nên nền của hàng không hiện ra. Tô thẳng vào `td`.
                    sx={{ "&:hover td": { bgcolor: nen("reChuot") } }}
                  >
                    {COT.map((c) => (
                      <TableCell
                        key={c.khoa}
                        align={c.kieu === "chu" || c.kieu === "stt" ? "left" : "right"}
                        sx={sxO(c.khoa, "body", i % 2 === 1)}
                      >
                        {veO(c, d, i)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  {COT.map((c) => (
                    <TableCell
                      key={c.khoa}
                      align={c.kieu === "chu" || c.kieu === "stt" ? "left" : "right"}
                      sx={{
                        ...sxO(c.khoa, "tong"),
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        // Vạch đậm cắt ngang: dòng tổng phải đọc ra là một khối khác, không phải
                        // "một dòng dữ liệu nữa" nằm lẫn ở cuối bảng.
                        borderTop: "2px solid",
                        borderTopColor: "text.primary",
                      }}
                    >
                      {c.khoa === "stt"
                        ? "TỔNG"
                        : c.khoa === "ma_nv"
                          ? `${danhSach.length} người`
                          : c.kieu === "tien" && c.lay
                            ? tienVn(congCot(c.lay))
                            : ""}
                    </TableCell>
                  ))}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        Cột <b>[4] Không tính thuế</b> và nhóm <b>Quy đổi NET [14]–[16]</b> đang để trống: khoản
        không chịu thuế hiện gộp hết vào <b>[5] Miễn thuế</b>, và phần mềm chưa quy đổi lương NET ra
        GROSS. Ba cột <b>[10] Y tế</b>, <b>[11] Giáo dục</b>, <b>[12] Khác</b> luôn bằng 0 vì chưa
        có chỗ nhập số. Bộ phận, Chức vụ, Số HĐ đọc theo hồ sơ hiện tại — tháng đã chốt vẫn giữ
        nguyên mọi con số tiền của lúc chốt.
      </Typography>

      <XacNhanXoaDialog
        open={hoiChot}
        tieuDe={`Chốt Bảng tính thuế tháng ${bang?.month ?? ""}/${bang?.year ?? ""}`}
        noiDung="Chốt sẽ đóng băng số thuế của tháng: từ lúc này thu nhập ngoài lương của tháng không thêm, sửa hay xóa được nữa, và tờ khai quý sẽ lấy đúng bộ số này. Mở lại được, nhưng mở lại là xóa hẳn số đã chốt."
        nhanXacNhan={chotMut.isPending ? "Đang chốt…" : "Chốt tháng"}
        dangXuLy={chotMut.isPending}
        onClose={() => setHoiChot(false)}
        onXacNhan={() => void chot()}
      />

      {/* Chỉ mount khi mở (RVW-748): dialog sống mãi thì lý do của lần mở lại TRƯỚC còn nguyên
          trong ô, đủ 20 ký tự nên nút bật sẵn — bấm là ghi lý do sai vào nhật ký. */}
      {hoiMoLai && (
        <MoLaiBangTinhThueDialog
          open={hoiMoLai}
          thang={bang?.month ?? thangChon.thang}
          nam={bang?.year ?? thangChon.nam}
          dangChay={moLaiMut.isPending}
          onClose={() => setHoiMoLai(false)}
          onXacNhan={(lyDo) => void moLai(lyDo)}
        />
      )}
    </Box>
  );
}
