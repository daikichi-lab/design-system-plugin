#!/usr/bin/env node
/* ============================================================
 *  bin/lint/image-lint.js — the image gate for hybrid decks (Phase C, spec 1d)
 *
 *  design-lint stays the FAST, sync, no-render static gate. Image checks need
 *  actual pixels (WCAG contrast of native text over the SVG background, upscale
 *  blur), so they live here and run in the same build.sh gate suite. Checks:
 *    (1) scrim/contrast — native text over the bg must clear WCAG (pixel-sampled)
 *    (2) resolution     — image px >= 2x its placement (else upscale blur)
 *    (3) aspect         — image aspect ~= placement aspect (no stretch)
 *    (4) scrim edge     — the scrim must feather, not hard-step, at the text edge
 *    (5) weight         — per-image + whole-deck embedded image size caps
 *    (6) motif intrude  — a decoration motif (bgMotif/bgPattern) must stay OUT of
 *                         the text zone (corners/bands only), not crowd the words
 *    (7) icon set       — icons meant to look uniform (same slide) must share an
 *                         optical size and a stroke weight (a density-invariant
 *                         2*area/perimeter proxy, so glyph complexity doesn't
 *                         false-trigger it — the flaw the recipe library exposed)
 *
 *  Needs playwright-core (reused Chromium) for pixel sampling; parses PNG/JPEG
 *  headers itself for dimensions. Exit 1 on any ERROR (a CI gate). M-7/M-8 hold:
 *  images are code-drawn SVG, text stays native.
 *
 *  Usage: node bin/lint/image-lint.js --plan <plan.json> [--theme <t.json>] [--json]
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { loadPlan, loadTheme, circleMarkerSize } = require("../generate.js");
const { personaLayout, dialogueLayout, testimonialLayout } = require("../graphics/diagrams.js");
const { getBrowser, closeBrowser } = require("../layout-html/measure.js");

const PX_PER_IN = 96;
// thresholds
const WEIGHT_ERR = 800 * 1024, WEIGHT_WARN = 400 * 1024, DECK_ERR = 6 * 1024 * 1024;
const CONTRAST_ERR = 3.0, CONTRAST_WARN = 4.5;
// decoration motif must stay OUT of the text zone (fraction of the text region its
// opaque ink may cover before it hurts legibility)
const INTRUDE_ERR = 0.18, INTRUDE_WARN = 0.08;
// icon-set consistency: icons meant to look uniform (same slide) must share an
// optical size and a stroke weight. ICON_MIN_PX = 0.55in placement @2x, 75% floor.
// ICON_STROKE_SPREAD is on the density-invariant stroke proxy (2*area/perimeter /
// icon size): the 24 shipped recipe icons cluster at ~0.03; a filled-vs-line or
// thick-vs-thin mismatch spreads 0.15-0.46. 0.06 passes a uniform set with 2x
// headroom and still fails a real weight mismatch.
const ICON_MIN_PX = 105 * 0.75, ICON_DIM_RATIO = 1.3, ICON_STROKE_SPREAD = 0.06;
// STYLE-UNIFORM colour-tone proxy: a true silhouette is a single dark ink —
// NO chromatic pixels AND NO white interior. socost-style illustrations have
// either colour (ties/hair 0.5-11%) or big white areas (白肌 20-56%); the
// measured gap: silhouettes = 0.000/0.00, illustrations >= 0.005 chroma or
// >= 0.20 white. Thresholds sit in the gap; 中間色・淡彩は誤判定余地 = final
// call is human (notes + 目視).
const STYLE_CHROMA_TH = 0.003, STYLE_WHITE_TH = 0.15;
const personStyleOf = (sm) => (sm.chromaFrac > STYLE_CHROMA_TH || sm.whiteFrac > STYLE_WHITE_TH) ? "illustration" : "silhouette";

// The icons on one slide that form a visual SET (should match each other).
function slideIcons(slide) {
  const c = slide.content || {};
  const out = [];
  if (slide.pattern === "stat-grid") (c.stats || []).forEach((st, i) => { if (st && st.icon) out.push({ path: st.icon, where: `stats[${i}]` }); });
  if (slide.pattern === "two-column") (c.items || []).forEach((it, i) => { if (it && it.icon) out.push({ path: it.icon, where: `items[${i}]` }); });
  return out;
}

/* ---- image dimensions from the file header (no full decode) ---- */
function imageDims(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) { // PNG
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: "png" };
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) { // JPEG: find SOF marker
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), fmt: "jpeg" };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

