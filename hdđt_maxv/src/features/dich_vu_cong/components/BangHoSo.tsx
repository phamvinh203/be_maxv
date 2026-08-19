import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { CotBang } from "../config";

/** Một dòng kết quả. Kiểu còn lỏng vì chưa chốt được response của API `gdt-dvc`. */
export type DongBang = Record<string, string>;

interface Props {
  cot: CotBang[];
  /** Chưa nối API nên mặc định rỗng — bảng hiện dòng "chưa có dữ liệu". */
  rows?: DongBang[];
}

/**
 * Bảng kết quả tra cứu hồ sơ đã nộp.
 *
 * Mười mấy cột thì không cách nào vừa màn hình nên bảng tự cuộn ngang trong
 * khung của nó, tiêu đề không xuống dòng và dính lại khi cuộn dọc — cuộn tới
 * dòng thứ ba mươi mà mất tiêu đề thì không biết cột nào là cột nào.
 */
export default function BangHoSo({ cot, rows = [] }: Props) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {cot.map((c) => (
              <TableCell
                key={c.key}
                align={c.align}
                sx={{ fontWeight: 700, whiteSpace: "nowrap", width: c.width }}
              >
                {c.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={cot.length} align="center" sx={{ py: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Chưa có dữ liệu. Nhập điều kiện rồi nhấn “Tìm kiếm”.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={row.maGiaoDich ?? i} hover>
                {cot.map((c) => (
                  <TableCell
                    key={c.key}
                    align={c.align}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {c.key === "stt" ? i + 1 : (row[c.key] ?? "")}
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
