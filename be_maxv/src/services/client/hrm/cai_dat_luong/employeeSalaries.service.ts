import type { PrismaClient } from '../../../../generated/tenant';
import { Prisma } from '../../../../generated/tenant';
import { BadRequestError, NotFoundError } from '../../../../helpers/errors';
import { MESSAGES } from '../../../../constants/messages';
import type {
  ApproveSalariesInput,
  EmployeeSalaryListQuery,
  SetEmployeeSalaryInput,
} from '../../../../validators/hrm/cai_dat_luong/employeeSalaries.validator';
import { formatSalaryStructure, toIsoDate } from './salaryStructures.service';
import { formatSalaryItem } from './salaryItems.service';

export function formatEmployeeSalary(salary: any, employee: any, currentStructure?: any) {
  const items = (salary?.items ?? []).map((it: any) => ({
    id: it.id,
    salaryItemId: it.salaryItemId,
    amount: Number(it.amount),
    salaryItem: it.salaryItem ? formatSalaryItem(it.salaryItem) : undefined,
    ma_khoan: it.salaryItem?.code ?? it.salaryItemId,
    ten_khoan: it.salaryItem?.name ?? '',
  }));

  const khoan: Record<string, number> = {};
  for (const it of items) {
    khoan[it.salaryItemId] = it.amount;
    if (it.ma_khoan) {
      khoan[it.ma_khoan] = it.amount;
    }
  }

  const effectiveFrom = salary?.effectiveFrom ?? currentStructure?.effectiveFrom ?? null;
  const effectiveTo = salary?.effectiveTo ?? currentStructure?.effectiveTo ?? null;
  const totalAmount = salary ? Number(salary.totalAmount) : 0;
  const setupVersion = salary?.setupVersion ?? 0;
  const status = salary?.status ?? 'DRAFT';

  return {
    id: salary?.id,
    employeeId: employee.ma_nv,
    employeeCode: employee.ma_nv,
    ma_nv: employee.ma_nv,
    fullName: employee.ho_ten,
    ho_ten: employee.ho_ten,
    setupVersion,
    lan_thiet_lap: setupVersion,
    effectiveFrom: toIsoDate(effectiveFrom) ?? '',
    hieu_luc_tu: toIsoDate(effectiveFrom) ?? '',
    effectiveTo: toIsoDate(effectiveTo) ?? '',
    hieu_luc_den: toIsoDate(effectiveTo) ?? '',
    totalAmount,
    tong_luong: totalAmount,
    status,
    trang_thai: status.toLowerCase(),
    approvedByUserId: salary?.approvedByUserId ?? null,
    approvedAt: salary?.approvedAt ?? null,
    items,
    khoan,
    structure: currentStructure ? formatSalaryStructure(currentStructure) : null,
  };
}

