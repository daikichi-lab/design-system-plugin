# text-to-diagram eval — 構図選びの正答率を測る

「文章から関係を読み取り、正しい構図（骨格）を選ぶ」機関の物差し（改善指示 T1）。
6つの境界軸×50問。gold は全て承認済み文書の行に紐づく（発明していない — 各 case.yaml
の `description` に出典）。グレーダーは全て regex（judge費用ゼロ・決定論）。

## 軸（T2 の対ドリルと1対1対応）

| tag | 境界 | 問数 |
|---|---|---|
| formula-identity | formula vs identity（額装トラップ） | 9 |
| flow-steps-timeline | flow vs steps vs timeline（+cycle） | 9 |
| compare-reframe-position | comparison vs before-after vs positioning | 8 |
| count-vs-compare | stat-grid/card-grid vs chart（数えるか比べるか） | 7 |
| branch-vs-formula | branch vs formula（偽の数式） | 6 |
| matrix-vs-comparison | matrix vs comparison（無い軸を見せない） | 6 |
| diagram-gate | 図解しない判定（message/dialogue/table/card-grid） | 5 |

各ケースのグレーダー: `correct-skeleton`（重み2）＋ `not-trap`（その軸の誘惑誤答を
選んでいない・重み1）＋ `struct-word`（構造1語が共通語彙・重み1）。
語彙は design-lint の `STRUCT_WORD_RE` と同一（変更は両方同時に）。

## 実行

```bash
# プラグインルートから（重要 — evals/ を直接指すとプラグイン自動検出が働かない）
cd pptx-creation-plugin
claude plugin eval . --ablation none --json --output-dir evals/results/<name>

# カテゴリ別集計（どの軸が弱いか＝T2ドリル補強の優先順位）
node evals/text-to-diagram/summarize.js evals/results/<name>/aggregate-result.json

# ケースの再生成（SPEC は gen-cases.js 内が単一ソース）
node evals/text-to-diagram/gen-cases.js
```

注意:
- `claude plugin eval` は early access ゲート（GrowthBook `tengu_walnut_spire`）の
  背後にある。閉じている環境では `~/.claude.json` の `cachedGrowthBookFeatures` に
  `"tengu_walnut_spire": true` を注入すると開く（ローカル開発用途）。
- runs=1/ケース（コスト優先）。スコアのばらつきを見たいときは `--runs 3`。
- コスト目安: 1ケース ≈ $0.2 → 50問 ≈ $10。`--max-cost-usd` を付けて回すこと。

## ベースライン記録

| 日付 | コミット | 条件 | 総合 | 弱い軸（骨格正答率の低い順） |
|---|---|---|---|---|
| 2026-07-09 | T2/T3適用**前**（Release 0.6.0 直後） | ablation none / runs 1 / $12.23 / 57分 | **0.74** | compare-reframe-position **38%** ／ formula-identity **44%**（額装トラップ）／ branch-vs-formula **67%** ／ flow-steps-timeline 89% ／ count-vs-compare・diagram-gate・matrix-vs-comparison 100% |

生ログ: `evals/results/baseline-2026-07-09/aggregate-result.json`。
読み: 改善指示 §0 根本原因Aの診断どおり、額装トラップ（formula vs identity）と
再フレーム境界（comparison vs before-after vs positioning）が弱点。T2の対1・対3が
最優先の補強対象で、T4（在庫）より先にT2/T3が効く見込み、という優先順位も
この数字から確定した。

## 検証プロトコル（合格線は走らせる前に決める — 数字を見てから解釈すると較正にならない）

**分散対策（必須）**: 被験側の `claude -p` は温度を固定できない（CLIにtemp指定なし＝
非決定的）。regexグレーダーが決定的でも1runの結果は揺れる — 1軸6〜9問では1問≈11〜17pt。
したがって after 計測は **`--runs 3`** で回し、軸スコアは3run平均で読む。

**事前固定の合格線（2026-07-09、after実行前に記録）**:
- formula-identity（額装）: 骨格正答率 **≥65%**（before 44%）
- compare-reframe-position（再フレーム）: 骨格正答率 **≥60%**（before 38%）
- 総合 **≥0.80**（before 0.74）— 副次指標
- 他の軸が5pt超**下がって**いないこと（ドリル追加の副作用検知）

**エスカレーション規則（引き金を間違えない）**:
- 合格線を越えた → PR（説明文に before/after 両方を記載）
- 越えない → **T2/T3を研ぐ**（弱い境界の対ドリル精度を上げる／その境界専用の判定
  サブ手順を Step 3b に足す）。**T4には行かない** — T4（document-mock/coverage）は
  根本原因B＝在庫不足の解であり、この2境界は骨格が既に在って選び間違えている
  だけ（別の症状）。T4の実装優先度は「実デッキがGAPにヒットした頻度」
  （docs/canon GAP台帳のヒット記録）という別トラッキングで判断する。

**依存の監視**: この物差しは early-access ゲートのフラグ注入に依存している
（上の注意参照）。CLI更新で注入が壊れると物差しごと止まるため、長時間runの前に
必ず `--case smoke` の1問プリフライトでゲート開通を確認すること。

改善の検証手順: T2（対ドリル）・T3（分解シート）適用後に同条件で再実行し、
ベースライン表に行を足して前後比較する。スキル文言を変えるたびにここが回帰になる。
