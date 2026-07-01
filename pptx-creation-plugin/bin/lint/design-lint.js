#!/usr/bin/env node
/* ============================================================
 *  pptx-creation — eyes-free static design gate (spec 6-1)
 *
 *  A CI-friendly linter that catches the deck breaks you can find
 *  WITHOUT rendering: leftover placeholders, over-capacity slides,
 *  low theme contrast, too-tight margins, and AI-tell characters.
 *  It is the cheap first pass BEFORE the mandatory visual QA loop
 *  (house-quality-bar.md §5) — not a replacement for it.
 *
 *  Usage:
 *    node bin/lint/design-lint.js --plan <plan.json> [--theme <theme.json>] [--json]
 *
 *  Defaults: --theme -> themes/_default-neutral/theme.json (mirrors generate.js).
 *
 *  Exit codes (so it works as a CI gate):
 *    0  no ERROR findings (WARN/INFO allowed)
 *    1  at least one ERROR finding
 *    2  bad input / could not run (clean message, never a raw stack)
 * ============================================================ */
"use strict";

const path = require("path");
// Reuse the engine's loaders so we parse plan/theme exactly once, the same way.
const { loadPlan, loadTheme } = require("../generate.js");

/* ---------------- CLI ---------------- */
function parseArgs(argv) {
  const a = { plan: null, theme: null, json: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--plan") a.plan = argv[++i];
    else if (k === "--theme") a.theme = argv[++i];
    else if (k === "--json") a.json = true;
    else if (k === "-h" || k === "--help") a.help = true;
    else throw new Error(`Unknown argument: ${k}`);
  }
  return a;
}

const USAGE = `pptx-creation design lint (eyes-free static gate)
  node bin/lint/design-lint.js --plan <plan.json> [--theme <theme.json>] [--json]

  --plan   deck plan JSON (same shape generate.js accepts)
  --theme  theme JSON (default: themes/_default-neutral/theme.json)
  --json   emit a single JSON object instead of the console report`;

/* ---------------- findings ---------------- */
// A finding = { level: ERROR|WARN|INFO, slide: <1-based|null>, check, message }.
// slide === null means the finding is deck-/theme-level (e.g. contrast, margin).
function makeFindings() {
  const list = [];
  const add = (level, slide, check, message) => list.push({ level, slide, check, message });
  return {
    list,
    error: (slide, check, msg) => add("ERROR", slide, check, msg),
    warn: (slide, check, msg) => add("WARN", slide, check, msg),
    info: (slide, check, msg) => add("INFO", slide, check, msg),
  };
}

