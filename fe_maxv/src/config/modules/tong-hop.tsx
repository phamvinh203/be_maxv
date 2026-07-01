import type { ModuleConfig } from './types'

export const tongHopConfig: ModuleConfig = {
  title: 'Tổng hợp',

  chungTu: [
    { label: 'Phiếu kế toán',                    path: '/tong_hop/phieu-ke-toan',        icon: <IcoPhieuKeToan /> },
    { label: 'Bút toán kết chuyển tự động',       path: '/tong_hop/ket-chuyen-td',        icon: <IcoKetChuyen /> },
    { label: 'Bút toán phân bổ tự động',          path: '/tong_hop/phan-bo-td',           icon: <IcoPhanBoTD /> },
    { label: 'Bút toán phân bổ định kỳ',          path: '/tong_hop/phan-bo-dk',           icon: <IcoPhanBoDK /> },
    { label: 'Bút toán chênh lệch tỷ giá',        path: '/tong_hop/chenh-lech-ty-gia',    icon: <IcoChenhLech /> },
    { label: 'Xóa dữ liệu',                       path: '/tong_hop/xoa-du-lieu',          icon: <IcoXoaDL /> },
  ],

  danhMuc: [
    { left:  { label: 'Danh mục tài khoản',                          path: '/tong_hop/danh_muc/tai-khoan' },
      right: { label: 'Danh mục tiền tệ',                            path: '/tong_hop/danh_muc/tien-te' } },
    { left:  { label: 'Danh mục phòng ban',                          path: '/tong_hop/danh_muc/phong-ban' },
      right: { label: 'Danh mục phí',                                path: '/tong_hop/danh_muc/phi' } },
    { left:  { label: 'Danh mục nhóm phí',                           path: '/tong_hop/danh_muc/nhom-phi' },
      right: { label: 'Nhập số dư ban đầu tài khoản',                path: '/tong_hop/danh_muc/so-du-ban-dau' } },
    { left:  { label: 'Chuyển số dư tài khoản sang năm sau',         path: '/tong_hop/danh_muc/chuyen-so-du' },
      right: { label: 'Khai báo bút toán kết chuyển tự động',        path: '/tong_hop/danh_muc/ket-chuyen' } },
    { left:  { label: 'Khai báo bút toán phân bổ tự động',           path: '/tong_hop/danh_muc/phan-bo-td' },
      right: { label: 'Khai báo bút toán phân bổ định kỳ',           path: '/tong_hop/danh_muc/phan-bo-dk' } },
    { left:  { label: 'Khai báo bút toán chênh lệch tỷ giá',         path: '/tong_hop/danh_muc/chenh-lech' } },
  ],

  baoCao: [
    { items: ['Bảng kê chứng từ'] },
    { items: ['Bảng tổng hợp phát sinh theo đối tượng (Tk, khách hàng, ....)', 'Báo cáo số dư tài khoản'] },
    { items: ['Bảng cân đối phát sinh tài khoản', 'Bảng cân đối kế toán', 'Báo cáo kết quả sản xuất kinh doanh', 'Báo cáo lưu chuyển tiền tệ (LCTT)', 'Báo cáo lưu chuyển tiền tệ (LCGT)', 'Thuyết minh tài chính'] },
    { items: ['In Phiếu kế toán', 'In các bút toán tự động'] },
    { items: ['Sổ nhật ký chung', 'Sổ cái tài khoản', 'Sổ chi tiết tài khoản', 'Sổ tổng hợp chữ T tài khoản', 'Sổ nhật ký thu tiền', 'Sổ nhật ký chi tiền', 'Sổ nhật ký mua hàng', 'Sổ nhật ký bán hàng'] },
    { items: ['Sổ cái nhiều tài khoản', 'Sổ chi tiết nhiều tài khoản', 'Sổ tổng hợp chữ T nhiều tài khoản']},
    { items: ['Đăng ký số chứng từ ghi sổ' , 'Sổ đăng ký chứng từ ghi sổ', 'Bảng tổng hợp chứng từ/sổ chi tiết', 'Chứng từ ghi sổ', 'Sổ cái tài khoản']},
    { items: ['Bảng kê chứng từ theo mã phí', 'Báo cáo tổng hợp chi phí trong kỳ', 'Báo cáo tổng hợp chi phí so sánh giữa hai kỳ', 'Báo cáo tổng hợp chi phí cho nhiều kỳ', 'Báo cáo tổng hợp chi phí xoay theo cột', 'Báo cáo tổng hợp chi phí trong kỳ theo đơn vị cơ sở', 'Báo cáo tổng hợp chi phí so sánh giữa hai kỳ theo đơn vị cơ sở']},
    { items: ['Báo cáo doanh thu, chi phí', 'Báo cáo ngân sách']},
    { items: ['Khai báo Bảng cân đối kế toán', 'Khai báo Báo cáo kết quả SXKD', 'Khai báo Báo cáo lưu chuyển tiền tệ (PP trực tiếp)', 'Khai báo Báo cáo lưu chuyển tiền tệ (PP gián tiếp)', 'Khai báo Thuyết minh tài chính', 'Khai báo tham số mẫu báo cáo nhật ký', 'Khai báo Báo cáo doanh thu, chi phí', 'Khai báo Tổng hợp chi phí sản xuất dự án', 'Khai báo KQ SXKD theo dự án, công trình'] }

  ],
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IcoPhieuKeToan() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="6" width="44" height="52" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="18" y="6" width="28" height="10" rx="2" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="1.5"/>
      <line x1="18" y1="26" x2="46" y2="26" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="33" x2="46" y2="33" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="40" x2="38" y2="40" stroke="#2a7abf" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M36 50l4-4 4 4" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="40" y1="46" x2="40" y2="54" stroke="#e67e22" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function IcoKetChuyen() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="32" r="22" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <path d="M20 32h24M36 24l8 8-8 8" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="20" cy="32" r="3" fill="#388e3c"/>
      <path d="M26 20c3-6 12-6 14 0" stroke="#388e3c" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2"/>
    </svg>
  )
}

