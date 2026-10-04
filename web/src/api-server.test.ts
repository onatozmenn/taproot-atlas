// @vitest-environment node
import { describe, it, expect } from 'vitest';
import handler from '../../api/ask';

function res() {
  let code = 0;
  let payload: unknown;
  const r = {
    status(c: number) {
      code = c;
      return r;
    },
    json(v: unknown) {
      payload = v;
    },
  };
  return { r, code: () => code, payload: () => payload };
}

describe('POST /api/ask', () => {
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
});
