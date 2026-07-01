"use strict";
/* ============================================================
 *  bin/graphics/recipes.js — code-drawn SVG recipes (Phase C, spec 1b)
 *
 *  Every recipe is a pure function (theme, opts) -> SVG string. ALL colour comes
 *  from theme tokens (T.c.*), so a background can never drift from the native
 *  text/cards drawn over it. No raster art, no external images, no photography
 *  (M-7) — gradients / geometry / feTurbulence grain only.
 *
 *  Kinds (spec 1b): (a) backgrounds — atmosphere; (b) icons — line icons;
 *  (c) special shapes. Documented in references/graphics/svg-recipes.md.
 * ============================================================ */

const hx = (c) => "#" + String(c).replace(/^#/, "");

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

/* (b) ICON — minimal line icon (stroke = accent), 24x24 viewBox, scalable.
 * A tiny starter set; grow it in svg-recipes.md. */
function icon(T, { w = 96, h = 96, variant = "trend" } = {}) {
  const c = T.c;
  const stroke = hx(c.accent);
  const paths = {
    trend: `<polyline points="4,17 10,11 14,14 20,6" fill="none"/><polyline points="15,6 20,6 20,11" fill="none"/>`,
    coin: `<circle cx="12" cy="12" r="8" fill="none"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 010 3H10a1.5 1.5 0 000 3h4" fill="none"/>`,
    target: `<circle cx="12" cy="12" r="8" fill="none"/><circle cx="12" cy="12" r="3.5" fill="none"/>`,
    flow: `<circle cx="6" cy="12" r="2.5" fill="none"/><circle cx="18" cy="12" r="2.5" fill="none"/><line x1="8.5" y1="12" x2="15.5" y2="12"/>`,
  };
  const p = paths[variant] || paths.trend;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24">
  <g stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">${p}</g>
</svg>`;
}

module.exports = { atmosphere, icon };
