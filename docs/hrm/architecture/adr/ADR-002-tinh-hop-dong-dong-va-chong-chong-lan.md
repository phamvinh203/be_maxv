---
type: adr
feature: hrm
status: accepted
updated: 2026-09-07
---

# ADR-002: Hợp đồng hiện hành tính lúc đọc & chống chồng lấn khoảng ngày

> **Bản sửa 2026-09-07.** Bản trước ghi **SAI code thật** ở Mục Quyết định điểm 3:
> *"Trước khi tạo (`createHopDong`) hoặc cập nhật (`updateHopDong`), hệ thống kiểm tra khoảng thời
> gian… không được giao cắt"*. Đã kiểm chứng: **không có kiểm tra nào** — `createHopDong`
> (`hopDong.service.ts:185-193`) và `updateHopDong` (`:196-218`) chỉ kiểm nhân viên tồn tại rồi ghi.
> ADR này chia rõ **phần ĐÃ LÀM** (tính động, mục A) và **phần PHẢI LÀM** (chống chồng lấn, mục B).

> **Bổ sung 2026-09-07 (đợt chốt nghiệp vụ 16/16).** Ba quyết định đổi nội dung ADR này:
> - **QĐ #1** — cho phép một nhân viên có **nhiều hợp đồng đồng thời KHÁC LOẠI** (hợp đồng lao động chính + hợp đồng khoán). Luật chống chồng lấn ở mục B đổi từ khóa `ma_nv` sang cặp **(`ma_nv`, `loai_hd`)**.
> - **QĐ #6** — **cho phép hợp đồng đúng một ngày** (`ngay_ket_thuc` bằng `ngay_bat_dau`). Khoảng ngày phải **đóng ở cả hai đầu**; khoảng nửa mở làm hợp đồng một ngày có độ dài bằng không và lọt qua mọi phép kiểm giao cắt.
> - **QĐ #2** — **giữ nguyên** quy tắc chọn hợp đồng hiện hành ở mục A, gồm cả nhánh rơi về hợp đồng ký trước cho tương lai. Đây là lựa chọn có ý thức, kèm một nghĩa vụ: nhãn *hợp đồng hiện hành* không đồng nghĩa *đang hiệu lực hôm nay*, phân hệ Lương phải tự lọc theo `ngay_bat_dau`.
>
> **Một hệ quả chưa chốt:** khi hai hợp đồng khác loại cùng hiệu lực, `chonHopDongHienHanh` trả **một** hợp đồng nên kết quả mơ hồ — ưu tiên theo loại, theo ngày bắt đầu muộn nhất, hay trả cả hai? Xem OQ-hrm-11 trong `hrm-spec.md`. Mục A giữ nguyên hành vi cũ tới khi có câu trả lời.
>
> **Một mâu thuẫn nội bộ do QĐ #6 sinh ra:** lý do cũ của E-hrm-022 (`ngay_chot` phải **sau** `ngay_bat_dau` của hợp đồng đang hiệu lực) dựa trên việc hợp đồng một ngày là vô lý — nay điều đó không còn đúng. Xem OQ-hrm-15. Đợt này giữ nguyên hành vi cũ.

## Context

### A. Hợp đồng hiện hành — vấn đề đã giải quyết

Một nhân viên có nhiều hợp đồng theo thời gian (thử việc → xác định thời hạn → vô thời hạn). Trước
2026-09-05, `hrm_nhan_vien` lưu 7 cột bản sao của hợp đồng hiện hành để màn danh sách khỏi join.
Bản sao đó **sai theo thời gian một cách không sửa được**:

1. "Hiện hành" phụ thuộc **ngày hôm nay**, mà bản sao chỉ được tính lại **khi có người ghi hợp
   đồng**. Ký ngày 20/12 một hợp đồng hiệu lực từ 01/01 năm sau ⇒ tới 01/01 **không có thao tác ghi
   nào** để cập nhật ⇒ bản sao đứng im ở hợp đồng cũ.
2. Form sửa nhân viên ghi **thẳng** vào mấy cột đó ⇒ đè mất giá trị suy ra từ hợp đồng, không báo gì.

### B. Chồng lấn khoảng ngày — vấn đề CHƯA giải quyết

