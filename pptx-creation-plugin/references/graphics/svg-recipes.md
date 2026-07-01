# SVG drawing recipes

Every graphic in a deck is **code-drawn** — an SVG generated from theme tokens,
rasterized to a picture (M-7: no image generation, no photography; deterministic,
brand-clean, free). Recipes are pure functions `(theme, opts) -> svg string` in
[`../../bin/graphics/recipes.js`](../../bin/graphics/recipes.js); the rasterizer
is [`../../bin/svg-render.js`](../../bin/svg-render.js).

```bash
node bin/svg-render.js --recipe atmosphere --theme <t.json> --w 1280 --h 720 --scale 2 \
     --out <project>/assets/generated/cover-bg.jpg
```

Generated assets live in each **project's** `assets/generated/`, never in the
plugin (separation principle). The plugin ships the recipes + engine only.

## Kinds

| Kind | Recipe(s) | Format |
|---|---|---|
| **Background** (atmosphere) | `atmosphere` | **JPEG** (opaque; ~40x lighter than PNG for gradients) |
| **Icon** (line icons) | `icon` (`trend`/`coin`/`target`/`flow`) | **PNG** (transparent, sits over the deck) |
| **Special shape** | (add here) | PNG if it needs transparency |

Format is chosen by the output extension: `.jpg` → JPEG (opaque backgrounds),
`.png` → transparent (icons/shapes). The rasterizer reuses the Phase-B headless
Chromium — no resvg/sharp dependency.

## `atmosphere` (background)

Dark theme-gradient base + one soft accent glow + an optional **feathered scrim**
(`variant: left|bottom|none`) baked in for text legibility. All colour from
`theme.colors`, so it never drifts from the native layer. `grain: true` adds
feTurbulence texture but is **off by default** — full-canvas noise is
incompressible (3.3MB vs ~28KB) and image-lint will flag the weight.

## `icon` (line icons)

24×24 viewBox, `stroke = accent`, rounded caps. A tiny starter set; grow it here.
Icons are the sanctioned way to add pictographs — **never emoji** (house bar §2).

## Weight discipline (image-lint enforces)

- **2x resolution, no more.** Backgrounds at 2× display (2560×1440 for full-bleed);
  going higher only bloats the deck.
- **JPEG for opaque backgrounds, PNG only when transparency is needed.**
- **Reuse** one background across slides rather than generating many.
- **Grain off** unless you accept the weight.

`image-lint` (a `build.sh` gate) checks each embedded image: scrim/contrast
(WCAG, pixel-sampled), resolution vs placement, aspect (no stretch), scrim-edge
softness, and per-image + whole-deck weight caps.

## Honest residuals

- **Colour space:** SVG → raster → pptx embed can shift colour slightly; keep
  recipe colours = theme tokens and let image-lint watch the match.
- **Font substitution:** soffice renders the *native text* in a fallback face, so
  glyph shapes are machine-dependent — but the composited **image + scrim** pixels
  are faithful, so background/legibility QA is reliable off-machine.
- **No photoreal / organic illustration** (M-7 design choice). Complex art
  composition is a different tool's job — say so, don't fake it with SVG.

## Adding a recipe

1. Add a pure `(T, opts) -> svg` function to `bin/graphics/recipes.js`, colour
   from `T.c.*` only.
2. Render it, **look at it**, and run `image-lint` on a deck that uses it.
3. Document it above. Update the engine + this file together.
