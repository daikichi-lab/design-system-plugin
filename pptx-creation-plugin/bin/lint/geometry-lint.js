#!/usr/bin/env node
/* ============================================================
 *  bin/lint/geometry-lint.js — 純幾何・色非依存の構成品質ゲート
 *
 *  Lints the GENERATED .pptx (the output XML, not the plan): every check is a
 *  machine-measurable, colour-independent geometry rule, so it catches engine
 *  drift and hand-tuned regressions that plan-level lints cannot see.
 *
 *    OUTLINE-ONLY (WARN)       a node defined by its border (thick stroke, no
 *                              elevation shadow) — the wireframe tell
 *    GEOM-DRIFT (WARN)         radius / stroke width / shadow outside the
 *                              family tokens (shape family discipline)
 *    ALIGN-DRIFT (WARN)        row siblings whose top edges or gaps wobble
 *                              beyond tolerance (整列規律)
 *    CONNECTOR-QUALITY (WARN)  connectors without a filled arrowhead, or
 *                              diagonal straight runs (直交ルーティング床)
 *    DENSITY (WARN)            node inner padding below the floor (cramped)
 *                              or text coverage far below the ceiling (間延び)
 *    COLLISION (ERROR)         text-bearing shapes overlapping — a real break
 *
 *  Pattern-aware exemptions come from the PLAN (cycle keeps its ring diagonals,
 *  relation's correspondence lines are arrowless by design). Charts/tables are
 *  graphicFrames and out of scope; pictures are skipped.
 *
 *  Usage: node bin/lint/geometry-lint.js --pptx <deck.pptx> --plan <plan.json>
 *         [--theme <t.json>] [--json]
 *  Exit: 0 = no ERROR (WARNs allowed) / 1 = COLLISION error / 2 = operational.
 * ============================================================ */
"use strict";

const path = require("path");
const { execFileSync } = require("child_process");
const { loadPlan, loadTheme } = require("../generate.js");

const EMU_IN = 914400, EMU_PT = 12700;
/* tolerances (single place) */
const HAIRLINE_MAX_PT = 1.55;              // structure lines / hairlines
const CONNECTOR_BAND = [2.2, 2.8];         // the connector width token band
const ANNOT_BAND = [2.2, 2.35];            // marker pointer (2.25) sits in-band
const RADIUS_TOL_IN = 0.025;
const ALIGN_TOL_IN = 0.03, GAP_TOL_IN = 0.06;
const PAD_FLOOR_IN = 0.055;
const COVER_CEILING = 0.06;                // text/node area coverage floor (間延び)
const OVERLAP_FRAC = 0.12, CONTAIN_FRAC = 0.95, SIZE_RATIO_EXEMPT = 4;

function listSlides(pptx) {
  const out = execFileSync("unzip", ["-Z1", pptx]).toString();
  return out.split("\n").filter((l) => /^ppt\/slides\/slide\d+\.xml$/.test(l))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
}
const readEntry = (pptx, entry) => execFileSync("unzip", ["-p", pptx, entry], { maxBuffer: 64 * 1024 * 1024 }).toString();

/* Parse the shapes of one slide XML (regex-level; the engine's output is
 * regular enough for this to be reliable). */
