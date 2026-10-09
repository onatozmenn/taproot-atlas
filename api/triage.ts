// api/triage.ts — Vercel serverless function: GET /api/triage
// The utility / regulator priority queue built from Taproot's forecast.
// Query: state=OH, action=lead|dbp|..., vulnerable=1, hidden=1, minPop=10000, limit=50
import { triage, type TriageAction } from '../lib/triage.js';

interface TriageRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}
interface TriageResponse {
  status: (code: number) => TriageResponse;
  json: (value: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

const ACTIONS = new Set(['monitoring', 'lead', 'dbp', 'micro', 'chem', 'deficiency', 'surface', 'enforcement', 'watch']);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default function handler(req: TriageRequest, res: TriageResponse): void {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET' });
    return;
  }
  const q = req.query ?? {};
  const action = one(q.action);
  const out = triage({
    state: one(q.state) || undefined,
    action: ACTIONS.has(action) ? (action as TriageAction) : undefined,
    vulnerable: one(q.vulnerable) === '1',
    hidden: one(q.hidden) === '1',
    minPop: Number(one(q.minPop)) || undefined,
    limit: Number(one(q.limit)) || 50,
  });
  if (!out) {
    res.status(503).json({ error: 'Triage data is not available.' });
    return;
  }
  res.setHeader?.('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json(out);
}
