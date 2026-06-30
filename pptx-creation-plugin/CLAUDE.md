# CLAUDE.md — developer memo (NOT loaded as context)

> **Read this first (M-5).** This file is an **engineering memo for humans
> hacking on the plugin**. It is *not* loaded as plugin/project context, and it
> deliberately holds **none** of the quality core. The design norms, the hard
> rules, the AI-tell blocklist, the scoring rubric, and the pattern contracts
> live in `references/` and the SKILLs — **never here**. If you came looking for
> "what makes a good deck," you are in the wrong file: go to
> `references/principles/house-quality-bar.md` and `references/patterns/catalog.md`.
> Putting design norms in CLAUDE.md is a violation of M-5; keep this file purely
> mechanical.

## What this plugin is

`pptx-creation` plans, generates, and reviews high-quality PPTX decks (the
target output is Japanese business decks). The *real* guidance — the stuff a
model must obey — lives in three places, and CLAUDE.md just points at them:

- **Principles** — `references/principles/house-quality-bar.md` (the hard rules,
  the AI-tell blocklist, the QA loop, the scoring rubric) and
  `references/principles/chart-design.md`.
- **Patterns** — `references/patterns/catalog.md` (machine-readable recipes for
  the six slide patterns + the deck-plan envelope).
- **SKILLs** — `skills/*/SKILL.md`: `theme-init`, `deck-strategy`, `create-deck`,
  `deck-review`. These are the agent-facing playbooks.

Everything below is plumbing.

## Repo layout

```
pptx-creation-plugin/
  bin/
    generate.js        # the engine: every coordinate/size lives here (source of truth)
    qa.sh              # PPTX -> PDF -> per-slide JPG for the visual QA loop
  references/
    principles/        # house-quality-bar.md, chart-design.md  <- quality core
    patterns/          # catalog.md  <- the 6 pattern recipes + deck-plan envelope
  schemas/             # theme.schema.json, deck_plan.schema.json, deck_review.schema.json
  themes/
    _default-neutral/  # theme.json (neutral-business) — look-and-feel ONLY
  skills/              # theme-init, deck-strategy, create-deck, deck-review
  examples/            # seminar-kanrikaikei (reference render), theme-swap-demo
  agents/
  .claude-plugin/      # plugin.json manifest
  package.json
```

## The 3-layer separation (do not collapse these)

The engine's whole design is three layers that never bleed into each other:

1. **Theme tokens** — `themes/<name>/theme.json` — per-project *look-and-feel*:
   colors, font family, point sizes, canvas. **M-6: a theme holds ONLY
   look-and-feel.** It must never carry chapter structure or slide order — those
   belong to `deck-strategy` content / the deck plan. If you want to put "slide 3
   then slide 4" into a theme, stop; that is a plan, not a theme.
2. **Pattern builders** — `bin/generate.js` — the "recipes." Builders reference
   theme **tokens only** (`T.c.*`, `T.s.*`); no hardcoded colors or point sizes.
   This is why a theme swap restyles a deck without touching content.
3. **Deck content** — `deck_plan.json` — per-project *content*, an ordered list
   of `{ pattern, content }`. No geometry ever travels through the plan.

`loadTheme` maps the human-friendly `theme.json` color keys onto the short
internal token keys the builders use (`COLOR_MAP` in `bin/generate.js`). The nine
patterns are registered in `PATTERNS` and are **exactly**: `cover`, `message`,
`two-column`, `comparison`, `chart`, `stat-grid`, `table`, `section`, `cta`. Any
other `pattern` id makes the engine throw at build time.

## How to run

```bash
npm install                       # pptxgenjs (runtime) + ajv (dev, for validate.js)
node bin/generate.js --plan <deck_plan.json> --theme <theme.json> --out <out.pptx>
bash bin/qa.sh <out.pptx>         # render to qa/slide-*.jpg, then OPEN and inspect
node bin/validate.js              # dev pre-flight: validate all example plans/themes vs schemas/
node bin/validate.js --plan <p.json> --theme <t.json>   # validate specific files
```