`BR-03.3` (SRS): *"Một nhân viên tại một thời điểm chỉ có tối đa 1 hợp đồng có hiệu lực. Khoảng
`[ngay_bat_dau, ngay_ket_thuc]` của hợp đồng mới không được giao cắt với bất kỳ hợp đồng nào khác
của cùng nhân viên"* (`ngay_ket_thuc = null` = vô thời hạn = tới vô cực).

**Hiện trạng ba lớp phòng thủ — trống cả ba:**

| Lớp | Trạng thái | Bằng chứng |
|:---|:---|:---|
| Zod | Chỉ soát **trong cùng 1 bản ghi** (`ngay_ket_thuc > ngay_bat_dau`), và `ngay_bat_dau > ngay_chot` ở `/doi` | `hopDong.validator.ts:67-78, 101-112` |
| Service pre-check | ❌ Không có | `hopDong.service.ts:185-193, 196-218` |
| Ràng buộc DB | ❌ Không có | `tenant/schema.prisma:960-990` |

Tái hiện được ngay: `POST /hop-dong` `[2026-01-01, 2026-03-31]` rồi `POST /hop-dong`
`[2026-02-15, 2026-05-15]` cho cùng `NV0001` — **cả hai trả 201**.

Hậu quả không chỉ là "dữ liệu xấu": `chonHopDongHienHanh` (`:93-104`) chọn hợp đồng **bắt đầu muộn
nhất** trong số đang hiệu lực. Với hai hợp đồng chồng lấn, kết quả **phụ thuộc thứ tự nhập** —
Payroll sẽ lấy đúng một mức lương và một tỷ lệ BHXH, im lặng, không có gì báo là còn hợp đồng kia.

### C. Lỗi múi giờ trong `doiHopDong` — phát hiện mới

`chonHopDongHienHanh` dùng `homNayVN()` = nửa đêm UTC của ngày **theo giờ Việt Nam**
(`hopDong.service.ts:61-66`), với docblock giải thích rất rõ vì sao **không** được dùng
`new Date()` + `setUTCHours(0)`.

Nhưng chính `doiHopDong` — hàm ghi quan trọng nhất — lại làm đúng cái điều bị cấm đó:

```ts
// hopDong.service.ts:233-234
const homNay = new Date();
homNay.setUTCHours(0, 0, 0, 0);
```

**Hệ quả:** từ 00:00 đến 06:59 giờ VN, lịch UTC còn ở ngày hôm trước. Hợp đồng bắt đầu **đúng hôm
nay** được `GET /nhan-vien` coi là hiện hành, nhưng `POST /hop-dong/doi` **không tìm thấy nó để
chốt** ⇒ `da_chot_hop_dong_cu = false` ⇒ tạo hợp đồng mới **chồng lấn** với hợp đồng đó. Đây là
kịch bản chồng lấn **do chính hệ thống sinh ra**, không phải do người dùng nhập sai.

### D. Ràng buộc riêng của MAXV so với bản tham khảo

Bản tham khảo (`docs/nestjs/hr` ADR-002) đề xuất pre-check + `EXCLUDE USING gist`. MAXV có thêm hai
ràng buộc:

1. **DB-per-tenant**: constraint phải áp trên **mọi** `maxv_<MST>_app` đang chạy, và luồng cấp DB
   công ty mới phải sinh kèm. Không thể "một migration xong việc".
2. **Dữ liệu bẩn đã tồn tại**: code chưa bao giờ chặn ⇒ nhiều khả năng đã có hợp đồng chồng lấn
   trong dữ liệu thật. `ALTER TABLE … ADD CONSTRAINT EXCLUDE` sẽ **fail** trên tenant đó.

## Decision

### A. Hợp đồng hiện hành — GIỮ NGUYÊN (đã đúng)

Bỏ hẳn 7 cột bản sao; `hrm_hop_dong` là nguồn sự thật duy nhất; tính lúc đọc bằng
`hopDongHienHanhTheoNv` (`:124-149`).

**Luật chọn** (`chonHopDongHienHanh`, `:93-104`), theo danh sách đã sắp
`ngay_bat_dau DESC, datetime0 DESC, id DESC`:

1. Lấy phần tử **đầu tiên** thỏa `ngay_bat_dau <= homNayVN` VÀ (`ngay_ket_thuc` null HOẶC `>= homNayVN`).
2. Không có cái nào ⇒ lấy phần tử đầu danh sách (hợp đồng có ngày bắt đầu muộn nhất).
3. Nhân viên chưa có hợp đồng ⇒ `null` cả 6 trường. **Đó là sự thật và phải hiện đúng như vậy.**

