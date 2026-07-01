import { useState, type JSX } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useCompanyInvites, useEmployees } from '@/features/company/hooks/useCompany';
import { EmployeesTable } from '@/features/company/components/EmployeesTable';
import { PendingInvitesTable } from '@/features/company/components/PendingInvitesTable';
import { InviteEmployeeDialog } from '@/features/company/components/InviteEmployeeDialog';
import { getUser } from '@/features/auth/token';

export default function EmployeesSettingsPage(): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);
  const employeesQuery = useEmployees();
  const invitesQuery = useCompanyInvites();
  const isOwner = getUser()?.role === 'OWNER';

  return (
    <Box sx={{ p: 3, maxWidth: 960 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Nhân viên
        </Typography>
        {isOwner && (
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Thêm nhân viên
          </Button>
        )}
      </Stack>

      {employeesQuery.isLoading ? (
        <CircularProgress size={24} />
      ) : (
        <EmployeesTable employees={employeesQuery.data ?? []} />
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
        Danh sách chờ duyệt
      </Typography>

      {invitesQuery.isLoading ? (
        <CircularProgress size={24} />
      ) : (
        <PendingInvitesTable invites={invitesQuery.data ?? []} />
      )}

      <InviteEmployeeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  );
}
