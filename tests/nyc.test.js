import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ingestNycMetrics, nycSnapshotVersion, nycReportPeriod } from '../dist/lib/nyc.js';

describe('ingestNycMetrics', () => {
  it('returns versioned metrics with full provenance for the showcase PWSID', () => {
    const metrics = ingestNycMetrics('NY0023456');
    assert.ok(metrics.length >= 1);
    for (const m of metrics) {
      assert.ok(m.parameter.length > 0);
      assert.ok(m.provenance.sourceDocumentUrl.startsWith('https://'));
      assert.equal(m.provenance.reportPeriod, '2025 Annual');
      assert.equal(m.provenance.sourceVersionId, 'nyc-2025-v1');
      assert.ok(m.provenance.captureTime.length > 0);
    }
  });

  it('returns empty for systems outside the snapshot (no cross-contamination)', () => {
    assert.deepEqual(ingestNycMetrics('TX0000001'), []);
  });

  it('snapshot version and report period are pinned', () => {
    assert.equal(nycSnapshotVersion(), 'nyc-2025-v1');
    assert.equal(nycReportPeriod(), '2025 Annual');
  });
});
