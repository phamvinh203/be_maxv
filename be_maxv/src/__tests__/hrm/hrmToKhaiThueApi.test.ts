/**
 * KIỂM THỬ TÍCH HỢP HTTP (app.inject) — QA Phase B sub-cụm HRM `to_khai_thue`:
 *   Danh mục thu nhập ngoài lương · Bản ghi thu nhập ngoài lương · Bảng tính thuế tháng ·
 *   Tờ khai 05/KK-TNCN quý · Chính sách thuế
 *
 * Bộ ca: TC-tkt-001 … TC-tkt-126 (docs/hrm/to_khai_thue/test-cases-to-khai-thue.md) + ca kiểm riêng
 * KR-tkt-* cho điểm bộ ca chưa phủ.
 *
 *   NHAT_KY_TKT=<file.json> npx tsx --experimental-test-module-mocks --test src/__tests__/hrm/hrmToKhaiThueApi.test.ts
 *
 * ĐƯỜNG DẪN & TRƯỜNG theo `api-contract-to-khai-thue.md` (bản chính thức), KHÔNG theo đường suy đoán lúc
 * thiết kế ca (`danh-muc-thu-nhap`, `bang-tinh-thue/T9-2026/chot`, `soTienChiTra`, `indicator`…) — đúng
 * việc TC-tkt-124 yêu cầu làm đầu Phase B. Kỳ vọng nghiệp vụ giữ nguyên; chỗ hợp đồng đã chốt khác bộ ca
 * (mã lỗi, status) thì kiểm theo hợp đồng và ghi chú ngay tại ca.
 *
 * MÔI TRƯỜNG: tự cấp hai DB tenant riêng (`maxv_9970000021_app`, `maxv_9970000022_app`) rồi DROP lúc dọn,
 * KHÔNG ghi vào tenant thật. Đăng nhập đúng đường sản phẩm (login → cookie → switch công ty). Kỳ lương tạo
 * và khóa sổ qua API thật; chỉ dữ liệu gốc ngoài phạm vi bộ ca (chính sách thuế, nhân viên, hợp đồng, người
 * phụ thuộc) nạp thẳng DB.
 *
 * CHƯA PHỦ Ở ĐÂY: xuất PDF (Puppeteer giữ tiến trình test sống) — kiểm riêng ngoài bộ này.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { sysPrisma } from '../../config/db.sys';
import { hashPassword } from '../../utils/password';
import { tenantSlug, tenantDbName } from '../../utils/dbName';
import { provisionTenant, dropTenant } from '../../services/shared/provisioning.service';
import { getTenantDb } from '../../helpers/tenantClient';
import { readZipEntry } from '../../helpers/zip';
import type { Prisma } from '../../generated/tenant';
import { CHINH_SACH_THUE_SEED } from '../../constants/hrm/to_khai_thue/taxSeedData';
import { tinhThueLuyTien } from '../../services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service';
import { batBuocDbKiemThu, matKhauNgauNhien } from '../_hoTro/dbKiemThu';

// ---------------------------------------------------------------- dữ liệu cố định của bộ test

// Sinh mới mỗi lượt chạy — không để mật khẩu tài khoản test nằm trong repo (vbsec 2026-09-10).
const PW = matKhauNgauNhien();
const OWNER_EMAIL = 'qa.tkt.owner@test.local';
const KETOAN_EMAIL = 'qa.tkt.ketoan@test.local';
const NHANSU_EMAIL = 'qa.tkt.nhansu@test.local';
const MST_A = '9970000021';
const MST_B = '9970000022';
const PLAN_MA = 'QA_TKT_PLAN';
const DB_A = tenantDbName(MST_A);
const DB_B = tenantDbName(MST_B);

let app: FastifyInstance;
let ownerId = '';
let donViA = '';
let donViB = '';
let veOwnerA = ''; // OWNER + công ty A
let veOwnerB = ''; // OWNER + công ty B
let veKeToanA = ''; // OWNER_EMPLOYEE CÓ quyền xem lương, KHÔNG phải ADMIN/OWNER
let veNhanSuA = ''; // OWNER_EMPLOYEE KHÔNG có quyền xem lương

// ---------------------------------------------------------------- sổ ghi kết quả (bằng chứng)

interface DongNhatKy {
  tc: string;
  buoc: string;
  method: string;
  url: string;
  status: number;
  than: string;
}
const NHAT_KY: DongNhatKy[] = [];

function catGon(s: string, n = 1500): string {
  return s.length <= n ? s : `${s.slice(0, n)}…[cắt ${s.length - n} ký tự]`;
}

interface KetQuaGoi {
  status: number;
  json: any;
  raw: string;
  headers: Record<string, unknown>;
  buf: Buffer;
}

async function goi(
  tc: string,
  buoc: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  opts: { ve?: string; payload?: unknown } = {},
): Promise<KetQuaGoi> {
  const res = await app.inject({
    method,
    url,
    ...(opts.ve ? { cookies: { accessToken: opts.ve } } : {}),
    ...(opts.payload !== undefined ? { payload: opts.payload as object } : {}),
  });
  const loai = String(res.headers['content-type'] ?? '');
  const laJson = loai.includes('application/json');
  // File nhị phân (xlsx) không in ra nhật ký — chỉ ghi loại + kích thước.
  const raw = laJson ? res.body : `[${loai || 'không thân'} · ${res.rawPayload.length} byte]`;
  let json: any = null;
  if (laJson) {
    try {
      json = JSON.parse(res.body);
    } catch {
      json = null;
    }
  }
  NHAT_KY.push({ tc, buoc, method, url, status: res.statusCode, than: catGon(raw) });
  return { status: res.statusCode, json, raw, headers: res.headers, buf: res.rawPayload };
}

/** Lỗi nghiệp vụ: đúng HTTP status VÀ đúng mã ở trường `code` (hợp đồng Mục 0.2). */
function kiemLoi(r: KetQuaGoi, status: number, code: string): void {
  assert.equal(r.status, status, `kỳ vọng ${status} ${code}, thực tế ${r.status}: ${r.raw}`);
  assert.equal(r.json?.code, code, `kỳ vọng mã ${code}, thực tế: ${r.raw}`);
}

// ---------------------------------------------------------------- dựng / dọn môi trường

async function cleanup() {
  const users = await sysPrisma.user.findMany({
    where: { email: { in: [OWNER_EMAIL, KETOAN_EMAIL, NHANSU_EMAIL] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await sysPrisma.sysLog.deleteMany({ where: { userId: { in: ids } } });
  }
  const dv = await sysPrisma.donVi.findMany({
    where: { maSoThue: { in: [MST_A, MST_B] } },
    select: { id: true },
  });
  if (dv.length > 0) {
    await sysPrisma.sysLog.deleteMany({ where: { donViId: { in: dv.map((d) => d.id) } } });
  }
  await sysPrisma.donVi.deleteMany({ where: { maSoThue: { in: [MST_A, MST_B] } } });
  if (ids.length > 0) {
    await sysPrisma.subscription.deleteMany({ where: { ownerId: { in: ids } } });
  }
  await sysPrisma.subscriptionPlan.deleteMany({ where: { ma: PLAN_MA } });
  // Nhân viên trỏ `ownerId` về chủ ⇒ xóa nhân viên trước.
  await sysPrisma.user.deleteMany({ where: { email: { in: [KETOAN_EMAIL, NHANSU_EMAIL] } } });
  await sysPrisma.user.deleteMany({ where: { email: OWNER_EMAIL } });
  await dropTenant(DB_A);
  await dropTenant(DB_B);
}

/** Lấy cookie accessToken sau khi đăng nhập + chọn công ty. */
async function layVe(email: string, donViId: string): Promise<string> {
  const dn = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: PW },
  });
  assert.equal(dn.statusCode, 200, `đăng nhập ${email} hỏng: ${dn.body}`);
  const c1 = dn.cookies.find((c) => c.name === 'accessToken');
  assert.ok(c1, `không thấy cookie accessToken sau login ${email}`);

  const doi = await app.inject({
    method: 'POST',
    url: `/api/v1/companies/${donViId}/switch`,
    cookies: { accessToken: c1.value },
  });
  assert.equal(doi.statusCode, 200, `đổi công ty hỏng: ${doi.body}`);
  const c2 = doi.cookies.find((c) => c.name === 'accessToken');
  assert.ok(c2, 'không thấy cookie accessToken sau switch');
  return c2.value;
}

// ---------------------------------------------------------------- tiện ích nghiệp vụ

const BASE = '/api/v1/hrm';
const TKT = `${BASE}/to-khai-thue`;
const dbA = () => getTenantDb(DB_A);
const dbB = () => getTenantDb(DB_B);
const ngay = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** id kỳ lương tenant A (năm 2026) theo tháng. */
const KY: Record<number, string> = {};
/** id danh mục theo mã (TN01…) và id bản ghi theo nhãn ca. */
const DM: Record<string, string> = {};
const BG: Record<string, string> = {};

async function napChinhSachThue(db: ReturnType<typeof getTenantDb>) {
  for (const cs of CHINH_SACH_THUE_SEED) {
    await db.taxPolicy.create({
      data: {
        effectiveFrom: ngay(cs.effectiveFrom),
        personalDeduction: cs.personalDeduction,
        dependentDeduction: cs.dependentDeduction,
        taxBrackets: cs.taxBrackets as unknown as Prisma.InputJsonValue,
        withholdingTaxRate: cs.withholdingTaxRate,
        withholdingTaxThreshold: cs.withholdingTaxThreshold,
        voluntaryPensionMonthlyCap: cs.voluntaryPensionMonthlyCap,
        lunchAllowanceTaxFreeCap: cs.lunchAllowanceTaxFreeCap,
        legalBasisNote: cs.legalBasisNote,
      },
    });
  }
}

interface NhanVienMau {
  ma_nv: string;
  ho_ten: string;
  loai_hd: string;
  luong: number;
  bhxh: boolean;
  tu: string;
  den?: string;
}

/**
 * Nhân sự tenant A — mỗi người phục vụ một nhóm ca, số tiền chọn để tính tay được:
 *   NV0001 lương 20tr, không BH           → TC-061 (gộp 5tr TAXABLE_FULL ⇒ TNTT 9,5tr, thuế 475.000)
 *   NV0002 thử việc 8tr (T7–T9)           → TC-064 (khấu trừ 10% lương + 10% hoa hồng, hai cơ chế độc lập)
 *   NV0003 lương 44,5tr, không BH         → TC-062 (TNTT riêng lương 29tr, gộp 3tr đổi bậc ⇒ 2.900.000)
 *   NV0004 lương 30tr, CÓ BH 10,5%        → TC-052b/065/111 (đối chiếu engine lương)
 *   NV0005 vào làm từ 01/08/2026          → TC-103 (vào giữa quý)
 *   NV0006 lương 25tr + NPT từ 9/2026     → TC-106 (giảm trừ phụ thuộc theo tháng đăng ký)
 *   NV0007 hợp đồng từ 01/10/2026         → KR-tkt-03 (không có thu nhập cả quý III)
 */
const NHAN_VIEN: NhanVienMau[] = [
  { ma_nv: 'NV0001', ho_ten: 'Nguyễn Văn Một', loai_hd: 'khong_xac_dinh', luong: 20_000_000, bhxh: false, tu: '2026-01-01' },
  { ma_nv: 'NV0002', ho_ten: 'Trần Thị Hai', loai_hd: 'thu_viec', luong: 8_000_000, bhxh: false, tu: '2026-07-01', den: '2026-09-30' },
  { ma_nv: 'NV0003', ho_ten: 'Lê Văn Ba', loai_hd: 'khong_xac_dinh', luong: 44_500_000, bhxh: false, tu: '2026-01-01' },
  { ma_nv: 'NV0004', ho_ten: 'Phạm Thị Bốn', loai_hd: 'khong_xac_dinh', luong: 30_000_000, bhxh: true, tu: '2026-01-01' },
  { ma_nv: 'NV0005', ho_ten: 'Hoàng Văn Năm', loai_hd: 'khong_xac_dinh', luong: 15_000_000, bhxh: false, tu: '2026-08-01' },
  { ma_nv: 'NV0006', ho_ten: 'Vũ Thị Sáu', loai_hd: 'khong_xac_dinh', luong: 25_000_000, bhxh: false, tu: '2026-01-01' },
  { ma_nv: 'NV0007', ho_ten: 'Đỗ Văn Bảy', loai_hd: 'khong_xac_dinh', luong: 12_000_000, bhxh: false, tu: '2026-10-01' },
];

async function napNhanSuTenantA() {
  const db = dbA();
  for (const nv of NHAN_VIEN) {
    await db.hrm_nhan_vien.create({
      data: { ma_nv: nv.ma_nv, ho_ten: nv.ho_ten, ngay_vao_lam: ngay(nv.tu) },
    });
    await db.hrm_hop_dong.create({
      data: {
        id: randomUUID(),
        ma_nv: nv.ma_nv,
        so_hd: `QA-TKT-${nv.ma_nv}`,
        loai_hd: nv.loai_hd,
        kieu_luong: 'gross',
        luong_chinh: nv.luong,
        luong_bhxh: nv.luong,
        ngay_bat_dau: ngay(nv.tu),
        ngay_ket_thuc: nv.den ? ngay(nv.den) : null,
        trich_bhxh: nv.bhxh,
        tinh_tncn: true,
      },
    });
  }
  // TC-tkt-106: người phụ thuộc đăng ký hiệu lực từ tháng 9/2026.
  await db.hrm_nguoi_phu_thuoc.create({
    data: {
      id: randomUUID(),
      ma_nv: 'NV0006',
      ho_ten: 'Vũ Minh Con',
      quan_he: 'con',
      dk_tu_thang: 9,
      dk_tu_nam: 2026,
    },
  });
}

async function taoKy(ve: string, thang: number, nam = 2026): Promise<string> {
  const r = await goi('SETUP', `tạo kỳ lương ${thang}/${nam}`, 'POST', `${BASE}/payroll-periods`, {
    ve,
    payload: { month: thang, year: nam, name: `Kỳ lương ${thang}/${nam}` },
  });
  assert.equal(r.status, 201, r.raw);
  return r.json.data.id;
}

async function khoaSoKyLuong(ve: string, periodId: string): Promise<void> {
  const r = await goi('SETUP', 'khóa sổ kỳ lương', 'POST', `${BASE}/payroll-periods/${periodId}/lock`, {
    ve,
    payload: {},
  });
  assert.equal(r.status, 200, r.raw);
}

async function chotThang(ve: string, periodId: string, tc = 'SETUP') {
  const r = await goi(tc, 'chốt bảng tính thuế tháng', 'POST', `${TKT}/tax-calculation/lock`, {
    ve,
    payload: { periodId },
  });
  assert.equal(r.status, 200, r.raw);
  return r.json.data;
}

const LY_DO_MO_LAI = 'Kiểm thử QA: mở lại tháng để sửa khoản chi trả ghi nhầm';

async function moLaiThang(ve: string, periodId: string, tc = 'SETUP') {
  const r = await goi(tc, 'mở lại bảng tính thuế tháng', 'POST', `${TKT}/tax-calculation/unlock`, {
    ve,
    payload: { periodId, lyDo: LY_DO_MO_LAI },
  });
  assert.equal(r.status, 200, r.raw);
  return r.json.data;
}

async function bangThue(ve: string, periodId: string, tc: string) {
  const r = await goi(tc, 'GET bảng tính thuế', 'GET', `${TKT}/tax-calculation?periodId=${periodId}`, { ve });
  assert.equal(r.status, 200, r.raw);
  return r.json.data;
}

