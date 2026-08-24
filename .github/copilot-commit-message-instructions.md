# Quy ước Commit Message

Bắt đầu **commit message** bằng một **emoji phân loại** từ danh sách bên dưới.

### Định dạng

`<emoji>: <nội dung commit>`

### Ví dụ

```text
✨: Thêm chức năng tìm kiếm mới
🐛: Sửa lỗi khi tải tệp lên
```

---

## 📊 Các loại Commit

* 📊 **Data**: Cập nhật hoặc thêm dữ liệu.

  Ví dụ:

  ```text
  📊: Cập nhật dữ liệu dân số
  ```

* 🐛 **Bug**: Sửa lỗi ảnh hưởng đến người dùng.

  Ví dụ:

  ```text
  🐛: Sửa lỗi liên kết ở footer
  ```

* 🔨 **Refactor**: Thay đổi hoặc cải tổ code nhưng không thêm tính năng mới và không sửa lỗi.

  Ví dụ:

  ```text
  🔨: Tái cấu trúc logic render biểu đồ
  ```

* ✨ **Enhance**: Cải thiện chức năng hiện có.

  Ví dụ:

  ```text
  ✨: Cải thiện tốc độ tải biểu đồ
  ```

* 🎉 **Feature**: Thêm một tính năng mới cho người dùng.

  Ví dụ:

  ```text
  🎉: Thêm chế độ giao diện tối
  ```

* 📜 **Docs**: Thêm hoặc cập nhật tài liệu.

  Ví dụ:

  ```text
  📜: Thêm tài liệu hướng dẫn cài đặt cho developer
  ```

* 🧹 **Chore**: Các công việc bảo trì như cập nhật dependency, cấu hình, công cụ,...

  Ví dụ:

  ```text
  🧹: Cập nhật Node.js lên phiên bản mới nhất
  ```

* 🚨 **Style**: Thay đổi liên quan đến format, lint hoặc style code, không ảnh hưởng đến logic.

  Ví dụ:

  ```text
  🚨: Sửa format indentation không nhất quán
  ```

* 👷 **WIP**: Công việc đang phát triển, chưa hoàn thiện và sẽ tiếp tục trong các commit sau.

  Ví dụ:

  ```text
  👷: Thêm layout ban đầu cho dashboard
  ```

* ✅ **Tests**: Thêm, sửa hoặc tái cấu trúc các bài kiểm thử.

  Ví dụ:

  ```text
  ✅: Thêm unit test còn thiếu
  ```

---

## 💡 Lưu ý

* Giữ **commit message ngắn gọn và rõ ràng**.
* Chỉ sử dụng **một emoji** cho mỗi commit.
* Nếu một thay đổi chứa nhiều nội dung khác nhau, nên **tách thành các commit riêng biệt**.
* Nội dung commit nên mô tả **chính xác thay đổi đã thực hiện**, tránh các message quá chung chung như:

  ```text
  update code
  fix bug
  change something
  ```

### Ví dụ thực tế

```text
🎉: Thêm chức năng đăng nhập
🐛: Sửa lỗi refresh token
✨: Cải thiện tốc độ tải danh sách sản phẩm
🔨: Tái cấu trúc module authentication
📜: Cập nhật tài liệu API
🧹: Cập nhật Prisma lên phiên bản mới
🚨: Format lại code theo ESLint
👷: Hoàn thiện giao diện trang quản trị
✅: Thêm test cho API đăng nhập
📊: Cập nhật dữ liệu sản phẩm
```
