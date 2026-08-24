import { FastifyReply, FastifyRequest } from "fastify";
import * as DvcService from "../../../services/client/dich_vu_cong/gdt-dvc.service";
import * as DvcDongBo from "../../../services/client/dich_vu_cong/dvc-dong-bo.service";
import { sysPrisma } from "../../../config/db.sys";
import { accessibleDonViWhere } from "../../../helpers/access";
import { resolveTenantDb, resolveTenantDbName } from "../../../helpers/resolveTenantDb";
// Dùng lại module crypto của HĐĐT: file đó CỐ Ý không đụng Prisma/HĐĐT gì (chỉ AES-256-GCM
// thuần trên chuỗi), nên tái dùng được cho cột `dvcPassword*` mà không cần chép lại.
import { decryptGdtPassword, encryptGdtPassword } from "../../../services/client/hddt/gdtCredential";
import { layChiTietToKhai } from "../../../services/client/dich_vu_cong/toKhaiXml";

type KetQuaDocCache<T> = { ok: true; giaTri: T } | { ok: false; message: string };


/** Thân phản hồi lỗi dùng chung cho các handler DVC — kèm `code` khi phiên hết đường cứu. */
function thanLoi(err: unknown, macDinh: string): { message: string; code?: string } {
  const message = DvcService.toUserMessage(err, macDinh);
  return err instanceof DvcService.DvcAutoLoginFailedError
    ? { message, code: DvcService.MA_LOI_TU_DANG_NHAP_HONG }
    : { message };
}

/**
 * Khung dùng chung cho `taiFileHoSo`/`taiThongBao`/`danhSachThongBao`: đọc cache trong DB tenant
 * trước, thiếu mới đòi `key` để gọi cổng thật rồi ghi lại vào cache. Trả kết quả có gắn cờ `ok`
 * thay vì tự `reply` hay ném lỗi — case "thiếu key" là luồng BÌNH THƯỜNG (chưa đăng nhập cổng),
 * không phải lỗi bất ngờ, nên không đi qua `catch`/`request.log.error` của handler.
 */
async function docCacheHoacGoiCong<T>(opts: {
  /** Cần để tự đăng nhập lại khi phiên đã mất, xem `voiPhienTuPhucHoi`. */
  request: FastifyRequest;
  key: string | undefined;
  docCache: () => Promise<T | null>;
  goiCong: (phien: DvcService.DvcPhien) => Promise<T>;
  ghiCache: (giaTri: T) => Promise<void>;
  thieuKeyMessage: string;
}): Promise<KetQuaDocCache<T>> {
  const daLuu = await opts.docCache();
  if (daLuu !== null) return { ok: true, giaTri: daLuu };

  const phien = phienDvc(opts.request, opts.key);
  if (!phien) return { ok: false, message: opts.thieuKeyMessage };

  const giaTri = await voiPhienTuPhucHoi(nguCanhTuRequest(opts.request), phien, () =>
    opts.goiCong(phien),
  );
  await opts.ghiCache(giaTri);
  return { ok: true, giaTri };
}

/**
 * Ghép `key` FE gửi lên với công ty ĐANG CHỌN của người dùng đã đăng nhập app -> `DvcPhien`.
 * `null` khi thiếu một trong hai (chưa đăng nhập cổng, hoặc chưa chọn công ty).
 *
 * Đây là chỗ DUY NHẤT `donViId` được gắn vào một lượt gọi cổng. Service không tự suy công ty từ
 * `key` — nếu suy thì `key` lại trở thành thứ tự cấp quyền, đúng cái `requireSession` sinh ra để
 * chặn (xem `DvcPhien` bên `gdt-dvc.service.ts`).
 */
function phienDvc(request: FastifyRequest, key: string | undefined): DvcService.DvcPhien | null {
  const donViId = request.user?.donViId;
  return key && donViId ? { key, donViId } : null;
}

/**
 * GET /dvc/captcha — mở một phiên mới với cổng Dịch vụ công và trả ảnh captcha.
 *
 * Trả `{ key, image }`: `key` là khóa phiên FE phải gửi lại khi đăng nhập, `image` là
 * data-URL gắn thẳng vào `<img src>`.
 */
