import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ToKhaiThueError } from '../../../../helpers/hrm/toKhaiThueErrors';
import type { NhomXuLyThue } from '../../../../validators/hrm/to_khai_thue/incomeCategory.validator';
import {
  tinhThueThuNhapNgoaiLuong,
  type KetQuaTinhThue,
} from './otherIncomeTax';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * BẢN GHI THU NHẬP NGOÀI LƯƠNG — 6 endpoint (api-contract Mục 3), BR-tkt-005…009, ADR-013 tầng 1.
 *
 * Nguyên tắc xuyên suốt: bản ghi lưu **snapshot KẾT QUẢ** (`taxTreatmentGroup`/`exemptAmount`/
 * `taxableAmount`) tại thời điểm ghi, không lưu tham số. Sửa danh mục về sau KHÔNG đổi ngược số
 * của bản ghi cũ — cùng luật với `PieceworkRecord.unitPrice`.
 */

/** Hai khóa khiến kỳ không nhập/sửa/xóa được nữa (hợp đồng Mục 3.1). */
const KHOA_CHAN_GHI = ['TAX_SHEET', 'OTHER_INCOME'] as const;

export async function kyDaKhoa(db: Db, periodId: string): Promise<boolean> {
  const khoa = await db.payrollModuleLock.findFirst({
    where: { periodId, module: { in: [...KHOA_CHAN_GHI] } },
    select: { id: true },
  });
  return khoa !== null;
}

/**
 * Mở kỳ để GHI khoản ngoài lương, gọi ở đầu giao dịch ghi (RVW-722): khóa đọc chung dòng kỳ lương
 * (`FOR SHARE`) rồi mới kiểm khóa tháng. Chốt tháng giữ khóa ghi (`FOR UPDATE`) trên cùng dòng kỳ nên hai
 * bên buộc xếp hàng: lượt ghi đến sau thấy khóa `TAX_SHEET` vừa commit, lượt Chốt đến sau tính trên dữ liệu
 * đã commit. Kiểm ngoài giao dịch như trước thì một khoản vẫn lọt vào tháng vừa chốt, hoặc bị xóa khỏi tháng
 * trong khi snapshot còn giữ. Cùng khuôn `khoaKyDeGhiDuLieu` của bảng kê lương.
 */
