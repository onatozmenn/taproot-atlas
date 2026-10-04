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
  it('resolves the NYC showcase coordinate with modeled confidence', () => {
    const r = resolveSystem(40.78, -73.97);
    assert.equal(r.pwsid, 'NY7003493');
    assert.equal(r.boundaryType, 'modeled_epa');
    assert.deepEqual(r.primaryBasins, ['Catskill', 'Delaware']);
  });

  it('does not claim Jersey City as NYC (schematic extent, modeled only)', () => {
    const r = resolveSystem(40.72, -74.06);
    assert.equal(r.pwsid, 'UNKNOWN');
    assert.equal(r.boundaryType, 'unverified_fallback');
  });

  it('returns explicit unverified fallback outside coverage (never a guess)', () => {
    const r = resolveSystem(39.9, 32.8); // Ankara
    assert.equal(r.pwsid, 'UNKNOWN');
    assert.equal(r.boundaryType, 'unverified_fallback');
  });

  it('resolves against injected service areas', () => {
    const areas = [
      { pwsid: 'AA0000001', systemName: 'Alpha', boundaryType: 'verified_agency', primaryBasins: ['Alpha Basin'], polygon: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] },
      { pwsid: 'BB0000002', systemName: 'Beta', boundaryType: 'verified_agency', primaryBasins: ['Beta Basin'], polygon: [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]] },
      { pwsid: 'CC0000003', systemName: 'Gamma', boundaryType: 'modeled_epa', primaryBasins: ['Gamma Basin'], polygon: [[4, 4], [5, 4], [5, 5], [4, 5], [4, 4]] },
    ];
    assert.equal(resolveSystem(0.5, 0.5, areas).pwsid, 'AA0000001');
    assert.equal(resolveSystem(2.5, 2.5, areas).pwsid, 'BB0000002');
    assert.equal(resolveSystem(4.5, 4.5, areas).pwsid, 'CC0000003');
    assert.equal(resolveSystem(9, 9, areas).pwsid, 'UNKNOWN');
  });

  it('snapshot is versioned and lists service areas', () => {
    assert.match(snapshotVersion(), /^epa-service-area-/);
    assert.ok(listServiceAreas().length >= 1);
  });
});
