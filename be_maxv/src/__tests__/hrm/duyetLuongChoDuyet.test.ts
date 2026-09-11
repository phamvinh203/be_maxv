import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../../generated/tenant';
import {
  approveEmployeeSalaries,
  setEmployeeSalary,
} from '../../services/client/hrm/cai_dat_luong/employeeSalaries.service';
import { approveSalariesSchema } from '../../validators/hrm/cai_dat_luong/employeeSalaries.validator';

/**
 * Duyệt set lương nhân viên (employeeSalaries.service.ts) — vbsec 2026-09-10:
 *  - LOW #39 (employeeSalaries.validator.ts:93): duyệt hàng loạt cuốn cả bản nháp / bị từ chối; mảng rỗng
 *    thành "duyệt tất cả".
 *  - LOW #40 (employeeSalaries.service.ts:434): duyệt không gắn với PHIÊN BẢN người duyệt đã xem — ai đó sửa
 *    lương sau khi người duyệt mở màn hình thì bản mới (chưa ai xem) vẫn được duyệt. Hai người sửa cùng lúc
 *    còn ra CÙNG một số phiên bản (đọc rồi +1), nên gắn theo số phiên bản cũng không phân biệt được.
 * Sửa (chủ dự án chốt 2026-09-11): nút "Duyệt lương" gửi đúng các dòng đang chờ duyệt đang hiển thị kèm
 * `setupVersion`; máy chủ chỉ duyệt dòng còn đúng phiên bản đó và còn chờ duyệt. `setupVersion` tăng nguyên
 * tử trong DB.
 */

type Dong = { ma_nv: string; status: string; setupVersion: number };

function taoDbDuyet(dong: Dong[]) {
  return {
    dong,
    employeeSalary: {
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          status?: string;
          OR?: Array<{ ma_nv: string; setupVersion: number }>;
        };
        data: { status: string };
      }) => {
        let count = 0;
        for (const d of dong) {
          const okStatus =
            where.status === undefined || d.status === where.status;
          const okBan =
            !where.OR ||
            where.OR.some(
              (o) => o.ma_nv === d.ma_nv && o.setupVersion === d.setupVersion,
            );
          if (!okStatus || !okBan) continue;
          d.status = data.status;
          count++;
        }
        return { count };
      },
    },
  };
}

test('duyệt đúng phiên bản đã xem: bản bị sửa sau khi xem (setupVersion khác) KHÔNG được duyệt', async () => {
  const db = taoDbDuyet([
    { ma_nv: 'NV01', status: 'PENDING_APPROVAL', setupVersion: 3 },
    { ma_nv: 'NV02', status: 'PENDING_APPROVAL', setupVersion: 5 }, // người duyệt xem lúc còn bản 4
  ]);
  const kq = await approveEmployeeSalaries(
    db as never,
    {
      items: [
        { employeeId: 'NV01', setupVersion: 3 },
        { employeeId: 'NV02', setupVersion: 4 },
      ],
    },
    'owner-1',
  );

  assert.equal(kq.approvedCount, 1);
  assert.equal(kq.skippedCount, 1);
  assert.deepEqual(
    db.dong.map((d) => d.status),
    ['APPROVED', 'PENDING_APPROVAL'],
  );
});

test('chỉ duyệt bản ĐANG CHỜ DUYỆT — không đụng bản nháp / bị từ chối / đã duyệt', async () => {
  const db = taoDbDuyet([
    { ma_nv: 'NV01', status: 'PENDING_APPROVAL', setupVersion: 1 },
    { ma_nv: 'NV02', status: 'DRAFT', setupVersion: 1 },
    { ma_nv: 'NV03', status: 'REJECTED', setupVersion: 1 },
    { ma_nv: 'NV04', status: 'APPROVED', setupVersion: 1 },
  ]);
  const kq = await approveEmployeeSalaries(
    db as never,
    {
      items: ['NV01', 'NV02', 'NV03', 'NV04'].map((employeeId) => ({
        employeeId,
        setupVersion: 1,
      })),
    },
    'owner-1',
  );

  assert.equal(kq.approvedCount, 1);
  assert.equal(kq.skippedCount, 3);
  assert.deepEqual(
    db.dong.map((d) => d.status),
    ['APPROVED', 'DRAFT', 'REJECTED', 'APPROVED'],
  );
});

