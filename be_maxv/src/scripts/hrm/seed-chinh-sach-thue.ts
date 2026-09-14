import { sysPrisma } from '../../config/db.sys';
import { getTenantDb, disconnectAllTenants } from '../../helpers/tenantClient';
import type { Prisma, PrismaClient } from '../../generated/tenant';
import {
  CHINH_SACH_THUE_SEED,
  DANH_MUC_THU_NHAP_SEED,
} from '../../constants/hrm/to_khai_thue/taxSeedData';

/**
 * NẠP DỮ LIỆU KHỞI TẠO CỤM THUẾ TNCN — bước **M-2** của lộ trình di trú
 * (`docs/hrm/to_khai_thue/data-model-to-khai-thue.md` Mục 6 và Mục 7).
 *
 *   npm run hrm:seed-thue -- --thu   # CHẾ ĐỘ RÀ SOÁT: chỉ đọc và in, KHÔNG ghi dòng nào
 *   npm run hrm:seed-thue            # CHẾ ĐỘ NẠP: có ghi
 *
 * Nạp 2 dòng `hrm_tax_policies` (mốc hiệu lực) + 12 dòng `hrm_other_income_categories`.
 *
 * ===== CHẠY LẠI ĐƯỢC NHIỀU LẦN CHO CÙNG KẾT QUẢ =====
 *
 * Khóa đối chiếu là `effectiveFrom` (chính sách) và `code` (danh mục) — cả hai đều UNIQUE ở CSDL.
 * Dòng đã có thì **GIỮ NGUYÊN, không ghi đè**: sau khi nạp lần đầu, kế toán được phép sửa danh
 * mục (đổi tên, đổi trần, tắt ACTIVE) và script này KHÔNG được xóa công sức đó. Cùng tinh thần
 * ranh giới ghi của `chuan-hoa-bieu-thue.ts`: chỉ thêm cái còn thiếu, không đụng cái đã có.
 *
 * Muốn đưa một danh mục về mặc định thì sửa tay trên màn hình — đó là hành vi có chủ đích của
 * người dùng, không phải việc của script vận hành.
 *
 * ⚠️ Tenant chưa chạy `npm run sync:tenants` thì chưa có 2 bảng này. Script nhận diện bằng
 * `information_schema` và bỏ qua tenant đó (đếm vào cột "không chạy được").
 */

interface DongBaoCao {
  maSoThue: string;
  dbName: string;
  chinhSachThem: number;
  chinhSachDaCo: number;
  danhMucThem: number;
  danhMucDaCo: number;
  loi?: string;
}

async function coBang(db: PrismaClient, ten: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1`,
    ten,
  );
  return Number(rows[0].n) > 0;
}

async function xuLyMotTenant(
  dbName: string,
  chayThu: boolean,
): Promise<Omit<DongBaoCao, 'maSoThue' | 'dbName'>> {
  const db = getTenantDb(dbName);

  for (const bang of ['hrm_tax_policies', 'hrm_other_income_categories']) {
    if (!(await coBang(db, bang))) {
      throw new Error(
        `Chưa có bảng ${bang} — tenant này chưa chạy \`npm run sync:tenants\`.`,
      );
    }
  }

  let chinhSachThem = 0;
  let chinhSachDaCo = 0;
  for (const cs of CHINH_SACH_THUE_SEED) {
    const moc = new Date(`${cs.effectiveFrom}T00:00:00.000Z`);
    const daCo = await db.taxPolicy.findUnique({
      where: { effectiveFrom: moc },
    });
    if (daCo) {
      chinhSachDaCo++;
      continue;
    }
    chinhSachThem++;
    if (chayThu) continue;
    await db.taxPolicy.create({
      data: {
        effectiveFrom: moc,
        personalDeduction: cs.personalDeduction,
        dependentDeduction: cs.dependentDeduction,
        taxBrackets: cs.taxBrackets as unknown as Prisma.InputJsonValue,
        withholdingTaxRate: cs.withholdingTaxRate,
        withholdingTaxThreshold: cs.withholdingTaxThreshold,
        voluntaryPensionMonthlyCap: cs.voluntaryPensionMonthlyCap,
        lunchAllowanceTaxFreeCap: cs.lunchAllowanceTaxFreeCap,
        legalBasisNote: cs.legalBasisNote,
      },
    });
  }

  let danhMucThem = 0;
  let danhMucDaCo = 0;
  for (const dm of DANH_MUC_THU_NHAP_SEED) {
    const daCo = await db.otherIncomeCategory.findUnique({
      where: { code: dm.code },
    });
    if (daCo) {
      danhMucDaCo++;
      continue;
    }
    danhMucThem++;
    if (chayThu) continue;
    await db.otherIncomeCategory.create({
      data: {
        code: dm.code,
        name: dm.name,
        taxTreatmentGroup: dm.taxTreatmentGroup,
        exemptCapAmount: dm.exemptCapAmount ?? null,
        exemptCapPeriod: dm.exemptCapPeriod ?? null,
        withholdingRate: dm.withholdingRate ?? null,
        withholdingThreshold: dm.withholdingThreshold ?? null,
      },
    });
  }

  return { chinhSachThem, chinhSachDaCo, danhMucThem, danhMucDaCo };
}

