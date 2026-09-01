import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { toast } from "react-toastify";
import { HANG_GTGT01, maChiTieu, type HangChiTieu } from "../../_shared/to_khai/gtgt01Layout";
import { useDoiTrangThai, useLuuGhiDe, useTinhToKhai } from "../api/gtgt01Queries";
import type { BanToKhai, GhiDeItem } from "../api/gtgt01";
import { nhanKy, type Ky } from "../ky";
import { xuatToKhaiGtgt01 } from "../xuatToKhaiExcel";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Mẫu in 01/GTGT ở chế độ NHẬP ĐƯỢC — số tính từ bảng kê của kỳ, kế toán sửa tay được từng ô.
 *
 * Bố cục cố ý khác hai tab bảng kê: bảng kê cần tràn ngang (26 cột), mẫu in cần KHỔ HẸP CĂN GIỮA
 * như tờ giấy. Thanh kỳ ở đây cũng chỉ là một dòng chữ, không phải khối chọn kỳ như bên bảng kê —
 * dựng khối đó ngay trên đầu mẫu in làm tờ khai trông như bị kẹp.
 */

/** Bề rộng khổ giấy — mẫu in không tràn theo khung bảng. */
const KHO_GIAY = 860;

/** Ô người dùng tự nhập — khớp `CT_NHAP_TAY` bên `tinhGtgt01.ts`. */
const O_NHAP_TAY = new Set([
  "ct22",
  "ct23a",
  "ct24a",
  "ct25",
  "ct37",
  "ct38",
  "ct39a",
  "ct40b",
  "ct42",
]);

const fmt = new Intl.NumberFormat("vi-VN");

interface Props {
  ky: Ky;
  ban: BanToKhai | null;
  /** Bấm "Đổi kỳ" — cha đưa người dùng về tab bảng kê, nơi có khối chọn kỳ đầy đủ. */
  onDoiKy: () => void;
  dangTai: boolean;
  /** Câu lỗi khi kỳ chưa lập được (chưa kê khai, chưa có bản…). */
  loi?: string | null;
}

