#!/usr/bin/env bash
set -Eeuo pipefail
TS="$(date +%Y%m%d-%H%M%S)"
OUT="_ops/reports/merge_to_main_${TS}"; mkdir -p "$OUT"

# الفروع المراد دمجها إن وُجدت
CANDIDATES=(
  "feat/auth-stripe-vip-20250908-034403"
  "fix/build-auth-header-plans-*"
  "feat/home-gender-style-20250908-005811"
)

git fetch --all --prune

CUR="$(git rev-parse --abbrev-ref HEAD || true)"
BASE="main"
git checkout "$BASE"

# نقطة رجوع
git tag -f "pre-merge-${TS}" "$BASE"

MERGED=()
for pat in "${CANDIDATES[@]}"; do
  # وسّع الأنماط من الريموت ثم حوّلها محلياً
  for rb in $(git branch -r --list "origin/${pat}" | sed 's|origin/||'); do
    # تأكد من وجود فرع محلي مواكب
    git checkout -B "$rb" "origin/$rb" >/dev/null 2>&1 || true
    git checkout "$BASE"
    echo "Merging $rb -> $BASE"
    if git merge --no-ff --no-edit "$rb"; then
      MERGED+=("$rb")
    else
      echo "CONFLICT on $rb. Aborting to keep main clean."
      git merge --abort || true
      echo "-- Acceptance --" > "$OUT/acceptance.txt"
      {
        echo "BASE=$BASE"
        echo "MERGED_COUNT=${#MERGED[@]}"
        echo "MERGED_LIST=${MERGED[*]}"
        echo "STATUS=ABORTED_ON_CONFLICT"
        echo "TAG=pre-merge-${TS}"
      } | tee -a "$OUT/acceptance.txt"
      exit 1
    fi
  done
done

git push origin "$BASE"

echo "-- Acceptance --" > "$OUT/acceptance.txt"
{
  echo "BASE=$BASE"
  echo "MERGED_COUNT=${#MERGED[@]}"
  echo "MERGED_LIST=${MERGED[*]:-none}"
  echo "STATUS=OK"
} | tee -a "$OUT/acceptance.txt"
