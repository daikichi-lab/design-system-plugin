# design-system-plugins

**Claude Code プラグイン・マーケットプレイス**（`daikichi-plugins`）です。次のプラグインを配布しています。

- **[`pptx-creation`](pptx-creation-plugin/)** — 高品質な PowerPoint（`.pptx`）デッキを
  「設計 → 構成 → 生成 → レビュー」する、**日本語ビジネス資料**に最適化したプラグイン。
  エンジンは1つ、デッキは無数。デザイン言語の"本棚"を備え、**検証ループ（lint＋レンダ＋
  採点）を必須**にすることで、崩れたデッキが世に出ないようにしています。
  詳細ドキュメント：**[pptx-creation-plugin/README.md](pptx-creation-plugin/README.md)**。

---

## 導入方法（Claude Code）

```text
# 1. このマーケットプレイスを追加
/plugin marketplace add daikichi-lab/design-system-plugin

# 2. プラグインをインストール
/plugin install pptx-creation@daikichi-plugins
```

もしくは **`/plugin`** を実行してメニューから **pptx-creation** を選んでも構いません。
（ローカルで開発する場合は手順1をリポジトリのパスに：`/plugin marketplace add .`）

**読み込み確認：** `/plugin` を実行すると `pptx-creation` が有効化されて表示され、
スキルが名前空間付きで呼べます（例：`/pptx-creation:deck-brief`、`/pptx-creation:create-deck`）。

### アップデート方法（インストール済みプラグインの最新化）

このリポジトリに新機能（パターン・図解・組版修正）が入っても、**利用側の
プラグインは自動では更新されません**。古いキャッシュのまま生成を続けると、修正済みの
組版バグや未対応レイアウトを踏み続けます。次の2ステップで最新化してください。

```text
# 1. マーケットプレイスのカタログを更新
/plugin marketplace update daikichi-plugins

# 2. プラグイン本体を更新（ターミナルから。/plugin メニューの更新操作でも可）
claude plugin update pptx-creation@daikichi-plugins
```

ローカルパスで追加している場合（`/plugin marketplace add .`）は、先にリポジトリを
`git pull` してから上記2ステップを実行します。

**更新後に必ずやること：**

1. **`npm install` のやり直し。** キャッシュは
   `~/.claude/plugins/cache/daikichi-plugins/pptx-creation/<version>/` と
   **バージョンごとに別ディレクトリ**になるため、旧版の `node_modules` は
   引き継がれません。新しいバージョンのディレクトリで一度 `npm install` を
   実行してください（日本語組版レイヤーも使うなら `bash bin/layout-html/setup.sh`）。
2. **旧版で作ったデッキの再生成。** 生成済み `.pptx` は直接修正できません
   （ZIP の手編集は禁止）。各プロジェクトの `deck_plan.json` から
   `bash bin/build.sh --plan ... --out ...` で再生成すると、組版修正・新パターンが
   反映されます。

### 前提ツール（エンジン＋QAレンダ）

スキルは小さな Node エンジンを呼び出し、QAループでレンダするので、Claude Code を
動かすマシンに次が必要です。

| 必要なもの | 用途 | 導入 |
|---|---|---|
| **Node.js** ＋ プラグインの依存 | `bin/generate.js`（pptxgenjs） | プラグインのディレクトリで `npm install` を**一度**（場所は下記） |
| **LibreOffice**（`soffice`）＋ **poppler**（`pdftoppm`）を PATH に | QAレンダ（PPTX→PDF→JPG） | OS のパッケージマネージャ・**Java 不要** |
| *(任意)* Playwright Chromium ＋ **游ゴシック** フォント | 日本語組版の精度（`bake` / `typo-lint`） | `bin/layout-html/setup.sh`。無くてもビルドは**自動フォールバック** |

