import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useElementWidth } from "../../../../hddt/hooks/useElementHeight";
import { AN_TREN_MAN_HINH, useMauBieuDo } from "./mauBieuDo";

export interface CotBieuDo {
  khoa: string;
  /** Nhãn trục X, vd `T9`. */
  nhan: string;
  /** Dòng phụ dưới nhãn, vd năm — chỉ truyền ở cột đầu hoặc khi năm đổi. */
  nhanPhu?: string;
  /** `null` = chỗ trống có chủ ý (tháng chưa có dữ liệu), khác với giá trị 0. */
  cot: number | null;
  duong?: number | null;
  /** Ghi giá trị lên đầu cột — dùng cho MỘT cột, không phải mọi cột. */
  ghiNhan?: boolean;
  /** Nội dung tooltip khi rê chuột / focus bàn phím. */
  chiTiet: ReactNode;
  /** Một dòng mô tả cho bảng ẩn của trình đọc màn hình. */
  moTa: string;
}

interface Props {
  duLieu: CotBieuDo[];
  tenCot: string;
  /** Có thì vẽ thêm chuỗi đường (cùng MỘT trục, cùng đơn vị với cột — không bao giờ trục kép). */
  tenDuong?: string;
  dinhDang: (giaTri: number) => string;
  /** Bước chia trục nhỏ nhất — `1` cho số đếm (người), để trục không ra vạch 0,25 người. */
  buocToiThieu?: number;
  /** Chiều cao vùng vẽ, CHƯA gồm dải nhãn trục X. */
  cao?: number;
  moTa: string;
}

const LE_TREN = 22;
const LE_DUOI = 34;
const LE_PHAI = 8;
const BAN_KINH = 4;

/** Bước chia trục "đẹp" (1, 2, 2.5, 5 × 10ⁿ) để vạch rơi vào số tròn. */
function buocDep(max: number, soBuoc: number): number {
  const tho = max / soBuoc;
  const mu = 10 ** Math.floor(Math.log10(tho));
  const heSo = tho / mu;
  const dep = heSo <= 1 ? 1 : heSo <= 2 ? 2 : heSo <= 2.5 ? 2.5 : heSo <= 5 ? 5 : 10;
  return dep * mu;
}

