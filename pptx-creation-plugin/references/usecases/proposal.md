# Usecase: 提案資料 (proposal)

A **usecase guide** for `deck-strategy`. It shapes Steps 2–4 (frame → beat order
→ pattern map) for one deck **type** so the planner doesn't start from a blank
page. It tunes structure and wording only. It **never overrides the house bar**
(`../principles/house-quality-bar.md`), and it **never** picks colors, fonts, or
sizes — those live in the theme (M-6). Pattern names and capacities below are
quoted from `../patterns/catalog.md`; if anything here disagrees with the catalog
or the engine, they win.

---

## 1. When this applies — audience & goal-action

Use this guide when the deck is a **sales / consulting proposal to a client**:
営業・コンサルが、顧客に打ち手を提案し、合意を取り付ける資料。

- **Audience.** 顧客の意思決定者 (a buyer who can say yes — 経営者・部門責任者・決裁者).
  They reason about **cash, risk, and proof**, not features. They are skeptical
  of vendor claims by default, and they will be the one defending this internally.
- **Scene.** 商談・提案の場（対面プレゼン、または持ち帰りのPDF）。Often read again, alone,
  after the meeting — so every claim must stand without you in the room.
- **Goal-action.** **提案の承認、あるいは次商談（PoC・見積精査・稟議へ）への前進。** One
  concrete next step, not "理解してもらう." The `cta` slide *is* that step.
- **Reader psychology.** 「本当に効果が出るのか」「いくらかかるのか」「失敗したら誰が責任を取るのか」。
  They fear being oversold and being wrong in front of *their* boss. Design to
  dissolve that: honest effects, clear cost, named risks — not louder claims.

If you can't state the goal-action and the one main message in a line each, the
input is too vague — ask the user (deck-strategy Step 1), don't guess.

## 2. Recommended narrative frame

**PAS** (Problem · Agitate · Solve) carried inside a **BAB** (Before · After ·
Bridge) shape — `現状 → 課題 → 提案 → 効果 → 費用 → 次の一歩`.

- The buyer must **feel the cost of the status quo** before they'll fund a change
  (PAS), then see the **better state and the path to it** (BAB: 現状=Before,
  あるべき姿=After, 提案=Bridge).
- Because PAS agitates a risk, the agitation **must stay truthful** — apply the
  honesty guards in `../principles/house-quality-bar.md` §4 (label estimates as
  estimates; no unsupported assertions). Overstated pain is the fastest way to
  lose a skeptical decision-maker.
- For a time-boxed executive who wants the answer first, **PREP** is an
  acceptable swap (lead with 提案の要点, then prove it). Pick one frame per beat;
  don't mix frames within a single move (`../principles/slide-design-principles.md` §3).

## 3. Recommended slide sequence

A default spine, ~7 slides. Map beats to patterns by *job*; respect every
`capacity` and **split rather than cram** (catalog.md "Choosing & sequencing").
Sandwich holds: `cover` first, `cta` last; body stays light.

| # | Pattern | Beat | Why this pattern |
|---|---|---|---|
| 1 | `cover` | 提案のタイトル＋相手・日付 | Dark sandwich open; the promise in ≤2 lines (capacity). |
| 2 | `message` | 提案の要点（一言で） | One centered statement = the whole proposal's spine; sets PAS up front. |
| 3 | `comparison` | 現状 vs あるべき姿（Before/After） | Head-to-head is `comparison`'s exact job; put **あるべき姿 on the right** (accent-tinted) as the advocated side. |
| 4 | `two-column` | 提案の中身：全体像＋打ち手 | Overview-on-left + 2–4 打ち手 on the right is `two-column`'s job (3 items ideal, 4 max — a 5th collides with the footer; split). |
| 5 | `chart` *or* `stat-grid` | 効果／ROIを数字で | `chart` for a trend/magnitude (4–7 bars) + one takeaway; `stat-grid` for 2–4 headline KPIs. One takeaway, not a data dump. |
| 6 | `table` | 費用・スケジュール | Precise figures in rows×cols (≤6 rows incl. header, ≤5 cols). Put 前提・単位・基準 in the `note` slot (§4). |
| 7 | `cta` | 次の一歩（行動は1つ） | Dark sandwich close; exactly ONE ask (次商談 or 承認) + how to act. |

**Scaling the spine.**
- **Need both ROI numbers and a trend?** That's two ideas → a `stat-grid` *and* a
  `chart` slide, not one crowded one (slide-design-principles §6).
- **Multiple 打ち手 phases or a long cost breakdown?** Split into two slides before
  shrinking type — never tighten past the bar.
- **8+ slides?** Only then may you add `section` dividers (e.g. 課題 / 提案 / 費用);
  never in a short proposal, never two dark slides adjacent in the body.

## 4. Content cautions (specific to proposals)

These are where proposals fail review (`../principles/house-quality-bar.md` §4,
Content-integrity dimension). A proposal is an **external, trust-bearing** deck.

- **効果は前提条件つきで。** 誇大表現を避ける。Tie every benefit to its assumption and
  label estimates as estimates — `効果：粗利 +約8%（前提：現行3拠点・受注水準が横ばいの場合）`,
  not a bare `粗利+8%`. An unsupported assertion stated as fact (`30%削減できます`)
  fails §4; `約30%削減（試算・前提◯◯）` is honest. This is what earns a skeptical
  buyer's trust — it is the whole point of the frame.
- **費用は明確に。** Don't bury or hand-wave the price. State 初期費用／月額／総額,
  what's included, and the unit — vagueness here reads as hiding something and
  stalls the 稟議. The `table` `note` carries 税抜/税込・期間・前提.
- **リスク／前提を省かない。** Name the risks and the conditions for the effect to
  hold. A proposal that only shows upside reads as a sales pitch, not a plan the
  buyer can defend internally. Honesty *is* the persuasion strategy for this
  audience.
- **Numbers carry their basis.** Every figure on `chart` / `stat-grid` / `table`
  needs a unit and, where relevant, a period or basis (§4). 試算は試算と明示。
- **Titles are conclusions, not labels.** 「費用について」is a label; 「初期費用ゼロ、
  3か月で投資回収」is a message the buyer can agree or disagree with
  (slide-design-principles §4). The `cta` ask is exactly one action — 次商談 *or*
  承認, never a menu (catalog `cta` rule).

## 5. Example deck

**No bundled proposal example exists yet** (the shipped examples are
`../../examples/seminar-kanrikaikei/` and `../../examples/financial-analysis/`).
Until a `examples/proposal-*/` reference render is added, treat the seminar deck
as the nearest model for tone and density.

A proposal deck is generated the **same way as any other**: run `deck-strategy`
with this guide to emit a validated `deck_plan.json`, then hand off to
`create-deck` (which renders with the project theme and runs the mandatory QA
loop, `../principles/house-quality-bar.md` §5). Nothing about this type needs a
special engine path.