export async function captcha(request: FastifyRequest, reply: FastifyReply) {
  // Phiên mở ra thuộc về công ty đang chọn và CHỈ công ty đó dùng lại được (xem `DvcPhien`), nên
  // chưa chọn công ty thì không mở phiên — thiếu chủ sở hữu để gắn.
  const donViId = request.user?.donViId;
  if (!donViId) {
    return reply.status(400).send({ message: "Chưa chọn công ty để đăng nhập cổng Dịch vụ công." });
  }

  try {
    const result = await DvcService.getCaptcha(donViId);
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send(thanLoi(err, "Không lấy được mã captcha của cổng Dịch vụ công."));
  }
}

/**
 * GET /dvc/tchs/captcha?key=... — lấy ảnh captcha và tự động giải OCR cho form tra cứu hồ sơ /tthc/tchs.
 */
export async function tchsCaptcha(
  request: FastifyRequest<{ Querystring: { key?: string } }>,
  reply: FastifyReply,
) {
  const phien = phienDvc(request, request.query?.key);
  if (!phien) {
    return reply.status(400).send({ message: "Thiếu khóa phiên key hoặc chưa chọn công ty." });
  }

  try {
    const result = await DvcService.getTchsCaptcha(phien);
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send(thanLoi(err, "Không lấy được mã captcha tra cứu hồ sơ."));
  }
}

/**
 * Body chưa qua kiểm tra. Dùng lại `DvcLoginRequest` của service thay vì khai lại hình
 * dạng lần hai — thêm trường thì chỉ phải sửa một chỗ, không lo rơi field lúc chép tay.
 */
type DvcLoginBody = Partial<DvcService.DvcLoginRequest>;

/**
 * Công ty đang chọn (theo `req.user.donViId`) kèm MST + credential DVC đã lưu (nếu có), có kiểm
 * quyền — dùng chung cho `login` (lưu mật khẩu) và `getCredential` (đọc lại điền sẵn), nên select
 * đủ cột cho cả hai thay vì mỗi handler tự query riêng.
 *
 * Mirror `activeCompanyCredential` bên `hddt/gdt.controller.ts` nhưng viết lại tại chỗ thay vì
 * tách chung: hai luồng lưu vào cột khác nhau (`gdtPassword*` vs `dvcUsername`+`dvcPassword*`),
 * tách chung giờ phải thêm tham số chọn cột — đợi có luồng thứ ba mới đáng tách.
 */
/** Ba trường duy nhất của `request.user` mà `activeCompanyForDvc` cần — rút ra thành kiểu riêng để
 * lượt chạy nền truyền được ba chuỗi thay vì giữ nguyên object request, xem `NguCanhPhucHoi`. */
type NguoiDungDvc = { donViId?: string | null; userId: string; role: string };

const nguoiDungCuaRequest = (request: FastifyRequest): NguoiDungDvc => ({
  donViId: request.user?.donViId,
  userId: request.user.userId,
  role: request.user.role,
});

async function activeCompanyForDvc(u: NguoiDungDvc): Promise<{
  id: string;
  maSoThue: string;
  dvcUsername: string | null;
  dvcPasswordCipher: string | null;
  dvcPasswordIv: string | null;
  dvcPasswordTag: string | null;
} | null> {
  const donViId = u.donViId;
  if (!donViId) return null;
  const scope = accessibleDonViWhere(u.userId, u.role);
  if (!scope) return null;

  return sysPrisma.donVi.findFirst({
    where: { ...scope, id: donViId },
    select: {
      id: true,
      maSoThue: true,
      dvcUsername: true,
      dvcPasswordCipher: true,
      dvcPasswordIv: true,
      dvcPasswordTag: true,
    },
  });
}

/** Rút MST từ tên đăng nhập DVC theo quy ước "<MST>-ql" — `null` nếu không khớp quy ước. */
function mstTuTenDangNhapDvc(tenDN: string): string | null {
  return /^(\d{10,13})-ql$/.exec(tenDN.trim())?.[1] ?? null;
}

/**
 * Mật khẩu DVC đã giải mã của công ty đang chọn — `null` khi chưa lưu đủ 3 cột `dvcPassword*` hoặc
 * chưa cấu hình khóa mã hóa (`decryptGdtPassword` tự trả `null`).
 *
 * Gom một chỗ vì `getCredential` (điền sẵn form) và `taiKhoanDvcDaLuu` (tự đăng nhập ngầm) đều cần
 * đúng thao tác này: hai bên khác nhau ở chỗ CHẤP NHẬN GÌ khi thiếu, không phải ở cách giải mã.
 */
