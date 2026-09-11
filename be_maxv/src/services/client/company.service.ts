import { sysPrisma } from '../../config/db.sys';
import { tenantDbName, tenantSlug } from '../../utils/dbName';
import { dropTenant, provisionTenant } from '../shared/provisioning.service';
import { createTrialSubscription } from '../shared/subscription.service';
import {
  assertMstLimit,
  assertUserLimit,
  khoaHanMuc,
} from '../shared/limits.service';
import { writeLog } from '../shared/syslog.service';
import { findOrThrow } from '../../helpers/crudGuards';
import { sendMail } from '../shared/mailer.service';
import { newInviteNoticeEmail } from '../../helpers/mailTemplates';
import {
  ConflictError,
  ForbiddenError,
  MailError,
  NotFoundError,
} from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type {
  InviteUserInput,
  RegisterCompanyInput,
  UpdateCompanyInput,
} from '../../validators/company.validator';

/** ownerId lấy từ JWT (req.user.userId) của owner đang đăng nhập, không nhận từ body. */
type RegisterCompanyArgs = RegisterCompanyInput & { ownerId: string };

/**
 * BƯỚC 2 — Owner đăng ký MỘT công ty/MST (có thể nhiều MST mỗi tài khoản).
 * Tạo don_vi (ownerId = owner) + cấp DB riêng maxv2_<mst>_app.
 * Thuê bao dùng thử đã được gán khi đăng ký tài khoản; ở đây chỉ gọi lại làm
 * lưới an toàn idempotent (bù cho tài khoản cũ đăng ký trước khi có logic này).
 */
export async function registerCompany(input: RegisterCompanyArgs) {
  const { ownerId, tenCongTy, maSoThue, diaChi, sdt, loaiHinhKinhDoanh } =
    input;

  // Lưới an toàn cho tài khoản đăng ký trước khi có gói dùng thử: CHƯA có công ty nào thì cấp gói dùng thử
  // (idempotent, no-op nếu đã có) — và phải cấp TRƯỚC bước kiểm trần, vì kiểm trần giờ chặn owner không
  // có gói (limits.service.ts). Cấp lỗi (hay race với lượt song song) thì kiểm trần tự quyết theo DB.
  if ((await sysPrisma.donVi.count({ where: { ownerId } })) === 0) {
    await createTrialSubscription(ownerId).catch((err) =>
      console.error(
        `[registerCompany] createTrialSubscription lỗi cho owner ${ownerId}:`,
        err,
      ),
    );
  }

  // Đếm -> kiểm trần gói -> tạo don_vi phải là MỘT bước nguyên tử cho từng owner (khoaHanMuc), không
  // thì request song song cùng qua kiểm tra và cùng tạo công ty + cấp DB tenant (vượt gói, vắt kiệt
  // server Postgres dùng chung). Cấp DB (chậm) chạy SAU commit để không giữ khóa lâu.
  const { donVi } = await sysPrisma.$transaction(async (tx) => {
    await khoaHanMuc(tx, 'mst', ownerId);

    // Đếm MST hiện có + kiểm tra MST trùng (kèm email chủ tài khoản đã đăng ký MST đó, để báo cụ thể).
    const existingCount = await tx.donVi.count({ where: { ownerId } });
    const mstExists = await tx.donVi.findUnique({
      where: { maSoThue },
      select: { owner: { select: { email: true } } },
    });

    if (mstExists) {
      throw new ConflictError(
        MESSAGES.COMPANY.MST_TAKEN(mstExists.owner.email),
      );
    }
    await assertMstLimit(ownerId, existingCount); // trần MST (override ?? gói)

    const donVi = await tx.donVi.create({
      data: {
        ownerId,
        maSoThue,
        slug: tenantSlug(maSoThue),
        tenDonVi: tenCongTy,
        diaChi,
        sdt,
        loaiHinhKinhDoanh,
        status: 'PROVISIONING',
      },
    });
    return { donVi };
  });

  // Cấp DB riêng cho MST.
  const dbName = await provisionTenant(donVi.id, maSoThue);

  await writeLog({
    hanhDong: 'CREATE_COMPANY',
    userId: ownerId,
    donViId: donVi.id,
    chiTiet: { maSoThue, dbName },
  });

  return {
    id: donVi.id,
    maSoThue,
    slug: donVi.slug,
    tenDonVi: tenCongTy,
    diaChi,
    sdt,
    loaiHinhKinhDoanh,
    status: donVi.status,
    dbName,
  };
}

/**
 * PUT /companies/:id — owner sửa thông tin công ty. MST không đổi được (đã gắn tenant DB).
 * Scope quyền sở hữu ngay trong `update()` (Prisma extended-where-unique) thay vì
 * findFirst-rồi-update riêng — 1 round-trip thay vì 2, và tự động khớp `accessibleDonViWhere`
 * (không thao tác được công ty đã ARCHIVED, đúng "nguồn duy nhất" ở helpers/access.ts).
 */
