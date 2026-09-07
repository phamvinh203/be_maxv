#!/usr/bin/env bash
# security-check.sh — Quét secret/credential trong source code.
# Exit 0 = sạch · Exit 1 = phát hiện (in ra vị trí).
#
# Cách dùng:
#   bash .claude/hooks/security-check.sh            # quét git staged (nếu trong repo), fallback toàn working tree
#   bash .claude/hooks/security-check.sh file1 ...  # quét các file chỉ định

set -u

RED='\033[31m'; GRN='\033[32m'; NC='\033[0m'

# Mỗi entry: "Tên | regex (ERE)" — tách ở dấu | ĐẦU TIÊN
PATTERNS=(
  'Private key|-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----'
  'AWS Access Key|AKIA[0-9A-Z]{16}'
  'GitHub token (classic)|ghp_[A-Za-z0-9]{36}'
  'GitHub token (fine-grained)|github_pat_[A-Za-z0-9_]{22,}'
  'GitLab token|glpat-[A-Za-z0-9_\-]{20,}'
  'Slack token|xox[baprs]-[A-Za-z0-9\-]{10,}'
  'Stripe live key|sk_live_[0-9a-zA-Z]{16,}'
  'OpenAI/Anthropic key|sk-(proj-|ant-)[A-Za-z0-9_\-]{20,}'
  'Google API key|AIza[0-9A-Za-z_\-]{35}'
  'JWT hardcode|eyJ[A-Za-z0-9_\-]{20,}\.eyJ[A-Za-z0-9_\-]{20,}\.'
  'Bearer token hardcode|Bearer[[:space:]]+[A-Za-z0-9_\-.=]{40,}'
)

# Pattern heuristic dễ báo oan trên TÀI LIỆU (vd password mẫu trong .md của skill/docs)
# nên chỉ quét trên file code. Pattern đặc hiệu cao (AKIA, ghp_...) giữ quét mọi file.
CODE_ONLY_PATTERNS=(
  "Hardcoded credential|(password|passwd|secret|api_key|apikey|access_token)[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_\-]{8,}[\"']"
)

# ----- Thu thập file -----
FILES=()
if [ $# -gt 0 ]; then
  FILES=("$@")
elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  mapfile -t FILES < <(git diff --cached --name-only --diff-filter=ACM)
  if [ ${#FILES[@]} -eq 0 ]; then
    mapfile -t FILES < <(git ls-files --cached --others --exclude-standard)
  fi
else
  mapfile -t FILES < <(find . -type f \
    -not -path './.git/*' -not -path './node_modules/*' -not -path './vendor/*' \
    -not -path './bin/*' -not -path './obj/*' -not -path './.venv/*' \
    -not -name 'package-lock.json' -print | sed 's|^\./||')
fi

# Lọc file nhiễu (minified, lockfile, log, file mẫu/ví dụ)
FILTERED=()
for f in "${FILES[@]}"; do
  base="$(basename "$f")"
  case "$f" in
    *.min.js|*.min.css|*.lock|package-lock.json|*.log|*.svg|*.png|*.jpg|*.jpeg|*.gif|*.pdf|*.zip|*.traineddata|*.onnx) continue ;;
  esac
  case "$base" in
    # file mẫu/ví dụ chứa giá trị giả theo thông lệ — quét chúng là báo oan
    .env.example|.env.sample|*.example|*.sample|example*|sample*|*placeholder*) continue ;;
  esac
  FILTERED+=("$f")
done
FILES=("${FILTERED[@]}")

[ ${#FILES[@]} -gt 0 ] || { echo "OK: không có file nào để quét."; exit 0; }

# ----- Quét -----
# Tách file doc (md/rst/txt) khỏi code — dùng cho CODE_ONLY_PATTERNS.
# File test (*.spec.*, *.test.*, thư mục test/) cũng loại khỏi CODE_ONLY_PATTERNS: heuristic
# "password: '...'" báo oan trên password/token GIẢ dùng để test login/lockout/reset (vd
# 'WrongPass1') — cùng lý do miễn trừ với file .example/.sample ở trên. Pattern signature cao
# (AKIA/ghp_/sk-ant-/private key...) trong PATTERNS vẫn quét test file bình thường, không đổi.
CODE_FILES=()
for f in "${FILES[@]}"; do
  case "$f" in
    *.md|*.markdown|*.rst|*.txt) continue ;;
    *.spec.ts|*.spec.js|*.spec.tsx|*.spec.jsx|*.test.ts|*.test.js|*.test.tsx|*.test.jsx) continue ;;
    test/*|*/test/*|tests/*|*/tests/*) continue ;;
    *) CODE_FILES+=("$f") ;;
  esac
done

hits=0
run_patterns() {
  local entry label regex out
  for entry in "$@"; do
    label="${entry%%|*}"
    regex="${entry#*|}"
    out="$(grep -InE "$regex" "${FILES_TO_SCAN[@]}" 2>/dev/null \
      | grep -vE 'process\.env|os\.environ|import\.meta\.env|Deno\.env|ENV\[|xxxx|XXXX|\$\{|\{\{' || true)"
    if [ -n "$out" ]; then
      hits=1
      printf '%b\n' "${RED}[SECRET]${NC} $label:"
      printf '%s\n' "$out" | sed 's/^/  /'
    fi
  done
}

FILES_TO_SCAN=("${FILES[@]}")
run_patterns "${PATTERNS[@]}"

if [ ${#CODE_FILES[@]} -gt 0 ]; then
  FILES_TO_SCAN=("${CODE_FILES[@]}")
  run_patterns "${CODE_ONLY_PATTERNS[@]}"
fi

if [ "$hits" -eq 1 ]; then
  echo
  echo "=> PHÁT HIỆN SECRET. Chuyển sang biến môi trường / secret manager trước khi commit."
  exit 1
fi
printf '%b\n' "${GRN}OK:${NC} không phát hiện secret."
exit 0
