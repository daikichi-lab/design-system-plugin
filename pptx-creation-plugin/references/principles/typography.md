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

**The tracking principle behind those two values:** positive letter-spacing
exists for **small LATIN text set inside a Japanese deck** — an English kicker
at 12pt looks cramped without opened tracking (the house value is the kicker's
`+1.5`; wider still is legitimate for all-caps eyebrow labels). **Japanese body
text is never positive-tracked** — kana/kanji are designed to their em box and
opened tracking makes JP prose fall apart. The one JP exception is *display*
sizes: a large JP heading tolerates (and the house applies) a *slight negative*
tracking, which tightens without breaking. So: latin-small → open; JP body →
never; JP display → slightly tight. All of it lives in the helpers, never per
slide.

## 4. Digit alignment — tables, and the ledger trick outside them

§3 wants **等幅数字 (tabular figures)** so a table's numeric columns line up digit
for digit. **Known gap:** pptxgenjs exposes no OpenType `tnum` feature, so table
digits render in the face's default (proportional) figures. Yu Gothic's digits
are near-even and the numeric columns are right-aligned, so columns still read
cleanly; true tabular alignment would require a monospaced-digit face for the
numeric columns. Tracked as a typography-floor follow-up — do **not** fake it
with manual spacing (that is a per-textbox override, banned by §1.9).

**Outside a native table** — a ledger-style block inside a diagram or card
(e.g. a ミニ決算書: 科目名 + 金額 rendered as one text block) — the sanctioned
alignment technique is **全角スペース padding in the content string**: pad the
科目名 with full-width spaces so the amounts' heads line up. This is *content*
(it lives in the deck plan and survives any theme swap), not a per-textbox
format override, so it does not trip §1.9. It is the most robust way to align
digits in a non-monospaced JP face without reaching for a table. Prefer a
native `table` (right-aligned numeric columns) when the data genuinely is
rows-and-columns; reach for the 全角スペース ledger only inside composed
diagrams where a table doesn't fit.

## 4.5 Inline emphasis — two devices, nothing else

Within running text, word-level emphasis is limited to **two devices**:

1. **The manuscript's own quotation marks** — “ ” or 「」 carried through
   as-is (“防具”, “相談役”). Inheriting the speaker's notation reads as the
   speaker's voice; typographic re-marking does not.
2. **The accent color**, via the existing emphasis machinery — never an ad-hoc
   inline color.

Bold **is** the hierarchy's carrier (§1) — heads are bold *as a role*. What is
banned is bold *sprinkled inside body text* as improvised emphasis: it degrades
the weight-led hierarchy that lets a JP deck skip decoration. Never stack
devices (quoted AND colored AND bold); one device per emphasized word, and few
emphasized words per deck — inline emphasis obeys the same scarcity law as
element emphasis (`visual-psychology.md` §2: emphasize everything and nothing
is emphasized).

---

## 5. The size floor is set by the viewing environment, not by taste

The scale in §2 is the *shape*; its **floor** — the smallest size a deck may
use anywhere — is set by **who watches, on what, from how far** (誰が・何で・
どの距離で見るか). The same 12pt caption that is comfortable on a laptop
screen-share is invisible from the back row of a seminar room. Fix the scene
in the brief (deck-brief's 場面 slot), then check the scale against the floor:

| Scene | Absolute floor (caption / axis / table cells) | Body comfortable |
|---|---|---|
| Screen share・PC単独視聴 (13–15" laptop, ~50cm) | 若年 ~10pt / **60歳基準 ~15pt** | 16–21pt |
| 会場投影, viewing ratio R ≤ 6 (e.g. 120型・後列9m) | **~16pt** (`min pt ≈ 2.7 × R`) | 20–24pt |
| A4 print leave-behind (~40cm) | 若年 ~9pt / 60歳基準 ~13pt | 15pt+ |
| Online with smartphone viewers possible | body never below **10.5pt** | — |

Where the numbers come from (verified primary sources, 2026-07 research pass):
reading speed collapses below a critical print size of ~0.2° visual angle
(Legge & Bigelow 2011, *J. Vision*); JIS S 0032:2003 computes the Japanese
minimum-legible size from age × distance × typeface (gothic beats mincho;
kanji stroke density raises the floor; a 60-year-old needs ~1.5× a young
reader's size); and the projection floor `min pt ≈ 2.7 × viewing ratio`
derives from ANSI/INFOCOMM V202.01 (AVIXA DISCAS, farthest viewer = element
height × 200) on a 540pt-high 16:9 slide. Rules of thumb that follow:

- The neutral scale (cap 12 / body 15) fits **screen-share and print for
  young-to-middle-aged audiences** — the default assumption.
- **Projection or older audiences raise the floor, not the taste**: for a
  seminar-room deck, body wants 20pt+, and nothing — captions, chart axes,
  table cells — should sit under ~16pt at R=6. In-person 登壇 with unknown
  rooms: treat body 14pt as the bare minimum, and prefer the projection preset.
- A viewing ratio much past 6 (small screen, deep room) **cannot be fixed by
  the type scale** — at R=10 the floor is ~27pt and no normal deck survives;
  fix the screen or the seating, and say so rather than shipping unreadable.
- Density is environmental too: past ~7 parallel items an audience stops
  counting — the pattern capacities cap lower than that on purpose (§6 of
  `slide-design-principles.md`; catalog `capacity`).

The floor is a **scene-level decision recorded once** (brief → theme choice),
never a per-slide tweak — per-textbox size overrides stay banned (§1.9).

## 6. What is a constraint vs. a judgment

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
