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
the body, and keep the deck's total dark share (cover + cta + `section`
dividers + any dark statement beats) to **~25–30% at most** — dark marks the
emotional turning points, and it only works while it is scarce.

**Emphasis, peak & markers (visual-psychology layer — see
`references/principles/visual-psychology.md`).** A slide's content may name ONE
protagonist element via `emphasis` (an element index; per-pattern meaning is in
each block below), and a deck may mark ONE body slide `"peak": true` at the
slide level (next to `pattern`/`content`) — the climax that proves the main
message. Treatments reuse existing tokens only: flow/cycle nodes get accent
fill + onDark + ×1.15 (×1.3 on peak); **stat-grid uses the AREA order** —
protagonist card ~1.45x wide, its NUMBER ×1.7 (×1.8 on peak) with the unit
small, others share the remaining width (a pale tint alone demonstrably LOSES
to a longer neighbour — the first A/B proved it); peak `message` gets a
surfaceAccent ground + the stat one step up. The protagonist may additionally
carry ONE `marker` — `circle` (hand-drawn SVG ellipse → transparent 2x PNG,
never crossing the glyph cores), `badge` (native pill + native FACT label,
≤8 chars), or `arrow-note` (native arrow + note, ≤14 chars). design-lint
enforces scarcity and honesty mechanics (dual emphasis specs, out-of-range,
2+ peaks, peak on cover/cta, marker without emphasis, hype words = ERRORs;
RHYTHM = advisory WARN); **saliency-lint** measures the RENDERED pixels after
qa.sh and warns when a bystander out-shines the declared protagonist. Emphasize
only what the data supports (誠実ガード — badge wording factuality is
deck-review's call, not the machine's). All default EMPTY: a plan without them
renders byte-for-byte as before.

**幾何契約 — shape family & connector quality (純幾何・色非依存の床).**
Every shape belongs to ONE family, enforced by `bin/lint/geometry-lint.js` on
the generated pptx XML:

- **Elevation over outline（最重要）**: no shape defines itself with a border.
  Cards and diagram nodes = fill + a refined soft shadow from the elevation
  tokens `layout.elevation.base {blur 10, offset 4, opacity 0.10}` /
  `raised {14, 6, 0.13}` (raised = the emphasized/tinted element, one z-step
  up). Hard or heavy shadows are GEOM-DRIFT. Strokes, where used at all, are
  the single hairline token (`layout.stroke.hairline` 0.75pt, same-family
  light colour) — thick/dark borders are the wireframe tell (OUTLINE-ONLY).
- **One radius**: every roundRect uses `layout.card.radius` (0.10in default);
  pills (chips/badges) use height/2. Off-token radii are GEOM-DRIFT.
- **Connector quality**: connectors are `layout.connector.width` (2.5pt,
  2.25–2.75 band) with FILLED triangle arrowheads; routing is orthogonal
  (bentConnector elbows — no diagonal straight runs; documented exemptions:
  cycle's ring, relation's direction-free correspondence lines). Labels on
  connectors are CHIPS (centered pill, background knockout) — never bare
  glyphs over a stroke. Dashes only when they mean something (戻り・時間差).
- **整列・密度**: row siblings share top edges and equal gutters
  (ALIGN-DRIFT); node interiors keep an inner padding floor of ~0.06in and a
  reasonable ink coverage (DENSITY) — text is COMPOSED into zones
  (value/label/sub, head/body at fixed rhythms), not poured into boxes.
  COLLISION (text-bearing shapes overlapping) is a blocking ERROR.

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

## Pattern: `dialogue`

```yaml
id: dialogue
kind: light
slot: body (education / seminar / marketing register ONLY — financial/board = REGISTER-GATE ERROR)
when_use:    [conversation hooks, ○×の会話比較 (良い例/悪い例), Q&A dramatization]
when_avoid:  [financial/board decks, anything better said as a plain list]
content:
  title/kicker: as usual
  speakers:  { type: speaker[], note: "2-4; PLAIN form — avatars alternate left/right, bubbles HUG their text, tails point at their own avatar" }
  columns:   { type: array[2], note: "COMPARE form — {verdict: good|bad, label, speakers[1-2]}; the ○/× SYMBOL + label carry the meaning (colour is redundant, CUD floor)" }
  mark:      { type: string, note: "※例 — fictional conversations must say so (PERSONA-MARK WARNs)" }
speaker: { quote, role(話者ラベル), side?, avatar?(supplied bust), hair?(in-engine bust variant), symbol?(worry/idea/sweat/question/up/down), recolor? }
principle: "the avatar is NEUTRAL and STATIC (誰が言うかだけ); meaning rides in words + symbols + verdict labels — never in a pose"
capacity: "plain 2-4 speakers; compare 2 columns x 1-2 speakers"
```

## Pattern: `testimonial`

