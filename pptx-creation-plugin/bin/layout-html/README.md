# bin/layout-html — the HTML typesetting engine (Phase B, spec §5)

Japanese line-breaking is a **hard constraint**, not a wish (`references/principles/kinsoku.md`,
`hybrid-architecture.md` §4-4). This directory computes where each line should
break — using a headless browser as a **ruler** — and bakes those breaks into the
**native** pptx. The browser never becomes the slide (M-9): no screenshot is ever
placed on a slide; only the computed break positions cross over.

## Why a browser

CSS gives production-grade Japanese typesetting for free: `line-break: strict`
(禁則), `text-wrap: balance` (even line lengths / no 泣き別れ). We render the text in
**real Yu Gothic**, read back the exact break positions via `getClientRects()`, and
emit those as explicit line arrays the engine renders natively.

## Files

| File | Role |
|---|---|
| `measure.js` | Render a text block (Yu Gothic + kinsoku + balance) and extract its lines / widths; `renderPng()` for the SSIM reference image. |
| `geometry.js` | Per-pattern map of the wrapping prose fields + their box geometry; `effectiveWidth()` = box − 0.2in (PowerPoint text inset). |
| `bake.js` | For each wrapping string field, compute a balanced break and replace it with an explicit line array → a "baked" plan the engine renders orphan-free. |
| `../lint/typo-lint.js` | Predict how the deck breaks in the real pptx and score 泣き別れ / last-line / variance / fill. |
| `../lint/ssim.js` | Conversion-rate: SSIM(HTML render, pptx render). |
| `setup.sh` | One-time environment setup (below). |

## Setup (spec §10)

```bash
bash bin/layout-html/setup.sh   # Yu Gothic -> fontconfig, npm deps, chromium check
```

Needs **Yu Gothic** registered with fontconfig (WSL2: copied from
`/mnt/c/Windows/Fonts`), `playwright-core` + `pngjs`, and a Playwright chromium
binary. All free, no GPU, no image generation.

## Usage

```bash
# bake balanced breaks into a plan, then generate:
node bin/layout-html/bake.js --plan plan.json --out plan.baked.json
node bin/generate.js --plan plan.baked.json --out deck.pptx
# or one command (bake -> generate -> lints -> render):
bash bin/build.sh --plan plan.json --out deck.pptx
```

## Honest caveats (do not pretend these away)

- **Conversion rate never reaches 100%** — Chromium and PowerPoint/LibreOffice
  disagree on font metrics, hinting, and sub-pixel placement. Treat a high SSIM as
  success; the **final typeface arbiter is real PowerPoint**, not the soffice
  preview. The bake's correctness is proven by `typo-lint` (0 orphans), not SSIM.
- **Baked breaks are frozen at build time.** If the client heavily edits the text
  afterward, re-run the bake — hand-retyping can reintroduce the orphan the engine
  removed.
- **Generated assets stay per-project** (`assets/generated/`), never in the plugin.
- If the engine isn't set up, `build.sh` **falls back** to the un-baked plan + the
  visual QA loop, so decks still build — just without automatic orphan removal.
