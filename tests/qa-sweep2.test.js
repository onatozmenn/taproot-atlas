import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater } from '../dist/lib/pipeline.js';

process.env.ECHO_LIVE_SOURCE = 'off';

describe('QA sweep 2 regressions', () => {
  it('Manhattan ZIP 10001 resolves to New York City, not New Jersey or a refusal', async () => {
    const r = await answerTapWater({ question: '10001' });
    assert.equal(r.scope, 'water');
    assert.equal(r.groundTruth.pwsid, 'NY7003493');
  });
  it('"what about PFAS?" mid-conversation answers for the city, "what is PFAS?" defines it', async () => {
    const f = await answerTapWater({ question: 'what about PFAS?', contextPwsid: 'IL0316000' });
    assert.equal(f.scope, 'water');
    assert.equal(f.groundTruth.pwsid, 'IL0316000');
    const d = await answerTapWater({ question: 'what is PFAS?', contextPwsid: 'IL0316000' });
    assert.equal(d.scope, 'redirect');
  });
  it('"risk forecast for Flint" is a water question; weather is not', async () => {
    const r = await answerTapWater({ question: 'risk forecast for Flint' });
    assert.equal(r.scope, 'water');
    assert.equal(r.groundTruth.pwsid, 'MI0002310');
    const w = await answerTapWater({ question: 'weather forecast in Flint' });
    assert.equal(w.scope, 'redirect');
  });
  it('a small uncovered town says so instead of answering for another city', async () => {
    for (const q of ['Marfa TX', 'Is Marfa TX water safe?']) {
      const r = await answerTapWater({ question: q });
      assert.equal(r.groundTruth.pwsid, 'UNKNOWN', q);
      assert.match(r.answer.markdown, /Marfa, TX/);
      assert.match(r.answer.markdown, /3,300/);
    }
  });
  it('a pinned PWSID (triage "Ask Taproot") wins over place words in the question', async () => {
    const r = await answerTapWater({ question: "What's the risk of a new violation at Maysville Regional Water next year?", pwsid: 'OH6001411' });
    assert.equal(r.groundTruth.pwsid, 'OH6001411');
    assert.match(r.answer.markdown, /forecast/i);
    assert.doesNotMatch(r.answer.markdown, /higher than 100%/);
  });
});