function dongCua(bang: any, id: string): any {
  const d = bang.danhSach.find((x: any) => x.id === id);
  assert.ok(d, `bảng tính thuế không có dòng ${id}`);
  return d;
}

async function toKhaiQuy(ve: string, quy: number, tc: string) {
  const r = await goi(tc, `GET tờ khai Q${quy}/2026`, 'GET', `${TKT}/05-kk-tncn?nam=2026&quy=${quy}`, { ve });
  assert.equal(r.status, 200, r.raw);
  return r.json.data;
}

before(async () => {
  batBuocDbKiemThu();
  app = await buildApp({ logger: false });
  await app.ready();
  await cleanup();

  const pwHash = await hashPassword(PW);
  const owner = await sysPrisma.user.create({
    data: { email: OWNER_EMAIL, hoTen: 'QA TKT Owner', password: pwHash, role: 'OWNER', status: 'ACTIVE', isActive: true },
  });
  ownerId = owner.id;
  const keToan = await sysPrisma.user.create({
    data: { email: KETOAN_EMAIL, hoTen: 'QA TKT Kế toán', password: pwHash, role: 'OWNER_EMPLOYEE', status: 'ACTIVE', isActive: true, ownerId },
  });
  const nhanSu = await sysPrisma.user.create({
    data: { email: NHANSU_EMAIL, hoTen: 'QA TKT Nhân sự', password: pwHash, role: 'OWNER_EMPLOYEE', status: 'ACTIVE', isActive: true, ownerId },
  });

  const plan = await sysPrisma.subscriptionPlan.create({
    data: {
      ma: PLAN_MA,
      ten: 'QA TKT',
      gia: 0,
      chuKyThang: 1,
      soMstToiDa: 5,
      soNguoiToiDa: 5,
      features: { hrm: true, dvc: true, tokhai: true, accounting: true },
    },
  });
  await sysPrisma.subscription.create({ data: { ownerId, planId: plan.id, status: 'ACTIVE' } });

  const a = await sysPrisma.donVi.create({
    data: {
      ownerId,
      maSoThue: MST_A,
      slug: tenantSlug(MST_A),
      tenDonVi: 'QA TKT Tenant A',
      diaChi: '1 Phố Kiểm Thử, Hà Nội',
      status: 'PROVISIONING',
    },
  });
  donViA = a.id;
  const b = await sysPrisma.donVi.create({
    data: { ownerId, maSoThue: MST_B, slug: tenantSlug(MST_B), tenDonVi: 'QA TKT Tenant B', status: 'PROVISIONING' },
  });
  donViB = b.id;

  await provisionTenant(donViA, MST_A);
  await provisionTenant(donViB, MST_B);

  await sysPrisma.donViAccess.create({ data: { userId: keToan.id, donViId: donViA, xemLuong: true } });
  await sysPrisma.donViAccess.create({ data: { userId: nhanSu.id, donViId: donViA, xemLuong: false } });

  // Tenant B CỐ Ý chưa có chính sách thuế — dùng cho E-tkt-015 trước khi nạp.
  await napChinhSachThue(dbA());
  await napNhanSuTenantA();

  veOwnerA = await layVe(OWNER_EMAIL, donViA);
  veOwnerB = await layVe(OWNER_EMAIL, donViB);
  veKeToanA = await layVe(KETOAN_EMAIL, donViA);
  veNhanSuA = await layVe(NHANSU_EMAIL, donViA);

  // Kỳ lương qua API thật: Q2 (T4–T6) cho lịch sử tờ khai, Q3 (T7–T9) cho luồng chính, T10–T11 cho bản
  // ghi nháp. CỐ Ý không tạo T12 ⇒ Q4 thiếu hẳn một kỳ (TC-tkt-081).
  for (const thang of [4, 5, 6, 7, 8, 9, 10, 11]) {
    KY[thang] = await taoKy(veOwnerA, thang);
  }
});

after(async () => {
  const tep = process.env.NHAT_KY_TKT;
  if (tep) writeFileSync(tep, JSON.stringify(NHAT_KY, null, 1), 'utf8');
  console.log(
    `NHẬT KÝ: ${NHAT_KY.length} lượt gọi HTTP` +
      (tep ? ` — đã ghi nguyên văn vào ${tep}` : ' (đặt NHAT_KY_TKT=<file> để lưu nguyên văn)'),
  );
  await cleanup();
  await app.close();
  await sysPrisma.$disconnect();
});

// ================================================================================
// NHÓM 1 — DANH MỤC LOẠI THU NHẬP NGOÀI LƯƠNG (TC-tkt-001…013, 048, 100, 117…119)
// ================================================================================

test('Nhóm 1 — Danh mục loại thu nhập ngoài lương', async (t) => {
  await t.test('TC-tkt-004 — GET lần đầu trên tenant trắng tự sinh danh mục chuẩn ("Ăn ca tiền mặt" 1.200.000/tháng)', async () => {
    assert.equal(await dbA().otherIncomeCategory.count(), 0, 'tiền điều kiện: tenant A chưa có danh mục');
    const r = await goi('TC-tkt-004', 'GET lần đầu', 'GET', `${TKT}/income-categories`, { ve: veOwnerA });
    assert.equal(r.status, 200, r.raw);
    for (const d of r.json.data) DM[d.code] = d.id;
    const anCa = r.json.data.find((d: any) => d.code === 'TN09');
    assert.ok(anCa, r.raw);
    assert.equal(anCa.taxTreatmentGroup, 'EXEMPT_CAPPED');
    assert.equal(anCa.exemptCapAmount, 1_200_000);
    assert.equal(anCa.exemptCapPeriod, 'MONTHLY');
  });

  await t.test('TC-tkt-005 — đủ 12 danh mục chuẩn (data-model Mục 7.2), đủ đại diện 4 nhóm', async () => {
    const r = await goi('TC-tkt-005', 'GET lần 2 (không sinh thêm)', 'GET', `${TKT}/income-categories`, { ve: veOwnerA });
    assert.equal(r.status, 200, r.raw);
    const ds = r.json.data;
    assert.equal(ds.length, 12, 'GET lần 2 không được sinh thêm');
    const dem = (g: string) => ds.filter((d: any) => d.taxTreatmentGroup === g).length;
    assert.deepEqual(
      [dem('EXEMPT_FULL'), dem('EXEMPT_CAPPED'), dem('TAXABLE_FULL'), dem('WITHHOLDING_FLAT')],
      [8, 2, 1, 1],
    );
    const theoMa = Object.fromEntries(ds.map((d: any) => [d.code, d]));
    assert.equal(theoMa.TN08.taxTreatmentGroup, 'EXEMPT_FULL', 'Ăn ca DN tự nấu thuộc nhóm miễn toàn bộ (BA 2026-09-14)');
    assert.equal(theoMa.TN10.exemptCapAmount, 5_000_000);
    assert.equal(theoMa.TN10.exemptCapPeriod, 'YEARLY');
    assert.equal(theoMa.TN11.taxTreatmentGroup, 'TAXABLE_FULL');
    assert.equal(theoMa.TN12.withholdingRate, 10);
    assert.equal(theoMa.TN12.withholdingThreshold, 5_000_000);
    // `appliesToInternalOnly` tính lúc đọc: chỉ nhóm khấu trừ tại nguồn dùng được cho vãng lai.
    assert.deepEqual(ds.filter((d: any) => !d.appliesToInternalOnly).map((d: any) => d.code), ['TN12']);
  });

  await t.test('TC-tkt-001 — WITHHOLDING_FLAT bỏ trống tỷ lệ/ngưỡng → 201, tự áp 10% / 5.000.000, tự cấp mã TN13', async () => {
    const r = await goi('TC-tkt-001', 'POST Phụ cấp kiêm nhiệm', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Phụ cấp kiêm nhiệm', taxTreatmentGroup: 'WITHHOLDING_FLAT' },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.withholdingRate, 10);
    assert.equal(r.json.data.withholdingThreshold, 5_000_000);
    assert.equal(r.json.data.code, 'TN13', 'quét khe trống sau TN01–TN12');
    assert.equal(r.json.data.exemptCapAmount, null);
    DM.KIEM_NHIEM = r.json.data.id;
  });

  await t.test('TC-tkt-002 — EXEMPT_CAPPED thiếu mức trần → 400 E-tkt-003', async () => {
    const r = await goi('TC-tkt-002', 'POST thiếu exemptCapAmount', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Ăn ca thêm', taxTreatmentGroup: 'EXEMPT_CAPPED' },
    });
    kiemLoi(r, 400, 'E-tkt-003');
  });

  await t.test('TC-tkt-003 — WITHHOLDING_FLAT gửi tỷ lệ/ngưỡng = null tường minh → 400 E-tkt-003', async () => {
    // Hợp đồng Mục 2.3: KHÔNG GỬI thì tự áp mặc định (đã kiểm ở TC-001). `null` tường minh không phải số nên
    // bị chặn ở tầng hình dạng — ca này xác nhận nó không lọt vào DB thành NULL.
    const r = await goi('TC-tkt-003', 'POST rate/threshold = null', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Hoa hồng B', taxTreatmentGroup: 'WITHHOLDING_FLAT', withholdingRate: null, withholdingThreshold: null },
    });
    kiemLoi(r, 400, 'E-tkt-003');
    assert.equal(await dbA().otherIncomeCategory.count({ where: { name: 'Hoa hồng B' } }), 0);
  });

  await t.test('TC-tkt-006 — trùng tên khác hoa/thường → 400 E-tkt-001', async () => {
    const goc = await goi('TC-tkt-006', 'POST "Hoa hồng đại lý"', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Hoa hồng đại lý', taxTreatmentGroup: 'WITHHOLDING_FLAT' },
    });
    assert.equal(goc.status, 201, goc.raw);
    const r = await goi('TC-tkt-006', 'POST "hoa hồng đại lý"', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'hoa hồng đại lý', taxTreatmentGroup: 'WITHHOLDING_FLAT' },
    });
    kiemLoi(r, 400, 'E-tkt-001');
  });

  await t.test('TC-tkt-007 — trùng MÃ (gõ chữ thường "tn05"), tên khác hẳn → 400 E-tkt-001', async () => {
    const r = await goi('TC-tkt-007', 'POST code tn05', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { code: 'tn05', name: 'Tên khác hẳn', taxTreatmentGroup: 'EXEMPT_FULL' },
    });
    kiemLoi(r, 400, 'E-tkt-001');
  });

  await t.test('TC-tkt-008 — PUT kèm code: mã bất biến, tên đổi', async () => {
    const r = await goi('TC-tkt-008', 'PUT kèm code TN99', 'PUT', `${TKT}/income-categories/${DM.TN01}`, {
      ve: veOwnerA,
      payload: { code: 'TN99', name: 'Làm thêm giờ / ca đêm (đã sửa)' },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.code, 'TN01');
    assert.equal(r.json.data.affectedRecordsCount, 0);
    const row = await dbA().otherIncomeCategory.findUnique({ where: { id: DM.TN01 } });
    assert.equal(row?.code, 'TN01');
    assert.equal(row?.name, 'Làm thêm giờ / ca đêm (đã sửa)');
  });

  await t.test('TC-tkt-009 — PUT đổi sang EXEMPT_CAPPED không kèm trần → 400 E-tkt-003, không lưu nửa chừng', async () => {
    const r = await goi('TC-tkt-009', 'PUT TN11 → EXEMPT_CAPPED', 'PUT', `${TKT}/income-categories/${DM.TN11}`, {
      ve: veOwnerA,
      payload: { taxTreatmentGroup: 'EXEMPT_CAPPED' },
    });
    kiemLoi(r, 400, 'E-tkt-003');
    const row = await dbA().otherIncomeCategory.findUnique({ where: { id: DM.TN11 } });
    assert.equal(row?.taxTreatmentGroup, 'TAXABLE_FULL');
  });

  await t.test('TC-tkt-012 — lọc đồng thời taxTreatmentGroup + status', async () => {
    const ngung = await goi('TC-tkt-012', 'POST WF INACTIVE', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Thù lao ngừng dùng', taxTreatmentGroup: 'WITHHOLDING_FLAT', status: 'INACTIVE' },
    });
    assert.equal(ngung.status, 201, ngung.raw);
    const r = await goi(
      'TC-tkt-012',
      'GET lọc WF + ACTIVE',
      'GET',
      `${TKT}/income-categories?taxTreatmentGroup=WITHHOLDING_FLAT&status=ACTIVE`,
      { ve: veOwnerA },
    );
    assert.equal(r.status, 200, r.raw);
    assert.ok(r.json.data.length >= 3, r.raw); // TN12, Phụ cấp kiêm nhiệm, Hoa hồng đại lý
    for (const d of r.json.data) {
      assert.equal(d.taxTreatmentGroup, 'WITHHOLDING_FLAT');
      assert.equal(d.status, 'ACTIVE');
    }
    assert.ok(!r.json.data.some((d: any) => d.name === 'Thù lao ngừng dùng'));
  });

  await t.test('TC-tkt-013 — biên độ dài tên: 200 ký tự → 201, 201 ký tự → 400 E-tkt-003', async () => {
    const du = await goi('TC-tkt-013', 'POST tên 200 ký tự', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'T'.repeat(200), taxTreatmentGroup: 'EXEMPT_FULL' },
    });
    assert.equal(du.status, 201, du.raw);
    const thua = await goi('TC-tkt-013', 'POST tên 201 ký tự', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'U'.repeat(201), taxTreatmentGroup: 'EXEMPT_FULL' },
    });
    kiemLoi(thua, 400, 'E-tkt-003');
    // Danh mục chưa dùng xóa được — 204 không thân (hợp đồng Mục 2.5).
    const xoa = await goi('TC-tkt-013', 'DELETE danh mục chưa dùng', 'DELETE', `${TKT}/income-categories/${du.json.data.id}`, {
      ve: veOwnerA,
    });
    assert.equal(xoa.status, 204, xoa.raw);
    assert.equal(await dbA().otherIncomeCategory.count({ where: { id: du.json.data.id } }), 0);
  });

  await t.test('TC-tkt-119 — withholdingRate âm → 400 E-tkt-003', async () => {
    const r = await goi('TC-tkt-119', 'POST rate -5', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Thù lao tỷ lệ âm', taxTreatmentGroup: 'WITHHOLDING_FLAT', withholdingRate: -5 },
    });
    kiemLoi(r, 400, 'E-tkt-003');
  });

  await t.test('TC-tkt-048 — withholdingRate 150 bị chặn ngay lúc tạo danh mục → 400 E-tkt-003', async () => {
    const r = await goi('TC-tkt-048', 'POST rate 150', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Thù lao tỷ lệ 150', taxTreatmentGroup: 'WITHHOLDING_FLAT', withholdingRate: 150 },
    });
    kiemLoi(r, 400, 'E-tkt-003');
  });

  await t.test('TC-tkt-118 — withholdingRate = 0 → 201 (hợp đồng Mục 2.3 nhận 0..100)', async () => {
    const r = await goi('TC-tkt-118', 'POST rate 0', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Thù lao khấu trừ 0%', taxTreatmentGroup: 'WITHHOLDING_FLAT', withholdingRate: 0 },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.withholdingRate, 0);
  });

  await t.test('TC-tkt-049 (chuẩn bị) — danh mục khấu trừ tùy chỉnh 15%', async () => {
    const r = await goi('TC-tkt-049', 'POST rate 15', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Thù lao chuyên gia 15%', taxTreatmentGroup: 'WITHHOLDING_FLAT', withholdingRate: 15 },
    });
    assert.equal(r.status, 201, r.raw);
    DM.RATE_15 = r.json.data.id;
  });

  await t.test('TC-tkt-117 — danh mục khấu trừ withholdingRate = 100 → 201 (hợp đồng Mục 2.3 nhận 0..100; chia cho 0 chặn ở TC-047)', async () => {
    const r = await goi('TC-tkt-117', 'POST rate 100', 'POST', `${TKT}/income-categories`, {
      ve: veOwnerA,
      payload: { name: 'Thù lao khấu trừ 100%', taxTreatmentGroup: 'WITHHOLDING_FLAT', withholdingRate: 100 },
    });
    // Bộ ca giả định chặn lúc tạo; hợp đồng Mục 2.3 chỉ từ chối tỷ lệ ngoài 0..100 — kiểm theo hợp đồng.
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.withholdingRate, 100);
    DM.RATE_100 = r.json.data.id;
  });

  await t.test('TC-tkt-100 — kế toán có quyền xem lương (không phải ADMIN/OWNER) tạo danh mục → 201', async () => {
    const r = await goi('TC-tkt-100', 'POST bằng vé kế toán', 'POST', `${TKT}/income-categories`, {
      ve: veKeToanA,
      payload: { name: 'Thưởng sáng kiến nội bộ', taxTreatmentGroup: 'TAXABLE_FULL' },
    });
    assert.equal(r.status, 201, r.raw);
  });

  await t.test('KR-tkt-01 — không có quyền xem lương → 403 E-tkt-014 kể cả GET danh mục', async () => {
    const r = await goi('KR-tkt-01', 'GET bằng vé nhân sự', 'GET', `${TKT}/income-categories`, { ve: veNhanSuA });
    kiemLoi(r, 403, 'E-tkt-014');
  });

  await t.test('KR-tkt-02 — id danh mục không tồn tại → 404 E-tkt-016 ở GET/PUT/DELETE', async () => {
    const url = `${TKT}/income-categories/khong-ton-tai`;
    kiemLoi(await goi('KR-tkt-02', 'GET', 'GET', url, { ve: veOwnerA }), 404, 'E-tkt-016');
    kiemLoi(await goi('KR-tkt-02', 'PUT', 'PUT', url, { ve: veOwnerA, payload: { name: 'X' } }), 404, 'E-tkt-016');
    kiemLoi(await goi('KR-tkt-02', 'DELETE', 'DELETE', url, { ve: veOwnerA }), 404, 'E-tkt-016');
  });
});

