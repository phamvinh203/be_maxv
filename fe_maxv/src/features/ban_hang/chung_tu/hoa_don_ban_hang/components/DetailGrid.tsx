import { useState, type JSX } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { PhongBanPickerDialog } from '@/components/PhongBanPickerDialog';
import { VatTuPickerDialog } from '@/components/VatTuPickerDialog';
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
  { key: 'ma_pb', label: 'Phòng ban', kind: 'upper', w: 110 },
  { key: 'ma_kho', label: 'Mã kho', kind: 'upper', w: 80 },
  { key: 'tk_dt', label: 'Tài khoản doanh thu', kind: 'upper', w: 110 },
  { key: 'tk_ck', label: 'Tài khoản chiết khấu', kind: 'upper', w: 110 },
  { key: 'tk_gv', label: 'Tài khoản giá vốn', kind: 'upper', w: 110 },
  { key: 'tk_thue', label: 'Tài khoản thuế', kind: 'upper', w: 100 },
];

/** Bảng nhập chi tiết dòng hàng bán (Tiền hàng & Chiết khấu tính tự động). */
export function DetailGrid({ lines, ro, onLineChange, onRemove }: Props): JSX.Element {
  /** Dòng đang mở dialog chọn phòng ban / hàng hóa (null = đóng). */
  const [pickPbRow, setPickPbRow] = useState<number | null>(null);
  const [pickVtRow, setPickVtRow] = useState<number | null>(null);

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

  /** Ô nhập mã kèm icon mở dialog chọn (dùng cho Mã hàng / Phòng ban). */
  const pickerCell = (
    l: LineForm,
    idx: number,
    field: 'ma_vt' | 'ma_pb',
    tip: string,
    onPick: (idx: number) => void,
  ): JSX.Element => (
    <TableCell key={field}>
      <TextField
        variant="standard"
        value={l[field]}
        onChange={(e) => onLineChange(idx, { [field]: e.target.value.toUpperCase() } as Partial<LineForm>)}
        disabled={ro}
        slotProps={{
          input: {
            disableUnderline: ro,
            endAdornment: !ro && (
              <InputAdornment position="end" sx={{ ml: 0 }}>
                <Tooltip title={tip}>
                  <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onPick(idx)}>
                    <SearchIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
        sx={{ width: '100%', '& input': { fontSize: 12.5, p: 0.25 } }}
      />
    </TableCell>
  );

  /** Render 1 ô theo cột (đặc biệt hóa cột Mã hàng & Phòng ban). */
  const renderCell = (l: LineForm, idx: number, c: Col): JSX.Element => {
    if (c.key === 'ma_vt') return pickerCell(l, idx, 'ma_vt', 'Chọn hàng hóa', setPickVtRow);
    if (c.key === 'ma_pb') return pickerCell(l, idx, 'ma_pb', 'Chọn phòng ban', setPickPbRow);
    return inputCell(l, idx, c);
  };

  return (
    <>
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
                {COLS_A.map((col) => renderCell(l, i, col))}
                <TableCell align="right" sx={{ fontSize: 12.5 }}>{fmt(c.tien_nt2)}</TableCell>
                {COLS_B.map((col) => inputCell(l, i, col))}
                <TableCell align="right" sx={{ fontSize: 12.5 }}>{fmt(c.ck_nt)}</TableCell>
                {COLS_C.map((col) => renderCell(l, i, col))}
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

    <PhongBanPickerDialog
      open={pickPbRow !== null}
      onClose={() => setPickPbRow(null)}
      onSelect={(pb) => {
        if (pickPbRow !== null) onLineChange(pickPbRow, { ma_pb: pb.ma_pb });
      }}
    />

    <VatTuPickerDialog
      open={pickVtRow !== null}
      onClose={() => setPickVtRow(null)}
      onSelect={(vt) => {
        if (pickVtRow === null) return;
        onLineChange(pickVtRow, {
          ma_vt: vt.ma_vt,
          ten_vt: vt.ten_vt,
          dvt: vt.dvt,
          dvt2: vt.dvt2 ?? '',
          tk_vt: vt.tk_vt ?? '',
          tk_dt: vt.tk_dt ?? '',
          tk_gv: vt.tk_gv ?? '',
        });
      }}
    />
    </>
  );
}
