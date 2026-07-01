#!/usr/bin/env node
/* ============================================================
 *  bin/layout-html/measure.js — HTML typesetting probe (Phase B, spec §5)
 *
 *  Render a text block in headless Chromium with the real Yu Gothic face,
 *  `line-break: strict` (Japanese 禁則), and `text-wrap: pretty|balance`
 *  (line-length balancing / orphan avoidance), then extract the EXACT line
 *  breaks the browser produced via a per-character getClientRects() walk.
 *
 *  Those baked break positions are what feed native pptx text runs — the
 *  browser is a RULER, never the slide (M-9). No screenshot becomes a slide.
 *
 *  Requires: playwright-core + a chromium binary in ~/.cache/ms-playwright,
 *  and Yu Gothic registered with fontconfig (spec §10). Without Yu Gothic the
 *  browser falls back and the breaks won't match PowerPoint.
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const PX_PER_IN = 96;      // CSS px per inch
const PX_PER_PT = 96 / 72; // CSS px per point

// Locate a chromium binary from the Playwright browser cache (we drive the
// already-downloaded browser via executablePath; playwright-core ships no browser).
function findChromium() {
  const base = path.join(process.env.HOME || "", ".cache", "ms-playwright");
  try {
    for (const dir of fs.readdirSync(base)) {
      if (!/^chromium-\d/.test(dir)) continue;
      for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const p = path.join(base, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch (_) { /* fall through */ }
  return null;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// CSS face + weight per theme font role (mirrors theme.font.heading/body/caption).
const ROLE_CSS = {
  heading: { family: "Yu Gothic", weight: 700 },
  body:    { family: "Yu Gothic Medium", weight: 500 },
  caption: { family: "Yu Gothic", weight: 400 },
};

let _browser = null;
async function getBrowser() {
  if (_browser) return _browser;
  const exe = findChromium();
  if (!exe) throw new Error("No chromium binary in ~/.cache/ms-playwright — install a Playwright browser.");
  _browser = await chromium.launch({
    executablePath: exe,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  return _browser;
}
async function closeBrowser() { if (_browser) { await _browser.close(); _browser = null; } }

/* Measure how `text` wraps in a `widthIn`-inch box at `sizePt`, font `role`,
 * `leading` multiple, and `wrap` strategy ('pretty' | 'balance' | 'auto').
 * Returns { lines:[string], count, lastLen, hasOrphan, lineLens }. */
async function measure({ text, widthIn, sizePt, role = "body", leading = 1.5, wrap = "pretty" }) {
  const css = ROLE_CSS[role] || ROLE_CSS.body;
  const widthPx = widthIn * PX_PER_IN;
  const sizePx = sizePt * PX_PER_PT;
  const wrapCss = wrap === "auto" ? "wrap" : wrap;
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: Math.ceil(widthPx) + 60, height: 900 } });
  try {
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>
        *{margin:0;padding:0;box-sizing:border-box;}
        #box{position:absolute;top:0;left:0;width:${widthPx}px;
          font-family:'${css.family}';font-weight:${css.weight};font-size:${sizePx}px;
          line-height:${leading};line-break:strict;word-break:normal;overflow-wrap:normal;
          text-wrap:${wrapCss};white-space:normal;}
      </style><div id="box"><span id="t">${escapeHtml(text)}</span></div>`,
      { waitUntil: "load" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    // Group characters into visual lines by the top of each character's client rect.
    const box = await page.evaluate(() => {
      const boxWidthPx = document.getElementById("box").clientWidth;
      const node = document.getElementById("t").firstChild;
      if (!node) return { lines: [], widths: [], boxWidthPx };
      const s = node.nodeValue;
      const rows = [], widths = [];
      let top = null, cur = "", minL = Infinity, maxR = -Infinity;
      const flush = () => { rows.push(cur); widths.push(maxR > minL ? maxR - minL : 0); cur = ""; minL = Infinity; maxR = -Infinity; };
      for (let i = 0; i < s.length; i++) {
        const r = document.createRange();
        r.setStart(node, i); r.setEnd(node, i + 1);
        const rect = r.getClientRects()[0];
        if (!rect) { cur += s[i]; continue; }
        const t = Math.round(rect.top);
        if (top === null) top = t;
        if (t !== top) { flush(); top = t; }
        minL = Math.min(minL, rect.left); maxR = Math.max(maxR, rect.right);
        cur += s[i];
      }
      if (cur) flush();
      return { lines: rows, widths, boxWidthPx };
    });
    const lines = box.lines;
    const lineLens = lines.map((l) => [...l].length);
    const count = lines.length;
    const lastLen = count ? lineLens[count - 1] : 0;
    // Orphan (泣き別れ): a trailing line of <=2 chars dangling under a multi-line block.
    const hasOrphan = count > 1 && lastLen <= 2;
    // fill = widest line / box width; lenVar = stdev of line char-lengths (balance quality).
    const fill = box.boxWidthPx ? Math.max(0, ...box.widths) / box.boxWidthPx : 0;
    const mean = lineLens.reduce((a, b) => a + b, 0) / (count || 1);
    const lenVar = Math.sqrt(lineLens.reduce((a, b) => a + (b - mean) ** 2, 0) / (count || 1));
    return { lines, count, lastLen, hasOrphan, lineLens, lineWidthsPx: box.widths, boxWidthPx: box.boxWidthPx, fill, lenVar };
  } finally {
    await page.close();
  }
}

/* Render already-broken `lines` as an HTML block to a PNG — the reference image
 * for the SSIM conversion-rate check (bin/lint/ssim.js). Matches a pptx text box:
 * same width, size, role, leading, alignment, at `dpi` (via deviceScaleFactor). */
async function renderPng({ lines, widthIn, sizePt, role = "body", leading = 1.5, align = "left",
  color = "1B2735", bg = "FFFFFF", dpi = 130, outPath }) {
  const css = ROLE_CSS[role] || ROLE_CSS.body;
  const widthPx = widthIn * PX_PER_IN;
  const sizePx = sizePt * PX_PER_PT;
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: Math.ceil(widthPx) + 40, height: 600 }, deviceScaleFactor: dpi / PX_PER_IN });
  try {
    const inner = lines.map(escapeHtml).join("<br>");
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}
        #box{width:${widthPx}px;background:#${bg};color:#${color};
          font-family:'${css.family}';font-weight:${css.weight};font-size:${sizePx}px;
          line-height:${leading};text-align:${align};line-break:strict;white-space:normal;}
      </style><div id="box">${inner}</div>`,
      { waitUntil: "load" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const el = await page.$("#box");
    await el.screenshot({ path: outPath });
  } finally {
    await page.close();
  }
}

