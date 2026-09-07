---
type: adr
feature: hrm
status: accepted
updated: 2026-09-07
---

# ADR-007: Quyền xem dữ liệu lương và phạm vi tenant của vai trò ADMIN

## Context

Đợt rà soát 2026-09-07 phát hiện hai vấn đề phân quyền nằm cạnh nhau, và chúng buộc phải quyết cùng nhau vì cùng đụng một chỗ trong mã (`helpers/access.ts`).

**Vấn đề 1 — ai cũng đọc được lương của cả công ty (BUG-HRM-25).** `GET /hop-dong` để `ma_nv` là tùy chọn, gọi trần trả về **toàn bộ hợp đồng của mọi nhân viên** trong tenant (`hopDong.service.ts:175`). Giao diện khai thác đúng điều đó: `hopDongQueries.ts:67-75` gọi `listHopDong()` không tham số rồi lọc phía trình duyệt. Hệ quả: mở màn hồ sơ một người là tải bảng lương cả công ty về máy. Đây là rò rỉ **trong nội bộ một công ty**, không phải rò chéo giữa các tenant.

**Vấn đề 2 — `ADMIN` bị chặn hoàn toàn khỏi dữ liệu tenant.** `accessibleDonViWhere` trả `null` cho mọi vai trò khác `OWNER` và `OWNER_EMPLOYEE` (`helpers/access.ts:17-24`), nên `resolveTenantInfo` ném 403 và `canAccessDonVi` trả `false`. Không có tài liệu nào nói đây là chủ ý hay thiếu sót, nên mỗi lần ai đó cần hỗ trợ khách lại có người đề nghị "mở tạm cho ADMIN".

Hai vấn đề dính nhau: cách chữa vấn đề 1 là thêm một mức quyền, mà thêm mức quyền thì phải trả lời luôn mức đó đứng ở đâu so với `ADMIN`.

## Decision

**1. Quyền xem dữ liệu lương là một quyền nghiệp vụ cấp BÊN TRONG phạm vi `OWNER_EMPLOYEE`, không phải một vai trò hệ thống mới.**

- `OWNER` **luôn** có quyền này.
- `OWNER_EMPLOYEE` có hay không tùy việc được cấp.
- Phạm vi che gồm: `luong_chinh`, `luong_bhxh`, `so_tai_khoan`, `ten_tai_khoan`, `ngan_hang`, và **toàn bộ** nhóm endpoint `/hop-dong`.
- Người không có quyền nhận phản hồi **không chứa** các trường đó — **bỏ hẳn trường, không trả `null`**. Trả `null` là nói dối về dữ liệu: giao diện không phân biệt được "không có số tài khoản" với "không được xem số tài khoản".
- Không có quyền mà gọi `/hop-dong` thì nhận **403 E-hrm-058**.

**Cách hiện thực — CHỐT 2026-09-07 (bản trước cố ý để mở, và đó là sai lầm).** Để mở nghĩa là hệ thống *chặn* được nhưng **không ai *cấp* được**: mọi `OWNER_EMPLOYEE` sẽ bị 403 vĩnh viễn ở toàn nhóm `/hop-dong`. Chốt như sau:

- **Lưu ở đâu:** thêm cột `xemLuong Boolean @default(false)` vào bảng `DonViAccess` (`maxv2_sys`). Đúng phạm vi cần: khóa của bảng này là cặp (`userId`, `donViId`), nên một kế toán dịch vụ được xem lương ở công ty A mà không ở công ty B. Xem `data-model.md` M-13.
- **Cấp/thu hồi bằng gì:** mở rộng `PUT /companies/nhan-vien/:userId/access` để nhận danh sách công ty **kèm cờ xem lương**, và bổ sung ô tick tương ứng ở màn phân quyền của `maxv/`. Không có màn này thì cột cũng vô dụng.
- **Ai được cấp:** chỉ `OWNER` — cùng mức với việc cấp quyền vào công ty.

