#!/usr/bin/env node
/* ============================================================
 *  pptx-creation — deck engine
 *  Refactored from the verified build_deck.js prototype.
 *
 *  3-layer separation (kept intact from the prototype):
 *    THEME tokens     -> themes/<name>/theme.json   (per-project brand)
 *    pattern builders -> this file (token-reference only; the "recipes")
 *    deck content     -> deck_plan.json             (per-project content)
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
  return {
    name: j.name || "theme",
    W: j.canvas.w, H: j.canvas.h, m: j.canvas.margin,
    font: (j.font && j.font.family) || "Meiryo",
    c,
    s: { ...j.sizes },
    brand: j.brand || {},
  };
}

/* fresh shadow object each call (pptxgenjs mutates option objects) */
const cardShadow = (T) => ({ type: "outer", color: T.c.ink, blur: 10, offset: 4, angle: 90, opacity: 0.12 });

/* ---------------- low-level helpers ---------------- */
function kicker(slide, T, text, y, { x = T.m, onDark = false } = {}) {
  const F = T.font;
  slide.addShape("ellipse", { x, y: y + 0.055, w: 0.13, h: 0.13,
    fill: { color: T.c.accent }, line: { type: "none" } });
  slide.addText(text, { x: x + 0.26, y, w: 8, h: 0.3, margin: 0,
    fontFace: F, fontSize: T.s.kicker, bold: true, charSpacing: 1,
    color: onDark ? T.c.accentSft : T.c.accent, align: "left", valign: "middle" });
}

function title(slide, T, lines, y, { x = T.m, w = T.W - 2 * T.m, onDark = false, size = T.s.title } = {}) {
  const F = T.font;
  const arr = (Array.isArray(lines) ? lines : [lines]).map((t, i, a) => ({
    text: t, options: { breakLine: i < a.length - 1 } }));
  slide.addText(arr, { x, y, w, h: 0.55 * (Array.isArray(lines) ? lines.length : 1) + 0.4, margin: 0,
    fontFace: F, fontSize: size, bold: true, lineSpacingMultiple: 1.12,
    color: onDark ? T.c.onDark : T.c.ink, align: "left", valign: "top" });
}

function numCircle(slide, T, n, x, y, d = 0.46) {
  const F = T.font;
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: T.c.accent }, line: { type: "none" } });
  slide.addText(String(n), { x, y, w: d, h: d, margin: 0, align: "center", valign: "middle",
    fontFace: F, fontSize: T.s.num, bold: true, color: T.c.onDark });
}

function card(slide, T, x, y, w, h, { fill = T.c.surface } = {}) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.09,
    fill: { color: fill }, line: { type: "none" }, shadow: cardShadow(T) });
}

function footer(slide, T, brand, page, showPage) {
  const F = T.font;
  if (brand) {
    slide.addText(brand, { x: T.m, y: T.H - 0.42, w: 3, h: 0.3, margin: 0,
      fontFace: F, fontSize: T.s.cap, color: T.c.faint, align: "left", valign: "middle" });
  }
  if (showPage) {
    slide.addText(String(page), { x: T.W - T.m - 1, y: T.H - 0.42, w: 1, h: 0.3, margin: 0,
      fontFace: F, fontSize: T.s.cap, color: T.c.faint, align: "right", valign: "middle" });
  }
}

/* ===================== SLIDE PATTERNS ===================== */
/* Each builder: (pres, content, T, ctx) -> slide.
 * ctx = { brand, pageNum, showPage }. Builders reference theme TOKENS only —
 * no hardcoded colors or point sizes. */

function slideCover(pres, d, T) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.dark };
  // depth motif: large soft oval, partly off-canvas (NOT a stripe)
  s.addShape("ellipse", { x: 9.2, y: 3.7, w: 7.2, h: 7.2,
    fill: { color: T.c.darkAlt }, line: { type: "none" } });
  kicker(s, T, d.kicker, 1.55, { onDark: true });
  title(s, T, d.titleLines, 2.25, { onDark: true, size: T.s.cover, w: 10 });
  if (d.subtitle) s.addText(d.subtitle, { x: T.m, y: 4.55, w: 9.5, h: 0.5, margin: 0,
    fontFace: F, fontSize: T.s.coverSub, color: T.c.onDarkMut, align: "left", valign: "top" });
  if (d.footer) s.addText(d.footer, { x: T.m, y: T.H - 0.85, w: 9, h: 0.35, margin: 0,
    fontFace: F, fontSize: T.s.footer, color: T.c.onDarkMut, align: "left", valign: "middle" });
  return s;
}

