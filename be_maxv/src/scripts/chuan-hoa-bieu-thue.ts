import { sysPrisma } from '../config/db.sys';
import { getTenantDb, disconnectAllTenants } from '../helpers/tenantClient';
import { writeLog } from '../services/shared/syslog.service';
import type { PrismaClient, Prisma } from '../generated/tenant';
import {
  BIEU_THUE_5_BAC_CU,
  BIEU_THUE_CHUAN_7_BAC,
  SINGLETON_ID,
  laBieuThueTrungKhop,
} from '../services/client/hrm/cau_hinh_mac_dinh/generalSettings.service';

/**
 * RÀ SOÁT VÀ CHUẨN HÓA BIỂU THUẾ TNCN TRÊN MỌI TENANT — `FR-hrm-055` (BA chốt QĐ #22 điểm 3).
 *
 *   npm run hrm:chuan-hoa-thue -- --thu   # CHẾ ĐỘ RÀ SOÁT: chỉ đọc và in, KHÔNG ghi dòng nào
 *   npm run hrm:chuan-hoa-thue            # CHẾ ĐỘ CHUẨN HÓA: có ghi (xem giới hạn ghi bên dưới)
 *   npm run hrm:chuan-hoa-thue -- --json  # xuất JSON đầy đủ (kết hợp được với --thu)
 *
 * ===== CHẠY `--thu` TRƯỚC. LUÔN LUÔN. =====
 *
 * Chế độ có ghi ĐÈ cấu hình đang chạy của khách hàng. Đọc bảng đối soát của lượt `--thu` và xác
 * nhận cột "cần xem lại" trước khi bỏ cờ.
 *
 * ===== RANH GIỚI GHI — ĐIỀU QUAN TRỌNG NHẤT CỦA SCRIPT NÀY =====
 *
 * Script CHỈ ghi đè khi biểu thuế đang lưu **trùng khớp nguyên văn** biểu 5 bậc cắt cụt cũ
 * (`BIEU_THUE_5_BAC_CU`: đủ 5 bậc, đúng từng cặp ngưỡng–thuế suất, bậc cuối là mốc số
 * `999999999999` đúng như bản cũ đã ghi xuống). Trùng khớp nguyên văn nghĩa là công ty **chưa hề
 * chỉnh tay** — giá trị đó do hệ thống tự nạp sai, nên sửa lại là sửa lỗi của mình.
 *
 * Mọi biểu khác — kể cả biểu 5 bậc mà bậc cuối đã là `null`, kể cả biểu lệch chuẩn — đều **GIỮ
 * NGUYÊN** và chỉ được liệt kê ra. Ghi đè cấu hình người dùng đã cố ý đặt là phá dữ liệu, kể cả
 * khi ta cho rằng họ đặt sai (`BR-hrm-083`). Ranh giới "trùng khớp nguyên văn" là ranh giới DUY
 * NHẤT phân biệt được *lỗi của hệ thống* với *lựa chọn của người dùng*.
 *
 * ===== BỐN KẾT LUẬN CHO MỖI CÔNG TY =====
 *
 *   • `dung-chuan`     — đã là biểu 7 bậc chuẩn. Không đụng.
 *   • `bieu-5-bac-cu`  — đang giữ nguyên văn biểu 5 bậc cắt cụt ⇒ ĐƯỢC ghi đè.
 *   • `can-xem-lai`    — công ty đã tự đặt biểu khác. Giữ nguyên, liệt kê để chủ tài khoản quyết.
 *   • `chua-co-ban-ghi`— chưa từng mở màn Cấu hình. Không cần làm gì: lần `GET` đầu tiên sẽ tự
 *                        nạp biểu chuẩn 7 bậc (self-healing, `BR-hrm-070`).
 *
 * CHẠY LẠI ĐƯỢC NHIỀU LẦN CHO CÙNG KẾT QUẢ: sau lượt ghi, công ty vừa chuẩn hóa chuyển sang
 * `dung-chuan` nên lượt hai không ghi thêm gì và cho cùng bảng đối soát (`AC-hrm-71`).
 *
 * Mỗi lần ghi sinh đúng một dòng nhật ký kiểm toán qua `writeLog` (`BR-hrm-066` nhóm 6), khóa
 * nghiệp vụ `"DEFAULT"`. Nhật ký không có `userId` vì đây là thao tác vận hành, không phải người
 * dùng nào bấm — `hanhDong` đã nói rõ điều đó.
 *
 * ⚠️ Tenant chưa chạy `npm run sync:tenants` thì **chưa có bảng `hrm_general_settings`**. Script
 * nhận diện bằng `information_schema` và bỏ qua tenant đó (đếm vào cột "không chạy được"), các
 * tenant khác vẫn chạy bình thường. Script này KHÔNG tự chạy `sync:tenants`.
 *
 * ===== CỬA SỔ TƯƠNG THÍCH NGƯỢC ĐÓNG KHI NÀO =====
 *
 * Validator đang chấp nhận mốc `999999999999` ở bậc cuối và tự chuẩn hóa về `null`
 * (`MOC_TUONG_THICH_BAC_MO`, ADR-009 QĐ 1 quy tắc 4). Cửa đó chỉ được gỡ khi script này chạy xong
 * trên toàn bộ công ty và cột "cần xem lại" đã được xử lý hết.
 */

