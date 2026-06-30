#!/usr/bin/env bash
# ============================================================
#  qa.sh — render a PPTX to per-slide images for visual QA.
#
#  This is step 1 of the MANDATORY QA loop (see references/principles/
#  house-quality-bar.md and skills/create-deck/SKILL.md). It only
#  *produces* the images — a human or a sub-agent must then OPEN each
#  one and check for the failure modes listed below.
#
#  Usage:   bash bin/qa.sh <deck.pptx> [out_dir] [dpi]
#  Default: out_dir = <deck_dir>/qa , dpi = 130
#
#  Requires: libreoffice (soffice) + poppler (pdftoppm).
# ============================================================
set -euo pipefail

PPTX="${1:-}"
if [[ -z "$PPTX" || ! -f "$PPTX" ]]; then
  echo "usage: bash bin/qa.sh <deck.pptx> [out_dir] [dpi]" >&2
  exit 2
fi

PPTX_DIR="$(cd "$(dirname "$PPTX")" && pwd)"
PPTX_BASE="$(basename "$PPTX" .pptx)"
OUT_DIR="${2:-$PPTX_DIR/qa}"
DPI="${3:-130}"

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/slide-*.jpg "$OUT_DIR/$PPTX_BASE.pdf"

# Isolated LO profile dir avoids "another instance is running" locks.
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT

SOFFICE="$(command -v soffice || command -v libreoffice || true)"
if [[ -z "$SOFFICE" ]]; then
  echo "ERROR: libreoffice/soffice not found. (Official Anthropic pptx skill: scripts/office/soffice.py also works.)" >&2
  exit 3
fi
if ! command -v pdftoppm >/dev/null 2>&1; then
  echo "ERROR: pdftoppm (poppler-utils) not found." >&2
  exit 3
fi

echo "==> PPTX -> PDF"
"$SOFFICE" --headless -env:UserInstallation="file://$PROFILE" \
  --convert-to pdf --outdir "$OUT_DIR" "$PPTX" >/dev/null

echo "==> PDF -> JPG (${DPI}dpi)"
pdftoppm -jpeg -r "$DPI" "$OUT_DIR/$PPTX_BASE.pdf" "$OUT_DIR/slide" >/dev/null

echo "==> placeholder scan (must be empty):"
if grep -RiEl "lorem|ipsum|\bTODO\b|\[insert" "$PPTX" >/dev/null 2>&1; then
  echo "    WARNING: placeholder-like tokens found in the binary — inspect content." >&2
else
  echo "    clean."
fi

echo "==> rendered slides:"
ls -1 "$OUT_DIR"/slide-*.jpg

cat <<'EOF'

Now OPEN each slide-*.jpg and check (most common first):
  [ ] text overflowing its box (TOP failure mode)
  [ ] overlapping elements (text through shapes, lines through glyphs)
  [ ] edge margin < 0.5"; uneven gaps between blocks
  [ ] low text/background contrast
  [ ] columns / cards misaligned
  [ ] stray vertical bands / ribbons / title underlines (AI tells — must be ABSENT)
  [ ] leftover placeholders
Fix breaks, regenerate the affected slide, re-check. Stop when clean
(do not chase sub-pixel perfection). If a break can't be cleanly fixed,
STOP and report with the screenshot (M-4).
EOF
