#!/usr/bin/env bash
# pre-commit-check.sh — Git hook 'pre-commit'.
# Kiểm tra theo thứ tự: file nhạy cảm -> file >5MB -> secret -> format.
# Cài đặt: git config core.hooksPath .claude/hooks   (chi tiết xem README.md)

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1
DIR="$(cd "$(dirname "$0")" && pwd)"
fail=0

mapfile -t STAGED < <(git diff --cached --name-only --diff-filter=ACM)
if [ ${#STAGED[@]} -eq 0 ]; then
  exit 0
fi

# --- 1. File nhạy cảm ---
for f in "${STAGED[@]}"; do
  base="$(basename "$f")"
  case "$base" in
    *.example|*.sample|example*|sample*) continue ;;
  esac
  case "$base" in
    .env|.env.local|.env.*|*.pem|*.key|id_rsa*|id_ed25519*|*.p12|*.pfx|*.keystore|credentials*)
      echo "[BLOCK] File nhạy cảm trong staged: $f"
      echo "        -> thêm vào .gitignore, đưa giá trị thật vào biến môi trường/secret manager."
      fail=1
      ;;
  esac
done

# --- 2. File quá lớn (>5MB) ---
while IFS= read -r -d '' f; do
  size="$(wc -c <"$f" 2>/dev/null || echo 0)"
  if [ "$size" -gt $((5 * 1024 * 1024)) ]; then
    echo "[BLOCK] File >5MB: $f (${size} bytes) — cân nhắc Git LFS hoặc loại khỏi repo."
    fail=1
  fi
done < <(git diff --cached --name-only -z --diff-filter=ACM)

# --- 3. Secret scan (chỉ staged files) ---
if ! bash "$DIR/security-check.sh" "${STAGED[@]}"; then
  fail=1
fi

# --- 4. Format check (chỉ staged files) ---
if ! bash "$DIR/format-check.sh" "${STAGED[@]}"; then
  fail=1
fi

if [ "$fail" -eq 1 ]; then
  echo
  echo "=> Pre-commit FAILED. Sửa các mục [BLOCK]/[SECRET]/[FORMAT] rồi commit lại."
fi
exit $fail
