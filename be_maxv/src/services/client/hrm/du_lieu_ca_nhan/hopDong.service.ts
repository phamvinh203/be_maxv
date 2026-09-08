import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import { ngayVn, vnDayString } from '../../../../utils/ngayVn';
import { ghiCoRangBuoc } from '../../../../utils/du_lieu_ca_nhan/rangBuocDb';
import type {
  DoiHopDongBodyInput,
  HopDongBodyInput,
  HopDongListQuery,
  HopDongUpdateInput,
} from '../../../../validators/hrm/du_lieu_ca_nhan/hopDong.validator';

const hopDongSelect = {
  id: true,
  ma_nv: true,
  so_hd: true,
  loai_hd: true,
  kieu_luong: true,
  luong_chinh: true,
  luong_bhxh: true,
  ngay_bat_dau: true,
  ngay_ket_thuc: true,
  trich_bhxh: true,
  tinh_tncn: true,
  ghi_chu: true,
} satisfies Prisma.hrm_hop_dongSelect;

/** Prisma trong transaction — mọi hàm dưới đây nhận được cả client thường lẫn tx. */
type Db = PrismaClient | Prisma.TransactionClient;

/** Nhân viên phải có thật và chưa bị xóa mềm. */
async function assertNhanVienTonTai(db: Db, maNv: string): Promise<void> {
  await findOrThrow(
    () =>
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
        select: { ma_nv: true },
      }),
    new NotFoundError(MESSAGES.HRM.NHAN_VIEN_NOT_FOUND),
  );
}

/**
 * Gom nhãn `loai_hd` (chữ tự do) về NHÓM NGHIỆP VỤ — 3 nhóm, theo QĐ #18 (BR-hrm-022).
 *
 * ĐÂY LÀ NGUỒN DUY NHẤT của phép gom nhóm, dùng cho CẢ HAI việc:
 *   1. hiển thị `loai_hop_dong` trên màn nhân viên (5 nhãn -> 3 nhóm);
 *   2. khóa của luật chống chồng lấn (`assertKhongChongLan`).
 * Hai bản gom khác nhau là hai luật khác nhau — đó chính là BUG-HRM-27.
 *
 * Hạ chữ thường + cắt khoảng trắng TRƯỚC khi so: `loai_hd` là chữ tự do, không được in hoa hay
 * hạ thường lúc lưu (khác `ma_nv`/`ma_pb`), nên `"Khoan"` phải xếp cùng nhóm với `"khoan"`.
 * Không chuẩn hóa thì nhãn viết hoa rơi nhầm sang nhóm hợp đồng lao động và lọt lưới chồng lấn.
 *
 * Phải KHỚP TỪNG CHỮ với hàm `hrm_nhom_hd(text)` ở tầng cơ sở dữ liệu
 * (`services/shared/hrmTenantConstraints.ts`) — hai bên lệch nhau là hai tầng nói khác nhau.
 */
export function loaiHdVeNhanVien(loaiHd: string): string {
  const chuan = (loaiHd ?? '').trim().toLowerCase();
  if (chuan === 'thu_viec') return 'thu_viec';
  if (chuan === 'khoan') return 'hdvc';
  return 'hdld'; // khong_xac_dinh | xac_dinh | thoi_vu và mọi giá trị lạ khác
}

/** `Date` (cột `@db.Date`) -> `dd/MM/yyyy` để ghép vào thông điệp lỗi cho người nhập liệu. */
function ngayHienThi(d: Date | null): string {
  if (!d) return 'không thời hạn';
  const iso = vnDayString(d);
  return iso ? ngayVn(iso) : 'không rõ';
}

/**
 * Hai khoảng hiệu lực hợp đồng có giao nhau không. `null` ở ngày kết thúc = vô thời hạn.
 *
 * Khoảng ĐÓNG CẢ HAI ĐẦU (`[]`): hợp đồng A kết thúc 31/03 và hợp đồng B bắt đầu 31/03 BỊ COI
 * là chồng lấn — một ngày không thuộc về hai hợp đồng cùng nhóm. Vế này bắt buộc từ khi hợp
 * đồng đúng một ngày được cho phép (QĐ #6, BR-hrm-026): dùng khoảng nửa mở thì hợp đồng một
 * ngày có độ dài bằng không và lọt qua mọi phép kiểm giao cắt.
 */
