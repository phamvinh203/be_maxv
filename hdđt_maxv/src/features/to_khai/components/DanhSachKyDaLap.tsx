import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useDanhSachKyQuery } from "../api/gtgt01Queries";
import { nhanKy, type Ky } from "../ky";
import { fmtSoTien } from "../../_shared/to_khai/soTien";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Các kỳ đã lập tờ khai. Ngoài việc mở nhanh kỳ cũ, bảng này trả lời một câu hỏi nghiệp vụ thật:
 * kỳ trước ĐÃ CHỐT chưa — vì chỉ bản đã chốt mới nối được [43] sang [22] của kỳ sau.
 */


export default function DanhSachKyDaLap({
  kyDangXem,
  onChonKy,
}: {
  kyDangXem: Ky;
  onChonKy: (ky: Ky) => void;
}) {
  const ds = useDanhSachKyQuery();
  // Lỗi (mất mạng, 500...) phải HIỆN RA — trước đây rơi chung nhánh "rỗng" bên dưới, 500 trông y
  // hệt "chưa lập kỳ nào" trong khi đây đúng là câu hỏi nghiệp vụ bảng này sinh ra để trả lời (kỳ
  // trước đã chốt chưa). `isPending` (đang tải lần đầu) vẫn im lặng như cũ — không đáng một spinner
  // riêng cho một bảng phụ dưới cùng màn.
  if (ds.isError) {
    return (
      <Box sx={{ mt: 3 }}>
        <Alert severity="error">
          {getErrorMessage(ds.error, "Không tải được danh sách các kỳ đã lập.")}
        </Alert>
      </Box>
    );
  }
  if (!ds.data || ds.data.length === 0) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Các kỳ đã lập
      </Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kỳ</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">[40] Phải nộp</TableCell>
              <TableCell align="right">[43] Chuyển kỳ sau</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ds.data.map((r) => {
              const ky: Ky = { nam: r.nam, kyLoai: r.kyLoai, kySo: r.kySo };
              const dangXem =
                r.nam === kyDangXem.nam &&
                r.kyLoai === kyDangXem.kyLoai &&
                r.kySo === kyDangXem.kySo;
              return (
                <TableRow
                  key={`${r.nam}-${r.kyLoai}-${r.kySo}`}
                  hover
                  selected={dangXem}
                  sx={{ cursor: "pointer" }}
                  onClick={() => onChonKy(ky)}
                >
                  <TableCell>{nhanKy(ky)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={r.trangThai === "chot" ? "success" : "default"}
                      label={r.trangThai === "chot" ? "Đã chốt" : "Nháp"}
                    />
                  </TableCell>
                  <TableCell align="right">{fmtSoTien(r.ct40)}</TableCell>
                  <TableCell align="right">{fmtSoTien(r.ct43)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
