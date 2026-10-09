import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { irelandRal, irelandRecords, validateRecord, irelandAnswer } from '../dist/lib/global.js';
import { answerTapWater } from '../dist/lib/pipeline.js';

process.env.ECHO_LIVE_SOURCE = 'off';

describe('Ireland Remedial Action List import', () => {
  it('matches the EPA report totals (35 supplies, ~467,000 people)', () => {
    const rows = irelandRal();
    assert.equal(rows.length, 35);
    const people = rows.reduce((a, r) => a + r.pop, 0);
    assert.ok(Math.abs(people - 467000) < 1000, `people ${people}`);
    assert.ok(rows.every((r) => /^\d{4}PUB\d{4}$/.test(r.code) && r.county && r.name && r.reasons.length));
  });
  it('converts to valid Open Water Records', () => {
    for (const r of irelandRecords()) assert.deepEqual(validateRecord(r), []);
    assert.deepEqual(validateRecord({ country: 'Ireland', systemId: '', name: 'x', region: '', population: -1, exceedances: [], actions: [] }).length, 3);
  });
});

describe('Ireland in chat', () => {
  it('names listed supplies for a county', () => {
    const a = irelandAnswer('Is Limerick water on the at-risk list in Ireland?');
    assert.match(a.markdown, /Limerick City Environs/);
    assert.match(a.markdown, /126,790/);
    assert.match(a.markdown, /\(#\/global\)/);
  });
  it('gives the national picture without a county, and ignores non-Irish questions', () => {
    assert.match(irelandAnswer('Is Irish tap water safe?').markdown, /35 public supplies/);
    assert.equal(irelandAnswer('Is there lead in Limerick, Maine?'), null);
  });
  it('routes through the pipeline as a redirect, and other countries point to #/global', async () => {
    const r = await answerTapWater({ question: 'Which supplies in Kerry, Ireland are at risk?' });
    assert.equal(r.scope, 'redirect');
    assert.match(r.answer.markdown, /Co\. Kerry has \d+ supplies/);
    const fr = await answerTapWater({ question: 'Is tap water safe in France?' });
    assert.match(fr.answer.markdown, /#\/global/);
  });
});
