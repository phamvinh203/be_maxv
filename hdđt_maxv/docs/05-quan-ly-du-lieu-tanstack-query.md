# 05 — Quản lý dữ liệu máy chủ (TanStack Query)

Dự án dùng TanStack Query v5 theo **kiểu cổ điển** — `useQuery` / `useMutation`, không dùng Suspense.

## 5.1. Cấu hình chung

```ts
// src/lib/queryClient.ts
/**
 * QueryClient dùng chung cho toàn app.
 * - staleTime 30s: dữ liệu coi là "tươi" trong 30s, tránh refetch dồn khi đổi tab/nhả focus.
 * - retry 1: lỗi API thường là lỗi nghiệp vụ (401/403/400), không nên retry nhiều lần.
 * - refetchOnWindowFocus false: tránh gọi lại API mỗi lần chuyển cửa sổ (nhất là API GDT).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

`refetchOnWindowFocus: false` quan trọng hơn vẻ ngoài của nó. Mặc định TanStack Query nạp lại mọi query mỗi khi cửa sổ lấy lại tiêu điểm. Với ứng dụng này, người dùng thường xuyên chuyển sang cửa sổ khác trong lúc chờ một lượt đồng bộ dài — nếu bật, mỗi lần quay lại sẽ kéo lại toàn bộ bảng hàng nghìn dòng một cách vô ích.

`queryClient` được export như một **biến module** chứ không tạo bên trong component. Lý do: `AuthContext` cần gọi `queryClient.clear()` và `queryClient.fetchQuery()` bên ngoài cây React.

## 5.2. Quy ước `queryKey` — phần quan trọng nhất

**Mọi query đọc dữ liệu thuộc về một công ty đều PHẢI gắn `currentCompanyId` vào key.**

Lý do nằm ở kiến trúc: hóa đơn của mỗi công ty nằm trong database riêng, nhưng URL endpoint thì **giống hệt nhau** — backend chọn database dựa vào JWT chứ không dựa vào path. Nghĩa là `GET /gdt/invoices/purchase/saved?tuNgay=…` cho công ty A và công ty B là **cùng một URL**. Nếu key không gắn công ty, TanStack Query coi hai lời gọi là một và trả dữ liệu công ty A cho màn hình công ty B.

### Mẫu khai báo key

Mỗi module dữ liệu khai báo một object `*Keys` gom toàn bộ key ở một chỗ:

```ts
// src/features/hddt/api/invoiceQueries.ts
// Khóa gắn `companyId` (công ty đang chọn) vì hóa đơn nằm ở DB riêng của từng tenant —
// đổi công ty đổi key -> tự fetch đúng dữ liệu, không rò dữ liệu công ty cũ.
export const invoiceKeys = {
  /** Prefix mọi query hóa đơn đã lưu của 1 công ty. */
  byCompany: (companyId: string | null) => ["savedInvoices", companyId] as const,
  /** Prefix để invalidate mọi query đã lưu của 1 chiều (bất kể bộ lọc). */
  savedByDirection: (companyId: string | null, direction: InvoiceDirection) =>
    ["savedInvoices", companyId, direction] as const,
  /** Key đầy đủ cho 1 lần đọc DB (công ty + chiều + bộ lọc đã áp dụng). */
  saved: (companyId: string | null, direction: InvoiceDirection, query: InvoiceQuery) =>
    ["savedInvoices", companyId, direction, query] as const,
};
```

Ba hàm này tạo thành **cấu trúc phân cấp**, và đó là chủ ý:

```
["savedInvoices", companyId]                          ← byCompany
["savedInvoices", companyId, direction]               ← savedByDirection
["savedInvoices", companyId, direction, query]        ← saved
```

TanStack Query so khớp key theo **tiền tố**. Nên:

- `invalidateQueries({ queryKey: invoiceKeys.byCompany(id) })` → làm mới **mọi** query hóa đơn của công ty đó, cả hai chiều, mọi bộ lọc.
- `invalidateQueries({ queryKey: invoiceKeys.savedByDirection(id, "purchase") })` → chỉ chiều mua vào.

Đây là lý do thứ tự phần tử trong key phải đi **từ rộng đến hẹp**. Nếu đặt `["savedInvoices", direction, companyId, query]` thì không còn cách nào làm mới toàn bộ dữ liệu của một công ty bằng một lời gọi.

### Bảng toàn bộ key trong dự án

| Module | Key | Gắn companyId? |
|---|---|:--:|
| `companyApi.ts` | `["companies", userId]` | Gắn **userId** |
| `invoiceQueries.ts` | `["savedInvoices", companyId, direction, query]` | ✔ |
| `invoiceDetailQueries.ts` | `["savedDetails", companyId, direction, query]` | ✔ |
| | `["savedDetail", companyId, direction, id]` | ✔ |
| | `["detailComplete", companyId, direction, query]` | ✔ |
| `syncQueries.ts` | `["syncHistory", companyId]` | ✔ |
| `statsQueries.ts` | `["systemStats", companyId]` | ✔ |
| `taxPayerQueries.ts` | `["tax-payer", mst]` | ✖ — dữ liệu công cộng |
| `dialogLoginHddt.tsx` | `["gdtCaptcha", captchaId]` | ✖ — phiên tạm |

Danh sách công ty gắn `userId` thay vì `companyId` vì nó là danh sách **xuyên công ty**:

```ts
export const companyKeys = {
  /** Gắn userId để danh sách không rò giữa các phiên đăng nhập khác nhau. */
  list: (userId: string | undefined) => ["companies", userId] as const,
};
```

## 5.3. Mẫu hook query chuẩn

```ts
export function useSavedInvoicesQuery(
  direction: InvoiceDirection,
  query: InvoiceQuery,
  enabled: boolean,
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.saved(currentCompanyId, direction, query),
    queryFn: () => getSavedInvoices(direction, query),
    enabled:
      enabled && isAuthenticated && !!currentCompanyId && !!query.tuNgay && !!query.denNgay,
  });
}
```

Điều kiện `enabled` gồm bốn phần, mỗi phần chặn một lỗi cụ thể:

| Điều kiện | Chặn lỗi gì |
|---|---|
| `enabled` (tham số) | Tab đang ẩn vẫn gọi API |
| `isAuthenticated` | Gọi API khi chưa đăng nhập → nhận 401 vô ích lúc mở trang |
| `!!currentCompanyId` | Backend trả 403 vì JWT chưa có `donViId` |
| `!!query.tuNgay && !!query.denNgay` | Gọi endpoint thiếu tham số bắt buộc → 400 |

**Quy ước: luôn kiểm tra đủ cả bốn.** Bỏ sót một cái thì lỗi chỉ xuất hiện ở tình huống hiếm và rất khó lần ra.

Tham số `enabled` từ bên ngoài chính là cách hoãn nạp cho tab ẩn:

```tsx
// InvoiceTablePanel
const savedQuery = useSavedInvoicesQuery(direction, buildQuery(appliedFilters), active);

