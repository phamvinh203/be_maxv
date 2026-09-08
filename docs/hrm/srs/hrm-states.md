---
type: srs-states
feature: hrm
updated: 2026-09-07
---

# HRM — VÒNG ĐỜI TRẠNG THÁI CÁC THỰC THỂ

Ba thực thể của phân hệ HRM có vòng đời trạng thái thật: **Nhân viên**, **Hợp đồng lao động** và **Liên kết Google Drive của công ty**. Phòng ban, Người phụ thuộc và Tài liệu chỉ có cặp trạng thái tồn tại/đã xóa nên không cần sơ đồ riêng — mô tả nằm trong bảng cuối trang.

Mọi trạng thái dưới đây được suy ra từ mã nguồn thật, không phải từ mong muốn thiết kế.

**Cập nhật 2026-09-07 (đợt chốt nghiệp vụ 16/16).** Phần đánh `[MỚI — QĐ n]` hoặc `[SỬA THEO QĐ n]` là **vòng đời đã chốt nhưng chưa có trong mã** — đầu việc cho Architect và kỹ sư, không phải mô tả hiện trạng. Quyết định gốc ghi ở Mục 6.1 của `docs/hrm/CONTEXT_SUMMARY.md`. Chỗ nào hiện trạng và mức đã chốt khác nhau đều nói rõ cả hai.

---

## State: NhanVien

**Related entity**: NhanVien (`hrm_nhan_vien`)
**Related BR**: BR-hrm-010, BR-hrm-011, BR-hrm-012, BR-hrm-013, BR-hrm-054 `[MỚI — QĐ 3]`, BR-hrm-055 `[MỚI — QĐ 3]`
**Nguồn mã**: `be_maxv/src/services/client/hrm/nhanVien.service.ts` (createNhanVien dòng 170-194, updateNhanVien dòng 197-217, deleteNhanVien dòng 227-243), `be_maxv/src/validators/hrm/nhanVien.validator.ts` dòng 74.

Trạng thái nhân viên là **tích của hai trục độc lập**: `status` (`1` đang làm / `0` đã nghỉ) và `da_xoa` (`false` / `true`). Schema tách hai cột có chủ đích: "đã nghỉ việc" là dữ liệu nhân sự thật (còn quyết toán thuế, còn trong báo cáo), "đã xóa" là hồ sơ nhập nhầm.

```mermaid
stateDiagram-v2
    state "Đang làm việc (status=1, da_xoa=false)" as DangLam
    state "Đã nghỉ việc (status=0, da_xoa=false)" as DaNghi
    state "Đã xóa mềm (da_xoa=true)" as DaXoa

    [*] --> DangLam : POST /nhan-vien, bỏ trống status nên nhận mặc định 1
    [*] --> DaNghi : POST /nhan-vien với status = 0, nhập bù hồ sơ người đã nghỉ

    DangLam --> DaNghi : PUT /nhan-vien/:ma_nv với status = 0, BẮT BUỘC kèm ngay_nghi_viec (BR-hrm-054)
    DaNghi --> DangLam : PUT /nhan-vien/:ma_nv với status = 1, tái tuyển dụng (chiều về chưa chốt, OQ-hrm-12)

    DangLam --> DaXoa : DELETE /nhan-vien/:ma_nv
    DaNghi --> DaXoa : DELETE /nhan-vien/:ma_nv

    DaXoa --> [*] : dòng ở lại vĩnh viễn để mã nhân viên không bao giờ được cấp lại

    note right of DaNghi
        Đã chốt QĐ 3, CHƯA CÓ TRONG MÃ: ghi nhận nghỉ việc là MỘT
        giao dịch gồm ba việc — đổi status, lưu ngay_nghi_viec, và
        tự chốt mọi hợp đồng còn mở bằng đúng ngày nghỉ (BR-hrm-055).
        Thiếu ngày nghỉ thì từ chối (E-hrm-052). Ngày nghỉ sớm hơn
        ngày vào làm thì từ chối (E-hrm-053). Còn hợp đồng bắt đầu
        SAU ngày nghỉ thì hủy cả lượt, không ghi gì (E-hrm-054).
        Ngày nghỉ nằm ở tương lai là hợp lệ, báo trước nghỉ việc.
    end note

    note right of DaXoa
        Không có endpoint nào đặt lại da_xoa = false.
        Mọi truy vấn đọc đều lọc da_xoa = false nên
        hồ sơ đã xóa biến mất khỏi API, kéo theo hợp đồng,
        người phụ thuộc và tài liệu của người đó cũng bị ẩn.
    end note
```

