#!/usr/bin/env node
/* ============================================================
 *  pptx-creation — eyes-free static design gate (spec 6-1)
 *
 *  A CI-friendly linter that catches the deck breaks you can find
 *  WITHOUT rendering: leftover placeholders, over-capacity slides,
 *  card overflow (a baked card field taller than its card), low theme
 *  contrast, too-tight margins, and AI-tell characters. It is the cheap
 *  first pass BEFORE the mandatory visual QA loop (house-quality-bar.md
 *  §5) — not a replacement for it. The card-overflow check reads baked
 *  line arrays (no browser); on a raw plan it under-reports rather than
 *  false-positives (the full build.sh pipeline bakes first).
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
// Card geometry for the height-overflow check (shared with bake / typo-lint).
const { heightBoxes, boxVerdict } = require("../layout-html/geometry.js");
// Diagram element-count caps (single source of truth in diagrams.js) + the
// stat-grid AREA-emphasis geometry for the protagonist-value width gate.
const { CAPS, resolveStatGrid, splitValueUnit, estTextWidthIn, fitLabelPt, VALUE_JUMP, VALUE_JUMP_PEAK, UNIT_RATIO } = require("../graphics/diagrams.js");

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
      case "dialogue": {
        if (Array.isArray(c.columns)) {
          if (c.columns.length !== 2) F.error(idx, "CAPACITY", `dialogue compare form needs exactly 2 columns (got ${c.columns.length})`);
          c.columns.forEach((col, ci) => {
            const n = len(col && col.speakers);
            if (n < 1 || n > 2) F.error(idx, "CAPACITY", `dialogue columns[${ci}] has ${n} speakers (1-2 per column)`);
          });
        } else {
          const n = len(c.speakers);
          if (n < CAPS.dialogue[0] || n > CAPS.dialogue[1]) F.error(idx, "CAPACITY", `dialogue has ${n} speakers (must be ${CAPS.dialogue[0]}-${CAPS.dialogue[1]})`);
        }
        break;
      }
      case "testimonial": {
        const n = len(c.items);
        const max = c.layout === "stack" ? 3 : CAPS.testimonial[1];
        if (n < CAPS.testimonial[0] || n > max) F.error(idx, "CAPACITY", `testimonial (${c.layout || "grid"}) has ${n} items (must be ${CAPS.testimonial[0]}-${max})`);
        break;
      }
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
        const ct = c.chartType || "column";
        if (ct === "band") {
          // 帯グラフ: series must be an ARRAY of 2-4 segments over 1-5 rows
          const segs = Array.isArray(c.series) ? c.series.length : 0;
          const rows = Array.isArray(c.series) && c.series[0] ? len(c.series[0].labels) : 0;
          if (!Array.isArray(c.series)) F.error(idx, "CAPACITY", "band needs series as an ARRAY of segments [{name, labels, values}, ...]");
          else if (segs > 4 || segs < 2) F.error(idx, "CAPACITY", `band has ${segs} segments (must be 2-4; more stops being comparable)`);
          if (rows > 5) F.error(idx, "CAPACITY", `band has ${rows} rows (max 5; split periods or use a table)`);
          break;
        }
        if (Array.isArray(c.series)) { F.error(idx, "CAPACITY", `${ct} chart takes a single series object (array is band-only)`); break; }
        const n = len(c.series && c.series.values);
        if (ct === "pie" || ct === "doughnut") {
          // parts-of-a-whole stops being readable past 5 slices (chart-design §2)
          if (n > 5) F.error(idx, "CAPACITY", `${ct} has ${n} slices (max 5; beyond that use a ranked bar chart)`);
          else if (n < 2) F.error(idx, "CAPACITY", `${ct} has ${n} slice (a single slice is not a split — use message)`);
        } else if (ct === "line") {
          if (n < 4) F.info(idx, "CAPACITY", `line has ${n} points (<4 — a trend needs points; consider columns)`);
        } else {
          if (n > 8) F.warn(idx, "CAPACITY", `chart has ${n} bars (>8 crowds; 4-7 read cleanly)`);
          else if (n < 4) F.info(idx, "CAPACITY", `chart has ${n} bars (<4 is sparse, still fine)`);
        }
        break;
      }
      case "stat-grid": {
        const n = len(c.stats);
        if (n > 4 || n < 2) F.error(idx, "CAPACITY", `stat-grid has ${n} stats (must be 2-4)`);
        break;
      }
      case "card-grid": {
        const n = len(c.cards);
        if (n > 6) F.error(idx, "CAPACITY", `card-grid has ${n} cards (max 6; split into two slides)`);
        else if (n < 4) F.error(idx, "CAPACITY", `card-grid has ${n} cards (min 4; fewer cards read better as two-column / stat-grid)`);
        break;
      }
      case "flow": {
        const n = len(c.steps);
        const [min, max] = CAPS.flow;
        if (n > max) F.error(idx, "CAPACITY", `flow has ${n} steps (max ${max}; split into two, or use a list)`);
        else if (n < min) F.error(idx, "CAPACITY", `flow has ${n} steps (min ${min}; too few to diagram — use text / two-column)`);
        break;
      }
      case "cycle": {
        const n = len(c.steps);
        const [min, max] = CAPS.cycle;
        if (n > max) F.error(idx, "CAPACITY", `cycle has ${n} nodes (max ${max}; split or use a list)`);
        else if (n < min) F.error(idx, "CAPACITY", `cycle has ${n} nodes (min ${min}; too few to loop — use text / flow)`);
        break;
      }
      case "matrix": {
        const n = len(c.quadrants);
        if (n !== 4) F.error(idx, "CAPACITY", `matrix has ${n} quadrants (must be exactly 4 — it is a fixed 2x2)`);
        break;
      }
      case "timeline": {
        const n = len(c.milestones);
        const [min, max] = CAPS.timeline;
        if (n > max) F.error(idx, "CAPACITY", `timeline has ${n} milestones (max ${max}; split eras into two slides, or use a table)`);
        else if (n < min) F.error(idx, "CAPACITY", `timeline has ${n} milestones (min ${min}; too few to diagram — use text / message)`);
        break;
      }
      case "steps": {
        const n = len(c.steps);
        const [min, max] = CAPS.steps;
        if (n > max) F.error(idx, "CAPACITY", `steps has ${n} stages (max ${max}; split, or use flow / a list)`);
        else if (n < min) F.error(idx, "CAPACITY", `steps has ${n} stages (min ${min}; too few to diagram — use text / comparison)`);
        break;
      }
      case "branch": {
        const n = len(c.branches);
        const [min, max] = CAPS.branch;
        if (n > max) F.error(idx, "CAPACITY", `branch has ${n} branches (max ${max}; group them, or use two-column)`);
        else if (n < min) F.error(idx, "CAPACITY", `branch has ${n} branches (min ${min}; 1-to-1 is a flow, not a branch)`);
        break;
      }
      case "formula": {
        const n = len(c.operands);
        const [min, max] = CAPS.formula;
        if (n > max) F.error(idx, "CAPACITY", `formula has ${n} operands (max ${max}; group factors, or use a table)`);
        else if (n < min) F.error(idx, "CAPACITY", `formula has ${n} operands (min ${min}; a single operand is not a formula — use message)`);
        break;
      }
      case "positioning": {
        const n = len(c.positions);
        const [min, max] = CAPS.positioning;
        if (n > max) F.error(idx, "CAPACITY", `positioning has ${n} positions (max ${max}; more is a table, not a VS)`);
        else if (n < min) F.error(idx, "CAPACITY", `positioning has ${n} position (min ${min}; one position is a message, not a positioning)`);
        break;
      }
      case "system": {
        const n = len(c.nodes);
        const [min, max] = CAPS.system;
        if (n > max) F.error(idx, "CAPACITY", `system has ${n} nodes (max ${max}; group actors or split the map)`);
        else if (n < min) F.error(idx, "CAPACITY", `system has ${n} node (min ${min})`);
        const links = Array.isArray(c.links) ? c.links : [];
        if (links.length > 6) F.error(idx, "CAPACITY", `system has ${links.length} links (max 6; a hairball teaches nothing)`);
        links.forEach((lk, k) => {
          if (!lk || !Number.isInteger(lk.from) || !Number.isInteger(lk.to) || lk.from >= n || lk.to >= n || lk.from === lk.to) {
            F.error(idx, "CAPACITY", `system link ${k} is invalid (from/to must be distinct node indices < ${n})`);
          }
        });
        break;
      }
      case "relation": {
        const nL = len(c.left), nR = len(c.right);
        const [min, max] = CAPS.relation;
        for (const [side, n] of [["left", nL], ["right", nR]]) {
          if (n > max) F.error(idx, "CAPACITY", `relation ${side} has ${n} items (max ${max})`);
          else if (n < min) F.error(idx, "CAPACITY", `relation ${side} has ${n} item (min ${min})`);
        }
        (Array.isArray(c.links) ? c.links : []).forEach((pr, k) => {
          if (!Array.isArray(pr) || pr.length !== 2 || pr[0] >= nL || pr[1] >= nR || pr[0] < 0 || pr[1] < 0) {
            F.error(idx, "CAPACITY", `relation link ${k} is invalid ([leftIdx, rightIdx] within range)`);
          }
        });
        break;
      }
      case "before-after": {
        if (!c.before || !c.after) F.error(idx, "CAPACITY", "before-after needs BOTH panels (before + after — the reframe is the pair)");
        break;
      }
      case "waterfall": {
        const n = len(c.items);
        const [min, max] = CAPS.waterfall;
        if (n > max) F.error(idx, "CAPACITY", `waterfall has ${n} items (max ${max}; group small drivers into その他)`);
        else if (n < min) F.error(idx, "CAPACITY", `waterfall has ${n} items (min ${min}; a start and an end with no drivers is a comparison, not a bridge)`);
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

/* ---------------- CHECK: CARD OVERFLOW (height capacity) ---------------- */
// Read a value at a path like "takeaway" | "offerBody" | "stats[2].sub".
function getByPath(obj, p) {
  const parts = p.replace(/\[(\d+)\]/g, ".$1").split(".");
  let o = obj;
  for (const part of parts) {
    if (o == null) return undefined;
    o = o[part];
  }
  return o;
}

