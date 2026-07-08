---
name: deck-strategy
description: Use when starting a new deck or restructuring one — turns a goal/audience/draft into a validated deck plan (ordered pattern list). Fixes audience, scene, goal-action, main message, and narrative frame, then selects and sequences slide patterns. Outputs deck_plan.json for create-deck. Does NOT generate the pptx.
---

# deck-strategy

You turn a raw goal (and whatever draft, notes, or transcript the user has)
into a **validated deck plan** — an ordered list of slide patterns with their
wording filled in. That plan is the contract `create-deck` consumes.

**You own STRUCTURE + WORDING only.** You decide what each slide *says* and in
what order. You do **not** pick colors, fonts, or visual style — those live in
the project theme and are chosen elsewhere (M-6, see the boundary at the
bottom). Your output is content + pattern order, theme-agnostic: the same plan
must render correctly under any conforming theme.

You also do **not** generate the `.pptx`. You stop at the deck plan and hand
off. Read these before planning:

- `../../references/principles/house-quality-bar.md` — the bar every deck meets. One slide / one message; titles are conclusions or questions, never topic labels.
- `../../references/principles/slide-design-principles.md` — narrative frames and the message-first method.
- `../../references/principles/visual-psychology.md` — the gaze-design layer: one protagonist per slide (`emphasis`), one climax per deck (`peak`), and the honesty guard on what may be emphasized.
- `../../references/principles/education-register.md` — the REGISTER gate (`meta.intent`): financial/board vs seminar/education, the inversion table, the three education modes with their honesty guards, the persona 床規則, and the imaginability transform. **Read before designing any deck** — the register decides which defaults flip.
- `../../references/patterns/catalog.md` — the 24 patterns, their jobs, and each one's `capacity`.
- `../../schemas/deck_plan.schema.json` — the exact shape you must emit.

## Step 0 — Declare the register (`meta.intent`)

Before the spine: is this deck for **decision-makers** (`financial` / `board` —
restraint = trust; personas and speech bubbles are a lint ERROR) or for
**learners** (`seminar` / `education` — 理解・定着・共感; the inversion table in
education-register.md flips the diagram default to "迷えば構造を見せる",
allows a livelier tone and the persona device, and turns the imaginability
transform ON)? The shared floors (honesty / CUD / number atoms / no AI images /
1 emphasis per slide / 1 peak per deck) hold in BOTH registers. Write the
chosen intent into `meta.intent` — the lints read it. `marketing` behaves like
the learner registers for the device gates.

**Also declare `meta.personStyle` whenever ANY person will appear** (persona
figures, dialogue/testimonial avatars): `"silhouette"` (黒シルエット — 抑制・
格式・数字主体) or `"illustration"` (カラーイラスト — 親しみ・共感・セミナー/
マーケ). **1デッキ1様式** — the STYLE-UNIFORM lint ERRORs on mixing; the
register decides which. Pick each slide's figure from the project's
`assets/generated/figures/figures-index.md` (the scene→figure catalog; 1シーン
1枚 for fixed-pose sets) and record WHY in `notes`. No matching素材 → bubble-only
(+PERSONA-FIGURE WARN) or the in-engine fallbacks (`style:"silhouette"|"pictogram"`)
— never mix styles to fill a gap. Fictional persons/voices always carry ※例
(`mark`) — 例示を事実主張と混ぜない.

---

## Step 1 — Fix the spine (before any slide exists)

Decide these five, in order, and write them down. Layout comes later; if the
spine is wrong, no pattern choice can save the deck.

1. **Audience** — who literally reads/sits through this? (e.g. 中小企業の経営者、
   情シス部長、投資家。) Their vocabulary and prior knowledge set the tone.
2. **Usage scene** — where and how is it shown? 60分のセミナー登壇 / 役員会で5分 /
   メール添付で独り読み. Scene fixes density and length.
