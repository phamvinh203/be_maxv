import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import errorHandlerPlugin from "../../plugins/errorHandler.plugin";
import { ForbiddenError, UnauthorizedError } from "../../helpers/errors";

/**
 * Route mới `GET /to-khai/hoa-don/chi-tiet` (api-contract Mục 2 / ADR-001):
 *  - rate limit `gioiHanTheoNguoiDung(20, "1 minute")` — cùng mức `/gtgt01/tinh`, KHÔNG nhiễm trần
 *    10 của `/ke-khai` (route đăng ký trước trong cùng file, xem lưu ý ở `toKhaiRouteLimits.test.ts`).
 *  - 400 đúng message khi `nam`/`kyLoai`/`kySo` hoặc `chieu` sai/thiếu — `docKy`/`docChieu` THẬT,
 *    không mock, nên đây cũng là test cho TC-044/045 (Error Matrix, api-contract Mục 2.5).
 *  - 401/403 (RVW-T08) — `authenticate` THẬT trong `taoApp` (ném `UnauthorizedError` khi thiếu
 *    `x-user`, cùng mẫu `gdtRouteBaoMat.test.ts`); `requireModule` giả nhưng có nhánh ném
 *    `ForbiddenError` khi header `x-khong-goi` có mặt — chặn hồi quy nếu ai đó sửa khai báo route mà
 *    rơi mất `preHandler: guard()`.
 *
 * Route + controller + docThamSo THẬT; chỉ service/resolveTenantDb là bản giả — giống hệt mẫu
 * `toKhaiRouteLimits.test.ts`.
 */

let toKhaiRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  const ok = async () => ({ ok: true });
  mock.module("../../controllers/client/to_khai/toKhaiGtgt01.controller", {
    namedExports: Object.fromEntries(
      ["chot", "danhSach", "doc", "luu", "luuPhuLuc", "moKhoa", "tinh", "xuatXml"].map((t) => [t, ok]),
    ),
  });
  mock.module("../../services/client/to_khai/application/keKhaiKy.service", {
    namedExports: {
      danhDauKy: async () => ({
        purchase: 0,
        sold: 0,
        khongRoKyGoc: 0,
        daGo: 0,
        daGoKhongRoKyGoc: 0,
        giuKyChot: 0,
        kyChotDangGiu: [],
      }),
      layBangKeTheoKy: async () => ({ total: 0, datas: [], thayThe: {} }),
      layBangKeChiTietTheoKy: async () => ({ total: 0, datas: [], thayThe: [] }),
      capNhatQuyetDinh: async () => {},
      locQuyetDinh: () => ({}),
    },
  });
  mock.module("../../helpers/resolveTenantDb", {
    namedExports: {
      resolveTenantDbName: async () => "db_a",
      resolveTenantDb: async () => ({}),
      resolveTenantInfo: async () => ({ dbName: "db_a", maSoThue: "0100000000", xemLuong: true }),
    },
  });
  mock.module("../../helpers/tenantClient", { namedExports: { getTenantDb: () => ({}) } });
  mock.module("../../services/shared/modules.service", {
    namedExports: {
      // Nhánh ForbiddenError CHỈ để test 403 (RVW-T08) — mọi test khác không gửi header này.
      requireModule: () => async (req: FastifyRequest) => {
        if (req.headers["x-khong-goi"]) {
          throw new ForbiddenError("Gói của bạn không có mô-đun này.");
        }
      },
    },
  });
  ({ default: toKhaiRoutes } = await import("../../routes/to_khai/toKhai.route"));
});

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  app.decorate("authenticate", async (req: FastifyRequest) => {
    const userId = req.headers["x-user"];
    if (typeof userId !== "string") throw new UnauthorizedError("Chưa đăng nhập");
    req.user = { userId, donViId: "dv-1", role: "OWNER", tokenVersion: 0 };
  });
  await app.register(toKhaiRoutes);
  await app.ready();
  return app;
}

const QS_HOP_LE = "nam=2026&kyLoai=thang&kySo=8&chieu=purchase";

