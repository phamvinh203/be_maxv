# BÁO CÁO VẬN HÀNH & TRIỂN KHAI HẠ TẦNG (DEVOPS AUDIT REPORT) — PHÂN HỆ CÀI ĐẶT LƯƠNG — ROUND 2 (RÀ SOÁT ĐỘ SẴN SÀNG VẬN HÀNH)

## Phân hệ: HR Payroll — Danh mục khoản lương, Cấu trúc lương & Thiết lập lương nhân viên

> Báo cáo này BỔ SUNG, KHÔNG thay thế [`docs/hr/dev-op/devops-salary-settings-report.md`](./devops-salary-settings-report.md) (Round 1 — giữ nguyên làm lịch sử, viết khi feature mới hoàn thành lần đầu, TRƯỚC khi BA/Architect phát hiện 2 gap nghiêm trọng BR-sal-008/BR-sal-005). Đây là **đánh giá độ sẵn sàng vận hành (readiness review)**, KHÔNG PHẢI một lượt deploy thật lên production — feature `salary-settings` hiện toàn bộ UNCOMMITTED trên branch `dev`, CHƯA merge vào `main`, CHƯA được lệnh deploy production. Mọi hành động kiểm chứng trong báo cáo này CHỈ thực hiện trên: (a) Docker image build cục bộ, (b) container Postgres tạm thời dùng-một-lần (đã xoá sau khi xong), (c) container `hrm_accounting` dev local đã tồn tại sẵn trong `docker-compose.yml` (chỉ truy vấn READ-ONLY, không ghi/xoá dữ liệu). **KHÔNG có migration nào được chạy lên DB ngoài dev local. KHÔNG merge, KHÔNG push, KHÔNG deploy production.**

- **Người thực hiện**: Agent DevOps Engineer (rà soát độ sẵn sàng, round 2)
- **Thời gian thực hiện**: 2026-09-06
- **Mã đợt đánh giá**: DEVOPS-HR-SALARY-SETTINGS-ROUND2
- **Trạng thái phê duyệt**: ✅ **SẴN SÀNG VỀ MẶT HẠ TẦNG cho 2 gap chặn Round 1 đã vá** — ⚠️ có 1 phát hiện CI **KHÔNG liên quan tới salary-settings** nhưng đang ẢNH HƯỞNG THẬT tới `main` (xem Mục 6), khuyến nghị xử lý song song/trước khi merge.
- **Vị trí tài liệu**: `docs/hr/dev-op/devops-salary-settings-report-round2.md`

---

## 0. Phạm vi rà soát & phương pháp

Theo đúng nguyên tắc "không tin suông báo cáo trước, tự kiểm chứng bằng evidence" (`.claude/CLAUDE.md` — Final Principle) đã được BA/Architect/QA/Code-Reviewer áp dụng ở các đợt trước, DevOps Round 2 tự thực hiện (không chỉ đọc file migration.sql/ci.yml suông):

| Việc đã làm | Cách xác nhận | Kết quả |
|---|---|---|
| Đọc migration mới `20260906030741_add_salary_item_name_ci_unique` | Đọc trực tiếp `migration.sql` | Xem Mục 1 |
| Đối chiếu DB dev local thật (READ-ONLY) | `docker exec hrm_accounting psql -c "\d salary_items"` + `npx prisma migrate status` | Index đã áp dụng thật, khớp migration.sql |
| Build Docker image cục bộ | `docker build -t hrm-accounting:devops-round2-check ./Backend` | ✅ Build thành công, không cần sửa Dockerfile |
| Mô phỏng lại CHÍNH XÁC job `docker` của CI (Postgres tạm thời + image vừa build + cùng bộ env vars trong `ci.yml`) | Container tạm thời `devops-round2-pg` + `devops-round2-app`, đã xoá sạch sau khi xong | ⚠️ Container CMD FAIL ở bước `npx prisma db seed` — xem Mục 6 (KHÔNG liên quan schema salary-settings) |
| Đối chiếu với CI thật trên GitHub Actions | `gh run view` cho 3 lần chạy `main` gần nhất | Xác nhận job `docker` đang ĐỎ trên `main` vì đúng lý do vừa tái hiện cục bộ — không phải giả thuyết suông |
| Kiểm tra glob pattern CI có tự động chạy test mới không | Đọc `vitest.config.ts`, `vitest.config.e2e.ts`, `package.json` scripts | Có, tự động — xem Mục 3 |
| Dọn dẹp | `docker rm -f`/`docker network rm`/`docker rmi` cho mọi container/network/image tạm | Đã dọn sạch, xác nhận `docker ps -a` không còn artifact nào |