// A multi-line PROSE field inside a bounded card can render taller than the
// card and spill its last lines below the card's bottom edge — a real break
// (text outside its container). This is a hard ERROR (exit 1), a different
// tier from typo-lint's advisory compound-split.
//
// STATIC by design (no browser / no new dependency): the line COUNT comes from
// the baked plan's explicit line arrays. bake.js bakes every multi-line card
// field to an array precisely so this count is visible here. A field that is
// still a plain STRING at this point fit on a single line (bake leaves 1-line
// fields as strings), so it counts as 1 line. Run on a RAW (un-baked) plan this
// check therefore under-reports rather than false-positives — the full pipeline
// (build.sh bakes first) is where it has complete coverage. Card geometry and
// the safety margin live in layout-html/geometry.js (one calibration knob).
function checkOverflow(slides, T, F) {
  slides.forEach((sl, i) => {
    const idx = i + 1;
    for (const box of heightBoxes(sl, T)) {
      const val = getByPath(sl.content || {}, box.path);
      let nLines;
      if (Array.isArray(val)) nLines = val.length;
      else if (typeof val === "string" && val.trim()) nLines = 1;
      else continue; // missing / empty — nothing to render
      const v = boxVerdict(box, nLines);
      if (v.over) {
        const pct = Math.round(v.pct * 100);
        F.error(idx, "OVERFLOW",
          `${box.id} (${box.path}): ${nLines} lines = ${pct}% of its box height ` +
          `(over the ${Math.round(v.safety * 100)}% fill limit) — text overflows its box; shorten it or split the slide`);
      }
    }
  });
}

