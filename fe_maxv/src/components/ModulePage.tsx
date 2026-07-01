import { useState, useEffect, type JSX, type ReactNode } from 'react';
import type { ModuleConfig } from '../config/modules/types';

interface Props {
  config: ModuleConfig;
  onNavigate?: (path: string) => void;
}

type Tab = 'chungTu' | 'danhMuc' | 'baoCao';

const TABS: { key: Tab; label: string }[] = [
  { key: 'chungTu', label: 'Chứng từ' },
  { key: 'danhMuc', label: 'Danh mục' },
  { key: 'baoCao', label: 'Báo cáo' },
];

export default function ModulePage({ config, onNavigate }: Props): JSX.Element {
  const go = (path: string) => onNavigate?.(path);
  const [tab, setTab] = useState<Tab>('chungTu');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0f4f8', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #dce6f0', padding: '10px 14px 0' }}>
          <div style={{ display: 'flex', gap: 4, background: '#eef3f9', borderRadius: 10, padding: 4 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1, padding: '8px 6px', border: 'none', borderRadius: 7, cursor: 'pointer',
                  fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                  background: tab === t.key ? 'linear-gradient(135deg,#2a7abf,#1e5799)' : 'transparent',
                  color: tab === t.key ? 'white' : '#5a7a9a',
                  boxShadow: tab === t.key ? '0 2px 8px rgba(42,122,191,0.3)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ height: 10 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'chungTu' && (
            <div style={{ padding: '14px 12px 20px' }}>
              <SectionLabel>Chứng từ</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 10 }}>
                {config.chungTu.map((ct) => (
                  <button key={ct.path} onClick={() => go(ct.path)} style={mobileIconBtn}>
                    <div style={{ width: 48, height: 48 }}>{ct.icon}</div>
                    <span style={{ fontSize: 11, color: '#2a5080', lineHeight: 1.3, fontWeight: 600, textAlign: 'center' }}>
                      {ct.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'danhMuc' && (
            <div style={{ padding: '14px 0 20px' }}>
              <div style={{ padding: '0 14px' }}><SectionLabel>Danh mục</SectionLabel></div>
              {config.danhMuc.map((row, i) => (
                <div key={i}>
                  <MobileLink label={row.left.label} onClick={() => go(row.left.path)} />
                  {row.right && <MobileLink label={row.right.label} onClick={() => go(row.right!.path)} />}
                </div>
              ))}
            </div>
          )}

          {tab === 'baoCao' && (
            <div style={{ padding: '14px 0 20px' }}>
              <div style={{ padding: '0 14px' }}><SectionLabel>Báo cáo</SectionLabel></div>
              {config.baoCao.map((group, gi) => (
                <div key={gi} style={{ marginBottom: 4 }}>
                  {group.items.map((item) => (
                    <MobileLink key={item} label={item} icon={<IcoReport />} onClick={() => {}} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f0f4f8' }}>
      {/* Trái: Chứng từ + Danh mục */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, borderRight: '1px solid #c8d4e0', overflow: 'hidden' }}>
        <div style={{ background: 'white', borderBottom: '2px solid #c8d4e0', padding: '12px 16px', flexShrink: 0 }}>
          <SectionTitle>Chứng từ</SectionTitle>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill,minmax(92px,1fr))' }}>
            {config.chungTu.map((ct) => (
              <button
                key={ct.path}
                onClick={() => go(ct.path)}
                style={iconBtnStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f7ff';
                  e.currentTarget.style.borderColor = '#2a7abf';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(42,122,191,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#dde6f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ width: 52, height: 52 }}>{ct.icon}</div>
                <span style={{ fontSize: 11.5, color: '#2a5080', lineHeight: 1.3, fontWeight: 500 }}>{ct.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#fafcff', padding: '12px 16px' }}>
          <SectionTitle>Danh mục</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {config.danhMuc.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e8edf4' }}>
                  <td style={{ width: '50%', padding: '5px 6px' }}>
                    <LinkBtn label={row.left.label} onClick={() => go(row.left.path)} />
                  </td>
                  <td style={{ width: '50%', padding: '5px 6px' }}>
                    {row.right && <LinkBtn label={row.right.label} onClick={() => go(row.right!.path)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phải: Báo cáo */}
      <div style={{ width: 280, minWidth: 280, background: 'white', overflowY: 'auto' }}>
        <div style={{ padding: '10px 14px', borderBottom: '2px solid #c8d4e0', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
          Báo cáo
        </div>
        {config.baoCao.map((group, gi) => (
          <div key={gi} style={{ borderBottom: '1px solid #e8edf4' }}>
            {group.items.map((item) => (
              <button
                key={item}
                style={reportBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <IcoReport />
                {item}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: ReactNode }): JSX.Element {
  return <div style={{ fontSize: 10.5, fontWeight: 800, color: '#7a98b8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>{children}</div>;
}
function SectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>{children}</div>;
}
function MobileLink({ label, onClick, icon }: { label: string; onClick: () => void; icon?: ReactNode }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: 'none', borderBottom: '1px solid #edf3f9', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, color: '#1a5fa8', fontWeight: 500 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f2f7fd')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
    >
      {icon ?? <IcoDoc />}
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#aac4e0' }}>›</span>
    </button>
  );
}
function LinkBtn({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#1a5fa8', textAlign: 'left', padding: '2px 4px', borderRadius: 3, width: '100%' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fa')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      <IcoDoc />
      {label}
    </button>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 12px', width: '100%', background: 'white', border: '1px solid #dde6f0', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
};
const mobileIconBtn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 8px', background: 'white', border: '1px solid #dde6f0', borderRadius: 12, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};
const reportBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#1a5fa8', textAlign: 'left',
};

function IcoDoc(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="4" y="2" width="16" height="20" rx="2" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="1.5" />
      <line x1="8" y1="8" x2="16" y2="8" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="16" x2="13" y2="16" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IcoReport(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#e8f0fa" stroke="#2a7abf" strokeWidth="1.5" />
      <line x1="7" y1="9" x2="17" y2="9" stroke="#2a7abf" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="13" x2="17" y2="13" stroke="#2a7abf" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="17" x2="13" y2="17" stroke="#2a7abf" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