function slideMessage(pres, d, T, ctx) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  kicker(s, T, d.kicker, T.m);
  // centered single statement
  const msg = d.messageLines.map((t, i, a) => ({ text: t, options: { breakLine: i < a.length - 1 } }));
  s.addText(msg, { x: 1.0, y: 1.95, w: T.W - 2.0, h: 1.7, margin: 0,
    fontFace: F, fontSize: T.s.message, bold: true, color: T.c.ink, align: "center", valign: "middle",
    lineSpacingMultiple: 1.16 });
  // big stat callout
  if (d.statBig) s.addText(d.statBig, { x: 1.0, y: 3.95, w: T.W - 2.0, h: 1.15, margin: 0,
    fontFace: F, fontSize: T.s.stat, bold: true, color: T.c.accent, align: "center", valign: "middle" });
  if (d.statCaption) s.addText(d.statCaption, { x: 2.6, y: 5.2, w: T.W - 5.2, h: 0.8, margin: 0,
    fontFace: F, fontSize: T.s.small, color: T.c.muted, align: "center", valign: "top",
    lineSpacingMultiple: 1.25 });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideTwoColumn(pres, d, T, ctx) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15, { w: 7.0 });
  // left: lead paragraph
  if (d.lead) s.addText(d.lead, { x: T.m, y: 2.5, w: 5.2, h: 3.6, margin: 0,
    fontFace: F, fontSize: T.s.body, color: T.c.muted, align: "left", valign: "top",
    lineSpacingMultiple: 1.45 });
  // right: numbered rows
  const rx = 6.45, rw = T.W - T.m - rx, top = 2.45, gap = 1.42;
  d.items.forEach((it, i) => {
    const y = top + i * gap;
    numCircle(s, T, it.n, rx, y);
    s.addText(it.head, { x: rx + 0.66, y: y - 0.05, w: rw - 0.66, h: 0.4, margin: 0,
      fontFace: F, fontSize: T.s.head, bold: true, color: T.c.ink, align: "left", valign: "middle" });
    s.addText(it.body, { x: rx + 0.66, y: y + 0.42, w: rw - 0.66, h: 0.7, margin: 0,
      fontFace: F, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "top",
      lineSpacingMultiple: 1.3 });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideComparison(pres, d, T, ctx) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15);
  const top = 2.45, h = 4.05, gap = 0.5;
  const w = (T.W - 2 * T.m - gap) / 2;
  const lx = T.m, rx = T.m + w + gap;
  // left card (neutral) / right card (accent emphasis) — tint+shadow, no stripes
  card(s, T, lx, top, w, h, { fill: T.c.surface });
  card(s, T, rx, top, w, h, { fill: T.c.surfaceA });
  const drawCol = (x, col, accent) => {
    const pad = 0.45;
    s.addText(col.label, { x: x + pad, y: top + 0.4, w: w - 2 * pad, h: 0.5, margin: 0,
      fontFace: F, fontSize: T.s.compareLabel, bold: true, color: accent ? T.c.accentDp : T.c.ink, align: "left", valign: "middle" });
    s.addText(col.role, { x: x + pad, y: top + 0.95, w: w - 2 * pad, h: 0.35, margin: 0,
      fontFace: F, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "middle" });
    const bullets = col.points.map((p) => ({ text: p,
      options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 10 } }));
    s.addText(bullets, { x: x + pad, y: top + 1.5, w: w - 2 * pad, h: h - 1.9, margin: 0,
      fontFace: F, fontSize: T.s.body, color: T.c.ink, align: "left", valign: "top" });
  };
  drawCol(lx, d.left, false);
  drawCol(rx, d.right, true);
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideChart(pres, d, T, ctx) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15, { w: 8.5 });
  // Data-label precision must not misrepresent the values: if any value has a
  // fractional part, keep one decimal (so 21.8 and 23.1 don't both read "23").
  // An explicit d.valueFormat overrides the auto-detection.
  const hasDecimal = (d.series.values || []).some((v) => typeof v === "number" && !Number.isInteger(v));
  const valueFormat = d.valueFormat || (hasDecimal ? "#,##0.0" : "#,##0");
  // native column chart (editable in PowerPoint)
  s.addChart(pres.charts.BAR, [{
    name: d.series.name, labels: d.series.labels, values: d.series.values
  }], {
    x: T.m, y: 2.15, w: 7.5, h: 4.4, barDir: "col",
    chartColors: [T.c.accent],
    chartArea: { fill: { color: T.c.bg } },
    showLegend: false, showTitle: false,
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    catAxisLabelColor: T.c.muted, catAxisLabelFontFace: F, catAxisLabelFontSize: 12,
    catAxisLineShow: false,
    showValue: true, dataLabelPosition: "outEnd",
    dataLabelColor: T.c.ink, dataLabelFontFace: F, dataLabelFontSize: 12, dataLabelFormatCode: valueFormat,
    barGapWidthPct: 55,
  });
  // takeaway card on the right
  const cx = 8.55, cw = T.W - T.m - cx;
  card(s, T, cx, 2.35, cw, 3.9, { fill: T.c.surfaceA });
  s.addText(d.takeawayHead, { x: cx + 0.4, y: 2.75, w: cw - 0.8, h: 0.8, margin: 0,
    fontFace: F, fontSize: T.s.takeawayHead, bold: true, color: T.c.accentDp, align: "left", valign: "top",
    lineSpacingMultiple: 1.15 });
  s.addText(d.takeaway, { x: cx + 0.4, y: 3.75, w: cw - 0.8, h: 2.3, margin: 0,
    fontFace: F, fontSize: T.s.body, color: T.c.ink, align: "left", valign: "top",
    lineSpacingMultiple: 1.45 });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideCTA(pres, d, T) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.dark };
  s.addShape("ellipse", { x: -2.6, y: -2.6, w: 6.4, h: 6.4,
    fill: { color: T.c.darkAlt }, line: { type: "none" } });
  kicker(s, T, d.kicker, 1.5, { onDark: true });
  title(s, T, d.titleLines, 2.15, { onDark: true, size: T.s.message, w: 11 });
  // offer panel (rounded accent block = CTA, not a decorative stripe)
  const px = T.m, py = 4.25, pw = 8.7, ph = 1.85;
  s.addShape("roundRect", { x: px, y: py, w: pw, h: ph, rectRadius: 0.1,
    fill: { color: T.c.accent }, line: { type: "none" }, shadow: cardShadow(T) });
  s.addText(d.offerHead, { x: px + 0.5, y: py + 0.32, w: pw - 1, h: 0.5, margin: 0,
    fontFace: F, fontSize: T.s.offerHead, bold: true, color: T.c.onDark, align: "left", valign: "middle" });
  s.addText(d.offerBody, { x: px + 0.5, y: py + 0.92, w: pw - 1, h: 0.75, margin: 0,
    fontFace: F, fontSize: T.s.small, color: T.c.onAccentMut, align: "left", valign: "top",
    lineSpacingMultiple: 1.35 });
  if (d.contact) s.addText(d.contact, { x: T.m, y: T.H - 0.78, w: 11.5, h: 0.35, margin: 0,
    fontFace: F, fontSize: T.s.footer, color: T.c.onDarkMut, align: "left", valign: "middle" });
  return s;
}

