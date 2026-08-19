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
  /** Cột khai sẵn trong `config.ts` — luôn dùng bộ này làm tiêu đề bảng. */
  cot: CotBang[];
  /**
   * Tiêu đề cổng trả về — CHỈ dùng để khớp đúng ô dữ liệu vào cột của `cot` theo
   * TÊN, không dùng để hiển thị. Cổng có thể không có đủ mọi cột trong `cot`
   * (ví dụ chưa có cột STT/nút bấm), khớp theo vị trí như dữ liệu thô sẽ đổ
   * nhầm cột — ví dụ "Mã giao dịch" bị lệch sang ô "Tên thủ tục hành chính".
   */
  headers?: string[];
  /** Dòng kết quả, thứ tự cột khớp với `headers`. */
  rows?: string[][];
}

function chuanHoaTieuDe(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Bảng kết quả tra cứu hồ sơ đã nộp.
 *
 * Mười mấy cột thì không cách nào vừa màn hình nên bảng tự cuộn ngang trong
 * khung của nó, tiêu đề không xuống dòng và dính lại khi cuộn dọc — cuộn tới
 * dòng thứ ba mươi mà mất tiêu đề thì không biết cột nào là cột nào.
 *
 * Tiêu đề hiển thị luôn lấy từ `cot` (COT_TO_KHAI/COT_GIAY_NOP_TIEN trong
 * config.ts), không dùng câu chữ tiêu đề của cổng — nhưng dữ liệu từng ô vẫn
 * phải tìm đúng cột nguồn qua `headers` (tên), vì `cot` có thêm cột STT và các
 * cột nút bấm mà cổng không có, nên không thể giả định cùng vị trí.
 */
export default function BangHoSo({ cot, headers = [], rows = [] }: Props) {
  const tieuDe = cot.map((c) => c.header);
  const canLe = (i: number) => cot[i]?.align;

  const viTriNguon = cot.map((c) =>
    headers.findIndex((h) => chuanHoaTieuDe(h) === chuanHoaTieuDe(c.srcHeader ?? c.header)),
  );

  // Cột `stt` không đọc từ dữ liệu cổng — tự đánh số theo dòng.
  const layO = (row: string[], cotIdx: number, dongThu: number): string => {
    if (cot[cotIdx]?.key === "stt") return String(dongThu + 1);
    const nguon = viTriNguon[cotIdx];
    return nguon >= 0 ? (row[nguon] ?? "") : "";
  };

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
                    {layO(row, j, i)}
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
