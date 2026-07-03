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
const CAPS = { flow: [3, 6], cycle: [3, 6] }; // [min, max] element count; matrix is fixed 4

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

// Inner text box of a node (labels + the floor both use this).
function nodeTextBox(node) {
  return { x: node.x + NODE_PAD, y: node.y + NODE_PAD, w: node.w - 2 * NODE_PAD, h: node.h - 2 * NODE_PAD };
}

module.exports = { diagramArea, flowLayout, nodeTextBox, NODE_PAD, CAPS };
