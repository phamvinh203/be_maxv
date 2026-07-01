# Mời & Duyệt Nhân Viên — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép chủ đơn vị (OWNER) mời nhân viên vào công ty của mình, admin hệ thống duyệt/từ chối, và nhân viên nhận mật khẩu tạm qua email khi được duyệt — theo đúng US-04/US-05 và mục F đã chốt trong [docs/SPEC-01-AUTH.md](../../SPEC-01-AUTH.md).

**Architecture:** Owner mời → tạo ngay `User(status=PENDING, isActive=false)` + `InviteRequest(status=PENDING)` trong 1 transaction (không sinh/gửi mật khẩu ở bước này). Admin duyệt → sinh mật khẩu thật, `User.status=ACTIVE/isActive=true`, gửi email. Admin từ chối → `User.status=REJECTED` (vĩnh viễn, không cho mời lại email đó), lưu lý do. `be_maxv` thêm 2 route mới (`/api/v1/nhan-vien/*` phía owner, `/api/v1/admin/nhan-vien/*` phía admin) + mailer mới. `fe_maxv` thêm trang quản lý nhân viên trong module Hệ thống. `maxv` thay `StubPage` của tab "Nhân viên" bằng trang thật.

**Tech Stack:** Fastify + Prisma (be_maxv), React + TanStack Query + MUI (fe_maxv, maxv), nodemailer (mới).

## Global Constraints

- **Không có framework test tự động nào trong repo này** (không Jest/Vitest/Supertest ở cả 3 project). Mỗi task xác minh bằng: `npm run typecheck` (be_maxv) / build-time type check, cộng với gọi API thật (curl) hoặc thao tác thật trên trình duyệt. Đây là quy ước hiện có của dự án (xem `be_maxv/requests/admin.http`) — KHÔNG cài thêm framework test mới ngoài phạm vi.
- **Không bao giờ trả/hiển thị password lúc tạo lời mời.** Response của `POST /nhan-vien/invite` chỉ có `{ id, email, role, status, createdAt }`. Mật khẩu thật chỉ được sinh và trả về (1 lần, cho admin) + gửi email ở bước `POST /admin/nhan-vien/:id/approve`.
- **Role mời chỉ gồm** `KE_TOAN_TRUONG`, `KE_TOAN`, `XEM` (không cho mời `OWNER` hay `ADMIN`).
- **Email đã tồn tại trong bảng `User` (bất kỳ công ty nào, kể cả chưa có công ty) → chặn ngay lúc mời** (409), không tạo `InviteRequest`.
- **Endpoint đặt tên đúng theo SPEC-01 mục A.6/F.3**: `/api/v1/nhan-vien/invite`, `/api/v1/nhan-vien` (GET), `/api/v1/admin/nhan-vien` (GET), `/api/v1/admin/nhan-vien/:id/approve`, `/api/v1/admin/nhan-vien/:id/reject`.
- **Toàn bộ text hiển thị bằng tiếng Việt**, message lỗi gom vào `src/constants/messages.ts` (be_maxv) — không hardcode chuỗi lỗi rải rác.
- **Follow đúng cấu trúc thư mục hiện có** của từng project (be_maxv: validators/services/controllers/routes tách theo client|admin; fe_maxv & maxv: `features/<name>/{api,hooks,types,components}` + `pages/`).
- **SMTP đã được cấu hình sẵn** trong `be_maxv/.env.local` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `APP_URL`) — không cần thêm bước cấu hình credential, chỉ cần đọc qua `config/env.ts`.
- Mọi lỗi gửi mail là **best-effort** (không throw, không chặn response) — theo đúng pattern `writeLog` đã có.

---

## File Structure Overview

**be_maxv:**
- Modify: `prisma/sys/schema.prisma` (thêm field `lyDoTuChoi`)
- Modify: `src/config/env.ts` (thêm SMTP + APP_URL)
- Create: `src/services/shared/mailer.service.ts`
- Create: `src/scripts/send-test-mail.ts` (script thủ công kiểm tra SMTP)
- Modify: `src/constants/messages.ts` (thêm `NHAN_VIEN`)
- Create: `src/validators/nhanVien.validator.ts`
- Modify: `src/validators/admin.validator.ts` (thêm `listInvitesQuerySchema`, `rejectInviteSchema`)
- Create: `src/services/client/nhanVien.service.ts`
- Create: `src/controllers/client/nhanVien.controller.ts`
- Create: `src/routes/nhanVien.route.ts`
- Modify: `src/routes/index.route.ts` (đăng ký route mới)
- Create: `src/services/admin/adminInvite.service.ts`
- Create: `src/controllers/admin/adminInvite.controller.ts`
- Modify: `src/routes/admin.route.ts` (thêm 3 route)
- Create: `requests/nhan-vien.http`

**fe_maxv:**
- Create: `src/features/employees/types/employee.ts`
- Create: `src/features/employees/api/employeesApi.ts`
- Create: `src/features/employees/hooks/useEmployees.ts`
- Create: `src/pages/EmployeesPage.tsx`
- Modify: `src/config/modules/he-thong.tsx` (thêm tile)
- Modify: `src/pages/ModulesPage.tsx` (wiring)

**maxv:**
- Create: `src/features/invites/types/invite.ts`
- Create: `src/features/invites/api/invitesApi.ts`
- Create: `src/features/invites/hooks/useInvites.ts`
- Create: `src/features/invites/components/InviteStatusChip.tsx`
- Create: `src/features/invites/components/RejectInviteDialog.tsx`
- Create: `src/features/invites/components/ApprovedPasswordDialog.tsx`
- Create: `src/features/invites/components/InvitesTable.tsx`
- Create: `src/pages/invites/InvitesPage.tsx`
- Create: `src/routes/invites.route.tsx`
- Modify: `src/routes/stubs.route.tsx` (xoá `invitesRoute`)
- Modify: `src/routes/index.route.tsx` (đổi import)

---

### Task 1: Prisma schema — thêm `lyDoTuChoi`

**Files:**
- Modify: `be_maxv/prisma/sys/schema.prisma`

**Interfaces:**
- Produces: field `InviteRequest.lyDoTuChoi: string | null` dùng bởi Task 6, 11.

- [ ] **Step 1: Sửa model `InviteRequest`**

Trong `be_maxv/prisma/sys/schema.prisma`, tìm block:
```prisma
model InviteRequest {
  id            String       @id @default(uuid())
  donViId       String // công ty mời
  email         String // email người được mời
  role          Role         @default(KE_TOAN)
  status        InviteStatus @default(PENDING)
  requestedById String // owner gửi yêu cầu
  approvedById  String? // admin duyệt
  createdAt     DateTime     @default(now())
  resolvedAt    DateTime?

  donVi DonVi @relation(fields: [donViId], references: [id], onDelete: Cascade)

  @@index([donViId])
  @@index([status])
  @@map("invite_requests")
}
```
Thay bằng:
```prisma
model InviteRequest {
  id            String       @id @default(uuid())
  donViId       String // công ty mời
  email         String // email người được mời
  role          Role         @default(KE_TOAN)
  status        InviteStatus @default(PENDING)
  requestedById String // owner gửi yêu cầu
  approvedById  String? // admin duyệt (duyệt HOẶC từ chối)
  lyDoTuChoi    String? // lý do admin từ chối, hiển thị cho owner
  createdAt     DateTime     @default(now())
  resolvedAt    DateTime?

  donVi DonVi @relation(fields: [donViId], references: [id], onDelete: Cascade)

  @@index([donViId])
  @@index([status])
  @@map("invite_requests")
}
```

- [ ] **Step 2: Chạy migration**

```bash
cd be_maxv
npm run migrate:sys -- --name add_invite_reject_reason
```

