import { Client } from 'pg';
import { tenantUrl } from '../../utils/dbName';

/**
 * RÀNG BUỘC HRM Ở TẦNG CƠ SỞ DỮ LIỆU TENANT — nguồn SQL DUY NHẤT.
 *
 * ===== VÌ SAO KHÔNG PHẢI MIGRATION =====
 *
 * `prisma/tenant/` **không có** thư mục `migrations/`. Schema tenant được áp bằng
 * `prisma db push --accept-data-loss`, lặp qua từng `DonVi.dbName` (`scripts/sync-tenants.ts`)
 * và lúc cấp DB mới (`provisioning.service.ts`). `db push` chỉ đồng bộ trạng thái, không ghi
 * vết, nên **không có `migration.sql` nào để chèn SQL tay**. Ba loại ràng buộc dưới đây
 * (`CREATE EXTENSION`, `CREATE FUNCTION`, `EXCLUDE USING gist`) Prisma DSL không diễn tả được,
 * nên chúng sống ở đây và chạy như một bước RIÊNG, SAU mỗi lần push.
 * Xem `docs/hrm/architecture/data-model.md` Mục 8.0.
 *
 * ===== BA TÍNH CHẤT BẮT BUỘC =====
 *
 * 1. **Idempotent.** `db push` chạy lại bất cứ lúc nào, nên script này phải chịu được việc chạy
 *    nhiều lần: `CREATE EXTENSION IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`,
 *    `CREATE INDEX IF NOT EXISTS`, và với `ALTER TABLE ... ADD CONSTRAINT` thì bắt SQLSTATE
 *    `42710` (duplicate_object) rồi bỏ qua — Postgres không có `ADD CONSTRAINT IF NOT EXISTS`.
 *
 * 2. **Không được nuốt lỗi dữ liệu.** Ràng buộc bị TỪ CHỐI TẠO khi tenant đang có dòng vi phạm
 *    (SQLSTATE `23P01` / `23505`). Đó KHÔNG phải lỗi hạ tầng mà là dữ liệu bẩn cần dọn tay —
 *    phải báo rõ tenant nào, rồi bỏ qua tenant đó chứ không làm hỏng cả lượt chạy. Chạy
 *    `npm run hrm:ra-soat` TRƯỚC để biết phải dọn gì.
 *
 * 3. **Chạy được trên tenant MỚI.** `provisionTenant` trước đây chỉ `CREATE DATABASE` + push,
 *    nên tenant mới sinh ra hoàn toàn không có ràng buộc nào. `applyTenantConstraints` được gọi
 *    ngay sau `pushTenantSchema` trong cùng luồng cấp DB.
 *
 * ⚠️ CHƯA ĐO: `prisma db push` có xóa index/constraint tạo tay hay không. Prisma quản lý index
 * và unique theo `schema.prisma` nên thứ nó không biết **có thể** bị drop ở lần push kế tiếp
 * (`EXCLUDE`/`FUNCTION` khả năng cao được giữ, nhưng đây là suy luận chưa đo). Vì vậy quy ước
 * vận hành là: **chạy `npm run hrm:constraints` sau MỖI lần `npm run sync:tenants`.** Script
 * idempotent nên chạy thừa không hại gì.
 */

/**
 * Thân hàm gom nhóm hợp đồng — phải KHỚP TỪNG CHỮ với `loaiHdVeNhanVien()`
 * (`services/client/hrm/hopDong.service.ts`). Hai bên lệch nhau là hai tầng nói khác nhau về
 * cùng một luật: tầng ứng dụng cho qua rồi tầng dưới chặn với thông báo chung chung.
 */
const BIEU_THUC_NHOM_HD = `
  CASE lower(btrim(@LOAI@))
    WHEN 'thu_viec' THEN 'thu_viec'
    WHEN 'khoan'    THEN 'hdvc'
    ELSE 'hdld'
  END`;

/**
 * Thân hàm quy kỳ giảm trừ (4 cột tháng/năm) về khoảng ngày — phải KHỚP với
 * `kyGiamTruTheoThang()` (`services/client/hrm/nguoiPhuThuoc.service.ts`).
 *
 * Nửa mở `'[)'` ở tầng NGÀY để diễn tả khoảng ĐÓNG ở tầng THÁNG: kỳ kết thúc tháng 6 chạy tới
 * hết 30/06, kỳ bắt đầu tháng 6 chạy từ 01/06 — hai kỳ đó giao nhau, đúng nghiệp vụ (trong
 * tháng 6 cả hai người nộp thuế đều được giảm trừ).
 */