/* ---------------- CHECK: EMPHASIS-COUNT (1スライド1強調・デッキ1山場) ----------------
 * The visual-psychology layer's abuse guard, made mechanical: emphasis only
 * works because it is SCARCE (von Restorff — emphasize everything and nothing
 * is emphasized). One protagonist per slide, one peak per deck; violations are
 * hard errors, not taste. See references/principles/visual-psychology.md. */

// Patterns with an emphasis slot -> how many elements the index can point at.
const EMPHASIS_SLOTS = {
  "stat-grid": (c) => (Array.isArray(c.stats) ? c.stats.length : 0),
  "flow": (c) => (Array.isArray(c.steps) ? c.steps.length : 0),
  "cycle": (c) => (Array.isArray(c.steps) ? c.steps.length : 0),
  "matrix": (c) => (Array.isArray(c.quadrants) ? c.quadrants.length : 0),
  "card-grid": (c) => (Array.isArray(c.cards) ? c.cards.length : 0),
  "two-column": (c) => (Array.isArray(c.items) ? c.items.length : 0),
  "comparison": () => 2,
};

// Marker support matrix (§2): which marker types each pattern can carry.
// badge is the DEFAULT device (shape+label+position — CUD-robust, on-register);
// underline is the stronger intentional-geometry pop; circle (hand-drawn
// wobble) additionally requires the theme's layout.marker.handDrawn opt-in —
// it is OFF-REGISTER for business/financial decks (reviewer verdict) and every
// shipped theme keeps the gate closed.
const MARKER_SUPPORT = {
  "stat-grid": ["circle", "badge", "arrow-note", "underline"],
  "message": ["circle", "badge", "arrow-note", "underline"],
  "chart": ["badge", "arrow-note"],
  "flow": ["badge", "arrow-note"],
  "cycle": ["badge", "arrow-note"],
};

