import { Client } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { env } from '../../config/env';
import { sysPrisma } from '../../config/db.sys';
import { evictTenantDb } from '../../helpers/tenantClient';
import { applyTenantConstraints } from './hrmTenantConstraints';
import {
  assertTenDbTenant,
  tenantDbName,
  tenantUrl,
} from '../../utils/dbName';
import { ConflictError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';

const execFileAsync = promisify(execFile);

async function withAdminClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const admin = new Client({ connectionString: env.adminUrl });
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

/**
 * SAGA cấp phát DB cho 1 công ty.
 * Gọi sau khi đã tạo bản ghi don_vi (status=PROVISIONING).
 *   1) CREATE DATABASE bằng pg thô (Prisma không tạo được database)
 *   2) Đồng bộ schema template lên DB mới (prisma db push)
 *   3) Áp ràng buộc HRM không diễn tả được bằng Prisma DSL (EXCLUDE/EXTENSION/FUNCTION)
 *   4) Cập nhật don_vi -> READY + dbName + provisionedAt
 * Lỗi bất kỳ bước nào -> don_vi.status = FAILED (cho retry).
 *
 * BƯỚC 3 KHÔNG ĐƯỢC BỎ. `db push` chỉ dựng bảng theo `schema.prisma`; ba loại ràng buộc HRM
 * (`btree_gist`, hai hàm gom nhóm, hai ràng buộc loại trừ, unique số hợp đồng) Prisma không mô
 * tả được nên tenant mới sẽ **không có ràng buộc nào** — công ty vừa mở là đã hở đúng những lỗ
 * mà đợt này vừa vá cho công ty cũ. DB mới luôn rỗng nên bước này không bao giờ vướng dữ liệu;
 * hỏng ở đây là hỏng hạ tầng thật, và SAGA đánh dấu FAILED thay vì để lại một DB nửa vời.
 */
export async function provisionTenant(
  donViId: string,
  mst: string,
  /**
   * `choPhepDbCoSan`: dùng lại DB đã tồn tại. CHỈ bật khi người vận hành CHỦ ĐỘNG cấp lại DB cho chính
   * công ty này (admin retry-provision, script seed dev). Mặc định TẮT: đăng ký mới mà DB của MST đã
   * có thì đó là DB mồ côi của công ty trước — nhận vào là owner mới thừa hưởng trọn dữ liệu cũ.
   */
  opts: { choPhepDbCoSan?: boolean } = {},
): Promise<string> {
  const dbName = tenantDbName(mst); // đã validate -> an toàn nội suy SQL

  try {
    await taoDatabase(dbName, opts.choPhepDbCoSan ?? false);
    await dayTenantSchema(dbName);
    await applyTenantConstraints(dbName);

    // Chỉ đánh dấu vòng đời DB = READY. Billing (trial) do Subscription lo.
    await sysPrisma.donVi.update({
      where: { id: donViId },
      data: {
        status: 'READY',
        dbName,
        provisionedAt: new Date(),
      },
    });
    return dbName;
  } catch (err) {
    await sysPrisma.donVi
      .update({ where: { id: donViId }, data: { status: 'FAILED' } })
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Câu `CREATE DATABASE` cho DB tenant. Tách role quản trị (`env.chuDbTenant`) thì giao DB cho role app làm
 * OWNER: role app không có CREATEDB nhưng vẫn cần đẩy schema (`db push`) lên DB của chính nó. Tên role
 * đi vào câu SQL (không tham số hóa được định danh) nên phải đúng dạng định danh Postgres.
 */
export function cauTaoDatabase(dbName: string, chu?: string): string {
  if (chu === undefined) return `CREATE DATABASE "${dbName}"`;
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(chu)) {
    throw new Error(`Tên role chủ DB tenant không hợp lệ: ${chu}`);
  }
  return `CREATE DATABASE "${dbName}" OWNER "${chu}"`;
}

async function taoDatabase(
  dbName: string,
  choPhepDbCoSan: boolean,
): Promise<void> {
  await withAdminClient(async (admin) => {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (exists.rowCount === 0) {
      await admin.query(cauTaoDatabase(dbName, env.chuDbTenant));
    } else if (!choPhepDbCoSan) {
      throw new ConflictError(MESSAGES.COMPANY.TENANT_DB_EXISTS);
    }
  });
}

/** Chạy 1 lệnh con — tách ra để test thay được mà không gọi Prisma CLI thật. */
export type ChayLenh = (
  file: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv },
) => Promise<unknown>;

/**
 * Chạy thẳng file JS của Prisma CLI bằng node hiện tại (`execFile`, KHÔNG qua shell): không nội suy
 * chuỗi vào lệnh shell, và chạy được trên Windows Server (spawn `npx.cmd` không có shell bị Node chặn).
 */
const PRISMA_CLI = require.resolve('prisma/build/index.js');
const chayLenhThat: ChayLenh = (file, args, opts) =>
  execFileAsync(file, args, { env: opts.env, maxBuffer: 10 * 1024 * 1024 });

/** Che mật khẩu trong URL Postgres: `postgresql://user:pass@host` -> `postgresql://user:***@host`. */
export function cheMatKhauUrlDb(text: string): string {
  return text.replace(/(postgres(?:ql)?:\/\/[^:@\s/]+:)[^@\s]*@/gi, '$1***@');
}

/**
 * Đẩy schema tenant (`prisma db push`) lên 1 DB tenant. Dùng chung cho provisioning và script
 * `sync-tenants`.
 *
 * URL DB (có mật khẩu tài khoản chủ Postgres) đi qua BIẾN MÔI TRƯỜNG của tiến trình con
 * (`PRISMA_TENANT_PUSH_URL`, prisma.config.ts đọc) — không đặt lên dòng lệnh, nơi nó lộ qua danh
 * sách tiến trình và nằm nguyên trong `err.cmd`/`err.message` khi lệnh lỗi. Lỗi ném ra là lỗi MỚI,
 * đã che mật khẩu, không mang `cmd`/`stderr` gốc.
 * `--accept-data-loss` để chạy non-TTY (DB mới rỗng / sync schema tenant cũ).
 */
export async function dayTenantSchema(
  dbName: string,
  chayLenh: ChayLenh = chayLenhThat,
): Promise<void> {
  assertTenDbTenant(dbName);
  const schemaPath = path.join('prisma', 'tenant', 'schema.prisma');
  try {
    await chayLenh(
      process.execPath,
      [PRISMA_CLI, 'db', 'push', `--schema=${schemaPath}`, '--accept-data-loss'],
      { env: { ...process.env, PRISMA_TENANT_PUSH_URL: tenantUrl(dbName) } },
    );
  } catch (err) {
    const { message, stderr } = err as { message?: unknown; stderr?: unknown };
    const chiTiet = [message, stderr]
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .join('\n');
    throw new Error(
      `prisma db push lỗi trên ${dbName}: ${cheMatKhauUrlDb(chiTiet)}`,
    );
  }
}

/** Kiểm tra DB tenant có tồn tại thật trong PostgreSQL (dùng cho reconcile/guard). */
export async function tenantDbExists(dbName: string): Promise<boolean> {
  return withAdminClient(async (admin) => {
    const res = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    return (res.rowCount ?? 0) > 0;
  });
}

/**
 * Xóa hẳn DB của 1 công ty (owner xóa vĩnh viễn công ty, hoặc GC dọn công ty hết hạn).
 *
 * Tự gỡ pool trước khi DROP: "database đã xóa thì không được còn client pooled trỏ vào nó" là
 * tính chất của việc XÓA, không phải nghĩa vụ mà từng caller phải nhớ. Để caller tự lo thì caller
 * thứ hai sẽ quên, và lỗi nổ ra ở chỗ khác hẳn (một request sau đó bốc trúng client hỏng).
 */
export async function dropTenant(dbName: string): Promise<void> {
  assertTenDbTenant(dbName);
  await evictTenantDb(dbName);
  await withAdminClient((admin) =>
    admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`),
  );
}
