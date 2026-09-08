import { randomUUID } from 'node:crypto';
import { sysPrisma } from '../config/db.sys';
import { getTenantDb } from '../helpers/tenantClient';

/**
 * CHUYỂN CON TRỎ FILE SCAN TỪ `hrm_tai_lieu` SANG BẢNG CON `hrm_tai_lieu_file`.
 * Bước 2 của `docs/hrm/architecture/data-model.md` M-14 (QĐ #21, BR-hrm-037).
 *
 *   npm run hrm:chuyen-file            # chạy thật (chỉ ĐỌC + CHÈN)
 *   npm run hrm:chuyen-file -- --thu   # chạy thử: đếm và in, KHÔNG chèn dòng nào
 *
 * ===== ĐỌC TRƯỚC KHI CHẠY =====
 *
 * Phải chạy `npm run sync:tenants` TRƯỚC (bước 1) để mọi tenant đã có bảng `hrm_tai_lieu_file`.
 * Tenant nào chưa có bảng sẽ báo lỗi và bị bỏ qua, các tenant khác vẫn chạy bình thường.
 *
 * Script này **CHỈ ĐỌC VÀ CHÈN**. Không DROP, không UPDATE, không DELETE — bốn cột con trỏ cũ
 * trên `hrm_tai_lieu` được giữ nguyên si. Đó là chủ ý: chúng là bản gốc duy nhất còn lại để
 * đối chiếu (bước 3) và để dựng lại nếu bước chuyển sai. Chỉ khi số liệu khớp mới bỏ cột
 * (bước 4) — và bỏ cột là thao tác RIÊNG, không nằm trong script này.
 *
 * IDEMPOTENT: dòng đích được nhận diện theo cặp (`tai_lieu_id`, `drive_file_id`). Chạy lại lần
 * hai không nhân đôi. Cố ý KHÔNG dựa vào ràng buộc duy nhất ở DB — M-14 đã chốt là không đặt
 * `@@unique` trên `drive_file_id` (Google cấp lại id được, ràng buộc đó chặn oan).
 *
 * `thu_tu = 0` cho mọi dòng chuyển sang: mỗi giấy tờ cũ chỉ có đúng một file nên không có thứ
 * tự nào để giữ. File tải lên sau đó nhận `thu_tu` kế tiếp (`thuTuKeTiep`).
 *
 * ===== BƯỚC 3 — ĐỐI CHIẾU, KHÔNG PHẢI THỦ TỤC CHO ĐẸP =====
 *
 * Script in cho TỪNG tenant: số dòng nguồn (`hrm_tai_lieu` có `drive_file_id` khác rỗng), số
 * dòng đích (`hrm_tai_lieu_file`), và **số dòng còn thiếu**. Ngay sau khi chuyển, nguồn và đích
 * phải BẰNG NHAU đúng như M-14 bước 3 nói. Về sau hai số này tách nhau ra một cách hợp lệ —
 * file đính thêm sau đó chỉ vào bảng con, không ghi vào bốn cột cũ nữa — nên con số phải canh
 * là **còn thiếu = 0**. Còn thiếu khác 0 thì DỪNG, đừng đi tiếp sang bước bỏ cột:
 * `prisma db push --accept-data-loss` không hỏi lại và không có đường lùi, đây là lần duy nhất
 * phát hiện được sai sót trước khi dữ liệu mất hẳn.
 */

interface SoLieuTenant {
  /** Số dòng `hrm_tai_lieu` có `drive_file_id` khác rỗng — NGUỒN. */
  nguon: number;
  /** Tổng số dòng `hrm_tai_lieu_file` sau lượt chạy — ĐÍCH (con số M-14 bước 3 nói tới). */
  dich: number;
  /** Số dòng vừa chèn trong lượt này. */
  daChen: number;
  /** Số dòng nguồn bỏ qua vì đích đã có cặp (tai_lieu_id, drive_file_id) tương ứng. */
  daCo: number;
  /**
   * Số dòng nguồn CHƯA có mặt ở đích. Phải bằng 0 — đây mới là phép kiểm an toàn thật sự.
   *
   * `dich === nguon` của M-14 chỉ đúng NGAY SAU khi chuyển: từ lúc đó người dùng đính thêm
   * file là `dich` lớn hơn `nguon` một cách hợp lệ (file mới không ghi vào bốn cột cũ nữa).
   * Con số cần canh để không mất dữ liệu là `conThieu`.
   */
  conThieu: number;
}

