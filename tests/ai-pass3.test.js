import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater } from '../dist/lib/pipeline.js';
import { unresolvedPlaceName, RECORD_FOLLOW_UP_RE, classifyScope } from '../dist/lib/scope.js';
import { buildFactsMessage } from '../dist/lib/llm-narrator.js';
import { mockSchematic } from './fixtures.js';

process.env.ECHO_LIVE_SOURCE = 'off';
const ask = (question, extra = {}) => answerTapWater({ question, ...extra }, { findNearby: async () => [] });

describe('AI pass 3 (2026-10-11)', () => {
  it('a world city with no US namesake is out of coverage, never the NYC default', async () => {
    for (const q of ['Is Ankara tap water safe?', 'Ankara suyu içilir mi?', 'Does Tokyo water have PFAS?']) {
      const r = await ask(q);
      assert.equal(r.scope, 'redirect', q);
      assert.match(r.answer.markdown, /covers U\.S\. public water systems/, q);
    }
  });
  it('an unknown capitalised place gets an honest "I don\'t have" answer', async () => {
    const r = await ask('Is Smallvillex water safe?');
    assert.equal(r.groundTruth.pwsid, 'UNKNOWN');
    assert.match(r.narrative.overview, /I don't have Smallvillex yet/);
  });
  it('"is my water safe?" with no place still answers from the showcase system', async () => {
    const r = await ask('Is my water safe?');
    assert.equal(r.groundTruth.pwsid, 'NY7003493');
  });
  it('record follow-ups without a water word stay on the conversation system', async () => {
    const r = await ask('When was the last inspection?', { contextPwsid: 'IL0316000' });
    assert.equal(r.scope, 'water');
    assert.equal(r.groundTruth.pwsid, 'IL0316000');
    assert.match(r.answer.markdown, /last inspected on [A-Z][a-z]+ \d{1,2}, \d{4}/);
    const s = await ask('How many people does it serve?', { contextPwsid: 'IL0316000' });
    assert.match(s.answer.markdown, /serves about 2\.7 million people/);
    const o = await ask('Who runs it?', { contextPwsid: 'MI0002310' });
    assert.match(o.answer.markdown, /run by the City of Flint/);
  });
  it('a non-water request mid-conversation is still off-topic', async () => {
    const r = await ask('Write me a poem about cats', { contextPwsid: 'IL0316000' });
    assert.equal(r.scope, 'redirect');
  });
  it('two-city comparisons answer side by side from the records', async () => {
    const r = await ask('Compare Detroit and Flint');
    assert.equal(r.scope, 'redirect');
    assert.match(r.answer.markdown, /\*\*Detroit has fewer health-based violations than Flint\*\*/);
    assert.match(r.answer.markdown, /- \*\*Flint\*\* \(MI0002310\): 1 health-based violation in 5 years/);
    assert.equal(r.answer.followUps.length, 2);
  });
  it('lab basis noise never reaches a sentence', async () => {
    const r = await ask('Does Los Angeles have nitrate problems?');
    assert.doesNotMatch(r.answer.markdown, /\(as n\)/i);
    assert.match(r.answer.markdown, /Some of Los Angeles' nitrate samples/);
  });
  it('scope helpers', () => {
    assert.equal(unresolvedPlaceName('Is Ankara tap water safe?'), 'Ankara');
    assert.equal(unresolvedPlaceName('Lead results for January'), null);
    assert.equal(unresolvedPlaceName('Is my water safe?'), null);
    assert.ok(RECORD_FOLLOW_UP_RE.test('When was the last inspection?'));
    assert.ok(!RECORD_FOLLOW_UP_RE.test('Write me a poem about cats'));
    assert.equal(classifyScope('Ankara suyu içilir mi?'), 'water');
  });
  it('the narrator prompt asks for English only, with no conflicting language rule', () => {
    const msg = buildFactsMessage(mockSchematic(), 'Flint suyu güvenli mi?');
    assert.match(msg, /Always write in English/);
    assert.doesNotMatch(msg, /language the user wrote in/);
  });
});
