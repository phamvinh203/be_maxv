import { useState, type JSX, type ReactNode } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import CompanySettingsPage from '@/pages/settings/CompanySettingsPage';
import EmployeesSettingsPage from '@/pages/settings/EmployeesSettingsPage';
import { useAuth } from '@/features/auth/hooks/useAuth';

/** Nội dung trang Cài đặt: chuyển giữa "Thêm công ty / MST" và "Nhân viên". */
export default function SettingsContent(): JSX.Element {
  // Chỉ OWNER mới tạo được công ty/MST -> nhân viên (OWNER_EMPLOYEE) không thấy tab này.
  const isOwner = useAuth().user?.role === 'OWNER';

  const tabs: { label: string; content: ReactNode }[] = [
    ...(isOwner
      ? [{ label: 'Thêm công ty / MST', content: <CompanySettingsPage /> }]
      : []),
    { label: 'Nhân viên', content: <EmployeesSettingsPage /> },
  ];

  const [tab, setTab] = useState(0);
  const active = tabs[tab] ?? tabs[0];

  return (
    <Box>
      {tabs.length > 1 && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', px: 2 }}>
          <Tabs value={tab} onChange={(_, v: number) => setTab(v)}>
            {tabs.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>
        </Box>
      )}

      {active.content}
    </Box>
  );
}