interface DongBaoCao extends SoLieuTenant {
  maSoThue: string;
  dbName: string;
  status: string;
  loi?: string;
}

async function chuyenMotTenant(
  dbName: string,
  chayThu: boolean,
): Promise<SoLieuTenant> {
  const db = getTenantDb(dbName);

  /*
   * NGUỒN đọc bằng SQL THUẦN, cố ý — không dùng client Prisma đã sinh.
   *
   * Bốn cột nguồn đã bị bỏ khỏi `schema.prisma` sau khi môi trường phát triển migrate xong
   * (2026-09-08), nên client sinh ra không còn biết chúng và mọi truy vấn có kiểu sẽ không
   * biên dịch được. Nhưng script này VẪN CẦN DÙNG: production chưa migrate, và ở đó bốn cột
   * còn nguyên. SQL thuần chạy được ở cả hai trạng thái schema.
   *
   * Tenant nào đã bỏ cột thì `information_schema` không thấy → coi như không còn gì để chuyển.
   * Đây là điều kiện dừng đúng, không phải lỗi: đã bỏ cột nghĩa là đã chuyển xong.
   *
   * `null` và chuỗi rỗng đều là "chưa đính file" — chuỗi rỗng không phải giả định thừa, cột
   * này từng được ghi bằng `''` ở đường cũ.
   */
  const coCotCu = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint n FROM information_schema.columns
      WHERE table_name = 'hrm_tai_lieu' AND column_name = 'drive_file_id'`,
  );
  const nguon =
    Number(coCotCu[0].n) === 0
      ? []
      : await db.$queryRawUnsafe<
          Array<{
            id: string;
            drive_file_id: string;
            ten_file: string | null;
            mime_type: string | null;
            kich_thuoc: number | null;
            datetime0: Date;
          }>
        >(
          `SELECT id, drive_file_id, ten_file, mime_type, kich_thuoc, datetime0
             FROM hrm_tai_lieu
            WHERE drive_file_id IS NOT NULL AND drive_file_id <> ''
            ORDER BY datetime0 ASC`,
        );

  // Ảnh chụp các cặp đã có ở đích, đọc MỘT lần thay vì hỏi DB từng dòng.
  const daCoSan = new Set(
    (
      await db.hrm_tai_lieu_file.findMany({
        select: { tai_lieu_id: true, drive_file_id: true },
      })
    ).map((f) => `${f.tai_lieu_id}|${f.drive_file_id}`),
  );

  let daChen = 0;
  let daCo = 0;
  for (const tl of nguon) {
    const driveFileId = tl.drive_file_id;
    if (daCoSan.has(`${tl.id}|${driveFileId}`)) {
      daCo++;
      continue;
    }
    if (!chayThu) {
      await db.hrm_tai_lieu_file.create({
        data: {
          id: randomUUID(),
          tai_lieu_id: tl.id,
          drive_file_id: driveFileId,
          // Ba cột cũ cho phép null nhưng cột mới thì không. Dòng nào thiếu thì điền giá trị
          // trung tính thay vì bỏ qua: mất con trỏ file là mất hẳn, còn tên/kiểu/cỡ chỉ ảnh
          // hưởng cách hiển thị và sửa lại được.
          ten_file: tl.ten_file ?? 'tai-lieu',
          mime_type: tl.mime_type ?? 'application/octet-stream',
          kich_thuoc: tl.kich_thuoc ?? 0,
          thu_tu: 0,
          datetime0: tl.datetime0,
        },
      });
    }
    // Đếm cả ở chế độ chạy thử: lúc đó con số mang nghĩa "SẼ chèn bấy nhiêu dòng".
    daChen++;
  }

  const dichThat = await db.hrm_tai_lieu_file.count();
  return {
    nguon: nguon.length,
    // Chạy thử chưa ghi gì nên báo con số SẼ có sau khi chạy thật, để đối chiếu được ngay.
    dich: chayThu ? dichThat + daChen : dichThat,
    daChen,
    daCo,
    // Sau lượt chạy thật, mọi dòng nguồn đều phải có mặt ở đích.
    conThieu: nguon.length - daCo - daChen,
  };
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
    console.log('Không có tenant nào để chuyển.');
    return;
  }

  console.log(
    `Chuyển con trỏ file scan sang hrm_tai_lieu_file trên ${companies.length} tenant` +
      `${chayThu ? ' — CHẠY THỬ, không chèn dòng nào' : ''}...\n`,
  );

  const baoCao: DongBaoCao[] = [];
  for (const c of companies) {
    const dbName = c.dbName as string;
    const dong: DongBaoCao = {
      maSoThue: c.maSoThue,
      dbName,
      status: c.status,
      nguon: 0,
      dich: 0,
      daChen: 0,
      daCo: 0,
      conThieu: 0,
    };
    try {
      Object.assign(dong, await chuyenMotTenant(dbName, chayThu));
    } catch (err) {
      // Một tenant hỏng KHÔNG được làm dừng cả lượt — ghi lại rồi đi tiếp, nếu không thì một
      // công ty đã ARCHIVED cũng đủ che mất báo cáo của mọi công ty sau nó.
      dong.loi = (err as Error).message;
    }
    baoCao.push(dong);

    if (dong.loi) {
      console.error(`  ✗ ${dbName} (MST ${c.maSoThue}): ${dong.loi}`);
      continue;
    }
    console.log(
      `  ${dong.conThieu === 0 ? '✓' : '✗'} ${dbName} (MST ${c.maSoThue}, ${c.status}): ` +
        `nguồn ${dong.nguon} — đích ${dong.dich} ` +
        `(${chayThu ? 'sẽ chèn' : 'chèn mới'} ${dong.daChen}, đã có sẵn ${dong.daCo}, ` +
        `còn thiếu ${dong.conThieu})`,
    );
    if (dong.dich > dong.nguon) {
      console.log(
        `      ghi chú: đích nhiều hơn nguồn ${dong.dich - dong.nguon} dòng — là file đính SAU ` +
          'khi đã chuyển (không ghi vào cột cũ nữa). Không phải lỗi.',
      );
    }
  }

  const soLoi = baoCao.filter((d) => d.loi).length;
  const soThieu = baoCao.filter((d) => !d.loi && d.conThieu > 0).length;

  console.log(
    `\nXong: ${baoCao.length - soLoi - soThieu}/${companies.length} tenant đã chuyển đủ, ` +
      `${soThieu} còn thiếu dòng, ${soLoi} không chạy được.`,
  );

  if (soThieu > 0 || soLoi > 0) {
    console.log(
      '\n🚨 DỪNG LẠI. Chưa được bỏ bốn cột drive_file_id/ten_file/mime_type/kich_thuoc khỏi\n' +
        '   prisma/tenant/schema.prisma. `db push --accept-data-loss` là DROP COLUMN ngay và\n' +
        '   không có đường lùi — bỏ cột lúc còn thiếu dòng là mất con trỏ file vĩnh viễn.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    chayThu
      ? '\nChạy thử xong, chưa ghi gì. Bỏ cờ --thu để chuyển thật.'
      : '\nMọi dòng nguồn đều đã có mặt ở bảng con. Bước tiếp theo là THAO TÁC RIÊNG, không nằm\n' +
          'trong script này: đối chiếu lại số liệu ở trên, rồi mới bỏ bốn cột con trỏ cũ khỏi\n' +
          'prisma/tenant/schema.prisma và chạy `npm run sync:tenants` lần hai.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void sysPrisma.$disconnect());
