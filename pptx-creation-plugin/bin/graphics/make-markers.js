#!/usr/bin/env node
/* ============================================================
 *  bin/graphics/make-markers.js — rasterize circle emphasis markers
 *
 *  For every slide whose `content.marker` is {type:"circle"} WITHOUT an
 *  `image`, render the hand-drawn SVG ellipse (recipes.markerCircle, theme
 *  accent) to a transparent 2x PNG sized to the EXACT box the engine will
 *  draw (generate.circleMarkerSize), and write an enriched plan with
 *  marker.image filled — the same plan-in → enriched-plan-out contract as
 *  bake.js. Slides with no circle marker pass through untouched, so the
 *  output plan is otherwise byte-equal in content.
 *
 *  Needs the Phase-B Chromium (svg-render). build.sh calls this between bake
 *  and generate and SKIPS it gracefully when the browser is absent (the
 *  engine then simply draws no circle — badges/arrow-notes are native and
 *  unaffected).
 *
 *  Usage: node bin/graphics/make-markers.js --plan <in.json> [--theme <t>]
 *         --out <enriched.json> [--assets <dir>]   (default: <out dir>/assets)
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { loadTheme, circleMarkerSize } = require("../generate.js");
const { renderSvgToPng } = require("../svg-render.js");
const { closeBrowser } = require("../layout-html/measure.js");
const recipes = require("./recipes.js");

const PX_PER_IN = 96;
const { personaLayout, PERSONA_TAIL, dialogueLayout, testimonialLayout } = require("./diagrams.js");

/* ---- the asset pipeline (SVGマスター → 透過PNG@2x) ----
 * The SVG MASTER is persisted next to the PNG (assets/generated/*.svg):
 * token-recolourable, resolution-independent, editable. The pptx embeds ONLY
 * the transparent PNG (uniform rendering on old Office / Google Slides /
 * Keynote / mobile; soffice QA then verifies the same pixels PowerPoint
 * shows). Scale rule: pngPx = ceil(placeIn x 96 x scale), scale >= 2; large
 * placements step up (>5in -> 3x, >8in -> 4x) against upscale blur. The
 * rasterizer is the repo's pinned headless Chromium — same input, same
 * output (recorded determinism; no external renderer added). */
// Brand-token recolor for supplied SVG masters (opt-in via persona.recolor).
// Maps the source's signature-blue family onto the theme accent at matching
// tint levels; neutrals (line/grey/white) and semantic warm colours (hair,
// passbook, alert marks) keep their supplied values (供給色の尊重). Pure
// string replacement — deterministic, master file on disk untouched.
const RECOLOR_TINTS = { "3d8dcc": 0, "64a4d6": 0.15, "78afdb": 0.3, "7abee6": 0.35, "b1d1eb": 0.55, "c5ddf0": 0.7, "d8e8f5": 0.8 };
function mixWhite(hex, t) {
  const n = parseInt(hex, 16);
  const m = (v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0");
  return m((n >> 16) & 255) + m((n >> 8) & 255) + m(n & 255);
}
function recolorSvg(svg, T) {
  for (const [src, t] of Object.entries(RECOLOR_TINTS)) {
    svg = svg.replace(new RegExp("#" + src, "gi"), "#" + mixWhite(T.c.accent, t));
  }
  return svg;
}

function scaleFor(wIn, hIn) {
  const d = Math.max(wIn, hIn);
  return d > 8 ? 4 : d > 5 ? 3 : 2;
}
async function materialize(svg, assetsDir, baseName, wIn, hIn) {
  const fsPath = path.join(assetsDir, baseName);
  fs.mkdirSync(assetsDir, { recursive: true });
  const wPx = Math.ceil(wIn * PX_PER_IN), hPx = Math.ceil(hIn * PX_PER_IN);
  // normalize the root width/height to the placement box: supplied masters
  // (e.g. socost) carry absolute attrs that fight the render viewport and
  // CLIP; aspect is preserved because the box is derived from the viewBox
  svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, "<svg$1").replace(/<svg([^>]*?)\sheight="[^"]*"/, "<svg$1")
    .replace("<svg", `<svg width="${wPx}" height="${hPx}"`);
  fs.writeFileSync(`${fsPath}.svg`, svg); // the master
  await renderSvgToPng({ svg, widthPx: wPx, heightPx: hPx, outPath: `${fsPath}.png`, scale: scaleFor(wIn, hIn) });
  return path.resolve(`${fsPath}.png`);
}

