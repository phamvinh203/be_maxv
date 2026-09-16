import { sysPrisma } from '../../config/db.sys';
import { getTenantDb, disconnectAllTenants } from '../../helpers/tenantClient';
import { writeLog } from '../../services/shared/syslog.service';
import type { PrismaClient, Prisma } from '../../generated/tenant';
import {
  BIEU_THUE_5_BAC_CU,
  BIEU_THUE_7_BAC_CU,
  BIEU_THUE_CHUAN_5_BAC,
  SINGLETON_ID,
  khoiTaoCauHinhMacDinh,
  laBieuThueTrungKhop,
} from '../../services/client/hrm/cau_hinh_mac_dinh/generalSettings.service';

/**
 * RÀ SOÁT VÀ CHUẨN HÓA THAM SỐ THUẾ TNCN TRÊN MỌI TENANT — `FR-hrm-055` (BA chốt QĐ #22 điểm 3).
 *
 * Đợt 2026-09-14 mở rộng phạm vi theo Luật Thuế TNCN số 109/2025/QH15 + Nghị quyết
 * 110/2025/UBTVQH15 + Nghị định 253/2026/NĐ-CP: ngoài biểu thuế, script rà thêm **bốn tham số
 * số học** (2 mức giảm trừ gia cảnh, trần miễn thuế ăn ca, ngưỡng khấu trừ 10%), và nhận diện
 * thêm **biểu 7 bậc cũ** (Điều 22 Luật 04/2007/QH12) là biểu lỗi thời cần chuẩn hóa — trước đợt
 * này chính nó mới là biểu chuẩn.
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
 * Script CHỈ ghi đè từng tham số khi giá trị đang lưu **trùng khớp nguyên văn** một bộ số cũ mà
 * hệ thống từng tự nạp — biểu `BIEU_THUE_5_BAC_CU` (cắt cụt ở 25%, bậc cuối là mốc
 * `999999999999`), biểu `BIEU_THUE_7_BAC_CU` (Điều 22 Luật cũ), hai mức giảm trừ
 * 11.000.000/4.400.000 theo NQ 954/2020, trần ăn ca 730.000 (TT 26/2016) hoặc ngưỡng khấu trừ
 * 10% mức 2.000.000 (Điều 25 TT 111/2013). Trùng khớp nguyên văn nghĩa là công ty **chưa hề chỉnh
 * tay** — giá trị đó do hệ thống tự nạp, nên thay bằng bộ số đúng luật là sửa lỗi của mình.
 *
 * Mọi giá trị khác đều **GIỮ NGUYÊN** và chỉ được liệt kê ra. Ghi đè cấu hình người dùng đã cố ý
 * đặt là phá dữ liệu, kể cả khi ta cho rằng họ đặt sai (`BR-hrm-083`). Ranh giới "trùng khớp
 * nguyên văn" là ranh giới DUY NHẤT phân biệt được *lỗi của hệ thống* với *lựa chọn của người
 * dùng*. Từng tham số xét độc lập: công ty tự sửa mức giảm trừ nhưng vẫn giữ nguyên biểu cũ thì
 * biểu vẫn được chuẩn hóa, còn mức giảm trừ giữ nguyên và được liệt kê.
 *
 * ===== BỐN KẾT LUẬN CHO MỖI CÔNG TY =====
 *
 *   • `dung-chuan`     — mọi tham số đã đúng luật hiện hành. Không đụng.
 *   • `se-chuan-hoa`   — có tham số đang giữ nguyên văn bộ số cũ ⇒ ĐƯỢC ghi đè.
 *   • `can-xem-lai`    — công ty đã tự đặt giá trị riêng. Giữ nguyên, liệt kê để chủ tài khoản
 *                        quyết (vẫn chuẩn hóa những tham số khác còn nguyên văn bộ số cũ).
 *   • `chua-co-ban-ghi`— chưa từng mở màn Cấu hình. Không cần làm gì: lần `GET` đầu tiên sẽ tự
 *                        nạp bộ chuẩn hiện hành (self-healing, `BR-hrm-070`).
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
type KetLuan = 'dung-chuan' | 'se-chuan-hoa' | 'can-xem-lai' | 'chua-co-ban-ghi';

/** Giảm trừ gia cảnh theo NQ 954/2020/UBTVQH14 — chỉ dùng để NHẬN DIỆN dữ liệu cũ, không nạp lại. */
const GIAM_TRU_BAN_THAN_CU = 11_000_000;
const GIAM_TRU_PHU_THUOC_CU = 4_400_000;
/** Trần ăn ca TT 26/2016/TT-BLĐTBXH và ngưỡng khấu trừ 10% Điều 25 TT 111/2013 — cũng chỉ để nhận diện. */
const TRAN_AN_CA_CU = 730_000;
const NGUONG_KHAU_TRU_CU = 2_000_000;

