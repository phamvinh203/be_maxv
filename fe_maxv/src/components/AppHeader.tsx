import { useEffect, useRef, useState, type JSX } from 'react';
import logo from '../assets/Logo-Maxv.png';
import { getUser } from '@/features/auth/token';
import { useLogout } from '@/features/auth/hooks/useAuth';

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
  const [menuOpen, setMenuOpen] = useState(false);
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
