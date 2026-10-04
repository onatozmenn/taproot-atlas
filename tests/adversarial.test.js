import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditLlmNarrative, buildResolverFacts } from '../dist/lib/guardrails.js';
import { mockSchematic } from './fixtures.js';

const schematic = mockSchematic();
const resolverOutput = { schematic, extractedFacts: buildResolverFacts(schematic) };
const audit = (text) => auditLlmNarrative(text, resolverOutput);

describe('adversarial audit cases', () => {
  it('blocks hemisphere-suffixed coordinates', () => {
    const r = audit('The intake is at 40.7N, 74.0W near Delaware basin.');
    assert.equal(r.isValid, false);
    assert.ok(r.violations.some((v) => v.includes('coordinate')));
  });

  it('blocks invented treatment facilities', () => {
    const r = audit('Water is cleaned at the Croton treatment plant to 0.08 NTU.');
    assert.equal(r.isValid, false);
    assert.ok(r.violations.some((v) => v.includes('Croton') || v.includes('croton')));
  });

  it('allows verified basin names in natural phrasing', () => {
    const r = audit(
      'Water for NYC DEP Catskill-Delaware (PWSID: NY7003493) comes from the Catskill watershed and Delaware basin. Turbidity was 0.08 NTU per the 2024 Annual report.',
    );
    assert.equal(r.isValid, true, JSON.stringify(r.violations));
  });

  it('blocks unit-glued invented numbers', () => {
    const r = audit('Turbidity was 0.08NTU and lead 15ppb in the Catskill watershed.');
    assert.equal(r.isValid, false);
  });

  it('blocks Turkish health claims', () => {
    const r = audit('Bu su güvenli ve içilebilir, Catskill watershed bölgesinden geliyor.');
    assert.equal(r.isValid, false);
  });

  it('does not flag measurement units as coordinates', () => {
    const r = audit(
      'Turbidity was 0.08 NTU against a 0.3 NTU TT standard per the 2024 Annual report for NYC DEP Catskill-Delaware (PWSID: NY7003493).',
    );
    assert.equal(r.isValid, true, JSON.stringify(r.violations));
  });
});
