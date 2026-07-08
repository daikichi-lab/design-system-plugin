"use strict";
/* ============================================================
 *  bin/graphics/diagrams.js — diagram SKELETON geometry (base structures)
 *
 *  "text -> diagram" as a finite set of base structures (skeletons). This module
 *  owns only the GEOMETRY: given a theme + element count, where each node / cell /
 *  arrow sits. generate.js draws the native shapes + native labels at those
 *  positions (M-8: shapes are figure, labels/numbers stay native); geometry.js
 *  applies the FLOOR (kinsoku / orphan / height gate) to the SAME node text boxes.
 *  One geometry, two consumers — so the label always lands inside the shape.
 *
 *  Design order (strict): (1) a skeleton that never breaks as the element count
 *  varies, (2) conservative classification (deck-strategy), (3) look reuses the
 *  existing theme tokens + slots. This file is step (1) for flow / cycle / matrix.
 *
 *  Element-count caps live here as the single source of truth; design-lint reads
 *  them so an over-cap diagram is a hard error (split or fall back to text).
 * ============================================================ */

const NODE_PAD = 0.16;               // inner padding of a node text box (in)
const CAPS = { flow: [3, 6], cycle: [3, 6], timeline: [3, 7], steps: [3, 5], branch: [2, 4], formula: [2, 4], waterfall: [3, 8], identity: [2, 4], identitySub: [2, 3], positioning: [2, 3], system: [2, 5], relation: [2, 4],
  dialogue: [2, 4], testimonial: [2, 6],
}; // [min, max] element count; matrix is fixed 4

/* Emphasis size step (visual-psychology layer): the ONE protagonist element a
 * slide names via `content.emphasis` gets a restrained size step; the deck's
 * single `peak: true` slide opens the ceiling ONE more step. Shared here (not
 * in generate.js) because the engine (drawing) and layout-html/geometry.js
 * (kinsoku bake + height gate) must scale the SAME way, or the floor would
 * measure a size the engine doesn't draw. Rounded to 0.1pt so both sides use
 * the exact same number. */
const EMPH_SCALE = 1.15, PEAK_EMPH_SCALE = 1.3;
function emphSizePt(basePt, peak) { return Math.round(basePt * (peak ? PEAK_EMPH_SCALE : EMPH_SCALE) * 10) / 10; }

/* stat-grid AREA emphasis (visual-psychology, A/B-driven revision): the first
 * A/B proved that a pale tint + a small size step CANNOT out-shine a longer
 * neighbour ("8.4%" lost to "48.2億円") — area order beats color. So the
 * protagonist KPI card gets a WIDTH step (×1.45; the others share the rest —
 * total width unchanged) and its NUMBER jumps ×1.7 (×1.8 on the peak slide),
 * unit glyphs rendered smaller beside it. Shared here: generate.js draws the
 * cells, geometry.js wraps/gates at the same widths, saliency-lint samples the
 * same regions. Legacy emphasizeIndex (and no emphasis) => equal cells,
 * byte-identical to before. */
const STAT_GRID = { top: 2.7, h: 3.45, gap: 0.4, pad: 0.4 };
const EMPH_CARD_SCALE = 1.45;                       // protagonist card width step
const VALUE_JUMP = 1.7, VALUE_JUMP_PEAK = 1.8;      // protagonist number scale jump
const UNIT_RATIO = 0.5;                             // unit glyphs vs the jumped number
function statGridLayout(T, n, emphIdx) {
  const g = STAT_GRID;
  const totalW = T.W - 2 * T.m;
  const baseW = (totalW - (n - 1) * g.gap) / Math.max(n, 1);
  const cells = [];
  if (!Number.isInteger(emphIdx) || emphIdx < 0 || emphIdx >= n || n < 2) {
    for (let i = 0; i < n; i++) cells.push({ x: T.m + i * (baseW + g.gap), y: g.top, w: baseW, h: g.h });
    return { cells, baseW, g };
  }
  const emphW = baseW * EMPH_CARD_SCALE;
  const otherW = (totalW - (n - 1) * g.gap - emphW) / (n - 1);
  let x = T.m;
  for (let i = 0; i < n; i++) {
    const w = i === emphIdx ? emphW : otherW;
    cells.push({ x, y: g.top, w, h: g.h });
    x += w + g.gap;
  }
  return { cells, baseW, g };
}
// Split a KPI value into the number and its unit ("48.2億円" -> ["48.2","億円"])
// so the protagonist can jump the NUMBER and keep the unit small beside it.
function splitValueUnit(v) {
  const s = String(v == null ? "" : v);
  const m = s.match(/^([▲△+±-]?[0-9][0-9.,]*)(.*)$/);
  return m ? { num: m[1], unit: m[2] } : { num: s, unit: "" };
}
// Crude glyph-width estimate (inches). Calibrated against the soffice/Yu
// Gothic renders that caught 518億円 wrapping where a 0.55em digit estimate
// said it fit: bold DIGITS run ≈0.62em, comma/period ≈0.3em, % ≈0.8em,
// other ASCII ≈0.55em, fullwidth 1.0em. Still an ESTIMATE — consumers keep
// the FIT_SAFETY margin on top; underestimating is the dangerous direction.
function estTextWidthIn(text, pt) {
  let em = 0;
  for (const ch of String(text == null ? "" : text)) {
    const c = ch.codePointAt(0);
    if (c >= 0x30 && c <= 0x39) em += 0.62;            // digits (bold tabular-ish)
    else if (ch === "." || ch === ",") em += 0.3;
    else if (ch === "%") em += 0.8;
    else if (c < 0x2000 && !(c >= 0x0080 && c < 0x0100)) em += 0.55;
    else if (c < 0x2E80) em += 0.8;
    else em += 1.0;                                     // fullwidth (JP)
  }
  return (em * pt) / 72;
}

/* ---- KPI value / label FITTERS (the atom rule — 層①・常時ON) ----
 * A number and its unit are ONE UNBREAKABLE ATOM (数値＋単位＝非分割アトム):
 * 518億円 never renders as 518 / 億円, never as 518億 / 円. This SUPERSEDES
 * the earlier concession that allowed a number|unit boundary break. Overflow
 * resolution order (the machine rule):
 *   (1) one line at the base size;
 *   (2) proportional shrink of the WHOLE atom (number:unit ratio preserved —
 *       the big-number + small-unit look stays) down to the readable floor;
 *   (3) floor reached and still too wide -> the CARD adapts, never the atom:
 *       resolveStatGrid widens the bystander card minimally / trims the
 *       protagonist card (logged). fits:false here means "the atom was kept
 *       whole at an exact-fit size below the floor" — resolveStatGrid / the
 *       design-lint gate treat that as a content problem to surface.
 *   label — a label is ONE word/term: it never wraps; it steps its font down
 *           (0.5pt grid, floor 10pt) until it fits one line.
 * Shared here so generate.js (drawing), geometry.js (floor), design-lint and
 * saliency-lint all agree on the same numbers. */
// The estimate is crude and the renderers disagree by a few percent (the same
// chromium-vs-soffice noise EFFECTIVE_FACTOR absorbs), so the fitters only
// call a line "fitting" at 92% of the box — a borderline estimate must step
// down instead of gambling on a wrap.
const FIT_SAFETY = 0.92;
// Readable floors (documented contract): bystander number >= 0.7x base
// (28pt @ base 40 = 41% of the 68pt protagonist — above the 40% 実効字高
// floor); protagonist number >= 1.6x base (the emphasis promise).
const BYSTANDER_FLOOR = 0.7, EMPH_FLOOR = 1.6;

