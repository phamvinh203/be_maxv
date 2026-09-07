---
type: srs-flows
feature: hrm
updated: 2026-09-07
---

# HRM — Flows

**Cập nhật 2026-09-07 (đợt chốt nghiệp vụ 16/16).** Phần đánh `[MỚI — QĐ n]` hoặc `[SỬA THEO QĐ n]` là luồng **đã chốt nhưng chưa có trong mã**. Quyết định gốc ghi ở Mục 6.1 của `docs/hrm/CONTEXT_SUMMARY.md`.

> **Mọi sơ đồ trong tài liệu này là Mermaid nhúng trực tiếp trong `.md`.** Theo chính sách hiện hành (`.claude/rules/diagram-selection.md`), phân hệ không sinh file đồ họa rời `.svg` / `.puml` / `.png` và không gọi PlantUML. Hai luồng swimlane trước đây dựng bằng PlantUML đã được chuyển sang Mermaid `flowchart` có lane thể hiện bằng `subgraph`.

## Flow: Tạo hồ sơ nhân viên và ký hợp đồng đầu tiên (Swimlane)

**Trigger**: Chuyên viên nhân sự bấm "Thêm nhân viên" trong màn Danh mục nhân viên.
**Related UC**: UC-hrm-03, UC-hrm-06
**Related FR**: FR-hrm-006, FR-hrm-007, FR-hrm-008, FR-hrm-016
**Related BR**: BR-hrm-003, BR-hrm-004, BR-hrm-016, BR-hrm-017, BR-hrm-025, BR-hrm-026 `[SỬA THEO QĐ 6]`, BR-hrm-022 `[SỬA THEO QĐ 1]`, BR-hrm-056 `[MỚI — QĐ 4]`, BR-hrm-057 `[MỚI — QĐ 5]`, BR-hrm-058 `[MỚI — QĐ 5]`, BR-hrm-061 `[MỚI — QĐ 11]`
**Related E**: E-hrm-003, E-hrm-006, E-hrm-009, E-hrm-016, E-hrm-017, E-hrm-019, E-hrm-055, E-hrm-056, E-hrm-057

```mermaid
flowchart TD
    subgraph HR["Chuyên viên nhân sự"]
        A1[Mở form Thêm nhân viên] --> A2[Nhập họ tên và ngày vào làm, bắt buộc]
        A2 --> A3[Chọn phòng ban: ô chọn CHỈ liệt kê phòng đang hoạt động,<br/>cộng thêm phòng đang gán của chính nhân viên đang sửa<br/>MỚI theo QĐ 11, BR-hrm-061]
        A3 --> A4[Bỏ trống mã nhân viên để hệ thống tự sinh, hoặc tự nhập]
    end

    A4 --> B1
    subgraph BE1["Máy chủ HRM — tạo nhân viên"]
        B1{Đã chọn công ty và còn quyền?} -- Không --> X1[403 Chưa chọn công ty hoặc hết quyền]
        B1 -- Có --> B2{Dữ liệu hợp lệ?}
        B2 -- Sai --> X2[400 kèm tên trường sai]
        B2 -- Đúng --> B3{Có chọn phòng ban?}
        B3 -- Có --> B4{Phòng ban tồn tại và chưa xóa mềm?}
        B4 -- Không --> X3[404 Không tìm thấy phòng ban]
        B4 -- Có --> B5
        B3 -- Không --> B5{Người dùng có nhập mã nhân viên?}
        B5 -- Để trống --> B6[Cấp mã trống nhỏ nhất NV0001 đến NV9999<br/>liệt kê CẢ mã đã xóa mềm]
        B5 -- Có nhập --> B7[Đưa mã về chữ in hoa]
        B6 --> B8{Mã đã được dùng?}
        B7 --> B8
        B8 -- Đã dùng --> X4[409 Mã nhân viên đã tồn tại]
        B8 -- Còn trống --> B9[Ghi bản ghi nhân viên, trả 201]
    end

    B9 --> C1{Ký hợp đồng ngay bây giờ?}
    C1 -- Để sau --> Z1[Hồ sơ chưa có hợp đồng là TRẠNG THÁI HỢP LỆ<br/>các trường hợp đồng trả về rỗng, không bịa số hợp đồng]
    C1 -- Ký ngay --> D1

    subgraph BE2["Máy chủ HRM — ghi hợp đồng"]
        D1{Ngày kết thúc sớm hơn ngày bắt đầu?} -- Đúng --> X5[400 E-hrm-019<br/>bằng nhau là HỢP LỆ, SỬA theo QĐ 6]
        D1 -- Không --> D2{Lương chính lớn hơn 0?}
        D2 -- Không --> X6[400 E-hrm-056, MỚI theo QĐ 5]
        D2 -- Có --> D3{Bật trích BHXH mà lương BHXH bằng 0?}
        D3 -- Đúng --> X7[400 E-hrm-057, MỚI theo QĐ 5]
        D3 -- Không --> D4{Số hợp đồng đã tồn tại trong công ty?}
        D4 -- Có --> X8[409 E-hrm-055, MỚI theo QĐ 4]
        D4 -- Chưa --> D5{Chồng lấn hợp đồng CÙNG LOẠI?}
        D5 -- Có --> X9[409 chồng lấn<br/>kiểm theo cặp ma_nv và loai_hd, khoảng ngày đóng hai đầu<br/>MỚI theo QĐ 1]
        D5 -- Không --> D6[Ghi hợp đồng mới]
        D6 --> D7{Loại hợp đồng là khoán?}
        D7 -- Đúng --> D8[Tắt cờ đoàn viên công đoàn<br/>luật MỘT CHIỀU, rời khoán không tự bật lại]
        D7 -- Không --> D9[Kết giao dịch, trả 201]
        D8 --> D9
    end
```

