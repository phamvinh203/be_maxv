import { type JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { SetupCompanyForm } from '@/features/company/components/SetupCompanyForm';
import { addCompanyToList } from '@/features/auth/hooks/useAuth';
import { COMPANIES_QUERY_KEY } from '@/features/company/hooks/useCompany';
import type { RegisterCompanyResponse } from '@/features/company/types/company';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog tạo thêm công ty/MST — KHÔNG chuyển trang, chỉ thêm MST vào danh sách.
 * activate=false: backend KHÔNG đụng tới token/refresh cookie hiện tại, nên phiên
 * đứng yên ở MST đang làm việc mà không cần switch-back (tránh cửa sổ đua tenant).
 */
export function AddCompanyDialog({ open, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();

  function handleCreated(result: RegisterCompanyResponse): void {
    // Thêm MST mới vào danh sách localStorage (để Select header thấy).
    addCompanyToList(result.company);
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
          activate={false}
          onCreated={handleCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