function parseShapes(xml) {
  const shapes = [];
  const spRe = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let m;
  while ((m = spRe.exec(xml))) {
    const b = m[1];
    const off = b.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
    const ext = b.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!off || !ext) continue;
    const prst = (b.match(/<a:prstGeom prst="([^"]+)"/) || [])[1] || "";
    const adj = (b.match(/<a:gd name="adj" fmla="val (\d+)"\/>/) || [])[1];
    const lnM = b.match(/<a:ln[^>]*w="(\d+)"[\s\S]*?<\/a:ln>/);
    const lnBlock = lnM ? lnM[0] : "";
    // two-step shadow parse: grab the outerShdw BLOCK, then its attrs + alpha
    // (a lazy optional group would always skip the alpha — real bug, fixed)
    const shadowM = b.match(/<a:outerShdw ([^>]*?)\/?>([\s\S]*?<\/a:outerShdw>)?/);
    const attr = (attrs, name) => { const mm = (attrs || "").match(new RegExp(name + '="(\\d+)"')); return mm ? +mm[1] : 0; };
    const alphaM = shadowM && shadowM[2] ? shadowM[2].match(/<a:alpha val="(\d+)"\/>/) : null;
    const shadow = shadowM ? [null, attr(shadowM[1], "blurRad"), attr(shadowM[1], "dist"), attr(shadowM[1], "dir"), alphaM ? +alphaM[1] : 100000] : null;
    const texts = [...b.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join("");
    shapes.push({
      x: +off[1] / EMU_IN, y: +off[2] / EMU_IN, w: +ext[1] / EMU_IN, h: +ext[2] / EMU_IN,
      prst, adjVal: adj ? +adj : null,
      lnPt: lnM ? +lnM[1] / EMU_PT : null,
      dashed: /<a:prstDash/.test(lnBlock),
      arrow: /<a:(?:head|tail)End type="(?:triangle|arrow|stealth)"/.test(lnBlock),
      noFill: /<p:spPr>(?:(?!<a:solidFill)[\s\S])*?<a:noFill\/>/.test(b) || !/<a:solidFill>/.test(b.split("<a:ln")[0]),
      hasShadow: !!shadow,
      shadow: shadow ? { blur: shadow[1] / EMU_PT, dist: shadow[2] / EMU_PT, opacity: shadow[4] / 100000 } : null,
      text: texts.trim(),
    });
  }
  return shapes;
}

const area = (s) => s.w * s.h;
const overlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

