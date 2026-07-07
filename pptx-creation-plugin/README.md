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

The plugin ships a **bookshelf of design languages** — `neutral-business` (the
default), `swiss`, `editorial`, `minimal`, `data-driven`, `wa-modern`, and
`hybrid-editorial` — each a **style template** (palette / type / whitespace /
font, and **composition** via `theme.layout` — card shape, kicker, cover motif),
not a brand. It never stores a *brand's* colours, and a theme never stores
chapter structure or slide order — that separation is the whole point (verified in
[`examples/theme-swap-demo/`](examples/theme-swap-demo)). Pick **one** language
per deck via the [`design-language`](skills/design-language/SKILL.md) skill; a
project copies a shelf theme and adjusts its brand colours. See
[`references/design-languages/`](references/design-languages).

## Architecture (three layers that never bleed)

```
THEME tokens      -> themes/<name>/theme.json     (per-project brand: colours, fonts, sizes)
pattern builders  -> bin/generate.js              (the "recipes" — reference tokens only)
deck content      -> deck_plan.json               (per-project content: ordered {pattern, content})
```

**Data flow:**

```
deck-brief  ─►  deck-strategy  ─►  deck plan (ordered pattern list)
 (intent:                              │  (+ project theme.json)
  register/様式含む)                    ▼
                bin/build.sh — the gated pipeline:
                  bake(kinsoku) → asset rasters → generate →
                  geometry-lint → design-lint → typo-lint → image-lint
                  → render → saliency-lint        ─►  output.pptx
                                       │   (blocking gates exit non-zero)
                                       ▼
                                 QA loop (render → LOOK → fix)  ─►  deck-review (scored)
```

## How to load it

Add the plugin to Claude Code (it lives under `pptx-creation-plugin/`). Its
skills are then callable namespaced, e.g. `/pptx-creation:create-deck`.

The engine is Node:

```bash
cd pptx-creation-plugin
npm install                    # pptxgenjs · budoux · playwright-core · pngjs (+ @dicebear/* for offline figure gen)
bash bin/layout-html/setup.sh  # one-time: pins the headless Chromium (kinsoku bake · SVG rasters · pixel lints)
```

For the QA loop you also need **LibreOffice** (`soffice`) and **poppler**
(`pdftoppm`) on the PATH. (No Java is required — native charts rasterize fine
headless.) Without the Chromium, `build.sh` degrades gracefully (no bake, no
raster assets) — fine for a smoke test, not for a shipped deck.

## How to use it from a project repo

**Set the project up once:**

1. **`/pptx-creation:project-scaffold`** — make the repo deck-ready (`docs/`,
   a `theme.json` stub, `outputs/`). Never overwrites; emits `.example` on
   conflict.
2. **`/pptx-creation:design-doc`** — author the repo's **`DESIGN.md`**: the
   standing design system + deck conventions (brand + design language,
   per-audience presets, honesty house rules, constraints, verification bar).
   `deck-brief` reads this on every deck, so all your decks come out on-brand and
   consistent. Once per project; update on brand changes.
3. **`/pptx-creation:theme-init`** — create the project's `theme.json` from
   DESIGN.md §2 (derive a palette from a logo / existing deck, or adjust the
   neutral default), then render a 1-slide preview for sign-off. Visual identity **only**.

**Then, per deck:**

