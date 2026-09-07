---
type: adr
feature: hr
status: accepted
updated: 2026-09-05
---

# ADR-003 — Tạo Nhân viên kèm Hợp đồng đầu tiên nguyên tử (BR-hr-014, lần đầu dùng `$transaction` trong HR)

## Context

BR-hr-014 (quyết định user 2026-09-05, `hr-spec.md` Mục 7): "tạo mới một Nhân viên bắt buộc phải đi kèm tạo Hợp đồng đầu tiên trong cùng một giao dịch (all-or-nothing). Nếu dữ liệu Hợp đồng không hợp lệ hoặc thiếu trường bắt buộc, toàn bộ giao dịch bị huỷ và hệ thống KHÔNG tạo Nhân viên." Đây là lần ĐẦU TIÊN module HR cần ghi vào 2 bảng (`employees` + `contracts`) như MỘT đơn vị nguyên tử.

`hr-architecture.md` Mục 5 (bản thiết kế trước đợt tái cấu trúc này) đã kết luận: "**Không có thao tác HR nào cần multi-statement transaction** — mọi ghi dữ liệu là 1 câu lệnh SQL đơn, vốn đã atomic." Kết luận đó ĐÚNG tại thời điểm viết (Employee tự chứa toàn bộ field, kể cả field hợp đồng, nên tạo Nhân viên vẫn chỉ là 1 `INSERT`). Sau khi tách Hợp đồng thành bảng riêng, BR-hr-014 phá vỡ tiền đề đó cho ĐÚNG MỘT thao tác duy nhất: `POST /employees`. Đây KHÔNG phải mâu thuẫn với thiết kế cũ — là hệ quả tất yếu của thay đổi cấu trúc dữ liệu (A-hr-6), cần ghi nhận như một ngoại lệ có chủ đích, không đại trà hoá `$transaction` cho các thao tác khác trong module (Mục "Decision" dưới đây nêu rõ phạm vi).

Dự án đã có tiền lệ dùng `prisma.$transaction()` ở feature auth (`Backend/src/auth/token.service.ts`) — cả 2 dạng: mảng thao tác độc lập (`$transaction([...])`, dùng cho revoke session+token hàng loạt) và dạng tương tác (`$transaction(async (tx) => {...})`, dùng cho rotate refresh token — revoke cũ + tạo mới, có logic điều kiện giữa 2 bước). BR-hr-014 cần dạng THỨ HAI, vì bước 2 (tạo `Contract`) phụ thuộc kết quả bước 1 (`id` của `Employee` vừa tạo, đặc biệt khi `employeeCode` auto-gen qua `EmployeeCodeService.generateAndCreate` với retry loop).

## Decision

Dùng `prisma.$transaction(async (tx) => {...})` (dạng tương tác, đã có tiền lệ ở `token.service.ts`) bọc đúng 2 câu lệnh ghi của `EmployeesService.create()`:

```ts
return this.prisma.$transaction(async (tx) => {
  const employee = dto.employeeCode
    ? await tx.employee.create({ data: { ...employeeData, employeeCode: dto.employeeCode } })
    : await this.employeeCode.generateAndCreate((code) =>
        tx.employee.create({ data: { ...employeeData, employeeCode: code } }),
      );

  const contract = await tx.contract.create({
    data: { ...contractData, employeeId: employee.id },
  });

  return { employee, contract };
});
```

Điểm mấu chốt: **mọi validate (structural + Rule 1, cả phía Nhân viên lẫn phía Hợp đồng — `hr-api-contract.md` Mục 4.1) chạy TRƯỚC khi mở transaction.** Bên trong transaction CHỈ còn 2 lệnh ghi thuần — không có `await` nào gọi ra ngoài DB, không có logic rẽ nhánh nghiệp vụ phức tạp. Lý do: transaction Postgres giữ connection + lock trong suốt thời gian chạy; càng ngắn càng giảm rủi ro khoá tài nguyên/timeout. Các lỗi có thể dự đoán trước (thiếu field, sai định dạng, ngày không hợp lệ, lương âm, thiếu lương BHXH...) nên bị chặn TRƯỚC khi chạm DB, không phải dựa vào rollback để "dọn dẹp" sau khi đã phát hiện lỗi hiển nhiên.

**`EmployeeCodeService.generateAndCreate()` KHÔNG cần sửa đổi** — hàm này vốn đã nhận 1 callback `attempt(code)` tuỳ ý (xem ADR-001), nên gọi được với `tx.employee.create` thay vì `prisma.employee.create` mà không đổi 1 dòng code trong `EmployeeCodeService`. `nextval()` (bên trong `nextCode()`) vẫn gọi qua `this.prisma.$queryRaw` (client NGOÀI transaction) — đúng ý đồ ADR-001 rằng việc sinh số từ sequence KHÔNG cần (và không nên) nằm trong transaction (sequence vốn đã atomic tự nhiên, không rollback theo transaction, đây là hành vi ĐÃ ĐƯỢC CHẤP NHẬN từ ADR-001, không phát sinh vấn đề mới khi đặt trong ngữ cảnh transaction bao ngoài).

## Alternatives

