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
import * as GDTService from "../hddt/gdt.service";
import { khoangCuaKy, type Ky } from "./kySoThue";
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
}

/** Đọc id hóa đơn của một chiều trong khoảng ngày — chỉ lấy cột `id`, không kéo dòng nặng. */
async function layIdTrongKhoang(
  db: PrismaClient,
  chieu: Chieu,
  tuNgay: string,
  denNgay: string,
): Promise<string[]> {
  // Khoảng ngày dạng chuỗi -> Date; `denNgay` lấy tới cuối ngày để không cắt mất hóa đơn lập buổi
  // chiều ngày cuối kỳ (`tdlap` là DateTime có giờ).
  const gte = new Date(`${tuNgay}T00:00:00.000Z`);
  const lte = new Date(`${denNgay}T23:59:59.999Z`);
  const where = { tdlap: { gte, lte } };
  const rows =
    chieu === "purchase"
      ? await db.vct60view.findMany({ where, select: { id: true } })
      : await db.vct50view.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Gán MỌI hóa đơn (cả hai chiều) có ngày lập trong kỳ vào kỳ đó.
 *
 * Upsert chứ không xóa-rồi-tạo: `ke_khai` / `chi_tieu_tang_giam` / `ghi_chu` là lựa chọn của kế
 * toán, kê khai lại chỉ được đổi KỲ chứ không được nuốt mất mấy cột đó. Hóa đơn đã gán kỳ khác thì
 * dòng cũ bị ghi đè sang kỳ mới (khóa chính `[hoa_don_id, chieu]`) — một hóa đơn chỉ thuộc một kỳ.
 */
export async function danhDauKy(db: PrismaClient, ky: Ky): Promise<KetQuaDanhDau> {
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const ketQua: KetQuaDanhDau = { purchase: 0, sold: 0 };

  for (const chieu of CA_HAI_CHIEU) {
    const ids = await layIdTrongKhoang(db, chieu, tuNgay, denNgay);
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
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const kq = await GDTService.getSavedInvoices(db, chieu, { tuNgay, denNgay });

  const datas: DongBangKe[] = [];
  for (const row of kq.datas as unknown as Record<string, unknown>[]) {
    const gan = theoId.get(String(row.id ?? ""));
    if (!gan) continue;
    datas.push({
      ...row,
      keKhai: gan.ke_khai,
      chiTieuTangGiam: gan.chi_tieu_tang_giam ?? "",
    });
  }

  return { total: datas.length, datas, thayThe: kq.thayThe };
}
