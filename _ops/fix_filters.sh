#!/usr/bin/env bash
set -euo pipefail

BR=feat/ui-filter-buttons-top-right
git fetch origin
git checkout -B "$BR" origin/main || git checkout -b "$BR"

mapfile -t FILES < <(rg -l 'RemoteTopRight|CountrySelect|GenderSelect' src || true)

fix_file () {
  f="$1"
  # استبدال الاستخدام بالمكوّن الجديد
  sed -i -E 's#<\s*RemoteTopRight([^>]*)>#<FilterBar\1>#g' "$f"
  # إزالة أي import قديم
  sed -i -E '/RemoteTopRight.*from/d;/CountrySelect.*from/d;/GenderSelect.*from/d' "$f"
  # إضافة import FilterBar إن لم يكن موجودًا
  grep -q 'FilterBar' "$f" || sed -i '1i import FilterBar from "@/app/chat/components/FilterBar";' "$f"
}

for f in "${FILES[@]}"; do
  echo "patch: $f"
  fix_file "$f"
done

git add -A
git commit -m "feat(ui): replace legacy selects with FilterBar (gender/countries) top-right"
git push -u origin "$BR"
echo "PR -> https://github.com/Alshughriahmed/diton/pull/new/$BR"