export function khoangGiaoNhau(
  aBatDau: Date,
  aKetThuc: Date | null,
  bBatDau: Date,
  bKetThuc: Date | null,
): boolean {
  const aDen = aKetThuc ? aKetThuc.getTime() : Number.POSITIVE_INFINITY;
  const bDen = bKetThuc ? bKetThuc.getTime() : Number.POSITIVE_INFINITY;
  return aBatDau.getTime() <= bDen && bBatDau.getTime() <= aDen;
}

/** Phần dữ liệu tối thiểu để quyết định hai hợp đồng có chồng lấn hay không. */
export interface KhoangHopDong {
  loai_hd: string;
  ngay_bat_dau: Date;
  ngay_ket_thuc: Date | null;
}

/**
 * LUẬT CHỐNG CHỒNG LẤN — hàm quyết định THUẦN, không đụng cơ sở dữ liệu (BR-hrm-022).
 *
 * Tách riêng khỏi `assertKhongChongLan` để luật này kiểm thử được mà không cần Postgres, và để
 * chỉ có ĐÚNG MỘT chỗ phát biểu luật: cùng nhóm nghiệp vụ VÀ khoảng ngày giao nhau.
 * Hợp đồng khác nhóm chồng thời gian là HỢP LỆ (một hợp đồng lao động chính cộng một hợp đồng
 * khoán, QĐ #1).
 */
export function hopDongChongLan(a: KhoangHopDong, b: KhoangHopDong): boolean {
  return (
    loaiHdVeNhanVien(a.loai_hd) === loaiHdVeNhanVien(b.loai_hd) &&
    khoangGiaoNhau(
      a.ngay_bat_dau,
      a.ngay_ket_thuc,
      b.ngay_bat_dau,
      b.ngay_ket_thuc,
    )
  );
}

/**
 * Mốc "hôm nay" theo giờ VIỆT NAM, dạng nửa đêm UTC để so được với cột `@db.Date`.
 *
 * KHÔNG dùng `new Date()` + `setUTCHours(0)`: cái đó cho ra ngày theo lịch UTC, mà từ 00:00 đến
 * 06:59 giờ Việt Nam thì lịch UTC vẫn đang ở NGÀY HÔM TRƯỚC. Trong 7 tiếng đó máy chủ sẽ coi
 * hợp đồng bắt đầu hôm nay là "chưa tới hạn", còn trình duyệt (tính theo giờ máy người dùng)
 * lại coi là đã hiệu lực — hai màn hình nói khác nhau, mà mấy ngày này dùng để chốt kỳ lương.
 */
export function homNayVN(): Date {
  const gioVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(gioVN.getUTCFullYear(), gioVN.getUTCMonth(), gioVN.getUTCDate()),
  );
}

export interface HopDongHienHanh {
  so_hd: string;
  loai_hd: string;
  kieu_luong: string;
  ngay_bat_dau: Date;
  ngay_ket_thuc: Date | null;
  trich_bhxh: boolean;
  tinh_tncn: boolean;
}

/**
 * Chọn hợp đồng hiện hành trong danh sách hợp đồng của MỘT nhân viên.
 *
 * Luật (chuyển nguyên từ FE `cay.ts#hopDongHienHanh`, giờ là nguồn DUY NHẤT):
 *   - đang hiệu lực = đã bắt đầu và chưa hết hạn (không có ngày kết thúc = còn hiệu lực);
 *   - nhiều cái cùng khớp thì lấy cái bắt đầu MUỘN NHẤT;
 *   - không cái nào đang hiệu lực thì lấy hợp đồng mới nhất trong lịch sử — nhân viên vừa hết
 *     hạn hợp đồng cũ mà chưa ký cái mới vẫn phải thấy thông tin gần nhất.
 *
 * TÍNH LÚC ĐỌC, không lưu bản sao xuống `hrm_nhan_vien`. Trước đây có bản sao và nó SAI theo
 * thời gian: kết quả phụ thuộc "hôm nay", mà bản sao chỉ được tính lại khi có người ghi hợp
 * đồng — nên hợp đồng ký trước cho tương lai tới ngày hiệu lực vẫn không ai cập nhật.
 *
 * `ds` phải đã sắp xếp giảm dần theo `ngay_bat_dau` (xem `sapXepHopDong`).
 */
