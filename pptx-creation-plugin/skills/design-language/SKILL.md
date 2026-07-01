---
name: design-language
description: Use when starting a deck to pick ONE design language from the bookshelf (neutral-business / swiss / editorial / minimal / data-driven / wa-modern / hybrid-editorial) by audience + usecase, and wire its theme (+ optional image slots). deck-strategy calls this before choosing patterns; create-deck uses the chosen theme.
---

# design-language

The plugin has **no single house style** — it has a **bookshelf** of design
languages (spec §4-2). Each = 〈prose principles (`references/design-languages/*.md`)
＋ tokens (a `themes/<name>/theme.json`) ＋ layout intent〉, and each was
shelved only after passing the §6 gates (design-lint / typo-lint / image-lint).
Your job: pick **one** for the deck, up front, and hand its theme to `create-deck`.

## 1. Pick by audience + usecase (one language, whole deck)

| Language | Reach for it when… | Theme |
|---|---|---|
| **neutral-business** | board packs, lenders, quiet trustworthy default | `themes/_default-neutral` |
| **swiss** | consultancy / strategy / product, rigorous + modern | `themes/swiss` |
| **editorial** | brand / vision / thought-leadership, warm, serif | `themes/editorial` |
| **minimal** | one-idea executive summaries, luxury/quiet | `themes/minimal` |
| **data-driven** | monthly/quarterly readouts, KPI/table-heavy | `themes/data-driven` |
| **wa-modern** | Japanese corporate/brand with 和 sensibility | `themes/wa-modern` |
| **hybrid-editorial** | marketing/seminar/pitch that wants an atmosphere image | any theme + `bg` slots |

Read that language's `references/design-languages/<name>.md` before you plan — it
sets the palette, type, whitespace, and the "avoid for" cases. **Don't mix
languages in one deck.** If two fit, pick the one the *audience* expects: a bank
wants `neutral-business`/`data-driven`, not `editorial`.

## 2. Wire it

- Pass the chosen `--theme themes/<name>/theme.json` to `create-deck` /
  `bin/build.sh`. Tokens (colour/type/leading/margin) drive **both** the native
  layer and any SVG graphics, so nothing drifts.
- **Image slots are opt-in** (hybrid-editorial, spec §7): leave `bg` empty for an
  image-0 deck (board decks), or fill it with a code-drawn `atmosphere` for
  marketing. A filled slot must pass **image-lint** (scrim/contrast/weight).
- A project may copy a shelf theme into its own repo and adjust brand colours —
  themes are per-project (M-6); the shelf entry is a starting point, not a lock.

## 3. Boundaries

- Languages differ today by **tokens + principles** (palette / type / whitespace /
  font), sharing the engine's geometry. Deep per-language layout overrides
  (asymmetry, alternate grids) are future engine work — don't fake them by hand.
- Adding a language: new `themes/<name>/theme.json` + `references/design-languages/
  <name>.md`, then it must **pass the gate runner** (`tests/run-gate.sh`) and a
  render-and-look on a representative deck before it goes on the shelf (M-10).
- The floor still governs every language: Phase A type, Phase B kinsoku, the
  AI-tell blocklist (`house-quality-bar.md` §2). An accent is a dot/kicker/tint,
  never a stripe or band — in any language.

## See also
- [`../../references/design-languages/`](../../references/design-languages/) — the bookshelf prose.
- [`../deck-strategy/SKILL.md`](../deck-strategy/SKILL.md) — calls this, then picks patterns.
- [`../../references/principles/hybrid-architecture.md`](../../references/principles/hybrid-architecture.md) — the 3-layer philosophy (§4-2 bookshelf).
