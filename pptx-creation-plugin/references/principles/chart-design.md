# Chart Design

How charts get built and chosen in this plugin. A chart is not a picture of
data — it is the argument made visible. Every rule here serves a reader who
must understand a magnitude or a trend in one look, then act on it.

> A chart earns its slide only if it makes one point obvious faster than a
> sentence would. If it doesn't, cut it.

This file sits under the house rules in
[`references/principles/house-quality-bar.md`](house-quality-bar.md) and the
`chart` pattern recipe in [`../patterns/catalog.md`](../patterns/catalog.md).
Where it cites layout numbers, the engine
([`../../bin/generate.js`](../../bin/generate.js)) is the source of truth —
read it there, don't re-derive it here.

---

## 1. Charts are native (house rule, non-negotiable)

Charts **must be native PowerPoint chart objects**, never rasterized images.
This is House Quality Bar §1 rule 8 and scores under *Information design* in
the rubric. A native chart stays editable in PowerPoint: the client can fix a
number, restyle a bar, or copy the data — a screenshot of a chart cannot do
any of that, and a pasted PNG is an instant AI-tell of a deck assembled by a
tool that couldn't be bothered.

In the engine this means `slide.addChart(...)` via pptxgenjs — never
`slide.addImage(...)` of a rendered chart. The `chart` pattern already does
this; see [`../patterns/catalog.md`](../patterns/catalog.md) (`chart`) and
`slideChart` in [`../../bin/generate.js`](../../bin/generate.js).

## 2. Choosing a chart type by intent

Pick the chart from the **question the reader is asking**, not from variety for
its own sake.

- **Column (vertical bars)** — comparing a handful of categories, or a value
  **over time** with few periods. This is the **engine default** and the right
  answer most of the time. The `chart` pattern draws a column chart
  (`barDir: "col"`). Reads cleanly at 4–7 bars (the sample uses 6); past ~8 it
  crowds — see the pattern's `capacity`.
- **Bar (horizontal)** — **ranking**, especially with **long category labels**
  (品目名, 部門名, アンケート選択肢). Horizontal labels stay readable where a column
  chart would tilt or truncate them. Sort by value so the ranking is the
  message.
- **Line** — a **continuous trend** over many points (月次推移, 12か月の売上). Use a
  line when the *shape of the change* is the point; use columns when the
  *individual values* are. One to three series at most.
- **Pie / doughnut** — **parts of a single whole** that sums to 100%, and only
  when the split itself is the message. Use **sparingly** and **never more than
  5 slices** — beyond that the wedges stop being comparable and you should use
  a ranked bar instead. If you find yourself labeling every wedge with its
  number, the reader needed a bar chart.

### Avoid (these read as auto-generated or as manipulation)

- ❌ **3-D charts** of any kind — perspective distorts the very magnitudes the
  chart exists to show.
- ❌ **Exploded pie** (slices pulled apart) — decoration that destroys the
  parts-of-a-whole reading.
- ❌ **Dual axes used as decoration** — two y-axes invite false correlation and
  hide the basis. Only justified when the two series genuinely share an x-axis
  and the relationship is the point; if in doubt, use two slides.
- ❌ Stacked everything, area fills under multiple lines, or any chrome that
  competes with the data. These overlap the AI-tell blocklist in
  [`house-quality-bar.md`](house-quality-bar.md) §2 — keep it clean.

## 3. Engine reality (what is actually implemented)

Be honest about what ships today. Do not promise a planner a chart type the
engine can't draw through a named pattern.

- The **`chart` pattern defaults to a native *column* chart**. From
  `slideChart` in [`../../bin/generate.js`](../../bin/generate.js): it calls
  `addChart(pres.charts.BAR, ...)` with `barDir: "col"`, a **single accent
  color** (`chartColors: [accent]`), the **value axis hidden**
  (`valAxisHidden: true`), **gridlines off** (`valGridLine`/`catGridLine`
  style `"none"`), the category axis line hidden, and **data labels at
  `outEnd`** formatted `#,##0`. Geometry, the accent color, and the takeaway
  card all come from the theme tokens and the coordinates documented in the
  `chart` recipe — see [`../patterns/catalog.md`](../patterns/catalog.md);
  never copy the numbers, link to them.
- **Bar (ranked), line, and pie/doughnut are named types of the same pattern**
  (2026-07-05): pass `chartType: "bar" | "line" | "pie" | "doughnut"`. Every
  type keeps the restraint above (hidden value axis, no gridlines, labeled
  data, one takeaway). Type-specific rules the engine bakes in:
  - `bar` — same accent/emphasis colours as column. pptxgenjs draws the FIRST
    category at the bottom, so **pass values ascending** and the largest lands
    on top (a ranking reads top-down).
  - `line` — one accent line, labels above the points; for a genuine trend.
  - `pie` / `doughnut` — **max 5 slices, design-lint hard error past that**;
    colours are a monochromatic accent ramp (never a rainbow — house bar §2);
    percent labels sit OUTSIDE the wedges in ink; legend at the bottom;
    `emphasizeIndex` turns one slice accentDeep and mutes the rest. Percent
    labels round to integers — exact figures belong in the takeaway.
  - `band` (帯グラフ) — 100% stacked horizontal bars for **composition across
    1-5 rows** (売上100円の行き先, 期ごとのコスト構成). `series` becomes an
    ARRAY of 2-4 segments; colours are the DARK ramp (accentDeep / accent /
    muted / ink) so the white in-segment value labels stay readable. The
    geometry carries the percentages; the labels carry the true values.
  - The `unit` caption renders once at the **bottom-left footnote slot** (the
    old top-left slot collided with a legal 2-line title — caught by render QA).
  - Data labels default to `#,##0;▲#,##0` — **negatives always render ▲**,
    never a minus sign (the house 表記 rule).
  - **Waterfall (増減要因分解) is the `waterfall` diagram skeleton**, not a
    chart type — see `../graphics/diagram-recipes.md`. Shapes give exact
    per-block colour and ▲ labels that a stacked-chart hack cannot.

