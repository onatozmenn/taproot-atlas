// web/api/ask.ts — Vercel serverless function: POST /api/ask
// Runs the deterministic pipeline server-side. When AI_* env is configured,
// a model drafts the narrative (still audited; fallback on failure).
// Without a key it serves the audited template path. Never leaks the key:
// only the audited ValidatedApiResponse leaves this function.
// Cost guard: in-memory sliding-window rate limit (ASK_RATE_LIMIT_MAX per
// ASK_RATE_LIMIT_WINDOW_MS, default 30/min/IP → 429) plus scope short-circuit
// in the pipeline (off-topic never invokes the model/JEV).
import { answerTapWater } from '../lib/pipeline.js';
import { narrateGroundTruth } from '../lib/narrator.js';
import { llmNarrate } from '../lib/llm-narrator.js';
import { jevCheckNarrative } from '../lib/jev-audit.js';
import { fetchLiveCompliance } from '../lib/echo-live.js';
import { fetchTreatment, readTreatmentFixture } from '../lib/treatment.js';
import { fetchFacilities, readFacilityFixture } from '../lib/facility.js';
import { fetchLcrMetrics, loadLcrMetrics } from '../lib/lcr.js';
import { fetchDistributionMetrics } from '../lib/distribution.js';
import { fetchUpstreamSummary } from '../lib/nldi.js';

interface AskRequest {
  body?: { question?: unknown; lat?: unknown; lon?: unknown };
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

interface AskResponse {
  status: (code: number) => AskResponse;
  json: (value: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

const rateBuckets = new Map<string, number[]>();

export function resetAskRateLimit(): void {
  rateBuckets.clear();
}

function rateLimitMax(): number {
  const v = Number(process.env.ASK_RATE_LIMIT_MAX ?? '30');
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 30;
}

function rateLimitWindowMs(): number {
  const v = Number(process.env.ASK_RATE_LIMIT_WINDOW_MS ?? '60000');
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 60000;
}

function getClientIp(req: AskRequest): string {
  const forwarded = req.headers?.['x-forwarded-for'] ?? req.headers?.['X-Forwarded-For'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof first === 'string' && first.trim().length > 0) return first.split(',')[0].trim();
  if (typeof req.ip === 'string' && req.ip.length > 0) return req.ip;
  const remote = req.socket?.remoteAddress;
  if (typeof remote === 'string' && remote.length > 0) return remote;
  return 'unknown';
}

function isRateLimited(ip: string): { limited: boolean; retryAfterSec: number } {
  const max = rateLimitMax();
  const windowMs = rateLimitWindowMs();
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const oldest = Math.min(...hits);
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(ip, hits);
    return { limited: true, retryAfterSec };
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  return { limited: false, retryAfterSec: 0 };
}

function setCors(res: AskResponse): void {
  res.setHeader?.('access-control-allow-origin', '*');
  res.setHeader?.('access-control-allow-methods', 'POST, OPTIONS');
  res.setHeader?.('access-control-allow-headers', 'content-type');
}

function isValidCoord(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    (lon as number) >= -180 &&
    (lon as number) <= 180
  );
}

export default async function handler(req: AskRequest, res: AskResponse): Promise<void> {
  setCors(res);
  if (!req.method || req.method === 'OPTIONS') {
    res.status(200).json({ ok: true });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed; use POST.' });
    return;
  }
  const ip = getClientIp(req);
  const gate = isRateLimited(ip);
  if (gate.limited) {
    res.setHeader?.('retry-after', String(gate.retryAfterSec));
    res.status(429).json({ error: 'Rate limit exceeded. Retry shortly.' });
    return;
  }
  const body = req.body ?? {};
  const rawQuestion = typeof body.question === 'string' ? body.question : '';
  const question = rawQuestion.slice(0, 2000);
  // Missing coordinates fall back to the showcase center inside the
  // pipeline. Present-but-invalid coordinates are a client error, never a
  // silent NYC fallback.
  const hasLat = body.lat !== undefined;
  const hasLon = body.lon !== undefined;
  if (hasLat || hasLon) {
    if (!isValidCoord(body.lat, body.lon)) {
      res.status(400).json({ error: 'Invalid coordinates: lat in [-90, 90], lon in [-180, 180] as finite numbers.' });
      return;
    }
  }
  const lat = typeof body.lat === 'number' ? body.lat : undefined;
  const lon = typeof body.lon === 'number' ? body.lon : undefined;
  const coords =
    lat !== undefined && lon !== undefined && isValidCoord(lat, lon) ? { lat, lon } : {};

  const apiKey = process.env.AI_API_KEY ?? '';
  const baseUrl = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini';
  const apiMode = process.env.AI_API_MODE === 'chat-completions' ? 'chat-completions' : 'responses';
  const jevKey = process.env.JEV_API_KEY ?? '';
  const jevBaseUrl = process.env.JEV_BASE_URL ?? 'https://opencode.ai/zen';
  const jevModel = process.env.JEV_MODEL ?? 'jev-1.13-free';
  // Live SDWIS compliance (Envirofacts efservice, no key). Off by default so
  // previews and tests stay hermetic; the pipeline degrades to snapshot
  // records on any live failure.
  const liveEcho = process.env.ECHO_LIVE_SOURCE === 'efservice';

  try {
    const out = await answerTapWater(
      { question, ...coords },
      {
        ...(liveEcho
          ? {
              fetchEcho: (pwsid: string) => fetchLiveCompliance(pwsid, { timeoutMs: 8000 }),
              recordSource: 'live_fetch' as const,
            }
          : { recordSource: 'snapshot_fixture' as const }),
        ...(liveEcho
          ? {
              fetchTreatmentProfile: async (pwsid: string) => {
                try {
                  return await fetchTreatment(pwsid, { timeoutMs: 8000 });
                } catch {
                  return readTreatmentFixture(pwsid);
                }
              },
              fetchFacilitiesProfile: async (pwsid: string) => {
                try {
                  return await fetchFacilities(pwsid, { timeoutMs: 8000 });
                } catch {
                  return readFacilityFixture(pwsid);
                }
              },
              fetchLcrMetrics: async (pwsid: string) => {
                try {
                  const live = await fetchLcrMetrics(pwsid, { timeoutMs: 8000 });
                  return live.length > 0 ? live : loadLcrMetrics(pwsid);
                } catch {
                  return loadLcrMetrics(pwsid);
                }
              },
              fetchDistributionMetrics: async (pwsid: string) => {
                try {
                  return await fetchDistributionMetrics(pwsid, { timeoutMs: 8000 });
                } catch {
                  return [];
                }
              },
              fetchUpstream: async (lon: number, lat: number, label: string) => {
                try {
                  return await fetchUpstreamSummary(lon, lat, label, { timeoutMs: 8000 });
                } catch {
                  return null;
                }
              },
            }
          : {}),
        ...(apiKey
          ? {
              narratorKind: 'llm' as const,
              narrate: async (schematic, q) => {
                const draft = await llmNarrate(schematic, { baseUrl, apiKey, model, api: apiMode }, fetch as never, 20000, q ?? question);
                return draft ? { narrative: draft, kind: 'llm' as const } : { narrative: narrateGroundTruth(schematic), kind: 'template' as const };
              },
            }
          : { narratorKind: 'template' as const }),
        ...(jevKey
          ? {
              jevCheck: (narrativeText: string, factsText: string) =>
                jevCheckNarrative(narrativeText, factsText, {
                  baseUrl: jevBaseUrl,
                  apiKey: jevKey,
                  model: jevModel,
                }),
            }
          : {}),
      },
    );
    res.status(200).json(out);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Lookup failed.' });
  }
}
