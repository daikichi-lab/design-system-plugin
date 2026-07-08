# Usecase: 集客セミナー (lead-generation seminar)

A type guide for `deck-strategy`. It shapes **Steps 2–4** (frame, beat order,
pattern sequence) and adds type-specific content cautions for a 集客セミナー deck.
It **never overrides the house bar** (`../principles/house-quality-bar.md`) and it
sets **no colors or fonts** — those belong to the theme (M-6). When this guide and
the house bar disagree, the bar wins; when capacity is tight, **split, never cram**
(`../patterns/catalog.md`).

---

## 1. When this applies — audience & goal-action

Use this guide when the deck is a **集客セミナー**: a talk given to *prospects* to
earn a small next step, not to close a sale in the room.

- **Audience.** 見込み客 — typically 経営者 (owners) who reason about cash and risk,
  not specialists. They arrived curious but skeptical, and they **fear a hard
  sell** (house bar §4 reader-psychology; `slide-design-principles.md` §1.4).
- **Scene.** A read-aloud session (often ~30–60 min) plus a leave-behind PDF.
  Density stays low — slides support the speaker, they are not the script.
- **Goal-action.** Move the room to **one low-friction next step** —
  個別相談 / 問い合わせ — **without a hard sell**. The `cta` is that single action
  made concrete (`deck-strategy` Step 1.3). If you cannot name the one action in a
  line, the input is too vague — ask, don't guess.
- **Main message.** One sentence the deck proves: the audience's current way leaves
  value (or safety) on the table, and the tool you teach closes the gap — phrased as
  a conclusion or a question, never a label.

## 2. Recommended narrative frame

Pick **PAS** (Problem · Agitate · Solve) or **Before-After-Bridge** (BAB) — see
`../principles/slide-design-principles.md` §3.

- **PAS** when the audience *underrates a risk* and must feel it before they act
  (「決算を待つと判断が半年遅れる → その間に資金は静かに減る → 月次で先に気づく」). PAS sits
  best just before a CTA — exactly a seminar's shape.
- **BAB** when you are selling a *change of state* and the "after" is the hook
  (「いまはどんぶり経営 → 数字で意思決定できる状態へ → その橋渡しが管理会計」).

Either frame nests the seminar arc: **つかみ → 課題 → 解決の道具 → 効果 → 個別相談**.
When you *agitate* (PAS) or paint the "before" (BAB), keep it **truthful** — use the
honesty guards in house bar §4 so urgency never tips into a scare claim
(`deck-strategy` Step 2). Don't mix frames within one beat.

## 3. Recommended slide sequence

Six beats, sandwiched (`cover` first, `cta` last). Each pattern is chosen for the
job it does, within its `capacity` (`../patterns/catalog.md`):

1. **`cover`** — つかみ + goal. State the deck's promise and the session's goal in
   the kicker; this is the dark sandwich open.
2. **`message`** — 課題提起 in **one** message. One centered statement (+ optional
   one big `statBig`) makes the problem land; this is a breathing slide — do not
   crowd (capacity: messageLines ≤ 2, statBig ≤ ~6 chars).
3. **`two-column`** — 解決の全体像 + 要素. Left lead = the big picture; right =
   **3 ideal / 4 max** numbered parts of the tool (4th row nears the footer).
4. **`comparison`** — 対比で理解を整理. Two cards, old-way vs new-way; put the side you
   advocate on the **right** (accent-tinted, **never striped** — house bar §2).
   Capacity: 4 points / card ideal, 5 max.
5. **`chart`** — 効果を数字で. One **native** column chart + one takeaway card; the
   number makes the benefit obvious. Capacity: 4–7 bars read cleanly. Label the unit
   and basis/period (house bar §4).
6. **`cta`** — 個別相談へ, **exactly one** action. The accent panel is the offer
   (例: 個別相談（無料・30分）) with explicit reassurance; dark close, mirrors `cover`.

This is 6 slides — within the healthy 6–14 range and below the 8-slide threshold,
so **no `section` dividers** (sections only in 8+ slide decks; capacity rule).
Vary patterns; don't repeat one 3× in a row. If a longer seminar (8+ slides) needs
chapters, add `section` dividers between arcs and consider an extra `stat-grid`
(2–4 KPIs) or `message` beat — but never two dark slides adjacent in the body.

## 3.5 The slide is the speaker's backdrop — two seminar-specific disciplines

- **話者の先回りをしない (don't preempt the speaker).** A read-aloud slide that
  says everything kills the talk's peaks: **the line that lands hardest when
  *spoken* gets REMOVED from the slide** and parked in `notes` — the slide is
  the speaker's backdrop, never a summary of the script. The deliberate
  exception is the reverse move: *show* the line, then let the speaker fall
  silent (a dark statement beat carrying the payload works because the silence
  is the delivery). Choose one per beat — write it or say it, never both.
- **時間密度との整合 (info ∝ screen time, not importance).** A slide is a
  container of *time*: budget minutes-per-slide from the section plan (e.g.
  60分 ÷ 32枚 ≈ 1.9分/枚 average — but never distribute evenly). Two slide
  species follow:
  - **3-second slides** (statement `message`, `section` dividers): the speaker
    turns, one breath, moves on. ONE line only — anything added makes the room
    stop to read and the rhythm dies.
  - **Dwell slides** (the worked diagram, the reference `table`, the `chart`):
    on screen for 2–3 minutes, so they must reward re-reading — the full
    structure plus the one 種明かし line to discover.
  Sanity-check each section: minutes ÷ slides tells you which species each
  beat must be; a "3-second" beat carrying a dense diagram (or a 2-minute beat
  showing one thin line) is a planning bug — fix the plan, not the design.

## 4. Content cautions (specific to this type)

- **誠実に。押し売りしない.** The audience fears a hard sell — defuse it explicitly.
  State 無理な勧誘はいたしません on the `cta` (`offerBody`), and keep the whole deck
  an invitation, not a pitch. The closing asks for **one** small step, not a
  purchase.
- **イメージ値は「（イメージ）」と明記し、誇張しない.** Any illustrative figure (a `message`
  `statBig`, a `chart` value) must be labeled as illustrative. 「約60%（イメージ）」は
  honest; 「60%が失敗する」 stated as fact is not (house bar §4 — no unsupported
  assertions). On the `chart`, give the unit and the period/basis.
- **約束しすぎない.** Avoid guarantees of results ("必ず利益が増える"). Promise what the
  *next step* delivers (e.g. その場で改善のヒント), not an outcome you cannot ensure.
- **One message per slide, titles as conclusions/questions.** 「月次で見ると、打ち手が
  早くなる」 (claim) or 「一緒に見てみませんか？」 (question) — never a label like 「月次推移」
  (house bar §1; `slide-design-principles.md` §4).
- **Tone = trustworthy, clear, honest** — this is an external-facing deck (house
  bar §4). Density stays low so the speaker carries the room; split before you cram.

## 5. Example deck (reference render)

A full worked seminar — 管理会計入門 for 経営者 — lives at
`../../examples/seminar-kanrikaikei/`. It follows this exact six-beat sequence
(`cover` → `message` → `two-column` → `comparison` → `chart` → `cta`) and is the
house reference render (house bar header). Read:

- `../../examples/seminar-kanrikaikei/deck_plan.json` — the deck plan to model on.
- `../../examples/seminar-kanrikaikei/deck_review.json` — its `deck-review` score,
  showing why it clears the bar.

Use it as a help, not a template to copy verbatim — re-fix audience → scene →
goal-action → psychology → message for each new seminar before reusing the beats.
