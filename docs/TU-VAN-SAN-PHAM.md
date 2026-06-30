# Tài liệu Tư vấn Sản phẩm — maxv_v2

> Tài liệu BA dùng để tư vấn khách hàng / trình bày với stakeholder về phần mềm kế toán **maxv_v2**.
> Viết theo ngôn ngữ nghiệp vụ, dễ hiểu. Chi tiết kỹ thuật xem [KIEN-TRUC-DATABASE.md](KIEN-TRUC-DATABASE.md), spec auth xem [SPEC-01-AUTH.md](SPEC-01-AUTH.md).

---

## 1. maxv_v2 là gì?

maxv_v2 là **phần mềm kế toán doanh nghiệp dạng dịch vụ trực tuyến (SaaS)** — khách hàng dùng ngay trên trình duyệt, không cần cài đặt, dữ liệu lưu an toàn trên máy chủ.

Phần mềm hỗ trợ đầy đủ nghiệp vụ kế toán Việt Nam: từ chứng từ tiền mặt, bán hàng, mua hàng, kho, đến tính giá thành và sổ sách tổng hợp — theo chế độ kế toán TT200 / TT133.

**Một câu định vị:** "Phần mềm kế toán online, mỗi doanh nghiệp một kho dữ liệu riêng biệt, dùng thử 7 ngày, nâng cấp trong 1 phút."

---

## 2. Dành cho ai? Giải quyết vấn đề gì?

| Đối tượng | Vấn đề hiện tại | maxv_v2 giúp |
|-----------|-----------------|--------------|
| Doanh nghiệp vừa & nhỏ | Phần mềm cài máy lẻ, khó truy cập từ xa, hay mất dữ liệu | Online, truy cập mọi nơi, dữ liệu được sao lưu |
| Kế toán dịch vụ (làm nhiều công ty) | Quản lý sổ sách nhiều khách hàng rối rắm, dễ lẫn dữ liệu | Mỗi công ty 1 gói + 1 tài khoản riêng, dữ liệu tách biệt hoàn toàn |
| Kế toán viên | Cài đặt phức tạp, lo mất dữ liệu khi đổi máy | Đăng nhập là dùng, dữ liệu nằm trên máy chủ |

---

## 3. Quy trình hoạt động của phần mềm (góc nhìn khách hàng)

```
1. Vào trang giới thiệu (Landing page)
        │  → bấm "Dùng thử" hoặc "Đăng nhập"
        ▼
2. Đăng ký gói: email + mật khẩu + Tên công ty + Mã số thuế (cùng một bước)
        │  → hệ thống tạo NGAY một "kho dữ liệu riêng" cho công ty này
        │  → kích hoạt 7 ngày dùng thử miễn phí
        │  → xác thực email để kích hoạt tài khoản
        ▼
3. (Tùy chọn) Mời thêm nhân viên: chủ tài khoản gửi yêu cầu
        → quản trị hệ thống duyệt → nhân viên nhận đăng nhập qua email
        ▼
4. Khai báo ban đầu (menu Hệ thống):
        năm tài chính, thông tin công ty, tham số, đánh số chứng từ...
        ▼
5. Nhập liệu nghiệp vụ hằng ngày:
        Phiếu thu/chi, Hóa đơn bán/mua, Nhập/xuất kho...
        → mọi chứng từ tự động sinh bút toán vào sổ cái
        ▼
6. Xem báo cáo: sổ cái, cân đối phát sinh, báo cáo tài chính
        ▼
7. Hết 7 ngày:
        ├─ Nâng cấp gói  → tiếp tục dùng, dữ liệu giữ nguyên
        └─ Không nâng cấp → khóa truy cập, giữ dữ liệu 30 ngày rồi xóa
```

**Điểm cốt lõi:** mỗi loại chứng từ người dùng nhập (thu, chi, bán, mua, nhập kho...) đều **tự động ghi vào sổ cái kế toán** ở phía sau. Người dùng chỉ nhập nghiệp vụ, phần mềm lo phần định khoản và lên báo cáo.

