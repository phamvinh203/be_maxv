import { useState, type JSX } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { AddCompanyDialog } from '@/features/company/components/AddCompanyDialog';
import { useCompanies } from '@/features/company/hooks/useCompany';
import { getCurrentCompany } from '@/features/auth/hooks/useAuth';

/**
 * Cài đặt › Công ty / MST. Bảng công ty của tài khoản (kèm địa chỉ/SĐT/loại hình)
 * + dialog thêm MST mới (không chuyển trang — đổi qua Select MST trên header).
 */
export default function CompanySettingsPage(): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);
  const companiesQuery = useCompanies();
  const currentId = getCurrentCompany()?.id ?? null;

  const companies = companiesQuery.data ?? [];

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Công ty / MST
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Thêm công ty / MST
        </Button>
      </Stack>

      {companiesQuery.isLoading ? (
        <CircularProgress size={24} />
      ) : (
        <Paper elevation={0} variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tên công ty</TableCell>
                  <TableCell>Mã số thuế</TableCell>
                  <TableCell>Địa chỉ</TableCell>
                  <TableCell>Số điện thoại</TableCell>
                  <TableCell>Loại hình kinh doanh</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.id} hover selected={c.id === currentId}>
                    <TableCell>
                      <Box sx={{ fontWeight: 600 }}>{c.tenDonVi}</Box>
                      {c.id === currentId && (
                        <Chip label="Đang chọn" color="primary" size="small" sx={{ mt: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell>{c.maSoThue}</TableCell>
                    <TableCell>{c.diaChi ?? '—'}</TableCell>
                    <TableCell>{c.sdt ?? '—'}</TableCell>
                    <TableCell>{c.loaiHinhKinhDoanh ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {companies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      Chưa có công ty nào
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <AddCompanyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  );
}
