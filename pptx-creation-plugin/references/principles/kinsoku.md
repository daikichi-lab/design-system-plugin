# Kinsoku — Japanese Line-Breaking (禁則処理)

The typesetting rules a Japanese business deck must satisfy at every line break.
Unlike the rest of `principles/`, this doc is **not** advice for a strategist to
read and honor — it is a **specification the engine implements and the reviewer
checks against**. Per the plugin's two-way split of design philosophy (spec §4-4:
判断原則 as prose vs. ハード制約 baked into code), kinsoku is a **hard constraint**.
"Typeset carefully" never fixes a 泣き別れ; code does. State each rule below
crisply enough to be codified — that is its only job.

> Where breaks land is not typographic taste. A line that starts with 。 or leaves
> one orphaned character reads instantly as machine-set, and a figure split from
> its 単位 reads as *wrong*. These rules serve the same end as the rest of the
> bar: understanding, deciding, acting.

**Enforcement (spec §5).** These rules are mechanical. The Stage-1 kinsoku engine
computes legal break points from font metrics; the Stage-3 HTML pipeline gets them
for free from `line-break: strict` + `text-wrap: balance`/`pretty` and hands back
the exact break positions via geometry extraction, which are then baked into the
native pptx. Neither path asks the model to place breaks well. **Until that engine
lands, authors control breaks manually** via explicit line arrays (`titleLines` /
`messageLines`, see `../patterns/catalog.md`) and the QA loop (M-2) catches the
orphans by eye. This doc is the same contract in both eras.

---

## 1. 行頭禁則 — characters that must never start a line

A line break must not leave any of these as the first glyph of the next line. The
engine pulls the offending character up to the previous line (追い出し) or, where
width allows, pushes an earlier break down (追い込み).

- **小書き仮名** — ぁ ぃ ぅ ぇ ぉ っ ゃ ゅ ょ ゎ ゕ ゖ / ァ ィ ゥ ェ ォ ッ ャ ュ ョ ヮ ヵ ヶ
- **句読点** — 、 。 ， ．
- **閉じ括弧** — ） 」 』 】 〕 〉 》 ｝ ］ ｀ and every other closing bracket.
- **中黒・区切り** — ・ ： ； ！ ？ ‥ …
- **長音・繰り返し** — ー ゝ ゞ 々 as a line-lead (a prolonged-sound mark or repeat
  mark orphaned from the syllable it extends).

Test: *the first non-space character of every line except the first is checked
against the 行頭禁則 set; a hit is a violation.*

## 2. 行末禁則 — characters that must never end a line

A line must not end on an **opening bracket**: （ 「 『 【 〔 〈 《 ｛ ［. The bracket
belongs with what it opens, so the break moves before the bracket. (Mirror of §1;
the two sets are checked together.)

## 3. 分離禁止 — units that must not be split across a break

Some spans are atomic. A break inside them is a violation even though each side is
individually legal:

- **数値と単位** — never split a number from its unit: `1,200`｜`万円`, `百万円`,
  `3`｜`か月`, `60`｜`%`, `12`｜`pt` are each one unit. Keep the digits, the
  grouping commas, and the trailing 単位/記号 on the same line.
- **数値と記号** — a figure and its `%`, `pt`, `°`, `件`, `社`, `x`(倍) travel
  together. This is the same span the `chart`/`stat`/`stat-grid` patterns emit —
  the unit is part of the number, not a suffix that may wrap.
- **括弧グループ** — do not break *inside* a paren group `（…）` or quote `「…」`
  such that the opener and closer land on different lines when the whole group
  fits within a line's width. (When it genuinely can't fit, §1/§2 still govern the
  bracket edges.)
- **約物の連続** — a run of punctuation (`……`, `!?`) is one unit; do not split it.

Codification: treat each atomic span as a single unbreakable token (a `<wbr>`-free,
`&nbsp;`-joined run in the Stage-3 path; a no-break token in the Stage-1 metric
path).

## 4. 泣き別れ / orphan avoidance — no dangling single character

Legal breaks are necessary but not sufficient. Two additional constraints on the
*shape* of a wrapped block:

- **No 1-character last line.** A title or statement that wraps must never leave a
  single orphaned glyph (or a lone 単語 fragment) alone on the final line — the
  classic 泣き別れ. Pull a character up or rebalance so the last line carries
  weight.
- **Balance line lengths.** Wrapped lines should be near-even, not long-then-stub.
  This is `text-wrap: balance`/`pretty` in the Stage-3 path and a line-length
  variance score in the Stage-1 typo-lint (spec §5-5: 孤立文字数・最終行の長さ・
  行長のばらつき). A block that passes §1–§3 but scores badly here still fails.

For manual line arrays today: when you write `titleLines`/`messageLines`, split so
neither line is a stub and no closing punctuation or small kana leads line 2. The
QA loop is the backstop — a dangling character is a `house-quality-bar.md` §5
"uneven / awkward break" defect and must be fixed before ship.

## 5. Scope & honesty

- Kinsoku governs **line breaks within a text run**, not which runs exist — density
  and splitting a slide into two are `slide-design-principles.md` §6, not this doc.
- Residual mismatch is expected and honest: the headless-browser metrics and real
  PowerPoint metrics differ, so the final 字面 arbiter is the machine (spec §5).
  The engine bakes the computed breaks; a client who heavily edits the text must
  regenerate. Say so, don't pretend the breaks are live.
- This doc does **not** restate the AI-tell blocklist — bad typesetting is a
  visual-integrity failure, scored under `house-quality-bar.md` §2 by reference.

---

## See also

- `house-quality-bar.md` — the hard rules, the AI-tell blocklist (§2), and the
  QA loop (§5) that catches an orphan the engine hasn't yet.
- `slide-design-principles.md` — §5 (alignment & size) and §6 (density: split,
  never cram) — the reasoning around, not inside, the line break.
- `../patterns/catalog.md` — the `titleLines` / `messageLines` slots authors use
  to control breaks manually until the kinsoku engine lands, and each pattern's
  `capacity`.