> **`npm install` の場所：** Claude Code はプラグインの npm 依存を自動では入れません。
> マーケットプレイス経由で入れたプラグインは
> `~/.claude/plugins/cache/daikichi-plugins/pptx-creation/<version>/` に置かれます。
> そこへ `cd` して一度 `npm install` してください。（ローカル開発なら
> `pptx-creation-plugin/` で実行）。飛ばした場合の症状：スキルが
> *「Cannot find module 'pptxgenjs'」* で失敗します。

詳細とワンコマンドのパイプラインは、プラグイン README の
[*How to load it*](pptx-creation-plugin/README.md#how-to-load-it) を参照してください。

---

## 導入したら、まず何をするか

1. **デッキを作る — ここから始める。** **`/pptx-creation:deck-brief`** を実行し、
   目的を自分の言葉で（曖昧でも構わず）投げてください。推測できない数点だけ
   ——**誰向けか・取ってほしい行動・一番の結論・どの数字が概算か**——を質問し、
   あとは自動で進めます：構成（strategy）→ 生成 → 必須のQAループ → 採点レビュー。
   この"入力"こそが品質の上限を決めます。
   → [*Writing the brief*](pptx-creation-plugin/README.md#writing-the-brief-the-input-that-sets-the-ceiling)

   > 要件がもう固まっている？ その節のブリーフ雛形を埋めて、直接
   > **`/pptx-creation:create-deck`** を呼んでください。

2. **合格ラインを見る。**
   [`pptx-creation-plugin/examples/seminar-kanrikaikei/`](pptx-creation-plugin/examples/seminar-kanrikaikei)
   を開いてください。「これ以上崩れてはいけない」基準となる参照レンダです。

3. **プロジェクトを用意し、`DESIGN.md` を必ず作る。** デッキを作るリポジトリでは、
   最初に次の3スキルを順に実施してください：
   **`/pptx-creation:project-scaffold`** → **`/pptx-creation:design-doc`** →
   **`/pptx-creation:theme-init`**。

   > **`design-doc` の実施は省略しないでください。** このスキルがそのリポジトリの
   > **`DESIGN.md`**（常設の設計システム：ブランド・デザイン言語・オーディエンス別
   > プリセット・正直さの house rules・制約・検証バー・図解の慣例）を作ります。
   > 作成物は **テンプレートレベルが必須**です — 見本は
   > [`docs/design-file-template/`](docs/design-file-template/)（Apple / BMW M /
   > Claude / Nike / Slack の5本、各約500行）。全トークンの実値＋トークンごとの
   > 用途規則＋コンポーネント仕様＋理由つき Do/Don'ts＋Known Gaps まで書き切ります。
   > 箇条書きのスケッチでは `design-doc` の成果物になりません。
   > 以後 `deck-brief` がそれを読み、**毎回は差分だけ**聞くので、全デッキが一貫して
   > on-brand になります。`DESIGN.md` が無いままデッキを量産すると、ブランド・トーン・
   > 表記ルールを毎回口頭で再指定することになり、デッキ間のブレの主要因になります。
   > 案件ごとの中身とテーマは *あなたの*リポジトリに置き、プラグインは汎用のまま保ちます。

全体の流れ：

```text
deck-brief → deck-strategy → create-deck（生成＋QAループ） → deck-review（採点）
  意図           構成            .pptx                          出荷 / 修正
```

一発で完璧な指示は要りません。検証ループと、あなたの**実機（PowerPoint）での確認**が
精度を磨きます。ブリーフで **読み手・目的（行動）・結論・正直さ** の4点を固めれば、
着手には十分です。

---

## このリポジトリの中身

```
design-system-plugin/
├── .claude-plugin/marketplace.json   # マーケットプレイスの定義（daikichi-plugins）
├── pptx-creation-plugin/             # プラグイン本体 — エンジン・スキル・references・themes・examples
│   └── README.md                     # アーキテクチャ＋使い方の詳細
└── README.md                         # このファイル（導入＋最初の一歩）
```

## ライセンス

MIT.
