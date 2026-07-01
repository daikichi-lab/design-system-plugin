# Typography — the unchanging floor

`house-quality-bar.md` §1.9 says the deck's type is *one managed token, no
per-textbox overrides*. This file is that rule made concrete: the **weight-led
hierarchy, the modular size scale, and the leading tokens** that every pattern
builder references and no builder hardcodes. It is a **hard constraint** (spec
§4-4, `hybrid-architecture.md` §2b): the values live in `theme.json` and
`bin/generate.js` reads them — you cannot author a slide that ignores them.

> Hierarchy comes from **weight and size**, not from color bands or underlines.
> A heading is a heading because it is heavier and larger — not because it has a
> rule under it (that is an AI-tell, house bar §2).

Promoted from the verified `build_deck_v2.js` typography pass onto the neutral
default. The concrete values below are the neutral theme; a project theme may
override any of them, but must keep the *shape* (one heading face, one body
face, a tight-heading / airy-body leading split).

---

## 1. Weight-led hierarchy (`font.*`)

Japanese hierarchy reads best through **weight**, not decoration. Three faces,
one family:

| Token | Neutral value | Used for |
|---|---|---|
| `font.heading` | `Yu Gothic` (rendered **bold**) | kicker, title, section title, item head, comparison label, stat value/label, chart takeaway head, CTA offer head, table header, number-circle |
| `font.body` | `Yu Gothic Medium` | lead paragraph, bullets, roles, sub-copy, chart takeaway body, table body cells, chart axis/data labels — **Medium reads better than Regular for JP body** |
| `font.caption` | `Yu Gothic` (regular) | footer, page number, stat caption, table note, contact line |

- The engine resolves faces per role in `loadTheme`; **any role a theme omits
  falls back to `font.family`**, so a single-family theme keeps working
  unchanged. `font.family` is also the base/fallback.
- **Local-render caveat (spec §5):** on Linux, LibreOffice **substitutes** Yu
  Gothic with a fallback sans in the QA render — the `.pptx` still names Yu
  Gothic and resolves correctly in the user's PowerPoint. The **final typeface
  arbiter is real PowerPoint**, never the soffice preview. Judge *layout* from
  the QA render; judge the *face* on the target machine.

## 2. Modular size scale (`sizes.*`, points)

Sizes step on a ~1.26 ratio with intentional stops, not arbitrary values:

```
cap 12  →  small 13.5  →  body 15  →  head 19  →  compareLabel 23  →  title 30  →  cover 44
```

Display sizes sit off the ladder on purpose: `message` 32 (centered statement /
CTA title), `stat` 64 (the one big number), `sectionTitle` 36, `sectionIndex`
150 (watermark). `kicker` is a quiet 12. Every one is a token — builders never
write a point size.

## 3. Leading (`lead.*`, line-spacing multipliers)

The split that makes JP text breathe without headings feeling loose:

| Token | Neutral value | Role |
|---|---|---|
| `lead.title` | 1.08 | headings — **tight** (a large JP heading with loose leading looks broken) |
| `lead.display` | 1.18 | centered message statement |
| `lead.body` | 1.60 | body paragraphs — **airy**; JP body wants the air |
| `lead.caption` | 1.50 | captions / muted multi-line |
| `lead.tight` | 1.40 | compact multi-line: bullets, sub-rows, offer body |

Rule of thumb (spec §3): **body 1.5–1.7, headings 1.05–1.12.** Titles also carry
a slight negative tracking (`charSpacing -0.2`) and kickers a positive one
(`+1.5`) — set in the `title`/`kicker` helpers, not per slide.

## 4. Tabular figures — intended, not yet enforced

§3 wants **等幅数字 (tabular figures)** so a table's numeric columns line up digit
for digit. **Known gap:** pptxgenjs exposes no OpenType `tnum` feature, so table
digits render in the face's default (proportional) figures. Yu Gothic's digits
are near-even and the numeric columns are right-aligned, so columns still read
cleanly; true tabular alignment would require a monospaced-digit face for the
numeric columns. Tracked as a typography-floor follow-up — do **not** fake it
with manual spacing (that is a per-textbox override, banned by §1.9).

---

## 5. What is a constraint vs. a judgment

Per the §4-4 bisection (`hybrid-architecture.md`): everything above is **hard
constraint** — tokenized, engine-read, guaranteed. What stays **judgment** (the
strategist's / reviewer's call) is *which* size a given beat wants within the
scale, and whether a title should break to two lines — that is content, decided
in the deck plan, not a font override. **Line-breaking itself is a separate hard
constraint — see [`kinsoku.md`](kinsoku.md).**

## See also

- [`house-quality-bar.md`](house-quality-bar.md) — §1.9 fonts-as-one-token (this
  file is its weight-led extension); §2 the AI-tell blocklist (no underlines/bands
  standing in for hierarchy).
- [`whitespace.md`](whitespace.md) — the spacing/leading's companion; margins and
  density budget.
- [`kinsoku.md`](kinsoku.md) — where the *breaks* between these lines are decided.
- [`hybrid-architecture.md`](hybrid-architecture.md) — §4-4, why this is code, not prose.
