---
name: design-doc
description: Use ONCE per project (a repo that uses pptx-creation) to author its DESIGN.md — the persistent deck design system at FULL TEMPLATE LEVEL (see references/design-doc-examples/, ~500 lines; token frontmatter + per-token usage rules + component specs + Do's/Don'ts + Known Gaps): brand + chosen design language, per-audience presets, standing content-integrity (honesty) rules, constraints, the default verification bar, and visual/diagram conventions. deck-brief then reads it and asks only per-deck deltas, so every deck the project ships is on-brand and consistent. This is the project's standing design memory; deck-brief is one deck's intent. A short bullet sketch does NOT satisfy this skill.
---

# design-doc

`deck-brief` captures the intent of **one** deck and asks its questions every
time. Most of those answers don't change between decks — the brand, the design
language, the tone for the board vs a seminar, the honesty rules a company always
applies, the slide caps, the target band. **DESIGN.md is where those live once.**

You author the consuming project's `DESIGN.md`: a **full design-system document
+ deck conventions** for *this* project. With it in place, `deck-brief` reads it
and only asks what's genuinely new per deck (this deck's message and data) — so
decks come out consistent and sharp without re-specifying the brand each time.
Author it once, update it when the brand or rules change.

> **The bar is the examples — not a sketch.** Five reference DESIGN.md files at
> template level live in
> [`../../references/design-doc-examples/`](../../references/design-doc-examples/)
> (Apple / BMW M / Claude / Nike / Slack). **Producing a DESIGN.md at that level
> is REQUIRED**: machine-readable token frontmatter + prose sections where every
> colour token carries a hex AND a usage rule, the full type hierarchy is
> specified, components get per-component specs, Do's/Don'ts carry rationale,
> and unknowns are honestly recorded in Known Gaps. A ~40-line bullet sketch is
> not a deliverable of this skill.

