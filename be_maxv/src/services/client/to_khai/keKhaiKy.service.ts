/**
 * Gán hóa đơn vào kỳ kê khai và đọc lại bảng kê của một kỳ.
 *
 * Mô-đun "Tờ khai" CHỈ đọc DB tenant — không import `gdt-client`, không nhận token GDT. Hóa đơn
 * phải được đồng bộ sẵn bên màn Hóa đơn điện tử trước.
 *
 * Nguyên tắc: bảng `tokhai_ky_hoa_don` chỉ giữ QUYẾT ĐỊNH (hóa đơn nào thuộc kỳ nào, có kê khai
 * không), tuyệt đối không chép số tiền — xem ghi chú model trong `prisma/tenant/schema.prisma`.
 */

import type { PrismaClient } from "../../../generated/tenant";
import { vnDayEnd, vnDayStart, vnDayString } from "../../../utils/ngayVn";
import * as GDTService from "../hddt/gdt.service";
import { khoangCuaKy, type Ky } from "./kySoThue";
import {
  chonTheoKyGoc,
  ngayGocTuGhiChu,
  type KetQuaChon,
  type ToCoGoc,
} from "./kyThayThe";
import { duocTinh } from "./gomHoaDonGtgt";
import type { ThayTheHut } from "./soatToKhai";
import { chiaLo } from "./toKhaiGtgt01.service";

export type Chieu = "purchase" | "sold";

const CA_HAI_CHIEU: Chieu[] = ["purchase", "sold"];

/**
 * Số dòng upsert mỗi transaction. Một kỳ có thể vài nghìn hóa đơn; gom tất cả vào MỘT transaction
 * là giữ khóa quá lâu trên bảng, còn thả từng dòng lại tốn N round-trip. Chia lô là điểm giữa,
 * cùng tinh thần `saveInvoices` bên module hóa đơn (upsert theo từng trang GDT trả).
 */
const CO_LO_UPSERT = 200;

export interface KetQuaDanhDau {
  purchase: number;
  sold: number;
  /**
   * Số hóa đơn thay thế/điều chỉnh KHÔNG suy được kỳ của hóa đơn gốc — chúng giữ nguyên theo ngày
   * lập. Màn hình nói ra để kế toán tự kiểm, thay vì im lặng gán một kỳ có thể sai.
   */
  khongRoKyGoc: number;
  /** Số hóa đơn bị GỠ khỏi kỳ vì lượt quét mới không còn nhận — xem `goKhoiKy`. */
  daGo: number;
}

/** Tên view theo chiều — `vct60view` là MUA VÀO, `vct50view` là BÁN RA (đúng, không ngược). */
function tenView(chieu: Chieu): string {
  return chieu === "purchase" ? "vct60view" : "vct50view";
}

/** Một hóa đơn thay thế/điều chỉnh kèm thông tin cần để suy ra kỳ của hóa đơn GỐC. */
interface HoaDonCoGoc {
  id: string;
  tdlap: Date;
  khhdgoc: string | null;
  shdgoc: string | null;
  gchdgoc: string | null;
}

/**
 * Ngày lập của hóa đơn GỐC mà tờ này thay thế/điều chỉnh; `null` = không suy được.
 *
 * Hai đường bù nhau, xem `kyThayThe.ts`: tra hóa đơn gốc trong DB trước (chính xác), không thấy
 * thì bóc ngày từ câu ghi chú (cứu ca hóa đơn gốc thuộc năm chưa đồng bộ).
 */
async function ngayGocCuaHoaDon(
  db: PrismaClient,
  chieu: Chieu,
  hd: HoaDonCoGoc,
): Promise<string | null> {
  if (hd.khhdgoc && hd.shdgoc) {
    const goc = await db.$queryRawUnsafe<{ tdlap: Date }[]>(
      `SELECT tdlap FROM "${tenView(chieu)}" WHERE khhdon = $1 AND shdon = $2 LIMIT 1`,
      hd.khhdgoc,
      hd.shdgoc,
    );
    // Ngày GIỜ VN, không phải `toISOString()`: cổng thuế trả ngày lập lúc 00:00 giờ VN = 17:00 UTC
    // hôm trước, lấy ngày UTC là lùi hẳn một ngày (xem `utils/ngayVn.ts`).
    if (goc.length > 0) return vnDayString(goc[0].tdlap) ?? null;
  }
  return ngayGocTuGhiChu(hd.gchdgoc);
}