export async function listEmployeeSalaries(
  db: PrismaClient,
  query: EmployeeSalaryListQuery,
) {
  const now = new Date();

  // Nhân viên và phòng ban độc lập nhau — tải song song thay vì nối tiếp.
  const [employees, phongBans] = await Promise.all([
    // Chỉ lấy nhân viên ĐANG LÀM và CHƯA BỊ XOÁ
    db.hrm_nhan_vien.findMany({
      where: {
        status: '1',
        da_xoa: false,
      },
      include: {
        hop_dong: {
          orderBy: { ngay_bat_dau: 'desc' },
        },
        luong_thiet_lap: {
          include: {
            items: {
              include: { salaryItem: true },
            },
          },
        },
      },
      orderBy: { ma_nv: 'asc' },
    }),
    db.hrm_phong_ban.findMany({
      select: { ma_pb: true, ten_pb: true },
    }),
  ]);

  const pbMap = new Map(phongBans.map((pb) => [pb.ma_pb, pb.ten_pb]));

  const tuKhoa = query.q?.trim().toLowerCase();

  const rows = employees
    .map((nv) => {
      // Tìm hợp đồng hiệu lực tại thời điểm hiện tại
      const hdHienHanh = nv.hop_dong.find((hd) => {
        const batDau = new Date(hd.ngay_bat_dau);
        const ketThuc = hd.ngay_ket_thuc ? new Date(hd.ngay_ket_thuc) : null;
        return batDau <= now && (ketThuc === null || ketThuc >= now);
      }) ?? nv.hop_dong[0]; // fallback hợp đồng mới nhất

      const salary = nv.luong_thiet_lap;
      const daSet = Boolean(salary);
      const totalAmount = salary ? Number(salary.totalAmount) : 0;
      const setupVersion = salary?.setupVersion ?? 0;
      const status = salary?.status ?? null;

      return {
        employeeId: nv.ma_nv,
        employeeCode: nv.ma_nv,
        ma_nv: nv.ma_nv,
        fullName: nv.ho_ten,
        ho_ten: nv.ho_ten,
        position: nv.chuc_vu ?? '',
        ten_cv: nv.chuc_vu ?? '',
        departmentId: nv.ma_pb,
        ma_pb: nv.ma_pb,
        departmentName: pbMap.get(nv.ma_pb ?? '') ?? '',
        ten_pb: pbMap.get(nv.ma_pb ?? '') ?? '',
        contractType: hdHienHanh?.loai_hd ?? null,
        loai_hd: hdHienHanh?.loai_hd ?? null,
        bankAccountNumber: nv.so_tai_khoan ?? '',
        so_tk: nv.so_tai_khoan ?? '',
        hasSalary: daSet,
        daSet,
        setupVersion,
        lan_thiet_lap: setupVersion,
        effectiveFrom: salary ? toIsoDate(salary.effectiveFrom) : '',
        hieu_luc_tu: salary ? toIsoDate(salary.effectiveFrom) : '',
        effectiveTo: salary ? toIsoDate(salary.effectiveTo) : '',
        hieu_luc_den: salary ? toIsoDate(salary.effectiveTo) : '',
        totalAmount,
        tong_luong: totalAmount,
        status,
        trang_thai: status ? status.toLowerCase() : null,
      };
    })
    .filter((row) => {
      if (query.hasSalary !== undefined && row.hasSalary !== query.hasSalary) {
        return false;
      }
      if (query.ma_pb && row.ma_pb !== query.ma_pb) {
        return false;
      }
      if (query.loai_hd && row.loai_hd !== query.loai_hd) {
        return false;
      }
      if (tuKhoa) {
        return [row.ma_nv, row.ho_ten, row.so_tk].some((field) =>
          field.toLowerCase().includes(tuKhoa),
        );
      }
      return true;
    });

  return rows;
}

export async function countEmployeeSalaries(db: PrismaClient) {
  const activeEmployees = await db.hrm_nhan_vien.findMany({
    where: {
      status: '1',
      da_xoa: false,
    },
    select: { ma_nv: true },
  });

  // `ma_nv` là khóa duy nhất của nhân viên nên danh sách đã không trùng, khỏi cần qua Set.
  const activeIds = activeEmployees.map((nv) => nv.ma_nv);

  const setSalaries = await db.employeeSalary.findMany({
    where: {
      ma_nv: { in: activeIds },
    },
    select: { ma_nv: true },
  });

  const daSet = setSalaries.length;
  const totalActiveEmployees = activeEmployees.length;
  const missingSalary = totalActiveEmployees - daSet;

  return {
    hasSalary: daSet,
    missingSalary,
    totalActiveEmployees,
    daSet,
    chuaSet: missingSalary,
  };
}

