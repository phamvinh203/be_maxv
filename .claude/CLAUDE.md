# Quy ước dự án

## Luồng làm việc chuẩn (Shift-Left 3 Amigos, Backend-First & Lưu vết bắt buộc)

business-analyst (Autonomous Research, Brainstorming & Đặc tả Markdown)
→ (architect ∥ tester-qa [Phase A: Spec Review & Test Design])
→ [GATE] BA Thẩm định & Chốt toàn bộ (Final Sign-off)
→ backend-engineer (code theo Contract đã chốt — lưu vết vào `work-log.md`)
→ tester-qa [Phase B: Dynamic Test Execution] ← fail thì quay lại backend-engineer sửa + lưu vết, lặp tới khi pass
→ code-reviewer (ghi findings rõ file:line vào `review-findings.md`)
→ backend-engineer (sửa findings + lưu vết các phần đã sửa vào `review-findings.md` & `work-log.md`)
→ ✅ Hoàn tất chu kỳ backend

> **⏸️ TẠM NGỪNG (paused)**: `frontend-engineer` và `devops-engineer` hiện KHÔNG thuộc luồng hoạt động — chưa cần làm tới. Chỉ kích hoạt khi user yêu cầu rõ ràng. Khi kích hoạt lại: frontend-engineer làm SAU backend (code trên contract đã qua QA + review, ổn định) và tự chạy lại vòng `tester-qa` → `code-reviewer` cho phần FE.

- **BA Autonomous Research & Đặc tả Markdown**: Tự khảo sát codebase/context (`be_maxv/`, `maxv/`, `hdđt_maxv/`, `fe_maxv/`), phân tích 2–3 phương án giải quyết (Options & Trade-offs Matrix), tập trung xuất các file tài liệu Markdown `.md` (Spec/Flows/States/ERD) vào `docs/<feature>/srs/`. Tạm bỏ việc sinh file sơ đồ rời dạng `.svg`, `.puml`, `.png`; các luồng và mô hình biểu diễn trực tiếp bằng bảng biểu hoặc Mermaid inline trong file `.md`.
- **Shift-Left Testing (Song song & Cuốn chiếu)**: Architect thiết kế phần nào thì Tester-QA tiếp nhận ngay phần đó, đối chiếu chéo với Acceptance Criteria của BA để bẫy lỗi ngay từ khâu đặc tả.
- **BA Final Sign-off Gate (Bắt buộc)**: Sau khi Architect và Tester-QA thảo luận phản biện, BA là người đứng ra tổng duyệt, chốt lại toàn bộ tài liệu (Spec, Contract, Test Matrix), cập nhật trạng thái `Status: Ready for Implementation` vào `docs/<feature>/CONTEXT_SUMMARY.md`. **CHỈ KHI ĐÓ** Backend Engineer mới được phép khởi chạy.
- **Backend-First Implementation & Dynamic QA**: Backend Engineer triển khai code trong `be_maxv/` bám sát Contract và Test Cases. Sau đó Tester-QA chạy test thực tế, bắt buộc xuất `issues-and-bugs.md`; lỗi phát hiện → Backend Engineer sửa + lưu vết, lặp tới khi pass.
- **Lưu vết bắt buộc (Mandatory Trace)**: sau MỖI phiên làm việc (code mới, fix bug QA, fix review), Backend Engineer append vào `docs/<feature>/work-log.md`; Code Reviewer ghi findings vào `docs/<feature>/review-findings.md`. Không phiên làm việc nào được để lại không dấu vết.

---

# Nguyên tắc chung

## 0. Autonomous Execution (Thực thi tự động, liền mạch)

- **Tự động thực hiện trọn vẹn (End-to-End)**: Khi nhận task, agent chủ động phân tích, tạo/sửa code, cập nhật test, chạy linter/typecheck/test và tự fix các lỗi phát sinh trong một mạch duy nhất mà không dừng lại xin phép từng bước nhỏ.
- **Hạn chế hỏi không cần thiết**: Tuyệt đối không dừng lại xin quyền ghi file, chạy lệnh hay xác nhận các thay đổi hiển nhiên nằm trong phạm vi task đã giao.
- **Chỉ dừng lại hỏi ý kiến khi**:
  1. Có mâu thuẫn nghiệp vụ nghiêm trọng hoặc thiếu thông tin cốt lõi mà không thể suy luận từ PRD/SRS/Scope.
  2. Thao tác có nguy cơ gây mất mát dữ liệu không thể phục hồi (ví dụ: drop database, xóa branch chính, xóa file quan trọng ngoài phạm vi).
  3. Cần quyết định kiến trúc đột phá (breaking architectural changes) chưa từng được phê duyệt.