module.exports = { measure, renderPng, getBrowser, closeBrowser, findChromium, ROLE_CSS, PX_PER_IN, PX_PER_PT };

/* ---- CLI: measure a text block three wrap strategies (auto/pretty/balance) ----
 * node measure.js [--text <s>] [--width <in>] [--size <pt>] [--role <r>] [--lead <n>]
 * Default demo = the financial caption that orphaned at 13.5pt (the real case). */
if (require.main === module) {
  const a = {};
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--text") a.text = process.argv[++i];
    else if (k === "--width") a.width = parseFloat(process.argv[++i]);
    else if (k === "--size") a.size = parseFloat(process.argv[++i]);
    else if (k === "--role") a.role = process.argv[++i];
    else if (k === "--lead") a.lead = parseFloat(process.argv[++i]);
  }
  const text = a.text || "売上高 前年同期比（上期）。営業利益率は8.4%（前年同期7.0%）。※社内管理数値・速報ベース";
  const cfg = {
    text,
    widthIn: a.width || (13.333 - 5.2),
    sizePt: a.size || 13.5,
    role: a.role || "caption",
    leading: a.lead || 1.5,
  };
  (async () => {
    console.log(`text (${[...text].length} chars) @ ${cfg.widthIn.toFixed(2)}in / ${cfg.sizePt}pt Yu Gothic ${cfg.role}:`);
    for (const wrap of ["auto", "pretty", "balance"]) {
      const r = await measure({ ...cfg, wrap });
      console.log(`\n[text-wrap:${wrap}] lines=${r.count} lens=[${r.lineLens}] lastLen=${r.lastLen} orphan=${r.hasOrphan ? "YES ⚠" : "no"}`);
      r.lines.forEach((l, i) => console.log(`  ${i + 1}| ${l}`));
    }
    await closeBrowser();
  })().catch((e) => { console.error("measure failed:", e && e.message ? e.message : e); process.exit(1); });
}
