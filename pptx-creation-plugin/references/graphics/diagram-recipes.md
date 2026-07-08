# Diagram recipes (base structures / skeletons)

"Text → diagram" as a **finite set of base structures** ("skeletons"). The design
order is strict and non-negotiable:

1. **Skeleton** — a structure that never breaks as the element count varies
   (this file + [`../../bin/graphics/diagrams.js`](../../bin/graphics/diagrams.js)).
2. **Classify** — conservatively map text → structure (deck-strategy). When the
   structure isn't obvious, **don't diagram** — fall back to text / `stat-grid` /
   `comparison`. Over-diagramming and mis-classification are the worst failures.
3. **Look** — reuse the existing theme tokens + slots (colours, card radius,
   `icon`/`bgMotif`). No new look layer per diagram.

Doing it in reverse (drawing 100 looks first) collapses — so we don't.

## How a skeleton is drawn (M-7 / M-8)

`diagrams.js` owns only the **geometry**: given a theme + element count, where each
node / cell / arrow sits. The engine draws the skeleton with **native shapes**
(roundRect, line+arrow, ellipse, rect) and the labels with **native text** — no
rasterization, editable in PowerPoint. The SAME geometry feeds
[`geometry.js`](../../bin/layout-html/geometry.js), so the **floor applies per
cell**: each node label is measured (kinsoku / orphan) and the **height gate fails
a node whose text overflows its box** — a diagram cell is gated exactly like a card.

Element-count **caps** are the single source of truth in `diagrams.js` (`CAPS`);
design-lint reads them, so an over-/under-count diagram is a hard error (split, or
fall back to text).

## `flow` — N steps, arrow-connected

A process / sequence / timeline. Native roundRect nodes connected by arrows.

```yaml
id: flow
content:
  kicker:    { type: string, required: false }
  title:     { type: string|string[], required: false }
  steps:     { type: string[], required: true, note: "3-6 step labels; native text, one per node" }
  direction: { type: string, required: false, note: "'horizontal' (default) | 'vertical'" }
  emphasis:  { type: int, required: false, note: "protagonist step (0-based): accent-filled node, onDark label, one size step up (×1.15; ×1.3 on the peak slide). One per slide" }
  marker:    { type: object, required: false, note: "badge | arrow-note on the protagonist node (badge rides the shoulder, note sits below; requires emphasis; no circle over a filled node)" }
geometry: "nodes evenly spaced; width auto-computed from n; horizontal row, with a
           vertical-stack fallback when nodes would get too narrow"
capacity: "3-6 steps (CAPS.flow). <3 -> use text/two-column; >6 -> split or a list.
           An EMPHASIZED label loses ~13% of its char budget to the size step —
           keep it short; the floor (bake + height gate) blocks an overflow."
floor:    "each node label is baked (kinsoku) and height-gated AT ITS DRAWN SIZE
           (the emphasized node measures at the stepped-up size); overflow = ERROR"
look:     "node fill surface + accent border, corner radius from theme.layout.card;
           emphasized node = accent fill + accentDeep border + onDark label"
```

**Verified** (element counts 3/4/5/6 render clean; a long node label → OVERFLOW
error at 125% of the node box, seen in the render; n=7 → CAPACITY error; n=2 →
CAPACITY error). Existing patterns byte-identical (flow is additive).

## `cycle` — N nodes on a ring, cyclic arrows

A repeating loop (PDCA, a lifecycle). Native roundRect nodes on an elliptical ring
+ arrows between adjacent nodes going clockwise.

```yaml
id: cycle
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: false }
  steps:  { type: string[], required: true, note: "3-6 node labels; native text, one per node" }
  emphasis: { type: int, required: false, note: "protagonist node (0-based; e.g. the PDCA stage the deck argues is being skipped): accent fill + onDark + one size step. Cycle nodes are SMALL (1.9x0.9) — an emphasized label wants <=4-5 JP chars" }
  marker:   { type: object, required: false, note: "badge | arrow-note on the protagonist node (requires emphasis; no circle)" }
capacity: "3-6 nodes (CAPS.cycle). <3 -> use text/flow; >6 -> split or a list."
geometry: "nodes evenly placed on an elliptical ring (top, then clockwise); arrows
           stop at the box EDGE (ray->box) + a small gap, so the arrowhead always
           shows the direction instead of hiding under the next node"
floor:    "each node label is baked (kinsoku) and height-gated; overflow = ERROR"
look:     "same tokens as flow (surface fill, accent border+arrows, radius from theme.layout.card)"
```