4. **`/pptx-creation:deck-brief`** — turn a vague or partial ask into a complete,
   structured **brief**. Reads `DESIGN.md` for the stable slots and asks only the
   per-deck delta (this deck's message + data); the intake that sets the quality
   ceiling. See [Writing the brief](#writing-the-brief-the-input-that-sets-the-ceiling).
5. **`/pptx-creation:deck-strategy`** — turn the brief + 原稿 into a **deck plan**
   (audience → scene → goal-action → message → narrative frame → pattern
   sequence). Structure + wording only; theme-agnostic.
6. **`/pptx-creation:create-deck`** — generate the `.pptx`, run the **mandatory
   QA loop**, then call review.
7. **`/pptx-creation:deck-review`** — score it against the quality bar and emit
   a `deck_review` JSON (bands: <80 reject · 80–89 internal · ≥90 external).

## Writing the brief (the input that sets the ceiling)

The engine guards geometry, kinsoku, orphans, overflow, and the AI-tell blocklist
**for you**. What it can't invent is *intent* — so the instruction you give sets
the ceiling on quality. Don't spend words on geometry ("20pt blue, left-aligned");
spend them on the four layers the plugin separates but can't guess: **the message,
the honest material, the audience, and the bar.** Fill this brief (or just run
[`deck-brief`](skills/deck-brief/SKILL.md) and let it ask only for the gaps):

```text
【読み手】    誰に（例：取締役会／金融機関・財務リテラシー高）        ← 推測不可、必ず指定
【場面】      いつ・何分・対面/配布（密度とトーンが決まる）
【目的＝行動】読後に取ってほしい行動（例：来期投資の承認）           ← "理解させる"ではなく行動
【結論】      一番言いたい主張ひとつ（例：増収しながら収益性も改善）  ← ラベルでなく言い切り
【素材】      実データ・原稿を貼る（数字はここで渡す）
【正直ラベル】どれが会社予想/概算/採用値/定義違い                    ← 財務系はこれが外部通過の鍵
【構成】      おまかせ（deck-strategyに組ませる）／「SCQAで10枚以内」等
【デザイン】  bookshelf名（neutral/swiss/editorial/…）／アドホック指定
【ﾚｼﾞｽﾀｰ/人物】meta.intent（financial/board=抑制・人物なし ／ seminar/education/marketing=
              persona・会話・証言OK）と meta.personStyle（silhouette=格式／illustration=親しみ、
              1デッキ1様式）。人物素材があれば assets/generated/figures/ へ（LICENSE記録必須）
【制約】      枚数・禁止（キャラIP不可/数字は与えた物のみ）・ブランド/フォント・出力先
【検証】      QAループ＋各lint＋deck-reviewを回す。external(≥90)狙い。直せない崩れは止めて報告
```

**Three slots do the heavy lifting** — put your effort here:

- **結論 (one message)** — if each section is a *claim*, the engine's titles become
  conclusions, and the deck argues instead of listing. Push "海外について" →
  "海外が利益率を底上げしている".
- **正直ラベル** — labelled estimates / bases / forecasts / metric definitions are
  what carry a business deck into the `external` band (house bar §4).
- **読み手** — board vs beginners changes tone, density, pattern, even the design
  language. Never assume it.

**Weak vs strong:** "サンリオでいい感じに" → topic-label titles + a fact dump; but
"投資初心者向け勉強会、『権利で稼ぐ高利益率企業』を結論に、台本の数字で、会社予想は明示"
→ a deck that argues. You don't need a perfect one-shot brief — the QA loop and your
real-machine feedback refine it; fixing audience, goal-action, message, and honesty
is enough to start.

**Making many decks?** Capture the *stable* answers — brand, per-audience presets,
honesty house rules, constraints, the bar — once in a project **`DESIGN.md`** via
[`design-doc`](skills/design-doc/SKILL.md). `deck-brief` reads it and then asks
only each deck's message and data, so every deck is on-brand without re-briefing.
DESIGN.md (project, standing) × the brief (one deck) is the precision multiplier.

## Skills

The full pipeline map and per-skill boundaries live in
[`skills/README.md`](skills/README.md); each skill's playbook is its
`SKILL.md`.

| Skill | Use it to… |
|---|---|
| [`design-doc`](skills/design-doc/SKILL.md) | author the project's `DESIGN.md` — its standing design system + deck conventions (read by `deck-brief`) |
| [`deck-brief`](skills/deck-brief/SKILL.md) | turn a vague ask into a complete, structured brief (the intake that sets the ceiling) |
| [`design-language`](skills/design-language/SKILL.md) | pick one design language from the bookshelf (theme + principles) |
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
- [`references/principles/visual-psychology.md`](references/principles/visual-psychology.md) — the gaze-design layer: one protagonist per slide (`emphasis`), one climax per deck (`peak`), the marker vocabulary, the CUD colour floor, and the honesty guard on what may be emphasized.
- [`references/principles/education-register.md`](references/principles/education-register.md) — the register gate (`meta.intent`), the three education modes, and the person/figure policy (persona 床規則・人物素材の出所).
- [`references/principles/hybrid-architecture.md`](references/principles/hybrid-architecture.md) — the drawing contract (M-7..M-10) and the asset pipeline (SVG master → transparent PNG@2x).
- [`references/patterns/catalog.md`](references/patterns/catalog.md) — the machine-readable pattern recipes + the 幾何契約 (elevation / connector / alignment floors).
- [`references/graphics/`](references/graphics) — code-drawn SVG recipes (backgrounds / icons / motifs) and the diagram skeleton recipes.
- [`references/usecases/`](references/usecases) — per-type beat orders (seminar, financial, proposal).

## The contract (engine input)

A **deck plan** is an ordered list of `{ pattern, content }` (optionally wrapped
with `meta`). A **theme** is colours/fonts/sizes. Both are schema-checked:

- [`schemas/deck_plan.schema.json`](schemas/deck_plan.schema.json)
- [`schemas/theme.schema.json`](schemas/theme.schema.json)
- [`schemas/deck_review.schema.json`](schemas/deck_review.schema.json)

```bash
# THE build (gated pipeline — use this for real decks)
bash bin/build.sh --plan <deck_plan.json> [--theme <theme.json>] --out <out.pptx>
# engine only (debugging, no gates)
node bin/generate.js --plan <deck_plan.json> [--theme <theme.json>] --out <out.pptx>
# QA render (then OPEN each image and inspect)
bash bin/qa.sh <out.pptx>
# regression gate: all themes × examples + adversarial tortures
bash tests/run-gate.sh
# pre-flight schema validation (dev)
node bin/validate.js
```

## Pattern catalog (24 patterns)

**Content patterns** — `cover` · `message` · `two-column` · `comparison` ·
`chart` · `stat-grid` · `card-grid` · `table` · `section` · `cta` ·
`before-after` (誤解→訂正).

**Diagram skeletons** (native shapes + native labels, gated per cell by the
height floor) — `flow` · `cycle` · `matrix` · `timeline` · `steps` · `branch` ·
`formula` · `waterfall` · `positioning` (options + VS) · `system` (actors +
labeled flows) · `relation` (対応/分類 — the form follows the data: a partition
renders as zone grouping, not a line web). Diagrams are chosen
**conservatively** (default to text — deck-strategy §3b,
[`diagram-recipes.md`](references/graphics/diagram-recipes.md)).

**Register-gated devices** — `dialogue` (conversation / ○×の会話比較) and
`testimonial` (お客様の声) — avatar + speech-bubble layouts allowed only in
learner/marketing registers (`meta.intent`); a lint ERROR on financial/board.

Each pattern has a documented job, content slots, and a hard **capacity**
(split rather than cram). See [`catalog.md`](references/patterns/catalog.md).

On top of the patterns sits the **visual-psychology layer**: ONE protagonist
per slide (`emphasis` — e.g. a stat-grid card gets the AREA treatment, an
emphasized column chart gets a wider bar + bold label), ONE `peak` per deck,
and an optional factual `marker` (badge / arrow-note / underline) — all
honesty-guarded (emphasize only what the data supports) and lint-enforced for
scarcity. The `chart` pattern supports `column`/`bar`/`line`/`pie`/`doughnut`/
`band`, a dashed `targetLine` and a `unit` label; every design language can
shift **composition** via `theme.layout`, and any slide can carry a code-drawn
`bgMotif` / `icon` ([`svg-recipes.md`](references/graphics/svg-recipes.md)) —
all optional and empty by default (unused features render byte-identically).

## Persons (人物図版) — register decides, one style per deck

Persons are opt-in devices, never decoration: `persona` (a figure + seam-free
speech bubble + native quote + ※例 marking on message/two-column slides) and
the `dialogue`/`testimonial` speakers above. The rules that keep them honest:

- **`meta.intent` gates the device** — financial/board decks never show a
  persona or bubble (lint ERROR); seminar/education/marketing may.
- **`meta.personStyle` fixes ONE style per deck** — `silhouette` (黒シルエット,
  restraint) or `illustration` (カラーイラスト, 親しみ); the STYLE-UNIFORM lint
  ERRORs on mixing.
- **Assets are user-supplied** (the engine never AI-generates or scrapes a
  person — M-7): they live in the project's `assets/generated/figures/` with a
  real `LICENSE.md` record (the LICENSE lint WARNs until one exists) and a
  `figures-index.md` inventory (the scene→figure catalog). Supplied SVGs ride
  the asset pipeline (master → token recolour → transparent PNG@2x → embed);
  in-engine neutral fallbacks (`style:"silhouette"|"pictogram"`, bust avatars)
  exist for gaps. Fictional persons/voices always carry ※例 — 例示を事実主張と
  混ぜない.

## The mandatory QA loop + the machine gates

Generating a `.pptx` is **not** "done." `bin/build.sh` runs the machine gates
first — **geometry-lint** (parses the generated pptx XML: outline/drift/
alignment/connector quality; text COLLISION blocks), **design-lint** (capacity,
card overflow, emphasis/register/marker rules, AI-tell characters; blocking),
**typo-lint** (泣き別れ/orphans), **image-lint** (2x-resolution floor,
transparency, LICENSE records, avatar/style uniformity) and, after the render,
**saliency-lint** (does the declared protagonist actually out-shine its
bystanders in pixels?). Every lint is itself verified both ways (a torture
fixture that fires it AND a clean fixture that passes — `tests/run-gate.sh`).

Then the human half: `create-deck` renders to per-slide images (`bin/qa.sh`),
**opens and inspects every one** (ideally with a fresh sub-agent — right after
generating you see what you expect, not what's there), fixes any break, and
re-renders. If a break can't be cleanly fixed, it **stops and reports with the
screenshot** rather than ship a compromised slide. Full procedure:
[house-quality-bar.md §5](references/principles/house-quality-bar.md).

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

- **One engine first.** Only the verified **pptxgenjs** engine ships. The other
  runtime deps serve the floors, offline: budoux (kinsoku), the pinned headless
  Chromium (bake / rasters / pixel lints), vendored DiceBear (deterministic CC0
  figure generation — no HTTP API is ever called).
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
├── bin/                         # generate.js (engine) · build.sh (THE gated pipeline) · qa.sh (render) · svg-render.js · validate.js
│   ├── lint/                    #   design-lint · geometry-lint · typo-lint · image-lint · saliency-lint · ssim
│   ├── layout-html/             #   bake · measure · geometry (kinsoku engine + the height floor)
│   └── graphics/                #   diagrams.js (ALL layout math — the single source) · recipes (SVG) · make-markers (asset rasters) · gen-figures (CC0 busts)
├── skills/                      # design-doc · deck-brief · design-language · deck-strategy · create-deck · theme-init · deck-review · project-scaffold
├── references/                  # principles/ · patterns/ · graphics/ · design-languages/ · usecases/  (the design brain)
├── schemas/                     # theme · deck_plan · deck_review
├── themes/                      # neutral (default) + swiss · editorial · minimal · data-driven · wa-modern
├── tests/                       # run-gate.sh (regression gate) · adversarial/ (torture fixtures)
└── examples/                    # seminar-kanrikaikei · financial-analysis · theme-swap-demo
```

(`assets/generated/` — supplied figure assets + their LICENSE / figures-index
records — is deliberately **git-ignored**: person assets belong to each project
and are never redistributed with the plugin.)

## License

MIT.
