#!/usr/bin/env node
/* ============================================================
 *  bin/lint/saliency-lint.js — 顕著性 gate on the RENDERED pixels
 *
 *  A slide that DECLARES a protagonist (content.emphasis; chart: the bar
 *  emphasizeIndex) must actually render it as the most salient element. The
 *  first A/B proved a token-based static proxy cannot judge this (it passed a
 *  slide whose protagonist visibly lost), so this lint scores the REAL pixels
 *  of the soffice render (bin/qa.sh output):
 *
 *    score(element) = Σ over the element's region of
 *                       ink pixels (|lum - slide bg lum| > INK_TH)
 *                       weighted by |ΔL| x (1 + saturation)
 *
 *  ≒ 面積 x コントラスト x 彩度. The rule is the spec's: the protagonist must
 *  hold the MAXIMUM score on its slide; any rival above it => WARN
 *  (主役より目立つ脇役). Calibrated on the real A/B pair: the pale-tint
 *  failure warns (55 vs 69), its AREA-emphasis rebuild passes (75 vs 69) —
 *  the integrated-ink metric compresses differences, so no extra dominance
 *  factor is layered on top of argmax.
 *
 *  This is an approximation, NOT gaze prediction — its one job is catching a
 *  louder bystander; composition remains the eye's final call (M-2). WARN
 *  only => exit 0 (advisory); exit 2 on operational failure.
 *
 *  Acceptance (verified in-repo): the first A/B's pale-tint stat-grid (8.4%
 *  emphasized, out-shone by 48.2億円) MUST warn; the AREA-emphasis rebuild of
 *  the same 4 KPIs MUST pass.
 *
 *  Usage:
 *    node bin/lint/saliency-lint.js --plan <plan.json> [--theme <t.json>]
 *         --render <qa-dir with slide-N.jpg> [--json]
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { loadPlan, loadTheme } = require("../generate.js");
const { getBrowser, closeBrowser } = require("../layout-html/measure.js");
const { resolveStatGrid, flowLayout, cycleLayout, matrixLayout } = require("../graphics/diagrams.js");

/* ---- tunables (calibrated on the real A/B pair — see header) ---- */
const INK_TH = 0.18;    // |ΔL| below this is ground (excludes the surfaceAccent tint ~0.12)
const DOMINANCE = 1.0;  // argmax per spec: WARN only when a rival strictly beats the protagonist

/* ---- linear luminance of one sRGB hex (theme token) ---- */
const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function lumHex(hex) {
  const h = String(hex).replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 1;
  return 0.2126 * lin(parseInt(h.slice(0, 2), 16) / 255)
       + 0.7152 * lin(parseInt(h.slice(2, 4), 16) / 255)
       + 0.0722 * lin(parseInt(h.slice(4, 6), 16) / 255);
}

/* ---- per-pattern element REGIONS (inches; converted to fractions) ----
 * The same geometry the engine draws with (single sources: statGridLayout /
 * flow/cycle/matrix layouts in diagrams.js; builder constants elsewhere). */
