import type { JSX } from 'react';
import logo from '../assets/Logo-Maxv.png';

export default function AppHeader(): JSX.Element {
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

      {/* Avatar tĩnh (chưa nối logic người dùng) */}
      <div
        style={{
          width: 26, height: 26, borderRadius: '50%', background: '#4ab3f4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'white',
        }}
      >
        K
      </div>
    </header>
  );
}
