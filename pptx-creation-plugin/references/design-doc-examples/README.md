# design-doc examples — the required bar for a project's DESIGN.md

Five reference `DESIGN.md` files at **template level** (Apple / BMW M / Claude /
Nike / Slack). The [`design-doc`](../../skills/design-doc/SKILL.md) skill MUST
produce a document matching this structure and depth — these define the bar,
not a nice-to-have.

What "template level" means (see any file here):

- **YAML frontmatter** with the full token dump: every colour as bare hex,
  every typography role with family / size / weight / lineHeight /
  letterSpacing, spacing and radius scales.
- **Prose sections** where every colour token reappears with a usage rule
  (where it is used, where it is not), the type hierarchy is specified role by
  role with principles and honest font substitutes, components get per-component
  specs, and Do's/Don'ts carry their *why*.
- **Known Gaps** — unconfirmable facts are recorded honestly, never faked.

These examples describe web/marketing surfaces; `design-doc` adapts the
component and responsive sections to the deck surface (cover〜footer,
16:9投影 / PDF配布 / モノクロ印刷) — the SKILL documents the mapping.

Provenance: dropped by the project owner at `docs/design-file-template/` in the
repo root (2026-07-05) and copied here so marketplace-installed plugins ship
them (only the plugin directory reaches the cache). If the originals are
updated, re-copy them here.