export default function ToKhaiGtgt01Editor({ ky, ban, onDoiKy, dangTai, loi }: Props) {
  // Giá trị đang gõ, theo tên thẻ. Chỉ chứa ô người dùng vừa chạm — ô khác đọc thẳng từ `ban.ct`.
  const [nhap, setNhap] = useState<Record<string, string>>({});
  const tinh = useTinhToKhai();
  const luu = useLuuGhiDe();
  const doiTrangThai = useDoiTrangThai();

  const khoa = ban?.trangThai === "chot";
  const dangChay = tinh.isPending || luu.isPending || doiTrangThai.isPending || dangTai;

  const bamTinh = () =>
    tinh.mutate(ky, {
      onSuccess: () => {
        setNhap({});
        toast.success(`Đã lập tờ khai kỳ ${nhanKy(ky)}.`);
      },
      onError: (err) => toast.error(getErrorMessage(err, "Không lập được tờ khai.")),
    });

  const bamLuu = () => {
    if (!ban) return;
    const ghiDe: Record<string, GhiDeItem> = { ...ban.ghiDe };
    for (const [tag, chuoi] of Object.entries(nhap)) {
      // Bỏ dấu phân cách nghìn người dùng gõ vào; chuỗi rỗng nghĩa là xóa ô -> bỏ khỏi ghi đè.
      const sach = chuoi.replace(/[^\d.-]/g, "");
      if (sach === "") {
        delete ghiDe[tag];
        continue;
      }
      const gia = Number(sach);
      if (Number.isFinite(gia)) ghiDe[tag] = { gia };
    }
    luu.mutate(
      { ky, ghiDe },
      {
        onSuccess: () => {
          setNhap({});
          toast.success("Đã lưu tờ khai.");
        },
        onError: (err) => toast.error(getErrorMessage(err, "Không lưu được tờ khai.")),
      },
    );
  };

  /** Xuất file cần `await` (dựng workbook) — bọc catch để lỗi ghi file không văng ra ngoài lặng lẽ. */
  const bamXuatExcel = () => {
    if (!ban) return;
    void xuatToKhaiGtgt01(ky, ban).catch((err) =>
      toast.error(getErrorMessage(err, "Không xuất được file Excel.")),
    );
  };

  const bamDoiTrangThai = () =>
    doiTrangThai.mutate(
      { ky, chot: !khoa },
      {
        onSuccess: () => toast.success(khoa ? "Đã mở khóa tờ khai." : "Đã chốt tờ khai."),
        onError: (err) => toast.error(getErrorMessage(err, "Không đổi được trạng thái.")),
      },
    );

  const oTien = (tag?: string) => {
    if (!tag) return <TableCell />;
    const daGhiDe = !!ban?.ghiDe[tag];
    const soMay = ban?.ctMay[tag];
    const hienTai = tag in nhap ? nhap[tag] : (ban?.ct[tag] ?? "");

    return (
      <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", lineHeight: 1.4 }}
        >
          [{maChiTieu(tag)}]
        </Typography>
        <Tooltip
          title={daGhiDe && soMay !== undefined ? `Máy tính: ${fmt.format(soMay)}` : ""}
          placement="left"
        >
          <TextField
            size="small"
            variant="standard"
            disabled={khoa || !ban}
            value={String(hienTai)}
            onChange={(e) => setNhap((cu) => ({ ...cu, [tag]: e.target.value }))}
            slotProps={{ input: { style: { textAlign: "right", fontSize: 13 } } }}
            sx={{
              width: 120,
              // Ô nhập tay có nền nhạt; ô đã sửa tay gạch chân cam để nhìn ra ngay số nào của người.
              "& .MuiInput-root": {
                bgcolor: O_NHAP_TAY.has(tag) ? "action.hover" : "transparent",
                borderBottom: daGhiDe ? "2px solid" : undefined,
                borderColor: daGhiDe ? "warning.main" : undefined,
              },
            }}
          />
        </Tooltip>
      </TableCell>
    );
  };

  const hang = (h: HangChiTieu, i: number) => (
    <TableRow key={i} hover={!h.header}>
      <TableCell align="center" sx={{ fontWeight: h.header ? 700 : 400, verticalAlign: "top" }}>
        {h.stt}
      </TableCell>
      <TableCell sx={{ fontWeight: h.header ? 700 : 400, pl: 2 + (h.indent ?? 0) * 1.5 }}>
        {h.nhan}
      </TableCell>
      {h.header ? (
        <>
          <TableCell />
          <TableCell />
        </>
      ) : (
        <>
          {oTien(h.giaTri)}
          {oTien(h.thue)}
        </>
      )}
    </TableRow>
  );

  return (
    <Box>
      {/* Thanh kỳ + hành động: một dòng, không phải khối chọn kỳ như bên bảng kê. */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", mb: 2, flexWrap: "wrap", rowGap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          Kỳ {nhanKy(ky)}
        </Typography>
        <Button size="small" onClick={onDoiKy} sx={{ textTransform: "none" }}>
          Đổi kỳ
        </Button>
        {ban && (
          <Chip
            size="small"
            color={khoa ? "success" : "default"}
            label={khoa ? "Đã chốt" : "Bản nháp"}
          />
        )}
        {dangChay && <CircularProgress size={18} />}

        <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
          <Button
            variant="contained"
            size="small"
            onClick={bamTinh}
            disabled={dangChay || khoa}
            sx={{ textTransform: "none" }}
          >
            {ban ? "Tính lại" : "Lập tờ khai"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={bamLuu}
            disabled={dangChay || khoa || !ban || Object.keys(nhap).length === 0}
            sx={{ textTransform: "none" }}
          >
            Lưu nháp
          </Button>
          <Button
            size="small"
            variant="outlined"
            color={khoa ? "warning" : "primary"}
            onClick={bamDoiTrangThai}
            disabled={dangChay || !ban}
            sx={{ textTransform: "none" }}
          >
            {khoa ? "Mở khóa" : "Chốt"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadRounded fontSize="small" />}
            onClick={bamXuatExcel}
            disabled={!ban}
            sx={{ textTransform: "none" }}
          >
            Xuất Excel
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ maxWidth: KHO_GIAY, mx: "auto" }}>
        {loi && !ban && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {loi}
          </Alert>
        )}

        {ban && (
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {ban.hdThieuDetail > 0 && (
              <Alert severity="error">
                {ban.hdThieuDetail} hóa đơn bán ra chưa tải chi tiết nên chưa tách được thuế suất —
                số [29]/[30]/[32] đang thiếu. Sang màn Hóa đơn điện tử bấm “Cập nhật từ Thuế điện
                tử” cho kỳ này rồi kê khai lại.
              </Alert>
            )}
            {ban.dieuChinh.soHd > 0 && (
              <Alert severity="warning">
                Kỳ này có {ban.dieuChinh.soHd} hóa đơn điều chỉnh, tổng{" "}
                {fmt.format(ban.dieuChinh.giaTri)} — kiểm tra dấu trước khi chốt.
              </Alert>
            )}
            {ban.soHdKhongKeKhai > 0 && (
              <Alert severity="info">
                {ban.soHdKhongKeKhai} hóa đơn trong kỳ được đánh “Không kê khai” nên không tính vào
                tờ khai này.
              </Alert>
            )}
            {ban.nguonCt22 === "nhap_tay" && (
              <Alert severity="info">
                Chỉ tiêu [22] chưa nối được từ kỳ trước (kỳ trước chưa chốt trong phần mềm) — nhập
                tay rồi bấm “Lưu nháp”.
              </Alert>
            )}
          </Stack>
        )}

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
            <Typography sx={{ fontWeight: 700 }}>Độc lập - Tự do - Hạnh phúc</Typography>
            <Typography sx={{ my: 1.5, fontWeight: 700 }}>
              TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: "italic" }}>
              Kỳ tính thuế: {nhanKy(ky)}
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ textAlign: "right", fontStyle: "italic", mb: 1 }}>
            Đơn vị tiền: đồng Việt Nam
          </Typography>

          <TableContainer sx={{ border: 1, borderColor: "divider" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 40 }}>
                    STT
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Chỉ tiêu</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 160 }}>
                    Giá trị hàng hóa, dịch vụ
                    <br />
                    (chưa có thuế GTGT)
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 160 }}>
                    Thuế giá trị
                    <br />
                    gia tăng
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{HANG_GTGT01.map(hang)}</TableBody>
            </Table>
          </TableContainer>

          {ban && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              Nguồn: {ban.soHdBan} hóa đơn bán ra, {ban.soHdMua} hóa đơn mua vào
              {ban.tinhLuc ? ` · tính lúc ${new Date(ban.tinhLuc).toLocaleString("vi-VN")}` : ""}
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