3. **Goal-action** — the **one thing** you want the audience to *do* after the
   last slide (申し込む、予算を承認する、月次で数字を見る習慣を始める). Not "understand X" —
   an action. The `cta` slide is this action made concrete.
4. **Reader psychology** — what do they currently believe, fear, or resist?
   (「会計は税理士に任せておけばいい」.) The deck must move them *from* that.
5. **ONE main message** — a single sentence the whole deck proves. A
   **conclusion or a question**, never a label. This becomes the cover promise
   and the spine every body beat ladders up to.

If you cannot state the goal-action and the one message in one line each, the
input is too vague — ask the user, don't guess.

## Step 2 — Choose a narrative frame

Pick the frame that fits the audience's starting psychology (Step 1.4). See
`../../references/principles/slide-design-principles.md` for full guidance.

- **SCQA** — Situation → Complication → Question → Answer. Best when the
  audience needs to feel the problem before the solution (most seminars, most
  proposals).
- **PREP** — Point → Reason → Example → Point. Tight and time-boxed; lead with
  the conclusion for executives who want the answer first.
- **PAS** — Problem → Agitate → Solve. When urgency must be felt; use the
  honesty guards in house-quality-bar.md §4 so agitation stays truthful.
- **BAB** — Before → After → Bridge. When you're selling a transformation and
  the "after" state is the hook.

The frame decides the **order of beats**. Each beat is one idea you must land.

**Then map the emotional curve** (read-aloud decks especially — see
`slide-design-principles.md` §3): write down the named emotional states the
audience should pass through (約束 → 期待 → 共感 → どん底 → 気づき → 安心 →
高揚 …) and mark the **転換点** — the beats where the room's state must flip.
Turning points take the dark statement treatment (情報を処理させるページは白、
感情を刻むページは紺) and are the candidates for the one `peak`. **This
classification is the one step no lint can check** — the turning-point list is
manuscript comprehension. Record it (each turning point's slide gets a `notes`
line saying why it flips the room) so the human approving the plan can catch a
mis-read; everything downstream of the classification is mechanical.

## Step 3 — Map each beat to a pattern

For every beat, pick the pattern whose *job* matches it
(`../../references/patterns/catalog.md`). The patterns, by the job they do:

| Beat shape | Pattern |
|---|---|
| One idea / one number / a pivot | `message` |
| Big picture + 2–4 supporting parts | `two-column` |
| A vs B, before/after, old vs new | `comparison` |
| A trend or magnitude + one takeaway | `chart` |
| 2–4 KPIs / headline numbers | `stat-grid` |
| 4–6 terms each with one short explanation | `card-grid` |
| Precise figures in rows & columns | `table` |
| An ordered process / steps | `flow` (diagram) |
| A repeating loop (PDCA, a lifecycle) | `cycle` (diagram) |
| A 2-axis positioning / four quadrants | `matrix` (diagram) |
| Dated milestones / 沿革 / history | `timeline` (diagram) |
| Ascending stages toward a goal (階段) | `steps` (diagram) |
| One thing splits into N / N merge into one | `branch` (diagram) |
| A quantity decomposed into factors (掛け算) | `formula` (diagram) |
| A level, its drivers, the next level (ブリッジ) | `waterfall` (diagram) |
| 2–3 options/plans side by side + a VS verdict | `positioning` (diagram) |
| An ecosystem of actors + labeled flows between them | `system` (diagram) |
| Category ⇔ member correspondence / 分類 | `relation` (diagram; partition→zones) |
| A common misunderstanding → the correction | `before-after` |
| A conversation that dramatizes the point; ○×の会話比較 | `dialogue` (register-gated) |
| 受講者/お客様の声 (social proof) | `testimonial` (register-gated) |
| A chapter break in a longer deck (dark) | `section` |
| The opening promise (dark) | `cover` |
| The single next action (dark) | `cta` |