---

## 1. Requirement First

Không bắt đầu implementation nếu chưa hiểu rõ requirement.

Nếu requirement mơ hồ và ảnh hưởng trực tiếp đến implementation:

- Hỏi lại BA.
- Không tự đoán business rule quan trọng.

---

## 2. Traceability

Mọi feature nên duy trì chuỗi:

Requirement
→ Acceptance Criteria
→ API / Data Model
→ Implementation
→ Test Case
→ Code Review

Mỗi requirement nên có ID duy nhất để truy vết.

Ví dụ:

REQ-001
REQ-002
REQ-003

---

## 3. Quản lý Thư mục Tài liệu & Deliverables Bắt buộc (`docs/<feature>/`)

**Quy tắc bất di bất dịch**: Mỗi khi bắt đầu một feature, module hoặc task nghiệp vụ mới, các agents **BẮT BUỘC** phải tạo (hoặc cập nhật) thư mục chuyên biệt tại **`docs/<feature>/`** để lưu trữ toàn bộ nội dung, kết quả, hình vẽ/sơ đồ và danh sách lỗi/issues. Không được để kết quả trôi nổi trong chat.

Cấu trúc chuẩn của một thư mục feature:
```
docs/<feature>/
├── CONTEXT_SUMMARY.md           ← Bộ nhớ ngữ cảnh (entities, API routes, scope, tiến độ)
├── work-log.md                  ← BẮT BUỘC: nhật ký lưu vết toàn bộ công việc đã làm (backend-engineer append sau mỗi phiên — format xem mục "Format work-log.md")
├── review-findings.md           ← BẮT BUỘC: findings của code-reviewer (ID RVW-xxx, vị trí file:line) + trạng thái fix (code-reviewer ghi, backend-engineer cập nhật)
├── srs/                         ← Toàn bộ tài liệu đặc tả (.md) của Business Analyst (tập trung .md, không sinh .svg/.puml/.png)
│   ├── <feature>-spec.md        ← Đặc tả: User Stories, Acceptance Criteria (Given/When/Then), Business Rules
│   ├── <feature>-flows.md       ← BẮT BUỘC: Đặc tả luồng quy trình (mô tả step/bảng phân vai hoặc Mermaid inline trong .md)
│   ├── <feature>-states.md      ← BẮT BUỘC: Đặc tả vòng đời trạng thái (bảng transition hoặc Mermaid state inline nếu có)
│   └── <feature>-erd.md         ← BẮT BUỘC: Đặc tả mô hình dữ liệu (bảng entity/attribute hoặc Mermaid erDiagram inline nếu có)
├── architecture/                ← Toàn bộ thiết kế của Architect + dev-notes của Backend/Frontend Engineer
│   ├── api-contract.md          ← Endpoints, Request/Response, Validation, HTTP Status
│   ├── data-model.md            ← Database Schema, Tables, Constraints, Indexes
│   ├── adr/                     ← Các quyết định kiến trúc quan trọng (ADR-xxx.md)
│   └── dev-notes.md             ← Hướng dẫn đọc/sửa code: luồng dữ liệu, hàm nào làm gì, logic nằm ở đâu (Backend & Frontend Engineer cùng ghi, mỗi bên 1 section)
└── qa/                          ← Toàn bộ kết quả kiểm thử & danh sách lỗi của Tester-QA
    ├── test-matrix.md           ← Ma trận bao phủ kiểm thử (Phase A)
    ├── test-cases.md            ← Chi tiết các ca kiểm thử: Happy path, Edge cases, Security (Phase A)
    ├── test-report.md           ← Báo cáo kết quả chạy test thực tế (Phase B)
    └── issues-and-bugs.md       ← BẮT BUỘC: Danh mục Bug, lỗi phát hiện và các Issues/Tasks cần làm/cần fix
```

