import { useRef, type JSX, type ReactNode } from 'react';

export interface ToolbarAction {
  label: string;
  act: () => void;
  dis?: boolean;
  variant?: 'default' | 'danger';
  /** Icon (vd @mui/icons-material) đặt trước label; bỏ trống thì chỉ render text. */
  icon?: ReactNode;
}

interface Props {
  actions: ToolbarAction[];
}

/**
 * Thanh công cụ dạng lưới (dày, cuộn ngang, kéo để cuộn) — dùng chung cho các
 * màn hình danh mục. Icon do caller truyền vào (MUI icons).
 */
export default function GridToolbar({ actions }: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  function onPointerDown(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = {
      down: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  }
  function endDrag() {
    drag.current.down = false;
  }
  // Nếu vừa kéo thì nuốt click để nút không bị bấm nhầm giữa lúc cuộn.
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      drag.current.moved = false;
    }
  }

  return (
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onClickCapture={onClickCapture}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '5px 8px',
        borderBottom: '1px solid #c8d4e0',
        background: '#f5f8fc',
        flexShrink: 0,
        flexWrap: 'nowrap',
        overflowX: 'auto',
        overflowY: 'hidden',
        cursor: 'grab',
        scrollbarWidth: 'thin',
      }}
    >
      {actions.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.act}
          disabled={!!btn.dis}
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 500,
            background: btn.dis ? '#f0f0f0' : 'white',
            color: btn.dis
              ? '#aaa'
              : btn.variant === 'danger'
                ? '#c62828'
                : '#333',
            border: '1px solid',
            borderColor: btn.dis
              ? '#ddd'
              : btn.variant === 'danger'
                ? '#f5c0c0'
                : '#b0c4d8',
            borderRadius: 3,
            cursor: btn.dis ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {btn.icon && (
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>
              {btn.icon}
            </span>
          )}
          {btn.label}
        </button>
      ))}
    </div>
  );
}
