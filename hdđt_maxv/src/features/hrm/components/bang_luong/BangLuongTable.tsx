import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { GridColDef } from "@mui/x-data-grid";
import { hauToCheDo, tienTheoCheDo } from "../../calculations/bang_luong/bangLuong";
import type { CheDoHienThi, DongBangLuong } from "../../types";
import { cotTheoMuc, tongTheoCot, type CotBangLuong } from "./cotBangLuong";
import HrmDataTable from "../../_shared/components/HrmDataTable";

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
  /** Đang tải lần đầu/tải lại từ máy chủ — hiện spinner thay vì bảng. */
  isLoading?: boolean;
  /** Lỗi tải dữ liệu — có giá trị thì hiện lỗi thay bảng. */
  error?: string | null;
}

/**
 * Bảng lương của kỳ — dùng `HrmDataTable` (bọc `@mui/x-data-grid` Community).
 *
 * Hai cột đầu (Mã NV, Họ và tên) dính trái qua tính năng pinning của DataGrid.
 * Đủ 21 cột đều là cột thật (không còn khoản nào chỉ xem được qua tooltip) —
 * cột nào không cần trong "Rút gọn" thì ẩn qua `cotTheoMuc`, người dùng vẫn tự
 * bật lại qua nút chọn cột của DataGrid nếu muốn xem thêm ở chế độ Rút gọn.
 */
export default function BangLuongTable({ rows, cheDo, rutGon, isLoading, error }: Props) {
  const cot = useMemo(() => cotTheoMuc(rutGon), [rutGon]);
  const tong = useMemo(() => tongTheoCot(cot, rows), [cot, rows]);
  const hauTo = hauToCheDo(cheDo);

  /** Ô số của một cột — cột tiền quy theo chế độ, cột khác giữ nguyên. */
  const oSo = useCallback(
    (c: CotBangLuong, so: number) => (c.tien ? tienTheoCheDo(so, cheDo) : so.toLocaleString("vi-VN")),
    [cheDo],
  );

  const columns = useMemo<GridColDef<DongBangLuong>[]>(
    () =>
      cot.map((c): GridColDef<DongBangLuong> => {
        const base: GridColDef<DongBangLuong> = {
          field: c.key,
          headerName: c.tien ? `${c.header} (${hauTo})` : c.header,
          minWidth: c.minWidth,
          align: c.align ?? "right",
          headerAlign: c.align ?? "right",
          sortable: true,
        };

        if (c.key === "ma_nv") {
          return {
            ...base,
            valueGetter: (_value, row) => row.ma_nv,
            renderCell: (params) => (
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {params.row.ma_nv}
              </Typography>
            ),
          };
        }

        if (c.key === "ho_ten") {
          return {
            ...base,
            valueGetter: (_value, row) => row.ho_ten,
            renderCell: (params) => (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {params.row.ho_ten}
              </Typography>
            ),
          };
        }

        if (c.key === "bo_phan") {
          return {
            ...base,
            sortable: false,
            valueGetter: (_value, row) => [row.ten_pb, row.ten_cv].filter(Boolean).join(" / "),
            renderCell: (params) => (
              <Stack sx={{ justifyContent: "center", height: "100%" }}>
                <Typography variant="body2">{params.row.ten_pb || "Chưa gán phòng ban"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {params.row.ten_cv || "—"}
                </Typography>
              </Stack>
            ),
          };
        }

        if (c.key === "thuc_linh") {
          return {
            ...base,
            type: "number",
            valueGetter: (_value, row) => c.value(row),
            renderCell: (params) => {
              const so = c.value(params.row);
              return (
                // Thực lĩnh âm = tạm ứng vượt lương kỳ này, còn nợ lại.
                <Typography variant="body2" sx={{ fontWeight: 700 }} color={so < 0 ? "error.main" : "success.main"}>
                  {oSo(c, so)}
                </Typography>
              );
            },
          };
        }

        if (c.key === "bu_tru") {
          return {
            ...base,
            type: "number",
            valueGetter: (_value, row) => c.value(row),
            renderCell: (params) => {
              const so = c.value(params.row);
              if (so === 0) {
                return <Box component="span" sx={{ color: "text.disabled" }}>0</Box>;
              }
              return (
                <Typography variant="body2" color={so > 0 ? "error.main" : "success.main"}>
                  {hienThiBuTru(so, (v) => oSo(c, v))}
                </Typography>
              );
            },
          };
        }

        return {
          ...base,
          type: "number",
          valueGetter: (_value, row) => c.value(row),
          renderCell: (params) => {
            const so = c.value(params.row);
            if (so === 0) {
              return <Box component="span" sx={{ color: "text.disabled" }}>0</Box>;
            }
            return oSo(c, so);
          },
        };
      }),
    [cot, hauTo, oSo],
  );

  const tongCong = (
    <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        Tổng cộng:
      </Typography>
      {cot
        .filter((c) => c.cong)
        .map((c) => (
          <Typography key={c.key} variant="caption" color="text.secondary">
            {c.header}:{" "}
            <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
              {c.key === "bu_tru"
                ? hienThiBuTru(tong.get(c.key) ?? 0, (v) => oSo(c, v))
                : oSo(c, tong.get(c.key) ?? 0)}
            </Typography>
          </Typography>
        ))}
    </Stack>
  );

  return (
    <HrmDataTable<DongBangLuong>
      rows={rows}
      columns={columns}
      getRowId={(row) => row.ma_nv}
      loading={isLoading && rows.length === 0}
      error={error ?? null}
      empty={!isLoading && rows.length === 0}
      emptyMessage="Không có nhân viên nào khớp bộ lọc."
      pinnedLeftColumns={["ma_nv", "ho_ten"]}
      footer={rows.length > 0 ? tongCong : undefined}
    />
  );
}