**Verified** (n=3/4/5/6 render clean with visible clockwise arrows; a long node
label → OVERFLOW error at 510% of the small node box; n=7 / n=2 → CAPACITY errors).
The arrow-direction fix (edge clearance) was caught and corrected by the render QA.

## `matrix` — 2×2, two axes + four quadrants

A 2-axis positioning (BCG, effort×impact, SWOT). Native frame + cross + axis labels
in reserved bands + a head/body per quadrant. **Fixed 4 quadrants.**

```yaml
id: matrix
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: false }
  axisX:  { type: string[], required: false, note: "[left, right] X-axis ends, shown top" }
  axisY:  { type: string[], required: false, note: "[top, bottom] Y-axis ends, shown left" }
  emphasis: { type: int, required: false, note: "protagonist quadrant (0=TL,1=TR,2=BL,3=BR): surfaceAccent tint + accentDeep head" }
  emphasizeIndex: { type: int, required: false, note: "LEGACY alias of emphasis (identical); never set both (lint ERROR)" }
  quadrants: { type: array, required: true, note: "EXACTLY 4 (TL,TR,BL,BR), each {head?, body?}" }
capacity: "exactly 4 quadrants (a fixed 2x2); anything else is an error"
layout:   "axis labels live in reserved bands (top strip / left column), so they can
           never collide with quadrant text"
floor:    "each quadrant is a bounded CELL like a card — its body is baked (kinsoku)
           and height-gated; a too-long X-axis label also overflows its band = ERROR"
look:     "frame/cross in the line token, emphasis tint = surfaceAccent, radius from
           theme.layout.card"
```

**Verified** (normal 2×2 clean, all gates pass; a long quadrant body → OVERFLOW at
97%; a 45-char axis label → OVERFLOW at 119% of the top band; 3 quadrants → CAPACITY;
a quadrant orphan was auto-fixed by bake). Existing patterns byte-identical.

## `timeline` — N dated milestones on a horizontal spine

沿革 / company history / product milestones — **dated** events where the horizontal
axis is time. One native arrow line (left → right), an accent dot per milestone,
date + label alternating above / below the line (even index up, odd down) so
adjacent texts keep clear air even when wider than one slot.

```yaml
id: timeline
content:
  kicker:     { type: string, required: false }
  title:      { type: string|string[], required: false }
  milestones: { type: array, required: true, note: "3-7 of {date, label}; date is a
                short year/date (2014.10), label is what happened — both native text" }
capacity: "3-7 milestones (CAPS.timeline). <3 -> text/message; >7 -> split eras into
           two slides, or use a table. Keep labels SHORT (the boxes are ~2.2-2.6in
           wide — a compound word longer than one line forces an ugly split; put
           brand/proper nouns in the project --lexicon)."
geometry: "slot width derives from n; text width = min(2.6, slot*1.7, slot+edge
           allowance) so first/last boxes never cross the 0.5in edge-margin rule and
           same-side neighbours (2 slots apart) never touch"
floor:    "each label box is baked (kinsoku) + height-gated like a card; the DATE
           band is a fixed short strip, so a date that wraps to 2 lines is a hard
           OVERFLOW error instead of a silent collision with the spine"
look:     "spine + dots in accent, dates accentDeep heading-weight, labels ink body —
           the same token set as flow/cycle (no new look layer)"
```

**Verified (2026-07-05)** — n=3 / 5 / 7 render clean (alternating layout, no
overlap, breaks on bunsetsu boundaries); lexicon protection works on milestone
labels (連結最終赤字 kept intact via `--lexicon`); n=2 / n=8 → CAPACITY errors;
a 7-line label → OVERFLOW at 180%; a wrapping date → OVERFLOW at 251%; run-gate
PASS across all 6 themes (examples regenerate + lint clean = no regression).
Real-world content check: すかいらーくHD 7-milestone 沿革 renders clean at the cap.

