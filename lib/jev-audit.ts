// lib/jev-audit.ts — JEV (TypeSafe System One) second audit layer.
// The deterministic audit in lib/guardrails.ts is the hard gate and always
// runs. JEV adds a model-graded control on top: state = { narrative, facts },
// three noul questions mirroring the guardrail rules. A JEV flag forces the
// deterministic fallback; a JEV outage never blocks answers (recorded as
// 'skipped'/'error' in validationStatus, deterministic verdict stands).
// Docs: https://docs.typesafe.ai/api — POST {baseUrl}/v1/systemone.

export interface JevConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Flag when any noul score reaches this. Default 0.5. */
  threshold?: number;
}

export interface JevVerdict {
  passed: boolean;
  scores: Record<string, number>;
  model: string;
}

export type JevFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const QUESTIONS = {
  has_ungrounded_numbers: {
    type: 'noul',
    instructions: 'Does the narrative state any numeric value (amount, level, date, percentage, count) that is NOT present in the ground-truth facts?',
    criteria: {
      true: 'At least one number in the narrative is absent from the facts',
      false: 'Every number in the narrative appears in the facts',
    },
  },
  health_certification: {
    type: 'noul',
    instructions: 'Does the narrative certify the water as safe, drinkable, pure, or healthy, outside of quoting a statute name such as the Safe Drinking Water Act?',
    criteria: {
      true: 'Contains an uncertified health or safety verdict about the water',
      false: 'No health verdict; findings are framed as regulatory compliance or absent',
    },
  },
  reveals_coordinates: {
    type: 'noul',
    instructions: 'Does the narrative contain geographic coordinates in any notation (decimal, degrees, hemisphere letters)?',
    criteria: {
      true: 'Coordinates are present in the text',
      false: 'No coordinates in the text',
    },
  },
} as const;

interface JevResponse {
  model: string;
  answers: Record<string, { type: string; noul?: number }>;
}

export async function jevCheckNarrative(
  narrativeText: string,
  factsText: string,
  config: JevConfig,
  fetchFn: JevFetch = fetch as unknown as JevFetch,
  timeoutMs = 20000,
): Promise<JevVerdict | null> {
  if (!config.apiKey) return null;
  const threshold = config.threshold ?? 0.5;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${config.baseUrl.replace(/\/$/, '')}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        state: { narrative: narrativeText, facts: factsText },
        questions: QUESTIONS,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as JevResponse;
    if (!data || typeof data !== 'object' || !data.answers) return null;
    const scores: Record<string, number> = {};
    for (const id of Object.keys(QUESTIONS)) {
      const a = data.answers[id];
      if (!a || a.type !== 'noul' || typeof a.noul !== 'number') return null;
      scores[id] = a.noul;
    }
    return { passed: Object.values(scores).every((s) => s < threshold), scores, model: data.model };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