**Chi phí đọc — đã đo, KHÔNG có N+1:** `listNhanVien` gọi đúng **1** query cho cả trang
(`where: { ma_nv: { in: maNvs } }`, `:118-121,130-134`), rồi gom nhóm trong bộ nhớ. Tổng cộng
`GET /nhan-vien` là **4 query cố định** bất kể số nhân viên: nhân viên, phòng ban, `groupBy` NPT,
hợp đồng (`:103-121`).

Điểm cần cải thiện (không đổi thiết kế): query hợp đồng kéo **toàn bộ lịch sử** của mọi nhân viên
trong trang, không chỉ hợp đồng liên quan. Với 500 nhân viên × 4 hợp đồng = 2.000 dòng mỗi lần mở
màn danh sách — chấp nhận được ở quy mô hiện tại, và không có index phục vụ `ORDER BY`
(chỉ có `@@index([ma_nv])`). ⇒ Bổ sung index **M-05** (`data-model.md` Mục 8). **Không**
denormalize lại — đó chính là sai lầm đã sửa.

### B. Chống chồng lấn — HAI LỚP (pre-check + ràng buộc DB)

**Lớp 1 — Pre-check ở service** (nhanh, thông báo rõ, làm TRƯỚC vì không cần migration):

```ts
/**
 * Khoảng [bắt đầu, kết thúc] của hợp đồng này không được giao với hợp đồng nào khác của
 * CÙNG nhân viên. `ngay_ket_thuc = null` = vô thời hạn (tới vô cực).
 *
 * Hai khoảng giao nhau  <=>  A.bat_dau <= B.ket_thuc  VÀ  B.bat_dau <= A.ket_thuc
 * (dùng `<=` chứ không `<`: một ngày không được thuộc về hai hợp đồng).
 */
async function assertKhongChongLan(
  db: Db,
  maNv: string,
  batDau: Date,
  ketThuc: Date | null,
  boQuaId?: string,
): Promise<void> {
  const trung = await db.hrm_hop_dong.findFirst({
    where: {
      ma_nv: maNv,
      ...(boQuaId ? { id: { not: boQuaId } } : {}),
      // hợp đồng kia chưa kết thúc trước khi hợp đồng này bắt đầu
      OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: batDau } }],
      // hợp đồng kia bắt đầu trước khi hợp đồng này kết thúc (null = vô cực -> luôn đúng)
      ...(ketThuc ? { ngay_bat_dau: { lte: ketThuc } } : {}),
    },
    select: { so_hd: true, ngay_bat_dau: true, ngay_ket_thuc: true },
    orderBy: { ngay_bat_dau: 'asc' },
  });
  if (!trung) return;

  const den = trung.ngay_ket_thuc ? ngayVn(trung.ngay_ket_thuc) : 'không thời hạn';
  throw new ConflictError(
    `Thời gian hợp đồng bị chồng lấn với hợp đồng "${trung.so_hd}" (${ngayVn(trung.ngay_bat_dau)} → ${den}). ` +
      `Một nhân viên chỉ được có một hợp đồng hiệu lực tại mỗi thời điểm.`,
  );
}
```

Gọi **trong transaction đã có**, ngay sau `assertNhanVienTonTai`, ở **cả ba** đường ghi:
`createHopDong`, `updateHopDong` (truyền `boQuaId = id`), và `doiHopDong` (gọi **sau** bước chốt
hợp đồng cũ, để hợp đồng vừa chốt không tự báo chồng lấn với hợp đồng mới).

**Lớp 2 — Ràng buộc Postgres `EXCLUDE USING gist`** (chốt cuối, chống đua thật sự):

SQL đầy đủ + câu quét dữ liệu bẩn + chiến lược triển khai multi-tenant: `data-model.md` Mục 8, M-01.