export async function updateCompanyInfo(
  id: string,
  ownerId: string,
  input: UpdateCompanyInput,
) {
  const { tenCongTy, ...rest } = input;

  const updated = await sysPrisma.donVi
    .update({
      // Không thao tác được công ty đã ARCHIVED — khớp accessibleDonViWhere ở helpers/access.ts.
      where: { id, ownerId, status: { not: 'ARCHIVED' } },
      data: {
        ...rest,
        ...(tenCongTy !== undefined && { tenDonVi: tenCongTy }),
      },
    })
    .catch(() => {
      throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);
    });

  await writeLog({
    hanhDong: 'UPDATE_COMPANY',
    userId: ownerId,
    donViId: id,
    chiTiet: input,
  });

  return {
    id: updated.id,
    maSoThue: updated.maSoThue,
    slug: updated.slug,
    tenDonVi: updated.tenDonVi,
    diaChi: updated.diaChi,
    sdt: updated.sdt,
    loaiHinhKinhDoanh: updated.loaiHinhKinhDoanh,
    status: updated.status,
  };
}

/**
 * Người dùng phải gõ lại MST để xác nhận xóa. Verify LẠI ở server chứ không chỉ chặn ở dialog:
 * thao tác này DROP DATABASE, không thể để một request gõ tay bỏ qua lớp bảo vệ của UI.
 * (Chuẩn hóa khoảng trắng là việc của `deleteCompanySchema`, ở đây chỉ so bằng.)
 */
export function assertMstConfirmed(input: string, actual: string): void {
  if (input !== actual) throw new ConflictError(MESSAGES.COMPANY.MST_MISMATCH);
}

/**
 * DELETE /companies/:id — owner XÓA VĨNH VIỄN công ty của chính mình: DROP DATABASE tenant + xóa
 * hẳn bản ghi don_vi (cascade don_vi_access). Không hoàn tác được; đổi lại MST đăng ký lại được
 * (maSoThue là @unique nên bản ghi còn sót sẽ khóa MST vĩnh viễn).
 *
 * Thứ tự DROP-trước-xóa-row là có chủ đích. DROP DATABASE không chạy trong transaction Postgres
 * nên phải chọn hướng thất bại ít tệ hơn:
 *   - DROP xong mà xóa row lỗi -> row trỏ DB đã mất, adminGetCompanyOverview reconcile thành
 *     FAILED và owner xóa lại được.
 *   - Xóa row trước mà DROP lỗi -> database thành rác vĩnh viễn, không còn gì truy vết.
 *
 * CỐ Ý không lọc `status` (khác `updateCompanyInfo`): công ty ARCHIVED của luồng soft-delete cũ đã
 * bị accessibleDonViWhere ẩn khỏi mọi danh sách, nên chúng vừa không dùng được vừa khóa MST vĩnh
 * viễn. Không lọc ở đây thì ít nhất còn một đường dọn chúng nếu biết id.
 */
export async function destroyCompany(
  id: string,
  ownerId: string,
  confirmMst: string,
): Promise<void> {
  const company = await findOrThrow(
    () =>
      sysPrisma.donVi.findFirst({
        where: { id, ownerId },
        select: { maSoThue: true, tenDonVi: true, dbName: true },
      }),
    new NotFoundError(MESSAGES.COMPANY.NOT_FOUND),
  );

  assertMstConfirmed(confirmMst, company.maSoThue);

  // dbName rỗng khi provisioning chưa xong (PROVISIONING/FAILED) nhưng DB vật lý có thể ĐÃ được tạo
  // trước khi hỏng — vẫn DROP theo tên suy từ MST (IF EXISTS), không để lại DB mồ côi cho owner sau
  // đăng ký lại cùng MST. dropTenant tự gỡ pool tenant trước khi DROP (xem provisioning.service.ts).
  await dropTenant(company.dbName ?? tenantDbName(company.maSoThue));

  await sysPrisma.donVi.delete({ where: { id } });

  // Không truyền donViId: bản ghi đã bị xóa. SysLog.donViId không có FK nên vẫn ghi được, nhưng
  // để null + nhét đủ thông tin vào chiTiet thì dấu vết audit sạch và tự đọc được.
  await writeLog({
    hanhDong: 'DELETE_COMPANY',
    userId: ownerId,
    chiTiet: { donViId: id, ...company },
  });
}

interface InviteEmployeeInput extends InviteUserInput {
  ownerId: string; // chủ tài khoản gửi lời mời (req.user.userId — đã yêu cầu role OWNER)
  requestedById: string; // userId của owner gửi lời mời
}

