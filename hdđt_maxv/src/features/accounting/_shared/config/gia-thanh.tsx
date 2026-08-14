import type { ModuleConfig } from './types'

export const giaThanhConfig: ModuleConfig = {
  title: 'Giá thành',

  chungTu: [
    { label: 'Định mức nguyên vật liệu',                   path: '/gia-thanh/dinh-muc-nvl',          icon: <IcoDinhMuc /> },
    { label: 'Lệnh sản xuất',                               path: '/gia-thanh/lenh-san-xuat',         icon: <IcoLenhSX /> },
    { label: 'Khai báo hệ số phân bổ',                     path: '/gia-thanh/he-so-phan-bo',         icon: <IcoHeSoPhanBo /> },
    { label: 'Khai báo vật tư thay thế',                   path: '/gia-thanh/vat-tu-thay-the',       icon: <IcoVatTuTT /> },
    { label: 'Khai báo đối tượng nhận phân bổ chi phí',    path: '/gia-thanh/doi-tuong-phan-bo',     icon: <IcoDoiTuong /> },
    { label: 'Nhập kiểm kê vật tư cuối kỳ',               path: '/gia-thanh/kiem-ke-vat-tu',        icon: <IcoKiemKe /> },
    { label: 'Nhập số lượng sản phẩm dở dang cuối kỳ',    path: '/gia-thanh/sl-sp-do-dang',         icon: <IcoDoDang /> },
    { label: 'Tính giá thành',                              path: '/gia-thanh/tinh-gia-thanh',        icon: <IcoTinhGT /> },
  ],

  danhMuc: [
    { left:  { label: 'Danh mục yếu tố',                                             path: '/gia-thanh/dm/yeu-to' },
      right: { label: 'Danh mục loại yếu tố',                                        path: '/gia-thanh/dm/loai-yeu-to' } },
    { left:  { label: 'Danh mục nhóm yếu tố',                                        path: '/gia-thanh/dm/nhom-yeu-to' },
      right: { label: 'Danh mục công đoạn',                                           path: '/gia-thanh/dm/cong-doan' } },
    { left:  { label: 'Nhập số lượng sản phẩm dở dang đầu kỳ',                      path: '/gia-thanh/dm/sl-sp-do-dang-dk' },
      right: { label: 'Nhập giá trị dở dang đầu kỳ theo yếu tố chi phí',            path: '/gia-thanh/dm/gt-do-dang-dk' } },
    { left:  { label: 'Nhập vật tư dở dang đầu kỳ',                                 path: '/gia-thanh/dm/vt-do-dang-dk' },
      right: { label: 'Điều chỉnh số lượng sản phẩm dở dang đầu kỳ',               path: '/gia-thanh/dm/dc-sl-do-dang-dk' } },
    { left:  { label: 'Điều chỉnh giá trị dở dang đầu kỳ theo yếu tố chi phí',     path: '/gia-thanh/dm/dc-gt-do-dang-dk' },
      right: { label: 'Điều chỉnh vật tư dở dang đầu kỳ',                           path: '/gia-thanh/dm/dc-vt-do-dang-dk' } },
  ],

  baoCao: [
    { items: [
      'Thẻ giá thành sản phẩm',
      'Báo cáo giá thành sản phẩm theo nhóm yếu tố',
      'Báo cáo tổng hợp giá thành sản phẩm',
    ]},
    { items: [
      'Báo cáo giá thành chi tiết theo vật tư',
      'Báo cáo tổng hợp chi phí sản xuất theo sản phẩm',
      'Báo cáo tổng hợp chi phí sản xuất theo yếu tố',
      'Báo cáo so sánh NVL thực tế và định mức theo sản phẩm',
    ]},
    { items: [
      'Báo cáo số lượng sản phẩm theo loại yếu tố',
      'Bảng tập hợp chi phí phát sinh trong kỳ',
      'Bảng phân bổ chi phí theo định mức NVL',
      'Bảng phân bổ chi phí theo hệ số cập nhật',
      'Bảng phân bổ chi phí theo số lượng sản phẩm sản xuất',
      'Bảng phân bổ chi phí theo yếu tố chi phí khác',
      'Báo cáo chi phí NVL kiểm kê cuối kỳ',
      'Bảng định mức sản phẩm',
    ]},
    { items: [
      'Chứng từ chưa nhập theo đối tượng tập hợp chi phí',
      'Vật tư xuất sản xuất nhưng chưa khai báo định mức',
      'Vật tư có khai báo định mức nhưng các thành phần không sản xuất',
      'Kiểm tra đối tượng tính giá thành trong phiếu xuất và phiếu nhập',
      'Các yếu tố có DĐDK hoặc phát sinh nhưng không có DDCK và nhập kho',
      'Các yếu tố không phân bổ được trong kỳ',
    ]},
    { items: [
      'Thành phẩm nhập kho sai với thành phẩm trong lệnh sản xuất',
      'Lệnh sản xuất có DĐDK - không nhập TP nhưng khai báo kết lệnh',
      'Các lệnh sản xuất đã kết thúc kỳ trước nhưng vẫn có phát sinh',
    ]},
  ],
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IcoDinhMuc() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="8" y="8" width="48" height="12" rx="3" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="2"/>
      <text x="32" y="19" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a5fa8">ĐỊNH MỨC</text>
      <line x1="16" y1="28" x2="30" y2="28" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="34" x2="48" y2="34" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="40" x2="48" y2="40" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="46" x2="40" y2="46" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="34" y="22" width="14" height="10" rx="1" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="1"/>
      <text x="41" y="30" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a5fa8">NVL</text>
    </svg>
  )
}