async function main(): Promise<void> {
  const chayThu =
    process.argv.includes('--thu') || process.argv.includes('--dry-run');

  const companies = await sysPrisma.donVi.findMany({
    where: { dbName: { not: null } },
    select: { maSoThue: true, dbName: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    console.log('Không có tenant nào để nạp.');
    return;
  }

  console.log(
    `Nạp dữ liệu khởi tạo cụm thuế TNCN cho ${companies.length} tenant` +
      `${chayThu ? ' — CHẾ ĐỘ RÀ SOÁT, không ghi dòng nào' : ''}...\n`,
  );

  const baoCao: DongBaoCao[] = [];
  for (const c of companies) {
    const dbName = c.dbName as string;
    const dong: DongBaoCao = {
      maSoThue: c.maSoThue,
      dbName,
      chinhSachThem: 0,
      chinhSachDaCo: 0,
      danhMucThem: 0,
      danhMucDaCo: 0,
    };
    try {
      Object.assign(dong, await xuLyMotTenant(dbName, chayThu));
    } catch (err) {
      // Một tenant hỏng KHÔNG được làm dừng cả lượt.
      dong.loi = (err as Error).message;
    }
    baoCao.push(dong);

    if (dong.loi) {
      console.error(`  ✗ ${dbName} (MST ${c.maSoThue}): ${dong.loi}`);
      continue;
    }
    const dongTu = chayThu ? 'sẽ thêm' : 'đã thêm';
    console.log(
      `  ✓ ${dbName} (MST ${c.maSoThue}, ${c.status}): ` +
        `chính sách thuế ${dongTu} ${dong.chinhSachThem}, giữ nguyên ${dong.chinhSachDaCo} · ` +
        `danh mục ${dongTu} ${dong.danhMucThem}, giữ nguyên ${dong.danhMucDaCo}`,
    );
  }

  const soLoi = baoCao.filter((d) => d.loi).length;
  const tong = (f: (d: DongBaoCao) => number) =>
    baoCao.filter((d) => !d.loi).reduce((s, d) => s + f(d), 0);

  console.log(
    `\n===== ĐỐI SOÁT =====\n` +
      `  Chính sách thuế ${chayThu ? 'sẽ thêm ' : 'đã thêm  '}        : ${tong((d) => d.chinhSachThem)}\n` +
      `  Chính sách thuế giữ nguyên       : ${tong((d) => d.chinhSachDaCo)}\n` +
      `  Danh mục ${chayThu ? 'sẽ thêm ' : 'đã thêm  '}               : ${tong((d) => d.danhMucThem)}\n` +
      `  Danh mục giữ nguyên              : ${tong((d) => d.danhMucDaCo)}\n` +
      `  Không chạy được                  : ${soLoi}\n` +
      `  Tổng tenant                      : ${companies.length}`,
  );

  if (soLoi > 0) process.exitCode = 1;

  console.log(
    chayThu
      ? '\nRà soát xong, chưa ghi gì. Bỏ cờ --thu để nạp thật.'
      : '\nNạp xong. Chạy lại lệnh này lần nữa: mọi số "đã thêm" phải bằng 0 —\n' +
          'đó là phép kiểm tính chạy-lại-cùng-kết-quả.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectAllTenants();
    await sysPrisma.$disconnect();
  });
