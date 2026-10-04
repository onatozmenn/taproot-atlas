import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findDrinkingPoints, overpassQuery, OsmError, OVERPASS_URL, MAX_RESULTS } from '../dist/lib/osm.js';

const overpassFixture = {
  elements: [
    { id: 2, lat: 40.781, lon: -73.969, tags: {} },
    { id: 1, lat: 40.78, lon: -73.97, tags: { name: 'Park Fountain' } },
  ],
};

describe('findDrinkingPoints', () => {
  it('maps Overpass elements to sorted points with OSM links', async () => {
    const pts = await findDrinkingPoints(40.78, -73.97, { fetchJson: async () => overpassFixture });
    assert.equal(pts.length, 2);
    assert.equal(pts[0].name, 'Park Fountain');
    assert.ok(pts[0].distanceM <= pts[1].distanceM);
    assert.ok(pts[0].osmUrl.includes('openstreetmap.org/node/'));
    assert.equal(pts[1].name, 'Public drinking water point');
  });

  it('caps results after sorting so the closest points win', async () => {
    const elements = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      lat: 40.78 + (25 - i) * 0.001,
      lon: -73.97,
      tags: {},
    }));
    const pts = await findDrinkingPoints(40.78, -73.97, { fetchJson: async () => ({ elements }) });
    assert.equal(pts.length, MAX_RESULTS);
    assert.ok(pts[0].distanceM <= pts[pts.length - 1].distanceM);
  });

  it('empty elements is a valid honest answer', async () => {
    assert.deepEqual(await findDrinkingPoints(0, 0, { fetchJson: async () => ({ elements: [] }) }), []);
  });

  it('rejects malformed responses and surfaces rate limits', async () => {
    await assert.rejects(() => findDrinkingPoints(0, 0, { fetchJson: async () => ({}) }), OsmError);
    await assert.rejects(() => findDrinkingPoints(0, 0, { fetchJson: async () => null }), (e) => {
      assert.equal(e.kind, 'bad_response');
      return true;
    });
    const limited = async () => {
      throw new OsmError('Overpass rate limit reached', 'rate_limited');
    };
    await assert.rejects(() => findDrinkingPoints(0, 0, { fetchJson: limited }), (e) => {
      assert.equal(e.kind, 'rate_limited');
      return true;
    });
  });

  it('asks Overpass for a sortable superset around the coordinate', () => {
    const q = overpassQuery(40.78, -73.97);
    assert.ok(q.includes('amenity') && q.includes('drinking_water') && q.includes('40.78'));
    assert.ok(q.includes('out 100'));
    assert.ok(OVERPASS_URL.startsWith('https://overpass-api.de/'));
  });
});