// ================================================================================
// NHÓM 2 — BẢN GHI THU NHẬP NGOÀI LƯƠNG: nội bộ, vãng lai, chống trùng, sửa/xóa (TC-tkt-010…025, 039…040, 101)
// ================================================================================

/** Thân khoản chi trả đã tạo (bỏ `periodId`) — PUT dùng lại vì PUT không nhận kỳ. */
const THAN: Record<string, Record<string, unknown>> = {};

async function taoKhoan(tc: string, nhan: string, payload: Record<string, unknown>, ve = veOwnerA) {
  const r = await goi(tc, `POST khoản ${nhan}`, 'POST', `${TKT}/other-income`, { ve, payload });
  if (r.status === 201) {
    BG[nhan] = r.json.data.id;
    const than = { ...payload };
    delete than.periodId;
    THAN[nhan] = than;
  }
  return r;
}

const VL = (fullName: string) => ({ ma_nv: null, fullName });
const NV = (maNv: string) => ({
  ma_nv: maNv,
  fullName: NHAN_VIEN.find((n) => n.ma_nv === maNv)?.ho_ten ?? maNv,
});

/** Số tiền + cách tính của một kết quả thuế — so một lần cho đủ 7 trường. */
function ketQua(d: any) {
  return {
    gross: d.grossAmount,
    net: d.netAmount,
    mien: d.exemptAmount,
    chiuThue: d.taxableAmount,
    thue: d.taxDeducted,
    loai: d.taxDeductionType,
    tyLe: d.taxRate,
  };
}

