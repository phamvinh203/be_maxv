import { Client } from 'pg';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { env } from '../../config/env';
import { sysPrisma } from '../../config/db.sys';
import { tenantDbName, tenantUrl } from '../../utils/dbName';

const execAsync = promisify(exec);

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
 *   3) Cập nhật don_vi -> READY + dbName + provisionedAt
 * Lỗi bất kỳ bước nào -> don_vi.status = FAILED (cho retry).
 */
export async function provisionTenant(
  donViId: string,
  mst: string,
): Promise<string> {
  const dbName = tenantDbName(mst); // đã validate -> an toàn nội suy SQL

  try {
    await createDatabaseIfNotExists(dbName);
    await pushTenantSchema(dbName);

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

async function createDatabaseIfNotExists(dbName: string): Promise<void> {
  await withAdminClient(async (admin) => {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  });
}

async function pushTenantSchema(dbName: string): Promise<void> {
  const schemaPath = path.join('prisma', 'tenant', 'schema.prisma');
  // Prisma 7: --url ghi đè datasource trong prisma.config.ts cho đúng DB tenant.
  // --accept-data-loss để chạy non-TTY trên DB rỗng (chỉ tạo bảng mới).
  await execAsync(
    `npx prisma db push --schema=${schemaPath} --url="${tenantUrl(dbName)}" --accept-data-loss`,
  );
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

/** Dùng cho GC: xóa hẳn DB của 1 công ty đã hết hạn. */
export async function dropTenant(dbName: string): Promise<void> {
  await withAdminClient((admin) =>
    admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`),
  );
}