export function chonHopDongHienHanh<T extends HopDongHienHanh>(
  ds: T[],
): T | null {
  if (ds.length === 0) return null;
  const homNay = homNayVN();
  const dangHieuLuc = ds.find(
    (hd) =>
      hd.ngay_bat_dau <= homNay &&
      (!hd.ngay_ket_thuc || hd.ngay_ket_thuc >= homNay),
  );
  return dangHieuLuc ?? ds[0];
}

/**
 * Thứ tự sắp xếp CHUẨN của lịch sử hợp đồng: mới nhất lên đầu.
 *
 * Có `datetime0` và `id` làm tiêu chí phụ vì `ngay_bat_dau` KHÔNG duy nhất — hai hợp đồng cùng
 * ngày bắt đầu là chuyện tạo được. Chỉ sắp theo mỗi `ngay_bat_dau` thì Postgres trả thứ tự tùy
 * ý, và MVCC còn đẩy dòng vừa sửa xuống cuối heap: sửa mỗi ô ghi chú của hợp đồng B cũng đủ làm
 * "hợp đồng hiện hành" nhảy từ A sang B.
 */
const sapXepHopDong = [
  { ngay_bat_dau: 'desc' },
  { datetime0: 'desc' },
  { id: 'desc' },
] satisfies Prisma.hrm_hop_dongOrderByWithRelationInput[];

/**
 * Hợp đồng hiện hành của NHIỀU nhân viên, trả về Map theo `ma_nv`.
 * Một truy vấn cho cả danh sách — màn nhân viên gọi cái này thay cho các cột đệm đã bỏ.
 */
export async function hopDongHienHanhTheoNv(
  db: Db,
  maNvs: string[],
): Promise<Map<string, HopDongHienHanh>> {
  if (maNvs.length === 0) return new Map();

  const ds = await db.hrm_hop_dong.findMany({
    where: { ma_nv: { in: maNvs } },
    select: hopDongSelect,
    orderBy: sapXepHopDong,
  });

  const theoNv = new Map<string, HopDongHienHanh[]>();
  for (const hd of ds) {
    const cu = theoNv.get(hd.ma_nv);
    if (cu) cu.push(hd);
    else theoNv.set(hd.ma_nv, [hd]);
  }

  const ketQua = new Map<string, HopDongHienHanh>();
  for (const [maNv, list] of theoNv) {
    const hienHanh = chonHopDongHienHanh(list);
    if (hienHanh) ketQua.set(maNv, hienHanh);
  }
  return ketQua;
}

/**
 * Ký hợp đồng khoán/HĐDV thì tắt cờ công đoàn của nhân viên.
 *
 * ĐÂY KHÔNG PHẢI bản sao dữ liệu: `cong_doan` là lựa chọn của người lao động, lưu trên hồ sơ
 * nhân viên và do kế toán tự tích. Chỗ này chỉ áp một luật MỘT CHIỀU lúc ký hợp đồng khoán —
 * rời khỏi khoán thì KHÔNG tự bật lại, vì bật lại là mình bịa một quyết định thay họ.
 *
 * Bám theo loại hợp đồng VỪA GHI, không theo "hợp đồng hiện hành": hiện hành phụ thuộc ngày
 * tháng nên sẽ đổi theo thời gian, mà một lần tắt cờ thì phải dứt khoát tại thời điểm ký.
 */
async function apDungLuatCongDoan(db: Db, maNv: string, loaiHd: string) {
  if (loaiHdVeNhanVien(loaiHd) !== 'hdvc') return;
  await db.hrm_nhan_vien.update({
    where: { ma_nv: maNv },
    data: { cong_doan: false, datetime2: new Date() },
  });
}

