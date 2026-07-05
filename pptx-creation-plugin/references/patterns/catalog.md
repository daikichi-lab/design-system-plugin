# Slide Pattern Catalog

The plugin has **no fixed full-deck template.** It has this catalog of slide
patterns. `deck-strategy` selects patterns and orders them into a deck plan;
`bin/generate.js` looks each one up by `pattern` name in its registry and draws
it with the project theme.

**The engine (`bin/generate.js`) is the source of truth for every coordinate
and size below.** This file documents the contract so a planner can choose
patterns without reading code. If they ever disagree, the engine wins —
update this file, never fork the numbers.

All geometry is in inches on a 13.333 × 7.5 canvas (16:9). `m` = theme margin
(0.7 in the neutral default). Point sizes are theme `sizes.*` tokens.

---

## Deck plan envelope

A deck plan is the engine's input. Either form is accepted:

```jsonc
// bare array (the contract)
[ { "pattern": "cover", "content": { ... } }, ... ]

// or an object with deck-level meta (preferred — carries footer brand)
{
  "meta": {
    "title":  "string — pptx title metadata",
    "author": "string — pptx author metadata",
    "footerLabel": "string — bottom-left brand on body slides; overrides theme.brand.footerLabel",
    "showPageNumbers": true
  },
  "slides": [ { "pattern": "<id>", "content": { ... } }, ... ]
}
```

Every slide content object may include `"notes": "string"` → speaker notes.
Schema: `schemas/deck_plan.schema.json`.

**Sandwich rule:** open with a dark pattern (`cover`), close with a dark
pattern (`cta`); keep the body light. Don't put two dark slides adjacent in
the body.

**Optional decoration slots (all patterns; empty by default = no change).** Any
slide may carry a code-drawn SVG/PNG (M-7 all code-drawn, M-8 figure-only —
text/numbers/charts stay native), supplied per project like the cover `bg`
(paths in the deck plan point at the project's `assets/`; the plugin holds only
the slot). The engine draws them behind the content:

