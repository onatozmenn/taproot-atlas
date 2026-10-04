import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchematicFlow, showcaseNodes, SCHEMATIC_DISCLAIMER } from '../dist/lib/schematic.js';

describe('buildSchematicFlow', () => {
  it('emits approximate watershed → treatment → zone features', () => {
    const flow = buildSchematicFlow(showcaseNodes(['Catskill', 'Delaware']));
    assert.equal(flow.type, 'FeatureCollection');
    const roles = flow.features.map((f) => f.properties.role);
    assert.ok(roles.includes('watershed') && roles.includes('treatment_facility') && roles.includes('distribution_zone'));
    for (const f of flow.features) {
      assert.equal(f.properties.isApproximate, true);
      assert.equal(f.geometry.type, 'Point');
    }
  });

  it('disclaimer forbids engineering interpretation', () => {
    assert.ok(SCHEMATIC_DISCLAIMER.includes('schematic') && SCHEMATIC_DISCLAIMER.includes('engineering'));
  });
});