interface DongBaoCao {
  maSoThue: string;
  dbName: string;
  status: string;
  ketLuan?: KetLuan;
  /** Số bậc của biểu đang lưu — để người đọc biết công ty `can-xem-lai` đang giữ biểu thế nào. */
  soBac?: number;
  /** Tham số còn nguyên văn bộ số cũ ⇒ được/đã ghi đè trong lượt này. */
  canGhi?: string[];
  /** Tham số công ty đã tự đặt ⇒ giữ nguyên, chờ chủ tài khoản quyết. */
  xemLai?: string[];
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
): Promise<{
  ketLuan: KetLuan;
  soBac?: number;
  canGhi: string[];
  xemLai: string[];
  daGhi: boolean;
}> {
  const db = getTenantDb(dbName);

  if (!(await coBangCauHinh(db))) {
    throw new Error(
      'Chưa có bảng hrm_general_settings — tenant này chưa chạy `npm run sync:tenants`.',
    );
  }

  const banGhi = await db.generalSetting.findUnique({
    where: { id: SINGLETON_ID },
    select: {
      taxBrackets: true,
      personalDeduction: true,
      dependentDeduction: true,
      lunchAllowanceTaxFreeCap: true,
      withholdingTaxThreshold: true,
    },
  });

  if (!banGhi) {
    return { ketLuan: 'chua-co-ban-ghi', canGhi: [], xemLai: [], daGhi: false };
  }

  // Bộ số đúng luật lấy thẳng từ nguồn self-healing — script không giữ bản sao riêng để khỏi lệch.
  const macDinh = khoiTaoCauHinhMacDinh();
  const bieu = banGhi.taxBrackets;
  const soBac = Array.isArray(bieu) ? bieu.length : undefined;
  const canGhi: string[] = [];
  const xemLai: string[] = [];
  const data: Prisma.GeneralSettingUpdateInput = {};

  if (!laBieuThueTrungKhop(bieu, BIEU_THUE_CHUAN_5_BAC)) {
    const heThongTuNap =
      laBieuThueTrungKhop(bieu, BIEU_THUE_5_BAC_CU) ||
      laBieuThueTrungKhop(bieu, BIEU_THUE_7_BAC_CU);
    if (heThongTuNap) {
      canGhi.push('biểu thuế');
      data.taxBrackets = macDinh.taxBrackets as unknown as Prisma.InputJsonValue;
    } else {
      xemLai.push('biểu thuế');
    }
  }

  const thamSoSo = [
    {
      ten: 'giảm trừ bản thân',
      dangLuu: Number(banGhi.personalDeduction),
      cu: GIAM_TRU_BAN_THAN_CU,
      moi: macDinh.personalDeduction,
      dat: () => (data.personalDeduction = macDinh.personalDeduction),
    },
    {
      ten: 'giảm trừ người phụ thuộc',
      dangLuu: Number(banGhi.dependentDeduction),
      cu: GIAM_TRU_PHU_THUOC_CU,
      moi: macDinh.dependentDeduction,
      dat: () => (data.dependentDeduction = macDinh.dependentDeduction),
    },
    {
      ten: 'trần miễn thuế ăn ca',
      dangLuu: Number(banGhi.lunchAllowanceTaxFreeCap),
      cu: TRAN_AN_CA_CU,
      moi: macDinh.lunchAllowanceTaxFreeCap,
      dat: () =>
        (data.lunchAllowanceTaxFreeCap = macDinh.lunchAllowanceTaxFreeCap),
    },
    {
      ten: 'ngưỡng khấu trừ 10%',
      dangLuu: Number(banGhi.withholdingTaxThreshold),
      cu: NGUONG_KHAU_TRU_CU,
      moi: macDinh.withholdingTaxThreshold,
      dat: () =>
        (data.withholdingTaxThreshold = macDinh.withholdingTaxThreshold),
    },
  ];

  for (const g of thamSoSo) {
    if (g.dangLuu === g.moi) continue;
    if (g.dangLuu === g.cu) {
      canGhi.push(g.ten);
      g.dat();
    } else {
      xemLai.push(g.ten);
    }
  }

  const ketLuan: KetLuan =
    xemLai.length > 0
      ? 'can-xem-lai'
      : canGhi.length > 0
        ? 'se-chuan-hoa'
        : 'dung-chuan';

  if (chayThu || canGhi.length === 0) {
    return { ketLuan, soBac, canGhi, xemLai, daGhi: false };
  }

  await db.generalSetting.update({ where: { id: SINGLETON_ID }, data });

  return { ketLuan, soBac, canGhi, xemLai, daGhi: true };
}