/** Kết luận cho một công ty. */
type KetLuan = 'dung-chuan' | 'bieu-5-bac-cu' | 'can-xem-lai' | 'chua-co-ban-ghi';

interface DongBaoCao {
  maSoThue: string;
  dbName: string;
  status: string;
  ketLuan?: KetLuan;
  /** Số bậc của biểu đang lưu — để người đọc biết công ty `can-xem-lai` đang giữ biểu thế nào. */
  soBac?: number;
  /** Đã thực sự ghi đè trong lượt này (chế độ rà soát luôn là `false`). */
  daGhi: boolean;
  loi?: string;
}

/** Bảng `hrm_general_settings` đã được cấp cho tenant này chưa. */
async function coBangCauHinh(db: PrismaClient): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'hrm_general_settings'`,
  );
  return Number(rows[0].n) > 0;
}

async function xuLyMotTenant(
  dbName: string,
  chayThu: boolean,
): Promise<{ ketLuan: KetLuan; soBac?: number; daGhi: boolean }> {
  const db = getTenantDb(dbName);

  if (!(await coBangCauHinh(db))) {
    throw new Error(
      'Chưa có bảng hrm_general_settings — tenant này chưa chạy `npm run sync:tenants`.',
    );
  }

  const banGhi = await db.generalSetting.findUnique({
    where: { id: SINGLETON_ID },
    select: { taxBrackets: true },
  });

  if (!banGhi) {
    return { ketLuan: 'chua-co-ban-ghi', daGhi: false };
  }

  const bieu = banGhi.taxBrackets;
  const soBac = Array.isArray(bieu) ? bieu.length : undefined;

  if (laBieuThueTrungKhop(bieu, BIEU_THUE_CHUAN_7_BAC)) {
    return { ketLuan: 'dung-chuan', soBac, daGhi: false };
  }

  if (!laBieuThueTrungKhop(bieu, BIEU_THUE_5_BAC_CU)) {
    // Công ty đã tự đặt biểu — giữ nguyên, chỉ liệt kê.
    return { ketLuan: 'can-xem-lai', soBac, daGhi: false };
  }

  if (chayThu) {
    return { ketLuan: 'bieu-5-bac-cu', soBac, daGhi: false };
  }

  await db.generalSetting.update({
    where: { id: SINGLETON_ID },
    data: {
      taxBrackets: BIEU_THUE_CHUAN_7_BAC as unknown as Prisma.InputJsonValue,
    },
  });

  return { ketLuan: 'bieu-5-bac-cu', soBac, daGhi: true };
}

const NHAN: Record<KetLuan, string> = {
  'dung-chuan': 'đúng biểu chuẩn 7 bậc',
  'bieu-5-bac-cu': 'đang giữ nguyên biểu 5 bậc cắt cụt',
  'can-xem-lai': 'đã tự đặt biểu khác — CẦN NGƯỜI XEM LẠI',
  'chua-co-ban-ghi': 'chưa có bản ghi cấu hình (sẽ tự nạp biểu chuẩn khi mở lần đầu)',
};

async function main(): Promise<void> {
  const chayThu =
    process.argv.includes('--thu') || process.argv.includes('--dry-run');
  const raJson = process.argv.includes('--json');

  const companies = await sysPrisma.donVi.findMany({
    where: { dbName: { not: null } },
    select: { id: true, maSoThue: true, dbName: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    console.log('Không có tenant nào để rà soát.');
    return;
  }

  if (!raJson) {
    console.log(
      `Rà soát biểu thuế TNCN trên ${companies.length} tenant` +
        `${chayThu ? ' — CHẾ ĐỘ RÀ SOÁT, không ghi dòng nào' : ' — CHẾ ĐỘ CHUẨN HÓA, CÓ GHI'}...\n`,
    );
  }

  const baoCao: DongBaoCao[] = [];
  for (const c of companies) {
    const dbName = c.dbName as string;
    const dong: DongBaoCao = {
      maSoThue: c.maSoThue,
      dbName,
      status: c.status,
      daGhi: false,
    };

    try {
      Object.assign(dong, await xuLyMotTenant(dbName, chayThu));
    } catch (err) {
      // Một tenant hỏng KHÔNG được làm dừng cả lượt — ghi lại rồi đi tiếp.
      dong.loi = (err as Error).message;
    }
    baoCao.push(dong);

    if (dong.daGhi) {
      await writeLog({
        hanhDong: 'HRM_CHUAN_HOA_BIEU_THUE',
        donViId: c.id,
        chiTiet: { khoaNghiepVu: SINGLETON_ID, maSoThue: c.maSoThue },
      });
    }

    if (raJson) continue;

    if (dong.loi) {
      console.error(`  ✗ ${dbName} (MST ${c.maSoThue}): ${dong.loi}`);
      continue;
    }
    const dauHieu = dong.ketLuan === 'can-xem-lai' ? '!' : '✓';
    console.log(
      `  ${dauHieu} ${dbName} (MST ${c.maSoThue}, ${c.status}): ${NHAN[dong.ketLuan as KetLuan]}` +
        `${dong.soBac !== undefined ? ` — ${dong.soBac} bậc` : ''}` +
        `${dong.daGhi ? ' ⇒ ĐÃ GHI biểu 7 bậc chuẩn' : ''}` +
        `${!dong.daGhi && chayThu && dong.ketLuan === 'bieu-5-bac-cu' ? ' ⇒ SẼ ghi khi chạy thật' : ''}`,
    );
  }

  if (raJson) {
    console.log(JSON.stringify(baoCao, null, 2));
    return;
  }

  // ĐỐI SOÁT CUỐI — bắt buộc theo FR-hrm-055 điểm 4.
  const dem = (k: KetLuan) => baoCao.filter((d) => !d.loi && d.ketLuan === k).length;
  const daChuanHoa = baoCao.filter((d) => d.daGhi).length;
  const seChuanHoa = dem('bieu-5-bac-cu');
  const canXemLai = dem('can-xem-lai');
  const soLoi = baoCao.filter((d) => d.loi).length;

  console.log(
    `\n===== ĐỐI SOÁT =====\n` +
      `  Đúng biểu chuẩn 7 bậc            : ${dem('dung-chuan')}\n` +
      `  Chưa có bản ghi cấu hình         : ${dem('chua-co-ban-ghi')}\n` +
      `  ${chayThu ? 'Sẽ được chuẩn hóa                ' : 'Đã chuẩn hóa trong lượt này      '}: ` +
      `${chayThu ? seChuanHoa : daChuanHoa}\n` +
      `  Cần người xem lại (giữ nguyên)   : ${canXemLai}\n` +
      `  Không chạy được                  : ${soLoi}\n` +
      `  Tổng                             : ${companies.length}`,
  );

  if (canXemLai > 0) {
    console.log(
      `\n${canXemLai} công ty đã tự đặt biểu thuế riêng — script KHÔNG đụng tới, đúng BR-hrm-083.\n` +
        'Gửi danh sách trên cho chủ tài khoản từng công ty tự quyết có đổi về biểu chuẩn hay không.',
    );
  }

  if (soLoi > 0) {
    console.log(
      `\n${soLoi} tenant không rà được. Nếu lý do là thiếu bảng hrm_general_settings thì phải chạy\n` +
        '`npm run sync:tenants` trước (thao tác RIÊNG, chủ dự án tự quyết — nó dùng\n' +
        '`prisma db push --accept-data-loss`).',
    );
    process.exitCode = 1;
  }

  console.log(
    chayThu
      ? '\nRà soát xong, chưa ghi gì. Bỏ cờ --thu để chuẩn hóa thật.'
      : '\nChuẩn hóa xong. Chạy lại lệnh này lần nữa: kết quả phải giữ nguyên và số "đã chuẩn hóa"\n' +
          'phải bằng 0 — đó là phép kiểm tính chạy-lại-cùng-kết-quả (AC-hrm-71).',
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
