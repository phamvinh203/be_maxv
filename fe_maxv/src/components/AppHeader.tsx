import { useEffect, useRef, useState, type ChangeEvent, type JSX } from 'react';
import logo from '../assets/Logo-Maxv.png';
import { getUser, setCompany, setToken } from '@/features/auth/token';
import {
  useLogout,
  getCurrentCompany,
  getCurrentCompanies,
} from '@/features/auth/hooks/useAuth';
import { switchCompany } from '@/features/company/api/companyApi';

interface Props {
  onLogout: () => void;
  onSettings?: () => void;
}

function getInitial(hoTen: string | undefined): string {
  const trimmed = hoTen?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export default function AppHeader({ onLogout, onSettings }: Props): JSX.Element {
  const user = getUser();
  const companies = getCurrentCompanies();
  const currentCompany = getCurrentCompany();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const logoutMutation = useLogout();

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    logoutMutation.mutate(undefined, { onSettled: onLogout });
  }

  function handleSettings() {
    setMenuOpen(false);
    onSettings?.();
  }

  /**
   * Đổi MST đang làm việc: switch token (để tenant DB resolve đúng), lưu công ty,
   * rồi thay slug trên URL và full reload (xóa sạch cache dữ liệu của MST cũ).
   */
  async function handleChangeCompany(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!currentCompany || id === currentCompany.id) return;
    const target = companies.find((c) => c.id === id);
    if (!target) return;

    setSwitching(true);
    try {
      const res = await switchCompany(id);
      setToken(res.accessToken);
      setCompany(target);
      // Giữ nguyên path sau :slug, chỉ thay MST (slug) rồi tải lại toàn trang.
      const rest = window.location.pathname.split('/').slice(2).join('/');
      window.location.assign(`/${target.slug}${rest ? `/${rest}` : ''}`);
    } catch {
      setSwitching(false);
    }
  }

  return (
    <header
      style={{
        height: 48,
        flexShrink: 0,
        zIndex: 10,
        background: 'linear-gradient(90deg,#1a3a5c 0%,#1e5799 100%)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <img
          src={logo}
          alt="Maxv"
          width={80}
          height={32}
          style={{ display: 'block', mixBlendMode: 'screen', filter: 'brightness(1.6)' }}
        />
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
      </div>

      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>
        Kế toán tổng hợp
      </span>

      {/* Đổi MST: chỉ hiện Select khi tài khoản có nhiều MST; 1 MST -> nhãn tĩnh. */}
      {companies.length > 1 ? (
        <>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
          <select
            value={currentCompany?.id ?? ''}
            onChange={handleChangeCompany}
            disabled={switching}
            title="Chọn công ty (MST) đang làm việc"
            style={{
              height: 30,
              maxWidth: 340,
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 6,
              padding: '0 10px',
              fontSize: 13,
              fontWeight: 600,
              cursor: switching ? 'wait' : 'pointer',
              outline: 'none',
            }}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id} style={{ color: '#0f172a' }}>
                {c.maSoThue} — {c.tenDonVi}
              </option>
            ))}
          </select>
        </>
      ) : (
        currentCompany && (
          <>
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
              {currentCompany.maSoThue} — {currentCompany.tenDonVi}
            </span>
          </>
        )
      )}

      <div style={{ flex: 1 }} />

      {user && (
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
          {user.hoTen}
        </span>
      )}

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title={user?.hoTen ?? 'Chưa đăng nhập'}
          style={{
            width: 26, height: 26, borderRadius: '50%', background: '#4ab3f4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
            border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          {getInitial(user?.hoTen)}
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: 160,
              background: 'white',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              overflow: 'hidden',
              zIndex: 20,
            }}
          >
            <button
              type="button"
              onClick={handleSettings}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', fontSize: 13, color: '#1a3a5c',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Cài đặt
            </button>
            <div style={{ height: 1, background: '#e5e7eb' }} />
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', fontSize: 13, color: '#dc2626',
                background: 'none', border: 'none',
                cursor: logoutMutation.isPending ? 'default' : 'pointer',
                opacity: logoutMutation.isPending ? 0.6 : 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {logoutMutation.isPending ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
