#!/usr/bin/env node
/* gen-cases.js — text-to-diagram eval suite generator.
 *
 * SPEC is the single source of truth for the 50 cases. Each case:
 *   - sentence + context  -> execution.prompt (fixed 3-line answer format)
 *   - gold                -> regex graders (all free — no LLM judge):
 *       correct-skeleton  (weight 2, contains)
 *       not-trap          (weight 1, not_contains — the axis's tempting wrong answer)
 *       struct-word       (weight 1, contains — taxonomy word, synonyms allowed)
 *   - source              -> the approved doc row the gold is anchored to
 *     (発明しない: every gold traces to text-to-diagram-examples.md,
 *      docs/canon/accounting-fp-insurance.md, diagram-recipes.md, catalog.md,
 *      or an approved deck's notes)
 *
 * Regenerate:  node gen-cases.js      (idempotent — rewrites <slug>/case.yaml)
 * Run:         claude plugin eval evals/text-to-diagram --ablation none
 * Summarize:   node summarize.js <aggregate-result.json>
 */
const fs = require("fs");
const path = require("path");

const PATTERN_LIST =
  "identity / formula / flow / steps / timeline / cycle / comparison / before-after / " +
  "positioning / matrix / branch / waterfall / breakeven / system / relation / " +
  "chart-bar / chart-line / chart-column / chart-band / chart-pie / " +
  "stat-grid / card-grid / table / message / dialogue / testimonial";

const promptFor = (c) =>
  `あなたは pptx-creation プラグインのスライド構成プランナーです。次の原稿の一文に最適な「構図」を1つ判定してください。

判定基準は、プラグインの deck-strategy スキル（特に Step 3b の保守ゲート：構造を1語で言えなければ図解しない）と、その参照文書 references/graphics/text-to-diagram-examples.md・references/graphics/diagram-recipes.md に従うこと。必要ならスキル・参照文書を読んでよいが、デッキプランは作らない。

文脈: ${c.context}
原稿の文: 「${c.sentence}」

出力は次の3行のみ（前置き・後書きは書かない）:
構造: <構造1語>
骨格: <パターンID>
理由: <1行>

パターンIDは次から必ず1つだけ選ぶ（チャートは必ずサブタイプ付きの形で書く）: ${PATTERN_LIST}`;

// ---- taxonomy synonyms (MUST stay aligned with design-lint STRUCT_WORD_RE,
//      T2 の対ドリルの「構造1語」列, and docs/canon の正準形カタログ) ----
const W = {
  identity: "等式|内訳|構成",            // 等式 は 恒等式 も部分一致で拾う
  formula: "因数分解|掛け算|数式|乗算",
  flow: "順序|手順|流れ",
  steps: "段階|階段|ステップ",
  timeline: "時系列|年表",
  cycle: "ループ|循環|繰り返し|サイクル",
  comparison: "対比|比較",
  beforeAfter: "再フレーム|リフレーム|誤解|訂正",
  positioning: "ポジション|位置取り|立ち位置",
  matrix: "2軸|二軸|象限",
  branch: "分岐|展開|集約",
  ranking: "規模|比較|ランキング",
  trend: "推移|トレンド|時系列",
  share: "構成比|割合|シェア",
  parallel: "並列|列挙",
  single: "単一|一点|ひとつ",
  voice: "声|共感|会話",
  precise: "精密|正確|表",
};