> Các bước đánh `MỚI`/`SỬA` là hành vi **đã chốt nhưng chưa có trong mã** — đầu việc cho kỹ sư, không phải mô tả hiện trạng.

Bốn điểm nghiệp vụ then chốt của luồng này:

1. **Tạo nhân viên và ký hợp đồng là hai lần ghi tách rời**, không nằm chung một giao dịch. Hồ sơ nhân viên chưa có hợp đồng là trạng thái hợp lệ và các trường hợp đồng hiện hành trả về rỗng, không bịa số hợp đồng tạm.
2. **Kiểm trùng mã nhân viên không lọc cờ đã xóa mềm** — mã của người đã xóa vẫn bị coi là đã dùng, để bảng lương và chấm công cũ không bị gán sang người mới.
3. **Sinh mã và ghi bản ghi không nằm trong cùng giao dịch** (`nhanVien.service.ts:176-192`), nên hai người tạo cùng lúc vẫn có khe đâm vào nhau ở khóa chính.
4. **Luật công đoàn chỉ chạy một chiều**: ký hợp đồng khoán thì tắt cờ đoàn viên; rời khỏi khoán không tự bật lại vì đó là quyết định của người lao động.

**Bốn điểm bổ sung sau đợt chốt, chưa có trong mã và chưa có trong hình:**

5. **Ô chọn phòng ban ẩn phòng đã ngừng hoạt động** `[MỚI — QĐ 11]`, trừ đúng phòng đang gán của chính nhân viên đang sửa (BR-hrm-061). Máy chủ **cố ý không** chặn `status = 0`, vì chặn ở máy chủ thì hồ sơ của người thuộc phòng đã đóng sẽ không sửa được nữa.
6. **Bước ghi hợp đồng có thêm ba phép kiểm** `[MỚI — QĐ 1, 4, 5]`: trùng số hợp đồng trong cả công ty (BR-hrm-056, E-hrm-055), lương chính phải lớn hơn 0 (BR-hrm-057, E-hrm-056), và lương BHXH phải lớn hơn 0 khi bật trích BHXH (BR-hrm-058, E-hrm-057).
7. **Kiểm chồng lấn theo cặp (`ma_nv`, `loai_hd`)** `[MỚI — QĐ 1]`, không phải chỉ theo `ma_nv` — hợp đồng lao động chính và hợp đồng khoán được chạy song song (BR-hrm-022).
8. **Hợp đồng đúng một ngày là hợp lệ** `[SỬA THEO QĐ 6]` (BR-hrm-026), nên phép kiểm chồng lấn phải dùng khoảng ngày đóng ở cả hai đầu, nếu không hợp đồng một ngày lọt lưới.

---

## Flow: Đổi hợp đồng lao động (Swimlane)

**Trigger**: Chuyên viên nhân sự bấm "Đổi hợp đồng" trong tab Lịch sử hợp đồng của một nhân viên.
**Related UC**: UC-hrm-08
**Related FR**: FR-hrm-018, FR-hrm-019
**Related BR**: BR-hrm-019, BR-hrm-021, BR-hrm-023, BR-hrm-024, BR-hrm-025, BR-hrm-052, BR-hrm-053 `[MỚI — QĐ 1]`, BR-hrm-056 `[MỚI — QĐ 4]`, BR-hrm-057 `[MỚI — QĐ 5]`
**Related E**: E-hrm-016, E-hrm-019, E-hrm-020, E-hrm-021, E-hrm-022, E-hrm-055, E-hrm-056, E-hrm-057

