import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditLlmNarrative,
  buildResolverFacts,
  extractNormalizedNumbers,
} from '../dist/lib/guardrails.js';
import { mockSchematic } from './fixtures.js';

const schematic = mockSchematic();
const resolverOutput = { schematic, extractedFacts: buildResolverFacts(schematic) };

describe('extractNormalizedNumbers', () => {
  it('extracts integers and decimals', () => {
    assert.deepEqual(extractNormalizedNumbers('0.08 NTU, limit 0.3, 2025'), ['0.08', '0.3', '2025']);
  });
});

describe('buildResolverFacts', () => {
  it('allows only ground-truth numbers and entities', () => {
    const facts = buildResolverFacts(schematic);
    assert.ok(facts.allowedNumbers.includes('2025'));
    assert.ok(facts.allowedEntities.includes('ny0023456'));
    assert.ok(facts.allowedEntities.includes('turbidity'));
  });
});

describe('auditLlmNarrative', () => {
  it('passes a grounded compliance sentence', () => {
    const text =
      'Water for NYC DEP Catskill-Delaware (PWSID: NY0023456) is sourced from the Catskill and Delaware basins. ' +
      'Turbidity was 0.08 NTU against a 0.3 NTU TT standard per the 2025 Annual report, within EPA standards based on the 2025-12-01 test.';
    const r = auditLlmNarrative(text, resolverOutput);
    assert.equal(r.isValid, true, JSON.stringify(r.violations));
  });

  it('blocks health certification', () => {
    const r = auditLlmNarrative('The water is drinkable and pure.', resolverOutput);
    assert.equal(r.isValid, false);
    assert.ok(r.violations.some((v) => v.includes('drinkable') || v.includes('pure')));
  });

  it('blocks bare "safe" outside statutory exceptions', () => {
    const r = auditLlmNarrative('This water is safe to drink.', resolverOutput);
    assert.equal(r.isValid, false);
  });

  it('allows Safe Drinking Water Act statutory phrasing', () => {
    const text =
      'Compliance with Safe Drinking Water Act standards for NYC DEP Catskill-Delaware (PWSID: NY0023456) shows 0 violations from 2021-01-01 to 2026-01-01.';
    const r = auditLlmNarrative(text, resolverOutput);
    assert.equal(r.isValid, true, JSON.stringify(r.violations));
  });

  it('blocks coordinate leaks', () => {
    const r = auditLlmNarrative('Source is at 40.7128, -74.0060 near Catskill Watershed.', resolverOutput);
    assert.equal(r.isValid, false);
    assert.ok(r.violations.some((v) => v.includes('coordinate')));
  });

  it('blocks hallucinated numbers', () => {
    const r = auditLlmNarrative('Lead level is 99.99 ppb in the Catskill basin.', resolverOutput);
    assert.equal(r.isValid, false);
    assert.ok(r.violations.some((v) => v.includes('99.99')));
  });

  it('blocks non-English output', () => {
    const r = auditLlmNarrative('Su kalitesi çok iyi, Catskill havzasından geliyor.', resolverOutput);
    assert.equal(r.isValid, false);
  });
});