---

## 4. Dữ liệu được lưu trữ như thế nào?

Đây là điểm khác biệt quan trọng nhất của maxv_v2, nên trình bày rõ với khách hàng:

### Nguyên tắc: "Mỗi công ty — một kho dữ liệu riêng"

```
   Máy chủ maxv_v2
   ┌─────────────────────────────────────────┐
   │  Sổ quản lý trung tâm (db_sys)            │
   │   • Danh sách người dùng + quyền          │
   │   • Danh sách công ty + trạng thái gói    │
   │   • Biết kho dữ liệu của mỗi công ty ở đâu│
   ├─────────────────────────────────────────┤
   │  Kho công ty A  ◄── chỉ chứa data công ty A│
   │  Kho công ty B  ◄── chỉ chứa data công ty B│
   │  Kho công ty C  ◄── ...                    │
   └─────────────────────────────────────────┘
```

- **Không gộp chung dữ liệu nhiều công ty vào một chỗ.** Mỗi công ty (theo mã số thuế) có một cơ sở dữ liệu độc lập.
- **Tách biệt vật lý → an toàn tuyệt đối:** dữ liệu công ty này không thể vô tình hiển thị sang công ty khác.
- **Sao lưu & bàn giao riêng từng công ty:** có thể xuất toàn bộ dữ liệu một công ty thành một bản sao lưu độc lập — rất phù hợp với kế toán dịch vụ khi cần bàn giao cho khách.

### Cam kết với khách hàng về dữ liệu

| Cam kết | Cách thực hiện |
|---------|----------------|
| Dữ liệu của tôi có bị lẫn với công ty khác không? | Không — mỗi công ty một kho riêng, tách biệt hoàn toàn |
| Có sao lưu không? | Có — sao lưu định kỳ, có thể khôi phục theo từng công ty |
| Mật khẩu có an toàn không? | Mật khẩu được mã hóa, không ai (kể cả quản trị) đọc được |
| Người khác gõ đúng mã số thuế của tôi có xem được không? | Không — hệ thống luôn kiểm tra quyền truy cập, không chỉ dựa vào đường link |

---

## 5. Các phân hệ chức năng

| Phân hệ | Chức năng chính | Giá trị nghiệp vụ |
|---------|-----------------|-------------------|
| **Hệ thống** | Năm tài chính, thông tin công ty, tham số, đánh số chứng từ, tài khoản HĐĐT | Thiết lập ban đầu cho mỗi đơn vị |
| **Tổng hợp** | Phiếu kế toán, kết chuyển/phân bổ tự động, chênh lệch tỷ giá | Bút toán cuối kỳ, khóa sổ |
| **Tiền** | Giấy báo có/nợ, phiếu thu, phiếu chi, tỷ giá ghi sổ | Quản lý dòng tiền |
| **Bán hàng** | Hóa đơn bán, trả lại, điều chỉnh giá, công nợ, tất toán | Doanh thu & công nợ phải thu |
| **Mua hàng** | Hóa đơn mua trong nước/nhập khẩu, chi phí, công nợ | Chi phí & công nợ phải trả |
| **Tồn kho** | Nhập/xuất/điều chuyển kho, tính giá (TB, FIFO) | Quản lý hàng tồn |
| **Giá thành** | Định mức NVL, lệnh sản xuất, phân bổ chi phí, tính giá thành | Tính giá thành sản phẩm |

---

## 6. Gói dịch vụ & vòng đời khách hàng

| Giai đoạn | Mô tả | Dữ liệu |
|-----------|-------|---------|
| **Dùng thử** | 7 ngày miễn phí kể từ khi khai báo công ty | Đầy đủ chức năng, lưu trên kho riêng |
| **Đã nâng cấp** | Trả phí theo gói, dùng không giới hạn | Giữ nguyên, không phải nhập lại |
| **Hết hạn** | Không nâng cấp sau 7 ngày | Khóa truy cập, giữ 30 ngày để khách quay lại |
| **Đóng** | Quá 30 ngày không quay lại | Dữ liệu được xóa |

