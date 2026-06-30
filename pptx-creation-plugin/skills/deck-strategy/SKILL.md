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
- `../../references/patterns/catalog.md` — the nine patterns, their jobs, and each one's `capacity`.
- `../../schemas/deck_plan.schema.json` — the exact shape you must emit.

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

## Step 3 — Map each beat to a pattern

For every beat, pick the pattern whose *job* matches it
(`../../references/patterns/catalog.md`). The nine patterns, by the job they do:

| Beat shape | Pattern |
|---|---|
| One idea / one number / a pivot | `message` |
| Big picture + 2–4 supporting parts | `two-column` |
| A vs B, before/after, old vs new | `comparison` |
| A trend or magnitude + one takeaway | `chart` |
| 2–4 KPIs / headline numbers | `stat-grid` |
| Precise figures in rows & columns | `table` |
| A chapter break in a longer deck (dark) | `section` |
| The opening promise (dark) | `cover` |
| The single next action (dark) | `cta` |

**Respect each pattern's `capacity`.** It is a hard limit, not a suggestion:

- `two-column` items: 3 ideal, 4 max.
- `comparison` points: 4 ideal, 5 max per card.
- `chart`: 4–7 bars read cleanly; >8 crowds.
- `stat-grid`: 3 ideal, 4 max, 2 min cards.
- `table`: ≤ 6 rows incl. header, ≤ 5 columns; always add a units/basis `note`.
- `section`: title ≤ 1 line; index 1–2 chars; only in decks of 8+ slides.
- `cover` / `cta` / `message`: title ≤ 2 lines.

When a beat exceeds capacity, **split it into two slides** — never shrink the
copy or cram past the bar. Two clean slides beat one crowded one every time.

## Step 4 — Sequence (the sandwich)

1. **`cover` first, `cta` last** — always. Both are dark; they bookend the
   deck (sandwich rule in catalog.md and house-quality-bar.md §1.4).
2. **Body is light.** Never place two dark slides adjacent in the body.
3. **Vary patterns** — don't repeat the same one 3× in a row. Alternate
   `two-column` / `comparison` / `chart` / `message` to keep rhythm.
4. **6–14 slides** is the healthy range for most decks. Shorter risks thin;
   longer risks losing the room — split into sections or cut beats.
5. Sanity-check the **goal-action ladder**: read titles top to bottom. Do they
   form a single argument that arrives at the `cta`? If a slide doesn't move
   the audience toward the goal-action, cut it.

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
  presenter's intent, not for overflow copy.
- **Titles are messages**, not labels: 「月次で見ると、打ち手が早くなる」, not 「月次推移」.
- A full worked example: `../../examples/seminar-kanrikaikei/deck_plan.json`.

Validate the JSON against the schema before handing off.

## Step 7 — Hand off to create-deck

Pass the validated `deck_plan.json` to **`create-deck`**, which runs
`bin/generate.js` against the project theme and then the mandatory QA loop
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