function IcoPhanBoTD() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="18" r="8" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <circle cx="16" cy="46" r="7" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <circle cx="48" cy="46" r="7" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <path d="M28 25l-8 14M36 25l8 14" stroke="#f57c00" strokeWidth="2" strokeLinecap="round"/>
      <text x="32" y="22" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#f57c00">A</text>
    </svg>
  )
}

function IcoPhanBoDK() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="10" width="48" height="44" rx="3" fill="#f3e5f5" stroke="#7b1fa2" strokeWidth="2"/>
      <line x1="8" y1="22" x2="56" y2="22" stroke="#7b1fa2" strokeWidth="1.5"/>
      <line x1="26" y1="10" x2="26" y2="54" stroke="#7b1fa2" strokeWidth="1" strokeDasharray="3 2"/>
      <line x1="40" y1="10" x2="40" y2="54" stroke="#7b1fa2" strokeWidth="1" strokeDasharray="3 2"/>
      <circle cx="17" cy="16" r="3" fill="#7b1fa2"/>
      <circle cx="33" cy="16" r="3" fill="#7b1fa2"/>
      <circle cx="48" cy="16" r="3" fill="#7b1fa2"/>
      <rect x="13" y="27" width="8" height="6" rx="1" fill="#ce93d8"/>
      <rect x="27" y="27" width="8" height="6" rx="1" fill="#ba68c8"/>
      <rect x="43" y="27" width="8" height="6" rx="1" fill="#ab47bc"/>
      <rect x="13" y="39" width="8" height="6" rx="1" fill="#ce93d8"/>
      <rect x="27" y="39" width="8" height="6" rx="1" fill="#ba68c8"/>
    </svg>
  )
}

function IcoChenhLech() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="6" y="14" width="22" height="28" rx="3" fill="#e3f2fd" stroke="#1565c0" strokeWidth="2"/>
      <rect x="36" y="14" width="22" height="28" rx="3" fill="#fce4ec" stroke="#c62828" strokeWidth="2"/>
      <text x="17" y="33" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1565c0">USD</text>
      <text x="47" y="33" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#c62828">VND</text>
      <path d="M28 26h8M32 22l4 4-4 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 48l24-8" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2"/>
      <circle cx="20" cy="48" r="3" fill="#e67e22"/>
      <circle cx="44" cy="40" r="3" fill="#e67e22"/>
    </svg>
  )
}

function IcoXoaDL() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="16" width="44" height="38" rx="3" fill="#ffebee" stroke="#c62828" strokeWidth="2"/>
      <line x1="10" y1="28" x2="54" y2="28" stroke="#c62828" strokeWidth="1.5"/>
      <rect x="22" y="8" width="20" height="12" rx="2" fill="#ffcdd2" stroke="#c62828" strokeWidth="1.5"/>
      <line x1="24" y1="37" x2="40" y2="51" stroke="#c62828" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="40" y1="37" x2="24" y2="51" stroke="#c62828" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