## `steps` — N ascending stages (階段状ステップアップ)

A staircase read left-bottom → right-top: stages that **build toward a goal**
(成長ステップ, 導入フェーズ, 学習ロードマップ). Blocks share one bottom baseline
and rise linearly; the last (goal) block is tinted — the same emphasis convention
as the comparison/stat-grid cards (a tint, never a stripe).

```yaml
id: steps
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: false }
  steps:  { type: string[], required: true, note: "3-5 ascending stage labels; native text, one per block; the LAST is the goal" }
capacity: "3-5 stages (CAPS.steps). <3 -> text/comparison; >5 -> split, or a flow/list.
           Labels short — the FIRST (shortest) block is the binding height constraint."
geometry: "block width derives from n; heights rise linearly STEPS_MIN_H -> STEPS_MAX_H
           on a shared bottom baseline"
floor:    "each stage label is baked (kinsoku) + height-gated against ITS OWN block"
look:     "surface fill + accent border; goal block surfaceAccent + accentDeep (tint,
           never a stripe); radius from theme.layout.card"
```

**Verified (2026-07-05)** — n=3 / 4 / 5 render clean (ascending staircase, goal tint,
bunsetsu breaks via bake); n=2 / n=6 → CAPACITY errors; a 5-line first-stage label →
OVERFLOW at 188%; run-gate PASS across all 6 themes.

## `branch` — 1 → N diverge / N → 1 converge

One anchor and N stacked nodes, arrows fanning between them. `diverge` (default):
the single **source** (left, tinted) feeds the branches (一つの決算書 → 三表).
`converge`: the branches merge into the single **result** (right, tinted) —
現場の声+数字+動向 → 経営判断. Reading stays left → right in both.

```yaml
id: branch
content:
  kicker:    { type: string, required: false }
  title:     { type: string|string[], required: false }
  source:    { type: string|string[], required: true, note: "the single anchor node (tinted)" }
  branches:  { type: string[], required: true, note: "2-4 branch labels, stacked" }
  direction: { type: string, required: false, note: "'diverge' (default) | 'converge'" }
capacity: "2-4 branches (CAPS.branch). 1 branch is a flow; >4 -> group or two-column."
geometry: "single node vertically centered on its side; branches stacked with even
           gaps; arrows fan from/to the single node's edge at spread offsets so the
           heads never pile on one point"
floor:    "source + every branch label baked (kinsoku) + height-gated per node"
look:     "single anchor surfaceAccent + accentDeep (the house emphasis tint);
           branches surface + accent border; arrows accent"
```

**Verified (2026-07-05)** — diverge n=2/3/4 and converge n=3 render clean (fan
arrows land on node edges, no label collision); n=1 / n=5 → CAPACITY; an over-long
branch label → OVERFLOW at 141%; run-gate PASS across all 6 themes.

## `formula` — [result =] A × B × C

A quantity **decomposed into factors** (売上 = 客数 × 客単価 × 店舗数, ROE デュポン
分解) or summands (`operator: "+"`, e.g. コスト = 固定費 ＋ 変動費). One horizontal
row: an optional tinted result box, an `=` cell, then the operands with the
operator glyph between them.

```yaml
id: formula
content:
  kicker:   { type: string, required: false }
  title:    { type: string|string[], required: false }
  result:   { type: string|string[], required: false, note: "tinted result box + '=' when present" }
  operands: { type: string[], required: true, note: "2-4 factor/summand labels" }
  operator: { type: string, required: false, note: "'×' (default) | '+'" }
capacity: "2-4 operands (CAPS.formula). 1 operand is a message; >4 -> group factors
           or use a table. Labels are short TERMS, not sentences."
geometry: "boxes share one center line; operator glyphs live in fixed-width cells
           between the boxes, so they can never collide with labels"
floor:    "result + every operand baked (kinsoku) + height-gated per box"
look:     "result surfaceAccent + accentDeep (house emphasis); operands surface +
           accent; operator glyphs accent at title size — native text, no shapes"
```

