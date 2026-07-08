# Whitespace, Spacing Grid & Density Budget

`house-quality-bar.md` §1.7 sets the margin rule and §6 scores density. This
file is the **reasoning and the numbers behind them** — how to space a slide so
blocks share a rhythm, why whitespace is content and not slack, and how the
density budget forces a split instead of a cram. It restates nothing from the
bar; it points at it.

> Whitespace is not the space left over after the content. It is the space that
> tells the eye where to look. A slide that fills every inch has decided nothing.

Two things enforce the rules below **mechanically** — the *design-lint* checks:
the schema-validated margin token and the engine's fixed geometry (over-budget
content overflows visibly in QA). Everything else — active whitespace, vertical
rhythm feel, "is this the right density" — is **judged by the reviewer**
(`deck-review`). Each section says which.

---

## 1. One margin, one gap — for the whole deck (LINT)

Non-negotiable #7 in `house-quality-bar.md`: pick **one outer margin and one
inner gap** and hold them across every slide. This is the frame the whole deck
sits inside, and a frame that moves reads as sloppy.

- **House default: outer 0.75", inner gap 0.5".** (The neutral theme uses
  `canvas.margin` 0.75 as of the typography-floor pass; 0.7 remains fine.) Use
  `0.3"` only for a genuinely dense deck (a data-heavy internal readout), never
  as a default to win back space you shouldn't be spending.
- **Edge margin < 0.5" reads as "too tight"** and trips #7. Below that the
  content looks like it's escaping the slide.
- The margin is **one theme token** (`canvas.margin`, `T.m` in the engine), not
  a per-slide choice — the same reason fonts and sizes are tokens (§1.9). Change
  it once in `theme.json` and the whole deck re-frames.

**Lint, not taste.** `schemas/theme.schema.json` bounds the margin token (0.3 or
0.5+); the engine draws every block off `T.m`. A margin outside the range fails
validation; an edge that reads tight surfaces in the §5 QA loop under
`margin`-type findings.

## 2. Spacing is a small modular set, not arbitrary values (LINT)

Gaps between blocks come from a **short, shared set** — the same handful of
values reused — so every block on every slide sits on one rhythm. Arbitrary
one-off gaps (0.37" here, 0.44" there) are the spacing equivalent of a per-textbox
font override: they read as assembled, not designed.

