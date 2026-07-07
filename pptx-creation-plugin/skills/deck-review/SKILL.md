---
name: deck-review
description: Use to score a generated deck against the house quality bar. Runs/incorporates the visual QA (render + per-slide inspection), scores five dimensions out of 100, and returns a deck_review JSON with bands (<80 reject, 80-89 internal, >=90 external) plus prioritized fixes.
---

# deck-review

You are the gate before a deck ships. You take a generated `.pptx` and answer
one question with evidence: **is this good enough, and if not, exactly what to
fix?** Scoring is not a vibe — it is the rubric in
[`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md)
applied slide by slide. The reference render that defines "acceptable" is
`examples/seminar-kanrikaikei/`; nothing scores `external` if it looks worse
than that.

## Inputs

- **Required:** the generated `.pptx` to review.
- **Optional but recommended:** its deck plan (`deck_plan.json`) and the
  project theme (`theme.json`). The plan lets you check message/logic and
  pattern fit; the theme lets you check design fidelity (dominant + accent,
  sandwich, tokens). Without them, score what you can see and say so in the
  relevant `notes`.

You **do not** edit or regenerate the deck. That is `create-deck`'s job. You
observe, score, and hand back concrete fixes.

## 1. Run the visual QA loop first (it is not optional)

The visual QA result drives `visualIntegrity` and can force the whole verdict.
Either **consume the QA result `create-deck` already produced**, or run the
mandatory loop yourself — see §5 of
[`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md):

1. Render to images: `bash bin/qa.sh <deck.pptx>` (PPTX → PDF → JPG).
2. **Open every image and look** — best with a fresh perspective, because right
   after generation you see what you expect, not what is there. Check,
   most-frequent-first:
   - text overflowing its box ← **top failure mode**
   - overlapping elements (text through shapes, lines through glyphs)
   - edge margin < 0.5"; uneven block gaps
   - low text/background contrast
   - misaligned columns / cards
   - **any AI-tell from §2** of the house quality bar sneaking in
   - leftover placeholders (`lorem|ipsum|TODO|[insert`)

Record what you saw, per slide, in `visualQa.slides[]`. A clean slide is an
empty `issues` array. Mark `ran: true` only if you actually rendered and looked.

> **An unresolved §5 visual break forces `reject`.** If any `visualQa` issue is
> still open (a `blocker`/`major` with `resolved: false`), `visualIntegrity`
> cannot earn full marks and the deck **caps below 80** — band `reject` —
> regardless of how strong the other four dimensions are. This mirrors M-4:
> never ship a compromised slide; stop and report it instead.

## 2. Score the five dimensions

100 points across five dimensions, exactly as the rubric in §6 of the house
quality bar defines them. Each dimension is a `scored` object
(`{score, max, notes}`) and **`notes` must cite slide numbers as evidence** —
"slide 5 title 『売上について』 is a topic label, not a conclusion," not "logic
could be tighter."

| Dimension (JSON key) | Max | What earns the points |
|---|---|---|
| `messageLogic` | 25 | 1 slide / 1 message; titles are conclusions or questions (not topic labels); a coherent narrative frame (SCQA/PREP/PAS/BAB); the goal-action is clear. |
| `visualIntegrity` | 25 | No overflow/overlap; uniform margins; alignment; contrast; **no AI-tells**. Driven directly by the §5 QA result above. |
| `designFidelity` | 20 | One dominant color (60–70%) + one restrained accent; sandwich (dark cover/cta, light body); tokenized type/colors; consistent motif; matches the theme. Emphasis stays scarce: one protagonist per slide, one `peak` per deck (a deck where everything shouts scores low here). |
| `informationDesign` | 20 | Every slide carries a visual; charts are native and correctly chosen + labeled (unit/basis); density is right — not crammed, not empty. The declared protagonist (`emphasis`) actually reads first — heed design-lint's SALIENCY/RHYTHM warnings, then judge by eye. |
| `contentIntegrity` | 10 | Honest claims; assumptions/metric definitions present where needed; no unsupported assertions; audience-appropriate tone. |

