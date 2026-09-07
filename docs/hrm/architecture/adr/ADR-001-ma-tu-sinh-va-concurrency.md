---
type: adr
feature: hrm
status: accepted
updated: 2026-09-07
---

# ADR-001: Sinh mã tự động `PBxx.yy` / `NVxxxx` và xử lý đồng thời

> **Bản sửa 2026-09-07.** Bản trước mô tả **SAI code thật**: Mục "Quyết định" ghi hệ thống
> *"bắt mã lỗi P2002 của Prisma và tự động thử lại (retry 3-5 lần)"*. Đã kiểm chứng: **không có
> vòng retry nào** trong `createNhanVien` (`nhanVien.service.ts:170-194`) hay `createPhongBan`
> (`phongBan.service.ts:160-191`). ADR này ghi lại đúng hiện trạng, rồi mới quyết phương án.

## Context

Người dùng tạo Phòng ban / Nhân viên có thể tự nhập mã hoặc bỏ trống để hệ thống cấp:

- Phòng ban: `PB01`, `PB02`… ở cấp gốc; `PB01.01`, `PB01.02`… ở cấp con (BR-01.1).
- Nhân viên: `NV0001`..`NV9999` (BR-01.2).

Cả hai khóa chính đều **không được cấp lại sau khi xóa mềm** — mã đã nằm trên chứng từ kế toán và
sẽ nằm trên bảng lương/chấm công của phân hệ Payroll sắp tới. Cấp lại là **gán lịch sử của người
này sang người khác, im lặng, không cách nào phát hiện về sau**.

**Hiện trạng code (đã kiểm chứng):**

| Bước | Phòng ban | Nhân viên |
|:---|:---|:---|
| Sinh mã | `sinhMaPhongBan` (`phongBan.service.ts:42-59`): `findMany` mọi `ma_pb` `startsWith(tiền tố)` **kể cả `da_xoa = true`** → `Set` → lấy số 2 chữ số nhỏ nhất còn trống `01..99` | `sinhMaNhanVien` (`nhanVien.service.ts:54-73`): `findMany` mọi `ma_nv` `startsWith('NV')` **kể cả đã xóa** → lấy số 4 chữ số nhỏ nhất còn trống `0001..9999` |
| Chống trùng | `assertNotExists` (`:172-179`) rồi `create` | `assertNotExists` **không lọc `da_xoa`** (`:182-189`) rồi `create` |
| Khi hết dải | `<tiền tố><4 số cuối timestamp>`, vượt 24 ký tự → 409 | `NV<6 số cuối timestamp>`, vượt 24 ký tự → 409 |
| Retry khi đụng | ❌ **Không có** | ❌ **Không có** |
| Transaction | ❌ Không có | ❌ Không có |

**Vấn đề đo được (ISSUE-HRM-02 do QA nêu):** hai người bấm "Lưu" cùng lúc, cả hai `findMany` ra
cùng snapshot, cùng tính `NV0010`. Người thứ nhất `create` thành công. Người thứ hai:

- Nếu `assertNotExists` chạy **trước** khi người kia commit ⇒ qua guard ⇒ `create` vỡ khóa chính
  ⇒ Prisma `P2002` ⇒ errorHandler trả **409 "Dữ liệu bị trùng, vui lòng thử lại"** — câu vô nghĩa
  với người đang tạo nhân viên mà **để trống mã** (họ có nhập mã đâu mà trùng).
- Nếu chạy **sau** ⇒ 409 `Mã nhân viên "NV0010" đã tồn tại` — cũng vô nghĩa vì mã do server tự đặt.

Về xác suất: tạo nhân viên là thao tác tần suất thấp (admin), nên đây **không** phải hot path.
Nhưng lúc **nhập liệu đầu kỳ** (một công ty mới lên hệ thống, 2-3 người cùng nhập danh sách nhân
sự trong một buổi) thì cửa sổ đua là có thật và lặp lại.

**Ràng buộc riêng của MAXV so với bản tham khảo `docs/nestjs/hr` ADR-001:**

1. **Multi-tenant DB-per-company.** Bản tham khảo dùng 1 DB, đề xuất `CREATE SEQUENCE
   hr_employee_code_seq`. Với MAXV, sequence phải tạo trong **từng** `maxv_<MST>_app` — nghĩa là
   mỗi lần cấp DB công ty mới phải nhớ tạo thêm sequence, và mọi tenant đã có phải migrate.
