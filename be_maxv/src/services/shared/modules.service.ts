import type { FastifyRequest } from 'fastify';
import { sysPrisma } from '../../config/db.sys';
import {
  MODULE_KEYS,
  khongCoModule,
  type ModuleKey,
  type UserModules,
} from '../../constants/modules';
import type { Prisma, Role, SubscriptionStatus } from '../../generated/sys';
import { ForbiddenError, UnauthorizedError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';

export type { ModuleKey, UserModules } from '../../constants/modules';

/** `select` để lấy phần thuê bao cần cho việc quy đổi quyền. */
const SELECT_GOI = {
  status: true,
  ketThuc: true,
  plan: { select: { features: true } },
} satisfies Prisma.SubscriptionSelect;

export interface GoiRutGon {
  status: SubscriptionStatus;
  ketThuc: Date | null;
  plan: { features: Prisma.JsonValue };
}

/** Trạng thái thuê bao còn cho phép dùng module của gói. */
const TRANG_THAI_CON_DUNG: SubscriptionStatus[] = ['TRIALING', 'ACTIVE'];

/**
 * Gói còn hiệu lực không.
 *
 * Kiểm **cả `status` lẫn `ketThuc`**: tác vụ đổi trạng thái sang `EXPIRED` có
 * thể chạy trễ, tin mỗi `status` thì khách hết hạn vẫn dùng tiếp — rò doanh thu
 * và không ai báo cho mình biết.
 */
export function goiConHieuLuc(sub: GoiRutGon | null, bayGio = new Date()): boolean {
  if (!sub) return false;
  if (!TRANG_THAI_CON_DUNG.includes(sub.status)) return false;
  if (sub.ketThuc && sub.ketThuc.getTime() < bayGio.getTime()) return false;
  return true;
}

/**
 * Module do gói cấp, đọc từ `SubscriptionPlan.features`.
 *
 * `features` là `Json` nên có thể chứa bất cứ thứ gì — chỉ nhận đúng khóa nằm
 * trong `MODULE_KEYS` và đúng giá trị `true`. Khóa lạ hoặc giá trị lạ bị bỏ
 * qua, không suy diễn.
 */
export function moduleCuaGoi(sub: GoiRutGon | null, bayGio = new Date()): UserModules {
  const ketQua = khongCoModule();
  if (!sub || !goiConHieuLuc(sub, bayGio)) return ketQua;

  const features = sub.plan.features;
  if (!features || typeof features !== 'object' || Array.isArray(features)) return ketQua;

  const bag = features as Record<string, unknown>;
  for (const k of MODULE_KEYS) {
    if (bag[k] === true) ketQua[k] = true;
  }
  return ketQua;
}

function tatCaModule(): UserModules {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, true])) as UserModules;
}

/**
 * Quyền module của một user.
 *
 * Quyền **chỉ đến từ gói thuê bao** — muốn cho một tài khoản dùng module thì
 * đổi gói của họ. Không có cơ chế bật/tắt riêng cho từng tài khoản: hai nguồn
 * quyền song song sẽ khiến "vì sao khách này thấy HRM" trở thành câu hỏi phải
 * tra hai chỗ mới trả lời được.
 *
 * - `ADMIN` luôn có tất cả — quản trị viên phải xem được mọi thứ để hỗ trợ.
 * - `OWNER` và `OWNER_EMPLOYEE` đều quy về **tài khoản (owner)**: nhân viên
 *   dùng chung gói với owner mình.
 *
 * Đây là nơi **duy nhất** quy đổi ra quyền module. Mọi chỗ tiêu thụ —
 * `/auth/me`, `/auth/login`, guard route, và sau này là preHandler của API —
 * đều đi qua đây.
 */
export async function moduleCuaUser(user: {
  id: string;
  role: Role;
  ownerId: string | null;
}): Promise<UserModules> {
  if (user.role === 'ADMIN') return tatCaModule();

  const ownerId = user.role === 'OWNER' ? user.id : user.ownerId;
  if (!ownerId) return khongCoModule();

  const sub = await sysPrisma.subscription.findUnique({
    where: { ownerId },
    select: SELECT_GOI,
  });
  return moduleCuaGoi(sub);
}

/** Ném ForbiddenError nếu quyền module đã quy đổi không có `module`. Hàm thuần, không đụng DB. */
export function assertModuleAllowed(modules: UserModules, module: ModuleKey): void {
  if (!modules[module]) {
    throw new ForbiddenError(MESSAGES.SUBSCRIPTION.MODULE_NOT_INCLUDED);
  }
}

/**
 * Guard theo module gói — dùng SAU `fastify.authenticate` (cần `req.user`).
 *
 * JWT chỉ mang `role`/`donViId` (xem `types/fastify.d.ts`), không mang `ownerId` của
 * `moduleCuaUser`, nên phải tra lại user thật (giống `loadUserSession` ở auth.service.ts)
 * rồi mới quy đổi quyền — không tránh được thêm 1 lượt DB, nhưng module đổi ngay khi đổi
 * gói nên không thể tin dữ liệu ký sẵn trong token.
 *
 *   preHandler: [fastify.authenticate, requireModule('dvc')]
 */
export function requireModule(module: ModuleKey) {
  return async (req: FastifyRequest): Promise<void> => {
    // ADMIN luôn có tất cả module (giống nhánh tatCaModule() trong moduleCuaUser) — khỏi tốn 2
    // lượt DB để đi vòng tới cùng kết luận. Role đọc thẳng từ JWT là đủ tin, cùng mức tin cậy
    // với requireRole() ở jwt.plugin.ts (route admin cũng chỉ soi req.user.role, không tra lại DB).
    if (req.user.role === 'ADMIN') return;

    const user = await sysPrisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, role: true, ownerId: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
    }
    assertModuleAllowed(await moduleCuaUser(user), module);
  };
}
