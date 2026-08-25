import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "../../../../generated/tenant";
import { getTenantDb } from "../../../../helpers/tenantClient";
import { oTheoTieuDe, type BangHoSoDaBoc } from "../hoSoHtml";
import * as EtaxGnt from "./gdt-etax-gnt.service";
import type { DvcPhien } from "../gdt-dvc.service";
import * as DvcDongBo from "../dvc-dong-bo.service";

/**
 * Đồng bộ Giấy nộp tiền (GNT) từ cổng eTax GNT về DB tenant (`dvc_giay_nop_tien`), và đọc lại dữ
 * liệu đã lưu cho ô tìm kiếm chính. Vai trò tương tự `dvc-dong-bo.service.ts` (tab "Tờ khai") nhưng
 * tách file riêng vì nguồn (`thuedientu.gdt.gov.vn`, khác domain) và hình dạng dữ liệu khác hẳn.
 *
 * TÁI DÙNG hạ tầng lượt-chạy-nền của `dvc-dong-bo.service.ts`
 * (`batDauDongBoRun`/`docTienDoDongBo`) thay vì tự dựng một kho riêng: một công ty chỉ chạy MỘT lượt
 * "Đồng bộ" tại một thời điểm dù đang đồng bộ loại nào — khớp đúng UI hiện có (một nút "Đồng bộ",
 * một toast tiến độ), xem spec mục 3.1.
 */

const LOAI_GNT = "giay-nop-tien";
const NHAN_LOAI = "giấy nộp tiền";
/** GNT chỉ có MỘT nguồn/pipeline, form gốc dùng `dd/MM/yyyy` — khác `yyyy-mm-dd` mà API app dùng. */
function ngayIsoSangDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseNgayLap(ngayLap: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(ngayLap);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(`${y}-${mo}-${d}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Chạy TRỌN một lượt đồng bộ GNT: mở phiên -> khởi tạo tra cứu -> gộp mọi trang kết quả -> lưu từng
 * dòng vào DB. Lỗi tải PDF của MỘT dòng chỉ tính `loi++`, không huỷ cả lượt.
 */
export async function dongBoGiayNopTien(
  dbName: string,
  params: {
    phien: DvcPhien;
    donViId: string;
    /** `yyyy-mm-dd`. */
    tuNgay: string;
    denNgay: string;
    tienDo: DvcDongBo.DvcDongBoTienDo;
    daBiThay: () => boolean;
  },
): Promise<void> {
  const db = () => getTenantDb(dbName);
  const { tienDo } = params;

  const boLoc: EtaxGnt.GntBoLoc = {
    tuNgayLap: ngayIsoSangDdMmYyyy(params.tuNgay),
    denNgayLap: ngayIsoSangDdMmYyyy(params.denNgay),
  };

  let session = await EtaxGnt.ganPhienGnt(params.phien, params.donViId);
  session = await EtaxGnt.khoiTaoTraCuuGnt(session);

  let loi = 0;
  let dongBoXong = 0;
  const MAX_TRANG = 50;
  for (let page = 1; page <= MAX_TRANG; page++) {
    if (params.daBiThay()) return;

    const ket = await EtaxGnt.traCuuGnt(session, boLoc, page);
    session = ket.session;
    const { headers, rows } = ket.bang;
    tienDo.tongHoSo = Math.max(tienDo.tongHoSo, ket.phanTrang.tongSoBanGhi ?? rows.length);

    for (let i = 0; i < rows.length; i++) {
      if (params.daBiThay()) return;
      const row = rows[i]!;
      const ctuId = ket.ctuIds[i];
      const soThamChieu = oTheoTieuDe(headers, row, "Số tham chiếu / Mã giao dịch");
      if (!soThamChieu || !ctuId) {
        loi++;
        tienDo.loi = loi;
        continue;
      }
      tienDo.maHoSoDangLam = soThamChieu;

      const raw = Object.fromEntries(headers.map((h, idx) => [h, row[idx] ?? ""]));
      const ngayLap = oTheoTieuDe(headers, row, "Ngày lập GNT");
      const soTienRaw = oTheoTieuDe(headers, row, "Số tiền").replace(/[.,\s]/g, "");

      try {
        await db().dvc_giay_nop_tien.upsert({
          where: { so_tham_chieu: soThamChieu },
          create: {
            so_tham_chieu: soThamChieu,
            ctu_id: ctuId,
            so_giay_nop_tien: oTheoTieuDe(headers, row, "Số giấy nộp tiền") || null,
            so_tien: soTienRaw ? soTienRaw : null,
            loai_tien: oTheoTieuDe(headers, row, "Loại tiền") || null,
            trang_thai: oTheoTieuDe(headers, row, "Trạng thái") || null,
            so_chung_tu: oTheoTieuDe(headers, row, "Số chứng từ") || null,
            ngay_lap_gnt: ngayLap || null,
            ngay_nop_date: parseNgayLap(ngayLap),
            ngan_hang: oTheoTieuDe(headers, row, "Ngân hàng") || null,
            tai_khoan_ngan_hang: oTheoTieuDe(headers, row, "Tài khoản ngân hàng") || null,
            raw,
          },
          update: { trang_thai: oTheoTieuDe(headers, row, "Trạng thái") || null, raw },
        });
        dongBoXong++;
        tienDo.dongBoXong = dongBoXong;
      } catch (err) {
        loi++;
        tienDo.loi = loi;
        console.warn(
          `[DVC-GNT] Đồng bộ ${soThamChieu} lỗi: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (rows.length === 0) break;
    if (ket.phanTrang.tongSoTrang !== null && page >= ket.phanTrang.tongSoTrang) break;
  }

  tienDo.maHoSoDangLam = "";

  await db().dvc_dong_bo_log.create({
    data: {
      id: randomUUID(),
      loai: LOAI_GNT,
      tu_ngay: new Date(`${params.tuNgay}T12:00:00`),
      den_ngay: new Date(`${params.denNgay}T12:00:00`),
      tong_ho_so: tienDo.tongHoSo,
      da_co_san: 0,
      dong_bo_xong: dongBoXong,
      loi,
      trang_thai: loi > 0 ? "partial" : "done",
      dien_giai: `Đồng bộ ${NHAN_LOAI}` + (loi > 0 ? ` — ${loi} dòng lỗi` : ""),
    },
  });
}

