#!/usr/bin/env bash
# ============================================================
#  Phase-B typesetting engine setup (spec §10) — idempotent.
#
#  Installs what bin/layout-html/*.js and bin/lint/{typo-lint,ssim}.js need:
#    1. Yu Gothic registered with fontconfig — so BOTH headless Chromium and
#       LibreOffice render real Yu Gothic. Without it, computed line breaks
#       won't match PowerPoint and the SSIM conversion rate is understated.
#    2. Node deps: playwright-core + pngjs (from package.json).
#    3. A Playwright chromium browser binary.
#
#  Free, WSL2-friendly, no GPU, no image generation (M-7).
#  Run once per environment:  bash bin/layout-html/setup.sh
# ============================================================
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$(cd "$HERE/../.." && pwd)"
ok=1

echo "== 1. Yu Gothic -> fontconfig =="
FONTDIR="$HOME/.local/share/fonts"; mkdir -p "$FONTDIR"
WINFONTS="/mnt/c/Windows/Fonts"
if ls "$WINFONTS"/YuGoth*.ttc >/dev/null 2>&1; then
  cp -u "$WINFONTS"/YuGoth*.ttc "$FONTDIR"/ && echo "  copied $(ls "$FONTDIR"/YuGoth*.ttc 2>/dev/null | wc -l) TTC(s) from Windows"
  fc-cache -f "$FONTDIR" >/dev/null 2>&1
elif fc-match "Yu Gothic" 2>/dev/null | grep -qi yugoth; then
  echo "  already registered"
else
  echo "  WARN: Yu Gothic not found. On WSL2 it lives in /mnt/c/Windows/Fonts (YuGoth*.ttc)."
  echo "        Elsewhere, install the Yu Gothic family, then re-run. Without it, line"
  echo "        breaks won't match PowerPoint and the conversion rate is understated."
  ok=0
fi
for q in "Yu Gothic" "Yu Gothic:weight=bold" "Yu Gothic Medium"; do
  printf "    fc-match %-22s -> %s\n" "$q" "$(fc-match "$q" 2>/dev/null)"
done

echo "== 2. Node deps (playwright-core, pngjs) =="
if ( cd "$PLUGIN" && npm install --no-audit --no-fund >/dev/null 2>&1 ); then
  echo "  npm install ok"
else
  echo "  WARN: npm install failed (offline?). Needed: playwright-core, pngjs."
  ok=0
fi

echo "== 3. Playwright chromium =="
if ls "$HOME/.cache/ms-playwright"/chromium-*/chrome-linux*/chrome >/dev/null 2>&1; then
  echo "  chromium present: $(ls "$HOME/.cache/ms-playwright"/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)"
else
  echo "  chromium missing -- run:  npx playwright install chromium"
  ok=0
fi

echo ""
if [ "$ok" = 1 ]; then
  echo "OK: Phase-B typesetting engine ready (bake / typo-lint / ssim)."
else
  echo "INCOMPLETE: see notes above. The pipeline falls back to the un-baked plan"
  echo "            plus the visual QA loop, so decks still build."
fi