// The card/element texts an arrow-note must NOT duplicate (a note earns its
// place only by ADDING information the card doesn't already show).
function markerContextTexts(sl) {
  const c = sl.content || {};
  const out = [];
  const push = (v) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) out.push(v.join("")); };
  if (sl.pattern === "stat-grid" && Number.isInteger(c.emphasis) && Array.isArray(c.stats) && c.stats[c.emphasis]) {
    const st = c.stats[c.emphasis]; push(String(st.value)); push(st.label); push(st.sub);
  } else if (sl.pattern === "chart") { push(c.takeawayHead); push(c.takeaway); push(c.title); }
  else if (sl.pattern === "message") { push(c.statBig); push(c.statCaption); (c.messageLines || []).forEach(push); }
  else if ((sl.pattern === "flow" || sl.pattern === "cycle") && Number.isInteger(c.emphasis)) push((c.steps || [])[c.emphasis]);
  return out;
}
// 誠実ガード: hype adjectives are banned in marker text — a badge is a FACT
// label (過去最高・初・3期連続), not advertising copy (house-quality-bar §4).
const HYPE_RE = /驚異|圧倒的|衝撃|奇跡|爆速|爆上|神(?:業|級)|規格外|異次元|桁違い/;
const BADGE_MAX = 8, NOTE_MAX = 14;

