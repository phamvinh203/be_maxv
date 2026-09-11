import { Prisma, type PrismaClient } from '../../../../generated/tenant';
import { BadRequestError } from '../../../../helpers/errors';
import { MESSAGES } from '../../../../constants/messages';
import type {
  CALCULATION_METHODS,
  SaveSalaryStructureInput,
  TAX_TREATMENTS,
} from '../../../../validators/hrm/cai_dat_luong/salaryStructures.validator';
import { formatSalaryItem } from './salaryItems.service';

export function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatSalaryStructure(structure: any) {
  if (!structure) return null;

  const items = (structure.items ?? []).map((item: any) => {
    const taxTreatment = item.taxTreatment;
    const calculationMethod = item.calculationMethod;
    const defaultAmount = item.defaultAmount != null ? Number(item.defaultAmount) : 0;

    return {
      id: item.id,
      salaryStructureId: item.salaryStructureId,
      salaryItemId: item.salaryItemId,
      taxTreatment,
      isOvertimeBase: Boolean(item.isOvertimeBase),
      calculationMethod,
      defaultAmount,
      // FE mock compatible fields
      ma_khoan: item.salaryItem?.code ?? item.salaryItemId,
      phan_loai: taxTreatment === 'TAXABLE' ? 'tncn' : 'mien_thue',
      tang_ca: Boolean(item.isOvertimeBase),
      tieu_thuc: calculationMethod ? String(calculationMethod).toLowerCase() : 'co_dinh_thang',
      so_tien: defaultAmount,
      salaryItem: item.salaryItem ? formatSalaryItem(item.salaryItem) : undefined,
    };
  });

  const effectiveFromStr = toIsoDate(structure.effectiveFrom) ?? '';
  const effectiveToStr = toIsoDate(structure.effectiveTo);

  return {
    id: structure.id,
    effectiveFrom: effectiveFromStr,
    effectiveTo: effectiveToStr,
    note: structure.note,
    isActive: structure.isActive,
    items,
    // FE mock compatible root fields
    tu_ngay: effectiveFromStr,
    den_ngay: effectiveToStr ?? '',
    ghi_chu: structure.note ?? '',
    dong: items,
  };
}

export async function getCurrentSalaryStructure(db: PrismaClient) {
  const structure = await db.salaryStructure.findFirst({
    where: { isActive: true },
    include: {
      items: {
        include: { salaryItem: true },
        orderBy: { salaryItem: { code: 'asc' } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return formatSalaryStructure(structure);
}

export async function saveSalaryStructure(
  db: PrismaClient,
  input: SaveSalaryStructureInput,
) {
  if (!input.effectiveFrom) {
    throw new BadRequestError('Chưa chọn ngày bắt đầu hiệu lực.');
  }

  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    throw new BadRequestError(MESSAGES.HRM.SALARY_STRUCTURE_DATES_INVALID);
  }

  if (!input.items || input.items.length === 0) {
    throw new BadRequestError(MESSAGES.HRM.SALARY_STRUCTURE_EMPTY);
  }

  // Resolve salaryItemId: support either UUID id or ma_khoan (code)
  const allSalaryItems = await db.salaryItem.findMany();
  const idMap = new Map<string, string>(); // input -> resolved UUID

  for (const si of allSalaryItems) {
    idMap.set(si.id, si.id);
    idMap.set(si.code, si.id);
    idMap.set(si.code.toLowerCase(), si.id);
  }

  const resolvedItems: {
    salaryItemId: string;
    taxTreatment: (typeof TAX_TREATMENTS)[number];
    isOvertimeBase: boolean;
    calculationMethod: (typeof CALCULATION_METHODS)[number];
    defaultAmount: number;
  }[] = [];

  for (const it of input.items) {
    const resolvedId = idMap.get(it.salaryItemId);
    if (!resolvedId) {
      throw new BadRequestError(
        'Cấu trúc có khoản không còn trong danh mục, hãy bỏ khoản đó ra.',
      );
    }
    resolvedItems.push({
      salaryItemId: resolvedId,
      taxTreatment: it.taxTreatment,
      isOvertimeBase: it.isOvertimeBase,
      calculationMethod: it.calculationMethod,
      defaultAmount: it.defaultAmount,
    });
  }

  const effectiveFrom = new Date(`${input.effectiveFrom}T00:00:00.000Z`);
  const effectiveTo = input.effectiveTo
    ? new Date(`${input.effectiveTo}T00:00:00.000Z`)
    : null;

  return await db.$transaction(async (tx) => {
    // Mọi lượt lưu cơ cấu chạy LẦN LƯỢT (vbsec 2026-09-10): tìm-bản-đang-áp-dụng rồi sửa/tạo là
    // kiểm-rồi-ghi — hai lượt cùng lúc khi chưa có bản nào cùng tạo -> 2 cơ cấu `isActive`; cùng sửa
    // một bản thì `deleteMany` + `createMany` đan nhau -> dòng khoản lương nhân đôi.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('salary_structure:luu'))`;

    // Tìm cấu trúc hiện hành
    let current = await tx.salaryStructure.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!current) {
      current = await tx.salaryStructure.create({
        data: {
          effectiveFrom,
          effectiveTo,
          note: input.note,
          isActive: true,
        },
      });
    } else {
      // Cập nhật cấu trúc hiện hành
      current = await tx.salaryStructure.update({
        where: { id: current.id },
        data: {
          effectiveFrom,
          effectiveTo,
          note: input.note,
        },
      });

      // Xoá các dòng cũ để ghi đè dòng mới
      await tx.salaryStructureItem.deleteMany({
        where: { salaryStructureId: current.id },
      });
    }

    // Tạo các dòng mới trong một lượt thay vì lặp từng dòng
    await tx.salaryStructureItem.createMany({
      data: resolvedItems.map((it) => ({
        salaryStructureId: current.id,
        salaryItemId: it.salaryItemId,
        taxTreatment: it.taxTreatment,
        isOvertimeBase: it.isOvertimeBase,
        calculationMethod: it.calculationMethod,
        defaultAmount: new Prisma.Decimal(it.defaultAmount),
      })),
    });

    const result = await tx.salaryStructure.findUnique({
      where: { id: current.id },
      include: {
        items: {
          include: { salaryItem: true },
          orderBy: { salaryItem: { code: 'asc' } },
        },
      },
    });

    return formatSalaryStructure(result);
  });
}