**Verified (2026-07-05)** — result+3 (売上分解 / ROEデュポン) and 2-operand `+`
render clean; n=1 / n=5 → CAPACITY; an over-long operand → OVERFLOW at 219%;
run-gate PASS across all 6 themes.

## `waterfall` — cumulative bridge (増減要因分解)

The finance staple: a level, the signed drivers that move it, the next level
(営業利益ブリッジ, 売上100円の行き先). Built from **native rects + native text** —
pptxgenjs has no waterfall chart type, and shapes give exact control over what
matters in a 会計 deck: per-block colour and **▲-formatted labels** (the house
表記 rule — never a minus sign).

```yaml
id: waterfall
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: false }
  items:  { type: array, required: true, note: "3-8 of {label, value, total?}.
            total:true = an absolute LEVEL drawn from zero (start / subtotal /
            end); others are signed deltas from the running cumulative." }
  unit:   { type: string, required: false, note: "shown once bottom-left (単位：…)" }
capacity: "3-8 items (CAPS.waterfall). 2 items is a comparison, not a bridge;
           >8 -> group small drivers into その他."
geometry: "value scale derives from the cumulative walk (handles a dip below
           zero — the zero line shifts up); bars 62% of slot; value labels in a
           reserved band above; category labels in a fixed band below"
labels:   "ENGINE-formatted: totals plain, deltas signed +N / ▲N; decimals kept
           when any value is fractional. Only category labels are author text."
floor:    "category labels baked (kinsoku) + height-gated against the band"
look:     "totals accentDeep / increases accent / decreases muted; light zero
           line; dashed muted connectors carry the running level"
```

**Verified (2026-07-05)** — 6-item 営業利益ブリッジ (242 → +80 +40 ▲45 ▲17 → 300)
renders clean with ▲ labels and step connectors; n=2 / n=9 → CAPACITY; a 2-line
category label → OVERFLOW at 101%; run-gate PASS across all 6 themes.

## `identity` — stacked identity (積み上げ恒等式)

The accounting canonical form (`visual-psychology.md` §3.5 正準形ライブラリ): a
WHOLE on the left **＝** its components STACKED to the same total height on the
right — 資産 ＝ 負債 ＋ 純資産, 収入 ＝ 税 ＋ 手取り. The **areas carry the
identity**: erase the ＝ and the composition still reads (the symbol-erasure
test). This is the content `formula` must NOT take — equal boxes joined by ＋
render an identity as 額装 (the exact failure the canonical library exists to
prevent).

```yaml
id: identity
content:
  kicker:   { type: string, required: false }
  title:    { type: string|string[], required: false }
  left:     { type: object, required: true, note: "the WHOLE {label, value?} —
              a short TERM (資産/収入). value omitted + all parts numeric ->
              the engine shows the honest sum." }
  parts:    { type: array, required: true, note: "2-4 of {label, value?, sub?} stacked
              to the whole's height. Values are ALL-OR-NONE: with values the
              stack heights are proportional (honest); without, equal split —
              the engine never invents proportions (盛らない). Non-negative
              only: 債務超過・赤字 are increments/decrements -> use waterfall." }
  emphasis: { type: integer, required: false, note: "protagonist part (usually
              the 残り — 純資産 / 自由なお金): surfaceAccent tint + accentDeep." }
  parts[].sub: { type: array, required: false, note: "ONE-LEVEL NESTING (the
              STRAC form — お金のブロックパズル): 2-3 {label, value?} stacked in a
              third column to exactly the parent part's height (売上＝変動費＋
              限界利益; 限界利益＝固定費＋利益). At most ONE part may carry sub
              (more -> split the slide); values all-or-none; the lint cross-checks
              縦計算 (sub sum vs parent, parts sum vs whole) and WARNs on drift." }
  subEmphasis: { type: integer, required: false, note: "protagonist among the sub
              items (STRAC: 利益). Mutually exclusive with emphasis — one slide,
              one protagonist (lint ERROR on both)." }
  unit:     { type: string, required: false, note: "shown once bottom-left (単位：…)" }
capacity: "2-4 parts (CAPS.identity). 1 part is a message; >4 -> group into
           その他 or use waterfall. Labels are short TERMS — a proportional thin
           slice (≲12% of the whole) holds only a very short label; the height
           gate hard-errors past that (shorten, or carry the point in notes)."
geometry: "left block spans the full stack height; ＝ lives in its own fixed-width
           cell (never collides); part heights = (H − gaps) × value/sum when
           proportional, else equal; stack bottom == whole bottom (the identity,
           machine-checked in the fixture)"
labels:   "part values ENGINE-formatted (thousands comma, decimals kept when any
           value is fractional), joined on the label line; the whole's sum line
           appears only when honest (author value or computed from full parts)"
floor:    "whole + every part label baked (kinsoku) + height-gated per box"
look:     "whole surface (the reference, not the protagonist); parts surface;
           the emphasis part surfaceAccent + accentDeep (house emphasis);
           ＝ glyph accent at title size — native text, no shapes"
```

