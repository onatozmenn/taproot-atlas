import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { llmNarrate, buildFactsMessage } from '../dist/lib/llm-narrator.js';
import { mockSchematic } from './fixtures.js';

const schematic = mockSchematic();
const config = { baseUrl: 'https://ai.example/v1', apiKey: 'k', model: 'gpt-luna-6' };
const goodBody = {
  overview: 'Water for NYC DEP Catskill-Delaware (PWSID: NY7003493) is sourced from the Catskill and Delaware basins.',
  metricsSummary: 'Turbidity was 0.08 NTU per the 2024 Annual report.',
  complianceNote: 'Compliance with Safe Drinking Water Act record-keeping shows 0 violations.',
  stewardshipNote: 'Historic records only.',
};

describe('llmNarrate', () => {
  it('parses a well-formed model reply (fences tolerated)', async () => {
    const fetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '```json\n' + JSON.stringify(goodBody) + '\n```' } }] }),
    });
    assert.deepEqual(await llmNarrate(schematic, config, fetchFn), goodBody);
  });

  it('returns null without key or model (template path takes over)', async () => {
    const fetchFn = async () => {
      throw new Error('must not be called');
    };
    assert.equal(await llmNarrate(schematic, { ...config, apiKey: '' }, fetchFn), null);
  });

  it('returns null on HTTP errors, bad JSON, or wrong shape', async () => {
    const httpErr = async () => ({ ok: false, status: 429, json: async () => ({}) });
    assert.equal(await llmNarrate(schematic, config, httpErr), null);
    const badJson = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });
    assert.equal(await llmNarrate(schematic, config, badJson), null);
    const wrongShape = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"overview": 42}' } }] }),
    });
    assert.equal(await llmNarrate(schematic, config, wrongShape), null);
  });

  it('speaks the Responses API (Zen) and extracts output_text', async () => {
    let seenUrl = '';
    let seenBody = {};
    const fetchFn = async (url, init) => {
      seenUrl = url;
      seenBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(goodBody) }] }],
        }),
      };
    };
    const out = await llmNarrate(
      schematic,
      { baseUrl: 'https://opencode.ai/zen/v1', apiKey: 'k', model: 'gpt-6-luna', api: 'responses' },
      fetchFn,
    );
    assert.deepEqual(out, goodBody);
    assert.equal(seenUrl, 'https://opencode.ai/zen/v1/responses');
    assert.equal(seenBody.model, 'gpt-6-luna');
  });

  it('returns null on empty Responses output', async () => {
    const empty = async () => ({ ok: true, status: 200, json: async () => ({ output: [] }) });
    const cfg = { baseUrl: 'https://opencode.ai/zen/v1', apiKey: 'k', model: 'gpt-6-luna', api: 'responses' };
    assert.equal(await llmNarrate(schematic, cfg, empty), null);
  });

  it('never puts coordinates into the prompt', () => {
    const msg = buildFactsMessage(schematic);
    assert.ok(!msg.includes('-74') && !msg.includes('40.7'));
    assert.ok(msg.includes('NY7003493') && msg.includes('Turbidity'));
  });
});
