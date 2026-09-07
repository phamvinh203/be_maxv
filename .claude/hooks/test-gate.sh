#!/usr/bin/env bash
# test-gate.sh — Chạy kiểm thử tự động cho MAXV v2.
# Hỗ trợ: be_maxv (npm test / tsx test) và các module liên quan.

set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 0
fail=0
found_any=0

SUBDIRS=("be_maxv" "maxv" "hdđt_maxv" "fe_maxv")

for dir in "${SUBDIRS[@]}"; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    has_test=$(node -e "const s=(require('./$dir/package.json').scripts||{}).test||'';process.stdout.write(s&&!s.startsWith('echo')?'1':'0')" 2>/dev/null || echo "0")
    if [ "$has_test" = "1" ]; then
      found_any=1
      echo "[TEST] Chạy tests trong $dir (npm test)..."
      if ! (cd "$dir" && npm test); then
        fail=1
        echo "[TEST] $dir: TEST FAIL"
      else
        echo "[TEST] $dir: TEST PASS"
      fi
    elif [ -d "$dir/src/__tests__" ]; then
      found_any=1
      echo "[TEST] Chạy tsx test trong $dir..."
      if ! (cd "$dir" && npx tsx --test src/__tests__/*.test.ts); then
        fail=1
        echo "[TEST] $dir: TEST FAIL"
      else
        echo "[TEST] $dir: TEST PASS"
      fi
    fi
  fi
done

if [ "$found_any" -eq 0 ]; then
  echo "[TEST] Không phát hiện test runner nào — bỏ qua."
fi

exit $fail
