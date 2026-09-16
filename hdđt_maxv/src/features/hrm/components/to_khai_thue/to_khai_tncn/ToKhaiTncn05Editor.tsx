import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import EditRounded from "@mui/icons-material/EditRounded";
import { alpha } from "@mui/material/styles";
import { tienVn } from "../../../_shared/format";
import type { CtTagTncn05, ToKhaiTncn05Dto } from "../../../types/toKhaiThue";
import { HANG_TNCN05, type HangChiTieuTncn05 } from "./tncn05Layout";
import ToKhaiOverrideDialog from "./ToKhaiOverrideDialog";

interface Props {
  toKhai: ToKhaiTncn05Dto;
  onUpdateGhiDe: (tag: CtTagTncn05, gia: number, lyDo: string) => Promise<void>;
  onResetGhiDe: (tag: CtTagTncn05) => Promise<void>;
  isLocked?: boolean;
}

export default function ToKhaiTncn05Editor({
  toKhai,
  onUpdateGhiDe,
  onResetGhiDe,
  isLocked = false,
}: Props) {
  const [selectedHang, setSelectedHang] = useState<HangChiTieuTncn05 | null>(null);

  const ct = toKhai.ct;
  const ctMay = toKhai.ctMay;
  const ghiDe = toKhai.ghiDe;
  const canhBao = toKhai.canhBao;
  // Danh sách chỉ tiêu sửa được LẤY TỪ MÁY CHỦ (hợp đồng Mục 5.1): chép cứng ở giao diện thì hôm
  // mẫu tờ khai đổi, màn này vẫn mời kế toán sửa ô mà máy chủ đã từ chối.
  const suaDuoc = toKhai.ctGocSuaDuoc;

  // Chưa có bộ chỉ tiêu thì nói thẳng (RVW-750). Để `?? 0` nói hộ là vẽ ra một tờ khai đầy đủ với
  // mọi chỉ tiêu bằng 0, không phân biệt được với quý thật sự không phát sinh.
  if (!ct) {
    return (
      <Alert severity="warning">
        Quý này chưa có bộ chỉ tiêu — chốt đủ ba tháng Bảng tính thuế rồi xem lại.
      </Alert>
    );
  }

  const handleRowClick = (hang: HangChiTieuTncn05) => {
    if (isLocked || !suaDuoc.includes(hang.tag)) return;
    setSelectedHang(hang);
  };

  return (
    <Box>
      {/* Cảnh báo tính cân đối nếu có */}
      {canhBao.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Cảnh báo rà soát tính cân đối chỉ tiêu:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {canhBao.map((cb: string) => (
              <li key={cb}>
                <Typography variant="caption">{cb}</Typography>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Tờ khai giấy mẫu chuẩn eTax */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 4 },
          bgcolor: "background.paper",
          maxWidth: 960,
          mx: "auto",
        }}
      >
        {/* Quốc hiệu tiêu ngữ */}
        <Stack spacing={0.5} sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Độc lập - Tự do - Hạnh phúc
          </Typography>
          <Box sx={{ width: 120, height: 1, bgcolor: "divider", mx: "auto", my: 0.5 }} />
        </Stack>

        {/* Tiêu đề tờ khai */}
        <Stack spacing={0.5} sx={{ textAlign: "center", mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, textTransform: "uppercase" }}>
            TỜ KHAI THUẾ THU NHẬP CÁ NHÂN
          </Typography>
          <Typography variant="body2" color="text.secondary">
            (Áp dụng cho tổ chức, cá nhân trả thu nhập khấu trừ thuế đối với thu nhập từ tiền lương, tiền công)
          </Typography>
          <Typography variant="caption" sx={{ fontStyle: "italic", color: "text.secondary" }}>
            [Mẫu số 05/KK-TNCN — bản in chính thức lấy ở nút "Xuất tờ khai"]
          </Typography>
        </Stack>

        {/* Kỳ tính thuế */}
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Kỳ tính thuế:{" "}
            Quý {toKhai.quy} năm {toKhai.nam}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Doanh nghiệp khai theo QUÝ — mẫu này không còn dùng cho kỳ tháng.
          </Typography>
        </Box>

        {/* Bảng 17 chỉ tiêu */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.06) }}>
              <TableRow>
                <TableCell align="center" sx={{ width: 50, fontWeight: 700 }}>
                  STT
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Chỉ tiêu</TableCell>
                <TableCell align="center" sx={{ width: 90, fontWeight: 700 }}>
                  Mã số
                </TableCell>
                <TableCell align="center" sx={{ width: 90, fontWeight: 700 }}>
                  ĐVT
                </TableCell>
                <TableCell align="right" sx={{ width: 170, fontWeight: 700 }}>
                  Số người / Số tiền
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {HANG_TNCN05.map((hang) => {
                const tag = hang.tag;
                const maChiTieu = `[${tag.replace("ct", "")}]`;
                const giaTri = ct?.[tag] ?? 0;
                const daGhiDe = Boolean(ghiDe[tag]);
                const coTheSua = suaDuoc.includes(tag);

                return (
                  <TableRow
                    key={tag}
                    hover={coTheSua && !isLocked}
                    onClick={() => handleRowClick(hang)}
                    sx={{
                      cursor: coTheSua && !isLocked ? "pointer" : "default",
                      bgcolor: hang.dam ? (t) => alpha(t.palette.action.hover, 0.5) : "inherit",
                    }}
                  >
                    <TableCell align="center" sx={{ fontWeight: hang.dam ? 700 : 400 }}>
                      {hang.stt}
                    </TableCell>

                    <TableCell sx={{ fontWeight: hang.dam ? 700 : 400 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <span>{hang.nhan}</span>
                        {daGhiDe && (
                          <Tooltip
                            title={
                              <Box sx={{ p: 0.5 }}>
                                <div>Số máy tính: {tienVn(ctMay?.[tag] ?? 0)} {hang.donVi}</div>
                                <div>Lý do: {ghiDe[tag]?.lyDo}</div>
                              </Box>
                            }
                          >
                            <Chip
                              label="Sửa tay"
                              size="small"
                              color="warning"
                              variant="filled"
                              sx={{ height: 20, fontSize: "0.7rem" }}
                            />
                          </Tooltip>
                        )}
                        {coTheSua && !isLocked && !daGhiDe && (
                          <EditRounded
                            sx={{ fontSize: 14, color: "text.disabled", opacity: 0.5 }}
                          />
                        )}
                      </Stack>
                    </TableCell>

                    <TableCell align="center" sx={{ fontWeight: 700, color: "text.secondary" }}>
                      {maChiTieu}
                    </TableCell>

                    <TableCell align="center" sx={{ color: "text.secondary" }}>
                      {hang.donVi}
                    </TableCell>

                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: hang.dam || daGhiDe ? 700 : 500,
                        color: daGhiDe ? "warning.dark" : "text.primary",
                      }}
                    >
                      {tienVn(giaTri)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Ghi chú văn bản pháp lý */}
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px dashed", borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            • Tờ khai này chỉ áp dụng đối với tổ chức, cá nhân phát sinh trả thu nhập từ tiền lương, tiền công.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            • Đối với cá nhân cư trú có HĐLĐ từ 3 tháng trở lên: các khoản thu nhập ngoài lương được gộp vào biểu lũy tiến theo quy định.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            • Bấm trực tiếp vào các dòng chỉ tiêu để xem số máy tính hoặc điều chỉnh số liệu kèm lý do giải trình.
          </Typography>
        </Box>

        {/* Chữ ký người nộp thuế */}
        <Stack
          direction="row"
          sx={{ mt: 5, px: 2, justifyContent: "space-between" }}
        >
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              NGƯỜI LẬP BIỂU
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (Ký, ghi rõ họ tên)
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
              NGƯỜI NỘP THUẾ hoặc ĐẠI DIỆN HỢP PHÁP
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (Ký, ghi rõ họ tên và đóng dấu)
            </Typography>
            {toKhai.nguoiKy && (
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 4 }}>
                {toKhai.nguoiKy}
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Dialog Ghi đè chỉ tiêu */}
      {selectedHang && (
        <ToKhaiOverrideDialog
          open={Boolean(selectedHang)}
          onClose={() => setSelectedHang(null)}
          tag={selectedHang.tag}
          tenChiTieu={selectedHang.nhan}
          donVi={selectedHang.donVi}
          giaTriMay={ctMay?.[selectedHang.tag] ?? 0}
          ghiDeHienTai={ghiDe[selectedHang.tag]}
          onSave={async (gia, lyDo) => {
            await onUpdateGhiDe(selectedHang.tag, gia, lyDo);
          }}
          onReset={async () => {
            await onResetGhiDe(selectedHang.tag);
          }}
          isLocked={isLocked}
        />
      )}
    </Box>
  );
}