function elementRegions(sl, T) {
  const c = sl.content || {};
  const e = Number.isInteger(c.emphasis) ? c.emphasis : -1;
  switch (sl.pattern) {
    case "stat-grid": {
      // legacy emphasizeIndex decks are scored too (equal cells — exactly the
      // weak pale-tint treatment the first A/B exposed; expect true WARNs).
      const eAny = e >= 0 ? e : Number.isInteger(c.emphasizeIndex) ? c.emphasizeIndex : -1;
      if (eAny < 0 || !Array.isArray(c.stats)) return null;
      const { cells } = resolveStatGrid(T, c.stats, e); // content-aware (atom rule); equal cells when e<0 (legacy)
      // include the shoulder strip (badge rides the top edge)
      return { e: eAny, unit: "card", boxes: cells.map((q) => ({ x: q.x, y: q.y - 0.2, w: q.w, h: q.h + 0.2 })) };
    }
    case "chart": {
      const eb = Number.isInteger(c.emphasizeIndex) ? c.emphasizeIndex : -1;
      const ct = c.chartType || "column";
      if (eb < 0 || Array.isArray(c.series) || (ct !== "column" && ct !== "bar")) return null;
      const vals = (c.series && c.series.values) || [];
      const n = Math.max(vals.length, 1);
      // the native chart's plot box (generate.js axisOpts): x m, y 2.2, 7.4 x 4.4
      if (ct === "bar") { // horizontal: rows top->bottom
        return { e: eb, unit: "bar", boxes: vals.map((v, i) => ({ x: T.m, y: 2.2 + (i * 4.4) / n, w: 7.4, h: 4.4 / n })) };
      }
      return { e: eb, unit: "bar", boxes: vals.map((v, i) => ({ x: T.m + (i * 7.4) / n, y: 2.2, w: 7.4 / n, h: 4.4 })) };
    }
    case "flow": {
      if (e < 0 || !Array.isArray(c.steps)) return null;
      const { nodes } = flowLayout(T, c.steps.length, c.direction);
      return { e, unit: "node", boxes: nodes.map((q) => ({ x: q.x - 0.05, y: q.y - 0.2, w: q.w + 0.1, h: q.h + 0.25 })) };
    }
    case "cycle": {
      if (e < 0 || !Array.isArray(c.steps)) return null;
      const { nodes } = cycleLayout(T, c.steps.length);
      return { e, unit: "node", boxes: nodes.map((q) => ({ x: q.x - 0.05, y: q.y - 0.2, w: q.w + 0.1, h: q.h + 0.25 })) };
    }
    case "matrix": {
      if (e < 0 || !Array.isArray(c.quadrants)) return null;
      const L = matrixLayout(T);
      return { e, unit: "quadrant", boxes: L.quads.map((q) => ({ x: q.x, y: q.y, w: q.w, h: q.h })) };
    }
    case "two-column": {
      if (e < 0 || !Array.isArray(c.items)) return null;
      const rx = 6.45, rw = T.W - T.m - rx, top = 2.5, gap = 1.46;
      return { e, unit: "item", boxes: c.items.map((it, i) => ({ x: rx, y: top + i * gap - 0.06, w: rw, h: 1.3 })) };
    }
    case "comparison": {
      if (e < 0) return null;
      const top = 2.5, h = 3.95, gap = 0.5;
      const w = (T.W - 2 * T.m - gap) / 2;
      return { e, unit: "side", boxes: [
        { x: T.m, y: top, w, h },
        { x: T.m + w + gap, y: top, w, h },
      ] };
    }
    case "card-grid": {
      if (e < 0 || !Array.isArray(c.cards)) return null;
      const n = c.cards.length, cols = Math.ceil(Math.max(n, 1) / 2);
      const cw = (T.W - 2 * T.m - (cols - 1) * 0.4) / cols;
      return { e, unit: "card", boxes: c.cards.map((cd, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        return { x: T.m + col * (cw + 0.4), y: 2.45 + row * (1.825 + 0.3), w: cw, h: 1.825 };
      }) };
    }
    default:
      return null;
  }
}

// Which background the slide's ink is judged against (the ground the engine
// painted): message+peak uses surfaceAccent; every scored pattern here is a
// light-body pattern on colors.bg.
function slideBgLum(sl, T) {
  if (sl.pattern === "message" && sl.peak === true) return lumHex(T.c.surfaceA);
  return lumHex(T.c.bg);
}

/* ---- pixel scoring in the reused Chromium (canvas decodes the JPG) ---- */
async function scoreRegions(imgPath, regions, bgLum) {
  const buf = fs.readFileSync(imgPath);
  const ext = path.extname(imgPath).toLowerCase() === ".png" ? "png" : "jpeg";
  const dataUrl = `data:image/${ext};base64,${buf.toString("base64")}`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ src, regions, bgLum, inkTh }) => {
      const img = new Image(); img.src = src; await img.decode();
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const out = [];
      for (const r of regions) {
        const rx = Math.max(0, Math.floor(r.x * cv.width)), ry = Math.max(0, Math.floor(r.y * cv.height));
        const rw = Math.min(cv.width - rx, Math.max(1, Math.floor(r.w * cv.width)));
        const rh = Math.min(cv.height - ry, Math.max(1, Math.floor(r.h * cv.height)));
        const d = ctx.getImageData(rx, ry, rw, rh).data;
        let score = 0, inkPx = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255;
          const L = 0.2126 * lin(R) + 0.7152 * lin(G) + 0.0722 * lin(B);
          const dL = Math.abs(L - bgLum);
          if (dL <= inkTh) continue;
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          score += dL * (1 + (mx - mn));
          inkPx++;
        }
        // normalize to slide-square-inch units so numbers are readable
        out.push({ score: score / (cv.width * cv.height) * 1e4, inkPx });
      }
      return out;
    }, { src: dataUrl, regions, bgLum, inkTh: INK_TH });
  } finally { await page.close(); }
}

