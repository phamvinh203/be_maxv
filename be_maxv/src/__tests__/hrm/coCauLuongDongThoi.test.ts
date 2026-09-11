import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveSalaryStructure } from '../../services/client/hrm/cai_dat_luong/salaryStructures.service';

/**
 * vbsec 2026-09-10 (LOW, salaryStructures.service.ts:135): lưu cơ cấu lương = tìm bản "đang áp dụng" rồi
 * sửa, chưa có thì tạo — trong giao dịch nhưng KHÔNG khóa: hai lượt lưu cùng lúc khi chưa có bản nào đều
 * thấy "chưa có" và cùng tạo -> 2 cơ cấu `isActive`; bảng lương lấy bản nào tùy thứ tự sắp xếp. Cùng lúc
 * sửa một bản thì hai lượt `deleteMany` + `createMany` đan nhau -> dòng khoản lương nhân đôi.
 * Sửa: khóa advisory ở đầu giao dịch — mọi lượt lưu cơ cấu chạy lần lượt.
 *
 * DB giả mô phỏng Postgres READ COMMITTED: giao dịch KHÔNG tự tuần tự; chỉ `pg_advisory_xact_lock` (gọi qua
 * `$executeRaw`) mới bắt lượt sau chờ tới khi giao dịch giữ khóa kết thúc.
 */

type CoCau = { id: string; isActive: boolean; createdAt: Date };
type Dong = { salaryStructureId: string; salaryItemId: string };

function taoDb() {
  const coCau: CoCau[] = [];
  const dong: Dong[] = [];
  let hangKhoa: Promise<void> = Promise.resolve();
  const tre = () => new Promise((r) => setTimeout(r, 5));

  const bang = {
    salaryStructure: {
      findFirst: async () => {
        await tre();
        return (
          coCau
            .filter((c) => c.isActive)
            .sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null
        );
      },
      create: async ({ data }: { data: { isActive: boolean } }) => {
        await tre();
        const c = {
          ...data,
          id: `cc-${coCau.length + 1}`,
          createdAt: new Date(),
        };
        coCau.push(c);
        return { ...c };
      },
      update: async ({ where }: { where: { id: string } }) => {
        await tre();
        return { ...coCau.find((x) => x.id === where.id)! };
      },
      findUnique: async ({ where }: { where: { id: string } }) => ({
        ...coCau.find((x) => x.id === where.id)!,
        items: dong.filter((d) => d.salaryStructureId === where.id),
      }),
    },
    salaryStructureItem: {
      deleteMany: async ({
        where,
      }: {
        where: { salaryStructureId: string };
      }) => {
        await tre();
        for (let i = dong.length - 1; i >= 0; i--) {
          if (dong[i]!.salaryStructureId === where.salaryStructureId)
            dong.splice(i, 1);
        }
        return { count: 0 };
      },
      createMany: async ({ data }: { data: Dong[] }) => {
        await tre();
        dong.push(
          ...data.map((d) => ({
            salaryStructureId: d.salaryStructureId,
            salaryItemId: d.salaryItemId,
          })),
        );
        return { count: data.length };
      },
    },
  };

  return {
    coCau,
    dong,
    salaryItem: {
      findMany: async () => [
        { id: 'si-1', code: 'LUONG_CB' },
        { id: 'si-2', code: 'AN_TRUA' },
      ],
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const giu: { traKhoa?: () => void } = {};
      const tx = {
        ...bang,
        $executeRaw: async () => {
          const truoc = hangKhoa;
          const cua = new Promise<void>((r) => (giu.traKhoa = r));
          hangKhoa = truoc.then(() => cua);
          await truoc;
          return 1;
        },
      };
      try {
        return await fn(tx);
      } finally {
        giu.traKhoa?.();
      }
    },
  };
}

const INPUT = {
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  note: null,
  items: [
    {
      salaryItemId: 'LUONG_CB',
      taxTreatment: 'TAXABLE',
      isOvertimeBase: true,
      calculationMethod: 'MONTHLY_FIXED',
      defaultAmount: 0,
    },
    {
      salaryItemId: 'AN_TRUA',
      taxTreatment: 'EXEMPT',
      isOvertimeBase: false,
      calculationMethod: 'MONTHLY_FIXED',
      defaultAmount: 0,
    },
  ],
};

test('2 lượt lưu cơ cấu lương cùng lúc khi CHƯA có bản nào -> chỉ 1 cơ cấu đang áp dụng, dòng không nhân đôi', async () => {
  const db = taoDb();
  await Promise.all([
    saveSalaryStructure(db as never, INPUT as never),
    saveSalaryStructure(db as never, INPUT as never),
  ]);

  assert.equal(
    db.coCau.filter((c) => c.isActive).length,
    1,
    `có ${db.coCau.length} cơ cấu đang áp dụng`,
  );
  assert.equal(db.dong.length, 2, `có ${db.dong.length} dòng khoản lương`);
});

test('2 lượt sửa cùng một cơ cấu cùng lúc -> dòng khoản lương không nhân đôi', async () => {
  const db = taoDb();
  await saveSalaryStructure(db as never, INPUT as never);
  await Promise.all([
    saveSalaryStructure(db as never, INPUT as never),
    saveSalaryStructure(db as never, INPUT as never),
  ]);

  assert.equal(db.coCau.filter((c) => c.isActive).length, 1);
  assert.equal(db.dong.length, 2, `có ${db.dong.length} dòng khoản lương`);
});