interface NewInviteNotice {
  ownerHoTen: string;
  email: string;
  hoTen: string;
  chucVu: string;
  congTy: { tenDonVi: string; maSoThue: string }[];
}

/** Báo cho tất cả admin hệ thống có 1 lời mời nhân viên mới đang chờ duyệt. */
async function notifyAdminsOfNewInvite(n: NewInviteNotice): Promise<void> {
  const admins = await sysPrisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  });
  if (admins.length === 0) return; // không có admin nào để báo -> coi như xong

  try {
    await sendMail({
      to: admins.map((a) => a.email),
      ...newInviteNoticeEmail(n),
    });
  } catch {
    throw new MailError(MESSAGES.COMPANY.INVITE_NOTIFY_FAILED);
  }
}

// BƯỚC 3 — Owner mời nhân viên vào TÀI KHOẢN + cấp quyền vào các MST cụ thể (admin duyệt).
// Mọi lời mời role = OWNER_EMPLOYEE; chức vụ là text tự do; donViIds là MST được cấp.
export async function inviteUserToCompany(input: InviteEmployeeInput) {
  const { ownerId, requestedById, email, hoTen, chucVu, donViIds } = input;

  // Chỉ được cấp các MST do chính owner sở hữu.
  const ownedCongTy = await sysPrisma.donVi.findMany({
    where: { id: { in: donViIds }, ownerId },
    select: { id: true, tenDonVi: true, maSoThue: true },
  });
  if (ownedCongTy.length !== donViIds.length) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }

  const owner = await sysPrisma.user.findUnique({
    where: { id: ownerId },
    select: { hoTen: true },
  });

  // Kiểm trần + tạo lời mời trong MỘT bước nguyên tử theo owner (khoaHanMuc — cùng khóa với lúc admin
  // duyệt). Lời mời ĐANG CHỜ cũng chiếm ghế: không đếm thì owner gói 1 ghế nộp bao nhiêu lời mời cũng
  // được, admin duyệt hết là vượt gói.
  const invite = await sysPrisma.$transaction(async (tx) => {
    await khoaHanMuc(tx, 'nhan_vien', ownerId);

    const employeeCount = await tx.user.count({ where: { ownerId } });
    const pendingCount = await tx.inviteRequest.count({
      where: { ownerId, status: 'PENDING' },
    });
    const existingUser = await tx.user.findUnique({ where: { email } });
    const pendingInvite = await tx.inviteRequest.findFirst({
      where: { ownerId, email, status: 'PENDING' },
    });

    // 1 email = 1 tài khoản: email đã có user -> không mời làm nhân viên tài khoản khác.
    if (existingUser) {
      throw new ConflictError(MESSAGES.COMPANY.EMAIL_ALREADY_MEMBER);
    }
    if (pendingInvite) {
      throw new ConflictError(MESSAGES.COMPANY.INVITE_ALREADY_PENDING);
    }
    // trần nhân viên (override ?? gói)
    await assertUserLimit(ownerId, employeeCount + pendingCount);

    return tx.inviteRequest.create({
      data: {
        ownerId,
        email,
        hoTen,
        chucVu,
        donViIds,
        role: 'OWNER_EMPLOYEE',
        requestedById,
      },
    });
  });

  // Báo admin là yêu cầu bắt buộc — mail lỗi thì hủy luôn lời mời vừa tạo.
  try {
    await notifyAdminsOfNewInvite({
      ownerHoTen: owner?.hoTen ?? '',
      email,
      hoTen,
      chucVu,
      congTy: ownedCongTy,
    });
  } catch (err) {
    await sysPrisma.inviteRequest.delete({ where: { id: invite.id } });
    throw err;
  }

  await writeLog({
    hanhDong: 'INVITE_USER',
    userId: requestedById,
    chiTiet: { email, hoTen, chucVu, donViIds, inviteId: invite.id },
  });

  return {
    id: invite.id,
    email: invite.email,
    hoTen: invite.hoTen,
    chucVu: invite.chucVu,
    donViIds: invite.donViIds,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt,
  };
}

/** GET /companies/employees — thành viên tài khoản (owner + nhân viên) kèm MST được cấp. */
export async function listCompanyEmployees(ownerId: string | null) {
  if (!ownerId) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  return sysPrisma.user.findMany({
    where: { OR: [{ id: ownerId }, { ownerId }] },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      hoTen: true,
      email: true,
      sdt: true,
      chucVu: true,
      role: true,
      status: true,
      isActive: true,
      createdAt: true,
      // `xemLuong` đi kèm để màn phân quyền của `maxv/` tích sẵn đúng ô — không có nó thì
      // cột dữ liệu M-13 tồn tại mà không ai cấp/thu hồi được (FR-hrm-044).
      donViAccess: { select: { donViId: true, xemLuong: true } },
    },
  });
}

