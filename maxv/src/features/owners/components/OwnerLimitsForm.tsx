import { useState, type FormEvent, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { formatLimit } from '@/lib/format';
import { useSetOwnerLimits } from '@/features/owners/hooks/useOwners';
import type { Limits } from '@/features/owners/types/owner';

interface Props {
  ownerId: string;
  gioiHan: Limits; // hiệu lực (override ?? gói)
  override: Limits; // riêng phần admin đặt
  hasSubscription: boolean;
}

/** '' -> null (xóa override, theo gói); số -> đặt trần. */
function parse(v: string): number | null {
  const t = v.trim();
  return t === '' ? null : Number(t);
}

export function OwnerLimitsForm({
  ownerId,
  gioiHan,
  override,
  hasSubscription,
}: Props): JSX.Element {
  const [mst, setMst] = useState(override.soMstToiDa?.toString() ?? '');
  const [nguoi, setNguoi] = useState(override.soNguoiToiDa?.toString() ?? '');
  const { mutate, isPending, isError, isSuccess, error } =
    useSetOwnerLimits(ownerId);

  function submit(e: FormEvent): void {
    e.preventDefault();
    mutate({
      soMstToiDaOverride: parse(mst),
      soNguoiToiDaOverride: parse(nguoi),
    });
  }

  if (!hasSubscription) {
    return (
      <Alert severity="info">
        Tài khoản chưa có gói (chưa tạo công ty nào) — chưa thể đặt trần riêng.
      </Alert>
    );
  }

  return (
    <Stack component="form" onSubmit={submit} spacing={2}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
        Trần hiệu lực hiện tại: <b>MST {formatLimit(gioiHan.soMstToiDa)}</b> ·{' '}
        <b>Nhân viên {formatLimit(gioiHan.soNguoiToiDa)}</b>. Bỏ trống để dùng
        theo gói.
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          type="number"
          label="Trần MST (override)"
          value={mst}
          onChange={(e) => setMst(e.target.value)}
          placeholder="theo gói"
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 200 }}
        />
        <TextField
          type="number"
          label="Trần nhân viên (override)"
          value={nguoi}
          onChange={(e) => setNguoi(e.target.value)}
          placeholder="theo gói"
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 200 }}
        />
      </Stack>

      <Box>
        <Button type="submit" variant="contained" disabled={isPending}>
          {isPending ? 'Đang lưu…' : 'Lưu trần'}
        </Button>
      </Box>

      {isSuccess && <Alert severity="success">Đã cập nhật trần.</Alert>}
      {isError && (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Cập nhật thất bại'}
        </Alert>
      )}
    </Stack>
  );
}