async function makeMarkers(planPath, themePath, outPath, assetsDir) {
  const T = loadTheme(themePath);
  const raw = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const slides = Array.isArray(raw) ? raw : raw.slides;
  let made = 0;
  for (let i = 0; i < slides.length; i++) {
    const c = slides[i].content || {};
    if (c.marker && c.marker.type === "circle" && !c.marker.image
        && (T.layout && T.layout.marker && T.layout.marker.handDrawn)) {
      // circle is theme-gated (hand-drawn wobble is off-register for business/
      // financial); without the opt-in the engine won't draw it, so don't
      // rasterize an asset either — design-lint reports the ERROR.
      const size = circleMarkerSize(slides[i], T);
      if (size) {
        const svg = recipes.markerCircle(T, { w: Math.ceil(size.w * PX_PER_IN), h: Math.ceil(size.h * PX_PER_IN) });
        c.marker.image = await materialize(svg, assetsDir, `marker-circle-s${i + 1}`, size.w, size.h);
        made++;
      }
    }
    // persona (education register): materialize the figure (unless the user
    // dropped in a licensed PNG) and the seamless single-path bubble, sized by
    // the SAME personaLayout the engine draws with (asset == placement).
    if (c.persona && typeof c.persona === "object" && c.persona.quote) {
      const p = c.persona;
      const L = personaLayout(p, T, slides[i].pattern);
      if (p.figure && !p.figureImage) {
        // PRODUCTION figures are user-supplied licensed/open-license assets
        // (assets/generated/figures/ + LICENSE.md) — the engine never
        // AI-generates or scrapes a person (M-7). Both formats ride the
        // pipeline: a supplied SVG is a MASTER (rasterized to transparent
        // PNG @2x like our own); a supplied PNG embeds as-is (supplied
        // colours respected — image-lint enforces the 2x/alpha floor).
        // Either way the plan is enriched with the asset's own w:h so no
        // consumer ever stretches a figure.
        const src = path.resolve(path.dirname(path.resolve(planPath)), p.figure);
        const wantH = typeof p.h === "number" ? p.h : 2.9; // full-body default height (in)
        if (/\.svg$/i.test(src)) {
          let svg = fs.readFileSync(src, "utf8");
          if (p.recolor) svg = recolorSvg(svg, T);
          const vb = svg.match(/viewBox\s*=\s*"[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
          const ar = vb ? Number(vb[1]) / Number(vb[2]) : 0.45;
          p.h = wantH; p.w = Math.round(wantH * ar * 100) / 100;
          p.figureImage = await materialize(svg, assetsDir, `persona-fig-s${i + 1}-supplied`, p.w, p.h);
          made++;
        } else {
          const buf = fs.readFileSync(src);
          if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
            const ar = buf.readUInt32BE(16) / buf.readUInt32BE(20);
            p.h = wantH; p.w = Math.round(wantH * ar * 100) / 100;
          }
          p.figureImage = src;
        }
      } else if (!p.figure && !p.figureImage && (p.style === "silhouette" || p.style === "pictogram")) {
        // in-engine figures render only behind an explicit style opt-in:
        // "silhouette" = the full-body business silhouette (顔なし・実比率 —
        // the pro-deck idiom the user chose), "pictogram" = the flat bust
        // (トイレ標識水準). Realistic FACES stay out of engine reach — the
        // hand-drawn trial confirmed they need supplied assets.
        const v = p.variant || {};
        const wPx = Math.ceil(L.fig.w * PX_PER_IN), hPx = Math.ceil(L.fig.h * PX_PER_IN);
        const svg = p.style === "silhouette"
          ? recipes.silhouetteSvg(T, { w: wPx, h: hPx, pose: p.pose || "concern" })
          : recipes.figureSvg(T, { w: wPx, h: hPx, pose: p.pose || "concern",
              hair: v.hair || "short", jacket: v.jacket || "accent", tie: v.tie !== false });
        p.figureImage = await materialize(svg, assetsDir, `persona-fig-s${i + 1}-${p.style}-${p.pose || "concern"}`, L.fig.w, L.fig.h);
        made++;
      }
      if (!p.bubbleImage) {
        const svg = recipes.bubbleSvg(T, { w: Math.ceil(L.bubble.w * PX_PER_IN), h: Math.ceil(L.bubble.h * PX_PER_IN),
          tailSide: L.tailSide, tailAt: L.tailAt, tailLen: Math.round(PERSONA_TAIL * PX_PER_IN) });
        p.bubbleImage = await materialize(svg, assetsDir, `persona-bubble-s${i + 1}-${L.tailSide}`, L.bubble.w, L.bubble.h);
        made++;
      }
      if (p.symbol && !p.symbolImage && L.symbol) {
        // scene-symbol overlay (悩み雲・電球・汗・？・↑↓) — a SEPARATE code-drawn
        // layer, works over ANY figure source (asset-independent).
        const svg = recipes.sceneSymbol(T, { variant: p.symbol,
          w: Math.ceil(L.symbol.w * PX_PER_IN), h: Math.ceil(L.symbol.h * PX_PER_IN) });
        p.symbolImage = await materialize(svg, assetsDir, `persona-symbol-s${i + 1}-${p.symbol}`, L.symbol.w, L.symbol.h);
        made++;
      }
    }
    // dialogue / testimonial speakers: materialize the avatar (supplied bust
    // OR the in-engine neutral circle-mask bust), the per-speaker bubble
    // (tail pointing at ITS OWN avatar) and any scene-symbol overlay — all
    // sized by the SAME layout the engine draws with.
    if (slides[i].pattern === "dialogue" || slides[i].pattern === "testimonial") {
      const L = slides[i].pattern === "dialogue" ? dialogueLayout(T, c) : testimonialLayout(T, c);
      const pairs = [];
      if (L.form === "compare") {
        L.cols.forEach((col, ci) => col.speakers.forEach((row, k) => {
          const sp = ((c.columns[ci] || {}).speakers || [])[k];
          if (sp) pairs.push({ sp, row, tag: `c${ci}-${k}` });
        }));
      } else if (L.form === "plain") {
        L.speakers.forEach((row, k) => { const sp = (c.speakers || [])[k]; if (sp) pairs.push({ sp, row, tag: `p${k}` }); });
      } else { // testimonial cards
        L.cards.forEach((row, k) => { const sp = (c.items || [])[k]; if (sp) pairs.push({ sp, row: { avatar: row.avatar }, tag: `t${k}` }); });
      }
      for (let k = 0; k < pairs.length; k++) {
        const { sp, row, tag } = pairs[k];
        if (sp.avatar && !sp.avatarImage) {
          const src = path.resolve(path.dirname(path.resolve(planPath)), sp.avatar);
          if (/\.svg$/i.test(src)) {
            let svg = fs.readFileSync(src, "utf8");
            if (sp.recolor) svg = recolorSvg(svg, T);
            if (Array.isArray(sp.crop) && sp.crop.length === 4) {
              // 顔アップ切出し (加工可の範囲・決定論): crop = [fx,fy,fw,fh]
              // fractions of the source viewBox; a circle clip + uniform
              // ground turn any scene illustration into a framed head avatar
              const vb = (svg.match(/viewBox\s*=\s*"([\d.\- ]+)"/) || [])[1].split(/\s+/).map(Number);
              const cx = vb[0] + sp.crop[0] * vb[2], cy = vb[1] + sp.crop[1] * vb[3], cw = sp.crop[2] * vb[2];
              const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
              svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx} ${cy} ${cw} ${cw}">
  <defs><clipPath id="avc"><circle cx="${cx + cw / 2}" cy="${cy + cw / 2}" r="${cw / 2 * 0.985}"/></clipPath></defs>
  <circle cx="${cx + cw / 2}" cy="${cy + cw / 2}" r="${cw / 2 * 0.985}" fill="#${T.c.surface}"/>
  <g clip-path="url(#avc)">${inner}</g>
</svg>`;
            }
            sp.avatarImage = await materialize(svg, assetsDir, `avatar-s${i + 1}-${tag}-supplied`, row.avatar.w, row.avatar.h);
            made++;
          } else sp.avatarImage = src;
        } else if (!sp.avatar && !sp.avatarImage) {
          // in-engine neutral bust: uniform circle/framing BY CONSTRUCTION;
          // hair contour rotates per speaker only to tell them apart
          const svg = recipes.avatarBustSvg(T, { hair: sp.hair || recipes.AVATAR_HAIR[k % recipes.AVATAR_HAIR.length] });
          sp.avatarImage = await materialize(svg, assetsDir, `avatar-s${i + 1}-${tag}-${sp.hair || recipes.AVATAR_HAIR[k % recipes.AVATAR_HAIR.length]}`, row.avatar.w, row.avatar.h);
          made++;
        }
        if (row.bubble && !sp.bubbleImage) {
          const tailSide = sp.tailSide || row.tailSide; // explicit override kept for the BUBBLE-TAIL lint fixture
          const svg = recipes.bubbleSvg(T, { w: Math.ceil(row.bubble.w * PX_PER_IN), h: Math.ceil(row.bubble.h * PX_PER_IN),
            tailSide, tailAt: row.tailAt, tailLen: Math.round(PERSONA_TAIL * PX_PER_IN * 0.8) });
          sp.bubbleImage = await materialize(svg, assetsDir, `bubble-s${i + 1}-${tag}-${tailSide}`, row.bubble.w, row.bubble.h);
          made++;
        }
        if (sp.symbol && !sp.symbolImage && row.symbol) {
          const svg = recipes.sceneSymbol(T, { variant: sp.symbol,
            w: Math.ceil(row.symbol.w * PX_PER_IN), h: Math.ceil(row.symbol.h * PX_PER_IN) });
          sp.symbolImage = await materialize(svg, assetsDir, `symbol-s${i + 1}-${tag}-${sp.symbol}`, row.symbol.w, row.symbol.h);
          made++;
        }
      }
    }
  }
  fs.writeFileSync(outPath, JSON.stringify(raw, null, 2) + "\n");
  return { made, out: outPath };
}

const USAGE = `make-markers — rasterize circle emphasis markers into a plan
  node bin/graphics/make-markers.js --plan <in.json> [--theme <t.json>] --out <enriched.json> [--assets <dir>]`;

async function main() {
  const a = { plan: null, theme: null, out: null, assets: null };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--plan") a.plan = process.argv[++i];
    else if (k === "--theme") a.theme = process.argv[++i];
    else if (k === "--out") a.out = process.argv[++i];
    else if (k === "--assets") a.assets = process.argv[++i];
    else if (k === "-h" || k === "--help") { console.log(USAGE); return 0; }
    else { console.error(`unknown arg: ${k}\n\n${USAGE}`); return 2; }
  }
  if (!a.plan || !a.out) { console.error("Missing --plan and/or --out.\n\n" + USAGE); return 2; }
  if (!a.theme) a.theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  if (!a.assets) a.assets = path.join(path.dirname(a.out), "assets");
  const r = await makeMarkers(a.plan, a.theme, a.out, a.assets);
  console.log(`markers: ${r.made} circle(s) rasterized -> ${r.out}`);
  return 0;
}

main().then((c) => closeBrowser().then(() => process.exit(c)))
  .catch((e) => { console.error("make-markers failed: " + (e && e.message ? e.message : e)); closeBrowser().finally(() => process.exit(1)); });

module.exports = { makeMarkers };