test('Nhóm 2 — Bản ghi thu nhập ngoài lương', async (t) => {
  await t.test('TC-tkt-014/016/022/042 — nội bộ + TAXABLE_FULL 5.000.000 GROSS → 201, chịu thuế toàn bộ, không khấu trừ riêng', async () => {
    const r = await taoKhoan('TC-tkt-014', 'R1', {
      periodId: KY[9],
      ...NV('NV0001'),
      otherIncomeCategoryId: DM.TN11,
      paymentDate: '2026-09-15',
      paymentType: 'GROSS',
      amount: 5_000_000,
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.ma_nv, 'NV0001');
    assert.equal(r.json.data.taxTreatmentGroup, 'TAXABLE_FULL');
    assert.equal(r.json.data.category.code, 'TN11');
    assert.deepEqual(ketQua(r.json.data), {
      gross: 5_000_000, net: 5_000_000, mien: 0, chiuThue: 5_000_000, thue: 0, loai: 'PROGRESSIVE', tyLe: 0,
    });
  });

  await t.test('TC-tkt-062/064 (dữ liệu T9) — NV0003 TAXABLE_FULL 3.000.000; NV0002 thử việc hoa hồng khấu trừ 6.000.000', async () => {
    const r2 = await taoKhoan('TC-tkt-062', 'R2', {
      periodId: KY[9], ...NV('NV0003'), otherIncomeCategoryId: DM.TN11, paymentDate: '2026-09-10', amount: 3_000_000,
    });
    assert.equal(r2.status, 201, r2.raw);
    const r3 = await taoKhoan('TC-tkt-064', 'R3', {
      periodId: KY[9], ...NV('NV0002'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-09-12', amount: 6_000_000,
    });
    assert.equal(r3.status, 201, r3.raw);
    assert.equal(r3.json.data.taxDeducted, 600_000);
  });

  await t.test('TC-tkt-025/026 — vãng lai khấu trừ tại nguồn 6.000.000 GROSS, không MST/CCCD → 201, khấu trừ 600.000, thực nhận 5.400.000', async () => {
    const r = await taoKhoan('TC-tkt-025', 'R4', {
      periodId: KY[9], ...VL('Nguyễn Văn A'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-09-10', paymentType: 'GROSS', amount: 6_000_000,
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.ma_nv, null);
    assert.equal(r.json.data.taxCode, null);
    assert.deepEqual(ketQua(r.json.data), {
      gross: 6_000_000, net: 5_400_000, mien: 0, chiuThue: 0, thue: 600_000, loai: 'FLAT_10', tyLe: 10,
    });
  });

  await t.test('TC-tkt-018 — gửi lại y hệt khoản vãng lai đã có → 409 E-tkt-005', async () => {
    const r = await goi('TC-tkt-018', 'POST lặp R4', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: KY[9], ...THAN.R4 },
    });
    kiemLoi(r, 409, 'E-tkt-005');
    assert.equal(await dbA().otherIncomeRecord.count({ where: { fullName: 'Nguyễn Văn A' } }), 1);
  });

  await t.test('TC-tkt-019/028 — cùng người + loại, khác ngày và tiền (4.000.000 ngày 20/09, tên khác hoa/thường) → 201, dưới ngưỡng không khấu trừ', async () => {
    const r = await taoKhoan('TC-tkt-019', 'R5', {
      periodId: KY[9], ...VL('nguyễn văn A'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-09-20', amount: 4_000_000,
    });
    assert.equal(r.status, 201, r.raw);
    assert.deepEqual(ketQua(r.json.data), {
      gross: 4_000_000, net: 4_000_000, mien: 0, chiuThue: 0, thue: 0, loai: 'NO_DEDUCTION', tyLe: 0,
    });
  });

  await t.test('KR-tkt-06 — danh sách theo kỳ: tổng hợp trên TOÀN bộ lọc, X-Total-Count, phân trang; thiếu periodId → 400 E-tkt-004', async () => {
    const r = await goi('KR-tkt-06', 'GET danh sách T9', 'GET', `${TKT}/other-income?periodId=${KY[9]}`, { ve: veOwnerA });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.headers['x-total-count'], '5');
    assert.equal(r.json.data.records.length, 5);
    assert.deepEqual(r.json.data.summary, {
      totalRecords: 5, totalGross: 24_000_000, totalTax: 1_200_000, totalNet: 22_800_000,
    });
    assert.equal(r.json.data.periodLocked, false);

    const trang = await goi('KR-tkt-06', 'GET limit=2', 'GET', `${TKT}/other-income?periodId=${KY[9]}&limit=2&offset=0`, { ve: veOwnerA });
    assert.equal(trang.status, 200, trang.raw);
    assert.equal(trang.json.data.records.length, 2);
    assert.equal(trang.headers['x-total-count'], '5');
    assert.equal(trang.json.data.summary.totalGross, 24_000_000, 'summary theo toàn bộ lọc, không theo trang');

    kiemLoi(await goi('KR-tkt-06', 'GET thiếu periodId', 'GET', `${TKT}/other-income`, { ve: veOwnerA }), 400, 'E-tkt-004');
  });

  await t.test('TC-tkt-020 — double-click: 2 request y hệt song song → đúng 1 bản 201, 1 bản 409 E-tkt-005', async () => {
    const payload = {
      periodId: KY[10], ...VL('Trần Văn Đua'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-10-11', paymentType: 'GROSS', amount: 7_000_000,
    };
    const [a, b] = await Promise.all([
      goi('TC-tkt-020', 'POST lượt 1', 'POST', `${TKT}/other-income`, { ve: veOwnerA, payload }),
      goi('TC-tkt-020', 'POST lượt 2', 'POST', `${TKT}/other-income`, { ve: veOwnerA, payload }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409], `${a.raw} | ${b.raw}`);
    assert.equal([a, b].find((x) => x.status === 409)?.json?.code, 'E-tkt-005');
    assert.equal(await dbA().otherIncomeRecord.count({ where: { fullName: 'Trần Văn Đua' } }), 1);
  });

  await t.test('KR-tkt-04 — chống trùng vãng lai không phân biệt hoa/thường với chữ CÓ DẤU ("PHẠM VĂN ĐÔI" = "Phạm Văn Đôi") → 409 E-tkt-005', async () => {
    const goc = {
      periodId: KY[10], ...VL('Phạm Văn Đôi'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-10-12', paymentType: 'GROSS', amount: 6_000_000,
    };
    const a = await goi('KR-tkt-04', 'POST "Phạm Văn Đôi"', 'POST', `${TKT}/other-income`, { ve: veOwnerA, payload: goc });
    assert.equal(a.status, 201, a.raw);
    const b = await goi('KR-tkt-04', 'POST "PHẠM VĂN ĐÔI"', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { ...goc, fullName: 'PHẠM VĂN ĐÔI' },
    });
    // Lọt thì dọn ngay để kỳ T10 không mang bản trùng sang các ca sau.
    if (b.status === 201) await dbA().otherIncomeRecord.delete({ where: { id: b.json.data.id } });
    kiemLoi(b, 409, 'E-tkt-005');
  });

  await t.test('TC-tkt-017 — không ma_nv, không họ tên → 400 E-tkt-004', async () => {
    const r = await goi('TC-tkt-017', 'POST thiếu fullName', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: KY[10], otherIncomeCategoryId: DM.TN12, paymentDate: '2026-10-05', amount: 6_000_000 },
    });
    kiemLoi(r, 400, 'E-tkt-004');
  });

  await t.test('KR-tkt-05 — ngày chi trả ngoài tháng của kỳ → 400 E-tkt-004; kỳ không tồn tại → 400 E-tkt-017', async () => {
    const lech = await goi('KR-tkt-05', 'POST kỳ T10, ngày 02/11', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: KY[10], ...VL('Ngày Lệch'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-11-02', amount: 6_000_000 },
    });
    kiemLoi(lech, 400, 'E-tkt-004');
    const khongKy = await goi('KR-tkt-05', 'POST kỳ không tồn tại', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: 'khong-ton-tai', ...VL('Không Kỳ'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-10-02', amount: 6_000_000 },
    });
    kiemLoi(khongKy, 400, 'E-tkt-017');
  });

  await t.test('TC-tkt-015 — ma_nv gõ chữ thường "nv0001" → 201, chuẩn hóa về NV0001', async () => {
    const r = await taoKhoan('TC-tkt-015', 'R_THUONG', {
      periodId: KY[10], ma_nv: 'nv0001', fullName: 'Nguyễn Văn Một', otherIncomeCategoryId: DM.TN11, paymentDate: '2026-10-05', amount: 1_500_000,
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.ma_nv, 'NV0001');
  });

  await t.test('TC-tkt-021 — ma_nv không tồn tại "NV9999" → 404 E-tkt-016', async () => {
    const r = await goi('TC-tkt-021', 'POST NV9999', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: KY[10], ma_nv: 'NV9999', fullName: 'Người Không Có', otherIncomeCategoryId: DM.TN11, paymentDate: '2026-10-05', amount: 1_000_000 },
    });
    kiemLoi(r, 404, 'E-tkt-016');
  });

  await t.test('TC-tkt-032/043 — vãng lai chọn nhóm TAXABLE_FULL → 400 E-tkt-021 (cả tính thử lẫn ghi)', async () => {
    const than = { ...VL('Vãng Lai Thưởng'), otherIncomeCategoryId: DM.TN11, paymentDate: '2026-10-05', amount: 2_000_000 };
    kiemLoi(await goi('TC-tkt-032', 'preview', 'POST', `${TKT}/other-income/preview`, { ve: veOwnerA, payload: than }), 400, 'E-tkt-021');
    kiemLoi(await goi('TC-tkt-032', 'POST', 'POST', `${TKT}/other-income`, { ve: veOwnerA, payload: { periodId: KY[10], ...than } }), 400, 'E-tkt-021');
  });

  await t.test('TC-tkt-101 — kế toán có quyền xem lương tạo bản ghi → 201', async () => {
    const r = await taoKhoan(
      'TC-tkt-101',
      'R_KT',
      { periodId: KY[10], ...NV('NV0004'), otherIncomeCategoryId: DM.TN11, paymentDate: '2026-10-06', amount: 1_000_000 },
      veKeToanA,
    );
    assert.equal(r.status, 201, r.raw);
  });

  await t.test('TC-tkt-023 — PUT đổi số tiền → gross/net/taxable tính lại theo số mới', async () => {
    const r = await goi('TC-tkt-023', 'PUT amount 2tr', 'PUT', `${TKT}/other-income/${BG.R_KT}`, {
      ve: veOwnerA,
      payload: { ...THAN.R_KT, amount: 2_000_000 },
    });
    assert.equal(r.status, 200, r.raw);
    assert.deepEqual(ketQua(r.json.data), {
      gross: 2_000_000, net: 2_000_000, mien: 0, chiuThue: 2_000_000, thue: 0, loai: 'PROGRESSIVE', tyLe: 0,
    });
  });

  await t.test('TC-tkt-024 — PUT đổi sang danh mục WITHHOLDING_FLAT → tính lại toàn bộ, xuất hiện khấu trừ 10%', async () => {
    const r = await goi('TC-tkt-024', 'PUT → TN12, 6tr', 'PUT', `${TKT}/other-income/${BG.R_KT}`, {
      ve: veOwnerA,
      payload: { ...THAN.R_KT, otherIncomeCategoryId: DM.TN12, amount: 6_000_000 },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.taxTreatmentGroup, 'WITHHOLDING_FLAT');
    assert.deepEqual(ketQua(r.json.data), {
      gross: 6_000_000, net: 5_400_000, mien: 0, chiuThue: 0, thue: 600_000, loai: 'FLAT_10', tyLe: 10,
    });
  });

  await t.test('TC-tkt-039/040 — "Trang phục bằng tiền" trần 5.000.000/NĂM tính LŨY KẾ: T10 chi 3tr miễn hết; T11 chi 3tr chỉ còn miễn 2tr', async () => {
    const lan1 = await taoKhoan('TC-tkt-039', 'R_TP1', {
      periodId: KY[10], ...NV('NV0001'), otherIncomeCategoryId: DM.TN10, paymentDate: '2026-10-10', amount: 3_000_000,
    });
    assert.equal(lan1.status, 201, lan1.raw);
    assert.equal(lan1.json.data.exemptAmount, 3_000_000);
    assert.equal(lan1.json.data.taxableAmount, 0);

    const lan2 = await taoKhoan('TC-tkt-040', 'R_TP2', {
      periodId: KY[11], ...NV('NV0001'), otherIncomeCategoryId: DM.TN10, paymentDate: '2026-11-10', amount: 3_000_000,
    });
    assert.equal(lan2.status, 201, lan2.raw);
    assert.equal(lan2.json.data.exemptAmount, 2_000_000);
    assert.equal(lan2.json.data.taxableAmount, 1_000_000);
  });

  await t.test('TC-tkt-011 — chuyển danh mục INACTIVE: không chọn được cho khoản mới, khoản cũ vẫn hiện đúng tên', async () => {
    const tao = await taoKhoan('TC-tkt-011', 'R_KN', {
      periodId: KY[10], ...VL('Lê Thị Cộng Tác'), otherIncomeCategoryId: DM.KIEM_NHIEM, paymentDate: '2026-10-07', amount: 1_000_000,
    });
    assert.equal(tao.status, 201, tao.raw);

    const ngung = await goi('TC-tkt-011', 'PUT status INACTIVE', 'PUT', `${TKT}/income-categories/${DM.KIEM_NHIEM}`, {
      ve: veOwnerA,
      payload: { status: 'INACTIVE' },
    });
    assert.equal(ngung.status, 200, ngung.raw);
    assert.equal(ngung.json.data.status, 'INACTIVE');
    assert.equal(ngung.json.data.affectedRecordsCount, 1, 'giao diện dựa vào số này để cảnh báo sửa không hồi tố');

    const moi = await goi('TC-tkt-011', 'POST khoản mới dùng danh mục đã ngừng', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: KY[10], ...VL('Lê Thị Cộng Tác'), otherIncomeCategoryId: DM.KIEM_NHIEM, paymentDate: '2026-10-08', amount: 1_000_000 },
    });
    kiemLoi(moi, 400, 'E-tkt-003');

    const cu = await goi('TC-tkt-011', 'GET khoản cũ', 'GET', `${TKT}/other-income/${BG.R_KN}`, { ve: veOwnerA });
    assert.equal(cu.status, 200, cu.raw);
    assert.equal(cu.json.data.category.name, 'Phụ cấp kiêm nhiệm');

    const ds = await goi('TC-tkt-011', 'GET danh mục ACTIVE', 'GET', `${TKT}/income-categories?status=ACTIVE`, { ve: veOwnerA });
    assert.ok(!ds.json.data.some((d: any) => d.id === DM.KIEM_NHIEM), 'danh mục ngừng dùng không còn trong lựa chọn');
  });

  await t.test('TC-tkt-010 — xóa danh mục đang có khoản dùng → 400 E-tkt-002, gợi ý chuyển Ngừng dùng', async () => {
    const r = await goi('TC-tkt-010', 'DELETE danh mục đang dùng', 'DELETE', `${TKT}/income-categories/${DM.KIEM_NHIEM}`, { ve: veOwnerA });
    kiemLoi(r, 400, 'E-tkt-002');
    assert.match(r.json.message, /Ngừng dùng/);
    assert.equal(await dbA().otherIncomeCategory.count({ where: { id: DM.KIEM_NHIEM } }), 1);
  });

  await t.test('KR-tkt-07 — bản ghi không tồn tại → 404 E-tkt-016 (GET/DELETE); xóa khoản của kỳ còn mở → 204', async () => {
    kiemLoi(await goi('KR-tkt-07', 'GET id không có', 'GET', `${TKT}/other-income/khong-ton-tai`, { ve: veOwnerA }), 404, 'E-tkt-016');
    kiemLoi(await goi('KR-tkt-07', 'DELETE id không có', 'DELETE', `${TKT}/other-income/khong-ton-tai`, { ve: veOwnerA }), 404, 'E-tkt-016');
    const tam = await taoKhoan('KR-tkt-07', 'R_XOA', {
      periodId: KY[10], ...VL('Người Xóa Thử'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-10-03', amount: 2_000_000,
    });
    assert.equal(tam.status, 201, tam.raw);
    const xoa = await goi('KR-tkt-07', 'DELETE khoản T10', 'DELETE', `${TKT}/other-income/${BG.R_XOA}`, { ve: veOwnerA });
    assert.equal(xoa.status, 204, xoa.raw);
    kiemLoi(await goi('KR-tkt-07', 'GET sau xóa', 'GET', `${TKT}/other-income/${BG.R_XOA}`, { ve: veOwnerA }), 404, 'E-tkt-016');
  });
});

// ================================================================================
// NHÓM 3–4 — CÔNG THỨC THUẾ THEO BẢN GHI (preview, không ghi) — TC-tkt-026…051
// ================================================================================

function tinhThu(tc: string, buoc: string, payload: Record<string, unknown>) {
  return goi(tc, buoc, 'POST', `${TKT}/other-income/preview`, {
    ve: veOwnerA,
    payload: { paymentDate: '2026-11-20', paymentType: 'GROSS', ...payload },
  });
}

test('Nhóm 3–4 — Công thức thuế theo bản ghi (4 nhánh BR-tkt-007, BR-tkt-008)', async (t) => {
  await t.test('TC-tkt-027 — NET 5.400.000 quy ngược đúng GROSS 6.000.000 (đối xứng TC-026)', async () => {
    const r = await tinhThu('TC-tkt-027', 'NET 5,4tr', { ...VL('Khách NET'), otherIncomeCategoryId: DM.TN12, paymentType: 'NET', amount: 5_400_000 });
    assert.equal(r.status, 200, r.raw);
    assert.deepEqual(ketQua(r.json.data), {
      gross: 6_000_000, net: 5_400_000, mien: 0, chiuThue: 0, thue: 600_000, loai: 'FLAT_10', tyLe: 10,
    });
  });

  await t.test('TC-tkt-029 — ĐÚNG ngưỡng 5.000.000 GROSS → rơi vào nhánh khấu trừ, thuế 500.000', async () => {
    const r = await tinhThu('TC-tkt-029', 'GROSS 5tr', { ...VL('Khách Đúng Ngưỡng'), otherIncomeCategoryId: DM.TN12, amount: 5_000_000 });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.taxDeducted, 500_000);
    assert.equal(r.json.data.taxDeductionType, 'FLAT_10');
  });

  await t.test('TC-tkt-030 — Cam kết 08 hợp lệ (có MST) 7.000.000 → không khấu trừ dù vượt ngưỡng', async () => {
    const r = await tinhThu('TC-tkt-030', 'CK08 7tr', {
      ...VL('Khách Cam Kết'), taxCode: '8012345678', hasCommitment08: true, otherIncomeCategoryId: DM.TN12, amount: 7_000_000,
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.taxDeducted, 0);
    assert.equal(r.json.data.taxDeductionType, 'EXEMPT_COMMIT');
  });

  await t.test('TC-tkt-031 — Cam kết 08 thiếu MST → 400 E-tkt-006', async () => {
    const r = await tinhThu('TC-tkt-031', 'CK08 không MST', {
      ...VL('Khách Thiếu MST'), hasCommitment08: true, otherIncomeCategoryId: DM.TN12, amount: 7_000_000,
    });
    kiemLoi(r, 400, 'E-tkt-006');
  });

  await t.test('TC-tkt-033/050 — Cam kết 08 có MST nhưng isResident=false → 400 E-tkt-006', async () => {
    const r = await tinhThu('TC-tkt-033', 'CK08 không cư trú', {
      ...VL('Khách Không Cư Trú'), taxCode: '8012345678', isResident: false, hasCommitment08: true, otherIncomeCategoryId: DM.TN12, amount: 7_000_000,
    });
    kiemLoi(r, 400, 'E-tkt-006');
  });

  await t.test('TC-tkt-034 — EXEMPT_FULL 2.000.000 → miễn toàn bộ, không cộng thu nhập chịu thuế', async () => {
    const r = await tinhThu('TC-tkt-034', 'Làm thêm giờ 2tr', { ...NV('NV0003'), otherIncomeCategoryId: DM.TN01, amount: 2_000_000 });
    assert.equal(r.status, 200, r.raw);
    assert.deepEqual(ketQua(r.json.data), {
      gross: 2_000_000, net: 2_000_000, mien: 2_000_000, chiuThue: 0, thue: 0, loai: 'NO_DEDUCTION', tyLe: 0,
    });
  });

  await t.test('TC-tkt-035/051 — số tiền 0 hoặc âm → 400 E-tkt-004', async () => {
    for (const soTien of [0, -1]) {
      const r = await tinhThu('TC-tkt-035', `amount ${soTien}`, { ...NV('NV0003'), otherIncomeCategoryId: DM.TN01, amount: soTien });
      kiemLoi(r, 400, 'E-tkt-004');
    }
  });

  for (const [tc, chi, mien, vuot] of [
    ['TC-tkt-036', 1_000_000, 1_000_000, 0],
    ['TC-tkt-037', 1_200_000, 1_200_000, 0],
    ['TC-tkt-038', 1_500_000, 1_200_000, 300_000],
  ] as const) {
    await t.test(`${tc} — ăn ca tiền mặt trần 1.200.000/tháng, chi ${chi} → miễn ${mien}, vượt ${vuot}`, async () => {
      const r = await tinhThu(tc, `ăn ca ${chi}`, { ...NV('NV0003'), otherIncomeCategoryId: DM.TN09, amount: chi });
      assert.equal(r.status, 200, r.raw);
      assert.equal(r.json.data.exemptAmount, mien);
      assert.equal(r.json.data.taxableAmount, vuot);
      assert.equal(r.json.data.taxDeducted, 0);
    });
  }

  await t.test('TC-tkt-041 — "Ăn ca DN tự nấu" 50.000.000 → nhóm EXEMPT_FULL, miễn toàn bộ', async () => {
    const r = await tinhThu('TC-tkt-041', 'ăn ca tự nấu 50tr', { ...NV('NV0003'), otherIncomeCategoryId: DM.TN08, amount: 50_000_000 });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.exemptAmount, 50_000_000);
    assert.equal(r.json.data.taxableAmount, 0);
  });

  await t.test('TC-tkt-044/121 — TAXABLE_FULL + NET [GAP-QA-tkt-01 CÒN TREO] → hiện đang chặn 400 E-tkt-004', async () => {
    const r = await tinhThu('TC-tkt-044', 'Thưởng NET 5tr', { ...NV('NV0003'), otherIncomeCategoryId: DM.TN11, paymentType: 'NET', amount: 5_000_000 });
    kiemLoi(r, 400, 'E-tkt-004');
  });

  await t.test('TC-tkt-045 — NET cho 2 nhóm miễn thuế: GROSS = NET, không có gì để quy đổi', async () => {
    const full = await tinhThu('TC-tkt-045', 'EXEMPT_FULL NET 3tr', { ...NV('NV0003'), otherIncomeCategoryId: DM.TN01, paymentType: 'NET', amount: 3_000_000 });
    assert.equal(full.status, 200, full.raw);
    assert.equal(full.json.data.grossAmount, 3_000_000);
    assert.equal(full.json.data.netAmount, 3_000_000);
    const tran = await tinhThu('TC-tkt-045', 'EXEMPT_CAPPED NET 1tr', { ...NV('NV0003'), otherIncomeCategoryId: DM.TN09, paymentType: 'NET', amount: 1_000_000 });
    assert.equal(tran.status, 200, tran.raw);
    assert.equal(tran.json.data.grossAmount, 1_000_000);
    assert.equal(tran.json.data.netAmount, 1_000_000);
  });

  await t.test('TC-tkt-046 — NET 5.000.000 tỷ lệ 10%: làm tròn không làm lệch thực nhận', async () => {
    const r = await tinhThu('TC-tkt-046', 'NET 5tr', { ...VL('Khách Làm Tròn'), otherIncomeCategoryId: DM.TN12, paymentType: 'NET', amount: 5_000_000 });
    assert.equal(r.status, 200, r.raw);
    assert.deepEqual(ketQua(r.json.data), {
      gross: 5_555_556, net: 5_000_000, mien: 0, chiuThue: 0, thue: 555_556, loai: 'FLAT_10', tyLe: 10,
    });
  });

  await t.test('TC-tkt-049 — dùng đúng tỷ lệ CỦA DANH MỤC (15%), không cứng 10%', async () => {
    const r = await tinhThu('TC-tkt-049', 'GROSS 10tr, 15%', { ...VL('Chuyên Gia'), otherIncomeCategoryId: DM.RATE_15, amount: 10_000_000 });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.taxRate, 15);
    assert.equal(r.json.data.taxDeducted, 1_500_000);
  });

  await t.test('KR-tkt-09 — dưới ngưỡng nhưng cá nhân yêu cầu khấu trừ (forceWithholding) → khấu trừ 10%', async () => {
    const r = await tinhThu('KR-tkt-09', 'GROSS 4tr force', {
      ...VL('Khách Yêu Cầu'), forceWithholding: true, otherIncomeCategoryId: DM.TN12, amount: 4_000_000,
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.taxDeducted, 400_000);
    assert.equal(r.json.data.taxDeductionType, 'FLAT_10');
  });

  await t.test('KR-tkt-08 — cá nhân KHÔNG cư trú (luồng 20% ngoài phạm vi, SRS Mục 2.2) → 400 E-tkt-004 ở tính thử và ghi, không lưu', async () => {
    const than = { ...VL('Người Nước Ngoài'), isResident: false, otherIncomeCategoryId: DM.TN12, amount: 6_000_000 };
    kiemLoi(await tinhThu('KR-tkt-08', 'tính thử isResident=false', than), 400, 'E-tkt-004');
    const ghi = await goi('KR-tkt-08', 'POST isResident=false', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: KY[10], ...than, paymentDate: '2026-10-09' },
    });
    kiemLoi(ghi, 400, 'E-tkt-004');
    assert.equal(await dbA().otherIncomeRecord.count({ where: { isResident: false } }), 0);
  });

  await t.test('TC-tkt-047 — tỷ lệ 100% + NET, tính thử → 400 E-tkt-004, không ra số vô hạn; GROSS vẫn tính được', async () => {
    assert.ok(DM.RATE_100, 'cần danh mục tỷ lệ 100% tạo ở TC-tkt-117');
    const net = await tinhThu('TC-tkt-047', 'NET 5tr, tỷ lệ 100%', {
      ...VL('Khách Chia Không'), otherIncomeCategoryId: DM.RATE_100, paymentType: 'NET', amount: 5_000_000,
    });
    kiemLoi(net, 400, 'E-tkt-004');
    const gross = await tinhThu('TC-tkt-047', 'GROSS 5tr, tỷ lệ 100%', {
      ...VL('Khách Chia Không'), otherIncomeCategoryId: DM.RATE_100, amount: 5_000_000,
    });
    assert.equal(gross.status, 200, gross.raw);
    khop(gross.json.data, { grossAmount: 5_000_000, taxDeducted: 5_000_000, netAmount: 0 });
  });

  await t.test('TC-tkt-047 — tỷ lệ 100% + NET, ghi thật → 400 E-tkt-004, không lưu bản ghi', async () => {
    assert.ok(DM.RATE_100, 'cần danh mục tỷ lệ 100% tạo ở TC-tkt-117');
    const r = await goi('TC-tkt-047', 'POST NET 5tr, tỷ lệ 100%', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: {
        periodId: KY[10], ...VL('Khách Chia Không'), otherIncomeCategoryId: DM.RATE_100, paymentDate: '2026-10-09', paymentType: 'NET', amount: 5_000_000,
      },
    });
    kiemLoi(r, 400, 'E-tkt-004');
    assert.equal(await dbA().otherIncomeRecord.count({ where: { fullName: 'Khách Chia Không' } }), 0);
  });
});

