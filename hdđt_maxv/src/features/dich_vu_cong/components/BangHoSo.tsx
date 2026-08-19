import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { CotBang } from "../config";

interface Props {
  /** Cột khai sẵn trong `config.ts` — dùng làm khung khi CHƯA có kết quả. */
  cot: CotBang[];
  /**
   * Tiêu đề cột do cổng trả về. Có giá trị thì bảng hiện theo bộ này thay cho `cot`:
   * cổng thêm/bớt cột thì bảng đi theo, không bị đổ lệch dữ liệu sang nhầm ô.
   */
  headers?: string[];
  /** Dòng kết quả theo THỨ TỰ CỘT của `headers`. */
  rows?: string[][];
}

/**
 * Bảng kết quả tra cứu hồ sơ đã nộp.
 *
 * Mười mấy cột thì không cách nào vừa màn hình nên bảng tự cuộn ngang trong
 * khung của nó, tiêu đề không xuống dòng và dính lại khi cuộn dọc — cuộn tới
 * dòng thứ ba mươi mà mất tiêu đề thì không biết cột nào là cột nào.
 */
export default function BangHoSo({ cot, headers, rows = [] }: Props) {
  // Có kết quả thì tin bộ cột của cổng; chưa có thì dựng khung theo cột khai sẵn.
  const tieuDe = headers?.length ? headers : cot.map((c) => c.header);
  const canLe = (i: number) => (headers?.length ? undefined : cot[i]?.align);

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {tieuDe.map((header, i) => (
              <TableCell
                key={header || i}
                align={canLe(i)}
                sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
              >
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={tieuDe.length} align="center" sx={{ py: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Chưa có dữ liệu. Nhập điều kiện rồi nhấn “Tìm kiếm”.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={i} hover>
                {tieuDe.map((_h, j) => (
                  <TableCell key={j} align={canLe(j)} sx={{ whiteSpace: "nowrap" }}>
                    {row[j] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
