# pptx-creation

A reusable **Claude Code plugin** that plans, composes, generates, and reviews
high-quality PowerPoint (`.pptx`) decks — tuned for clean Japanese business
slides. Strategy, slide-pattern recipes, the theme schema, and review live here
in the plugin; **per-project content and brand themes live in each project
repo**. One engine, many decks.

The bar this plugin holds itself to is the reference render in
[`examples/seminar-kanrikaikei/`](examples/seminar-kanrikaikei) — generous
margins, a single sharp accent, a dark→light→dark "sandwich", native editable
charts, and **none** of the usual AI tells (no vertical bands, banner-backed
titles, or title underlines).

---

## What it is — and is not

| The plugin owns | Each project repo owns |
|---|---|
| Strategy (how to structure a deck) | The content / 原稿 (what the deck says) |
| Slide-pattern **recipes** (the engine) | The **theme** (`theme.json`: colours, fonts) |
| The theme **schema** + one neutral default | The generated `.pptx` outputs |
| Review + the quality bar | — |

The plugin ships **exactly one** neutral theme. It never stores a brand's
colours or fonts, and a theme never stores chapter structure or slide order —
that separation is the whole point (and is verified in
[`examples/theme-swap-demo/`](examples/theme-swap-demo), where the same deck
renders under a second brand).

## Architecture (three layers that never bleed)

```
THEME tokens      -> themes/<name>/theme.json     (per-project brand: colours, fonts, sizes)
pattern builders  -> bin/generate.js              (the "recipes" — reference tokens only)
deck content      -> deck_plan.json               (per-project content: ordered {pattern, content})
```

**Data flow:**

```
deck-strategy  ─►  deck plan (ordered pattern list)
                       │  (+ project theme.json)
                       ▼
                 bin/generate.js  ─►  output.pptx
                       │
                       ▼
                 QA loop (render → look → fix)  ─►  deck-review (scored)
```

## How to load it

Add the plugin to Claude Code (it lives under `pptx-creation-plugin/`). Its
skills are then callable namespaced, e.g. `/pptx-creation:create-deck`.

The engine is Node + a single runtime dependency:

```bash
cd pptx-creation-plugin
npm install            # pptxgenjs (runtime); ajv is a dev-only extra for bin/validate.js
```

For the QA loop you also need **LibreOffice** (`soffice`) and **poppler**
(`pdftoppm`) on the PATH. (No Java is required — native charts rasterize fine
headless.)

## How to use it from a project repo

1. **`/pptx-creation:project-scaffold`** — make the repo deck-ready (`docs/`,
   a `theme.json` stub, `outputs/`). Never overwrites; emits `.example` on
   conflict.
2. **`/pptx-creation:theme-init`** — create the project's `theme.json` (derive a
   palette from a logo / existing deck, or adjust the neutral default), then
   render a 1-slide preview for sign-off. Visual identity **only**.
3. **`/pptx-creation:deck-strategy`** — turn a goal + 原稿 into a **deck plan**
   (audience → scene → goal-action → message → narrative frame → pattern
   sequence). Structure + wording only; theme-agnostic.
4. **`/pptx-creation:create-deck`** — generate the `.pptx`, run the **mandatory
   QA loop**, then call review.
5. **`/pptx-creation:deck-review`** — score it against the quality bar and emit
   a `deck_review` JSON (bands: <80 reject · 80–89 internal · ≥90 external).

## Skills

| Skill | Use it to… |
|---|---|
| [`deck-strategy`](skills/deck-strategy/SKILL.md) | turn a goal/原稿 into a validated deck plan (pattern order) |
| [`create-deck`](skills/create-deck/SKILL.md) | generate the `.pptx` + run the QA loop + call review |
| [`theme-init`](skills/theme-init/SKILL.md) | create a project's `theme.json` (visual identity only) |
| [`deck-review`](skills/deck-review/SKILL.md) | score a deck and return prioritized fixes |
| [`project-scaffold`](skills/project-scaffold/SKILL.md) | make a project repo deck-ready |

The design philosophy and quality bar deliberately live in
[`references/`](references) and the SKILLs (not in `CLAUDE.md`, which is a
dev-only memo):

