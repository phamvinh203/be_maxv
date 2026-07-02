import {
  useEffect,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from 'react';
import CloseIcon from '@mui/icons-material/Close';
import {
  useCreateHangHoa,
  useHangHoaDetail,
  useLookups,
  useUpdateHangHoa,
} from '@/features/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';
import { getApiError } from '@/lib/apiClient';
import {
  EMPTY_FORM,
  type HangHoa,
  type HangHoaForm,
  type Lookup,
  type Lookups,
} from '@/features/ton_kho/danh_muc/hang_hoa/types';

export type FormMode = 'new' | 'edit' | 'copy' | 'view';

interface Props {
  open: boolean;
  mode: FormMode;
  /** Mã nguồn cho edit/copy/view (null khi thêm mới). */
  maVt: string | null;
  onClose: () => void;
}

type Setter = (k: keyof HangHoaForm, v: unknown) => void;

const EMPTY_LOOKUPS: Lookups = {
  dvtList: [],
  loaiList: [],
  khoList: [],
  thueList: [],
  thuenkList: [],
  nh1List: [],
  nh2List: [],
  nh3List: [],
};

// ── Styles ──────────────────────────────────────────────────────────────────
const fi: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '4px 8px',
  border: '1px solid #b8c9dc',
  borderRadius: 3,
  fontSize: 13,
  background: 'white',
  outline: 'none',
};
const tabTable: CSSProperties = {
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
};

const TITLES: Record<FormMode, string> = {
  new: 'Thêm vật tư',
  edit: 'Sửa vật tư',
  copy: 'Thêm vật tư',
  view: 'Xem vật tư',
};
const TABS = ['Thông tin chính', 'Tài khoản', 'Lô', 'Khác'];

/** Chi tiết -> form (Decimal string -> number, null -> ''). */
function toForm(d: HangHoa): HangHoaForm {
  const s = (v: string | null | undefined): string => v ?? '';
  const n = (v: string | number | undefined, def = 0): number =>
    v == null || v === '' ? def : Number(v);
  return {
    ma_vt: d.ma_vt,
    ten_vt: d.ten_vt,
    ten_vt2: s(d.ten_vt2),
    dvt: d.dvt,
    dvt2: s(d.dvt2),
    he_so2: n(d.he_so2, 1),
    nhieu_dvt: !!d.nhieu_dvt,
    vt_ton_kho: d.vt_ton_kho ?? true,
    lo_yn: !!d.lo_yn,
    kk_yn: !!d.kk_yn,
    gia_ton: n(d.gia_ton, 1),
    loai_vt: s(d.loai_vt),
    nh_vt1: s(d.nh_vt1),
    nh_vt2: s(d.nh_vt2),
    nh_vt3: s(d.nh_vt3),
    ma_kho: s(d.ma_kho),
    ma_vi_tri: s(d.ma_vi_tri),
    ma_thue: s(d.ma_thue),
    ma_thue_nk: s(d.ma_thue_nk),
    tk_vt: s(d.tk_vt),
    tk_gv: s(d.tk_gv),
    tk_dt: s(d.tk_dt),
    tk_dtnb: s(d.tk_dtnb),
    tk_tl: s(d.tk_tl),
    tk_dl: s(d.tk_dl),
    tk_spdd: s(d.tk_spdd),
    tk_cl_vt: s(d.tk_cl_vt),
    tk_ck: s(d.tk_ck),
    tk_cpbh: s(d.tk_cpbh),
    kieu_lo: n(d.kieu_lo, 1),
    cach_xuat: n(d.cach_xuat, 1),
    so_ngay_sp: n(d.so_ngay_sp),
    so_ngay_bh: n(d.so_ngay_bh),
    tao_lo: !!d.tao_lo,
    sl_min: n(d.sl_min),
    sl_max: n(d.sl_max),
    volume: n(d.volume),
    dvtvolume: s(d.dvtvolume),
    weight: n(d.weight),
    dvtweight: s(d.dvtweight),
    ghi_chu: s(d.ghi_chu),
    status: d.status || '1',
  };
}

