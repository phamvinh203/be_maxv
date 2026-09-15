import { sysPrisma } from '../../../../config/db.sys';
import {
  CT_GOC_SUA_DUOC,
  TO_KHAI_DA_XUAT,
  type ChiTieuTncn05,
  type CtTag,
  type TrangThaiToKhai,
} from '../../../../constants/hrm/to_khai_thue/chiTieuTncn05';
import {
  Prisma,
  type PrismaClient,
  type hrm_to_khai_tncn05,
} from '../../../../generated/tenant';
import { ToKhaiThueError } from '../../../../helpers/hrm/toKhaiThueErrors';
import { layHoTenNguoiDung } from '../du_lieu_tinh_luong/payrollActivity.service';
import {
  COT_TIEN_BANG_THUE,
  cacThangCuaQuy,
  chuanHoaGhiDe,
  gopChiTietNhanVien,
  hopNhatGhiDe,
  kiemTraCanDoi,
  tinhChiTieuMay,
  type CotTienBangThue,
  type DongChiTietNhanVien,
  type DongThueQuy,
  type GhiDeChiTieu,
} from './taxDeclarationCalc';

/**
 * TỜ KHAI THUẾ TNCN QUÝ 05/KK-TNCN — api-contract Mục 5 (7 endpoint) + endpoint tải lại file đã xuất
 * (chủ dự án duyệt 2026-09-15).
 *
 * Vòng đời (BR-tkt-014/015): chưa đủ 3 tháng chốt ⇒ KHÔNG có dòng (`CHUA_SAN_SANG`) · đủ 3 tháng ⇒ dòng
 * tự sinh `READY_TO_EXPORT`, số tính lại mỗi lần đọc · xuất ⇒ `EXPORTED`, số đóng băng, 3 tháng khóa
 * vĩnh viễn · kế toán đánh dấu ⇒ `SUBMITTED`.
 *
 * Mọi đường GHI của quý đi qua `moQuyDeGhi`: khóa đọc các dòng khóa `TAX_SHEET` (FOR SHARE) rồi khóa ghi
 * dòng tờ khai (FOR UPDATE) trong CÙNG giao dịch. Người mở lại tháng (xóa dòng khóa) phải chờ giao dịch
 * này xong ⇒ không thể mở lại một tháng đúng lúc tờ khai của quý đang được xuất (data-model Mục 5.3).
 */

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;
type DongToKhai = hrm_to_khai_tncn05;

const KY_LOAI = 'quy';
/** Tờ khai chính thức. Khai bổ sung (`so_lan > 0`) ngoài phạm vi đợt này (EC-tkt-03). */
const SO_LAN_CHINH_THUC = 0;

function khoaChinh(nam: number, quy: number) {
  return { nam, ky_loai: KY_LOAI, ky_so: quy, so_lan: SO_LAN_CHINH_THUC };
}

const laDaXuat = (trangThai: string) => TO_KHAI_DA_XUAT.includes(trangThai);

export interface NguoiNopThue {
  maSoThue: string;
  ten: string;
  diaChi: string;
  coQuanThueQuanLy: string;
}

/** Thông tin người nộp thuế đọc từ control plane (FR-tkt-014) — nguồn DUY NHẤT ngoài DB tenant. */
export async function layThongTinNguoiNopThue(
  donViId: string,
): Promise<NguoiNopThue> {
  const dv = await sysPrisma.donVi.findUnique({
    where: { id: donViId },
    select: { maSoThue: true, tenDonVi: true, diaChi: true },
  });
  return {
    maSoThue: dv?.maSoThue ?? '',
    ten: dv?.tenDonVi ?? '',
    diaChi: dv?.diaChi ?? '',
    // Chưa có nơi nào lưu "cơ quan thuế quản lý" (bảng đơn vị không có cột này; tờ khai GTGT cũng để
    // trống) ⇒ để trống cho kế toán điền tay. Bổ sung trường lưu là việc của đợt sau.
    coQuanThueQuanLy: '',
  };
}