function checkEmphasis(slides, T, F) {
  let peaks = [];
  slides.forEach((sl, i) => {
    const idx = i + 1;
    const c = sl.content || {};
    const hasNew = Number.isInteger(c.emphasis);
    const hasLegacy = Number.isInteger(c.emphasizeIndex);
    // TWO emphasis specs on one slide = two protagonists = none (乱用の芽).
    if (hasNew && hasLegacy) {
      F.error(idx, "EMPHASIS-COUNT",
        "both `emphasis` and `emphasizeIndex` are set — ONE protagonist per slide; keep `emphasis`, drop the legacy alias");
    }
    if (hasNew) {
      const slots = EMPHASIS_SLOTS[sl.pattern];
      if (!slots) {
        F.warn(idx, "EMPHASIS-COUNT",
          `emphasis has no slot on pattern "${sl.pattern}" (ignored by the engine` +
          (sl.pattern === "chart" ? "; a chart's bar protagonist is emphasizeIndex)" : ")"));
      } else if (c.emphasis < 0 || c.emphasis >= slots(c)) {
        F.error(idx, "EMPHASIS-COUNT",
          `emphasis ${c.emphasis} is out of range (${sl.pattern} has ${slots(c)} elements) — the protagonist doesn't exist`);
      }
    }
    // legacy alias out-of-range is the same plan bug (chart checks its own values)
    if (hasLegacy && EMPHASIS_SLOTS[sl.pattern] && (c.emphasizeIndex < 0 || c.emphasizeIndex >= EMPHASIS_SLOTS[sl.pattern](c))) {
      F.error(idx, "EMPHASIS-COUNT",
        `emphasizeIndex ${c.emphasizeIndex} is out of range (${sl.pattern} has ${EMPHASIS_SLOTS[sl.pattern](c)} elements)`);
    }
    // stat-grid AREA emphasis + the ATOM rule: number+unit never break; the
    // cards adapt (resolveStatGrid width branch). The gate fires only when
    // even the width branch cannot host every atom at its readable floor
    // (bystander 0.7x / protagonist 1.6x) — the CONTENT must change then.
    if (hasNew && sl.pattern === "stat-grid" && Array.isArray(c.stats)) {
      const grid = resolveStatGrid(T, c.stats, c.emphasis);
      if (grid.floorViolated) {
        F.error(idx, "EMPHASIS-COUNT",
          `the value atoms cannot all fit at their readable floors even after the card-width branch (${grid.notes[0] || ""}) ` +
          "— shorten the values (fewer digits / move detail to the sub); the atom is never broken and never shipped below floor");
      } else if (grid.adjusted) {
        F.info(idx, "EMPHASIS-COUNT",
          "atom width branch: bystander cards re-widened so a long value never breaks (engine logs the numbers)");
      }
      // labels auto-shrink to ONE line (never a mid-word wrap); warn when the
      // shrink is deep enough to look off-scale.
      c.stats.forEach((st, j) => {
        if (!st || !st.label || !grid.cells[j]) return;
        const pt = fitLabelPt(st.label, grid.cells[j].w - 0.8, T.s.head);
        if (pt < T.s.head * 0.72) {
          F.warn(idx, "CAPACITY",
            `stat label "${st.label}" auto-shrinks to ${pt}pt (base ${T.s.head}) to stay on one line — shorten the label (<=5 chars on the slimmed cards)`);
        }
      });
    }
    // marker (§2): ONE device, on the SAME element the emphasis names.
    const mk = c.marker;
    if (mk && typeof mk === "object") {
      const support = MARKER_SUPPORT[sl.pattern];
      if (!support) {
        F.error(idx, "EMPHASIS-COUNT", `marker has no slot on pattern "${sl.pattern}" (supported: ${Object.keys(MARKER_SUPPORT).join(", ")})`);
      } else if (!support.includes(mk.type)) {
        F.error(idx, "EMPHASIS-COUNT", `marker type "${mk.type}" is not supported on "${sl.pattern}" (${support.join("/")})`);
      }
      // circle = hand-drawn wobble: OFF-REGISTER for business/financial decks;
      // requires an explicit theme opt-in (layout.marker.handDrawn). No shipped
      // theme opts in, so a circle is unselectable by default — use badge.
      if (mk.type === "circle" && !(T.layout && T.layout.marker && T.layout.marker.handDrawn)) {
        F.error(idx, "EMPHASIS-COUNT",
          "circle marker requires theme layout.marker.handDrawn (hand-drawn wobble reads as 採点マーク — off-register for business/financial decks). Use badge (default) or underline.");
      }
      // the marker rides the protagonist: patterns whose protagonist is the
      // emphasis element require emphasis; message's protagonist is statBig;
      // chart's marker rides the takeaway card (no emphasis needed).
      if ((sl.pattern === "stat-grid" || sl.pattern === "flow" || sl.pattern === "cycle") && !hasNew) {
        F.error(idx, "EMPHASIS-COUNT", "marker without emphasis — the marker attaches to the protagonist; name it first (emphasis)");
      }
      if (sl.pattern === "message" && !c.statBig) {
        F.error(idx, "EMPHASIS-COUNT", "marker on a message slide with no statBig — there is no number to mark");
      }
      if ((mk.type === "badge" || mk.type === "arrow-note")) {
        const t = typeof mk.text === "string" ? mk.text.trim() : "";
        if (!t) F.error(idx, "EMPHASIS-COUNT", `${mk.type} marker needs "text" (a short data-supported fact)`);
        else {
          const max = mk.type === "badge" ? BADGE_MAX : NOTE_MAX;
          if ([...t].length > max) F.error(idx, "EMPHASIS-COUNT", `${mk.type} text "${t}" is ${[...t].length} chars (max ${max} — a marker is a label, not a sentence)`);
          if (HYPE_RE.test(t)) F.error(idx, "EMPHASIS-COUNT", `${mk.type} text "${t}" contains a hype word — marker text must be a plain FACT the data supports (誠実ガード, house-quality-bar §4)`);
          // an arrow-note earns its place only by ADDING information — a note
          // that repeats the card's own text is decoration (reviewer fix).
          if (mk.type === "arrow-note" && markerContextTexts(sl).some((s2) => s2 && s2.includes(t))) {
            F.error(idx, "EMPHASIS-COUNT", `arrow-note "${t}" duplicates text already on the card — say something the card doesn't (or drop the note)`);
          }
        }
      }
      if (mk.type === "circle" && (T.layout && T.layout.marker && T.layout.marker.handDrawn) && !mk.image) {
        F.warn(idx, "EMPHASIS-COUNT", "circle marker has no image yet — run bin/graphics/make-markers.js (build.sh does) or the engine will skip it");
      }
    }
    // CUD floor (色覚の床規則): an emphasis whose ONLY channel is a hue/tint
    // shift breaks for ~1 in 12 viewers. The legacy stat-grid emphasizeIndex
    // is exactly that (equal cells, tint + value colour, zero size/area step)
    // — the pale-tint treatment the pixel audit watched LOSE. Advisory: keep
    // it working, tell the author to migrate.
    if (hasLegacy && !hasNew && sl.pattern === "stat-grid") {
      F.warn(idx, "SALIENCY",
        "legacy emphasizeIndex = tint-only emphasis (no size/area channel) — 色相・ティント単独の強調は色覚特性(約8%)で崩れ、実測でも脇役に負けた形。`emphasis`（面積の序列）か badge へ移行を");
    }
    // peak: body climax only — cover/cta are already the dark bookends.
    if (sl.peak === true) {
      peaks.push(idx);
      if (sl.pattern === "cover" || sl.pattern === "cta") {
        F.error(idx, "EMPHASIS-COUNT", `peak on "${sl.pattern}" — the peak is a BODY climax; cover/cta are already dark bookends`);
      }
    }
  });
  if (peaks.length > 1) {
    F.error(null, "EMPHASIS-COUNT",
      `deck has ${peaks.length} peak slides (${peaks.join(", ")}) — max 1; a deck with two climaxes has none (ピーク・エンド)`);
  }
}

