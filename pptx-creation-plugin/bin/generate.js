#!/usr/bin/env node
/* ============================================================
 *  pptx-creation — deck engine
 *  Refactored from the verified build_deck.js prototype; typography
 *  floor promoted from build_deck_v2.js (Yu Gothic weight-led hierarchy,
 *  modular size scale, JP leading tokens).
 *
 *  3-layer separation (kept intact from the prototype):
 *    THEME tokens     -> themes/<name>/theme.json   (per-project brand)
 *    pattern builders -> this file (token-reference only; the "recipes")
 *    deck content     -> deck_plan.json             (per-project content)
 *
 *  Typography floor (theme tokens, never hardcoded in builders):
 *    font.heading / body / caption   -> weight-led hierarchy (§3)
 *    sizes.*                          -> modular type scale (~1.26)
 *    lead.title/display/body/caption/tight -> line-spacing by role
 *
 *  Usage:
 *    node bin/generate.js --plan <deck_plan.json> [--theme <theme.json>] --out <out.pptx>
 *
 *  Defaults: --theme -> themes/_default-neutral/theme.json
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { flowLayout, cycleLayout, matrixLayout, timelineLayout, stepsLayout, branchLayout, formulaLayout, waterfallLayout, nodeTextBox, quadHeadBox, quadBodyBox } = require("./graphics/diagrams.js");

/* ---------------- CLI ---------------- */
function parseArgs(argv) {
  const a = { plan: null, theme: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--plan") a.plan = argv[++i];
    else if (k === "--theme") a.theme = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "-h" || k === "--help") a.help = true;
    else throw new Error(`Unknown argument: ${k}`);
  }
  return a;
}

const USAGE = `pptx-creation engine
  node bin/generate.js --plan <deck_plan.json> [--theme <theme.json>] --out <out.pptx>

  --plan   deck plan JSON: either a bare [ {pattern, content}, ... ] array,
           or { "meta": {...}, "slides": [ {pattern, content}, ... ] }
  --theme  theme JSON (default: themes/_default-neutral/theme.json)
  --out    output .pptx path`;

/* ---------------- THEME ---------------- */
// Map the human-friendly theme.json color keys onto the short token keys the
// builders use internally (kept identical to the verified prototype's `T.c`).
const COLOR_MAP = {
  bg: "bg", ink: "ink", muted: "muted", faint: "faint",
  surface: "surface", surfaceAccent: "surfaceA", line: "line",
  dark: "dark", darkAlt: "darkAlt", onDark: "onDark", onDarkMuted: "onDarkMut",
  accent: "accent", accentDeep: "accentDp", accentSoft: "accentSft",
  onAccentMuted: "onAccentMut",
};

// Leading defaults (line-spacing multipliers) — used when a theme omits `lead`.
// JP body wants air; headings want to be tight (§3 / references/principles/typography.md).
const LEAD_DEFAULTS = { title: 1.08, display: 1.18, body: 1.6, caption: 1.5, tight: 1.4 };

// LAYOUT defaults — composition knobs a design language can shift (M-6: layout is
// look-and-feel, so it lives in the THEME, never the deck plan). Every default
// reproduces the CURRENT geometry, so a theme without `layout` renders
// byte-for-byte as before. Only these knobs move — content geometry (box x/y/w/h)
// is unchanged, so no overflow/kinsoku/height-gate risk.
//   card.radius/shadow  — card corner rounding + drop shadow (sharp+flat = swiss/minimal)
//   kicker              — the eyebrow marker: "dot" | "bar" (short rule) | "none"
//   coverMotif          — cover depth shape: "oval" (off-canvas ellipse) | "none"
//   sectionIndex        — the section ghost number side: "right" | "left" | "none"
const LAYOUT_DEFAULTS = { card: { radius: 0.09, shadow: true }, kicker: "dot", coverMotif: "oval", sectionIndex: "right" };

function loadTheme(themePath) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(themePath, "utf8"));
  } catch (e) {
    throw new Error(`Cannot read theme "${themePath}": ${e.message}`);
  }
  const c = {};
  for (const [src, dst] of Object.entries(COLOR_MAP)) {
    if (j.colors && typeof j.colors[src] === "string") c[dst] = j.colors[src];
  }
  // Weight-led font hierarchy: a theme may name a face per role; any role left
  // unset falls back to `family` (so single-family themes keep working).
  const fam = (j.font && j.font.family) || "Meiryo";
  const font = {
    family: fam,
    heading: (j.font && j.font.heading) || fam,
    body: (j.font && j.font.body) || fam,
    caption: (j.font && j.font.caption) || fam,
  };
  const jl = j.layout || {};
  const layout = {
    ...LAYOUT_DEFAULTS, ...jl,
    card: { ...LAYOUT_DEFAULTS.card, ...(jl.card || {}) },
  };
  return {
    name: j.name || "theme",
    W: j.canvas.w, H: j.canvas.h, m: j.canvas.margin,
    font,
    c,
    s: { ...j.sizes },
    lead: { ...LEAD_DEFAULTS, ...(j.lead || {}) },
    layout,
    brand: j.brand || {},
  };
}

/* fresh shadow object each call (pptxgenjs mutates option objects) */
const cardShadow = (T) => ({ type: "outer", color: T.c.ink, blur: 11, offset: 4, angle: 90, opacity: 0.11 });

/* Optional decoration layer the deck_plan can place on ANY slide (not just the
 * cover): a code-drawn SVG/PNG motif (`bgMotif`) and/or a faint ground pattern
 * (`bgPattern`), supplied per project like the cover `bg` (M-7 code-drawn, M-8
 * figure-only — text/numbers/charts stay native). Drawn BEHIND all content; the
 * recipe MUST keep ink out of the text/chart zones, and image-lint's scrim check
 * (per-pattern textRegions) enforces legibility. Both default empty => the slide
 * is byte-for-byte identical to before (no-regression). */