Expected: output kết thúc bằng `Your database is now in sync with your schema.` và Prisma Client được generate lại tự động (dòng `Generated Prisma Client`).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: không có lỗi (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add prisma/sys/schema.prisma prisma/sys/migrations src/generated/sys
git commit -m "feat(db): them field lyDoTuChoi cho InviteRequest"
```

---

### Task 2: Mailer service + cấu hình SMTP

**Files:**
- Modify: `be_maxv/src/config/env.ts`
- Create: `be_maxv/src/services/shared/mailer.service.ts`
- Create: `be_maxv/src/scripts/send-test-mail.ts`
- Modify: `be_maxv/package.json` (thêm dependency `nodemailer`, devDependency `@types/nodemailer`, script `mail:test`)

**Interfaces:**
- Produces: `sendInviteNotifyToAdmins(input)`, `sendApprovedToEmployee(input)` từ `services/shared/mailer.service.ts`, dùng bởi Task 4 và Task 6.
- Produces: `env.smtpHost/smtpPort/smtpUser/smtpPassword/smtpFrom/appUrl` trong `config/env.ts`.

- [ ] **Step 1: Cài nodemailer**

```bash
cd be_maxv
npm install nodemailer
npm install -D @types/nodemailer
```

Expected: `package.json` có thêm `"nodemailer": "^..."` trong `dependencies` và `"@types/nodemailer": "^..."` trong `devDependencies`.

- [ ] **Step 2: Thêm biến môi trường vào `src/config/env.ts`**

Thêm vào cuối object `env` (sau dòng `trialDays: ...`):
```ts
  // SMTP gửi email (mời/duyệt nhân viên) — không bắt buộc để server khởi động
  // được; mailer tự bỏ qua khi thiếu cấu hình (xem mailer.service.ts).
  smtpHost: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'noreply@maxv.local',
  // Base URL của fe_maxv — dùng ghép link đăng nhập trong email nhân viên.
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
```

(`.env.local` đã có sẵn các biến `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `APP_URL` — không cần sửa `.env.local`.)

- [ ] **Step 3: Tạo `src/services/shared/mailer.service.ts`**

```ts
import nodemailer from 'nodemailer';
import { env } from '../../config/env';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: false,
  auth: { user: env.smtpUser, pass: env.smtpPassword },
});

/** Gửi khi owner tạo lời mời mới — tới tất cả email user role=ADMIN. */
export async function sendInviteNotifyToAdmins({
  adminEmails,
  companyName,
  ownerName,
  inviteEmail,
  roleLabel,
}: {
  adminEmails: string[];
  companyName: string;
  ownerName: string;
  inviteEmail: string;
  roleLabel: string;
}): Promise<void> {
  if (adminEmails.length === 0) return;
  await transporter.sendMail({
    from: `"MAXV System" <${env.smtpFrom}>`,
    to: adminEmails.join(','),
    subject: `[MAXV] Yêu cầu mời nhân viên mới — ${companyName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#0f2b5b;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">MAXV — Yêu cầu mời nhân viên</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p style="margin:0 0 16px;color:#374151">Có một yêu cầu mới cần duyệt:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;width:160px;border:1px solid #e5e7eb">Công ty</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(companyName)}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;border:1px solid #e5e7eb">Người yêu cầu</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(ownerName)}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;border:1px solid #e5e7eb">Email nhân viên</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb"><b>${esc(inviteEmail)}</b></td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;border:1px solid #e5e7eb">Vai trò đề xuất</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(roleLabel)}</td></tr>
          </table>
          <div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border-radius:6px;border:1px solid #fde68a;font-size:13px;color:#92400e">
            Vui lòng đăng nhập Admin Panel để duyệt hoặc từ chối yêu cầu này.
          </div>
        </div>
      </div>
    `,
  });
}

/** Gửi khi admin duyệt — mật khẩu tạm cho nhân viên. */
export async function sendApprovedToEmployee({
  email,
  companyName,
  tempPassword,
  loginUrl,
}: {
  email: string;
  companyName: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<void> {
  await transporter.sendMail({
    from: `"MAXV" <${env.smtpFrom}>`,
    to: email,
    subject: `Bạn đã được thêm vào ${companyName} trên MAXV`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#0a3d91,#0078ff);padding:28px 24px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">MAXV</h1>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:28px 24px;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 16px;font-size:17px;color:#1a2744">Xin chào!</h2>
          <p style="color:#374151;line-height:1.7;margin:0 0 20px">
            Bạn đã được thêm vào công ty <b>${esc(companyName)}</b> trên hệ thống MAXV.<br>
            Dưới đây là thông tin đăng nhập của bạn:
          </p>
          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;margin-bottom:20px">
            <div style="margin-bottom:12px">
              <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Email đăng nhập</div>
              <div style="font-size:15px;color:#1a2744;margin-top:4px;font-weight:500">${esc(email)}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Mật khẩu tạm thời</div>
              <div style="font-size:20px;color:#1e4d91;margin-top:4px;font-weight:800;font-family:monospace;letter-spacing:2px">${esc(tempPassword)}</div>
            </div>
          </div>
          <a href="${esc(loginUrl)}" style="display:block;background:#1e4d91;color:#fff;text-decoration:none;text-align:center;padding:13px;border-radius:8px;font-weight:700;font-size:14px">
            Đăng nhập ngay →
          </a>
          <p style="margin-top:16px;font-size:12px;color:#9ca3af;line-height:1.6">
            Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.
          </p>
        </div>
      </div>
    `,
  });
}
```

- [ ] **Step 4: Tạo script kiểm tra thủ công `src/scripts/send-test-mail.ts`**

```ts
import { sendApprovedToEmployee } from '../services/shared/mailer.service';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Dùng: npm run mail:test -- <email nhận>');
    process.exit(1);
  }
  await sendApprovedToEmployee({
    email: to,
    companyName: 'Công ty demo',
    tempPassword: 'Test1234',
    loginUrl: 'http://localhost:5173/login',
  });
  console.log('Đã gửi email thử tới', to);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Thêm vào `package.json` → `scripts`:
```json
    "mail:test": "dotenv -e .env.local -- tsx src/scripts/send-test-mail.ts",
```

- [ ] **Step 5: Chạy thử gửi mail thật**

```bash
npm run mail:test -- vinhnd203@gmail.com
```

Expected: console in `Đã gửi email thử tới vinhnd203@gmail.com`, không có lỗi ném ra; kiểm tra hộp thư `vinhnd203@gmail.com` nhận được mail "Bạn đã được thêm vào Công ty demo trên MAXV".

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/config/env.ts src/services/shared/mailer.service.ts src/scripts/send-test-mail.ts package.json package-lock.json
git commit -m "feat: them mailer service (nodemailer) cho luong moi/duyet nhan vien"
```

---

### Task 3: Messages + validators

**Files:**
- Modify: `be_maxv/src/constants/messages.ts`
- Create: `be_maxv/src/validators/nhanVien.validator.ts`
- Modify: `be_maxv/src/validators/admin.validator.ts`

**Interfaces:**
- Produces: `MESSAGES.NHAN_VIEN.{EMAIL_TAKEN,NO_COMPANY,INVITE_NOT_FOUND,INVITE_NOT_PENDING,PENDING_USER_MISSING}`.
- Produces: `inviteEmployeeSchema` + type `InviteEmployeeInput` (`nhanVien.validator.ts`) dùng bởi Task 4/5.
- Produces: `listInvitesQuerySchema` + type `ListInvitesQuery`, `rejectInviteSchema` + type `RejectInviteInput` (`admin.validator.ts`) dùng bởi Task 6/7.

- [ ] **Step 1: Thêm `NHAN_VIEN` vào `src/constants/messages.ts`**

Thêm block sau `SUBSCRIPTION` (trước `VALIDATION`):
```ts
  NHAN_VIEN: {
    EMAIL_TAKEN: 'Email này đã có tài khoản trong hệ thống',
    NO_COMPANY: 'Bạn chưa tạo công ty',
    INVITE_NOT_FOUND: 'Không tìm thấy lời mời',
    INVITE_NOT_PENDING: 'Lời mời đã được xử lý',
    PENDING_USER_MISSING:
      'Không tìm thấy tài khoản nhân viên tương ứng (dữ liệu không nhất quán)',
  },
