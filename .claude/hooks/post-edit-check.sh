#!/usr/bin/env bash
# post-edit-check.sh — Claude Code PostToolUse hook (matcher: Write|Edit).
# Đầu vào: JSON trên stdin (tool_name, tool_input.file_path).
# Việc: log file vừa sửa vào edit.log + cảnh báo nếu file chứa secret.
# Log-only — KHÔNG bao giờ chặn, luôn exit 0.

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/edit.log"
input="$(cat)"

# Lấy file_path từ JSON (không cần jq), unescape backslash Windows
file_path="$(printf '%s' "$input" \
  | grep -oE '"(file_path|notebook_path)"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | head -1 \
  | sed -E 's/.*:[[:space:]]*"//; s/"$//; s/\\\\/\\/g')"
[ -n "$file_path" ] || exit 0

printf '%s | %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$file_path" >>"$LOG"

# Cảnh báo secret trong file vừa sửa (exit 1 của security-check = phát hiện)
if ! bash "$DIR/security-check.sh" "$file_path" >/dev/null 2>&1; then
  echo "CẢNH BÁO: $file_path có thể chứa secret — chạy bash .claude/hooks/security-check.sh '$file_path' để xem chi tiết."
fi
exit 0
