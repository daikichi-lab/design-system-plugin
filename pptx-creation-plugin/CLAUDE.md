# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read this first (M-5).** This file is an **engineering memo for humans and
> agents hacking on the plugin**. It deliberately holds **none** of the quality
> core. The design norms, the hard rules, the AI-tell blocklist, the scoring
> rubric, and the pattern contracts live in `references/` and the SKILLs —
> **never here**. If you came looking for "what makes a good deck," go to
> `references/principles/house-quality-bar.md` and
> `references/patterns/catalog.md`. Putting design norms in CLAUDE.md is a
> violation of M-5; keep this file purely mechanical.

## What this plugin is

`pptx-creation` plans, generates, and reviews high-quality PPTX decks (target:
Japanese business decks). The guidance a model must obey lives in three places:

- **Principles** — `references/principles/`: `house-quality-bar.md` (hard rules
  M-1..M-6, AI-tell blocklist, QA loop, rubric), `chart-design.md`,
  `hybrid-architecture.md` (M-7..M-10 + the asset pipeline),
  `visual-psychology.md` (emphasis/peak/marker layer),
  `education-register.md` (intent gate, persona/人物方針).
- **Patterns** — `references/patterns/catalog.md` (machine-readable recipes for
  all 24 patterns + the deck-plan envelope + 幾何契約). Also
  `references/graphics/diagram-recipes.md` and `references/design-languages/`
  (the style bookshelf — one language per deck).
- **SKILLs** — `skills/*/SKILL.md`: `theme-init`, `deck-brief`, `deck-strategy`,
  `design-language`, `design-doc`, `create-deck`, `deck-review`,
  `project-scaffold`. These are the agent-facing playbooks.

Everything below is plumbing.

## Commands

```bash
npm install                       # pptxgenjs + budoux + playwright-core + pngjs (+ @dicebear/* for figure gen)
bash bin/layout-html/setup.sh     # one-time: pin the headless Chromium (bake / rasterize / pixel lints)

# THE build (full gated pipeline — use this, not bare generate, for real decks):
bash bin/build.sh --plan <deck_plan.json> [--theme <theme.json>] --out <out.pptx>
#   bake → make-markers (persona/avatar/bubble/marker rasters) → generate
#   → geometry-lint (BLOCKING on COLLISION) → design-lint (BLOCKING on ERROR)
#   → typo-lint → image-lint → qa render → saliency-lint (advisory)
#   Exit 1 when a blocking gate fails; the deck still renders for inspection.

node bin/generate.js --plan <p.json> [--theme <t.json>] --out <o.pptx>   # engine only (no gates)
bash bin/qa.sh <out.pptx>         # PPTX → PDF → qa/slide-*.jpg; then OPEN and LOOK (M-2)
bash tests/run-gate.sh            # regression gate: all themes × examples + adversarial tortures
node bin/validate.js [--plan <p> --theme <t>]   # dev pre-flight vs schemas/ (needs ajv)

# individual lints (all take --plan <plan.json> [--theme <t.json>]):
node bin/lint/design-lint.js      # static gate: capacity/emphasis/register/atoms/AI-tells (exit 1 on ERROR)
node bin/lint/geometry-lint.js    # parses the GENERATED pptx XML: outline/drift/align/connector/collision
node bin/lint/image-lint.js       # pixel gate: scrim/2x-resolution/OPACITY/LICENSE/AVATAR- & STYLE-UNIFORM
node bin/lint/saliency-lint.js    # rendered-pixel salience (protagonist must out-shine bystanders)
node bin/lint/typo-lint.js        # typesetting (kinsoku / orphans) — needs the browser

node bin/graphics/gen-figures.js  # regenerate the CC0 openPeeps figure masters (offline, fixed seeds)
```

There is no separate test framework: `tests/run-gate.sh` + the adversarial
fixtures in `tests/adversarial/` ARE the suite. To "run one test", run the
relevant lint against a single plan (fixtures are plain deck plans).

## The 3-layer separation (do not collapse these)

1. **Theme tokens** — `themes/<name>/theme.json` — look-and-feel ONLY (colors,
   fonts, sizes, `theme.layout` composition knobs). **M-6:** a theme never
   carries content or slide order. The bookshelf: `_default-neutral`, `swiss`,
   `editorial`, `minimal`, `data-driven`, `wa-modern`.
2. **Pattern builders** — `bin/generate.js` — reference theme **tokens only**
   (`T.c.*`, `T.s.*`, `T.layout.*`); no hardcoded colors or sizes. 24 patterns
   in the `PATTERNS` map; any other id throws at build time.
3. **Deck content** — `deck_plan.json` per project — `{ meta, slides:[{pattern,
   content}] }`. No geometry travels through the plan. `meta` carries the
   register/style switches (`intent`, `personStyle`, `peak` on slides).

`loadTheme` maps human-friendly `theme.json` color keys onto short internal
token keys via `COLOR_MAP` (e.g. `accentDeep` → `T.c.accentDp`,
`surfaceAccent` → `T.c.surfaceA`).

## One geometry, N consumers (the key cross-file invariant)