function slideSection(pres, d, T) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.dark };
  // motif: large faint index number as a watermark (depth via a soft shape, not a stripe)
  if (d.index != null) s.addText(String(d.index), { x: 8.4, y: 1.2, w: T.W - T.m - 8.4, h: 5.1, margin: 0,
    fontFace: F, fontSize: T.s.sectionIndex || 150, bold: true, color: T.c.darkAlt, align: "right", valign: "middle" });
  if (d.kicker) kicker(s, T, d.kicker, 2.95, { onDark: true });
  title(s, T, d.title, 3.5, { onDark: true, size: T.s.sectionTitle || 36, w: 8.0 });
  if (d.subtitle) s.addText(d.subtitle, { x: T.m, y: 4.85, w: 8.0, h: 0.6, margin: 0,
    fontFace: F, fontSize: T.s.coverSub, color: T.c.onDarkMut, align: "left", valign: "top",
    lineSpacingMultiple: 1.3 });
  return s;
}

function slideStatGrid(pres, d, T, ctx) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
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
    s.addText(String(st.value), { x: x + pad, y: top + 0.5, w: w - 2 * pad, h: 1.2, margin: 0,
      fontFace: F, fontSize: T.s.statCard || 40, bold: true, color: emph ? T.c.accentDp : T.c.accent,
      align: "left", valign: "middle" });
    s.addText(st.label, { x: x + pad, y: top + 1.8, w: w - 2 * pad, h: 0.5, margin: 0,
      fontFace: F, fontSize: T.s.head, bold: true, color: T.c.ink, align: "left", valign: "top" });
    if (st.sub) s.addText(st.sub, { x: x + pad, y: top + 2.32, w: w - 2 * pad, h: 0.95, margin: 0,
      fontFace: F, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "top",
      lineSpacingMultiple: 1.3 });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideTable(pres, d, T, ctx) {
  const F = T.font;
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
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
    options: { fill: { color: T.c.accent }, color: T.c.onDark, bold: true, align: colAlign[c], valign: "middle" } }));
  const tableRows = [headerRow];
  bodyRows.forEach((r, ri) => {
    const fill = ri % 2 === 0 ? T.c.bg : T.c.surface;
    tableRows.push(r.map((cell, c) => ({ text: cell == null ? "" : String(cell),
      options: { fill: { color: fill }, color: T.c.ink, align: colAlign[c], valign: "middle" } })));
  });

  const nRows = tableRows.length;
  const rowH = Math.min(0.62, 3.9 / nRows);
  s.addTable(tableRows, {
    x: T.m, y: 2.25, w: T.W - 2 * T.m,
    colW: Array.isArray(d.colW) ? d.colW : undefined,
    rowH,
    fontFace: F, fontSize: T.s.body, color: T.c.ink,
    border: { type: "solid", pt: 0.5, color: T.c.line },
    align: "left", valign: "middle",
    margin: [3, 8, 3, 8],
    autoPage: false,
  });

  if (d.note) s.addText(d.note, { x: T.m, y: 6.62, w: T.W - 2 * T.m, h: 0.32, margin: 0,
    fontFace: F, fontSize: T.s.cap, color: T.c.faint, align: "left", valign: "middle" });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- pattern registry ---------------- */
const PATTERNS = {
  "cover": slideCover,
  "message": slideMessage,
  "two-column": slideTwoColumn,
  "comparison": slideComparison,
  "chart": slideChart,
  "cta": slideCTA,
  "section": slideSection,
  "stat-grid": slideStatGrid,
  "table": slideTable,
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
