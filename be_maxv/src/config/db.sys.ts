import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/sys';
import { env } from './env';

/**
 * Client kết nối cố định tới control plane maxv2_sys.
 * Prisma 7: dùng driver adapter @prisma/adapter-pg (không còn url trong schema).
 */
const adapter = new PrismaPg(env.sysUrl, { schema: 'public' });
export const sysPrisma = new PrismaClient({ adapter });