2. **Yêu cầu "lấp lỗ trống" mà sequence không đáp ứng.** Sequence chỉ tăng dần và **để lại khoảng
   hở** khi một lượt `nextval()` bị đốt (request fail vì lý do khác). Thuật toán hiện tại **lấp lỗ
   trống** — mã người dùng tự đặt (`GD-01`) không làm lệch bộ đếm, và một `NV0007` chưa từng được
   dùng vẫn được cấp. BA chưa yêu cầu "liên tục tuyệt đối", nhưng hành vi hiện tại **đã được QA
   viết thành test** (`qa/test-cases.md` TC-NV-01) và người dùng đã quen.
3. **Mã phòng ban theo cây** — sequence phẳng không mô tả được `PB01.01` (mỗi nhánh cần bộ đếm riêng).

## Decision

**Giữ nguyên thuật toán "quét + lấp lỗ trống", BỔ SUNG vòng thử lại bắt `P2002` (retry-on-conflict).**
KHÔNG dùng Postgres `SEQUENCE`, KHÔNG dùng advisory lock, KHÔNG dùng bảng counter.

Cụ thể, áp cho **cả** `createNhanVien` và `createPhongBan`:

1. **Tách hai nhánh rõ ràng:**
   - **Người dùng NHẬP mã** → giữ nguyên hành vi hiện tại: `assertNotExists` → `create`.
     Trùng ⇒ 409 nói đích danh mã nào (`E-hrm-017` / `E-hrm-012`). **Không retry** — retry
     ở đây là tự ý đổi mã người dùng đã chọn.
   - **Bỏ trống mã (server cấp)** → vào vòng lặp tối đa **5 lần**:
     `sinhMa()` → `create()` → nếu Prisma ném `P2002` thì **lặp lại** (lần sau `findMany` sẽ thấy
     mã vừa bị chiếm và tự nhảy sang số kế tiếp). Hết 5 lần vẫn `P2002` ⇒ 409 với câu nói đúng
     chuyện: `Hệ thống đang bận cấp mã, vui lòng bấm lưu lại.`
2. **Bỏ `assertNotExists` ở nhánh tự sinh** — nó chỉ tốn thêm một round-trip mà không đảm bảo được
   gì (cửa sổ đua nằm giữa `SELECT` và `INSERT`). Khóa chính là chốt cuối; retry là cách khai thác
   nó cho đúng.
3. **Chỉ bắt `P2002`.** Mọi mã lỗi khác (`P2003` FK, lỗi kết nối…) ném thẳng lên — retry mù là
   biến một lỗi cấu hình thành 5 lần thử vô ích.
4. **Không bọc `$transaction`** cho vòng lặp: mỗi lần thử là một `INSERT` độc lập; transaction chỉ
   làm cửa sổ khóa dài hơn mà không giúp gì.

Phác thảo (đặt trong `nhanVien.service.ts`, dùng lại được cho `phongBan.service.ts`):

```ts
/** Thử tối đa 5 lần: sinh mã -> ghi. Đụng khóa chính (P2002) thì sinh lại mã kế tiếp. */
const SO_LAN_THU = 5;

async function taoVoiMaTuSinh<T>(
  sinhMa: () => Promise<string>,
  ghi: (ma: string) => Promise<T>,
): Promise<T> {
  for (let lan = 0; lan < SO_LAN_THU; lan += 1) {
    const ma = await sinhMa();
    try {
      return await ghi(ma);
    } catch (err) {
      // Chỉ đụng khóa chính mới thử lại; lỗi khác là chuyện khác, đừng nuốt.
      const laTrungKhoa =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!laTrungKhoa || lan === SO_LAN_THU - 1) throw err;
    }
  }
  /* istanbul ignore next -- vòng lặp luôn return hoặc throw ở trên */
  throw new ConflictError('Hệ thống đang bận cấp mã, vui lòng bấm lưu lại.');
}
```

## Alternatives

