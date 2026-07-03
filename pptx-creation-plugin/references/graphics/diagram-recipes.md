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

## Honest residuals

- **Meaning is a visual axis, not a lint.** The floor guarantees no overflow /
  overlap / kinsoku break, but **whether the skeleton fits the logic** (flow vs
  cycle vs matrix) is a human call in deck-strategy + the QA look. A well-drawn but
  *wrong* diagram is worse than text.
- **Element counts are bounded**, not infinite. Over-cap falls back to text/split.
- **Faces are machine-dependent** (soffice substitutes), but the skeleton is native
  shapes = real pixels, so break/overflow/placement QA is reliable off-machine.

## Roadmap

`flow` is implemented. `cycle` (N on a ring) and `matrix` (2×2) are the next two
skeletons in this scope; hierarchy / venn / list / timeline variants are a later
scope, added only when a real deck needs them.
