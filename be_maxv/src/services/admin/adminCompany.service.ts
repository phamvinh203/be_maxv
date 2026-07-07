import { sysPrisma } from '../../config/db.sys';
import { getTenantDb } from '../../helpers/tenantClient';
import {
  provisionTenant,
  tenantDbExists,
} from '../shared/provisioning.service';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { findOrThrow } from '../../helpers/crudGuards';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';
import type { PrismaClient as TenantClient } from '../../generated/tenant';
import type { ListCompaniesQuery } from '../../validators/admin.validator';
import { MENU_MODULES } from '../../config/modules';

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

/** GET /admin/companies/:id — chi tiết kèm owner (+ thuê bao tài khoản) và nhân viên được cấp. */
export async function adminGetCompany(id: string) {
  const company = await sysPrisma.donVi.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          hoTen: true,
          email: true,
          role: true,
          isActive: true,
          // Thuê bao nằm ở cấp tài khoản (owner), không còn ở công ty.
          subscription: {
            include: { plan: { select: { ma: true, ten: true } } },
          },
        },
      },
      // Nhân viên được cấp quyền vào MST này.
      access: {
        select: {
          user: {
            select: {
              id: true,
              hoTen: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
  if (!company) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);
  return company;
}

/** Lấy công ty theo id hoặc ném NotFound. */
function getOrThrow(id: string) {
  return findOrThrow(
    () => sysPrisma.donVi.findUnique({ where: { id } }),
    new NotFoundError(MESSAGES.COMPANY.NOT_FOUND),
  );
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

// Cấu trúc menu tổng quan (module -> section -> item + table) tách sang
// src/config/modules để service chỉ còn logic đo dữ liệu.

interface TableStat {
  table: string;
  rows: number;
  bytes: number;
  size: string;
}

/**
 * Đếm số bản ghi + kích thước cho các bảng CÓ THẬT trong DB tenant.
 * - Lọc-tồn-tại & kích thước: pg_stat_user_tables.
 * - Đếm bản ghi: count(*) CHÍNH XÁC qua UNION ALL.
 * Chỉ trả về bảng thực sự tồn tại -> caller phân biệt được item "chưa có bảng".
 * Tên bảng lấy từ hằng số nội bộ (không phải input người dùng) -> nội suy an toàn.
 */
async function collectTableStats(
  db: TenantClient,
  tables: string[],
): Promise<Map<string, TableStat>> {
  const result = new Map<string, TableStat>();
  if (tables.length === 0) return result;

  const inList = tables.map((t) => `'${t}'`).join(', ');
  const sizeRows = await db.$queryRawUnsafe<
    Array<{ table: string; bytes: bigint }>
  >(
    `SELECT relname AS table, pg_total_relation_size(relid) AS bytes
     FROM pg_stat_user_tables
     WHERE relname IN (${inList})`,
  );
  if (sizeRows.length === 0) return result;

  const existing = sizeRows.map((r) => r.table);
  const unionSql = existing
    .map((t) => `SELECT '${t}' AS t, count(*)::bigint AS c FROM "${t}"`)
    .join(' UNION ALL ');
  const countRows =
    await db.$queryRawUnsafe<Array<{ t: string; c: bigint }>>(unionSql);
  const countMap = new Map(countRows.map((r) => [r.t, Number(r.c)]));

  for (const r of sizeRows) {
    const bytes = Number(r.bytes);
    result.set(r.table, {
      table: r.table,
      rows: countMap.get(r.table) ?? 0,
      bytes,
      size: formatBytes(bytes),
    });
  }
  return result;
}

/**
 * GET /admin/companies/:id/overview — tổng quan dữ liệu trong DB RIÊNG của tenant.
 * CHỈ ĐỌC: trả cây menu (module -> section -> item) kèm số bản ghi + size
 * mỗi item (item chưa có bảng -> null) và tổng dung lượng DB tenant.
 * Mọi truy cập đều ghi audit (admin xem data khách = thao tác nhạy cảm).
 */
export async function adminGetCompanyOverview(id: string, adminId: string) {
  const company = await getOrThrow(id);
  if (!company.dbName) {
    throw new ConflictError(MESSAGES.COMPANY.NO_TENANT_DB);
  }

  // Đối soát-khi-đọc: sys ghi READY nhưng DB thật có thể đã bị xóa.
  // Tự sửa trạng thái về FAILED + báo lỗi rõ ràng thay vì để 500 khi kết nối.
  if (!(await tenantDbExists(company.dbName))) {
    await sysPrisma.donVi.update({ where: { id }, data: { status: 'FAILED' } });
    await writeLog({
      level: 'ERROR',
      hanhDong: 'TENANT_DB_MISSING',
      userId: adminId,
      donViId: id,
      chiTiet: { dbName: company.dbName },
    });
    throw new ConflictError(MESSAGES.COMPANY.TENANT_DB_MISSING);
  }

  const db = getTenantDb(company.dbName);

  // Gom toàn bộ bảng (có thật) được khai báo trong menu -> đếm 1 lượt.
  const allTables = Array.from(
    new Set(
      MENU_MODULES.flatMap((m) =>
        m.sections.flatMap((s) =>
          s.items.map((i) => i.table).filter((t): t is string => !!t),
        ),
      ),
    ),
  );

  const [statByTable, sizeRows] = await Promise.all([
    collectTableStats(db, allTables),
    db.$queryRaw<
      { size: bigint }[]
    >`SELECT pg_database_size(current_database()) AS size`,
  ]);

  // Lắp ráp cây menu + số liệu (bigint đã ép Number trong collectTableStats).
  const modules = MENU_MODULES.map((m) => {
    const sections = m.sections.map((s) => {
      const items = s.items.map((i) => {
        const stat = i.table ? statByTable.get(i.table) : undefined;
        return {
          label: i.label,
          path: i.path ?? null,
          table: i.table ?? null,
          exists: !!stat, // bảng đã có trong DB tenant chưa
          rows: stat ? stat.rows : null, // null = chưa có bảng / không phải dữ liệu
          bytes: stat ? stat.bytes : null,
          size: stat ? stat.size : null,
        };
      });
      const totalRows = items.reduce((acc, it) => acc + (it.rows ?? 0), 0);
      const totalBytes = items.reduce((acc, it) => acc + (it.bytes ?? 0), 0);
      return {
        key: s.key,
        title: s.title,
        totalRows,
        totalBytes,
        totalSize: formatBytes(totalBytes),
        items,
      };
    });
    const totalRows = sections.reduce((acc, s) => acc + s.totalRows, 0);
    const totalBytes = sections.reduce((acc, s) => acc + s.totalBytes, 0);
    return {
      key: m.key,
      title: m.title,
      totalRows,
      totalBytes,
      totalSize: formatBytes(totalBytes),
      sections,
    };
  });

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
    dbSizeBytes,
    dbSize: formatBytes(dbSizeBytes),
    modules, // [{ key,title,totalRows,totalSize, sections:[{ key,title,items:[{label,path,rows,size,exists}] }] }]
  };
}
