// scripts/eval.mjs — guardrail regression gate (supports #7).
// Runs evals/guardrail-cases.json against the built audit. Exit nonzero on mismatch.
import { readFile } from 'node:fs/promises';
import { auditLlmNarrative, buildResolverFacts } from '../dist/lib/guardrails.js';
import { mockSchematic } from '../tests/fixtures.js';

const { cases } = JSON.parse(await readFile(new URL('../evals/guardrail-cases.json', import.meta.url), 'utf8'));
const schematic = mockSchematic();
const resolverOutput = { schematic, extractedFacts: buildResolverFacts(schematic) };

let failed = 0;
for (const c of cases) {
  const result = auditLlmNarrative(c.text, resolverOutput);
  const ok = result.isValid === c.expectValid;
  if (!ok) {
    failed++;
    console.error(`MISMATCH ${c.id} (expected valid=${c.expectValid}): ${c.text}`);
    for (const v of result.violations) console.error(`   - ${v}`);
  } else {
    console.log(`ok ${c.id}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} eval cases agree`);
if (failed > 0) process.exit(1);
