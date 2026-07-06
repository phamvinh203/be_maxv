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
import { ThuePickerDialog } from '@/components/ThuePickerDialog';
import { fmtMoney } from '@/utils/format';
import { applyQtyDeps, computeLine } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/calc';
import { useThueRates } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/hooks/useThueRates';
import type { LineForm } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/types';

/** Ô số có phân cách ngàn khi rời focus, hiện số thô khi đang gõ (kiểu maxv1). */
function NumCell({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (n: number) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = editing ? draft : fmtMoney(value);
  return (
    <TextField
      variant="standard"
      value={display}
      disabled={disabled}
      onFocus={(e) => {
        setEditing(true);
        setDraft(value ? String(value) : '');
        e.currentTarget.select();
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        onCommit(Number(raw.replace(/[^\d.-]/g, '')) || 0);
      }}
      slotProps={{ input: { disableUnderline: disabled } }}
      sx={{ width: '100%', '& input': { fontSize: 12.5, textAlign: 'right', p: 0.25 } }}
    />
  );
}

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
  const [pickThueRow, setPickThueRow] = useState<number | null>(null);
  /** Mã thuế -> thuế suất % (để tự tính Tiền thuế). */
  const thueRates = useThueRates();

  /** Ô Mã thuế: nhập mã + icon chọn từ danh mục thuế; tự lấy thuế suất. */
  const thueCell = (l: LineForm, idx: number): JSX.Element => (
    <TableCell key="ma_thue">
      <TextField
        variant="standard"
        value={l.ma_thue}
        onChange={(e) => {
          const ma = e.target.value.toUpperCase();
          onLineChange(idx, { ma_thue: ma, thue_suat: thueRates.get(ma) ?? 0 });
        }}
        disabled={ro}
        slotProps={{
          input: {
            disableUnderline: ro,
            endAdornment: !ro && (
              <InputAdornment position="end" sx={{ ml: 0 }}>
                <Tooltip title="Chọn mã thuế">
                  <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setPickThueRow(idx)}>
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

  const headCells = (cols: Col[]) =>
    cols.map((c) => (
      <TableCell key={c.key} align={c.kind === 'num' ? 'right' : 'left'} sx={{ minWidth: c.w }}>
        {c.label}
      </TableCell>
    ));

  const inputCell = (l: LineForm, idx: number, c: Col): JSX.Element => (
    <TableCell key={c.key}>
      {c.kind === 'num' ? (
        <NumCell
          value={Number(l[c.key]) || 0}
          disabled={ro}
          onCommit={(n) =>
            onLineChange(idx, applyQtyDeps({ ...l, [c.key]: n } as LineForm, c.key))
          }
        />
      ) : (
        <TextField
          variant="standard"
          value={String(l[c.key] ?? '')}
          onChange={(e) =>
            onLineChange(idx, {
              [c.key]: c.kind === 'upper' ? e.target.value.toUpperCase() : e.target.value,
            } as Partial<LineForm>)
          }
          disabled={ro}
          slotProps={{ input: { disableUnderline: ro } }}
          sx={{ width: '100%', '& input': { fontSize: 12.5, p: 0.25 } }}
        />
      )}
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

  /** Ô hiển thị giá trị tính tự động (read-only). */
  const computedCell = (key: string, val: number): JSX.Element => (
    <TableCell key={key} align="right" sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}>
      {fmtMoney(val)}
    </TableCell>
  );

  type Computed = ReturnType<typeof computeLine>;

  /** Render 1 ô theo cột (picker cho Mã hàng/Phòng ban, read-only cho ô tính). */
  const renderCell = (l: LineForm, idx: number, cv: Computed, c: Col): JSX.Element => {
    if (c.key === 'ma_vt') return pickerCell(l, idx, 'ma_vt', 'Chọn hàng hóa', setPickVtRow);
    if (c.key === 'ma_pb') return pickerCell(l, idx, 'ma_pb', 'Chọn phòng ban', setPickPbRow);
    if (c.key === 'ma_thue') return thueCell(l, idx);
    if (c.key === 'tien_khay_nt') return computedCell('tien_khay_nt', cv.tien_khay_nt);
    if (c.key === 'tien_no_nt') return computedCell('tien_no_nt', cv.tien_no_nt);
    if (c.key === 'thue_nt') return computedCell('thue_nt', cv.thue_nt);
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
            const cv = computeLine(l);
            return (
              <TableRow key={i} hover>
                <TableCell sx={{ color: 'text.secondary' }}>{i + 1}</TableCell>
                {COLS_A.map((col) => renderCell(l, i, cv, col))}
                <TableCell align="right" sx={{ fontSize: 12.5, fontWeight: 600 }}>{fmtMoney(cv.tien_nt2)}</TableCell>
                {COLS_B.map((col) => renderCell(l, i, cv, col))}
                <TableCell align="right" sx={{ fontSize: 12.5, fontWeight: 600 }}>{fmtMoney(cv.ck_nt)}</TableCell>
                {COLS_C.map((col) => renderCell(l, i, cv, col))}
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
        const base: LineForm = {
          ...lines[pickVtRow],
          ma_vt: vt.ma_vt,
          ten_vt: vt.ten_vt,
          dvt: vt.dvt,
          dvt2: vt.dvt2 ?? '',
          he_so2: Number(vt.he_so2) || 0,
          tk_vt: vt.tk_vt ?? '',
          tk_dt: vt.tk_dt ?? '',
          tk_gv: vt.tk_gv ?? '',
        };
        // Có hệ số 2 -> tính lại SL Giao / SL Bán thực tế.
        onLineChange(pickVtRow, applyQtyDeps(base, 'he_so2'));
      }}
    />

    <ThuePickerDialog
      open={pickThueRow !== null}
      onClose={() => setPickThueRow(null)}
      onSelect={(t) => {
        if (pickThueRow === null) return;
        onLineChange(pickThueRow, { ma_thue: t.ma_thue, thue_suat: Number(t.ty_le) || 0 });
      }}
    />
    </>
  );
}
