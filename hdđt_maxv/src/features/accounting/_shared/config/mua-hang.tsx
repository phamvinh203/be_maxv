import type { ModuleConfig } from './types'

export const muaHangConfig: ModuleConfig = {
  title: 'Mua hàng',

  chungTu: [
    { label: 'Hóa đơn mua hàng trong nước',            path: '/mua-hang/hd-trong-nuoc',       icon: <IcoHDTrongNuoc /> },
    { label: 'Hóa đơn mua hàng nhập khẩu',             path: '/mua-hang/hd-nhap-khau',        icon: <IcoHDNhapKhau /> },
    { label: 'Hóa đơn nhập mua - xuất thẳng',          path: '/mua-hang/hd-nhap-xuat-thang',  icon: <IcoNhapXuatThang /> },
    { label: 'Phiếu nhận chi phí mua hàng',            path: '/mua-hang/phi-mua-hang',        icon: <IcoPhiMuaHang /> },
    { label: 'Phiếu xuất trả lại nhà cung cấp',        path: '/mua-hang/xuat-tra-lai-ncc',    icon: <IcoXuatTraLai /> },
    { label: 'Phiếu nhập điều chỉnh giá hàng mua',     path: '/mua-hang/dieu-chinh-gia',      icon: <IcoXuatTraLai /> },
    { label: 'Hóa đơn mua hàng dịch vụ',               path: '/mua-hang/hd-dich-vu',          icon: <IcoHDDichVu /> },
    { label: 'Hóa đơn dịch vụ trả lại NCC',            path: '/mua-hang/dv-tra-lai-ncc',      icon: <IcoHDTraLaiNCC /> },
    { label: 'Bù trừ công nợ',                          path: '/mua-hang/bu-tru-cong-no',      icon: <IcoBuTru /> },
    { label: 'Phân bổ tiền trả cho các hóa đơn',       path: '/mua-hang/phan-bo-tien-tra',    icon: <IcoPhanBoTien /> },
    { label: 'Phân bổ tiền trả tự động cho hóa đơn',   path: '/mua-hang/phan-bo-tu-dong',     icon: <IcoPhanBoTD /> },
    { label: 'Tất toán cho các hóa đơn',               path: '/mua-hang/tat-toan',            icon: <IcoTatToan /> },
    { label: 'Đánh giá CLTG cho các hóa đơn',          path: '/mua-hang/danh-gia-cltg',       icon: <IcoCLTG /> },
  ],

  danhMuc: [
    { left:  { label: 'Danh mục nhà cung cấp',                       path: '/mua-hang/dm/nha-cung-cap' },
      right: { label: 'Danh mục phân nhóm nhà cung cấp',             path: '/mua-hang/dm/phan-nhom-ncc' } },
    { left:  { label: 'Danh mục hợp đồng',                           path: '/mua-hang/dm/hop-dong' },
      right: { label: 'Danh mục nhóm hợp đồng',                      path: '/mua-hang/dm/nhom-hop-dong' } },
    { left:  { label: 'Danh mục chi phí',                            path: '/mua-hang/dm/chi-phi' },
      right: { label: 'Nhập số dư ban đầu Nhà cung cấp',             path: '/mua-hang/dm/so-du-ncc' } },
    { left:  { label: 'Nhập số dư ban đầu hóa đơn',                  path: '/mua-hang/dm/so-du-hoa-don' },
      right: { label: 'Nhập số dư ban đầu hợp đồng',                  path: '/mua-hang/dm/so-du-hop-dong' } },
    { left:  { label: 'Kết chuyển số dư hợp đồng sang năm sau',      path: '/mua-hang/dm/ket-chuyen-hop-dong' } },
  ],

  baoCao: [
    { items: [
      'Sổ chi tiết công nợ',
      'Bảng cân đối phát sinh công nợ (một tài khoản)',
      'Bảng cân đối phát sinh công nợ (nhiều tài khoản)',
      'Sổ đối chiếu công nợ',
      'Bảng xác nhận công nợ',
      'Bảng tổng hợp số dư công nợ',
    ]},
    { items: [
      'Sổ chi tiết công nợ (nhiều nhà cung cấp)',
      'Sổ đối chiếu công nợ (nhiều nhà cung cấp)',
      'Bảng xác nhận nợ (nhiều nhà cung cấp)',
    ]},
    { items: [
      'Bảng kê hóa đơn mua hàng',
      'Bảng kê phiếu xuất trả lại nhà cung cấp',
      'Bảng kê hóa đơn mua hàng, dịch vụ',
    ]},
    { items: [
      'Tổng hợp hàng nhập mua',
      'Tổng hợp hàng xuất trả lại nhà cung cấp',
    ]},
    { items: [
      'Bảng kê chứng từ theo hợp đồng',
      'Sổ chi tiết hợp đồng',
      'Bảng cân đối phát sinh theo hợp đồng',
      'Bảng tổng hợp số dư hợp đồng',
    ]},
    { items: [
      'Bảng kê công nợ phải trả theo hóa đơn',
      'Bảng kê chi tiết trả tiền cho các hóa đơn',
      'Bảng kê chi tiết trả tiền của các hóa đơn có CLTG',
      'Bảng kê công nợ của các hóa đơn theo hạn thanh toán',
      'Báo cáo các hóa đơn sắp đến hạn thanh toán',
      'In bút toán tất toán số dư cho các hóa đơn',
    ]},
    { items: [
      'In hóa đơn mua hàng trong nước',
      'In hóa đơn mua hàng nhập khẩu',
      'In hóa đơn nhập mua - xuất thẳng',
    ]},
  ],
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IcoHDTrongNuoc() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="8" y="8" width="48" height="14" rx="3" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="2"/>
      <text x="32" y="19" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a5fa8">INVOICE</text>
      <line x1="16" y1="30" x2="48" y2="30" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="37" x2="48" y2="37" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="44" x2="36" y2="44" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="46" cy="48" r="8" fill="#e8f5e9" stroke="#388e3c" strokeWidth="1.5"/>
      <path d="M42 48l3 3 5-5" stroke="#388e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IcoHDNhapKhau() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="8" y="8" width="48" height="14" rx="3" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="2"/>
      <text x="32" y="19" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a5fa8">INVOICE</text>
      <line x1="16" y1="30" x2="48" y2="30" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="37" x2="48" y2="37" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="44" x2="36" y2="44" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M36 52l8-8M44 52l-8-8" stroke="#f57c00" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="40" cy="48" r="8" fill="#fff3e0" stroke="#f57c00" strokeWidth="1.5"/>
      <text x="40" y="51" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#f57c00">NK</text>
    </svg>
  )
}