function bgLayer(s, T, d) {
  if (!d) return;
  if (d.bgPattern) s.addImage({ path: d.bgPattern, x: 0, y: 0, w: T.W, h: T.H });
  if (d.bgMotif) s.addImage({ path: d.bgMotif, x: 0, y: 0, w: T.W, h: T.H });
}

/* Optional supporting ICON (transparent PNG, code-drawn SVG rasterized 2x) — a
 * bystander beside a stat/number, never a decoration of the number itself (M-8).
 * Placed in a fixed box the caller passes; empty => nothing drawn. */
function iconSlot(s, icon, x, y, wh) {
  if (icon) s.addImage({ path: icon, x, y, w: wh, h: wh });
}

/* A prose field may be a plain string (pptx auto-wraps it) OR an array of
 * pre-computed lines (baked kinsoku/balance breaks from bin/layout-html/bake.js).
 * richText turns either into what pptxgenjs addText wants — baked lines get
 * explicit breakLines so the pptx breaks exactly where the HTML engine decided
 * (M-9: the browser computed it, the pptx is still native). */
function richText(v) {
  if (Array.isArray(v)) return v.map((t, i, a) => ({ text: String(t), options: { breakLine: i < a.length - 1 } }));
  return v;
}

/* ---------------- low-level helpers ---------------- */
// Kicker eyebrow: an accent marker + bold heading-weight label. The marker is a
// theme layout knob: "dot" (default), "bar" (a short rule), or "none".
function kicker(slide, T, text, y, { x = T.m, onDark = false } = {}) {
  const style = T.layout.kicker;
  let tx = x;
  if (style === "dot") {
    slide.addShape("ellipse", { x, y: y + 0.055, w: 0.13, h: 0.13,
      fill: { color: T.c.accent }, line: { type: "none" } });
    tx = x + 0.26;
  } else if (style === "bar") {
    slide.addShape("rect", { x, y: y + 0.1, w: 0.26, h: 0.05,
      fill: { color: T.c.accent }, line: { type: "none" } });
    tx = x + 0.4;
  } // "none" => no marker; label sits at the margin
  slide.addText(text, { x: tx, y, w: 8, h: 0.3, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.kicker, bold: true, charSpacing: 1.5,
    color: onDark ? T.c.accentSft : T.c.accent, align: "left", valign: "middle" });
}

// Title/heading: heading-weight, tight leading, slight negative tracking for large JP.
function title(slide, T, lines, y, { x = T.m, w = T.W - 2 * T.m, onDark = false, size = T.s.title } = {}) {
  const arr = (Array.isArray(lines) ? lines : [lines]).map((t, i, a) => ({
    text: t, options: { breakLine: i < a.length - 1 } }));
  slide.addText(arr, { x, y, w, h: 0.62 * (Array.isArray(lines) ? lines.length : 1) + 0.3, margin: 0,
    fontFace: T.font.heading, fontSize: size, bold: true, lineSpacingMultiple: T.lead.title, charSpacing: -0.2,
    color: onDark ? T.c.onDark : T.c.ink, align: "left", valign: "top" });
}

function numCircle(slide, T, n, x, y, d = 0.46) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: T.c.accent }, line: { type: "none" } });
  slide.addText(String(n), { x, y, w: d, h: d, margin: 0, align: "center", valign: "middle",
    fontFace: T.font.heading, fontSize: T.s.num, bold: true, color: T.c.onDark });
}

function card(slide, T, x, y, w, h, { fill = T.c.surface } = {}) {
  const L = T.layout.card; // radius + shadow are a theme layout knob (sharp+flat = swiss/minimal)
  const opt = { x, y, w, h, rectRadius: L.radius, fill: { color: fill }, line: { type: "none" } };
  if (L.shadow) opt.shadow = cardShadow(T);
  slide.addShape("roundRect", opt);
}

function footer(slide, T, brand, page, showPage) {
  if (brand) {
    slide.addText(brand, { x: T.m, y: T.H - 0.42, w: 3, h: 0.3, margin: 0,
      fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.faint, align: "left", valign: "middle" });
  }
  if (showPage) {
    slide.addText(String(page), { x: T.W - T.m - 1, y: T.H - 0.42, w: 1, h: 0.3, margin: 0,
      fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.faint, align: "right", valign: "middle" });
  }
}

/* ===================== SLIDE PATTERNS ===================== */
/* Each builder: (pres, content, T, ctx) -> slide.
 * ctx = { brand, pageNum, showPage }. Builders reference theme TOKENS only —
 * no hardcoded colors, point sizes, faces, or leading. */

function slideCover(pres, d, T) {
  const s = pres.addSlide();
  s.background = { color: T.c.dark };
  if (d.bg) {
    // hybrid-editorial image slot: a code-drawn SVG atmosphere (with a baked,
    // feathered scrim for legibility) as a full-bleed picture; native text sits
    // on top (M-8). The path is a per-project asset (assets/generated/), never
    // generated inline here (separation principle).
    s.addImage({ path: d.bg, x: 0, y: 0, w: T.W, h: T.H });
  } else if (T.layout.coverMotif !== "none") {
    // depth motif: large soft oval, partly off-canvas (NOT a stripe). A theme may
    // set coverMotif:"none" for an austere, type-only cover (minimal/editorial).
    s.addShape("ellipse", { x: 9.2, y: 3.7, w: 7.2, h: 7.2,
      fill: { color: T.c.darkAlt }, line: { type: "none" } });
  }
  kicker(s, T, d.kicker, 1.55, { onDark: true });
  title(s, T, d.titleLines, 2.2, { onDark: true, size: T.s.cover, w: 10 });
  if (d.subtitle) s.addText(richText(d.subtitle), { x: T.m, y: 4.7, w: 9.5, h: 0.9, margin: 0,
    fontFace: T.font.body, fontSize: T.s.coverSub, color: T.c.onDarkMut, align: "left", valign: "top",
    lineSpacingMultiple: T.lead.caption });
  if (d.footer) s.addText(d.footer, { x: T.m, y: T.H - 0.85, w: 9, h: 0.35, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.footer, color: T.c.onDarkMut, align: "left", valign: "middle" });
  return s;
}

