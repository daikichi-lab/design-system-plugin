---
name: theme-init
description: Use in a PROJECT repo to create its theme.json (brand colors, fonts, sizes). Derives a palette from a logo/existing material or adjusts the neutral default by dialogue, conforms to theme.schema.json, and renders a 1-slide preview (cover + one body) to verify. Handles VISUAL identity only — never chapter structure or slide order.
---

# theme-init

Stand up one `theme.json` for a **project** repo. A theme is the deck's visual
identity — colors, font, type sizes, canvas — and nothing else. Everything in
this skill conforms to [`../../schemas/theme.schema.json`](../../schemas/theme.schema.json),
and the neutral default it starts from is
[`../../themes/_default-neutral/theme.json`](../../themes/_default-neutral/theme.json).

> A theme decides how the deck *looks*, never what it *says* or in what order.
> The moment the conversation turns to chapters, slide sequence, or wording,
> you have left this skill — hand off to `deck-strategy`.

---

## 0. Where the file goes

Write the theme **in the project repo, not in the plugin.** The plugin ships
exactly one theme (`_default-neutral`) and stays brand-free. A project owns its
own `theme.json` (commonly at the repo root or `./theme/theme.json`). Keep the
schema link so editors validate:

```jsonc
{ "$schema": "<relative path to schemas/theme.schema.json>", "name": "acme-corp", ... }
```

Never add a brand palette to the plugin's `themes/` directory.

---

## 1. Pick a derivation path

**Path A — a logo or existing material exists.** Extract a few representative
colors from it, then map them onto schema tokens (§2).

**Path B — no source material.** Clone
[`../../themes/_default-neutral/theme.json`](../../themes/_default-neutral/theme.json)
and adjust **only** `colors` and `font.family` by dialogue. Leave `canvas`,
`sizes`, and the token *structure* alone unless the user has a concrete reason —
the neutral sizes are already tuned to the patterns in
[`../../references/patterns/catalog.md`](../../references/patterns/catalog.md).

Either way the output is one schema-valid `theme.json`, then a rendered preview
(§4) for sign-off.

---

## 2. Extract colors (Path A)

Pull a small set of dominant + accent colors from the logo/deck. Any image
quantizer works; for example:

- **Node:** `sharp` to downscale, then a small k-means / median-cut over the
  pixel buffer.
- **Python:** `python3` + Pillow — `Image.open(...).convert("RGB").quantize(colors=6)`
  and read the resulting palette.