function IcoNhapXuatThang() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="4" y="10" width="24" height="30" rx="2" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="1.5"/>
      <rect x="36" y="10" width="24" height="30" rx="2" fill="#e8f5e9" stroke="#388e3c" strokeWidth="1.5"/>
      <text x="16" y="22" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#1a5fa8">NHẬP</text>
      <text x="48" y="22" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#388e3c">XUẤT</text>
      <line x1="12" y1="28" x2="24" y2="28" stroke="#2a7abf" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="12" y1="33" x2="24" y2="33" stroke="#2a7abf" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="40" y1="28" x2="56" y2="28" stroke="#388e3c" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="40" y1="33" x2="56" y2="33" stroke="#388e3c" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M28 25h8M32 21l4 4-4 4" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="32" y="52" textAnchor="middle" fontSize="7" fill="#555">Xuất thẳng</text>
    </svg>
  )
}

function IcoPhiMuaHang() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="8" width="44" height="48" rx="3" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <rect x="18" y="8" width="28" height="10" rx="2" fill="#ffe082" stroke="#f57c00" strokeWidth="1.5"/>
      <line x1="16" y1="26" x2="48" y2="26" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="33" x2="48" y2="33" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="40" x2="36" y2="40" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="40" cy="46" r="8" fill="#fff3e0" stroke="#f57c00" strokeWidth="1.5"/>
      <text x="40" y="49" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#f57c00">$</text>
    </svg>
  )
}

