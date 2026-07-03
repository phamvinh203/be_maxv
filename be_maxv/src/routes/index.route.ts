import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.route';
import { companyRoutes } from './company.route';
import { adminRoutes } from './admin.route';
import { tonKhoRoutes } from './tonKho/hangHoa.route';
import { dvtRoutes } from './tonKho/dvt.route';
import { phanNhomRoutes } from './tonKho/phanNhom.route';
import { maGdRoutes } from './tonKho/maGd.route';
import { khoRoutes } from './tonKho/kho.route';
import { nhomKhoRoutes } from './tonKho/nhomKho.route';
import { viTriKhoRoutes } from './tonKho/viTriKho.route';
import { loaiVtRoutes } from './tonKho/loaiVt.route';
import { thueRoutes } from './tonKho/thue.route';
import { tienTeRoutes } from './tongHop/tienTe.route';
import { taiKhoanRoutes } from './tongHop/taiKhoan.route';
import { phongBanRoutes } from './tongHop/phongBan.route';
import { khachHangRoutes } from './banHang/khachHang.route';
import { hoaDonBanHangRoutes } from './banHang/hoaDonBanHang.route';

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
}
