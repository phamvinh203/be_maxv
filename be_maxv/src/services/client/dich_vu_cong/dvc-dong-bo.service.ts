import { randomUUID } from "crypto";
import { Prisma, type PrismaClient, type dvc_dong_bo_log } from "../../../generated/tenant";
import type { BangHoSoDaBoc, ThongBaoDaBoc } from "./hoSoHtml";
import * as DvcService from "./gdt-dvc.service";
import type { DvcTepTaiVe } from "./gdt-dvc.service";
import { chuanHoaMime, doanContentType } from "./gdt-dvc.service";
import { layChiTieuToKhaiGtgt } from "./toKhaiXml";

/**
 * Đồng bộ hồ sơ tờ khai (tab "Tờ khai — Dịch vụ công") từ cổng dichvucong.gdt.gov.vn về DB tenant
 * (`dvc_ho_so`/`dvc_tai_lieu`), và đọc lại dữ liệu đã lưu cho ô tìm kiếm chính — để tra cứu sau đó
 * không phải đăng nhập cổng nữa. Vai trò tương tự `runSync`/`listSyncLogs` bên `hddt/gdt.service.ts`
 * nhưng tách file riêng vì nguồn dữ liệu (hồ sơ theo loại giấy tờ) khác hẳn hóa đơn.
 *
 * PHẠM VI HIỆN TẠI: chỉ tab "Tờ khai (Dịch vụ công)" — hai tab còn lại (Tờ khai Thuế điện tử, Giấy
 * nộp tiền) chưa có tích hợp cổng nào phía sau (khác domain/cấu trúc dữ liệu), nên `loai` luôn cố
 * định `"to-khai-dvc"` ở module này.
 */

const LOAI_HO_SO = "to-khai-dvc";
const NHAN_LOAI = "tờ khai (Dịch vụ công)";

/** Số hồ sơ tối đa trả về một lượt tìm kiếm — đủ cho một khoảng ngày, tránh kéo cả bảng khi bộ lọc rỗng. */
const MAX_KET_QUA_TIM_KIEM = 500;

/** Đọc 1 ô theo ĐÚNG tên cột thật cổng trả (không phải theo thứ tự) — bảng cổng có thể đổi thứ tự cột. */
function oTheoTieuDe(headers: string[], row: string[], tieuDe: string): string {
  const idx = headers.indexOf(tieuDe);
  return idx >= 0 ? (row[idx] ?? "") : "";
}

/** "Ngày nộp" cổng trả dạng `dd/MM/yyyy...` -> `Date` (best-effort, neo 12:00 trưa tránh lệch múi
 * giờ nhảy ngày). `null` nếu không parse được — hồ sơ vẫn lưu bình thường, chỉ không lọc/sắp theo
 * ngày được bằng cột này. */