// Chi tiết chỉ nạp khi tab "Chi tiết" đang mở (dữ liệu nặng, khỏi tốn request khi chưa xem).
const savedDetailsQuery = useSavedDetailsQuery(
  direction,
  buildQuery(appliedFilters),
  active && resultTab === "chi-tiet",
);
```

Cả hai panel (mua vào và bán ra) đều được mount, nhưng chỉ panel đang xem mới gọi API — vì `active` là `false` ở panel kia.

## 5.4. `staleTime` riêng cho dữ liệu nặng

Chi tiết hóa đơn là một khối JSON lớn cho mỗi hóa đơn. Query này ghi đè `staleTime` mặc định:

```ts
return useQuery({
  queryKey: detailKeys.saved(currentCompanyId, direction, query),
  queryFn: () => getSavedDetails(direction, query),
  enabled: /* … */,
  // Payload chi tiết nặng (1 blob JSON/hóa đơn, không giới hạn số dòng nên khoảng ngày rộng
  // sẽ rất nặng) — giữ cache 5 phút để đổi qua lại tab không phải tải lại.
  // Sau khi tải chi tiết xong đã invalidate detailKeys.byDirection nên vẫn luôn mới khi cần.
  staleTime: 5 * 60 * 1000,
});
```

Câu cuối của comment là mấu chốt: `staleTime` dài **không** làm dữ liệu cũ, vì khi có dữ liệu mới thật (vừa tải chi tiết xong) thì code chủ động gọi `invalidateQueries`. `staleTime` chỉ quyết định *có tự động nạp lại hay không*, còn `invalidateQueries` thì luôn thắng.

Trường hợp ngược lại — ép lấy mới bất chấp `staleTime` — dùng cho tra cứu MST:

```ts
export function useTaxPayerQuery(mst: string, enabled: boolean) {
  return useQuery({
    queryKey: ["tax-payer", mst],
    queryFn: () => getTaxPayer(mst),
    enabled: enabled && MST_LOOKUP_REGEX.test(mst),
    retry: false,
    staleTime: Infinity,
  });
}
```

Với lý do:

> - `retry: false`: 404 (MST không tồn tại) và 429 (quá nhanh) đều retry vô nghĩa, mà còn đốt thêm hạn mức 10 lần/30s của API.
> - `staleTime: Infinity`: thông tin đăng ký thuế gần như không đổi trong một phiên, nên gõ lại MST đã tra thì lấy luôn từ cache, không bắn request mới.

## 5.5. Gom logic làm mới vào một chỗ

Sau khi đồng bộ hoặc xóa dữ liệu, **ba** nhóm query cần làm mới: lịch sử đồng bộ, bảng hóa đơn, thống kê. Nếu mỗi nơi tự viết ba lời gọi thì sớm muộn cũng có chỗ quên một cái.

```ts
// src/features/hddt/api/syncQueries.ts
/**
 * Invalidate mọi query phụ thuộc dữ liệu hóa đơn của 1 tenant (lịch sử + bảng hóa đơn + thống kê).
 * Gọi sau khi đồng bộ/xóa để các nơi đang xem tự cập nhật. Gom 1 chỗ để 2 mutation không lệch nhau.
 */