function slideMessage(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  // centered single statement (display leading, tight tracking)
  const msg = d.messageLines.map((t, i, a) => ({ text: t, options: { breakLine: i < a.length - 1 } }));
  s.addText(msg, { x: 1.0, y: 2.0, w: T.W - 2.0, h: 1.7, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.message, bold: true, color: T.c.ink, align: "center", valign: "middle",
    lineSpacingMultiple: T.lead.display, charSpacing: -0.2 });
  // big stat callout
  if (d.statBig) s.addText(d.statBig, { x: 1.0, y: 3.95, w: T.W - 2.0, h: 1.15, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.stat, bold: true, color: T.c.accent, align: "center", valign: "middle" });
  if (d.statCaption) s.addText(richText(d.statCaption), { x: 2.6, y: 5.25, w: T.W - 5.2, h: 0.8, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.small, color: T.c.muted, align: "center", valign: "top",
    lineSpacingMultiple: T.lead.caption });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideTwoColumn(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15, { w: 7.0 });
  // left: lead paragraph (body face, airy leading)
  if (d.lead) s.addText(richText(d.lead), { x: T.m, y: 2.55, w: 5.0, h: 3.6, margin: 0,
    fontFace: T.font.body, fontSize: T.s.body, color: T.c.muted, align: "left", valign: "top",
    lineSpacingMultiple: T.lead.body });
  // right: numbered rows
  const rx = 6.45, rw = T.W - T.m - rx, top = 2.5, gap = 1.46;
  d.items.forEach((it, i) => {
    const y = top + i * gap;
    numCircle(s, T, it.n, rx, y);
    s.addText(it.head, { x: rx + 0.66, y: y - 0.05, w: rw - 0.66, h: 0.4, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink, align: "left", valign: "middle" });
    s.addText(richText(it.body), { x: rx + 0.66, y: y + 0.44, w: rw - 0.66, h: 0.7, margin: 0,
      fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "top",
      lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideComparison(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15);
  const top = 2.5, h = 3.95, gap = 0.5;
  const w = (T.W - 2 * T.m - gap) / 2;
  const lx = T.m, rx = T.m + w + gap;
  // left card (neutral) / right card (accent emphasis) — tint+shadow, no stripes
  card(s, T, lx, top, w, h, { fill: T.c.surface });
  card(s, T, rx, top, w, h, { fill: T.c.surfaceA });
  const drawCol = (x, col, accent) => {
    const pad = 0.5;
    s.addText(col.label, { x: x + pad, y: top + 0.42, w: w - 2 * pad, h: 0.5, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.compareLabel, bold: true, color: accent ? T.c.accentDp : T.c.ink, align: "left", valign: "middle" });
    s.addText(col.role, { x: x + pad, y: top + 0.98, w: w - 2 * pad, h: 0.35, margin: 0,
      fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "middle" });
    const bullets = col.points.map((p) => ({ text: p,
      options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 11 } }));
    s.addText(bullets, { x: x + pad, y: top + 1.55, w: w - 2 * pad, h: h - 1.9, margin: 0,
      fontFace: T.font.body, fontSize: T.s.body, color: T.c.ink, align: "left", valign: "top",
      lineSpacingMultiple: T.lead.tight });
  };
  drawCol(lx, d.left, false);
  drawCol(rx, d.right, true);
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideChart(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15, { w: 8.5 });
  // Data-label precision must not misrepresent the values: if any value has a
  // fractional part, keep one decimal (so 21.8 and 23.1 don't both read "23").
  // An explicit d.valueFormat overrides the auto-detection.
  // (band: series is an ARRAY of segments — gather every value for the check.)
  const vals = Array.isArray(d.series) ? d.series.flatMap((sg) => sg.values || []) : (d.series.values || []);
  const hasDecimal = vals.some((v) => typeof v === "number" && !Number.isInteger(v));
  // negatives always render ▲ (never a minus sign) — the house 表記 rule
  const valueFormat = d.valueFormat || (hasDecimal ? "#,##0.0;▲#,##0.0" : "#,##0;▲#,##0");
  // Emphasis: colour ONE bar (accentDeep) and mute the rest (accentSoft) to steer
  // the eye to the point the takeaway makes. No emphasizeIndex => all-accent
  // (unchanged). Data labels stay on every bar — colour directs, it never hides data.
  const emph = Number.isInteger(d.emphasizeIndex) ? d.emphasizeIndex : -1;
  const barColors = emph >= 0 ? vals.map((_, i) => (i === emph ? T.c.accentDp : T.c.accentSft)) : [T.c.accent];
  const axisOpts = {
    x: T.m, y: 2.2, w: 7.4, h: 4.4,
    chartArea: { fill: { color: T.c.bg } },
    showLegend: false, showTitle: false,
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    catAxisLabelColor: T.c.muted, catAxisLabelFontFace: T.font.body, catAxisLabelFontSize: 12,
    catAxisLineShow: false,
  };
  const labelOpts = {
    showValue: true, dataLabelPosition: "outEnd",
    dataLabelColor: T.c.ink, dataLabelFontFace: T.font.body, dataLabelFontSize: 12, dataLabelFormatCode: valueFormat,
  };
  const series = Array.isArray(d.series) ? d.series
    : [{ name: d.series.name, labels: d.series.labels, values: vals }];
  if (d.chartType === "band") {
    // 帯グラフ: 100% stacked horizontal bars — composition across 1-5 rows
    // (売上100円の行き先, 5期のコスト構成). 2-4 segments, coloured with a DARK
    // monochromatic ramp so the white in-segment value labels stay readable;
    // the geometry carries the percentages, the labels carry the true values.
    // pptxgenjs requires labels on EVERY series — share the first segment's rows.
    const cats = (series[0] && series[0].labels) || [];
    const segs = series.map((sg) => ({ name: sg.name, labels: sg.labels || cats, values: sg.values }));
    s.addChart(pres.charts.BAR, segs, {
      ...axisOpts, barDir: "bar", barGrouping: "percentStacked", barGapWidthPct: 55,
      chartColors: [T.c.accentDp, T.c.accent, T.c.muted, T.c.ink].slice(0, Math.max(series.length, 1)),
      showLegend: true, legendPos: "b", legendColor: T.c.muted, legendFontFace: T.font.body, legendFontSize: 12,
      showValue: true, dataLabelPosition: "ctr", dataLabelColor: T.c.bg,
      dataLabelFontFace: T.font.body, dataLabelFontSize: 12, dataLabelFormatCode: valueFormat,
    });
  } else if (d.chartType === "line") {
    // a trend reads better as a line than as bars (native line chart)
    s.addChart(pres.charts.LINE, series, { ...axisOpts, ...labelOpts, dataLabelPosition: "t",
      chartColors: [T.c.accent], lineSize: 3, lineSmooth: false });
  } else if (d.chartType === "bar") {
    // horizontal bars: RANKING with long category labels (品目名, 部門名) — the
    // labels stay horizontal and readable where a column chart would truncate
    s.addChart(pres.charts.BAR, series, { ...axisOpts, barDir: "bar", chartColors: barColors,
      barGapWidthPct: 55, ...labelOpts });
  } else if (d.chartType === "pie" || d.chartType === "doughnut") {
    // parts of ONE whole (<=5 slices; design-lint enforces). No rainbow: a
    // monochromatic accent ramp, darkest = the emphasized / first slice; percent
    // labels OUTSIDE the wedges in ink so they read on any slice colour.
    const ramp = [T.c.accentDp, T.c.accent, T.c.accentSft, T.c.muted, T.c.line];
    const pieColors = emph >= 0
      ? vals.map((_, i) => (i === emph ? T.c.accentDp : [T.c.accent, T.c.accentSft, T.c.muted, T.c.line, T.c.faint][i > emph ? i - 1 : i] || T.c.faint))
      : ramp.slice(0, Math.max(vals.length, 1));
    s.addChart(d.chartType === "doughnut" ? pres.charts.DOUGHNUT : pres.charts.PIE, series, {
      ...axisOpts, chartColors: pieColors,
      showLegend: true, legendPos: "b", legendColor: T.c.muted, legendFontFace: T.font.body, legendFontSize: 12,
      showPercent: true, dataLabelPosition: "outEnd",
      dataLabelColor: T.c.ink, dataLabelFontFace: T.font.body, dataLabelFontSize: 12,
      ...(d.chartType === "doughnut" ? { holeSize: 55 } : {}),
    });
  } else if (d.targetLine && typeof d.targetLine.value === "number") {
    // bars + a dashed reference line (前年 / 目標 …); its meaning goes in the takeaway
    const tvals = (d.series.labels || []).map(() => d.targetLine.value);
    s.addChart([
      { type: pres.charts.BAR, data: series, options: { chartColors: barColors, barDir: "col", barGapWidthPct: 55, ...labelOpts } },
      { type: pres.charts.LINE, data: [{ name: d.targetLine.label || "基準", labels: d.series.labels, values: tvals }],
        options: { chartColors: [T.c.accentDp], lineSize: 1.5, lineDash: "dash", lineDataSymbol: "none", showValue: false } },
    ], axisOpts);
  } else {
    // native column chart (editable in PowerPoint) — the default
    s.addChart(pres.charts.BAR, series, { ...axisOpts, barDir: "col", chartColors: barColors, barGapWidthPct: 55, ...labelOpts });
  }
  // unit shown ONCE (bottom-left, footnote position — same slot as the table
  // note), never repeated on every bar. Bottom, not top: a legal 2-line title
  // reaches the old top-left slot and collides (caught by render QA).
  if (d.unit) s.addText(`単位：${d.unit}`, { x: T.m, y: 6.66, w: 2.6, h: 0.28, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "left", valign: "top" });
  // takeaway card on the right
  const cx = 8.55, cw = T.W - T.m - cx;
  card(s, T, cx, 2.4, cw, 3.85, { fill: T.c.surfaceA });
  s.addText(richText(d.takeawayHead), { x: cx + 0.42, y: 2.8, w: cw - 0.84, h: 0.8, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.takeawayHead, bold: true, color: T.c.accentDp, align: "left", valign: "top",
    lineSpacingMultiple: T.lead.title });
  s.addText(richText(d.takeaway), { x: cx + 0.42, y: 3.78, w: cw - 0.84, h: 2.3, margin: 0,
    fontFace: T.font.body, fontSize: T.s.body, color: T.c.ink, align: "left", valign: "top",
    lineSpacingMultiple: T.lead.body });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideCTA(pres, d, T) {
  const s = pres.addSlide();
  s.background = { color: T.c.dark };
  bgLayer(s, T, d);
  s.addShape("ellipse", { x: -2.6, y: -2.6, w: 6.4, h: 6.4,
    fill: { color: T.c.darkAlt }, line: { type: "none" } });
  kicker(s, T, d.kicker, 1.5, { onDark: true });
  title(s, T, d.titleLines, 2.15, { onDark: true, size: T.s.message, w: 11 });
  // offer panel (rounded accent block = CTA, not a decorative stripe)
  const px = T.m, py = 4.25, pw = 8.7, ph = 1.85;
  s.addShape("roundRect", { x: px, y: py, w: pw, h: ph, rectRadius: 0.1,
    fill: { color: T.c.accent }, line: { type: "none" }, shadow: cardShadow(T) });
  s.addText(d.offerHead, { x: px + 0.5, y: py + 0.34, w: pw - 1, h: 0.5, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.offerHead, bold: true, color: T.c.onDark, align: "left", valign: "middle" });
  s.addText(richText(d.offerBody), { x: px + 0.5, y: py + 0.95, w: pw - 1, h: 0.75, margin: 0,
    fontFace: T.font.body, fontSize: T.s.small, color: T.c.onAccentMut, align: "left", valign: "top",
    lineSpacingMultiple: T.lead.tight });
  if (d.contact) s.addText(d.contact, { x: T.m, y: T.H - 0.78, w: 11.5, h: 0.35, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.footer, color: T.c.onDarkMut, align: "left", valign: "middle" });
  return s;
}

function slideSection(pres, d, T) {
  const s = pres.addSlide();
  s.background = { color: T.c.dark };
  bgLayer(s, T, d);
  // motif: large faint index number as a watermark (depth via a soft shape, not a
  // stripe). A theme may set sectionIndex:"none" to drop it for an austere chapter
  // break (minimal/editorial), or "left" for a big left-anchored numeral.
  if (d.index != null && T.layout.sectionIndex !== "none") {
    const left = T.layout.sectionIndex === "left";
    s.addText(String(d.index), {
      x: left ? T.m : 8.4, y: 1.2, w: left ? 8.4 - T.m : T.W - T.m - 8.4, h: 5.1, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.sectionIndex || 150, bold: true, color: T.c.darkAlt,
      align: left ? "left" : "right", valign: "middle" });
  }
  if (d.kicker) kicker(s, T, d.kicker, 2.95, { onDark: true });
  title(s, T, d.title, 3.5, { onDark: true, size: T.s.sectionTitle || 36, w: 8.0 });
  if (d.subtitle) s.addText(richText(d.subtitle), { x: T.m, y: 4.85, w: 8.0, h: 0.6, margin: 0,
    fontFace: T.font.body, fontSize: T.s.coverSub, color: T.c.onDarkMut, align: "left", valign: "top",
    lineSpacingMultiple: T.lead.tight });
  return s;
}

function slideStatGrid(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15);
  const stats = d.stats || [];
  const n = Math.max(stats.length, 1);
  const top = 2.7, h = 3.45, gap = 0.4;
  const totalW = T.W - 2 * T.m;
  const w = (totalW - (n - 1) * gap) / n;
  stats.forEach((st, i) => {
    const x = T.m + i * (w + gap);
    const emph = d.emphasizeIndex === i;
    card(s, T, x, top, w, h, { fill: emph ? T.c.surfaceA : T.c.surface });
    const pad = 0.4;
    // supporting icon (optional) — top-right corner, ABOVE the value band (value
    // glyphs start ~top+0.8) so a wide value like 40.7% is never crowded
    iconSlot(s, st.icon, x + w - pad - 0.5, top + 0.2, 0.5);
    s.addText(String(st.value), { x: x + pad, y: top + 0.5, w: w - 2 * pad, h: 1.2, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.statCard || 40, bold: true, color: emph ? T.c.accentDp : T.c.accent,
      align: "left", valign: "middle" });
    s.addText(st.label, { x: x + pad, y: top + 1.8, w: w - 2 * pad, h: 0.5, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink, align: "left", valign: "top" });
    if (st.sub) s.addText(richText(st.sub), { x: x + pad, y: top + 2.32, w: w - 2 * pad, h: 0.95, margin: 0,
      fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "top",
      lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* card-grid: 4-6 head+body cards in a 2-row grid (2x2 / 2+3 / 2x3). The TEXT
 * sibling of stat-grid — six BS 勘定科目 cards, six risk cards — where each cell
 * is a term plus one short explanation, not a headline number. Heads are one
 * line (the height gate rejects a wrapping head); bodies are height-gated per
 * card. emphasizeIndex tints one card (house emphasis: tint, never a stripe). */
const CARD_GRID = { top: 2.45, rowGap: 0.3, colGap: 0.4, cardH: 1.825, pad: 0.3, headH: 0.44, bodyTop: 0.66 };

function cardGridCell(T, n, i) {
  const g = CARD_GRID;
  const cols = Math.ceil(n / 2);
  const w = (T.W - 2 * T.m - (cols - 1) * g.colGap) / cols;
  const row = Math.floor(i / cols), col = i % cols;
  return { x: T.m + col * (w + g.colGap), y: g.top + row * (g.cardH + g.rowGap), w, h: g.cardH };
}

function slideCardGrid(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15);
  const cards = d.cards || [];
  const g = CARD_GRID;
  cards.forEach((cd, i) => {
    const cell = cardGridCell(T, cards.length, i);
    const emph = d.emphasizeIndex === i;
    card(s, T, cell.x, cell.y, cell.w, cell.h, { fill: emph ? T.c.surfaceA : T.c.surface });
    if (cd.head) s.addText(richText(cd.head), { x: cell.x + g.pad, y: cell.y + 0.16, w: cell.w - 2 * g.pad, h: g.headH,
      margin: 0, fontFace: T.font.heading, fontSize: T.s.head, bold: true,
      color: emph ? T.c.accentDp : T.c.ink, align: "left", valign: "top", lineSpacingMultiple: T.lead.tight });
    if (cd.body) s.addText(richText(cd.body), { x: cell.x + g.pad, y: cell.y + g.bodyTop, w: cell.w - 2 * g.pad,
      h: cell.h - g.bodyTop - 0.16, margin: 0, fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted,
      align: "left", valign: "top", lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideTable(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15);

  const cols = d.columns || [];
  const bodyRows = d.rows || [];
  // auto right-align a column whose body cells are all numeric-ish (good for figures)
  const numericRe = /^[\s¥$€£+\-()0-9.,%万億円人前年比pt％]+$/;
  const colAlign = cols.map((_, c) => {
    if (Array.isArray(d.colAlign) && d.colAlign[c]) return d.colAlign[c];
    const allNum = bodyRows.length > 0 && bodyRows.every((r) => {
      const cell = r[c] == null ? "" : String(r[c]).trim();
      return cell !== "" && numericRe.test(cell);
    });
    return allNum ? "right" : "left";
  });

  const headerRow = cols.map((cText, c) => ({ text: String(cText),
    options: { fill: { color: T.c.accent }, color: T.c.onDark, bold: true, fontFace: T.font.heading, align: colAlign[c], valign: "middle" } }));
  const tableRows = [headerRow];
  bodyRows.forEach((r, ri) => {
    const fill = ri % 2 === 0 ? T.c.bg : T.c.surface;
    tableRows.push(r.map((cell, c) => ({ text: cell == null ? "" : String(cell),
      options: { fill: { color: fill }, color: T.c.ink, fontFace: T.font.body, align: colAlign[c], valign: "middle" } })));
  });

  const nRows = tableRows.length;
  const rowH = Math.min(0.62, 3.9 / nRows);
  s.addTable(tableRows, {
    x: T.m, y: 2.25, w: T.W - 2 * T.m,
    colW: Array.isArray(d.colW) ? d.colW : undefined,
    rowH,
    fontFace: T.font.body, fontSize: T.s.body, color: T.c.ink,
    border: { type: "solid", pt: 0.5, color: T.c.line },
    align: "left", valign: "middle",
    margin: [3, 8, 3, 8],
    autoPage: false,
  });

  if (d.note) s.addText(d.note, { x: T.m, y: 6.62, w: T.W - 2 * T.m, h: 0.32, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.faint, align: "left", valign: "middle" });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- pattern registry ---------------- */
/* ---------------- DIAGRAM: flow (N steps, arrow-connected) ----------------
 * A base structure ("skeleton"): native roundRect nodes + native arrows drawn
 * from diagrams.js geometry, native labels centered inside. Robust for 3-6 steps
 * (design-lint caps it); node width auto-computed from n, with a vertical-stack
 * fallback when horizontal nodes get too narrow. The floor applies per node:
 * geometry.js measures each node label (kinsoku/orphan) and the height gate fails
 * a node whose text overflows its box. */
function slideFlow(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const steps = d.steps || [];
  const { nodes, arrows } = flowLayout(T, steps.length, d.direction);
  const rad = T.layout.card.radius;
  // arrows first (behind the nodes)
  arrows.forEach((a) => {
    s.addShape("line", {
      x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
      w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1),
      flipH: a.x2 < a.x1, flipV: a.y2 < a.y1,
      line: { color: T.c.accent, width: 2, endArrowType: "triangle" },
    });
  });
  steps.forEach((st, i) => {
    const node = nodes[i]; if (!node) return;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, rectRadius: rad,
      fill: { color: T.c.surface }, line: { color: T.c.accent, width: 1.25 } });
    const tb = nodeTextBox(node);
    s.addText(richText(st), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: cycle (N nodes on a ring, cyclic arrows) ----------------
 * A repeating loop (PDCA, a lifecycle). Native roundRect nodes placed on an
 * elliptical ring + native arrows between adjacent nodes (stopping short so the
 * head shows the clockwise direction). Robust for 3-6 nodes (design-lint caps it);
 * the floor gates each node label like a card. */
function slideCycle(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const steps = d.steps || [];
  const { nodes, arrows } = cycleLayout(T, steps.length);
  const rad = T.layout.card.radius;
  arrows.forEach((a) => {
    s.addShape("line", {
      x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
      w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1),
      flipH: a.x2 < a.x1, flipV: a.y2 < a.y1,
      line: { color: T.c.accent, width: 2, endArrowType: "triangle" },
    });
  });
  steps.forEach((st, i) => {
    const node = nodes[i]; if (!node) return;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, rectRadius: rad,
      fill: { color: T.c.surface }, line: { color: T.c.accent, width: 1.25 } });
    const tb = nodeTextBox(node);
    s.addText(richText(st), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: matrix (2x2 — two axes, four quadrants) ----------------
 * A 2-axis positioning (BCG / effort-impact / SWOT). Native frame + cross lines +
 * axis labels (X on top, Y on the left, in reserved bands that never touch the
 * cells) + a head/body per quadrant. Each quadrant is a BOUNDED CELL: the floor
 * height-gates its body exactly like a card. Optional emphasizeIndex tints one
 * quadrant. */
function slideMatrix(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const L = matrixLayout(T), g = L.grid, rad = T.layout.card.radius;
  const emph = Number.isInteger(d.emphasizeIndex) ? d.emphasizeIndex : -1;
  // emphasized quadrant tint (drawn first, under the frame/cross)
  if (emph >= 0 && L.quads[emph]) {
    const q = L.quads[emph];
    s.addShape("rect", { x: q.x, y: q.y, w: q.w, h: q.h, fill: { color: T.c.surfaceA }, line: { type: "none" } });
  }
  // outer frame + cross (two axes)
  s.addShape("roundRect", { x: g.x, y: g.y, w: g.w, h: g.h, rectRadius: rad, fill: { type: "none" }, line: { color: T.c.line, width: 1.5 } });
  s.addShape("line", { x: g.x + g.w / 2, y: g.y, w: 0, h: g.h, line: { color: T.c.line, width: 1.25 } });
  s.addShape("line", { x: g.x, y: g.y + g.h / 2, w: g.w, h: 0, line: { color: T.c.line, width: 1.25 } });
  // axis labels (in the reserved bands — cannot collide with quadrant text)
  (d.axisX || []).slice(0, 2).forEach((t, i) => {
    if (!t) return; const b = L.xLabelBoxes[i];
    s.addText(richText(t), { x: b.x, y: b.y, w: b.w, h: b.h, margin: 0, fontFace: T.font.caption, fontSize: T.s.small, bold: true, color: T.c.muted, align: b.align, valign: "bottom" });
  });
  (d.axisY || []).slice(0, 2).forEach((t, i) => {
    if (!t) return; const b = L.yLabelBoxes[i];
    s.addText(richText(t), { x: b.x, y: b.y, w: b.w, h: b.h, margin: 0, fontFace: T.font.caption, fontSize: T.s.small, bold: true, color: T.c.muted, align: b.align, valign: "middle" });
  });
  // quadrant head + body
  (d.quadrants || []).slice(0, 4).forEach((qd, i) => {
    const q = L.quads[i]; if (!q || !qd) return;
    if (qd.head) {
      const hb = quadHeadBox(q);
      s.addText(qd.head, { x: hb.x, y: hb.y, w: hb.w, h: hb.h, margin: 0, fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: i === emph ? T.c.accentDp : T.c.ink, align: "left", valign: "top" });
    }
    if (qd.body) {
      const bb = quadBodyBox(q, !!qd.head);
      s.addText(richText(qd.body), { x: bb.x, y: bb.y, w: bb.w, h: bb.h, margin: 0, fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "top", lineSpacingMultiple: T.lead.tight });
    }
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: timeline (N dated milestones on a horizontal spine) ----------------
 * 沿革 / company history / product milestones. One native arrow line (time flows
 * left -> right), an accent dot per milestone, date + label alternating above /
 * below the line (even up, odd down) so adjacent texts keep clear air. Robust for
 * 3-7 milestones (design-lint caps it via CAPS.timeline); the floor gates each
 * label box like a card (kinsoku bake + height gate), and the fixed-height date
 * band turns a 2-line date into an OVERFLOW error instead of a silent collision. */
function slideTimeline(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const ms = d.milestones || [];
  const L = timelineLayout(T, ms.length);
  // the spine (behind the dots), arrowhead showing time direction
  s.addShape("line", {
    x: L.line.x1, y: L.line.y1, w: L.line.x2 - L.line.x1, h: 0,
    line: { color: T.c.accent, width: 2, endArrowType: "triangle" },
  });
  ms.forEach((m, i) => {
    const g = L.milestones[i]; if (!g) return;
    s.addShape("ellipse", { x: g.dot.x, y: g.dot.y, w: g.dot.d, h: g.dot.d,
      fill: { color: T.c.accent }, line: { color: T.c.bg, width: 1.5 } });
    if (m.date) s.addText(richText(m.date), { x: g.dateBox.x, y: g.dateBox.y, w: g.dateBox.w, h: g.dateBox.h,
      margin: 0, fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.accentDp,
      align: "center", valign: g.above ? "bottom" : "top" });
    if (m.label) s.addText(richText(m.label), { x: g.labelBox.x, y: g.labelBox.y, w: g.labelBox.w, h: g.labelBox.h,
      margin: 0, fontFace: T.font.body, fontSize: T.s.small, color: T.c.ink,
      align: "center", valign: g.above ? "bottom" : "top", lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: steps (N ascending stages, 階段状) ----------------
 * A staircase read left-bottom -> right-top: stages that BUILD toward a goal
 * (成長ステップ, 導入フェーズ). Blocks share one bottom baseline and rise
 * linearly; the last (goal) block is tinted surfaceAccent — the same emphasis
 * convention as the comparison/stat-grid cards (a tint, never a stripe). Robust
 * for 3-5 stages (CAPS.steps); the floor gates each label against its own block,
 * so the shortest FIRST block is the binding constraint, not the tall goal. */
function slideSteps(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const steps = d.steps || [];
  const { nodes } = stepsLayout(T, steps.length);
  const rad = T.layout.card.radius;
  steps.forEach((st, i) => {
    const node = nodes[i]; if (!node) return;
    const goal = i === steps.length - 1;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, rectRadius: rad,
      fill: { color: goal ? T.c.surfaceA : T.c.surface },
      line: { color: goal ? T.c.accentDp : T.c.accent, width: 1.25 } });
    const tb = nodeTextBox(node);
    s.addText(richText(st), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true,
      color: goal ? T.c.accentDp : T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: branch (1 -> N diverge / N -> 1 converge) ----------------
 * One anchor node and N stacked nodes, arrows fanning between them.
 * direction "diverge" (default): the single source (left, tinted) feeds the
 * branches. "converge": the branches merge into the single result (right,
 * tinted). The tinted single node = the house emphasis convention. Robust for
 * 2-4 branches (CAPS.branch); every node label is baked + height-gated. */
function slideBranch(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const branches = d.branches || [];
  const L = branchLayout(T, branches.length, d.direction);
  const rad = T.layout.card.radius;
  L.arrows.forEach((a) => {
    s.addShape("line", {
      x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
      w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1),
      flipH: a.x2 < a.x1, flipV: a.y2 < a.y1,
      line: { color: T.c.accent, width: 2, endArrowType: "triangle" },
    });
  });
  // the single anchor (source or result) — tinted, like the steps goal block
  s.addShape("roundRect", { x: L.single.x, y: L.single.y, w: L.single.w, h: L.single.h, rectRadius: rad,
    fill: { color: T.c.surfaceA }, line: { color: T.c.accentDp, width: 1.25 } });
  if (d.source) {
    const tb = nodeTextBox(L.single);
    s.addText(richText(d.source), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.accentDp,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  }
  branches.forEach((b, i) => {
    const node = L.many[i]; if (!node) return;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, rectRadius: rad,
      fill: { color: T.c.surface }, line: { color: T.c.accent, width: 1.25 } });
    const tb = nodeTextBox(node);
    s.addText(richText(b), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: formula ([result =] A × B × C) ----------------
 * A quantity decomposed into factors (売上 = 客数 × 客単価 × 店舗数, ROE デュポン
 * 分解) or summands (operator: "+"). The optional result box is tinted (house
 * emphasis); operator glyphs are native text in fixed cells between the boxes.
 * 2-4 operands (CAPS.formula); every label is baked + height-gated per box. */
function slideFormula(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const operands = d.operands || [];
  const hasResult = !!d.result;
  const L = formulaLayout(T, operands.length, hasResult);
  const rad = T.layout.card.radius;
  const opGlyph = d.operator === "+" ? "＋" : "×";
  const labels = hasResult ? [d.result, ...operands] : operands;
  L.nodes.forEach((node, i) => {
    const isResult = node.role === "result";
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, rectRadius: rad,
      fill: { color: isResult ? T.c.surfaceA : T.c.surface },
      line: { color: isResult ? T.c.accentDp : T.c.accent, width: 1.25 } });
    const tb = nodeTextBox(node);
    if (labels[i]) s.addText(richText(labels[i]), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true,
      color: isResult ? T.c.accentDp : T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  L.ops.forEach((op) => {
    s.addText(op.glyph || opGlyph, { x: op.x, y: op.y, w: op.w, h: op.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.title, bold: true, color: T.c.accent,
      align: "center", valign: "middle" });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: waterfall (cumulative bridge, 増減要因分解) ----------------
 * 営業利益ブリッジ / 売上100円の行き先. Native rects + native text (editable, no
 * chart hack): totals accentDeep from zero, increases accent, decreases muted;
 * a light zero line; dashed connectors carry the running level to the next bar.
 * Value labels are ENGINE-formatted — negatives always ▲ (never − or △),
 * totals plain, deltas signed (+/▲). 3-8 items (CAPS.waterfall). */
function slideWaterfall(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const items = d.items || [];
  const L = waterfallLayout(T, items);
  const anyDecimal = items.some((it) => typeof it.value === "number" && !Number.isInteger(it.value));
  const fmt = (v) => {
    const a = Math.abs(v);
    const [int, dec] = (anyDecimal ? a.toFixed(1) : String(Math.round(a))).split(".");
    return int.replace(/\B(?=(\d{3})+$)/g, ",") + (dec ? `.${dec}` : "");
  };
  // zero line behind everything, then connectors, then bars
  s.addShape("line", { x: L.area.x, y: L.zeroY, w: L.area.w, h: 0, line: { color: T.c.line, width: 1 } });
  L.connectors.forEach((cn) => {
    s.addShape("line", { x: cn.x1, y: cn.y, w: cn.x2 - cn.x1, h: 0,
      line: { color: T.c.muted, width: 1, dashType: "dash" } });
  });
  items.forEach((it, i) => {
    const bar = L.bars[i]; if (!bar) return;
    const fill = bar.kind === "total" ? T.c.accentDp : bar.kind === "up" ? T.c.accent : T.c.muted;
    s.addShape("rect", { x: bar.x, y: bar.y, w: bar.w, h: bar.h, fill: { color: fill }, line: { type: "none" } });
    const vb = L.valueBoxes[i];
    const label = bar.kind === "total" ? fmt(it.value) : (it.value >= 0 ? `+${fmt(it.value)}` : `▲${fmt(it.value)}`);
    s.addText(label, { x: vb.x, y: vb.y, w: vb.w, h: vb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.small, bold: true,
      color: bar.kind === "total" ? T.c.accentDp : T.c.ink, align: "center", valign: "bottom" });
    const cb = L.catBoxes[i];
    if (it.label) s.addText(richText(it.label), { x: cb.x, y: cb.y, w: cb.w, h: cb.h, margin: 0,
      fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted, align: "center", valign: "top",
      lineSpacingMultiple: T.lead.tight });
  });
  if (d.unit) s.addText(`単位：${d.unit}`, { x: T.m, y: 6.66, w: 2.6, h: 0.28, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "left", valign: "top" });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

const PATTERNS = {
  "cover": slideCover,
  "message": slideMessage,
  "two-column": slideTwoColumn,
  "comparison": slideComparison,
  "chart": slideChart,
  "cta": slideCTA,
  "section": slideSection,
  "stat-grid": slideStatGrid,
  "card-grid": slideCardGrid,
  "table": slideTable,
  "flow": slideFlow,
  "cycle": slideCycle,
  "matrix": slideMatrix,
  "timeline": slideTimeline,
  "steps": slideSteps,
  "branch": slideBranch,
  "formula": slideFormula,
  "waterfall": slideWaterfall,
};

/* ---------------- deck plan ---------------- */
function loadPlan(planPath) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(planPath, "utf8"));
  } catch (e) {
    throw new Error(`Cannot read deck plan "${planPath}": ${e.message}`);
  }
  if (Array.isArray(j)) return { meta: {}, slides: j };
  if (j && Array.isArray(j.slides)) return { meta: j.meta || {}, slides: j.slides };
  throw new Error("Deck plan must be an array, or an object with a 'slides' array.");
}

/* ---------------- build ---------------- */
function build({ plan, theme, out }) {
  const T = loadTheme(theme);
  const { meta, slides } = loadPlan(plan);
  const brand = (meta.footerLabel != null ? meta.footerLabel : (T.brand.footerLabel || "")) || "";
  const showPage = meta.showPageNumbers !== false;

  const pres = new pptxgen();
  pres.defineLayout({ name: "WIDE", width: T.W, height: T.H });
  pres.layout = "WIDE";
  pres.author = meta.author || "pptx-creation-plugin";
  pres.title = meta.title || "";

  slides.forEach((sl, i) => {
    const fn = PATTERNS[sl.pattern];
    if (!fn) {
      throw new Error(`Unknown pattern "${sl.pattern}" at slide ${i + 1}. ` +
        `Known patterns: ${Object.keys(PATTERNS).join(", ")}`);
    }
    const content = sl.content || {};
    const s = fn(pres, content, T, { brand, pageNum: i + 1, showPage });
    if (content.notes && s && typeof s.addNotes === "function") s.addNotes(content.notes);
  });

  return pres.writeFile({ fileName: out }).then(() => {
    console.log(`written ${out}  (${slides.length} slides, theme: ${T.name})`);
    return out;
  });
}

/* ---------------- main ---------------- */
function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    console.error(e.message + "\n\n" + USAGE);
    process.exit(2);
  }
  if (args.help) { console.log(USAGE); return; }
  if (!args.plan || !args.out) {
    console.error("Missing required --plan and/or --out.\n\n" + USAGE);
    process.exit(2);
  }
  if (!args.theme) {
    args.theme = path.join(__dirname, "..", "themes", "_default-neutral", "theme.json");
  }
  const fail = (e) => {
    console.error("generate failed: " + (e && e.message ? e.message : e));
    process.exit(1);
  };
  // build() can throw synchronously (bad JSON, unknown pattern) OR reject
  // asynchronously (writeFile); handle both so neither leaks a raw stack trace.
  let result;
  try {
    result = build(args);
  } catch (e) {
    fail(e);
    return;
  }
  Promise.resolve(result).catch(fail);
}

if (require.main === module) main();

module.exports = { build, loadTheme, loadPlan, PATTERNS };
