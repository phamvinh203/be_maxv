import { randomUUID } from "crypto";
import {
  clearCookies,
  gdtFetch,
  renameCookies,
} from "../../../config/gdt-client";
import {
  CaptchaResponse,
  LoginRequest,
  LoginResponse,
  PurchaseInvoiceQuery,
  PurchaseInvoiceResponse,
  SoldInvoiceQuery,
  SoldInvoiceResponse,
} from "../../../types/gdt";

/** "yyyy-MM-dd" (input FE) -> "dd/MM/yyyy" (định dạng GDT yêu cầu trong tham số `search`). */
function toGdtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Lấy captcha + giữ lại cookie session mà GDT set.
 * Vì `key` chỉ biết sau khi nhận response, nên tạm thu thập cookie
 * dưới một tmp-key rồi re-key sang captcha.key thật (frontend sẽ gửi
 * key này lại khi login).
 */
export async function getCaptcha() {
  const tmpKey = randomUUID();
  const captcha = await gdtFetch<CaptchaResponse>("/captcha", {
    captureCookies: true,
    cookieKey: tmpKey,
  });

  renameCookies(tmpKey, captcha.key);

  return captcha;
}

/**
 * Đăng nhập HĐĐT (MST + mật khẩu + captcha).
 * Body khớp API GDT: username / password / cvalue / ckey.
 */
export async function login(body: LoginRequest) {
  const result = await gdtFetch<LoginResponse>(
    "/security-taxpayer/authenticate",
    {
      method: "POST",
      cookieKey: body.key, // gửi cookie của session đã tạo captcha
      body: JSON.stringify({
        username: body.mst,
        password: body.password,
        cvalue: body.captcha,
        ckey: body.key,
      }),
    }
  );

  // GDT trả 200 kèm `message` (không có token) khi sai captcha/thông tin
  if (!result.token) {
    clearCookies(body.key);
    throw new Error(result.message ?? "Đăng nhập thất bại");
  }

  // giữ session cookie cho các API sau login, re-key sang token
  renameCookies(body.key, result.token);

  return result;
}

/**
 * Lấy danh sách hóa đơn đầu vào (mua vào) — tương đương bước đầu của
 * `ConvertInput` bên bản C# (chỉ gọi API lấy danh sách, chưa lưu DB/tải chi tiết).
 */
export async function getPurchaseInvoices(
  token: string,
  query: PurchaseInvoiceQuery
) {
  const isMayTinhTien = query.ketQuaHd === "8";
  const path = isMayTinhTien
    ? "/sco-query/invoices/purchase"
    : "/query/invoices/purchase";

  const search = [
    `tdlap=ge=${toGdtDate(query.tuNgay)}T00:00:00`,
    `tdlap=le=${toGdtDate(query.denNgay)}T23:59:59`,
    query.trangThaiHd && `tthai==${query.trangThaiHd}`,
    query.ketQuaHd && `ttxly==${query.ketQuaHd}`,
    query.mstNguoiBan && `nbmst==${query.mstNguoiBan}`,
    query.mauHd && `khmshdon==${query.mauHd}`,
    query.soSeri && `khhdon==${query.soSeri}`,
    query.soHd && `shdon==${query.soHd}`,
  ]
    .filter(Boolean)
    .join(";");

  const params = new URLSearchParams({ sort: "tdlap:desc", size: "50", search });
  if (query.state) params.set("state", query.state);

  return gdtFetch<PurchaseInvoiceResponse>(`${path}?${params.toString()}`, {
    bearerToken: token,
  });
}

/**
 * Lấy danh sách hóa đơn đầu ra (bán ra) — tương đương bước đầu của
 * `ConvertOutput` bên bản C# (chỉ gọi API lấy danh sách, chưa lưu DB/tải chi tiết).
 */
export async function getSoldInvoices(token: string, query: SoldInvoiceQuery) {
  const isMayTinhTien = query.ketQuaHd === "8";
  const path = isMayTinhTien
    ? "/sco-query/invoices/sold"
    : "/query/invoices/sold";

  const search = [
    `tdlap=ge=${toGdtDate(query.tuNgay)}T00:00:00`,
    `tdlap=le=${toGdtDate(query.denNgay)}T23:59:59`,
    query.trangThaiHd && `tthai==${query.trangThaiHd}`,
    query.ketQuaHd && `ttxly==${query.ketQuaHd}`,
    query.mstNguoiMua && `nmmst==${query.mstNguoiMua}`,
    query.mauHd && `khmshdon==${query.mauHd}`,
    query.soSeri && `khhdon==${query.soSeri}`,
    query.soHd && `shdon==${query.soHd}`,
  ]
    .filter(Boolean)
    .join(";");

  const params = new URLSearchParams({ sort: "tdlap:desc", size: "50", search });
  if (query.state) params.set("state", query.state);

  return gdtFetch<SoldInvoiceResponse>(`${path}?${params.toString()}`, {
    bearerToken: token,
  });
}
