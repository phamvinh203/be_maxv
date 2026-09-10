import { sysPrisma } from '../../config/db.sys';
import { applyTenantConstraints } from '../../services/shared/hrmTenantConstraints';

/**
 * ÁP RÀNG BUỘC HRM LÊN MỌI DB TENANT — idempotent, chạy lại bao nhiêu lần cũng được.
 *
 *   npm run hrm:constraints
 *
 * ⚠️ CHẠY `npm run hrm:ra-soat` TRƯỚC. Ràng buộc bị Postgres **từ chối tạo** nếu tenant đang có
 * dòng vi phạm; script này KHÔNG tự dọn dữ liệu (cách chốt ngày cho từng cặp hợp đồng chồng lấn
 * là quyết định của kế toán). Tenant nào còn bẩn thì riêng ràng buộc đó bị bỏ qua và ghi vào
 * mục "vướng dữ liệu"; các tenant sạch vẫn áp được bình thường — cố ý không dừng cả lượt.
 *
 * ⚠️ CHẠY LẠI SAU MỖI LẦN `npm run sync:tenants`. Tenant không có thư mục migrations, schema
 * được áp bằng `prisma db push`, và Prisma quản lý index theo `schema.prisma` — thứ nó không
 * biết **có thể** bị drop ở lần push kế tiếp (chưa đo, xem `data-model.md` Mục 8.0 điểm 3).
 * Script idempotent nên chạy thừa không hại gì; không chạy mới là rủi ro.
 *
 * Tenant cấp MỚI không cần chạy tay: `provisionTenant` đã gọi `applyTenantConstraints` ngay
 * sau bước đẩy schema.
 */
async function main(): Promise<void> {
  const companies = await sysPrisma.donVi.findMany({
    where: { dbName: { not: null } },
    select: { maSoThue: true, dbName: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    console.log('Không có tenant nào để áp ràng buộc.');
    return;
  }

  console.log(`Áp ràng buộc HRM cho ${companies.length} tenant...\n`);

  let ok = 0;
  let vuong = 0;
  let loi = 0;

  for (const c of companies) {
    const dbName = c.dbName as string;
    try {
      const kq = await applyTenantConstraints(dbName);
      if (kq.vuongDuLieu.length > 0) {
        vuong++;
        console.log(`! ${dbName} (MST ${c.maSoThue}) — còn dữ liệu vi phạm:`);
        for (const v of kq.vuongDuLieu) {
          console.log(`    - ${v.ten} [SQLSTATE ${v.sqlstate}]`);
          console.log(`      ${v.chiTiet.split('\n')[0]}`);
        }
        console.log(
          `    Đã áp được: ${kq.daAp.length} mục; đã có sẵn: ${kq.daCoSan.length} mục.`,
        );
      } else {
        ok++;
        console.log(
          `✓ ${dbName} (MST ${c.maSoThue}, ${c.status}) — áp ${kq.daAp.length}, ` +
            `đã có sẵn ${kq.daCoSan.length}`,
        );
      }
    } catch (err) {
      loi++;
      console.error(`✗ ${dbName} (MST ${c.maSoThue}): ${(err as Error).message}`);
    }
  }

  console.log(
    `\nXong: ${ok} tenant đủ ràng buộc, ${vuong} tenant còn dữ liệu phải dọn, ${loi} tenant lỗi.`,
  );
  if (vuong > 0) {
    console.log(
      'Chạy `npm run hrm:ra-soat` để lấy danh sách dòng cần dọn, dọn xong chạy lại script này.',
    );
  }
  // Chỉ coi là THẤT BẠI khi có sự cố kỹ thuật. "Còn dữ liệu phải dọn" là kết quả hợp lệ của
  // một lượt chạy đúng — báo động giả ở đây làm CI đỏ vì chuyện nghiệp vụ chưa xong.
  if (loi > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void sysPrisma.$disconnect());