> Scope: this is the DESIGN.md for a **project that uses** pptx-creation, not the
> plugin's own internals. It holds **convention + rationale**, and **points to**
> the machine artifacts — look-and-feel lives in `theme.json` (via `theme-init`,
> M-6), design norms in the plugin's `references/` (M-5). Never hardcode slide
> order or per-deck content here (that's `deck_plan` / `deck-strategy`).

## The artifact — `DESIGN.md` (write it at the project repo root)

**Required structure (template level).** Match the examples' shape and depth,
adapted to the deck surface:

1. **YAML frontmatter** — `name`, a 3-5 sentence `description` capturing the
   brand's voltage (what makes it THIS brand and not a generic deck), then the
   token dump: `colors` (every token, bare hex), `typography` (every role with
   family / size / weight / lineHeight / letterSpacing), `spacing`, `radius`.
   These document the same values `theme.json` encodes for the engine — with
   names and comments a human can review.
2. **Overview** — one tight paragraph: canvas, type voice, where the brand
   voltage comes from, the signature move.
3. **Colors** — every token from the frontmatter, grouped (Brand & Accent /
   Surface / Text / Semantic), each with **hex + WHERE it is used and where it
   is not** (e.g. "アクセントは1面に主役1箇所。カード強調はtint、ストライプ禁止").
4. **Typography** — the hierarchy role by role, the principles (weight-led,
   negative tracking on display sizes, JP leading), and honest **font
   substitutes** (実機にない場合に何へ落ちるか).
5. **Layout** — spacing scale, margins, the whitespace philosophy in words.
6. **Elevation & Depth / Shapes** — shadow policy, radius scale, the motif
   rules (どの隅に何を置いてよいか).
7. **Components** — the DECK surface, per-component: cover, section divider,
   title+kicker, cards (surface/emphasis), charts (unit・強調・▲), tables,
   diagram nodes, footer. What each looks like and when to use it.
8. **§1-7 deck conventions** (below) — audience/voice, design language +
   theme.json pointer, per-audience presets (each preset SHOULD fix its
   register `meta.intent` and person style `meta.personStyle` — e.g. 役員向け=
   financial・人物なし / 受講者向け=education・illustration — so deck-brief
   inherits them as defaults instead of asking), honesty house rules,
   constraints, verification bar, visual/diagram conventions.
9. **Do's and Don'ts** — 7+ each, every line carrying its *why*
   ("クリームが差別化。純白は他社のAIツールに見える" — not "白を使わない").
10. **出力面の挙動** (the deck equivalent of Responsive Behavior) — 16:9
    投影 / PDF配布 / モノクロ印刷 / 低輝度プロジェクタでどう劣化し、何を守るか.
11. **Iteration Guide** — how to change a token safely: DESIGN.md と
    `theme.json` を同時に更新 → 1枚プレビュー再生成 → run-gate.
12. **Known Gaps** — what you could NOT confirm (licensed fonts, unextracted
    states, out-of-scope surfaces). **Never pad gaps with invented brand
    facts** — an honest gap here beats a fabricated token.

The §1-7 deck-convention sections:

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

1. **Read ONE example end-to-end first** from
   [`../../references/design-doc-examples/`](../../references/design-doc-examples/)
   — pick the voice nearest the project (端正=Apple, 剛=BMW M, 温=Claude,
   競技的=Nike, 実務的=Slack). Your output must match that structure and depth;
   do not start writing before you have the shape in your head.
2. **Look for an existing `DESIGN.md`** at the repo root. If present, you are
   *updating* it — read it, confirm what changed, edit in place (don't clobber).
   If it exists but is below template level, upgrading it to the required
   structure IS the job.
3. **Gather the standing facts**, asking only what you can't infer (use the
   question tool, batched ≤4): the brand (who/voice), the recurring audiences,
   and the design leaning (formal vs friendly). Infer sensible defaults for the
   rest and state them. What cannot be confirmed goes to **Known Gaps**, never
   into invented tokens.
4. **Pick the design language** via [`design-language`](../design-language/SKILL.md)
   (audience × usecase → one bookshelf language, or an ad-hoc spec). Record the
   choice + brand tokens in §2.
5. **Seed the theme** — hand the frontmatter tokens to [`theme-init`](../theme-init/SKILL.md)
   so `themes/<name>/theme.json` matches DESIGN.md. DESIGN.md is the *why*;
   theme.json is the *machine tokens the engine reads* — same values, two roles.
6. **Write the standing rules that make decks safe & sharp** — §3 presets, §4
   honesty rules, §5 constraints, §6 bar. These are the highest-value part (below).
7. **Write `DESIGN.md`** at the repo root — full template level (all 12 parts
   of the required structure) — and tell the user it is now the source
   `deck-brief` will read on every deck.

**Completeness check before you call it done** (all must hold):

- [ ] Frontmatter carries EVERY colour/type/spacing/radius token with real values.
- [ ] Every colour token also appears in prose with a usage rule (where / where not).
- [ ] Components covers the whole deck surface (cover〜footer, charts incl. 単位・▲).
- [ ] Do's ≥7 and Don'ts ≥7, each with its why.
- [ ] 出力面の挙動・Iteration Guide・Known Gaps are present and honest.
- [ ] `theme.json` regenerated/confirmed in sync; 1-slide preview rendered and looked at.
- [ ] Rough size sanity: the examples run ~500 lines — if yours is under ~300,
      something above is missing, not "efficiently short".

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
- Author once at **full template level**, update on brand/rule changes. Depth is
  required; padding is not — every line must be a real convention or a real
  token, and honest unknowns live in Known Gaps. A DESIGN.md nobody maintains
  drifts from the theme; the Iteration Guide + frontmatter/`theme.json` sync is
  what keeps it alive.
- **DESIGN.md is the vessel that absorbs correction history.** Its judgment
  calls start as the authoring model's defaults, not the project's taste — the
  calibration comes from shipping. After each deck, fold every 「ここは違う」
  correction the user made into the section it belongs to (a Don't with its
  why, a preset tweak, a §7 convention — e.g. which concept owns the accent
  across decks, the coordinate grammar of `slide-design-principles.md` §8).
  Two or three decks of this and the defaults converge on the project's
  actual taste; a DESIGN.md that never receives corrections isn't finished,
  it's unused.
