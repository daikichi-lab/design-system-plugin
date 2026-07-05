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
const CAPS = { flow: [3, 6], cycle: [3, 6], timeline: [3, 7], steps: [3, 5], branch: [2, 4], formula: [2, 4], waterfall: [3, 8] }; // [min, max] element count; matrix is fixed 4

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

// Inner text box of a node (labels + the floor both use this).
function nodeTextBox(node) {
  return { x: node.x + NODE_PAD, y: node.y + NODE_PAD, w: node.w - 2 * NODE_PAD, h: node.h - 2 * NODE_PAD };
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
  diagramArea, flowLayout, cycleLayout, matrixLayout, timelineLayout, stepsLayout, branchLayout, formulaLayout, waterfallLayout,
  nodeTextBox, quadHeadBox, quadBodyBox, MATRIX_TX, NODE_PAD, CAPS,
};