const BIEU_THUC_KY_NPT = `
  daterange(
    CASE WHEN @TU_NAM@ IS NULL THEN '-infinity'::date
         ELSE make_date(@TU_NAM@, COALESCE(@TU_THANG@, 1), 1) END,
    CASE WHEN @DEN_NAM@ IS NULL THEN 'infinity'::date
         ELSE (make_date(@DEN_NAM@, COALESCE(@DEN_THANG@, 12), 1) + interval '1 month')::date END,
    '[)'
  )`;

/** Thay tham số hình thức trong biểu thức nhóm hợp đồng bằng một cột/biểu thức cụ thể. */
export function sqlNhomHd(cotLoai: string): string {
  return BIEU_THUC_NHOM_HD.split('@LOAI@').join(cotLoai);
}

/** Thay 4 tham số hình thức của biểu thức kỳ giảm trừ bằng 4 định danh cụ thể. */
export function sqlKyNptTuDinhDanh(
  tuThang: string,
  tuNam: string,
  denThang: string,
  denNam: string,
): string {
  return BIEU_THUC_KY_NPT.split('@TU_THANG@')
    .join(tuThang)
    .split('@TU_NAM@')
    .join(tuNam)
    .split('@DEN_THANG@')
    .join(denThang)
    .split('@DEN_NAM@')
    .join(denNam);
}

/** Dạng dùng cho câu quét: 4 cột thật của `hrm_nguoi_phu_thuoc`, có tiền tố bảng (`a.` / `b.`). */
export function sqlKyNpt(tienTo: string): string {
  return sqlKyNptTuDinhDanh(
    `${tienTo}dk_tu_thang`,
    `${tienTo}dk_tu_nam`,
    `${tienTo}dk_den_thang`,
    `${tienTo}dk_den_nam`,
  );
}

/** Khoảng hiệu lực của một hợp đồng, ĐÓNG CẢ HAI ĐẦU (`'[]'`) — xem `khoangGiaoNhau()`. */
export function sqlKhoangHopDong(tienTo: string): string {
  return `daterange(${tienTo}ngay_bat_dau, COALESCE(${tienTo}ngay_ket_thuc, 'infinity'::date), '[]')`;
}

