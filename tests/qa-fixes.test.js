import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater } from '../dist/lib/pipeline.js';
import { zipToState } from '../dist/lib/national.js';

process.env.ECHO_LIVE_SOURCE = 'off';
const ask = (question, extra = {}) => answerTapWater({ question, ...extra });

describe('QA fixes (2026-10-09)', () => {
  it('a new city mid-conversation wins over the previous one', async () => {
    const r = await ask('Does Phoenix water have PFAS?', { contextPwsid: 'MA3035000' });
    assert.equal(r.groundTruth.pwsid, 'AZ0407025');
  });
  it('a follow-up with no place keeps the conversation city', async () => {
    const r = await ask('what about lead?', { contextPwsid: 'MA3035000' });
    assert.equal(r.groundTruth.pwsid, 'MA3035000');
  });
  it('ZIP 10001 is New York City, not Hoboken', async () => {
    assert.equal(zipToState('10001'), 'NY');
    const r = await ask('What is in my water? 10001');
    assert.equal(r.groundTruth.pwsid, 'NY7003493');
  });
  it('weather in a named city is off-topic', async () => {
    const r = await ask("What's the weather in Chicago?");
    assert.equal(r.scope, 'redirect');
    assert.match(r.answer.markdown, /only answer questions about U\.S\. tap water/);
    assert.ok(r.answer.followUps.some((f) => /Chicago/.test(f)));
  });
  it('two-city comparisons ask for one city at a time', async () => {
    const r = await ask('Compare Chicago and Detroit water');
    assert.equal(r.scope, 'redirect');
    assert.equal(r.answer.followUps.length, 2);
  });
  it('a foreign country is out of scope', async () => {
    const r = await ask('Is the water safe in Paris, France?');
    assert.equal(r.scope, 'redirect');
  });
  it('a bare world-city name says which US namesake it used', async () => {
    const r = await ask('Is there lead in Paris water?');
    assert.match(r.answer.markdown, /U\.S\. water only, so this is Paris, TX/);
  });
  it('fluoridated and hardness questions get on-topic answers', async () => {
    const f = await ask('Is it fluoridated in Denver?');
    assert.match(f.answer.markdown, /Fluoride/);
    const h = await ask('Hardness of San Diego water?');
    assert.match(h.answer.markdown, /hardness/i);
  });
  it('tiny same-name places are not offered as alternatives', async () => {
    const r = await ask('Is Phoenix water safe to drink?');
    assert.ok(!(r.groundTruth.alternatives ?? []).includes('Phoenix, OR'));
  });
});
