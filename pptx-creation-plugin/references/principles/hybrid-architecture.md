# Hybrid Drawing Architecture

`house-quality-bar.md` is the checklist; `slide-design-principles.md` is the
method. This file is the **drawing contract** — *how* a slide's pixels come to
exist, and which tool is allowed to produce which pixel. It exists so that
expressive freedom (backgrounds, icons, custom shapes) never costs us
editability, brand fidelity, or the QA discipline the other two docs enforce.

> Every graphic is either a **code-drawn asset** or a **native pptx object** —
> never a screenshot, never a purchased/generated image. Freedom in *what* we
> draw is bought with strictness in *how* we draw it.

These are the mandates M-7..M-10, extending M-1..M-6 (which live in the plugin
`CLAUDE.md` and `house-quality-bar.md`). They are non-negotiable in the same
sense §1 of the house bar is: a deck built any other way is off-contract.

---

## 1. The non-negotiables (M-7..M-10)

- **M-7 — No image generation.** Never call an external image / GPU / API / MCP
  for pixels. **All** graphics are code-drawn (SVG/CSS) and then rasterized
  in-repo. This is what keeps output free, deterministic, on-brand, and
  rights-clean — a re-run produces the same asset, and no third party owns a
  pixel in the deck.
- **M-8 — Element allocation is strict.** Two responsibilities, never mixed:
  - **backgrounds / icons / non-standard shapes ⇒ SVG** — draw → PNG → embed as
    a picture.
  - **numbers / charts / text ⇒ NATIVE pptx** — accurate, editable, tokenized.

  A number is never baked into a PNG; a decorative shape is never faked with a
  text box.

  **The asset pipeline (M-8 formalized): SVG master → transparent PNG @2x.**
  Every code-drawn graphic follows one path:

  ```
  master SVG (assets/generated/*.svg — viewBox-based, transparent, no external refs)
    → token colouring (fills reference theme tokens — one master, every brand)
    → rasterize: transparent PNG, pngPx = ceil(placeInches × 96 × scale)
        scale ≥ 2 ALWAYS (a lint ERROR below); large placements (>5in) 3x, (>8in) 4x
        renderer = the repo's pinned headless Chromium (same input → same output)
    → the pptx embeds ONLY the PNG. The SVG is the editable original, never embedded.
  ```

  *Why PNG in the pptx:* PowerPoint 2016+ accepts SVG, but old Office, Google
  Slides, Keynote and several mobile/export paths render it differently or not
  at all — a rasterized transparent PNG draws identically everywhere. It also
  keeps QA honest: soffice→PDF→PNG composites the same pixels PowerPoint will
  show, whereas embedded SVG would let soffice's SVG renderer diverge from the
  real machine and the backing check would stop representing it.
  *Why keep the master:* token recolouring (one original → every brand),
  loss-free re-rasterization at any placement size, and SVG-side editability.
  `bin/graphics/make-markers.js` (`materialize()`) implements the path.

  **Figures (人物) are the ONE externally-sourced asset class.** The hand-drawn
  trial confirmed in-engine SVG humans do not reach professional quality, so
  production figures are **user-supplied licensed / open-license pro vector
  sets** dropped into the persona slot (`assets/generated/figures/` +
  `LICENSE.md` recording 出所・帰属要否・商用可否 — no real-person likeness, no
  IP, no logos). The engine never AI-generates or scrapes a person (M-7 holds).
  The in-engine figure survives only as an abstract pictogram behind the
  explicit `style:"pictogram"` opt-in. Everything AROUND the figure stays
  in-engine: placement, the single-path bubble, scene-symbol overlays
  (悩み雲/電球/汗/？/↑↓), ※例 marking, register gates — all asset-independent
  (SVG-master and drop-in versions are coordinate-identical, machine-proven). Charts stay native by M-1's non-negotiable #8 in `house-quality-bar.md`
  — the hybrid split does not create an exception to it, it *is* that rule
  generalized.
- **M-9 — No HTML-render mode.** HTML/CSS is used **only to COMPUTE** typesetting
  — line-breaks and geometry (§2b). The final artifact is **always** native pptx.
  Rendering a slide as HTML and screenshotting it is rejected: it destroys
  editability and defeats the render-and-look QA loop (`house-quality-bar.md` §5,
  M-2), because you can no longer distinguish "the text overflowed" from "the
  screenshot is just a picture of overflow."
