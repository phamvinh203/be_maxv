/**
 * SEED DỮ LIỆU MẪU — PHÂN HỆ HRM / DỮ LIỆU TÍNH LƯƠNG (dev tooling).
 *
 *   npm run hrm:seed
 *
 * MỤC ĐÍCH: môi trường dev đang THIẾU dữ liệu mẫu nên QA/Frontend không test được UI qua trình
 * duyệt. Script này KHÔNG phải thay đổi nghiệp vụ — chỉ tạo dữ liệu để bấm thử màn hình.
 *
 * ===== PHẠM VI — CHỈ 1 TENANT DUY NHẤT =====
 * Script này CHỈ đụng vào ĐÚNG MỘT công ty: MST `0111142786` (control-plane bootstrap ở
 * `../../src/scripts/hrm/seed-control-plane.ts`, gọi TRƯỚC file này). Tuyệt đối không quét/sửa
 * 10 tenant thật khác đang có trong `maxv2_sys`. `ensureControlPlaneTestTenant()` DỪNG LẠI (ném
 * lỗi) nếu MST này lỡ thuộc owner khác — không bao giờ âm thầm ghi đè dữ liệu người khác.
 *
 * ===== CHIẾN LƯỢC IDEMPOTENT: "XÓA SẠCH RỒI DỰNG LẠI" (wipe-then-rebuild) =====
 * Tenant MST 0111142786 khi khảo sát (2026-09-10) đã có sẵn một ít dữ liệu thủ công của các
 * phiên QA/dev trước (4 phòng ban, 4 nhân viên, 2 kỳ lương...) — đây là dữ liệu TEST/DEV
 * (không phải dữ liệu kinh doanh thật: 0 chứng từ kế toán/hóa đơn trong cùng tenant), và KHÔNG
 * đủ để phủ hết các nhánh nghiệp vụ theo yêu cầu (5 phòng ban, 10-25 nhân viên, đa dạng loại
 * hợp đồng...). Do đó script XÓA SẠCH toàn bộ domain HRM/Payroll của tenant này (theo đúng thứ
 * tự an toàn FK, xem `wipeHrmDomain()`), rồi dựng lại TOÀN BỘ từ đầu bằng RNG có seed cố định.
 * Kết quả: chạy script 2 lần liên tiếp cho ra ĐÚNG một bộ dữ liệu giống hệt nhau (không tăng
 * dần, không lỗi trùng khóa) — đây chính là điều kiện "idempotent" mà yêu cầu đặt ra, chỉ khác
 * cách đạt được (reset toàn bộ thay vì upsert từng dòng — hợp lý hơn cho một bảng lương có nhiều
 * ràng buộc UNIQUE/EXCLUDE chéo bảng khó upsert an toàn).
 *
 * ===== SINGLE SOURCE OF TRUTH — TÁI SỬ DỤNG SERVICE THẬT, KHÔNG CHÉP LOGIC =====
 * Toàn bộ nghiệp vụ (sinh mã tự động, tính giờ công/OT, tính thuế/bảo hiểm, khóa sổ...) được
 * seed bằng cách GỌI THẲNG các hàm service thật trong `src/services/client/hrm/**` — KHÔNG bao
 * giờ tự chép công thức/insert thẳng bảng cho các bảng có logic nghiệp vụ (cấu hình mặc định,
 * ca làm việc, ngày lễ, hợp đồng, người phụ thuộc, set lương, 8 phân hệ nhập liệu, khóa sổ kỳ
 * lương). Điều này đảm bảo dữ liệu sinh ra luôn khớp đúng luật nghiệp vụ hiện hành + để lộ ngay
 * lỗi service (nếu có) thay vì che giấu bằng insert tay.
 */
import { getTenantDb, disconnectAllTenants } from '../../src/helpers/tenantClient';
import { sysPrisma } from '../../src/config/db.sys';
import {
  ensureControlPlaneTestTenant,
  SEED_OWNER_EMAIL,
} from '../../src/scripts/hrm/seed-control-plane';

import { restoreDefault } from '../../src/services/client/hrm/cau_hinh_mac_dinh/generalSettings.service';
import { createWorkShift } from '../../src/services/client/hrm/cau_hinh_mac_dinh/workShifts.service';
import { quickGenerateHolidays } from '../../src/services/client/hrm/cau_hinh_mac_dinh/holidays.service';

import { createPhongBan } from '../../src/services/client/hrm/du_lieu_ca_nhan/phongBan.service';
import { createNhanVien } from '../../src/services/client/hrm/du_lieu_ca_nhan/nhanVien.service';
import { createHopDong } from '../../src/services/client/hrm/du_lieu_ca_nhan/hopDong.service';
import { createNguoiPhuThuoc } from '../../src/services/client/hrm/du_lieu_ca_nhan/nguoiPhuThuoc.service';

import { createSalaryItem } from '../../src/services/client/hrm/cai_dat_luong/salaryItems.service';
import { saveSalaryStructure } from '../../src/services/client/hrm/cai_dat_luong/salaryStructures.service';
import {
  setEmployeeSalary,
  approveEmployeeSalaries,
} from '../../src/services/client/hrm/cai_dat_luong/employeeSalaries.service';

import {
  createKpiItem,
  createProduct,
  createDiligenceType,
  createAdjustmentItem,
} from '../../src/services/client/hrm/du_lieu_tinh_luong/catalogs.service';
import {
  createPayrollPeriod,
  lockPayrollPeriod,
} from '../../src/services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service';
import {
  overrideAttendanceCell,
  applyOvertime,
  applyKpi,
  applyBonus,
  applyPiecework,
  applyCommission,
  recordDiligenceViolation,
  applyAdjustments,
} from '../../src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service';
import { getPayrollSheetLines } from '../../src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service';

