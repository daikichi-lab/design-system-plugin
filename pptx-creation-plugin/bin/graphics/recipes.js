"use strict";
/* ============================================================
 *  bin/graphics/recipes.js — code-drawn SVG recipes (Phase C, spec 1b)
 *
 *  Every recipe is a pure function (theme, opts) -> SVG string. ALL colour comes
 *  from theme tokens (T.c.*), so a graphic can never drift from the native
 *  text/cards drawn over it. No raster art, no external images, no photography
 *  (M-7) — gradients / geometry / feTurbulence grain only.
 *
 *  Kinds (spec 1b), documented in references/graphics/svg-recipes.md:
 *    (a) backgrounds — `atmosphere` (full-bleed opaque, for a cover `bg`)
 *    (b) icons       — `icon` (one consistent line family, for an `icon` slot)
 *    (c) motifs      — `motif` (corner decoration, for a `bgMotif` slot)
 *    (d) patterns    — `pattern` (faint full-bleed ground, for a `bgPattern` slot)
 *
 *  Consistency is a contract: every `icon` shares ONE viewBox (24), stroke width
 *  (ICON_STROKE), and cap/join, so a set of them passes image-lint's icon-set
 *  check. Motifs stay in the TOP-RIGHT region so they clear the usual left text
 *  column (image-lint's motif-intrude check enforces it). Patterns are faint
 *  enough (low alpha) that they never dent text contrast.
 * ============================================================ */