function atomWidthIn(value, pt, unitRatio = UNIT_RATIO) {
  const { num, unit } = splitValueUnit(value);
  return estTextWidthIn(num, pt) + (unit ? estTextWidthIn(unit, Math.round(pt * unitRatio * 10) / 10) : 0);
}

function fitValue(value, availIn, basePt, { unitRatio = UNIT_RATIO, minScale = BYSTANDER_FLOOR } = {}) {
  const avail = availIn * FIT_SAFETY;
  const { num, unit } = splitValueUnit(value);
  const uPt = (pt) => Math.round(pt * unitRatio * 10) / 10;
  const oneLine = (pt) => atomWidthIn(value, pt, unitRatio) <= avail + 1e-6; // epsilon: exact-need widths from resolveStatGrid must count as fitting
  const steps = [1];
  for (let k = 0.95; k >= minScale - 1e-9; k -= 0.05) steps.push(Math.round(k * 100) / 100);
  for (const k of steps) {
    const pt = Math.round(basePt * k * 10) / 10;
    if (oneLine(pt)) return { num, unit, numPt: pt, unitPt: uPt(pt), fits: true };
  }
  // Floor reached and still too wide: NEVER break the atom — keep it whole at
  // the exact-fit size (below the floor) and report fits:false so the caller
  // (resolveStatGrid width branch / design-lint) surfaces it.
  const wAtBase = atomWidthIn(value, basePt, unitRatio);
  const pt = Math.max(Math.floor((basePt * avail / wAtBase) * 2) / 2, basePt * 0.3);
  return { num, unit, numPt: pt, unitPt: uPt(pt), fits: false };
}

function fitLabelPt(label, availIn, basePt, floorPt = 10) {
  const avail = availIn * FIT_SAFETY;
  const need = estTextWidthIn(label, basePt);
  if (need <= avail) return basePt;
  const pt = Math.floor(((avail * basePt) / need) * 2) / 2; // proportional, 0.5pt grid
  return Math.max(pt, floorPt);
}

/* ---- resolveStatGrid: content-aware cells (the atom rule's width branch) ----
 * Default: the fixed AREA layout (protagonist x1.45, equal bystanders) —
 * unchanged whenever every atom fits its card at the readable floors. When a
 * bystander atom is wider than the quiet share even at its floor, the CARD
 * adapts, never the atom: each bystander gets AT LEAST the width its atom
 * needs at the floor (per-card, minimal), the protagonist keeps its 1.6x-floor
 * width and absorbs the remaining slack up to the default 1.45x target, and
 * stays the widest (area order). If even the floors don't fit the canvas,
 * `floorViolated` is set — the engine still renders unbroken atoms (exact-fit
 * below floor) and design-lint hard-errors: the CONTENT must change. Every
 * adjustment is reported in `notes` (the caller logs them). */
function resolveStatGrid(T, stats, emphIdx) {
  const list = Array.isArray(stats) ? stats : [];
  const n = Math.max(list.length, 1);
  const g = STAT_GRID;
  if (!Number.isInteger(emphIdx) || emphIdx < 0 || emphIdx >= n || n < 2) {
    return { cells: statGridLayout(T, n, -1).cells, adjusted: false, floorViolated: false, notes: [] };
  }
  const base = T.s.statCard || 40;
  const totalW = T.W - 2 * T.m;
  const S = totalW - (n - 1) * g.gap;
  const baseW = S / n;
  const needOf = (v, pt) => atomWidthIn(v, pt) / FIT_SAFETY + 2 * g.pad;
  const needs = list.map((st, i) => needOf(st && st.value, Math.round(base * (i === emphIdx ? EMPH_FLOOR : BYSTANDER_FLOOR) * 10) / 10));
  const def = statGridLayout(T, n, emphIdx);
  if (needs.every((w, i) => w <= def.cells[i].w)) {
    return { cells: def.cells, adjusted: false, floorViolated: false, notes: [] };
  }
  const notes = [];
  const toCells = (ws) => {
    const cells = []; let x = T.m;
    ws.forEach((w) => { cells.push({ x, y: g.top, w, h: g.h }); x += w + g.gap; });
    return cells;
  };
  const minSum = needs.reduce((a, b) => a + b, 0);
  if (minSum > S) {
    const f = S / minSum;
    notes.push(`FLOOR VIOLATED: the atoms need ${minSum.toFixed(2)}in at their readable floors but only ${S.toFixed(2)}in exists — rendering UNBROKEN below floor; shorten the values (design-lint errors)`);
    return { cells: toCells(needs.map((w) => w * f)), adjusted: true, floorViolated: true, notes };
  }
  let slack = S - minSum;
  const emphTarget = baseW * EMPH_CARD_SCALE;
  let emphW = Math.min(needs[emphIdx] + slack, Math.max(emphTarget, needs[emphIdx]));
  slack -= emphW - needs[emphIdx];
  let ws = needs.map((w, i) => (i === emphIdx ? emphW : w + slack / (n - 1)));
  // area order: the protagonist stays the widest card
  const maxOther = Math.max(...ws.filter((_, i) => i !== emphIdx));
  if (emphW < maxOther) {
    const give = Math.min(maxOther - emphW, slack);
    ws = ws.map((w, i) => (i === emphIdx ? emphW + give : w - give / (n - 1)));
    notes.push(`area order squeezed by a long bystander atom — protagonist width raised to ${(emphW + give).toFixed(2)}in`);
  }
  const scaleNow = ws[emphIdx] / baseW;
  const protagNote = Math.abs(scaleNow - EMPH_CARD_SCALE) > 0.005
    ? `protagonist trimmed to ${scaleNow.toFixed(2)}x (from ${EMPH_CARD_SCALE}x)` : `protagonist kept at ${EMPH_CARD_SCALE}x`;
  notes.push(`width branch fired: bystander atom(s) wider than the quiet share at the floor — cards re-widened per-card, ${protagNote}; the atom is never broken`);
  return { cells: toCells(ws), adjusted: true, floorViolated: false, notes };
}

// The drawing area a diagram gets, below the kicker/title. Shared by every
// skeleton so they sit consistently on the slide.
function diagramArea(T) {
  return { x: T.m, y: 2.45, w: T.W - 2 * T.m, h: 3.95 };
}

/* ---------------- flow: N steps, arrow-connected ---------------- */
// Horizontal row by default; vertical stack when explicitly asked OR when the
// horizontal nodes would get too narrow for text (auto-fallback). Robust for any
// n — width/height are computed from n, never hardcoded per count.
function flowLayout(T, n, direction) {
  const area = diagramArea(T);
  const gap = 0.46, minNodeW = 1.5, nodeH = 1.5;
  const horizW = (area.w - (n - 1) * gap) / n;
  const vertical = direction === "vertical" || (direction !== "horizontal" && horizW < minNodeW);
  const nodes = [], arrows = [];
  if (!vertical) {
    const y = area.y + (area.h - nodeH) / 2;
    for (let i = 0; i < n; i++) {
      const x = area.x + i * (horizW + gap);
      nodes.push({ x, y, w: horizW, h: nodeH });
      if (i < n - 1) arrows.push({ x1: x + horizW, y1: y + nodeH / 2, x2: x + horizW + gap, y2: y + nodeH / 2 });
    }
    return { orientation: "horizontal", nodes, arrows, area };
  }
  const vgap = 0.3, nh = Math.min(1.05, (area.h - (n - 1) * vgap) / n);
  const w = Math.min(7.2, area.w * 0.66), x = area.x + (area.w - w) / 2;
  for (let i = 0; i < n; i++) {
    const y = area.y + i * (nh + vgap);
    nodes.push({ x, y, w, h: nh });
    if (i < n - 1) arrows.push({ x1: x + w / 2, y1: y + nh, x2: x + w / 2, y2: y + nh + vgap });
  }
  return { orientation: "vertical", nodes, arrows, area };
}

