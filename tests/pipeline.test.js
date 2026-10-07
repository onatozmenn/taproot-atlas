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

  it('unknown areas anchor the schematic on the queried location, never NYC', async () => {
    const res = await answerTapWater(
      { question: 'Ankara water?', lat: 39.9, lon: 32.8 },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    const coords = res.groundTruth.schematicFlow.features.map((f) => f.geometry.coordinates);
    assert.ok(coords.length >= 1);
    assert.ok(coords.some(([lon, lat]) => Math.abs(lon - 32.8) < 0.001 && Math.abs(lat - 39.9) < 0.001));
    assert.ok(!coords.some(([lon, lat]) => Math.abs(lon + 73.97) < 0.01 && Math.abs(lat - 40.78) < 0.01));
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

  it('model output without a JEV gate is gated by the deterministic audit (grounded draft passes)', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        narrate: async (s) => ({ narrative: narrateGroundTruth(s), kind: 'llm' }),
      },
    );
    assert.equal(res.validationStatus.jev, 'skipped');
    assert.equal(res.validationStatus.passedLlmAudit, true);
    assert.equal(res.answer.author, 'llm');
  });

  it('model output without a JEV gate falls back when it invents numbers (fail closed)', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        narrate: async (s) => ({
          narrative: { ...narrateGroundTruth(s), answer: 'Lead was measured at 987.6 ppb last week and the water is safe.' },
          kind: 'llm',
        }),
      },
    );
    assert.equal(res.validationStatus.passedLlmAudit, false);
    assert.ok(res.narrative.overview.includes('Verified Water Distribution Overview'));
    assert.equal(res.answer.author, 'template');
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

  it('a JEV pass never turns greetings or off-topic into a water report', async () => {
    let narrateCalled = 0;
    let jevCalled = 0;
    const llmNarrate = async (s) => {
      narrateCalled += 1;
      return { narrative: narrateGroundTruth(s), kind: 'llm' };
    };
    for (const q of ['merhaba', 'hi how are you', 'What do you think about hitler']) {
      narrateCalled = 0;
      jevCalled = 0;
      const res = await answerTapWater(
        { question: q, ...SHOWCASE_CENTER },
        {
          fetchEcho,
          recordSource: 'snapshot_fixture',
          narrate: llmNarrate,
          jevCheck: async () => {
            jevCalled += 1;
            return { passed: true };
          },
        },
      );
      assert.equal(res.scope, 'redirect', q);
      assert.ok(!res.narrative.overview.includes('NY7003493'), q);
      assert.equal(narrateCalled, 0, `model must not run for ${q}`);
      assert.equal(jevCalled, 0, `JEV must not run for ${q}`);
    }
  });

  it('passes the user question to the narrator and JEV facts', async () => {
    let seenQuestion = '';
    let seenFacts = '';
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      {
        fetchEcho,
        recordSource: 'snapshot_fixture',
        narrate: async (s, q) => {
          seenQuestion = q ?? '';
          return { narrative: narrateGroundTruth(s), kind: 'llm' };
        },
        jevCheck: async (_n, facts) => {
          seenFacts = facts;
          return { passed: true };
        },
      },
    );
    assert.equal(res.scope, 'water');
    assert.ok(seenQuestion.includes('Where does my tap water come from?'));
    assert.ok(seenFacts.includes('Where does my tap water come from?'));
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
    // Source intent: the overview answers the asked question first...
    assert.ok(res.narrative.overview.includes('NY7003493'));
    assert.ok(res.narrative.overview.includes('Catskill'));
    assert.ok(!res.narrative.overview.includes('—'));
    // ...while the full evidence stays in the report (cards + summaries).
    assert.ok(res.narrative.metricsSummary.includes('2024 Annual'));
    assert.ok(res.groundTruth.latestReportedMetrics.length >= 1);
  });

  it('quality questions lead with the report, not the basins', async () => {
    const res = await answerTapWater(
      { question: 'What is in my tap water?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'water');
    assert.ok(res.narrative.overview.includes('2024 Annual'));
    assert.ok(res.narrative.overview.includes('Turbidity'));
  });

  it('compliance questions lead with the violation window', async () => {
    const res = await answerTapWater(
      { question: 'Any violations in the last 5 years?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.scope, 'water');
    assert.ok(res.narrative.overview.includes('2021-01-01'));
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

  it('an unsupported place gets a clear empty state, never a silent NYC default', async () => {
    const res = await answerTapWater(
      { question: 'Flint, MI', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    assert.equal(res.scope, 'water');
    assert.equal(res.groundTruth.pwsid, 'UNKNOWN');
    assert.equal(res.groundTruth.placeQuery, 'Flint, MI');
    assert.ok(res.narrative.overview.includes('not in the current snapshot'));
    assert.ok(!res.narrative.overview.includes('NY7003493'));
  });

  it('a place with trailing water words still resolves to the empty state', async () => {
    const res = await answerTapWater(
      { question: 'flint, mi water quality?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    assert.equal(res.scope, 'water');
    assert.equal(res.groundTruth.placeQuery, 'flint, MI');
  });

  it('tier B cities resolve with honest uncurated narratives', async () => {
    const res = await answerTapWater(
      { question: 'chesterfield, missouri water?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    assert.equal(res.scope, 'water');
    assert.equal(res.groundTruth.pwsid, 'MO6010716');
    assert.deepEqual(res.groundTruth.primaryBasins, []);
    assert.equal(res.groundTruth.regulatoryCompliance.snapshotPending, true);
    assert.ok(res.narrative.overview.includes('not yet curated'));
    assert.ok(!res.narrative.overview.includes('basins outside'));
  });

  it('ambiguous city aliases ask for a state instead of guessing', async () => {
    const res = await answerTapWater(
      { question: 'chesterfield?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    assert.equal(res.scope, 'water');
    assert.equal(res.groundTruth.pwsid, 'UNKNOWN');
    assert.ok(res.narrative.overview.includes('Multiple water systems match'));
    assert.ok(res.narrative.overview.includes('MO6010716'));
    assert.ok(res.narrative.overview.includes('VA4041845'));
    const kc = await answerTapWater(
      { question: 'kansas city?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    assert.equal(kc.groundTruth.pwsid, 'UNKNOWN');
    assert.ok(kc.narrative.overview.includes('Multiple water systems match'));
    const kcMo = await answerTapWater(
      { question: 'kansas city, missouri water?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    assert.equal(kcMo.groundTruth.pwsid, 'MO1010415');
  });

  it('tier B overview names the EPA source-water kind', async () => {
    const res = await answerTapWater(
      { question: 'chesterfield, missouri water?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture', findNearby: async () => [] },
    );
    // Missouri American St. Louis is an EPA surface-water system.
    assert.ok(res.narrative.overview.includes('surface water system'));
  });

  it('tier A directory cities narrate their curated basins', async () => {
    const res = await answerTapWater(
      { question: 'philadelphia tap water?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.groundTruth.pwsid, 'PA1510001');
    assert.ok(res.narrative.overview.includes('Schuylkill River'));
  });

  it('live compliance runs for directory cities, not only NYC', async () => {
    const liveProfile = (pwsid) => ({
      pwsid,
      queryWindow: { startDate: '2021-01-01', endDate: '2026-01-01' },
      totalViolationsFound: 1,
      records: [
        { violationCode: '50', violationType: 'other', beginDate: '2023-01-01', endDate: null, complianceAchieved: false },
      ],
      echoReportUrl: `https://echo.epa.gov/detailed-facility-report?fid=${pwsid}`,
      dataCaptureTime: '2026-10-06T00:00:00Z',
    });
    const res = await answerTapWater(
      { question: 'philadelphia tap water?', ...SHOWCASE_CENTER },
      {
        fetchEcho: async (pwsid) => liveProfile(pwsid),
        recordSource: 'live_fetch',
        findNearby: async () => [],
      },
    );
    assert.equal(res.groundTruth.pwsid, 'PA1510001');
    assert.equal(res.validationStatus.recordSource, 'live_fetch');
    assert.equal(res.groundTruth.regulatoryCompliance.totalViolationsFound, 1);
    assert.equal(res.groundTruth.regulatoryCompliance.records[0].violationType, 'other');
  });

  it('chicago serves curated lab metrics from its CCR snapshot', async () => {
    const res = await answerTapWater(
      { question: 'chicago tap water?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.groundTruth.pwsid, 'IL0316000');
    assert.equal(res.groundTruth.latestReportedMetrics.length, 2);
    assert.ok(res.narrative.metricsSummary.includes('Turbidity'));
  });

  it('attaches the treatment profile with a rigor label', async () => {
    const res = await answerTapWater(
      { question: 'Where does my tap water come from?', ...SHOWCASE_CENTER },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.ok(res.groundTruth.treatment);
    assert.equal(
      res.groundTruth.treatment.rigor,
      'Unfiltered surface water, disinfected',
    );
    assert.ok(res.groundTruth.treatment.processes.includes('FLUORIDATION'));
  });

  it('explicit coordinates in a Verified ring keep the verified verdict', async () => {
    const res = await answerTapWater(
      { question: 'tell me about the water here', lat: 34.05, lon: -118.25 },
      { fetchEcho, recordSource: 'snapshot_fixture' },
    );
    assert.equal(res.groundTruth.pwsid, 'CA1910067');
    assert.equal(res.groundTruth.boundaryType, 'verified_agency');
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
