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
const { loadPlan, loadTheme } = require("../generate.js");
const { getBrowser, closeBrowser } = require("../layout-html/measure.js");

const PX_PER_IN = 96;
// thresholds
const WEIGHT_ERR = 800 * 1024, WEIGHT_WARN = 400 * 1024, DECK_ERR = 6 * 1024 * 1024;
const CONTRAST_ERR = 3.0, CONTRAST_WARN = 4.5;

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
async function sampleRegion(buf, fmt, region) {
  const dataUrl = `data:image/${fmt};base64,${buf.toString("base64")}`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ src, region }) => {
      const img = new Image(); img.src = src; await img.decode();
      const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext("2d").drawImage(img, 0, 0);
      const ctx = cv.getContext("2d");
      const rx = Math.floor(region.x * cv.width), ry = Math.floor(region.y * cv.height);
      const rw = Math.max(1, Math.floor(region.w * cv.width)), rh = Math.max(1, Math.floor(region.h * cv.height));
      const d = ctx.getImageData(rx, ry, rw, rh).data;
      const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const L = (i) => 0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255);
      let maxL = 0, sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const l = L(i); maxL = Math.max(maxL, l); sum += l; n++; }
      // horizontal luminance profile (column means) for the edge-softness check
      const cols = 24, prof = [];
      for (let c = 0; c < cols; c++) {
        let s = 0, m = 0; const x0 = Math.floor((c / cols) * rw), x1 = Math.floor(((c + 1) / cols) * rw);
        for (let x = x0; x < x1; x++) for (let y = 0; y < rh; y++) { const i = (y * rw + x) * 4; s += L(i); m++; }
        prof.push(m ? s / m : 0);
      }
      return { maxL, avgL: sum / n, prof };
    }, { src: dataUrl, region });
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
  const { slides } = loadPlan(planPath);
  const findings = [];
  const placeAspect = T.W / T.H;
  const needPxW = T.W * PX_PER_IN * 2, needPxH = T.H * PX_PER_IN * 2; // 2x full-bleed
  let images = 0, deckBytes = 0;
  const dir = path.dirname(path.resolve(planPath));
  const E = (slide, check, msg) => findings.push({ level: "ERROR", slide, check, msg });
  const W = (slide, check, msg) => findings.push({ level: "WARN", slide, check, msg });

  for (let i = 0; i < slides.length; i++) {
    const bg = slides[i].content && slides[i].content.bg;
    if (!bg) continue;
    images++;
    const p = path.isAbsolute(bg) ? bg : path.join(dir, bg);
    if (!fs.existsSync(p)) { E(i + 1, "MISSING", `bg image not found: ${bg}`); continue; }
    const buf = fs.readFileSync(p);
    deckBytes += buf.length;
    // (5) weight
    if (buf.length > WEIGHT_ERR) E(i + 1, "WEIGHT", `bg ${(buf.length / 1024 | 0)}KB > ${WEIGHT_ERR / 1024}KB (use JPEG / drop grain / reuse)`);
    else if (buf.length > WEIGHT_WARN) W(i + 1, "WEIGHT", `bg ${(buf.length / 1024 | 0)}KB > ${WEIGHT_WARN / 1024}KB`);
    const dims = imageDims(buf);
    if (!dims) { E(i + 1, "FORMAT", "cannot read image dimensions (not PNG/JPEG?)"); continue; }
    // (2) resolution
    if (dims.w < needPxW * 0.75 || dims.h < needPxH * 0.75) E(i + 1, "RESOLUTION", `bg ${dims.w}x${dims.h} < ~2x placement (${Math.round(needPxW)}x${Math.round(needPxH)}) — upscale blur`);
    else if (dims.w < needPxW || dims.h < needPxH) W(i + 1, "RESOLUTION", `bg ${dims.w}x${dims.h} below 2x placement (${Math.round(needPxW)}x${Math.round(needPxH)})`);
    // (3) aspect
    const imgAspect = dims.w / dims.h, dev = Math.abs(imgAspect - placeAspect) / placeAspect;
    if (dev > 0.15) E(i + 1, "ASPECT", `bg aspect ${imgAspect.toFixed(3)} vs slide ${placeAspect.toFixed(3)} (${(dev * 100).toFixed(0)}% stretch)`);
    else if (dev > 0.05) W(i + 1, "ASPECT", `bg aspect ${imgAspect.toFixed(3)} vs slide ${placeAspect.toFixed(3)} (${(dev * 100).toFixed(0)}% off)`);
    // (1) scrim/contrast + (4) scrim edge — sample each text region
    for (const tr of textRegions(slides[i], T)) {
      const s = await sampleRegion(buf, dims.fmt, tr.region);
      const cr = contrast(lumHex(tr.color), s.maxL); // worst-case: brightest bg pixel under the text
      if (cr < CONTRAST_ERR) E(i + 1, "SCRIM", `${tr.name}: text/bg contrast ${cr.toFixed(2)} < ${CONTRAST_ERR} (scrim too weak — text illegible over the background)`);
      else if (cr < CONTRAST_WARN) W(i + 1, "SCRIM", `${tr.name}: text/bg contrast ${cr.toFixed(2)} < ${CONTRAST_WARN}`);
      const step = maxStep(s.prof);
      if (step > 0.55) W(i + 1, "SCRIM-EDGE", `${tr.name}: scrim has a hard edge (max step ${(step * 100).toFixed(0)}% of range — feather it)`);
    }
  }
  if (deckBytes > DECK_ERR) E(null, "WEIGHT", `total embedded images ${(deckBytes / 1024 / 1024).toFixed(1)}MB > ${DECK_ERR / 1024 / 1024}MB`);

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
  console.log(`bg images: ${res.images}  |  total embedded: ${res.deckKB}KB`);
  const errs = res.findings.filter((f) => f.level === "ERROR");
  const warns = res.findings.filter((f) => f.level === "WARN");
  console.log(`\nERRORS (${errs.length})`); errs.forEach((f) => console.log(`  [${f.slide == null ? "deck" : "slide " + f.slide}] ${f.check}: ${f.msg}`)); if (!errs.length) console.log("  none");
  console.log(`\nWARNINGS (${warns.length})`); warns.forEach((f) => console.log(`  [${f.slide == null ? "deck" : "slide " + f.slide}] ${f.check}: ${f.msg}`)); if (!warns.length) console.log("  none");
  console.log(`\nSUMMARY: ${res.errors} error(s), ${res.warnings} warning(s) — ${res.pass ? "PASS" : "FAIL"}`);
  return res.pass ? 0 : 1;
}

main().then((c) => closeBrowser().then(() => process.exit(c))).catch((e) => { console.error("image-lint failed: " + (e && e.message ? e.message : e)); closeBrowser().finally(() => process.exit(2)); });

module.exports = { lintPlan, imageDims };
