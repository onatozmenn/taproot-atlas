// api/feedback.ts — Vercel serverless function: POST /api/feedback
// Collects answer ratings (thumbs) and study-mode results for user testing.
// No database: every record is written to the function log as one
// `[feedback] {json}` line (Vercel → Logs, filter "[feedback]"). When
// FEEDBACK_WEBHOOK_URL is set (Slack/Discord/Google Apps Script…), the record
// is also POSTed there. Records carry no IP and no free-form personal data
// beyond what the participant typed into the optional comment box.

interface FeedbackRequest {
  method?: string;
  body?: unknown;
}
interface FeedbackResponse {
  status: (code: number) => FeedbackResponse;
  json: (value: unknown) => void;
  end?: () => void;
}

const KINDS = new Set(['rating', 'study']);
const MAX_BYTES = 12_000;

export function cleanFeedback(body: unknown): Record<string, unknown> | null {
  let b = body;
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const rec = b as Record<string, unknown>;
  if (typeof rec.kind !== 'string' || !KINDS.has(rec.kind)) return null;
  const text = JSON.stringify(rec);
  if (text.length > MAX_BYTES) return null;
  return { ...rec, receivedAt: new Date().toISOString() };
}

export default async function handler(req: FeedbackRequest, res: FeedbackResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }
  const rec = cleanFeedback(req.body);
  if (!rec) {
    res.status(400).json({ error: 'Invalid feedback record' });
    return;
  }
  console.log(`[feedback] ${JSON.stringify(rec)}`);
  const hook = process.env.FEEDBACK_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec), signal: AbortSignal.timeout(4000) });
    } catch {
      // The log line is the record of truth; a webhook failure is not the user's problem.
    }
  }
  res.status(200).json({ ok: true });
}