---

### Deliverables của từng Agent:

> **Lưu ý**: `docs/nestjs/` trong repo là tài liệu **tham khảo/mẫu** (ví dụ minh hoạ đầy đủ workflow BA → Architect → QA, dùng nghiệp vụ HR/Payroll làm ví dụ) — KHÔNG phải feature thật của MAXV v2 (`be_maxv` dùng Fastify, không dùng NestJS). Agent KHÔNG được lấy nội dung nghiệp vụ trong đó làm dữ liệu MAXV thật, và không tạo feature mới trùng tên (`auth`, `hr`, `payroll`, `du_lieu_tinh_luong`) gây nhầm lẫn khi quét `docs/<feature>/`.

### Business Analyst
- Tạo thư mục `docs/<feature>/srs/`.
- Cập nhật `docs/<feature>/CONTEXT_SUMMARY.md`.
- **TẬP TRUNG TẠO FILE .MD (Tạm bỏ sinh file sơ đồ .svg, .puml, .png)**:
  - Nếu quy trình có ≥ 2 bước hoặc nhiều vai trò ➔ Xuất file `<feature>-flows.md` (mô tả luồng chi tiết từng bước, bảng phân vai hoặc Mermaid inline).
  - Nếu có luồng gọi API / tích hợp / xác thực ➔ Nhúng bảng tương tác hoặc Mermaid `sequenceDiagram` inline vào `<feature>-flows.md`.
  - Nếu có thực thể có trạng thái (status lifecycle) ➔ Xuất file `<feature>-states.md` (bảng state transition hoặc Mermaid state inline).
  - Nếu có dữ liệu mới ➔ Xuất file `<feature>-erd.md` (bảng thuộc tính hoặc Mermaid erDiagram inline).
  - **Tuyệt đối không sinh file rời như `.svg`, `.puml`, `.png`**, không chạy toolchain bên thứ ba; toàn bộ nội dung nằm trọn vẹn trong các file `.md`.
  - Bàn giao trọn bộ tài liệu `.md` cho Architect và QA.

### Architect
- Tạo thư mục `docs/<feature>/architecture/`.
- Cập nhật `docs/<feature>/CONTEXT_SUMMARY.md`.
- Xuất file `api-contract.md`, `data-model.md`.
- Ghi nhận quyết định kỹ thuật vào `architecture/adr/`.
- Bàn giao cuốn chiếu từng mục cho Tester-QA.

### Backend Engineer
> ⏸️ `frontend-engineer` TẠM NGỪNG — hiện không kích hoạt. Chu kỳ kết thúc ở code-reviewer pass.
- Thực thi code dựa trên API Contract và Test Spec có sẵn (chỉ trong `be_maxv/`).
- Tự chạy linter, typecheck, unit test cục bộ.
- Sau khi code xong và pass kiểm tra nội bộ, viết/cập nhật `docs/<feature>/architecture/dev-notes.md` — hướng dẫn ngắn cho dev đọc sau: mô hình nghiệp vụ trước khi đọc code, bảng "thao tác → hàm/route/component" quan trọng, logic/công thức nghiệp vụ nằm ở đâu, chỗ nào TUYỆT ĐỐI không được nhân đôi logic.
- **LƯU VẾT BẮT BUỘC**: append vào `docs/<feature>/work-log.md` sau MỖI phiên làm việc (code mới, fix bug từ QA, fix findings từ review) — format xem mục **"Format work-log.md"** dưới đây.

### Tester QA
- Tạo thư mục `docs/<feature>/qa/`.
- **Giai đoạn Phase A (Song song với Architect)**:
  - Soát lỗi đặc tả của BA & Architect.
  - Xuất file `docs/<feature>/qa/test-matrix.md` và `docs/<feature>/qa/test-cases.md`.
- **Giai đoạn Phase B (Sau khi Dev code xong)**:
  - Chạy toàn bộ automated test suite, regression, security scan.
  - Xuất file `docs/<feature>/qa/test-report.md`.
  - **BẮT BUỘC xuất file `docs/<feature>/qa/issues-and-bugs.md`**: Ghi rõ từng Bug ID, mức độ nghiêm trọng (Severity), các bước tái hiện (Steps to reproduce), và toàn bộ các Issues còn tồn đọng cần fix tiếp.