export interface ThangTrongQuy {
  month: number;
  periodId: string | null;
  daChot: boolean;
  payrollStatus: string | null;
}

function docKyTrongQuy(db: Db, nam: number, quy: number) {
  return db.payrollPeriod.findMany({
    where: { year: nam, month: { in: cacThangCuaQuy(quy) } },
    select: { id: true, month: true, status: true },
  });
}

type KyTrongQuy = Awaited<ReturnType<typeof docKyTrongQuy>>;

function ghepThang(
  quy: number,
  ky: KyTrongQuy,
  daChot: Set<string>,
): ThangTrongQuy[] {
  return cacThangCuaQuy(quy).map((month) => {
    const k = ky.find((x) => x.month === month);
    return {
      month,
      periodId: k?.id ?? null,
      daChot: !!k && daChot.has(k.id),
      payrollStatus: k?.status ?? null,
    };
  });
}

/** Trạng thái 3 tháng — chỉ đọc, dùng cho nhánh không ghi. */
async function docThangTrongQuy(
  db: Db,
  nam: number,
  quy: number,
): Promise<ThangTrongQuy[]> {
  const ky = await docKyTrongQuy(db, nam, quy);
  const khoa =
    ky.length === 0
      ? []
      : await db.payrollModuleLock.findMany({
          where: { module: 'TAX_SHEET', periodId: { in: ky.map((k) => k.id) } },
          select: { periodId: true },
        });
  return ghepThang(quy, ky, new Set(khoa.map((k) => k.periodId)));
}

/** Như `docThangTrongQuy` nhưng GIỮ KHÓA ĐỌC các dòng khóa `TAX_SHEET` tới hết giao dịch. */
async function khoaThangTrongQuy(
  tx: Tx,
  nam: number,
  quy: number,
): Promise<ThangTrongQuy[]> {
  const ky = await docKyTrongQuy(tx, nam, quy);
  const khoa =
    ky.length === 0
      ? []
      : await tx.$queryRaw<Array<{ periodId: string }>>`
          SELECT "periodId" FROM "hrm_payroll_module_locks"
           WHERE "module" = 'TAX_SHEET' AND "periodId" IN (${Prisma.join(ky.map((k) => k.id))})
             FOR SHARE`;
  return ghepThang(quy, ky, new Set(khoa.map((k) => k.periodId)));
}

async function docDongQuy(
  db: Db,
  cacThang: ThangTrongQuy[],
): Promise<DongThueQuy[]> {
  const thangTheoKy = new Map<string, number>();
  for (const t of cacThang)
    if (t.periodId) thangTheoKy.set(t.periodId, t.month);
  if (thangTheoKy.size === 0) return [];

  const dong = await db.taxCalculationLine.findMany({
    where: { periodId: { in: [...thangTheoKy.keys()] } },
  });
  return dong.map((l) => {
    const tien = {} as Record<CotTienBangThue, number>;
    for (const c of COT_TIEN_BANG_THUE) tien[c] = Number(l[c]);
    return {
      ...tien,
      thang: thangTheoKy.get(l.periodId) ?? 0,
      recipientKey: l.recipientKey,
      ma_nv: l.ma_nv,
      ho_ten: l.ho_ten,
      mst_ca_nhan: l.mst_ca_nhan,
      so_cccd: l.so_cccd,
      loai_lao_dong: l.loai_lao_dong,
      cu_tru: l.cu_tru,
    };
  });
}

/** Các cột suy từ số máy + ghi đè — MỘT cách ghi cho mọi đường (tạo, đọc tính lại, sửa, xuất). */
function ghiLaiChiTieu(ctMay: ChiTieuTncn05, ghiDe: GhiDeChiTieu) {
  const ct = hopNhatGhiDe(ctMay, ghiDe);
  return {
    ct_may: ctMay as unknown as Prisma.InputJsonValue,
    ct: ct as unknown as Prisma.InputJsonValue,
    ghi_de: ghiDe as unknown as Prisma.InputJsonValue,
    ct16: ct.ct16,
    ct21: ct.ct21,
    ct29: ct.ct29,
    canh_bao: kiemTraCanDoi(ct),
    tinh_luc: new Date(),
  };
}

