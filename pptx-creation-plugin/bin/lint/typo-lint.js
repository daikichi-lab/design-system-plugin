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

const path = require("path");
const { loadPlan, loadTheme } = require("../generate.js");
const { measure, closeBrowser } = require("../layout-html/measure.js");
const { wrappingFields, effectiveWidth } = require("../layout-html/geometry.js");

function parseArgs(argv) {
  const a = { plan: null, theme: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--plan") a.plan = argv[++i];
    else if (k === "--theme") a.theme = argv[++i];
    else if (k === "--json") a.json = true;
    else if (k === "-h" || k === "--help") a.help = true;
  }
  return a;
}

async function lintPlan(planPath, themePath) {
  const T = loadTheme(themePath);
  const { slides } = loadPlan(planPath);
  const findings = [];
  let measured = 0, multiline = 0, orphans = 0;
  let varSum = 0, fillSum = 0;

  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i];
    for (const f of wrappingFields(sl, T)) {
      const ew = effectiveWidth(f.widthIn, { bullet: f.bullet });
      measured++;
      if (f.baked) {
        // validate baked explicit lines: no orphan, and no line silently re-wraps.
        const lens = f.lines.map((l) => [...l].length);
        const lastLen = lens[lens.length - 1] || 0;
        if (f.lines.length > 1) multiline++;
        const lineOrphan = f.lines.length > 1 && lastLen <= 3;
        let overflow = null;
        for (const ln of f.lines) {
          const rr = await measure({ text: ln, widthIn: ew, sizePt: f.sizePt, role: f.role, leading: f.leading, wrap: "auto" });
          if (rr.count > 1) { overflow = ln; break; }
        }
        if (lineOrphan || overflow) {
          orphans++;
          findings.push({
            slide: i + 1, pattern: sl.pattern, path: f.path, lines: f.lines.length, lens, lastLen,
            snippet: (overflow || f.lines[f.lines.length - 1]).slice(0, 22) + (overflow ? " (baked line overflows)" : ""),
          });
        }
        continue;
      }
      const r = await measure({ text: f.text, widthIn: ew, sizePt: f.sizePt, role: f.role, leading: f.leading, wrap: "auto" });
      if (r.count > 1) {
        multiline++;
        varSum += r.lenVar;
        fillSum += r.fill;
      }
      if (r.hasOrphan) {
        orphans++;
        findings.push({
          slide: i + 1, pattern: sl.pattern, path: f.path,
          lines: r.count, lens: r.lineLens, lastLen: r.lastLen,
          snippet: f.text.slice(0, 22) + (f.text.length > 22 ? "…" : ""),
        });
      }
    }
  }
  return {
    plan: planPath,
    measured, multiline, orphans,
    avgLenVar: multiline ? +(varSum / multiline).toFixed(2) : 0,
    avgFill: multiline ? +(fillSum / multiline).toFixed(3) : 0,
    findings,
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

  const res = await lintPlan(a.plan, a.theme);
  if (a.json) {
    console.log(JSON.stringify(res));
  } else {
    console.log(`typo-lint: ${res.plan}\n`);
    console.log(`fields measured: ${res.measured}  (multi-line: ${res.multiline})`);
    console.log(`泣き別れ / orphans: ${res.orphans}`);
    console.log(`avg line-length variance: ${res.avgLenVar}  |  avg fill ratio: ${res.avgFill}`);
    if (res.findings.length) {
      console.log(`\nORPHANS (${res.findings.length}):`);
      for (const f of res.findings) {
        console.log(`  [slide ${f.slide} ${f.pattern} ${f.path}] lens=[${f.lens}] lastLen=${f.lastLen}  "${f.snippet}"`);
      }
    }
    console.log(`\nSUMMARY: ${res.orphans} orphan(s) — ${res.pass ? "PASS" : "FAIL"}`);
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