/* ---------------- cycle: N nodes on a ring, cyclic arrows ---------------- */
// Nodes evenly placed on an ELLIPTICAL ring (wider than tall, to use the 16:9
// space) starting at the top and going clockwise. Arrows connect adjacent nodes
// and stop SHORT of each box (a clearance gap) so the arrowhead shows the
// direction instead of hiding under the next node. Robust for any n (angle and
// node placement derive from n).
function cycleLayout(T, n) {
  const area = diagramArea(T);
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const rx = Math.min(3.1, area.w * 0.30), ry = Math.min(1.5, area.h * 0.38);
  const nodeW = 1.9, nodeH = 0.9, gap = 0.12;
  const hw = nodeW / 2, hh = nodeH / 2;
  const nodes = [], centers = [], arrows = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;      // top, then clockwise
    const ccx = cx + rx * Math.cos(a), ccy = cy + ry * Math.sin(a);
    centers.push([ccx, ccy]);
    nodes.push({ x: ccx - nodeW / 2, y: ccy - nodeH / 2, w: nodeW, h: nodeH });
  }
  for (let i = 0; i < n; i++) {
    const [px, py] = centers[i], [qx, qy] = centers[(i + 1) % n];
    const dx = qx - px, dy = qy - py, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    // ray->box edge distance from a node centre along (ux,uy), so the arrow starts
    // and ends AT the box edge (+gap) — the head always clears the next node.
    const edge = Math.min(hw / (Math.abs(ux) || 1e-6), hh / (Math.abs(uy) || 1e-6)) + gap;
    arrows.push({ x1: px + ux * edge, y1: py + uy * edge, x2: qx - ux * edge, y2: qy - uy * edge });
  }
  return { nodes, arrows, area };
}

/* ---------------- timeline: N dated milestones on a horizontal spine ---------------- */
// 沿革 / history: one horizontal arrow line (time flows left -> right), a dot per
// milestone, and the date + label alternating ABOVE / BELOW the line (even index
// up, odd down) so adjacent texts never collide even when wider than one slot.
// Robust for any n in CAPS.timeline: slot width derives from n; the text width is
// clamped so the first/last boxes never cross the 0.5" edge-margin rule
// (slot + 2*(margin - 0.5) overhang) and same-side neighbours (2 slots apart)
// always keep clear air.
const TL_DATE_H = 0.34, TL_LABEL_H = 1.02, TL_GAP_LINE = 0.16, TL_GAP_DATE = 0.04, TL_DOT = 0.18;

function timelineLayout(T, n) {
  const area = diagramArea(T);
  const cy = area.y + area.h / 2;
  const slot = area.w / n;
  const overhang = Math.max(0, (T.m - 0.5)) * 2;         // keep >= 0.5in from slide edge
  const textW = Math.min(2.6, slot * 1.7, slot + overhang);
  const line = { x1: area.x, y1: cy, x2: area.x + area.w, y2: cy };
  const milestones = [];
  for (let i = 0; i < n; i++) {
    const cx = area.x + slot * (i + 0.5);
    const above = i % 2 === 0;                            // even up, odd down
    const bx = cx - textW / 2;
    const dateBox = above
      ? { x: bx, y: cy - TL_GAP_LINE - TL_DATE_H, w: textW, h: TL_DATE_H }
      : { x: bx, y: cy + TL_GAP_LINE, w: textW, h: TL_DATE_H };
    const labelBox = above
      ? { x: bx, y: dateBox.y - TL_GAP_DATE - TL_LABEL_H, w: textW, h: TL_LABEL_H }
      : { x: bx, y: dateBox.y + TL_DATE_H + TL_GAP_DATE, w: textW, h: TL_LABEL_H };
    milestones.push({
      above,
      dot: { x: cx - TL_DOT / 2, y: cy - TL_DOT / 2, d: TL_DOT },
      dateBox, labelBox,
    });
  }
  return { area, line, milestones };
}

/* ---------------- steps: N ascending stages (階段状ステップアップ) ---------------- */
// A staircase read left-bottom -> right-top: goal orientation, stages that build
// on each other (成長ステップ, 導入フェーズ, 学習ロードマップ). Blocks share one
// BOTTOM baseline and rise linearly; the LAST (goal) block is the tallest. Robust
// for any n in CAPS.steps — width and height increments derive from n. The label
// box is the block's inner box; the first (shortest) block is the binding height
// constraint, so the floor gates every label against ITS OWN block.
const STEPS_MIN_H = 1.3, STEPS_MAX_H = 3.0, STEPS_GAP = 0.4;

function stepsLayout(T, n) {
  const area = diagramArea(T);
  const bottom = area.y + area.h;
  const w = (area.w - (n - 1) * STEPS_GAP) / n;
  const nodes = [];
  for (let i = 0; i < n; i++) {
    const h = n === 1 ? STEPS_MAX_H : STEPS_MIN_H + (i * (STEPS_MAX_H - STEPS_MIN_H)) / (n - 1);
    nodes.push({ x: area.x + i * (w + STEPS_GAP), y: bottom - h, w, h });
  }
  return { area, nodes };
}

/* ---------------- branch: 1 -> N diverge / N -> 1 converge ---------------- */
// One node on one side, N stacked nodes on the other, arrows fanning between
// them. direction "diverge" (default): the single SOURCE sits left and feeds the
// branches (1つの決算書 -> 三表). "converge": the branches sit left and merge
// into the single RESULT on the right (現場の声+数字+動向 -> 経営判断). Reading
// stays left -> right in both. Arrows fan from/to the single node's edge at
// spread offsets so the heads never pile on one point. Robust for 2-4 branches.
const BR_SINGLE_W = 4.0, BR_MANY_W = 5.2, BR_SINGLE_H = 1.5, BR_VGAP = 0.26, BR_CLEAR = 0.08;

function branchLayout(T, n, direction) {
  const area = diagramArea(T);
  const converge = direction === "converge";
  const singleX = converge ? area.x + area.w - BR_SINGLE_W : area.x;
  const manyX = converge ? area.x : area.x + area.w - BR_MANY_W;
  const single = { x: singleX, y: area.y + (area.h - BR_SINGLE_H) / 2, w: BR_SINGLE_W, h: BR_SINGLE_H };
  const mh = Math.min(1.15, (area.h - (n - 1) * BR_VGAP) / n);
  const total = n * mh + (n - 1) * BR_VGAP;
  const y0 = area.y + (area.h - total) / 2;
  const many = [], arrows = [];
  for (let i = 0; i < n; i++) {
    const node = { x: manyX, y: y0 + i * (mh + BR_VGAP), w: BR_MANY_W, h: mh };
    many.push(node);
    // fan offset on the single node's edge, clamped inside its height
    const spread = (i - (n - 1) / 2) * Math.min(0.35, (BR_SINGLE_H - 0.4) / Math.max(n - 1, 1));
    const sy = single.y + single.h / 2 + spread;
    const my = node.y + node.h / 2;
    if (converge) {
      arrows.push({ x1: node.x + node.w + BR_CLEAR, y1: my, x2: single.x - BR_CLEAR, y2: sy });
    } else {
      arrows.push({ x1: single.x + single.w + BR_CLEAR, y1: sy, x2: node.x - BR_CLEAR, y2: my });
    }
  }
  return { area, single, many, arrows, converge };
}