The rows marked *(diagram)* are **diagram skeletons** — read the conservative gate
in **Step 3b** before choosing one. A diagram that fits the logic is worth a thousand words; one
that doesn't is worse than text.

**Respect each pattern's `capacity`.** It is a hard limit, not a suggestion:

- `two-column` items: 3 ideal, 4 max.
- `comparison` points: 4 ideal, 5 max per card.
- `chart`: 4–7 bars read cleanly; >8 crowds. Types: `column` (default) /
  `bar` (ranking, values ascending) / `line` (trend) / `pie`・`doughnut`
  (parts of one whole, **max 5 slices**).
- `stat-grid`: 3 ideal, 4 max, 2 min cards.
- `card-grid`: 4–6 cards; heads are one-line terms, bodies ≤ 3 short lines.
- `table`: ≤ 6 rows incl. header, ≤ 5 columns; always add a units/basis `note`.
- `flow` / `cycle`: 3–6 nodes (each node label short — the height gate fails an
  overflowing node); `matrix`: exactly 4 quadrants (fixed 2×2).
- `timeline`: 3–7 milestones, each `{date, label}` — dates one line (2014.10),
  labels short (the alternating boxes are narrow); more eras → split or a table.
- `steps`: 3–5 stage labels — the first (shortest) block binds the label length.
- `branch`: 1 source + 2–4 branches (labels short; 4 branches leave one line each).
- `formula`: 2–4 operands + optional result — labels are short TERMS, not sentences.
- `waterfall`: 3–8 items ({label, value, total?}); group small drivers into その他.
- `chart` band type: 2–4 segments × 1–5 rows; pie/doughnut: 2–5 slices.
- `positioning`: 2–3 options; `system`: 2–5 actors; `relation`: 2–4 per side,
  ≤8 links; `cycle`/`flow` node labels ≤ ~5 chars per line (the height gate
  fails an overflowing node — the floor caught 7-char cycle steps).
- `dialogue`: plain 2–4 speakers; compare form exactly 2 columns × 1–2 speakers.
  Quotes must fit their bubbles — 2 short lines each is the safe zone.
- `testimonial`: grid 2–6 items, stack 2–3; bodies ≤ 2 short lines.
- `section`: title ≤ 1 line; index 1–2 chars; only in decks of 8+ slides.
- `cover` / `cta` / `message`: title ≤ 2 lines.

When a beat exceeds capacity, **split it into two slides** — never shrink the
copy or cram past the bar. Two clean slides beat one crowded one every time.

