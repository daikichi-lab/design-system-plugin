"use strict";
/* ============================================================
 *  bin/layout-html/geometry.js — the wrapping-field geometry map
 *
 *  For each pattern, the free-flowing PROSE text fields that auto-wrap (and can
 *  therefore orphan), with the box geometry bin/generate.js actually renders
 *  them at. Consumed by typo-lint.js (predict breaks / orphans) and bake.js
 *  (compute balanced breaks to bake into the pptx). If a builder's coordinates
 *  change in generate.js, update the matching entry here.
 *
 *  Titles / messageLines / cover|cta titleLines are author-controlled arrays,
 *  not auto-wrapped, so they are intentionally NOT listed here.
 * ============================================================ */

// The engine draws text with margin:0 (no pptx text inset), so the effective
// wrap width is ~the full box — NOT box minus a 0.1in-per-side inset. The only
// reduction is metric noise: chromium fits marginally more per line than
// LibreOffice/PowerPoint. Calibrated against soffice Yu Gothic — the chart
// takeaway and the financial caption both match soffice at ~0.95*box (a ~5%
// safety that also keeps baked lines inside the box). Bullets add their real
// hanging indent on top. (Earlier box-0.2in over-narrowed and invented orphans.)
const EFFECTIVE_FACTOR = 0.95;
const BULLET_INDENT_IN = 14 / 72; // pptxgenjs bullet indent (14pt)
// Diagram skeletons compute their node geometry here too, so the floor
// (kinsoku / orphan / height gate) applies to the SAME node text boxes the
// engine draws labels into.
const { flowLayout, cycleLayout, matrixLayout, timelineLayout, stepsLayout, branchLayout, formulaLayout, waterfallLayout, identityLayout, nodeTextBox, quadBodyBox, emphSizePt, resolveStatGrid, personaLayout, positioningLayout, posHeadBox, posBodyBox, systemLayout, relationLayout, relationZones, relationIsPartition, dialogueLayout, testimonialLayout } = require("../graphics/diagrams.js");

function effectiveWidth(rawIn, { bullet = false } = {}) {
  return rawIn * EFFECTIVE_FACTOR - (bullet ? BULLET_INDENT_IN : 0);
}

// The emphasized (protagonist) flow/cycle node is DRAWN one size step up
// (emphSizePt in generate.js — peak opens one more); the floor must measure
// and height-gate that node at the same size, or the gate would pass a label
// the engine actually overflows. Non-emphasized elements return base unchanged.
function emphNodeSize(slide, i, basePt) {
  const c = slide.content || {};
  return Number.isInteger(c.emphasis) && c.emphasis === i ? emphSizePt(basePt, slide.peak === true) : basePt;
}

/* ============================================================
 *  Height-overflow geometry (card-overflow gate)
 *
 *  A multi-line PROSE field inside a BOUNDED CARD can render taller than the
 *  card and spill its last lines below the card's bottom edge — a real break
 *  (text outside its container), not a cosmetic one. Width-wrapping (above)
 *  tells us the LINE COUNT; this section tells us the card's INNER HEIGHT. The
 *  gate (design-lint's OVERFLOW check) just crosses the two.
 *
 *  Each box below is a single richText() field sitting in a card, with:
 *    topY      the y (in) where the field's text box starts (from generate.js)
 *    bottomY   the y (in) of the card's bottom edge (cardY + cardH)
 *  The available height is (bottomY - topY); the rendered height is
 *  lineCount * (sizePt * leading / 72). We flag ERROR when rendered exceeds
 *  available * OVERFLOW_SAFETY.
 *
 *  OVERFLOW_SAFETY (the one calibration knob): we do NOT allow "fits exactly."
 *  Line height is renderer-dependent — this is calibrated to the soffice/Yu
 *  Gothic proxy (line box = leading * fontSize, which matches what qa.sh
 *  renders), and real PowerPoint's Yu Gothic line height can run slightly
 *  taller, so a field that touches the card edge in soffice may spill on a
 *  real machine. Reserving 8% (0.92) as bottom padding absorbs that jitter —
 *  the same reasoning as the orphan <=3 threshold. Lower this constant (e.g.
 *  0.88) if real-machine testing shows PowerPoint overflowing where the gate
 *  passed; raise it toward 0.95 if it proves too eager. Keep it here, one place.
 *
 *  These y-coordinates DUPLICATE the card geometry in bin/generate.js (the
 *  source of truth). If a card's y/height changes there, update it here too —
 *  same contract as wrappingFields() above.
 * ============================================================ */