function parseNgayNop(ngayNop: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(ngayNop);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(`${y}-${mo}-${d}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Các cột nội dung tệp của `dvc_tai_lieu` cho MỘT file vừa tải — dùng chung cho mọi chỗ ghi
 * (`dongBoChiTietHoSo` và `luuFileThongBaoVaoCache`) để bốn khối `create`/`update` không trôi khỏi
 * nhau. Ghi NGUYÊN BYTE vào `noi_dung_bin`, KHÔNG đụng cột `noi_dung` cũ nữa (xem schema).
 */
function truongNoiDungTep(tep: DvcTepTaiVe) {
  return {
    // `new Uint8Array(...)` chứ không đưa thẳng `Buffer`: Prisma 7 đòi `Uint8Array<ArrayBuffer>`,
    // còn `Buffer` khai là `Uint8Array<ArrayBufferLike>` (có thể nằm trên `SharedArrayBuffer`) nên
    // không gán được. Đây là bản SAO, chi phí không đáng kể với cỡ file thông báo.
    noi_dung_bin: new Uint8Array(tep.bytes),
    content_type: tep.contentType,
    ten_file: tep.fileName,
  };
}

/**
 * Các cột nội dung tờ khai của `dvc_ho_so` cho MỘT file vừa tải — song sinh với `truongNoiDungTep`,
 * dùng chung cho `dongBoChiTietHoSo` và `luuFileHoSoVaoCache`. Ghi NGUYÊN BYTE vào `xml_to_khai_bin`,
 * KHÔNG đụng cột `xml_to_khai` cũ nữa (xem schema).
 */
function truongToKhai(tep: DvcTepTaiVe) {
  return {
    // Xem chú thích `new Uint8Array` ở `truongNoiDungTep`.
    xml_to_khai_bin: new Uint8Array(tep.bytes),
    content_type: tep.contentType,
    ten_file_xml: tep.fileName,
  };
}

/**
 * Tờ khai dạng CHUỖI để bóc chỉ tiêu cho bảng tìm kiếm — `null` khi chưa tải, hoặc khi file KHÔNG
 * phải văn bản XML.
 *
 * Cái guard `application/xml` mới là điểm chính: từ khi `xml_to_khai_bin` nhận được cả nhị phân,
 * một hồ sơ trả PDF sẽ cho ra chuỗi rác nếu cứ `toString("utf8")` rồi ném vào
 * `layChiTieuToKhaiGtgt` — regex vẫn chạy, vẫn có thể vớ trúng thứ gì đó, và cột chỉ tiêu trên bảng
 * hiện số bịa. Không đọc được thì để trống, đúng quy ước "ô trống là kiểu hỏng nhìn ra được".
 */
export function xmlToKhaiDangChuoi(h: {
  xml_to_khai_bin: Uint8Array | null;
  content_type: string | null;
  xml_to_khai: string | null;
  ten_file_xml: string | null;
}): string | null {
  if (h.xml_to_khai_bin) {
    const mime = h.content_type ? chuanHoaMime(h.content_type) : doanContentType(h.ten_file_xml);
    if (!mime.includes("xml")) return null;
    return Buffer.from(h.xml_to_khai_bin).toString("utf8");
  }
  // Dòng cũ chỉ có cột Text: tới được đây thì chắc chắn là văn bản (nhị phân chưa bao giờ ghi nổi).
  return h.xml_to_khai;
}

/**
 * Đồng bộ CHI TIẾT một hồ sơ (tờ khai XML + danh sách thông báo + nội dung từng thông báo) — chỉ
 * gọi cho hồ sơ MỚI/chưa đồng bộ trọn vẹn, xem `dongBoHoSo`.
 *
 * KHÔNG đồng bộ "Tệp đính kèm": hình dạng JSON cổng trả cho `layTaiLieuDinhKem` chưa xác nhận (xem
 * docblock hàm đó ở `gdt-dvc.service.ts`) nên chưa có gì đáng tin để lưu — dialog "Tệp đính kèm" vẫn
 * gọi cổng trực tiếp như trước, không đổi. `da_dong_bo=true` ở đây nghĩa là "đã đồng bộ trọn vẹn
 * PHẦN đã có bộ bóc tin cậy", không phải tuyệt đối mọi dữ liệu liên quan hồ sơ.
 *
 * `da_dong_bo` chỉ được bật SAU KHI vòng tải thông báo chạy hết và KHÔNG thông báo nào lỗi. Trước
 * đây cờ này nằm chung khối `update` với xml, tức bật TRƯỚC khi tải thông báo — mà lỗi thông báo lại
 * bị nuốt, nên hồ sơ thiếu thông báo vẫn mang cờ "trọn vẹn"; lượt đồng bộ sau thấy cờ là bỏ qua
 * (`da_co_san`), thông báo thiếu VĨNH VIỄN không bao giờ được bù. Nay thiếu thông báo -> cờ giữ
 * `false` -> lượt sau tự thử lại đúng hồ sơ đó, đúng như schema tự khai.
 *
 * Trả về số thông báo hỏng để `dongBoHoSo` tính vào `loi` thay vì im lặng — hồ sơ dở dang phải
 * hiện lên trong lịch sử đồng bộ, không thì không ai biết mà tra.
 */
async function dongBoChiTietHoSo(
  tenantDb: PrismaClient,
  phien: DvcService.DvcPhien,
  maHoSo: string,
): Promise<{ thongBaoLoi: number }> {
  const xml = await DvcService.taiXmlHoSo(phien, maHoSo);
  // Ghi DB (xml vừa tải) và gọi cổng lấy danh sách thông báo ĐỘC LẬP với nhau — chạy song song
  // để độ trễ ghi DB chồng lấn với độ trễ mạng của lượt gọi cổng tiếp theo (vẫn chỉ 1 lượt gọi
  // cổng đồng thời, không vi phạm giới hạn tránh spam 429).
  //
  // `Promise.all` KHÔNG rollback: nhánh ghi DB có thể commit xong trong khi nhánh gọi cổng ném lỗi.
  // Chỉ ghi xml ở đây nên điều đó vô hại (xml tải được thì cache là đúng); đó cũng chính là lý do
  // thứ hai khiến `da_dong_bo` không được phép nằm trong khối này.
  const [, danhSachThongBao] = await Promise.all([
    tenantDb.dvc_ho_so.update({
      where: { ma_ho_so: maHoSo },
      data: truongToKhai(xml),
    }),
    DvcService.layDanhSachThongBao(phien, maHoSo),
  ]);
  let thongBaoLoi = 0;
  for (const tb of danhSachThongBao) {
    try {
      const file = await DvcService.taiThongBao(phien, maHoSo, tb.idTbao);
      await tenantDb.dvc_tai_lieu.upsert({
        where: { loai_khoa: { loai: "thong_bao", khoa: tb.idTbao } },
        create: {
          loai: "thong_bao",
          khoa: tb.idTbao,
          ma_ho_so: maHoSo,
          tieu_de: tb.tieuDe,
          ngay_gui: tb.ngayGui,
          ...truongNoiDungTep(file),
          raw: tb as unknown as Prisma.InputJsonValue,
        },
        update: {
          tieu_de: tb.tieuDe,
          ngay_gui: tb.ngayGui,
          ...truongNoiDungTep(file),
        },
      });
    } catch (err) {
      thongBaoLoi++;
      console.warn(
        `[DVC-DONG-BO] Không tải được thông báo ${tb.idTbao} của hồ sơ ${maHoSo}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  // Chỉ tới đây — xml đã lưu, danh sách thông báo đã lấy, MỌI thông báo đã tải xong — hồ sơ mới
  // thật sự trọn vẹn. Thiếu dù một thông báo thì để cờ nguyên `false` cho lượt sau bù.
  if (thongBaoLoi === 0) {
    await tenantDb.dvc_ho_so.update({ where: { ma_ho_so: maHoSo }, data: { da_dong_bo: true } });
  }

  return { thongBaoLoi };
}

export interface DongBoHoSoParams {
  /** Phiên cổng DVC ĐÃ ĐĂNG NHẬP (khóa + công ty sở hữu) — đồng bộ vẫn cần gọi cổng thật, khác
   * tìm kiếm (đọc DB). */
  phien: DvcService.DvcPhien;
  /** `yyyy-mm-dd`. */
  tuNgay: string;
  denNgay: string;
}

/**
 * Chạy một lượt "Đồng bộ": tra cứu cổng (dùng lại NGUYÊN `DvcService.traCuuHoSo` — auto-OCR captcha
 * + auto-relogin ngầm nếu phiên chết giữa chừng đã có sẵn ở đó), rồi với mỗi hồ sơ:
 *  - đã `da_dong_bo=true` từ trước -> CHỈ ghi đè `trang_thai`/`raw` (tiến trình xử lý có thể đổi),
 *    KHÔNG gọi lại cổng cho chi tiết -> tính vào `da_co_san`.
 *  - còn lại (mới hoặc dở dang) -> lưu bản ghi cơ bản rồi đồng bộ chi tiết (`dongBoChiTietHoSo`).
 *
 * Lỗi ở MỘT hồ sơ (vd tải XML hỏng) chỉ tính vào `loi` và bỏ qua, KHÔNG dừng cả lượt — hồ sơ lỗi giữ
 * `da_dong_bo=false` nên lượt "Đồng bộ" sau tự thử lại đúng hồ sơ đó.
 *
 * Chạy ĐỒNG BỘ (blocking) — không polling nền như `runSync` bên HĐĐT: số hồ sơ mỗi kỳ của một công
 * ty thường chỉ vài chục, và hồ sơ đã đồng bộ trước chỉ tốn 1 lượt ghi đè nhẹ, nên không cần hạ tầng
 * chạy nền + tiến độ cho khối lượng này.
 */
export async function dongBoHoSo(
  tenantDb: PrismaClient,
  params: DongBoHoSoParams,
): Promise<dvc_dong_bo_log> {
  const { headers, rows } = await DvcService.traCuuHoSo({
    ...params.phien,
    tuNgay: params.tuNgay,
    denNgay: params.denNgay,
    scope: "SELF",
  });

  let daCoSan = 0;
  let dongBoXong = 0;
  let loi = 0;

  // Đọc trước `da_dong_bo` của MỌI hồ sơ trong 1 query — tránh N+1 (1 query DB tenant/hồ sơ) nếu
  // tra vòng lặp; đây là DB tenant nên gộp thoải mái, không đụng tới ràng buộc "gọi cổng tuần tự".
  const maHoSoList = [...new Set(rows.map((row) => oTheoTieuDe(headers, row, "Mã hồ sơ")))].filter(
    Boolean,
  );
  const daDongBoTheoMa = new Map(
    (
      await tenantDb.dvc_ho_so.findMany({
        where: { ma_ho_so: { in: maHoSoList } },
        select: { ma_ho_so: true, da_dong_bo: true },
      })
    ).map((r) => [r.ma_ho_so, r.da_dong_bo]),
  );

  for (const row of rows) {
    const maHoSo = oTheoTieuDe(headers, row, "Mã hồ sơ");
    if (!maHoSo) {
      loi++;
      continue;
    }

    const raw = Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]));
    const trangThai = oTheoTieuDe(headers, row, "Trạng thái") || null;

    try {
      if (daDongBoTheoMa.get(maHoSo)) {
        await tenantDb.dvc_ho_so.update({
          where: { ma_ho_so: maHoSo },
          data: { trang_thai: trangThai, raw },
        });
        daCoSan++;
        continue;
      }

      await tenantDb.dvc_ho_so.upsert({
        where: { ma_ho_so: maHoSo },
        create: {
          ma_ho_so: maHoSo,
          ten_tthc: oTheoTieuDe(headers, row, "Tên TTHC") || null,
          to_khai: oTheoTieuDe(headers, row, "Tờ khai") || null,
          ky_tinh_thue: oTheoTieuDe(headers, row, "Kỳ tính thuế") || null,
          loai_to_khai: oTheoTieuDe(headers, row, "Loại tờ khai") || null,
          lan_nop: oTheoTieuDe(headers, row, "Lần nộp") || null,
          lan_bo_sung: oTheoTieuDe(headers, row, "Lần nộp bổ sung") || null,
          ngay_nop: oTheoTieuDe(headers, row, "Ngày nộp") || null,
          ngay_nop_date: parseNgayNop(oTheoTieuDe(headers, row, "Ngày nộp")),
          noi_nop: oTheoTieuDe(headers, row, "Cơ quan thuế tiếp nhận") || null,
          trang_thai: trangThai,
          raw,
        },
        update: { trang_thai: trangThai, raw },
      });

      const { thongBaoLoi } = await dongBoChiTietHoSo(tenantDb, params.phien, maHoSo);
      if (thongBaoLoi > 0) {
        // Hồ sơ dở dang: xml có nhưng thiếu thông báo -> `da_dong_bo` vẫn false nên lượt sau tự bù.
        // Tính vào `loi` để lịch sử đồng bộ nói đúng "sẽ bù ở lượt sau", thay vì báo xong mà thiếu.
        loi++;
        console.warn(
          `[DVC-DONG-BO] Hồ sơ ${maHoSo} thiếu ${thongBaoLoi} thông báo — giữ da_dong_bo=false để bù ở lượt sau.`,
        );
      } else {
        dongBoXong++;
      }
    } catch (err) {
      loi++;
      console.warn(
        `[DVC-DONG-BO] Đồng bộ hồ sơ ${maHoSo} lỗi: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  return ghiLichSuDongBo(tenantDb, {
    tuNgay: params.tuNgay,
    denNgay: params.denNgay,
    tongHoSo: rows.length,
    daCoSan,
    dongBoXong,
    loi,
  });
}

interface GhiLichSuParams {
  tuNgay: string;
  denNgay: string;
  tongHoSo: number;
  daCoSan: number;
  dongBoXong: number;
  loi: number;
}

/** Ghi 1 dòng `dvc_dong_bo_log` — CẢ lượt đồng bộ THÀNH lẫn CÓ LỖI đều ghi (trang_thai phân biệt),
 * để lịch sử thấy đủ, không chỉ mỗi lượt trót lọt. */
function ghiLichSuDongBo(tenantDb: PrismaClient, p: GhiLichSuParams): Promise<dvc_dong_bo_log> {
  return tenantDb.dvc_dong_bo_log.create({
    data: {
      id: randomUUID(),
      loai: LOAI_HO_SO,
      // Nhãn hiển thị (không dùng để lọc) -> neo 12:00 trưa tránh lệch múi giờ nhảy ngày, cùng quy
      // ước `createSyncLogRow` bên `hddt/gdt.service.ts`.
      tu_ngay: new Date(`${p.tuNgay}T12:00:00`),
      den_ngay: new Date(`${p.denNgay}T12:00:00`),
      tong_ho_so: p.tongHoSo,
      da_co_san: p.daCoSan,
      dong_bo_xong: p.dongBoXong,
      loi: p.loi,
      trang_thai: p.loi > 0 ? "partial" : "done",
      dien_giai:
        `Đồng bộ ${NHAN_LOAI}` + (p.loi > 0 ? ` — ${p.loi} hồ sơ lỗi, sẽ bù ở lượt sau` : ""),
    },
  });
}

/** Lịch sử đồng bộ (mới nhất trước), giới hạn 100 dòng gần nhất — cùng quy ước `listSyncLogs`. */
export function layLichSuDongBo(tenantDb: PrismaClient): Promise<dvc_dong_bo_log[]> {
  return tenantDb.dvc_dong_bo_log.findMany({
    orderBy: { created_at: "desc" },
    take: 100,
  });
}

/** Xóa 1 dòng lịch sử theo id — CHỈ bản ghi log, KHÔNG đụng hồ sơ/tài liệu đã lưu. Trả số dòng đã
 * xóa (0 nếu không tồn tại) để controller phân biệt 404, cùng quy ước `deleteSyncLog`. */
export async function xoaLichSuDongBo(tenantDb: PrismaClient, id: string): Promise<number> {
  const { count } = await tenantDb.dvc_dong_bo_log.deleteMany({ where: { id } });
  return count;
}

/** Xóa TOÀN BỘ lịch sử đồng bộ — vẫn CHỈ bản ghi log, không đụng `dvc_ho_so`/`dvc_tai_lieu`: xóa
 * lịch sử không có nghĩa "quên" dữ liệu đã kéo về, chỉ dọn bảng lịch sử cho gọn. */
export async function xoaTatCaLichSuDongBo(tenantDb: PrismaClient): Promise<number> {
  const { count } = await tenantDb.dvc_dong_bo_log.deleteMany({});
  return count;
}

export interface TimHoSoDaDongBoBoLoc {
  /** `yyyy-mm-dd`. */
  tuNgay?: string;
  denNgay?: string;
  /** Lọc theo cột `ma_ho_so` (contains) — khớp tham số `maHoSo` mà FE vẫn gửi cho tra cứu trước đây. */
  maHoSo?: string;
  /** Lọc theo cột `to_khai` (contains) — khớp tham số `maToKhai` cũ. */
  maToKhai?: string;
}

/**
 * Đọc hồ sơ ĐÃ ĐỒNG BỘ trong DB tenant, dựng lại hình dạng `{headers, rows}` như tra cứu cổng — từ
 * cột `raw` đã lưu ở `dongBoHoSo`, GỘP THÊM chỉ tiêu bóc từ `xml_to_khai` nếu có (`toKhaiXml.ts`,
 * hiện chỉ mẫu 01/GTGT) — để 10 cột chỉ tiêu GTGT mới thêm ở `config.ts` tự khớp vào bảng giống
 * hệt cột thường (khớp theo TÊN, xem `BangHoSo`), FE không phải đổi gì để đọc.
 *
 * `headers` hợp nhất theo thứ tự xuất hiện đầu tiên trên các dòng khớp bộ lọc: mọi hồ sơ tab này
 * cùng một bảng cổng nên cùng bộ cột, hợp nhất chỉ để an toàn nếu cổng từng đổi cột giữa các lượt
 * đồng bộ khác nhau (và để hồ sơ KHÔNG phải 01/GTGT không có chỉ tiêu vẫn hiện các cột khác bình
 * thường, chỉ riêng cột chỉ tiêu GTGT của dòng đó để trống).
 */
export async function timHoSoDaDongBo(
  tenantDb: PrismaClient,
  boLoc: TimHoSoDaDongBoBoLoc,
): Promise<BangHoSoDaBoc> {
  const where: Prisma.dvc_ho_soWhereInput = {};
  if (boLoc.tuNgay || boLoc.denNgay) {
    where.ngay_nop_date = {
      ...(boLoc.tuNgay ? { gte: new Date(`${boLoc.tuNgay}T00:00:00`) } : {}),
      ...(boLoc.denNgay ? { lte: new Date(`${boLoc.denNgay}T23:59:59`) } : {}),
    };
  }
  if (boLoc.maHoSo) where.ma_ho_so = { contains: boLoc.maHoSo, mode: "insensitive" };
  if (boLoc.maToKhai) where.to_khai = { contains: boLoc.maToKhai, mode: "insensitive" };

  const daLuu = await tenantDb.dvc_ho_so.findMany({
    where,
    orderBy: { ngay_nop_date: "desc" },
    take: MAX_KET_QUA_TIM_KIEM,
    select: {
      raw: true,
      xml_to_khai_bin: true,
      content_type: true,
      xml_to_khai: true,
      ten_file_xml: true,
    },
  });

  if (daLuu.length === 0) return { headers: [], rows: [] };

  const banDay = daLuu.map((h) => {
    const xml = xmlToKhaiDangChuoi(h);
    return {
      ...(h.raw as Record<string, unknown>),
      ...(xml ? layChiTieuToKhaiGtgt(xml) : {}),
    };
  });

  const headers: string[] = [];
  for (const dong of banDay) {
    for (const k of Object.keys(dong)) {
      if (!headers.includes(k)) headers.push(k);
    }
  }

  const rows = banDay.map((dong) => headers.map((h) => String(dong[h] ?? "")));
  return { headers, rows };
}

// ============================================================
//  ĐỌC/GHI CACHE CHO "TẢI FILE" + "THÔNG BÁO" TỪNG HỒ SƠ
//
//  Ba cache ĐỘC LẬP với `da_dong_bo` (cờ đó chỉ nói "lượt Đồng bộ đã kéo TRỌN VẸN xml + thông
//  báo", do CHÍNH `dongBoHoSo` set) — các hàm dưới đây phục vụ đọc/ghi CƠ HỘI (opportunistic) mỗi
//  khi người dùng tự bấm "Tải file"/mở "Thông báo" cho MỘT hồ sơ, kể cả khi hồ sơ đó chưa từng
//  chạy "Đồng bộ". Controller đọc cache trước; miss thì gọi cổng thật (cần `key`) rồi ghi lại đúng
//  MẢNH vừa lấy được — KHÔNG set `da_dong_bo`, để lượt "Đồng bộ" sau vẫn biết hồ sơ này còn thiếu
//  phần kia (vd đã có xml nhờ bấm tay nhưng thông báo thì chưa) mà tự bù, không bỏ sót.
// ============================================================

/**
 * Tờ khai đã lưu của một hồ sơ — `null` nếu chưa có (kể cả khi hồ sơ chưa tồn tại trong DB).
 *
 * Đọc HAI cột theo thứ tự, hệt `layFileThongBaoDaLuu`: `xml_to_khai_bin` (nguyên byte, mọi dòng ghi
 * từ nay) trước, rồi mới tới `xml_to_khai` (Text) của bản cache cũ.
 */
export async function layFileHoSoDaLuu(
  tenantDb: PrismaClient,
  maHoSo: string,
): Promise<DvcTepTaiVe | null> {
  const hoSo = await tenantDb.dvc_ho_so.findUnique({
    where: { ma_ho_so: maHoSo },
    select: {
      xml_to_khai_bin: true,
      content_type: true,
      xml_to_khai: true,
      ten_file_xml: true,
    },
  });
  if (!hoSo) return null;

  const tenFile = hoSo.ten_file_xml || `${maHoSo}.xml`;
  // Trước đây hardcode `application/xml` cho mọi tờ khai; nay lấy MIME thật cổng khai, dòng cũ
  // chưa có cột thì đoán theo đuôi tên file (mặc định `${maHoSo}.xml` nên vẫn ra `application/xml`).
  const contentType = hoSo.content_type
    ? chuanHoaMime(hoSo.content_type)
    : doanContentType(tenFile);

  if (hoSo.xml_to_khai_bin) {
    return { bytes: Buffer.from(hoSo.xml_to_khai_bin), contentType, fileName: tenFile };
  }
  if (hoSo.xml_to_khai) {
    return { bytes: Buffer.from(hoSo.xml_to_khai, "utf8"), contentType, fileName: tenFile };
  }
  return null;
}

/**
 * Giá trị cột "Tờ khai" của một hồ sơ (`dvc_ho_so.to_khai`, cột "Tờ khai / Phụ lục" trên bảng) —
 * `null` nếu hồ sơ chưa có trong DB hoặc cổng không trả ô này.
 *
 * Dùng làm GỢI Ý NHẬN DIỆN MẪU cho `layChiTietToKhai`: ô này thường ghi thẳng mã mẫu ("05/KK-TNCN",
 * "01/GTGT"), chắc chắn hơn so với dò chuỗi tiêu đề bên trong XML — tiêu đề có thể viết khác nhau
 * giữa các phiên bản mẫu, mà XML thì có hồ sơ chưa tải về.
 */
export async function layMaToKhaiDaLuu(
  tenantDb: PrismaClient,
  maHoSo: string,
): Promise<string | null> {
  const hoSo = await tenantDb.dvc_ho_so.findUnique({
    where: { ma_ho_so: maHoSo },
    select: { to_khai: true },
  });
  return hoSo?.to_khai ?? null;
}

/** Ghi tờ khai XML vừa tải trực tiếp từ cổng vào `dvc_ho_so` — `updateMany` (không upsert): hồ sơ
 * phải đã tồn tại (từ một lượt tìm kiếm/đồng bộ trước), không tự bịa ra một dòng chỉ có mỗi xml. */
export async function luuFileHoSoVaoCache(
  tenantDb: PrismaClient,
  maHoSo: string,
  tep: DvcTepTaiVe,
): Promise<void> {
  await tenantDb.dvc_ho_so.updateMany({
    where: { ma_ho_so: maHoSo },
    data: truongToKhai(tep),
  });
}

/**
 * Danh sách thông báo đã lưu của một hồ sơ. Trả:
 *  - mảng (có thể rỗng) nếu ĐÃ CHẮC — có sẵn dòng `dvc_tai_lieu`, HOẶC hồ sơ đã `da_dong_bo=true`
 *    (lượt Đồng bộ trước xác nhận hồ sơ này không có thông báo nào, không phải chưa kiểm tra).
 *  - `null` nếu CHƯA CHẮC (chưa có dòng nào mà cũng chưa đồng bộ trọn vẹn) — controller phải hỏi
 *    cổng thật để biết chính xác, không được coi rỗng-vì-chưa-biết là "không có thông báo".
 */
export async function layDanhSachThongBaoDaLuu(
  tenantDb: PrismaClient,
  maHoSo: string,
): Promise<ThongBaoDaBoc[] | null> {
  const rows = await tenantDb.dvc_tai_lieu.findMany({
    where: { ma_ho_so: maHoSo, loai: "thong_bao" },
    orderBy: { datetime0: "asc" },
    // `select` chứ không lấy cả dòng: đây chỉ là danh sách tiêu đề, mà `noi_dung_bin` nay giữ
    // NGUYÊN BYTE file (có cả PDF) — kéo về rồi vứt đi là tốn băng thông DB cho không.
    select: { tieu_de: true, ngay_gui: true, khoa: true },
  });
  if (rows.length > 0) {
    return rows.map((r) => ({ tieuDe: r.tieu_de ?? "", ngayGui: r.ngay_gui ?? "", idTbao: r.khoa }));
  }

  const hoSo = await tenantDb.dvc_ho_so.findUnique({
    where: { ma_ho_so: maHoSo },
    select: { da_dong_bo: true },
  });
  return hoSo?.da_dong_bo ? [] : null;
}

/** Ghi lại METADATA (tiêu đề/ngày gửi) của danh sách thông báo vừa lấy trực tiếp từ cổng — CHƯA có
 * nội dung file (`noi_dung` null), chỉ tải khi người dùng thật sự bấm tải từng thông báo (xem
 * `luuFileThongBaoVaoCache`) — mở danh sách không có nghĩa cần nội dung mọi file ngay. */
export async function luuMetaThongBaoVaoCache(
  tenantDb: PrismaClient,
  maHoSo: string,
  ds: ThongBaoDaBoc[],
): Promise<void> {
  // Mỗi thông báo upsert vào một khóa (`loai`, `khoa`) riêng, độc lập với nhau — chạy song song
  // thay vì tuần tự (khác vòng lặp GỌI CỔNG ở `dongBoChiTietHoSo`, đây thuần là ghi DB tenant).
  await Promise.all(
    ds.map((tb) =>
      tenantDb.dvc_tai_lieu.upsert({
        where: { loai_khoa: { loai: "thong_bao", khoa: tb.idTbao } },
        create: {
          loai: "thong_bao",
          khoa: tb.idTbao,
          ma_ho_so: maHoSo,
          tieu_de: tb.tieuDe,
          ngay_gui: tb.ngayGui,
          raw: tb as unknown as Prisma.InputJsonValue,
        },
        update: { tieu_de: tb.tieuDe, ngay_gui: tb.ngayGui },
      }),
    ),
  );
}

/**
 * Nội dung file của MỘT thông báo đã lưu — `null` nếu chưa tải (dòng có thể tồn tại với mỗi
 * metadata, hoặc chưa tồn tại luôn).
 *
 * Đọc HAI cột theo thứ tự: `noi_dung_bin` (nguyên byte, mọi dòng ghi từ nay) trước, rồi mới tới
 * `noi_dung` (Text) — cột cũ chỉ còn dữ liệu cache từ trước lượt sửa này, giữ lại để không bắt
 * người dùng tải lại từ cổng thứ đã có sẵn. Xem chú thích hai cột trong schema.
 */
export async function layFileThongBaoDaLuu(
  tenantDb: PrismaClient,
  maHoSo: string,
  idTbao: string,
): Promise<DvcTepTaiVe | null> {
  const row = await tenantDb.dvc_tai_lieu.findUnique({
    where: { loai_khoa: { loai: "thong_bao", khoa: idTbao } },
  });
  if (!row || row.ma_ho_so !== maHoSo) return null;

  const tenFile = row.ten_file || `thong-bao-${idTbao}.xml`;

  if (row.noi_dung_bin) {
    return {
      bytes: Buffer.from(row.noi_dung_bin),
      // `chuanHoaMime` chứ không dùng thẳng: dòng ghi trong khoảng thời gian ngắn trước khi
      // `chuanHoaMime` được thêm vào `docTepTuResponse` đã kịp lưu ĐUÔI ("xml") vào cột này.
      // Dòng cũ hơn nữa thì cột rỗng -> đoán theo đuôi tên file.
      contentType: row.content_type ? chuanHoaMime(row.content_type) : doanContentType(row.ten_file),
      fileName: tenFile,
    };
  }

  // Dòng cache CŨ: chỉ có cột Text. Tới được đây thì nội dung chắc chắn là văn bản — nhị phân
  // chưa bao giờ ghi nổi vào cột đó (Postgres chặn), đúng cái lỗi lượt sửa này vá.
  if (row.noi_dung) {
    return {
      bytes: Buffer.from(row.noi_dung, "utf8"),
      contentType: row.content_type ? chuanHoaMime(row.content_type) : doanContentType(row.ten_file),
      fileName: tenFile,
    };
  }

  return null;
}

/** Ghi nội dung file thông báo vừa tải trực tiếp từ cổng. Upsert (không chỉ update) vì dòng
 * metadata có thể chưa tồn tại — hiếm nhưng có thể xảy ra nếu FE gọi tải thẳng mà chưa từng mở
 * danh sách thông báo của hồ sơ này trong phiên làm việc. */
export async function luuFileThongBaoVaoCache(
  tenantDb: PrismaClient,
  maHoSo: string,
  idTbao: string,
  tep: DvcTepTaiVe,
): Promise<void> {
  await tenantDb.dvc_tai_lieu.upsert({
    where: { loai_khoa: { loai: "thong_bao", khoa: idTbao } },
    create: {
      loai: "thong_bao",
      khoa: idTbao,
      ma_ho_so: maHoSo,
      ...truongNoiDungTep(tep),
      raw: {},
    },
    update: truongNoiDungTep(tep),
  });
}