- `bg` — full-bleed opaque background (cover's hero atmosphere). image-lint
  checks WCAG **scrim contrast** under the text.
- `bgMotif` / `bgPattern` — a decoration motif / faint ground on **any** pattern
  (section, CTA, data pages, not just the cover). Keep the ink in corners/bands;
  image-lint's **motif-intrude** check fails a motif that covers a text zone.
- `stats[].icon` (stat-grid) and `items[].icon` (two-column) — a supporting icon
  (transparent PNG) beside the number, a bystander that never decorates it.
  image-lint's **icon-set** check fails icons that don't share one optical size
  and stroke weight.

A slide with none of these renders byte-for-byte as before (verified: empty-slot
example slide XML is identical). Legibility is the priority — a motif never earns
its place by crowding the words.

---

## Pattern: `cover`

```yaml
id: cover
kind: dark            # sandwich open
slot: opening
when_use:    [first slide of every deck, section of a very long deck opener]
when_avoid:  [body content, anything mid-deck]
content:
  kicker:     { type: string,        required: false, note: "eyebrow; context/audience/duration" }
  titleLines: { type: string[],      required: true,  note: "1-2 lines; hard line breaks; the deck's promise" }
  subtitle:   { type: string,        required: false, note: "one line, supporting" }
  footer:     { type: string,        required: false, note: "org | date" }
  notes:      { type: string,        required: false }
params:
  background: colors.dark
  motif:      "ellipse x9.2 y3.7 w7.2 h7.2 fill darkAlt (off-canvas, bottom-right)"
  kicker_y:   1.55
  title_y:    2.25   ; size sizes.cover (40) ; width 10
  subtitle_y: 4.55   ; size sizes.coverSub (17)
  footer_y:   H-0.85 ; size sizes.footer (12.5)
capacity: "title <= 2 lines of ~11 full-width JP chars; longer overflows — split or shorten"
```

## Pattern: `message`

```yaml
id: message
kind: light
slot: body
when_use:    [the single most important statement, a goal slide, a pivot, one big number]
when_avoid:  [lists, comparisons, anything with >1 idea]
content:
  kicker:      { type: string,   required: false }
  messageLines:{ type: string[], required: true,  note: "1-2 lines, centered statement" }
  statBig:     { type: string,   required: false, note: "one big number/figure, e.g. 約60%" }
  statCaption: { type: string,   required: false, note: "what the number means + honesty caveat" }
  notes:       { type: string,   required: false }
params:
  background:   colors.bg
  kicker_y:     m
  message_y:    1.95 ; size sizes.message (32) ; centered
  stat_y:       3.95 ; size sizes.stat (62) ; color accent ; centered
  caption_y:    5.2  ; size sizes.small (13) ; muted ; centered
  footer:       brand + page number
capacity: "messageLines <= 2 lines; statBig is short (<= ~6 chars). This is a breathing-room slide — do not crowd."
```

## Pattern: `two-column`

```yaml
id: two-column
kind: light
slot: body
when_use:    [overview-on-left + 2-4 supporting points on right, "the big picture + the parts"]
when_avoid:  [head-to-head A vs B (use comparison), >4 points (use stat-grid later or split)]
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: true, note: "conclusion/question; left half, width 7.0" }
  lead:   { type: string, required: false, note: "left paragraph, the overview" }
  items:  { type: array,  required: true,  note: "numbered rows on the right; each {n:int, head:string, body:string}" }
  notes:  { type: string, required: false }
params:
  background: colors.bg
  title_y:    1.15
  lead_box:   "x m, y 2.5, w 5.2, h 3.6 (muted body)"
  rows:       "x 6.45, top 2.45, gap 1.42 per item; numCircle + head(sizes.head 18) + body(sizes.small 13)"
  footer:     brand + page number
capacity: "items: 3 ideal, 4 max (gap 1.42 -> 4th lands near the footer). lead ~ 4 lines at w5.2. head ~1 line; body ~2 lines."
```

## Pattern: `comparison`

```yaml
id: comparison
kind: light
slot: body
when_use:    [two things head-to-head; A vs B; before/after; old way vs new way]
when_avoid:  [3+ things, a single concept, a process]
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: true }
  left:   { type: object, required: true, note: "{label, role, points:string[]} — neutral card" }
  right:  { type: object, required: true, note: "{label, role, points:string[]} — accent-emphasized card" }
  notes:  { type: string, required: false }
params:
  background: colors.bg
  cards:      "top 2.45, h 4.05, gap 0.5; two equal cards; left fill surface, right fill surfaceAccent"
  per_card:   "label(sizes.compareLabel 22; right uses accentDeep), role(sizes.small), bullets(sizes.body 15, native bullet:true)"
  footer:     brand + page number
emphasis: "Put the side you're advocating on the RIGHT (accent-tinted). Emphasis is tint+shadow, never a stripe."
capacity: "points: 4 ideal, 5 max per card. labels short (<= ~8 JP chars)."
```

## Pattern: `chart`

```yaml
id: chart
kind: light
slot: body
when_use:    [a trend or magnitude that a number makes obvious; one chart + one takeaway]
when_avoid:  [more than one chart on a slide, data with no point]
content:
  kicker:       { type: string, required: false }
  title:        { type: string|string[], required: true, note: "the takeaway as a sentence; width 8.5" }
  series:       { type: object, required: true, note: "{name:string, labels:string[], values:number[]}" }
  takeawayHead: { type: string, required: true, note: "short arrow phrase, e.g. 早期把握 → 早期対応" }
  takeaway:     { type: string, required: true, note: "1-3 sentences: what to conclude / do" }
  emphasizeIndex:{ type: int, required: false, note: "colour ONE bar (accentDeep), mute the rest (accentSoft) — steer the eye to the point; labels stay on every bar" }
  chartType:    { type: string, required: false, note: "'line' for a continuous trend; default column (bar)" }
  targetLine:   { type: object, required: false, note: "{value:number, label?:string} — a dashed reference line (前年/目標); state its meaning in the takeaway" }
  unit:         { type: string, required: false, note: "e.g. 億円 / % — shown ONCE top-left, never repeated on every bar" }
  notes:        { type: string, required: false }
params:
  background:  colors.bg
  chart:       "NATIVE column chart; x m, y 2.2, w 7.4, h 4.4; chartColors [accent] (or per-bar when emphasized); valAxis hidden; data labels outEnd #,##0"
  emphasis:    "emphasizeIndex -> per-bar colours [accentSoft…, accentDeep at index, …]; out-of-range degrades to all-muted (no crash)"
  target_line: "combo bar + dashed LINE at targetLine.value, markers hidden; shares the value axis so 'above/below target' reads at a glance"
  takeaway_card:"x 8.55, w (W-m-8.55), y 2.4, h 3.85; fill surfaceAccent; head(sizes.takeawayHead 19 accentDeep) + body(sizes.body)"
  footer:      brand + page number
chart_default: column (bar). Emphasis / line / target-line / unit are OPTIONAL — omit them all and the chart is byte-for-byte unchanged. See references/principles/chart-design.md.
capacity: "labels/values: 4-7 bars read cleanly (sample uses 6); >8 crowds. takeaway <= ~4 lines at the card width."
```

## Pattern: `cta`

```yaml
id: cta
kind: dark            # sandwich close
slot: closing
when_use:    [the final slide; one clear next action + contact]
when_avoid:  [mid-deck, multiple competing asks]
content:
  kicker:     { type: string, required: false }
  titleLines: { type: string[], required: true, note: "1-2 lines; the ask as a question/invitation" }
  offerHead:  { type: string, required: true,  note: "the concrete offer, e.g. 個別相談（無料・30分）" }
  offerBody:  { type: string, required: true,  note: "what they get; reassurance (e.g. no hard sell)" }
  contact:    { type: string, required: false, note: "how to act: form / email" }
  notes:      { type: string, required: false }
params:
  background:  colors.dark
  motif:       "ellipse x-2.6 y-2.6 w6.4 h6.4 darkAlt (off-canvas, top-left; mirrors cover)"
  kicker_y:    1.5
  title_y:     2.15 ; size sizes.message (32) ; width 11
  offer_panel: "accent roundRect x m, y 4.25, w 8.7, h 1.85; head(sizes.offerHead 21 onDark) + body(sizes.small onAccentMuted)"
  contact_y:   H-0.78
rule: "Exactly ONE action. The accent panel is the CTA, not decoration."
capacity: "title <= 2 lines; offerBody <= ~2 lines at w7.7."
```

## Pattern: `section`

```yaml
id: section
kind: dark            # a divider is a mini-cover; dark in the body is allowed ONLY for dividers
slot: divider
when_use:    [marking a new chapter in a longer deck (8+ slides), "we've covered X, now Y"]
when_avoid:  [short decks (<8 slides), as filler, two dividers back-to-back]
content:
  index:    { type: string, required: false, note: "chapter number as a string, e.g. '01' — becomes the watermark motif" }
  kicker:   { type: string, required: false }
  title:    { type: string|string[], required: true, note: "the chapter name" }
  subtitle: { type: string, required: false, note: "one line on what this chapter covers" }
  notes:    { type: string, required: false }
params:
  background: colors.dark
  motif:      "large faint index number, fill darkAlt, right side (x8.4 y1.2 right-aligned), size sizes.sectionIndex (150)"
  kicker_y:   2.95
  title_y:    3.5  ; size sizes.sectionTitle (36) ; width 8.0 ; onDark
  subtitle_y: 4.85 ; size sizes.coverSub ; onDarkMuted
capacity: "title <= 1 line (~14 JP chars at width 8.0). The index is the motif — keep it 1-2 chars."
```

## Pattern: `stat-grid`

```yaml
id: stat-grid
kind: light
slot: body
when_use:    [a row of 2-4 KPIs / headline numbers, an executive summary of metrics]
when_avoid:  [a single number (use message), prose, >4 metrics]
content:
  kicker:         { type: string, required: false }
  title:          { type: string|string[], required: true }
  stats:          { type: array,  required: true, note: "2-4 of {value:string, label:string, sub?:string}" }
  emphasizeIndex: { type: integer, required: false, note: "0-based index of the card to accent-tint (the headline KPI)" }
  notes:          { type: string, required: false }
params:
  background: colors.bg
  cards:      "top 2.7, h 3.45, gap 0.4; n auto-width across (W - 2m); emphasized card fill surfaceAccent, others surface"
  per_card:   "value(sizes.statCard 40; accent, accentDeep if emphasized) + label(sizes.head) + sub(sizes.small, muted)"
  footer:     brand + page number
capacity: "stats: 3 ideal, 4 max, 2 min. value short (a number+unit, e.g. 48.2億円 / 8.4%); put the prior-period comparison in sub."
```

## Pattern: `table`

```yaml
id: table
kind: light
slot: body
when_use:    [precise figures across rows & columns; segment P&L, feature/plan comparison, schedules]
when_avoid:  [a trend (use chart), 2-way head-to-head prose (use comparison), data with no structure]
content:
  kicker:   { type: string, required: false }
  title:    { type: string|string[], required: true }
  columns:  { type: string[], required: true, note: "header cells" }
  rows:     { type: array,    required: true, note: "array of row arrays; each cell a string/number" }
  colAlign: { type: string[], required: false, note: "per-column 'left'|'right'; default auto (numeric columns right-align)" }
  colW:     { type: number[], required: false, note: "per-column widths (inches); default auto-even" }
  note:     { type: string,   required: false, note: "units / basis / assumptions — IMPORTANT for financial decks (house bar §4)" }
  notes:    { type: string,   required: false }
params:
  background: colors.bg
  table:      "NATIVE editable table; x m, y 2.25, w (W - 2m); rowH min(0.62, 3.9/nRows); border 0.5pt line color"
  header:     "fill accent, text onDark bold"
  body:       "alternating fill bg / surface; numeric columns auto right-aligned; font sizes.body"
  note_y:     6.62 ; size sizes.cap ; faint
  footer:     brand + page number
rule: "Borders are FUNCTIONAL hairlines, not decoration — this is not an AI-tell stripe. Always add `note` with units/basis for figures."
capacity: "<= 6 rows incl. header read cleanly; <= 5 columns. More rows -> split, or it gets cramped (autoPage is off by design)."
```

---

## Pattern: `card-grid`

4–6 head+body cards in a two-row grid (2×2 / 3+2 / 2×3) — the TEXT sibling of
`stat-grid`. Six BS 勘定科目 cards, five 警戒シグナル, four 事業特性: each cell is
a **term plus one short explanation**, not a headline number.

```yaml
id: card-grid
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: false }
  cards:  { type: array, required: true, note: "4-6 of {head, body?}; head is a short
            TERM (one line — a wrapping head is a hard OVERFLOW), body <= 3 lines" }
  emphasizeIndex: { type: int, required: false, note: "tint one card (row-major)" }
layout:
  grid:  "cols = ceil(n/2); two rows from y 2.45, cardH 1.825, gaps 0.4/0.3"
  card:  "surface fill (+ shadow per theme.layout.card); emphasis = surfaceAccent
          tint + accentDeep head — never a stripe"
floor: "head band and body box are height-gated per card; labels baked (kinsoku)"
capacity: "4-6 cards. <4 -> two-column / stat-grid; >6 -> split into two slides.
           Numbers-first content belongs in stat-grid, not here."
```

**Verified (2026-07-05):** n=6 (2×3, emphasized card) / n=5 (3+2) / n=4 (2×2)
render clean; n=3 / n=7 → CAPACITY; a 2-line head → OVERFLOW 168%; a 4-line body
→ OVERFLOW 104%; run-gate PASS across all 6 themes.

## Choosing & sequencing (for `deck-strategy`)

1. Always `cover` first, `cta` last (sandwich).
2. Map each body beat to the pattern whose *job* matches the beat:
   - one idea / one number → `message`
   - overview + parts → `two-column`
   - A vs B → `comparison`
   - trend/magnitude → `chart`
3. Vary patterns; don't repeat the same one 3× in a row.
4. Respect each pattern's `capacity`. If content exceeds it, **split into two
   slides** — never shrink past the bar to cram.
5. 6–14 slides is the healthy range for most decks.

## Roadmap (not yet implemented — add to engine + this file together)

`process` (numbered horizontal steps) · `quote` (pull-quote / testimonial).
When adding one: implement the builder in `bin/generate.js`, register it, add a
recipe block here, render an example, and pass the QA loop before documenting it
as available.

(`section`, `stat-grid`, and `table` were on this roadmap and are now
implemented — see their blocks above and `examples/financial-analysis/`.
`timeline` is implemented as a **diagram skeleton** — see
`references/graphics/diagram-recipes.md`, alongside `flow` / `cycle` / `matrix`.)