function matKhauDvcDaGiaiMa(
  active: Awaited<ReturnType<typeof activeCompanyForDvc>>,
): string | null {
  if (!active?.dvcPasswordCipher || !active.dvcPasswordIv || !active.dvcPasswordTag) return null;
  return decryptGdtPassword({
    cipher: active.dvcPasswordCipher,
    iv: active.dvcPasswordIv,
    tag: active.dvcPasswordTag,
  });
}

/**
 * Tài khoản DVC đã lưu của công ty ĐANG CHỌN, mật khẩu đã giải mã — `null` nếu chưa từng đăng nhập
 * hoặc chưa lưu đủ.
 *
 * Khác `getCredential` (trả về cho FE điền sẵn form, có username là đủ): ở đây thiếu MỘT trong hai
 * là không tự đăng nhập ngầm được, nên đòi đủ cả cặp.
 */
async function taiKhoanDvcDaLuu(u: NguoiDungDvc): Promise<DvcService.DvcCredential | null> {
  const active = await activeCompanyForDvc(u);
  if (!active?.dvcUsername) return null;
  const matKhau = matKhauDvcDaGiaiMa(active);
  return matKhau ? { tenDN: active.dvcUsername, matKhau } : null;
}

/**
 * Thứ `voiPhienTuPhucHoi` cần từ tầng request — TÁCH RA khỏi chính `request` để lượt chạy nền
 * (`dongBo`) không phải giữ nguyên object request sống suốt vài phút sau khi đã trả response.
 * Cùng lý lẽ `startUpdateRun` bên HĐĐT rút sẵn `dbName`/`gdtToken` trước khi mở lượt nền.
 *
 * `layTaiKhoan` là THUNK chứ không phải giá trị: các handler đọc-cache gọi `voiPhienTuPhucHoi` cho
 * mọi lượt, mà hầu hết trúng cache và không bao giờ cần tới tài khoản — giải mã sẵn mỗi lượt là
 * tốn công vô ích.
 */
interface NguCanhPhucHoi {
  layTaiKhoan: () => Promise<DvcService.DvcCredential | null>;
  log: FastifyRequest["log"];
}

function nguCanhTuRequest(request: FastifyRequest): NguCanhPhucHoi {
  // Chụp BA CHUỖI ra ngay tại đây, không đóng gói `request` vào thunk: closure này bị lượt chạy nền
  // giữ suốt vài phút sau khi response đã đi, mà `request` kéo theo cả `raw`/headers/body.
  const u = nguoiDungCuaRequest(request);
  return { layTaiKhoan: () => taiKhoanDvcDaLuu(u), log: request.log };
}

/**
 * Bọc quanh MỘT thao tác cần phiên cổng: phiên RAM mất hẳn (`DvcSessionExpiredError`) thì tự mở
 * phiên mới + đăng nhập ngầm bằng tài khoản đã lưu rồi thử lại ĐÚNG một lần.
 *
 * VÌ SAO NẰM Ở CONTROLLER, không nhét thẳng vào service như `voiTuDangNhapLai`: chỉ ở đây mới biết
 * người dùng là ai và công ty đang chọn là công ty nào — tức là chỉ ở đây mới đọc được tài khoản đã
 * lưu ĐÚNG chủ. Service không được tự suy tài khoản từ `key`, xem chú thích ở
 * `DvcService.phucHoiPhienDaMat`.
 *
 * Bổ sung cho `voiTuDangNhapLai` trong service chứ không thay thế: bên đó lo phiên CÒN SỐNG bị cổng
 * đá (302/401), bên này lo phiên đã BIẾN MẤT khỏi RAM (quá TTL 30 phút, hoặc BE vừa restart).
 *
 * Chưa lưu tài khoản -> ném lại nguyên lỗi cũ để người dùng vẫn thấy thông báo "đăng nhập lại"
 * quen thuộc, không nuốt lỗi thành một thông báo khó hiểu hơn.
 */
