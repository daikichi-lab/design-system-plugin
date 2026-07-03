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
const { flowLayout, cycleLayout, nodeTextBox } = require("../graphics/diagrams.js");

function effectiveWidth(rawIn, { bullet = false } = {}) {
  return rawIn * EFFECTIVE_FACTOR - (bullet ? BULLET_INDENT_IN : 0);
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
  };
  const tb = TITLE_BOX[slide.pattern];
  if (tb && c.title) out.push({ id: "title header", path: "title", topY: tb.topY, bottomY: tb.bottomY, sizePt: tb.sizePt, leading: lead.title });
  switch (slide.pattern) {
    case "chart":
      // takeaway card: card(cx, 2.4, cw, 3.85) -> bottom 6.25; body box y=3.78.
      out.push({ id: "takeaway card", path: "takeaway", topY: 3.78, bottomY: 2.4 + 3.85,
        sizePt: s.body, leading: lead.body });
      break;
    case "flow": {
      // each flow node: the label must fit its node's inner box (overflow => a
      // hard error, exactly like a card). Same geometry the engine draws.
      const steps = c.steps || [];
      const { nodes } = flowLayout(T, steps.length, c.direction);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        const ntb = nodeTextBox(nodes[i]);
        out.push({ id: `flow node ${i + 1}`, path: `steps[${i}]`, topY: ntb.y, bottomY: ntb.y + ntb.h,
          sizePt: s.head, leading: lead.tight });
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
          sizePt: s.head, leading: lead.tight });
      });
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
    default:
      break;
  }
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
    "section": 8.0, "stat-grid": W - 2 * m, "table": W - 2 * m, "flow": W - 2 * m, "cycle": W - 2 * m };
  if (TITLE_W[slide.pattern] != null) {
    const size = slide.pattern === "section" ? sectionTitleSize : s.title;
    push("title", c.title, TITLE_W[slide.pattern], size, "heading", lead.title);
  }
  switch (slide.pattern) {
    case "message":
      push("statCaption", c.statCaption, W - 5.2, s.small, "caption", lead.caption);
      break;
    case "flow": {
      // each step label is centered native text inside its node — measured at the
      // node's inner box so kinsoku/orphan apply per node (same geometry the
      // engine draws with).
      const steps = c.steps || [];
      const { nodes } = flowLayout(T, steps.length, c.direction);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        push(`steps[${i}]`, st, nodeTextBox(nodes[i]).w, s.head, "heading", lead.tight);
      });
      break;
    }
    case "cycle": {
      const steps = c.steps || [];
      const { nodes } = cycleLayout(T, steps.length);
      steps.forEach((st, i) => {
        if (!nodes[i]) return;
        push(`steps[${i}]`, st, nodeTextBox(nodes[i]).w, s.head, "heading", lead.tight);
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
    case "cta":
      push("offerBody", c.offerBody, 8.7 - 1, s.small, "body", lead.tight);
      break;
    case "section":
      push("subtitle", c.subtitle, 8.0, s.coverSub, "body", lead.tight);
      break;
    case "stat-grid": {
      const stats = c.stats || [], n = Math.max(stats.length, 1);
      const cardW = ((W - 2 * m) - (n - 1) * 0.4) / n;
      stats.forEach((st, i) =>
        push(`stats[${i}].sub`, st.sub, cardW - 0.8, s.small, "body", lead.tight));
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