```mermaid
flowchart TD
    subgraph HR["Chuyên viên nhân sự"]
        A1[Mở hồ sơ nhân viên, bấm Đổi hợp đồng] --> A2[Màn hình đề xuất ngày chốt là hôm nay,<br/>hợp đồng mới bắt đầu ngày mai]
        A2 --> A3[Kế thừa loại HĐ, kiểu lương, mức lương từ hợp đồng đang chạy]
        A3 --> A4[Sửa số hợp đồng, thời hạn, mức lương mới]
    end

    A4 --> B0["Gửi kèm ngay_chot VÀ loai_hd_can_chot<br/>MỚI theo QĐ 1, BR-hrm-053"]

    subgraph BE["Máy chủ HRM — một giao dịch"]
        B0 --> B1{Ngày kết thúc sớm hơn ngày bắt đầu?}
        B1 -- Đúng --> X1[400 E-hrm-019]
        B1 -- Không --> B2{Ràng buộc lương đạt?}
        B2 -- Không --> X2[400 E-hrm-056 hoặc E-hrm-057]
        B2 -- Đạt --> B3{Nhân viên tồn tại?}
        B3 -- Không --> X3[404 Không tìm thấy nhân viên]
        B3 -- Có --> B4["Tìm hợp đồng đang hiệu lực THUỘC ĐÚNG LOẠI cần chốt<br/>mốc hôm nay phải dùng homNayVN, KHÔNG dùng setUTCHours<br/>SỬA, BUG-HRM-07"]
        B4 --> B5{Có hợp đồng đang hiệu lực?}
        B5 -- Có --> B6{Người dùng có gửi ngày chốt?}
        B6 -- Không --> X4[409 E-hrm-021 Phải chọn ngày chốt hợp đồng cũ]
        B6 -- Có --> B7{Ngày chốt sau ngày bắt đầu hợp đồng cũ?}
        B7 -- Không --> X5[409 E-hrm-022<br/>lý do cũ đã lung lay từ QĐ 6, xem OQ-hrm-15]
        B7 -- Có --> B8[Đặt ngày kết thúc hợp đồng cũ bằng ngày chốt]
        B5 -- Không có --> B9[Bỏ qua bước chốt<br/>báo về là KHÔNG chốt gì, dù client có gửi ngày chốt]
        B8 --> B10{Số hợp đồng mới đã tồn tại trong công ty?}
        B9 --> B10
        B10 -- Có --> X6[409 E-hrm-055, MỚI theo QĐ 4]
        B10 -- Chưa --> B11[Ghi hợp đồng mới]
        B11 --> B12{Loại hợp đồng mới là khoán?}
        B12 -- Đúng --> B13[Tắt cờ đoàn viên công đoàn]
        B12 -- Không --> B14[Kết giao dịch, trả 201 kèm cờ đã chốt hợp đồng cũ]
        B13 --> B14
    end

    B14 --> Z1["Lịch sử hợp đồng: hợp đồng cũ đã có ngày kết thúc,<br/>hợp đồng mới nằm trên đầu.<br/>Trong ĐÚNG ngày đổi, cột Hợp đồng hiện hành vẫn hiện hợp đồng CŨ<br/>vì điều kiện chọn là ngày kết thúc lớn hơn hoặc bằng hôm nay"]
```

Ba điểm dễ hiểu sai:

1. **Màn hình không gửi mã hợp đồng cũ, nhưng BẮT BUỘC gửi LOẠI hợp đồng cần chốt** `[MỚI — QĐ 1]`. Máy chủ vẫn tự tìm hợp đồng đang hiệu lực để chốt (vì màn hình có thể đang xem dữ liệu cũ), nhưng tìm **trong đúng loại người dùng chỉ định** (`loai_hd_can_chot`, BR-hrm-053). Từ khi hai hợp đồng khác loại được phép chạy song song, `findFirst` không kèm loại là mơ hồ đúng kiểu lỗi âm thầm: đổi hợp đồng chính lại chốt mất hợp đồng khoán.
2. **Trong đúng ngày đổi, cột "Hợp đồng hiện hành" vẫn hiện hợp đồng CŨ** — điều kiện chọn là `ngay_ket_thuc >= hôm nay`, mà ngày chốt mặc định chính là hôm nay. Hợp đồng mới lên hiện hành từ ngày kế tiếp.
3. **Hai mốc "hôm nay" lệch nhau.** Nhánh tìm hợp đồng cũ trong `doiHopDong` dùng nửa đêm theo lịch UTC (`hopDong.service.ts:233-234`), còn nhánh chọn hợp đồng hiện hành dùng nửa đêm theo giờ Việt Nam (`homNayVN()`). Từ 00:00 đến 06:59 giờ Việt Nam, hai chỗ hiểu khác nhau một ngày. **Phải sửa cùng lượt với luật chống chồng lấn** — sửa một trong hai thì hai hàm bất đồng bảy tiếng mỗi ngày, sinh ra lỗi khó lần hơn lỗi đang có.
4. **Hợp đồng mới cũng phải qua ba phép kiểm mới** `[MỚI — QĐ 4, 5]`: trùng số hợp đồng toàn công ty, lương chính lớn hơn 0, lương BHXH lớn hơn 0 khi bật trích BHXH. Còn một điểm **chưa chốt**: từ khi hợp đồng một ngày được cho phép (QĐ 6), lý do cũ của BR-hrm-024b không còn đúng — `ngay_chot` có được **bằng** `ngay_bat_dau` của hợp đồng đang hiệu lực không? Xem OQ-hrm-15, đợt này giữ nguyên hành vi cũ.

