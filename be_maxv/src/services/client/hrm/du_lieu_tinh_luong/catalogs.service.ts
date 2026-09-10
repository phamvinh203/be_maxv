import type { PrismaClient, CatalogStatus } from '../../../../generated/tenant';
import { ConflictError, NotFoundError, BadRequestError } from '../../../../helpers/errors';
import type {
  CatalogQuery,
  CreateAdjustmentItemInput,
  CreateDiligenceTypeInput,
  CreateKpiItemInput,
  CreateProductInput,
  UpdateAdjustmentItemInput,
  UpdateDiligenceTypeInput,
  UpdateKpiItemInput,
  UpdateProductInput,
} from '../../../../validators/hrm/du_lieu_tinh_luong/catalogs.validator';

/**
 * Sinh mã danh mục kế tiếp dạng `{prefix}01`..`{prefix}99` (dò khoảng trống đầu tiên) — dùng
 * chung cho cả 4 danh mục chuyên biệt (KPI/Sản phẩm khoán/Lỗi chuyên cần/Khoản bù trừ), trước
 * đây mỗi danh mục tự viết lại đúng thuật toán này chỉ khác prefix + model.
 */
async function generateNextCatalogCode(
  model: { findMany: (args: { select: { code: true } }) => Promise<{ code: string }[]> },
  prefix: string,
): Promise<string> {
  const items = await model.findMany({ select: { code: true } });
  const pattern = new RegExp(`^${prefix}(\\d{2,})$`, 'i');
  const used = new Set(
    items
      .map((i) => {
        const m = i.code.match(pattern);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n): n is number => n !== null),
  );
  for (let i = 1; i <= 99; i++) {
    if (!used.has(i)) return `${prefix}${String(i).padStart(2, '0')}`;
  }
  return `${prefix}${Date.now().toString().slice(-4)}`;
}

// ==========================================
// 1. KPI ITEMS (KPI01..KPI99)
// ==========================================