function invalidateTenantInvoiceData(qc: QueryClient, companyId: string | null): void {
  qc.invalidateQueries({ queryKey: syncKeys.history(companyId) });
  qc.invalidateQueries({ queryKey: invoiceKeys.byCompany(companyId) });
  qc.invalidateQueries({ queryKey: statsKeys.system(companyId) });
}
```

Hàm này được dùng bởi hai đường: mutation xóa dữ liệu (`onSuccess`), và vòng poll đồng bộ (qua hook `useInvalidateTenantInvoiceData`).

Chú ý dòng giữa dùng `invoiceKeys.byCompany` — prefix rộng nhất — để phủ cả hai chiều và mọi bộ lọc trong một lời gọi. Đây là ích lợi trực tiếp của cấu trúc key phân cấp ở mục 5.2.

## 5.6. Mutation

Mẫu chuẩn: `mutationFn` + `onSuccess` invalidate.

```ts
export function useClearSyncMutation() {
  const { currentCompanyId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearSyncData(),
    onSuccess: () => invalidateTenantInvoiceData(qc, currentCompanyId),
  });
}
```

Nhưng có mutation **cố ý không** invalidate:

```ts
/**
 * Bắt đầu lượt đồng bộ CHẠY NỀN ở BE — trả tiến độ ngay, KHÔNG chờ hết lượt (xem `startSyncRun`).
 * Không invalidate ở `onSuccess` vì lúc này lượt mới bắt đầu, chưa có dữ liệu gì mới; nơi gọi tự
 * invalidate khi poll thấy lượt kết thúc.
 */