test("GET /hoa-don/chi-tiet: 200, đúng hình dạng { total, datas, thayThe } khi tham số hợp lệ", async () => {
  const app = await taoApp();
  const res = await app.inject({
    method: "GET",
    url: `/hoa-don/chi-tiet?${QS_HOP_LE}`,
    headers: { "x-user": "user-x" },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { total: 0, datas: [], thayThe: [] });
  await app.close();
});

test("GET /hoa-don/chi-tiet: 400 đúng message khi kỳ sai/thiếu (TC-044)", async () => {
  const app = await taoApp();
  const res = await app.inject({
    method: "GET",
    url: "/hoa-don/chi-tiet?nam=abc&kyLoai=thang&kySo=7&chieu=purchase",
    headers: { "x-user": "user-x" },
  });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), {
    message: "Kỳ kê khai không hợp lệ (kiểm tra lại loại kỳ, số kỳ và năm).",
  });
  await app.close();
});

test("GET /hoa-don/chi-tiet: 400 đúng message khi thiếu kySo", async () => {
  const app = await taoApp();
  const res = await app.inject({
    method: "GET",
    url: "/hoa-don/chi-tiet?nam=2026&kyLoai=thang&chieu=purchase",
    headers: { "x-user": "user-x" },
  });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), {
    message: "Kỳ kê khai không hợp lệ (kiểm tra lại loại kỳ, số kỳ và năm).",
  });
  await app.close();
});

test("GET /hoa-don/chi-tiet: 400 đúng message khi chieu sai/thiếu (TC-045)", async () => {
  const app = await taoApp();
  const res = await app.inject({
    method: "GET",
    url: "/hoa-don/chi-tiet?nam=2026&kyLoai=thang&kySo=8&chieu=xyz",
    headers: { "x-user": "user-x" },
  });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), {
    message: "Chiều hóa đơn không hợp lệ (chỉ nhận purchase hoặc sold).",
  });
  await app.close();
});

test("GET /hoa-don/chi-tiet: tối đa 20 lượt/phút/người dùng, lượt 21 -> 429 (TC-048)", async () => {
  const app = await taoApp();
  const ma: number[] = [];
  for (let i = 0; i < 21; i++) {
    ma.push(
      (
        await app.inject({
          method: "GET",
          url: `/hoa-don/chi-tiet?${QS_HOP_LE}`,
          headers: { "x-user": "user-y" },
        })
      ).statusCode,
    );
  }
  assert.deepEqual(ma, [...Array(20).fill(200), 429]);
  await app.close();
});

test("GET /hoa-don/chi-tiet: không nhiễm trần 10 của /ke-khai dù đăng ký sau route đó", async () => {
  // Cùng lưu ý với /gtgt01/tinh ở toKhaiRouteLimits.test.ts: route KHÔNG có giới hạn riêng (/hoa-don)
  // không lộ lỗi lây trần vì hook toàn cục đã chạy trước — route CÓ giới hạn riêng (như /chi-tiet ở
  // đây) mới thực sự kiểm được cấu hình `...gioiHanTheoNguoiDung(...)` đúng route, không lấy nhầm
  // preHandler của /ke-khai (đăng ký trước trong cùng file).
  const app = await taoApp();
  const ma: number[] = [];
  for (let i = 0; i < 11; i++) {
    ma.push(
      (
        await app.inject({
          method: "GET",
          url: `/hoa-don/chi-tiet?${QS_HOP_LE}`,
          headers: { "x-user": "user-z" },
        })
      ).statusCode,
    );
  }
  // 11 lượt đều 200 (< trần 20) — nếu lỡ dính trần 10 của /ke-khai thì lượt thứ 11 đã là 429.
  assert.deepEqual(ma, Array(11).fill(200));
  await app.close();
});

test("GET /hoa-don/chi-tiet: chưa đăng nhập (thiếu x-user) -> 401 { success: false } (RVW-T08)", async () => {
  const app = await taoApp();
  const res = await app.inject({ method: "GET", url: `/hoa-don/chi-tiet?${QS_HOP_LE}` });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().success, false);
  await app.close();
});

test("GET /hoa-don/chi-tiet: gói không có mô-đun tokhai -> 403 { success: false } (RVW-T08)", async () => {
  const app = await taoApp();
  const res = await app.inject({
    method: "GET",
    url: `/hoa-don/chi-tiet?${QS_HOP_LE}`,
    headers: { "x-user": "user-w", "x-khong-goi": "1" },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().success, false);
  await app.close();
});