**Verified (2026-07-08)** — concept form (no values, 2 parts) splits equally and
closes the identity (stack bottom = whole bottom, 0.01in); proportional form
(128,340/164,890/136,740 千円) renders heights at exactly 0.298/0.383/0.318 of
the stack with the honest sum on the whole; n=1 / n=5 → CAPACITY; a negative
part → CAPACITY (waterfall へ誘導); mixed values → all-or-none WARN; a 3% slice
with a sentence-length label → OVERFLOW (height gate); run-gate PASS across all
6 themes (torture-09). **STRAC nesting verified (2026-07-08)** — the textbook
売上100＝変動費40＋限界利益60; 限界利益60＝固定費45＋利益15 renders both levels
at exact proportions (1.272/1.908 and 1.341/0.447 in) with the sub column flush
to its parent's bounds (Δ≤0.001in); thin slices (the canonical 利益 at 15%) keep
their honest height and step the TYPE down instead (identityTextSpec — the
single source the builder draws with and the gate measures with); two parts
with sub / emphasis+subEmphasis / 縦計算 drift → lint (torture-09).

## `breakeven` — CVP / 損益分岐点図

The other 会計セミナー staple beside STRAC: the 売上高線 and the 総費用線
(固定費 floor + 変動費 slope) crossing at the 損益分岐点, with 損失/利益 regions.
**Purely structural — the skeleton carries TERMS, never value labels** (numbers
belong to `chart` / `waterfall` / `table`); the geometry derives from
{fixed, variableRate} when both are given (honest), else the engine draws the
schematic **and auto-stamps ※模式図** (house-bar §4 — a schematic must never
wear a data face).

```yaml
id: breakeven
content:
  kicker:       { type: string, required: false }
  title:        { type: string|string[], required: false }
  fixed:        { type: number, required: false, note: "固定費 (>0). Pair with variableRate." }
  variableRate: { type: number, required: false, note: "変動費率, 0<v<1. v≥1 has no
                  限界利益 — the structure cannot break even and the lint hard-errors." }
  labels:       { type: object, required: false, note: "term overrides — sales/cost/
                  fixed/bep/loss/profit (default 売上高/総費用/固定費/損益分岐点/損失/利益)" }
  unit:         { type: string, required: false }
capacity: "fixed structure (2 lines + floor + BEP). Terms are short; a numeric
           story (いくらで分岐するか) belongs on a companion chart/table slide."
geometry: "axes carry no ticks; the x-axis spans 1.6×BEP so the crossing sits at
           62.5% — a presentation scale, not a data claim; with data the relation
           f = (1−v)·xBEP is exact"
floor:    "title band gated; line terms are fixed short slots (right edge / left
           floor / under the axis)"
look:     "sales line accent (the protagonist, thicker); cost line muted; fixed
           floor dashed muted; BEP dot + dashed drop accentDeep; 利益 region label
           accentDeep, 損失 muted — native shapes + native text"
```

