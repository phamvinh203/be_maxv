import { randomUUID } from 'node:crypto';
import { sysPrisma } from '../../../../config/db.sys';
import type { PrismaClient } from '../../../../generated/tenant';
import {
  ConflictError,
  DriveApiError,
  NotFoundError,
} from '../../../../helpers/errors';
import { findOrThrow } from '../../../../helpers/crudGuards';
import { getTenantDb } from '../../../../helpers/tenantClient';
import { MESSAGES } from '../../../../constants/messages';
import {
  decryptGdtPassword,
  encryptGdtPassword,
  isEncryptionConfigured,
} from '../../hddt/gdtCredential';
import {
  DriveChuaCauHinhError,
  driveDaCauHinh,
  doiMaLayToken,
  layAccessToken,
  layNoiDungFile,
  taiFileLen,
  taoThuMucNeuChua,
  xoaFile,
} from '../../../../utils/du_lieu_ca_nhan/driveClient';

/**
 * Ghép Google Drive vào hồ sơ tài liệu nhân sự.
 *
 * PHÂN VAI: `driveClient.ts` chỉ biết HTTP; file này biết DB (token theo công ty ở `don_vi` của
 * DB sys, con trỏ file ở `hrm_tai_lieu` của DB tenant) và biết cây thư mục.
 *
 * Cây thư mục trên Drive CỦA KHÁCH:
 *     maxv / <MST> - <tên công ty> / <mã NV> - <họ tên> / <các file scan>
 * ID thư mục lưu lại trong DB, KHÔNG bao giờ tra theo tên: Drive cho phép trùng tên, và khách
 * đổi tên / kéo thả thư mục lúc nào cũng được — bám theo tên là đứt liên kết lúc nào không hay.
 */

/** Tên thư mục gốc trên Drive của khách. */
const THU_MUC_GOC = 'maxv';

/** Trần dung lượng mỗi file. Ảnh scan giấy tờ vài trăm KB; đặt trần để không ai đẩy video lên. */
export const GIOI_HAN_FILE_BYTE = 10 * 1024 * 1024;

/** Chỉ nhận ảnh và PDF — đây là hồ sơ giấy tờ, không phải kho file chung. */
export const MIME_CHO_PHEP = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];

/**
 * Trần số file trên MỘT dòng giấy tờ (BR-hrm-037, QĐ #21).
 *
 * 20 là đủ cho mọi giấy tờ nhân sự có thật (căn cước 2 mặt, bằng cấp / hợp đồng giấy nhiều
 * trang) và đủ chặt để một lần thao tác nhầm không đẩy hàng trăm file lên Drive CỦA KHÁCH.
 */
export const SO_FILE_TOI_DA = 20;

interface TokenDonVi {
  refreshToken: string;
  maSoThue: string;
  tenDonVi: string;
  rootFolderId: string | null;
}

export interface TrangThaiDrive {
  /** Máy chủ đã có GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI chưa. */
  may_chu_san_sang: boolean;
  /** Công ty này đã nối Drive chưa. */
  da_ket_noi: boolean;
  /** Tài khoản Google đang dùng — để người dùng biết file của mình nằm ở Drive của ai. */
  email: string | null;
}

export async function trangThaiDrive(donViId: string): Promise<TrangThaiDrive> {
  const dv = await sysPrisma.donVi.findUnique({
    where: { id: donViId },
    select: { driveEmail: true, driveRefreshTokenCipher: true },
  });
  return {
    may_chu_san_sang: driveDaCauHinh() && isEncryptionConfigured(),
    da_ket_noi: Boolean(dv?.driveRefreshTokenCipher),
    email: dv?.driveEmail ?? null,
  };
}