const OVERFLOW_SAFETY = 0.92;

// Rendered height (in) of `nLines` at `sizePt` with `leading` multiple. The
// soffice/CSS line box is leading*fontSize (see qa.sh / measure.js renderPng).
function renderedHeightIn(nLines, sizePt, leading) {
  return (nLines * sizePt * leading) / 72;
}

// The height-constrained card fields, per pattern. Only single richText()
// fields inside a bounded card (which bake to explicit line arrays, so their
// line count is statically visible in a baked plan). Comparison's native-bullet
// points are deliberately NOT here: they render as typed bullets (not richText),
// don't bake to line arrays, and would need a builder change to height-check —
// tracked as a follow-up. Open boxes with no card behind them (two-column item
// bodies, message caption, section/cover subtitles) can't "overflow a card" and
// are out of scope by design.
// dialogue: pair every content speaker with its layout row (plain or compare)
function dialoguePairs(c, T) {
  const L = dialogueLayout(T, c);
  const pairs = [];
  if (L.form === "compare") {
    L.cols.forEach((col, ci) => col.speakers.forEach((row, i) => {
      const sp = ((c.columns[ci] || {}).speakers || [])[i];
      if (sp) pairs.push({ sp, row, path: `columns[${ci}].speakers[${i}].quote` });
    }));
  } else {
    L.speakers.forEach((row, i) => {
      const sp = (c.speakers || [])[i];
      if (sp) pairs.push({ sp, row, path: `speakers[${i}].quote` });
    });
  }
  return pairs;
}

