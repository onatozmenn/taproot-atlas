import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateDeterministicSummary } from '../dist/lib/fallback-template.js';
import { mockSchematic } from './fixtures.js';

describe('generateDeterministicSummary', () => {
  it('renders provenance for every metric and compliance window', () => {
    const out = generateDeterministicSummary(mockSchematic());
    assert.ok(out.includes('NY7003493'));
    assert.ok(out.includes('Catskill and Delaware'));
    assert.ok(out.includes('2021-01-01 to 2026-01-01'));
    assert.ok(out.includes('2024 Annual'));
    assert.ok(out.includes('nyc-2024-v1'));
    assert.ok(out.includes('echo.epa.gov'));
    assert.ok(out.includes('modeled from EPA geography'));
    assert.ok(out.includes('schematic approximations'));
  });

  it('never certifies safety', () => {
    const out = generateDeterministicSummary(mockSchematic()).toLowerCase();
    assert.ok(!out.includes('drinkable'));
    assert.ok(!out.includes('pure'));
  });

  it('uses plain language for boundaries, never enum codes', () => {
    const out = generateDeterministicSummary(mockSchematic());
    assert.ok(!out.includes('modeled_epa'));
    assert.ok(!out.includes('unverified_fallback'));
    assert.ok(!out.includes('verified_agency'));
    assert.ok(!out.includes('MODELED_EPA'));
    const single = {
      ...mockSchematic(),
      primaryBasins: ['Lake Michigan'],
      boundaryType: 'unverified_fallback',
    };
    const singleOut = generateDeterministicSummary(single);
    assert.ok(singleOut.includes('Lake Michigan basin'));
    assert.ok(singleOut.includes('Exact service-area boundaries are not shown here.'));
    assert.ok(!singleOut.includes('unverified_fallback'));
  });
});