/**
 * Chống chồng lấn khoảng ngày — LỚP 1 (pre-check ở service), BR-hrm-022.
 *
 * Khóa theo cặp (`ma_nv`, **NHÓM NGHIỆP VỤ**), KHÔNG theo nhãn `loai_hd` thô: ba nhãn
 * `khong_xac_dinh` / `xac_dinh` / `thoi_vu` cùng thuộc nhóm hợp đồng lao động, khóa theo nhãn
 * thì một người có ba hợp đồng lao động chồng nhau, mỗi cái một nhãn, và phân hệ Lương cộng ba
 * mức lương mà không có gì báo (BUG-HRM-27). Hợp đồng KHÁC nhóm được phép chạy song song —
 * một hợp đồng lao động chính cộng một hợp đồng khoán là chuyện có thật (QĐ #1).
 *
 * Gọi ở CẢ BA đường ghi (`create` / `update` / `doi`) và nằm TRONG cùng transaction với bước
 * ghi. Lớp 2 (`EXCLUDE USING gist`) mới là chốt cuối khi hai yêu cầu vào cùng lúc — xem
 * `rangBuocDb.ts`.
 *
 * Lọc theo ngày ở tầng cơ sở dữ liệu, lọc theo nhóm ở tầng ứng dụng: nhóm là kết quả của một
 * HÀM trên `loai_hd` nên Prisma không diễn tả được trong `where`. Số hợp đồng của một nhân
 * viên luôn nhỏ (vài dòng) nên đây không phải điểm nóng hiệu năng.
 */
async function assertKhongChongLan(
  db: Db,
  maNv: string,
  loaiHd: string,
  batDau: Date,
  ketThuc: Date | null,
  boQuaId?: string,
): Promise<void> {
  const moi: KhoangHopDong = {
    loai_hd: loaiHd,
    ngay_bat_dau: batDau,
    ngay_ket_thuc: ketThuc,
  };

  const ungVien = await db.hrm_hop_dong.findMany({
    where: {
      ma_nv: maNv,
      ...(boQuaId ? { id: { not: boQuaId } } : {}),
      // Hợp đồng kia chưa kết thúc TRƯỚC ngày hợp đồng này bắt đầu (`gte` = đóng đầu mút).
      OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: batDau } }],
      // Hợp đồng kia bắt đầu trước/đúng ngày hợp đồng này kết thúc.
      // `ketThuc = null` (vô thời hạn) -> bỏ vế này, mọi hợp đồng sau đó đều giao.
      ...(ketThuc ? { ngay_bat_dau: { lte: ketThuc } } : {}),
    },
    select: {
      so_hd: true,
      loai_hd: true,
      ngay_bat_dau: true,
      ngay_ket_thuc: true,
    },
    orderBy: { ngay_bat_dau: 'asc' },
  });

  // Luật thật nằm ở `hopDongChongLan` (thuần, kiểm thử được không cần DB); truy vấn trên chỉ
  // là bộ lọc thô để không phải kéo cả lịch sử về.
  const trung = ungVien.find((hd) => hopDongChongLan(moi, hd));
  if (!trung) return;

  throw new ConflictError(
    `Nhân viên đã có hợp đồng ${trung.so_hd} loại ${trung.loai_hd} hiệu lực từ ` +
      `${ngayHienThi(trung.ngay_bat_dau)} đến ${ngayHienThi(trung.ngay_ket_thuc)}, ` +
      `trùng khoảng thời gian bạn vừa nhập. Hai hợp đồng cùng loại không được chồng lấn.`,
  );
}

/**
 * `so_hd` duy nhất trong PHẠM VI MỘT CÔNG TY — BR-hrm-056 (QĐ #4), E-hrm-055.
 *
 * So khớp đúng chuỗi sau khi cắt khoảng trắng hai đầu (validator đã `.trim()`), CÓ phân biệt
 * hoa thường — cùng cách so sánh với khóa duy nhất ở cơ sở dữ liệu, để hai tầng không nói khác
 * nhau. KHÔNG lọc `nhan_vien.da_xoa`: khóa duy nhất ở DB phủ mọi dòng, lọc ở đây thì guard cho
 * qua rồi vỡ ở tầng dưới với câu chung chung.
 *
 * Khi SỬA thì bỏ qua chính dòng đang sửa (`boQuaId`), không thì mọi lần sửa đều 409.
 */
async function assertSoHdDuyNhat(
  db: Db,
  soHd: string,
  boQuaId?: string,
): Promise<void> {
  const trung = await db.hrm_hop_dong.findFirst({
    where: {
      so_hd: soHd,
      ...(boQuaId ? { id: { not: boQuaId } } : {}),
    },
    select: { ma_nv: true, nhan_vien: { select: { ho_ten: true } } },
  });
  if (!trung) return;

  throw new ConflictError(
    `Số hợp đồng "${soHd}" đã được dùng cho nhân viên ${trung.ma_nv} — ${trung.nhan_vien.ho_ten}. ` +
      `Số hợp đồng phải là duy nhất trong công ty.`,
  );
}

