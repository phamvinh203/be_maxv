/**
 * Lấy `message` từ lỗi (Error) hoặc trả `fallback` — dùng chung cho Alert/onError khắp app.
 * Dùng: InvoiceListTabs, SyncInvoiceDialog, CompanyManagementTab, CompanyFormDialog, dialogLoginHddt.
 *
 * RVW-TK-007: `fetch()` ném `TypeError` nguyên văn "Failed to fetch" khi mất mạng/BE sập —
 * không phải lỗi nghiệp vụ (ApiError đã có message tiếng Việt từ BE), nên đổi thành thông
 * điệp người dùng hiểu được thay vì lộ câu tiếng Anh của trình duyệt.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  }
  return err instanceof Error ? err.message : fallback;
}
