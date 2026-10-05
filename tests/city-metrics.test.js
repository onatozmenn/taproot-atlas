import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadCityMetrics, metricSnapshotPwsids } from '../dist/lib/city-metrics.js';

describe('loadCityMetrics', () => {
  it('serves curated snapshots for NYC and Chicago', () => {
    assert.deepEqual(metricSnapshotPwsids().sort(), ['IL0316000', 'NY7003493']);
    const nyc = loadCityMetrics('NY7003493');
    assert.ok(nyc.length >= 1);
    assert.ok(nyc.every((m) => m.provenance.sourceVersionId.length > 0));
    const chi = loadCityMetrics('IL0316000');
    assert.equal(chi.length, 2);
    assert.ok(chi.some((m) => m.parameter === 'Turbidity'));
    assert.ok(
      chi.every(
        (m) =>
          m.provenance.reportPeriod === '2025 Annual' &&
          m.provenance.sourceDocumentUrl.includes('chicagoccr.org'),
      ),
    );
  });

  it('returns empty for systems without curated metrics', () => {
    assert.deepEqual(loadCityMetrics('CA1910067'), []);
    assert.deepEqual(loadCityMetrics('UNKNOWN'), []);
  });
});
