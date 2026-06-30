import { sysPrisma } from '../../config/db.sys';
import { getRequestIp } from '../../helpers/requestContext';
import type { Prisma } from '../../generated/sys';

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
    // IP mặc định lấy từ request context; input.ip (nếu có) sẽ ghi đè.
    await sysPrisma.sysLog.create({
      data: { level: 'INFO', ip: getRequestIp(), ...input },
    });
  } catch {
    // nuốt lỗi log để không ảnh hưởng nghiệp vụ
  }
}
