import { Prisma, type PrismaClient, type SalaryItemCategory } from '../../../../generated/tenant';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../helpers/errors';
import { MESSAGES } from '../../../../constants/messages';
import type {
  CreateSalaryItemInput,
  SalaryItemListQuery,
  UpdateSalaryItemInput,
} from '../../../../validators/hrm/cai_dat_luong/salaryItems.validator';

export function formatSalaryItem<
  T extends {
    id?: string;
    code?: string;
    name?: string;
    category?: string;
    description?: string | null;
    isSocialInsurance?: boolean;
    isTaxable?: boolean;
    isMealAllowance?: boolean;
    defaultRate?: Prisma.Decimal | number | null;
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
  },
>(item: T) {
  return {
    ...item,
    ma_khoan: item.code ?? '',
    ten_khoan: item.name ?? '',
    loai: item.category ? item.category.toLowerCase() : '',
    ghi_chu: item.description ?? null,
    tinh_bhxh: Boolean(item.isSocialInsurance),
    chiu_thue_tncn: Boolean(item.isTaxable),
    // ADR-010 QĐ-4 — khoản ăn ca/ăn trưa (miễn thuế tới trần 730k, `payrollCalculation.service.ts`).
    isMealAllowance: Boolean(item.isMealAllowance),
    ty_le: item.defaultRate != null ? Number(item.defaultRate) : null,
    defaultRate: item.defaultRate != null ? Number(item.defaultRate) : null,
  };
}

/** Tự sinh mã KL01..KL99 quét khoảng trống nhỏ nhất chưa dùng (BR-sal-001) */
export async function generateNextSalaryItemCode(db: PrismaClient): Promise<string> {
  const items = await db.salaryItem.findMany({
    select: { code: true },
  });

  const usedNumbers = new Set<number>();
  for (const item of items) {
    const match = item.code.match(/^KL(\d{2,})$/i);
    if (match) {
      usedNumbers.add(parseInt(match[1], 10));
    }
  }

  for (let i = 1; i <= 99; i++) {
    if (!usedNumbers.has(i)) {
      return `KL${String(i).padStart(2, '0')}`;
    }
  }

  throw new BadRequestError(MESSAGES.HRM.GIOI_HAN_99_KHOAN_LUONG);
}

