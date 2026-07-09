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

/** MST không nằm trong đây — không sửa được sau khi tạo (đã gắn tenant DB). */
export interface UpdateCompanyPayload {
  tenCongTy?: string;
  diaChi?: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}
