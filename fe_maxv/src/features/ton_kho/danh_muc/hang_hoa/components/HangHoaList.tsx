import { useMemo, useState, type CSSProperties, type JSX } from 'react';
import { Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GridOnIcon from '@mui/icons-material/GridOn';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LockIcon from '@mui/icons-material/Lock';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import GridToolbar from '@/components/GridToolbar';
import DeleteDialog from '@/components/DeleteDialog';
import { getApiError } from '@/lib/apiClient';
import {
  useDeleteHangHoa,
  useHangHoaList,
} from '@/features/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';
import {
  COLS,
  GIA_TON,
  type HangHoa,
} from '@/features/ton_kho/danh_muc/hang_hoa/types';
import { HangHoaFormDialog, type FormMode } from './HangHoaFormDialog';
import { DoiMaDialog } from './DoiMaDialog';

const ICO = { fontSize: 15 } as const;

const th: CSSProperties = {
  padding: '4px 6px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 12,
  borderRight: '1px solid #c8d4e0',
  borderBottom: '1px solid #c8d4e0',
  whiteSpace: 'nowrap',
};
const td: CSSProperties = {
  padding: '3px 6px',
  borderRight: '1px solid #edf2f7',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 260,
};

/** Giá trị hiển thị 1 ô theo cột. */
function cellValue(row: HangHoa, key: keyof HangHoa): string {
  if (key === 'gia_ton') return GIA_TON[Number(row.gia_ton)] ?? String(row.gia_ton);
  if (key === 'he_so2') return row.dvt2 ? String(row.he_so2) : '—';
  if (key === 'dvt2') return row.dvt2 || '—';
  const v = (row as unknown as Record<string, unknown>)[key];
  return v == null || v === '' ? '' : String(v);
}

export function HangHoaList(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useHangHoaList({
    limit: 500,
  });
  const del = useDeleteHangHoa();

  const [selected, setSelected] = useState<HangHoa | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [form, setForm] = useState<{ open: boolean; mode: FormMode; maVt: string | null }>({
    open: false,
    mode: 'new',
    maVt: null,
  });
  const [doiMa, setDoiMa] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const allRows = useMemo(() => data?.data ?? [], [data]);

  // Lọc theo từng cột (client-side, giống maxv_v1).
  const rows = useMemo(() => {
    return allRows.filter((row) =>
      COLS.every((col) => {
        const f = filters[col.key]?.toLowerCase().trim();
        if (!f) return true;
        return cellValue(row, col.key).toLowerCase().includes(f);
      }),
    );
  }, [allRows, filters]);

  const sel = selected;
  const openForm = (mode: FormMode, maVt: string | null) =>
    setForm({ open: true, mode, maVt });

  function confirmDelete() {
    if (!sel) return;
    setActionError('');
    del.mutate(sel.ma_vt, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelected(null);
      },
      onError: (err) => setActionError(getApiError(err, 'Xóa thất bại.')),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white' }}>
      <GridToolbar
        actions={[
          { label: 'Mới', icon: <AddIcon sx={ICO} />, act: () => openForm('new', null) },
          { label: 'Sửa', icon: <EditIcon sx={ICO} />, act: () => sel && openForm('edit', sel.ma_vt), dis: !sel },
          { label: 'Copy', icon: <ContentCopyIcon sx={ICO} />, act: () => sel && openForm('copy', sel.ma_vt), dis: !sel },
          { label: 'Xóa', icon: <DeleteIcon sx={ICO} />, act: () => setDeleteOpen(true), dis: !sel, variant: 'danger' },
          { label: 'Đổi mã', icon: <SwapHorizIcon sx={ICO} />, act: () => sel && setDoiMa(sel.ma_vt), dis: !sel },
          { label: 'Xem', icon: <VisibilityIcon sx={ICO} />, act: () => sel && openForm('view', sel.ma_vt), dis: !sel },
          { label: 'Xuất Excel', icon: <GridOnIcon sx={ICO} />, act: () => {} },
          { label: 'Lấy dữ liệu từ tệp...', icon: <UploadFileIcon sx={ICO} />, act: () => {} },
          { label: 'Tải tệp mẫu...', icon: <FileDownloadIcon sx={ICO} />, act: () => {} },
          { label: 'Khóa cột', icon: <LockIcon sx={ICO} />, act: () => {} },
          { label: 'Làm tươi', icon: <RefreshIcon sx={ICO} />, act: () => void refetch() },
        ]}
      />

      {/* Info bar */}
      <div style={{ padding: '2px 10px', borderBottom: '1px solid #e8edf4', fontSize: 12, color: '#888', flexShrink: 0, background: '#fafcff' }}>
        Danh mục hàng hóa, vật tư &nbsp;·&nbsp;{' '}
        {isLoading ? 'đang tải…' : `${rows.length} mặt hàng`}
      </div>

      {(isError || actionError) && (
        <Alert severity="error" sx={{ m: 1, py: 0 }}>
          {actionError || getApiError(error, 'Không tải được danh sách.')}
        </Alert>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {COLS.map((c, i) => (
                <th
                  key={c.key}
                  style={{
                    ...th,
                    width: c.w,
                    background: '#dce8f5',
                    position: 'sticky',
                    top: 0,
                    zIndex: 3,
                    ...(i === 0 ? { minWidth: 90 } : {}),
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  style={{
                    ...th,
                    padding: '2px 4px',
                    fontWeight: 'normal',
                    background: '#fffde7',
                    position: 'sticky',
                    top: 27,
                    zIndex: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <SearchIcon sx={{ fontSize: 13, color: '#9bb3cc', flexShrink: 0 }} />
                    <input
                      value={filters[c.key] || ''}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, [c.key]: e.target.value }))
                      }
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 11, padding: '1px 0' }}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  Đang tải...
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>
                  Chưa có dữ liệu
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const isSel = sel?.ma_vt === row.ma_vt;
              const rowBg = isSel ? '#cce5ff' : idx % 2 === 0 ? 'white' : '#f5f9ff';
              return (
                <tr
                  key={row.ma_vt}
                  onClick={() => setSelected(isSel ? null : row)}
                  onDoubleClick={() => openForm('edit', row.ma_vt)}
                  style={{
                    background: rowBg,
                    cursor: 'pointer',
                    borderBottom: '1px solid #edf2f7',
                    color: row.status === '0' ? '#aaa' : '#222',
                  }}
                >
                  {COLS.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        ...td,
                        background: rowBg,
                        textAlign: c.align ?? 'left',
                        ...(c.key === 'ma_vt' ? { fontWeight: 600 } : {}),
                        ...(c.key === 'dvt2' && !row.dvt2 ? { color: '#ccc' } : {}),
                      }}
                    >
                      {cellValue(row, c.key)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <HangHoaFormDialog
        open={form.open}
        mode={form.mode}
        maVt={form.maVt}
        onClose={() => {
          setForm((f) => ({ ...f, open: false }));
          setSelected(null);
        }}
      />
      <DoiMaDialog
        open={doiMa !== null}
        maCu={doiMa ?? ''}
        onClose={() => {
          setDoiMa(null);
          setSelected(null);
        }}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa mã hàng"
        message={
          sel
            ? `Bạn có chắc chắn muốn xóa mã hàng "${sel.ma_vt} - ${sel.ten_vt}"? Hành động này không thể hoàn tác.`
            : ''
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