export async function listSalaryItems(db: PrismaClient, query: SalaryItemListQuery) {
  const andConditions: Prisma.SalaryItemWhereInput[] = [];

  if (query.category) {
    andConditions.push({ category: query.category });
  }

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  if (query.q) {
    const q = query.q.trim();
    andConditions.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.SalaryItemWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const rows = await db.salaryItem.findMany({
    where,
    orderBy: { code: 'asc' },
  });

  return rows.map(formatSalaryItem);
}

export async function countSalaryItemsByCategory(db: PrismaClient) {
  const grouped = await db.salaryItem.groupBy({
    by: ['category'],
    _count: { id: true },
  });

  const counts: Record<string, number> = {
    FIXED_ALLOWANCE: 0,
    BENEFIT_ALLOWANCE: 0,
    DELIVERY_PIECEWORK: 0,
    COMMISSION_PERCENTAGE: 0,
    KPI_PERFORMANCE: 0,
    PERIODIC_BONUS: 0,
    ATTENDANCE_ALLOWANCE: 0,
    TOTAL: 0,
  };

  let total = 0;
  for (const g of grouped) {
    counts[g.category] = g._count.id;
    total += g._count.id;
  }
  counts.TOTAL = total;

  return counts;
}

export async function getSalaryItemById(db: PrismaClient, idOrCode: string) {
  const item = await db.salaryItem.findFirst({
    where: {
      OR: [{ id: idOrCode }, { code: idOrCode }],
    },
  });

  if (!item) {
    throw new NotFoundError(MESSAGES.HRM.SALARY_ITEM_NOT_FOUND);
  }

  return formatSalaryItem(item);
}

/** Chống trùng tên trong cùng loại (BR-sal-002, E-sal-002) — dùng chung cho tạo mới và sửa. */
async function assertSalaryItemNameAvailable(
  db: PrismaClient,
  category: SalaryItemCategory,
  name: string,
  excludeId?: string,
): Promise<void> {
  const duplicate = await db.salaryItem.findFirst({
    where: {
      ...(excludeId && { id: { not: excludeId } }),
      category,
      name: { equals: name, mode: 'insensitive' },
    },
  });

  if (duplicate) {
    throw new ConflictError(MESSAGES.HRM.SALARY_ITEM_NAME_EXISTED(name));
  }
}

export async function createSalaryItem(db: PrismaClient, input: CreateSalaryItemInput) {
  const name = input.name.trim();

  await assertSalaryItemNameAvailable(db, input.category, name);

  let code = input.code;
  if (!code) {
    code = await generateNextSalaryItemCode(db);
  } else {
    const existingCode = await db.salaryItem.findUnique({
      where: { code },
    });
    if (existingCode) {
      throw new ConflictError(`Mã khoản lương ${code} đã tồn tại trong hệ thống.`);
    }
  }

  const created = await db.salaryItem.create({
    data: {
      code,
      name,
      category: input.category,
      description: input.description,
      isSocialInsurance: input.isSocialInsurance,
      isTaxable: input.isTaxable,
      isMealAllowance: input.isMealAllowance,
      defaultRate: input.defaultRate != null ? new Prisma.Decimal(input.defaultRate) : null,
      status: 'ACTIVE',
    },
  });

  return formatSalaryItem(created);
}

export async function updateSalaryItem(
  db: PrismaClient,
  id: string,
  input: UpdateSalaryItemInput,
) {
  const current = await db.salaryItem.findUnique({
    where: { id },
  });

  if (!current) {
    throw new NotFoundError(MESSAGES.HRM.SALARY_ITEM_NOT_FOUND);
  }

  const targetCategory = input.category ?? current.category;
  const targetName = input.name !== undefined ? input.name.trim() : current.name;

  if (input.name !== undefined || input.category !== undefined) {
    await assertSalaryItemNameAvailable(db, targetCategory, targetName, id);
  }

  const updated = await db.salaryItem.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: targetName }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isSocialInsurance !== undefined && { isSocialInsurance: input.isSocialInsurance }),
      ...(input.isTaxable !== undefined && { isTaxable: input.isTaxable }),
      ...(input.isMealAllowance !== undefined && { isMealAllowance: input.isMealAllowance }),
      ...(input.defaultRate !== undefined && {
        defaultRate: input.defaultRate != null ? new Prisma.Decimal(input.defaultRate) : null,
      }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });

  return formatSalaryItem(updated);
}

export async function deleteSalaryItem(db: PrismaClient, id: string) {
  const item = await db.salaryItem.findUnique({
    where: { id },
  });

  if (!item) {
    throw new NotFoundError(MESSAGES.HRM.SALARY_ITEM_NOT_FOUND);
  }

  // Chặn xoá khoản lương đang nằm trong cấu trúc khung hoặc thiết lập lương nhân viên (BR-sal-004, E-sal-003)
  const [inStructure, inEmployeeSalary] = await Promise.all([
    db.salaryStructureItem.count({ where: { salaryItemId: id } }),
    db.employeeSalaryItem.count({ where: { salaryItemId: id } }),
  ]);

  if (inStructure > 0 || inEmployeeSalary > 0) {
    throw new BadRequestError(MESSAGES.HRM.SALARY_ITEM_IN_USE);
  }

  await db.salaryItem.delete({
    where: { id },
  });

  // RVW-018 (review-findings.md 2026-09-10) — trả lại `code` để controller ghi nhật ký kiểm toán
  // đúng khóa nghiệp vụ (bản ghi đã xóa, không truy vấn lại được nữa sau lệnh delete).
  return { code: item.code };
}
