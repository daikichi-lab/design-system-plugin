#!/usr/bin/env node
/* ============================================================
 *  bin/svg-render.js — SVG -> PNG rasterizer (Phase C, spec 1a)
 *
 *  Turns a code-drawn SVG string into a 2x-resolution PNG so the engine can
 *  embed it as a *picture* (M-8: backgrounds/icons/special shapes are SVG;
 *  text/numbers/charts stay native). NO image generation anywhere (M-7): every
 *  pixel is deterministic, brand-token-driven, rights-clean.
 *
 *  Rasterizer = the Phase-B headless Chromium (reused via measure.js) — no new
 *  dependency (no resvg/sharp). Generated PNGs belong in each PROJECT's
 *  assets/generated/, never in the plugin (separation principle).
 *
 *  CLI: node bin/svg-render.js --recipe <name> [--theme t.json] [--w 1280] [--h 720]
 *                              [--scale 2] [--var <variant>] --out bg.png
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { getBrowser, closeBrowser } = require("./layout-html/measure.js");
const { loadTheme } = require("./generate.js");
const recipes = require("./graphics/recipes.js");

// Rasterize an SVG string to PNG at `scale`x via headless Chromium.
// widthPx/heightPx are the 1x CSS px; the PNG is scale× those dimensions.
async function renderSvgToPng({ svg, widthPx, heightPx, outPath, scale = 2, quality = 82 }) {
  // Format from extension: .jpg/.jpeg for OPAQUE backgrounds (~10x lighter than
  // PNG for gradients); .png for icons/shapes that need transparency.
  const jpeg = /\.jpe?g$/i.test(outPath);
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: Math.ceil(widthPx), height: Math.ceil(heightPx) },
    deviceScaleFactor: scale,
  });
  try {
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}svg{display:block}</style>${svg}`,
      { waitUntil: "load" });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const shot = { path: outPath, clip: { x: 0, y: 0, width: widthPx, height: heightPx } };
    if (jpeg) { shot.type = "jpeg"; shot.quality = quality; }
    else shot.omitBackground = true; // PNG icons/shapes are transparent (sit over the deck)
    await page.screenshot(shot);
    return { outPath, pxW: Math.round(widthPx * scale), pxH: Math.round(heightPx * scale), scale, format: jpeg ? "jpeg" : "png" };
  } finally {
    await page.close();
  }
}

module.exports = { renderSvgToPng };

/* ---------------- CLI ---------------- */
if (require.main === module) {
  const a = { recipe: null, theme: null, w: 1280, h: 720, scale: 2, out: null, variant: undefined };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--recipe") a.recipe = process.argv[++i];
    else if (k === "--theme") a.theme = process.argv[++i];
    else if (k === "--w") a.w = parseFloat(process.argv[++i]);
    else if (k === "--h") a.h = parseFloat(process.argv[++i]);
    else if (k === "--scale") a.scale = parseFloat(process.argv[++i]);
    else if (k === "--var") a.variant = process.argv[++i];
    else if (k === "--out") a.out = process.argv[++i];
  }
  if (!a.recipe || !a.out) { console.error("usage: svg-render.js --recipe <name> [--theme t.json] [--w][--h][--scale][--var] --out png"); process.exit(2); }
  if (!a.theme) a.theme = path.join(__dirname, "..", "themes", "_default-neutral", "theme.json");
  const fn = recipes[a.recipe];
  if (!fn) { console.error(`unknown recipe "${a.recipe}". known: ${Object.keys(recipes).join(", ")}`); process.exit(2); }

  (async () => {
    const T = loadTheme(a.theme);
    const svg = fn(T, { w: a.w, h: a.h, variant: a.variant });
    const r = await renderSvgToPng({ svg, widthPx: a.w, heightPx: a.h, outPath: a.out, scale: a.scale });
    await closeBrowser();
    console.log(`${a.recipe} -> ${r.outPath}  (${r.pxW}x${r.pxH}, ${r.scale}x)`);
  })().catch((e) => { console.error("svg-render failed: " + (e && e.message ? e.message : e)); process.exit(1); });
}
