import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { alpha } from "@mui/material/styles";
import { hauToCheDo, tienTheoCheDo } from "../../calculations/bang_luong/bangLuong";
import { tienVn } from "../../_shared/format";
import type { CheDoHienThi, DongBangLuong } from "../../types";
import { cotTheoMuc, tongTheoCot, type CotBangLuong } from "./cotBangLuong";

/** "Các khoản bù trừ" dương (gốc) = trừ, âm = cộng lại — cùng quy ước ở dòng, Tổng cộng
 * và file Excel (RVW-A02, cột đánh dấu `dauNguoc` trong `cotBangLuong.ts`). */
function hienThiBuTru(so: number, oSo: (so: number) => string): string {
  if (so > 0) return `− ${oSo(so)}`;
  if (so < 0) return `+ ${oSo(-so)}`;
  return oSo(0);
}

interface Props {
  rows: DongBangLuong[];
  cheDo: CheDoHienThi;
  rutGon: boolean;
  /** Đang tải lần đầu/tải lại từ máy chủ — hiện spinner thay vì "Không có nhân viên". */
  isLoading?: boolean;
}

/** Nội dung chi tiết của "Thu nhập" — hai khoản không có cột riêng nằm ở đây. */
function chiTietThuNhap(row: DongBangLuong): string {
  const phan: string[] = [
    `Lương theo ngày ${tienVn(row.luong_theo_ngay)}`,
    `Tăng ca ${tienVn(row.tien_tang_ca)}`,
    `Sản phẩm ${tienVn(row.luong_san_pham)}`,
    `Thưởng ${tienVn(row.thuong)}`,
    `KPI ${tienVn(row.kpi)}`,
    `Lương % ${tienVn(row.luong_phan_tram)}`,
    `Chuyên cần ${tienVn(row.chuyen_can)}`,
  ];
  return phan.join(" · ");
}

/**
 * Bảng lương của kỳ.
 *
 * Hai cột đầu (Mã NV, Họ và tên) **dính bên trái**: bảng rộng 19 cột, cuộn ngang
 * tới cột Thuế mà không còn thấy đang xem của ai thì không đối chiếu được.
 *
 * Cột "Thu nhập" có tooltip liệt kê đủ bảy khoản cấu thành — trong đó **Lương %**
 * và **Chuyên cần** không có cột riêng nên nếu không có tooltip thì hai khoản đó
 * biến mất khỏi màn hình dù vẫn nằm trong tổng.
 */
