# Slide Design Principles

`house-quality-bar.md` is the **checklist and rubric** — what a finished deck
must satisfy. This file is the **method and reasoning** that produces a deck
that passes it. The bar tells you whether you're done; this tells you how to
think so you arrive there on purpose, not by luck.

> A deck is a tool for understanding, deciding, and acting — not decoration.
> Everything below works backward from that: from the action you want, to the
> message that earns it, to the layout that carries it. Layout is last on purpose.

These principles feed two skills: `deck-strategy` turns them into a pattern
choice and order (a deck plan); `deck-review` checks the result via the rubric
in `house-quality-bar.md`. Patterns and their capacities live in
`../patterns/catalog.md`; chart-specific reasoning lives in `chart-design.md`.

---

## 1. Decide the thinking before the pixels

No slot in any pattern gets filled until five questions are answered, **in
order**. This is the chain behind non-negotiable #2 in `house-quality-bar.md`
("Audience → scene → goal-action fixed first"):

1. **Audience** — who is in the room? A 経営者 (owner) reasons about cash and
   risk; a 現場担当者 reasons about workload and steps. Same topic, different deck.
2. **Scene** — where and how is this consumed? A 60-minute seminar read aloud, a
   leave-behind PDF, and a 5-minute decision meeting demand different density and
   different closings.
3. **Goal-action** — what should the audience *do* after the last slide? Book the
   無料個別相談, approve the budget, change one habit. If you can't name a single
   concrete action, you're not ready to design — you're still researching.
4. **Reader-psychology** — what does this audience already believe, fear, or
   resist? The seminar example assumes owners run on どんぶり経営 and quietly worry
   it's risky, and that they fear a hard sell — so the CTA promises 無理な勧誘は
   いたしません. Name the resistance, then design to dissolve it.
5. **Main message** — the one sentence the whole deck exists to land. Everything
   that doesn't serve it is cut.

Only after these five do you reach for a pattern. Skipping to layout is the
single most common way a deck ends up pretty and pointless.

## 2. Message before design; logic before aesthetics

A deck is an argument, not a gallery — two consequences:

- **Message before design.** Write the deck's spine as plain sentences first —
  one per slide, each a claim or a question. If that list doesn't persuade on
  its own, no card, tint, or chart will rescue it. Design *amplifies* a sound
  message; it cannot manufacture one.
- **Logic before aesthetics.** The order of slides is the order of the
  argument. Reorder until the sentences flow as a proof, *then* style. When a
  slide feels like it needs decoration to be interesting, the real problem is
  that it carries no message — fix the message, don't add ornament. (This is
  also why decorative AI-tells are banned outright — see §2 of
  `house-quality-bar.md`.)

## 3. Narrative frames — pick the one that fits the move

The spine from §2 should follow a recognizable frame so the audience can feel
the argument's shape. Choose by what the slide (or short run of slides) is
*doing* — the rubric's "Message & logic" dimension explicitly rewards a coherent
frame.

- **SCQA** (Situation · Complication · Question · Answer) — use to **open a deck
  or a section** that must motivate a problem before proposing a fix. Best when
  the audience doesn't yet feel the pain.
  - JP: 「黒字なのに資金が苦しい(状況→複雑化)。なぜか？(問い) 利益と現金は別物だから(答え)。」
- **PREP** (Point · Reason · Example · Point) — use for a **single tight
  recommendation** you want remembered. Best when you already have agreement on
  the problem and need a crisp answer.
  - JP: 「月次決算を入れるべきだ(主張)。打ち手が早まるから(理由)。6月の谷を8月に取り戻せた(例)。だから月次だ(再主張)。」
- **PAS** (Problem · Agitate · Solve) — use when the audience **underrates a
  risk** and needs to feel it before they'll act. Best just before a CTA.
  - JP: 「決算を待つと判断が半年遅れる(問題)。その間に資金は静かに減る(煽り)。月次で先に気づく(解決)。」
- **BAB** (Before · After · Bridge) — use to **sell a change of state**: paint
  the current pain, the better world, and the path between. Best for
  transformation pitches and product/service value.
  - JP: 「いまはどんぶり経営(Before)。数字で意思決定できる状態へ(After)。その橋渡しが管理会計(Bridge)。」

A whole deck usually nests these: SCQA to open, PREP/PAS in the body, BAB into
the closing `cta`. Don't mix frames *within* one beat — pick one per move.

## 4. One slide = one message; the title is the conclusion or the question

This is non-negotiable #1 in `house-quality-bar.md`, and it is the rule with the
highest leverage. The title is not a filing label for the slide's topic — it is
the slide's **payload**, stated as a **conclusion** or a **question**.

| Topic label (weak — never ship) | Message (conclusion / question) |
|---|---|
| 売上について | 売上は3か月連続で改善している |
| 管理会計とは | 管理会計が照らす、3つの視点 |
| 月次の話 | 月次で見ると、打ち手が早くなる |
| 今後について | あなたの会社の数字を、一緒に見てみませんか？ |

Test each title with: *can the reader disagree with it?* "売上について" asserts
nothing and cannot be argued with; "売上は3か月連続で改善している" makes a claim,
which is exactly what a title should do. A question title (「…見てみませんか？」)
is the legitimate exception — it asks for the goal-action and so still carries
the slide's intent. Every pattern's `title` / `titleLines` / `messageLines` slot
in `../patterns/catalog.md` exists to hold this payload; the `message` pattern is
nothing *but* the payload, centered. If a slide seems to need two messages, it is
two slides (see §6).