/* ---------------- formula: [result =] A × B × C ---------------- */
// A quantity DECOMPOSED into factors (売上 = 客数 × 客単価 × 店舗数, ROE デュポン
// 分解) or summands (operator "+"). One horizontal row: an optional tinted RESULT
// box, an "=" cell, then the operand boxes with the operator glyph between them.
// All cells share one center line; operator glyphs live in fixed-width cells so
// they can never collide with the boxes. Robust for 2-4 operands.
const FORMULA_H = 1.5, FORMULA_OP_W = 0.6;

function formulaLayout(T, n, hasResult) {
  const area = diagramArea(T);
  const y = area.y + (area.h - FORMULA_H) / 2;
  const boxCount = n + (hasResult ? 1 : 0);
  const opCount = (n - 1) + (hasResult ? 1 : 0);
  const w = (area.w - opCount * FORMULA_OP_W) / boxCount;
  const nodes = [], ops = [];
  let x = area.x;
  if (hasResult) {
    nodes.push({ x, y, w, h: FORMULA_H, role: "result" });
    x += w;
    ops.push({ x, y, w: FORMULA_OP_W, h: FORMULA_H, glyph: "=" });
    x += FORMULA_OP_W;
  }
  for (let i = 0; i < n; i++) {
    nodes.push({ x, y, w, h: FORMULA_H, role: "operand" });
    x += w;
    if (i < n - 1) {
      ops.push({ x, y, w: FORMULA_OP_W, h: FORMULA_H, glyph: null }); // glyph filled by the builder (× or +)
      x += FORMULA_OP_W;
    }
  }
  return { area, nodes, ops };
}

/* ---------------- waterfall: cumulative bridge (増減要因分解) ---------------- */
// The finance staple: a level, the signed deltas that move it, the next level
// (営業利益ブリッジ, 売上100円の行き先). Built from NATIVE rects + native text —
// pptxgenjs has no waterfall chart type, and shapes give exact control over the
// one thing that matters in a 会計 deck: per-block colour and ▲-formatted labels.
// items: [{label, value, total?}] — total:true anchors an absolute LEVEL (start /
// subtotal / end, drawn from zero); others are signed deltas from the running
// cumulative. Handles a cumulative that dips below zero (the zero line shifts up).
const WF_BAR_RATIO = 0.62, WF_VAL_BAND = 0.32, WF_CAT_BAND = 0.6, WF_GAP = 0.06;

function waterfallLayout(T, items) {
  const area = diagramArea(T);
  const n = Math.max(items.length, 1);
  const slot = area.w / n;
  const plotTop = area.y + WF_VAL_BAND;
  const plotBot = area.y + area.h - WF_CAT_BAND;
  // cumulative walk -> each bar's [lo, hi] level
  let cum = 0;
  const levels = items.map((it) => {
    const v = Number(it.value) || 0;
    if (it.total) { cum = v; return { lo: Math.min(0, v), hi: Math.max(0, v), after: cum, kind: "total" }; }
    const before = cum; cum += v;
    return { lo: Math.min(before, cum), hi: Math.max(before, cum), after: cum, kind: v >= 0 ? "up" : "down" };
  });
  const maxL = Math.max(0, ...levels.map((l) => l.hi));
  const minL = Math.min(0, ...levels.map((l) => l.lo));
  const scale = (plotBot - plotTop) / ((maxL - minL) || 1);
  const y = (v) => plotTop + (maxL - v) * scale;
  const barW = slot * WF_BAR_RATIO;
  const bars = [], valueBoxes = [], catBoxes = [], connectors = [];
  levels.forEach((l, i) => {
    const x = area.x + i * slot + (slot - barW) / 2;
    const by = y(l.hi), bh = Math.max((l.hi - l.lo) * scale, 0.03);
    bars.push({ x, y: by, w: barW, h: bh, kind: l.kind });
    valueBoxes.push({ x: area.x + i * slot, y: by - 0.3, w: slot, h: 0.26 });
    catBoxes.push({ x: area.x + i * slot + 0.04, y: plotBot + WF_GAP, w: slot - 0.08, h: WF_CAT_BAND - WF_GAP - 0.02 });
    if (i < levels.length - 1) connectors.push({ x1: x + barW, x2: area.x + (i + 1) * slot + (slot - barW) / 2, y: y(l.after) });
  });
  return { area, bars, valueBoxes, catBoxes, connectors, zeroY: y(0), plotTop, plotBot };
}

/* ---------------- identity: stacked identity (積み上げ恒等式) ---------------- */
// The accounting canonical form (visual-psychology.md §3.5 正準形ライブラリ):
// a WHOLE on the left, its decomposition STACKED on the right at the same total
// height — the areas carry the identity (資産 ＝ 負債 ＋ 純資産, 収入 ＝ 税 ＋ 手取り).
// This is what `formula` must NOT be used for: equal boxes joined by ＋ render
// the identity as 額装 (the symbol-erasure test fails); here, erase the ＝ and
// the stacked composition still reads. Honesty: heights are proportional ONLY
// when every part carries a numeric value (all-or-none); with no values the
// parts split evenly — the engine never invents proportions (盛らない).
const ID_H = 3.3, ID_OP_W = 0.7, ID_GAP = 0.12, ID_SUB_GAP = 0.14, ID_MIN_PART = 0.42;

// stackProportions: heights for a stack of items filling `total` (gaps out),
// proportional ONLY when every item has a numeric value (all-or-none — the
// engine never invents proportions); else equal split.
function stackProportions(items, total, gap) {
  const n = Math.max(items.length, 1);
  const vals = items.map((p) => (p && typeof p.value === "number" ? p.value : null));
  const proportional = vals.length > 0 && vals.every((v) => typeof v === "number" && v >= 0) && vals.some((v) => v > 0);
  const stackH = total - (n - 1) * gap;
  const sum = proportional ? vals.reduce((a, b) => a + b, 0) : 0;
  const heights = items.map((p, i) =>
    proportional ? Math.max(stackH * (vals[i] / (sum || 1)), 0.02) : stackH / n);
  return { heights, proportional };
}

// identityTextSpec — the SINGLE SOURCE for how an identity/STRAC box carries
// its label: a thin slice (the canonical STRAC 利益 at 15% is one) keeps its
// honest proportional height and steps the TYPE down instead (head -> small)
// with a slim pad. The builder draws with this and the height gate measures
// with the same numbers — never two opinions.
const ID_THIN = 0.62, ID_THIN_PAD = 0.05;
function identityTextSpec(T, box) {
  const thin = box.h < ID_THIN;
  const pad = thin ? ID_THIN_PAD : NODE_PAD;
  return { thin, sizePt: thin ? T.s.small : T.s.head,
    tb: { x: box.x + NODE_PAD, y: box.y + pad, w: box.w - 2 * NODE_PAD, h: box.h - 2 * pad } };
}