/** Cột bo tròn 4px ở đầu dữ liệu, VUÔNG ở đường gốc. */
function duongCot(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(BAN_KINH, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}

/**
 * Biểu đồ cột theo thời gian, tùy chọn thêm một chuỗi đường cùng đơn vị.
 *
 * Vẽ bằng SVG thuần theo bề rộng thật của khung (không thư viện ngoài — dự án chưa có thư viện
 * biểu đồ, ba biểu đồ của Dashboard không đáng kéo thêm một dependency). Rê chuột / Tab vào một
 * cột hiện tooltip đủ mọi chuỗi; bảng ẩn song song cho trình đọc màn hình.
 */
export default function BieuDoCot({
  duLieu,
  tenCot,
  tenDuong,
  dinhDang,
  buocToiThieu = 0,
  cao = 200,
  moTa,
}: Props) {
  const mau = useMauBieuDo();
  // SVG vẽ đúng số pixel khung chứa thay vì co giãn bằng `viewBox` — chữ trục không phình/co theo khung.
  const [ref, rongDo] = useElementWidth<HTMLDivElement>();
  const rong = Math.floor(rongDo);
  const [dangChon, setDangChon] = useState<number | null>(null);

  const max = Math.max(0, ...duLieu.flatMap((d) => [d.cot ?? 0, d.duong ?? 0]));
  const buoc = max > 0 ? Math.max(buocToiThieu, buocDep(max, 4)) : 1;
  const dinh = max > 0 ? buoc * Math.ceil(max / buoc) : 1;
  const vach =
    max > 0 ? Array.from({ length: Math.round(dinh / buoc) + 1 }, (_, i) => i * buoc) : [0];

  const leTrai = Math.max(...vach.map((v) => dinhDang(v).length)) * 6.5 + 12;
  const rongVe = Math.max(0, rong - leTrai - LE_PHAI);
  const bang = duLieu.length > 0 ? rongVe / duLieu.length : 0;
  const rongCot = Math.min(24, bang * 0.5);
  const goc = LE_TREN + cao;
  const toaDoY = (v: number) => goc - (v / dinh) * cao;
  const tamX = (i: number) => leTrai + bang * i + bang / 2;

  // Đường đứt ở tháng không có số — nối qua chỗ trống là bịa ra một xu hướng không có thật.
  const doanDuong: string[] = [];
  if (tenDuong) {
    let doan = "";
    duLieu.forEach((d, i) => {
      if (d.duong == null) {
        if (doan) doanDuong.push(doan);
        doan = "";
        return;
      }
      doan += `${doan ? "L" : "M"}${tamX(i)},${toaDoY(d.duong)} `;
    });
    if (doan) doanDuong.push(doan);
  }

  const chon = dangChon !== null ? duLieu[dangChon] : undefined;
  const benTrai = dangChon !== null && tamX(dangChon) > rong / 2;

  return (
    <Box>
      {tenDuong && (
        <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: "wrap" }}>
          <ChuGiai loai="cot" mau={mau.chuoi[0]} nhan={tenCot} />
          <ChuGiai loai="duong" mau={mau.chuoi[1]} nhan={tenDuong} />
        </Stack>
      )}

      <Box ref={ref} sx={{ position: "relative", height: LE_TREN + cao + LE_DUOI }}>
        {rong > 0 && (
          <svg
            width={rong}
            height={LE_TREN + cao + LE_DUOI}
            role="group"
            aria-label={moTa}
            style={{ display: "block", overflow: "visible" }}
          >
            {vach.map((v) => (
              <g key={v}>
                <line
                  x1={leTrai}
                  x2={rong - LE_PHAI}
                  y1={toaDoY(v)}
                  y2={toaDoY(v)}
                  stroke={v === 0 ? mau.truc : mau.luoi}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={leTrai - 8}
                  y={toaDoY(v)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={11}
                  fill={mau.chuPhu}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {dinhDang(v)}
                </text>
              </g>
            ))}

            {dangChon !== null && (
              <rect
                x={leTrai + bang * dangChon}
                y={LE_TREN - 8}
                width={bang}
                height={cao + 8}
                fill={mau.nenChon}
                rx={4}
              />
            )}

            {duLieu.map((d, i) => {
              if (d.cot == null) return null;
              const yDinh = toaDoY(d.cot);
              return (
                <g key={d.khoa}>
                  <path
                    d={duongCot(tamX(i) - rongCot / 2, yDinh, rongCot, goc - yDinh)}
                    fill={mau.chuoi[0]}
                  />
                  {d.ghiNhan && (
                    <text
                      x={tamX(i)}
                      y={yDinh - 7}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill={mau.chu}
                    >
                      {dinhDang(d.cot)}
                    </text>
                  )}
                </g>
              );
            })}

            {doanDuong.map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke={mau.chuoi[1]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {tenDuong &&
              duLieu.map((d, i) =>
                d.duong == null ? null : (
                  <circle
                    key={d.khoa}
                    cx={tamX(i)}
                    cy={toaDoY(d.duong)}
                    r={4}
                    fill={mau.chuoi[1]}
                    stroke={mau.nen}
                    strokeWidth={2}
                  />
                ),
              )}

            {duLieu.map((d, i) => (
              <g key={d.khoa} opacity={d.cot == null ? 0.55 : 1}>
                <text
                  x={tamX(i)}
                  y={goc + 16}
                  textAnchor="middle"
                  fontSize={11.5}
                  fontWeight={dangChon === i ? 600 : 400}
                  fill={dangChon === i ? mau.chu : mau.chuPhu}
                >
                  {d.nhan}
                </text>
                {d.nhanPhu && (
                  <text x={tamX(i)} y={goc + 29} textAnchor="middle" fontSize={10} fill={mau.chuPhu}>
                    {d.nhanPhu}
                  </text>
                )}
              </g>
            ))}

            {/* Vùng bắt chuột phủ cả băng — người đọc nhắm vào một tháng, không nhắm vào cột 24px. */}
            {duLieu.map((d, i) => (
              <rect
                key={d.khoa}
                x={leTrai + bang * i}
                y={0}
                width={bang}
                height={goc + LE_DUOI}
                fill="transparent"
                tabIndex={0}
                aria-label={d.moTa}
                style={{ outline: "none", cursor: "default" }}
                onPointerEnter={() => setDangChon(i)}
                onPointerLeave={() => setDangChon(null)}
                onFocus={() => setDangChon(i)}
                onBlur={() => setDangChon(null)}
              />
            ))}
          </svg>
        )}

        {chon && dangChon !== null && (
          <Paper
            elevation={6}
            sx={{
              position: "absolute",
              top: 0,
              ...(benTrai
                ? { right: rong - (leTrai + bang * dangChon) + 6 }
                : { left: leTrai + bang * (dangChon + 1) + 6 }),
              minWidth: 200,
              maxWidth: 280,
              px: 1.5,
              py: 1,
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            {chon.chiTiet}
          </Paper>
        )}
      </Box>

      <Box component="table" sx={AN_TREN_MAN_HINH}>
        <caption>{moTa}</caption>
        <tbody>
          {duLieu.map((d) => (
            <tr key={d.khoa}>
              <td>{d.moTa}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

/** Chú giải mô phỏng đúng dạng mark: ô vuông cho cột, gạch ngang cho đường. */
function ChuGiai({ loai, mau, nhan }: { loai: "cot" | "duong"; mau: string; nhan: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <Box
        sx={
          loai === "cot"
            ? { width: 10, height: 10, borderRadius: 0.5, bgcolor: mau }
            : { width: 14, height: 2, borderRadius: 1, bgcolor: mau }
        }
      />
      <Typography variant="caption" color="text.secondary">
        {nhan}
      </Typography>
    </Stack>
  );
}

/** Một dòng trong tooltip: khóa màu dạng gạch ngắn, GIÁ TRỊ đậm đứng trước, tên chuỗi mờ theo sau. */
export function DongChiTiet({
  mau,
  nhan,
  giaTri,
}: {
  mau?: string;
  nhan: string;
  giaTri: string;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", py: 0.25 }}>
      <Box sx={{ width: 10, height: 2, borderRadius: 1, bgcolor: mau ?? "transparent", flexShrink: 0 }} />
      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {giaTri}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {nhan}
      </Typography>
    </Stack>
  );
}
