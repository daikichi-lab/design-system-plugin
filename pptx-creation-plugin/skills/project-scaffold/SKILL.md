---
name: project-scaffold
description: Use to make a project repo deck-ready. Creates docs/ (manuscript templates), a schema-conformant theme.json stub, and outputs/. Never overwrites existing files — emits conflicts as .example so nothing is clobbered.
---

# project-scaffold

Stand up the **folders a project repo needs to start making decks**, and
nothing more. This skill is the first step in a project's life: run it once, in
the project repo, and you get a place for raw manuscript (原稿), a starting
`theme.json`, and a landing zone for generated `.pptx` files. After it, the
real work flows through the other skills.

This skill is **plumbing, not design.** It writes no chapter structure, no
slide order, no wording, and it never invents a brand palette beyond cloning the
neutral default. Those are decided later by `theme-init` (look-and-feel) and
`deck-strategy` (structure + wording) — never here, and never in `CLAUDE.md`
(M-5, M-6).

> The plugin ships brand-free and template-free. A *project* repo is where a
> brand and its decks live. This skill builds that repo's empty shelves; it
> does not stock them.

---

## 1. What gets created

In the **project repo** (not the plugin), create three things:

1. **`docs/`** — raw input for decks: a manuscript / 原稿 template per usecase,
   plus a `README.md` describing the per-project flow (§3). Manuscript is the
   human-written source `deck-strategy` reads to build a plan; it is *not* a
   deck plan and carries no layout.
2. **`theme.json`** — a schema-conformant starting theme: a clone of the
   plugin's neutral default with an **empty** `brand.footerLabel` (the project
   fills it in `theme-init`). It validates against
   [`../../schemas/theme.schema.json`](../../schemas/theme.schema.json) on day
   one, so the engine runs before any branding work is done.
3. **`outputs/`** — where generated decks land (`outputs/*.pptx` and their QA
   renders). Keep it out of the way of source so a rebuild never clobbers input.
4. **`assets/generated/figures/`** *(only when the project will use persons —
   persona/dialogue/testimonial)* — the landing zone for **user-supplied**
   figure assets, with two record files the floors read:
   `figures-index.md` (the inventory + scene→figure catalog — the reviewer's
   only window into what's inside) and a per-set `LICENSE.md` (出所・帰属要否・
   商用可否 — the LICENSE lint WARNs until a real record exists; **never write
   an empty one just to silence it**). Supplied assets stay in the PROJECT repo
   and out of git if their license forbids redistribution (ソコスト等).

That is the whole scaffold. Resist adding more — extra folders become clutter
the project never uses.

---

## 2. SAFETY — never overwrite (hard rule)

**This skill must not clobber a single existing file.** A project repo may
already have a `docs/`, a hand-tuned `theme.json`, or its own `outputs/`. For
every target:

- If the path **does not exist**, write it normally.
- If the path **already exists**, write the new content to `<name>.example`
  instead (e.g. `theme.json.example`, `docs/README.md.example`) and **tell the
  user** that the original was kept and a `.example` was emitted for them to
  diff and merge by hand.

Never edit-in-place, never merge silently, never delete. When in doubt, emit
`.example` and report. The user's existing files are sacred.

---

## 3. The per-project workflow (put this in `docs/README.md`)

The scaffold exists to feed a fixed four-skill pipeline. Spell it out in
`docs/README.md` so anyone opening the repo knows the order and where each
artifact lives:

```
[deck-brief] →  theme-init  →  deck-strategy  →  create-deck  →  deck-review
 (intake)        (look)         (structure)       (generate)      (score)
```

(`deck-brief` is the front door for vague asks — it fixes audience, goal,
message, honesty labels, register (`meta.intent`) and person style
(`meta.personStyle`) before any structure exists. Skip it only when the
request already arrives as a complete brief.)

| Step | Skill | Reads | Produces | Lives in |
|---|---|---|---|---|
| 1 | [`theme-init`](../theme-init/SKILL.md) | logo / brand material, the neutral default | the project palette, fonts, sizes | **`theme.json`** |
| 2 | [`deck-strategy`](../deck-strategy/SKILL.md) | your manuscript in `docs/` | a validated, ordered pattern list | **a `deck_plan.json`** |
| 3 | `create-deck` | the deck plan + `theme.json` | the rendered deck (runs the QA loop, M-2) | **`outputs/<name>.pptx`** |
| 4 | `deck-review` | the rendered deck + its QA images | a scored review against the house bar | (a review report) |

