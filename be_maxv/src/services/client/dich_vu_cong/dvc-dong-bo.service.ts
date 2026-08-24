import { randomUUID } from "crypto";
import { Prisma, type PrismaClient, type dvc_dong_bo_log } from "../../../generated/tenant";
import {
  oTheoTieuDe,
  type BangHoSoDaBoc,
  type ThongBaoDaBoc,
} from "./hoSoHtml";
import { chiaDoanTheoNguon, type DoanTraCuu } from "./nguonTheoNgay";
import * as DvcService from "./gdt-dvc.service";
import type { DvcTepTaiVe } from "./gdt-dvc.service";
import { chuanHoaMime, doanContentType } from "./gdt-dvc.service";
import { layChiTieuToKhaiGtgt } from "./toKhaiXml";
import { taoKhoLuotChayNen, type LuotChayNen } from "../../shared/luotChayNen";
import { getTenantDb } from "../../../helpers/tenantClient";

/**
 * Đồng bộ hồ sơ tờ khai (tab "Tờ khai — Dịch vụ công") từ cổng dichvucong.gdt.gov.vn về DB tenant
 * (`dvc_ho_so`/`dvc_tai_lieu`), và đọc lại dữ liệu đã lưu cho ô tìm kiếm chính — để tra cứu sau đó
 * không phải đăng nhập cổng nữa. Vai trò tương tự `runSync`/`listSyncLogs` bên `hddt/gdt.service.ts`
 * nhưng tách file riêng vì nguồn dữ liệu (hồ sơ theo loại giấy tờ) khác hẳn hóa đơn.
 *
 * PHẠM VI HIỆN TẠI: chỉ tab "Tờ khai (Dịch vụ công - thuế điện tử)" — tab "Giấy nộp tiền" chưa có
 * tích hợp cổng nào phía sau (khác domain/cấu trúc dữ liệu), nên `loai` luôn cố định
 * `"to-khai-dvc"` ở module này.
 */

const LOAI_HO_SO = "to-khai-dvc";
const NHAN_LOAI = "tờ khai (Dịch vụ công)";

/** Số hồ sơ tối đa trả về một lượt tìm kiếm — đủ cho một khoảng ngày, tránh kéo cả bảng khi bộ lọc rỗng. */
const MAX_KET_QUA_TIM_KIEM = 500;


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

/** Một thông báo tải hỏng trong lượt — đủ thông tin để thử lại mà không phải làm lại cả hồ sơ. */
interface ThongBaoHong {
  maHoSo: string;
  nguon: DvcService.NguonHoSo;
  tb: ThongBaoDaBoc;
}

/**
 * Tải nội dung MỘT thông báo rồi ghi vào cache. Trả `false` nếu hỏng (đã log), KHÔNG ném — người
 * gọi cần biết cái nào hỏng để bù, chứ không phải dừng cả hồ sơ vì một file.
 */
