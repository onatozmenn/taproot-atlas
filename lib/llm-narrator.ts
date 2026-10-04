// lib/llm-narrator.ts — OpenAI-compatible narrator adapter.
// Builds a facts-only prompt (geometries EXCLUDED so coordinates can never be
// echoed) and parses the model's JSON into a Narrative. Any failure → null,
// and the pipeline falls back to the deterministic template. Output is ALWAYS
// re-audited; this adapter never bypasses guardrails.
import type { WaterOriginSchematic } from '../types/water-intelligence.js';
import type { Narrative } from './narrator.js';
import { WATER_INTELLIGENCE_SYSTEM_PROMPT } from '../prompts/system.js';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LlmFetchInit {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export type LlmFetch = (url: string, init: LlmFetchInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** Ground-truth facts only. No coordinates, no PWSID digits beyond the ID itself. */
export function buildFactsMessage(schematic: WaterOriginSchematic): string {
  const facts = {
    systemName: schematic.systemName,
    pwsid: schematic.pwsid,
    boundaryType: schematic.boundaryType,
    primaryBasins: schematic.primaryBasins,
    flowLabels: schematic.schematicFlow.features.map((f) => ({
      label: f.properties.label,
      role: f.properties.role,
    })),
    metrics: schematic.latestReportedMetrics.map((m) => ({
      parameter: m.parameter,
      reportedValue: m.reportedValue,
      regulatoryThreshold: m.regulatoryThreshold,
      complianceStatus: m.complianceStatus,
      testDate: m.testDate,
      reportPeriod: m.provenance.reportPeriod,
    })),
    queryWindow: schematic.regulatoryCompliance.queryWindow,
    totalViolationsFound: schematic.regulatoryCompliance.totalViolationsFound,
    dataCaptureTime: schematic.regulatoryCompliance.dataCaptureTime,
  };
  return (
    `Resolver facts (sole ground truth; use nothing else):\n${JSON.stringify(facts)}\n\n` +
    `Respond ONLY with a JSON object shaped exactly like ` +
    `{"overview": string, "metricsSummary": string, "complianceNote": string, "stewardshipNote": string}.`
  );
}

function isNarrative(v: unknown): v is Narrative {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.overview === 'string' &&
    typeof o.metricsSummary === 'string' &&
    typeof o.complianceNote === 'string' &&
    typeof o.stewardshipNote === 'string'
  );
}

function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : text).trim();
}

export async function llmNarrate(
  schematic: WaterOriginSchematic,
  config: LlmConfig,
  fetchFn: LlmFetch = fetch as unknown as LlmFetch,
  timeoutMs = 20000,
): Promise<Narrative | null> {
  if (!config.apiKey || !config.model) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          { role: 'system', content: WATER_INTELLIGENCE_SYSTEM_PROMPT },
          { role: 'user', content: buildFactsMessage(schematic) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed: unknown = JSON.parse(stripFences(content));
    return isNarrative(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
