import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateDeterministicSummary } from '../dist/lib/fallback-template.js';
import { mockSchematic } from './fixtures.js';

describe('generateDeterministicSummary', () => {
  it('renders provenance for every metric and compliance window', () => {
    const out = generateDeterministicSummary(mockSchematic());
    assert.ok(out.includes('NY0023456'));
    assert.ok(out.includes('Catskill and Delaware'));
    assert.ok(out.includes('2021-01-01 to 2026-01-01'));
    assert.ok(out.includes('2025 Annual'));
    assert.ok(out.includes('nyc-2025-v1'));
    assert.ok(out.includes('echo.epa.gov'));
    assert.ok(out.includes('VERIFIED_AGENCY'));
    assert.ok(out.includes('schematic approximations'));
  });

  it('never certifies safety', () => {
    const out = generateDeterministicSummary(mockSchematic()).toLowerCase();
    assert.ok(!out.includes('drinkable'));
    assert.ok(!out.includes('pure'));
  });
});