```

- [ ] **Step 2: Tạo `src/validators/nhanVien.validator.ts`**

```ts
import { z } from 'zod';

const INVITE_ROLES = ['KE_TOAN_TRUONG', 'KE_TOAN', 'XEM'] as const;

export const inviteEmployeeSchema = z.object({
  email: z.string().email(),
  role: z.enum(INVITE_ROLES),
});

export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;
```

- [ ] **Step 3: Thêm vào `src/validators/admin.validator.ts`**

Thêm cuối file (trước dòng cuối `export type ChangePlanInput = ...`, hoặc ngay sau `changePlanSchema`), block:
```ts
// ---- Mời & duyệt nhân viên (invite_requests) ----
export const listInvitesQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const rejectInviteSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});
```

Và thêm 2 dòng export type ở cuối file (cạnh các `export type` khác):
```ts
export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;
export type RejectInviteInput = z.infer<typeof rejectInviteSchema>;
```

- [ ] **Step 4: Typecheck + commit**

```bash
npm run typecheck
git add src/constants/messages.ts src/validators/nhanVien.validator.ts src/validators/admin.validator.ts
git commit -m "feat: them message + validator cho moi/duyet nhan vien"
```

---

### Task 4: Owner-side service (`nhanVien.service.ts`)

**Files:**
- Create: `be_maxv/src/services/client/nhanVien.service.ts`

**Interfaces:**
- Consumes: `sysPrisma` (`config/db.sys`), `generatePassword`/`hashPassword` (`utils/password`), `sendInviteNotifyToAdmins` (Task 2), `writeLog` (`services/shared/syslog.service`), `ConflictError` (`helpers/errors`), `MESSAGES.NHAN_VIEN` (Task 3), `InviteEmployeeInput` (Task 3).
- Produces: `inviteEmployee(donViId: string, ownerId: string, input: InviteEmployeeInput): Promise<{id,email,role,status,createdAt}>`, `listEmployees(donViId: string): Promise<Array<{id,email,hoTen,role,status,isActive,createdAt}>>` — dùng bởi Task 5.

- [ ] **Step 1: Tạo file**

```ts
import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { sendInviteNotifyToAdmins } from '../shared/mailer.service';
import { writeLog } from '../shared/syslog.service';
import { ConflictError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';
import type { InviteEmployeeInput } from '../../validators/nhanVien.validator';

const ROLE_LABELS: Record<string, string> = {
  KE_TOAN_TRUONG: 'Kế toán trưởng',
  KE_TOAN: 'Kế toán',
  XEM: 'Chỉ xem',
};

const EMPLOYEE_SELECT = {
  id: true,
  email: true,
  hoTen: true,
  role: true,
  status: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * POST /api/v1/nhan-vien/invite — owner mời nhân viên mới.
 * Tạo NGAY User(status=PENDING, isActive=false) + InviteRequest(status=PENDING)
 * trong 1 transaction. KHÔNG sinh/gửi mật khẩu thật ở bước này.
 */
export async function inviteEmployee(
  donViId: string,
  ownerId: string,
  input: InviteEmployeeInput,
) {
  const { email, role } = input;

  const existing = await sysPrisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError(MESSAGES.NHAN_VIEN.EMAIL_TAKEN);

  const hoTen = email.split('@')[0].toUpperCase();
  // Hash ngẫu nhiên KHÔNG dùng được — chỉ để chỗ cho tới khi admin duyệt.
  const dummyPassword = await hashPassword(generatePassword());

  const invite = await sysPrisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        email,
        hoTen,
        password: dummyPassword,
        role,
        status: 'PENDING',
        isActive: false,
        donViId,
      },
    });
    return tx.inviteRequest.create({
      data: { donViId, email, role, requestedById: ownerId, status: 'PENDING' },
    });
  });

  const [donVi, owner, admins] = await Promise.all([
    sysPrisma.donVi.findUnique({ where: { id: donViId }, select: { tenDonVi: true } }),
    sysPrisma.user.findUnique({ where: { id: ownerId }, select: { hoTen: true } }),
    sysPrisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
  ]);

  await sendInviteNotifyToAdmins({
    adminEmails: admins.map((a) => a.email),
    companyName: donVi?.tenDonVi ?? 'Không rõ',
    ownerName: owner?.hoTen ?? 'Không rõ',
    inviteEmail: email,
    roleLabel: ROLE_LABELS[role] ?? role,
  }).catch(() => undefined);

  await writeLog({
    hanhDong: 'CREATE_INVITE',
    userId: ownerId,
    donViId,
    chiTiet: { email, role },
  });

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt,
  };
}

/** GET /api/v1/nhan-vien — danh sách nhân viên (User) của công ty mình. */
export async function listEmployees(donViId: string) {
  return sysPrisma.user.findMany({
    where: { donViId },
    select: EMPLOYEE_SELECT,
    orderBy: { createdAt: 'asc' },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/services/client/nhanVien.service.ts
git commit -m "feat: them service moi nhan vien (owner)"
```

---

### Task 5: Owner-side controller + route

**Files:**
- Create: `be_maxv/src/controllers/client/nhanVien.controller.ts`
- Create: `be_maxv/src/routes/nhanVien.route.ts`
- Modify: `be_maxv/src/routes/index.route.ts`

**Interfaces:**
- Consumes: `inviteEmployee`, `listEmployees` (Task 4); `inviteEmployeeSchema` (Task 3); `app.authenticate`, `app.requireRole` (đã có, `plugins/jwt.plugin.ts`).
- Produces: route `POST /api/v1/nhan-vien/invite`, `GET /api/v1/nhan-vien` — dùng bởi fe_maxv (Task 9).

- [ ] **Step 1: Tạo `src/controllers/client/nhanVien.controller.ts`**

```ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { inviteEmployeeSchema } from '../../validators/nhanVien.validator';
import { inviteEmployee, listEmployees } from '../../services/client/nhanVien.service';
import { validateBody } from '../../utils/validate';
import { sendCreated, sendOk } from '../../helpers/response';
import { ForbiddenError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';

/** POST /api/v1/nhan-vien/invite */
export async function createInvite(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.donViId) throw new ForbiddenError(MESSAGES.NHAN_VIEN.NO_COMPANY);
  const input = validateBody(inviteEmployeeSchema, req.body);
  const data = await inviteEmployee(req.user.donViId, req.user.userId, input);
  return sendCreated(reply, data);
}

/** GET /api/v1/nhan-vien */
export async function getEmployees(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.donViId) throw new ForbiddenError(MESSAGES.NHAN_VIEN.NO_COMPANY);
  return sendOk(reply, await listEmployees(req.user.donViId));
}
```

- [ ] **Step 2: Tạo `src/routes/nhanVien.route.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { createInvite, getEmployees } from '../controllers/client/nhanVien.controller';

/** Route quản lý nhân viên phía chủ đơn vị (OWNER). */
export async function nhanVienRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('OWNER'));

  app.post('/invite', createInvite);
  app.get('/', getEmployees);
}
```

- [ ] **Step 3: Đăng ký route trong `src/routes/index.route.ts`**

Thay nội dung file bằng:
```ts
import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.route';
import { companyRoutes } from './company.route';
import { nhanVienRoutes } from './nhanVien.route';
import { adminRoutes } from './admin.route';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(companyRoutes, { prefix: '/api/v1/companies' });
  await app.register(nhanVienRoutes, { prefix: '/api/v1/nhan-vien' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
}
```

- [ ] **Step 4: Typecheck + khởi động server thử**

```bash
npm run typecheck
```

Expected: 0 lỗi.

```bash
npm run dev
```

Expected log: server khởi động không lỗi ở port 4000 (`Server listening at http://...:4000` hoặc tương đương). Dừng lại (Ctrl+C) sau khi xác nhận, không cần để chạy nền cho bước này.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/client/nhanVien.controller.ts src/routes/nhanVien.route.ts src/routes/index.route.ts
git commit -m "feat: them API POST/GET /api/v1/nhan-vien (owner moi nhan vien)"
```

---

### Task 6: Admin-side service (`adminInvite.service.ts`)

**Files:**
- Create: `be_maxv/src/services/admin/adminInvite.service.ts`

**Interfaces:**
- Consumes: `sysPrisma`, `generatePassword`/`hashPassword`, `sendApprovedToEmployee` (Task 2), `writeLog`, `ConflictError`/`NotFoundError`, `MESSAGES.NHAN_VIEN`, `env.appUrl` (Task 2), `ListInvitesQuery` (Task 3).
- Produces: `adminListInvites(query): Promise<{data, total, page, pageSize}>`, `adminApproveInvite(id, adminId): Promise<{email, password}>`, `adminRejectInvite(id, adminId, reason?): Promise<{id, status:'REJECTED'}>` — dùng bởi Task 7.

- [ ] **Step 1: Tạo file**

```ts
import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { sendApprovedToEmployee } from '../shared/mailer.service';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import { env } from '../../config/env';
import type { Prisma } from '../../generated/sys';
import type { ListInvitesQuery } from '../../validators/admin.validator';

async function getInviteOrThrow(id: string) {
  const invite = await sysPrisma.inviteRequest.findUnique({
    where: { id },
    include: { donVi: { select: { id: true, maSoThue: true, tenDonVi: true } } },
  });
  if (!invite) throw new NotFoundError(MESSAGES.NHAN_VIEN.INVITE_NOT_FOUND);
  return invite;
}

/** GET /api/v1/admin/nhan-vien */
export async function adminListInvites(query: ListInvitesQuery) {
  const { status, page, pageSize } = query;
  const where: Prisma.InviteRequestWhereInput = status ? { status } : {};

  const [rows, total] = await Promise.all([
    sysPrisma.inviteRequest.findMany({
      where,
      include: { donVi: { select: { id: true, maSoThue: true, tenDonVi: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    sysPrisma.inviteRequest.count({ where }),
  ]);

  const requesterIds = [...new Set(rows.map((r) => r.requestedById))];
  const requesters = await sysPrisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, hoTen: true },
  });
  const requesterMap = new Map(requesters.map((r) => [r.id, r.hoTen]));

  const data = rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    lyDoTuChoi: r.lyDoTuChoi,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    donVi: r.donVi,
    requestedBy: { id: r.requestedById, hoTen: requesterMap.get(r.requestedById) ?? '—' },
  }));

  return { data, total, page, pageSize };
}