/** Hóa đơn thay thế/điều chỉnh của một chiều, kèm ba trường trỏ về hóa đơn gốc. */
async function layHoaDonCoGoc(db: PrismaClient, chieu: Chieu): Promise<HoaDonCoGoc[]> {
  return db.$queryRawUnsafe<HoaDonCoGoc[]>(
    `SELECT id, tdlap,
            detail->>'khhdgoc' AS khhdgoc,
            detail->>'shdgoc'  AS shdgoc,
            detail->>'gchdgoc' AS gchdgoc
       FROM "${tenView(chieu)}"
      WHERE tthai IN ('2', '3')`,
  );
}

/**
 * Id hóa đơn THUỘC KỲ này theo đúng luật, không phải "có ngày lập trong kỳ".
 *
 * Hóa đơn thay thế/điều chỉnh thuộc kỳ của HÓA ĐƠN GỐC (khai bổ sung kỳ đó), nên phép chọn đi hai
 * chiều so với cách cũ:
 *
 *   - BỎ tờ lập trong kỳ này nhưng gốc ở kỳ khác — hóa đơn lập 07/01/2026 thay thế cho hóa đơn
 *     26/12/2025 phải rơi vào Q4/2025, không phải Q1/2026;
 *   - THÊM tờ lập ngoài kỳ này nhưng gốc rơi vào kỳ này.
 *
 * Không suy được kỳ gốc (hóa đơn gốc chưa đồng bộ VÀ ghi chú không theo mẫu) thì giữ nguyên theo
 * ngày lập và đếm vào `khongRoKyGoc` — đoán bừa một kỳ là đẩy doanh thu sang quý khác.
 */
async function layIdTrongKhoang(
  db: PrismaClient,
  chieu: Chieu,
  tuNgay: string,
  denNgay: string,
): Promise<KetQuaChon> {
  // Khoảng ngày dạng chuỗi -> Date theo GIỜ VIỆT NAM, cùng mốc mà màn Hóa đơn điện tử dùng. Mốc UTC
  // lệch 7 tiếng: hóa đơn lập 00:00 giờ VN nằm ở 17:00 UTC HÔM TRƯỚC, nên cả kỳ bị đọc lùi một ngày
  // (đo thật trên MST 0111142786: [32] của Q1/2026 thừa 102.173.752 đồng). Xem `utils/ngayVn.ts`.
  // `denNgay` lấy tới cuối ngày để không cắt mất hóa đơn lập buổi chiều ngày cuối kỳ.
  const where = { tdlap: { gte: vnDayStart(tuNgay), lte: vnDayEnd(denNgay) } };
  const rows =
    chieu === "purchase"
      ? await db.vct60view.findMany({ where, select: { id: true } })
      : await db.vct50view.findMany({ where, select: { id: true } });

  const lapTrongKy = new Set(rows.map((r) => r.id));
  const coGoc: ToCoGoc[] = [];
  for (const hd of await layHoaDonCoGoc(db, chieu)) {
    coGoc.push({
      id: hd.id,
      ngayGoc: await ngayGocCuaHoaDon(db, chieu, hd),
      lapTrongKy: lapTrongKy.has(hd.id),
    });
  }
  return chonTheoKyGoc([...lapTrongKy], coGoc, tuNgay, denNgay);
}

/**
 * Gỡ khỏi kỳ những hóa đơn ĐANG được gán vào nó mà lượt quét mới không còn nhận; trả về số dòng gỡ.
 *
 * Không có bước này thì kê khai lại chỉ biết THÊM: một hóa đơn từng thuộc kỳ sẽ nằm lại đó vĩnh
 * viễn, trừ khi có kỳ khác giành lấy (khóa chính `[hoa_don_id, chieu]`). Đúng hai ca sinh ra rác:
 * hóa đơn thay thế bị luật kỳ gốc đẩy sang kỳ khác, và hóa đơn từng vào kỳ do đọc sai ngày.
 *
 * Truyền danh sách id thành MỘT tham số mảng (`= ANY($5)`) chứ không trải thành N tham số: một kỳ
 * có thể vài nghìn hóa đơn, mà Postgres chỉ nhận 65.535 tham số mỗi lượt.
 *
 * Mảng rỗng -> `NOT (... = ANY('{}'))` đúng với mọi dòng, tức gỡ sạch kỳ. Đó là ý muốn: lượt quét
 * kết luận kỳ không còn hóa đơn nào thuộc về nó.
 */
