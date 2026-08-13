import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { hauToCheDo, tienTheoCheDo } from "../../bangLuong";
import { tienVn } from "../../format";
import type { CheDoHienThi, DongBangLuong } from "../../types";
import { cotTheoMuc, tongTheoCot, type CotBangLuong } from "./cotBangLuong";

interface Props {
  rows: DongBangLuong[];
  cheDo: CheDoHienThi;
  rutGon: boolean;
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
 * Hai cột đầu **dính bên trái**: bảng rộng 18 cột, cuộn ngang tới cột Thuế mà
 * không còn thấy tên ai thì không đối chiếu được.
 *
 * Cột "Thu nhập" có tooltip liệt kê đủ bảy khoản cấu thành — trong đó **Lương %**
 * và **Chuyên cần** không có cột riêng nên nếu không có tooltip thì hai khoản đó
 * biến mất khỏi màn hình dù vẫn nằm trong tổng.
 */
export default function BangLuongTable({ rows, cheDo, rutGon }: Props) {
  const cot = cotTheoMuc(rutGon);
  const tong = tongTheoCot(cot, rows);
  const hauTo = hauToCheDo(cheDo);

  /** Ô số của một cột — cột tiền quy theo chế độ, cột khác giữ nguyên. */
  const oSo = (c: CotBangLuong, so: number) =>
    c.tien ? tienTheoCheDo(so, cheDo) : so.toLocaleString("vi-VN");

  /** Hai cột đầu dính trái; `viTri` là mép trái của cột thứ hai. */
  const dinhTrai = (i: number) =>
    i > 1
      ? undefined
      : ({
          position: "sticky" as const,
          left: i === 0 ? 0 : 200,
          zIndex: 2,
          bgcolor: "background.paper",
        });

  return (
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
                  ...(i <= 1 ? { zIndex: 4 } : undefined),
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
          {rows.map((row) => (
            <TableRow key={row.ma_nv} hover>
              {cot.map((c, i) => {
                const chung = {
                  align: c.align ?? ("right" as const),
                  sx: { whiteSpace: "nowrap", ...dinhTrai(i) },
                };

                if (c.key === "ho_ten") {
                  return (
                    <TableCell key={c.key} {...chung}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.ho_ten}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.ma_nv}
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
                        {so > 0 ? `− ${oSo(c, so)}` : `+ ${oSo(c, -so)}`}
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

          {rows.length === 0 && (
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
                    ...(i <= 1
                      ? {
                          zIndex: 4,
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                        }
                      : undefined),
                  }}
                >
                  {i === 0 ? "Tổng cộng" : c.cong ? oSo(c, tong.get(c.key) ?? 0) : ""}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        )}
      </Table>
    </TableContainer>
  );
}