import type { PrismaClient as TenantDb } from '../../src/generated/tenant';

// ============================================================================================
// RNG XÁC ĐỊNH (mulberry32) — seed cố định để chạy lại nhiều lần ra ĐÚNG cùng một bộ dữ liệu.
// ============================================================================================
const RNG_SEED = 20260910; // ngày viết script — cố định, KHÔNG đổi giữa các lần chạy.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(RNG_SEED);
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

// ============================================================================================
// TIỆN ÍCH NGÀY THÁNG
// ============================================================================================
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function addMonthsUTC(base: Date, delta: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + delta, 1));
}

const TODAY = new Date();
const CURRENT_YEAR = TODAY.getUTCFullYear();
const CURRENT_MONTH = TODAY.getUTCMonth() + 1;
const PREV_PERIOD = addMonthsUTC(TODAY, -1);
const PREV_YEAR = PREV_PERIOD.getUTCFullYear();
const PREV_MONTH = PREV_PERIOD.getUTCMonth() + 1;

/** Bỏ dấu tiếng Việt — dùng cho tên in hoa trên tài khoản ngân hàng. */
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// ============================================================================================
// DANH MỤC DỮ LIỆU NGHIỆP VỤ
// ============================================================================================
const DEPARTMENTS = [
  { name: 'Kinh doanh', positions: ['Nhân viên kinh doanh', 'Trưởng nhóm kinh doanh'] },
  { name: 'Kế toán', positions: ['Kế toán viên', 'Kế toán tổng hợp'] },
  { name: 'Sản xuất', positions: ['Công nhân sản xuất', 'Tổ trưởng sản xuất'] },
  { name: 'Kho vận', positions: ['Nhân viên kho', 'Thủ kho'] },
  { name: 'Hành chính - Nhân sự', positions: ['Chuyên viên nhân sự', 'Nhân viên hành chính'] },
] as const;

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const TEN_NAM = ['Văn An', 'Quang Huy', 'Minh Tuấn', 'Đức Thắng', 'Công Danh', 'Hữu Nghĩa', 'Thanh Tùng', 'Anh Tuấn', 'Chí Cường', 'Bảo Long'];
const TEN_NU = ['Thị Bình', 'Ngọc Hà', 'Thu Hương', 'Thanh Thảo', 'Kim Ngân', 'Thùy Linh', 'Phương Anh', 'Mỹ Duyên', 'Hồng Nhung', 'Lan Anh'];
const NGAN_HANG = ['Vietcombank', 'Techcombank', 'BIDV', 'Agribank', 'MB Bank', 'ACB', 'VPBank'];
const QUAN_HE_NPT = ['Vợ', 'Chồng', 'Con', 'Bố', 'Mẹ'];

const CONTRACT_TYPES_LONGTERM = ['xac_dinh', 'khong_xac_dinh'] as const;

interface SeedEmployee {
  index: number;
  deptName: string;
  ma_pb: string;
  ho_ten: string;
  gioiTinh: 'nam' | 'nu';
  chuc_vu: string;
  ma_nv?: string;
}

// ============================================================================================
// A. TỔ CHỨC & NHÂN SỰ
// ============================================================================================

async function seedPhongBan(db: TenantDb): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const dept of DEPARTMENTS) {
    const { ma_pb } = await createPhongBan(db, {
      ma_pb: null,
      ten_pb: dept.name,
      ma_pb_me: null,
      ghi_chu: null,
      status: '1',
    } as never);
    map[dept.name] = ma_pb;
  }
  console.log(`[A.1] Đã tạo ${DEPARTMENTS.length} phòng ban: ${DEPARTMENTS.map((d) => d.name).join(', ')}.`);
  return map;
}

function buildEmployeePlan(phongBanMap: Record<string, string>): SeedEmployee[] {
  const employees: SeedEmployee[] = [];
  let globalIdx = 0;
  let nameIdx = 0;
  for (const dept of DEPARTMENTS) {
    const soLuong = randInt(2, 5); // yêu cầu: mỗi phòng ban random 2-5 nhân viên
    for (let i = 0; i < soLuong; i++) {
      const isNam = globalIdx % 2 === 0;
      const ho = HO[nameIdx % HO.length];
      const ten = isNam ? TEN_NAM[nameIdx % TEN_NAM.length] : TEN_NU[nameIdx % TEN_NU.length];
      nameIdx++;
      employees.push({
        index: globalIdx,
        deptName: dept.name,
        ma_pb: phongBanMap[dept.name],
        ho_ten: `${ho} ${ten}`,
        gioiTinh: isNam ? 'nam' : 'nu',
        chuc_vu: i === 0 ? dept.positions[1] : dept.positions[0],
      });
      globalIdx++;
    }
  }
  return employees;
}

