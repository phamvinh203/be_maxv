import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { SetupCompanyForm } from '@/features/company/components/SetupCompanyForm';

/** Hiển thị khi user đã đăng nhập nhưng chưa gắn công ty (donViId null). */
export default function SetupCompanyPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader onLogout={() => navigate('/login')} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
        <SetupCompanyForm />
      </div>
    </div>
  );
}