---

## Flow: Ghi nhận nhân viên nghỉ việc và tự chốt hợp đồng `[MỚI — QĐ 3]`

**Trigger**: Chuyên viên nhân sự mở hồ sơ nhân viên và chuyển trạng thái sang Đã nghỉ.
**Related UC**: UC-hrm-05
**Related FR**: FR-hrm-036, FR-hrm-010
**Related BR**: BR-hrm-010, BR-hrm-054, BR-hrm-055
**Related E**: E-hrm-052, E-hrm-053, E-hrm-054
**Trạng thái**: chưa có trong mã — cột `ngay_nghi_viec` và toàn bộ luồng này là yêu cầu mới.

```mermaid
sequenceDiagram
    actor HR as Chuyên viên nhân sự
    participant FE as Giao diện HRM
    participant BE as Máy chủ HRM
    participant TEN as CSDL công ty

    HR->>FE: Mở hồ sơ nhân viên, chuyển trạng thái sang Đã nghỉ
    FE-->>HR: Hiện ô nhập ngày nghỉ việc, đánh dấu bắt buộc
    HR->>FE: Nhập ngày nghỉ rồi bấm Lưu
    FE->>BE: PUT /hrm/nhan-vien/:ma_nv với status = 0 kèm ngay_nghi_viec

    alt Thiếu ngày nghỉ việc
        BE-->>FE: 400 E-hrm-052 phải nhập ngày nghỉ việc
    else Ngày nghỉ sớm hơn ngày vào làm
        BE-->>FE: 400 E-hrm-053 ngày nghỉ không được trước ngày vào làm
    else Dữ liệu hợp lệ
        BE->>TEN: Mở giao dịch
        BE->>TEN: Đọc toàn bộ hợp đồng của nhân viên
        alt Còn hợp đồng bắt đầu SAU ngày nghỉ
            BE->>TEN: Hủy giao dịch, không ghi gì
            BE-->>FE: 409 E-hrm-054 nêu đích danh số hợp đồng và ngày bắt đầu
            FE-->>HR: Yêu cầu xóa hoặc sửa hợp đồng đó trước
        else Không vướng hợp đồng tương lai
            BE->>TEN: Đặt status = 0 và lưu ngay_nghi_viec
            BE->>TEN: Chốt mọi hợp đồng còn mở, đặt ngay_ket_thuc bằng ngay_nghi_viec
            BE->>TEN: Đóng giao dịch
            BE-->>FE: 200 kèm danh sách số hợp đồng vừa chốt
            FE-->>HR: Báo rõ vừa chốt những hợp đồng nào
        end
    end
```

Bốn điểm nghiệp vụ then chốt:

1. **Ba việc nằm trong MỘT giao dịch** (BR-hrm-055): đổi trạng thái, lưu ngày nghỉ, chốt hợp đồng. Chốt được hợp đồng mà không đổi được trạng thái — hoặc ngược lại — là để lại dữ liệu nửa vời không có gì báo, và phân hệ Lương sẽ đọc trúng đúng phần sai.
2. **"Hợp đồng còn mở" nghĩa là `ngay_ket_thuc` rỗng hoặc muộn hơn ngày nghỉ.** Hợp đồng đã kết thúc trước ngày nghỉ thì để nguyên, không kéo dài ra.
3. **Ngày nghỉ ở tương lai là hợp lệ** (BR-hrm-054) — báo trước nghỉ việc là chuyện thường. Hệ quả: hợp đồng vừa bị chốt vẫn **đang hiệu lực** cho tới hết ngày đó, và nhân viên đã mang trạng thái Đã nghỉ trong khi vẫn còn hợp đồng chạy. Phân hệ Lương phải xử lý được cặp trạng thái này.
4. **Phản hồi phải liệt kê hợp đồng đã chốt** (FR-hrm-036). Hệ thống vừa tự sửa dữ liệu hợp đồng của người dùng; làm âm thầm thì lần sau họ mở lịch sử hợp đồng ra và không hiểu vì sao ngày kết thúc bị đổi.