async function goKhoiKy(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
  idConLai: readonly string[],
): Promise<number> {
  return db.$executeRawUnsafe(
    `DELETE FROM "tokhai_ky_hoa_don"
      WHERE chieu = $1 AND nam = $2 AND ky_loai = $3 AND ky_so = $4
        AND NOT (hoa_don_id = ANY($5::varchar[]))`,
    chieu,
    ky.nam,
    ky.kyLoai,
    ky.kySo,
    idConLai,
  );
}

/**
 * Gán MỌI hóa đơn (cả hai chiều) THUỘC kỳ vào kỳ đó — "thuộc kỳ" tính theo luật, xem
 * `layIdTrongKhoang`: hóa đơn thay thế/điều chỉnh đi theo kỳ của hóa đơn GỐC.
 *
 * Upsert chứ không xóa-rồi-tạo: `ke_khai` / `chi_tieu_tang_giam` / `ghi_chu` là lựa chọn của kế
 * toán, kê khai lại chỉ được đổi KỲ chứ không được nuốt mất mấy cột đó. Hóa đơn đã gán kỳ khác thì
 * dòng cũ bị ghi đè sang kỳ mới (khóa chính `[hoa_don_id, chieu]`) — một hóa đơn chỉ thuộc một kỳ.
 *
 * Gỡ TRƯỚC rồi mới gán: gỡ sau thì lượt gỡ nhìn thấy cả dòng vừa gán, và một trục trặc giữa chừng
 * để lại kỳ vừa thừa vừa thiếu. Dòng bị gỡ mất luôn `ke_khai`/`ghi_chu` — chấp nhận, vì hóa đơn đó
 * không còn thuộc kỳ này nên quyết định của kế toán cho kỳ này cũng hết nghĩa.
 */
export async function danhDauKy(db: PrismaClient, ky: Ky): Promise<KetQuaDanhDau> {
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const ketQua: KetQuaDanhDau = { purchase: 0, sold: 0, khongRoKyGoc: 0, daGo: 0 };

  for (const chieu of CA_HAI_CHIEU) {
    const { ids, khongRoKyGoc } = await layIdTrongKhoang(db, chieu, tuNgay, denNgay);
    ketQua.khongRoKyGoc += khongRoKyGoc;
    ketQua.daGo += await goKhoiKy(db, ky, chieu, ids);
    for (const lo of chiaLo(ids, CO_LO_UPSERT)) {
      await db.$transaction(
        lo.map((hoaDonId) =>
          db.tokhai_ky_hoa_don.upsert({
            where: { hoa_don_id_chieu: { hoa_don_id: hoaDonId, chieu } },
            create: {
              hoa_don_id: hoaDonId,
              chieu,
              nam: ky.nam,
              ky_loai: ky.kyLoai,
              ky_so: ky.kySo,
            },
            update: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo },
          }),
        ),
      );
    }
    ketQua[chieu] = ids.length;
  }

  return ketQua;
}

/**
 * Hóa đơn THAY THẾ của kỳ mà tổng nhỏ hơn hóa đơn gốc — dấu hiệu tờ thay thế bỏ sót dòng hàng.
 *
 * Chỉ xét tờ kế toán để `ke_khai`; tờ gốc tra theo `khhdgoc`/`shdgoc`, không tra được thì bỏ qua
 * (JOIN tự loại) — thà không báo còn hơn báo dựa trên một tờ gốc đoán ra.
 */
export async function layThayTheHut(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
): Promise<ThayTheHut[]> {
  return db.$queryRawUnsafe<ThayTheHut[]>(
    `SELECT m.khhdon || '|' || m.shdon AS "hoaDon",
            g.shdon                    AS "soGoc",
            (g.tgtcthue - m.tgtcthue)::float8 AS hut
       FROM "tokhai_ky_hoa_don" k
       JOIN "${tenView(chieu)}" m ON m.id = k.hoa_don_id
       JOIN "${tenView(chieu)}" g
         ON g.khhdon = m.detail->>'khhdgoc' AND g.shdon = m.detail->>'shdgoc'
      WHERE k.chieu = $1 AND k.nam = $2 AND k.ky_loai = $3 AND k.ky_so = $4
        AND k.ke_khai AND m.tthai = '2' AND m.tgtcthue < g.tgtcthue
      ORDER BY (g.tgtcthue - m.tgtcthue) DESC`,
    chieu,
    ky.nam,
    ky.kyLoai,
    ky.kySo,
  );
}