### Hệ quả lan tỏa khi vào trạng thái Đã xóa mềm

| Bản ghi con | Điều thực sự xảy ra | Nguồn mã |
|---|---|---|
| Hợp đồng | Vẫn nằm trong cơ sở dữ liệu, bị ẩn khỏi mọi truy vấn vì `listHopDong` lọc `nhan_vien.da_xoa = false` | `hopDong.service.ts:172-174` |
| Người phụ thuộc | Vẫn nằm trong cơ sở dữ liệu, bị ẩn vì `listNguoiPhuThuoc` lọc tương tự. `deleteNhanVien` trả về `so_npt_an_theo` để màn hình nói rõ ẩn bao nhiêu người | `nguoiPhuThuoc.service.ts:59-61`, `nhanVien.service.ts:237-242` |
| Tài liệu | Vẫn nằm trong cơ sở dữ liệu, bị ẩn. **File scan trên Google Drive không bị đụng tới** và cũng không có gì báo | `taiLieu.service.ts:55-57` |
| Đếm nhân viên của phòng ban | Cột `so_nv` giảm ngay (đếm `da_xoa = false` và `status = 1`); guard chặn xóa phòng ban cũng thôi tính người đã xóa | `phongBan.service.ts:138-142, 239-245` |

### Invalid transitions

| Từ | Sang | Vì sao không được |
|---|---|---|
| Đã xóa mềm | Đang làm việc / Đã nghỉ việc | Không có endpoint khôi phục. Mọi `findFirst` đều kèm `da_xoa: false` nên bản ghi đã xóa không còn tra được qua API. |
| Bất kỳ | Đổi `ma_nv` tại chỗ | `nhanVienUpdateSchema` bỏ hẳn trường `ma_nv`. Mã nhân viên là khóa mà bảng lương và chấm công sau này trỏ vào; đổi tại chỗ là bỏ lại dữ liệu mồ côi. |
| Đã xóa mềm | Tái sử dụng `ma_nv` cho người khác | `createNhanVien` cố ý **không** lọc `da_xoa` khi kiểm trùng mã, nên mã của người đã xóa vẫn bị coi là đã dùng. |

---

## State: HopDong

**Related entity**: HopDong (`hrm_hop_dong`)
**Related BR**: BR-hrm-018, BR-hrm-019, BR-hrm-020, BR-hrm-021, BR-hrm-022 `[SỬA THEO QĐ 1 và 6]`, BR-hrm-024, BR-hrm-026 `[SỬA THEO QĐ 6]`, BR-hrm-029, BR-hrm-052, BR-hrm-053 `[MỚI — QĐ 1]`, BR-hrm-055 `[MỚI — QĐ 3]`, BR-hrm-056 `[MỚI — QĐ 4]`
**Nguồn mã**: `be_maxv/src/services/client/hrm/hopDong.service.ts` (homNayVN dòng 61-66, chonHopDongHienHanh dòng 93-104, doiHopDong dòng 224-273), `be_maxv/src/validators/hrm/hopDong.validator.ts` dòng 67-112.

Bảng `hrm_hop_dong` **không có cột trạng thái**. Trạng thái là giá trị **suy ra lúc đọc** bằng cách so `ngay_bat_dau` / `ngay_ket_thuc` với ngày hôm nay theo giờ Việt Nam. Hệ quả quan trọng: hợp đồng đổi trạng thái **do thời gian trôi**, không do ai bấm nút — không có thao tác ghi nào đánh dấu việc đó.