async function voiPhienTuPhucHoi<T>(
  ng: NguCanhPhucHoi,
  phien: DvcService.DvcPhien,
  thaoTac: () => Promise<T>,
): Promise<T> {
  try {
    return await thaoTac();
  } catch (err) {
    if (!(err instanceof DvcService.DvcSessionExpiredError)) throw err;

    const cred = await ng.layTaiKhoan();
    if (!cred) {
      ng.log.info("[dvc] phiên đã mất nhưng chưa lưu tài khoản DVC -> không tự đăng nhập lại");
      throw err;
    }

    ng.log.info("[dvc] phiên đã mất -> tự mở phiên mới + đăng nhập lại bằng tài khoản đã lưu");
    await DvcService.phucHoiPhienDaMat(phien, cred);
    return thaoTac();
  }
}

/**
 * GET /dvc/credential (authenticated) — trả tài khoản + MẬT KHẨU đã lưu (đã giải mã) của công
 * ty đang chọn, để FE điền sẵn vào dialog đăng nhập DVC. `{ username: null, password: null }`
 * nếu chưa lưu / chưa cấu hình khóa mã hóa (`isEncryptionConfigured()` false thì `decryptGdtPassword`
 * đã tự trả `null`, không cần kiểm riêng ở đây).
 *
 * `username` trả THẲNG giá trị đã lưu, không suy từ MST: quy ước "<MST>-ql" chỉ là fallback bên
 * FE (`DvcPage.tenDangNhapDvc`) cho lần đầu CHƯA từng đăng nhập — đằng này là tên thật đã đăng
 * nhập thành công, có thể khác quy ước.
 *
 * LƯU Ý BẢO MẬT: endpoint gửi MẬT KHẨU THẬT về trình duyệt (đã đăng nhập app + đúng quyền công
 * ty đang chọn) — cùng thiết kế `GET /gdt/credential` bên `hddt/gdt.controller.ts`.
 */
export async function getCredential(request: FastifyRequest, reply: FastifyReply) {
  const active = await activeCompanyForDvc(nguoiDungCuaRequest(request));
  return reply.send({
    username: active?.dvcUsername ?? null,
    password: matKhauDvcDaGiaiMa(active),
  });
}

/**
 * POST /dvc/login — đăng nhập cổng Dịch vụ công bằng phiên đã lấy captcha.
 *
 * Đăng nhập THÀNH CÔNG thì tự MÃ HÓA LƯU tài khoản + mật khẩu cho công ty đang chọn (cột
 * `dvcUsername`/`dvcPassword*` trên `DonVi`, cùng cơ chế `gdtPassword*` bên HĐĐT) để lần sau
 * khỏi gõ lại — `getCredential` ở trên đọc lại đúng hai cột này. Không có bước "ghi nhớ" riêng:
 * mỗi lần đăng nhập đúng là ghi đè bản cũ.
 *
 * "Thành công" ở đây vẫn là suy đoán như FE đang hiểu (không thấy cờ lỗi = coi như xong) — xem
 * chú thích ở `DvcService.login`: cổng trả 200 cho cả hai, dạng phản hồi khi đúng/sai chưa chốt.
 * Lưu nhầm mật khẩu của một lượt tưởng đúng mà thực ra sai KHÔNG gây hại thêm Ở BƯỚC NÀY: đây
 * vẫn là một lượt đăng nhập THẬT do người dùng tự bấm, không phải vòng lặp tự thử nhiều lần.
 *
 * Tài khoản đã lưu ở đây còn được `DvcService` dùng để TỰ ĐĂNG NHẬP LẠI NGẦM khi cổng đá phiên
 * giữa chừng một thao tác khác (xem `session.credential`/`tuDangNhapLai` trong
 * `gdt-dvc.service.ts`) — tối đa 3 lượt, dừng ngay nếu cổng báo rõ sai tài khoản/mật khẩu, để
 * tránh đúng rủi ro khóa tài khoản do vòng lặp tự động gõ sai liên tiếp.
 */