type QuyDeGhi =
  | { san: false; cacThang: ThangTrongQuy[] }
  | {
      san: true;
      cacThang: ThangTrongQuy[];
      row: DongToKhai;
      ctMay: ChiTieuTncn05;
    };

/**
 * Mở quý để GHI, trong giao dịch `tx`: khóa đọc 3 khóa tháng → (đủ 3 tháng) tính số máy từ snapshot →
 * bảo đảm có dòng tờ khai → khóa ghi dòng đó. Dòng đã xuất vẫn trả về — nơi gọi tự quyết lỗi.
 */
async function moQuyDeGhi(tx: Tx, nam: number, quy: number): Promise<QuyDeGhi> {
  const cacThang = await khoaThangTrongQuy(tx, nam, quy);
  if (!cacThang.every((t) => t.daChot)) return { san: false, cacThang };

  const ctMay = tinhChiTieuMay(await docDongQuy(tx, cacThang));
  const pk = khoaChinh(nam, quy);
  // Lần đầu đủ 3 tháng thì chưa có dòng — tạo; người khác vừa tạo thì bỏ qua (ON CONFLICT DO NOTHING).
  await tx.hrm_to_khai_tncn05.createMany({
    data: [
      { ...pk, trang_thai: 'READY_TO_EXPORT', ...ghiLaiChiTieu(ctMay, {}) },
    ],
    skipDuplicates: true,
  });
  // Khóa ghi dòng: hai người sửa ghi đè hoặc xuất cùng lúc thì người sau chờ rồi đọc số mới nhất.
  await tx.$queryRaw`
    SELECT 1 FROM "hrm_to_khai_tncn05"
     WHERE "nam" = ${nam} AND "ky_loai" = ${KY_LOAI} AND "ky_so" = ${quy} AND "so_lan" = ${SO_LAN_CHINH_THUC}
       FOR UPDATE`;
  const row = await tx.hrm_to_khai_tncn05.findUniqueOrThrow({
    where: { nam_ky_loai_ky_so_so_lan: pk },
  });
  return { san: true, cacThang, row, ctMay };
}

export interface ToKhaiTncn05Dto {
  nam: number;
  quy: number;
  trangThai: 'CHUA_SAN_SANG' | TrangThaiToKhai;
  cacThang: ThangTrongQuy[];
  thongTinNguoiNopThue: NguoiNopThue & { nguoiKy: string | null };
  ct: ChiTieuTncn05 | null;
  ctMay: ChiTieuTncn05 | null;
  ghiDe: GhiDeChiTieu;
  canhBao: string[];
  ctGocSuaDuoc: string[];
  tinhLuc: string | null;
  xuatBoi: string | null;
  xuatBoiTen: string | null;
  xuatLuc: string | null;
  nopBoi: string | null;
  nopBoiTen: string | null;
  nopLuc: string | null;
  nguoiKy: string | null;
  ngayKy: string | null;
}

async function veDto(
  row: DongToKhai | null,
  nam: number,
  quy: number,
  cacThang: ThangTrongQuy[],
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  const ten = await layHoTenNguoiDung([row?.khoa_so_boi, row?.nop_boi]);
  const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
  const tenCua = (id: string | null | undefined) => (id && ten.get(id)) || null;
  return {
    nam,
    quy,
    trangThai: row ? (row.trang_thai as TrangThaiToKhai) : 'CHUA_SAN_SANG',
    cacThang,
    thongTinNguoiNopThue: { ...nguoiNopThue, nguoiKy: row?.nguoi_ky ?? null },
    ct: row ? (row.ct as unknown as ChiTieuTncn05) : null,
    ctMay: row ? (row.ct_may as unknown as ChiTieuTncn05) : null,
    ghiDe: (row?.ghi_de ?? {}) as unknown as GhiDeChiTieu,
    canhBao: (row?.canh_bao ?? []) as unknown as string[],
    ctGocSuaDuoc: [...CT_GOC_SUA_DUOC],
    tinhLuc: iso(row?.tinh_luc),
    xuatBoi: row?.khoa_so_boi ?? null,
    xuatBoiTen: tenCua(row?.khoa_so_boi),
    xuatLuc: iso(row?.khoa_so_luc),
    nopBoi: row?.nop_boi ?? null,
    nopBoiTen: tenCua(row?.nop_boi),
    nopLuc: iso(row?.nop_luc),
    nguoiKy: row?.nguoi_ky ?? null,
    ngayKy: row?.ngay_ky ? row.ngay_ky.toISOString().slice(0, 10) : null,
  };
}

