# design-system-plugins

A **Claude Code plugin marketplace** (`daikichi-plugins`) that ships one plugin:

- **[`pptx-creation`](pptx-creation-plugin/)** — plans, composes, generates, and
  reviews high-quality PowerPoint (`.pptx`) decks, tuned for clean **Japanese
  business slides**. One engine, many decks; a bookshelf of design languages; a
  mandatory verification loop (lint + render + score) so a deck never ships
  broken. Full docs: **[pptx-creation-plugin/README.md](pptx-creation-plugin/README.md)**.

---

## Install (in Claude Code)

```text
# 1. add this marketplace
/plugin marketplace add daikichi-lab/design-system-plugin

# 2. install the plugin from it
/plugin install pptx-creation@daikichi-plugins
```

Or just run **`/plugin`** and pick **pptx-creation** from the menu. (Developing
locally? Point step 1 at the repo path instead: `/plugin marketplace add .`)

**Confirm it loaded:** run `/plugin` — `pptx-creation` shows as enabled, and its
skills are callable namespaced, e.g. `/pptx-creation:deck-brief`,
`/pptx-creation:create-deck`.

### Prerequisites (the engine + the QA render)

The skills shell out to a small Node engine and render for the QA loop, so the
machine that runs Claude Code needs:

| Need | For | Install |
|---|---|---|
| **Node.js** + the plugin's deps | `bin/generate.js` (pptxgenjs) | run `npm install` **once** in the plugin dir (path below) |
| **LibreOffice** (`soffice`) + **poppler** (`pdftoppm`) on PATH | QA render (PPTX→PDF→JPG) | your OS package manager · **no Java needed** |
| *(optional)* Playwright Chromium + **Yu Gothic** fonts | JP typesetting precision (`bake` / `typo-lint`) | `bin/layout-html/setup.sh`; without it the build **falls back gracefully** |

> **Where to `npm install`:** Claude Code does **not** auto-install a plugin's
> npm deps. A marketplace-installed plugin lives at
> `~/.claude/plugins/cache/daikichi-plugins/pptx-creation/<version>/` — `cd`
> there and run `npm install` once. (Developing locally? Run it in
> `pptx-creation-plugin/`.) Symptom if you skip it: a skill fails with
> *"Cannot find module 'pptxgenjs'."*

Details and the one-command pipeline are in the plugin README's
[*How to load it*](pptx-creation-plugin/README.md#how-to-load-it).

---

## First steps (right after installing)

1. **Make a deck — start here.** Run **`/pptx-creation:deck-brief`** and describe
   your goal in your own words (even vaguely). It asks only the few things it
   can't guess — **who it's for, the action you want, the one message, and which
   numbers are estimates** — then drives the rest: strategy → generation → the
   mandatory QA loop → a scored review. This intake is what sets the quality
   ceiling; see [*Writing the brief*](pptx-creation-plugin/README.md#writing-the-brief-the-input-that-sets-the-ceiling).

   > Already have clear requirements? Fill the brief template in that section and
   > call **`/pptx-creation:create-deck`** directly.

2. **See the bar.** Open
   [`pptx-creation-plugin/examples/seminar-kanrikaikei/`](pptx-creation-plugin/examples/seminar-kanrikaikei) —
   the reference render that defines "acceptable." Nothing you ship should look
   worse than it.

3. **Set up a project (optional).** To make a repo deck-ready with your own brand
   theme: **`/pptx-creation:project-scaffold`** then **`/pptx-creation:theme-init`**.
   Per-project content and themes live in *your* repo; the plugin stays generic.

The typical flow end to end:

```text
deck-brief → deck-strategy → create-deck (generate + QA loop) → deck-review (scored)
  intent        plan             the .pptx                        ship / fix
```

You don't need a perfect one-shot instruction — the verification loop and your
real-machine (PowerPoint) feedback refine it. Fixing **audience, goal-action,
message, and honesty** in the brief is enough to start.

---

## What's in this repo

```
design-system-plugin/
├── .claude-plugin/marketplace.json   # the marketplace manifest (daikichi-plugins)
├── pptx-creation-plugin/             # the plugin — engine, skills, references, themes, examples
│   └── README.md                     # full architecture + usage docs
└── README.md                         # you are here (install + first steps)
```

## License

MIT.