/* ---------------- CHECK: RHYTHM (緩急 — advisory) ----------------
 * Peak-end needs contrast: three or more DENSE slides in a row read as one
 * grey wall and flatten the deck's rhythm. Density here is structural
 * (pattern + element count), not a prose judgment — so this stays advisory
 * (WARN): the human eye is the final judge of pacing. */
function isDense(sl) {
  const c = sl.content || {};
  if (sl.pattern === "table" || sl.pattern === "comparison") return true;
  if (sl.pattern === "card-grid") return Array.isArray(c.cards) && c.cards.length >= 5;
  if (sl.pattern === "chart") {
    if (c.chartType === "band") return true;
    const vals = (!Array.isArray(c.series) && c.series && Array.isArray(c.series.values)) ? c.series.values : [];
    return vals.length >= 6;
  }
  return false;
}

function checkRhythm(slides, F) {
  let runStart = -1;
  const flush = (end) => {
    const len = end - runStart;
    if (runStart >= 0 && len >= 3) {
      F.warn(runStart + 1, "RHYTHM",
        `slides ${runStart + 1}-${end} are ${len} dense slides in a row ` +
        `(${slides.slice(runStart, end).map((s) => s.pattern).join(", ")}) — ` +
        "insert a breathing beat (message / section) so the important slide can stand out (advisory)");
    }
    runStart = -1;
  };
  slides.forEach((sl, i) => {
    if (isDense(sl)) { if (runStart < 0) runStart = i; }
    else flush(i);
  });
  flush(slides.length);
}

