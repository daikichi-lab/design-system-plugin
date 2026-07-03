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

| Kind | Recipe | Slot it feeds | Format |
|---|---|---|---|
| **Background** | `atmosphere` | cover `bg` | **JPEG** (opaque; ~40× lighter than PNG for gradients) |
| **Icon** | `icon` (24-glyph line family) | `stats[].icon` / `items[].icon` | **PNG** (transparent) |
| **Motif** | `motif` (corner decoration) | `bgMotif` (any pattern) | **PNG** (transparent) |
| **Pattern** | `pattern` (faint ground) | `bgPattern` (any pattern) | **PNG** (transparent) |

Format is chosen by the output extension: `.jpg` → JPEG (opaque backgrounds),
`.png` → transparent (icons / motifs / patterns). The rasterizer reuses the
Phase-B headless Chromium — no resvg/sharp dependency. Every recipe is
theme-token-driven, so a graphic can never drift from the native text/cards over it.

## `atmosphere` (background)

Dark theme-gradient base + one soft accent glow + an optional **feathered scrim**
(`variant: left|bottom|none`) baked in for text legibility. All colour from
`theme.colors`, so it never drifts from the native layer. `grain: true` adds
feTurbulence texture but is **off by default** — full-canvas noise is
incompressible (3.3MB vs ~28KB) and image-lint will flag the weight.

## `icon` (line-icon family)

A **consistent** set of 24 line glyphs (one `viewBox` = 24, one `ICON_STROKE`,
rounded caps, no fill), so any subset placed on a slide passes image-lint's
**icon-set** check. `stroke = accent` by default (override with `color`). Icons are
the sanctioned way to add pictographs — **never emoji** (house bar §2).

Current variants (grow the `ICONS` map — keep every glyph line-only at the shared
stroke so the family stays uniform):

- growth/finance — `trend` `growth` `coin` `pie` `barchart`
- goals/process — `target` `flow` `check` `settings` `layers` `flag`
- people/comms — `people` `chat` `briefcase`
- knowledge/risk — `idea` `alert` `shield`
- objects/time — `document` `clock` `calendar` `globe` `search` `star` `arrowup`

The **consistency contract** is what makes a set look designed rather than scraped:
same optical size, same stroke weight. image-lint measures stroke with a
*density-invariant* proxy (`2·area/perimeter`), so a busy glyph (globe) and a
sparse one (arrow) at the same stroke read the same — only a genuine
filled-vs-line or thick-vs-thin mismatch is flagged.

## `motif` (corner decoration → `bgMotif`)

A code-drawn decoration for the `bgMotif` slot, kept in the **top-right region**
(ink at x > ~0.6w) so it clears the usual left text column — image-lint's
**motif-intrude** check fails a motif that covers a text zone. Accent-family colour
only (one hue: `accent`/`accentSoft`/`accentDeep`), so it can never fight the deck's
single accent ("simple + refined"). Variants: `confetti` `corner-dots`
`corner-rings` `arcs` `blob` `triangles`.

## `pattern` (faint ground → `bgPattern`)

A faint full-bleed texture for the `bgPattern` slot — low opacity by design so it
never dents text contrast (motif-intrude passes it because per-pixel alpha stays
under the opaque threshold). Variants: `dots` `grid` `diagonal`.

## Weight discipline (image-lint enforces)

- **2x resolution, no more.** Backgrounds at 2× display (2560×1440 for full-bleed);
  going higher only bloats the deck.
- **JPEG for opaque backgrounds, PNG only when transparency is needed.**
- **Reuse** one background across slides rather than generating many.
- **Grain off** unless you accept the weight.

`image-lint` (a `build.sh` gate) checks each embedded image: scrim/contrast
(WCAG, pixel-sampled) for opaque backgrounds, **motif-intrude** (a decoration
motif must stay out of the text zone), **icon-set** (one optical size + stroke
weight across a slide's icons), resolution vs placement, aspect (no stretch),
scrim-edge softness, and per-image + whole-deck weight caps.

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
