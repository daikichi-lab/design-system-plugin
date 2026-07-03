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
geometry: "nodes evenly spaced; width auto-computed from n; horizontal row, with a
           vertical-stack fallback when nodes would get too narrow"
capacity: "3-6 steps (CAPS.flow). <3 -> use text/two-column; >6 -> split or a list."
floor:    "each node label is baked (kinsoku) and height-gated; overflow = ERROR"
look:     "node fill surface + accent border, corner radius from theme.layout.card"
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
  emphasizeIndex: { type: int, required: false, note: "tint one quadrant (0=TL,1=TR,2=BL,3=BR)" }
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

## Honest residuals

- **Meaning is a visual axis, not a lint.** The floor guarantees no overflow /
  overlap / kinsoku break, but **whether the skeleton fits the logic** (flow vs
  cycle vs matrix) is a human call in deck-strategy + the QA look. A well-drawn but
  *wrong* diagram is worse than text.
- **Element counts are bounded**, not infinite. Over-cap falls back to text/split.
- **Faces are machine-dependent** (soffice substitutes), but the skeleton is native
  shapes = real pixels, so break/overflow/placement QA is reliable off-machine.

## Roadmap

`flow`, `cycle`, and `matrix` — the three base structures in this scope — are all
implemented and verified. The **conservative classification step** (deck-strategy
deciding *whether* to diagram and *which* skeleton) is the next stage. Hierarchy /
venn / list / timeline variants are a later scope, added only when a real deck
needs them.
