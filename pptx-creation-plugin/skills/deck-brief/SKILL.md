---
name: deck-brief
description: Use FIRST when a deck request is vague or partial ("make a deck about X", a dropped transcript, raw numbers with no framing). Turns it into a complete, structured brief — audience, scene, goal-action, one message, data + honesty labels, design language, constraints, verification bar — by asking ONLY the few questions that can't be guessed, then hands off to deck-strategy → create-deck. The intake that sets the quality ceiling.
---

# deck-brief

The engine guards geometry, kinsoku, orphans, overflow, and the AI-tell blocklist
automatically. What it **cannot invent** is intent: who the deck is for, the one
thing it must prove, which numbers are honest, how it should feel. A deck is only
as good as the brief behind it — a vague ask ("いい感じのスライド作って") yields
topic-label titles and a pile of facts; a sharp brief yields a deck that argues.

Your job is to turn whatever the user gave into a **complete brief**, asking the
**fewest** questions possible: ask only for the slots that are both *critical* and
*unguessable*, infer the rest, and **state every default you assumed** so the user
can correct one word instead of re-briefing. You do not choose patterns, colours,
or render anything — you set the intent, then hand off.

## The brief — 11 slots (fill every one)

| Slot | What it fixes | Owner downstream | If missing |
|---|---|---|---|
| **読み手 / audience** | vocabulary, tone, density | deck-strategy §1.1 | **ASK** — can't guess |
| **場面 / scene** | length, on-screen vs read-alone | deck-strategy §1.2 | infer from audience; state it |
| **目的＝行動 / goal-action** | the `cta`; the whole spine | deck-strategy §1.3 | **ASK** — an action, not "understand X" |
| **結論 / one message** | cover promise; every title ladders to it | deck-strategy §1.5 | **ASK** — a conclusion/question, never a label |
| **素材 / material** | the actual copy & numbers (note any process / loop / 2-axis structure) | the deck content | ASK for the data; never fabricate figures |
| **正直ラベル / honesty** | estimate? basis? forecast? metric definition? | house-bar §4, content-integrity | **ASK for any business/financial deck** |
| **構成 / structure** | pattern order & count (incl. flow/cycle/matrix diagrams) | deck-strategy §2–4, §3b | default: "おまかせ" — deck-strategy frames it and **conservatively** decides any diagram (default text) |
| **デザイン / design** | theme / tone | design-language | default: `neutral-business`; or infer/name a shelf language |
| **制約 / constraints** | slide cap, forbiddens, brand/font, output path | all layers | default: 6–14 slides · no invented numbers · Meiryo/Yu Gothic |
| **検証 / verification** | how hard to prove it | create-deck / deck-review | default: run the QA loop + review; `external`(≥90) if outward-facing |
| **レジスター＆人物 / register & persons** | `meta.intent` (financial/board/seminar/education/marketing) → which devices are even allowed (persona・吹き出し・dialogue/testimonial は financial/board で lint ERROR), and `meta.personStyle` (silhouette=格式 / illustration=親しみ — 1デッキ1様式) + 人物素材の有無 (供給 or 機内fallback) | deck-strategy Step 0; assets: `assets/generated/figures/figures-index.md` | infer from audience+scene and **state it** (役員/財務→financial・人物なし; セミナー/教育→education・illustration が既定寄り). Ask only when persons are clearly wanted but no素材/様式が読めない |

## Procedure

1. **Load the project `DESIGN.md` (if present** at the repo root, from
   [`design-doc`](../design-doc/SKILL.md)**).** It pre-fills the *stable* slots —
   **design, the per-audience presets, the honesty house rules, constraints, and
   the verification bar** — so those become **defaults, not questions**. With a
   DESIGN.md, your asks collapse to little more than *which audience preset*, this
   deck's *one message*, and its *data*. No DESIGN.md → default from the plugin as
   below (and suggest running `design-doc` if this repo will make many decks).
2. **Parse what's given.** Map the request onto the 10 slots; mark each *have
   (incl. from DESIGN.md)* / *inferable* / *missing-critical*.
3. **Ask only the critical-unguessable slots**, batched into one round (use the
   question tool, ≤4 items). The usual asks: **audience + scene**, **goal-action
   + one message**, and — for anything with numbers — **which figures are
   estimates / forecasts / non-standard definitions** (beyond the DESIGN.md §4
   rules already applied). Do **not** ask what you can default; do not interrogate
   slot by slot.
4. **Infer the rest and say so**, e.g. "構成はおまかせ（deck-strategy に SCQA で
   組ませます）／デザインは DESIGN.md の neutral-business／register は education・
   人物はイラスト様式（変えるなら silhouette）／12枚以内／出力は Desktop
   — 変えたい所だけ教えてください。"
5. **Emit the filled brief** as a short, scannable block (the 10 slots, noting
   which came from DESIGN.md), so the user sees the whole intent at a glance and
   can veto one line.
6. **Hand off:** for a substantial deck → **deck-strategy** (spine → plan) then
   **create-deck**; if a design language matters, note it for **design-language**.
   For a tiny/one-slide ask you may go straight to create-deck with the brief.

## What moves the needle most

Three slots do the heavy lifting — spend your questions here:

- **結論 (one message).** If each section can be stated as a *claim*, the engine's
  titles become conclusions (house-bar §1) and the deck argues instead of lists.
  Push the user from a topic ("海外について") to a claim ("海外が利益率を底上げしている").
- **正直ラベル.** Labelled estimates / bases / forecasts / metric definitions are
  what carry a business deck into the `external` band (content-integrity §4). An
  unlabelled number is a liability; ask.
- **読み手.** Board vs beginners changes everything — tone, density, which pattern,
  even the design language. Never assume it.

## Weak brief → what the deck becomes (name these back to the user)

- "サンリオのスライド作って" → topic-label titles, fact dump, no goal-action.
  → ask audience + the one claim you want each section to make.
- data pasted with no framing → the deck lists the numbers instead of arguing them.
  → ask what conclusion the data is meant to prove.
- "表紙を派手に、28pt青で左寄せ…" (geometry micro-managed) → fights the floor.
  → capture the *feeling* (e.g. "明るくポップ"), let the engine own geometry.
- "完璧なやつを一発で" → kills the verification loop, the plugin's whole value.
  → set the bar ("QAループを回して external 狙い、直せない崩れは止めて報告").

## The boundary (do not cross it)

- deck-brief captures **intent only**. You do not choose patterns/order (that is
  **deck-strategy**), pick colours/fonts/tokens (**design-language** / the theme,
  M-6), or generate/QA the pptx (**create-deck**). You are the front door.
- Ask the minimum; **default the rest transparently**. A brief the user has to
  fully dictate is a failed intake — infer boldly, then let them correct.
- One perfect brief is not required. The verification loop plus the user's
  real-machine feedback refines it; a first brief that fixes audience, goal-action,
  message, and honesty is already enough to start.
