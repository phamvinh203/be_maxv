import { useState, type JSX } from 'react';
import { MODULE_ORDER } from './config';

interface Props {
  active: string;
  onSelect: (slug: string) => void;
}

// RVW-N10: mỗi trang Kế toán dựng lại toàn bộ cây (không dùng layout route + Outlet dùng
// chung), nên AppSidebar unmount/mount lại mỗi lần điều hướng và mất state React thường.
// Đổi kiến trúc sang layout route chạm tới 11 page wrapper + AppRouter (rủi ro/lan rộng hơn
// mức cần cho đúng 1 finding non-blocking) — thay vào đó lưu trạng thái thu gọn ra
// localStorage để nó sống sót qua remount, đây cũng là pattern sẵn có trong repo
// (xem `theme/displaySettings.ts`).
const EXPANDED_KEY = 'hddt_accounting_sidebar_expanded';

function loadExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) !== '0';
  } catch {
    return true;
  }
}

function saveExpanded(v: boolean): void {
  try {
    localStorage.setItem(EXPANDED_KEY, v ? '1' : '0');
  } catch {
    // localStorage không khả dụng (vd Safari private mode) — bỏ qua, chỉ mất persist.
  }
}

export default function AppSidebar({ active, onSelect }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(loadExpanded);

  return (
    <aside
      style={{
        width: expanded ? 90 : 40,
        minWidth: expanded ? 90 : 40,
        flexShrink: 0,
        background: '#e8edf2',
        borderRight: '1px solid #c8d4e0',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.18s ease, min-width 0.18s ease',
      }}
    >
      <button
        type="button"
        aria-label={expanded ? 'Thu gọn menu' : 'Mở rộng menu'}
        onClick={() =>
          setExpanded((v) => {
            const next = !v;
            saveExpanded(next);
            return next;
          })
        }
        style={{
          width: '100%', height: 40, minHeight: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#d0dce8', color: '#2a5080',
          border: 'none', borderBottom: '1px solid #c8d4e0',
          cursor: 'pointer', fontSize: 18, lineHeight: 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#bccfe0')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#d0dce8')}
      >
        {'☰'}
      </button>

      {expanded &&
        MODULE_ORDER.map((m) => {
          const isActive = m.slug === active;
          return (
            <button
              key={m.slug}
              onClick={() => onSelect(m.slug)}
              style={{
                width: '100%', padding: '10px 4px',
                fontSize: 12.5, fontWeight: isActive ? 700 : 500,
                background: isActive ? '#2a7abf' : 'transparent',
                color: isActive ? 'white' : '#2a5080',
                border: 'none', borderBottom: '1px solid #c8d4e0',
                cursor: 'pointer', textAlign: 'center', lineHeight: 1.3,
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = '#d0dce8';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {m.title}
            </button>
          );
        })}
    </aside>
  );
}
