#!/usr/bin/env bash
# pre-push-check.sh — Git hook 'pre-push'.
# Chặn: xóa branch protected, push rewrite history (non-fast-forward) vào branch protected.
# Branch protected mặc định: main, master, develop, release/* — sửa biến PROTECTED bên dưới.
#
# KHÔNG chạy test khi push (mặc định): test đã chạy lúc dev, chạy lại 40 file lúc push chỉ làm chậm.
# Muốn bật lại cho 1 lần push:  PREPUSH_RUN_TESTS=1 git push
# Muốn bật vĩnh viễn: đổi mặc định PREPUSH_RUN_TESTS bên dưới thành 1.
# Chạy test thủ công bất kỳ lúc nào:  bash .claude/hooks/test-gate.sh

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
fail=0
PROTECTED='^(refs/heads/)?(main|master|develop|release/.*)$'

while read -r local_ref local_sha remote_ref remote_sha; do
  [ -n "${remote_ref:-}" ] || continue
  echo "$remote_ref" | grep -qE "$PROTECTED" || continue

  # Xóa branch remote (local_sha = zeros)
  if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
    echo "[BLOCK] Cấm xóa branch protected: $remote_ref"
    fail=1
    continue
  fi

  # Rewrite history: remote_sha tồn tại local nhưng KHÔNG phải tổ tiên của local_sha
  if [ "$remote_sha" != "0000000000000000000000000000000000000000" ] \
     && git cat-file -e "$remote_sha" 2>/dev/null \
     && ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
    echo "[BLOCK] Push non-fast-forward vào branch protected: $remote_ref (rewrite history?)."
    echo "        Chỉ dùng --force khi cả team đã thống nhất."
    fail=1
    continue
  fi
done

# --- Test gate (mặc định TẮT — xem ghi chú đầu file) ---
PREPUSH_RUN_TESTS="${PREPUSH_RUN_TESTS:-0}"
if [ "$PREPUSH_RUN_TESTS" = "1" ]; then
  if ! bash "$DIR/test-gate.sh"; then
    fail=1
  fi
else
  echo "[TEST] Bỏ qua test khi push (PREPUSH_RUN_TESTS=0). Chạy tay: bash .claude/hooks/test-gate.sh"
fi

if [ "$fail" -eq 1 ]; then
  echo
  echo "=> Pre-push FAILED."
fi
exit $fail
