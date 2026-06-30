import { sysPrisma } from '../../config/db.sys';
import type { Prisma } from '../../generated/sys';
import type { ListLogsQuery } from '../../validators/admin.validator';

/**
 * GET /admin/logs — nhật ký hệ thống (bảng syslog), phân trang + lọc.
 * Sắp xếp theo createdAt (id là uuid nên không phản ánh thứ tự thời gian).
 */
export async function adminListLogs(query: ListLogsQuery) {
  const { level, hanhDong, userId, donViId, ip, from, to, sort, page, pageSize } =
    query;

  const where: Prisma.SysLogWhereInput = {};
  if (level) where.level = level;
  if (hanhDong) where.hanhDong = hanhDong;
  if (userId) where.userId = userId;
  if (donViId) where.donViId = donViId;
  if (ip) where.ip = { contains: ip };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  // 2 đọc độc lập trên đường list -> chạy song song.
  const [data, total] = await Promise.all([
    sysPrisma.sysLog.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    sysPrisma.sysLog.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

/**
 * GET /admin/logs/actions — danh sách hành động (hanhDong) phân biệt đang có
 * trong bảng syslog, để FE đổ vào dropdown lọc (không hardcode).
 */
export async function adminListLogActions(): Promise<string[]> {
  const rows = await sysPrisma.sysLog.findMany({
    distinct: ['hanhDong'],
    select: { hanhDong: true },
    orderBy: { hanhDong: 'asc' },
  });
  return rows.map((r) => r.hanhDong);
}
