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

/* (e) EMPHASIS MARKER — markerCircle: a hand-drawn-ish ellipse STROKE the
 * engine overlays on the protagonist number (visual-psychology §2). Two passes
 * of a cubic-arc ellipse whose anchors carry small FIXED jitters (deterministic
 * — same input, same pixels; no Math.random) plus a slight tilt: enough
 * looseness to not read machine-drawn, never scribble-rough. Accent colour
 * token, ~2.5px stroke at placement scale (rasterized 2x, transparent PNG).
 * The CENTRE stays empty by construction — the stroke must never cross the
 * glyph cores (image-lint's MARKER check verifies the asset). */
function markerCircle(T, { w = 300, h = 130, color } = {}) {
  const stroke = hx(color || T.c.accent);
  const cx = w / 2, cy = h / 2;
  const sw = 2.5; // px at 1x (svg-render rasterizes 2x)
  const pad = sw * 2 + 2;
  const rx = w / 2 - pad, ry = h / 2 - pad;
  const k = 0.5523;
  // fixed per-anchor jitter (fractions of ry) — the "hand" in hand-drawn
  const j = [0.06, -0.04, 0.05, -0.06, 0.03, -0.05, 0.045, -0.035].map((f) => f * ry);
  const p = (dx, dy) => `${(cx + dx).toFixed(1)} ${(cy + dy).toFixed(1)}`;
  const ellipsePath = (rx2, ry2, o) => [
    `M ${p(-rx2, j[o % 8])}`,
    `C ${p(-rx2, -ry2 * k + j[(o + 1) % 8])} ${p(-rx2 * k, -ry2 + j[(o + 2) % 8])} ${p(0, -ry2 + j[(o + 3) % 8] * 0.6)}`,
    `C ${p(rx2 * k, -ry2 + j[(o + 4) % 8])} ${p(rx2, -ry2 * k + j[(o + 5) % 8])} ${p(rx2, j[(o + 6) % 8])}`,
    `C ${p(rx2, ry2 * k + j[(o + 7) % 8])} ${p(rx2 * k, ry2 + j[o % 8])} ${p(0, ry2 + j[(o + 1) % 8] * 0.6)}`,
    `C ${p(-rx2 * k, ry2 + j[(o + 2) % 8])} ${p(-rx2, ry2 * k + j[(o + 3) % 8])} ${p(-rx2, j[o % 8])}`,
  ].join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g fill="none" stroke="${stroke}" stroke-linecap="round" transform="rotate(-2 ${cx} ${cy})">
    <path d="${ellipsePath(rx, ry, 0)}" stroke-width="${sw}" opacity="0.95"/>
    <path d="${ellipsePath(rx * 0.985, ry * 0.94, 3)}" stroke-width="${sw * 0.8}" opacity="0.4" transform="rotate(2.5 ${cx} ${cy})"/>
  </g>
</svg>`;
}

/* (f) PERSONA — figureSvg: the in-engine default human figure for the
 * education register (education-register.md §3). Two-colour flat: teal line
 * art + near-white face/shirt, waist-up, frontal. Deterministic (no random),
 * theme-token colours, no AI imagery, no likeness of real people. Pose maps
 * to the content's EMOTION (共感設計):
 *   'concern' — worried hook/problem framing: ハの字 brows, flat mouth, arms
 *               down (gesture-free = safe).
 *   'present' — solution/summary: gentle brows, smile, one hand raised.
 * Individual variation via {hair: short|side|long, jacket: accent|deep|muted,
 * tie: bool}. AESTHETICS (proportions, hand) are a HUMAN-EYE area — the
 * machine only guarantees clean rendering. viewBox 200x280 (w:h = 1:1.4). */
function figureSvg(T, { w = 200, h = 280, pose = "concern", hair = "short", jacket = "accent", tie = true } = {}) {
  const line = hx(T.c.accentDp);
  const face = "#FAFCFC";
  const jacketFill = hx(jacket === "deep" ? T.c.accentDp : jacket === "muted" ? T.c.muted : T.c.accent);
  const sw = 3;
  // hair variants (filled with the line colour — flat two-tone)
  const HAIR = {
    short: `<path d="M60 82 Q62 42 100 40 Q138 42 140 82 Q136 62 124 56 Q112 50 100 50 Q88 50 76 56 Q64 62 60 82 Z" fill="${line}"/>`,
    side: `<path d="M60 86 Q58 42 102 40 Q142 44 140 76 Q124 52 94 54 Q72 58 66 92 Q62 88 60 86 Z" fill="${line}"/>`,
    long: `<path d="M58 78 Q62 40 100 40 Q138 40 142 78 L144 126 Q138 134 131 126 L129 84 Q120 52 100 52 Q80 52 71 84 L69 126 Q62 134 56 126 Z" fill="${line}"/>`,
  };
  // face per pose (worried ハの字 vs gentle + smile)
  const FACE = pose === "present"
    ? `<path d="M80 74 Q86 69 92 72" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>
       <path d="M108 72 Q114 69 120 74" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>
       <circle cx="87" cy="86" r="3.4" fill="${line}"/><circle cx="113" cy="86" r="3.4" fill="${line}"/>
       <path d="M88 102 Q100 112 112 102" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>`
    : `<path d="M80 76 L92 70" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>
       <path d="M120 76 L108 70" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>
       <circle cx="87" cy="88" r="3.4" fill="${line}"/><circle cx="113" cy="88" r="3.4" fill="${line}"/>
       <path d="M91 106 L109 106" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>`;
  // one raised arm (present only) — starts INSIDE the shoulder mass, bends up
  const ARM = pose === "present"
    ? `<path d="M146 202 Q174 176 172 142" fill="none" stroke="${line}" stroke-width="11" stroke-linecap="round"/>
       <circle cx="172" cy="134" r="11" fill="${face}" stroke="${line}" stroke-width="${sw}"/>`
    : "";
  const TIE = tie
    ? `<path d="M100 162 L108 172 L100 208 L92 172 Z" fill="${line}"/>`
    : "";
  // proportions: head bottom (cy88 + r42 = 130) meets the neck (130..156),
  // which meets the collar/shoulders (156..) — no gap (the first render's
  // floating-head defect, fixed and re-checked by eye).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 200 280">
  <!-- neck (behind the head/body) -->
  <path d="M86 122 L114 122 L114 146 L86 146 Z" fill="${face}" stroke="${line}" stroke-width="${sw}"/>
  <!-- body / jacket (waist-up) -->
  <path d="M30 280 Q34 200 60 180 Q76 170 88 164 L100 177 L112 164 Q124 170 140 180 Q166 200 170 280 Z" fill="${jacketFill}"/>
  <!-- shirt V -->
  <path d="M88 164 L100 177 L112 164 L112 142 Q100 150 88 142 Z" fill="${face}"/>
  ${TIE}
  <!-- head -->
  <circle cx="100" cy="88" r="42" fill="${face}" stroke="${line}" stroke-width="${sw}"/>
  ${HAIR[hair] || HAIR.short}
  ${FACE}
  ${ARM}
</svg>`;
}