/** POST /api/v1/admin/nhan-vien/:id/approve */
export async function adminApproveInvite(id: string, adminId: string) {
  const invite = await getInviteOrThrow(id);
  if (invite.status !== 'PENDING') {
    throw new ConflictError(MESSAGES.NHAN_VIEN.INVITE_NOT_PENDING);
  }

  const pendingUser = await sysPrisma.user.findUnique({ where: { email: invite.email } });
  if (!pendingUser) throw new ConflictError(MESSAGES.NHAN_VIEN.PENDING_USER_MISSING);

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await sysPrisma.$transaction([
    sysPrisma.user.update({
      where: { id: pendingUser.id },
      data: { password: passwordHash, status: 'ACTIVE', isActive: true },
    }),
    sysPrisma.inviteRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: adminId, resolvedAt: new Date() },
    }),
  ]);

  await sendApprovedToEmployee({
    email: invite.email,
    companyName: invite.donVi.tenDonVi,
    tempPassword: password,
    loginUrl: `${env.appUrl}/login`,
  }).catch(() => undefined);

  await writeLog({
    hanhDong: 'APPROVE_INVITE',
    userId: adminId,
    donViId: invite.donViId,
    chiTiet: { email: invite.email },
  });

  return { email: invite.email, password };
}

/** POST /api/v1/admin/nhan-vien/:id/reject */
export async function adminRejectInvite(id: string, adminId: string, reason?: string) {
  const invite = await getInviteOrThrow(id);
  if (invite.status !== 'PENDING') {
    throw new ConflictError(MESSAGES.NHAN_VIEN.INVITE_NOT_PENDING);
  }

  await sysPrisma.$transaction([
    sysPrisma.user.updateMany({
      where: { email: invite.email, donViId: invite.donViId },
      data: { status: 'REJECTED' },
    }),
    sysPrisma.inviteRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        lyDoTuChoi: reason,
        approvedById: adminId,
        resolvedAt: new Date(),
      },
    }),
  ]);

  await writeLog({
    hanhDong: 'REJECT_INVITE',
    userId: adminId,
    donViId: invite.donViId,
    chiTiet: { email: invite.email, reason },
  });

  return { id, status: 'REJECTED' as const };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/services/admin/adminInvite.service.ts
git commit -m "feat: them service duyet/tu choi loi moi nhan vien (admin)"
```

---

### Task 7: Admin-side controller + route

**Files:**
- Create: `be_maxv/src/controllers/admin/adminInvite.controller.ts`
- Modify: `be_maxv/src/routes/admin.route.ts`

**Interfaces:**
- Consumes: `adminListInvites`, `adminApproveInvite`, `adminRejectInvite` (Task 6); `idParamSchema` (đã có), `listInvitesQuerySchema`, `rejectInviteSchema` (Task 3).
- Produces: route `GET /api/v1/admin/nhan-vien`, `POST /api/v1/admin/nhan-vien/:id/approve`, `POST /api/v1/admin/nhan-vien/:id/reject` — dùng bởi maxv (Task 11).

- [ ] **Step 1: Tạo `src/controllers/admin/adminInvite.controller.ts`**

```ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  idParamSchema,
  listInvitesQuerySchema,
  rejectInviteSchema,
} from '../../validators/admin.validator';
import {
  adminListInvites,
  adminApproveInvite,
  adminRejectInvite,
} from '../../services/admin/adminInvite.service';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../utils/validate';
import { sendOk } from '../../helpers/response';

/** GET /api/v1/admin/nhan-vien */
export async function listInvites(req: FastifyRequest, reply: FastifyReply) {
  const query = validateQuery(listInvitesQuerySchema, req.query);
  return sendOk(reply, await adminListInvites(query));
}

/** POST /api/v1/admin/nhan-vien/:id/approve */
export async function approveInvite(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminApproveInvite(id, req.user.userId));
}

/** POST /api/v1/admin/nhan-vien/:id/reject */
export async function rejectInvite(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  const { reason } = validateBody(rejectInviteSchema, req.body);
  return sendOk(reply, await adminRejectInvite(id, req.user.userId, reason));
}
```

- [ ] **Step 2: Sửa `src/routes/admin.route.ts`**

Thêm import (cạnh các import controller khác):
```ts
import {
  listInvites,
  approveInvite,
  rejectInvite,
} from '../controllers/admin/adminInvite.controller';
```

Thêm route (trong hàm `adminRoutes`, sau nhóm "Nhật ký hệ thống" — vị trí không quan trọng, miễn trong hàm này):
```ts
  // Mời & duyệt nhân viên
  app.get('/nhan-vien', listInvites);
  app.post('/nhan-vien/:id/approve', approveInvite);
  app.post('/nhan-vien/:id/reject', rejectInvite);
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add src/controllers/admin/adminInvite.controller.ts src/routes/admin.route.ts
git commit -m "feat: them API admin duyet/tu choi loi moi nhan vien"
```

---

### Task 8: Xác minh end-to-end (be_maxv)

**Files:**
- Create: `be_maxv/requests/nhan-vien.http`

**Interfaces:**
- Consumes: toàn bộ endpoint Task 5 + Task 7.

- [ ] **Step 1: Tạo `requests/nhan-vien.http`**

```http
### =============================================================
###  Test API mời/duyệt nhân viên — dùng với extension "REST Client" (VS Code)
###  Chạy LOGIN OWNER + LOGIN ADMIN trước.
### =============================================================

@base = http://localhost:4000/api/v1

# Tài khoản OWNER đã có công ty (tạo qua /auth/register + /companies):
@ownerEmail = owner-test@maxv.local
@ownerPassword = Test1234