**Chiều ngược lại chưa chốt** — đưa nhân viên từ Đã nghỉ trở lại Đang làm thì xử lý `ngay_nghi_viec` và các hợp đồng đã bị tự chốt ra sao? Xem OQ-hrm-12.

**Một khoảng trống đáng lưu ý:** luồng này **tự sửa `ngay_ket_thuc` của hợp đồng** nhưng không nằm trong năm nhóm thao tác phải ghi nhật ký ở BR-hrm-066. Đây là hệ quả của việc QĐ 15 liệt kê đúng năm nhóm và không nhóm nào phủ trường hợp này.

---

## Flow: Liên kết Google Drive cấp công ty qua OAuth

**Trigger**: Người dùng bấm "Kết nối Google Drive" (hoặc bấm "Thêm file scan" khi công ty chưa kết nối).
**Related UC**: UC-hrm-11
**Related FR**: FR-hrm-027, FR-hrm-028, FR-hrm-029
**Related BR**: BR-hrm-040, BR-hrm-041, BR-hrm-043, BR-hrm-045 `[SỬA THEO QĐ 10]`, BR-hrm-047
**Related E**: E-hrm-041, E-hrm-043, E-hrm-044, E-hrm-047, E-hrm-048, E-hrm-049, E-hrm-050, E-hrm-051

```mermaid
sequenceDiagram
    actor HR as Người dùng HRM
    participant FE as Giao diện HRM
    participant POP as Cửa sổ popup
    participant BE as Máy chủ HRM
    participant SYS as CSDL điều phối
    participant TEN as CSDL công ty
    participant G as Google

    HR->>FE: Mở tab Hồ sơ của một nhân viên
    FE->>BE: GET /hrm/tai-lieu/drive/trang-thai
    BE->>SYS: Đọc email và bản mã token của công ty
    SYS-->>BE: Trạng thái kết nối hiện tại
    BE-->>FE: may_chu_san_sang, da_ket_noi, email

    alt Máy chủ chưa cấu hình Google hoặc thiếu khóa mã hóa
        FE-->>HR: Ẩn khối kết nối Drive, không cho đính file
    else Máy chủ sẵn sàng
        HR->>FE: Bấm Kết nối Google Drive
        FE->>BE: GET /hrm/tai-lieu/drive/lien-ket
        BE->>SYS: Kiểm người dùng còn quyền vào công ty đang chọn

        alt Công ty đã kết nối và người dùng không phải chủ tài khoản
            BE-->>FE: 403 E-hrm-041 chỉ chủ tài khoản mới đổi được tài khoản Google
            FE-->>HR: Hiện thông báo nhờ chủ tài khoản thực hiện
        else Được phép kết nối
            BE->>BE: Tạo vé state ký HMAC, hạn 10 phút
            BE-->>FE: Trả url đăng nhập Google, kèm cookie giữ vé
            FE->>POP: Mở popup tới màn đồng ý của Google
            POP->>G: Yêu cầu quyền drive.file và email
            HR->>G: Bấm Cho phép

            G->>BE: Chuyển hướng về callback kèm code và state
            BE->>BE: Đọc rồi xóa cookie giữ vé ngay lập tức

            alt Vé không khớp cookie, đã dùng, hoặc quá 10 phút
                BE-->>POP: Trang báo phiên kết nối không hợp lệ, đóng sau 4 giây
                POP-->>HR: Đề nghị bấm lại từ đầu trên chính trình duyệt này
            else Vé hợp lệ
                BE->>G: Đổi code lấy refresh token và email tài khoản
                G-->>BE: refresh token và email
                BE->>SYS: Lưu token đã mã hóa, xóa ID thư mục gốc cũ

                opt Kết nối bằng tài khoản Google khác tài khoản trước
                    BE->>TEN: Xóa mọi ID thư mục nhân viên đã nhớ
                    Note over BE,TEN: Con trỏ file cũ được giữ nguyên. File cũ vẫn nằm ở tài khoản trước, hệ thống báo không mở được thay vì báo đã mất.
                end

                BE-->>POP: Trang báo đã kết nối kèm email, tự đóng sau 0,3 giây
                FE->>BE: Hỏi lại GET /hrm/tai-lieu/drive/trang-thai
                BE-->>FE: da_ket_noi bằng đúng, kèm email
                FE-->>HR: Hiện dòng File scan lưu ở Drive của email này
            end
        end
    end

    alt Người dùng bấm Từ chối ở màn Google
        G->>BE: Chuyển hướng về callback kèm tham số lỗi
        BE-->>POP: Trang báo bạn chưa cấp quyền truy cập Google Drive
    end

    alt Máy chủ chưa cấu hình khóa mã hóa
        BE-->>POP: Trang báo E-hrm-044 chưa lưu được kết nối vì thiếu khóa mã hóa
    end
```