export function HangHoaFormDialog({
  open,
  mode,
  maVt,
  onClose,
}: Props): JSX.Element | null {
  const ro = mode === 'view';
  const isCreate = mode === 'new' || mode === 'copy';
  const needDetail = open && mode !== 'new' && !!maVt;

  const { data: lkData } = useLookups();
  const { data: detail } = useHangHoaDetail(needDetail ? maVt : null);
  const create = useCreateHangHoa();
  const update = useUpdateHangHoa();

  const [form, setForm] = useState<HangHoaForm>(EMPTY_FORM);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab(0);
    setError('');
    if (mode === 'new') {
      setForm(EMPTY_FORM);
    } else if (detail) {
      const f = toForm(detail);
      setForm(mode === 'copy' ? { ...f, ma_vt: '' } : f);
    }
  }, [open, mode, detail]);

  const set: Setter = (k, v) =>
    setForm((p) => ({ ...p, [k]: v }) as HangHoaForm);

  const pending = create.isPending || update.isPending;
  const lk = lkData ?? EMPTY_LOOKUPS;

  function handleSave() {
    if (ro) return;
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));
    if (isCreate) {
      create.mutate(form, { onSuccess: onClose, onError });
    } else {
      update.mutate({ maVt: maVt as string, body: form }, { onSuccess: onClose, onError });
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: 'min(860px, 96vw)',
          // Cố định chiều cao theo tab lớn nhất -> không co giãn khi đổi tab.
          height: 'min(700px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 6px 28px rgba(0,0,0,0.28)',
          border: '1px solid #7abadd',
          borderRadius: 4,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: '#5b9bd5',
            color: 'white',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            borderRadius: '4px 4px 0 0',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13 }}>{TITLES[mode]}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: 0 }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Fixed fields: mã / tên / tên khác */}
        <div style={{ flexShrink: 0, padding: '8px 16px', borderBottom: '1px solid #e0e8f4' }}>
          <table style={tabTable}>
            <colgroup>
              <col style={{ width: 110 }} />
              <col />
            </colgroup>
            <tbody>
              <FRow label="Mã hàng" required>
                <input
                  value={form.ma_vt}
                  onChange={(e) => set('ma_vt', e.target.value.toUpperCase())}
                  disabled={ro || mode === 'edit'}
                  autoFocus
                  style={mode === 'edit' ? { ...fi, background: '#f0f0f0' } : fi}
                />
              </FRow>
              <FRow label="Tên hàng" required>
                <input value={form.ten_vt} onChange={(e) => set('ten_vt', e.target.value)} disabled={ro} style={fi} />
              </FRow>
              <FRow label="Tên khác">
                <input value={form.ten_vt2} onChange={(e) => set('ten_vt2', e.target.value)} disabled={ro} style={fi} />
              </FRow>
            </tbody>
          </table>
        </div>

        {/* Tab bar */}
        <div style={{ flexShrink: 0, display: 'flex', borderBottom: '2px solid #c8d4e0', background: '#f5f8fc' }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{
                padding: '6px 14px',
                border: 'none',
                fontSize: 12.5,
                fontWeight: tab === i ? 700 : 500,
                background: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                color: tab === i ? '#1a5fa8' : '#555',
                borderBottom: tab === i ? '2px solid #1a5fa8' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
          {tab === 0 && <TabThongTin form={form} set={set} ro={ro} lk={lk} />}
          {tab === 1 && <TabTaiKhoan form={form} set={set} ro={ro} />}
          {tab === 2 && <TabLo form={form} set={set} ro={ro} />}
          {tab === 3 && <TabKhac form={form} set={set} ro={ro} />}
          {error && (
            <div style={{ marginTop: 8, background: '#fff0f0', border: '1px solid #f5c0c0', color: '#c0392b', fontSize: 12, borderRadius: 3, padding: '5px 10px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '8px 16px', borderTop: '1px solid #c8d4e0', display: 'flex', gap: 8, background: '#f5f8fc', borderRadius: '0 0 4px 4px' }}>
          {!ro && (
            <button
              onClick={handleSave}
              disabled={pending}
              style={{ padding: '5px 18px', background: pending ? '#aaa' : '#4a9fd4', color: 'white', border: 'none', borderRadius: 3, fontWeight: 600, fontSize: 13, cursor: pending ? 'not-allowed' : 'pointer' }}
            >
              {pending ? 'Đang lưu...' : 'Lưu'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding: '5px 14px', background: 'white', color: '#333', border: '1px solid #b0c4d8', borderRadius: 3, fontSize: 13, cursor: 'pointer' }}
          >
            {ro ? 'Đóng' : 'Hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function FRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <tr>
      <td style={{ padding: '4px 8px 4px 0', fontSize: 13, color: '#333', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        {label}
        {required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
      </td>
      <td style={{ verticalAlign: 'middle', padding: '4px 0 4px 12px' }}>{children}</td>
    </tr>
  );
}

function SelectField({
  list,
  value,
  onChange,
  disabled,
}: {
  list: Lookup[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}): JSX.Element {
  const missing = value !== '' && !list.some((o) => o.value === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={fi}>
      <option value="">--</option>
      {missing && <option value={value}>{value}</option>}
      {list.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Tab 0: Thông tin chính ──────────────────────────────────────────────────
function TabThongTin({
  form,
  set,
  ro,
  lk,
}: {
  form: HangHoaForm;
  set: Setter;
  ro: boolean;
  lk: Lookups;
}): JSX.Element {
  const cbox = (k: keyof HangHoaForm, lbl: string): JSX.Element => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, cursor: ro ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} disabled={ro} />
      {lbl}
    </label>
  );
  return (
    <table style={tabTable}>
      <colgroup>
        <col style={{ width: 130 }} />
        <col />
      </colgroup>
      <tbody>
        <FRow label="Đơn vị tính" required>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <SelectField list={lk.dvtList} value={form.dvt} onChange={(v) => set('dvt', v)} disabled={ro} />
            </div>
            {cbox('nhieu_dvt', 'Nhiều đvt')}
          </div>
        </FRow>
        <FRow label="Đơn vị tính 2">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <SelectField list={lk.dvtList} value={form.dvt2} onChange={(v) => set('dvt2', v)} disabled={ro} />
            </div>
            {form.dvt2 && (
              <>
                <span style={{ fontSize: 12, color: '#666' }}>Hệ số:</span>
                <input
                  type="number"
                  value={form.he_so2}
                  onChange={(e) => set('he_so2', Number(e.target.value) || 1)}
                  disabled={ro}
                  style={{ ...fi, width: 80, textAlign: 'right' }}
                />
              </>
            )}
          </div>
        </FRow>
        <FRow label="">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {cbox('vt_ton_kho', 'Theo dõi tồn kho')}
            {cbox('lo_yn', 'Theo dõi lô')}
            {cbox('kk_yn', 'Theo dõi kiểm kê')}
          </div>
        </FRow>
        <FRow label="Cách tính giá">
          <select value={form.gia_ton} onChange={(e) => set('gia_ton', Number(e.target.value))} disabled={ro} style={fi}>
            <option value={1}>Giá trung bình</option>
            <option value={2}>Đích danh</option>
            <option value={3}>Nhập trước xuất trước (FIFO)</option>
            <option value={4}>Trung bình di động</option>
          </select>
        </FRow>
        <FRow label="Loại">
          <SelectField list={lk.loaiList} value={form.loai_vt} onChange={(v) => set('loai_vt', v)} disabled={ro} />
        </FRow>
        <FRow label="Nhóm hàng hóa 1">
          <SelectField list={lk.nh1List} value={form.nh_vt1} onChange={(v) => set('nh_vt1', v)} disabled={ro} />
        </FRow>
        <FRow label="Nhóm hàng hóa 2">
          <SelectField list={lk.nh2List} value={form.nh_vt2} onChange={(v) => set('nh_vt2', v)} disabled={ro} />
        </FRow>
        <FRow label="Nhóm hàng hóa 3">
          <SelectField list={lk.nh3List} value={form.nh_vt3} onChange={(v) => set('nh_vt3', v)} disabled={ro} />
        </FRow>
        <FRow label="Kho hàng">
          <SelectField list={lk.khoList} value={form.ma_kho} onChange={(v) => set('ma_kho', v)} disabled={ro} />
        </FRow>
        <FRow label="Vị trí">
          <input value={form.ma_vi_tri} onChange={(e) => set('ma_vi_tri', e.target.value)} disabled={ro} style={fi} />
        </FRow>
        <FRow label="Thuế giá GTGT">
          <SelectField list={lk.thueList} value={form.ma_thue} onChange={(v) => set('ma_thue', v)} disabled={ro} />
        </FRow>
        <FRow label="Thuế nhập khẩu">
          <SelectField list={lk.thuenkList} value={form.ma_thue_nk} onChange={(v) => set('ma_thue_nk', v)} disabled={ro} />
        </FRow>
      </tbody>
    </table>
  );
}

// ── Tab 1: Tài khoản ────────────────────────────────────────────────────────
const TK_FIELDS: [keyof HangHoaForm, string][] = [
  ['tk_vt', 'Tk kho'],
  ['tk_gv', 'Tk giá vốn'],
  ['tk_dt', 'Tk doanh thu'],
  ['tk_dtnb', 'Tk doanh thu nội bộ'],
  ['tk_tl', 'Tk hàng bán trả lại'],
  ['tk_dl', 'Tk đại lý'],
  ['tk_spdd', 'Tk sản phẩm dở dang'],
  ['tk_cl_vt', 'Tk chênh lệch giá vốn'],
  ['tk_ck', 'Tk chiết khấu'],
  ['tk_cpbh', 'Tk chi phí khuyến mãi'],
];

function TabTaiKhoan({ form, set, ro }: { form: HangHoaForm; set: Setter; ro: boolean }): JSX.Element {
  return (
    <table style={tabTable}>
      <colgroup>
        <col style={{ width: 170 }} />
        <col />
      </colgroup>
      <tbody>
        {TK_FIELDS.map(([k, lbl]) => (
          <FRow key={k} label={lbl}>
            <input
              value={String(form[k] ?? '')}
              onChange={(e) => set(k, e.target.value)}
              disabled={ro}
              style={fi}
              placeholder="Mã tk"
            />
          </FRow>
        ))}
      </tbody>
    </table>
  );
}

// ── Tab 2: Lô ───────────────────────────────────────────────────────────────
function TabLo({ form, set, ro }: { form: HangHoaForm; set: Setter; ro: boolean }): JSX.Element {
  return (
    <table style={tabTable}>
      <colgroup>
        <col style={{ width: 170 }} />
        <col />
      </colgroup>
      <tbody>
        <FRow label="Kiểu lô">
          <select value={form.kieu_lo} onChange={(e) => set('kieu_lo', Number(e.target.value))} disabled={ro} style={fi}>
            <option value={1}>1 - Tính theo ngày nhập</option>
            <option value={2}>2 - Ngày sử dụng</option>
          </select>
        </FRow>
        <FRow label="Cách xuất">
          <select value={form.cach_xuat} onChange={(e) => set('cach_xuat', Number(e.target.value))} disabled={ro} style={fi}>
            <option value={1}>1 - Theo hạn sử dụng</option>
            <option value={2}>2 - NTXT</option>
            <option value={3}>3 - Liên tục</option>
            <option value={4}>4 - NSXT</option>
          </select>
        </FRow>
        <FRow label="Vòng đời SP (ngày)">
          <input type="number" value={form.so_ngay_sp} onChange={(e) => set('so_ngay_sp', Number(e.target.value) || 0)} disabled={ro} style={fi} />
        </FRow>
        <FRow label="TG bảo hành (ngày)">
          <input type="number" value={form.so_ngay_bh} onChange={(e) => set('so_ngay_bh', Number(e.target.value) || 0)} disabled={ro} style={fi} />
        </FRow>
        <FRow label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, cursor: ro || !form.lo_yn ? 'default' : 'pointer' }}>
            <input type="checkbox" checked={form.tao_lo} onChange={(e) => set('tao_lo', e.target.checked)} disabled={ro || !form.lo_yn} />
            Cho phép tạo lô ngay khi nhập kho
          </label>
        </FRow>
      </tbody>
    </table>
  );
}

// ── Tab 3: Khác ─────────────────────────────────────────────────────────────
function TabKhac({ form, set, ro }: { form: HangHoaForm; set: Setter; ro: boolean }): JSX.Element {
  return (
    <table style={tabTable}>
      <colgroup>
        <col style={{ width: 170 }} />
        <col />
      </colgroup>
      <tbody>
        <FRow label="Số lượng tồn tối thiểu">
          <input type="number" value={form.sl_min} onChange={(e) => set('sl_min', Number(e.target.value) || 0)} disabled={ro} style={fi} />
        </FRow>
        <FRow label="Số lượng tồn tối đa">
          <input type="number" value={form.sl_max} onChange={(e) => set('sl_max', Number(e.target.value) || 0)} disabled={ro} style={fi} />
        </FRow>
        <FRow label="Thể tích">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" value={form.volume} onChange={(e) => set('volume', Number(e.target.value) || 0)} disabled={ro} style={{ ...fi, flex: 1 }} />
            <input value={form.dvtvolume} onChange={(e) => set('dvtvolume', e.target.value)} disabled={ro} style={{ ...fi, width: 80 }} placeholder="Đvt" />
          </div>
        </FRow>
        <FRow label="Khối lượng">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" value={form.weight} onChange={(e) => set('weight', Number(e.target.value) || 0)} disabled={ro} style={{ ...fi, flex: 1 }} />
            <input value={form.dvtweight} onChange={(e) => set('dvtweight', e.target.value)} disabled={ro} style={{ ...fi, width: 80 }} placeholder="Đvt" />
          </div>
        </FRow>
        <FRow label="Ghi chú">
          <textarea value={form.ghi_chu} onChange={(e) => set('ghi_chu', e.target.value)} disabled={ro} rows={4} style={{ ...fi, resize: 'vertical' }} />
        </FRow>
        <FRow label="Trạng thái">
          <select value={form.status} onChange={(e) => set('status', e.target.value)} disabled={ro} style={fi}>
            <option value="1">1 - Theo dõi</option>
            <option value="0">0 - Ngừng theo dõi</option>
          </select>
        </FRow>
      </tbody>
    </table>
  );
}
