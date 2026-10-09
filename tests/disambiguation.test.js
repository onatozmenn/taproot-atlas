import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater } from '../dist/lib/pipeline.js';
import { findSystemByText } from '../dist/lib/systems.js';

process.env.ECHO_LIVE_SOURCE = 'off';
const ask = (question, extra = {}) => answerTapWater({ question, ...extra });

describe('City disambiguation', () => {
  it('"tell me about Boston, MA" is not read as Maine', () => {
    assert.equal(findSystemByText('Tell me about Boston, MA water')?.pwsid, 'MA3035000');
    assert.equal(findSystemByText('Boston MA lead')?.pwsid, 'MA3035000');
    assert.equal(findSystemByText('is there lead in kansas city mo')?.pwsid, 'MO1010415');
  });
  it('an ambiguous city returns tappable choices', async () => {
    const r = await ask('Can you tell me about Kansas City water?');
    assert.equal(r.groundTruth.pwsid, 'UNKNOWN');
    assert.deepEqual([...r.groundTruth.alternatives].sort(), ['Kansas City, KS', 'Kansas City, MO']);
  });
  it('every choice label resolves to exactly one system', async () => {
    for (const q of ['Kansas City water', 'Chesterfield water', 'Pittsburgh water']) {
      const r = await ask(q);
      for (const alt of r.groundTruth.alternatives ?? []) {
        assert.ok(findSystemByText(`Tell me about ${alt} water`), alt);
      }
    }
  });
});