/** Cột `@db.Date`: dựng mốc 00:00Z của đúng ngày, không để lệch múi giờ đẩy lùi một ngày. */
function ngayThuan(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

/** Ngày theo giờ Việt Nam — xuất lúc 6h sáng vẫn là ngày hôm đó, không phải hôm trước theo UTC. */
function ngayVietNam(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

/** 5.1 — GET có tác dụng phụ ghi (tự tạo dòng / tính lại `ct_may`), đúng như hợp đồng ghi rõ. */
export async function getToKhai(
  db: PrismaClient,
  nam: number,
  quy: number,
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  const pk = khoaChinh(nam, quy);
  const daCo = await db.hrm_to_khai_tncn05.findUnique({
    where: { nam_ky_loai_ky_so_so_lan: pk },
  });
  // Đã xuất là bất biến: đọc nguyên, không khóa, không tính lại.
  if (daCo && laDaXuat(daCo.trang_thai)) {
    return veDto(
      daCo,
      nam,
      quy,
      await docThangTrongQuy(db, nam, quy),
      nguoiNopThue,
    );
  }

  const { cacThang, row } = await db.$transaction(async (tx) => {
    const q = await moQuyDeGhi(tx, nam, quy);
    if (!q.san) {
      // AC-tkt-022: chưa đủ 3 tháng thì KHÔNG có dòng. Dọn dòng chưa xuất còn sót nếu một tháng vừa
      // được mở lại chen giữa (mở lại đã tự xóa, đây là lưới an toàn cho ca đua).
      await tx.hrm_to_khai_tncn05.deleteMany({
        where: { ...pk, trang_thai: { notIn: [...TO_KHAI_DA_XUAT] } },
      });
      return { cacThang: q.cacThang, row: null };
    }
    if (laDaXuat(q.row.trang_thai)) return { cacThang: q.cacThang, row: q.row };
    // Dữ liệu tháng có thể vừa đổi (Mở lại rồi Chốt lại) ⇒ tính lại số máy mỗi lần đọc.
    const row = await tx.hrm_to_khai_tncn05.update({
      where: { nam_ky_loai_ky_so_so_lan: pk },
      data: ghiLaiChiTieu(q.ctMay, q.row.ghi_de as unknown as GhiDeChiTieu),
    });
    return { cacThang: q.cacThang, row };
  });
  return veDto(row, nam, quy, cacThang, nguoiNopThue);
}

/** 5.2 — lịch sử các kỳ; ba chỉ tiêu đọc từ cột bóc tách, không quét JSONB. */
export async function listKyToKhai(db: PrismaClient, nam?: number) {
  const rows = await db.hrm_to_khai_tncn05.findMany({
    where: {
      ky_loai: KY_LOAI,
      so_lan: SO_LAN_CHINH_THUC,
      ...(nam !== undefined ? { nam } : {}),
    },
    orderBy: [{ nam: 'desc' }, { ky_so: 'desc' }],
  });
  const ten = await layHoTenNguoiDung(
    rows.flatMap((r) => [r.khoa_so_boi, r.nop_boi]),
  );
  const tenCua = (id: string | null) => (id && ten.get(id)) || null;
  return rows.map((r) => ({
    nam: r.nam,
    quy: r.ky_so,
    trangThai: r.trang_thai as TrangThaiToKhai,
    ct16: r.ct16,
    ct21: Number(r.ct21),
    ct29: Number(r.ct29),
    xuatBoi: r.khoa_so_boi,
    xuatBoiTen: tenCua(r.khoa_so_boi),
    xuatLuc: r.khoa_so_luc?.toISOString() ?? null,
    nopBoi: r.nop_boi,
    nopBoiTen: tenCua(r.nop_boi),
    nopLuc: r.nop_luc?.toISOString() ?? null,
  }));
}

async function suaGhiDe(
  db: PrismaClient,
  nam: number,
  quy: number,
  bienDoi: (cu: GhiDeChiTieu) => GhiDeChiTieu,
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  const pk = khoaChinh(nam, quy);
  const { cacThang, row } = await db.$transaction(async (tx) => {
    const q = await moQuyDeGhi(tx, nam, quy);
    if (!q.san) {
      throw new ToKhaiThueError(
        'E-tkt-010',
        'Phải chốt đủ Bảng tính thuế của cả ba tháng trong quý trước khi ghi đè chỉ tiêu tờ khai.',
      );
    }
    // EC-tkt-03: tờ khai đã xuất là bộ số đã/chuẩn bị nộp — sửa là lệch với bản trên tay cơ quan thuế.
    if (laDaXuat(q.row.trang_thai)) throw new ToKhaiThueError('E-tkt-019');
    const row = await tx.hrm_to_khai_tncn05.update({
      where: { nam_ky_loai_ky_so_so_lan: pk },
      data: ghiLaiChiTieu(
        q.ctMay,
        bienDoi(q.row.ghi_de as unknown as GhiDeChiTieu),
      ),
    });
    return { cacThang: q.cacThang, row };
  });
  return veDto(row, nam, quy, cacThang, nguoiNopThue);
}

/** 5.3 — thêm/sửa ghi đè (gộp vào ghi đè đang có). */
export async function putGhiDe(
  db: PrismaClient,
  nam: number,
  quy: number,
  overrides: Record<string, { gia: number; lyDo?: string }>,
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  // Kiểm lý do + mã chỉ tiêu TRƯỚC mọi truy vấn: đầu vào sai không được mở giao dịch nào.
  const moi = chuanHoaGhiDe(overrides);
  return suaGhiDe(db, nam, quy, (cu) => ({ ...cu, ...moi }), nguoiNopThue);
}

/** 5.4 — xóa ghi đè của một chỉ tiêu, hoặc toàn bộ khi không chỉ định. */
export async function deleteGhiDe(
  db: PrismaClient,
  nam: number,
  quy: number,
  ct: string | undefined,
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  if (
    ct !== undefined &&
    !(CT_GOC_SUA_DUOC as readonly string[]).includes(ct)
  ) {
    throw new ToKhaiThueError(
      'E-tkt-012',
      `"${ct}" không phải chỉ tiêu gốc sửa được của tờ khai 05/KK-TNCN.`,
    );
  }
  return suaGhiDe(
    db,
    nam,
    quy,
    (cu) => {
      if (ct === undefined) return {};
      const conLai = { ...cu };
      delete conLai[ct as CtTag];
      return conLai;
    },
    nguoiNopThue,
  );
}

/**
 * 5.5 — xuất tờ khai: chuyển `EXPORTED` và chốt bộ số trong giao dịch. Dựng file KHÔNG nằm ở đây —
 * controller dựng sau khi giao dịch đã commit (Puppeteer vài giây không được giữ khóa hàng).
 */
export async function xuatToKhai(
  db: PrismaClient,
  input: { nam: number; quy: number; nguoiKy?: string; ngayKy?: string },
  userId: string,
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  const pk = khoaChinh(input.nam, input.quy);
  const bayGio = new Date();
  const { cacThang, row } = await db.$transaction(async (tx) => {
    const q = await moQuyDeGhi(tx, input.nam, input.quy);
    if (!q.san) throw new ToKhaiThueError('E-tkt-010');
    if (laDaXuat(q.row.trang_thai)) throw new ToKhaiThueError('E-tkt-020');
    const row = await tx.hrm_to_khai_tncn05.update({
      where: { nam_ky_loai_ky_so_so_lan: pk },
      data: {
        // Chốt bộ số ĐÚNG lúc xuất (snapshot 3 tháng + ghi đè hiện hành) — từ đây bất biến.
        ...ghiLaiChiTieu(q.ctMay, q.row.ghi_de as unknown as GhiDeChiTieu),
        trang_thai: 'EXPORTED',
        khoa_so_boi: userId,
        khoa_so_luc: bayGio,
        nguoi_ky: input.nguoiKy ?? q.row.nguoi_ky,
        ngay_ky: input.ngayKy
          ? ngayThuan(input.ngayKy)
          : (q.row.ngay_ky ?? ngayThuan(ngayVietNam(bayGio))),
      },
    });
    return { cacThang: q.cacThang, row };
  });
  return veDto(row, input.nam, input.quy, cacThang, nguoiNopThue);
}

/** Tải lại file của tờ khai ĐÃ xuất — chỉ đọc bộ số đã chốt, không đổi trạng thái. */
export async function layToKhaiDaXuat(
  db: PrismaClient,
  nam: number,
  quy: number,
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  const row = await db.hrm_to_khai_tncn05.findUnique({
    where: { nam_ky_loai_ky_so_so_lan: khoaChinh(nam, quy) },
  });
  if (!row || !laDaXuat(row.trang_thai)) {
    throw new ToKhaiThueError(
      'E-tkt-013',
      'Chỉ tải lại được file của tờ khai đã xuất. Tờ khai chưa xuất thì dùng chức năng Xuất tờ khai.',
    );
  }
  return veDto(
    row,
    nam,
    quy,
    await docThangTrongQuy(db, nam, quy),
    nguoiNopThue,
  );
}

/** 5.6 — bảng chi tiết theo nhân viên nội bộ, gộp 3 tháng. */
export async function getBangChiTiet(
  db: PrismaClient,
  nam: number,
  quy: number,
): Promise<DongChiTietNhanVien[]> {
  return db.$transaction(async (tx) => {
    // Khóa đọc 3 khóa tháng: không để một tháng bị mở lại (xóa snapshot) giữa lúc kiểm và lúc đọc số.
    const cacThang = await khoaThangTrongQuy(tx, nam, quy);
    if (!cacThang.every((t) => t.daChot)) {
      throw new ToKhaiThueError(
        'E-tkt-010',
        'Phải chốt đủ Bảng tính thuế của cả ba tháng trong quý trước khi xem bảng chi tiết.',
      );
    }
    return gopChiTietNhanVien(await docDongQuy(tx, cacThang));
  });
}

/** 5.7 — đánh dấu đã nộp. Thao tác thủ công, KHÔNG xác thực với cơ quan thuế (BR-tkt-015). */
export async function danhDauDaNop(
  db: PrismaClient,
  input: { nam: number; quy: number; nguoiKy?: string; ngayKy?: string },
  userId: string,
  nguoiNopThue: NguoiNopThue,
): Promise<ToKhaiTncn05Dto> {
  const pk = khoaChinh(input.nam, input.quy);
  // Kiểm + ghi trong MỘT lệnh có điều kiện: bấm hai lần hoặc hai người cùng bấm thì người sau nhận E-tkt-013.
  const { count } = await db.hrm_to_khai_tncn05.updateMany({
    where: { ...pk, trang_thai: 'EXPORTED' },
    data: {
      trang_thai: 'SUBMITTED',
      nop_boi: userId,
      nop_luc: new Date(),
      ...(input.nguoiKy !== undefined ? { nguoi_ky: input.nguoiKy } : {}),
      ...(input.ngayKy !== undefined
        ? { ngay_ky: ngayThuan(input.ngayKy) }
        : {}),
    },
  });
  if (count === 0) throw new ToKhaiThueError('E-tkt-013');
  const row = await db.hrm_to_khai_tncn05.findUniqueOrThrow({
    where: { nam_ky_loai_ky_so_so_lan: pk },
  });
  return veDto(
    row,
    input.nam,
    input.quy,
    await docThangTrongQuy(db, input.nam, input.quy),
    nguoiNopThue,
  );
}