function identityLayout(T, parts) {
  const area = diagramArea(T);
  const y0 = area.y + (area.h - ID_H) / 2;
  // one part may carry its own decomposition (`sub`, 2-3 items) — the STRAC
  // form (売上＝変動費＋限界利益; 限界利益＝固定費＋利益): a THIRD column
  // beside the decomposed part, stacked to exactly that part's height, so the
  // areas keep carrying the identity at both levels.
  const subIdx = parts.findIndex((p) => p && Array.isArray(p.sub) && p.sub.length);
  const cols = subIdx >= 0 ? 3 : 2;
  const w = (area.w - ID_OP_W - (cols === 3 ? ID_SUB_GAP : 0)) / cols;
  const { heights, proportional } = stackProportions(parts, ID_H, ID_GAP);
  const left = { x: area.x, y: y0, w, h: ID_H };
  const op = { x: area.x + w, y: y0, w: ID_OP_W, h: ID_H };
  let py = y0;
  const partBoxes = heights.map((h) => { const b = { x: area.x + w + ID_OP_W, y: py, w, h }; py += h + ID_GAP; return b; });
  let subBoxes = null, subProportional = false;
  if (subIdx >= 0) {
    const parent = partBoxes[subIdx];
    const sp = stackProportions(parts[subIdx].sub, parent.h, ID_GAP);
    subProportional = sp.proportional;
    let sy = parent.y;
    subBoxes = sp.heights.map((h) => { const b = { x: parent.x + w + ID_SUB_GAP, y: sy, w, h }; sy += h + ID_GAP; return b; });
  }
  return { area, left, op, parts: partBoxes, proportional, subIdx, subBoxes, subProportional, minPart: ID_MIN_PART };
}

/* ---------------- breakeven: CVP / 損益分岐点図 ---------------- */
// The other 会計セミナー staple: 売上高線 and 総費用線 (固定費 floor + 変動費
// slope) crossing at the 損益分岐点. Purely STRUCTURAL — no value labels; the
// line positions derive from {fixed, variableRate} when given (honest), else a
// schematic default and the engine auto-stamps ※模式図 (house-bar §4: an
// unlabeled schematic must not look like data).
const BE_PAD_L = 0.5, BE_PAD_B = 0.5, BE_TOP = 0.25;

function breakevenLayout(T, fixed, variableRate) {
  const area = diagramArea(T);
  const plot = { x: area.x + BE_PAD_L, y: area.y + BE_TOP,
                 w: area.w - BE_PAD_L - 2.1, h: area.h - BE_TOP - BE_PAD_B };
  const schematic = !(typeof fixed === "number" && fixed > 0 &&
                      typeof variableRate === "number" && variableRate > 0 && variableRate < 1);
  const v = schematic ? 0.55 : variableRate;
  // sales units: BEP = F/(1−v); x-axis spans 1.6×BEP so the crossing sits at
  // 62.5% — a presentation scale (axes carry no ticks), not a data claim.
  const xBep = 0.625;
  const salesAtMax = 1.0;                    // top of plot = sales at xMax
  const fFrac = schematic ? (1 - v) * xBep   // keeps BEP at 62.5% by construction
                          : (1 - v) * xBep;  // identical relation: f = (1−v)·xBep
  const X = (fx) => plot.x + fx * plot.w;
  const Y = (fy) => plot.y + plot.h - fy * plot.h;   // fy in sales units [0..1]
  const sales = { x1: X(0), y1: Y(0), x2: X(1), y2: Y(salesAtMax) };
  const cost  = { x1: X(0), y1: Y(fFrac), x2: X(1), y2: Y(fFrac + v * salesAtMax) };
  const bep   = { x: X(xBep), y: Y(xBep * salesAtMax) };
  return { area, plot, sales, cost, fixedY: Y(fFrac), bep, schematic };
}

/* ---------------- emphasized column chart (native rects) ----------------
 * When a column chart DECLARES a protagonist bar (emphasizeIndex), the native
 * pptx chart cannot vary bar WIDTH per point nor BOLD one data label — so the
 * emphasized variant draws native rects (same machinery as waterfall: fully
 * editable, never rasterized). Channels (CUD-redundant): the protagonist bar
 * is WIDER (x1.3), deeper-coloured, and its value label is BOLD and larger.
 * Handles negative values with a zero line. Plot box mirrors the native
 * chart's (x m, y 2.2, 7.4 x 4.4) so the takeaway card is untouched. */
const EC_BAR_RATIO = 0.5, EC_EMPH_RATIO = 0.66, EC_VAL_BAND = 0.34, EC_CAT_BAND = 0.55;
function emphColumnLayout(T, values, emphIdx) {
  const area = { x: T.m, y: 2.2, w: 7.4, h: 4.4 };
  const n = Math.max(values.length, 1);
  const slot = area.w / n;
  const plotTop = area.y + EC_VAL_BAND;
  const plotBot = area.y + area.h - EC_CAT_BAND;
  const maxV = Math.max(0, ...values), minV = Math.min(0, ...values);
  const scale = (plotBot - plotTop) / ((maxV - minV) || 1);
  const yOf = (v) => plotTop + (maxV - v) * scale;
  const bars = [], valueBoxes = [], catBoxes = [];
  values.forEach((v, i) => {
    const emph = i === emphIdx;
    const bw = slot * (emph ? EC_EMPH_RATIO : EC_BAR_RATIO);
    const x = area.x + i * slot + (slot - bw) / 2;
    const top = yOf(Math.max(0, v)), bot = yOf(Math.min(0, v));
    bars.push({ x, y: top, w: bw, h: Math.max(bot - top, 0.03), emph, neg: v < 0 });
    // negative labels sit under the bar UNLESS that runs into the category
    // band (a tiny negative near the plot floor) — then they lift above the
    // zero line (geometry-lint caught the ▲33 vs 2021/3期 collision).
    const negBelowOk = bot + 0.34 <= plotBot;
    valueBoxes.push(v >= 0
      ? { x: area.x + i * slot, y: top - 0.32, w: slot, h: 0.28 }
      : negBelowOk
        ? { x: area.x + i * slot, y: bot + 0.04, w: slot, h: 0.28 }
        : { x: area.x + i * slot, y: top - 0.32, w: slot, h: 0.28 });
    catBoxes.push({ x: area.x + i * slot + 0.04, y: plotBot + 0.08, w: slot - 0.08, h: EC_CAT_BAND - 0.12 });
  });
  return { area, bars, valueBoxes, catBoxes, zeroY: yOf(0), hasNeg: minV < 0 };
}

// Inner text box of a node (labels + the floor both use this).
function nodeTextBox(node) {
  return { x: node.x + NODE_PAD, y: node.y + NODE_PAD, w: node.w - 2 * NODE_PAD, h: node.h - 2 * NODE_PAD };
}

/* ---------------- positioning: 2-3 competitive positions + VS ----------------
 * 競争ポジション (education-register.md §2-1): side-by-side position cards
 * separated by a VS cell. Structure word: "positioning". Equal card widths by
 * construction (等間隔は数理で担保); the VS cell is a fixed lane so it can
 * never collide with the cards. */
const POS_VS_W = 0.66;
function positioningLayout(T, n) {
  const area = diagramArea(T);
  const gap = POS_VS_W + 0.24;
  const w = (area.w - (n - 1) * gap) / n;
  const cards = [], vs = [];
  for (let i = 0; i < n; i++) {
    const x = area.x + i * (w + gap);
    cards.push({ x, y: area.y, w, h: area.h });
    if (i < n - 1) vs.push({ x: x + w + 0.12, y: area.y + area.h / 2 - 0.35, w: POS_VS_W, h: 0.7 });
  }
  return { area, cards, vs };
}
const POS_HEAD_H = 0.52, POS_PAD = 0.3;
function posHeadBox(cd) { return { x: cd.x + POS_PAD, y: cd.y + 0.26, w: cd.w - 2 * POS_PAD, h: POS_HEAD_H }; }
function posBodyBox(cd) { return { x: cd.x + POS_PAD, y: cd.y + 0.26 + POS_HEAD_H + 0.14, w: cd.w - 2 * POS_PAD, h: cd.h - 0.26 - POS_HEAD_H - 0.14 - 0.26 }; }

