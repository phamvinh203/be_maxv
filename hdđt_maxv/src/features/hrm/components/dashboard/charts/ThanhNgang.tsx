import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMauBieuDo } from "./mauBieuDo";

export interface DongThanhNgang {
  khoa: string;
  nhan: string;
  giaTri: number;
  /** Giá trị hiển thị cạnh thanh — luôn có chữ, không bắt người đọc rê chuột mới biết số. */
  nhanGiaTri: string;
  /** Chữ phụ sau giá trị, vd tỷ trọng. */
  phu?: string;
  chiTiet?: ReactNode;
  /** Hạng mục gộp/không xác định ("Khác", "Chưa gán phòng ban") — tô xám, không chiếm màu chuỗi. */
  trungTinh?: boolean;
  /** Biểu tượng đứng sau nhãn, vd cảnh báo vượt ngưỡng. */
  dauHieu?: ReactNode;
}

interface Props {
  rows: DongThanhNgang[];
  /** Mốc 100% của thanh; mặc định là giá trị lớn nhất. */
  max?: number;
}

/**
 * Thanh ngang so sánh độ lớn giữa các hạng mục KHÔNG có thứ tự (phòng ban, nhân viên) — một
 * chuỗi nên chỉ MỘT màu; dài/ngắn đã nói độ lớn, tô đậm-nhạt theo giá trị là mã hóa hai lần.
 * Thanh mảnh 8px, bo 4px ở đầu dữ liệu, vuông ở gốc.
 */
export default function ThanhNgang({ rows, max }: Props) {
  const mau = useMauBieuDo();
  const moc = Math.max(1, max ?? Math.max(0, ...rows.map((r) => r.giaTri)));

  return (
    <Stack spacing={1.25}>
      {rows.map((r) => {
        const dong = (
          <Box
            key={r.khoa}
            tabIndex={r.chiTiet ? 0 : undefined}
            sx={{ borderRadius: 1, outlineOffset: 2, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" } }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                title={r.nhan}
                color={r.trungTinh ? "text.secondary" : "text.primary"}
                sx={{ flex: 1, minWidth: 0 }}
              >
                {r.nhan}
                {r.dauHieu}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
              >
                {r.nhanGiaTri}
              </Typography>
              {r.phu && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                >
                  {r.phu}
                </Typography>
              )}
            </Stack>
            <Box
              sx={{
                mt: 0.5,
                height: 8,
                width: `${Math.max(0, (r.giaTri / moc) * 100)}%`,
                minWidth: r.giaTri > 0 ? 3 : 0,
                bgcolor: r.trungTinh ? mau.trungTinh : mau.chuoi[0],
                borderRadius: "0 4px 4px 0",
              }}
            />
          </Box>
        );

        return r.chiTiet ? (
          <Tooltip key={r.khoa} title={r.chiTiet} placement="top-start" arrow>
            {dong}
          </Tooltip>
        ) : (
          dong
        );
      })}
    </Stack>
  );
}