> **Lợi thế bán hàng:** khi khách nâng cấp, **toàn bộ dữ liệu 7 ngày dùng thử được giữ nguyên** — không gián đoạn, không nhập lại. Đây là điểm tạo niềm tin để chốt khách.

---

## 7. Lợi ích tổng hợp (để thuyết phục khách)

1. **Dùng ngay, không cài đặt** — chỉ cần trình duyệt.
2. **Dữ liệu riêng biệt & an toàn** — mỗi công ty một kho, tách biệt hoàn toàn.
3. **Sao lưu / bàn giao theo từng công ty** — lý tưởng cho kế toán dịch vụ.
4. **Mời nhiều nhân viên vào 1 công ty** — kế toán trưởng + kế toán viên dùng chung gói, có phân quyền.
5. **Dùng thử trọn vẹn 7 ngày** — trải nghiệm đầy đủ trước khi quyết định.
6. **Nâng cấp không mất dữ liệu** — chuyển từ thử sang dùng thật liền mạch.
7. **Đúng chuẩn kế toán VN** — TT200/TT133, mọi chứng từ tự lên sổ cái & báo cáo.

---

## 8. Câu hỏi thường gặp (FAQ tư vấn)

**Hỏi: Dữ liệu của tôi để ở đâu, có bị mất không?**
Đáp: Lưu trên máy chủ của nhà cung cấp, mỗi công ty một kho dữ liệu riêng, được sao lưu định kỳ và khôi phục được theo từng công ty.

**Hỏi: Tôi làm kế toán cho 5 công ty thì sao?**
Đáp: Mỗi công ty là một gói riêng, đăng ký một tài khoản riêng (theo mã số thuế từng công ty). Cách này đảm bảo dữ liệu mỗi công ty tách biệt tuyệt đối, sao lưu/bàn giao độc lập.

**Hỏi: Công ty tôi có nhiều kế toán viên, họ dùng chung được không?**
Đáp: Được. Chủ tài khoản (người mua gói) có thể mời thêm nhân viên vào dùng chung gói của công ty: gửi yêu cầu thêm người dùng, quản trị hệ thống duyệt, sau đó nhân viên nhận thông tin đăng nhập qua email.

**Hỏi: Hết dùng thử mà chưa kịp nâng cấp thì mất dữ liệu không?**
Đáp: Không mất ngay. Dữ liệu được giữ thêm 30 ngày; nâng cấp trong thời gian đó là dùng tiếp như cũ.

**Hỏi: Phần mềm có nhập sẵn được hệ thống tài khoản không?**
Đáp: Có, theo TT200/TT133, và cho phép tùy chỉnh theo đặc thù doanh nghiệp.

**Hỏi: Người khác có thể xem trộm sổ sách công ty tôi không?**
Đáp: Không. Mỗi truy cập đều được kiểm tra quyền; dữ liệu các công ty tách biệt về mặt vật lý.

---

## 9. Lộ trình phát triển sản phẩm (để cam kết với khách)

| Giai đoạn | Nội dung | Trạng thái |
|-----------|----------|------------|
| 1 | Đăng ký / đăng nhập / dùng thử / tạo đơn vị | Đang làm trước (xem SPEC-01-AUTH) |
| 2 | Chứng từ Tiền (thu/chi) — kiểm chứng luồng sổ cái | Kế tiếp |
| 3 | Bán hàng / Mua hàng / Công nợ | Sau |
| 4 | Tồn kho & tính giá | Sau |
| 5 | Giá thành & báo cáo tài chính | Sau |
| 6 | Nâng cấp gói & thanh toán online | Sau |

---

## 10. Tài liệu liên quan

- [KIEN-TRUC-DATABASE.md](KIEN-TRUC-DATABASE.md) — kiến trúc dữ liệu (kỹ thuật)
- [SPEC-01-AUTH.md](SPEC-01-AUTH.md) — đặc tả đăng ký/đăng nhập (BA + QA)