| Phương án | Mô tả | Ưu | Nhược | Kết luận |
|---|---|---|---|---|
| **A. `$transaction(async (tx) => {...})` quanh 2 lệnh `create`, validate hết bên ngoài** ✓ | Như Decision | Tái dùng nguyên xi pattern đã có (`token.service.ts`); transaction ngắn gọn, ít rủi ro khoá; tách biệt rõ "validate" (có thể fail vì lý do nghiệp vụ, không cần DB) khỏi "ghi" (chỉ fail vì lý do hạ tầng/race) | Không có | **Chọn** |
| B. Nhét toàn bộ validate (kể cả Rule 1 cần query DB như check `departmentId`/chồng lấn) VÀO trong transaction | Đơn giản hoá code — không cần tách 2 giai đoạn | Transaction kéo dài hơn, giữ lock lâu hơn không cần thiết cho các bước chỉ ĐỌC dữ liệu (department tồn tại không thay đổi bởi transaction này) | Không chọn — vi phạm nguyên tắc "transaction càng ngắn càng tốt"; các bước Rule 1 hiện tại của `EmployeesService.create()` (department exists, effective dates) vốn đã được viết TRƯỚC khi gọi `prisma.employee.create()` (xem code hiện có) — giữ nguyên tinh thần đó |
| C. Không dùng transaction — tạo Employee trước, nếu tạo Contract lỗi thì code tự xoá Employee vừa tạo (compensating action) | Tránh học/dùng `$transaction` | Không atomic thật — nếu server crash/mất kết nối DB đúng giữa 2 bước (trước khi kịp chạy compensating delete), để lại Nhân viên "mồ côi" không Hợp đồng, đúng thứ BR-hr-014 cấm tuyệt đối ("không tồn tại Nhân viên mồ côi không có Hợp đồng nào") | Không chọn — compensating action không bao giờ atomic bằng transaction thật, và dự án đã có sẵn transaction API dùng được ngay, không có lý do chọn giải pháp yếu hơn |
| D. Tạo bảng nháp/staging, xác nhận 2 phía hợp lệ rồi mới "chốt" (saga pattern) | Kiểu dùng cho hệ phân tán nhiều service độc lập | Không có gì | Không chọn — over-engineering tuyệt đối cho 2 bảng trong CÙNG 1 Postgres instance; saga giải quyết vấn đề "nhiều service/DB độc lập không share transaction", vấn đề đó không tồn tại ở đây |

## Trade-offs

- **Nhận:** `EmployeesService.create()` từ "1 câu lệnh SQL" (trước đây) trở thành thao tác 2 bước trong 1 transaction — độ phức tạp code tăng nhẹ, cần hiểu rõ ranh giới "cái gì validate trước, cái gì nằm trong transaction" (đã nêu rõ ở Decision) để tránh giữ transaction mở quá lâu hoặc quên rollback đúng field.
- **Nhận:** đây là ngoại lệ DUY NHẤT trong module HR cần `$transaction` — KHÔNG áp dụng đại trà cho các thao tác khác (`POST /employees/:employeeId/contracts`, `PATCH /contracts/:id`, mọi CRUD Department/Dependent vẫn là 1 câu lệnh đơn, atomic tự nhiên, KHÔNG cần transaction — giữ nguyên kết luận cũ của `hr-architecture.md` Mục 5 cho MỌI thao tác NGOÀI `POST /employees`).
- **Đổi lấy:** đảm bảo tuyệt đối BR-hr-014 ("không tồn tại Nhân viên mồ côi") bằng cơ chế DB atomic thật, không phụ thuộc logic ứng dụng dọn dẹp sau lỗi (vốn luôn có khả năng thất bại giữa chừng do crash/mất kết nối).

## Consequences

- `hr-architecture.md` Mục 5 (bảng "Transaction boundary") cần cập nhật: dòng "Tạo Nhân viên" tách thành 2 trường hợp — "Tạo Nhân viên KÈM Hợp đồng đầu tiên (`POST /employees`)" (CÓ cần `$transaction`) khác với các thao tác Hợp đồng độc lập khác (KHÔNG cần).
- Backend Engineer viết test cho `EmployeesService.create()` cần thêm ca kiểm thử: tạo Contract thất bại (giả lập lỗi DB ở bước 2) → xác nhận Employee KHÔNG được lưu (rollback đúng) — đây là ca test mới, quan trọng nhất của toàn bộ thay đổi BR-hr-014, không có ở bộ test cũ (thiết kế cũ không có khái niệm "2 bảng" nên không thể có ca test này).
- Không ảnh hưởng tới `EmployeeCodeService`/ADR-001 — tái sử dụng nguyên vẹn, chỉ đổi client Prisma được truyền vào từ nơi gọi (`tx` thay vì `prisma`).
- Không mở rộng phạm vi dùng `$transaction` sang bất kỳ thao tác nào khác trong HR ngoài `POST /employees` — nếu tương lai phát sinh nhu cầu tương tự (vd một FR mới cần ghi đồng thời nhiều bảng), đánh giá lại theo từng trường hợp cụ thể, không mặc định "đã có transaction rồi thì dùng thêm cho tiện".