/** Câu lệnh chạy được nhiều lần mà không đổi kết quả. */
const CAU_IDEMPOTENT: { ten: string; sql: string }[] = [
  {
    ten: 'extension btree_gist',
    // Cần để dùng toán tử `=` trên cột varchar bên trong index GiST.
    sql: `CREATE EXTENSION IF NOT EXISTS btree_gist`,
  },
  {
    // Dollar-quoting (`$fn$`) chứ không nháy đơn: thân hàm chứa đầy nháy đơn
    // (`'thu_viec'`, `'-infinity'::date`, `'[)'`) nên nháy đơn sẽ cắt chuỗi giữa chừng.
    ten: 'function hrm_nhom_hd',
    sql: `CREATE OR REPLACE FUNCTION hrm_nhom_hd(loai text)
          RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
            SELECT ${sqlNhomHd('loai')}
          $fn$`,
  },
  {
    // Tên tham số giữ ĐÚNG như `data-model.md` M-09 (`tu_thang`… không có tiền tố `dk_`).
    // Lý do không đổi cho tiện: `CREATE OR REPLACE FUNCTION` **từ chối đổi tên tham số** của
    // hàm đã tồn tại (SQLSTATE 42P13), nên một lần đặt lệch tên là script mất tính idempotent
    // trên chính DB nó vừa chạy. Chỗ gọi trong ràng buộc loại trừ truyền theo VỊ TRÍ nên tên
    // tham số không ảnh hưởng gì.
    ten: 'function hrm_ky_npt',
    sql: `CREATE OR REPLACE FUNCTION hrm_ky_npt(tu_thang int, tu_nam int, den_thang int, den_nam int)
          RETURNS daterange LANGUAGE sql IMMUTABLE AS $fn$
            SELECT ${sqlKyNptTuDinhDanh('tu_thang', 'tu_nam', 'den_thang', 'den_nam')}
          $fn$`,
  },
  {
    ten: 'index M-02 hrm_hop_dong(ma_nv, ngay_bat_dau)',
    sql: `CREATE INDEX IF NOT EXISTS "hrm_hop_dong_ma_nv_ngay_bat_dau_idx"
          ON "hrm_hop_dong" ("ma_nv", "ngay_bat_dau")`,
  },
  {
    ten: 'index M-05 hrm_hop_dong hien hanh',
    sql: `CREATE INDEX IF NOT EXISTS "hrm_hop_dong_hien_hanh_idx"
          ON "hrm_hop_dong" ("ma_nv", "ngay_bat_dau" DESC, "datetime0" DESC, "id" DESC)`,
  },
  {
    // M-07 (BR-hrm-056): số hợp đồng duy nhất TOÀN CÔNG TY.
    // Dùng UNIQUE INDEX chứ không `@@unique` trong schema.prisma: khai trong schema thì
    // `db push` FAIL TOÀN BỘ trên tenant còn số hợp đồng trùng, kéo theo mọi thay đổi schema
    // khác của tenant đó cũng không lên được. Ở đây thì chỉ riêng bước này báo lỗi.
    ten: 'unique M-07 hrm_hop_dong(so_hd)',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "hrm_hop_dong_so_hd_key"
          ON "hrm_hop_dong" ("so_hd")`,
  },
  {
    // M-09 bước 1: bỏ khóa duy nhất cũ (ma_nv, mst). Nó vừa hẹp quá về phạm vi vừa chặt quá
    // về thời gian — xem ghi chú ở `prisma/tenant/schema.prisma`.
    ten: 'drop unique cu hrm_nguoi_phu_thuoc(ma_nv, mst) - nhanh CONSTRAINT',
    sql: `ALTER TABLE "hrm_nguoi_phu_thuoc"
          DROP CONSTRAINT IF EXISTS "hrm_nguoi_phu_thuoc_ma_nv_mst_key"`,
  },
  {
    // BUG-HRM-33: nhánh trên MỘT MÌNH là lệnh rỗng. Prisma sinh `@@unique` bằng
    // `CREATE UNIQUE INDEX`, mà index KHÔNG phải constraint — `DROP CONSTRAINT IF EXISTS`
    // chạy qua im lặng và khóa cũ sống sót. Đã đo thật: sau lệnh đó `pg_indexes` vẫn còn
    // dòng đó; chỉ `DROP INDEX` mới gỡ được.
    //
    // Giữ CẢ HAI nhánh vì không đoán được tenant nào đang ở dạng nào: nếu ai đó từng tạo tay
    // bằng `ADD CONSTRAINT` thì nhánh trên gỡ; Prisma tạo thì nhánh này gỡ. Cả hai đều có
    // `IF EXISTS` nên nhánh không khớp là lệnh rỗng vô hại, và thứ tự này bắt buộc:
    // `DROP INDEX` KHÔNG gỡ được index do constraint sở hữu (Postgres báo lỗi 2BP01).
    ten: 'drop unique cu hrm_nguoi_phu_thuoc(ma_nv, mst) - nhanh INDEX',
    sql: `DROP INDEX IF EXISTS "hrm_nguoi_phu_thuoc_ma_nv_mst_key"`,
  },
];

/**
 * `ALTER TABLE ... ADD CONSTRAINT` — Postgres KHÔNG có `IF NOT EXISTS` cho nhánh này, nên chạy
 * lần hai trả SQLSTATE `42710`. Bắt riêng mã đó rồi bỏ qua; mọi mã khác vẫn nổi lên.
 */
const CAU_ADD_CONSTRAINT: { ten: string; sql: string }[] = [
  {
    // M-01 (BR-hrm-022, QĐ #1 + #6 + #18): một nhân viên không được có hai hợp đồng CÙNG NHÓM
    // giao nhau về khoảng ngày. Khóa trên HÀM gom nhóm, không trên nhãn `loai_hd` thô.
    ten: 'hrm_hop_dong_khong_chong_lan',
    sql: `ALTER TABLE "hrm_hop_dong" ADD CONSTRAINT "hrm_hop_dong_khong_chong_lan"
          EXCLUDE USING gist (
            "ma_nv" WITH =,
            hrm_nhom_hd("loai_hd") WITH =,
            ${sqlKhoangHopDong('')} WITH &&
          )`,
  },
  {
    // M-09 bước 2 (BR-hrm-030, QĐ #7 + #19): hai người phụ thuộc cùng mã số thuế không được có
    // kỳ giảm trừ giao nhau, trong phạm vi một công ty. Bỏ qua dòng chưa có mã số thuế.
    //
    // ⚠️ NỢ KỸ THUẬT ĐÃ CHẤP NHẬN: ràng buộc này KHÔNG bỏ qua được dòng thuộc nhân viên đã xóa
    // mềm (ràng buộc loại trừ không tham chiếu bảng khác), nên nó chặt hơn BR-hrm-030 một
    // chút. Phép kiểm ở tầng ứng dụng mới là nơi bỏ qua hồ sơ đã xóa. Hệ quả xấu nhất: một ca
    // hiếm bị chặn kèm thông báo chung chung.
    ten: 'hrm_npt_mst_khong_trung_ky',
    sql: `ALTER TABLE "hrm_nguoi_phu_thuoc" ADD CONSTRAINT "hrm_npt_mst_khong_trung_ky"
          EXCLUDE USING gist (
            "mst" WITH =,
            hrm_ky_npt("dk_tu_thang", "dk_tu_nam", "dk_den_thang", "dk_den_nam") WITH &&
          ) WHERE ("mst" IS NOT NULL)`,
  },
];

/** SQLSTATE Postgres cần phân biệt khi áp ràng buộc. */
const SQLSTATE = {
  /** Đối tượng đã tồn tại — `ADD CONSTRAINT` chạy lần hai. Bỏ qua, đúng ý idempotent. */
  DUPLICATE_OBJECT: '42710',
  /**
   * Trùng tên RELATION — cũng là `ADD CONSTRAINT` chạy lần hai, nhưng Postgres báo bằng mã này
   * chứ không phải `42710` khi ràng buộc có **index nền**: `EXCLUDE` và `UNIQUE` đều tạo một
   * index cùng tên, nên xung đột được báo ở tầng relation (`duplicate_table`).
   *
   * BUG-HRM-42: bản đầu chỉ bắt `42710` nên script KHÔNG idempotent — đo thật, chạy lần hai
   * fail cả 10 tenant với `relation "hrm_hop_dong_khong_chong_lan" already exists`, SQLSTATE
   * `42P07`. Điều này chặn thật vì runbook yêu cầu chạy lại script sau MỖI `sync:tenants`.
   */
  DUPLICATE_TABLE: '42P07',
  /** Dữ liệu đang có vi phạm ràng buộc loại trừ -> tenant cần dọn tay TRƯỚC. */
  EXCLUSION_VIOLATION: '23P01',
  /** Dữ liệu đang có vi phạm unique -> tenant cần dọn tay TRƯỚC. */
  UNIQUE_VIOLATION: '23505',
} as const;

function maSqlState(err: unknown): string | undefined {
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' ? code : undefined;
}

export interface KetQuaApRangBuoc {
  dbName: string;
  daAp: string[];
  daCoSan: string[];
  /** Ràng buộc không áp được vì dữ liệu đang vi phạm — phải dọn tay rồi chạy lại. */
  vuongDuLieu: { ten: string; sqlstate: string; chiTiet: string }[];
}

/**
 * Áp toàn bộ ràng buộc HRM lên MỘT DB tenant. Idempotent.
 *
 * KHÔNG bọc tất cả trong một transaction: mục tiêu là áp được càng nhiều càng tốt và báo rõ
 * cái nào vướng dữ liệu. Bọc chung thì một tenant có hợp đồng chồng lấn sẽ mất luôn cả index
 * và hàm — lần chạy sau lại làm lại từ đầu mà vẫn hỏng ở đúng chỗ cũ.
 *
 * Ném lỗi khi gặp sự cố THẬT (mất kết nối, thiếu quyền, thiếu extension trong máy chủ). Dữ
 * liệu bẩn thì KHÔNG ném — gom vào `vuongDuLieu` để người vận hành đọc một lượt.
 */
export async function applyTenantConstraints(
  dbName: string,
): Promise<KetQuaApRangBuoc> {
  const client = new Client({ connectionString: tenantUrl(dbName) });
  await client.connect();
  const ketQua: KetQuaApRangBuoc = {
    dbName,
    daAp: [],
    daCoSan: [],
    vuongDuLieu: [],
  };

  try {
    for (const cau of CAU_IDEMPOTENT) {
      try {
        await client.query(cau.sql);
        ketQua.daAp.push(cau.ten);
      } catch (err) {
        const code = maSqlState(err);
        if (
          code === SQLSTATE.UNIQUE_VIOLATION ||
          code === SQLSTATE.EXCLUSION_VIOLATION
        ) {
          ketQua.vuongDuLieu.push({
            ten: cau.ten,
            sqlstate: code,
            chiTiet: (err as Error).message,
          });
          continue;
        }
        throw err;
      }
    }

    for (const cau of CAU_ADD_CONSTRAINT) {
      try {
        await client.query(cau.sql);
        ketQua.daAp.push(cau.ten);
      } catch (err) {
        const code = maSqlState(err);
        if (
          code === SQLSTATE.DUPLICATE_OBJECT ||
          code === SQLSTATE.DUPLICATE_TABLE
        ) {
          ketQua.daCoSan.push(cau.ten);
          continue;
        }
        if (
          code === SQLSTATE.EXCLUSION_VIOLATION ||
          code === SQLSTATE.UNIQUE_VIOLATION
        ) {
          ketQua.vuongDuLieu.push({
            ten: cau.ten,
            sqlstate: code,
            chiTiet: (err as Error).message,
          });
          continue;
        }
        throw err;
      }
    }
  } finally {
    await client.end();
  }

  return ketQua;
}

/* ===================== CÂU QUÉT DỮ LIỆU (CHỈ ĐỌC) ===================== */

/**
 * Bốn câu quét dưới đây **chỉ đọc**, KHÔNG cần hàm `hrm_nhom_hd` / `hrm_ky_npt` tồn tại sẵn:
 * chúng nội suy thẳng biểu thức từ cùng hằng số dùng để tạo hàm, nên không thể lệch nhau, và
 * chạy được trên tenant chưa từng áp ràng buộc — đúng thứ tự nghiệp vụ (rà TRƯỚC, áp SAU).
 */

/** M-07 / BR-hrm-056 — số hợp đồng trùng trong cùng công ty. */
export const SQL_QUET_SO_HD_TRUNG = `
SELECT a.so_hd,
       a.ma_nv AS ma_nv_a, a.id AS id_a,
       b.ma_nv AS ma_nv_b, b.id AS id_b
FROM hrm_hop_dong a
JOIN hrm_hop_dong b ON a.so_hd = b.so_hd AND a.id < b.id
ORDER BY a.so_hd`;

/** BR-hrm-057 / BR-hrm-058 — hợp đồng lương 0, sẽ chặn mọi lần sửa sau khi bật validator. */
export const SQL_QUET_LUONG_0 = `
SELECT hd.id, hd.ma_nv, hd.so_hd, hd.loai_hd,
       hd.luong_chinh, hd.luong_bhxh, hd.trich_bhxh,
       nv.da_xoa AS nv_da_xoa
FROM hrm_hop_dong hd
LEFT JOIN hrm_nhan_vien nv ON nv.ma_nv = hd.ma_nv
WHERE hd.luong_chinh <= 0
   OR (hd.trich_bhxh AND hd.luong_bhxh <= 0)
ORDER BY hd.ma_nv, hd.ngay_bat_dau`;

/** M-01 / BR-hrm-022 — hợp đồng chồng lấn CÙNG NHÓM (khoảng đóng hai đầu). */
export const SQL_QUET_HOP_DONG_CHONG_LAN = `
SELECT a.ma_nv, a.id AS id_a, a.so_hd AS hd_a, a.loai_hd AS loai_a,
       a.ngay_bat_dau AS bat_dau_a, a.ngay_ket_thuc AS ket_thuc_a,
       b.id AS id_b, b.so_hd AS hd_b, b.loai_hd AS loai_b,
       b.ngay_bat_dau AS bat_dau_b, b.ngay_ket_thuc AS ket_thuc_b
FROM hrm_hop_dong a
JOIN hrm_hop_dong b
  ON a.ma_nv = b.ma_nv
 AND (${sqlNhomHd('a.loai_hd')}) = (${sqlNhomHd('b.loai_hd')})
 AND a.id < b.id
 AND ${sqlKhoangHopDong('a.')} && ${sqlKhoangHopDong('b.')}
ORDER BY a.ma_nv, a.ngay_bat_dau`;

/**
 * M-09 / BR-hrm-030 — người phụ thuộc cùng mã số thuế có kỳ giảm trừ GIAO NHAU.
 *
 * `LEFT JOIN` chứ không `JOIN`: hai cột `a_da_xoa` / `b_da_xoa` là BẮT BUỘC vì BR-hrm-030 chốt
 * **bỏ qua** dòng thuộc nhân viên đã xóa mềm — hai dòng vi phạm mà một bên thuộc hồ sơ đã xóa
 * thì KHÔNG phải dọn. `LEFT` để dòng mồ côi (nhân viên không còn) vẫn hiện ra thay vì biến mất
 * khỏi báo cáo. Câu quét cũ chỉ `GROUP BY mst` nên vừa báo thừa (không xét kỳ) vừa báo thiếu
 * bối cảnh (không biết dòng nào thuộc hồ sơ đã xóa).
 */
export const SQL_QUET_NPT_TRUNG_MST = `
SELECT a.mst,
       a.ma_nv AS ma_nv_a, a.id AS id_a,
       a.dk_tu_thang AS tu_thang_a, a.dk_tu_nam AS tu_nam_a,
       a.dk_den_thang AS den_thang_a, a.dk_den_nam AS den_nam_a,
       b.ma_nv AS ma_nv_b, b.id AS id_b,
       b.dk_tu_thang AS tu_thang_b, b.dk_tu_nam AS tu_nam_b,
       b.dk_den_thang AS den_thang_b, b.dk_den_nam AS den_nam_b,
       na.da_xoa AS a_da_xoa, nb.da_xoa AS b_da_xoa
FROM hrm_nguoi_phu_thuoc a
JOIN hrm_nguoi_phu_thuoc b ON a.mst = b.mst AND a.id < b.id
LEFT JOIN hrm_nhan_vien na ON na.ma_nv = a.ma_nv
LEFT JOIN hrm_nhan_vien nb ON nb.ma_nv = b.ma_nv
WHERE a.mst IS NOT NULL
  AND ${sqlKyNpt('a.')} && ${sqlKyNpt('b.')}
ORDER BY a.mst`;

export interface MucRaSoat {
  ma: string;
  ten: string;
  sql: string;
}

/** Bốn mục rà soát của đợt P0, theo đúng thứ tự cần dọn. */
export const MUC_RA_SOAT: MucRaSoat[] = [
  {
    ma: 'luong-0',
    ten: 'Hop dong co luong 0 (BR-hrm-057/058)',
    sql: SQL_QUET_LUONG_0,
  },
  {
    ma: 'so-hd-trung',
    ten: 'So hop dong trung (BR-hrm-056)',
    sql: SQL_QUET_SO_HD_TRUNG,
  },
  {
    ma: 'hop-dong-chong-lan',
    ten: 'Hop dong chong lan cung nhom (BR-hrm-022)',
    sql: SQL_QUET_HOP_DONG_CHONG_LAN,
  },
  {
    ma: 'npt-trung-mst',
    ten: 'Nguoi phu thuoc trung ma so thue, ky giao nhau (BR-hrm-030)',
    sql: SQL_QUET_NPT_TRUNG_MST,
  },
];

export interface KetQuaRaSoat {
  dbName: string;
  theoMuc: { ma: string; ten: string; soDong: number; mau: unknown[] }[];
}

/**
 * Chạy toàn bộ câu quét trên MỘT DB tenant. CHỈ ĐỌC — không `CREATE`, không `ALTER`, không ghi.
 * `soMauToiDa` giới hạn số dòng in ra để báo cáo không thành một bãi log.
 */
export async function raSoatTenant(
  dbName: string,
  soMauToiDa = 20,
): Promise<KetQuaRaSoat> {
  const client = new Client({ connectionString: tenantUrl(dbName) });
  await client.connect();
  try {
    const theoMuc: KetQuaRaSoat['theoMuc'] = [];
    for (const muc of MUC_RA_SOAT) {
      const res = await client.query(muc.sql);
      theoMuc.push({
        ma: muc.ma,
        ten: muc.ten,
        soDong: res.rowCount ?? 0,
        mau: res.rows.slice(0, soMauToiDa),
      });
    }
    return { dbName, theoMuc };
  } finally {
    await client.end();
  }
}