# Tài khoản ADMIN đã có sẵn trong DB:
@adminEmail = admin@gmail.com
@adminPassword = Vinhpham981@

### Đăng nhập owner
# @name loginOwner
POST {{base}}/auth/login
Content-Type: application/json

{ "email": "{{ownerEmail}}", "password": "{{ownerPassword}}" }

### Token owner
@ownerToken = {{loginOwner.response.body.$.data.accessToken}}

### Owner mời nhân viên
# @name invite
POST {{base}}/nhan-vien/invite
Authorization: Bearer {{ownerToken}}
Content-Type: application/json

{ "email": "nv-test@maxv.local", "role": "KE_TOAN" }

### Owner xem danh sách nhân viên (kỳ vọng có nv-test@maxv.local, status=PENDING)
GET {{base}}/nhan-vien
Authorization: Bearer {{ownerToken}}

### Owner mời lại đúng email vừa mời -> 409 (email đã tồn tại)
POST {{base}}/nhan-vien/invite
Authorization: Bearer {{ownerToken}}
Content-Type: application/json

{ "email": "nv-test@maxv.local", "role": "KE_TOAN" }

### Đăng nhập admin
# @name loginAdmin
POST {{base}}/auth/login
Content-Type: application/json

{ "email": "{{adminEmail}}", "password": "{{adminPassword}}" }

### Token admin
@adminToken = {{loginAdmin.response.body.$.data.accessToken}}

### Admin xem danh sách lời mời (kỳ vọng thấy nv-test@maxv.local, status=PENDING)
GET {{base}}/admin/nhan-vien?status=PENDING
Authorization: Bearer {{adminToken}}

### Admin duyệt lời mời — copy "id" từ response trên vào đây
@inviteId = PASTE_INVITE_ID_HERE
POST {{base}}/admin/nhan-vien/{{inviteId}}/approve
Authorization: Bearer {{adminToken}}

### Nhân viên đăng nhập bằng mật khẩu vừa được trả về ở bước approve
POST {{base}}/auth/login
Content-Type: application/json

{ "email": "nv-test@maxv.local", "password": "PASTE_PASSWORD_HERE" }

### --- Luồng từ chối (tạo 1 invite khác để test) ---

### Owner mời nhân viên thứ 2
# @name invite2
POST {{base}}/nhan-vien/invite
Authorization: Bearer {{ownerToken}}
Content-Type: application/json

{ "email": "nv-tuchoi@maxv.local", "role": "XEM" }

### Admin từ chối — copy "id" từ response invite2 vào đây
@inviteId2 = PASTE_INVITE2_ID_HERE
POST {{base}}/admin/nhan-vien/{{inviteId2}}/reject
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{ "reason": "Không đúng đối tượng" }

### Nhân viên bị từ chối đăng nhập -> 401 (isActive vẫn false)
POST {{base}}/auth/login
Content-Type: application/json

{ "email": "nv-tuchoi@maxv.local", "password": "bat-ky" }

### --- Kiểm tra guard ---

### Nhân viên (không phải OWNER) gọi /nhan-vien/invite -> 403
POST {{base}}/nhan-vien/invite
Authorization: Bearer faketoken
Content-Type: application/json

{ "email": "x@x.com", "role": "XEM" }

### User thường gọi /admin/nhan-vien -> 403
GET {{base}}/admin/nhan-vien
Authorization: Bearer {{ownerToken}}
```

- [ ] **Step 2: Chạy smoke test bằng curl (thay thế thao tác REST Client)**

Chuẩn bị: đảm bảo có 1 tài khoản OWNER đã có công ty (dùng `/auth/register` + `/api/v1/companies` có sẵn, hoặc tài khoản OWNER đã tồn tại trong DB test) và 1 tài khoản ADMIN đã có trong DB. Khởi động server:

```bash
cd be_maxv
npm run dev
```

Trong terminal khác, thay `<OWNER_EMAIL>`/`<OWNER_PASSWORD>`/`<ADMIN_EMAIL>`/`<ADMIN_PASSWORD>` bằng tài khoản thật của bạn:

```bash
OWNER_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<OWNER_EMAIL>","password":"<OWNER_PASSWORD>"}' | \
  node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).data.accessToken))")

curl -s -X POST http://localhost:4000/api/v1/nhan-vien/invite \
  -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"nv-smoke@maxv.local","role":"KE_TOAN"}'
```

Expected: JSON `{"success":true,"data":{"id":"...","email":"nv-smoke@maxv.local","role":"KE_TOAN","status":"PENDING","createdAt":"..."}}` — **không có field `password` trong response**.

```bash
curl -s http://localhost:4000/api/v1/nhan-vien -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected: mảng chứa `nv-smoke@maxv.local` với `"status":"PENDING","isActive":false`.

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}' | \
  node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).data.accessToken))")

curl -s "http://localhost:4000/api/v1/admin/nhan-vien?status=PENDING" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected: thấy `nv-smoke@maxv.local` kèm `donVi.tenDonVi` và `requestedBy.hoTen` đúng tên owner. Lấy `id` của bản ghi này gán vào biến `INVITE_ID`:

```bash
INVITE_ID="<paste id from above>"
curl -s -X POST "http://localhost:4000/api/v1/admin/nhan-vien/$INVITE_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected: `{"success":true,"data":{"email":"nv-smoke@maxv.local","password":"<12 ký tự>"}}`. Kiểm tra hộp thư `nv-smoke@maxv.local` KHÔNG tồn tại thật nên bỏ qua bước nhận mail — thay vào đó xác nhận đăng nhập được bằng mật khẩu vừa trả về:

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nv-smoke@maxv.local","password":"<password vừa lấy>"}'
```

Expected: `success:true`, có `accessToken` — xác nhận `isActive=true` sau approve.

- [ ] **Step 3: Commit**

```bash
git add requests/nhan-vien.http
git commit -m "docs: them request mau kiem tra luong moi/duyet nhan vien"
```

---

### Task 9: fe_maxv — `features/employees` (types + api + hooks)

**Files:**
- Create: `fe_maxv/src/features/employees/types/employee.ts`
- Create: `fe_maxv/src/features/employees/api/employeesApi.ts`
- Create: `fe_maxv/src/features/employees/hooks/useEmployees.ts`

**Interfaces:**
- Consumes: `api` từ `@/lib/apiClient` (đã có).
- Produces: `Employee`, `InviteEmployeeInput`, `InviteResult`, `INVITE_ROLES`, `ROLE_LABELS`, `STATUS_LABELS` (types), `listEmployees()`, `inviteEmployee(input)` (api), `useEmployees()`, `useInviteEmployee()` (hooks) — dùng bởi Task 10.

- [ ] **Step 1: Tạo `types/employee.ts`**

```ts
export type EmployeeRole = 'OWNER' | 'KE_TOAN_TRUONG' | 'KE_TOAN' | 'XEM';
export type EmployeeStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface Employee {
  id: string;
  email: string;
  hoTen: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  isActive: boolean;
  createdAt: string;
}

export type InviteRole = 'KE_TOAN_TRUONG' | 'KE_TOAN' | 'XEM';

export interface InviteEmployeeInput {
  email: string;
  role: InviteRole;
}

export interface InviteResult {
  id: string;
  email: string;
  role: InviteRole;
  status: 'PENDING';
  createdAt: string;
}

export const INVITE_ROLES: InviteRole[] = ['KE_TOAN_TRUONG', 'KE_TOAN', 'XEM'];

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  OWNER: 'Chủ đơn vị',
  KE_TOAN_TRUONG: 'Kế toán trưởng',
  KE_TOAN: 'Kế toán',
  XEM: 'Chỉ xem',
};

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  PENDING: 'Chờ duyệt',
  ACTIVE: 'Đang hoạt động',
  REJECTED: 'Từ chối',
};
```

- [ ] **Step 2: Tạo `api/employeesApi.ts`**