// Does the PNG carry transparency at all? Colour types 4 (gray+alpha) and
// 6 (RGBA) have an alpha channel; 0/2/3 only via a tRNS chunk.
function pngHasAlpha(buf) {
  const ct = buf[25]; // IHDR colour type byte
  return ct === 4 || ct === 6 || buf.includes("tRNS");
}

/* ---- WCAG helpers ---- */
const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function lumHex(hex) {
  const h = String(hex).replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

/* ---- pixel sampling: load the image as a data URL (same-origin -> canvas not
 * tainted) and read the max/avg luminance of a fractional region, plus a
 * left->right luminance profile across it (for the scrim-edge check). ---- */
async function sampleRegion(buf, fmt, region, wantStroke = false) {
  const dataUrl = `data:image/${fmt};base64,${buf.toString("base64")}`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ src, region, wantStroke }) => {
      const img = new Image(); img.src = src; await img.decode();
      const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext("2d").drawImage(img, 0, 0);
      const ctx = cv.getContext("2d");
      const rx = Math.floor(region.x * cv.width), ry = Math.floor(region.y * cv.height);
      const rw = Math.max(1, Math.floor(region.w * cv.width)), rh = Math.max(1, Math.floor(region.h * cv.height));
      const d = ctx.getImageData(rx, ry, rw, rh).data;
      const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const L = (i) => 0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255);
      let maxL = 0, sum = 0, n = 0, opaque = 0, chroma = 0, white = 0, sumOp = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = L(i); maxL = Math.max(maxL, l); sum += l; n++;
        if (d[i + 3] > 127) {
          opaque++; sumOp += l;
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          // CHROMATIC = saturated AND bright enough to read as colour —
          // relative saturation blows up on near-black ink (#231815 reads
          // sat 0.40), so dark pixels never count as colour
          if (mx > 90 && (mx - mn) / mx > 0.25) chroma++;
          if (l > 0.72) white++; // 白肌/白地 (linear-luminance near-white)
        }
      }
      // Stroke-weight proxy (icons only): 2*area/perimeter ~= the line thickness,
      // INDEPENDENT of how many strokes the glyph has (density-invariant — a busy
      // globe and a sparse arrow at the same stroke width read the same here).
      let strokePx = 0;
      if (wantStroke) {
        const op = (x, y) => (x < 0 || y < 0 || x >= rw || y >= rh) ? false : d[(y * rw + x) * 4 + 3] > 127;
        let edge = 0;
        for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
          if (!op(x, y)) continue;
          if (!op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1)) edge++;
        }
        strokePx = edge > 0 ? (2 * opaque) / edge : 0;
      }
      // horizontal luminance profile (column means) for the edge-softness check
      const cols = 24, prof = [];
      for (let c = 0; c < cols; c++) {
        let s = 0, m = 0; const x0 = Math.floor((c / cols) * rw), x1 = Math.floor(((c + 1) / cols) * rw);
        for (let x = x0; x < x1; x++) for (let y = 0; y < rh; y++) { const i = (y * rw + x) * 4; s += L(i); m++; }
        prof.push(m ? s / m : 0);
      }
      return { maxL, avgL: sum / n, inkL: opaque ? sumOp / opaque : 0, inkCov: n ? opaque / n : 0, chromaFrac: opaque ? chroma / opaque : 0, whiteFrac: opaque ? white / opaque : 0, strokePx, prof };
    }, { src: dataUrl, region, wantStroke });
  } finally { await page.close(); }
}