**Bắt lỗi:** vi phạm `EXCLUDE` trả SQLSTATE `23P01` (`exclusion_violation`). Prisma **không** map
mã này thành `P2002`/`P2003` mà về dưới dạng lỗi generic, SQLSTATE nằm sâu trong `error.meta`.
⇒ Cơ chế bắt **thật sự hoạt động** là **đối chiếu tên constraint** (`hrm_hop_dong_khong_chong_lan`)
trong `error.message`, không dựa vào `error.code`. Bản tham khảo đã đo và ghi nhận đúng chuyện này
(`docs/nestjs/hr/.../ADR-002` phần cập nhật 2026-09-05: mã thật là `P2039`, không phải `P2004` như
tài liệu Prisma gợi ý). **Backend phải verify lại bằng test tích hợp trên chính stack MAXV**
(`@prisma/adapter-pg`, Prisma 7) chứ không chép kết luận đó.

### C. Sửa lỗi múi giờ trong `doiHopDong`

Thay `new Date()` + `setUTCHours(0,0,0,0)` (`:233-234`) bằng `homNayVN()`. Đồng thời **export**
`homNayVN` để không ai viết lại phiên bản thứ hai.

### D. Thứ tự triển khai (bắt buộc theo đúng thứ tự này)

| Bước | Việc | Cần migration? |
|:---:|:---|:---:|
| 1 | Sửa lỗi múi giờ `doiHopDong` (mục C) | Không |
| 2 | Bật pre-check `assertKhongChongLan` ở 3 đường ghi (Lớp 1) | Không |
| 3 | Chạy câu quét dữ liệu chồng lấn trên **mọi** tenant, xuất báo cáo cho BA/kế toán | Không |
| 4 | Nghiệp vụ dọn dữ liệu cũ (BA quyết cách chốt ngày cho từng cặp) | Không |
| 5 | Áp `EXCLUDE` cho **từng tenant đã sạch**; tenant chưa sạch thì hoãn, ghi sổ theo dõi | **Có** |
| 6 | Bổ sung sinh constraint vào luồng cấp DB tenant mới | **Có** |

Bước 1–2 giải quyết ~99% ca thực tế (lỗi nhập liệu) và **không** chặn tiến độ. Bước 5–6 mới là
chốt cuối chống đua.

## Alternatives

| # | Phương án | Ưu | Nhược | Kết luận |
|:---:|:---|:---|:---|:---|
| **A** | **Pre-check + `EXCLUDE` (2 lớp)** | Thông báo đẹp cho 99% ca + đúng tuyệt đối dưới đồng thời; constraint bảo vệ **mọi** đường ghi kể cả script/`$queryRaw` sau này | Thêm extension `btree_gist` chưa từng dùng; Prisma DSL không biểu diễn được ⇒ SQL tay trong migration; **phải chạy trên mọi tenant** và xử lý dữ liệu bẩn có sẵn | **Chọn** — nhưng triển khai theo pha (mục D), pre-check trước |
| B | Chỉ pre-check ở service | Không cần migration, không đụng multi-tenant; làm được ngay | Còn cửa sổ đua thật: hai request cho cùng nhân viên cùng lúc đều "thấy không chồng lấn" rồi cùng ghi. `READ COMMITTED` **không** phát hiện được (không dòng nào bị hai bên cùng ghi). Dữ liệu sai âm thầm, ảnh hưởng lương/BHXH/TNCN | Không chọn làm phương án **duy nhất** — nhưng là **bước 2** bắt buộc trong lộ trình |
| C | Chỉ `EXCLUDE`, bỏ pre-check | Ít code | Người dùng nhập sai (ca phổ biến nhất) nhận lỗi DB generic, khó gắn vào đúng ô nhập; và **không** nói được đang đụng hợp đồng nào | Không chọn |
| D | Nâng transaction lên `SERIALIZABLE` | Không cần extension | Phải xử lý retry `40001` ở mọi nơi gọi; ảnh hưởng toàn bộ pool tenant; vẫn cần pre-check để có thông báo tử tế ⇒ đắt hơn mà không thay thế được gì | Không chọn |
| E | Advisory lock theo `ma_nv` trước khi check+insert | Không cần extension | Phải `$queryRaw`, chỉ bảo vệ đường đi qua đúng service đó (script bỏ qua được), và không có gì kiểm chứng dữ liệu cũ | Không chọn |
| F | Không làm gì (giữ nguyên) | — | Vi phạm BR-03.3, QA đã ghi ISSUE-HRM-01 mức High, Payroll sắp tới lấy sai lương | Không chọn |

## Trade-offs