/** GET lịch sử hợp đồng, mới nhất lên đầu. */
export async function listHopDong(db: PrismaClient, q: HopDongListQuery) {
  // Ẩn hợp đồng của nhân viên đã xóa mềm (cascade chỉ chạy khi xóa cứng).
  //
  // `ma_nv` là BẮT BUỘC từ QĐ #8 (FR-hrm-013) và validator đã chặn chuỗi rỗng. Vẫn đẩy điều
  // kiện vào đây không điều kiện: bỏ vế này là quay lại đường trả TOÀN BỘ hợp đồng của công ty
  // trong một lượt gọi (BUG-HRM-25) — lương cả công ty về trình duyệt của mọi người.
  const and: Prisma.hrm_hop_dongWhereInput[] = [
    { nhan_vien: { da_xoa: false } },
    { ma_nv: q.ma_nv },
  ];

  return db.hrm_hop_dong.findMany({
    where: { AND: and },
    select: hopDongSelect,
    orderBy: [{ ma_nv: 'asc' }, ...sapXepHopDong],
  });
}

/** POST tạo mới 1 hợp đồng. */
export async function createHopDong(db: PrismaClient, body: HopDongBodyInput) {
  const id = randomUUID();
  await ghiCoRangBuoc(() =>
    db.$transaction(async (tx) => {
      await assertNhanVienTonTai(tx, body.ma_nv);
      await assertSoHdDuyNhat(tx, body.so_hd);
      await assertKhongChongLan(
        tx,
        body.ma_nv,
        body.loai_hd,
        body.ngay_bat_dau,
        body.ngay_ket_thuc,
      );
      await tx.hrm_hop_dong.create({ data: { ...body, id } });
      await apDungLuatCongDoan(tx, body.ma_nv, body.loai_hd);
    }),
  );
  return { id };
}

/** PUT cập nhật (không đổi `ma_nv`). */
export async function updateHopDong(
  db: PrismaClient,
  id: string,
  body: HopDongUpdateInput,
) {
  await ghiCoRangBuoc(() =>
    db.$transaction(async (tx) => {
      const hienTai = await findOrThrow(
        () =>
          tx.hrm_hop_dong.findFirst({
            where: { id, nhan_vien: { da_xoa: false } },
            select: { id: true, ma_nv: true },
          }),
        new NotFoundError(MESSAGES.HRM.HOP_DONG_NOT_FOUND),
      );

      await assertSoHdDuyNhat(tx, body.so_hd, id);
      await assertKhongChongLan(
        tx,
        hienTai.ma_nv,
        body.loai_hd,
        body.ngay_bat_dau,
        body.ngay_ket_thuc,
        id,
      );

      await tx.hrm_hop_dong.update({
        where: { id },
        data: { ...body, datetime2: new Date() },
      });
      await apDungLuatCongDoan(tx, hienTai.ma_nv, body.loai_hd);
    }),
  );
  return { id };
}

/**
 * POST đổi hợp đồng: chốt hợp đồng đang hiệu lực vào `ngay_chot` rồi ký hợp đồng mới.
 * Hai việc trong một transaction — chốt xong mà tạo mới hỏng thì nhân viên mất hợp đồng.
 */
