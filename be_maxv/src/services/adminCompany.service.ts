import { sysPrisma } from '../config/db.sys';
import { getTenantDb } from '../helpers/tenantClient';
import { provisionTenant } from './provisioning.service';
import { writeLog } from './syslog.service';
import { ConflictError, NotFoundError } from '../helpers/errors';
import { MESSAGES } from '../constants/messages';
import type { Prisma } from '../generated/sys';
import type { ListCompaniesQuery } from '../validators/admin.validator';

// Cột công khai cho danh sách (không kéo quan hệ -> nhẹ).
const LIST_SELECT = {
  id: true,
  maSoThue: true,
  tenDonVi: true,
  status: true,
  dbName: true,
  provisionedAt: true,
  createdAt: true,
} satisfies Prisma.DonViSelect;

/** GET /admin/companies — danh sách + lọc theo trạng thái / từ khóa, phân trang. */
export async function adminListCompanies(query: ListCompaniesQuery) {
  const { status, q, page, pageSize } = query;

  const where: Prisma.DonViWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { maSoThue: { contains: q } },
      { tenDonVi: { contains: q, mode: 'insensitive' } },
    ];
  }

  // 2 đọc độc lập trên đường list -> chạy song song (đúng pattern findMany + count).
  const [data, total] = await Promise.all([
    sysPrisma.donVi.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    sysPrisma.donVi.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

/** GET /admin/companies/:id — chi tiết kèm owner/nhân viên + thuê bao hiện hành. */
export async function adminGetCompany(id: string) {
  const company = await sysPrisma.donVi.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, hoTen: true, email: true, role: true, isActive: true },
      },
      subscription: {
        include: { plan: { select: { ma: true, ten: true } } },
      },
    },
  });
  if (!company) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);
  return company;
}

/** Lấy công ty theo id hoặc ném NotFound. */
async function getOrThrow(id: string) {
  const company = await sysPrisma.donVi.findUnique({ where: { id } });
  if (!company) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);
  return company;
}

/** POST /admin/companies/:id/retry-provision — chạy lại saga cấp DB cho cty FAILED. */
export async function adminRetryProvision(id: string, adminId: string) {
  const company = await getOrThrow(id);
  if (company.status !== 'FAILED') {
    throw new ConflictError(MESSAGES.COMPANY.RETRY_NOT_FAILED);
  }

  await sysPrisma.donVi.update({
    where: { id },
    data: { status: 'PROVISIONING' },
  });
  // provisionTenant tự đặt READY/FAILED + trả dbName (ném lỗi nếu thất bại).
  const dbName = await provisionTenant(company.id, company.maSoThue);

  await writeLog({
    hanhDong: 'RETRY_PROVISION',
    userId: adminId,
    donViId: id,
    chiTiet: { dbName },
  });
  return { id, status: 'READY', dbName };
}

/** POST /admin/companies/:id/suspend — tạm khóa truy cập (KHÔNG xóa DB). */
export async function adminSuspendCompany(id: string, adminId: string) {
  const company = await getOrThrow(id);
  if (company.status !== 'READY') {
    throw new ConflictError(MESSAGES.COMPANY.SUSPEND_NOT_READY);
  }

  const updated = await sysPrisma.donVi.update({
    where: { id },
    data: { status: 'SUSPENDED' },
  });
  await writeLog({ hanhDong: 'SUSPEND_COMPANY', userId: adminId, donViId: id });
  return { id: updated.id, status: updated.status };
}

/** POST /admin/companies/:id/resume — mở lại công ty đang bị khóa. */
export async function adminResumeCompany(id: string, adminId: string) {
  const company = await getOrThrow(id);
  if (company.status !== 'SUSPENDED') {
    throw new ConflictError(MESSAGES.COMPANY.RESUME_NOT_SUSPENDED);
  }

  const updated = await sysPrisma.donVi.update({
    where: { id },
    data: { status: 'READY' },
  });
  await writeLog({ hanhDong: 'RESUME_COMPANY', userId: adminId, donViId: id });
  return { id: updated.id, status: updated.status };
}

/** "1.2 MB" từ số byte. */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * GET /admin/companies/:id/overview — tổng quan dữ liệu trong DB RIÊNG của tenant.
 * CHỈ ĐỌC: đếm bản ghi mỗi bảng nghiệp vụ + dung lượng DB + hoạt động gần nhất.
 * Mọi truy cập đều ghi audit (admin xem data khách = thao tác nhạy cảm).
 */
export async function adminGetCompanyOverview(id: string, adminId: string) {
  const company = await getOrThrow(id);
  if (!company.dbName) {
    throw new ConflictError(MESSAGES.COMPANY.NO_TENANT_DB);
  }

  const db = getTenantDb(company.dbName);

  // Các đọc độc lập trên DB tenant -> chạy song song.
  const [
    taiKhoan,
    doiTuong,
    chungTu,
    chungTuDong,
    butToan,
    thietLap,
    lastChungTu,
    sizeRows,
  ] = await Promise.all([
    db.taiKhoan.count(),
    db.doiTuong.count(),
    db.chungTu.count(),
    db.chungTuDong.count(),
    db.butToan.count(),
    db.thietLap.findUnique({
      where: { id: 1 },
      select: { tenCongTy: true, maSoThue: true, ngayBatDauNTC: true },
    }),
    db.chungTu.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    db.$queryRaw<
      { size: bigint }[]
    >`SELECT pg_database_size(current_database()) AS size`,
  ]);

  // bigint không serialize JSON -> ép Number.
  const dbSizeBytes = Number(sizeRows[0]?.size ?? 0);

  await writeLog({
    hanhDong: 'VIEW_TENANT_OVERVIEW',
    userId: adminId,
    donViId: id,
  });

  return {
    company: {
      id: company.id,
      maSoThue: company.maSoThue,
      tenDonVi: company.tenDonVi,
      status: company.status,
      dbName: company.dbName,
    },
    thietLap, // null nếu tenant chưa khởi tạo thiết lập
    counts: { taiKhoan, doiTuong, chungTu, chungTuDong, butToan },
    dbSizeBytes,
    dbSize: formatBytes(dbSizeBytes),
    lastChungTuAt: lastChungTu?.createdAt ?? null,
  };
}
