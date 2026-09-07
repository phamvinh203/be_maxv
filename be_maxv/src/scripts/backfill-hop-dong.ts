/**
 * BÙ DỮ LIỆU một lần: tạo dòng `hrm_hop_dong` cho nhân viên chưa có dòng nào.
 *
 * PHẢI CHẠY TRƯỚC khi xóa 6 cột đệm hợp đồng khỏi `hrm_nhan_vien` (so_hop_dong, loai_hop_dong,
 * kieu_luong, ngay_hieu_luc_toi, bhxh, tncn). Lý do: bản cũ của `POST /hrm/nhan-vien` bắt buộc
 * nhập số hợp đồng nhưng KHÔNG tạo dòng trong `hrm_hop_dong` — nên có thể tồn tại nhân viên mà
 * toàn bộ thông tin hợp đồng chỉ sống ở mấy cột đó. Xóa cột trước là mất trắng, không dựng lại
 * được từ đâu.
 *
 * An toàn khi chạy lại nhiều lần: chỉ đụng nhân viên có SỐ hợp đồng = 0.
 *
 *   npx tsx src/scripts/backfill-hop-dong.ts            # xem trước, KHÔNG ghi
 *   npx tsx src/scripts/backfill-hop-dong.ts --ghi      # ghi thật
 */
import { config } from 'dotenv';
config({
  path:
    process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local',
});

import { randomUUID } from 'node:crypto';
import { sysPrisma } from '../config/db.sys';
import { getTenantDb } from '../helpers/tenantClient';

const GHI = process.argv.includes('--ghi');

/** Hình dạng hàng đọc bằng SQL thô — mô tả các cột SẮP BỊ XÓA khỏi `hrm_nhan_vien`. */
interface HangNhanVien {
  ma_nv: string;
  ho_ten: string;
  so_hop_dong: string;
  loai_hop_dong: string;
  kieu_luong: string;
  ngay_vao_lam: Date;
  ngay_hieu_luc_toi: Date | null;
  bhxh: boolean;
  tncn: boolean;
}

/** Loại HĐ trên nhân viên (3 giá trị) -> loại trên lịch sử (giữ nguyên, lịch sử rộng hơn). */
function loaiHd(loaiTrenNhanVien: string): string {
  return loaiTrenNhanVien === 'hdvc' ? 'khoan' : loaiTrenNhanVien;
}

async function main() {
  const donVi = await sysPrisma.donVi.findMany({
    where: { status: 'READY', dbName: { not: null } },
    select: { maSoThue: true, tenDonVi: true, dbName: true },
  });

  let tong = 0;
  for (const dv of donVi) {
    const db = getTenantDb(dv.dbName!);

    /**
     * Đọc bằng SQL THÔ, không qua Prisma client: script này chạy TRƯỚC khi xóa cột, mà client
     * đã sinh lại theo schema MỚI (không còn mấy cột đó) nên `findMany` không gọi tới được.
     */
    let nhanVien: HangNhanVien[];
    try {
      nhanVien = await db.$queryRawUnsafe<HangNhanVien[]>(`
        SELECT ma_nv, ho_ten, so_hop_dong, loai_hop_dong, kieu_luong,
               ngay_vao_lam, ngay_hieu_luc_toi, bhxh, tncn
        FROM hrm_nhan_vien
      `);
    } catch (err) {
      // Cột đã bị xóa (đã chạy sync:tenants) hoặc tenant chưa có bảng hrm_* — cả hai đều là
      // "không có gì để bù", không phải sự cố.
      const msg = err instanceof Error ? err.message : String(err);
      if (/does not exist/i.test(msg)) {
        console.log(`${dv.maSoThue}: bỏ qua (${msg.split('\n')[0].trim()})`);
        continue;
      }
      throw err;
    }
    if (nhanVien.length === 0) continue;

    const daCo = new Set(
      (await db.hrm_hop_dong.groupBy({ by: ['ma_nv'] })).map((g) => g.ma_nv),
    );
    const thieu = nhanVien.filter((nv) => !daCo.has(nv.ma_nv));
    if (thieu.length === 0) continue;

    console.log(
      `\n${dv.maSoThue} — ${dv.tenDonVi}: ${thieu.length} nhân viên cần bù`,
    );
    for (const nv of thieu) {
      console.log(
        `  ${nv.ma_nv} ${nv.ho_ten} | "${nv.so_hop_dong}" ${nv.loai_hop_dong}/${nv.kieu_luong}` +
          ` từ ${nv.ngay_vao_lam.toISOString().slice(0, 10)}`,
      );
      if (!GHI) continue;

      await db.hrm_hop_dong.create({
        data: {
          id: randomUUID(),
          ma_nv: nv.ma_nv,
          so_hd: nv.so_hop_dong,
          loai_hd: loaiHd(nv.loai_hop_dong),
          kieu_luong: nv.kieu_luong,
          // Không có cột lương trên nhân viên — để 0, kế toán nhập lại ở tab hợp đồng.
          luong_chinh: 0,
          luong_bhxh: 0,
          // `ngay_vao_lam` = hiệu lực TỪ của hợp đồng ban đầu (theo spec nhân viên).
          ngay_bat_dau: nv.ngay_vao_lam,
          ngay_ket_thuc: nv.ngay_hieu_luc_toi,
          trich_bhxh: nv.bhxh,
          tinh_tncn: nv.tncn,
          ghi_chu:
            'Tự động dựng lại từ thông tin hợp đồng trên hồ sơ nhân viên.',
        },
      });
    }
    tong += thieu.length;
  }

  console.log(
    `\n${GHI ? 'ĐÃ BÙ' : 'SẼ BÙ'} ${tong} dòng hợp đồng.` +
      (GHI ? '' : ' Chạy lại với --ghi để thực hiện.'),
  );
  await sysPrisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