// gold.skel / gold.trap are REGEX FRAGMENTS matched after 骨格[:：]
const SPEC = [
  // ============ Axis A: formula vs identity (額装トラップ) — 9 ============
  { slug: "fi-01-bs", tag: "formula-identity",
    context: "FP向けセミナー。家計のバランスシートの導入。",
    sentence: "持ち物から借金を引いた残りが、正味の財産です",
    gold: { skel: "identity", trap: "formula", struct: W.identity },
    source: "text-to-diagram-examples.md 行1（BS＝identity・formulaは額装）" },
  { slug: "fi-02-strac", tag: "formula-identity",
    context: "経営者向け会計セミナー。お金のブロックパズル（STRAC）の説明。",
    sentence: "売上は変動費と粗利に分かれ、粗利から固定費を引いた残りが利益です",
    gold: { skel: "identity", trap: "formula", struct: W.identity },
    source: "text-to-diagram-examples.md 行2（STRAC＝identity+sub）" },
  { slug: "fi-03-sales", tag: "formula-identity",
    context: "営業戦略の資料。売上を伸ばすレバーの整理。",
    sentence: "売上は客数×客単価×店舗数で決まります",
    gold: { skel: "formula", trap: "identity", struct: W.formula },
    source: "text-to-diagram-examples.md 行3（売上分解＝formula）" },
  { slug: "fi-04-tedori", tag: "formula-identity",
    context: "FPセミナー。手取りの説明（収入を100とした例）。",
    sentence: "収入100のうち30が税と社会保険に消え、残りの70が手取りです",
    gold: { skel: "identity", trap: "formula", struct: W.identity },
    source: "docs/canon FP行「額面→手取りの分解＝identity」＋Day1承認デッキP28" },
  { slug: "fi-05-dupont", tag: "formula-identity",
    context: "財務研修。ROEの構造の説明。",
    sentence: "ROEは、利益率×回転率×レバレッジの3つに分解できます",
    gold: { skel: "formula", trap: "identity", struct: W.formula },
    source: "diagram-recipes.md formula（ROEデュポン分解）" },
  { slug: "fi-06-cost", tag: "formula-identity",
    context: "経営会議資料。コスト構造の議論（どちらが大きいかが論点）。",
    sentence: "コストの内訳は、固定費が6割、変動費が4割です",
    gold: { skel: "identity", trap: "formula", struct: W.identity },
    source: "text-to-diagram-examples.md アンチパターン（内訳の大きさが論点なら常にidentity）" },
  { slug: "fi-07-kakekin", tag: "formula-identity",
    context: "保険提案資料。掛金の中身の説明。",
    sentence: "毎月の掛金は、保障の部分と積立の部分でできています",
    gold: { skel: "identity", trap: "formula", struct: W.identity },
    source: "docs/canon 保険行「掛金の内訳＝identity」" },
  { slug: "fi-08-nenkin", tag: "formula-identity",
    context: "FPセミナー。公的年金制度の全体像。",
    sentence: "公的年金は、1階の国民年金、2階の厚生年金、3階の企業年金が積み上がった構造です",
    gold: { skel: "identity", trap: "steps", struct: W.identity },
    source: "docs/canon FP行「公的年金の階層＝identity（値なし等分可）」" },
  { slug: "fi-09-target", tag: "formula-identity",
    context: "営業計画。売上目標の逆算の説明。",
    sentence: "売上目標は、平均単価×必要販売数として逆算します",
    gold: { skel: "formula", trap: "identity", struct: W.formula },
    source: "docs/canon 会計行「売上の分解（客数×単価）＝formula」の同型" },

  // ============ Axis B: flow vs steps vs timeline (+cycle) — 9 ============
  { slug: "fst-01-keiyaku", tag: "flow-steps-timeline",
    context: "サービス案内。手続きの流れの説明。",
    sentence: "申込→審査→契約→納品の順で手続きが進みます",
    gold: { skel: "flow", trap: "steps", struct: W.flow },
    source: "text-to-diagram-examples.md 行6（順序＝flow）" },
  { slug: "fst-02-career", tag: "flow-steps-timeline",
    context: "採用説明会。キャリアパスの説明（役割のレベルが上がる）。",
    sentence: "担当者から始まり、主任、課長、部長へと役割が積み上がっていきます",
    gold: { skel: "steps", trap: "flow", struct: W.steps },
    source: "diagram-recipes.md steps（LEVELが上がる階段＝steps、単なる順序はflow）" },
  { slug: "fst-03-enkaku", tag: "flow-steps-timeline",
    context: "会社案内。沿革のページ。",
    sentence: "2014年に創業し、2018年に法人化、2023年に東京へ本社を移しました",
    gold: { skel: "timeline", trap: "flow", struct: W.timeline },
    source: "diagram-recipes.md timeline（日付が軸＝timeline）" },
  { slug: "fst-04-road", tag: "flow-steps-timeline",
    context: "FP向け講座。学習ロードマップ（到達点に向かって積み上がる）。",
    sentence: "まず個人のBSを読めるようになり、次に法人の決算書へ進み、最後は社長の相談役という到達点に至ります",
    gold: { skel: "steps", trap: "(flow|timeline)", struct: W.steps },
    source: "diagram-recipes.md steps（目標へ積み上がる学習ロードマップ）" },
  { slug: "fst-05-monthly", tag: "flow-steps-timeline",
    context: "経営者向けセミナー。月次の数字の習慣の説明（毎月繰り返す）。",
    sentence: "毎月、記帳→月次チェック→打ち手の見直しを繰り返します",
    gold: { skel: "cycle", trap: "flow", struct: W.cycle },
    source: "deck-strategy Step 3b（真にループするならcycle、しないならflow）" },
  { slug: "fst-06-onboard", tag: "flow-steps-timeline",
    context: "営業資料。初回契約までの進み方。",
    sentence: "初回面談のあと、ヒアリング、提案、契約と進みます",
    gold: { skel: "flow", trap: "steps", struct: W.flow },
    source: "diagram-recipes.md flow（順序が意味を運ぶ）" },
  { slug: "fst-07-seido", tag: "flow-steps-timeline",
    context: "制度解説資料。制度の変遷。",
    sentence: "この制度は2001年の導入から、2008年の改正、2014年の拡充を経て、2024年の新制度へと変わってきました",
    gold: { skel: "timeline", trap: "(flow|steps)", struct: W.timeline },
    source: "diagram-recipes.md timeline（制度の変遷＝dated milestones）" },
  { slug: "fst-08-lifestage", tag: "flow-steps-timeline",
    context: "保険セミナー。ライフステージと必要保障の話（人生の時間軸に沿った段階）。",
    sentence: "保障の見直しどきは、独身期、子育て期、教育期、退職期と、ライフステージごとに訪れます",
    gold: { skel: "timeline", trap: "matrix", struct: W.timeline },
    source: "docs/canon 保険行「ライフステージ×必要保障：段階なら年表」" },
  { slug: "fst-09-pdca", tag: "flow-steps-timeline",
    context: "業務改善研修。改善サイクルの説明。",
    sentence: "計画を立て、実行し、振り返り、また計画に戻る——この繰り返しです",
    gold: { skel: "cycle", trap: "flow", struct: W.cycle },
    source: "diagram-recipes.md cycle（PDCA＝ループ）" },

  // ==== Axis C: comparison vs before-after vs positioning — 8 ====
  { slug: "cbp-01-oldnew", tag: "compare-reframe-position",
    context: "保険提案。2つの型の違いを理解してもらう。",
    sentence: "従来の掛け捨て型と、新しい積立型を並べて比べてみましょう",
    gold: { skel: "comparison", trap: "positioning", struct: W.comparison },
    source: "catalog.md comparison（A vs B・old vs new）" },
  { slug: "cbp-02-gokai", tag: "compare-reframe-position",
    context: "経営者向け会計セミナー。よくある思い込みを解く。",
    sentence: "「会計は税理士の仕事」と思われがちですが、実は社長自身の意思決定の道具です",
    gold: { skel: "before-after", trap: "comparison", struct: W.beforeAfter },
    source: "catalog.md before-after（誤解→訂正のリフレーム）" },
  { slug: "cbp-03-3plans", tag: "compare-reframe-position",
    context: "商品提案。3プランから1つを薦める。",
    sentence: "松・竹・梅の3つのプランのうち、御社に薦めるのは竹です",
    gold: { skel: "positioning", trap: "comparison", struct: W.positioning },
    source: "catalog.md positioning（2-3案＋VS verdict）" },
  { slug: "cbp-04-minaoshi", tag: "compare-reframe-position",
    context: "保険の見直し提案。数字の前後比較（誤解の訂正ではない）。",
    sentence: "見直し前は月3万円だった保険料が、見直し後は同じ保障のまま月2.2万円になりました",
    gold: { skel: "comparison", trap: "before-after", struct: W.comparison },
    source: "catalog.md comparison when_use=before/after（before-afterは誤解の訂正専用）＋docs/canon 保険行「見直し前後」" },
  { slug: "cbp-05-market", tag: "compare-reframe-position",
    context: "事業戦略資料。市場での立ち位置の説明。",
    sentence: "大手代理店は商品数で勝負、ネット系は価格で勝負。私たちは「数字の相談」で勝負します",
    gold: { skel: "positioning", trap: "comparison", struct: W.positioning },
    source: "diagram-recipes.md positioning（同一市場の代替ポジション）" },
  { slug: "cbp-06-slogan", tag: "compare-reframe-position",
    context: "資産形成セミナー。考え方の転換を促す。",
    sentence: "「貯蓄から投資へ」ではなく、正しくは「把握から配分へ」だと私は考えます",
    gold: { skel: "before-after", trap: "comparison", struct: W.beforeAfter },
    source: "catalog.md before-after（同じものを二度見る再フレーム）" },
  { slug: "cbp-07-kirikuchi", tag: "compare-reframe-position",
    context: "法人保険の提案準備。アプローチの選択。",
    sentence: "節税の切り口と保障の切り口、どちらで提案するかを並べて比べます",
    gold: { skel: "comparison", trap: "positioning", struct: W.comparison },
    source: "catalog.md comparison（頭同士の比較はcomparison、市場の位置取りではない）" },
  { slug: "cbp-08-vs", tag: "compare-reframe-position",
    context: "会社紹介。競合との違いの説明。",
    sentence: "競合A社は価格で、B社は品揃えで選ばれています。当社は伴走支援で選ばれています",
    gold: { skel: "positioning", trap: "comparison", struct: W.positioning },
    source: "diagram-recipes.md positioning（2-3 positions side-by-side）" },

  // ============ Axis D: stat-grid vs chart（数える vs 比べる） — 7 ============
  { slug: "cc-01-3shikin", tag: "count-vs-compare",
    context: "FPセミナー。人生の3大資金の紹介（並列の提示）。",
    sentence: "教育資金、住宅資金、老後資金——人生には3つの大きなお金がかかります",
    gold: { skel: "(card-grid|stat-grid)", trap: "chart", struct: W.parallel },
    source: "text-to-diagram-examples.md 行12（並列に図は不要・数えられる形で十分）" },
  { slug: "cc-02-suii", tag: "count-vs-compare",
    context: "月次報告。売上の伸びを見せる。",
    sentence: "売上はこの6か月、右肩上がりで伸びています",
    gold: { skel: "chart-(line|column)", trap: "stat-grid", struct: W.trend },
    source: "docs/canon 会計行「月次・四半期推移＝chart column/line」" },
  { slug: "cc-03-kpi", tag: "count-vs-compare",
    context: "期初キックオフ。今期の目標数値の提示。",
    sentence: "今期の到達点は、売上4.8億円、粗利率34%、新規12社の3つです",
    gold: { skel: "stat-grid", trap: "chart", struct: W.parallel },
    source: "catalog.md stat-grid（2-4 KPI・headline numbers）" },
  { slug: "cc-04-scale", tag: "count-vs-compare",
    context: "FP向けセミナー。担い手の規模の違いを見せる。",
    sentence: "税理士は約8万人、FP資格者は延べ173万人と、担い手の数はまるで違います",
    gold: { skel: "chart-bar", trap: "stat-grid", struct: W.ranking },
    source: "text-to-diagram-examples.md 行9（規模比較＝chart bar・実寸比例）" },
  { slug: "cc-05-share", tag: "count-vs-compare",
    context: "事業報告。売上の構成の説明。",
    sentence: "売上の構成は、主力事業が7割、新規事業が2割、その他が1割です",
    gold: { skel: "chart-(band|pie)", trap: "(stat-grid|card-grid)", struct: W.share },
    source: "docs/canon 会計行「セグメント構成比＝100%帯」" },
  { slug: "cc-06-quarter", tag: "count-vs-compare",
    context: "四半期レビュー。期ごとの売上の凹凸を見せる。",
    sentence: "四半期ごとの売上を並べると、Q3の落ち込みが目立ちます",
    gold: { skel: "chart-(column|bar)", trap: "table", struct: W.trend },
    source: "docs/canon 会計行「月次・四半期推移＝chart」＋chart-design（emphasizeIndexで谷を主役に）" },
  { slug: "cc-07-yakusoku", tag: "count-vs-compare",
    context: "セミナー冒頭。参加のお願い3つ（順序はない）。",
    sentence: "今日のお願いは、顔出し、コメント、投稿の3つです",
    gold: { skel: "card-grid", trap: "flow", struct: W.parallel },
    source: "text-to-diagram-examples.md 行6の逆（特徴の羅列はflow不可）＋Day1承認デッキP2" },

  // ============ Axis E: branch vs formula — 6 ============
  { slug: "bf-01-kessansho", tag: "branch-vs-formula",
    context: "会計セミナー。決算書の全体像。",
    sentence: "決算書は、貸借対照表、損益計算書、キャッシュフロー計算書の3つに分かれます",
    gold: { skel: "branch", trap: "formula", struct: W.branch },
    source: "diagram-recipes.md branch（一つの決算書→三表）" },
  { slug: "bf-02-torae", tag: "branch-vs-formula",
    context: "営業研修。売上の因数分解の考え方。",
    sentence: "売上を、客数と客単価の掛け算としてとらえ直します",
    gold: { skel: "formula", trap: "branch", struct: W.formula },
    source: "docs/canon 会計行「売上の分解＝formula」" },
  { slug: "bf-03-converge", tag: "branch-vs-formula",
    context: "経営判断の話。3つの入力が1つに合流する。",
    sentence: "現場の声、月次の数字、業界動向——この3つを合わせて経営判断が生まれます",
    gold: { skel: "branch", trap: "formula", struct: W.branch },
    source: "diagram-recipes.md branch direction:converge（N→1）" },
  { slug: "bf-04-tenkai", tag: "branch-vs-formula",
    context: "経営計画。基本戦略から打ち手への展開。",
    sentence: "基本戦略は、新規開拓、既存深耕、紹介獲得の3つの打ち手に展開します",
    gold: { skel: "branch", trap: "card-grid", struct: W.branch },
    source: "diagram-recipes.md branch（戦略→打ち手：共通の源がある1→N）" },
  { slug: "bf-05-fake", tag: "branch-vs-formula",
    context: "サービス紹介。比喩としての「掛け算」（本物の数式ではない）。",
    sentence: "顧客満足は、商品力と対応力と価格の「掛け算」です",
    gold: { skel: "card-grid", trap: "formula", struct: W.parallel },
    source: "diagram-recipes.md formula guard（実在しない等式をでっち上げない＝偽の数式禁止）" },
  { slug: "bf-06-shiten", tag: "branch-vs-formula",
    context: "決算書の読み方講座。1枚から3つの視点を引き出す。",
    sentence: "1枚の決算書から、収益性、安全性、成長性の3つの視点を引き出します",
    gold: { skel: "branch", trap: "matrix", struct: W.branch },
    source: "diagram-recipes.md branch diverge（1→N）" },

  // ============ Axis F: matrix vs comparison — 6 ============
  { slug: "mc-01-risk", tag: "matrix-vs-comparison",
    context: "FPセミナー。リスクへの備え方の仕分け。",
    sentence: "リスクは、起きる頻度と影響の大きさの2軸で、保険で備えるか貯蓄で備えるかを仕分けます",
    gold: { skel: "matrix", trap: "comparison", struct: W.matrix },
    source: "docs/canon FP行「リスクの4象限＝matrix」" },
  { slug: "mc-02-seido", tag: "matrix-vs-comparison",
    context: "制度改正の解説。新旧を項目ごとに突き合わせる。",
    sentence: "新旧2つの制度を、項目ごとに突き合わせて違いを見ます",
    gold: { skel: "(comparison|table)", trap: "matrix", struct: W.comparison },
    source: "catalog.md comparison（2つの対比はcomparison、2軸ではない）" },
  { slug: "mc-03-impact", tag: "matrix-vs-comparison",
    context: "経営会議。打ち手の優先順位づけ。",
    sentence: "打ち手を、効果と工数の2軸で4つに分類しましょう",
    gold: { skel: "matrix", trap: "card-grid", struct: W.matrix },
    source: "diagram-recipes.md matrix（効果×工数）" },
  { slug: "mc-04-swot", tag: "matrix-vs-comparison",
    context: "経営計画。自社の棚卸し。",
    sentence: "強み・弱み・機会・脅威の4つの象限で、自社を棚卸しします",
    gold: { skel: "matrix", trap: "card-grid", struct: W.matrix },
    source: "diagram-recipes.md matrix（SWOT＝fixed 2x2）" },
  { slug: "mc-05-chobo", tag: "matrix-vs-comparison",
    context: "業務相談。2つの選択肢の比較。",
    sentence: "紙の帳簿とクラウド会計、どちらがあなたの会社に向いているかを比べます",
    gold: { skel: "comparison", trap: "(matrix|positioning)", struct: W.comparison },
    source: "catalog.md comparison（A vs B）＋deck-strategy Step 3b（2つの比較はmatrixではない）" },
  { slug: "mc-06-kokyaku", tag: "matrix-vs-comparison",
    context: "営業戦略。顧客の分類。",
    sentence: "顧客を、売上規模と関与度の2軸で4つのタイプに分けます",
    gold: { skel: "matrix", trap: "relation", struct: W.matrix },
    source: "diagram-recipes.md matrix（独立2軸→四象限）" },

  // ============ Axis G: 図解ゲート（text か diagram か） — 5 ============
  { slug: "dg-01-single", tag: "diagram-gate",
    context: "経営セミナー。1つの数字を突きつける。",
    sentence: "後継者が決まっていない会社は、この国に127万社あります",
    gold: { skel: "message", trap: "(chart|stat-grid)", struct: W.single },
    source: "text-to-diagram-examples.md 行10（単一の数字＝message+stat）" },
  { slug: "dg-02-voice", tag: "diagram-gate",
    context: "セミナー序盤。聴衆の心の声を代弁する。",
    sentence: "「会計って、難しそう…」と感じますよね",
    gold: { skel: "dialogue", trap: "card-grid", struct: W.voice },
    source: "text-to-diagram-examples.md 行11（声・共感＝dialogue、learner系限定）" },
  { slug: "dg-03-precise", tag: "diagram-gate",
    context: "保険プランの提示。前提つきの正確な数字が必要。",
    sentence: "プラン別の保険料は、年齢と期間の前提つきで、正確な数字でお見せします",
    gold: { skel: "table", trap: "chart", struct: W.precise },
    source: "docs/canon 保険行「商品・プラン比較＝table（保険料は前提必須）」" },
  { slug: "dg-04-features", tag: "diagram-gate",
    context: "サービス紹介。特徴の列挙（順序はない）。",
    sentence: "このサービスの特徴は、迅速、正確、伴走の3つです",
    gold: { skel: "card-grid", trap: "flow", struct: W.parallel },
    source: "diagram-recipes.md flow guard（特徴の羅列はflow不可＝並列）" },
  { slug: "dg-05-pivot", tag: "diagram-gate",
    context: "セミナー中盤の転換点。ここで空気を変える。",
    sentence: "ここで、考え方を180度変えてほしいのです",
    gold: { skel: "message", trap: "before-after", struct: W.single },
    source: "catalog.md message（a pivot＝単一主張・図解不要）" },
];