**Lý do popup thay vì chuyển hướng cả trang**: chuyển hướng làm trang tải lại và mất luôn file người dùng vừa chọn, buộc chọn lại từ đầu.

**Vì sao callback được miễn đăng nhập**: Google điều hướng trình duyệt từ tên miền khác về, nên cookie phiên (SameSite Strict) không được gửi kèm; nếu bắt đăng nhập thì popup chỉ nhận về JSON 401 và không bao giờ đóng. Danh tính công ty lấy từ vé state đã ký HMAC kèm hạn dùng, và vé bị khóa vào đúng trình duyệt đã xin nó bằng một cookie riêng dùng một lần.

**Siết quyền kết nối lần đầu** `[SỬA THEO QĐ 10]` — **chưa có trong mã, đây là BUG-HRM-11.** Hiện `taiLieu.controller.ts:148-151` chỉ chặn khi công ty **đã** kết nối, nên bất kỳ ai vào được công ty cũng nối kho tài liệu của **cả công ty** vào Drive **cá nhân** của họ. Mức đã chốt: cả ba việc — nối lần đầu, đổi tài khoản, ngắt kết nối — **chỉ `OWNER`** (BR-hrm-045, E-hrm-059). Sau khi đã nối thì mọi người có quyền vào công ty vẫn tải lên, xem và gỡ file bình thường; siết là siết ở việc **chọn Drive của ai**, không phải ở việc dùng.

Phải **sửa giao diện cùng lượt với máy chủ**: người không phải chủ tài khoản không được thấy nút "Kết nối Google Drive" rồi bấm vào và nhận 403. Giao diện hiện thẳng thông báo nhờ chủ tài khoản liên kết Drive.

---

## Flow: Tải file scan lên Drive của công ty

**Trigger**: Người dùng chọn file trong form Hồ sơ giấy tờ và bấm Lưu.
**Related UC**: UC-hrm-12
**Related FR**: FR-hrm-030, FR-hrm-031
**Related BR**: BR-hrm-035, BR-hrm-036, BR-hrm-037, BR-hrm-042
**Related E**: E-hrm-031, E-hrm-032, E-hrm-033, E-hrm-034, E-hrm-035, E-hrm-036, E-hrm-039, E-hrm-040, E-hrm-045, E-hrm-046

```mermaid
sequenceDiagram
    actor HR as Người dùng HRM
    participant FE as Giao diện HRM
    participant BE as Máy chủ HRM
    participant TEN as CSDL công ty
    participant SYS as CSDL điều phối
    participant G as Google Drive

    HR->>FE: Chọn file ảnh hoặc PDF rồi bấm Lưu
    FE->>FE: Kiểm dung lượng tại chỗ, trần 10MB

    alt File vượt 10MB
        FE-->>HR: Báo file nặng bao nhiêu MB và đề nghị chọn file nhỏ hơn
    else Trong giới hạn
        FE->>BE: POST /hrm/tai-lieu/:id/file dạng multipart, một file
        BE->>BE: Tầng nhận file chặn cứng trần 10MB và tối đa một file

        alt Vượt trần hoặc gửi nhiều file hoặc sai định dạng gói tin
            BE-->>FE: 409 E-hrm-032 hoặc E-hrm-034 hoặc E-hrm-035
        else Nhận được file
            BE->>TEN: Tra tài liệu và nhân viên chưa bị xóa mềm
            alt Không tìm thấy tài liệu
                BE-->>FE: 404 E-hrm-031 không tìm thấy tài liệu
            else Tìm thấy
                BE->>BE: Kiểm lại dung lượng và kiểu file cho phép
                alt Kiểu file không phải ảnh JPEG PNG WEBP HEIC hay PDF
                    BE-->>FE: 409 E-hrm-033 kèm đúng kiểu file đã gửi lên
                else Kiểu file hợp lệ
                    BE->>SYS: Đọc và giải mã refresh token của công ty
                    alt Công ty chưa kết nối Drive
                        BE-->>FE: 409 E-hrm-039 bấm Thêm file để đăng nhập Google
                    else Có token
                        BE->>G: Đổi refresh token lấy access token ngắn hạn
                        alt Google trả invalid_grant vì quyền đã bị thu hồi
                            BE->>SYS: Tự xóa kết nối Drive của công ty
                            BE->>TEN: Xóa mọi ID thư mục nhân viên đã nhớ
                            BE-->>FE: 409 E-hrm-040 vui lòng kết nối lại
                        else Lấy được access token
                            opt Công ty chưa có thư mục gốc
                                BE->>G: Tạo thư mục maxv rồi thư mục mã số thuế và tên công ty
                                G-->>BE: ID thư mục công ty
                                BE->>SYS: Nhớ ID thư mục công ty
                            end
                            opt Nhân viên chưa có thư mục riêng
                                BE->>G: Tạo thư mục mã nhân viên và họ tên
                                G-->>BE: ID thư mục nhân viên
                                BE->>TEN: Nhớ ID thư mục nhân viên
                            end
                            BE->>G: Tải file mới lên thư mục nhân viên
                            G-->>BE: ID file, tên, kiểu, dung lượng
                            opt Tài liệu đã có file cũ
                                BE->>G: Xóa file cũ, bỏ qua nếu xóa không được
                                Note over BE,G: Xóa file cũ SAU khi file mới lên thành công. Hỏng giữa chừng thì thừa một file còn hơn mất cả hai.
                            end
                            BE->>TEN: Ghi con trỏ file vào tài liệu
                            BE-->>FE: 201 kèm tên file, kiểu và dung lượng
                            FE-->>HR: Hiện nút xem file và nút gỡ file
                        end
                    end
                end
            end
        end
    end

    alt Máy chủ không gọi ra được Google
        BE-->>FE: 502 E-hrm-046 sự cố mạng phía máy chủ, thử lại sau ít phút
    end
```

