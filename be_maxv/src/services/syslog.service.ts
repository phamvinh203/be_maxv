import { sysPrisma } from '../config/db.sys';
import type { Prisma } from '../generated/sys';

interface LogInput {
  level?: 'INFO' | 'WARN' | 'ERROR';
  hanhDong: string;
  userId?: string;
  donViId?: string;
  chiTiet?: Prisma.InputJsonValue;
  ip?: string;
}

/** Ghi nhật ký hệ thống (best-effort, không làm vỡ luồng chính nếu lỗi). */
export async function writeLog(input: LogInput): Promise<void> {
  try {
    await sysPrisma.sysLog.create({ data: { level: 'INFO', ...input } });
  } catch {
    // nuốt lỗi log để không ảnh hưởng nghiệp vụ
  }
}