```ts
import { api } from '@/lib/apiClient';
import type {
  Employee,
  InviteEmployeeInput,
  InviteResult,
} from '@/features/employees/types/employee';

export function listEmployees(): Promise<Employee[]> {
  return api.get<Employee[]>('/nhan-vien');
}

export function inviteEmployee(input: InviteEmployeeInput): Promise<InviteResult> {
  return api.post<InviteResult>('/nhan-vien/invite', input);
}
```

- [ ] **Step 3: Tạo `hooks/useEmployees.ts`**

```ts
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { listEmployees, inviteEmployee } from '@/features/employees/api/employeesApi';
import type { InviteEmployeeInput } from '@/features/employees/types/employee';

export const employeeKeys = { all: ['employees'] as const };

export function useEmployees() {
  return useSuspenseQuery({
    queryKey: employeeKeys.all,
    queryFn: listEmployees,
  });
}

export function useInviteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteEmployeeInput) => inviteEmployee(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd fe_maxv
npx tsc -b --noEmit
git add src/features/employees
git commit -m "feat: them api/hooks quan ly nhan vien (fe_maxv)"
```

---

### Task 10: fe_maxv — `EmployeesPage` + wiring vào module Hệ thống

**Files:**
- Create: `fe_maxv/src/pages/EmployeesPage.tsx`
- Modify: `fe_maxv/src/config/modules/he-thong.tsx`
- Modify: `fe_maxv/src/pages/ModulesPage.tsx`

**Interfaces:**
- Consumes: `useEmployees`, `useInviteEmployee`, types từ Task 9; `getApiError` từ `@/lib/apiClient` (đã có).
- Produces: component `EmployeesPage({ onBack }: { onBack: () => void })` mặc định export.

- [ ] **Step 1: Tạo `src/pages/EmployeesPage.tsx`**

```tsx
import { Suspense, useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { getApiError } from '@/lib/apiClient';
import { useEmployees, useInviteEmployee } from '@/features/employees/hooks/useEmployees';
import {
  INVITE_ROLES,
  ROLE_LABELS,
  STATUS_LABELS,
  type Employee,
  type InviteRole,
} from '@/features/employees/types/employee';

interface Props {
  onBack: () => void;
}

const STATUS_COLOR: Record<Employee['status'], 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  REJECTED: 'error',
};

function InviteDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { mutate, isPending, error } = useInviteEmployee();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('KE_TOAN');

  function submit(): void {
    mutate({ email, role }, { onSuccess: onClose });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mời nhân viên</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error">{getApiError(error)}</Alert>}
          <TextField
            label="Email nhân viên"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            select
            label="Vai trò"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            fullWidth
          >
            {INVITE_ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy
        </Button>
        <Button variant="contained" onClick={submit} disabled={isPending || !email.trim()}>
          {isPending ? 'Đang gửi…' : 'Gửi lời mời'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EmployeesTable(): JSX.Element {
  const { data } = useEmployees();
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Họ tên</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Vai trò</TableCell>
            <TableCell>Trạng thái</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((e) => (
            <TableRow key={e.id} hover>
              <TableCell>{e.hoTen}</TableCell>
              <TableCell>{e.email}</TableCell>
              <TableCell>{ROLE_LABELS[e.role]}</TableCell>
              <TableCell>
                <Chip size="small" label={STATUS_LABELS[e.status]} color={STATUS_COLOR[e.status]} />
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                Chưa có nhân viên nào
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function EmployeesPage({ onBack }: Props): JSX.Element {
  const [inviting, setInviting] = useState(false);

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button onClick={onBack} color="inherit">
            ← Quay lại
          </Button>
          <Typography variant="h6">Quản lý nhân viên</Typography>
        </Stack>
        <Button variant="contained" onClick={() => setInviting(true)}>
          Mời nhân viên
        </Button>
      </Stack>

      <Suspense fallback={<Typography color="text.secondary">Đang tải…</Typography>}>
        <EmployeesTable />
      </Suspense>

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </Box>
  );
}
```

- [ ] **Step 2: Thêm tile vào `src/config/modules/he-thong.tsx`**

Trong mảng `danhMuc`, thêm 1 phần tử mới ở đầu mảng:
```tsx
  danhMuc: [
    { left:  { label: 'Quản lý nhân viên', path: '/he-thong/nhan-vien' } },
    { left:  { label: 'Danh mục quyền chứng từ',                         path: '/he-thong/danh_muc/quyen-chung-tu' },
      right: { label: 'Phân quyền NSD quyền chứng từ',                   path: '/he-thong/danh_muc/phan-quyen-nsd' } },
    { left:  { label: 'Khóa số liệu',                                    path: '/he-thong/danh_muc/khoa-so-lieu' },
      right: { label: 'Khóa số liệu theo đơn vị',                        path: '/he-thong/danh_muc/khoa-so-lieu-don-vi' } },
    { left:  { label: 'Khóa số liệu theo chứng từ',                      path: '/he-thong/danh_muc/khoa-so-lieu-chung-tu' },
      right: { label: 'Kiểm tra số liệu giữa sổ tài khoản và sổ kho',    path: '/he-thong/danh_muc/kiem-tra-so-kho' } },
    { left:  { label: 'Kiểm tra số liệu giữa sổ tài khoản và sổ thuế',   path: '/he-thong/danh_muc/kiem-tra-so-thue' },
      right: { label: 'Kiểm tra khai báo mẫu bảng cân đối kế toán',      path: '/he-thong/danh_muc/kiem-tra-bang-can-doi' } },
  ],
```

- [ ] **Step 3: Sửa `src/pages/ModulesPage.tsx`**

Thay toàn bộ nội dung file bằng:
```tsx
import { useState, type JSX } from 'react';
import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ModulePage from '../components/ModulePage';
import EmployeesPage from './EmployeesPage';
import { MODULES, MODULE_ORDER } from '../config/modules';

interface Props {
  onLogout: () => void;
}

const EMPLOYEES_PATH = '/he-thong/nhan-vien';

export default function ModulesPage({ onLogout }: Props): JSX.Element {
  const [active, setActive] = useState<string>(MODULE_ORDER[0].slug);
  const [view, setView] = useState<'tiles' | typeof EMPLOYEES_PATH>('tiles');
  const config = MODULES[active];

  function handleNavigate(path: string): void {
    if (path === EMPLOYEES_PATH) setView(EMPLOYEES_PATH);
  }

  function selectModule(slug: string): void {
    setActive(slug);
    setView('tiles');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={onLogout} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active={active} onSelect={selectModule} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === EMPLOYEES_PATH ? (
            <EmployeesPage onBack={() => setView('tiles')} />
          ) : (
            <ModulePage config={config} onNavigate={handleNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
cd fe_maxv
npx tsc -b --noEmit
```

Expected: 0 lỗi.

- [ ] **Step 5: Kiểm tra trên trình duyệt**

Khởi động `be_maxv` (`npm run dev`, port 4000) và `fe_maxv` (`npm run dev`, port 5173). Đăng nhập bằng 1 tài khoản OWNER đã có công ty → vào module "Hệ thống" → click "Quản lý nhân viên".

Expected quan sát được:
- Hiện trang "Quản lý nhân viên" với ít nhất 1 dòng (chính owner đang đăng nhập, vai trò "Chủ đơn vị").
- Click "Mời nhân viên" → điền email mới + chọn vai trò → "Gửi lời mời" → dialog đóng, bảng có thêm dòng mới với trạng thái "Chờ duyệt".
- Mời lại đúng email đó lần 2 → hiện `Alert` lỗi đỏ "Email này đã có tài khoản trong hệ thống".
- Click "← Quay lại" → về lại lưới tile module Hệ thống.

- [ ] **Step 6: Commit**

```bash
git add src/pages/EmployeesPage.tsx src/config/modules/he-thong.tsx src/pages/ModulesPage.tsx
git commit -m "feat: them trang quan ly nhan vien trong module He thong (fe_maxv)"
```

---

### Task 11: maxv — `features/invites` (types + api + hooks)