---

## Flow: Xem, gỡ file scan và xóa bản ghi giấy tờ

**Trigger**: Người dùng bấm biểu tượng xem file, bấm gỡ file, hoặc bấm xóa dòng giấy tờ.
**Related UC**: UC-hrm-13
**Related FR**: FR-hrm-032, FR-hrm-033, FR-hrm-034
**Related BR**: BR-hrm-038, BR-hrm-039 `[SỬA THEO QĐ 12]`, BR-hrm-048, BR-hrm-062 `[MỚI — QĐ 14]`, BR-hrm-066 `[MỚI — QĐ 15]`
**Related E**: E-hrm-031, E-hrm-037, E-hrm-038

```mermaid
sequenceDiagram
    actor HR as Người dùng HRM
    participant FE as Giao diện HRM
    participant BE as Máy chủ HRM
    participant TEN as CSDL công ty
    participant G as Google Drive

    HR->>FE: Bấm biểu tượng xem file scan
    FE->>BE: GET /hrm/tai-lieu/:id/file
    BE->>TEN: Tra tài liệu và con trỏ file

    alt Tài liệu chưa đính file
        BE-->>FE: 404 E-hrm-037 tài liệu này chưa đính file scan
    else Có con trỏ file
        BE->>G: Tải nội dung file, chặn trần 10MB
        alt Google trả 404
            BE-->>FE: 404 E-hrm-038 có thể file đã bị xóa hoặc nằm ở tài khoản Google kết nối trước đây
        else Lấy được nội dung
            BE-->>FE: Trả nguyên byte, hiển thị tại chỗ, cấm lưu vào bộ nhớ đệm
            FE-->>HR: Hiện ảnh hoặc PDF ngay trong ứng dụng
        end
    end

    HR->>FE: Bấm Gỡ file scan rồi xác nhận
    FE->>BE: DELETE /hrm/tai-lieu/:id/file
    BE->>G: Xóa file trên Drive
    BE->>TEN: Xóa bốn trường con trỏ, giữ nguyên dòng giấy tờ
    BE-->>FE: 200
    FE-->>HR: Dòng giấy tờ còn nguyên, chỉ mất phần file đính kèm

    HR->>FE: Bấm Xóa cả dòng giấy tờ
    FE-->>HR: Hộp xác nhận nêu ĐÍCH DANH tên file sắp mất
    HR->>FE: Xác nhận
    FE->>BE: DELETE /hrm/tai-lieu/:id
    BE->>G: Xóa file trên Drive, cố hết sức
    alt Drive báo lỗi
        BE->>TEN: Ghi log lỗi Drive, VẪN xóa dòng giấy tờ
    else Drive xóa được
        BE->>TEN: Xóa cứng dòng giấy tờ
    end
    BE->>TEN: Ghi nhật ký người thao tác (BR-hrm-066 nhóm 4)
    BE-->>FE: 200
    Note over BE,G: SUA THEO QD 12 — chua co trong ma, day la BUG-HRM-10. Hien tai duong nay KHONG goi Google nen file scan o lai Drive vinh vien khong con ban ghi nao tro toi. Muc da chot: xoa dong thi xoa luon file, nhung loi Drive KHONG duoc chan viec xoa dong.
```

