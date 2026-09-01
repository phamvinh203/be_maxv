import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useDanhSachKyQuery } from "../api/gtgt01Queries";
import { nhanKy, type Ky } from "../ky";

/**
 * Các kỳ đã lập tờ khai. Ngoài việc mở nhanh kỳ cũ, bảng này trả lời một câu hỏi nghiệp vụ thật:
 * kỳ trước ĐÃ CHỐT chưa — vì chỉ bản đã chốt mới nối được [43] sang [22] của kỳ sau.
 */

const fmt = new Intl.NumberFormat("vi-VN");

export default function DanhSachKyDaLap({
  kyDangXem,
  onChonKy,
}: {
  kyDangXem: Ky;
  onChonKy: (ky: Ky) => void;
}) {
  const ds = useDanhSachKyQuery();
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
                  <TableCell align="right">{fmt.format(r.ct40)}</TableCell>
                  <TableCell align="right">{fmt.format(r.ct43)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