/* ---------------- CHECK: REGISTER (intent gate — education-register.md) ----------------
 * The register decides which devices are allowed:
 *   - persona / speech bubble: education ONLY. financial/board => hard ERROR
 *     (取締役会資料で人物の口に台詞は破滅). Undeclared intent => WARN to
 *     declare it.
 *   - persona-mark (捏造ガード): a fictional persona/example without its ※例
 *     marking => WARN (the acceptance's 必須基準).
 *   - over-diagram guard: in education, a diagram slide whose notes don't
 *     record the one-word structure test (順序/ループ/2軸/ポジション/システム/
 *     対応…) => WARN — 保守的分類（迷えばテキスト）を記録で担保する。
 *     意味の正しさ自体は人の承認領域。 */
const DIAGRAM_PATTERNS = ["flow", "cycle", "matrix", "positioning", "system", "relation", "timeline", "steps", "branch", "formula", "waterfall"];
const STRUCT_WORD_RE = /順序|手順|ループ|循環|2軸|二軸|両軸|ポジション|位置取り|システム|全体像|エコシステム|対応|関係|構造|分解|時系列|段階|sequence|loop|two-axis|positioning|system|relation/i;
const PERSONA_PATTERNS = ["message", "two-column"];

function checkRegister(slides, meta, F) {
  const intent = meta && meta.intent;
  const edu = intent === "education" || intent === "seminar";
  slides.forEach((sl, i) => {
    const idx = i + 1;
    const c = sl.content || {};
    const p = c.persona;
    if (p && typeof p === "object") {
      if (intent === "financial" || intent === "board") {
        F.error(idx, "REGISTER-GATE",
          `persona/speech bubble with meta.intent=${intent} — 人型デバイス・吹き出しは financial/board で常時OFF (education-register.md 反転表)`);
      } else if (!intent) {
        F.warn(idx, "REGISTER-GATE",
          "persona used without meta.intent — declare the register (seminar/education) so the gates can protect the deck");
      }
      if (!PERSONA_PATTERNS.includes(sl.pattern)) {
        F.error(idx, "REGISTER-GATE",
          `persona has no slot on pattern "${sl.pattern}" (supported: ${PERSONA_PATTERNS.join(", ")})`);
      }
      if (!(typeof p.mark === "string" && p.mark.trim())) {
        F.warn(idx, "PERSONA-MARK",
          "fictional persona without its ※例 marking — add persona.mark (e.g. ※学習用の架空の例); 例示を事実主張と混ぜない (捏造ガード)");
      }
      if (p.figure && !(typeof p.mark === "string" && p.mark.trim())) {
        F.warn(idx, "PERSONA-MARK",
          "drop-in (licensed PNG) persona without marking — 忠実度が上がるほど ※例 マーキングを強める");
      }
      // 人物ポリシー: production figures are SUPPLIED licensed/open-license pro
      // vectors; the in-engine figure is an abstract pictogram behind an
      // EXPLICIT opt-in (the hand-drawn trial confirmed it does not reach pro
      // human quality). Neither declared -> the voice renders without a person.
      if (!p.figure && !p.figureImage && p.style !== "pictogram") {
        F.warn(idx, "PERSONA-FIGURE",
          'persona has no figure source — supply a licensed/open-license vector (persona.figure, assets/generated/figures/ + LICENSE.md) or explicitly opt into an in-engine figure (style:"silhouette" ビジネスシルエット / style:"pictogram" 抽象ピクト). 人物はAI生成もスクレイプもしない (M-7); 未指定は吹き出しのみ描画');
      }
    }
    // dialogue / testimonial: avatar+bubble devices — same register floor as
    // persona (financial/board = OFF), plus the speaker-specific mechanics:
    // BUBBLE-TAIL (tail must face its own avatar), SYMBOL-DUP (素材内蔵マーク
    // との二重装飾), PERSONA-MARK (架空の会話・声には ※例).
    if (sl.pattern === "dialogue" || sl.pattern === "testimonial") {
      if (intent === "financial" || intent === "board") {
        F.error(idx, "REGISTER-GATE",
          `${sl.pattern} with meta.intent=${intent} — アバター・吹き出しは financial/board で常時OFF`);
      } else if (!intent) {
        F.warn(idx, "REGISTER-GATE",
          `${sl.pattern} without meta.intent — declare the register (seminar/education/marketing)`);
      }
      if (!(typeof c.mark === "string" && c.mark.trim())) {
        F.warn(idx, "PERSONA-MARK",
          `${sl.pattern} without its ※例 marking — fictional conversations/voices must say so (content.mark); 実在の声を使うならユーザー承認と出所管理が前提`);
      }
      const speakers = sl.pattern === "dialogue"
        ? (Array.isArray(c.columns) ? c.columns.flatMap((col, ci) => (col.speakers || []).map((sp, k) => ({ sp, where: `columns[${ci}].speakers[${k}]`, k })))
                                    : (c.speakers || []).map((sp, k) => ({ sp, where: `speakers[${k}]`, k })))
        : (c.items || []).map((sp, k) => ({ sp, where: `items[${k}]`, k }));
      speakers.forEach(({ sp, where, k }) => {
        if (!sp || typeof sp !== "object") return;
        const derivedSide = sp.side === "right" || (!sp.side && k % 2 === 1) ? "right" : "left";
        if (sp.tailSide && sp.tailSide !== derivedSide) {
          F.warn(idx, "BUBBLE-TAIL",
            `${where}: bubble tail (${sp.tailSide}) does not face the speaker's avatar (${derivedSide} side) — 尻尾は自分の話者を指す`);
        }
        if (sp.symbol && typeof (sp.avatar || sp.figure) === "string" && /[\\/]socost[\\/]/.test(sp.avatar || sp.figure)) {
          F.warn(idx, "SYMBOL-DUP",
            `${where}: scene symbol "${sp.symbol}" on a socost asset — 多くのソコスト絵は感情マーク内蔵（二重装飾）。素材を確認し、内蔵マークがあるなら symbol を外す`);
        }
      });
    }
    if (c.persona && typeof c.persona === "object" && c.persona.symbol
        && typeof c.persona.figure === "string" && /[\\/]socost[\\/]/.test(c.persona.figure)) {
      F.warn(idx, "SYMBOL-DUP",
        `persona: scene symbol "${c.persona.symbol}" on a socost asset — 内蔵の感情マークとの二重装飾を確認`);
    }
    if (edu && DIAGRAM_PATTERNS.includes(sl.pattern)) {
      if (!(typeof c.notes === "string" && STRUCT_WORD_RE.test(c.notes))) {
        F.warn(idx, "OVER-DIAGRAM",
          `education diagram (${sl.pattern}) without the one-word structure test in notes — record WHY this skeleton fits (sequence/loop/two-axis/positioning/system/relation); 迷えばテキスト`);
      }
    }
  });
}

/* SALIENCY note: the static token-based saliency proxy that used to live here
 * PASSED a real failure (the first A/B's pale-tint stat-grid, where 8.4% lost
 * to 48.2億円) — a detector that misses its motivating case is worse than
 * none. It is replaced by bin/lint/saliency-lint.js, which scores the actual
 * RENDERED pixels (soffice → image → per-element ink area x contrast x
 * saturation) and is acceptance-tested against that exact failure. build.sh
 * runs it after the render step. */

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
  const { meta, slides } = loadPlan(args.plan);

  const F = makeFindings();
  checkRegister(slides, meta, F);
  checkPlaceholders(slides, F);
  checkCapacity(slides, F);
  checkOverflow(slides, T, F);
  checkEmphasis(slides, T, F);
  checkRhythm(slides, F);
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
  contrastRatio, relLuminance, walkStrings, getByPath,
  checkPlaceholders, checkCapacity, checkOverflow, checkContrast, checkMargin, checkAiTells,
  checkEmphasis, checkRhythm, checkRegister, isDense,
  run,
};
