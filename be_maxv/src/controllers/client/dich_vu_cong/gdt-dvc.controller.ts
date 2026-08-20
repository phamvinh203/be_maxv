import { FastifyReply, FastifyRequest } from "fastify";
import * as DvcService from "../../../services/client/dich_vu_cong/gdt-dvc.service";
import * as DvcDongBo from "../../../services/client/dich_vu_cong/dvc-dong-bo.service";
import { sysPrisma } from "../../../config/db.sys";
import { accessibleDonViWhere } from "../../../helpers/access";
import { resolveTenantDb } from "../../../helpers/resolveTenantDb";
// Dùng lại module crypto của HĐĐT: file đó CỐ Ý không đụng Prisma/HĐĐT gì (chỉ AES-256-GCM
// thuần trên chuỗi), nên tái dùng được cho cột `dvcPassword*` mà không cần chép lại.
import { decryptGdtPassword, encryptGdtPassword } from "../../../services/client/hddt/gdtCredential";
import { layChiTietToKhai } from "../../../services/client/dich_vu_cong/toKhaiXml";

type KetQuaDocCache<T> = { ok: true; giaTri: T } | { ok: false; message: string };

/**
 * Khung dùng chung cho `taiFileHoSo`/`taiThongBao`/`danhSachThongBao`: đọc cache trong DB tenant
 * trước, thiếu mới đòi `key` để gọi cổng thật rồi ghi lại vào cache. Trả kết quả có gắn cờ `ok`
 * thay vì tự `reply` hay ném lỗi — case "thiếu key" là luồng BÌNH THƯỜNG (chưa đăng nhập cổng),
 * không phải lỗi bất ngờ, nên không đi qua `catch`/`request.log.error` của handler.
 */
async function docCacheHoacGoiCong<T>(opts: {
  key: string | undefined;
  docCache: () => Promise<T | null>;
  goiCong: (key: string) => Promise<T>;
  ghiCache: (giaTri: T) => Promise<void>;
  thieuKeyMessage: string;
}): Promise<KetQuaDocCache<T>> {
  const daLuu = await opts.docCache();
  if (daLuu !== null) return { ok: true, giaTri: daLuu };

  if (!opts.key) return { ok: false, message: opts.thieuKeyMessage };

  const giaTri = await opts.goiCong(opts.key);
  await opts.ghiCache(giaTri);
  return { ok: true, giaTri };
}

/**
 * GET /dvc/captcha — mở một phiên mới với cổng Dịch vụ công và trả ảnh captcha.
 *
 * Trả `{ key, image }`: `key` là khóa phiên FE phải gửi lại khi đăng nhập, `image` là
 * data-URL gắn thẳng vào `<img src>`.
 */
export async function captcha(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await DvcService.getCaptcha();
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({
      message: DvcService.toUserMessage(err, "Không lấy được mã captcha của cổng Dịch vụ công."),
    });
  }
}

/**
 * GET /dvc/tchs/captcha?key=... — lấy ảnh captcha và tự động giải OCR cho form tra cứu hồ sơ /tthc/tchs.
 */