// ================================================================================
// NHÓM 5 — BẢNG TÍNH THUẾ THÁNG: gộp thu nhập, lũy tiến, giảm trừ (TC-tkt-052b…065, 103, 106, 111, 112)
// ================================================================================

/** So đúng các trường nêu trong `ky` — diff chỉ hiện trường sai. */
function khop(d: any, ky: Record<string, unknown>, msg?: string): void {
  assert.deepEqual(Object.fromEntries(Object.keys(ky).map((k) => [k, d?.[k]])), ky, msg);
}

/** Ảnh chụp bảng T8/T9 lúc còn Nháp — Nhóm 6 so với bản đã chốt (số thấy trước khi chốt = số đóng băng). */
let bangT8Nhap: any = null;
let bangT9Nhap: any = null;

test('Nhóm 5 — Bảng tính thuế tháng', async (t) => {
  await t.test('KR-tkt-10 — GET /tax-policies: 2 mốc hiệu lực, đúng MỘT mốc đang áp dụng (mốc 2026)', async () => {
    const r = await goi('KR-tkt-10', 'GET chính sách thuế', 'GET', `${TKT}/tax-policies`, { ve: veKeToanA });
    assert.equal(r.status, 200, r.raw);
    assert.deepEqual(r.json.data.map((p: any) => p.effectiveFrom), ['2026-01-01', '1900-01-01']);
    const dang = r.json.data.filter((p: any) => p.dangApDung);
    assert.equal(dang.length, 1);
    khop(dang[0], { effectiveFrom: '2026-01-01', personalDeduction: 15_500_000, dependentDeduction: 6_200_000 });
    assert.equal(dang[0].taxBrackets.length, 5);
  });

  await t.test('TC-tkt-061/112 — lương 20tr + TAXABLE_FULL 5tr, giảm trừ bản thân 15,5tr, không BH → TNTT 9.500.000, thuế 475.000 (biểu 5 bậc)', async () => {
    bangT9Nhap = await bangThue(veOwnerA, KY[9], 'TC-tkt-061');
    assert.equal(bangT9Nhap.trangThai, 'NHAP');
    assert.equal(bangT9Nhap.coTheChot, false, 'kỳ lương T9 còn DRAFT ⇒ chưa chốt được');
    assert.equal(bangT9Nhap.bieuThueApDung.effectiveFrom, '2026-01-01');
    khop(dongCua(bangT9Nhap, 'NV0001'), {
      loai_lao_dong: 'HOP_DONG_3_THANG_TRO_LEN',
      thu_nhap_luong: 20_000_000,
      thu_nhap_ngoai: 5_000_000,
      thu_nhap_chiu_thue: 25_000_000,
      giam_tru_ban_than: 15_500_000,
      giam_tru_bao_hiem: 0,
      thu_nhap_tinh_thue: 9_500_000,
      phuong_phap_tinh: 'LUY_TIEN',
      thue_luy_tien: 475_000,
      tong_thue_tncn: 475_000,
      thuc_nhan: 24_525_000,
    });
  });

  await t.test('TC-tkt-062 — gộp làm ĐỔI BẬC: TNTT riêng lương 29tr (bậc 2) + ngoài lương 3tr ⇒ 32tr (bậc 3), thuế 2.900.000', async () => {
    khop(dongCua(bangT9Nhap, 'NV0003'), {
      thu_nhap_luong: 44_500_000,
      thu_nhap_ngoai: 3_000_000,
      thu_nhap_tinh_thue: 32_000_000,
      thue_luy_tien: 2_900_000,
      tong_thue_tncn: 2_900_000,
      thuc_nhan: 44_600_000,
    });
  });

  await t.test('TC-tkt-063/123 — vãng lai 2 khoản cùng tháng (khác hoa/thường) gộp MỘT dòng theo recipientKey', async () => {
    const vl = bangT9Nhap.danhSach.filter((x: any) => x.loai_lao_dong === 'VANG_LAI');
    assert.equal(vl.length, 1, JSON.stringify(vl));
    khop(vl[0], {
      id: 'VL:nguyễn văn a',
      ma_nv: null,
      cu_tru: true,
      thu_nhap_ngoai: 10_000_000,
      thu_nhap_khau_tru_rieng: 10_000_000,
      thu_nhap_chiu_thue: 10_000_000,
      thu_nhap_tinh_thue: 0,
      phuong_phap_tinh: 'KHAU_TRU_10',
      thue_toan_phan: 600_000,
      tong_thue_tncn: 600_000,
      thuc_nhan: 9_400_000,
    });
  });

  await t.test('TC-tkt-064/108 — HĐ thử việc + hoa hồng kiêm nhiệm: hai cơ chế khấu trừ ĐỘC LẬP (800.000 lương + 600.000 hoa hồng)', async () => {
    khop(dongCua(bangT9Nhap, 'NV0002'), {
      loai_lao_dong: 'THOI_VU_THU_VIEC',
      phuong_phap_tinh: 'KHAU_TRU_10',
      thu_nhap_luong: 8_000_000,
      thu_nhap_ngoai: 6_000_000,
      thu_nhap_khau_tru_rieng: 6_000_000,
      thu_nhap_chiu_thue: 14_000_000,
      giam_tru_ban_than: 0,
      thu_nhap_tinh_thue: 0,
      thue_luy_tien: 0,
      thue_toan_phan: 1_400_000,
      tong_thue_tncn: 1_400_000,
      thuc_nhan: 12_600_000,
    });
  });

  await t.test('TC-tkt-052b — HĐLĐ có BH bắt buộc: giảm trừ bảo hiểm đúng 10,5% lương đóng BH (3.150.000), không khoản khác', async () => {
    khop(dongCua(bangT9Nhap, 'NV0004'), {
      giam_tru_bao_hiem: 3_150_000,
      giam_tru_ban_than: 15_500_000,
      giam_tru_phu_thuoc: 0,
      tong_giam_tru: 18_650_000,
      thu_nhap_tinh_thue: 11_350_000,
      thue_luy_tien: 635_000,
      thuc_nhan: 26_215_000,
    });
  });

  await t.test('TC-tkt-065/111 — người KHÔNG có khoản ngoài lương: Bảng tính thuế KHỚP engine lương (/payroll/calculate)', async () => {
    const r = await goi('TC-tkt-065', 'GET engine lương T9', 'GET', `${BASE}/payroll/calculate?periodId=${KY[9]}`, { ve: veOwnerA });
    assert.equal(r.status, 200, r.raw);
    for (const ma of ['NV0004', 'NV0005', 'NV0006', 'NV0007']) {
      const luong = r.json.data.find((l: any) => l.ma_nv === ma);
      khop(
        dongCua(bangT9Nhap, ma),
        {
          thu_nhap_luong: luong.grossIncome,
          giam_tru_bao_hiem: luong.employeeInsuranceDeduction,
          thu_nhap_tinh_thue: luong.taxableIncome,
          thue_luy_tien: luong.personalIncomeTax,
        },
        `lệch engine lương ở ${ma}`,
      );
    }
    // Đối chứng TC-062: riêng lương NV0003 engine tính 2.400.000 — phần chênh 500.000 đúng bằng phần gộp.
    assert.equal(r.json.data.find((l: any) => l.ma_nv === 'NV0003').personalIncomeTax, 2_400_000);
  });

  await t.test('TC-tkt-055…060 — ranh giới biểu lũy tiến 5 bậc của chính sách 2026 (hàm dùng chung với Bảng tính thuế)', async () => {
    const r = await goi('TC-tkt-055', 'GET chính sách thuế', 'GET', `${TKT}/tax-policies`, { ve: veKeToanA });
    const bieu = r.json.data.find((p: any) => p.dangApDung).taxBrackets;
    const bang: Array<[string, number, number]> = [
      ['TC-tkt-055', 10_000_000, 500_000],
      ['TC-tkt-056', 10_000_001, 500_000], // 500.000,1 làm tròn về đồng
      ['TC-tkt-057', 30_000_000, 2_500_000],
      ['TC-tkt-058', 60_000_000, 8_500_000],
      ['TC-tkt-059', 100_000_000, 20_500_000],
      ['TC-tkt-060', 100_000_001, 20_500_000], // 20.500.000,35 làm tròn về đồng
    ];
    for (const [tc, tntt, thue] of bang) {
      assert.equal(tinhThueLuyTien(tntt, bieu), thue, `${tc}: TNTT ${tntt}`);
    }
  });

  await t.test('TC-tkt-103 — NV vào làm giữa quý (HĐ từ 01/08): T7 thu nhập 0, T8 tính bình thường', async () => {
    const t7 = await bangThue(veKeToanA, KY[7], 'TC-tkt-103');
    bangT8Nhap = await bangThue(veKeToanA, KY[8], 'TC-tkt-103');
    khop(dongCua(t7, 'NV0005'), { thu_nhap_luong: 0, thu_nhap_tinh_thue: 0, tong_thue_tncn: 0 });
    khop(dongCua(bangT8Nhap, 'NV0005'), { thu_nhap_luong: 15_000_000, thu_nhap_tinh_thue: 0, tong_thue_tncn: 0 });
  });

  await t.test('TC-tkt-106 — người phụ thuộc hiệu lực từ 9/2026: T8 chưa giảm trừ, T9 giảm trừ 6.200.000', async () => {
    khop(dongCua(bangT8Nhap, 'NV0006'), {
      so_nguoi_phu_thuoc: 0, giam_tru_phu_thuoc: 0, thu_nhap_tinh_thue: 9_500_000, thue_luy_tien: 475_000,
    });
    khop(dongCua(bangT9Nhap, 'NV0006'), {
      so_nguoi_phu_thuoc: 1, giam_tru_phu_thuoc: 6_200_000, thu_nhap_tinh_thue: 3_300_000, thue_luy_tien: 165_000,
    });
  });

  await t.test('KR-tkt-11 — T8, NV0006: Bảng tính thuế và engine lương phải ra CÙNG số thuế (NFR-tkt-005)', async () => {
    const r = await goi('KR-tkt-11', 'GET engine lương T8', 'GET', `${BASE}/payroll/calculate?periodId=${KY[8]}`, { ve: veOwnerA });
    assert.equal(r.status, 200, r.raw);
    const luong = r.json.data.find((l: any) => l.ma_nv === 'NV0006');
    const d = dongCua(bangT8Nhap, 'NV0006');
    console.log(
      `KR-tkt-11 T8 NV0006: engine dependentCount=${luong.dependentCount}, thuế=${luong.personalIncomeTax} · ` +
        `bảng thuế so_nguoi_phu_thuoc=${d.so_nguoi_phu_thuoc}, thuế=${d.thue_luy_tien}`,
    );
    assert.equal(d.thue_luy_tien, luong.personalIncomeTax, 'hai màn ra hai số thuế cho cùng người cùng tháng');
  });

  await t.test('KR-tkt-03 — NV0007 chưa có hợp đồng trong T9 vẫn có dòng 0 đồng trên Bảng tính thuế tháng (giữ theo quyết định ISSUE-tkt-002; chỉ tờ khai không đếm)', async () => {
    const d = dongCua(bangT9Nhap, 'NV0007');
    console.log(`KR-tkt-03 dòng NV0007 T9: ${JSON.stringify(d)}`);
    khop(d, { thu_nhap_luong: 0, thu_nhap_chiu_thue: 0, tong_thue_tncn: 0 });
    assert.equal(bangT9Nhap.kpi.tongNguoiLaoDong, 8, '7 nhân viên (kể cả NV0007 không thu nhập) + 1 vãng lai');
  });

  await t.test('KR-tkt-12 — KPI tính trên TOÀN kỳ; bộ lọc loại lao động / từ khóa chỉ lọc danh sách', async () => {
    const kpi = bangT9Nhap.kpi;
    // Thuế T9: 475.000 + 1.400.000 + 2.900.000 + 635.000 + 0 + 165.000 + 0 + 600.000
    assert.equal(kpi.tongThueTncn, 6_175_000);
    assert.equal(kpi.tongThuNhapChiuThue, 166_500_000);
    console.log(`KR-tkt-12 tongGiamTruGiaCanh T9 = ${kpi.tongGiamTruGiaCanh}`);

    const loc = await goi('KR-tkt-12', 'GET lọc VANG_LAI', 'GET', `${TKT}/tax-calculation?periodId=${KY[9]}&loaiLaoDong=VANG_LAI`, { ve: veKeToanA });
    assert.equal(loc.status, 200, loc.raw);
    assert.equal(loc.json.data.danhSach.length, 1);
    assert.deepEqual(loc.json.data.kpi, kpi, 'KPI không đổi theo bộ lọc');

    const tim = await goi('KR-tkt-12', 'GET q=bốn', 'GET', `${TKT}/tax-calculation?periodId=${KY[9]}&q=${encodeURIComponent('bốn')}`, { ve: veKeToanA });
    assert.equal(tim.status, 200, tim.raw);
    assert.deepEqual(tim.json.data.danhSach.map((x: any) => x.id), ['NV0004']);
  });

  await t.test('KR-tkt-13 — kỳ không tồn tại / thiếu periodId → 400 E-tkt-017', async () => {
    kiemLoi(await goi('KR-tkt-13', 'GET kỳ không có', 'GET', `${TKT}/tax-calculation?periodId=khong-ton-tai`, { ve: veKeToanA }), 400, 'E-tkt-017');
    kiemLoi(await goi('KR-tkt-13', 'GET thiếu periodId', 'GET', `${TKT}/tax-calculation`, { ve: veKeToanA }), 400, 'E-tkt-017');
  });
});

// ================================================================================
// NHÓM 6 — VÒNG ĐỜI BẢNG TÍNH THUẾ THÁNG: chốt / mở lại (TC-tkt-066…070, 074, 075, 097, 098)
// ================================================================================