/** Ba giá trị hợp lệ của cột "Chỉ tiêu tăng giảm"; rỗng = kế toán chưa chọn, hoặc xóa lựa chọn cũ. */
export type ChiTieuTangGiam = "" | "tang" | "giam";

const DAI_TOI_DA_GHI_CHU = 512;

/** Phần quyết định của kế toán cho MỘT hóa đơn. Field vắng mặt = không đổi, khác field rỗng. */
export interface QuyetDinhKeKhai {
  keKhai?: boolean;
  chiTieuTangGiam?: ChiTieuTangGiam;
  ghiChu?: string;
}

/**
 * Lọc payload PATCH từ FE — cửa DUY NHẤT dữ liệu người dùng đi vào bảng quyết định, nên không tin
 * gì cả: khóa lạ, giá trị sai kiểu, chuỗi quá dài đều bị bỏ. Hai cột này quyết định hóa đơn nào
 * vào tờ khai, sai một dòng là số thuế sai.
 *
 * Giữ ngữ nghĩa "vắng mặt = không đổi": chỉ field CÓ TRONG payload và hợp lệ mới xuất hiện ở kết
 * quả, nhờ đó `capNhatQuyetDinh` không vô tình ghi đè cột người dùng không hề chạm tới.
 */
export function locQuyetDinh(raw: unknown): QuyetDinhKeKhai {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: QuyetDinhKeKhai = {};

  if (typeof o.keKhai === "boolean") out.keKhai = o.keKhai;
  if (o.chiTieuTangGiam === "" || o.chiTieuTangGiam === "tang" || o.chiTieuTangGiam === "giam") {
    out.chiTieuTangGiam = o.chiTieuTangGiam;
  }
  if (typeof o.ghiChu === "string") out.ghiChu = o.ghiChu.slice(0, DAI_TOI_DA_GHI_CHU);
  return out;
}

/**
 * Sửa quyết định của MỘT hóa đơn.
 *
 * Chỉ `update` chứ không `upsert`: hóa đơn chưa được gán kỳ thì không có quyết định nào để sửa —
 * tạo dòng ở đây sẽ sinh bản ghi thiếu kỳ, lọt vào bảng kê của mọi kỳ sau này. Không tìm thấy
 * dòng thì Prisma ném, controller trả lỗi cho người dùng thấy.
 *
 * Chuỗi rỗng lưu thành `null` để cột trống trong DB chỉ có một dạng duy nhất.
 */
export async function capNhatQuyetDinh(
  db: PrismaClient,
  hoaDonId: string,
  chieu: Chieu,
  quyetDinh: QuyetDinhKeKhai,
): Promise<void> {
  if (Object.keys(quyetDinh).length === 0) return;
  await db.tokhai_ky_hoa_don.update({
    where: { hoa_don_id_chieu: { hoa_don_id: hoaDonId, chieu } },
    data: {
      ...(quyetDinh.keKhai === undefined ? {} : { ke_khai: quyetDinh.keKhai }),
      ...(quyetDinh.chiTieuTangGiam === undefined
        ? {}
        : { chi_tieu_tang_giam: quyetDinh.chiTieuTangGiam || null }),
      ...(quyetDinh.ghiChu === undefined ? {} : { ghi_chu: quyetDinh.ghiChu || null }),
    },
  });
}

/**
 * Khoảng ngày đủ rộng để đọc về MỌI hóa đơn đã gán kỳ — nới hai đầu ra tới ngày lập xa nhất trong
 * số chúng.
 *
 * Cần vì luật kỳ gốc kéo hóa đơn thay thế/điều chỉnh của kỳ SAU về kỳ này (xem `layIdTrongKhoang`):
 * chúng đã thuộc bảng kê và ĐÃ được cộng vào tờ khai, nhưng ngày lập nằm ngoài khoảng kỳ. Hỏi
 * `getSavedInvoices` đúng khoảng kỳ thì chúng rơi khỏi màn hình — số trên tờ khai lớn hơn tổng
 * những dòng kế toán nhìn thấy, đúng kiểu lệch không cách nào tự tra ra.
 *
 * Đi qua bảng gán bằng JOIN chứ không truyền danh sách id: một kỳ có thể vài nghìn hóa đơn, mà
 * Postgres chỉ nhận 65.535 tham số mỗi lượt.
 */