> **重点確認 — emphasized claims & marker wording (機械では判定できない).** For
> EVERY element the plan emphasizes (`emphasis`, a chart's `emphasizeIndex`),
> every `marker`, and the `peak` slide, verify against the plan's `notes`/data:
> **does the data actually support giving this number/claim the spotlight?**
> Badge/arrow-note text especially: 「過去最高」 only when it IS the record,
> 「初」 only when it IS the first, 「3期連続」 only when the three periods
> check out — the lint blocks hype adjectives, but factuality is YOURS.
> Emphasizing a forecast or estimate as if it were an actual, enlarging only
> the flattering figure, or loss-aversion scare framing is a `contentIntegrity`
> failure (house-quality-bar §4; visual-psychology.md §7) — score it down and
> write the finding even when the slide renders beautifully. Financial/factual
> decks: strictest. A saliency-lint WARN that exists BECAUSE honesty forbids
> emphasizing the biggest number (e.g. a forecast bar taller than the
> emphasized actual) is a deliberate override — check the `notes` justify it.
> The lints guarantee only scarcity (1 emphasis/slide, 1 marker/slide,
> 1 peak/deck); the *meaning* is yours to approve.

`totalScore` is the sum of the five `score` values.

The AI-tell blocklist you check `visualIntegrity` against lives in §2 of
[`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md)
— do not restate or weaken it here; reference it. The same goes for the
pattern capacities (a `comparison` card past 5 points, a `chart` past ~8 bars):
those are `informationDesign` density failures, defined by the catalog, not by
your taste.

## 3. Assign the band

- **`reject`** — `totalScore` < 80. Return with concrete fixes; do not ship.
  **Also forced** whenever an unresolved §5 visual break remains (see §1).
- **`internal`** — 80–89. Acceptable for internal use; list the improvements
  that would lift it.
- **`external`** — ≥ 90. Cleared for external delivery.

## 4. Write concrete, actionable findings

`findings[]` is the payload that makes a review useful. Each entry is
`{dimension, slide?, issue, fix}`, ordered **most impactful first**. The `fix`
must be a specific change someone can execute, not an adjective:

- ✅ `"split slide 5 into two — overview on a message slide, the 4 drivers on a two-column"`
- ✅ `"slide 3 title 『コスト構造』 → restate as the conclusion: 『固定費が利益を圧迫している』"`
- ✅ `"slide 7 column chart has 11 bars (>8 crowds, see catalog chart capacity) — aggregate to top 6 + その他"`
- ✅ `"slide 4 emphasized card uses a left stripe (AI-tell §2) — replace with a surfaceAccent tint"`
- ❌ `"improve clarity"` / `"make it cleaner"` / `"better hierarchy"`

If a finding maps to an open `visualQa` issue, keep them consistent: the same
break should appear as a slide issue **and** as a `visualIntegrity` finding.

## Output: a `deck_review` JSON

Emit one object conforming to
[`../../schemas/deck_review.schema.json`](../../schemas/deck_review.schema.json).
Shape:

```jsonc
{
  "deck": "out/seminar-kanrikaikei.pptx",
  "totalScore": 86,
  "band": "internal",                 // reject <80 | internal 80-89 | external >=90
  "dimensions": {
    "messageLogic":      { "score": 22, "max": 25, "notes": "slides 1-9 each carry one message; slide 5 title 『売上について』 is a topic label, restate as a conclusion." },
    "visualIntegrity":   { "score": 21, "max": 25, "notes": "QA clean except slide 7 takeaway card nearly touches the footer; no AI-tells." },
    "designFidelity":    { "score": 18, "max": 20, "notes": "dark cover+cta, light body (sandwich holds); ink dominant + single amber accent; tokens consistent." },
    "informationDesign": { "score": 16, "max": 20, "notes": "every slide has a visual; slide 7 chart is native but has 11 bars (>8 crowds)." },
    "contentIntegrity":  { "score": 9,  "max": 10, "notes": "estimates labeled 『イメージ』; slide 6 60% claim needs a basis." }
  },
  "visualQa": {
    "ran": true,
    "slides": [
      { "slide": 1, "issues": [] },
      { "slide": 7, "issues": [
        { "type": "margin", "detail": "takeaway card bottom ~0.3\" from footer; gap looks tight", "severity": "minor", "resolved": false }
      ] }
    ]
  },
  "findings": [
    { "dimension": "informationDesign", "slide": 7, "issue": "column chart has 11 bars; >8 crowds (catalog chart capacity)", "fix": "aggregate to top 6 categories + その他" },
    { "dimension": "messageLogic", "slide": 5, "issue": "title is a topic label, not a message", "fix": "restate 『売上について』 as the conclusion, e.g. 『売上は3か月連続で改善している』" }
  ],
  "verdict": "Fix-then-ship: strong narrative and clean visuals; slide 7 chart density and slide 5 title are the two changes between internal-86 and external."
}
```

Notes on the shape:
- `dimensions`, `visualQa` (`ran` + `slides`), and `verdict` are **required**.
  `findings` is optional but expected for any `reject`/`internal` deck — an
  `external` deck may legitimately have an empty or short list.
- `visualQa.slides[].issues[].type` is one of
  `overflow | overlap | margin | contrast | alignment | ai-tell | placeholder | chart | other`;
  `severity` is `blocker | major | minor`; `resolved` defaults to `false`.
- `verdict` is one paragraph: ship / fix-then-ship / reject, and why — the
  human-readable summary of the score and the top fixes.

## Boundaries

- You score and report; you never silently "fix" the deck (M-4: an unfixable
  break is stopped and reported, not papered over).
- Do not invent layout numbers. Coordinates and capacities are the engine's
  (`bin/generate.js`) and the catalog's; when a finding turns on geometry, cite
  the pattern (`see catalog chart capacity`) rather than restating numbers.
- Norms you score against live in `references/` and this SKILL, never in
  `CLAUDE.md` (M-5); the theme governs look-and-feel only, never slide order or
  chapter structure (M-6), so a structure complaint is a `messageLogic` /
  deck-plan finding, not a theme one.