// Largest single-step jump in a luminance profile (0..1); a soft scrim ramps
// gradually, a hard edge jumps. Normalized by the profile's total range.
function maxStep(prof) {
  const range = Math.max(...prof) - Math.min(...prof);
  if (range < 0.03) return 0; // near-uniform region: no scrim gradient => no "edge" to judge
  let step = 0; for (let i = 1; i < prof.length; i++) step = Math.max(step, Math.abs(prof[i] - prof[i - 1]));
  return step / range;
}

// Text-over-bg regions per pattern (fractions of the slide) + the text colour.
// Cover: the white title is the strictest; kicker/subtitle sit in the same column.
function textRegions(slide, T) {
  if (slide.pattern === "cover") {
    return [{ name: "title", color: T.c.onDark, region: { x: 0.04, y: 0.27, w: 0.56, h: 0.24 } }];
  }
  if (slide.pattern === "cta") {
    return [{ name: "title", color: T.c.onDark, region: { x: 0.04, y: 0.24, w: 0.62, h: 0.24 } }];
  }
  if (slide.pattern === "section") {
    return [{ name: "title", color: T.c.onDark, region: { x: 0.04, y: 0.42, w: 0.56, h: 0.18 } }];
  }
  return [{ name: "text", color: T.c.ink, region: { x: 0.05, y: 0.15, w: 0.5, h: 0.4 } }];
}

