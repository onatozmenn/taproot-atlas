// tests/answer-composer.test.js — question-focused chat answers (no rote template).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater } from '../dist/lib/pipeline.js';
import { detectParameters, cleanProcesses } from '../dist/lib/answer-composer.js';

const deps = { findNearby: async () => [], recordSource: 'snapshot_fixture' };

describe('answer composer', () => {
  it('answers the named parameter honestly instead of listing unrelated metrics', async () => {
    const r = await answerTapWater({ question: 'What is the lead level in Chicago tap water?' }, deps);
    assert.equal(r.groundTruth.pwsid, 'IL0316000');
    assert.match(r.answer.markdown, /don't have a lead test result for Chicago/);
    assert.ok(!r.answer.followUps.some((f) => /lead/i.test(f)), 'does not re-suggest the question just asked');
  });

  it('keeps conversation context for a follow-up that names no place', async () => {
    const r = await answerTapWater({ question: 'What about fluoride?', contextPwsid: 'IL0316000' }, deps);
    assert.equal(r.groundTruth.pwsid, 'IL0316000');
    assert.match(r.answer.markdown, /fluoride/i);
  });

  it('a newly named city overrides the conversation context', async () => {
    const r = await answerTapWater({ question: 'Where does Los Angeles water come from?', contextPwsid: 'IL0316000' }, deps);
    assert.notEqual(r.groundTruth.pwsid, 'IL0316000');
    assert.match(r.answer.markdown, /^Los Angeles draws its water from/);
  });

  it('pathway answers are a numbered route with cleaned treatment steps', async () => {
    const r = await answerTapWater({ question: 'How does NYC water reach my tap?' }, deps);
    assert.match(r.answer.markdown, /1\. \*\*Source\*\*/);
    assert.ok(!/, Pre|, Post/.test(r.answer.markdown));
    assert.equal(r.answer.focus, 'pathway');
  });

  it('greetings stay a redirect with example follow-ups', async () => {
    const r = await answerTapWater({ question: 'hi' }, deps);
    assert.equal(r.scope, 'redirect');
    assert.ok(r.answer.followUps.length > 0);
  });

  it('parameter detection ignores "lead to"', () => {
    assert.deepEqual(detectParameters('does this lead to problems').map((p) => p.name), []);
    assert.deepEqual(detectParameters('any PFAS or lead?').map((p) => p.name).sort(), ['Lead', 'PFAS']);
  });

  it('cleans SDWIS treatment codes into plain words', () => {
    assert.deepEqual(cleanProcesses(['GASEOUS CHLORINATION, PRE', 'GASEOUS CHLORINATION, POST', 'INHIBITOR, ORTHOPHOSPHATE', 'PH ADJUSTMENT, POST']), [
      'Gaseous chlorination',
      'Orthophosphate corrosion control',
      'pH adjustment',
    ]);
  });
});