function lint(pptxPath, planPath, themePath) {
  const T = loadTheme(themePath);
  const { slides } = loadPlan(planPath);
  const tok = T.layout;
  const findings = [];
  const F = (level, slide, check, msg) => findings.push({ level, slide, check, message: msg });
  const entries = listSlides(pptxPath);
  entries.forEach((entry, i) => {
    const idx = i + 1;
    const pattern = (slides[i] && slides[i].pattern) || "";
    const shapes = parseShapes(readEntry(pptxPath, entry));
    const boxes = shapes.filter((s) => (s.prst === "roundRect" || s.prst === "rect") && !s.noFill);
    const nodeBoxes = boxes.filter((s) => area(s) > 0.5);
    const textSps = shapes.filter((s) => s.text && s.prst !== "line" && !s.prst.startsWith("bentConnector"));
    const lines = shapes.filter((s) => s.prst === "line" || s.prst.startsWith("bentConnector"));

    /* OUTLINE-ONLY: a node-sized box with a visible stroke thicker than the
     * hairline and NO elevation shadow = defined by its border. */
    nodeBoxes.forEach((s) => {
      if (s.lnPt != null && s.lnPt > HAIRLINE_MAX_PT && !s.hasShadow) {
        F("WARN", idx, "OUTLINE-ONLY", `node at (${s.x.toFixed(1)},${s.y.toFixed(1)}) is border-defined (stroke ${s.lnPt.toFixed(2)}pt, no elevation) — fill + soft shadow + hairline is the family`);
      }
    });

    /* GEOM-DRIFT: radius / stroke / shadow outside the tokens. */
    boxes.forEach((s) => {
      if (s.prst === "roundRect" && s.adjVal != null && area(s) > 0.4) {
        const rIn = (s.adjVal / 100000) * Math.min(s.w, s.h);
        // chips/badges use radius = h/2 (pill) — exempt pills
        const pill = Math.abs(rIn - Math.min(s.w, s.h) / 2) < 0.02;
        if (!pill && Math.abs(rIn - tok.card.radius) > RADIUS_TOL_IN) {
          F("WARN", idx, "GEOM-DRIFT", `corner radius ${rIn.toFixed(2)}in at (${s.x.toFixed(1)},${s.y.toFixed(1)}) is off the family token ${tok.card.radius}in`);
        }
      }
      if (s.hasShadow && s.shadow) {
        const e = tok.elevation, sd = s.shadow;
        const near = (t) => Math.abs(sd.blur - t.blur) <= t.blur * 0.35 && sd.opacity <= 0.2;
        if (!near(e.base) && !near(e.raised) && !(e.zone && near(e.zone))) {
          F("WARN", idx, "GEOM-DRIFT", `shadow (blur ${sd.blur.toFixed(0)}pt, opacity ${sd.opacity.toFixed(2)}) at (${s.x.toFixed(1)},${s.y.toFixed(1)}) is outside the elevation tokens (hard/heavy shadows are forbidden)`);
        }
      }
    });
    lines.forEach((s) => {
      if (s.lnPt == null) return;
      const inBand = (s.lnPt <= HAIRLINE_MAX_PT) || (s.lnPt >= CONNECTOR_BAND[0] && s.lnPt <= CONNECTOR_BAND[1]);
      if (!inBand) F("WARN", idx, "GEOM-DRIFT", `line width ${s.lnPt.toFixed(2)}pt is outside the stroke tokens (hairline <=${HAIRLINE_MAX_PT} / connector ${CONNECTOR_BAND[0]}-${CONNECTOR_BAND[1]})`);
    });

    /* ALIGN-DRIFT: same-row siblings must share tops and equal gaps.
     * CONTAINERS (a zone that fully encloses other node boxes) are not row
     * siblings of their own children — exclude them (relation zones). */
    const isContainer = (s) => nodeBoxes.some((o) => o !== s && overlap(s, o) >= 0.95 * area(o) && area(s) > area(o) * 1.5);
    // alignment discipline applies to LABEL-BEARING boxes (cards/nodes) —
    // textless fills are data marks (chart bars) whose tops carry the data.
    const bearsText = (s) => textSps.some((t) => overlap(s, t) >= 0.9 * area(t));
    const rows = [];
    nodeBoxes.filter((s) => !isContainer(s) && bearsText(s)).forEach((s) => {
      const cy = s.y + s.h / 2;
      let row = rows.find((r) => Math.abs(r.cy - cy) < 0.25);
      if (!row) { row = { cy, items: [] }; rows.push(row); }
      row.items.push(s);
    });
    rows.filter((r) => r.items.length >= 3).forEach((r) => {
      const tops = r.items.map((s) => s.y);
      const spread = Math.max(...tops) - Math.min(...tops);
      if (spread > ALIGN_TOL_IN) F("WARN", idx, "ALIGN-DRIFT", `row tops wobble by ${spread.toFixed(2)}in (> ${ALIGN_TOL_IN}) — snap siblings to one edge`);
      const xs = r.items.slice().sort((a, b) => a.x - b.x);
      const gaps = [];
      for (let k = 1; k < xs.length; k++) gaps.push(xs[k].x - (xs[k - 1].x + xs[k - 1].w));
      if (gaps.length >= 2 && Math.max(...gaps) - Math.min(...gaps) > GAP_TOL_IN) {
        F("WARN", idx, "ALIGN-DRIFT", `row gutters uneven (${gaps.map((g) => g.toFixed(2)).join("/")}in) — equalize the gaps`);
      }
    });

    /* CONNECTOR-QUALITY: connectors (>=2.2pt strokes) need arrowheads; no
     * diagonal straight runs. cycle keeps its ring metaphor; relation lines
     * are direction-free correspondences (documented exemptions). */
    lines.forEach((s) => {
      const isConn = s.lnPt != null && s.lnPt >= CONNECTOR_BAND[0];
      if (!isConn) return;
      if (!s.arrow && pattern !== "relation") {
        F("WARN", idx, "CONNECTOR-QUALITY", `connector at (${s.x.toFixed(1)},${s.y.toFixed(1)}) has no filled arrowhead`);
      }
      if (s.prst === "line" && s.w > 0.4 && s.h > 0.4 && pattern !== "cycle" && pattern !== "relation") {
        F("WARN", idx, "CONNECTOR-QUALITY", `diagonal straight connector (${s.w.toFixed(1)}x${s.h.toFixed(1)}in) — route orthogonally (bentConnector)`);
      }
    });

    /* DENSITY: text inside a node keeps a padding floor; a big node with
     * almost no ink is 間延び. */
    nodeBoxes.forEach((n) => {
      const inner = textSps.filter((t) => overlap(n, t) > 0.9 * area(t) && area(t) < area(n));
      if (!inner.length) return;
      const minPad = Math.min(...inner.map((t) => Math.min(t.x - n.x, t.y - n.y, n.x + n.w - (t.x + t.w), n.y + n.h - (t.y + t.h))));
      if (minPad > -0.005 && minPad < PAD_FLOOR_IN) {
        F("WARN", idx, "DENSITY", `text sits ${minPad.toFixed(2)}in from a node edge (< ${PAD_FLOOR_IN} floor) at (${n.x.toFixed(1)},${n.y.toFixed(1)}) — cramped`);
      }
      const cover = inner.reduce((a, t) => a + area(t), 0) / area(n);
      if (area(n) > 4 && cover < COVER_CEILING) {
        F("WARN", idx, "DENSITY", `node at (${n.x.toFixed(1)},${n.y.toFixed(1)}) is ${(cover * 100).toFixed(0)}% ink over ${area(n).toFixed(1)}in² — 間延び (fill the zone or shrink the box)`);
      }
    });

    /* COLLISION: text-bearing shapes overlapping = a real break. Containment
     * (label ON its shape) and riding chips (small vs large) are intentional. */
    const solid = shapes.filter((s) => s.text || ((s.prst === "roundRect" || s.prst === "rect") && !s.noFill && area(s) > 0.2));
    const seenCollision = new Set();
    for (let a2 = 0; a2 < solid.length; a2++) {
      for (let b2 = a2 + 1; b2 < solid.length; b2++) {
        const A = solid[a2], B = solid[b2];
        if (!A.text && !B.text) continue;
        const ov = overlap(A, B);
        if (!ov) continue;
        const small = area(A) <= area(B) ? A : B, big = area(A) <= area(B) ? B : A;
        if (ov >= CONTAIN_FRAC * area(small)) continue;          // contained label
        if (area(big) / Math.max(area(small), 1e-6) > SIZE_RATIO_EXEMPT) continue; // riding chip/badge
        if (ov > OVERLAP_FRAC * area(small)) {
          const key = `${small.x.toFixed(1)},${small.y.toFixed(1)},${big.x.toFixed(1)},${big.y.toFixed(1)}`;
          if (seenCollision.has(key)) continue;
          seenCollision.add(key);
          F("ERROR", idx, "COLLISION", `shapes overlap ${(ov / area(small) * 100).toFixed(0)}% at (${small.x.toFixed(1)},${small.y.toFixed(1)}) — "${(small.text || "").slice(0, 12)}" vs "${(big.text || "").slice(0, 12)}"`);
        }
      }
    }
  });
  const errors = findings.filter((f) => f.level === "ERROR").length;
  return { pptx: pptxPath, findings, errors, warnings: findings.filter((f) => f.level === "WARN").length, pass: errors === 0 };
}

