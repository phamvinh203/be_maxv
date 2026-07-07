import { type JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { SetupCompanyForm } from '@/features/company/components/SetupCompanyForm';
import { addCompanyToList, getCurrentCompany } from '@/features/auth/hooks/useAuth';
import { switchCompany } from '@/features/company/api/companyApi';
import { COMPANIES_QUERY_KEY } from '@/features/company/hooks/useCompany';
import { setToken } from '@/features/auth/token';
import type { RegisterCompanyResponse } from '@/features/company/types/company';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Dialog tạo thêm công ty/MST — KHÔNG chuyển trang, chỉ thêm MST vào danh sách. */
export function AddCompanyDialog({ open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();

  async function handleCreated(result: RegisterCompanyResponse): Promise<void> {
    // Thêm MST mới vào danh sách localStorage (để Select header thấy) — không đổi công ty đang chọn.
    addCompanyToList(result.company);

    // POST /companies đã tự switch (đổi cả refresh cookie) sang MST mới -> switch ngược
    // về MST hiện tại để phiên đứng yên; chỉ đổi khi người dùng chọn trên Select header.
    const current = getCurrentCompany();
    if (current) {
      const res = await switchCompany(current.id);
      setToken(res.accessToken);
    }

    // Làm mới bảng công ty (nguồn từ GET /companies).
    queryClient.invalidateQueries({ queryKey: COMPANIES_QUERY_KEY });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Thêm công ty / MST</DialogTitle>
      <DialogContent sx={{ pt: '8px !important', pb: 3 }}>
        <SetupCompanyForm
          heading=""
          description="Nhập thông tin để tạo thêm một công ty (mã số thuế). Sau khi tạo, chọn công ty ở ô chọn MST trên thanh tiêu đề để chuyển sang làm việc."
          submitLabel="THÊM CÔNG TY"
          maxWidth="100%"
          onCreated={handleCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
