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
const { flowLayout, cycleLayout, matrixLayout, timelineLayout, stepsLayout, branchLayout, formulaLayout, waterfallLayout, identityLayout, identityTextSpec, breakevenLayout, nodeTextBox, quadHeadBox, quadBodyBox, emphSizePt, resolveStatGrid, personaLayout, positioningLayout, posHeadBox, posBodyBox, systemLayout, relationLayout, relationZones, relationIsPartition, emphColumnLayout, splitValueUnit, estTextWidthIn, fitValue, fitLabelPt, VALUE_JUMP, VALUE_JUMP_PEAK, UNIT_RATIO, BYSTANDER_FLOOR, EMPH_FLOOR, dialogueLayout, testimonialLayout } = require("./graphics/diagrams.js");

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
  // Optional semantic extensions (loadTheme falls back when a theme omits them):
  //   accentOnDark — the accent tuned for DARK grounds (a mid accent sinks on navy)
  //   warn         — the pain/negation colour (損害・✕・覚悟; 1用途限定, never decoration)
  //   warnOnDark   — warn tuned for dark grounds
  accentOnDark: "accentOnDk", warn: "warn", warnOnDark: "warnOnDk",
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
// marker.handDrawn: hand-drawn-wobble markers (circle) are OFF-REGISTER for
// business/financial decks (the reviewer's verdict: 採点マーク/落書き語彙) —
// every shipped theme keeps this false; an editorial project may opt in
// deliberately. design-lint hard-errors a circle without the opt-in.
// ELEVATION OVER OUTLINE (構成品質の床・最重要): no shape defines itself with
// a border — every card/node is FILL + a refined soft shadow. The elevation
// tiers are COLOR-INDEPENDENT structural tokens applied identically whatever
// the fill; hard drop-shadows are forbidden by construction (soft blur only).
//   base   — resting cards/nodes
//   raised — the emphasized/tinted element (one z-step up)
// Strokes, where used at all, are a single HAIRLINE (0.75pt, same-family light
// colour) — thick/dark borders are the wireframe tell this floor removes.
// Connectors are their own token: 2.5pt (2.25-2.75 band) + filled arrowheads.
const LAYOUT_DEFAULTS = {
  card: { radius: 0.1, shadow: true },
  elevation: {
    base: { blur: 10, offset: 4, angle: 90, opacity: 0.10 },
    raised: { blur: 14, offset: 6, angle: 90, opacity: 0.13 },
    zone: { blur: 8, offset: 2, angle: 90, opacity: 0.06 },
  },
  stroke: { hairline: 0.75 },
  connector: { width: 2.5 },
  kicker: "dot", coverMotif: "oval", sectionIndex: "right", marker: { handDrawn: false },
  // sectionStyle "chapter": no watermark numeral; kicker (default "CHAPTER N")
  // top-left; title + subtitle centered — the story-seminar chapter break.
  // coverQuoteAccent: “…” spans in the cover title render in the accent colour
  // (the ONE sanctioned inline-emphasis device — 強調は“ ”＋accent の2手段).
  sectionStyle: "watermark", coverQuoteAccent: false,
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
  // Semantic-extension fallbacks: themes that predate these tokens keep their
  // exact current rendering (warn falls back into the accent family — the
  // engine never invents a colour outside the theme).
  if (!c.accentOnDk) c.accentOnDk = c.accentSft;
  if (!c.warn) c.warn = c.accentDp || c.accent;
  if (!c.warnOnDk) c.warnOnDk = c.accentSft;
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
    marker: { ...LAYOUT_DEFAULTS.marker, ...(jl.marker || {}) },
    elevation: {
      base: { ...LAYOUT_DEFAULTS.elevation.base, ...((jl.elevation || {}).base || {}) },
      raised: { ...LAYOUT_DEFAULTS.elevation.raised, ...((jl.elevation || {}).raised || {}) },
      zone: { ...LAYOUT_DEFAULTS.elevation.zone, ...((jl.elevation || {}).zone || {}) },
    },
    stroke: { ...LAYOUT_DEFAULTS.stroke, ...(jl.stroke || {}) },
    connector: { ...LAYOUT_DEFAULTS.connector, ...(jl.connector || {}) },
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

/* fresh shadow object each call (pptxgenjs mutates option objects). Elevation
 * is the color-independent depth token (構成の既定 — elevation over outline):
 * same soft shadow whatever the fill colour. */
const elevShadow = (T, tier = "base") => {
  const e = (T.layout.elevation && T.layout.elevation[tier]) || T.layout.elevation.base;
  return { type: "outer", color: T.c.ink, blur: e.blur, offset: e.offset, angle: e.angle, opacity: e.opacity };
};
const cardShadow = (T) => elevShadow(T, "base");
// A node is a card-family member: FILL + elevation + hairline (never a thick
// accent border). `raised` lifts the emphasized element one z-step.
const nodeShape = (T, { emph = false } = {}) => ({
  rectRadius: T.layout.card.radius,
  fill: { color: emph ? T.c.accent : T.c.surface },
  line: { color: T.c.line, width: T.layout.stroke.hairline },
  shadow: elevShadow(T, emph ? "raised" : "base"),
});
const connLine = (T, over = {}) => ({ color: T.c.accent, width: T.layout.connector.width, ...over });

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

/* Emphasis slot (visual-psychology layer): a slide's content may name ONE
 * protagonist element via `emphasis` (an element index). Patterns that had the
 * older `emphasizeIndex` keep it working — `emphasis` is the canonical name,
 * `emphasizeIndex` the legacy alias where their visual treatment is identical
 * (matrix / card-grid); design-lint EMPHASIS-COUNT errors when both are set.
 * Unset => -1 => every builder renders byte-for-byte as before (no-regression).
 * The treatment reuses existing tokens ONLY (accent / accentDeep / surfaceAccent
 * / onDark + the shared size step in diagrams.js) — no new colors, no stripes
 * (house-quality-bar §2). See references/principles/visual-psychology.md. */
function emphIndex(d) {
  if (Number.isInteger(d.emphasis)) return d.emphasis;
  if (Number.isInteger(d.emphasizeIndex)) return d.emphasizeIndex;
  return -1;
}

/* ---------------- emphasis MARKERS (§2 — optional device on the protagonist) --
 * One marker per slide, attached to the SAME element the emphasis names
 * (message: the statBig). All figure work is code-drawn (M-7):
 *   circle     — hand-drawn-ish SVG ellipse stroke rasterized to a transparent
 *                2x PNG (recipes.js markerCircleSvg; make-markers.js fills
 *                marker.image). Skipped gracefully when the image is absent.
 *   badge      — native accent pill + NATIVE text riding the element's shoulder.
 *   arrow-note — native arrow + NATIVE one-line note pointing at the element.
 * Badge/note text must be a data-supported FACT (「過去最高」 only when it IS
 * the record) — design-lint blocks hype words; deck-review audits the claim. */
const BADGE_H = 0.34, BADGE_PT = 12, NOTE_PT = 12.5;

function markerBadge(s, T, text, rightX, topY) {
  const w = estTextWidthIn(text, BADGE_PT) + 0.3;
  s.addShape("roundRect", { x: rightX - w, y: topY, w, h: BADGE_H, rectRadius: BADGE_H / 2,
    fill: { color: T.c.accentDp }, line: { type: "none" }, shadow: cardShadow(T) });
  s.addText(text, { x: rightX - w, y: topY, w, h: BADGE_H, margin: 0,
    fontFace: T.font.heading, fontSize: BADGE_PT, bold: true, color: T.c.onDark,
    align: "center", valign: "middle" });
  return { x: rightX - w, y: topY, w, h: BADGE_H };
}

// Note text + a short arrow whose HEAD touches the element edge at (tipX,
// tipY) — the arrow CONNECTS (no floating gap; reviewer fix) and the note sits
// tight below the tail. Note wording must add information the card does not
// already show (design-lint errors on duplication).
function markerArrowNote(s, T, text, tipX, tipY, noteY) {
  const w = estTextWidthIn(text, NOTE_PT) + 0.2;
  const nx = tipX - w / 2;
  s.addShape("line", { x: tipX, y: tipY - 0.02, w: 0, h: Math.max(noteY - tipY, 0.16), flipV: true,
    line: { color: T.c.accentDp, width: 2.25, endArrowType: "triangle" } });
  s.addText(text, { x: nx, y: noteY, w, h: 0.3, margin: 0,
    fontFace: T.font.heading, fontSize: NOTE_PT, bold: true, color: T.c.accentDp,
    align: "center", valign: "top" });
}

// Solid accent underline beneath the number — the "adult" strong-pop device
// (intentional geometry, native shape, no hand-drawn wobble). Redundant with
// the size channel by design (CUD: never hue alone).
function markerUnderline(s, T, x, y, w) {
  s.addShape("roundRect", { x, y, w, h: 0.07, rectRadius: 0.035,
    fill: { color: T.c.accent }, line: { type: "none" } });
}

/* ---------------- persona: the asset-independent human device ----------------
 * Education register only (education-register.md §3; register-gate lint ERRORs
 * it on financial/board — the engine also refuses, belt and braces). The
 * COMPOSITION (figure + seamless single-path bubble + native quote + ※例
 * marking) never changes with the figure's source: (a) in-engine SVG default
 * or (b) a user-licensed PNG drop-in — swap them and the coordinates stay
 * identical (personaLayout is the single source; make-markers materializes the
 * raster assets). Quote text is NATIVE (crisp, editable) and goes through the
 * bake floor (kinsoku + number atoms) via geometry.js. */
function personaDevice(s, T, p, pattern, ctx) {
  if (!p || typeof p !== "object" || !p.quote) return;
  if (ctx.intent === "financial" || ctx.intent === "board") {
    console.log(`  persona: SKIPPED — register gate (intent=${ctx.intent}): 人型デバイス・吹き出しは financial/board で常時OFF`);
    return;
  }
  const L = personaLayout(p, T, pattern);
  // figureImage is resolved by make-markers ONLY from (a) a user-supplied
  // licensed asset (p.figure) or (b) the explicit pictogram opt-in
  // (p.style === "pictogram"). Neither -> the voice renders without a person
  // (bubble + quote + ※例) and design-lint states the policy (PERSONA-FIGURE).
  if (p.figureImage) s.addImage({ path: p.figureImage, x: L.fig.x, y: L.fig.y, w: L.fig.w, h: L.fig.h });
  if (p.bubbleImage) s.addImage({ path: p.bubbleImage, x: L.bubble.x, y: L.bubble.y, w: L.bubble.w, h: L.bubble.h });
  if (p.symbolImage && L.symbol) s.addImage({ path: p.symbolImage, x: L.symbol.x, y: L.symbol.y, w: L.symbol.w, h: L.symbol.h });
  s.addText(richText(p.quote), { x: L.quote.x, y: L.quote.y, w: L.quote.w, h: L.quote.h, margin: 0,
    fontFace: T.font.body, fontSize: L.quotePt, color: T.c.ink, align: "left", valign: "middle",
    lineSpacingMultiple: L.quoteLead });
  // ※例 marking (捏造ガード): fictional persona/example figures must SAY so.
  if (p.mark) s.addText(p.mark, { x: L.mark.x, y: L.mark.y, w: L.mark.w, h: L.mark.h, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: L.mark.align, valign: "top" });
}

// Circle overlay: the pre-rasterized hand-drawn ellipse PNG, centered on the
// glyph bounds (cx, cy) with breathing room — the stroke must never cross the
// glyph cores (image-lint checks the asset's centre stays transparent). The
// pads are shared with circleMarkerSize (make-markers) so the asset always
// matches the placement box; glyph width is an ESTIMATE, so the pads are
// generous (the ring must clear real glyph extremes on any renderer).
const CIRCLE_PAD_W = 0.7, CIRCLE_PAD_H = 0.44;
function markerCircle(s, image, cx, cy, glyphW, glyphH) {
  if (!image) return; // asset not generated -> no decoration (never a failure)
  const w = glyphW + CIRCLE_PAD_W, h = glyphH + CIRCLE_PAD_H;
  s.addImage({ path: image, x: cx - w / 2, y: cy - h / 2, w, h });
}

// The circle-marker box (inches) a slide will draw — make-markers.js sizes the
// SVG asset with THIS, so the raster always matches the placement aspect.
function circleMarkerSize(sl, T) {
  const c = sl.content || {};
  if (!c.marker || c.marker.type !== "circle") return null;
  if (sl.pattern === "stat-grid" && Number.isInteger(c.emphasis) && Array.isArray(c.stats) && c.stats[c.emphasis]) {
    const jumpPt = Math.round((T.s.statCard || 40) * (sl.peak === true ? VALUE_JUMP_PEAK : VALUE_JUMP) * 10) / 10;
    const unitPt = Math.round(jumpPt * UNIT_RATIO * 10) / 10;
    const { num, unit } = splitValueUnit(c.stats[c.emphasis].value);
    const gw = estTextWidthIn(num, jumpPt) + (unit ? estTextWidthIn(unit, unitPt) : 0);
    return { w: gw + CIRCLE_PAD_W, h: jumpPt / 72 + CIRCLE_PAD_H };
  }
  if (sl.pattern === "message" && c.statBig) {
    const statPt = sl.peak === true ? emphSizePt(T.s.stat, false) : T.s.stat;
    return { w: estTextWidthIn(c.statBig, statPt) + CIRCLE_PAD_W, h: statPt / 72 + CIRCLE_PAD_H };
  }
  return null;
}

/* ---------------- low-level helpers ---------------- */
// Kicker eyebrow: an accent marker + bold heading-weight label. The marker is a
// theme layout knob: "dot" (default), "bar" (a short rule), or "none".
function kicker(slide, T, text, y, { x = T.m, onDark = false } = {}) {
  if (!text) return; // no kicker -> nothing at all (the dot is PART of the
  // kicker, not slide furniture — an orphan dot top-left was the QA bug)
  const style = T.layout.kicker;
  let tx = x;
  if (style === "dot") {
    slide.addShape("ellipse", { x, y: y + 0.055, w: 0.13, h: 0.13,
      fill: { color: T.c.accent }, line: { type: "none" } });
    tx = x + 0.26;
  } else if (style === "diamond") {
    // 金の小さな菱形 — the signature motif (square rotated 45°), same position
    // every page: a signature, not decoration.
    slide.addShape("rect", { x, y: y + 0.045, w: 0.14, h: 0.14, rotate: 45,
      fill: { color: T.c.accent }, line: { type: "none" } });
    tx = x + 0.28;
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
function title(slide, T, lines, y, { x = T.m, w = T.W - 2 * T.m, onDark = false, size = T.s.title, align = "left", quoteAccent = false } = {}) {
  const base = onDark ? T.c.onDark : T.c.ink;
  const arr = [];
  (Array.isArray(lines) ? lines : [lines]).forEach((t, i, a) => {
    const brk = i < a.length - 1;
    // “…” spans → accent runs (cover-only knob; the sanctioned inline emphasis)
    if (quoteAccent && /“[^”]+”/.test(t)) {
      const parts = String(t).split(/(“[^”]+”)/);
      parts.forEach((p, pi) => {
        if (!p) return;
        const isQ = /^“[^”]+”$/.test(p);
        const last = pi === parts.length - 1 || parts.slice(pi + 1).every((q) => !q);
        arr.push({ text: p, options: { color: isQ ? (onDark ? T.c.accentOnDk : T.c.accent) : base, breakLine: brk && last } });
      });
    } else {
      arr.push({ text: t, options: { breakLine: brk } });
    }
  });
  slide.addText(arr, { x, y, w, h: 0.62 * (Array.isArray(lines) ? lines.length : 1) + 0.3, margin: 0,
    fontFace: T.font.heading, fontSize: size, bold: true, lineSpacingMultiple: T.lead.title, charSpacing: -0.2,
    color: base, align, valign: "top" });
}

// Tone → colour resolution for statement lines / closing lines / stat callouts.
// 明度=重要度、色相=意味の方向: base=内容, muted=補足, accent=答え・到達,
// warn=痛み・代償・覚悟 (1用途限定 — the honesty guard applies; never decoration).
function toneColor(T, tone, dark) {
  switch (tone) {
    case "accent": return dark ? T.c.accentOnDk : T.c.accent;
    case "warn":   return dark ? T.c.warnOnDk : T.c.warn;
    case "muted":  return dark ? T.c.onDarkMut : T.c.muted;
    default:       return dark ? T.c.onDark : T.c.ink;
  }
}

// 結びの1行帯 — the closing band (y ≈ H−1.65..H−1.1): every light body slide
// that carries a closing puts its 種明かし at the SAME height, centered, bold.
// ≤2 lines; line 1 = head size, line 2 = body size. This is the fifth band of
// the vertical grid (whitespace.md §5) — the eye lands here on every page.
function closingLine(slide, T, closing, ctx) {
  if (!closing) return;
  const lines = (Array.isArray(closing) ? closing : [closing]).slice(0, 2)
    .map((l) => (typeof l === "string" ? { text: l, tone: "base" } : l));
  const runs = lines.map((l, i) => ({ text: l.text, options: {
    color: toneColor(T, l.tone || "base", false),
    fontSize: i === 0 ? T.s.takeawayHead : T.s.body,
    breakLine: i < lines.length - 1 } }));
  slide.addText(runs, { x: T.m, y: T.H - 1.62, w: T.W - 2 * T.m, h: 0.98, margin: 0,
    fontFace: T.font.heading, bold: true, color: T.c.ink, align: "center", valign: "top",
    lineSpacingMultiple: T.lead.tight });
}

function numCircle(slide, T, n, x, y, d = 0.46, { fill } = {}) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill || T.c.accent }, line: { type: "none" } });
  slide.addText(n == null ? "" : String(n), { x, y, w: d, h: d, margin: 0, align: "center", valign: "middle",
    fontFace: T.font.heading, fontSize: T.s.num, bold: true, color: T.c.onDark });
}