/** GET /companies/invites — toàn bộ lời mời (mọi trạng thái) của tài khoản. */
export async function listCompanyInvites(ownerId: string | null) {
  if (!ownerId) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  return sysPrisma.inviteRequest.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      hoTen: true,
      chucVu: true,
      donViIds: true,
      role: true,
      status: true,
      lyDoTuChoi: true,
      createdAt: true,
      resolvedAt: true,
    },
  });
}

/** Một dòng phân quyền: công ty + (tùy chọn) quyền xem dữ liệu lương. */
export interface QuyenCongTy {
  donViId: string;
  /** `undefined` = KHÔNG đụng tới cờ hiện có (dạng thân yêu cầu cũ chỉ gửi danh sách công ty). */
  xemLuong?: boolean;
}

/**
 * PUT /companies/employees/:userId/access — đặt lại tập MST của 1 nhân viên, kèm quyền xem
 * dữ liệu lương từng công ty. Danh sách rỗng = thu hồi hết.
 * Chỉ owner của tài khoản thao tác; chỉ gán MST owner sở hữu.
 *
 * 🚨 GHI THEO CẶP KHÓA, KHÔNG CÒN REPLACE-SET (BUG-HRM-28, ADR-007, M-13).
 *
 * Bản cũ `deleteMany({ userId })` rồi `createMany` lại toàn bộ. Cách đó chạy đúng khi bảng chỉ
 * có cặp (user, công ty), nhưng từ khi có cột `xemLuong` thì **mỗi lần chủ tài khoản sửa danh
 * sách công ty là xóa sạch mọi quyền xem lương đã cấp** — âm thầm, không lỗi, không nhật ký,
 * và không ai biết cho tới khi kế toán báo mất màn hợp đồng. Giờ chỉ xóa cặp bị bỏ ra và
 * `upsert` từng cặp còn lại; cặp cũ không gửi cờ thì GIỮ NGUYÊN cờ đang có.
 */
export async function setEmployeeAccess(
  ownerId: string,
  employeeId: string,
  access: QuyenCongTy[],
) {
  const donViIds = access.map((a) => a.donViId);
  const employee = await sysPrisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true, ownerId: true },
  });
  if (
    !employee ||
    employee.ownerId !== ownerId ||
    employee.role !== 'OWNER_EMPLOYEE'
  ) {
    throw new NotFoundError(MESSAGES.USER.NOT_FOUND);
  }

  // Chỉ gán được MST do owner sở hữu.
  if (donViIds.length > 0) {
    const owned = await sysPrisma.donVi.findMany({
      where: { id: { in: donViIds }, ownerId },
      select: { id: true },
    });
    if (owned.length !== donViIds.length) {
      throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
    }
  }

  await sysPrisma.$transaction(async (tx) => {
    // Chỉ thu hồi những công ty bị bỏ ra khỏi danh sách. Danh sách rỗng = thu hồi hết
    // (`notIn: []` không diễn tả được ý đó nên tách nhánh riêng).
    await tx.donViAccess.deleteMany({
      where: {
        userId: employeeId,
        ...(donViIds.length > 0 ? { donViId: { notIn: donViIds } } : {}),
      },
    });

    for (const item of access) {
      await tx.donViAccess.upsert({
        where: {
          userId_donViId: { userId: employeeId, donViId: item.donViId },
        },
        create: {
          userId: employeeId,
          donViId: item.donViId,
          // Cặp MỚI mà không nói gì về quyền lương -> theo mặc định của cột (không được xem).
          // QĐ #17: "giữ nguyên người cũ, siết người mới".
          xemLuong: item.xemLuong ?? false,
        },
        // Cặp CŨ: không gửi cờ -> `{}` -> giữ nguyên giá trị đang có, không đụng tới.
        update: item.xemLuong === undefined ? {} : { xemLuong: item.xemLuong },
      });
    }
  });

  await writeLog({
    hanhDong: 'SET_EMPLOYEE_ACCESS',
    userId: ownerId,
    // Ghi cả cờ quyền lương, không chỉ danh sách công ty: thu hồi quyền lương là thao tác
    // người dùng phải truy lại được, mà nhật ký chỉ có `donViIds` thì không thấy nó xảy ra.
    chiTiet: {
      employeeId,
      access: access.map((a) => ({
        donViId: a.donViId,
        xemLuong: a.xemLuong ?? null,
      })),
    },
  });

  // `donViIds` giữ lại trong phản hồi cho giao diện hiện tại; `so_cong_ty` là trường contract
  // Mục 7C.1 yêu cầu. Thêm chứ không thay, để không phải sửa hai phía cùng lúc.
  return { userId: employeeId, donViIds, so_cong_ty: donViIds.length };
}