---

## 1. Đánh giá an toàn Migration mới: `20260906030741_add_salary_item_name_ci_unique`

### 1.1 Nội dung migration
```sql
CREATE UNIQUE INDEX "salary_items_category_name_ci_key"
  ON "salary_items" (category, lower(trim(name)));
```
Migration append-only, KHÔNG sửa migration `20260906014946_add_salary_settings` đã áp dụng trước đó — đúng convention forward-only của toàn bộ project (đã kiểm tra: không migration nào trong 7 migration hiện có của repo có down-script riêng).

### 1.2 An toàn khi áp dụng lên dữ liệu hiện có
- **Đã xác nhận THẬT trên DB dev** (`docker exec hrm_accounting psql -U hrm -d hrm_accounting -c "\d salary_items"`): index `salary_items_category_name_ci_key UNIQUE, btree (category, lower(TRIM(BOTH FROM name)))` tồn tại đúng như migration.sql, cạnh `salary_items_code_key` (UNIQUE cũ) và 2 index thường (`category`, `status`). Bảng hiện có đúng 19 dòng (seed gốc `KL01`..`KL19`), không có dòng nào trùng `(category, lower(trim(name)))` — migration áp dụng không lỗi (Backend Engineer + Code Reviewer đã probe điều này trước khi migrate; DevOps xác nhận lại độc lập lần 3 qua chính DB dev, không phải chỉ tin báo cáo).
- **Không có FK/cascade nào bị ảnh hưởng** — đây là UNIQUE index thuần trên 1 bảng, không đổi cột, không đổi kiểu dữ liệu, không đổi ràng buộc NOT NULL nào.

### 1.3 Biện pháp đặc biệt khi chạy trên production — CÓ CẦN `CONCURRENTLY` không?
**Không cần**, với 2 lý do kỹ thuật cụ thể (không phải bỏ qua cho nhanh):
1. **Quy mô bảng nhỏ**: `salary_items` là bảng danh mục (catalog) khoản lương — 19 dòng seed gốc, tăng trưởng chậm (thao tác admin thủ công, không phải bảng giao dịch tần suất cao như `contracts`/`employee_salaries`). `CREATE UNIQUE INDEX` không-`CONCURRENTLY` giữ khoá `SHARE` trên bảng (chặn ghi INSERT/UPDATE/DELETE, KHÔNG chặn đọc SELECT) trong thời gian build index — với 19-vài trăm dòng, thời gian này ở mức mili-giây, downtime ghi gần như bằng 0.
2. **Ràng buộc kỹ thuật của cơ chế deploy hiện tại**: `prisma migrate deploy` (dùng trong cả CI job `test` lẫn `CMD` của Dockerfile khi container Render khởi động) chạy mỗi migration trong 1 transaction. `CREATE UNIQUE INDEX CONCURRENTLY` **không thể chạy bên trong transaction** (giới hạn cứng của Postgres) — nếu ép dùng `CONCURRENTLY` ở đây sẽ khiến `prisma migrate deploy` LỖI ngay khi áp dụng, không phải chỉ chậm hơn. Vì vậy quyết định không dùng `CONCURRENTLY` của Backend Engineer/Architect là ĐÚNG với ràng buộc hạ tầng hiện tại, không phải thiếu sót.
- **Khuyến nghị cho tương lai** (không chặn round này): nếu sau này `salary_items` phình to (hàng chục nghìn dòng — khó xảy ra với 1 bảng danh mục loại khoản lương, về bản chất là danh sách hữu hạn theo quy định lương của doanh nghiệp) và cần thêm UNIQUE index tương tự, nên tách bước migrate DDL đó ra ngoài cơ chế `prisma migrate deploy` transactional (chạy tay 1 lần bằng `psql` với `CONCURRENTLY`) thay vì phó mặc migration tự động.

### 1.4 Downtime dự kiến khi merge & auto-deploy Render
**Không có downtime đáng kể.** Render's Dockerfile CMD chạy `npx prisma migrate deploy && npx prisma db seed && node dist/main.js` mỗi lần container khởi động lại sau deploy — migration mới (1 câu `CREATE UNIQUE INDEX` trên bảng 19 dòng) chạy xong trong mili-giây trước khi `node dist/main.js` start, hoàn toàn nằm trong cơ chế cold-start bình thường của Render (vài giây), không phải downtime phát sinh thêm do riêng migration này.