## 5. Alignment & size — left for body, center only for titles

This is non-negotiable #6, and the engine already enforces it. Reasoning, not
taste:

- **Body text is left-aligned.** The eye returns to one left edge to start each
  line; center-aligned body forces the reader to re-find the start of every line
  and reads instantly as auto-generated (it's on the AI-tell blocklist in
  `house-quality-bar.md` §2). In `bin/generate.js` every body run — the
  `two-column` lead and rows, `comparison` bullets, the `chart` takeaway — is
  `align: "left"`.
- **Only titles (and the single centered `message`/`stat`) may center.** The
  `message` pattern centers its one statement and big `stat` because each is a
  single focal object, not a paragraph read line by line.
- **Size contrast must be obvious.** Title vs. body must differ enough that the
  hierarchy is read before a single word is. The neutral theme makes this
  structural — `title` 28pt over `body` 15pt, `cover` 40pt, `message` 32pt,
  `stat` 62pt — and those sizes live only as theme `sizes.*` tokens, so you tune
  contrast by editing the theme, never by overriding a textbox. (Full scale:
  `../patterns/catalog.md` and the theme JSON.)

## 6. Density — one idea's worth per slide; split, never cram

Every pattern in `../patterns/catalog.md` carries a `capacity` line, and it is a
**hard ceiling, not a suggestion**. A few worked examples (the engine is the
source of truth — see `../patterns/catalog.md`):

- `two-column`: **3 items ideal, 4 max** — the row gap is fixed, so a 5th row
  would collide with the footer.
- `comparison`: **4 points per card ideal, 5 max** — beyond that the bullets
  overflow the fixed card height.
- `chart`: **4–7 bars read cleanly** (the sample uses 6); past ~8 the columns
  crowd and labels fight.

When content exceeds a capacity, the move is always **split into two slides**,
never shrink the type or tighten margins to fit. Cramming produces the two
defects the QA loop catches most often — overflow and overlap (non-negotiable
#10) — and shrinking margins below 0.5" trips non-negotiable #7. "One idea's
worth" is the unit: if a slide carries setup *and* payoff, or two parallel
comparisons, that is two ideas and two slides. Empty is also wrong — a `message`
slide is *meant* to breathe, but a body slide with three words and no visual
wastes the audience's attention.

## 7. Every slide carries a visual — and which one is a choice, not a default

Non-negotiable #3: no wall-of-text slides; every slide carries a visual element.
But "add a visual" is not the instruction — **pick the visual whose job matches
the slide's job.** That mapping *is* the pattern catalog. Choose by the beat,
following `../patterns/catalog.md`'s "Choosing & sequencing" guidance:

- one idea or one number → `message` (centered statement + big `stat`)
- overview + its parts → `two-column` (lead paragraph + numbered rows)
- A vs. B, before vs. after, old vs. new → `comparison` (two cards, the
  advocated side on the **right**, accent-tinted)
- a trend or magnitude a number makes obvious → `chart` (one native chart + one
  takeaway card)
- the opening and the closing ask → `cover` and `cta` (the dark sandwich ends)

The 9 patterns are exactly `cover`, `message`, `two-column`, `comparison`,
`chart`, `stat-grid`, `table`, `section`, `cta` — nothing else is implemented.
A picked-wrong visual is its own
defect: a `chart` with data that has no point, or a `comparison` forced onto
three things, fails the "Information design" dimension even if it renders
cleanly. For chart *type* and how to make the data argue (column vs. line, axis,
labels, honesty of the number), follow `chart-design.md`. Card emphasis is
always tint + soft shadow, never a stripe or band — restating the AI-tell
blocklist in `house-quality-bar.md` §2 by reference.

## 8. How this feeds the rest of the pipeline

These principles don't stop at a single slide — they are the input to two
downstream steps:

1. **`deck-strategy` chooses and orders patterns.** With audience → scene →
   goal-action → psychology → message fixed (§1) and a narrative frame chosen
   (§3), strategy maps each beat to a pattern (§7), respects every `capacity`
   (§6), opens with `cover` and closes with `cta` (the sandwich), varies the
   patterns, and emits a deck plan validated by `schemas/deck_plan.schema.json`.
   Themes never enter here: a theme holds **only** look-and-feel — colors,
   fonts, sizes, canvas (`schemas/theme.schema.json`) — and **never** chapter
   structure or slide order, which are content/strategy decisions (M-6).
2. **`deck-review` enforces these principles against the render.** It scores
   "Message & logic" on §1–§4 (one message, conclusion/question titles, a
   coherent frame, a clear goal-action) and "Information design" on §6–§7 (right
   visual, right density), then runs the mandatory render-and-look QA loop (M-2)
   every generation. Any unresolved visual break caps the deck below 80, and a
   layout break that **cannot** be cleanly fixed is a stop-and-report, not a ship
   (M-4). The review's machine shape is `schemas/deck_review.schema.json`.

These principles live in this `references/` file and in the SKILLs that consume
it, **not** in `CLAUDE.md` (M-5) — design norms are reference material the skills
read, not standing instructions baked into the agent.

---

**Recap.** Decide audience → scene → goal-action → psychology → message before
any pixel; make every title a conclusion or a question; keep one message per
slide; choose the visual whose job fits the beat; split rather than cram; let
`deck-strategy` order it and `deck-review` (with the QA loop) prove it clears the
bar in `house-quality-bar.md`.