/* ---------------- system: ecosystem boxes + LABELED arrows ----------------
 * 全体像／エコシステム (structure word: "system"): who passes what to whom.
 * Nodes on one horizontal row; FORWARD flows (from < to, adjacent) run between
 * the nodes with their label ABOVE the arrow; RETURN flows (from > to) run in
 * a lane BELOW the nodes with the label underneath — two lanes, so labels can
 * never collide. Non-adjacent links also use the below-lane. */
const SYS_NODE_H = 1.15, SYS_LABEL_H = 0.3, SYS_LANE_GAP = 0.55;
function systemLayout(T, n, links) {
  const area = diagramArea(T);
  const gap = 1.5; // wide enough that a label CHIP still leaves visible arrow stubs
  const w = (area.w - (n - 1) * gap) / n;
  const y = area.y + 0.75;
  const nodes = [];
  for (let i = 0; i < n; i++) nodes.push({ x: area.x + i * (w + gap), y, w, h: SYS_NODE_H });
  const fwd = [], back = [];
  (links || []).forEach((lk) => {
    const a = nodes[lk.from], b = nodes[lk.to];
    if (!a || !b || lk.from === lk.to) return;
    if (lk.to === lk.from + 1) {
      // adjacent forward: straight arrow in the node band, label above it
      const x1 = a.x + a.w, x2 = b.x, cy = y + SYS_NODE_H / 2;
      fwd.push({ x1, x2, y: cy, label: lk.label,
        labelBox: { x: x1 - 0.35, y: cy - SYS_LABEL_H / 2, w: (x2 - x1) + 0.7, h: SYS_LABEL_H } });
    } else {
      // return / long-range: the below lane (right-to-left arrows read as 戻り)
      const laneY = y + SYS_NODE_H + SYS_LANE_GAP + back.length * (SYS_LABEL_H + 0.5);
      const x1 = a.x + a.w / 2, x2 = b.x + b.w / 2;
      back.push({ x1, x2, y: laneY, label: lk.label,
        labelBox: { x: Math.min(x1, x2), y: laneY - SYS_LABEL_H / 2, w: Math.abs(x2 - x1), h: SYS_LABEL_H },
        drops: [{ x: x1, y1: y + SYS_NODE_H, y2: laneY }, { x: x2, y1: y + SYS_NODE_H, y2: laneY }] });
    }
  });
  return { area, nodes, fwd, back };
}

/* ---------------- relation: 対応マップ (correspondence / classification) ----------------
 * Structure word: "relation". THE FORM FOLLOWS THE DATA (user feedback: a
 * crossing line-web is 見にくい):
 *   - PARTITION (every right item belongs to exactly ONE left item — a pure
 *     classification, the common teaching case) -> ZONE GROUPING: each left
 *     item becomes a zone container and its members sit INSIDE it (Gestalt
 *     enclosure — zero lines, zero crossings, instantly readable).
 *   - true many-to-many -> the line map, with the right column REORDERED by
 *     the barycenter heuristic to minimize crossings.
 * relationForm() decides; both consumers (engine + floor) share it. */
const REL_BOX_W = 3.5, REL_BOX_H = 0.85;
const REL_ZONE_HEAD_W = 2.7, REL_ZONE_PAD = 0.3, REL_CHIP_H = 0.82;

function relationIsPartition(nL, nR, links) {
  const seen = new Array(nR).fill(0);
  (links || []).forEach(([i, j]) => { if (j >= 0 && j < nR) seen[j]++; });
  return seen.every((c) => c === 1);
}

// barycenter reorder: sort right items by the mean index of their left
// partners — the standard 2-layer crossing-minimization heuristic.
function relationOrder(nL, nR, links) {
  const partners = Array.from({ length: nR }, () => []);
  (links || []).forEach(([i, j]) => { if (partners[j]) partners[j].push(i); });
  return Array.from({ length: nR }, (_, j) => j)
    .sort((a, b) => {
      const ba = partners[a].length ? partners[a].reduce((x, y) => x + y, 0) / partners[a].length : nL;
      const bb = partners[b].length ? partners[b].reduce((x, y) => x + y, 0) / partners[b].length : nL;
      return ba - bb || a - b;
    });
}

function relationLayout(T, nL, nR, links) {
  const area = diagramArea(T);
  const order = relationOrder(nL, nR, links);
  const rowOf = new Array(nR); order.forEach((j, row) => { rowOf[j] = row; });
  const colY = (count, i) => area.y + (area.h - count * REL_BOX_H - (count - 1) * 0.35) / 2 + i * (REL_BOX_H + 0.35);
  const left = [], right = [];
  for (let i = 0; i < nL; i++) left.push({ x: area.x + 0.2, y: colY(nL, i), w: REL_BOX_W, h: REL_BOX_H });
  for (let j = 0; j < nR; j++) right.push({ x: area.x + area.w - REL_BOX_W - 0.2, y: colY(nR, rowOf[j]), w: REL_BOX_W, h: REL_BOX_H });
  const line = (i, j) => ({ x1: left[i].x + left[i].w, y1: left[i].y + REL_BOX_H / 2, x2: right[j].x, y2: right[j].y + REL_BOX_H / 2 });
  return { area, left, right, line, order };
}

// zone grouping (partition form): a container per left item, members inside.
function relationZones(T, nL, nR, links) {
  const area = diagramArea(T);
  const gap = 0.35;
  const zoneH = (area.h - (nL - 1) * gap) / nL;
  const zones = [], memberBoxes = Array.from({ length: nR }, () => null);
  const members = Array.from({ length: nL }, () => []);
  (links || []).forEach(([i, j]) => { if (members[i]) members[i].push(j); });
  for (let i = 0; i < nL; i++) {
    const zy = area.y + i * (zoneH + gap);
    const zone = { x: area.x, y: zy, w: area.w, h: zoneH };
    const head = { x: zone.x + REL_ZONE_PAD, y: zy + REL_ZONE_PAD, w: REL_ZONE_HEAD_W, h: zoneH - 2 * REL_ZONE_PAD };
    const k = members[i].length || 1;
    const chipsX = zone.x + REL_ZONE_PAD + REL_ZONE_HEAD_W + 0.35;
    const chipsW = zone.x + zone.w - REL_ZONE_PAD - chipsX;
    const chipW = (chipsW - (k - 1) * 0.3) / k;
    members[i].forEach((j, kk) => {
      memberBoxes[j] = { x: chipsX + kk * (chipW + 0.3), y: zy + (zoneH - REL_CHIP_H) / 2, w: chipW, h: REL_CHIP_H };
    });
    zones.push({ zone, head });
  }
  return { area, zones, memberBoxes };
}

/* ---------------- persona: figure + seamless speech bubble (education register) ----------------
 * ONE geometry for the asset-independent persona slot (education-register.md
 * §3): make-markers sizes the SVG assets with it, generate.js draws at it,
 * geometry.js registers the quote as a wrapping field (bake kinsoku + number
 * atoms) and height-gates it against the bubble. Defaults per host pattern:
 *   message    — figure bottom-RIGHT, bubble above it (tail bottom)
 *   two-column — figure bottom-LEFT in the lead column, bubble to its right
 *                (tail left)
 * The author may override x/y/w. Quote metrics: sizes.body + lead.tight. */
const PERSONA_FIG_W = 1.9, PERSONA_ASPECT = 1.4, PERSONA_BUBBLE_W = 3.7;
const PERSONA_SIL_W = 1.30, PERSONA_SIL_ASPECT = 2.2; // full-body silhouette (viewBox 200x440)
const PERSONA_PAD = 0.2, PERSONA_TAIL = 0.28, PERSONA_QUOTE_MAX_LINES = 4;