const NHAN: Record<KetLuan, string> = {
  'dung-chuan': 'đúng bộ chuẩn hiện hành (biểu 5 bậc, giảm trừ 15.5tr/6.2tr)',
  'se-chuan-hoa': 'đang giữ nguyên bộ số cũ',
  'can-xem-lai': 'đã tự đặt giá trị riêng — CẦN NGƯỜI XEM LẠI',
  'chua-co-ban-ghi': 'chưa có bản ghi cấu hình (sẽ tự nạp bộ chuẩn khi mở lần đầu)',
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
    const coGhi = (dong.canGhi ?? []).length > 0;
    console.log(
      `  ${dauHieu} ${dbName} (MST ${c.maSoThue}, ${c.status}): ${NHAN[dong.ketLuan as KetLuan]}` +
        `${dong.soBac !== undefined ? ` — ${dong.soBac} bậc` : ''}` +
        `${(dong.xemLai ?? []).length > 0 ? ` — giữ nguyên: ${dong.xemLai?.join(', ')}` : ''}` +
        `${dong.daGhi ? ` ⇒ ĐÃ GHI: ${dong.canGhi?.join(', ')}` : ''}` +
        `${!dong.daGhi && chayThu && coGhi ? ` ⇒ SẼ ghi: ${dong.canGhi?.join(', ')}` : ''}`,
    );
  }

  if (raJson) {
    console.log(JSON.stringify(baoCao, null, 2));
    return;
  }

  // ĐỐI SOÁT CUỐI — bắt buộc theo FR-hrm-055 điểm 4.
  const dem = (k: KetLuan) => baoCao.filter((d) => !d.loi && d.ketLuan === k).length;
  const daChuanHoa = baoCao.filter((d) => d.daGhi).length;
  // Công ty `can-xem-lai` vẫn có thể có tham số khác được chuẩn hóa — đếm theo việc có gì để ghi,
  // không đếm theo kết luận, nếu không con số "sẽ chuẩn hóa" sẽ nói dối.
  const seChuanHoa = baoCao.filter((d) => !d.loi && (d.canGhi ?? []).length > 0).length;
  const canXemLai = dem('can-xem-lai');
  const soLoi = baoCao.filter((d) => d.loi).length;

  console.log(
    `\n===== ĐỐI SOÁT =====\n` +
      `  Đúng bộ chuẩn hiện hành          : ${dem('dung-chuan')}\n` +
      `  Chưa có bản ghi cấu hình         : ${dem('chua-co-ban-ghi')}\n` +
      `  ${chayThu ? 'Sẽ được chuẩn hóa                ' : 'Đã chuẩn hóa trong lượt này      '}: ` +
      `${chayThu ? seChuanHoa : daChuanHoa}\n` +
      `  Cần người xem lại (giữ nguyên)   : ${canXemLai}\n` +
      `  Không chạy được                  : ${soLoi}\n` +
      `  Tổng                             : ${companies.length}`,
  );

  if (canXemLai > 0) {
    console.log(
      `\n${canXemLai} công ty đã tự đặt giá trị riêng — script KHÔNG đụng tới, đúng BR-hrm-083.\n` +
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