function IcoLenhSX() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="6" width="34" height="44" rx="3" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <rect x="18" y="6" width="18" height="8" rx="2" fill="#ffe082" stroke="#f57c00" strokeWidth="1.5"/>
      <line x1="16" y1="22" x2="38" y2="22" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="28" x2="38" y2="28" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="34" x2="30" y2="34" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="46" cy="46" r="12" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <path d="M40 46l4 4 8-8" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IcoHeSoPhanBo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="6" y="10" width="52" height="40" rx="3" fill="#f3e5f5" stroke="#7b1fa2" strokeWidth="2"/>
      <line x1="6" y1="26" x2="58" y2="26" stroke="#7b1fa2" strokeWidth="1.5"/>
      <line x1="22" y1="10" x2="22" y2="50" stroke="#7b1fa2" strokeWidth="1" strokeDasharray="3 2"/>
      <line x1="40" y1="10" x2="40" y2="50" stroke="#7b1fa2" strokeWidth="1" strokeDasharray="3 2"/>
      <text x="14" y="21" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#7b1fa2">Yếu tố</text>
      <text x="31" y="21" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#7b1fa2">Hệ số</text>
      <text x="49" y="21" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#7b1fa2">Tỷ lệ</text>
      <rect x="9" y="29" width="10" height="6" rx="1" fill="#ce93d8"/>
      <rect x="25" y="29" width="12" height="6" rx="1" fill="#ba68c8"/>
      <rect x="43" y="29" width="12" height="6" rx="1" fill="#ab47bc"/>
      <rect x="9" y="38" width="10" height="6" rx="1" fill="#ce93d8"/>
      <rect x="25" y="38" width="12" height="6" rx="1" fill="#ba68c8"/>
      <rect x="43" y="38" width="12" height="6" rx="1" fill="#ab47bc"/>
    </svg>
  )
}

function IcoVatTuTT() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="6" y="16" width="22" height="32" rx="2" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="36" y="16" width="22" height="32" rx="2" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <text x="17" y="35" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a5fa8">VT A</text>
      <text x="47" y="35" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#388e3c">VT B</text>
      <path d="M28 30h8M32 26l4 4-4 4" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="32" cy="10" r="5" fill="#fff3e0" stroke="#f57c00" strokeWidth="1.5"/>
      <text x="32" y="13" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#f57c00">↔</text>
    </svg>
  )
}

function IcoDoiTuong() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="18" r="8" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <circle cx="16" cy="46" r="7" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <circle cx="32" cy="46" r="7" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <circle cx="48" cy="46" r="7" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <path d="M28 25l-10 14M32 26v12M36 25l10 14" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <text x="32" y="22" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#f57c00">CP</text>
    </svg>
  )
}

function IcoKiemKe() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="10" width="36" height="46" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <line x1="16" y1="22" x2="36" y2="22" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="29" x2="36" y2="29" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="36" x2="36" y2="36" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="43" x2="28" y2="43" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="48" cy="46" r="12" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <path d="M42 46l4 4 8-8" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IcoDoDang() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="6" y="24" width="52" height="32" rx="3" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <rect x="14" y="30" width="10" height="20" rx="1" fill="#ffe082" stroke="#f57c00" strokeWidth="1"/>
      <rect x="28" y="36" width="10" height="14" rx="1" fill="#ffcc02" stroke="#f57c00" strokeWidth="1"/>
      <rect x="42" y="34" width="10" height="16" rx="1" fill="#ffe082" stroke="#f57c00" strokeWidth="1"/>
      <path d="M10 24l10-12h8l6 6 8-10h8l6 16" fill="#fff8e1" stroke="#f57c00" strokeWidth="1.5" strokeLinejoin="round"/>
      <text x="32" y="58" textAnchor="middle" fontSize="7" fill="#e65100">Cuối kỳ</text>
    </svg>
  )
}

function IcoTinhGT() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="8" width="44" height="48" rx="3" fill="#e8f0fa" stroke="#1565c0" strokeWidth="2"/>
      <rect x="16" y="14" width="14" height="10" rx="1" fill="#b8d9f5" stroke="#1565c0" strokeWidth="1"/>
      <rect x="34" y="14" width="14" height="10" rx="1" fill="#b8d9f5" stroke="#1565c0" strokeWidth="1"/>
      <rect x="16" y="28" width="14" height="10" rx="1" fill="#b8d9f5" stroke="#1565c0" strokeWidth="1"/>
      <rect x="34" y="28" width="14" height="10" rx="1" fill="#fff3e0" stroke="#f57c00" strokeWidth="1"/>
      <text x="41" y="36" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#f57c00">=</text>
      <rect x="16" y="42" width="32" height="8" rx="1" fill="#1565c0"/>
      <text x="32" y="48" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">GIÁ THÀNH</text>
    </svg>
  )
}
