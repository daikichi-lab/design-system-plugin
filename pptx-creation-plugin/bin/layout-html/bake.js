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
const { measure, closeBrowser, breakPoints } = require("./measure.js");
const { wrappingFields, effectiveWidth, heightBoxes } = require("./geometry.js");

// Count line breaks that fall inside a budoux word/phrase (熟語分割).
function countSplits(lineLens, text, lexicon) {
  if (!lineLens || lineLens.length < 2) return 0;
  const allowed = breakPoints(text, lexicon);
  let acc = 0, n = 0;
  for (let k = 0; k < lineLens.length - 1; k++) { acc += lineLens[k]; if (!allowed.has(acc)) n++; }
  return n;
}

// Set a value at a path like "statCaption" | "items[1].body" | "left.points[0]" | "stats[2].sub".
function setByPath(obj, p, value) {
  const parts = p.replace(/\[(\d+)\]/g, ".$1").split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}

async function bakePlan(planPath, themePath, lexicon = []) {
  const T = loadTheme(themePath);
  const raw = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const slides = Array.isArray(raw) ? raw : raw.slides;
  let baked = 0, considered = 0;
  const changes = [];
  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i];
    // Fields that live in a bounded card (heightBoxes): bake these to explicit
    // line arrays whenever they wrap to >1 line — even if they neither orphan
    // nor split — so the card-overflow gate (design-lint) can read their line
    // count statically from the baked plan. Baking a clean field is harmless:
    // text-wrap:balance keeps the same line count, just better balanced.
    const cardFieldPaths = new Set(heightBoxes(sl, T).map((b) => b.path));
    for (const f of wrappingFields(sl, T)) {
      if (f.baked) continue; // already an explicit line array
      considered++;
      const ew = effectiveWidth(f.widthIn, { bullet: f.bullet });
      const M = (wrap, budoux) => measure({ text: f.text, widthIn: ew, sizePt: f.sizePt, role: f.role, leading: f.leading, wrap, budoux, lexicon });

      // Minimal intervention: re-break a field whose natural (greedy) wrap would
      // ORPHAN (泣き別れ) OR split a compound (熟語分割) — OR that sits in a card
      // and wraps to >1 line (so its height is checkable downstream). A plain
      // open-box field that does none of these is left as a string.
      const auto = await M("auto", false);
      const orphan = auto.hasOrphan;
      const rawSplits = countSplits(auto.lineLens, f.text, lexicon);
      const cardMultiline = cardFieldPaths.has(f.path) && auto.count > 1;
      if (!orphan && !rawSplits && !cardMultiline) continue;

      let lines, mode;
      if (!orphan && !rawSplits) {
        // Pure height-visibility bake (a card/title that wraps cleanly): keep the
        // NATURAL wrap verbatim — we only make the breaks explicit so the height
        // gate can count lines. No restyle (minimal intervention; render-identical).
        lines = auto.lines; mode = "card-fit(natural, no restyle)";
      } else {
        // Defect present. Priority (1) no orphan > (2) no compound split > (3)
        // balance. budoux-balance satisfies 2 & 3; if it re-introduces an orphan,
        // drop the no-split constraint to honor priority 1 (and log the sacrifice).
        const budBal = await M("balance", true);
        if (budBal.count > 1 && !budBal.hasOrphan) { lines = budBal.lines; mode = "budoux-balance"; }
        else {
          const bal = await M("balance", false);
          if (bal.count > 1 && !bal.hasOrphan) { lines = bal.lines; mode = "balance(split allowed to avoid orphan)"; }
          else { lines = auto.lines; mode = "auto(could not clear orphan)"; }
        }
      }
      const outSplits = countSplits(lines.map((l) => [...l].length), lines.join(""), lexicon);
      setByPath(sl.content, f.path, lines);
      baked++;
      changes.push({
        slide: i + 1, pattern: sl.pattern, path: f.path,
        trigger: orphan ? "orphan" : rawSplits ? "split" : "card-fit", mode,
        from: auto.lineLens, to: lines.map((l) => [...l].length), splitsFrom: rawSplits, splitsTo: outSplits,
      });
    }
  }
  return { out: raw, baked, considered, changes };
}

const USAGE = `bake — compute & bake balanced, orphan-free, compound-safe line breaks into a deck plan
  node bin/layout-html/bake.js --plan <in.json> [--theme <theme.json>] [--lexicon <words.json>] --out <baked.json>
  --lexicon  JSON array of project-protected words (brand/terms) never split (assets/lexicon.json)`;

async function main() {
  const a = { plan: null, theme: null, out: null, lexicon: null };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--plan") a.plan = process.argv[++i];
    else if (k === "--theme") a.theme = process.argv[++i];
    else if (k === "--out") a.out = process.argv[++i];
    else if (k === "--lexicon") a.lexicon = process.argv[++i];
    else if (k === "-h" || k === "--help") { console.log(USAGE); return 0; }
  }
  if (!a.plan || !a.out) { console.error("Missing --plan and/or --out.\n\n" + USAGE); return 2; }
  if (!a.theme) a.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  let lexicon = [];
  if (a.lexicon) {
    try { lexicon = JSON.parse(fs.readFileSync(a.lexicon, "utf8")); }
    catch (e) { console.error("lexicon load failed (" + a.lexicon + "): " + e.message); }
  }

  const { out, baked, considered, changes } = await bakePlan(a.plan, a.theme, lexicon);
  fs.writeFileSync(a.out, JSON.stringify(out, null, 2) + "\n");
  console.log(`baked ${baked}/${considered} wrapping field(s) -> ${a.out}`);
  for (const c of changes) console.log(`  slide ${c.slide} ${c.pattern} ${c.path} (${c.trigger}, ${c.mode}): [${c.from}]->[${c.to}]  splits ${c.splitsFrom}->${c.splitsTo}`);
  return 0;
}

main()
  .then((code) => closeBrowser().then(() => process.exit(code)))
  .catch((e) => { console.error("bake failed: " + (e && e.message ? e.message : e)); closeBrowser().finally(() => process.exit(1)); });

module.exports = { bakePlan, setByPath };