Notes for the README:

- **`docs/` holds content only** — manuscript / 原稿, notes, transcripts. No
  colors, no layout. (`deck-strategy` turns it into a plan; the plan shape is
  [`../../schemas/deck_plan.schema.json`](../../schemas/deck_plan.schema.json).)
- **`theme.json` holds look-and-feel only** — colors, font, sizes, canvas, and
  at most `brand.footerLabel`. Never chapter structure or slide order (M-6).
- **`outputs/` holds generated decks** — `.pptx` plus QA renders. Treat it as
  derived: it can always be rebuilt from `docs/` + a plan + `theme.json`.
- The deck plan itself (`deck_plan.json`) is an intermediate `deck-strategy`
  emits and `create-deck` consumes; keep it beside the manuscript it came from
  (e.g. `docs/<deck>/deck_plan.json`) so plan and source stay together.
- `create-deck` is where the **mandatory QA loop** runs (render → look → fix →
  re-render); if a layout break can't be cleanly fixed it **stops and reports**
  rather than ship a compromised slide (M-4). The bar is
  [`../../references/principles/house-quality-bar.md`](../../references/principles/house-quality-bar.md).

---

## 4. Recommended project layout

After scaffolding, a healthy project repo looks like this:

```
my-project/
├── docs/                       # content / manuscript (原稿) — input only
│   ├── README.md               # the flow above; how this repo makes decks
│   ├── _manuscript-template.md # blank 原稿 to copy per deck
│   └── seminar/                # one folder per deck/usecase
│       ├── manuscript.md       #   the human-written source
│       └── deck_plan.json      #   deck-strategy's output → create-deck's input
├── theme.json                  # the project's visual identity (theme-init)
└── outputs/                    # generated decks land here
    ├── seminar.pptx            #   create-deck's output
    └── qa/                      #   QA renders (PPTX → PDF → JPG), qa.sh default
```

The per-deck subfolder under `docs/` keeps each deck's manuscript and plan
together; small projects can keep a single `docs/manuscript.md` +
`docs/deck_plan.json` instead. Generated `.pptx` always lands under
`outputs/` — the engine is invoked with `--out outputs/<name>.pptx` (CLI per
[`../../bin/generate.js`](../../bin/generate.js)). `bash bin/qa.sh
outputs/seminar.pptx` renders into `outputs/qa/` by default (its 2nd positional
arg overrides the dir — e.g. `outputs/seminar.qa` — when one `outputs/qa/`
would collide across multiple decks).

---

## 5. The `theme.json` stub

Clone the neutral default verbatim, then blank the footer label so the project
supplies its own in `theme-init`:

```jsonc
{
  "$schema": "<relative path to schemas/theme.schema.json>",
  "name": "neutral-business",     // rename to the project in theme-init
  "canvas": { "w": 13.333, "h": 7.5, "margin": 0.7 },
  "font":   { "family": "Meiryo" },
  "colors": { /* …the 15 required role tokens, copied from the default… */ },
  "sizes":  { /* …the 15 required size tokens, copied from the default… */ },
  "brand":  { "footerLabel": "" }   // empty until the project sets it
}
```

Source the full token set from the neutral default —
[`../../themes/_default-neutral/theme.json`](../../themes/_default-neutral/theme.json) —
and keep the `$schema` link so editors validate. Do **not** invent colors here;
the stub is deliberately neutral so the engine runs immediately and `theme-init`
owns the actual brand work. Leave `canvas`, `sizes`, and the token *structure*
alone — they are tuned to the patterns in
[`../../references/patterns/catalog.md`](../../references/patterns/catalog.md).

---

## Checklist before you finish

- [ ] `docs/`, `theme.json`, and `outputs/` created in the **project** repo
      (never in the plugin).
- [ ] **No existing file overwritten** — every conflict emitted as `<name>.example`
      and reported to the user (§2).
- [ ] `theme.json` stub validates against
      [`../../schemas/theme.schema.json`](../../schemas/theme.schema.json), with a
      `$schema` link and an empty `brand.footerLabel`.
- [ ] `docs/README.md` documents the `theme-init → deck-strategy → create-deck →
      deck-review` flow and where each artifact lives.
- [ ] No structure, slide order, or wording written anywhere (M-6); no design
      norms placed in `CLAUDE.md` (M-5).
