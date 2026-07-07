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
PLAN=""; THEME=""; OUT=""; BAKE=1; LEX=""
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) PLAN="$2"; shift 2;;
    --theme) THEME="$2"; shift 2;;
    --out) OUT="$2"; shift 2;;
    --lexicon) LEX="$2"; shift 2;;
    --no-bake) BAKE=0; shift;;
    -h|--help) sed -n '20,21p' "$0"; exit 0;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done
[ -n "$PLAN" ] && [ -n "$OUT" ] || { echo "usage: build.sh --plan P [--theme T] [--lexicon L] --out O [--no-bake]"; exit 2; }
THEMEARG=(); [ -n "$THEME" ] && THEMEARG=(--theme "$THEME")
LEXARG=(); [ -n "$LEX" ] && LEXARG=(--lexicon "$LEX")

WORK="$(dirname "$OUT")"; mkdir -p "$WORK"
GENPLAN="$PLAN"

# 1. bake (typesetting) — optional
if [ "$BAKE" = 1 ]; then
  BAKED="$WORK/$(basename "${OUT%.pptx}").baked.json"
  echo "== bake =="
  if node "$HERE/layout-html/bake.js" --plan "$PLAN" "${THEMEARG[@]}" "${LEXARG[@]}" --out "$BAKED" 2>"$WORK/.bake.err"; then
    GENPLAN="$BAKED"
  else
    echo "  WARN: bake skipped (typesetting engine not set up — run bin/layout-html/setup.sh):"
    sed 's/^/      /' "$WORK/.bake.err"
    echo "  continuing with the un-baked plan; the visual QA loop still catches orphans."
  fi
fi

# 1b. markers + personas (rasterize circle markers / persona figure+bubble)
# — optional, same graceful skip as bake (badges/arrow-notes are native).
if node -e "const p=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const s=Array.isArray(p)?p:p.slides; process.exit(s.some(x=>x.content&&(x.content.marker&&x.content.marker.type==='circle'&&!x.content.marker.image)||(x.content.persona&&x.content.persona.quote&&!x.content.persona.bubbleImage)||(x.pattern==='dialogue'||x.pattern==='testimonial'))?0:1)" "$GENPLAN" 2>/dev/null; then
  MARKED="$WORK/$(basename "${OUT%.pptx}").marked.json"
  echo "== markers =="
  if node "$HERE/graphics/make-markers.js" --plan "$GENPLAN" "${THEMEARG[@]}" --out "$MARKED" --assets "$WORK/assets" 2>"$WORK/.markers.err"; then
    GENPLAN="$MARKED"
  else
    echo "  WARN: make-markers skipped (browser engine absent) — circle markers will not be drawn:"
    sed 's/^/      /' "$WORK/.markers.err"
  fi
fi

# 2. generate (hard requirement)
echo "== generate =="
node "$HERE/generate.js" --plan "$GENPLAN" "${THEMEARG[@]}" --out "$OUT" || { echo "generate FAILED"; exit 1; }

# 2b. geometry-lint (純幾何の構成品質 — lints the generated pptx XML;
# COLLISION is BLOCKING, family/connector/alignment drifts are advisory)
echo "== geometry-lint =="
node "$HERE/lint/geometry-lint.js" --pptx "$OUT" --plan "$GENPLAN" "${THEMEARG[@]}"; GL=$?
[ "$GL" -eq 1 ] && echo "  geometry-lint reported a blocking COLLISION above."

# 3. design-lint (static gate, always — BLOCKING on ERROR, incl. card overflow)
echo "== design-lint =="
node "$HERE/lint/design-lint.js" --plan "$GENPLAN" "${THEMEARG[@]}"; DL=$?
[ "$DL" -ne 0 ] && echo "  design-lint reported blocking ERROR(s) above (fix the plan before shipping)."

# 4. typo-lint (typesetting; skip gracefully if no browser)
echo "== typo-lint =="
node "$HERE/lint/typo-lint.js" --plan "$GENPLAN" "${THEMEARG[@]}" "${LEXARG[@]}" || echo "  typo-lint skipped or found orphans (see above)."

# 4b. image-lint (hybrid decks — pixel gate for bg images; no-op if none)
echo "== image-lint =="
node "$HERE/lint/image-lint.js" --plan "$GENPLAN" "${THEMEARG[@]}" || echo "  image-lint found issues or skipped (see above)."

# 5. render for the visual QA loop (you still OPEN and LOOK — M-2)
echo "== render (then OPEN every slide-*.jpg and inspect — M-2) =="
bash "$HERE/qa.sh" "$OUT"

# 5b. saliency-lint (顕著性 — advisory, on the rendered pixels; skips gracefully
# without the browser engine). A WARN means the declared protagonist is being
# out-shone — strengthen it or move the emphasis, then LOOK again.
QA_DIR="$(dirname "$OUT")/qa"
if [ -d "$QA_DIR" ]; then
  echo "== saliency-lint (主役が主役に見えているか — advisory) =="
  node "$HERE/lint/saliency-lint.js" --plan "$GENPLAN" "${THEMEARG[@]}" --render "$QA_DIR" || echo "  saliency-lint skipped (browser engine absent) — judge emphasis by eye."
fi

# 6. blocking verdict — design-lint ERRORs (e.g. card overflow) fail the build.
# The deck is still rendered above so a break can be inspected, but a non-zero
# exit tells create-deck / CI the deck is NOT clean (M-4: don't ship it).
if [ "${DL:-0}" -ne 0 ] || [ "${GL:-0}" -eq 1 ]; then
  echo ""
  echo "BLOCKED: design-lint found blocking error(s) — the deck rendered for inspection but is NOT clean."
  echo "        Fix the plan (shorten the flagged field or split the slide) and rebuild."
  exit 1
fi