### 1.5 Rollback plan cụ thể cho migration này
Vì project theo convention **forward-only** (không có down-migration tự động), rollback là thao tác **THỦ CÔNG, có xác nhận**, gồm 2 bước độc lập tuỳ mức độ cần rollback:

**Bước A — Rollback riêng UNIQUE index (khuyến nghị nếu chỉ index này gây vấn đề vận hành, vd chặn nhầm nghiệp vụ hợp lệ)**:
```sql
-- Không destructive, không mất dữ liệu, chỉ gỡ ràng buộc — thực hiện thủ công qua psql,
-- KHÔNG qua prisma migrate (project không có down-script tự động).
DROP INDEX IF EXISTS "salary_items_category_name_ci_key";
```
Sau khi drop bằng tay, đánh dấu lại migration trong bảng theo dõi của Prisma để `prisma migrate deploy` các lần sau không cố áp lại/nghĩ là đã áp:
```bash
npx prisma migrate resolve --rolled-back 20260906030741_add_salary_item_name_ci_unique
```
- **Hệ quả sau rollback**: hệ thống quay về ĐÚNG trạng thái Round 1 cho BR-sal-002 (chỉ còn pre-check ở tầng Service `SalaryItemsService.create()/update()`, không còn lớp bảo vệ DB thứ 2) — đây là mức rủi ro đã được Architect/Code-Reviewer Round 1 CHẤP NHẬN trước đó (Non-blocking, không phải Blocking), nên rollback này AN TOÀN, không đưa hệ thống vào trạng thái chưa từng được review.
- Đồng thời `SalaryItemsService.create()/update()` sẽ không còn bao giờ khớp nhánh `isSalaryItemNameConflict()` (catch P2002 case-insensitive) — không lỗi runtime gì, nhánh đó chỉ đơn giản không còn được kích hoạt.

**Bước B — Rollback toàn bộ phân hệ Salary Settings (chỉ khi quyết định RÚT HẲN feature, không phải tình huống thường gặp)**:
Nếu phải gỡ cả `20260906014946_add_salary_settings` (4 bảng `salary_items`/`salary_structures`/`salary_structure_items`/`employee_salaries`/`employee_salary_items` + 3 API resource + FK) — đây là thao tác **RỦI RO CAO, CÓ THỂ MẤT DỮ LIỆU** nếu đã có bản ghi thật trong các bảng này. Theo đúng nguyên tắc `.claude/CLAUDE.md` ("Không tự ý xóa hoặc thay đổi dữ liệu production", "Destructive migration phải xác nhận trước"):
1. **BẮT BUỘC** `pg_dump` backup trước (dùng đúng lệnh đã có ở runbook Round 1, Mục 7.3 `devops-deployment-report.md`).
2. **BẮT BUỘC** xác nhận bằng văn bản của người có thẩm quyền (PO/Lead) trước khi chạy `DROP TABLE`.
3. Thứ tự drop phải tôn trọng FK (`employee_salary_items` → `employee_salaries`/`salary_structure_items` → `salary_structures` → `salary_items`) — KHÔNG được để agent tự động thực hiện bước này mà không xác nhận, theo đúng chỉ thị của người giao việc round này.
4. **Không nằm trong phạm vi round 2 hiện tại** — chỉ ghi nhận ở đây làm tài liệu runbook dự phòng, KHÔNG có khuyến nghị thực hiện (2 gap chặn Round 1 đã vá đúng, không có lý do nghiệp vụ nào để rút feature).

---

## 2. Kiểm tra `docker-compose.yml` / Dockerfile — migration mới có ảnh hưởng build/healthcheck không

- **Dockerfile**: KHÔNG cần sửa gì. Xác nhận qua build cục bộ thành công (Mục 0 + 4) — cơ chế `COPY --from=build /app/prisma ./prisma` đã copy cả thư mục `migrations/` (bao gồm folder mới `20260906030741_add_salary_item_name_ci_unique/`) mà không cần khai báo gì thêm, vì đây là `COPY` cả thư mục, không phải liệt kê file cụ thể.
- **docker-compose.yml**: KHÔNG cần sửa. Service `api` không tham chiếu migration nào theo tên cụ thể — `prisma migrate deploy` tự động áp mọi migration MỚI theo thứ tự thư mục (timestamp) mỗi lần container `api` khởi động lại.
- **HEALTHCHECK**: KHÔNG bị ảnh hưởng — endpoint `/health` không phụ thuộc bảng `salary_items`, chỉ trả `{status, uptime, timestamp}`. Container chỉ chuyển sang "healthy" SAU KHI `node dist/main.js` đã start thành công (tức là SAU KHI `prisma migrate deploy` + `db seed` đã chạy xong không lỗi) — nếu migration mới có lỗi cú pháp/xung đột, container sẽ dừng ở bước migrate/seed và KHÔNG BAO GIỜ đạt "healthy", đúng cơ chế fail-fast đã thiết kế từ Round 1. Đã xác nhận migration này áp dụng thành công (Mục 0), nên không kích hoạt nhánh fail-fast này trong thực tế.