export async function login(
  request: FastifyRequest<{ Body: DvcLoginBody }>,
  reply: FastifyReply,
) {
  const body = request.body;
  if (!body?.key || !body?.tenDN || !body?.matKhau || !body?.captcha) {
    return reply.status(400).send({ message: "Vui lòng nhập đầy đủ thông tin." });
  }
  const phien = phienDvc(request, body.key);
  if (!phien) {
    return reply.status(400).send({ message: "Chưa chọn công ty để đăng nhập cổng Dịch vụ công." });
  }

  try {
    const result = await DvcService.login({
      ...phien,
      tenDN: body.tenDN,
      matKhau: body.matKhau,
      captcha: body.captcha,
    });

    // Guard theo MST rút từ `tenDN`: chỉ CHẶN lưu khi rõ ràng thuộc MST KHÁC công ty đang chọn
    // (tránh ghi đè nhầm mật khẩu công ty khác lên công ty đang chọn — người dùng có thể tự sửa
    // ô tên đăng nhập trước khi bấm). Không rõ quy ước (`mstTuTen === null`) thì vẫn lưu, vì tên
    // đăng nhập cổng DVC không đảm bảo luôn đúng "<MST>-ql". Lỗi lưu KHÔNG làm hỏng đăng nhập
    // (kết quả đã có trong tay), chỉ là lần sau không dùng lại được.
    const active = await activeCompanyForDvc(nguoiDungCuaRequest(request));
    const mstTuTen = mstTuTenDangNhapDvc(body.tenDN);
    if (active && (mstTuTen === null || mstTuTen === active.maSoThue)) {
      const blob = encryptGdtPassword(body.matKhau);
      if (blob) {
        await sysPrisma.donVi
          .update({
            where: { id: active.id },
            data: {
              dvcUsername: body.tenDN,
              dvcPasswordCipher: blob.cipher,
              dvcPasswordIv: blob.iv,
              dvcPasswordTag: blob.tag,
            },
          })
          .catch((e) => request.log.warn({ err: e }, "[dvc.login] không lưu được mật khẩu DVC"));
      }
    }

    return reply.send(result);
  } catch (err) {
    request.log.error(err);

    // KHÔNG dùng 401: `apiFetch` bên FE dành riêng 401 cho nghĩa "cookie app hết hạn" nên sẽ
    // gọi /auth/refresh rồi GỬI LẠI request này với captcha đã bị tiêu — thành 2 lượt gọi cổng
    // cho một lần bấm. Giống lý do đã ghi ở `hddt/gdt.controller.ts`.
    return reply.status(400).send(thanLoi(err, "Đăng nhập cổng Dịch vụ công thất bại."));
  }
}

/** Khớp hình dạng bộ lọc của `DvcDongBo.timHoSoDaDongBo` — cùng 4 field, không định nghĩa lại tay. */
type DvcTraCuuHoSoQuery = DvcDongBo.TimHoSoDaDongBoBoLoc;

/**
 * GET /dvc/ho-so — tra cứu hồ sơ tờ khai (Dịch vụ công) đã ĐỒNG BỘ, đọc thẳng DB tenant.
 *
 * KHÔNG còn gọi cổng trực tiếp (khác trước đây): giờ chỉ nút "Đồng bộ" trong `DialogDongBo`
 * (`DvcDongBo.dongBoHoSo`) mới thật sự đăng nhập/gọi cổng — tra cứu tách hẳn ra để không phải chờ
 * cổng lẫn không cần `key` phiên nữa. `maHoSo`/`maToKhai` giữ đúng tên tham số cũ để FE khỏi đổi gì.
 */
export async function traCuuHoSo(
  request: FastifyRequest<{ Querystring: DvcTraCuuHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const tenantDb = await resolveTenantDb(request);

  try {
    const bang = await DvcDongBo.timHoSoDaDongBo(tenantDb, {
      tuNgay: q?.tuNgay,
      denNgay: q?.denNgay,
      maHoSo: q?.maHoSo,
      maToKhai: q?.maToKhai,
    });
    return reply.send(bang);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: err instanceof Error ? err.message : "Tra cứu hồ sơ thất bại.",
    });
  }
}

/**
 * POST /dvc/dong-bo — chạy một lượt "Đồng bộ" tờ khai (Dịch vụ công): gọi cổng thật (cần `key` phiên
 * ĐÃ đăng nhập), lưu hồ sơ + tài liệu vào DB tenant, trả về tiến độ lượt vừa mở.
 */
