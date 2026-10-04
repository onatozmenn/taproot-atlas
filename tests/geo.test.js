import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon, resolveSystem, listServiceAreas, snapshotVersion } from '../dist/lib/geo.js';

describe('pointInPolygon', () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  it('detects inside vs outside', () => {
    assert.equal(pointInPolygon([0.5, 0.5], square), true);
    assert.equal(pointInPolygon([2, 2], square), false);
  });
});

describe('resolveSystem', () => {
  it('resolves the NYC showcase coordinate with verified boundary', () => {
    const r = resolveSystem(40.78, -73.97);
    assert.equal(r.pwsid, 'NY0023456');
    assert.equal(r.boundaryType, 'verified_agency');
    assert.deepEqual(r.primaryBasins, ['Catskill', 'Delaware']);
  });

  it('returns explicit unverified fallback outside coverage (never a guess)', () => {
    const r = resolveSystem(39.9, 32.8); // Ankara
    assert.equal(r.pwsid, 'UNKNOWN');
    assert.equal(r.boundaryType, 'unverified_fallback');
  });

  it('snapshot is versioned and lists service areas', () => {
    assert.match(snapshotVersion(), /^epa-service-area-/);
    assert.ok(listServiceAreas().length >= 1);
  });
});
