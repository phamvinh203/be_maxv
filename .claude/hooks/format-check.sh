#!/usr/bin/env bash
# format-check.sh — Kiểm tra format cho các module trong repo MAXV v2.
# Tự động duyệt qua các thư mục (be_maxv, maxv, hdđt_maxv, fe_maxv).

set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 0
fail=0
found_any=0

# Chặn commit khi lệch format? 0 = chỉ cảnh báo (mặc định) · 1 = chặn.
# Đang để 0 vì repo chưa chuẩn hoá: `prettier --check` hiện fail 224 file trong be_maxv,
# bật 1 ngay sẽ chặn gần như mọi commit chạm backend.
# Bật 1 SAU KHI chạy: cd be_maxv && npm run format   (nên commit riêng đợt chuẩn hoá đó).
FORMAT_BLOCKING="${FORMAT_BLOCKING:-0}"

finish() {
  if [ "$fail" -eq 1 ] && [ "$FORMAT_BLOCKING" != "1" ]; then
    echo "[FORMAT] Chỉ cảnh báo — không chặn commit (FORMAT_BLOCKING=0). Bật chặn: FORMAT_BLOCKING=1."
    exit 0
  fi
  exit $fail
}

SUBDIRS=("be_maxv" "maxv" "hdđt_maxv" "fe_maxv")

# Nếu truyền danh sách file cụ thể (từ pre-commit)
if [ $# -gt 0 ]; then
  for f in "$@"; do
    case "$f" in
      *.ts|*.tsx|*.js|*.jsx|*.json)
        for dir in "${SUBDIRS[@]}"; do
          if [[ "$f" == "$dir/"* ]] && [ -f "$dir/node_modules/.bin/prettier" ]; then
            rel="${f#$dir/}"
            if ! (cd "$dir" && npx --no-install prettier --check "$rel" >/dev/null 2>&1); then
              fail=1
              echo "[FORMAT] Lệch định dạng: $f (sửa bằng: cd $dir && npx prettier --write \"$rel\")"
            fi
            found_any=1
            break
          fi
        done
        ;;
    esac
  done
  finish
fi

for dir in "${SUBDIRS[@]}"; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    found_any=1
    if grep -q '"format:check"' "$dir/package.json" 2>/dev/null; then
      echo "[FORMAT] Kiểm tra $dir (format:check)..."
      if ! (cd "$dir" && npm run format:check --silent); then
        fail=1
        echo "[FORMAT] $dir: có file lệch format (sửa bằng: cd $dir && npm run format)"
      else
        echo "[FORMAT] $dir: OK"
      fi
    elif [ -f "$dir/node_modules/.bin/prettier" ]; then
      echo "[FORMAT] Kiểm tra $dir (prettier)..."
      if ! (cd "$dir" && npx --no-install prettier --check "src/**/*.{ts,tsx,js,jsx}" 2>/dev/null); then
        fail=1
        echo "[FORMAT] $dir: có file lệch format (sửa bằng: cd $dir && npx prettier --write src)"
      else
        echo "[FORMAT] $dir: OK"
      fi
    fi
  fi
done

if [ "$found_any" -eq 0 ]; then
  echo "[FORMAT] Không phát hiện thư mục nào có cấu hình format — bỏ qua."
fi

finish