async function moKyDeGhi(
  tx: Prisma.TransactionClient,
  periodId: string,
): Promise<void> {
  const ky = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "hrm_payroll_periods" WHERE id = ${periodId} FOR SHARE`;
  if (ky.length === 0) throw new ToKhaiThueError('E-tkt-017');
  if (await kyDaKhoa(tx, periodId)) throw new ToKhaiThueError('E-tkt-007');
}

export interface OtherIncomeRecordDto {
  id: string;
  periodId: string;
  ma_nv: string | null;
  otherIncomeCategoryId: string | null;
  category: {
    id: string;
    code: string;
    name: string;
    taxTreatmentGroup: NhomXuLyThue;
  } | null;
  fullName: string;
  taxCode: string | null;
  idCardNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isResident: boolean;
  paymentDate: string;
  paymentType: 'GROSS' | 'NET';
  taxTreatmentGroup: NhomXuLyThue | null;
  grossAmount: number;
  netAmount: number;
  exemptAmount: number;
  taxableAmount: number;
  taxDeductionType: string;
  taxRate: number;
  taxDeducted: number;
  hasCommitment08: boolean;
  forceWithholding: boolean;
  eWithholdingCertNo: string | null;
  eWithholdingCertDate: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

type HangCoDanhMuc = Prisma.OtherIncomeRecordGetPayload<{
  include: {
    category: {
      select: { id: true; code: true; name: true; taxTreatmentGroup: true };
    };
  };
}>;

const KEM_DANH_MUC = {
  category: {
    select: { id: true, code: true, name: true, taxTreatmentGroup: true },
  },
} as const;

function ngayIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function veDto(r: HangCoDanhMuc): OtherIncomeRecordDto {
  return {
    id: r.id,
    periodId: r.periodId,
    ma_nv: r.ma_nv,
    otherIncomeCategoryId: r.otherIncomeCategoryId,
    // `category` là giá trị HIỆN TẠI của danh mục; `taxTreatmentGroup` dưới đây là SNAPSHOT lúc
    // ghi. Hai trường CÓ THỂ khác nhau sau khi danh mục bị sửa — đúng thiết kế ADR-013.
    category: r.category
      ? {
          id: r.category.id,
          code: r.category.code,
          name: r.category.name,
          taxTreatmentGroup: r.category.taxTreatmentGroup as NhomXuLyThue,
        }
      : null,
    fullName: r.fullName,
    taxCode: r.taxCode,
    idCardNumber: r.idCardNumber,
    address: r.address,
    phone: r.phone,
    email: r.email,
    isResident: r.isResident,
    paymentDate: ngayIso(r.paymentDate),
    paymentType: r.paymentType as 'GROSS' | 'NET',
    taxTreatmentGroup: (r.taxTreatmentGroup as NhomXuLyThue | null) ?? null,
    grossAmount: Number(r.grossAmount),
    netAmount: Number(r.netAmount),
    exemptAmount: Number(r.exemptAmount),
    taxableAmount: Number(r.taxableAmount),
    taxDeductionType: r.taxDeductionType,
    taxRate: Number(r.taxRate),
    taxDeducted: Number(r.taxDeducted),
    hasCommitment08: r.hasCommitment08,
    forceWithholding: r.forceWithholding,
    eWithholdingCertNo: r.eWithholdingCertNo,
    eWithholdingCertDate: r.eWithholdingCertDate
      ? ngayIso(r.eWithholdingCertDate)
      : null,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * Khóa gom người nhận (ADR-013): nhân viên nội bộ theo `ma_nv`; cá nhân vãng lai theo CCCD, không có thì
 * MST, không có nữa mới dùng họ tên chuẩn hóa — hai CTV trùng tên khác CCCD là hai người (RVW-727, chủ dự
 * án chốt 2026-09-15). PHẢI khớp biểu thức của index `hrm_oir_chong_trung_v2` (`hrmTenantConstraints.ts`):
 * lệch nhau thì chống trùng và gộp dòng Bảng tính thuế hiểu "một người" theo hai cách.
 */
export function khoaNguoiNhan(
  maNv: string | null,
  hoTen: string,
  cccd?: string | null,
  mst?: string | null,
): string {
  if (maNv !== null) return maNv;
  const dinhDanh = cccd?.trim() || mst?.trim() || hoTen.trim();
  return `VL:${dinhDanh.toLowerCase()}`;
}

/**
 * Phần trần miễn thuế đã dùng của CÙNG người + CÙNG danh mục trong cửa sổ trần.
 *
 * Trần là mức lũy kế theo tháng hoặc theo năm dương lịch, KHÔNG phải mức cho mỗi lần chi — chia
 * đều theo lần chi thì một người nhận 3 lần trong tháng sẽ được miễn gấp ba.
 */
async function daMienTrongKy(
  db: Db,
  args: {
    otherIncomeCategoryId: string;
    chuKy: 'MONTHLY' | 'YEARLY';
    paymentDate: Date;
    maNv: string | null;
    fullName: string;
    idCardNumber?: string | null;
    taxCode?: string | null;
    boQuaId?: string;
  },
): Promise<number> {
  const d = args.paymentDate;
  const tu =
    args.chuKy === 'YEARLY'
      ? new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const den =
    args.chuKy === 'YEARLY'
      ? new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1))
      : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

  const rows = await db.otherIncomeRecord.findMany({
    where: {
      otherIncomeCategoryId: args.otherIncomeCategoryId,
      paymentDate: { gte: tu, lt: den },
      ...(args.boQuaId ? { id: { not: args.boQuaId } } : {}),
      ...(args.maNv ? { ma_nv: args.maNv } : { ma_nv: null }),
    },
    select: {
      exemptAmount: true,
      fullName: true,
      ma_nv: true,
      idCardNumber: true,
      taxCode: true,
    },
  });

  // Vãng lai không có `ma_nv` nên phải gom theo khóa người nhận ở tầng ứng dụng.
  const khoa = khoaNguoiNhan(
    args.maNv,
    args.fullName,
    args.idCardNumber,
    args.taxCode,
  );
  return rows
    .filter(
      (r) =>
        khoaNguoiNhan(r.ma_nv, r.fullName, r.idCardNumber, r.taxCode) === khoa,
    )
    .reduce((s, r) => s + Number(r.exemptAmount), 0);
}

export interface TinhThuInput {
  otherIncomeCategoryId: string;
  ma_nv?: string | null;
  fullName: string;
  taxCode?: string | null;
  idCardNumber?: string | null;
  isResident?: boolean;
  paymentDate: string;
  paymentType?: 'GROSS' | 'NET';
  amount: number;
  hasCommitment08?: boolean;
  forceWithholding?: boolean;
}

/**
 * Lấy danh mục + soát quan hệ nhóm ↔ đối tượng + Cam kết 08, rồi chạy engine.
 * Dùng chung cho `preview`, `create` và `update` — một đường tính duy nhất.
 */
async function tinhSnapshot(
  db: Db,
  input: TinhThuInput,
  boQuaId?: string,
): Promise<{ ketQua: KetQuaTinhThue; nhom: NhomXuLyThue; tenDanhMuc: string }> {
  const dm = await db.otherIncomeCategory.findUnique({
    where: { id: input.otherIncomeCategoryId },
  });
  if (!dm || dm.status !== 'ACTIVE') {
    throw new ToKhaiThueError(
      'E-tkt-003',
      'Loại thu nhập không tồn tại hoặc đã ngừng dùng.',
    );
  }
  const nhom = dm.taxTreatmentGroup as NhomXuLyThue;
  const maNv = input.ma_nv ?? null;

  // BR-tkt-009 / AC-tkt-015: ba nhóm kia chỉ dùng cho nhân viên nội bộ.
  if (nhom !== 'WITHHOLDING_FLAT' && maNv === null) {
    throw new ToKhaiThueError('E-tkt-021');
  }

  // Nhân viên phải có thật và chưa xóa mềm — cùng luật `assertNhanVienTonTai` của hồ sơ hợp đồng.
  // Thiếu bước này thì mã sai đi thẳng xuống lệnh ghi, vỡ khóa ngoại thành 409 "đang được sử dụng"
  // không mã lỗi, còn tính thử thì ra số cho một người không tồn tại (BUG-tkt-001).
  if (
    maNv !== null &&
    !(await db.hrm_nhan_vien.findFirst({
      where: { ma_nv: maNv, da_xoa: false },
      select: { ma_nv: true },
    }))
  ) {
    throw new ToKhaiThueError(
      'E-tkt-016',
      `Không tìm thấy nhân viên mã "${maNv}".`,
    );
  }

  // BR-tkt-008 / AC-tkt-014: Cam kết 08 cần ĐỒNG THỜI 3 điều kiện.
  const hasCk08 = input.hasCommitment08 === true;
  if (
    hasCk08 &&
    (nhom !== 'WITHHOLDING_FLAT' ||
      input.isResident === false ||
      !input.taxCode?.trim())
  ) {
    throw new ToKhaiThueError('E-tkt-006');
  }

  // SRS Mục 2.2: cá nhân không cư trú (khấu trừ 20%) ngoài phạm vi đợt này. Chặn thay vì để engine gắn
  // nhãn 20% mà tính theo tỷ lệ danh mục rồi đưa số sai lên tờ khai — chủ dự án chọn chặn 2026-09-15
  // (BUG-tkt-003). Đặt SAU Cam kết 08 để ca "Cam kết 08 + không cư trú" vẫn ra đúng E-tkt-006.
  if (input.isResident === false) {
    throw new ToKhaiThueError(
      'E-tkt-004',
      'Chưa hỗ trợ khoản chi trả cho cá nhân không cư trú (khấu trừ 20%) trong đợt này — chỉ ghi được cá nhân cư trú.',
    );
  }

  const paymentDate = new Date(`${input.paymentDate}T00:00:00.000Z`);
  const daMien =
    nhom === 'EXEMPT_CAPPED' && dm.exemptCapPeriod
      ? await daMienTrongKy(db, {
          otherIncomeCategoryId: dm.id,
          chuKy: dm.exemptCapPeriod,
          paymentDate,
          maNv,
          fullName: input.fullName,
          idCardNumber: input.idCardNumber,
          taxCode: input.taxCode,
          boQuaId,
        })
      : 0;

  const ketQua = tinhThueThuNhapNgoaiLuong(
    {
      taxTreatmentGroup: nhom,
      exemptCapAmount:
        dm.exemptCapAmount === null ? null : Number(dm.exemptCapAmount),
      exemptCapPeriod: dm.exemptCapPeriod,
      withholdingRate:
        dm.withholdingRate === null ? null : Number(dm.withholdingRate),
      withholdingThreshold:
        dm.withholdingThreshold === null
          ? null
          : Number(dm.withholdingThreshold),
    },
    {
      amount: input.amount,
      paymentType: input.paymentType ?? 'GROSS',
      isResident: input.isResident ?? true,
      hasCommitment08: hasCk08,
      forceWithholding: input.forceWithholding === true,
      daMienTrongKy: daMien,
    },
  );

  return { ketQua, nhom, tenDanhMuc: dm.name };
}

export async function previewOtherIncome(
  db: Db,
  input: TinhThuInput,
): Promise<KetQuaTinhThue> {
  const { ketQua } = await tinhSnapshot(db, input);
  return ketQua;
}

export interface CreateOtherIncomeInput extends TinhThuInput {
  periodId: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  eWithholdingCertNo?: string | null;
  eWithholdingCertDate?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
}

/** `paymentDate` phải nằm trong đúng tháng của kỳ (AC-tkt-006). */
async function soatKyVaNgay(
  db: Db,
  periodId: string,
  paymentDate: string,
): Promise<void> {
  const ky = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    select: { year: true, month: true },
  });
  if (!ky) throw new ToKhaiThueError('E-tkt-017');

  const d = new Date(`${paymentDate}T00:00:00.000Z`);
  if (d.getUTCFullYear() !== ky.year || d.getUTCMonth() + 1 !== ky.month) {
    throw new ToKhaiThueError(
      'E-tkt-004',
      `Ngày chi trả phải nằm trong tháng ${String(ky.month).padStart(2, '0')}/${ky.year} của kỳ lương.`,
    );
  }
}

function laLoiTrungKhoa(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

function duLieuChung(
  input: CreateOtherIncomeInput,
  kq: KetQuaTinhThue,
  tenDanhMuc: string,
) {
  return {
    ma_nv: input.ma_nv ?? null,
    otherIncomeCategoryId: input.otherIncomeCategoryId,
    // Cột LỖI THỜI, còn NOT NULL tới bước M-4 của lộ trình di trú. Điền bằng TÊN danh mục để dữ
    // liệu cũ và mới cùng ngữ nghĩa nếu ai đó phải đọc cột này trong giai đoạn chuyển tiếp.
    // Mã mới KHÔNG được đọc `incomeType` — nguồn sự thật là `otherIncomeCategoryId`.
    incomeType: tenDanhMuc.slice(0, 50),
    fullName: input.fullName.trim(),
    taxCode: input.taxCode ?? null,
    idCardNumber: input.idCardNumber ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    isResident: input.isResident ?? true,
    paymentDate: new Date(`${input.paymentDate}T00:00:00.000Z`),
    paymentType: input.paymentType ?? 'GROSS',
    // Snapshot kết quả (ADR-013) — KHÔNG lưu tham số của danh mục.
    taxTreatmentGroup: kq.taxTreatmentGroup,
    grossAmount: kq.grossAmount,
    netAmount: kq.netAmount,
    exemptAmount: kq.exemptAmount,
    taxableAmount: kq.taxableAmount,
    taxDeductionType: kq.taxDeductionType,
    taxRate: kq.taxRate,
    taxDeducted: kq.taxDeducted,
    hasCommitment08: input.hasCommitment08 === true,
    forceWithholding: input.forceWithholding === true,
    eWithholdingCertNo: input.eWithholdingCertNo ?? null,
    eWithholdingCertDate: input.eWithholdingCertDate
      ? new Date(`${input.eWithholdingCertDate}T00:00:00.000Z`)
      : null,
    note: input.note ?? null,
  };
}

export async function createOtherIncome(
  db: PrismaClient,
  input: CreateOtherIncomeInput,
): Promise<OtherIncomeRecordDto> {
  return db.$transaction(async (tx) => {
    // Thứ tự kiểm bám đúng bảng ở hợp đồng Mục 3.4 — mã lỗi trả về phụ thuộc thứ tự này.
    await moKyDeGhi(tx, input.periodId);
    await soatKyVaNgay(tx, input.periodId, input.paymentDate);
    const { ketQua, tenDanhMuc } = await tinhSnapshot(tx, input);

    try {
      const row = await tx.otherIncomeRecord.create({
        data: {
          periodId: input.periodId,
          createdByUserId: input.createdByUserId ?? null,
          ...duLieuChung(input, ketQua, tenDanhMuc),
        },
        include: KEM_DANH_MUC,
      });
      return veDto(row);
    } catch (err) {
      // Chống trùng là UNIQUE INDEX ở CSDL (`hrm_oir_chong_trung_v2`), không phải `findFirst` trước
      // `create`: hai request song song cùng vượt qua bước kiểm rồi cùng ghi. Double-click là
      // kịch bản đua điển hình — EC-tkt-07.
      if (laLoiTrungKhoa(err)) throw new ToKhaiThueError('E-tkt-005');
      throw err;
    }
  });
}

export type UpdateOtherIncomeInput = Omit<CreateOtherIncomeInput, 'periodId'>;

export async function updateOtherIncome(
  db: PrismaClient,
  id: string,
  input: UpdateOtherIncomeInput,
): Promise<OtherIncomeRecordDto> {
  return db.$transaction(async (tx) => {
    const cu = await tx.otherIncomeRecord.findUnique({
      where: { id },
      select: { periodId: true },
    });
    if (!cu) throw new ToKhaiThueError('E-tkt-016');

    await moKyDeGhi(tx, cu.periodId);
    await soatKyVaNgay(tx, cu.periodId, input.paymentDate);
    // Tính lại snapshot theo danh mục HIỆN TẠI; bỏ chính bản ghi này ra khỏi phần trần đã dùng,
    // nếu không sửa một khoản ăn ca sẽ tự trừ vào trần của chính nó.
    const { ketQua, tenDanhMuc } = await tinhSnapshot(
      tx,
      { ...input, periodId: cu.periodId } as TinhThuInput,
      id,
    );

    try {
      const row = await tx.otherIncomeRecord.update({
        where: { id },
        data: duLieuChung(
          { ...input, periodId: cu.periodId },
          ketQua,
          tenDanhMuc,
        ),
        include: KEM_DANH_MUC,
      });
      return veDto(row);
    } catch (err) {
      if (laLoiTrungKhoa(err)) throw new ToKhaiThueError('E-tkt-005');
      throw err;
    }
  });
}

export async function deleteOtherIncome(
  db: PrismaClient,
  id: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const cu = await tx.otherIncomeRecord.findUnique({
      where: { id },
      select: { periodId: true },
    });
    if (!cu) throw new ToKhaiThueError('E-tkt-016');
    await moKyDeGhi(tx, cu.periodId);
    await tx.otherIncomeRecord.delete({ where: { id } });
  });
}

export async function getOtherIncomeById(
  db: Db,
  id: string,
): Promise<OtherIncomeRecordDto> {
  const row = await db.otherIncomeRecord.findUnique({
    where: { id },
    include: KEM_DANH_MUC,
  });
  if (!row) throw new ToKhaiThueError('E-tkt-016');
  return veDto(row);
}

export interface ListOtherIncomeQuery {
  periodId: string;
  maNv?: string;
  taxDeductionType?: string;
  taxTreatmentGroup?: NhomXuLyThue;
  isResident?: boolean;
  q?: string;
  limit: number;
  offset: number;
}

export interface OtherIncomeListResult {
  records: OtherIncomeRecordDto[];
  summary: {
    totalRecords: number;
    totalGross: number;
    totalTax: number;
    totalNet: number;
  };
  periodLocked: boolean;
  totalCount: number;
}

export async function listOtherIncomes(
  db: Db,
  query: ListOtherIncomeQuery,
): Promise<OtherIncomeListResult> {
  const where: Prisma.OtherIncomeRecordWhereInput = {
    periodId: query.periodId,
    ...(query.maNv ? { ma_nv: query.maNv } : {}),
    ...(query.taxDeductionType
      ? {
          taxDeductionType:
            query.taxDeductionType as Prisma.OtherIncomeRecordWhereInput['taxDeductionType'],
        }
      : {}),
    ...(query.taxTreatmentGroup
      ? { taxTreatmentGroup: query.taxTreatmentGroup }
      : {}),
    ...(query.isResident !== undefined ? { isResident: query.isResident } : {}),
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: 'insensitive' as const } },
            { taxCode: { contains: query.q, mode: 'insensitive' as const } },
            {
              idCardNumber: { contains: query.q, mode: 'insensitive' as const },
            },
          ],
        }
      : {}),
  };

  const [ky, rows, tong, locked] = await Promise.all([
    // Kỳ không tồn tại (hoặc của công ty khác) phải báo E-tkt-017 — trả 200 rỗng thì giao diện hiểu là
    // "kỳ trống, nhập được" (hợp đồng Mục 7, RVW-726).
    db.payrollPeriod.findUnique({
      where: { id: query.periodId },
      select: { id: true },
    }),
    db.otherIncomeRecord.findMany({
      where,
      include: KEM_DANH_MUC,
      // Thứ tự là luật nghiệp vụ (hợp đồng Mục 0.4): khoản mới nhất trước. `id` cuối cùng giữ phân
      // trang ổn định khi hai khoản trùng thời điểm tạo.
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit,
    }),
    // `summary` tính trên TOÀN BỘ bộ lọc, không phải trang đang xem — nếu không, kế toán lật
    // trang thấy tổng nhảy và không tin được con số nào nữa (hợp đồng Mục 3.1).
    db.otherIncomeRecord.aggregate({
      where,
      _count: { _all: true },
      _sum: { grossAmount: true, taxDeducted: true, netAmount: true },
    }),
    kyDaKhoa(db, query.periodId),
  ]);
  if (!ky) throw new ToKhaiThueError('E-tkt-017');

  return {
    records: rows.map(veDto),
    summary: {
      totalRecords: tong._count._all,
      totalGross: Number(tong._sum.grossAmount ?? 0),
      totalTax: Number(tong._sum.taxDeducted ?? 0),
      totalNet: Number(tong._sum.netAmount ?? 0),
    },
    periodLocked: locked,
    totalCount: tong._count._all,
  };
}