```yaml
id: testimonial
kind: light
slot: body (same register gate as dialogue)
when_use:    [受講者/お客様の声, social proof after a how-to]
when_avoid:  [financial/board decks; real testimonials without user approval + source management (捏造ガード)]
content:
  layout: { type: string, enum: [grid, stack], note: "grid = 2xN cards (default), stack = full-width rows" }
  items:  { type: array, note: "2-6 (stack <=3): {name(話者ラベル), body, avatar?, hair?}" }
  mark:   { type: string, note: "※例 required for samples" }
capacity: "grid 2-6, stack 2-3"
```

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
  marker:      { type: object,   required: false, note: "ONE device on the statBig (the message's protagonist): circle | badge | arrow-note" }
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
  emphasis: { type: int, required: false, note: "protagonist row (0-based): its number circle + head step up to accentDeep. One per slide; unset = all rows equal (unchanged)" }
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
  emphasis: { type: int, required: false, note: "which side carries the accent tint (0=left, 1=right). Default 1 — keep the advocated side RIGHT; use 0 only when the narrative genuinely leads left" }
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
  emphasizeIndex:{ type: int, required: false, note: "the protagonist bar. On column charts this switches to the NATIVE-RECT variant (still native shapes, editable — the pptx chart cannot do per-point styling): the emphasized bar is WIDER (x1.3), accentDeep, with a BOLD larger value label and a bold category label; bystanders accentSoft (CUD-redundant channels: width + weight + colour). Other types keep the recoloured native chart. Negative labels auto-lift when the below slot would hit the category band" }
  chartType:    { type: string, required: false, note: "'column' (default) | 'bar' (horizontal ranking — pass values ASCENDING so the largest lands on top) | 'line' (continuous trend) | 'pie' / 'doughnut' (parts of ONE whole, max 5 slices) | 'band' (帯グラフ, 100% stacked composition — series becomes an ARRAY of 2-4 segments over 1-5 rows). Pick by the reader's question — chart-design.md §2." }
  targetLine:   { type: object, required: false, note: "{value:number, label?:string} — a dashed reference line (前年/目標); state its meaning in the takeaway (column only)" }
  unit:         { type: string, required: false, note: "e.g. 億円 / % — shown ONCE bottom-left (footnote slot), never repeated on every bar" }
  marker:       { type: object, required: false, note: "badge | arrow-note on the takeaway card (no circle); the wording must be a fact the chart supports (過去最高 only when it IS the record)" }
  notes:        { type: string, required: false }
params:
  background:  colors.bg
  chart:       "NATIVE column chart; x m, y 2.2, w 7.4, h 4.4; chartColors [accent] (or per-bar when emphasized); valAxis hidden; data labels outEnd #,##0"
  emphasis:    "emphasizeIndex -> per-bar colours [accentSoft…, accentDeep at index, …]; out-of-range degrades to all-muted (no crash)"
  target_line: "combo bar + dashed LINE at targetLine.value, markers hidden; shares the value axis so 'above/below target' reads at a glance"
  takeaway_card:"x 8.55, w (W-m-8.55), y 2.4, h 3.85; fill surfaceAccent; head(sizes.takeawayHead 19 accentDeep) + body(sizes.body)"
  footer:      brand + page number
chart_default: column (bar). Emphasis / type / target-line / unit are OPTIONAL — omit them all and the chart is byte-for-byte unchanged. See references/principles/chart-design.md.
pie_look: "no rainbow — a monochromatic accent ramp (accentDeep -> line), darkest = emphasized/first slice; percent labels OUTSIDE the wedges in ink; legend bottom; doughnut holeSize 55. Percent labels round to integers — exact figures belong in the takeaway."
band_look: "percentStacked horizontal bars; segments coloured with the DARK ramp (accentDeep/accent/muted/ink) so the white in-segment value labels stay readable; legend bottom. Geometry carries the percentages, labels carry the true values."
value_format: "data labels default to '#,##0;▲#,##0' (decimal variant when needed) — negatives always render ▲, never a minus (house 表記 rule)."
capacity: "column/bar: 4-7 read cleanly; >8 crowds (warn). pie/doughnut: 2-5 slices (hard error past 5 — use a ranked bar). band: 2-4 segments x 1-5 rows (hard errors). line: many points welcome; <4 is thin. takeaway <= ~4 lines at the card width."
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
  emphasis:       { type: integer, required: false, note: "protagonist KPI (0-based) — AREA emphasis: card ~1.45x wide (others share the rest), the NUMBER ×1.7 (×1.8 on peak) with the unit small beside it, accentDeep on tint. Every value is an UNBREAKABLE ATOM (number+unit one word — never 518/億円, never 億/円): overflow resolves by proportional shrink to the readable floor (bystander 0.7x base ≈ 41% of the protagonist glyphs; protagonist 1.6x), then by the CARD re-widening per-card (logged), never by breaking the atom; impossible floors = lint ERROR. Labels fit ONE line by auto-shrink (<=5 chars recommended on slimmed cards)" }
  emphasizeIndex: { type: integer, required: false, note: "LEGACY: equal cells, tint + accentDeep, no jump. Prefer emphasis; never set both (lint ERROR)" }
  marker:         { type: object, required: false, note: "ONE device on the protagonist: {type: circle|badge|arrow-note, text?, image?} — circle rings the number, badge rides the card shoulder, arrow-note sits under the card" }
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
  emphasis: { type: int, required: false, note: "protagonist card (row-major): surfaceAccent tint + accentDeep head" }
  emphasizeIndex: { type: int, required: false, note: "LEGACY alias of emphasis (identical); never set both (lint ERROR)" }
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

## Pattern: `before-after` (education register)

```yaml
id: before-after
kind: light
slot: body
when_use:    [reframing a misunderstanding (誤解→正解), before/after a change of viewpoint]
when_avoid:  [A-vs-B choices (use comparison), anything that is not the SAME thing seen twice]
content:
  kicker: { type: string, required: false }
  title:  { type: string|string[], required: true }
  before: { type: object, required: true, note: "{label, body} — the common misunderstanding (muted panel)" }
  after:  { type: object, required: true, note: "{label, body} — the correction (tinted panel; fixed protagonist)" }
guard: "the reframe must not distort — before/after describe the SAME thing; don't caricature the before (education-register.md §2-2)"
```

`positioning` / `system` / `relation` (the education logical-mode skeletons) are
documented in `references/graphics/diagram-recipes.md`. The `persona` slot
(message / two-column) is documented in the schema + education-register.md §3.

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