```mermaid
stateDiagram-v2
    state "Chưa hiệu lực (ngày bắt đầu còn ở tương lai)" as ChuaHieuLuc
    state "Đang hiệu lực (đã bắt đầu, chưa quá hạn)" as DangHieuLuc
    state "Hết hạn (ngày kết thúc đã qua)" as HetHan
    state "Bị ẩn theo nhân viên đã xóa mềm" as AnTheoNv

    [*] --> ChuaHieuLuc : POST /hop-dong với ngày bắt đầu sau hôm nay, ký trước cho tương lai
    [*] --> DangHieuLuc : POST /hop-dong với ngày bắt đầu từ hôm nay trở về trước
    [*] --> HetHan : POST /hop-dong nhập bù hợp đồng cũ đã hết hạn

    ChuaHieuLuc --> DangHieuLuc : ngày hệ thống chạm ngày bắt đầu, KHÔNG có thao tác ghi nào
    DangHieuLuc --> HetHan : ngày hệ thống vượt qua ngày kết thúc
    ChuaHieuLuc --> HetHan : PUT /hop-dong/:id kéo lùi ngày kết thúc về quá khứ

    DangHieuLuc --> DangHieuLuc : POST /hop-dong/doi chốt ngày kết thúc bằng ngày chốt, hôm nay vẫn còn hiệu lực
    DangHieuLuc --> DangHieuLuc : ghi nhận nghỉ việc đặt ngày kết thúc bằng ngày nghỉ ở tương lai, còn hiệu lực tới hết ngày đó (BR-hrm-055)
    DangHieuLuc --> HetHan : ghi nhận nghỉ việc với ngày nghỉ đã qua, ngày kết thúc lùi về ngày đó (BR-hrm-055)
    HetHan --> DangHieuLuc : PUT /hop-dong/:id gia hạn ngày kết thúc

    ChuaHieuLuc --> AnTheoNv : DELETE /nhan-vien/:ma_nv
    DangHieuLuc --> AnTheoNv : DELETE /nhan-vien/:ma_nv
    HetHan --> AnTheoNv : DELETE /nhan-vien/:ma_nv

    ChuaHieuLuc --> [*] : DELETE /hop-dong/:id, xóa cứng không hoàn tác
    DangHieuLuc --> [*] : DELETE /hop-dong/:id, xóa cứng không hoàn tác
    HetHan --> [*] : DELETE /hop-dong/:id, xóa cứng không hoàn tác

    note right of DangHieuLuc
        Nhãn Hợp đồng hiện hành là việc CHỌN trong danh sách,
        không phải trạng thái của một dòng: hệ thống lấy hợp đồng
        đang hiệu lực có ngày bắt đầu muộn nhất; nếu không có cái nào
        đang hiệu lực thì lấy hợp đồng mới nhất trong lịch sử,
        kể cả khi nó chưa hiệu lực hoặc đã hết hạn.
    end note
```

### Sáu điểm dễ hiểu sai về vòng đời hợp đồng

1. **Ngày đổi hợp đồng, hợp đồng CŨ vẫn là hợp đồng hiện hành.** `doiHopDong` đặt `ngay_ket_thuc = ngay_chot`, mà mặc định màn hình đề xuất `ngay_chot` là hôm nay và hợp đồng mới bắt đầu ngày mai (`ThayDoiHopDongDialog.tsx` dòng 61-73). Điều kiện chọn hợp đồng hiện hành là `ngay_ket_thuc >= hôm nay`, nên suốt ngày hôm đó hợp đồng cũ vẫn thắng. Hợp đồng mới chỉ lên hiện hành từ ngày kế tiếp.

2. **Hai mốc "hôm nay" khác nhau đang cùng tồn tại.** `chonHopDongHienHanh` dùng `homNayVN()` (cộng 7 giờ rồi lấy nửa đêm UTC), còn `doiHopDong` dùng `new Date()` rồi `setUTCHours(0,0,0,0)` (`hopDong.service.ts:233-234`) — đúng cách làm mà chính docblock của `homNayVN()` cảnh báo không được dùng. Từ 00:00 đến 06:59 giờ Việt Nam, hai chỗ hiểu "hôm nay" lệch nhau một ngày.

