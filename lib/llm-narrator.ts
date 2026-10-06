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
  /** 'chat-completions' (OpenAI) or 'responses' (Zen GPT endpoint). */
  api?: 'chat-completions' | 'responses';
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

/** Ground-truth facts plus the user question. No coordinates, no PWSID digits beyond the ID itself. */
export function buildFactsMessage(schematic: WaterOriginSchematic, question = ''): string {
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
  const q = (question ?? '').slice(0, 500).trim();
  const questionLine = q.length > 0 ? `User question (answer this, nothing else): ${q}\n\n` : '';
  return (
    `${questionLine}` +
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

function extractResponsesText(data: unknown): string | null {
  const out = (data as { output?: unknown }).output;
  if (!Array.isArray(out)) return null;
  const texts: string[] = [];
  for (const item of out) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as { type?: string; text?: unknown };
      if (p.type === 'output_text' && typeof p.text === 'string') texts.push(p.text);
    }
  }
  const joined = texts.join('').trim();
  return joined.length > 0 ? joined : null;
}

function extractChatText(data: unknown): string | null {
  const d = data as { choices?: Array<{ message?: { content?: string } }> };
  const content = d.choices?.[0]?.message?.content;
  return content && content.length > 0 ? content : null;
}

export async function llmNarrate(
  schematic: WaterOriginSchematic,
  config: LlmConfig,
  fetchFn: LlmFetch = fetch as unknown as LlmFetch,
  timeoutMs = 20000,
  question = '',
): Promise<Narrative | null> {
  if (!config.apiKey || !config.model) return null;
  const api = config.api ?? 'chat-completions';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const root = config.baseUrl.replace(/\/$/, '');
    const url = api === 'responses' ? `${root}/responses` : `${root}/chat/completions`;
    const body =
      api === 'responses'
        ? {
            model: config.model,
            temperature: 0,
            max_output_tokens: 800,
            input: [
              { role: 'system', content: WATER_INTELLIGENCE_SYSTEM_PROMPT },
              { role: 'user', content: buildFactsMessage(schematic, question) },
            ],
          }
        : {
            model: config.model,
            temperature: 0,
            max_tokens: 800,
            messages: [
              { role: 'system', content: WATER_INTELLIGENCE_SYSTEM_PROMPT },
              { role: 'user', content: buildFactsMessage(schematic, question) },
            ],
          };
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const content = api === 'responses' ? extractResponsesText(data) : extractChatText(data);
    if (!content) return null;
    const parsed: unknown = JSON.parse(stripFences(content));
    return isNarrative(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
