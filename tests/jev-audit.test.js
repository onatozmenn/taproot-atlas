import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jevCheckNarrative } from '../dist/lib/jev-audit.js';

const config = { baseUrl: 'https://api.typesafe.ai', apiKey: 'k', model: 'jev-latest' };
const answers = (scores) => ({
  ok: true,
  status: 200,
  json: async () => ({
    model: 'jev-1.13.0',
    answers: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { type: 'noul', noul: v }])),
    usage: { input_tokens: 1, output_tokens: 1 },
  }),
});

describe('jevCheckNarrative', () => {
  it('passes a clean narrative and reports scores', async () => {
    const v = await jevCheckNarrative(
      'ok',
      'facts',
      config,
      async () => answers({ has_ungrounded_numbers: 0.02, health_certification: 0.01, reveals_coordinates: 0.0 }),
    );
    assert.equal(v?.passed, true);
    assert.equal(v?.model, 'jev-1.13.0');
  });

  it('flags when any score reaches the threshold', async () => {
    const v = await jevCheckNarrative(
      'bad',
      'facts',
      config,
      async () => answers({ has_ungrounded_numbers: 0.1, health_certification: 0.87, reveals_coordinates: 0.0 }),
    );
    assert.equal(v?.passed, false);
  });

  it('returns null without a key, on HTTP errors, or malformed answers', async () => {
    const never = async () => {
      throw new Error('must not be called');
    };
    assert.equal(await jevCheckNarrative('x', 'y', { ...config, apiKey: '' }, never), null);
    assert.equal(
      await jevCheckNarrative('x', 'y', config, async () => ({ ok: false, status: 401, json: async () => ({}) })),
      null,
    );
    assert.equal(
      await jevCheckNarrative('x', 'y', config, async () => answers({ has_ungrounded_numbers: 'high' })),
      null,
    );
  });
});
