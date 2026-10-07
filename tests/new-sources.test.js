import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFacilityFixture, fetchFacilities } from '../dist/lib/facility.js';
import { loadLcrMetrics, fetchLcrMetrics } from '../dist/lib/lcr.js';
import { loadUcmrMetrics, loadSyrMetrics, loadDistributionMetrics } from '../dist/lib/occurrence.js';
import { loadWaterUse } from '../dist/lib/water-use.js';
import { loadConveyances } from '../dist/lib/conveyance.js';

describe('new source layers (careful, fail-soft)', () => {
  it('facility fixture serves NYC intake/reservoir rows without coordinates', async () => {
    const fac = readFacilityFixture('NY7003493');
    assert.ok(fac);
    assert.equal(fac.pwsid, 'NY7003493');
    assert.ok(fac.facilities.length >= 1);
    assert.ok(fac.facilities.every((f) => typeof f.facilityName === 'string'));
    assert.ok(!JSON.stringify(fac).includes('73.9'));
  });

  it('facility live client maps type codes and seller chain, refuses bad PWSID', async () => {
    const rows = [
      { facility_name: 'WEST BRANCH RESERVOIR DEL9', facility_type_code: 'RS', water_type_code: 'SW', is_source_ind: 'Y' },
      { facility_name: 'CATSKILL INTAKE', facility_type_code: 'IN', water_type_code: 'SW', seller_pwsid: 'NY1234567', seller_pws_name: 'Upstream Seller' },
    ];
    const fac = await fetchFacilities('NY7003493', {
      fetchJson: async () => rows,
      now: () => '2026-10-07T00:00:00Z',
    });
    assert.equal(fac.facilities[0].facilityType, 'reservoir');
    assert.equal(fac.facilities[1].facilityType, 'intake');
    assert.equal(fac.sellerChain[0].pwsid, 'NY1234567');
    await assert.rejects(() => fetchFacilities('NOPE', { fetchJson: async () => [] }));
  });

  it('LCR/UCMR/SYR/distribution loaders are fail-soft snapshots', async () => {
    assert.deepEqual(loadLcrMetrics('NOPE'), []);
    assert.deepEqual(loadUcmrMetrics('NY7003493'), []);
    assert.deepEqual(loadSyrMetrics('NY7003493'), []);
    assert.deepEqual(loadDistributionMetrics('NY7003493'), []);
    const lcr = await fetchLcrMetrics('NY7003493', { fetchJson: async () => [] });
    assert.deepEqual(lcr, []);
  });

  it('water-use and conveyances are modeled/schematic snapshots', () => {
    assert.equal(loadWaterUse('NY7003493'), null);
    const conv = loadConveyances('NY7003493');
    assert.ok(conv.length >= 2);
    assert.ok(conv.every((c) => c.confidence === 'schematic'));
  });
});