const USAGE = `geometry-lint — 純幾何の構成品質ゲート (lints the generated pptx XML)
  node bin/lint/geometry-lint.js --pptx <deck.pptx> --plan <plan.json> [--theme <t.json>] [--json]`;

function main() {
  const a = { pptx: null, plan: null, theme: null, json: false };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--pptx") a.pptx = process.argv[++i];
    else if (k === "--plan") a.plan = process.argv[++i];
    else if (k === "--theme") a.theme = process.argv[++i];
    else if (k === "--json") a.json = true;
    else if (k === "-h" || k === "--help") { console.log(USAGE); return 0; }
    else { console.error(`unknown arg: ${k}\n\n${USAGE}`); return 2; }
  }
  if (!a.pptx || !a.plan) { console.error("Missing --pptx and/or --plan.\n\n" + USAGE); return 2; }
  if (!a.theme) a.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  const res = lint(a.pptx, a.plan, a.theme);
  if (a.json) { console.log(JSON.stringify(res)); return res.pass ? 0 : 1; }
  console.log(`geometry-lint: ${res.pptx}\n`);
  for (const lvl of ["ERROR", "WARN"]) {
    const list = res.findings.filter((f) => f.level === lvl);
    console.log(`${lvl}S (${list.length})`);
    list.forEach((f) => console.log(`  [slide ${f.slide}] ${f.check}: ${f.message}`));
    if (!list.length) console.log("  none");
    console.log("");
  }
  console.log(`SUMMARY: ${res.errors} error(s), ${res.warnings} warning(s) — ${res.pass ? "PASS" : "FAIL"}`);
  return res.pass ? 0 : 1;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { console.error("geometry-lint failed: " + (e && e.message ? e.message : e)); process.exit(2); }
}

module.exports = { lint, parseShapes };