/** Đổi `code` từ callback lấy refresh token rồi lưu (đã mã hóa) vào công ty. */
export async function luuKetNoiDrive(
  donViId: string,
  code: string,
): Promise<{ email: string | null }> {
  if (!isEncryptionConfigured()) {
    // Không có khóa thì token chỉ có thể lưu dạng thô — thà từ chối còn hơn để refresh token
    // (thứ mở được toàn bộ file đã tạo) nằm trần trong DB.
    throw new ConflictError(
      'Máy chủ chưa cấu hình khóa mã hóa (GDT_CRED_ENC_KEY) nên không lưu được kết nối Drive.',
    );
  }

  // Đọc kết nối CŨ trước khi ghi đè — cần biết có phải đổi sang tài khoản Google khác không.
  const truoc = await sysPrisma.donVi.findUnique({
    where: { id: donViId },
    select: { driveEmail: true, driveRefreshTokenCipher: true },
  });

  const ketQua = await doiMaLayToken(code);
  const blob = encryptGdtPassword(ketQua.refreshToken);
  if (!blob) {
    throw new ConflictError(
      'Không mã hóa được token Google, chưa lưu kết nối.',
    );
  }

  await sysPrisma.donVi.update({
    where: { id: donViId },
    data: {
      driveEmail: ketQua.email,
      driveRefreshTokenCipher: blob.cipher,
      driveRefreshTokenIv: blob.iv,
      driveRefreshTokenTag: blob.tag,
      // Đổi tài khoản Google là cây thư mục cũ không còn thuộc quyền app trên tài khoản mới —
      // xóa ID gốc để lần tải file sau dựng lại cây trong Drive mới.
      driveRootFolderId: null,
    },
  });

  // Chỉ dọn thư mục đã nhớ khi KHÔNG chắc vẫn là tài khoản cũ. Nối lại đúng tài khoản cũ thì
  // mọi ID vẫn dùng được, dọn chỉ tốn thêm lượt gọi Drive. Thiếu email (Google không trả, hoặc
  // lần kết nối trước không lưu được) thì coi như đã đổi — thà dọn thừa còn hơn để nhân viên
  // trỏ vào thư mục của tài khoản khác rồi hỏng vĩnh viễn.
  const doiTaiKhoan =
    Boolean(truoc?.driveRefreshTokenCipher) &&
    (!truoc?.driveEmail || !ketQua.email || truoc.driveEmail !== ketQua.email);
  if (doiTaiKhoan) await quenThuMucNhanVien(donViId);

  return { email: ketQua.email };
}

/**
 * Quên mọi ID thư mục nhân viên đã nhớ trong DB tenant.
 *
 * `driveRootFolderId` nằm ở DB sys nên chỗ nào cũng xóa được, nhưng ID thư mục TỪNG nhân viên
 * lại nằm ở DB tenant — không dọn thì sau khi đổi tài khoản Google, `thuMucNhanVien` vẫn trả ID
 * thuộc tài khoản CŨ. Với quyền `drive.file` thì tài khoản mới không nhìn thấy thư mục đó, Drive
 * trả 404, và mọi lần tải file cho nhân viên ấy hỏng VĨNH VIỄN — bấm ngắt rồi nối lại cũng
 * không cứu, vì vẫn đi đúng đường đó.
 *
 * Xóa an toàn, không mất gì: `taoThuMucNeuChua` tìm theo tên trước khi tạo, nên nối lại đúng
 * tài khoản cũ thì nó tìm thấy thư mục sẵn có và nhớ lại ID, không sinh thư mục trùng.
 *
 * CỐ Ý không đụng `hrm_tai_lieu_file`: file không tìm lại được theo tên như thư mục, xóa con
 * trỏ là xóa luôn dấu vết khách từng đính kèm giấy tờ gì. File cũ vẫn nằm nguyên ở tài khoản
 * Google trước đó — việc của mình là báo đúng chuyện đó (xem DRIVE_FILE_KHONG_MO_DUOC).
 */
async function quenThuMucNhanVien(donViId: string): Promise<void> {
  const dv = await sysPrisma.donVi.findUnique({
    where: { id: donViId },
    select: { dbName: true },
  });
  if (!dv?.dbName) return; // chưa cấp DB tenant thì cũng chưa có thư mục nào

  await getTenantDb(dv.dbName).hrm_nhan_vien.updateMany({
    where: { drive_folder_id: { not: null } },
    data: { drive_folder_id: null },
  });
}

export async function ngatKetNoiDrive(donViId: string): Promise<void> {
  await sysPrisma.donVi.update({
    where: { id: donViId },
    data: {
      driveEmail: null,
      driveRefreshTokenCipher: null,
      driveRefreshTokenIv: null,
      driveRefreshTokenTag: null,
      driveRootFolderId: null,
    },
  });
  await quenThuMucNhanVien(donViId);
}

