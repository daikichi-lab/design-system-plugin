#!/usr/bin/env node
/* summarize.js — aggregate-result.json → カテゴリ（tag）別の正答率テーブル。
 * 使い方: node summarize.js <path/to/aggregate-result.json>
 * 出力: 軸ごとの平均スコア・グレーダー別の落ち方（どの軸が弱いかが一目で出る）。 */
const fs = require("fs");

const file = process.argv[2];
if (!file) { console.error("usage: node summarize.js <aggregate-result.json>"); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(file, "utf8"));

const cases = (rep.cases || []).filter((c) => c.name !== "smoke");
const byTag = new Map();
for (const c of cases) {
  // tag is not in the report — recover it from the case dir's case.yaml
  let tag = "untagged";
  try {
    const y = JSON.parse(fs.readFileSync(`${__dirname}/${c.name}/case.yaml`, "utf8"));
    tag = (y.tags && y.tags[0]) || tag;
  } catch {}
  if (!byTag.has(tag)) byTag.set(tag, []);
  byTag.get(tag).push(c);
}

const pct = (x) => `${Math.round(x * 100)}%`;
let totalScore = 0;
console.log("axis                        cases  avg   skeleton  not-trap  struct");
console.log("--------------------------  -----  ----  --------  --------  ------");
for (const [tag, arr] of [...byTag.entries()].sort()) {
  const avg = arr.reduce((s, c) => s + c.score, 0) / arr.length;
  totalScore += arr.reduce((s, c) => s + c.score, 0);
  const gpass = (gname) => {
    let pass = 0, tot = 0;
    for (const c of arr) for (const r of c.runs || [])
      for (const g of r.graders || []) if (g.name === gname) { tot++; if (g.passed) pass++; }
    return tot ? pct(pass / tot) : "-";
  };
  console.log(
    `${tag.padEnd(26)}  ${String(arr.length).padStart(5)}  ${avg.toFixed(2)}  ` +
    `${gpass("correct-skeleton").padStart(8)}  ${gpass("not-trap").padStart(8)}  ${gpass("struct-word").padStart(6)}`);
}
console.log("--------------------------  -----  ----");
console.log(`TOTAL                       ${String(cases.length).padStart(5)}  ${(totalScore / cases.length).toFixed(2)}`);

// 弱い軸（skeleton正答が最も低い順）
const rows = [...byTag.entries()].map(([tag, arr]) => {
  let pass = 0, tot = 0;
  for (const c of arr) for (const r of c.runs || [])
    for (const g of r.graders || []) if (g.name === "correct-skeleton") { tot++; if (g.passed) pass++; }
  return { tag, rate: tot ? pass / tot : 0 };
}).sort((a, b) => a.rate - b.rate);
console.log("\n弱い軸（骨格正答率の低い順）→ T2ドリル補強の優先順位:");
for (const r of rows) console.log(`  ${pct(r.rate).padStart(4)}  ${r.tag}`);
