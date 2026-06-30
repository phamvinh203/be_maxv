import type { ModuleConfig } from './types'

export const tonKhoConfig: ModuleConfig = {
  title: 'Tồn kho',

  chungTu: [
    { label: 'Phiếu nhập kho',                        path: '/ton_kho/chung_tu/nhap_kho',     icon: <IcoNhapKho /> },
    { label: 'Phiếu xuất kho',                        path: '/ton_kho/chung_tu/xuat_kho',   icon: <IcoXuatKho /> },
    { label: 'Phiếu xuất điều chuyển',                path: '/ton_kho/chung_tu/dieu_chuyen',  icon: <IcoDieuChuyen /> },
    { label: 'Tính giá trung bình',                   path: '/ton_kho/chung_tu/gia_tb',       icon: <IcoGiaTB /> },
    { label: 'Tính giá trung bình di động theo ngày', path: '/ton_kho/chung_tu/gia_tb-dd',    icon: <IcoGiaTBDD /> },
    { label: 'Tính giá nhập trước xuất trước',        path: '/ton_kho/chung_tu/fifo',         icon: <IcoFIFO /> },
    { label: 'Tính lại tồn kho tức thời',             path: '/ton_kho/chung_tu/ton_tuc_thoi', icon: <IcoTonTT /> },
  ],

  danhMuc: [
    { left:  { label: 'Danh mục hàng hóa, vật tư',                           path: '/ton_kho/dm/hang_hoa' },
      right: { label: 'Danh mục phân nhóm hàng hóa, vật tư',                 path: '/ton_kho/dm/phan_nhom' } },
    { left:  { label: 'Danh mục đơn vị tính',                                path: '/ton_kho/dm/dvt' },
      right: { label: 'Danh mục quy đổi đơn vị tính',                        path: '/ton_kho/dm/quy_doi_dvt' } },
    { left:  { label: 'Danh mục lô',                                         path: '/ton_kho/dm/lo' },
      right: { label: 'Danh mục kho hàng',                                   path: '/ton_kho/dm/kho' } },
    { left:  { label: 'Danh mục nhóm kho hàng',                              path: '/ton_kho/dm/nhom_kho' },
      right: { label: 'Danh mục vị trí kho hàng',                            path: '/ton_kho/dm/vi_tri_kho' } },
    { left:  { label: 'Danh mục mã giao dịch',                               path: '/ton_kho/dm/ma_gd' },
      right: { label: 'Nhập tồn kho ban đầu hàng hóa, vật tư',              path: '/ton_kho/dm/ton_bd' } },
    { left:  { label: 'Nhập chi tiết tồn kho ban đầu nhập trước xuất trước', path: '/ton_kho/dm/ton_bd_fifo' },
      right: { label: 'Chuyển tồn kho sang năm sau',                         path: '/ton_kho/dm/chuyen_nam' } },
  ],

  baoCao: [
    { items: ['Bảng kê phiếu nhập', 'Tổng hợp hàng nhập kho', 'Tổng hợp hàng nhập nhóm theo 2 chỉ tiêu'] },
    { items: ['Bảng kê phiếu xuất', 'Tổng hợp hàng xuất kho', 'Tổng hợp hàng xuất nhóm theo 2 chỉ tiêu', 'Tổng hợp số phát sinh NVL theo sản phẩm'] },
    { items: ['Thẻ kho/Sổ chi tiết vật tư', 'Thẻ kho/Sổ chi tiết lên cho nhiều vật tư', 'Sổ chi tiết nhiều vật tư hàng hóa'] },
    { items: ['Tổng hợp nhập xuất tồn', 'Tổng hợp nhập xuất tồn theo kho', 'Tổng hợp nhập xuất tồn theo vị trí', 'Tổng hợp nhập xuất tồn theo lô', 'Báo cáo tồn kho', 'Báo cáo tồn theo kho', 'Bảng giá trung bình tháng'] },
    { items: ['Báo động tồn kho vật tư', 'Báo cáo tồn kho theo định mức', 'Báo cáo hàng hóa, vật tư cần ngay', 'Báo cáo hàng hóa, vật tư quá hạn'] },
    { items: ['In Phiếu nhập kho', 'In Phiếu xuất kho'] },
  ],
}

// ── Icons ──────────────────────────────────────────────────────────────────
function IcoNhapKho() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="20" width="48" height="36" rx="3" fill="#e3f0fb" stroke="#2a7abf" strokeWidth="2"/>
      <rect x="16" y="12" width="32" height="14" rx="2" fill="#b8d9f5" stroke="#2a7abf" strokeWidth="2"/>
      <path d="M24 38l8 8 8-8" stroke="#2a7abf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="32" y1="28" x2="32" y2="46" stroke="#2a7abf" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcoXuatKho() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="20" width="48" height="36" rx="3" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <rect x="16" y="12" width="32" height="14" rx="2" fill="#c8e6c9" stroke="#388e3c" strokeWidth="2"/>
      <path d="M24 38l8-8 8 8" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="32" y1="46" x2="32" y2="30" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcoDieuChuyen() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="4" y="22" width="24" height="20" rx="3" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <rect x="36" y="22" width="24" height="20" rx="3" fill="#fff3e0" stroke="#f57c00" strokeWidth="2"/>
      <path d="M28 30h8M32 26l4 4-4 4" stroke="#f57c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IcoGiaTB() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="32" r="24" fill="#f3e5f5" stroke="#7b1fa2" strokeWidth="2"/>
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#7b1fa2">TB</text>
    </svg>
  )
}
function IcoGiaTBDD() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <circle cx="32" cy="32" r="24" fill="#fce4ec" stroke="#c2185b" strokeWidth="2"/>
      <path d="M16 40 Q24 20 32 32 Q40 44 48 24" stroke="#c2185b" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}
function IcoFIFO() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="8" y="10" width="48" height="13" rx="3" fill="#e8f5e9" stroke="#388e3c" strokeWidth="2"/>
      <rect x="8" y="27" width="48" height="13" rx="3" fill="#c8e6c9" stroke="#388e3c" strokeWidth="2"/>
      <rect x="8" y="44" width="48" height="13" rx="3" fill="#a5d6a7" stroke="#388e3c" strokeWidth="2"/>
      <text x="32" y="21" textAnchor="middle" fontSize="9" fill="#388e3c" fontWeight="bold">NHẬP TRƯỚC</text>
      <text x="32" y="38" textAnchor="middle" fontSize="9" fill="#2e7d32" fontWeight="bold">XUẤT TRƯỚC</text>
      <text x="32" y="55" textAnchor="middle" fontSize="9" fill="#1b5e20" fontWeight="bold">FIFO</text>
    </svg>
  )
}
function IcoTonTT() {
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="24" width="44" height="28" rx="3" fill="#e3f2fd" stroke="#1565c0" strokeWidth="2"/>
      <path d="M32 12v12M26 16l6-6 6 6" stroke="#1565c0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="20" y="34" width="10" height="10" rx="1" fill="#1565c0" opacity="0.6"/>
      <rect x="34" y="34" width="10" height="10" rx="1" fill="#1565c0" opacity="0.3"/>
    </svg>
  )
}
