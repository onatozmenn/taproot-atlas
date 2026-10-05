import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLiveCompliance } from '../dist/lib/echo-live.js';
import { EchoError } from '../dist/lib/echo.js';

const row = (overrides = {}) => ({
  violation_code: '50',
  violation_category_code: 'MR',
  is_health_based_ind: 'N',
  compl_per_begin_date: '2023-04-01 00:00:00',
  compl_per_end_date: null,
  rtc_date: null,
  ...overrides,
});

const fetchJson = (payload) => async () => payload;

describe('fetchLiveCompliance', () => {
  it('maps efservice rows and filters to the query window', async () => {
    const p = await fetchLiveCompliance('NY7003493', {
      fetchJson: fetchJson([
        row({ compl_per_begin_date: '1999-01-01 00:00:00', compl_per_end_date: '2000-01-01 00:00:00' }),
        row({ compl_per_begin_date: '2023-04-01 00:00:00', is_health_based_ind: 'Y' }),
        row({ compl_per_begin_date: '2030-01-01 00:00:00' }),
      ]),
      now: () => '2026-10-05T00:00:00Z',
    });
    assert.equal(p.pwsid, 'NY7003493');
    assert.equal(p.totalViolationsFound, 1);
    assert.equal(p.records[0].violationType, 'health_based');
    assert.equal(p.records[0].beginDate, '2023-04-01');
    assert.equal(p.records[0].endDate, null);
    assert.equal(p.records[0].complianceAchieved, false);
    assert.ok(p.echoReportUrl.includes('NY7003493'));
    assert.equal(p.snapshotPending, undefined);
  });

  it('reports zero when nothing overlaps the window (a real finding)', async () => {
    const p = await fetchLiveCompliance('NY7003493', {
      fetchJson: fetchJson([
        row({ compl_per_begin_date: '1999-01-01 00:00:00', compl_per_end_date: '2000-01-01 00:00:00' }),
      ]),
      now: () => '2026-10-05T00:00:00Z',
    });
    assert.equal(p.totalViolationsFound, 0);
    assert.deepEqual(p.records, []);
  });

  it('classifies monitoring vs other violations and rtc compliance', async () => {
    const p = await fetchLiveCompliance('NY7003493', {
      fetchJson: fetchJson([
        row({ compl_per_begin_date: '2022-01-01 00:00:00', rtc_date: '2022-06-01 00:00:00' }),
        row({
          compl_per_begin_date: '2022-01-01 00:00:00',
          violation_category_code: 'TT',
          is_health_based_ind: 'N',
        }),
      ]),
    });
    assert.equal(p.records[0].violationType, 'monitoring_and_reporting');
    assert.equal(p.records[0].complianceAchieved, true);
    assert.equal(p.records[1].violationType, 'other');
  });

  it('refuses non-PWSID input and malformed responses', async () => {
    await assert.rejects(() => fetchLiveCompliance('UNKNOWN', { fetchJson: fetchJson([]) }), EchoError);
    await assert.rejects(
      () => fetchLiveCompliance('NY7003493', { fetchJson: fetchJson({ nope: true }) }),
      EchoError,
    );
    await assert.rejects(
      () => fetchLiveCompliance('NY7003493', { fetchJson: fetchJson([42]) }),
      EchoError,
    );
  });

  it('skips rows without a parseable begin date', async () => {
    const p = await fetchLiveCompliance('NY7003493', {
      fetchJson: fetchJson([{ violation_code: '1' }, row({ compl_per_begin_date: '2024-05-01 00:00:00' })]),
    });
    assert.equal(p.totalViolationsFound, 1);
  });
});
