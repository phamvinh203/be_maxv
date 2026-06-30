import type { ModuleConfig } from './types'

export const tienConfig: ModuleConfig = {
  title: 'Tiền',

  chungTu: [
    { label: 'Giấy báo có',     path: '/tien/chung_tu/giay-bao-co',   icon: <IcoGiayBaoCo /> },
    { label: 'Giấy báo nợ',     path: '/tien/chung_tu/giay-bao-no',   icon: <IcoGiayBaoNo /> },
    { label: 'Phiếu thu',        path: '/tien/chung_tu/phieu-thu',      icon: <IcoPhieuThu /> },
    { label: 'Phiếu chi',        path: '/tien/chung_tu/phieu-chi',      icon: <IcoPhieuChi /> },
    { label: 'Tỷ giá ghi sổ',   path: '/tien/chung_tu/ty-gia-ghi-so', icon: <IcoTyGia /> },
  ],

  danhMuc: [
    { left:  { label: 'Danh mục khế ước',                       path: '/tien/dm/khe-uoc' },
      right: { label: 'Danh mục tài khoản ngân hàng',           path: '/tien/dm/tai-khoan-ngan-hang' } },
    { left:  { label: 'Vào số dư ban đầu khế ước',              path: '/tien/dm/so-du-khe-uoc' },
      right: { label: 'Kết chuyển số dư khế ước sang năm sau',  path: '/tien/dm/ket-chuyen-khe-uoc' } },
  ],

  baoCao: [
    { items: ['Sổ quỹ', 'Sổ quỹ (in từng ngày)', 'Sổ tiền gửi ngân hàng', 'Báo cáo số dư tại quỹ và ngân hàng'] },
    { items: ['Sổ nhật ký thu tiền (C)', 'Sổ nhật ký chi tiền', 'Bảng cân đối phát sinh theo ngày'] },
    { items: ['Bảng kê danh sách các khế ước', 'Bảng kê chứng từ theo khế ước', 'Bảng cân đối phát sinh theo khế ước', 'Bảng kê tính lãi chi tiết khế ước', 'Báo cáo chi tiết tình hình tiền vay', 'Báo cáo tổng hợp tình hình tiền vay', 'Báo cáo theo dõi thời gian thanh toán các khoản vay'] },
    { items: ['In Phiếu thu tiền mặt', 'In Phiếu chi tiền mặt', 'In Giấy báo có', 'In Giấy báo nợ'] },
  ],
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IcoGiayBaoCo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="8" width="44" height="48" rx="3" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <rect x="18" y="8" width="28" height="10" rx="2" fill="#a5d6a7" stroke="#388e3c" strokeWidth="1.5"/>
      <line x1="18" y1="26" x2="46" y2="26" stroke="#388e3c" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="33" x2="46" y2="33" stroke="#388e3c" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="40" x2="36" y2="40" stroke="#388e3c" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="42" cy="48" r="8" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
      <path d="M38 48l3 3 5-5" stroke="#388e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IcoGiayBaoNo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="8" width="44" height="48" rx="3" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <rect x="18" y="8" width="28" height="10" rx="2" fill="#ef9a9a" stroke="#c62828" strokeWidth="1.5"/>
      <line x1="18" y1="26" x2="46" y2="26" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="33" x2="46" y2="33" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="40" x2="36" y2="40" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="42" cy="48" r="8" fill="#ffcdd2" stroke="#c62828" strokeWidth="1.5"/>
      <line x1="39" y1="45" x2="45" y2="51" stroke="#c62828" strokeWidth="2" strokeLinecap="round"/>
      <line x1="45" y1="45" x2="39" y2="51" stroke="#c62828" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function IcoPhieuThu() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="14" width="48" height="36" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="8" y="14" width="48" height="12" rx="3" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="2"/>
      <text x="32" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1a5fa8">PHIẾU THU</text>
      <circle cx="24" cy="38" r="7" fill="#fff3e0" stroke="#f57c00" strokeWidth="1.5"/>
      <text x="24" y="41" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#f57c00">$</text>
      <line x1="36" y1="34" x2="50" y2="34" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="39" x2="50" y2="39" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="44" x2="44" y2="44" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 54h44" stroke="#2a7abf" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 2"/>
    </svg>
  )
}

function IcoPhieuChi() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="14" width="48" height="36" rx="3" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <rect x="8" y="14" width="48" height="12" rx="3" fill="#ffe082" stroke="#f57c00" strokeWidth="2"/>
      <text x="32" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#e65100">PHIẾU CHI</text>
      <circle cx="24" cy="38" r="7" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="1.5"/>
      <text x="24" y="41" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#2a7abf">$</text>
      <line x1="36" y1="34" x2="50" y2="34" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="39" x2="50" y2="39" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="44" x2="44" y2="44" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 54h44" stroke="#f57c00" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 2"/>
    </svg>
  )
}

function IcoTyGia() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="6" y="14" width="22" height="28" rx="3" fill="#e3f2fd" stroke="#1565c0" strokeWidth="2"/>
      <rect x="36" y="14" width="22" height="28" rx="3" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <text x="17" y="31" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1565c0">VND</text>
      <text x="47" y="31" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#c62828">USD</text>
      <path d="M28 24h8M32 20l4 4-4 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M36 36h-8M32 40l-4-4 4-4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 48l32-8" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2"/>
      <circle cx="16" cy="48" r="3" fill="#e67e22"/>
      <circle cx="48" cy="40" r="3" fill="#e67e22"/>
    </svg>
  )
}
