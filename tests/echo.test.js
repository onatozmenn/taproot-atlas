import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchEchoCompliance, echoReportUrl, EchoError } from '../dist/lib/echo.js';

const snapshot = JSON.parse(await readFile(new URL('../data/echo-nyc.json', import.meta.url), 'utf8'));
const okFetch = async () => snapshot;

describe('fetchEchoCompliance', () => {
  it('loads the 5-year window with ECHO link and capture time', async () => {
    const c = await fetchEchoCompliance('NY0023456', { fetchJson: okFetch });
    assert.deepEqual(c.queryWindow, { startDate: '2021-01-01', endDate: '2026-01-01' });
    assert.equal(c.totalViolationsFound, 0);
    assert.ok(c.echoReportUrl.includes('echo.epa.gov'));
    assert.ok(c.dataCaptureTime.length > 0);
  });

  it('rejects a snapshot for another PWSID', async () => {
    await assert.rejects(() => fetchEchoCompliance('TX0000001', { fetchJson: okFetch }), EchoError);
  });

  it('maps network failures to typed errors (never silent)', async () => {
    const failing = async () => {
      throw new Error('socket hang up');
    };
    await assert.rejects(() => fetchEchoCompliance('NY0023456', { fetchJson: failing }), (e) => {
      assert.equal(e.kind, 'network');
      return true;
    });
  });

  it('times out slowly-hanging fetches', async () => {
    const hanging = () => new Promise(() => {});
    await assert.rejects(
      () => fetchEchoCompliance('NY0023456', { fetchJson: hanging, timeoutMs: 20 }),
      (e) => {
        assert.equal(e.kind, 'timeout');
        return true;
      },
    );
  });

  it('echoReportUrl uses the ECHO detailed-facility pattern', () => {
    assert.equal(echoReportUrl('NY0023456'), 'https://echo.epa.gov/detailed-facility-report?fid=NY0023456');
  });
});
