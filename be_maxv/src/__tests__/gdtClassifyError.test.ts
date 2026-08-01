import { test } from "node:test";
import assert from "node:assert/strict";
import { GdtHttpError } from "../config/gdt-client";
import {
  classifyGdtError,
  isBodyTerminated,
  isMissingOriginalFile,
} from "../services/client/hddt/gdt.service";

/**
 * Phân loại lỗi GDT — quyết định retry hay dừng lượt.
 *   npx tsx --test src/__tests__/gdtClassifyError.test.ts
 */

const httpErr = (status: number, elapsedMs: number) =>
  new GdtHttpError(status, "Test", "{}", elapsedMs);

test("401/403 -> auth (token hết hạn, KHÔNG được đánh lỗi giả cho hóa đơn)", () => {
  assert.equal(classifyGdtError(httpErr(401, 50)), "auth");
  assert.equal(classifyGdtError(httpErr(403, 5000)), "auth");
});

test("429 -> transient dù nhanh hay chậm (rate-limit luôn đáng thử lại)", () => {
  assert.equal(classifyGdtError(httpErr(429, 20)), "transient");
  assert.equal(classifyGdtError(httpErr(429, 9000)), "transient");
});

test("5xx CHẬM -> transient (GDT quá tải thật, đáng retry)", () => {
  assert.equal(classifyGdtError(httpErr(500, 4000)), "transient");
  assert.equal(classifyGdtError(httpErr(503, 1200)), "transient");
});

test("5xx NHANH -> permanent (GDT từ chối tham số, retry vô ích)", () => {
  // Chính là ca đo được khi thử size=200: 500 trả về sau 63ms.
  assert.equal(classifyGdtError(httpErr(500, 63)), "permanent");
  assert.equal(classifyGdtError(httpErr(500, 499)), "permanent");
  // Ngay trên ngưỡng thì quay lại transient — biên phải rõ ràng.
  assert.equal(classifyGdtError(httpErr(500, 500)), "transient");
});

test("4xx khác -> permanent", () => {
  assert.equal(classifyGdtError(httpErr(400, 30)), "permanent");
  assert.equal(classifyGdtError(httpErr(404, 30)), "permanent");
});

test("lỗi tầng fetch (mạng/timeout/abort) -> transient", () => {
  assert.equal(classifyGdtError(new Error("fetch failed")), "transient");
  assert.equal(classifyGdtError(new Error("The operation was aborted")), "transient");
  assert.equal(classifyGdtError(new Error("ECONNRESET")), "transient");
});

/**
 * Body bị chấm dứt giữa chừng (GDT trả header 200 rồi đóng socket). Undici ném
 * `TypeError: terminated` — `message` KHÔNG mang thông tin gì, lý do thật nằm ở `err.cause`.
 * Tái hiện được bằng server cắt socket giữa body: header về 200 sau 56ms, `.json()` ném sau 128ms
 * với cause `SocketError: other side closed` (code UND_ERR_SOCKET).
 *
 * Đây là lỗi TRUYỀN TẢI nhất thời -> phải retry. Trước đây rơi vào "permanent" nên lượt "Cập nhật"
 * dừng sau đúng 1 lần thử và FE hiện "CHƯA lấy hết: terminated".
 */
function terminatedError(causeCode: string, causeMessage: string): TypeError {
  const cause = Object.assign(new Error(causeMessage), {
    name: "SocketError",
    code: causeCode,
  });
  return new TypeError("terminated", { cause });
}

test("body bị cắt giữa chừng (undici 'terminated') -> transient", () => {
  assert.equal(
    classifyGdtError(terminatedError("UND_ERR_SOCKET", "other side closed")),
    "transient",
  );
  assert.equal(
    classifyGdtError(terminatedError("UND_ERR_BODY_TIMEOUT", "Body Timeout Error")),
    "transient",
  );
});

test("lỗi undici khác cũng đọc được qua cause (không phụ thuộc chữ 'terminated')", () => {
  assert.equal(
    classifyGdtError(new TypeError("fetch failed", { cause: new Error("read ECONNRESET") })),
    "transient",
  );
  // cause lồng 2 tầng vẫn phải lần ra được.
  const nested = new TypeError("terminated", {
    cause: new TypeError("wrapper", { cause: new Error("other side closed") }),
  });
  assert.equal(classifyGdtError(nested), "transient");
});

test("cause KHÔNG phải lỗi mạng -> vẫn permanent (đừng retry bừa)", () => {
  const badJson = new TypeError("Unexpected token", {
    cause: new Error("invalid json response"),
  });
  assert.equal(classifyGdtError(badJson), "permanent");
});

test("lưới an toàn: Error thường mang chuỗi 'GDT API Error' vẫn phân loại được", () => {
  // Trường hợp lỗi mất kiểu khi đi qua ranh giới nào đó — không có elapsedMs nên 5xx coi là transient.
  assert.equal(classifyGdtError(new Error("GDT API Error: 401 Unauthorized")), "auth");
  assert.equal(classifyGdtError(new Error("GDT API Error: 500 Internal")), "transient");
  assert.equal(classifyGdtError(new Error("GDT API Error: 400 Bad Request")), "permanent");
});

/**
 * `isBodyTerminated` tách riêng ca "trang quá to" khỏi các lỗi transient khác: retry y hệt thì hỏng
 * y hệt (đo được 35 lần liên tiếp ở size=50), phải HẠ SIZE mới qua. Nhận nhầm ở đây thì hoặc là hạ
 * size vô cớ (chậm gấp nhiều lần), hoặc là bỏ lỡ và lượt chết dù chỉ cần xin ít dòng hơn.
 */