3. **Hiện trạng: không có gì chặn hai hợp đồng cùng đang hiệu lực.** Không có kiểm tra chồng lấn ở `createHopDong` (dòng 185-193) lẫn `updateHopDong` (dòng 196-218). Chỉ riêng đường `/hop-dong/doi` mới ràng buộc `ngay_bat_dau > ngay_chot` ở tầng validator. Gọi thẳng `POST /hop-dong` hai lần cùng khoảng thời gian là tạo được hai hợp đồng chồng nhau.
   **Mức đã chốt `[SỬA THEO QĐ 1]`:** chặn chồng lấn theo cặp (`ma_nv`, `loai_hd`) — hai hợp đồng **khác loại** được phép chạy song song, hai hợp đồng **cùng loại** thì không (BR-hrm-022). Kéo theo: `doiHopDong` bắt buộc nhận thêm `loai_hd_can_chot` để biết chốt hợp đồng thuộc loại nào, nếu không thì đổi hợp đồng chính lại vô tình chốt mất hợp đồng khoán đang chạy song song (BR-hrm-053).

4. **Xóa hợp đồng là xóa cứng, không xác nhận nghiệp vụ.** `deleteHopDong` xóa dòng khỏi cơ sở dữ liệu, kể cả hợp đồng đang hiệu lực và kể cả hợp đồng đã dùng để chốt lương kỳ trước. Không có bản lưu, không có nhật ký.
   **Mức đã chốt `[MỚI — QĐ 15]`:** vẫn xóa cứng, nhưng phải ghi nhật ký **người thao tác** (BR-hrm-066). Đợt này **không** lưu ảnh chụp giá trị trước và sau, nên xóa xong vẫn không dựng lại được nội dung hợp đồng — nhật ký chỉ trả lời được "ai xóa, lúc nào", không trả lời được "xóa mất cái gì".

5. **Hợp đồng đúng một ngày là hợp lệ `[SỬA THEO QĐ 6]`.** `ngay_ket_thuc` được phép **bằng** `ngay_bat_dau` (BR-hrm-026) — hợp đồng khoán một ngày, hợp đồng thời vụ ngắn là chuyện có thật. Hệ quả dễ bỏ sót: luật chống chồng lấn phải dùng khoảng ngày **đóng ở cả hai đầu**; dùng khoảng nửa mở thì hợp đồng một ngày có độ dài bằng không và **lọt hết mọi phép kiểm giao cắt**.

6. **Số hợp đồng là duy nhất trong cả công ty `[MỚI — QĐ 4]`.** Không phải duy nhất theo nhân viên (BR-hrm-056, E-hrm-055). Đây là ràng buộc mới trên dữ liệu đang chạy: phải rà và dọn số hợp đồng trùng ở **mọi tenant** trước khi bật, gộp chung một đợt với ràng buộc mã số thuế người phụ thuộc.

### Invalid transitions

| Từ | Sang | Vì sao không được |
|---|---|---|
| Bất kỳ | Trạng thái "tạm dừng" / "đã hủy" | Bảng không có cột trạng thái. Muốn dừng hợp đồng thì kéo `ngay_ket_thuc` về, không có cách nào khác. |
| Bất kỳ | Đổi `ma_nv` sang nhân viên khác | `hopDongUpdateSchema` bỏ trường `ma_nv`. Muốn chuyển thì xóa rồi tạo lại để có vết. |
| Bị ẩn theo nhân viên đã xóa mềm | Bất kỳ | Không endpoint nào của hợp đồng đọc/ghi được bản ghi thuộc nhân viên `da_xoa = true`; phải khôi phục nhân viên trước, mà chức năng đó chưa có. |
| Đã xóa cứng | Bất kỳ | Không hoàn tác được. |
| Chưa hiệu lực | Đang hiệu lực bằng thao tác thủ công | Không có nút "kích hoạt". Chỉ có cách sửa `ngay_bat_dau` về quá khứ, tức là sửa dữ liệu chứ không phải chuyển trạng thái. |