/* (g) SPEECH BUBBLE — bubbleSvg: ONE seamless path (rounded rect + tail drawn
 * as a single continuous path — no overlap seam), stroke in the accent token,
 * white fill. The native quote text sits ON TOP of the raster (crisp,
 * editable). tailSide 'bottom' | 'left'; tailAt = fraction along that side
 * where the tail points at the figure. Sized in px at 1x (rasterized 2x). */
function bubbleSvg(T, { w = 340, h = 120, tailSide = "bottom", tailAt = 0.72, tailLen = 26 } = {}) {
  const stroke = hx(T.c.accent);
  const r = 14, sw = 2.5;
  const x0 = sw, y0 = sw, x1 = w - sw, y1 = (tailSide === "bottom" ? h - tailLen : h) - sw;
  const xL = tailSide === "left" ? x0 + tailLen : x0;
  let d;
  if (tailSide === "bottom") {
    const tx = x0 + (x1 - x0) * tailAt;
    d = [
      `M ${x0 + r} ${y0}`, `H ${x1 - r}`, `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
      `V ${y1 - r}`, `A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
      `H ${Math.min(tx + 16, x1 - r)}`, `L ${tx + 4} ${y1 + tailLen}`, `L ${Math.max(tx - 14, x0 + r)} ${y1}`,
      `H ${x0 + r}`, `A ${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
      `V ${y0 + r}`, `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`, "Z",
    ].join(" ");
  } else if (tailSide === "right") { // tail points right at the speaker
    const xR = w - tailLen - sw;
    const ty = y0 + (y1 - y0) * Math.min(Math.max(tailAt, 0.15), 0.85);
    d = [
      `M ${x0 + r} ${y0}`, `H ${xR - r}`, `A ${r} ${r} 0 0 1 ${xR} ${y0 + r}`,
      `V ${Math.max(ty - 12, y0 + r)}`, `L ${xR + tailLen} ${ty + 3}`, `L ${xR} ${Math.min(ty + 15, y1 - r)}`,
      `V ${y1 - r}`, `A ${r} ${r} 0 0 1 ${xR - r} ${y1}`,
      `H ${x0 + r}`, `A ${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
      `V ${y0 + r}`, `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`, "Z",
    ].join(" ");
  } else { // left tail
    const ty = y0 + (y1 - y0) * Math.min(Math.max(tailAt, 0.15), 0.85);
    d = [
      `M ${xL + r} ${y0}`, `H ${x1 - r}`, `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
      `V ${y1 - r}`, `A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
      `H ${xL + r}`, `A ${r} ${r} 0 0 1 ${xL} ${y1 - r}`,
      `V ${Math.min(ty + 15, y1 - r)}`, `L ${xL - tailLen} ${ty + 3}`, `L ${xL} ${Math.max(ty - 12, y0 + r)}`,
      `V ${y0 + r}`, `A ${r} ${r} 0 0 1 ${xL + r} ${y0}`, "Z",
    ].join(" ");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="${d}" fill="#FFFFFF" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
</svg>`;
}

/* Avatar bust (会話/証言レイアウトの話者アイコン): a NEUTRAL, STATIC
 * head-and-shoulders silhouette inside a circle mask — no gesture, ever.
 * Meaning is carried by the bubble text / scene symbols / ○× labels; the
 * avatar only answers "who is speaking". Uniform BY CONSTRUCTION: same
 * circle, same framing, one fill (#231815 series, token-recolourable).
 * Hair contour is the only per-speaker variation (話者の区別のためだけ).
 * A supplied bust (socost 単色バスト etc.) drops into the same slot
 * asset-independently; this in-engine version keeps the layouts buildable
 * until the supplied set arrives. */
const AVATAR_HAIR = ["short", "long", "bun", "side"];
function avatarBustSvg(T, { hair = "short", ink = "231815", ground = null } = {}) {
  // default = NO ground circle: the bust stays a PURE single-ink silhouette
  // (zero chroma, zero white) so the STYLE-UNIFORM colour proxy classifies
  // it by construction; a light ground would read as "white" = illustration
  const ik = ink.startsWith("#") ? ink : "#" + ink;
  const HAIRS = {
    short: "",
    long: `<path d="M70 62 C60 84 62 106 56 126 L86 126 C78 106 78 86 82 66 Z" fill="${ik}"/>
      <path d="M130 62 C140 84 138 106 144 126 L114 126 C122 106 122 86 118 66 Z" fill="${ik}"/>`,
    bun: `<circle cx="100" cy="38" r="11" fill="${ik}"/>`,
    side: `<path d="M66 62 Q74 40 100 38 Q130 40 136 66 Q126 50 96 52 Q76 54 66 62 Z" fill="${ik}"/>`,
  };
  if (!(hair in HAIRS)) throw new Error(`avatarBustSvg: unknown hair "${hair}" (${AVATAR_HAIR.join("|")})`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs><clipPath id="c"><circle cx="100" cy="100" r="96"/></clipPath></defs>
  ${ground ? `<circle cx="100" cy="100" r="96" fill="${ground.startsWith("#") ? ground : "#" + ground}"/>` : ""}
  <g clip-path="url(#c)">
    <ellipse cx="100" cy="80" rx="30" ry="34" fill="${ik}"/>
    <rect x="87" y="106" width="26" height="18" fill="${ik}"/>
    <path d="M100 120 C70 120 44 132 35 154 C30 166 28 182 28 200 L172 200 C172 182 170 166 165 154 C156 132 130 120 100 120 Z" fill="${ik}"/>
    ${HAIRS[hair]}
  </g>
</svg>`;
}

/* Business silhouette figure (サラリーマンシルエット) — the in-engine figure
 * style the user picked over the flat pictogram (reference: a supplied
 * full-body silhouette sheet; these paths are ORIGINAL — tracing an
 * unlicensed screenshot would break the rights floor). Realistic ~7.4-head
 * proportions in a 200x440 viewBox, solid single-colour union: limbs are
 * round-cap strokes, torso a closed path — overlaps vanish, only the outer
 * contour matters, which is also why the poses are contour-legible gestures:
 * concern = hand to the back of the head (困った/頭をかく), present = arm
 * extended up-out toward the content. No face — the silhouette idiom carries
 * professionalism without the uncanny/幼い problem a drawn face has. */
function silhouetteSvg(T, { w = 260, h = 572, pose = "concern" } = {}) {
  const ink = hx(T.c.ink);
  const limb = (d, sw) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
  const head = `<ellipse cx="100" cy="40" rx="18.5" ry="22" fill="${ink}"/>
  <rect x="91.5" y="56" width="17" height="18" fill="${ink}"/>`;
  const torso = `<path fill="${ink}" d="M85 66 C75 68 68 71 64 77 C59 84 58 92 58 100
    C58 122 61 148 63 170 C64 190 66 202 67 210 L133 210 C134 202 136 190 137 170
    C139 148 142 122 142 100 C142 92 141 84 136 77 C132 71 125 68 115 66
    C108 71 92 71 85 66 Z"/>`;
  const leftArm = limb("M64 86 C59 112 57 138 57 160 C57 180 58 196 59 210", 13.5)
    + `<ellipse cx="59" cy="218" rx="5.5" ry="8" fill="${ink}"/>`;
  const legs = `<rect x="67" y="196" width="66" height="38" fill="${ink}"/>`
    + limb("M85 232 L84 302", 22) + limb("M84 296 L82 332", 18) + limb("M82 326 L80 405", 14.5)
    + limb("M115 232 L116 302", 22) + limb("M116 296 L118 332", 18) + limb("M118 326 L120 405", 14.5);
  const shoes = `<rect x="58" y="408" width="34" height="14" rx="6" fill="${ink}"/>
  <rect x="108" y="408" width="34" height="14" rx="6" fill="${ink}"/>`;
  let rightArm;
  if (pose === "present") {
    rightArm = limb("M137 87 C151 86 164 79 172 72", 14)
      + limb("M172 72 C180 66 187 60 192 55", 11)
      + `<ellipse cx="194" cy="52" rx="6" ry="7.5" fill="${ink}"/>`;
  } else {
    rightArm = limb("M136 82 C152 76 164 68 172 58", 14)
      + limb("M172 58 C160 40 140 28 122 24", 12)
      + `<ellipse cx="119" cy="23" rx="7" ry="6.5" fill="${ink}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 200 440">
${head}${torso}${leftArm}${rightArm}${legs}${shoes}</svg>`;
}

/* Scene symbols (シーン記号): a SEPARATE code-drawn overlay near the figure's
 * head — 悩み雲 / 電球(気づき) / 汗 / ？ / ↑↓. This layer is what keeps the
 * figure asset-independent: the same symbol composes over the in-engine
 * pictogram OR a licensed drop-in, because it depends only on the placement
 * box (personaLayout.symbol), never on the figure's drawing style. Pure
 * paths — no <text> (fonts would break render determinism). */
const SYMBOL_NAMES = ["worry", "idea", "sweat", "question", "up", "down"];
function sceneSymbol(T, { variant, w = 60, h = 60 } = {}) {
  const c = hx(T.c.accentDp), soft = hx(T.c.accent);
  const P = {
    worry: `<path d="M7.2 13.8a4.1 4.1 0 01-.7-8.1 5 5 0 019.6-1 3.7 3.7 0 011.4 7.2" fill="none"/>
      <circle cx="8" cy="17.6" r="1.15" fill="${c}" stroke="none"/><circle cx="5.4" cy="20.6" r="0.75" fill="${c}" stroke="none"/>`,
    idea: `<path d="M12 3a5.7 5.7 0 00-3.35 10.3c.6.5.95 1 .95 1.7v.5h4.8v-.5c0-.7.35-1.2.95-1.7A5.7 5.7 0 0012 3z" fill="none"/>
      <line x1="9.8" y1="18.4" x2="14.2" y2="18.4"/><line x1="10.6" y1="20.5" x2="13.4" y2="20.5"/>
      <line x1="3.6" y1="5.4" x2="5.5" y2="6.6"/><line x1="20.4" y1="5.4" x2="18.5" y2="6.6"/>`,
    sweat: `<path d="M12 3.4C9.2 8 7.2 10.9 7.2 14a4.8 4.8 0 009.6 0c0-3.1-2-6-4.8-10.6z" fill="${soft}" fill-opacity="0.35"/>`,
    question: `<path d="M8.7 8.1C8.7 5.6 10.1 4 12.1 4s3.3 1.5 3.3 3.6c0 1.8-1 2.7-2.1 3.5-.9.7-1.3 1.4-1.3 2.6v.7" fill="none"/>
      <circle cx="12" cy="19.3" r="1.3" fill="${c}" stroke="none"/>`,
    up: `<line x1="12" y1="20" x2="12" y2="5.2"/><polyline points="6.6,10.6 12,5.2 17.4,10.6" fill="none"/>`,
    down: `<line x1="12" y1="4" x2="12" y2="18.8"/><polyline points="6.6,13.4 12,18.8 17.4,13.4" fill="none"/>`,
  };
  if (!P[variant]) throw new Error(`sceneSymbol: unknown variant "${variant}" (use ${SYMBOL_NAMES.join("|")})`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24"
  fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[variant]}</svg>`;
}

module.exports = { atmosphere, icon, motif, pattern, markerCircle, figureSvg, silhouetteSvg, bubbleSvg, avatarBustSvg, AVATAR_HAIR, sceneSymbol, SYMBOL_NAMES, ICONS, ICON_STROKE, ICON_NAMES, MOTIF_NAMES, PATTERN_NAMES };