### Code Reviewer
- **LƯU VẾT BẮT BUỘC**: review xong, ghi toàn bộ findings vào `docs/<feature>/review-findings.md` theo format **"Format review-findings.md"** dưới đây (ID RVW-xxx, severity, vị trí file:line, đề xuất fix, trạng thái OPEN/FIXED). Backend Engineer sửa xong sẽ cập nhật trạng thái ngay dưới từng finding. Đây là quyền ghi DUY NHẤT của reviewer — không sửa code.

Output:

- Review summary
- 🔴 Blocking issues
- 🟡 Non-blocking issues
- 🟢 Suggestions
- Security findings
- Performance findings
- Final recommendation

### DevOps
> ⏸️ **TẠM NGỪNG** — agent hiện không thuộc pipeline, chỉ kích hoạt khi user yêu cầu rõ ràng.

Output:

- CI/CD
- Build status
- Deployment status
- Infrastructure changes
- Environment configuration
- Monitoring
- Logging
- Health check
- Rollback procedure

---

### Format `work-log.md` (Backend Engineer append sau mỗi phiên)

```markdown
## [YYYY-MM-DD HH:mm] backend-engineer — {code mới | fix BUG-xxx | fix RVW-xxx}
- Nhiệm vụ: {mô tả 1 dòng}
- Đã sửa: `đường/dẫn/file.ts`:42 (liệt kê TỪNG file, kèm dòng)
- Liên kết: REQ-xxx · TC-xxx · BUG-xxx · RVW-xxx
- Kiểm chứng: {typecheck/lint/test — pass/fail, số test}
- Commit: {hash} hoặc "chưa commit"
```

### Format `review-findings.md` (Code Reviewer ghi, Backend Engineer cập nhật trạng thái)

```markdown
## Review YYYY-MM-DD — Verdict: {✅ Approve | ⚠️ Approve with comments | ❌ Request changes}

### RVW-001 🔴 BLOCKING — {tiêu đề ngắn}
- Vị trí: `đường/dẫn/file.ts`:42
- Vấn đề: {lỗi gì & vì sao nghiêm trọng}
- Đề xuất fix: {sửa cụ thể}
- Trạng thái: OPEN
  → FIXED [YYYY-MM-DD] — đã sửa `đường/dẫn/file.ts`:42, commit `hash`, test pass (n/x) *(backend-engineer ghi dòng này)*
```

> Severity dùng đúng bộ 🔴 Blocking / 🟡 Non-blocking / 🟢 Suggestion. Finding nào backend sửa xong phải chuyển OPEN → FIXED kèm bằng chứng; KHÔNG được xóa finding cũ.

---

# Definition of Done

Một feature chỉ được coi là hoàn thành khi các điều kiện phù hợp đã được đáp ứng:

- Requirement rõ ràng.
- Acceptance Criteria được xác định.
- Architecture/contract được thống nhất nếu cần.
- Implementation hoàn thành.
- Validation đầy đủ.
- Error handling đầy đủ.
- Test đã được viết.
- Test đã chạy.
- Không còn known critical bug.
- Code review hoàn thành.
- Build/lint/typecheck pass nếu project có.
- Documentation được cập nhật nếu cần.
- Deployment được xác nhận nếu feature yêu cầu deployment.

---

# Coding Principles

## Match Existing Repository

Agent phải ưu tiên:

- Existing architecture
- Existing naming
- Existing folder structure
- Existing libraries
- Existing patterns
- Existing error handling
- Existing testing conventions

Không được rewrite project theo preference cá nhân nếu không có lý do.

---

# Security

Không được:

- Hardcode password.
- Hardcode API key.
- Hardcode token.
- Commit private key.
- Log credential.
- Expose sensitive data.
- Bypass authorization.
- Tin tưởng dữ liệu từ client.

Secret phải được quản lý thông qua:

- Environment variables
- Secret manager
- Platform secret store

tùy architecture của project.

---

# Database

