import { useState, type ChangeEvent, type FormEvent, type JSX } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useRegisterCompany } from '@/features/company/hooks/useCompany';
import { attachCompanyToSession, getCurrentUser } from '@/features/auth/hooks/useAuth';
import { getApiError, refreshAccessToken } from '@/lib/apiClient';
import { MODULE_ORDER } from '@/config/modules';

const MST_REGEX = /^[0-9]{10}(-[0-9]{3})?$/;
const PHONE_REGEX = /^[0-9]{9,11}$/;

type Field = 'tenCongTy' | 'maSoThue' | 'diaChi' | 'sdt' | 'loaiHinhKinhDoanh';

const EMPTY_FORM: Record<Field, string> = {
  tenCongTy: '',
  maSoThue: '',
  diaChi: '',
  sdt: '',
  loaiHinhKinhDoanh: '',
};

export function SetupCompanyForm(): JSX.Element {
  const navigate = useNavigate();
  const { mutate, isPending } = useRegisterCompany();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState('');

  function set(field: Field) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setFieldErrors((er) => {
        const n = { ...er };
        delete n[field];
        return n;
      });
    };
  }

  function validate(): Partial<Record<Field, string>> {
    const e: Partial<Record<Field, string>> = {};
    if (!form.tenCongTy.trim()) e.tenCongTy = 'Vui lòng nhập tên công ty';
    if (!MST_REGEX.test(form.maSoThue.trim())) e.maSoThue = 'Mã số thuế không hợp lệ (10 số, có thể kèm -XXX chi nhánh)';
    if (!form.diaChi.trim()) e.diaChi = 'Vui lòng nhập địa chỉ';
    if (form.sdt && !PHONE_REGEX.test(form.sdt.trim())) e.sdt = 'Số điện thoại không hợp lệ (9-11 số)';
    return e;
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    setServerError('');
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      setServerError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
      return;
    }

    mutate(
      {
        userId: user.id,
        tenCongTy: form.tenCongTy.trim(),
        maSoThue: form.maSoThue.trim(),
        diaChi: form.diaChi.trim(),
        ...(form.sdt.trim() ? { sdt: form.sdt.trim() } : {}),
        ...(form.loaiHinhKinhDoanh.trim()
          ? { loaiHinhKinhDoanh: form.loaiHinhKinhDoanh.trim() }
          : {}),
      },
      {
        onSuccess: async (result) => {
          attachCompanyToSession({
            id: result.id,
            maSoThue: result.maSoThue,
            slug: result.slug,
            tenDonVi: result.tenDonVi,
            status: result.status,
          });
          // JWT hiện tại vẫn mang donViId cũ (null) vì ký lúc login trước khi có công ty.
          await refreshAccessToken();
          navigate(`/${result.slug}/${MODULE_ORDER[0].slug}`, { replace: true });
        },
        onError: (err) =>
          setServerError(getApiError(err, 'Tạo công ty thất bại. Vui lòng thử lại.')),
      },
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 460 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
        Thông tin công ty
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#64748b', mb: 3 }}>
        Nhập mã số thuế để khởi tạo dữ liệu kế toán riêng cho công ty của bạn.
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {serverError && <Alert severity="error">{serverError}</Alert>}
          <TextField
            label="Tên công ty"
            required
            fullWidth
            autoFocus
            value={form.tenCongTy}
            onChange={set('tenCongTy')}
            placeholder="Công ty TNHH ABC"
            error={!!fieldErrors.tenCongTy}
            helperText={fieldErrors.tenCongTy}
          />
          <TextField
            label="Mã số thuế"
            required
            fullWidth
            value={form.maSoThue}
            onChange={set('maSoThue')}
            placeholder="0101234567"
            error={!!fieldErrors.maSoThue}
            helperText={fieldErrors.maSoThue}
          />
          <TextField
            label="Địa chỉ"
            required
            fullWidth
            value={form.diaChi}
            onChange={set('diaChi')}
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
            error={!!fieldErrors.diaChi}
            helperText={fieldErrors.diaChi}
          />
          <TextField
            label="Số điện thoại công ty"
            fullWidth
            value={form.sdt}
            onChange={set('sdt')}
            placeholder="0901234567"
            error={!!fieldErrors.sdt}
            helperText={fieldErrors.sdt}
          />
          <TextField
            label="Loại hình kinh doanh"
            fullWidth
            value={form.loaiHinhKinhDoanh}
            onChange={set('loaiHinhKinhDoanh')}
            placeholder="Công ty TNHH, cổ phần, hộ kinh doanh..."
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isPending}
            sx={{ height: 44, fontWeight: 700 }}
          >
            {isPending ? <CircularProgress size={22} sx={{ color: 'white' }} /> : 'TẠO CÔNG TY'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