async function seedNhanVien(db: TenantDb, employees: SeedEmployee[]): Promise<void> {
  for (const emp of employees) {
    const { ma_nv } = await createNhanVien(
      db,
      {
        ma_nv: null,
        ho_ten: emp.ho_ten,
        ngay_sinh: toDate(isoDate(randInt(1975, 2003), randInt(1, 12), randInt(1, 28))),
        so_cccd: String(79_000_000_000 + emp.index).padStart(12, '0'),
        mst_ca_nhan: null,
        dien_thoai: `09${String(10_000_000 + emp.index * 91).padStart(8, '0')}`,
        email: `nv.seed${String(emp.index + 1).padStart(3, '0')}@maxv-demo.vn`,
        dia_chi: null,
        gioi_tinh: emp.gioiTinh,
        ma_pb: emp.ma_pb,
        chuc_vu: emp.chuc_vu,
        cap_bac: null,
        ngay_vao_lam: toDate(isoDate(randInt(2019, 2025), randInt(1, 12), randInt(1, 28))),
        mien_cham_cong: false,
        cong_doan: emp.index % 5 !== 0, // đa số bật, xen kẽ vài người tắt để đa dạng
        so_tai_khoan: String(1_000_000_000 + emp.index * 7_777_777),
        ten_tai_khoan: removeVietnameseTones(emp.ho_ten).toUpperCase(),
        ngan_hang: pick(NGAN_HANG),
        ghi_chu: null,
        status: '1',
      } as never,
      true,
    );
    emp.ma_nv = ma_nv;
  }
  console.log(`[A.2] Đã tạo ${employees.length} nhân viên (2-5 người/phòng ban, seed cố định).`);
}

interface ContractSummary {
  ma_nv: string;
  loai_hd: string;
  luong_chinh: number;
  luong_bhxh: number;
}

async function seedHopDong(db: TenantDb, employees: SeedEmployee[]): Promise<ContractSummary[]> {
  const contracts: ContractSummary[] = [];
  let soHdSeq = 1;
  const probationStart = addMonthsUTC(TODAY, -2);
  const probationEnd = addMonthsUTC(TODAY, 2);

  for (const emp of employees) {
    const i = emp.index;
    let loai_hd: string;
    let kieu_luong: 'gross' | 'net';
    let luong_chinh: number;
    let luong_bhxh: number;
    let trich_bhxh: boolean;
    const tinh_tncn = true;
    let ngay_bat_dau: Date;
    let ngay_ket_thuc: Date | null;

    if (i === 0 || i === 2) {
      // Thử việc — kèm E-dltl khấu trừ 10% tại nguồn (BR-dltl-026).
      loai_hd = 'thu_viec';
      kieu_luong = 'net';
      luong_chinh = randInt(5, 8) * 1_000_000;
      luong_bhxh = Math.round(luong_chinh * 0.5);
      trich_bhxh = i % 2 === 0;
      ngay_bat_dau = probationStart;
      ngay_ket_thuc = probationEnd;
    } else if (i === 1) {
      // Thời vụ — cùng nhóm khấu trừ tại nguồn.
      loai_hd = 'thoi_vu';
      kieu_luong = 'net';
      luong_chinh = randInt(6, 9) * 1_000_000;
      luong_bhxh = luong_chinh;
      trich_bhxh = false;
      ngay_bat_dau = probationStart;
      ngay_ket_thuc = probationEnd;
    } else if (i === 3 || i === 4) {
      // Lương vượt CẢ HAI trần bảo hiểm độc lập (BR-dltl-024): trần BHXH/BHYT 46.8tr,
      // trần BHTN 99.2tr — đặt > 99.2tr để vượt cả hai cùng lúc.
      loai_hd = pick(CONTRACT_TYPES_LONGTERM);
      kieu_luong = 'gross';
      luong_chinh = randInt(120, 150) * 1_000_000;
      luong_bhxh = luong_chinh;
      trich_bhxh = true;
      ngay_bat_dau = addMonthsUTC(TODAY, -randInt(6, 36));
      ngay_ket_thuc = null;
    } else if (i === 5 || i === 6) {
      // luong_bhxh KHÁC luong_chinh rõ rệt — kiểm tra đúng nguồn tính bảo hiểm riêng.
      loai_hd = pick(CONTRACT_TYPES_LONGTERM);
      kieu_luong = 'gross';
      luong_chinh = randInt(15, 30) * 1_000_000;
      luong_bhxh = Math.round(luong_chinh * 0.6);
      trich_bhxh = true;
      ngay_bat_dau = addMonthsUTC(TODAY, -randInt(6, 36));
      ngay_ket_thuc = null;
    } else {
      // Đa số: hợp đồng lao động dài hạn, tinh_tncn theo biểu lũy tiến.
      loai_hd = pick(CONTRACT_TYPES_LONGTERM);
      kieu_luong = pick(['gross', 'net'] as const);
      luong_chinh = randInt(8, 40) * 1_000_000;
      luong_bhxh = luong_chinh;
      trich_bhxh = i % 7 !== 0; // đa số true, xen kẽ vài người false
      ngay_bat_dau = addMonthsUTC(TODAY, -randInt(6, 60));
      ngay_ket_thuc = null;
    }

    const so_hd = `HD${CURRENT_YEAR}-${String(soHdSeq++).padStart(4, '0')}`;

    await createHopDong(db, {
      ma_nv: emp.ma_nv!,
      so_hd,
      loai_hd,
      kieu_luong,
      luong_chinh,
      luong_bhxh,
      ngay_bat_dau,
      ngay_ket_thuc,
      trich_bhxh,
      tinh_tncn,
      ghi_chu: null,
    } as never);

    contracts.push({ ma_nv: emp.ma_nv!, loai_hd, luong_chinh, luong_bhxh });
  }

  console.log(
    `[A.3] Đã tạo ${contracts.length} hợp đồng — 3 thử việc/thời vụ (khấu trừ 10%), ` +
      `2 lương vượt 2 trần BHXH/BHTN (>99.2tr), 2 luong_bhxh khác luong_chinh.`,
  );
  return contracts;
}