async function taiVaLuuThongBao(
  db: () => PrismaClient,
  phien: DvcService.DvcPhien,
  maHoSo: string,
  nguon: DvcService.NguonHoSo,
  tb: ThongBaoDaBoc,
): Promise<boolean> {
  try {
    const file = await DvcService.taiThongBao(phien, maHoSo, tb.idTbao, nguon);
    await db().dvc_tai_lieu.upsert({
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
    return true;
  } catch (err) {
    console.warn(
      `[DVC-DONG-BO] Không tải được thông báo ${tb.idTbao} của hồ sơ ${maHoSo}: ` +
        (err instanceof Error ? err.message : String(err)),
    );
    return false;
  }
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
  db: () => PrismaClient,
  phien: DvcService.DvcPhien,
  maHoSo: string,
  nguon: DvcService.NguonHoSo,
  daBiThay: () => boolean,
): Promise<ThongBaoHong[]> {
  const xml = await DvcService.taiXmlHoSo(phien, maHoSo, nguon);
  // Ghi DB (xml vừa tải) và gọi cổng lấy danh sách thông báo ĐỘC LẬP với nhau — chạy song song
  // để độ trễ ghi DB chồng lấn với độ trễ mạng của lượt gọi cổng tiếp theo (vẫn chỉ 1 lượt gọi
  // cổng đồng thời, không vi phạm giới hạn tránh spam 429).
  //
  // `Promise.all` KHÔNG rollback: nhánh ghi DB có thể commit xong trong khi nhánh gọi cổng ném lỗi.
  // Chỉ ghi xml ở đây nên điều đó vô hại (xml tải được thì cache là đúng); đó cũng chính là lý do
  // thứ hai khiến `da_dong_bo` không được phép nằm trong khối này.
  const [, danhSachThongBao] = await Promise.all([
    db().dvc_ho_so.update({
      where: { ma_ho_so: maHoSo },
      data: truongToKhai(xml),
    }),
    DvcService.layDanhSachThongBao(phien, maHoSo, nguon),
  ]);

  const hong: ThongBaoHong[] = [];
  for (const tb of danhSachThongBao) {
    // Kiểm ở ĐÂY chứ không chỉ giữa các hồ sơ: vòng này gọi cổng MỘT LƯỢT MỖI THÔNG BÁO và số
    // thông báo do cổng quyết định. Hồ sơ 20 thông báo là 20 call paced (~16s, tới 5 phút nếu nhịp
    // đang bị phạt) của một lượt không ai đọc — mà làn `dvc` nối đuôi concurrency 1, nên lượt MỚI
    // phải xếp hàng chờ hết chỗ đó mới bắt đầu được.
    if (daBiThay()) break;
    if (!(await taiVaLuuThongBao(db, phien, maHoSo, nguon, tb))) {
      hong.push({ maHoSo, nguon, tb });
    }
  }

  // Chỉ tới đây — xml đã lưu, danh sách thông báo đã lấy, MỌI thông báo đã tải xong — hồ sơ mới
  // thật sự trọn vẹn. Thiếu dù một thông báo thì để cờ nguyên `false` cho lượt sau bù.
  // Bỏ dở vì lượt bị thay cũng KHÔNG được bật cờ: phần thông báo còn lại chưa tải.
  if (hong.length === 0 && !daBiThay()) {
    await danhDauDongBoXong(db, maHoSo);
  }

  return hong;
}

/** Bật cờ "đã đồng bộ trọn vẹn" — tách hàm vì lượt bù cuối lượt cũng cần bật, xem `buThongBaoHong`. */
function danhDauDongBoXong(db: () => PrismaClient, maHoSo: string): Promise<unknown> {
  return db().dvc_ho_so.update({ where: { ma_ho_so: maHoSo }, data: { da_dong_bo: true } });
}

export interface DongBoHoSoParams {
  /** Phiên cổng DVC ĐÃ ĐĂNG NHẬP (khóa + công ty sở hữu) — đồng bộ vẫn cần gọi cổng thật, khác
   * tìm kiếm (đọc DB). */
  phien: DvcService.DvcPhien;
  /** `yyyy-mm-dd`. */
  tuNgay: string;
  denNgay: string;
  /** Ô tiến độ để FE poll. BẮT BUỘC: hàm này chỉ chạy trong lượt nền, không còn chế độ chạy câm. */
  tienDo: DvcDongBoTienDo;
  /** Lượt đã bị một lượt MỚI thay thế -> dừng sớm, khỏi dội cổng thêm cho một lượt không ai đọc. */
  daBiThay: () => boolean;
  /**
   * Bọc MỘT thao tác cổng bằng cơ chế tự đăng nhập lại khi phiên RAM đã mất (controller cấp, vì chỉ
   * ở đó mới đọc được tài khoản đã lưu đúng chủ — xem `voiPhienTuPhucHoi`).
   *
   * Chỉ áp cho pha TRA CỨU, không bọc cả hàm: `requireSession` chạy ở đầu MỌI call cổng, nên phiên
   * có thể chết ở hồ sơ thứ 400/500 — bọc cả hàm là chạy lại từ đầu cả lượt (phân trang lại, đi lại
   * N dòng), và vì ô tiến độ dùng lại nên bộ đếm cộng dồn vượt quá `tongHoSo`, thanh tiến độ nhảy
   * quá 100%. Phiên chết giữa chừng nay chỉ thành `loi++` của hồ sơ đó, lượt sau tự bù.
   */
  voiPhucHoi: <T>(thaoTac: () => Promise<T>) => Promise<T>;
}

/**
 * Tiến độ MỘT lượt đồng bộ DVC chạy nền — FE poll `GET /dvc/dong-bo/tien-do` mỗi 2s.
 *
 * Mẫu số của thanh tiến độ là `tongHoSo`, biết được NGAY sau lượt tra cứu (trước khi đụng tới hồ sơ
 * nào), nên thanh xác định được gần như từ đầu. `tongHoSo === 0` nghĩa là còn đang tra cứu -> FE
 * hiện thanh chạy vô định.
 */
export interface DvcDongBoTienDo extends LuotChayNen {
  /** Tổng hồ sơ cổng trả trong khoảng ngày. 0 = chưa tra cứu xong. */
  tongHoSo: number;
  /** Ba bộ đếm dưới đây CỘNG LẠI là số hồ sơ đã xử lý xong — tử số của thanh tiến độ. Không giữ
   * thêm một trường tổng: nó suy ra được, mà mỗi nhánh `continue` quên cộng là thanh đứng im. */
  daCoSan: number;
  dongBoXong: number;
  loi: number;
  /** Mã hồ sơ đang xử lý, để toast nói rõ đang làm gì thay vì chỉ một con số. */
  maHoSoDangLam: string;
  /**
   * Số thông báo đang được BÙ ở cuối lượt; `0` = không ở pha bù.
   *
   * Cần vì lúc bù thì `daXong/tongHoSo` đã đầy và đứng im — không có trường này thì toast treo ở
   * "26/26" hàng chục giây mà người dùng không biết máy còn đang làm gì (xem `buThongBaoHong`).
   */
  dangBuLai: number;
  /**
   * Số hồ sơ cổng khai có mà lượt này KHÔNG lấy về được.
   *
   * Phải nằm ở đây chứ không chỉ trong `dvc_dong_bo_log`: toast là thứ DUY NHẤT người dùng thấy sau
   * khi đóng dialog, mà dòng lịch sử thì nằm trong chính cái dialog đó. Thiếu trường này thì lượt
   * lấy 500/1200 hồ sơ vẫn hiện toast xanh "Đồng bộ xong 500 hồ sơ".
   */
  thieuHoSo: number;
  /**
   * Mã lỗi máy đọc được khi lượt hỏng vì phiên cổng chết hẳn (`DVC_AUTO_LOGIN_FAILED`).
   *
   * PHẢI có: chạy nền rồi thì lỗi không còn về FE dưới dạng `ApiError` nữa, mà nằm trong `error` của
   * ô tiến độ này. Không mang mã theo thì `boKhoaNeuPhienChet` bên FE lặng lẽ hết nhận ra khóa chết
   * — đúng cái bẫy `MA_LOI_TU_DANG_NHAP_HONG` sinh ra để chặn.
   */
  code?: string;
}

/** Một lượt đồng bộ cho mỗi CÔNG TY (khóa = `donViId`) — hai công ty chạy song song được, còn cùng
 * một công ty thì bấm lại là thay lượt cũ (đổi khoảng ngày rồi bấm lại phải chạy theo cái mới). */
const LOI_DONG_BO_MAC_DINH = "Đồng bộ dữ liệu Dịch vụ công thất bại.";

const khoDongBoRun = taoKhoLuotChayNen<DvcDongBoTienDo>({
  loiMacDinh: LOI_DONG_BO_MAC_DINH,
  khiLoi: (err, st) => {
    console.error("[DVC-DONG-BO] Lượt đồng bộ lỗi tổng thể:", err);
    // Gắn mã máy đọc được NGAY cạnh câu lỗi nó đi kèm: chạy nền thì lỗi không về FE dưới dạng
    // `ApiError` nữa, mà nằm trong ô tiến độ — không mang mã theo là FE hết nhận ra khóa phiên đã
    // chết hẳn mà bỏ đi (xem `code` bên dưới).
    if (err instanceof DvcService.DvcAutoLoginFailedError) {
      st.code = DvcService.MA_LOI_TU_DANG_NHAP_HONG;
    }
    return DvcService.toUserMessage(err, LOI_DONG_BO_MAC_DINH);
  },
});

/** Tiến độ lượt đồng bộ của một công ty — `null` nếu công ty này chưa từng chạy lượt nào. */
export function docTienDoDongBo(tenantKey: string): DvcDongBoTienDo | null {
  return khoDongBoRun.doc(tenantKey);
}

/**
 * Bắt đầu lượt đồng bộ CHẠY NỀN, trả tiến độ ngay (~50ms) để FE poll.
 *
 * VÌ SAO CHẠY NỀN: từ khi mọi call cổng đi qua pacer (sàn 800ms/call, ~4 call/hồ sơ), một khoảng
 * vài chục hồ sơ mất hàng phút — giữ nguyên một HTTP request suốt ngần ấy là chạm ngưỡng timeout
 * mặc định của IIS/nginx. Chạy nền còn cho người dùng đóng dialog đi làm việc khác, mở lại nối tiếp.
 */
export function batDauDongBoRun(
  tenantKey: string,
  work: (tienDo: DvcDongBoTienDo, daBiThay: () => boolean) => Promise<void>,
): DvcDongBoTienDo {
  return khoDongBoRun.batDau(
    tenantKey,
    () => ({
      tongHoSo: 0,
      daCoSan: 0,
      dongBoXong: 0,
      loi: 0,
      maHoSoDangLam: "",
      dangBuLai: 0,
      thieuHoSo: 0,
    }),
    work,
  );
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
/**
 * Đồng bộ TRỌN VẸN một đoạn ngày của MỘT nguồn: tra cứu xong là làm chi tiết luôn.
 *
 * Tách hàm riêng thay vì lồng trong `dongBoHoSo` để mọi biến cục bộ (`headers`, `rows`, bộ đệm
 * `da_dong_bo`) trở lại phạm vi hàm — lồng vào là chúng sống qua cả hai đoạn dù chỉ dùng cho một.
 *
 * Trả `tongCongKhai` để nơi gọi cộng dồn mà đối chiếu; `dungGiuaChung` khi lượt bị lượt mới thay.
 */
async function dongBoMotDoan(
  db: () => PrismaClient,
  params: DongBoHoSoParams,
  d: DoanTraCuu,
): Promise<{ thieuHoSo: number; dungGiuaChung: boolean; hong: ThongBaoHong[] }> {
  const hong: ThongBaoHong[] = [];
  const tienDo = params.tienDo;

  const bangTho = await params.voiPhucHoi(() =>
    DvcService.traCuuHoSo(
      {
        ...params.phien,
        tuNgay: d.tuNgay,
        denNgay: d.denNgay,
        scope: "SELF",
        daBiThay: params.daBiThay,
      },
      d.nguon,
    ),
  );

  // Kiểm NGAY sau tra cứu, trước khi gộp bảng và đọc DB: `gopCacTrangHoSo` cũng tôn trọng
  // `daBiThay` nên nó có thể vừa trả về một bảng DỞ DANG — chạy tiếp là tốn một round trip DB với
  // danh sách trăm mã cho lượt không ai đọc.
  if (params.daBiThay()) return { thieuHoSo: 0, dungGiuaChung: true, hong };

  // Đã chuẩn hoá từ trong `traCuuHoSo` (phải làm trước vòng gộp để chống trùng hoạt động).
  const { headers, rows } = bangTho;
  tienDo.tongHoSo += rows.length;

  // Đọc trước `da_dong_bo` của MỌI hồ sơ trong đoạn bằng 1 query — tránh N+1 (1 query DB
  // tenant/hồ sơ); đây là DB tenant nên gộp thoải mái, không đụng ràng buộc "gọi cổng tuần tự".
  const maHoSoList = [...new Set(rows.map((row) => oTheoTieuDe(headers, row, "Mã hồ sơ")))].filter(
    Boolean,
  );
  const daDongBoTheoMa = new Map(
    (
      await db().dvc_ho_so.findMany({
        where: { ma_ho_so: { in: maHoSoList } },
        select: { ma_ho_so: true, da_dong_bo: true },
      })
    ).map((r) => [r.ma_ho_so, r.da_dong_bo]),
  );

  for (const row of rows) {
    // Lượt mới đã thay lượt này -> dừng NGAY, đừng tiêu thêm request cổng cho kết quả không ai đọc.
    if (params.daBiThay()) {
      return { thieuHoSo: 0, dungGiuaChung: true, hong };
    }

    const maHoSo = oTheoTieuDe(headers, row, "Mã hồ sơ");
    if (!maHoSo) {
      tienDo.loi++;
      continue;
    }
    tienDo.maHoSoDangLam = maHoSo;

    const raw = Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]));
    const trangThai = oTheoTieuDe(headers, row, "Trạng thái") || null;

    try {
      if (daDongBoTheoMa.get(maHoSo)) {
        await db().dvc_ho_so.update({
          where: { ma_ho_so: maHoSo },
          data: { trang_thai: trangThai, raw },
        });
        tienDo.daCoSan++;
        continue;
      }

      await db().dvc_ho_so.upsert({
        where: { ma_ho_so: maHoSo },
        create: {
          ma_ho_so: maHoSo,
          // Chỉ ghi ở `create`, KHÔNG ở `update`: nguồn của một hồ sơ không bao giờ đổi, cho phép
          // ghi đè là mở đường cho một lượt tra cứu lệch làm hỏng dòng vốn đã đúng.
          nguon: d.nguon,
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

      const hongCuaHoSo = await dongBoChiTietHoSo(
        db,
        params.phien,
        maHoSo,
        d.nguon,
        params.daBiThay,
      );
      if (hongCuaHoSo.length > 0) {
        // Hồ sơ dở dang: xml có nhưng thiếu thông báo -> `da_dong_bo` vẫn false. Gom lại để bù
        // NGAY CUỐI LƯỢT (xem `buThongBaoHong`), không bắt người dùng bấm Đồng bộ lần nữa.
        hong.push(...hongCuaHoSo);
        tienDo.loi++;
        console.warn(
          `[DVC-DONG-BO] Hồ sơ ${maHoSo} thiếu ${hongCuaHoSo.length} thông báo — sẽ thử bù ở cuối lượt.`,
        );
      } else {
        tienDo.dongBoXong++;
      }
    } catch (err) {
      tienDo.loi++;
      console.warn(
        `[DVC-DONG-BO] Đồng bộ hồ sơ ${maHoSo} lỗi: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  // Đối chiếu NGAY TRONG đoạn, không cộng dồn hai đoạn rồi trừ một lần: gộp lại thì đoạn thừa và
  // đoạn thiếu triệt tiêu nhau, và một đoạn không đọc được pager (`tongSoBanGhi` null -> 0) sẽ kéo
  // tử số xuống mà vẫn góp dòng vào mẫu số, che mất chỗ thiếu thật của đoạn kia.
  const thieuHoSo =
    typeof bangTho.tongSoBanGhi === "number"
      ? Math.max(0, bangTho.tongSoBanGhi - rows.length)
      : 0;
  if (thieuHoSo > 0) {
    console.warn(
      `[DVC-DONG-BO] Nguồn ${d.nguon} (${d.tuNgay}..${d.denNgay}): cổng khai ` +
        `${bangTho.tongSoBanGhi} hồ sơ nhưng chỉ lấy được ${rows.length} -> thiếu ${thieuHoSo}.`,
    );
  }
  return { thieuHoSo, dungGiuaChung: false, hong };
}

/**
 * Thử lại MỘT LƯỢT các thông báo tải hỏng, sau khi mọi đoạn đã chạy xong.
 *
 * Vì sao có cơ hội thành công: nguyên nhân hỏng phổ biến nhất là `429`, mà pacer nhân đôi khoảng
 * cách mỗi lần dính 429 (trần 15s) và chỉ co lại dần khi trót lọt. Tới cuối lượt làn `dvc` đã tự
 * giãn, nên lượt bù chạy ở nhịp chậm hơn hẳn lúc vừa hỏng.
 *
 * Vì sao ĐÚNG MỘT lượt: 429 kéo dài thì lặp mãi có thể ngốn hàng chục phút trong khi người dùng
 * đang ngồi chờ, còn hỏng vĩnh viễn thì lặp bao nhiêu cũng vô ích. Còn sót thì giữ nguyên hành vi
 * cũ — `da_dong_bo=false`, lịch sử ghi `partial`, lượt đồng bộ sau bù tiếp.
 *
 * Chỉ gọi lại `taiThongBao` cho đúng thứ hỏng, KHÔNG chạy lại cả hồ sơ: làm lại cả hồ sơ là tải
 * lại xml + trang chi tiết + mọi thông báo đã có, tốn gấp nhiều lần cho cùng một kết quả.
 *
 * Nguồn ETAX tự lo được: `baoDamPhienTdt` sẽ tra cứu lại nếu đoạn cuối đã chuyển phiên sang DVC.
 */
async function buThongBaoHong(
  db: () => PrismaClient,
  params: DongBoHoSoParams,
  hong: ThongBaoHong[],
): Promise<void> {
  const tienDo = params.tienDo;
  tienDo.dangBuLai = hong.length;

  /** Số thông báo còn hỏng của từng hồ sơ — về 0 thì hồ sơ đó mới thật sự trọn vẹn. */
  const conHong = new Map<string, number>();
  for (const h of hong) conHong.set(h.maHoSo, (conHong.get(h.maHoSo) ?? 0) + 1);

  for (const h of hong) {
    if (params.daBiThay()) break;
    tienDo.maHoSoDangLam = h.maHoSo;
    if (!(await taiVaLuuThongBao(db, params.phien, h.maHoSo, h.nguon, h.tb))) continue;

    const con = (conHong.get(h.maHoSo) ?? 1) - 1;
    conHong.set(h.maHoSo, con);
    if (con === 0) {
      await danhDauDongBoXong(db, h.maHoSo);
      // Hồ sơ này đã được tính vào `loi` ở vòng chính — chuyển sang `dongBoXong` để lịch sử và
      // toast nói đúng kết cục cuối cùng, không phải kết cục giữa chừng.
      tienDo.loi--;
      tienDo.dongBoXong++;
    }
  }

  tienDo.dangBuLai = 0;
  tienDo.maHoSoDangLam = "";
}

export async function dongBoHoSo(dbName: string, params: DongBoHoSoParams): Promise<void> {
  // Lấy client tenant MỚI ở MỖI lần chạm DB, không giữ một client suốt lượt.
  //
  // `tenantClient` chỉ refresh `lastUsed` bên trong `getTenantDb`; query qua một client đang cầm
  // KHÔNG chạm vào nó. Lượt này chạy nền hàng phút và thường là thứ duy nhất đụng tenant đó, nên
  // giữ client là đúng kiểu để sweeper (idle > 10') đóng pool giữa chừng rồi mọi query sau hỏng
  // hết — và hỏng vào đúng nhánh `catch` từng hồ sơ nên chỉ thành `loi++`, không ai biết vì sao.
  // Khuôn này chép từ `runDetailFetch`, xem docblock `resolveTenantDbName`.
  const db = () => getTenantDb(dbName);
  const tienDo = params.tienDo;
  let dungGiuaChung = false;
  /** Số hồ sơ thiếu, cộng dồn qua các đoạn — mỗi đoạn tự đối chiếu với con số cổng khai của nó. */
  let thieuHoSo = 0;
  /** Thông báo hỏng gom từ mọi đoạn, để bù một lượt ở cuối. */
  const hongCanBu: ThongBaoHong[] = [];

  // Cắt khoảng theo mốc 01/07/2025 rồi xử lý TỪNG đoạn TRỌN VẸN, KHÔNG gộp hết rồi mới chạy.
  //
  // Vì sao phải xen kẽ: cổng giữ state phía server cho nguồn ETAX — trang chi tiết và lượt tải chỉ
  // mở được sau khi ĐÃ tra cứu ETAX trong cùng phiên, và một lượt tra cứu Dịch vụ công xen vào
  // giữa sẽ XOÁ state đó. Đo thực tế: gộp rồi chạy -> cả 10 hồ sơ ETAX lỗi; xen kẽ -> 10/10 xong.
  //
  // Giá phải trả: `tongHoSo` lớn dần theo từng đoạn thay vì biết ngay từ đầu, nên mẫu số thanh
  // tiến độ nhích lên một lần khi sang đoạn thứ hai. Thà vậy còn hơn mất trọn một nguồn.
  for (const d of chiaDoanTheoNguon(params.tuNgay, params.denNgay)) {
    if (params.daBiThay()) {
      dungGiuaChung = true;
      break;
    }
    const ket = await dongBoMotDoan(db, params, d);
    thieuHoSo += ket.thieuHoSo;
    hongCanBu.push(...ket.hong);
    if (ket.dungGiuaChung) {
      dungGiuaChung = true;
      break;
    }
  }

  tienDo.maHoSoDangLam = "";

  // Bù cuối lượt, khi nhịp pacer đã giãn ra vì chính những lần 429 vừa rồi — xem `buThongBaoHong`.
  if (hongCanBu.length > 0 && !dungGiuaChung && !params.daBiThay()) {
    await buThongBaoHong(db, params, hongCanBu);
  }

  tienDo.thieuHoSo = thieuHoSo;

  await ghiLichSuDongBo(db(), {
    tuNgay: params.tuNgay,
    denNgay: params.denNgay,
    tongHoSo: tienDo.tongHoSo,
    daCoSan: tienDo.daCoSan,
    dongBoXong: tienDo.dongBoXong,
    loi: tienDo.loi,
    dungGiuaChung,
    thieuHoSo,
  });
}

interface GhiLichSuParams {
  tuNgay: string;
  denNgay: string;
  tongHoSo: number;
  daCoSan: number;
  dongBoXong: number;
  loi: number;
  /** Lượt bị một lượt mới thay thế giữa chừng — vẫn ghi lịch sử (việc đã làm là có thật), nhưng
   * phải nói rõ, không thì dòng log trông như một lượt chạy đủ mà số liệu lại thiếu. */
  dungGiuaChung: boolean;
  /** Số hồ sơ cổng khai có mà ta không lấy về được — xem chỗ tính ở `dongBoHoSo`. */
  thieuHoSo: number;
}

/** Ghi 1 dòng `dvc_dong_bo_log` — CẢ lượt đồng bộ THÀNH lẫn CÓ LỖI đều ghi (trang_thai phân biệt),
 * để lịch sử thấy đủ, không chỉ mỗi lượt trót lọt. */
function ghiLichSuDongBo(tenantDb: PrismaClient, p: GhiLichSuParams): Promise<unknown> {
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
      trang_thai: p.loi > 0 || p.dungGiuaChung || p.thieuHoSo > 0 ? "partial" : "done",
      dien_giai:
        `Đồng bộ ${NHAN_LOAI}` +
        (p.loi > 0 ? ` — ${p.loi} hồ sơ lỗi, sẽ bù ở lượt sau` : "") +
        (p.thieuHoSo ? ` — CHƯA lấy hết: cổng khai còn ${p.thieuHoSo} hồ sơ nữa` : "") +
        (p.dungGiuaChung ? " — dừng giữa chừng vì có lượt đồng bộ mới" : ""),
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
 * Nguồn của một hồ sơ đã lưu — quyết định gọi endpoint nào khi tải file (xem `DUONG_DAN`).
 *
 * Hồ sơ chưa có trong DB -> `"dvc"`: ta chỉ biết tới hồ sơ TDT qua chính lượt đồng bộ, mà lượt đó
 * luôn ghi `nguon` xuống. Không có dòng nghĩa là chưa từng thấy, và đoán `"dvc"` chỉ làm lượt gọi
 * cổng hỏng bằng lỗi rõ ràng chứ không lưu sai gì.
 */
export async function layNguonHoSoDaLuu(
  tenantDb: PrismaClient,
  maHoSo: string,
): Promise<DvcService.NguonHoSo> {
  const hoSo = await tenantDb.dvc_ho_so.findUnique({
    where: { ma_ho_so: maHoSo },
    select: { nguon: true },
  });
  return hoSo?.nguon === "tdt" ? "tdt" : "dvc";
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