export function useStartSyncRunMutation() {
  return useMutation({
    mutationFn: (vars: { gdtToken: string; body: SyncRequest }) =>
      startSyncRun(vars.gdtToken, vars.body),
  });
}
```

Đây là hệ quả của kiến trúc chạy nền: request `POST` chỉ **khởi động** lượt và trả về sau khoảng 50ms. Lúc đó chưa có hóa đơn nào được lưu, invalidate là vô nghĩa. Việc làm mới thuộc về vòng poll. Xem [chương 8](08-tac-vu-nen-va-poll.md).

Xử lý lỗi mutation ở nơi gọi, không ở trong hook:

```tsx
clearMutation.mutate(undefined, {
  onSuccess: () => setConfirmClear(false),
  onError: (e) => setError(getErrorMessage(e, "Không xóa được dữ liệu đã đồng bộ.")),
});
```

Lý do: cùng một mutation được dùng ở hai nơi (dialog Đồng bộ và tab Dữ liệu hệ thống) với cách hiển thị lỗi khác nhau.

## 5.7. Một entry cache, hai người xem

Danh sách công ty hiển thị ở hai nơi: menu chọn công ty trên thanh header (đọc từ `AuthContext.companies`) và bảng ở tab Quản lý công ty (đọc từ `useCompaniesQuery`). Trước đây mỗi lần thêm/sửa/xóa công ty, cả hai cùng nạp lại → **hai** lời gọi `GET /companies`.

Cách giải quyết là cho `AuthContext` ghi vào **đúng entry cache** mà `useCompaniesQuery` đang quan sát:

```tsx
/**
 * Nạp lại danh sách công ty QUA cache của TanStack Query thay vì gọi thẳng `listCompanies`:
 * `useCompaniesQuery` (tab Quản lý công ty) quan sát đúng key này, nên một lượt fetch phục vụ
 * cả header lẫn bảng — trước đây mỗi lần thêm/sửa/xóa gọi `GET /companies` hai lần.
 * `staleTime: 0` để ép lấy mới: mặc định toàn app là 30s, mà đây luôn chạy ngay sau một lượt ghi.
 */
const refreshCompanies = useCallback(async () => {
  setCompanies(
    await queryClient.fetchQuery({
      queryKey: companyKeys.list(user?.id),
      queryFn: listCompanies,
      staleTime: 0,
    }),
  );
}, [user?.id]);
```

Đây là lý do `companyKeys` được đặt trong `companyApi.ts` chứ không phải `companyQueries.ts` — cả `AuthContext` lẫn hook query đều phải dựng đúng cùng một key, nên key phải nằm ở tầng thấp hơn cả hai.

`fetchQuery` khác `invalidateQueries` ở chỗ nó **trả về dữ liệu**, nên `AuthContext` vừa cập nhật cache vừa cập nhật state của mình trong một lượt.

## 5.8. Xóa cache khi đổi phiên

```tsx
const login = useCallback(async (email: string, password: string) => {
  const data = await loginApi(email, password); // server đặt cookie access + refresh
  queryClient.clear(); // xóa cache của phiên trước (nếu có)
  setUser(data.user);
  /* … */
}, []);

// Xóa sạch phiên phía client (cache + state). Dùng cho cả logout chủ động lẫn hết phiên bị động.
const resetSession = useCallback(() => {
  queryClient.clear();
  setUser(null);
  setCompanies([]);
  setCurrentCompanyId(null);
}, []);
```

`queryClient.clear()` xóa **toàn bộ** cache. Bắt buộc phải có: nếu người dùng A đăng xuất rồi người dùng B đăng nhập trên cùng tab, mà cache còn dữ liệu của A thì B sẽ thấy dữ liệu của A trong khoảnh khắc trước khi query mới trả về.

Chú ý khi **đổi công ty** thì **không** cần `clear()` — vì mọi key đã gắn `currentCompanyId`, đổi công ty tự động đổi key. Điều này được ghi lại trong mutation tạo công ty:

```tsx
onSuccess: async (data) => {
  // Đặt TRƯỚC `invalidate()`: mọi query theo tenant đều gắn `currentCompanyId` vào queryKey và
  // `enabled: !!currentCompanyId` (xem invoiceQueries/statsQueries/syncQueries), nên đổi id là
  // chúng tự đổi key và nạp lần đầu — không cần dọn cache thủ công.
  if (data.activeDonViId) setActiveCompany(data.activeDonViId);
  await invalidate();
},
```

## 5.9. Danh sách kiểm tra khi thêm query mới

1. Key gắn `currentCompanyId` chưa? (bắt buộc nếu đọc dữ liệu tenant)
2. Key có đi từ rộng đến hẹp để invalidate theo prefix được không?
3. `enabled` đã đủ bốn điều kiện chưa?
4. Dữ liệu nặng thì có cần `staleTime` riêng không?
5. Sau khi có mutation ghi dữ liệu này, đã thêm nó vào chỗ invalidate tương ứng chưa?

---

**Trước:** [04 — Tầng giao tiếp API](04-tang-giao-tiep-api.md) · **Tiếp theo:** [06 — Trạng thái toàn cục](06-context-toan-cuc.md)