async function seedNguoiPhuThuoc(db: TenantDb, employees: SeedEmployee[]): Promise<number> {
  let mstSeq = 1;
  let total = 0;
  for (const emp of employees) {
    const soLuong = randInt(2, 4);
    for (let i = 0; i < soLuong; i++) {
      const mst = `888${String(mstSeq++).padStart(7, '0')}`; // 10 số, duy nhất TOÀN CÔNG TY
      await createNguoiPhuThuoc(db, {
        ma_nv: emp.ma_nv!,
        ho_ten: `Người phụ thuộc ${i + 1} - ${emp.ho_ten}`,
        quan_he: QUAN_HE_NPT[i % QUAN_HE_NPT.length],
        ngay_sinh: `01/01/${randInt(1960, 2020)}`,
        so_cccd: null,
        mst,
        dien_thoai: null,
        dia_chi: null,
        // Kỳ đăng ký PHỦ tháng hiện tại: từ đầu năm nay, không có mốc kết thúc.
        dk_tu_thang: 1,
        dk_tu_nam: CURRENT_YEAR,
        dk_den_thang: null,
        dk_den_nam: null,
      } as never);
      total++;
    }
  }
  console.log(`[A.4] Đã tạo ${total} người phụ thuộc (2-4 người/nhân viên, MST duy nhất toàn công ty).`);
  return total;
}

// ============================================================================================
// B. CẤU HÌNH MẶC ĐỊNH
// ============================================================================================

async function seedConfig(db: TenantDb): Promise<void> {
  await restoreDefault(db);
  console.log('[B.1] Đã khôi phục Cấu hình mặc định (restoreDefault) — biểu thuế 7 bậc chuẩn + 3 tham số mới ADR-010.');

  const shifts = [
    { name: 'Ca hành chính', startTime: '08:00', endTime: '17:00', breakMinutes: 60 }, // 8h chuẩn
    { name: 'Ca có tăng ca tự nhiên', startTime: '07:30', endTime: '19:00', breakMinutes: 60 }, // 10h
    { name: 'Ca đêm xuyên ca', startTime: '22:00', endTime: '06:00', breakMinutes: 30 }, // qua đêm, isOvernight=true
    { name: 'Ca nửa ngày sáng', startTime: '08:00', endTime: '12:00', breakMinutes: 0 }, // 4h
  ] as const;
  for (const s of shifts) {
    await createWorkShift(db, {
      code: undefined,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes,
      status: 'ACTIVE',
    } as never);
  }
  console.log(`[B.2] Đã tạo ${shifts.length} ca làm việc đa dạng (ngày/OT tự nhiên/qua đêm/nửa ngày).`);

  await quickGenerateHolidays(db, CURRENT_YEAR, false);
  console.log(`[B.3] Đã tạo nhanh 11 ngày lễ chuẩn Việt Nam cho năm ${CURRENT_YEAR} (quickGenerateHolidays).`);
}

// ============================================================================================
// C. CÀI ĐẶT LƯƠNG
// ============================================================================================

interface SalaryItemSpec {
  key: string;
  name: string;
  category: string;
  isSocialInsurance: boolean;
  isTaxable: boolean;
  isMealAllowance: boolean;
  defaultRate: number | null;
  description: string;
}

const SALARY_ITEM_SPECS: SalaryItemSpec[] = [
  {
    key: 'luong_co_ban',
    name: 'Lương cơ bản',
    category: 'FIXED_ALLOWANCE',
    isSocialInsurance: true,
    isTaxable: true,
    isMealAllowance: false,
    defaultRate: null,
    description: 'Khoản lương cố định hàng tháng, làm nền tính BHXH và đơn giá tăng ca.',
  },
  {
    key: 'an_trua',
    name: 'Phụ cấp ăn trưa',
    category: 'BENEFIT_ALLOWANCE',
    isSocialInsurance: false,
    isTaxable: true,
    isMealAllowance: true, // BR-dltl-027: miễn thuế tới trần 730.000đ/tháng
    defaultRate: null,
    description: 'Phụ cấp ăn ca/ăn trưa — miễn thuế TNCN tới trần theo quy định, phần vượt chịu thuế.',
  },
  {
    key: 'dien_thoai',
    name: 'Phụ cấp điện thoại',
    category: 'BENEFIT_ALLOWANCE',
    isSocialInsurance: false,
    isTaxable: false, // miễn thuế theo khai báo — KHÁC khoản ăn trưa (test riêng nhánh EXEMPT_DECLARED)
    isMealAllowance: false,
    defaultRate: null,
    description: 'Phụ cấp liên lạc, miễn thuế TNCN theo khai báo của kế toán.',
  },
  {
    key: 'trach_nhiem',
    name: 'Phụ cấp trách nhiệm',
    category: 'BENEFIT_ALLOWANCE',
    isSocialInsurance: false,
    isTaxable: true,
    isMealAllowance: false,
    defaultRate: null,
    description: 'Phụ cấp cho vị trí quản lý/tổ trưởng/thủ kho.',
  },
  {
    key: 'luong_giao_hang',
    name: 'Lương giao hàng',
    category: 'DELIVERY_PIECEWORK',
    isSocialInsurance: false,
    isTaxable: true,
    isMealAllowance: false,
    defaultRate: null,
    description: 'Trả theo số đơn/sản phẩm đã giao — nhân viên kho vận.',
  },
  {
    key: 'hoa_hong',
    name: 'Hoa hồng doanh số',
    category: 'COMMISSION_PERCENTAGE',
    isSocialInsurance: false,
    isTaxable: true,
    isMealAllowance: false,
    defaultRate: 3,
    description: 'Hoa hồng trên doanh số đã thu tiền — nhân viên kinh doanh.',
  },
  {
    key: 'thuong_kpi',
    name: 'Thưởng KPI',
    category: 'KPI_PERFORMANCE',
    isSocialInsurance: false,
    isTaxable: true,
    isMealAllowance: false,
    defaultRate: null,
    description: 'Thưởng theo mức hoàn thành chỉ tiêu KPI trong kỳ.',
  },
  {
    key: 'thuong_dinh_ky',
    name: 'Thưởng định kỳ',
    category: 'PERIODIC_BONUS',
    isSocialInsurance: false,
    isTaxable: true,
    isMealAllowance: false,
    defaultRate: null,
    description: 'Thưởng lễ/Tết, thưởng định kỳ theo quý/năm.',
  },
  {
    key: 'chuyen_can',
    name: 'Phụ cấp chuyên cần',
    category: 'ATTENDANCE_ALLOWANCE',
    isSocialInsurance: false,
    isTaxable: true,
    isMealAllowance: false,
    defaultRate: null,
    description: 'Mất một phần/toàn bộ khi vi phạm chuyên cần theo quy chế công ty.',
  },
];

