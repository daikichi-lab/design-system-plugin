# Design language: hybrid-editorial

One shelf in the design-language bookshelf (spec §4-2). Where `neutral-business`
is the quiet floor (no images, cards + type), **hybrid-editorial** adds a
**code-drawn atmospheric background** behind native type — for marketing decks,
seminars, and pitches that want presence. It is still governed by the whole
floor (Phase A typography, Phase B kinsoku, the AI-tell blocklist); it only adds
the image layer, and pays for it with `image-lint` (M-10).

> The background sets a mood; the numbers stay native and exact. A slide is not
> a poster — the atmosphere serves the message, never competes with it.

## The rule that makes it safe (M-8)

- **Background / hero / spot-icon = SVG**, code-drawn and rasterized (bin/graphics
  + bin/svg-render.js), embedded as a picture.
- **Title / number / chart / body = native pptx** (Phase B bake), drawn *on top*.
- Never a number baked into a picture; never a decorative shape faked with a text
  box. No image generation, ever (M-7) — gradients / geometry / grain only.

## Image slots (empty = image-0)

Each pattern gains optional slots — `bg` (full-bleed background), and later
`hero` / `icon`. **An empty slot renders zero images and the pattern is still
complete** — so the *same* language serves an image-free board deck
(daikichi 取締役会 = all slots empty → identical to the flat pattern) and an
image-rich seminar deck (slots filled). Fill slots by choice, not by default.

```jsonc
{ "pattern": "cover", "content": {
  "bg": "assets/generated/cover-bg.jpg",   // omit -> flat cover, zero regression
  "kicker": "…", "titleLines": ["…","…"], "subtitle": "…", "footer": "…"
} }
```

## Legibility: the scrim is mandatory

Wherever native text sits over a background, the background **must** carry a
**scrim** — a dark, semi-transparent wash — so the text clears WCAG. The scrim is
**baked into the SVG** as a feathered gradient (soft edge, never a hard band),
so there is no separate rectangle in the pptx. The `atmosphere` recipe puts the
scrim on the text side (`variant: left|bottom`). **`image-lint` is the gate**: it
pixel-samples the text region and fails the deck if contrast < 3.0 or the scrim
edge is a hard step. A hybrid slide does not ship without passing it.

## Tokens & layout

- Colours come from the **same theme tokens** as the native layer (the SVG recipe
  reads `theme.colors`), so background and text never drift. hybrid-editorial adds
  no new palette — it reuses `neutral-business` (dark base + one accent glow).
- One accent glow, off-centre; one motif reused across the deck; text lives in the
  scrimmed zone. Same margins/scale/leading as the floor.

## When to use / avoid

- **Use:** marketing, seminar, pitch, brand/vision openers — decks that want mood.
- **Avoid:** dense financial/board tables and dashboards (use `neutral-business`,
  slots empty). An atmosphere behind a data table hurts more than it helps.

## Verified before shelving (M-10, §6-2)

Registered only after: the hybrid cover renders clean (background + scrim +
native, legible); `image-lint` passes the good bg and **fails** the torture set
(weak scrim / low-res / distorted aspect / heavy) for the right reasons; and the
neutral examples stay no-regression. Residuals are honest (see
`bin/layout-html/README.md` §caveats and `graphics/svg-recipes.md`): soffice
substitutes the *font* (glyph shapes are machine-dependent), but composited image
pixels + scrim are faithful; SVG→raster colour can shift slightly (image-lint
watches it); photoreal/organic art is out of scope by M-7.

## See also
- [`../graphics/svg-recipes.md`](../graphics/svg-recipes.md) — the SVG recipes and the rasterizer.
- [`../principles/hybrid-architecture.md`](../principles/hybrid-architecture.md) — M-7/M-8 and the drawing contract.
- [`../principles/house-quality-bar.md`](../principles/house-quality-bar.md) — §2 AI-tell blocklist (the scrim is a wash, never a stripe).
