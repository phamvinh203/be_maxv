import type { ModuleConfig } from './types'

export const heThongConfig: ModuleConfig = {
  title:      'Hệ thống',

  chungTu: [
    { label: 'Ngày bắt đầu năm tài chính',  path: '/he-thong/nam-tai-chinh',    icon: <IcoNamTaiChinh /> },
    { label: 'Ngày bắt đầu nhập liệu',       path: '/he-thong/ngay-nhap-lieu',   icon: <IcoNgayNhapLieu /> },
    { label: 'Thời gian nhập liệu',           path: '/he-thong/thoi-gian-nhap',   icon: <IcoThoiGian /> },
    { label: 'Thông tin công ty',             path: '/he-thong/thong-tin-cong-ty',icon: <IcoCongTy /> },
    { label: 'Màn hình nhập chứng từ',        path: '/he-thong/man-hinh-nhap',    icon: <IcoManHinh /> },
    { label: 'Đánh lại số chứng từ',          path: '/he-thong/danh-lai-so',      icon: <IcoDanhLaiSo /> },
    { label: 'Tham số tùy chọn',              path: '/he-thong/tham-so',          icon: <IcoThamSo /> },
    { label: 'Khai báo tài khoản HĐDT',       path: '/he-thong/tai-khoan-hddt',   icon: <IcoHDDT /> },
  ],

  danhMuc: [
    { left:  { label: 'Danh mục quyền chứng từ',                         path: '/he-thong/danh_muc/quyen-chung-tu' },
      right: { label: 'Phân quyền NSD quyền chứng từ',                   path: '/he-thong/danh_muc/phan-quyen-nsd' } },
    { left:  { label: 'Khóa số liệu',                                    path: '/he-thong/danh_muc/khoa-so-lieu' },
      right: { label: 'Khóa số liệu theo đơn vị',                        path: '/he-thong/danh_muc/khoa-so-lieu-don-vi' } },
    { left:  { label: 'Khóa số liệu theo chứng từ',                      path: '/he-thong/danh_muc/khoa-so-lieu-chung-tu' },
      right: { label: 'Kiểm tra số liệu giữa sổ tài khoản và sổ kho',    path: '/he-thong/danh_muc/kiem-tra-so-kho' } },
    { left:  { label: 'Kiểm tra số liệu giữa sổ tài khoản và sổ thuế',   path: '/he-thong/danh_muc/kiem-tra-so-thue' },
      right: { label: 'Kiểm tra khai báo mẫu bảng cân đối kế toán',      path: '/he-thong/danh_muc/kiem-tra-bang-can-doi' } },
  ],

  baoCao: [
    { items: ['Khai báo người sử dụng'] },
    { items: ['Phân quyền truy cập', 'Phân quyền truy cập theo đơn vị cơ sở', 'Phân quyền truy cập theo kho'] },
    { items: ['Giới hạn quyền truy cập', 'Giới hạn quyền truy cập theo đơn vị', 'Giới hạn quyền truy cập trạng thái chứng từ'] },
    { items: ['Giới hạn địa chỉ truy cập', 'Giới hạn địa chỉ truy cập của người sử dụng'] },
    { items: ['Danh sách người sử dụng đang thực hiện chương trình', 'Nhật ký người sử dụng'] },
  ],
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IcoNamTaiChinh() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="12" width="48" height="42" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="8" y="12" width="48" height="12" rx="3" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="2"/>
      <line x1="20" y1="6" x2="20" y2="18" stroke="#2a7abf" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="44" y1="6" x2="44" y2="18" stroke="#2a7abf" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="16" y="30" width="8" height="7" rx="1" fill="#b8d9f5"/>
      <rect x="28" y="30" width="8" height="7" rx="1" fill="#b8d9f5"/>
      <rect x="40" y="30" width="8" height="7" rx="1" fill="#2a7abf"/>
      <rect x="16" y="42" width="8" height="7" rx="1" fill="#b8d9f5"/>
      <rect x="28" y="42" width="8" height="7" rx="1" fill="#b8d9f5"/>
      <text x="44" y="48" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">1</text>
    </svg>
  )
}

