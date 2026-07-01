#!/usr/bin/env node
/* ============================================================
 *  bin/lint/typo-lint.js — Japanese typesetting linter (spec §5.5)
 *
 *  Predicts how each wrapping PROSE field of a deck breaks in the real pptx
 *  (Yu Gothic @ the box's effective width, greedy wrap = PowerPoint behaviour)
 *  and scores typographic quality:
 *    - 泣き別れ / orphans   : a trailing line of <=2 chars under a multi-line block
 *    - last-line length     : too-short final lines
 *    - line-length variance : how unbalanced the lines are (lower = better)
 *    - fill ratio           : widest line / box width (too-empty blocks)
 *
 *  Unlike design-lint (static, no render), this drives the headless-browser
 *  typesetting engine, so it needs playwright-core + Yu Gothic (see
 *  bin/layout-html/measure.js). It measures the CURRENT (unbaked) plan;
 *  bake.js is what removes the orphans it reports.
 *
 *  Usage: node bin/lint/typo-lint.js --plan <plan.json> [--theme <theme.json>] [--json]
 *  Exit: 1 if any orphan, else 0.
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { loadPlan, loadTheme } = require("../generate.js");
const { measure, closeBrowser, breakPoints } = require("../layout-html/measure.js");
const { wrappingFields, effectiveWidth } = require("../layout-html/geometry.js");

// Count line breaks that fall INSIDE a budoux word/phrase (熟語分割) — i.e. an
// actual break index not among budoux's allowed boundaries (minus lexicon words).
function countSplits(lineLens, text, lexicon) {
  if (!lineLens || lineLens.length < 2) return 0;
  const allowed = breakPoints(text, lexicon);
  let acc = 0, n = 0;
  for (let k = 0; k < lineLens.length - 1; k++) { acc += lineLens[k]; if (!allowed.has(acc)) n++; }
  return n;
}

function parseArgs(argv) {
  const a = { plan: null, theme: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--plan") a.plan = argv[++i];
    else if (k === "--theme") a.theme = argv[++i];
    else if (k === "--json") a.json = true;
    else if (k === "--lexicon") a.lexicon = argv[++i];
    else if (k === "-h" || k === "--help") a.help = true;
  }
  return a;
}

async function lintPlan(planPath, themePath, lexicon = []) {
  const T = loadTheme(themePath);
  const { slides } = loadPlan(planPath);
  const findings = [];
  let measured = 0, multiline = 0, orphans = 0, splits = 0;
  let varSum = 0, fillSum = 0;

  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i];
    for (const f of wrappingFields(sl, T)) {
      const ew = effectiveWidth(f.widthIn, { bullet: f.bullet });
      measured++;
      if (f.baked) {
        // validate baked explicit lines: no orphan, no silent re-wrap, no split.
        const lens = f.lines.map((l) => [...l].length);
        const lastLen = lens[lens.length - 1] || 0;
        if (f.lines.length > 1) multiline++;
        const lineOrphan = f.lines.length > 1 && lastLen <= 3;
        let overflow = null;
        for (const ln of f.lines) {
          const rr = await measure({ text: ln, widthIn: ew, sizePt: f.sizePt, role: f.role, leading: f.leading, wrap: "auto" });
          if (rr.count > 1) { overflow = ln; break; }
        }
        const sp = countSplits(lens, f.lines.join(""), lexicon);
        splits += sp;
        if (lineOrphan || overflow) orphans++;
        if (lineOrphan || overflow || sp) {
          findings.push({
            slide: i + 1, pattern: sl.pattern, path: f.path, lens, lastLen, splits: sp,
            issue: (lineOrphan || overflow) ? "orphan" : "compound-split",
            snippet: (overflow || f.lines[f.lines.length - 1]).slice(0, 22) + (overflow ? " (baked line overflows)" : ""),
          });
        }
        continue;
      }
      const r = await measure({ text: f.text, widthIn: ew, sizePt: f.sizePt, role: f.role, leading: f.leading, wrap: "auto" });
      if (r.count > 1) { multiline++; varSum += r.lenVar; fillSum += r.fill; }
      const sp = countSplits(r.lineLens, f.text, lexicon);
      splits += sp;
      if (r.hasOrphan) orphans++;
      if (r.hasOrphan || sp) {
        findings.push({
          slide: i + 1, pattern: sl.pattern, path: f.path, lens: r.lineLens, lastLen: r.lastLen, splits: sp,
          issue: r.hasOrphan ? "orphan" : "compound-split",
          snippet: f.text.slice(0, 22) + (f.text.length > 22 ? "…" : ""),
        });
      }
    }
  }
  return {
    plan: planPath,
    measured, multiline, orphans, splits,
    avgLenVar: multiline ? +(varSum / multiline).toFixed(2) : 0,
    avgFill: multiline ? +(fillSum / multiline).toFixed(3) : 0,
    findings,
    // Exit gate is ORPHANS only (priority 1, hard). Compound splits (priority 2)
    // are tracked and driven down by bake + the project lexicon, not a hard fail.
    pass: orphans === 0,
  };
}

const USAGE = `typo-lint — Japanese typesetting linter (predicts pptx line breaks via Yu Gothic)
  node bin/lint/typo-lint.js --plan <plan.json> [--theme <theme.json>] [--json]`;

async function main() {
  const a = parseArgs(process.argv);
  if (a.help) { console.log(USAGE); return 0; }
  if (!a.plan) { console.error("Missing --plan.\n\n" + USAGE); return 2; }
  if (!a.theme) a.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  let lexicon = [];
  if (a.lexicon) {
    try { lexicon = JSON.parse(fs.readFileSync(a.lexicon, "utf8")); }
    catch (e) { console.error("lexicon load failed (" + a.lexicon + "): " + e.message); }
  }

  const res = await lintPlan(a.plan, a.theme, lexicon);
  if (a.json) {
    console.log(JSON.stringify(res));
  } else {
    console.log(`typo-lint: ${res.plan}\n`);
    console.log(`fields measured: ${res.measured}  (multi-line: ${res.multiline})`);
    console.log(`泣き別れ / orphans:         ${res.orphans}   (priority 1 — hard gate)`);
    console.log(`熟語分割 / compound splits: ${res.splits}   (priority 2 — bake fixes; residual -> lexicon)`);
    console.log(`avg line-length variance:  ${res.avgLenVar}  |  avg fill: ${res.avgFill}   (priority 3)`);
    if (res.findings.length) {
      console.log(`\nFINDINGS (${res.findings.length}):`);
      for (const f of res.findings) {
        console.log(`  [${f.issue}] slide ${f.slide} ${f.pattern} ${f.path}  lens=[${f.lens}]` +
          (f.splits ? `  splits=${f.splits}` : "") + `  "${f.snippet}"`);
      }
    }
    console.log(`\nSUMMARY: ${res.orphans} orphan(s), ${res.splits} split(s) — ${res.pass ? "PASS" : "FAIL"} (gate = orphans)`);
  }
  return res.pass ? 0 : 1;
}

main()
  .then((code) => closeBrowser().then(() => process.exit(code)))
  .catch((e) => {
    console.error("typo-lint failed: " + (e && e.message ? e.message : e));
    closeBrowser().finally(() => process.exit(2));
  });

module.exports = { lintPlan };
