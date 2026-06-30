#!/usr/bin/env node
/* ============================================================
 *  validate.js — dev helper. Validates theme / deck-plan / review
 *  JSON against the schemas in schemas/.
 *
 *  Usage:
 *    node bin/validate.js                       # validate all shipped examples
 *    node bin/validate.js --theme <t.json>      # validate one theme
 *    node bin/validate.js --plan <p.json>       # validate one deck plan
 *    node bin/validate.js --review <r.json>     # validate one review
 *
 *  Requires the dev dependency `ajv` (npm install). Not needed at runtime —
 *  the engine itself fails loudly on a bad plan/theme; this is a pre-flight.
 * ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

let Ajv;
try {
  Ajv = require("ajv");
} catch (e) {
  console.error("validate.js needs the dev dependency 'ajv'. Run: npm install");
  process.exit(2);
}

const ROOT = path.join(__dirname, "..");
const rd = (p) => JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(ROOT, p), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });

const validators = {
  theme: ajv.compile(rd("schemas/theme.schema.json")),
  plan: ajv.compile(rd("schemas/deck_plan.schema.json")),
  review: ajv.compile(rd("schemas/deck_review.schema.json")),
};

let failures = 0;
function check(kind, file) {
  const v = validators[kind];
  let data;
  try { data = rd(file); } catch (e) { console.log(`FAIL  [${kind}] ${file}\n   cannot read: ${e.message}`); failures++; return; }
  const ok = v(data);
  console.log(`${ok ? "PASS " : "FAIL "} [${kind}] ${file}`);
  if (!ok) {
    failures++;
    for (const err of v.errors) console.log(`   ${err.instancePath || "(root)"} ${err.message}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  // validate everything shipped
  check("theme", "themes/_default-neutral/theme.json");
  check("theme", "examples/theme-swap-demo/theme.json");
  check("plan", "examples/seminar-kanrikaikei/deck_plan.json");
  check("plan", "examples/financial-analysis/deck_plan.json");
  check("review", "examples/seminar-kanrikaikei/deck_review.json");
} else {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--theme") check("theme", args[++i]);
    else if (args[i] === "--plan") check("plan", args[++i]);
    else if (args[i] === "--review") check("review", args[++i]);
    else { console.error(`unknown arg: ${args[i]}`); process.exit(2); }
  }
}
process.exit(failures ? 1 : 0);