---

## 3. CI Coverage — Test mới có được `.github/workflows/ci.yml` tự động chạy không

**CÓ, tự động, KHÔNG cần sửa `ci.yml` cho phần test.** Xác nhận qua đọc trực tiếp cấu hình (không suy đoán):

| Test mới Round 2 | Cơ chế pickup | Xác nhận |
|---|---|---|
| `Backend/src/hr/salary/employee-salaries/employee-salaries.service.spec.ts` (unit, cập nhật) | `vitest.config.ts` → `test.include: ['**/*.spec.ts']` (glob, không liệt kê file cụ thể) | CI bước "Unit tests" (`npm test`) tự động quét mọi `*.spec.ts` trong repo, gồm file này |
| `Backend/src/hr/salary/salary-items/salary-items.service.spec.ts` (unit, cập nhật) | Như trên | Như trên |
| `Backend/test/salary-settings.e2e-spec.ts` (e2e, cập nhật thêm 3 case) | `vitest.config.e2e.ts` → `test.include: ['**/*.e2e-spec.ts']` | CI bước "E2E tests" (`npm run test:e2e`) tự động quét mọi `*.e2e-spec.ts` |
| `Backend/test/salary-settings-qa-round2-independent.e2e-spec.ts` (e2e, MỚI — QA Round 2 tự viết) | Như trên | Như trên — đúng đuôi `.e2e-spec.ts` nên tự động được gộp vào cùng lượt `npm run test:e2e`, không cần thêm dòng nào trong `ci.yml` |

- **Không có `include`/danh sách file tường minh nào trong `package.json` hay `ci.yml`** — cả 2 script `test` và `test:e2e` chỉ gọi `vitest run` với glob toàn cục, nên MỌI file mới đúng đuôi quy ước sẽ tự động được CI chạy ngay từ lần push kế tiếp, không có rủi ro "quên đăng ký test mới vào CI".

### 3.1 Biến môi trường/service mới cho CI — có cần gì thêm không?
**KHÔNG cần.** Đã đọc `migration.sql` — chỉ có 1 câu `CREATE UNIQUE INDEX`, KHÔNG có `CREATE EXTENSION` nào (khác với migration `contracts_no_overlap` Round trước cần `btree_gist`). Service `postgres:17-alpine` đã khai báo sẵn trong job `test` của `ci.yml` (`POSTGRES_USER=hrm`, `POSTGRES_PASSWORD=hrm`, `POSTGRES_DB=hrm_accounting`, port `5435:5432`) — đúng credentials mà `test/*.e2e-spec.ts` hardcode kết nối tới, không cần thêm biến môi trường hay service mới cho riêng migration/test Round 2 này.

---

## 4. Xác nhận Build Docker image cục bộ

```
docker build -t hrm-accounting:devops-round2-check ./Backend
```
**Kết quả: BUILD THÀNH CÔNG** — cả 2 stage `build` (node:24-alpine, `npm ci` + `nest build`) và `runtime` (node:24-alpine, `npm ci --omit=dev`) hoàn tất không lỗi, image export thành công. **Dockerfile KHÔNG cần đổi gì** cho thay đổi Round 2 (migration mới tự động được copy theo cơ chế `COPY --from=build /app/prisma ./prisma` đã có sẵn).

Đi xa hơn yêu cầu tối thiểu của nhiệm vụ, DevOps đã **mô phỏng lại chính xác job `docker`/Smoke test của CI** bằng container Postgres tạm thời + image vừa build + đúng bộ biến môi trường trong `ci.yml`, để xác nhận migration mới không gây vỡ luồng khởi động container thật (không chỉ tin `docker build` suông — build thành công không đảm bảo container CHẠY được, vì `CMD` còn có `prisma migrate deploy && npx prisma db seed`):

