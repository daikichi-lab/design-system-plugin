---
name: design-doc
description: Use ONCE per project (a repo that uses pptx-creation) to author its DESIGN.md — the persistent deck design system: brand + chosen design language, per-audience presets, standing content-integrity (honesty) rules, constraints, the default verification bar, and visual/diagram conventions (chart units + emphasis, when to diagram, icons/motifs). deck-brief then reads it and asks only per-deck deltas, so every deck the project ships is on-brand and consistent. This is the project's standing design memory; deck-brief is one deck's intent.
---

# design-doc

`deck-brief` captures the intent of **one** deck and asks its questions every
time. Most of those answers don't change between decks — the brand, the design
language, the tone for the board vs a seminar, the honesty rules a company always
applies, the slide caps, the target band. **DESIGN.md is where those live once.**

You author the consuming project's `DESIGN.md`: a short, human-readable **design
system + deck conventions** for *this* project. With it in place, `deck-brief`
reads it and only asks what's genuinely new per deck (this deck's message and
data) — so decks come out consistent and sharp without re-specifying the brand
each time. Author it once, update it when the brand or rules change.

> Scope: this is the DESIGN.md for a **project that uses** pptx-creation, not the
> plugin's own internals. It holds **convention + rationale**, and **points to**
> the machine artifacts — look-and-feel lives in `theme.json` (via `theme-init`,
> M-6), design norms in the plugin's `references/` (M-5). Never hardcode slide
> order or per-deck content here (that's `deck_plan` / `deck-strategy`).

## The artifact — `DESIGN.md` (write it at the project repo root)

```markdown
# DESIGN.md — <project/company> deck design system

## 1. 誰に・どんな声で
- 発信者: <会社/部署>
- 主要オーディエンス: <取締役会 / 金融機関 / 顧客セミナー / 社内 …>
- 声・トーン: <端正で控えめ / 親しみやすく前向き …>

## 2. デザイン言語とブランド
- 採用言語: <neutral-business | swiss | editorial | … | ad-hoc>   ← design-language で決定
- ブランド色: primary #___ / accent #___ / (任意) 2色目 #___
- フォント: <游ゴシック | BIZ UDGothic | …>
- theme.json: themes/<name>/theme.json   ← theme-init が生成（この節が入力）

## 3. オーディエンス別プリセット
| オーディエンス | 言語/テーマ | トーン | 目標band | 密度 | 既定frame |
|---|---|---|---|---|---|
| 取締役会/金融機関 | neutral-business | 端正 | external(≥90) | 低 | PREP |
| 顧客セミナー | editorial | 親しみ | internal+ | 中 | SCQA |

## 4. コンテンツ整合の house rules（常設の正直さ）
- <会社予想は必ず「会社予想」と明示>
- <ROEは採用値◯◯%。決算短信の別定義△△%と区別して注記>
- <社内管理ベースの概算値には「概算」ラベル>
- 免責定型文: "<…投資助言ではありません 等>"

## 5. 制約・禁止
- 標準枚数: <8–14>
- 禁止: <実在キャラIP不可 / 与えていない数値の捏造不可 / …>
- フッターbrand: "<会社名>"
- 出力先: <outputs/ | Desktop>

## 6. 検証バー（既定）
- 既定: bake→generate→design-lint→typo-lint→image-lint→QAループ→deck-review
- 目標band: 対外=external(≥90) / 社内=internal 以上。直せない崩れは止めて報告（M-4）

## 7. 視覚・図解の方針（standing visual conventions）
- チャート: 単位は常に明示（unit）／要点は1本だけ強調（emphasizeIndex）／連続量は線（chartType:line）／必要なら参照線（前年・目標＝targetLine）。
- 図解（flow/cycle/matrix）: **保守的＝既定はテキスト**。構造が1語で言える時だけ（手順=flow／循環=cycle／2軸=matrix）。この案件で頻出する構造: <例: 申込フロー=flow ／ なし>。迷えばテキスト。
- アイコン/モチーフ: <使う（statの脇に統一線幅アイコン）／使わない>。装飾は隅・帯限定で可読性優先。
- 構図: 採用言語の `theme.layout`（カード形状・kicker・章番号）に従う（§2で言語を選べば自動）。
```

## Procedure

1. **Look for an existing `DESIGN.md`** at the repo root. If present, you are
   *updating* it — read it, confirm what changed, edit in place (don't clobber).
2. **Gather the standing facts**, asking only what you can't infer (use the
   question tool, batched ≤4): the brand (who/voice), the recurring audiences,
   and the design leaning (formal vs friendly). Infer sensible defaults for the
   rest and state them.
3. **Pick the design language** via [`design-language`](../design-language/SKILL.md)
   (audience × usecase → one bookshelf language, or an ad-hoc spec). Record the
   choice + brand tokens in §2.
4. **Seed the theme** — hand §2's brand tokens to [`theme-init`](../theme-init/SKILL.md)
   so `themes/<name>/theme.json` matches DESIGN.md. DESIGN.md is the *why*;
   theme.json is the *tokens*.
5. **Write the standing rules that make decks safe & sharp** — §3 presets, §4
   honesty rules, §5 constraints, §6 bar. These are the high-value part (below).
6. **Write `DESIGN.md`** at the repo root and tell the user it is now the source
   `deck-brief` will read on every deck.

## What moves the needle most

Two sections make every future deck better with zero extra per-deck effort:

- **§3 per-audience presets.** "取締役会 → neutral-business / 端正 / external /
  PREP" means a deck-brief that just says "for the board" inherits the right
  language, tone, density, band, and narrative frame. This is what turns
  consistency from a hope into a default.
- **§4 honesty house rules.** A company's standing "always label 会社予想 / ROE
  採用値 / 概算" is exactly what carries business decks into the `external` band
  (house bar §4). Written once here, applied to every deck automatically.

## How it composes (the whole point)

```text
design-doc  ─►  DESIGN.md (project: brand, presets, honesty rules, constraints, bar)
                    │  read by ▼
deck-brief  ─►  fills the STABLE slots from DESIGN.md, asks only the per-deck
                delta (this deck's message + data) ─► deck-strategy ─► create-deck
```

DESIGN.md × deck-brief is the precision multiplier: the project's standing design
system + this deck's specific intent → a deck that is both on-brand and on-point.

## The boundary (do not cross it)

- DESIGN.md is **convention + rationale for one project**, human-readable. It
  **points to** `theme.json` for look-and-feel (M-6) and the plugin's
  `references/` for design norms (M-5) — it does not restate or fork them.
- It carries **no slide order and no per-deck content** — those are `deck-strategy`
  / `deck_plan`. If you're writing "slide 3 says…", that belongs in a deck, not here.
- Author once, keep it short, update on brand/rule changes. A DESIGN.md nobody
  maintains drifts from the theme; keep §2 and `theme.json` in sync.