test("isBodyTerminated: đúng ca GDT cắt body -> true", () => {
  assert.equal(isBodyTerminated(terminatedError("UND_ERR_SOCKET", "other side closed")), true);
  assert.equal(isBodyTerminated(new Error("read ECONNRESET")), true);
});

test("isBodyTerminated: timeout/429/5xx KHÔNG phải ca này -> false (đừng hạ size vô cớ)", () => {
  assert.equal(isBodyTerminated(httpErr(429, 20)), false);
  assert.equal(isBodyTerminated(httpErr(500, 4000)), false);
  assert.equal(
    isBodyTerminated(new Error("The operation was aborted due to timeout")),
    false,
  );
  assert.equal(isBodyTerminated(new Error("fetch failed")), false);
});

/**
 * "Không tồn tại hồ sơ gốc của hóa đơn" — KHÔNG PHẢI SỰ CỐ, mà là câu trả lời đúng của cổng thuế.
 *
 * Bối cảnh (bug thật, 31/07/2026 — lượt xuất báo "Vẫn thiếu: 1 XML" kèm nguyên chuỗi JSON 500):
 *   GET /invoices/export-xml?nbmst=0100109106&khhdon=K26TVB&shdon=2479932 -> 500 sau 384ms
 *   {"message":"Không tồn tại hồ sơ gốc của hóa đơn."}
 *
 * Hóa đơn đó trong payload danh sách có `hsgoc: null` (id hồ sơ gốc), `hthdon: 2`, và cả
 * `nky`/`nbcks`/`cqtcks`/`mhdon` đều null — tức hóa đơn được gửi cơ quan thuế qua BẢNG TỔNG HỢP
 * DỮ LIỆU chứ không phải hóa đơn điện tử có file XML ký số. Nó VĨNH VIỄN không có XML để tải.
 *
 * Tách riêng khỏi "permanent" thường: permanent chỉ nói "đừng thử lại", còn ca này phải đi xa hơn —
 * không được đếm vào số hóa đơn LỖI, vì chẳng có gì hỏng để người dùng đi sửa.
 */
const missingFileErr = (elapsedMs = 384) =>
  new GdtHttpError(
    500,
    "Internal Server Error",
    '{"timestamp":"31/07/2026 13:59:24","message":"Không tồn tại hồ sơ gốc của hóa đơn.","details":"","path":"uri=/invoices/export-xml"}',
    elapsedMs,
  );

test("isMissingOriginalFile: đúng ca GDT báo không có hồ sơ gốc -> true", () => {
  assert.equal(isMissingOriginalFile(missingFileErr()), true);
  // Lỗi mất kiểu khi đi qua ranh giới vẫn phải nhận ra (chỉ còn chuỗi message).
  assert.equal(
    isMissingOriginalFile(new Error("GDT API Error: 500 ... Không tồn tại hồ sơ gốc của hóa đơn.")),
    true,
  );
});

test("isMissingOriginalFile: không phụ thuộc dấu tiếng Việt và chữ hoa/thường", () => {
  assert.equal(
    isMissingOriginalFile(new Error("KHONG TON TAI HO SO GOC CUA HOA DON")),
    true,
  );
});

test("isMissingOriginalFile: lỗi khác -> false (đừng nuốt lỗi thật thành 'không có file')", () => {
  assert.equal(isMissingOriginalFile(httpErr(500, 4000)), false);
  assert.equal(isMissingOriginalFile(httpErr(401, 50)), false);
  assert.equal(isMissingOriginalFile(new Error("fetch failed")), false);
  // Chữ "hồ sơ" trong một thông điệp khác hẳn thì KHÔNG được nhận nhầm.
  assert.equal(isMissingOriginalFile(new Error("Hồ sơ đang được xử lý, vui lòng đợi")), false);
});

test("ca không có hồ sơ gốc vẫn là permanent (retry vô ích)", () => {
  assert.equal(classifyGdtError(missingFileErr()), "permanent");
});

/**
 * BẪY (sự cố 01/08/2026): `classifyGdtError` chỉ nhìn status + thời gian, nên một 500 "không có hồ
 * sơ gốc" trả về CHẬM (đo thực tế 635ms và 1085ms) bị xếp nhầm thành "transient" — y hệt GDT quá
 * tải thật. Test 384ms ở trên qua được chỉ vì TÌNH CỜ nhanh hơn ngưỡng FAST_5XX_PERMANENT_MS.
 *
 * Hệ quả nếu để lọt: vòng retry `getInvoiceOriginalXmlPaced` retry vô nghĩa (hóa đơn này vĩnh viễn
 * không có XML) + mỗi lần fail gọi `pacerReportRateLimited` nhân đôi nhịp làn xml tới trần 15s ->
 * mọi hóa đơn khỏe khác chết đói trong hàng đợi -> "Hết ngân sách trước khi tới lượt" -> 502.
 *
 * Vì vậy vòng retry PHẢI chặn bằng `isMissingOriginalFile` TRƯỚC, không được dựa vào `classifyGdtError`.
 * Test này khóa cả hai vế: classify nhầm "transient", nhưng `isMissingOriginalFile` vẫn nhận ra.
 */
test("500 'không có hồ sơ gốc' CHẬM: classify nhầm 'transient' -> phải chặn bằng isMissingOriginalFile", () => {
  for (const elapsedMs of [635, 1085]) {
    assert.equal(classifyGdtError(missingFileErr(elapsedMs)), "transient");
    assert.equal(isMissingOriginalFile(missingFileErr(elapsedMs)), true);
  }
});

test("lỗi lạ hoàn toàn -> permanent (đừng retry thứ không hiểu)", () => {
  assert.equal(classifyGdtError(new Error("chuyện gì đó khác")), "permanent");
  assert.equal(classifyGdtError("không phải Error"), "permanent");
});