async function lintPlan(planPath, themePath) {
  const T = loadTheme(themePath);
  const { slides, meta } = loadPlan(planPath);
  const findings = [];
  const persons = []; // every embedded person image: { slide, kind, style }
  const placeAspect = T.W / T.H;
  const needPxW = T.W * PX_PER_IN * 2, needPxH = T.H * PX_PER_IN * 2; // 2x full-bleed
  let images = 0, deckBytes = 0;
  const dir = path.dirname(path.resolve(planPath));
  const E = (slide, check, msg) => findings.push({ level: "ERROR", slide, check, msg });
  const W = (slide, check, msg) => findings.push({ level: "WARN", slide, check, msg });

  for (let i = 0; i < slides.length; i++) {
    const c = slides[i].content || {};
    // ---- full-bleed layers: opaque bg (WCAG scrim) + decoration motif/pattern
    //      (must NOT intrude into the text zone) — both share weight/res/aspect ----
    const layers = [];
    if (c.bg) layers.push({ path: c.bg, kind: "bg", name: "bg" });
    if (c.bgPattern) layers.push({ path: c.bgPattern, kind: "decor", name: "bgPattern" });
    if (c.bgMotif) layers.push({ path: c.bgMotif, kind: "decor", name: "bgMotif" });
    for (const layer of layers) {
      images++;
      const p = path.isAbsolute(layer.path) ? layer.path : path.join(dir, layer.path);
      if (!fs.existsSync(p)) { E(i + 1, "MISSING", `${layer.name} image not found: ${layer.path}`); continue; }
      const buf = fs.readFileSync(p);
      deckBytes += buf.length;
      if (buf.length > WEIGHT_ERR) E(i + 1, "WEIGHT", `${layer.name} ${(buf.length / 1024 | 0)}KB > ${WEIGHT_ERR / 1024}KB (use JPEG / drop grain / reuse)`);
      else if (buf.length > WEIGHT_WARN) W(i + 1, "WEIGHT", `${layer.name} ${(buf.length / 1024 | 0)}KB > ${WEIGHT_WARN / 1024}KB`);
      const dims = imageDims(buf);
      if (!dims) { E(i + 1, "FORMAT", `${layer.name}: cannot read image dimensions (not PNG/JPEG?)`); continue; }
      if (dims.w < needPxW * 0.98 || dims.h < needPxH * 0.98) E(i + 1, "RESOLUTION", `${layer.name} ${dims.w}x${dims.h} below the 2x floor (${Math.round(needPxW)}x${Math.round(needPxH)}) — 2x未満は禁止 (upscale blur)`);
      else if (dims.w < needPxW * 1.5 || dims.h < needPxH * 1.5) W(i + 1, "RESOLUTION", `${layer.name} ${dims.w}x${dims.h} at ~2x — full-bleed (大判) placements should be 3-4x (${Math.round(needPxW * 1.5)}x${Math.round(needPxH * 1.5)}+)`);
      const imgAspect = dims.w / dims.h, dev = Math.abs(imgAspect - placeAspect) / placeAspect;
      if (dev > 0.15) E(i + 1, "ASPECT", `${layer.name} aspect ${imgAspect.toFixed(3)} vs slide ${placeAspect.toFixed(3)} (${(dev * 100).toFixed(0)}% stretch)`);
      else if (dev > 0.05) W(i + 1, "ASPECT", `${layer.name} aspect ${imgAspect.toFixed(3)} vs slide ${placeAspect.toFixed(3)} (${(dev * 100).toFixed(0)}% off)`);
      for (const tr of textRegions(slides[i], T)) {
        const smp = await sampleRegion(buf, dims.fmt, tr.region);
        if (layer.kind === "bg") { // opaque bg: WCAG scrim contrast (worst-case brightest pixel) + edge
          const cr = contrast(lumHex(tr.color), smp.maxL);
          if (cr < CONTRAST_ERR) E(i + 1, "SCRIM", `${tr.name}: text/bg contrast ${cr.toFixed(2)} < ${CONTRAST_ERR} (scrim too weak — text illegible over the background)`);
          else if (cr < CONTRAST_WARN) W(i + 1, "SCRIM", `${tr.name}: text/bg contrast ${cr.toFixed(2)} < ${CONTRAST_WARN}`);
          const step = maxStep(smp.prof);
          if (step > 0.55) W(i + 1, "SCRIM-EDGE", `${tr.name}: scrim has a hard edge (max step ${(step * 100).toFixed(0)}% of range — feather it)`);
        } else { // decoration: keep it out of the text zone (corners/bands only)
          if (smp.inkCov > INTRUDE_ERR) E(i + 1, "MOTIF-INTRUDE", `${layer.name} covers ${(smp.inkCov * 100) | 0}% of the ${tr.name} text zone (> ${(INTRUDE_ERR * 100) | 0}%) — keep motifs in corners/bands, clear of text`);
          else if (smp.inkCov > INTRUDE_WARN) W(i + 1, "MOTIF-INTRUDE", `${layer.name} covers ${(smp.inkCov * 100) | 0}% of the ${tr.name} text zone (> ${(INTRUDE_WARN * 100) | 0}%) — verify it doesn't crowd the text`);
        }
      }
    }
    // ---- emphasis marker (circle): the overlay must DECORATE the number,
    //      never obscure it — the asset's CENTRE must stay transparent (the
    //      glyph cores live there), the ring must exist, and it must be sharp
    //      enough at its placement (2x) ----
    if (c.marker && c.marker.type === "circle" && c.marker.image) {
      const p = path.isAbsolute(c.marker.image) ? c.marker.image : path.join(dir, c.marker.image);
      if (!fs.existsSync(p)) { E(i + 1, "MARKER", `circle marker image not found: ${c.marker.image}`); }
      else {
        const buf = fs.readFileSync(p);
        deckBytes += buf.length; images++;
        if (buf.length > WEIGHT_WARN) W(i + 1, "MARKER", `circle marker ${(buf.length / 1024 | 0)}KB — a stroke overlay should be tiny`);
        const dims = imageDims(buf);
        if (!dims) E(i + 1, "MARKER", "circle marker: cannot read image dimensions");
        else {
          if (dims.fmt !== "png") E(i + 1, "MARKER", "circle marker must be a transparent PNG (JPEG has no alpha — it would blank the number)");
          const box = circleMarkerSize(slides[i], T);
          if (box && (dims.w < box.w * PX_PER_IN * 2 * 0.98 || dims.h < box.h * PX_PER_IN * 2 * 0.98)) {
            E(i + 1, "RESOLUTION", `circle marker ${dims.w}x${dims.h}px below the 2x floor for its placement (${Math.round(box.w * PX_PER_IN * 2)}x${Math.round(box.h * PX_PER_IN * 2)}) — 2x未満は禁止 (asset pipeline)`);
          }
          // centre 45% region must be (near-)empty; the ring must have ink
          const centre = await sampleRegion(buf, dims.fmt, { x: 0.275, y: 0.275, w: 0.45, h: 0.45 });
          const whole = await sampleRegion(buf, dims.fmt, { x: 0, y: 0, w: 1, h: 1 });
          if (centre.inkCov > 0.02) E(i + 1, "MARKER", `circle marker ink covers ${(centre.inkCov * 100).toFixed(1)}% of its CENTRE — the stroke crosses the glyph cores; regenerate with more clearance`);
          if (whole.inkCov < 0.003) W(i + 1, "MARKER", "circle marker appears empty (no visible ring)");
        }
      }
    }

    // ---- persona rasters (asset-pipeline floor): every embedded overlay PNG
    //      >= 2x its placement (ERROR — 2x未満は禁止), large placements 3-4x
    //      (WARN below 3x), transparency preserved (figure/bubble/symbol
    //      composite OVER the slide), supplied figures carry a LICENSE.md ----
    if (c.persona && typeof c.persona === "object" && c.persona.quote) {
      const per = c.persona;
      const L = personaLayout(per, T, slides[i].pattern);
      const rasters = [];
      // the license record lives next to the SOURCE asset (per.figure), not
      // next to a rasterized copy in the build's assets dir — checking the
      // materialized PNG's directory false-warned on SVG-supplied figures
      if (per.figureImage) rasters.push({ path: per.figureImage, name: "persona figure", box: L.fig, licensed: per.figure ? (path.isAbsolute(per.figure) ? per.figure : path.join(dir, per.figure)) : null });
      if (per.bubbleImage) rasters.push({ path: per.bubbleImage, name: "persona bubble", box: L.bubble });
      if (per.symbolImage && L.symbol) rasters.push({ path: per.symbolImage, name: "persona symbol", box: L.symbol });
      for (const r of rasters) {
        const p = path.isAbsolute(r.path) ? r.path : path.join(dir, r.path);
        if (!fs.existsSync(p)) { E(i + 1, "MISSING", `${r.name} not found: ${r.path}`); continue; }
        const buf = fs.readFileSync(p);
        deckBytes += buf.length; images++;
        const dims = imageDims(buf);
        if (!dims) { E(i + 1, "FORMAT", `${r.name}: cannot read image dimensions`); continue; }
        // resolution floor: effective scale = px / (placement-in x 96); >= 2 REQUIRED
        const eff = Math.min(dims.w / (r.box.w * PX_PER_IN), dims.h / (r.box.h * PX_PER_IN));
        if (r.name === "persona figure") {
          const sm = await sampleRegion(buf, dims.fmt, { x: 0, y: 0, w: 1, h: 1 });
          persons.push({ slide: i + 1, kind: "persona figure", style: personStyleOf(sm) });
        }
        if (eff < 2 * 0.98) E(i + 1, "RESOLUTION", `${r.name} ${dims.w}x${dims.h}px = ${eff.toFixed(2)}x its ${r.box.w.toFixed(2)}x${r.box.h.toFixed(2)}in placement — below the 2x floor (2x未満は禁止; upscale blur)`);
        else if (Math.max(r.box.w, r.box.h) > 5 && eff < 3) W(i + 1, "RESOLUTION", `${r.name} at ${eff.toFixed(2)}x — large placements (>5in) should be rendered at 3-4x`);
        // transparency floor: these composite OVER slide content — an opaque
        // ground would blank whatever sits behind (JPEG has no alpha at all)
        if (dims.fmt !== "png") E(i + 1, "OPACITY", `${r.name} must be a transparent PNG (got ${dims.fmt} — no alpha channel; 背景不透過)`);
        else if (!pngHasAlpha(buf)) E(i + 1, "OPACITY", `${r.name}: PNG carries no transparency (colour type ${buf[25]}, no tRNS) — 背景不透過が混入`);
        else {
          // alpha channel EXISTS but may be all-opaque: a genuine cut-out has
          // transparent corners (the bubble's rounded corners / tail zone too)
          let opaqueCorners = 0;
          for (const cn of [{ x: 0, y: 0 }, { x: 0.92, y: 0 }, { x: 0, y: 0.92 }, { x: 0.92, y: 0.92 }]) {
            const smp = await sampleRegion(buf, dims.fmt, { x: cn.x, y: cn.y, w: 0.08, h: 0.08 });
            if (smp.inkCov > 0.98) opaqueCorners++;
          }
          if (opaqueCorners === 4) E(i + 1, "OPACITY", `${r.name}: all four corners fully opaque — a baked background, not a cut-out (透過が保たれていない)`);
        }
        // license record floor (supplied assets only): rights terms live NEXT
        // to the asset (実在人物の肖像・IP・ロゴ不可 — M-7's rights-clean bar)
        if (r.licensed) {
          const d0 = path.dirname(r.licensed);
          if (!fs.existsSync(path.join(d0, "LICENSE.md")) && !fs.existsSync(path.join(path.dirname(d0), "LICENSE.md"))) {
            W(i + 1, "LICENSE", `supplied figure ${path.basename(p)} has no LICENSE.md beside it — record 出所・帰属要否・商用可否 (assets/generated/figures/LICENSE.md)`);
          }
        }
      }
    }

    // ---- avatars (dialogue/testimonial): every avatar rides the same raster
    //      floor as persona figures, PLUS set-level uniformity (同一色・同一
    //      フレーミング・同一円径 — 1様式) and the bust check (a full-body
    //      figure squeezed into the circle reads tiny: low ink coverage) ----
    if (slides[i].pattern === "dialogue" || slides[i].pattern === "testimonial") {
      const c2 = slides[i].content || {};
      const L2 = slides[i].pattern === "dialogue" ? dialogueLayout(T, c2) : testimonialLayout(T, c2);
      const avatars = [];
      if (L2.form === "compare") L2.cols.forEach((col, ci) => col.speakers.forEach((row, k) => {
        const sp = ((c2.columns[ci] || {}).speakers || [])[k];
        if (sp && sp.avatarImage) avatars.push({ sp, box: row.avatar, where: `columns[${ci}].speakers[${k}]` });
      }));
      else if (L2.form === "plain") L2.speakers.forEach((row, k) => {
        const sp = (c2.speakers || [])[k];
        if (sp && sp.avatarImage) avatars.push({ sp, box: row.avatar, where: `speakers[${k}]` });
      });
      else L2.cards.forEach((row, k) => {
        const sp = (c2.items || [])[k];
        if (sp && sp.avatarImage) avatars.push({ sp, box: row.avatar, where: `items[${k}]` });
      });
      const stats = [];
      for (const a of avatars) {
        const p = path.isAbsolute(a.sp.avatarImage) ? a.sp.avatarImage : path.join(dir, a.sp.avatarImage);
        if (!fs.existsSync(p)) { E(i + 1, "MISSING", `avatar not found: ${a.sp.avatarImage}`); continue; }
        const buf = fs.readFileSync(p);
        deckBytes += buf.length; images++;
        const dims = imageDims(buf);
        if (!dims) { E(i + 1, "FORMAT", `avatar ${a.where}: cannot read dimensions`); continue; }
        const eff = Math.min(dims.w / (a.box.w * PX_PER_IN), dims.h / (a.box.h * PX_PER_IN));
        if (eff < 2 * 0.98) E(i + 1, "RESOLUTION", `avatar ${a.where} ${dims.w}x${dims.h}px = ${eff.toFixed(2)}x its placement — below the 2x floor`);
        if (dims.fmt !== "png") E(i + 1, "OPACITY", `avatar ${a.where} must be a transparent PNG (got ${dims.fmt})`);
        else if (!pngHasAlpha(buf)) E(i + 1, "OPACITY", `avatar ${a.where}: PNG carries no transparency — 円マスクの外が不透過`);
        const whole = await sampleRegion(buf, dims.fmt, { x: 0, y: 0, w: 1, h: 1 });
        const avStyle = personStyleOf(whole);
        persons.push({ slide: i + 1, kind: `avatar ${a.where}`, style: avStyle });
        // bust check: head+shoulders fill roughly half the circle; a full-body
        // silhouette shrunk into it covers far less
        if (whole.inkCov < 0.3) W(i + 1, "AVATAR-UNIFORM", `avatar ${a.where}: only ${(whole.inkCov * 100) | 0}% of the tile is inked — 全身図の混入疑い（胸〜肩のバストで切る）`);
        stats.push({ where: a.where, w: dims.w, h: dims.h, avgL: whole.inkL, style: avStyle });
      }
      if (stats.length >= 2) {
        const ws = stats.map((x) => x.w);
        if (Math.max(...ws) / Math.min(...ws) > 1.15) W(i + 1, "AVATAR-UNIFORM",
          `avatar pixel sizes vary ${Math.min(...ws)}..${Math.max(...ws)}px — 同一フレーミング・同一円径で統一 (1様式)`);
        // tone spread is a SILHOUETTE-set check (one ink); illustration sets
        // legitimately vary by hair colour — size/bust checks still apply
        const ls = stats.filter((x) => x.style === "silhouette").map((x) => x.avgL);
        if (ls.length >= 2 && Math.max(...ls) - Math.min(...ls) > 0.12) W(i + 1, "AVATAR-UNIFORM",
          `avatar tones vary (avg luminance ${Math.min(...ls).toFixed(2)}..${Math.max(...ls).toFixed(2)}) — 同一色（黒シルエット）で統一、カラー版/別出所を混ぜない`);
      }
    }

    // ---- icon set: optical-size + stroke/weight consistency (the gap the pop
    //      generality test surfaced — no lint judged icon uniformity) ----
    const iconStats = [];
    for (const ic of slideIcons(slides[i])) {
      const p = path.isAbsolute(ic.path) ? ic.path : path.join(dir, ic.path);
      if (!fs.existsSync(p)) { E(i + 1, "MISSING", `icon not found: ${ic.path}`); continue; }
      const buf = fs.readFileSync(p);
      deckBytes += buf.length; images++;
      const dims = imageDims(buf);
      if (!dims) { E(i + 1, "FORMAT", `icon ${ic.where}: cannot read dimensions`); continue; }
      if (Math.min(dims.w, dims.h) < ICON_MIN_PX / 0.75 * 0.98) E(i + 1, "RESOLUTION", `icon ${ic.where} ${dims.w}x${dims.h} below the 2x floor (${Math.round(ICON_MIN_PX / 0.75)}px) — 2x未満は禁止 (upscale blur)`);
      const smp = await sampleRegion(buf, dims.fmt, { x: 0, y: 0, w: 1, h: 1 }, true); // whole-icon stroke proxy
      iconStats.push({ where: ic.where, dim: Math.max(dims.w, dims.h), stroke: smp.strokePx / Math.max(dims.w, dims.h) });
    }
    if (iconStats.length >= 2) {
      const ds = iconStats.map((s) => s.dim), sw = iconStats.map((s) => s.stroke);
      const dimRatio = Math.max(...ds) / Math.min(...ds), strokeSpread = Math.max(...sw) - Math.min(...sw);
      if (dimRatio > ICON_DIM_RATIO) E(i + 1, "ICON-SET", `icon optical sizes vary ${dimRatio.toFixed(2)}x (${Math.min(...ds)}..${Math.max(...ds)}px) — render the set at one size`);
      if (strokeSpread > ICON_STROKE_SPREAD) E(i + 1, "ICON-SET", `icon stroke weight varies (${(Math.min(...sw) * 100).toFixed(1)}%..${(Math.max(...sw) * 100).toFixed(1)}% of icon size, spread ${(strokeSpread * 100).toFixed(1)}% > ${(ICON_STROKE_SPREAD * 100).toFixed(0)}%) — use one stroke width across the set`);
    }
  }
  if (deckBytes > DECK_ERR) E(null, "WEIGHT", `total embedded images ${(deckBytes / 1024 / 1024).toFixed(1)}MB > ${DECK_ERR / 1024 / 1024}MB`);

  // ---- STYLE-UNIFORM (1デッキ1様式): every person in the deck — persona
  //      figures AND avatars — must share ONE style. The style is a COLOUR-
  //      TONE PROXY (silhouette = no saturated pixels, illustration = has
  //      them); 中間色・淡彩は誤判定余地 = final call stays with human eyes.
  //      Declared meta.personStyle -> any off-style person is an ERROR;
  //      undeclared -> mixing BOTH styles in one deck is still an ERROR. ----
  if (process.env.STYLE_DEBUG) console.error("persons:", JSON.stringify(persons));
  const declared = meta && meta.personStyle;
  if (declared) {
    for (const p of persons) {
      if (p.style !== declared) E(p.slide, "STYLE-UNIFORM",
        `${p.kind} reads as ${p.style} in a personStyle="${declared}" deck — 1デッキ1様式 (register が様式を決める; 混在禁止)`);
    }
  } else if (persons.length) {
    const styles = [...new Set(persons.map((p) => p.style))];
    if (styles.length > 1) {
      const by = (st) => persons.filter((p) => p.style === st).map((p) => `s${p.slide}`).join(",");
      E(null, "STYLE-UNIFORM",
        `deck mixes person styles: illustration [${by("illustration")}] vs silhouette [${by("silhouette")}] — 1デッキ1様式。meta.personStyle を宣言し、全人物をその様式で統一する`);
    }
  }

  const errors = findings.filter((f) => f.level === "ERROR").length;
  return { plan: planPath, images, deckKB: Math.round(deckBytes / 1024), findings, pass: errors === 0, errors, warnings: findings.length - errors };
}

