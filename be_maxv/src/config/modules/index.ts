// ============================================================
//  Cấu hình MENU cho "Tổng quan DB tenant" (admin xem chi tiết công ty).
//    Module (tab)  ->  Section (Danh mục / Chứng từ / Báo cáo)  ->  Item
//
//  Config THUẦN TS phía BE (không React/không icon). `label` để hiển thị,
//  `table` để đo dữ liệu (đếm bản ghi + kích thước). Item KHÔNG có `table`
//  = tính năng chưa dựng bảng -> overview hiện "chưa có bảng" (rows/size null).
//
//  Hiện chỉ module "Tồn kho" đã có bảng trong tenant schema. Các module khác
//  hiển thị đầy đủ cấu trúc menu nhưng chưa gắn `table`. Khi dựng bảng cho
//  module/mục nào thì gắn `table` vào đúng item đó.
// ============================================================

export interface MenuItem {
  label: string;
  path?: string;
  /** Tên bảng trong tenant schema (nếu item có dữ liệu để đếm). */
  table?: string;
}

export interface MenuSection {
  key: string;
  title: string;
  items: MenuItem[];
}

export interface MenuModule {
  key: string;
  title: string;
  sections: MenuSection[];
}

export const MENU_MODULES: MenuModule[] = [
  // ── Hệ thống ──────────────────────────────────────────────────────────────
  {
    key: 'heThong',
    title: 'Hệ thống',
    sections: [
      {
        key: 'danhMuc',
        title: 'Danh mục',
        items: [
          { label: 'Danh mục quyền chứng từ', path: '/he-thong/danh_muc/quyen-chung-tu' },
          { label: 'Phân quyền NSD quyền chứng từ', path: '/he-thong/danh_muc/phan-quyen-nsd' },
          { label: 'Khóa số liệu', path: '/he-thong/danh_muc/khoa-so-lieu' },
          { label: 'Khóa số liệu theo đơn vị', path: '/he-thong/danh_muc/khoa-so-lieu-don-vi' },
          { label: 'Khóa số liệu theo chứng từ', path: '/he-thong/danh_muc/khoa-so-lieu-chung-tu' },
          { label: 'Kiểm tra số liệu giữa sổ tài khoản và sổ kho', path: '/he-thong/danh_muc/kiem-tra-so-kho' },
          { label: 'Kiểm tra số liệu giữa sổ tài khoản và sổ thuế', path: '/he-thong/danh_muc/kiem-tra-so-thue' },
          { label: 'Kiểm tra khai báo mẫu bảng cân đối kế toán', path: '/he-thong/danh_muc/kiem-tra-bang-can-doi' },
        ],
      },
      {
        key: 'chungTu',
        title: 'Chức năng',
        items: [
          { label: 'Ngày bắt đầu năm tài chính', path: '/he-thong/nam-tai-chinh' },
          { label: 'Ngày bắt đầu nhập liệu', path: '/he-thong/ngay-nhap-lieu' },
          { label: 'Thời gian nhập liệu', path: '/he-thong/thoi-gian-nhap' },
          { label: 'Thông tin công ty', path: '/he-thong/thong-tin-cong-ty' },
          { label: 'Màn hình nhập chứng từ', path: '/he-thong/man-hinh-nhap' },
          { label: 'Đánh lại số chứng từ', path: '/he-thong/danh-lai-so' },
          { label: 'Tham số tùy chọn', path: '/he-thong/tham-so' },
          { label: 'Khai báo tài khoản HĐDT', path: '/he-thong/tai-khoan-hddt' },
        ],
      },
      {
        key: 'baoCao',
        title: 'Báo cáo',
        items: [
          { label: 'Khai báo người sử dụng' },
          { label: 'Phân quyền truy cập' },
          { label: 'Phân quyền truy cập theo đơn vị cơ sở' },
          { label: 'Phân quyền truy cập theo kho' },
          { label: 'Giới hạn quyền truy cập' },
          { label: 'Giới hạn quyền truy cập theo đơn vị' },
          { label: 'Giới hạn quyền truy cập trạng thái chứng từ' },
          { label: 'Giới hạn địa chỉ truy cập' },
          { label: 'Giới hạn địa chỉ truy cập của người sử dụng' },
          { label: 'Danh sách người sử dụng đang thực hiện chương trình' },
          { label: 'Nhật ký người sử dụng' },
        ],
      },
    ],
  },

  // ── Tổng hợp ──────────────────────────────────────────────────────────────
  {
    key: 'tongHop',
    title: 'Tổng hợp',
    sections: [
      {
        key: 'danhMuc',
        title: 'Danh mục',
        items: [
          { label: 'Danh mục tài khoản', path: '/tong_hop/danh_muc/tai-khoan' },
          { label: 'Danh mục tiền tệ', path: '/tong_hop/danh_muc/tien-te' },
          { label: 'Danh mục phòng ban', path: '/tong_hop/danh_muc/phong-ban' },
          { label: 'Danh mục phí', path: '/tong_hop/danh_muc/phi' },
          { label: 'Danh mục nhóm phí', path: '/tong_hop/danh_muc/nhom-phi' },
          { label: 'Nhập số dư ban đầu tài khoản', path: '/tong_hop/danh_muc/so-du-ban-dau' },
          { label: 'Chuyển số dư tài khoản sang năm sau', path: '/tong_hop/danh_muc/chuyen-so-du' },
          { label: 'Khai báo bút toán kết chuyển tự động', path: '/tong_hop/danh_muc/ket-chuyen' },
          { label: 'Khai báo bút toán phân bổ tự động', path: '/tong_hop/danh_muc/phan-bo-td' },
          { label: 'Khai báo bút toán phân bổ định kỳ', path: '/tong_hop/danh_muc/phan-bo-dk' },
          { label: 'Khai báo bút toán chênh lệch tỷ giá', path: '/tong_hop/danh_muc/chenh-lech' },
        ],
      },
      {
        key: 'chungTu',
        title: 'Chứng từ',
        items: [
          { label: 'Phiếu kế toán', path: '/tong_hop/phieu-ke-toan' },
          { label: 'Bút toán kết chuyển tự động', path: '/tong_hop/ket-chuyen-td' },
          { label: 'Bút toán phân bổ tự động', path: '/tong_hop/phan-bo-td' },
          { label: 'Bút toán phân bổ định kỳ', path: '/tong_hop/phan-bo-dk' },
          { label: 'Bút toán chênh lệch tỷ giá', path: '/tong_hop/chenh-lech-ty-gia' },
          { label: 'Xóa dữ liệu', path: '/tong_hop/xoa-du-lieu' },
        ],
      },
      {
        key: 'baoCao',
        title: 'Báo cáo',
        items: [
          { label: 'Bảng kê chứng từ' },
          { label: 'Bảng tổng hợp phát sinh theo đối tượng' },
          { label: 'Báo cáo số dư tài khoản' },
          { label: 'Bảng cân đối phát sinh tài khoản' },
          { label: 'Bảng cân đối kế toán' },
          { label: 'Báo cáo kết quả sản xuất kinh doanh' },
          { label: 'Báo cáo lưu chuyển tiền tệ (LCTT)' },
          { label: 'Thuyết minh tài chính' },
          { label: 'Sổ nhật ký chung' },
          { label: 'Sổ cái tài khoản' },
          { label: 'Sổ chi tiết tài khoản' },
        ],
      },
    ],
  },

  // ── Tiền ──────────────────────────────────────────────────────────────────
  {
    key: 'tien',
    title: 'Tiền',
    sections: [
      {
        key: 'danhMuc',
        title: 'Danh mục',
        items: [
          { label: 'Danh mục khế ước', path: '/tien/dm/khe-uoc' },
          { label: 'Danh mục tài khoản ngân hàng', path: '/tien/dm/tai-khoan-ngan-hang' },
          { label: 'Vào số dư ban đầu khế ước', path: '/tien/dm/so-du-khe-uoc' },
          { label: 'Kết chuyển số dư khế ước sang năm sau', path: '/tien/dm/ket-chuyen-khe-uoc' },
        ],
      },
      {
        key: 'chungTu',
        title: 'Chứng từ',
        items: [
          { label: 'Giấy báo có', path: '/tien/chung_tu/giay-bao-co' },
          { label: 'Giấy báo nợ', path: '/tien/chung_tu/giay-bao-no' },
          { label: 'Phiếu thu', path: '/tien/chung_tu/phieu-thu' },
          { label: 'Phiếu chi', path: '/tien/chung_tu/phieu-chi' },
          { label: 'Tỷ giá ghi sổ', path: '/tien/chung_tu/ty-gia-ghi-so' },
        ],
      },
      {
        key: 'baoCao',
        title: 'Báo cáo',
        items: [
          { label: 'Sổ quỹ' },
          { label: 'Sổ tiền gửi ngân hàng' },
          { label: 'Báo cáo số dư tại quỹ và ngân hàng' },
          { label: 'Sổ nhật ký thu tiền' },
          { label: 'Sổ nhật ký chi tiền' },
          { label: 'Bảng kê danh sách các khế ước' },
          { label: 'Báo cáo chi tiết tình hình tiền vay' },
          { label: 'Báo cáo tổng hợp tình hình tiền vay' },
        ],
      },
    ],
  },

  // ── Bán hàng ──────────────────────────────────────────────────────────────
  {
    key: 'banHang',
    title: 'Bán hàng',
    sections: [
      {
        key: 'danhMuc',
        title: 'Danh mục',
        items: [
          { label: 'Danh mục khách hàng', path: '/ban-hang/dm/khach-hang' },
          { label: 'Danh mục phân nhóm khách hàng', path: '/ban-hang/dm/phan-nhom-kh' },
          { label: 'Danh mục thanh toán', path: '/ban-hang/dm/thanh-toan' },
          { label: 'Danh mục hợp đồng', path: '/ban-hang/dm/hop-dong' },
          { label: 'Danh mục nhóm hợp đồng', path: '/ban-hang/dm/nhom-hop-dong' },
          { label: 'Danh mục nhân viên bán hàng', path: '/ban-hang/dm/nhan-vien-bh' },
          { label: 'Nhập số dư ban đầu khách hàng', path: '/ban-hang/dm/so-du-kh' },
          { label: 'Nhập số dư ban đầu hóa đơn', path: '/ban-hang/dm/so-du-hd' },
          { label: 'Nhập số dư ban đầu hợp đồng', path: '/ban-hang/dm/so-du-hop-dong' },
          { label: 'Kết chuyển số dư hợp đồng sang năm sau', path: '/ban-hang/dm/ket-chuyen-hd' },
        ],
      },
      {
        key: 'chungTu',
        title: 'Chứng từ',
        items: [
          { label: 'Hóa đơn bán hàng', path: '/ban-hang/chung_tu/hoa-don-ban-hang' },
          { label: 'Phiếu nhập hàng bán trả lại', path: '/ban-hang/chung_tu/tra-lai' },
          { label: 'Hóa đơn điều chỉnh giá hàng bán', path: '/ban-hang/chung_tu/dieu-chinh-gia' },
          { label: 'Hóa đơn dịch vụ', path: '/ban-hang/chung_tu/hoa-don-dv' },
          { label: 'Hóa đơn dịch vụ trả lại', path: '/ban-hang/chung_tu/hoa-don-dv-tra-lai' },
          { label: 'Hóa đơn giảm giá hàng hóa - dịch vụ', path: '/ban-hang/chung_tu/giam-gia' },
          { label: 'Bù trừ công nợ', path: '/ban-hang/chung_tu/bu-tru-cong-no' },
          { label: 'Phân bổ tiền thu hóa đơn', path: '/ban-hang/chung_tu/phan-bo-tien-thu' },
          { label: 'Phân bổ tiền thu tự động hóa đơn', path: '/ban-hang/chung_tu/phan-bo-tu-dong' },
          { label: 'Tất toán cho các hóa đơn', path: '/ban-hang/chung_tu/tat-toan' },
          { label: 'Đánh giá CLTG hóa đơn', path: '/ban-hang/chung_tu/danh-gia-cltg' },
          { label: 'Cập nhật giá bán', path: '/ban-hang/chung_tu/cap-nhat-gia' },
        ],
      },
      {
        key: 'baoCao',
        title: 'Báo cáo',
        items: [
          { label: 'Sổ chi tiết công nợ khách hàng' },
          { label: 'Bảng cân đối phát sinh công nợ' },
          { label: 'Sổ đối chiếu công nợ' },
          { label: 'Bảng tổng hợp số dư công nợ' },
          { label: 'Bảng kê hóa đơn bán hàng' },
          { label: 'Báo cáo tổng hợp hàng bán' },
          { label: 'Báo cáo bán hàng theo 2 chỉ tiêu' },
          { label: 'Bảng kê công nợ phải thu theo hóa đơn' },
          { label: 'In Hóa đơn hàng bán' },
        ],
      },
    ],
  },

  // ── Mua hàng ──────────────────────────────────────────────────────────────
  {
    key: 'muaHang',
    title: 'Mua hàng',
    sections: [
      {
        key: 'danhMuc',
        title: 'Danh mục',
        items: [
          { label: 'Danh mục nhà cung cấp', path: '/mua-hang/dm/nha-cung-cap' },
          { label: 'Danh mục phân nhóm nhà cung cấp', path: '/mua-hang/dm/phan-nhom-ncc' },
          { label: 'Danh mục hợp đồng', path: '/mua-hang/dm/hop-dong' },
          { label: 'Danh mục nhóm hợp đồng', path: '/mua-hang/dm/nhom-hop-dong' },
          { label: 'Danh mục chi phí', path: '/mua-hang/dm/chi-phi' },
          { label: 'Nhập số dư ban đầu Nhà cung cấp', path: '/mua-hang/dm/so-du-ncc' },
          { label: 'Nhập số dư ban đầu hóa đơn', path: '/mua-hang/dm/so-du-hoa-don' },
          { label: 'Nhập số dư ban đầu hợp đồng', path: '/mua-hang/dm/so-du-hop-dong' },
          { label: 'Kết chuyển số dư hợp đồng sang năm sau', path: '/mua-hang/dm/ket-chuyen-hop-dong' },
        ],
      },
      {
        key: 'chungTu',
        title: 'Chứng từ',
        items: [
          { label: 'Hóa đơn mua hàng trong nước', path: '/mua-hang/hd-trong-nuoc' },
          { label: 'Hóa đơn mua hàng nhập khẩu', path: '/mua-hang/hd-nhap-khau' },
          { label: 'Hóa đơn nhập mua - xuất thẳng', path: '/mua-hang/hd-nhap-xuat-thang' },
          { label: 'Phiếu nhận chi phí mua hàng', path: '/mua-hang/phi-mua-hang' },
          { label: 'Phiếu xuất trả lại nhà cung cấp', path: '/mua-hang/xuat-tra-lai-ncc' },
          { label: 'Phiếu nhập điều chỉnh giá hàng mua', path: '/mua-hang/dieu-chinh-gia' },
          { label: 'Hóa đơn mua hàng dịch vụ', path: '/mua-hang/hd-dich-vu' },
          { label: 'Hóa đơn dịch vụ trả lại NCC', path: '/mua-hang/dv-tra-lai-ncc' },
          { label: 'Bù trừ công nợ', path: '/mua-hang/bu-tru-cong-no' },
          { label: 'Phân bổ tiền trả cho các hóa đơn', path: '/mua-hang/phan-bo-tien-tra' },
          { label: 'Phân bổ tiền trả tự động cho hóa đơn', path: '/mua-hang/phan-bo-tu-dong' },
          { label: 'Tất toán cho các hóa đơn', path: '/mua-hang/tat-toan' },
          { label: 'Đánh giá CLTG cho các hóa đơn', path: '/mua-hang/danh-gia-cltg' },
        ],
      },
      {
        key: 'baoCao',
        title: 'Báo cáo',
        items: [
          { label: 'Sổ chi tiết công nợ' },
          { label: 'Bảng cân đối phát sinh công nợ' },
          { label: 'Sổ đối chiếu công nợ' },
          { label: 'Bảng tổng hợp số dư công nợ' },
          { label: 'Bảng kê hóa đơn mua hàng' },
          { label: 'Tổng hợp hàng nhập mua' },
          { label: 'Bảng kê công nợ phải trả theo hóa đơn' },
          { label: 'In hóa đơn mua hàng trong nước' },
        ],
      },
    ],
  },

  // ── Tồn kho (đã có bảng) ────────────────────────────────────────────────────
  {
    key: 'tonKho',
    title: 'Tồn kho',
    sections: [
      {
        key: 'danhMuc',
        title: 'Danh mục',
        items: [
          { label: 'Danh mục hàng hóa, vật tư', path: '/ton_kho/danh_muc/hang_hoa', table: 'dmvt' },
          { label: 'Danh mục phân nhóm hàng hóa, vật tư', path: '/ton_kho/danh_muc/phan_nhom', table: 'dmnhvt' },
          { label: 'Danh mục đơn vị tính', path: '/ton_kho/danh_muc/dvt', table: 'dmdvt' },
          { label: 'Danh mục quy đổi đơn vị tính', path: '/ton_kho/danh_muc/quy_doi_dvt', table: 'dmqddvt' },
          { label: 'Danh mục lô', path: '/ton_kho/danh_muc/lo' },
          { label: 'Danh mục kho hàng', path: '/ton_kho/danh_muc/kho', table: 'dmkho' },
          { label: 'Danh mục nhóm kho hàng', path: '/ton_kho/danh_muc/nhom_kho', table: 'dmnhkho' },
          { label: 'Danh mục vị trí kho hàng', path: '/ton_kho/danh_muc/vi_tri_kho', table: 'dmvitri' },
          { label: 'Danh mục mã giao dịch', path: '/ton_kho/danh_muc/ma_gd', table: 'dmmagd' },
          { label: 'Nhập tồn kho ban đầu hàng hóa, vật tư', path: '/ton_kho/danh_muc/ton_bd' },
          { label: 'Nhập chi tiết tồn kho ban đầu nhập trước xuất trước', path: '/ton_kho/danh_muc/ton_bd_fifo' },
          { label: 'Chuyển tồn kho sang năm sau', path: '/ton_kho/danh_muc/chuyen_nam' },
        ],
      },
      {
        key: 'chungTu',
        title: 'Chứng từ',
        items: [
          { label: 'Phiếu nhập kho', path: '/ton_kho/chung_tu/nhap_kho' },
          { label: 'Phiếu xuất kho', path: '/ton_kho/chung_tu/xuat_kho' },
          { label: 'Phiếu xuất điều chuyển', path: '/ton_kho/chung_tu/dieu_chuyen' },
          { label: 'Tính giá trung bình', path: '/ton_kho/chung_tu/gia_tb' },
          { label: 'Tính giá trung bình di động theo ngày', path: '/ton_kho/chung_tu/gia_tb-dd' },
          { label: 'Tính giá nhập trước xuất trước', path: '/ton_kho/chung_tu/fifo' },
          { label: 'Tính lại tồn kho tức thời', path: '/ton_kho/chung_tu/ton_tuc_thoi' },
        ],
      },
      {
        key: 'baoCao',
        title: 'Báo cáo',
        items: [
          { label: 'Bảng kê phiếu nhập' },
          { label: 'Tổng hợp hàng nhập kho' },
          { label: 'Bảng kê phiếu xuất' },
          { label: 'Tổng hợp hàng xuất kho' },
          { label: 'Thẻ kho/Sổ chi tiết vật tư' },
          { label: 'Tổng hợp nhập xuất tồn' },
          { label: 'Báo cáo tồn kho' },
          { label: 'In Phiếu nhập kho' },
          { label: 'In Phiếu xuất kho' },
        ],
      },
    ],
  },

  // ── Giá thành ───────────────────────────────────────────────────────────────
  {
    key: 'giaThanh',
    title: 'Giá thành',
    sections: [
      {
        key: 'danhMuc',
        title: 'Danh mục',
        items: [
          { label: 'Danh mục yếu tố', path: '/gia-thanh/dm/yeu-to' },
          { label: 'Danh mục loại yếu tố', path: '/gia-thanh/dm/loai-yeu-to' },
          { label: 'Danh mục nhóm yếu tố', path: '/gia-thanh/dm/nhom-yeu-to' },
          { label: 'Danh mục công đoạn', path: '/gia-thanh/dm/cong-doan' },
          { label: 'Nhập số lượng sản phẩm dở dang đầu kỳ', path: '/gia-thanh/dm/sl-sp-do-dang-dk' },
          { label: 'Nhập giá trị dở dang đầu kỳ theo yếu tố chi phí', path: '/gia-thanh/dm/gt-do-dang-dk' },
          { label: 'Nhập vật tư dở dang đầu kỳ', path: '/gia-thanh/dm/vt-do-dang-dk' },
          { label: 'Điều chỉnh số lượng sản phẩm dở dang đầu kỳ', path: '/gia-thanh/dm/dc-sl-do-dang-dk' },
          { label: 'Điều chỉnh giá trị dở dang đầu kỳ theo yếu tố chi phí', path: '/gia-thanh/dm/dc-gt-do-dang-dk' },
          { label: 'Điều chỉnh vật tư dở dang đầu kỳ', path: '/gia-thanh/dm/dc-vt-do-dang-dk' },
        ],
      },
      {
        key: 'chungTu',
        title: 'Chứng từ',
        items: [
          { label: 'Định mức nguyên vật liệu', path: '/gia-thanh/dinh-muc-nvl' },
          { label: 'Lệnh sản xuất', path: '/gia-thanh/lenh-san-xuat' },
          { label: 'Khai báo hệ số phân bổ', path: '/gia-thanh/he-so-phan-bo' },
          { label: 'Khai báo vật tư thay thế', path: '/gia-thanh/vat-tu-thay-the' },
          { label: 'Khai báo đối tượng nhận phân bổ chi phí', path: '/gia-thanh/doi-tuong-phan-bo' },
          { label: 'Nhập kiểm kê vật tư cuối kỳ', path: '/gia-thanh/kiem-ke-vat-tu' },
          { label: 'Nhập số lượng sản phẩm dở dang cuối kỳ', path: '/gia-thanh/sl-sp-do-dang' },
          { label: 'Tính giá thành', path: '/gia-thanh/tinh-gia-thanh' },
        ],
      },
      {
        key: 'baoCao',
        title: 'Báo cáo',
        items: [
          { label: 'Thẻ giá thành sản phẩm' },
          { label: 'Báo cáo giá thành sản phẩm theo nhóm yếu tố' },
          { label: 'Báo cáo tổng hợp giá thành sản phẩm' },
          { label: 'Báo cáo giá thành chi tiết theo vật tư' },
          { label: 'Báo cáo tổng hợp chi phí sản xuất theo sản phẩm' },
          { label: 'Bảng tập hợp chi phí phát sinh trong kỳ' },
          { label: 'Bảng định mức sản phẩm' },
        ],
      },
    ],
  },
];