export async function tchsCaptcha(
  request: FastifyRequest<{ Querystring: { key?: string } }>,
  reply: FastifyReply,
) {
  const key = request.query?.key;
  if (!key) {
    return reply.status(400).send({ message: "Thiếu khóa phiên key." });
  }

  try {
    const result = await DvcService.getTchsCaptcha(key);
    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({
      message: DvcService.toUserMessage(err, "Không lấy được mã captcha tra cứu hồ sơ."),
    });
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
async function activeCompanyForDvc(request: FastifyRequest): Promise<{
  id: string;
  maSoThue: string;
  dvcUsername: string | null;
  dvcPasswordCipher: string | null;
  dvcPasswordIv: string | null;
  dvcPasswordTag: string | null;
} | null> {
  const donViId = request.user?.donViId;
  if (!donViId) return null;
  const scope = accessibleDonViWhere(request.user.userId, request.user.role);
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
  const active = await activeCompanyForDvc(request);
  const password =
    active?.dvcPasswordCipher && active.dvcPasswordIv && active.dvcPasswordTag
      ? decryptGdtPassword({
          cipher: active.dvcPasswordCipher,
          iv: active.dvcPasswordIv,
          tag: active.dvcPasswordTag,
        })
      : null;
  return reply.send({ username: active?.dvcUsername ?? null, password });
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

  try {
    const result = await DvcService.login({
      key: body.key,
      tenDN: body.tenDN,
      matKhau: body.matKhau,
      captcha: body.captcha,
    });

    // Guard theo MST rút từ `tenDN`: chỉ CHẶN lưu khi rõ ràng thuộc MST KHÁC công ty đang chọn
    // (tránh ghi đè nhầm mật khẩu công ty khác lên công ty đang chọn — người dùng có thể tự sửa
    // ô tên đăng nhập trước khi bấm). Không rõ quy ước (`mstTuTen === null`) thì vẫn lưu, vì tên
    // đăng nhập cổng DVC không đảm bảo luôn đúng "<MST>-ql". Lỗi lưu KHÔNG làm hỏng đăng nhập
    // (kết quả đã có trong tay), chỉ là lần sau không dùng lại được.
    const active = await activeCompanyForDvc(request);
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
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Đăng nhập cổng Dịch vụ công thất bại."),
    });
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
 * ĐÃ đăng nhập), lưu hồ sơ + tài liệu vào DB tenant, trả về dòng lịch sử vừa ghi.
 */
export async function dongBo(
  request: FastifyRequest<{ Body: { key?: string; tuNgay?: string; denNgay?: string } }>,
  reply: FastifyReply,
) {
  const body = request.body;
  if (!body?.key || !body?.tuNgay || !body?.denNgay) {
    return reply.status(400).send({ message: "Thiếu khóa phiên hoặc khoảng ngày đồng bộ." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const log = await DvcDongBo.dongBoHoSo(tenantDb, {
      dvcKey: body.key,
      tuNgay: body.tuNgay,
      denNgay: body.denNgay,
    });
    // TODO(tạm): CHỈ để debug xem auto-relogin có chạy không — xóa dòng dưới + field
    // `_tuDongDangNhapLai` bên FE khi hết cần theo dõi.
    return reply.send({ ...log, _tuDongDangNhapLai: DvcService.laVuaTuDongDangNhapLai(body.key) });
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Đồng bộ dữ liệu Dịch vụ công thất bại."),
    });
  }
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
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Tải file hồ sơ thất bại."),
    });
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

  try {
    const data = await DvcService.layTaiLieuDinhKem(q.key, q.maHoSo);
    return reply.send(data);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Không lấy được danh sách tài liệu đính kèm."),
    });
  }
}

/**
 * GET /dvc/ho-so/to-khai-chi-tiet — chỉ tiêu tờ khai đã bóc từ XML (dialog "Xem tờ khai" khi bấm
 * cột "Tên thủ tục hành chính"). CÙNG cơ chế đọc-cache-trước như `taiFileHoSo` (đọc `dvc_ho_so`
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
      key: q.key,
      docCache: () => DvcDongBo.layFileHoSoDaLuu(tenantDb, maHoSo),
      goiCong: (key) => DvcService.taiXmlHoSo(key, maHoSo),
      ghiCache: (tep) => DvcDongBo.luuFileHoSoVaoCache(tenantDb, maHoSo, tep),
      thieuKeyMessage:
        'Hồ sơ chưa đồng bộ — bấm "Đăng nhập cổng Dịch vụ công" rồi thử lại để xem trực tiếp.',
    });
    if (!ket.ok) return reply.status(400).send({ message: ket.message });

    return reply.send(layChiTietToKhai(ket.giaTri.bytes.toString("utf8")));
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Không đọc được nội dung tờ khai."),
    });
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
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Tải file thông báo thất bại."),
    });
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
    return reply.status(400).send({
      message: DvcService.toUserMessage(err, "Không lấy được danh sách thông báo."),
    });
  }
}
