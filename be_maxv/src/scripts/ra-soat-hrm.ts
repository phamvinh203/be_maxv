import { sysPrisma } from '../config/db.sys';
import {
  raSoatTenant,
  type KetQuaRaSoat,
} from '../services/shared/hrmTenantConstraints';

/**
 * RÀ SOÁT DỮ LIỆU HRM TRÊN MỌI TENANT — **chỉ đọc, không ghi một dòng nào**.
 *
 *   npm run hrm:ra-soat            # in tóm tắt + tối đa 20 dòng mẫu mỗi mục
 *   npm run hrm:ra-soat -- --json  # xuất JSON đầy đủ để đưa vào bảng tính gửi khách
 *
 * ===== VÌ SAO PHẢI CHẠY TRƯỚC =====
 *
 * Bốn ràng buộc của đợt P0 áp lên DỮ LIỆU ĐANG CHẠY, và cả bốn đều **từ chối tạo** nếu tenant
 * đã có dòng vi phạm. Mã nguồn chưa bao giờ chặn mấy thứ này nên khả năng cao là có:
 *
 *   1. `luong-0`            — hợp đồng lương chính bằng 0 (nhiều khả năng từ `backfill-hop-dong.ts`).
 *                             Bật ràng buộc lương mà chưa dọn thì **mọi lần sửa hợp đồng cũ đều
 *                             fail**, kể cả khi người dùng chỉ sửa một ô ghi chú — đường sửa là
 *                             thay toàn bộ bản ghi chứ không vá từng trường (BR-hrm-057/058).
 *   2. `so-hd-trung`        — số hợp đồng trùng trong công ty (BR-hrm-056).
 *   3. `hop-dong-chong-lan` — hai hợp đồng CÙNG NHÓM giao nhau về ngày (BR-hrm-022).
 *   4. `npt-trung-mst`      — hai người phụ thuộc cùng mã số thuế, kỳ giảm trừ GIAO NHAU
 *                             (BR-hrm-030). Đọc kỹ hai cột `a_da_xoa` / `b_da_xoa`: cặp nào có
 *                             một bên thuộc nhân viên đã xóa mềm thì **KHÔNG phải dọn** theo luật
 *                             nghiệp vụ — nhưng ràng buộc ở tầng cơ sở dữ liệu vẫn chặn nó (nợ kỹ
 *                             thuật đã chấp nhận, `data-model.md` M-09). Cặp đó cần quyết riêng.
 *
 * Mục 1 và 2 gộp chung một đợt rà với mục 3 và 4 để chỉ phải gián đoạn dịch vụ MỘT lần.
 *
 * Kết quả rà xong KHÔNG tự dọn: cách chốt ngày cho từng cặp hợp đồng chồng lấn là quyết định
 * nghiệp vụ của kế toán, không phải việc script đoán thay.
 */

interface DongBaoCao {
  maSoThue: string;
  dbName: string;
  status: string;
  ketQua?: KetQuaRaSoat;
  loi?: string;
}

async function main(): Promise<void> {
  const raJson = process.argv.includes('--json');

  const companies = await sysPrisma.donVi.findMany({
    where: { dbName: { not: null } },
    select: { maSoThue: true, dbName: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    console.log('Không có tenant nào để rà soát.');
    return;
  }

  if (!raJson) {
    console.log(`Rà soát dữ liệu HRM trên ${companies.length} tenant (CHỈ ĐỌC)...\n`);
  }

  const baoCao: DongBaoCao[] = [];
  let tongViPham = 0;

  for (const c of companies) {
    const dbName = c.dbName as string;
    const dong: DongBaoCao = {
      maSoThue: c.maSoThue,
      dbName,
      status: c.status,
    };
    try {
      dong.ketQua = await raSoatTenant(dbName);
    } catch (err) {
      // Tenant hỏng/không kết nối được KHÔNG được làm dừng cả lượt — ghi lại rồi đi tiếp,
      // nếu không thì một công ty đã ARCHIVED cũng đủ che mất báo cáo của mọi công ty sau nó.
      dong.loi = (err as Error).message;
    }
    baoCao.push(dong);

    if (raJson) continue;

    if (dong.loi) {
      console.log(`✗ ${dbName} (MST ${c.maSoThue}): ${dong.loi}`);
      continue;
    }

    const viPham = dong.ketQua!.theoMuc.filter((m) => m.soDong > 0);
    tongViPham += viPham.reduce((t, m) => t + m.soDong, 0);
    if (viPham.length === 0) {
      console.log(`✓ ${dbName} (MST ${c.maSoThue}) — sạch`);
      continue;
    }

    console.log(`! ${dbName} (MST ${c.maSoThue})`);
    for (const m of viPham) {
      console.log(`    - ${m.ma}: ${m.soDong} dòng — ${m.ten}`);
      for (const dongMau of m.mau) {
        console.log(`        ${JSON.stringify(dongMau)}`);
      }
      if (m.soDong > m.mau.length) {
        console.log(`        … còn ${m.soDong - m.mau.length} dòng nữa (dùng --json để xem đủ)`);
      }
    }
  }

  if (raJson) {
    console.log(JSON.stringify(baoCao, null, 2));
    return;
  }

  const soTenantBan = baoCao.filter(
    (d) => d.ketQua && d.ketQua.theoMuc.some((m) => m.soDong > 0),
  ).length;
  const soTenantLoi = baoCao.filter((d) => d.loi).length;

  console.log(
    `\nXong: ${soTenantBan}/${companies.length} tenant có dữ liệu cần dọn ` +
      `(${tongViPham} dòng), ${soTenantLoi} tenant không rà được.`,
  );
  if (soTenantBan > 0) {
    console.log(
      'Dọn xong mới chạy `npm run hrm:constraints`. Tenant nào còn bẩn thì ràng buộc của ' +
        'tenant đó bị bỏ qua, các tenant sạch vẫn áp được bình thường.',
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void sysPrisma.$disconnect());