test('thân yêu cầu: bắt buộc danh sách {employeeId, setupVersion} (≥1, không trùng người) — hết kiểu "bỏ trống = duyệt tất cả"', () => {
  assert.equal(approveSalariesSchema.safeParse({}).success, false);
  assert.equal(approveSalariesSchema.safeParse({ items: [] }).success, false);
  assert.equal(
    approveSalariesSchema.safeParse({ employeeIds: ['NV01'] }).success,
    false,
  );
  assert.equal(
    approveSalariesSchema.safeParse({
      items: [{ employeeId: 'NV01', setupVersion: 0 }],
    }).success,
    false,
  );
  assert.equal(
    approveSalariesSchema.safeParse({
      items: [
        { employeeId: 'NV01', setupVersion: 1 },
        { employeeId: 'NV01', setupVersion: 2 },
      ],
    }).success,
    false,
  );
  assert.equal(
    approveSalariesSchema.safeParse({
      items: [{ employeeId: 'NV01', setupVersion: 3 }],
    }).success,
    true,
  );
});

test('2 người sửa lương CÙNG một nhân viên cùng lúc -> 2 số phiên bản KHÁC nhau (tăng nguyên tử trong DB)', async () => {
  // DB giả kiểu Postgres READ COMMITTED: cả hai giao dịch đọc thấy bản 2; lệnh UPDATE áp `{ increment }`
  // lên giá trị ĐANG lưu (UPDATE khóa dòng, lượt sau chờ rồi cộng tiếp), còn gán số thì ghi đè đúng số đó.
  const luu = {
    id: 'salary-1',
    ma_nv: 'NV0001',
    setupVersion: 2,
    status: 'APPROVED',
    approvedByUserId: 'user-admin',
    approvedAt: new Date(),
    totalAmount: new Prisma.Decimal(12000000),
  };
  const cho = () => new Promise((r) => setTimeout(r, 5));
  const db = {
    hrm_nhan_vien: {
      findFirst: async () => ({
        ma_nv: 'NV0001',
        ho_ten: 'Trần Văn B',
        da_xoa: false,
      }),
    },
    hrm_hop_dong: {
      findFirst: async () => ({
        id: 'hd-1',
        ma_nv: 'NV0001',
        ngay_bat_dau: new Date('2025-01-01'),
        ngay_ket_thuc: null,
      }),
    },
    salaryStructure: {
      findFirst: async () => ({
        id: 'struct-1',
        isActive: true,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        items: [
          {
            salaryItemId: 'uuid-kl01',
            salaryItem: { id: 'uuid-kl01', code: 'KL01', name: 'Lương cơ bản' },
          },
        ],
      }),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => {
      const docLuc = { ...luu }; // ảnh chụp lúc đọc
      let banSauGhi: typeof luu | null = null;
      const tx = {
        employeeSalary: {
          findUnique: async () => {
            await cho();
            return { ...(banSauGhi ?? docLuc), items: [] };
          },
          update: async ({ data }: { data: Record<string, unknown> }) => {
            await cho();
            const v = data.setupVersion as number | { increment: number };
            luu.setupVersion =
              typeof v === 'object' ? luu.setupVersion + v.increment : v;
            Object.assign(luu, { ...data, setupVersion: luu.setupVersion });
            banSauGhi = { ...luu };
            return { ...luu };
          },
        },
        employeeSalaryItem: {
          deleteMany: async () => {},
          createMany: async () => {},
        },
      };
      return fn(tx);
    },
  };
  const sua = () =>
    setEmployeeSalary(
      db as never,
      'NV0001',
      { items: [{ salaryItemId: 'KL01', amount: 18000000 }] } as never,
      'u',
    );

  const [a, b] = await Promise.all([sua(), sua()]);
  assert.notEqual(
    a.lan_thiet_lap,
    b.lan_thiet_lap,
    'hai lượt sửa ra cùng số phiên bản',
  );
  assert.equal(luu.setupVersion, 4);
});
