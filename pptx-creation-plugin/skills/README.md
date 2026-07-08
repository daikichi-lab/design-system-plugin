# skills/ — the agent-facing playbooks

Eight skills, one pipeline. Each `skills/<name>/SKILL.md` is the **single
definition file** (frontmatter `description` = when Claude invokes it; body =
the playbook). This README is only a **hub** — it duplicates nothing; when in
doubt, the SKILL.md wins.

## The pipeline

```
                       once per project                    per deck
            ┌────────────────────────────────┐   ┌─────────────────────────────────────┐
 project-scaffold → design-doc → theme-init  →  deck-brief → deck-strategy → create-deck → deck-review
   (empty shelves)   (DESIGN.md)  (theme.json)    (intent)     (deck plan)     (generate      (score)
                          ▲                           │                         + QA loop)
                          └── design-language ────────┘
                              (pick ONE style from the bookshelf — feeds both)
```

- **Once per project:** `project-scaffold` (folders, never overwrites) →
  `design-doc` (the standing `DESIGN.md` — required, template level) →
  `theme-init` (the project `theme.json`). `design-language` picks the style
  the other two record.
- **Per deck:** `deck-brief` (reads `DESIGN.md`, asks only the per-deck delta)
  → `deck-strategy` (plan) → `create-deck` (build + mandatory QA loop) →
  `deck-review` (banded score). A tiny one-slide ask may skip strategy;
  nothing skips the QA loop.

The pipeline is **three bundles**, and knowing which bundle a step belongs to
tells you how to fix it when output surprises:

- **思考 (thinking)** — `deck-brief` / `deck-strategy`: extracting meaning and
  relations from the manuscript (spine, 7-way beat classification, emotional
  turning points, emphasis choices). The ONLY bundle that can wobble — its
  outputs (the plan, the turning-point list in `notes`) are the intermediate
  artifacts a human approves before generating.
- **規約 (convention)** — `design-doc` / `theme-init` / `design-language` +
  the lints: tokens, prohibitions, coordinates. Fully mechanical.
- **工程 (process)** — `create-deck` / `deck-review`: build, QA, score. Fully
  mechanical.

When a deck comes out wrong, the fix is almost never in 規約/工程 code — it is
in the 思考 bundle's classification (re-map the beat, re-pick the turning
point). Push judgment upstream; keep everything downstream a pure mapping.

## The eight skills

| Skill | One job | Reads | Emits |
|---|---|---|---|
| [`project-scaffold`](project-scaffold/SKILL.md) | make a project repo deck-ready (docs/ · theme stub · outputs/ · figures 規約) | — | folders (+ `.example` on conflict, never overwrites) |
| [`design-doc`](design-doc/SKILL.md) | author the project's standing design system (brand, presets incl. register/personStyle, honesty rules, bar) | brand material, the bookshelf | `DESIGN.md` (template level — a sketch does not count) |
| [`theme-init`](theme-init/SKILL.md) | create the project's visual identity — look-and-feel ONLY (M-6) | logo / DESIGN.md §2 | `theme.json` + a 1-slide preview |
| [`design-language`](design-language/SKILL.md) | pick ONE style language from the bookshelf | `references/design-languages/` | the choice, recorded in DESIGN.md / theme |
| [`deck-brief`](deck-brief/SKILL.md) | turn a vague ask into a complete brief (11 slots: audience … register & persons) — the intake that sets the ceiling | `DESIGN.md`, the user | the filled brief |
| [`deck-strategy`](deck-strategy/SKILL.md) | brief + 原稿 → validated deck plan (spine, frame, patterns, emphasis/peak, register/様式, wording) | brief, catalog, figures-index | `deck_plan.json` |
| [`create-deck`](create-deck/SKILL.md) | run the gated pipeline (`bin/build.sh`) + the mandatory render-and-LOOK QA loop (M-2/M-4) | plan + theme | `.pptx` + `qa/` renders |
| [`deck-review`](deck-review/SKILL.md) | score against the house bar; 重点確認 (emphasized claims, register & persons) is the human half | pptx + plan + QA result | `deck_review` JSON (reject / internal / external) |

## The boundaries (each skill stays in its lane)

- **deck-brief = intent only.** No patterns, no colours, no rendering.
- **deck-strategy = structure + wording, theme-agnostic.** A correct plan
  renders under any conforming theme; geometry never travels through the plan.
- **theme-init / design-language = look-and-feel only (M-6).** A theme never
  carries chapter structure, slide order, or wording.
- **create-deck = build + QA, no re-planning.** Content breaks bounce back to
  the plan; an unfixable break stops and reports (M-4), never ships.
- **deck-review = observe and score, never silently fix.**
- Design norms live in `references/` and the SKILL bodies — never in
  `CLAUDE.md` (M-5) and never duplicated here.