`bin/validate.js` is a **dev-only** convenience (needs the `ajv` devDependency);
the engine itself already fails loudly on a bad plan/theme at build time, so
validation is a pre-flight, not a runtime requirement.

`--theme` defaults to `themes/_default-neutral/theme.json` when omitted. The plan
may be a bare `[ {pattern, content}, ... ]` array or a `{ meta, slides }` object
(see the envelope in `references/patterns/catalog.md`). Try it end-to-end against
`examples/seminar-kanrikaikei/deck_plan.json`.

**M-2: generating the `.pptx` is NOT "done."** Every generation runs the
mandatory QA loop (`bin/qa.sh` then *look at each image*). The full procedure is
`references/principles/house-quality-bar.md` §5 and `skills/create-deck/SKILL.md`
§3 — follow it there, don't reinvent it here. **M-4: if a break can't be cleanly
fixed, STOP and report with the screenshot** — never ship a compromised slide.

## How to ADD a pattern (the only sanctioned path)

The roadmap candidates (`section`, `process`, `table`, `stat-grid`) are listed in
`references/patterns/catalog.md`. To promote one to "available," do these steps
**in order** — never mark a pattern available before it has passed QA:

1. **Implement the builder** in `bin/generate.js`: a function
   `(pres, content, T, ctx) -> slide` that references **theme tokens only** (no
   literal colors/sizes — add a `sizes.*` token to the theme + schema if you need
   a new size).
2. **Register it** in the `PATTERNS` map under its `pattern` id.
3. **Add the recipe** to `references/patterns/catalog.md` (content slots, params,
   `capacity`). The catalog documents the contract; the engine stays the source
   of truth for numbers — if they disagree, fix the catalog, never fork the code.
4. **Render an example** deck that exercises the pattern.
5. **Pass the QA loop** (`bin/qa.sh` + visual inspection; clear all §5 breaks).
6. **Only then** describe it as available (and remove it from the catalog
   roadmap). Update the engine and the catalog **together** — they ship as a pair.

## pptxgenjs landmines (same list `create-deck` cites — see SKILL §6)

The verified engine already navigates all of these; know them so you don't
reintroduce one by hand-editing output or hand-rolling a shape:

- **Colors are 6-digit hex WITHOUT a leading `#`** (theme stores them bare, e.g.
  `accent: "0E7C86"`). That is what pptxgenjs wants.
- **Never bake opacity into an 8-digit alpha hex** — use the `opacity` property
  (the engine's `cardShadow` uses `opacity: 0.12`). An 8-digit hex won't render
  as you expect.
- **Native bullets via `bullet: true`** (or `bullet: { indent: … }`, as in the
  `comparison` builder) — **never** a literal `•` typed into the string.
- **Build a FRESH options/shadow object per call.** pptxgenjs *mutates* the
  option objects you pass it, so a shared object bleeds state across shapes. The
  engine returns a new object every call (`cardShadow = (T) => ({ … })`); do the
  same for any shape you add.
- **`.pptx` is a ZIP.** Do not hand-edit the file or its XML — you will corrupt
  the archive. To change a slide, change the plan and regenerate.

## Toolchain

- **Runtime:** Node + `pptxgenjs` (the only runtime dependency; `npm install`).
- **QA rendering:** `bin/qa.sh` shells out to **LibreOffice (`soffice`)** for
  PPTX → PDF and **poppler (`pdftoppm`)** for PDF → JPG. If `soffice` isn't on the
  `PATH`, the official Anthropic `pptx` skill's `scripts/office/soffice.py` is a
  drop-in stand-in (`qa.sh` prints this hint).
- **Charts render fine headless.** The `chart` pattern emits a *native*
  PowerPoint column chart (`pres.charts.BAR`), which LibreOffice rasterizes
  correctly in the headless PPTX → PDF step — no special handling needed.
