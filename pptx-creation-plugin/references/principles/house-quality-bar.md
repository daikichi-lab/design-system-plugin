# House Quality Bar

The non-negotiable standard every deck this plugin produces must meet. The
`deck-review` skill scores against the rubric at the bottom; `create-deck`
must pass the QA loop before reporting done. The reference render that defines
"acceptable" is `examples/seminar-kanrikaikei/` — no new deck may look worse
than that.

> A deck is not decoration. It is a tool for understanding, deciding, and
> acting. Every rule below serves that, not aesthetics for their own sake.

---

## 1. Non-negotiables (a deck that violates any of these fails review)

1. **One message per slide.** The title states that message — a **conclusion**
   or a **question**, never a topic label ("売上について" is a label; "売上は
   3か月連続で改善している" is a message).
2. **Audience → scene → goal-action fixed first.** Logic and message are
   decided before layout. (This is `deck-strategy`'s job; `create-deck`
   inherits it via the deck plan.)
3. **Every slide carries a visual element** — chart, diagram, icon, number
   cut, card, or number-circle. No wall-of-text slides.
4. **Sandwich structure.** Cover and closing are dark; body slides are light.
   Dark carves emotion, light carries information — so dark stays scarce:
   **≤ ~25–30% of the deck**, never two adjacent in the body (dividers and
   dark statement beats included). All-dark = no emphasis at all.
5. **One dominant color (60–70%) + one restrained accent.** Colors are never
   laid out as equals. The accent is a single sharp hue.
6. **Body text left-aligned.** Only titles may center. Size contrast between
   title and body must be obvious.
7. **Uniform margins.** Pick one outer margin and one inner gap for the whole
   deck (house default 0.7"/0.5"; 0.3" acceptable for dense). Edge margin
   < 0.5" reads as "too tight."
8. **Charts are native** (PowerPoint-editable), never rasterized to an image.
9. **Japanese fonts are managed as one token** (`theme.font.family`, default
   `Meiryo`). No per-textbox font overrides.
10. **No text overflow, no overlap.** The most common defect; caught by the QA
    loop, not by hope.

## 2. The AI-tell blocklist (instant "this was auto-generated" — never ship)

These are forbidden. Their absence is a large part of why the reference deck
looks clean:

- ❌ Vertical color bands / side ribbons down a slide edge.
- ❌ Decorative full-width banners behind titles.
- ❌ Title underlines or rules under headings.
- ❌ Thin colored stripes on a card edge ("accent border" tabs).
- ❌ Rainbow palettes where 4+ colors compete equally.
- ❌ Drop-shadowed text, bevels, gradients-as-decoration, clip-art.
- ❌ Center-aligned body paragraphs.
- ❌ Emoji as iconography in a business deck.

**To make a card stand out, use a soft tint fill or a soft shadow — not a
stripe.** (See the `comparison` and `chart` patterns: the emphasized card is
`surfaceAccent`-tinted, never striped.)

## 3. Motif & depth

- Depth comes from **large, soft, partly off-canvas shapes** (the cover/CTA
  oval), tinted cards, and restrained shadow — never from lines or bands.
- Reuse one motif across the deck so it feels designed, not assembled.

## 4. Content integrity (especially financial / external decks)

- External-facing decks must read as **trustworthy, clear, and honest**.
- Financial decks **must not omit** assumptions, metric definitions, or
  misreading guards. Label estimates as estimates. **No unsupported
  assertions** ("約60%（イメージ）" is honest; "60%が失敗する" stated as fact is not).
- Numbers on a chart need a unit and, where relevant, a basis/period.
- **Numbers must reconcile — even dummy ones.** An illustrative mini-P/L, a
  収入→税→手取 flow, a set of deltas: the internal arithmetic must check out
  (合計が合う・縦計算が通る) even when the figures are labeled イメージ. A
  spot-checkable inconsistency on a "you don't need to read this" slide is the
  fastest way to lose the room. Chart geometry is part of the same promise:
  bar lengths / areas exactly proportional to values — never lengthened for
  effect (see `chart-design.md`).

---

## 5. The mandatory QA loop (every generation, no exceptions)

Generating a `.pptx` is **not** "done." Always:

1. Render to images: `bash bin/qa.sh <deck.pptx>` (PPTX → PDF → JPG).
2. **Open every image and look.** Best with a fresh perspective (a sub-agent),
   because right after generating you see what you *expect*, not what's there.
   Check, most-frequent-first:
   - text overflowing its box ← **top failure mode**
   - overlapping elements (text through shapes, lines through glyphs)
   - edge margin < 0.5"; uneven block gaps
   - low text/background contrast
   - misaligned columns / cards
   - **any AI-tell from §2 sneaking in**
   - leftover placeholders (`lorem|ipsum|TODO|[insert`)
3. Fix → regenerate the affected slide → re-check.
4. **Stop when clean.** The first render almost always has a few breaks; fix
   those. Do not chase sub-pixel perfection or loop forever.
5. If a break **cannot** be cleanly fixed (overflow that won't fit, a chart
   that won't size), **STOP and report with the screenshot** — do not ship a
   compromised slide (M-4).

---

## 6. Scoring rubric (deck-review)

100 points across five dimensions. See `schemas/deck_review.schema.json` for
the machine-readable shape `deck-review` must emit.

| Dimension | Pts | What earns the points |
|---|---|---|
| **Message & logic** | 25 | 1 slide/1 message; titles are conclusions/questions; a coherent narrative frame (SCQA/PREP/PAS/BAB); the goal-action is clear. |
| **Visual integrity** | 25 | No overflow/overlap; uniform margins; alignment; contrast; **no AI-tells**. Driven by the §5 QA result. |
| **Design system fidelity** | 20 | One dominant + one accent; sandwich; tokenized type/colors; consistent motif; matches the theme. |
| **Information design** | 20 | Every slide has a visual; charts are native, correctly chosen, and labeled; density is right (not crammed, not empty). |
| **Content integrity** | 10 | Honest claims; assumptions/definitions present where needed; no unsupported assertions; audience-appropriate tone. |

**Bands:** **< 80** → return with concrete fixes (do not ship). **80–89** →
acceptable internally; list improvements. **≥ 90** → cleared for external
delivery. **Any unresolved §5 visual break caps the deck below 80** regardless
of other scores.
