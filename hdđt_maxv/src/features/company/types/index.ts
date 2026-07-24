import type { AuthCompany } from "../../auth/types";

/** Chi tiết công ty dùng cho tab "Quản lý công ty/Hộ kinh doanh". */
export interface CompanyDetail extends AuthCompany {
  diaChi: string | null;
  sdt: string | null;
  loaiHinhKinhDoanh: string | null;
}

export interface CreateCompanyPayload {
  tenCongTy: string;
  maSoThue: string;
  diaChi: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}

/**
 * Thông tin người nộp thuế trả về từ API tra cứu MST (api.xinvoice.vn).
 * Khai đủ field theo response để ghi lại hợp đồng của API; form thêm công ty
 * hiện chỉ dùng `name` và `address`.
 */
export interface TaxPayerInfo {
  taxID: string;
  name: string;
  address: string;
  /** Nhóm đối tượng thuế, vd "Doanh nghiệp / Đơn vị sự nghiệp công lập". */
  orgType: string;
  /** Cơ quan thuế quản lý, vd "Thuế cơ sở 2 thành phố Hải Phòng". */
  taxDepartment: string;
  /** Tình trạng hoạt động, vd "NNT đang hoạt động". */
  status: string;
  updatedAt: string;
}

/** MST không nằm trong đây — không sửa được sau khi tạo (đã gắn tenant DB). */
export interface UpdateCompanyPayload {
  tenCongTy?: string;
  diaChi?: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}
