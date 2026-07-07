---
name: create-deck
description: Use to generate a PPTX from a deck plan and project theme. Runs bin/generate.js, then ALWAYS runs the mandatory visual QA loop (render to images, inspect, fix), and finally calls deck-review. Use whenever the user wants slides/a deck/a presentation produced.
---

# create-deck

This is the **generation** skill: it turns a deck plan + a theme into a `.pptx`,
then proves the result is clean before reporting done. Generating the file is the
easy half. The QA loop is the half that makes the deck look designed instead of
auto-generated — **never skip it** (M-2).

The reference render that defines "acceptable" is `examples/seminar-kanrikaikei/`.
No deck you ship may look worse than that. The bar you are gating against lives in
[`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md);
the pattern contracts you are filling live in
[`../../references/patterns/catalog.md`](../../references/patterns/catalog.md).

---

## 1. Inputs

You need two files:

- **A deck plan** — an ordered list of slides, each naming one of the **24
  patterns** plus that pattern's content slots. It must validate against
  [`../../schemas/deck_plan.schema.json`](../../schemas/deck_plan.schema.json).
  Normally `deck-strategy` produces this; if no plan exists, author one first
  (audience → scene → goal-action → message → pattern, per the house bar §1).
  Do **not** start drawing before the message is decided.
- **A project theme** — `theme.json` conforming to
  [`../../schemas/theme.schema.json`](../../schemas/theme.schema.json). Default:
  [`../../themes/_default-neutral/theme.json`](../../themes/_default-neutral/theme.json)
  (`neutral-business`). A theme carries **only** look-and-feel — colors, fonts,
  sizes, canvas. It never holds chapter structure or slide order; those live in
  the deck plan / `deck-strategy` content (M-6). If you find yourself wanting to
  put "slide 3 then slide 4" into a theme, stop — that belongs in the plan.

Determine the **usecase** from the plan (seminar, sales, IR/financial, internal
report, …). If a matching guide exists under
[`../../references/usecases/`](../../references/usecases/), read it before
generating — it sets tone, density, and content-integrity expectations. The
directory may be empty or partial, so treat it as help rather than a hard
requirement; regardless, financial decks must label estimates and never omit
assumptions (house bar §4).

The 24 pattern ids live in the engine's `PATTERNS` map (`bin/generate.js`) and
each one's contract in `catalog.md` — base patterns (`cover`…`cta`), diagram
skeletons (`flow`/`cycle`/…/`relation`), and the register-gated devices
(`dialogue`, `testimonial`). Any other `pattern` id makes the engine throw.
The plan's `meta.intent` and `meta.personStyle` drive the register/style gates
— they are content decisions (deck-strategy's), not yours to change here.

---

## 2. Generate (bake → generate → lint → render)

Run the whole pipeline in one command. It **bakes balanced Japanese line breaks**
(kinsoku — no 泣き別れ) into the plan, generates the native pptx, runs the two
automatic gates, and renders for the QA loop:

```bash
bash bin/build.sh --plan <plan.json> --theme <theme.json> --out <out.pptx>
```

Under the hood: [`bin/layout-html/bake.js`](../../bin/layout-html/bake.js) (compute
balanced breaks in real Yu Gothic → explicit line arrays, spec §5) →
[`bin/graphics/make-markers.js`](../../bin/graphics/make-markers.js) (rasterize
every persona figure / avatar / bubble / marker / scene symbol as a transparent
PNG **sized by the same layout the engine draws with**) →
[`bin/generate.js`](../../bin/generate.js) (draw natively) →
`geometry-lint` + `design-lint` + `typo-lint` + `image-lint` (§3) →
[`bin/qa.sh`](../../bin/qa.sh) (render) → `saliency-lint` (advisory).

- **Baking is the typesetting floor**
  ([`typography.md`](../../references/principles/typography.md),
  [`kinsoku.md`](../../references/principles/kinsoku.md)): it mechanically removes
  orphaned trailing characters (泣き別れ) AND compound-word splits (熟語分割, via
  budoux), so you don't hand-split lines — priority is 泣き別れ > 熟語 > balance.
  For project brand/terms that must never split, pass `--lexicon <assets/lexicon.json>`.
  It needs the one-time Phase-B setup — `bash bin/layout-html/setup.sh` (Yu Gothic +
  Playwright + budoux). If that engine isn't present, `build.sh` **falls back** to
  the un-baked plan and the visual QA loop still backstops you — the deck still builds.
- To run the raw engine alone (debugging):
  `node bin/generate.js --plan <p> --theme <t> --out <o>`. `--theme` defaults to
  `themes/_default-neutral/theme.json`.
- The engine is the **source of truth for every coordinate and size** — never pass
  geometry through the plan, and never edit the produced `.pptx` by hand (see §6).
- If the engine throws (`Unknown pattern …`, a schema-shaped content gap), fix the
  **plan**, not the engine, and re-run.

---

## 3. The mandatory QA loop (M-2 — generating is NOT done)

A written `.pptx` is **not** a finished deck. The first render almost always has a
few breaks. Run this loop every single generation. Full procedure:
[`house-quality-bar.md` §5](../../references/principles/house-quality-bar.md).

**The automatic gates run first (no eyes needed — `build.sh` runs them):**
**geometry-lint** (parses the GENERATED pptx XML — outline/drift/alignment/
connector quality; a text **COLLISION blocks**), **design-lint**
([`bin/lint/design-lint.js`](../../bin/lint/design-lint.js) — contrast, margins,
capacity, **card overflow**, emphasis/register/marker rules, AI-tell characters,
placeholders; blocking on ERROR), **typo-lint** (predicted Japanese line breaks,
泣き別れ/orphans), and **image-lint** ([`bin/lint/image-lint.js`](../../bin/lint/image-lint.js)
— every embedded image's 2x-resolution floor, transparency (OPACITY), the
LICENSE record floor for supplied figures, AVATAR-UNIFORM, and **STYLE-UNIFORM**
= 1デッキ1様式). After the render, **saliency-lint** warns when a bystander
out-shines the declared protagonist (advisory). Clear the ERRORs first —
`build.sh` still renders the deck so you can look, but exits non-zero so a
break can't ship unnoticed.

Orphan / compound-split / height protection covers both the **prose** fields and
the auto-wrapping **heading** (`title`) — so an enlarged heading that wraps and
strands a tail (e.g. 「…まで上／昇」) is caught and re-balanced (上昇 kept intact),
and a heading that wraps past its header region is a height ERROR. cover/cta
`titleLines` are author-controlled arrays (break them by hand).

The **card-overflow** check is the machine version of the top failure mode below:
it counts a field's baked lines and fails when they exceed the box's inner height
(chart `takeaway`, cta `offerBody`, stat-grid `sub`, and each pattern's `title`;
the safety margin and per-box geometry live in [`bin/layout-html/geometry.js`](../../bin/layout-html/geometry.js)).
It is a **soffice/Yu-Gothic proxy** — real PowerPoint's line height can differ, so
the margin absorbs jitter but the on-machine look still matters. These gates are a
cheap pre-filter that saves a QA round, **not** a replacement for the render-and-look
below: composition, emphasis, overlap, and contrast *in context* still need eyes,
and `comparison` cards aren't height-checked yet (measured by eye).

### a. Render to images

```bash
bash bin/qa.sh <out.pptx>
```

This converts PPTX → PDF → per-slide JPG (default `<deck_dir>/qa/slide-*.jpg`) and
scans the binary for leftover placeholders. See
[`../../bin/qa.sh`](../../bin/qa.sh). It only *produces* the images — it does not
look at them. You do.

### b. Open EVERY slide image and inspect

Open each `slide-*.jpg` and actually look. Best done with a **fresh perspective —
a sub-agent** — because right after generating you see what you *expected* to draw,
not what's actually on the slide. Checklist, most-frequent failure first:

- **Text overflow** — text spilling out of its box. This is the **top** failure
  mode. Watch the patterns near capacity: a `two-column` 4th item (gap 1.42 lands
  near the footer), a `cover`/`cta` title past 2 lines, a `comparison` card past
  5 points, a `chart` takeaway past ~4 lines at the card width (see capacities in
  [`catalog.md`](../../references/patterns/catalog.md)).
- **Overlap** — text through shapes, the cover/CTA oval running under glyphs, a
  number-circle colliding with its heading.
- **Edge margin < 0.5"** — reads as "too tight." The neutral default margin is
  `0.75`; honor it.
- **Contrast** — light text on light, or muted text too faint to read.
- **Alignment** — columns and cards not on a shared grid; body text that drifted
  to center (only titles may center).
- **ANY AI-tell** — vertical color bands / side ribbons, full-width banners behind
  titles, title underlines, thin stripe "accent tabs" on a card edge, rainbow
  palettes, emoji-as-icon. The full blocklist is
  [`house-quality-bar.md` §2](../../references/principles/house-quality-bar.md) —
  do not restate or relax it; just confirm none has crept in. To emphasize a card,
  the engine uses a soft tint (`surfaceAccent`) + soft shadow, **never** a stripe.
- **Person composites** (persona / dialogue / testimonial slides) — the figure
  or avatar actually rendered (a missed raster trigger once shipped bubble-less
  slides), the bubble tail points at ITS speaker, quotes fit their bubbles,
  ※例 marks present and colliding with nothing, and every person is the SAME
  style (混在は lint が捕るが、様式が場に合うかは目視).
- **Leftover placeholders** — `lorem` / `ipsum` / `TODO` / `[insert`. `qa.sh`
  flags these in the binary, but eyeball the render too.

### c. Fix → regenerate → re-check

Fix the cause in the **plan** (shorten/split content, drop an over-capacity item,
move emphasis to the right card), regenerate, and re-render the affected slides.
Repeat until clean.

### d. Stop when clean

The goal is a clean deck, not a perfect one. Once the breaks above are gone, stop.
**Do not chase sub-pixel perfection or loop forever.**

### e. If a break can't be cleanly fixed: STOP and report (M-4)

If a slide simply won't fit — overflow that won't shrink without dropping meaning,
a chart that won't size, a layout the patterns can't express — **STOP and report
with the screenshot**. Do **not** ship a compromised slide, and do not hack the
geometry to force it. The honest move is to surface it: propose splitting the slide,
cutting content, or (if it's a genuine pattern gap) flag the roadmap in
[`catalog.md`](../../references/patterns/catalog.md). Shipping a broken slide fails
review regardless of every other score (house bar §6).

---

## 4. Review

When the QA loop is clean, call the **deck-review** skill
([`../deck-review/SKILL.md`](../deck-review/SKILL.md)). It scores the deck against
the rubric (100 pts across five dimensions) and emits a result shaped by
[`../../schemas/deck_review.schema.json`](../../schemas/deck_review.schema.json).
Your per-slide QA result feeds its `visualIntegrity` dimension — pass it along.

- Band **`reject`** (< 80, or any unresolved visual break) → loop back to §3 fixes,
  regenerate, re-QA, re-review. Do not ship.
- Band **`internal`** (80–89) → acceptable internally; list the listed improvements.
- Band **`external`** (≥ 90) → cleared for external delivery.

---

## 5. Report

When done, report back:

1. **Files produced** — the `.pptx` path and the `qa/` image directory.
2. **What the QA loop caught and fixed** — name the slides and the break type
   (e.g. "slide 4: comparison right card overflowed at 6 points → cut to 5").
3. **Residual known issues** — anything you consciously left, and why.
4. **The review band** — `reject` / `internal` / `external`, with the verdict.

If you stopped under M-4, the report leads with the screenshot and the unfixable
break, not with a shipped file.

---

## 6. pptxgenjs landmines (the engine handles these — don't undo them)

These are the traps the verified engine in
[`../../bin/generate.js`](../../bin/generate.js) already navigates. Know them so you
don't reintroduce one by hand-editing output or hand-rolling a slide:

- **Colors are 6-digit hex WITHOUT a leading `#`.** Theme colors are stored bare
  (e.g. `accent: "0E7C86"`) exactly because pptxgenjs wants them that way.
- **Never bake opacity into an 8-digit hex.** Use the `opacity` property instead
  (the engine's `cardShadow` does: `opacity: 0.12`). An 8-digit alpha hex will not
  render the way you expect.
- **Native bullets via `bullet: true`** (or `bullet: { indent: … }`, as in the
  `comparison` builder) — **never** a literal `•` character typed into the string.
- **Build a FRESH options / shadow object per call.** pptxgenjs **mutates** the
  option objects you pass it, so a shared object bleeds state across shapes. The
  engine returns a new object every call (`cardShadow = (T) => ({ … })`) for this
  reason. If you ever add a shape, do the same.
- **`.pptx` is a ZIP.** Do not hand-edit the file or its XML — you will corrupt the
  archive. To change a slide, change the plan and regenerate. The QA loop assumes a
  clean engine-produced file.

---

## Recommended companion

The official Anthropic **`pptx`** skill is a useful companion. In particular its
`scripts/office/soffice.py` can stand in for `soffice` when LibreOffice isn't on the
`PATH` — `bin/qa.sh` already prints this fallback if it can't find `soffice`. The QA
loop's PPTX → PDF → JPG step needs LibreOffice (or that stand-in) plus poppler
(`pdftoppm`).