function IcoXuatTraLai() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="8" width="44" height="48" rx="3" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <rect x="18" y="8" width="28" height="10" rx="2" fill="#ef9a9a" stroke="#c62828" strokeWidth="1.5"/>
      <line x1="16" y1="26" x2="48" y2="26" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="33" x2="48" y2="33" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="40" x2="36" y2="40" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M34 50l-8-6h5v-6h6v6h5z" fill="#c62828" opacity=".8"/>
    </svg>
  )
}

function IcoHDDichVu() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#f3e5f5" stroke="#7b1fa2" strokeWidth="2"/>
      <rect x="8" y="8" width="48" height="14" rx="3" fill="#e1bee7" stroke="#7b1fa2" strokeWidth="2"/>
      <text x="32" y="19" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#7b1fa2">INVOICE</text>
      <circle cx="24" cy="36" r="8" fill="#f3e5f5" stroke="#7b1fa2" strokeWidth="1.5"/>
      <path d="M20 36c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4" stroke="#7b1fa2" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="24" cy="36" r="2" fill="#7b1fa2"/>
      <line x1="36" y1="32" x2="50" y2="32" stroke="#7b1fa2" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="38" x2="50" y2="38" stroke="#7b1fa2" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="44" x2="44" y2="44" stroke="#7b1fa2" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IcoHDTraLaiNCC() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <rect x="8" y="8" width="48" height="14" rx="3" fill="#ffcdd2" stroke="#c62828" strokeWidth="2"/>
      <text x="27" y="19" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#c62828">DEBT</text>
      <line x1="16" y1="30" x2="48" y2="30" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="37" x2="48" y2="37" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="44" x2="36" y2="44" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M42 52l-8-8h5v-8h6v8h5z" fill="#c62828" opacity=".8"/>
    </svg>
  )
}

function IcoBuTru() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="20" cy="26" r="14" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <circle cx="44" cy="38" r="14" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <text x="20" y="30" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#2a7abf">$</text>
      <text x="44" y="42" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#c62828">$</text>
      <path d="M28 30l8 4" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="28" x2="38" y2="36" stroke="#555" strokeWidth="1" strokeDasharray="3 2"/>
    </svg>
  )
}

function IcoPhanBoTien() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="18" r="10" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <text x="32" y="22" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#388e3c">$</text>
      <path d="M24 26l-10 16M32 28v16M40 26l10 16" stroke="#388e3c" strokeWidth="2" strokeLinecap="round"/>
      <rect x="6" y="42" width="12" height="10" rx="2" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
      <rect x="26" y="44" width="12" height="10" rx="2" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
      <rect x="46" y="42" width="12" height="10" rx="2" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
    </svg>
  )
}

function IcoPhanBoTD() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="18" r="10" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <text x="32" y="22" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#388e3c">$</text>
      <path d="M24 26l-10 16M32 28v16M40 26l10 16" stroke="#388e3c" strokeWidth="2" strokeLinecap="round"/>
      <rect x="6" y="42" width="12" height="10" rx="2" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
      <rect x="26" y="44" width="12" height="10" rx="2" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
      <rect x="46" y="42" width="12" height="10" rx="2" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
      <circle cx="52" cy="14" r="8" fill="#fff3e0" stroke="#f57c00" strokeWidth="1.5"/>
      <path d="M48 14l2 2 4-4" stroke="#f57c00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IcoTatToan() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <line x1="16" y1="24" x2="48" y2="24" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="32" x2="48" y2="32" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="40" x2="48" y2="40" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="50" x2="56" y2="50" stroke="#2a7abf" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M22 16l4 4 8-8" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IcoCLTG() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="6" y="14" width="22" height="28" rx="3" fill="#e3f2fd" stroke="#1565c0" strokeWidth="2"/>
      <rect x="36" y="14" width="22" height="28" rx="3" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <text x="17" y="31" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1565c0">VND</text>
      <text x="47" y="31" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#f57c00">USD</text>
      <path d="M28 24h8M32 20l4 4-4 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 48l32-8" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="16" cy="48" r="3" fill="#e67e22"/>
      <circle cx="48" cy="40" r="3" fill="#e67e22"/>
    </svg>
  )
}