async function khoangDocBangKe(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
): Promise<{ tuNgay: string; denNgay: string }> {
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const bien = await db.$queryRawUnsafe<{ tu: Date | null; den: Date | null }[]>(
    `SELECT MIN(v.tdlap) AS tu, MAX(v.tdlap) AS den
       FROM "${tenView(chieu)}" v
       JOIN "tokhai_ky_hoa_don" k ON k.hoa_don_id = v.id AND k.chieu = $1
      WHERE k.nam = $2 AND k.ky_loai = $3 AND k.ky_so = $4`,
    chieu,
    ky.nam,
    ky.kyLoai,
    ky.kySo,
  );
  const tuHd = vnDayString(bien[0]?.tu ?? undefined);
  const denHd = vnDayString(bien[0]?.den ?? undefined);
  return {
    // So chuỗi `yyyy-MM-dd` là so ngày lịch; chỉ NỚI ra, không bao giờ thu hẹp khoảng kỳ.
    tuNgay: tuHd && tuHd < tuNgay ? tuHd : tuNgay,
    denNgay: denHd && denHd > denNgay ? denHd : denNgay,
  };
}

/** Một dòng bảng kê: hóa đơn gốc + hai cột quyết định của kế toán. */
export interface DongBangKe extends Record<string, unknown> {
  keKhai: boolean;
  chiTieuTangGiam: string;
}

/**
 * Bảng kê của một kỳ, một chiều: hóa đơn ĐÃ ĐƯỢC GÁN vào kỳ, kèm `keKhai`/`chiTieuTangGiam`.
 *
 * Dùng lại `GDTService.getSavedInvoices` cho phần đọc hóa đơn thay vì tự truy vấn: hàm đó đã gánh
 * việc bóc tên hàng từ JSON `detail` và dựng mắt xích "bị thay thế bởi hóa đơn nào" (`thayThe`) —
 * chép lại là chép luôn hai chỗ dễ sai nhất, rồi hai bên trôi lệch khi một bên được vá.
 *
 * Lọc theo danh sách đã gán, KHÔNG theo khoảng ngày: hóa đơn mới đồng bộ về sau khi đã bấm "Kê
 * khai" tuy nằm trong khoảng ngày nhưng CHƯA được gán kỳ, nên chưa thuộc bảng kê — kế toán bấm kê
 * khai lại thì nó mới vào. Đó là hành vi mong muốn: bảng kê phản ánh quyết định, không phải mọi thứ
 * rơi vào khoảng ngày.
 *
 * Hóa đơn ĐÃ BỊ THAY THẾ (4) / ĐÃ BỊ HỦY (6) KHÔNG hiện ở đây. Luật cấm kê chúng nên engine bỏ qua
 * dù cột "Kê khai" có bật; để chúng nằm trong danh sách thì dòng tổng cộng của bảng kê lớn hơn [32]
 * đúng bằng tiền của chúng, mà nhìn bảng lại thấy chữ "Kê khai" — không cách nào tự lần ra
 * (đo thật Q1/2026: 11 tờ, 1.490.909.300 đồng). Số tờ bị bỏ vẫn được nói ra bằng cảnh báo trên màn
 * tờ khai, xem `soatToKhai`.
 */
export async function layBangKeTheoKy(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
): Promise<{ total: number; datas: DongBangKe[]; thayThe: unknown[] }> {
  const daGan = await db.tokhai_ky_hoa_don.findMany({
    where: { chieu, nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo },
    select: { hoa_don_id: true, ke_khai: true, chi_tieu_tang_giam: true },
  });
  if (daGan.length === 0) return { total: 0, datas: [], thayThe: [] };

  const theoId = new Map(daGan.map((d) => [d.hoa_don_id, d]));
  const kq = await GDTService.getSavedInvoices(db, chieu, await khoangDocBangKe(db, ky, chieu));

  const datas: DongBangKe[] = [];
  for (const row of kq.datas as unknown as Record<string, unknown>[]) {
    const gan = theoId.get(String(row.id ?? ""));
    if (!gan) continue;
    // Cùng một hàm `duocTinh` mà engine dùng — không chép lại điều kiện, để bảng kê và tờ khai
    // không bao giờ hiểu khác nhau về "hóa đơn nào được kê".
    if (!duocTinh(String(row.tthai ?? ""))) continue;
    datas.push({
      ...row,
      keKhai: gan.ke_khai,
      chiTieuTangGiam: gan.chi_tieu_tang_giam ?? "",
    });
  }

  return { total: datas.length, datas, thayThe: kq.thayThe };
}