export async function dongBo(
  request: FastifyRequest<{ Body: { key?: string; tuNgay?: string; denNgay?: string } }>,
  reply: FastifyReply,
) {
  const body = request.body;
  if (!body?.key || !body?.tuNgay || !body?.denNgay) {
    return reply.status(400).send({ message: "Thiếu khóa phiên hoặc khoảng ngày đồng bộ." });
  }
  // Tách ra biến riêng sau guard: kiểu đã hẹp về `string` ở đây mới còn giữ được khi dùng lại bên
  // trong closure của `voiPhienTuPhucHoi` (TS bỏ narrowing của thuộc tính object khi vào callback).
  const { tuNgay, denNgay } = body;
  const phien = phienDvc(request, body.key);
  if (!phien) {
    return reply.status(400).send({ message: "Chưa chọn công ty để đồng bộ Dịch vụ công." });
  }

  // `dbName` chứ KHÔNG phải client: lượt nền chạy hàng phút, giữ một `PrismaClient` suốt ngần ấy là
  // để sweeper idle-10' của `tenantClient` đóng pool giữa chừng. `dongBoHoSo` tự gọi lại
  // `getTenantDb` ở mỗi lần chạm DB — xem docblock `resolveTenantDbName`.
  const dbName = await resolveTenantDbName(request);
  // Rút sẵn ngữ cảnh TRƯỚC khi mở lượt nền, cùng lý do (xem `NguCanhPhucHoi`).
  const nguCanh = nguCanhTuRequest(request);

  // KHÔNG await: mở lượt nền rồi trả tiến độ ngay -> FE poll `/dong-bo/tien-do`.
  const tienDo = DvcDongBo.batDauDongBoRun(phien.donViId, (st, daBiThay) =>
    DvcDongBo.dongBoHoSo(dbName, {
      phien,
      tuNgay,
      denNgay,
      tienDo: st,
      daBiThay,
      // Phiên RAM hết hạn (>30 phút không thao tác) hoặc mất do BE restart -> tự đăng nhập lại
      // ngầm rồi thử lại. CHỈ bọc pha tra cứu, xem `voiPhucHoi` ở `DongBoHoSoParams`.
      voiPhucHoi: (thaoTac) => voiPhienTuPhucHoi(nguCanh, phien, thaoTac),
    }),
  );

  return reply.send(tienDo);
}

/**
 * GET /dvc/dong-bo/tien-do — tiến độ lượt đồng bộ đang chạy của CÔNG TY ĐANG CHỌN.
 *
 * `null` khi công ty này chưa từng chạy lượt nào. Khóa lượt là `donViId` lấy từ `request.user`, nên
 * không có đường nào xem được lượt của công ty khác — cùng cách cô lập với `DvcPhien`.
 *
 * Dùng: vòng poll của FE, và lúc mở lại trang để NỐI LẠI lượt đang chạy.
 */
export async function tienDoDongBo(request: FastifyRequest, reply: FastifyReply) {
  const donViId = request.user?.donViId;
  if (!donViId) return reply.status(400).send({ message: "Chưa chọn công ty." });
  return reply.send(DvcDongBo.docTienDoDongBo(donViId));
}

/** GET /dvc/dong-bo/lich-su — lịch sử các lượt đồng bộ (mới nhất trước). */
export async function lichSuDongBo(request: FastifyRequest, reply: FastifyReply) {
  const tenantDb = await resolveTenantDb(request);
  try {
    return reply.send(await DvcDongBo.layLichSuDongBo(tenantDb));
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không đọc được lịch sử đồng bộ.",
    });
  }
}

/** DELETE /dvc/dong-bo/lich-su/:id — xóa 1 dòng lịch sử (chỉ bản ghi log). */
export async function xoaLichSuDongBo(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = request.params;
  if (!id) {
    return reply.status(400).send({ message: "Thiếu id dòng lịch sử." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const count = await DvcDongBo.xoaLichSuDongBo(tenantDb, id);
    if (count === 0) {
      return reply.status(404).send({ message: "Không tìm thấy dòng lịch sử đồng bộ." });
    }
    return reply.send({ deleted: count });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không xóa được dòng lịch sử đồng bộ.",
    });
  }
}

/** DELETE /dvc/dong-bo/lich-su — xóa TOÀN BỘ lịch sử đồng bộ (chỉ bản ghi log). */
export async function xoaTatCaLichSuDongBo(request: FastifyRequest, reply: FastifyReply) {
  const tenantDb = await resolveTenantDb(request);
  try {
    const deleted = await DvcDongBo.xoaTatCaLichSuDongBo(tenantDb);
    return reply.send({ deleted });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      message: err instanceof Error ? err.message : "Không xóa được lịch sử đồng bộ.",
    });
  }
}

