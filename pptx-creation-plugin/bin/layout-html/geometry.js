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

// pptx text boxes inset the text; PowerPoint's default is 0.1in per side.
// Computing breaks at (box - this) keeps a baked line inside the real box.
const EFFECTIVE_INSET_IN = 0.2;
const BULLET_INDENT_IN = 14 / 72; // pptxgenjs bullet indent (14pt)

function effectiveWidth(rawIn, { bullet = false } = {}) {
  return rawIn - EFFECTIVE_INSET_IN - (bullet ? BULLET_INDENT_IN : 0);
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
  switch (slide.pattern) {
    case "message":
      push("statCaption", c.statCaption, W - 5.2, s.small, "caption", lead.caption);
      break;
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

module.exports = { wrappingFields, effectiveWidth, EFFECTIVE_INSET_IN, BULLET_INDENT_IN };