## 4. Data integrity (especially financial / external decks)

This is *Content integrity* in the rubric and ties directly to
[`house-quality-bar.md`](house-quality-bar.md) §4. A chart that misleads fails
review no matter how clean it looks.

- **Never truncate or zoom an axis to exaggerate a change.** A column chart
  baseline starts at zero. Don't crop the y-range so a 3% move looks like a
  cliff. (The engine's column chart hides the value axis precisely because the
  *data labels* carry the truth — so the labels must be the real numbers, not
  a rescaled view.)
- **Label the units, the basis, and the period.** 円 / 件 / %, 「全社・税抜」,
  「2025年4月〜2026年3月」. A number with no unit is a number you can't trust. Put
  these in the series name, the title, or a caption — not nowhere.
- **Mark estimates as estimates.** 「約60%（推計）」/「見込み」 is honest;
  「60%」stated as fact when it's a projection is not. This mirrors §4's
  「約60%（イメージ）」 example — be honest in the chart exactly as you would be in
  prose.

## 5. Color: one accent, gray for context

- **One accent for the data, neutral gray for context.** The engine uses a
  single `accent` for all bars by design (`chartColors: [accent]`). One series,
  one color.
- **Never a rainbow of equal bars.** Coloring each bar differently is the
  *Rainbow palettes where 4+ colors compete equally* AI-tell from
  [`house-quality-bar.md`](house-quality-bar.md) §2, and it implies a
  categorical meaning that isn't there.
- To **emphasize one bar** (the one your takeaway is about), keep the rest a
  neutral gray and give only that bar the accent. That is the same
  one-dominant-plus-one-accent discipline as the rest of the deck (§1 rule 5),
  not a second hue.

## 6. One chart, one takeaway, per slide

- **One chart per slide.** The `chart` pattern's `when_avoid` is explicit: more
  than one chart on a slide, or data with no point. Two charts means two
  messages — split the slide.
- **The title states the takeaway as a sentence**, never a topic label. Per §1
  rule 1: 「月次の解約率」is a label; 「解約率は3か月連続で低下している」is a message. The
  `chart` pattern pairs the chart with a `takeawayHead` arrow phrase
  (e.g. 「早期把握 → 早期対応」) and a 1–3 sentence `takeaway` in the accent-tinted
  card — that card is *what to conclude or do*, in words, beside the evidence.

## 7. pptxgenjs gotchas for charts

These bite quietly — the chart renders but wrong. Mirror how the engine already
handles them in [`../../bin/generate.js`](../../bin/generate.js):

- **Hex colors carry no `#`.** pptxgenjs chart color options
  (`chartColors`, `dataLabelColor`, `catAxisLabelColor`, axis/area fills) take a
  bare 6-digit hex like `"1F2430"`. The theme tokens are already stored without
  `#` (see [`../../themes/_default-neutral/theme.json`](../../themes/_default-neutral/theme.json)
  against [`../../schemas/theme.schema.json`](../../schemas/theme.schema.json)),
  so passing `T.c.accent` straight through works — don't prepend one.
- **Fonts come from the theme token, never hardcoded.** Set
  `catAxisLabelFontFace` / `dataLabelFontFace` to `T.font` (the single
  `theme.font.family` token, default `Meiryo`). This is §1 rule 9 — no
  per-textbox or per-chart font override. A hardcoded Latin font face is how
  Japanese axis labels turn to tofu.
- **Pass a fresh options object to every `addChart` call.** pptxgenjs **mutates
  the option objects it's given**, so a shared/reused config silently corrupts
  the next chart. Build the options inline per call (the engine does, just as it
  rebuilds `cardShadow(T)` fresh each time for the same reason). Same for the
  data array — fresh `[{ name, labels, values }]` per chart.
- **Data labels do the work the axis won't.** With `valAxisHidden: true` the
  reader only sees the numbers if `showValue: true` and
  `dataLabelFormatCode` (`"#,##0"`) are set. If you hide the axis, you **must**
  label the values — otherwise the bars are heights with no scale.

---

## Checklist before a chart ships

1. Native chart object, not an image. (§1)
2. Type matches the reader's question; no 3-D, no exploded pie, no decorative
   dual axis. (§2)
3. If hand-built, it's honest about being outside the `chart` pattern and
   passed QA. (§3)
4. Axis not truncated to mislead; units / basis / period labeled; estimates
   marked. (§4)
5. One accent + gray context, no rainbow. (§5)
6. One chart, one takeaway; the title is a sentence. (§6)
7. Hex without `#`, font via `T.font`, fresh option object, values labeled.
   (§7)

A chart that clears all seven reinforces the deck's *Information design* and
*Content integrity* scores in [`house-quality-bar.md`](house-quality-bar.md)
§6. One that doesn't is caught by the §5 QA loop — fix it or, if it can't be
fixed cleanly, stop and report (M-4).