/* ---------------- WCAG relative-luminance contrast ---------------- */
// 6-digit hex (no leading '#') -> sRGB channel [0,1].
function hexChannels(hex) {
  const h = String(hex).trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// sRGB gamma expansion -> linear light value for one channel.
function linearize(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// WCAG 2.x relative luminance L = 0.2126R + 0.7152G + 0.0722B (linearized).
function relLuminance(hex) {
  const ch = hexChannels(hex);
  if (!ch) return null;
  const [r, g, b] = ch.map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contrast ratio (Llight + 0.05) / (Ldark + 0.05); returns null if a hex is bad.
function contrastRatio(hexA, hexB) {
  const la = relLuminance(hexA);
  const lb = relLuminance(hexB);
  if (la == null || lb == null) return null;
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/* ---------------- deep string walk ---------------- */
// Yield every string value anywhere in a JSON-ish structure.
function walkStrings(node, visit) {
  if (typeof node === "string") { visit(node); return; }
  if (Array.isArray(node)) { for (const v of node) walkStrings(v, visit); return; }
  if (node && typeof node === "object") {
    for (const v of Object.values(node)) walkStrings(v, visit);
  }
}

// The `notes` field is speaker notes — never rendered on the slide — so
// content checks (placeholders, AI-tells) that only matter for what the
// AUDIENCE SEES must skip it. A → or ・ or even a TODO in the notes is invisible.
function visibleContent(slide) {
  const rest = Object.assign({}, slide && slide.content);
  delete rest.notes;
  return rest;
}

/* ---------------- CHECK: PLACEHOLDER ---------------- */
// Flag leftover scaffolding text anywhere in a slide's content (case-insensitive).
const PLACEHOLDER_RE = /lorem|ipsum|todo|\[insert /i;

function checkPlaceholders(slides, F) {
  slides.forEach((sl, i) => {
    const idx = i + 1;
    const seen = new Set();
    walkStrings(visibleContent(sl), (str) => {
      const m = str.match(PLACEHOLDER_RE);
      if (m && !seen.has(m[0].toLowerCase())) {
        seen.add(m[0].toLowerCase());
        F.error(idx, "PLACEHOLDER", `leftover placeholder text "${m[0]}" found`);
      }
    });
  });
}

/* ---------------- CHECK: AI-TELL char scan ---------------- */
// Characters that instantly read "auto-generated" (house-quality-bar.md §2):
//   - middle-dot / bullet glyphs typed into text (use native bullets)
//   - box-drawing + underline/overline rule characters (no decorative rules)
//   - emoji (no emoji-as-iconography in a business deck)
// Typed LIST bullets only. Deliberately EXCLUDES the Japanese nakaguro
// ・(U+30FB) / ･(U+FF65) — that is normal punctuation ("保守・サービス",
// "税務署・銀行・株主"), NOT an AI-tell; flagging it broke every JP deck.
const BULLET_RE = /[•‣⁃∙●◦▪▫]/; // • ‣ ⁃ ∙ ● ◦ ▪ ▫
// Box-drawing / block / underline-overline chars used as decorative rules.
// EXCLUDES en/em/bar dashes (– — ―) — those are punctuation ("FY2024–FY2026").
const RULE_CHAR_RE = /[─-▟‾＿̲̅]/;
// Real emoji only: astral pictographs + regional indicators + the VS16
// emoji-presentation selector. EXCLUDES the Arrows block (→ U+2192,
// "受注増 → 増収") and BMP symbols/dingbats that read as punctuation.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]|️/u;

function checkAiTells(slides, F) {
  slides.forEach((sl, i) => {
    const idx = i + 1;
    const seen = new Set();
    walkStrings(visibleContent(sl), (str) => {
      if (BULLET_RE.test(str) && !seen.has("dot")) {
        seen.add("dot");
        F.warn(idx, "AI-TELL", "literal bullet/middle-dot character in text — use native bullets, not typed •");
      }
      if (RULE_CHAR_RE.test(str) && !seen.has("rule")) {
        seen.add("rule");
        F.warn(idx, "AI-TELL", "box-drawing / underline rule character in text — no decorative rules (§2)");
      }
      if (EMOJI_RE.test(str) && !seen.has("emoji")) {
        seen.add("emoji");
        F.warn(idx, "AI-TELL", "emoji character in text — no emoji-as-iconography in a business deck (§2)");
      }
    });
  });
}

/* ---------------- CHECK: CAPACITY (per pattern) ---------------- */
// Capacities are the catalog.md `capacity:` lines, made machine-checkable.
function checkCapacity(slides, F) {
  slides.forEach((sl, i) => {
    const idx = i + 1;
    const c = sl.content || {};
    const len = (v) => (Array.isArray(v) ? v.length : 0);

    switch (sl.pattern) {
      case "two-column": {
        const n = len(c.items);
        if (n > 4) F.error(idx, "CAPACITY", `two-column has ${n} items (max 4)`);
        else if (n === 4) F.warn(idx, "CAPACITY", "two-column has 4 items (3 is ideal; the 4th lands near the footer)");
        break;
      }
      case "comparison": {
        const l = len(c.left && c.left.points);
        const r = len(c.right && c.right.points);
        for (const [side, n] of [["left", l], ["right", r]]) {
          if (n > 5) F.error(idx, "CAPACITY", `comparison ${side}.points has ${n} (max 5)`);
          else if (n === 5) F.warn(idx, "CAPACITY", `comparison ${side}.points has 5 (4 is ideal)`);
        }
        break;
      }
      case "chart": {
        const n = len(c.series && c.series.values);
        if (n > 8) F.warn(idx, "CAPACITY", `chart has ${n} bars (>8 crowds; 4-7 read cleanly)`);
        else if (n < 4) F.info(idx, "CAPACITY", `chart has ${n} bars (<4 is sparse, still fine)`);
        break;
      }
      case "stat-grid": {
        const n = len(c.stats);
        if (n > 4 || n < 2) F.error(idx, "CAPACITY", `stat-grid has ${n} stats (must be 2-4)`);
        break;
      }
      case "table": {
        const bodyRows = len(c.rows);
        if (bodyRows > 5) F.error(idx, "CAPACITY", `table has ${bodyRows} body rows (max 5 => <=6 incl. header)`);
        const cols = len(c.columns);
        if (cols > 6) F.error(idx, "CAPACITY", `table has ${cols} columns (>6 is too many)`);
        else if (cols > 5) F.warn(idx, "CAPACITY", `table has ${cols} columns (<=5 read cleanly)`);
        break;
      }
      case "cover":
      case "cta": {
        const n = len(c.titleLines);
        if (n > 2) F.error(idx, "CAPACITY", `${sl.pattern} titleLines has ${n} (max 2 lines)`);
        break;
      }
      case "message": {
        const n = len(c.messageLines);
        if (n > 2) F.error(idx, "CAPACITY", `message messageLines has ${n} (max 2 lines)`);
        break;
      }
      case "section": {
        // title may be a string (1 line) or an array; only flag array > 1.
        if (Array.isArray(c.title) && c.title.length > 1) {
          F.warn(idx, "CAPACITY", `section title has ${c.title.length} lines (<=1 line at width 8.0)`);
        }
        break;
      }
      default:
        // Unknown/other patterns: nothing capacity-specific to check here.
        break;
    }
  });
}

/* ---------------- CHECK: CONTRAST (theme token pairs) ---------------- */
// Pairs are [fg, bg] short-key token names. Primary = must be readable body/UI
// text (>=4.5 or ERROR). Secondary = intentionally muted text (WARN <4.5,
// ERROR <3.0 — even muted text must clear the large-text floor).
const PRIMARY_PAIRS = [
  ["ink", "bg"], ["onDark", "dark"], ["accentDp", "surfaceA"],
  ["onDark", "accent"], ["ink", "surface"], ["ink", "surfaceA"],
];
const SECONDARY_PAIRS = [
  ["muted", "bg"], ["onDarkMut", "dark"], ["onAccentMut", "accent"],
];
// `faint` is INCIDENTAL text (footer / page number / table note) — supplemental
// by design, so it gets a relaxed floor (WCAG exempts incidental text). The
// shipped neutral theme's faint (8A98A6 = 2.95:1) is human-reviewed readable, so
// only genuinely-invisible faint (<2.0) is an ERROR; 2.0-3.0 is an advisory WARN.
const INCIDENTAL_PAIRS = [
  ["faint", "bg"],
];

function fmt2(n) { return n.toFixed(2); }

function checkContrast(T, F) {
  const c = T.c || {};
  const rate = (fg, bg) => contrastRatio(c[fg], c[bg]);

  for (const [fg, bg] of PRIMARY_PAIRS) {
    const r = rate(fg, bg);
    if (r == null) {
      F.error(null, "CONTRAST", `${fg}/${bg}: missing or invalid hex — cannot compute ratio`);
      continue;
    }
    if (r < 4.5) F.error(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} < 4.5 (fails body-text contrast)`);
    else F.info(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} >= 4.5 (ok)`);
  }

  for (const [fg, bg] of SECONDARY_PAIRS) {
    const r = rate(fg, bg);
    if (r == null) {
      F.error(null, "CONTRAST", `${fg}/${bg}: missing or invalid hex — cannot compute ratio`);
      continue;
    }
    if (r < 3.0) F.error(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} < 3.0 (muted text too faint)`);
    else if (r < 4.5) F.warn(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} < 4.5 (muted text; borderline)`);
    else F.info(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} >= 4.5 (ok)`);
  }

  for (const [fg, bg] of INCIDENTAL_PAIRS) {
    const r = rate(fg, bg);
    if (r == null) {
      F.error(null, "CONTRAST", `${fg}/${bg}: missing or invalid hex — cannot compute ratio`);
      continue;
    }
    if (r < 2.0) F.error(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} < 2.0 (incidental text effectively invisible)`);
    else if (r < 3.0) F.warn(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} < 3.0 (incidental text below WCAG large-text floor — consider darkening)`);
    else F.info(null, "CONTRAST", `${fg}/${bg} ratio ${fmt2(r)} >= 3.0 (ok for incidental)`);
  }
}

/* ---------------- CHECK: MARGIN ---------------- */
// House bar §1.7: an outer margin < 0.5" reads "too tight"; < 0.3" is a break.
function checkMargin(T, F) {
  const m = T.m;
  if (typeof m !== "number" || Number.isNaN(m)) {
    F.error(null, "MARGIN", "theme canvas.margin is missing or not a number");
    return;
  }
  if (m < 0.3) F.error(null, "MARGIN", `canvas.margin ${m}in < 0.3in (far too tight)`);
  else if (m < 0.5) F.warn(null, "MARGIN", `canvas.margin ${m}in < 0.5in (reads too tight; house bar §1.7)`);
}

/* ---------------- report ---------------- */
function counts(list) {
  return {
    errors: list.filter((f) => f.level === "ERROR").length,
    warnings: list.filter((f) => f.level === "WARN").length,
    info: list.filter((f) => f.level === "INFO").length,
  };
}

function lineFor(f) {
  const where = f.slide == null ? "deck" : `slide ${f.slide}`;
  return `  [${where}] ${f.check}: ${f.message}`;
}

function printReport(planPath, list) {
  const cnt = counts(list);
  const byLevel = (lvl) => list.filter((f) => f.level === lvl);

  console.log(`design-lint: ${planPath}\n`);

  const errs = byLevel("ERROR");
  console.log(`ERRORS (${errs.length})`);
  if (errs.length) errs.forEach((f) => console.log(lineFor(f)));
  else console.log("  none");

  const warns = byLevel("WARN");
  console.log(`\nWARNINGS (${warns.length})`);
  if (warns.length) warns.forEach((f) => console.log(lineFor(f)));
  else console.log("  none");

  const infos = byLevel("INFO");
  console.log(`\nINFO (${infos.length})`);
  if (infos.length) infos.forEach((f) => console.log(lineFor(f)));
  else console.log("  none");

  const pass = cnt.errors === 0;
  console.log(
    `\nSUMMARY: ${cnt.errors} error(s), ${cnt.warnings} warning(s), ` +
    `${cnt.info} info — ${pass ? "PASS" : "FAIL"}`
  );
}

/* ---------------- run ---------------- */
function run(args) {
  // loadTheme / loadPlan throw clean Error messages on bad paths/JSON; main()
  // catches them and prints a one-liner (never a raw stack).
  const T = loadTheme(args.theme);
  const { slides } = loadPlan(args.plan);

  const F = makeFindings();
  checkPlaceholders(slides, F);
  checkCapacity(slides, F);
  checkContrast(T, F);
  checkMargin(T, F);
  checkAiTells(slides, F);

  const cnt = counts(F.list);
  const pass = cnt.errors === 0;

  if (args.json) {
    const out = { plan: args.plan, pass, counts: cnt, findings: F.list };
    console.log(JSON.stringify(out));
  } else {
    printReport(args.plan, F.list);
  }
  return pass ? 0 : 1;
}

/* ---------------- main ---------------- */
function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    console.error(e.message + "\n\n" + USAGE);
    process.exit(2);
  }
  if (args.help) { console.log(USAGE); return; }
  if (!args.plan) {
    console.error("Missing required --plan.\n\n" + USAGE);
    process.exit(2);
  }
  if (!args.theme) {
    args.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  }
  let code;
  try {
    code = run(args);
  } catch (e) {
    // Clean message, no stack trace, distinct exit code so CI can tell a
    // linter FAIL (exit 1) apart from a broken invocation (exit 2).
    console.error("design-lint failed: " + (e && e.message ? e.message : e));
    process.exit(2);
  }
  process.exit(code);
}

if (require.main === module) main();

module.exports = {
  contrastRatio, relLuminance, walkStrings,
  checkPlaceholders, checkCapacity, checkContrast, checkMargin, checkAiTells,
  run,
};