async function seedSalaryItems(db: TenantDb): Promise<Record<string, string>> {
  const idByKey: Record<string, string> = {};
  for (const spec of SALARY_ITEM_SPECS) {
    const created = await createSalaryItem(db, {
      code: undefined,
      name: spec.name,
      category: spec.category,
      description: spec.description,
      isSocialInsurance: spec.isSocialInsurance,
      isTaxable: spec.isTaxable,
      isMealAllowance: spec.isMealAllowance,
      defaultRate: spec.defaultRate,
    } as never);
    idByKey[spec.key] = (created as { id: string }).id;
  }
  console.log(`[C.1] Đã tạo ${SALARY_ITEM_SPECS.length} khoản lương, phủ đủ 7/7 category (isMealAllowance + isTaxable=false đều có).`);
  return idByKey;
}

async function seedSalaryStructure(db: TenantDb, idByKey: Record<string, string>): Promise<void> {
  const items = [
    { salaryItemId: idByKey.luong_co_ban, taxTreatment: 'TAXABLE', isOvertimeBase: true, calculationMethod: 'MONTHLY_FIXED', defaultAmount: 1_000_000 },
    { salaryItemId: idByKey.an_trua, taxTreatment: 'TAXABLE', isOvertimeBase: false, calculationMethod: 'ACTUAL_WORKDAYS', defaultAmount: 900_000 },
    { salaryItemId: idByKey.dien_thoai, taxTreatment: 'EXEMPT', isOvertimeBase: false, calculationMethod: 'MONTHLY_FIXED', defaultAmount: 300_000 },
    { salaryItemId: idByKey.trach_nhiem, taxTreatment: 'TAXABLE', isOvertimeBase: false, calculationMethod: 'MONTHLY_FIXED', defaultAmount: 1_500_000 },
    { salaryItemId: idByKey.luong_giao_hang, taxTreatment: 'TAXABLE', isOvertimeBase: false, calculationMethod: 'OUTPUT_BASED', defaultAmount: 800_000 },
    { salaryItemId: idByKey.hoa_hong, taxTreatment: 'TAXABLE', isOvertimeBase: false, calculationMethod: 'REVENUE_PERCENTAGE', defaultAmount: 500_000 },
    { salaryItemId: idByKey.thuong_kpi, taxTreatment: 'TAXABLE', isOvertimeBase: false, calculationMethod: 'KPI_BASED', defaultAmount: 1_500_000 },
    { salaryItemId: idByKey.thuong_dinh_ky, taxTreatment: 'TAXABLE', isOvertimeBase: false, calculationMethod: 'MANUAL_ENTRY', defaultAmount: 2_000_000 },
    { salaryItemId: idByKey.chuyen_can, taxTreatment: 'TAXABLE', isOvertimeBase: false, calculationMethod: 'HOURLY', defaultAmount: 500_000 },
  ];

  await saveSalaryStructure(db, {
    effectiveFrom: isoDate(CURRENT_YEAR, 1, 1),
    effectiveTo: null,
    note: 'Cấu trúc lương mặc định — seed dữ liệu mẫu HRM/Payroll.',
    items,
  } as never);
  console.log(`[C.2] Đã tạo cấu trúc lương mặc định với ${items.length} khoản (Lương cơ bản đánh dấu isOvertimeBase=true).`);
}

async function seedEmployeeSalaries(
  db: TenantDb,
  employees: SeedEmployee[],
  idByKey: Record<string, string>,
  ownerId: string,
): Promise<void> {
  for (const emp of employees) {
    const items: { salaryItemId: string; amount: number }[] = [
      { salaryItemId: idByKey.luong_co_ban, amount: 1_000_000 + randInt(0, 5) * 100_000 },
      { salaryItemId: idByKey.an_trua, amount: 900_000 }, // cố ý vượt trần miễn thuế 730k (BR-dltl-027)
      { salaryItemId: idByKey.dien_thoai, amount: 300_000 },
      { salaryItemId: idByKey.chuyen_can, amount: 500_000 },
      { salaryItemId: idByKey.thuong_kpi, amount: 1_000_000 + randInt(0, 10) * 100_000 },
    ];

    const chucVuLower = emp.chuc_vu.toLowerCase();
    if (/trưởng|tổ trưởng|thủ kho|tổng hợp/.test(chucVuLower)) {
      items.push({ salaryItemId: idByKey.trach_nhiem, amount: 1_500_000 });
    }
    if (emp.deptName === 'Kho vận') {
      items.push({ salaryItemId: idByKey.luong_giao_hang, amount: 800_000 });
    }
    if (emp.deptName === 'Kinh doanh') {
      items.push({ salaryItemId: idByKey.hoa_hong, amount: 500_000 });
    }

    await setEmployeeSalary(db, emp.ma_nv!, { items } as never, ownerId);
  }
  const ketQua = await approveEmployeeSalaries(db, {} as never, ownerId);
  console.log(
    `[C.3] Đã set lương cho ${employees.length}/${employees.length} nhân viên, đã duyệt ` +
      `${(ketQua as { approvedCount: number }).approvedCount} bản (status=APPROVED).`,
  );
}

