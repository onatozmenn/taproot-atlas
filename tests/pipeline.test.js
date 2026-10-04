import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater, SHOWCASE_CENTER } from '../dist/lib/pipeline.js';
import { readFile } from 'node:fs/promises';

const echoSnapshot = JSON.parse(await readFile(new URL('../data/echo-nyc.json', import.meta.url), 'utf8'));
const fetchEcho = async () => ({
  pwsid: echoSnapshot.pwsid,
  queryWindow: { ...echoSnapshot.queryWindow },
  totalViolationsFound: echoSnapshot.totalViolationsFound,
  records: echoSnapshot.records,
  echoReportUrl: 'https://echo.epa.gov/detailed-facility-report?fid=NY7003493',
  dataCaptureTime: echoSnapshot.captureTime,
});

describe('answerTapWater', () => {
  it('pass path: showcase coordinate returns audited narrative + ground truth', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.validationStatus.passedLlmAudit, true);
    assert.equal(res.validationStatus.recordSource, 'snapshot_fixture');
    assert.equal(res.groundTruth.pwsid, 'NY7003493');
    assert.ok(res.groundTruth.latestReportedMetrics.length >= 1);
    assert.ok(res.narrative.overview.includes('NY7003493'));
    assert.ok(res.validationStatus.auditTimestamp.length > 0);
  });

  it('works fully offline with no injected deps (bundled fixture)', async () => {
    const res = await answerTapWater({ question: 'hi' });
    assert.equal(res.groundTruth.pwsid, 'NY7003493');
    assert.equal(res.validationStatus.recordSource, 'snapshot_fixture');
    assert.equal(res.validationStatus.passedLlmAudit, true);
  });

  it('defaults to the showcase center without coordinates', async () => {
    const res = await answerTapWater({ question: 'hi' }, { fetchEcho, recordSource: 'snapshot_fixture' });
    assert.equal(res.groundTruth.pwsid, 'NY7003493');
  });

  it('unknown area returns explicit unverified fallback (never a guessed PWSID)', async () => {
    const res = await answerTapWater(
      { question: 'Ankara water?', lat: 39.9, lon: 32.8 },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.groundTruth.pwsid, 'UNKNOWN');
    assert.equal(res.groundTruth.boundaryType, 'unverified_fallback');
  });

  it('fail path: bad narrator output falls back to deterministic summary', async () => {
    const narrate = () => ({
      overview: 'This water is drinkable and pure at 40.7, -74.0.',
      metricsSummary: '',
      complianceNote: '',
      stewardshipNote: '',
    });
    const res = await answerTapWater(
      { question: 'x', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', narrate },
    );
    assert.equal(res.validationStatus.passedLlmAudit, false);
    assert.ok(res.narrative.overview.includes('Verified Water Distribution Overview'));
    assert.equal(res.groundTruth.pwsid, 'NY7003493');
  });

  it('no health-certification string can exit the route', async () => {
    const res = await answerTapWater(
      { question: 'Is it safe?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    const all = [res.narrative.overview, res.narrative.metricsSummary, res.narrative.complianceNote].join(' ').toLowerCase();
    assert.ok(!all.includes('drinkable') && !all.includes('pure') && !all.includes('potable'));
  });
});
