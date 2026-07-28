# Hướng dẫn sử dụng phần mềm Hóa đơn điện tử (hdđt_maxv)

Tài liệu mô tả đầy đủ các màn hình, chức năng và cách thao tác của phần mềm **đúng theo giao diện hiện có**.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Tài khoản: Đăng ký – Đăng nhập – Quên mật khẩu](#2-tài-khoản-đăng-ký--đăng-nhập--quên-mật-khẩu)
3. [Thêm công ty / Hộ kinh doanh lần đầu](#3-thêm-công-ty--hộ-kinh-doanh-lần-đầu)
4. [Thanh điều hướng trên cùng](#4-thanh-điều-hướng-trên-cùng)
5. [Đăng nhập Thuế điện tử (GDT)](#5-đăng-nhập-thuế-điện-tử-gdt)
6. [Màn hình Hóa đơn điện tử](#6-màn-hình-hóa-đơn-điện-tử)
7. [Đồng bộ từ Thuế](#7-đồng-bộ-từ-thuế)
8. [Xuất file Excel tổng hợp và hóa đơn](#8-xuất-file-excel-tổng-hợp-và-hóa-đơn)
9. [Trang Cài đặt](#9-trang-cài-đặt)
10. [Bảng tra cứu giá trị hiển thị](#10-bảng-tra-cứu-giá-trị-hiển-thị)
11. [Xử lý sự cố thường gặp](#11-xử-lý-sự-cố-thường-gặp)
12. [Các chức năng đang phát triển](#12-các-chức-năng-đang-phát-triển)

---

## 1. Tổng quan

Phần mềm giúp lấy hóa đơn điện tử **mua vào (đầu vào)** và **bán ra (đầu ra)** từ hệ thống Thuế điện tử (GDT) về lưu tại cơ sở dữ liệu riêng của từng công ty, sau đó tra cứu, xem, in và xuất ra Excel/HTML/XML/PDF.

### Mô hình dữ liệu

- Một **tài khoản người dùng** có thể quản lý **nhiều công ty / hộ kinh doanh**.
- Mỗi công ty có **cơ sở dữ liệu riêng**. Dữ liệu hóa đơn không dùng chung giữa các công ty.
- Mọi thao tác (tra cứu, đồng bộ, xuất file) luôn áp dụng cho **công ty đang chọn** trên thanh điều hướng.

### Hai loại đăng nhập — cần phân biệt rõ

| | Đăng nhập ứng dụng | Đăng nhập Thuế điện tử (GDT) |
|---|---|---|
| Dùng để | Vào phần mềm | Lấy dữ liệu từ hệ thống Thuế |
| Thông tin | Email + mật khẩu | MST + mật khẩu + captcha |
| Thời hạn | Duy trì lâu dài | Ngắn (khoảng vài phút), chỉ tồn tại trong tab đang mở |
| Đăng nhập lại | Khi hết phiên | Thường xuyên, mỗi khi thao tác lấy dữ liệu |

> Token Thuế điện tử được lưu riêng **theo từng MST**. Nếu bạn đăng nhập GDT bằng MST khác với công ty đang chọn, phần mềm sẽ **từ chối chạy tiếp** thao tác để tránh ghi nhầm dữ liệu sang công ty khác.

### Trình duyệt khuyến nghị

**Chrome hoặc Edge.** Chức năng *Xuất file Excel tổng hợp và hóa đơn* cần API chọn thư mục (File System Access) mà các trình duyệt khác chưa hỗ trợ.

---

## 2. Tài khoản: Đăng ký – Đăng nhập – Quên mật khẩu

### 2.1. Đăng ký tài khoản

**Đường dẫn:** `/register` — từ màn hình đăng nhập bấm liên kết **Đăng ký**.

Điền form **Đăng ký tài khoản**:

| Trường | Quy tắc |
|---|---|
| Họ tên | Bắt buộc, tối đa 100 ký tự, không xuống dòng |
| Email | Bắt buộc, đúng định dạng email |
| Số điện thoại | Bắt buộc, 9–11 chữ số |
| Mật khẩu | Tối thiểu 8 ký tự, có ít nhất 1 chữ cái và 1 chữ số |
| Xác nhận mật khẩu | Phải trùng khớp với mật khẩu |

Bấm **Đăng ký**.

- Thành công → chuyển sang trang **Đăng nhập**, ô Email đã được điền sẵn, con trỏ nhảy vào ô Mật khẩu.
- Email đã tồn tại → báo lỗi ngay tại ô Email.
- Ô mật khẩu có biểu tượng con mắt để hiện/ẩn nội dung đang gõ.

### 2.2. Đăng nhập

**Đường dẫn:** `/login`

1. Nhập **Email** và **Mật khẩu**.
2. Bấm **Đăng nhập** (hoặc nhấn Enter).

Kết quả:
- Thành công → vào thẳng màn hình **Hóa đơn điện tử**.
- Sai thông tin → hiện thông báo lỗi màu đỏ ngay dưới ô mật khẩu.

Hai liên kết phía dưới: **Quên mật khẩu?** và **Đăng ký**.

> Khi đã đăng nhập, nếu gõ tay vào `/login` hay `/register` thì phần mềm tự chuyển về trang chính.

### 2.3. Quên mật khẩu

**Đường dẫn:** `/forgot-password` — gồm 2 bước trên cùng một trang.

**Bước 1 — Xin mã xác thực**
1. Nhập **Email** đã đăng ký.
2. Bấm **Gửi mã xác thực**.
3. Hệ thống gửi mã **6 chữ số** vào hộp thư, có hiệu lực **10 phút**.

**Bước 2 — Đặt lại mật khẩu**
1. Nhập **Mã xác thực** (6 chữ số).
2. Nhập **Mật khẩu mới** và **Xác nhận mật khẩu mới** (cùng quy tắc như khi đăng ký).
3. Bấm **Đặt lại mật khẩu** → chuyển về trang Đăng nhập, đăng nhập lại bằng mật khẩu mới.

Các liên kết hỗ trợ:
- **Đổi email** — quay lại bước 1 khi gõ nhầm email. Lưu ý: hệ thống giới hạn số lần gửi mã cho mỗi email trong 1 giờ, không nên bấm gửi lại nhiều lần.
- **Quay lại đăng nhập**.

### 2.4. Đăng xuất

Bấm **avatar** góc trên bên phải → **Đăng xuất**. Thao tác này đồng thời xóa toàn bộ phiên đăng nhập Thuế điện tử đang lưu trong tab.

---

## 3. Thêm công ty / Hộ kinh doanh lần đầu

Sau khi đăng ký và đăng nhập lần đầu (chưa có công ty nào), phần mềm **tự mở hộp thoại** *Thêm công ty/Hộ kinh doanh* kèm lời chào "Chào mừng! Hãy thêm công ty/hộ kinh doanh để bắt đầu sử dụng."

### Các trường trong form

| Trường | Bắt buộc | Ghi chú |
|---|:--:|---|
| **Mã số thuế** | ✔ | Nhập MST 10 số. Sau khoảng nửa giây ngừng gõ, phần mềm **tự tra cứu cơ quan thuế** và điền sẵn Tên công ty + Địa chỉ. Trong lúc tra cứu có vòng xoay nhỏ ở cuối ô. |
| **Tên công ty** | ✔ | Tự điền từ kết quả tra cứu MST, có thể sửa lại |
| **Địa chỉ** | ✔ | Tự điền từ kết quả tra cứu MST, có thể sửa lại |
| Số điện thoại công ty | | |
| Loại hình kinh doanh | | Gợi ý: Công ty TNHH, cổ phần, hộ kinh doanh... |

### Thao tác

- **Lưu** — tạo công ty. Hệ thống khởi tạo cơ sở dữ liệu riêng cho MST này. Tạo xong hộp thoại tự đóng.
- **Để sau** — bỏ qua, vào thẳng ứng dụng (chưa có công ty thì chưa lấy được hóa đơn).

Nếu MST nhập sai định dạng, khi bấm Lưu sẽ báo *"Mã số thuế không hợp lệ."*

> Sau này muốn thêm công ty khác: xem [mục 9.1](#91-quản-lý-công-ty--hộ-kinh-doanh).

---

## 4. Thanh điều hướng trên cùng

Thanh xanh trên cùng luôn hiển thị ở mọi màn hình sau khi đăng nhập.

### Bên trái

| Thành phần | Tác dụng |
|---|---|
| **Logo MAXV** | Bấm để về trang chính |
| **Hóa đơn và tờ khai** | Bấm để về trang chính (màn hình Hóa đơn điện tử) |

### Bên phải

#### Nút tên công ty đang chọn

Hiển thị tên công ty đang làm việc, kèm biểu tượng tòa nhà có **chấm trạng thái**:

- 🟢 **Chấm xanh lá** — công ty này **đã đăng nhập** Thuế điện tử trong tab hiện tại.
- 🟠 **Chấm cam** — **chưa đăng nhập** Thuế điện tử.

Bấm vào nút để mở menu:

1. **Danh sách các công ty** — mỗi dòng hiện tên đơn vị (dòng trên) và mã số thuế (dòng dưới). Công ty đang dùng có dấu ✓ màu xanh. Bấm một công ty khác để **chuyển sang làm việc với công ty đó**; trong lúc chuyển, nút hiện vòng xoay và tạm khóa.
2. **Đăng nhập hóa đơn điện tử** — mở form đăng nhập Thuế điện tử cho MST của công ty đang chọn.
   - Chưa đăng nhập: dòng phụ hiện `MST <mã số thuế>`.
   - Đã đăng nhập: biểu tượng chuyển thành dấu tích xanh, dòng phụ hiện `Đã đăng nhập <mã số thuế>`.
   - *Mục này chỉ xuất hiện khi công ty đang chọn có MST.*
3. **Quản lý công ty/Hộ kinh doanh** — mở trang Cài đặt.

> Khi đổi công ty: hóa đơn đang chọn trong bảng bị bỏ chọn, hộp thoại xem hóa đơn tự đóng, và mọi tiến trình tải đang chạy cho công ty cũ sẽ ngừng theo dõi — để không lẫn dữ liệu giữa các công ty.

#### Avatar người dùng

Bấm avatar (chữ cái đầu của họ tên) để mở menu:

1. Dòng đầu (không bấm được): **Họ tên** + **Email** của bạn.
2. **Cài đặt** — mở trang Cài đặt.
3. **Đăng xuất** — thoát ứng dụng và xóa phiên Thuế điện tử.

---

## 5. Đăng nhập Thuế điện tử (GDT)

Form này là cửa ngõ bắt buộc trước mọi thao tác lấy dữ liệu từ cơ quan thuế.

### Cách mở form

Có 2 cách:
- **Chủ động:** Nút tên công ty → **Đăng nhập hóa đơn điện tử**.
- **Tự động:** Bấm **Cập nhật từ Thuế điện tử**, **Tải chi tiết** hoặc **Đồng bộ** khi chưa đăng nhập — phần mềm tự mở form này, và **sau khi đăng nhập xong sẽ tự chạy tiếp đúng thao tác bạn vừa bấm**, không phải bấm lại lần hai.

### Các trường

| Trường | Ghi chú |
|---|---|
| **Tên đăng nhập** | Chính là **mã số thuế**. Đã được điền sẵn theo công ty đang chọn |
| **Mật khẩu** | Mật khẩu tài khoản Thuế điện tử. Có nút con mắt để hiện/ẩn |
| **Mã captcha** | Ảnh captcha lấy tự động khi mở form. Bấm nút ⟳ bên cạnh để lấy mã mới |
| **Nhập mã captcha** | Bắt buộc — gõ đúng ký tự nhìn thấy trong ảnh |

### Thao tác

Bấm **Đăng nhập** hoặc nhấn Enter ở bất kỳ ô nào.

- **Thành công** → hiện thông báo xanh *"Đăng nhập thành công."*, hộp thoại tự đóng sau 1 giây, thao tác đang chờ (nếu có) chạy tiếp.
- **Thất bại** → hiện lỗi đỏ, ô captcha được xóa và **ảnh captcha tự đổi mới**. Nhập lại mật khẩu/captcha rồi thử tiếp.
- Không lấy được ảnh captcha → báo *"Không lấy được mã captcha. Vui lòng bấm tải lại."* — bấm nút ⟳.

> ⚠️ **Cảnh báo lệch MST:** nếu bạn đăng nhập bằng MST khác với công ty đang chọn, phần mềm vẫn lưu token nhưng **không chạy tiếp** thao tác, và báo: *"Đã đăng nhập MST ..., khác công ty đang chọn (...) — không chạy tiếp thao tác."* Hãy chuyển sang đúng công ty hoặc đăng nhập lại bằng đúng MST.

### Vòng đời phiên Thuế điện tử

- Token chỉ sống trong **tab trình duyệt hiện tại**. Đóng tab hoặc mở tab mới → phải đăng nhập lại.
- Token có hạn ngắn. Khi đang tải mà token hết hạn, phần mềm báo: *"Token Thuế điện tử hết hạn — đã tải X/Y. Đăng nhập lại rồi bấm tải tiếp."* → đăng nhập lại và bấm **Tải chi tiết** để tiếp tục từ chỗ dở.
- Đăng xuất ứng dụng sẽ xóa toàn bộ token đang giữ.

---

## 6. Màn hình Hóa đơn điện tử

Đây là màn hình chính (đường dẫn `/`). Tiêu đề **Hóa đơn điện tử**, bên phải là nút **Đồng bộ từ Thuế**.

### 6.1. Hai tab chiều hóa đơn

| Tab | Nội dung |
|---|---|
| **Hóa đơn đầu vào** | Hóa đơn mua vào — cột đối tác hiển thị **người bán** |
| **Hóa đơn đầu ra** | Hóa đơn bán ra — cột đối tác hiển thị **người mua** |

Hai tab hoạt động **độc lập**: mỗi tab giữ riêng bộ lọc, trang đang xem, dòng đang chọn. Chuyển qua lại không mất dữ liệu đã tra cứu.

Bên phải hàng tab có nút **Xuất file excel tổng hợp và hóa đơn** (xem [mục 8](#8-xuất-file-excel-tổng-hợp-và-hóa-đơn)) — nút này áp dụng cho **cả 2 chiều**, không phụ thuộc tab đang mở.

### 6.2. Bộ lọc hóa đơn

Khung **"Bộ lọc hóa đơn mua vào / bán ra đã được đồng bộ"**. Bấm nút **−** / **+** ở góc phải để thu gọn / mở rộng.

#### Các ô lọc

| Ô | Kiểu | Ghi chú |
|---|---|---|
| **MST người bán** (tab đầu vào) / **MST người mua** (tab đầu ra) | Nhập chữ | Lọc theo mã số thuế đối tác |
| **CCCD người bán / CCCD người mua** | Nhập chữ | 🚫 **Đang khóa** — chú thích "Chưa hỗ trợ lọc theo CCCD" |
| **Trạng thái** | Chọn | Tất cả / Hóa đơn mới / thay thế / điều chỉnh / bị thay thế / đã bị điều chỉnh / đã bị hủy |
| **Từ ngày** – **Đến ngày** | Chọn ngày | Mặc định = **tháng hiện tại** (ngày 01 → hôm nay) |
| **Kết quả kiểm tra** | Chọn | Tất cả / Đã cấp mã hóa đơn / TCT đã nhận không mã / TCT đã nhận hóa đơn khởi tạo từ máy tính tiền |
| **Ký hiệu mẫu số hóa đơn** | Nhập chữ | Ví dụ: `1` |
| **Số hóa đơn** | Nhập chữ | |
| **Ký hiệu hóa đơn** | Nhập chữ | Ví dụ: `C25TAA` |
| **Hóa đơn ủy nhiệm** | Ô tick | 🚫 **Đang khóa** — chú thích "Chưa hỗ trợ lọc hóa đơn ủy nhiệm" |

#### Ba nút thao tác

| Nút | Tác dụng | Có cần đăng nhập Thuế? |
|---|---|:--:|
| **Tìm kiếm** | Đọc hóa đơn **đã lưu trong cơ sở dữ liệu** theo bộ lọc. Nhanh, không gọi ra cơ quan thuế | Không |
| **Cập nhật từ Thuế điện tử** | Gọi sang hệ thống Thuế: lấy **danh sách hóa đơn** trong khoảng ngày → lưu vào CSDL → sau đó **tự động tải tiếp chi tiết** từng hóa đơn | **Có** |
| **Bỏ tìm kiếm** | Đưa bộ lọc về mặc định (tháng hiện tại) và tra cứu lại | Không |

Cả ba nút bị khóa trong lúc đang đọc dữ liệu hoặc đang có lượt lấy dữ liệu chạy.

#### Chi tiết nút "Cập nhật từ Thuế điện tử"

1. Kiểm tra đã chọn đủ **Từ ngày / Đến ngày** — thiếu thì báo *"Vui lòng chọn đủ Từ ngày / Đến ngày."*
2. Chưa đăng nhập Thuế điện tử → tự mở form đăng nhập, xong sẽ chạy tiếp.
3. Lượt lấy dữ liệu **chạy trên máy chủ**, không chạy trong trình duyệt. Nhờ vậy:
   - Bạn **có thể chuyển tab, F5 hoặc rời trang** — lượt vẫn tiếp tục.
   - Quay lại màn hình này, phần mềm tự hỏi máy chủ và **nối lại thanh tiến độ** đang chạy dở.
4. Trong lúc chạy, cột **T. thái tải** trên bảng được điền dần, và có thông báo tiến độ nổi ở góc màn hình.

### 6.3. Hai tab kết quả: Tổng quát / Chi tiết hóa đơn

#### Tab "Tổng quát" — mỗi dòng là một hóa đơn (22 cột)

| # | Cột | Ý nghĩa |
|:--:|---|---|
| 1 | STT | Số thứ tự theo trang đang xem |
| 2 | **Chọn** | Ô tick chọn hóa đơn để bấm **Xem hóa đơn**. Mỗi lần chỉ chọn được 1 dòng |
| 3 | **T. thái tải** | Trạng thái tải chi tiết: **OK** (xanh) đã có chi tiết · **Lỗi** (đỏ) tải thất bại · **—** chưa tải |
| 4 | Ký hiệu mẫu số | |
| 5 | Ký hiệu hóa đơn | |
| 6 | Số hóa đơn | |
| 7 | Ngày lập | dd/MM/yyyy |
| 8 | Ngày ký | dd/MM/yyyy |
| 9 | MST người bán/người xuất hàng *(đầu vào)* hoặc MST người mua *(đầu ra)* | |
| 10 | Tên người bán/người xuất hàng *(đầu vào)* hoặc Tên người mua *(đầu ra)* | |
| 11 | Tổng tiền chưa thuế | Định dạng 1.234.567 |
| 12 | Tổng tiền thuế | |
| 13 | Tổng CKTM | Chiết khấu thương mại |
| 14 | Tổng phí | |
| 15 | Tổng tiền thanh toán | |
| 16 | Mã nt | Mã ngoại tệ (VND, USD...) |
| 17 | Tỷ giá | |
| 18 | Trạng thái hóa đơn | Xem [mục 10](#10-bảng-tra-cứu-giá-trị-hiển-thị) |
| 19 | Kết quả kiểm tra | Xem [mục 10](#10-bảng-tra-cứu-giá-trị-hiển-thị) |
| 20 | Mã ct hạch toán | Hiển thị **—** (chưa có nguồn dữ liệu) |
| 21 | Tên chứng từ hạch toán | Hiển thị **—** (chưa có nguồn dữ liệu) |
| 22 | Hóa đơn rủi ro | Hiển thị **—** (chưa có nguồn dữ liệu) |

Bảng cuộn ngang được. Khi không có dữ liệu:
- Chưa từng tra cứu → *"Chưa có dữ liệu"*
- Đã tra cứu nhưng rỗng → *"Không có hóa đơn nào trong khoảng đã chọn"*

#### Tab "Chi tiết hoá đơn" — mỗi dòng là một dòng hàng hóa (27 cột)

Bung toàn bộ dòng hàng của mọi hóa đơn đã tải chi tiết trong khoảng đang xem. Thông tin hóa đơn (mẫu số, ký hiệu, số, ngày, người bán, các cột tổng) lặp lại trên từng dòng hàng.

Thứ tự cột: **STT · Mẫu số · Ký hiệu · Số hóa đơn · Ngày hóa đơn · MST/người bán · Tên người bán · Tên hàng hóa · Đvt · Số lượng · Giá · Tiền CK · Tiền chưa thuế · Thuế · Tiền sau thuế · TL CKTM · Thuế suất · Mã nt · Tỷ giá · Tổng tiền hàng · Tổng tiền thuế · Tổng CK · Tổng phí · Tổng thanh toán · Hình thức thanh toán · Trạng thái hóa đơn · Kết quả kiểm tra**

Chưa có dữ liệu → hiện gợi ý *"Chưa có chi tiết. Bấm 'Tải chi tiết' để tải từ Thuế điện tử."*

> Dữ liệu chi tiết khá nặng nên chỉ được nạp **khi bạn mở tab này**.

### 6.4. Nút "Xem hóa đơn"

*(chỉ hiện ở tab Tổng quát)*

**Cách thao tác:**
1. Tick ô **Chọn** ở dòng hóa đơn cần xem.
2. Bấm **Xem hóa đơn** (nút bị mờ khi chưa chọn dòng nào).

**Kết quả:** mở hộp thoại **Xem hóa đơn** dựng lại tờ hóa đơn GTGT theo bố cục bản in của Tổng cục Thuế, đọc từ **chi tiết đã lưu trong CSDL** (không gọi ra cơ quan thuế nên hiện gần như tức thì).

**Các nút trong hộp thoại:**
- **In** — mở hộp thoại in của trình duyệt với bản in đúng khổ giấy (lề 10mm).
- **Đóng**.

**Trường hợp hóa đơn chưa tải chi tiết:** hộp thoại báo *"Hóa đơn chưa tải chi tiết. Bấm 'Tải chi tiết' ở thanh công cụ để tải từ Thuế điện tử rồi mở lại."*

### 6.5. Nút "Tải chi tiết"

Nút xanh đậm bên phải, dùng để **tải nội dung chi tiết** của các hóa đơn trong khoảng đang lọc.

**Cách thao tác:** bấm **Tải chi tiết**. Nếu chưa đăng nhập Thuế điện tử, form đăng nhập tự mở và sau đó tự chạy tiếp.

**Đặc điểm:**
- **Bỏ qua** những hóa đơn đã có trạng thái tải **OK** → dùng để **tải lại các hóa đơn báo "Lỗi"** ở cột *T. thái tải*, hoặc tải bổ sung phần còn thiếu.
- Chạy trên máy chủ, có nhịp chờ để không bị hệ thống Thuế chặn.
- Thông báo tiến độ nổi dạng *"Đang tải chi tiết hóa đơn 12/40…"*, cột **T. thái tải** trên bảng cập nhật dần.
- Nút hiển thị **"Đang tải chi tiết…"** và bị khóa trong lúc chạy.

**Các thông báo khi kết thúc:**

| Thông báo | Nghĩa |
|---|---|
| `Đã tải chi tiết X/Y hóa đơn.` | Hoàn tất |
| `Đã tải chi tiết X/Y hóa đơn (N lỗi).` | Còn N hóa đơn lỗi — bấm lại **Tải chi tiết** để thử tiếp |
| `Tất cả hóa đơn trong khoảng đã có chi tiết.` | Không có gì cần tải thêm |
| `Token Thuế điện tử hết hạn — đã tải X/Y. Đăng nhập lại rồi bấm tải tiếp.` | Đăng nhập lại rồi bấm **Tải chi tiết** |

Nút bị khóa khi bảng đang rỗng hoặc đang có lượt tải/cập nhật khác chạy.

### 6.6. Phân trang

Thanh phân trang nằm dưới bảng (có ở cả tab Tổng quát và Chi tiết, hoạt động độc lập).

- **Số dòng mỗi trang:** chọn **20** (mặc định) / **50** / **100**.
- Hiển thị `1–20 trên 137`.
- Các nút: Trang đầu · Trang trước · Trang sau · Trang cuối.

---

## 7. Đồng bộ từ Thuế

Bấm nút **Đồng bộ từ Thuế** (góc trên bên phải màn hình chính) để mở hộp thoại **Đồng bộ hóa đơn**.

> **Khác nhau giữa "Đồng bộ" và "Cập nhật từ Thuế điện tử"?**
> - *Cập nhật từ Thuế điện tử* (trong bộ lọc): lấy dữ liệu theo **đúng bộ lọc của một chiều** đang xem.
> - *Đồng bộ từ Thuế*: lượt rà soát tổng thể — chọn được **cả 2 chiều**, chọn **loại hóa đơn**, có **lịch sử đồng bộ** và nút **xóa dữ liệu**. Đồng bộ xong sẽ tự tải chi tiết cho từng chiều.

### 7.1. Các lựa chọn

**Chọn đồng bộ hóa đơn mua vào / bán ra:**
- ⦿ Đồng bộ tất cả *(mặc định)*
- ○ Chỉ đồng bộ hóa đơn bán ra
- ○ Chỉ đồng bộ hóa đơn mua vào

**Chọn đồng bộ loại hóa đơn:**
- ⦿ Đồng bộ tất cả *(mặc định)*
- ○ Đồng bộ tất cả trừ hóa đơn máy tính tiền
- ○ Chỉ đồng bộ hóa đơn máy tính tiền

**Từ ngày / Đến ngày:** mặc định là tháng hiện tại (ngày 01 → hôm nay).

**Thêm lịch đồng bộ:** khung gập/mở — hiện tại chỉ hiển thị thông báo *"Lịch đồng bộ tự động đang được phát triển."*

### 7.2. Chạy đồng bộ

Bấm **Đồng bộ**.

- Thiếu ngày → báo *"Vui lòng chọn đủ Từ ngày / Đến ngày."*
- Chưa đăng nhập Thuế điện tử → form đăng nhập tự mở, xong thì đồng bộ chạy luôn.

**Trong lúc chạy** xuất hiện khung thông tin xanh:

```
Đang đồng bộ: <giai đoạn>
Trang 3 — đã lấy 240 hóa đơn, bổ sung 15, đã có sẵn 225.
Có thể đóng cửa sổ này, lượt vẫn chạy tiếp.
```

Kèm thanh tiến trình chạy và nút **Dừng**.

- **Dừng** — máy chủ kết thúc ở ranh giới trang gần nhất rồi thoát. Trong lúc chờ, nút đổi thành *"Đang dừng…"*.
- **Đóng cửa sổ vẫn an toàn** — lượt chạy trên máy chủ. Mở lại hộp thoại sẽ nối lại đúng tiến độ đang chạy.
- Mất mạng vài nhịp thì tự thử lại; mất kết nối kéo dài sẽ báo *"Mất kết nối khi theo dõi tiến độ — lượt vẫn chạy ở máy chủ, mở lại cửa sổ này để xem tiếp."*

**Khi xong**, mỗi chiều có một thông báo riêng:

| Thông báo | Nghĩa |
|---|---|
| `Mua vào — đầy đủ, không thiếu hóa đơn (đã có sẵn 225).` | Không phát hiện hóa đơn thiếu |
| `Bán ra — đã bổ sung 15 hóa đơn thiếu (đã có sẵn 225).` | Đã lấy thêm 15 hóa đơn |
| `Mua vào — chưa hoàn thành: <lý do>. Đã bổ sung X, đã có sẵn Y.` | Lượt dừng giữa chừng |

Sau đó phần mềm **tự động tải chi tiết** lần lượt cho chiều mua vào rồi bán ra, hiển thị tiến độ tương tự nút *Tải chi tiết*. Nếu token đã hết hạn (ví dụ khi nối lại sau F5), phần mềm báo *"Đã đồng bộ xong danh sách. Bấm 'Tải chi tiết' ở bảng hóa đơn để tải chi tiết."*

### 7.3. Bảng "Lịch sử đồng bộ hóa đơn"

Nằm cuối hộp thoại, gồm các cột:

| Cột | Nội dung |
|---|---|
| STT | |
| Từ ngày / Đến ngày | Khoảng đã đồng bộ (dd/MM/yyyy) |
| Số lượng đồng bộ | Dạng `đã lưu / tổng` |
| Trạng thái | Chip **Hoàn thành** (xanh) hoặc **Chưa hoàn thành** (cam — di chuột lên để xem lý do) |
| Diễn giải | Ví dụ: `Đồng bộ hóa đơn đầu vào — <lý do>` |
| Ngày đồng bộ | dd/MM/yyyy HH:mm |

### 7.4. Nút "Xóa dữ liệu đã đồng bộ"

Nút viền đỏ góc dưới bên trái. Bấm → hộp thoại xác nhận:

> *"Toàn bộ hóa đơn đã lưu trong cơ sở dữ liệu (bao gồm cả hóa đơn tra cứu thủ công ở trang Hóa đơn điện tử, không chỉ hóa đơn đã đồng bộ) và toàn bộ lịch sử đồng bộ sẽ bị xóa. Hành động này không ảnh hưởng đến dữ liệu gốc trên hệ thống Thuế điện tử."*

Chọn **Hủy** hoặc **Xóa**.

⚠️ Xóa **toàn bộ** hóa đơn đã lưu của công ty đang chọn, không chỉ riêng khoảng ngày đang hiển thị. Nút bị khóa khi chưa có lịch sử đồng bộ nào.

### 7.5. Nút đóng

- **Hủy** (khi đang rảnh) / **Đóng** (khi đang đồng bộ) — đóng hộp thoại. Lượt đồng bộ vẫn chạy tiếp trên máy chủ.

---

## 8. Xuất file Excel tổng hợp và hóa đơn

Bấm **Xuất file excel tổng hợp và hóa đơn** (bên phải hàng tab đầu vào/đầu ra).

Chức năng xuất **cả 2 chiều** (mua vào + bán ra) ra thư mục trên máy bạn.

### 8.1. Điều kiện bắt buộc

| Điều kiện | Nếu không đạt |
|---|---|
| Dùng **Chrome hoặc Edge** | Cảnh báo *"Trình duyệt hiện tại không hỗ trợ chọn thư mục để lưu. Vui lòng dùng Chrome hoặc Edge."* |
| Công ty đang chọn **có MST** | Cảnh báo *"Chưa chọn công ty có MST — không đặt được tên thư mục gốc."* |
| **Cả 2 chiều đã tải chi tiết đầy đủ** | Cảnh báo *"Còn hóa đơn chưa tải chi tiết — Mua vào: 3/40, Bán ra: 0/12. Hãy đồng bộ hoàn thành cả 2 chiều trước khi xuất."* |
| Đã chọn thư mục lưu | Nút **Xuất file** vẫn mờ |
| Đã tick ít nhất 1 định dạng | Nút **Xuất file** vẫn mờ |

### 8.2. Các lựa chọn

| Mục | Giá trị |
|---|---|
| **Loại hóa đơn** | *Tất cả hóa đơn* / *Hóa đơn máy tính tiền* |
| **Từ ngày – Đến ngày** | Mặc định lấy theo khoảng của tháng hiện tại |
| **Xuất kèm hóa đơn dạng** | ☑ Hóa đơn HTML · ☑ Hóa đơn XML · ☑ Hóa đơn PDF *(mặc định tick cả 3)* |
| **Chọn thư mục lưu file** | Bấm nút → chọn thư mục. Tên thư mục đã chọn hiện bên cạnh |

### 8.3. Thao tác và kết quả

Bấm **Xuất file**. Thanh thông báo hiện tiến độ *"Đang xuất hóa đơn 25/60…"*.

**Cấu trúc thư mục tạo ra:**

```
<Thư mục bạn chọn>/
└── <MST công ty>/
    └── tu-2026-07-01-den-2026-07-28/
        ├── Tong-hop-dau-vao-<khoảng>.xlsx
        ├── Tong-hop-dau-ra-<khoảng>.xlsx
        ├── purchase/
        │   ├── html/  <MST người bán>-<ký hiệu>-<số HĐ>.html
        │   ├── xml/   <MST người bán>-<ký hiệu>-<số HĐ>.xml
        │   └── pdf/   <MST người bán>-<ký hiệu>-<số HĐ>.pdf
        └── sold/
            ├── html/
            ├── xml/
            └── pdf/
```

Mỗi file Excel tổng hợp có **2 sheet**: *Tổng quát* và *Chi tiết* của chiều tương ứng, định dạng số kiểu tiền tệ, tiêu đề nền xanh nhạt.

**Thông báo kết thúc:**
- `Đã xuất 60 hóa đơn (2 chiều) + Excel vào thư mục "<tên thư mục>".`
- Có lỗi: `Đã xuất 57/60 hóa đơn (3 lỗi) + Excel vào "<tên>". Lỗi: <mô tả>` — các hóa đơn lỗi được bỏ qua, không làm hỏng cả lượt.

> 💡 PDF được render trên máy chủ nên cần chút thời gian. Đừng đóng hộp thoại trong lúc đang xuất (nút Đóng bị khóa khi đang chạy).

---

## 9. Trang Cài đặt

Vào bằng: **avatar → Cài đặt**, hoặc **nút công ty → Quản lý công ty/Hộ kinh doanh** (đường dẫn `/settings`).

Trang có menu bên trái với 4 mục:

1. Quản lý công ty/Hộ kinh doanh
2. Lịch tự động đồng bộ hoá đơn
3. Chế độ hiển thị
4. Dữ liệu hệ thống

### 9.1. Quản lý công ty / Hộ kinh doanh

**Nút "Thêm công ty/ Hộ kinh doanh"** *(chỉ chủ tài khoản mới thấy)* — mở form giống [mục 3](#3-thêm-công-ty--hộ-kinh-doanh-lần-đầu): nhập MST 10 số để tự điền tên và địa chỉ, rồi bấm **Lưu**.

**Danh sách công ty** — mỗi công ty là một thẻ hiển thị:
- Tên đơn vị. Công ty đang dùng có viền xanh, vạch xanh bên trái và chip **"Đang sử dụng"**.
- *Tài khoản Hóa đơn điện tử:* mã số thuế.
- *Tài khoản Thuế điện tử:* hiện *"Chưa liên kết"*.
- Địa chỉ.

**Các thao tác trên thẻ:**

| Thao tác | Cách làm | Kết quả |
|---|---|---|
| **Chuyển công ty** | Bấm vào **thân thẻ** (di chuột lên hiện gợi ý *"Bấm để chuyển sang công ty này"*) | Chuyển toàn bộ ứng dụng sang công ty đó |
| **Chỉnh sửa** | Bấm nút **Chỉnh sửa** | Mở form sửa. **Mã số thuế bị khóa** — "Mã số thuế không thể thay đổi sau khi tạo". Sửa được: tên, địa chỉ, số điện thoại, loại hình kinh doanh |
| **Xóa** | Bấm nút **Xóa** (viền đỏ) | Mở hộp thoại xác nhận xóa vĩnh viễn |

#### Hộp thoại "Xóa vĩnh viễn công ty/Hộ kinh doanh"

Hộp thoại liệt kê rõ những gì sẽ mất:
- Hóa đơn đầu vào và đầu ra đã đồng bộ
- Chi tiết từng hóa đơn đã tải về
- Lịch sử đồng bộ với Thuế điện tử
- Cơ sở dữ liệu riêng của công ty trên máy chủ

> **Thao tác này KHÔNG thể hoàn tác và không có bản sao lưu.**

Cảnh báo bổ sung nếu đang xóa công ty **đang sử dụng**:
- Còn công ty khác → *"Sau khi xóa, hệ thống sẽ tự chuyển sang một công ty khác của bạn."*
- Là công ty cuối cùng → *"...sau khi xóa bạn sẽ cần thêm công ty mới để tiếp tục làm việc."*

**Cách xóa:** gõ **đúng mã số thuế** của công ty vào ô *"Nhập mã số thuế để xác nhận"*. Khi khớp, dòng chú thích đổi thành *"Mã số thuế khớp — có thể xóa."* và nút **Xóa vĩnh viễn** mới sáng lên. Bấm để xóa.

### 9.2. Lịch tự động đồng bộ hoá đơn

> ℹ️ Phần **cấu hình lịch** ở trên hiện chỉ là giao diện minh họa (chạy nền tự động còn vướng captcha/token của hệ thống Thuế nên chưa bật). Phần **Lịch sử đồng bộ** bên dưới là **dữ liệu thật**.

**Cấu hình lịch (minh họa):**
- Công tắc **Bật đồng bộ tự động**.
- **Tần suất:** Mỗi giờ / Mỗi 6 giờ / Hàng ngày / Hàng tuần.
- **Giờ chạy:** chỉ dùng được với tần suất Hàng ngày / Hàng tuần.
- **Đồng bộ theo chiều:** ☑ Hóa đơn đầu vào · ☑ Hóa đơn đầu ra.

Các ô chỉ mở khi bật công tắc.

**Bảng Lịch sử đồng bộ (dữ liệu thật):** Thời gian · Chiều (Tất cả / Đầu vào / Đầu ra) · Trạng thái (Hoàn thành / Chưa hoàn thành, di chuột xem lý do) · Số lượng đồng bộ · Khoảng ngày.

### 9.3. Chế độ hiển thị

Mọi thay đổi ở tab này **áp dụng ngay** lên toàn ứng dụng và **được ghi nhớ** cho lần đăng nhập sau (trừ Ngôn ngữ).

| Mục | Lựa chọn | Tác dụng |
|---|---|---|
| **Giao diện** | Sáng · Tối · Theo hệ thống | Đổi tông màu nền/chữ toàn ứng dụng |
| **Màu chủ đạo** | 6 chấm màu: xanh dương (mặc định), xanh ngọc, tím, cam, đỏ, xanh lá | Đổi màu thanh trên cùng, nút bấm, liên kết. Màu đang chọn có dấu ✓ |
| **Mật độ hiển thị bảng** | Gọn · Vừa · Thoải mái | Điều chỉnh chiều cao dòng của các bảng hóa đơn nhiều cột |
| **Cỡ chữ** | Nhỏ · Vừa · Lớn | Đổi cỡ chữ toàn ứng dụng |
| **Ngôn ngữ** | Tiếng Việt · English | 🚫 *"Tính năng đa ngôn ngữ đang phát triển — chưa đổi ngôn ngữ thật."* |

### 9.4. Dữ liệu hệ thống

#### Khu "Tự động hóa" *(minh họa, chưa nối chức năng)*

- Công tắc **Tự động tải hóa đơn về khi có hóa đơn mới**
- Công tắc **Tự động đồng bộ khi mở ứng dụng**

#### Khu "Dung lượng dữ liệu đã lưu"

4 ô thống kê của **công ty đang chọn**:

| Ô | Nội dung |
|---|---|
| Hóa đơn mua vào đã lưu | Số hóa đơn |
| Hóa đơn bán ra đã lưu | Số hóa đơn |
| Dung lượng ước tính | Ước lượng theo số dòng |
| Lần đồng bộ gần nhất | dd/MM/yyyy HH:mm hoặc *"Chưa đồng bộ"* |

Nếu không đọc được thống kê, hiện thông báo lỗi kèm nút **Thử lại**.

#### Khu "Quản lý dữ liệu" — 3 nút

| Nút | Tác dụng |
|---|---|
| **Đồng bộ ngay** | Mở hộp thoại *Đồng bộ hóa đơn* (giống [mục 7](#7-đồng-bộ-từ-thuế)) |
| **Xuất / Sao lưu dữ liệu** | Tải về **một file CSV** chứa toàn bộ hóa đơn đã lưu của cả 2 chiều, có cột "Chiều" phân biệt. File có BOM UTF-8 nên mở bằng Excel không lỗi font tiếng Việt |
| **Xóa dữ liệu đã lưu** | Xóa toàn bộ hóa đơn (mua vào + bán ra) và lịch sử đồng bộ. Có hộp thoại xác nhận. Không ảnh hưởng dữ liệu gốc trên hệ thống Thuế điện tử |

Cột trong file CSV sao lưu: STT · Ký hiệu mẫu số · Ký hiệu hóa đơn · Số hóa đơn · Ngày lập · MST người bán · Tên người bán · MST người mua · Tên người mua · Tổng tiền chưa thuế · Tổng tiền thuế · Tổng tiền thanh toán · Đơn vị tiền tệ · Trạng thái hóa đơn · Chiều.

> ⚠️ Bản sao lưu lấy theo khoảng ngày nên có thể **chưa phủ hết** dữ liệu trong hệ thống. Nếu vậy phần mềm cảnh báo: *"Bản sao lưu chưa gồm toàn bộ hóa đơn trong hệ thống (37/40 mua vào, 12/12 bán ra) — hãy mở rộng khoảng ngày rồi sao lưu lại."*

Nút *Xuất/Sao lưu* và *Xóa* bị khóa khi chưa có hóa đơn nào.

#### Khu "Lưu trữ dữ liệu" *(minh họa, chưa nối chức năng)*

Ô chọn **Thời gian lưu trữ hóa đơn**: 6 tháng / 1 năm / 2 năm / Không giới hạn.

---

## 10. Bảng tra cứu giá trị hiển thị

### Trạng thái hóa đơn

| Giá trị | Ý nghĩa |
|---|---|
| Hóa đơn mới | Hóa đơn gốc, chưa bị thay thế/điều chỉnh |
| Hóa đơn thay thế | Hóa đơn lập để thay thế một hóa đơn khác |
| Hóa đơn điều chỉnh | Hóa đơn lập để điều chỉnh một hóa đơn khác |
| Hóa đơn bị thay thế | Đã bị một hóa đơn khác thay thế |
| Hóa đơn đã bị điều chỉnh | Đã bị một hóa đơn khác điều chỉnh |
| Hóa đơn đã bị hủy | Đã hủy |

### Kết quả kiểm tra

| Giá trị | Ý nghĩa |
|---|---|
| Đã cấp mã hóa đơn | Cơ quan thuế đã cấp mã |
| Tổng cục thuế đã nhận không mã | Hóa đơn không mã, TCT đã tiếp nhận |
| Tổng cục thuế đã nhận hóa đơn có khởi tạo từ máy tính tiền | Hóa đơn máy tính tiền |

### Cột "T. thái tải"

| Hiển thị | Ý nghĩa | Cần làm gì |
|---|---|---|
| **OK** (xanh) | Đã tải xong chi tiết | Xem/in/xuất được |
| **Lỗi** (đỏ) | Tải chi tiết thất bại | Bấm **Tải chi tiết** để thử lại |
| **—** | Chưa tải chi tiết | Bấm **Tải chi tiết** |

---

## 11. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Bấm *Cập nhật từ Thuế điện tử* thì hiện form đăng nhập | Chưa đăng nhập Thuế điện tử cho MST này trong tab hiện tại | Đăng nhập — thao tác sẽ tự chạy tiếp |
| *"Vui lòng chọn đủ Từ ngày / Đến ngày."* | Thiếu một trong hai ô ngày | Điền đủ khoảng ngày |
| *"Chưa chọn công ty có MST để đăng nhập Thuế điện tử."* | Công ty đang chọn chưa có MST, hoặc chưa có công ty nào | Vào Cài đặt → thêm/chỉnh công ty có MST |
| *"Đã đăng nhập MST X, khác công ty đang chọn (Y)"* | Đăng nhập nhầm MST | Chuyển sang đúng công ty trên thanh trên, hoặc đăng nhập lại đúng MST |
| Cột *T. thái tải* nhiều dòng báo **Lỗi** | Lỗi mạng/hệ thống Thuế chặn tạm thời | Bấm **Tải chi tiết** — các hóa đơn OK sẽ được bỏ qua, chỉ tải lại phần lỗi |
| *"Token Thuế điện tử hết hạn"* | Phiên GDT quá ngắn so với lượt tải dài | Đăng nhập lại rồi bấm **Tải chi tiết** để tải nốt |
| Nút *Xem hóa đơn* mờ | Chưa tick ô **Chọn** ở dòng nào | Tick một dòng trong cột **Chọn** |
| Hộp thoại xem hóa đơn báo *"Hóa đơn chưa tải chi tiết"* | Hóa đơn mới có trong danh sách, chưa tải nội dung | Bấm **Tải chi tiết** rồi mở lại |
| Không xuất được file, báo không hỗ trợ chọn thư mục | Đang dùng Firefox/Safari | Chuyển sang Chrome hoặc Edge |
| Cảnh báo *"Còn hóa đơn chưa tải chi tiết"* khi xuất file | Chưa tải đủ chi tiết cả 2 chiều | Sang **cả tab đầu vào và đầu ra**, bấm **Tải chi tiết** cho từng tab |
| Đóng tab giữa chừng, quay lại thấy tiến độ vẫn chạy | Bình thường — lượt chạy trên máy chủ | Không cần làm gì, đợi hoàn tất |
| *"Mất kết nối khi theo dõi tiến độ"* | Mạng đứt | Lượt vẫn chạy trên máy chủ — mở lại hộp thoại/màn hình để xem tiếp |
| Bảng trống, hiện *"Chưa có dữ liệu"* | Chưa từng tra cứu ở công ty này | Bấm **Tìm kiếm** (dữ liệu đã lưu) hoặc **Cập nhật từ Thuế điện tử** (lấy mới) |
| Cột *Mã ct hạch toán*, *Tên chứng từ hạch toán*, *Hóa đơn rủi ro* luôn là **—** | Chưa có nguồn dữ liệu cho các cột này | Không phải lỗi |

---

## 12. Các chức năng đang phát triển

Những mục sau đã có giao diện nhưng **chưa hoạt động thật**:

| Vị trí | Chức năng |
|---|---|
| Bộ lọc hóa đơn | Ô **CCCD người bán / người mua** (khóa) |
| Bộ lọc hóa đơn | Ô tick **Hóa đơn ủy nhiệm** (khóa) |
| Bảng Tổng quát | Cột **Mã ct hạch toán**, **Tên chứng từ hạch toán**, **Hóa đơn rủi ro** |
| Hộp thoại Đồng bộ | Khu **Thêm lịch đồng bộ** |
| Cài đặt → Lịch tự động đồng bộ | Toàn bộ khu **cấu hình lịch** (công tắc, tần suất, giờ chạy, chọn chiều) |
| Cài đặt → Chế độ hiển thị | Ô chọn **Ngôn ngữ** |
| Cài đặt → Dữ liệu hệ thống | Hai công tắc khu **Tự động hóa**; ô **Thời gian lưu trữ hóa đơn** |
| Quản lý công ty | Dòng *Tài khoản Thuế điện tử: Chưa liên kết* |

---

## Phụ lục: Quy trình chuẩn cho một kỳ kế toán

```
1. Đăng nhập ứng dụng
        ↓
2. Chọn đúng công ty trên thanh trên cùng
        ↓
3. Nút công ty → Đăng nhập hóa đơn điện tử (MST + mật khẩu + captcha)
        ↓
4. Bấm "Đồng bộ từ Thuế"
   → Chọn "Đồng bộ tất cả" + loại hóa đơn + khoảng ngày của kỳ
   → Bấm Đồng bộ, chờ hoàn tất (danh sách + chi tiết tự chạy)
        ↓
5. Kiểm tra tab "Hóa đơn đầu vào" và "Hóa đơn đầu ra"
   → Cột "T. thái tải" còn "Lỗi"/"—" thì bấm "Tải chi tiết" cho tới khi hết
        ↓
6. Đối chiếu số liệu: tab Tổng quát (theo hóa đơn) và Chi tiết hóa đơn (theo dòng hàng)
   → Chọn hóa đơn cần kiểm tra → "Xem hóa đơn" → "In" nếu cần
        ↓
7. Bấm "Xuất file excel tổng hợp và hóa đơn"
   → Chọn khoảng ngày, tick định dạng, chọn thư mục lưu → Xuất file
        ↓
8. (Tùy chọn) Cài đặt → Dữ liệu hệ thống → "Xuất / Sao lưu dữ liệu" để có bản CSV dự phòng
```
