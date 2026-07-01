#!/usr/bin/env node
/* ============================================================
 *  bin/layout-html/bake.js — bake balanced kinsoku breaks into a deck plan
 *
 *  For every wrapping PROSE string field (geometry.js), compute a balanced,
 *  orphan-free line break in headless Chromium (Yu Gothic + line-break:strict +
 *  text-wrap:balance, measured at the box's EFFECTIVE width) and replace the
 *  string with that explicit line array. The engine's richText() then renders
 *  those exact breaks natively (M-9: browser computed, pptx stays native).
 *
 *  Fields that fit on one line are left as plain strings. Already-baked (array)
 *  fields are left untouched. Meta / non-prose fields are preserved verbatim.
 *
 *  Usage: node bin/layout-html/bake.js --plan <in.json> [--theme <t.json>] --out <baked.json>
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { loadTheme } = require("../generate.js");
const { measure, closeBrowser } = require("./measure.js");
const { wrappingFields, effectiveWidth } = require("./geometry.js");

// Set a value at a path like "statCaption" | "items[1].body" | "left.points[0]" | "stats[2].sub".
function setByPath(obj, p, value) {
  const parts = p.replace(/\[(\d+)\]/g, ".$1").split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}

async function bakePlan(planPath, themePath) {
  const T = loadTheme(themePath);
  const raw = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const slides = Array.isArray(raw) ? raw : raw.slides;
  let baked = 0, considered = 0;
  const changes = [];
  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i];
    for (const f of wrappingFields(sl, T)) {
      if (f.baked) continue; // already an explicit line array
      considered++;
      const ew = effectiveWidth(f.widthIn, { bullet: f.bullet });
      const r = await measure({ text: f.text, widthIn: ew, sizePt: f.sizePt, role: f.role, leading: f.leading, wrap: "balance" });
      if (r.count > 1) {
        setByPath(sl.content, f.path, r.lines);
        baked++;
        changes.push({ slide: i + 1, pattern: sl.pattern, path: f.path, lines: r.lineLens });
      }
    }
  }
  return { out: raw, baked, considered, changes };
}

const USAGE = `bake — compute & bake balanced kinsoku line breaks into a deck plan
  node bin/layout-html/bake.js --plan <in.json> [--theme <theme.json>] --out <baked.json>`;

async function main() {
  const a = { plan: null, theme: null, out: null };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--plan") a.plan = process.argv[++i];
    else if (k === "--theme") a.theme = process.argv[++i];
    else if (k === "--out") a.out = process.argv[++i];
    else if (k === "-h" || k === "--help") { console.log(USAGE); return 0; }
  }
  if (!a.plan || !a.out) { console.error("Missing --plan and/or --out.\n\n" + USAGE); return 2; }
  if (!a.theme) a.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");

  const { out, baked, considered, changes } = await bakePlan(a.plan, a.theme);
  fs.writeFileSync(a.out, JSON.stringify(out, null, 2) + "\n");
  console.log(`baked ${baked}/${considered} wrapping field(s) -> ${a.out}`);
  for (const c of changes) console.log(`  slide ${c.slide} ${c.pattern} ${c.path}: lines [${c.lines}]`);
  return 0;
}

main()
  .then((code) => closeBrowser().then(() => process.exit(code)))
  .catch((e) => { console.error("bake failed: " + (e && e.message ? e.message : e)); closeBrowser().finally(() => process.exit(1)); });

module.exports = { bakePlan, setByPath };