`bin/graphics/diagrams.js` is the **single source of truth for layout math**
(node boxes, caps, emphasis scales, persona/speaker/stat-grid geometry). It is
consumed by FOUR independent readers that must never disagree:

- `bin/generate.js` — draws with it,
- `bin/layout-html/geometry.js` — the bake floor (kinsoku line-break + height
  gate) measures the SAME boxes,
- `bin/lint/design-lint.js` — capacity/overflow checks read the same caps,
- `bin/lint/image-lint.js` / `saliency-lint.js` — pixel checks locate regions
  with the same layouts.

If you change a coordinate in one place only, the floor will measure a size the
engine doesn't draw. Always change `diagrams.js` and let every consumer follow.

The same single-source rule applies to raster assets:
`bin/graphics/make-markers.js` materializes every SVG→PNG (markers, persona
figures, bubbles, scene symbols, avatars) **sized by the same layout the engine
draws with**, via `materialize()` (SVG master saved next to a transparent PNG
at ≥2x; >5in → 3x, >8in → 4x). The pptx embeds ONLY PNGs, never SVG.
`bin/build.sh` decides when to call it — if you add a new pattern that needs
rasters, extend the trigger condition in `build.sh` too (a missed trigger ships
slides without their images; this happened once).

## Verify the verifier (M-10)

Every lint/check must be proven BOTH ways before it counts: a torture fixture
that FIRES it and a clean fixture that PASSES. Adversarial fixtures live in
`tests/adversarial/` and are wired into `tests/run-gate.sh`. The regression bar
for engine changes is: all gates + run-gate + byte-identical slide XML for
`examples/*/out/deck.pptx` when the feature is unused (features default
OFF/empty).

## How to ADD a pattern (the only sanctioned path)

1. Layout math in `bin/graphics/diagrams.js` (+ its cap in `CAPS`).
2. Builder in `bin/generate.js` (tokens only) + register in `PATTERNS`.
3. Bake-floor wiring in `bin/layout-html/geometry.js` (`wrappingFields` +
   `heightBoxes`) so native text goes through kinsoku + the height gate.
4. Lint wiring: capacity in `design-lint.js`; raster trigger in `build.sh` and
   materialization in `make-markers.js` if it embeds images.
5. Schema block in `schemas/deck_plan.schema.json` (pattern enum + content).
6. Recipe in `references/patterns/catalog.md` — engine and catalog ship as a
   pair; if they disagree, the engine wins, fix the catalog.
7. Example render + full QA loop + a torture fixture. Only then call it
   available.

## Assets policy (`assets/generated/` is git-ignored)

Supplied figure assets (socost カラー, 黒シルエット, user PNGs) must NEVER be
committed into the plugin — redistribution guard (ソコスト規約) + M-6.
`assets/generated/figures/figures-index.md` is the reviewer's only inventory
window; per-asset `LICENSE.md` records live next to the assets (never create an
empty LICENSE.md just to silence the LICENSE lint — the floor must not lie).
The CC0 openPeeps masters are reproducible offline via
`bin/graphics/gen-figures.js` (fixed seeds, vendored `@dicebear/*`, md5-stable)
— never call a DiceBear HTTP API.

## pptxgenjs landmines

The engine already navigates these; don't reintroduce one:

- **Colors are 6-digit hex WITHOUT a leading `#`** (theme stores them bare).
- **Never bake opacity into 8-digit alpha hex** — use the `opacity` property.
- **Native bullets via `bullet: true`** — never a literal `•` in the string
  (design-lint flags it as an AI-tell).
- **Build a FRESH options/shadow object per call** — pptxgenjs mutates the
  option objects you pass; shared objects bleed state across shapes.
- **`.pptx` is a ZIP** — never hand-edit the archive; change the plan and
  regenerate. (Reading it read-only with `unzip -p` is fine — geometry-lint
  does exactly that.)

## Toolchain

- **Runtime:** Node + `pptxgenjs`, `budoux`, `playwright-core`, `pngjs`.
- **Figure generation (build-time, offline):** vendored `@dicebear/core` +
  `@dicebear/collection` — see `bin/graphics/gen-figures.js`.
- **QA rendering:** `bin/qa.sh` shells out to LibreOffice (`soffice`) for
  PPTX → PDF and poppler (`pdftoppm`) for PDF → JPG. Charts render fine
  headless (native pptx charts, no Java needed).
- **Headless Chromium** (pinned via `bin/layout-html/setup.sh`) powers the bake
  measurements, SVG rasterization (`bin/svg-render.js`) and the pixel lints;
  build.sh degrades gracefully when it is absent (markers skipped, bake skipped)
  but gated decks should always be built WITH it.

**M-2: generating the `.pptx` is NOT "done."** Every generation runs `qa.sh`
and you LOOK at each image (`house-quality-bar.md` §5). Independent
verification is soffice→PDF→PNG; 字面 (Yu Gothic vs Noto substitution) is the
one thing it cannot represent — that stays with the user on real PowerPoint.
**M-4: if a break can't be cleanly fixed, STOP and report with the screenshot.**
