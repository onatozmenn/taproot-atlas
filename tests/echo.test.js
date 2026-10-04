import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchEchoCompliance,
  readSnapshotCompliance,
  echoReportUrl,
  EchoError,
} from '../dist/lib/echo.js';

const LIVE = 'https://echo.epa.gov/detailed-facility-report?fid=NY7003493';
const snapshot = {
  pwsid: 'NY7003493',
  queryWindow: { startDate: '2021-01-01', endDate: '2026-01-01' },
  totalViolationsFound: 0,
  records: [],
  captureTime: '2026-01-02T00:00:00Z',
};
const okFetch = async () => snapshot;

describe('readSnapshotCompliance', () => {
  it('loads the bundled fixture with window, ECHO link, and capture time', () => {
    const c = readSnapshotCompliance('NY7003493', undefined, '2026-01-02T00:00:00Z');
    assert.deepEqual(c.queryWindow, { startDate: '2021-01-01', endDate: '2026-01-01' });
    assert.equal(c.totalViolationsFound, 0);
    assert.ok(c.echoReportUrl.includes('echo.epa.gov'));
  });

  it('rejects a PWSID the fixture does not cover', () => {
    assert.throws(() => readSnapshotCompliance('TX0000001'), EchoError);
  });
});

describe('fetchEchoCompliance', () => {
  it('loads the 5-year window with ECHO link and capture time', async () => {
    const c = await fetchEchoCompliance('NY7003493', { sourceUrl: LIVE, fetchJson: okFetch });
    assert.deepEqual(c.queryWindow, { startDate: '2021-01-01', endDate: '2026-01-01' });
    assert.equal(c.totalViolationsFound, 0);
    assert.ok(c.echoReportUrl.includes('echo.epa.gov'));
    assert.ok(c.dataCaptureTime.length > 0);
  });

  it('rejects a sourceUrl that is not http(s)', async () => {
    await assert.rejects(
      () => fetchEchoCompliance('NY7003493', { sourceUrl: 'file:///data/echo-nyc.json', fetchJson: okFetch }),
      (e) => {
        assert.equal(e.kind, 'bad_response');
        return true;
      },
    );
  });

  it('rejects a snapshot for another PWSID', async () => {
    await assert.rejects(
      () => fetchEchoCompliance('TX0000001', { sourceUrl: LIVE, fetchJson: okFetch }),
      EchoError,
    );
  });

  it('rejects a non-numeric violation count', async () => {
    const bad = async () => ({ ...snapshot, totalViolationsFound: 'zero' });
    await assert.rejects(
      () => fetchEchoCompliance('NY7003493', { sourceUrl: LIVE, fetchJson: bad }),
      (e) => {
        assert.equal(e.kind, 'bad_response');
        return true;
      },
    );
  });

  it('rejects records outside the requested window', async () => {
    const other = async () => ({
      ...snapshot,
      queryWindow: { startDate: '2015-01-01', endDate: '2020-01-01' },
    });
    await assert.rejects(
      () => fetchEchoCompliance('NY7003493', { sourceUrl: LIVE, fetchJson: other }),
      (e) => {
        assert.equal(e.kind, 'bad_response');
        return true;
      },
    );
  });

  it('maps network failures to typed errors (never silent)', async () => {
    const failing = async () => {
      throw new Error('socket hang up');
    };
    await assert.rejects(
      () => fetchEchoCompliance('NY7003493', { sourceUrl: LIVE, fetchJson: failing }),
      (e) => {
        assert.equal(e.kind, 'network');
        return true;
      },
    );
  });

  it('times out slowly-hanging fetches', async () => {
    const hanging = () => new Promise(() => {});
    await assert.rejects(
      () => fetchEchoCompliance('NY7003493', { sourceUrl: LIVE, fetchJson: hanging, timeoutMs: 20 }),
      (e) => {
        assert.equal(e.kind, 'timeout');
        return true;
      },
    );
  });

  it('echoReportUrl uses the ECHO detailed-facility pattern', () => {
    assert.equal(echoReportUrl('NY7003493'), 'https://echo.epa.gov/detailed-facility-report?fid=NY7003493');
  });
});
