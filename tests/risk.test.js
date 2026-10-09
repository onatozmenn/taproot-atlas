import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { riskFor, riskRanking, riskDistribution, riskBacktest } from '../dist/lib/risk.js';
import { driverText, riskBin, RISK_BINS } from '../dist/lib/risk-text.js';
import { answerTapWater } from '../dist/lib/pipeline.js';

process.env.ECHO_LIVE_SOURCE = 'off';

describe('Risk forecast', () => {
  it('scores every national system with a calibrated probability and drivers', () => {
    const all = riskRanking();
    assert.ok(all.length > 9000);
    assert.ok(all.every((r) => r.p >= 0 && r.p <= 1));
    const chi = riskFor('IL0316000');
    assert.ok(chi);
    assert.equal(chi.year, 2026);
    assert.ok(chi.drivers.length > 0 && chi.drivers.length <= 4);
    assert.ok(['high', 'elevated', 'typical', 'low'].includes(chi.tier));
  });
  it('mean forecast stays near the national base rate (calibration sanity)', () => {
    const all = riskRanking();
    const mean = all.reduce((a, r) => a + r.p, 0) / all.length;
    assert.ok(mean > 0.01 && mean < 0.08, `mean ${mean}`);
  });
  it('backtest beats EPA targeting score', () => {
    const b = riskBacktest();
    assert.ok(b.auc > 0.8);
    assert.ok(b.modelRecallTop10 > b.ettRecallTop10 * 1.5);
  });
  it('distribution bins add up', () => {
    const d = riskDistribution();
    assert.equal(d.length, RISK_BINS);
    assert.equal(d.reduce((a, b) => a + b, 0), riskRanking().length);
    assert.equal(riskBin(0.0001), 0);
    assert.equal(riskBin(1), RISK_BINS - 1);
  });
  it('driver text reads as plain English', () => {
    assert.equal(driverText({ f: 'yrs_since_hb', label: '', value: 50, dir: 'down', w: -0.5 }), 'no health-based violation on record');
    assert.match(driverText({ f: 'mr_10y', label: 'missed tests or reports in 10 years', value: 42, dir: 'up', w: 0.6 }), /^42 missed tests/);
  });
  it('a forecast question gets the deterministic forecast answer', async () => {
    const r = await answerTapWater({ question: "What's the risk of a violation in Chicago next year?" });
    assert.equal(r.groundTruth.pwsid, 'IL0316000');
    assert.match(r.answer.markdown, /forecast gives Chicago .*% chance of a new health-based violation in 2026/);
    assert.match(r.answer.markdown, /not a test of your water/);
    assert.ok(r.groundTruth.profile.risk);
  });
});
