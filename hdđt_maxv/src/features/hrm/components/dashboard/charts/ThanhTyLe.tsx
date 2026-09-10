import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { phanTram } from "../dinhDang";

export interface PhanTyLe {
  khoa: string;
  nhan: string;
  so: number;
  mau: string;
}

interface Props {
  tieuDe: string;
  phan: PhanTyLe[];
  donVi?: string;
}

/**
 * Thanh 100% chồng — cơ cấu một tổng thể (part-to-whole) cho vài hạng mục.
 *
 * Khe 2px giữa các mảng là NỀN lộ ra (`gap`), không phải viền vẽ quanh mảng. Chú giải luôn hiện
 * kèm số + tỷ lệ bằng chữ: danh tính không bao giờ chỉ dựa vào màu, và ô màu có độ tương phản
 * thấp trên nền sáng (aqua) vẫn đọc được nhờ nhãn.
 */
export default function ThanhTyLe({ tieuDe, phan, donVi = "người" }: Props) {
  const tong = phan.reduce((s, p) => s + p.so, 0);
  const coSo = phan.filter((p) => p.so > 0);

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {tieuDe}
      </Typography>

      <Box
        role="img"
        aria-label={`${tieuDe}: ${phan.map((p) => `${p.nhan} ${p.so} ${donVi}`).join(", ")}`}
        sx={{ display: "flex", gap: "2px", height: 12 }}
      >
        {tong === 0 ? (
          <Box sx={{ flex: 1, borderRadius: 1, bgcolor: "action.hover" }} />
        ) : (
          coSo.map((p, i) => (
            <Tooltip
              key={p.khoa}
              title={`${p.nhan}: ${p.so} ${donVi} (${phanTram(p.so, tong)})`}
              arrow
            >
              <Box
                sx={{
                  flexGrow: p.so,
                  flexBasis: 0,
                  minWidth: 3,
                  bgcolor: p.mau,
                  borderTopLeftRadius: i === 0 ? 4 : 0,
                  borderBottomLeftRadius: i === 0 ? 4 : 0,
                  borderTopRightRadius: i === coSo.length - 1 ? 4 : 0,
                  borderBottomRightRadius: i === coSo.length - 1 ? 4 : 0,
                  transition: "opacity .15s",
                  "&:hover": { opacity: 0.8 },
                }}
              />
            </Tooltip>
          ))
        )}
      </Box>

      <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 2, rowGap: 0.5, mt: 1 }}>
        {phan.map((p) => (
          <Stack key={p.khoa} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: p.mau, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              {p.nhan}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {p.so}
            </Typography>
            {tong > 0 && (
              <Typography variant="caption" color="text.secondary">
                ({phanTram(p.so, tong)})
              </Typography>
            )}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
