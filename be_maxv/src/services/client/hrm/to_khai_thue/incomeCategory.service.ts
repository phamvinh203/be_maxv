import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { DANH_MUC_THU_NHAP_SEED } from '../../../../constants/hrm/to_khai_thue/taxSeedData';
import { ToKhaiThueError } from '../../../../helpers/hrm/toKhaiThueErrors';
import {
  soatThamSoTheoNhom,
  type CreateIncomeCategoryBody,
  type NhomXuLyThue,
  type UpdateIncomeCategoryBody,
} from '../../../../validators/hrm/to_khai_thue/incomeCategory.validator';

type Db = PrismaClient | Prisma.TransactionClient;

/** Mặc định nghiệp vụ của nhóm khấu trừ tại nguồn khi kế toán bỏ trống (AC-tkt-002). */
const KHAU_TRU_MAC_DINH = { rate: 10.0, threshold: 5_000_000 };

/** Số lượt thử khi máy chủ tự cấp mã mà bị người khác chiếm mất — cùng ADR-001 với mã ca làm việc. */
const SO_LAN_THU_CAP_MA = 5;

export interface OtherIncomeCategoryDto {
  id: string;
  code: string;
  name: string;
  taxTreatmentGroup: NhomXuLyThue;
  exemptCapAmount: number | null;
  exemptCapPeriod: 'MONTHLY' | 'YEARLY' | null;
  withholdingRate: number | null;
  withholdingThreshold: number | null;
  legalBasisNote: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  /** TÍNH LÚC ĐỌC, không lưu cột — tránh 2 nguồn sự thật (data-model Mục 3.2). */
  appliesToInternalOnly: boolean;
  /** Số bản ghi đang dùng — FE ẩn nút Xóa khi > 0 để không bấm rồi ăn 400 (BR-tkt-004). */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

type HangCoDem = Prisma.OtherIncomeCategoryGetPayload<{
  include: { _count: { select: { records: true } } };
}>;

function veDto(r: HangCoDem): OtherIncomeCategoryDto {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    taxTreatmentGroup: r.taxTreatmentGroup as NhomXuLyThue,
    exemptCapAmount:
      r.exemptCapAmount === null ? null : Number(r.exemptCapAmount),
    exemptCapPeriod: r.exemptCapPeriod,
    withholdingRate:
      r.withholdingRate === null ? null : Number(r.withholdingRate),
    withholdingThreshold:
      r.withholdingThreshold === null ? null : Number(r.withholdingThreshold),
    legalBasisNote: r.legalBasisNote,
    status: r.status,
    appliesToInternalOnly: r.taxTreatmentGroup !== 'WITHHOLDING_FLAT',
    usageCount: r._count.records,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const KEM_DEM = { _count: { select: { records: true } } } as const;

/**
 * Tự sinh 12 danh mục chuẩn khi bảng còn rỗng (AC-tkt-003) — cùng khuôn self-healing BR-hrm-070
 * đã dùng cho Cấu hình mặc định. Vì vậy `GET` danh sách CÓ tác dụng phụ ghi; hợp đồng Mục 2.1 ghi
 * rõ điều này để QA không coi là lỗi.
 *
 * `createMany` + `skipDuplicates`: hai người cùng mở màn lần đầu thì người sau không vỡ vì trùng
 * mã, chỉ đơn giản là không thêm được gì thêm.
 */
async function seedLuoiNeuRong(db: Db): Promise<void> {
  const daCo = await db.otherIncomeCategory.count();
  if (daCo > 0) return;

  await db.otherIncomeCategory.createMany({
    data: DANH_MUC_THU_NHAP_SEED.map((d) => ({
      code: d.code,
      name: d.name,
      taxTreatmentGroup: d.taxTreatmentGroup,
      exemptCapAmount: d.exemptCapAmount ?? null,
      exemptCapPeriod: d.exemptCapPeriod ?? null,
      withholdingRate: d.withholdingRate ?? null,
      withholdingThreshold: d.withholdingThreshold ?? null,
    })),
    skipDuplicates: true,
  });
}

export interface ListIncomeCategoryQuery {
  taxTreatmentGroup?: NhomXuLyThue;
  status?: 'ACTIVE' | 'INACTIVE';
  q?: string;
}

export async function listIncomeCategories(
  db: Db,
  query: ListIncomeCategoryQuery,
): Promise<OtherIncomeCategoryDto[]> {
  await seedLuoiNeuRong(db);

  const rows = await db.otherIncomeCategory.findMany({
    where: {
      ...(query.taxTreatmentGroup
        ? { taxTreatmentGroup: query.taxTreatmentGroup }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { name: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: KEM_DEM,
    orderBy: { code: 'asc' },
  });

  return rows.map(veDto);
}

export async function getIncomeCategoryById(
  db: Db,
  id: string,
): Promise<OtherIncomeCategoryDto> {
  const row = await db.otherIncomeCategory.findUnique({
    where: { id },
    include: KEM_DEM,
  });
  if (!row) throw new ToKhaiThueError('E-tkt-016');
  return veDto(row);
}

/** Quét khe trống TN01..TN99, cùng thuật toán `sinhMaCa()` của Ca làm việc (ADR-001). */
async function sinhMaDanhMuc(db: Db): Promise<string> {
  const daCo = await db.otherIncomeCategory.findMany({
    select: { code: true },
  });
  const dung = new Set(daCo.map((r) => r.code.toUpperCase()));

  for (let i = 1; i <= 99; i++) {
    const thu = `TN${String(i).padStart(2, '0')}`;
    if (!dung.has(thu)) return thu;
  }

  throw new ToKhaiThueError(
    'E-tkt-003',
    'Đã dùng hết 99 mã tự sinh TN01–TN99. Hãy nhập mã thủ công.',
  );
}

function laLoiTrungKhoa(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

function duLieuGhi(
  body: CreateIncomeCategoryBody | UpdateIncomeCategoryBody,
  nhom: NhomXuLyThue,
) {
  const laKhauTru = nhom === 'WITHHOLDING_FLAT';
  return {
    taxTreatmentGroup: nhom,
    exemptCapAmount: body.exemptCapAmount ?? null,
    // Có trần mà không nói chu kỳ thì hiểu là theo tháng (hợp đồng Mục 2.3).
    exemptCapPeriod:
      body.exemptCapAmount !== undefined && body.exemptCapAmount !== null
        ? (body.exemptCapPeriod ?? 'MONTHLY')
        : null,
    // AC-tkt-002: bỏ trống thì SERVICE điền mặc định, không phải `@default` của Prisma — `@default`
    // sẽ điền cả cho 3 nhóm không dùng tới và làm mất ngữ nghĩa "NULL = không áp dụng".
    withholdingRate: laKhauTru
      ? (body.withholdingRate ?? KHAU_TRU_MAC_DINH.rate)
      : null,
    withholdingThreshold: laKhauTru
      ? (body.withholdingThreshold ?? KHAU_TRU_MAC_DINH.threshold)
      : null,
    legalBasisNote: body.legalBasisNote ?? null,
  };
}

export async function createIncomeCategory(
  db: Db,
  body: CreateIncomeCategoryBody,
): Promise<OtherIncomeCategoryDto> {
  const loi = soatThamSoTheoNhom(body);
  if (loi) throw new ToKhaiThueError('E-tkt-003', loi);

  const chung = {
    name: body.name,
    status: body.status ?? ('ACTIVE' as const),
    ...duLieuGhi(body, body.taxTreatmentGroup),
  };

  // Người dùng NHẬP mã: ghi thẳng, trùng là báo đích danh — KHÔNG thử lại, vì thử lại nghĩa là
  // tự ý đổi mã mà họ đã cố ý chọn. Bỏ trống mã: sinh rồi thử lại tối đa 5 lượt, vì hai người
  // cùng bấm Lưu mà báo "mã đã tồn tại" là câu vô nghĩa với người không hề nhập mã nào (ADR-001).
  if (body.code) {
    try {
      const row = await db.otherIncomeCategory.create({
        data: { code: body.code, ...chung },
        include: KEM_DEM,
      });
      return veDto(row);
    } catch (err) {
      if (laLoiTrungKhoa(err)) {
        throw new ToKhaiThueError(
          'E-tkt-001',
          `Mã "${body.code}" hoặc tên "${body.name}" đã tồn tại.`,
        );
      }
      throw err;
    }
  }

  for (let lan = 0; lan < SO_LAN_THU_CAP_MA; lan++) {
    const code = await sinhMaDanhMuc(db);
    try {
      const row = await db.otherIncomeCategory.create({
        data: { code, ...chung },
        include: KEM_DEM,
      });
      return veDto(row);
    } catch (err) {
      if (!laLoiTrungKhoa(err)) throw err;
      // Trùng TÊN thì thử lại bao nhiêu lượt cũng vô ích — chỉ thử lại khi mã bị chiếm.
      const daCoTen = await db.otherIncomeCategory.findFirst({
        where: { name: { equals: body.name.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (daCoTen) {
        throw new ToKhaiThueError(
          'E-tkt-001',
          `Tên "${body.name}" đã tồn tại.`,
        );
      }
    }
  }

  throw new ToKhaiThueError(
    'E-tkt-001',
    'Hệ thống cấp mã liên tục bị trùng do có người cùng thêm danh mục. Hãy thử lại.',
  );
}

export interface UpdateIncomeCategoryResult extends OtherIncomeCategoryDto {
  /** Sửa danh mục KHÔNG hồi tố số thuế đã ghi (ADR-013) — FE cảnh báo dựa vào số này. */
  affectedRecordsCount: number;
}

export async function updateIncomeCategory(
  db: Db,
  id: string,
  body: UpdateIncomeCategoryBody,
): Promise<UpdateIncomeCategoryResult> {
  const hienTai = await db.otherIncomeCategory.findUnique({
    where: { id },
    include: KEM_DEM,
  });
  if (!hienTai) throw new ToKhaiThueError('E-tkt-016');

  // Gộp giá trị cũ với giá trị gửi lên RỒI mới soát: PUT một phần vẫn phải thỏa BR-tkt-003 trên
  // trạng thái SAU khi sửa, không phải trên riêng mấy trường vừa gửi.
  const nhom =
    body.taxTreatmentGroup ?? (hienTai.taxTreatmentGroup as NhomXuLyThue);
  const doiNhom = body.taxTreatmentGroup !== undefined;
  const gop = {
    taxTreatmentGroup: nhom,
    // Đổi nhóm thì tham số của nhóm cũ KHÔNG được mang theo — nếu không sẽ có bản ghi mang trần
    // miễn thuế của nhóm đã bỏ, vừa vô nghĩa vừa dễ bị đọc nhầm về sau.
    exemptCapAmount: doiNhom
      ? body.exemptCapAmount
      : (body.exemptCapAmount ??
        (hienTai.exemptCapAmount === null
          ? undefined
          : Number(hienTai.exemptCapAmount))),
    exemptCapPeriod: doiNhom
      ? body.exemptCapPeriod
      : (body.exemptCapPeriod ?? hienTai.exemptCapPeriod ?? undefined),
    withholdingRate: doiNhom
      ? body.withholdingRate
      : (body.withholdingRate ??
        (hienTai.withholdingRate === null
          ? undefined
          : Number(hienTai.withholdingRate))),
    withholdingThreshold: doiNhom
      ? body.withholdingThreshold
      : (body.withholdingThreshold ??
        (hienTai.withholdingThreshold === null
          ? undefined
          : Number(hienTai.withholdingThreshold))),
  };

  const loi = soatThamSoTheoNhom(gop);
  if (loi) throw new ToKhaiThueError('E-tkt-003', loi);

  try {
    const row = await db.otherIncomeCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...duLieuGhi(gop, nhom),
      },
      include: KEM_DEM,
    });
    return { ...veDto(row), affectedRecordsCount: row._count.records };
  } catch (err) {
    if (laLoiTrungKhoa(err)) {
      throw new ToKhaiThueError('E-tkt-001', `Tên "${body.name}" đã tồn tại.`);
    }
    throw err;
  }
}

export async function deleteIncomeCategory(db: Db, id: string): Promise<void> {
  const row = await db.otherIncomeCategory.findUnique({
    where: { id },
    include: KEM_DEM,
  });
  if (!row) throw new ToKhaiThueError('E-tkt-016');

  // Kiểm trước để trả thông điệp nghiệp vụ (BR-tkt-004). Khóa ngoại `onDelete: Restrict` vẫn là
  // hàng rào cuối cho trường hợp có người vừa thêm bản ghi xen vào giữa hai lệnh.
  if (row._count.records > 0) {
    throw new ToKhaiThueError(
      'E-tkt-002',
      `Loại thu nhập "${row.name}" đang được ${row._count.records} khoản chi trả sử dụng nên không xóa được. Hãy chuyển sang trạng thái Ngừng dùng.`,
    );
  }

  try {
    await db.otherIncomeCategory.delete({ where: { id } });
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: unknown }).code === 'P2003'
    ) {
      throw new ToKhaiThueError('E-tkt-002');
    }
    throw err;
  }
}