Mọi thay đổi database phải xem xét:

- Migration
- Constraint
- Index
- Foreign key
- Transaction
- Concurrency
- Data integrity
- Backward compatibility
- Rollback

Không tự ý xóa hoặc thay đổi dữ liệu production.

---

# API Contract

Backend và Frontend phải sử dụng cùng contract.

API contract cần rõ:

- Method
- Endpoint
- Authentication
- Authorization
- Request
- Response
- Status code
- Error format
- Validation
- Pagination
- Filtering
- Sorting

Nếu cần breaking change:

1. Xác định impact.
2. Báo Architect.
3. Cập nhật contract.
4. Cập nhật Backend.
5. Cập nhật Frontend.
6. Cập nhật QA.

---

# Testing

Ưu tiên:

Unit
→ Integration
→ E2E

Test phải bao gồm khi phù hợp:

- Happy path
- Edge case
- Validation
- Authorization
- Error handling
- Regression

Test fail phải được báo cáo trung thực.

Không được sửa production code chỉ để làm test pass nếu behavior thực tế vẫn sai requirement.

---

# Git

Không được:

- Force push vào protected branch nếu chưa được phép.
- Rewrite history tùy tiện.
- Xóa branch quan trọng.
- Commit secret.
- Commit build artifact không cần thiết.

Commit nên có mục đích rõ ràng.

---

# Deployment

Môi trường:

- Development
- Staging
- Production

Không được coi deployment production là thao tác thông thường.

Các hành động có thể gây mất dữ liệu hoặc downtime phải được xác nhận trước:

- Drop database
- Destructive migration
- Delete infrastructure
- Production restart gây downtime
- Production deployment có breaking change

---

# Cấu trúc Dự án & Tech Stack

## 1. Backend (`be_maxv/`)
- **Runtime & Framework**: Node.js 22+, TypeScript (strict, CommonJS/ESM), Fastify v5 (`@fastify/jwt`, `@fastify/cookie`, `@fastify/sensible`, `@fastify/cors`, `@fastify/rate-limit`).
- **Data Layer**: PostgreSQL + Prisma 7 Multi-tenant:
  - `prisma/sys/schema.prisma`: Control plane (`maxv2_sys`) quản lý tài khoản, công ty, gói cước thuê bao, lời mời, nhật ký.
  - `prisma/tenant/schema.prisma`: Schema động cho từng công ty/MST (`maxv2_<MST>_app`), chứa danh mục vật tư (`dmvt`), chứng từ bán/mua (`m81`, `d81`, `vct50view`, `vct60view`), tờ khai, DVC, HRM.
- **Tích hợp Cổng Thuế (GDT)**: Crawler chạy nền với `gdtPacer` giãn nhịp chống chặn; OCR Captcha qua `ddddocr-node`, `tesseract.js`, `sharp`, `puppeteer`.
- **Render File**: Puppeteer Chromium headless sinh PDF vector; trích xuất XML từ zip GDT.
- **Validation**: Schema validation type-safe bằng Zod (`zod`).
- **Lệnh chính**:
  - `npm run dev`: Chạy server dev với `tsx watch`
  - `npm run build`: `tsc && npm run copy:generated`
  - `npm run typecheck`: `tsc --noEmit`
  - `npm run lint`: `eslint src`
  - `npm test`: `tsx --test src/__tests__/*.test.ts`
  - `npm run migrate:sys`: Di trú DB control plane

## 2. Frontend Control Plane / Admin Portal (`maxv/`)
- **Mục đích**: Quản lý tài khoản (Owner, Nhân viên), phân quyền, quản lý công ty, gói cước thuê bao (`subscriptions`), logs.
- **Framework & UI**: React 19, Vite 8, MUI v9 (`@mui/material`, `@emotion`), Emotion.
- **Routing & Data Fetching**: `@tanstack/react-router`, `@tanstack/react-query` v5, Axios.
- **Lệnh chính**: `npm run dev`, `npm run build`, `npm run lint`.