- **Nhận:** thêm `btree_gist` và loại constraint `EXCLUDE` chưa từng có trong dự án ⇒ tăng bề mặt
  kiến thức, và constraint **không xuất hiện trong `schema.prisma`** ⇒ có nguy cơ "biến mất khỏi
  nhận thức" nếu ai đó chạy `prisma db pull`. Bù lại bằng comment nhắc ngay trong `migration.sql`
  và mục M-01 của `data-model.md`.
- **Nhận:** chi phí vận hành multi-tenant thật sự — phải quét và dọn dữ liệu bẩn trên **từng** công
  ty trước khi áp được constraint, và luồng cấp DB mới phải nhớ sinh kèm. Đây là chi phí không có
  trong bản tham khảo 1-DB, và là lý do chia pha ở mục D.
- **Nhận:** đổi rule sau này phải sửa **hai** nơi (pre-check + constraint). Chấp nhận vì hai lớp
  phục vụ hai mục tiêu khác nhau (UX vs correctness), không phải trùng lặp vô nghĩa.
- **Đổi lấy:** dữ liệu hợp đồng — đầu vào trực tiếp của lương, BHXH, thuế TNCN — không bao giờ
  chồng lấn dưới **bất kỳ** điều kiện đồng thời nào, kể cả các đường ghi tương lai không đi qua
  `hopDong.service` (script chuyển dữ liệu, `$queryRaw`, phân hệ Payroll sắp làm).
- **Đổi lấy (mục A):** thêm 1 query cho mỗi lần đọc danh sách nhân viên, đổi lấy việc **không bao
  giờ** lệch dữ liệu theo thời gian. Đây là đánh đổi đã chốt và **không đảo lại**.

## Consequences

- **Backend Engineer:**
  - Sửa `hopDong.service.ts`: thay `setUTCHours` bằng `homNayVN()` (2 dòng); thêm
    `assertKhongChongLan` và gọi ở 3 đường ghi; thêm nhánh bắt lỗi constraint theo **tên**.
  - Thêm helper định dạng ngày VN cho message lỗi (đã có `ngayVn` trong `utils/` — dùng lại, đừng viết mới).
  - **KHÔNG** tự chạy migration M-01: phải qua bước quét dữ liệu + BA duyệt (mục D).
- **API contract:** thêm mã `E-hrm-024` (409) — đã ghi sẵn trong `api-contract.md` Mục 8.4 với nhãn
  *(ĐỀ XUẤT — chưa có)*. Bỏ nhãn đó khi code xong.
- **Tester-QA** bổ sung:
  - Chồng lấn tuần tự (tạo/sửa) ⇒ 409 với message nêu đúng `so_hd` đang đụng.
  - Hai hợp đồng **liền kề đúng biên** (`31/03` kết thúc, `31/03` bắt đầu) ⇒ **409** (khoảng `'[]'`
    đóng hai đầu). Nếu BA muốn cho phép, phải đổi sang `'[)'` ở **cả** pre-check lẫn constraint.
  - Hợp đồng vô thời hạn (`ngay_ket_thuc = null`) chặn mọi hợp đồng bắt đầu sau đó.
  - Đua thật: `Promise.all` hai `POST /hop-dong` chồng lấn cho cùng nhân viên ⇒ đúng **1** thành công.
  - Ca múi giờ: giả lập giờ máy chủ 02:00 UTC (09:00 VN) và 18:00 UTC hôm trước (01:00 VN hôm sau),
    kiểm `POST /hop-dong/doi` tìm đúng hợp đồng bắt đầu "hôm nay".
- **Xóa hợp đồng (ISSUE-HRM-03 do QA nêu):** giữ `DELETE /hop-dong/:id` xóa cứng ở giai đoạn này.
  Khi có Payroll, cách đúng **không phải** kiểm tra ở service mà là **FK `onDelete: Restrict`** từ
  bảng chi trả lương trỏ vào `hrm_hop_dong.id` — cùng nguyên tắc "ràng buộc khai báo ở DB là chốt
  cuối" của ADR này. Ghi lại để đợt Payroll không thiết kế lại từ đầu.
- **Không đụng** `hrm_nguoi_phu_thuoc.dk_tu_*/dk_den_*`: kỳ giảm trừ gia cảnh **được phép** chồng
  lấn giữa các người phụ thuộc khác nhau (mỗi người một suất giảm trừ). Chỉ chặn trùng **MST**, đã
  có `@@unique([ma_nv, mst])`.