test('Nhóm 6 — Chốt / mở lại Bảng tính thuế tháng', async (t) => {
  await t.test('TC-tkt-074 — kỳ lương gốc CHƯA khóa sổ → 400 E-tkt-008, không sinh khóa', async () => {
    const r = await goi('TC-tkt-074', 'POST lock T9 (kỳ lương DRAFT)', 'POST', `${TKT}/tax-calculation/lock`, {
      ve: veOwnerA,
      payload: { periodId: KY[9] },
    });
    kiemLoi(r, 400, 'E-tkt-008');
    assert.equal(await dbA().payrollModuleLock.count({ where: { periodId: KY[9], module: 'TAX_SHEET' } }), 0);
  });

  await t.test('TC-tkt-097 — không có quyền xem lương gọi chốt → 403 E-tkt-014', async () => {
    const r = await goi('TC-tkt-097', 'POST lock bằng vé nhân sự', 'POST', `${TKT}/tax-calculation/lock`, {
      ve: veNhanSuA,
      payload: { periodId: KY[9] },
    });
    kiemLoi(r, 403, 'E-tkt-014');
  });

  await t.test('chuẩn bị — khóa sổ kỳ lương T7, T8, T9 qua API', async () => {
    for (const thang of [7, 8, 9]) await khoaSoKyLuong(veOwnerA, KY[thang]);
    const t9 = await bangThue(veKeToanA, KY[9], 'SETUP');
    assert.equal(t9.coTheChot, true, 'kỳ lương đã khóa sổ ⇒ chốt được');
  });

  await t.test('TC-tkt-075/066 — 2 lệnh chốt T9 song song → đúng 1 bản 200 DA_CHOT, 1 bản 409 E-tkt-018, không snapshot trùng', async () => {
    const [a, b] = await Promise.all([
      goi('TC-tkt-075', 'POST lock lượt 1', 'POST', `${TKT}/tax-calculation/lock`, { ve: veOwnerA, payload: { periodId: KY[9] } }),
      goi('TC-tkt-075', 'POST lock lượt 2', 'POST', `${TKT}/tax-calculation/lock`, { ve: veOwnerA, payload: { periodId: KY[9] } }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], `${a.raw} | ${b.raw}`);
    const thanhCong = [a, b].find((x) => x.status === 200);
    khop(thanhCong?.json?.data, { periodId: KY[9], trangThai: 'DA_CHOT', soDong: 8 });
    assert.equal([a, b].find((x) => x.status === 409)?.json?.code, 'E-tkt-018');
    assert.equal(await dbA().taxCalculationLine.count({ where: { periodId: KY[9] } }), 8);
  });

  await t.test('TC-tkt-066 — sau chốt: đọc snapshot, DA_CHOT, số GIỐNG HỆT lúc còn Nháp', async () => {
    const r = await bangThue(veOwnerA, KY[9], 'TC-tkt-066');
    khop(r, { trangThai: 'DA_CHOT', coTheChot: false, coTheMoLai: true, chotBoi: ownerId, chotBoiTen: 'QA TKT Owner' });
    assert.deepEqual(r.danhSach, bangT9Nhap.danhSach, 'số thấy trước khi chốt phải đúng bằng số đóng băng');
    assert.deepEqual(r.kpi, bangT9Nhap.kpi);
  });

  await t.test('TC-tkt-067/068 — tháng đã chốt: sửa / xóa / thêm khoản ngoài lương → 403 E-tkt-007', async () => {
    kiemLoi(await goi('TC-tkt-067', 'PUT R1', 'PUT', `${TKT}/other-income/${BG.R1}`, { ve: veOwnerA, payload: THAN.R1 }), 403, 'E-tkt-007');
    kiemLoi(await goi('TC-tkt-068', 'DELETE R1', 'DELETE', `${TKT}/other-income/${BG.R1}`, { ve: veOwnerA }), 403, 'E-tkt-007');
    const them = await goi('TC-tkt-067', 'POST khoản mới vào T9', 'POST', `${TKT}/other-income`, {
      ve: veOwnerA,
      payload: { periodId: KY[9], ...VL('Người Đến Muộn'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-09-25', amount: 1_000_000 },
    });
    kiemLoi(them, 403, 'E-tkt-007');
    const ds = await goi('TC-tkt-067', 'GET danh sách T9', 'GET', `${TKT}/other-income?periodId=${KY[9]}`, { ve: veOwnerA });
    assert.equal(ds.json.data.periodLocked, true);
  });

  await t.test('KR-tkt-14 — nhật ký kiểm toán: chốt tháng ghi HRM_TAX_SHEET_LOCKED kèm số dòng, đúng người, đúng công ty', async () => {
    const log = await sysPrisma.sysLog.findMany({
      where: { donViId: donViA, hanhDong: 'HRM_TAX_SHEET_LOCKED' },
      select: { userId: true, chiTiet: true },
    });
    assert.equal(log.length, 1, `lệnh chốt thua cuộc không được ghi nhật ký: ${JSON.stringify(log)}`);
    assert.deepEqual(log[0].chiTiet, { periodId: KY[9], count: 8 });
    assert.equal(log[0].userId, ownerId);
  });

  await t.test('TC-tkt-098 — có quyền xem lương nhưng KHÔNG phải ADMIN/OWNER gọi mở lại → 403 E-tkt-014', async () => {
    const r = await goi('TC-tkt-098', 'POST unlock bằng vé kế toán', 'POST', `${TKT}/tax-calculation/unlock`, {
      ve: veKeToanA,
      payload: { periodId: KY[9], lyDo: LY_DO_MO_LAI },
    });
    kiemLoi(r, 403, 'E-tkt-014');
    assert.equal(await dbA().payrollModuleLock.count({ where: { periodId: KY[9], module: 'TAX_SHEET' } }), 1);
  });

  await t.test('KR-tkt-15 — mở lại thiếu lý do / lý do dưới 20 ký tự → 400 E-tkt-011', async () => {
    for (const lyDo of [undefined, 'quá ngắn']) {
      const r = await goi('KR-tkt-15', `unlock lyDo=${lyDo}`, 'POST', `${TKT}/tax-calculation/unlock`, {
        ve: veOwnerA,
        payload: { periodId: KY[9], ...(lyDo ? { lyDo } : {}) },
      });
      kiemLoi(r, 400, 'E-tkt-011');
    }
  });

  await t.test('TC-tkt-069 — OWNER mở lại T9 (quý chưa xuất) → 200 NHAP; xóa khóa + snapshot; nhật ký kèm lý do', async () => {
    khop(await moLaiThang(veOwnerA, KY[9], 'TC-tkt-069'), { periodId: KY[9], trangThai: 'NHAP' });
    assert.equal(await dbA().payrollModuleLock.count({ where: { periodId: KY[9], module: 'TAX_SHEET' } }), 0);
    assert.equal(await dbA().taxCalculationLine.count({ where: { periodId: KY[9] } }), 0);
    const log = await sysPrisma.sysLog.findFirst({
      where: { donViId: donViA, hanhDong: 'HRM_TAX_SHEET_UNLOCKED' },
      select: { chiTiet: true },
    });
    assert.deepEqual(log?.chiTiet, { periodId: KY[9], reason: LY_DO_MO_LAI });
  });

  await t.test('TC-tkt-070 — sau mở lại: sửa khoản T9 được bình thường → 200', async () => {
    const r = await goi('TC-tkt-070', 'PUT R1 thêm ghi chú', 'PUT', `${TKT}/other-income/${BG.R1}`, {
      ve: veOwnerA,
      payload: { ...THAN.R1, note: 'Đã đối chiếu sau khi mở lại' },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.note, 'Đã đối chiếu sau khi mở lại');
    assert.equal(r.json.data.grossAmount, 5_000_000);
  });

  await t.test('KR-tkt-16 — mở lại tháng đang Nháp → 409 E-tkt-018', async () => {
    const r = await goi('KR-tkt-16', 'POST unlock T9 lần 2', 'POST', `${TKT}/tax-calculation/unlock`, {
      ve: veOwnerA,
      payload: { periodId: KY[9], lyDo: LY_DO_MO_LAI },
    });
    kiemLoi(r, 409, 'E-tkt-018');
  });

  await t.test('KR-tkt-17 — kế toán (quyền mức 1) chốt được tháng T7; chốt lại tháng đã chốt → 409 E-tkt-018', async () => {
    khop(await chotThang(veKeToanA, KY[7], 'KR-tkt-17'), { trangThai: 'DA_CHOT', soDong: 7 });
    const lai = await goi('KR-tkt-17', 'POST lock T7 lần 2', 'POST', `${TKT}/tax-calculation/lock`, {
      ve: veOwnerA,
      payload: { periodId: KY[7] },
    });
    kiemLoi(lai, 409, 'E-tkt-018');
    await chotThang(veOwnerA, KY[8], 'KR-tkt-17');
  });
});

// ================================================================================
// NHÓM 7 — TỜ KHAI 05/KK-TNCN QUÝ: điều kiện đủ, chỉ tiêu, bảng chi tiết (TC-tkt-076, 077, 082, 083, 092, 099)
// ================================================================================

/**
 * Bộ chỉ tiêu Q3/2026 TÍNH TAY từ dữ liệu dựng ở trên (data-model Mục 8):
 *   người ĐƯỢC TRẢ thu nhập trong quý: NV0001…NV0006 + 1 vãng lai = 7 — NV0007 (hợp đồng từ
 *   01/10) có 3 dòng 0 đồng nhưng không đếm (ISSUE-tkt-002)                           ⇒ [16]
 *   trong đó cư trú có HĐLĐ ≥ 3 tháng (NV0002 thử việc cả quý, vãng lai: không) = 5   ⇒ [17]
 *   có thuế > 0: NV0001, NV0002, NV0003, NV0004, NV0006, vãng lai = 6                ⇒ [18] = [19]
 *   TNCT quý: 65tr + 30tr + 136,5tr + 90tr + 30tr + 75tr + 0 + 10tr = 436,5tr           ⇒ [21] = [22]
 *   TNCT của người có thuế: 436,5tr − NV0005 30tr − NV0007 0 = 406,5tr                 ⇒ [26] = [27]
 *   thuế quý: 925.000 + 3.000.000 + 7.700.000 + 1.905.000 + 1.115.000 + 600.000        ⇒ [29] = [30]
 */
const CT_Q3 = {
  ct16: 7, ct17: 5, ct18: 6, ct19: 6, ct20: 0,
  ct21: 436_500_000, ct22: 436_500_000, ct23: 0, ct24: 0, ct25: 0,
  ct26: 406_500_000, ct27: 406_500_000, ct28: 0,
  ct29: 15_245_000, ct30: 15_245_000, ct31: 0, ct32: 0,
};

const Q3 = { nam: 2026, quy: 3 };

test('Nhóm 7 — Tờ khai 05/KK-TNCN quý: điều kiện đủ, chỉ tiêu, bảng chi tiết', async (t) => {
  await t.test('TC-tkt-076 — T7, T8 đã chốt, T9 Nháp → CHUA_SAN_SANG, không có dòng; xuất / bảng chi tiết / ghi đè → 400 E-tkt-010', async () => {
    const tk = await toKhaiQuy(veKeToanA, 3, 'TC-tkt-076');
    khop(tk, { trangThai: 'CHUA_SAN_SANG', ct: null, ctMay: null });
    assert.deepEqual(tk.cacThang.map((m: any) => [m.month, m.daChot]), [[7, true], [8, true], [9, false]]);
    assert.equal(await dbA().hrm_to_khai_tncn05.count(), 0, 'chưa đủ 3 tháng thì KHÔNG có dòng tờ khai');

    kiemLoi(
      await goi('TC-tkt-076', 'POST export', 'POST', `${TKT}/05-kk-tncn/export`, { ve: veOwnerA, payload: { ...Q3, format: 'excel' } }),
      400,
      'E-tkt-010',
    );
    kiemLoi(
      await goi('TC-tkt-076', 'GET detail-sheet', 'GET', `${TKT}/05-kk-tncn/detail-sheet?nam=2026&quy=3`, { ve: veKeToanA }),
      400,
      'E-tkt-010',
    );
    kiemLoi(
      await goi('TC-tkt-076', 'PUT overrides', 'PUT', `${TKT}/05-kk-tncn/overrides`, {
        ve: veKeToanA,
        payload: { ...Q3, overrides: { ct22: { gia: 1, lyDo: 'thử ghi đè khi chưa sẵn sàng' } } },
      }),
      400,
      'E-tkt-010',
    );
  });

  await t.test('TC-tkt-082 — giao diện cũ gửi kyLoai="thang" hoặc quý ngoài 1..4 → 400 E-tkt-017', async () => {
    kiemLoi(await goi('TC-tkt-082', 'GET kyLoai=thang', 'GET', `${TKT}/05-kk-tncn?nam=2026&quy=3&kyLoai=thang`, { ve: veKeToanA }), 400, 'E-tkt-017');
    kiemLoi(await goi('TC-tkt-082', 'GET quy=5', 'GET', `${TKT}/05-kk-tncn?nam=2026&quy=5`, { ve: veKeToanA }), 400, 'E-tkt-017');
  });

  await t.test('TC-tkt-077 — chốt đủ 3 tháng → GET tự chuyển READY_TO_EXPORT, bộ chỉ tiêu khớp số tính tay', async () => {
    await chotThang(veOwnerA, KY[9], 'TC-tkt-077');
    const tk = await toKhaiQuy(veKeToanA, 3, 'TC-tkt-077');
    assert.equal(tk.trangThai, 'READY_TO_EXPORT');
    assert.deepEqual(tk.ctMay, CT_Q3);
    assert.deepEqual(tk.ct, CT_Q3, 'chưa ghi đè thì bộ cuối = số máy');
    assert.deepEqual(tk.canhBao, []);
    assert.equal(tk.ctGocSuaDuoc.length, 13);
    khop(tk.thongTinNguoiNopThue, {
      maSoThue: MST_A,
      ten: 'QA TKT Tenant A',
      diaChi: '1 Phố Kiểm Thử, Hà Nội',
      coQuanThueQuanLy: '',
    });
  });

  await t.test('ISSUE-tkt-002 (quý) — 3 tháng chốt có 8 người, [16] chỉ đếm 7 người được trả thu nhập; NV0007 (3 dòng 0 đồng) không đếm', async () => {
    const dong = await dbA().taxCalculationLine.findMany({
      where: { periodId: { in: [KY[7], KY[8], KY[9]] } },
      select: { recipientKey: true, tong_thu_nhap: true },
    });
    const tongTheoNguoi = new Map<string, number>();
    for (const d of dong) {
      tongTheoNguoi.set(d.recipientKey, (tongTheoNguoi.get(d.recipientKey) ?? 0) + Number(d.tong_thu_nhap));
    }
    assert.equal(tongTheoNguoi.size, 8, 'Bảng tính thuế tháng vẫn giữ đủ dòng như bảng lương');
    assert.equal(tongTheoNguoi.get('NV0007'), 0);
    assert.equal([...tongTheoNguoi.values()].filter((v) => v > 0).length, CT_Q3.ct16);
  });

  await t.test('TC-tkt-083 — bảng chi tiết theo nhân viên NỘI BỘ gộp 3 tháng (JSON + Excel), quyền mức 1 dùng được', async () => {
    const r = await goi('TC-tkt-083', 'GET detail-sheet json', 'GET', `${TKT}/05-kk-tncn/detail-sheet?nam=2026&quy=3`, { ve: veKeToanA });
    assert.equal(r.status, 200, r.raw);
    assert.deepEqual(
      r.json.data.map((d: any) => d.ma_nv),
      ['NV0001', 'NV0002', 'NV0003', 'NV0004', 'NV0005', 'NV0006', 'NV0007'],
      'chỉ nhân viên nội bộ, không có dòng vãng lai',
    );
    khop(r.json.data[0], { ho_ten: 'Nguyễn Văn Một', cacThang: [7, 8, 9], thu_nhap_chiu_thue: 65_000_000, tong_thue_tncn: 925_000 });

    const x = await goi('TC-tkt-083', 'GET detail-sheet excel', 'GET', `${TKT}/05-kk-tncn/detail-sheet?nam=2026&quy=3&format=excel`, { ve: veKeToanA });
    assert.equal(x.status, 200, x.raw);
    assert.match(String(x.headers['content-type']), /spreadsheetml/);
    assert.equal(x.buf.subarray(0, 2).toString('latin1'), 'PK');
    const sheet = readZipEntry(x.buf, 'sheet1.xml')?.toString('utf8') ?? '';
    assert.ok(sheet.includes('Nguyễn Văn Một') && sheet.includes('Đỗ Văn Bảy'), 'Excel phải có đủ nhân viên');
    assert.ok(!sheet.includes('Nguyễn Văn A<'), 'Excel không có dòng vãng lai');
  });

  await t.test('TC-tkt-092 — tờ khai READY (chưa xuất) đánh dấu đã nộp → 400 E-tkt-013', async () => {
    kiemLoi(await goi('TC-tkt-092', 'POST mark-submitted', 'POST', `${TKT}/05-kk-tncn/mark-submitted`, { ve: veOwnerA, payload: Q3 }), 400, 'E-tkt-013');
  });

  await t.test('KR-tkt-18 — tải lại file tờ khai chưa xuất → 400 E-tkt-013', async () => {
    kiemLoi(await goi('KR-tkt-18', 'GET file', 'GET', `${TKT}/05-kk-tncn/file?nam=2026&quy=3&format=excel`, { ve: veOwnerA }), 400, 'E-tkt-013');
  });

  await t.test('TC-tkt-099 — kế toán (không ADMIN/OWNER) xuất / tải file / đánh dấu nộp → 403 E-tkt-014 cả 3, trạng thái giữ READY', async () => {
    kiemLoi(await goi('TC-tkt-099', 'POST export', 'POST', `${TKT}/05-kk-tncn/export`, { ve: veKeToanA, payload: { ...Q3, format: 'excel' } }), 403, 'E-tkt-014');
    kiemLoi(await goi('TC-tkt-099', 'GET file', 'GET', `${TKT}/05-kk-tncn/file?nam=2026&quy=3&format=excel`, { ve: veKeToanA }), 403, 'E-tkt-014');
    kiemLoi(await goi('TC-tkt-099', 'POST mark-submitted', 'POST', `${TKT}/05-kk-tncn/mark-submitted`, { ve: veKeToanA, payload: Q3 }), 403, 'E-tkt-014');
    const row = await dbA().hrm_to_khai_tncn05.findFirst({ where: { nam: 2026, ky_so: 3 } });
    assert.equal(row?.trang_thai, 'READY_TO_EXPORT');
  });
});

// ================================================================================
// NHÓM 8 — GHI ĐÈ CHỈ TIÊU TỜ KHAI (TC-tkt-085…089) + mở lại tháng khi quý READY (TC-tkt-072, 073, 120)
// ================================================================================

function ghiDe(tc: string, buoc: string, overrides: Record<string, unknown>, ve = veKeToanA) {
  return goi(tc, buoc, 'PUT', `${TKT}/05-kk-tncn/overrides`, { ve, payload: { ...Q3, overrides } });
}

test('Nhóm 8 — Ghi đè chỉ tiêu tờ khai', async (t) => {
  await t.test('TC-tkt-085 — ghi đè [22] có lý do → 200; [21] = [22] + [23] tự tính lại; số máy giữ nguyên', async () => {
    const r = await ghiDe('TC-tkt-085', 'PUT ct22', { ct22: { gia: 430_000_000, lyDo: 'loại trừ khoản kê nhầm kỳ trước' } });
    assert.equal(r.status, 200, r.raw);
    khop(r.json.data.ct, { ct22: 430_000_000, ct21: 430_000_000 });
    assert.equal(r.json.data.ctMay.ct22, CT_Q3.ct22);
    assert.deepEqual(r.json.data.ghiDe, { ct22: { gia: 430_000_000, lyDo: 'loại trừ khoản kê nhầm kỳ trước' } });
    assert.equal(r.json.data.trangThai, 'READY_TO_EXPORT');
  });

  await t.test('TC-tkt-086 — ghi đè thiếu lý do / lý do dưới 10 ký tự → 400 E-tkt-011', async () => {
    kiemLoi(await ghiDe('TC-tkt-086', 'PUT ct22 không lyDo', { ct22: { gia: 1 } }), 400, 'E-tkt-011');
    kiemLoi(await ghiDe('TC-tkt-086', 'PUT ct22 lyDo 9 ký tự', { ct22: { gia: 1, lyDo: 'ngắn quá!' } }), 400, 'E-tkt-011');
  });

  await t.test('TC-tkt-087 — ghi đè ô TỔNG HỢP [21] / mã lạ / số âm / số người lẻ → 400 E-tkt-012, không ghi gì', async () => {
    kiemLoi(await ghiDe('TC-tkt-087', 'PUT ct21', { ct21: { gia: 1, lyDo: 'thử ghi đè ô tổng hợp' } }), 400, 'E-tkt-012');
    kiemLoi(await ghiDe('TC-tkt-087', 'PUT ct99', { ct99: { gia: 1, lyDo: 'mã chỉ tiêu không tồn tại' } }), 400, 'E-tkt-012');
    kiemLoi(await ghiDe('TC-tkt-087', 'PUT ct30 âm', { ct30: { gia: -1, lyDo: 'giá trị âm không hợp lệ' } }), 400, 'E-tkt-012');
    kiemLoi(await ghiDe('TC-tkt-087', 'PUT ct16 = 7.5', { ct16: { gia: 7.5, lyDo: 'số người phải là số nguyên' } }), 400, 'E-tkt-012');
    const tk = await toKhaiQuy(veKeToanA, 3, 'TC-tkt-087');
    assert.deepEqual(Object.keys(tk.ghiDe), ['ct22'], 'lệnh bị từ chối không được ghi gì');
  });

  await t.test('TC-tkt-089 — ghi đè [27] rồi [28] ở 2 lệnh liên tiếp → [26] theo CẢ HAI số mới; ghi đè gộp dồn; cảnh báo không chặn', async () => {
    const a = await ghiDe('TC-tkt-089', 'PUT ct27', { ct27: { gia: 400_000_000, lyDo: 'điều chỉnh thu nhập diện khấu trừ' } });
    assert.equal(a.status, 200, a.raw);
    const b = await ghiDe('TC-tkt-089', 'PUT ct28', { ct28: { gia: 1_000_000, lyDo: 'bổ sung cá nhân không cư trú' } });
    assert.equal(b.status, 200, b.raw);
    khop(b.json.data.ct, { ct27: 400_000_000, ct28: 1_000_000, ct26: 401_000_000, ct22: 430_000_000 });
    assert.deepEqual(Object.keys(b.json.data.ghiDe).sort(), ['ct22', 'ct27', 'ct28']);
    assert.ok(
      b.json.data.canhBao.some((c: string) => c.includes('[28]')),
      `phải cảnh báo [28] > [23]: ${JSON.stringify(b.json.data.canhBao)}`,
    );
  });

  await t.test('TC-tkt-088 — đủ 13 chỉ tiêu gốc ghi đè trong một lệnh → 200; xóa một chỉ tiêu / ô tổng hợp / xóa hết', async () => {
    const tat: Record<string, { gia: number; lyDo: string }> = {};
    for (const ct of ['ct16', 'ct17', 'ct19', 'ct20', 'ct22', 'ct23', 'ct24', 'ct25', 'ct27', 'ct28', 'ct30', 'ct31', 'ct32']) {
      tat[ct] = { gia: 1, lyDo: `kiểm thử ghi đè ${ct}` };
    }
    const r = await ghiDe('TC-tkt-088', 'PUT 13 chỉ tiêu', tat);
    assert.equal(r.status, 200, r.raw);
    assert.equal(Object.keys(r.json.data.ghiDe).length, 13);
    khop(r.json.data.ct, { ct18: 2, ct21: 2, ct26: 2, ct29: 2 });

    const mot = await goi('TC-tkt-088', 'DELETE ct=ct16', 'DELETE', `${TKT}/05-kk-tncn/overrides?nam=2026&quy=3&ct=ct16`, { ve: veKeToanA });
    assert.equal(mot.status, 200, mot.raw);
    assert.equal(Object.keys(mot.json.data.ghiDe).length, 12);
    assert.equal(mot.json.data.ct.ct16, CT_Q3.ct16, 'bỏ ghi đè thì về số máy');

    kiemLoi(
      await goi('TC-tkt-088', 'DELETE ct=ct21', 'DELETE', `${TKT}/05-kk-tncn/overrides?nam=2026&quy=3&ct=ct21`, { ve: veKeToanA }),
      400,
      'E-tkt-012',
    );

    const het = await goi('TC-tkt-088', 'DELETE toàn bộ', 'DELETE', `${TKT}/05-kk-tncn/overrides?nam=2026&quy=3`, { ve: veKeToanA });
    assert.equal(het.status, 200, het.raw);
    assert.deepEqual(het.json.data.ghiDe, {});
    assert.deepEqual(het.json.data.ct, CT_Q3);
  });

  await t.test('TC-tkt-072/120 — quý READY có ghi đè: OWNER mở lại T9 → 200, xóa luôn dòng tờ khai CHƯA xuất', async () => {
    const gd = await ghiDe('TC-tkt-072', 'PUT ct22 trước khi mở lại', { ct22: { gia: 430_000_000, lyDo: 'ghi đè có trước khi mở lại tháng' } });
    assert.equal(gd.status, 200, gd.raw);
    await moLaiThang(veOwnerA, KY[9], 'TC-tkt-072');
    assert.equal(await dbA().hrm_to_khai_tncn05.count({ where: { nam: 2026, ky_so: 3 } }), 0);
  });

  await t.test('TC-tkt-073 — sau khi mở lại: GET quý → CHUA_SAN_SANG, không còn dữ liệu treo', async () => {
    const tk = await toKhaiQuy(veKeToanA, 3, 'TC-tkt-073');
    khop(tk, { trangThai: 'CHUA_SAN_SANG', ct: null });
    assert.deepEqual(tk.ghiDe, {});
  });

  await t.test('KR-tkt-19 — [QUAN SÁT] chốt lại T9: tờ khai READY trở lại, ghi đè trước khi mở lại ĐÃ MẤT', async () => {
    await chotThang(veOwnerA, KY[9], 'KR-tkt-19');
    const tk = await toKhaiQuy(veKeToanA, 3, 'KR-tkt-19');
    assert.equal(tk.trangThai, 'READY_TO_EXPORT');
    assert.deepEqual(tk.ct, CT_Q3);
    console.log(`KR-tkt-19 ghiDe sau khi mở lại + chốt lại: ${JSON.stringify(tk.ghiDe)}`);
    assert.deepEqual(tk.ghiDe, {});
  });
});

// ================================================================================
// NHÓM 9 — XUẤT, TẢI LẠI, ĐÁNH DẤU ĐÃ NỘP, LỊCH SỬ (TC-tkt-071, 078…081, 084, 090, 091, 093…096)
// ================================================================================

function ngayVietNam(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

/** File tờ khai: đúng loại/tên/cache, đủ 17 mã chỉ tiêu, thông tin người nộp và số đã chốt. Trả nội dung sheet. */
function kiemFileToKhai(r: KetQuaGoi, tc: string): string {
  assert.equal(r.status, 200, r.raw);
  assert.match(String(r.headers['content-type']), /spreadsheetml/);
  assert.match(String(r.headers['content-disposition']), /05-KK-TNCN_Quy3_2026\.xlsx/);
  assert.equal(r.headers['cache-control'], 'no-store, private');
  const sheet = readZipEntry(r.buf, 'sheet1.xml')?.toString('utf8') ?? '';
  for (let so = 16; so <= 32; so++) assert.ok(sheet.includes(`[${so}]`), `${tc}: file thiếu chỉ tiêu [${so}]`);
  for (const chuoi of [`Mã số thuế: ${MST_A}`, 'Kỳ tính thuế: Quý 3 năm 2026', 'Tên người nộp thuế: QA TKT Tenant A']) {
    assert.ok(sheet.includes(chuoi), `${tc}: file thiếu "${chuoi}"`);
  }
  assert.ok(sheet.includes(String(CT_Q3.ct29)), `${tc}: file thiếu số [29] = ${CT_Q3.ct29}`);
  return sheet;
}

test('Nhóm 9 — Xuất tờ khai, tải lại, đánh dấu đã nộp, lịch sử', async (t) => {
  let sheetLucXuat = '';

  await t.test('TC-tkt-078/079 — OWNER xuất Excel → 200 file đủ 17 chỉ tiêu + thông tin người nộp; EXPORTED, ghi người/lúc xuất', async () => {
    const r = await goi('TC-tkt-078', 'POST export excel', 'POST', `${TKT}/05-kk-tncn/export`, {
      ve: veOwnerA,
      payload: { ...Q3, format: 'excel', nguoiKy: 'Nguyễn Kế Toán' },
    });
    sheetLucXuat = kiemFileToKhai(r, 'TC-tkt-078');
    assert.ok(sheetLucXuat.includes('Người ký: Nguyễn Kế Toán'));
    const row = await dbA().hrm_to_khai_tncn05.findFirst({ where: { nam: 2026, ky_so: 3 } });
    assert.equal(row?.trang_thai, 'EXPORTED');
    assert.equal(row?.khoa_so_boi, ownerId);
    assert.equal(row?.nguoi_ky, 'Nguyễn Kế Toán');
    assert.equal(row?.ngay_ky?.toISOString().slice(0, 10), ngayVietNam(), 'ngày ký mặc định = hôm nay theo giờ Việt Nam');
  });

  await t.test('TC-tkt-080 — xuất lần 2 → 409 E-tkt-020', async () => {
    kiemLoi(
      await goi('TC-tkt-080', 'POST export lần 2', 'POST', `${TKT}/05-kk-tncn/export`, { ve: veOwnerA, payload: { ...Q3, format: 'excel' } }),
      409,
      'E-tkt-020',
    );
  });

  await t.test('TC-tkt-090/122 — tờ khai ĐÃ XUẤT: ghi đè / xóa ghi đè → 403 E-tkt-019', async () => {
    kiemLoi(await ghiDe('TC-tkt-090', 'PUT ct22', { ct22: { gia: 1, lyDo: 'sửa sau khi đã xuất' } }), 403, 'E-tkt-019');
    kiemLoi(
      await goi('TC-tkt-090', 'DELETE overrides', 'DELETE', `${TKT}/05-kk-tncn/overrides?nam=2026&quy=3`, { ve: veKeToanA }),
      403,
      'E-tkt-019',
    );
  });

  await t.test('TC-tkt-071 — quý đã xuất: mở lại T8 → 403 E-tkt-009, khóa tháng + snapshot còn nguyên', async () => {
    const r = await goi('TC-tkt-071', 'POST unlock T8', 'POST', `${TKT}/tax-calculation/unlock`, {
      ve: veOwnerA,
      payload: { periodId: KY[8], lyDo: LY_DO_MO_LAI },
    });
    kiemLoi(r, 403, 'E-tkt-009');
    assert.equal(await dbA().payrollModuleLock.count({ where: { periodId: KY[8], module: 'TAX_SHEET' } }), 1);
    assert.equal(await dbA().taxCalculationLine.count({ where: { periodId: KY[8] } }), 7);
    khop(await bangThue(veKeToanA, KY[8], 'TC-tkt-071'), { trangThai: 'DA_CHOT', coTheMoLai: false });
  });

  await t.test('KR-tkt-20 — GET quý đã xuất đọc nguyên bộ số đã chốt + người xuất; tải lại file → trùng file lúc xuất', async () => {
    const tk = await toKhaiQuy(veKeToanA, 3, 'KR-tkt-20');
    khop(tk, { trangThai: 'EXPORTED', xuatBoi: ownerId, xuatBoiTen: 'QA TKT Owner', nguoiKy: 'Nguyễn Kế Toán' });
    assert.deepEqual(tk.ct, CT_Q3);
    const f = await goi('KR-tkt-20', 'GET file excel', 'GET', `${TKT}/05-kk-tncn/file?nam=2026&quy=3&format=excel`, { ve: veOwnerA });
    assert.equal(kiemFileToKhai(f, 'KR-tkt-20'), sheetLucXuat, 'file tải lại phải trùng file lúc xuất');
  });

  await t.test('TC-tkt-093/095 — đánh dấu Đã nộp → 200 SUBMITTED, ghi người/lúc nộp; thông điệp nói rõ KHÔNG nộp thật', async () => {
    const r = await goi('TC-tkt-093', 'POST mark-submitted', 'POST', `${TKT}/05-kk-tncn/mark-submitted`, { ve: veOwnerA, payload: Q3 });
    assert.equal(r.status, 200, r.raw);
    khop(r.json.data, { trangThai: 'SUBMITTED', nopBoi: ownerId, nopBoiTen: 'QA TKT Owner' });
    assert.ok(r.json.data.nopLuc, 'phải có thời điểm nộp');
    assert.match(r.json.message, /KHÔNG nộp/);
  });

  await t.test('TC-tkt-094 — đánh dấu Đã nộp lần 2 → 400 E-tkt-013', async () => {
    kiemLoi(await goi('TC-tkt-094', 'POST mark-submitted lần 2', 'POST', `${TKT}/05-kk-tncn/mark-submitted`, { ve: veOwnerA, payload: Q3 }), 400, 'E-tkt-013');
  });

  await t.test('TC-tkt-091 — tờ khai Đã nộp: ghi đè → 403 E-tkt-019; GET vẫn đọc được', async () => {
    kiemLoi(await ghiDe('TC-tkt-091', 'PUT ct22', { ct22: { gia: 1, lyDo: 'sửa sau khi đã nộp' } }), 403, 'E-tkt-019');
    assert.equal((await toKhaiQuy(veKeToanA, 3, 'TC-tkt-091')).trangThai, 'SUBMITTED');
  });

  await t.test('TC-tkt-081 — Q4 thiếu hẳn kỳ lương T12 → CHUA_SAN_SANG, tháng 12 không có kỳ', async () => {
    const tk = await toKhaiQuy(veKeToanA, 4, 'TC-tkt-081');
    assert.equal(tk.trangThai, 'CHUA_SAN_SANG');
    assert.deepEqual(
      tk.cacThang.map((m: any) => [m.month, m.periodId !== null, m.daChot]),
      [[10, true, false], [11, true, false], [12, false, false]],
    );
  });

  await t.test('chuẩn bị Q2 — khóa sổ + chốt T4, T5, T6', async () => {
    for (const thang of [4, 5, 6]) {
      await khoaSoKyLuong(veOwnerA, KY[thang]);
      await chotThang(veKeToanA, KY[thang]);
    }
    assert.equal((await toKhaiQuy(veKeToanA, 2, 'SETUP')).trangThai, 'READY_TO_EXPORT');
  });

  await t.test('TC-tkt-084 — đọc trạng thái quý ĐÚNG lúc một tháng đang mở lại: kết quả cuối nhất quán, không dòng treo', async () => {
    const [doc, mo] = await Promise.all([
      goi('TC-tkt-084', 'GET Q2 song song', 'GET', `${TKT}/05-kk-tncn?nam=2026&quy=2`, { ve: veKeToanA }),
      goi('TC-tkt-084', 'POST unlock T6 song song', 'POST', `${TKT}/tax-calculation/unlock`, {
        ve: veOwnerA,
        payload: { periodId: KY[6], lyDo: LY_DO_MO_LAI },
      }),
    ]);
    console.log(`TC-tkt-084 GET=${doc.status} ${doc.json?.data?.trangThai} · unlock=${mo.status}`);
    assert.equal(doc.status, 200, doc.raw);
    assert.equal(mo.status, 200, mo.raw);
    assert.equal(await dbA().hrm_to_khai_tncn05.count({ where: { nam: 2026, ky_so: 2 } }), 0, 'T6 đã mở ⇒ không được còn dòng Q2');
    assert.equal((await toKhaiQuy(veKeToanA, 2, 'TC-tkt-084')).trangThai, 'CHUA_SAN_SANG');
    await chotThang(veOwnerA, KY[6], 'TC-tkt-084');
  });

  await t.test('KR-tkt-21 — xuất Q2 ĐÚNG lúc mở lại T5: chỉ một bên thắng, trạng thái cuối nhất quán', async () => {
    const [xuat, mo] = await Promise.all([
      goi('KR-tkt-21', 'POST export Q2 song song', 'POST', `${TKT}/05-kk-tncn/export`, {
        ve: veOwnerA,
        payload: { nam: 2026, quy: 2, format: 'excel' },
      }),
      goi('KR-tkt-21', 'POST unlock T5 song song', 'POST', `${TKT}/tax-calculation/unlock`, {
        ve: veOwnerA,
        payload: { periodId: KY[5], lyDo: LY_DO_MO_LAI },
      }),
    ]);
    console.log(`KR-tkt-21 export=${xuat.status} ${xuat.json?.code ?? ''} · unlock=${mo.status} ${mo.json?.code ?? ''}`);
    const row = await dbA().hrm_to_khai_tncn05.findFirst({ where: { nam: 2026, ky_so: 2 } });
    const khoaT5 = await dbA().payrollModuleLock.count({ where: { periodId: KY[5], module: 'TAX_SHEET' } });
    if (xuat.status === 200) {
      kiemLoi(mo, 403, 'E-tkt-009');
      assert.equal(row?.trang_thai, 'EXPORTED');
      assert.equal(khoaT5, 1);
    } else {
      kiemLoi(xuat, 400, 'E-tkt-010');
      assert.equal(mo.status, 200, mo.raw);
      assert.equal(row, null);
      assert.equal(khoaT5, 0);
      await chotThang(veOwnerA, KY[5], 'KR-tkt-21');
    }
  });

  await t.test('TC-tkt-096 — lịch sử năm 2026: Q3 SUBMITTED kèm người xuất/nộp, Q2 trạng thái khác, quý mới xếp trước', async () => {
    const q2 = await toKhaiQuy(veKeToanA, 2, 'TC-tkt-096');
    const r = await goi('TC-tkt-096', 'GET periods?nam=2026', 'GET', `${TKT}/05-kk-tncn/periods?nam=2026`, { ve: veKeToanA });
    assert.equal(r.status, 200, r.raw);
    assert.deepEqual(r.json.data.map((k: any) => [k.quy, k.trangThai]), [[3, 'SUBMITTED'], [2, q2.trangThai]]);
    assert.notEqual(q2.trangThai, 'SUBMITTED');
    khop(r.json.data[0], {
      ct16: CT_Q3.ct16, ct21: CT_Q3.ct21, ct29: CT_Q3.ct29,
      xuatBoi: ownerId, xuatBoiTen: 'QA TKT Owner', nopBoi: ownerId, nopBoiTen: 'QA TKT Owner',
    });
    const rong = await goi('TC-tkt-096', 'GET periods?nam=2025', 'GET', `${TKT}/05-kk-tncn/periods?nam=2025`, { ve: veKeToanA });
    assert.deepEqual(rong.json.data, []);
  });
});

// ================================================================================
// NHÓM 10 — PHÂN QUYỀN XUYÊN SUỐT (TC-tkt-102; 097–101 đã kiểm tại chỗ ở các nhóm trên)
// ================================================================================

test('Nhóm 10 — Phân quyền xuyên suốt', async (t) => {
  await t.test('TC-tkt-102 — không đăng nhập / vé rác → 401 ở mọi nhóm endpoint to_khai_thue', async () => {
    const ds: Array<['GET' | 'POST', string]> = [
      ['GET', `${TKT}/income-categories`],
      ['POST', `${TKT}/other-income`],
      ['GET', `${TKT}/tax-calculation?periodId=${KY[9]}`],
      ['POST', `${TKT}/tax-calculation/lock`],
      ['GET', `${TKT}/05-kk-tncn?nam=2026&quy=3`],
      ['POST', `${TKT}/05-kk-tncn/export`],
      ['GET', `${TKT}/tax-policies`],
    ];
    for (const [method, url] of ds) {
      const r = await goi('TC-tkt-102', `không cookie ${method}`, method, url, method === 'POST' ? { payload: {} } : {});
      assert.equal(r.status, 401, `${method} ${url}: ${r.raw}`);
    }
    const rac = await goi('TC-tkt-102', 'cookie rác', 'GET', `${TKT}/income-categories`, { ve: 'khong-phai-jwt' });
    assert.equal(rac.status, 401, rac.raw);
  });

  await t.test('KR-tkt-22 — không có quyền xem lương: bảng thuế / tờ khai / bảng chi tiết / chính sách / tính thử → 403 E-tkt-014', async () => {
    const ds = [
      ['GET', `${TKT}/tax-calculation?periodId=${KY[9]}`, undefined],
      ['GET', `${TKT}/05-kk-tncn?nam=2026&quy=3`, undefined],
      ['GET', `${TKT}/05-kk-tncn/detail-sheet?nam=2026&quy=3`, undefined],
      ['GET', `${TKT}/tax-policies`, undefined],
      ['POST', `${TKT}/other-income/preview`, { ...VL('Người Dò'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-10-01', amount: 1 }],
    ] as const;
    for (const [method, url, payload] of ds) {
      const r = await goi('KR-tkt-22', `vé nhân sự ${method}`, method, url, { ve: veNhanSuA, payload });
      kiemLoi(r, 403, 'E-tkt-014');
    }
  });
});

// ================================================================================
// NHÓM 11–12 — CÔ LẬP TENANT, THIẾU CHÍNH SÁCH THUẾ, KỲ KHÔNG NHÂN VIÊN (TC-tkt-110, 113, 114 + E-tkt-015)
// ================================================================================

test('Nhóm 11–12 — Cô lập tenant và biên dữ liệu', async (t) => {
  let kyB = '';

  await t.test('TC-tkt-113 — công ty B dò id của công ty A → không lộ dữ liệu (404 E-tkt-016 / 400 E-tkt-017), không sửa được', async () => {
    kiemLoi(await goi('TC-tkt-113', 'B GET danh mục của A', 'GET', `${TKT}/income-categories/${DM.TN11}`, { ve: veOwnerB }), 404, 'E-tkt-016');
    kiemLoi(await goi('TC-tkt-113', 'B GET bản ghi của A', 'GET', `${TKT}/other-income/${BG.R1}`, { ve: veOwnerB }), 404, 'E-tkt-016');
    kiemLoi(
      await goi('TC-tkt-113', 'B PUT danh mục của A', 'PUT', `${TKT}/income-categories/${DM.TN11}`, { ve: veOwnerB, payload: { name: 'Chiếm quyền' } }),
      404,
      'E-tkt-016',
    );
    // Bộ ca ghi 404 cho kỳ của tenant khác; hợp đồng Mục 4.1 chốt "kỳ không tồn tại" = 400 E-tkt-017.
    kiemLoi(await goi('TC-tkt-113', 'B GET bảng thuế kỳ của A', 'GET', `${TKT}/tax-calculation?periodId=${KY[9]}`, { ve: veOwnerB }), 400, 'E-tkt-017');

    const tkB = await goi('TC-tkt-113', 'B GET tờ khai Q3', 'GET', `${TKT}/05-kk-tncn?nam=2026&quy=3`, { ve: veOwnerB });
    assert.equal(tkB.status, 200, tkB.raw);
    khop(tkB.json.data, { trangThai: 'CHUA_SAN_SANG', ct: null });
    assert.equal(tkB.json.data.thongTinNguoiNopThue.maSoThue, MST_B, 'B không được thấy tờ khai đã nộp của A');
    const dmA = await dbA().otherIncomeCategory.findUnique({ where: { id: DM.TN11 } });
    assert.notEqual(dmA?.name, 'Chiếm quyền');
  });

  await t.test('TC-tkt-114 — công ty B tạo khoản chi trả gắn periodId của A → 400 E-tkt-017, không ghi vào DB nào', async () => {
    const soA = await dbA().otherIncomeRecord.count();
    const r = await goi('TC-tkt-114', 'B POST với kỳ của A', 'POST', `${TKT}/other-income`, {
      ve: veOwnerB,
      payload: { periodId: KY[9], ...VL('Người Lạ'), otherIncomeCategoryId: DM.TN12, paymentDate: '2026-09-10', amount: 6_000_000 },
    });
    // Bộ ca ghi 404; hợp đồng Mục 3.4 chốt "kỳ không tồn tại" = 400 E-tkt-017 — kiểm theo hợp đồng.
    kiemLoi(r, 400, 'E-tkt-017');
    assert.equal(await dbB().otherIncomeRecord.count(), 0);
    assert.equal(await dbA().otherIncomeRecord.count(), soA);
  });

  await t.test('KR-tkt-23 — tenant chưa nạp chính sách thuế: bảng tính thuế → 500 E-tkt-015 có mã + hướng dẫn, không 500 vô danh', async () => {
    kyB = await taoKy(veOwnerB, 9);
    const r = await goi('KR-tkt-23', 'B GET bảng thuế', 'GET', `${TKT}/tax-calculation?periodId=${kyB}`, { ve: veOwnerB });
    kiemLoi(r, 500, 'E-tkt-015');
    assert.match(r.json.message, /hrm:seed-thue/);
  });

  await t.test('TC-tkt-110 — kỳ lương không có nhân viên nào: bảng thuế 0 dòng, không lỗi; khóa sổ + chốt tháng vẫn được', async () => {
    await napChinhSachThue(dbB());
    const bang = await bangThue(veOwnerB, kyB, 'TC-tkt-110');
    assert.deepEqual(bang.danhSach, []);
    khop(bang.kpi, { tongNguoiLaoDong: 0, tongThueTncn: 0 });
    await khoaSoKyLuong(veOwnerB, kyB);
    khop(await chotThang(veOwnerB, kyB, 'TC-tkt-110'), { trangThai: 'DA_CHOT', soDong: 0 });
  });
});

// ================================================================================
// NHÓM 13 — CA KHÔNG CHẠY TỰ ĐỘNG Ở TẦNG API (ghi lý do để báo cáo đếm đúng)
// ================================================================================

test('Nhóm 13 — Ca tham chiếu / ngoài phạm vi / không kiểm được qua API', async (t) => {
  const boQua: Array<[string, string]> = [
    ['TC-tkt-052', 'ngoài phạm vi từ 2026-09-14 (P-17, BH hưu trí tự nguyện chưa có màn nhập) — thay bằng TC-052b'],
    ['TC-tkt-053', 'ngoài phạm vi từ 2026-09-14 (P-17)'],
    ['TC-tkt-054', 'ngoài phạm vi từ 2026-09-14 (P-17)'],
    ['TC-tkt-104', 'đối chứng ngoài phạm vi (thu nhập từ 2 công ty) — mỗi công ty một DB, chứng minh gián tiếp ở TC-113/114'],
    ['TC-tkt-105', 'đối chứng ngoài phạm vi (khai bổ sung) — khóa vĩnh viễn sau xuất đã kiểm ở TC-071/090/091'],
    ['TC-tkt-107', 'dữ liệu Quý I/II kiểu cũ — tenant kiểm thử không có dữ liệu cũ, cần bản sao DB thật'],
    ['TC-tkt-109', 'tham chiếu chéo TC-tkt-020 (đã chạy)'],
    ['TC-tkt-115', 'kiểm bằng rà mã nguồn, không phải hành vi API — xem test-report'],
    ['TC-tkt-116', 'giao diện (2 tab ngoài phạm vi) — frontend đang tạm ngừng'],
    ['TC-tkt-124', 'việc làm đầu Phase B (đổi đường/trường theo hợp đồng) — đã làm trong chính file này'],
    ['TC-tkt-125', 'đã hoàn tất ở Phase A (thay mã lỗi chính thức) — không có hành vi để chạy'],
    ['TC-tkt-126', 'đã hoàn tất ở Phase A (sửa SRS) — không có hành vi để chạy'],
    ['TC-tkt-078-pdf', 'xuất PDF: Puppeteer giữ tiến trình test sống — kiểm riêng bằng script, xem test-report'],
  ];
  for (const [tc, lyDo] of boQua) {
    await t.test(`${tc} — ${lyDo}`, { skip: lyDo }, () => {});
  }
});
