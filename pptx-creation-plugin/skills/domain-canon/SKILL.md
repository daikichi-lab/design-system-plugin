---
name: domain-canon
description: >
  Build a domain's canonical-forms catalog (docs/canon/<domain>.md in the
  PROJECT repo): map the field's recurring concepts (BS, STRAC, 損益分岐点,
  必要保障額, funnel …) to the diagram forms practitioners actually use, gated
  by the structure-word / symbol-erasure / honesty tests, and file engine GAPs
  as recipe proposals. Run once per new domain (after design-doc), or mid-project
  when deck-strategy hits a concept with no mapping. The catalog is domain
  content — it never enters the plugin.
---

# domain-canon — 特定領域の「図の正準形」をナレッジ化するスキル

**Job:** For a domain the project will make decks in (会計, FP, 保険, 医療, 採用,
SaaS metrics …), build the **canonical-forms catalog** — the mapping from the
domain's recurring concepts to the diagram forms its practitioners actually use
— and write it to the PROJECT repo as `docs/canon/<domain>.md`.

**Why this exists.** 図解の形は原稿から導出できない (visual-psychology.md §3.5):
the manuscript gives you the *relation* (資産−負債＝純資産); which *shape* renders
it is field knowledge (the BS box, STRAC, the CVP cross). A model that lacks the
canonical form fills the gap with the safest literal translation — boxes joined
by ＝, i.e. 額装. The catalog is the retrieval key that makes the right form
fire **every time**, not just when the generating model happens to recall it.

**Where the knowledge lives (hard rule).** The catalog is DOMAIN CONTENT, not
engine machinery — it goes in the *user's* repo (`docs/canon/`), never into the
plugin (the same split as `design-doc` → project `DESIGN.md`; the plugin stays
generic, M-6 spirit). The plugin only ever gains **generic skeletons** that a
catalog line maps to. A worked example catalog lives at
[`../../../docs/canon/accounting-fp-insurance.md`](../../../docs/canon/accounting-fp-insurance.md).

## When to run

- Scaffolding a project in a new domain (right after `design-doc`).
- `deck-strategy` hits a beat whose concept has no mapping (mid-project top-up).
- A domain expert hands you forms to codify ("うちの業界ではこう描く").

## Procedure

1. **Inventory the concepts.** From the project's manuscripts (and the expert):
   list the domain's *recurring* concepts that will need visual treatment —
   aim for the 10–25 that cover ~90% of decks, not an encyclopedia.
2. **Name each concept's canonical form.** Prefer, in order: (a) what the
   domain's practitioners/textbooks actually draw (name it — STRAC, CVP,
   デュポン分解); (b) research when unsure (never invent a form and present it
   as the field's convention); (c) **ask the human** when sources conflict.
3. **Gate every candidate** — a form enters the catalog only if it passes:
   - **構造1語テスト**: the structure names in one word (sequence / loop /
     two-axis / identity / bridge / system / relation / ranking / share …).
   - **記号消去テスト**: erase ＝ ＋ − → and the relation still reads
     (visual-psychology §3.5 — 額装 is not a canonical form).
   - **honesty check**: note what the form may claim only with data
     (proportional areas need full values; a schematic needs its ※模式図;
     ranking bars are true-scale). Write it in the catalog's honesty column.
4. **Map to a skeleton.** Point each form at an engine pattern
   (`references/patterns/catalog.md`, `references/graphics/diagram-recipes.md`).
   No fit → **GAP台帳** に記録 (see the example catalog's last section):
   never hand-draw around the engine (M-7); until implemented, name the
   fallback (a neighboring pattern, or text).
5. **Emit `docs/canon/<domain>.md`** in the project repo — a table per
   sub-domain: 概念｜正準形（実務の呼び名）｜骨格/パターン｜honesty・容量の注意,
   plus the 採用ガード header and the GAP台帳. Keep rows terse; the recipes
   themselves live in the plugin's references.
6. **File the GAPs as engine proposals** in diagram-recipes.md's format
   (yaml contract + capacity + floor + look + the Verified conditions it must
   meet) — a proposal ships only through the normal gate (engine + catalog +
   torture + run-gate, per CLAUDE.md).

## Guards (MUST)

- **発明しない**: a form no practitioner uses is not "canonical" — it is a
  design experiment and needs the human's explicit sign-off, marked as such.
- **プラグインを汚さない**: domain rows never enter the plugin's references;
  only generic skeletons do (via proposals).
- **honesty は正準形でも免除されない**: the field's habit of, e.g., truncated
  axes does not override chart-design §4 — the catalog codifies the form,
  house rules govern the claims.
- **1概念1行**: if a concept seems to need two forms, it is two concepts
  (split the row) or the structure test failed (re-classify).

## Output contract

`docs/canon/<domain>.md` with: (1) 採用ガード header linking the three tests,
(2) mapping tables (概念/正準形/骨格/注意), (3) GAP台帳 with proposal直下の方向,
(4) a "last reviewed" date — the catalog is a living document; corrections from
each project's deck-review feed back into it (the same calibration loop as
DESIGN.md).