function card(slide, T, x, y, w, h, { fill = T.c.surface } = {}) {
  const L = T.layout.card; // radius + shadow are a theme layout knob (sharp+flat = swiss/minimal)
  const opt = { x, y, w, h, rectRadius: L.radius, fill: { color: fill }, line: { type: "none" } };
  if (L.shadow) opt.shadow = cardShadow(T);
  slide.addShape("roundRect", opt);
}

function footer(slide, T, brand, page, showPage, dark = false) {
  const col = dark ? T.c.onDarkMut : T.c.faint;
  if (brand) {
    slide.addText(brand, { x: T.m, y: T.H - 0.42, w: 3, h: 0.3, margin: 0,
      fontFace: T.font.caption, fontSize: T.s.cap, color: col, align: "left", valign: "middle" });
  }
  if (showPage) {
    slide.addText(String(page), { x: T.W - T.m - 1, y: T.H - 0.42, w: 1, h: 0.3, margin: 0,
      fontFace: T.font.caption, fontSize: T.s.cap, color: col, align: "right", valign: "middle" });
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
  title(s, T, d.titleLines, 2.2, { onDark: true, size: T.s.cover, w: 10, quoteAccent: !!T.layout.coverQuoteAccent });
  if (d.subtitle) s.addText(richText(d.subtitle), { x: T.m, y: 4.7, w: 9.5, h: 0.9, margin: 0,
    fontFace: T.font.body, fontSize: T.s.coverSub, color: T.c.onDarkMut, align: "left", valign: "top",
    lineSpacingMultiple: T.lead.caption });
  if (d.footer) s.addText(d.footer, { x: T.m, y: T.H - 0.85, w: 9, h: 0.35, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.footer, color: T.c.onDarkMut, align: "left", valign: "middle" });
  return s;
}

function slideMessage(pres, d, T, ctx) {
  const s = pres.addSlide();
  const dark = !!d.dark;
  // dark statement (感情を刻むページは紺): the emotional turning-point face.
  // peak (the deck's ONE climax slide): the contrast ceiling opens one step —
  // a faint surfaceAccent ground + the stat one size step up. Existing tokens
  // only; non-peak slides keep the flat bg (byte-identical when peak is unset).
  s.background = { color: dark ? T.c.dark : (ctx.peak ? T.c.surfaceA : T.c.bg) };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m, { onDark: dark });
  // centered single statement (display leading, tight tracking). When a
  // persona occupies the right flank, the statement column narrows to the
  // left ~2/3 so bubble and message never collide (deterministic, no lint
  // needed — same contract as the chart takeaway card).
  const hasPersona = !!(d.persona && d.persona.quote) && !(ctx.intent === "financial" || ctx.intent === "board");
  const msgW = hasPersona ? 7.6 : T.W - 2.0;
  const msgX = hasPersona ? T.m : 1.0;
  const richLines = d.messageLines.some((l) => typeof l === "object") || dark || d.messageLines.length > 2;
  if (!richLines) {
    // legacy path — plain ≤2-line light statement, byte-identical to before
    const msg = d.messageLines.map((t, i, a) => ({ text: t, options: { breakLine: i < a.length - 1 } }));
    s.addText(msg, { x: msgX, y: 2.0, w: msgW, h: 1.7, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.message, bold: true, color: T.c.ink, align: "center", valign: "middle",
      lineSpacingMultiple: T.lead.display, charSpacing: -0.2 });
  } else {
    // statement lines with per-line tone & size (声量の階層): the quiet lead-in,
    // the payload line (accent/L — 山場はサイズで語る), the muted aside. Sizes:
    // s = head, m = message, l = messageL token (fallback message×1.3, capped by
    // the stat size so the number stays the biggest thing on a 型D page).
    const sizePt = (sz) => sz === "l" ? (T.s.messageL || Math.min(Math.round(T.s.message * 1.3), T.s.stat - 8))
      : sz === "s" ? T.s.head : T.s.message;
    const lines = d.messageLines.map((l) => (typeof l === "string" ? { text: l } : l));
    const runs = lines.map((l, i) => ({ text: l.text, options: {
      color: toneColor(T, l.tone || "base", dark),
      fontSize: sizePt(l.size || "m"),
      breakLine: i < lines.length - 1 } }));
    const blockH = d.statBig ? 1.9 : 3.1;
    s.addText(runs, { x: msgX, y: d.statBig ? 1.65 : 1.85, w: msgW, h: blockH, margin: 0,
      fontFace: T.font.heading, bold: true, color: dark ? T.c.onDark : T.c.ink, align: "center", valign: "middle",
      lineSpacingMultiple: T.lead.display, charSpacing: -0.2 });
  }
  // big stat callout (型D: the number IS the page's protagonist — bigger than
  // the title, centered; its colour carries its MEANING: warn = 損害・痛み・覚悟,
  // accent = 成果・答え・可能性. peak: one step larger / accentDeep as before.)
  if (d.statBig) {
    const statPt = ctx.peak ? emphSizePt(T.s.stat, false) : T.s.stat;
    const statCol = d.statTone === "warn" ? (dark ? T.c.warnOnDk : T.c.warn)
      : dark ? T.c.accentOnDk
      : ctx.peak ? T.c.accentDp : T.c.accent;
    s.addText(d.statBig, { x: msgX, y: 3.95, w: msgW, h: 1.15, margin: 0,
      fontFace: T.font.heading, fontSize: statPt, bold: true,
      color: statCol, align: "center", valign: "middle" });
    // optional marker on the statBig (message's protagonist IS the number)
    const mk = d.marker;
    if (mk) {
      const gw = estTextWidthIn(d.statBig, statPt), cx = T.W / 2, cy = 3.95 + 1.15 / 2;
      if (mk.type === "circle" && T.layout.marker.handDrawn) markerCircle(s, mk.image, cx, cy, gw, statPt / 72);
      else if (mk.type === "badge" && mk.text) markerBadge(s, T, mk.text, cx + gw / 2 + estTextWidthIn(mk.text, BADGE_PT) + 0.45, cy - 0.55);
      else if (mk.type === "arrow-note" && mk.text) markerArrowNote(s, T, mk.text, cx + gw / 2 + 0.25, cy + 0.1, cy + 0.42);
      else if (mk.type === "underline") markerUnderline(s, T, cx - gw / 2, cy + (statPt / 72) * 0.58, gw);
    }
  }
  // optional persona (education register): figure bottom-right, bubble above
  personaDevice(s, T, d.persona, "message", ctx);
  // optional diamond separator (dark closings: the motif as a quiet full stop
  // between the statement and the contact/caption line — signature, not 装飾)
  if (d.diamond && dark) {
    s.addShape("rect", { x: T.W / 2 - 0.08, y: 5.02, w: 0.16, h: 0.16, rotate: 45,
      fill: { color: T.c.accent }, line: { type: "none" } });
  }
  if (d.statCaption) s.addText(richText(d.statCaption), { x: hasPersona ? msgX + 0.8 : 2.6, y: 5.25, w: hasPersona ? msgW - 1.6 : T.W - 5.2, h: 0.8, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.small, color: dark ? T.c.onDarkMut : T.c.muted, align: "center", valign: "top",
    lineSpacingMultiple: T.lead.caption });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage, dark);
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
  // right: numbered rows. emphasis names the protagonist row: its circle + head
  // step up to accentDeep (an upgrade INSIDE the existing accent frame — no new
  // color, no size change in these tight rows). Unset => all rows as before.
  const eIdx = Number.isInteger(d.emphasis) ? d.emphasis : -1;
  const rx = 6.45, rw = T.W - T.m - rx, top = 2.5, gap = 1.46;
  d.items.forEach((it, i) => {
    const y = top + i * gap;
    const emph = eIdx === i;
    numCircle(s, T, it.n == null ? i + 1 : it.n, rx, y, 0.46, emph ? { fill: T.c.accentDp } : {});
    s.addText(it.head, { x: rx + 0.66, y: y - 0.05, w: rw - 0.66, h: 0.4, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: emph ? T.c.accentDp : T.c.ink, align: "left", valign: "middle" });
    s.addText(richText(it.body), { x: rx + 0.66, y: y + 0.44, w: rw - 0.66, h: 0.7, margin: 0,
      fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted, align: "left", valign: "top",
      lineSpacingMultiple: T.lead.tight });
  });
  // optional persona (education register): figure bottom-left under the lead,
  // bubble to its right (the CASE pattern's worked-example voice)
  personaDevice(s, T, d.persona, "two-column", ctx);
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideComparison(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15);
  const top = 2.5, h = d.closing ? 3.3 : 3.95, gap = 0.5;
  const w = (T.W - 2 * T.m - gap) / 2;
  const lx = T.m, rx = T.m + w + gap;
  // ONE side carries the accent (tint+shadow, no stripes). emphasis picks the
  // protagonist side (0=left, 1=right); unset keeps the house default — the
  // advocated side sits on the RIGHT (byte-identical to before).
  const emphSide = Number.isInteger(d.emphasis) ? d.emphasis : 1;
  card(s, T, lx, top, w, h, { fill: emphSide === 0 ? T.c.surfaceA : T.c.surface });
  card(s, T, rx, top, w, h, { fill: emphSide === 1 ? T.c.surfaceA : T.c.surface });
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
  drawCol(lx, d.left, emphSide === 0);
  drawCol(rx, d.right, emphSide === 1);
  closingLine(s, T, d.closing, ctx);
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
  } else if (emph >= 0 && (d.chartType === "column" || !d.chartType) && !d.targetLine) {
    // EMPHASIZED column chart -> native rects (user feedback: colour alone is
    // not enough — the protagonist bar gets WIDTH x1.3 and a BOLD, larger
    // value label; the native pptx chart cannot do either per-point). Still
    // native shapes: editable, never rasterized. Negatives keep the ▲ rule.
    const EC = emphColumnLayout(T, vals, emph);
    const anyDec = vals.some((v) => typeof v === "number" && !Number.isInteger(v));
    const fmtV = (v) => {
      const a2 = Math.abs(v);
      const [int, dec] = (anyDec ? a2.toFixed(1) : String(Math.round(a2))).split(".");
      return (v < 0 ? "▲" : "") + int.replace(/\B(?=(\d{3})+$)/g, ",") + (dec ? `.${dec}` : "");
    };
    if (EC.hasNeg) s.addShape("line", { x: EC.area.x, y: EC.zeroY, w: EC.area.w, h: 0,
      line: { color: T.c.line, width: T.layout.stroke.hairline } });
    EC.bars.forEach((bar) => {
      s.addShape("rect", { x: bar.x, y: bar.y, w: bar.w, h: bar.h,
        fill: { color: bar.emph ? T.c.accentDp : T.c.accentSft }, line: { type: "none" } });
    });
    vals.forEach((v, i) => {
      const vb = EC.valueBoxes[i], cb = EC.catBoxes[i], emphHere = i === emph;
      s.addText(fmtV(v), { x: vb.x, y: vb.y, w: vb.w, h: vb.h, margin: 0,
        fontFace: T.font.heading, fontSize: emphHere ? 14 : 12, bold: emphHere,
        color: emphHere ? T.c.accentDp : T.c.ink, align: "center", valign: "bottom" });
      const lbl = (d.series.labels || [])[i];
      if (lbl != null) s.addText(String(lbl), { x: cb.x, y: cb.y, w: cb.w, h: cb.h, margin: 0,
        fontFace: T.font.body, fontSize: 12, bold: emphHere, color: emphHere ? T.c.ink : T.c.muted,
        align: "center", valign: "top" });
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
  // optional marker on the takeaway card (the chart's claim — badge/arrow-note
  // only; the wording must be a fact the data supports)
  if (d.marker && d.marker.type === "badge" && d.marker.text) {
    markerBadge(s, T, d.marker.text, cx + cw - 0.18, 2.4 - 0.17);
  } else if (d.marker && d.marker.type === "arrow-note" && d.marker.text) {
    markerArrowNote(s, T, d.marker.text, cx + cw / 2, 2.4 + 3.85, 2.4 + 3.85 + 0.24);
  }
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
  // "chapter" style (story-seminar register): NO watermark numeral — the chapter
  // is announced by the kicker alone ("CHAPTER N"), title + subtitle centered.
  // (The watermark ghost numeral reads as an AI-tell in this design language.)
  if (T.layout.sectionStyle === "chapter") {
    kicker(s, T, d.kicker || (d.index != null ? `CHAPTER ${d.index}` : undefined), T.m, { onDark: true });
    title(s, T, d.title, 2.85, { onDark: true, size: T.s.sectionTitle || 36, align: "center" });
    if (d.subtitle) s.addText(richText(d.subtitle), { x: T.m, y: 4.1, w: T.W - 2 * T.m, h: 0.6, margin: 0,
      fontFace: T.font.body, fontSize: T.s.coverSub, color: T.c.onDarkMut, align: "center", valign: "top",
      lineSpacingMultiple: T.lead.tight });
    return s;
  }
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
  const top = 2.7, h = 3.45, pad = 0.4;
  // emphasis (AREA scheme — the A/B-driven revision): the protagonist card is
  // ~1.45x wide (others share the rest; total width unchanged) and its NUMBER
  // jumps ×1.7 (×1.8 on the peak slide) with the unit small beside it, in
  // accentDeep on a tinted card. The first A/B proved color alone loses to a
  // longer neighbour — AREA order beats color. Legacy emphasizeIndex keeps its
  // original look (equal cells, tint + accentDeep, no jump) byte-identically.
  const eIdx = Number.isInteger(d.emphasis) ? d.emphasis : -1;
  // content-aware cells: the atom rule's width branch may re-widen cards so a
  // long atom NEVER breaks — every adjustment is logged (機械規則の可視化).
  const grid = resolveStatGrid(T, stats, eIdx);
  const cells = grid.cells;
  grid.notes.forEach((nt) => console.log(`  stat-grid emphasis: ${nt}`));
  // bystanders share ONE value size (the smallest fit among them) so they read
  // as a single quiet family behind the protagonist — three bystanders at
  // three sizes would be noise, not hierarchy.
  let bystanderPt = null;
  if (eIdx >= 0) {
    const basePt = T.s.statCard || 40;
    const fits = stats
      .map((st, i) => (i === eIdx || !cells[i]) ? null
        : fitValue(st.value, cells[i].w - 2 * pad, basePt, { minScale: BYSTANDER_FLOOR }))
      .filter(Boolean);
    if (fits.length) bystanderPt = Math.min(...fits.map((f) => f.numPt));
  }
  stats.forEach((st, i) => {
    const cell = cells[i]; if (!cell) return;
    const { x, w } = cell;
    const emph = eIdx === i || d.emphasizeIndex === i;
    card(s, T, x, top, w, h, { fill: emph ? T.c.surfaceA : T.c.surface });
    // supporting icon (optional) — top-right corner, ABOVE the value band (value
    // glyphs start ~top+0.8) so a wide value like 40.7% is never crowded
    iconSlot(s, st.icon, x + w - pad - 0.5, top + 0.2, 0.5);
    if (eIdx >= 0) {
      // AREA-emphasized grid: every value is an UNBREAKABLE ATOM (number+unit
      // one word — never 518/億円, never 億/円). Overflow resolves by
      // proportional shrink to the readable floor; past the floor the CARD
      // was already re-widened (resolveStatGrid) — the atom itself never
      // breaks. Protagonist floor 1.6x base; bystander floor 0.7x base
      // (= 41% of the protagonist glyph height, above the 40% 可読フロア).
      const emphHere = eIdx === i;
      const basePt = emphHere
        ? Math.round((T.s.statCard || 40) * (ctx.peak ? VALUE_JUMP_PEAK : VALUE_JUMP) * 10) / 10
        : (T.s.statCard || 40);
      const minScale = emphHere ? EMPH_FLOOR / (ctx.peak ? VALUE_JUMP_PEAK : VALUE_JUMP) : BYSTANDER_FLOOR;
      let fit = fitValue(st.value, w - 2 * pad, basePt, { minScale });
      if (!fit.fits) console.log(`  stat-grid emphasis: atom "${st.value}" kept WHOLE below its floor (${fit.numPt}pt) — design-lint will flag the content`);
      // harmonize bystanders to the shared family size
      if (!emphHere && bystanderPt != null && fit.numPt > bystanderPt) {
        fit = { ...fit, numPt: bystanderPt, unitPt: Math.round(bystanderPt * UNIT_RATIO * 10) / 10 };
      }
      const runs = [{ text: fit.num, options: { fontSize: fit.numPt } }];
      if (fit.unit) runs.push({ text: fit.unit, options: { fontSize: fit.unitPt } });
      s.addText(runs, { x: x + pad, y: top + 0.5, w: w - 2 * pad, h: 1.2, margin: 0,
        fontFace: T.font.heading, bold: true, color: emphHere ? T.c.accentDp : T.c.accent,
        align: "left", valign: "middle" });
      // optional marker on the protagonist (badge on the card shoulder /
      // arrow-note below / underline beneath the number; circle is theme-gated)
      const mk = emphHere ? d.marker : null;
      if (mk && mk.type === "circle" && T.layout.marker.handDrawn) {
        const gw = estTextWidthIn(fit.num, fit.numPt) + (fit.unit ? estTextWidthIn(fit.unit, fit.unitPt) : 0);
        markerCircle(s, mk.image, x + pad + gw / 2, top + 1.1, gw, fit.numPt / 72);
      } else if (mk && mk.type === "badge" && mk.text) {
        markerBadge(s, T, mk.text, x + w - 0.18, top - 0.17);
      } else if (mk && mk.type === "arrow-note" && mk.text) {
        markerArrowNote(s, T, mk.text, x + w / 2, top + h, top + h + 0.24);
      } else if (mk && mk.type === "underline") {
        // solid intentional geometry under the number (the "adult" strong pop)
        const gw = estTextWidthIn(fit.num, fit.numPt) + (fit.unit ? estTextWidthIn(fit.unit, fit.unitPt) : 0);
        markerUnderline(s, T, x + pad, top + 1.1 + (fit.numPt / 72) * 0.62, gw);
      }
    } else {
      s.addText(String(st.value), { x: x + pad, y: top + 0.5, w: w - 2 * pad, h: 1.2, margin: 0,
        fontFace: T.font.heading, fontSize: T.s.statCard || 40,
        bold: true, color: emph ? T.c.accentDp : T.c.accent,
        align: "left", valign: "middle" });
    }
    // labels: a label is a TERM — in the emphasized (asymmetric) grid it fits
    // ONE line by stepping its font down, never wrapping mid-word.
    const labelPt = eIdx >= 0 ? fitLabelPt(st.label, w - 2 * pad, T.s.head) : T.s.head;
    s.addText(st.label, { x: x + pad, y: top + 1.8, w: w - 2 * pad, h: 0.5, margin: 0,
      fontFace: T.font.heading, fontSize: labelPt, bold: true, color: T.c.ink, align: "left", valign: "top" });
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

function cardGridCell(T, n, i, opts = {}) {
  const g = CARD_GRID;
  // 3 cards = a single 1×3 row of tall cards (STEP/約束 form); 4-6 keep the 2-row grid.
  const singleRow = n === 3;
  const cols = singleRow ? 3 : Math.ceil(n / 2);
  const w = (T.W - 2 * T.m - (cols - 1) * g.colGap) / cols;
  const row = singleRow ? 0 : Math.floor(i / cols), col = singleRow ? i : i % cols;
  const cardH = singleRow ? (opts.closing ? 2.55 : 3.2) : (opts.closing ? g.cardH - 0.22 : g.cardH);
  return { x: T.m + col * (w + g.colGap), y: g.top + row * (cardH + g.rowGap), w, h: cardH };
}

function slideCardGrid(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15);
  const cards = d.cards || [];
  const g = CARD_GRID;
  const hasClosing = !!d.closing;
  // emphasis (canonical) / emphasizeIndex (legacy alias) — identical treatment:
  // tint + accentDeep head, never a stripe.
  const eIdx = emphIndex(d);
  cards.forEach((cd, i) => {
    const cell = cardGridCell(T, cards.length, i, { closing: hasClosing });
    const emph = eIdx === i;
    card(s, T, cell.x, cell.y, cell.w, cell.h, { fill: emph ? T.c.surfaceA : T.c.surface });
    // optional per-card label (STEP 1 / a big numeral): the accent-deep eyebrow
    // inside the card — the ordering symbol without a number circle. Latin
    // labels get open tracking (charSpacing 3 — 英字のみ; 和文には使わない).
    const hasLabel = cd.label != null && String(cd.label) !== "";
    let textTop = cell.y + 0.16;
    if (hasLabel) {
      const latin = /^[\x20-\x7E]+$/.test(String(cd.label));
      s.addText(String(cd.label), { x: cell.x + g.pad, y: cell.y + 0.18, w: cell.w - 2 * g.pad, h: 0.3,
        margin: 0, fontFace: T.font.heading, fontSize: T.s.kicker, bold: true,
        charSpacing: latin ? 3 : 0, color: T.c.accentDp, align: "left", valign: "middle" });
      textTop = cell.y + 0.56;
    }
    if (cd.head) s.addText(richText(cd.head), { x: cell.x + g.pad, y: textTop, w: cell.w - 2 * g.pad, h: g.headH,
      margin: 0, fontFace: T.font.heading, fontSize: T.s.head, bold: true,
      color: emph ? T.c.accentDp : T.c.ink, align: "left", valign: "top", lineSpacingMultiple: T.lead.tight });
    if (cd.body) s.addText(richText(cd.body), { x: cell.x + g.pad, y: textTop + g.bodyTop - 0.16, w: cell.w - 2 * g.pad,
      h: cell.y + cell.h - (textTop + g.bodyTop - 0.16) - 0.16, margin: 0, fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted,
      align: "left", valign: "top", lineSpacingMultiple: T.lead.tight });
  });
  closingLine(s, T, d.closing, ctx);
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
  if (!d.note) closingLine(s, T, d.closing, ctx);
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
  // emphasis names the protagonist step: accent-filled node, onDark label, one
  // size step up (the eye enters the sequence THERE). Others keep the quiet
  // surface fill — one loud node only works against a calm row.
  const eIdx = Number.isInteger(d.emphasis) ? d.emphasis : -1;
  // arrows first (behind the nodes)
  arrows.forEach((a) => {
    s.addShape("line", {
      x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
      w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1),
      flipH: a.x2 < a.x1, flipV: a.y2 < a.y1,
      line: connLine(T, { endArrowType: "triangle" }),
    });
  });
  steps.forEach((st, i) => {
    const node = nodes[i]; if (!node) return;
    const emph = eIdx === i;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, ...nodeShape(T, { emph }) });
    const tb = nodeTextBox(node);
    s.addText(richText(st), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: emph ? emphSizePt(T.s.head, ctx.peak) : T.s.head, bold: true,
      color: emph ? T.c.onDark : T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
    // optional marker on the protagonist node (badge on the shoulder /
    // arrow-note below — a circle over a filled node would be noise)
    if (emph && d.marker && d.marker.type === "badge" && d.marker.text) {
      markerBadge(s, T, d.marker.text, node.x + node.w - 0.06, node.y - 0.17);
    } else if (emph && d.marker && d.marker.type === "arrow-note" && d.marker.text) {
      markerArrowNote(s, T, d.marker.text, node.x + node.w / 2, node.y + node.h, node.y + node.h + 0.24);
    }
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
  // emphasis: same protagonist treatment as flow (accent fill + onDark + one
  // size step) — e.g. the PDCA stage this deck argues is being skipped.
  const eIdx = Number.isInteger(d.emphasis) ? d.emphasis : -1;
  arrows.forEach((a) => {
    s.addShape("line", {
      x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
      w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1),
      flipH: a.x2 < a.x1, flipV: a.y2 < a.y1,
      line: connLine(T, { endArrowType: "triangle" }),
    });
  });
  steps.forEach((st, i) => {
    const node = nodes[i]; if (!node) return;
    const emph = eIdx === i;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, ...nodeShape(T, { emph }) });
    const tb = nodeTextBox(node);
    s.addText(richText(st), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: emph ? emphSizePt(T.s.head, ctx.peak) : T.s.head, bold: true,
      color: emph ? T.c.onDark : T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
    // optional marker on the protagonist node (badge / arrow-note, as in flow)
    if (emph && d.marker && d.marker.type === "badge" && d.marker.text) {
      markerBadge(s, T, d.marker.text, node.x + node.w - 0.06, node.y - 0.17);
    } else if (emph && d.marker && d.marker.type === "arrow-note" && d.marker.text) {
      markerArrowNote(s, T, d.marker.text, node.x + node.w / 2, node.y + node.h, node.y + node.h + 0.24);
    }
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
  // emphasis (canonical) / emphasizeIndex (legacy alias) — identical treatment:
  // quadrant tint + accentDeep head (the existing house emphasis, formalized).
  const emph = emphIndex(d);
  // emphasized quadrant tint (drawn first, under the frame/cross)
  if (emph >= 0 && L.quads[emph]) {
    const q = L.quads[emph];
    s.addShape("rect", { x: q.x, y: q.y, w: q.w, h: q.h, fill: { color: T.c.surfaceA }, line: { type: "none" } });
  }
  // outer frame + cross (two axes)
  s.addShape("roundRect", { x: g.x, y: g.y, w: g.w, h: g.h, rectRadius: rad, fill: { type: "none" }, line: { color: T.c.line, width: T.layout.stroke.hairline } });
  s.addShape("line", { x: g.x + g.w / 2, y: g.y, w: 0, h: g.h, line: { color: T.c.line, width: T.layout.stroke.hairline } });
  s.addShape("line", { x: g.x, y: g.y + g.h / 2, w: g.w, h: 0, line: { color: T.c.line, width: T.layout.stroke.hairline } });
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
    line: connLine(T, { endArrowType: "triangle" }),
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
      line: { color: T.c.line, width: T.layout.stroke.hairline },
      shadow: elevShadow(T, goal ? "raised" : "base") });
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
  // orthogonal elbows (bentConnector3), never diagonal straight runs — the
  // connector-quality floor. flipV routes up/down; a flat middle branch
  // degenerates to a straight line naturally.
  L.arrows.forEach((a) => {
    s.addShape("bentConnector3", {
      x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
      w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1),
      flipH: a.x2 < a.x1, flipV: a.y2 < a.y1,
      line: connLine(T, { endArrowType: "triangle" }),
    });
  });
  // the single anchor (source or result) — tinted, like the steps goal block
  s.addShape("roundRect", { x: L.single.x, y: L.single.y, w: L.single.w, h: L.single.h, rectRadius: rad,
    fill: { color: T.c.surfaceA }, line: { color: T.c.line, width: T.layout.stroke.hairline },
    shadow: elevShadow(T, "raised") });
  if (d.source) {
    const tb = nodeTextBox(L.single);
    s.addText(richText(d.source), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.accentDp,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  }
  branches.forEach((b, i) => {
    const node = L.many[i]; if (!node) return;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, ...nodeShape(T) });
    const tb = nodeTextBox(node);
    s.addText(richText(b), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  closingLine(s, T, d.closing, ctx);
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
      line: { color: T.c.line, width: T.layout.stroke.hairline },
      shadow: elevShadow(T, isResult ? "raised" : "base") });
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
  closingLine(s, T, d.closing, ctx);
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


/* ---------------- DIAGRAM: identity (stacked identity, 積み上げ恒等式) ----------------
 * The accounting canonical form (visual-psychology.md §3.5 正準形ライブラリ):
 * a WHOLE on the left ＝ its parts STACKED to the same total height on the
 * right (資産 ＝ 負債 ＋ 純資産 / 収入 ＝ 税 ＋ 手取り). The areas carry the
 * identity — erase the ＝ and the composition still reads (the symbol-erasure
 * test that `formula` cannot pass for this content: equal boxes joined by ＋
 * are 額装). Heights go proportional ONLY when every part has a numeric value
 * (all-or-none — the engine never invents proportions); values render plain
 * (fmt as waterfall), unit once bottom-left. emphasis tints the protagonist
 * part (usually the 残り — 純資産 / 自由なお金) with the house tint. */
function slideIdentity(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const parts = d.parts || [];
  const L = identityLayout(T, parts);
  const anyDecimal = parts.some((p) => typeof p.value === "number" && !Number.isInteger(p.value))
    || (d.left && typeof d.left.value === "number" && !Number.isInteger(d.left.value));
  const fmt = (v) => {
    const a = Math.abs(v);
    const [int, dec] = (anyDecimal ? a.toFixed(1) : String(Math.round(a))).split(".");
    return int.replace(/\B(?=(\d{3})+$)/g, ",") + (dec ? `.${dec}` : "");
  };
  const eIdx = Number.isInteger(d.emphasis) ? d.emphasis : -1;
  // the whole (left) — the reference, not the protagonist: plain surface card
  const lf = d.left || {};
  card(s, T, L.left.x, L.left.y, L.left.w, L.left.h, { fill: T.c.surface });
  const leftVal = typeof lf.value === "number" ? lf.value
    : (L.proportional ? parts.reduce((a, p) => a + p.value, 0) : null);
  {
    const spec = identityTextSpec(T, L.left); const tb = spec.tb;
    const runs = [{ text: Array.isArray(lf.label) ? lf.label.join("\n") : (lf.label || ""),
      options: { fontFace: T.font.heading, fontSize: spec.sizePt, bold: true, color: T.c.ink, breakLine: leftVal !== null } }];
    if (leftVal !== null) runs.push({ text: fmt(leftVal),
      options: { fontFace: T.font.heading, fontSize: T.s.body, bold: true, color: T.c.muted } });
    s.addText(runs, { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  }
  // the ＝ — native glyph in its own cell, never colliding with labels
  s.addText("＝", { x: L.op.x, y: L.op.y, w: L.op.w, h: L.op.h, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.title, bold: true, color: T.c.accent,
    align: "center", valign: "middle" });
  // the parts — stacked; the protagonist takes the house tint
  parts.forEach((p, i) => {
    const b = L.parts[i]; if (!b || !p) return;
    const emph = eIdx === i;
    card(s, T, b.x, b.y, b.w, b.h, { fill: emph ? T.c.surfaceA : T.c.surface });
    const spec = identityTextSpec(T, b); const tb = spec.tb;
    const runs = [{ text: Array.isArray(p.label) ? p.label.join("\n") : (p.label || ""),
      options: { fontFace: T.font.heading, fontSize: spec.sizePt, bold: true,
        color: emph ? T.c.accentDp : T.c.ink } }];
    if (typeof p.value === "number") runs.push({ text: "　" + fmt(p.value),
      options: { fontFace: T.font.heading, fontSize: T.s.small, bold: true,
        color: emph ? T.c.accentDp : T.c.muted } });
    s.addText(runs, { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  // one-level nesting (STRAC): the decomposed part's sub items stack beside it
  if (L.subBoxes) {
    const subs = parts[L.subIdx].sub || [];
    const sIdx = Number.isInteger(d.subEmphasis) ? d.subEmphasis : -1;
    subs.forEach((p, i) => {
      const b = L.subBoxes[i]; if (!b || !p) return;
      const emph = sIdx === i;
      card(s, T, b.x, b.y, b.w, b.h, { fill: emph ? T.c.surfaceA : T.c.surface });
      const spec = identityTextSpec(T, b); const tb = spec.tb;
      const runs = [{ text: Array.isArray(p.label) ? p.label.join("\n") : (p.label || ""),
        options: { fontFace: T.font.heading, fontSize: spec.sizePt, bold: true,
          color: emph ? T.c.accentDp : T.c.ink } }];
      if (typeof p.value === "number") runs.push({ text: "　" + fmt(p.value),
        options: { fontFace: T.font.heading, fontSize: T.s.small, bold: true,
          color: emph ? T.c.accentDp : T.c.muted } });
      s.addText(runs, { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
        align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
    });
  }
  if (d.unit) s.addText(`単位：${d.unit}`, { x: T.m, y: 6.66, w: 2.6, h: 0.28, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "left", valign: "top" });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: breakeven (CVP / 損益分岐点図) ----------------
 * The 会計セミナー staple beside STRAC: 売上高線 and 総費用線（固定費＋変動費）
 * crossing at the 損益分岐点. Purely structural — the skeleton carries TERMS,
 * never numbers; with {fixed, variableRate} the crossing derives from the data,
 * without them the engine draws the schematic AND auto-stamps ※模式図
 * (house-bar §4 — a schematic must not wear a data face). */
function slideBreakeven(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const L = breakevenLayout(T, d.fixed, d.variableRate);
  const P = L.plot;
  const lbl = Object.assign({ sales: "売上高", cost: "総費用", fixed: "固定費",
    bep: "損益分岐点", loss: "損失", profit: "利益" }, d.labels || {});
  // axes
  s.addShape("line", { x: P.x, y: P.y, w: 0, h: P.h, line: { color: T.c.line, width: 1.25 } });
  s.addShape("line", { x: P.x, y: P.y + P.h, w: P.w, h: 0, line: { color: T.c.line, width: 1.25 } });
  // fixed-cost floor (dashed, muted)
  s.addShape("line", { x: P.x, y: L.fixedY, w: P.w, h: 0,
    line: { color: T.c.muted, width: 1, dashType: "dash" } });
  // cost line (muted, solid) — rises from the fixed floor
  s.addShape("line", { x: L.cost.x1, y: L.cost.y2, w: L.cost.x2 - L.cost.x1, h: L.cost.y1 - L.cost.y2,
    flipV: true, line: { color: T.c.muted, width: 2.25 } });
  // sales line (accent, the protagonist) — from the origin, steeper
  s.addShape("line", { x: L.sales.x1, y: L.sales.y2, w: L.sales.x2 - L.sales.x1, h: L.sales.y1 - L.sales.y2,
    flipV: true, line: { color: T.c.accent, width: 2.75 } });
  // BEP: dot + dashed drop + label under the axis
  s.addShape("line", { x: L.bep.x, y: L.bep.y, w: 0, h: P.y + P.h - L.bep.y,
    line: { color: T.c.accentDp, width: 1, dashType: "dash" } });
  s.addShape("ellipse", { x: L.bep.x - 0.07, y: L.bep.y - 0.07, w: 0.14, h: 0.14,
    fill: { color: T.c.accentDp }, line: { type: "none" } });
  s.addText(richText(lbl.bep), { x: L.bep.x - 1.2, y: P.y + P.h + 0.08, w: 2.4, h: 0.3, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.small, bold: true, color: T.c.accentDp,
    align: "center", valign: "top" });
  // line terms at the right edge; fixed floor term at the left
  const term = (text, y, color, bold) => s.addText(richText(text), {
    x: P.x + P.w + 0.12, y: y - 0.14, w: 1.9, h: 0.3, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.small, bold: !!bold, color, align: "left", valign: "middle" });
  term(lbl.sales, L.sales.y2, T.c.accent, true);
  term(lbl.cost, L.cost.y2, T.c.muted);
  s.addText(richText(lbl.fixed), { x: P.x + 0.08, y: L.fixedY + 0.04, w: 1.8, h: 0.26, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "left", valign: "top" });
  // loss / profit regions (between the two lines)
  s.addText(richText(lbl.loss), { x: P.x + P.w * 0.16, y: L.fixedY - 0.42, w: 1.4, h: 0.3, margin: 0,
    fontFace: T.font.body, fontSize: T.s.small, color: T.c.muted, align: "center", valign: "middle" });
  s.addText(richText(lbl.profit), { x: L.bep.x + (P.x + P.w - L.bep.x) * 0.42 - 0.7, y: P.y + (L.bep.y - P.y) * 0.45, w: 1.4, h: 0.3, margin: 0,
    fontFace: T.font.heading, fontSize: T.s.small, bold: true, color: T.c.accentDp, align: "center", valign: "middle" });
  // honesty stamp: a schematic must say so
  if (L.schematic) s.addText("※模式図", { x: P.x + P.w - 1.2, y: P.y + P.h - 0.32, w: 1.2, h: 0.26, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "right", valign: "bottom" });
  if (d.unit) s.addText(`単位：${d.unit}`, { x: T.m, y: 6.66, w: 2.6, h: 0.28, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "left", valign: "top" });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: positioning (2-3 competitive positions + VS) ----------------
 * 競争ポジション (education-register.md §2-1, structure word "positioning"):
 * side-by-side position cards with a VS cell between. emphasis tints the
 * protagonist position (usually 自社) — same house emphasis, never a stripe. */
function slidePositioning(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const positions = d.positions || [];
  const L = positioningLayout(T, positions.length);
  const eIdx = Number.isInteger(d.emphasis) ? d.emphasis : -1;
  positions.forEach((ps, i) => {
    const cd = L.cards[i]; if (!cd || !ps) return;
    const emph = eIdx === i;
    card(s, T, cd.x, cd.y, cd.w, cd.h, { fill: emph ? T.c.surfaceA : T.c.surface });
    if (ps.head) s.addText(richText(ps.head), { x: posHeadBox(cd).x, y: posHeadBox(cd).y, w: posHeadBox(cd).w, h: posHeadBox(cd).h,
      margin: 0, fontFace: T.font.heading, fontSize: T.s.compareLabel, bold: true,
      color: emph ? T.c.accentDp : T.c.ink, align: "left", valign: "middle" });
    if (ps.body) s.addText(richText(ps.body), { x: posBodyBox(cd).x, y: posBodyBox(cd).y, w: posBodyBox(cd).w, h: posBodyBox(cd).h,
      margin: 0, fontFace: T.font.body, fontSize: T.s.body, color: T.c.ink, align: "left", valign: "top",
      lineSpacingMultiple: T.lead.tight });
  });
  L.vs.forEach((v) => {
    s.addText("VS", { x: v.x, y: v.y, w: v.w, h: v.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.muted, align: "center", valign: "middle" });
  });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: system (ecosystem boxes + labeled arrows) ----------------
 * 全体像 (structure word "system"): who passes what to whom. Forward flows run
 * between the nodes (label above the arrow); return / long-range flows run in
 * the lane below (label under). All native shapes + native labels. */
function slideSystem(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const nodes = d.nodes || [];
  const L = systemLayout(T, nodes.length, d.links);
  const rad = T.layout.card.radius;
  // draw order: lines -> nodes -> LABELS LAST (a flow label may be wider than
  // its gap; drawing it last keeps it readable over the light node fill
  // instead of being covered by the node — caught by the render QA)
  L.fwd.forEach((a) => {
    s.addShape("line", { x: a.x1, y: a.y, w: a.x2 - a.x1, h: 0,
      line: connLine(T, { endArrowType: "triangle" }) });
  });
  L.back.forEach((a) => {
    a.drops.forEach((dr) => s.addShape("line", { x: dr.x, y: dr.y1, w: 0, h: dr.y2 - dr.y1,
      line: { color: T.c.muted, width: 1.25, dashType: "dash" } }));
    s.addShape("line", { x: Math.min(a.x1, a.x2), y: a.y, w: Math.abs(a.x2 - a.x1), h: 0,
      flipH: a.x2 < a.x1,
      line: connLine(T, { color: T.c.muted, dashType: "dash", endArrowType: "triangle" }) });
  });
  nodes.forEach((nd, i) => {
    const node = L.nodes[i]; if (!node) return;
    s.addShape("roundRect", { x: node.x, y: node.y, w: node.w, h: node.h, ...nodeShape(T) });
    const tb = nodeTextBox(node);
    s.addText(richText(nd), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  // labels are CHIPS on the line (centered, background knockout) — never bare
  // glyphs floating over a stroke (connector-quality floor).
  const chip = (label, box, maxW) => {
    const txt = Array.isArray(label) ? label.join("") : label;
    const cw = Math.min(estTextWidthIn(txt, T.s.small) + 0.28, maxW);
    const pt = fitLabelPt(txt, cw - 0.24, T.s.small); // chip capped -> text fits, never bleeds
    const cx = box.x + (box.w - cw) / 2;
    s.addShape("roundRect", { x: cx, y: box.y, w: cw, h: box.h, rectRadius: box.h / 2,
      fill: { color: T.c.bg }, line: { color: T.c.line, width: T.layout.stroke.hairline } });
    s.addText(richText(label), { x: cx, y: box.y, w: cw, h: box.h, margin: 0,
      fontFace: T.font.body, fontSize: pt, color: T.c.muted, align: "center", valign: "middle" });
  };
  // fwd chips leave >=0.15in arrow stubs visible on both sides of the gap
  L.fwd.forEach((a) => { if (a.label) chip(a.label, a.labelBox, Math.max((a.x2 - a.x1) - 0.3, 0.8)); });
  L.back.forEach((a) => { if (a.label) chip(a.label, a.labelBox, a.labelBox.w - 0.5); });
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- DIAGRAM: relation (対応マップ — bipartite correspondence) ----------------
 * Structure word "relation": which left item pairs with which right item.
 * No direction, no ranking — plain correspondence lines (a flow arrow here
 * would claim causality that does not exist: the logical-mode honesty guard). */
function slideRelation(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const leftItems = d.left || [], rightItems = d.right || [];
  const rad = T.layout.card.radius;
  // THE FORM FOLLOWS THE DATA: a pure classification (each right item belongs
  // to exactly one left item) reads as ZONES (enclosure, zero crossings) —
  // a crossing line-web for a partition was the reviewed failure. Only true
  // many-to-many keeps lines, with the right column barycenter-reordered.
  if (relationIsPartition(leftItems.length, rightItems.length, d.links)) {
    const Z = relationZones(T, leftItems.length, rightItems.length, d.links);
    Z.zones.forEach(({ zone, head }, i) => {
      s.addShape("roundRect", { x: zone.x, y: zone.y, w: zone.w, h: zone.h, rectRadius: rad,
        fill: { color: T.c.surface }, line: { color: T.c.line, width: T.layout.stroke.hairline },
        shadow: elevShadow(T, "zone") });
      s.addText(richText(leftItems[i]), { x: head.x, y: head.y, w: head.w, h: head.h, margin: 0,
        fontFace: T.font.heading, fontSize: T.s.compareLabel, bold: true, color: T.c.accentDp,
        align: "left", valign: "middle", lineSpacingMultiple: T.lead.tight });
    });
    rightItems.forEach((it, j) => {
      const b = Z.memberBoxes[j]; if (!b) return;
      s.addShape("roundRect", { x: b.x, y: b.y, w: b.w, h: b.h, rectRadius: rad,
        fill: { color: T.c.bg }, line: { color: T.c.line, width: T.layout.stroke.hairline },
        shadow: elevShadow(T, "base") });
      const tb = nodeTextBox(b);
      s.addText(richText(it), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
        fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink,
        align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
    });
    footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
    return s;
  }
  const L = relationLayout(T, leftItems.length, rightItems.length, d.links);
  (d.links || []).forEach(([i, j]) => {
    if (!L.left[i] || !L.right[j]) return;
    const ln = L.line(i, j);
    s.addShape("line", { x: ln.x1, y: Math.min(ln.y1, ln.y2), w: ln.x2 - ln.x1, h: Math.abs(ln.y2 - ln.y1),
      flipV: ln.y2 < ln.y1, line: connLine(T) });
  });
  const drawBoxes = (arr, boxes) => arr.forEach((it, k) => {
    const b = boxes[k]; if (!b) return;
    s.addShape("roundRect", { x: b.x, y: b.y, w: b.w, h: b.h, ...nodeShape(T) });
    const tb = nodeTextBox(b);
    s.addText(richText(it), { x: tb.x, y: tb.y, w: tb.w, h: tb.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.head, bold: true, color: T.c.ink,
      align: "center", valign: "middle", lineSpacingMultiple: T.lead.tight });
  });
  drawBoxes(leftItems, L.left);
  drawBoxes(rightItems, L.right);
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- before-after: 誤解 → 正解の再フレーム ----------------
 * Education reframe (education-register.md §5): the BEFORE card carries the
 * common misunderstanding (muted), a native arrow carries the turn, the AFTER
 * card carries the correction (tinted — the fixed protagonist). The guard:
 * the reframe must not distort — before/after must describe the SAME thing. */
function slideBeforeAfter(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  if (d.title) title(s, T, d.title, 1.15);
  const top = 2.5, h = 3.95, arrowW = 1.0;
  const w = (T.W - 2 * T.m - arrowW - 0.5) / 2;
  const lx = T.m, rx = T.m + w + arrowW + 0.5;
  card(s, T, lx, top, w, h, { fill: T.c.surface });
  card(s, T, rx, top, w, h, { fill: T.c.surfaceA });
  s.addShape("rightArrow", { x: lx + w + 0.12, y: top + h / 2 - 0.32, w: arrowW + 0.26, h: 0.64,
    fill: { color: T.c.accent }, line: { type: "none" } });
  const drawPanel = (x, panel, after) => {
    const pad = 0.45;
    if (panel.label) s.addText(richText(panel.label), { x: x + pad, y: top + 0.4, w: w - 2 * pad, h: 0.5, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.compareLabel, bold: true,
      color: after ? T.c.accentDp : T.c.muted, align: "left", valign: "middle" });
    if (panel.body) s.addText(richText(panel.body), { x: x + pad, y: top + 1.15, w: w - 2 * pad, h: h - 1.6, margin: 0,
      fontFace: T.font.body, fontSize: T.s.body, color: T.c.ink, align: "left", valign: "top",
      lineSpacingMultiple: T.lead.body });
  };
  drawPanel(lx, d.before || {}, false);
  drawPanel(rx, d.after || {}, true);
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

/* ---------------- dialogue / testimonial (avatar + bubble speakers) --------
 * The avatar is a NEUTRAL static bust (black silhouette, circle mask) — it
 * only says WHO is speaking. Meaning rides in the native quote, the scene
 * symbols and the ○×/verdict labels (記号+ラベル併記 — never colour alone).
 * financial/board: the whole device is register-gated OFF (design-lint ERROR;
 * the engine draws title only and says so). */
function registerGated(s, T, d, ctx, what) {
  if (ctx.intent === "financial" || ctx.intent === "board") {
    console.log(`  ${what}: SKIPPED — register gate (intent=${ctx.intent}): アバター・吹き出しは financial/board で常時OFF`);
    return true;
  }
  return false;
}

function drawSpeaker(s, T, row, sp) {
  if (sp.avatarImage) s.addImage({ path: sp.avatarImage, x: row.avatar.x, y: row.avatar.y, w: row.avatar.w, h: row.avatar.h });
  if (sp.bubbleImage) s.addImage({ path: sp.bubbleImage, x: row.bubble.x, y: row.bubble.y, w: row.bubble.w, h: row.bubble.h });
  s.addText(richText(sp.quote || ""), { x: row.quote.x, y: row.quote.y, w: row.quote.w, h: row.quote.h, margin: 0,
    fontFace: T.font.body, fontSize: row.quotePt, color: T.c.ink, align: "left", valign: "middle",
    lineSpacingMultiple: T.lead.tight });
  if (sp.role) s.addText(sp.role, { x: row.role.x, y: row.role.y, w: row.role.w, h: row.role.h, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "center", valign: "top" });
  if (sp.symbolImage && row.symbol) s.addImage({ path: sp.symbolImage, x: row.symbol.x, y: row.symbol.y, w: row.symbol.w, h: row.symbol.h });
}

function exampleMark(s, T, mark) {
  if (!mark) return;
  s.addText(mark, { x: T.W - T.m - 3.2, y: 6.82, w: 3.2, h: 0.22, margin: 0,
    fontFace: T.font.caption, fontSize: T.s.cap, color: T.c.muted, align: "right", valign: "top" });
}

function slideDialogue(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15, { w: 11.0 });
  if (registerGated(s, T, d, ctx, "dialogue")) { footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage); return s; }
  const L = dialogueLayout(T, d);
  if (L.form === "compare") {
    L.cols.forEach((col, ci) => {
      const def = d.columns[ci] || {};
      const good = col.verdict === "good";
      // verdict header: SYMBOL + LABEL carry the meaning (色相単独に頼らない —
      // CUD floor); the tint is a redundant channel on top.
      s.addShape("roundRect", { x: col.head.x, y: col.head.y, w: col.head.w, h: col.head.h,
        rectRadius: T.layout.card.radius, fill: { color: good ? T.c.surfaceA : T.c.surface },
        line: { color: T.c.line, width: T.layout.stroke.hairline }, shadow: elevShadow(T, "zone") });
      s.addText([
        { text: good ? "○ " : "× ", options: { bold: true, color: good ? T.c.accentDp : T.c.ink } },
        { text: def.label || (good ? "良い例" : "悪い例"), options: { bold: true, color: T.c.ink } },
      ], { x: col.head.x, y: col.head.y, w: col.head.w, h: col.head.h, margin: 0,
        fontFace: T.font.heading, fontSize: T.s.head, align: "center", valign: "middle" });
      col.speakers.forEach((row, i) => drawSpeaker(s, T, row, (def.speakers || [])[i] || {}));
    });
  } else {
    L.speakers.forEach((row, i) => drawSpeaker(s, T, row, (d.speakers || [])[i] || {}));
  }
  exampleMark(s, T, d.mark);
  footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage);
  return s;
}

function slideTestimonial(pres, d, T, ctx) {
  const s = pres.addSlide();
  s.background = { color: T.c.bg };
  bgLayer(s, T, d);
  kicker(s, T, d.kicker, T.m);
  title(s, T, d.title, 1.15, { w: 11.0 });
  if (registerGated(s, T, d, ctx, "testimonial")) { footer(s, T, ctx.brand, ctx.pageNum, ctx.showPage); return s; }
  const L = testimonialLayout(T, d);
  L.cards.forEach((cd, i) => {
    const it = (d.items || [])[i];
    if (!it) return;
    card(s, T, cd.card.x, cd.card.y, cd.card.w, cd.card.h);
    if (it.avatarImage) s.addImage({ path: it.avatarImage, x: cd.avatar.x, y: cd.avatar.y, w: cd.avatar.w, h: cd.avatar.h });
    s.addText(it.name || "", { x: cd.name.x, y: cd.name.y, w: cd.name.w, h: cd.name.h, margin: 0,
      fontFace: T.font.heading, fontSize: T.s.small, bold: true, color: T.c.ink,
      align: L.form === "stack" ? "center" : "left", valign: "middle" });
    s.addText(richText(it.body || ""), { x: cd.body.x, y: cd.body.y, w: cd.body.w, h: cd.body.h, margin: 0,
      fontFace: T.font.body, fontSize: T.s.small, color: T.c.ink, align: "left", valign: "top",
      lineSpacingMultiple: T.lead.body });
  });
  exampleMark(s, T, d.mark);
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
  "identity": slideIdentity,
  "breakeven": slideBreakeven,
  "positioning": slidePositioning,
  "system": slideSystem,
  "relation": slideRelation,
  "before-after": slideBeforeAfter,
  "dialogue": slideDialogue,
  "testimonial": slideTestimonial,
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
    // peak: the deck's ONE climax slide (slide-level flag; design-lint enforces
    // max 1 per deck, body patterns only). Builders that support it open the
    // contrast ceiling one step; absent => ctx.peak false => unchanged output.
    const s = fn(pres, content, T, { brand, pageNum: i + 1, showPage, peak: sl.peak === true, intent: meta.intent });
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

module.exports = { build, loadTheme, loadPlan, PATTERNS, circleMarkerSize };
