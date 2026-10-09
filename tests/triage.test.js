import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { triage, stateInText, TRIAGE_ASK_RE } from '../dist/lib/triage.js';
import { answerTapWater } from '../dist/lib/pipeline.js';
import handler from '../dist/api/triage.js';

process.env.ECHO_LIVE_SOURCE = 'off';

describe('Triage queue', () => {
  it('ranks every scored system nationally, highest forecast first', () => {
    const t = triage({ limit: 20 });
    assert.ok(t.inScope > 9000);
    assert.equal(t.rows.length, 20);
    for (let i = 1; i < t.rows.length; i++) assert.ok(t.rows[i - 1].p >= t.rows[i].p);
    assert.ok(t.summary.flagged > 800 && t.summary.flagged < 1100);
    assert.ok(t.meta.curve.model[5] > t.meta.curve.ett[5]);
  });
  it('filters by state, EPA formula, vulnerability and action', () => {
    const oh = triage({ state: 'oh', limit: 500 });
    assert.equal(oh.state, 'OH');
    assert.ok(oh.rows.every((r) => r.st === 'OH'));
    assert.ok(triage({ hidden: true, limit: 500 }).rows.every((r) => r.ett < 11));
    assert.ok(triage({ vulnerable: true, limit: 500 }).rows.every((r) => r.svi >= 0.75));
    assert.ok(triage({ action: 'lead', limit: 500 }).rows.every((r) => r.a === 'lead'));
    assert.ok(triage({ state: 'NY', limit: 500 }).rows.every((r) => !/\(\w+\)$/.test(r.c)));
  });
  it('finds a state in a question', () => {
    assert.equal(stateInText('Which systems in West Virginia are most at risk?'), 'WV');
    assert.equal(stateInText('where should Texas inspect first'), 'TX');
    assert.equal(stateInText('riskiest systems in OH'), 'OH');
    assert.equal(stateInText('which systems are riskiest'), null);
    assert.ok(TRIAGE_ASK_RE.test('which water systems are riskiest'));
    assert.ok(!TRIAGE_ASK_RE.test('Is Chicago water safe?'));
  });
  it('answers queue questions in chat with a link to the view', async () => {
    const r = await answerTapWater({ question: 'Which systems in Ohio are most at risk?' });
    assert.equal(r.scope, 'redirect');
    assert.match(r.answer.markdown, /tops Ohio's queue/);
    assert.match(r.answer.markdown, /\(#\/triage\?state=OH\)/);
    const city = await answerTapWater({ question: 'Is Flint at risk?' });
    assert.equal(city.scope, 'water');
  });
  it('serves GET /api/triage', () => {
    let code = 0;
    let body = null;
    const res = { status: (c) => ((code = c), res), json: (v) => (body = v), setHeader: () => {} };
    handler({ method: 'GET', query: { state: 'TX', limit: '5' } }, res);
    assert.equal(code, 200);
    assert.equal(body.rows.length, 5);
    handler({ method: 'POST', query: {} }, res);
    assert.equal(code, 405);
  });
});