export interface TimGntBoLoc {
  /** `yyyy-mm-dd`. */
  tuNgay?: string;
  denNgay?: string;
  maGiaoDich?: string;
  soGnt?: string;
}

const MAX_KET_QUA_TIM_KIEM = 500;

/** Đọc GNT ĐÃ ĐỒNG BỘ trong DB tenant, dựng lại hình dạng `{headers, rows}` từ cột `raw` — cùng
 * khuôn `timHoSoDaDongBo` bên `dvc-dong-bo.service.ts`. */
export async function timGiayNopTienDaDongBo(
  tenantDb: PrismaClient,
  boLoc: TimGntBoLoc,
): Promise<BangHoSoDaBoc> {
  const where: Prisma.dvc_giay_nop_tienWhereInput = {};
  if (boLoc.tuNgay || boLoc.denNgay) {
    where.ngay_nop_date = {
      ...(boLoc.tuNgay ? { gte: new Date(`${boLoc.tuNgay}T00:00:00`) } : {}),
      ...(boLoc.denNgay ? { lte: new Date(`${boLoc.denNgay}T23:59:59`) } : {}),
    };
  }
  if (boLoc.maGiaoDich) where.so_tham_chieu = { contains: boLoc.maGiaoDich, mode: "insensitive" };
  if (boLoc.soGnt) where.so_giay_nop_tien = { contains: boLoc.soGnt, mode: "insensitive" };

  const daLuu = await tenantDb.dvc_giay_nop_tien.findMany({
    where,
    orderBy: { ngay_nop_date: "desc" },
    take: MAX_KET_QUA_TIM_KIEM,
    select: { raw: true },
  });

  if (daLuu.length === 0) return { headers: [], rows: [] };

  const headers: string[] = [];
  for (const dong of daLuu) {
    for (const k of Object.keys(dong.raw as Record<string, unknown>)) {
      if (!headers.includes(k)) headers.push(k);
    }
  }
  const rows = daLuu.map((dong) =>
    headers.map((h) => String((dong.raw as Record<string, unknown>)[h] ?? "")),
  );
  return { headers, rows };
}

/** File PDF đã lưu của một GNT — `null` nếu chưa có (kể cả khi chưa tồn tại trong DB). */
export async function layFileGntDaLuu(
  tenantDb: PrismaClient,
  soThamChieu: string,
): Promise<{ bytes: Buffer; contentType: string; fileName: string } | null> {
  const row = await tenantDb.dvc_giay_nop_tien.findUnique({
    where: { so_tham_chieu: soThamChieu },
    select: { file_pdf_bin: true, content_type: true, ten_file: true, ctu_id: true },
  });
  if (!row?.file_pdf_bin) return null;
  return {
    bytes: Buffer.from(row.file_pdf_bin),
    contentType: row.content_type ?? "application/pdf",
    fileName: row.ten_file ?? `${row.ctu_id}.pdf`,
  };
}

/** Ghi PDF vừa tải trực tiếp từ cổng vào cache — `updateMany` (không upsert): dòng phải đã tồn tại
 * từ một lượt đồng bộ trước, cùng quy ước `luuFileHoSoVaoCache` bên `dvc-dong-bo.service.ts`. */
export async function luuFileGntVaoCache(
  tenantDb: PrismaClient,
  soThamChieu: string,
  tep: { bytes: Buffer; contentType: string; fileName: string },
): Promise<void> {
  await tenantDb.dvc_giay_nop_tien.updateMany({
    where: { so_tham_chieu: soThamChieu },
    data: {
      // `new Uint8Array(...)` chứ không đưa thẳng `Buffer`: Prisma 7 đòi `Uint8Array<ArrayBuffer>`,
      // còn `Buffer` khai là `Uint8Array<ArrayBufferLike>` nên không gán được — cùng chú thích ở
      // `truongNoiDungTep` bên `dvc-dong-bo.service.ts`.
      file_pdf_bin: new Uint8Array(tep.bytes),
      content_type: tep.contentType,
      ten_file: tep.fileName,
    },
  });
}

/** `ctuId` đã lưu của một GNT — cần để gọi `taiPdfGnt` khi cache miss. `null` nếu chưa có trong DB. */
export async function layCtuIdDaLuu(
  tenantDb: PrismaClient,
  soThamChieu: string,
): Promise<string | null> {
  const row = await tenantDb.dvc_giay_nop_tien.findUnique({
    where: { so_tham_chieu: soThamChieu },
    select: { ctu_id: true },
  });
  return row?.ctu_id ?? null;
}
