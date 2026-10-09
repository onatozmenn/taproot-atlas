import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler, { cleanFeedback } from '../dist/api/feedback.js';
import { answerTapWater } from '../dist/lib/pipeline.js';
import { parseRecords, summarize } from '../scripts/study/summarize.mjs';

process.env.ECHO_LIVE_SOURCE = 'off';
const impact = JSON.parse(readFileSync(new URL('../docs/impact.json', import.meta.url), 'utf8'));

describe('Impact numbers', () => {
  it('are internally consistent and beat EPA ETT every year', () => {
    assert.equal(impact.years.length, 3);
    for (const y of impact.years) {
      assert.equal(y.both + y.model_only + y.ett_only + y.neither, y.violators);
      assert.equal(y.both + y.model_only, y.model_caught);
      assert.equal(y.both + y.ett_only, y.ett_caught);
      assert.ok(y.model_caught > y.ett_caught * 1.8);
      assert.ok(y.hit_rate_model > y.hit_rate_ett);
      assert.ok(y.model_people <= y.people && y.extra_people <= y.model_people);
    }
    assert.ok(impact.context.every((c) => /^https:\/\//.test(c.url)));
  });
  it('answers "how accurate is Taproot?" with the backtest and a link', async () => {
    const r = await answerTapWater({ question: 'How accurate is Taproot?' });
    assert.equal(r.scope, 'redirect');
    assert.match(r.answer.markdown, /\(#\/impact\)/);
    assert.match(r.answer.markdown, new RegExp(`${impact.years.at(-1).model_caught} of the ${impact.years.at(-1).violators}`));
  });
});

describe('Feedback endpoint', () => {
  const call = async (method, body) => {
    let code = 0;
    const res = { status: (c) => ((code = c), res), json: () => {} };
    await handler({ method, body }, res);
    return code;
  };
  it('accepts ratings and study records, rejects junk', async () => {
    assert.equal(await call('POST', { kind: 'rating', rating: 'up', question: 'Chicago lead?' }), 200);
    assert.equal(await call('POST', JSON.stringify({ kind: 'study', pid: 'x', susScore: 80 })), 200);
    assert.equal(await call('POST', { kind: 'other' }), 400);
    assert.equal(await call('POST', { kind: 'rating', blob: 'x'.repeat(20000) }), 400);
    assert.equal(await call('GET', null), 405);
    assert.ok(cleanFeedback({ kind: 'rating' }).receivedAt);
  });
});

describe('Study summarizer', () => {
  it('parses log lines, de-duplicates participants and computes SUS with a CI', () => {
    const rec = (pid, score, ok) => ({ kind: 'study', pid, role: 'resident', susScore: score, results: [{ id: 'lead', success: ok, seconds: 40, ease: ok ? 6 : 2 }, { id: 'forecast', success: true, seconds: 60, ease: 5, check: { answer: 1, correct: ok } }], comment: ok ? '' : 'map was slow' });
    const log = [rec('a', 80, true), rec('b', 70, false), rec('b', 70, false), rec('c', 90, true)].map((r) => `2026-10-10 INFO [feedback] ${JSON.stringify(r)}`).join('\n') + '\n[feedback] {"kind":"rating","rating":"down"}';
    const s = summarize(parseRecords(log));
    assert.equal(s.participants, 3);
    assert.equal(s.sus.mean, 80);
    assert.ok(s.sus.ci95 > 0);
    const lead = s.tasks.find((t) => t.task === 'resident:lead');
    assert.ok(Math.abs(lead.completion - 2 / 3) < 1e-9);
    assert.equal(s.ratings.down, 1);
    assert.deepEqual(s.comments, ['map was slow']);
  });
});