async function layTokenDonVi(donViId: string): Promise<TokenDonVi> {
  if (!driveDaCauHinh()) throw new DriveChuaCauHinhError();

  const dv = await sysPrisma.donVi.findUnique({
    where: { id: donViId },
    select: {
      maSoThue: true,
      tenDonVi: true,
      driveRootFolderId: true,
      driveRefreshTokenCipher: true,
      driveRefreshTokenIv: true,
      driveRefreshTokenTag: true,
    },
  });
  if (!dv) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  if (
    !dv.driveRefreshTokenCipher ||
    !dv.driveRefreshTokenIv ||
    !dv.driveRefreshTokenTag
  ) {
    throw new ConflictError(MESSAGES.HRM.DRIVE_CHUA_KET_NOI);
  }

  const refreshToken = decryptGdtPassword({
    cipher: dv.driveRefreshTokenCipher,
    iv: dv.driveRefreshTokenIv,
    tag: dv.driveRefreshTokenTag,
  });
  if (!refreshToken) {
    // Giải mã hỏng = đổi khóa env hoặc dữ liệu lỗi; coi như chưa kết nối để người dùng nối lại.
    throw new ConflictError(MESSAGES.HRM.DRIVE_CAN_KET_NOI_LAI);
  }

  return {
    refreshToken,
    maSoThue: dv.maSoThue,
    tenDonVi: dv.tenDonVi,
    rootFolderId: dv.driveRootFolderId,
  };
}

/**
 * Access token cho công ty. Refresh token bị thu hồi (khách gỡ quyền trong tài khoản Google)
 * thì Google trả 400 `invalid_grant` — lúc đó XÓA kết nối đã lưu để màn hình hiện đúng trạng
 * thái "chưa kết nối" thay vì báo lỗi lạ mỗi lần tải file.
 *
 * Điều kiện xóa bám đúng MÃ LỖI `invalid_grant`, KHÔNG bám dải 4xx. Cùng endpoint này còn trả
 * 4xx cho những chuyện không liên quan gì tới khách: `invalid_client` khi người vận hành đổi
 * `GOOGLE_CLIENT_SECRET` mà cập nhật env sai, hay 429 khi nhiều tenant tải file cùng lúc (mọi
 * tenant dùng chung một OAuth client). Bắt theo dải thì một lần gõ nhầm env sẽ xóa refresh
 * token của TOÀN BỘ tenant, sửa lại env cũng không cứu được vì token đã mất khỏi DB — mọi công
 * ty phải đăng nhập Google lại. Không rõ mã thì để lỗi bay lên thành 502 (thử lại được).
 */
async function accessTokenCuaDonVi(
  donViId: string,
  tok: TokenDonVi,
): Promise<string> {
  try {
    return await layAccessToken(tok.refreshToken);
  } catch (err) {
    if (err instanceof DriveApiError && err.maLoi === 'invalid_grant') {
      await ngatKetNoiDrive(donViId);
      throw new ConflictError(MESSAGES.HRM.DRIVE_CAN_KET_NOI_LAI);
    }
    throw err;
  }
}

/** Thư mục gốc `maxv / <MST> - <tên công ty>`, tạo lười và nhớ ID lại. */
async function thuMucCongTy(
  donViId: string,
  tok: TokenDonVi,
  accessToken: string,
): Promise<string> {
  if (tok.rootFolderId) return tok.rootFolderId;

  const idMaxv = await taoThuMucNeuChua(accessToken, THU_MUC_GOC, null);
  const idCongTy = await taoThuMucNeuChua(
    accessToken,
    `${tok.maSoThue} - ${tok.tenDonVi}`,
    idMaxv,
  );
  await sysPrisma.donVi.update({
    where: { id: donViId },
    data: { driveRootFolderId: idCongTy },
  });
  return idCongTy;
}

/** Thư mục riêng của nhân viên, tạo lười lúc tải file đầu tiên. */
async function thuMucNhanVien(
  db: PrismaClient,
  accessToken: string,
  idThuMucCongTy: string,
  maNv: string,
): Promise<string> {
  const nv = await findOrThrow(
    () =>
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
        select: { ma_nv: true, ho_ten: true, drive_folder_id: true },
      }),
    new NotFoundError(MESSAGES.HRM.NHAN_VIEN_NOT_FOUND),
  );
  if (nv.drive_folder_id) return nv.drive_folder_id;

  const id = await taoThuMucNeuChua(
    accessToken,
    `${nv.ma_nv} - ${nv.ho_ten}`,
    idThuMucCongTy,
  );
  await db.hrm_nhan_vien.update({
    where: { ma_nv: maNv },
    data: { drive_folder_id: id },
  });
  return id;
}