function personaLayout(p, T, pattern) {
  // silhouette is FULL-BODY (200x440 master, aspect 2.2) vs the pictogram
  // bust — narrower and taller at a similar overall height, so bubble/mark
  // math is untouched.
  const sil = p.style === "silhouette";
  const figW = typeof p.w === "number" ? p.w : sil ? PERSONA_SIL_W : PERSONA_FIG_W;
  // supplied assets keep THEIR aspect: make-markers reads the file's pixel
  // dims and enriches the plan with w+h so no consumer ever stretches a
  // figure (engine, bake floor and image-lint all read the same box here).
  const figH = typeof p.h === "number" ? p.h : figW * (sil ? PERSONA_SIL_ASPECT : PERSONA_ASPECT);
  const right = pattern !== "two-column"; // message/default: figure on the right
  const figX = typeof p.x === "number" ? p.x : right ? T.W - T.m - figW : T.m + 0.25;
  const figY = typeof p.y === "number" ? p.y : T.H - 0.62 - figH;
  const tailSide = p.tailSide === "left" || p.tailSide === "bottom" ? p.tailSide : right ? "bottom" : "left";
  // left-tail bubbles live between the figure and the content column: clamp
  // to the slide margin AND (on two-column) to the numbered rows' start
  // (engine rx=6.45) so a wide square bust never pushes the bubble over them
  const leftTailLimit = pattern === "two-column" ? 6.2 : T.W - T.m;
  const bubbleW = tailSide === "left" ? Math.min(PERSONA_BUBBLE_W, leftTailLimit - (figX + figW + 0.3)) : PERSONA_BUBBLE_W;
  const innerW = bubbleW - 2 * PERSONA_PAD;
  const quotePt = T.s.body, quoteLead = T.lead.tight;
  // conservative line estimate (x0.82, not the 0.92 fit factor): budoux
  // rebreaking beats greedy wrapping, so the bubble must be sized for the
  // WORST case — a bubble one line too tall is air; one line too short is an
  // overflow ERROR (the gate proved it on the first field build).
  const lines = Math.max(1, Math.min(PERSONA_QUOTE_MAX_LINES,
    Math.ceil(estTextWidthIn(p.quote || "", quotePt) / (innerW * 0.82))));
  const bodyH = ((lines * quotePt * quoteLead) / 72) * 1.12 + 2 * PERSONA_PAD; // 12% air so the OVERFLOW gate (92%) always clears at the estimated line count
  let bubble, tailAt;
  if (tailSide === "bottom") {
    // bubble floats above the figure, tail drops toward the figure's head
    const bx = Math.max(T.m, Math.min(figX + figW - bubbleW + 0.3, T.W - T.m - bubbleW));
    const by = figY - bodyH - PERSONA_TAIL - 0.08;
    bubble = { x: bx, y: by, w: bubbleW, h: bodyH + PERSONA_TAIL };
    tailAt = Math.min(Math.max((figX + figW * 0.45 - bx) / bubbleW, 0.15), 0.85);
  } else {
    // bubble sits right of the figure, tail points left at the face
    const bx = figX + figW + 0.3;
    const by = Math.max(T.m, figY + 0.1);
    bubble = { x: bx, y: by, w: bubbleW, h: bodyH };
    tailAt = 0.35;
  }
  const quote = tailSide === "bottom"
    ? { x: bubble.x + PERSONA_PAD, y: bubble.y + PERSONA_PAD, w: innerW, h: bodyH - 2 * PERSONA_PAD }
    : { x: bubble.x + PERSONA_TAIL / 2 + PERSONA_PAD, y: bubble.y + PERSONA_PAD, w: innerW - PERSONA_TAIL / 2, h: bodyH - 2 * PERSONA_PAD };
  // ※例 marking under the figure (right-aligned to it on the right side)
  const markW = 2.6;
  // beside the figure's foot, on the OPEN side: under-figure placement
  // collided with the footer/page number (geometry-lint caught it) and busts
  // fill their box so text over the image reads badly
  // clamped above the footer band so a bottom-BLED figure (cut-edge bust
  // anchored to the slide edge, e.g. socost) keeps its mark legible
  const markY = Math.min(figY + figH - 0.3, T.H - 0.98);
  const mark = right
    ? { x: figX - markW - 0.1, y: markY, w: markW, h: 0.24, align: "right" }
    : { x: figX + figW + 0.1, y: markY, w: markW, h: 0.24, align: "left" };
  // scene-symbol slot (悩み雲・電球・汗 etc): beside the head, on the figure's
  // OUTER side — below the bubble bottom (figY-0.08) and clear of the tail
  // (which drops at ~45% of the figure width), so it never collides with either.
  const SYM = 0.62;
  const symX = right ? Math.min(figX + figW - SYM * 0.35, T.W - 0.12 - SYM) : Math.max(0.12, figX - SYM * 0.65);
  const symbol = { x: symX, y: figY + 0.02, w: SYM, h: SYM };
  return { fig: { x: figX, y: figY, w: figW, h: figH }, bubble, quote, mark, symbol, tailSide, tailAt, quotePt, quoteLead, lines };
}

/* ---------------- dialogue / testimonial: avatar + bubble speakers ----------
 * One speaker = the building block { avatar(円マスクバスト), role label,
 * seam-free bubble whose tail points at ITS OWN avatar, native quote }.
 * The avatar is NEUTRAL/STATIC — meaning rides in the words, the scene
 * symbols and the ○×/verdict labels, never in a pose. Layout is the single
 * source for engine drawing, bake floor and the BUBBLE-TAIL lint. */
const DLG_AVA = { plain: 0.95, compare: 0.78, grid: 0.8, stack: 0.9 };
const DLG_PAD = 0.16, DLG_TOP = 2.45, DLG_BOT = 6.75;

function speakerRow(T, sp, i, x0, x1, y, dia, quotePt) {
  // one dialogue row inside [x0,x1]: avatar on sp.side, bubble beside it
  const side = sp.side === "right" ? "right" : "left";
  const avX = side === "left" ? x0 : x1 - dia;
  // the bubble HUGS its text (a one-liner in a full-width bubble reads empty):
  // inner width follows the estimate (worst-case derate 0.82 built in) up to
  // the available column width, then wraps like before
  const maxInner = x1 - x0 - dia - 0.42 - 2 * DLG_PAD - PERSONA_TAIL / 2;
  const est = estTextWidthIn(sp.quote || "", quotePt);
  const innerW = Math.min(maxInner, Math.max(1.2, est / 0.82 + 0.06));
  const bubW = innerW + 2 * DLG_PAD + PERSONA_TAIL / 2;
  const lines = Math.max(1, Math.min(PERSONA_QUOTE_MAX_LINES,
    Math.ceil(est / (innerW * 0.82))));
  const bodyH = ((lines * quotePt * T.lead.tight) / 72) * 1.12 + 2 * DLG_PAD;
  const rowH = Math.max(dia + 0.34, bodyH + 0.1);
  const avY = y + (rowH - 0.34 - dia) / 2;
  const bubY = avY + dia / 2 - bodyH / 2;
  const bubX = side === "left" ? avX + dia + 0.28 : avX - 0.28 - bubW;
  const tailSide = side === "left" ? "left" : "right";
  const quote = {
    x: bubX + DLG_PAD + (tailSide === "left" ? PERSONA_TAIL / 2 : 0),
    y: bubY + DLG_PAD, w: innerW, h: bodyH - 2 * DLG_PAD,
  };
  const role = { x: avX - 0.35, y: avY + dia + 0.02, w: dia + 0.7, h: 0.26 };
  // scene symbol rides the avatar's top corner TOWARD the bubble — it stays
  // inside the column (a fully-outside placement floated in the compare
  // form's gutter and read as the neighbour column's)
  const symbol = sp.symbol
    ? { x: side === "left" ? avX + dia - 0.13 : avX - 0.32, y: avY - 0.24, w: 0.45, h: 0.45 }
    : null;
  return { side, avatar: { x: avX, y: avY, w: dia, h: dia }, bubble: { x: bubX, y: bubY, w: bubW, h: bodyH },
    tailSide, tailAt: 0.5, quote, role, symbol, quotePt, rowH, lines };
}