**Vì sao lấy nội dung file qua máy chủ thay vì trỏ thẻ ảnh thẳng vào API**: thẻ ảnh tự đi một yêu cầu nằm ngoài lớp gọi API chung, nên khi phiên hết hạn nó chỉ nhận 401 và hiện hình vỡ, không kích hoạt được cơ chế tự làm mới phiên rồi thử lại.

---

## Flow: Chỉ báo hồ sơ đủ/thiếu và cảnh báo hạn giấy tờ `[MỚI — QĐ 14]`

**Trigger**: Người dùng mở danh sách nhân viên, mở chi tiết một nhân viên, hoặc mở danh sách cảnh báo hạn giấy tờ.
**Related FR**: FR-hrm-038, FR-hrm-039, FR-hrm-040, FR-hrm-041
**Related BR**: BR-hrm-062, BR-hrm-063, BR-hrm-064, BR-hrm-065
**Related E**: E-hrm-060, E-hrm-061
**Trạng thái**: chưa có trong mã — bảng `hrm_giay_to_bat_buoc` và cột `ngay_het_han` đều là yêu cầu mới.

```mermaid
flowchart TD
    A[Người dùng mở danh sách nhân viên] --> B[Máy chủ đọc danh sách nhân viên chưa xóa mềm]
    B --> C{Công ty đã khai bộ giấy tờ bắt buộc chưa}
    C -- Chưa khai --> D[Danh mục rỗng là hợp lệ<br/>Không ai bị coi là thiếu hồ sơ<br/>Chỉ báo trả về rỗng]
    C -- Đã khai --> E[Lấy loại hợp đồng đang hiệu lực của từng nhân viên<br/>theo BR-hrm-019 và BR-hrm-052]
    E --> F{Nhân viên có hợp đồng nào không}
    F -- Không có --> G[ho_so_du trả về RỖNG, không phải Sai<br/>Không có loại hợp đồng thì không có gì để đối chiếu]
    F -- Có --> H[Lấy HỢP của các bộ giấy tờ bắt buộc<br/>của mọi loại hợp đồng đang chạy]
    H --> I[Đối chiếu với các dòng hrm_tai_lieu của nhân viên<br/>CHỈ xét có hay không có dòng cùng loại]
    I --> J{Còn loại nào thiếu không}
    J -- Còn --> K[ho_so_du bằng Sai<br/>Trả kèm danh sách giay_to_thieu]
    J -- Không --> L[ho_so_du bằng Đúng]

    M[Người dùng mở danh sách cảnh báo hạn] --> N[Quét mọi giấy tờ của nhân viên chưa xóa mềm<br/>KỂ CẢ người đã nghỉ việc]
    N --> O{ngay_het_han có giá trị không}
    O -- Rỗng --> P[Không có hạn, không cảnh báo]
    O -- Có --> Q{So với hôm nay theo giờ Việt Nam}
    Q -- Sớm hơn hôm nay --> R[da_het_han, đưa vào danh sách cảnh báo]
    Q -- Còn xa --> S[con_han]
    Q -- Trong ngưỡng cảnh báo --> T[sap_het_han<br/>CHƯA DÙNG ĐƯỢC tới khi chốt OQ-hrm-14]
```

Ba điểm nghiệp vụ then chốt:

1. **Hai chỉ báo tách rời, không gộp** (BR-hrm-064). Hồ sơ đủ/thiếu chỉ xét **có hay không có dòng** giấy tờ; không xét dòng đó đã đính file scan chưa, cũng không xét còn hạn hay đã hết hạn. Một nhân viên có thể vừa đủ hồ sơ vừa có giấy tờ đã hết hạn — hai câu hỏi khác nhau, hai chỉ báo khác nhau.
2. **Lấy HỢP chứ không lấy giao** khi nhân viên có nhiều hợp đồng đang chạy: mỗi hợp đồng đều phát sinh nghĩa vụ hồ sơ của riêng nó.
3. **Ngưỡng "sắp hết hạn" chưa chốt** (OQ-hrm-14). Tới khi có ngưỡng, hệ thống **chỉ** phân biệt còn hạn và đã hết hạn; **không** được tự đặt một con số mặc định rồi cảnh báo theo nó.

**Ràng buộc hiệu năng**: chỉ báo cho cả danh sách phải lấy trong **một lượt truy vấn**, không truy vấn theo từng dòng (FR-hrm-040, cùng ràng buộc với NFR-hrm-004). Đây là điểm dễ hỏng nhất của tính năng này: đối chiếu bộ giấy tờ bắt buộc cho từng nhân viên là công thức sinh N+1 rất tự nhiên.