/* ══════════════ Luật thuần về danh sách file — không chạm DB, không chạm mạng ══════════════
 *
 * Ba hàm dưới đây tách ra để test được mà không cần Postgres lẫn Google. Chúng là NƠI Ở DUY
 * NHẤT của ba luật: thứ tự file kế tiếp, trần 20 file, và phép kiểm "file thuộc đúng giấy tờ".
 * Đừng viết lại tại chỗ ở controller hay service khác.
 */

/** Chỉ cần đúng bấy nhiêu để tính `thu_tu` — nhận cả dòng đầy đủ lẫn dòng rút gọn. */
interface CoThuTu {
  thu_tu: number;
}

/**
 * `thu_tu` cho file sắp thêm = lớn nhất đang có + 1; danh sách rỗng thì bắt đầu từ 0.
 *
 * KHÔNG dùng `files.length`: gỡ file ở giữa rồi thêm file mới sẽ sinh ra `thu_tu` trùng với
 * một file còn lại, và hai file đó đảo chỗ nhau giữa các lần đọc — đúng thứ `thu_tu` sinh ra
 * để tránh (xem ghi chú ở model `hrm_tai_lieu_file`).
 */
export function thuTuKeTiep(files: readonly CoThuTu[]): number {
  return files.reduce((max, f) => Math.max(max, f.thu_tu + 1), 0);
}

/**
 * Trần 20 file mỗi dòng giấy tờ — E-hrm-065 (409), BR-hrm-037.
 * Gọi TRƯỚC khi tải lên Drive: từ chối sau khi đã upload là để lại file mồ côi cho khách.
 */
export function assertConChoChoFile(soFileHienCo: number): void {
  if (soFileHienCo >= SO_FILE_TOI_DA) {
    throw new ConflictError(MESSAGES.HRM.TAI_LIEU_QUA_NHIEU_FILE);
  }
}

/**
 * Lấy đúng một file THUỘC dòng giấy tờ đang thao tác — E-hrm-037 / E-hrm-066 (404).
 *
 * 🔒 Đây là RANH GIỚI AN NINH, không phải chuyện thông báo cho đẹp. `:fileId` là uuid đến từ
 * client; tra thẳng `hrm_tai_lieu_file` theo mỗi `id` là người có quyền vào công ty xem và gỡ
 * được file của giấy tờ BẤT KỲ chỉ bằng cách đoán id. Vì vậy `files` truyền vào đây phải là
 * danh sách file của ĐÚNG dòng giấy tờ đã kiểm quyền, không phải kết quả tra toàn bảng.
 *
 * Hai thông điệp khác nhau có chủ đích: dòng chưa có file nào thì nói thẳng "chưa đính file"
 * (người dùng bấm nhầm nút), còn dòng có file mà id không khớp thì là E-hrm-066.
 */
export function timFileCuaTaiLieu<T extends { id: string }>(
  files: readonly T[],
  fileId: string,
): T {
  if (files.length === 0) {
    throw new NotFoundError(MESSAGES.HRM.TAI_LIEU_CHUA_CO_FILE);
  }
  const file = files.find((f) => f.id === fileId);
  if (!file) throw new NotFoundError(MESSAGES.HRM.TAI_LIEU_FILE_NOT_FOUND);
  return file;
}

/* ══════════════════════════ Thao tác có DB + Drive ══════════════════════════ */

/**
 * Dòng giấy tờ kèm TOÀN BỘ file của nó, đã sắp đúng thứ tự hiển thị.
 *
 * Lấy cả danh sách trong một lượt (trần 20 dòng con, không đáng kể) để mọi đường sau đó —
 * đếm trần, tính `thu_tu`, kiểm file thuộc đúng giấy tờ — dùng chung một ảnh chụp dữ liệu,
 * không phải bắn thêm truy vấn và không có khe cho hai đường đọc lệch nhau.
 *
 * `nhan_vien.da_xoa = false` là bắt buộc ở MỌI truy vấn `hrm_tai_lieu` (dev-notes 1.4 điều 6).
 */
async function timTaiLieuKemFile(db: PrismaClient, id: string) {
  return findOrThrow(
    () =>
      db.hrm_tai_lieu.findFirst({
        where: { id, nhan_vien: { da_xoa: false } },
        select: {
          id: true,
          ma_nv: true,
          files: {
            select: {
              id: true,
              drive_file_id: true,
              ten_file: true,
              mime_type: true,
              thu_tu: true,
            },
            orderBy: [{ thu_tu: 'asc' }, { datetime0: 'asc' }],
          },
        },
      }),
    new NotFoundError(MESSAGES.HRM.TAI_LIEU_NOT_FOUND),
  );
}

