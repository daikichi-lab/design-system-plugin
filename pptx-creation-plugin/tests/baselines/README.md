# tests/baselines — visual regression (spec §6-4)

Approved renders to diff against after a change, so an unintended pixel shift is
caught. The comparator is [`../../bin/lint/ssim.js`](../../bin/lint/ssim.js)
(structural similarity); the gate/no-regression driver is
[`../run-gate.sh`](../run-gate.sh).

## Two layers

1. **Cheap, always-on (in `run-gate.sh`):** every shipped example must
   design-lint **PASS** and generate cleanly under a change. This catches broken
   palettes, capacity breaks, and engine throws without storing any images.
2. **Pixel regression (opt-in):** render a deck to PNG (`bin/qa.sh` → `pdftoppm
   -png`), then `node bin/lint/ssim.js baseline.png current.png` — a drop below
   the threshold flags drift; the region shows where.

## Why no PNGs are committed here

Baseline PNGs are heavy and font-dependent (soffice substitutes the face, so the
pixels aren't the real-PowerPoint pixels anyway — see `layout-html/README.md`).
So the plugin keeps the **cheap layer** as the shipped regression gate, and each
**project** stores its own approved renders under `assets/baselines/` and runs
`ssim.js` against them (separation principle — the plugin holds the comparator,
the project holds its pixels). Drop approved PNGs here only for a specific,
intentionally-tracked reference.