- [`references/principles/house-quality-bar.md`](references/principles/house-quality-bar.md) — hard rules, the AI-tell blocklist, the QA loop, the scoring rubric.
- [`references/principles/slide-design-principles.md`](references/principles/slide-design-principles.md) — the method (audience-first, 1 slide 1 message, narrative frames).
- [`references/principles/chart-design.md`](references/principles/chart-design.md) — native charts, chart choice, data integrity.
- [`references/patterns/catalog.md`](references/patterns/catalog.md) — the machine-readable pattern recipes.
- [`references/usecases/`](references/usecases) — per-type beat orders (seminar, financial, proposal).

## The contract (engine input)

A **deck plan** is an ordered list of `{ pattern, content }` (optionally wrapped
with `meta`). A **theme** is colours/fonts/sizes. Both are schema-checked:

- [`schemas/deck_plan.schema.json`](schemas/deck_plan.schema.json)
- [`schemas/theme.schema.json`](schemas/theme.schema.json)
- [`schemas/deck_review.schema.json`](schemas/deck_review.schema.json)

```bash
# generate
node bin/generate.js --plan <deck_plan.json> [--theme <theme.json>] --out <out.pptx>
# QA render (then OPEN each image and inspect)
bash bin/qa.sh <out.pptx>
# pre-flight schema validation (dev)
node bin/validate.js
```

## Pattern catalog (9 patterns)

`cover` · `message` · `two-column` · `comparison` · `chart` · `stat-grid` ·
`table` · `section` · `cta`. Each has a documented job, content slots, and a
hard **capacity** (split rather than cram). See
[`catalog.md`](references/patterns/catalog.md). Roadmap: `process`, `timeline`,
`quote`.

## The mandatory QA loop

Generating a `.pptx` is **not** "done." `create-deck` always renders the deck to
per-slide images (`bin/qa.sh`), **opens and inspects every one** (ideally with a
fresh sub-agent — right after generating you see what you expect, not what's
there), fixes any break, and re-renders. If a break can't be cleanly fixed, it
**stops and reports with the screenshot** rather than ship a compromised slide.
Full procedure: [house-quality-bar.md §5](references/principles/house-quality-bar.md).

## Examples

- [`examples/seminar-kanrikaikei/`](examples/seminar-kanrikaikei) — the
  reference seminar deck (the visual pass-line) + plan + review.
- [`examples/financial-analysis/`](examples/financial-analysis) — a 10-slide
  board review exercising `section` / `stat-grid` / `table` + plan + review.
- [`examples/theme-swap-demo/`](examples/theme-swap-demo) — the seminar deck
  re-rendered under a second brand (navy + amber), proving theme/structure
  separation.

## Recommended companion

Anthropic's official **`pptx`** skill pairs well with this plugin: its
`scripts/office/soffice.py` is a drop-in stand-in when `soffice` isn't on the
PATH (the QA script prints this hint), and it's handy for reading/extracting
from existing `.pptx` files. This plugin focuses on *authoring* high-quality
decks from a plan + theme; the official skill is a good general `.pptx` toolkit
alongside it.

## Assumptions

- **One engine first.** Only the verified **pptxgenjs** engine ships;
  `requirements.txt` is a stub for a possible future python-pptx track (added
  only if numeric needs demand it). The priority was "never breaks across decks"
  on one engine before adding a second.
- **Japanese business decks** are the primary target (default font `Meiryo`;
  `Yu Gothic` / `Noto Sans JP` also valid). The engine is content-agnostic, but
  examples, capacities, and cautions are tuned for JP.
- **Footer brand** is deck content (`meta.footerLabel`) or theme chrome
  (`theme.brand.footerLabel`); the neutral default ships it empty so no brand
  identity lives in the plugin.
- **QA rendering uses LibreOffice + poppler.** Renders are a faithful proxy for
  PowerPoint; tiny font-substitution differences (LibreOffice substitutes
  `Meiryo`) don't affect layout QA.
- **New patterns ship with the engine and the catalog together** — and only
  after passing the QA loop (see `CLAUDE.md`).

## Repo layout

```
pptx-creation-plugin/
├── .claude-plugin/plugin.json   # manifest (the ONLY thing in .claude-plugin/)
├── CLAUDE.md                    # dev memo (NOT the quality core)
├── README.md
├── bin/                         # generate.js (engine) · qa.sh (QA render) · validate.js (dev)
├── skills/                      # deck-strategy · create-deck · theme-init · deck-review · project-scaffold
├── references/                  # principles/ · patterns/ · usecases/   (the design brain)
├── schemas/                     # theme · deck_plan · deck_review
├── themes/_default-neutral/     # the one shipped neutral theme
└── examples/                    # seminar-kanrikaikei · financial-analysis · theme-swap-demo
```

## License

MIT.