/**
 * THÊM một file scan vào dòng giấy tờ: tải lên Drive rồi ghi một dòng `hrm_tai_lieu_file`.
 *
 * `[QĐ #21]` Đây là THÊM VÀO, **không còn thay thế**. Bản cũ xóa file đang có rồi trỏ sang file
 * mới, nên căn cước hai mặt không bao giờ giữ được cả hai — muốn bỏ một file thì gỡ đích danh
 * (`goFile`).
 *
 * Thứ tự các phép kiểm là cố ý: cỡ file → MIME → trần 20 file, **tất cả trước khi gọi Google**.
 * Từ chối sau khi đã upload là để lại file mồ côi trên Drive CỦA KHÁCH mà mình không còn con trỏ.
 */
export async function dinhKemFile(
  db: PrismaClient,
  donViId: string,
  idTaiLieu: string,
  file: { ten: string; mimeType: string; noiDung: Buffer },
) {
  const tl = await timTaiLieuKemFile(db, idTaiLieu);

  if (file.noiDung.length > GIOI_HAN_FILE_BYTE) {
    throw new ConflictError(
      `File vượt quá ${Math.round(GIOI_HAN_FILE_BYTE / 1024 / 1024)}MB.`,
    );
  }
  if (!MIME_CHO_PHEP.includes(file.mimeType)) {
    throw new ConflictError(
      `Chỉ nhận ảnh (JPG, PNG, WEBP, HEIC) hoặc PDF — file gửi lên là "${file.mimeType}".`,
    );
  }
  assertConChoChoFile(tl.files.length);

  const tok = await layTokenDonVi(donViId);
  const accessToken = await accessTokenCuaDonVi(donViId, tok);
  const idCongTy = await thuMucCongTy(donViId, tok, accessToken);
  const idNhanVien = await thuMucNhanVien(db, accessToken, idCongTy, tl.ma_nv);

  const daTai = await taiFileLen(accessToken, {
    ten: file.ten,
    mimeType: file.mimeType,
    idThuMuc: idNhanVien,
    noiDung: file.noiDung,
  });

  const idFile = randomUUID();
  await db.hrm_tai_lieu_file.create({
    data: {
      id: idFile,
      tai_lieu_id: idTaiLieu,
      drive_file_id: daTai.id,
      ten_file: daTai.ten,
      mime_type: daTai.mimeType,
      kich_thuoc: daTai.kichThuoc,
      thu_tu: thuTuKeTiep(tl.files),
    },
  });
  // Chạm `datetime2` của dòng cha để màn danh sách biết giấy tờ vừa có thay đổi. KHÔNG đụng
  // bốn cột con trỏ cũ — chúng đã ngừng dùng (xem ghi chú ở `schema.prisma`).
  await db.hrm_tai_lieu.update({
    where: { id: idTaiLieu },
    data: { datetime2: new Date() },
  });

  return {
    id: idFile,
    tai_lieu_id: idTaiLieu,
    ten_file: daTai.ten,
    mime_type: daTai.mimeType,
    kich_thuoc: daTai.kichThuoc,
    so_file: tl.files.length + 1,
  };
}

/** Lấy nguyên byte MỘT file để controller trả về trình duyệt. */
export async function taiFileVe(
  db: PrismaClient,
  donViId: string,
  idTaiLieu: string,
  fileId: string,
) {
  const tl = await timTaiLieuKemFile(db, idTaiLieu);
  const file = timFileCuaTaiLieu(tl.files, fileId);

  const tok = await layTokenDonVi(donViId);
  const accessToken = await accessTokenCuaDonVi(donViId, tok);

  try {
    return {
      // Cùng trần với lúc tải lên. File nằm trên Drive CỦA KHÁCH nên họ thay bằng file khổng lồ
      // lúc nào cũng được — không chặn thì đường về thành lỗ hổng nuốt RAM máy chủ.
      noiDung: await layNoiDungFile(
        accessToken,
        file.drive_file_id,
        GIOI_HAN_FILE_BYTE,
      ),
      tenFile: file.ten_file,
      mimeType: file.mime_type,
    };
  } catch (err) {
    // 404 = app không với tới file: khách xóa thẳng trên Drive, HOẶC file thuộc tài khoản Google
    // kết nối trước đây. Không phân biệt được hai ca nên thông điệp nêu cả hai.
    if (err instanceof DriveApiError && err.status === 404) {
      throw new NotFoundError(MESSAGES.HRM.DRIVE_FILE_KHONG_MO_DUOC);
    }
    throw err;
  }
}

