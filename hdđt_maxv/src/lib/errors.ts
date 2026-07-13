/**
 * Lấy `message` từ lỗi (Error) hoặc trả `fallback` — dùng chung cho Alert/onError khắp app.
 * Dùng: InvoiceListTabs, SyncInvoiceDialog, CompanyManagementTab, CompanyFormDialog, dialogLoginHddt.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
