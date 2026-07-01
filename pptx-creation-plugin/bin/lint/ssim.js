#!/usr/bin/env node
/* ============================================================
 *  bin/lint/ssim.js — structural-similarity comparator (spec §5.4)
 *
 *  Conversion-rate gauge: how faithfully the native pptx reproduces the HTML
 *  typesetting reference. Compares two PNGs (HTML render vs pptx render of the
 *  same block/slide), grayscale, windowed mean SSIM in [0,1].
 *
 *  HONEST CAVEAT (spec §5): this never reaches 1.0 even when the layout is
 *  "correct" — the browser and PowerPoint/LibreOffice rasterizers differ on
 *  hinting, anti-aliasing, and sub-pixel positioning. Treat a high score as
 *  success and use the region diff to localize real drift; do not chase 100%.
 *
 *  Dependency-free except pngjs (pure-JS PNG decode). Usage:
 *    node bin/lint/ssim.js <a.png> <b.png>
 * ============================================================ */
"use strict";

const fs = require("fs");
const { PNG } = require("pngjs");

function readGray(p) {
  const png = PNG.sync.read(fs.readFileSync(p));
  const { width, height, data } = png;
  const g = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    // Rec.601 luma; ignore alpha (both renders are opaque).
    g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return { width, height, g };
}

// nearest-neighbour resample to (W,H) so mismatched crops still compare.
function resizeTo(src, W, H) {
  if (src.width === W && src.height === H) return src;
  const g = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y * src.height / H));
    for (let x = 0; x < W; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x * src.width / W));
      g[y * W + x] = src.g[sy * src.width + sx];
    }
  }
  return { width: W, height: H, g };
}

// Mean SSIM over non-overlapping win×win blocks (Wang et al. constants).
function ssim(pathA, pathB, { win = 8 } = {}) {
  let a = readGray(pathA), b = readGray(pathB);
  const W = Math.min(a.width, b.width), H = Math.min(a.height, b.height);
  a = resizeTo(a, W, H); b = resizeTo(b, W, H);
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  const npx = win * win;
  let sum = 0, n = 0;
  for (let by = 0; by + win <= H; by += win) {
    for (let bx = 0; bx + win <= W; bx += win) {
      let ma = 0, mb = 0;
      for (let y = 0; y < win; y++) for (let x = 0; x < win; x++) {
        const idx = (by + y) * W + (bx + x);
        ma += a.g[idx]; mb += b.g[idx];
      }
      ma /= npx; mb /= npx;
      let va = 0, vb = 0, cov = 0;
      for (let y = 0; y < win; y++) for (let x = 0; x < win; x++) {
        const idx = (by + y) * W + (bx + x);
        const da = a.g[idx] - ma, db = b.g[idx] - mb;
        va += da * da; vb += db * db; cov += da * db;
      }
      va /= npx - 1; vb /= npx - 1; cov /= npx - 1;
      const s = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      sum += s; n++;
    }
  }
  return { ssim: n ? sum / n : 1, width: W, height: H, blocks: n };
}

module.exports = { ssim, readGray };

if (require.main === module) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) { console.error("usage: node ssim.js <a.png> <b.png>"); process.exit(2); }
  const r = ssim(a, b);
  console.log(`SSIM ${r.ssim.toFixed(4)}  (${(r.ssim * 100).toFixed(1)}% conversion, ${r.width}x${r.height}, ${r.blocks} blocks)`);
}