/**
 * Gỡ ĐÚNG MỘT file khỏi dòng giấy tờ: xóa trên Drive rồi xóa dòng `hrm_tai_lieu_file`.
 * Các file còn lại và dòng giấy tờ giữ nguyên; gỡ file cuối cùng cũng KHÔNG xóa dòng cha
 * (BR-hrm-038).
 *
 * Ở đây lỗi Drive **được ném ra** (khác `deleteTaiLieu`): người dùng đang yêu cầu đúng việc
 * "xóa file này", báo thành công trong khi file vẫn nằm trên Drive là nói dối. Riêng Drive trả
 * 404 thì `xoaFile` coi là xong — khách đã tự xóa tay trước đó.
 */
export async function goFile(
  db: PrismaClient,
  donViId: string,
  idTaiLieu: string,
  fileId: string,
) {
  const tl = await timTaiLieuKemFile(db, idTaiLieu);
  const file = timFileCuaTaiLieu(tl.files, fileId);

  const tok = await layTokenDonVi(donViId);
  const accessToken = await accessTokenCuaDonVi(donViId, tok);
  await xoaFile(accessToken, file.drive_file_id);

  await db.hrm_tai_lieu_file.delete({ where: { id: file.id } });
  await db.hrm_tai_lieu.update({
    where: { id: idTaiLieu },
    data: { datetime2: new Date() },
  });

  return { id: file.id, so_file_con_lai: tl.files.length - 1 };
}

/**
 * Xóa MỌI file scan của một dòng giấy tờ trên Drive — dùng khi xóa cả dòng (BR-hrm-039).
 *
 * CỐ HẾT SỨC, **không bao giờ ném lỗi**: dòng dữ liệu là thứ người dùng nhìn thấy và muốn bỏ
 * đi; giữ lại dòng chỉ vì Google đang hỏng là biến sự cố bên ngoài thành lỗi nghiệp vụ, người
 * dùng bấm lại nhiều lần mà không hiểu vì sao. Trả `false` khi còn sót file nào để controller
 * nói đúng sự thật với giao diện (`da_xoa_file_drive`).
 *
 * Gọi TRƯỚC khi xóa dòng cha: khóa ngoại `onDelete: Cascade` dọn bảng con ngay, mà **Postgres
 * không biết gì về Drive** — xóa dòng trước là mất sạch con trỏ, file thành mồ côi vĩnh viễn.
 *
 * ĐIỀU KIỆN GỌI: người gọi đã kiểm dòng `hrm_tai_lieu` tồn tại và thuộc nhân viên chưa xóa mềm
 * (`deleteTaiLieu` làm việc đó). Hàm này cố ý không kiểm lại — nó chỉ nhận `tai_lieu_id` và đi
 * theo khóa ngoại, nên đừng gọi thẳng với id đến từ client.
 *
 * Vòng lặp TUẦN TỰ, không `Promise.all`: 20 lượt DELETE bắn cùng lúc lên Google là tự đưa mình
 * vào 429, và lúc đó không biết file nào đã xóa file nào chưa.
 */
export async function xoaMoiFileTrenDrive(
  db: PrismaClient,
  donViId: string,
  idTaiLieu: string,
  ghiLoi?: (err: unknown) => void,
): Promise<boolean> {
  const files = await db.hrm_tai_lieu_file.findMany({
    where: { tai_lieu_id: idTaiLieu },
    select: { drive_file_id: true },
  });
  // Chưa đính file nào thì không có gì thành mồ côi — đúng nghĩa "Drive đã sạch".
  if (files.length === 0) return true;

  try {
    const tok = await layTokenDonVi(donViId);
    const accessToken = await accessTokenCuaDonVi(donViId, tok);

    let sach = true;
    for (const f of files) {
      try {
        await xoaFile(accessToken, f.drive_file_id);
      } catch (err) {
        sach = false;
        ghiLoi?.(err);
      }
    }
    return sach;
  } catch (err) {
    // Chưa kết nối Drive / token hỏng / mất mạng: không xóa được file nào, nhưng vẫn cho phép
    // xóa dòng. Ghi lại để người vận hành biết còn file cần dọn tay.
    ghiLoi?.(err);
    return false;
  }
}
