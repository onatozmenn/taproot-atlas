// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import handler, { resetAskRateLimit } from '../../api/ask';

// Keep the handler hermetic: live EPA sources are on by default in production.
process.env.ECHO_LIVE_SOURCE = 'off';

function res() {
  let code = 0;
  let payload: unknown;
  const headers: Record<string, string> = {};
  const r = {
    status(c: number) {
      code = c;
      return r;
    },
    json(v: unknown) {
      payload = v;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  };
  return { r, code: () => code, payload: () => payload, headers };
}

describe('POST /api/ask', () => {
  beforeEach(() => resetAskRateLimit());

  it('rejects non-POST methods', async () => {
    const { r, code } = res();
    await handler({ method: 'GET', body: {} }, r);
    expect(code()).toBe(405);
  });

  it('answers from the audited template path without a key', async () => {
    delete process.env.AI_API_KEY;
    const { r, code, payload } = res();
    await handler({ method: 'POST', body: { question: 'Where does my tap water come from?' } }, r);
    expect(code()).toBe(200);
    const out = payload() as { groundTruth: { pwsid: string }; validationStatus: { narrator: string; passedLlmAudit: boolean } };
    expect(out.groundTruth.pwsid).toBe('NY7003493');
    expect(out.validationStatus.narrator).toBe('template');
    expect(out.validationStatus.passedLlmAudit).toBe(true);
  });

  it('rejects present-but-invalid coordinates instead of defaulting to NYC', async () => {
    const { r, code } = res();
    await handler({ method: 'POST', body: { question: 'Ankara water?', lat: 999, lon: 32.8 } }, r);
    expect(code()).toBe(400);
    const { r: r2, code: code2 } = res();
    await handler({ method: 'POST', body: { question: 'Ankara water?', lat: 39.9 } }, r2);
    expect(code2()).toBe(400);
  });

  it('rate-limits burst traffic with 429', async () => {
    process.env.ASK_RATE_LIMIT_MAX = '2';
    process.env.ASK_RATE_LIMIT_WINDOW_MS = '60000';
    try {
      for (let i = 0; i < 2; i++) {
        const { r, code } = res();
        await handler(
          { method: 'POST', body: { question: 'Where does my tap water come from?' }, headers: { 'x-forwarded-for': '10.0.0.9' } },
          r,
        );
        expect(code()).toBe(200);
      }
      const over = res();
      await handler(
        { method: 'POST', body: { question: 'Where does my tap water come from?' }, headers: { 'x-forwarded-for': '10.0.0.9' } },
        over.r,
      );
      expect(over.code()).toBe(429);
      expect(over.headers['retry-after']).toBeDefined();
    } finally {
      delete process.env.ASK_RATE_LIMIT_MAX;
      delete process.env.ASK_RATE_LIMIT_WINDOW_MS;
      resetAskRateLimit();
    }
  });
});