**Verified (2026-07-08)** — data form (fixed=45, v=0.4) and schematic form both
render clean across all 6 themes (run-gate PASS); the schematic auto-stamps
※模式図 and the data form does not (machine-checked); v=1.2 → CAPACITY;
fixed/variableRate unpaired → WARN (torture-09).

## `positioning` — 2-3 competitive positions + VS (education register)

```yaml
id: positioning
content:
  positions: { type: array, required: true, note: "2-3 of {head, body} — side-by-side positions with VS between (structure word: positioning)" }
  emphasis:  { type: int, required: false, note: "protagonist position (usually 自社): tint + accentDeep head" }
capacity: "2-3 positions (CAPS.positioning); bodies are height-gated per card"
guard: "「無い構造を見せない」: only when the items really are alternative POSITIONS in one market — comparing two things head-to-head is comparison, not positioning"
```

## `system` — ecosystem boxes + labeled arrows (education register)

```yaml
id: system
content:
  nodes: { type: array, required: true, note: "2-5 actors on one row" }
  links: { type: array, required: false, note: "<=6 of {from, to, label} — the LABEL (モノ/カネ/情報) is the point. Adjacent forward links run between the nodes (label above); return/long-range links run in the below lane (label under)" }
capacity: "2-5 nodes, <=6 links (a hairball teaches nothing)"
guard: "arrows are REAL flows (who passes what) — never causality that isn't there"
```

## `relation` — 対応マップ / 分類 (education register)

```yaml
id: relation
content:
  left:  { type: array, required: true, note: "2-4 categories / items" }
  right: { type: array, required: true, note: "2-4 items" }
  links: { type: array, required: true, note: "[leftIdx, rightIdx] pairs (<=8)" }
form: "THE FORM FOLLOWS THE DATA (user-feedback fix — a crossing line-web is
       unreadable): a PARTITION (each right item belongs to exactly ONE left
       item — the common classification case) renders as ZONE GROUPING (each
       category is an enclosing zone, members sit inside it: zero lines, zero
       crossings, Gestalt enclosure). Only a true many-to-many keeps the line
       map, with the right column BARYCENTER-REORDERED to minimize crossings.
       Lines, never arrows — correspondence has no direction."
capacity: "2-4 per side, <=8 links"
```

## Honest residuals

- **Meaning is a visual axis, not a lint.** The floor guarantees no overflow /
  overlap / kinsoku break, but **whether the skeleton fits the logic** (flow vs
  cycle vs matrix) is a human call in deck-strategy + the QA look. A well-drawn but
  *wrong* diagram is worse than text.
- **Element counts are bounded**, not infinite. Over-cap falls back to text/split.
- **Faces are machine-dependent** (soffice substitutes), but the skeleton is native
  shapes = real pixels, so break/overflow/placement QA is reliable off-machine.

## Roadmap

`flow`, `cycle`, `matrix`, `timeline`, `steps`, `branch`, and `formula` are
implemented and verified, and the **conservative classification step**
(deck-strategy deciding *whether* to diagram and *which* skeleton) is in place.
The **enpreth 図解テンプレ adoption sweep (2026-07-05) is complete**: the
`timeline` / `steps` / `branch` / `formula` / `waterfall` skeletons here, the
`card-grid` slide pattern and the chart types (`bar` / `line` / `pie` /
`doughnut` / `band`) in `references/patterns/catalog.md` +
`../principles/chart-design.md` §3. Deliberately **not** adopted, with reasons:

- **hub / radial (放射・逆放射)** — ≤4 spokes is already `branch` (converge /
  diverge); a true 5-6 spoke hub waits until a real deck needs one (add via the
  sanctioned path then).
- **photo / gradient / drop-shadow / wave-background variants** — look-layer
  concerns that belong to themes, and several collide with the AI-tell
  blocklist (house bar §2). Structures were taken; decoration was not.
- **chat / quote** — catalog roadmap candidates (`quote` is already listed);
  add when a deck needs them.

Any future structure is added only through the sanctioned path
(skeleton → builder → floor wiring → catalog → QA → gate).