**Name each slide's protagonist (`emphasis`).** For every body beat, ask: *which
single element proves this slide's message?* — the KPI card, the process step,
the quadrant, the row. Put its index in `emphasis` (see each pattern's block in
catalog.md / diagram-recipes.md; a chart's bar protagonist is `emphasizeIndex`).
One per slide — the lint (EMPHASIS-COUNT) hard-errors on more. Two rules:

- **If you cannot name the protagonist, the message is fuzzy** — that is a sign
  to rework the beat (split it, or sharpen the title), not to skip emphasis.
  Leaving `emphasis` unset is fine for genuinely equal-weight slides (an agenda,
  a balanced 強み/リスク comparison) — record *why* in `notes`.
- **誠実ガード (MUST):** emphasize only what the data actually supports. Never
  enlarge the flattering number, never emphasize a forecast/estimate as if it
  were an actual (実績を強調し、予想はミュートのまま注記する), no loss-aversion
  scare wording. This is house-quality-bar §4 applied to emphasis; deck-review
  checks every emphasized claim against it. Financial/factual decks: strictest.
  **Arithmetic is part of honesty:** even illustrative/dummy figures must
  reconcile (a ミニ決算書 whose 縦計算 doesn't sum, deltas that don't bridge —
  reverse-engineer the numbers until they check out, or drop them). A wrong
  number on a "読めなくていい" slide is the worst break of trust
  (house-quality-bar §4).

Record the reasoning in the slide's `notes` (`【emphasis=N】主役は…、なぜなら…`)
— the reviewer must be able to audit the choice.

**Markers (`marker`, optional — the 見せ場 device).** The protagonist may carry
ONE marker: `circle` (hand-drawn ring around the number), `badge` (a small pill
with a FACT label — 過去最高/初/3期連続, ≤8 chars), or `arrow-note` (arrow +
one-line note, ≤14 chars). Use sparingly — a marker on every slide is no marker
at all; one or two per deck, on the beats that must be remembered. Badge/note
wording must be a fact the data supports (hype adjectives are lint-blocked;
factuality itself is deck-review's audit). Supported: stat-grid / message
(all 3), chart takeaway / flow / cycle nodes (badge & arrow-note).

## Step 3b — Diagram? (conservative — default to text)

The diagram skeletons (`flow` / `cycle` / `matrix`) are powerful, but the failure
mode is **over-diagramming and mis-classification** — a wrong diagram distorts the
logic, and that is *worse* than plain text. So the gate is deliberately strict.

**Diagram a beat ONLY when its structure is unmistakable and a skeleton fits it exactly:**

- **`flow`** — an *ordered* sequence where the order carries meaning (申込 → 審査 →
  契約 → 納品). 3–6 steps. NOT an unordered list of features (that is `two-column` /
  text).
- **`cycle`** — a *repeating loop* that returns to its start (PDCA, a lifecycle, a
  virtuous circle). 3–6 nodes. If it doesn't truly loop back, it's a `flow`.
- **`matrix`** — items positioned on *two independent axes* → four quadrants
  (効果×工数, BCG, SWOT). Exactly 4. NOT comparing two things (that's `comparison`),
  NOT one axis (that's a `flow` / a list).
- **`timeline`** — *dated* milestones where the axis is time itself (沿革, 制度の
  変遷, プロジェクトの節目). 3–7 `{date, label}` pairs. If the beats are steps you
  *take* rather than events that *happened on dates*, it's a `flow`; if each era
  needs a paragraph, it's a `table` / `two-column`, not a diagram.
- **`steps`** — stages that *accumulate* toward a goal, where LEVEL rises
  (成長ステップ, 導入フェーズ, スキルの階段). 3–5 labels, last = the goal. If the
  beats are a mere sequence with no sense of climbing, that's a `flow`; if they're
  dated, that's a `timeline`.
- **`branch`** — ONE thing genuinely *splitting into* N parts (決算書 → 三表,
  戦略 → 打ち手) or N inputs *merging into* one result (`direction: converge`).
  2–4 branches. If the N items don't share a real source/result, it's a
  `two-column` list, not a branch; comparing the branches against each other is a
  `comparison`.
- **`formula`** — a quantity that genuinely *decomposes* into factors or summands
  (売上 = 客数 × 客単価 × 店舗数, ROE デュポン分解, コスト = 固定費 ＋ 変動費).
  2–4 operands, short terms. If the relation isn't a real equation, it's a
  `branch` / list — don't fake math.
- **`waterfall`** — a level, the signed drivers that move it, the next level
  (営業利益ブリッジ, 前期→当期の増減分解). 3–8 items; mark levels `total: true`.
  The deltas must genuinely SUM from one level to the next — if they don't
  reconcile, fix the numbers, not the diagram. Negatives render ▲ automatically.

- **`relation`** — categories and members that correspond (勘定科目の分類,
  対応マップ). THE FORM FOLLOWS THE DATA: a partition (each member belongs to
  exactly one category) renders as ZONE GROUPING automatically; only true
  many-to-many keeps correspondence lines. 2–4 per side.
- **`positioning` / `system` / `before-after`** — see their blocks in
  diagram-recipes.md / catalog.md; same conservative gate: name the structure
  in one word or keep it as text.
- **`dialogue` / `testimonial`** are persuasion devices, not diagrams: use them
  only in learner/marketing registers (financial/board = lint ERROR), always
  with `mark` (※例). The avatar is neutral — meaning rides in the words,
  scene symbols and ○×ラベル, never in a pose.

**When in doubt, do NOT diagram.** Keep the beat as text / `message` / `two-column`
/ `stat-grid` / `comparison`. Reach for a skeleton only when you can name the
structure in one word — *sequence / loop / two-axis* — and the node labels are short.

**Record the decision** in the slide's `notes`: which skeleton and *why* (or why you
kept it as text). This makes the classification reviewable — the human approving the
deck catches a mis-classification the lint cannot. The floor guarantees a diagram
won't *break*; it never guarantees the *structure fits the meaning* — that is a human
call, so leave the reasoning behind.

## Step 4 — Sequence (the sandwich)

1. **`cover` first, `cta` last** — always. Both are dark; they bookend the
   deck (sandwich rule in catalog.md and house-quality-bar.md §1.4).
2. **Body is light.** Never place two dark slides adjacent in the body, and
   budget dark as a scarce resource: **all dark faces together (cover + cta +
   sections + dark turning-point beats) ≤ ~25–30% of the deck** — beyond that
   the darkening loses its "now it matters" signal (house-quality-bar §1.4).
3. **Vary patterns** — don't repeat the same one 3× in a row. Alternate
   `two-column` / `comparison` / `chart` / `message` to keep rhythm. Density
   too: 3+ dense slides in a row (table / comparison / busy chart) read as one
   grey wall — the RHYTHM lint warns; break the run with a `message`/`section`.
4. **6–14 slides** is the healthy range for most decks. Shorter risks thin;
   longer risks losing the room — split into sections or cut beats.
5. **Pick the deck's ONE peak** (`"peak": true` on the slide, next to
   `pattern`): the body slide that *proves* the main message — usually the
   `message` beat carrying the headline number, or the chart that clinches the
   argument. Peak-end (ピーク・エンドの法則): the audience remembers the peak
   and the ending, so place the peak where the argument lands and let the `cta`
   be the end. Exactly one; never on `cover`/`cta` (lint ERRORs). Record *why
   this slide is the peak* in its `notes`. A deck may omit the peak (a flat
   informational deck), but a persuasion deck without a climax is usually a
   sign the main message is weak.
6. Sanity-check the **goal-action ladder**: read titles top to bottom. Do they
   form a single argument that arrives at the `cta`? If a slide doesn't move
   the audience toward the goal-action, cut it. (This 縦読みテスト doubles as
   the story check: the titles alone, read in order, must work as one
   narrative — a latecomer or a skimmer gets the spine from titles only.)
7. **Time-density check (read-aloud decks).** A slide is a container of time:
   estimate minutes-per-slide per section from the scene (Step 1.2) and match
   each beat's density to its screen time, not its importance — statement /
   `section` beats are **3-second slides** (one line; more kills the rhythm),
   worked diagrams / tables / charts are **dwell slides** (2–3 min on screen —
   give them re-reading depth + one 種明かし line). A dense beat in a 3-second
   slot (or a thin beat in a 2-minute slot) is a planning bug — re-cut the
   beats. See `../../references/usecases/seminar.md` §3.5.

## Step 5 — Consult the usecase guide (if one exists)

If a matching guide exists under `../../references/usecases/`, read it for
type-specific beat order, expected sections, and content cautions. (The
directory may be empty or partial — treat a guide as a help, not a hard
requirement; the beat orders below are a usable default either way.)

- seminar (集客セミナー: つかみ → 課題 → 解決の道具 → 効果 → 個別相談への誘導).
- proposal (提案: 現状 → 課題 → 提案 → 効果 → 費用 → 次の一歩).
- financial (財務・決算: house-quality-bar.md §4 applies hard — label estimates
  as estimates, include assumptions and metric definitions, no unsupported
  assertions).

When present, these guides shape Steps 2–4; they never override the house bar.

## Step 6 — Emit the deck plan

Produce JSON conforming to `../../schemas/deck_plan.schema.json`. Prefer the
**object form** so you can carry deck-level meta (footer brand, page numbers):

```jsonc
{
  "meta": {
    "title":  "管理会計 入門（サンプル）",   // pptx title metadata
    "author": "大吉会計",                    // pptx author metadata
    "footerLabel": "大吉会計",               // bottom-left brand on body slides
    "showPageNumbers": true
  },
  "slides": [
    { "pattern": "cover", "content": {
      "kicker": "経営者向けセミナー（60分）",
      "titleLines": ["数字で経営を変える", "管理会計 入門"],
      "subtitle": "「どんぶり経営」から、根拠ある意思決定へ",
      "footer": "大吉会計　｜　2026年7月"
    } },
    { "pattern": "message", "content": {
      "kicker": "本セミナーのゴール",
      "messageLines": ["決算書が出てから動くのでは、", "半年遅い。"],
      "statBig": "約60%",
      "statCaption": "…経営者は、決して多くありません（イメージ）"
    } },
    // …two-column / comparison / chart body beats…
    { "pattern": "cta", "content": {
      "titleLines": ["あなたの会社の数字を、", "一緒に見てみませんか？"],
      "offerHead": "個別相談（無料・30分）",
      "offerBody": "…無理な勧誘はいたしません。",
      "contact": "受付フォームより ／ info@example.co.jp"
    } }
  ]
}
```

Rules for the emit:

- **`meta.footerLabel`** sets the body-slide brand (overrides the theme's
  `brand.footerLabel`); set `showPageNumbers` (defaults to `true` if omitted).
- Use each pattern's exact required slots — the schema validates per-pattern
  (e.g. `chart` requires `series` + `takeawayHead` + `takeaway`; `comparison`
  requires `left`/`right`, each `{label, role, points}`).
- Put the side you advocate on `comparison.right` (the accent-emphasized card).
- Every `content` may carry `"notes"` → speaker notes. Use them for the
  presenter's intent, not for overflow copy. For read-aloud decks the notes
  are also the **receiving vessel of the 先回り rule**: the line that lands
  hardest spoken aloud is *removed from the slide* and parked here (the slide
  is the speaker's backdrop, not the script — `seminar.md` §3.5); when no
  separate script exists, notes carry the spoken part per slide.
- **Titles are messages**, not labels: 「月次で見ると、打ち手が早くなる」, not 「月次推移」.
- A full worked example: `../../examples/seminar-kanrikaikei/deck_plan.json`.

Validate the JSON against the schema before handing off.

## Step 7 — Hand off to create-deck

Pass the validated `deck_plan.json` to **`create-deck`**, which runs the full
gated pipeline (`bin/build.sh`: bake → asset rasters → generate → lints →
render) against the project theme and then the mandatory QA loop
(house-quality-bar.md §5, M-2). You do not render or QA the pptx here.

---

## The boundary (do not cross it)

- **deck-strategy = structure + wording, theme-agnostic.** You choose patterns,
  their order, and the Japanese copy. You never choose colors, fonts, sizes, or
  visual style — and you never hardcode chapter structure or slide order into a
  theme. Look-and-feel lives in the theme; structure lives here (M-6).
- A correct plan renders well under **any** conforming theme. If a beat only
  works with a particular color or font, the beat is wrong — fix the content.
- Design norms stay in `references/` and these SKILLs, never in `CLAUDE.md`
  (M-5). Don't restate visual rules inline; **reference** the house bar and its
  AI-tell blocklist (house-quality-bar.md §2) rather than copying them.
- You don't generate the pptx and you don't score it. If `create-deck` reports
  an unfixable layout break, it stops and reports (M-4) — that may bounce a beat
  back to you to split or shorten; re-plan, don't override the bar.
