import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchematicFlow, showcaseNodes, SCHEMATIC_DISCLAIMER } from '../dist/lib/schematic.js';

describe('buildSchematicFlow', () => {
  it('emits approximate watershed → treatment → zone features with disclaimer', () => {
    const flow = buildSchematicFlow(showcaseNodes(['Catskill', 'Delaware']));
    assert.equal(flow.type, 'FeatureCollection');
    assert.equal(flow.disclaimer, SCHEMATIC_DISCLAIMER);
    const roles = flow.features.map((f) => f.properties.role);
    assert.ok(roles.includes('watershed') && roles.includes('treatment_facility') && roles.includes('distribution_zone'));
    for (const f of flow.features) {
      assert.equal(f.properties.isApproximate, true);
      assert.equal(f.geometry.type, 'Point');
    }
  });

  it('skips unknown basins instead of throwing (never fabricates coordinates)', () => {
    const nodes = showcaseNodes(['Hudson']);
    assert.equal(nodes.filter((n) => n.role === 'watershed').length, 0);
    assert.ok(nodes.some((n) => n.role === 'treatment_facility'));
    const mixed = showcaseNodes(['Catskill', 'Hudson']);
    assert.ok(mixed.some((n) => n.label === 'Catskill Watershed'));
    assert.ok(!mixed.some((n) => n.label.includes('Hudson')));
  });

  it('disclaimer forbids engineering interpretation', () => {
    assert.ok(SCHEMATIC_DISCLAIMER.includes('schematic') && SCHEMATIC_DISCLAIMER.includes('engineering'));
  });
});