> 🚨 **Bẫy bắt buộc phải xử lý cùng lúc — `setEmployeeAccess` là replace-set.** `company.service.ts:384-394` xóa **toàn bộ** `DonViAccess` của nhân viên rồi `createMany` lại theo danh sách mới. Thêm cột `xemLuong` mà giữ nguyên cách ghi này thì **mỗi lần chủ tài khoản sửa danh sách công ty là xóa sạch mọi quyền xem lương đã cấp**, âm thầm, không ai biết cho tới khi kế toán báo mất màn hợp đồng. Phải đổi sang `upsert` theo cặp (`userId`, `donViId`), hoặc đọc cờ cũ ra rồi ghi lại kèm.

**Cấm đưa quyền này vào vé đăng nhập (JWT).** Access token sống 15 phút và **cố ý không đối chiếu cơ sở dữ liệu mỗi request** (`plugins/jwt.plugin.ts`, và chính contract Mục 7.1 đã phân tích đúng điều này cho nhóm Drive). Nhét cờ quyền vào token thì thu hồi quyền xem lương **trễ tới 15 phút, im lặng** — với dữ liệu lương thì đó là 15 phút quá dài. Điều may mắn: **không phải đánh đổi gì cả** — mỗi request HRM đã tra `maxv2_sys` sẵn hai lần rồi (`requireModule` và `resolveTenantInfo`), nên chỉ cần lấy thêm `xemLuong` trong đúng truy vấn của `resolveTenantInfo`, **đo thật: tốn thêm ~0,36 ms mỗi lượt gọi** (0,80 → 1,17 ms, trung bình 200 lần trên cơ sở dữ liệu thật). Không phải 0 như bản trước khẳng định: Prisma bắn **một truy vấn riêng** cho quan hệ vì `relationJoins` không bật.

**2. `ADMIN` không có phạm vi tenant, và đó là chủ ý. Giữ nguyên.**

Đội vận hành MAXV **không** xem được dữ liệu nhân sự của khách qua giao diện, và đó là điều mong muốn. Hồ sơ nhân sự chứa CCCD, mã số thuế cá nhân, số tài khoản ngân hàng và lương — đây là loại dữ liệu mà "xem được vì tiện hỗ trợ" là một rủi ro thường trực, không phải một tính năng.

Hỗ trợ khách đi đường khác: khách chia sẻ màn hình, hoặc khách tự cấp quyền vào công ty cho người hỗ trợ rồi thu lại. Cả hai đường đều để lại dấu vết ở phía khách và đều do khách chủ động.

**Không được nới quy tắc này vì lý do "cho tiện hỗ trợ".** Ghi thành ADR chính vì đề nghị đó sẽ quay lại.

**3. Máy chủ và giao diện phải sửa CÙNG MỘT LƯỢT.**

`GET /hop-dong` bắt buộc `ma_nv` và chặn theo quyền; giao diện đổi `listHopDong()` không tham số thành gọi theo từng nhân viên. Siết máy chủ trước mà chưa sửa giao diện thì **màn hợp đồng trắng ngay lập tức với mọi người dùng** — kể cả người có đủ quyền.

## Alternatives

**Thêm một vai trò hệ thống thứ tư (`HR_MANAGER`) ngang hàng `OWNER`/`OWNER_EMPLOYEE`.** Bỏ: vai trò hệ thống là thuộc tính của **tài khoản**, mà quyền xem lương phải là thuộc tính của **cặp (tài khoản, công ty)** — một kế toán dịch vụ làm cho năm công ty có thể được xem lương ở hai công ty và không được ở ba công ty còn lại. Dựng thành vai trò hệ thống là mất khả năng đó ngay từ đầu.

**Che trường ở tầng giao diện.** Bỏ: dữ liệu vẫn đi qua mạng và vẫn nằm trong bộ nhớ trình duyệt, mở tab công cụ phát triển là thấy. Che ở giao diện là trang trí, không phải phân quyền.

