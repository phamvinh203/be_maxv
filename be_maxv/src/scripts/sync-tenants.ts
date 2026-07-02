import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { sysPrisma } from '../config/db.sys';
import { tenantUrl } from '../utils/dbName';

const execAsync = promisify(exec);

/**
 * Đồng bộ tenant schema hiện tại lên TẤT CẢ DB công ty đã cấp.
 * Chạy sau mỗi lần sửa prisma/tenant/schema.prisma để các tenant cũ không bị
 * lệch cột (nguyên nhân lỗi P2022 "column ... does not exist").
 *
 *   npm run sync:tenants
 */
async function main(): Promise<void> {
  const companies = await sysPrisma.donVi.findMany({
    where: { dbName: { not: null } },
    select: { maSoThue: true, dbName: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    console.log('Không có tenant nào để đồng bộ.');
    return;
  }

  const schemaPath = path.join('prisma', 'tenant', 'schema.prisma');
  console.log(`Đồng bộ schema cho ${companies.length} tenant...\n`);

  let ok = 0;
  let fail = 0;
  for (const c of companies) {
    const dbName = c.dbName as string;
    try {
      await execAsync(
        `npx prisma db push --schema=${schemaPath} --url="${tenantUrl(dbName)}" --accept-data-loss`,
      );
      console.log(`  ✓ ${dbName} (MST ${c.maSoThue}, ${c.status})`);
      ok++;
    } catch (err) {
      console.error(
        `  ✗ ${dbName} (MST ${c.maSoThue}): ${(err as Error).message}`,
      );
      fail++;
    }
  }

  console.log(`\nXong: ${ok} thành công, ${fail} lỗi.`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void sysPrisma.$disconnect());