You want roughly: the **dominant** brand color, **one** sharp **accent**, and a
couple of light **tints**. Resist keeping more — the house rule is **one
dominant (60–70%) + one restrained accent** (see
[`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md) §1.5).
Discard extra hues; a logo's third and fourth colors almost always become
AI-tell rainbow if you let them onto the slide.

### Map extracted colors → schema tokens

The palette in `theme.schema.json` is not "a list of brand colors." It is a set
of **roles**. Assign deliberately:

| Extracted role | Token(s) it feeds |
|---|---|
| Dominant / darkest brand color | `dark`, `darkAlt` (slightly lighter, depth motif) |
| The one sharp accent | `accent`, plus `accentDeep` (darker, for text on tint) and `accentSoft` (lighter, e.g. kicker on dark) |
| Light neutral tint | `surface` (neutral card) |
| Light **accent** tint | `surfaceAccent` (emphasis card) |
| Near-black readable ink | `ink`, with `muted` / `faint` as it fades |
| White / paper | `bg` (body background), `onDark` (text on dark) |
| — derived for legibility — | `onDarkMuted`, `onAccentMuted` |

All values are **6-digit hex, no leading `#`** (the schema enforces
`^[0-9A-Fa-f]{6}$`).

### Worked example

Say a logo yields a deep teal `#0E7C86`, a near-black `#1B2735`, and white. A
sound mapping (this is exactly how the neutral default is built — compare
[`../../themes/_default-neutral/theme.json`](../../themes/_default-neutral/theme.json)):

```jsonc
"colors": {
  "bg":            "FFFFFF",   // paper
  "ink":           "1B2735",   // near-black brand → primary text on light
  "muted":         "566373",   // ink, faded → secondary text
  "faint":         "8A98A6",   // ink, fainter → captions / footer
  "surface":       "F3F5F7",   // neutral card tint
  "surfaceAccent": "E9F3F3",   // accent tint → emphasis card
  "line":          "DCE2E8",   // hairline divider
  "dark":          "1E2A3A",   // dominant dark → cover/CTA background
  "darkAlt":       "26384C",   // dark, lifted → off-canvas oval motif
  "onDark":        "FFFFFF",   // text on dark
  "onDarkMuted":   "AAB8C7",   // secondary text on dark
  "accent":        "0E7C86",   // the ONE sharp accent
  "accentDeep":    "0A5E66",   // accent, darker → text on a tinted surface
  "accentSoft":    "5FA8AE",   // accent, lighter → kicker on dark
  "onAccentMuted": "EAF7F7"    // muted text on a solid accent fill
}
```

Note the discipline: only **two** hue families (teal + the blue-grey ink/dark),
each appearing at several lightnesses. That is the whole palette. The
`darkAlt` motif color is a *lifted* shade of `dark`, not a stripe color — depth
comes from the soft off-canvas oval the `cover`/`cta` patterns draw, never from
bands (see house bar §2–§3).

---

## 3. Contrast & legibility (do not skip)

Every text-on-fill pairing must stay readable. Check, at minimum:

- `onDark` / `onDarkMuted` on `dark` — cover and CTA live here.
- `ink` / `muted` / `faint` on `bg` and on `surface`.
- `accentDeep` on `surfaceAccent` — the emphasis-card label color.
- `onDark` / `onAccentMuted` on a **solid** `accent` fill — the CTA offer panel.

Aim for normal body text at WCAG AA (~4.5:1); large titles can sit a little
lower but should never read as muddy. If an extracted accent is too light to
carry white text on the CTA panel, **darken the accent** (or push text toward
`onDark`) — don't keep an illegible pairing because it matches the logo. The
house bar fails a deck on low text/background contrast
([`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md) §5).

### Font

`font.family` is a **single token** — one Japanese family for the whole deck, no
per-textbox overrides (house rule / schema). Default **Meiryo**; **Yu Gothic**
and **Noto Sans JP** are also valid. Pick the one the brand actually licenses
and that renders on the build machine.

---

## 4. Preview and sign off

A theme is not done until it has been **seen on a real slide.** Build a tiny
deck plan — a `cover` plus **one** body pattern (`message`, `two-column`,
`comparison`, or `chart`) — using the project content the user expects, then
render it:

```bash
node bin/generate.js --plan <preview-plan.json> --theme <project-theme.json> --out preview.pptx
bash bin/qa.sh preview.pptx          # PPTX → PDF → JPG
```

(Exact CLI per [`../../bin/generate.js`](../../bin/generate.js); the render
helper is [`../../bin/qa.sh`](../../bin/qa.sh).) **Open the images and look** at
the actual color on dark, the accent on the emphasis card, and the contrast of
every text run — the same QA loop the house bar mandates
([`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md) §5).
Then **show the preview to the user for sign-off.**

Iterate on **color (and font) only.** If the preview reveals a layout or
overflow break that color can't fix, that is an engine/content matter, not a
theme matter — see M-4 in the house bar. Keep looping the palette until the
cover reads as on-brand and every body pairing is legible.

---

## 5. Hard boundary — visual identity only (M-6)

A theme carries **look-and-feel only.** It must **never** hold chapter
structure, slide order, narrative, or wording. Those belong to `deck-strategy`
(structure/logic) and the deck content itself — never to `theme.json`, and
never to `CLAUDE.md` (M-5). The schema enforces this by construction: there is
nowhere in [`../../schemas/theme.schema.json`](../../schemas/theme.schema.json)
to put a slide list. The only text a theme may carry is
`brand.footerLabel` (the org name shown bottom-left on body slides), and even
that is overridable per-deck via the plan's `meta.footerLabel`.

If the user starts describing "first an intro, then the problem, then three
options…": **stop and redirect.** That is a deck plan, not a theme. Capture it
for `deck-strategy` and keep this skill focused on the palette.

---

## Checklist before you finish

- [ ] `theme.json` written in the **project** repo (not the plugin), with a
      `$schema` link.
- [ ] Validates against [`../../schemas/theme.schema.json`](../../schemas/theme.schema.json)
      (all required `colors` and `sizes` tokens present; hex without `#`).
- [ ] Exactly **one** dominant + **one** accent; no rainbow.
- [ ] One `font.family` token; no per-textbox overrides.
- [ ] Every text-on-fill pairing checked for contrast (§3).
- [ ] Rendered a `cover` + one body preview and **shown it** for sign-off (§4).
- [ ] No structure, order, or wording anywhere in the theme (M-6).