**Files:**
- Create: `maxv/src/features/invites/types/invite.ts`
- Create: `maxv/src/features/invites/api/invitesApi.ts`
- Create: `maxv/src/features/invites/hooks/useInvites.ts`

**Interfaces:**
- Consumes: `api` từ `@/lib/apiClient`, `Paginated<T>` từ `@/types/api` (đã có).
- Produces: `AdminInvite`, `ListInvitesParams`, `ROLE_LABELS`, `STATUS_LABELS` (types); `listInvites`, `approveInvite`, `rejectInvite` (api); `useInvites`, `useApproveInvite`, `useRejectInvite` (hooks) — dùng bởi Task 12/13.

- [ ] **Step 1: Tạo `types/invite.ts`**

```ts
export type InviteRole = 'KE_TOAN_TRUONG' | 'KE_TOAN' | 'XEM';
export type InviteStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminInvite {
  id: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  lyDoTuChoi: string | null;
  createdAt: string;
  resolvedAt: string | null;
  donVi: { id: string; maSoThue: string; tenDonVi: string };
  requestedBy: { id: string; hoTen: string };
}

export interface ListInvitesParams {
  status?: InviteStatus;
  page?: number;
  pageSize?: number;
}

export const ROLE_LABELS: Record<InviteRole, string> = {
  KE_TOAN_TRUONG: 'Kế toán trưởng',
  KE_TOAN: 'Kế toán',
  XEM: 'Chỉ xem',
};

export const STATUS_LABELS: Record<InviteStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};
```

- [ ] **Step 2: Tạo `api/invitesApi.ts`**

```ts
import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type { AdminInvite, ListInvitesParams } from '@/features/invites/types/invite';

export function listInvites(params: ListInvitesParams): Promise<Paginated<AdminInvite>> {
  return api.get<Paginated<AdminInvite>>('/admin/nhan-vien', { params });
}

export function approveInvite(id: string): Promise<{ email: string; password: string }> {
  return api.post<{ email: string; password: string }>(`/admin/nhan-vien/${id}/approve`);
}

export function rejectInvite(id: string, reason?: string): Promise<AdminInvite> {
  return api.post<AdminInvite>(`/admin/nhan-vien/${id}/reject`, { reason });
}
```

- [ ] **Step 3: Tạo `hooks/useInvites.ts`**

```ts
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listInvites,
  approveInvite,
  rejectInvite,
} from '@/features/invites/api/invitesApi';
import type { ListInvitesParams } from '@/features/invites/types/invite';

export const inviteKeys = {
  all: ['invites'] as const,
  list: (p: ListInvitesParams) => [...inviteKeys.all, 'list', p] as const,
};

export function useInvites(params: ListInvitesParams) {
  return useSuspenseQuery({
    queryKey: inviteKeys.list(params),
    queryFn: () => listInvites(params),
  });
}

function useInvalidateInvites() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: inviteKeys.all });
}

export function useApproveInvite() {
  const invalidate = useInvalidateInvites();
  return useMutation({
    mutationFn: (id: string) => approveInvite(id),
    onSuccess: invalidate,
  });
}

export function useRejectInvite() {
  const invalidate = useInvalidateInvites();
  return useMutation({
    mutationFn: (v: { id: string; reason?: string }) => rejectInvite(v.id, v.reason),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd maxv
npx tsc -b --noEmit
git add src/features/invites/types src/features/invites/api src/features/invites/hooks
git commit -m "feat: them api/hooks quan ly loi moi nhan vien (maxv)"
```

---

### Task 12: maxv — Components (chip + dialogs + table)

**Files:**
- Create: `maxv/src/features/invites/components/InviteStatusChip.tsx`
- Create: `maxv/src/features/invites/components/RejectInviteDialog.tsx`
- Create: `maxv/src/features/invites/components/ApprovedPasswordDialog.tsx`
- Create: `maxv/src/features/invites/components/InvitesTable.tsx`

**Interfaces:**
- Consumes: `useRejectInvite` (Task 11), types từ Task 11, `tableCardSx`/`tableHeadRowSx` (`@/components/tableStyles`, đã có), `formatDateTime` (`@/lib/format`, đã có).
- Produces: `InviteStatusChip`, `RejectInviteDialog`, `ApprovedPasswordDialog`, `InvitesTable` — dùng bởi Task 13.

- [ ] **Step 1: Tạo `InviteStatusChip.tsx`**

```tsx
import type { JSX } from 'react';
import { Chip } from '@mui/material';
import { STATUS_LABELS, type InviteStatus } from '@/features/invites/types/invite';

const COLOR: Record<InviteStatus, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

export function InviteStatusChip({ status }: { status: InviteStatus }): JSX.Element {
  return <Chip label={STATUS_LABELS[status]} color={COLOR[status]} size="small" />;
}
```

- [ ] **Step 2: Tạo `RejectInviteDialog.tsx`**