- The set is small and roughly doubling: the inner gap (0.5"), the row/block
  gaps the patterns already use (the `two-column` 1.42" row pitch, the
  `comparison` / `stat-grid` 0.4–0.5" card gap), and the outer margin. New
  spacing snaps to that set — it does not invent a value.
- You do **not** hand-set these. Every coordinate lives in `bin/generate.js`
  (`../patterns/catalog.md` documents them per pattern); the modular set *is*
  those numbers. Tuning spacing means editing the token/engine, never nudging a
  textbox in the output (and never hand-editing the `.pptx` — it's a ZIP).

**Lint.** Because the engine owns every gap, the rhythm is enforced by
construction — you cannot emit an off-grid gap through the plan. Drift only
appears if someone hand-edits output; that's out of the sanctioned path.

## 3. Active whitespace — it creates focus, it is not empty (REVIEWER)

Whitespace is a **design element with a job**: it isolates the one thing that
matters so the eye lands there first. Empty space around a single statement is
not wasted — the emptiness *is* the emphasis. This is why the AI-tell blocklist
(`house-quality-bar.md` §2) bans banners, bands, and ribbons: they fill the quiet
space that was doing the work.

- The **breathing-room patterns stay sparse.** `message` and `cover` are *meant*
  to be mostly empty around one focal object (the centered statement, the big
  `stat`, the promise). Adding a second idea, a decorative shape, or a filler
  line to "balance" them destroys the pattern — the space was the point. Their
  `capacity` lines (`../patterns/catalog.md`) cap them low on purpose.
- Do not treat a sparse slide as a bug to fix. A `message` slide with room to
  breathe is correct; the wrong-empty is the opposite failure — a *body* slide
  with three words and no visual (§6 of `slide-design-principles.md`), which
  wastes attention rather than directing it.

**Reviewer judgment.** Lint cannot tell "purposeful quiet" from "unfinished."
`deck-review` reads it under Information design (`house-quality-bar.md` §6):
density right — neither crammed nor empty.

## 4. Density budget — each pattern has a capacity; SPLIT, never shrink (LINT + REVIEWER)

This is §6 of `slide-design-principles.md` stated as a budget: **every pattern
has a fixed capacity** (`../patterns/catalog.md`), and it is a **hard ceiling**.
When content exceeds it, the only move is to **split into a second slide** — never
shrink the type, tighten the margin, or cram past the bar. Shrinking type breaks
the size-contrast rule (§1.6); tightening the margin breaks #1 above; cramming
produces overflow and overlap, the two most common QA failures (#10).

Rule-of-thumb for **"too dense"** (the ceiling is the catalog's `capacity`; these
are the eyeball triggers to split *before* you generate):

- a **body / takeaway card past ~4–6 lines** at its width → split or shorten
  (`comparison` 4 ideal / 5 max points; `chart` takeaway ≤ ~4 lines).
- a **table past ~6 rows** (incl. header) or > 5 columns → split; the `table`
  pattern has autoPage off by design, so a 7th row crowds.
- a **`two-column` past 4 items**, a **`stat-grid` past 4 stats**, a **chart past
  ~8 bars** → over budget; split or aggregate (top N + その他).

**Lint half.** Capacity is enforced by the engine's *fixed* geometry: a 5th
`two-column` row lands on the footer, a 6th `comparison` bullet overflows the
card — the break is visible in the §5 QA render, not silent. That render is what
gates the deck: any unresolved overflow/overlap caps it below 80
(`house-quality-bar.md` §6). **Reviewer half.** Whether content that *fits*
should still have been split (setup + payoff on one slide = two ideas = two
slides) is a judgment call `deck-review` makes under Information design.

## 5. Vertical rhythm — the five fixed bands (REVIEWER)

Think of every light body slide as **five horizontal bands**, top to bottom:

1. **Kicker band** — the eyebrow label, always at the same height.
2. **Title band** — the message, always at the same height.
3. **Content band** — the ONLY band that varies slide to slide.
4. **Closing-line band** — the one-line takeaway/結び, when a pattern carries
   one, lands at a consistent height near the bottom.
5. **Footer band** — brand + page number, fixed.

Because four of the five bands never move, paging through the deck the screen
does not "shake" — a viewer registers a title that shifts by even ~2mm between
slides as unconscious unease, without being able to say why. This is the
vertical half of the coordinate grammar (`slide-design-principles.md` §8). The
engine already fixes these (kicker sits above the title at a set offset, the
title-to-body gap is uniform within a light body slide, the footer is a shared
helper); the patterns inherit the same rhythm because they share the same
tokens and coordinates (`../patterns/catalog.md`). Horizontally the same
economy applies: a pattern decides only its outer margin and gap — element
*widths* are derived (`width = (W − 2·margin − (n−1)·gap) ÷ n`), so the fewer
free variables a layout has, the less it can drift between slides.

- Don't fight the built-in rhythm by stuffing an extra line into a kicker or
  pushing a title down to "center" it — that desyncs this slide from the deck.
- The rhythm is part of why a theme swap restyles cleanly: content changes, the
  vertical beat does not.

**Reviewer judgment.** Uneven block gaps are a §5 QA check (`margin` /
alignment findings) and feed Visual integrity (`house-quality-bar.md` §6); the
lint can't score "does this beat feel steady," so the reviewer looks.

---

## See also

- `house-quality-bar.md` — the hard rules this doc reasons behind: §1.7 (one
  margin), §2 (the AI-tell blocklist — bands/banners that eat whitespace), §5
  (the QA loop that surfaces margin/overflow breaks), §6 (the density scoring).
- `slide-design-principles.md` — §6 (density: split, never cram) and §7 (every
  slide carries a visual, empty ≠ done), which this doc turns into a budget.
- `../patterns/catalog.md` — the per-pattern `capacity` numbers that *are* the
  density budget, and the coordinates that *are* the spacing grid.
