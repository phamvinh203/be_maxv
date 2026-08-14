import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { getApiError } from '@/lib/apiClient';
import { KhachHangPickerDialog } from '@/components/Accounting/KhachHangPickerDialog';
import {
  useChiTiet,
  useCreateHoaDon,
  useUpdateHoaDon,
} from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/hooks/useHoaDonBanHang';
import { nextSoCt } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/api/hoaDonBanHangApi';
import { fmt } from '@/utils/format';
import { computeTotals } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/calc';
import { ChiTietTab } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/components/tabs/ChiTietTab';
import { KhacTab } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/components/tabs/KhacTab';
import { XuatKhauTab } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/components/tabs/XuatKhauTab';
import { HddtTab } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/components/tabs/HddtTab';
import {
  chiTietToLine,
  emptyHoaDon,
  EMPTY_LINE,
  hoaDonToForm,
  type HoaDon,
  type HoaDonForm,
  type LineForm,
} from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/types';

export type HoaDonMode = 'new' | 'edit' | 'copy' | 'view';

interface Props {
  open: boolean;
  mode: HoaDonMode;
  current: HoaDon | null;
  onClose: () => void;
}

const TITLES: Record<HoaDonMode, string> = {
  new: 'Thêm hóa đơn bán hàng',
  edit: 'Sửa hóa đơn bán hàng',
  copy: 'Thêm hóa đơn bán hàng',
  view: 'Xem hóa đơn bán hàng',
};