// ============================================================================================
// D. DỮ LIỆU TÍNH LƯƠNG (danh mục chuyên biệt + 8 phân hệ nhập liệu + khóa sổ)
// ============================================================================================

interface PayrollCatalogs {
  kpiItems: { id: string }[];
  products: { id: string }[];
  diligenceTypes: { theoGio: { id: string }; theoLan: { id: string }; matToanBo: { id: string } };
  adjustmentItems: { tamUng: { id: string }; boiThuong: { id: string }; hoanUng: { id: string } };
}

async function seedPayrollCatalogs(db: TenantDb): Promise<PayrollCatalogs> {
  const kpiA = await createKpiItem(db, { code: undefined, name: 'Doanh số bán hàng', unit: '%', defaultWeight: 50, status: 'ACTIVE' } as never);
  const kpiB = await createKpiItem(db, { code: undefined, name: 'Chất lượng công việc', unit: '%', defaultWeight: 30, status: 'ACTIVE' } as never);
  const kpiC = await createKpiItem(db, { code: undefined, name: 'Tỷ lệ đúng hạn', unit: '%', defaultWeight: 20, status: 'ACTIVE' } as never);

  const productA = await createProduct(db, { code: undefined, name: 'Sản phẩm hoàn thiện loại A', unit: 'cái', unitPrice: 50_000, status: 'ACTIVE' } as never);
  const productB = await createProduct(db, { code: undefined, name: 'Đơn hàng giao thành công', unit: 'đơn', unitPrice: 20_000, status: 'ACTIVE' } as never);

  const diLate = await createDiligenceType(db, { code: undefined, name: 'Đi trễ', deductionMethod: 'theo_gio', penaltyRate: 50_000, status: 'ACTIVE' } as never);
  const diAbsent = await createDiligenceType(db, { code: undefined, name: 'Nghỉ không phép', deductionMethod: 'theo_lan', penaltyRate: 200_000, status: 'ACTIVE' } as never);
  const diSevere = await createDiligenceType(db, { code: undefined, name: 'Vi phạm nội quy nghiêm trọng', deductionMethod: 'mat_toan_bo', penaltyRate: 0, status: 'ACTIVE' } as never);

  const adjAdvance = await createAdjustmentItem(db, { code: undefined, name: 'Tạm ứng lương', direction: 'tru', status: 'ACTIVE' } as never);
  const adjDamage = await createAdjustmentItem(db, { code: undefined, name: 'Bồi thường thiệt hại', direction: 'tru', status: 'ACTIVE' } as never);
  const adjRefund = await createAdjustmentItem(db, { code: undefined, name: 'Hoàn ứng dư', direction: 'bu', status: 'ACTIVE' } as never);

  console.log('[D.1] Đã tạo danh mục chuyên biệt: 3 KPI, 2 sản phẩm khoán, 3 lỗi chuyên cần, 3 khoản ứng-bù trừ.');

  return {
    kpiItems: [kpiA, kpiB, kpiC] as { id: string }[],
    products: [productA, productB] as { id: string }[],
    diligenceTypes: {
      theoGio: diLate as { id: string },
      theoLan: diAbsent as { id: string },
      matToanBo: diSevere as { id: string },
    },
    adjustmentItems: {
      tamUng: adjAdvance as { id: string },
      boiThuong: adjDamage as { id: string },
      hoanUng: adjRefund as { id: string },
    },
  };
}

/** Chọn `n` nhân viên xoay vòng theo `offset` — tránh 2 kỳ lương luôn chọn đúng cùng một nhóm. */
function rotateEmployees(employees: SeedEmployee[], offset: number, n: number): SeedEmployee[] {
  return Array.from({ length: Math.min(n, employees.length) }, (_, k) => employees[(offset + k) % employees.length]);
}