const hx = (c) => "#" + String(c).replace(/^#/, "");
const ICON_STROKE = 1.6; // one weight for the whole family (icon-set consistency)

/* (a) BACKGROUND — atmosphere: dark base + a soft accent glow + fine grain +
 * a FEATHERED scrim on the text side (baked into the SVG so the scrim edge is
 * soft by construction — no hard rectangle in the pptx). `variant` picks the
 * scrim side: "left" (default), "bottom", or "none". */
function atmosphere(T, { w = 1280, h = 720, variant = "left", grain = false } = {}) {
  const c = T.c;
  // Grain (feTurbulence) is OFF by default: full-canvas noise is incompressible
  // and blows the PNG up ~30x (3.3MB vs ~0.1MB) for a barely-visible texture.
  // Opt in with grain:true only when you accept the weight (image-lint flags it).
  const grainDef = grain
    ? `<filter id="grain" x="0" y="0" width="100%" height="100%">
         <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
         <feColorMatrix in="n" type="saturate" values="0"/>
         <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
       </filter>` : "";
  const grainRect = grain ? `<rect width="100%" height="100%" filter="url(#grain)"/>` : "";
  const scrim =
    variant === "none" ? "" :
    variant === "bottom"
      ? `<linearGradient id="scrim" x1="0" y1="1" x2="0" y2="0">
           <stop offset="0%" stop-color="${hx(c.dark)}" stop-opacity="0.88"/>
           <stop offset="55%" stop-color="${hx(c.dark)}" stop-opacity="0"/>
         </linearGradient>`
      : `<linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
           <stop offset="0%" stop-color="${hx(c.dark)}" stop-opacity="0.9"/>
           <stop offset="58%" stop-color="${hx(c.dark)}" stop-opacity="0"/>
         </linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="glow" cx="80%" cy="26%" r="62%">
      <stop offset="0%"  stop-color="${hx(c.accent)}"  stop-opacity="0.50"/>
      <stop offset="45%" stop-color="${hx(c.accentDp)}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${hx(c.darkAlt)}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${hx(c.dark)}"/>
      <stop offset="100%" stop-color="${hx(c.darkAlt)}"/>
    </linearGradient>
    ${grainDef}
    ${scrim}
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  ${grainRect}
  ${variant === "none" ? "" : `<rect width="100%" height="100%" fill="url(#scrim)"/>`}
</svg>`;
}

/* (b) ICONS — a consistent line family (24x24 viewBox, one stroke weight, round
 * cap/join, no fill). A supporting bystander beside a stat/number (M-8: figure
 * SVG, number native). Grow the map; keep every glyph line-only at this weight so
 * a set stays uniform. */
const ICONS = {
  // growth & finance
  trend:    `<polyline points="4,17 10,11 14,14 20,6"/><polyline points="15,6 20,6 20,11"/>`,
  growth:   `<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="13" width="3" height="6" rx="0.6"/><rect x="11" y="9" width="3" height="10" rx="0.6"/><rect x="16" y="5" width="3" height="14" rx="0.6"/>`,
  coin:     `<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 010 3H10a1.5 1.5 0 000 3h4"/>`,
  pie:      `<circle cx="12" cy="12" r="8"/><path d="M12 12V4M12 12l6.9 4"/>`,
  barchart: `<path d="M4 4v16h16"/><line x1="8.5" y1="17" x2="8.5" y2="12"/><line x1="12.5" y1="17" x2="12.5" y2="8.5"/><line x1="16.5" y1="17" x2="16.5" y2="10.5"/>`,
  // goals & process
  target:   `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/>`,
  flow:     `<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="12" r="2.4"/><line x1="8.5" y1="12" x2="15.5" y2="12"/>`,
  check:    `<circle cx="12" cy="12" r="8"/><polyline points="8.4,12.4 11,15 15.6,9.4"/>`,
  settings: `<line x1="4" y1="8.5" x2="20" y2="8.5"/><circle cx="9" cy="8.5" r="2.2"/><line x1="4" y1="15.5" x2="20" y2="15.5"/><circle cx="15" cy="15.5" r="2.2"/>`,
  layers:   `<polygon points="12,4 20,8.5 12,13 4,8.5"/><polyline points="4,12 12,16.5 20,12"/>`,
  flag:     `<line x1="7" y1="3.5" x2="7" y2="20.5"/><path d="M7 4.5h10l-2.6 3.5L17 11.5H7z"/>`,
  // people & comms
  people:   `<circle cx="9" cy="9" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M15.5 6.4a3 3 0 010 5.4M20.5 19c0-2.4-1.5-4.3-3.6-4.9"/>`,
  chat:     `<path d="M5 6h14a1 1 0 011 1v8a1 1 0 01-1 1h-9l-4 3v-3H5a1 1 0 01-1-1V7a1 1 0 011-1z"/>`,
  briefcase:`<rect x="4" y="8" width="16" height="11" rx="1.5"/><path d="M9 8V6.2a1 1 0 011-1h4a1 1 0 011 1V8"/><line x1="4" y1="13" x2="20" y2="13"/>`,
  // knowledge & risk
  idea:     `<path d="M12 3.2a5.6 5.6 0 00-3.3 10.1c.6.5.9 1 .9 1.7v.5h4.8v-.5c0-.7.3-1.2.9-1.7A5.6 5.6 0 0012 3.2z"/><line x1="9.8" y1="19" x2="14.2" y2="19"/><line x1="10.6" y1="21" x2="13.4" y2="21"/>`,
  alert:    `<path d="M12 4.2l8.2 14.6H3.8z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="16.4" r="0.45"/>`,
  shield:   `<path d="M12 3.2l7 3v5c0 4.4-3 7.8-7 8.8-4-1-7-4.4-7-8.8v-5z"/><polyline points="9,12 11,14 15,9.6"/>`,
  // objects & time
  document: `<path d="M7 3.2h7l4 4v13.6H7z"/><polyline points="14,3.2 14,7 18,7"/><line x1="9.5" y1="12" x2="15.5" y2="12"/><line x1="9.5" y1="15" x2="15.5" y2="15"/>`,
  clock:    `<circle cx="12" cy="12" r="8"/><polyline points="12,7.5 12,12 15.5,13.8"/>`,
  calendar: `<rect x="4" y="5" width="16" height="15" rx="1.5"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/>`,
  globe:    `<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.4" ry="8"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M6 8h12M6 16h12"/>`,
  search:   `<circle cx="10.5" cy="10.5" r="5.5"/><line x1="14.6" y1="14.6" x2="19" y2="19"/>`,
  star:     `<polygon points="12,4 14.3,9.1 20,9.8 15.9,13.6 17,19.2 12,16.5 7,19.2 8.1,13.6 4,9.8 9.7,9.1"/>`,
  arrowup:  `<circle cx="12" cy="12" r="8"/><polyline points="8.6,12 12,8.6 15.4,12"/><line x1="12" y1="8.6" x2="12" y2="16"/>`,
};

function icon(T, { w = 96, h = 96, variant = "trend", color } = {}) {
  const stroke = hx(color || T.c.accent);
  const p = ICONS[variant] || ICONS.trend;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24">
  <g stroke="${stroke}" stroke-width="${ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none">${p}</g>
</svg>`;
}
const ICON_NAMES = Object.keys(ICONS);

/* (c) MOTIF — a corner decoration for a `bgMotif` slot. Draws only in the
 * TOP-RIGHT region (ink kept at x > ~0.6w) so it clears the usual left text
 * column; the rest is transparent. Accent-family colour only (one hue, tasteful
 * — "simple + refined"), so it can never fight the deck's single accent. */
function motif(T, { w = 1280, h = 720, variant = "confetti" } = {}) {
  const c = T.c;
  const A = hx(c.accent), S = hx(c.accentSft || c.accent), Dp = hx(c.accentDp || c.accent);
  const x = (fx) => Math.round(fx * w), y = (fy) => Math.round(fy * h);
  let body = "";
  if (variant === "confetti") {
    const dots = [
      [0.84, 0.16, 46, A, 0.9], [0.92, 0.30, 30, S, 0.85], [0.75, 0.24, 22, Dp, 0.8],
      [0.88, 0.46, 18, A, 0.85], [0.96, 0.13, 12, S, 0.9], [0.80, 0.40, 10, S, 0.8],
      [0.70, 0.12, 9, A, 0.7], [0.93, 0.42, 8, Dp, 0.8],
    ];
    body = dots.map(([fx, fy, r, col, o]) => `<circle cx="${x(fx)}" cy="${y(fy)}" r="${r}" fill="${col}" opacity="${o}"/>`).join("");
    body += `<circle cx="${x(0.78)}" cy="${y(0.34)}" r="34" fill="none" stroke="${S}" stroke-width="6" opacity="0.75"/>`;
  } else if (variant === "corner-dots") {
    const g = [];
    for (let r = 0; r < 4; r++) for (let col = 0; col < 6; col++) {
      const fx = 0.72 + col * 0.045, fy = 0.08 + r * 0.09;
      const o = 0.7 - (r + (5 - col)) * 0.05;
      g.push(`<circle cx="${x(fx)}" cy="${y(fy)}" r="6" fill="${col % 2 ? S : A}" opacity="${Math.max(0.18, o)}"/>`);
    }
    body = g.join("");
  } else if (variant === "corner-rings") {
    body = [46, 78, 112].map((r, i) =>
      `<circle cx="${x(0.98)}" cy="${y(0.06)}" r="${r}" fill="none" stroke="${i === 1 ? A : S}" stroke-width="${i === 0 ? 10 : 6}" opacity="${0.85 - i * 0.2}"/>`).join("");
  } else if (variant === "arcs") {
    body = [70, 120, 170].map((r, i) =>
      `<path d="M ${x(1) - r} ${y(0)} A ${r} ${r} 0 0 1 ${x(1)} ${y(0) + r}" fill="none" stroke="${i === 1 ? A : S}" stroke-width="${8 - i * 2}" opacity="${0.8 - i * 0.2}"/>`).join("");
  } else if (variant === "blob") {
    body = `<circle cx="${x(1.02)}" cy="${y(0.04)}" r="${Math.round(0.22 * w)}" fill="${A}" opacity="0.14"/>` +
           `<circle cx="${x(0.9)}" cy="${y(0.2)}" r="${Math.round(0.09 * w)}" fill="${S}" opacity="0.18"/>`;
  } else { // triangles
    body = [[0.86, 0.14, 60, A, 0.85], [0.94, 0.30, 40, S, 0.8], [0.78, 0.26, 34, Dp, 0.7]]
      .map(([fx, fy, s, col, o]) => `<polygon points="${x(fx)},${y(fy) - s} ${x(fx) + s * 0.87},${y(fy) + s * 0.5} ${x(fx) - s * 0.87},${y(fy) + s * 0.5}" fill="${col}" opacity="${o}"/>`).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
const MOTIF_NAMES = ["confetti", "corner-dots", "corner-rings", "arcs", "blob", "triangles"];

/* (d) PATTERN — a faint full-bleed ground for a `bgPattern` slot. Low opacity by
 * design so it never dents text contrast (image-lint's motif-intrude passes it
 * because per-pixel alpha stays under the opaque threshold). */
function pattern(T, { w = 1280, h = 720, variant = "dots", color } = {}) {
  const c = T.c;
  const col = hx(color || c.line || c.muted);
  let body = "";
  if (variant === "dots") {
    const g = [];
    for (let yy = 32; yy < h; yy += 44) for (let xx = 32; xx < w; xx += 44) g.push(`<circle cx="${xx}" cy="${yy}" r="2.2"/>`);
    body = `<g fill="${col}" opacity="0.5">${g.join("")}</g>`;
  } else if (variant === "grid") {
    const g = [];
    for (let xx = 48; xx < w; xx += 48) g.push(`<line x1="${xx}" y1="0" x2="${xx}" y2="${h}"/>`);
    for (let yy = 48; yy < h; yy += 48) g.push(`<line x1="0" y1="${yy}" x2="${w}" y2="${yy}"/>`);
    body = `<g stroke="${col}" stroke-width="1" opacity="0.35">${g.join("")}</g>`;
  } else { // diagonal
    const g = [];
    for (let d = -h; d < w; d += 46) g.push(`<line x1="${d}" y1="0" x2="${d + h}" y2="${h}"/>`);
    body = `<g stroke="${col}" stroke-width="1" opacity="0.4">${g.join("")}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
const PATTERN_NAMES = ["dots", "grid", "diagonal"];

module.exports = { atmosphere, icon, motif, pattern, ICONS, ICON_STROKE, ICON_NAMES, MOTIF_NAMES, PATTERN_NAMES };
