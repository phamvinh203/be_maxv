# Hooks — bộ kiểm tra tự động (stack-agnostic)

7 script bash, chạy dưới Git Bash (Windows) hoặc bash (Linux/macOS).
Không gắn cứng stack — tự phát hiện Go / Node / Python / .NET; không tìm thấy tool thì **bỏ qua (exit 0)**, không chặn oan.

## Danh sách

| Script | Gắn vào | Chức năng | Exit 1 khi |
|---|---|---|---|
| `security-check.sh` | pre-commit · chạy tay | Quét secret: private key, AWS/GitHub/GitLab/Slack/Stripe/OpenAI/Google key, JWT/Bearer hardcode, password hardcode | Phát hiện secret |
| `format-check.sh` | pre-commit · chạy tay | gofmt / prettier / black theo stack phát hiện (dotnet chỉ nhắc, không chạy tự động) | Lệch format |
| `test-gate.sh` | pre-push · chạy tay | go test / npm test / pytest / dotnet test | Test fail |
| `pre-commit-check.sh` | git hook `pre-commit` | Chặn file nhạy cảm (`.env`, `*.pem`, `*.key`…) + file >5MB + gọi security-check + format-check | Bất kỳ mục nào fail |
| `pre-push-check.sh` | git hook `pre-push` | Chặn xóa/rewrite branch protected (`main`, `master`, `develop`, `release/*`) + gọi test-gate | Bất kỳ mục nào fail |
| `post-edit-check.sh` | Claude Code `PostToolUse` (Write\|Edit) | Log file vừa sửa vào `edit.log` + cảnh báo secret | Không bao giờ (log-only) |

## Cài đặt

### 1. Git hooks (pre-commit + pre-push)

```bash
git config core.hooksPath .claude/hooks
```

Git sẽ gọi script theo tên event (`pre-commit`, `pre-push`) trong folder này.
Gỡ: `git config --unset core.hooksPath`.

> Lưu ý: project hiện chưa phải git repo — lệnh trên chỉ hiệu lực sau `git init` hoặc khi clone.

### 2. Claude Code hook (post-edit-check)

Thêm section `hooks` vào `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "bash .claude/hooks/post-edit-check.sh" }
        ]
      }
    ]
  }
}
```

### 3. Chạy tay bất kỳ lúc nào

```bash
bash .claude/hooks/security-check.sh file1 file2
bash .claude/hooks/format-check.sh
bash .claude/hooks/test-gate.sh
```

## Ghi chú vận hành

- **Line-ending phải là LF** — CRLF làm bash báo lỗi `$'\r': command not found`. Nếu edit bằng IDE, giữ EOL = LF cho `.sh`.
- `edit.log` là log chạy của `post-edit-check.sh` — thêm vào `.gitignore` nếu dùng git.
- Bổ sung pattern secret mới: sửa mảng `PATTERNS` trong `security-check.sh` (format `"Tên | regex ERE"`).
- Đổi branch protected: sửa biến `PROTECTED` trong `pre-push-check.sh`.
- Loại file khỏi secret scan: thêm vào mảng lọc `case` trong `security-check.sh`.