function IcoNgayNhapLieu() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="12" width="48" height="42" rx="3" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <rect x="8" y="12" width="48" height="12" rx="3" fill="#a5d6a7" stroke="#388e3c" strokeWidth="2"/>
      <line x1="20" y1="6" x2="20" y2="18" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="44" y1="6" x2="44" y2="18" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="32" cy="42" r="10" fill="#c8e6c9" stroke="#388e3c" strokeWidth="1.5"/>
      <path d="M32 36v6l4 3" stroke="#388e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IcoThoiGian() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="34" r="20" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <circle cx="32" cy="34" r="2.5" fill="#f57c00"/>
      <path d="M32 22v12l8 5" stroke="#f57c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 10h20M32 10v6" stroke="#f57c00" strokeWidth="2" strokeLinecap="round"/>
      <line x1="32" y1="14" x2="32" y2="18" stroke="#f57c00" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IcoCongTy() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="22" width="44" height="34" rx="2" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <path d="M20 22V14h24v8" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="18" y="32" width="8" height="8" rx="1" fill="#2a7abf"/>
      <rect x="30" y="32" width="8" height="8" rx="1" fill="#2a7abf"/>
      <rect x="42" y="32" width="8" height="8" rx="1" fill="#2a7abf"/>
      <rect x="26" y="44" width="12" height="12" rx="1" fill="#2a7abf"/>
      <line x1="32" y1="10" x2="32" y2="14" stroke="#2a7abf" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function IcoManHinh() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="6" y="10" width="52" height="36" rx="3" fill="#f3e5f5" stroke="#7b1fa2" strokeWidth="2"/>
      <rect x="10" y="14" width="44" height="28" rx="1" fill="#e1bee7"/>
      <line x1="24" y1="46" x2="40" y2="46" stroke="#7b1fa2" strokeWidth="2" strokeLinecap="round"/>
      <line x1="32" y1="46" x2="32" y2="54" stroke="#7b1fa2" strokeWidth="2" strokeLinecap="round"/>
      <line x1="22" y1="54" x2="42" y2="54" stroke="#7b1fa2" strokeWidth="2" strokeLinecap="round"/>
      <rect x="16" y="20" width="14" height="10" rx="1" fill="#ce93d8" stroke="#7b1fa2" strokeWidth="1"/>
      <rect x="34" y="20" width="14" height="4" rx="1" fill="#ba68c8"/>
      <rect x="34" y="27" width="14" height="4" rx="1" fill="#ba68c8"/>
    </svg>
  )
}

function IcoDanhLaiSo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="32" r="22" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <path d="M20 32a12 12 0 0 1 12-12" stroke="#c62828" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M44 32a12 12 0 0 1-12 12" stroke="#c62828" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M16 28l4 4 4-4" stroke="#c62828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M48 36l-4-4-4 4" stroke="#c62828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="32" y="36" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#c62828">123</text>
    </svg>
  )
}

function IcoThamSo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="32" r="10" fill="#e8f0fa" stroke="#1565c0" strokeWidth="2"/>
      <circle cx="32" cy="32" r="4" fill="#1565c0"/>
      <path d="M32 10v8M32 46v8M10 32h8M46 32h8" stroke="#1565c0" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M17 17l5.5 5.5M41.5 41.5L47 47M17 47l5.5-5.5M41.5 22.5L47 17" stroke="#1565c0" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function IcoHDDT() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="8" width="36" height="46" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="18" y="8" width="20" height="10" rx="2" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="1.5"/>
      <line x1="16" y1="26" x2="38" y2="26" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="33" x2="38" y2="33" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="40" x2="28" y2="40" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="48" cy="46" r="10" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <path d="M43 46l3 3 6-6" stroke="#388e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
