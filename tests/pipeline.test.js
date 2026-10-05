import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTapWater, SHOWCASE_CENTER } from '../dist/lib/pipeline.js';
import { narrateGroundTruth } from '../dist/lib/narrator.js';
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
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    assert.equal(res.groundTruth.pwsid, 'UNKNOWN');
    assert.equal(res.groundTruth.boundaryType, 'unverified_fallback');
  });

  it('attaches nearby drinking-water points for unknown areas (best effort)', async () => {
    const res = await answerTapWater(
      { question: 'Ankara water?', lat: 39.9, lon: 32.8 },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        findNearby: async () => [
          { name: 'Park fountain', lat: 39.9, lon: 32.8, distanceM: 120, osmUrl: 'https://www.openstreetmap.org/node/1' },
        ],
      },
    );
    assert.equal(res.groundTruth.nearbyDrinkingPoints?.length, 1);
    assert.equal(res.groundTruth.nearbyDrinkingPoints?.[0].osmUrl, 'https://www.openstreetmap.org/node/1');
  });

  it('a failed nearby lookup only omits the list, never blocks', async () => {
    const res = await answerTapWater(
      { question: 'Ankara water?', lat: 39.9, lon: 32.8 },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        findNearby: async () => {
          throw new Error('overpass down');
        },
      },
    );
    assert.equal(res.groundTruth.pwsid, 'UNKNOWN');
    assert.equal(res.groundTruth.nearbyDrinkingPoints, undefined);
  });

  it('fail path: bad narrator output falls back to deterministic summary', async () => {
    const narrate = () => ({
      overview: 'This water is drinkable and pure at 40.7, -74.0.',
      metricsSummary: '',
      complianceNote: '',
      stewardshipNote: '',
    });
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
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

  it('JEV flag forces fallback for model output', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        narrate: async (s) => ({ narrative: narrateGroundTruth(s), kind: 'llm' }),
        jevCheck: async () => ({ passed: false }),
      },
    );
    assert.equal(res.validationStatus.jev, 'flag');
    assert.equal(res.validationStatus.passedLlmAudit, false);
    assert.ok(res.narrative.overview.includes('Verified Water Distribution Overview'));
  });

  it('JEV pass keeps the model narrative and is recorded', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        narrate: async (s) => ({ narrative: narrateGroundTruth(s), kind: 'llm' }),
        jevCheck: async () => ({ passed: true }),
      },
    );
    assert.equal(res.validationStatus.jev, 'pass');
    assert.equal(res.validationStatus.passedLlmAudit, true);
  });

  it('model output without a JEV gate falls back (fail closed)', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        narrate: async (s) => ({ narrative: narrateGroundTruth(s), kind: 'llm' }),
      },
    );
    assert.equal(res.validationStatus.jev, 'skipped');
    assert.equal(res.validationStatus.passedLlmAudit, false);
    assert.ok(res.narrative.overview.includes('Verified Water Distribution Overview'));
  });

  it('model output on an off-topic question falls back to the redirect', async () => {
    const res = await answerTapWater(
      { question: 'What do you think about hitler', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        narrate: async (s) => ({ narrative: narrateGroundTruth(s), kind: 'llm' }),
        jevCheck: async () => ({ passed: false }),
      },
    );
    assert.equal(res.scope, 'redirect');
    assert.ok(res.narrative.overview.includes('tap-water records'));
  });

  it('absent JEV records skipped without blocking', async () => {
    const res = await answerTapWater({ question: 'Where does my tap water come from?', ...SHOWCASE_CENTER }, { fetchEcho });
    assert.equal(res.validationStatus.jev, 'skipped');
    assert.equal(res.validationStatus.passedLlmAudit, true);
  });

  it('reports the actual narrator when the model path falls back to template', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        narratorKind: 'llm',
        narrate: async (s) => ({ narrative: narrateGroundTruth(s), kind: 'template' }),
      },
    );
    assert.equal(res.validationStatus.narrator, 'template');
    assert.equal(res.validationStatus.passedLlmAudit, true);
  });

  it('water questions keep the full report scope', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'water');
    assert.ok(res.narrative.overview.includes('NY7003493'));
    assert.ok(res.narrative.overview.includes('2024 Annual'));
    assert.ok(!res.narrative.overview.includes('—'));
  });

  it('unknown areas get pending compliance, never a zero-violations claim', async () => {
    const res = await answerTapWater(
      { question: 'Ankara water?', lat: 39.9, lon: 32.8 },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.groundTruth.regulatoryCompliance.snapshotPending, true);
    assert.ok(res.narrative.complianceNote.includes('not yet curated'));
  });

  it('smalltalk gets a greeting redirect, never the report', async () => {
    const res = await answerTapWater(
      { question: 'Hi how are you', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'redirect');
    assert.equal(res.validationStatus.narrator, 'template');
    assert.equal(res.validationStatus.passedLlmAudit, true);
    assert.ok(res.narrative.overview.toLowerCase().includes('tap water'));
    assert.ok(!res.narrative.overview.includes('NY7003493'));
  });

  it('off-topic questions get a deflection back to tap-water records', async () => {
    const res = await answerTapWater(
      { question: 'What do you think about hitler', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'redirect');
    const all = [res.narrative.overview, res.narrative.metricsSummary].join(' ');
    assert.ok(all.includes('tap-water records'));
    assert.ok(!all.includes('NY7003493'));
  });

  it('directory cities resolve by name with pending compliance', async () => {
    const la = await answerTapWater(
      { question: 'los angeles water?', lat: 39.9, lon: 32.8 },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(la.scope, 'water');
    assert.equal(la.groundTruth.pwsid, 'CA1910067');
    assert.equal(la.groundTruth.boundaryType, 'unverified_fallback');
    assert.equal(la.groundTruth.regulatoryCompliance.snapshotPending, true);
    assert.deepEqual(la.groundTruth.latestReportedMetrics, []);
    assert.ok(!la.narrative.complianceNote.includes('0 violations'));
    assert.ok(la.narrative.complianceNote.includes('not yet curated'));

    const chi = await answerTapWater(
      { question: 'Where does Chicago tap water come from?' },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(chi.groundTruth.pwsid, 'IL0316000');
    assert.ok(chi.groundTruth.primaryBasins.includes('Lake Michigan'));
  });

  it('a bare city name counts as a water question', async () => {
    const res = await answerTapWater(
      { question: 'houston?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'water');
    assert.equal(res.groundTruth.pwsid, 'TX1010013');
  });

  it('tier B cities resolve with honest uncurated narratives', async () => {
    const res = await answerTapWater(
      { question: 'seattle?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'water');
    assert.equal(res.groundTruth.pwsid, 'WA5377050');
    assert.deepEqual(res.groundTruth.primaryBasins, []);
    assert.equal(res.groundTruth.regulatoryCompliance.snapshotPending, true);
    assert.ok(res.narrative.overview.includes('not yet curated'));
    assert.ok(!res.narrative.overview.includes('basins outside'));
  });

  it('tier A directory cities narrate their curated basins', async () => {
    const res = await answerTapWater(
      { question: 'philadelphia tap water?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.groundTruth.pwsid, 'PA1510001');
    assert.ok(res.narrative.overview.includes('Schuylkill River'));
  });

  it('nyc by name resolves to the curated snapshot from anywhere', async () => {
    const res = await answerTapWater(
      { question: 'new york water?', lat: 39.9, lon: 32.8 },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'water');
    assert.equal(res.groundTruth.pwsid, 'NY7003493');
    assert.ok(res.groundTruth.latestReportedMetrics.length >= 1);
  });

  it('a failed compliance fetch degrades honestly instead of 502', async () => {
    const throwing = async () => {
      throw new Error('network down');
    };
    const nyc = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      { fetchEcho: throwing, recordSource: 'live_fetch' },
    );
    assert.equal(nyc.scope, 'water');
    assert.equal(nyc.groundTruth.pwsid, 'NY7003493');
    assert.equal(nyc.validationStatus.recordSource, 'snapshot_fixture');
    assert.ok(nyc.groundTruth.latestReportedMetrics.length >= 1);

    const la = await answerTapWater(
      { question: 'los angeles water?', ...SHOWCASE_CENTER },
      { fetchEcho: throwing, recordSource: 'live_fetch' },
    );
    assert.equal(la.groundTruth.pwsid, 'CA1910067');
    assert.equal(la.groundTruth.regulatoryCompliance.snapshotPending, true);
    assert.equal(la.validationStatus.recordSource, 'snapshot_fixture');
  });
});
