import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import { useLuuPhuLuc } from "../api/gtgt01Queries";
import type { PhuLuc204 } from "../api/gtgt01";
import { fmtSoTien } from "../../_shared/to_khai/soTien";
import { nhanKy, type Ky } from "../ky";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Phụ lục "Giảm thuế GTGT theo Nghị quyết 204/2025/QH15" — nộp KÈM tờ khai 01/GTGT khi kỳ có hàng
 * được giảm từ 10% xuống 8%. Tờ khai chính gộp hàng 8% chung dòng [32]/[33] với hàng 10%, nên phần
 * giảm thuế chỉ nhìn thấy được ở đây.
 *
 * Số liệu tính từ hóa đơn và KHÔNG sửa được — muốn đổi thì sửa bảng kê rồi tính lại. Chỉ hai ô mô
 * tả hàng hóa sửa tay được: kế toán biết gọi gọn thế nào cho cơ quan thuế dễ đọc.
 */
export default function PhuLuc204Panel({
  ky,
  phuLuc,
  khoa,
}: {
  ky: Ky;
  phuLuc: PhuLuc204;
  /** Bản đã chốt — khóa luôn hai ô mô tả. */
  khoa: boolean;
}) {
  const [tenMua, setTenMua] = useState<string | null>(null);
  const [tenBan, setTenBan] = useState<string | null>(null);
  const luu = useLuuPhuLuc();

  const daSua = tenMua !== null || tenBan !== null;

  const bamLuu = () =>
    luu.mutate(
      {
        ky,
        ten: {
          ...(tenMua !== null ? { muaVao: tenMua } : {}),
          ...(tenBan !== null ? { banRa: tenBan } : {}),
        },
      },
      {
        onSuccess: () => {
          setTenMua(null);
          setTenBan(null);
          toast.success("Đã lưu mô tả hàng hóa của phụ lục.");
        },
        onError: (err) => toast.error(getErrorMessage(err, "Không lưu được phụ lục.")),
      },
    );

  const oTen = (
    giaTri: string,
    dat: (v: string) => void,
    nhan: string,
  ) => (
    <TextField
      size="small"
      variant="standard"
      fullWidth
      multiline
      maxRows={3}
      disabled={khoa}
      value={giaTri}
      placeholder={nhan}
      onChange={(e) => dat(e.target.value)}
      slotProps={{ input: { style: { fontSize: 13 } } }}
    />
  );

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2">
          Phụ lục: Giảm thuế GTGT theo Nghị quyết 204/2025/QH15
        </Typography>
        <Typography variant="caption" color="text.secondary">
          (nộp kèm tờ khai kỳ {nhanKy(ky)})
        </Typography>
        <Button
          size="small"
          variant="outlined"
          sx={{ ml: "auto", textTransform: "none" }}
          disabled={khoa || !daSua || luu.isPending}
          onClick={bamLuu}
        >
          Lưu mô tả
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          I. Hàng hóa, dịch vụ mua vào trong kỳ được áp dụng thuế suất 8%
        </Typography>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: "55%" }}>Tên hàng hóa, dịch vụ</TableCell>
              <TableCell align="right">Giá trị chưa thuế</TableCell>
              <TableCell align="right">Thuế GTGT được khấu trừ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>
                {oTen(tenMua ?? phuLuc.muaVao.tenHang, setTenMua, "Mô tả hàng mua vào")}
              </TableCell>
              <TableCell align="right">{fmtSoTien(phuLuc.muaVao.giaTri)}</TableCell>
              <TableCell align="right">{fmtSoTien(phuLuc.muaVao.thue)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          II. Hàng hóa, dịch vụ bán ra trong kỳ
        </Typography>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: "45%" }}>Tên hàng hóa, dịch vụ</TableCell>
              <TableCell align="right">Giá trị chưa thuế</TableCell>
              <TableCell align="center">Thuế suất</TableCell>
              <TableCell align="center">Sau giảm</TableCell>
              <TableCell align="right">Thuế được giảm</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>
                {oTen(tenBan ?? phuLuc.banRa.tenHang, setTenBan, "Mô tả hàng bán ra")}
              </TableCell>
              <TableCell align="right">{fmtSoTien(phuLuc.banRa.giaTri)}</TableCell>
              <TableCell align="center">{phuLuc.banRa.thueSuatQuyDinh}%</TableCell>
              <TableCell align="center">{phuLuc.banRa.thueSuatSauGiam}%</TableCell>
              <TableCell align="right">{fmtSoTien(phuLuc.banRa.thueDuocGiam)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Typography variant="body2">
          III. Chênh lệch thuế GTGT của hàng hóa, dịch vụ bán ra và mua vào được áp dụng thuế suất
          8% — [09] = [08] − [06]:{" "}
          <Box component="span" sx={{ fontWeight: 600 }}>
            {fmtSoTien(phuLuc.chenhLech)}
          </Box>{" "}
          đồng
        </Typography>
      </Paper>
    </Box>
  );
}
