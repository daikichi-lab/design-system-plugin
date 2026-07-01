# Design language: editorial

Magazine feel. Large **serif** headings, warm paper palette, generous leading —
a deck that reads like a considered article, not a slide dump.

- **Tokens** (`themes/editorial/theme.json`): warm cream bg `FBF8F3`, warm dark
  ink; a muted terracotta accent `A8442C`; large display (cover 50 / title 33);
  airy leading. Font: **heading = Yu Mincho (serif)**, body = Yu Gothic Medium,
  caption = Yu Gothic — the serif/gothic mix is the editorial signature.
- **Feels:** literary, human, premium. Whitespace and the serif carry it.
- **Use for:** brand/vision decks, thought-leadership, founder letters, seminars
  that want warmth.
- **Avoid for:** dense financial tables (the serif + air fight the data — use
  `data-driven`) and hard board packs (use `neutral-business`).

Serif headings still obey the AI-tell blocklist and kinsoku. Requires Yu Mincho
installed (setup.sh registers it on WSL2). See [`../../themes/editorial/theme.json`].
