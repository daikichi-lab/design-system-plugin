#!/usr/bin/env bash
# ============================================================
#  tests/run-gate.sh — the shelving / regression gate (spec §6-2, §6-4)
#
#  A new design language, engine change, or typography change must PASS this
#  before it ships (M-10). It runs the automatic gates on:
#    - every example deck (must design-lint PASS + generate cleanly = no regression)
#    - every adversarial torture deck (engine must not throw)
#  with the given theme (default: neutral). design-lint is the fast palette/
#  capacity gate; run bin/build.sh for the full per-deck pipeline (typo/image).
#
#  Usage: bash tests/run-gate.sh [themes/<name>/theme.json]
# ============================================================
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
THEME="${1:-$HERE/themes/_default-neutral/theme.json}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "gate runner — theme: $(basename "$(dirname "$THEME")")/$(basename "$THEME")"
fail=0

echo "-- examples (must PASS + generate) --"
for plan in "$HERE"/examples/*/deck_plan.json; do
  name=$(basename "$(dirname "$plan")")
  dl=$(node "$HERE/bin/lint/design-lint.js" --plan "$plan" --theme "$THEME" --json 2>/dev/null \
        | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).pass)}catch(e){console.log('err')}})")
  node "$HERE/bin/generate.js" --plan "$plan" --theme "$THEME" --out "$TMP/$name.pptx" >/dev/null 2>&1 && gen=ok || gen=FAIL
  printf "   %-22s design-lint:%-5s generate:%s\n" "$name" "$dl" "$gen"
  { [ "$dl" = true ] && [ "$gen" = ok ]; } || fail=1
done

echo "-- adversarial (engine must not throw) --"
for plan in "$HERE"/tests/adversarial/torture-*.json "$HERE"/tests/adversarial/clean-*.json; do
  [ -e "$plan" ] || continue
  name=$(basename "$plan")
  node "$HERE/bin/generate.js" --plan "$plan" --theme "$THEME" --out "$TMP/t.pptx" >/dev/null 2>&1 && gen=ok || gen="FAIL(throws)"
  printf "   %-40s generate:%s\n" "$name" "$gen"
  [ "$gen" = ok ] || fail=1
done

echo "-- lint fires both ways (torture=fire / clean=pass, M-10) --"
# 検証器の検証: 各lintは「発火するfixture」と「素通りするfixture」の両方で証明する。
# ここは check名 ごとに (torture側の期待発火数, clean側の期待0) を機械で突き合わせる。
lint_count() { # $1=plan $2=check-name -> stdout: count
  node "$HERE/bin/lint/design-lint.js" --plan "$1" --theme "$THEME" --json 2>/dev/null \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const d=JSON.parse(s);const l=d.findings||d.list||[];console.log(l.filter(f=>f.check===process.argv[1]).length)}catch(e){console.log('err')}})" "$2"
}
rr_t=$(lint_count "$HERE/tests/adversarial/torture-10-relation-record.json" "RELATION-RECORD")
od_t=$(lint_count "$HERE/tests/adversarial/torture-10-relation-record.json" "OVER-DIAGRAM")
rr_c=$(lint_count "$HERE/tests/adversarial/clean-10-relation-record.json" "RELATION-RECORD")
printf "   %-40s torture RELATION-RECORD:%s (want 2)  OVER-DIAGRAM:%s (want 1)  clean:%s (want 0)\n" \
  "relation-record pair" "$rr_t" "$od_t" "$rr_c"
{ [ "$rr_t" = 2 ] && [ "$od_t" = 1 ] && [ "$rr_c" = 0 ]; } || fail=1

echo ""
[ "$fail" = 0 ] && echo "GATE: PASS" || echo "GATE: FAIL"
exit $fail
