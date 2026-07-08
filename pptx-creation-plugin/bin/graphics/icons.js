/* icons.js — the governed pictogram registry (M-8 discipline).
 *
 * WHAT AN ICON IS ALLOWED TO BE HERE: a ROLE MARKER — it names WHO/WHAT a node
 * is (経営者, 銀行, 書類, 保障), never a decoration of a number or a mood.
 * 文字記号（✕ → ＝ 数字）で足りる情報に絵を使わない (visual-psychology §3.5);
 * an icon earns its place only when the node is an ACTOR or an OBJECT category.
 *
 * Registry-only: unknown names hard-error in design-lint, so decks cannot
 * drift into clipart. All icons are single-color line pictograms on a 24×24
 * grid, colorized with a THEME TOKEN at build time (never a literal).
 * Projects with their own SVG assets keep using file paths (`icon:
 * "assets/icons/x.svg"` — the existing iconSlot contract); curated additions
 * to this registry go through the normal engine-proposal gate.
 */

const P = {
  // 人・組織
  person:   "M12 5.2a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z M4.8 19.2c0-3.4 3.2-5.4 7.2-5.4s7.2 2 7.2 5.4",
  people:   "M8.6 6.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z M2.6 18.4c0-2.9 2.7-4.5 6-4.5 1.2 0 2.3.2 3.3.6 M15.4 7.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z M11.6 18.4c0-2.6 1.7-4.1 3.8-4.1 3 0 5.6 1.5 5.6 4.1",
  company:  "M5 20V5.6C5 5 5.4 4.6 6 4.6h7c.6 0 1 .4 1 1V20 M17 20v-9.4c0-.6.4-1 1-1h1c.6 0 1 .4 1 1V20 M3.4 20h17.2 M7.6 7.6h1.6 M10.8 7.6h1.6 M7.6 10.8h1.6 M10.8 10.8h1.6 M7.6 14h1.6 M10.8 14h1.6",
  bank:     "M3.6 9.4 12 4.4l8.4 5H3.6Z M5.4 9.4v7.2 M9.8 9.4v7.2 M14.2 9.4v7.2 M18.6 9.4v7.2 M3.6 16.6h16.8 M3 19.4h18",
  // モノ・書類・カネ
  document: "M6.4 3.6h7.4l3.8 3.8V20.4H6.4V3.6Z M13.8 3.6v3.8h3.8 M8.8 11h6.4 M8.8 14h6.4 M8.8 17h4.2",
  coin:     "M12 3.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4Z M9 8.2l3 4 3-4 M12 12.2v4.4 M9.6 12.6h4.8 M9.6 15h4.8",
  house:    "M4 11.4 12 4.6l8 6.8 M6.2 10v9.4h11.6V10 M10.2 19.4v-5.2h3.6v5.2",
  car:      "M5 15.4l1.4-4.6c.2-.7.8-1.2 1.6-1.2h8c.8 0 1.4.5 1.6 1.2L19 15.4 M3.8 15.4h16.4v3.4h-2.4 M6.2 18.8H3.8v-3.4 M7.6 18.8a1.5 1.5 0 1 0 0-.01 M16.4 18.8a1.5 1.5 0 1 0 0-.01",
  // 概念
  shield:   "M12 3.8c2.6 1.4 5 2 7 2.2 0 6.6-2.4 11.4-7 14.2-4.6-2.8-7-7.6-7-14.2 2-.2 4.4-.8 7-2.2Z M9 11.6l2.2 2.2 3.8-4",
  heart:    "M12 19.6C7 15.8 4 12.9 4 9.7 4 7.4 5.8 5.6 8 5.6c1.6 0 3 .8 4 2.2 1-1.4 2.4-2.2 4-2.2 2.2 0 4 1.8 4 4.1 0 3.2-3 6.1-8 9.9Z",
  calendar: "M4.6 6.4h14.8v13.2H4.6V6.4Z M4.6 10h14.8 M8.4 4.2v3.6 M15.6 4.2v3.6 M8 13.2h1.6 M11.2 13.2h1.6 M14.4 13.2h1.6 M8 16.4h1.6 M11.2 16.4h1.6",
  target:   "M12 4.4a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2Z M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z M12 11.4a.8.8 0 1 0 0 1.2",
  chart:    "M4.4 4.6v14.8h15.2 M8.2 16.2v-4.4 M12 16.2V8.6 M15.8 16.2v-6 M8.2 9.2l3.8-3 3.8 2.2 3.4-3.4",
};

const ICON_NAMES = Object.keys(P);

function iconSvg(name, hex) {
  const d = P[name];
  if (!d) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="#${hex}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">` +
    d.split(" M").map((seg, i) => `<path d="${i ? "M" + seg : seg}"/>`).join("") + `</svg>`;
}

function iconDataUri(name, hex) {
  const svg = iconSvg(name, hex);
  if (!svg) return null;
  return "image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

module.exports = { ICON_NAMES, iconDataUri, iconSvg };