export async function listKpiItems(db: PrismaClient, query: CatalogQuery) {
  const where: any = {};
  if (query.status !== 'ALL') {
    where.status = query.status as CatalogStatus;
  }
  if (query.q) {
    where.OR = [
      { code: { contains: query.q, mode: 'insensitive' } },
      { name: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return db.kpiItem.findMany({ where, orderBy: { code: 'asc' } });
}

export async function createKpiItem(db: PrismaClient, input: CreateKpiItemInput) {
  const code = input.code ? input.code.trim().toUpperCase() : await generateNextCatalogCode(db.kpiItem, 'KPI');
  const existing = await db.kpiItem.findUnique({ where: { code } });
  if (existing) throw new ConflictError(`Mã chỉ tiêu KPI "${code}" đã tồn tại.`);

  return db.kpiItem.create({
    data: {
      code,
      name: input.name,
      unit: input.unit,
      defaultWeight: input.defaultWeight,
      status: input.status as CatalogStatus,
    },
  });
}

export async function updateKpiItem(db: PrismaClient, id: string, input: UpdateKpiItemInput) {
  const item = await db.kpiItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Không tìm thấy chỉ tiêu KPI.');

  if (input.code && input.code !== item.code) {
    const existing = await db.kpiItem.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictError(`Mã chỉ tiêu KPI "${input.code}" đã tồn tại.`);
  }

  return db.kpiItem.update({
    where: { id },
    data: {
      ...input,
      status: input.status ? (input.status as CatalogStatus) : undefined,
    },
  });
}

export async function deleteKpiItem(db: PrismaClient, id: string) {
  const usedCount = await db.kpiRecord.count({ where: { kpiItemId: id } });
  if (usedCount > 0) {
    throw new BadRequestError('Không thể xóa chỉ tiêu KPI đã phát sinh dữ liệu đánh giá trong kỳ.');
  }
  return db.kpiItem.delete({ where: { id } });
}

// ==========================================
// 2. PIECEWORK PRODUCTS (SP01..SP99)
// ==========================================
export async function listProducts(db: PrismaClient, query: CatalogQuery) {
  const where: any = {};
  if (query.status !== 'ALL') where.status = query.status as CatalogStatus;
  if (query.q) {
    where.OR = [
      { code: { contains: query.q, mode: 'insensitive' } },
      { name: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return db.pieceworkProduct.findMany({ where, orderBy: { code: 'asc' } });
}

export async function createProduct(db: PrismaClient, input: CreateProductInput) {
  const code = input.code ? input.code.trim().toUpperCase() : await generateNextCatalogCode(db.pieceworkProduct, 'SP');
  const existing = await db.pieceworkProduct.findUnique({ where: { code } });
  if (existing) throw new ConflictError(`Mã sản phẩm "${code}" đã tồn tại.`);

  return db.pieceworkProduct.create({
    data: {
      code,
      name: input.name,
      unit: input.unit,
      unitPrice: input.unitPrice,
      status: input.status as CatalogStatus,
    },
  });
}

export async function updateProduct(db: PrismaClient, id: string, input: UpdateProductInput) {
  const item = await db.pieceworkProduct.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Không tìm thấy sản phẩm.');

  if (input.code && input.code !== item.code) {
    const existing = await db.pieceworkProduct.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictError(`Mã sản phẩm "${input.code}" đã tồn tại.`);
  }

  return db.pieceworkProduct.update({
    where: { id },
    data: {
      ...input,
      status: input.status ? (input.status as CatalogStatus) : undefined,
    },
  });
}

export async function deleteProduct(db: PrismaClient, id: string) {
  const usedCount = await db.pieceworkRecord.count({ where: { productId: id } });
  if (usedCount > 0) {
    throw new BadRequestError('Không thể xóa sản phẩm đã có dữ liệu nghiệm thu trong kỳ tính lương.');
  }
  return db.pieceworkProduct.delete({ where: { id } });
}

// ==========================================
// 3. DILIGENCE VIOLATION TYPES (CC01..CC99)
// ==========================================
export async function listDiligenceTypes(db: PrismaClient, query: CatalogQuery) {
  const where: any = {};
  if (query.status !== 'ALL') where.status = query.status as CatalogStatus;
  if (query.q) {
    where.OR = [
      { code: { contains: query.q, mode: 'insensitive' } },
      { name: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return db.diligenceViolationType.findMany({ where, orderBy: { code: 'asc' } });
}

export async function createDiligenceType(db: PrismaClient, input: CreateDiligenceTypeInput) {
  const code = input.code ? input.code.trim().toUpperCase() : await generateNextCatalogCode(db.diligenceViolationType, 'CC');
  const existing = await db.diligenceViolationType.findUnique({ where: { code } });
  if (existing) throw new ConflictError(`Mã lỗi chuyên cần "${code}" đã tồn tại.`);

  return db.diligenceViolationType.create({
    data: {
      code,
      name: input.name,
      deductionMethod: input.deductionMethod,
      penaltyRate: input.penaltyRate,
      status: input.status as CatalogStatus,
    },
  });
}

export async function updateDiligenceType(db: PrismaClient, id: string, input: UpdateDiligenceTypeInput) {
  const item = await db.diligenceViolationType.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Không tìm thấy loại lỗi chuyên cần.');

  if (input.code && input.code !== item.code) {
    const existing = await db.diligenceViolationType.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictError(`Mã lỗi chuyên cần "${input.code}" đã tồn tại.`);
  }

  return db.diligenceViolationType.update({
    where: { id },
    data: {
      ...input,
      status: input.status ? (input.status as CatalogStatus) : undefined,
    },
  });
}

export async function deleteDiligenceType(db: PrismaClient, id: string) {
  const usedCount = await db.diligenceRecord.count({ where: { violationTypeId: id } });
  if (usedCount > 0) {
    throw new BadRequestError('Không thể xóa loại lỗi chuyên cần đã phát sinh ghi nhận vi phạm trong kỳ.');
  }
  return db.diligenceViolationType.delete({ where: { id } });
}

// ==========================================
// 4. SALARY ADJUSTMENT ITEMS (BT01..BT99)
// ==========================================
export async function listAdjustmentItems(db: PrismaClient, query: CatalogQuery) {
  const where: any = {};
  if (query.status !== 'ALL') where.status = query.status as CatalogStatus;
  if (query.q) {
    where.OR = [
      { code: { contains: query.q, mode: 'insensitive' } },
      { name: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return db.salaryAdjustmentItem.findMany({ where, orderBy: { code: 'asc' } });
}

export async function createAdjustmentItem(db: PrismaClient, input: CreateAdjustmentItemInput) {
  const code = input.code ? input.code.trim().toUpperCase() : await generateNextCatalogCode(db.salaryAdjustmentItem, 'BT');
  const existing = await db.salaryAdjustmentItem.findUnique({ where: { code } });
  if (existing) throw new ConflictError(`Mã khoản bù trừ "${code}" đã tồn tại.`);

  return db.salaryAdjustmentItem.create({
    data: {
      code,
      name: input.name,
      direction: input.direction,
      status: input.status as CatalogStatus,
    },
  });
}

export async function updateAdjustmentItem(db: PrismaClient, id: string, input: UpdateAdjustmentItemInput) {
  const item = await db.salaryAdjustmentItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Không tìm thấy khoản bù trừ.');

  if (input.code && input.code !== item.code) {
    const existing = await db.salaryAdjustmentItem.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictError(`Mã khoản bù trừ "${input.code}" đã tồn tại.`);
  }

  return db.salaryAdjustmentItem.update({
    where: { id },
    data: {
      ...input,
      status: input.status ? (input.status as CatalogStatus) : undefined,
    },
  });
}

export async function deleteAdjustmentItem(db: PrismaClient, id: string) {
  const usedCount = await db.salaryAdjustmentRecord.count({ where: { adjustmentItemId: id } });
  if (usedCount > 0) {
    throw new BadRequestError('Không thể xóa khoản bù trừ đã phát sinh bản ghi trong kỳ tính lương.');
  }
  return db.salaryAdjustmentItem.delete({ where: { id } });
}