---

## State: LienKetDrive

**Related entity**: DonVi (`maxv2_sys.don_vi`, nhóm cột `drive*`)
**Related BR**: BR-hrm-040, BR-hrm-043, BR-hrm-045, BR-hrm-046, BR-hrm-047
**Nguồn mã**: `be_maxv/src/services/client/hrm/taiLieuDrive.service.ts` (trangThaiDrive dòng 70-80, luuKetNoiDrive dòng 83-132, ngatKetNoiDrive dòng 163-175, layTokenDonVi dòng 177-217, accessTokenCuaDonVi dòng 231-244), `be_maxv/src/controllers/client/hrm/taiLieu.controller.ts` (driveLienKet dòng 141-156, driveCallback dòng 189-267, driveNgatKetNoi dòng 276-286).

Liên kết Drive là trạng thái **cấp công ty**, không phải cấp người dùng. Toàn bộ file scan hồ sơ nhân sự của công ty phụ thuộc vào trạng thái này.

```mermaid
stateDiagram-v2
    state "Máy chủ chưa cấu hình Google" as ChuaCauHinh
    state "Chưa kết nối" as ChuaKetNoi
    state "Đang chờ người dùng đồng ý" as ChoDongY
    state "Đã kết nối và dùng được" as DaKetNoi
    state "Đã kết nối nhưng hỏng" as KetNoiHong

    [*] --> ChuaCauHinh : thiếu GOOGLE_CLIENT_ID hoặc SECRET hoặc REDIRECT_URI hoặc khóa mã hóa
    [*] --> ChuaKetNoi : máy chủ đủ cấu hình, công ty chưa có token Drive

    ChuaCauHinh --> ChuaKetNoi : quản trị viên nạp đủ 3 biến Google và khóa mã hóa
    ChuaKetNoi --> ChoDongY : GET /tai-lieu/drive/lien-ket, phát vé state ký HMAC hạn 10 phút và gắn cookie

    ChoDongY --> DaKetNoi : callback mang code, vé khớp cookie và còn hạn, đổi được refresh token và mã hóa lưu
    ChoDongY --> ChuaKetNoi : người dùng từ chối cấp quyền
    ChoDongY --> ChuaKetNoi : thiếu tham số, vé không khớp cookie, vé đã dùng, hoặc vé quá 10 phút

    DaKetNoi --> ChoDongY : chủ tài khoản bấm đổi sang tài khoản Google khác
    DaKetNoi --> ChuaKetNoi : DELETE /tai-lieu/drive/ket-noi, chỉ chủ tài khoản
    DaKetNoi --> ChuaKetNoi : Google trả invalid_grant khi làm mới token, hệ thống tự ngắt
    DaKetNoi --> KetNoiHong : đổi khóa mã hóa nên không giải mã được refresh token

    KetNoiHong --> ChoDongY : chủ tài khoản kết nối lại
    KetNoiHong --> ChuaKetNoi : DELETE /tai-lieu/drive/ket-noi

    note right of KetNoiHong
        Màn hình vẫn báo Đã kết nối vì trạng thái chỉ nhìn
        vào việc cột bản mã có rỗng hay không. Mọi thao tác
        tải lên, xem, gỡ file đều trả lỗi cần kết nối lại.
    end note

    note left of ChoDongY
        Đổi sang tài khoản Google KHÁC sẽ xóa driveRootFolderId
        và mọi drive_folder_id của nhân viên, để cây thư mục
        dựng lại trong Drive mới. Con trỏ drive_file_id của
        các file cũ được giữ nguyên, nên file cũ vẫn ở tài khoản
        trước và hệ thống báo không mở được thay vì báo đã mất.
    end note
```

### Ai được làm gì

