import { useState, type JSX } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import {
  useCreatePlan,
  useUpdatePlan,
} from '@/features/subscriptions/hooks/useSubscriptions';
import type { Plan } from '@/features/subscriptions/types/subscription';

interface Props {
  open: boolean;
  plan: Plan | null; // null = tạo mới
  onClose: () => void;
}

export function PlanFormDialog({ open, plan, onClose }: Props): JSX.Element {
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const isEdit = plan !== null;
  const pending = create.isPending || update.isPending;
  const isError = create.isError || update.isError;

  // Init trực tiếp từ plan; component được mount mới mỗi lần mở (key ở parent)
  // nên state luôn tươi — không cần useEffect đồng bộ.
  const [ma, setMa] = useState(plan?.ma ?? '');
  const [ten, setTen] = useState(plan?.ten ?? '');
  const [gia, setGia] = useState(plan?.gia ?? '0');
  const [chuKyThang, setChuKyThang] = useState(plan ? String(plan.chuKyThang) : '1');
  const [soMstToiDa, setSoMstToiDa] = useState(
    plan?.soMstToiDa != null ? String(plan.soMstToiDa) : '',
  );
  const [soNguoiToiDa, setSoNguoiToiDa] = useState(
    plan?.soNguoiToiDa != null ? String(plan.soNguoiToiDa) : '',
  );
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);

  function handleSubmit(): void {
    const soMst = soMstToiDa.trim() === '' ? null : Number(soMstToiDa);
    const soNguoi = soNguoiToiDa.trim() === '' ? null : Number(soNguoiToiDa);
    if (isEdit && plan) {
      update.mutate(
        {
          id: plan.id,
          input: {
            ten,
            gia: Number(gia),
            chuKyThang: Number(chuKyThang),
            soMstToiDa: soMst,
            soNguoiToiDa: soNguoi,
            isActive,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        {
          ma,
          ten,
          gia: Number(gia),
          chuKyThang: Number(chuKyThang),
          soMstToiDa: soMst,
          soNguoiToiDa: soNguoi,
          isActive,
        },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isEdit ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {isError && <Alert severity="error">Không lưu được gói (mã trùng?)</Alert>}
          <TextField
            label="Mã gói"
            value={ma}
            onChange={(e) => setMa(e.target.value.toUpperCase())}
            disabled={isEdit}
            fullWidth
            helperText={isEdit ? 'Không đổi mã gói' : 'VD: BASIC, PRO'}
          />
          <TextField
            label="Tên gói"
            value={ten}
            onChange={(e) => setTen(e.target.value)}
            fullWidth
          />
          <TextField
            label="Giá (VNĐ)"
            type="number"
            value={gia}
            onChange={(e) => setGia(e.target.value)}
            fullWidth
          />
          <TextField
            label="Chu kỳ (tháng)"
            type="number"
            value={chuKyThang}
            onChange={(e) => setChuKyThang(e.target.value)}
            helperText="0 = gói dùng thử"
            fullWidth
          />
          <TextField
            label="Số MST (công ty) tối đa"
            type="number"
            value={soMstToiDa}
            onChange={(e) => setSoMstToiDa(e.target.value)}
            helperText="Số công ty/MST tài khoản được tạo; để trống = không giới hạn"
            fullWidth
          />
          <TextField
            label="Số nhân viên tối đa"
            type="number"
            value={soNguoiToiDa}
            onChange={(e) => setSoNguoiToiDa(e.target.value)}
            helperText="Để trống = không giới hạn"
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            }
            label="Đang bán"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={pending || !ma || !ten}
        >
          {pending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
