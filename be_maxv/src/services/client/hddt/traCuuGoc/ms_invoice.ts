import { fetchUpstream, pdfFromResponse } from "./shared";
import { ProviderDownloader, TraCuuGocError } from "./types";

const MS_INVOICE_ORIGIN = "https://tracuu.myinvoice.vn";
const MS_INVOICE_BASE = `${MS_INVOICE_ORIGIN}/erp/rest/s1`;
const MS_INVOICE_TEN = "My Software";

const HEADER_INFO_HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
  referer: `${MS_INVOICE_ORIGIN}/`,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

const PDF_HEADERS: Record<string, string> = {
  accept: "application/pdf,application/octet-stream,*/*",
  referer: `${MS_INVOICE_ORIGIN}/`,
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "upgrade-insecure-requests": "1",
};

async function assertInvoiceExists(code: string): Promise<void> {
  const res = await fetchUpstream(
    `${MS_INVOICE_BASE}/iam-entry/invoices/${encodeURIComponent(code)}/header-info`,
    { headers: HEADER_INFO_HEADERS },
    MS_INVOICE_TEN,
  );

  if (res.status === 400 || res.status === 404 || res.status === 422) {
    throw new TraCuuGocError("INVALID_CODE", `My Software khong tim thay hoa don cho ma "${code}"`);
  }
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `My Software tra loi khi kiem tra hoa don (HTTP ${res.status})`);
  }

  const text = await res.text();
  if (!text.trim()) {
    throw new TraCuuGocError("INVALID_CODE", `My Software khong tra thong tin hoa don cho ma "${code}"`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new TraCuuGocError("UPSTREAM", "My Software tra header-info khong phai JSON hop le");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new TraCuuGocError("INVALID_CODE", `My Software tra thong tin hoa don khong hop le cho ma "${code}"`);
  }
}

export const msInvoice: ProviderDownloader = {
  mst: "0108971656",
  ten: MS_INVOICE_TEN,
  async download({ code }) {
    await assertInvoiceExists(code);

    const res = await fetchUpstream(
      `${MS_INVOICE_BASE}//iam-entry/invoices/${encodeURIComponent(code)}/pdf`,
      { headers: PDF_HEADERS },
      MS_INVOICE_TEN,
    );

    if (res.status === 400 || res.status === 404 || res.status === 422) {
      throw new TraCuuGocError("INVALID_CODE", `My Software khong tim thay file PDF cho ma "${code}"`);
    }
    if (!res.ok) {
      throw new TraCuuGocError("UPSTREAM", `My Software tra loi khi tai file PDF (HTTP ${res.status})`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (!/application\/(pdf|octet-stream)/i.test(contentType)) {
      throw new TraCuuGocError("INVALID_CODE", `My Software khong tra file PDF cho ma "${code}"`);
    }

    return pdfFromResponse(res, code, MS_INVOICE_TEN);
  },
};