// ---- emit ----
const root = __dirname;
let n = 0;
for (const c of SPEC) {
  const dir = path.join(root, c.slug);
  fs.mkdirSync(dir, { recursive: true });
  const caseObj = {
    schema_version: "1.1",
    name: c.slug,
    description: `gold=${c.gold.skel} — ${c.source}`,
    tags: [c.tag],
    runs: 1,
    execution: {
      prompt: promptFor(c),
      max_turns: 10,
      timeout_seconds: 300,
      allowed_tools: ["Skill", "Read", "Grep", "Glob"],
    },
    graders: [
      { type: "regex", name: "correct-skeleton",
        pattern: `骨格[:：]\\s*[\`"'「]?(?:${c.gold.skel})`, match: "contains", weight: 2 },
      { type: "regex", name: "not-trap",
        pattern: `骨格[:：]\\s*[\`"'「]?(?:${c.gold.trap})`, match: "not_contains", weight: 1 },
      { type: "regex", name: "struct-word",
        pattern: `構造[:：].*(?:${c.gold.struct})`, match: "contains", weight: 1 },
    ],
    expected_outcome: `構造1語=${c.gold.struct.split("|")[0]} / 骨格=${c.gold.skel}`,
  };
  // case.yaml: JSON is valid YAML — emit JSON for lossless round-trip.
  fs.writeFileSync(path.join(dir, "case.yaml"), JSON.stringify(caseObj, null, 2) + "\n");
  n++;
}
console.log(`wrote ${n} cases under ${root}`);
if (n !== 50) { console.error(`EXPECTED 50 cases, got ${n}`); process.exit(1); }