export function HoaDonFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const ro = mode === 'view';
  const create = useCreateHoaDon();
  const update = useUpdateHoaDon();

  const sttRec = mode !== 'new' && current ? current.stt_rec : null;
  const { data: chiTietData } = useChiTiet(open ? sttRec : null);

  const [form, setForm] = useState<HoaDonForm>(emptyHoaDon);
  const [error, setError] = useState('');
  const [pickKh, setPickKh] = useState(false);
  const [tab, setTab] = useState(0);

  // Mở form: nạp header, lấy số CT kế tiếp khi thêm mới.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi dialog vừa mở, không phải đồng bộ liên tục
    setError('');
    setTab(0);
    if (mode === 'new' || !current) {
      const f = emptyHoaDon();
      setForm(f);
      nextSoCt()
        .then((r) => setForm((prev) => ({ ...prev, so_ct: r.so_ct })))
        .catch(() => {});
    } else {
      setForm(hoaDonToForm(current));
    }
  }, [open, mode, current]);

  // Nạp dòng chi tiết khi sửa/copy/xem.
  useEffect(() => {
    if (!open || mode === 'new' || !chiTietData) return;
    const lines = chiTietData.map(chiTietToLine);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp chi tiết khi mở dialog sửa/copy/xem, không phải đồng bộ liên tục
    setForm((prev) => ({ ...prev, chi_tiet: lines.length ? lines : [{ ...EMPTY_LINE }] }));
  }, [open, mode, chiTietData]);

  function setField<K extends keyof HoaDonForm>(key: K, value: HoaDonForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setLine(idx: number, patch: Partial<LineForm>) {
    setForm((f) => ({
      ...f,
      chi_tiet: f.chi_tiet.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }

  const addLine = () =>
    setForm((f) => ({ ...f, chi_tiet: [...f.chi_tiet, { ...EMPTY_LINE }] }));
  const removeLine = (idx: number) =>
    setForm((f) => ({
      ...f,
      chi_tiet: f.chi_tiet.length > 1 ? f.chi_tiet.filter((_, i) => i !== idx) : f.chi_tiet,
    }));

  const totals = useMemo(() => computeTotals(form.chi_tiet), [form.chi_tiet]);

  const pending = create.isPending || update.isPending;

  function handleSave() {
    if (ro) return;
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    // Chỉ gửi INPUT THÔ — không gửi số tiền/thuế/chiết khấu đã tính (tien_nt2, ck_nt,
    // thue_nt, tien_khay_nt, tien_no_nt) hay các tổng (t_tien_nt2, t_ck_nt...). Backend
    // tự tính lại toàn bộ từ so_luong/gia_nt2/tl_ck/thue_suat/ty_gia — không tin số tiền
    // do trình duyệt tính (mass-assignment: client có thể sửa payload để ghi khống doanh thu).
    const chi_tiet = form.chi_tiet
      .filter((l) => l.ma_vt.trim())
      .map(
        ({
          ma_vt, dvt, dvt2, he_so2, ma_kho,
          so_luong, gia_nt2, tl_ck, so_luong2, so_luong2_nl,
          so_luong_giao, so_luong_hh, ty_le_hh, gia_khay_nt,
          ma_thue, thue_suat, ma_du_an, ma_pb,
          tk_dt, tk_ck, tk_gv, tk_thue, tk_vt,
        }) => ({
          ma_vt, dvt, dvt2, he_so2, ma_kho,
          so_luong, gia_nt2, tl_ck, so_luong2, so_luong2_nl,
          so_luong_giao, so_luong_hh, ty_le_hh, gia_khay_nt,
          ma_thue, thue_suat, ma_du_an, ma_pb,
          tk_dt, tk_ck, tk_gv, tk_thue, tk_vt,
        }),
      );

    const body = { ...form, chi_tiet };

    if (mode === 'edit' && current) {
      update.mutate({ sttRec: current.stt_rec, body }, { onSuccess: onClose, onError });
    } else {
      create.mutate(body, { onSuccess: onClose, onError });
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 'min(1200px, 98vw)', maxWidth: '100vw' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Title */}
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}
        >
          <Typography sx={{ fontWeight: 700 }}>{TITLES[mode]}</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Body */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Header fields */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
            <TextField label="Số hóa đơn" required size="small" value={form.so_ct} onChange={(e) => setField('so_ct', e.target.value)} disabled={ro} />
            <TextField label="Ký hiệu" size="small" value={form.so_seri} onChange={(e) => setField('so_seri', e.target.value)} disabled={ro} />
            <TextField label="Ngày chứng từ" type="date" size="small" value={form.ngay_lct} onChange={(e) => setField('ngay_lct', e.target.value)} disabled={ro} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Ngày hạch toán" type="date" size="small" value={form.ngay_ct} onChange={(e) => setField('ngay_ct', e.target.value)} disabled={ro} slotProps={{ inputLabel: { shrink: true } }} />

            <TextField
              label="Mã khách"
              required
              size="small"
              value={form.ma_kh}
              onChange={(e) => setField('ma_kh', e.target.value.toUpperCase())}
              disabled={ro}
              slotProps={{
                input: {
                  endAdornment: !ro && (
                    <InputAdornment position="end">
                      <Tooltip title="Chọn khách hàng">
                        <IconButton edge="end" size="small" onClick={() => setPickKh(true)}>
                          <SearchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField label="Người mua" size="small" value={form.ong_ba} onChange={(e) => setField('ong_ba', e.target.value)} disabled={ro} sx={{ gridColumn: 'span 2' }} />
            <TextField label="Mã giao dịch" size="small" value={form.ma_gd} onChange={(e) => setField('ma_gd', e.target.value)} disabled={ro} />

            <TextField label="Tài khoản nợ" size="small" value={form.tk} onChange={(e) => setField('tk', e.target.value.toUpperCase())} disabled={ro} />
            <TextField label="NV bán hàng" size="small" value={form.ma_nvbh} onChange={(e) => setField('ma_nvbh', e.target.value.toUpperCase())} disabled={ro} />
            <TextField label="Ngoại tệ" size="small" value={form.ma_nt} onChange={(e) => setField('ma_nt', e.target.value.toUpperCase())} disabled={ro} />
            <TextField label="Tỷ giá" type="number" size="small" value={form.ty_gia} onChange={(e) => setField('ty_gia', Number(e.target.value) || 1)} disabled={ro} />

            <TextField label="Diễn giải" size="small" value={form.dien_giai} onChange={(e) => setField('dien_giai', e.target.value)} disabled={ro} sx={{ gridColumn: 'span 3' }} />
            <TextField select label="Trạng thái" size="small" value={form.status} onChange={(e) => setField('status', e.target.value)} disabled={ro}>
              <MenuItem value="2">Lập chứng từ</MenuItem>
              {/* "Đã ghi sổ" không cho chọn khi tạo/sửa (backend chặn) — chỉ hiện nếu
                  hóa đơn đang xem/đã có sẵn trạng thái này, để không vỡ hiển thị. */}
              {(ro || form.status === '1') && <MenuItem value="1">Đã ghi sổ</MenuItem>}
              <MenuItem value="0">Hủy</MenuItem>
            </TextField>
          </Box>

          <Divider sx={{ mt: 2 }} />

          {/* Tabs */}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40, mb: 1.5 }}>
            <Tab label="Chi tiết" sx={{ minHeight: 40 }} />
            <Tab label="Khác" sx={{ minHeight: 40 }} />
            <Tab label="Xuất khẩu" sx={{ minHeight: 40 }} />
            <Tab label="HĐĐT" sx={{ minHeight: 40 }} />
          </Tabs>

          {tab === 0 && (
            <ChiTietTab
              lines={form.chi_tiet}
              ro={ro}
              onLineChange={setLine}
              onAdd={addLine}
              onRemove={removeLine}
            />
          )}
          {tab === 1 && <KhacTab />}
          {tab === 2 && <XuatKhauTab />}
          {tab === 3 && <HddtTab />}

          {/* Totals (luôn hiển thị — tổng toàn hóa đơn) */}
          <Stack direction="row" spacing={3} sx={{ justifyContent: 'flex-end', mt: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2">Tổng SL: <b>{fmt(totals.sl)}</b></Typography>
            <Typography variant="body2">Tiền hàng: <b>{fmt(totals.tien)}</b></Typography>
            <Typography variant="body2">Chiết khấu: <b>{fmt(totals.ck)}</b></Typography>
            <Typography variant="body2">Thuế: <b>{fmt(totals.thue)}</b></Typography>
            <Typography variant="body2" color="primary">Thanh toán: <b>{fmt(totals.tt)}</b></Typography>
          </Stack>
        </Box>

        {/* Footer */}
        <Stack direction="row" spacing={1} sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          {!ro && (
            <Button variant="contained" onClick={handleSave} disabled={pending}>
              {pending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          )}
          <Button onClick={onClose} disabled={pending}>{ro ? 'Đóng' : 'Hủy'}</Button>
        </Stack>
      </Box>

      <KhachHangPickerDialog
        open={pickKh}
        onClose={() => setPickKh(false)}
        onSelect={(kh) =>
          setForm((f) => ({ ...f, ma_kh: kh.ma_kh, ong_ba: f.ong_ba || kh.ten_kh }))
        }
      />
    </Drawer>
  );
}