function heightBoxes(slide, T) {
  const c = slide.content || {};
  const s = T.s, lead = T.lead;
  const out = [];
  // TITLE height box: an enlarged heading that wraps to 2+ lines must not run
  // past where the slide body starts (topY = title y, bottomY = first content
  // below). Geometry mirrors the title() calls in generate.js; sizes track the
  // theme, so a bigger heading (ad-hoc) is caught before it collides.
  const sT = s.sectionTitle || s.title;
  const TITLE_BOX = {
    "two-column": { topY: 1.15, bottomY: 2.55, sizePt: s.title },
    "comparison": { topY: 1.15, bottomY: 2.5, sizePt: s.title },
    "chart":      { topY: 1.15, bottomY: 2.2, sizePt: s.title },
    "section":    { topY: 3.5, bottomY: 4.85, sizePt: sT },
    "stat-grid":  { topY: 1.15, bottomY: 2.7, sizePt: s.title },
    "table":      { topY: 1.15, bottomY: 2.25, sizePt: s.title },
    "flow":       { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "cycle":      { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "matrix":     { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "timeline":   { topY: 1.15, bottomY: 2.85, sizePt: s.title },
    "steps":      { topY: 1.15, bottomY: 3.4, sizePt: s.title },
    "branch":     { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "formula":    { topY: 1.15, bottomY: 3.65, sizePt: s.title },
    "card-grid":  { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "waterfall":  { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "identity":   { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "positioning":{ topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "system":     { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "relation":   { topY: 1.15, bottomY: 2.45, sizePt: s.title },
    "before-after":{ topY: 1.15, bottomY: 2.5, sizePt: s.title },
  };
  const tb = TITLE_BOX[slide.pattern];
  if (tb && c.title) out.push({ id: "title header", path: "title", topY: tb.topY, bottomY: tb.bottomY, sizePt: tb.sizePt, leading: lead.title });
  // persona quote is bounded by its bubble (sized from the estimated line
  // count) — if the bake produces MORE lines than estimated, the gate errors
  // and the author shortens the quote.
  if (c.persona && typeof c.persona === "object" && c.persona.quote && (slide.pattern === "message" || slide.pattern === "two-column")) {
    const L = personaLayout(c.persona, T, slide.pattern);
    out.push({ id: "persona bubble", path: "persona.quote", topY: L.quote.y, bottomY: L.quote.y + L.quote.h + 0.06,
      sizePt: L.quotePt, leading: L.quoteLead });
  }
  if (slide.pattern === "dialogue") {
    for (const { row, path } of dialoguePairs(c, T)) {
      out.push({ id: "dialogue bubble", path, topY: row.quote.y, bottomY: row.quote.y + row.quote.h + 0.06,
        sizePt: row.quotePt, leading: T.lead.tight });
    }
  }
  if (slide.pattern === "testimonial") {
    const L = testimonialLayout(T, c);
    L.cards.forEach((cd, i) => {
      if ((c.items || [])[i]) out.push({ id: "testimonial card", path: `items[${i}].body`,
        topY: cd.body.y, bottomY: cd.body.y + cd.body.h, sizePt: T.s.small, leading: T.lead.body });
    });
  }
  switch (slide.pattern) {
    case "chart":
      // takeaway card: card(cx, 2.4, cw, 3.85) -> bottom 6.25; body box y=3.78.
      out.push({ id: "takeaway card", path: "takeaway", topY: 3.78, bottomY: 2.4 + 3.85,
        sizePt: s.body, leading: lead.body });
      break;
    case "flow": {
      // each flow node: the label must fit its node's inner box (overflow => a
      // hard error, exactly like a card). Same geometry the engine draws; the
      // emphasized node is gated at its stepped-up size (emphNodeSize).
      const steps = c.steps || [];
      const { nodes } = flowLayout(T, steps.length, c.direction);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        const ntb = nodeTextBox(nodes[i]);
        out.push({ id: `flow node ${i + 1}`, path: `steps[${i}]`, topY: ntb.y, bottomY: ntb.y + ntb.h,
          sizePt: emphNodeSize(slide, i, s.head), leading: lead.tight });
      });
      break;
    }
    case "cycle": {
      const steps = c.steps || [];
      const { nodes } = cycleLayout(T, steps.length);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        const ntb = nodeTextBox(nodes[i]);
        out.push({ id: `cycle node ${i + 1}`, path: `steps[${i}]`, topY: ntb.y, bottomY: ntb.y + ntb.h,
          sizePt: emphNodeSize(slide, i, s.head), leading: lead.tight });
      });
      break;
    }
    case "steps": {
      // each stage block is a bounded cell; the FIRST (shortest) block binds.
      const steps = c.steps || [];
      const { nodes } = stepsLayout(T, steps.length);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        const ntb = nodeTextBox(nodes[i]);
        out.push({ id: `steps stage ${i + 1}`, path: `steps[${i}]`, topY: ntb.y, bottomY: ntb.y + ntb.h,
          sizePt: s.head, leading: lead.tight });
      });
      break;
    }
    case "branch": {
      const branches = c.branches || [];
      const L = branchLayout(T, branches.length, c.direction);
      if (c.source) {
        const stb = nodeTextBox(L.single);
        out.push({ id: "branch source", path: "source", topY: stb.y, bottomY: stb.y + stb.h,
          sizePt: s.head, leading: lead.tight });
      }
      branches.forEach((b, i) => {
        if (!L.many[i]) return;
        const ntb = nodeTextBox(L.many[i]);
        out.push({ id: `branch node ${i + 1}`, path: `branches[${i}]`, topY: ntb.y, bottomY: ntb.y + ntb.h,
          sizePt: s.head, leading: lead.tight });
      });
      break;
    }
    case "formula": {
      const operands = c.operands || [];
      const L = formulaLayout(T, operands.length, !!c.result);
      const paths = c.result ? ["result", ...operands.map((o, i) => `operands[${i}]`)]
                             : operands.map((o, i) => `operands[${i}]`);
      L.nodes.forEach((node, i) => {
        const ntb = nodeTextBox(node);
        out.push({ id: `formula box ${i + 1}`, path: paths[i], topY: ntb.y, bottomY: ntb.y + ntb.h,
          sizePt: s.head, leading: lead.tight });
      });
      break;
    }
    case "identity": {
      // whole + every part label baked (kinsoku) + height-gated per box — a
      // proportional thin slice that cannot hold its label is a hard overflow
      // (the author shortens the label or moves the point to notes).
      const parts = c.parts || [];
      const L = identityLayout(T, parts);
      if (c.left && c.left.label) {
        const ltb = nodeTextBox(L.left);
        out.push({ id: "identity whole", path: "left.label", topY: ltb.y, bottomY: ltb.y + ltb.h,
          sizePt: s.head, leading: lead.tight });
      }
      parts.forEach((p, i) => {
        const ntb = nodeTextBox(L.parts[i]);
        out.push({ id: `identity part ${i + 1}`, path: `parts[${i}].label`, topY: ntb.y, bottomY: ntb.y + ntb.h,
          sizePt: s.head, leading: lead.tight });
      });
      break;
    }
    case "waterfall": {
      // category labels live in a fixed band under the plot; a label that wraps
      // past the band is a hard overflow (value labels are engine-formatted).
      const items = c.items || [];
      const L = waterfallLayout(T, items);
      items.forEach((it, i) => {
        if (!it || !it.label || !L.catBoxes[i]) return;
        const cb = L.catBoxes[i];
        out.push({ id: `waterfall label ${i + 1}`, path: `items[${i}].label`,
          topY: cb.y, bottomY: cb.y + cb.h, sizePt: s.small, leading: lead.tight });
      });
      break;
    }
    case "matrix": {
      // each quadrant is a bounded cell (like a card): its body must fit. X-axis
      // labels sit in a short top band, so a 2-line axis label overflows -> ERROR.
      const L = matrixLayout(T);
      (c.quadrants || []).slice(0, 4).forEach((qd, i) => {
        if (!qd || !qd.body || !L.quads[i]) return;
        const bb = quadBodyBox(L.quads[i], !!qd.head);
        out.push({ id: `matrix quadrant ${i + 1}`, path: `quadrants[${i}].body`, topY: bb.y, bottomY: bb.y + bb.h,
          sizePt: s.small, leading: lead.tight });
      });
      (c.axisX || []).slice(0, 2).forEach((t, i) => {
        if (!t) return; const b = L.xLabelBoxes[i];
        out.push({ id: `matrix X-axis label ${i + 1}`, path: `axisX[${i}]`, topY: b.y, bottomY: b.y + b.h,
          sizePt: s.small, leading: lead.tight });
      });
      break;
    }
    case "timeline": {
      // each milestone: the label box is bounded (like a card) and the DATE band
      // is a fixed short strip — a date that wraps to 2 lines is a hard overflow,
      // not a silent collision with the spine.
      const ms = c.milestones || [];
      const L = timelineLayout(T, ms.length);
      ms.forEach((m, i) => {
        const g = L.milestones[i]; if (!g || !m) return;
        if (m.label) out.push({ id: `timeline label ${i + 1}`, path: `milestones[${i}].label`,
          topY: g.labelBox.y, bottomY: g.labelBox.y + g.labelBox.h, sizePt: s.small, leading: lead.tight });
        if (m.date) out.push({ id: `timeline date ${i + 1}`, path: `milestones[${i}].date`,
          topY: g.dateBox.y, bottomY: g.dateBox.y + g.dateBox.h, sizePt: s.head, leading: lead.title });
      });
      break;
    }
    case "positioning": {
      const L = positioningLayout(T, (c.positions || []).length);
      (c.positions || []).forEach((ps, i) => {
        const cd = L.cards[i]; if (!cd || !ps) return;
        const hb = posHeadBox(cd), bb = posBodyBox(cd);
        if (ps.head) out.push({ id: `positioning head ${i + 1}`, path: `positions[${i}].head`, topY: hb.y, bottomY: hb.y + hb.h, sizePt: s.compareLabel, leading: lead.title });
        if (ps.body) out.push({ id: `positioning body ${i + 1}`, path: `positions[${i}].body`, topY: bb.y, bottomY: bb.y + bb.h, sizePt: s.body, leading: lead.tight });
      });
      break;
    }
    case "system": {
      const L = systemLayout(T, (c.nodes || []).length, c.links);
      (c.nodes || []).forEach((nd, i) => {
        const node = L.nodes[i]; if (!node) return;
        const ntb = nodeTextBox(node);
        out.push({ id: `system node ${i + 1}`, path: `nodes[${i}]`, topY: ntb.y, bottomY: ntb.y + ntb.h, sizePt: s.head, leading: lead.tight });
      });
      (c.links || []).forEach((lk, k) => {
        if (!lk || !lk.label) return;
        const box = (lk.to === lk.from + 1 ? L.fwd : L.back).find((a) => a.label === lk.label);
        if (box) out.push({ id: `system link label ${k + 1}`, path: `links[${k}].label`, topY: box.labelBox.y, bottomY: box.labelBox.y + box.labelBox.h, sizePt: s.small, leading: lead.tight });
      });
      break;
    }
    case "relation": {
      const nL = (c.left || []).length, nR = (c.right || []).length;
      if (relationIsPartition(nL, nR, c.links)) {
        const Z = relationZones(T, nL, nR, c.links);
        (c.left || []).forEach((it, i) => {
          const zh = Z.zones[i] && Z.zones[i].head; if (!zh) return;
          out.push({ id: `relation zone head ${i + 1}`, path: `left[${i}]`, topY: zh.y, bottomY: zh.y + zh.h, sizePt: s.compareLabel, leading: lead.tight });
        });
        (c.right || []).forEach((it, j) => {
          const b = Z.memberBoxes[j]; if (!b) return;
          const tb = nodeTextBox(b);
          out.push({ id: `relation member ${j + 1}`, path: `right[${j}]`, topY: tb.y, bottomY: tb.y + tb.h, sizePt: s.head, leading: lead.tight });
        });
        break;
      }
      const L = relationLayout(T, nL, nR, c.links);
      (c.left || []).forEach((it, i) => {
        const b = L.left[i]; if (!b) return;
        const tb = nodeTextBox(b);
        out.push({ id: `relation left ${i + 1}`, path: `left[${i}]`, topY: tb.y, bottomY: tb.y + tb.h, sizePt: s.head, leading: lead.tight });
      });
      (c.right || []).forEach((it, j) => {
        const b = L.right[j]; if (!b) return;
        const tb = nodeTextBox(b);
        out.push({ id: `relation right ${j + 1}`, path: `right[${j}]`, topY: tb.y, bottomY: tb.y + tb.h, sizePt: s.head, leading: lead.tight });
      });
      break;
    }
    case "before-after": {
      const top = 2.5, h = 3.95;
      for (const side of ["before", "after"]) {
        const panel = c[side];
        if (panel && panel.body) out.push({ id: `${side} panel`, path: `${side}.body`, topY: top + 1.15, bottomY: top + h - 0.3, sizePt: s.body, leading: lead.body });
      }
      break;
    }
    case "cta":
      // offer panel: roundRect(px, 4.25, pw, 1.85) -> bottom 6.10; body box y=py+0.95=5.20.
      out.push({ id: "offer panel", path: "offerBody", topY: 4.25 + 0.95, bottomY: 4.25 + 1.85,
        sizePt: s.small, leading: lead.tight });
      break;
    case "stat-grid": {
      // each card: card(x, 2.7, w, 3.45) -> bottom 6.15; sub box y=top+2.32=5.02.
      (c.stats || []).forEach((st, i) => {
        if (st && st.sub) out.push({ id: `stat card ${i + 1}`, path: `stats[${i}].sub`,
          topY: 2.7 + 2.32, bottomY: 2.7 + 3.45, sizePt: s.small, leading: lead.tight });
      });
      break;
    }
    case "card-grid": {
      // DUPLICATES generate.js cardGridCell (top 2.45, rowGap 0.3; 3 cards =
      // one tall 1x3 row, 4-6 = the 2-row grid of cardH 1.825; a closing shaves
      // the card height; a label pushes head/body down 0.4). Head band is short
      // on purpose: a 2-line head is a hard OVERFLOW (heads are terms).
      const cards = c.cards || [];
      const n = Math.max(cards.length, 1);
      const singleRow = n === 3;
      const cols = singleRow ? 3 : Math.ceil(n / 2);
      const cardH = singleRow ? (c.closing ? 2.55 : 3.2) : (c.closing ? 1.825 - 0.22 : 1.825);
      cards.forEach((cd, i) => {
        if (!cd) return;
        const row = singleRow ? 0 : Math.floor(i / cols);
        const cy = 2.45 + row * (cardH + 0.3);
        const labelOff = (cd.label != null && String(cd.label) !== "") ? 0.4 : 0;
        if (cd.head) out.push({ id: `card-grid head ${i + 1}`, path: `cards[${i}].head`,
          topY: cy + 0.16 + labelOff, bottomY: cy + 0.16 + labelOff + 0.44, sizePt: s.head, leading: lead.tight });
        if (cd.body) out.push({ id: `card-grid body ${i + 1}`, path: `cards[${i}].body`,
          topY: cy + 0.66 + labelOff, bottomY: cy + cardH - 0.16, sizePt: s.small, leading: lead.tight });
      });
      break;
    }
    default:
      break;
  }
  // NOTE: `closing` lines are AUTHOR-CONTROLLED single lines (same contract as
  // messageLines / cover titleLines) — not floor-measured; design-lint enforces
  // a static length cap and the visual QA loop catches the rest.
  return out;
}

// Verdict for one box given its rendered line count. `over` is the hard-fail
// signal; `pct` is rendered/available (so 1.08 = "108% of card inner height",
// and anything above OVERFLOW_SAFETY fails).
function boxVerdict(box, nLines) {
  const avail = box.bottomY - box.topY;
  const rendered = renderedHeightIn(nLines, box.sizePt, box.leading);
  const pct = avail > 0 ? rendered / avail : Infinity;
  return { over: pct > OVERFLOW_SAFETY, pct, rendered, avail, nLines, safety: OVERFLOW_SAFETY };
}

// Returns [{ path, text, widthIn (raw box), sizePt, role, leading, bullet }].
// Only string fields (auto-wrap candidates); array (already-baked) fields are skipped.
function wrappingFields(slide, T) {
  const c = slide.content || {};
  const W = T.W, m = T.m, s = T.s, lead = T.lead;
  const out = [];
  const push = (path, val, widthIn, sizePt, role, leading, bullet = false) => {
    if (typeof val === "string" && val.trim()) {
      out.push({ path, text: val, baked: false, widthIn, sizePt, role, leading, bullet });
    } else if (Array.isArray(val) && val.length) {
      // already baked into explicit lines — surfaced so typo-lint can validate it
      out.push({ path, lines: val, baked: true, widthIn, sizePt, role, leading, bullet });
    }
  };
  // The auto-wrapping heading string (`title`) per pattern that uses one — its
  // box width matches the title() call in generate.js. cover/cta use author-
  // controlled `titleLines` ARRAYS (already broken by hand), so they are not
  // here. A heading is measured at role "heading" (Yu Gothic bold) + lead.title.
  const sectionTitleSize = s.sectionTitle || s.title;
  const TITLE_W = { "two-column": 7.0, "comparison": W - 2 * m, "chart": 8.5,
    "section": 8.0, "stat-grid": W - 2 * m, "table": W - 2 * m, "flow": W - 2 * m, "cycle": W - 2 * m, "matrix": W - 2 * m, "timeline": W - 2 * m, "steps": W - 2 * m, "branch": W - 2 * m, "formula": W - 2 * m, "card-grid": W - 2 * m, "waterfall": W - 2 * m, "positioning": W - 2 * m, "system": W - 2 * m, "relation": W - 2 * m, "before-after": W - 2 * m };
  if (TITLE_W[slide.pattern] != null) {
    const size = slide.pattern === "section" ? sectionTitleSize : s.title;
    push("title", c.title, TITLE_W[slide.pattern], size, "heading", lead.title);
  }
  // persona quote (education register): native text over the bubble raster —
  // measured at the bubble's inner width so bake protects kinsoku + number
  // atoms exactly like any prose field.
  if (slide.pattern === "dialogue") {
    for (const { sp, row, path } of dialoguePairs(c, T)) {
      push(path, sp.quote, row.quote.w, row.quotePt, "body", T.lead.tight);
    }
  }
  if (slide.pattern === "testimonial") {
    const L = testimonialLayout(T, c);
    L.cards.forEach((cd, i) => {
      const it = (c.items || [])[i];
      if (it && it.body) push(`items[${i}].body`, it.body, cd.body.w, T.s.small, "body", T.lead.body);
    });
  }
  if (c.persona && typeof c.persona === "object" && (slide.pattern === "message" || slide.pattern === "two-column")) {
    const L = personaLayout(c.persona, T, slide.pattern);
    push("persona.quote", c.persona.quote, L.quote.w, L.quotePt, "body", L.quoteLead);
  }
  switch (slide.pattern) {
    case "message":
      push("statCaption", c.statCaption, W - 5.2, s.small, "caption", lead.caption);
      break;
    case "flow": {
      // each step label is centered native text inside its node — measured at the
      // node's inner box so kinsoku/orphan apply per node (same geometry the
      // engine draws with; the emphasized node measures at its stepped-up size).
      const steps = c.steps || [];
      const { nodes } = flowLayout(T, steps.length, c.direction);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        push(`steps[${i}]`, st, nodeTextBox(nodes[i]).w, emphNodeSize(slide, i, s.head), "heading", lead.tight);
      });
      break;
    }
    case "cycle": {
      const steps = c.steps || [];
      const { nodes } = cycleLayout(T, steps.length);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        push(`steps[${i}]`, st, nodeTextBox(nodes[i]).w, emphNodeSize(slide, i, s.head), "heading", lead.tight);
      });
      break;
    }
    case "steps": {
      const steps = c.steps || [];
      const { nodes } = stepsLayout(T, steps.length);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        push(`steps[${i}]`, st, nodeTextBox(nodes[i]).w, s.head, "heading", lead.tight);
      });
      break;
    }
    case "branch": {
      const branches = c.branches || [];
      const L = branchLayout(T, branches.length, c.direction);
      push("source", c.source, nodeTextBox(L.single).w, s.head, "heading", lead.tight);
      branches.forEach((b, i) => {
        if (!L.many[i]) return;
        push(`branches[${i}]`, b, nodeTextBox(L.many[i]).w, s.head, "heading", lead.tight);
      });
      break;
    }
    case "formula": {
      const operands = c.operands || [];
      const L = formulaLayout(T, operands.length, !!c.result);
      const paths = c.result ? ["result", ...operands.map((o, i) => `operands[${i}]`)]
                             : operands.map((o, i) => `operands[${i}]`);
      const vals = c.result ? [c.result, ...operands] : operands;
      L.nodes.forEach((node, i) => {
        push(paths[i], vals[i], nodeTextBox(node).w, s.head, "heading", lead.tight);
      });
      break;
    }
    case "waterfall": {
      const items = c.items || [];
      const L = waterfallLayout(T, items);
      items.forEach((it, i) => {
        if (!it || !L.catBoxes[i]) return;
        push(`items[${i}].label`, it.label, L.catBoxes[i].w, s.small, "caption", lead.tight);
      });
      break;
    }
    case "matrix": {
      // each quadrant body is measured at its inner cell width (kinsoku per cell);
      // X-axis labels are measured too so a too-long axis label is caught.
      const L = matrixLayout(T);
      (c.quadrants || []).slice(0, 4).forEach((qd, i) => {
        if (!qd || !qd.body || !L.quads[i]) return;
        push(`quadrants[${i}].body`, qd.body, quadBodyBox(L.quads[i], !!qd.head).w, s.small, "body", lead.tight);
      });
      (c.axisX || []).slice(0, 2).forEach((t, i) => {
        if (t) push(`axisX[${i}]`, t, L.xLabelBoxes[i].w, s.small, "caption", lead.tight);
      });
      break;
    }
    case "timeline": {
      // labels + dates measured at their real (alternating) boxes — kinsoku/orphan
      // per milestone; multi-line results bake to arrays so the height gate can
      // count them statically.
      const ms = c.milestones || [];
      const L = timelineLayout(T, ms.length);
      ms.forEach((m, i) => {
        const g = L.milestones[i]; if (!g || !m) return;
        push(`milestones[${i}].label`, m.label, g.labelBox.w, s.small, "body", lead.tight);
        push(`milestones[${i}].date`, m.date, g.dateBox.w, s.head, "heading", lead.title);
      });
      break;
    }
    case "two-column":
      push("lead", c.lead, 5.0, s.body, "body", lead.body);
      (c.items || []).forEach((it, i) =>
        push(`items[${i}].body`, it.body, (W - m - 6.45) - 0.66, s.small, "body", lead.tight));
      break;
    case "comparison": {
      const w = (W - 2 * m - 0.5) / 2, tw = w - 2 * 0.5;
      ["left", "right"].forEach((side) => {
        const col = c[side];
        if (!col) return;
        (col.points || []).forEach((p, i) =>
          push(`${side}.points[${i}]`, p, tw, s.body, "body", lead.tight, true));
      });
      break;
    }
    case "chart": {
      const cw = (W - m - 8.55) - 0.84;
      push("takeawayHead", c.takeawayHead, cw, s.takeawayHead, "heading", lead.title);
      push("takeaway", c.takeaway, cw, s.body, "body", lead.body);
      break;
    }
    case "positioning": {
      const L = positioningLayout(T, (c.positions || []).length);
      (c.positions || []).forEach((ps, i) => {
        const cd = L.cards[i]; if (!cd || !ps) return;
        push(`positions[${i}].head`, ps.head, posHeadBox(cd).w, s.compareLabel, "heading", lead.title);
        push(`positions[${i}].body`, ps.body, posBodyBox(cd).w, s.body, "body", lead.tight);
      });
      break;
    }
    case "system": {
      const L = systemLayout(T, (c.nodes || []).length, c.links);
      (c.nodes || []).forEach((nd, i) => {
        if (!L.nodes[i]) return;
        push(`nodes[${i}]`, nd, nodeTextBox(L.nodes[i]).w, s.head, "heading", lead.tight);
      });
      (c.links || []).forEach((lk, k) => {
        if (!lk || !lk.label) return;
        const box = (lk.to === lk.from + 1 ? L.fwd : L.back).find((a) => a.label === lk.label);
        if (box) push(`links[${k}].label`, lk.label, box.labelBox.w, s.small, "caption", lead.tight);
      });
      break;
    }
    case "relation": {
      const nL = (c.left || []).length, nR = (c.right || []).length;
      if (relationIsPartition(nL, nR, c.links)) {
        const Z = relationZones(T, nL, nR, c.links);
        (c.left || []).forEach((it, i) => { const zh = Z.zones[i] && Z.zones[i].head; if (zh) push(`left[${i}]`, it, zh.w, s.compareLabel, "heading", lead.tight); });
        (c.right || []).forEach((it, j) => { if (Z.memberBoxes[j]) push(`right[${j}]`, it, nodeTextBox(Z.memberBoxes[j]).w, s.head, "heading", lead.tight); });
        break;
      }
      const L = relationLayout(T, nL, nR, c.links);
      (c.left || []).forEach((it, i) => { if (L.left[i]) push(`left[${i}]`, it, nodeTextBox(L.left[i]).w, s.head, "heading", lead.tight); });
      (c.right || []).forEach((it, j) => { if (L.right[j]) push(`right[${j}]`, it, nodeTextBox(L.right[j]).w, s.head, "heading", lead.tight); });
      break;
    }
    case "before-after": {
      const top = 2.5, arrowW = 1.0;
      const w = (W - 2 * m - arrowW - 0.5) / 2;
      for (const side of ["before", "after"]) {
        const panel = c[side]; if (!panel) continue;
        push(`${side}.label`, panel.label, w - 0.9, s.compareLabel, "heading", lead.title);
        push(`${side}.body`, panel.body, w - 0.9, s.body, "body", lead.body);
      }
      break;
    }
    case "cta":
      push("offerBody", c.offerBody, 8.7 - 1, s.small, "body", lead.tight);
      break;
    case "section":
      push("subtitle", c.subtitle, 8.0, s.coverSub, "body", lead.tight);
      break;
    case "stat-grid": {
      // widths follow the AREA-emphasis cells (protagonist wide, others narrow)
      // so kinsoku/orphan predictions match what the engine actually draws.
      const stats = c.stats || [], n = Math.max(stats.length, 1);
      const eIdx = Number.isInteger(c.emphasis) ? c.emphasis : -1;
      const { cells } = resolveStatGrid(T, stats, eIdx);
      stats.forEach((st, i) => {
        if (!cells[i]) return;
        push(`stats[${i}].sub`, st.sub, cells[i].w - 0.8, s.small, "body", lead.tight);
      });
      break;
    }
    case "card-grid": {
      // width mirrors generate.js cardGridCell: 3 cards = 1x3, else ceil(n/2) cols.
      const cards = c.cards || [], n = Math.max(cards.length, 1);
      const cols = n === 3 ? 3 : Math.ceil(n / 2);
      const cardW = ((W - 2 * m) - (cols - 1) * 0.4) / cols;
      cards.forEach((cd, i) => {
        if (!cd) return;
        push(`cards[${i}].head`, cd.head, cardW - 0.6, s.head, "heading", lead.tight);
        push(`cards[${i}].body`, cd.body, cardW - 0.6, s.small, "body", lead.tight);
      });
      break;
    }
    case "cover":
      push("subtitle", c.subtitle, 9.5, s.coverSub, "body", lead.caption);
      break;
    default:
      break;
  }
  return out;
}

module.exports = {
  wrappingFields, effectiveWidth, EFFECTIVE_FACTOR, BULLET_INDENT_IN,
  heightBoxes, boxVerdict, renderedHeightIn, OVERFLOW_SAFETY,
};