// qa.sh names pages slide-1.jpg or slide-01.jpg depending on page count.
function findRender(dir, i) {
  for (const name of [`slide-${i}.jpg`, `slide-${String(i).padStart(2, "0")}.jpg`, `slide-${i}.png`, `slide-${String(i).padStart(2, "0")}.png`]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function lintPlan(planPath, themePath, renderDir) {
  const T = loadTheme(themePath);
  const { slides } = loadPlan(planPath);
  const findings = [];
  let checked = 0;
  for (let i = 0; i < slides.length; i++) {
    const model = elementRegions(slides[i], T);
    if (!model || model.e < 0 || model.e >= model.boxes.length) continue;
    const img = findRender(renderDir, i + 1);
    if (!img) {
      findings.push({ level: "WARN", slide: i + 1, check: "SALIENCY", msg: `no render found for slide ${i + 1} in ${renderDir} — run bin/qa.sh first` });
      continue;
    }
    const frac = model.boxes.map((b) => ({ x: b.x / T.W, y: b.y / T.H, w: b.w / T.W, h: b.h / T.H }));
    const scores = await scoreRegions(img, frac, slideBgLum(slides[i], T));
    checked++;
    const protag = scores[model.e].score;
    let worst = -1, worstScore = -Infinity;
    scores.forEach((sc, j) => { if (j !== model.e && sc.score > worstScore) { worstScore = sc.score; worst = j; } });
    if (worst >= 0 && protag < worstScore * DOMINANCE) {
      findings.push({ level: "WARN", slide: i + 1, check: "SALIENCY",
        msg: `${model.unit} ${worst} (score ${worstScore.toFixed(1)}) out-shines the emphasized ${model.unit} ${model.e} ` +
             `(score ${protag.toFixed(1)}) — 主役より目立つ脇役; strengthen the protagonist (area/marker), mute the rival, or move the emphasis`,
        scores: scores.map((s) => Number(s.score.toFixed(1))) });
    } else {
      findings.push({ level: "INFO", slide: i + 1, check: "SALIENCY",
        msg: `protagonist ${model.unit} ${model.e} dominates (${protag.toFixed(1)} vs runner-up ${worst >= 0 ? worstScore.toFixed(1) : "—"})`,
        scores: scores.map((s) => Number(s.score.toFixed(1))) });
    }
  }
  const warns = findings.filter((f) => f.level === "WARN").length;
  return { plan: planPath, render: renderDir, checked, findings, warnings: warns, pass: warns === 0 };
}

const USAGE = `saliency-lint — 顕著性 gate on the rendered pixels (主役が主役に見えているか)
  node bin/lint/saliency-lint.js --plan <plan.json> [--theme <t.json>] --render <qa-dir> [--json]`;

async function main() {
  const a = { plan: null, theme: null, render: null, json: false };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--plan") a.plan = process.argv[++i];
    else if (k === "--theme") a.theme = process.argv[++i];
    else if (k === "--render") a.render = process.argv[++i];
    else if (k === "--json") a.json = true;
    else if (k === "-h" || k === "--help") { console.log(USAGE); return 0; }
    else { console.error(`unknown arg: ${k}\n\n${USAGE}`); return 2; }
  }
  if (!a.plan || !a.render) { console.error("Missing --plan and/or --render.\n\n" + USAGE); return 2; }
  if (!a.theme) a.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  const res = await lintPlan(a.plan, a.theme, a.render);
  if (a.json) { console.log(JSON.stringify(res)); return 0; }
  console.log(`saliency-lint: ${res.plan}  (render: ${res.render})\n`);
  const warns = res.findings.filter((f) => f.level === "WARN");
  const infos = res.findings.filter((f) => f.level === "INFO");
  console.log(`WARNINGS (${warns.length})`);
  warns.forEach((f) => console.log(`  [slide ${f.slide}] ${f.check}: ${f.msg}`));
  if (!warns.length) console.log("  none");
  console.log(`\nINFO (${infos.length})`);
  infos.forEach((f) => console.log(`  [slide ${f.slide}] ${f.check}: ${f.msg}`));
  if (!infos.length) console.log("  none");
  console.log(`\nSUMMARY: ${res.checked} slide(s) checked, ${res.warnings} warning(s) — ${res.pass ? "PASS" : "CHECK BY EYE"}`);
  return 0; // advisory: warnings never break the build; the eye decides (M-2)
}

main().then((c) => closeBrowser().then(() => process.exit(c)))
  .catch((e) => { console.error("saliency-lint failed: " + (e && e.message ? e.message : e)); closeBrowser().finally(() => process.exit(2)); });

module.exports = { lintPlan, elementRegions };