function dialogueLayout(T, d) {
  const quotePt = T.s.body;
  if (Array.isArray(d.columns)) {
    // ○×比較 (compare form): two verdict columns, speakers stacked inside
    const dia = DLG_AVA.compare;
    const colW = (T.W - 2 * T.m - 0.5) / 2;
    const cols = d.columns.slice(0, 2).map((col, ci) => {
      const x0 = T.m + ci * (colW + 0.5);
      const head = { x: x0, y: DLG_TOP, w: colW, h: 0.52 };
      let y = DLG_TOP + 0.72;
      const speakers = (col.speakers || []).slice(0, 2).map((sp, i) => {
        const row = speakerRow(T, { side: i % 2 ? "right" : "left", ...sp }, i, x0 + 0.06, x0 + colW - 0.06, y, dia, T.s.small);
        y += row.rowH + 0.12;
        return row;
      });
      return { head, speakers, verdict: col.verdict === "bad" ? "bad" : "good", x0, w: colW };
    });
    return { form: "compare", cols, dia };
  }
  // plain conversation: speakers alternate sides down the page
  const dia = DLG_AVA.plain;
  let y = DLG_TOP;
  const speakers = (d.speakers || []).slice(0, CAPS.dialogue[1]).map((sp, i) => {
    const row = speakerRow(T, { side: i % 2 ? "right" : "left", ...sp }, i, T.m + 0.1, T.W - T.m - 0.1, y, dia, quotePt);
    y += row.rowH + 0.18;
    return row;
  });
  return { form: "plain", speakers, dia };
}

function testimonialLayout(T, d) {
  const items = (d.items || []).slice(0, CAPS.testimonial[1]);
  if (d.layout === "stack") {
    const dia = DLG_AVA.stack;
    const rows = Math.max(1, Math.min(3, items.length));
    const gap = 0.24, top = DLG_TOP, h = (DLG_BOT - top - gap * (rows - 1)) / rows;
    return { form: "stack", dia, cards: items.slice(0, 3).map((it, i) => {
      const y = top + i * (h + gap);
      const card = { x: T.m, y, w: T.W - 2 * T.m, h };
      const avatar = { x: T.m + 0.3, y: y + h / 2 - dia / 2, w: dia, h: dia };
      const name = { x: T.m + 0.3, y: avatar.y + dia + 0.04, w: dia + 1.2, h: 0.26 };
      const body = { x: T.m + dia + 0.75, y: y + 0.22, w: card.w - dia - 1.15, h: h - 0.44 };
      return { card, avatar, name, body };
    }) };
  }
  const dia = DLG_AVA.grid; // 2 x N grid
  const cols = 2, rows = Math.max(1, Math.ceil(items.length / cols));
  const gap = 0.26, top = DLG_TOP;
  const cw = (T.W - 2 * T.m - gap) / 2, ch = (DLG_BOT - top - gap * (rows - 1)) / rows;
  return { form: "grid", dia, cards: items.map((it, i) => {
    const cx = T.m + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (ch + gap);
    const card = { x: cx, y: cy, w: cw, h: ch };
    const avatar = { x: cx + 0.24, y: cy + 0.22, w: dia, h: dia };
    const name = { x: cx + dia + 0.44, y: cy + 0.26, w: cw - dia - 0.7, h: 0.32 };
    const body = { x: cx + dia + 0.44, y: cy + 0.62, w: cw - dia - 0.7, h: ch - 0.84 };
    return { card, avatar, name, body };
  }) };
}

/* ---------------- matrix: 2x2, axis labels + 4 quadrants ---------------- */
// Fixed 4 quadrants (TL, TR, BL, BR). Reserved bands hold the axis labels so
// they can never collide with quadrant content: X labels sit in a top strip,
// Y labels in a left column; the grid is inset below/right of them.
const MATRIX_LY = 1.2, MATRIX_TX = 0.44, QUAD_PAD = 0.24, QUAD_HEAD_H = 0.46;

function matrixLayout(T) {
  const area = diagramArea(T);
  const gx = area.x + MATRIX_LY, gy = area.y + MATRIX_TX;
  const gw = area.w - MATRIX_LY, gh = area.h - MATRIX_TX;
  const qw = gw / 2, qh = gh / 2;
  const quads = []; // reading order: TL, TR, BL, BR
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) quads.push({ x: gx + c * qw, y: gy + r * qh, w: qw, h: qh });
  return {
    area, grid: { x: gx, y: gy, w: gw, h: gh }, qw, qh, quads,
    // X-axis labels: a top strip, over the left half and right half.
    xLabelBoxes: [
      { x: gx, y: area.y, w: qw, h: MATRIX_TX, align: "left" },
      { x: gx + qw, y: area.y, w: qw, h: MATRIX_TX, align: "right" },
    ],
    // Y-axis labels: a left column, beside the top row and bottom row.
    yLabelBoxes: [
      { x: area.x, y: gy, w: MATRIX_LY - 0.12, h: qh, align: "right" },
      { x: area.x, y: gy + qh, w: MATRIX_LY - 0.12, h: qh, align: "right" },
    ],
  };
}

// A quadrant is a bounded cell (like a card): optional head band, then the body.
// The floor height-gates the body against the space that's actually left.
function quadHeadBox(q) { return { x: q.x + QUAD_PAD, y: q.y + QUAD_PAD, w: q.w - 2 * QUAD_PAD, h: QUAD_HEAD_H }; }
function quadBodyBox(q, hasHead) {
  const top = q.y + QUAD_PAD + (hasHead ? QUAD_HEAD_H : 0);
  return { x: q.x + QUAD_PAD, y: top, w: q.w - 2 * QUAD_PAD, h: q.y + q.h - QUAD_PAD - top };
}

module.exports = {
  diagramArea, flowLayout, cycleLayout, matrixLayout, timelineLayout, stepsLayout, branchLayout, formulaLayout, waterfallLayout, identityLayout, identityTextSpec, breakevenLayout,
  nodeTextBox, quadHeadBox, quadBodyBox, MATRIX_TX, NODE_PAD, CAPS,
  EMPH_SCALE, PEAK_EMPH_SCALE, emphSizePt,
  STAT_GRID, EMPH_CARD_SCALE, VALUE_JUMP, VALUE_JUMP_PEAK, UNIT_RATIO, statGridLayout, splitValueUnit, estTextWidthIn,
  fitValue, fitLabelPt, atomWidthIn, resolveStatGrid, FIT_SAFETY, BYSTANDER_FLOOR, EMPH_FLOOR,
  personaLayout, PERSONA_TAIL, PERSONA_PAD,
  dialogueLayout, testimonialLayout, DLG_AVA,
  positioningLayout, posHeadBox, posBodyBox, systemLayout, relationLayout, relationZones, relationIsPartition, relationOrder, emphColumnLayout, REL_BOX_H, REL_CHIP_H, SYS_LABEL_H,
};
