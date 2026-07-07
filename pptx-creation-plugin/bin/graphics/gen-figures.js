#!/usr/bin/env node
/* ============================================================
 *  bin/graphics/gen-figures.js — V2 offline figure generation (理想仕様 §1)
 *
 *  Generates the committed CC0 figure masters in
 *  assets/generated/figures/openpeeps/ from the VENDORED DiceBear npm
 *  packages (@dicebear/core + @dicebear/collection, lock-pinned — the same
 *  dependency posture as pptxgenjs / budoux / headless Chromium). No HTTP
 *  API is ever called: generation is deterministic (fixed seed + explicit
 *  options), runs offline, and its OUTPUT is committed like V1 assets, so
 *  deck builds never depend on this tool having run.
 *
 *  Style: DiceBear "Open Peeps" (Pablo Stanley, CC0 1.0) — HALF-BODY busts.
 *  One project = one style (床①と整合); attire colour is re-tokenized to the
 *  theme accent at generation time (色＝層② — CC0 parts may be recoloured;
 *  fixed-colour supplied assets are respected elsewhere and never touched).
 *
 *  The catalog maps SCENES to faces (deck-strategy picks by meaning and
 *  records the reason in notes — see figures-index.md):
 *    concerned/serious  … 悩み・課題のシーン (hook)
 *    explaining/driven  … 説明・行動のシーン (case/logical)
 *    smile/calm         … 提示・まとめ・傾聴 (summary)
 *
 *  Usage: node bin/graphics/gen-figures.js [--theme <theme.json>] [--out <dir>]
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { createAvatar } = require("@dicebear/core");
const { openPeeps } = require("@dicebear/collection");
const { loadTheme } = require("../generate.js");

// Two recurring characters (deck-wide identity continuity) × scene faces.
// Head/skin fixed per character; ONLY the face changes with the scene.
const CHARACTERS = {
  keieisha: { head: "pomp", skinColor: "edb98a" },   // 経営者 (hook/case の語り手)
  koushi: { head: "grayShort", skinColor: "d08b5b" },  // 講師 (説明・まとめの語り手)
};
const FACES = ["concerned", "serious", "explaining", "driven", "smile", "calm"];

function generate(themePath, outDir) {
  const T = loadTheme(themePath);
  fs.mkdirSync(outDir, { recursive: true });
  const made = [];
  for (const [charName, ch] of Object.entries(CHARACTERS)) {
    for (const face of FACES) {
      const svg = createAvatar(openPeeps, {
        seed: `pptx-${charName}-${face}`, // fixed -> deterministic output
        face: [face],
        head: [ch.head],
        skinColor: [ch.skinColor],
        clothingColor: [T.c.accent],      // brand token recolour (層②)
        accessoriesProbability: 0,
        facialHairProbability: 0,
        maskProbability: 0,
      }).toString();
      const file = path.join(outDir, `${charName}-${face}.svg`);
      fs.writeFileSync(file, svg);
      made.push(file);
    }
  }
  return made;
}

function main() {
  let theme = null, out = null;
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === "--theme") theme = process.argv[++i];
    else if (k === "--out") out = process.argv[++i];
  }
  if (!theme) theme = path.join(__dirname, "..", "..", "themes", "_default-neutral", "theme.json");
  if (!out) out = path.join(__dirname, "..", "..", "assets", "generated", "figures", "openpeeps");
  const made = generate(theme, out);
  console.log(`gen-figures: ${made.length} CC0 masters -> ${out}`);
  made.forEach((f) => console.log("  " + path.basename(f)));
}

if (require.main === module) main();
module.exports = { generate, CHARACTERS, FACES };