```
Applying migration `20260906014946_add_salary_settings`
Applying migration `20260906030741_add_salary_item_name_ci_unique`
All migrations have been successfully applied.
```
→ **Xác nhận: migration mới tự áp dụng đúng, không lỗi, trên 1 DB Postgres hoàn toàn trống (mô phỏng đúng kịch bản container mới/CI)**. Container sau đó dừng lại ở bước `npx prisma db seed` — nhưng vì lý do **HOÀN TOÀN KHÔNG LIÊN QUAN đến schema/migration Salary Settings** (xem Mục 6, phát hiện quan trọng). Toàn bộ container/network/image tạm dùng để mô phỏng đã được dọn dẹp sạch sau khi xác nhận xong (`docker rm -f`, `docker network rm`, `docker rmi`) — không để lại rác trên máy dev.

---

## 5. Đối chiếu ma trận robustness (Non-blocking) từ Code Reviewer Round 2 — góc nhìn vận hành

Code Reviewer Round 2 ghi nhận 3 vấn đề "uncaught unique-constraint violation → 500" (Bug #2 race condition mã `KLxx`; duplicate `salaryItemId` trong `items[]`; double-submit trên cùng `employeeId`) — cả 3 đều **Non-blocking**, không gây mất/sai dữ liệu (Postgres tự chặn ở tầng constraint, transaction rollback sạch). Từ góc nhìn vận hành (không lặp lại phân tích code đã có, chỉ bổ sung góc nhìn DevOps):

- **`HttpExceptionFilter` đã xác nhận (bởi Code Reviewer) không lộ stack trace** — 500 chỉ trả `INTERNAL` chung chung, nên về mặt bảo mật vận hành, 3 gap này không tạo thêm rủi ro exposure.
- **Không có external caller nào tự động retry các luồng này** (không có queue/webhook liên quan) — 500 dừng lại ở đúng 1 request HTTP, không có hiệu ứng dây chuyền (cascading failure) sang service khác.
- **Khuyến nghị Monitoring (xem Mục 8)**: cần alert tần suất `500` trên nhóm route `/salary-items`, `/employee-salaries` tăng đột biến — đây chính là tín hiệu vận hành sớm nếu 1 trong 3 race condition này xảy ra thật trên production trước khi Round 3 Backend Engineer vá xong. Hiện hệ thống CHƯA có structured logging/APM để tách log theo route (xem Mục 8), nên đây là gap giám sát cần bổ sung song song, không thể "chờ Round 3 xong mới lo".

---

## 6. PHÁT HIỆN QUAN TRỌNG — KHÔNG THUỘC PHẠM VI SALARY-SETTINGS nhưng ẢNH HƯỞNG THẬT tới `main`

> Phát hiện này nằm ngoài checklist 7 điểm được giao, nhưng phát sinh trực tiếp từ việc mô phỏng lại job `docker` của CI (Mục 4) — báo cáo trung thực theo đúng nguyên tắc `.claude/CLAUDE.md` ("Không được che giấu lỗi").

### 6.1 Mô tả
Khi mô phỏng lại đúng bộ biến môi trường mà `.github/workflows/ci.yml` (bước "Smoke test", dòng 113-127) truyền vào `docker run`, container dừng ở bước `npx prisma db seed` với lỗi:
```
Seed Admin THẤT BẠI: Thiếu ADMIN_INITIAL_EMAIL — seed Admin không thể chạy.
```
Vì `Dockerfile` CMD là `prisma migrate deploy && npx prisma db seed && node dist/main.js` (nối bằng `&&`), `db seed` exit code 1 khiến **`node dist/main.js` không bao giờ được chạy** → `/health` không bao giờ trả `200` → smoke test timeout sau 60s → job `docker` FAIL → **image KHÔNG được push lên GHCR**.

### 6.2 Xác nhận đây KHÔNG phải giả thuyết — đang xảy ra THẬT trên `main`
Tra cứu trực tiếp lịch sử chạy CI qua `gh run view` (không suy đoán): lần chạy CI gần nhất trên `main` sau merge PR gần nhất (run `34005430883`, merge PR #4, ~2 giờ trước thời điểm review) — job `Lint · Test · Build` **PASS**, nhưng job `Docker build · Smoke · Push GHCR` **FAIL đúng tại bước Smoke test**, với log lỗi **giống hệt** những gì tôi vừa tái hiện cục bộ (`Seed Admin THẤT BẠI: Thiếu ADMIN_INITIAL_EMAIL`).

### 6.3 Đây có phải lỗi do salary-settings gây ra không?
**KHÔNG.** Xác nhận qua đối chiếu:
- `Backend/Dockerfile` KHÔNG nằm trong danh sách file thay đổi của salary-settings (`git status` không có Dockerfile).
- `.github/workflows/ci.yml` cũng KHÔNG nằm trong danh sách thay đổi của salary-settings.
- `env.schema.ts` xác nhận `ADMIN_INITIAL_EMAIL`/`ADMIN_INITIAL_PASSWORD`/`ADMIN_INITIAL_NAME` là `.optional()` ở tầng validate biến môi trường của ứng dụng (app không fail-fast vì thiếu 2 biến này) — lỗi chỉ phát sinh từ check thủ công riêng trong `prisma/seed.ts` (bắt buộc 2 biến này để tạo tài khoản Admin đầu tiên), và bước "Smoke test" của `ci.yml` đơn giản là **chưa từng truyền 2 biến này** (khác biệt với 5 biến Google Drive đã được vá ở commit `5bd2e2f`, nhưng đợt vá đó bỏ sót đúng 2 biến `ADMIN_INITIAL_*`).
- Đây là lỗi **PRE-EXISTING**, đã tồn tại từ trước khi salary-settings được phát triển (migration mới nhất mà lần chạy CI thất bại đó áp dụng được chỉ có 5 migration — TRƯỚC CẢ `add_salary_settings` — xác nhận migration salary-settings hoàn toàn không liên quan tới nguyên nhân lỗi này).

### 6.4 Ảnh hưởng thật tới việc merge salary-settings vào `main`
- **Production Render KHÔNG bị ảnh hưởng bởi lỗi này** — theo đúng kiến trúc đã ghi ở `.claude/CLAUDE.md` ("Render tự deploy khi push main (repo-connected, không cần deploy hook)"), Render build/chạy container CỦA RIÊNG NÓ trực tiếp từ source, với biến môi trường CHẠY THẬT đã cấu hình sẵn trên Render dashboard (production đã có Admin thật, đang chạy ổn định từ 2026-09-05 theo bộ nhớ dự án) — KHÔNG dùng lại image từ GHCR, và KHÔNG dùng bộ env giả (`ci-smoke-test-...`) của job `docker`. Vì vậy khi merge salary-settings vào `main`, **Render vẫn tự deploy và chạy migration mới bình thường** — đã xác nhận migration tự nó an toàn ở Mục 1.
- **Cái BỊ ảnh hưởng**: job `docker` trên GitHub Actions sẽ tiếp tục FAIL (đúng lỗi có sẵn, không phải lỗi mới do salary-settings) → **image `ghcr.io/phamvinh203/hrm-accounting:latest` sẽ KHÔNG được cập nhật**, tiếp tục là bản build CŨ (từ lần chạy `docker` job thành công gần nhất trước đó). Nếu sau này có kịch bản cần rollback/dùng lại image GHCR làm nguồn (vd disaster recovery không qua Render), image đó sẽ KHÔNG chứa code salary-settings — cần lưu ý rõ ràng cho bất kỳ ai định dùng tag `latest` trên GHCR làm căn cứ rollback.
- **CI status trên `main` sẽ tiếp tục hiển thị ĐỎ** sau khi merge (không phải do salary-settings, nhưng lẫn vào cùng 1 run) — có thể gây hiểu nhầm cho người xem lịch sử CI rằng salary-settings có vấn đề, trong khi thực chất là job khác, lý do khác.

### 6.5 Khuyến nghị (KHÔNG tự ý sửa — nêu rõ để người giao việc quyết định)
Đề xuất fix cụ thể (1 dòng, cùng pattern với 5 biến Google Drive đã vá trước đó ở `.github/workflows/ci.yml` bước Smoke test, dòng 113-127) — **CHƯA áp dụng**, vì đây là thay đổi trên file CI dùng chung toàn repo, nằm NGOÀI phạm vi 7 điểm được giao cho round 2 salary-settings, nên chỉ đề xuất, không tự thực hiện:
```yaml
  -e ADMIN_INITIAL_EMAIL="ci-smoke-admin@example.invalid" \
  -e ADMIN_INITIAL_PASSWORD="CiSmokeTest!2026#Strong" \
```
(giá trị mẫu — cần đối chiếu đúng chính sách mật khẩu `BR-auth-003`/`validatePasswordPolicy()` khi áp dụng thật; đây chỉ là placeholder minh hoạ, KHÔNG phải secret thật, cùng tinh thần các giá trị `ci-*`/`ci-smoke-test-*` đã dùng sẵn trong file). Khuyến nghị xử lý bằng 1 commit fix CI riêng biệt, độc lập với PR salary-settings, càng sớm càng tốt (không bắt buộc phải xong TRƯỚC khi merge salary-settings, vì như Mục 6.4 đã phân tích, không chặn Render production) — nhưng nên làm SỚM để khôi phục CI xanh và đồng bộ lại image GHCR.

---

## 7. Environment Configuration

**Không có thay đổi biến môi trường/secret nào cho salary-settings Round 2** (khớp báo cáo Backend Engineer Mục 13.10 CONTEXT_SUMMARY.md — DevOps xác nhận độc lập, không tìm thấy biến môi trường mới nào được tham chiếu trong toàn bộ code thay đổi của `Backend/src/hr/salary/**`). Riêng phát hiện Mục 6 KHÔNG phải "thiếu env mới do salary-settings" mà là thiếu env đã tồn tại từ trước trong 1 file CI không thuộc phạm vi thay đổi của feature này.

---

## 8. Monitoring, Logging, Health check — đánh giá hiện trạng cho phân hệ mới

| Hạng mục | Hiện trạng | Đánh giá |
|---|---|---|
| **Health check** | `GET /health` — không đổi, không phụ thuộc bảng `salary_items`/`employee_salaries` | ✅ Không bị ảnh hưởng bởi migration mới |
| **Application logs** | `console.error` phía server cho lỗi 500 (qua `HttpExceptionFilter`), chưa có structured logging (JSON logs) tách theo route/request-id | 🟡 Đủ dùng cho quy mô hiện tại (nội bộ, ít traffic), nhưng khi cần điều tra 1 trong 3 race condition Non-blocking (Mục 5), sẽ khó lọc log theo request cụ thể nếu không có request-id — khuyến nghị bổ sung khi có Round 3 |
| **Error rate theo route** | Chưa có dashboard/metric riêng cho `/salary-items`, `/employee-salaries` | 🟡 Khuyến nghị: nếu tích hợp APM (vd thêm sau này), ưu tiên theo dõi tỉ lệ 500 trên 2 route này trong 2-4 tuần đầu sau khi bàn giao Frontend, đúng lúc dễ lộ 3 race condition Non-blocking nếu có nhiều người dùng thao tác đồng thời |
| **Database connections** | Prisma connection pool mặc định, không đổi cho salary-settings | ✅ Không có thay đổi |
| **Queue depth** | Không áp dụng — module không dùng queue | N/A |
| **Availability (Render)** | Free tier Render — theo cấu hình hiện có, không đổi bởi feature này | ✅ Không bị ảnh hưởng |
| **CI health** | Job `test` XANH; job `docker` ĐỎ (Mục 6, không liên quan salary-settings) | ⚠️ Xem Mục 6 |

---

## 9. Rollback Procedure — Tổng hợp (Application + Database)

### 9.1 Rollback tầng ứng dụng (nếu salary-settings sau khi merge/deploy gây sự cố nghiêm trọng ngoài dự kiến)
1. Trên Render dashboard: chọn deploy TRƯỚC commit salary-settings (danh sách "Deploys" của service `hrm-Accounting`) → "Rollback to this deploy" (Render hỗ trợ rollback thủ công về 1 deploy trước đó cho service repo-connected).
2. Thay thế/bổ sung: `git revert` merge commit trên `main` rồi push — Render sẽ tự deploy lại bản code cũ (autoDeploy).
3. **Lưu ý quan trọng**: rollback CODE không tự động rollback DATABASE. 2 migration mới (`add_salary_settings`, `add_salary_item_name_ci_unique`) đã áp dụng ở lần deploy trước đó sẽ **VẪN CÒN NGUYÊN** trên DB production sau khi rollback code — điều này AN TOÀN vì:
   - Cả 2 migration đều chỉ THÊM bảng/ràng buộc mới (additive), KHÔNG sửa/xoá cột nào của bảng cũ (`employees`/`contracts`/...) — code cũ (trước salary-settings) hoàn toàn không biết tới bảng mới, không gọi tới bảng mới, nên chạy bình thường không lỗi dù DB đã có thêm bảng lạ.
   - `prisma migrate deploy` chạy lại ở lần deploy code cũ tiếp theo sẽ thấy các migration mới "đã áp dụng" (ghi trong `_prisma_migrations`) và bỏ qua, không cố re-apply hay lỗi.
4. Chỉ khi PO/Lead xác nhận cần rút hẳn dữ liệu/schema salary-settings mới thực hiện Bước B ở Mục 1.5 (backup trước, xác nhận trước, KHÔNG tự động).

### 9.2 Rollback riêng migration UNIQUE index (nếu chỉ riêng ràng buộc này gây vấn đề)
Xem chi tiết đầy đủ ở Mục 1.5 Bước A — `DROP INDEX IF EXISTS "salary_items_category_name_ci_key";` + `prisma migrate resolve --rolled-back`.

### 9.3 Điều kiện kích hoạt rollback (gợi ý ngưỡng, không tự động hoá)
- Tỉ lệ lỗi 500 trên `/salary-items` hoặc `/employee-salaries` tăng bất thường sau khi Frontend tích hợp (khả năng cao là 1 trong 3 gap Non-blocking Mục 5 bị kích hoạt thật) → ưu tiên vá Backend (Round 3) trước, CHỈ rollback nếu ảnh hưởng lan sang các route HR khác hoặc gây downtime toàn hệ thống.
- UNIQUE index case-insensitive chặn nhầm 1 nghiệp vụ hợp lệ chưa lường trước (vd nhu cầu thật cần 2 khoản trùng tên khác category — hiện tại schema đã cho phép khác `category` thì được, chỉ chặn khác trong CÙNG category) → cân nhắc Bước A Mục 1.5 sau khi Architect/BA xác nhận đây đúng là false-positive nghiệp vụ, không phải hiểu nhầm yêu cầu.

---

## 10. Kết luận & Khuyến nghị bàn giao

1. **Migration `20260906030741_add_salary_item_name_ci_unique`**: AN TOÀN để merge/deploy — additive, không downtime đáng kể, không cần `CONCURRENTLY` (có lý do kỹ thuật cụ thể), rollback rõ ràng, không destructive.
2. **CI coverage cho test mới Round 2**: ĐẦY ĐỦ, tự động (glob-based), KHÔNG cần sửa `ci.yml` cho phần test/migration.
3. **Docker/Docker Compose**: KHÔNG cần thay đổi gì cho salary-settings Round 2 — xác nhận qua build + mô phỏng chạy thật thành công tới bước migrate.
4. **Rủi ro khi merge vào `main` + Render autoDeploy**: THẤP cho riêng phần salary-settings (migration an toàn, API contract không breaking, endpoint/response shape không đổi). Rủi ro robustness (3 vấn đề Non-blocking từ Code Reviewer — race condition mã `KLxx`, duplicate `salaryItemId`, double-submit) là nợ kỹ thuật đã biết, không chặn merge, nhưng khuyến nghị Frontend được cảnh báo và Round 3 Backend xử lý sớm.
5. **PHÁT HIỆN NGOÀI PHẠM VI nhưng quan trọng**: job `docker` của CI đang ĐỎ trên `main` (lỗi thiếu `ADMIN_INITIAL_EMAIL`/`ADMIN_INITIAL_PASSWORD` trong bước Smoke test) — KHÔNG do salary-settings gây ra, KHÔNG chặn Render production deploy, nhưng khiến GHCR image không được cập nhật và CI hiển thị đỏ. Khuyến nghị 1 commit fix riêng, có thể làm song song, không bắt buộc chặn merge salary-settings.
6. **Khuyến nghị chung**: Có thể tiến hành merge `dev` → `main` cho phần salary-settings (2 gap chặn Round 1 đã vá đúng, xác nhận độc lập qua 4 vòng BA/Architect/QA/Code-Reviewer + hạ tầng đã sẵn sàng) — với điều kiện: (a) backlog Round 3 (3 finding Non-blocking) được ghi nhận rõ cho Backend Engineer, (b) Frontend được cảnh báo ràng buộc `salaryItemId` không trùng lặp trong `items[]` khi build UI, (c) fix CI job `docker` (Mục 6) nên làm sớm dù không chặn merge. Quyết định merge cuối cùng vẫn thuộc về người giao việc/PO — DevOps chỉ xác nhận hạ tầng sẵn sàng, không tự ý merge.
7. **Xác nhận KHÔNG có hành động nào đụng tới production được thực hiện trong quá trình review này**: không merge, không push, không chạy migration lên DB nào ngoài container dev local `hrm_accounting` đã tồn tại sẵn (chỉ truy vấn READ-ONLY), mọi container/network/image dùng để mô phỏng CI đã được tạo mới và xoá sạch hoàn toàn sau khi kiểm chứng xong.