export async function getEmployeeSalary(
  db: PrismaClient,
  maNvOrEmployeeId: string,
) {
  const employee = await db.hrm_nhan_vien.findFirst({
    where: {
      ma_nv: maNvOrEmployeeId,
      da_xoa: false,
    },
  });

  if (!employee) {
    throw new NotFoundError(MESSAGES.HRM.SALARY_EMPLOYEE_NOT_FOUND);
  }

  // Bản set lương của nhân viên và cấu trúc khung hiện hành độc lập nhau — tải song song.
  const [salary, currentStructure] = await Promise.all([
    db.employeeSalary.findUnique({
      where: { ma_nv: employee.ma_nv },
      include: {
        items: {
          include: { salaryItem: true },
        },
      },
    }),
    db.salaryStructure.findFirst({
      where: { isActive: true },
      include: {
        items: {
          include: { salaryItem: true },
          orderBy: { salaryItem: { code: 'asc' } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return formatEmployeeSalary(salary, employee, currentStructure);
}

export async function setEmployeeSalary(
  db: PrismaClient,
  maNvOrEmployeeId: string,
  input: SetEmployeeSalaryInput,
  userId?: string,
) {
  const now = new Date();

  // 1. Nhân viên tồn tại + 3. cấu trúc khung hiện hành — độc lập nhau, tải song song.
  const [employee, currentStructure] = await Promise.all([
    db.hrm_nhan_vien.findFirst({
      where: {
        ma_nv: maNvOrEmployeeId,
        da_xoa: false,
      },
    }),
    db.salaryStructure.findFirst({
      where: { isActive: true },
      include: {
        items: {
          include: { salaryItem: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!employee) {
    throw new NotFoundError(MESSAGES.HRM.SALARY_EMPLOYEE_NOT_FOUND);
  }

  // 2. Kiểm tra nhân viên đang có Hợp đồng hiệu lực (BR-sal-008, E-sal-009)
  const activeContract = await db.hrm_hop_dong.findFirst({
    where: {
      ma_nv: employee.ma_nv,
      ngay_bat_dau: { lte: now },
      OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: now } }],
    },
  });

  if (!activeContract) {
    throw new BadRequestError(MESSAGES.HRM.SALARY_EMPLOYEE_NO_ACTIVE_CONTRACT);
  }

  if (!currentStructure || currentStructure.items.length === 0) {
    throw new BadRequestError('Chưa có cấu trúc lương khung hiện hành nào được thiết lập.');
  }

  // Lập bản đồ tra cứu khoản lương từ cấu trúc khung (hỗ trợ cả UUID lẫn code KLxx)
  const structureItemMap = new Map<string, { id: string; code: string; name: string }>();
  for (const sItem of currentStructure.items) {
    const info = {
      id: sItem.salaryItemId,
      code: sItem.salaryItem.code,
      name: sItem.salaryItem.name,
    };
    structureItemMap.set(sItem.salaryItemId, info);
    structureItemMap.set(sItem.salaryItem.code, info);
    structureItemMap.set(sItem.salaryItem.code.toLowerCase(), info);
  }

  // 4. Kiểm tra mọi khoản gửi lên phải thuộc cấu trúc khung (BR-sal-005, E-sal-010)
  // Validator đã gộp cả hai định dạng items[]/khoan{} về input.items (xem setEmployeeSalarySchema).
  const rawItems = input.items;

  if (rawItems.length === 0) {
    throw new BadRequestError(MESSAGES.HRM.SALARY_STRUCTURE_EMPTY);
  }

  const resolvedItems: { salaryItemId: string; amount: number }[] = [];
  for (const it of rawItems) {
    const matched = structureItemMap.get(it.salaryItemId);
    if (!matched) {
      // Tìm tên khoản nếu có trong danh mục để thông báo rõ ràng
      const generalItem = await db.salaryItem.findFirst({
        where: {
          OR: [{ id: it.salaryItemId }, { code: it.salaryItemId }],
        },
      });
      const name = generalItem?.name ?? it.salaryItemId;
      const code = generalItem?.code ?? it.salaryItemId;
      throw new BadRequestError(MESSAGES.HRM.SALARY_ITEM_NOT_IN_STRUCTURE(name, code));
    }
    resolvedItems.push({
      salaryItemId: matched.id,
      amount: it.amount,
    });
  }

  // 5. Kiểm tra tổng lương > 0 (BR-sal-006, E-sal-008)
  const totalAmount = resolvedItems.reduce((sum, it) => sum + it.amount, 0);
  if (totalAmount <= 0) {
    throw new BadRequestError(MESSAGES.HRM.SALARY_TOTAL_AMOUNT_INVALID);
  }

  // 6. Ghi trong transaction
  return await db.$transaction(async (tx) => {
    const existingSalary = await tx.employeeSalary.findUnique({
      where: { ma_nv: employee.ma_nv },
    });

    const setupVersion = (existingSalary?.setupVersion ?? 0) + 1;

    let salaryRecord;
    if (!existingSalary) {
      salaryRecord = await tx.employeeSalary.create({
        data: {
          ma_nv: employee.ma_nv,
          setupVersion,
          effectiveFrom: currentStructure.effectiveFrom,
          effectiveTo: currentStructure.effectiveTo,
          totalAmount: new Prisma.Decimal(totalAmount),
          status: 'PENDING_APPROVAL',
          approvedByUserId: null,
          approvedAt: null,
        },
      });
    } else {
      salaryRecord = await tx.employeeSalary.update({
        where: { ma_nv: employee.ma_nv },
        data: {
          // Tăng NGUYÊN TỬ trong DB, không ghi số đã tính từ lượt đọc: hai người sửa cùng lúc đều đọc thấy
          // bản N và cùng ghi N+1 -> hai nội dung khác nhau mang cùng một phiên bản, duyệt theo phiên bản
          // (`approveEmployeeSalaries`) không phân biệt được (vbsec 2026-09-10 #40).
          setupVersion: { increment: 1 },
          effectiveFrom: currentStructure.effectiveFrom,
          effectiveTo: currentStructure.effectiveTo,
          totalAmount: new Prisma.Decimal(totalAmount),
          status: 'PENDING_APPROVAL',
          approvedByUserId: null,
          approvedAt: null,
        },
      });

      await tx.employeeSalaryItem.deleteMany({
        where: { employeeSalaryId: salaryRecord.id },
      });
    }

    await tx.employeeSalaryItem.createMany({
      data: resolvedItems.map((it) => ({
        employeeSalaryId: salaryRecord.id,
        salaryItemId: it.salaryItemId,
        amount: new Prisma.Decimal(it.amount),
      })),
    });

    const updated = await tx.employeeSalary.findUnique({
      where: { id: salaryRecord.id },
      include: {
        items: {
          include: { salaryItem: true },
        },
      },
    });

    return formatEmployeeSalary(updated, employee, currentStructure);
  });
}

export async function deleteEmployeeSalary(
  db: PrismaClient,
  maNvOrEmployeeId: string,
) {
  const employee = await db.hrm_nhan_vien.findFirst({
    where: {
      ma_nv: maNvOrEmployeeId,
      da_xoa: false,
    },
  });

  if (!employee) {
    throw new NotFoundError(MESSAGES.HRM.SALARY_EMPLOYEE_NOT_FOUND);
  }

  const existing = await db.employeeSalary.findUnique({
    where: { ma_nv: employee.ma_nv },
  });

  if (existing) {
    await db.employeeSalary.delete({
      where: { id: existing.id },
    });
  }
}

export async function approveEmployeeSalaries(
  db: PrismaClient,
  input: ApproveSalariesInput,
  userId?: string,
) {
  // Một câu UPDATE có điều kiện (vbsec 2026-09-10): chỉ dòng CÒN đúng phiên bản người duyệt đã xem (#40) và
  // còn chờ duyệt (#39 — `not APPROVED` từng cuốn cả bản nháp lẫn bản đã bị từ chối). Dòng bị sửa sau khi
  // xem (phiên bản đã tăng) không khớp -> không duyệt, báo lại để người duyệt tải lại xem.
  const where: Prisma.EmployeeSalaryWhereInput = {
    status: 'PENDING_APPROVAL',
    OR: input.items.map((it) => ({ ma_nv: it.employeeId, setupVersion: it.setupVersion })),
  };

  // updateMany trả sẵn số dòng đã đổi — khỏi cần findMany riêng chỉ để đếm trước.
  const result = await db.employeeSalary.updateMany({
    where,
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByUserId: userId ?? null,
    },
  });
  const skippedCount = input.items.length - result.count;

  if (result.count === 0) {
    return {
      approvedCount: 0,
      skippedCount,
      message:
        'Không duyệt được bản nào: các bản set lương đã được sửa sau khi bạn xem hoặc không còn chờ duyệt. Tải lại danh sách rồi duyệt lại.',
    };
  }

  return {
    approvedCount: result.count,
    skippedCount,
    message:
      skippedCount > 0
        ? `Đã duyệt ${result.count} bản set lương; ${skippedCount} bản đã được sửa sau khi bạn xem hoặc không còn chờ duyệt — tải lại để xem trước khi duyệt.`
        : `Đã duyệt ${result.count} bản set lương thành công.`,
  };
}
