---
type: adr
feature: auth
status: accepted
updated: 2026-09-06
---

# ADR-004 — Validation: zod + ZodValidationPipe tự viết

## Context

Spec yêu cầu validate input các endpoint auth (contract Mục 9: email format, password policy BR-auth-003, reason ≤ 500 ký tự, limit 1-200…). Backend NestJS 12, TypeScript strict, ESM. Repo hiện **chưa có validation library nào** ("match existing repo" — không có gì để match, chọn gọn). Cần: validate body/query trong controller pipeline NestJS (pipe), type-safety từ schema, và validate cả env lúc boot (architecture doc Mục 7 — fail fast nếu thiếu `JWT_ACCESS_SECRET`).

## Decision

**zod (v4) + tự viết `ZodValidationPipe`** (~30 dòng, global pipe). Không dùng `nestjs-zod`.

- Schema đặt cạnh controller/service, derive TS type qua `z.infer<typeof Schema>` — schema là nguồn thật cho cả validate lẫn type.
- Pipe transform lỗi zod → `BadRequestException` với `error.fields` map (fieldName → message tiếng Việt) khớp error format thống nhất (contract Mục 5).
- Dùng zod cho cả **env validation** lúc boot (`env.schema.ts` — fail fast thiếu secret/thiếu SMTP khi `MAIL_TRANSPORT=smtp`), thay vì thêm `@nestjs/config` zod adapter riêng.

## Alternatives

| Phương án | So sánh |
|-----------|---------|
| **zod + pipe tự viết** ✓ | 1 dependency duy nhất; schema-first + type inference chuẩn TS; pipe tự viết ~30 dòng, không gián tiếp qua wrapper; tái dùng được cho env validation; community + tài liệu lớn nhất nhóm schema-validation |
| `nestjs-zod` (zod) | Wrapper tạo sẵn `ZodValidationPipe` + `createZodDto` — tiết kiệm 30 dòng, đổi lấy 1 dependency trung gian phải theo kịp NestJS major (hiện hỗ trợ NestJS 12 nhưng phụ thuộc maintainer); pipe tự viết đủ gọn để không đáng thêm 1 layer |
| class-validator + class-transformer | Bộ chuẩn truyền thống NestJS; nhưng pattern decorator + class trùng lặp với DTO type (define field 2 lần), type-safety yếu hơn (decorator không chắc runtime), 2 dependency. Chỉ đáng khi codebase đã dùng nó — repo trắng, không có lý do |
| yup | Schema-first giống zod nhưng hướng form client, type inference yếu hơn, ecosystem server ít hơn |
| Valibot / ArkType | Nhỏ/nhanh hơn zod nhưng ecosystem + tài liệu mỏng, team quen zod nhiều hơn |

## Trade-offs

- **Nhận:** Tự viết pipe = tự maintain 30 dòng (test pipe 1 lần, không đổi). Lỗi transform zod → HTTP phải xử lý đúng 1 chỗ (global exception filter).
- **Nhận:** zod không gắn metadata `@ApiProperty` cho OpenAPI/Swagger — hiện chưa cần Swagger (FE deferred, contract là file markdown). Khi cần Swagger sau này, thêm `nestjs-zod` hoặc zod-to-openapi lúc đó (tối ưu khi có measured need).
- **Đổi lấy:** 1 dependency thay vì 2-3; schema = type = nguồn thật; validate env cùng công cụ; không khóa vào wrapper library.

## Consequences

- Mỗi endpoint có schema zod riêng (vd `loginSchema`, `resetPasswordSchema`, `adminLockSchema`) — nội dung rule khớp contract Mục 9.
- `env.schema.ts` validate `DATABASE_URL`, `JWT_ACCESS_SECRET` (≥ 32 byte), `SESSION_IDLE_MINUTES`, `LOCKOUT_*`, `RESET_*`, `SMTP_*` (khi `MAIL_TRANSPORT=smtp`) — thiếu/fail → process exit lúc boot với message rõ (Render log hiển thị ngay).
- Pipe đăng ký global (`APP_PIPE`) hoặc apply per-handler qua `@UsePipes` — backend engineer quyết định khi implement; khuyến nghị global + `whitelist` behavior (strip field thừa).
- Message lỗi tiếng Việt khớp wording trong contract Mục 5/8 — schema chứa message ngay trong rule (zod `message` param), không hardcode rải rác.

## Addendum — Swagger/OpenAPI bật cho toàn Backend (2026-09-06)

Quyết định "chưa cần Swagger" ở trên (Trade-offs) đã được đảo ngược theo yêu cầu tường minh của user — không còn chờ "measured need" từ FE.

**Cách tiếp cận:** KHÔNG dùng `nestjs-zod` (không đổi wrapper cho DTO/pipe hiện có). Thay vào đó:

1. `@nestjs/swagger` (`^12.0.1`, khớp peer `@nestjs/core ^12`) chỉ dùng cho `DocumentBuilder`/`SwaggerModule` bootstrap + decorator thuần document (`@ApiTags`, `@ApiBearerAuth`, `@ApiBody`, `@ApiConsumes`) — KHÔNG đụng `HrZodValidationPipe`/`ZodValidationPipe` hay hành vi validate/error runtime đã được QA xác nhận qua nhiều round.
2. Helper `zodToOpenApiSchema()` (`Backend/src/common/swagger/zod-to-openapi.ts`) bọc `z.toJSONSchema(schema, { target: 'openapi-3.0', unrepresentable: 'any' })` — API native của zod v4 (đã có sẵn, không cần thêm dependency `zod-to-openapi`/`nestjs-zod`). Mỗi controller tái dùng CHÍNH schema đã import để validate, tránh định nghĩa DTO trùng lặp.
3. `SwaggerModule.setup('api/docs', app, document)` trong `main.ts` — CHỈ mount khi `config.get('env') !== 'production'` (không lộ bề mặt API công khai trên Render production; FE/QA/dev dùng ở local hoặc môi trường non-prod). Helmet CSP được nới lỏng (`contentSecurityPolicy: false`) CHỈ khi không phải production — đúng lúc Swagger UI được mount, production giữ nguyên CSP đầy đủ.
4. Bearer scheme đặt tên `access-token` khớp cơ chế thật (`Authorization: Bearer <access_token>`, KHÔNG phải cookie — refresh token mới ở cookie).

**Trade-off còn lại:** `@ApiQuery` cho từng field của query DTO (list/filter endpoints) chưa được khai báo chi tiết — Swagger UI hiện chỉ hiển thị các route này mà không liệt kê từng query param riêng lẻ (chấp nhận được ở mức "tài liệu tham khảo cho dev/QA", nâng cấp sau nếu cần).
