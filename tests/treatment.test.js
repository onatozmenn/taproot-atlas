import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeTreatment, fetchTreatment, readTreatmentFixture } from '../dist/lib/treatment.js';
import { EchoError } from '../dist/lib/echo.js';

describe('describeTreatment', () => {
  it('labels unfiltered chlorinated surface water (NYC profile)', () => {
    assert.equal(
      describeTreatment(['GASEOUS CHLORINATION, PRE', 'FLUORIDATION'], 'surface'),
      'Unfiltered surface water, disinfected',
    );
  });

  it('labels filtered groundwater', () => {
    assert.equal(
      describeTreatment(['MICROFILTRATION', 'HYPOCHLORINATION'], 'groundwater'),
      'Filtered groundwater, disinfected',
    );
  });

  it('returns null when the evidence is too thin', () => {
    assert.equal(describeTreatment([], 'surface'), null);
    assert.equal(describeTreatment(['PH ADJUSTMENT, POST'], 'unknown'), null);
  });
});

describe('readTreatmentFixture', () => {
  it('serves the curated NYC profile', () => {
    const p = readTreatmentFixture('NY7003493');
    assert.ok(p);
    assert.ok(p.processes.includes('FLUORIDATION'));
  });

  it('returns null outside coverage', () => {
    assert.equal(readTreatmentFixture('CA1910067'), null);
  });
});

describe('fetchTreatment', () => {
  it('dedupes reported process phrases', async () => {
    const p = await fetchTreatment('NY7003493', {
      fetchJson: async () => [
        { comments_text: 'gaseous chlorination, pre' },
        { comments_text: 'GASEOUS CHLORINATION, PRE' },
        { comments_text: '  ' },
        { comments_text: null },
      ],
    });
    assert.deepEqual(p.processes, ['GASEOUS CHLORINATION, PRE']);
    assert.equal(p.rigor, null);
  });

  it('refuses non-PWSID input and malformed responses', async () => {
    await assert.rejects(() => fetchTreatment('UNKNOWN', { fetchJson: async () => [] }), EchoError);
    await assert.rejects(() => fetchTreatment('NY7003493', { fetchJson: async () => ({}) }), EchoError);
  });
});