```tsx
import { useState, type JSX } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRejectInvite } from '@/features/invites/hooks/useInvites';
import type { AdminInvite } from '@/features/invites/types/invite';

interface Props {
  invite: AdminInvite;
  onClose: () => void;
}

export function RejectInviteDialog({ invite, onClose }: Props): JSX.Element {
  const { mutate, isPending } = useRejectInvite();
  const [reason, setReason] = useState('');

  function submit(): void {
    mutate({ id: invite.id, reason: reason.trim() || undefined }, { onSuccess: onClose });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Từ chối lời mời</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Email: <b>{invite.email}</b>
          </Typography>
          <TextField
            label="Lý do (không bắt buộc)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy
        </Button>
        <Button variant="contained" color="error" onClick={submit} disabled={isPending}>
          {isPending ? 'Đang xử lý…' : 'Từ chối'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: Tạo `ApprovedPasswordDialog.tsx`**

```tsx
import { useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';

interface Props {
  email: string;
  password: string;
  onClose: () => void;
}

/** Hiện mật khẩu tạm đã cấp cho nhân viên (đã gửi email) đúng 1 lần. */
export function ApprovedPasswordDialog({ email, password, onClose }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  function copy(): void {
    void navigator.clipboard.writeText(password);
    setCopied(true);
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Đã duyệt lời mời</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="success">Đã gửi mật khẩu tạm tới {email}.</Alert>
          <Typography variant="body2" color="text.secondary">
            Mật khẩu chỉ hiển thị một lần ở đây — phòng khi email không tới nơi.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                flexGrow: 1,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 18,
                letterSpacing: '0.04em',
              }}
            >
              {password}
            </Box>
            <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép'}>
              <IconButton onClick={copy} color={copied ? 'success' : 'default'}>
                <ContentCopyRoundedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Đã hiểu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Tạo `InvitesTable.tsx`**

```tsx
import type { JSX } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { InviteStatusChip } from './InviteStatusChip';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS, type AdminInvite } from '@/features/invites/types/invite';

interface Props {
  rows: AdminInvite[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onApprove: (invite: AdminInvite) => void;
  onReject: (invite: AdminInvite) => void;
}

export function InvitesTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onApprove,
  onReject,
}: Props): JSX.Element {
  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Email</TableCell>
              <TableCell>Công ty</TableCell>
              <TableCell>Người yêu cầu</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ngày gửi</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((inv) => (
              <TableRow key={inv.id} hover sx={{ '& td': { py: 1.5 } }}>
                <TableCell sx={{ fontWeight: 600 }}>{inv.email}</TableCell>
                <TableCell>
                  {inv.donVi.tenDonVi}
                  <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{inv.donVi.maSoThue}</Box>
                </TableCell>
                <TableCell>{inv.requestedBy.hoTen}</TableCell>
                <TableCell>{ROLE_LABELS[inv.role]}</TableCell>
                <TableCell>
                  <InviteStatusChip status={inv.status} />
                  {inv.status === 'REJECTED' && inv.lyDoTuChoi && (
                    <Box sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                      {inv.lyDoTuChoi}
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDateTime(inv.createdAt)}
                </TableCell>
                <TableCell align="right">
                  {inv.status === 'PENDING' && (
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        onClick={() => onApprove(inv)}
                      >
                        Duyệt
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<CloseRoundedIcon />}
                        onClick={() => onReject(inv)}
                      >
                        Từ chối
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  Không có lời mời nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        rowsPerPage={pageSize}
        onPageChange={(_e, p) => onPageChange(p + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        rowsPerPageOptions={[10, 20, 50]}
        labelRowsPerPage="Số dòng/trang"
      />
    </Paper>
  );
}
```

- [ ] **Step 5: Typecheck + commit**

```bash
cd maxv
npx tsc -b --noEmit
git add src/features/invites/components
git commit -m "feat: them component bang/hop thoai duyet-tu choi loi moi (maxv)"
```

---

### Task 13: maxv — `InvitesPage` + routing

**Files:**
- Create: `maxv/src/pages/invites/InvitesPage.tsx`
- Create: `maxv/src/routes/invites.route.tsx`
- Modify: `maxv/src/routes/stubs.route.tsx`
- Modify: `maxv/src/routes/index.route.tsx`

**Interfaces:**
- Consumes: `useInvites`, `useApproveInvite` (Task 11); `InvitesTable`, `RejectInviteDialog`, `ApprovedPasswordDialog` (Task 12); `Loading` từ `@/components/Loading` (đã có, dùng trong `UsersPage.tsx`).
- Produces: route `/invites` render `InvitesPage` thay cho `StubPage`.

- [ ] **Step 1: Tạo `src/pages/invites/InvitesPage.tsx`**

```tsx
import { Suspense, useMemo, useState, type JSX } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { Loading } from '@/components/Loading';
import { InvitesTable } from '@/features/invites/components/InvitesTable';
import { RejectInviteDialog } from '@/features/invites/components/RejectInviteDialog';
import { ApprovedPasswordDialog } from '@/features/invites/components/ApprovedPasswordDialog';
import { useInvites, useApproveInvite } from '@/features/invites/hooks/useInvites';
import {
  STATUS_LABELS,
  type AdminInvite,
  type InviteStatus,
  type ListInvitesParams,
} from '@/features/invites/types/invite';

const STATUS_OPTIONS: { value: InviteStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING', label: STATUS_LABELS.PENDING },
  { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
];

type Params = ListInvitesParams & { page: number; pageSize: number };

interface SectionProps {
  params: Params;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function InvitesSection({ params, onPageChange, onPageSizeChange }: SectionProps): JSX.Element {
  const { data } = useInvites(params);
  const approve = useApproveInvite();
  const [rejectTarget, setRejectTarget] = useState<AdminInvite | null>(null);
  const [approved, setApproved] = useState<{ email: string; password: string } | null>(null);

  function handleApprove(invite: AdminInvite): void {
    if (!window.confirm(`Duyệt lời mời cho "${invite.email}"?`)) return;
    approve.mutate(invite.id, { onSuccess: (d) => setApproved(d) });
  }

  return (
    <>
      <InvitesTable
        rows={data.data}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onApprove={handleApprove}
        onReject={setRejectTarget}
      />
      {rejectTarget && (
        <RejectInviteDialog
          key={rejectTarget.id}
          invite={rejectTarget}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {approved && (
        <ApprovedPasswordDialog
          email={approved.email}
          password={approved.password}
          onClose={() => setApproved(null)}
        />
      )}
    </>
  );
}

export function InvitesPage(): JSX.Element {
  const [status, setStatus] = useState<InviteStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<Params>(
    () => ({ page, pageSize, ...(status ? { status } : {}) }),
    [page, pageSize, status],
  );

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <TextField
          select
          label="Trạng thái"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as InviteStatus | '');
          }}
          sx={{ width: 200 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Suspense fallback={<Loading />}>
        <InvitesSection
          params={params}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPage(1);
            setPageSize(s);
          }}
        />
      </Suspense>
    </Stack>
  );
}
```

- [ ] **Step 2: Tạo `src/routes/invites.route.tsx`**

```tsx
import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin.route';
import { InvitesPage } from '@/pages/invites/InvitesPage';

export const invitesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/invites',
  staticData: {
    title: 'Nhân viên',
    description: 'Duyệt/từ chối lời mời nhân viên do chủ đơn vị gửi.',
  },
  component: InvitesPage,
});
```

- [ ] **Step 3: Xoá `invitesRoute` khỏi `src/routes/stubs.route.tsx`**

Xoá block sau (giữ nguyên `dashboardRoute` và `opsRoute`):
```tsx
export const invitesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/invites',
  staticData: {
    title: 'Nhân viên',
    description: 'Duyệt/từ chối lời mời nhân viên do chủ đơn vị gửi.',
  },
  component: StubPage,
});
```

- [ ] **Step 4: Sửa import trong `src/routes/index.route.tsx`**

Đổi dòng:
```ts
import { dashboardRoute, invitesRoute, opsRoute } from './stubs.route';
```
thành 2 dòng:
```ts
import { dashboardRoute, opsRoute } from './stubs.route';
import { invitesRoute } from './invites.route';
```
(Phần `routeTree` bên dưới giữ nguyên — vẫn dùng đúng tên `invitesRoute`.)

- [ ] **Step 5: Typecheck**

```bash
cd maxv
npx tsc -b --noEmit
```

Expected: 0 lỗi.

- [ ] **Step 6: Kiểm tra trên trình duyệt**

Khởi động `maxv` (`npm run dev`) cùng `be_maxv` đang chạy. Đăng nhập bằng tài khoản ADMIN → vào tab "Nhân viên" (sidebar).

Expected quan sát được:
- Bảng hiển thị danh sách lời mời (nếu đã tạo dữ liệu test ở Task 8/10) — cột Email/Công ty/Người yêu cầu/Vai trò/Trạng thái/Ngày gửi.
- Lọc theo "Trạng thái" = "Chờ duyệt" → chỉ còn dòng PENDING.
- Click "Duyệt" trên 1 dòng PENDING → hộp thoại xác nhận → sau khi xác nhận, dialog "Đã duyệt lời mời" hiện email + mật khẩu (sao chép được), bảng cập nhật trạng thái "Đã duyệt".
- Click "Từ chối" trên 1 dòng PENDING khác → nhập lý do → dòng chuyển "Từ chối", hiện lý do nhỏ bên dưới chip trạng thái.

- [ ] **Step 7: Commit**

```bash
git add src/pages/invites/InvitesPage.tsx src/routes/invites.route.tsx src/routes/stubs.route.tsx src/routes/index.route.tsx
git commit -m "feat: thay stub bang trang duyet/tu choi loi moi nhan vien (maxv)"
```

---

## Self-Review Notes

- **Spec coverage:** US-04 (owner mời) → Task 4/5/9/10. US-05 (admin duyệt/từ chối) → Task 6/7/11/12/13. TC-NV-001/003/004/005/006 → xác minh trực tiếp ở Task 8 (email trùng = TC-NV-003, approve = TC-NV-004, reject = TC-NV-005, non-owner/non-admin guard = TC-NV-002/006 thông qua `app.requireRole` có sẵn). TC-NV-002 (nhân viên không phải OWNER mời) đã được guard chặn ở tầng route (`requireRole('OWNER')`), không cần code riêng.
- **Không leak mật khẩu:** xác nhận lại — `inviteEmployee()` (Task 4) trả về object không có `password`; chỉ `adminApproveInvite()` (Task 6) trả `{email, password}`.
- **Không có placeholder:** mọi step đều có code đầy đủ, không có "TODO/tương tự task N".
- **Tên hàm nhất quán:** `inviteEmployee`/`listEmployees` (Task 4) khớp với import ở Task 5; `adminListInvites`/`adminApproveInvite`/`adminRejectInvite` (Task 6) khớp Task 7; `useEmployees`/`useInviteEmployee` (Task 9) khớp Task 10; `useInvites`/`useApproveInvite`/`useRejectInvite` (Task 11) khớp Task 12/13.