async function seedPayrollPeriodData(
  db: TenantDb,
  employees: SeedEmployee[],
  catalogs: PayrollCatalogs,
  idByKey: Record<string, string>,
  year: number,
  month: number,
): Promise<string> {
  const period = await createPayrollPeriod(db, { month, year, name: `Kỳ lương tháng ${month}/${year}` } as never);
  const periodId = (period as { id: string }).id;
  const offset = month % employees.length;

  // 1. Chấm công — mô hình DELTA, chỉ tạo bản ghi cho người có ngày công KHÁC chuẩn.
  const attTypes = ['nghi_phep', 'om', 'khong_luong'] as const;
  const attSample = rotateEmployees(employees, offset, 3);
  for (let i = 0; i < attSample.length; i++) {
    await overrideAttendanceCell(db, {
      periodId,
      ma_nv: attSample[i].ma_nv!,
      workDate: isoDate(year, month, 8 + i * 2),
      attendanceType: attTypes[i % attTypes.length],
      note: 'Seed dữ liệu mẫu — chấm công ngoại lệ',
    } as never);
  }

  // 2. Tăng ca — đa dạng loại (150%/200%/300%-tương-đương ngày/đêm/lễ).
  const otItemSets = [
    [{ otType: 'ngay_thuong_ngay', hours: 4 }],
    [{ otType: 'chu_nhat_ngay', hours: 3 }],
    [{ otType: 'ngay_le_ngay', hours: 2 }],
    [{ otType: 'ngay_thuong_dem', hours: 5 }],
  ];
  const otSample = rotateEmployees(employees, offset + 1, 4);
  for (let i = 0; i < otSample.length; i++) {
    await applyOvertime(db, {
      periodId,
      scope: 'nhan_vien',
      employeeIds: [otSample[i].ma_nv!],
      items: otItemSets[i % otItemSets.length],
    } as never);
  }

  // 3. KPI
  const kpiSample = rotateEmployees(employees, offset + 2, 3);
  for (const emp of kpiSample) {
    await applyKpi(db, {
      periodId,
      scope: 'nhan_vien',
      employeeIds: [emp.ma_nv!],
      items: [
        { kpiItemId: catalogs.kpiItems[0].id, weight: 50, targetValue: 100, actualValue: randInt(70, 110) },
        { kpiItemId: catalogs.kpiItems[1].id, weight: 30, targetValue: 100, actualValue: randInt(80, 100) },
        { kpiItemId: catalogs.kpiItems[2].id, weight: 20, targetValue: 100, actualValue: randInt(85, 100) },
      ],
    } as never);
  }

  // 4. Thưởng
  const bonusSample = rotateEmployees(employees, offset + 3, 4);
  for (const emp of bonusSample) {
    await applyBonus(db, {
      periodId,
      scope: 'nhan_vien',
      employeeIds: [emp.ma_nv!],
      items: [{ salaryItemId: idByKey.thuong_dinh_ky, amount: randInt(5, 20) * 100_000 }],
    } as never);
  }

  // 5. Lương sản phẩm — Sản xuất
  const pieceworkSample = employees.filter((e) => e.deptName === 'Sản xuất');
  for (const emp of pieceworkSample) {
    await applyPiecework(db, {
      periodId,
      scope: 'nhan_vien',
      employeeIds: [emp.ma_nv!],
      items: [{ productId: catalogs.products[0].id, quantity: randInt(40, 100) }],
    } as never);
  }

  // 6. Lương % — Kinh doanh
  const commissionSample = employees.filter((e) => e.deptName === 'Kinh doanh');
  for (const emp of commissionSample) {
    await applyCommission(db, {
      periodId,
      scope: 'nhan_vien',
      employeeIds: [emp.ma_nv!],
      items: [{ salaryItemId: idByKey.hoa_hong, baseAmount: randInt(30, 80) * 1_000_000 }],
    } as never);
  }

  // 7. Chuyên cần — 1-2 người có vi phạm.
  const diligenceSample = rotateEmployees(employees, offset + 4, 2);
  if (diligenceSample[0]) {
    await recordDiligenceViolation(db, {
      periodId,
      ma_nv: diligenceSample[0].ma_nv!,
      violationTypeId: catalogs.diligenceTypes.theoGio.id,
      violationDate: isoDate(year, month, 15),
      violationHours: 2,
      note: 'Đi trễ 2 giờ',
    } as never);
  }
  if (diligenceSample[1]) {
    await recordDiligenceViolation(db, {
      periodId,
      ma_nv: diligenceSample[1].ma_nv!,
      violationTypeId: catalogs.diligenceTypes.theoLan.id,
      violationDate: isoDate(year, month, 20),
      note: 'Nghỉ không phép 1 buổi',
    } as never);
  }

  // 8. Ứng - bù trừ
  const adjSample = rotateEmployees(employees, offset + 5, 2);
  if (adjSample[0]) {
    await applyAdjustments(db, {
      periodId,
      scope: 'nhan_vien',
      employeeIds: [adjSample[0].ma_nv!],
      items: [{ adjustmentItemId: catalogs.adjustmentItems.tamUng.id, amount: 1_000_000 }],
    } as never);
  }
  if (adjSample[1]) {
    await applyAdjustments(db, {
      periodId,
      scope: 'nhan_vien',
      employeeIds: [adjSample[1].ma_nv!],
      items: [{ adjustmentItemId: catalogs.adjustmentItems.hoanUng.id, amount: 300_000 }],
    } as never);
  }

  console.log(`[D.2] Kỳ ${year}-${pad2(month)} (id=${periodId}): đã nạp đủ 8 phân hệ nhập liệu.`);
  return periodId;
}

// ============================================================================================
// E. XÓA SẠCH DOMAIN HRM CỦA TENANT (wipe-then-rebuild — xem ghi chú đầu file)
// ============================================================================================

async function wipeHrmDomain(db: TenantDb): Promise<void> {
  // Thứ tự AN TOÀN theo ràng buộc FK (cascade/restrict) — xem giải thích ở đầu file.
  await db.payrollPeriod.deleteMany({}); // cascade: 8 bảng biến động theo kỳ + payrollSheetLine
  await db.employeeSalary.deleteMany({}); // cascade: employeeSalaryItem
  await db.salaryStructure.deleteMany({}); // cascade: salaryStructureItem
  await db.salaryItem.deleteMany({}); // an toàn: mọi FK restrict trỏ vào đã xóa ở trên
  await db.kpiItem.deleteMany({});
  await db.pieceworkProduct.deleteMany({});
  await db.diligenceViolationType.deleteMany({});
  await db.salaryAdjustmentItem.deleteMany({});
  await db.hrm_nhan_vien.deleteMany({}); // cascade: hop_dong, nguoi_phu_thuoc, tai_lieu(+file)
  await db.hrm_phong_ban.deleteMany({});
  await db.workShift.deleteMany({});
  await db.holiday.deleteMany({});
  console.log('[E] Đã xóa sạch toàn bộ dữ liệu HRM/Payroll cũ của tenant (chuẩn bị dựng lại).');
}

// ============================================================================================
// F. SANITY CHECK — in thu nhập/thực lĩnh vài nhân viên mẫu để soát số không vô lý
// ============================================================================================