- **M-10 — Freedom is paid for with verification.** Every added expressive
  capability — a new SVG motif, a new asset class, a new typesetting path — must
  pass the §6 verification (design-lint + the adversarial suite) **before it
  ships**. Design and reliability are re-verified **together**, never one without
  the other. This is M-10 applied to the sanctioned "add a pattern" path in
  `CLAUDE.md`: a capability isn't "available" until it has cleared QA.

---

## 2. How it fits together

### a. The hybrid data flow, at a glance

One slide, two producers, **one coordinate system**:

```
SVG asset  ──draw──▶  PNG  ──embed──▶ ┐
(bg / icon / shape)                    ├─▶  native pptx slide
                                       │    (the picture and the text/number/
native pptx object ────────────────────┘     chart share the same geometry)
(text / number / chart)
```

The rasterized SVG lands in the **same coordinates** the native text, number,
and chart are placed into — the picture is the backdrop and ornament, the native
objects are the payload, and both are positioned by the engine's one geometry
source of truth (`bin/generate.js`). Nothing is composited in a browser; the
pptx is the composite.

### b. Spec §4-4 — the philosophy is bisected

The design philosophy is deliberately split into two halves that live in two
different places and are consumed by two different actors:

- **JUDGMENT PROSE** → `references/principles/*` (this file, the house bar,
  `slide-design-principles.md`, `chart-design.md`). Read by `deck-strategy` and
  the reviewer; it guides *choices* a human/agent still makes.
- **HARD CONSTRAINT** → baked into the **engine / tokens / lint** and thereby
  *guaranteed*, not merely encouraged.

The dividing test: **「心がけよ」does not fix 泣き別れ — the kinsoku engine does.**
A principle you can only "try to remember" is prose; a rule the machine can
enforce belongs in code. Line-breaking (禁則処理) is not left to good intentions
in a reference doc — it is computed (§2c) and enforced, so 泣き別れ / 行頭禁則
violations cannot ship regardless of who authored the slide. Prose persuades;
constraint guarantees. Put each rule on the correct side of that line.

### c. Where typesetting is computed

HTML/CSS is the **measuring instrument** for typesetting only: it lays out the
Japanese text to resolve line-breaks and per-line geometry, and those computed
break points are emitted back as native pptx runs. The browser never becomes the
slide (M-9) — it is a ruler, not a canvas. This is how baked line-breaks reach
the deck without a screenshot ever entering the pipeline.

---

## 3. Honest caveats to carry forward

Rule-first does not mean pretending the seams aren't there. Three to keep in view:

- **SSIM never reaches 100%.** The HTML→pptx conversion fidelity (measured as
  SSIM against the computed layout) can be pushed high and should be, but it will
  **never** hit 1.0 — browser and PowerPoint disagree on font metrics, so the
  rasterized measurement and the native render differ by sub-pixel amounts. Treat
  a high-but-imperfect score as success; do not chase 100% (the same "don't chase
  sub-pixel perfection" stance as `house-quality-bar.md` §5).
- **Baked line-breaks are frozen at generate time.** The computed breaks (§2c)
  are correct for the text as authored. If the client **heavily edits** the text
  afterward, the breaks must be **regenerated** — hand-nudged text can reintroduce
  the very 泣き別れ the engine prevented. Regenerate; don't retype.
- **Generated assets are per-project, not plugin-core.** Every rasterized
  SVG/PNG lives in the **project repo** under `assets/generated/`, alongside that
  project's `theme.json` and `deck_plan.json` — **never** in the plugin. The
  plugin ships the *drawing capability*; each project owns its *drawn pixels*.
  This is the same per-project vs. plugin-core line M-6 draws for themes: the
  plugin holds recipes, the project holds content and its generated artifacts.

The staged rollout of these capabilities (which asset classes and typesetting
paths land in which order) is tracked in the roadmap alongside the pattern
roadmap in `../patterns/catalog.md` — **referenced here, not implemented here**;
each stage promotes to "available" only by clearing §6 per M-10.

---

## See also

- [`house-quality-bar.md`](house-quality-bar.md) — the hard rules, the AI-tell
  blocklist (§2), the QA loop (§5), the scoring rubric (§6). Charts-are-native
  (non-negotiable #8) is the seed of M-8.
- [`slide-design-principles.md`](slide-design-principles.md) — the method behind
  the bar; audience → message before any pixel, the JUDGMENT-PROSE half of §4-4.
- [`chart-design.md`](chart-design.md) — the native-chart contract M-8 routes all
  chart pixels through.
- `../patterns/catalog.md` — the pattern recipes and the roadmap the staged
  capabilities extend.