| # | Phương án | Ưu | Nhược | Kết luận |
|:---:|:---|:---|:---|:---|
| **A** | **Quét + lấp lỗ trống + retry-on-P2002** (chọn) | Giữ nguyên hành vi nghiệp vụ đã chốt và đã có test; không thêm đối tượng DB nào ⇒ **không phải migrate 100% tenant**; dùng chung một hàm cho cả mã cây lẫn mã phẳng; sửa gọn (~25 dòng) | `findMany` toàn bộ mã mỗi lần tạo — O(n) theo số nhân viên/phòng ban của **một** tenant (thực tế vài trăm tới vài nghìn dòng, cột `ma_nv` có PK index, `startsWith` dùng được index) | **Chọn** |
| B | Postgres `SEQUENCE` mỗi tenant (như bản tham khảo) | `nextval()` atomic tự nhiên, không cần retry cho ca thường | **Không lấp lỗ trống** ⇒ đổi hành vi BR-01.2 mà chưa hỏi BA; **không** áp được cho mã cây `PB01.01`; phải tạo sequence trong **mọi** DB tenant hiện có + sửa `provisioning` để tenant mới nào cũng có; vẫn **cần retry** khi người dùng đã nhập tay đúng mã sequence sắp sinh ⇒ không bỏ được retry mà lại thêm một đối tượng DB | Không chọn — chi phí multi-tenant cao, lợi ích không bù được |
| C | Bảng đếm riêng + `SELECT … FOR UPDATE` | Không có khoảng hở; rollback theo transaction | Serialize mọi lượt tạo trên cùng một dòng; Prisma không có API bậc cao cho `FOR UPDATE` (phải `$queryRaw`); thêm bảng + thêm migration cho mọi tenant; vẫn không mô tả được mã cây | Không chọn — phức tạp hơn hẳn mà không giải quyết thêm vấn đề nào |
| D | Postgres advisory lock (`pg_advisory_xact_lock(hash(prefix))`) | Chặn đua triệt để, không cần đối tượng DB mới | Khóa theo tiền tố ⇒ mọi lượt tạo nhân viên của tenant xếp hàng; phải `$queryRaw` + bọc transaction; khóa rò rỉ nếu quên nhả (advisory lock phiên) — rủi ro treo cao hơn lợi ích ở tần suất thấp | Không chọn |
| E | Giữ nguyên, không làm gì | Không tốn công | 409 vô nghĩa còn nguyên; QA đã ghi thành ISSUE-HRM-02 | Không chọn |

## Trade-offs

- **Nhận:** thuật toán vẫn là O(n) đọc theo số bản ghi của tenant, và trong tình huống đua thì có
  thể phải đọc lại tới 5 lần. Chấp nhận được: tạo nhân viên là thao tác tần suất thấp, n của một
  công ty vừa và nhỏ ở mức vài trăm–vài nghìn, và 5 lần chỉ xảy ra khi thực sự có 5 người bấm lưu
  trong cùng vài mili-giây.
- **Nhận:** vẫn **không** đảm bảo mã liên tục tuyệt đối trong mọi tình huống (một `INSERT` fail vì
  lý do khác sau khi đã "chọn" mã thì mã đó vẫn trống, lần sau lấp lại) — nhưng đó chính là hành vi
  mong muốn (lấp lỗ trống), không phải khiếm khuyết.
- **Đổi lấy:** người dùng bỏ trống mã **không bao giờ** còn nhận lỗi trùng mã. Đúng kỳ vọng: mã do
  server cấp thì server phải tự lo, không đẩy lỗi kỹ thuật ra màn hình nhập liệu.
- **Đổi lấy:** không thêm bất kỳ đối tượng DB nào ⇒ **không cần migration**, không phải sửa luồng
  cấp DB tenant, không có rủi ro "tenant mới thiếu sequence".

## Consequences

- **Backend Engineer** sửa 2 file: `nhanVien.service.ts` (`createNhanVien`) và
  `phongBan.service.ts` (`createPhongBan`). Đặt helper `taoVoiMaTuSinh` ở
  `be_maxv/src/helpers/crudGuards.ts` (đúng chỗ: nó là pattern CRUD dùng chung, cùng họ với
  `assertNotExists`/`findOrThrow`).
- **Không đổi API contract**: request/response/HTTP status giữ nguyên. Chỉ **bớt** một nhánh lỗi
  409 khỏi luồng tự sinh mã. `api-contract.md` Mục 3.3 ghi `E-hrm-017` chỉ còn áp cho nhánh
  người dùng nhập tay.
- **Tester-QA** bổ sung ca: gửi đồng thời N request `POST /nhan-vien` với `ma_nv: null` (dùng
  `Promise.all`), kỳ vọng **N mã khác nhau, 0 lỗi 409**. Đây là test tích hợp thật, **không mock
  Prisma** — mock không tái hiện được đua khóa chính.
- **Giữ nguyên hai điểm đã đúng, tuyệt đối không sửa:** (1) quét **cả bản ghi đã xóa mềm** khi sinh
  mã; (2) `assertNotExists` ở nhánh nhập tay **không lọc `da_xoa`** — trùng với mã đã xóa vẫn là
  trùng, và thông báo phải nói đích danh mã nào.
- **Không áp dụng** cho `hrm_hop_dong` / `hrm_nguoi_phu_thuoc` / `hrm_tai_lieu`: khóa chính là
  `randomUUID()`, xác suất đụng bằng 0 về mặt thực tiễn.