## 3. Frontend Kế toán & Hóa đơn điện tử (`hdđt_maxv/`)
- **Mục đích**: Nghiệp vụ lấy hóa đơn GDT, tra cứu mua/bán, lập tờ khai thuế GTGT, DVC thuế, HRM.
- **Framework & UI**: React 19, Vite 8, MUI v9, React Router DOM v7 (`react-router-dom`), `@tanstack/react-query` v5.
- **Xuất file & Tiện ích**: `exceljs` (sinh Excel tại client), `pdf-lib`, `qrcode-generator`, `react-toastify`.
- **Lệnh chính**: `npm run dev`, `npm run build`, `npm run lint`.

## 4. Frontend Kế toán Core (`fe_maxv/`)
- **Mục đích**: Bán hàng, Quản lý kho, Sổ cái tổng hợp (`ban_hang`, `ton_kho`, `tong_hop`).
- **Framework & UI**: React 19, Vite 8, MUI v9, React Router DOM v7, TanStack Query v5.

## 5. Hạ tầng & Vận hành
- **Máy chủ**: Windows Server, quản lý tiến trình bằng **PM2** (`be_maxv/ecosystem.config.js`).
- **Reverse Proxy**: Nginx / IIS phục vụ static build và proxy API `/api/v1/*` về Fastify.
- **Git Hooks**: `.claude/hooks` (`pre-commit`, `pre-push`, `security-check.sh`, `format-check.sh`, `test-gate.sh`).

---

# Decision Making

Khi có nhiều phương án:

1. Xác định requirement.
2. Xác định constraint.
3. So sánh alternatives.
4. Nêu trade-off.
5. Chọn phương án phù hợp nhất.
6. Ghi ADR nếu quyết định có ảnh hưởng kiến trúc.

Không chọn công nghệ chỉ vì:

- Popular
- Hype
- Cá nhân thích
- Thấy project khác dùng

---

# Communication

Ngôn ngữ trao đổi và tài liệu:

- Bám theo ngôn ngữ người dùng.
- Technical terminology có thể giữ nguyên tiếng Anh khi cần.

Báo cáo phải:

- Chính xác.
- Có căn cứ.
- Không che giấu lỗi.
- Không tuyên bố test pass nếu chưa chạy.
- Không tuyên bố deployment thành công nếu chưa xác nhận.
- Không tuyên bố feature hoàn thành nếu còn blocking issue.

---

# Agent Responsibilities

## Business Analyst

Chịu trách nhiệm:

Business requirement
→ Specification

Không chịu trách nhiệm quyết định technical implementation.

---

## Architect

Chịu trách nhiệm:

Specification
→ Technical Design

Không tự thay đổi business requirement.

---

## Backend Engineer

Chịu trách nhiệm:

Technical Design
→ Backend Implementation

Không tự ý thay đổi contract. Mỗi phiên làm việc (code mới, fix bug, fix review) phải để lại dấu vết trong `docs/<feature>/work-log.md`.

---

## Frontend Engineer

> ⏸️ **TẠM NGỪNG** — hiện không thuộc pipeline, chỉ kích hoạt khi user yêu cầu rõ ràng. Khi kích hoạt: làm SAU backend (trên contract đã qua QA + review, ổn định), chạy lại vòng QA + review cho phần FE.

Chịu trách nhiệm:

Design + Contract
→ Frontend Implementation

Không tự ý thay đổi backend contract.

---

## Tester QA

Chịu trách nhiệm:

Requirement
→ Verification

Không sửa production code chỉ để test pass.

---

## Code Reviewer

Chịu trách nhiệm:

Implementation
→ Quality Gate

Chỉ review, không tự ý rewrite feature. Quyền ghi duy nhất: `docs/<feature>/review-findings.md` (lưu vết findings + trạng thái fix) — không sửa code.

---

## DevOps Engineer

> ⏸️ **TẠM NGỪNG** — hiện không thuộc pipeline, chỉ kích hoạt khi user yêu cầu rõ ràng.

Chịu trách nhiệm:

Application
→ Build / Deploy / Operate

Các hành động production có rủi ro cao phải được xác nhận trước.

---

# Standard Workflow

## Phase 1 — Discovery & Brainstorming

business-analyst (sử dụng skill `brainstorming`)

↓

