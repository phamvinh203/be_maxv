import { sysPrisma } from '../../../config/db.sys';
import type { PrismaClient } from '../../../generated/tenant';
import {
  ConflictError,
  DriveApiError,
  NotFoundError,
} from '../../../helpers/errors';
import { findOrThrow } from '../../../helpers/crudGuards';
import { getTenantDb } from '../../../helpers/tenantClient';
import { MESSAGES } from '../../../constants/messages';
import {
  decryptGdtPassword,
  encryptGdtPassword,
  isEncryptionConfigured,
} from '../hddt/gdtCredential';
import {
  DriveChuaCauHinhError,
  driveDaCauHinh,
  doiMaLayToken,
  layAccessToken,
  layNoiDungFile,
  taiFileLen,
  taoThuMucNeuChua,
  xoaFile,
} from './driveClient';

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
 * CỐ Ý không đụng `hrm_tai_lieu.drive_file_id`: file không tìm lại được theo tên như thư mục,
 * xóa con trỏ là xóa luôn dấu vết khách từng đính kèm giấy tờ gì. File cũ vẫn nằm nguyên ở tài
 * khoản Google trước đó — việc của mình là báo đúng chuyện đó (xem DRIVE_FILE_KHONG_MO_DUOC).
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

async function timTaiLieu(db: PrismaClient, id: string) {
  return findOrThrow(
    () =>
      db.hrm_tai_lieu.findFirst({
        where: { id, nhan_vien: { da_xoa: false } },
        select: {
          id: true,
          ma_nv: true,
          drive_file_id: true,
          ten_file: true,
          mime_type: true,
        },
      }),
    new NotFoundError(MESSAGES.HRM.TAI_LIEU_NOT_FOUND),
  );
}

/** Đính file scan vào một dòng tài liệu: tải lên Drive rồi ghi con trỏ vào DB. */
export async function dinhKemFile(
  db: PrismaClient,
  donViId: string,
  idTaiLieu: string,
  file: { ten: string; mimeType: string; noiDung: Buffer },
) {
  const tl = await timTaiLieu(db, idTaiLieu);

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

  // Thay file cho một tài liệu đã có file: xóa file cũ SAU khi tải file mới thành công —
  // hỏng giữa chừng thì thà thừa một file trên Drive còn hơn mất cả hai.
  if (tl.drive_file_id) {
    await xoaFile(accessToken, tl.drive_file_id).catch(() => undefined);
  }

  await db.hrm_tai_lieu.update({
    where: { id: idTaiLieu },
    data: {
      drive_file_id: daTai.id,
      ten_file: daTai.ten,
      mime_type: daTai.mimeType,
      kich_thuoc: daTai.kichThuoc,
      datetime2: new Date(),
    },
  });

  return {
    id: idTaiLieu,
    ten_file: daTai.ten,
    mime_type: daTai.mimeType,
    kich_thuoc: daTai.kichThuoc,
  };
}

/** Lấy nguyên byte file để controller stream về trình duyệt. */
export async function taiFileVe(
  db: PrismaClient,
  donViId: string,
  idTaiLieu: string,
) {
  const tl = await timTaiLieu(db, idTaiLieu);
  if (!tl.drive_file_id) {
    throw new NotFoundError('Tài liệu này chưa đính file scan.');
  }

  const tok = await layTokenDonVi(donViId);
  const accessToken = await accessTokenCuaDonVi(donViId, tok);

  try {
    return {
      // Cùng trần với lúc tải lên. File nằm trên Drive CỦA KHÁCH nên họ thay bằng file khổng lồ
      // lúc nào cũng được — không chặn thì đường về thành lỗ hổng nuốt RAM máy chủ.
      noiDung: await layNoiDungFile(
        accessToken,
        tl.drive_file_id,
        GIOI_HAN_FILE_BYTE,
      ),
      tenFile: tl.ten_file ?? 'tai-lieu',
      mimeType: tl.mime_type ?? 'application/octet-stream',
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

/** Gỡ file khỏi tài liệu: xóa trên Drive và xóa con trỏ trong DB (dòng tài liệu vẫn ở lại). */
export async function goFile(
  db: PrismaClient,
  donViId: string,
  idTaiLieu: string,
) {
  const tl = await timTaiLieu(db, idTaiLieu);
  if (!tl.drive_file_id) {
    throw new NotFoundError('Tài liệu này chưa đính file scan.');
  }

  const tok = await layTokenDonVi(donViId);
  const accessToken = await accessTokenCuaDonVi(donViId, tok);
  await xoaFile(accessToken, tl.drive_file_id);

  await db.hrm_tai_lieu.update({
    where: { id: idTaiLieu },
    data: {
      drive_file_id: null,
      ten_file: null,
      mime_type: null,
      kich_thuoc: null,
      datetime2: new Date(),
    },
  });
  return { id: idTaiLieu };
}
