import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater } from '../dist/lib/pipeline.js';

process.env.ECHO_LIVE_SOURCE = 'off';
const ask = (question, extra = {}) => answerTapWater({ question, ...extra });

describe('Glossary and contextual follow-ups', () => {
  it('"what is ppb" after a Chicago lead answer explains the unit', async () => {
    const r = await ask('what is ppb', { contextPwsid: 'IL0316000' });
    assert.match(r.answer.markdown, /parts per billion/);
    assert.ok(r.answer.followUps.some((f) => /Chicago/.test(f)));
    assert.equal(r.scope, 'redirect'); // keeps the Chicago context in the client
  });
  it('explains action level, MCL vs MCLG, 90th percentile and PFAS', async () => {
    assert.match((await ask('What is an action level?')).answer.markdown, /trigger, not a legal limit/);
    assert.match((await ask('what does MCLG mean')).answer.markdown, /goal, not a legal limit/);
    assert.match((await ask('what is an MCL')).answer.markdown, /legal limit/);
    assert.match((await ask('what is the 90th percentile?')).answer.markdown, /9 out of 10/);
    assert.match((await ask('what are PFAS')).answer.markdown, /forever chemicals/);
  });
  it('record questions that mention a term still get the record answer', async () => {
    const r = await ask('does Chicago water have PFAS?');
    assert.equal(r.scope, 'water');
    assert.equal(r.groundTruth.pwsid, 'IL0316000');
  });
  it('"is that bad?" answers about the conversation city', async () => {
    const r = await ask('is that bad?', { contextPwsid: 'IL0316000' });
    assert.equal(r.scope, 'water');
    assert.equal(r.groundTruth.pwsid, 'IL0316000');
  });
  it('truly off-topic messages still redirect', async () => {
    const r = await ask('tell me a joke', { contextPwsid: 'IL0316000' });
    assert.equal(r.scope, 'redirect');
    assert.doesNotMatch(r.answer.markdown, /parts per/);
  });
});