export default function BangLuongTable({ rows, cheDo, rutGon, isLoading }: Props) {
  const cot = useMemo(() => cotTheoMuc(rutGon), [rutGon]);
  const tong = useMemo(() => tongTheoCot(cot, rows), [cot, rows]);
  const hauTo = hauToCheDo(cheDo);

  // Phân trang client — tổng và dòng "Tổng cộng" vẫn tính trên TOÀN BỘ `rows`, chỉ phần
  // hiển thị từng dòng mới cắt theo trang (RVW-A06: bảng vài trăm-nghìn dòng không phân
  // trang sẽ giật khi cuộn/lọc).
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lọc/kỳ đổi làm danh sách ngắn lại, trang cũ có thể vượt quá
    if (page > 0 && page * rowsPerPage >= rows.length) setPage(0);
  }, [rows.length, rowsPerPage, page]);
  const rowsTrang = useMemo(
    () => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [rows, page, rowsPerPage],
  );

  /** Ô số của một cột — cột tiền quy theo chế độ, cột khác giữ nguyên. */
  const oSo = (c: CotBangLuong, so: number) =>
    c.tien ? tienTheoCheDo(so, cheDo) : so.toLocaleString("vi-VN");

  /** Cột dính trái theo `stickyWidth` khai ở `cotBangLuong.ts`: mép trái = tổng bề rộng
   * các cột dính trước nó, bề rộng chính cột bị chặn trần (ellipsis) nên không bao giờ
   * lấn sang cột kế — bỏ số `left` hardcode cũ hay bị tên dài đè lên (RVW-A15). */
  const dinhTrai = (i: number) => {
    const c = cot[i];
    if (!c?.stickyWidth) return undefined;
    const left = cot.slice(0, i).reduce((cong, cc) => cong + (cc.stickyWidth ?? 0), 0);
    return {
      position: "sticky" as const,
      left,
      zIndex: 2,
      bgcolor: "background.paper",
      maxWidth: c.stickyWidth,
      overflow: "hidden",
      textOverflow: "ellipsis",
    };
  };

  return (
    <Stack spacing={0}>
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "62vh" }}>
      <Table size="small" stickyHeader sx={{ width: "max-content", minWidth: "100%" }}>
        <TableHead>
          <TableRow>
            {cot.map((c, i) => (
              <TableCell
                key={c.key}
                align={c.align ?? "right"}
                sx={{
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  minWidth: c.minWidth,
                  ...dinhTrai(i),
                  ...(c.stickyWidth ? { zIndex: 4 } : undefined),
                }}
              >
                {c.header}
                {c.tien && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 0.5, fontWeight: 400 }}
                  >
                    ({hauTo})
                  </Typography>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={cot.length}>
                <Stack sx={{ alignItems: "center", py: 4 }}>
                  <CircularProgress size={24} />
                </Stack>
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            rowsTrang.map((row) => (
              <TableRow key={row.ma_nv} hover>
                {cot.map((c, i) => {
                  const chung = {
                    align: c.align ?? ("right" as const),
                    sx: { whiteSpace: "nowrap", ...dinhTrai(i) },
                  };

                  if (c.key === "ma_nv") {
                    return (
                      <TableCell key={c.key} {...chung}>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                          {row.ma_nv}
                        </Typography>
                      </TableCell>
                    );
                  }

                  if (c.key === "ho_ten") {
                    return (
                      <TableCell key={c.key} {...chung}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.ho_ten}
                        </Typography>
                      </TableCell>
                    );
                  }

                  if (c.key === "bo_phan") {
                    return (
                      <TableCell key={c.key} {...chung}>
                        <Typography variant="body2">
                          {row.ten_pb || "Chưa gán phòng ban"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.ten_cv || "—"}
                        </Typography>
                      </TableCell>
                    );
                  }

                  const so = c.value(row);

                  if (c.key === "thu_nhap") {
                    return (
                      <TableCell key={c.key} {...chung}>
                        <Tooltip title={chiTietThuNhap(row)}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, cursor: "help", display: "inline" }}
                          >
                            {oSo(c, so)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    );
                  }

                  if (c.key === "thuc_linh") {
                    return (
                      <TableCell key={c.key} {...chung}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700 }}
                          // Thực lĩnh âm = tạm ứng vượt lương kỳ này, còn nợ lại.
                          color={so < 0 ? "error.main" : "success.main"}
                        >
                          {oSo(c, so)}
                        </Typography>
                      </TableCell>
                    );
                  }

                  if (c.key === "bu_tru" && so !== 0) {
                    return (
                      <TableCell key={c.key} {...chung}>
                        <Typography
                          variant="body2"
                          color={so > 0 ? "error.main" : "success.main"}
                        >
                          {hienThiBuTru(so, (v) => oSo(c, v))}
                        </Typography>
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell key={c.key} {...chung}>
                      {so === 0 ? (
                        <Box component="span" sx={{ color: "text.disabled" }}>
                          0
                        </Box>
                      ) : (
                        oSo(c, so)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={cot.length}>
                <Typography
                  variant="body2"
                  color="text.disabled"
                  sx={{ textAlign: "center", py: 4 }}
                >
                  Không có nhân viên nào khớp bộ lọc.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>

        {rows.length > 0 && (
          <TableBody>
            <TableRow
              sx={{
                // Dòng tổng dính đáy để cuộn giữa mấy chục dòng vẫn thấy số tổng.
                position: "sticky",
                bottom: 0,
                zIndex: 3,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                "& td": { fontWeight: 700, borderTop: 1, borderColor: "divider" },
              }}
            >
              {cot.map((c, i) => (
                <TableCell
                  key={c.key}
                  align={c.align ?? "right"}
                  sx={{
                    whiteSpace: "nowrap",
                    ...dinhTrai(i),
                    ...(c.stickyWidth
                      ? {
                          zIndex: 4,
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                        }
                      : undefined),
                  }}
                >
                  {i === 0
                    ? "Tổng cộng"
                    : !c.cong
                      ? ""
                      : c.key === "bu_tru"
                        ? hienThiBuTru(tong.get(c.key) ?? 0, (v) => oSo(c, v))
                        : oSo(c, tong.get(c.key) ?? 0)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        )}
      </Table>
    </TableContainer>
    {rows.length > 0 && (
      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        onPageChange={(_, trangMoi) => setPage(trangMoi)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(Number(e.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="Số dòng/trang"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
      />
    )}
    </Stack>
  );
}
