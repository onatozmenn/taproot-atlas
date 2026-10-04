// web/api/ask.ts — Vercel serverless function: POST /api/ask
// Runs the deterministic pipeline server-side. When AI_* env is configured,
// a model drafts the narrative (still audited; fallback on failure).
// Without a key it serves the audited template path. Never leaks the key:
// only the audited ValidatedApiResponse leaves this function.
import { answerTapWater } from '../../lib/pipeline';
import { narrateGroundTruth } from '../../lib/narrator';
import { llmNarrate } from '../../lib/llm-narrator';
import { jevCheckNarrative } from '../../lib/jev-audit';

interface AskRequest {
  body?: { question?: unknown; lat?: unknown; lon?: unknown };
  method?: string;
}

interface AskResponse {
  status: (code: number) => AskResponse;
  json: (value: unknown) => void;
}

export default async function handler(req: AskRequest, res: AskResponse): Promise<void> {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed; use POST.' });
    return;
  }
  const body = req.body ?? {};
  const question = typeof body.question === 'string' ? body.question : '';
  const lat = typeof body.lat === 'number' ? body.lat : undefined;
  const lon = typeof body.lon === 'number' ? body.lon : undefined;

  const apiKey = process.env.AI_API_KEY ?? '';
  const baseUrl = process.env.AI_BASE_URL ?? 'https://opencode.ai/zen/v1';
  const model = process.env.AI_MODEL ?? 'gpt-6-luna';
  const apiMode = process.env.AI_API_MODE === 'chat-completions' ? 'chat-completions' : 'responses';
  const jevKey = process.env.JEV_API_KEY ?? '';
  const jevBaseUrl = process.env.JEV_BASE_URL ?? 'https://opencode.ai/zen';
  const jevModel = process.env.JEV_MODEL ?? 'jev-1.13-free';

  try {
    const out = await answerTapWater(
      { question, lat, lon },
      {
        ...(apiKey
          ? {
              narratorKind: 'llm' as const,
              narrate: async (schematic) => {
                const draft = await llmNarrate(schematic, { baseUrl, apiKey, model, api: apiMode });
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
