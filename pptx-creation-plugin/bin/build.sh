#!/usr/bin/env bash
# ============================================================
#  bin/build.sh — the full deck pipeline in one command.
#
#    bake balanced kinsoku breaks  (bin/layout-html/bake.js)
#    -> generate native pptx       (bin/generate.js)
#    -> design-lint  (static gate) (bin/lint/design-lint.js, §6-1)
#    -> typo-lint    (typesetting) (bin/lint/typo-lint.js,  §5.5)
#    -> render for the visual QA loop (bin/qa.sh)
#
#  The bake + typo-lint steps need the Phase-B engine (Playwright + Yu Gothic;
#  see layout-html/setup.sh). If it's unavailable, they are SKIPPED with a
#  warning and the deck still builds from the un-baked plan — the visual QA loop
#  (M-2) remains the backstop. design-lint and the render always run.
#
#  Usage: bash bin/build.sh --plan <plan.json> [--theme <theme.json>] --out <out.pptx> [--no-bake]
# ============================================================
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PLAN=""; THEME=""; OUT=""; BAKE=1
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) PLAN="$2"; shift 2;;
    --theme) THEME="$2"; shift 2;;
    --out) OUT="$2"; shift 2;;
    --no-bake) BAKE=0; shift;;
    -h|--help) sed -n '20,21p' "$0"; exit 0;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done
[ -n "$PLAN" ] && [ -n "$OUT" ] || { echo "usage: build.sh --plan P [--theme T] --out O [--no-bake]"; exit 2; }
THEMEARG=(); [ -n "$THEME" ] && THEMEARG=(--theme "$THEME")

WORK="$(dirname "$OUT")"; mkdir -p "$WORK"
GENPLAN="$PLAN"

# 1. bake (typesetting) — optional
if [ "$BAKE" = 1 ]; then
  BAKED="$WORK/$(basename "${OUT%.pptx}").baked.json"
  echo "== bake =="
  if node "$HERE/layout-html/bake.js" --plan "$PLAN" "${THEMEARG[@]}" --out "$BAKED" 2>"$WORK/.bake.err"; then
    GENPLAN="$BAKED"
  else
    echo "  WARN: bake skipped (typesetting engine not set up — run bin/layout-html/setup.sh):"
    sed 's/^/      /' "$WORK/.bake.err"
    echo "  continuing with the un-baked plan; the visual QA loop still catches orphans."
  fi
fi

# 2. generate (hard requirement)
echo "== generate =="
node "$HERE/generate.js" --plan "$GENPLAN" "${THEMEARG[@]}" --out "$OUT" || { echo "generate FAILED"; exit 1; }

# 3. design-lint (static gate, always)
echo "== design-lint =="
node "$HERE/lint/design-lint.js" --plan "$GENPLAN" "${THEMEARG[@]}" || echo "  design-lint reported ERRORs — fix before shipping."

# 4. typo-lint (typesetting; skip gracefully if no browser)
echo "== typo-lint =="
node "$HERE/lint/typo-lint.js" --plan "$GENPLAN" "${THEMEARG[@]}" || echo "  typo-lint skipped or found orphans (see above)."

# 5. render for the visual QA loop (you still OPEN and LOOK — M-2)
echo "== render (then OPEN every slide-*.jpg and inspect — M-2) =="
bash "$HERE/qa.sh" "$OUT"