- Tự động quét context (codebase, schema, `CONTEXT_SUMMARY.md`)
- Đề xuất 2–3 phương án nghiệp vụ kèm Trade-offs Matrix & Recommendation
- PRD / SRS / User Story / Acceptance Criteria (Given/When/Then)
- State Transitions Table & Danh mục Edge Cases

---

## Phase 2 — Shift-Left Architecture & Test Design (3 Amigos)

architect ∥ tester-qa (Phase A)

↓

- **Architect**: Thiết kế cuốn chiếu Data Model, API Contract, DB Schema, ADRs
- **Tester-QA**: Tiếp nhận từng mục, đối chiếu chéo với Acceptance Criteria của BA, phát hiện lỗ hổng logic/validation/constraints (tối đa 1–2 lượt phản biện)
- Hai bên cùng thảo luận để hoàn thiện bản thiết kế và bộ kịch bản test trước khi bàn giao lại cho BA

---

## Phase 2.5 — [GATE] BA Final Sign-off (Thẩm định & Chốt)

business-analyst

↓

- BA đối soát toàn diện giữa Spec, API Contract và Test Cases
- Đảm bảo không có mâu thuẫn nghiệp vụ và mọi Acceptance Criteria đều có test case tương ứng
- **BA CHÍNH THỨC CHỐT**: Cập nhật trạng thái `Status: Ready for Implementation` vào `docs/<feature>/CONTEXT_SUMMARY.md`
- **Kích hoạt Backend Engineer và/hoặc Frontend Engineer** (CHỈ KHI BA ĐÃ CHỐT)

---

## Phase 3 — Implementation (Backend-First)

backend-engineer

↓

- **Backend**: Triển khai code trong `be_maxv/` bám sát API Contract (`docs/<feature>/architecture/api-contract.md`) và Test Cases (`docs/<feature>/qa/test-cases.md`). Tự chạy `typecheck`, `lint` và unit test nội bộ.
- **Lưu vết**: kết thúc phiên, append `docs/<feature>/work-log.md` (từng file + dòng đã sửa, kết quả kiểm chứng, liên kết REQ/TC).
- ⏸️ **Frontend TẠM NGỪNG**: frontend-engineer không chạy trong phase này. Khi được kích hoạt lại, FE code SAU khi backend pass review, trên contract đã ổn định.

---

## Phase 4 — Dynamic Verification

tester-qa (Phase B)

↓

- Kích hoạt automated test suite và test scenarios đã chuẩn bị
- Regression testing & Security scanning
- Xuất `docs/<feature>/qa/test-report.md`
- **BẮT BUỘC xuất `docs/<feature>/qa/issues-and-bugs.md`**: Danh mục lỗi và issues cần xử lý tiếp theo

Nếu fail:
tester-qa → backend-engineer (sửa lỗi + append `work-log.md` cho từng lượt fix, tham chiếu BUG-xxx) → tester-qa (lặp lại cho tới khi đạt yêu cầu).

---

## Phase 5 — Quality Gate

code-reviewer

↓

- Soát code backend và test coverage
- **Ghi findings vào `docs/<feature>/review-findings.md`** (ID RVW-xxx, vị trí file:line, đề xuất fix) — bằng chứng lưu vết của quality gate
- Nếu có 🔴 Blocking issue: code-reviewer → backend-engineer (sửa + cập nhật FIXED trong `review-findings.md` + append `work-log.md`) → code-reviewer (review lại phần đã sửa)
- Nếu đạt: Approve

---

## Phase 6 — Deployment & Operation

> ⏸️ **TẠM NGỪNG** — devops-engineer hiện không thuộc pipeline; phase này chỉ chạy khi user yêu cầu rõ ràng.

devops-engineer

↓

- Kiểm tra cấu hình môi trường, PM2 Windows Server, di trú Prisma DB, build production SPAs
- Đảm bảo tính khả chuyển và rollback khi cần.

Build
→ Deploy
→ Smoke Test
→ Monitor

---

# Final Principle

Không agent nào được giả định rằng công việc của agent trước đã hoàn thành nếu chưa kiểm tra artifact hoặc evidence tương ứng.

Ưu tiên:

Correctness
→ Security
→ Reliability
→ Maintainability
→ Performance
→ Developer Experience

Không over-engineer khi requirement chưa cần.