async function sanityCheck(
  db: TenantDb,
  periods: { label: string; id: string }[],
): Promise<void> {
  console.log('\n===== SANITY CHECK: thu nhập & thực lĩnh vài nhân viên mẫu =====');
  for (const p of periods) {
    const lines = (await getPayrollSheetLines(db, p.id)) as Array<{
      employeeCode: string;
      fullName: string;
      grossIncome: unknown;
      netTakeHomeSalary: unknown;
    }>;
    console.log(`\n-- Kỳ ${p.label} (periodId=${p.id}) — ${lines.length} dòng --`);
    for (const l of lines.slice(0, 5)) {
      const gross = Number(l.grossIncome);
      const net = Number(l.netTakeHomeSalary);
      console.log(
        `  ${l.employeeCode} - ${l.fullName}: gross=${gross.toLocaleString('vi-VN')}đ, net=${net.toLocaleString('vi-VN')}đ`,
      );
      if (!Number.isFinite(gross) || gross < 0 || gross > 500_000_000) {
        console.warn(`    !! CẢNH BÁO: gross bất thường (${gross}) cho ${l.employeeCode}`);
      }
      if (!Number.isFinite(net) || net < -50_000_000 || net > 500_000_000) {
        console.warn(`    !! CẢNH BÁO: net bất thường (${net}) cho ${l.employeeCode}`);
      }
    }
  }
}

// ============================================================================================
// MAIN
// ============================================================================================

async function main(): Promise<void> {
  console.log('================================================================');
  console.log(' SEED DỮ LIỆU MẪU HRM/PAYROLL — dev tooling (KHÔNG chạy production)');
  console.log('================================================================\n');

  const cp = await ensureControlPlaneTestTenant();
  if (cp.mst !== '0111142786' || cp.dbName !== 'maxv_0111142786_app') {
    throw new Error(`An toàn: control-plane trả về tenant không đúng dự kiến (${cp.mst}/${cp.dbName}) — dừng lại.`);
  }

  const db = getTenantDb(cp.dbName);

  await wipeHrmDomain(db);

  // B. Cấu hình mặc định / ca làm việc / ngày lễ
  await seedConfig(db);

  // A. Tổ chức & nhân sự
  const phongBanMap = await seedPhongBan(db);
  const employees = buildEmployeePlan(phongBanMap);
  await seedNhanVien(db, employees);
  await seedHopDong(db, employees);
  const soNpt = await seedNguoiPhuThuoc(db, employees);

  // C. Cài đặt lương
  const idByKey = await seedSalaryItems(db);
  await seedSalaryStructure(db, idByKey);
  await seedEmployeeSalaries(db, employees, idByKey, cp.ownerId);

  // D. Dữ liệu tính lương
  const catalogs = await seedPayrollCatalogs(db);

  const prevPeriodId = await seedPayrollPeriodData(db, employees, catalogs, idByKey, PREV_YEAR, PREV_MONTH);
  const currentPeriodId = await seedPayrollPeriodData(db, employees, catalogs, idByKey, CURRENT_YEAR, CURRENT_MONTH);

  // Khóa sổ kỳ THÁNG TRƯỚC qua đúng pipeline thật (snapshotPayrollSheet bên trong lockPayrollPeriod).
  await lockPayrollPeriod(db, prevPeriodId, cp.ownerId);
  console.log(`[D.3] Đã KHÓA SỔ kỳ ${PREV_YEAR}-${pad2(PREV_MONTH)} (id=${prevPeriodId}) — trạng thái LOCKED, snapshot đã chốt.`);
  console.log(`[D.3] Kỳ ${CURRENT_YEAR}-${pad2(CURRENT_MONTH)} (id=${currentPeriodId}) giữ nguyên trạng thái DRAFT.`);

  await sanityCheck(db, [
    { label: `${PREV_YEAR}-${pad2(PREV_MONTH)} (LOCKED)`, id: prevPeriodId },
    { label: `${CURRENT_YEAR}-${pad2(CURRENT_MONTH)} (DRAFT)`, id: currentPeriodId },
  ]);

  console.log('\n================================================================');
  console.log(' TÓM TẮT DỮ LIỆU ĐÃ TẠO');
  console.log('================================================================');
  console.log(`  Phòng ban:              ${DEPARTMENTS.length}`);
  console.log(`  Nhân viên:               ${employees.length}`);
  console.log(`  Hợp đồng:                ${employees.length}`);
  console.log(`  Người phụ thuộc:         ${soNpt}`);
  console.log(`  Khoản lương (7 category):${SALARY_ITEM_SPECS.length}`);
  console.log('  Cấu trúc lương:          1 (active)');
  console.log(`  Set lương nhân viên:     ${employees.length} (status=APPROVED)`);
  console.log('  Ca làm việc:             4');
  console.log(`  Ngày lễ:                 11 (năm ${CURRENT_YEAR})`);
  console.log('  Danh mục KPI/Sản phẩm/Chuyên cần/Ứng-bù trừ: 3 + 2 + 3 + 3');
  console.log(`  Kỳ lương:                2 (${PREV_YEAR}-${pad2(PREV_MONTH)} LOCKED, ${CURRENT_YEAR}-${pad2(CURRENT_MONTH)} DRAFT)`);
  console.log('\n  Đăng nhập UI để test tay:');
  console.log(`    Email:      ${SEED_OWNER_EMAIL}`);
  console.log('    Mật khẩu:   (giá trị SEED_OWNER_PASSWORD trong .env)');
  console.log(`    Công ty:    MST ${cp.mst}`);
  console.log('================================================================\n');
}

main()
  .catch((err) => {
    console.error('\n[FATAL] Seed thất bại:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectAllTenants();
    await sysPrisma.$disconnect();
  });
