# Usecase: 財務・決算・経営レビュー (Financial / Earnings / Management Review)

A type guide for `deck-strategy`. It shapes **Steps 2–4** (narrative frame →
beat order → pattern mapping) for a financial review deck and flags the content
cautions this type fails on most often. It **never overrides the house bar**
(`../principles/house-quality-bar.md`) and **never sets colours, fonts, or
sizes** — those are the theme's job (M-6). Capacities cited here come from
`../patterns/catalog.md`; the engine is the source of truth for every number.

---

## 1. When this applies

Use this guide when the deck is a **decision/approval document built on the
company's own numbers**: a board pack, a monthly/quarterly management review,
an earnings recap for lenders, or an investor update.

- **Audience** — 経営陣・取締役会・銀行・投資家. They reason about cash, margin, and
  risk, read fast, and will challenge any number that lacks a basis.
- **Usage scene** — a 5–15 minute decision meeting and/or a leave-behind PDF
  that must stand on its own without the presenter.
- **Goal-action** — 意思決定・承認 (approve the下期計画, the price-revision policy, a
  budget envelope). If you can't name the single thing you want **decided**,
  the input is too vague — ask, don't guess (`slide-design-principles.md` §1).
- **Reader psychology** — they assume optimism is being sold to them and will
  discount un-sourced claims. The deck wins by being **honest first**: label
  estimates, state the basis, and show the 要注意 領域 as plainly as the good news.

This is an **internal/external trust document**, so house bar **§4 (content
integrity) applies hard** — it is not optional polish here, it is the point.

## 2. Narrative frame

**結論先行 PREP, with SCQA inside the body.** Executives want the answer first,
so lead with the conclusion (the `message` slide), then lay out the evidence,
then the ask. Within the body, the review arc reads as a small SCQA: 業績は好調
(Situation) → だが原価が上昇している (Complication) → 下期にどう守るか (Question) →
3つの打ち手 (Answer). Don't mix frames within one beat
(`slide-design-principles.md` §3); use PREP as the spine and let SCQA shape the
middle.

## 3. Recommended slide sequence

A 10-slide order (8+ slides, so `section` dividers are allowed). Vary patterns;
never two dark slides adjacent in the body (cover/cta/section are dark).

| # | Pattern | Why this beat |
|---|---|---|
| 1 | `cover` | The promise + scope (期・社内/社外の別). Dark sandwich open. |
| 2 | `message` | 結論を一文で — 増収増益、ただし下期は原価対応が論点。PREP's leading Point. |
| 3 | `section` | 章扉「業績ハイライト」. Marks the evidence chapter (`index` watermark, not a stripe). |
| 4 | `stat-grid` | KPIサマリー (2–4 数値). Headline metrics with prior-period context in `sub`. |
| 5 | `chart` | 推移 (ネイティブ縦棒、編集可) + one takeaway. The trend behind the headline. |
| 6 | `table` | セグメント別 / PL の精緻な数値. Units & basis in `note`. |
| 7 | `comparison` | 順調 vs 要注意 (or 計画 vs 実績). The 論点 made explicit; advocate side on the right. |
| 8 | `section` | 章扉「下期 / 打ち手」. Pivots from evidence to action (SCQA's Question). |
| 9 | `two-column` | 打ち手 (left=全体像/論点, right=3つの具体アクション). |
| 10 | `cta` | 意思決定事項を1スクリーンで. The ask, as the dark sandwich close. |

Respect capacities — split, never cram (`../patterns/catalog.md`,
`slide-design-principles.md` §6):

- `stat-grid`: **3 ideal, 4 max, 2 min**; each `value` short (e.g. 48.2億円 /
  8.4%), prior-period comparison in `sub`.
- `chart`: **4–7 bars** read cleanly (>8 crowds); one chart, one takeaway.
- `table`: **≤ 6 rows incl. header, ≤ 5 columns**; more rows → split (autoPage
  is off by design). Always add a units/basis `note`.
- `comparison`: **4 points ideal, 5 max** per card.
- `two-column`: **3 items ideal, 4 max** (a 5th row collides with the footer).
- `section`: title ≤ 1 line, `index` 1–2 chars; only because this deck is 8+
  slides. A shorter review (6–7 slides) drops the dividers, not the arc.

If the review covers several segments or periods that each need their own
chart/table, **split into more body slides** (or more chapters) rather than
overloading one — two clean slides beat one crowded one.

## 4. Content cautions (house bar §4 — HARD)

These are the failure modes that sink a financial deck even when it renders
cleanly. Every one ties to `house-quality-bar.md` §4 and `chart-design.md` §4.

- **単位・前提・指標定義を必ず明記.** Every figure carries a unit and, where
  relevant, a basis and period — 「百万円（上期実績）」「全社・税抜」「前年同期比」. Put
  them in the `table.note`, the chart series name / `takeaway`, or the
  `stat-grid` `sub` — never nowhere. A number without a basis is a number the
  board won't trust.
- **見通し / 速報 / イメージは必ずラベル.** 速報・社内管理ベース、見込み、推計 must be
  stamped on any figure that isn't audited actuals. 「約60%（イメージ）」 is honest;
  「60%が失敗する」 stated as fact is not (`house-quality-bar.md` §4).
- **根拠のない断定をしない.** No unsupported assertions. If you can't cite the
  source system or the basis, soften the claim or cut it. The titles are still
  conclusions — 「利益の源泉は産業機械セグメント」 — but conclusions the numbers on the
  same slide actually support.
- **グラフの軸を歪めて誇張しない** (`chart-design.md` §4). The column baseline starts
  at zero; never truncate or zoom the y-range to make a 3% move look like a
  cliff. The engine hides the value axis precisely because the **data labels**
  carry the truth — so the labels must be the real numbers.
- **構成比は四捨五入注記.** When a 構成比 / 内訳 column is rounded, add 「構成比は四捨五入
  のため合計が100%にならない場合があります」 to the `table.note`.
- **数値ラベルの精度を実データに合わせる.** The chart's data labels must match the
  precision of the underlying values. Integer-formatted labels on decimal data
  collapse 21.8 and 23.1 into 「22」「23」 of differing bar height — a real
  misread. The engine **auto-keeps one decimal for non-integer data**, but you
  must still feed it the true values and read the render in the QA loop.

These map to the rubric's **Content integrity (10)** and **Information design
(20)** dimensions; a basis-less number or a manipulated axis caps the deck.

## 5. Example deck

A full worked render lives at `../../examples/financial-analysis/`:

- `deck_plan.json` — the exact 10-slide sequence above (FY2026 上期 経営レビュー).
- `deck_review.json` — scored **95/100, cleared external/board**.

Note the QA loop's catch on **slide 5 (chart)**: the first render formatted
decimal sales values with `#,##0`, so 21.8 and 23.1 rounded to labels 「22」/「23」
on visibly different-height bars — a **decimal-label precision break** flagged
`major` and fixed at the engine level (it now auto-keeps one decimal for
non-integer data). That is exactly the §4 caution above, caught by the
mandatory render-and-look loop rather than by hope (`house-quality-bar.md` §5).