| Chuyển trạng thái | Vai trò được phép | Nguồn mã |
|---|---|---|
| Chưa kết nối sang Đang chờ đồng ý (kết nối **lần đầu**) | **Hiện trạng:** mọi người dùng có quyền vào công ty (`OWNER`, `OWNER_EMPLOYEE`). **Đã chốt `[SỬA THEO QĐ 10]`: chỉ `OWNER`** (BR-hrm-045, E-hrm-059) | `taiLieu.controller.ts:148-151` — chỉ chặn khi `da_ket_noi = true`, đây chính là BUG-HRM-11 |
| Đã kết nối sang Đang chờ đồng ý (**đổi** tài khoản) | Chỉ `OWNER` | `taiLieu.controller.ts:149-151`, thông điệp `DRIVE_DOI_TAI_KHOAN_CHI_OWNER` |
| Đã kết nối sang Chưa kết nối (ngắt tay) | Chỉ `OWNER` | `taiLieu.controller.ts:281-283`, thông điệp `DRIVE_NGAT_CHI_OWNER` |
| Đã kết nối sang Chưa kết nối (tự ngắt) | Hệ thống, khi Google trả đúng mã `invalid_grant` | `taiLieuDrive.service.ts:238-241` |

### Invalid transitions

| Từ | Sang | Vì sao không được |
|---|---|---|
| Chưa kết nối | Đã kết nối | Bắt buộc đi qua màn đồng ý của Google. Không có đường nào nạp thẳng refresh token vào hệ thống. |
| Đang chờ đồng ý | Đã kết nối, dùng lại vé cũ | Cookie giữ vé bị xóa ngay ở đầu callback, trước mọi nhánh trả về. Mỗi vé đi được đúng một lần, từ đúng một trình duyệt. |
| Đã kết nối | Chưa kết nối, do người không phải chủ tài khoản | Bị chặn 403 trước khi chạm dữ liệu. |
| Đã kết nối | Chưa kết nối, do Google trả 4xx bất kỳ | Cố ý chỉ bám mã `invalid_grant`. Bắt theo cả dải 4xx thì một lần gõ nhầm `GOOGLE_CLIENT_SECRET` sẽ xóa token của **mọi** công ty. |
| Bất kỳ | Xóa `drive_file_id` của tài liệu cũ | `quenThuMucNhanVien` cố ý chỉ dọn ID thư mục, giữ nguyên con trỏ file để không xóa mất dấu vết công ty từng đính giấy tờ gì. |

---

## State: HanGiayTo `[MỚI — QĐ 14]`

**Related entity**: TaiLieu (`hrm_tai_lieu`, cột mới `ngay_het_han`)
**Related BR**: BR-hrm-062, BR-hrm-064, BR-hrm-065
**Nguồn**: chưa có trong mã — cột `ngay_het_han` và toàn bộ vòng đời này là yêu cầu mới chốt ngày 2026-09-07.

Trạng thái hạn của giấy tờ **không có cột lưu**: nó được tính lúc đọc bằng cách so `ngay_het_han` với hôm nay theo giờ Việt Nam, đúng cùng mốc mà hợp đồng đang dùng (BR-hrm-021). Giống hợp đồng, giấy tờ đổi trạng thái **do thời gian trôi**, không do ai bấm nút.

```mermaid
stateDiagram-v2
    state "Không có hạn (ngay_het_han rỗng)" as KhongHan
    state "Còn hạn" as ConHan
    state "Sắp hết hạn" as SapHetHan
    state "Đã hết hạn" as DaHetHan

    [*] --> KhongHan : tạo dòng giấy tờ không nhập ngày hết hạn
    [*] --> ConHan : tạo dòng giấy tờ với ngày hết hạn còn xa
    [*] --> DaHetHan : nhập bù giấy tờ đã quá hạn

    KhongHan --> ConHan : PUT /tai-lieu/:id bổ sung ngày hết hạn
    ConHan --> KhongHan : PUT /tai-lieu/:id xóa ngày hết hạn
    ConHan --> SapHetHan : ngày hệ thống chạm ngưỡng cảnh báo của công ty
    SapHetHan --> DaHetHan : ngày hệ thống vượt qua ngày hết hạn
    ConHan --> DaHetHan : ngày hệ thống vượt qua ngày hết hạn, khi chưa chốt ngưỡng cảnh báo
    DaHetHan --> ConHan : PUT /tai-lieu/:id gia hạn sau khi giấy tờ được cấp lại

    note right of SapHetHan
        CHƯA DÙNG ĐƯỢC cho tới khi chốt OQ-hrm-14.
        Ngưỡng bao nhiêu ngày và khai ở đâu thì chưa ai chốt,
        nên hệ thống CHỈ phân biệt Còn hạn và Đã hết hạn.
        Không được tự đặt một con số mặc định rồi cảnh báo theo nó.
    end note
```

