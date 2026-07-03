import type { JSX } from 'react';
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/Delete';
import { computeLine, fmt } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/calc';
import type { LineForm } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/types';

interface Props {
  lines: LineForm[];
  ro: boolean;
  onLineChange: (idx: number, patch: Partial<LineForm>) => void;
  onRemove: (idx: number) => void;
}

/** Cột nhập được: [key, nhãn, kiểu, độ rộng]. Cột tính (Tiền/Chiết khấu) render riêng. */
type Kind = 'text' | 'upper' | 'num';
interface Col {
  key: keyof LineForm;
  label: string;
  kind: Kind;
  w: number;
}

// Cột trước cột "Tiền" (tính).
const COLS_A: Col[] = [
  { key: 'ma_vt', label: 'Mã hàng', kind: 'upper', w: 90 },
  { key: 'ten_vt', label: 'Tên hàng hoá, vật tư', kind: 'text', w: 200 },
  { key: 'dvt2', label: 'Đvt2', kind: 'text', w: 55 },
  { key: 'dvt', label: 'Đvt', kind: 'text', w: 55 },
  { key: 'so_luong2', label: 'Số lượng 2', kind: 'num', w: 90 },
  { key: 'so_luong2_nl', label: 'Số lượng 2 nhận lại', kind: 'num', w: 110 },
  { key: 'so_luong_giao', label: 'Số lượng Giao', kind: 'num', w: 100 },
  { key: 'so_luong_hh', label: 'Số lượng hao hụt', kind: 'num', w: 100 },
  { key: 'ty_le_hh', label: 'Tỷ lệ hao hụt', kind: 'num', w: 90 },
  { key: 'so_luong', label: 'Số lượng Bán thực tế', kind: 'num', w: 110 },
  { key: 'gia_nt2', label: 'Giá', kind: 'num', w: 100 },
];

// Cột giữa (sau "Tiền", trước "Chiết khấu").
const COLS_B: Col[] = [
  { key: 'gia_khay_nt', label: 'Giá khay', kind: 'num', w: 100 },
  { key: 'tien_khay_nt', label: 'Tiền Khay', kind: 'num', w: 100 },
  { key: 'tien_no_nt', label: 'Tiền tính nợ', kind: 'num', w: 110 },
  { key: 'tl_ck', label: 'TLCK', kind: 'num', w: 70 },
];

// Cột sau "Chiết khấu".
const COLS_C: Col[] = [
  { key: 'ma_thue', label: 'Mã Thuế', kind: 'upper', w: 70 },
  { key: 'thue_nt', label: 'Tiền thuế', kind: 'num', w: 100 },
  { key: 'ma_du_an', label: 'Dự án', kind: 'upper', w: 90 },
  { key: 'ma_phong_ban', label: 'Phòng ban', kind: 'upper', w: 90 },
  { key: 'ma_kho', label: 'Mã kho', kind: 'upper', w: 80 },
  { key: 'tk_dt', label: 'Tài khoản doanh thu', kind: 'upper', w: 110 },
  { key: 'tk_ck', label: 'Tài khoản chiết khấu', kind: 'upper', w: 110 },
  { key: 'tk_gv', label: 'Tài khoản giá vốn', kind: 'upper', w: 110 },
  { key: 'tk_thue', label: 'Tài khoản thuế', kind: 'upper', w: 100 },
];

/** Bảng nhập chi tiết dòng hàng bán (Tiền hàng & Chiết khấu tính tự động). */
export function DetailGrid({ lines, ro, onLineChange, onRemove }: Props): JSX.Element {
  const headCells = (cols: Col[]) =>
    cols.map((c) => (
      <TableCell key={c.key} align={c.kind === 'num' ? 'right' : 'left'} sx={{ minWidth: c.w }}>
        {c.label}
      </TableCell>
    ));

  const inputCell = (l: LineForm, idx: number, c: Col): JSX.Element => (
    <TableCell key={c.key}>
      <TextField
        variant="standard"
        type={c.kind === 'num' ? 'number' : 'text'}
        value={String(l[c.key] ?? '')}
        onChange={(e) =>
          onLineChange(idx, {
            [c.key]:
              c.kind === 'num'
                ? Number(e.target.value) || 0
                : c.kind === 'upper'
                  ? e.target.value.toUpperCase()
                  : e.target.value,
          } as Partial<LineForm>)
        }
        disabled={ro}
        slotProps={{ input: { disableUnderline: ro } }}
        sx={{ width: '100%', '& input': { fontSize: 12.5, textAlign: c.kind === 'num' ? 'right' : 'left', p: 0.25 } }}
      />
    </TableCell>
  );

  return (
    <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small" sx={{ minWidth: 2600, '& td, & th': { px: 0.5, py: 0.25, whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 32 }}>STT</TableCell>
            {headCells(COLS_A)}
            <TableCell align="right" sx={{ minWidth: 110 }}>Tiền</TableCell>
            {headCells(COLS_B)}
            <TableCell align="right" sx={{ minWidth: 100 }}>Chiết khấu</TableCell>
            {headCells(COLS_C)}
            {!ro && <TableCell sx={{ width: 36 }} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((l, i) => {
            const c = computeLine(l);
            return (
              <TableRow key={i} hover>
                <TableCell sx={{ color: 'text.secondary' }}>{i + 1}</TableCell>
                {COLS_A.map((col) => inputCell(l, i, col))}
                <TableCell align="right" sx={{ fontSize: 12.5 }}>{fmt(c.tien_nt2)}</TableCell>
                {COLS_B.map((col) => inputCell(l, i, col))}
                <TableCell align="right" sx={{ fontSize: 12.5 }}>{fmt(c.ck_nt)}</TableCell>
                {COLS_C.map((col) => inputCell(l, i, col))}
                {!ro && (
                  <TableCell>
                    <IconButton size="small" onClick={() => onRemove(i)} disabled={lines.length <= 1}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