const USAGE = `image-lint — pixel gate for hybrid decks (scrim contrast / resolution / aspect / weight)
  node bin/lint/image-lint.js --plan <plan.json> [--theme <theme.json>] [--json]`;

async function main() {
  const a = { plan: null, theme: null, json: false };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--plan") a.plan = process.argv[++i];
    else if (k === "--theme") a.theme = process.argv[++i];
    else if (k === "--json") a.json = true;
    else if (k === "-h" || k === "--help") { console.log(USAGE); return 0; }
  }
  if (!a.plan) { console.error("Missing --plan.\n\n" + USAGE); return 2; }
  if (!a.theme) a.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  const res = await lintPlan(a.plan, a.theme);
  if (a.json) { console.log(JSON.stringify(res)); return res.pass ? 0 : 1; }
  console.log(`image-lint: ${res.plan}\n`);
  console.log(`images (bg/motif/icon): ${res.images}  |  total embedded: ${res.deckKB}KB`);
  const errs = res.findings.filter((f) => f.level === "ERROR");
  const warns = res.findings.filter((f) => f.level === "WARN");
  console.log(`\nERRORS (${errs.length})`); errs.forEach((f) => console.log(`  [${f.slide == null ? "deck" : "slide " + f.slide}] ${f.check}: ${f.msg}`)); if (!errs.length) console.log("  none");
  console.log(`\nWARNINGS (${warns.length})`); warns.forEach((f) => console.log(`  [${f.slide == null ? "deck" : "slide " + f.slide}] ${f.check}: ${f.msg}`)); if (!warns.length) console.log("  none");
  console.log(`\nSUMMARY: ${res.errors} error(s), ${res.warnings} warning(s) — ${res.pass ? "PASS" : "FAIL"}`);
  return res.pass ? 0 : 1;
}

main().then((c) => closeBrowser().then(() => process.exit(c))).catch((e) => { console.error("image-lint failed: " + (e && e.message ? e.message : e)); closeBrowser().finally(() => process.exit(2)); });

module.exports = { lintPlan, imageDims };