type DvcHoSoQuery = { key?: string; maHoSo?: string };

/**
 * GET /dvc/ho-so/file — tải file XML của một hồ sơ theo mã hồ sơ (cột "Tải file").
 *
 * ĐỌC CACHE TRƯỚC (`DvcDongBo.layFileHoSoDaLuu`, không cần `key`/đăng nhập nếu hồ sơ đã đồng bộ
 * xml); thiếu mới gọi cổng thật (cần `key`) rồi ghi lại vào cache cho lượt sau. Trả nguyên bytes +
 * content-type, không bọc JSON: đây là tệp tải xuống, không phải dữ liệu để FE parse.
 */
export async function taiFileHoSo(
  request: FastifyRequest<{ Querystring: DvcHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const maHoSo = q?.maHoSo;
  if (!maHoSo) {
    return reply.status(400).send({ message: "Thiếu mã hồ sơ." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const ket = await docCacheHoacGoiCong({
      request,
      key: q.key,
      docCache: () => DvcDongBo.layFileHoSoDaLuu(tenantDb, maHoSo),
      goiCong: (key) => DvcService.taiXmlHoSo(key, maHoSo),
      ghiCache: (tep) => DvcDongBo.luuFileHoSoVaoCache(tenantDb, maHoSo, tep),
      thieuKeyMessage:
        'Hồ sơ chưa đồng bộ — bấm "Đăng nhập cổng Dịch vụ công" rồi thử lại để tải trực tiếp.',
    });
    if (!ket.ok) return reply.status(400).send({ message: ket.message });

    const tep = ket.giaTri;
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(tep.fileName)}`,
      )
      .type(tep.contentType)
      .send(tep.bytes);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send(thanLoi(err, "Tải file hồ sơ thất bại."));
  }
}

/**
 * GET /dvc/ho-so/tai-lieu-dkem — danh sách tài liệu đính kèm của một hồ sơ (cột "Tệp đính kèm").
 *
 * Chuyển tiếp nguyên JSON cổng trả về — hình dạng thật chưa xác nhận, xem
 * `DvcService.layTaiLieuDinhKem`.
 */
export async function taiLieuDinhKem(
  request: FastifyRequest<{ Querystring: DvcHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  if (!q?.key || !q?.maHoSo) {
    return reply.status(400).send({ message: "Thiếu khóa phiên hoặc mã hồ sơ." });
  }
  const { maHoSo } = q;
  const phien = phienDvc(request, q.key);
  if (!phien) {
    return reply.status(400).send({ message: "Chưa chọn công ty để gọi cổng Dịch vụ công." });
  }

  try {
    const data = await voiPhienTuPhucHoi(nguCanhTuRequest(request), phien, () =>
      DvcService.layTaiLieuDinhKem(phien, maHoSo),
    );
    return reply.send(data);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send(thanLoi(err, "Không lấy được danh sách tài liệu đính kèm."));
  }
}

/**
 * GET /dvc/ho-so/to-khai-chi-tiet — chỉ tiêu tờ khai đã bóc từ XML (dialog "Xem tờ khai" khi bấm
 * cột "Tờ khai / Phụ lục"). CÙNG cơ chế đọc-cache-trước như `taiFileHoSo` (đọc `dvc_ho_so`
 * trong DB tenant trước, thiếu mới cần `key` để gọi cổng thật), chỉ khác là trả JSON đã bóc
 * (`layChiTietToKhai`) thay vì nguyên bytes file XML.
 */
export async function chiTietToKhai(
  request: FastifyRequest<{ Querystring: DvcHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const maHoSo = q?.maHoSo;
  if (!maHoSo) {
    return reply.status(400).send({ message: "Thiếu mã hồ sơ." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const ket = await docCacheHoacGoiCong({
      request,
      key: q.key,
      docCache: () => DvcDongBo.layFileHoSoDaLuu(tenantDb, maHoSo),
      goiCong: (key) => DvcService.taiXmlHoSo(key, maHoSo),
      ghiCache: (tep) => DvcDongBo.luuFileHoSoVaoCache(tenantDb, maHoSo, tep),
      thieuKeyMessage:
        'Hồ sơ chưa đồng bộ — bấm "Đăng nhập cổng Dịch vụ công" rồi thử lại để xem trực tiếp.',
    });
    if (!ket.ok) return reply.status(400).send({ message: ket.message });

    // Ô cột "Tờ khai / Phụ lục" của chính hồ sơ này (vd "05/KK-TNCN") — truyền vào để chọn layout
    // theo ĐÚNG thứ người dùng thấy trên bảng, thay vì chỉ dò tiêu đề bên trong XML. Đọc thêm 1
    // query nhẹ (1 cột, khóa chính) và KHÔNG chặn luồng: thiếu thì `layChiTietToKhai` vẫn tự dò
    // `tenTKhai` như trước.
    const maMau = await DvcDongBo.layMaToKhaiDaLuu(tenantDb, maHoSo).catch(() => null);

    return reply.send(layChiTietToKhai(ket.giaTri.bytes.toString("utf8"), maMau));
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send(thanLoi(err, "Không đọc được nội dung tờ khai."));
  }
}

type DvcThongBaoQuery = DvcHoSoQuery & { idTbao?: string };

/**
 * GET /dvc/ho-so/thong-bao/file — tải file của một thông báo theo `idTbao` (cột "Thông báo").
 *
 * ĐỌC CACHE TRƯỚC (`DvcDongBo.layFileThongBaoDaLuu`); thiếu mới gọi cổng thật (cần `key`) rồi ghi
 * lại vào cache. Trả nguyên bytes + content-type, cùng quy ước với `taiFileHoSo`.
 */
export async function taiThongBao(
  request: FastifyRequest<{ Querystring: DvcThongBaoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const maHoSo = q?.maHoSo;
  const idTbao = q?.idTbao;
  if (!maHoSo || !idTbao) {
    return reply.status(400).send({ message: "Thiếu mã hồ sơ hoặc mã thông báo." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const ket = await docCacheHoacGoiCong({
      request,
      key: q.key,
      docCache: () => DvcDongBo.layFileThongBaoDaLuu(tenantDb, maHoSo, idTbao),
      goiCong: (key) => DvcService.taiThongBao(key, maHoSo, idTbao),
      ghiCache: (tep) => DvcDongBo.luuFileThongBaoVaoCache(tenantDb, maHoSo, idTbao, tep),
      thieuKeyMessage:
        'Thông báo chưa đồng bộ — bấm "Đăng nhập cổng Dịch vụ công" rồi thử lại để tải trực tiếp.',
    });
    if (!ket.ok) return reply.status(400).send({ message: ket.message });

    const tep = ket.giaTri;
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(tep.fileName)}`,
      )
      .type(tep.contentType)
      .send(tep.bytes);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send(thanLoi(err, "Tải file thông báo thất bại."));
  }
}

/**
 * GET /dvc/ho-so/thong-bao — danh sách thông báo của một hồ sơ (cột "Thông báo").
 *
 * ĐỌC CACHE TRƯỚC (`DvcDongBo.layDanhSachThongBaoDaLuu` — `null` nghĩa là "chưa chắc", không phải
 * "rỗng"); chỉ khi đó mới gọi cổng thật (cần `key`), rồi ghi lại METADATA vào cache. Trả mảng đã
 * bóc sẵn (`ThongBaoDaBoc`) — cùng quy ước với `traCuuHoSo`: BE bóc HTML, controller không đẩy
 * markup thô ra FE.
 */
export async function danhSachThongBao(
  request: FastifyRequest<{ Querystring: DvcHoSoQuery }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const maHoSo = q?.maHoSo;
  if (!maHoSo) {
    return reply.status(400).send({ message: "Thiếu mã hồ sơ." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const ket = await docCacheHoacGoiCong({
      request,
      key: q.key,
      docCache: () => DvcDongBo.layDanhSachThongBaoDaLuu(tenantDb, maHoSo),
      goiCong: (key) => DvcService.layDanhSachThongBao(key, maHoSo),
      ghiCache: (ds) => DvcDongBo.luuMetaThongBaoVaoCache(tenantDb, maHoSo, ds),
      thieuKeyMessage:
        'Hồ sơ chưa đồng bộ — bấm "Đăng nhập cổng Dịch vụ công" rồi thử lại để xem trực tiếp.',
    });
    if (!ket.ok) return reply.status(400).send({ message: ket.message });
    return reply.send(ket.giaTri);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send(thanLoi(err, "Không lấy được danh sách thông báo."));
  }
}