export async function doiHopDong(db: PrismaClient, body: DoiHopDongBodyInput) {
  const {
    ngay_chot: ngayChot,
    loai_hd_can_chot: loaiHdCanChot,
    ...hopDongMoi
  } = body;
  const id = randomUUID();
  let daChot = false;

  await ghiCoRangBuoc(() =>
    db.$transaction(async (tx) => {
      await assertNhanVienTonTai(tx, body.ma_nv);
      await assertSoHdDuyNhat(tx, body.so_hd);

      /**
       * Hợp đồng cần chốt = cái đang hiệu lực HÔM NAY, **thuộc đúng nhóm người dùng chỉ định**.
       *
       * `homNayVN()` chứ KHÔNG `new Date()` + `setUTCHours(0)` (BUG-HRM-07): từ 00:00 đến 06:59
       * giờ Việt Nam, lịch UTC còn ở ngày hôm trước, nên hợp đồng bắt đầu đúng hôm nay được
       * `GET /nhan-vien` coi là hiện hành mà đường này KHÔNG tìm thấy để chốt — sinh ra hai hợp
       * đồng chồng lấn do chính hệ thống tạo ra. Phần đọc (`chonHopDongHienHanh`) vốn đã dùng
       * `homNayVN()`; hai hàm phải cùng một mốc, nếu không chúng bất đồng bảy tiếng mỗi ngày.
       *
       * Lọc theo NHÓM là bắt buộc từ QĐ #1 (BR-hrm-053): từ khi hai hợp đồng khác nhóm được
       * chạy song song, tìm "hợp đồng đang hiệu lực" mà không nói nhóm nào là mơ hồ — đổi hợp
       * đồng lao động chính lại vô tình chốt mất hợp đồng khoán đang chạy, không có gì báo.
       */
      const homNay = homNayVN();
      const nhomCanChot = loaiHdVeNhanVien(loaiHdCanChot);
      const dangHieuLuc = await tx.hrm_hop_dong.findMany({
        where: {
          ma_nv: body.ma_nv,
          ngay_bat_dau: { lte: homNay },
          OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: homNay } }],
        },
        orderBy: { ngay_bat_dau: 'desc' },
        select: { id: true, loai_hd: true, ngay_bat_dau: true },
      });
      const cu = dangHieuLuc.find(
        (hd) => loaiHdVeNhanVien(hd.loai_hd) === nhomCanChot,
      );

      if (cu) {
        if (!ngayChot) {
          throw new ConflictError(
            'Nhân viên đang có hợp đồng hiệu lực — phải chọn ngày chốt hợp đồng cũ.',
          );
        }
        // `<=` chứ không `<`: giữ nguyên hành vi cũ ở đợt này. Lý do gốc (chốt đúng ngày bắt
        // đầu sinh ra hợp đồng một ngày, mà hợp đồng một ngày từng bị chặn) KHÔNG còn đúng từ
        // QĐ #6, nhưng đổi vế này nằm ngoài phạm vi đã chốt — xem OQ-hrm-15.
        if (ngayChot <= cu.ngay_bat_dau) {
          throw new ConflictError(
            'Ngày chốt phải sau ngày bắt đầu của hợp đồng đang hiệu lực.',
          );
        }
        await tx.hrm_hop_dong.update({
          where: { id: cu.id },
          data: { ngay_ket_thuc: ngayChot, datetime2: new Date() },
        });
        daChot = true;
      }

      // SAU bước chốt: hợp đồng vừa được chốt đã mang `ngay_ket_thuc` mới nên không tự báo
      // chồng lấn với hợp đồng đang ký. Chạy trong cùng transaction nên thấy được bản cập nhật.
      await assertKhongChongLan(
        tx,
        body.ma_nv,
        body.loai_hd,
        body.ngay_bat_dau,
        body.ngay_ket_thuc,
      );

      await tx.hrm_hop_dong.create({ data: { ...hopDongMoi, id } });
      await apDungLuatCongDoan(tx, body.ma_nv, body.loai_hd);
    }),
  );

  // Báo theo việc ĐÃ LÀM, không theo thứ client gửi lên: nhân viên chưa có hợp đồng nào thì
  // `cu` là null và không có gì bị chốt, dù client vẫn truyền `ngay_chot`.
  return { id, da_chot_hop_dong_cu: daChot };
}

/** DELETE — xóa cứng (khóa chính là uuid, không có chuyện cấp lại mã). */
export async function deleteHopDong(db: PrismaClient, id: string) {
  await db.$transaction(async (tx) => {
    await findOrThrow(
      () =>
        tx.hrm_hop_dong.findFirst({
          where: { id, nhan_vien: { da_xoa: false } },
          select: { id: true },
        }),
      new NotFoundError(MESSAGES.HRM.HOP_DONG_NOT_FOUND),
    );

    // Xóa xong KHÔNG phải cập nhật gì bên nhân viên: thông tin hợp đồng hiện hành được tính lúc
    // đọc, xóa dòng cuối cùng thì màn nhân viên tự hiện trống thay vì giữ lại số hợp đồng của
    // một dòng không còn tồn tại.
    await tx.hrm_hop_dong.delete({ where: { id } });
  });
  return { id };
}
