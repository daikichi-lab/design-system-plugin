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