**Mở `ADMIN` ra nhưng ghi nhật ký mọi lần truy cập.** Bỏ ở đợt này: nhật ký cho biết ai đã xem **sau khi** họ đã xem, không ngăn được việc xem. Với dữ liệu định danh cá nhân, ngăn trước tốt hơn ghi lại sau. Nếu sau này thật sự cần đường hỗ trợ, phải thiết kế riêng (truy cập tạm có thời hạn, có lý do, khách duyệt) chứ không phải nới `accessibleDonViWhere`.

## Trade-offs

**Được:** dữ liệu lương và tài khoản ngân hàng chỉ tới tay người được cấp quyền; ranh giới `ADMIN` được ghi thành quyết định nên lần sau không ai "sửa cho tiện"; mô hình quyền theo cặp (tài khoản, công ty) khớp với thực tế kế toán dịch vụ.

**Mất:** phát sinh một khái niệm quyền mới phải khai báo, cấp phát và hiển thị trên giao diện quản trị; đội vận hành mất khả năng tự chẩn đoán dữ liệu HRM của khách, mỗi ca hỗ trợ tốn thêm một vòng trao đổi; hai đầu máy chủ và giao diện phải ra cùng lượt nên không tách nhỏ được đợt triển khai.

## Consequences

- `GET /hop-dong` đổi `ma_nv` từ tùy chọn sang **bắt buộc** — đây là **breaking change** với mọi thứ đang gọi nó. Phải rà hết chỗ gọi ở `hdđt_maxv` trước khi bật.
- `GET /nhan-vien` trả về **hai hình dạng phản hồi khác nhau** tùy quyền người gọi. Kiểu dữ liệu phía giao diện phải khai các trường lương là tùy chọn, không phải bắt buộc.
- Cần một đường để giao diện biết người đang đăng nhập **có** quyền xem lương hay không, để ẩn hẳn tab Lịch sử hợp đồng thay vì hiện ra rồi báo 403.
- **Giá trị mặc định khi bật tính năng là quyết định nghiệp vụ chưa chốt** (OQ-hrm-16). `@default(false)` nghĩa là ngày deploy, **mọi kế toán đang làm việc mất màn hợp đồng cùng lúc**, trong khi màn cấp quyền có thể chưa kịp lên. `@default(true)` thì P0 không sửa được gì cho BUG-HRM-25. Phải chốt trước khi viết migration dữ liệu, và nếu chọn `false` thì phải có kế hoạch cấp quyền hàng loạt cho dữ liệu đang chạy.
- Hai câu hỏi mở còn lại: có cần vai trò chỉ-đọc riêng không, và có che thêm `so_cccd` / `mst_ca_nhan` không.
- **Phạm vi che còn một chỗ chưa ai hỏi:** người bị 403 toàn nhóm `/hop-dong` **vẫn đọc được** 6 trường hợp đồng hiện hành trên `GET /nhan-vien` (`so_hop_dong`, `loai_hop_dong`, `kieu_luong`, `ngay_hieu_luc_toi`, `bhxh`, `tncn`). Không có mức lương, nhưng có loại hợp đồng và hạn hợp đồng của cả công ty. Xem OQ-hrm-17.

## Nguồn

- Quyết định #8 và #9, `docs/hrm/CONTEXT_SUMMARY.md` Mục 6.1.
- BR-hrm-051, BR-hrm-059, E-hrm-058, FR-hrm-042 — `docs/hrm/srs/hrm-spec.md`.
- BUG-HRM-25 — `docs/hrm/qa/issues-and-bugs.md`.
- `be_maxv/src/helpers/access.ts:17-24`, `be_maxv/src/services/client/hrm/hopDong.service.ts:175`, `hdđt_maxv/src/features/hrm/api/hopDongQueries.ts:67-91`.
