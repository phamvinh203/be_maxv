import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.route';
import { companyRoutes } from './company.route';
import { adminRoutes } from './admin/admin.route';
import { tonKhoRoutes } from './accounting/tonKho/hangHoa.route';
import { dvtRoutes } from './accounting/tonKho/dvt.route';
import { phanNhomRoutes } from './accounting/tonKho/phanNhom.route';
import { maGdRoutes } from './accounting/tonKho/maGd.route';
import { khoRoutes } from './accounting/tonKho/kho.route';
import { nhomKhoRoutes } from './accounting/tonKho/nhomKho.route';
import { viTriKhoRoutes } from './accounting/tonKho/viTriKho.route';
import { loaiVtRoutes } from './accounting/tonKho/loaiVt.route';
import { thueRoutes } from './accounting/tonKho/thue.route';
import { tienTeRoutes } from './accounting/tongHop/tienTe.route';
import { taiKhoanRoutes } from './accounting/tongHop/taiKhoan.route';
import { phongBanRoutes } from './accounting/tongHop/phongBan.route';
import { khachHangRoutes } from './accounting/banHang/khachHang.route';
import { hoaDonBanHangRoutes } from './accounting/banHang/hoaDonBanHang.route';
import gdtRoutes from './hddt/gdt.route';
import gdtDvcRoutes from './dich_vu_cong/gdt-dvc.route';
import toKhaiRoutes from './to_khai/keKhaiKy.route';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(companyRoutes, { prefix: '/api/v1/companies' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(tonKhoRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(dvtRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(phanNhomRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(maGdRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(khoRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(nhomKhoRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(viTriKhoRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(loaiVtRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(thueRoutes, { prefix: '/api/v1/ton-kho' });

  // Tổng hợp
  await app.register(tienTeRoutes, { prefix: '/api/v1/tong-hop' });
  await app.register(taiKhoanRoutes, { prefix: '/api/v1/tong-hop' });
  await app.register(phongBanRoutes, { prefix: '/api/v1/tong-hop' });

  // Bán hàng
  await app.register(khachHangRoutes, { prefix: '/api/v1/ban-hang' });
  await app.register(hoaDonBanHangRoutes, { prefix: '/api/v1/ban-hang' });

  // hóa đơn điện tử
  await app.register(gdtRoutes, { prefix: '/api/v1/gdt' });

  // dịch vụ công (proxy cổng dichvucong.gdt.gov.vn)
  await app.register(gdtDvcRoutes, { prefix: '/api/v1/dvc' });

  // tờ khai (gán hóa đơn vào kỳ kê khai — chỉ đọc DB, không gọi cổng thuế)
  await app.register(toKhaiRoutes, { prefix: '/api/v1/to-khai' });
}