### Quan hệ với chỉ báo hồ sơ đủ/thiếu

Hai chỉ báo này **cố ý tách rời** (BR-hrm-064): hồ sơ đủ/thiếu chỉ xét **có hay không có dòng** giấy tờ theo bộ bắt buộc, không xét dòng đó còn hạn hay đã hết hạn, cũng không xét đã đính file scan chưa. Một nhân viên hoàn toàn có thể vừa **đủ hồ sơ** vừa có giấy tờ **đã hết hạn** — đó là hai câu hỏi khác nhau nên phải hiện thành hai chỉ báo khác nhau. Gộp lại thì người dùng thấy báo thiếu hồ sơ, mở ra đếm thấy đủ dòng, không hiểu vì sao.

Nhân viên **chưa có hợp đồng nào** thì chỉ báo hồ sơ đủ/thiếu trả về **rỗng**, không phải Sai — không có loại hợp đồng thì không có bộ giấy tờ nào để đối chiếu. Danh sách cảnh báo hạn giấy tờ tính trên **mọi nhân viên chưa xóa mềm, kể cả người đã nghỉ việc**: giấy tờ của người đã nghỉ vẫn còn dùng khi quyết toán.

---

## Các thực thể chỉ có vòng đời tồn tại/đã xóa

| Thực thể | Vòng đời | Ghi chú |
|---|---|---|
| Phòng ban | Đang hoạt động (`status = 1`) hoặc Ngừng hoạt động (`status = 0`), cả hai đều có thể chuyển sang Đã xóa mềm (`da_xoa = true`) | Xóa mềm bị chặn khi còn phòng ban con chưa xóa hoặc còn nhân viên chưa xóa (kể cả người đã nghỉ). Đổi `status` sang `0` **không** bị chặn dù phòng ban còn nhân viên — mức đã chốt giữ nguyên chỗ này, máy chủ vẫn không chặn, nhưng giao diện phải hỏi xác nhận nêu đích danh số người còn thuộc phòng ban (BR-hrm-060) `[MỚI — QĐ 11]`. **Hiện trạng sai cần sửa:** phòng ban `status = 0` vẫn hiện trong ô chọn của form nhân viên; mức đã chốt là **ẩn đi, trừ đúng phòng đang gán của chính nhân viên đang sửa** — thiếu vế trừ này thì sửa tên một người thuộc phòng đã ngừng hoạt động là âm thầm xóa mất phòng ban của họ (BR-hrm-061) `[MỚI — QĐ 11]`. |
| Người phụ thuộc | Tồn tại hoặc đã xóa cứng | Xóa cứng vì khóa chính là định danh sinh tự động, không có chuyện cấp lại mã. Bị ẩn theo khi nhân viên bị xóa mềm. |
| Tài liệu | Tồn tại chưa đính file (`drive_file_id` rỗng) hoặc Tồn tại đã đính file, cả hai đều có thể xóa cứng. Trục hạn giấy tờ là **độc lập** với trục này — xem `State: HanGiayTo` | Gỡ file đưa bản ghi về trạng thái chưa đính file và **có** xóa file trên Drive. **Hiện trạng sai:** xóa cả bản ghi thì **không** xóa file trên Drive, file thành mồ côi (BUG-HRM-10). **Mức đã chốt `[SỬA THEO QĐ 12]`:** xóa dòng thì xóa luôn file trên Drive theo kiểu cố hết sức, ghi log khi Drive báo lỗi nhưng **không** để lỗi Drive chặn việc xóa dòng; hộp xác nhận phải nêu đích danh tên file sắp mất (BR-hrm-039). |
